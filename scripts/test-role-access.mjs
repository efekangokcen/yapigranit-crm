// Gerçek, çalışan bir dev sunucusuna karşı rol bazlı erişim ve IDOR testleri.
// Node'un yerleşik test çalıştırıcısını kullanır — YENİ bir bağımlılık eklemez.
//
// Çalıştırma:
//   1) Ayrı bir terminalde:  npm run dev:raw   (http://localhost:3000)
//   2) Sonra:                node --test scripts/test-role-access.mjs
//
// Ortam değişkeni ile hedef sunucu değiştirilebilir: TEST_BASE_URL=http://localhost:3000
//
// NOT: Bu script demo kullanıcı şifrelerini kullanır (rol-tabanli-erisim-sistemi
// dokümantasyonunda kayıtlı, üretimde değiştirilmesi gereken basit demo şifreler).
// Gerçek kullanıcı OLUŞTURMAZ/SİLMEZ — sadece mevcut 4 rol hesabıyla oturum açar.

import { test, describe } from 'node:test'
import assert from 'node:assert/strict'

const BASE = process.env.TEST_BASE_URL || 'http://localhost:3000'

const USERS = {
  yonetici: { username: 'admin', password: '1234', id: 14 },
  pazarlamaci: { username: 'pazarlamaci', password: 'Pazarlama123', id: 8 },
  atolyeci: { username: 'atolyeci', password: 'Atolye123', id: 9 },
  olcucu: { username: 'olcucu', password: 'Olcucu123', id: 10 },
}

function mergeCookies(...cookieArrays) {
  const map = new Map()
  for (const arr of cookieArrays) {
    for (const c of arr) {
      const pair = c.split(';')[0]
      const eq = pair.indexOf('=')
      map.set(pair.slice(0, eq).trim(), pair.trim())
    }
  }
  return [...map.values()].join('; ')
}

async function signIn(username, password) {
  const csrfRes = await fetch(`${BASE}/api/auth/csrf`)
  const csrfCookies = csrfRes.headers.getSetCookie()
  const { csrfToken } = await csrfRes.json()
  const preCookie = mergeCookies(csrfCookies)

  const body = new URLSearchParams({ username, password, csrfToken, callbackUrl: '/', json: 'true' })
  const signInRes = await fetch(`${BASE}/api/auth/callback/credentials`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded', Cookie: preCookie },
    body: body.toString(),
    redirect: 'manual',
  })
  const cookie = mergeCookies(csrfCookies, signInRes.headers.getSetCookie())

  const sessionRes = await fetch(`${BASE}/api/auth/session`, { headers: { Cookie: cookie } })
  const session = await sessionRes.json()
  assert.ok(session?.user?.role, `Giriş başarısız oldu: ${username} için oturum alınamadı`)
  return { cookie, session }
}

async function getStatus(path, cookie) {
  const res = await fetch(`${BASE}${path}`, { headers: { Cookie: cookie }, redirect: 'manual' })
  // Node'un fetch'i (undici) tarayıcının aksine gerçek 3xx kodunu döndürür
  // (opaqueredirect/status 0 değil) — middleware/redirect() çıktısı burada yakalanır.
  if (res.status >= 300 && res.status < 400) return 'REDIRECT'
  return res.status
}

// ── Rol × modül erişim matrisi (permissions.ts ile birebir aynı olmalı) ──
const ALLOWED = 200
const BLOCKED = 'REDIRECT'

const ACCESS_CASES = [
  // path, { role: expectedStatus }
  ['/musteriler', { yonetici: ALLOWED, pazarlamaci: ALLOWED, atolyeci: BLOCKED, olcucu: BLOCKED }],
  ['/odemeler', { yonetici: ALLOWED, pazarlamaci: ALLOWED, atolyeci: BLOCKED, olcucu: BLOCKED }],
  ['/atolye', { yonetici: ALLOWED, pazarlamaci: ALLOWED, atolyeci: ALLOWED, olcucu: BLOCKED }],
  ['/olcu-ekibi', { yonetici: ALLOWED, pazarlamaci: ALLOWED, atolyeci: BLOCKED, olcucu: ALLOWED }],
  ['/montaj-ekibi', { yonetici: ALLOWED, pazarlamaci: ALLOWED, atolyeci: BLOCKED, olcucu: BLOCKED }],
  ['/planlama/uretim', { yonetici: ALLOWED, pazarlamaci: ALLOWED, atolyeci: BLOCKED, olcucu: BLOCKED }],
  ['/tas-takibi/stok-kontrol', { yonetici: ALLOWED, pazarlamaci: ALLOWED, atolyeci: BLOCKED, olcucu: BLOCKED }],
  ['/kullanicilar', { yonetici: ALLOWED, pazarlamaci: BLOCKED, atolyeci: BLOCKED, olcucu: BLOCKED }],
  ['/aktivite', { yonetici: ALLOWED, pazarlamaci: ALLOWED, atolyeci: BLOCKED, olcucu: BLOCKED }],
]

describe('Sayfa erişim matrisi (middleware canAccess) — gerçek HTTP istekleriyle', () => {
  for (const [path, expectations] of ACCESS_CASES) {
    for (const [role, expected] of Object.entries(expectations)) {
      test(`${role} → ${path} → ${expected === ALLOWED ? '200 (izinli)' : 'redirect (bloklu)'}`, async () => {
        const { username, password } = USERS[role]
        const { cookie } = await signIn(username, password)
        const status = await getStatus(path, cookie)
        assert.equal(status, expected, `${role} için ${path} beklenen=${expected} gerçek=${status}`)
      })
    }
  }
})

describe('Kimliksiz erişim', () => {
  test('oturum yokken korumalı sayfaya gidince login\'e yönlendirilir', async () => {
    const status = await getStatus('/verimlilik', '')
    assert.equal(status, 'REDIRECT')
  })

  test('oturum yokken /login herkese açık (200)', async () => {
    const status = await getStatus('/login', '')
    assert.equal(status, 200)
  })
})
