/**
 * Server Pahami Sehat — untuk dev lokal dan Grand Final.
 *
 * Jalankan:  npm run server
 *
 * Semua endpoint ada di server/rute.js (dipakai bersama dengan versi Vercel
 * lewat api/index.js).
 * Kalau folder `dist/` ada, server ini sekaligus menyajikan aplikasi hasil build
 * di `/` — jadi untuk Grand Final cukup satu perintah, satu port, tanpa internet.
 *
 * CATATAN: berkas ini juga diimpor oleh uji (`uji-server.mjs` memakai `app`-nya
 * langsung). Karena itu port hanya dibuka kalau berkas ini dijalankan langsung —
 * lihat penjagaan `dijalankanLangsung` di bagian bawah.
 */

import express from 'express'
import { existsSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join, resolve } from 'node:path'

import { config, safeInfo } from './config.js'
import { pasangKepala } from './kepala.js'
import { pasangSaji, pasang404Api } from './saji.js'
import rute from './rute.js'
import { keteranganDb, tutupDb } from './db.js'

const __dirname = dirname(fileURLToPath(import.meta.url))
const DIST = join(__dirname, '..', 'dist')

const app = express()
pasangKepala(app)
// kompresi + waktu proses — SEBELUM rute supaya berlaku untuk semua respons
pasangSaji(app)
app.use(express.json({ limit: '1mb' }))

// seluruh endpoint API
app.use(rute)

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
  //
  // PENTING: hanya jalur TANPA ekstensi berkas yang jatuh ke fallback.
  // Sebelumnya pola ini menangkap SEMUA /app/*, sehingga permintaan untuk
  // berkas yang tidak ada (mis. /app/.env, /app/package.json,
  // /app/server/config.js) dijawab HTTP 200 berisi HTML 687 byte. Isinya tidak
  // pernah bocor — express.static menolak melayani berkas di luar dist/ — tapi
  // status 200 untuk berkas yang tidak ada itu menyesatkan: alat pemantau
  // mengira berkasnya ada, dan orang yang memeriksa keamanan harus membuka
  // isinya dulu untuk tahu itu bukan kebocoran. Sekarang berkas berekstensi
  // yang tidak ada dijawab 404 apa adanya.
  app.get(/^\/app(\/.*)?$/, (req, res, next) => {
    // Ada titik di segmen terakhir = permintaan berkas, bukan rute aplikasi.
    const segmen = req.path.split('/').pop() ?? ''
    if (segmen.includes('.')) return next()
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

/* -------------------------------------------------------- 404 API ------- */

// Dipasang setelah rute & berkas statis, TAPI sebelum penangan galat.
// Hanya /api/* yang diubah jadi JSON — lihat catatan di saji.js.
pasang404Api(app)

/* ------------------------------------------------------- galat terakhir --- */

/**
 * Penangan galat terakhir.
 *
 * Tanpa ini, Express mengirim halaman HTML berisi jejak tumpukan — dan itu
 * membocorkan isi kode serta detail SQL ke pengguna. Di sini semua galat
 * diubah jadi JSON yang aman.
 *
 * URUTAN PEMERIKSAAN PENTING. Express menandai galat dengan `err.status` /
 * `err.statusCode` (mis. body JSON yang rusak = 400, body terlalu besar = 413).
 * Kalau nomor itu DIABAIKAN, kesalahan KLIEN dilaporkan sebagai kesalahan
 * SERVER (500) — dan itu menyesatkan dua pihak sekaligus: pengguna disuruh
 * "coba lagi" padahal permintaannya yang salah, dan pemantauan melihat 500
 * seolah server kita yang rusak. Karena itu `err.status` dihormati lebih dulu.
 *
 * Galat 4xx dari parser TIDAK dicatat sebagai galat server — memang bukan.
 */
app.use((err, _req, res, _next) => {
  // Kesalahan dari sisi KLIEN (Express sudah menandainya 4xx). Termasuk:
  //   - body JSON yang rusak          -> 400 entity.parse.failed
  //   - body melebihi batas 1 MB      -> 413 entity.too.large
  //   - tipe konten tak didukung      -> 415
  const statusKlien = Number(err?.status ?? err?.statusCode ?? 0)

  // batas laju dari batas.js mengirim 429 dengan pesan yang sudah ramah.
  // Diperiksa SEBELUM cabang 4xx umum di bawah — kalau tidak, 429 tertangkap
  // lebih dulu oleh rentang 400-499 dan pesan aslinya ikut tergantikan.
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

/* --------------------------------------------------------------- start ---- */

/**
 * Server hanya dinyalakan kalau berkas ini DIJALANKAN LANGSUNG
 * (`node server/index.js` atau `npm run server`).
 *
 * Kalau diimpor — mis. oleh `uji-server.mjs`, yang perlu `app`-nya saja —
 * TIDAK ada port yang dibuka. Tanpa penjagaan ini, mengimpor berkas ini
 * langsung membuka port 8787 dan menghentikan proses saat portnya sudah
 * dipakai, sehingga uji tidak bisa berjalan berdampingan dengan server biasa.
 */
const dijalankanLangsung =
  process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)

let server = null

if (dijalankanLangsung) {
  server = app.listen(config.port, '127.0.0.1', async () => {
    const info = safeInfo()
    console.log(`\n  Pahami Sehat — server siap`)
    console.log(`  http://127.0.0.1:${config.port}`)
    console.log(`  model   : ${info.model}`)
    console.log(`  api key : terpasang (${info.keyPrefix})`)
    console.log(`  dist    : ${existsSync(DIST) ? 'disajikan dari /' : 'belum dibuild'}`)

    // Keadaan fitur yang GAMPANG salah dan tidak terlihat dari luar. Dicetak saat
    // mulai supaya tidak perlu ditebak saat ada yang tidak jalan:
    //   - tanpa database, bahan tetap tersaji dari cache (dan itu disebut apa adanya)
    const dbInfo = await keteranganDb().catch(() => ({ aktif: false, alasan: 'gagal diperiksa' }))
    console.log(`  database: ${dbInfo.aktif ? `tersambung (${dbInfo.database}@${dbInfo.host}:${dbInfo.port})` : `TIDAK AKTIF — ${dbInfo.alasan}`}`)
    console.log(`  alamat  : ${existsSync(APP_DIST) ? `http://127.0.0.1:${config.port}/app/` : 'belum dibuild'}\n`)
  })

  /**
   * Matikan dengan rapi: tutup dulu pool database, baru keluar.
   *
   * Tanpa ini, koneksi MariaDB dibiarkan menggantung sampai server habis
   * waktunya. Saat menguji berulang kali (start/stop puluhan kali sehari), itu
   * menumpuk menjadi koneksi "tidur" yang memakan slot `max_connections`.
   *
   * DUA HAL YANG GAMPANG SALAH DI SINI, dan keduanya pernah terjadi:
   *
   * 1. `server.close()` SENDIRI TIDAK CUKUP. Ia hanya berhenti menerima
   *    koneksi BARU dan menunggu yang lama selesai — sedangkan peramban dan
   *    curl memakai keep-alive, jadi koneksinya tetap terbuka dan callback-nya
   *    TIDAK PERNAH dipanggil. Terukur: proses masih hidup 6 detik setelah
   *    SIGTERM. Karena itu `closeIdleConnections()` dipanggil untuk menutup
   *    yang menganggur.
   *
   * 2. Proses TIDAK BOLEH menggantung kalau database tidak menjawab. Penutupan
   *    pool diberi batas waktu 3 detik, dan ada jaring pengaman terakhir:
   *    kalau 5 detik berlalu, proses keluar juga. Mematikan server tidak boleh
   *    menunggu selamanya.
   */
  for (const sinyal of ['SIGINT', 'SIGTERM']) {
    process.on(sinyal, () => {
      console.log(`\n  Menerima ${sinyal} — menutup dengan rapi…`)

      // jaring pengaman: apa pun yang terjadi, jangan menggantung selamanya
      const paksa = setTimeout(() => {
        console.log('  Penutupan memakan waktu terlalu lama — keluar paksa.')
        process.exit(0)
      }, 5000)
      paksa.unref()

      server.close(async () => {
        try {
          await Promise.race([
            tutupDb(),
            new Promise((r) => setTimeout(r, 3000)), // jangan menggantung
          ])
        } catch {
          /* gagal menutup pool tidak boleh menghalangi keluar */
        }
        console.log('  Selesai. Sampai jumpa.')
        process.exit(0)
      })

      // tutup koneksi yang sedang menganggur supaya callback di atas terpanggil
      server.closeIdleConnections?.()
    })
  }
}

export { app }
export default app
