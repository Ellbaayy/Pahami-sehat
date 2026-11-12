/**
 * Uji perencana pembersihan duplikat fasilitas — TANPA database, TANPA jaringan.
 *
 * KENAPA ADA: `bersihkan-duplikat-faskes.mjs` MENGHAPUS baris. Aturan yang salah
 * di sana tidak memunculkan galat apa pun — ia hanya menghapus fasilitas yang
 * sebenarnya berbeda. Karena itu aturannya dipisah ke fungsi murni
 * (`app/server/dedupFaskes.js`) dan diuji di sini sebelum menyentuh data.
 *
 * Yang dijaga:
 *   1. duplikat way/node OSM (nama sama, koordinat hampir sama) → dihapus;
 *   2. dua fasilitas sama nama tetapi berjauhan → TIDAK dihapus;
 *   3. nama generik pendek ("posyandu") → hanya digabung bila praktis satu titik;
 *   4. baris SIRS tanpa koordinat TIDAK PERNAH dianggap duplikat sesamanya
 *      (jebakan `Number(null) === 0` yang pernah membuat dry run pertama salah);
 *   5. lintas sumber: SIRS + OSM dengan nama & kabupaten sama → OSM dihapus,
 *      koordinatnya dipindahkan ke baris SIRS;
 *   6. beda kabupaten → tidak digabung;
 *   7. baris paling lengkap yang dipertahankan;
 *   8. tidak ada baris yang dihapus sekaligus dijadikan tujuan penggabungan;
 *   9. angka ringkasan konsisten (total = sisa + dihapus).
 */

import { jarakMeter, normalkan, rencanakanDedup } from './app/server/dedupFaskes.js'

let lulus = 0
let gagal = 0
const cek = (nama, syarat, bukti = '') => {
  if (syarat) {
    lulus += 1
    console.log('  ok    ' + nama + (bukti ? `  — ${bukti}` : ''))
  } else {
    gagal += 1
    console.log('  GAGAL ' + nama + (bukti ? `  — ${bukti}` : ''))
  }
}

const baris = (id, nama, sumber, lat, lon, kab = 'Kota X', prov = 'Provinsi X', ekstra = {}) => ({
  id,
  nama,
  sumber,
  lat,
  lon,
  kabupaten: kab,
  provinsi: prov,
  ...ekstra,
})

console.log('== normalisasi & jarak ==')
cek('nama dinormalkan (huruf kecil, spasi rapat)', normalkan('  RS  Umum   Mitra ') === 'rs umum mitra')
cek('jarak titik sama = 0 m', jarakMeter({ lat: -6.2, lon: 106.8 }, { lat: -6.2, lon: 106.8 }) === 0)
cek('tanpa koordinat → jarak tak berhingga', jarakMeter({ lat: null, lon: null }, { lat: null, lon: null }) === Infinity)
cek('koordinat kosong string → tak berhingga', jarakMeter({ lat: '', lon: '' }, { lat: -6.2, lon: 106.8 }) === Infinity)
cek(
  'dua titik berjarak ±111 km pada 1 derajat lintang',
  Math.abs(jarakMeter({ lat: 0, lon: 0 }, { lat: 1, lon: 0 }) - 111195) < 500,
  String(Math.round(jarakMeter({ lat: 0, lon: 0 }, { lat: 1, lon: 0 }))),
)

console.log('\n== aturan dalam satu sumber ==')
{
  const r = rencanakanDedup([
    baris(1, 'RS Hermina Makassar', 'OpenStreetMap', -5.1627435, 119.4574803),
    baris(2, 'RS HERMINA MAKASSAR', 'OpenStreetMap', -5.1628043, 119.4576287),
  ])
  cek('way+node OSM (10 m, nama sama) → satu dihapus', r.hapus.length === 1, `hapus ${r.hapus.length}`)
  cek('yang dihapus adalah id 2 (id lebih besar, isian sama)', r.hapus[0]?.id === 2)
}
{
  const r = rencanakanDedup([
    baris(1, 'Apotek K-24', 'OpenStreetMap', -6.2, 106.8),
    baris(2, 'Apotek K-24', 'OpenStreetMap', -6.25, 106.85),
  ])
  cek('nama sama tetapi berjauhan (±7 km) → TIDAK dihapus', r.hapus.length === 0)
}
{
  const r = rencanakanDedup([
    baris(1, 'posyandu', 'OpenStreetMap', -6.2, 106.8),
    baris(2, 'posyandu', 'OpenStreetMap', -6.2002, 106.8002),
  ])
  cek('nama generik pendek, 30 m → TIDAK dihapus', r.hapus.length === 0)
  const r2 = rencanakanDedup([
    baris(1, 'posyandu', 'OpenStreetMap', -6.2, 106.8),
    baris(2, 'posyandu', 'OpenStreetMap', -6.200001, 106.800001),
  ])
  cek('nama generik pendek, titik yang sama → dihapus', r2.hapus.length === 1)
  const r3 = rencanakanDedup([
    baris(1, 'Puskesmas', 'OpenStreetMap', -6.2, 106.8),
    baris(2, 'Puskesmas', 'OpenStreetMap', -6.2002, 106.8002),
  ])
  cek('nama generik 9 huruf (puskesmas), 30 m → TIDAK dihapus', r3.hapus.length === 0)
}
{
  const r = rencanakanDedup([
    baris(1, 'RS Umum Permata Hati', 'SIRS Kemenkes', null, null),
    baris(2, 'RS Umum Permata Hati', 'SIRS Kemenkes', null, null),
  ])
  cek('dua baris SIRS tanpa koordinat → TIDAK dihapus (jebakan Number(null))', r.hapus.length === 0)
}
{
  const r = rencanakanDedup([
    baris(1, 'Klinik Sehat', 'OpenStreetMap', -6.2, 106.8, 'Kota X', 'Provinsi X', { alamat: 'Jl. A' }),
    baris(2, 'Klinik Sehat', 'OpenStreetMap', -6.20001, 106.80001),
  ])
  cek('baris paling lengkap yang dipertahankan', r.hapus.length === 1 && r.hapus[0].id === 2)
}

console.log('\n== aturan lintas sumber ==')
{
  const r = rencanakanDedup([
    baris(10, 'RS Advent Manado', 'SIRS Kemenkes', null, null, 'Kota Manado', 'Sulawesi Utara', { kode_rs: '7171083' }),
    baris(11, 'RS Advent Manado', 'OpenStreetMap', 1.4748, 124.8421, 'Kota Manado', 'Sulawesi Utara', { kode_osm: 'way/783818872' }),
  ])
  cek('SIRS + OSM (nama & kabupaten sama) → OSM dihapus', r.hapus.length === 1 && r.hapus[0].id === 11)
  cek('koordinat dipindahkan ke baris SIRS', r.gabung.length === 1 && r.gabung[0].id === 10 && r.gabung[0].lat === 1.4748)
  cek('kode_osm dicatat sebagai rujukan koordinat', r.gabung[0]?.kodeOsm === 'way/783818872')
}
{
  const r = rencanakanDedup([
    baris(10, 'RS Sehat', 'SIRS Kemenkes', null, null, 'Kota A'),
    baris(11, 'RS Sehat', 'OpenStreetMap', -6.2, 106.8, 'Kota B'),
  ])
  cek('beda kabupaten → TIDAK digabung', r.hapus.length === 0 && r.gabung.length === 0)
}
{
  const r = rencanakanDedup([
    baris(10, 'RS Sari Asih Bintaro', 'SIRS Kemenkes', null, null, 'Kota Tangerang Selatan'),
    baris(11, 'RS Sari Asih Bintaro', 'OpenStreetMap', -6.27, 106.72, 'Kota Tangerang Selatan'),
    baris(12, 'RS Sari Asih Bintaro', 'OpenStreetMap', -6.2701, 106.7201, 'Kota Tangerang Selatan'),
  ])
  cek('1 SIRS + 2 OSM → sisa satu baris SIRS', r.hapus.length === 2 && r.ringkasan.sisa === 1)
  cek('tidak ada baris yang dihapus sekaligus jadi tujuan gabung', !r.hapus.some((h) => r.gabung.some((g) => g.id === h.id)))
}
{
  const r = rencanakanDedup([
    baris(10, 'RS Tanpa Koordinat OSM', 'SIRS Kemenkes', null, null),
    baris(11, 'RS Tanpa Koordinat OSM', 'OpenStreetMap', null, null),
  ])
  cek('OSM tanpa koordinat tetap dihapus, tanpa penggabungan koordinat', r.hapus.length === 1 && r.gabung.length === 0)
}

console.log('\n== ringkasan ==')
{
  const r = rencanakanDedup([
    baris(1, 'RS A', 'OpenStreetMap', -6.2, 106.8),
    baris(2, 'RS A', 'OpenStreetMap', -6.20001, 106.80001),
    baris(3, 'RS B', 'SIRS Kemenkes', null, null),
    baris(4, 'RS B', 'OpenStreetMap', -6.3, 106.9),
    baris(5, 'RS C', 'OpenStreetMap', -7.1, 110.1),
  ])
  cek('total = sisa + dihapus', r.ringkasan.total === r.ringkasan.sisa + r.ringkasan.dihapus, JSON.stringify(r.ringkasan))
  cek('dalam + lintas = total dihapus', r.ringkasan.dalamSumber + r.ringkasan.lintasSumber === r.ringkasan.dihapus)
  cek('tidak ada id dobel di daftar hapus', new Set(r.hapus.map((h) => h.id)).size === r.hapus.length)
}

console.log('')
console.log(gagal === 0 ? `SEMUA LULUS — ${lulus} pemeriksaan` : `${gagal} GAGAL dari ${lulus + gagal} pemeriksaan`)
process.exit(gagal === 0 ? 0 : 1)
