/**
 * Entry point serverless Vercel.
 *
 * Vercel mencari folder `api/` di root project. Semua permintaan `/api/*`
 * diarahkan ke sini lewat rewrite di vercel.json.
 *
 * Server Express lengkap dipakai di dalam satu fungsi serverless — jadi
 * perilakunya sama persis dengan `npm run server` di laptop.
 *
 * `express.json()` WAJIB dipasang di sini: Vercel memanggil fungsi ini sebagai
 * handler mentah (req, res), bukan lewat server yang sudah punya parser body.
 *
 * URUTAN PEMASANGAN PENTING, dan harus sama dengan server/index.js:
 *   kepala -> saji (kompresi/waktu) -> json -> rute -> 404 API -> galat
 * Kalau urutannya berbeda, perilaku lokal dan produksi ikut berbeda — dan
 * perbedaan seperti itu paling sulit dilacak karena hanya muncul di satu sisi.
 */

import express from 'express'
import { pasangKepala } from '../server/kepala.js'
import { pasangSaji, pasang404Api } from '../server/saji.js'
import rute from '../server/rute.js'
import ruteAkun from '../server/ruteAkun.js'

const app = express()

pasangKepala(app)
// kompresi + waktu proses — SEBELUM rute supaya berlaku untuk semua respons
pasangSaji(app)
app.use(express.json({ limit: '1mb' }))
app.use(rute)
// Rute akun WAJIB dipasang di sini juga. Sebelumnya hanya server lokal yang
// memasangnya, sehingga di Vercel seluruh /api/akun/* menjawab 404 — dan itu
// membuat halaman masuk gagal dengan pesan yang menyesatkan ("Gagal
// menghubungi server"), bukan "fitur ini tidak tersedia di sini".
app.use(ruteAkun)

// 404 untuk /api/* sebagai JSON, bukan halaman HTML Express.
pasang404Api(app)

/**
 * Penangan galat.
 *
 * Sama seperti server/index.js: `err.status` dari Express DIHORMATI lebih dulu,
 * supaya kesalahan klien (JSON rusak = 400, body kebesaran = 413) tidak
 * dilaporkan sebagai kesalahan server (500).
 */
app.use((err, _req, res, _next) => {
  if (err?.name === 'AkunError') {
    return res.status(err.status ?? 400).json({ ok: false, code: err.kode, pesan: err.message })
  }

  const statusKlien = Number(err?.status ?? err?.statusCode ?? 0)
  if (statusKlien === 429) {
    return res.status(429).json({ ok: false, code: 'terlalu_sering', pesan: err.message })
  }
  if (statusKlien >= 400 && statusKlien < 500) {
    const pesan =
      statusKlien === 413
        ? 'Isi permintaan terlalu besar. Kirim teks yang lebih pendek.'
        : 'Bentuk permintaan belum benar. Periksa lagi isinya.'
    return res.status(statusKlien).json({ ok: false, code: 'permintaan_tidak_sah', pesan })
  }

  console.error('[galat]', err?.message ?? err)
  res.status(500).json({ ok: false, code: 'galat_server', pesan: 'Terjadi kesalahan. Coba lagi.' })
})

export default app
