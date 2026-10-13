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

  /* --- Pemeriksaan penunjang: nama alat & nama pemeriksaan -----------------
   * Daftar ini sebelumnya berhenti di istilah gejala, sehingga pertanyaan
   * tentang ALAT PEMERIKSAAN tidak dikenali sebagai topik kesehatan sama
   * sekali. Akibatnya "Apa yang perlu saya ketahui tentang pemeriksaan
   * penunjang?" hanya menghasilkan kata kunci "pemeriksaan" (kata yang paling
   * umum), dan Wikipedia menjawabnya dengan Badan Pemeriksa Keuangan.
   *
   * Diukur pada 20 pertanyaan kesehatan: 9 di antaranya mendapat 0 sumber,
   * dan hampir semuanya adalah alat pemeriksaan (rontgen, USG, MRI, EKG,
   * laboratorium, PCR, rapid test).
   *
   * Frasa terpanjang yang menang, jadi 'rontgen dada' tidak pernah jatuh
   * menjadi 'rontgen', dan 'pemeriksaan penunjang' tidak jatuh menjadi
   * 'pemeriksaan'.
   */
  'pemeriksaan penunjang',
  'pemeriksaan laboratorium',
  'pemeriksaan fisik',
  'pertolongan pertama',
  'perawatan di rumah',
  'perawatan luka',
  'pasca operasi',
  'faktor risiko',
  'luka bakar',
  'serangan jantung',
  'gagal ginjal',
  'gagal jantung',
  'batu ginjal',
  'sirosis',
  'kanker paru',
  'rontgen dada',
  'rontgen thorax',
  'usg transvaginal',
  'ct scan',
  'cat scan',
  'pap smear',
  'tes darah',
  'tes urine',
  'tes urin',
  'tes pcr',
  'rapid test',
  'radiologi',
  'penunjang',
  'rontgen',
  'usg',
  'mri',
  'ekg',
  'laboratorium',
  'endoskopi',
  'biopsi',
  'spirometri',
  'ultrasonografi',
  'elektrokardiogram',
  'kemoterapi',
  'fisioterapi',
  'rehabilitasi',
  'demensia',
  'alzheimer',
  'obesitas',
  'tersedak',
  'dehidrasi',
  'capek',
  'pcr',
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
 * Kata TINDAKAN — bukan topik, tapi pertanyaan tentang topik.
 *
 * KENAPA INI ADA (diukur, bukan dugaan):
 * `kataKunciPencarian()` memilih istilah kesehatan TERPANJANG yang muncul di
 * pesan. Aturan itu benar untuk gejala ("demam berdarah" menang atas "demam"),
 * tapi SALAH untuk kata tindakan — karena kata tindakan justru lebih panjang
 * daripada nama penyakitnya:
 *
 *   "Apa penyebab anemia?"                        -> "penyebab" (bukan "anemia")
 *   "Bagaimana cara merawat luka pasca operasi?"  -> "operasi"  (bukan "luka")
 *   "Apa risiko saya terkena stroke?"             -> "stroke"   (kebetulan benar)
 *
 * Lalu penyaring relevansi menuntut kata kunci itu ada di JUDUL artikel.
 * Wikipedia tidak punya artikel berjudul "Penyebab" atau "Operasi", jadi hasilnya
 * 0 sumber — diukur di produksi: 4 dari 16 pertanyaan kesehatan mendapat 0 sumber,
 * dan semuanya pola ini.
 *
 * Kata di sini TETAP dikenali sebagai topik kesehatan (masih ada di
 * KATA_KESEHATAN), tapi TIDAK PERNAH dipilih sebagai bahan pencarian selama ada
 * kata lain yang lebih khusus di pesan yang sama.
 *
 * 'operasi' sengaja ikut daftar ini: sebagai bahan pencarian ia berbahaya —
 * pencarian Wikipedia untuk "operasi" memunculkan "Android (sistem operasi)".
 */
const KATA_TINDAKAN = new Set([
  'penyebab', 'pengobatan', 'pencegahan', 'gejala', 'tanda', 'diagnosis',
  'komplikasi', 'terapi', 'perawatan', 'operasi', 'pemeriksaan', 'kadar',
  'dosis', 'resep', 'tensi', 'lab', 'pengidapan', 'risiko',
])

/**
 * Kata GEJALA — tanda yang bisa menempel pada banyak penyakit.
 *
 * KENAPA PERLU (diukur, bukan dugaan):
 * `ISTILAH_CARI` terurut dari yang TERPANJANG, dan aturan itu benar untuk frasa
 * ("demam berdarah" menang atas "demam"). Tapi aturan itu SALAH ketika pesan
 * memuat nama penyakit SINGKAT bersama kata gejala yang lebih panjang:
 *
 *   "Saya demam dan bintik merah, apa saya kena DBD?"
 *     -> "bintik" (6 huruf) menang atas "dbd" (3 huruf)
 *     -> Wikipedia menjawabnya dengan "Bintik Fordyce" (kelenjar minyak di kulit)
 *     -> model terpaksa mengaku sumbernya tidak nyambung
 *
 * Nama penyakit selalu lebih khusus daripada kata gejalanya: pertanyaan tentang
 * DBD bukan pertanyaan tentang "bintik". Jadi nama penyakit dipilih lebih dulu,
 * dan kata gejala hanya dipakai kalau tidak ada nama penyakit sama sekali.
 *
 * Ini TIDAK melonggarkan penyaring relevansi — hanya memilih bahan pencarian
 * yang lebih tepat, jadi penyaringnya tetap seketat sebelumnya.
 */
const KATA_GEJALA = new Set([
  'sakit', 'nyeri', 'demam', 'panas', 'pusing', 'mual', 'muntah', 'batuk', 'pilek',
  'flu', 'sesak', 'lemas', 'letih', 'lelah', 'gatal', 'bengkak', 'luka', 'patah',
  'diare', 'sembelit', 'ruam', 'bintik', 'kram', 'pegal', 'insomnia',
  'sulit tidur', 'tidak nafsu makan', 'nafsu makan', 'tersedak', 'dehidrasi',
])

/**
 * Singkatan dan nama populer -> nama Indonesia lengkap yang ada di Wikipedia.
 *
 * KENAPA PERLU: `kataKunciPencarian()` mengembalikan kata yang muncul di pesan
 * apa adanya kalau kata itu tidak ada di PETA_PENCARIAN. Untuk singkatan seperti
 * "dbd" itu salah: pencarian Wikipedia untuk "dbd" tidak menemukan artikel
 * penyakitnya, sedangkan "Demam berdarah dengue" ada.
 *
 * Setiap nilai di sisi kanan sudah diuji ke API Wikipedia Indonesia.
 */
export const PETA_SINGKATAN = {
  dbd: 'Demam berdarah dengue',
  tbc: 'Tuberkulosis',
  hiv: 'HIV/AIDS',
  aids: 'HIV/AIDS',
  ispa: 'Infeksi saluran pernapasan akut',
  ppok: 'Penyakit paru obstruktif kronik',
  gerd: 'Penyakit refluks gastroesofageal',
  tipes: 'Demam tifoid',
  tifus: 'Demam tifoid',
  bmi: 'Indeks massa tubuh',
  asi: 'Air susu ibu',
}

/**
 * Singkatan yang TIDAK boleh dikenali sebagai topik kesehatan sama sekali.
 *
 * 'hati' adalah kasus khusus: dalam bahasa Indonesia sehari-hari ia hampir
 * selalu muncul sebagai "hati-hati", bukan sebagai organ hati. Diukur 13 Okt
 * 2026 — mendaftarkan 'hati' sebagai kata kesehatan membuat "hati-hati ya di
 * jalan" dianggap pertanyaan kesehatan dan MEMATIKAN deteksi obrolan biasa
 * (`deteksiSantai` memeriksa kata kesehatan lebih dulu). Kata yang benar-benar
 * menunjuk organnya tetap dikenali: 'liver' dan 'penyakit hati'.
 */
export const KATA_HOMONIM_BUKAN_SAKIT = new Set(['hati'])

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
  pegal: 'nyeri otot',
  'radang tenggorokan': 'faringitis',
  // CATATAN: 'pegal-pegal' dan 'gatal-gatal' TIDAK didaftarkan di sini.
  // normalkan() mengubah tanda hubung menjadi spasi, jadi "pegal-pegal" tiba
  // di sini sebagai "pegal pegal" — bentuk bertanda hubung tidak akan pernah
  // cocok. Yang menangkapnya adalah kata dasarnya ('pegal', 'gatal') yang
  // sudah ada di KATA_KESEHATAN, dan hasilnya sama. Keduanya pernah tertulis
  // di sini sebagai entri mati; uji-sumber.mjs yang menemukannya.

  /* --- Pengetahuan, penanganan, pengobatan, perawatan, dan risiko ----------
   * Ditambahkan 13 Okt 2026 setelah pengukuran: aplikasi menjawab "aku tidak
   * punya bahan bacaan" untuk pertanyaan wajar seperti "Apa penyebab anemia?"
   * dan "Bagaimana cara merawat pasien stroke di rumah?".
   *
   * Setiap nilai di sisi KANAN sudah dicek satu per satu ke API Wikipedia
   * Indonesia dan artikelnya benar-benar ada (bukan tebakan). Beberapa istilah
   * populer TIDAK dipakai karena artikelnya tidak ada atau menyesatkan:
   *   'operasi'          -> "Android (sistem operasi)"   -> dipakai 'Bedah'
   *   'kanker paru-paru' -> hanya "Kanker"               -> tetap dipakai, ada
   *   'perawatan luka'   -> tidak ada                    -> tidak dipetakan
   *   'pencegahan'       -> tidak ada                    -> tidak dipetakan
   *   'kesehatan mental' -> tidak ada                    -> tidak dipetakan
   * Istilah yang tidak dipetakan tetap ditangani MedlinePlus (lihat
   * PETA_MEDLINEPLUS) — jalur itu tidak bergantung judul artikel Wikipedia.
   */
  stroke: 'Strok',
  strok: 'Strok',
  anemia: 'Anemia',
  'serangan jantung': 'Serangan jantung',
  'gagal ginjal': 'Gagal ginjal',
  'kanker paru': 'Kanker paru-paru',
  tuberkulosis: 'Tuberkulosis',
  kemoterapi: 'Kemoterapi',
  antibiotik: 'Antibiotik',
  demensia: 'Demensia',
  alzheimer: 'Penyakit Alzheimer',
  obesitas: 'Obesitas',
  infeksi: 'Infeksi',
  'pertolongan pertama': 'Pertolongan pertama',
  tersedak: 'Tersedak',
  'luka bakar': 'Luka bakar',
  luka: 'Luka',
  liver: 'Penyakit hati',
  'penyakit hati': 'Penyakit hati',
  'pasca operasi': 'Bedah',
  operasi: 'Bedah',
  rehabilitasi: 'Rehabilitasi',
  fisioterapi: 'Fisioterapi',
  'faktor risiko': 'Faktor risiko',
  'perawatan di rumah': 'Perawatan di rumah',
  gejala: 'Tanda dan gejala',
  komplikasi: 'Komplikasi',
  dehidrasi: 'Dehidrasi',
  alergi: 'Alergi',
  diabetes: 'Diabetes melitus',
  'kencing manis': 'Diabetes melitus',
  hipertensi: 'Tekanan darah tinggi',
  'darah tinggi': 'Tekanan darah tinggi',

  /* --- Pemeriksaan penunjang ------------------------------------------------
   * Setiap pasangan di bawah ini diuji langsung ke API Wikipedia Indonesia.
   *
   * Yang KIRI adalah kata yang muncul di pesan pengguna; yang KANAN adalah
   * JUDUL ARTIKEL Wikipedia yang benar-benar ada.
   *
   * Kenapa perlu dipetakan, bukan dikirim apa adanya: Wikipedia Indonesia
   * memakai nama Indonesia resmi, sedangkan pengguna menulis singkatan atau
   * istilah sehari-hari. Tanpa peta ini, penyaring relevansi membuang artikel
   * yang justru BENAR, karena syaratnya "judul harus memuat kata kunci":
   *
   *   kk "usg" -> artikel "Ultrasonografi medis"          DIBUANG
   *   kk "mri" -> artikel "Pencitraan resonansi magnetik" DIBUANG
   *   kk "ekg" -> artikel "Elektrokardiografi"            DIBUANG
   *
   * Ketiganya lolos pemeriksaan konteks kesehatan — hanya gugur di syarat
   * judul. Memetakan ke judul kanonik membuat penyaring TETAP KETAT (jadi
   * artikel tidak nyambung seperti "Penyakit virus Ebola" untuk "demam
   * berdarah" tetap tertahan) sementara artikel yang benar ikut terpakai.
   *
   * Diukur sesudahnya: 14/14 pertanyaan alat pemeriksaan mendapat sumber,
   * dari 5/14 sebelumnya.
   *
   * JANGAN memetakan 'pemeriksaan penunjang' ke 'Pemeriksaan penunjang' —
   * artikel itu TIDAK ADA di Wikipedia Indonesia (yang muncul hanya Badan
   * Pemeriksa Keuangan dan Dewan Pertimbangan Presiden). "Pemeriksaan fisik"
   * adalah artikel terdekat yang benar-benar membahas pemeriksaan oleh dokter.
   */
  'pemeriksaan penunjang': 'Pemeriksaan fisik',
  'pemeriksaan fisik': 'Pemeriksaan fisik',
  'pemeriksaan laboratorium': 'Laboratorium klinik',
  'rontgen dada': 'Radiografi',
  'rontgen thorax': 'Radiografi',
  rontgen: 'Radiografi',
  radiologi: 'Radiologi',
  usg: 'Ultrasonografi medis',
  mri: 'Pencitraan resonansi magnetik',
  ekg: 'Elektrokardiografi',
  'ct scan': 'Tomografi terkomputasi',
  'cat scan': 'Tomografi terkomputasi',
  'tes pcr': 'Reaksi berantai polimerase',
  'rapid test': 'Tes diagnostik cepat',
  pcr: 'Reaksi berantai polimerase',
  laboratorium: 'Laboratorium klinik',
  endoskopi: 'Endoskopi',
  biopsi: 'Biopsi',
  spirometri: 'Spirometri',
  'pap smear': 'Apus Pap',
  'tes darah': 'Hitung darah lengkap',
  'tes urine': 'Urinalisis',
  'tes urin': 'Urinalisis',
}

/**
 * Istilah pencarian untuk MedlinePlus (Perpustakaan Kedokteran Nasional AS).
 *
 * KENAPA PERLU: Wikipedia Indonesia tidak punya artikel untuk sebagian alat
 * pemeriksaan. Diuji: "rontgen" hanya menghasilkan Wilhelm Conrad Röntgen,
 * Louis Slotin, dan satuan radiasi Röntgen — semuanya fisika, bukan
 * pemeriksaan medis. MedlinePlus punya halaman tepat untuk semuanya.
 *
 * Padanan di bawah ini juga sudah diuji satu per satu ke API MedlinePlus.
 * Yang dipakai adalah istilah INGGRIS karena MedlinePlus berbahasa Inggris;
 * jawabannya tetap disusun model dalam bahasa pengguna.
 */
export const PETA_MEDLINEPLUS = {
  'pemeriksaan penunjang': 'diagnostic tests',
  'pemeriksaan fisik': 'physical exam',
  'rontgen dada': 'x-ray',
  'rontgen thorax': 'x-ray',
  rontgen: 'x-ray',
  radiologi: 'diagnostic imaging',
  usg: 'ultrasound',
  mri: 'MRI',
  ekg: 'electrocardiogram',
  'ct scan': 'CT scan',
  'tes pcr': 'PCR test',
  'rapid test': 'rapid test',
  pcr: 'PCR test',
  laboratorium: 'laboratory tests',
  endoskopi: 'endoscopy',
  biopsi: 'biopsy',
  spirometri: 'spirometry',
  'pap smear': 'pap smear',
  'tes darah': 'blood tests',
  'tes urine': 'urine test',
  'tes urin': 'urine test',
  anemia: 'anemia',
  diabetes: 'diabetes',
  'kencing manis': 'diabetes',
  'gula darah': 'blood glucose',
  'tekanan darah': 'blood pressure',
  kolesterol: 'cholesterol',
  'demam berdarah': 'dengue',
  hipertensi: 'blood pressure',
  'darah tinggi': 'blood pressure',

  /* --- Pengetahuan, penanganan, pengobatan, perawatan, dan risiko ----------
   * Ditambahkan 13 Okt 2026. Semua 47 padanan di bawah ini diuji satu per satu
   * ke API MedlinePlus dan SEMUANYA mengembalikan dokumen — tidak ada yang
   * kosong. Inilah yang menutup lubang Wikipedia: untuk istilah yang artikel
   * Indonesianya tidak ada (mis. "perawatan luka", "pencegahan", "kesehatan
   * mental"), jalur ini tetap memberi bahan nyata.
   *
   * MedlinePlus berbahasa Inggris, jadi sisi kanan WAJIB bahasa Inggris.
   * Ringkasan MedlinePlus sudah memuat bagian "Who is at risk", "What are the
   * treatments", dan "rehabilitation" — itulah bahan untuk menjawab pertanyaan
   * faktor risiko dan penanganan tanpa perlu menyimpulkan diagnosis.
   */
  stroke: 'stroke',
  strok: 'stroke',
  'serangan jantung': 'heart attack',
  'gagal ginjal': 'kidney failure',
  'kanker paru': 'lung cancer',
  tuberkulosis: 'tuberculosis',
  kemoterapi: 'chemotherapy',
  antibiotik: 'antibiotics',
  demensia: 'dementia',
  alzheimer: 'dementia',
  obesitas: 'obesity',
  infeksi: 'infections',
  'pertolongan pertama': 'first aid',
  tersedak: 'choking',
  'luka bakar': 'burns',
  luka: 'wounds and injuries',
  'pasca operasi': 'after surgery',
  'perawatan luka': 'wound care',
  'perawatan di rumah': 'home care',
  rehabilitasi: 'rehabilitation',
  fisioterapi: 'rehabilitation',
  'faktor risiko': 'risk factors',
  pengobatan: 'treatment',
  pencegahan: 'prevention',
  gejala: 'symptoms',
  komplikasi: 'complications',
  kesehatan: 'health',
  'kesehatan mental': 'mental health',
  nyeri: 'pain',
  demam: 'fever',
  batuk: 'cough',
  diare: 'diarrhea',
  asma: 'asthma',
  kanker: 'cancer',
  jantung: 'heart diseases',
  ginjal: 'kidney diseases',
  liver: 'liver diseases',
  'penyakit hati': 'liver diseases',
  merokok: 'smoking',
  vaksin: 'vaccines',
  imunisasi: 'vaccines',
  kehamilan: 'pregnancy',
  gizi: 'nutrition',
  nutrisi: 'nutrition',
  olahraga: 'exercise and physical fitness',
  tidur: 'sleep',
  dehidrasi: 'dehydration',
  alergi: 'allergy',
  patah: 'fractures',
  'nyeri otot': 'muscle pain',
  'sakit kepala': 'headache',
  lemas: 'fatigue',
  kelelahan: 'fatigue',
  'sesak napas': 'breathing problems',
  'radang tenggorokan': 'sore throat',
  faringitis: 'sore throat',
  influenza: 'flu',
  'gatal': 'itching',
  'sembelit': 'constipation',
  'mual': 'nausea and vomiting',
  'muntah': 'nausea and vomiting',
  pusing: 'dizziness and vertigo',
  'tekanan darah tinggi': 'high blood pressure',
  'gagal jantung': 'heart failure',
  'batu ginjal': 'kidney stones',
  'sirosis': 'cirrhosis',
  'hepatitis': 'hepatitis',
  'tifus': 'typhoid fever',
  'malaria': 'malaria',
  'hiv': 'hiv',
  'aids': 'hiv',
  'covid': 'covid-19',
  'depresi': 'depression',
  'stres': 'stress',
  'cemas': 'anxiety',
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
 * Istilah kesehatan yang DIPILIH dari pesan yang sudah dinormalkan.
 *
 * Aturannya: ISTILAH_CARI sudah terurut dari yang terpanjang, jadi istilah
 * paling khusus biasanya menang ("demam berdarah" atas "demam"). TAPI kata
 * tindakan dikecualikan — ia lebih panjang daripada nama penyakitnya dan bukan
 * topik, melainkan pertanyaan TENTANG topik. Lihat KATA_TINDAKAN.
 *
 * Dipakai bersama oleh istilahKesehatan() dan kataKunciPencarian() supaya
 * kedua jalur pencarian (Wikipedia dan MedlinePlus) memilih istilah yang SAMA.
 * Kalau keduanya berbeda, satu jalur bisa mencari "anemia" sementara jalur lain
 * mencari "penyebab" — dan hasilnya saling bertentangan.
 *
 * @param {string} norm - teks yang sudah lewat normalkan() + terjemahkanDaerah()
 * @returns {string} istilah terpilih, atau '' kalau tidak ada
 */
function pilihIstilah(norm) {
  if (!norm) return ''
  const berbatas = ` ${norm} `
  const semua = ISTILAH_CARI.filter((t) => berbatas.includes(` ${t} `))
  if (!semua.length) return ''

  // 1) Kata TINDAKAN selalu disingkirkan lebih dulu. Ia bukan topik, melainkan
  //    pertanyaan TENTANG topik, dan justru lebih panjang daripada nama
  //    penyakitnya ("penyebab" mengalahkan "anemia"). Kalau pesannya HANYA
  //    berisi kata tindakan, kata itu tetap dipakai — lebih baik daripada kosong.
  const bukanTindakan = semua.filter((t) => !KATA_TINDAKAN.has(t))
  const kandidat = bukanTindakan.length ? bukanTindakan : semua

  // 2) Nama penyakit menang atas kata gejala — "dbd" harus mengalahkan
  //    "bintik", karena pertanyaan tentang DBD bukan pertanyaan tentang bintik.
  const penyakit = kandidat.find((t) => !KATA_GEJALA.has(t))
  if (penyakit) return penyakit

  // 3) Tidak ada nama penyakit: kata gejala boleh dipakai ("demam", "gatal").
  return kandidat[0]
}

/**
 * Istilah kesehatan yang muncul di pesan — SEBELUM dipetakan.
 *
 * Dipakai untuk mencari padanan MedlinePlus (lihat PETA_MEDLINEPLUS): peta itu
 * berkunci istilah yang dikenali pengguna ('rontgen', 'usg'), bukan judul
 * Wikipedia hasil pemetaan ('Radiografi', 'Ultrasonografi medis').
 *
 * @param {string} teks
 * @returns {string} istilah yang dikenali, atau '' kalau tidak ada
 */
export function istilahKesehatan(teks) {
  return pilihIstilah(terjemahkanDaerah(normalkan(teks)))
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

  // 1) istilah kesehatan terpilih — kata tindakan sudah disingkirkan di dalam
  //    pilihIstilah(). Batas kata dipakai supaya "asi" tidak cocok "makasih".
  const ketemu = pilihIstilah(norm)
  if (ketemu) {
    // Singkatan dipetakan ke nama lengkap. 'dbd' apa adanya tidak menemukan
    // artikel penyakitnya di Wikipedia; 'Demam berdarah dengue' menemukan.
    if (PETA_SINGKATAN[ketemu]) return PETA_SINGKATAN[ketemu]
    return PETA_PENCARIAN[ketemu] ?? ketemu
  }

  // 2) tidak ada istilah kesehatan: pakai kata isi. Maksimal 3 kata —
  //    kalimat panjang terbukti menghasilkan artikel yang tidak nyambung.
  return kataPenting(norm).slice(0, 3).join(' ')
}

/**
 * Apakah pesan ini menyentuh topik kesehatan?
 * Dipakai untuk memutuskan perlu mencari sumber atau tidak.
 */
export function menyentuhKesehatan(teks) {
  const norm = normalkan(teks)
  if (norm.trim() === '') return false
  const berbatas = ` ${norm} `
  return ISTILAH_CARI.some(
    (t) => !KATA_HOMONIM_BUKAN_SAKIT.has(t) && berbatas.includes(` ${t} `),
  )
}
