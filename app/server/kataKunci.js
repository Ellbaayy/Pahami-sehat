/**
 * Pemilihan kata kunci pencarian — satu tempat untuk seluruh aturannya.
 *
 * MASALAH YANG DIPERBAIKI (diukur langsung ke API Wikipedia Indonesia, bukan
 * dugaan):
 *
 * Pertanyaan "saya menderita gatal-gatal, kira-kira apa yg sedang terjadi"
 * dulu dikirim ke Wikipedia apa adanya. Karena kata tanya dan kata ganti orang
 * tidak dibuang, bahan pencariannya jadi "saya menderita" — dan Wikipedia
 * menjawab dengan artikel "Gangguan obsesif–kompulsif". Hal yang sama terjadi
 * pada "...saya sering merasa lemas" yang jadi "kepada saya" dan menghasilkan
 * "Charles Darwin". Kata "gatal" dan "lemas" tidak pernah ikut dicari.
 *
 * Karena itu di sini ada tiga hal:
 *
 *   1. KATA_GANTI — kata yang tidak pernah boleh jadi bahan pencarian
 *      (kata ganti orang, kata tanya, kata perintah).
 *
 *   2. PETA_PENCARIAN — kata keluhan yang pencariannya jelek dipetakan ke
 *      istilah yang benar. Ini perlu karena pencarian Wikipedia memakai
 *      pencocokan harfiah, bukan makna. Bukti terukur:
 *        "lemas"  -> novel Dan Brown, "Ereksi"     | "kelelahan" -> "Kelelahan"
 *        "pegal"  -> "Diare", "Temu kunci"          | "nyeri otot" -> "Nyeri otot"
 *        "radang tenggorokan" -> "Sambung nyawa"    | "faringitis" -> "Faringitis"
 *
 *   3. kataKunciPencarian() — menyusun bahan pencarian: frasa kesehatan
 *      terpanjang yang muncul di pesan, atau kata isi bila tidak ada istilah
 *      kesehatan sama sekali.
 *
 * Pencocokan memakai BATAS KATA, bukan potongan huruf. Ini penting: pencocokan
 * potongan huruf pernah membuat "makasih" dianggap topik kesehatan karena
 * memuat "asi" (air susu ibu), dan "influenza" ikut tertangkap oleh "flu".
 */

import { KATA_KESEHATAN } from './prompts.js'

/* ------------------------------------------- kata yang tidak pernah berguna -- */

/**
 * Kata yang selalu menempel pada keluhan tapi tidak pernah jadi bahan
 * pencarian. "saya", "menderita", "merasa", "sedang", "terjadi" — semuanya
 * muncul di pertanyaan asli, dan justru itulah yang dulu dikirim ke Wikipedia.
 */
export const KATA_GANTI = new Set([
  // kata ganti orang
  'saya', 'aku', 'kami', 'kita', 'kamu', 'anda', 'dia', 'mereka', 'kalian',
  'diriku', 'dirinya', 'diri', 'gue', 'gua', 'aq', 'ku', 'mu',
  // kata kerja/keadaan yang menempel pada keluhan
  'menderita', 'merasa', 'terasa', 'mengalami', 'kena', 'terkena', 'sedang',
  'terjadi', 'sebenarnya', 'sering', 'seringkali', 'kadang', 'selalu',
  'mau', 'ingin', 'pengen', 'butuh', 'perlu',
  // kata depan — selalu menempel, tidak pernah jadi bahan pencarian
  'kepada', 'tentang', 'soal', 'mengenai', 'oleh', 'akan', 'buat',
  // kata perintah
  'tolong', 'coba', 'mohon', 'bantu', 'bantuin', 'jelaskan', 'jelasin',
  'terangkan', 'terangin', 'terangno', 'terangkeun', 'sebutkan', 'kasih',
  'beri', 'beritahu', 'tahu', 'tau', 'mengerti', 'ngerti', 'paham',
  'dong', 'ya', 'kok', 'sih', 'deh', 'nih', 'lah',
])

/* ------------------------------------------------- istilah pencarian khusus -- */

/**
 * Frasa yang harus dikenali LEBIH DULU daripada kata tunggalnya.
 * "sakit kepala" jangan sampai jadi "sakit"; "nyeri otot" jangan jadi "nyeri".
 * Beberapa di antaranya juga istilah yang pencariannya sudah terbukti tepat.
 */
const FRASA_KHUSUS = [
  'sakit kepala',
  'sesak napas',
  'nyeri otot',
  'radang tenggorokan',
  'gangguan tidur',
  'tekanan darah tinggi',
  'kadar gula darah',
  'influenza',
  'faringitis',
  'kelelahan',
  'mialgia',
  'pruritus',
  'biduran',
]

/**
 * Seluruh istilah yang dikenali, DIURUTKAN DARI YANG TERPANJANG.
 * Urutan ini yang membuat "demam berdarah" menang atas "demam", dan
 * "tidak nafsu makan" menang atas "nafsu makan".
 */
export const ISTILAH_CARI = [...new Set([...FRASA_KHUSUS, ...KATA_KESEHATAN])].sort(
  (a, b) => b.length - a.length,
)

/* ------------------------------------------------------ pemetaan pencarian -- */

/**
 * Kata keluhan -> istilah pencarian yang benar.
 * Setiap pasangan di bawah ini diuji langsung ke API Wikipedia Indonesia:
 * yang kiri menghasilkan artikel tidak nyambung, yang kanan menghasilkan
 * artikel kesehatan yang tepat.
 */
export const PETA_PENCARIAN = {
  lemas: 'kelelahan',
  lelah: 'kelelahan',
  letih: 'kelelahan',
  capek: 'kelelahan',
  'pegal-pegal': 'nyeri otot',
  pegal: 'nyeri otot',
  'radang tenggorokan': 'faringitis',
  'gatal-gatal': 'gatal',
}

/* ------------------------------------------------------------- kata daerah -- */

/**
 * Kata daerah -> istilah Indonesia yang setara.
 *
 * KENAPA PERLU: kata kesehatan resmi hampir selalu berbahasa Indonesia,
 * sedangkan aplikasi ini justru menyasar penutur bahasa daerah (README
 * menyebut 718 bahasa daerah). Sebelum ini, pertanyaan bahasa Jawa
 * "aku krasa gatel tenan" tidak menemukan sumber APA PUN, karena "gatel"
 * tidak dikenali. Model tetap menjawab dengan jujur, tapi tanpa sumber.
 *
 * Semua istilah di sisi kanan sudah diuji langsung ke API Wikipedia Indonesia
 * (lihat catatan di PETA_PENCARIAN). Jadi pemetaan ini tidak menambah risiko
 * baru — hanya menerjemahkan kata, bukan menebak artikel.
 *
 * Hanya kata yang memang berbeda dari bahasa Indonesia yang didaftarkan;
 * kata seperti "nyeri" sudah sama di Jawa/Sunda sehingga tidak perlu.
 */
export const PETA_DAERAH = {
  // Jawa
  gatel: 'gatal',
  mumet: 'pusing',
  puyeng: 'pusing',
  watuk: 'batuk',
  mriyang: 'demam',
  mules: 'diare',
  lemes: 'kelelahan',
  pegel: 'nyeri otot',
  abuh: 'bengkak',
  seseg: 'sesak napas',
  // Sunda
  bareuh: 'bengkak',
  muriang: 'demam',
  mencret: 'diare',
  leuleus: 'kelelahan',
  tikoro: 'faringitis',
  // Melayu/umum
  demam: 'demam',
  pening: 'pusing',
}

/** Ganti kata daerah dengan istilah Indonesia, memakai batas kata. */
function terjemahkanDaerah(norm) {
  if (!norm) return norm
  let hasil = norm
  for (const [daerah, indo] of Object.entries(PETA_DAERAH)) {
    if (daerah === indo) continue
    const pola = new RegExp(`(?<!\\p{L})${daerah}(?!\\p{L})`, 'gu')
    if (pola.test(hasil)) hasil = hasil.replace(pola, indo)
  }
  return hasil
}

/* ------------------------------------------------------------- kata penting -- */

/** Kata tanya & kata umum — tidak membantu pencarian maupun penyaringan. */
const KATA_UMUM = new Set([
  'apa', 'itu', 'yang', 'dan', 'atau', 'untuk', 'dari', 'ke', 'di', 'pada',
  'dengan', 'adalah', 'berapa', 'bagaimana', 'kapan', 'mengapa', 'kenapa',
  'siapa', 'dimana', 'mana', 'ini', 'ada', 'tidak', 'bukan', 'bisa', 'dapat',
  'harus', 'boleh', 'kalau', 'jika', 'biar', 'supaya', 'agar', 'saat',
  'ketika', 'waktu', 'kasus', 'tahun', 'terbaru', 'data', 'punya',
  'cara', 'saja', 'juga', 'masih', 'sudah', 'belum', 'pernah', 'sama',
  'seperti', 'begitu', 'gitu', 'gini', 'jadi', 'memang', 'mungkin',
  'the', 'what', 'how', 'when', 'why', 'who', 'which', 'is', 'are', 'of',
  'to', 'in', 'on', 'for', 'and', 'or', 'my', 'me', 'you', 'i', 'a', 'an',
])

/** Buang tanda baca, rapikan spasi, kecilkan huruf. */
function normalkan(teks) {
  return String(teks ?? '')
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s]/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

/**
 * Kata isi dari sebuah teks: buang kata ganti, kata tanya, dan kata umum.
 * Dipakai untuk menyaring sumber supaya yang tidak nyambung tidak ikut.
 */
export function kataPenting(teks) {
  const norm = normalkan(teks)
  if (!norm) return []
  return norm
    .split(' ')
    .filter((k) => k.length >= 3 && !KATA_UMUM.has(k) && !KATA_GANTI.has(k))
}

/**
 * Bahan pencarian untuk sebuah pesan pengguna.
 *
 * @param {string} teks - pesan pengguna apa adanya
 * @returns {string} istilah pencarian, atau '' kalau tidak ada yang berguna
 */
export function kataKunciPencarian(teks) {
  const norm = terjemahkanDaerah(normalkan(teks))
  if (!norm) return ''
  const berbatas = ` ${norm} `

  // 1) istilah kesehatan terpanjang yang muncul — paling khusus menang.
  //    Batas kata dipakai supaya "asi" tidak cocok dengan "makasih".
  const ketemu = ISTILAH_CARI.find((t) => berbatas.includes(` ${t} `))
  if (ketemu) return PETA_PENCARIAN[ketemu] ?? ketemu

  // 2) tidak ada istilah kesehatan: pakai kata isi. Maksimal 3 kata —
  //    kalimat panjang terbukti menghasilkan artikel yang tidak nyambung.
  return kataPenting(norm).slice(0, 3).join(' ')
}

/**
 * Apakah pesan ini menyentuh topik kesehatan?
 * Dipakai untuk memutuskan perlu mencari sumber atau tidak.
 */
export function menyentuhKesehatan(teks) {
  const berbatas = ` ${normalkan(teks)} `
  if (berbatas.trim() === '') return false
  return ISTILAH_CARI.some((t) => berbatas.includes(` ${t} `))
}
