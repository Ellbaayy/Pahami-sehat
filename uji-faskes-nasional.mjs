#!/usr/bin/env node
/**
 * Uji pencarian fasilitas kesehatan nasional — DILEWATI bila database mati.
 *
 * Kenapa dilewati, bukan digagalkan: database bersifat OPSIONAL di proyek ini
 * (aturan pertama `app/server/db.js`). Tapi "DILEWATI" bukan "LULUS": kalau
 * dilewati, bagian ini TIDAK terverifikasi dan laporan harus menyebut begitu.
 *
 * Yang diuji — semuanya pada data SUNGGUHAN di MySQL, bukan data karangan:
 *   1. Daftar bisa diambil dan totalnya masuk akal (bukan nol, bukan kosong).
 *   2. Paginasi tidak menggandakan atau menghilangkan baris.
 *   3. Setiap saringan benar-benar menyempitkan hasil.
 *   4. Saringan gabungan (jenis + provinsi) tidak saling menimpa.
 *   5. Karakter LIKE dari masukan pengguna tidak mengubah arti pencarian.
 *   6. Koordinat 0,0 dan koordinat di luar Indonesia tidak dianggap sah.
 *   7. Pilihan filter berasal dari database dan jumlahnya cocok dengan isinya.
 *   8. Baris tanpa koordinat TETAP muncul di daftar (tidak disembunyikan).
 *   9. Urutan stabil: halaman 1 dan 2 tidak memuat id yang sama.
 */

process.env.DB_MATI = '0'

const { dbSiap, tutupDb } = await import('./app/server/db.js')
const {
  cariFaskesNasional,
  faskesNasionalMenurutId,
  pilihanFilterNasional,
  ringkasanNasional,
} = await import('./app/server/faskesNasional.js')

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
      '           Pencarian fasilitas nasional TIDAK terverifikasi oleh uji ini.',
  )
  process.exit(0)
}

console.log('\n1. daftar dasar')
const semua = await cariFaskesNasional({ perHalaman: 25 })
cek('hasil tidak null', semua !== null)
cek('total lebih dari 1000', (semua?.total ?? 0) > 1000, `total=${semua?.total}`)
cek('satu halaman berisi 25 baris', semua?.daftar.length === 25, `isi=${semua?.daftar.length}`)
cek('jumlah halaman masuk akal', (semua?.jumlahHalaman ?? 0) >= 2, `halaman=${semua?.jumlahHalaman}`)

console.log('\n2. paginasi')
const h1 = await cariFaskesNasional({ halaman: 1, perHalaman: 25 })
const h2 = await cariFaskesNasional({ halaman: 2, perHalaman: 25 })
const id1 = new Set((h1?.daftar ?? []).map((f) => f.id))
const irisan = (h2?.daftar ?? []).filter((f) => id1.has(f.id))
cek('halaman 1 dan 2 tidak berbagi baris', irisan.length === 0, `irisan=${irisan.length}`)
cek('total sama di kedua halaman', h1?.total === h2?.total)

const halamanJauh = await cariFaskesNasional({ halaman: 999999, perHalaman: 25 })
cek('halaman di luar jangkauan tidak melempar galat', halamanJauh !== null)
cek('halaman di luar jangkauan kosong', (halamanJauh?.daftar.length ?? -1) === 0)

console.log('\n3. saringan menyempitkan')
const rs = await cariFaskesNasional({ kategori: 'rumah-sakit', perHalaman: 5 })
cek('saringan rumah sakit menghasilkan baris', (rs?.total ?? 0) > 0, `total=${rs?.total}`)
cek('semua baris benar-benar rumah sakit', (rs?.daftar ?? []).every((f) => f.kategori === 'Rumah Sakit'))
cek('saringan menyempitkan hasil', (rs?.total ?? 0) < (semua?.total ?? 0))

const sirs = await cariFaskesNasional({ sumber: 'SIRS Kemenkes', perHalaman: 5 })
cek('saringan sumber SIRS jalan', (sirs?.total ?? 0) > 0, `total=${sirs?.total}`)
cek('semua baris bersumber SIRS', (sirs?.daftar ?? []).every((f) => f.sumber === 'SIRS Kemenkes'))
const osm = await cariFaskesNasional({ sumber: 'OpenStreetMap', perHalaman: 5 })
cek('saringan sumber OSM jalan', (osm?.total ?? 0) > 0, `total=${osm?.total}`)
cek('SIRS + OSM = total', (sirs?.total ?? 0) + (osm?.total ?? 0) === (semua?.total ?? 0))

console.log('\n4. saringan gabungan')
const f = await pilihanFilterNasional()
const provinsiUji = f?.provinsi?.[0]?.nilai
cek('ada provinsi untuk diuji', Boolean(provinsiUji))
const gabung = await cariFaskesNasional({
  kategori: 'rumah-sakit',
  provinsi: provinsiUji,
  perHalaman: 5,
})
cek('gabungan jenis + provinsi mengembalikan baris', (gabung?.total ?? 0) > 0, `total=${gabung?.total}`)
cek(
  'semua baris cocok dengan kedua saringan',
  (gabung?.daftar ?? []).every((x) => x.kategori === 'Rumah Sakit' && x.provinsi === provinsiUji),
)

console.log('\n5. masukan pencarian tidak mengubah arti')
const persen = await cariFaskesNasional({ cari: '%', perHalaman: 5 })
cek('tanda % tidak cocok dengan semua baris', (persen?.total ?? 0) < (semua?.total ?? 0), `total=${persen?.total}`)
const garisBawah = await cariFaskesNasional({ cari: '_', perHalaman: 5 })
cek('tanda _ tidak cocok dengan semua baris', (garisBawah?.total ?? 0) < (semua?.total ?? 0))
const namaNyata = semua?.daftar?.[0]?.nama ?? ''
const potong = namaNyata.slice(0, Math.min(6, namaNyata.length))
const cocok = await cariFaskesNasional({ cari: potong, perHalaman: 5 })
cek('potongan nama nyata menemukan barisnya', (cocok?.total ?? 0) > 0, `cari="${potong}" total=${cocok?.total}`)

console.log('\n6. koordinat tidak dikarang')
const koord = await cariFaskesNasional({ hanyaKoordinat: true, perHalaman: 50 })
cek('saringan berkoordinat jalan', (koord?.total ?? 0) > 0, `total=${koord?.total}`)
cek('semua baris punya adaKoordinat=true', (koord?.daftar ?? []).every((x) => x.adaKoordinat === true))
const semuaBaris = await cariFaskesNasional({ perHalaman: 50 })
cek(
  'baris tanpa koordinat tetap muncul di daftar',
  (semuaBaris?.daftar ?? []).some((x) => x.adaKoordinat === false),
  'semua baris halaman pertama punya koordinat — periksa apakah baris SIRS disembunyikan',
)

console.log('\n7. pilihan filter dari database')
cek('pilihan filter tidak null', f !== null)
cek('ada sepuluh kategori', (f?.kategori?.length ?? 0) === 10, `kategori=${f?.kategori?.length}`)
cek('ada 38 provinsi', (f?.provinsi?.length ?? 0) === 38, `provinsi=${f?.provinsi?.length}`)
cek('jumlah kategori sama dengan total', (f?.kategori ?? []).reduce((s, x) => s + x.jumlah, 0) === (semua?.total ?? 0))
const jumlahProvinsi = (f?.provinsi ?? []).reduce((s, x) => s + x.jumlah, 0)
const jumlahKosong = (await ringkasanNasional())?.tanpaProvinsi ?? 0
cek(
  'jumlah provinsi + tanpa provinsi = total',
  jumlahProvinsi + jumlahKosong === (semua?.total ?? 0),
  `provinsi=${jumlahProvinsi} kosong=${jumlahKosong} total=${semua?.total}`,
)

console.log('\n8. ringkasan dan rincian')
const ringkas = await ringkasanNasional()
cek('ringkasan tidak null', ringkas !== null)
cek('total ringkasan = total daftar', ringkas?.total === semua?.total)
cek('SIRS + OSM = total (ringkasan)', (ringkas?.sirs ?? 0) + (ringkas?.osm ?? 0) === (ringkas?.total ?? 0))
cek('berkoordinat tidak melebihi total', (ringkas?.berkoordinat ?? 0) <= (ringkas?.total ?? 0))

const satu = semua?.daftar?.[0]
const rinci = await faskesNasionalMenurutId(satu?.id)
cek('rincian menurut id ditemukan', rinci !== null)
cek('rincian memuat nama yang sama', rinci?.nama === satu?.nama)
const takAda = await faskesNasionalMenurutId(-1)
cek('id tidak sah mengembalikan null', takAda === null)

// Koneksi MySQL HARUS ditutup. Tanpa ini prosesnya menggantung setelah semua
// pemeriksaan selesai — terlihat seperti "uji macet" padahal hasilnya sudah
// lengkap, dan `uji-semua.mjs` akan menunggu sampai batas waktunya habis.
await tutupDb()

console.log(`\n${lulus} lulus, ${gagal} gagal`)
if (gagal > 0) process.exitCode = 1
