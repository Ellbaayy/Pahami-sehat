/**
 * Rumah sakit resmi Kemenkes (SIRS) — pencarian, filter, dan rincian.
 * ============================================================================
 *
 * BEDA DENGAN `faskesDb.js`
 * -------------------------
 * `faskesDb.js` menyimpan fasilitas OpenStreetMap: punya koordinat, dipakai
 * untuk peta radius. Modul ini melayani data RESMI SIRS: 3.325 rumah sakit
 * nasional, **tanpa koordinat sama sekali** (diukur 4 Nov 2026 — lihat
 * `impor-sirs.mjs`).
 *
 * Karena itu dua jalur ini sengaja dipisah penyajiannya. Mencampur keduanya
 * dalam satu daftar radius akan membuat RS tanpa koordinat tampil seolah punya
 * lokasi akurat, dan itu dilarang.
 *
 * POLA WAJIB PROYEK: database OPSIONAL. Semua fungsi mengembalikan null/kosong
 * kalau DB mati, dan pemanggil tetap jalan.
 */

import { eksekusi } from './db.js'

const SUMBER = 'SIRS Kemenkes'

/** Batas atas satu halaman. Daftar bisa besar, tetapi tidak boleh tanpa batas. */
const MAKS_HALAMAN = 500

const KOLOM = `
  f.id, f.kode_rs, f.nama, f.jenis_rs, f.kelas_rs, f.kepemilikan,
  f.status_operasional, f.provinsi, f.kabupaten, f.kecamatan, f.kelurahan,
  f.kode_provinsi, f.kode_kabupaten, f.alamat, f.telepon, f.email, f.website,
  f.lat, f.lon, f.sumber, f.url_sumber, f.disinkron_pada, f.hilang_pada,
  f.status_verifikasi
`

const rapikan = (b) => ({
  ...b,
  lat: b.lat === null ? null : Number(b.lat),
  lon: b.lon === null ? null : Number(b.lon),
  // Koordinat hanya dianggap ada kalau KEDUANYA terisi dan masuk akal untuk
  // Indonesia. Baris dengan 0,0 (Null Island) ditolak: itu bukan lokasi.
  adaKoordinat:
    b.lat !== null &&
    b.lon !== null &&
    Number(b.lat) !== 0 &&
    Number(b.lon) !== 0 &&
    Number(b.lat) > -11.5 &&
    Number(b.lat) < 6.5 &&
    Number(b.lon) > 94 &&
    Number(b.lon) < 141.1,
  // Rumah sakit yang sudah tidak muncul di tarikan terakhir TIDAK disembunyikan
  // diam-diam; ditandai supaya antarmuka bisa memberi tahu.
  masihAktif: !b.hilang_pada,
})

/**
 * Cari rumah sakit SIRS dengan filter.
 *
 * @param {object} opsi
 * @param {string} [opsi.cari]        cocokkan nama (LIKE, aman dari injeksi)
 * @param {string} [opsi.provinsi]    nama provinsi persis
 * @param {string} [opsi.kabupaten]   kode kabupaten (mis. "32.16") atau nama
 * @param {string} [opsi.kelas]       A / B / C / D / D PRATAMA / Non Kelas …
 * @param {string} [opsi.jenis]       RSU / RSIA / RSK Jiwa …
 * @param {string} [opsi.kepemilikan] Pemprop / Pemkab / TNI AD / SWASTA/LAINNYA …
 * @param {boolean} [opsi.hanyaKoordinat] hanya yang punya koordinat valid
 * @param {number} [opsi.halaman]     1-based
 * @param {number} [opsi.perHalaman]
 * @returns {Promise<{daftar: object[], total: number, halaman: number, perHalaman: number}|null>}
 */
export async function cariRsSirs({
  cari = null,
  provinsi = null,
  kabupaten = null,
  kelas = null,
  jenis = null,
  kepemilikan = null,
  hanyaKoordinat = false,
  halaman = 1,
  perHalaman = 50,
} = {}) {
  const syarat = ['f.sumber = ?']
  const nilai = [SUMBER]

  if (cari) {
    // `%` dan `_` di masukan pengguna harus di-escape, kalau tidak pencarian
    // "50%" akan cocok dengan semua baris.
    const bersih = String(cari).replace(/[\\%_]/g, (m) => `\\${m}`)
    syarat.push('(f.nama LIKE ? OR f.alamat LIKE ?)')
    nilai.push(`%${bersih}%`, `%${bersih}%`)
  }
  if (provinsi) {
    syarat.push('f.provinsi = ?')
    nilai.push(provinsi)
  }
  if (kabupaten) {
    // Terima kode ("32.16") maupun nama ("Kabupaten Bekasi" / "Bekasi").
    if (/^\d{2}\.\d{2}$/.test(String(kabupaten))) {
      syarat.push('f.kode_kabupaten = ?')
      nilai.push(kabupaten)
    } else {
      syarat.push('f.kabupaten = ?')
      nilai.push(kabupaten)
    }
  }
  if (kelas) {
    syarat.push('f.kelas_rs = ?')
    nilai.push(kelas)
  }
  if (jenis) {
    syarat.push('f.jenis_rs = ?')
    nilai.push(jenis)
  }
  if (kepemilikan) {
    syarat.push('f.kepemilikan = ?')
    nilai.push(kepemilikan)
  }
  if (hanyaKoordinat) {
    syarat.push('f.lat IS NOT NULL AND f.lon IS NOT NULL')
  }

  const di = Math.min(Math.max(Number(halaman) || 1, 1), MAKS_HALAMAN)
  const n = Math.min(Math.max(Number(perHalaman) || 50, 1), MAKS_HALAMAN)
  const offset = (di - 1) * n

  const where = syarat.join(' AND ')
  const hitung = await eksekusi(`SELECT COUNT(*) AS total FROM fasilitas f WHERE ${where}`, nilai)
  if (!hitung) return null
  const total = Number(hitung[0]?.total ?? 0)

  // Urutan: provinsi lalu nama, supaya halaman berikutnya stabil dan tidak ada
  // baris yang terlewat/berulang antar halaman.
  const baris = await eksekusi(
    `SELECT ${KOLOM} FROM fasilitas f WHERE ${where}
      ORDER BY f.provinsi ASC, f.nama ASC, f.id ASC
      LIMIT ${n} OFFSET ${offset}`,
    nilai,
  )
  if (!baris) return null

  return { daftar: baris.map(rapikan), total, halaman: di, perHalaman: n }
}

/** Rincian satu rumah sakit menurut kode SIRS. */
export async function rsSirsMenurutKode(kode) {
  const r = await eksekusi(`SELECT ${KOLOM} FROM fasilitas f WHERE f.sumber = ? AND f.kode_rs = ?`, [
    SUMBER,
    String(kode),
  ])
  if (!r || !r.length) return null
  return rapikan(r[0])
}

/**
 * Nilai unik untuk mengisi dropdown filter.
 *
 * Diambil dari database, bukan dari daftar tetap di kode — kalau Kemenkes
 * menambah kelas atau kepemilikan baru, filternya ikut tanpa perlu ubah kode.
 */
export async function pilihanFilterSirs() {
  const ambil = async (kolom) => {
    const r = await eksekusi(
      `SELECT ${kolom} AS nilai, COUNT(*) AS jumlah FROM fasilitas
        WHERE sumber = ? AND ${kolom} IS NOT NULL AND ${kolom} <> ''
        GROUP BY ${kolom} ORDER BY jumlah DESC`,
      [SUMBER],
    )
    return r ? r.map((x) => ({ nilai: x.nilai, jumlah: Number(x.jumlah) })) : []
  }

  const provinsi = await ambil('provinsi')
  if (!provinsi.length) return null

  const [jenis, kelas, kepemilikan] = await Promise.all([
    ambil('jenis_rs'),
    ambil('kelas_rs'),
    ambil('kepemilikan'),
  ])

  // Kabupaten dikelompokkan per provinsi supaya dropdown bertingkat bisa dipakai
  // tanpa memuat 514 baris sekaligus.
  const kab = await eksekusi(
    `SELECT provinsi, kode_kabupaten AS kode, kabupaten AS nama, COUNT(*) AS jumlah
       FROM fasilitas
      WHERE sumber = ? AND kode_kabupaten IS NOT NULL
      GROUP BY provinsi, kode_kabupaten, kabupaten
      ORDER BY provinsi ASC, kabupaten ASC`,
    [SUMBER],
  )

  return {
    provinsi,
    jenis,
    kelas,
    kepemilikan,
    kabupaten: kab ? kab.map((x) => ({ ...x, jumlah: Number(x.jumlah) })) : [],
  }
}

/** Ringkasan isi database — dipakai /api/rs/ringkasan dan laporan. */
export async function ringkasanSirs() {
  const r = await eksekusi(
    `SELECT COUNT(*) AS total,
            SUM(lat IS NOT NULL AND lon IS NOT NULL) AS berkoordinat,
            SUM(kode_kabupaten IS NOT NULL) AS berkode_kabupaten,
            SUM(hilang_pada IS NOT NULL) AS ditandai_hilang,
            MAX(disinkron_pada) AS sinkron_terakhir
       FROM fasilitas WHERE sumber = ?`,
    [SUMBER],
  )
  if (!r || !r.length) return null
  const b = r[0]
  return {
    total: Number(b.total ?? 0),
    berkoordinat: Number(b.berkoordinat ?? 0),
    berkodeKabupaten: Number(b.berkode_kabupaten ?? 0),
    ditandaiHilang: Number(b.ditandai_hilang ?? 0),
    sinkronTerakhir: b.sinkron_terakhir,
  }
}
