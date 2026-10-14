#!/usr/bin/env node
/**
 * Uji modul keterbacaan — memastikan alat ukurnya sendiri BENAR sebelum
 * dipakai untuk menilai jawaban AI.
 *
 * KENAPA PERLU: alat ukur yang salah akan menghasilkan kesimpulan yang salah
 * dengan sangat meyakinkan. Kalau penghitung suku kata keliru, laporan
 * "jawaban anak sudah sesuai" bisa muncul padahal tidak. Uji ini memakai
 * kata-kata yang jumlah suku katanya bisa dihitung manusia untuk memeriksanya.
 *
 * Dijalankan: node uji-keterbacaan.mjs
 */
import {
  sukuKata,
  ukurKeterbacaan,
  periksaSasaran,
  daftarKalimat,
  daftarKata,
  SASARAN,
  UKURAN_GERBANG,
} from './app/src/lib/keterbacaan.js'

/** Urutan dari yang paling mudah diikuti ke yang paling sulit. */
const TINGKAT_UJI = ['anak', 'lansia', 'remaja', 'dewasa']

let lulus = 0
let gagal = 0

function cek(nama, dapat, harap) {
  const ok = dapat === harap
  if (ok) lulus++
  else gagal++
  console.log(`${ok ? 'OK  ' : 'GAGAL'} ${nama}${ok ? '' : `  dapat=${JSON.stringify(dapat)} harap=${JSON.stringify(harap)}`}`)
}

console.log('=== 1. hitung suku kata (angka bisa diperiksa manusia) ===')
cek('baik', sukuKata('baik'), 1)
cek('sehat', sukuKata('sehat'), 2)
cek('hipertensi', sukuKata('hipertensi'), 4)
cek('dokter', sukuKata('dokter'), 2)
cek('pantai (diftong ai = 1 gugus)', sukuKata('pantai'), 2)
cek('pisau (diftong au = 1 gugus)', sukuKata('pisau'), 2)
cek('obat', sukuKata('obat'), 2)
cek('rumah', sukuKata('rumah'), 2)
cek('kesehatan', sukuKata('kesehatan'), 4)
cek('tidak ada huruf -> 0', sukuKata('123'), 0)
cek('tanda baca dibuang', sukuKata('sehat,'), 2)

console.log('=== 2. pecah kalimat & kata ===')
cek('2 kalimat', daftarKalimat('Ini satu. Itu dua.').length, 2)
cek('tanda tanya & seru ikut memisah', daftarKalimat('Apa itu? Bagus! Ya.').length, 3)
cek('kalimat kosong dibuang', daftarKalimat('... ...').length, 0)
cek('kata: tanda baca dibuang', daftarKata('demam, batuk.').join(','), 'demam,batuk')
cek('kata: angka sendirian dibuang', daftarKata('suhu 38 derajat').join(','), 'suhu,derajat')
// DAFTAR BERBUTIR: tanpa pemecahan di butir, seluruh daftar terbaca sebagai
// satu "kalimat" raksasa. Diukur 14 Okt 2026: satu jawaban dewasa dilaporkan
// 56 kata per kalimat, padahal itu daftar langkah. Positif palsu.
const berbutir = '- Cuci tangan dengan sabun\n- Bilas dengan air bersih\n- Keringkan dengan handuk'
cek('daftar berbutir -> 3 kalimat, bukan 1', daftarKalimat(berbutir).length, 3)
const bernomor = '1. Cuci tangan\n2. Bilas air\n3. Keringkan'
cek('daftar bernomor -> 3 kalimat', daftarKalimat(bernomor).length, 3)
cek('kalimat terpanjang daftar berbutir wajar', ukurKeterbacaan(berbutir).kalimatTerpanjang <= 6, true)

// KEPALA DAFTAR: diukur 14 Okt 2026, satu jawaban dewasa dilaporkan punya
// "kalimat" 45 kata — setelah jawabannya dibaca utuh, kalimat terpanjang yang
// sebenarnya hanya 23 kata. Yang 45 itu kepala daftar berisi butir-butir
// pendek. Kepala daftar TIDAK dihitung; kalimat biasa yang memuat titik dua
// TETAP dihitung.
const kepalaDaftar =
  'Cuci tangan pada waktu penting: sebelum menyiapkan makanan. Sebelum makan. Setelah dari toilet. Setelah batuk.'
cek('kepala daftar tidak dihitung sebagai kalimat terpanjang', ukurKeterbacaan(kepalaDaftar).kalimatTerpanjang <= 8, true)
const titikDuaBiasa =
  'Tanda bahaya yang perlu diwaspadai: jika setelah itu Anda mengalami demam tinggi berkepanjangan, diare hebat, atau tanda infeksi lain, segera ke tenaga kesehatan terdekat.'
cek('kalimat bertitik dua TANPA butir pendek TETAP dihitung', ukurKeterbacaan(titikDuaBiasa).kalimatTerpanjang > 15, true)

console.log('=== 3. ukur keterbacaan ===')
const mudah = 'Cuci tangan. Pakai sabun. Bilas air. Lalu keringkan.'
const sulit =
  'Hipertensi merupakan kondisi kronis yang ditandai dengan peningkatan tekanan darah arteri secara menetap sehingga memerlukan pemantauan berkala dan penyesuaian terapi farmakologis.'
const uMudah = ukurKeterbacaan(mudah)
const uSulit = ukurKeterbacaan(sulit)
console.log('  teks mudah :', JSON.stringify(uMudah))
console.log('  teks sulit :', JSON.stringify(uSulit))
cek('teks mudah lebih pendek per kalimat', uMudah.asl < uSulit.asl, true)
cek('teks mudah lebih sedikit kata sulit', uMudah.persenKataSulit < uSulit.persenKataSulit, true)
cek('teks kosong tidak error', ukurKeterbacaan('').kata, 0)

console.log('=== 4. periksa sasaran ===')
// CATATAN: ambang di SASARAN masih SEMENTARA. Uji ini hanya memastikan
// alatnya bekerja; angka ambangnya dikalibrasi dari pengukuran nyata
// (lihat ukur-tingkat.mjs). Karena itu yang diuji di sini adalah ARAH
// perbandingannya, bukan angka mutlaknya.
cek(
  'teks mudah jauh lebih rendah daripada teks sulit',
  uMudah.asw < uSulit.asw && uMudah.persenKataSulit < uSulit.persenKataSulit,
  true,
)
cek(
  'anak: teks sulit TIDAK lolos',
  periksaSasaran('anak', uSulit).lolos,
  false,
)
const pel = periksaSasaran('anak', uSulit).pelanggaran
console.log('  pelanggaran (gerbang):', JSON.stringify(pel))
cek('pelanggaran menyebut alasannya', pel.length > 0, true)

// PEMISAHAN GERBANG vs TREN — diukur 14 Okt 2026: panjang kata TIDAK boleh
// menggagalkan jawaban, karena urutannya kacau per pertanyaan (benar di 1 dari
// 8) dan kata yang dicap "sulit" ternyata kata sehari-hari (adalah, karena,
// latihan, tekanan). Yang menggagalkan hanya panjang kalimat.
const uPanjangKata = { asl: 5, asw: 3.5, persenKataSulit: 90, persenKataSangatPanjang: 60, kalimatTerpanjang: 6 }
const hasilPanjangKata = periksaSasaran('anak', uPanjangKata)
cek('kata panjang TIDAK menggagalkan kalau kalimatnya pendek', hasilPanjangKata.lolos, true)
cek('kata panjang tetap DILAPORKAN sebagai tren', hasilPanjangKata.tren.length > 0, true)
console.log('  tren yang dilaporkan:', JSON.stringify(hasilPanjangKata.tren))
cek('UKURAN_GERBANG hanya panjang kalimat', UKURAN_GERBANG.join(','), 'aslMaks,kalimatTerpanjangMaks')
cek('SASARAN punya sangatPanjangMaks di semua tingkat',
  ['anak','lansia','remaja','dewasa'].every((t) => typeof SASARAN[t].sangatPanjangMaks === 'number'), true)
cek('tingkat tak dikenal dianggap lolos', periksaSasaran('xx', uSulit).lolos, true)

console.log('=== 5. urutan sasaran masuk akal (DIBACA dari SASARAN, bukan ditulis ulang) ===')
// Angka ditulis di sini SEBELUMNYA, dan itu berbahaya: sasaran bisa
// dikalibrasi ulang sementara uji ini tetap melaporkan angka lama dan
// seolah-olah semuanya beres. Sekarang dibaca langsung dari sumbernya.
for (const [nama, kunci] of [
  ['aslMaks', 'aslMaks'],
  ['aswMaks', 'aswMaks'],
  ['sulitMaks', 'sulitMaks'],
  ['kalimatTerpanjangMaks', 'kalimatTerpanjangMaks'],
]) {
  const nilai = TINGKAT_UJI.map((t) => [t, SASARAN[t][kunci]])
  console.log(`  ${nama.padEnd(21)}: ${nilai.map(([t, v]) => `${t}=${v}`).join(' , ')}`)
  cek(`${nama}: anak <= dewasa`, SASARAN.anak[kunci] <= SASARAN.dewasa[kunci], true)
}
cek('aslMaks urut penuh (anak <= lansia <= remaja <= dewasa)',
  TINGKAT_UJI.every((t, i) => i === 0 || SASARAN[TINGKAT_UJI[i - 1]].aslMaks <= SASARAN[t].aslMaks), true)
cek('kalimatTerpanjangMaks urut penuh',
  TINGKAT_UJI.every((t, i) => i === 0 || SASARAN[TINGKAT_UJI[i - 1]].kalimatTerpanjangMaks <= SASARAN[t].kalimatTerpanjangMaks), true)

console.log(`\n=== RINGKASAN: ${lulus} lulus, ${gagal} gagal ===`)
process.exit(gagal ? 1 : 0)
