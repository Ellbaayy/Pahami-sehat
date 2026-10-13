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

import { KATA_KESEHATAN, tambahKataKesehatan } from './prompts.js'

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

/**
 * KATA GANTI ORANG saja — dipakai `pilihIstilah()` untuk mencocokkan frasa
 * yang terputus kata ganti. Sengaja TIDAK memakai seluruh KATA_GANTI: kata
 * seperti 'tidak', 'belum', dan 'sering' mengubah makna, dan "tidak nafsu
 * makan" adalah istilah kesehatan yang sah.
 */
export const KATA_GANTI_ORANG = new Set([
  'saya', 'aku', 'kami', 'kita', 'kamu', 'anda', 'dia', 'mereka', 'kalian',
  'diriku', 'dirinya', 'gue', 'gua', 'ku', 'mu',
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

/*
 * CATATAN: daftar `PENGENALAN_TOPIK` (dulu bernama ISTILAH_CARI) dipindah ke
 * BAWAH berkas ini, setelah seluruh peta kosakata didefinisikan. Sebabnya:
 * daftar itu sekarang menyatukan FRASA_KHUSUS + KATA_KESEHATAN + seluruh kunci
 * peta, jadi ia harus dibaca SESUDAH peta-peta itu ada. Di sini ia akan
 * melempar ReferenceError (TDZ) kalau tetap ditulis.
 */

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
  hiv: 'AIDS',
  aids: 'AIDS',
  // DIPERBAIKI 13 Okt 2026: dulu 'Infeksi saluran pernapasan akut' — judul itu
  // TIDAK ADA di Wikipedia Indonesia (diuji dua kali, termasuk satu judul per
  // permintaan). Judul yang benar-benar ada adalah 'Infeksi saluran napas
  // atas', dan artikel itu justru membuka dengan definisi ISPA itu sendiri.
  // Entri mati seperti ini tidak menimbulkan galat apa pun — ia hanya membuat
  // pertanyaan soal ISPA diam-diam tidak pernah mendapat sumber.
  ispa: 'Infeksi saluran napas atas',
  // DIPERBAIKI 13 Okt 2026: dulu 'Penyakit paru obstruktif kronik' — judulnya
  // berakhiran "kronis", bukan "kronik". Bentuk lama DIALIHKAN oleh Wikipedia,
  // jadi ia sebenarnya bekerja, tapi dialihkan berarti satu permintaan ekstra
  // dan tidak ada gunanya. Yang benar:
  ppok: 'Penyakit paru obstruktif kronis',
  // DIPERBAIKI 13 Okt 2026: dulu 'Penyakit refluks gastroesofageal' — judul itu
  // TIDAK ADA; yang ada 'Penyakit refluks gastroesofagus'. Akibatnya pertanyaan
  // soal GERD/naik asam lambung tidak pernah dapat sumber Wikipedia.
  gerd: 'Penyakit refluks gastroesofagus',
  tipes: 'Demam tifoid',
  tifus: 'Demam tifoid',
  bmi: 'Indeks massa tubuh',
  asi: 'Air susu ibu',
  // Ditambahkan 13 Okt 2026 — singkatan yang dipakai sehari-hari.
  ptb: 'Tuberkulosis',
  k3: 'Kesehatan dan keselamatan kerja',
  rjp: 'Resusitasi jantung paru',
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
  // 'Rehabilitasi' pernah dipakai di sini dan itu salah: halaman itu
  // DISAMBIGUASI, jadi model hanya menerima daftar pilihan, bukan penjelasan.
  // 'Kedokteran fisik dan rehabilitasi' yang benar (diuji 13 Okt 2026).
  rehabilitasi: 'Kedokteran fisik dan rehabilitasi',
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

  /* ======================================================================
   * DIPERLUAS 13 Okt 2026 — pengetahuan kesehatan lintas bidang.
   *
   * KENAPA: `uji-sumber.mjs` hanya mengukur SATU bidang (alat pemeriksaan
   * penunjang) dan bidang itu sudah 14/14. Yang belum pernah diukur: apakah
   * aplikasi mengenali topik kesehatan LAIN di luar daftar yang sudah ditulis.
   * `ukur-pengetahuan.mjs` (baru) mengukur 86 pertanyaan lintas bidang, dan
   * hasilnya hanya 39/86 dikenali sebagai topik kesehatan.
   *
   * HASIL PENGUKURAN YANG MENYEBABKAN PENAMBAHAN INI:
   *   "Apa itu katarak?"            -> kk "katarak"    -> 0 sumber
   *   "Apa itu epilepsi?"           -> kk "epilepsi"   -> 0 sumber
   *   "Apa itu sinusitis?"          -> kk "sinusitis"  -> 0 sumber
   *   "Apa itu skizofrenia?"        -> kk "skizofrenia"-> 0 sumber
   *   "Bagaimana cara merawat gigi berlubang?"        -> 0 sumber
   * Sebabnya bukan penyaring relevansi: istilahnya memang tidak ada di
   * ISTILAH_CARI, jadi `menyentuhKesehatan()` mengembalikan false dan
   * `kataKunciPencarian()` jatuh ke "kata penting" — kalimat utuh yang
   * tidak pernah cocok dengan judul artikel mana pun.
   *
   * CARA MENGISI (WAJIB DIPATUHI kalau menambah lagi):
   *   1. Setiap nilai di sisi KANAN sudah diuji ke API Wikipedia Indonesia
   *      dengan `node verifikasi-judul.mjs` — 148/148 terbukti ADA. Jangan
   *      menambah judul dari ingatan.
   *   2. Perhatikan `exlimit`: `prop=extracts` hanya memproses 20 judul per
   *      permintaan. Mengirim lebih dari itu membuat sebagian halaman tidak
   *      diproses, dan halaman yang tidak diproses TAMPAK SEPERTI "tidak ada".
   *      Ini pernah membuat Eun-soo menyimpulkan 107 dari 123 judul "hilang"
   *      padahal semuanya ada.
   *   3. Judul yang berupa HALAMAN DISAMBIGUASI tidak boleh dipakai — model
   *      akan menerima daftar pilihan, bukan penjelasan. Contoh yang ditolak:
   *      'Rehabilitasi' (disambiguasi) -> dipakai 'Kedokteran fisik dan
   *      rehabilitasi'. 'Herpes' (disambiguasi) -> dipakai 'Herpes simpleks'.
   *   4. Nama artikel Wikipedia kadang BERBEDA dari istilah sehari-hari dan
   *      perbedaannya tidak bisa ditebak: 'stunting' -> 'Hambatan pertumbuhan',
   *      'malnutrisi' -> 'Malagizi', 'kwashiorkor' -> 'Busung lapar',
   *      'ikterus' -> 'Jaundis', 'patah tulang' -> 'Retak tulang',
   *      'perdarahan' -> 'Pendarahan', 'wasir' -> 'Hemoroid',
   *      'eksim' -> 'Eksem', 'panu' -> 'Panau', 'urtikaria' -> 'Biduran',
   *      'kesemutan' -> 'Parestesia' (dialihkan ke 'Kesemutan'),
   *      'bau mulut' -> 'Halitosis', 'sariawan' -> 'Seriawan',
   *      'kanker serviks' -> 'Kanker leher rahim', 'ppok' -> 'Penyakit paru
   *      obstruktif kronis' (bukan "...kronik").
   * ====================================================================== */

  /* --- gigi & mulut ------------------------------------------------------- */
  'gigi berlubang': 'Karies gigi',
  karies: 'Karies gigi',
  sariawan: 'Seriawan',
  'gusi berdarah': 'Gingivitis',
  gingivitis: 'Gingivitis',
  'radang gusi': 'Gingivitis',
  'karang gigi': 'Karang gigi',
  'gigi bungsu': 'Gigi bungsu',
  'bau mulut': 'Halitosis',
  halitosis: 'Halitosis',
  'abses gigi': 'Bisul gigi',
  'plak gigi': 'Plak gigi',
  'sakit gigi': 'Sakit gigi',

  /* --- mata --------------------------------------------------------------- */
  katarak: 'Katarak',
  glaukoma: 'Glaukoma',
  'rabun jauh': 'Rabun jauh',
  miopia: 'Rabun jauh',
  'rabun dekat': 'Rabun dekat',
  'buta warna': 'Buta warna',
  'mata kering': 'Sindrom mata kering',
  konjungtivitis: 'Konjungtivitis',
  belekan: 'Konjungtivitis',
  presbiopi: 'Presbiopia',

  /* --- telinga, hidung, tenggorokan --------------------------------------- */
  sinusitis: 'Sinusitis',
  amandel: 'Radang amandel',
  'radang amandel': 'Radang amandel',
  tonsilitis: 'Radang amandel',
  'infeksi telinga': 'Radang telinga tengah',
  otitis: 'Radang telinga tengah',
  'telinga berdenging': 'Tinitus',
  tinitus: 'Tinitus',
  mimisan: 'Mimisan',
  'polip hidung': 'Polip hidung',
  vertigo: 'Vertigo',

  /* --- saraf -------------------------------------------------------------- */
  epilepsi: 'Epilepsi',
  ayan: 'Epilepsi',
  migrain: 'Migrain',
  neuropati: 'Neuropati',
  kesemutan: 'Kesemutan',
  'bell palsy': "Bell's palsy",
  parkinson: 'Penyakit Parkinson',
  'sklerosis multipel': 'Sklerosis multipel',
  neuralgia: 'Neuralgia',

  /* --- kulit -------------------------------------------------------------- */
  eksim: 'Eksem',
  jerawat: 'Jerawat',
  psoriasis: 'Psoriasis',
  panu: 'Panau',
  kudis: 'Kudis',
  skabies: 'Kudis',
  kurap: 'Kurap',
  bisul: 'Bisul',
  urtikaria: 'Biduran',
  vitiligo: 'Vitiligo',
  kutil: 'Kutil',
  'cacar air': 'Cacar air',
  // 'herpes' -> 'Herpes simpleks', BUKAN 'Herpes': 'Herpes' adalah halaman
  // disambiguasi, jadi model hanya akan menerima daftar pilihan.
  herpes: 'Herpes simpleks',
  'herpes simpleks': 'Herpes simpleks',

  /* --- kesehatan jiwa ----------------------------------------------------- */
  'gangguan kecemasan': 'Gangguan kecemasan',
  kecemasan: 'Gangguan kecemasan',
  'gangguan bipolar': 'Gangguan bipolar',
  bipolar: 'Gangguan bipolar',
  skizofrenia: 'Skizofrenia',
  'bunuh diri': 'Bunuh diri',
  ptsd: 'Gangguan stres pascatrauma',
  adhd: 'Gangguan pemusatan perhatian dan hiperaktivitas',
  autisme: 'Autisme',
  'gangguan makan': 'Gangguan makan',
  anoreksia: 'Anoreksia nervosa',
  'kesehatan jiwa': 'Kesehatan mental',

  /* --- gizi --------------------------------------------------------------- */
  stunting: 'Hambatan pertumbuhan',
  tengkes: 'Hambatan pertumbuhan',
  malnutrisi: 'Malagizi',
  'gizi buruk': 'Malagizi',
  kwashiorkor: 'Busung lapar',
  'anemia defisiensi besi': 'Anemia defisiensi besi',
  'kekurangan zat besi': 'Anemia defisiensi besi',
  'gizi seimbang': 'Gizi seimbang',

  /* --- ibu & anak --------------------------------------------------------- */
  'asi eksklusif': 'Air susu ibu',
  menyusui: 'Air susu ibu',
  'bayi baru lahir': 'Bayi',
  'imunisasi dasar': 'Imunisasi',
  ikterus: 'Jaundis',
  'penyakit kuning': 'Jaundis',
  // 'preeklamsia' -> 'Pre-eklampsia' (judul aslinya bertanda hubung).
  // KUNCI-nya jangan ditulis 'pre-eklampsia': normalkan() mengubah tanda hubung
  // menjadi spasi, jadi kunci bertanda hubung TIDAK PERNAH cocok — persis entri
  // mati seperti 'pegal-pegal' dulu. Bentuk spasi yang dipakai.
  preeklamsia: 'Pre-eklampsia',
  'pre eklampsia': 'Pre-eklampsia',
  eklamsia: 'Eklampsia',
  'komplikasi kehamilan': 'Komplikasi kehamilan',

  /* --- lansia ------------------------------------------------------------- */
  osteoporosis: 'Osteoporosis',
  inkontinensia: 'Inkontinensia',
  sarkopenia: 'Atrofi otot',
  'jatuh lansia': 'Atrofi otot',

  /* --- penyakit tropis & menular ----------------------------------------- */
  leptospirosis: 'Leptospirosis',
  chikungunya: 'Chikungunya',
  'demam tifoid': 'Demam tifoid',
  tifoid: 'Demam tifoid',
  cacingan: 'Cacingan',
  'cacar monyet': 'Cacar monyet',
  'infeksi saluran kemih': 'Infeksi saluran kemih',
  isk: 'Infeksi saluran kemih',
  filariasis: 'Filariasis',
  'hepatitis b': 'Hepatitis B',
  'hepatitis c': 'Hepatitis C',
  // 'ispa' SENGAJA dipetakan ke 'Infeksi saluran napas atas' meski kepanjangan
  // ISPA adalah "infeksi saluran pernapasan akut": judul dengan kata "akut"
  // TIDAK ADA di Wikipedia Indonesia (diuji dua kali), sedangkan 'Infeksi
  // saluran napas atas' ada DAN membuka dengan definisi ISPA itu sendiri.
  ispa: 'Infeksi saluran napas atas',

  /* --- penyakit kronis & metabolik --------------------------------------- */
  'asam urat': 'Asam urat',
  gout: 'Asam urat',
  ppok: 'Penyakit paru obstruktif kronis',
  tiroid: 'Kelenjar tiroid',
  hipotiroid: 'Hipotiroidisme',
  hipertiroid: 'Hipertiroidisme',
  wasir: 'Hemoroid',
  ambeien: 'Hemoroid',
  hemoroid: 'Hemoroid',
  gerd: 'Penyakit refluks gastroesofagus',
  'asam lambung': 'Penyakit refluks gastroesofagus',
  'batu empedu': 'Batu empedu',

  /* --- kanker ------------------------------------------------------------- */
  'kanker payudara': 'Kanker payudara',
  'kanker serviks': 'Kanker leher rahim',
  'kanker leher rahim': 'Kanker leher rahim',
  'kanker usus besar': 'Kanker usus besar',
  'kanker prostat': 'Kanker prostat',
  leukemia: 'Leukemia',
  limfoma: 'Limfoma',

  /* --- gawat darurat & pertolongan pertama ------------------------------- */
  'patah tulang': 'Retak tulang',
  perdarahan: 'Pendarahan',
  tenggelam: 'Tenggelam',
  // 'Syok (medis)' TIDAK ADA; judulnya 'Syok' dan sudah membahas syok medis.
  syok: 'Syok',
  anafilaksis: 'Anafilaksis',
  cpr: 'Resusitasi jantung paru',
  rjp: 'Resusitasi jantung paru',
  'gigitan ular': 'Gigitan ular',
  keracunan: 'Keracunan',
  'henti jantung': 'Henti jantung',

  /* --- pencegahan & hidup sehat ------------------------------------------ */
  'cuci tangan': 'Mencuci tangan',
  'mencuci tangan': 'Mencuci tangan',
  higiene: 'Higiene',
  'kesehatan kerja': 'Kesehatan dan keselamatan kerja',
  'k3': 'Kesehatan dan keselamatan kerja',

  /* --- kata tunggal & frasa pendek yang sering dipakai tanpa bersebelahan ---
   * Diukur 13 Okt 2026: setelah penambahan di atas, 8 dari 86 pertanyaan masih
   * tidak dikenali, dan SEMUANYA karena frasa pencariannya tidak bersebelahan
   * di kalimat pengguna:
   *   "Telinga SAYA berdenging terus"  -> 'telinga berdenging' tidak cocok
   *   "Hidung SAYA mampet terus"       -> 'hidung mampet' tidak cocok
   *   "Mata saya MINUS terus bertambah"-> 'mata minus' tidak cocok
   * Pencocokan memakai batas kata pada frasa utuh, jadi kata sisipan memutusnya.
   * Karena itu kata tunggal yang MAKNAYA sudah khusus ditambahkan juga.
   *
   * ATURAN sebelum menambah kata tunggal di sini: periksa dulu apakah kata itu
   * juga muncul dalam percakapan sehari-hari yang BUKAN soal kesehatan. Kata
   * 'hati' pernah masuk dan mematikan deteksi obrolan biasa — lihat
   * KATA_HOMONIM_BUKAN_SAKIT.
   */
  berdenging: 'Tinitus',
  'hidung mampet': 'Rinitis',
  'mata minus': 'Rabun jauh',
  'air minum': 'Air minum',
  lansia: 'Masa tua',
  cedera: 'Cedera',
  'sarang nyamuk': 'Nyamuk',

  /* --- dua pertanyaan yang MASIH 0 sumber setelah gelombang pertama --------
   * Diukur 13 Okt 2026, dua pertanyaan ini tetap kosong padahal topiknya sudah
   * dikenali:
   *   "Bagaimana cara mencegah kematian ibu melahirkan?"
   *     -> kk "melahirkan" (judul itu tidak ada; yang ada 'Kematian maternal')
   *   "Bagaimana cara menjaga kebersihan makanan?"
   *     -> kk "kebersihan" -> artikel "Kebersihan" tidak membahas makanan
   * Keduanya diperbaiki dengan frasa yang LEBIH KHUSUS, bukan dengan
   * melonggarkan penyaring relevansi.
   */
  'kematian ibu': 'Kematian maternal',
  'kematian maternal': 'Kematian maternal',
  'kebersihan makanan': 'Keracunan makanan',
  'keamanan pangan': 'Keracunan makanan',

  /* --- obat: ejaan Wikipedia berbeda dari ejaan sehari-hari ---------------
   * Diukur 13 Okt 2026: pertanyaan "Apakah saya harus minum paracetamol 500mg
   * tiga kali sehari?" mendapat 0 sumber, padahal artikelnya ADA. Sebabnya
   * cuma ejaan: Wikipedia memakai 'Parasetamol' dan 'Amoksisilin' (s), pengguna
   * menulis 'paracetamol' dan 'amoxicillin' (c). Pemetaan ini yang menutupnya.
   */
  paracetamol: 'Parasetamol',
  acetaminophen: 'Parasetamol',
  amoxicillin: 'Amoksisilin',
  amoksisilin: 'Amoksisilin',
  'efek samping': 'Efek samping',
  'interaksi obat': 'Interaksi obat',
  'resep dokter': 'Resep dokter',
  overdosis: 'Overdosis',
  'obat bebas': 'Obat yang dijual bebas',
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

  /* ======================================================================
   * DIPERLUAS 13 Okt 2026 — sejalan dengan PETA_PENCARIAN di atas.
   *
   * Semua 51 padanan baru di bawah ini diuji ke API MedlinePlus
   * (`db=healthTopics`) dan SEMUANYA mengembalikan dokumen.
   *
   * MedlinePlus berbahasa Inggris, jadi sisi kanan WAJIB bahasa Inggris —
   * istilah Indonesia menghasilkan NOL dokumen di sana (sudah diukur).
   * ====================================================================== */

  /* --- gigi & mulut ------------------------------------------------------- */
  'gigi berlubang': 'tooth decay',
  karies: 'tooth decay',
  sariawan: 'canker sores',
  'gusi berdarah': 'gum disease',
  gingivitis: 'gum disease',
  'radang gusi': 'gum disease',
  'karang gigi': 'gum disease',
  'gigi bungsu': 'wisdom teeth',
  'bau mulut': 'bad breath',
  halitosis: 'bad breath',
  'abses gigi': 'tooth decay',
  'plak gigi': 'gum disease',
  'sakit gigi': 'tooth decay',

  /* --- mata --------------------------------------------------------------- */
  katarak: 'cataract',
  glaukoma: 'glaucoma',
  'rabun jauh': 'nearsightedness',
  miopia: 'nearsightedness',
  'rabun dekat': 'farsightedness',
  'buta warna': 'color blindness',
  'mata kering': 'dry eye',
  konjungtivitis: 'pink eye',
  belekan: 'pink eye',
  presbiopi: 'farsightedness',

  /* --- telinga, hidung, tenggorokan --------------------------------------- */
  sinusitis: 'sinusitis',
  amandel: 'tonsillitis',
  'radang amandel': 'tonsillitis',
  tonsilitis: 'tonsillitis',
  'infeksi telinga': 'ear infections',
  otitis: 'ear infections',
  'telinga berdenging': 'tinnitus',
  tinitus: 'tinnitus',
  mimisan: 'nosebleeds',
  'polip hidung': 'nasal disorders',
  vertigo: 'dizziness and vertigo',

  /* --- saraf -------------------------------------------------------------- */
  epilepsi: 'epilepsy',
  ayan: 'epilepsy',
  migrain: 'migraine',
  neuropati: 'diabetic neuropathy',
  kesemutan: 'paresthesia',
  'bell palsy': 'facial paralysis',
  parkinson: 'parkinson disease',
  'sklerosis multipel': 'multiple sclerosis',
  neuralgia: 'neuralgia',

  /* --- kulit -------------------------------------------------------------- */
  eksim: 'eczema',
  jerawat: 'acne',
  psoriasis: 'psoriasis',
  panu: 'fungal infections',
  kudis: 'scabies',
  skabies: 'scabies',
  kurap: 'fungal infections',
  bisul: 'boils',
  urtikaria: 'hives',
  vitiligo: 'vitiligo',
  kutil: 'warts',
  'cacar air': 'chickenpox',
  herpes: 'herpes',
  'herpes simpleks': 'herpes',

  /* --- kesehatan jiwa ----------------------------------------------------- */
  'gangguan kecemasan': 'anxiety',
  kecemasan: 'anxiety',
  'gangguan bipolar': 'bipolar disorder',
  bipolar: 'bipolar disorder',
  skizofrenia: 'schizophrenia',
  'bunuh diri': 'suicide',
  ptsd: 'post-traumatic stress disorder',
  adhd: 'attention deficit hyperactivity disorder',
  autisme: 'autism spectrum disorder',
  'gangguan makan': 'eating disorders',
  anoreksia: 'eating disorders',
  'kesehatan jiwa': 'mental health',

  /* --- gizi --------------------------------------------------------------- */
  stunting: 'child nutrition',
  tengkes: 'child nutrition',
  malnutrisi: 'malnutrition',
  'gizi buruk': 'malnutrition',
  kwashiorkor: 'malnutrition',
  'anemia defisiensi besi': 'iron deficiency anemia',
  'kekurangan zat besi': 'iron deficiency anemia',
  'gizi seimbang': 'nutrition',

  /* --- ibu & anak --------------------------------------------------------- */
  'asi eksklusif': 'breastfeeding',
  menyusui: 'breastfeeding',
  'bayi baru lahir': 'newborn screening',
  'imunisasi dasar': 'childhood vaccines',
  ikterus: 'jaundice',
  'penyakit kuning': 'jaundice',
  preeklamsia: 'preeclampsia',
  'pre eklampsia': 'preeclampsia',
  eklamsia: 'preeclampsia',
  'komplikasi kehamilan': 'preeclampsia',

  /* --- lansia ------------------------------------------------------------- */
  osteoporosis: 'osteoporosis',
  inkontinensia: 'urinary incontinence',
  sarkopenia: 'muscle weakness',
  'jatuh lansia': 'falls',

  /* --- penyakit tropis & menular ----------------------------------------- */
  leptospirosis: 'leptospirosis',
  chikungunya: 'chikungunya',
  'demam tifoid': 'typhoid fever',
  tifoid: 'typhoid fever',
  cacingan: 'parasitic diseases',
  'cacar monyet': 'mpox',
  'infeksi saluran kemih': 'urinary tract infections',
  isk: 'urinary tract infections',
  filariasis: 'lymphatic filariasis',
  'hepatitis b': 'hepatitis b',
  'hepatitis c': 'hepatitis c',
  ispa: 'acute respiratory infection',

  /* --- penyakit kronis & metabolik --------------------------------------- */
  'asam urat': 'gout',
  gout: 'gout',
  ppok: 'copd',
  tiroid: 'thyroid diseases',
  hipotiroid: 'hypothyroidism',
  hipertiroid: 'hyperthyroidism',
  wasir: 'hemorrhoids',
  ambeien: 'hemorrhoids',
  hemoroid: 'hemorrhoids',
  gerd: 'gerd',
  'asam lambung': 'gerd',
  'batu empedu': 'gallstones',

  /* --- kanker ------------------------------------------------------------- */
  'kanker payudara': 'breast cancer',
  'kanker serviks': 'cervical cancer',
  'kanker leher rahim': 'cervical cancer',
  'kanker usus besar': 'colorectal cancer',
  'kanker prostat': 'prostate cancer',
  leukemia: 'leukemia',
  limfoma: 'lymphoma',

  /* --- gawat darurat & pertolongan pertama ------------------------------- */
  'patah tulang': 'fractures',
  perdarahan: 'bleeding',
  tenggelam: 'drowning',
  syok: 'shock',
  anafilaksis: 'anaphylaxis',
  cpr: 'cpr',
  rjp: 'cpr',
  'gigitan ular': 'snake bites',
  keracunan: 'poisoning',
  'henti jantung': 'sudden cardiac arrest',

  /* --- pencegahan & hidup sehat ------------------------------------------ */
  'cuci tangan': 'handwashing',
  higiene: 'hygiene',
  'kesehatan kerja': 'occupational health',
  k3: 'occupational health',

  /* --- kata tunggal & frasa pendek (lihat catatan di PETA_PENCARIAN) ------- */
  berdenging: 'tinnitus',
  'hidung mampet': 'nasal disorders',
  'mata minus': 'eye diseases',
  'air minum': 'drinking water',
  lansia: 'older adult health',
  cedera: 'wounds and injuries',
  'sarang nyamuk': 'mosquito bites',
  'mencuci tangan': 'handwashing',
  'kematian ibu': 'maternal health',
  'kematian maternal': 'maternal health',
  'kebersihan makanan': 'food safety',
  'keamanan pangan': 'food safety',
  paracetamol: 'acetaminophen',
  acetaminophen: 'acetaminophen',
  amoxicillin: 'amoxicillin',
  amoksisilin: 'amoxicillin',
  'efek samping': 'drug reactions',
  'interaksi obat': 'drug interactions',
  'resep dokter': 'prescription drugs',
  overdosis: 'drug overdose',
  'obat bebas': 'over-the-counter medicines',
}

/* ---------------------------------------------------------- peta cadangan -- */

/**
 * Istilah umum per BIDANG — dipakai kalau peta di atas TIDAK punya padanan.
 *
 * KENAPA PERLU (diukur 13 Okt 2026):
 * `PETA_MEDLINEPLUS` hanya berisi istilah yang sudah dipetakan satu per satu,
 * dan pemetaan itu tidak mungkin lengkap — ada ratusan topik kesehatan. Akibatnya
 * pertanyaan yang topiknya dikenali tetapi padanannya tidak ada langsung jatuh
 * ke 0 dokumen MedlinePlus, padahal Wikipedia-nya mungkin juga kosong.
 * Contoh terukur sebelum ini: "Bagaimana cara merawat gigi berlubang?" dan
 * "Apa itu katarak?" hanya mengandalkan Wikipedia.
 *
 * Peta ini memberi JARING PENANGKAP: kalau istilah spesifiknya tidak punya
 * padanan, dipakai istilah BIDANG-nya (gigi -> tooth disorders, mata -> eye
 * diseases, dan seterusnya). Bahannya memang lebih umum, tapi tetap benar,
 * tetap dari NIH, dan jauh lebih baik daripada tidak ada bahan sama sekali.
 *
 * SEMUA 51 istilah di bawah ini diuji ke API MedlinePlus dan SEMUANYA
 * mengembalikan dokumen (lihat `cek-medline-umum`).
 *
 * ATURAN: kuncinya adalah istilah Indonesia yang SUDAH ada di
 * PENGENALAN_TOPIK. Kalau sebuah istilah sudah punya padanan spesifik di
 * PETA_MEDLINEPLUS, entri di sana yang menang — peta ini hanya cadangan.
 */
export const PETA_MEDLINEPLUS_BIDANG = {
  // gigi & mulut
  'gigi berlubang': 'tooth disorders', karies: 'tooth disorders',
  sariawan: 'mouth disorders', 'gusi berdarah': 'gum disease',
  gingivitis: 'gum disease', 'radang gusi': 'gum disease',
  'karang gigi': 'gum disease', 'gigi bungsu': 'tooth disorders',
  'bau mulut': 'bad breath', halitosis: 'bad breath',
  'abses gigi': 'tooth disorders', 'plak gigi': 'gum disease',
  'sakit gigi': 'tooth disorders', gusi: 'gum disease',
  // mata
  katarak: 'eye diseases', glaukoma: 'eye diseases', 'rabun jauh': 'eye diseases',
  miopia: 'eye diseases', 'rabun dekat': 'eye diseases', 'buta warna': 'eye diseases',
  'mata kering': 'eye diseases', konjungtivitis: 'eye diseases',
  belekan: 'eye diseases', presbiopi: 'eye diseases', 'mata minus': 'eye diseases',
  // tht
  sinusitis: 'sinusitis', amandel: 'throat disorders', 'radang amandel': 'throat disorders',
  tonsilitis: 'throat disorders', 'infeksi telinga': 'ear disorders',
  otitis: 'ear disorders', 'telinga berdenging': 'tinnitus', tinitus: 'tinnitus',
  mimisan: 'nosebleeds', 'polip hidung': 'nose disorders', vertigo: 'dizziness and vertigo',
  'sakit tenggorokan': 'throat disorders',
  // saraf
  epilepsi: 'epilepsy', ayan: 'epilepsy', migrain: 'migraine',
  neuropati: 'diabetic neuropathy', kesemutan: 'paresthesia',
  'bell palsy': 'facial paralysis', parkinson: 'parkinson disease',
  'sklerosis multipel': 'multiple sclerosis', neuralgia: 'neuralgia',
  // kulit
  eksim: 'eczema', jerawat: 'acne', psoriasis: 'psoriasis', panu: 'fungal infections',
  kudis: 'scabies', skabies: 'scabies', kurap: 'fungal infections', bisul: 'boils',
  urtikaria: 'hives', vitiligo: 'vitiligo', kutil: 'warts', 'cacar air': 'chickenpox',
  herpes: 'herpes', 'herpes simpleks': 'herpes',
  // jiwa
  'gangguan kecemasan': 'anxiety', kecemasan: 'anxiety',
  'gangguan bipolar': 'bipolar disorder', bipolar: 'bipolar disorder',
  skizofrenia: 'schizophrenia', 'bunuh diri': 'suicide',
  ptsd: 'post-traumatic stress disorder',
  adhd: 'attention deficit hyperactivity disorder', autisme: 'autism spectrum disorder',
  'gangguan makan': 'eating disorders', anoreksia: 'eating disorders',
  'kesehatan jiwa': 'mental health',
  // gizi
  stunting: 'child nutrition', tengkes: 'child nutrition', malnutrisi: 'malnutrition',
  'gizi buruk': 'malnutrition', kwashiorkor: 'malnutrition',
  'anemia defisiensi besi': 'iron deficiency anemia',
  'kekurangan zat besi': 'iron deficiency anemia', 'gizi seimbang': 'nutrition',
  // ibu & anak
  'asi eksklusif': 'breastfeeding', menyusui: 'breastfeeding',
  'bayi baru lahir': 'newborn screening', 'imunisasi dasar': 'childhood vaccines',
  ikterus: 'jaundice', 'penyakit kuning': 'jaundice',
  preeklamsia: 'preeclampsia', 'pre eklampsia': 'preeclampsia',                     
  eklamsia: 'preeclampsia', 'komplikasi kehamilan': 'preeclampsia',
  // lansia
  osteoporosis: 'osteoporosis', inkontinensia: 'urinary incontinence',
  sarkopenia: 'muscle weakness', 'jatuh lansia': 'falls',
  // tropis & menular
  leptospirosis: 'leptospirosis', chikungunya: 'chikungunya',
  'demam tifoid': 'typhoid fever', tifoid: 'typhoid fever', cacingan: 'parasitic diseases',
  'cacar monyet': 'mpox', 'infeksi saluran kemih': 'urinary tract infections',
  isk: 'urinary tract infections', filariasis: 'lymphatic filariasis',
  'hepatitis b': 'hepatitis b', 'hepatitis c': 'hepatitis c',
  ispa: 'acute respiratory infection',
  // kronis & metabolik
  'asam urat': 'gout', gout: 'gout', ppok: 'copd', tiroid: 'thyroid diseases',
  hipotiroid: 'hypothyroidism', hipertiroid: 'hyperthyroidism', wasir: 'hemorrhoids',
  ambeien: 'hemorrhoids', hemoroid: 'hemorrhoids', gerd: 'gerd',
  'asam lambung': 'gerd', 'batu empedu': 'gallstones',
  // kanker
  'kanker payudara': 'breast cancer', 'kanker serviks': 'cervical cancer',
  'kanker leher rahim': 'cervical cancer', 'kanker usus besar': 'colorectal cancer',
  'kanker prostat': 'prostate cancer', leukemia: 'leukemia', limfoma: 'lymphoma',
  // gawat darurat
  'patah tulang': 'fractures', perdarahan: 'bleeding', tenggelam: 'drowning',
  syok: 'shock', anafilaksis: 'anaphylaxis', cpr: 'cpr', rjp: 'cpr',
  'gigitan ular': 'snake bites', keracunan: 'poisoning',
  'henti jantung': 'sudden cardiac arrest',
  // pencegahan
  'cuci tangan': 'handwashing', higiene: 'hygiene',
  'kesehatan kerja': 'occupational health', k3: 'occupational health',
  // kata tunggal & frasa pendek
  berdenging: 'tinnitus', 'hidung mampet': 'nasal disorders',
  'mata minus': 'eye diseases', 'air minum': 'drinking water',
  lansia: 'older adult health', cedera: 'wounds and injuries',
  'sarang nyamuk': 'mosquito bites', 'mencuci tangan': 'handwashing',
  'kematian ibu': 'maternal health', 'kematian maternal': 'maternal health',
  'kebersihan makanan': 'food safety', 'keamanan pangan': 'food safety',
  paracetamol: 'acetaminophen', acetaminophen: 'acetaminophen',
  amoxicillin: 'amoxicillin', amoksisilin: 'amoxicillin',
  'efek samping': 'drug reactions', 'interaksi obat': 'drug interactions',
  'resep dokter': 'prescription drugs', overdosis: 'drug overdose',
  'obat bebas': 'over-the-counter medicines',
}

/* --------------------------------------------- kosakata pengenalan topik -- */

/**
 * Seluruh istilah yang membuat sebuah pesan DIKENALI sebagai topik kesehatan,
 * DIURUTKAN DARI YANG TERPANJANG.
 *
 * Urutan ini yang membuat "demam berdarah" menang atas "demam", dan
 * "pemeriksaan penunjang" menang atas "pemeriksaan".
 *
 * KENAPA MENYATUKAN SELURUH KUNCI PETA (perubahan 13 Okt 2026):
 * Dulu daftar ini hanya `FRASA_KHUSUS + KATA_KESEHATAN`. Akibatnya sebuah
 * istilah bisa ADA di PETA_PENCARIAN tetapi TIDAK dikenali — dan pemetaannya
 * jadi mati total, karena `pilihIstilah()` memilih dari daftar ini lebih dulu.
 * Diukur sebelum perbaikan: 47 dari 86 pertanyaan kesehatan lintas bidang
 * (gigi, mata, THT, saraf, kulit, jiwa, gizi, anak, lansia, tropis, kanker,
 * gawat darurat) TIDAK dikenali sama sekali — "Apa itu katarak?" menjadi
 * bahan pencarian "katarak itu apa" yang tidak cocok dengan judul mana pun.
 *
 * Dengan menggabungkan kunci peta, menambah satu entri ke peta langsung
 * membuat istilahnya dikenali. Tidak ada lagi dua tempat yang harus dijaga
 * sinkron — dan itu jenis kesalahan yang tidak terlihat sampai ada yang
 * mengukurnya.
 *
 * NAMA: dulu `ISTILAH_CARI`, sekarang `PENGENALAN_TOPIK`. Namanya diganti
 * karena tugasnya memang bukan lagi "istilah untuk mencari" — ia dipakai juga
 * untuk MEMUTUSKAN apakah sebuah pesan menyentuh kesehatan. `ISTILAH_CARI`
 * tetap diekspor sebagai alias supaya berkas uji lama tidak pecah.
 */
export const PENGENALAN_TOPIK = [
  ...new Set([
    ...FRASA_KHUSUS,
    ...KATA_KESEHATAN,
    ...Object.keys(PETA_SINGKATAN),
    ...Object.keys(PETA_PENCARIAN),
    ...Object.keys(PETA_MEDLINEPLUS),
    ...Object.keys(PETA_MEDLINEPLUS_BIDANG),
  ]),
].sort((a, b) => b.length - a.length)

/** Alias lama — jangan dipakai untuk kode baru. */
export const ISTILAH_CARI = PENGENALAN_TOPIK

/**
 * Kabari prompts.js tentang kosakata baru, supaya `deteksiSantai()` memakai
 * daftar yang SAMA. Tanpa ini ada dua kamus berbeda: `deteksiSantai()` akan
 * menganggap "gusi saya berdarah" sebagai obrolan biasa (tanpa sumber) padahal
 * `kataKunciPencarian()` sudah mengenalinya sebagai topik kesehatan.
 */
tambahKataKesehatan(PENGENALAN_TOPIK)

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

  // Kata ganti orang & kata perintah di tengah frasa memutus pencocokan frasa.
  // Diukur 13 Okt 2026: "Mata saya minus terus bertambah" dan "Hidung saya
  // mampet terus" TIDAK dikenali, karena pencocokan memakai batas kata pada
  // frasa utuh ('mata minus', 'hidung mampet') dan kata "saya" berada di
  // tengahnya. Kalimat seperti ini justru bentuk paling wajar dipakai orang.
  //
  // Perbaikannya: cocokkan dulu apa adanya, dan kalau GAGAL coba sekali lagi
  // tanpa kata ganti orang. Sengaja hanya kata ganti orang (bukan seluruh
  // KATA_GANTI): kata seperti 'tidak'/'belum' mengubah makna — "tidak nafsu
  // makan" adalah istilah yang sah dan tidak boleh dilucuti.
  const berbatasTanpaGanti = ` ${norm.split(' ').filter((k) => !KATA_GANTI_ORANG.has(k)).join(' ')} `

  const cari = (teks) =>
    ISTILAH_CARI.filter(
      (t) => !KATA_HOMONIM_BUKAN_SAKIT.has(t) && teks.includes(` ${t} `),
    )
  let semua = cari(berbatas)
  if (!semua.length && berbatasTanpaGanti !== berbatas) semua = cari(berbatasTanpaGanti)
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
  // Memakai pilihIstilah() — aturan yang SAMA dengan pemilihan bahan pencarian.
  // Dulu fungsi ini punya pencocokan sendiri (frasa utuh dengan batas kata),
  // dan itu membuat dua tempat bisa berbeda pendapat: "Mata saya minus terus
  // bertambah" dikenali oleh kataKunciPencarian() tetapi TIDAK oleh fungsi ini,
  // sehingga pesannya dianggap obrolan biasa dan dijawab tanpa sumber.
  // Satu aturan, satu tempat.
  return pilihIstilah(terjemahkanDaerah(norm)) !== ''
}
