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

import { siapkanEjaan, nadaKalimat, pecahKalimat } from './app/server/suara.js'

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

console.log('\n=== EJAAN: singkatan yang WAJIB dieja ===')
// Diukur: bentuk polos dibaca sebagai kata oleh mesinnya, bentuk berspasi dieja.
cek('DBD dieja', siapkanEjaan('Pasien DBD.'), 'Pasien D B D.')
cek('ISPA dieja', siapkanEjaan('Gejala ISPA.'), 'Gejala I S P A.')
cek('PPOK dieja', siapkanEjaan('Riwayat PPOK.'), 'Riwayat P P O K.')
cek('GERD dieja', siapkanEjaan('Keluhan GERD.'), 'Keluhan G E R D.')
cek('BPJS dieja', siapkanEjaan('Kartu BPJS.'), 'Kartu B P J S.')
cek('RSUD dieja', siapkanEjaan('Rujuk ke RSUD.'), 'Rujuk ke R S U D.')

console.log('\n=== EJAAN: yang SENGAJA TIDAK disentuh ===')
// Sudah benar dibaca mesinnya (selisih durasi <= 12%). Mengubahnya = merusak.
cek('TBC dibiarkan', siapkanEjaan('Obat TBC.'), 'Obat TBC.')
cek('IGD dibiarkan', siapkanEjaan('Ke IGD sekarang.'), 'Ke IGD sekarang.')
cek('ICU dibiarkan', siapkanEjaan('Masuk ICU.'), 'Masuk ICU.')
cek('BMI dibiarkan', siapkanEjaan('Angka BMI.'), 'Angka BMI.')
cek('USG dibiarkan', siapkanEjaan('Periksa USG.'), 'Periksa USG.')
cek('MRI dibiarkan', siapkanEjaan('Hasil MRI.'), 'Hasil MRI.')
cek('WHO dibiarkan', siapkanEjaan('Menurut WHO.'), 'Menurut WHO.')

console.log('\n=== EJAAN: kata yang memang dibaca sebagai kata (JANGAN dieja) ===')
// Rasio durasi 0,57-0,58 = memang dibaca sebagai kata, dan itu BENAR.
cek('POSYANDU dibiarkan', siapkanEjaan('Datang ke POSYANDU.'), 'Datang ke POSYANDU.')
cek('PUSKESMAS dibiarkan', siapkanEjaan('Ke PUSKESMAS terdekat.'), 'Ke PUSKESMAS terdekat.')

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
