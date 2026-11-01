/**
 * Konten harian: topik populer, artikel, dan tips kesehatan.
 *
 * Sumber (sejak 1 Nov 2026): kanal **rilis berita** Kemenkes RI
 * (`kemkes.go.id/id/category/rilis-berita`) dan kanal kesehatan **CNN
 * Indonesia** (`cnnindonesia.com/gaya-hidup/kesehatan`). Keduanya berbahasa
 * Indonesia, menerbitkan rutin, setiap artikel punya tautan asli yang bisa
 * dibuka pengguna, dan gambarnya tersedia.
 *
 * Sumber sebelumnya `ayosehat.kemkes.go.id` berhenti menerbitkan (artikel
 * termuda 05 May 2026) — lihat catatan di konstanta `SUMBER`.
 *
 * Kenapa tidak memakai "artikel terpopuler" Wikipedia: uji coba menunjukkan
 * daftar teratas Wikipedia Indonesia didominasi hiburan dan politik, dan
 * penyaringan kata kunci kesehatan justru salah tangkap (mis. "Pasma Royce"
 * ikut lolos karena memuat "asma").
 *
 * ==========================================================================
 * ALUR — mengikuti mermaid-diagram.png
 * ==========================================================================
 *
 *      Waktunya Pencarian Berikutnya?
 *            |Tidak          |Ya
 *            |               v
 *            |          Tunggu 1 Hari
 *            |               |
 *            |               v
 *            |          Cari Informasi
 *            |               |
 *            |               v
 *            |       Ada Informasi Terbaru?
 *            |         |Ya           |Tidak
 *            |         v             |
 *            |   Update Informasi    |
 *            |         |             |
 *            v         v             |
 *         Tunggu 1 Hari <------------+
 *
 * Artinya di dalam kode:
 *   1. Pengecekan hanya dilakukan sekali sehari — lihat `waktunyaCek`.
 *   2. Setiap pengecekan, sumbernya dicari ulang.
 *   3. Hasilnya dibandingkan dengan yang sudah tersimpan lewat SIDIK JARI isi.
 *   4. TIDAK ada informasi terbaru -> konten TIDAK diubah. Yang dicatat hanya
 *      "terakhir diperiksa". Tanggal "diperbarui" tetap, karena memang belum
 *      ada yang berubah.
 *   5. ADA informasi terbaru -> barulah konten diperbarui.
 *
 * Dengan begitu halaman tidak pernah menampilkan tanggal pembaruan yang
 * seolah-olah berubah padahal isinya sama saja.
 *
 * Kalau sumber sedang tidak bisa diakses, konten yang sudah tersimpan tetap
 * dipakai; kalau belum ada sama sekali, pemanggil memakai konten bawaan
 * aplikasi (lihat src/data/dummy.js).
 */

import { readFile, writeFile, mkdir } from 'node:fs/promises'
import { existsSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

import { potongKalimat, butirDari } from './teks.js'
import { catatJamServer, jamSekarang, selisihJam, jamInternetTerbaca } from './jam.js'
import { simpanKonten } from './db.js'

const UA =
  'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120 Safari/537.36'

/**
 * Sumber konten harian.
 *
 * KENAPA BERGANTI (1 Nov 2026). Sumber lama `ayosehat.kemkes.go.id` berhenti
 * menerbitkan: artikel termudanya 05 May 2026, dan halaman depannya tidak
 * pernah berubah lagi. Akibatnya kartu artikel dan lonceng pemberitahuan
 * menampilkan "terbit 5 Mei 2026" berbulan-bulan — padahal kanal rilis berita
 * Kemenkes pada tanggal yang sama sudah menerbitkan sampai 30 Okt 2026.
 * Diukur 1 Nov 2026: `kemkes.go.id/id/category/rilis-berita` menjawab HTTP 200
 * (catatan lama menyebut 404 — sudah tidak berlaku), lengkap dengan
 * `<time datetime>`, thumbnail, dan paginasi.
 *
 * Sumber kedua CNN Indonesia ditambahkan 1 Nov 2026 supaya kartu artikel ikut
 * berita kesehatan terkini, bukan hanya siaran pers resmi. Alamat yang BENAR
 * adalah `/gaya-hidup/kesehatan` — `/kesehatan` dan `/kesehatan/rss` menjawab
 * 404.
 */
const SUMBER = 'https://kemkes.go.id/id/category/rilis-berita'
const SUMBER_CNN = 'https://www.cnnindonesia.com/gaya-hidup/kesehatan'
const PENERBIT = 'Kemenkes RI'
const PENERBIT_CNN = 'CNN Indonesia'
/** Jumlah halaman daftar rilis berita yang diambil (tiap halaman ±9 butir). */
const HALAMAN_SUMBER = 2
const BERLAKU_MS = 24 * 60 * 60 * 1000 // sekali sehari
const MAKS_POOL = 40 // batas artikel yang disimpan di simpanan

/**
 * Berapa artikel yang diambil ISI-nya (bukan cuma judul) setiap kali
 * menyegarkan.
 *
 * KENAPA DIBATASI: dulu SELURUH pool diambil isinya sekaligus — sampai 40
 * permintaan ke situs Kemenkes dalam satu tarikan. Padahal tampilan hanya
 * memakai 5 topik, 4 artikel, dan 1 tips (lihat `susun()`). Di serverless ini
 * terasa sekali: berkas cache tidak bisa ditulis (lihat catatan di
 * `simpanKeDisk`), jadi setiap instance baru mengulang pengambilan itu.
 *
 * Pengukuran: 12 permintaan pada cache kosong (1 daftar + 11 isi artikel).
 * Angka itu naik terus seiring pool bertambah, sampai batas atas 40.
 *
 * Angka 12 dipilih dari kebutuhan nyata `susun()`: 5 topik + 4 artikel
 * (beririsan) + 1 calon tips, ditambah cadangan untuk artikel yang gagal
 * diambil. Kandidatnya DIURUTKAN MENURUT TANGGAL TERBIT lebih dulu, jadi
 * jatah ini selalu jatuh ke artikel terbaru dari SEMUA sumber — bukan hanya
 * sumber yang kebetulan diambil pertama. Tanpa pengurutan itu, 8 jatah habis
 * oleh satu sumber saja dan sumber kedua tidak pernah punya isi (lalu
 * tersaring habis oleh `susun()`).
 */
const MAKS_DETAIL = 12

/**
 * Naikkan angka ini kalau BENTUK data artikel berubah, supaya isi simpanan
 * lama diambil ulang.
 *
 * KENAPA PERLU: `kontenHarian()` hanya mengambil isi artikel yang belum punya
 * `ringkas`/`tubuh` (lihat `if (d.ringkas || d.tubuh) return`). Jadi artikel
 * yang sudah tersimpan TIDAK PERNAH diambil ulang — dan kolom baru yang
 * ditambahkan belakangan akan selamanya kosong pada artikel lama.
 *
 * Sudah terjadi 25 Okt 2026: `tanggalTerbit` ditambahkan, tapi seluruh pool
 * di cache masih dari bentuk lama, sehingga tanggalnya kosong semua padahal
 * datanya ada di sumber. Menaikkan versi ini memaksa satu pengambilan ulang
 * penuh, sekali, saat build/instance baru mulai.
 *
 * 1 Nov 2026 — naik ke 4: `uraiParagrafArtikel()` sekarang membuang paragraf
 * yang bukan prosa (tempelan skrip & keterangan gambar). Tanpa kenaikan versi,
 * teks kotor "URL berhasil disalin Ilustrasi." tetap tersimpan di cache dan
 * tetap tampil di kartu.
 */
const VERSI_BENTUK = 4


/* ------------------------------------------------------------------ util -- */

async function ambil(url, timeoutMs = 15000) {
  const res = await fetch(url, {
    headers: { 'User-Agent': UA, 'Accept-Language': 'id,en;q=0.8' },
    signal: AbortSignal.timeout(timeoutMs),
    redirect: 'follow',
  })
  if (!res.ok) throw new Error(`HTTP ${res.status}`)
  const teks = await res.text()
  catatJamServer(res)
  return teks
}

function buangTag(s) {
  return String(s ?? '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&#39;|&apos;/g, "'")
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/\s+/g, ' ')
    .trim()
}

/* --------------------------------------------------------- tanggal terbit -- */

/**
 * Nama bulan yang dipakai halaman Kemenkes. Campur: ada yang bahasa Indonesia
 * ("Desember", "Mei") dan ada yang Inggris ("May", "Oct"). Dua-duanya harus
 * dikenali — sumbernya tidak konsisten, dan menebak satu bahasa saja membuat
 * sebagian tanggal hilang tanpa galat apa pun.
 */
const BULAN = {
  jan: 0, januari: 0, january: 0,
  feb: 1, februari: 1, february: 1,
  mar: 2, maret: 2, march: 2,
  apr: 3, april: 3,
  mei: 4, may: 4,
  jun: 5, juni: 5, june: 5,
  jul: 6, juli: 6, july: 6,
  agu: 7, ags: 7, agustus: 7, aug: 7, august: 7,
  sep: 8, sept: 8, september: 8,
  okt: 9, oktober: 9, oct: 9, october: 9,
  nov: 10, november: 10,
  des: 11, desember: 11, dec: 11, december: 11,
}

/**
 * Apakah 'YYYY-MM-DD' menunjuk tanggal yang benar-benar ada?
 *
 * Dipakai untuk bentuk ISO. Tanggal ngawur (31 Feb, bulan 13, tahun di luar
 * rentang) harus DITOLAK — sama seperti pada bentuk teks. Satu tanggal ngawur
 * yang lolos merusak urutan seluruh daftar, bukan cuma satu kartu.
 */
function tanggalSah(iso) {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(iso ?? ''))
  if (!m) return false
  const [tahun, bulan, hari] = [Number(m[1]), Number(m[2]), Number(m[3])]
  if (tahun < 2000 || tahun > 2100 || bulan < 1 || bulan > 12 || hari < 1 || hari > 31) return false
  const d = new Date(Date.UTC(tahun, bulan - 1, hari))
  return d.getUTCFullYear() === tahun && d.getUTCMonth() === bulan - 1 && d.getUTCDate() === hari
}

/** Nama bulan gaya sumber Kemenkes: "30 Oct 2026". Dipakai kalau sumber hanya memberi ISO. */
const BULAN_PENDEK = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']

function teksTanggal(iso) {
  const [tahun, bulan, hari] = String(iso).split('-')
  return `${hari} ${BULAN_PENDEK[Number(bulan) - 1] ?? bulan} ${tahun}`
}

/**
 * Baca tanggal terbit dari HTML satu halaman artikel.
 *
 * Sumbernya menulis tanggal dalam `<div itemprop="datePublished">24 Jun 2025</div>`
 * — hanya ADA di halaman artikel, tidak di halaman depan, dan tidak ada
 * `<time>` maupun `article:published_time`. Jadi satu-satunya jalan adalah
 * penanda microdata itu.
 *
 * KENAPA HARUS DIAMBIL (25 Okt 2026): sebelumnya `isiArtikel()` membuang
 * tanggal sepenuhnya, sehingga `susun()` hanya bisa mengurutkan menurut urutan
 * halaman depan. Akibatnya artikel terbit 2025 bisa tampil di atas artikel
 * terbit 2026 — urutan tampil tidak punya hubungan dengan kebaruan, dan tidak
 * ada cara bagi pengguna untuk tahu artikelnya setua apa.
 *
 * @returns {{ tanggalTerbit: string|null, tanggalTerbitISO: string|null }}
 *   `tanggalTerbit` = teks asli sumber apa adanya (jangan dirapikan — itu bukti).
 *   `tanggalTerbitISO` = 'YYYY-MM-DD' untuk mengurutkan, atau null.
 *   Kalau tidak ada/ tidak terbaca: dua-duanya null. TIDAK ditebak, TIDAK diisi
 *   tanggal hari ini — artikel tanpa tanggal harus terlihat tanpa tanggal.
 */
export function bacaTanggalTerbit(html) {
  const mentah = String(html ?? '')

  // --- Bentuk 1: tanggal ISO langsung ------------------------------------
  //
  // Dua sumber yang dipakai sekarang sama-sama mencantumkan tanggal ISO:
  //   kemkes.go.id  : <time datetime="2026-10-30"><em>30 Oct 2026</em></time>
  //   cnnindonesia  : "datePublished":"2026-11-01T08:10:02+07:00" (JSON-LD)
  //
  // Tanggal ISO diambil apa adanya karena tidak perlu ditafsirkan: tidak ada
  // nama bulan yang bisa salah dikenali. Teks yang DITAMPILKAN tetap diambil
  // dari isi <time> kalau ada (itu tulisan sumbernya sendiri); kalau tidak ada
  // (JSON-LD), teksnya disusun dari ISO supaya kartu tetap punya keterangan.
  const isoWaktu = /<time[^>]*datetime="(\d{4}-\d{2}-\d{2})[^"]*"[^>]*>([\s\S]{0,60}?)<\/time>/i.exec(
    mentah,
  )
  if (isoWaktu) {
    const iso = isoWaktu[1]
    const teks = buangTag(isoWaktu[2])
    const sah = tanggalSah(iso)
    if (sah) return { tanggalTerbit: teks || teksTanggal(iso), tanggalTerbitISO: iso }
  }

  const isoJson = /"datePublished"\s*:\s*"(\d{4}-\d{2}-\d{2})/i.exec(mentah)?.[1]
  if (isoJson && tanggalSah(isoJson)) {
    return { tanggalTerbit: teksTanggal(isoJson), tanggalTerbitISO: isoJson }
  }

  // --- Bentuk 2: teks "24 Jun 2025" (ayosehat, masih dipakai sebagai cadangan)
  const cocok = /itemprop="datePublished"[^>]*>([^<]{4,40})</i.exec(mentah)
  const teks = cocok?.[1]?.trim() ?? ''
  if (!teks) return { tanggalTerbit: null, tanggalTerbitISO: null }

  const bagian = /^(\d{1,2})\s+([A-Za-z]+)\s+(\d{4})$/.exec(teks)
  if (!bagian) return { tanggalTerbit: teks, tanggalTerbitISO: null }

  const hari = Number(bagian[1])
  const bulan = BULAN[bagian[2].toLowerCase()]
  const tahun = Number(bagian[3])

  // Tolak yang tidak masuk akal: bulan tak dikenal, hari di luar 1-31, atau
  // tahun di luar rentang yang mungkin untuk situs ini. Tanggal ngawur yang
  // lolos akan MERUSAK URUTAN seluruh daftar, bukan cuma satu kartu.
  if (bulan === undefined || hari < 1 || hari > 31 || tahun < 2000 || tahun > 2100) {
    return { tanggalTerbit: teks, tanggalTerbitISO: null }
  }

  const d = new Date(Date.UTC(tahun, bulan, hari))
  // Tanggal yang "meluap" (mis. 31 Feb) digeser otomatis oleh Date — tolak.
  if (d.getUTCDate() !== hari || d.getUTCMonth() !== bulan) {
    return { tanggalTerbit: teks, tanggalTerbitISO: null }
  }

  const iso = `${tahun}-${String(bulan + 1).padStart(2, '0')}-${String(hari).padStart(2, '0')}`
  return { tanggalTerbit: teks, tanggalTerbitISO: iso }
}

/**
 * Urutkan artikel dari yang TERBARU diterbitkan.
 *
 * Aturan yang disengaja:
 *   - Artikel bertanggal selalu di depan artikel tanpa tanggal. Tanpa tanggal
 *     bukan berarti baru; menaruhnya di depan akan mengangkat artikel yang
 *     umurnya tidak diketahui ke atas artikel yang terbukti baru.
 *   - Artikel tanpa tanggal tetap dipertahankan (tidak dibuang) dan diurutkan
 *     menurut urutan aslinya dari halaman depan — supaya hasilnya stabil,
 *     bukan acak setiap kali dipanggil.
 *   - TIDAK memakai `Array.prototype.sort` bawaan untuk objek: pembandingnya
 *     harus total, kalau tidak urutannya berbeda antar mesin.
 */
export function urutkanTerbaru(pool = []) {
  const berIndex = pool.map((d, i) => ({ d, i }))
  berIndex.sort((a, b) => {
    const ta = a.d.tanggalTerbitISO ?? null
    const tb = b.d.tanggalTerbitISO ?? null
    if (ta && tb && ta !== tb) return ta < tb ? 1 : -1 // ISO: urut teks = urut waktu
    if (ta && !tb) return -1
    if (!ta && tb) return 1
    return a.i - b.i // dua-duanya tanpa tanggal: pertahankan urutan sumber
  })
  return berIndex.map((x) => x.d)
}

/* ------------------------------------------------------------- sidik jari -- */

/**
 * Tanda isi sumber. Sengaja TIDAK bergantung urutan, supaya kalau halaman
 * sumbernya cuma menata ulang tampilan (isinya sama), itu tidak dianggap
 * sebagai informasi baru.
 */
function buatSidik(daftar) {
  const isi = daftar
    .map((d) => d.slug)
    .sort()
    .join('|')
  // FNV-1a 32-bit
  let h = 2166136261
  for (let i = 0; i < isi.length; i++) {
    h ^= isi.charCodeAt(i)
    h = Math.imul(h, 16777619)
  }
  return (h >>> 0).toString(16)
}

/* --------------------------------------------------------- olah judul/isi -- */

/** Ubah judul jadi label topik yang pendek dan enak dibaca. */
function jadiLabel(judul) {
  const asli = String(judul ?? '').trim()

  // Urutannya penting. Prefiks lembaga dibuang DULU, baru dipotong di tanda
  // titik dua/kurung. Kalau dibalik, "Menkes: Perluasan Akses …" terpotong
  // jadi "Menkes" lalu prefiksnya ikut terbuang — hasilnya label KOSONG.
  let t = asli.replace(
    /^(kemenkes|menkes|wamenkes|pemerintah|kementerian kesehatan)\b\s*:?\s*/i,
    '',
  )

  // buang pembuka yang tidak perlu
  t = t.replace(/^(kenali|mengenal|cara|tips|yuk|mari|waspadai|hati-hati)\s+/i, '')
  t = t.replace(/^(apa itu|apa sih|apa yang dimaksud dengan)\s+/i, '')

  // potong subjudul ("Judul: keterangan", "Judul (edisi …)")
  t = t.split(/[:(]/)[0].trim()

  // ambil frasa sebelum kata sambung, supaya labelnya utuh dan tidak menggantung
  const inti = t.split(/\s+(?:dengan|pada|untuk|agar|dan|serta|yang|di|ke)\s+/i)[0].trim()
  if (inti.length >= 8) t = inti

  t = t.replace(/[,;]\s*$/, '').trim()
  if (t.length > 30) {
    // potong di batas kata, tanpa titik-titik menggantung
    const potong = t.slice(0, 30)
    const spasi = potong.lastIndexOf(' ')
    t = (spasi > 14 ? potong.slice(0, spasi) : potong).trim()
  }

  // Jaring pengaman: label kosong tidak boleh sampai ke antarmuka — chip tanpa
  // tulisan terlihat seperti kerusakan. Jatuh ke awal judul aslinya.
  if (!t) t = asli.split(/[:(]/)[0].trim().slice(0, 30) || asli.slice(0, 30)

  return t.charAt(0).toUpperCase() + t.slice(1)
}

/** Perkiraan waktu baca dari jumlah kata (±200 kata per menit). */
function waktuBaca(teks) {
  const kata = String(teks ?? '').split(/\s+/).filter(Boolean).length
  return `${Math.max(1, Math.round(kata / 200))} menit baca`
}

/** Tentukan kategori & warna kartu dari judul. */
const KATEGORI = [
  [/(gizi|nutrisi|makanan|label|stunting|asi|menyusui|buah|sayur|vitamin)/i, 'Gizi', 'amber'],
  [/(vaksin|imunisasi|polio|campak)/i, 'Vaksinasi', 'sky'],
  [/(mental|jiwa|stres|depresi|cemas)/i, 'Kesehatan Mental', 'purple'],
  [/(jantung|kardiovaskular|stroke|hipertensi|darah|kolesterol)/i, 'Jantung & Pembuluh', 'rose'],
  [/(diabetes|gula|kencing manis)/i, 'Diabetes', 'amber'],
  [/(malaria|dbd|dengue|demam|tbc|tuberkulosis|hepatitis|infeksi|virus|wabah)/i, 'Penyakit Menular', 'rose'],
  [/(kanker|tumor)/i, 'Kanker', 'purple'],
  [/(rokok|merokok|alkohol|narkoba)/i, 'Gaya Hidup', 'teal'],
  [/(olahraga|aktivitas fisik|senam|latihan)/i, 'Aktivitas Fisik', 'teal'],
  [/(hamil|kehamilan|reproduksi|kb|haid|menstruasi)/i, 'Kesehatan Reproduksi', 'purple'],
  [/(anak|bayi|balita|tumbuh kembang)/i, 'Kesehatan Anak', 'sky'],
  [/(gigi|mulut)/i, 'Kesehatan Gigi', 'sky'],
]

function tebakKategori(judul) {
  for (const [pola, label, tint] of KATEGORI) {
    if (pola.test(judul)) return { category: label, tint }
  }
  return { category: 'Kesehatan', tint: 'brand' }
}

/**
 * Paragraf yang isinya pembuka biasa, bukan kutipan akademis atau sisipan
 * sejarah. Beberapa artikel Kemenkes membuka dengan rujukan seperti
 * "L. Bloom (1974)" atau nama penyair — itu tidak enak dipakai sebagai
 * ringkasan di kartu.
 */
function layakSebagaiRingkasan(p) {
  if (/\(\d{4}\)/.test(p)) return false // memuat tahun dalam tanda kurung
  if (/\b(?:abad|teori|peneliti|profesor)\b/i.test(p)) return false
  if (/^(seorang|menurut|berdasarkan|dalam\s+buku|pada\s+abad|teori)/i.test(p)) return false
  return true
}

/* -------------------------------------------- pengurai daftar per sumber -- */

/**
 * Urai halaman daftar "Rilis Berita" Kemenkes jadi daftar artikel.
 *
 * Bentuk kartunya (diukur 1 Nov 2026):
 *
 *   <a href="/id/slug-artikel" class="link">
 *     <div class="card">
 *       <div class="image-rect"><img src="/app_asset/image_content/….jpg"></div>
 *       <div class="card-body">
 *         <h4 class="text-20">Judul</h4>
 *         <time datetime="2026-10-30"><em>30 Oct 2026</em></time>
 *
 * Dipisah jadi fungsi murni (tanpa jaringan) supaya bisa diuji langsung dengan
 * contoh HTML — lihat `uji-sumber-konten.mjs`.
 */
export function uraiDaftarKemkes(html) {
  const hasil = []
  const sudah = new Set()
  const kartu = [
    ...String(html ?? '').matchAll(
      /<a href="(\/id\/[a-z0-9-]{6,})"\s+class="link"[^>]*>([\s\S]{0,2000}?)<\/a>/gi,
    ),
  ]

  for (const m of kartu) {
    const jalur = m[1]
    const isi = m[2]

    // tautan paginasi & kategori ikut tertangkap polanya, tapi bukan artikel
    if (/^\/id\/(category|home|media|profil)\b/i.test(jalur)) continue

    const judul = buangTag(/<h4[^>]*>([\s\S]*?)<\/h4>/i.exec(isi)?.[1] ?? '')
    if (!judul || judul.length < 12 || judul.length > 200) continue

    const slug = `kemkes:${jalur.replace('/id/', '')}`
    if (sudah.has(slug)) continue

    const src = /<img[^>]+src="([^"]+\.(?:jpg|jpeg|png|webp))"/i.exec(isi)?.[1] ?? ''
    const waktu = /<time[^>]*datetime="(\d{4}-\d{2}-\d{2})[^"]*"[^>]*>([\s\S]{0,60}?)<\/time>/i.exec(
      isi,
    )
    const iso = waktu?.[1] && tanggalSah(waktu[1]) ? waktu[1] : null

    sudah.add(slug)
    hasil.push({
      slug,
      url: `https://kemkes.go.id${jalur}`,
      judul,
      gambar: src ? (src.startsWith('http') ? src : `https://kemkes.go.id${src}`) : '',
      penerbit: PENERBIT,
      tanggalTerbit: iso ? buangTag(waktu[2]) || teksTanggal(iso) : null,
      tanggalTerbitISO: iso,
    })
  }

  return hasil
}

/**
 * Urai halaman kanal kesehatan CNN Indonesia jadi daftar artikel.
 *
 * URL CNN memuat cap waktu terbitnya sendiri:
 *   /gaya-hidup/20261101121607-255-1421965/judul-artikel
 *                  ^^^^^^^^^^^^^^ YYYYMMDDHHMMSS
 * Jadi tanggal terbitnya dibaca dari situ — bukan ditebak dari urutan tampil.
 * Halaman artikelnya juga punya JSON-LD `datePublished`; kalau terambil, nilai
 * itu yang dipakai (lihat `isiArtikel`).
 */
export function uraiDaftarCnn(html) {
  const hasil = []
  const sudah = new Set()
  const kartu = [
    ...String(html ?? '').matchAll(
      /<a\b([^>]*?)href="(https:\/\/www\.cnnindonesia\.com\/gaya-hidup\/(\d{14})-\d+-\d+\/[^"]+)"([^>]*)>([\s\S]{0,3000}?)<\/a>/gi,
    ),
  ]

  for (const m of kartu) {
    const url = m[2]
    const capWaktu = m[3]
    const isi = m[5]

    const judul = buangTag(
      /dtr-ttl="([^"]+)"/i.exec(m[1] + m[4])?.[1] ??
        /<h[234][^>]*>([\s\S]*?)<\/h[234]>/i.exec(isi)?.[1] ??
        /<span class="[^"]*text-(?:2xl|base)[^"]*">([\s\S]*?)<\/span>/i.exec(isi)?.[1] ??
        '',
    )
    if (!judul || judul.length < 15 || judul.length > 200) continue

    const slug = `cnn:${url.split('/').pop()}`
    if (sudah.has(slug)) continue

    const iso = `${capWaktu.slice(0, 4)}-${capWaktu.slice(4, 6)}-${capWaktu.slice(6, 8)}`
    if (!tanggalSah(iso)) continue

    const src = /<img[^>]+src="([^"]+\.(?:jpg|jpeg|png|webp)[^"]*)"/i.exec(isi)?.[1] ?? ''

    sudah.add(slug)
    hasil.push({
      slug,
      url,
      judul,
      gambar: src,
      penerbit: PENERBIT_CNN,
      tanggalTerbit: teksTanggal(iso),
      tanggalTerbitISO: iso,
    })
  }

  return hasil
}

/* ----------------------------------------------- LANGKAH: Cari Informasi -- */

/** Daftar artikel dari halaman-halaman "Rilis Berita" Kemenkes. */
async function daftarKemkes() {
  const hasil = []
  for (let hal = 1; hal <= HALAMAN_SUMBER; hal++) {
    const alamat = hal === 1 ? SUMBER : `${SUMBER}/${hal}`
    let html
    try {
      html = await ambil(alamat)
    } catch {
      break // halaman berikutnya tidak ada / sedang mati: pakai yang sudah ada
    }
    const butir = uraiDaftarKemkes(html)
    if (!butir.length) break
    hasil.push(...butir)
  }
  return hasil
}

/** Daftar artikel dari kanal kesehatan CNN Indonesia. */
async function daftarCnn() {
  const html = await ambil(SUMBER_CNN)
  return uraiDaftarCnn(html)
}

/**
 * Daftar artikel dari SEMUA sumber.
 *
 * Kalau satu sumber mati, sumber lain tetap dipakai — kegagalan satu kanal
 * tidak boleh mengosongkan seluruh halaman. Baru kalau SEMUANYA gagal, galat
 * dilempar supaya `kontenHarian` memakai simpanan lama.
 */
async function daftarArtikel() {
  const [kemkes, cnn] = await Promise.allSettled([daftarKemkes(), daftarCnn()])
  const hasil = []
  if (kemkes.status === 'fulfilled') hasil.push(...kemkes.value)
  if (cnn.status === 'fulfilled') hasil.push(...cnn.value)
  if (!hasil.length) {
    const sebab = [kemkes, cnn]
      .map((x) => (x.status === 'rejected' ? x.reason?.message : null))
      .filter(Boolean)
      .join(' · ')
    throw new Error(`semua sumber konten gagal: ${sebab || 'tidak diketahui'}`)
  }
  return hasil
}

/**
 * Ambil paragraf PROSA saja dari sebuah halaman artikel.
 *
 * KENAPA DISARING KETAT: halaman berita menyisipkan teks yang bukan bagian
 * tulisan, dan sebagian di antaranya berbentuk `<p>`:
 *   - tempelan skrip: `<p>Komentar URL berhasil disalin document.addEventListener(...)</p>`
 *     (diukur di cnnindonesia.com, 1 Nov 2026 — 1.740 karakter sekali jalan)
 *   - label antarmuka: "URL berhasil disalin", "Bagikan", "Komentar"
 *   - keterangan gambar: "Ilustrasi. …" (biasanya <figcaption>, tapi kadang <p>)
 *
 * Paragraf seperti itu dulu lolos karena saringannya hanya memeriksa panjang.
 * Akibatnya butir tips dan ringkasan kartu berisi "URL berhasil disalin
 * Ilustrasi." — terbaca sebagai kerusakan aplikasi, padahal asalnya dari
 * halaman sumbernya.
 *
 * Untungnya prosa Indonesia hampir tidak pernah memuat `{ } ; = < >`, jadi
 * kepadatan tanda itu dipakai sebagai penanda "ini bukan tulisan".
 */
export function uraiParagrafArtikel(html) {
  return [...String(html).matchAll(/<p[^>]*>([\s\S]*?)<\/p>/gi)]
    .map((p) => buangTag(p[1]))
    .filter((p) => !bukanProsa(p))
}

function bukanProsa(p) {
  if (!p || p.length <= 70) return true
  // sisa skrip / potongan HTML yang ikut terbaca sebagai teks
  if (sampahAntarmuka(p)) return true
  // paragraf berita tidak sepanjang ini; yang lebih panjang biasanya tempelan
  if (p.length > 1200) return true
  // saringan buatan situs sumber
  if (/^(baca juga|sumber|referensi|penulis|editor|simak|lihat juga)/i.test(p)) return true
  if (/^\[?gambas/i.test(p)) return true
  if (/^(advertisement|scroll untuk melanjutkan)/i.test(p)) return true
  // kepadatan tanda kode: prosa normal jauh di bawah 2%
  const tanda = (p.match(/[{};=<>]/g) ?? []).length
  if (tanda / p.length > 0.02) return true
  return false
}

/**
 * Teks milik antarmuka situs sumber, bukan tulisan artikel.
 *
 * Dipisah dari `bukanProsa` karena butir tips memang kalimat pendek (sering
 * di bawah 70 karakter), jadi tidak boleh disaring dengan ambang panjang
 * paragraf — dulu salah dan seluruh butir tips ikut hilang.
 */
function sampahAntarmuka(teks) {
  const t = String(teks ?? '').trim()
  if (!t) return true
  if (/url berhasil disalin|document\.addEventListener|querySelector|getElementById|\bfunction\s*\(/i.test(t)) return true
  return /^(ilustrasi\.|komentar\b|bagikan\b|iklan\b|baca juga\b)/i.test(t)
}

/** Ringkasan resmi + paragraf pembuka satu artikel. */
async function isiArtikel(item) {
  const html = await ambil(item.url, 15000)

  const desc = buangTag(
    html.match(/<meta\s+name="description"\s+content="([^"]*)"/i)?.[1] ??
      html.match(/<meta\s+property="og:description"\s+content="([^"]*)"/i)?.[1] ??
      '',
  )

  // gambar: halaman daftar tidak selalu memuat gambarnya, jadi kalau kosong
  // ambil dari og:image halaman artikelnya sendiri
  let gambar = item.gambar || ''
  if (!gambar) {
    const og = html.match(
      /(?:property|name)="og:image"[^>]*content="([^"]+\.(?:jpg|jpeg|png|webp)[^"]*)"/i,
    )?.[1]
    if (og) gambar = og.startsWith('//') ? `https:${og}` : og
  }

  // Isi utama: coba wadah artikel dulu, lalu jatuh ke seluruh halaman.
  // KENAPA PERLU CADANGAN: pada sebagian halaman (mis. CNN) elemen <article>
  // pertama yang muncul bisa berisi blok "rekomendasi", bukan badan tulisan.
  // Kalau wadah itu tidak menghasilkan paragraf yang cukup, pakai seluruh HTML.
  const wadah = html.match(/<(?:article|main)[^>]*>([\s\S]*?)<\/(?:article|main)>/i)?.[1]
  let paragraf = wadah ? uraiParagrafArtikel(wadah) : []
  if (paragraf.length < 2) paragraf = uraiParagrafArtikel(html)

  // Ringkasan: kandidatnya deskripsi resmi halaman itu, lalu paragraf-paragraf
  // awalnya. Dipilih yang pertama lolos saringan — karena ada kalanya deskripsi
  // resminya sendiri dibuka dengan kutipan akademis.
  // Ringkasan wajib berakhir di akhir kalimat. Meta description sumber kadang
  // sudah terpotong di tengah kata oleh penerbitnya sendiri (mis. "...disukai
  // ba"); kalau dipakai apa adanya, kartunya terbaca seperti rusak.
  const kandidat = [desc, ...paragraf]
  const ringkas =
    kandidat.find(
      (x) => x && x.length > 60 && layakSebagaiRingkasan(x) && /[.!?]$/.test(x.trim()),
    ) ?? ''

  // `tubuh` dipotong di batas kalimat, bukan di tengah kata seperti slice()
  // mentah — kalimat yang menggantung lalu lolos jadi "butir" tips.
  const gabung = paragraf.slice(0, 2).join(' ')
  // Tanggal dari halaman artikel HANYA menimpa tanggal dari halaman daftar
  // kalau memang terbaca. Kalau tidak terbaca, tanggal yang sudah dipegang
  // daftar (mis. dari cap waktu URL CNN) dipertahankan — bukan dikosongkan.
  const dariHalaman = bacaTanggalTerbit(html)
  return {
    ringkas: potongKalimat(ringkas, 260),
    tubuh: potongKalimat(gabung, 900),
    gambar,
    // Tanggal terbit ASLI dari halaman sumber. Tidak dirapikan dan tidak
    // ditebak: kalau halamannya tidak mencantumkan, hasilnya null dan
    // antarmuka tidak menampilkan apa-apa (lihat `bacaTanggalTerbit`).
    tanggalTerbit: dariHalaman.tanggalTerbit ?? item.tanggalTerbit ?? null,
    tanggalTerbitISO: dariHalaman.tanggalTerbitISO ?? item.tanggalTerbitISO ?? null,
  }
}

/* ---------------------------------------------- LANGKAH: Update Informasi -- */

/**
 * Kumpulkan artikel lama + baru, yang baru di depan, tanpa duplikat.
 * Dengan begitu koleksi artikelnya bertambah seiring waktu, dan yang baru
 * selalu dapat kesempatan tampil lebih dulu.
 */
function gabungPool(lama = [], baru = []) {
  const ada = new Set(lama.map((x) => x.slug))
  const tambahan = baru.filter((d) => !ada.has(d.slug))
  return [...tambahan, ...lama].slice(0, MAKS_POOL)
}

/**
 * Ubah kumpulan artikel jadi bentuk yang dipakai tampilan.
 *
 * `geser` = berapa posisi daftarnya diputar. Ini yang membuat halaman tidak
 * menampilkan artikel yang sama terus-menerus selama sumbernya belum berubah
 * (permintaan, 16 Okt 2026 — "Topik populer / Tips / Artikel kok tidak
 * update-update ya?").
 *
 * KENAPA PERLU: halaman depan Kemenkes hanya memuat ~11 artikel dan `susun()`
 * selalu mengambil 5 teratas. Selama sumbernya tidak menerbitkan apa pun,
 * yang tampil SELALU lima artikel yang sama — berhari-hari. Padahal di pool
 * sudah tersimpan 8 artikel yang isinya lengkap; sisanya tidak pernah terlihat.
 *
 * YANG TIDAK DILANGGAR: yang diputar adalah artikel yang MEMANG sudah ada di
 * pool, semuanya dari sumber resmi. Tidak ada artikel karangan, dan tanggal
 * `diperbarui` tetap menunjuk kapan sumbernya benar-benar berubah — jadi
 * halaman tetap jujur. `geser` disimpan di simpanan supaya putarannya
 * berlanjut, bukan mengulang dari awal setiap instance baru.
 */
/**
 * Berapa artikel TERBARU yang ikut diputar.
 *
 * KENAPA ADA BATASNYA (25 Okt 2026). Rotasi tanpa batas memutar SELURUH pool,
 * jadi cepat atau lambat artikel terbit 2023 akan sampai ke depan — dan itu
 * persis cacat yang dilaporkan pengguna: "pas dicek di sumbernya malah 2025".
 * Diukur: dengan 9 artikel, `geser` 6-8 menaruh artikel 2023 dan 2024 di depan.
 *
 * Dengan jendela 8, rotasi hanya memilih "mulai dari mana" di antara artikel
 * TERBARU. Artikel di luar jendela tetap tersimpan di pool dan tetap muncul
 * begitu ada artikel baru yang mendorongnya masuk — tapi tidak akan pernah
 * dipamerkan sebagai bacaan utama hanya karena putaran kebetulan sampai ke situ.
 *
 * Angka 8 dipilih karena `susun()` memakai paling banyak 5 topik + 4 artikel +
 * 1 calon tips, jadi jendela ini selalu cukup untuk mengisi seluruh tampilan.
 */
const JENDELA_ROTASI = 8

export function susun(pool, geser = 0) {
  const dasar = pool.filter((d) => d.ringkas || d.tubuh)
  // URUTKAN DULU menurut tanggal terbit, baru diputar.
  //
  // KENAPA URUTAN INI PENTING (25 Okt 2026): rotasi dulu bekerja langsung di
  // atas urutan halaman depan Kemenkes, yang TIDAK mencerminkan kebaruan —
  // terbukti artikel terbit 05 May 2026 (termuda, 173 hari) bisa berada di
  // belakang artikel terbit 24 Jun 2025. Dengan mengurutkan lebih dulu,
  // `geser` hanya memilih "mulai dari mana" di dalam daftar yang sudah benar
  // urutannya; ia tidak bisa lagi mengangkat artikel tua ke atas yang baru.
  const urut = urutkanTerbaru(dasar)
  // Batasi ke jendela artikel terbaru SEBELUM diputar — lihat JENDELA_ROTASI.
  const jendela = urut.slice(0, JENDELA_ROTASI)
  // Putar daftarnya. Modulo supaya `geser` boleh membesar tanpa batas.
  const n = jendela.length
  const k = n ? ((geser % n) + n) % n : 0
  const siap = k ? [...jendela.slice(k), ...jendela.slice(0, k)] : jendela

  const topik = siap.slice(0, 5).map((d) => ({
    id: d.slug,
    label: jadiLabel(d.judul),
    tanya: `Apa yang perlu saya ketahui tentang ${jadiLabel(d.judul).toLowerCase()}?`,
  }))

  const artikel = siap.slice(0, 4).map((d) => {
    const { category, tint } = tebakKategori(d.judul)
    return {
      id: d.slug,
      category,
      tint,
      title: d.judul,
      excerpt: d.ringkas || potongKalimat(d.tubuh, 160),
      body: d.tubuh || d.ringkas,
      source: d.penerbit ?? PENERBIT,
      url: d.url,
      gambar: d.gambar || '',
      readTime: waktuBaca(d.tubuh || d.ringkas),
      // Tanggal terbit dari sumber, diteruskan apa adanya. `null` kalau
      // halamannya tidak mencantumkan — antarmuka lalu tidak menampilkan
      // tanggal sama sekali, bukan menampilkan tanggal pengambilan.
      tanggalTerbit: d.tanggalTerbit ?? null,
      tanggalTerbitISO: d.tanggalTerbitISO ?? null,
    }
  })

  // tips diambil dari artikel yang kalimatnya paling pas dipakai sebagai
  // butir — jadi isinya memang kalimat sumber, bukan buatan
  let tips = null
  for (const d of siap) {
    // Artikel yang isinya masih kepotong (ditandai "…") tidak layak jadi tips:
    // butirnya cuma kalimat sisa.
    if (/…$/.test(d.tubuh ?? '')) continue
    // Jaring pengaman kedua: walaupun paragrafnya sudah disaring, kalimat
    // sisa label antarmuka bisa tetap ikut. Butir seperti "URL berhasil
    // disalin" tidak boleh tampil sebagai tips kesehatan.
    const butir = butirDari(d.tubuh, 3).filter((b) => !sampahAntarmuka(b) && b.length > 20)
    if (butir.length >= 2) {
      tips = {
        label: 'Tips Kesehatan Hari Ini',
        title: d.judul,
        body: d.ringkas || potongKalimat(d.tubuh, 260),
        bullets: butir,
        // teks lanjutan untuk tombol "Baca selengkapnya" — tetap dari sumber,
        // bukan tulisan tetap di dalam komponen
        selengkapnya: potongKalimat(d.tubuh, 900),
        source: d.penerbit ?? PENERBIT,
        url: d.url,
      }
      break
    }
  }

  // Penerbit yang benar-benar muncul di kartu — bukan satu label tetap.
  // Sejak sumbernya dua (Kemenkes + CNN Indonesia), menyebut satu nama saja
  // akan membuat kartu CNN berlabel "Kemenkes RI" — itu klaim yang salah.
  const penerbit = [...new Set(artikel.map((a) => a.source))].join(' & ')

  return { topik, artikel, tips, penerbit, sumberHalaman: [SUMBER, SUMBER_CNN] }
}

/* ------------------------------------------------------------- simpanan -- */

const __dirname = dirname(fileURLToPath(import.meta.url))

/**
 * Berkas cache konten.
 *
 * Bisa diarahkan lewat CACHE_KONTEN ke lokasi yang memang boleh ditulis.
 * Di Vercel, berkas di dalam paket fungsi bersifat READ-ONLY, sehingga
 * penulisan ke sini selalu gagal — lihat catatan di `simpanKeDisk`.
 */
const BERKAS = process.env.CACHE_KONTEN || join(__dirname, '..', '.cache-konten.json')

let diMemori = null
let sedangMengambil = null

/**
 * Apakah penulisan cache ke berkas memang mungkin?
 *
 * null = belum pernah dicoba. Setelah percobaan pertama gagal, nilainya jadi
 * false dan percobaan berikutnya dilewati — supaya tidak ada penulisan gagal
 * berulang yang hanya membuang waktu di setiap permintaan.
 */
let bisaTulisBerkas = null

const sekarangISO = () => new Date(jamSekarang()).toISOString()
const besokISO = () => new Date(jamSekarang() + BERLAKU_MS).toISOString()

/** Waktunya Pencarian Berikutnya? (lihat diagram) */
function waktunyaCek(data) {
  if (!data?.berikutnya) return true
  return jamSekarang() >= new Date(data.berikutnya).getTime()
}

async function bacaDariDisk() {
  try {
    if (!existsSync(BERKAS)) return null
    const isi = JSON.parse(await readFile(BERKAS, 'utf8'))
    return isi?.topik?.length ? isi : null
  } catch {
    return null
  }
}

/**
 * Simpan cache konten ke berkas.
 *
 * CATATAN PENTING soal serverless (Vercel):
 * berkas di dalam paket fungsi bersifat READ-ONLY, jadi penulisan ke sini
 * SELALU gagal di sana. Dulu kegagalan itu ditelan diam-diam, sehingga setiap
 * instance serverless yang baru selalu memulai dari nol dan mengulang seluruh
 * pengambilan artikel — padahal hasilnya sudah ada.
 *
 * Sekarang: kalau penulisan gagal karena berkas tidak bisa ditulis, kita
 * mencatatnya dan berhenti mencoba lagi. Isinya tetap ada di memori instance
 * itu, dan di produksi lapisan cache Vercel-lah yang menahan permintaan
 * berikutnya (endpoint /api/konten memakai Cache-Control 5 menit + stale).
 * Di komputer sendiri, berkas ini tetap ditulis seperti biasa.
 */
async function simpanKeDisk(data) {
  if (bisaTulisBerkas === false) return
  try {
    await mkdir(dirname(BERKAS), { recursive: true })
    await writeFile(BERKAS, JSON.stringify(data), 'utf8')
    bisaTulisBerkas = true
  } catch (e) {
    // EROFS (read-only) dan EACCES (tanpa izin) = lingkungan serverless.
    // Tidak perlu dicoba lagi; selain itu dicoba lagi di kesempatan berikutnya.
    if (e?.code === 'EROFS' || e?.code === 'EACCES' || e?.code === 'EPERM') {
      bisaTulisBerkas = false
    }
  }
}

/**
 * Salin artikel konten ke database — OPSIONAL, tidak pernah melempar.
 *
 * Dipisah jadi satu fungsi karena ada TIGA jalur keluar di `kontenHarian`,
 * dan database harus ikut terisi di ketiganya. Sebelumnya hanya satu jalur
 * yang menyinkron, sehingga database hampir selalu kosong walaupun kontennya
 * ada — persis kesalahan yang sempat terjadi.
 */
async function sinkronKeDb(data) {
  try {
    const artikel = Array.isArray(data?.artikel) ? data.artikel : []
    if (!artikel.length) return
    await simpanKonten(artikel)
  } catch {
    /* database opsional — kegagalan di sini tidak boleh mengganggu konten */
  }
}

/* ----------------------------------------------------------------- utama -- */

/**
 * Ambil konten harian, mengikuti alur di mermaid-diagram.png.
 *
 * @param {{ paksa?: boolean }} opsi
 *   paksa = melakukan pencarian sekarang juga tanpa menunggu sehari.
 *   Ini hanya memaksa PENCARIAN — keputusan mengubah konten tetap mengikuti
 *   aturan "ada informasi terbaru?".
 */
export async function kontenHarian({ paksa = false } = {}) {
  // pastikan simpanan sudah dibaca
  if (!diMemori) diMemori = await bacaDariDisk()

  // Bentuk simpanan berubah (lihat VERSI_BENTUK)? Kalau ya, pengecekan HARUS
  // jalan sekarang juga, tanpa menunggu jadwal harian.
  //
  // KENAPA (1 Nov 2026): dulu keputusan ini hanya diperiksa DI DALAM badan
  // pengambilan, sementara gerbang di bawah sudah mengembalikan simpanan lama
  // lebih dulu. Akibatnya menaikkan VERSI_BENTUK tidak berefek apa pun sampai
  // pengecekan besok — teks kotor dari pengurai lama tetap tampil sehari penuh
  // walaupun kodenya sudah diperbaiki.
  const bentukLama = (diMemori?.versiBentuk ?? 1) !== VERSI_BENTUK

  // 1) Waktunya Pencarian Berikutnya? -> Tidak: pakai yang sudah ada
  if (!paksa && !bentukLama && diMemori && !waktunyaCek(diMemori)) {
    // Sinkronkan ke database di sini juga. Ini JALUR YANG PALING SERING DILEWATI
    // (cache masih segar), jadi tanpa sinkronisasi di titik ini database hampir
    // tidak pernah terisi — sudah pernah terjadi dan sempat membingungkan.
    await sinkronKeDb(diMemori)
    return diMemori
  }

  // kalau ada pengambilan lain sedang jalan, ikut menunggu hasil yang sama
  if (sedangMengambil) return sedangMengambil

  /*
   * CATATAN soal `require-atomic-updates` di bawah.
   *
   * ESLint memperingatkan bahwa `diMemori` dan `bisaTulisBerkas` ditulis
   * setelah `await`, sehingga "nilai lama bisa sudah basi". Peringatan itu
   * tidak berlaku di sini, dan alasannya bisa diperiksa:
   *
   *   - Seluruh badan IIFE ini hanya berjalan SATU KALI pada satu waktu.
   *     Penjaga `sedangMengambil` di atas mengembalikan janji yang sama untuk
   *     pemanggil berikutnya, jadi tidak ada dua jalur yang menulis bersamaan.
   *   - `simpanKeDisk` hanya menulis penanda boolean "boleh/tidak menulis
   *     berkas", dan nilainya idempoten: menulis `true` dua kali sama saja.
   *
   * Kalau suatu saat penjaga `sedangMengambil` DIHAPUS, peringatan ini berubah
   * menjadi bug nyata (rotasi `geser` bisa hilang dan sumber dipanggil
   * berulang). Saat itu jangan matikan aturannya — pasang kunci yang benar.
   */
  sedangMengambil = (async () => {
    try {
      // 2) Cari Informasi
      const daftar = await daftarArtikel()
      if (!daftar.length) throw new Error('daftar artikel kosong')
      const sidikBaru = buatSidik(daftar)

      // Bentuk simpanan berubah (lihat VERSI_BENTUK): artikel lama harus
      // diambil ULANG, karena `if (d.ringkas || d.tubuh) return` di bawah
      // membuat kolom baru selamanya kosong pada artikel yang sudah tersimpan.
      // `bentukLama` sudah dihitung sebelum gerbang jadwal — lihat catatan
      // di `kontenHarian()`.
      const poolAwal = bentukLama
        ? (diMemori?.pool ?? []).map((d) => ({
            ...d,
            // Buang isi supaya benar-benar diambil ulang — bukan cuma
            // tanggalnya yang kosong, isinya pun bisa ikut berubah bentuk.
            ringkas: undefined,
            tubuh: undefined,
          }))
        : (diMemori?.pool ?? [])

      // 3) Ada Informasi Terbaru?
      if (diMemori && sidikBaru === diMemori.sidik && !bentukLama) {
        // Tidak -> ISI-nya jangan diubah, dan `diperbarui` TETAP (halaman tidak
        // boleh berpura-pura ada pembaruan). Tapi daftar yang TAMPIL diputar
        // satu langkah, supaya tidak menampilkan lima artikel yang sama
        // berhari-hari selama sumbernya belum menerbitkan apa pun.
        //
        // Rotasi ditaruh DI SINI karena cabang ini hanya dilewati sekali sehari
        // (lihat `waktunyaCek`), jadi putarannya ikut sekali sehari.
        const geser = (diMemori.geser ?? 0) + 1
        const sesudah = {
          ...diMemori,
          ...susun(diMemori.pool ?? [], geser),
          geser,
          versiBentuk: VERSI_BENTUK,
          diperiksa: sekarangISO(),
          berikutnya: besokISO(),
        }
        diMemori = sesudah
        await simpanKeDisk(sesudah)
        // Sinkronkan juga ke database pada jalur "tidak ada yang berubah".
        // Tanpa ini, database hanya terisi pada hari ketika kontennya BERUBAH —
        // jadi database baru terisi sesekali, padahal maksudnya jadi cerminan
        // dari apa yang sedang dipakai. `slug` UNIQUE membuat ini aman diulang.
        await sinkronKeDb(sesudah)
        return sesudah
      }

      // 4) Ya -> Update Informasi.
      //    Hanya artikel yang belum punya detail yang perlu diambil, dan
      //    jumlahnya dibatasi MAKS_DETAIL (lihat catatan di atas konstanta itu).
      const pool = gabungPool(poolAwal, daftar)
      // Jatah detail dikelola dengan pengambil berurutan, BUKAN penghitung di
      // dalam `Promise.all`.
      //
      // KENAPA DIUBAH (25 Okt 2026): bentuk lamanya `terpakai += 1` di dalam
      // callback `map` async. Seluruh callback itu berjalan SINKRON sampai
      // `await` pertama, jadi sebenarnya aman — tapi hanya selama isi `map`
      // tidak pernah diubah. Kalau ada satu `await` disisipkan di depan, semua
      // callback melihat `terpakai` yang sama dan batas 8 tembus. Selain itu
      // `terpakai -= 1` di blok catch bisa membuat jatah "kembali" padahal
      // pengambilan lain sudah memakainya, sehingga batasnya bisa terlampaui.
      //
      // Bentuk sekarang: ambil daftar kandidat lebih dulu, potong tepat
      // MAKS_DETAIL, lalu jalankan berurutan. Jatah yang gagal TIDAK dikembalikan
      // di tengah jalan; sebagai gantinya kandidat diambil lebih banyak (lihat
      // CADANGAN_DETAIL) supaya artikel yang gagal tidak menahan yang di bawahnya.
      const perluIsi = urutkanTerbaru(pool.filter((d) => !d.ringkas && !d.tubuh)).slice(
        0,
        MAKS_DETAIL,
      )
      for (const d of perluIsi) {
        try {
          Object.assign(d, await isiArtikel(d))
        } catch {
          // Gagal satu artikel: lanjut ke berikutnya. Tidak ada jatah yang
          // perlu dikembalikan karena daftarnya sudah dipotong di depan.
        }
      }

      const isi = susun(pool, 0)
      if (!isi.topik.length && !isi.artikel.length) throw new Error('hasil kosong')

      // `diperbarui` hanya boleh maju kalau SUMBERNYA berubah.
      //
      // KENAPA (25 Okt 2026): kalau yang memicu pengambilan ulang cuma naiknya
      // VERSI_BENTUK (bentuk data berubah, bukan isi sumbernya), menulis
      // `diperbarui = sekarang` akan membuat halaman mengaku punya pembaruan
      // yang tidak pernah terjadi — persis pelanggaran yang dijaga bagian
      // "Batas kejujuran" di catatan proyek. Isi artikelnya sama, hanya
      // metadatanya yang sekarang lengkap.
      const sumberBerubah = !diMemori || sidikBaru !== diMemori.sidik

      const hasil = {
        ...isi,
        pool,
        geser: 0,
        sidik: sidikBaru,
        versiBentuk: VERSI_BENTUK,
        diperbarui: sumberBerubah ? sekarangISO() : (diMemori?.diperbarui ?? sekarangISO()),
        diperiksa: sekarangISO(),
        berikutnya: besokISO(),
      }
      diMemori = hasil
      await simpanKeDisk(hasil)
      // Simpan juga ke database — OPSIONAL. Kalau MariaDB mati, hasilnya null
      // dan berkas JSON di atas tetap jadi sumber kebenarannya. Tidak pernah
      // melempar, jadi jalur konten tidak bisa rusak karena database.
      await sinkronKeDb(hasil)
      return hasil
    } catch (e) {
      // sumber sedang bermasalah: pakai simpanan lama kalau ada, dan JANGAN
      // tandai sudah dicek supaya dicoba lagi pada permintaan berikutnya
      const lama = diMemori ?? (await bacaDariDisk())
      if (lama) return lama
      throw e
    } finally {
      sedangMengambil = null
    }
  })()

  return sedangMengambil
}

/**
 * Untuk endpoint /api/konten.
 *
 *   diperbarui  = kapan DAFTAR artikel dari sumber berubah (sidik berubah).
 *                 Ini BUKAN tanggal artikel, dan bukan tanggal penerbitan apa
 *                 pun. Namanya sengaja dipertahankan supaya kontrak API tidak
 *                 berubah, tapi antarmuka tidak boleh menyebutnya "diperbarui"
 *                 tanpa keterangan — lihat `tanggalArtikelTerbaru`.
 *   diperiksa   = kapan sistem terakhir mengecek sumbernya
 *   berikutnya  = kapan pengecekan berikutnya dijadwalkan
 *   tanggalArtikelTerbaru = tanggal terbit PALING BARU di antara artikel yang
 *                 sedang tampil, atau null kalau tidak satu pun punya tanggal.
 *                 Ini satu-satunya angka yang menjawab "isinya setua apa".
 */
export async function kontenHarianLengkap({ paksa = false } = {}) {
  const d = await kontenHarian({ paksa })
  // Yang TIDAK dikirim ke tampilan:
  //   - pool          : isinya besar dan tidak dipakai
  //   - geser         : hitungan putaran internal (urutan tampil sudah jadi)
  //   - sidik         : sidik jari internal isi sumber; tidak ada gunanya bagi
  //                     pengguna dan membocorkan cara kerja pengecekan
  //   - sumberHalaman : alamat sumber internal (rilis berita Kemenkes + kanal
  //                     kesehatan CNN Indonesia). Alamat itu sudah tampil di
  //                     setiap artikel lewat kolom `url`, jadi tidak perlu
  //                     dikirim lagi sebagai metadata.
  const { pool, sidik, sumberHalaman, geser, versiBentuk, ...kirim } = d

  // Tanggal terbit PALING BARU di antara artikel yang benar-benar tampil.
  // Dihitung dari `artikel` (bukan dari seluruh pool): yang perlu dijawab
  // adalah "bacaan di halaman ini setua apa", bukan "artikel tertua yang
  // kebetulan tersimpan".
  const tanggalArtikelTerbaru =
    (kirim.artikel ?? [])
      .map((a) => a.tanggalTerbitISO)
      .filter(Boolean)
      .sort()
      .at(-1) ?? null

  return {
    ...kirim,
    tanggalArtikelTerbaru,
    jumlahTersimpan: pool?.length ?? 0,
    // Jam acuan yang dipakai penjadwalan — supaya bisa diperiksa dari luar,
    // bukan cuma dipercaya. `sumber` = 'internet' kalau header Date dari
    // sumber berhasil dibaca, 'mesin' kalau jatuh ke cadangan.
    jam: {
      sumber: jamInternetTerbaca() ? 'internet' : 'mesin',
      selisihDetik: Math.round(selisihJam() / 1000),
    },
  }
}
