/**
 * Server Pahami Sehat — untuk dev lokal dan Grand Final.
 *
 * Jalankan:  npm run server
 *
 * Semua endpoint ada di server/rute.js (dipakai bersama dengan versi Vercel).
 * Kalau folder `dist/` ada, server ini sekaligus menyajikan aplikasi hasil build
 * di `/` — jadi untuk Grand Final cukup satu perintah, satu port, tanpa internet.
 */

import express from 'express'
import { existsSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

import { config, safeInfo } from './config.js'
import rute from './rute.js'

const __dirname = dirname(fileURLToPath(import.meta.url))
const DIST = join(__dirname, '..', 'dist')

const app = express()
app.use(express.json({ limit: '1mb' }))

// seluruh endpoint API
app.use(rute)

/* ------------------------------------------- sajikan aplikasi hasil build --- */

const APP_DIST = join(DIST, 'app')

if (existsSync(DIST)) {
  // halaman penjelasan ada di root (dist/index.html), salinannya di /prototipe/
  app.use(express.static(DIST))
  // aplikasi React disajikan di /app/
  if (existsSync(APP_DIST)) app.use('/app', express.static(APP_DIST))

  // SPA fallback aplikasi: rute dalam aplikasi (mis. /app/apa-pun) -> index aplikasi.
  // Dibatasi ke /app supaya tidak menelan halaman penjelasan di root.
  app.get(/^\/app(\/.*)?$/, (_req, res) => {
    const idx = join(APP_DIST, 'index.html')
    if (existsSync(idx)) return res.sendFile(idx)
    res.status(404).type('text/plain').send('Aplikasi belum dibuild. Jalankan: npm run build\n')
  })
} else {
  app.get('/', (_req, res) =>
    res
      .status(200)
      .type('text/plain')
      .send('Server Pahami Sehat jalan.\nBelum ada hasil build. Jalankan: npm run build\n'),
  )
}

/* --------------------------------------------------------------- start ---- */

const server = app.listen(config.port, '127.0.0.1', () => {
  const info = safeInfo()
  console.log(`\n  Pahami Sehat — server siap`)
  console.log(`  http://127.0.0.1:${config.port}`)
  console.log(`  model   : ${info.model}`)
  console.log(`  api key : terpasang (${info.keyPrefix})`)
  console.log(`  dist    : ${existsSync(DIST) ? 'disajikan dari /' : 'belum dibuild'}\n`)
})

for (const sinyal of ['SIGINT', 'SIGTERM']) {
  process.on(sinyal, () => {
    server.close(() => process.exit(0))
  })
}
