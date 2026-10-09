/**
 * Data dummy / statis untuk dashboard.
 * Tidak ada backend, tidak ada API — semua diimpor langsung ke komponen.
 */

export const TOPICS = [
  { id: 'demam', label: 'Demam' },
  { id: 'obat', label: 'Obat' },
  { id: 'imunisasi', label: 'Imunisasi' },
  { id: 'gizi', label: 'Gizi' },
  { id: 'mental', label: 'Kesehatan Mental' },
]

/** Jawaban simulasi per topik — dipilih saat user menekan chip. */
export const TOPIC_ANSWERS = {
  demam: {
    text: 'Demam adalah respons alami tubuh terhadap infeksi. Pada orang dewasa, demam ringan biasanya cukup diatasi dengan istirahat dan minum yang banyak. Segera cari pertolongan medis bila disertai kejang, kesadaran menurun, atau tidak membaik dalam tiga hari.',
    sources: ['Kemenkes RI', 'WHO'],
    verdict: 'ok',
  },
  obat: {
    text: 'Obat diminum sesuai dosis dan interval yang tertulis pada kemasan atau resep. Jangan menghentikan antibiotik sebelum habis hanya karena keluhan membaik — sisa bakteri bisa menjadi resisten terhadap obat.',
    sources: ['BPOM', 'Kemenkes RI'],
    verdict: 'ok',
  },
  imunisasi: {
    text: 'Imunisasi melindungi anak dari penyakit yang berat dan menular. Jadwal imunisasi dasar diberikan sesuai usia; keterlambatan masih bisa dikejar dengan jadwal susulan yang dipandu tenaga kesehatan.',
    sources: ['Kemenkes RI', 'WHO'],
    verdict: 'ok',
  },
  gizi: {
    text: 'Pola makan seimbang berarti porsi karbohidrat, protein, sayur, dan buah terbagi rata sepanjang hari. Kurangi gula, garam, dan lemak berlebih, dan baca label gizi sebelum membeli makanan kemasan.',
    sources: ['Kemenkes RI'],
    verdict: 'ok',
  },
  mental: {
    text: 'Kesehatan mental sama pentingnya dengan kesehatan fisik. Bila perasaan cemas atau sedih bertahan lama dan mengganggu aktivitas sehari-hari, bicarakan dengan orang terpercaya atau tenaga kesehatan.',
    sources: ['WHO', 'Kemenkes RI'],
    verdict: 'ok',
  },
  generic: {
    text: 'Pertanyaanmu kami ringkas dengan rubric prompting — poin kunci wajib tetap dipertahankan, lalu disederhanakan ke tingkat baca yang kamu pilih. Setiap jawaban selalu menyertakan sumber resmi agar bisa kamu verifikasi sendiri.',
    sources: ['Kemenkes RI'],
    verdict: 'ok',
  },
}

export const ARTICLES = [
  {
    id: 'a1',
    category: 'Literasi',
    tint: 'brand',
    title: 'Cara membaca hasil laboratorium tanpa bingung',
    excerpt:
      'Panduan singkat memahami istilah dan angka pada lembar hasil lab, lengkap dengan penjelasan istilah yang paling sering membingungkan.',
    body: 'Mulai dari membaca nama pemeriksaan, lalu bandingkan angka kamu dengan rentang normal yang tercetak di lembar yang sama. Setiap laboratorium memakai satuan sedikit berbeda, jadi rentangnya juga bisa berbeda — yang terpenting adalah arahnya, bukan angka mutlaknya. Bila ada tanda panah ke atas atau ke bawah, catat berapa lama dan tanyakan ke tenaga kesehatan pada kunjungan berikutnya.',
    source: 'Kemenkes RI',
    readTime: '5 menit baca',
  },
  {
    id: 'a2',
    category: 'Vaksinasi',
    tint: 'sky',
    title: 'Imunisasi: menjawab pertanyaan yang paling sering muncul',
    excerpt:
      'Rangkuman pertanyaan yang biasanya ditanyakan orang tua, dijawab dengan bahasa mudah dan dirujuk ke dokumen resmi.',
    body: 'Imunisasi bekerja dengan melatih sistem imun mengenali penyakit sebelum benar-benar terpapar. Reaksi ringan setelah penyuntikan adalah hal yang wajar dan justru tanda tubuh sedang merespons. Bila anak sedang tidak sehat pada hari jadwal, jangan batal begitu saja — jadwalnya bisa disesuaikan oleh tenaga kesehatan.',
    source: 'Kemenkes RI',
    readTime: '7 menit baca',
  },
  {
    id: 'a3',
    category: 'Gizi',
    tint: 'amber',
    title: 'Membaca label gizi dalam 30 detik',
    excerpt:
      'Kenali porsi, gula, garam, dan lemak pada kemasan sebelum membeli — supaya pilihan belanja harian lebih sadar.',
    body: 'Angka pada label hampir selalu merujuk ke satu porsi, padahal satu kemasan sering berisi beberapa porsi. Kalikan dulu dengan jumlah porsi di kemasan sebelum membandingkan dua produk. Lihat juga urutan bahan: bahan yang ditulis paling awal berarti paling banyak jumlahnya.',
    source: 'BPOM',
    readTime: '4 menit baca',
  },
]

export const HEALTH_TIP = {
  label: 'Tips Kesehatan Hari Ini',
  title: 'Istirahat cukup, daya tahan tubuh ikut terjaga',
  body: 'Tidur berkualitas membantu tubuh memperbaiki sel dan menjaga sistem imun tetap bekerja optimal. Usahakan jam tidur yang sama setiap hari, kurangi layar menjelang tidur, dan pastikan kamar cukup gelap serta sejuk.',
  bullets: ['Jam tidur konsisten', 'Kurangi layar 30 menit sebelum tidur', 'Kamar gelap dan sejuk'],
  source: 'Kemenkes RI',
}

export const HISTORY = [
  {
    id: 'h1',
    question: 'Apa arti hasil lab kolesterol saya?',
    answer: 'Disederhanakan ke tingkat anak-anak, lengkap dengan rentang normal dan penjelasan istilahnya.',
    time: '2 jam lalu',
    sources: ['Kemenkes RI'],
  },
  {
    id: 'h2',
    question: 'Cek klaim: vaksin menyebabkan autisme',
    answer: 'Verdict: tidak ditemukan di dokumen resmi manapun — diarahkan ke WHO dan Kemenkes.',
    time: 'Kemarin',
    sources: ['WHO', 'Kemenkes RI'],
  },
  {
    id: 'h3',
    question: 'Sederhanakan teks edukasi ini ke tingkat anak-anak',
    answer: 'Paragraf disusun ulang dengan kalimat lebih pendek, poin kunci tetap dipertahankan.',
    time: 'Kemarin',
    sources: ['Kemenkes RI'],
  },
  {
    id: 'h4',
    question: 'Bagaimana cara membaca label gizi makanan kemasan?',
    answer: 'Langkah demi langkah: lihat porsi dulu, baru bandingkan nilai per porsi dengan kebutuhan harian.',
    time: '3 hari lalu',
    sources: ['BPOM'],
  },
]

export const QUIZ_ITEMS = [
  'Saya kesulitan memahami informasi kesehatan yang saya baca.',
  'Saya tahu di mana menemukan informasi kesehatan yang tepercaya.',
  'Istilah medis membuat saya bingung.',
  'Saya bisa menilai apakah suatu informasi kesehatan itu benar.',
  'Saya bisa menjelaskan kembali informasi yang diberikan tenaga kesehatan.',
]

export const QUIZ_SCALE = ['Sangat sulit', 'Kadang sulit', 'Mudah', 'Sangat mudah']
