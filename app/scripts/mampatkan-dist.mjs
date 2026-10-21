/**
 * Mampatkan hasil build sekali di build, bukan pada setiap permintaan.
 *
 * ============================================================================
 * KENAPA LANGKAH BUILD, BUKAN MIDDLEWARE GZIP
 * ============================================================================
 *
 * Lapisan `saji.js` hanya membungkus `res.json`/`res.send`. Berkas statis
 * (HTML, JS, CSS) tidak lewat situ — `express.static` menulis langsung ke
 * soket. Diukur 21 Okt 2026 di server lokal:
 *
 *   /app/assets/index-*.js   402.486 byte, TIDAK ada Content-Encoding
 *   /app/assets/index-*.css   58.741 byte, TIDAK ada Content-Encoding
 *
 * Padahal isinya teks dan menyusut ~70%. Bagi pengguna di jaringan seluler
 * lambat, itu bedanya antara menunggu dan langsung tampil — dan itu bagian
 * dari indikator Green IT yang dinilai lomba.
 *
 * Mengompresi per permintaan (di dalam middleware) berarti CPU bekerja ulang
 * setiap kali berkas yang isinya TIDAK berubah diminta. Berkas hasil build
 * hanya berubah saat build berikutnya, jadi hasilnya disimpan di samping
 * berkas aslinya (`*.gz`) dan tinggal dikirim apa adanya. Nol CPU saat
 * melayani, dan hasilnya bisa diperiksa dengan mata.
 *
 * Berkas `.gz` TIDAK masuk git karena seluruh `dist/` diabaikan — ia selalu
 * dibuat ulang oleh `npm run build`.
 *
 * Pemakaian: dijalankan otomatis sesudah `vite build` (lihat package.json).
 */

import { readdir, readFile, writeFile } from 'node:fs/promises'
import { join, extname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { gzipSync } from 'node:zlib'

/** Hanya tipe yang benar-benar menyusut dengan gzip. */
const EKSTENSI = new Set([
  '.js',
  '.mjs',
  '.css',
  '.html',
  '.json',
  '.svg',
  '.txt',
  '.xml',
  '.map',
])

/**
 * Di bawah ukuran ini, header + tabel gzip bisa lebih besar daripada
 * hematannya. Sama dengan ambang di `server/saji.js` supaya alasannya seragam.
 */
const MIN_BYTE = 500

const AKAR = process.argv[2] ?? fileURLToPath(new URL('../dist', import.meta.url))

/** Seluruh berkas di dalam sebuah folder, rekursif. */
async function jelajah(folder, hasil = []) {
  const isi = await readdir(folder, { withFileTypes: true })
  for (const e of isi) {
    const jalur = join(folder, e.name)
    if (e.isDirectory()) await jelajah(jalur, hasil)
    else hasil.push(jalur)
  }
  return hasil
}

const semua = await jelajah(AKAR)

let dibuat = 0
let dilewati = 0
let asliTotal = 0
let gzTotal = 0

for (const jalur of semua) {
  if (!EKSTENSI.has(extname(jalur))) continue
  // jangan pernah mengompresi berkas .gz itu sendiri
  if (jalur.endsWith('.gz')) continue

  const isi = await readFile(jalur)
  if (isi.length < MIN_BYTE) {
    dilewati++
    continue
  }

  const gep = gzipSync(isi, { level: 9 })
  // Kadang hasil kompresi tidak lebih kecil. Kalau begitu, jangan disimpan —
  // server juga akan menolak memakainya (lihat `saji.js`), jadi tidak ada
  // gunanya menaruh berkas yang tidak pernah dikirim.
  if (gep.length >= isi.length) {
    dilewati++
    continue
  }

  await writeFile(`${jalur}.gz`, gep)
  dibuat++
  asliTotal += isi.length
  gzTotal += gep.length
}

const hemat = asliTotal > 0 ? Math.round((1 - gzTotal / asliTotal) * 100) : 0

console.log(
  `  mampatkan  ${dibuat} berkas -> .gz (${asliTotal} -> ${gzTotal} byte, -${hemat}%), ` +
    `${dilewati} dilewati`,
)

// Jejak yang bisa diperiksa: kalau langkah ini tidak berjalan, jumlahnya nol
// dan server akan menyajikan berkas tanpa kompresi — terlihat dari header.
await writeFile(
  join(AKAR, '.mampatkan.json'),
  JSON.stringify({ dibuat, dilewati, hemat }, null, 2),
)
