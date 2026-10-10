/**
 * Pendeteksi bahasa pesan pengguna.
 *
 * Tujuan: jawaban AI mengikuti BAHASA YANG DIPAKAI PENGGUNA, bukan hanya
 * mengikuti pilihan bahasa antarmuka di Pengaturan. Kalau pengguna menulis
 * dalam bahasa Inggris sementara antarmukanya berbahasa Indonesia, jawabannya
 * tetap harus bahasa Inggris.
 *
 * Pendekatannya sengaja sederhana dan bisa diprediksi (bukan panggilan model
 * tambahan): hitung kata-kata penanda tiap bahasa, lalu pilih yang paling
 * kuat. Alasannya sama seperti pendeteksi obrolan di prompts.js — tidak
 * menambah waktu tunggu maupun biaya, dan bisa diuji.
 *
 * Kalau tidak yakin (mis. pesan cuma "ok" atau berisi angka saja), fungsi ini
 * mengembalikan null supaya pemanggil memakai bahasa antarmuka sebagai
 * cadangan. Promptnya juga tetap memuat aturan umum "jawab dalam bahasa yang
 * sama dengan pesan pengguna", jadi bahasa di luar daftar ini pun tetap
 * tertangani.
 */

/** Kata penanda bahasa Indonesia. Bobot 2 = sangat khas, 1 = umum. */
const ID_KHAS = [
  'yang', 'dan', 'dengan', 'untuk', 'dari', 'pada', 'adalah', 'tidak', 'bukan',
  'bisa', 'dapat', 'akan', 'sudah', 'belum', 'saya', 'aku', 'kamu', 'anda',
  'kami', 'kita', 'mereka', 'dia', 'gimana', 'bagaimana', 'kenapa', 'mengapa',
  'berapa', 'kapan', 'dimana', 'siapa', 'juga', 'saja', 'kalau', 'jika',
  'karena', 'supaya', 'agar', 'atau', 'tapi', 'tetapi', 'sangat', 'lebih',
  'paling', 'harus', 'mau', 'ingin', 'sedang', 'telah', 'oleh', 'itu', 'ini',
  'apa', 'apakah', 'boleh', 'tolong', 'mohon', 'memang', 'masih', 'pernah',
  'sedikit', 'banyak', 'semua', 'setiap', 'waktu', 'orang', 'hari', 'tahun',
]

const ID_KHAS2 = [
  'halo', 'hai', 'terima', 'kasih', 'makasih', 'maaf', 'permisi', 'silakan',
  'selamat', 'pagi', 'siang', 'sore', 'malam', 'kabar', 'baik', 'sehat',
  'sakit', 'obat', 'dokter', 'penyakit', 'gejala', 'demam', 'darah', 'gizi',
  'makanan', 'anak', 'bayi', 'hamil', 'imunisasi', 'vaksin', 'rumah', 'sakit',
  'pusing', 'batuk', 'pilek', 'nyeri', 'perut', 'kepala', 'badan', 'tubuh',
]

/** Kata penanda bahasa Inggris. */
const EN_KHAS = [
  'the', 'is', 'are', 'was', 'were', 'been', 'being', 'have', 'has', 'had',
  'does', 'did', 'will', 'would', 'could', 'should', 'might', 'must', 'you',
  'your', 'yours', 'they', 'them', 'their', 'this', 'that', 'these', 'those',
  'what', 'which', 'who', 'whom', 'whose', 'when', 'where', 'why', 'how',
  'and', 'but', 'because', 'than', 'then', 'of', 'in', 'on', 'at', 'to',
  'for', 'with', 'from', 'by', 'about', 'into', 'like', 'through', 'after',
  'before', 'between', 'under', 'over', 'not', 'can', 'cannot', 'please',
  'my', 'me', 'i', 'we', 'us', 'our', 'he', 'she', 'it', 'its', 'his', 'her',
]

const EN_KHAS2 = [
  'hello', 'hi', 'thanks', 'thank', 'sorry', 'excuse', 'good', 'morning',
  'afternoon', 'evening', 'night', 'health', 'healthy', 'sick', 'pain',
  'medicine', 'drug', 'doctor', 'disease', 'symptom', 'symptoms', 'fever',
  'blood', 'food', 'nutrition', 'child', 'baby', 'pregnant', 'vaccine',
  'hospital', 'headache', 'cough', 'cold', 'stomach', 'body', 'feel',
]

function kataDari(teks) {
  return String(teks ?? '')
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s']/gu, ' ')
    .split(/\s+/)
    .filter(Boolean)
}

/**
 * Frasa Inggris yang utuh. Dipakai untuk ungkapan sehari-hari yang katanya
 * sendiri tidak khas Inggris — mis. "what's up" tidak akan terbaca dari kata
 * "up" saja. Frasa bernilai lebih besar daripada kata tunggal.
 */
const EN_FRASA = [
  /\bhow\s+are\s+you\b/i,
  /\bwhat'?s\s+up\b/i,
  /\bhow'?s\s+it\s+going\b/i,
  /\bnice\s+to\s+(meet|see)\s+you\b/i,
  /\bhow\s+do\s+you\s+do\b/i,
  /\bhave\s+a\s+(nice|good|great)\s+day\b/i,
  /\bsee\s+you\b/i,
  /\bthank\s+you\b/i,
  /\bgood\s+(morning|afternoon|evening|night)\b/i,
]

function hitung(kata, daftar, bobot) {
  const set = new Set(daftar)
  return kata.reduce((n, k) => (set.has(k) ? n + bobot : n), 0)
}

/**
 * Tebak bahasa sebuah pesan.
 *
 * @param {string} teks
 * @returns {'id'|'en'|null} null = belum bisa dipastikan
 */
export function deteksiBahasa(teks) {
  const kata = kataDari(teks)
  if (!kata.length) return null

  let id = hitung(kata, ID_KHAS, 2) + hitung(kata, ID_KHAS2, 1)
  let en = hitung(kata, EN_KHAS, 2) + hitung(kata, EN_KHAS2, 1)

  // imbuhan khas Indonesia (-nya, meN-, -kan, ber-, ter-, peN-) menambah
  // keyakinan walau kata dasarnya tidak ada di daftar
  const imbuhan = kata.filter((k) =>
    /^(me|mem|men|meng|ber|ter|pe|pem|pen|peng|di|ke|se)[a-z]{3,}$/.test(k) ||
    /^[a-z]{3,}(nya|kan|lah|kah|pun)$/.test(k),
  ).length
  id += Math.min(imbuhan, 4)

  // kata Inggris berakhiran khas
  const inggris = kata.filter((k) => /^[a-z]{4,}(ing|tion|ment|ness|ally|ous|ive)$/.test(k)).length
  en += Math.min(inggris, 4)

  // frasa Inggris utuh — nilainya lebih besar karena beberapa kata sekaligus
  if (EN_FRASA.some((re) => re.test(teks))) en += 4

  // huruf yang hampir hanya muncul di bahasa Indonesia
  if (/[éè]/.test(teks)) en += 1

  if (id === 0 && en === 0) return null
  if (id === en) return null
  return id > en ? 'id' : 'en'
}

/** Nama bahasa yang dipakai di dalam prompt. */
export const NAMA_BAHASA = {
  id: 'Bahasa Indonesia',
  en: 'English',
}

/**
 * Tentukan bahasa jawaban.
 *
 * Prioritas: bahasa pesan pengguna. Kalau pesannya belum bisa dipastikan
 * (mis. hanya berisi angka atau satu kata netral), pakai bahasa antarmuka
 * sebagai cadangan.
 *
 * @param {string} pesan - teks yang ditulis pengguna
 * @param {'id'|'en'} bahasaUi - pilihan bahasa antarmuka
 * @returns {{ kode: 'id'|'en', nama: string, dariPesan: boolean }}
 */
export function bahasaJawaban(pesan, bahasaUi = 'id') {
  const dariPesan = deteksiBahasa(pesan)
  const kode = dariPesan ?? (NAMA_BAHASA[bahasaUi] ? bahasaUi : 'id')
  return { kode, nama: NAMA_BAHASA[kode], dariPesan: Boolean(dariPesan) }
}
