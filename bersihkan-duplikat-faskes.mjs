#!/usr/bin/env node
/**
 * Bersihkan duplikat tabel `fasilitas` — DRY RUN secara bawaan.
 *
 *   node bersihkan-duplikat-faskes.mjs              # hanya melaporkan
 *   node bersihkan-duplikat-faskes.mjs --terapkan   # benar-benar menghapus
 *
 * Aturan dan alasannya ada di `app/server/dedupFaskes.js` (fungsi murni, diuji
 * `uji-dedup-faskes.mjs`). Skrip ini hanya menjalankan rencananya ke database.
 *
 * KENAPA DRY RUN BAWAAN: ini menghapus baris. Yang harus dibaca lebih dulu
 * adalah daftar yang akan dihapus beserta pasangannya, bukan ringkasannya saja.
 *
 * SEBELUM MENJALANKAN `--terapkan`, cadangkan tabelnya:
 *   /opt/lampp/bin/mysqldump -uroot pahami_sehat fasilitas > cadangan-fasilitas.sql
 */

import { createRequire } from 'node:module'
import { rencanakanDedup } from './app/server/dedupFaskes.js'

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

const KOLOM = `id, nama, sumber, lat, lon, provinsi, kabupaten, kecamatan, kelurahan,
  kode_provinsi, kode_kabupaten, alamat, telepon, email, website, jam_operasional,
  layanan, jenis_rs, kelas_rs, kepemilikan, subkategori, kode_rs, kode_osm`

const angka = (n) => new Intl.NumberFormat('id-ID').format(n)

async function hitungRingkasan(koneksi) {
  const [r] = await koneksi.query(
    `SELECT COUNT(*) AS total,
            SUM(lat IS NOT NULL AND lon IS NOT NULL) AS berkoordinat,
            SUM(sumber = 'SIRS Kemenkes') AS sirs,
            SUM(sumber = 'OpenStreetMap') AS osm
       FROM fasilitas`,
  )
  const b = r[0]
  return {
    total: Number(b.total),
    berkoordinat: Number(b.berkoordinat),
    sirs: Number(b.sirs),
    osm: Number(b.osm),
  }
}

const koneksi = await mysql.createConnection(KONFIG)
try {
  const [baris] = await koneksi.query(`SELECT ${KOLOM} FROM fasilitas`)
  const sebelum = await hitungRingkasan(koneksi)
  const rencana = rencanakanDedup(baris)

  console.log(`\n== SEBELUM ==`)
  console.log(`  baris ${angka(sebelum.total)} · berkoordinat ${angka(sebelum.berkoordinat)} · SIRS ${angka(sebelum.sirs)} · OSM ${angka(sebelum.osm)}`)

  console.log(`\n== RENCANA ==`)
  console.log(`  duplikat dalam satu sumber : ${angka(rencana.ringkasan.dalamSumber)}`)
  console.log(`  duplikat lintas sumber     : ${angka(rencana.ringkasan.lintasSumber)}`)
  console.log(`  total akan dihapus         : ${angka(rencana.ringkasan.dihapus)}`)
  console.log(`  koordinat dipindahkan      : ${angka(rencana.ringkasan.digabungKoordinat)} baris SIRS`)
  console.log(`  sisa baris                 : ${angka(rencana.ringkasan.sisa)}`)
  const j = rencana.ringkasan.jarakDalamSumber
  console.log(`  jarak duplikat dalam sumber: ${angka(j.nol)} di titik yang sama, ${angka(j.sampai10)} ≤10 m, ${angka(j.sampai25)} ≤25 m, ${angka(j.sampai50)} ≤50 m`)

  const contoh = rencana.hapus.slice(0, 10)
  if (contoh.length) {
    console.log(`\n== CONTOH YANG DIHAPUS (10 pertama dari ${angka(rencana.hapus.length)}) ==`)
    const peta = new Map(baris.map((b) => [Number(b.id), b]))
    for (const h of contoh) {
      const b = peta.get(h.id)
      console.log(`  #${h.id} ${b?.nama ?? '?'} [${b?.sumber ?? '?'}] — ${h.alasan}`)
    }
  }

  if (!TERAPKAN) {
    console.log(`\nDRY RUN — tidak ada yang diubah. Jalankan dengan --terapkan untuk menghapus.\n`)
    process.exit(0)
  }

  if (!rencana.hapus.length) {
    console.log(`\nTidak ada duplikat. Tidak ada yang diubah.\n`)
    process.exit(0)
  }

  await koneksi.beginTransaction()
  try {
    /*
     * URUTAN PENTING: HAPUS dulu, baru pindahkan koordinat.
     *
     * `kode_osm` punya indeks UNIK. Kalau baris SIRS diisi `kode_osm` milik baris
     * OSM yang belum dihapus, MariaDB menolak dengan ER_DUP_ENTRY (kejadian nyata
     * 12 Nov 2026: 'Duplicate entry way/1226090267 for key uq_fasilitas_osm').
     */
    const id = rencana.hapus.map((h) => h.id)
    for (let i = 0; i < id.length; i += 500) {
      const potong = id.slice(i, i + 500)
      await koneksi.query(`DELETE FROM fasilitas WHERE id IN (${potong.map(() => '?').join(',')})`, potong)
    }

    for (const g of rencana.gabung) {
      await koneksi.query(
        `UPDATE fasilitas
            SET lat = ?, lon = ?,
                kode_osm = COALESCE(kode_osm, ?),
                diperbarui = NOW()
          WHERE id = ?`,
        [g.lat, g.lon, g.kodeOsm, g.id],
      )
    }
    await koneksi.commit()
  } catch (e) {
    await koneksi.rollback()
    throw e
  }

  const sesudah = await hitungRingkasan(koneksi)
  console.log(`\n== SESUDAH ==`)
  console.log(`  baris ${angka(sesudah.total)} · berkoordinat ${angka(sesudah.berkoordinat)} · SIRS ${angka(sesudah.sirs)} · OSM ${angka(sesudah.osm)}`)

  const diharap = rencana.ringkasan.sisa
  if (sesudah.total !== diharap) {
    console.error(`\nGAGAL: sisa baris ${sesudah.total}, seharusnya ${diharap}. Periksa database.`)
    process.exit(1)
  }
  console.log(`\nSelesai. ${angka(rencana.ringkasan.dihapus)} baris duplikat dihapus.\n`)
} finally {
  await koneksi.end()
}
