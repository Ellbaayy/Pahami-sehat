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
 * DIPERBAIKI 14 Okt 2026 — SUARA NATURAL SUDAH BERJALAN.
 * Sebelumnya jalur ini SELALU gagal 403 di komputer sendiri, dan seluruh fitur
 * suara dikira mustahil. Penyebabnya sepele: `msedge-tts` yang terpasang masih
 * 2.0.9, sedangkan 2.1.0 dirilis 13 Okt 2026 dan MEMPERBAIKI handshake-nya.
 * Setelah dinaikkan ke ^2.1.0, kelima suara berhasil. Diukur di mesin ini:
 *
 *   /api/suara  teks 1 kalimat  -> 200, audio/mpeg, 26.064 byte
 *   /api/suara  teks 8 kalimat  -> 200, audio/mpeg, 237.744 byte, 39,62 detik
 *   lima suara (id lk/pr, jv, su, en) -> kelimanya berhasil, 0,4–0,7 detik
 *   8 kalimat dengan 4 pekerja serentak -> 8/8 berhasil, 1,8 detik
 *   8 permintaan berturut-turut tanpa jeda -> 8/8 berhasil
 *
 * Isinya DIBUKTIKAN dengan transkripsi (faster-whisper), bukan hanya dari
 * ukuran berkas: hasil /api/suara teks panjang terbaca kembali sebagai teks
 * aslinya dengan keyakinan bahasa 1,00. Jadi ini bukan audio kosong.
 *
 * BATAS YANG TETAP ADA — DAN SEKARANG DITANGANI: layanan Microsoft membalas
 * HTTP `429` (terlalu sering) kalau dipanggil beruntun. Diukur 14 Okt 2026
 * dengan jeda 3 detik antar permintaan: hanya 4 dari 8 yang lolos, sisanya
 * `429`. Karena satu permintaan /api/suara bisa memuat puluhan kalimat (satu
 * permintaan per kalimat), satu saja yang kena 429 membuat SELURUH jawaban
 * gagal — pengguna tidak dapat suara sama sekali padahal 7 kalimat lain
 * berhasil. Sekarang tiap kalimat diulang sampai `COBA_ULANG` kali dengan jeda
 * bertingkat, dan koneksi yang sudah rusak disambung ulang. Jangan hapus
 * percobaan ulang ini; mengukur sekali lalu menyimpulkan "rusak" juga salah —
 * 429 itu sementara dan pulih dalam ~1 detik.
 *
 * KEPUTUSAN JAGI (14 Okt 2026) — HANYA JALUR MICROSOFT.
 * Dulu ada jalur kedua lewat Kenari (`POST /audio/speech`) yang dicoba LEBIH
 * DULU di server biasa. Jalur itu dibuang karena selalu merugikan:
 *   - saldo akun Kenari Rp 0, jadi setiap permintaan ditolak `402
 *     insufficient_balance` (atau menggantung sampai batas waktu 20 detik)
 *     SEBELUM akhirnya pindah ke Microsoft;
 *   - penantian itu murni pemborosan: /api/suara jadi 20 detik lebih lambat
 *     untuk setiap kalimat tanpa pernah menghasilkan audio.
 * Jadi sekarang Microsoft adalah satu-satunya jalur di server biasa. Jangan
 * hidupkan kembali jalur Kenari tanpa perintah jagi.
 *
 * CATATAN LISENSI: suara ini milik Microsoft dan diakses lewat layanan
 * Read Aloud, yang izin komersialnya belum dinyatakan tertulis. Aman untuk
 * pemakaian lomba/pribadi; untuk produk komersial sebaiknya pindah ke
 * Azure Speech resmi atau mesin suara lokal (mis. Piper).
 */

import { MsEdgeTTS, OUTPUT_FORMAT } from 'msedge-tts'

/**
 * Matriks suara: 4 bahasa × 2 jenis.
 *
 * SEMUA nama suara di sini sudah DIPERIKSA ke layanan Microsoft (322 suara
 * tersedia) — bukan dari ingatan. Cara memeriksanya ada di uji-suara.mjs.
 *
 * `p` = perempuan, `l` = laki-laki.
 *
 * Catatan pemilihan untuk Inggris: Ava dan Andrew dipilih karena keduanya
 * termasuk generasi suara terbaru Microsoft (lebih halus daripada Aria/Guy
 * yang lebih tua). Yang penting keduanya ada dan sudah terverifikasi.
 */
const SUARA = {
  id: { p: 'id-ID-GadisNeural', l: 'id-ID-ArdiNeural' },
  jv: { p: 'jv-ID-SitiNeural', l: 'jv-ID-DimasNeural' },
  su: { p: 'su-ID-TutiNeural', l: 'su-ID-JajangNeural' },
  en: { p: 'en-US-AvaNeural', l: 'en-US-AndrewNeural' },
}

/** Kode bahasa yang punya suara sendiri. */
export const BAHASA_SUARA = ['id', 'jv', 'su', 'en']

/** Jenis suara yang tersedia. */
export const JENIS_SUARA = ['p', 'l']

/** Label manusiawi untuk ditampilkan di antarmuka. */
export const LABEL_SUARA = {
  id: 'Indonesia',
  jv: 'Jawa',
  su: 'Sunda',
  en: 'English',
}

/** Label jenis kelamin untuk antarmuka. */
export const LABEL_JENIS = { p: 'Perempuan', l: 'Laki-laki' }

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
 * Pilih nama suara dari bahasa + jenis.
 *
 * @param {'id'|'jv'|'su'|'en'|string} kode bahasa
 * @param {'p'|'l'|string} jenis 'p' perempuan (bawaan), 'l' laki-laki
 */
export function pilihSuara(kode, jenis = 'p') {
  const perBahasa = SUARA[kode] ?? SUARA.id
  return perBahasa[jenis] ?? perBahasa.p
}

/**
 * Tentukan bahasa yang dipakai untuk membacakan.
 *
 * URUTAN KEPUTUSAN — dan urutannya penting:
 *
 *   1. PILIHAN PENGGUNA MENANG. Kalau pengguna sudah memilih suara sendiri di
 *      Pengaturan, pilihannya dipakai APA ADANYA dan tebakan otomatis tidak
 *      dijalankan sama sekali. Ini menutup keluhan yang paling mengganggu:
 *      "aku nanya bahasa Indonesia, dijawab Indonesia, tapi dibacakan Jawa".
 *      Penyebabnya ada di bawah (tebakan otomatis), tapi apa pun penyebabnya,
 *      pengguna yang sudah memilih tidak boleh dilawan oleh tebakan.
 *
 *   2. KALAU 'otomatis', bahasa ditebak dari ISI TEKS — bukan dari kode bahasa
 *      antarmuka, karena kode itu bahasa ANTARMUKA, bukan bahasa jawaban.
 *
 * @param {string} teks - teks jawaban
 * @param {string} diminta - kode bahasa dari aplikasi, atau 'auto'/''
 * @returns {'id'|'jv'|'su'|'en'}
 */
export function tentukanBahasa(teks, diminta = '') {
  const minta = String(diminta ?? '').trim().toLowerCase()

  // 1. pilihan pengguna — jangan dilawan tebakan
  if (BAHASA_SUARA.includes(minta)) return minta

  // 2. otomatis: tebak dari isi teks
  const dariTeks = tebakBahasaDaerah(teks)
  if (dariTeks !== 'id') return dariTeks // Jawa/Sunda menang
  return 'id'
}

/**
 * Tebak bahasa daerah dari teks jawaban.
 *
 * ============================================================================
 * BUG YANG PERNAH TERJADI DI SINI — DAN KENAPA SEKARANG PAKAI BATAS KATA
 * ============================================================================
 *
 * Versi sebelumnya mencocokkan POTONGAN KATA (`t.includes(kata)`). Akibatnya
 * kata pendek memicu deteksi palsu pada kata Indonesia yang sangat umum:
 *
 *   'iku'  cocok di  "ikuti", "siku", "ikut"
 *   'dina' cocok di  "dinamis", "dinamakan"
 *   'abdi' cocok di  "abdi negara"
 *
 * Diukur 16 Okt 2026: 5 dari 10 kalimat kesehatan berbahasa INDONESIA
 * dinyatakan Jawa, sehingga jawaban Indonesia dibacakan dengan suara Jawa.
 * Itu keluhan yang disampaikan jagi, dan penyebabnya persis ini.
 *
 * Perbaikannya dua lapis:
 *   1. Pencocokan memakai BATAS KATA (`\b`), jadi 'iku' tidak lagi cocok di
 *      dalam "ikuti". Daftar kata juga diperketat: hanya kata yang TIDAK
 *      muncul dalam bahasa Indonesia sehari-hari.
 *   2. Ambangnya dinaikkan: satu kata daerah yang kebetulan muncul TIDAK
 *      cukup. Butuh minimal DUA pemicu, ATAU satu pemicu yang sangat khas
 *      (kata fungsi seperti 'yaiku', 'menika', 'nyaéta', 'sanggeus') yang
 *      hampir tidak mungkin muncul di kalimat Indonesia.
 *
 * Yang TIDAK dilakukan: menghapus fitur deteksi. Jawaban berbahasa Jawa/Sunda
 * tetap perlu dibacakan dengan suara yang tepat — itu justru fitur unggulan
 * aplikasi ini. Yang diperbaiki adalah ketepatannya.
 */
export function tebakBahasaDaerah(teks) {
  const t = String(teks ?? '').toLowerCase()

  // Kata yang SANGAT khas — satu saja sudah cukup untuk memutuskan.
  //
  // SYARAT MASUK DAFTAR INI: kata itu TIDAK BOLEH punya arti dalam bahasa
  // Indonesia. Ini pernah salah: 'abdi' ("abdi negara") dan 'teh' ("minum
  // teh") sempat ada di sini, dan keduanya membuat kalimat Indonesia
  // dinyatakan Sunda. Kata yang masih ambigu masuk PENDUKUNG, yang butuh dua.
  const KHAS = {
    jv: ['yaiku', 'menika', 'punika', 'gejalane', 'sawise', 'nganggo', 'wonten', 'matur nuwun', 'saged', 'dhateng', 'menawi', 'kula'],
    su: ['nyaéta', 'nyaeta', 'sanggeus', 'numutkeun', 'panyakit', 'kasakit', 'oge', 'ogé', 'ieu', 'mangka'],
  }

  // Kata pendukung — perlu minimal DUA supaya dianggap daerah.
  // Di sini boleh ada kata yang ambigu, karena satu saja tidak cukup.
  const PENDUKUNG = {
    jv: ['dina', 'iku', 'lan', 'kang', 'sing', 'wis', 'durung', 'kula', 'sok'],
    su: ['jeung', 'mah', 'teh', 'geus', 'acan', 'kudu', 'abdi', 'sok', 'oge'],
  }

  /** Cocok sebagai KATA UTUH, bukan potongan kata. */
  const adaUtuh = (kata) => new RegExp(`(^|[^a-zà-ÿ])${kata.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}([^a-zà-ÿ]|$)`, 'i').test(t)

  for (const b of ['jv', 'su']) {
    if (KHAS[b].some(adaUtuh)) return b
  }

  const nJawa = PENDUKUNG.jv.filter(adaUtuh).length
  const nSunda = PENDUKUNG.su.filter(adaUtuh).length
  if (nJawa >= 2 || nSunda >= 2) return nJawa >= nSunda ? 'jv' : 'su'
  return 'id'
}

/**
 * Tentukan nada & tempo untuk satu kalimat, mengikuti isinya.
 *
 * Aturannya sengaja sederhana dan bisa dibaca manusia — bukan model tambahan,
 * supaya hasilnya bisa diprediksi dan tidak menambah waktu tunggu.
 *
 * ============================================================================
 * DIUKUR 15 OKT 2026 — KENAPA NADANYA DIBUAT SEDATAR INI
 * ============================================================================
 *
 * Keluhan jagi: "suara kadang masih naik turun". Penyebabnya diukur, bukan
 * ditebak. Satu kalimat yang SAMA dibacakan dengan beberapa pitch, lalu nada
 * dasarnya (f0) dihitung dari audionya:
 *
 *   pitch -18Hz -> f0 202,5 Hz
 *   pitch -12Hz -> f0 210,5 Hz
 *   pitch  -8Hz -> f0 219,2 Hz
 *   pitch  -4Hz -> f0 222,2 Hz
 *   pitch   0Hz -> f0 228,6 Hz
 *   pitch  +4Hz -> f0 235,3 Hz
 *   pitch +10Hz -> f0 246,2 Hz
 *
 * Versi sebelumnya memakai -18Hz untuk peringatan dan +10Hz untuk penutup.
 * Selisihnya 43,7 Hz = 21,6% = hampir 4 semitone.
 *
 * JUJUR SOAL HASILNYA: memperkecil rentang ini HANYA mengurangi sebagian
 * masalahnya, bukan menghilangkannya. Diukur ulang pada tiga kalimat asli
 * sesudah perubahan: rentangnya masih 21,3% — hampir sama dengan sebelumnya.
 *
 * Penyebab SEBENARNYA ditemukan setelah itu: dengan pitch disamakan (+0Hz
 * untuk semua kalimat), rentangnya tetap 16,1% (35,8 Hz). Jadi sebagian besar
 * naik-turun itu datang dari INTONASI ALAMI tiap kalimat — kalimat yang
 * berakhir dengan kata seperti "terdekat" memang dibaca lebih tinggi daripada
 * kalimat berita biasa. Itu ciri bahasa manusia, bukan kerusakan.
 *
 * Jadi: memperkecil rentang pitch tetap dilakukan (supaya tidak menambah
 * masalah), tapi jangan menjanjikan bahwa ini menghilangkan naik-turunnya.
 * Kalau nanti terasa masih melompat, yang perlu diperiksa berikutnya adalah
 * panjang & bentuk kalimatnya, bukan angka pitch-nya.
 *
 * @returns {{pitch: string, rate: string}}
 */
export function nadaKalimat(kalimat, posisi = {}) {
  const k = String(kalimat ?? '').trim()
  const kecil = k.toLowerCase()

  // kalimat peringatan / tanda bahaya -> sedikit lebih rendah & lebih lambat
  if (
    /^(perhatian|awas|penting|hati-hati|jangan|segera|waspada|tanda bahaya)\b/.test(kecil) ||
    /\b(bahaya|segera ke dokter|segera ke rumah sakit|jangan ditunda|bisa berakibat fatal)\b/.test(kecil)
  ) {
    return { pitch: '-4Hz', rate: '-8%' }
  }

  // pertanyaan -> sedikit naik, seperti orang bertanya
  if (k.endsWith('?')) return { pitch: '+4Hz', rate: '+0%' }

  // pembuka / sapaan -> hangat
  if (posisi.pertama) return { pitch: '+0Hz', rate: '-4%' }

  // penutup -> sedikit lebih tinggi supaya terdengar ramah
  if (posisi.terakhir) return { pitch: '+2Hz', rate: '+0%' }

  return { pitch: '+0Hz', rate: '+0%' }
}

/**
 * PEMBAGIAN SINGKATAN: mana yang DIEJA, mana yang JANGAN.
 *
 * ============================================================================
 * CARA MENGUKUR (jangan ubah daftar ini tanpa mengukur ulang)
 * ============================================================================
 *
 * Setiap singkatan dibacakan DUA KALI dengan suara yang sama: bentuk polos
 * ("DBD") dan bentuk berspasi ("D B D"). Lalu durasi audionya dibandingkan.
 *
 *   rasio = durasi_polos / durasi_dieja
 *
 * Arti rasionya:
 *   ~1,0  -> mesinnya SUDAH mengeja sendiri; kedua bentuk sama panjangnya.
 *            Mengeja paksa tidak mengubah apa pun, jadi jangan disentuh.
 *   sedang (0,7–0,86) -> bentuk polos dibaca sebagai KATA; mengeja membuatnya
 *            jelas lebih panjang. Inilah yang perlu dieja.
 *   sangat kecil (< 0,6) -> bentuk polos DAN berspasi sama-sama dibaca sebagai
 *            kata pendek. Ini singkatan yang sudah jadi kata Indonesia
 *            (POSYANDU, PUSKESMAS) — mengejanya SALAH.
 *
 * Diukur 15 Okt 2026 dengan `id-ID-GadisNeural`, 33 singkatan:
 *   yang perlu dieja      : rasio 0,72 – 0,86
 *   yang sudah benar      : rasio 0,90 – 1,12
 *   yang memang kata      : rasio 0,57 – 0,58 (POSYANDU, PUSKESMAS)
 *
 * Batasnya ditaruh di 0,88 — di tengah celah antara 0,86 dan 0,90. Yang
 * mendekati batas (USG 0,89 dan WHO 0,90) sengaja TIDAK dieja: kalau ragu,
 * jangan mengeja, karena mengeja yang sudah benar terdengar rusak, sedangkan
 * tidak mengeja yang salah hanya kurang ideal.
 */
const UKUR = {
  // ---- DIEJA: terbukti dibaca sebagai kata, dan bukan kata Indonesia (rasio 0,72–0,86) ----
  AIDS: 0.72,
  GERD: 0.75,
  PPOK: 0.78,
  ISPA: 0.79,
  DBD: 0.83,
  PTM: 0.83,
  RSUD: 0.83,
  PTB: 0.86,

  // ---- JANGAN DIEJA: mesinnya sudah mengeja sendiri (rasio >= 0,88) ----
  USG: 0.89, // mendekati batas — sengaja dibiarkan
  WHO: 0.9, // mendekati batas — sengaja dibiarkan
  BPJS: 0.91,
  PCR: 0.91,
  ASI: 0.91,
  TBC: 0.92,
  HIV: 0.92,
  IGD: 0.93,
  ICU: 0.93,
  THT: 0.93,
  NIH: 0.95,
  EKG: 0.95,
  NIK: 0.95,
  RJP: 0.96,
  BMKG: 0.98,
  CT: 0.99,
  KB: 1.0,
  APD: 1.0,
  TD: 1.0,
  K3: 1.0,
  BMI: 1.04,
  BPOM: 1.07,
  MRI: 1.12,
}

/**
 * Singkatan yang sudah menjadi KATA INDONESIA — JANGAN dieja.
 *
 * Rasio terukurnya (0,57–0,58) membuatnya MIRIP kelompok "perlu dieja" kalau
 * hanya melihat angkanya, padahal artinya berkebalikan: bentuk polos DAN
 * bentuk berspasi sama-sama dibaca sebagai kata pendek. Keduanya memang kata
 * yang lazim diucapkan, jadi mengejanya justru SALAH UCAP.
 *
 * Karena itu kelompok ini dipisah, bukan disatukan ke tabel UKUR — kesalahan
 * pertama sempat memasukkan keduanya ke daftar "dieja" dan uji langsung
 * menangkapnya.
 */
const KATA_INDONESIA = {
  POSYANDU: 0.57,
  PUSKESMAS: 0.58,
}

/** Batas rasio: di bawah ini berarti perlu dieja (dan bukan kata Indonesia). */
const BATAS_EJA = 0.88

/**
 * Daftar singkatan yang DIEJA — diturunkan dari tabel pengukuran di atas,
 * supaya tidak ada daftar kedua yang bisa berbeda dengan buktinya.
 */
const EJA = Object.entries(UKUR)
  .filter(([, rasio]) => rasio < BATAS_EJA)
  .map(([kode]) => kode)

/** Bentuk regex sekali jadi — lebih cepat daripada menyusun ulang tiap kalimat. */
const POLA_EJA = new RegExp(`\\b(${EJA.join('|')})\\b`, 'g')

/**
 * Keterangan untuk dipakai uji dan dokumentasi: singkatan mana yang JANGAN
 * dieja, beserta rasio terukurnya. Dipakai supaya uji bisa memastikan daftar
 * "jangan" ini benar-benar tidak disentuh.
 */
export const JANGAN_EJA = {
  ...Object.fromEntries(Object.entries(UKUR).filter(([, rasio]) => rasio >= BATAS_EJA)),
  ...KATA_INDONESIA,
}

/** Daftar singkatan yang dieja — dipakai uji. */
export const DIEJA = EJA

/** Kata Indonesia yang mirip singkatan — dipakai uji supaya tidak ikut dieja. */
export const KATA_MIRIP_SINGKATAN = KATA_INDONESIA

/**
 * Sisipkan spasi di antara huruf supaya singkatan DIEJA, bukan dibaca sebagai kata.
 *
 * Hanya menyentuh singkatan di daftar EJA. Teks lain tidak diubah sama sekali —
 * termasuk singkatan yang sudah benar dibaca mesinnya (TBC, HIV, IGD, …) dan
 * kata seperti POSYANDU/PUSKESMAS.
 *
 * @param {string} teks
 * @returns {string}
 */
export function siapkanEjaan(teks) {
  return String(teks ?? '').replace(POLA_EJA, (cocok) => cocok.split('').join(' '))
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

/* ---------------------------------------------------- ulang saat kena 429 --- */

/**
 * Berapa kali satu kalimat dicoba ulang, dan berapa lama menunggu di antaranya.
 *
 * KENAPA PERLU: diukur 14 Okt 2026 dengan jeda 3 detik antar permintaan, hanya
 * 4 dari 8 permintaan yang lolos — sisanya `429`. Satu permintaan /api/suara
 * membuat SATU permintaan per kalimat, jadi jawaban 13 kalimat bisa memicu
 * puluhan permintaan beruntun; satu kalimat yang gagal membuat seluruh
 * jawaban gagal. 429 ini pulih cepat (~1 detik), jadi menunggu lalu mengulang
 * jauh lebih baik daripada menyerah.
 *
 * Jeda dinaikkan bertingkat (0,5 → 1,0 → 1,5 detik, total 3 detik) supaya tidak
 * menghajar layanan yang sedang membatasi kita — 429 di sini pulih dalam ~1 detik.
 */
const COBA_ULANG = 4
const JEDA_ULANG_MS = 500

/** Sebuah galat layar suara yang layak dicoba ulang? (429 / koneksi putus) */
function layakDiulang(e) {
  const p = String(e?.message ?? e)
  return /429|too many requests|connection closed|ECONNRESET|socket hang up|ETIMEDOUT/i.test(p)
}

/** Format keluaran yang dipakai untuk semua suara (MP3 24 kHz mono). */
const FORMAT_MP3 = OUTPUT_FORMAT.AUDIO_24KHZ_48KBITRATE_MONO_MP3

/**
 * Buka (atau buka ULANG) koneksi WebSocket ke Microsoft, dengan percobaan ulang.
 *
 * KENAPA PERLU DIULANG JUGA: 429 bisa datang saat MEMBUKA koneksi, bukan cuma
 * saat mengirim kalimat. Diukur 14 Okt 2026: satu permintaan gagal setelah 0,57
 * detik — secepat itu mustahil kalau percobaan ulang sempat jalan, artinya
 * galatnya datang dari `setMetadata` yang ada di luar pembungkus. Jadi
 * pembukaan koneksi WAJIB ikut diulang.
 *
 * @param {{tts: import('msedge-tts').MsEdgeTTS, bahasa: string}} e
 */
async function sambung(e) {
  let terakhir
  for (let ke = 1; ke <= COBA_ULANG; ke++) {
    try {
      await e.tts.setMetadata(pilihSuara(e.bahasa, e.jenis), FORMAT_MP3)
      return
    } catch (err) {
      terakhir = err
      if (ke === COBA_ULANG || !layakDiulang(err)) throw err
      await new Promise((r) => setTimeout(r, JEDA_ULANG_MS * ke))
    }
  }
  throw terakhir
}

/**
 * Buat satu bagian audio, dengan percobaan ulang saat kena batas laju.
 *
 * KENAPA KONEKSI DISAMBUNG ULANG: setelah kena 429, WebSocket milik instance
 * itu sudah ditutup pustakanya (`_closeSocket`). Memakai instance yang soketnya
 * sudah mati akan gagal terus, jadi sebelum mencoba lagi koneksinya dibuka
 * ulang lewat `sambung()`.
 *
 * @param {{tts: import('msedge-tts').MsEdgeTTS, bahasa: string}} e
 * @param {string} kalimat
 * @param {{pitch: string, rate: string}} opsi
 */
async function buatBagianTahan(e, kalimat, opsi) {
  let terakhir
  for (let ke = 1; ke <= COBA_ULANG; ke++) {
    try {
      return await buatBagian(e.tts, kalimat, opsi)
    } catch (err) {
      terakhir = err
      if (ke === COBA_ULANG || !layakDiulang(err)) throw err
      await new Promise((r) => setTimeout(r, JEDA_ULANG_MS * ke))
      await sambung(e).catch(() => {
        /* dibiarkan — percobaan berikutnya akan melaporkan galatnya sendiri */
      })
    }
  }
  throw terakhir
}


/**
 * Hasilkan audio MP3 dari teks, dengan nada mengikuti isi tiap kalimat.
 *
 * Memakai suara neural Microsoft (`msedge-tts`, WebSocket) — satu-satunya
 * jalur yang dipakai sekarang, lihat "KEPUTUSAN JAGI" di kepala berkas.
 *
 * Di serverless (Vercel) WebSocket tidak bisa hidup, jadi fungsi ini menyerah
 * lebih awal dengan pesan yang jujur daripada menunggu batas waktu habis.
 *
 * @param {string} teks
 * @param {{ bahasa?: string, jenis?: 'p'|'l' }} opsi
 * @returns {Promise<Buffer>}
 */
export async function buatSuara(teks, { bahasa = 'id', jenis = 'p' } = {}) {
  const kalimat = pecahKalimat(teks)
  if (!kalimat.length) throw new Error('Tidak ada teks untuk dibacakan.')

  // msedge-tts memakai WebSocket ke Microsoft, dan itu TIDAK MUNGKIN di fungsi
  // serverless. Jangan dicoba sama sekali: pengguna akan menunggu sampai batas
  // waktu habis hanya untuk mendapat kegagalan yang sudah pasti.
  if (process.env.VERCEL) {
    throw new Error(
      'Suara natural Microsoft tidak bisa dibuat di lingkungan ini (WebSocket tidak jalan di serverless). Di laptop/komputer sendiri jalur ini bekerja.',
    )
  }

  const hasil = new Array(kalimat.length)

  // Satu instance per pekerjaan: beberapa permintaan serentak pada satu
  // instance saling berebut koneksi WebSocket yang sama.
  let i = 0
  const pekerja = Array.from({ length: Math.min(SERENTAK, kalimat.length) }, async () => {
    const tts = new MsEdgeTTS()
    const e = { tts, bahasa, jenis }
    // Pembukaan koneksi ikut diulang: 429 bisa datang di sini, bukan cuma saat
    // mengirim kalimat (lihat sambung()).
    await sambung(e)
    try {
      while (i < kalimat.length) {
        const idx = i++
        const opsi = nadaKalimat(kalimat[idx], {
          pertama: idx === 0,
          terakhir: idx === kalimat.length - 1,
        })
        // Eja singkatan yang terbukti salah dibaca (DBD -> "D B D"). Dilakukan
        // SETELAH nada dipilih, supaya aturan nada tetap membaca kalimat aslinya.
        //
        // HANYA untuk suara Indonesia/Jawa/Sunda. Pada suara Inggris singkatan
        // seperti HIV sudah dibaca huruf per huruf dengan benar, jadi menyisipkan
        // spasi justru bisa merusaknya.
        const teksUcap = bahasa === 'en' ? kalimat[idx] : siapkanEjaan(kalimat[idx])
        // buatBagianTahan: ulangi saat kena 429, sambung ulang koneksinya.
        hasil[idx] = await buatBagianTahan(e, teksUcap, opsi)
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

/** Daftar suara msedge-tts per bahasa — dipakai rute sebagai petunjuk cadangan
 * saat suara natural gagal, jadi memang dipakai dari luar berkas ini. */
/**
 * Daftar suara yang tersedia, dalam bentuk yang siap dikirim ke antarmuka.
 *
 * Dikembalikan sebagai daftar datar (bukan matriks) supaya frontend bisa
 * menampilkannya tanpa perlu tahu bentuk internalnya.
 *
 * @returns {Array<{bahasa: string, jenis: 'p'|'l', nama: string, labelBahasa: string, labelJenis: string}>}
 */
export function daftarSuara() {
  const hasil = []
  for (const bahasa of BAHASA_SUARA) {
    for (const jenis of JENIS_SUARA) {
      hasil.push({
        bahasa,
        jenis,
        nama: SUARA[bahasa][jenis],
        labelBahasa: LABEL_SUARA[bahasa],
        labelJenis: LABEL_JENIS[jenis],
      })
    }
  }
  return hasil
}

/** Bentuk lama, tetap diekspor supaya tidak ada pemanggil yang rusak. */
export const DAFTAR_SUARA = SUARA
