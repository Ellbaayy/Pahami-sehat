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

function resmikah(url) {
  try {
    const h = new URL(url).hostname.replace(/^www\./, '')
    return RESMI.some((d) => h === d || h.endsWith('.' + d))
  } catch {
    return false
  }
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
  const url =
    'https://id.wikipedia.org/w/api.php?action=query&list=search&srsearch=' +
    encodeURIComponent(q) +
    `&srlimit=${maks}&format=json&origin=*`
  const d = await (
    await fetch(url, { headers: { 'User-Agent': UA }, signal: AbortSignal.timeout(10000) })
  ).json()
  const judul = (d?.query?.search ?? []).map((x) => x.title).slice(0, maks)
  if (!judul.length) return []

  const hasil = await Promise.all(
    judul.map(async (j) => {
      try {
        const s = await (
          await fetch(`https://id.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(j)}`, {
            headers: { 'User-Agent': UA },
            signal: AbortSignal.timeout(10000),
          })
        ).json()
        if (!s?.extract) return null
        return {
          judul: s.title,
          url:
            s.content_urls?.desktop?.page ??
            `https://id.wikipedia.org/wiki/${encodeURIComponent(j)}`,
          ringkas: String(s.extract).slice(0, 700),
          resmi: false,
          jenis: 'ensiklopedia',
        }
      } catch {
        return null
      }
    }),
  )
  return hasil.filter(Boolean)
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
    const d = await (
      await fetch(url, { headers: { 'User-Agent': UA }, signal: AbortSignal.timeout(12000) })
    ).json()
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

  const wiki = await cariWikipedia(kata0, maksArtikel + 1).catch(() => [])
  const kata = kataPenting(kata0)
  const relevan = wiki.filter((h) => relevankah(h, kata))

  // kalau penyaringan terlalu ketat, pakai hasil teratas saja daripada kosong
  const dipakai = relevan.length ? relevan : wiki.slice(0, 1)

  // referensi resmi dari artikel teratas
  const ref = await referensiResmi(dipakai[0]?.judul)

  // ambil isi beberapa halaman resmi supaya model punya bahan nyata
  await Promise.all(
    ref.slice(0, ambilIsi).map(async (h) => {
      try {
        const isi = bersihkan(keTeks(await ambil(h.url, 12000)))
        if (isi.length > 150) h.isi = isi
      } catch {
        /* halaman resmi gagal diambil — URL tetap ditampilkan */
      }
    }),
  )

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

  return { hasil, ringkas: bagian, catatan }
}
