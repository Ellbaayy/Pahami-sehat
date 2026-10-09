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

if (existsSync(DIST)) {
  app.use(express.static(DIST))
  // SPA fallback — jangan menelan /api
  app.get(/^(?!\/api).*/, (_req, res) => res.sendFile(join(DIST, 'index.html')))
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
