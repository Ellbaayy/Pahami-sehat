#!/usr/bin/env node
/**
 * Tarik SELURUH fasilitas kesehatan Indonesia dari OpenStreetMap.
 * ============================================================================
 *
 * MASALAH YANG DISELESAIKAN
 * -------------------------
 * Sampai 8 Nov 2026, tabel `fasilitas` hanya berisi 4.098 baris OpenStreetMap —
 * dan itu BUKAN tarikan nasional. Itu sisa pencarian radius 5–50 km di beberapa
 * kota demo (Jakarta, Bandung, Yogyakarta, …). Akibatnya terlihat jelas saat
 * pengguna menyaring "Apotek & Farmasi + Jawa Barat + Bekasi": yang muncul
 * hanya 5–24 apotek, padahal BPS Kabupaten Bekasi mencatat 107 apotek (2024)
 * dan OpenStreetMap sendiri punya 54 titik apotek di bounding box Bekasi.
 *
 * Data yang tidak lengkap BUKAN alasan untuk menampilkan angka kecil seolah
 * itu kenyataan. Skrip ini menariknya sekali, lengkap, lalu menyimpannya.
 *
 * CARA KERJA
 * ----------
 * 38 provinsi × satu kueri Overpass per provinsi. Kuncinya: area dicari lewat
 * kode ISO 3166-2 (`ID-JB`, `ID-JK`, …), bukan nama. Nama provinsi di OSM
 * bermacam-macam penulisannya, dan kueri berdasarkan nama pernah mengembalikan
 * 0 hasil untuk "Kabupaten Bekasi" padahal datanya ada.
 *
 * Karena setiap kueri sudah dibatasi satu provinsi, NAMA PROVINSI DIDAPAT
 * GRATIS dari kode ISO — tidak perlu geocoding balik 1 permintaan/detik.
 * Kabupaten tetap diisi dari tag `addr.city`/`addr.county` bila ada, atau
 * dikosongkan. Dikosongkan lebih jujur daripada ditebak.
 *
 * BIAYA: ±38 kueri × 30–70 detik ≈ 30–45 menit. Jalankan SEKALI.
 *
 * PEMAKAIAN
 * ---------
 *   node tarik-faskes-nasional.mjs                  semua provinsi
 *   node tarik-faskes-nasional.mjs --provinsi ID-JB hanya Jawa Barat
 *   node tarik-faskes-nasional.mjs --kering         hitung saja, tanpa menulis
 *   node tarik-faskes-nasional.mjs --mulai 10       lanjut dari provinsi ke-10
 *
 * Aman diulang: baris dicocokkan lewat `kode_osm` (unik), jadi tarikan kedua
 * memperbarui, bukan menggandakan.
 */

import mysql from './app/node_modules/mysql2/promise.js'
import { kategoriDari } from './app/server/faskes.js'

const arg = process.argv.slice(2)
const kering = arg.includes('--kering')
const ambilNilai = (nama) => {
  const i = arg.indexOf(nama)
  return i === -1 ? null : (arg[i + 1] ?? null)
}
const hanya = ambilNilai('--provinsi')
const mulai = Number(ambilNilai('--mulai') ?? 1) || 1

/** 38 provinsi Indonesia dengan kode ISO 3166-2 resmi. */
const PROVINSI = [
  { kode: 'ID-AC', nama: 'Aceh' },
  { kode: 'ID-SU', nama: 'Sumatera Utara' },
  { kode: 'ID-SB', nama: 'Sumatera Barat' },
  { kode: 'ID-RI', nama: 'Riau' },
  { kode: 'ID-JA', nama: 'Jambi' },
  { kode: 'ID-SS', nama: 'Sumatera Selatan' },
  { kode: 'ID-BE', nama: 'Bengkulu' },
  { kode: 'ID-LA', nama: 'Lampung' },
  { kode: 'ID-BB', nama: 'Kepulauan Bangka Belitung' },
  { kode: 'ID-KR', nama: 'Kepulauan Riau' },
  { kode: 'ID-JK', nama: 'DKI Jakarta' },
  { kode: 'ID-JB', nama: 'Jawa Barat' },
  { kode: 'ID-JT', nama: 'Jawa Tengah' },
  { kode: 'ID-YO', nama: 'Daerah Istimewa Yogyakarta' },
  { kode: 'ID-JI', nama: 'Jawa Timur' },
  { kode: 'ID-BT', nama: 'Banten' },
  { kode: 'ID-BA', nama: 'Bali' },
  { kode: 'ID-NB', nama: 'Nusa Tenggara Barat' },
  { kode: 'ID-NT', nama: 'Nusa Tenggara Timur' },
  { kode: 'ID-KB', nama: 'Kalimantan Barat' },
  { kode: 'ID-KT', nama: 'Kalimantan Tengah' },
  { kode: 'ID-KS', nama: 'Kalimantan Selatan' },
  { kode: 'ID-KI', nama: 'Kalimantan Timur' },
  { kode: 'ID-KU', nama: 'Kalimantan Utara' },
  { kode: 'ID-SA', nama: 'Sulawesi Utara' },
  { kode: 'ID-ST', nama: 'Sulawesi Tengah' },
  { kode: 'ID-SN', nama: 'Sulawesi Selatan' },
  { kode: 'ID-SG', nama: 'Sulawesi Tenggara' },
  { kode: 'ID-GO', nama: 'Gorontalo' },
  { kode: 'ID-SR', nama: 'Sulawesi Barat' },
  { kode: 'ID-MA', nama: 'Maluku' },
  { kode: 'ID-MU', nama: 'Maluku Utara' },
  { kode: 'ID-PA', nama: 'Papua' },
  { kode: 'ID-PB', nama: 'Papua Barat' },
  { kode: 'ID-PS', nama: 'Papua Selatan' },
  { kode: 'ID-PT', nama: 'Papua Tengah' },
  { kode: 'ID-PE', nama: 'Papua Pegunungan' },
  { kode: 'ID-PD', nama: 'Papua Barat Daya' },
]

const CERMIN = [
  'https://overpass-api.de/api/interpreter',
  'https://overpass.kumi.systems/api/interpreter',
  'https://overpass.private.coffee/api/interpreter',
]

const UA = 'PahamiSehat/1.0 (pendataan fasilitas kesehatan; +https://github.com/Ellbaayy/Pahami-sehat)'

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
 * Kueri satu provinsi.
 *
 * `nwr` = node + way + relation sekaligus: apotek dan klinik sering dipetakan
 * sebagai bangunan (way), bukan titik. Kueri yang hanya memakai `node` — seperti
 * pada pencarian radius lama — akan kehilangan sebagian besar apotek.
 */
function kueriProvinsi(kodeIso, batasDetik) {
  const SEMUA = '^(hospital|clinic|doctors|dentist|pharmacy|health_centre|laboratory|blood_donation)$'
  return `[out:json][timeout:${batasDetik}];
area["ISO3166-2"="${kodeIso}"]->.a;
(
  nwr["amenity"~"${SEMUA}"](area.a);
  nwr["healthcare"](area.a);
  nwr["shop"="optician"](area.a);
);
out center tags;`
}

async function tarikSatuProvinsi(kodeIso, batasDetik = 180) {
  const q = kueriProvinsi(kodeIso, batasDetik)
  let galatTerakhir = null
  for (const url of CERMIN) {
    try {
      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded', 'User-Agent': UA },
        body: 'data=' + encodeURIComponent(q),
        signal: AbortSignal.timeout((batasDetik + 60) * 1000),
      })
      if (!res.ok) {
        galatTerakhir = `HTTP ${res.status} dari ${url}`
        continue
      }
      const j = await res.json()
      const elemen = Array.isArray(j?.elements) ? j.elements : []

      /*
       * DAFTAR KOSONG DARI CERMIN = KEGAGALAN, BUKAN "PROVINSI INI TIDAK
       * PUNYA FASILITAS".
       *
       * Diukur 8 Nov 2026: Jawa Tengah mengembalikan 0 elemen setelah 185
       * detik (tepat di batas waktu) dan Yogyakarta 0 elemen padahal kueri
       * yang sama dijalankan manual memberi 743 elemen. Cermin yang kelebihan
       * beban membalas HTTP 200 dengan badan kosong — kalau dipercaya, data
       * satu provinsi hilang tanpa satu pun pesan galat.
       *
       * Karena itu hasil kosong diperlakukan sebagai kegagalan: coba cermin
       * berikutnya, dan kalau semuanya kosong, laporkan sebagai GAGAL.
       */
      if (!elemen.length) {
        galatTerakhir = `${url}: balasan kosong (0 elemen)`
        continue
      }

      return { elemen, sumber: url }
    } catch (e) {
      galatTerakhir = `${url}: ${e?.message ?? e}`
    }
  }
  throw new Error(galatTerakhir ?? 'semua cermin gagal')
}

/** Ambil koordinat dari node, atau dari `center` pada way/relation. */
function koordinat(e) {
  const lat = e.lat ?? e.center?.lat ?? null
  const lon = e.lon ?? e.center?.lon ?? null
  if (lat === null || lon === null) return null
  const a = Number(lat)
  const b = Number(lon)
  if (!Number.isFinite(a) || !Number.isFinite(b)) return null
  if (a === 0 && b === 0) return null
  if (a < -11.5 || a > 6.5 || b < 94 || b > 141.1) return null
  return { lat: a, lon: b }
}

async function utama() {
  const pool = mysql.createPool({ ...konfigurasiDb(), connectionLimit: 2, waitForConnections: true })
  try {
    const [kategori] = await pool.query('SELECT id, kode FROM kategori_fasilitas')
    const idKategori = new Map(kategori.map((k) => [k.kode, k.id]))

    const [awal] = await pool.query(
      "SELECT COUNT(*) AS n FROM fasilitas WHERE sumber = 'OpenStreetMap'",
    )
    console.log(`Baris OpenStreetMap di database sekarang: ${awal[0].n}`)

    const daftar = hanya ? PROVINSI.filter((p) => p.kode === hanya) : PROVINSI.slice(mulai - 1)
    if (!daftar.length) {
      console.error(`Provinsi "${hanya}" tidak dikenal. Pilihan: ${PROVINSI.map((p) => p.kode).join(', ')}`)
      process.exitCode = 1
      return
    }

    if (kering) {
      console.log(`--kering: akan menarik ${daftar.length} provinsi, tidak ada yang ditulis.`)
      console.log(`Perkiraan: ${daftar.length} × 45 detik ≈ ${Math.round((daftar.length * 45) / 60)} menit.`)
      return
    }

    const mulaiWaktu = Date.now()
    let totalBaru = 0
    let totalDiperbarui = 0
    let totalDilewati = 0

    for (let i = 0; i < daftar.length; i++) {
      const prov = daftar[i]
      const t0 = Date.now()
      process.stdout.write(`[${i + 1}/${daftar.length}] ${prov.nama} … `)

      let hasil
      try {
        hasil = await tarikSatuProvinsi(prov.kode)
      } catch (e) {
        console.log(`GAGAL (${e.message})`)
        continue
      }

      const baris = []
      for (const e of hasil.elemen) {
        const k = koordinat(e)
        if (!k) {
          totalDilewati++
          continue
        }
        const nama = e.tags?.name?.trim() || e.tags?.['name:id']?.trim() || null
        if (!nama) {
          totalDilewati++
          continue
        }
        const kat = kategoriDari(e.tags)
        if (!kat) {
          totalDilewati++
          continue
        }
        const kab = (e.tags?.['addr.city'] || e.tags?.['addr.county'] || '').trim() || null

        baris.push([
          /*
           * Format `node/123`, TANPA awalan `osm/`. Baris lama dari pencarian
           * radius memakai format ini juga; awalan `osm/` membuat tarikan baru
           * tidak pernah cocok dengan baris lama, sehingga seluruh 4.098 baris
           * tergandakan (diukur 8 Nov 2026: 3.963 duplikat).
           */
          `${e.type}/${e.id}`,
          nama.slice(0, 255),
          idKategori.get(kat.kategori) ?? null,
          kat.subkategori ? String(kat.subkategori).slice(0, 120) : null,
          prov.nama,
          kab ? String(kab).slice(0, 120) : null,
          k.lat,
          k.lon,
          e.tags?.phone ? String(e.tags.phone).slice(0, 60) : null,
          e.tags?.website ? String(e.tags.website).slice(0, 255) : null,
          e.tags?.opening_hours ? String(e.tags.opening_hours).slice(0, 200) : null,
          e.tags?.['addr:street']
            ? [e.tags['addr:street'], e.tags['addr:housenumber']].filter(Boolean).join(' ').slice(0, 255)
            : null,
        ])
      }

      if (baris.length) {
        /*
         * Satu INSERT per provinsi dengan ON DUPLICATE KEY UPDATE.
         * `kode_osm` unik — inilah yang membuat tarikan kedua memperbarui
         * baris lama, bukan menggandakannya. Tanpa ini, menjalankan skrip dua
         * kali akan melipatgandakan seluruh tabel.
         */
        /*
         * `kedaluwarsa` NOT NULL tanpa nilai bawaan (aturan tabel, dan
         * `uji-faskes-db.mjs` memeriksanya). Nilainya 18 bulan ke depan:
         * fasilitas OSM jarang berubah, dan baris yang lewat `kedaluwarsa`
         * tidak akan disajikan — mengisi tanggal terlalu dekat akan membuat
         * data hilang sendiri dari daftar tanpa sebab yang terlihat.
         */
        const kedaluwarsa = new Date(Date.now() + 548 * 24 * 60 * 60 * 1000)

        const SQL = `INSERT INTO fasilitas
            (kode_osm, nama, kategori_id, subkategori, provinsi, kabupaten, lat, lon,
             telepon, website, jam_operasional, alamat, sumber, diperbarui, kedaluwarsa)
           VALUES ?
           ON DUPLICATE KEY UPDATE
             nama = VALUES(nama), kategori_id = VALUES(kategori_id),
             subkategori = VALUES(subkategori), provinsi = VALUES(provinsi),
             kabupaten = COALESCE(VALUES(kabupaten), kabupaten),
             lat = VALUES(lat), lon = VALUES(lon),
             telepon = COALESCE(VALUES(telepon), telepon),
             website = COALESCE(VALUES(website), website),
             jam_operasional = COALESCE(VALUES(jam_operasional), jam_operasional),
             alamat = COALESCE(VALUES(alamat), alamat),
             sumber = VALUES(sumber), diperbarui = VALUES(diperbarui), hilang_pada = NULL`

        const dibungkus = baris.map((b) => [...b, 'OpenStreetMap', new Date(), kedaluwarsa])
        const [r] = await pool.query(SQL, [dibungkus])
        // affectedRows pada upsert = 1 per baris baru, 2 per baris yang berubah.
        const baru = Math.max(0, baris.length - Math.floor(r.affectedRows / 2))
        totalBaru += baru
        totalDiperbarui += baris.length - baru
      }

      const detik = ((Date.now() - t0) / 1000).toFixed(0)
      console.log(`${baris.length} faskes (${detik}s)`)
    }

    console.log('')
    console.log(`Selesai dalam ${((Date.now() - mulaiWaktu) / 60000).toFixed(1)} menit.`)
    console.log(`Baru: ${totalBaru} · diperbarui: ${totalDiperbarui} · dilewati: ${totalDilewati}`)

    const [akhir] = await pool.query(
      "SELECT COUNT(*) AS n FROM fasilitas WHERE sumber = 'OpenStreetMap'",
    )
    console.log(`Baris OpenStreetMap di database sekarang: ${akhir[0].n} (sebelumnya ${awal[0].n})`)
  } finally {
    await pool.end()
  }
}

utama().catch((e) => {
  console.error('GAGAL:', e?.message ?? e)
  process.exit(1)
})
