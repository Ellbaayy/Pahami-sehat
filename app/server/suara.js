/**
 * Suara natural (text-to-speech) untuk jawaban AI.
 *
 * Memakai suara neural Microsoft lewat layanan "Edge Read Aloud", peramban
 * tidak lagi bergantung pada mesin suara sistem (espeak-ng) yang terdengar
 * seperti robot dan bersuara laki-laki.
 *
 * DUA HAL YANG MEMBUAT INI TERASA SEPERTI DIBACAKAN MANUSIA:
 *
 * 1. Suara neural Indonesia (`id-ID-GadisNeural`), bukan mesin sistem.
 *    Tersedia juga suara daerah: `jv-ID-SitiNeural` (Jawa) dan
 *    `su-ID-TutiNeural` (Sunda).
 *
 * 2. NADANYA MENGIKUTI ISI KALIMAT. Teks dipotong per kalimat, tiap kalimat
 *    diberi nada dan tempo sendiri, lalu hasilnya disambung. Kalimat
 *    peringatan dibacakan lebih rendah dan lebih lambat supaya terdengar
 *    serius; kalimat penutup sedikit lebih tinggi supaya terdengar hangat.
 *    Tanpa ini, seluruh jawaban dibacakan dengan satu nada datar.
 *
 * BATAS YANG SUDAH DIUKUR (jangan diubah tanpa mengukur ulang):
 *   - `<break>` TIDAK didukung layanan ini; memakainya membuat koneksi
 *     ditutup sebelum selesai. Jeda didapat dari tanda baca saja.
 *   - Satu permintaan hanya menerima MAKSIMAL 2 elemen `<prosody>`. Karena
 *     itu tiap kalimat dibuat sebagai permintaan sendiri, lalu disambung.
 *     Ini juga yang membuat nadanya bisa berbeda-beda per kalimat.
 *   - MP3 tersusun dari bingkai mandiri, jadi menyambung berkas utuh aman
 *     (sudah diperiksa: durasi dan jumlah bingkai hasil sambungan utuh).
 *   - Sekitar 4 permintaan serentak adalah titik tercepat yang berguna
 *     (13 kalimat: 12 detik berurutan -> 4 detik serentak, isi tetap sama).
 *
 * DIPERBAIKI 14 Okt 2026 — SUARA NATURAL SUDAH BERJALAN.
 * Sebelumnya jalur ini SELALU gagal 403 di komputer sendiri, dan seluruh fitur
 * suara dikira mustahil. Penyebabnya sepele: `msedge-tts` yang terpasang masih
 * 2.0.9, sedangkan 2.1.0 dirilis 13 Okt 2026 dan MEMPERBAIKI handshake-nya.
 * Setelah dinaikkan ke ^2.1.0, kelima suara berhasil. Diukur di mesin ini:
 *
 *   /api/suara  teks 1 kalimat  -> 200, audio/mpeg, 26.064 byte
 *   /api/suara  teks 8 kalimat  -> 200, audio/mpeg, 237.744 byte, 39,62 detik
 *   lima suara (id lk/pr, jv, su, en) -> kelimanya berhasil, 0,4–0,7 detik
 *   8 kalimat dengan 4 pekerja serentak -> 8/8 berhasil, 1,8 detik
 *   8 permintaan berturut-turut tanpa jeda -> 8/8 berhasil
 *
 * Isinya DIBUKTIKAN dengan transkripsi (faster-whisper), bukan hanya dari
 * ukuran berkas: hasil /api/suara teks panjang terbaca kembali sebagai teks
 * aslinya dengan keyakinan bahasa 1,00. Jadi ini bukan audio kosong.
 *
 * BATAS YANG TETAP ADA — DAN SEKARANG DITANGANI: layanan Microsoft membalas
 * HTTP `429` (terlalu sering) kalau dipanggil beruntun. Diukur 14 Okt 2026
 * dengan jeda 3 detik antar permintaan: hanya 4 dari 8 yang lolos, sisanya
 * `429`. Karena satu permintaan /api/suara bisa memuat puluhan kalimat (satu
 * permintaan per kalimat), satu saja yang kena 429 membuat SELURUH jawaban
 * gagal — pengguna tidak dapat suara sama sekali padahal 7 kalimat lain
 * berhasil. Sekarang tiap kalimat diulang sampai `COBA_ULANG` kali dengan jeda
 * bertingkat, dan koneksi yang sudah rusak disambung ulang. Jangan hapus
 * percobaan ulang ini; mengukur sekali lalu menyimpulkan "rusak" juga salah —
 * 429 itu sementara dan pulih dalam ~1 detik.
 *
 * KEPUTUSAN JAGI (14 Okt 2026) — HANYA JALUR MICROSOFT.
 * Dulu ada jalur kedua lewat Kenari (`POST /audio/speech`) yang dicoba LEBIH
 * DULU di server biasa. Jalur itu dibuang karena selalu merugikan:
 *   - saldo akun Kenari Rp 0, jadi setiap permintaan ditolak `402
 *     insufficient_balance` (atau menggantung sampai batas waktu 20 detik)
 *     SEBELUM akhirnya pindah ke Microsoft;
 *   - penantian itu murni pemborosan: /api/suara jadi 20 detik lebih lambat
 *     untuk setiap kalimat tanpa pernah menghasilkan audio.
 * Jadi sekarang Microsoft adalah satu-satunya jalur di server biasa. Jangan
 * hidupkan kembali jalur Kenari tanpa perintah jagi.
 *
 * CATATAN LISENSI: suara ini milik Microsoft dan diakses lewat layanan
 * Read Aloud, yang izin komersialnya belum dinyatakan tertulis. Aman untuk
 * pemakaian lomba/pribadi; untuk produk komersial sebaiknya pindah ke
 * Azure Speech resmi atau mesin suara lokal (mis. Piper).
 */

import { MsEdgeTTS, OUTPUT_FORMAT } from 'msedge-tts'

/** Suara per bahasa: jawaban dibacakan sesuai bahasanya. */
const SUARA = {
  id: 'id-ID-GadisNeural', // perempuan Indonesia — suara utama
  jv: 'jv-ID-SitiNeural', // perempuan Jawa
  su: 'su-ID-TutiNeural', // perempuan Sunda
  en: 'en-US-AriaNeural', // perempuan Inggris (untuk jawaban berbahasa Inggris)
}

/**
 * Batas aman panjang teks yang dibacakan.
 *
 * KENAPA 4000 DAN APA AKIBATNYA: teks yang lebih panjang dari ini DIPOTONG,
 * bukan ditolak — sisa kalimatnya tidak dibacakan. Dulu komentar di sini
 * mengklaim angkanya "menjaga waktu proses tetap wajar", padahal yang
 * sebenarnya terjadi adalah isinya hilang diam-diam: diukur, masukan 9100
 * karakter menghasilkan keluaran 4000 karakter, jadi 5100 karakter lenyap
 * tanpa pemberitahuan.
 *
 * Sekarang angka ini SAMA dengan batas panjang /api/suara (lihat
 * server/batasInput.js — MAKS_SUARA). Dengan begitu teks yang lolos ke sini
 * tidak pernah lebih panjang dari batas ini, sehingga tidak ada lagi
 * pemotongan diam-diam. Jangan naikkan angka ini tanpa menaikkan MAKS_SUARA
 * juga.
 */
const MAKS_KARAKTER = 4000

/** Berapa kalimat yang diproses serentak. */
const SERENTAK = 4

/**
 * Batas waktu keseluruhan untuk membuat suara.
 *
 * KENAPA PERLU: pernah terjadi permintaan /api/suara menggantung sampai
 * koneksi diputus platform (60 detik di Vercel) tanpa balasan apa pun. Yang
 * bisa diukur dari kejadian itu:
 *   - permintaan PERTAMA setelah server start butuh ~5,5 detik (cold start
 *     WebSocket ke Microsoft); permintaan berikutnya 0,5–1,0 detik
 *   - 3900 karakter dengan 130 kalimat butuh 15,5 detik
 *   - 5687 karakter dengan 51 kalimat butuh 7,9 detik
 * Penyebab pasti hang-nya tidak bisa direproduksi ulang, jadi daripada
 * menebak-nebak penyebabnya, batas waktu ini memastikan kegagalan apa pun
 * berubah jadi pesan yang bisa dibaca — bukan koneksi yang diam.
 *
 * Angkanya di bawah maxDuration Vercel (60 detik) dengan sisa ruang, supaya
 * kita sendiri yang menyerah lebih dulu dan bisa mengirim pesan.
 */
const BATAS_WAKTU_MS = 45_000

/**
 * Bungkus janji dengan batas waktu.
 * @template T
 * @param {Promise<T>} janji
 * @param {number} ms
 * @returns {Promise<T>}
 */
function denganBatasWaktu(janji, ms) {
  let timer
  return Promise.race([
    janji.finally(() => clearTimeout(timer)),
    new Promise((_, tolak) => {
      timer = setTimeout(() => tolak(new Error(`melebihi batas waktu ${ms / 1000} detik`)), ms)
    }),
  ])
}

/**
 * Pilih suara berdasarkan bahasa jawaban.
 *
 * CATATAN: fungsi ini HANYA menerima kode bahasa. Dulu ada pemanggil yang
 * mengirim argumen kedua (teks), padahal parameternya cuma satu — argumen itu
 * dibuang diam-diam. Sekarang hanya satu parameter supaya tidak ada yang
 * mengira ada logika tambahan di sini.
 *
 * @param {'id'|'jv'|'su'|'en'|string} kode
 */
export function pilihSuara(kode) {
  return SUARA[kode] ?? SUARA.id
}

/**
 * Tentukan bahasa yang dipakai untuk membacakan.
 *
 * URUTANNYA PENTING: teks jawaban diperiksa LEBIH DULU, karena kode bahasa
 * yang dikirim aplikasi adalah bahasa ANTARMUKA (Indonesia/Inggris), bukan
 * bahasa jawaban. Tanpa ini, jawaban berbahasa Jawa akan dibacakan dengan
 * suara Indonesia — terdengar aneh dan salah logat.
 *
 * @param {string} teks - teks jawaban
 * @param {string} diminta - kode bahasa dari aplikasi (cadangan)
 */
export function tentukanBahasa(teks, diminta = '') {
  const dariTeks = tebakBahasaDaerah(teks)
  if (dariTeks !== 'id') return dariTeks // Jawa/Sunda menang
  if (diminta === 'en') return 'en'
  return 'id'
}

/**
 * Tebak bahasa daerah dari teks jawaban, karena endpoint TTS hanya menerima
 * kode bahasa, bukan teksnya. Hanya Jawa dan Sunda yang punya suara sendiri.
 */
export function tebakBahasaDaerah(teks) {
  const t = String(teks ?? '').toLowerCase()
  const jawa = ['yaiku', 'iku', 'dina', 'sawise', 'gejalane', 'menika', 'punika', 'saged', 'nganggo', 'wonten', 'matur', 'nuwun']
  const sunda = ['nyaeta', 'nyaéta', 'ieu', 'sanggeus', 'panyakit', 'numutkeun', 'abdi', 'kasakit', 'teh ', 'oge ', 'ogé ']
  const nJawa = jawa.filter((k) => t.includes(k)).length
  const nSunda = sunda.filter((k) => t.includes(k)).length
  if (nJawa === 0 && nSunda === 0) return 'id'
  return nJawa >= nSunda ? 'jv' : 'su'
}

/**
 * Tentukan nada & tempo untuk satu kalimat, mengikuti isinya.
 *
 * Aturannya sengaja sederhana dan bisa dibaca manusia — bukan model tambahan,
 * supaya hasilnya bisa diprediksi dan tidak menambah waktu tunggu.
 *
 * @returns {{pitch: string, rate: string}}
 */
export function nadaKalimat(kalimat, posisi = {}) {
  const k = String(kalimat ?? '').trim()
  const kecil = k.toLowerCase()

  // kalimat peringatan / tanda bahaya -> lebih rendah & lebih lambat
  if (
    /^(perhatian|awas|penting|hati-hati|jangan|segera|waspada|tanda bahaya)\b/.test(kecil) ||
    /\b(bahaya|segera ke dokter|segera ke rumah sakit|jangan ditunda|bisa berakibat fatal)\b/.test(kecil)
  ) {
    return { pitch: '-18Hz', rate: '-10%' }
  }

  // pertanyaan -> sedikit naik, seperti orang bertanya
  if (k.endsWith('?')) return { pitch: '+8Hz', rate: '+0%' }

  // pembuka / sapaan -> hangat
  if (posisi.pertama) return { pitch: '+0Hz', rate: '-4%' }

  // penutup -> sedikit lebih tinggi supaya terdengar ramah
  if (posisi.terakhir) return { pitch: '+10Hz', rate: '+0%' }

  return { pitch: '+0Hz', rate: '+0%' }
}

/**
 * Pecah teks jadi kalimat-kalimat yang layak dibacakan.
 * Kalimat yang sangat pendek digabung supaya tidak ada bagian yang terputus-putus.
 *
 * CATATAN NAMA: dulu fungsi ini bernama `potongKalimat`, sama seperti fungsi
 * pemotong teks di server/teks.js — padahal tugasnya berbeda (memecah jadi
 * daftar kalimat, bukan memotong panjang). Nama yang sama untuk dua tugas
 * berbeda mudah tertukar saat dirawat, jadi sekarang dinamai `pecahKalimat`.
 */
export function pecahKalimat(teks) {
  const bersih = String(teks ?? '')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, MAKS_KARAKTER)
  if (!bersih) return []

  const kasar = bersih.match(/[^.!?]+[.!?]+|[^.!?]+$/g) ?? [bersih]
  const hasil = []
  for (const bagian of kasar) {
    const k = bagian.trim()
    if (!k) continue
    // gabungkan potongan yang terlalu pendek ke kalimat sebelumnya
    if (k.length < 25 && hasil.length) hasil[hasil.length - 1] += ' ' + k
    else hasil.push(k)
  }
  return hasil
}

/** Buat satu bagian audio untuk satu kalimat. */
async function buatBagian(tts, kalimat, opsi) {
  const { audioStream } = tts.toStream(kalimat, opsi)
  const potongan = []
  for await (const c of audioStream) potongan.push(c)
  return Buffer.concat(potongan)
}

/* ---------------------------------------------------- ulang saat kena 429 --- */

/**
 * Berapa kali satu kalimat dicoba ulang, dan berapa lama menunggu di antaranya.
 *
 * KENAPA PERLU: diukur 14 Okt 2026 dengan jeda 3 detik antar permintaan, hanya
 * 4 dari 8 permintaan yang lolos — sisanya `429`. Satu permintaan /api/suara
 * membuat SATU permintaan per kalimat, jadi jawaban 13 kalimat bisa memicu
 * puluhan permintaan beruntun; satu kalimat yang gagal membuat seluruh
 * jawaban gagal. 429 ini pulih cepat (~1 detik), jadi menunggu lalu mengulang
 * jauh lebih baik daripada menyerah.
 *
 * Jeda dinaikkan bertingkat (0,5 → 1,0 → 1,5 detik, total 3 detik) supaya tidak
 * menghajar layanan yang sedang membatasi kita — 429 di sini pulih dalam ~1 detik.
 */
const COBA_ULANG = 4
const JEDA_ULANG_MS = 500

/** Sebuah galat layar suara yang layak dicoba ulang? (429 / koneksi putus) */
function layakDiulang(e) {
  const p = String(e?.message ?? e)
  return /429|too many requests|connection closed|ECONNRESET|socket hang up|ETIMEDOUT/i.test(p)
}

/** Format keluaran yang dipakai untuk semua suara (MP3 24 kHz mono). */
const FORMAT_MP3 = OUTPUT_FORMAT.AUDIO_24KHZ_48KBITRATE_MONO_MP3

/**
 * Buka (atau buka ULANG) koneksi WebSocket ke Microsoft, dengan percobaan ulang.
 *
 * KENAPA PERLU DIULANG JUGA: 429 bisa datang saat MEMBUKA koneksi, bukan cuma
 * saat mengirim kalimat. Diukur 14 Okt 2026: satu permintaan gagal setelah 0,57
 * detik — secepat itu mustahil kalau percobaan ulang sempat jalan, artinya
 * galatnya datang dari `setMetadata` yang ada di luar pembungkus. Jadi
 * pembukaan koneksi WAJIB ikut diulang.
 *
 * @param {{tts: import('msedge-tts').MsEdgeTTS, bahasa: string}} e
 */
async function sambung(e) {
  let terakhir
  for (let ke = 1; ke <= COBA_ULANG; ke++) {
    try {
      await e.tts.setMetadata(pilihSuara(e.bahasa), FORMAT_MP3)
      return
    } catch (err) {
      terakhir = err
      if (ke === COBA_ULANG || !layakDiulang(err)) throw err
      await new Promise((r) => setTimeout(r, JEDA_ULANG_MS * ke))
    }
  }
  throw terakhir
}

/**
 * Buat satu bagian audio, dengan percobaan ulang saat kena batas laju.
 *
 * KENAPA KONEKSI DISAMBUNG ULANG: setelah kena 429, WebSocket milik instance
 * itu sudah ditutup pustakanya (`_closeSocket`). Memakai instance yang soketnya
 * sudah mati akan gagal terus, jadi sebelum mencoba lagi koneksinya dibuka
 * ulang lewat `sambung()`.
 *
 * @param {{tts: import('msedge-tts').MsEdgeTTS, bahasa: string}} e
 * @param {string} kalimat
 * @param {{pitch: string, rate: string}} opsi
 */
async function buatBagianTahan(e, kalimat, opsi) {
  let terakhir
  for (let ke = 1; ke <= COBA_ULANG; ke++) {
    try {
      return await buatBagian(e.tts, kalimat, opsi)
    } catch (err) {
      terakhir = err
      if (ke === COBA_ULANG || !layakDiulang(err)) throw err
      await new Promise((r) => setTimeout(r, JEDA_ULANG_MS * ke))
      await sambung(e).catch(() => {
        /* dibiarkan — percobaan berikutnya akan melaporkan galatnya sendiri */
      })
    }
  }
  throw terakhir
}


/**
 * Hasilkan audio MP3 dari teks, dengan nada mengikuti isi tiap kalimat.
 *
 * Memakai suara neural Microsoft (`msedge-tts`, WebSocket) — satu-satunya
 * jalur yang dipakai sekarang, lihat "KEPUTUSAN JAGI" di kepala berkas.
 *
 * Di serverless (Vercel) WebSocket tidak bisa hidup, jadi fungsi ini menyerah
 * lebih awal dengan pesan yang jujur daripada menunggu batas waktu habis.
 *
 * @param {string} teks
 * @param {{ bahasa?: string }} opsi
 * @returns {Promise<Buffer>}
 */
export async function buatSuara(teks, { bahasa = 'id' } = {}) {
  const kalimat = pecahKalimat(teks)
  if (!kalimat.length) throw new Error('Tidak ada teks untuk dibacakan.')

  // msedge-tts memakai WebSocket ke Microsoft, dan itu TIDAK MUNGKIN di fungsi
  // serverless. Jangan dicoba sama sekali: pengguna akan menunggu sampai batas
  // waktu habis hanya untuk mendapat kegagalan yang sudah pasti.
  if (process.env.VERCEL) {
    throw new Error(
      'Suara natural Microsoft tidak bisa dibuat di lingkungan ini (WebSocket tidak jalan di serverless). Di laptop/komputer sendiri jalur ini bekerja.',
    )
  }

  const hasil = new Array(kalimat.length)

  // Satu instance per pekerjaan: beberapa permintaan serentak pada satu
  // instance saling berebut koneksi WebSocket yang sama.
  let i = 0
  const pekerja = Array.from({ length: Math.min(SERENTAK, kalimat.length) }, async () => {
    const tts = new MsEdgeTTS()
    const e = { tts, bahasa }
    // Pembukaan koneksi ikut diulang: 429 bisa datang di sini, bukan cuma saat
    // mengirim kalimat (lihat sambung()).
    await sambung(e)
    try {
      while (i < kalimat.length) {
        const idx = i++
        const opsi = nadaKalimat(kalimat[idx], {
          pertama: idx === 0,
          terakhir: idx === kalimat.length - 1,
        })
        // buatBagianTahan: ulangi saat kena 429, sambung ulang koneksinya.
        hasil[idx] = await buatBagianTahan(e, kalimat[idx], opsi)
      }
    } finally {
      try {
        tts.close()
      } catch {
        /* diabaikan */
      }
    }
  })

  // Batas waktu dipasang di SELURUH pekerjaan, bukan per kalimat: kalau satu
  // kalimat menggantung, pekerja lainnya juga tidak akan pernah selesai.
  await denganBatasWaktu(Promise.all(pekerja), BATAS_WAKTU_MS)

  const terisi = hasil.filter(Boolean)
  if (!terisi.length) throw new Error('Gagal membuat suara.')
  return Buffer.concat(terisi)
}

/** Daftar suara msedge-tts per bahasa — dipakai rute sebagai petunjuk cadangan
 * saat suara natural gagal, jadi memang dipakai dari luar berkas ini. */
export const DAFTAR_SUARA = SUARA
