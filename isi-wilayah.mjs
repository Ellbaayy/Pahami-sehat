#!/usr/bin/env node
/**
 * Isi tabel `wilayah` dari wilayah.id untuk keperluan filter rumah sakit.
 * ============================================================================
 *
 * Yang diambil: **provinsi (38)** dan **kabupaten/kota (~514)**. Kecamatan dan
 * desa/kelurahan sengaja dilewati: SIRS tidak menyediakan kecamatan maupun
 * kelurahan sama sekali, jadi mengunduh ±7.000 + ±83.000 baris tidak akan
 * dipakai untuk apa pun. Kalau nanti dibutuhkan, tambahkan tingkatnya di sini.
 *
 * Kode wilayah disimpan apa adanya (bertitik, mis. `32.16`), karena kode itulah
 * identifier resmi — bukan namanya, yang bisa berubah.
 *
 * Sumber: https://wilayah.id/api/ — turunan resmi BPS/Kemendagri. Dipilih 4 Nov
 * 2026 setelah mengukur tiga sumber: wilayah.id 38 provinsi (benar),
 * emsifa.com 34 provinsi (usang, empat provinsi baru belum ada).
 *
 * Pemakaian:
 *   node isi-wilayah.mjs            isi / perbarui (idempoten)
 *   node isi-wilayah.mjs --cek      hanya laporkan, tanpa menulis
 */

import { readFileSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import mysql from './app/node_modules/mysql2/promise.js'

const AKAR = dirname(fileURLToPath(import.meta.url))
const API = 'https://wilayah.id/api'
const UA = 'PahamiSehat/1.0 (impor data wilayah administratif)'
const KERING = process.argv.includes('--cek')

const jeda = (ms) => new Promise((r) => setTimeout(r, ms))

async function ambilJson(url, coba = 4) {
  let terakhir
  for (let i = 1; i <= coba; i++) {
    try {
      const res = await fetch(url, { headers: { 'User-Agent': UA }, signal: AbortSignal.timeout(45_000) })
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const j = await res.json()
      if (!Array.isArray(j?.data)) throw new Error('balasan tanpa array data')
      return j.data
    } catch (e) {
      terakhir = e
      if (i < coba) await jeda(1200 * i)
    }
  }
  throw new Error(`${url}: ${terakhir?.message ?? terakhir}`)
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

async function main() {
  console.log('wilayah.id -> tabel `wilayah`')

  console.log('[1/3] provinsi…')
  const provinsi = await ambilJson(`${API}/provinces.json`)
  console.log(`      ${provinsi.length} provinsi`)

  const baris = provinsi.map((p) => ({ kode: p.code, nama: p.name, tingkat: 'provinsi', induk: null }))

  console.log('[2/3] kabupaten/kota…')
  let gagalProv = 0
  for (let i = 0; i < provinsi.length; i++) {
    const p = provinsi[i]
    try {
      const kab = await ambilJson(`${API}/regencies/${encodeURIComponent(p.code)}.json`)
      for (const k of kab) baris.push({ kode: k.code, nama: k.name, tingkat: 'kabupaten', induk: p.code })
      process.stdout.write(`\r      ${i + 1}/${provinsi.length} — ${baris.length} baris`)
    } catch (e) {
      gagalProv++
      console.log(`\n      GAGAL ${p.name}: ${e.message.slice(0, 80)}`)
    }
    await jeda(350)
  }
  console.log(`\n      total ${baris.length} baris (${gagalProv} provinsi gagal)`)

  if (KERING) {
    console.log('mode --cek: tidak ada yang ditulis.')
    return
  }

  console.log('[3/3] menulis ke MySQL…')
  const pool = mysql.createPool({ ...konfigurasiDb(), connectionLimit: 4 })
  try {
    // Induk ditulis lebih dulu: ada FOREIGN KEY kode_induk -> kode, jadi
    // menyisipkan kabupaten sebelum provinsinya akan ditolak.
    const urut = [...baris].sort((a, b) => (a.tingkat === 'provinsi' ? -1 : 1) - (b.tingkat === 'provinsi' ? -1 : 1))
    let n = 0
    for (let i = 0; i < urut.length; i += 200) {
      const batch = urut.slice(i, i + 200)
      const values = batch.map((b) => [b.kode, b.nama, b.tingkat, b.induk])
      await pool.query(
        `INSERT INTO wilayah (kode, nama, tingkat, kode_induk) VALUES ?
         ON DUPLICATE KEY UPDATE nama = VALUES(nama), tingkat = VALUES(tingkat),
                                 kode_induk = VALUES(kode_induk)`,
        [values],
      )
      n += batch.length
    }
    const [[h]] = await pool.query(
      `SELECT SUM(tingkat='provinsi') AS provinsi, SUM(tingkat='kabupaten') AS kabupaten FROM wilayah`,
    )
    console.log(`      tersimpan: ${n} baris (provinsi ${h.provinsi}, kabupaten ${h.kabupaten})`)

    // Provinsi SIRS harus bisa dicocokkan dengan tabel wilayah. Kalau tidak,
    // filter provinsi di antarmuka akan menampilkan pilihan yang tidak pernah
    // menghasilkan satu baris pun — dan itu tidak kelihatan sampai dicoba.
    const [sirs] = await pool.query(
      `SELECT DISTINCT provinsi FROM fasilitas WHERE sumber = 'SIRS Kemenkes' AND provinsi IS NOT NULL`,
    )
    const [wil] = await pool.query(`SELECT nama FROM wilayah WHERE tingkat = 'provinsi'`)
    const namaWil = new Set(wil.map((w) => w.nama.toLowerCase()))
    const tidakCocok = sirs.map((s) => s.provinsi).filter((p) => !namaWil.has(String(p).toLowerCase()))
    console.log('')
    console.log(`      provinsi SIRS: ${sirs.length} | ada di tabel wilayah: ${sirs.length - tidakCocok.length}`)
    if (tidakCocok.length) console.log(`      BELUM COCOK: ${tidakCocok.join(', ')}`)
    else console.log('      semua provinsi SIRS cocok dengan tabel wilayah.')
  } finally {
    await pool.end()
  }
}

try {
  await main()
} catch (e) {
  console.error('GAGAL:', e?.message ?? e)
  process.exitCode = 1
}
