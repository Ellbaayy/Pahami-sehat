/**
 * Pustaka — sumber resmi kesehatan + jurnal & publikasi ilmiah.
 *
 * KENAPA MODUL TERPISAH: `konten.js` mengurus "konten harian" yang tampil di
 * Beranda (topik, artikel, tips) dan aturannya sekali sehari. Modul ini
 * mengurus dua hal lain yang sifatnya katalog: daftar lembaga resmi beserta
 * kabar terbarunya, dan daftar jurnal ilmiah beserta tulisan terbarunya.
 *
 * SEMUA ALAMAT DI BAWAH DIUKUR, BUKAN DIASUMSIKAN (1 Nov 2026). Yang tidak
 * bisa diambil otomatis DITULIS APA ADANYA lewat `kanal: 'tautan'` beserta
 * sebabnya — bukan disembunyikan, dan bukan pula ditebak isinya.
 *
 * Kanal yang dipakai:
 *   - 'rss'      : umpan RSS/Atom resmi milik lembaga/penerbit itu sendiri
 *   - 'kemkes'   : halaman rilis berita Kemenkes (HTML biasa, bukan RSS)
 *   - 'crossref' : API Crossref (metadata resmi penerbit, dicari lewat ISSN)
 *   - 'pubmed'   : E-utilities NCBI/NLM (PubMed)
 *   - 'tautan'   : tidak ada jalur mesin yang bisa dipakai; hanya tautan resmi
 */

const UA =
  'PahamiSehat/1.0 (pendidikan kesehatan; +https://github.com/Ellbaayy/Pahami-sehat)'

/** Umur simpanan. Katalog boleh lebih jarang disegarkan daripada Beranda. */
const TTL_MS = 3 * 60 * 60 * 1000

/** Batas jumlah butir yang diambil per lembaga/jurnal. */
const MAKS_ITEM = 4

/* ------------------------------------------------------------ definisi -- */

/**
 * Sepuluh platform kesehatan yang diminta ada di aplikasi.
 *
 * `kategori` membagi tampilan menjadi Nasional & Internasional.
 * `url` adalah alamat yang BENAR-BENAR dipanggil (umpan/API) bila ada;
 * `situs` adalah halaman resmi yang ditautkan ke pengguna.
 */
export const SUMBER_RESMI = [
  {
    id: 'kemenkes',
    nama: 'Kementerian Kesehatan RI',
    singkat: 'Kemenkes',
    kategori: 'nasional',
    situs: 'https://kemkes.go.id/id/category/rilis-berita',
    url: 'https://kemkes.go.id/id/category/rilis-berita',
    kanal: 'kemkes',
  },
  {
    id: 'bpom',
    nama: 'Badan Pengawas Obat dan Makanan',
    singkat: 'BPOM RI',
    kategori: 'nasional',
    situs: 'https://www.bpom.go.id/',
    url: null,
    kanal: 'tautan',
    catatan:
      'Alamat resminya tidak menjawab saat diukur 1 November 2026: nama domainnya tidak ditemukan di DNS (diperiksa lewat penyedia DNS publik, bukan hanya jaringan lokal). Karena itu aplikasi hanya menautkan ke situs resminya dan tidak menampilkan isi yang tidak dapat dipastikan.',
  },
  {
    id: 'bkpk',
    nama: 'Badan Kebijakan Pembangunan Kesehatan',
    singkat: 'BKPK',
    kategori: 'nasional',
    situs: 'https://bkpk.kemkes.go.id/',
    url: null,
    kanal: 'tautan',
    catatan:
      'Subdomain resminya tidak dapat dihubungi saat diukur 1 November 2026 (delegasi DNS-nya tidak menjawab). Aplikasi menautkan ke alamat resminya tanpa menampilkan isi.',
  },
  {
    id: 'brin',
    nama: 'Badan Riset dan Inovasi Nasional',
    singkat: 'BRIN',
    kategori: 'nasional',
    situs: 'https://brin.go.id/news',
    url: null,
    kanal: 'tautan',
    catatan:
      'Halaman beritanya dirakit di peramban dengan JavaScript, sehingga daftar judulnya tidak ada di HTML yang dikirim ke server. Aplikasi menautkan langsung ke halaman berita resminya.',
  },
  {
    id: 'satusehat',
    nama: 'SATUSEHAT',
    singkat: 'SATUSEHAT',
    kategori: 'nasional',
    situs: 'https://satusehat.kemkes.go.id/',
    url: null,
    kanal: 'tautan',
    catatan:
      'Situsnya berupa gerbang layanan yang dirakit dengan JavaScript dan tidak menyediakan umpan berita. Aplikasi menautkan ke alamat resminya.',
  },
  {
    id: 'who',
    nama: 'World Health Organization',
    singkat: 'WHO',
    kategori: 'internasional',
    situs: 'https://www.who.int/news',
    url: 'https://www.who.int/rss-feeds/news-english.xml',
    kanal: 'rss',
  },
  {
    id: 'cdc',
    nama: 'Centers for Disease Control and Prevention',
    singkat: 'CDC',
    kategori: 'internasional',
    situs: 'https://www.cdc.gov/newsroom',
    url: 'https://tools.cdc.gov/api/v2/resources/media/132608.rss',
    kanal: 'rss',
  },
  {
    id: 'nih',
    nama: 'National Institutes of Health',
    singkat: 'NIH',
    kategori: 'internasional',
    situs: 'https://www.nih.gov/news-events/news-releases',
    url: null,
    kanal: 'tautan',
    catatan:
      'Situsnya menolak permintaan otomatis (HTTP 403) saat diukur 1 November 2026, jadi beritanya tidak dapat diambil langsung. Publikasi ilmiah NIH tetap terbaca lewat PubMed — layanan Perpustakaan Kedokteran Nasional NIH — di menu Jurnal.',
  },
  {
    id: 'ecdc',
    nama: 'European Centre for Disease Prevention and Control',
    singkat: 'ECDC',
    kategori: 'internasional',
    situs: 'https://www.ecdc.europa.eu/en/news-events',
    url: 'https://www.ecdc.europa.eu/en/taxonomy/term/1307/feed',
    kanal: 'rss',
  },
  {
    id: 'nhs',
    nama: 'National Health Service (NHS England)',
    singkat: 'NHS',
    kategori: 'internasional',
    situs: 'https://www.england.nhs.uk/news/',
    url: 'https://www.england.nhs.uk/feed/',
    kanal: 'rss',
  },
]

/**
 * Enam jurnal & basis publikasi ilmiah.
 *
 * Kanal berbeda-beda karena tidak semuanya membuka jalur yang sama — dan itu
 * diukur, bukan dipilih sembarangan:
 *   - Nature Medicine & BMJ punya umpan RSS resmi yang hidup.
 *   - The Lancet & JAMA memblokir permintaan otomatis, jadi metadatanya
 *     dibaca dari Crossref (registri DOI resmi yang dipakai penerbitnya).
 *   - PubMed & Cochrane dibaca lewat E-utilities NCBI.
 */
export const JURNAL = [
  {
    id: 'pubmed',
    nama: 'PubMed',
    penerbit: 'National Library of Medicine (NIH)',
    situs: 'https://pubmed.ncbi.nlm.nih.gov/',
    kanal: 'pubmed',
    kueri: '(health literacy[Title]) OR (public health[Title])',
  },
  {
    id: 'lancet',
    nama: 'The Lancet',
    penerbit: 'Elsevier',
    situs: 'https://www.thelancet.com/',
    kanal: 'crossref',
    issn: '0140-6736',
  },
  {
    id: 'nature-medicine',
    nama: 'Nature Medicine',
    penerbit: 'Nature Portfolio',
    situs: 'https://www.nature.com/nm/',
    kanal: 'rss',
    url: 'https://www.nature.com/nm.rss',
  },
  {
    id: 'bmj',
    nama: 'The BMJ',
    penerbit: 'BMJ Publishing Group',
    situs: 'https://www.bmj.com/',
    kanal: 'rss',
    url: 'https://www.bmj.com/rss/recent.xml',
  },
  {
    id: 'jama',
    nama: 'JAMA Network',
    penerbit: 'American Medical Association',
    situs: 'https://jamanetwork.com/',
    kanal: 'crossref',
    issn: '0098-7484',
  },
  {
    id: 'cochrane',
    nama: 'Cochrane Library',
    penerbit: 'Cochrane Collaboration',
    situs: 'https://www.cochranelibrary.com/',
    kanal: 'pubmed',
    kueri: '"Cochrane Database Syst Rev"[jour]',
  },
]

/* ---------------------------------------------------------------- util -- */

/** Buang tag + rapikan spasi. Dipakai untuk judul/ringkasan dari umpan. */
export function buangTag(teks) {
  return String(teks ?? '')
    .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, '$1')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'")
    .replace(/\s+/g, ' ')
    .trim()
}

const BULAN = {
  jan: 1, feb: 2, mar: 3, apr: 4, may: 5, mei: 5, jun: 6, jul: 7,
  aug: 8, agu: 8, sep: 9, oct: 10, okt: 10, nov: 11, dec: 12, des: 12,
}

/**
 * Ubah tanggal apa pun yang lazim di umpan menjadi ISO `YYYY-MM-DD`.
 * Mengembalikan null kalau tidak terbaca — TIDAK menebak hari ini.
 */
export function keISO(nilai) {
  const t = String(nilai ?? '').trim()
  if (!t) return null
  // sudah ISO
  const iso = t.match(/^(\d{4})-(\d{2})-(\d{2})/)
  if (iso) return `${iso[1]}-${iso[2]}-${iso[3]}`
  // "Tue, 22 Sep 2026 08:00:00 GMT" / "30 October 2026"
  const m = t.match(/(\d{1,2})\s+([A-Za-z]{3,9})\.?\s+(\d{4})/)
  if (m) {
    const bulan = BULAN[m[2].slice(0, 3).toLowerCase()]
    if (bulan) return `${m[3]}-${String(bulan).padStart(2, '0')}-${String(m[1]).padStart(2, '0')}`
  }
  // "2026 Oct 30" (bentuk PubMed)
  const p = t.match(/^(\d{4})\s+([A-Za-z]{3})\s+(\d{1,2})/)
  if (p) {
    const bulan = BULAN[p[2].slice(0, 3).toLowerCase()]
    if (bulan) return `${p[1]}-${String(bulan).padStart(2, '0')}-${String(p[3]).padStart(2, '0')}`
  }
  return null
}

async function ambilSekali(url, timeoutMs) {
  const res = await fetch(url, {
    headers: {
      'User-Agent': UA,
      Accept: 'application/rss+xml, application/xml, application/json, text/html;q=0.8',
      'Accept-Language': 'en,id;q=0.8',
    },
    signal: AbortSignal.timeout(timeoutMs),
    redirect: 'follow',
  })
  if (!res.ok) throw new Error(`HTTP ${res.status}`)
  return res.text()
}

function jeda(ms) {
  return new Promise((r) => {
    setTimeout(r, ms)
  })
}

/**
 * Ambil teks dengan cobaan ulang untuk kegagalan SEMENTARA.
 *
 * KENAPA: diukur 1 Nov 2026 — Crossref dan NCBI sama-sama menjawab **HTTP 429**
 * ketika katalog diambil (enam jurnal sekaligus, beberapa permintaan dalam
 * hitungan detik). Tanpa cobaan ulang, satu jurnal tampil "gagal" padahal
 * layanannya sehat dan permintaan yang sama berhasil beberapa detik kemudian.
 *
 * Hanya 429/5xx yang diulang; 404/403 tidak akan berubah dan langsung dilempar.
 */
async function ambil(url, timeoutMs = 20000, percobaan = 3) {
  let terakhir
  for (let i = 0; i < percobaan; i += 1) {
    try {
      return await ambilSekali(url, timeoutMs)
    } catch (e) {
      terakhir = e
      if (!/HTTP (429|5\d\d)/.test(String(e?.message))) break
      await jeda(700 * (i + 1))
    }
  }
  throw terakhir ?? new Error('tidak ada balasan')
}

/* -------------------------------------------------------------- pengurai -- */

/**
 * Pengurai RSS/Atom sederhana. Cukup untuk umpan-umpan yang dipakai di sini,
 * dan sengaja tanpa dependensi baru.
 */
export function uraiRss(xml, maks = MAKS_ITEM) {
  const teks = String(xml ?? '')
  const blok = [
    ...teks.matchAll(/<item[\s>][\s\S]*?<\/item>/gi),
    ...teks.matchAll(/<entry[\s>][\s\S]*?<\/entry>/gi),
  ]
  const hasil = []
  for (const b of blok.slice(0, maks)) {
    const isi = b[0]
    const judul = buangTag(isi.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1] ?? '')
    if (!judul) continue

    // tautan: <link>teks</link> (RSS) atau <link href="..."/> (Atom)
    const tautan =
      isi.match(/<link[^>]*href="([^"]+)"/i)?.[1] ??
      buangTag(isi.match(/<link[^>]*>([\s\S]*?)<\/link>/i)?.[1] ?? '') ??
      ''

    const mentah = buangTag(
      isi.match(/<pubDate[^>]*>([\s\S]*?)<\/pubDate>/i)?.[1] ??
        isi.match(/<updated[^>]*>([\s\S]*?)<\/updated>/i)?.[1] ??
        isi.match(/<published[^>]*>([\s\S]*?)<\/published>/i)?.[1] ??
        isi.match(/<dc:date[^>]*>([\s\S]*?)<\/dc:date>/i)?.[1] ??
        '',
    )

    // Sebagian umpan (mis. Nature) menaruh tanggal di dalam isi, bukan di
    // elemen tersendiri: "Published online: 30 October 2026".
    const isiTeks = buangTag(isi.match(/<content:encoded[^>]*>([\s\S]*?)<\/content:encoded>/i)?.[1] ?? '')
    const dariIsi = isiTeks.match(/Published online:\s*([0-9]{1,2}\s+\w+\s+[0-9]{4})/i)?.[1] ?? ''

    const ringkas = buangTag(
      isi.match(/<description[^>]*>([\s\S]*?)<\/description>/i)?.[1] ?? '',
    ).slice(0, 260)

    hasil.push({
      judul: judul.slice(0, 220),
      tautan: String(tautan).trim(),
      tanggal: keISO(mentah || dariIsi),
      ringkas,
    })
  }
  return hasil
}

/** Pengurai balasan Crossref (`/journals/{ISSN}/works`). */
export function uraiCrossref(json, maks = MAKS_ITEM) {
  let isi
  try {
    isi = typeof json === 'string' ? JSON.parse(json) : json
  } catch {
    return []
  }
  const butir = isi?.message?.items
  if (!Array.isArray(butir)) return []
  return butir.slice(0, maks).map((b) => {
    const bagian = b?.published?.['date-parts']?.[0] ?? b?.['issued']?.['date-parts']?.[0] ?? []
    const [th, bl, hr] = bagian
    const tanggal = th
      ? `${th}-${String(bl ?? 1).padStart(2, '0')}-${String(hr ?? 1).padStart(2, '0')}`
      : null
    const penulis = (b?.author ?? [])
      .slice(0, 2)
      .map((a) => a?.family || a?.name || '')
      .filter(Boolean)
      .join(', ')
    return {
      judul: buangTag((b?.title ?? [''])[0]).slice(0, 220),
      tautan: b?.URL || (b?.DOI ? `https://doi.org/${b.DOI}` : ''),
      tanggal,
      penulis,
      jurnal: buangTag((b?.['container-title'] ?? [''])[0]),
    }
  })
}

/**
 * Pengurai dua balasan PubMed: `esearch` (daftar id) + `esummary` (metadata).
 * Dipisah begini supaya bisa diuji tanpa jaringan.
 */
export function uraiPubmed(esearch, esummary, maks = MAKS_ITEM) {
  let cari, ringkas
  try {
    cari = typeof esearch === 'string' ? JSON.parse(esearch) : esearch
    ringkas = typeof esummary === 'string' ? JSON.parse(esummary) : esummary
  } catch {
    return []
  }
  const ids = cari?.esearchresult?.idlist
  const hasil = ringkas?.result
  if (!Array.isArray(ids) || !hasil) return []

  return ids
    .slice(0, maks)
    .map((id) => {
      const r = hasil[id]
      if (!r) return null
      // `elocationid` berbentuk "doi: 10.1002/14651858.CD016408"
      const doi = String(r.elocationid ?? '').match(/doi:\s*(\S+)/i)?.[1] ?? ''
      const penulis = (r.authors ?? [])
        .slice(0, 2)
        .map((a) => a?.name ?? '')
        .filter(Boolean)
        .join(', ')
      return {
        judul: buangTag(r.title).replace(/\.$/, ''),
        tautan: doi ? `https://doi.org/${doi}` : `https://pubmed.ncbi.nlm.nih.gov/${id}/`,
        tanggal: keISO(r.pubdate),
        penulis,
        jurnal: buangTag(r.source),
      }
    })
    .filter(Boolean)
}

/* ------------------------------------------------------- pengambilan ----- */

/**
 * Antrean khusus NCBI (PubMed).
 *
 * KENAPA: E-utilities membatasi laju (tanpa kunci API: 3 permintaan/detik).
 * Diukur 1 Nov 2026: empat permintaan yang dikirim bersamaan — dua jurnal yang
 * memakai PubMed, masing-masing esearch + esummary — membuat salah satunya
 * dijawab **HTTP 429** dan jurnalnya tampil "gagal" padahal layanannya sehat.
 *
 * Jadi seluruh permintaan NCBI dilewatkan satu antrean dengan jeda, dan
 * kegagalan sementara dicoba ulang. Kalau nanti kunci API NCBI dipakai, batas
 * ini boleh dinaikkan — tapi jangan dihapus tanpa mengukur ulang.
 */
let rantaiNcbi = Promise.resolve()

function ncbi(url) {
  const tugas = rantaiNcbi.then(async () => {
    await jeda(400)
    return ambil(url)
  })
  // Rantai tidak boleh putus karena satu kegagalan.
  rantaiNcbi = tugas.catch(() => {})
  return tugas
}

/**
 * Antrean Crossref. Dua jurnal memakai Crossref (The Lancet, JAMA) dan
 * keduanya diambil bersamaan; tanpa jeda, permintaan kedua dijawab 429.
 */
let rantaiCrossref = Promise.resolve()

function crossref(url) {
  const tugas = rantaiCrossref.then(async () => {
    await jeda(300)
    return ambil(url)
  })
  rantaiCrossref = tugas.catch(() => {})
  return tugas
}

async function ambilRss(sumber) {
  const xml = await ambil(sumber.url)
  const item = uraiRss(xml).filter((x) => x.judul)
  if (!item.length) throw new Error('umpan tidak memuat butir')
  return item
}

async function ambilKemkes(sumber) {
  // Pengurainya sudah ada di konten.js dan sudah diuji di sana — dipakai ulang
  // supaya bentuk kartu Kemenkes tidak diuraikan dua kali dengan cara berbeda.
  const { uraiDaftarKemkes } = await import('./konten.js')
  const html = await ambil(sumber.url)
  const item = uraiDaftarKemkes(html).slice(0, MAKS_ITEM).map((a) => ({
    judul: a.judul,
    tautan: a.url,
    tanggal: a.tanggalTerbitISO ?? null,
    ringkas: '',
  }))
  if (!item.length) throw new Error('halaman rilis berita tidak memuat kartu')
  return item
}

async function ambilCrossref(jurnal) {
  const url =
    `https://api.crossref.org/journals/${jurnal.issn}/works` +
    '?rows=4&sort=published&order=desc&select=title,published,DOI,container-title,author,URL'
  const teks = await crossref(url)
  const item = uraiCrossref(teks)
  if (!item.length) throw new Error('Crossref tidak mengembalikan butir')
  return item
}

async function ambilPubmed(jurnal) {
  const kueri = encodeURIComponent(jurnal.kueri)
  const cari = await ncbi(
    `https://eutils.ncbi.nlm.nih.gov/entrez/eutils/esearch.fcgi?db=pubmed&retmode=json&retmax=4&sort=date&term=${kueri}&tool=pahami-sehat`,
  )
  let ids
  try {
    ids = JSON.parse(cari)?.esearchresult?.idlist ?? []
  } catch {
    throw new Error('balasan esearch tidak terbaca')
  }
  if (!ids.length) throw new Error('PubMed tidak menemukan artikel')
  const ringkas = await ncbi(
    `https://eutils.ncbi.nlm.nih.gov/entrez/eutils/esummary.fcgi?db=pubmed&retmode=json&id=${ids.join(',')}&tool=pahami-sehat`,
  )
  const item = uraiPubmed(cari, ringkas)
  if (!item.length) throw new Error('esummary tidak mengembalikan butir')
  return item
}

const PENGAMBIL = {
  rss: ambilRss,
  kemkes: ambilKemkes,
  crossref: ambilCrossref,
  pubmed: ambilPubmed,
}

/**
 * Ambil satu sumber/jurnal.
 *
 * TIDAK PERNAH melempar: kegagalan satu kanal hanya membuat statusnya
 * "gagal" dengan sebabnya, dan kanal lain tetap tampil. Halaman katalog tidak
 * boleh kosong hanya karena satu lembaga sedang tidak bisa dihubungi.
 */
async function ambilSatu(def, jenis) {
  const dasar = {
    id: def.id,
    nama: def.nama,
    situs: def.situs,
    kanal: def.kanal,
    item: [],
  }
  if (jenis === 'jurnal') dasar.penerbit = def.penerbit
  if (jenis === 'sumber') {
    dasar.singkat = def.singkat
    dasar.kategori = def.kategori
  }

  // Sumber yang memang hanya bisa ditautkan.
  if (def.kanal === 'tautan') {
    return { ...dasar, status: 'tautan', catatan: def.catatan ?? '' }
  }

  try {
    const ambilFn = PENGAMBIL[def.kanal]
    if (!ambilFn) throw new Error(`kanal tidak dikenal: ${def.kanal}`)
    const item = await ambilFn(def)
    return { ...dasar, status: 'terhubung', catatan: '', item }
  } catch (e) {
    return {
      ...dasar,
      status: 'gagal',
      catatan: `Tidak dapat diambil saat pemeriksaan terakhir (${e?.message ?? 'galat tidak diketahui'}).`,
    }
  }
}

/* --------------------------------------------------------------- simpanan -- */

let diMemori = null
let sedangMengambil = null

function berkasCache() {
  return process.env.CACHE_PUSTAKA ?? new URL('../.cache-pustaka.json', import.meta.url).pathname
}

async function bacaDariDisk() {
  try {
    const { readFile } = await import('node:fs/promises')
    const teks = await readFile(berkasCache(), 'utf8')
    const data = JSON.parse(teks)
    return data && Array.isArray(data.sumber) ? data : null
  } catch {
    return null
  }
}

async function simpanKeDisk(data) {
  try {
    const { writeFile } = await import('node:fs/promises')
    await writeFile(berkasCache(), JSON.stringify(data), 'utf8')
  } catch {
    // Gagal menyimpan bukan alasan menggagalkan permintaan: data tetap
    // dikirim ke pengguna dari memori.
  }
}

function segar(data) {
  if (!data?.diperiksa) return false
  const umur = Date.now() - new Date(data.diperiksa).getTime()
  return Number.isFinite(umur) && umur >= 0 && umur < TTL_MS
}

/** Susun daftar: satu bagian untuk sumber resmi, satu untuk jurnal. */
async function ambilSemua() {
  const [sumber, jurnal] = await Promise.all([
    Promise.all(SUMBER_RESMI.map((s) => ambilSatu(s, 'sumber'))),
    Promise.all(JURNAL.map((j) => ambilSatu(j, 'jurnal'))),
  ])
  return {
    diperiksa: new Date().toISOString(),
    sumber: sumber.sort((a, b) => {
      // nasional dulu, lalu internasional; di dalamnya sesuai urutan definisi
      const urutan = { nasional: 0, internasional: 1 }
      return (urutan[a.kategori] ?? 2) - (urutan[b.kategori] ?? 2)
    }),
    jurnal,
  }
}

/**
 * Katalog lengkap, dengan simpanan 3 jam.
 *
 * @param {{ paksa?: boolean }} opsi
 */
export async function pustakaLengkap({ paksa = false } = {}) {
  if (!diMemori) diMemori = await bacaDariDisk()
  if (!paksa && diMemori && segar(diMemori)) return diMemori
  if (sedangMengambil) return sedangMengambil

  sedangMengambil = (async () => {
    try {
      const hasil = await ambilSemua()
      diMemori = hasil
      await simpanKeDisk(hasil)
      return hasil
    } finally {
      sedangMengambil = null
    }
  })()
  return sedangMengambil
}

/** Hanya untuk uji: kosongkan simpanan memori. */
export function _kosongkanSimpanan() {
  diMemori = null
  sedangMengambil = null
}
