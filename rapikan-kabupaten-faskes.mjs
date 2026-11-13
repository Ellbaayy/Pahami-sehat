#!/usr/bin/env node
/**
 * Rapikan nilai `kabupaten` di tabel fasilitas supaya SAMA dengan nama resmi di
 * tabel `wilayah` — DRY RUN secara bawaan.
 *
 *   node rapikan-kabupaten-faskes.mjs              # hanya melaporkan
 *   node rapikan-kabupaten-faskes.mjs --terapkan   # benar-benar menulis
 *
 * ============================================================================
 * KENAPA ADA (12 Nov 2026)
 * ============================================================================
 *
 * Sumber yang berbeda menulis kabupaten yang sama dengan ejaan berbeda:
 * "Karang Asem" (geoBoundaries) vs "Karangasem" (wilayah), "Gunung Kidul" vs
 * "Gunungkidul", "Kota Pare-pare" vs "Parepare", "Muko Muko" vs "Mukomuko".
 * Akibatnya dropdown kabupaten memuat DUA entri untuk satu kabupaten yang sama,
 * dan memilih salah satunya melewatkan baris yang memakai ejaan lain — tanpa
 * galat apa pun. Terukur: 533 entri dropdown untuk 514 kabupaten resmi.
 *
 * Selain itu ada baris yang kabupatennya milik provinsi LAIN (mis. provinsi
 * "DKI Jakarta" tetapi kabupaten "Kota Depok"). Baris seperti ini tetap muncul,
 * tetapi di bawah provinsi yang salah — dan orang yang menyaring Depok dari
 * provinsi Jawa Barat tidak menemukannya.
 *
 * Aturannya sama dengan kanonikalisasi provinsi (lihat references/faskes-nasional.md):
 * nilainya disamakan dengan tabel `wilayah` lewat `pisahJenis()`, bukan dengan
 * membandingkan huruf kecil mentah. Tidak ada nama yang dikarang: kalau tidak
 * ada padanan resmi, baris itu dibiarkan dan dilaporkan.
 */

import { createRequire } from 'node:module'
import { pisahJenis } from './app/server/geocoding.js'

const require = createRequire(new URL('./app/server/', import.meta.url))
const mysql = require('mysql2/promise')

const TERAPKAN = process.argv.includes('--terapkan')
const KONFIG = {
  host: process.env.DB_HOST || '127.0.0.1',
  port: Number(process.env.DB_PORT || 3306),
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || '',
  database: process.env.DB_NAMA || 'pahami_sehat',
  charset: 'utf8mb4_unicode_ci',
}

const koneksi = await mysql.createConnection(KONFIG)
try {
  const [wilayah] = await koneksi.query(
    `SELECT w.nama AS kabupaten, p.nama AS provinsi
       FROM wilayah w JOIN wilayah p ON p.kode = w.kode_induk
      WHERE w.tingkat = 'kabupaten' AND p.tingkat = 'provinsi'`,
  )
  /*
   * Tiga peta, dicoba berurutan. Sumber menulis kabupaten yang sama dengan
   * ejaan berbeda, dan selisihnya sering hanya spasi atau tanda hubung:
   * "Karang Asem" vs "Karangasem", "Fakfak" vs "Fak Fak", "Pare-pare" vs
   * "Parepare". Karena itu pencocokan kedua membuang spasi.
   */
  const peta = new Map() // jenis|nama
  const petaRapat = new Map() // jenis|namatanpaspasi
  const petaLonggar = new Map() // namatanpaspasi (jenis diabaikan)
  const rapat = (n) => n.replace(/\s+/g, '')
  for (const w of wilayah) {
    const { jenis, nama } = pisahJenis(w.kabupaten)
    const nilai = { kabupaten: w.kabupaten.trim(), provinsi: w.provinsi }
    peta.set(`${jenis}|${nama}`, nilai)
    petaRapat.set(`${jenis}|${rapat(nama)}`, nilai)
    const kunci = rapat(nama)
    // hanya dipakai kalau tidak ambigu di provinsi itu
    petaLonggar.set(`${w.provinsi}|${kunci}`, petaLonggar.has(`${w.provinsi}|${kunci}`) ? null : nilai)
  }

  /*
   * Nama lama/beda ejaan yang TIDAK bisa dicocokkan otomatis. Setiap baris di
   * sini punya alasan yang bisa diperiksa — bukan tebakan:
   *   - Maluku Tenggara Barat -> Kabupaten Kepulauan Tanimbar (nama resmi sejak 2019)
   *   - Toba Samosir, Danau Toba -> Kabupaten Toba (nama resmi sejak 2020)
   *   - Padang Sidempuan -> Padangsidimpuan (ejaan resmi)
   *   - Mahakam Hulu -> Mahakam Ulu (ejaan resmi)
   *   - Pangkajene Kepulauan -> Pangkajene dan Kepulauan (nama resmi; `pisahJenis()`
   *     menyingkat "kepulauan" jadi "kep", jadi kuncinya memakai bentuk itu)
   *   - "Kota baru"/"Kota Baru" di Kalimantan Selatan -> Kabupaten Kotabaru
   *     (diperiksa dari nama fasilitasnya: RSUD Kotabaru, RSUD Sengayam,
   *      Pangeran Jaya Sumitra — semuanya di Kabupaten Kotabaru)
   *
   * Kuncinya `${provinsi}|${jenis}|${nama rapat}` supaya "baru" tidak pernah
   * cocok di provinsi lain.
   */
  const ALIAS = new Map([
    ['Maluku|kabupaten|malukutenggarabarat', 'Kabupaten Kepulauan Tanimbar'],
    ['Sumatera Utara|kabupaten|tobasamosir', 'Kabupaten Toba'],
    ['Sumatera Utara|kabupaten|danautoba', 'Kabupaten Toba'],
    ['Sumatera Utara|kota|padangsidempuan', 'Kota Padangsidimpuan'],
    ['Kalimantan Timur|kabupaten|mahakamhulu', 'Kabupaten Mahakam Ulu'],
    ['Sulawesi Selatan|kabupaten|pangkajenekep', 'Kabupaten Pangkajene dan Kepulauan'],
    ['Kalimantan Selatan|kota|baru', 'Kabupaten Kotabaru'],
  ])

  const [pasangan] = await koneksi.query(
    `SELECT provinsi, kabupaten, COUNT(*) AS jumlah
       FROM fasilitas
      WHERE kabupaten IS NOT NULL AND kabupaten <> ''
      GROUP BY provinsi, kabupaten`,
  )

  const ganti = [] // { provinsiLama, kabupatenLama, provinsiBaru, kabupatenBaru, jumlah }
  const tetap = []
  const takCocok = []

  for (const p of pasangan) {
    const jumlah = Number(p.jumlah)
    const { jenis, nama } = pisahJenis(p.kabupaten)
    const resmi =
      peta.get(`${jenis}|${nama}`) ??
      petaRapat.get(`${jenis}|${rapat(nama)}`) ??
      petaLonggar.get(`${p.provinsi}|${rapat(nama)}`) ??
      (ALIAS.has(`${p.provinsi}|${jenis}|${rapat(nama)}`)
        ? { kabupaten: ALIAS.get(`${p.provinsi}|${jenis}|${rapat(nama)}`), provinsi: p.provinsi }
        : null)
    if (!resmi) {
      takCocok.push({ ...p, jumlah })
      continue
    }
    if (resmi.kabupaten === p.kabupaten && resmi.provinsi === p.provinsi) {
      tetap.push({ ...p, jumlah })
      continue
    }
    ganti.push({
      provinsiLama: p.provinsi,
      kabupatenLama: p.kabupaten,
      provinsiBaru: resmi.provinsi,
      kabupatenBaru: resmi.kabupaten,
      jumlah,
    })
  }

  const barisBerubah = ganti.reduce((n, g) => n + g.jumlah, 0)
  const pindahProvinsi = ganti.filter((g) => g.provinsiBaru !== g.provinsiLama)

  console.log(`\nPasangan (provinsi, kabupaten) di fasilitas : ${pasangan.length}`)
  console.log(`  sudah sama dengan wilayah                 : ${tetap.length}`)
  console.log(`  akan dirapikan                            : ${ganti.length} pasangan, ${barisBerubah} baris`)
  console.log(`  tidak ada padanan resmi (dibiarkan)       : ${takCocok.length} pasangan, ${takCocok.reduce((n, t) => n + t.jumlah, 0)} baris`)

  console.log('\nContoh yang dirapikan (10 pertama):')
  for (const g of ganti.slice(0, 10)) {
    console.log(`  ${g.provinsiLama} / ${g.kabupatenLama}  ->  ${g.provinsiBaru} / ${g.kabupatenBaru}  (${g.jumlah} baris)`)
  }

  if (pindahProvinsi.length) {
    console.log(`\nBaris yang pindah provinsi (kabupatennya milik provinsi lain) — ${pindahProvinsi.length} pasangan:`)
    for (const g of pindahProvinsi) {
      console.log(`  ${g.provinsiLama} / ${g.kabupatenLama}  ->  ${g.provinsiBaru} / ${g.kabupatenBaru}  (${g.jumlah} baris)`)
    }
    console.log('  Diperiksa juga terhadap koordinat: lihat --terapkan yang menolak kalau titiknya tidak jatuh di provinsi tujuan.')
  }

  if (takCocok.length) {
    console.log('\nTidak ada padanan resmi (dibiarkan, perlu diperiksa manual):')
    for (const t of takCocok) {
      console.log(`  ${t.provinsi} / ${t.kabupaten}  (${t.jumlah} baris)`)
    }
  }

  if (!TERAPKAN) {
    console.log('\nDRY RUN — tidak ada yang ditulis. Jalankan dengan --terapkan.\n')
    process.exit(0)
  }

  let diubah = 0
  for (const g of ganti) {
    const [hasil] = await koneksi.query(
      `UPDATE fasilitas SET kabupaten = ?, provinsi = ?
        WHERE provinsi = ? AND kabupaten = ?`,
      [g.kabupatenBaru, g.provinsiBaru, g.provinsiLama, g.kabupatenLama],
    )
    diubah += hasil.affectedRows
  }
  console.log(`\nSelesai. ${diubah} baris dirapikan.\n`)
} finally {
  await koneksi.end()
}
