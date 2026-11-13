#!/usr/bin/env node
/**
 * Isi kolom kabupaten/kota untuk fasilitas berdasarkan BATAS WILAYAH RESMI.
 * ============================================================================
 *
 * MASALAH YANG DISELESAIKAN
 * -------------------------
 * Filter "Kabupaten/Kota" di halaman Fasilitas Kesehatan hampir tidak berguna
 * karena 18.103 dari 18.152 baris OpenStreetMap tidak punya kabupaten.
 * Penyebabnya: OSM jarang mengisi tag `addr:city` — diukur 8 Nov 2026, hanya
 * 49 baris yang punya. Provinsi bisa didapat gratis dari kode ISO saat
 * menarik data, tapi kabupaten tidak bisa.
 *
 * MENEBak DARI NAMA KOTA ADALAH SALAH
 * -----------------------------------
 * Cara yang gampang — cocokkan nama di `addr:*` dengan daftar kabupaten —
 * tidak bisa dipakai karena datanya memang tidak ada. Dan menebak dari kota
 * terdekat akan menempatkan fasilitas di kabupaten yang salah, persis jenis
 * kesalahan yang tidak boleh muncul di aplikasi kesehatan.
 *
 * CARA YANG DIPAKAI: TITIK-DI-DALAM-POLIGON
 * -----------------------------------------
 * geoBoundaries (gbOpen, CC BY 3.0 IGO) menyediakan batas ADM2 Indonesia —
 * 519 kabupaten/kota, bersumber dari BPS. Untuk setiap fasilitas berkoordinat,
 * cari poligon yang memuat titiknya. Hasilnya deterministik dan bisa diperiksa:
 * kalau titiknya di dalam poligon Bekasi, kabupatennya Bekasi.
 *
 * Batas disederhanakan (simplified) supaya 11 MB, bukan 100 MB. Penyederhanaan
 * itu bisa membuat titik tepat di garis batas jatuh ke sisi yang salah — untuk
 * keperluan filter daftar, itu dapat diterima dan TIDAK mengubah koordinat
 * fasilitasnya. Baris yang tidak jatuh di poligon mana pun dibiarkan NULL dan
 * dilaporkan, bukan dipaksa masuk.
 *
 * PEMAKAIAN
 * ---------
 *   node petakan-kabupaten-faskes.mjs              isi semua yang kosong
 *   node petakan-kabupaten-faskes.mjs --kering     hitung saja
 *   node petakan-kabupaten-faskes.mjs --batas 500  coba dulu sebagian
 *
 * Aman diulang: hanya baris dengan kabupaten kosong yang diproses.
 */

import { readFileSync, existsSync, writeFileSync } from 'node:fs'
import mysql from './app/node_modules/mysql2/promise.js'
import { pisahJenis } from './app/server/geocoding.js'

const arg = process.argv.slice(2)
const kering = arg.includes('--kering')
const iBatas = arg.indexOf('--batas')
const batas = iBatas === -1 ? Infinity : Number(arg[iBatas + 1]) || Infinity

const BERKAS_BATAS = '/tmp/adm2.geojson'
const URL_BATAS =
  'https://github.com/wmgeolab/geoBoundaries/raw/9469f09/releaseData/gbOpen/IDN/ADM2/geoBoundaries-IDN-ADM2_simplified.geojson'

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

/**
 * Uji titik di dalam cincin poligon.
 *
 * Algoritma ray casting: tarik garis mendatar dari titik ke kanan, hitung
 * berapa kali garis itu memotong tepi poligon. Ganjil = di dalam.
 * Ini bukan uji geodesik — untuk poligon kecil di Indonesia, selisihnya
 * jauh di bawah ketelitian yang dibutuhkan filter daftar.
 */
function diDalamCincin(x, y, cincin) {
  let di = false
  for (let i = 0, j = cincin.length - 1; i < cincin.length; j = i++) {
    const xi = cincin[i][0]
    const yi = cincin[i][1]
    const xj = cincin[j][0]
    const yj = cincin[j][1]
    const memotong = yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi
    if (memotong) di = !di
  }
  return di
}

/** Poligon bisa Polygon (satu cincin luar) atau MultiPolygon (banyak). */
function diDalamGeometri(x, y, geometri) {
  if (!geometri) return false
  if (geometri.type === 'Polygon') {
    // Cincin pertama = batas luar; sisanya lubang. Titik harus di luar semua lubang.
    const [luar, ...lubang] = geometri.coordinates
    if (!diDalamCincin(x, y, luar)) return false
    return !lubang.some((l) => diDalamCincin(x, y, l))
  }
  if (geometri.type === 'MultiPolygon') {
    return geometri.coordinates.some((poli) => {
      const [luar, ...lubang] = poli
      if (!diDalamCincin(x, y, luar)) return false
      return !lubang.some((l) => diDalamCincin(x, y, l))
    })
  }
  return false
}

/** Kotak pembatas tiap fitur — menyaring cepat sebelum uji poligon penuh. */
function kotak(geometri) {
  let minX = Infinity
  let minY = Infinity
  let maxX = -Infinity
  let maxY = -Infinity
  const telusuri = (koord) => {
    if (typeof koord[0] === 'number') {
      const [x, y] = koord
      if (x < minX) minX = x
      if (x > maxX) maxX = x
      if (y < minY) minY = y
      if (y > maxY) maxY = y
      return
    }
    for (const k of koord) telusuri(k)
  }
  telusuri(geometri.coordinates)
  return { minX, minY, maxX, maxY }
}

async function muatBatas() {
  if (!existsSync(BERKAS_BATAS)) {
    console.log(`Mengunduh batas wilayah ADM2 (±11 MB) ke ${BERKAS_BATAS} …`)
    const res = await fetch(URL_BATAS, { signal: AbortSignal.timeout(180000) })
    if (!res.ok) throw new Error(`unduhan gagal: HTTP ${res.status}`)
    writeFileSync(BERKAS_BATAS, Buffer.from(await res.arrayBuffer()))
  }
  const f = JSON.parse(readFileSync(BERKAS_BATAS, 'utf8'))
  const daftar = f.features
    .map((x) => ({
      nama: String(x.properties?.shapeName ?? '').trim(),
      geometri: x.geometry,
      kotak: kotak(x.geometry),
    }))
    .filter((x) => x.nama && x.geometri)
  return daftar
}

/** Nama kabupaten/kota dari geoBoundaries -> bentuk yang dipakai aplikasi. */
function rapikanNama(nama) {
  const n = nama.trim()
  // geoBoundaries menulis "Bekasi" untuk kabupaten dan "Kota Bekasi" untuk kota.
  // Bentuk itu sudah sama dengan yang dipakai di tabel `fasilitas`.
  return n
}

async function utama() {
  console.log('Memuat batas wilayah ADM2 (BPS via geoBoundaries) …')
  const wilayah = await muatBatas()
  console.log(`  ${wilayah.length} kabupaten/kota dimuat`)

  const pool = mysql.createPool({ ...konfigurasiDb(), connectionLimit: 3, waitForConnections: true })
  try {
    /*
     * Peta kabupaten -> provinsi dari tabel `wilayah`.
     *
     * KENAPA (12 Nov 2026): skrip ini dulu HANYA mengisi `kabupaten`. Baris yang
     * provinsinya kosong sejak tarikan OSM berakhir dengan kabupaten terisi +
     * provinsi kosong — dan di antarmuka kabupaten seperti itu tidak bisa dipilih
     * sama sekali (dropdown kabupaten disaring menurut provinsi). Terukur 61 baris
     * yang mustahil ditemukan lewat saringan lokasi. Sekarang provinsinya ikut diisi
     * dari kabupaten yang baru dipetakan, bukan ditebak dari poligon.
     */
    const petaProvinsi = new Map()
    const [wilayahResmi] = await pool.query(
      `SELECT w.nama AS kabupaten, p.nama AS provinsi
         FROM wilayah w JOIN wilayah p ON p.kode = w.kode_induk
        WHERE w.tingkat = 'kabupaten' AND p.tingkat = 'provinsi'`,
    )
    for (const w of wilayahResmi) {
      const { jenis, nama } = pisahJenis(w.kabupaten)
      petaProvinsi.set(`${jenis}|${nama}`, w.provinsi)
    }
    const provinsiDari = (kabupaten) => {
      const { jenis, nama } = pisahJenis(kabupaten)
      return petaProvinsi.get(`${jenis}|${nama}`) ?? null
    }

    const [baris] = await pool.query(
      `SELECT id, nama, lat, lon, provinsi FROM fasilitas
        WHERE (kabupaten IS NULL OR kabupaten = '')
          AND lat IS NOT NULL AND lon IS NOT NULL`,
    )
    console.log(`Fasilitas tanpa kabupaten: ${baris.length}`)

    if (!baris.length) {
      console.log('Tidak ada yang perlu diisi.')
      return
    }

    const target = baris.slice(0, batas)
    if (kering) {
      console.log(`--kering: ${target.length} baris akan dipetakan, tidak ada yang ditulis.`)
      return
    }

    const mulai = Date.now()
    let kena = 0
    let tidakKena = 0
    const perKabupaten = new Map()

    for (let i = 0; i < target.length; i++) {
      const f = target[i]
      const x = Number(f.lon)
      const y = Number(f.lat)

      let namaKab = null
      for (const w of wilayah) {
        const k = w.kotak
        if (x < k.minX || x > k.maxX || y < k.minY || y > k.maxY) continue
        if (diDalamGeometri(x, y, w.geometri)) {
          namaKab = rapikanNama(w.nama)
          break
        }
      }

      if (namaKab) {
        const prov = provinsiDari(namaKab)
        await pool.query(
          'UPDATE fasilitas SET kabupaten = ?, provinsi = COALESCE(NULLIF(provinsi, \'\'), ?) WHERE id = ?',
          [namaKab, prov, f.id],
        )
        perKabupaten.set(namaKab, (perKabupaten.get(namaKab) ?? 0) + 1)
        kena++
      } else {
        tidakKena++
      }

      if ((i + 1) % 1000 === 0) {
        const menit = ((Date.now() - mulai) / 60000).toFixed(1)
        console.log(`  ${i + 1}/${target.length} — terisi ${kena}, tanpa poligon ${tidakKena} (${menit} menit)`)
      }
    }

    console.log('')
    console.log(`Selesai dalam ${((Date.now() - mulai) / 60000).toFixed(1)} menit.`)
    console.log(`Terisi: ${kena} · tidak jatuh di poligon mana pun: ${tidakKena}`)

    const teratas = [...perKabupaten.entries()].sort((a, b) => b[1] - a[1]).slice(0, 10)
    if (teratas.length) {
      console.log('Kabupaten/kota terbanyak:')
      for (const [n, c] of teratas) console.log(`  ${n}: ${c}`)
    }
  } finally {
    await pool.end()
  }
}

utama().catch((e) => {
  console.error('GAGAL:', e?.message ?? e)
  process.exit(1)
})
