/**
 * Konten statis: topik, artikel, tips, dan riwayat awal.
 *
 * Jawaban AI TIDAK lagi di sini — sekarang datang dari server Express
 * (server/index.js) yang memanggil Kenari.id. Yang tersisa di file ini
 * hanya konten yang memang tidak perlu dibuat model.
 */

export const TOPICS = [
  { id: 'demam', label: 'Demam' },
  { id: 'obat', label: 'Obat' },
  { id: 'imunisasi', label: 'Imunisasi' },
  { id: 'gizi', label: 'Gizi' },
  { id: 'mental', label: 'Kesehatan Mental' },
]

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
  // Dipakai tombol "Baca selengkapnya". Isinya harus menyambung dengan `body`
  // di atas — jangan diisi topik lain, karena kartu ini muncul apa adanya.
  selengkapnya:
    'Mulai dari satu kebiasaan kecil yang mudah dijaga, misalnya menentukan jam tidur tetap setiap hari. Kebiasaan yang konsisten lebih mudah dipertahankan daripada perubahan besar sekaligus. Bila keluhan tidur berlanjut lebih dari dua minggu dan mengganggu aktivitas, diskusikan dengan tenaga kesehatan.',
  source: 'Kemenkes RI',
}

/**
 * 12 item HLS-SF12 (Health Literacy Short Form 12).
 *
 * BUKAN karangan: daftar ini diperoleh dari dua paper validasinya — Duong et
 * al. (2019, HLRP) untuk 12 item aslinya, dan jurnal adaptasi bahasa Indonesia
 * untuk terjemahannya. Rinciannya ada di docs/sumber-hls-sf12.txt.
 *
 * Kalimat pembuka skala aslinya ("Dalam skala dari sangat mudah hingga sangat
 * sulit, seberapa mudah bagi Anda untuk …") sengaja dipindah ke UI sebagai
 * pilihan radio, sehingga yang tersimpan tinggal "Seberapa mudah bagi Anda
 * untuk …?" — maknanya tidak berubah, hanya tidak diulang 12 kali di layar.
 *
 * Sengaja TIDAK diterjemahkan ke Inggris: ini instrumen dengan kalimat baku,
 * menerjemahkan ulang membuat skornya tidak bisa dibandingkan dengan rujukan.
 */
export const QUIZ_ITEMS = [
  'Seberapa mudah bagi Anda untuk menemukan informasi tentang penanganan atau perawatan penyakit yang Anda khawatirkan?',
  'Seberapa mudah bagi Anda untuk memahami selebaran yang disertakan dengan obat Anda?',
  'Seberapa mudah bagi Anda untuk menilai keuntungan dan kerugian dari pilihan penanganan atau perawatan yang berbeda?',
  'Seberapa mudah bagi Anda untuk memanggil ambulans dalam keadaan darurat?',
  'Seberapa mudah bagi Anda untuk menemukan informasi tentang cara mengelola masalah kesehatan mental seperti stres atau depresi?',
  'Seberapa mudah bagi Anda untuk mengerti mengapa Anda membutuhkan pemeriksaan kesehatan (seperti pemeriksaan payudara, tes gula darah, tekanan darah)?',
  'Seberapa mudah bagi Anda untuk menilai vaksinasi mana yang mungkin Anda perlukan?',
  'Seberapa mudah bagi Anda untuk memutuskan bagaimana Anda dapat melindungi diri dari penyakit berdasarkan saran dari keluarga dan teman?',
  'Seberapa mudah bagi Anda untuk mencari tahu tentang aktivitas (seperti meditasi, olahraga, jalan kaki, Pilates, dll.) yang baik untuk kesehatan mental Anda?',
  'Seberapa mudah bagi Anda untuk mengerti informasi di media (seperti internet, koran, majalah) tentang bagaimana menjadi lebih sehat?',
  'Seberapa mudah bagi Anda untuk menilai perilaku sehari-hari (seperti kebiasaan minum dan makan, olahraga, dll.) yang berhubungan dengan kesehatan Anda?',
  'Seberapa mudah bagi Anda untuk bergabung dengan klub olahraga atau kelas olahraga jika Anda mau?',
]

