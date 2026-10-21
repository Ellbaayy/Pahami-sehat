/**
 * Lapisan penyajian respons: kompresi, waktu proses, dan 404 JSON.
 *
 * Dipakai DUA entry point (server/index.js lokal & api/index.js Vercel) supaya
 * perilakunya sama — sama seperti kepala.js.
 *
 * ============================================================================
 * KENAPA KOMPRESI, DAN KENAPA TANPA DEPENDENSI BARU
 * ============================================================================
 *
 * Respons JSON aplikasi ini berisi teks Indonesia yang panjang. Diukur 16 Okt
 * 2026: /api/konten 7.281 byte dan TIDAK dikompresi sama sekali (tidak ada
 * `Content-Encoding` walau permintaannya memakai `Accept-Encoding: gzip`).
 * Teks seperti ini biasanya menyusut ~70-80% dengan gzip — dan bagi pengguna di
 * jaringan seluler lambat, itu bedanya antara menunggu dan langsung tampil.
 *
 * `zlib` sudah ada di Node, jadi ini tidak menambah dependensi. Paket
 * `compression` sengaja TIDAK dipakai supaya jumlah dependensi tidak bertambah
 * hanya untuk satu hal yang bisa ditulis ~40 baris.
 *
 * YANG DILEWATI, dan alasannya:
 *   - SSE (/api/tanya/stream): WAJIB mengalir potongan demi potongan. Kalau
 *     dikompresi, jawaban tidak muncul sampai buffer penuh — justru merusak
 *     fitur yang paling butuh terasa cepat.
 *   - Suara (/api/suara): balasannya MP3 yang sudah terkompresi; mengompresi
 *     ulang hanya memakan CPU tanpa memperkecil apa pun.
 *   - Balasan < 500 byte: ukuran header gzip bisa lebih besar dari hematannya.
 *
 * ============================================================================
 * KENAPA 404 JSON
 * ============================================================================
 *
 * Tanpa penangan sendiri, Express menjawab 404 dengan halaman HTML
 * "Cannot GET /api/hilang" — dan halaman itu MENYEBUT EXPRESS. Itu memberi tahu
 * penyerang kerangka apa yang dipakai, sekaligus menyesatkan klien: frontend
 * yang mengharap JSON menerima HTML, lalu gagal dengan pesan yang salah.
 */

import { gzipSync } from 'node:zlib'
import { createReadStream, existsSync, statSync } from 'node:fs'
import { join, resolve, sep } from 'node:path'

/** Di bawah ukuran ini, mengompresi tidak sepadan. */
const MIN_BYTE = 500

/**
 * Apakah respons ini boleh dikompresi?
 *
 * @param {import('express').Request} req
 * @param {import('express').Response} res
 */
function bolehKompres(req, res) {
  // Klien tidak minta kompresi
  if (!/\bgzip\b/.test(String(req.headers['accept-encoding'] ?? ''))) return false

  // Sudah dikompresi / tidak boleh diubah (mis. MP3 dari /api/suara)
  const sudah = res.getHeader('Content-Encoding')
  if (sudah) return false
  const cc = String(res.getHeader('Cache-Control') ?? '')
  if (cc.includes('no-transform')) return false

  // Streaming (SSE) TIDAK boleh di-buffer — lihat catatan di atas
  const tipe = String(res.getHeader('Content-Type') ?? '')
  if (tipe.includes('text/event-stream')) return false

  // Berkas biner yang sudah padat (gambar, audio, font, wasm) tidak diuntungkan
  if (/^(image|audio|video|font)\//.test(tipe)) return false
  if (/application\/(zip|gzip|wasm|octet-stream|pdf)/.test(tipe)) return false

  return true
}

/**
 * Pasang kompresi + penghitung waktu.
 *
 * HARUS dipasang SEBELUM rute: pembungkus `res.send`/`res.json` hanya berlaku
 * untuk respons yang dikirim setelah ini terpasang.
 *
 * @param {import('express').Express} app
 */
export function pasangSaji(app) {
  /* ------------------------------------------------------- waktu proses -- */

  /**
   * Catat lama setiap permintaan dan laporkan lewat header `X-Waktu-Ms`.
   *
   * Kenapa header, bukan hanya log: saat ada yang terasa lambat, pertanyaan
   * pertama selalu "lambat di server atau di jaringan?". Header ini menjawabnya
   * tanpa perlu membuka log server — cukup lihat di alat pengembang peramban.
   * Yang dicatat HANYA angkanya; tidak ada isi permintaan yang disimpan.
   *
   * CARA MEMASANGNYA PENTING. `res.on('finish')` berjalan SETELAH header
   * terkirim, jadi `setHeader` di dalamnya tidak berpengaruh apa-apa — kesalahan
   * ini pernah terjadi dan header-nya tidak pernah muncul. Yang benar: hitung
   * lama saat header AKAN dikirim (lewat `writeHead`), lalu sisipkan di situ.
   */
  app.use((req, res, next) => {
    const mulai = process.hrtime.bigint()
    const writeHeadAsli = res.writeHead.bind(res)

    res.writeHead = function (...args) {
      const ms = Number(process.hrtime.bigint() - mulai) / 1e6
      // Argumen writeHead bisa (status, headers) atau (status, statusMessage, headers)
      let headers = args[args.length - 1]
      if (headers && typeof headers === 'object') {
        // Jangan menimpa kalau rute sudah menyetelnya sendiri
        if (!headers['X-Waktu-Ms'] && !res.getHeader('X-Waktu-Ms')) {
          headers['X-Waktu-Ms'] = ms.toFixed(1)
        }
      } else {
        try {
          res.setHeader('X-Waktu-Ms', ms.toFixed(1))
        } catch {
          /* diabaikan: header hanya untuk diagnosa */
        }
      }

      // Catat hanya yang benar-benar lambat, supaya log tetap berguna saat ada
      // masalah dan tidak tenggelam oleh permintaan biasa.
      if (ms > 3000) {
        console.log(`[lambat] ${req.method} ${req.originalUrl} ${Math.round(ms)}ms`)
      }
      return writeHeadAsli(...args)
    }

    next()
  })

  /* ---------------------------------------------------------- kompresi -- */

  app.use((req, res, next) => {
    const asliJson = res.json.bind(res)
    const asliSend = res.send.bind(res)

    /** Ganti badan respons dengan versi gzip kalau memang menguntungkan. */
    const mampatkan = (badan) => {
      if (!bolehKompres(req, res)) return null
      // `send` bisa dipanggil dengan objek/buffer/string — hanya string yang
      // dikompresi di sini; res.json() sudah mengubah objek jadi string dulu.
      const buf = Buffer.isBuffer(badan) ? badan : Buffer.from(String(badan), 'utf8')
      if (buf.length < MIN_BYTE) return null
      const gep = gzipSync(buf)
      // Kadang hasil kompresi tidak lebih kecil (mis. JSON yang sangat repetitif
      // sudah kecil). Kalau tidak menguntungkan, jangan dipakai.
      if (gep.length >= buf.length) return null
      res.setHeader('Content-Encoding', 'gzip')
      res.setHeader('Vary', 'Accept-Encoding')
      res.setHeader('Content-Length', String(gep.length))
      return gep
    }

    res.json = function (isi) {
      // Lewatkan ke send supaya penggantian di bawah berlaku untuk keduanya
      return asliJson(isi)
    }

    res.send = function (badan) {
      // `send` dipakai internal oleh `json`; keduanya bermuara di sini.
      try {
        const gep = mampatkan(badan)
        if (gep) return asliSend(gep)
      } catch {
        /* gagal mengompresi TIDAK boleh menggagalkan permintaan */
      }
      return asliSend(badan)
    }

    next()
  })

  /* -------------------------------------------------------- 404 JSON ---- */
}

/**
 * Penyaji berkas statis dengan kompresi dan cache yang benar.
 *
 * ============================================================================
 * KENAPA ADA, PADAHAL SUDAH PAKAI express.static
 * ============================================================================
 *
 * Diukur 21 Okt 2026 di server lokal (jalur yang dipakai sekarang, bukan
 * Vercel):
 *
 *   /app/assets/index-*.js   402.486 byte, Content-Encoding TIDAK ADA,
 *                            Cache-Control: public, max-age=0
 *   /app/assets/index-*.css   58.741 byte, sama
 *
 * Dua cacat sekaligus:
 *
 * 1. TIDAK DIKOMPRESI. Isinya teks dan menyusut ~70% (JS 402.486 -> 122.785,
 *    CSS 58.741 -> 11.527). Lapisan gzip di `saji.js` tidak menolong karena ia
 *    membungkus `res.json`/`res.send`, sedangkan `express.static` menulis
 *    langsung ke soket.
 *
 * 2. TIDAK DI-CACHE, padahal nama berkasnya BER-HASH. Nama ber-hash berarti isi
 *    berkas berubah -> nama berubah. Jadi berkas ber-hash boleh disimpan
 *    peramban selamanya tanpa risiko versi basi. `max-age=0` memaksa peramban
 *    menanyakan ulang setiap aset setiap kali halaman dibuka — pemborosan yang
 *    justru bertentangan dengan bagian Green IT di README.
 *
 * Aturan cache dipisah menurut sifat nama berkas, dan itu bukan kerapian:
 *   - ber-hash (`index-yrXE3a2d.js`)  -> 1 tahun, immutable
 *   - ber-nama tetap (`/app/ocr/*`)   -> 1 hari + stale-while-revalidate
 *   - `index.html`                    -> no-cache (harus selalu segar, karena
 *                                        di dalamnya tertulis nama ber-hash)
 *   - sisanya (halaman penjelasan)    -> 5 menit
 *
 * Berkas `.gz` disiapkan oleh `scripts/mampatkan-dist.mjs` saat build, jadi
 * melayani permintaan tidak memakai CPU sama sekali. Kalau berkas `.gz` tidak
 * ada (build lama), berkas asli tetap dikirim — hanya tanpa kompresi. Fitur
 * tidak boleh mati karena satu langkah build terlewat.
 */

/** @param {string} jalur */
function aturanCache(jalur) {
  const nama = jalur.slice(jalur.lastIndexOf('/') + 1)

  // Nama ber-hash dari Vite: nama-<hash8>.<ext>, atau nama-<hash>.js
  const berHash = /-[A-Za-z0-9_-]{8,}\.(js|mjs|css|woff2?|png|jpe?g|webp|svg|gif|avif)$/.test(nama)
  if (berHash) return 'public, max-age=31536000, immutable'

  // index.html: nama tetap, isinya menyebut nama ber-hash -> wajib selalu segar.
  // HANYA kerangka aplikasi di /app/. Halaman penjelasan di root juga bernama
  // index.html, tapi isinya jarang berubah dan justru dibaca juri berulang
  // kali — membuatnya no-cache hanya memaksa unduh ulang tanpa manfaat.
  if (nama === 'index.html') {
    if (jalur === '/app/index.html') return 'no-cache'
    return 'public, max-age=300, stale-while-revalidate=86400'
  }

  // Berkas OCR ber-nama tetap dan besar (3,8 MB per inti + 5 MB data bahasa).
  // Sehari + stale-while-revalidate: pengguna berikutnya tidak menunggu, dan
  // versi baru tetap terpakai keesokan harinya.
  if (jalur.includes('/ocr/')) return 'public, max-age=86400, stale-while-revalidate=604800'

  // Halaman penjelasan dan asetnya: isinya jarang berubah, tapi namanya tetap.
  return 'public, max-age=300, stale-while-revalidate=86400'
}

/**
 * Sajikan satu folder sebagai berkas statis.
 *
 * @param {string} folder folder akar yang disajikan
 * @param {{ awalan?: string }} [opsi] awalan URL (mis. '/app') untuk menentukan jalur
 * @returns {import('express').RequestHandler}
 */
export function sajikanFolder(folder, { awalan = '' } = {}) {
  const akar = resolve(folder)

  return function penyajiStatis(req, res, next) {
    // hanya GET/HEAD yang dilayani dari berkas
    if (req.method !== 'GET' && req.method !== 'HEAD') return next()

    const jalurUrl = decodeURIComponent(req.path)
    // Jalur yang berakhir '/' memakai index.html DI DALAM folder itu — bukan
    // diganti menjadi '/index.html'. Kesalahan ini pernah terjadi: '/app/'
    // berubah jadi '/index.html' sehingga yang tersaji halaman penjelasan,
    // bukan aplikasi.
    const namaBerkas = jalurUrl === '' || jalurUrl.endsWith('/')
      ? `${jalurUrl}index.html`
      : jalurUrl

    // Tolak percobaan keluar dari folder (../) sebelum menyentuh disk.
    // Diperiksa SETELAH jalur digabung, karena `resolve` yang menormalkan '..'.
    const berkas = resolve(join(akar, namaBerkas))
    if (!berkas.startsWith(akar + sep)) return next()
    if (!existsSync(berkas) || !statSync(berkas).isFile()) return next()

    const jalurLogis = `${awalan}${namaBerkas}`
    res.setHeader('Cache-Control', aturanCache(jalurLogis))
    res.setHeader('Content-Type', tipeKonten(namaBerkas))
    // Vary selalu diset: tanpa ini, cache perantara bisa menyajikan versi
    // tanpa kompresi kepada klien yang mendukung gzip, atau sebaliknya.
    res.setHeader('Vary', 'Accept-Encoding')

    // --- kompresi: pakai .gz yang sudah disiapkan saat build ---
    const menerimaGzip = /\bgzip\b/.test(String(req.headers['accept-encoding'] ?? ''))
    const berkasGz = `${berkas}.gz`
    const dipakai = menerimaGzip && existsSync(berkasGz) ? berkasGz : berkas

    if (dipakai === berkasGz) res.setHeader('Content-Encoding', 'gzip')
    res.setHeader('Content-Length', String(statSync(dipakai).size))

    // HEAD: header saja, tanpa badan
    if (req.method === 'HEAD') return res.end()

    // Dialirkan, bukan dibaca utuh ke memori — berkas OCR berukuran 3,8 MB.
    // Galat setelah header terkirim tidak bisa lagi diubah jadi 500; yang
    // benar adalah memutus koneksi supaya klien tahu unduhannya tidak utuh.
    const aliran = createReadStream(dipakai)
    aliran.on('error', () => res.destroy())
    aliran.pipe(res)
  }
}

/** Peta tipe konten minimal — tanpa dependensi tambahan. */
function tipeKonten(nama) {
  const ext = nama.slice(nama.lastIndexOf('.')).toLowerCase()
  const peta = {
    '.html': 'text/html; charset=utf-8',
    '.js': 'text/javascript; charset=utf-8',
    '.mjs': 'text/javascript; charset=utf-8',
    '.css': 'text/css; charset=utf-8',
    '.json': 'application/json; charset=utf-8',
    '.svg': 'image/svg+xml',
    '.png': 'image/png',
    '.jpg': 'image/jpeg',
    '.jpeg': 'image/jpeg',
    '.webp': 'image/webp',
    '.gif': 'image/gif',
    '.avif': 'image/avif',
    '.woff2': 'font/woff2',
    '.woff': 'font/woff',
    '.wasm': 'application/wasm',
    '.txt': 'text/plain; charset=utf-8',
    '.xml': 'application/xml; charset=utf-8',
    '.map': 'application/json; charset=utf-8',
  }
  return peta[ext] ?? 'application/octet-stream'
}

/**
 * Penangan 404 untuk /api/*.
 *
 * Dipasang PALING AKHIR — setelah semua rute DAN setelah penyajian berkas
 * statis. Permintaan yang sampai ke sini tidak cocok dengan apa pun.
 *
 * Kenapa perlu: tanpa ini, Express menjawab 404 dengan halaman HTML
 * "Cannot GET /api/hilang" — halaman itu MENYEBUT Express (memberi tahu
 * penyerang kerangka yang dipakai) sekaligus menyesatkan klien: frontend yang
 * mengharap JSON menerima HTML, lalu gagal dengan pesan yang salah.
 *
 * Hanya /api/* yang diubah. Selain itu dibiarkan ke Express, karena halaman
 * aplikasi punya penangannya sendiri di index.js.
 *
 * @param {import('express').Express} app
 */
export function pasang404Api(app) {
  app.use((req, res, next) => {
    if (!req.path.startsWith('/api/')) return next()
    res.status(404).json({
      ok: false,
      code: 'rute_tidak_ada',
      pesan: `Alamat ${req.method} ${req.path} tidak dikenal.`,
    })
  })
}
