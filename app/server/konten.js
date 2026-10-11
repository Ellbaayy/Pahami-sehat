/**
 * Konten harian: topik populer, artikel, dan tips kesehatan.
 *
 * Sumber: ayosehat.kemkes.go.id — kanal edukasi resmi Kemenkes RI.
 * Dipilih karena isinya sudah berupa artikel kesehatan berbahasa Indonesia,
 * judulnya bersih (bukan berita politik), setiap artikel punya tautan asli
 * yang bisa dibuka pengguna, dan gambarnya tersedia.
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

const UA =
  'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120 Safari/537.36'

const SUMBER = 'https://ayosehat.kemkes.go.id'
const PENERBIT = 'Kemenkes RI'
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
 * Angka 8 dipilih dari kebutuhan nyata `susun()`: 5 topik + 4 artikel
 * (beririsan) + 1 calon tips, ditambah cadangan untuk artikel yang gagal
 * diambil. Karena `gabungPool()` menaruh artikel terbaru di depan, delapan
 * yang diambil selalu yang paling baru — jadi kesegaran isi tetap terjaga.
 */
const MAKS_DETAIL = 8

/* ------------------------------------------------------------------ util -- */

async function ambil(url, timeoutMs = 15000) {
  const res = await fetch(url, {
    headers: { 'User-Agent': UA, 'Accept-Language': 'id,en;q=0.8' },
    signal: AbortSignal.timeout(timeoutMs),
    redirect: 'follow',
  })
  if (!res.ok) throw new Error(`HTTP ${res.status}`)
  return res.text()
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
  let t = String(judul).split(/[:(]/)[0].trim()

  // buang pembuka yang tidak perlu
  t = t.replace(/^(kenali|mengenal|cara|tips|yuk|mari|waspadai|hati-hati)\s+/i, '')
  t = t.replace(/^(apa itu|apa sih|apa yang dimaksud dengan)\s+/i, '')

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

/** Potong di batas kalimat supaya tidak menggantung. */
function potongKalimat(teks, maks) {
  const t = String(teks ?? '').trim()
  if (t.length <= maks) return t
  const potong = t.slice(0, maks)
  const titik = Math.max(potong.lastIndexOf('. '), potong.lastIndexOf('? '), potong.lastIndexOf('! '))
  if (titik > maks * 0.5) return potong.slice(0, titik + 1)
  // Tidak ada batas kalimat di paruh kedua: mundur ke batas KATA. Berhenti di
  // tengah kata pernah menghasilkan teks seperti "…kurang disukai ba".
  const spasi = potong.lastIndexOf(' ')
  const rapi = (spasi > 0 ? potong.slice(0, spasi) : potong).replace(/[\s,;:\-–—]+$/, '')
  return `${rapi}…`
}

/** Ambil kalimat-kalimat awal sebagai butir ringkas (bukan karangan). */
function butirDari(teks, maks = 3) {
  return String(teks ?? '')
    .split(/(?<=[.!?])\s+/)
    .map((s) => s.trim())
    // wajib diakhiri tanda baca: kalimat sisa dari teks yang terpotong
    // (mis. "Jika aktivitas tersebut baik, tentunya p") hanya membingungkan.
    .filter((s) => s.length > 25 && s.length < 110 && /[.!?]$/.test(s))
    .slice(0, maks)
}

/* ----------------------------------------------- LANGKAH: Cari Informasi -- */

/** Daftar artikel dari halaman depan ayosehat. */
async function daftarArtikel() {
  const html = await ambil(SUMBER)
  const kartu = [
    ...html.matchAll(
      /<a[^>]+href="(https:\/\/ayosehat\.kemkes\.go\.id\/[a-z0-9\-]+)"[^>]*>([\s\S]{0,600}?)<\/a>/gi,
    ),
  ]

  const hasil = []
  const sudah = new Set()

  for (const m of kartu) {
    const url = m[1]
    const isi = m[2]
    const slug = url.replace(`${SUMBER}/`, '')
    if (sudah.has(slug)) continue

    const judul = buangTag(isi)
    if (!judul || judul.length < 12 || judul.length > 160) continue

    // buang halaman non-artikel
    if (/^(cek kesehatan gratis|kampanye|kontak|tentang|kebijakan)/i.test(judul)) continue

    const img = isi.match(
      /src="(\/\/ayosehat\.kemkes\.go\.id\/imagex\/content\/[^"]+\.(?:webp|jpg|jpeg|png))"/i,
    )
    sudah.add(slug)
    hasil.push({ slug, url, judul, gambar: img ? `https:${img[1]}` : '' })
  }

  return hasil
}

/** Ringkasan resmi + paragraf pembuka satu artikel. */
async function isiArtikel(item) {
  const html = await ambil(item.url, 15000)

  const desc = buangTag(
    html.match(/<meta\s+name="description"\s+content="([^"]*)"/i)?.[1] ??
      html.match(/<meta\s+property="og:description"\s+content="([^"]*)"/i)?.[1] ??
      '',
  )

  // gambar: halaman depan tidak selalu memuat gambarnya, jadi kalau kosong
  // ambil dari og:image halaman artikelnya sendiri
  let gambar = item.gambar || ''
  if (!gambar) {
    const og = html.match(/(?:property|name)="og:image"[^>]*content="([^"]*imagex[^"]*)"/i)?.[1]
    if (og) gambar = og.startsWith('//') ? `https:${og}` : og
  }

  const isiUtama =
    html.match(/<(?:article|main)[^>]*>([\s\S]*?)<\/(?:article|main)>/i)?.[1] ?? html
  const paragraf = [...isiUtama.matchAll(/<p[^>]*>([\s\S]*?)<\/p>/gi)]
    .map((p) => buangTag(p[1]))
    .filter((p) => p.length > 70 && !/^(baca juga|sumber|referensi|penulis|editor)/i.test(p))

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
  return {
    ringkas: potongKalimat(ringkas, 260),
    tubuh: potongKalimat(gabung, 900),
    gambar,
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

/** Ubah kumpulan artikel jadi bentuk yang dipakai tampilan. */
function susun(pool) {
  const siap = pool.filter((d) => d.ringkas || d.tubuh)

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
      source: PENERBIT,
      url: d.url,
      gambar: d.gambar || '',
      readTime: waktuBaca(d.tubuh || d.ringkas),
    }
  })

  // tips diambil dari artikel yang kalimatnya paling pas dipakai sebagai
  // butir — jadi isinya memang kalimat sumber, bukan buatan
  let tips = null
  for (const d of siap) {
    // Artikel yang isinya masih kepotong (ditandai "…") tidak layak jadi tips:
    // butirnya cuma kalimat sisa.
    if (/…$/.test(d.tubuh ?? '')) continue
    const butir = butirDari(d.tubuh, 3)
    if (butir.length >= 2) {
      tips = {
        label: 'Tips Kesehatan Hari Ini',
        title: d.judul,
        body: d.ringkas || potongKalimat(d.tubuh, 260),
        bullets: butir,
        // teks lanjutan untuk tombol "Baca selengkapnya" — tetap dari sumber,
        // bukan tulisan tetap di dalam komponen
        selengkapnya: potongKalimat(d.tubuh, 900),
        source: PENERBIT,
        url: d.url,
      }
      break
    }
  }

  return { topik, artikel, tips, penerbit: PENERBIT, sumberHalaman: SUMBER }
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

const sekarangISO = () => new Date().toISOString()
const besokISO = () => new Date(Date.now() + BERLAKU_MS).toISOString()

/** Waktunya Pencarian Berikutnya? (lihat diagram) */
function waktunyaCek(data) {
  if (!data?.berikutnya) return true
  return Date.now() >= new Date(data.berikutnya).getTime()
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

  // 1) Waktunya Pencarian Berikutnya? -> Tidak: pakai yang sudah ada
  if (!paksa && diMemori && !waktunyaCek(diMemori)) return diMemori

  // kalau ada pengambilan lain sedang jalan, ikut menunggu hasil yang sama
  if (sedangMengambil) return sedangMengambil

  sedangMengambil = (async () => {
    try {
      // 2) Cari Informasi
      const daftar = await daftarArtikel()
      if (!daftar.length) throw new Error('daftar artikel kosong')
      const sidikBaru = buatSidik(daftar)

      // 3) Ada Informasi Terbaru?
      if (diMemori && sidikBaru === diMemori.sidik) {
        // Tidak -> jangan update. Cukup catat bahwa sistem sudah dicek.
        const sesudah = { ...diMemori, diperiksa: sekarangISO(), berikutnya: besokISO() }
        diMemori = sesudah
        await simpanKeDisk(sesudah)
        return sesudah
      }

      // 4) Ya -> Update Informasi.
      //    Hanya artikel yang belum punya detail yang perlu diambil, dan
      //    jumlahnya dibatasi MAKS_DETAIL (lihat catatan di atas konstanta itu).
      const pool = gabungPool(diMemori?.pool ?? [], daftar)
      let diambil = 0
      await Promise.all(
        pool.map(async (d) => {
          if (d.ringkas || d.tubuh) return
          if (diambil >= MAKS_DETAIL) return
          diambil += 1
          try {
            Object.assign(d, await isiArtikel(d))
          } catch {
            /* satu artikel gagal diambil tidak menghalangi yang lain */
          }
        }),
      )

      const isi = susun(pool)
      if (!isi.topik.length && !isi.artikel.length) throw new Error('hasil kosong')

      const hasil = {
        ...isi,
        pool,
        sidik: sidikBaru,
        diperbarui: sekarangISO(),
        diperiksa: sekarangISO(),
        berikutnya: besokISO(),
      }
      diMemori = hasil
      await simpanKeDisk(hasil)
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
 *   diperbarui  = kapan isinya benar-benar berubah
 *   diperiksa   = kapan sistem terakhir mengecek sumbernya
 *   berikutnya  = kapan pengecekan berikutnya dijadwalkan
 */
export async function kontenHarianLengkap({ paksa = false } = {}) {
  const d = await kontenHarian({ paksa })
  // `pool` tidak dikirim ke tampilan — isinya besar dan tidak dipakai
  const { pool, ...kirim } = d
  return { ...kirim, jumlahTersimpan: pool?.length ?? 0 }
}
