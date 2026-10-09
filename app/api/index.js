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
import rute from '../server/rute.js'

const app = express()

app.use(express.json({ limit: '1mb' }))
app.use(rute)

export default app
