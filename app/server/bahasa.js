/**
 * Pendeteksi bahasa pesan pengguna.
 *
 * Tujuan: jawaban AI mengikuti BAHASA YANG DIPAKAI PENGGUNA, bukan hanya
 * mengikuti pilihan bahasa antarmuka di Pengaturan. Kalau pengguna menulis
 * dalam bahasa Inggris sementara antarmukanya berbahasa Indonesia, jawabannya
 * tetap harus bahasa Inggris. Kalau pengguna menulis bahasa Jawa, jawabannya
 * bahasa Jawa.
 *
 * Pendekatannya sengaja sederhana dan bisa diprediksi (bukan panggilan model
 * tambahan): hitung kata-kata penanda tiap bahasa, lalu pilih yang paling
 * kuat. Alasannya sama seperti pendeteksi obrolan di prompts.js — tidak
 * menambah waktu tunggu maupun biaya, dan bisa diuji.
 *
 * KENAPA TIDAK MENDAFTAR SETIAP BAHASA DAERAH
 * Indonesia punya 718 bahasa daerah. Mendaftar semuanya mustahil, dan yang
 * lebih penting: untuk bahasa daerah yang penuturnya sangat sedikit (mis.
 * Nias, Asmat, Biak) model bahasa memang tidak menguasainya dengan aman —
 * pernah terbukti model mengarang kalimat yang bentuknya seperti bahasa
 * daerah tetapi artinya kosong. Karena itu di sini cukup dideteksi
 * "INI BAHASA DAERAH, BUKAN INDONESIA BAKU", lalu biarkan model mengenali
 * bahasanya sendiri dari teks, dengan aturan pengaman di prompts.js yang
 * mewajibkannya jujur kalau tidak mampu.
 *
 * Cara membedakannya: bahasa Indonesia baku memakai kata fungsi yang sangat
 * khas dan selalu muncul (yang, dan, dengan, tidak, itu, ini, adalah...).
 * Bahasa daerah memakai kata fungsi yang berbeda (Jawa: sing, iku, lan, ora;
 * Sunda: anu, jeung, henteu; Bali: sane, muah, tusing). Jadi yang dihitung
 * bukan "bahasa apa ini", melainkan "apakah kalimat ini memakai kata fungsi
 * Indonesia baku atau tidak".
 *
 * Kalau tidak yakin (mis. pesan cuma "ok" atau berisi angka saja), fungsi ini
 * mengembalikan null supaya pemanggil memakai bahasa antarmuka sebagai
 * cadangan.
 */

/** Kata fungsi bahasa Indonesia baku — hampir selalu ada di kalimat Indonesia. */
const ID_FUNGSI = new Set([
  'yang', 'dan', 'dengan', 'untuk', 'dari', 'pada', 'adalah', 'tidak', 'bukan',
  'bisa', 'dapat', 'akan', 'sudah', 'belum', 'saya', 'aku', 'kamu', 'anda',
  'kami', 'kita', 'mereka', 'dia', 'ini', 'itu', 'apa', 'apakah', 'bagaimana',
  'gimana', 'kenapa', 'mengapa', 'berapa', 'kapan', 'dimana', 'siapa', 'juga',
  'saja', 'kalau', 'jika', 'karena', 'supaya', 'agar', 'atau', 'tapi', 'tetapi',
  'sangat', 'lebih', 'paling', 'harus', 'oleh', 'sedang', 'telah', 'boleh',
  'tolong', 'mohon', 'masih', 'pernah', 'semua', 'setiap', 'waktu', 'orang',
  'hari', 'tahun', 'ada', 'ke', 'di', 'se', 'nya', 'lah', 'kah',
])

/** Kata penanda bahasa Indonesia yang lebih longgar (bobot lebih kecil). */
const ID_KHAS2 = [
  'halo', 'hai', 'terima', 'kasih', 'makasih', 'maaf', 'permisi', 'silakan',
  'selamat', 'pagi', 'siang', 'sore', 'malam', 'kabar', 'baik', 'sehat',
  'sakit', 'obat', 'dokter', 'penyakit', 'gejala', 'demam', 'darah', 'gizi',
  'makanan', 'anak', 'bayi', 'hamil', 'imunisasi', 'vaksin', 'rumah', 'pusing',
  'batuk', 'pilek', 'nyeri', 'perut', 'kepala', 'badan', 'tubuh',
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

/**
 * Kata fungsi/penanda bahasa daerah Indonesia.
 *
 * Yang didaftar di sini hanya bahasa daerah yang jumlah penuturnya besar dan
 * modelnya terbukti mampu — selebihnya terdeteksi lewat aturan "tidak memakai
 * kata fungsi Indonesia baku" di bawah.
 *
 * Satu kata bisa muncul di beberapa bahasa daerah (mis. "kita" di Bali =
 * "kita" di Indonesia), jadi yang dihitung hanya kata yang benar-benar khas.
 */
const DAERAH_MARKA = new Set([
  // Jawa
  'sing', 'iku', 'iki', 'ora', 'yen', 'kanggo', 'saka', 'wis', 'durung',
  'akeh', 'dina', 'sawise', 'yaiku', 'disebabake', 'ditularake', 'gigitan',
  'biasane', 'gejalane', 'nggih', 'menika', 'punika', 'saged', 'boten',
  'dereng', 'matur', 'nuwun', 'piye', 'kabare', 'kepriye', 'nganggo', 'ngangge',
  'takon', 'pira', 'pinten', 'lara', 'ngelu', 'dhuwur', 'cokotan', 'waras',
  'muntah', 'ruam', 'perih', 'abot',
  // Sunda
  'anu', 'jeung', 'henteu', 'moal', 'keur', 'tina', 'geus', 'kumaha', 'naon',
  'sabaraha', 'damang', 'abdi', 'kuring', 'ieu', 'eta', 'panyakit',
  'disababkeun', 'ditularkeun', 'sanggeus', 'poé', 'gegel', 'reungit',
  'terangkeun', 'jentrekeun', 'sebutkeun', 'atuh', 'euy', 'teu', 'tiasa',
  // Bali
  'sane', 'muah', 'tusing', 'nenten', 'puniki', 'saking', 'sampun', 'wenten',
  'kenken', 'tiang', 'indik', 'kacatet', 'maosang', 'anake', 'keni', 'ngelah',
  'ketahne', 'tegeh', 'muriang', 'mangkin', 'lantas',
  // Minangkabau
  'indak', 'ado', 'nan', 'bara', 'baa', 'ambo', 'denai', 'inyo', 'manjalehan',
  'damam', 'sakik', 'kapalo', 'manggilo', 'sasudah', 'tasadio', 'jalehkan',
  'babuah', 'karano', 'biasonyo', 'batanyo', 'kaba',
  // Batak (Toba/Karo/Mandailing)
  'songon', 'ahu', 'naeng', 'manungkun', 'taringot', 'sahit', 'ndang', 'dohot',
  'molo', 'dung', 'ito',
  // Bugis / Makassar
  'aga', 'kareba', 'maelo', 'sibawa', 'maraddi', 'pannessa', 'wissengi',
  'sipura', 'engka', 'tenri', 'battala', 'kodong', 'baji',
  // Madura
  'berempa', 'kabarra', 'sengko', 'terro', 'nyakorat', 'engko',
  // Banjar / Palembang / Betawi / Sasak / Aceh
  'kada', 'napa', 'ikam', 'sidin', 'teungoh', 'beutoi', 'laju', 'hantom',
  'nde', 'lalo', 'kance', 'dende', 'nike', 'taok', 'ndak', 'aok',
])

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
  const set = daftar instanceof Set ? daftar : new Set(daftar)
  return kata.reduce((n, k) => (set.has(k) ? n + bobot : n), 0)
}

/**
 * Tebak bahasa sebuah pesan.
 *
 * Urutan pemeriksaan penting:
 *   1. Inggris — kalau menang jelas, sudah pasti bukan bahasa daerah.
 *   2. Bahasa daerah — kalau ada penanda daerah DAN kalimatnya tidak memakai
 *      kata fungsi Indonesia baku. Inilah kuncinya: setiap kalimat Indonesia
 *      yang wajar pasti memuat kata fungsi seperti "yang", "dan", "dengan",
 *      "tidak". Kalimat daerah tidak memakainya, melainkan "sing", "lan",
 *      "ora" (Jawa) atau "anu", "jeung", "henteu" (Sunda). Jadi yang dinilai
 *      bukan "ini bahasa apa", melainkan "apakah ini Indonesia baku".
 *   3. Indonesia sebagai sisanya.
 *
 * @param {string} teks
 * @returns {'id'|'en'|'daerah'|null} null = belum bisa dipastikan
 */
export function deteksiBahasa(teks) {
  const kata = kataDari(teks)
  if (!kata.length) return null

  const idFungsi = hitung(kata, ID_FUNGSI, 1)
  let id = idFungsi * 2 + hitung(kata, ID_KHAS2, 1)
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

  const daerah = hitung(kata, DAERAH_MARKA, 1)

  // 1) Inggris menang jelas
  if (en > id && en >= 2) return 'en'

  // 2) Bahasa daerah: ada penanda daerah, dan kalimatnya TIDAK memakai kata
  //    fungsi Indonesia baku. Batas 2 dipakai supaya kalimat Indonesia yang
  //    kebetulan memuat satu kata mirip tidak salah dibaca.
  if (daerah >= 1 && idFungsi < 2) return 'daerah'

  if (id === 0 && en === 0) return null
  if (id === en) return null
  return id > en ? 'id' : 'en'
}

/** Nama bahasa yang dipakai di dalam prompt. */
export const NAMA_BAHASA = {
  id: 'Bahasa Indonesia',
  en: 'English',
  // sengaja bukan nama bahasa tertentu: model mengenali sendiri bahasanya dari
  // teks pengguna, dan aturan pengaman di prompts.js menjaga keakuratannya
  daerah: 'bahasa daerah Indonesia yang dipakai pengguna (ikuti bahasa pesan pengguna)',
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
 * @returns {{ kode: 'id'|'en'|'daerah', nama: string, dariPesan: boolean }}
 */
export function bahasaJawaban(pesan, bahasaUi = 'id') {
  const dariPesan = deteksiBahasa(pesan)
  const kode = dariPesan ?? (NAMA_BAHASA[bahasaUi] ? bahasaUi : 'id')
  return { kode, nama: NAMA_BAHASA[kode], dariPesan: Boolean(dariPesan) }
}
