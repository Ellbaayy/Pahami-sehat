/**
 * Uji unit untuk bagian OCR yang tidak butuh peramban.
 *
 * Yang diuji di sini adalah logika yang menentukan MUTU hasil: perapian teks
 * dan penandaan angka mencurigakan. Mesin OCR-nya sendiri (tesseract.js)
 * diuji lewat peramban sungguhan — lihat README, bagian "Menguji pindai foto".
 *
 * Jalankan:  node uji-ocr.mjs
 */

import {
  periksaAngkaMencurigakan,
  rapikanTeks,
  pesanProgres,
} from './app/src/lib/ocr.js'

let lulus = 0
let gagal = 0

function cek(nama, dapat, harus) {
  const sama = JSON.stringify(dapat) === JSON.stringify(harus)
  if (sama) {
    lulus++
    console.log(`  ok    ${nama}`)
  } else {
    gagal++
    console.log(`  GAGAL ${nama}`)
    console.log(`        dapat : ${JSON.stringify(dapat)}`)
    console.log(`        harus : ${JSON.stringify(harus)}`)
  }
}

function cekBenar(nama, syarat, keterangan = '') {
  if (syarat) {
    lulus++
    console.log(`  ok    ${nama}`)
  } else {
    gagal++
    console.log(`  GAGAL ${nama}${keterangan ? ` — ${keterangan}` : ''}`)
  }
}

/* ------------------------------------------------------- rapikanTeks --- */
console.log('\nrapikanTeks')

cek(
  'buang spasi di ujung baris',
  rapikanTeks('  halo   dunia  \n  Baris Dua  '),
  'halo dunia\nBaris Dua',
)

cek(
  'sambung baris yang terpotong di tengah kalimat',
  rapikanTeks('Peringatan: jangan digunakan lebih dari 3 hari\ntanpa anjuran dokter.'),
  'Peringatan: jangan digunakan lebih dari 3 hari tanpa anjuran dokter.',
)

// CATATAN TRADE-OFF — ini perilaku yang DISENGAJA, bukan kekurangan yang belum
// diketahui: baris yang diawali huruf kecil selalu dianggap lanjutan baris
// sebelumnya, jadi dua baris terpisah yang kebetulan diawali huruf kecil akan
// ikut tersambung. Dipilih begitu karena pada label obat dan hasil lab, baris
// baru hampir selalu diawali huruf besar atau angka — sedangkan baris yang
// terpotong karena sempitnya kertas jauh lebih sering terjadi.
cek(
  'baris berhuruf kecil disambung (perilaku yang disengaja)',
  rapikanTeks('a\nb'),
  'a b',
)

cek(
  'JANGAN sambung baris baru yang diawali huruf besar',
  rapikanTeks('No. Registrasi: DTL 123\nDiproduksi oleh: PT Sehat'),
  'No. Registrasi: DTL 123\nDiproduksi oleh: PT Sehat',
)

cek(
  'JANGAN sambung baris baru yang diawali angka',
  rapikanTeks('Kesan: anemia ringan\n12 Oktober 2026'),
  'Kesan: anemia ringan\n12 Oktober 2026',
)

cek(
  'JANGAN sambung setelah tanda baca akhir',
  rapikanTeks('Hentikan pemakaian bila terjadi ruam kulit.\nlanjutkan dengan hati-hati'),
  'Hentikan pemakaian bila terjadi ruam kulit.\nlanjutkan dengan hati-hati',
)

cek('rapatkan baris kosong beruntun', rapikanTeks('a\n\n\n\nb'), 'a\n\nb')

cek('buang baris yang hanya tanda baca', rapikanTeks('Nama Pasien\n-\nBudi'), 'Nama Pasien\nBudi')

cek('aman terhadap null', rapikanTeks(null), '')

cek('aman terhadap undefined', rapikanTeks(undefined), '')

cek(
  'normalisasi CRLF',
  rapikanTeks('Baris satu\r\nBaris dua'),
  'Baris satu\nBaris dua',
)

cek(
  'normalisasi CR tunggal',
  rapikanTeks('Baris satu\rBaris dua'),
  'Baris satu\nBaris dua',
)

cek(
  'rapikan spasi ganda di tengah baris',
  rapikanTeks('Hemoglobin          : 11.2 g/dL'),
  'Hemoglobin : 11.2 g/dL',
)

/* ----------------------------------------- periksaAngkaMencurigakan --- */
console.log('\nperiksaAngkaMencurigakan')

// kasus asli yang ditemukan saat menguji: ':' salah terbaca jadi '1'
cekBenar(
  'menandai 111.2 (titik dua jadi 1)',
  periksaAngkaMencurigakan('Hemoglobin 111.2 g/dL').some((a) => a.teks.includes('111.2')),
)

cekBenar(
  'menandai 211.2 (titik dua jadi 2)',
  periksaAngkaMencurigakan('Hemoglobin 211.2 g/dL').some((a) => a.teks.includes('211.2')),
)

cekBenar(
  'menandai 1121.2 (titik dua jadi 1 lalu menempel)',
  periksaAngkaMencurigakan('Hemoglobin 1121.2 g/dL').some((a) => a.teks.includes('1121.2')),
)

cekBenar(
  'TIDAK menandai angka normal 11.2',
  periksaAngkaMencurigakan('Hemoglobin : 11.2 g/dL').length === 0,
  'angka wajar seharusnya tidak ditandai',
)

cekBenar(
  'TIDAK menandai 12.500 /uL',
  periksaAngkaMencurigakan('Leukosit : 12.500 /uL').length === 0,
)

cekBenar(
  'TIDAK menandai 245.000 /uL',
  periksaAngkaMencurigakan('Trombosit : 245.000 /uL').length === 0,
)

cekBenar(
  'menandai persen yang jadi huruf (34Yo)',
  periksaAngkaMencurigakan('Hematokrit : 34 Yo').length > 0,
)

cekBenar(
  'TIDAK menandai persen normal (34 %)',
  periksaAngkaMencurigakan('Hematokrit : 34 %').length === 0,
)

cekBenar(
  'menandai angka sangat panjang tanpa pemisah',
  periksaAngkaMencurigakan('No. 1234567890').length > 0,
)

cekBenar(
  'TIDAK menandai nomor registrasi berformat normal',
  periksaAngkaMencurigakan('No. Registrasi: DTL 1234567890A1').length === 0,
  'ada huruf di belakang, jadi bukan rangkaian angka murni',
)

cekBenar(
  'TIDAK menandai teks tanpa angka',
  periksaAngkaMencurigakan('Konsultasikan hasil ini dengan dokter Anda.').length === 0,
)

// Positif palsu yang ditemukan saat menguji di peramban: "126 mg/dL" dan
// "232 mg/dL" adalah bilangan bulat yang SAH, tapi sempat ikut ditandai oleh
// aturan "kehilangan titik desimal". Aturannya sudah dibuang — uji ini
// memastikan ia tidak kembali.
cekBenar(
  'TIDAK menandai angka bulat yang sah (126 mg/dL)',
  periksaAngkaMencurigakan('GULA DARAH PUASA : 126 mg/dL').length === 0,
  'bilangan bulat sah tidak boleh ditandai',
)

cekBenar(
  'TIDAK menandai angka bulat yang sah (232 mg/dL)',
  periksaAngkaMencurigakan('KOLESTEROL TOTAL : 232 mg/dL').length === 0,
)

cekBenar(
  'TIDAK menandai tekanan darah (120/80)',
  periksaAngkaMencurigakan('Tekanan darah : 120/80 mmHg').length === 0,
)

cekBenar(
  'TIDAK menandai suhu (36.5)',
  periksaAngkaMencurigakan('Suhu : 36.5 C').length === 0,
)

cekBenar('aman terhadap teks kosong', periksaAngkaMencurigakan('').length === 0)

cekBenar('aman terhadap null', periksaAngkaMencurigakan(null).length === 0)

cekBenar(
  'temuan tidak berulang walau angka muncul dua kali',
  periksaAngkaMencurigakan('111.2 dan lagi 111.2').length === 1,
  'gugus yang sama cukup ditandai sekali',
)

cekBenar(
  'setiap temuan punya alasan yang bisa dibaca',
  periksaAngkaMencurigakan('Hemoglobin 111.2 g/dL').every((a) => a.alasan && a.alasan.length > 10),
)

/* ------------------------------------------------------ pesanProgres --- */
console.log('\npesanProgres')

cek('status dikenal -> kunci kamus', pesanProgres('loading tesseract core', 0).kunci, 'pindai.siapMesin')

cek(
  'recognizing text menyertakan persen',
  pesanProgres('recognizing text', 0.42),
  { kunci: 'pindai.bacaTeks', persen: 42 },
)

cek('status tak dikenal -> kunci umum', pesanProgres('entah apa', 0).kunci, 'pindai.prosesUmum')

cek('persen dibulatkan', pesanProgres('recognizing text', 0.666).persen, 67)

/* ------------------------------------------------------------- hasil --- */
console.log(`\n${lulus} lulus, ${gagal} gagal\n`)
process.exit(gagal ? 1 : 0)
