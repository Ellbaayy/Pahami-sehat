/**
 * Batas panjang masukan & laju permintaan — SATU tempat untuk semuanya.
 *
 * KENAPA DISATUKAN
 * Sebelumnya setiap rute menulis angkanya sendiri, dan hasilnya tidak konsisten:
 * /api/tanya 4000, /api/sederhanakan 8000, /api/verifikasi 4000, sedangkan
 * /api/tanya/stream dan /api/suara TIDAK PUNYA BATAS SAMA SEKALI. Yang paling
 * berbahaya justru /api/tanya/stream, karena itulah endpoint yang benar-benar
 * dipakai aplikasi — diuji: 200.000 karakter diterima dan diproses (HTTP 200),
 * padahal /api/tanya menolak masukan yang sama dengan 400.
 *
 * Dengan satu sumber kebenaran, batasnya tidak bisa lagi berbeda tanpa sengaja.
 *
 * ANGKA-ANGKANYA DIPILIH, BUKAN DIKARANG
 *   MAKS_TANYA 4000      — pertanyaan pengguna wajar jauh di bawah ini; teks
 *                          hasil pindai foto yang panjang tetap muat.
 *   MAKS_SEDERHANAKAN 8000 — fitur ini memang untuk menempel teks medis utuh
 *                          (hasil lab satu halaman), jadi lebih longgar.
 *   MAKS_SUARA 4000      — sama dengan batas yang sudah dipakai pemecah kalimat
 *                          (lihat suara.js), supaya tidak ada teks yang dipotong
 *                          diam-diam di tengah jalan.
 */

export const MAKS_TANYA = 4000
export const MAKS_SEDERHANAKAN = 8000
export const MAKS_VERIFIKASI = 4000
export const MAKS_SUARA = 4000

/**
 * Anggaran token KELUARAN untuk model — DIUKUR satu per satu, bukan ditebak.
 *
 * KENAPA PERLU (15 Okt 2026): satu angka untuk semua jalur (1500) membuat DUA
 * fitur menjawab KOSONG. Balasan model berhenti karena menyentuh batas
 * (`finish_reason: length`, `usage.completion_tokens` tepat sama dengan batas),
 * JSON-nya terpotong, dan model bahkan membuang sebagian token untuk menulis
 * rencana berpikir di dalam `content`. Terukur:
 *
 *   jalur          kebutuhan  hasil di 1500
 *   berita         2178–2483   terpotong, jawaban KOSONG
 *   sederhanakan   2453        terpotong, jawaban KOSONG
 *   verifikasi     1495–2092   kadang terpotong (tergantung panjang keluaran)
 *   tanya          935         utuh
 *
 * Menaikkan BATAS tidak menambah biaya saat model berhenti sendiri — ia hanya
 * mencegah potongan. Yang bertambah cuma batas atas waktu. Batas waktu internal
 * server 50 detik (lihat config.js), dan pengukuran di atas memakai 14–19 detik.
 *
 * Kalau menambah jalur baru: UKUR dulu, jangan menyalin angka jalur lain.
 */
export const MAKS_TOKEN = {
  tanya: 2000,
  berita: 3000,
  sederhanakan: 3400,
  verifikasi: 2800,
}

/** Laju permintaan: per alamat IP per menit, dan total per-instance per menit. */
export const LAJU = {
  tanya: { maks: 20, maksTotal: 300 },
  sederhanakan: { maks: 20, maksTotal: 300 },
  verifikasi: { maks: 20, maksTotal: 300 },
  suara: { maks: 20, maksTotal: 300 },
  /**
   * Konten diturunkan dari 60 menjadi 20 per menit. Alasannya bukan biaya
   * (endpoint ini hanya membaca simpanan), melainkan ?paksa=1: setiap
   * permintaan ber-paksa memicu pengambilan ulang ke situs Kemenkes. Dengan
   * 60/menit, satu penyerang bisa memaksa 3.600 permintaan/jam ke server
   * pemerintah dan berisiko membuat IP kita diblokir. Aplikasi sendiri hanya
   * memanggil endpoint ini sekali saat halaman dibuka, jadi 20/menit jauh
   * lebih dari cukup.
   */
  konten: { maks: 20, maksTotal: 200 },
  /**
   * Pemeriksaan kesehatan dipanggil berkala oleh aplikasi (tiap 30 detik per
   * tab), jadi batasnya lebih longgar — tetapi TIDAK tanpa batas seperti dulu.
   * Sebelumnya endpoint ini terbuka bebas sambil memanggil Kenari setiap kali.
   */
  health: { maks: 120, maksTotal: 600 },
  /**
   * Meta (daftar tingkat baca) murni membaca konstanta — tidak memanggil
   * layanan luar. Ditemukan 15 Okt 2026 sebagai satu-satunya endpoint tanpa
   * pembatas. Batasnya longgar seperti health (aplikasi memanggilnya tiap
   * buka halaman), tapi TIDAK terbuka bebas.
   */
  meta: { maks: 120, maksTotal: 600 },
  /**
   * Ringkasan berita harian untuk lonceng. Hanya membaca simpanan server
   * (fetch RSS-nya di-cache sekali sehari), jadi longgar seperti health.
   * Aplikasi memanggilnya tiap buka + tiap 30 menit.
   */
  berita: { maks: 120, maksTotal: 600 },
}

/**
 * Berapa lama hasil pemeriksaan kesehatan dipakai ulang (ms).
 *
 * KENAPA PERLU: /api/health memanggil /models di Kenari. Diukur: tiga
 * permintaan beruntun masing-masing memakan ~0,29 detik — jadi ia benar-benar
 * memanggil keluar setiap kali, bukan mengembalikan hasil yang sudah ada.
 * Dengan simpanan 15 detik, pemantauan berkala tetap dapat jawaban segar
 * sementara hujan permintaan tidak lagi membebani akun Kenari.
 */
export const SIMPANAN_HEALTH_MS = 15_000
