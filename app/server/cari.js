/**
 * Pencarian internet untuk Pahami Sehat.
 *
 * Tanpa API key dan tanpa biaya: memakai DuckDuckGo (HTML) untuk hasil umum
 * dan Wikipedia Indonesia untuk ringkasan ensiklopedis. Halaman hasil teratas
 * ikut diambil isinya (dibersihkan dari HTML) supaya model punya bahan, bukan
 * cuma judul.
 *
 * Situs resmi kesehatan (Kemenkes, WHO, BPOM) diberi tanda supaya bisa
 * diprioritaskan saat menyusun konteks untuk model.
 */

const UA =
  'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120 Safari/537.36'

/** Domain yang dianggap sumber resmi kesehatan. */
const RESMI = [
  'kemkes.go.id',
  'who.int',
  'pom.go.id',
  'kemenkes.go.id',
  'sehatnegeriku.kemkes.go.id',
  'ayosehat.kemkes.go.id',
  'p2p.kemkes.go.id',
  'nih.gov',
  'pubmed.ncbi.nlm.nih.gov',
  'cdc.gov',
]

const BATAS_ISI = 1800 // karakter per halaman
const BATAS_HASIL = 6

function resmikah(url) {
  try {
    const h = new URL(url).hostname.replace(/^www\./, '')
    return RESMI.some((d) => h === d || h.endsWith('.' + d))
  } catch {
    return false
  }
}

/** Ambil HTML mentah dengan batas waktu. */
async function ambilHtml(url, timeoutMs = 12000) {
  const res = await fetch(url, {
    headers: { 'User-Agent': UA, 'Accept-Language': 'id,en;q=0.8' },
    signal: AbortSignal.timeout(timeoutMs),
    redirect: 'follow',
  })
  if (!res.ok) throw new Error(`HTTP ${res.status}`)
  const tipe = res.headers.get('content-type') || ''
  if (!/text\/html|text\/plain|application\/xhtml/i.test(tipe)) throw new Error('bukan HTML')
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
  // utamakan isi <article>/<main> kalau ada
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

/** Buang potongan yang jelas bukan isi (menu, iklan, komentar). */
function bersihkan(teks) {
  const baris = teks
    .split('\n')
    .map((b) => b.trim())
    .filter((b) => b.length > 45 && !/^(share|bagikan|baca juga|lihat juga|iklan|advertisement|komentar|related|berlangganan)/i.test(b))
  return baris.join('\n').slice(0, BATAS_ISI)
}

/**
 * Hasil dari DuckDuckGo. Dua endpoint dicoba karena sebagian penyedia hosting
 * (mis. Vercel) kadang diblokir di salah satunya.
 */
async function cariDuckDuckGo(q, jumlah = BATAS_HASIL) {
  const endpoint = [
    'https://html.duckduckgo.com/html/?q=',
    'https://lite.duckduckgo.com/lite/?q=',
  ]
  let terakhirError = null

  for (const dasar of endpoint) {
    try {
      const html = await ambilHtml(dasar + encodeURIComponent(q))
      const hasil = []
      // html.duckduckgo.com memakai .result__a; lite memakai tabel tautan biasa
      const polaA = /<a[^>]*class="result__a"[^>]*href="([^"]+)"[^>]*>([\s\S]*?)<\/a>/gi
      const polaL = /<a[^>]*class="result-link"[^>]*href="([^"]+)"[^>]*>([\s\S]*?)<\/a>/gi
      for (const pola of [polaA, polaL]) {
        let m
        while ((m = pola.exec(html)) && hasil.length < jumlah) {
          let href = m[1]
          const judul = m[2].replace(/<[^>]+>/g, '').replace(/&amp;/g, '&').trim()
          try {
            const u = new URL(href, 'https://duckduckgo.com')
            const uddg = u.searchParams.get('uddg')
            if (uddg) href = decodeURIComponent(uddg)
          } catch {
            /* pakai apa adanya */
          }
          if (!/^https?:/.test(href)) continue
          if (hasil.some((h) => h.url === href)) continue
          hasil.push({ judul: judul.slice(0, 140), url: href, resmi: resmikah(href), asal: 'ddg' })
        }
        if (hasil.length >= 2) break
      }
      if (hasil.length) return { hasil, error: null }
      terakhirError = 'tidak ada hasil terbaca'
    } catch (e) {
      terakhirError = `${new URL(dasar).hostname}: ${e.message}`
    }
  }
  return { hasil: [], error: terakhirError }
}

/**
 * Ringkasan dari Wikipedia Indonesia. Diambil beberapa artikel sekaligus
 * karena API resmi ini selalu bisa diakses — jadi sumber tetap ada walaupun
 * mesin pencari umum memblokir.
 */
async function cariWikipedia(q, maks = 3) {
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
          url: s.content_urls?.desktop?.page ?? `https://id.wikipedia.org/wiki/${encodeURIComponent(j)}`,
          ringkas: String(s.extract).slice(0, 700),
          resmi: false,
          asal: 'wikipedia',
        }
      } catch {
        return null
      }
    }),
  )
  return hasil.filter(Boolean)
}

/**
 * Cari di internet.
 * @param {string} q pertanyaan/kata kunci
 * @param {{jumlah?: number, ambilIsi?: number, timeoutMs?: number}} opsi
 * @returns {Promise<{hasil: Array, ringkas: string}>}
 */
/** Kata penting dari pertanyaan (buang kata tanya dan kata umum). */
const KATA_UMUM = new Set([
  'apa','itu','yang','dan','atau','untuk','dari','ke','di','pada','dengan','adalah','berapa',
  'bagaimana','kapan','mengapa','kenapa','siapa','dimana','mana','ini','the','what','how',
  'when','why','who','which','is','are','of','to','in','on','for','and','or','a','an',
  'bisa','dapat','harus','tidak','ya','kasus','tahun','terbaru','data',
])

function kataPenting(teks) {
  return String(teks)
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s]/gu, ' ')
    .split(/\s+/)
    .filter((k) => k.length > 3 && !KATA_UMUM.has(k))
}

/**
 * Saring hasil Wikipedia supaya artikel yang tidak nyambung tidak ikut.
 *
 * Kenapa perlu: pencarian "demam berdarah" pernah memunculkan artikel FILM dan
 * artikel tentang Ebola. Keduanya menyebut "demam berdarah" di isinya (Ebola
 * memang demam berdarah; filmnya memakai penyakit sebagai jalan cerita),
 * sehingga mencocokkan isi saja tidak cukup.
 *
 * Aturan: kata penting harus muncul di JUDUL artikel. Judul film atau nama
 * penyakit lain tidak akan memuat kata kunci pengguna.
 */
function relevankah(item, kata) {
  if (!kata.length) return true
  const judul = String(item.judul ?? '').toLowerCase()
  const isi = String(item.ringkas ?? '').toLowerCase()

  const cocokJudul = kata.filter((k) => judul.includes(k)).length
  const cocokIsi = kata.filter((k) => isi.includes(k)).length

  // wajib ada kata penting di judul, DAN dukungan dari isi
  return cocokJudul >= 1 && cocokIsi >= 1
}

export async function cariInternet(q, { jumlah = BATAS_HASIL, ambilIsi = 3, timeoutMs = 15000 } = {}) {
  const kata0 = String(q ?? '').trim().slice(0, 300)
  if (!kata0) return { hasil: [], ringkas: '', catatan: '' }

  // jalankan pencarian dasar secara paralel
  const [ddg, wiki] = await Promise.all([
    cariDuckDuckGo(kata0, jumlah).catch((e) => ({ hasil: [], error: e.message })),
    cariWikipedia(kata0).catch(() => []),
  ])

  // sumber resmi lebih dulu, lalu sisanya
  const urut = [...ddg.hasil].sort((a, b) => Number(b.resmi) - Number(a.resmi))

  // saring artikel Wikipedia yang tidak nyambung dengan pertanyaan
  const kata = kataPenting(kata0)
  const wikiBersih = wiki.filter((h) => relevankah(h, kata))
  const hasil = [...wikiBersih, ...urut]

  // ambil isi beberapa halaman teratas supaya model punya bahan nyata
  const target = urut.filter((h) => h.url).slice(0, ambilIsi)
  await Promise.all(
    target.map(async (h) => {
      try {
        const html = await ambilHtml(h.url, timeoutMs)
        const isi = bersihkan(keTeks(html))
        if (isi.length > 120) h.isi = isi
      } catch {
        /* halaman gagal diambil — lewati, jangan gagalkan pencarian */
      }
    }),
  )

  // susun ringkasan teks untuk disuntikkan ke prompt
  const bagian = hasil
    .filter((h) => h.judul || h.isi)
    .map((h, i) => {
      const tanda = h.resmi ? ' [SUMBER RESMI]' : ''
      const isi = h.ringkas ? `\n   Ringkasan: ${h.ringkas}` : h.isi ? `\n   Isi: ${h.isi}` : ''
      return `${i + 1}. ${h.judul}${tanda}\n   URL: ${h.url}${isi}`
    })

  // kalau mesin pencari umum gagal (mis. diblokir dari server produksi),
  // catat supaya bisa ditampilkan apa adanya — jangan pura-pura lengkap
  const catatan = ddg.error
    ? `Mesin pencari umum tidak bisa diakses dari server ini (${ddg.error}). Sumber diambil dari Wikipedia Indonesia.`
    : ''

  return { hasil, ringkas: bagian.join('\n\n'), catatan }
}
