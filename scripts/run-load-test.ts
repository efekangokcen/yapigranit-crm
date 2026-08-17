/**
 * Kontrollü, kademeli yük testi — GÜVENLİK KİLİTLİ.
 *
 * Sadece ayrı bir test ortamına (LOAD_TEST_BASE_URL) karşı çalışır. Varsayılan
 * hedef `http://localhost:3000` DEĞİLDİR — açıkça belirtilmelidir, böylece yanlışlıkla
 * paylaşılan/production sunucusuna karşı çalıştırılmaz.
 *
 * Her sanal kullanıcı GERÇEK bir giriş yapar (6 demo hesap round-robin) — tek bir
 * yöneticinin session'ı yüzlerce kullanıcı için kopyalanmaz.
 *
 * Kullanım:
 *   LOAD_TEST_CONFIRM=YES LOAD_TEST_BASE_URL=http://localhost:3001 npx tsx scripts/run-load-test.ts
 *
 * Kademeler 1→5→10→25→50→100→250→500 şeklinde artar; bir kademede hata oranı %5'i
 * geçerse veya P95 3 saniyeyi aşarsa test orada durur (daha yükseğe çıkmaz).
 */
import autocannon from 'autocannon'
import { writeFile, mkdir } from 'fs/promises'
import path from 'path'

const DEMO_USERS = [
  { username: 'yonetici', password: 'Yonetici123' },
  { username: 'pazarlamaci', password: 'Pazarlama123' },
  { username: 'atolyeci', password: 'Atolye123' },
  { username: 'olcucu', password: 'Olcucu123' },
  { username: 'montajci', password: 'Montaj123' },
  { username: 'yazilimci', password: 'Yazilim123' },
]

// Gerçek CRM kullanımına yakın ağırlıklandırılmış istek dağılımı.
const SCENARIOS: { weight: number; path: string; label: string }[] = [
  { weight: 20, path: '/', label: 'dashboard' },
  { weight: 20, path: '/musteriler', label: 'musteri-listesi' },
  { weight: 15, path: '/teklifler', label: 'teklif-listesi' },
  { weight: 10, path: '/sozlesmeler', label: 'sozlesme-listesi' },
  { weight: 10, path: '/pipeline', label: 'is-akisi' },
  { weight: 15, path: '/verimlilik', label: 'verimlilik-raporu' },
  { weight: 10, path: '/aktivite', label: 'aktivite-log' },
]

function assertSafeToRun() {
  if (process.env.LOAD_TEST_CONFIRM !== 'YES') {
    throw new Error('LOAD_TEST_CONFIRM=YES olmadan bu script çalışmaz.')
  }
  const baseUrl = process.env.LOAD_TEST_BASE_URL
  if (!baseUrl) {
    throw new Error('LOAD_TEST_BASE_URL tanımlanmalı — varsayılan hedef yoktur (güvenlik).')
  }
  if (/vercel\.app|supabase\.co|\.com$|production|prod\./i.test(baseUrl)) {
    throw new Error(`LOAD_TEST_BASE_URL production/bulut gibi görünüyor (${baseUrl}) — durduruldu.`)
  }
  return baseUrl
}

async function loginAndGetCookie(baseUrl: string, username: string, password: string): Promise<string> {
  const csrfRes = await fetch(`${baseUrl}/api/auth/csrf`)
  const csrfCookies = csrfRes.headers.getSetCookie()
  const { csrfToken } = await csrfRes.json()
  const preCookie = csrfCookies.map((c) => c.split(';')[0]).join('; ')

  const body = new URLSearchParams({ username, password, csrfToken, callbackUrl: '/', json: 'true' })
  const signInRes = await fetch(`${baseUrl}/api/auth/callback/credentials`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded', Cookie: preCookie },
    body: body.toString(),
    redirect: 'manual',
  })
  const signInCookies = signInRes.headers.getSetCookie()
  const map = new Map<string, string>()
  for (const c of [...csrfCookies, ...signInCookies]) {
    const pair = c.split(';')[0]
    map.set(pair.split('=')[0], pair)
  }
  return [...map.values()].join('; ')
}

function pickScenario(): { path: string; label: string } {
  const total = SCENARIOS.reduce((s, x) => s + x.weight, 0)
  let r = Math.random() * total
  for (const s of SCENARIOS) {
    if (r < s.weight) return s
    r -= s.weight
  }
  return SCENARIOS[0]
}

interface StageResult {
  connections: number
  durationSec: number
  totalRequests: number
  errors: number
  errorRate: number
  rps: number
  latencyMs: { p50: number; p90: number; p95: number; p99: number; avg: number; max: number }
  statusCodes: Record<string, number>
}

async function runStage(baseUrl: string, cookies: string[], connections: number, durationSec: number): Promise<StageResult> {
  const statusCodes: Record<string, number> = {}

  const result = await autocannon({
    url: baseUrl,
    connections,
    duration: durationSec,
    requests: [
      {
        setupRequest: (req) => {
          const scenario = pickScenario()
          const cookie = cookies[Math.floor(Math.random() * cookies.length)]
          req.path = scenario.path
          req.headers = { ...req.headers, Cookie: cookie }
          return req
        },
      },
    ],
    setupClient: () => {},
  })

  for (const [code, count] of Object.entries(result['2xx'] !== undefined ? { '2xx': result['2xx'], '3xx': result['3xx'], '4xx': result['4xx'], '5xx': result['5xx'] } : {})) {
    statusCodes[code] = count as number
  }

  const errors = (result['4xx'] ?? 0) + (result['5xx'] ?? 0) + (result.errors ?? 0) + (result.timeouts ?? 0)
  const totalRequests = result.requests.total

  return {
    connections,
    durationSec,
    totalRequests,
    errors,
    errorRate: totalRequests > 0 ? errors / totalRequests : 0,
    rps: result.requests.average,
    latencyMs: {
      p50: result.latency.p50,
      p90: result.latency.p90,
      p95: result.latency.p97_5 ?? result.latency.p95 ?? 0,
      p99: result.latency.p99,
      avg: result.latency.average,
      max: result.latency.max,
    },
    statusCodes,
  }
}

async function main() {
  const baseUrl = assertSafeToRun()
  const levels = (process.env.LOAD_TEST_LEVELS || '1,5,10,25,50,100').split(',').map(Number)
  const durationSec = Number(process.env.LOAD_TEST_DURATION_SEC || 15)

  console.log(`Hedef: ${baseUrl}`)
  console.log(`Kademeler: ${levels.join(', ')} eşzamanlı bağlantı, her biri ${durationSec}sn`)
  console.log(`${DEMO_USERS.length} demo hesapla gerçek giriş yapılıyor...`)

  const cookies: string[] = []
  for (const u of DEMO_USERS) {
    try {
      cookies.push(await loginAndGetCookie(baseUrl, u.username, u.password))
      console.log(`  ✓ ${u.username} giriş yaptı`)
    } catch (e) {
      console.error(`  ✗ ${u.username} giriş yapamadı:`, (e as Error).message)
    }
  }
  if (cookies.length === 0) throw new Error('Hiçbir demo hesapla giriş yapılamadı — hedef sunucu/DB doğru mu?')

  const stageResults: StageResult[] = []
  let stoppedAt: number | null = null
  let stopReason = ''

  for (const level of levels) {
    console.log(`\n--- ${level} eşzamanlı bağlantı ---`)
    const stage = await runStage(baseUrl, cookies, level, durationSec)
    stageResults.push(stage)
    console.log(`  RPS: ${stage.rps.toFixed(1)} | P50: ${stage.latencyMs.p50}ms | P95: ${stage.latencyMs.p95}ms | P99: ${stage.latencyMs.p99}ms | Hata oranı: ${(stage.errorRate * 100).toFixed(2)}%`)

    if (stage.errorRate > 0.05) {
      stoppedAt = level
      stopReason = `Hata oranı %5'i geçti (${(stage.errorRate * 100).toFixed(1)}%)`
      break
    }
    if (stage.latencyMs.p95 > 3000) {
      stoppedAt = level
      stopReason = `P95 3 saniyeyi geçti (${stage.latencyMs.p95}ms)`
      break
    }
  }

  if (stoppedAt) {
    console.log(`\n⚠ Test durduruldu: ${stopReason} (seviye: ${stoppedAt})`)
  } else {
    console.log(`\n✓ Tüm kademeler eşik aşılmadan tamamlandı.`)
  }

  const outDir = path.join(process.cwd(), 'test-results', 'load')
  await mkdir(outDir, { recursive: true })
  const artifact = {
    testType: 'load',
    environment: baseUrl,
    startedAt: new Date().toISOString(),
    measured: true,
    stoppedEarly: !!stoppedAt,
    stopReason: stopReason || null,
    stages: stageResults,
  }
  const outFile = path.join(outDir, 'latest.json')
  await writeFile(outFile, JSON.stringify(artifact, null, 2))
  console.log(`\nSonuçlar yazıldı: ${outFile}`)

  process.exit(0)
}

main().catch((err) => {
  console.error('Yük testi durduruldu veya hata verdi:', err.message)
  process.exit(1)
})
