#!/usr/bin/env node
/**
 * Uji geocoding alamat + deteksi wilayah administratif — TANPA jaringan.
 * ============================================================================
 *
 * Yang diuji adalah LOGIKA, bukan layanan Nominatim: seluruh `address` di bawah
 * adalah bentuk NYATA yang benar-benar dikembalikan Nominatim pada 4 Nov 2026,
 * dikutip apa adanya. Dengan begitu uji bisa jalan di CI tanpa internet dan
 * tanpa bergantung pada ketersediaan layanan publik.
 *
 * Kenapa ini penting: setiap kasus di bawah PERNAH GAGAL di kode sungguhan, dan
 * kegagalannya tidak terlihat dari build hijau maupun uji lain:
 *
 *   - Monas: `city` berisi "Daerah Khusus Ibukota Jakarta" (provinsi), dan kota
 *     administrasinya ada di `city_district`. Versi pertama salah menaruh
 *     `city_district` di daftar kunci KABUPATEN, sehingga Malioboro kehilangan
 *     kotanya.
 *   - Malioboro: setelah `city_district` dipindah ke daftar kecamatan, kota
 *     "Kota Yogyakarta" dibuang oleh penjagaan "nama provinsi" — karena
 *     "Daerah Istimewa Yogyakarta" dan "Kota Yogyakarta" sama-sama menjadi
 *     "yogyakarta" setelah normalisasi.
 *   - Kuta: kabupaten hanya ada di `region` = "Badung", tanpa city/county.
 *   - Depok/Surabaya: Nominatim membuang awalan "Kota".
 *
 * Pemakaian: node uji-geocoding.mjs
 */

import { existsSync } from 'node:fs'
import { deteksiWilayah, tingkatKetepatan, normalNama, pisahJenis, ISO_PROVINSI } from './app/server/geocoding.js'

let lulus = 0
let gagal = 0
const cek = (nama, ok, bukti = '') => {
  if (ok) lulus++
  else gagal++
  console.log(`  ${ok ? 'ok   ' : 'GAGAL'} ${nama}${bukti ? `  — ${bukti}` : ''}`)
}

/*
 * Tabel wilayah minimal untuk uji.
 *
 * Isinya SENGAJA kecil dan ditulis tangan, bukan diambil dari database: uji ini
 * harus jalan tanpa MySQL. Nilainya disalin dari `wilayah` yang berasal dari
 * wilayah.id, jadi nama dan kodenya sama dengan yang dipakai aplikasi.
 */
const tabel = {
  provinsi: [
    { kode: '31', nama: 'DKI Jakarta' },
    { kode: '32', nama: 'Jawa Barat' },
    { kode: '33', nama: 'Jawa Tengah' },
    { kode: '34', nama: 'Daerah Istimewa Yogyakarta' },
    { kode: '35', nama: 'Jawa Timur' },
    { kode: '36', nama: 'Banten' },
    { kode: '51', nama: 'Bali' },
    { kode: '73', nama: 'Sulawesi Selatan' },
  ],
  kabupaten: [
    { kode: '31.71', nama: 'Kota Administrasi Jakarta Pusat', kode_induk: '31' },
    { kode: '31.74', nama: 'Kota Administrasi Jakarta Selatan', kode_induk: '31' },
    { kode: '32.16', nama: 'Kabupaten Bekasi', kode_induk: '32' },
    { kode: '32.71', nama: 'Kota Bogor', kode_induk: '32' },
    { kode: '32.75', nama: 'Kota Bekasi', kode_induk: '32' },
    { kode: '32.76', nama: 'Kota Depok', kode_induk: '32' },
    { kode: '32.73', nama: 'Kota Bandung', kode_induk: '32' },
    { kode: '34.71', nama: 'Kota Yogyakarta', kode_induk: '34' },
    { kode: '35.78', nama: 'Kota Surabaya', kode_induk: '35' },
    { kode: '36.03', nama: 'Kabupaten Tangerang', kode_induk: '36' },
    { kode: '51.03', nama: 'Kabupaten Badung', kode_induk: '51' },
    { kode: '73.71', nama: 'Kota Makassar', kode_induk: '73' },
  ],
  kecamatan: [
    { kode: '31.71.01', nama: 'Gambir', kode_induk: '31.71' },
    { kode: '34.71.12', nama: 'Gedongtengen', kode_induk: '34.71' },
    { kode: '35.78.08', nama: 'Gubeng', kode_induk: '35.78' },
    { kode: '32.73.11', nama: 'Lengkong', kode_induk: '32.73' },
    { kode: '32.76.06', nama: 'Beji', kode_induk: '32.76' },
    { kode: '73.71.01', nama: 'Ujung Pandang', kode_induk: '73.71' },
    { kode: '51.03.01', nama: 'Kuta', kode_induk: '51.03' },
  ],
}

/* ------------------------------------------------------------ peta ISO -- */

console.log('== peta ISO 3166-2 -> kode provinsi BPS ==')
{
  // 38 provinsi. Angka ini diuji terhadap Nominatim sungguhan: 38 kota
  // provinsi diminta satu per satu, dan ke-38 kode ISO-nya cocok.
  cek('jumlah entri ISO = 38', Object.keys(ISO_PROVINSI).length === 38, String(Object.keys(ISO_PROVINSI).length))
  const contoh = [
    ['ID-JK', '31'],
    ['ID-JB', '32'],
    ['ID-JT', '33'],
    ['ID-YO', '34'],
    ['ID-JI', '35'],
    ['ID-BA', '51'],
    ['ID-PS', '93'],
    ['ID-PD', '96'],
  ]
  for (const [iso, harap] of contoh) cek(`${iso} -> ${harap}`, ISO_PROVINSI[iso] === harap, ISO_PROVINSI[iso])
  cek('tidak ada kode provinsi ganda', new Set(Object.values(ISO_PROVINSI)).size === 38)
}

/* ------------------------------------------------------- normalisasi ---- */

console.log('')
console.log('== normalisasi nama wilayah ==')
{
  const kasus = [
    ['Bekasi', 'kabupaten|bekasi'],
    ['Kota Bekasi', 'kota|bekasi'],
    ['Kab. Bandung', 'kabupaten|bandung'],
    ['Kabupaten Bandung', 'kabupaten|bandung'],
    ['Kota Administrasi Jakarta Pusat', 'kota|jakarta pusat'],
    ['Jakarta Pusat', 'kabupaten|jakarta pusat'],
  ]
  for (const [masuk, harap] of kasus) {
    const h = `${pisahJenis(masuk).jenis}|${pisahJenis(masuk).nama}`
    cek(`"${masuk}" -> ${harap}`, h === harap, h)
  }
}

/* ------------------------------------------- deteksi: kasus NYATA ------- */

console.log('')
console.log('== deteksi wilayah: bentuk address Nominatim yang nyata ==')
const KASUS = [
  {
    nama: 'Malioboro (DIY)',
    address: {
      commercial: 'Slasar Malioboro',
      village: 'Sosromenduran',
      city_district: 'Gedongtengen',
      city: 'Kota Yogyakarta',
      district: 'Depok',
      state: 'Daerah Istimewa Yogyakarta',
      'ISO3166-2-lvl4': 'ID-YO',
      postcode: '55271',
    },
    harap: { provinsi: 'Daerah Istimewa Yogyakarta', kabupaten: 'Kota Yogyakarta', kecamatan: 'Gedongtengen', tingkat: 'kecamatan' },
  },
  {
    nama: 'Monas (DKI)',
    address: {
      building: 'Monumen Nasional',
      road: 'Jalan Medan Merdeka Utara',
      city_block: 'RW 02',
      neighbourhood: 'Gambir',
      suburb: 'Gambir',
      city_district: 'Jakarta Pusat',
      city: 'Daerah Khusus Ibukota Jakarta',
      'ISO3166-2-lvl4': 'ID-JK',
    },
    harap: { provinsi: 'DKI Jakarta', kabupaten: 'Kota Administrasi Jakarta Pusat', kecamatan: 'Gambir', tingkat: 'kecamatan' },
  },
  {
    nama: 'UI Depok (Jabar)',
    address: {
      amenity: 'Universitas Indonesia',
      village: 'Pondok Cina',
      city: 'Depok',
      state: 'Jawa Barat',
      'ISO3166-2-lvl4': 'ID-JB',
      postcode: '16424',
    },
    // "Depok" tanpa awalan "Kota" harus tetap bertemu "Kota Depok".
    harap: { provinsi: 'Jawa Barat', kabupaten: 'Kota Depok', tingkat: 'kabupaten' },
  },
  {
    nama: 'RSUD Soetomo (Jatim)',
    address: {
      amenity: 'RSUD Dr. Soetomo',
      municipality: 'Gubeng',
      city: 'Surabaya',
      state: 'Jawa Timur',
      'ISO3166-2-lvl4': 'ID-JI',
    },
    harap: { provinsi: 'Jawa Timur', kabupaten: 'Kota Surabaya', kecamatan: 'Gubeng', tingkat: 'kecamatan' },
  },
  {
    nama: 'Kuta (Bali) — kabupaten di `region`',
    address: { state: 'Bali', region: 'Badung', town: 'Kuta', 'ISO3166-2-lvl4': 'ID-BA' },
    harap: { provinsi: 'Bali', kabupaten: 'Kabupaten Badung', kecamatan: 'Kuta', tingkat: 'kecamatan' },
  },
  {
    nama: 'Asia Afrika (Bandung)',
    address: {
      city: 'Kota Bandung',
      district: 'Lengkong',
      suburb: 'Burangrang',
      residential: 'Apartemen Grand Asia Afrika',
      state: 'Jawa Barat',
      'ISO3166-2-lvl4': 'ID-JB',
    },
    harap: { provinsi: 'Jawa Barat', kabupaten: 'Kota Bandung', kecamatan: 'Lengkong', tingkat: 'kecamatan' },
  },
  {
    nama: 'Losari (Makassar)',
    address: {
      tourism: 'Pantai Losari',
      suburb: 'Ujung Pandang',
      city: 'Makassar',
      state: 'Sulawesi Selatan',
      'ISO3166-2-lvl4': 'ID-SN',
    },
    harap: { provinsi: 'Sulawesi Selatan', kabupaten: 'Kota Makassar', kecamatan: 'Ujung Pandang', tingkat: 'kecamatan' },
  },
]

for (const k of KASUS) {
  const h = deteksiWilayah(k.address, tabel)
  const cocokSemua = Object.entries(k.harap).every(([key, v]) => h[key] === v)
  cek(
    k.nama,
    cocokSemua,
    `${h.provinsi ?? '-'} / ${h.kabupaten ?? '-'} / ${h.kecamatan ?? '-'} (${h.tingkat})`,
  )
}

/* --------------------------------------------- jangan menebak wilayah -- */

console.log('')
console.log('== tidak menebak saat ambigu atau tidak ada kode ==')
{
  // "Bekasi" bisa Kabupaten (32.16) atau Kota (32.75). Tanpa awalan jenis,
  // keduanya sah — jadi TIDAK BOLEH dipilih salah satu.
  const h = deteksiWilayah({ city: 'Bekasi', state: 'Jawa Barat', 'ISO3166-2-lvl4': 'ID-JB' }, tabel)
  cek('"Bekasi" ambigu -> kabupaten kosong', h.kabupaten === null, String(h.kabupaten))
  cek('"Bekasi" ambigu -> provinsi tetap dikenali', h.provinsi === 'Jawa Barat', String(h.provinsi))

  // Alamat tanpa provinsi sama sekali.
  const h2 = deteksiWilayah({ road: 'Jalan Tanpa Nama' }, tabel)
  cek('tanpa provinsi -> dikenal = false', h2.dikenal === false)
  cek('tanpa provinsi -> tingkat tidak_dikenal', h2.tingkat === 'tidak_dikenal', h2.tingkat)

  // Koordinat saja, tanpa address.
  const h3 = deteksiWilayah({}, tabel)
  cek('address kosong tidak melempar', h3 && h3.tingkat === 'tidak_dikenal')

  // Kota yang namanya SAMA dengan provinsi (Yogyakarta) harus tetap dikenali
  // sebagai kota, bukan dibuang sebagai "nama provinsi".
  const h4 = deteksiWilayah(
    { city: 'Kota Yogyakarta', state: 'Daerah Istimewa Yogyakarta', 'ISO3166-2-lvl4': 'ID-YO' },
    tabel,
  )
  cek('"Kota Yogyakarta" bukan dianggap nama provinsi', h4.kabupaten === 'Kota Yogyakarta', String(h4.kabupaten))
}

/* -------------------------------------------------------- ketepatan ---- */

console.log('')
console.log('== tingkat ketepatan titik ==')
{
  const kasus = [
    [{ addresstype: 'building', type: 'yes' }, 'titik'],
    [{ addresstype: 'amenity', type: 'university' }, 'titik'],
    [{ addresstype: 'road', type: 'secondary' }, 'jalan'],
    [{ addresstype: 'village', type: 'village' }, 'kelurahan'],
    [{ addresstype: 'city', type: 'city' }, 'kabupaten'],
    [{ addresstype: 'state', type: 'state' }, 'provinsi'],
    [{ addresstype: 'zzz', type: 'zzz' }, 'lain'],
  ]
  for (const [masuk, harap] of kasus) {
    cek(`${masuk.addresstype} -> ${harap}`, tingkatKetepatan(masuk) === harap, tingkatKetepatan(masuk))
  }
}

/* ------------------------------------------- konsistensi dengan berkas -- */

console.log('')
console.log('== normalisasi sama dengan petakan-wilayah.mjs ==')
{
  // Dua salinan aturan normalisasi itu berbahaya kalau menyimpang. Berkas
  // petakan-wilayah.mjs ada di akar repo dan menyeret mysql2, jadi tidak
  // diimpor di server — tetapi uji ini membandingkan hasilnya.
  const jalur = new URL('./petakan-wilayah.mjs', import.meta.url)
  if (existsSync(jalur)) {
    const m = await import('./petakan-wilayah.mjs')
    const contoh = ['Bekasi', 'Kota Bekasi', 'Kab. Bandung', 'Daerah Istimewa Yogyakarta', 'Kota Administrasi Jakarta Pusat']
    let sama = 0
    for (const c of contoh) {
      if (m.kunciJenis(c).replace(/\|/g, '|') === `${pisahJenis(c).jenis}|${normalNama(c)}`) sama++
    }
    cek(`dua salinan normalisasi sepakat (${sama}/${contoh.length})`, sama === contoh.length, `${sama}/${contoh.length}`)
  } else {
    console.log('  lewati  petakan-wilayah.mjs tidak ditemukan')
  }
}

console.log('')
console.log(gagal === 0 ? `SEMUA LULUS — ${lulus} pemeriksaan` : `${lulus} lulus, ${gagal} GAGAL`)
process.exit(gagal === 0 ? 0 : 1)
