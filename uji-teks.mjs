#!/usr/bin/env node
/**
 * Uji pemotongan teks bersama (server/teks.js).
 * Dijalankan: node uji-teks.mjs
 *
 * Berkas ini menjaga perilaku yang dulu tersebar di dua tempat: memotong teks
 * di batas yang wajar, dan mengambil butir ringkas yang tidak menggantung.
 */
import { potongKalimat, butirDari } from './app/server/teks.js'

let gagal = 0
function cek(nama, dapat, harus) {
  const ok = JSON.stringify(dapat) === JSON.stringify(harus)
  if (!ok) gagal++
  console.log(`${ok ? 'OK  ' : 'GAGAL'} ${nama}`)
  if (!ok) console.log(`      dapat: ${JSON.stringify(dapat)}\n      harus: ${JSON.stringify(harus)}`)
}

console.log('--- potongKalimat ---')
cek('teks pendek tidak dipotong', potongKalimat('Halo.', 50), 'Halo.')
cek('teks kosong', potongKalimat('', 10), '')
cek('null aman', potongKalimat(null, 10), '')

// ada akhir kalimat di paruh kedua -> potong di situ, TANPA "…"
const kal1 = 'Kalimat pertama yang cukup panjang sekali. Kalimat kedua juga panjang dan berlanjut terus.'
const h1 = potongKalimat(kal1, 60)
cek('potong di akhir kalimat (tanpa …)', h1.endsWith('.'), true)
cek('hasil tidak melewati batas', h1.length <= 60, true)

// tidak ada akhir kalimat -> mundur ke batas KATA, dengan "…"
const kata =
  'Jika aktivitas tersebut baik, tentunya perlu didukung dengan kebiasaan lain yang kurang disukai banyak orang'
const h2 = potongKalimat(kata, 50)
cek('berakhir dengan …', h2.endsWith('…'), true)
cek('tidak memotong tengah kata', /\s…$/.test(h2) || h2.length <= 50, true)
cek(
  'kata terakhir utuh (bukan potongan)',
  kata.startsWith(h2.slice(0, -1).trimEnd()),
  true,
)

console.log('\n--- butirDari ---')
const normal = butirDari(
  'Tidur berkualitas membantu tubuh memperbaiki sel dan menjaga imun tetap optimal. Usahakan jam tidur yang sama setiap hari. Pastikan kamar cukup gelap dan sejuk. Kurangi layar menjelang tidur.',
  3,
)
cek('ambil 3 butir', normal.length, 3)
cek('semua berakhir tanda baca', normal.every((s) => /[.!?]$/.test(s)), true)

cek(
  'kalimat tanpa tanda baca akhir disaring',
  butirDari('Tidur berkualitas membantu tubuh memperbaiki sel dan menjaga imun. Kurangi layar sebelum tidur dan pastikan kamar gelap serta sejuk', 3),
  ['Tidur berkualitas membantu tubuh memperbaiki sel dan menjaga imun.'],
)
cek('teks kepotong -> butir kosong', butirDari(potongKalimat(kata, 90), 3), [])
cek('teks kosong', butirDari('', 3), [])
cek('null aman', butirDari(null, 3), [])

console.log('\n--- batas panjang butir (25..110 karakter) ---')
cek('kalimat terlalu pendek disaring', butirDari('Ya. Tidak. Mungkin.', 3), [])
const panjang = 'A'.repeat(120) + '.'
cek('kalimat terlalu panjang disaring', butirDari(panjang, 3), [])

console.log(gagal === 0 ? '\nSEMUA LULUS' : `\n${gagal} UJI GAGAL`)
process.exit(gagal === 0 ? 0 : 1)
