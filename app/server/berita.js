/**
 * Sumber berita kesehatan harian — RSS dari tiga sumber yang sudah diuji
 * bisa di-fetch dari server Vercel (HTTPS biasa, bukan WebSocket):
 *
 *   1. Detik Health RSS   — https://health.detik.com/rss
 *      100 item, segar hari ini, link langsung ke artikel asli.
 *
 *   2. WHO News RSS        — https://www.who.int/rss-feeds/news-english.xml
 *      Resmi, walau jarang update (item terbaru bisa berbulan-bulan lalu).
 *
 *   3. Google News RSS     — https://news.google.com/rss/search?q=kesehatan
 *      Segar hari ini, tapi link-nya perlu JavaScript — tidak bisa dibuka
 *      dari server. Yang dipakai hanya judul + sumber + tanggalnya.
 *
 * Ketiga sumber digabungkan, diurutkan dari yang terbaru, dan dikembalikan
 * sebagai daftar berita yang bisa dibuka pengguna. Ini BUKAN pengganti
 * sumber medis — berita tetap harus dicek ke sumber resminya.
 */

const UA =
  'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120 Safari/537.36'

/** Berapa berita terbaru yang diambil dari tiap sumber. */
const MAKS_PER_SUMBER = 8

/** Batas umur berita: hanya berita dari N hari terakhir yang dianggap "terkini". */
const MAKS_HARI = 7

/**
 * Parse RSS XML sederhana — ambil <item> dengan <title>, <link>, <pubDate>,
 * dan <description> atau <source>. Tidak pakai library XML karena ukuran.
 *
 * DIEKSPOR untuk uji — parser ini makan data dari pihak luar, jadi perilakunya
 * terhadap masukan jahat wajib diuji (uji-berita.mjs).
 *
 * Batas pengaman: maksimum MAKS_ITEM item yang diparse dan tiap judul/deskripsi
 * dipotong — feed raksasa tidak boleh membuat prompt ikut raksasa.
 */

/** Batas jumlah item yang diparse dari satu feed. */
const MAKS_ITEM = 30

/** Buang karakter kontrol (mis. \u0000, \u202E) yang bisa dipakai menyamarkan teks. */
function buangKontrol(s) {
  // eslint-disable-next-line no-control-regex
  return String(s ?? '').replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F\u202A-\u202E]/g, '')
}

/** Ubah entitas XML dasar jadi teks asli — setelah tag HTML dibuang. */
function uraiEntitas(s) {
  return String(s ?? '')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#0?39;|&apos;/g, "'")
    .replace(/&amp;/g, '&')
}

export function parseRss(xml, namaSumber) {
  const items = []
  const blok = (xml.match(/<item>([\s\S]*?)<\/item>/g) ?? []).slice(0, MAKS_ITEM)

  for (const b of blok) {
    const judul = uraiEntitas(buangKontrol(/<title>(?:<!\[CDATA\[)?([\s\S]*?)(?:\]\]>)?<\/title>/.exec(b)?.[1] ?? '')).trim()
    const link = buangKontrol(/<link>([\s\S]*?)<\/link>/.exec(b)?.[1] ?? '').trim()
    const tanggalStr = buangKontrol(/<pubDate>([\s\S]*?)<\/pubDate>/.exec(b)?.[1] ?? '').trim()
    const deskripsiRaw =
      uraiEntitas(buangKontrol(/<description>(?:<!\[CDATA\[)?([\s\S]*?)(?:\]\]>)?<\/description>/.exec(b)?.[1] ?? '')).trim()
    const sumber = uraiEntitas(buangKontrol(/<source[^>]*>(?:<!\[CDATA\[)?([\s\S]*?)(?:\]\]>)?<\/source>/.exec(b)?.[1] ?? '')).trim()

    // bersihkan HTML dari deskripsi — isi RSS adalah DATA, bukan markup
    const deskripsi = deskripsiRaw
      .replace(/<[^>]+>/g, ' ')
      .replace(/\s+/g, ' ')
      .trim()
      .slice(0, 200)

    // link wajib http(s) — cegah skema aneh (javascript:, data:) masuk daftar
    if (!judul || !/^https?:\/\//i.test(link)) continue

    const tanggal = tanggalStr ? new Date(tanggalStr) : null
    // tanggal tidak valid (NaN) diperlakukan sama seperti tidak ada tanggalnya —
    // jangan biarkan NaN bocor ke umurHari, sort, dan frontend
    const sah = tanggal !== null && !Number.isNaN(tanggal.getTime())
    const umurHari = sah ? Math.floor((Date.now() - tanggal.getTime()) / 86400000) : null

    // hanya berita yang masih baru — kecuali WHO yang memang jarang
    if (umurHari !== null && umurHari > MAKS_HARI && namaSumber !== 'WHO') continue

    items.push({
      judul: judul.slice(0, 140),
      link,
      deskripsi,
      sumber: sumber || namaSumber,
      tanggal: tanggalStr,
      umurHari,
    })
  }

  return items
}

/**
 * Batas ukuran isi feed yang dibaca: 2 MB. Feed yang lebih besar dibatalkan —
 * server tidak boleh dipakai menelan respons raksasa dari pihak luar.
 */
const MAKS_BYTE_FEED = 2_000_000

/** Baca isi respons dengan batas byte — content-length besar langsung ditolak. */
async function bacaDenganBatas(res) {
  const cl = Number(res.headers.get('content-length') ?? 0)
  if (cl > MAKS_BYTE_FEED) throw new Error('feed_kebesaran')
  const pembaca = res.body?.getReader?.()
  if (!pembaca) return res.text()
  const potongan = []
  let total = 0
  for (;;) {
    const { done, value } = await pembaca.read()
    if (done) break
    total += value.byteLength
    if (total > MAKS_BYTE_FEED) {
      await pembaca.cancel()
      throw new Error('feed_kebesaran')
    }
    potongan.push(Buffer.from(value))
  }
  return Buffer.concat(potongan).toString('utf8')
}

/**
 * Ambil berita dari satu sumber RSS dengan percobaan ulang.
 * Gagal satu sumber tidak boleh mematikan seluruh fitur — sumber lain tetap jalan.
 * Respons non-2xx, non-RSS, dan kebesaran juga dihitung gagal yang layak dicoba ulang.
 */
async function ambilSatuSumber(url, namaSumber, percobaan = 2) {
  for (let i = 0; i < percobaan; i++) {
    try {
      const kontrol = new AbortController()
      const timer = setTimeout(() => kontrol.abort(), 10000)
      const res = await fetch(url, {
        headers: { 'User-Agent': UA, Accept: 'application/rss+xml, application/xml, text/xml' },
        signal: kontrol.signal,
      })
      clearTimeout(timer)

      if (!res.ok) throw new Error(`http_${res.status}`)
      const xml = await bacaDenganBatas(res)
      if (!xml.includes('<item>')) throw new Error('bukan_rss')
      return parseRss(xml, namaSumber)
    } catch {
      // percobaan terakhir juga gagal — kembalikan kosong, bukan melempar
      if (i === percobaan - 1) return []
      await new Promise((r) => setTimeout(r, 800))
    }
  }
  return []
}

/**
 * Ambil berita kesehatan terbaru dari semua sumber, gabungkan, urutkan.
 *
 * @param {object} [opsi]
 * @param {number} [opsi.maks] - berapa berita yang dikembalikan (bawaan 8)
 * @returns {Promise<Array<{judul, link, deskripsi, sumber, tanggal, umurHari}>>}
 */
export async function ambilBeritaKesehatan({ maks = 8 } = {}) {
  const [detik, who, google] = await Promise.all([
    ambilSatuSumber('https://health.detik.com/rss', 'Detik Health'),
    ambilSatuSumber('https://www.who.int/rss-feeds/news-english.xml', 'WHO'),
    ambilSatuSumber(
      'https://news.google.com/rss/search?q=kesehatan&hl=id&gl=ID&ceid=ID:id',
      'Google News',
    ),
  ])

  // Google News: link-nya tidak bisa dibuka dari server, jadi tandai
  const googleDitandai = google.map((b) => ({
    ...b,
    linkTidakBisaDibuka: true,
  }))

  const semua = [...detik, ...who, ...googleDitandai]

  // urutkan: yang punya tanggal di depan, dari yang terbaru
  semua.sort((a, b) => {
    if (a.umurHari === null && b.umurHari === null) return 0
    if (a.umurHari === null) return 1
    if (b.umurHari === null) return -1
    return a.umurHari - b.umurHari
  })

  // deduplikasi berdasarkan judul yang mirip (Google News sering mengulang Detik)
  const lihat = new Set()
  const hasil = []
  for (const b of semua) {
    const kunci = b.judul.toLowerCase().replace(/[^a-z0-9]/g, '').slice(0, 60)
    if (lihat.has(kunci)) continue
    lihat.add(kunci)
    hasil.push(b)
    if (hasil.length >= maks) break
  }

  return hasil
}

/**
 * Apakah sebuah pertanyaan menanyakan berita/kabar kesehatan terkini?
 * Dipakai oleh rute untuk memilih jalur berita, bukan Wikipedia.
 *
 * Mendeteksi DUA bahasa — antarmuka aplikasi ini dwibahasa, jadi pertanyaan
 * berbahasa Inggris ("latest health news today") punya hak yang sama untuk
 * masuk jalur berita. Diuji: tanpa sinyal Inggris, pertanyaan itu dijawab
 * dari artikel Wikipedia "Hello Health" — cacat yang sama yang dulu membuat
 * jalur ini dibuat.
 *
 * Sinyalnya berjenjang supaya pertanyaan medis biasa tidak salah jalur:
 *   1. kata berita/kabar/news + topik kesehatan     -> berita
 *   2. kata terbaru/terkini/latest + topik          -> berita
 *   3. kata lemah (info/update/informasi) hanya kalau ADA penanda waktu
 *      (hari ini, kemarin, baru, dst.)              -> berita
 * "hari ini" SENDIRI tidak pernah memicu — "dokter hari ini buka?" adalah
 * pertanyaan praktis, bukan permintaan berita. "terakhir" SENGAJA tidak
 * dipakai: "obat flu terakhir yang saya minum" bukan permintaan berita.
 */
export function menanyakanBerita(teks) {
  const t = String(teks ?? '').toLowerCase()
  const topik = /\b(kesehatan|sakit|penyakit|obat|vaksin|virus|wabah|rs|rumah sakit|dokter|health|disease|medicine|vaccine|virus outbreak|hospital|doctor)\b/
  if (!topik.test(t)) return false
  if (/\b(berita|kabar|news)\b/.test(t)) return true
  if (/\b(terbaru|terkini|latest)\b/.test(t)) return true
  return /\b(update|info|informasi)\b/.test(t) &&
    /\b(hari ini|kemarin|minggu ini|baru|tadi|sekarang|terbaru|terkini|today|yesterday|this week|now)\b/.test(t)
}
