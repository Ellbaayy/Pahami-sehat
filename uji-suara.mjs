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

import {
  siapkanEjaan,
  nadaKalimat,
  pecahKalimat,
  DIEJA,
  JANGAN_EJA,
  tebakBahasaDaerah,
  tentukanBahasa,
  pilihSuara,
  daftarSuara,
  BAHASA_SUARA,
  JENIS_SUARA,
} from './app/server/suara.js'

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

/* ==========================================================================
 * DETEKSI BAHASA & PILIHAN SUARA — ditambahkan 16 Okt 2026
 * ======================================================================== */

console.log('\n=== BUG: kalimat INDONESIA tidak boleh dinyatakan Jawa/Sunda ===')
/*
 * Keluhan jagi: "aku nanya pakai bahasa indonesia, dijawab dalam bahasa
 * indonesia, tapi pas pakai speech dibacain pakai bahasa jawa".
 *
 * Penyebabnya DIUKUR: pencocokan memakai POTONGAN KATA, sehingga kata daerah
 * pendek memicu deteksi palsu pada kata Indonesia yang sangat umum —
 * 'iku' cocok di "ikuti"/"siku", 'dina' cocok di "dinamis"/"dinamakan".
 * Terukur saat itu: 5 dari 10 kalimat kesehatan Indonesia dinyatakan Jawa.
 *
 * Kalimat di bawah adalah kalimat kesehatan yang WAJAR, dan semuanya harus
 * tetap dianggap Indonesia. Kalau salah satu mulai terdeteksi daerah lagi,
 * uji ini akan menangkapnya sebelum sampai ke pengguna.
 */
const KALIMAT_INDONESIA = [
  'Ikuti anjuran dokter dan minum obat secara teratur.',
  'Penyakit ini dinamis dan bisa berubah sewaktu-waktu.',
  'Kondisi ini dinamakan hipertensi oleh para ahli kesehatan.',
  'Ayo ikuti program imunisasi dasar lengkap untuk anak.',
  'Siku tangan terasa nyeri setelah olahraga berat.',
  'Demam berdarah adalah penyakit dari virus yang ditularkan nyamuk.',
  'Abdi negara bertugas melayani masyarakat.',
  'Setelah minum teh, gejala biasanya membaik.',
  'Dokter akan memeriksa tekanan darah Anda hari ini.',
  'Jangan lupa lanjutkan pengobatan sampai selesai ya.',
  'Gejala demam berdarah biasanya muncul tiga sampai tujuh hari.',
  'Ikuti petunjuk pemakaian obat pada kemasan.',
]
for (const k of KALIMAT_INDONESIA) {
  cek(`indonesia: "${k.slice(0, 40)}…"`, tebakBahasaDaerah(k), 'id')
}

console.log('\n=== JAWA & SUNDA tetap terdeteksi (fitur ini tidak boleh hilang) ===')
// Fitur suara daerah adalah keunggulan aplikasi ini — yang diperbaiki adalah
// KETEPATANNYA, bukan dihapus.
for (const k of [
  'Penyakit iki yaiku demam berdarah sing disebabake virus.',
  'Menika kula badhe matur babagan lelara demam berdarah.',
  'Sawise diombe obat, gejalane saya suda.',
  'Nganggo cara menika, awak badhe saya sehat.',
]) {
  cek(`jawa: "${k.slice(0, 40)}…"`, tebakBahasaDaerah(k), 'jv')
}
for (const k of [
  'Panyakit ieu nyaeta demam berdarah anu disababkeun ku virus.',
  'Sanggeus diinum obatna, gejala teh ngurangan.',
  'Numutkeun dokter, kasakit ieu kudu diubaran geura.',
]) {
  cek(`sunda: "${k.slice(0, 40)}…"`, tebakBahasaDaerah(k), 'su')
}

console.log('\n=== PILIHAN PENGGUNA menang atas tebakan otomatis ===')
/*
 * Ini inti perbaikannya: kalau pengguna sudah memilih suara sendiri di
 * Pengaturan, tebakan otomatis TIDAK dijalankan. Jadi walaupun tebakannya
 * salah, pengguna tidak lagi "dibacakan Jawa" tanpa bisa apa-apa.
 */
cek('pilih Jawa + teks Indonesia', tentukanBahasa('Ikuti anjuran dokter yaiku minum obat.', 'jv'), 'jv')
cek('pilih Indonesia + teks Jawa', tentukanBahasa('Penyakit iki yaiku demam berdarah.', 'id'), 'id')
cek('pilih Inggris + teks Indonesia', tentukanBahasa('Demam berdarah itu apa?', 'en'), 'en')
cek('pilih Sunda + teks Indonesia', tentukanBahasa('Ikuti anjuran dokter.', 'su'), 'su')
cek('auto + teks Indonesia', tentukanBahasa('Ikuti anjuran dokter.', 'auto'), 'id')
cek('auto + teks Jawa', tentukanBahasa('Penyakit iki yaiku demam berdarah.', 'auto'), 'jv')
cek('kosong -> auto', tentukanBahasa('Penyakit iki yaiku demam.', ''), 'jv')
cek('kode ngawur -> auto', tentukanBahasa('Ikuti anjuran dokter.', 'xx'), 'id')

console.log('\n=== MATRIKS SUARA: 4 bahasa × 2 jenis ===')
/*
 * SEMUA nama suara di bawah sudah DIPERIKSA ke layanan Microsoft (322 suara
 * tersedia) — bukan dari ingatan. Cara memeriksa ulang:
 *
 *   node -e "import('msedge-tts').then(async m => {
 *     const t = new m.MsEdgeTTS(); const v = await t.getVoices();
 *     console.log(v.filter(x => /^(id|jv|su|en)-/.test(x.Locale)).map(x => x.ShortName + ' ' + x.Gender))
 *   })"
 *
 * Uji ini mengunci PASANGANNYA: kalau suatu saat nama suara diganti, uji ini
 * gagal sampai namanya diverifikasi ulang ke layanan — bukan sekadar dipercaya.
 */
const MATRIKS = [
  ['id', 'p', 'id-ID-GadisNeural'],
  ['id', 'l', 'id-ID-ArdiNeural'],
  ['jv', 'p', 'jv-ID-SitiNeural'],
  ['jv', 'l', 'jv-ID-DimasNeural'],
  ['su', 'p', 'su-ID-TutiNeural'],
  ['su', 'l', 'su-ID-JajangNeural'],
  ['en', 'p', 'en-US-AvaNeural'],
  ['en', 'l', 'en-US-AndrewNeural'],
]
for (const [b, j, nama] of MATRIKS) {
  cek(`suara ${b}/${j}`, pilihSuara(b, j), nama)
}
cek('jenis ngawur -> perempuan', pilihSuara('id', 'x'), 'id-ID-GadisNeural')
cek('bahasa ngawur -> Indonesia', pilihSuara('xx', 'l'), 'id-ID-ArdiNeural')

console.log('\n=== DAFTAR SUARA untuk antarmuka ===')
const daftar = daftarSuara()
cek('jumlah entri = 4 bahasa x 2 jenis', daftar.length, BAHASA_SUARA.length * JENIS_SUARA.length)
cek('semua punya label bahasa & jenis', daftar.every((x) => x.labelBahasa && x.labelJenis), true)
cek('semua nama suara terisi', daftar.every((x) => typeof x.nama === 'string' && x.nama.length > 5), true)
cek('tidak ada pasangan kembar', new Set(daftar.map((x) => x.bahasa + x.jenis)).size, daftar.length)

console.log('\n=== RINGKASAN ===')
console.log(`lulus : ${lulus}`)
console.log(`gagal : ${gagal}`)
process.exit(gagal ? 1 : 0)
