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
