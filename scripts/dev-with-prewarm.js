const { spawn } = require('child_process')
const path = require('path')

const portArgIndex = process.argv.findIndex((arg) => arg === '--port' || arg === '-p')
const port = portArgIndex >= 0 ? process.argv[portArgIndex + 1] : process.env.PORT || '3000'
const host = `http://localhost:${port}`

const routes = [
  '/',
  '/musteriler',
  '/musteriler/1',
  '/maliyet',
  '/maliyet/1',
  '/maliyet/1/duzenle',
  '/teklifler',
  '/teklifler/yeni?costCalcId=1',
  '/sozlesmeler',
  '/odemeler',
  '/odemeler/rapor',
  '/pipeline',
  '/planlama',
  '/planlama/isler',
  '/planlama/olcu',
  '/planlama/revize',
  '/planlama/bildirimler',
  '/planlama/uretim',
  '/planlama/montaj',
  '/tas-takibi?tab=stok',
  '/olcu-ekibi',
  '/imalathane',
  '/atolye',
  '/montaj-ekibi',
  '/api/auth/session',
  '/api/maliyet/1',
  '/api/price-adjustments',
]

const nextBin = process.execPath
const nextArgs = [path.join(process.cwd(), 'node_modules', 'next', 'dist', 'bin', 'next'), 'dev', '--port', port]
let prewarmed = false

const child = spawn(nextBin, nextArgs, {
  cwd: process.cwd(),
  env: process.env,
  stdio: ['ignore', 'pipe', 'pipe'],
  shell: false,
})

function forward(stream, write) {
  stream.on('data', (chunk) => {
    const text = chunk.toString()
    write(chunk)
    if (!prewarmed && /Ready in|Local:/.test(text)) {
      prewarmed = true
      setTimeout(() => prewarm().catch((error) => {
        console.error('[prewarm] failed:', error.message)
      }), 300)
    }
  })
}

forward(child.stdout, (chunk) => process.stdout.write(chunk))
forward(child.stderr, (chunk) => process.stderr.write(chunk))

child.on('exit', (code, signal) => {
  if (signal) process.kill(process.pid, signal)
  process.exit(code ?? 0)
})

async function prewarm() {
  console.log(`[prewarm] compiling ${routes.length} common routes...`)
  const startedAt = Date.now()

  for (const route of routes) {
    const routeStart = Date.now()
    try {
      const response = await fetch(`${host}${route}`, {
        headers: { 'x-dev-prewarm': '1' },
      })
      const elapsed = Date.now() - routeStart
      console.log(`[prewarm] ${response.status} ${route} ${elapsed}ms`)
    } catch (error) {
      const elapsed = Date.now() - routeStart
      console.log(`[prewarm] skip ${route} ${elapsed}ms ${error.message}`)
    }
  }

  console.log(`[prewarm] done in ${Date.now() - startedAt}ms`)
}
