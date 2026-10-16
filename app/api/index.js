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
 */

import express from 'express'
import { pasangKepala } from '../server/kepala.js'
import rute from '../server/rute.js'
import ruteAkun from '../server/ruteAkun.js'

const app = express()

pasangKepala(app)
app.use(express.json({ limit: '1mb' }))
app.use(rute)
// Rute akun WAJIB dipasang di sini juga. Sebelumnya hanya server lokal yang
// memasangnya, sehingga di Vercel seluruh /api/akun/* menjawab 404 — dan itu
// membuat halaman masuk gagal dengan pesan yang menyesatkan ("Gagal
// menghubungi server"), bukan "fitur ini tidak tersedia di sini".
app.use(ruteAkun)

export default app
