/**
 * Statistik fasilitas kesehatan nasional — angka acuan, bukan hasil pemetaan.
 * ============================================================================
 *
 * KENAPA BERKAS INI ADA
 * ---------------------
 * Peta fasilitas di aplikasi ini menyajikan hasil pemetaan OpenStreetMap
 * (7.114 titik terukur 7 Nov 2026). Angka itu TIDAK bisa dipakai untuk
 * menjawab "berapa jumlah puskesmas di Indonesia" — OSM tidak lengkap, dan
 * ketidaklengkapan itu berbeda-beda tiap daerah.
 *
 * Jadi angka resmi disimpan terpisah, apa adanya, lengkap dengan kalimat
 * cakupannya. Dua-duanya benar untuk pertanyaan yang berbeda.
 *
 * ============================================================================
 * PERINGATAN YANG HARUS IKUT KE MANA-MANA
 * ============================================================================
 *
 * 49.548 BUKAN jumlah seluruh fasilitas kesehatan nasional. Itu jumlah
 * fasilitas pada enam kategori di bawah yang SUDAH MENGIMPLEMENTASIKAN sistem
 * data dan aplikasi kesehatan (laporan Kemenkes 2024). Fasilitas yang belum
 * tersambung sistem tidak ikut dihitung, sehingga angka sebenarnya lebih
 * besar.
 *
 * Kalimat itu disimpan di `cakupan` pada setiap baris, bukan hanya di kepala
 * berkas ini: angka tanpa cakupan gampang dikutip sebagai "total faskes
 * Indonesia" di slide atau di jawaban model — dan itu salah.
 *
 * SUMBER
 * ------
 * - Kemenkes, laporan 2024: fasilitas yang telah mengimplementasikan sistem
 *   data dan aplikasi kesehatan (6 kategori, total 49.548).
 * - BPJS Kesehatan, posisi September 2026: 23.862 FKTP, 3.221 RS/Klinik
 *   Utama, 6.631 apotek/optik.
 *
 * Angka BPJS adalah PEMBANDING, bukan rincian dari angka Kemenkes: cakupan
 * dan cara hitungnya berbeda (BPJS menghitung yang bekerja sama dengan
 * jaminan kesehatan), jadi JANGAN dijumlahkan dengan angka Kemenkes.
 */

/** Kalimat cakupan untuk angka Kemenkes 2024. */
export const CAKUPAN_KEMENKES =
  'Fasilitas yang telah mengimplementasikan sistem data dan aplikasi kesehatan — bukan jumlah seluruh fasilitas kesehatan nasional.'

/** Kalimat cakupan untuk angka BPJS Kesehatan. */
export const CAKUPAN_BPJS =
  'Fasilitas yang tercatat bekerja sama dengan BPJS Kesehatan — pembanding, bukan rincian dari angka Kemenkes.'

/**
 * Angka Kemenkes 2024.
 * `kodeKategori` mengaitkan ke `kategori_fasilitas.kode` bila padanannya ada;
 * null berarti kategori laporan ini tidak punya padanan di peta OSM
 * (mis. unit transfusi darah tidak dipetakan sebagai kategori tersendiri).
 */
export const STATISTIK_KEMENKES = [
  { jenis: 'Rumah sakit', jumlah: 3681, kodeKategori: 'rumah-sakit' },
  { jenis: 'Puskesmas', jumlah: 11542, kodeKategori: 'puskesmas' },
  { jenis: 'Laboratorium kesehatan', jumlah: 602, kodeKategori: 'laboratorium' },
  { jenis: 'Klinik', jumlah: 18590, kodeKategori: 'klinik' },
  { jenis: 'Praktik mandiri', jumlah: 15060, kodeKategori: 'praktik-mandiri' },
  { jenis: 'Unit transfusi darah', jumlah: 73, kodeKategori: null },
]

/** Angka BPJS Kesehatan, posisi September 2026. */
export const STATISTIK_BPJS = [
  { jenis: 'FKTP', jumlah: 23862, catatan: 'Fasilitas Kesehatan Tingkat Pertama' },
  { jenis: 'RS/Klinik Utama', jumlah: 3221, catatan: null },
  { jenis: 'Apotek/Optik', jumlah: 6631, catatan: null },
]

/**
 * Sumber data resmi yang dipakai untuk pengembangan.
 *
 * `data` mencatat APA yang tersedia di sana — bukan angka. Angka hanya masuk
 * `statistik_faskes` kalau memang sudah dibaca dari sumbernya; menyalin angka
 * dari ingatan adalah cara paling gampang menanam kesalahan yang tidak pernah
 * memunculkan galat.
 *
 * `tautan` sengaja null: alamat pastinya belum diperiksa satu per satu, dan
 * menebak URL resmi lebih buruk daripada mengosongkannya.
 */
export const SUMBER_DATA = [
  {
    nama: 'Profil Kesehatan Indonesia 2025',
    penerbit: 'Kemenkes RI',
    jenis: 'profil',
    data: 'Statistik kesehatan nasional',
    catatan: 'Laporan tahunan profil kesehatan nasional.',
  },
  {
    nama: 'Statistik Fasilitas Kesehatan 2025',
    penerbit: 'BPS',
    jenis: 'statistik',
    data: 'Rumah sakit dan puskesmas menurut provinsi',
    catatan: 'Publikasi statistik fasilitas kesehatan Badan Pusat Statistik.',
  },
  {
    nama: 'SATUSEHAT Data',
    penerbit: 'Kemenkes RI',
    jenis: 'dashboard',
    data: 'Dashboard dan dataset kesehatan',
    catatan: 'Platform data kesehatan Kemenkes.',
  },
  {
    nama: 'Data Faskes Mitra JKN',
    penerbit: 'BPJS Kesehatan',
    jenis: 'statistik',
    data: 'Jumlah faskes mitra JKN',
    catatan: 'Fasilitas yang bekerja sama dengan program jaminan kesehatan.',
  },
]

/** Jumlah seluruh kategori Kemenkes. Dihitung, bukan ditulis — supaya tidak bisa melenceng. */
export function totalKemenkes() {
  return STATISTIK_KEMENKES.reduce((n, b) => n + b.jumlah, 0)
}

/**
 * Cari statistik berdasarkan potongan nama jenis atau lembaga.
 * Dipakai `node impor-statistik-faskes.mjs --cari <kata>` supaya pencarian
 * tidak perlu membuka mysql.
 */
export function cariStatistik(kata) {
  const q = String(kata ?? '').trim().toLowerCase()
  if (!q) return []
  const semua = [
    ...STATISTIK_KEMENKES.map((b) => ({ lembaga: 'Kemenkes', periode: '2024', cakupan: CAKUPAN_KEMENKES, ...b })),
    ...STATISTIK_BPJS.map((b) => ({ lembaga: 'BPJS Kesehatan', periode: 'September 2026', cakupan: CAKUPAN_BPJS, ...b })),
  ]
  return semua.filter(
    (b) =>
      b.jenis.toLowerCase().includes(q) ||
      b.lembaga.toLowerCase().includes(q) ||
      String(b.kodeKategori ?? '').includes(q),
  )
}

/** Bentuk siap saji untuk endpoint /api/statistik-faskes. */
export function ringkasanStatistik() {
  return {
    kemenkes: {
      periode: '2024',
      lembaga: 'Kemenkes',
      cakupan: CAKUPAN_KEMENKES,
      baris: STATISTIK_KEMENKES.map((b) => ({ ...b })),
      total: totalKemenkes(),
    },
    bpjs: {
      periode: 'September 2026',
      lembaga: 'BPJS Kesehatan',
      cakupan: CAKUPAN_BPJS,
      baris: STATISTIK_BPJS.map((b) => ({ ...b })),
      total: STATISTIK_BPJS.reduce((n, b) => n + b.jumlah, 0),
    },
    sumberData: SUMBER_DATA.map((s) => ({ ...s })),
  }
}
