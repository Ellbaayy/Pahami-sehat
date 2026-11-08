#!/usr/bin/env node
/**
 * Uji lapisan wilayah administratif — TANPA jaringan.
 *
 * Yang dijaga:
 *   1. Kode wilayah divalidasi bentuknya per tingkat (provinsi 2 digit,
 *      kabupaten 4, kecamatan 6, desa 10 — dengan titik).
 *   2. Kode induk diturunkan dari kode anak, bukan dari nama.
 *   3. Balasan mentah wilayah.id dinormalisasi jadi {kode, nama, tingkat}.
 *   4. Nominatim: memilih hasil yang benar (administrative / kantor kecamatan)
 *      dan MENOLAK yang salah (residential, school, police).
 *   5. Cascade koordinat berhenti di tingkat pertama yang berhasil, dan
 *      melaporkan tingkat presisi yang sebenarnya.
 *
 * Kenapa tanpa jaringan: runner CI tidak punya internet, dan uji tanpa jaringan
 * tidak boleh menyentuh layanan pihak ketiga (aturan proyek).
 */

import {
  kodeSah,
  indukDari,
  tingkatDariKode,
  normalisasiWilayah,
  pilihHasilNominatim,
  cascadeTitik,
} from './app/server/wilayah.js'

let lulus = 0
let gagal = 0
const cek = (nama, syarat, catatan = '') => {
  if (syarat) {
    lulus += 1
    console.log(`  ok    ${nama}`)
  } else {
    gagal += 1
    console.log(`  GAGAL ${nama}${catatan ? ` -> ${catatan}` : ''}`)
  }
}

console.log('\n== bentuk kode ==')
cek('provinsi 32 sah', kodeSah('32', 'provinsi'))
cek('kabupaten 32.16 sah', kodeSah('32.16', 'kabupaten'))
cek('kecamatan 32.16.16 sah', kodeSah('32.16.16', 'kecamatan'))
cek('desa 32.16.16.2001 sah', kodeSah('32.16.16.2001', 'desa'))
cek('kabupaten tanpa titik DITOLAK', !kodeSah('3216', 'kabupaten'))
cek('desa terlalu panjang DITOLAK', !kodeSah('32.16.16.20011', 'desa'))
cek('huruf DITOLAK', !kodeSah('32.AB', 'kabupaten'))
cek('kosong DITOLAK', !kodeSah('', 'provinsi'))
cek('SQL injection DITOLAK', !kodeSah("32' OR 1=1", 'kabupaten'))
cek('tingkat tidak dikenal DITOLAK', !kodeSah('32', 'kelurahan'))

console.log('\n== induk dari kode ==')
cek('induk 32.16 = 32', indukDari('32.16') === '32')
cek('induk 32.16.16 = 32.16', indukDari('32.16.16') === '32.16')
cek('induk 32.16.16.2001 = 32.16.16', indukDari('32.16.16.2001') === '32.16.16')
cek('induk provinsi = null', indukDari('32') === null)

console.log('\n== tingkat dari kode ==')
cek('2 digit = provinsi', tingkatDariKode('32') === 'provinsi')
cek('4 digit = kabupaten', tingkatDariKode('32.16') === 'kabupaten')
cek('6 digit = kecamatan', tingkatDariKode('32.16.16') === 'kecamatan')
cek('10 digit = desa', tingkatDariKode('32.16.16.2001') === 'desa')
cek('kode ngawur -> null', tingkatDariKode('32.16.16.16.16') === null)

console.log('\n== normalisasi balasan wilayah.id ==')
const n = normalisasiWilayah([{ code: '32', name: 'Jawa Barat' }], 'provinsi')
cek(
  'bentuk {kode, nama, tingkat}',
  JSON.stringify(n[0]) === JSON.stringify({ kode: '32', nama: 'Jawa Barat', tingkat: 'provinsi' }),
  JSON.stringify(n[0]),
)
cek('balasan bukan array -> kosong', normalisasiWilayah(null, 'provinsi').length === 0)
cek(
  'balasan {data:[...]} dibuka',
  normalisasiWilayah({ data: [{ code: '11', name: 'Aceh' }] }, 'provinsi').length === 1,
)
cek(
  'item tanpa code dibuang',
  normalisasiWilayah([{ name: 'X' }, { code: '11', name: 'Aceh' }], 'provinsi').length === 1,
)
cek('kode tidak sah dibuang', normalisasiWilayah([{ code: '3216', name: 'Salah' }], 'kabupaten').length === 0)
cek(
  'nama kosong dibuang',
  normalisasiWilayah([{ code: '11', name: '   ' }], 'provinsi').length === 0,
)

console.log('\n== pemilihan hasil Nominatim ==')
const hasilKec = [
  { class: 'place', type: 'residential', lat: '-6.3508196', lon: '107.1146194', display_name: 'Permata Cikarang Selatan' },
  { class: 'amenity', type: 'school', lat: '-6.3275160', lon: '107.1443302', display_name: 'SMP Negeri 2' },
  { class: 'amenity', type: 'police', lat: '-6.3448048', lon: '107.1559227', display_name: 'Polsek' },
  {
    class: 'amenity',
    type: 'government',
    lat: '-6.3530682',
    lon: '107.1188367',
    display_name: 'Kantor Kecamatan Cikarang Selatan',
  },
]
const pilih = pilihHasilNominatim(hasilKec, 'kecamatan')
cek('kecamatan: memilih kantor kecamatan', pilih?.lat === -6.3530682, String(pilih?.lat))
cek('kecamatan: MENOLAK residential', pilih?.nama.includes('Kantor') === true)
cek(
  'kecamatan: tanpa kantor -> null',
  pilihHasilNominatim([hasilKec[0], hasilKec[1]], 'kecamatan') === null,
)

const hasilProv = [
  {
    class: 'boundary',
    type: 'administrative',
    lat: '-6.8891904',
    lon: '107.6404716',
    display_name: 'Jawa Barat, Indonesia',
  },
]
cek('provinsi: memilih administrative', pilihHasilNominatim(hasilProv, 'provinsi')?.lat === -6.8891904)
cek(
  'provinsi: menolak non-administrative',
  pilihHasilNominatim([{ type: 'residential', lat: '1', lon: '1', display_name: 'x' }], 'provinsi') === null,
)
cek('koordinat di luar bumi ditolak', pilihHasilNominatim([{ type: 'administrative', lat: '999', lon: '1' }], 'provinsi') === null)
cek('daftar kosong -> null', pilihHasilNominatim([], 'provinsi') === null)

console.log('\n== cascade koordinat ==')
const panggil = async (tingkat) => {
  if (tingkat === 'desa') return null
  if (tingkat === 'kecamatan') {
    return { lat: -6.3530682, lon: 107.1188367, label: 'Kantor Kecamatan Cikarang Selatan' }
  }
  throw new Error('tidak seharusnya sampai sini')
}
const c = await cascadeTitik(
  { kode: '32.16.16.2001', nama: 'Jayabakti', tingkat: 'desa' },
  {
    provinsi: 'Jawa Barat',
    kabupaten: 'Kabupaten Bekasi',
    kecamatan: 'Cikarang Selatan',
    desa: 'Jayabakti',
  },
  panggil,
)
cek('desa gagal -> jatuh ke kecamatan', c?.presisi === 'kecamatan', String(c?.presisi))
cek('cascade melaporkan presisi sebenarnya', c?.presisi !== 'desa')
cek('cascade menyertakan label', typeof c?.label === 'string')

const semuaGagal = await cascadeTitik(
  { kode: '32.16.16.2001', nama: 'Jayabakti', tingkat: 'desa' },
  {
    provinsi: 'Jawa Barat',
    kabupaten: 'Kabupaten Bekasi',
    kecamatan: 'Cikarang Selatan',
    desa: 'Jayabakti',
  },
  async () => null,
)
cek('semua tingkat gagal -> null (bukan koordinat karangan)', semuaGagal === null)

const naikKeProvinsi = await cascadeTitik(
  { kode: '32.16.16.2001', nama: 'Jayabakti', tingkat: 'desa' },
  {
    provinsi: 'Jawa Barat',
    kabupaten: 'Kabupaten Bekasi',
    kecamatan: 'Cikarang Selatan',
    desa: 'Jayabakti',
  },
  async (tingkat) => (tingkat === 'provinsi' ? { lat: -6.8891904, lon: 107.6404716, label: 'Jawa Barat' } : null),
)
cek('semua gagal kecuali provinsi -> presisi provinsi', naikKeProvinsi?.presisi === 'provinsi', String(naikKeProvinsi?.presisi))

const melempar = await cascadeTitik(
  { kode: '32', nama: 'Jawa Barat', tingkat: 'provinsi' },
  { provinsi: 'Jawa Barat', kabupaten: '', kecamatan: '', desa: '' },
  async () => {
    throw new Error('jaringan putus')
  },
)
cek('panggil melempar -> null, tidak ikut melempar', melempar === null)

/*
 * REGRESI 8 Nov 2026: kueri "Kantor Kecamatan X, Kota Y" TIDAK ditemukan
 * Nominatim untuk banyak kecamatan (Danurejan terukur kosong). Dulu itu
 * membuat setiap pilihan kecamatan jatuh ke titik pusat KOTA — peta bergeser
 * dan daftar fasilitas menampilkan wilayah yang salah, tanpa galat apa pun.
 * Sekarang cascade harus mencoba bentuk lain dan tetap berhenti di kecamatan.
 */
const kueriDicoba = []
const hanyaPolos = await cascadeTitik(
  { kode: '34.71.04', nama: 'Danurejan', tingkat: 'kecamatan' },
  { provinsi: 'DI Yogyakarta', kabupaten: 'Kota Yogyakarta', kecamatan: 'Danurejan', desa: '' },
  async (tingkat, kueri) => {
    kueriDicoba.push(kueri)
    // Hanya bentuk polos ("Danurejan, Kota Yogyakarta") yang menjawab.
    if (tingkat === 'kecamatan' && kueri === 'Danurejan, Kota Yogyakarta') {
      return { lat: -7.7931435, lon: 110.3676732, label: 'Danurejan, Kota Yogyakarta' }
    }
    return null
  },
)
cek('kecamatan: bentuk kueri lain dicoba sebelum menyerah', kueriDicoba.length >= 2, kueriDicoba.join(' | '))
cek('kecamatan: berhenti di kecamatan, bukan jatuh ke kota', hanyaPolos?.presisi === 'kecamatan', String(hanyaPolos?.presisi))
cek('kecamatan: koordinat dari kueri polos dipakai', hanyaPolos?.lat === -7.7931435, String(hanyaPolos?.lat))
const kueriKantor = []
const hanyaKantor = await cascadeTitik(
  { kode: '34.71.04', nama: 'Danurejan', tingkat: 'kecamatan' },
  { provinsi: 'DI Yogyakarta', kabupaten: 'Kota Yogyakarta', kecamatan: 'Danurejan', desa: '' },
  async (tingkat, kueri) => {
    kueriKantor.push(kueri)
    // Hanya bentuk "Kantor Kecamatan ..." yang menjawab.
    if (kueri.startsWith('Kantor Kecamatan')) {
      return { lat: -7.7931, lon: 110.3676, label: 'Kantor Kecamatan Danurejan' }
    }
    return null
  },
)
cek(
  'kecamatan: "Kantor Kecamatan" tetap dicoba sebagai usaha terakhir',
  kueriKantor.some((k) => k.startsWith('Kantor Kecamatan')),
  kueriKantor.join(' | '),
)
cek('kecamatan: hasil dari bentuk kantor dipakai', hanyaKantor?.presisi === 'kecamatan', String(hanyaKantor?.presisi))

console.log('')
console.log(gagal === 0 ? `SEMUA LULUS — ${lulus} pemeriksaan` : `${lulus} lulus, ${gagal} GAGAL`)
process.exit(gagal === 0 ? 0 : 1)
