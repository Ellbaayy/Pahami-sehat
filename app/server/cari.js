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
 *   4. MedlinePlus (Perpustakaan Kedokteran Nasional AS, bagian dari NIH) —
 *      lihat catatan di cariMedlinePlus().
 *
 * Semua yang ditampilkan adalah URL nyata yang bisa dibuka pengguna.
 */

import { kataPenting } from './kataKunci.js'

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
  // MedlinePlus — perpustakaan kedokteran nasional AS (bagian NIH).
  // Sudah tercakup 'nih.gov', tapi ditulis eksplisit supaya jelas bahwa
  // halaman MedlinePlus memang disengaja dipakai sebagai sumber.
  'medlineplus.gov',
]

const BATAS_ISI = 1500
const BATAS_REF = 6

/**
 * Berapa halaman MedlinePlus yang diambil, dan berapa banyak isinya dipakai.
 *
 * KENAPA 2600, BUKAN 900 (diukur 13 Okt 2026, pada halaman /stroke.html):
 * ringkasan MedlinePlus untuk "stroke" panjangnya 7.711 karakter dan tersusun
 * berurutan: "What is a stroke?" (0) -> "types" (576) -> "Who is at risk?" (1414)
 * -> "symptoms" (2517) -> "treatments" (4276) -> "Prevention/rehabilitation" (4810).
 *
 * Batas 900 karakter memotong SEBELUM bagian yang paling sering ditanyakan:
 * faktor risiko, pengobatan, dan rehabilitasi tidak pernah sampai ke model.
 * Itu sebabnya pertanyaan "apa risiko saya stroke" dijawab "hasil pencarian
 * tidak memuat informasinya" — padahal bahan itu ada, cuma dipotong.
 *
 * Halaman MedlinePlus lain jauh lebih pendek (anemia 1.414, after surgery 1.352,
 * wound care 1.379), jadi 2600 berarti dokumen pendek masuk UTUH.
 *
 * Tidak ada permintaan jaringan tambahan: ringkasan ini sudah ikut di balasan
 * pencarian. Yang bertambah hanya panjang prompt.
 */
const BATAS_MEDLINEPLUS = 4
const BATAS_RINGKAS_MEDLINEPLUS = 2600

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

/**
 * Kata yang menandakan sebuah artikel memang membahas kesehatan.
 *
 * KENAPA PERLU: pencarian Wikipedia mencocokkan huruf, bukan makna, sehingga
 * istilah yang sah sering menemukan artikel yang sama sekali lain topiknya.
 * Bukti terukur dari API Wikipedia Indonesia:
 *   "pusing"  -> "Syahrini", "Cowok Bikin Pusing", "Ateng Bikin Pusing"
 *   "mual"    -> "Aik Mual, Praya, Lombok Tengah"
 *   "bengkak" -> "Bengkak, Wongsorejo, Banyuwangi", "Nematoda bengkak akar"
 *   "kelelahan" -> "Perunggu (grup musik)", "Bahlil Lahadalia"
 *
 * Cara membedakannya: artikel kesehatan hampir selalu memakai kata seperti
 * "penyakit", "gejala", "kondisi", "tubuh" di kalimat pertamanya, sedangkan
 * artikel tentang orang/tempat/lagu tidak. Diuji ke 16 istilah: seluruh
 * artikel yang salah tersaring, seluruh artikel yang benar tetap lolos.
 *
 * CATATAN: kata di sini TIDAK boleh terlalu pendek. "sel" pernah dipakai dan
 * ikut cocok dengan "selatan" dan "selesai" — jadi "sel darah"/"sel tubuh"
 * yang dipakai. Pencocokan juga memakai BATAS KATA, bukan potongan huruf.
 */
const KONTEKS_KESEHATAN = [
  'penyakit', 'kondisi', 'gejala', 'tubuh', 'kesehatan', 'infeksi', 'sensasi',
  'peradangan', 'medis', 'obat', 'klinis', 'kelainan', 'sakit', 'nyeri',
  'gatal', 'perawatan', 'pengobatan', 'virus', 'bakteri', 'darah',
  'jaringan', 'organ', 'sindrom', 'diagnosis', 'pasien', 'dokter', 'kulit',
  'otot', 'saraf', 'pernapasan', 'pencernaan', 'imun', 'gizi', 'vitamin',
  'pencegahan', 'terapi', 'herbal', 'tanaman obat', 'sel darah', 'sel tubuh',
]

const POLA_KONTEKS = KONTEKS_KESEHATAN.map((k) => ({
  kata: k,
  pola: new RegExp(`(?<!\\p{L})${k.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}(?!\\p{L})`, 'u'),
}))

/**
 * Apakah artikel ini benar-benar membahas kesehatan?
 *
 * @param {object} item - hasil pencarian (judul, ringkas/isi)
 * @param {string[]} kecuali - kata yang TIDAK dihitung sebagai konteks.
 *   Ini penting: tanpa ini, artikel "Daun gatal" lolos hanya karena judulnya
 *   memuat kata "gatal" — kata yang kebetulan juga jadi bahan pencarian.
 *   Yang kita cari adalah bukti kesehatan DI LUAR kata yang sudah dicari.
 */
function berkonteksKesehatan(item, kecuali = []) {
  const teks = `${item.judul ?? ''} ${item.ringkas ?? ''} ${item.isi ?? ''}`.toLowerCase()
  if (!teks.trim()) return false
  const larangan = new Set(kecuali.map((k) => String(k).toLowerCase()))
  return POLA_KONTEKS.some(({ kata, pola }) => !larangan.has(kata) && pola.test(teks))
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

/* ------------------------------------------------------- MedlinePlus (NIH) -- */

/**
 * MedlinePlus — sumber tambahan dari Perpustakaan Kedokteran Nasional AS (NIH).
 *
 * KENAPA PERLU: Wikipedia Indonesia tidak punya artikel untuk sebagian besar
 * alat pemeriksaan penunjang. Diukur langsung ke API-nya:
 *
 *   "rontgen" -> Wilhelm Conrad Röntgen, Louis Slotin, satuan Röntgen,
 *                Sinar-X  — semuanya fisika, bukan pemeriksaan medis.
 *   "pemeriksaan penunjang" -> Badan Pemeriksa Keuangan, Dewan Pertimbangan
 *                Presiden — sama sekali bukan topik kesehatan.
 *
 * Untuk istilah yang sama, MedlinePlus punya halaman yang tepat:
 *   x-ray -> /xrays.html · ultrasound -> /ultrasound.html · MRI -> /mriscans.html
 *   laboratory tests -> /laboratorytests.html · biopsy -> /biopsy.html
 *
 * Domain medlineplus.gov sudah termasuk NIH, jadi sumber ini sekelas dengan
 * sumber resmi yang sudah dipakai aplikasi (lihat daftar RESMI).
 *
 * Dua tahap, dan keduanya diuji langsung:
 *   1. Cari — API wsearch.nlm.nih.gov mengembalikan XML berisi dokumen
 *      (judul + ringkasan + URL). Ringkasannya sudah cukup untuk menjawab.
 *   2. Ambil isi — halaman diambil dan bagian #topic-summary dipakai. Ini
 *      yang membuat model punya BAHAN NYATA, bukan hanya judul.
 *
 * CATATAN JUJUR: jalur ini diuji dari komputer pengembang dan berhasil (HTTP
 * 200). DuckDuckGo/Mojeek dulu ditolak 403 dari Vercel, jadi jalur ini WAJIB
 * diuji ulang di produksi setelah deploy — jangan dianggap pasti jalan.
 */
const MEDLINEPLUS_UA = UA

/** Buka entitas XML/HTML. Urutannya penting: &amp; dibuka TERAKHIR. */
function bukaEntitas(s) {
  return String(s ?? '')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;|&apos;/g, "'")
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
}

/** XML/HTML -> teks bersih. Entitas dibuka DULU, baru tag dibuang. */
function keTeksBersih(s) {
  return bukaEntitas(s)
    .replace(/<[^>]*>/g, ' ')
    .replace(/[ \t]+/g, ' ')
    .replace(/\s*\n\s*/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
}

/**
 * Cari halaman MedlinePlus untuk sebuah istilah (bahasa Inggris).
 *
 * @param {string} istilah
 * @param {number} maks
 * @returns {Promise<Array<{judul,url,ringkas,resmi,jenis}>>}
 */
async function cariMedlinePlus(istilah, maks = BATAS_MEDLINEPLUS) {
  const kata = String(istilah ?? '').trim()
  if (!kata) return []
  try {
    const url =
      'https://wsearch.nlm.nih.gov/ws/query?db=healthTopics&term=' +
      encodeURIComponent(kata) +
      `&retmax=${Math.max(maks, 6)}`
    const res = await fetch(url, {
      headers: { 'User-Agent': MEDLINEPLUS_UA, Accept: 'application/xml,text/xml' },
      signal: AbortSignal.timeout(12000),
    })
    if (!res.ok) return []
    const xml = await res.text()

    const dokumen = [...xml.matchAll(/<document[^>]*url="([^"]+)"[^>]*>([\s\S]*?)<\/document>/g)].map((m) => {
      const isi = m[2]
      return {
        url: m[1],
        judul: keTeksBersih((isi.match(/<content name="title">([\s\S]*?)<\/content>/) ?? [])[1] ?? ''),
        ringkas: keTeksBersih((isi.match(/<content name="FullSummary">([\s\S]*?)<\/content>/) ?? [])[1] ?? ''),
      }
    })

    // Utamakan dokumen yang JUDULNYA cocok, diurutkan menurut JUMLAH kata yang
    // cocok — bukan sekadar "semua kata cocok".
    //
    // Kenapa berjenjang: diukur langsung ke API-nya —
    //   "ultrasound"  -> Prenatal Testing(0) ... /ultrasound.html sebenarnya ADA
    //   "spirometry"  -> Asthma(0) ... /spirometry.html sebenarnya ADA
    //   "diagnostic imaging" -> Diagnostic Imaging(2) menang atas Kidney Tests(1)
    //   "x-ray"       -> X-Rays(1) menang atas Heart Health Tests(0)
    // Syarat "semua kata cocok" pernah dipakai dan itu terlalu keras: untuk
    // "ultrasound" tidak ada satu pun judul yang memuatnya, sehingga urutan
    // asli dipakai dan halaman alatnya tidak pernah terpilih.
    const bagianKata = kata.toLowerCase().split(/\s+/).filter((k) => k.length >= 3)
    const dipakai = dokumen
      .map((d, i) => ({
        d,
        i,
        skor: bagianKata.filter((k) => d.judul.toLowerCase().includes(k)).length,
      }))
      .sort((a, b) => b.skor - a.skor || a.i - b.i)
      .map((x) => x.d)

    return dipakai
      .filter((d) => d.url && d.judul)
      .slice(0, maks)
      .map((d) => ({
        judul: d.judul,
        url: d.url,
        ringkas: d.ringkas.slice(0, BATAS_RINGKAS_MEDLINEPLUS),
        resmi: true,
        jenis: 'medlineplus',
      }))
  } catch {
    return []
  }
}

/**
 * Ambil isi halaman MedlinePlus — bagian #topic-summary saja.
 *
 * Halaman penuh berisi menu, footer, dan tautan navigasi (terukur: ~10.000
 * karakter, sebagian besar bukan isi). Bagian #topic-summary adalah ringkasan
 * artikelnya (terukur: ~1.870 karakter untuk /xrays.html) dan itulah yang
 * berguna sebagai bahan jawaban.
 *
 * Dipotong pada penanda bagian berikutnya supaya menu "On this page" tidak ikut.
 */
async function isiMedlinePlus(url) {
  try {
    const html = await ambil(url, 12000)
    const mulai = html.indexOf('id="topic-summary"')
    if (mulai === -1) return ''
    // batasi jendela supaya tidak menyeret seluruh halaman
    const jendela = html.slice(mulai, mulai + 8000)
    const teks = keTeksBersih(
      jendela
        .replace(/<script[\s\S]*?<\/script>/gi, ' ')
        .replace(/<style[\s\S]*?<\/style>/gi, ' '),
    )
    // buang baris pendek (menu, label) dan sisakan kalimat isi
    const baris = teks
      .split('\n')
      .map((b) => b.trim())
      .filter((b) => b.length > 60)
    return baris.join('\n').slice(0, BATAS_ISI)
  } catch {
    return ''
  }
}

/**
 * Cari sumber untuk sebuah pertanyaan.
 * @param {string} q
 * @param {object} [opsi]
 * @param {string} [opsi.istilahMedlinePlus] - istilah bahasa Inggris untuk
 *   MedlinePlus (lihat PETA_MEDLINEPLUS di kataKunci.js). Kalau tidak diisi,
 *   MedlinePlus tidak dipanggil — jangan kirim istilah Indonesia apa adanya,
 *   karena koleksi itu berbahasa Inggris.
 * @returns {Promise<{hasil: Array, ringkas: string, catatan: string}>}
 */
export async function cariInternet(q, { maksArtikel = 3, ambilIsi = 2, istilahMedlinePlus = null } = {}) {
  const kata0 = String(q ?? '').trim().slice(0, 300)
  if (!kata0) return { hasil: [], ringkas: '', catatan: '' }

  // pakai simpanan kalau ada — supaya tidak menembak Wikipedia berkali-kali.
  // Kuncinya memuat istilah MedlinePlus juga: hasil pencarian sekarang
  // bergantung pada DUA istilah, jadi menyimpan hanya berdasarkan satu istilah
  // akan menyajikan hasil yang salah.
  const kunciSimpan = `${kata0}|${istilahMedlinePlus ?? ''}`
  const tersimpan = ambilSimpanan(kunciSimpan)
  if (tersimpan) return tersimpan

  // Yang dikirim ke Wikipedia adalah KATA KUNCI, bukan kalimat pengguna apa
  // adanya. Dulu kalimat utuh dikirim, dan hasilnya artikel yang tidak
  // nyambung: "...saya sering merasa lemas" menghasilkan "Charles Darwin",
  // "saya menderita gatal-gatal..." menghasilkan "Gangguan obsesif–kompulsif".
  // Sekarang bahan pencariannya sudah dipilih di rute (lihat kataKunci.js) dan
  // tiba di sini sebagai istilah pendek seperti "gatal" atau "kelelahan".
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
  const relevan = wiki.filter((h) => relevankah(h, kata) && berkonteksKesehatan(h, kata))

  // Kalau tidak ada satu pun hasil yang menyentuh kata kunci, LEBIH BAIK
  // mengembalikan kosong daripada menyodorkan artikel teratas.
  //
  // Ini pernah jadi sumber jawaban yang menyesatkan: pertanyaan soal gatal
  // dijawab dengan sumber tentang OCD, dan model terpaksa berkata "sumber yang
  // ada hanya membahas gangguan obsesif-kompulsif". Modelnya jujur, tapi kita
  // sendiri yang menyodorkan sumber salah. Dengan mengosongkan di sini, model
  // akan mengatakan informasi belum ditemukan — dan itu jawaban yang benar.
  const dipakai = relevan

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

  /* MedlinePlus — dijalankan SETELAH jalur Wikipedia.
   *
   * Kenapa tidak lebih dulu: MedlinePlus tidak punya mesin pencari teks bebas,
   * jadi hanya dipanggil kalau ada padanan istilah Inggris yang pasti
   * (PETA_MEDLINEPLUS). Mengirim istilah Indonesia apa adanya menghasilkan
   * nol dokumen — sudah diukur.
   *
   * Kenapa hasilnya DIGABUNG, bukan menggantikan: Wikipedia memberi ringkasan
   * berbahasa Indonesia, MedlinePlus memberi isi yang lebih dalam. Model
   * dilarang memakai apa pun di luar daftar ini, jadi menambah daftar berarti
   * menambah pengetahuan yang boleh dipakai — bukan menambah kebebasan.
   */
  const medline = istilahMedlinePlus ? await cariMedlinePlus(istilahMedlinePlus) : []

  // ambil isi halaman MedlinePlus supaya ada bahan nyata (bukan hanya judul)
  for (const h of medline.slice(0, 2)) {
    if (!h.ringkas || h.ringkas.length < 200) {
      const isi = await isiMedlinePlus(h.url)
      if (isi.length > 150) h.isi = isi
    }
    await jeda(200)
  }

  const semua = [...hasil, ...medline]

  const bagian = semua
    .map((h, i) => {
      const tanda = h.resmi ? ' [SUMBER RESMI]' : ''
      const isi = h.ringkas ? `\n   Ringkasan: ${h.ringkas}` : h.isi ? `\n   Isi: ${h.isi}` : ''
      return `${i + 1}. ${h.judul}${tanda}\n   URL: ${h.url}${isi}`
    })
    .join('\n\n')

  const bagianCatatan = []
  if (ref.length) {
    bagianCatatan.push(
      `Sumber resmi diambil dari daftar referensi artikel ensiklopedia — ${ref.length} dokumen lembaga resmi ditemukan.`,
    )
  }
  if (medline.length) {
    bagianCatatan.push(`MedlinePlus (NIH) menyediakan ${medline.length} halaman untuk topik ini.`)
  }
  const catatan = bagianCatatan.length
    ? bagianCatatan.join(' ')
    : 'Belum ada dokumen lembaga resmi yang ditemukan untuk pertanyaan ini.'

  const keluaran = { hasil: semua, ringkas: bagian, catatan }

  // Hanya simpan kalau memang ada hasil. Hasil kosong TIDAK disimpan, supaya
  // kegagalan sementara (mis. kena pembatasan Wikipedia) tidak ikut tersimpan
  // dan pertanyaan berikutnya masih dicoba lagi.
  if (semua.length) simpanHasil(kunciSimpan, keluaran)

  return keluaran
}
