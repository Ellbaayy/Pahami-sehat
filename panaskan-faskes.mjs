#!/usr/bin/env node
/**
 * Panaskan simpanan fasilitas untuk lokasi yang akan didemokan.
 * ============================================================================
 *
 * KENAPA ADA
 * ----------
 * Overpass (sumber data OSM) butuh 37-49 detik untuk satu area yang belum
 * pernah diambil. Demi demo di depan juri itu terlalu lama, jadi permintaan
 * dari aplikasi diberi batas 9,5 detik dan memakai simpanan database bila ada.
 *
 * Artinya: area yang BELUM pernah diambil akan menjawab "coba lagi" setelah
 * 9,5 detik. Skrip ini mengisi simpanan itu lebih dulu — tanpa batas ketat —
 * sehingga saat juri menekan "Cari", jawabannya datang dari database dalam
 * hitungan milidetik.
 *
 * PEMAKAIAN
 * ---------
 *   node panaskan-faskes.mjs --lat -7.79084 --lon 110.36687
 *   node panaskan-faskes.mjs --tempat "Danurejan, Yogyakarta"
 *   node panaskan-faskes.mjs --daftar lokasi-demo.txt
 *   node panaskan-faskes.mjs --lat -7.79 --lon 110.37 --radius 10000
 *
 * `--daftar` membaca satu lokasi per baris; tiap baris boleh berisi
 * "lat,lon" atau nama tempat.
 *
 * Aman diulang: baris fasilitas diperbarui (kode OSM unik), dan catatan
 * cakupan diperbarui waktunya.
 *
 * WAJIB: XAMPP/MariaDB hidup. Butuh internet (Overpass).
 */

import { readFileSync } from 'node:fs'
import { faskesSekitar } from './app/server/faskes.js'
import { simpanBanyak, catatCakupan } from './app/server/faskesDb.js'

const arg = process.argv.slice(2)
const ambil = (nama, bawaan = null) => {
  const i = arg.indexOf(nama)
  return i === -1 ? bawaan : arg[i + 1]
}

const radius = Number(ambil('--radius', '5000'))
const batasMs = Number(ambil('--batas', '120000'))

/** Nama tempat -> koordinat lewat Nominatim (butuh internet). */
async function cariTempat(nama) {
  const url =
    'https://nominatim.openstreetmap.org/search?format=jsonv2&limit=1&countrycodes=id' +
    `&q=${encodeURIComponent(nama)}`
  const res = await fetch(url, {
    headers: {
      'User-Agent': 'PahamiSehat/1.0 (pendidikan kesehatan; +https://github.com/Ellbaayy/Pahami-sehat)',
      'Accept-Language': 'id,en;q=0.8',
    },
    signal: AbortSignal.timeout(20000),
  })
  if (!res.ok) throw new Error(`Nominatim HTTP ${res.status}`)
  const j = await res.json()
  if (!Array.isArray(j) || j.length === 0) throw new Error(`tempat "${nama}" tidak ditemukan`)
  return { lat: Number(j[0].lat), lon: Number(j[0].lon), label: j[0].display_name.split(',')[0] }
}

/** Satu titik: ambil dari Overpass tanpa batas ketat, lalu simpan. */
async function panaskan(lat, lon, label) {
  const mulai = Date.now()
  process.stdout.write(`  ${label ?? `${lat},${lon}`} (radius ${radius} m) ... `)
  const data = await faskesSekitar({ lat, lon, radius, batasMs })
  const detik = ((Date.now() - mulai) / 1000).toFixed(1)

  const jumlah = data.fasilitas.length
  await simpanBanyak(data.fasilitas.map((f) => ({ ...f, kode_osm: f.id })))
  const utuh = !(data.dipotong > 0)
  if (utuh && jumlah > 0) await catatCakupan(lat, lon, radius, jumlah)

  console.log(`${jumlah} fasilitas, ${detik} detik${utuh ? '' : ` (TERPOTONG ${data.dipotong}, cakupan tidak dicatat)`}`)
  return jumlah
}

async function utama() {
  const daftar = []

  const lat = ambil('--lat')
  const lon = ambil('--lon')
  if (lat && lon) daftar.push({ lat: Number(lat), lon: Number(lon) })

  const tempat = ambil('--tempat')
  if (tempat) daftar.push(await cariTempat(tempat))

  const berkas = ambil('--daftar')
  if (berkas) {
    for (const baris of readFileSync(berkas, 'utf8').split('\n')) {
      const t = baris.trim()
      if (!t || t.startsWith('#')) continue
      const m = t.match(/^(-?\d+(?:\.\d+)?)\s*,\s*(-?\d+(?:\.\d+)?)$/)
      if (m) daftar.push({ lat: Number(m[1]), lon: Number(m[2]) })
      else daftar.push(await cariTempat(t))
    }
  }

  if (daftar.length === 0) {
    console.error('Sebutkan lokasi. Contoh:')
    console.error('  node panaskan-faskes.mjs --lat -7.79084 --lon 110.36687')
    console.error('  node panaskan-faskes.mjs --tempat "Danurejan, Yogyakarta"')
    process.exit(1)
  }

  console.log(`Memanaskan ${daftar.length} lokasi (batas ${Math.round(batasMs / 1000)} detik per lokasi)`)
  let total = 0
  for (const d of daftar) total += await panaskan(d.lat, d.lon, d.label)

  console.log('')
  console.log(`Selesai. ${total} fasilitas tersimpan/terbarui.`)
  console.log('Sekarang tombol "Cari" di area itu menjawab dari database (puluhan milidetik),')
  console.log('selama catatan cakupan masih segar (6 jam). Ulangi skrip ini sebelum demo.')
}

utama().catch((e) => {
  console.error('GAGAL:', e?.message ?? e)
  console.error('Pastikan MariaDB hidup dan internet tersedia.')
  process.exit(1)
})
