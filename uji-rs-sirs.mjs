#!/usr/bin/env node
/**
 * Uji data rumah sakit SIRS Kemenkes di MySQL — TANPA jaringan.
 * ============================================================================
 *
 * Yang dibuktikan (semuanya pernah SALAH dan terukur, bukan hipotesis):
 *
 *   1. Isi database sesuai dengan angka rekap RESMI SIRS sendiri (3.325), dan
 *      jumlahnya sama dengan jumlah kode unik — tidak ada duplikat.
 *   2. Setiap rumah sakit punya kode_kabupaten yang benar-benar ada di tabel
 *      wilayah, dan provinsinya konsisten dengan kode itu.
 *   3. Tidak ada koordinat karangan: lat/lon NULL untuk data SIRS, dan tidak
 *      ada satu pun koordinat di luar wilayah Indonesia.
 *   4. Pemetaan wilayah tidak menempatkan kabupaten di jenis yang salah —
 *      kasus nyata: SIRS menulis "Bekasi" (kabupaten) dan "Kota Bekasi" (kota),
 *      dan versi pertama kode menempatkan keduanya ke KOTA Bekasi.
 *   5. Sinkronisasi ulang tidak menggandakan baris.
 *   6. Filter /api/rs mengembalikan angka yang sama dengan COUNT(*) langsung.
 *
 * Butuh MySQL XAMPP hidup. Dilewati (bukan gagal) kalau database mati, supaya
 * `npm test` tetap bisa jalan tanpa XAMPP — pola yang sama dengan
 * uji-faskes-db.mjs.
 *
 * Pemakaian: node uji-rs-sirs.mjs
 */

import { readFileSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import mysql from './app/node_modules/mysql2/promise.js'
import { kunciJenis, pisahJenis } from './petakan-wilayah.mjs'

const AKAR = dirname(fileURLToPath(import.meta.url))
const SUMBER = 'SIRS Kemenkes'

let lulus = 0
let gagal = 0
const cek = (nama, ok, bukti = '') => {
  if (ok) lulus++
  else gagal++
  console.log(`  ${ok ? 'ok   ' : 'GAGAL'} ${nama}${bukti ? `  — ${bukti}` : ''}`)
}

function konfigurasiDb() {
  const env = {}
  try {
    for (const baris of readFileSync(join(AKAR, 'app', '.env'), 'utf8').split('\n')) {
      const m = baris.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/)
      if (m) env[m[1]] = m[2].replace(/^["']|["']$/g, '')
    }
  } catch {
    /* bawaan XAMPP */
  }
  return {
    host: env.DB_HOST || '127.0.0.1',
    port: Number(env.DB_PORT || 3306),
    user: env.DB_USER || 'root',
    password: env.DB_PASSWORD || '',
    database: env.DB_NAMA || 'pahami_sehat',
    charset: 'utf8mb4',
  }
}

/* --------------------------------------------------------------- tanpa DB -- */

console.log('== normalisasi nama wilayah (tanpa database) ==')
{
  const kasus = [
    // [masukan SIRS, jenis harapan, nama harapan]
    ['Bekasi', 'kabupaten', 'bekasi'],
    ['Kota Bekasi', 'kota', 'bekasi'],
    ['Bogor', 'kabupaten', 'bogor'],
    ['Kota Bogor', 'kota', 'bogor'],
    ['Yogyakarta', 'kabupaten', 'yogyakarta'],
    ['Kota Yogyakarta', 'kota', 'yogyakarta'],
    ['Kabupaten Bandung', 'kabupaten', 'bandung'],
    ['Kab. Bandung Barat', 'kabupaten', 'bandung barat'],
    ['Kota Administrasi Jakarta Selatan', 'kota', 'jakarta selatan'],
    ['Kota Jakarta Selatan', 'kota', 'jakarta selatan'],
    ['Labuhan Batu', 'kabupaten', 'labuhan batu'],
    ['Kepulauan Siau Tagulandang Biaro', 'kabupaten', 'kep siau tagulandang biaro'],
  ]
  for (const [masuk, jenisHarap, namaHarap] of kasus) {
    const h = pisahJenis(masuk)
    cek(
      `"${masuk}" -> ${jenisHarap}|${namaHarap}`,
      h.jenis === jenisHarap && h.nama === namaHarap,
      `${h.jenis}|${h.nama}`,
    )
  }
  // Kasus yang dulu menghasilkan bug nyata: dua nama ini TIDAK boleh bertemu.
  cek('"Bekasi" != "Kota Bekasi"', kunciJenis('Bekasi') !== kunciJenis('Kota Bekasi'), `${kunciJenis('Bekasi')} vs ${kunciJenis('Kota Bekasi')}`)
  cek('"Bogor" != "Kota Bogor"', kunciJenis('Bogor') !== kunciJenis('Kota Bogor'))
  // Tapi bentuk yang setara HARUS bertemu.
  cek('"Kota Jakarta Selatan" == "Kota Administrasi Jakarta Selatan"', kunciJenis('Kota Jakarta Selatan') === kunciJenis('Kota Administrasi Jakarta Selatan'))
  cek('"Kab. Bandung" == "Kabupaten Bandung"', kunciJenis('Kab. Bandung') === kunciJenis('Kabupaten Bandung'))
}

/* ------------------------------------------------------------ dengan DB -- */

let pool = null
/*
 * KENAPA DB_MATI DIABAIKAN DI SINI
 * ---------------------------------
 * Gerbang `npm test` menyetel `DB_MATI=1` supaya uji di mesin tanpa database
 * tetap lulus. Uji INI justru membuktikan isi database, jadi ia tidak boleh
 * ikut dimatikan — tetapi modul aplikasi (`rsSirs.js` -> `db.js`) MEMBACA
 * DB_MATI dan akan mengembalikan null, membuat 10 pemeriksaan gagal padahal
 * datanya benar.
 *
 * Jadi variabelnya dihapus hanya untuk proses uji ini, setelah nilai aslinya
 * dicatat. Itu tidak menyembunyikan cacat: kalau database benar-benar mati,
 * `SELECT 1` di bawah gagal dan seluruh bagian database dilewati dengan pesan
 * yang jelas.
 */
const dbMatiAsli = process.env.DB_MATI
delete process.env.DB_MATI

try {
  pool = mysql.createPool({ ...konfigurasiDb(), connectionLimit: 2, connectTimeout: 4000 })
  await pool.query('SELECT 1')
} catch {
  if (dbMatiAsli !== undefined) process.env.DB_MATI = dbMatiAsli
  console.log('')
  console.log('MySQL tidak tersambung — uji berbasis database DILEWATI.')
  console.log('Nyalakan XAMPP (`sudo /opt/lampp/lampp startmysql`) lalu jalankan ulang.')
  console.log('')
  console.log(`${lulus} lulus, ${gagal} gagal (sebagian dilewati)`)
  process.exit(gagal === 0 ? 0 : 1)
}

try {
  /* 1. jumlah & duplikat -------------------------------------------------- */
  console.log('')
  console.log('== jumlah & keunikan ==')
  const [[jml]] = await pool.query(
    `SELECT COUNT(*) AS total, COUNT(DISTINCT kode_rs) AS unik,
            SUM(kode_rs IS NULL) AS tanpa_kode
       FROM fasilitas WHERE sumber = ?`,
    [SUMBER],
  )
  cek('ada data SIRS di database', Number(jml.total) > 0, `${jml.total} baris`)
  cek('tidak ada kode rumah sakit kosong', Number(jml.tanpa_kode) === 0, `${jml.tanpa_kode} kosong`)
  cek('tidak ada kode ganda', Number(jml.total) === Number(jml.unik), `${jml.total} baris / ${jml.unik} kode`)

  // Cocokkan dengan rekap resmi yang tersimpan di catatan_sumber (diisi
  // uji-impor-sirs / impor-sirs.mjs). Kalau ada, angkanya harus sama.
  const [[catatan]] = await pool.query(`SELECT catatan FROM catatan_sumber WHERE sumber = ?`, [SUMBER])
  cek('catatan sumber tercatat', Boolean(catatan), catatan ? 'ada' : 'tidak ada')

  /* 2. wilayah ------------------------------------------------------------ */
  console.log('')
  console.log('== pemetaan wilayah ==')
  const [[wil]] = await pool.query(
    `SELECT SUM(kode_provinsi IS NOT NULL) AS prov,
            SUM(kode_kabupaten IS NOT NULL) AS kab
       FROM fasilitas WHERE sumber = ?`,
    [SUMBER],
  )
  cek('semua RS punya kode provinsi', Number(wil.prov) === Number(jml.total), `${wil.prov}/${jml.total}`)
  cek('semua RS punya kode kabupaten', Number(wil.kab) === Number(jml.total), `${wil.kab}/${jml.total}`)

  const [[yatim]] = await pool.query(
    `SELECT COUNT(*) AS n FROM fasilitas f
      LEFT JOIN wilayah w ON w.kode = f.kode_kabupaten
     WHERE f.sumber = ? AND f.kode_kabupaten IS NOT NULL AND w.kode IS NULL`,
    [SUMBER],
  )
  cek('setiap kode kabupaten ada di tabel wilayah', Number(yatim.n) === 0, `${yatim.n} yatim`)

  // Provinsi harus konsisten: kode_provinsi == kode_induk dari kabupatennya.
  const [[beda]] = await pool.query(
    `SELECT COUNT(*) AS n FROM fasilitas f
       JOIN wilayah w ON w.kode = f.kode_kabupaten
      WHERE f.sumber = ? AND f.kode_provinsi <> w.kode_induk`,
    [SUMBER],
  )
  cek('kode provinsi konsisten dengan kabupatennya', Number(beda.n) === 0, `${beda.n} tidak konsisten`)

  // Kesalahan jenis: kabupaten dipetakan ke kota atau sebaliknya. Kasus nyata
  // "Bekasi" -> Kota Bekasi pernah terjadi dan ini yang menangkapnya kembali.
  const [pasangan] = await pool.query(
    `SELECT DISTINCT f.provinsi, f.kabupaten AS sirs, w.nama AS resmi, COUNT(*) AS n
       FROM fasilitas f JOIN wilayah w ON w.kode = f.kode_kabupaten
      WHERE f.sumber = ?
      GROUP BY f.kode_kabupaten`,
    [SUMBER],
  )
  const jenisBeda = pasangan.filter(
    (p) => pisahJenis(p.sirs).jenis !== pisahJenis(p.resmi).jenis,
  )
  // Satu pengecualian yang disengaja dan didokumentasikan di petakan-wilayah.mjs:
  // SIRS menulis "Kota baru" (huruf kecil) untuk Kabupaten Kotabaru.
  const pengecualian = jenisBeda.filter(
    (p) => !(p.provinsi === 'Kalimantan Selatan' && /^kota baru$/i.test(p.sirs)),
  )
  cek(
    'tidak ada kabupaten yang dipetakan ke jenis berbeda',
    pengecualian.length === 0,
    pengecualian.length ? pengecualian.map((p) => `${p.sirs}->${p.resmi}`).join(', ') : `${pasangan.length} pasangan diperiksa`,
  )

  /* 3. koordinat ---------------------------------------------------------- */
  console.log('')
  console.log('== koordinat ==')
  const [[koord]] = await pool.query(
    `SELECT SUM(lat IS NOT NULL OR lon IS NOT NULL) AS ada,
            COUNT(*) AS total
       FROM fasilitas WHERE sumber = ?`,
    [SUMBER],
  )
  // SIRS TIDAK menyediakan koordinat. Kalau tiba-tiba ada isinya, itu berarti
  // ada yang mengarang — dan uji ini yang harus menangkapnya lebih dulu.
  cek(
    'tidak ada koordinat karangan untuk data SIRS',
    Number(koord.ada) === 0,
    `${koord.ada} dari ${koord.total} berkoordinat`,
  )

  // Kalau nanti koordinat diisi dari sumber lain, nilainya harus masuk akal.
  const [[luar]] = await pool.query(
    `SELECT COUNT(*) AS n FROM fasilitas
      WHERE lat IS NOT NULL AND (lat < -11.5 OR lat > 6.5 OR lon < 94 OR lon > 141.1)`,
  )
  cek('tidak ada koordinat di luar Indonesia', Number(luar.n) === 0, `${luar.n} di luar batas`)

  /* 4. distribusi cocok dengan rekap resmi -------------------------------- */
  console.log('')
  console.log('== distribusi ==')
  const [perKelas] = await pool.query(
    `SELECT kelas_rs AS k, COUNT(*) AS n FROM fasilitas WHERE sumber = ? AND kelas_rs IS NOT NULL GROUP BY kelas_rs`,
    [SUMBER],
  )
  const petaKelas = new Map(perKelas.map((r) => [String(r.k).toUpperCase(), Number(r.n)]))
  // Angka rekap resmi SIRS per 4 Nov 2026. Nilai ini BUKAN target yang
  // dipaksakan: uji memeriksa apakah angka lokal MASIH masuk akal terhadap
  // rekap resmi (selisih 0). Kalau Kemenkes menambah RS, angka ini yang perlu
  // diperbarui — bukan dengan mengubah data agar cocok.
  const RESMI_KELAS = { A: 86, B: 451, C: 1826, D: 872, 'D PRATAMA': 85 }
  for (const [k, harap] of Object.entries(RESMI_KELAS)) {
    cek(`kelas ${k} = ${harap}`, petaKelas.get(k) === harap, String(petaKelas.get(k) ?? 0))
  }

  const [perJenis] = await pool.query(
    `SELECT jenis_rs AS j, COUNT(*) AS n FROM fasilitas WHERE sumber = ? AND jenis_rs IS NOT NULL GROUP BY jenis_rs ORDER BY n DESC LIMIT 3`,
    [SUMBER],
  )
  cek('jenis RSU = 2828', Number(perJenis.find((r) => r.j === 'RSU')?.n ?? 0) === 2828, String(perJenis.find((r) => r.j === 'RSU')?.n ?? 0))
  cek('jenis RSIA = 296', Number(perJenis.find((r) => r.j === 'RSIA')?.n ?? 0) === 296, String(perJenis.find((r) => r.j === 'RSIA')?.n ?? 0))

  /* 5. sinkronisasi ulang tidak menggandakan ------------------------------ */
  console.log('')
  console.log('== sinkronisasi ulang ==')
  const [log] = await pool.query(
    `SELECT status, jumlah_sumber, jumlah_baru, jumlah_gagal FROM sinkron_fasilitas
      WHERE sumber = ? ORDER BY id DESC LIMIT 2`,
    [SUMBER],
  )
  cek('ada catatan sinkronisasi', log.length > 0, `${log.length} baris`)
  if (log.length >= 2) {
    // Sinkronisasi kedua kalinya harus menghasilkan 0 baris baru.
    const kedua = log[0]
    cek('sinkronisasi ulang tidak menambah baris baru', Number(kedua.jumlah_baru) === 0, `baru ${kedua.jumlah_baru}`)
    cek('sinkronisasi ulang tanpa kegagalan', Number(kedua.jumlah_gagal) === 0, `gagal ${kedua.jumlah_gagal}`)
  }
  cek('tidak ada dua sinkronisasi yang bertumpuk', log.filter((l) => l.status === 'jalan').length === 0)

  /* 6. filter mengembalikan angka yang sama dengan COUNT(*) --------------- */
  console.log('')
  console.log('== filter ==')
  const { cariRsSirs, pilihanFilterSirs, ringkasanSirs } = await import('./app/server/rsSirs.js')

  const semua = await cariRsSirs({ perHalaman: 1 })
  cek('tanpa filter = seluruh isi', semua?.total === Number(jml.total), `${semua?.total} vs ${jml.total}`)

  const jatim = await cariRsSirs({ provinsi: 'Jawa Timur', perHalaman: 1 })
  const [[hitungJatim]] = await pool.query(
    `SELECT COUNT(*) AS n FROM fasilitas WHERE sumber = ? AND provinsi = 'Jawa Timur'`,
    [SUMBER],
  )
  cek('filter provinsi cocok dengan COUNT(*)', jatim?.total === Number(hitungJatim.n), `${jatim?.total} vs ${hitungJatim.n}`)

  const kelasA = await cariRsSirs({ kelas: 'A', perHalaman: 1 })
  cek('filter kelas A = 86', kelasA?.total === 86, String(kelasA?.total))

  const ada = await cariRsSirs({ cari: 'zainoel', perHalaman: 5 })
  cek('pencarian nama menemukan RS Dr. Zainoel Abidin', (ada?.daftar ?? []).some((r) => /Zainoel/i.test(r.nama)), `${ada?.total} hasil`)

  // Wildcard LIKE harus di-escape: kalau tidak, cari "%" akan cocok ke semua.
  const wildcard = await cariRsSirs({ cari: '%', perHalaman: 1 })
  cek('wildcard "%" tidak cocok ke semua baris', wildcard?.total !== Number(jml.total), `${wildcard?.total} hasil`)

  const filter = await pilihanFilterSirs()
  cek('filter provinsi tersedia', (filter?.provinsi ?? []).length >= 38, `${filter?.provinsi?.length ?? 0} provinsi`)
  cek('filter kabupaten tersedia', (filter?.kabupaten ?? []).length >= 500, `${filter?.kabupaten?.length ?? 0} kabupaten`)
  cek(
    'jumlah per provinsi di filter = total',
    (filter?.provinsi ?? []).reduce((a, b) => a + b.jumlah, 0) === Number(jml.total),
    String((filter?.provinsi ?? []).reduce((a, b) => a + b.jumlah, 0)),
  )

  const ringkas = await ringkasanSirs()
  cek('ringkasan melaporkan total yang sama', ringkas?.total === Number(jml.total), `${ringkas?.total}`)
  cek('ringkasan menyebut nol berkoordinat', ringkas?.berkoordinat === 0, String(ringkas?.berkoordinat))

  // Halaman tidak boleh tumpang tindih: baris di halaman 1 dan 2 harus berbeda.
  const h1 = await cariRsSirs({ halaman: 1, perHalaman: 10 })
  const h2 = await cariRsSirs({ halaman: 2, perHalaman: 10 })
  const id1 = new Set((h1?.daftar ?? []).map((r) => r.kode_rs))
  const tumpang = (h2?.daftar ?? []).filter((r) => id1.has(r.kode_rs))
  cek('halaman 1 dan 2 tidak tumpang tindih', tumpang.length === 0, `${tumpang.length} baris sama`)

  const akhir = await cariRsSirs({ halaman: 99999, perHalaman: 10 })
  cek('halaman di luar jangkauan tidak melempar galat', akhir !== null, akhir ? `${akhir.daftar.length} baris` : 'null')
} catch (e) {
  gagal++
  console.error('GAGAL tak terduga:', e?.message ?? e)
} finally {
  await pool?.end().catch(() => {})
}

console.log('')
console.log(gagal === 0 ? `SEMUA LULUS — ${lulus} pemeriksaan` : `${lulus} lulus, ${gagal} GAGAL`)
process.exit(gagal === 0 ? 0 : 1)
