#!/usr/bin/env node
/**
 * uji-suara.mjs — uji ejaan & kestabilan nada pada fitur suara.
 *
 * KENAPA SKRIP INI ADA
 * Dua keluhan jagi (15 Okt 2026):
 *   1. "speech-nya belum bisa mengeja huruf atau kata yang seharusnya dieja"
 *   2. "suara kadang masih naik turun"
 *
 * Keduanya diperbaiki dari PENGUKURAN, bukan tebakan, jadi keduanya juga harus
 * dijaga oleh uji — kalau tidak, perbaikan ini bisa hilang tanpa disadari saat
 * kode dirawat.
 *
 * UJI INI TIDAK MEMANGGIL LAYANAN SUARA (tidak butuh jaringan), jadi bisa ikut
 * dijalankan di CI. Yang diuji adalah keputusan yang diambil kode:
 *   - singkatan mana yang DIEJA dan mana yang TIDAK boleh disentuh
 *   - seberapa lebar rentang nada antar kalimat
 *
 * Cara pakai:
 *   node uji-suara.mjs
 */

import { siapkanEjaan, nadaKalimat, pecahKalimat, DIEJA, JANGAN_EJA } from './app/server/suara.js'

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

console.log('\n=== PEMBAGIAN: dieja vs tidak dieja ===')
console.log(`  dieja      (${DIEJA.length}): ${DIEJA.join(', ')}`)
console.log(`  tidak dieja (${Object.keys(JANGAN_EJA).length}): ${Object.keys(JANGAN_EJA).join(', ')}`)

console.log('\n=== SETIAP yang perlu dieja BENAR-BENAR dieja ===')
for (const kode of DIEJA) {
  cek(`${kode} dieja`, siapkanEjaan(`Cek ${kode} sekarang.`), `Cek ${kode.split('').join(' ')} sekarang.`)
}

console.log('\n=== SETIAP yang TIDAK perlu dieja TIDAK disentuh ===')
// Ini bagian terpenting: mengeja yang sudah benar akan terdengar rusak.
for (const kode of Object.keys(JANGAN_EJA)) {
  cek(`${kode} dibiarkan`, siapkanEjaan(`Cek ${kode} sekarang.`), `Cek ${kode} sekarang.`)
}

console.log('\n=== yang mendekati batas (keputusan sadar) ===')
// USG (0,89) dan WHO (0,90) ada di tepi. Sengaja TIDAK dieja: kalau ragu,
// jangan mengeja — mengeja yang sudah benar lebih merusak daripada tidak
// mengeja yang salah.
cek('USG dibiarkan (rasio 0,89)', siapkanEjaan('Periksa USG.'), 'Periksa USG.')
cek('WHO dibiarkan (rasio 0,90)', siapkanEjaan('Menurut WHO.'), 'Menurut WHO.')

console.log('\n=== EJAAN: tidak mengganggu teks lain ===')
cek('kata biasa utuh', siapkanEjaan('Demam berdarah perlu diperiksa.'), 'Demam berdarah perlu diperiksa.')
cek('angka utuh', siapkanEjaan('Tekanan 120 per 80.'), 'Tekanan 120 per 80.')
cek('tidak memotong kata', siapkanEjaan('DBDx bukan singkatan.'), 'DBDx bukan singkatan.')
cek('beberapa sekaligus', siapkanEjaan('DBD, ISPA, dan PPOK.'), 'D B D, I S P A, dan P P O K.')
cek('teks kosong aman', siapkanEjaan(''), '')

console.log('\n=== NADA: rentang harus sempit (keluhan "naik turun") ===')
// Diukur pada audio sungguhan: -4Hz -> f0 222,2 Hz, +4Hz -> f0 235,3 Hz.
// Selisihnya ~5,9% (~1 semitone). Versi lama -18Hz..+10Hz = 21,6% (hampir
// 4 semitone) dan itulah yang terdengar naik-turun.
const ambilHz = (p) => {
  const m = String(p).match(/([+-]?\d+(?:\.\d+)?)Hz/)
  return m ? Number(m[1]) : 0
}
const semuaNada = [
  nadaKalimat('Perhatian, segera ke dokter.', {}).pitch,
  nadaKalimat('Apa itu demam?', {}).pitch,
  nadaKalimat('Ini kalimat pembuka.', { pertama: true }).pitch,
  nadaKalimat('Ini kalimat biasa.', {}).pitch,
  nadaKalimat('Ini kalimat penutup.', { terakhir: true }).pitch,
]
const hz = semuaNada.map(ambilHz)
const rentang = Math.max(...hz) - Math.min(...hz)
cek('rentang nada <= 10 Hz', rentang <= 10, true)
cek('peringatan lebih rendah dari biasa', ambilHz(nadaKalimat('Awas, bahaya.', {}).pitch) < 0, true)
cek('penutup tidak melompat tinggi', ambilHz(nadaKalimat('Selesai.', { terakhir: true }).pitch) <= 4, true)

console.log('\n=== NADA: aturan isi masih bekerja ===')
cek('peringatan -> lebih lambat', nadaKalimat('Segera ke dokter.', {}).rate, '-8%')
cek('pertanyaan -> naik sedikit', nadaKalimat('Apa itu demam?', {}).pitch, '+4Hz')
cek('pembuka -> hangat', nadaKalimat('Halo.', { pertama: true }).rate, '-4%')

console.log('\n=== PECAH KALIMAT masih utuh ===')
// Catatan: kalimat di bawah 25 karakter digabung ke kalimat sebelumnya — itu
// perilaku yang disengaja, supaya tidak ada audio terputus-putus. Jadi kalimat
// ujinya harus cukup panjang untuk tetap terpisah.
cek(
  'dua kalimat panjang tetap terpisah',
  pecahKalimat('Ini kalimat pertama yang cukup panjang untuk diuji. Ini kalimat kedua yang juga panjang.').length,
  2,
)
cek('kalimat pendek digabung', pecahKalimat('Ini kalimat panjang sekali untuk diuji. Ya.').length, 1)
cek('kosong -> kosong', pecahKalimat('').length, 0)

console.log('\n=== RINGKASAN ===')
console.log(`lulus : ${lulus}`)
console.log(`gagal : ${gagal}`)
process.exit(gagal ? 1 : 0)
