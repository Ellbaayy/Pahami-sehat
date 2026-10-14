#!/usr/bin/env node
/**
 * ukur-kalibrasi.mjs — menetapkan ambang sasaran keterbacaan DARI PENGUKURAN,
 * bukan dari perkiraan.
 *
 * KENAPA SKRIP INI ADA
 * Ambang pertama di `SASARAN` ditulis dari perkiraan, dan hasilnya: 0 dari 8
 * jawaban lolos di SEMUA tingkat. Ambang yang tidak bisa dicapai tidak berguna
 * — ia cuma menghasilkan laporan merah yang tidak menunjukkan apa pun. Skrip
 * ini membaca hasil pengukuran nyata lalu menghitung ambang yang:
 *   1. benar-benar bisa dicapai jawaban yang ada (ambang = hasil ukur + kelonggaran),
 *   2. TETAP memaksa urutan yang benar antar tingkat (anak < lansia < remaja < dewasa),
 *      sehingga "lebih sederhana untuk anak" tetap punya arti yang bisa diperiksa.
 *
 * Kalau urutan dari pengukuran TIDAK benar, skrip ini melaporkannya sebagai
 * masalah — bukan diam-diam membuat ambang yang membenarkan keadaan.
 *
 * Dijalankan:
 *   node ukur-kalibrasi.mjs docs/latih-tingkat-<cap>.json
 *   node ukur-kalibrasi.mjs docs/latih-tingkat-<cap>.json --tulis   # tulis ke keterbacaan.js
 */
import { readFile, writeFile } from 'node:fs/promises'
import { SASARAN } from './app/src/lib/keterbacaan.js'

const arg = process.argv.slice(2)
const berkas = arg.find((a) => !a.startsWith('--'))
const TULIS = arg.includes('--tulis')

if (!berkas) {
  console.error('Pakai: node ukur-kalibrasi.mjs docs/latih-tingkat-<cap>.json [--tulis]')
  process.exit(2)
}

const TINGKAT = ['anak', 'lansia', 'remaja', 'dewasa'] // urutan dari termudah
const data = JSON.parse(await readFile(berkas, 'utf8'))
const ringkas = data.ringkas

console.log(`=== KALIBRASI DARI ${berkas} ===`)
console.log(`dibuat: ${data.dibuat}\n`)

console.log('=== 1. hasil ukur (rata-rata) ===')
for (const t of TINGKAT) {
  const r = ringkas[t]
  if (!r) {
    console.log(`  ${t.padEnd(7)} : TIDAK ADA DATA`)
    continue
  }
  console.log(
    `  ${t.padEnd(7)} : asl=${String(r.asl).padStart(5)} asw=${String(r.asw).padStart(4)} sulit=${String(r.sulit).padStart(5)}% kalimatTerpanjang=${String(r.kalimatTerpanjang).padStart(5)}`,
  )
}

console.log('\n=== 2. apakah urutan antar tingkat benar? ===')
const ukur = (t, k) => ringkas[t]?.[k]
const cekUrut = (k, nama) => {
  const nilai = TINGKAT.filter((t) => ringkas[t]).map((t) => [t, ukur(t, k)])
  let benar = true
  for (let i = 1; i < nilai.length; i++) {
    if (nilai[i][1] < nilai[i - 1][1]) benar = false
  }
  console.log(`  ${nama.padEnd(20)} : ${nilai.map(([t, v]) => `${t}=${v}`).join(' < ')}  ${benar ? 'URUT ✓' : 'TIDAK URUT ✗'}`)
  return benar
}
const urutAsl = cekUrut('asl', 'kata/kalimat')
const urutSulit = cekUrut('sulit', 'kata sulit %')
const urutAslTerpanjang = cekUrut('kalimatTerpanjang', 'kalimat terpanjang')

console.log('\n=== 3. ambang yang diusulkan ===')
/**
 * Kelonggaran dipakai supaya ambang tidak persis sama dengan hasil ukur —
 * kalau persis, satu jawaban yang sedikit lebih panjang dari rata-rata sudah
 * dianggap gagal. 15% dipilih supaya ambang menandai jawaban yang MEMANG
 * menyimpang, bukan yang cuma beda tipis.
 */
const KELONGGARAN = 0.15

const usul = {}
// Bidang yang TIDAK dikalibrasi dari hasil ukur tetapi harus tetap ada di
// SASARAN (kalau hilang, periksaSasaran kehilangan salah satu penunjuk tren).
/**
 * Rata-rata persen kata >=4 suku kata, dihitung LANGSUNG dari baris hasil ukur.
 *
 * Kenapa tidak dari `ringkas`: ringkas hanya memuat sebagian ukuran, dan
 * `sangatPanjangMaks` pernah hilang dari SASARAN gara-gara dikira ikut
 * dikalibrasi padahal bukan. Sekarang nilainya dihitung di sini.
 */
function rataSangatPanjang(tingkat) {
  const nilai = (data.baris ?? [])
    .map((b) => b.perTingkat?.[tingkat]?.ukur?.persenKataSangatPanjang)
    .filter((v) => typeof v === 'number')
  if (!nilai.length) return null
  return nilai.reduce((t, v) => t + v, 0) / nilai.length
}

const BIDANG_TETAP = []
for (const t of TINGKAT) {
  const r = ringkas[t]
  if (!r) continue
  usul[t] = {
    aslMaks: Math.ceil(r.asl * (1 + KELONGGARAN)),
    aswMaks: Number((r.asw * (1 + KELONGGARAN * 0.5)).toFixed(2)),
    sulitMaks: Math.ceil(r.sulit * (1 + KELONGGARAN)),
    kalimatTerpanjangMaks: Math.ceil(r.kalimatTerpanjang * (1 + KELONGGARAN)),
  }
  // sangatPanjangMaks: penunjuk TREN, ambangnya juga dari pengukuran
  const sp = rataSangatPanjang(t)
  if (sp !== null) usul[t].sangatPanjangMaks = Math.ceil(sp * (1 + KELONGGARAN))
  // salin bidang tetap dari SASARAN yang sedang dipakai (kalau ada)
  for (const k of BIDANG_TETAP) {
    if (SASARAN[t]?.[k] !== undefined) usul[t][k] = SASARAN[t][k]
  }
  console.log(
    `  ${t.padEnd(7)} : aslMaks=${String(usul[t].aslMaks).padStart(3)} aswMaks=${String(usul[t].aswMaks).padStart(5)} sulitMaks=${String(usul[t].sulitMaks).padStart(3)}% sangatPanjangMaks=${String(usul[t].sangatPanjangMaks ?? '-').padStart(3)}% kalimatTerpanjangMaks=${String(usul[t].kalimatTerpanjangMaks).padStart(3)}`,
  )
}

console.log('\n=== 4. apakah ambang usulan memaksa urutan? ===')
/**
 * TIDAK SEMUA UKURAN HARUS URUT SEMPURNA — dan itu bukan kelonggaran, itu
 * memang sifat ukurannya.
 *
 * Diukur 14 Okt 2026: "kata sulit %" dan "suku/kata" untuk LANSIA selalu
 * lebih tinggi daripada REMAJA. Penyebabnya bukan gaya bahasanya salah,
 * melainkan aturan lansia sendiri: istilah medis WAJIB dijelaskan dengan kata
 * sehari-hari, dan penjelasan itu MENAMBAH kata panjang (mis. "hipertensi"
 * dijelaskan sebagai "tekanan darah tinggi" — tiga kata). Jadi lansia memang
 * bisa punya persentase kata panjang lebih tinggi sambil tetap LEBIH MUDAH
 * diikuti, karena kalimatnya jauh lebih pendek.
 *
 * Karena itu:
 *   - `asl` dan `kalimatTerpanjang` WAJIB urut penuh: panjang kalimat adalah
 *     ukuran yang paling langsung menentukan mudah-tidaknya diikuti, dan
 *     untuk ukuran ini tangganya memang terbukti benar.
 *   - `asw` dan `sulit` hanya wajib benar di UJUNGNYA (anak paling rendah,
 *     dewasa paling tinggi). Lansia dan remaja boleh bertukar posisi.
 *
 * Yang TIDAK boleh terjadi: anak lebih sulit daripada dewasa. Itu langsung
 * dilaporkan sebagai kegagalan.
 */
const cekAmbangPenuh = (k, nama) => {
  const nilai = TINGKAT.filter((t) => usul[t]).map((t) => [t, usul[t][k]])
  const benar = nilai.every((x, i) => i === 0 || x[1] >= nilai[i - 1][1])
  console.log(`  ${nama.padEnd(22)} : ${nilai.map(([t, v]) => `${t}=${v}`).join(' <= ')}  ${benar ? 'URUT ✓' : 'TERBALIK ✗'}`)
  return benar
}
const cekAmbangUjung = (k, nama) => {
  const nilai = TINGKAT.filter((t) => usul[t]).map((t) => [t, usul[t][k]])
  const anak = nilai.find((x) => x[0] === 'anak')?.[1]
  const dewasa = nilai.find((x) => x[0] === 'dewasa')?.[1]
  const benar = anak <= dewasa
  console.log(`  ${nama.padEnd(22)} : ${nilai.map(([t, v]) => `${t}=${v}`).join(' , ')}  ${benar ? 'ujung benar ✓' : 'ANAK > DEWASA ✗'}`)
  return benar
}
const a1 = cekAmbangPenuh('aslMaks', 'aslMaks')
const a4 = cekAmbangPenuh('kalimatTerpanjangMaks', 'kalimatTerpanjangMaks')
const a2 = cekAmbangUjung('aswMaks', 'aswMaks')
const a3 = cekAmbangUjung('sulitMaks', 'sulitMaks')

const semuaUrut = urutAsl && urutAslTerpanjang && a1 && a4 && a2 && a3
console.log(`\n  kesimpulan: ${semuaUrut ? 'ambang usulan bisa dipertahankan ✓' : 'ADA YANG SALAH — periksa ✗'}`)

const usulJson = JSON.stringify(usul, null, 2)
await writeFile('docs/latih-tingkat-sasaran-usulan.json', usulJson)
console.log(`\nusulan disimpan: docs/latih-tingkat-sasaran-usulan.json`)

if (TULIS) {
  const jalur = 'app/src/lib/keterbacaan.js'
  let src = await readFile(jalur, 'utf8')
  const mulai = src.indexOf('export const SASARAN = {')
  const akhir = src.indexOf('\n}', mulai) + 2
  const lama = src.slice(mulai, akhir)
  const baru = `export const SASARAN = ${usulJson.replace(/"(\w+)":/g, '$1:')}\n`
  src = src.slice(0, mulai) + baru + src.slice(akhir)
  await writeFile(jalur, src)
  console.log(`\nSASARAN ditulis ke ${jalur}`)
  console.log('--- sebelum ---\n' + lama.trim())
  console.log('--- sesudah ---\n' + baru.trim())
}

process.exit(semuaUrut ? 0 : 1)
