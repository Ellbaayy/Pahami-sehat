#!/usr/bin/env node
/**
 * Uji konteks percakapan — TANPA jaringan, TANPA database, TANPA API key.
 *
 * KENAPA UJI INI ADA
 * ------------------
 * Keluhan yang memicunya: percakapan terasa "tidak nyambung dan kaku".
 * Penyebabnya empat, dan ketiganya bisa diuji tanpa memanggil model:
 *
 *   1. Pertanyaan lanjutan ("terus gimana udah terlanjur nih") tidak dikenali
 *      sebagai lanjutan, sehingga dicari dengan kata sambungnya sendiri dan
 *      dijawab generik.
 *   2. Riwayat percakapan tidak pernah masuk ke prompt.
 *   3. Nada tingkat anak terdengar seperti bicara ke balita.
 *   4. Klaim yang tidak ada di sumber tetap ditulis di jawaban.
 *
 * Yang diuji di sini adalah ATURAN dan SUSUNAN PROMPT. Jawaban modelnya sendiri
 * hanya bisa dibuktikan dengan memanggil server sungguhan — itu tugas
 * `uji-jawaban.mjs`, dan tidak dijalankan di CI karena butuh kunci.
 *
 * Jalankan: node uji-konteks.mjs
 */
import {
  pertanyaanLanjutan,
  blokRiwayat,
  promptTanya,
  promptTanyaDenganCari,
  promptSantai,
  TINGKAT,
} from './app/server/prompts.js'
import { istilahKesehatan } from './app/server/kataKunci.js'

let lulus = 0
let gagal = 0

function periksa(nama, syarat, keterangan = '') {
  if (syarat) {
    lulus++
    console.log(`  ok    ${nama}`)
  } else {
    gagal++
    console.log(`  GAGAL ${nama}${keterangan ? ` — ${keterangan}` : ''}`)
  }
}

const adaIstilah = (q) => Boolean(istilahKesehatan(q))

/* ---------------------------------------------------------------------------
 * 1. PERTANYAAN LANJUTAN DIKENALI
 * ------------------------------------------------------------------------ */
console.log('\n1. Pertanyaan lanjutan dikenali sebagai lanjutan')

const LANJUTAN = [
  'terus gimana udah terlanjur nih',
  'jadi gimana dong',
  'lalu apa',
  'kalau begitu bagaimana',
  'terus?',
  'udah terlanjur',
  'trs gimana',
  'yang tadi itu aman nggak',
]
for (const q of LANJUTAN) {
  periksa(`lanjutan: "${q}"`, pertanyaanLanjutan(q, adaIstilah(q)))
}

console.log('\n2. Pesan yang BERDIRI SENDIRI tidak dianggap lanjutan')

const SENDIRI = [
  'gagal ginjal itu apa ya',
  'apa itu diabetes',
  'bagaimana cara mencegah demam berdarah',
  'aku habis jual ginjal',
  'apakah orang dengan 1 ginjal tidak akan bertahan hidup lama?',
  'berapa tekanan darah normal',
]
for (const q of SENDIRI) {
  periksa(`sendiri: "${q}"`, !pertanyaanLanjutan(q, adaIstilah(q)))
}

/* ---------------------------------------------------------------------------
 * 3. SAPAAN TETAP SAPAAN
 * ------------------------------------------------------------------------ */
console.log('\n3. Sapaan tetap sapaan, walau percakapan sudah berjalan')

// Tanpa penjagaan ini, "halo" (4 huruf, tanpa istilah kesehatan) dianggap
// pertanyaan lanjutan hanya karena pendek — dan pengguna yang menyapa malah
// menerima jawaban tentang ginjal.
for (const q of ['halo', 'hai', 'terima kasih', 'makasih ya', 'selamat pagi', 'oke']) {
  periksa(`sapaan: "${q}"`, !pertanyaanLanjutan(q, adaIstilah(q)))
}

/* ---------------------------------------------------------------------------
 * 4. BLOK RIWAYAT
 * ------------------------------------------------------------------------ */
console.log('\n4. Blok riwayat disusun benar')

periksa('riwayat kosong -> string kosong', blokRiwayat([]) === '')
periksa('riwayat undefined -> string kosong', blokRiwayat() === '')
periksa('riwayat berisi data rusak -> tetap kosong', blokRiwayat([{ peran: 'x' }, { teks: '' }]) === '')

const riwayatContoh = [
  { peran: 'pengguna', teks: 'gagal ginjal itu apa ya' },
  { peran: 'aplikasi', teks: 'Ginjal menyaring kotoran dari darah.' },
  { peran: 'pengguna', teks: 'terus gimana udah terlanjur nih' },
]
const blok = blokRiwayat(riwayatContoh)
periksa('riwayat berisi -> memuat penanda', blok.includes('RIWAYAT PERCAKAPAN INI'))
periksa('urutan lama -> baru dipertahankan', blok.indexOf('gagal ginjal itu apa ya') < blok.indexOf('terus gimana'))
periksa('peran diberi nama yang bisa dibaca', blok.includes('Pengguna:') && blok.includes('Pahami Sehat:'))
periksa('menyatakan riwayat BUKAN sumber', blok.includes('KONTEKS, BUKAN SUMBER'))
periksa('melarang mengulang jawaban lama', /JANGAN mengulang jawaban sebelumnya/.test(blok))
periksa('melarang menyapa ulang', /JANGAN menyapa ulang/.test(blok))
periksa('melarang menganggap jawaban lama sebagai fakta', /JANGAN menganggap isi jawaban lama sebagai fakta/.test(blok))

// Teks panjang dipotong supaya prompt tidak membengkak.
// Batasnya diukur dari bagian riwayat saja — blok penjelasannya tetap penuh,
// jadi membandingkan panjang seluruh blok bukan ukuran yang benar.
const panjang = blokRiwayat([{ peran: 'aplikasi', teks: 'a'.repeat(5000) }], { maksTeks: 100 })
const bagianIsi = panjang.split('CARA MEMAKAI RIWAYAT')[0]
periksa(
  'teks panjang dipotong',
  !bagianIsi.includes('a'.repeat(101)),
  `panjang bagian isi=${bagianIsi.length}`,
)
periksa('blok riwayat selalu memuat aturan pemakaian', panjang.includes('CARA MEMAKAI RIWAYAT'))

/* ---------------------------------------------------------------------------
 * 5. PROMPT: percakapan baru TIDAK berubah
 * ------------------------------------------------------------------------ */
console.log('\n5. Percakapan baru tidak berubah perilakunya')

const tanpaRiwayat = promptTanya({ pertanyaan: 'x', tingkat: 'anak' })
const riwayatKosong = promptTanya({ pertanyaan: 'x', tingkat: 'anak', riwayat: [] })
periksa('riwayat kosong -> prompt IDENTIK', tanpaRiwayat.system === riwayatKosong.system)
periksa('riwayat kosong -> tidak memuat blok riwayat', !tanpaRiwayat.system.includes('RIWAYAT PERCAKAPAN'))

const denganRiwayat = promptTanya({ pertanyaan: 'x', tingkat: 'anak', riwayat: riwayatContoh })
periksa('riwayat ada -> blok riwayat masuk prompt', denganRiwayat.system.includes('RIWAYAT PERCAKAPAN INI'))
periksa('riwayat ada -> pertanyaan pengguna tetap dikirim utuh', denganRiwayat.user.includes('x'))

const denganCari = promptTanyaDenganCari({
  pertanyaan: 'x',
  tingkat: 'anak',
  hasilCari: [{ judul: 'Ginjal', url: 'https://id.wikipedia.org/wiki/Ginjal', isi: 'isi' }],
  riwayat: riwayatContoh,
})
periksa('jalur pencarian ikut membawa riwayat', denganCari.system.includes('RIWAYAT PERCAKAPAN INI'))
periksa('jalur pencarian tetap membawa hasil cari', denganCari.system.includes('id.wikipedia.org/wiki/Ginjal'))

/* ---------------------------------------------------------------------------
 * 6. NADA ANAK: tidak seperti bicara ke balita
 * ------------------------------------------------------------------------ */
console.log('\n6. Nada tingkat anak bukan nada balita')

const anak = TINGKAT.anak
periksa('nada anak melarang "Tenang ya"', /JANGAN membuka jawaban dengan menenangkan/.test(anak.nada))
periksa('nada anak melarang penghalus "ya" di ujung kalimat', /menutup kalimat dengan "ya"/.test(anak.nada))
periksa('nada anak menyebut umur pembacanya', /9–11 tahun/.test(anak.nada))
periksa('larangan anak melarang nada manja', /nada manja/.test(anak.larangan))
periksa('larangan anak melarang mengulang nasihat', /mengulang-ulang nasihat/.test(anak.larangan))

/* ---------------------------------------------------------------------------
 * 7. ATURAN KLAIM & SEBUTAN DIRI
 * ------------------------------------------------------------------------ */
console.log('\n7. Klaim tanpa sumber & sebutan diri diatur tegas')

periksa(
  'melarang klaim tanpa sumber masuk jawaban',
  /KLAIM TANPA SUMBER TIDAK BOLEH MASUK KE JAWABAN/.test(denganCari.system),
)
periksa('menyuruh menjawab pertanyaannya dulu', /JAWAB PERTANYAANNYA DULU/.test(denganCari.system))
periksa('melarang menyebut diri "aku"/"saya"', /sebut dirimu "aplikasi ini", bukan "aku"/.test(tanpaRiwayat.system))
periksa('melarang nasihat umum berulang', /JANGAN mengulang nasihat umum/.test(tanpaRiwayat.system))

/* ---------------------------------------------------------------------------
 * 8. MODE SANTAI TIDAK TERINFEKSI
 * ------------------------------------------------------------------------ */
console.log('\n8. Mode santai tidak ikut berubah')

const santai = promptSantai({ pertanyaan: 'halo' })
periksa('mode santai tetap tanpa daftar sumber', /JANGAN memberi daftar sumber/.test(santai.system))
periksa('mode santai tetap membalas singkat', /1-3 kalimat/.test(santai.system))

/* ---------------------------------------------------------------------------
 * RINGKASAN
 * ------------------------------------------------------------------------ */
console.log(`\n=== RINGKASAN: ${lulus} lulus, ${gagal} gagal ===`)
process.exit(gagal ? 1 : 0)
