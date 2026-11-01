#!/usr/bin/env node
/**
 * Uji pengurai daftar konten harian — TANPA jaringan.
 *
 * KENAPA ADA (1 Nov 2026). Sumber konten harian berganti dari halaman depan
 * `ayosehat.kemkes.go.id` (yang berhenti menerbitkan sejak 05 May 2026) ke
 * kanal **rilis berita** Kemenkes + kanal kesehatan **CNN Indonesia**. Bentuk
 * HTML kedua sumber itu berbeda jauh, dan keduanya TIDAK punya tanda
 * `itemprop="datePublished"` yang dulu jadi satu-satunya jalan membaca tanggal.
 *
 * Yang dijaga uji ini:
 *   1. Kartu rilis berita Kemenkes terbaca lengkap: judul, tautan, thumbnail
 *      (jadi URL absolut), dan tanggal dari `<time datetime>`.
 *   2. Kartu CNN terbaca lengkap: judul, tautan, thumbnail, dan tanggal dari
 *      cap waktu di URL-nya (`YYYYMMDDHHMMSS`).
 *   3. Tautan yang BUKAN artikel (paginasi, kategori, breadcrumb) tidak ikut.
 *   4. Tanggal ngawur tetap DITOLAK, termasuk bentuk ISO (31 Feb).
 *   5. `susun()` menuliskan penerbit yang BENAR per kartu — kartu CNN tidak
 *      boleh berlabel "Kemenkes RI".
 *
 * Semua contoh HTML di bawah disalin dari bentuk halaman sumber yang diukur
 * 1 Nov 2026 (dipendekkan, tapi strukturnya sama).
 */

import { uraiDaftarKemkes, uraiDaftarCnn, bacaTanggalTerbit, susun, uraiParagrafArtikel } from './app/server/konten.js'

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

/* ---------------------------------------------------- contoh HTML sumber -- */

const HALAMAN_KEMKES = `
<main id="konten-utama">
  <nav aria-label="breadcrumb"><ol class="breadcrumb">
    <li class="breadcrumb-item"><a href="/id/home">HOME</a></li>
    <li class="breadcrumb-item"><a href="/id/media/all">MEDIA</a></li>
  </ol></nav>
  <div class="row">
    <div class="col-md-4 mb-4">
      <a href="/id/kemenkes-dorong-penguatan-kompetensi-dan-pemerataan-tenaga-kesehatan" class="link">
        <div class="card" style="min-height: 316px;">
          <div class="image-rect">
            <img src="/app_asset/image_content/17933671816ae49c8d4f80e0.51253731.jpg" class="img-responsive">
          </div>
          <div class="card-body">
            <h4 class="text-20">Kemenkes Dorong Penguatan Kompetensi dan Pemerataan Tenaga Kesehatan</h4>
            <div class="artikel-meta">
              <div class="meta-item mt-0">
                <i class="ico ico-calendar"></i>  <time datetime="2026-10-30"><em>30 Oct 2026</em></time>
              </div>
              <div class="meta-item mt-0"><i class="ico ico-visitor"></i> 929</div>
            </div>
          </div>
        </div>
      </a>
    </div>
    <div class="col-md-4 mb-4">
      <a href="/id/kemenkes-perluas-imunisasi-hpv-cegah-kanker-sejak-dini" class="link">
        <div class="card">
          <div class="image-rect">
            <img src="/app_asset/image_content/1793000000000000000000.11111111.jpg" class="img-responsive">
          </div>
          <div class="card-body">
            <h4 class="text-20">Kemenkes Perluas Imunisasi HPV, Cegah Kanker Sejak Dini</h4>
            <time datetime="2026-10-29"><em>29 Oct 2026</em></time>
          </div>
        </div>
      </a>
    </div>
  </div>
  <div class="pagination">
    <a href="https://kemkes.go.id/id/category/rilis-berita/2">2</a>
    <a href="/id/category/rilis-berita/3" class="page-link">3</a>
  </div>
</main>`

const HALAMAN_CNN = `
<div class="headline">
  <a class="flex group" href="https://www.cnnindonesia.com/gaya-hidup/20261030173456-255-1421570/apakah-stevia-aman-dikonsumsi-sebagai-pengganti-gula-pasir" dtr-evt="headline" dtr-id="1421570" dtr-ttl="Apakah Stevia Aman Dikonsumsi sebagai Pengganti Gula Pasir?" dtr-idx="1">
    <span class="flex-grow">
      <span class="text-2xl font-medium inline group-hover:text-cnn_red">Apakah Stevia Aman Dikonsumsi sebagai Pengganti Gula Pasir?</span>
      <span class="text-xs text-cnn_red block mt-2 label">Gaya Hidup</span>
    </span>
    <span class="flex-none w-[498px] overflow-hidden">
      <img class="object-cover w-full" src="https://akcdn.detik.net.id/visual/2021/08/31/pemanis-stevia_43.jpeg?w=500&amp;q=90" alt="Stevia" />
    </span>
  </a>
</div>
<div class="nhl-list">
  <article class="flex-grow">
    <a aria-label="link description" class="flex group items-center gap-4"
       href="https://www.cnnindonesia.com/gaya-hidup/20261101121607-255-1421965/hamil-jangan-abaikan-kesehatan-gigi-dan-mental"
       dtr-evt="box artikel terbaru" dtr-id="1421965"
       dtr-ttl="Hamil, Jangan Abaikan Kesehatan Gigi dan Mental">
      <span class="flex-none overflow-hidden block relative w-[270px]">
        <img class="object-cover w-full" src="https://akcdn.detik.net.id/visual/2021/08/04/ilustrasi-vaksin-ibu-hamil_169.jpeg?w=280&amp;q=90" alt="Ibu hamil" />
      </span>
    </a>
  </article>
  <article class="flex-grow">
    <a class="flex group items-center gap-4"
       href="https://www.cnnindonesia.com/gaya-hidup/20261101121607-255-1421965/hamil-jangan-abaikan-kesehatan-gigi-dan-mental"
       dtr-ttl="Hamil, Jangan Abaikan Kesehatan Gigi dan Mental">
      <img src="https://akcdn.detik.net.id/visual/2021/08/04/ilustrasi-vaksin-ibu-hamil_169.jpeg" alt="dobel" />
    </a>
  </article>
</div>`

/* ------------------------------------------------------- Kemenkes listing -- */

console.log('== uraiDaftarKemkes — rilis berita ==')
const kemkes = uraiDaftarKemkes(HALAMAN_KEMKES)
cek('dua artikel terbaca (paginasi & breadcrumb tidak ikut)', kemkes.length === 2, `dapat ${kemkes.length}`)
cek(
  'judul pertama utuh',
  kemkes[0]?.judul === 'Kemenkes Dorong Penguatan Kompetensi dan Pemerataan Tenaga Kesehatan',
  kemkes[0]?.judul,
)
cek(
  'tautan jadi URL absolut',
  kemkes[0]?.url ===
    'https://kemkes.go.id/id/kemenkes-dorong-penguatan-kompetensi-dan-pemerataan-tenaga-kesehatan',
  kemkes[0]?.url,
)
cek(
  'thumbnail jadi URL absolut',
  kemkes[0]?.gambar ===
    'https://kemkes.go.id/app_asset/image_content/17933671816ae49c8d4f80e0.51253731.jpg',
  kemkes[0]?.gambar,
)
cek('tanggal ISO dari <time datetime>', kemkes[0]?.tanggalTerbitISO === '2026-10-30', kemkes[0]?.tanggalTerbitISO)
cek('tanggal tampil apa adanya dari sumber', kemkes[0]?.tanggalTerbit === '30 Oct 2026', kemkes[0]?.tanggalTerbit)
cek('penerbit Kemenkes RI', kemkes.every((d) => d.penerbit === 'Kemenkes RI'))
cek('slug diberi awalan sumber (tidak bentrok dengan CNN)', kemkes[0]?.slug.startsWith('kemkes:'))
cek('artikel kedua juga lengkap', kemkes[1]?.tanggalTerbitISO === '2026-10-29')

cek('halaman kosong tidak melempar', uraiDaftarKemkes('').length === 0)
cek('null tidak melempar', uraiDaftarKemkes(null).length === 0)
cek(
  'kartu tanpa <h4> dilewati',
  uraiDaftarKemkes('<a href="/id/judul-panjang-sekali" class="link"><div class="card"></div></a>')
    .length === 0,
)

/* ------------------------------------------------------------ CNN listing -- */

console.log('== uraiDaftarCnn — kanal kesehatan ==')
const cnn = uraiDaftarCnn(HALAMAN_CNN)
cek('dua artikel unik (duplikat dibuang)', cnn.length === 2, `dapat ${cnn.length}`)
cek(
  'judul dari atribut dtr-ttl',
  cnn[0]?.judul === 'Apakah Stevia Aman Dikonsumsi sebagai Pengganti Gula Pasir?',
  cnn[0]?.judul,
)
cek(
  'tautan CNN utuh',
  cnn[0]?.url ===
    'https://www.cnnindonesia.com/gaya-hidup/20261030173456-255-1421570/apakah-stevia-aman-dikonsumsi-sebagai-pengganti-gula-pasir',
  cnn[0]?.url,
)
cek('tanggal dari cap waktu URL', cnn[0]?.tanggalTerbitISO === '2026-10-30', cnn[0]?.tanggalTerbitISO)
cek('tanggal tampil disusun dari ISO', cnn[0]?.tanggalTerbit === '30 Oct 2026', cnn[0]?.tanggalTerbit)
cek('thumbnail terbaca', String(cnn[0]?.gambar).startsWith('https://akcdn.detik.net.id/'), cnn[0]?.gambar)
cek('penerbit CNN Indonesia', cnn.every((d) => d.penerbit === 'CNN Indonesia'))
cek('artikel terbaru terbaca 1 Nov 2026', cnn[1]?.tanggalTerbitISO === '2026-11-01', cnn[1]?.tanggalTerbitISO)
cek('slug CNN memakai bagian akhir URL', cnn[0]?.slug.startsWith('cnn:'))
cek(
  'URL non-artikel (tanpa cap waktu) dilewati',
  uraiDaftarCnn(
    '<a href="https://www.cnnindonesia.com/gaya-hidup/indeks">Indeks</a>',
  ).length === 0,
)

/* --------------------------------------------------------- tanggal (ISO) -- */

console.log('== bacaTanggalTerbit — bentuk ISO ==')
const dariTime = bacaTanggalTerbit('<time datetime="2026-10-30"><em>30 Oct 2026</em></time>')
cek('ISO dari <time>: tanggal terisi', dariTime.tanggalTerbitISO === '2026-10-30', dariTime.tanggalTerbitISO)
cek('ISO dari <time>: teks sumber dipakai', dariTime.tanggalTerbit === '30 Oct 2026', dariTime.tanggalTerbit)

const dariJsonLd = bacaTanggalTerbit('{"@type":"NewsArticle","datePublished":"2026-11-01T08:10:02+07:00"}')
cek('ISO dari JSON-LD terbaca', dariJsonLd.tanggalTerbitISO === '2026-11-01', dariJsonLd.tanggalTerbitISO)
cek('teks disusun dari ISO', dariJsonLd.tanggalTerbit === '01 Nov 2026', dariJsonLd.tanggalTerbit)

cek(
  '<time> tanpa isi teks: teks disusun dari ISO',
  bacaTanggalTerbit('<time datetime="2026-10-30"></time>').tanggalTerbit === '30 Oct 2026',
)

console.log('== bacaTanggalTerbit — tanggal ngawur tetap ditolak ==')
for (const [nama, html] of [
  ['31 Feb', '<time datetime="2026-02-31"><em>31 Feb 2026</em></time>'],
  ['bulan 13', '<time datetime="2026-13-01"><em>13 Jan 2026</em></time>'],
  ['tahun 1990', '<time datetime="1990-05-01"><em>01 May 1990</em></time>'],
  ['JSON-LD 31 Feb', '{"datePublished":"2026-02-31T00:00:00+07:00"}'],
]) {
  const h = bacaTanggalTerbit(html)
  cek(`${nama} ditolak`, h.tanggalTerbitISO === null, `dapat ${h.tanggalTerbitISO}`)
}

console.log('== bacaTanggalTerbit — bentuk teks lama masih jalan ==')
cek(
  'itemprop datePublished (ayosehat) tetap dikenali',
  bacaTanggalTerbit('<div itemprop="datePublished">24 Jun 2025</div>').tanggalTerbitISO === '2025-06-24',
)

/* ------------------------------------------------- penerbit per kartu susun -- */

console.log('== susun — penerbit mengikuti sumber tiap artikel ==')
const pool = [
  {
    slug: 'cnn:a',
    url: 'https://www.cnnindonesia.com/gaya-hidup/20261101121607-255-1/a',
    judul: 'Studi: Jus Cranberry Bisa Tekan Pertumbuhan Plak Gigi',
    penerbit: 'CNN Indonesia',
    ringkas: 'Ringkasan CNN yang cukup panjang untuk lolos penyaring ringkasan.',
    tubuh:
      'Studi terbaru menyebut jus cranberry bisa menekan pertumbuhan plak gigi pada orang dewasa. ' +
      'Peneliti menyarankan minum tanpa tambahan gula supaya manfaatnya tetap terjaga.',
    tanggalTerbit: '01 Nov 2026',
    tanggalTerbitISO: '2026-11-01',
  },
  {
    slug: 'kemkes:b',
    url: 'https://kemkes.go.id/id/b',
    judul: 'Kemenkes Perluas Imunisasi HPV, Cegah Kanker Sejak Dini',
    penerbit: 'Kemenkes RI',
    ringkas: 'Ringkasan Kemenkes yang cukup panjang untuk lolos penyaring ringkasan.',
    tubuh:
      'Kemenkes memperluas cakupan imunisasi HPV untuk mencegah kanker serviks sejak dini. ' +
      'Program ini menyasar anak perempuan usia sekolah di seluruh provinsi.',
    tanggalTerbit: '29 Oct 2026',
    tanggalTerbitISO: '2026-10-29',
  },
]
const hasil = susun(pool, 0)
cek('dua artikel tampil', hasil.artikel.length === 2, `dapat ${hasil.artikel.length}`)
cek('kartu CNN berlabel CNN Indonesia', hasil.artikel[0]?.source === 'CNN Indonesia', hasil.artikel[0]?.source)
cek('kartu Kemenkes berlabel Kemenkes RI', hasil.artikel[1]?.source === 'Kemenkes RI', hasil.artikel[1]?.source)
cek('artikel terbaru tampil lebih dulu', hasil.artikel[0]?.tanggalTerbitISO === '2026-11-01')
cek(
  'penerbit gabungan disebut apa adanya',
  hasil.penerbit === 'CNN Indonesia & Kemenkes RI',
  hasil.penerbit,
)
cek('sumberHalaman memuat dua sumber', Array.isArray(hasil.sumberHalaman) && hasil.sumberHalaman.length === 2)
cek('tips tetap dari artikel sumber', Boolean(hasil.tips))

/* ---------------------------------------------------- label topik (chip) -- */

console.log('== susun — label topik tidak boleh kosong ==')
// Judul siaran pers yang membuka dengan "Menkes: …" pernah menghasilkan label
// KOSONG: prefiks dibuang lebih dulu, lalu sisa judulnya terpotong di tanda
// titik dua sampai habis. Chip tanpa tulisan terlihat seperti kerusakan.
const labelPool = [
  {
    slug: 'kemkes:menkes',
    url: 'https://kemkes.go.id/id/menkes',
    judul: 'Menkes: Perluasan Akses Layanan Kesehatan Harus Diiringi Peningkatan Kompetensi',
    penerbit: 'Kemenkes RI',
    ringkas: 'Ringkasan yang cukup panjang untuk lolos penyaring ringkasan konten.',
    tubuh:
      'Perluasan akses layanan kesehatan harus diiringi peningkatan kompetensi tenaga medis. ' +
      'Kebijakan ini berlaku di seluruh fasilitas kesehatan milik pemerintah daerah.',
    tanggalTerbit: '30 Oct 2026',
    tanggalTerbitISO: '2026-10-30',
  },
  {
    slug: 'kemkes:wamenkes',
    url: 'https://kemkes.go.id/id/wamenkes',
    judul: 'Wamenkes Dorong Penguatan Standar Kompetensi Tenaga Medis di Era Digital',
    penerbit: 'Kemenkes RI',
    ringkas: 'Ringkasan yang cukup panjang untuk lolos penyaring ringkasan konten.',
    tubuh:
      'Wamenkes mendorong penguatan standar kompetensi tenaga medis di era digital. ' +
      'Penguatan itu mencakup pemanfaatan teknologi dan pengawasan mutu layanan.',
    tanggalTerbit: '29 Oct 2026',
    tanggalTerbitISO: '2026-10-29',
  },
]
const labelHasil = susun(labelPool, 0)
cek('tidak ada label topik kosong', labelHasil.topik.every((x) => x.label.trim().length > 0), JSON.stringify(labelHasil.topik.map((x) => x.label)))
cek(
  'prefiks "Menkes:" tidak ikut jadi label',
  !/^menkes/i.test(labelHasil.topik[0]?.label ?? ''),
  labelHasil.topik[0]?.label,
)
cek(
  'prefiks "Wamenkes" tidak ikut jadi label',
  !/^wamenkes/i.test(labelHasil.topik[1]?.label ?? ''),
  labelHasil.topik[1]?.label,
)

/* ---------------------------------------- saringan paragraf bukan-prosa -- */

// Bentuk yang diukur di cnnindonesia.com (1 Nov 2026). Paragraf pertama itu
// NYATA ada di halaman: tempelan skrip 1.740 karakter yang dulu lolos karena
// saringannya hanya memeriksa panjang. Akibatnya kartu menampilkan butir
// "URL berhasil disalin Ilustrasi." — terlihat seperti aplikasi rusak.
const halamanKotor = `
  <p>Komentar URL berhasil disalin document.addEventListener("DOMContentLoaded", function () { var navTitleBar = document.getElementById("navbar-article-title"); var t = 1; });</p>
  <p>Stevia sudah lama dipakai sebagai pemanis pengganti gula pasir. Tanaman ini berasal dari Amerika Selatan dan telah diteliti sejak puluhan tahun lalu.</p>
  <p>Ilustrasi. Stevia kerap dianggap lebih sehat daripada gula pasir.</p>
  <p>URL berhasil disalin</p>
  <p>Bagikan</p>
  <p>Konsumsi stevia dalam jumlah wajar tidak dilaporkan menimbulkan efek samping berarti pada orang dewasa yang sehat.</p>
`
const bersih = uraiParagrafArtikel(halamanKotor)
cek('paragraf tempelan skrip dibuang', !bersih.some((p) => /addEventListener|querySelector/i.test(p)))
cek('label "URL berhasil disalin" dibuang', !bersih.some((p) => /url berhasil disalin/i.test(p)))
cek('keterangan gambar "Ilustrasi." dibuang', !bersih.some((p) => /^ilustrasi\./i.test(p)))
cek('label "Bagikan" dibuang', !bersih.some((p) => /^bagikan$/i.test(p)))
cek('paragraf prosa tetap dipertahankan', bersih.length === 2, `dapat ${bersih.length}: ${JSON.stringify(bersih.map((p) => p.slice(0, 30)))}`)
cek(
  'butir hasil saringan bukan sampah antarmuka',
  bersih.every((p) => !/berhasil disalin|^ilustrasi\./i.test(p)),
  JSON.stringify(bersih),
)

/* ------------------------------------------------------------------ tutup -- */

console.log('')
console.log(gagal === 0 ? `SEMUA LULUS — ${lulus} pemeriksaan` : `${lulus} lulus, ${gagal} GAGAL`)
process.exit(gagal === 0 ? 0 : 1)
