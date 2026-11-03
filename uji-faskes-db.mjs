#!/usr/bin/env node
/**
 * Uji penyimpanan fasilitas ke MySQL — DILEWATI bila database tidak aktif.
 *
 * Kenapa dilewati, bukan digagalkan: proyek ini menetapkan database sebagai
 * OPSIONAL (aturan pertama di app/server/db.js). Uji yang menggagalkan seluruh
 * rangkaian hanya karena MySQL belum dinyalakan akan melatih orang mematikan
 * uji, bukan memperbaiki kode.
 *
 * TAPI "DILEWATI" BUKAN "LULUS": kalau uji ini dilewati, bagian database TIDAK
 * terverifikasi, dan laporan harus menyebut begitu.
 *
 * Yang diuji:
 *   1. Skema benar-benar ada dan `kedaluwarsa` NOT NULL (aturan proyek).
 *   2. Upsert idempoten: menyimpan dua kali tidak menggandakan baris.
 *   3. Kolom kosong tetap NULL, bukan string kosong.
 *   4. Injeksi lewat teks pencarian tidak mengembalikan seluruh tabel.
 *   5. Baris yang lewat `kedaluwarsa` TIDAK disajikan.
 */

process.env.DB_MATI = '0'

const { dbSiap, eksekusi } = await import('./app/server/db.js')
const { simpanFasilitas, cariFasilitas, ambilFasilitas, _lupakanKategori } = await import(
  './app/server/faskesDb.js'
)

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

if (!(await dbSiap())) {
  console.log(
    'DILEWATI — database tidak aktif (nyalakan XAMPP: sudo /opt/lampp/lampp startmysql).\n' +
      '           Bagian penyimpanan fasilitas TIDAK terverifikasi oleh uji ini.',
  )
  process.exit(0)
}

console.log('\n== skema ==')
const tabel = await eksekusi("SHOW TABLES LIKE 'fasilitas'")
cek('tabel fasilitas ada', Array.isArray(tabel) && tabel.length === 1)

const kolom = await eksekusi("SHOW COLUMNS FROM fasilitas LIKE 'kedaluwarsa'")
cek('kolom kedaluwarsa ada dan NOT NULL', kolom?.[0]?.Null === 'NO', JSON.stringify(kolom?.[0]))

const fk = await eksekusi(
  `SELECT CONSTRAINT_NAME FROM information_schema.KEY_COLUMN_USAGE
    WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'fasilitas'
      AND REFERENCED_TABLE_NAME IS NOT NULL`,
)
cek('foreign key ke kategori_fasilitas ada', Array.isArray(fk) && fk.length >= 1, String(fk?.length))

console.log('\n== upsert ==')
_lupakanKategori()
const contoh = {
  kode_osm: 'uji/node/1',
  nama: 'Fasilitas Uji Hapus 12345',
  kategori: 'puskesmas',
  subkategori: 'Puskesmas',
  alamat: 'Jl. Uji 1',
  kode_desa: null,
  lat: -6.3,
  lon: 107.1,
  telepon: '+62 21 000',
  email: null,
  website: null,
  jam: '24/7',
  layanan: null,
  igd: null,
  buka24Jam: false,
  foto: null,
  sumber: 'OpenStreetMap',
  sumberUrl: 'https://www.openstreetmap.org/node/1',
}

const id1 = await simpanFasilitas(contoh)
cek('simpan mengembalikan id', id1 !== null && id1 !== undefined, String(id1))

const id2 = await simpanFasilitas({ ...contoh, nama: 'Fasilitas Uji Hapus 12345 Diperbarui' })
cek('upsert tidak menggandakan baris', String(id1) === String(id2), `${id1} vs ${id2}`)

const baris = await ambilFasilitas(id1)
cek('nama diperbarui', baris?.nama === 'Fasilitas Uji Hapus 12345 Diperbarui', String(baris?.nama))
cek('email kosong tetap NULL', baris?.email === null, String(baris?.email))
cek('IGD tidak diketahui tetap NULL', baris?.igd === null, String(baris?.igd))
cek('kategori terhubung lewat FK', baris?.kategori === 'puskesmas', String(baris?.kategori))

console.log('\n== injeksi ==')
const jahat = await cariFasilitas("' OR 1=1 -- ", { limit: 5 })
cek('injeksi tidak mengembalikan seluruh tabel', Array.isArray(jahat) && jahat.length === 0, String(jahat?.length))

console.log('\n== kedaluwarsa ==')
await eksekusi('UPDATE fasilitas SET kedaluwarsa = ? WHERE kode_osm = ?', [
  new Date(Date.now() - 86400000),
  'uji/node/1',
])
const kadaluwarsa = await ambilFasilitas(id1)
cek('baris kedaluwarsa TIDAK disajikan', kadaluwarsa === null)

console.log('\n== bersihkan ==')
await eksekusi('DELETE FROM fasilitas WHERE kode_osm = ?', ['uji/node/1'])
const sisa = await cariFasilitas('Fasilitas Uji Hapus 12345')
cek('baris uji terhapus', Array.isArray(sisa) && sisa.length === 0, String(sisa?.length))

console.log('')
console.log(gagal === 0 ? `SEMUA LULUS — ${lulus} pemeriksaan` : `${lulus} lulus, ${gagal} GAGAL`)
process.exit(gagal === 0 ? 0 : 1)
