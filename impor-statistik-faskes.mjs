#!/usr/bin/env node
/**
 * Simpan statistik fasilitas kesehatan nasional ke MySQL (XAMPP).
 * ============================================================================
 *
 * KENAPA ADA
 * ----------
 * Peta fasilitas di aplikasi menyajikan hasil pemetaan OpenStreetMap — berguna
 * untuk mencari faskes di sekitar pengguna, tetapi TIDAK bisa menjawab
 * "berapa jumlah puskesmas di Indonesia". Untuk pertanyaan seperti itu dipakai
 * angka laporan resmi, dan angka itu perlu tempat tinggal yang bisa dicari.
 *
 * ANGKA YANG DISIMPAN
 * -------------------
 * Kemenkes 2024 — fasilitas yang telah mengimplementasikan sistem data dan
 * aplikasi kesehatan:
 *
 *   Rumah sakit              3.681
 *   Puskesmas               11.542
 *   Laboratorium kesehatan     602
 *   Klinik                  18.590
 *   Praktik mandiri         15.060
 *   Unit transfusi darah        73
 *   ---------------------------------
 *   Total                   49.548
 *
 * PERINGATAN: 49.548 BUKAN jumlah seluruh fasilitas kesehatan nasional. Lihat
 * kepala `app/server/statistikFaskes.js`.
 *
 * BPJS Kesehatan, September 2026 (pembanding, cara hitung berbeda):
 *   FKTP 23.862 · RS/Klinik Utama 3.221 · Apotek/Optik 6.631
 *
 * PEMAKAIAN
 * ---------
 *   node impor-statistik-faskes.mjs              simpan / perbarui (aman diulang)
 *   node impor-statistik-faskes.mjs --kering     hanya tampilkan, tanpa menulis
 *   node impor-statistik-faskes.mjs --cari klinik   cari tanpa menyentuh DB
 *
 * Aman diulang: kunci unik (lembaga, periode, jenis) membuat baris yang sama
 * diperbarui, bukan digandakan.
 *
 * WAJIB dijalankan dari akar repo, dengan XAMPP/MariaDB hidup.
 */

import mysql from './app/node_modules/mysql2/promise.js'
import {
  STATISTIK_KEMENKES,
  STATISTIK_BPJS,
  SUMBER_DATA,
  CAKUPAN_KEMENKES,
  CAKUPAN_BPJS,
  totalKemenkes,
  cariStatistik,
} from './app/server/statistikFaskes.js'

const argumen = process.argv.slice(2)
const kering = argumen.includes('--kering')
const iCari = argumen.indexOf('--cari')

/* ------------------------------------------------------------------ --
 * Mode pencarian: tidak menyentuh database sama sekali.
 * ------------------------------------------------------------------ */
if (iCari !== -1) {
  const kata = argumen[iCari + 1]
  if (!kata) {
    console.error('Sebutkan kata yang dicari. Contoh: node impor-statistik-faskes.mjs --cari puskesmas')
    process.exit(1)
  }
  const hasil = cariStatistik(kata)
  if (hasil.length === 0) {
    console.log(`Tidak ada statistik yang cocok dengan "${kata}".`)
    process.exit(0)
  }
  console.log(`Hasil untuk "${kata}":`)
  for (const b of hasil) {
    console.log(`  ${String(b.jumlah).padStart(7, '.')}  ${b.jenis} — ${b.lembaga} ${b.periode}`)
  }
  console.log('')
  console.log('Ingat: angka Kemenkes hanya mencakup fasilitas yang sudah')
  console.log('mengimplementasikan sistem data dan aplikasi kesehatan.')
  process.exit(0)
}

function konfigurasiDb() {
  return {
    host: process.env.DB_HOST || '127.0.0.1',
    port: Number(process.env.DB_PORT || 3306),
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || '',
    database: process.env.DB_NAMA || 'pahami_sehat',
    charset: 'utf8mb4_unicode_ci',
  }
}

const DDL = [
  `CREATE TABLE IF NOT EXISTS statistik_faskes (
     id            INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
     lembaga       VARCHAR(80)  NOT NULL,
     periode       VARCHAR(30)  NOT NULL,
     jenis         VARCHAR(80)  NOT NULL,
     jumlah        INT UNSIGNED NOT NULL,
     cakupan       VARCHAR(300) NOT NULL,
     kode_kategori VARCHAR(40)  NULL,
     catatan       VARCHAR(200) NULL,
     dicatat       DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP
                                ON UPDATE CURRENT_TIMESTAMP,
     UNIQUE KEY uq_statistik (lembaga, periode, jenis),
     KEY idx_statistik_lembaga (lembaga, periode)
   ) ENGINE=InnoDB`,
  `CREATE TABLE IF NOT EXISTS sumber_data_faskes (
     id       INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
     nama     VARCHAR(160) NOT NULL,
     penerbit VARCHAR(120) NOT NULL,
     jenis    VARCHAR(40)  NOT NULL,
     data     VARCHAR(200) NULL,
     tautan   VARCHAR(400) NULL,
     catatan  VARCHAR(300) NULL,
     dicatat  DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
     UNIQUE KEY uq_sumber_data (nama)
   ) ENGINE=InnoDB`,
]

function baris() {
  const kemenkes = STATISTIK_KEMENKES.map((b) => ({
    lembaga: 'Kemenkes',
    periode: '2024',
    jenis: b.jenis,
    jumlah: b.jumlah,
    cakupan: CAKUPAN_KEMENKES,
    kodeKategori: b.kodeKategori,
    catatan: null,
  }))
  const bpjs = STATISTIK_BPJS.map((b) => ({
    lembaga: 'BPJS Kesehatan',
    periode: 'September 2026',
    jenis: b.jenis,
    jumlah: b.jumlah,
    cakupan: CAKUPAN_BPJS,
    kodeKategori: null,
    catatan: b.catatan,
  }))
  return [...kemenkes, ...bpjs]
}

async function utama() {
  const semua = baris()
  console.log('Statistik yang akan disimpan:')
  for (const b of semua) {
    console.log(`  ${String(b.jumlah).padStart(7, '.')}  ${b.jenis} (${b.lembaga} ${b.periode})`)
  }
  console.log(`  ${String(totalKemenkes()).padStart(7, '.')}  TOTAL Kemenkes`)
  console.log('')

  if (kering) {
    console.log('--kering: tidak ada yang ditulis ke database.')
    return
  }

  const pool = mysql.createPool({ ...konfigurasiDb(), connectionLimit: 2, waitForConnections: true })
  try {
    for (const sql of DDL) await pool.query(sql)
    console.log('Tabel statistik_faskes dan sumber_data_faskes siap.')

    for (const b of semua) {
      await pool.query(
        `INSERT INTO statistik_faskes
           (lembaga, periode, jenis, jumlah, cakupan, kode_kategori, catatan)
         VALUES (?, ?, ?, ?, ?, ?, ?)
         ON DUPLICATE KEY UPDATE
           jumlah = VALUES(jumlah),
           cakupan = VALUES(cakupan),
           kode_kategori = VALUES(kode_kategori),
           catatan = VALUES(catatan)`,
        [b.lembaga, b.periode, b.jenis, b.jumlah, b.cakupan, b.kodeKategori, b.catatan],
      )
    }

    // Kolom `data` bisa belum ada di database lama: tambahkan kalau perlu.
    await pool.query(
      `ALTER TABLE sumber_data_faskes
         ADD COLUMN IF NOT EXISTS data VARCHAR(200) NULL AFTER jenis`,
    )

    for (const s of SUMBER_DATA) {
      await pool.query(
        `INSERT INTO sumber_data_faskes (nama, penerbit, jenis, data, catatan)
         VALUES (?, ?, ?, ?, ?)
         ON DUPLICATE KEY UPDATE
           penerbit = VALUES(penerbit),
           jenis = VALUES(jenis),
           data = VALUES(data),
           catatan = VALUES(catatan)`,
        [s.nama, s.penerbit, s.jenis, s.data ?? null, s.catatan ?? null],
      )
    }

    // Daftar di kode adalah sumber kebenaran: rujukan yang sudah tidak
    // tercantum di sana dibuang, supaya katalog tidak menumpuk entri lama.
    const namaSah = SUMBER_DATA.map((x) => x.nama)
    const [hapus] = await pool.query(
      `DELETE FROM sumber_data_faskes WHERE nama NOT IN (${namaSah.map(() => '?').join(', ')})`,
      namaSah,
    )
    if (hapus.affectedRows > 0) console.log(`Rujukan lama dibuang: ${hapus.affectedRows} baris.`)

    const [[{ n: nStat }]] = await pool.query('SELECT COUNT(*) AS n FROM statistik_faskes')
    const [[{ n: nSumber }]] = await pool.query('SELECT COUNT(*) AS n FROM sumber_data_faskes')
    const [[{ total }]] = await pool.query(
      "SELECT COALESCE(SUM(jumlah), 0) AS total FROM statistik_faskes WHERE lembaga = 'Kemenkes'",
    )

    console.log('')
    console.log(`Tersimpan: ${nStat} baris statistik, ${nSumber} sumber data.`)
    console.log(`Jumlah kategori Kemenkes di database: ${total} (seharusnya ${totalKemenkes()}).`)

    if (Number(total) !== totalKemenkes()) {
      console.error('PERINGATAN: jumlah di database tidak sama dengan total yang diharapkan.')
      process.exitCode = 1
    }
  } finally {
    await pool.end()
  }
}

utama().catch((e) => {
  console.error('GAGAL:', e?.message ?? e)
  console.error('Pastikan MariaDB/XAMPP hidup: sudo /opt/lampp/lampp startmysql')
  process.exit(1)
})
