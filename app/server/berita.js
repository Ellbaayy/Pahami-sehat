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
 *
 * DETEKSI PERTANYAAN BERITA (diperbaiki 15 Okt 2026)
 * --------------------------------------------------
 * Aplikasi ini aplikasi kesehatan, jadi pertanyaan berita di dalamnya hampir
 * selalu berarti berita KESEHATAN — termasuk kalau kata "kesehatan" tidak
 * disebut. Tiga cacat yang ditemukan lewat `uji-jawaban.mjs` dan sudah dibetulkan:
 *
 *   1. "berita terbaru hari ini" TIDAK dikenali (tidak ada kata "kesehatan"),
 *      lalu dicari ke Wikipedia dan mendapat artikel "Berita" — definisi, bukan
 *      berita. Model pun menjawab "saya tidak bisa menyebutkan berita terbaru".
 *      Sekarang kata berita/kabar/news + penanda waktu sudah cukup.
 *   2. Di rute, jalur berita diperiksa SESUDAH `deteksiSantai()`. Pesan 3 kata
 *      tanpa kata tanya dianggap sapaan, jadi jalur berita tidak pernah tercapai.
 *      Sekarang jalur berita diperiksa LEBIH DULU.
 *   3. "apa kabar hari ini" (sapaan) ikut tertangkap aturan berita baru. Sekarang
 *      ada daftar penolakan SAPAAN_KABAR — kecuali kalau ada topik kesehatan.
 *
 * Topik yang JELAS bukan kesehatan (politik, bola, ekonomi) tetap ditolak: lebih
 * baik mode santai menjawab jujur bahwa itu bukan bidangnya daripada menyodorkan
 * berita kesehatan untuk pertanyaan yang tidak menanyakannya.
 */

import { readFile, writeFile, mkdir } from 'node:fs/promises'
import { existsSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { simpanBerita } from './db.js'
import { catatJamServer, jamSekarang } from './jam.js'

const UA =
  'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120 Safari/537.36'

/**
 * Batas umur berita: hanya berita dari N hari terakhir yang dianggap "terkini".
 */
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
    const umurHari = sah ? Math.floor((jamSekarang() - tanggal.getTime()) / 86400000) : null

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
      // Jam acuan ikut diperbarui dari respons ini (lihat server/jam.js) —
      // jadi penjadwalan berita memakai jam internet, bukan jam mesin.
      catatJamServer(res)

      if (!res.ok) throw new Error(`http_${res.status}`)
      const xml = await bacaDenganBatas(res)
      if (!xml.includes('<item>')) throw new Error('bukan_rss')
      return parseRss(xml, namaSumber)
    } catch {
      // percobaan terakhir juga gagal — kembalikan kosong, bukan melempar
      if (i === percobaan - 1) return []
      await new Promise((r) => {
        setTimeout(r, 800)
      })
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
 *   1. kata berita/kabar/news + (topik kesehatan ATAU penanda waktu) -> berita
 *   2. kata terbaru/terkini/latest + topik kesehatan                 -> berita
 *   3. kata lemah (info/update/informasi) + topik kesehatan + waktu  -> berita
 *
 * TOPIK KESEHATAN TIDAK WAJIB kalau kata beritanya sudah tegas. "berita
 * terbaru hari ini" tidak menyebut kata "kesehatan" sama sekali, tetapi di
 * dalam aplikasi kesehatan maksudnya jelas — dan dulu pertanyaan persis itu
 * dijawab dari artikel Wikipedia "Berita" lalu model terpaksa menolak.
 *
 * Yang tetap ditolak: pertanyaan berita tentang topik yang JELAS bukan
 * kesehatan (politik, bola, ekonomi), dan sapaan yang kebetulan memuat kata
 * "kabar" tanpa penanda waktu ("halo, apa kabar?").
 *
 * "hari ini" SENDIRI tidak pernah memicu — "dokter hari ini buka?" adalah
 * pertanyaan praktis, bukan permintaan berita. "terakhir" SENGAJA tidak
 * dipakai: "obat flu terakhir yang saya minum" bukan permintaan berita.
 */

/** Topik kesehatan — dipakai untuk memastikan sebuah pertanyaan berita memang soal kesehatan. */
const TOPIK_KESEHATAN =
  /\b(kesehatan|sakit|penyakit|obat|vaksin|virus|wabah|rs|rumah sakit|dokter|perawat|puskesmas|klinik|gizi|imunisasi|pasien|medis|health|disease|medicine|vaccine|outbreak|hospital|doctor|nurse|clinic|patient)\b/

/**
 * Topik yang JELAS bukan kesehatan.
 *
 * KENAPA PERLU (15 Okt 2026): aplikasi ini aplikasi kesehatan, jadi pertanyaan
 * berita di dalamnya hampir selalu berarti berita KESEHATAN. Tetapi permintaan
 * berita tentang topik lain (politik, bola, ekonomi) bukan urusan aplikasi ini —
 * menjawabnya dengan berita kesehatan justru menyesatkan pengguna.
 *
 * 'bola' memakai lookahead negatif: "bola mata" adalah topik kesehatan yang
 * sah, sedangkan "berita bola" jelas soal olahraga.
 *
 * Kata topik di sini TIDAK langsung menolak — ia hanya menolak kalau TIDAK ada
 * kata kesehatan sama sekali. "berita harga obat terbaru" tetap masuk jalur
 * berita karena ada 'obat'.
 */
const TOPIK_BUKAN_KESEHATAN =
  /\b(politik|pemilu|pilpres|pilkada|partai|menteri|ekonomi|saham|bisnis|keuangan|inflasi|harga|olahraga|sepak bola|sepakbola|bola(?! mata)|liga|piala|pertandingan|klub|juara|hiburan|selebriti|artis|film|musik|teknologi|gadget|aplikasi|game|otomotif|motor|mobil|wisata|kriminal|hukum|pendidikan|sekolah|kampus|politics|election|economy|sports|business|entertainment|celebrity|stock market)\b/

/** Penanda waktu/kekinian — bagian yang membuat sebuah pertanyaan jadi soal KABAR. */
const PENANDA_WAKTU =
  /\b(hari ini|kemarin|minggu ini|pekan ini|bulan ini|baru|terbaru|terkini|tadi|sekarang|today|yesterday|this week|now|latest|recent)\b/

/**
 * Pertanyaan "apa yang baru?" tanpa kata 'berita' atau 'kesehatan'.
 *
 * KENAPA PERLU (16 Okt 2026 — keluhan jagi): "apa yang baru hari ini" dijawab
 * dengan "hasil pencarian kosong". Penyebabnya DIUKUR: kalimat itu TIDAK
 * terdeteksi sebagai pertanyaan berita, jadi jatuh ke jalur pencarian
 * Wikipedia — dan Wikipedia tidak punya apa-apa untuk "apa yang baru hari
 * ini", sehingga hasilnya kosong dan model menjawab seadanya.
 *
 * Terukur saat itu: 6 dari 8 cara orang bertanya soal kabar terbaru TIDAK
 * terdeteksi ("apa yang baru hari ini", "ada apa hari ini", "ada yang baru?",
 * "apa yang baru di kesehatan", ...). Yang lolos hanya yang kebetulan memuat
 * kata 'berita'/'kabar'/'terbaru'.
 *
 * Bentuk yang ditangkap di sini adalah POLA TANYA, bukan kata tunggal:
 *   apa yang baru / ada apa / ada yang baru / apa yang terjadi / apa yang
 *   sedang ramai / apa kabar terbaru
 *
 * SENGAJA TIDAK menangkap "apa kabar" saja — itu sapaan, bukan permintaan
 * berita (lihat SAPAAN_KABAR di bawah, yang diperiksa lebih dulu).
 */
const TANYA_KABAR =
  /\b(apa|ada)\s+(yang\s+)?(baru|terjadi|sedang|lagi|hangat|ramai|up|update|kabar)\b|\bada\s+(apa|yang\s+baru)\b|\bwhat('?s|\s+is|\s+are)?\s+(new|up|going on|happening)\b|\bany(thing)?\s+new\b/i

/**
 * Ungkapan sapaan yang memuat kata "kabar".
 *
 * KENAPA PERLU (15 Okt 2026): "apa kabar hari ini" memuat kata 'kabar' DAN
 * penanda waktu 'hari ini', jadi aturan berita menangkapnya — padahal itu
 * sapaan. Uji `uji-jawaban.mjs` menangkapnya sebagai "obrolan biasa malah
 * mencari sumber". Sapaan hanya ditolak kalau TIDAK ada topik kesehatan sama
 * sekali, supaya "apa kabar kesehatan hari ini?" tetap dijawab dengan sumber.
 */
const SAPAAN_KABAR = /\b(apa|gimana|bagaimana)\s+kabar\b|\bkabar\s+baik\b|\bhow\s+are\s+you\b/

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
 *   1. kata berita/kabar/news + (topik kesehatan ATAU penanda waktu) -> berita
 *   2. kata terbaru/terkini/latest + topik kesehatan                 -> berita
 *   3. kata lemah (info/update/informasi) + topik kesehatan + waktu  -> berita
 *
 * TOPIK KESEHATAN TIDAK WAJIB kalau kata beritanya sudah tegas. "berita
 * terbaru hari ini" tidak menyebut kata "kesehatan" sama sekali, tetapi di
 * dalam aplikasi kesehatan maksudnya jelas — dan dulu pertanyaan persis itu
 * dijawab dari artikel Wikipedia "Berita" lalu model terpaksa menolak.
 *
 * Yang tetap ditolak: pertanyaan berita tentang topik yang JELAS bukan
 * kesehatan (politik, bola, ekonomi), dan sapaan yang kebetulan memuat kata
 * "kabar" tanpa penanda waktu ("halo, apa kabar?").
 *
 * "hari ini" SENDIRI tidak pernah memicu — "dokter hari ini buka?" adalah
 * pertanyaan praktis, bukan permintaan berita. "terakhir" SENGAJA tidak
 * dipakai: "obat flu terakhir yang saya minum" bukan permintaan berita.
 */
export function menanyakanBerita(teks) {
  const t = String(teks ?? '').toLowerCase()
  const adaKesehatan = TOPIK_KESEHATAN.test(t)
  const adaTopikLain = TOPIK_BUKAN_KESEHATAN.test(t)
  const adaWaktu = PENANDA_WAKTU.test(t)

  // "apa kabar hari ini" = sapaan, bukan permintaan berita. Ditolak hanya kalau
  // tidak ada topik kesehatan sama sekali ("apa kabar kesehatan hari ini?" tetap
  // dianggap permintaan berita).
  if (SAPAAN_KABAR.test(t) && !adaKesehatan) return false

  // --- bentuk tanya "apa yang baru?" -------------------------------------
  //
  // Diperiksa SEBELUM aturan kata kunci di bawah, karena pertanyaan seperti
  // "apa yang baru hari ini" tidak memuat kata 'berita' maupun topik
  // kesehatan — dua syarat yang dipakai aturan berikutnya. Tanpa cabang ini,
  // pertanyaannya jatuh ke pencarian Wikipedia dan dijawab "hasil pencarian
  // kosong" (keluhan jagi, 16 Okt 2026).
  //
  // PENGECUALIAN yang penting: kalau pertanyaannya menyebut topik yang JELAS
  // bukan kesehatan ("ada apa dengan bola malam ini"), itu bukan urusan
  // aplikasi kesehatan — biarkan aturan di bawah yang menolaknya.
  if (TANYA_KABAR.test(t)) {
    if (adaTopikLain && !adaKesehatan) return false
    return true
  }

  if (/\b(berita|kabar|news)\b/.test(t)) {
    if (adaTopikLain && !adaKesehatan) return false
    return adaKesehatan || adaWaktu
  }

  if (/\b(terbaru|terkini|latest)\b/.test(t)) return adaKesehatan && !adaTopikLain

  return (
    adaKesehatan &&
    !adaTopikLain &&
    adaWaktu &&
    /\b(update|info|informasi)\b/.test(t)
  )
}

/**
 * Jawaban berita DARURAT — disusun dari daftar RSS, bukan dari model.
 *
 * Dipakai rute kalau model benar-benar tidak bisa dimintai JSON yang utuh
 * setelah diulang. Daftar beritanya NYATA (judul + media + umur), jadi jawaban
 * ini tidak mengarang apa pun — jauh lebih baik daripada gelembung KOSONG yang
 * pernah benar-benar terjadi (15 Okt 2026: balasan model terpotong di tengah
 * rencana berpikirmya, `usage.completion_tokens` tepat menyentuh batas).
 *
 * Ditaruh di sini, bukan di rute, supaya bisa diuji tanpa server (`uji-berita.mjs`).
 */
export function jawabanBeritaDarurat(berita = [], kode = 'id') {
  if (!berita.length) return null
  const inggris = kode === 'en'
  const baris = berita.map((b) => {
    const umur =
      b.umurHari === null || b.umurHari === undefined
        ? ''
        : b.umurHari === 0
          ? inggris ? ' (today)' : ' (hari ini)'
          : inggris ? ` (${b.umurHari} days ago)` : ` (${b.umurHari} hari lalu)`
    return `- ${b.judul} — ${b.sumber}${umur}`
  })
  const kepala = inggris
    ? 'The summary could not be written right now, but these are the health news items that were fetched:'
    : 'Ringkasannya sedang tidak bisa dibuat, tetapi ini berita kesehatan yang berhasil diambil:'
  const ekor = inggris
    ? 'These are news reports, not medical explanations. Tap a link to read the original article, and check it against the official source.'
    : 'Ini berita, bukan penjelasan medis. Ketuk tautannya untuk membaca artikel aslinya, dan cek lagi ke sumber resminya.'
  return `${kepala}\n\n${baris.join('\n')}\n\n${ekor}`
}

/* ================================================== ringkasan harian + lonceng ==
 *
 * Jagi meminta (15 Okt 2026): berita WAJIB diperbarui minimal sehari sekali,
 * dan kalau ada yang baru, lonceng pemberitahuan di aplikasi harus berbunyi.
 *
 * Cara kerjanya — pola yang sama seperti konten.js:
 *   1. `ringkasanBerita()` mengambil RSS ringan (maks 3, hanya judul+tanggal
 *      yang dipakai) MAKSIMAL sekali sehari per proses. Hasilnya disimpan ke
 *      memori + berkas `.cache-berita.json` (gitignore, seperti konten).
 *   2. Endpoint `GET /api/berita/ringkas` mengembalikan: jumlah berita SEGAR
 *      (umur <= 1 hari), 3 judul teratas, tanggal `diperbarui`, dan `sidik`
 *      (sidik jari judul — berubah kalau daftarnya berubah).
 *   3. Aplikasi membandingkan `sidik` dengan yang terakhir dibaca; kalau beda
 *      dan ada berita segar -> butir lonceng jenis 'berita' muncul + titik merah.
 *
 * Kenapa tidak fetch tiap permintaan: RSS Detik 100 item — menembaknya di
 * setiap buka aplikasi hanya untuk lonceng adalah pemborosan dan berisiko
 * membuat IP kita dibatasi. Lonceng tidak butuh detik-akurat; sehari sekali
 * sesuai permintaan jagi.
 * ========================================================================== */

const __dirnameBerita = dirname(fileURLToPath(import.meta.url))

/** Berkas cache ringkasan — gitignore, seperti .cache-konten.json. */
const BERKAS_RINGKAS = process.env.CACHE_BERITA || join(__dirnameBerita, '..', '.cache-berita.json')

const BERLAKU_RINGKAS_MS = 24 * 60 * 60 * 1000 // sekali sehari
/** Berita dianggap "segar" (layak membunyikan lonceng) kalau umurnya <= N hari. */
const SEGAR_HARI = 1

let ringkasDiMemori = null
let ringkasBerjalan = null
let ringkasBisaTulis = null

/** Sidik jari FNV-1a dari judul — berubah kalau daftar beritanya berubah. */
export function buatSidikBerita(daftar = []) {
  const isi = daftar.map((d) => d.judul ?? d).sort().join('|')
  let h = 2166136261
  for (let i = 0; i < isi.length; i++) {
    h ^= isi.charCodeAt(i)
    h = Math.imul(h, 16777619)
  }
  return (h >>> 0).toString(16)
}

function ringkasWaktunyaCek(data) {
  if (!data?.berikutnya) return true
  return jamSekarang() >= new Date(data.berikutnya).getTime()
}

async function bacaRingkasDariDisk() {
  try {
    if (!existsSync(BERKAS_RINGKAS)) return null
    const isi = JSON.parse(await readFile(BERKAS_RINGKAS, 'utf8'))
    return Array.isArray(isi?.judul) ? isi : null
  } catch {
    return null
  }
}

async function simpanRingkasKeDisk(data) {
  if (ringkasBisaTulis === false) return
  try {
    await mkdir(dirname(BERKAS_RINGKAS), { recursive: true })
    await writeFile(BERKAS_RINGKAS, JSON.stringify(data), 'utf8')
    ringkasBisaTulis = true
  } catch (e) {
    // lingkungan serverless (read-only): berhenti mencoba, pakai memori saja
    if (e?.code === 'EROFS' || e?.code === 'EACCES' || e?.code === 'EPERM') {
      ringkasBisaTulis = false
    }
  }
}

/**
 * Ambil ringkasan berita harian (cache sekali sehari).
 * Tidak pernah melempar kalau ada simpanan lama — kembalikan yang lama.
 * @returns {Promise<{judul: Array<{judul, sumber}>, segar: number, sidik, diperbarui, berikutnya}>}
 */
export async function ringkasanBerita() {
  if (!ringkasDiMemori) ringkasDiMemori = await bacaRingkasDariDisk()
  if (ringkasDiMemori && !ringkasWaktunyaCek(ringkasDiMemori)) return ringkasDiMemori
  if (ringkasBerjalan) return ringkasBerjalan

  /*
   * `require-atomic-updates` dimatikan untuk berkas ini dengan alasan yang
   * sama seperti `konten.js`: `ringkasBerjalan` bertindak sebagai kunci, jadi
   * badan IIFE di bawah berjalan satu kali pada satu waktu, dan
   * `ringkasBisaTulis` hanya penanda boolean idempoten.
   */
  ringkasBerjalan = (async () => {
    try {
      const daftar = await ambilBeritaKesehatan({ maks: 3 })
      if (!daftar.length) throw new Error('berita kosong')
      const hasil = {
        judul: daftar.map((b) => ({ judul: b.judul, sumber: b.sumber })),
        segar: daftar.filter((b) => b.umurHari !== null && b.umurHari <= SEGAR_HARI).length,
        sidik: buatSidikBerita(daftar),
        diperbarui: new Date(jamSekarang()).toISOString(),
        berikutnya: new Date(jamSekarang() + BERLAKU_RINGKAS_MS).toISOString(),
      }
      ringkasDiMemori = hasil
      await simpanRingkasKeDisk(hasil)
      // Simpan juga ke database — OPSIONAL. Kalau MariaDB mati, hasilnya null
      // dan berkas JSON di atas tetap jadi sumber kebenarannya. Tidak pernah
      // melempar, jadi jalur berita tidak bisa rusak karena database.
      await simpanBerita(daftar).catch(() => null)
      return hasil
    } catch {
      const lama = ringkasDiMemori ?? (await bacaRingkasDariDisk())
      if (lama) return lama
      // belum pernah berhasil sama sekali — kembalikan bentuk kosong yang sah,
      // bukan melempar; lonceng cukup tidak muncul
      return { judul: [], segar: 0, sidik: 'kosong', diperbarui: null, berikutnya: null }
    } finally {
      ringkasBerjalan = null
    }
  })()

  return ringkasBerjalan
}
