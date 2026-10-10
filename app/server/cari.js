/**
 * Pencarian sumber untuk Pahami Sehat.
 *
 * Kenapa bukan mesin pencari umum:
 *   DuckDuckGo, Mojeek, dan Ecosia menolak permintaan dari server hosting
 *   (HTTP 403 di Vercel), sedangkan SearXNG publik membalas halaman kosong.
 *   Sudah diuji langsung dari server produksi lewat /api/probe.
 *
 * Yang dipakai — semuanya bisa diakses dari server mana pun:
 *   1. Wikipedia Indonesia (API resmi) — ringkasan artikel.
 *   2. Referensi resmi di dalam artikel Wikipedia (Kemenkes, WHO, BPOM, NIH).
 *      Inilah kuncinya: artikel kesehatan Wikipedia hampir selalu memuat
 *      tautan ke lembaga resmi, dan itu sumber yang bisa dicek pengguna.
 *   3. Isi halaman resmi diambil bila bisa diakses.
 *
 * Semua yang ditampilkan adalah URL nyata yang bisa dibuka pengguna.
 */

const UA =
  'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120 Safari/537.36'

/** Domain yang dianggap sumber resmi kesehatan. */
const RESMI = [
  'kemkes.go.id',
  'kemenkes.go.id',
  'who.int',
  'pom.go.id',
  'nih.gov',
  'ncbi.nlm.nih.gov',
  'pubmed.ncbi.nlm.nih.gov',
  'cdc.gov',
  'sehatnegeriku.kemkes.go.id',
  'ayosehat.kemkes.go.id',
  'p2p.kemkes.go.id',
]

const BATAS_ISI = 1500
const BATAS_REF = 6

/* --------------------------------------------------------------- simpanan -- */

/**
 * Simpanan sementara hasil pencarian.
 *
 * Kenapa perlu: Wikipedia membatasi jumlah permintaan dari satu alamat IP.
 * Uji coba menunjukkan panggilan beruntun membuat hasil pencarian kosong
 * secara diam-diam — permintaan pertama dapat 8 hasil, permintaan berikutnya
 * 0. Karena itu hasil yang sudah didapat disimpan sebentar dan dipakai ulang,
 * supaya pertanyaan yang sama (atau sering diulang saat menguji) tidak
 * menembak Wikipedia berkali-kali.
 */
const SIMPANAN = new Map()
const SIMPANAN_MS = 15 * 60 * 1000 // 15 menit
const SIMPANAN_MAKS = 200

function kunciSimpanan(q) {
  return String(q ?? '').toLowerCase().replace(/\s+/g, ' ').trim()
}

function ambilSimpanan(q) {
  const k = kunciSimpanan(q)
  const isi = SIMPANAN.get(k)
  if (!isi) return null
  if (Date.now() - isi.waktu > SIMPANAN_MS) {
    SIMPANAN.delete(k)
    return null
  }
  return isi.data
}

function simpanHasil(q, data) {
  const k = kunciSimpanan(q)
  if (!k) return
  if (SIMPANAN.size >= SIMPANAN_MAKS) {
    // buang yang paling lama
    const tertua = [...SIMPANAN.entries()].sort((a, b) => a[1].waktu - b[1].waktu)[0]
    if (tertua) SIMPANAN.delete(tertua[0])
  }
  SIMPANAN.set(k, { waktu: Date.now(), data })
}

/** Jeda kecil — dipakai supaya permintaan ke Wikipedia tidak beruntun. */
const jeda = (ms) => new Promise((r) => setTimeout(r, ms))

/* ------------------------------------------------------- antrean Wikipedia -- */

/**
 * Semua permintaan ke Wikipedia lewat SATU antrean, satu per satu.
 *
 * Kenapa: Wikipedia membalas HTTP 429 "You are making too many requests to the
 * API" kalau permintaan datang beruntun. Uji coba membuktikan ini: empat
 * permintaan beruntun langsung kena 429, dan setelah ~5 detik tenang baru
 * pulih. Dulu setiap pertanyaan menembak 5-6 permintaan sekaligus, jadi
 * pertanyaan ketiga dan seterusnya hampir selalu kosong — dan karena gagalnya
 * "diam-diam", tampak seolah-olah memang tidak ada sumber.
 *
 * Dua pengaman:
 *   1. JEDA_MIN — jarak paling sedikit antar permintaan (satu per satu).
 *   2. jedaPaksa — kalau kena 429, SELURUH antrean berhenti dulu beberapa
 *      detik, bukan hanya permintaan yang gagal itu.
 */
let antrean = Promise.resolve()
let terakhirPanggil = 0
let jedaPaksa = 0
const JEDA_MIN = 300

function lewatAntrean(fn) {
  const jalan = antrean.then(async () => {
    const sekarang = Date.now()
    const tunggu = Math.max(0, terakhirPanggil + JEDA_MIN - sekarang, jedaPaksa - sekarang)
    if (tunggu > 0) await jeda(tunggu)
    terakhirPanggil = Date.now()
    return fn()
  })
  // rantai tetap berjalan walau satu tugas gagal
  antrean = jalan.then(
    () => {},
    () => {},
  )
  return jalan
}

function resmikah(url) {
  try {
    const h = new URL(url).hostname.replace(/^www\./, '')
    return RESMI.some((d) => h === d || h.endsWith('.' + d))
  } catch {
    return false
  }
}

/**
 * Ambil JSON dari Wikipedia dengan pengaman.
 *
 * Menangani: (1) pembatasan 429 dengan mundur panjang, (2) percobaan ulang,
 * (3) balasan berisi "error" walau status HTTP 200, (4) halaman non-JSON.
 */
async function ambilJson(url, { percobaan = 3, timeoutMs = 12000 } = {}) {
  let terakhir = null
  for (let i = 0; i < percobaan; i++) {
    try {
      const res = await lewatAntrean(() =>
        fetch(url, {
          headers: { 'User-Agent': UA, 'Accept-Language': 'id,en;q=0.8' },
          signal: AbortSignal.timeout(timeoutMs),
        }),
      )

      if (res.status === 429) {
        // Jeda tetap 5 detik, tidak menaik. Uji coba: pembatasan Wikipedia
        // hilang setelah ~5 detik tenang, jadi menunggu 16 detik hanya
        // memperlambat tanpa menambah peluang berhasil.
        jedaPaksa = Date.now() + 5000
        throw new Error('HTTP 429 — pembatasan Wikipedia')
      }
      if (!res.ok) throw new Error(`HTTP ${res.status}`)

      const teks = await res.text()
      let data
      try {
        data = JSON.parse(teks)
      } catch {
        throw new Error('balasan bukan JSON')
      }
      if (data?.error) throw new Error(data.error.info || 'balasan berisi error')
      return data
    } catch (e) {
      terakhir = e
      if (i < percobaan - 1) await jeda(500)
    }
  }
  throw terakhir ?? new Error('gagal mengambil data')
}

async function ambil(url, timeoutMs = 12000) {
  const res = await fetch(url, {
    headers: { 'User-Agent': UA, 'Accept-Language': 'id,en;q=0.8' },
    signal: AbortSignal.timeout(timeoutMs),
    redirect: 'follow',
  })
  if (!res.ok) throw new Error(`HTTP ${res.status}`)
  return res.text()
}

/** Buang tag, script, dan gaya; sisakan teks yang bisa dibaca. */
function keTeks(html) {
  let s = html
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<noscript[\s\S]*?<\/noscript>/gi, ' ')
    .replace(/<nav[\s\S]*?<\/nav>/gi, ' ')
    .replace(/<footer[\s\S]*?<\/footer>/gi, ' ')
    .replace(/<header[\s\S]*?<\/header>/gi, ' ')
    .replace(/<!--[\s\S]*?-->/g, ' ')
  const inti = s.match(/<(?:article|main)[^>]*>([\s\S]*?)<\/(?:article|main)>/i)
  if (inti && inti[1].length > 400) s = inti[1]
  s = s
    .replace(/<(p|br|div|li|h[1-6]|tr)[^>]*>/gi, '\n')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&#39;|&apos;/g, "'")
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/[ \t]+/g, ' ')
    .replace(/\n\s*\n\s*\n+/g, '\n\n')
    .trim()
  return s
}

/** Buang baris yang jelas bukan isi (menu, iklan, komentar). */
function bersihkan(teks) {
  const baris = teks
    .split('\n')
    .map((b) => b.trim())
    .filter(
      (b) =>
        b.length > 45 &&
        !/^(share|bagikan|baca juga|lihat juga|iklan|advertisement|komentar|related|berlangganan|follow|subscribe)/i.test(b),
    )
  return baris.join('\n').slice(0, BATAS_ISI)
}

/** Kata penting dari pertanyaan (buang kata tanya dan kata umum). */
const KATA_UMUM = new Set([
  'apa', 'itu', 'yang', 'dan', 'atau', 'untuk', 'dari', 'ke', 'di', 'pada', 'dengan', 'adalah',
  'berapa', 'bagaimana', 'kapan', 'mengapa', 'kenapa', 'siapa', 'dimana', 'mana', 'ini',
  'the', 'what', 'how', 'when', 'why', 'who', 'which', 'is', 'are', 'of', 'to', 'in', 'on',
  'for', 'and', 'or', 'bisa', 'dapat', 'harus', 'tidak', 'kasus', 'tahun', 'terbaru', 'data',
])

function kataPenting(teks) {
  return String(teks)
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s]/gu, ' ')
    .split(/\s+/)
    .filter((k) => k.length > 3 && !KATA_UMUM.has(k))
}

/**
 * Saring artikel supaya yang tidak nyambung tidak ikut.
 * Kata penting wajib muncul di JUDUL — pernah kejadian pencarian "demam berdarah"
 * memunculkan artikel film dan artikel Ebola karena isinya menyebut istilah itu.
 */
function relevankah(item, kata) {
  if (!kata.length) return true
  const judul = String(item.judul ?? '').toLowerCase()
  const isi = String(item.ringkas ?? '').toLowerCase()
  return kata.some((k) => judul.includes(k)) && kata.some((k) => isi.includes(k))
}

/** Cari artikel Wikipedia Indonesia yang relevan. */
async function cariWikipedia(q, maks = 4) {
  // SATU permintaan saja: generator=search sekaligus mengembalikan judul,
  // URL, dan ringkasan (prop=extracts). Dulu ini 5 permintaan terpisah
  // (1 cari + 4 ringkasan) dan itulah pemicu utama pembatasan Wikipedia.
  const url =
    'https://id.wikipedia.org/w/api.php?action=query&generator=search' +
    '&gsrsearch=' +
    encodeURIComponent(q) +
    `&gsrlimit=${maks}&prop=extracts|info&exintro=1&explaintext=1&exsentences=6&inprop=url` +
    '&format=json&origin=*'
  const d = await ambilJson(url)
  const halaman = Object.values(d?.query?.pages ?? {})
  if (!halaman.length) return []

  // urutkan sesuai peringkat pencarian (generator tidak menjamin urutan)
  halaman.sort((a, b) => (a.index ?? 99) - (b.index ?? 99))

  return halaman
    .filter((h) => h?.extract)
    .map((h) => ({
      judul: h.title,
      url: h.fullurl ?? `https://id.wikipedia.org/wiki/${encodeURIComponent(h.title)}`,
      ringkas: String(h.extract).replace(/\s+/g, ' ').trim().slice(0, 700),
      resmi: false,
      jenis: 'ensiklopedia',
    }))
}

/**
 * Ambil referensi resmi dari dalam artikel Wikipedia.
 * Inilah sumber utama: artikel kesehatan Wikipedia memuat tautan ke WHO,
 * Kemenkes, dan lembaga lain yang bisa dicek pengguna.
 */
async function referensiResmi(judulArtikel) {
  if (!judulArtikel) return []
  try {
    const url =
      'https://id.wikipedia.org/w/api.php?action=parse&page=' +
      encodeURIComponent(judulArtikel) +
      '&prop=externallinks&format=json&origin=*'
    const d = await ambilJson(url)
    const semua = d?.parse?.externallinks ?? []
    return [...new Set(semua)]
      .filter((u) => resmikah(u))
      .filter((u) => !/web\.archive\.org/i.test(u))
      .slice(0, BATAS_REF)
      .map((u) => ({
        judul: `Dokumen resmi — ${new URL(u).hostname.replace(/^www\./, '')}`,
        url: u,
        resmi: true,
        jenis: 'resmi',
      }))
  } catch {
    return []
  }
}

/**
 * Cari sumber untuk sebuah pertanyaan.
 * @param {string} q
 * @returns {Promise<{hasil: Array, ringkas: string, catatan: string}>}
 */
export async function cariInternet(q, { maksArtikel = 3, ambilIsi = 2 } = {}) {
  const kata0 = String(q ?? '').trim().slice(0, 300)
  if (!kata0) return { hasil: [], ringkas: '', catatan: '' }

  // pakai simpanan kalau ada — supaya tidak menembak Wikipedia berkali-kali
  const tersimpan = ambilSimpanan(kata0)
  if (tersimpan) return tersimpan

  let wiki = await cariWikipedia(kata0, maksArtikel).catch(() => [])

  // Kalau kosong, kemungkinan besar karena pembatasan Wikipedia — bukan karena
  // memang tidak ada artikelnya. Tunggu sebentar lalu coba sekali lagi. Ini
  // penting: kegagalan sementara yang dibiarkan akan terlihat oleh pengguna
  // sebagai "tidak ada sumber", padahal sumbernya ada.
  if (!wiki.length) {
    await jeda(4000)
    wiki = await cariWikipedia(kata0, maksArtikel).catch(() => [])
  }

  const kata = kataPenting(kata0)
  const relevan = wiki.filter((h) => relevankah(h, kata))

  // kalau penyaringan terlalu ketat, pakai hasil teratas saja daripada kosong
  const dipakai = relevan.length ? relevan : wiki.slice(0, 1)

  // referensi resmi dari artikel teratas
  const ref = await referensiResmi(dipakai[0]?.judul)

  // Ambil isi beberapa halaman resmi supaya model punya bahan nyata.
  // Dijalankan berurutan dengan jeda kecil — situs pemerintah juga membatasi
  // permintaan beruntun, dan jumlahnya sedikit (maks 2) jadi tidak lambat.
  for (const h of ref.slice(0, ambilIsi)) {
    try {
      const isi = bersihkan(keTeks(await ambil(h.url, 12000)))
      if (isi.length > 150) h.isi = isi
    } catch {
      /* halaman resmi gagal diambil — URL tetap ditampilkan */
    }
    await jeda(200)
  }

  const hasil = [...dipakai, ...ref]

  const bagian = hasil
    .map((h, i) => {
      const tanda = h.resmi ? ' [SUMBER RESMI]' : ''
      const isi = h.ringkas ? `\n   Ringkasan: ${h.ringkas}` : h.isi ? `\n   Isi: ${h.isi}` : ''
      return `${i + 1}. ${h.judul}${tanda}\n   URL: ${h.url}${isi}`
    })
    .join('\n\n')

  const catatan = ref.length
    ? `Sumber resmi diambil dari daftar referensi artikel ensiklopedia — ${ref.length} dokumen lembaga resmi ditemukan.`
    : 'Belum ada dokumen lembaga resmi yang ditemukan untuk pertanyaan ini.'

  const keluaran = { hasil, ringkas: bagian, catatan }

  // Hanya simpan kalau memang ada hasil. Hasil kosong TIDAK disimpan, supaya
  // kegagalan sementara (mis. kena pembatasan Wikipedia) tidak ikut tersimpan
  // dan pertanyaan berikutnya masih dicoba lagi.
  if (hasil.length) simpanHasil(kata0, keluaran)

  return keluaran
}
