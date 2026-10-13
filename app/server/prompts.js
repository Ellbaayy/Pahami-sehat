/**
 * Prompt & rubrik — inti pembeda teknis Pahami Sehat.
 *
 * Riset JMIR: prompt naif menurunkan kelengkapan informasi jadi ~32%;
 * *rubric prompting* (poin kunci wajib dipertahankan lebih dulu, baru
 * disederhanakan) menjaga kelengkapan tetap utuh sambil menaikkan keterbacaan.
 *
 * Semua prompt di sini WAJIB memuat rubrik yang sama supaya perilaku model
 * konsisten dan bisa dipertanggungjawabkan di depan juri.
 */

/** Tingkat baca — patokan UMUR pembaca, bukan kelas sekolah. */
export const TINGKAT = {
  anak: {
    label: 'Anak-anak',
    usia: '9–11 tahun',
    gaya: 'Kalimat pendek (maksimal ~10 kata). Pakai kata sehari-hari dan perumpamaan sederhana. Hindari istilah medis; kalau terpaksa, langsung jelaskan dalam tanda kurung.',
  },
  remaja: {
    label: 'Remaja',
    usia: '12–25 tahun',
    gaya: 'Kalimat sedang. Istilah medis boleh dipakai asal dijelaskan sekali di tempat pertama.',
  },
  dewasa: {
    label: 'Dewasa',
    usia: '26–59 tahun',
    gaya: 'Bahasa informatif seperti artikel kesehatan umum. Istilah medis boleh langsung dipakai.',
  },
  lansia: {
    label: 'Lansia',
    usia: '60 tahun ke atas',
    gaya: 'Kalimat pendek dan jelas, huruf besar-kecil normal, hindari singkatan. Sapa dengan tenang, jangan menggurui. Istilah medis wajib dijelaskan.',
  },
}

export const TINGKAT_DEFAULT = 'anak'

/* ==========================================================================
   MEMBEDAKAN OBROLAN BIASA DARI PERTANYAAN KESEHATAN
   ==========================================================================
   Kalau pengguna cuma menyapa atau mengajak ngobrol, tidak ada gunanya
   mencari sumber dan menampilkan daftar tautan — jawabannya cukup dibalas
   seperti percakapan biasa. Kalau yang ditanya soal kesehatan, sumber tetap
   wajib.

   Pendeteksinya sengaja dibuat aturan sederhana (bukan panggilan model
   tambahan) supaya:
     - tidak menambah waktu tunggu dan biaya,
     - hasilnya bisa diprediksi dan diuji,
     - bisa dijelaskan apa adanya ke juri.

   Cara kerjanya: menolak dulu, baru menerima.
     1. Kalau ada SATU SAJA kata kesehatan -> langsung dianggap pertanyaan
        kesehatan (sumber tetap ditampilkan).
     2. Kalau tidak ada kata kesehatan, baru dilihat: apakah isinya murni
        sapaan/obrolan ringan? Kalau ya -> mode santai.
     3. Kalau ragu -> dianggap pertanyaan kesehatan (lebih aman tetap
        menampilkan sumber daripada sumbernya hilang).
   ========================================================================== */

/** Kata yang menandakan pesan menyentuh topik kesehatan. */
export const KATA_KESEHATAN = [
  // keluhan & gejala
  'sakit', 'nyeri', 'demam', 'panas', 'pusing', 'mual', 'muntah', 'batuk', 'pilek',
  'flu', 'sesak', 'lemas', 'letih', 'lelah', 'gatal', 'bengkak', 'luka', 'patah',
  'diare', 'sembelit', 'alergi', 'ruam', 'bintik', 'kram', 'pegal', 'insomnia',
  'sulit tidur', 'tidak nafsu makan', 'nafsu makan', 'tersedak', 'dehidrasi',
  // penyakit & kondisi
  'penyakit', 'dbd', 'dengue', 'demam berdarah', 'malaria', 'tbc', 'tuberkulosis',
  'diabetes', 'kencing manis', 'hipertensi', 'darah tinggi', 'darah rendah',
  'kolesterol', 'jantung', 'stroke', 'strok', 'kanker', 'tumor', 'asma', 'pneumonia',
  'anemia', 'tifus', 'tipes', 'hepatitis', 'ginjal', 'lambung', 'maag', 'gerd',
  'covid', 'cacar', 'campak', 'polio', 'hiv', 'aids', 'kusta', 'rabies',
  'gangguan jiwa', 'depresi', 'stres', 'cemas', 'anxiety',
  'obesitas', 'demensia', 'alzheimer', 'infeksi', 'komplikasi',
  // 'hati' TIDAK didaftarkan sendiri: dalam bahasa Indonesia sehari-hari ia
  // hampir selalu muncul sebagai "hati-hati" (bukan organ hati). Diukur 13 Okt
  // 2026: mendaftarkan 'hati' membuat "hati-hati ya di jalan" dianggap topik
  // kesehatan dan mematikan deteksi obrolan biasa. Kata yang benar-benar
  // menunjuk organnya dipakai langsung: 'liver' dan 'penyakit hati'.
  'liver', 'penyakit hati',
  'serangan jantung', 'gagal ginjal', 'kanker paru', 'kanker paru-paru',
  // obat & pengobatan
  'obat', 'dosis', 'resep', 'tablet', 'kapsul', 'sirup', 'salep', 'injeksi',
  'vaksin', 'imunisasi', 'antibiotik', 'paracetamol', 'ibuprofen', 'amoxicillin',
  'vitamin', 'suplemen', 'multivitamin', 'herbal', 'jamu', 'kemoterapi',
  'efek samping', 'kontraindikasi', 'kandungan',
  // tubuh & pemeriksaan
  'darah', 'tensi', 'tekanan darah', 'gula darah', 'kadar gula', 'berat badan',
  'bmi', 'kadar', 'lab', 'laboratorium', 'rontgen', 'usg', 'ekg', 'mri',
  'pemeriksaan', 'diagnosis', 'gejala', 'tanda', 'penyebab', 'pencegahan',
  'pengobatan', 'terapi', 'operasi', 'rumah sakit', 'puskesmas', 'klinik',
  'dokter', 'perawat', 'apotek', 'bpjs', 'rujukan',
  'faktor risiko', 'pertolongan pertama', 'pasca operasi', 'perawatan luka',
  'perawatan di rumah', 'luka bakar', 'fisioterapi', 'rehabilitasi',
  // gizi & gaya hidup sehat
  'gizi', 'nutrisi', 'kalori', 'protein', 'karbohidrat', 'lemak', 'serat',
  'kalsium', 'zat besi', 'asam folat', 'menu sehat', 'makanan sehat', 'diet',
  'olahraga', 'senam', 'yoga', 'tidur', 'istirahat', 'rokok', 'merokok',
  'alkohol', 'narkoba', 'kebersihan', 'sanitasi', 'cuci tangan',
  // kehamilan & anak
  'hamil', 'kehamilan', 'kandungan', 'melahirkan', 'menyusui', 'asi', 'bayi',
  'balita', 'imunisasi dasar', 'tumbuh kembang', 'kb', 'haid', 'menstruasi',
  'kesehatan reproduksi', 'kesehatan mental', 'kesehatan',
]

/** Kata/frasa sapaan dan obrolan ringan. */
const POLA_SAPA = [
  // salam
  /^(halo|hallo|helo|hello|hai|hei|hi|yo|woi|assalamualaikum|assalamu|salam|permisi|pagi|siang|sore|malam|selamat\s*(pagi|siang|sore|malam|datang|malam))[\s!.,?]*$/i,
  /^selamat\s+(pagi|siang|sore|malam|datang|beraktivitas|istirahat)/i,
  // menanyakan kabar — TIDAK diikat ke awal kalimat, karena "halo, apa kabar?"
  // juga harus terbaca sebagai obrolan, bukan pertanyaan kesehatan
  /\b(apa\s+kabar|gimana\s+kabar|bagaimana\s+kabar|kabarnya|gmn\s+kbr|kbr)\b/i,
  /\bkamu\s+(baik|sehat|oke|ok|gimana|gmn)\b/i,
  // terima kasih
  /^(makasih|terima\s*kasih|thanks|thank\s*you|thx|tq|tks|syukron)\b/i,
  // salam perpisahan
  /^(dadah|dah|bye|byebye|sampai\s*jumpa|selamat\s*tinggal|pamit|see\s*you)\b/i,
  // salam & basa-basi bahasa Inggris — sebelumnya belum ada, sehingga
  // "hello, how are you?" ikut dianggap pertanyaan yang perlu dicari sumbernya
  /\bhow\s+are\s+you\b/i,
  /\bhow\s+(is|are)\s+(it|things|you\s+doing|everything)\b/i,
  /\bhow'?s\s+it\s+going\b/i,
  /\bwhat'?s\s+up\b/i,
  /\bnice\s+to\s+(meet|see)\s+you\b/i,
  /\bhow\s+do\s+you\s+do\b/i,
  /^good\s+(morning|afternoon|evening|night)\b/i,
  /\b(hi|hello|hey)\s+there\b/i,
  /\bhave\s+a\s+(nice|good|great)\s+day\b/i,
  // basa-basi
  /^(lagi\s+apa|sedang\s+apa|ngapain|lagi\s+ngapain|apa\s+kegiatanmu)\b/i,
  /^(selamat\s+kerja|semangat|semangat\s+ya|good\s*luck|sukses)\b/i,
  // Ungkapan perhatian & doa — sering diucapkan, tidak meminta informasi apa pun.
  //
  // KENAPA PERLU (diukur 13 Okt 2026): "hati-hati ya di jalan" tidak cocok pola
  // mana pun, tidak punya kata tanya, dan panjangnya 5 kata — jadi ia jatuh ke
  // langkah terakhir `deteksiSantai()` yang berbunyi "ragu -> anggap pertanyaan
  // kesehatan". Akibatnya kalimat itu IKUT DICARI ke Wikipedia dan mendapat
  // artikel "Hati" (organ), lalu model terpaksa menjawab dengan sumber yang
  // sama sekali tidak nyambung dengan maksud pengucapnya.
  //
  // Ditaruh SEBELUM langkah "menyentuh kesehatan", jadi ia tetap aman: kalau
  // kalimatnya benar-benar membawa topik kesehatan (mis. "hati-hati, gejala
  // penyakit hati itu apa?"), `!menyentuhKesehatan()` mengembalikan false dan
  // pesannya tetap dijawab dengan sumber.
  /^(hati|ati)\s*-?\s*hati\b/i,
  /^(semoga|mudah\s*-?\s*mudahan)\b/i,
  /^(jangan\s+lupa)\b/i,
  /^(take\s+care|get\s+well|stay\s+safe|be\s+safe)\b/i,
  // menyapa identitas bot
  /(siapa\s+(kamu|kalian|anda)|kamu\s+(siapa|itu\s+siapa)|nama\s+kamu|namamu|kamu\s+bot|kamu\s+ai|kamu\s+robot)/i,
  /(kamu\s+bisa\s+apa|bisa\s+apa\s+aja|apa\s+saja\s+yang\s+bisa|fitur\s+apa|bisa\s+membantu\s+apa)/i,
  /^(kamu|kalian|anda)\s+(manusia|orang)\b/i,
  // pujian & candaan ringan
  /^(keren|bagus|hebat|mantap|wow|nice|oke|ok|sip|baik|baiklah|iya|ya|yoi|betul|benar)\b[\s!.,?]*$/i,
  /^(wkwk|haha|hehe|hihi|xixi|kwkw)+[\s!.,?]*$/i,
]

/** Buang tanda baca berlebih & rapikan spasi. */
function rapikan(teks) {
  return String(teks ?? '')
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s]/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

/**
 * Cek kata kesehatan sebagai KATA UTUH, bukan potongan huruf.
 *
 * Ini penting: pencocokan potongan huruf pernah membuat "makasih" dianggap
 * topik kesehatan karena memuat "asi" (air susu ibu). Hal yang sama bisa
 * terjadi pada "flu" di "influencer" atau "lab" di kata lain.
 */
const POLA_KESEHATAN = KATA_KESEHATAN.map(
  (k) => new RegExp(`(^|\\s)${k.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}(\\s|$)`, 'i'),
)

/**
 * Tambahkan kosakata pengenalan topik SETELAH modul ini dimuat.
 *
 * KENAPA PERLU: daftar `KATA_KESEHATAN` di atas hanya berisi kata umum, tetapi
 * `kataKunci.js` punya kamus yang jauh lebih luas — kunci PETA_PENCARIAN,
 * PETA_MEDLINEPLUS, dan PETA_SINGKATAN (istilah spesifik seperti 'katarak',
 * 'sinusitis', 'skizofrenia'). Dulu keduanya TERPISAH, dan akibatnya buruk
 * dua arah:
 *
 *   - "Apa itu katarak?" tidak dikenali sebagai topik kesehatan sama sekali;
 *   - dan kalau kata barunya hanya ditambahkan ke satu sisi, `deteksiSantai()`
 *     bisa menganggap pesan kesehatan sebagai obrolan biasa — sehingga
 *     pertanyaannya dijawab TANPA sumber sama sekali, tanpa galat apa pun.
 *
 * Dipanggil SEKALI dari kataKunci.js, setelah kamusnya lengkap. Ini sengaja
 * satu arah (kataKunci.js -> prompts.js) supaya tidak ada impor melingkar.
 *
 * @param {string[]} daftar - istilah tambahan
 */
export function tambahKataKesehatan(daftar) {
  const ada = new Set(KATA_KESEHATAN)
  for (const k of daftar) {
    const kata = String(k ?? '').trim().toLowerCase()
    if (!kata || ada.has(kata)) continue
    ada.add(kata)
    KATA_KESEHATAN.push(kata)
    POLA_KESEHATAN.push(
      new RegExp(`(^|\\s)${kata.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}(\\s|$)`, 'i'),
    )
  }
}

function menyentuhKesehatan(bersih) {
  return POLA_KESEHATAN.some((re) => re.test(bersih))
}

/**
 * Apakah pesan ini sekadar sapaan/obrolan, bukan mencari tahu sesuatu?
 *
 * @param {string} teks
 * @returns {boolean} true = mode santai (tanpa pencarian, tanpa sumber)
 */
export function deteksiSantai(teks) {
  const asli = String(teks ?? '').trim()
  if (!asli) return false

  const bersih = rapikan(asli)

  // 1) cocok dengan pola sapaan/obrolan? Ini diperiksa LEBIH DULU, supaya
  //    "kamu siapa?" atau "apa kabar?" tidak tertahan oleh kata "siapa"/"apa"
  //    pada pemeriksaan kata tanya di langkah berikutnya.
  if (POLA_SAPA.some((re) => re.test(asli.trim()) || re.test(bersih))) {
    // kecuali kalau jelas membawa topik kesehatan, mis. "kamu dokter ya?"
    return !menyentuhKesehatan(bersih)
  }

  // 2) menyentuh kesehatan? -> pasti bukan obrolan biasa
  if (menyentuhKesehatan(bersih)) return false

  // 3) menanyakan sesuatu (kata tanya)? -> tujuannya mencari tahu, jadi
  //    biarkan dijawab beserta sumbernya
  const polaTanya = /\b(apa|apakah|berapa|bagaimana|gimana|mengapa|kenapa|kapan|dimana|siapa|mana|bisakah|bolehkah|haruskah)\b/i
  if (polaTanya.test(bersih)) return false

  // 4) pesan sangat pendek tanpa kata tanya -> kemungkinan besar obrolan
  const jumlahKata = bersih.split(/\s+/).filter(Boolean).length
  if (jumlahKata <= 3) return true

  // 5) ragu -> anggap pertanyaan kesehatan (lebih aman tetap pakai sumber)
  return false
}


/* ==========================================================================
   OBROLAN BIASA (mode santai)
   ==========================================================================
   Dipakai saat pesan pengguna hanya sapaan atau obrolan ringan. Di mode ini
   TIDAK ada pencarian internet dan TIDAK ada daftar sumber — karena tidak ada
   yang perlu diverifikasi. Tetap ramah, tetap singkat, dan tetap tidak
   memberi diagnosis.
   ========================================================================== */

export function promptSantai({ pertanyaan, bahasa = 'Bahasa Indonesia', kodeAsal = null }) {
  return {
    system: `Kamu adalah asisten kesehatan ramah di aplikasi "Pahami Sehat".

Pengguna sedang menyapa atau mengajak ngobrol ringan — BUKAN bertanya soal
kesehatan. Jadi balaslah seperti teman yang ramah.

ATURAN:
1. Balas singkat dan hangat (1-3 kalimat). Jangan bertele-tele.
2. JANGAN memberi daftar sumber, tautan, atau rujukan — tidak ada yang perlu
   diverifikasi di percakapan seperti ini.
3. JANGAN mengarang data kesehatan, angka, atau penelitian.
4. Perkenalkan diri seperlunya: kamu bisa membantu memahami istilah kesehatan,
   menyederhanakan teks medis, dan memeriksa kebenaran klaim kesehatan.
5. Kalau pengguna tampak ingin bertanya soal kesehatan, arahkan dengan santai
   supaya menuliskannya — jangan menebak-nebak keluhannya.
6. Kamu bukan dokter. Jangan memberi diagnosis, resep, atau dosis.
7. Jangan pakai emoji berlebihan. Satu saja cukup bila perlu.

${blokBahasa(bahasa, kodeAsal)}

FORMAT KELUARAN — balas HANYA JSON valid, tanpa teks pembuka, tanpa pagar kode:
{
  "jawaban": "<balasan ramah dan singkat>",
  "poin_kunci": [],
  "sumber": [],
  "catatan": ""
}`,
    user: `PESAN PENGGUNA:\n${pertanyaan}`,
  }
}

/** Rubrik wajib — dipakai di setiap panggilan model. */
export const RUBRIK = `
RUBRIK WAJIB (penuhi semuanya, dalam urutan ini):
1. KELENGKAPAN — Pertahankan SEMUA poin kunci dari sumber. Jangan membuang
   peringatan, angka dosis, rentang normal, atau tanda bahaya. Menyederhanakan
   bahasa TIDAK boleh menghilangkan informasi.
2. AKURASI — Jangan menambah fakta yang tidak ada di sumber. Jangan menebak
   angka. Kalau sumber tidak memuat sesuatu, katakan tidak ada.
3. KETERBACAAN — Sesuaikan gaya bahasa dengan tingkat pembaca yang diminta.
4. SITASI — Setiap klaim penting harus bisa ditelusuri. Sebutkan penerbit
   dokumen resmi yang kamu yakini benar-benar ada (mis. Kemenkes RI, WHO, BPOM).
   JANGAN mengarang judul, nomor, tahun, atau tautan. Kalau tidak yakin, isi
   daftar sumber dengan array kosong dan sebutkan bahwa sumber belum bisa
   dipastikan.
5. BATAS PERAN — Kamu bukan dokter. Jangan memberi diagnosis, resep, atau dosis
   obat tertentu. Selalu arahkan ke tenaga kesehatan untuk keluhan pribadi.
6. FAKTOR RISIKO, BUKAN DIAGNOSIS — Kalau pengguna bertanya apakah DIRINYA
   mengidap suatu penyakit, atau seberapa besar risikonya, jawab dengan cara ini:
   a. Sebutkan faktor risiko yang benar-benar ada di sumber, sebagai FAKTA UMUM
      tentang penyakitnya — bukan penilaian atas diri pengguna.
   b. Sebutkan tanda/gejala yang membuat orang perlu memeriksakan diri.
   c. Katakan terus terang bahwa kepastian hanya bisa didapat dari pemeriksaan
      tenaga kesehatan, karena banyak penyakit tidak punya gejala khas.
   JANGAN menyimpulkan bahwa pengguna kemungkinan besar mengidap atau tidak
   mengidap sesuatu. JANGAN memberi persentase atau peluang yang tidak ada di
   sumber. JANGAN menyusun daftar kemungkinan penyakit yang bersaing — itu
   diagnosis, dan itu bukan tugasmu.
7. PENANGANAN & PERAWATAN — Untuk pertanyaan cara menangani atau merawat,
   utamakan langkah yang ada di sumber. Bedakan dengan jelas mana yang bisa
   dilakukan sendiri di rumah dan mana yang WAJIB lewat tenaga kesehatan.
   Selalu sebutkan tanda bahaya yang mengharuskan segera mencari bantuan medis.
`.trim()

const KELUARAN_JSON = `
FORMAT KELUARAN — balas HANYA JSON valid, tanpa teks pembuka, tanpa pagar kode:
{
  "jawaban": "<jawaban utama, sudah disesuaikan tingkat baca>",
  "poin_kunci": ["<poin kunci yang dipertahankan>", "..."],
  "sumber": [{ "judul": "<judul dokumen>", "penerbit": "<Kemenkes RI|WHO|BPOM|...>" }],
  "catatan": "<catatan singkat; mis. bagian yang tidak ada di sumber, atau string kosong>"
}
`.trim()

function blokTingkat(tingkat) {
  const t = TINGKAT[tingkat] ?? TINGKAT[TINGKAT_DEFAULT]
  return `TINGKAT PEMBACA: ${t.label} (perkiraan umur pembaca ${t.usia}).
GAYA: ${t.gaya}`
}

/**
 * Aturan bahasa.
 *
 * Ada DUA hal yang diatur di sini, dan urutannya penting:
 *   1. Bahasa jawaban wajib mengikuti bahasa yang dipakai pengguna. Ini
 *      aturan utama — kalau pengguna menulis bahasa Inggris, jawabannya
 *      bahasa Inggris, walau bahasa antarmuka sedang Indonesia. Termasuk
 *      bahasa daerah: kalau pengguna menulis bahasa Jawa, jawablah bahasa Jawa.
 *   2. Bahasa antarmuka dipakai sebagai cadangan saja, kalau pesan pengguna
 *      terlalu pendek/netral untuk bisa dipastikan bahasanya.
 *
 * Poin 1 ditulis di dalam system prompt supaya tetap berlaku untuk bahasa
 * apa pun — termasuk bahasa daerah yang tidak mungkin didaftar satu per satu
 * (Indonesia punya 718 bahasa daerah).
 *
 * PENGAMAN BAHASA DAERAH — ini penting dan bukan sekadar pelengkap:
 * uji coba menunjukkan model ini lancar memakai bahasa daerah yang besar
 * (Jawa, Sunda, Bali, Minangkabau, Batak, Bugis, Makassar, dsb), tetapi
 * untuk bahasa daerah yang sangat kecil penuturnya (mis. Nias, Asmat, Biak)
 * model bisa MENGOBRAK-ABRIK kata yang terlihat seperti bahasa daerah tapi
 * artinya kosong — dan itu berbahaya untuk informasi kesehatan.
 * Karena itu ada tiga aturan pengaman di bawah.
 */
function blokBahasa(bahasa, kodeAsal = null) {
  const dariPesan = kodeAsal === 'pesan'
  return `BAHASA JAWABAN — ATURAN UTAMA:
Jawablah dalam BAHASA YANG SAMA dengan pesan pengguna. Kalau pengguna menulis
dalam bahasa Inggris, jawablah dalam bahasa Inggris. Kalau pengguna menulis
dalam bahasa Indonesia, jawab dalam bahasa Indonesia. Kalau pengguna menulis
dalam bahasa daerah Indonesia (mis. Jawa, Sunda, Bali, Minangkabau, Bugis,
Batak, Madura), jawablah dalam bahasa daerah itu. Aturan ini berlaku untuk
semua bagian jawaban: "jawaban", "poin_kunci", "catatan", dan "sumber".
Jangan mencampur dua bahasa dalam satu jawaban.

${
  dariPesan
    ? `Bahasa pesan pengguna terdeteksi: ${bahasa}. Pakailah bahasa itu.`
    : `Kalau bahasa pesan pengguna tidak bisa dipastikan (mis. hanya angka atau
satu kata netral), pakailah ${bahasa}.`
}
Istilah teknis atau nama lembaga boleh tetap dalam bentuk aslinya
(mis. "Kemenkes RI", "WHO", nama obat).

PENGAMAN BILA MENJAWAB DALAM BAHASA DAERAH:
1. JAWABLAH DALAM BAHASA DAERAH ITU. Jangan menolak, dan jangan menulis
   kalimat pembuka seperti "aku tidak bisa menjawab dalam bahasa daerah ini"
   lalu tetap menjawab dalam bahasa daerah — itu bertentangan sendiri dan
   membingungkan pengguna. Untuk bahasa daerah yang kamu kuasai (mis. Jawa,
   Sunda, Bali, Minangkabau, Batak, Bugis, Makassar, Madura, Banjar, Sasak),
   langsung jawab dalam bahasa itu tanpa basa-basi.
2. BILA BENAR-BENAR TIDAK MAMPU, AKUI SEKALI SAJA. Hanya untuk bahasa daerah
   yang penuturnya sangat sedikit dan kamu memang tidak menguasainya, jangan
   mengarang kalimat yang bentuknya seperti bahasa daerah tetapi artinya
   kosong — itu berbahaya untuk informasi kesehatan. Dalam keadaan itu,
   jawablah dalam bahasa Indonesia, dan tuliskan alasannya SEKALI di bagian
   "catatan" dengan kalimat sederhana, tanpa mengulang-ulang permintaan maaf.
3. ANGKA WAJIB UTUH. Semua angka, satuan, rentang normal, dan dosis harus
   tetap benar dan tidak boleh berubah arti. Tulis angkanya apa adanya
   (mis. "120/80 mmHg"), jangan diterjemahkan ke kata-kata.
4. ISTILAH MEDIS BOLEH TETAP. Nama penyakit, obat, dan istilah medis boleh
   tetap dalam bahasa Indonesia atau Inggris, karena menerjemahkannya justru
   berisiko salah. Yang diterjemahkan adalah kalimat penjelasnya.
5. HANYA TERJEMAHKAN YANG ADA DI SUMBER. Jangan menambah angka, gejala, atau
   klaim yang tidak ada di sumber yang diberikan, dalam bahasa apa pun.`
}

const BATAS_PANJANG = 'Jawaban maksimal 220 kata. Ringkas, tidak bertele-tele.'

/** Pertanyaan bebas dari user (fitur "Tanya AI"). */
export function promptTanya({ pertanyaan, tingkat, bahasa = 'Bahasa Indonesia', kodeAsal = null }) {
  return {
    system: `Kamu adalah mesin penyederhana informasi kesehatan untuk aplikasi "Pahami Sehat".

TUGAS: jawab pertanyaan kesehatan pengguna, lalu sajikan jawabannya pada tingkat
baca yang diminta — TANPA mengurangi kelengkapan informasi.

${RUBRIK}

${blokTingkat(tingkat)}

${blokBahasa(bahasa, kodeAsal)}
${BATAS_PANJANG}

${KELUARAN_JSON}`,
    user: `PERTANYAAN PENGGUNA:\n${pertanyaan}`,
  }
}

/** Terjemahkan teks medis mentah (hasil lab, label obat, artikel, broadcast WA). */
export function promptSederhanakan({ teks, tingkat, bahasa = 'Bahasa Indonesia', kodeAsal = null }) {
  return {
    system: `Kamu adalah penerjemah bahasa medis untuk aplikasi "Pahami Sehat".

TUGAS: terima teks medis mentah, lalu tulis ulang pada tingkat baca yang diminta.

PROSES (ikuti urutannya):
Langkah 1 — Tandai dulu semua poin kunci: angka, satuan, rentang normal, dosis,
  peringatan, dan tanda bahaya. Jangan ada yang hilang.
Langkah 2 — Baru sederhanakan bahasanya. Kalau ada istilah medis, jelaskan
  artinya di tempat pertama kali muncul.

${RUBRIK}

${blokTingkat(tingkat)}

${blokBahasa(bahasa, kodeAsal)}
${BATAS_PANJANG}

${KELUARAN_JSON}`,
    user: `TEKS MEDIS MENTAH:\n${teks}`,
  }
}

/** Verifikasi klaim kesehatan (mis. broadcast WhatsApp). */
export function promptVerifikasi({ klaim, tingkat, bahasa = 'Bahasa Indonesia', kodeAsal = null }) {
  return {
    system: `Kamu adalah pemeriksa klaim kesehatan untuk aplikasi "Pahami Sehat".

TUGAS: nilai apakah klaim berikut didukung dokumen resmi.

ATURAN PENTING:
- Kalau kamu tidak menemukan dasar yang kuat, jawab dengan jujur bahwa klaim itu
  TIDAK bisa dipastikan. Jangan memaksakan verdict.
- Jangan mengarang dokumen, nomor, atau tautan untuk memperkuat jawaban.
- Bedakan "salah" dari "belum bisa dipastikan" — keduanya berbeda.

${RUBRIK}

${blokTingkat(tingkat)}

${blokBahasa(bahasa, kodeAsal)}
${BATAS_PANJANG}

FORMAT KELUARAN — balas HANYA JSON valid, tanpa teks pembuka, tanpa pagar kode:
{
  "verdict": "<didukung|tidak_didukung|tidak_bisa_dipastikan>",
  "jawaban": "<penjelasan pada tingkat baca yang diminta>",
  "poin_kunci": ["<alasan singkat>", "..."],
  "sumber": [{ "judul": "<judul dokumen>", "penerbit": "<Kemenkes RI|WHO|BPOM|...>" }],
  "catatan": "<catatan; mis. bagian yang belum bisa dipastikan>"
}`,
    user: `KLAIM YANG DIPERIKSA:\n${klaim}`,
  }
}

/* ==========================================================================
   PENCARIAN INTERNET
   ==========================================================================
   Setiap pertanyaan dicari dulu di internet, lalu hasilnya disuntikkan ke
   prompt. Model tetap dilarang mengarang: kalau hasil pencarian tidak memuat
   jawabannya, model wajib mengatakannya.
   ========================================================================== */

/** Aturan yang berlaku setiap kali model menerima hasil pencarian. */
const ATURAN_PENCARIAN = `
HASIL PENCARIAN INTERNET (sumber nyata, bukan karangan):
{konteks}

CARA MEMAKAI HASIL PENCARIAN:
1. Jawab HANYA berdasarkan hasil pencarian di atas. Jangan menambah fakta dari ingatanmu.
2. Cantumkan URL sumber untuk setiap klaim penting. Ambil URL persis dari daftar di atas.
3. Utamakan sumber bertanda [SUMBER RESMI] (Kemenkes, WHO, BPOM) bila ada.
4. Kalau hasil pencarian TIDAK memuat jawabannya, katakan terus terang bahwa
   informasi itu belum ditemukan — jangan menebak, jangan mengarang.
5. Kalau angka berbeda antar sumber, sebutkan perbedaannya dan sebutkan sumbernya.
6. Jangan mengarang URL. Hanya pakai URL yang benar-benar ada di daftar.
7. PERIKSA SELURUH BAHAN SEBELUM MENYATAKAN TIDAK ADA. Dokumen resmi sering
   memuat bagian "faktor risiko", "pengobatan", "penanganan", atau "perawatan"
   di TENGAH dokumen, bukan di kalimat pertama. Baca sampai habis dulu. Jangan
   menyimpulkan "sumber tidak memuat informasinya" hanya karena paragraf
   pembukanya tidak membahas yang ditanyakan.
8. Kalau yang ditanyakan hanya SEBAGIAN tersedia (mis. faktor risikonya ada tapi
   angkanya tidak), jawab bagian yang ADA dan sebutkan bagian mana yang tidak
   ada. Jangan membuang seluruh jawaban hanya karena satu bagian tidak lengkap.
`.trim()

function blokPencarian(konteks) {
  return ATURAN_PENCARIAN.replace('{konteks}', konteks || '(tidak ada hasil)')
}

/** Format hasil pencarian menjadi daftar bernomor + URL. */
function rapikanHasil(hasil = []) {
  return hasil
    .filter((h) => h && (h.judul || h.isi || h.ringkas))
    .map((h, i) => {
      const tanda = h.resmi ? ' [SUMBER RESMI]' : ''
      const isi = h.ringkas ? `Ringkasan: ${h.ringkas}` : h.isi ? `Isi: ${h.isi}` : ''
      return `${i + 1}. ${h.judul || '(tanpa judul)'}${tanda}\n   URL: ${h.url}\n   ${isi}`.trim()
    })
    .join('\n\n')
}

/** Pertanyaan bebas + hasil pencarian. */
export function promptTanyaDenganCari({ pertanyaan, tingkat, hasilCari = [], bahasa = 'Bahasa Indonesia', kodeAsal = null }) {
  const dasar = promptTanya({ pertanyaan, tingkat, bahasa, kodeAsal })
  return {
    system: `${dasar.system}

${blokPencarian(rapikanHasil(hasilCari))}

KELUARAN TAMBAHAN — selain field yang sudah diminta, sertakan field "sumber"
berisi objek {judul, penerbit, url} dari hasil pencarian di atas. Field "url"
harus URL persis dari daftar.`,
    user: dasar.user,
  }
}

/** Verifikasi klaim + hasil pencarian. */
export function promptVerifikasiDenganCari({ klaim, tingkat, hasilCari = [], bahasa = 'Bahasa Indonesia', kodeAsal = null }) {
  const dasar = promptVerifikasi({ klaim, tingkat, bahasa, kodeAsal })
  return {
    system: `${dasar.system}

${blokPencarian(rapikanHasil(hasilCari))}

KELUARAN TAMBAHAN — sertakan field "sumber" berisi objek {judul, penerbit, url}
dari hasil pencarian di atas. Verdict harus didasarkan pada hasil pencarian itu.`,
    user: dasar.user,
  }
}

/** Sederhanakan teks + (opsional) hasil pencarian untuk melengkapi istilah. */
export function promptSederhanakanDenganCari({ teks, tingkat, hasilCari = [], bahasa = 'Bahasa Indonesia', kodeAsal = null }) {
  const dasar = promptSederhanakan({ teks, tingkat, bahasa, kodeAsal })
  return {
    system: `${dasar.system}

${blokPencarian(rapikanHasil(hasilCari))}

CATATAN: teks yang disederhanakan tetap yang dari pengguna. Hasil pencarian hanya
untuk memastikan istilah dan angkanya benar. Sertakan field "sumber" berisi objek
{judul, penerbit, url} dari hasil pencarian bila dipakai.`,
    user: dasar.user,
  }
}
