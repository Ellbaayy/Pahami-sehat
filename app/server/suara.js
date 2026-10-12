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

/**
 * Hasilkan audio MP3 dari teks, dengan nada mengikuti isi tiap kalimat.
 *
 * @param {string} teks
 * @param {{ bahasa?: string }} opsi
 * @returns {Promise<Buffer>}
 */
export async function buatSuara(teks, { bahasa = 'id' } = {}) {
  const kalimat = pecahKalimat(teks)
  if (!kalimat.length) throw new Error('Tidak ada teks untuk dibacakan.')

  const suara = pilihSuara(bahasa)
  const hasil = new Array(kalimat.length)

  // Satu instance per pekerjaan: beberapa permintaan serentak pada satu
  // instance saling berebut koneksi WebSocket yang sama.
  let i = 0
  const pekerja = Array.from({ length: Math.min(SERENTAK, kalimat.length) }, async () => {
    const tts = new MsEdgeTTS()
    await tts.setMetadata(suara, OUTPUT_FORMAT.AUDIO_24KHZ_48KBITRATE_MONO_MP3)
    try {
      while (i < kalimat.length) {
        const idx = i++
        const opsi = nadaKalimat(kalimat[idx], {
          pertama: idx === 0,
          terakhir: idx === kalimat.length - 1,
        })
        hasil[idx] = await buatBagian(tts, kalimat[idx], opsi)
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

export const DAFTAR_SUARA = SUARA
