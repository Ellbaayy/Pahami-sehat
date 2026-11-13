#!/usr/bin/env node
/**
 * Isi `provinsi` untuk baris fasilitas yang sudah punya `kabupaten` tetapi
 * provinsinya kosong — DRY RUN secara bawaan.
 *
 *   node lengkapi-provinsi-faskes.mjs              # hanya melaporkan
 *   node lengkapi-provinsi-faskes.mjs --terapkan   # benar-benar menulis
 *
 * ============================================================================
 * KENAPA ADA (12 Nov 2026)
 * ============================================================================
 *
 * `petakan-kabupaten-faskes.mjs` mengisi `kabupaten` dari poligon, tetapi TIDAK
 * pernah mengisi `provinsi`. Baris yang provinsinya sudah kosong sejak tarikan
 * OSM karena itu berakhir dengan kabupaten terisi + provinsi kosong.
 *
 * Akibatnya di antarmuka: pilihan provinsi tidak memuat baris itu, dan dropdown
 * kabupaten hanya berisi kabupaten milik provinsi yang sedang dipilih — jadi
 * kabupaten tanpa provinsi TIDAK BISA DIPILIH SAMA SEKALI. Fasilitasnya ada di
 * database, muncul kalau dicari namanya, tetapi mustahil ditemukan lewat
 * saringan lokasi. Terukur 12 Nov 2026: 61 baris.
 *
 * Provinsi diturunkan dari kabupaten lewat tabel `wilayah` (kabupaten -> kode
 * induk -> provinsi), BUKAN dari geocoding. Tidak ada tebakan: kalau nama
 * kabupatennya tidak ada di `wilayah`, baris itu dibiarkan dan dilaporkan.
 *
 * Pencocokan memakai `pisahJenis()` dari `app/server/geocoding.js`, yang sudah
 * menyamakan "Kota Jakarta Barat" dengan "Kota Administrasi Jakarta Barat" dan
 * "Bogor" dengan "Kabupaten Bogor".
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
  // kunci: jenis + nama tanpa awalan ("kota|jakarta barat")
  const peta = new Map()
  for (const w of wilayah) {
    const { jenis, nama } = pisahJenis(w.kabupaten)
    peta.set(`${jenis}|${nama}`, w.provinsi)
  }

  const [baris] = await koneksi.query(
    `SELECT id, nama, kabupaten FROM fasilitas
      WHERE (provinsi IS NULL OR provinsi = '')
        AND kabupaten IS NOT NULL AND kabupaten <> ''
      ORDER BY kabupaten, nama`,
  )

  const cocok = []
  const tidakCocok = []
  for (const b of baris) {
    const { jenis, nama } = pisahJenis(b.kabupaten)
    const provinsi = peta.get(`${jenis}|${nama}`)
    if (provinsi) cocok.push({ ...b, provinsi })
    else tidakCocok.push(b)
  }

  console.log(`\nBaris tanpa provinsi tetapi punya kabupaten: ${baris.length}`)
  console.log(`  bisa diturunkan dari tabel wilayah : ${cocok.length}`)
  console.log(`  kabupatennya tidak dikenal wilayah : ${tidakCocok.length}`)

  const perProvinsi = new Map()
  for (const c of cocok) perProvinsi.set(c.provinsi, (perProvinsi.get(c.provinsi) ?? 0) + 1)
  console.log('\nSebaran hasil:')
  for (const [p, n] of [...perProvinsi.entries()].sort((a, b) => b[1] - a[1])) {
    console.log(`  ${p}: ${n}`)
  }
  if (tidakCocok.length) {
    console.log('\nTidak dikenali (dibiarkan, perlu diperiksa manual):')
    for (const b of tidakCocok.slice(0, 20)) console.log(`  #${b.id} ${b.nama} — kabupaten "${b.kabupaten}"`)
  }

  if (!TERAPKAN) {
    console.log('\nDRY RUN — tidak ada yang ditulis. Jalankan dengan --terapkan.\n')
    process.exit(0)
  }

  let diubah = 0
  for (const c of cocok) {
    const [hasil] = await koneksi.query(
      `UPDATE fasilitas SET provinsi = ? WHERE id = ? AND (provinsi IS NULL OR provinsi = '')`,
      [c.provinsi, c.id],
    )
    diubah += hasil.affectedRows
  }
  console.log(`\nSelesai. ${diubah} baris diisi provinsi.\n`)
} finally {
  await koneksi.end()
}
