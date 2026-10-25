#!/usr/bin/env node
/**
 * Uji tanggal terbit konten harian — tanpa jaringan.
 *
 * KENAPA ADA (25 Okt 2026). Dua keluhan jagi, dua-duanya terbukti:
 *
 *   1. "Konten harian terakhir di update 12 Oktober 2026." Tanggal itu adalah
 *      kapan DAFTAR artikel pertama kali berubah, bukan tanggal terbit apa pun.
 *      Antarmuka menyebutnya "Diperbarui" sehingga pembaca wajar menyimpulkan
 *      isinya baru — padahal tidak ada satu pun artikel yang terbit 12 Oktober.
 *
 *   2. Artikel "Diabetes Ancaman Nyata Generasi Muda" terbit 24 Jun 2025 dan
 *      itu artikel TERMUDA KEDUA. Diukur di sumbernya: artikel termuda 05 May
 *      2026 (173 hari), tertua 24 Nov 2023 (1066 hari). `susun()` tidak pernah
 *      tahu tanggalnya, jadi urutan tampil tidak punya hubungan dengan kebaruan.
 *
 * Yang dijaga uji ini:
 *   - Parser mengenali tanggal dari `itemprop="datePublished"` — satu-satunya
 *     penanda yang ada di halaman Kemenkes (tidak ada <time>, tidak ada
 *     article:published_time).
 *   - Bulan Indonesia DAN Inggris sama-sama dikenali (sumbernya campur).
 *   - Tanggal ngawur DITOLAK, tidak ditebak, tidak digeser diam-diam.
 *   - Artikel tanpa tanggal tidak dibuang, tapi tidak pernah diletakkan di
 *     depan artikel bertanggal.
 *   - `susun()` mengurutkan menurut tanggal SEBELUM diputar, sehingga `geser`
 *     tidak bisa lagi mengangkat artikel tua ke atas artikel baru.
 */

import { bacaTanggalTerbit, urutkanTerbaru, susun } from './app/server/konten.js'

let lulus = 0
let gagal = 0
const cek = (nama, syarat, catatan = '') => {
  if (syarat) {
    lulus += 1
    console.log(`  ok    ${nama}`)
  } else {
    gagal += 1
    console.log(`  GAGAL ${nama} ${catatan}`)
  }
}

/** Bungkus tanggal dalam HTML persis seperti halaman Kemenkes. */
const halaman = (isi) =>
  `<html><body><div class="article-meta">` +
  `<div>Ditulis Oleh <a href="//ayosehat.kemkes.go.id/author/x">Nama</a></div>` +
  `<div itemprop="datePublished">${isi}</div>` +
  `<div>Dilihat 46068 Kali</div>` +
  `</div></body></html>`

console.log('== bacaTanggalTerbit — tanggal sungguhan dari sumber ==')
// Semua nilai di bawah diambil langsung dari ayosehat.kemkes.go.id, 25 Okt 2026.
for (const [mentah, iso] of [
  ['24 Jun 2025', '2025-06-24'], // Diabetes Ancaman Nyata Generasi Muda
  ['05 May 2026', '2026-05-05'], // Cara Membaca Label Gizi (termuda saat itu)
  ['4 Desember 2023', '2023-12-04'], // Perangkat Ajar Kesehatan — BULAN INDONESIA
  ['13 Oct 2024', '2024-10-13'], // Kesehatan Jiwa
  ['22 May 2024', '2024-05-22'], // Cegah Stunting
  ['02 May 2024', '2024-05-02'], // Cara Menjaga Kesehatan Jantung (nol di depan)
]) {
  const h = bacaTanggalTerbit(halaman(mentah))
  cek(`"${mentah}" -> ${iso}`, h.tanggalTerbitISO === iso, `dapat ${h.tanggalTerbitISO}`)
  cek(`"${mentah}" teks asli dipertahankan`, h.tanggalTerbit === mentah, `dapat ${h.tanggalTerbit}`)
}

console.log('\n== bulan Indonesia & Inggris sama-sama dikenali ==')
for (const [bulan, angka] of [
  ['Januari', '01'], ['Februari', '02'], ['Maret', '03'], ['April', '04'],
  ['Mei', '05'], ['Juni', '06'], ['Juli', '07'], ['Agustus', '08'],
  ['September', '09'], ['Oktober', '10'], ['November', '11'], ['Desember', '12'],
]) {
  cek(`Indonesia: ${bulan}`, bacaTanggalTerbit(halaman(`1 ${bulan} 2026`)).tanggalTerbitISO === `2026-${angka}-01`)
}
for (const [bulan, angka] of [
  ['January', '01'], ['February', '02'], ['March', '03'], ['May', '05'],
  ['June', '06'], ['July', '07'], ['August', '08'], ['October', '10'],
  ['December', '12'],
]) {
  cek(`Inggris: ${bulan}`, bacaTanggalTerbit(halaman(`1 ${bulan} 2026`)).tanggalTerbitISO === `2026-${angka}-01`)
}
// Singkatan tiga huruf yang benar-benar muncul di sumber
cek('singkatan May', bacaTanggalTerbit(halaman('28 May 2024')).tanggalTerbitISO === '2024-05-28')
cek('singkatan Oct', bacaTanggalTerbit(halaman('13 Oct 2024')).tanggalTerbitISO === '2024-10-13')
cek('singkatan Jun', bacaTanggalTerbit(halaman('24 Jun 2025')).tanggalTerbitISO === '2025-06-24')

console.log('\n== yang TIDAK ada tanggalnya: null, bukan tebakan ==')
for (const [nama, html] of [
  ['halaman tanpa datePublished', '<html><body><p>tidak ada tanggal</p></body></html>'],
  ['datePublished kosong', '<div itemprop="datePublished"></div>'],
  ['datePublished hanya spasi', '<div itemprop="datePublished">   </div>'],
  ['string kosong', ''],
  ['null', null],
  ['undefined', undefined],
  ['angka', 12345],
  ['objek', {}],
]) {
  const h = bacaTanggalTerbit(html)
  cek(`${nama} -> null`, h.tanggalTerbitISO === null && h.tanggalTerbit === null,
    `dapat ${JSON.stringify(h)}`)
}

console.log('\n== tanggal ngawur DITOLAK (tidak boleh merusak urutan) ==')
for (const [nama, mentah] of [
  ['bulan tak dikenal', '24 Foo 2025'],
  ['hari 0', '0 Jun 2025'],
  ['hari 32', '32 Jun 2025'],
  ['31 Februari (meluap)', '31 Feb 2025'],
  ['30 Februari (meluap)', '30 Feb 2024'],
  ['tahun terlalu tua', '24 Jun 1999'],
  ['tahun terlalu jauh', '24 Jun 2101'],
  ['tanpa tahun', '24 Jun'],
  ['format ISO (bukan format sumber)', '2025-06-24'],
  ['teks bebas', 'kemarin sore'],
]) {
  const h = bacaTanggalTerbit(halaman(mentah))
  cek(`${nama} -> ISO null`, h.tanggalTerbitISO === null, `dapat ${h.tanggalTerbitISO}`)
  // Teks aslinya TETAP disimpan: itu bukti apa yang tertulis di sumber.
  cek(`${nama} -> teks asli tetap ada`, h.tanggalTerbit === mentah, `dapat ${h.tanggalTerbit}`)
}

console.log('\n== 29 Februari: tahun kabisat diterima, bukan kabisat ditolak ==')
cek('29 Feb 2024 (kabisat) diterima', bacaTanggalTerbit(halaman('29 Feb 2024')).tanggalTerbitISO === '2024-02-29')
cek('29 Feb 2025 (bukan kabisat) ditolak', bacaTanggalTerbit(halaman('29 Feb 2025')).tanggalTerbitISO === null)

console.log('\n== urutkanTerbaru ==')
const p = (slug, iso) => ({ slug, tanggalTerbitISO: iso })
const urut = urutkanTerbaru([
  p('tua', '2023-11-24'),
  p('baru', '2026-05-05'),
  p('tengah', '2025-06-24'),
  p('tanpa', null),
])
cek('terbaru di depan', urut[0].slug === 'baru', urut.map((x) => x.slug).join(','))
cek('tengah di tengah', urut[1].slug === 'tengah')
cek('tua di belakang', urut[2].slug === 'tua')
cek('tanpa tanggal paling belakang', urut[3].slug === 'tanpa')
cek('semua item dipertahankan (tidak ada yang dibuang)', urut.length === 4)

// Urutan sumber HARUS dipertahankan saat tanggalnya sama — kalau tidak,
// hasilnya berubah-ubah antar pemanggilan dan tampilan terlihat acak.
const seri = urutkanTerbaru([p('a', '2024-05-22'), p('b', '2024-05-22'), p('c', '2024-05-22')])
cek('tanggal sama -> urutan sumber dipertahankan', seri.map((x) => x.slug).join(',') === 'a,b,c')
const seriTanpa = urutkanTerbaru([p('x', null), p('y', null), p('z', null)])
cek('tanpa tanggal -> urutan sumber dipertahankan', seriTanpa.map((x) => x.slug).join(',') === 'x,y,z')

cek('pool kosong', urutkanTerbaru([]).length === 0)
cek('tanpa argumen tidak melempar', (() => { try { urutkanTerbaru(); return true } catch { return false } })())
cek('tidak mengubah array aslinya', (() => {
  const asli = [p('tua', '2023-01-01'), p('baru', '2026-01-01')]
  urutkanTerbaru(asli)
  return asli[0].slug === 'tua'
})())

console.log('\n== susun() — urutkan DULU, baru putar ==')
const buat = (slug, iso) => ({
  slug,
  url: `https://ayosehat.kemkes.go.id/${slug}`,
  judul: `Artikel ${slug} Tentang Kesehatan`,
  ringkas: `Ringkasan artikel ${slug} yang cukup panjang untuk dipakai.`,
  tubuh:
    `Tubuh artikel ${slug} ini menjelaskan hal penting untuk dibaca. ` +
    `Kalimat kedua berisi nasihat yang bisa langsung dicoba. ` +
    `Kalimat ketiga menutup penjelasan dengan satu saran praktis.`,
  gambar: '',
  tanggalTerbitISO: iso,
  tanggalTerbit: iso,
})

// Bentuk masalah yang NYATA: urutan sumber tidak mencerminkan kebaruan.
// Artikel termuda sengaja ditaruh paling belakang — persis seperti halaman
// depan Kemenkes saat keluhan ini muncul.
const pool = [
  buat('rokok', '2024-05-28'),
  buat('stunting', '2024-05-22'),
  buat('kardiovaskular', '2024-05-22'),
  buat('malaria', '2024-05-16'),
  buat('jantung', '2024-05-02'),
  buat('mental', '2024-04-06'),
  buat('label-gizi', '2026-05-05'), // TERMUDA, tapi paling belakang di sumber
  buat('diabetes', '2025-06-24'),
  buat('menyusui', '2023-11-24'),
]

const nol = susun(pool, 0)
cek('geser 0 -> artikel termuda tampil pertama',
  nol.artikel[0].id === 'label-gizi', `dapat ${nol.artikel[0]?.id}`)
cek('geser 0 -> artikel tertua tidak tampil',
  !nol.artikel.some((a) => a.id === 'menyusui'))
cek('tanggalTerbit ikut terkirim ke antarmuka',
  nol.artikel[0].tanggalTerbitISO === '2026-05-05', `dapat ${nol.artikel[0]?.tanggalTerbitISO}`)
cek('tanggalTerbitISO dan tanggalTerbit dua-duanya ada',
  Boolean(nol.artikel[0].tanggalTerbit) && Boolean(nol.artikel[0].tanggalTerbitISO))

// Rotasi TETAP membalik urutan — itu tujuannya, jangan diuji sebagai monoton.
// Yang WAJIB dijaga: semua yang tampil berasal dari JENDELA artikel terbaru.
// Jendela = 8 artikel termuda (lihat JENDELA_ROTASI di konten.js). Pool uji ini
// berisi 9 artikel, jadi tepat satu artikel (tertua, 2023) berada di luar.
const jendela8 = new Set(
  [...pool]
    .sort((a, b) => (a.tanggalTerbitISO < b.tanggalTerbitISO ? 1 : -1))
    .slice(0, 8)
    .map((x) => x.slug),
)
for (let g = 1; g <= 8; g++) {
  const h = susun(pool, g)
  const ids = h.artikel.map((a) => a.id)
  cek(`geser ${g}: 4 artikel`, h.artikel.length === 4, ids.join(','))
  cek(`geser ${g}: semuanya dari jendela 8 terbaru`,
    ids.every((id) => jendela8.has(id)), ids.join(','))
}

// Cacat yang dilaporkan jagi: artikel 2023 (1066 hari) tampil sebagai bacaan
// utama. Dengan jendela rotasi, itu tidak boleh terjadi pada putaran mana pun.
let dilanggar = 0
let totalTampil = 0
for (let g = 0; g < 40; g++) {
  const h = susun(pool, g)
  totalTampil += h.artikel.length
  if (h.artikel.some((a) => a.id === 'menyusui')) dilanggar += 1
}
cek('geser 0..39: artikel 2023 tidak pernah tampil sama sekali', dilanggar === 0, `${dilanggar} kali`)
cek('geser 0..39: tetap ada artikel yang tampil (tidak kosong)', totalTampil > 0)

// Rotasi harus benar-benar memutar di dalam jendela — kalau tidak, jendela
// ini sama saja mematikan fitur rotasi yang sudah ada.
const awal = susun(pool, 0).artikel.map((a) => a.id).join(',')
const putar = susun(pool, 1).artikel.map((a) => a.id).join(',')
cek('rotasi masih memutar (geser 1 beda dari geser 0)', awal !== putar, `${awal} vs ${putar}`)
cek('rotasi kembali ke awal setelah 8 putaran',
  susun(pool, 8).artikel.map((a) => a.id).join(',') === awal)

console.log('\n== artikel tanpa tanggal tidak pernah di depan ==')
const campur = [
  buat('tanpa-tanggal', null),
  buat('bertanggal-lama', '2023-01-01'),
]
const h2 = susun(campur, 0)
cek('artikel bertanggal di depan', h2.artikel[0].id === 'bertanggal-lama', h2.artikel[0]?.id)
cek('artikel tanpa tanggal tetap tampil (tidak dibuang)', h2.artikel.some((a) => a.id === 'tanpa-tanggal'))
cek('artikel tanpa tanggal -> tanggalTerbit null', (() => {
  const a = h2.artikel.find((x) => x.id === 'tanpa-tanggal')
  return a.tanggalTerbit === null && a.tanggalTerbitISO === null
})())

console.log('\n== susun() tanpa tanggal sama sekali: perilaku lama tidak berubah ==')
const tanpaTgl = [1, 2, 3, 4, 5, 6, 7, 8].map((i) => ({
  ...buat(`lama-${i}`, null),
  judul: `Artikel Nomor ${i} Tentang Kesehatan`,
}))
cek('geser 0 -> urutan sumber', susun(tanpaTgl, 0).topik.map((t) => t.id).join(',') ===
  'lama-1,lama-2,lama-3,lama-4,lama-5')
cek('geser 1 -> bergeser satu', susun(tanpaTgl, 1).topik[0].id === 'lama-2')
cek('geser 8 == geser 0', susun(tanpaTgl, 8).topik.map((t) => t.id).join(',') ===
  susun(tanpaTgl, 0).topik.map((t) => t.id).join(','))
cek('geser negatif aman', susun(tanpaTgl, -1).topik.length === 5)

console.log('\n== pool campuran tanggal & tanpa tanggal tetap 5/4/1 ==')
const campurBanyak = [
  ...tanpaTgl.slice(0, 3),
  buat('a', '2026-01-01'),
  buat('b', '2025-01-01'),
  buat('c', '2024-01-01'),
  buat('d', '2023-01-01'),
  buat('e', '2022-01-01'),
]
const h3 = susun(campurBanyak, 2)
cek('5 topik', h3.topik.length === 5)
cek('4 artikel', h3.artikel.length === 4)
cek('ada tips', Boolean(h3.tips))

console.log(`\n${lulus} lulus, ${gagal} gagal`)
process.exit(gagal ? 1 : 0)
