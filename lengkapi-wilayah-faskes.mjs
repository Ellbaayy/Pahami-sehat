#!/usr/bin/env node
/**
 * Lengkapi provinsi/kabupaten untuk fasilitas OpenStreetMap di database.
 * ============================================================================
 *
 * MASALAH YANG DISELESAIKAN
 * -------------------------
 * Tabel `fasilitas` berisi dua keluarga data:
 *   - "OpenStreetMap"  — 4.098 titik, PUNYA koordinat, TANPA provinsi
 *   - "SIRS Kemenkes"  — 3.325 rumah sakit, PUNYA provinsi, TANPA koordinat
 *
 * Daftar "Rumah Sakit Nasional" akan diperluas menjadi SEMUA fasilitas, dan
 * filternya memakai provinsi. Tanpa skrip ini, 4.098 fasilitas OSM tidak akan
 * pernah muncul saat pengguna menyaring provinsi.
 *
 * CARA KERJA
 * ----------
 * Geocoding balik Nominatim satu per satu (zoom 10 = tingkat kabupaten).
 * TIDAK mengarang: kalau Nomination tidak menjawab atau jawabannya kosong,
 * baris dibiarkan NULL dan dilaporkan. Nama provinsi dicocokkan ke tabel
 * `wilayah` supaya ejaan seragam dengan sumber lain.
 *
 * SOPAN TERHADAP LAYANAN PUBLIK
 * ----------------------------
 * 1 permintaan per detik (kebijakan Nominatim), User-Agent menyebut aplikasi.
 * Untuk 4.098 baris itu ± 70 menit; jalankan sekali, hasilnya disimpan.
 *
 * PEMAKAIAN
 * ---------
 *   node lengkapi-wilayah-faskes.mjs                semua yang belum punya provinsi
 *   node lengkapi-wilayah-faskes.mjs --batas 200    coba dulu sebagian
 *   node lengkapi-wilayah-faskes.mjs --kering       hitung saja, tanpa menulis
 *
 * Aman diulang: hanya baris dengan provinsi NULL yang diproses.
 */

import mysql from './app/node_modules/mysql2/promise.js'

const arg = process.argv.slice(2)
const kering = arg.includes('--kering')
const iBatas = arg.indexOf('--batas')
const batas = iBatas === -1 ? Infinity : Number(arg[iBatas + 1]) || Infinity

const UA = 'PahamiSehat/1.0 (pendidikan kesehatan; +https://github.com/Ellbaayy/Pahami-sehat)'
const JEDA_MS = 1100

const jeda = (ms) => new Promise((r) => setTimeout(r, ms))

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
 * Nama provinsi di Indonesia beda-beda penulisannya antar sumber
 * ("DI Yogyakarta" / "Daerah Istimewa Yogyakarta" / "Yogyakarta").
 * Peta ini menyamakan ke nama di tabel `wilayah`.
 */
const ALIAS_PROVINSI = {
  yogyakarta: 'Daerah Istimewa Yogyakarta',
  'di yogyakarta': 'Daerah Istimewa Yogyakarta',
  'daerah istimewa yogyakarta': 'Daerah Istimewa Yogyakarta',
  'dki jakarta': 'DKI Jakarta',
  jakarta: 'DKI Jakarta',
  'jakarta raya': 'DKI Jakarta',
  'daerah khusus ibukota jakarta': 'DKI Jakarta',
  'kepulauan bangka belitung': 'Kepulauan Bangka Belitung',
  'bangka belitung': 'Kepulauan Bangka Belitung',
  'kepulauan riau': 'Kepulauan Riau',
  'nusa tenggara barat': 'Nusa Tenggara Barat',
  'nusa tenggara timur': 'Nusa Tenggara Timur',
  papua: 'Papua',
}

/**
 * Kode ISO 3166-2:ID -> nama provinsi Indonesia.
 *
 * INI JALUR UTAMA, bukan cadangan. Diukur 8 Nov 2026: untuk wilayah DKI
 * Jakarta, Nominatim TIDAK mengisi `state` sama sekali — yang ada hanya
 * `city: "Jakarta Barat"` dan `ISO3166-2-lvl4: "ID-JK"`. Versi pertama skrip
 * ini membaca nama saja, sehingga sepertiga baris (Jakarta, dan kota besar
 * lain yang serupa) dilewati padahal jawabannya tersedia.
 *
 * Kode ISO lebih dipercaya daripada nama: ia tidak punya variasi ejaan.
 */
const KODE_ISO_PROVINSI = {
  'ID-AC': 'Aceh',
  'ID-SU': 'Sumatera Utara',
  'ID-SB': 'Sumatera Barat',
  'ID-RI': 'Riau',
  'ID-JA': 'Jambi',
  'ID-SS': 'Sumatera Selatan',
  'ID-BE': 'Bengkulu',
  'ID-LA': 'Lampung',
  'ID-BB': 'Kepulauan Bangka Belitung',
  'ID-KR': 'Kepulauan Riau',
  'ID-JK': 'DKI Jakarta',
  'ID-JB': 'Jawa Barat',
  'ID-JT': 'Jawa Tengah',
  'ID-YO': 'Daerah Istimewa Yogyakarta',
  'ID-JI': 'Jawa Timur',
  'ID-BT': 'Banten',
  'ID-BA': 'Bali',
  'ID-NB': 'Nusa Tenggara Barat',
  'ID-NT': 'Nusa Tenggara Timur',
  'ID-KB': 'Kalimantan Barat',
  'ID-KT': 'Kalimantan Tengah',
  'ID-KS': 'Kalimantan Selatan',
  'ID-KI': 'Kalimantan Timur',
  'ID-KU': 'Kalimantan Utara',
  'ID-SA': 'Sulawesi Utara',
  'ID-ST': 'Sulawesi Tengah',
  'ID-SN': 'Sulawesi Selatan',
  'ID-SG': 'Sulawesi Tenggara',
  'ID-GO': 'Gorontalo',
  'ID-SR': 'Sulawesi Barat',
  'ID-MA': 'Maluku',
  'ID-MU': 'Maluku Utara',
  'ID-PA': 'Papua',
  'ID-PB': 'Papua Barat',
  'ID-PS': 'Papua Selatan',
  'ID-PT': 'Papua Tengah',
  'ID-PE': 'Papua Pegunungan',
  'ID-PD': 'Papua Barat Daya',
}

/** Cocokkan nama provinsi hasil geocoding ke nama resmi di tabel wilayah. */
function rapikanProvinsi(nama, daftarResmi) {
  if (!nama) return null
  const bersih = String(nama).trim()
  const kunci = bersih.toLowerCase()

  const langsung = daftarResmi.find((p) => p.toLowerCase() === kunci)
  if (langsung) return langsung

  const alias = ALIAS_PROVINSI[kunci]
  if (alias) {
    const cocok = daftarResmi.find((p) => p.toLowerCase() === alias.toLowerCase())
    if (cocok) return cocok
  }

  // "Provinsi Jawa Barat" -> "Jawa Barat"
  const tanpaProvinsi = kunci.replace(/^provinsi\s+/, '')
  return daftarResmi.find((p) => p.toLowerCase() === tanpaProvinsi) ?? null
}

async function balikGeocoding(lat, lon) {
  const url =
    'https://nominatim.openstreetmap.org/reverse?format=jsonv2&zoom=10&addressdetails=1' +
    `&lat=${encodeURIComponent(lat)}&lon=${encodeURIComponent(lon)}`
  const res = await fetch(url, {
    headers: { 'User-Agent': UA, 'Accept-Language': 'id,en;q=0.8' },
    signal: AbortSignal.timeout(20000),
  })
  if (!res.ok) throw new Error(`HTTP ${res.status}`)
  const j = await res.json()
  return j?.address ?? null
}

async function utama() {
  const pool = mysql.createPool({ ...konfigurasiDb(), connectionLimit: 2, waitForConnections: true })
  try {
    const [provinsiResmi] = await pool.query(
      "SELECT nama FROM wilayah WHERE tingkat = 'provinsi' ORDER BY nama",
    )
    const daftarResmi = provinsiResmi.map((r) => r.nama)
    console.log(`Provinsi resmi di tabel wilayah: ${daftarResmi.length}`)

    const [baris] = await pool.query(
      `SELECT id, nama, lat, lon FROM fasilitas
        WHERE (provinsi IS NULL OR provinsi = '')
          AND lat IS NOT NULL AND lon IS NOT NULL
        ORDER BY id`,
    )
    console.log(`Fasilitas tanpa provinsi: ${baris.length}`)

    if (baris.length === 0) {
      console.log('Tidak ada yang perlu dilengkapi.')
      return
    }

    const target = baris.slice(0, batas)
    if (kering) {
      console.log(`--kering: ${target.length} baris akan diproses, tidak ada yang ditulis.`)
      console.log(`Perkiraan waktu: ${Math.round((target.length * JEDA_MS) / 60000)} menit.`)
      return
    }

    const mulai = Date.now()
    let berhasil = 0
    let gagal = 0
    let tanpaProvinsi = 0

    for (let i = 0; i < target.length; i++) {
      const f = target[i]
      try {
        const alamat = await balikGeocoding(Number(f.lat), Number(f.lon))
        /*
         * DKI JAKARTA TIDAK PUNYA `state`.
         *
         * Diukur 8 Nov 2026: untuk koordinat Jakarta, Nominatim menaruh
         * "Daerah Khusus Ibukota Jakarta" di `city`, sedangkan `state` kosong.
         * Versi pertama skrip ini hanya membaca `state`, sehingga SELURUH
         * Jakarta (dan kota lain yang serupa) dilewati — 20 baris pertama
         * semuanya "tanpa provinsi" padahal jawabannya ada.
         *
         * Urutannya: state -> region -> city. Yang terakhir hanya dipakai
         * kalau namanya memang salah satu provinsi resmi (diperiksa oleh
         * rapikanProvinsi), jadi kota biasa seperti "Kota Bandung" tidak akan
         * salah dianggap provinsi.
         */
        // Kode ISO lebih dulu (paling andal), baru nama, baru tebakan kota.
        const kodeIso = alamat?.['ISO3166-2-lvl4'] ?? alamat?.['ISO3166-2-lvl3'] ?? null
        let provinsi = null
        if (kodeIso && KODE_ISO_PROVINSI[kodeIso]) {
          provinsi = rapikanProvinsi(KODE_ISO_PROVINSI[kodeIso], daftarResmi)
        }
        if (!provinsi) {
          for (const c of [alamat?.state, alamat?.region, alamat?.city, alamat?.county]) {
            provinsi = rapikanProvinsi(c, daftarResmi)
            if (provinsi) break
          }
        }
        /*
         * Kabupaten TIDAK BOLEH berisi nama provinsi.
         *
         * Diukur 8 Nov 2026: untuk sebagian titik Jakarta, `city` diisi
         * "Daerah Khusus Ibukota Jakarta" — itu nama PROVINSI, bukan
         * kabupaten/kota. Akibatnya 390 baris punya kabupaten yang sama
         * dengan provinsinya, dan dropdown kabupaten menampilkan satu pilihan
         * raksasa yang tidak berarti.
         */
        const calonKab = [alamat?.city, alamat?.county, alamat?.municipality]
        let kabupaten = null
        for (const c of calonKab) {
          if (!c) continue
          if (c === provinsi) continue
          if (rapikanProvinsi(c, daftarResmi)) continue // nama provinsi lain
          kabupaten = c
          break
        }

        if (!provinsi) {
          tanpaProvinsi++
        } else {
          await pool.query('UPDATE fasilitas SET provinsi = ?, kabupaten = ? WHERE id = ?', [
            provinsi,
            kabupaten,
            f.id,
          ])
          berhasil++
        }
      } catch (e) {
        gagal++
        if (gagal <= 5) console.log(`  gagal ${f.id}: ${e.message}`)
      }

      if ((i + 1) % 100 === 0) {
        const menit = ((Date.now() - mulai) / 60000).toFixed(1)
        console.log(`  ${i + 1}/${target.length} — berhasil ${berhasil}, kosong ${tanpaProvinsi}, gagal ${gagal} (${menit} menit)`)
      }
      await jeda(JEDA_MS)
    }

    console.log('')
    console.log(`Selesai dalam ${((Date.now() - mulai) / 60000).toFixed(1)} menit.`)
    console.log(`Berhasil: ${berhasil} · tanpa provinsi: ${tanpaProvinsi} · gagal: ${gagal}`)
    if (berhasil + tanpaProvinsi + gagal !== target.length) {
      console.error('PERINGATAN: jumlah tidak cocok dengan yang diproses.')
      process.exitCode = 1
    }
  } finally {
    await pool.end()
  }
}

utama().catch((e) => {
  console.error('GAGAL:', e?.message ?? e)
  console.error('Pastikan MariaDB hidup dan internet tersedia.')
  process.exit(1)
})
