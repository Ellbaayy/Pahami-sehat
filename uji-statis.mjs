/**
 * Uji penyajian berkas statis: kompresi, aturan cache, dan penolakan keluar folder.
 *
 * ============================================================================
 * KENAPA UJI INI ADA
 * ============================================================================
 *
 * Lapisan ini menggantikan `express.static` (21 Okt 2026) supaya berkas hasil
 * build dikompresi dan di-cache dengan benar. Tiga kesalahan nyata pernah
 * terjadi SAAT MEMBUATNYA, dan ketiganya LOLOS dari build yang hijau serta dari
 * seluruh uji lain:
 *
 *   1. Jalur yang berakhir '/' diganti menjadi '/index.html' sehingga
 *      GET /app/ menyajikan HALAMAN PENJELASAN, bukan aplikasi React. Halaman
 *      tetap HTTP 200 dan tetap terlihat wajar — hanya isinya yang salah.
 *   2. Aturan `no-cache` untuk index.html dikenakan ke SEMUA index.html,
 *      termasuk halaman penjelasan di root.
 *   3. Total unduhan awal sempat "turun 96%" karena yang terunduh hanya satu
 *      berkas — bukan karena kompresi. Angka yang membaik bisa menutupi
 *      kesalahan yang lebih besar.
 *
 * Karena itu yang diuji di sini BUKAN "server hidup", melainkan:
 *   - isi halaman benar-benar halaman yang benar (bukan sekadar status 200)
 *   - header kompresi dan cache sesuai sifat nama berkasnya
 *   - isi berkas setelah didekompresi identik dengan berkas aslinya
 *   - percobaan keluar folder tetap ditolak
 *
 * Butuh `dist/` hasil build dan TIDAK butuh jaringan maupun API key.
 * Pemakaian: node uji-statis.mjs
 */

import { createServer, request as httpRequest } from 'node:http'
import { readFileSync, existsSync } from 'node:fs'
import { gunzipSync } from 'node:zlib'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const AKAR = dirname(fileURLToPath(import.meta.url))
const DIST = join(AKAR, 'app', 'dist')

if (!existsSync(join(DIST, 'index.html'))) {
  console.error('dist/ belum ada. Jalankan dulu: cd app && npm run build')
  process.exit(1)
}

/*
 * ============================================================================
 * KENAPA UJI INI MEMASANG KUNCI PALSU SENDIRI
 * ============================================================================
 *
 * `app/server/config.js` menolak diimpor tanpa `KENARI_API_KEY` — ia melempar
 * galat saat modul dibaca, bukan saat dipakai. Karena uji ini mengimpor server
 * SUNGGUHAN (supaya yang diuji benar-benar kabel produksinya, bukan tiruan),
 * uji ini ikut terkena aturan itu.
 *
 * Diukur 21 Okt 2026: lokal LOLOS, CI MERAH. Sebabnya shell pengembang
 * kebetulan sudah mengekspor `KENARI_API_KEY` yang asli, sedangkan runner
 * GitHub tidak punya. Uji yang lulus hanya karena lingkungan kebetulan
 * menyediakan rahasia adalah uji yang berbohong.
 *
 * Yang dipasang di sini adalah KUNCI PALSU, dan itu disengaja: lapisan berkas
 * statis tidak pernah memanggil layanan model, jadi nilainya tidak pernah
 * dipakai untuk apa pun. Dengan begitu uji ini tetap memenuhi syarat CI —
 * "tanpa jaringan dan tanpa rahasia" — sementara yang diuji tetap server asli.
 *
 * `DB_MATI=1` juga dipasang supaya uji tidak bergantung pada ada tidaknya
 * MariaDB di mesin yang menjalankannya (lihat penjelasan `DIMATIKAN` di db.js).
 *
 * Nilainya DIPAKSA, bukan hanya diisi kalau kosong (`||=`): kalau kunci asli
 * dibiarkan lewat, lokal dan CI menjalankan uji dengan lingkungan yang BEDA —
 * dan persis itu yang membuat kegagalan ini tidak terlihat dari lokal.
 *
 * JANGAN pernah mengganti ini dengan kunci sungguhan.
 */
process.env.KENARI_API_KEY = 'uji-tanpa-kunci-asli'
process.env.DB_MATI = '1'

// Server dirakit langsung dari `app` Express yang sama dengan produksi,
// di port acak — supaya uji tidak bergantung pada port 8787 yang mungkin
// sedang dipakai server lain, dan tidak menabrak server pengembang.
const { default: app } = await import('./app/server/index.js')

const server = createServer(app)
await new Promise((selesai) => server.listen(0, '127.0.0.1', selesai))
const port = server.address().port
const DASAR = `http://127.0.0.1:${port}`

let lulus = 0
let gagal = 0

function periksa(nama, syarat, keterangan = '') {
  if (syarat) {
    lulus++
    console.log(`  ok    ${nama}`)
  } else {
    gagal++
    console.log(`  GAGAL ${nama}${keterangan ? ` — ${keterangan}` : ''}`)
  }
}

/**
 * Ambil respons sebagai {status, header, badan(Buffer)}.
 *
 * Memakai `node:http` MENTAH, bukan `fetch`. Sebabnya penting: `fetch` bawaan
 * Node otomatis mendekode gzip, sehingga `Content-Encoding: gzip` bisa terlihat
 * benar padahal byte yang dikirim tidak benar — dan uji "isi identik" jadi
 * mustahil. Di sini byte yang diterima apa adanya.
 */
function ambil(jalur, { gzip = true, metode = 'GET' } = {}) {
  return new Promise((selesai, tolak) => {
    const url = new URL(jalur, DASAR)
    const req = httpRequest(
      {
        hostname: url.hostname,
        port: url.port,
        path: `${url.pathname}${url.search}`,
        method: metode,
        headers: gzip ? { 'accept-encoding': 'gzip' } : {},
      },
      (res) => {
        const potongan = []
        res.on('data', (c) => potongan.push(c))
        res.on('end', () =>
          selesai({
            status: res.statusCode,
            header: new Headers(res.headers),
            badan: Buffer.concat(potongan),
          }),
        )
      },
    )
    req.on('error', tolak)
    req.end()
  })
}

/**
 * Badan respons sebagai teks, dengan dekompresi bila perlu.
 *
 * Tanpa ini, pencarian penanda di dalam HTML akan gagal walaupun servernya
 * benar — badan yang masih gzip tidak bisa dibaca sebagai teks.
 */
function teks(res) {
  const enc = String(res.header.get('content-encoding') ?? '')
  if (enc.includes('gzip')) return gunzipSync(res.badan).toString('utf8')
  return res.badan.toString('utf8')
}

console.log('\n=== 1. Halaman yang disajikan adalah halaman yang BENAR ===')

// Cacat #1: /app/ pernah menyajikan halaman penjelasan.
const app_ = await ambil('/app/')
periksa('/app/ status 200', app_.status === 200)
periksa(
  '/app/ memuat bundel React (index-*.js)',
  /\/app\/assets\/index-[A-Za-z0-9_-]+\.js/.test(teks(app_)),
  'kalau gagal, /app/ menyajikan halaman yang salah',
)
periksa(
  '/app/ BUKAN halaman penjelasan',
  !/css\/style\.css/.test(teks(app_)),
  'penanda khas halaman penjelasan muncul di /app/',
)

const root = await ambil('/')
periksa('/', root.status === 200)
periksa(
  '/ adalah halaman penjelasan',
  /css\/style\.css/.test(teks(root)),
  'penanda khas halaman penjelasan tidak ditemukan di /',
)

console.log('\n=== 2. Kompresi ===')

const bundel = teks(app_).match(/\/app\/assets\/(index-[A-Za-z0-9_-]+\.js)/)?.[1]
periksa('nama bundel ditemukan di /app/', Boolean(bundel), 'tidak bisa lanjut tanpa nama bundel')

if (bundel) {
  const js = await ambil(`/app/assets/${bundel}`)
  periksa('bundel: Content-Encoding gzip', js.header.get('content-encoding') === 'gzip')
  periksa('bundel: Vary menyebut Accept-Encoding', /accept-encoding/i.test(js.header.get('vary') ?? ''))

  const asli = readFileSync(join(DIST, 'app', 'assets', bundel))
  // Dekompresi dibungkus: kalau server lupa mengompresi, `gunzipSync` melempar
  // galat dan uji akan BERHENTI di situ — menyembunyikan sisa pemeriksaan dan
  // menyamarkan cacat sebagai kerusakan uji. Yang benar: laporkan gagal, lanjut.
  let isiSetelahDekompresi = null
  try {
    isiSetelahDekompresi = gunzipSync(js.badan)
  } catch {
    isiSetelahDekompresi = null
  }
  periksa(
    'bundel: isi setelah dekompresi IDENTIK dengan berkas asli',
    isiSetelahDekompresi !== null && isiSetelahDekompresi.equals(asli),
    `ukuran terkirim ${js.badan.length}, berkas asli ${asli.length}`,
  )
  periksa(
    'bundel: terkirim lebih kecil daripada aslinya',
    js.badan.length < asli.length,
    `${js.badan.length} tidak lebih kecil dari ${asli.length}`,
  )

  // tanpa Accept-Encoding: harus utuh, tanpa header gzip
  const tanpa = await ambil(`/app/assets/${bundel}`, { gzip: false })
  periksa('tanpa gzip: tidak ada Content-Encoding', !tanpa.header.get('content-encoding'))
  periksa('tanpa gzip: isi sama dengan berkas asli', tanpa.badan.equals(asli))
}

console.log('\n=== 3. Aturan cache sesuai sifat nama berkas ===')

if (bundel) {
  const js = await ambil(`/app/assets/${bundel}`)
  periksa(
    'berkas ber-hash: 1 tahun + immutable',
    /max-age=31536000/.test(js.header.get('cache-control') ?? '') &&
      /immutable/.test(js.header.get('cache-control') ?? ''),
    `didapat: ${js.header.get('cache-control')}`,
  )
}

periksa(
  '/app/ (kerangka aplikasi): no-cache',
  (await ambil('/app/')).header.get('cache-control') === 'no-cache',
  'kerangka SPA menyebut nama ber-hash, jadi wajib selalu segar',
)

// Cacat #2: halaman penjelasan di root pernah ikut no-cache.
const cacheRoot = (await ambil('/')).header.get('cache-control') ?? ''
periksa(
  '/ (halaman penjelasan): TIDAK no-cache',
  cacheRoot !== 'no-cache',
  'halaman penjelasan tidak menyebut nama ber-hash, tidak perlu no-cache',
)

const ocr = await ambil('/app/ocr/worker.min.js')
periksa(
  'berkas OCR: cache sehari',
  /max-age=86400/.test(ocr.header.get('cache-control') ?? ''),
  `didapat: ${ocr.header.get('cache-control')}`,
)

console.log('\n=== 4. Penolakan keluar folder ===')

for (const jalur of [
  '/app/../../app/.env',
  '/app/%2e%2e/%2e%2e/app/.env',
  '/../../etc/passwd',
  '/app/..%2f..%2fapp%2f.env',
]) {
  const r = await ambil(jalur)
  periksa(`${jalur} tidak membocorkan berkas`, r.status === 404 || r.status === 400, `status ${r.status}`)
  periksa(
    `${jalur} tidak memuat KENARI_API_KEY`,
    !/KENARI_API_KEY|kn-[A-Za-z0-9]{10,}/.test(r.badan.toString('utf8')),
  )
}

console.log('\n=== 5. Berkas yang tidak ada tetap 404 ===')

periksa('/app/tidak-ada.js -> 404', (await ambil('/app/tidak-ada.js')).status === 404)
periksa('/tidak-ada.css -> 404', (await ambil('/tidak-ada.css')).status === 404)
periksa('/api/hilang -> 404 JSON', (await ambil('/api/hilang')).status === 404)

console.log('\n=== 6. HEAD tidak mengirim badan ===')

const head = await fetch(`${DASAR}/app/`, { method: 'HEAD', headers: { 'accept-encoding': 'gzip' } })
periksa('HEAD /app/ -> 200', head.status === 200)
periksa('HEAD /app/ mengirim Content-Length', Boolean(head.headers.get('content-length')))
periksa(
  'HEAD /app/ mengirim Content-Type HTML',
  /text\/html/.test(head.headers.get('content-type') ?? ''),
  `didapat: ${head.headers.get('content-type')}`,
)

server.close()

console.log(`\n=== RINGKASAN: ${lulus} lulus, ${gagal} gagal ===`)
process.exit(gagal === 0 ? 0 : 1)
