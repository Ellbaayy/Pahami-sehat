#!/usr/bin/env node
/**
 * uji-server.mjs — lapisan penyajian: kompresi, 404 JSON, galat klien, waktu.
 *
 * KENAPA SKRIP INI ADA
 * Empat hal yang diuji di sini punya sifat yang sama: SALAHNYA TIDAK KETAHUAN
 * dari build hijau maupun dari uji fitur. Aplikasi tetap berfungsi penuh
 * walau:
 *
 *   - respons tidak dikompresi (hanya lambat di jaringan lambat),
 *   - JSON rusak dijawab 500 (halaman tetap jalan; yang keliru hanya
 *     laporan statusnya — dan itu merusak pemantauan),
 *   - /api/* yang tidak ada menjawab HTML Express (klien yang mengharap JSON
 *     gagal dengan pesan yang salah),
 *   - header waktu tidak pernah muncul (tidak ada yang rusak, cuma tidak ada
 *     cara menjawab "lambat di server atau di jaringan?").
 *
 * Semuanya pernah benar-benar salah di proyek ini, jadi diuji.
 *
 * TANPA JARINGAN: server Express asli dinyalakan di port acak. Tidak ada
 * permintaan yang keluar ke internet.
 *
 * Cara pakai:
 *   node uji-server.mjs
 */

import { createServer } from 'node:http'
import http from 'node:http'
import { gunzipSync } from 'node:zlib'

// `app/server/index.js` menarik config.js, yang MENOLAK JALAN tanpa
// KENARI_API_KEY. Diisi lebih dulu (hanya kalau masih kosong) supaya uji ini
// bisa berjalan di CI yang tidak menyimpan rahasia. Uji ini tidak pernah
// memanggil model.
process.env.KENARI_API_KEY ??= 'kunci-tiruan-uji-tanpa-jaringan'

const { default: app } = await import('./app/server/index.js')

let lulus = 0
let gagal = 0

function cek(nama, dapat, harap) {
  const ok = JSON.stringify(dapat) === JSON.stringify(harap)
  if (ok) {
    lulus++
    console.log(`  ok    ${nama}`)
  } else {
    gagal++
    console.log(`  GAGAL ${nama}`)
    console.log(`        harap: ${JSON.stringify(harap)}`)
    console.log(`        dapat: ${JSON.stringify(dapat)}`)
  }
}

const PORT = 9200 + Math.floor(Math.random() * 90)
const BASE = `http://127.0.0.1:${PORT}`
const server = createServer(app)
await new Promise((r) => server.listen(PORT, '127.0.0.1', r))

/** Panggil server; kembalikan status, header, dan teks mentah. */
async function ambil(jalur, opsi = {}) {
  const res = await fetch(BASE + jalur, opsi)
  const buf = Buffer.from(await res.arrayBuffer())
  return { status: res.status, headers: res.headers, buf, teks: buf.toString('utf8') }
}

/**
 * Panggil server lewat HTTP MENTAH, tanpa fetch.
 *
 * KENAPA PERLU, dan ini pernah menyesatkan: `fetch` bawaan Node SELALU
 * mengirim `Accept-Encoding: gzip` sendiri dan LANGSUNG men-dekompresi
 * balasannya. Akibatnya, lewat fetch:
 *   - permintaan "tanpa gzip" pun tetap dikompresi server (tidak bisa diuji), dan
 *   - `Content-Encoding` tetap terbaca 'gzip' padahal badan yang diterima sudah
 *     didekompresi (ukurannya jadi sama dengan aslinya).
 * Dua pemeriksaan kompresi sempat GAGAL karena hal ini — padahal kodenya benar
 * (terukur 7281 -> 2083 byte, hemat 71%). Karena itu pengukuran kompresi
 * memakai HTTP mentah: di situ tidak ada yang menambah atau membatalkan apa pun.
 */
function ambilMentah(jalur, headers = {}) {
  return new Promise((resolve, reject) => {
    const req = http.request({ host: '127.0.0.1', port: PORT, path: jalur, headers }, (r) => {
      const bagian = []
      r.on('data', (d) => bagian.push(d))
      r.on('end', () =>
        resolve({
          status: r.statusCode,
          headers: r.headers,
          buf: Buffer.concat(bagian),
        }),
      )
    })
    req.on('error', reject)
    req.end()
  })
}

/* ============================================ 1. GALAT DARI SISI KLIEN === */

console.log('\n=== GALAT KLIEN: jangan laporkan sebagai galat server ===')

// Body JSON yang rusak: Express menandainya 400. Kalau nomor itu diabaikan,
// jawabannya 500 — dan pengguna disuruh "coba lagi" padahal isinya yang salah.
const rusak = await ambil('/api/tanya', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: '{ini-bukan-json',
})
cek('JSON rusak -> 400 (bukan 500)', rusak.status, 400)
cek('balasannya JSON yang aman', /"ok":false/.test(rusak.teks), true)
cek('tidak membocorkan detail parser', /SyntaxError|Unexpected token|position \d/i.test(rusak.teks), false)

// Body bukan objek (string JSON yang sah): rutenya membaca req.body?.pertanyaan,
// jadi ini harus jadi galat klien juga, bukan 500.
const bukanObjek = await ambil('/api/tanya', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: '"cuma teks"',
})
cek('body bukan objek -> 400 (bukan 500)', bukanObjek.status, 400)

// Body terlalu besar: Express menandainya 413.
const besar = await ambil('/api/tanya', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ pertanyaan: 'x'.repeat(2 * 1024 * 1024) }),
})
cek('body terlalu besar -> 413 (bukan 500)', besar.status, 413)

/* ==================================================== 2. 404 UNTUK /api === */

console.log('\n=== 404 /api/*: JSON, bukan halaman HTML Express ===')

const hilang = await ambil('/api/tidak-ada-sama-sekali')
cek('status 404', hilang.status, 404)
cek('balasannya JSON', /"ok":false/.test(hilang.teks), true)
// Halaman HTML bawaan Express menyebut "Express" dan berbunyi "Cannot GET" —
// itu memberi tahu penyerang kerangka yang dipakai.
cek('TIDAK menyebut Express', /Express/i.test(hilang.teks), false)
cek('TIDAK berbunyi "Cannot GET"', /Cannot GET/i.test(hilang.teks), false)
cek('menyebut alamat yang diminta', /tidak-ada-sama-sekali/.test(hilang.teks), true)

/* ========================================================= 3. KOMPRESI === */

console.log('\n=== KOMPRESI: respons besar harus di-gzip ===')

// Lewat HTTP MENTAH — fetch Node menambah dan membatalkan kompresi sendiri.
const tanpa = await ambilMentah('/api/konten')
const dengan = await ambilMentah('/api/konten', { 'Accept-Encoding': 'gzip' })

cek('tanpa Accept-Encoding: tidak dikompresi', tanpa.headers['content-encoding'], undefined)
cek('dengan Accept-Encoding: di-gzip', dengan.headers['content-encoding'], 'gzip')
cek('ada Vary: Accept-Encoding (wajib untuk cache)', /accept-encoding/i.test(dengan.headers.vary ?? ''), true)

// Yang penting bukan "ada header gzip", tapi isinya BENAR-BENAR mengecil dan
// bisa dibaca kembali setelah dibongkar. Header saja tidak membuktikan apa pun.
const kembali = JSON.parse(gunzipSync(dengan.buf).toString('utf8'))
cek('isi setelah dibongkar sama dengan aslinya', kembali.ok, true)
cek('benar-benar lebih kecil', dengan.buf.length < tanpa.buf.length, true)
console.log(`        tanpa: ${tanpa.buf.length}B · gzip: ${dengan.buf.length}B (hemat ${Math.round((1 - dengan.buf.length / tanpa.buf.length) * 100)}%)`)

// Respons kecil tidak perlu dikompresi — header gzip bisa lebih besar dari hematannya.
const kecil = await ambilMentah('/api/meta', { 'Accept-Encoding': 'gzip' })
cek('respons kecil dibiarkan apa adanya', kecil.headers['content-encoding'], undefined)

/* ============================================ 4. SSE JANGAN DIKOMPRESI == */

console.log('\n=== SSE: TIDAK boleh dikompresi (kalau dikompresi, jawaban tertahan) ===')

/**
 * SSE diuji lewat rute yang memang mengalir. Isinya bergantung pada model, jadi
 * yang diperiksa HANYA headernya — bukan jawabannya. Permintaannya dibatalkan
 * setelah header diterima supaya tidak menunggu model menjawab.
 */
const kendali = new AbortController()
try {
  const res = await fetch(`${BASE}/api/tanya/stream`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Accept-Encoding': 'gzip' },
    body: JSON.stringify({ pertanyaan: 'halo', tingkat: 'umum', bahasa: 'id' }),
    signal: kendali.signal,
  })
  cek('SSE: tipe kontennya event-stream', /text\/event-stream/.test(res.headers.get('content-type') ?? ''), true)
  cek('SSE: TIDAK dikompresi', res.headers.get('content-encoding'), null)
} catch (e) {
  // Dibatalkan memang disengaja — tapi kalau gagal karena hal lain, laporkan.
  if (e?.name !== 'AbortError') {
    cek('SSE: permintaan bisa dibuka', e?.message ?? String(e), null)
  }
} finally {
  kendali.abort()
}

/* ======================================================= 5. WAKTU PROSES == */

console.log('\n=== X-Waktu-Ms: menjawab "lambat di server atau di jaringan?" ===')

const waktu = await ambil('/api/meta')
const nilaiWaktu = waktu.headers.get('x-waktu-ms')
cek('header X-Waktu-Ms ada', Boolean(nilaiWaktu), true)
cek('isinya angka yang masuk akal', /^\d+(\.\d+)?$/.test(nilaiWaktu ?? '') && Number(nilaiWaktu) >= 0, true)
console.log(`        /api/meta: ${nilaiWaktu}ms`)

// Semua respons API harus punya header ini, bukan hanya satu rute.
const waktu2 = await ambil('/api/health')
cek('rute lain juga punya', Boolean(waktu2.headers.get('x-waktu-ms')), true)

/* ==================================================== 6. KEPALA KEAMANAN = */

console.log('\n=== Kepala keamanan tetap terpasang setelah perubahan ===')

// `tanpa` di sini berasal dari ambilMentah(), jadi header-nya objek biasa
// (bukan Headers), dan namanya huruf kecil.
cek('X-Powered-By TIDAK bocor', tanpa.headers['x-powered-by'], undefined)
cek('X-Content-Type-Options: nosniff', tanpa.headers['x-content-type-options'], 'nosniff')
cek('Referrer-Policy ada', Boolean(tanpa.headers['referrer-policy']), true)

/* ============================================================== RINGKASAN = */

server.close()
// Tutup koneksi keep-alive supaya proses uji tidak menggantung
server.closeIdleConnections?.()

console.log('\n=== RINGKASAN ===')
console.log(`lulus    : ${lulus}`)
console.log(`gagal    : ${gagal}`)
process.exit(gagal ? 1 : 0)
