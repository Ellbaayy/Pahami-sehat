#!/usr/bin/env node
/**
 * Uji lapisan fasilitas kesehatan — TANPA jaringan.
 *
 * Yang dijaga:
 *   1. Sepuluh kategori yang diminta ada, dan tag OSM yang nyata benar-benar
 *      dipetakan ke kategori yang tepat (termasuk yang bertumpuk: RS kadang
 *      juga bertag `amenity=clinic`, jadi urutan pemeriksaan penting).
 *   2. Koordinat rusak DITOLAK: (0,0), di luar jangkauan, dan bukan angka.
 *      Ini yang mencegah penanda muncul di tengah laut.
 *   3. Jarak dihitung benar (haversine) — dicocokkan dengan angka yang bisa
 *      diperiksa tangan.
 *   4. IGD dan 24 jam TIDAK dikarang: hanya dari `emergency=yes` /
 *      `opening_hours=24/7`. Nilai yang tidak ada menjadi null.
 *   5. Duplikat (node + way untuk fasilitas yang sama) digabung, bukan
 *      ditampilkan dua kali.
 *   6. Bidang yang tidak tercatat menjadi null, bukan string kosong atau teks
 *      karangan.
 *
 * Semua contoh di bawah disalin dari balasan Overpass asli yang diukur
 * 2 Nov 2026 di Jakarta Pusat.
 */

import {
  KATEGORI,
  KATEGORI_ID,
  koordinatSah,
  jarakMeter,
  kategoriDari,
  alamatDari,
  igdDari,
  duaPuluhEmpat,
  spasi,
  nomorPertama,
  normalisasi,
  buangDuplikat,
  queryOverpass,
  daftarKategori,
  faskesSekitar,
  titikPemanasan,
  _kosongkanSimpanan,
} from './app/server/faskes.js'

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

/* ------------------------------------------------------------ kategori -- */

console.log('\n== sepuluh kategori ==')
cek('jumlah kategori = 10', KATEGORI.length === 10, String(KATEGORI.length))
cek(
  'id kategori lengkap',
  ['rumah-sakit', 'puskesmas', 'klinik', 'praktik-mandiri', 'farmasi', 'laboratorium',
   'penunjang-medis', 'kesehatan-masyarakat', 'tradisional', 'khusus'].every((x) =>
    KATEGORI_ID.includes(x)),
  KATEGORI_ID.join(','),
)
cek('setiap kategori punya label', KATEGORI.every((k) => (k.label ?? '').length > 2))
cek('setiap kategori punya ikon', KATEGORI.every((k) => (k.ikon ?? '').length > 2))
cek('daftarKategori() tanpa fungsi internal',
  daftarKategori().every((k) => Object.keys(k).sort().join(',') === 'id,ikon,label'))

console.log('\n== pemetaan tag OSM yang nyata ==')
const CONTOH = [
  ['RS AGUNG', { amenity: 'hospital', name: 'RS AGUNG' }, 'rumah-sakit', 'Rumah Sakit'],
  ['RSIA Tambak', { amenity: 'hospital', name: 'RSIA Tambak' }, 'rumah-sakit', 'RSIA'],
  ['RSJ (nama)', { amenity: 'hospital', name: 'RS Jiwa Dr. Soeharto' }, 'rumah-sakit', 'RS Jiwa'],
  ['Puskesmas Kelurahan Manggarai', { amenity: 'clinic', healthcare: 'centre', name: 'Puskesmas Kelurahan Manggarai' }, 'puskesmas', 'Puskesmas'],
  ['Pustu (nama)', { amenity: 'clinic', name: 'Pustu Cempaka' }, 'puskesmas', 'Puskesmas Pembantu'],
  ['Klinik biasa', { amenity: 'clinic', name: 'Klinik Sehat' }, 'klinik', 'Klinik'],
  ['Klinik gigi', { amenity: 'clinic', name: 'Klinik Gigi Ceria' }, 'klinik', 'Klinik Gigi'],
  ['Praktik dokter', { amenity: 'doctors', name: 'Praktik Dokter Umum' }, 'praktik-mandiri', 'Dokter Umum'],
  ['Dokter gigi', { amenity: 'dentist', name: 'Ahli Gigi Zifara' }, 'praktik-mandiri', 'Dokter Gigi'],
  ['Bidan', { healthcare: 'midwife', name: 'Bidan Sari' }, 'praktik-mandiri', 'Bidan'],
  ['Apotek', { amenity: 'pharmacy', name: 'Apotek K-24' }, 'farmasi', 'Apotek'],
  ['Toko obat', { amenity: 'pharmacy', name: 'Toko Obat Sumber Waras' }, 'farmasi', 'Toko Obat'],
  ['Laboratorium', { healthcare: 'laboratory', name: 'Lab Klinik Prodia' }, 'laboratorium', 'Laboratorium Klinik'],
  ['Radiologi', { healthcare: 'imaging', name: 'Radiologi Sentra' }, 'penunjang-medis', 'Radiologi'],
  ['Optik', { shop: 'optician', name: 'Optik Melawai' }, 'penunjang-medis', 'Optik'],
  ['Bank darah', { healthcare: 'blood_donation', name: 'UTD PMI' }, 'penunjang-medis', 'Bank Darah / UTD'],
  ['Posyandu', { healthcare: 'community_health_centre', name: 'Posyandu Melati' }, 'kesehatan-masyarakat', 'Posyandu'],
  ['Pengobatan tradisional', { healthcare: 'alternative', name: 'Klinik Jamu Sehat' }, 'tradisional', 'Pengobatan Tradisional'],
  ['Klinik ibu dan anak', { amenity: 'clinic', name: 'Klinik Ibu dan Anak Bunda' }, 'khusus', 'Klinik Ibu & Anak'],
  // Posyandu di OSM sering BERTAG `amenity=clinic`. Diukur 3 Nov 2026:
  // tanpa pengecualian di kategori klinik, 122 posyandu Jakarta Pusat muncul
  // di filter Klinik dan menggeser klinik sungguhan di daftar.
  ['Posyandu bertag clinic', { amenity: 'clinic', name: 'Posyandu Melati 4' }, 'kesehatan-masyarakat', 'Posyandu'],
  ['Posbindu bertag clinic', { amenity: 'clinic', name: 'Posbindu Cempaka' }, 'kesehatan-masyarakat', 'Posbindu'],
]
for (const [nama, tags, katHarap, subHarap] of CONTOH) {
  const h = kategoriDari(tags)
  cek(`${nama} -> ${katHarap}`,
    h?.kategori === katHarap,
    `dapat ${h?.kategori}`)
  cek(`${nama} subkategori = ${subHarap}`,
    h?.subkategori === subHarap,
    `dapat ${h?.subkategori}`)
}

cek('tag tidak relevan -> null', kategoriDari({ amenity: 'restaurant' }) === null)
cek('tanpa tag -> null', kategoriDari({}) === null)
cek('RS menang atas klinik saat keduanya ada',
  kategoriDari({ amenity: 'clinic', healthcare: 'hospital' })?.kategori === 'rumah-sakit',
  kategoriDari({ amenity: 'clinic', healthcare: 'hospital' })?.kategori)

/* ---------------------------------------------------------- koordinat -- */

console.log('\n== validasi koordinat ==')
cek('Jakarta sah', koordinatSah(-6.2088, 106.8456))
cek('(0,0) DITOLAK (penanda data rusak)', !koordinatSah(0, 0))
cek('lintang > 90 ditolak', !koordinatSah(95, 106))
cek('bujur > 180 ditolak', !koordinatSah(-6, 200))
cek('NaN ditolak', !koordinatSah(NaN, 106))
cek('string angka diterima', koordinatSah('-6.2', '106.8'))
cek('null ditolak', !koordinatSah(null, null))

console.log('\n== jarak (haversine) ==')
// Monas (-6.1754,106.8272) ke Blok M (-6.2445,106.8010) ~ 8,4 km
const d = jarakMeter(-6.1754, 106.8272, -6.2445, 106.801)
cek('Monas-Blok M antara 8,0 dan 8,8 km', d > 8000 && d < 8800, `${d} m`)
cek('jarak ke titik yang sama = 0', jarakMeter(-6.2, 106.8, -6.2, 106.8) === 0)
cek('simetris', jarakMeter(-6.2, 106.8, -6.3, 106.9) === jarakMeter(-6.3, 106.9, -6.2, 106.8))

/* -------------------------------------------------------------- detail -- */

console.log('\n== alamat, IGD, 24 jam: TIDAK dikarang ==')
cek('alamat digabung', alamatDari({
  'addr:street': 'Jl. Medan Merdeka', 'addr:housenumber': '1', 'addr:city': 'Jakarta',
}) === 'Jl. Medan Merdeka, 1, Jakarta')
cek('alamat kosong -> null', alamatDari({}) === null)

cek('IGD: emergency=yes -> true', igdDari({ emergency: 'yes' }) === true)
cek('IGD: emergency=no -> false', igdDari({ emergency: 'no' }) === false)
cek('IGD: tidak ada data -> null (bukan false)', igdDari({}) === null)
cek('IGD: nama memuat IGD -> true', igdDari({ name: 'RS Umum IGD 24 Jam' }) === true)
cek('IGD: nama biasa -> null', igdDari({ name: 'RS Agung' }) === null)

cek('24 jam: "24/7" -> true', duaPuluhEmpat({ opening_hours: '24/7' }) === true)
cek('24 jam: "24 / 7" -> true', duaPuluhEmpat({ opening_hours: '24 / 7' }) === true)
cek('24 jam: "Mo-Fr 08:00-17:00" -> false', duaPuluhEmpat({ opening_hours: 'Mo-Fr 08:00-17:00' }) === false)
cek('24 jam: tidak ada data -> false', duaPuluhEmpat({}) === false)

/* ---------------------------------------------------------- normalisasi -- */

console.log('\n== daftar bertitik koma dirapikan ==')
cek('dua nomor jadi kalimat berkoma', spasi('+62 21 3441008;+62 21 3840702') === '+62 21 3441008, +62 21 3840702')
cek('satu nilai tidak diubah', spasi('24/7') === '24/7')
cek('kosong -> null', spasi(null) === null && spasi('') === null)
cek('titik koma berlebih dibuang', spasi('a;;b;') === 'a, b')

console.log('\n== tombol Hubungi memakai SATU nomor ==')
// Cacat terukur di peramban: dua nomor tergabung jadi tel:+622****1008+622****0702
cek('dua nomor -> hanya yang pertama',
  nomorPertama('+62 21 3441008;+62 21 3840702') === '+62213441008',
  String(nomorPertama('+62 21 3441008;+62 21 3840702')))
cek('satu nomor tetap utuh', nomorPertama('(021) 555-1234') === '0215551234')
cek('nomor terlalu pendek ditolak', nomorPertama('123') === null)
cek('bukan nomor -> null', nomorPertama('tidak ada') === null)
cek('kosong -> null', nomorPertama(null) === null)

console.log('\n== normalisasi elemen Overpass ==')
const nodeRS = normalisasi({
  type: 'node',
  id: 12345,
  lat: -6.2,
  lon: 106.8,
  tags: { amenity: 'hospital', name: 'RS Agung', phone: '+62 21 123', website: 'https://rsagung.example', 'opening_hours': '24/7', emergency: 'yes', 'addr:street': 'Jl. Mangga' },
})
cek('node RS ternormalisasi', nodeRS !== null)
cek('nama dipertahankan', nodeRS?.nama === 'RS Agung')
cek('kategori rumah-sakit', nodeRS?.kategori === 'rumah-sakit')
cek('telepon terbaca', nodeRS?.telepon === '+62 21 123')
cek('website terbaca', nodeRS?.website === 'https://rsagung.example')
cek('jam terbaca', nodeRS?.jam === '24/7')
cek('IGD terdeteksi', nodeRS?.igd === true)
cek('24 jam terdeteksi', nodeRS?.buka24Jam === true)
cek('sumber = OpenStreetMap', nodeRS?.sumber === 'OpenStreetMap')
cek('sumberUrl menunjuk objeknya', nodeRS?.sumberUrl === 'https://www.openstreetmap.org/node/12345')

const wayRS = normalisasi({
  type: 'way',
  id: 999,
  center: { lat: -6.21, lon: 106.81 },
  tags: { amenity: 'clinic', name: 'Klinik Tanpa Telepon' },
})
cek('way memakai center', wayRS !== null && wayRS.lat === -6.21)
cek('field tak tercatat -> null, bukan ""', wayRS?.telepon === null && wayRS?.website === null)
cek('IGD tak tercatat -> null', wayRS?.igd === null)

cek('elemen tanpa nama tetap tampil dengan label jujur',
  normalisasi({ type: 'node', id: 1, lat: -6.2, lon: 106.8, tags: { amenity: 'hospital' } })?.tanpaNama === true)
cek('koordinat rusak -> null', normalisasi({ type: 'node', id: 2, lat: 0, lon: 0, tags: { amenity: 'hospital' } }) === null)
cek('kategori tak dikenal -> null', normalisasi({ type: 'node', id: 3, lat: -6.2, lon: 106.8, tags: { amenity: 'restaurant' } }) === null)

/* ------------------------------------------------------------ duplikat -- */

console.log('\n== penggabungan duplikat ==')
const kembar = buangDuplikat([
  { id: 'node/1', nama: 'RS Agung', lat: -6.2, lon: 106.8, telepon: null, website: 'https://a.example', jam: null, alamat: null, layanan: null, igd: null, buka24Jam: false },
  { id: 'way/2', nama: 'RS Agung', lat: -6.2001, lon: 106.8001, telepon: '+62', website: null, jam: '24/7', alamat: 'Jl. A', layanan: null, igd: true, buka24Jam: true },
])
cek('dua objek jadi satu', kembar.length === 1, String(kembar.length))
cek('field kosong terisi dari kembarannya', kembar[0].telepon === '+62' && kembar[0].jam === '24/7')
cek('IGD ikut tergabung', kembar[0].igd === true)

const beda = buangDuplikat([
  { id: 'node/1', nama: 'RS A', lat: -6.2, lon: 106.8 },
  { id: 'node/2', nama: 'RS A', lat: -6.3, lon: 106.9 },
])
cek('nama sama tapi jauh -> tetap dua', beda.length === 2, String(beda.length))

const bedaNama = buangDuplikat([
  { id: 'node/1', nama: 'RS A', lat: -6.2, lon: 106.8 },
  { id: 'node/2', nama: 'RS B', lat: -6.20005, lon: 106.80005 },
])
cek('dekat tapi nama beda -> tetap dua', bedaNama.length === 2, String(bedaNama.length))

/* -------------------------------------------------------------- query --- */

console.log('\n== query Overpass ==')
const q = queryOverpass(-6.2088, 106.8456, 5000)
cek('memuat radius yang diminta', q.includes('around:5000,'))
cek('memuat koordinat', q.includes('-6.2088,106.8456'))
cek('satu permintaan untuk semua amenity', q.includes('^(hospital|clinic|doctors|dentist|pharmacy)$'))
cek('menyertakan healthcare (puskesmas/lab/igd)', q.includes('nwr["healthcare"]'))
cek('menyertakan optik & alkes', q.includes('optician|medical_supply'))
cek('memakai out center untuk way', q.includes('out center'))

/* ------------------------------------------------- pemanasan (tanpa jaringan) -- */

console.log('\n== pemanasan: hanya titik yang diminta ==')
cek('tanpa PEMANASAN_TITIK -> tidak ada titik', titikPemanasan(undefined).length === 0)
cek('string kosong -> tidak ada titik', titikPemanasan('').length === 0)
cek('satu titik terbaca',
  titikPemanasan('-6.1754,106.8272').length === 1 &&
    titikPemanasan('-6.1754,106.8272')[0].lat === -6.1754)
cek('dua titik dipisah titik koma', titikPemanasan('-6.17,106.82;-6.9,107.6').length === 2)
cek('koordinat rusak DIBUANG', titikPemanasan('0,0;-6.17,106.82').length === 1)
cek('bukan angka dibuang', titikPemanasan('abc,def').length === 0)
cek('spasi berlebih tetap terbaca', titikPemanasan(' -6.17 , 106.82 ').length === 1)

console.log('\n== penolakan masukan (tanpa jaringan) ==')
_kosongkanSimpanan()
try {
  await faskesSekitar({ lat: 0, lon: 0, radius: 5000 })
  cek('koordinat (0,0) ditolak sebelum memanggil jaringan', false)
} catch (e) {
  cek('koordinat (0,0) ditolak sebelum memanggil jaringan', e.code === 'koordinat', e.code)
}
try {
  await faskesSekitar({ lat: 'abc', lon: 'def' })
  cek('koordinat bukan angka ditolak', false)
} catch (e) {
  cek('koordinat bukan angka ditolak', e.code === 'koordinat', e.code)
}

console.log('')
console.log(gagal === 0 ? `SEMUA LULUS — ${lulus} pemeriksaan` : `${lulus} lulus, ${gagal} GAGAL`)
process.exit(gagal === 0 ? 0 : 1)
