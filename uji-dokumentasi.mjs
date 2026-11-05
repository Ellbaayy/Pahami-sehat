#!/usr/bin/env node
/**
 * Uji dokumentasi — angka di README harus sama dengan isi repo.
 * Dijalankan: node uji-dokumentasi.mjs   (tanpa jaringan, tanpa DB, tanpa kunci)
 *
 * KENAPA ADA (5 Nov 2026)
 * README proyek ini sangat rinci, dan justru karena rinci ia GAMPANG
 * ketinggalan: saat diperiksa, ia masih menulis "30 berkas uji", "24 tangkapan
 * layar", dan "backend Express (24 berkas)", padahal isinya 31 uji, 27
 * tangkapan layar, dan 29 berkas server. Tidak ada yang rusak — tetapi angka
 * yang salah di dokumen utama adalah klaim yang bisa langsung dibantah siapa
 * pun yang membuka foldernya, dan itu merusak kredibilitas semua bagian lain
 * yang SUDAH benar.
 *
 * Uji ini menutup celahnya dengan menghitung langsung dari isi folder. Jadi
 * menambah satu uji atau satu tangkapan layar tanpa memperbarui README akan
 * membuat `npm test` merah — bukan diam-diam menyimpang.
 *
 * YANG DIPERIKSA
 *   1. Jumlah berkas `uji-*.mjs` di akar repo, dan berapa yang ikut `npm test`
 *      (yaitu: TIDAK tercantum di BUTUH_LUAR `uji-semua.mjs`).
 *   2. Jumlah berkas di `docs/tangkapan-layar/`.
 *   3. Jumlah berkas `.js` di `app/server/`.
 *   4. Setiap berkas uji yang dijalankan `npm test` disebut di daftar
 *      "Menjalankan uji" README (supaya daftar tidak diam-diam basi).
 *
 * Angka "yang diharapkan" diambil dari README itu sendiri lewat pola yang
 * dipakai di sana, bukan ditulis dua kali di sini.
 */

import { readdirSync, readFileSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const AKAR = dirname(fileURLToPath(import.meta.url))
const readme = readFileSync(join(AKAR, 'README.md'), 'utf8')

let gagal = 0
function cek(nama, dapat, harus) {
  const ok = JSON.stringify(dapat) === JSON.stringify(harus)
  if (!ok) gagal++
  console.log(`${ok ? '  ok   ' : '  GAGAL'} ${nama}`)
  if (!ok) console.log(`        README: ${JSON.stringify(harus)}\n        nyata : ${JSON.stringify(dapat)}`)
}

/* ------------------------------------------------------------ hitungan --- */

const berkasUji = readdirSync(AKAR).filter((f) => /^uji-.*\.mjs$/.test(f)).sort()
const tangkapan = readdirSync(join(AKAR, 'docs', 'tangkapan-layar')).filter((f) => f.endsWith('.png'))
const berkasServer = readdirSync(join(AKAR, 'app', 'server')).filter((f) => f.endsWith('.js')).sort()

/* Berkas uji yang TIDAK dijalankan `npm test`: dibaca dari BUTUH_LUAR di
 * runner, bukan dari daftar tangan di sini — dan aturan yang sama persis
 * dengan runner: `uji-semua.mjs` sendiri tidak dihitung sebagai uji.
 * Kalau cara runner berubah, uji ini ikut berubah tanpa disunting. */
const runner = readFileSync(join(AKAR, 'uji-semua.mjs'), 'utf8')
const blokButuhLuar = /const\s+BUTUH_LUAR\s*=\s*new Set\(\[([\s\S]*?)\]\)/.exec(runner)?.[1] ?? ''
const butuhLuar = new Set([...blokButuhLuar.matchAll(/['"]([\w.-]+\.mjs)['"]/g)].map((m) => m[1]))
if (!butuhLuar.size) {
  console.error('  GAGAL membaca BUTUH_LUAR dari uji-semua.mjs — pola runner berubah, perbarui uji ini.')
  process.exit(1)
}
const tanpaJaringan = berkasUji.filter((f) => !butuhLuar.has(f) && f !== 'uji-semua.mjs')

/* -------------------------------------------------- angka yang diklaim --- */

/** Ambil satu angka dari README menurut pola yang dikenal. */
function angka(pola, label) {
  const m = pola.exec(readme)
  if (!m) {
    gagal++
    console.log(`  GAGAL ${label}: pola tidak ditemukan di README`)
    return null
  }
  return Number(m[1])
}

console.log('== jumlah berkas uji ==')
const klaimUji = angka(/\*\*(\d+) berkas uji\*\*/, 'jumlah uji di Peta folder')
const klaimTanpaJaringan = angka(/\*\*(\d+) berkas uji\*\* — (\d+) di antaranya berjalan lewat `npm test`/, 'uji tanpa jaringan')
// pola di atas hanya menangkap grup pertama; ambil grup kedua secara terpisah
const mTanpaJaringan = /\*\*\d+ berkas uji\*\* — (\d+) di antaranya berjalan lewat `npm test`/.exec(readme)
const klaimLepas = Number(mTanpaJaringan?.[1] ?? -1)

if (klaimUji !== null) cek('jumlah berkas uji', berkasUji.length, klaimUji)
cek('jumlah uji tanpa jaringan', tanpaJaringan.length, klaimLepas)
cek(
  'bagian "Menjalankan uji" menyebut jumlah yang sama',
  /\*\*(\d+) berkas lulus/.exec(readme)?.[1] ? Number(/\*\*(\d+) berkas lulus/.exec(readme)[1]) : null,
  tanpaJaringan.length,
)

console.log('\n== tangkapan layar & berkas server ==')
const klaimTangkapan = angka(/\*\*(\d+) tangkapan layar\*\*/, 'jumlah tangkapan layar')
if (klaimTangkapan !== null) cek('jumlah tangkapan layar', tangkapan.length, klaimTangkapan)
const klaimServer = angka(/backend Express \((\d+) berkas\)/, 'jumlah berkas server')
if (klaimServer !== null) cek('jumlah berkas server', berkasServer.length, klaimServer)

console.log('\n== daftar uji di README tidak basi ==')
const blokDaftar = /## Menjalankan uji([\s\S]*?)\n## /.exec(readme)?.[1] ?? readme
for (const f of tanpaJaringan) {
  cek(`README menyebut ${f}`, blokDaftar.includes(f), true)
}

console.log(
  gagal
    ? `\nGAGAL — ${gagal} pemeriksaan. Perbarui README, lalu jalankan lagi.`
    : `\nSEMUA LULUS — ${berkasUji.length} uji, ${tangkapan.length} tangkapan layar, ${berkasServer.length} berkas server`,
)
process.exit(gagal ? 1 : 0)
