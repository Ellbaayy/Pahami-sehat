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
import { pasangKepala } from './kepala.js'
import rute from './rute.js'
import ruteAkun from './ruteAkun.js'

const __dirname = dirname(fileURLToPath(import.meta.url))
const DIST = join(__dirname, '..', 'dist')

const app = express()
pasangKepala(app)
app.use(express.json({ limit: '1mb' }))

// seluruh endpoint API
app.use(rute)
// endpoint akun (daftar, masuk, keluar, nama panggilan, riwayat)
app.use(ruteAkun)

/* ------------------------------------------- sajikan aplikasi hasil build --- */

const APP_DIST = join(DIST, 'app')

if (existsSync(DIST)) {
  // Halaman penjelasan menempati ROOT situs (dist/index.html), dan salinannya
  // ada di /prototipe/ supaya tautan lama tetap hidup. Aplikasi React disajikan
  // terpisah di /app/ (dist/app/) — jadi yang muncul pertama kali dibuka adalah
  // halaman penjelasan, bukan aplikasi.
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

/* ------------------------------------------------------- galat terakhir --- */

/**
 * Penangan galat terakhir.
 *
 * Tanpa ini, Express mengirim halaman HTML berisi jejak tumpukan — dan itu
 * membocorkan isi kode serta detail SQL ke pengguna. Di sini semua galat
 * diubah jadi JSON yang aman.
 */
app.use((err, _req, res, _next) => {
  if (err?.name === 'AkunError') {
    return res.status(err.status ?? 400).json({ ok: false, code: err.kode, pesan: err.message })
  }
  // batas laju dari batas.js mengirim status 429 dengan pesan yang sudah ramah
  if (err?.status === 429 || err?.statusCode === 429) {
    return res.status(429).json({ ok: false, code: 'terlalu_sering', pesan: err.message })
  }
  console.error('[galat]', err?.message ?? err)
  res.status(500).json({ ok: false, code: 'galat_server', pesan: 'Terjadi kesalahan. Coba lagi.' })
})

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
