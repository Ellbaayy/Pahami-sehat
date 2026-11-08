/**
 * Pencarian SELURUH fasilitas kesehatan nasional — filter, paginasi, rincian.
 * ============================================================================
 *
 * MENGGANTIKAN `rsSirs.js` SEBAGAI JALUR PENCARIAN
 * ------------------------------------------------
 * `rsSirs.js` hanya melayani rumah sakit SIRS (3.325 baris, tanpa koordinat).
 * Sejak 8 Nov 2026 fitur "Rumah Sakit Nasional" diperluas menjadi SELURUH
 * fasilitas yang kita punya: 3.325 rumah sakit resmi Kemenkes + 4.098 fasilitas
 * OpenStreetMap (klinik, puskesmas, apotek, laboratorium, dan seterusnya).
 *
 * YANG TETAP DIJAGA DARI VERSI LAMA
 * ---------------------------------
 * 1. Fasilitas OSM dan SIRS TIDAK PERNAH digabung menjadi satu baris. Satu
 *    fasilitas bisa ada di kedua sumber dengan nama mirip; menggabungkannya
 *    berarti mengarang keyakinan bahwa keduanya entitas yang sama.
 * 2. Koordinat tidak pernah dikarang. Baris tanpa koordinat tetap muncul di
 *    daftar (dengan penanda), tetapi tidak pernah dianggap punya titik peta.
 * 3. Database OPSIONAL: kalau DB mati, semua fungsi mengembalikan null dan
 *    pemanggil menjawab 503 dengan pesan jelas.
 */

import { eksekusi } from './db.js'

/** Batas atas satu halaman. */
const MAKS_HALAMAN = 500

const KOLOM = `
  f.id, f.kode_osm, f.kode_rs, f.nama, f.kategori_id, k.label AS kategori,
  f.subkategori, f.jenis_rs, f.kelas_rs, f.kepemilikan, f.status_operasional,
  f.provinsi, f.kabupaten, f.kecamatan, f.kelurahan,
  f.kode_provinsi, f.kode_kabupaten, f.alamat, f.telepon, f.email, f.website,
  f.jam_operasional, f.layanan, f.igd, f.buka_24_jam,
  f.lat, f.lon, f.sumber, f.url_sumber, f.status_verifikasi,
  f.disinkron_pada, f.hilang_pada
`

/**
 * Koordinat hanya dianggap ada kalau KEDUANYA terisi dan masuk akal untuk
 * Indonesia. Baris dengan 0,0 (Null Island) ditolak: itu bukan lokasi.
 */
function adaKoordinatSah(lat, lon) {
  if (lat === null || lon === null || lat === undefined || lon === undefined) return false
  const a = Number(lat)
  const b = Number(lon)
  if (!Number.isFinite(a) || !Number.isFinite(b)) return false
  if (a === 0 && b === 0) return false
  return a > -11.5 && a < 6.5 && b > 94 && b < 141.1
}

const rapikan = (b) => ({
  ...b,
  kategori_id: b.kategori_id === null ? null : Number(b.kategori_id),
  lat: b.lat === null ? null : Number(b.lat),
  lon: b.lon === null ? null : Number(b.lon),
  adaKoordinat: adaKoordinatSah(b.lat, b.lon),
  igd: b.igd === null ? null : Boolean(b.igd),
  buka_24_jam: Boolean(b.buka_24_jam),
  masihAktif: !b.hilang_pada,
})

/**
 * Cari fasilitas nasional dengan filter.
 *
 * @param {object} opsi
 * @param {string} [opsi.cari]        cocokkan nama atau alamat
 * @param {string} [opsi.kategori]    kode kategori ('rumah-sakit', 'klinik', …)
 * @param {string} [opsi.provinsi]    nama provinsi persis
 * @param {string} [opsi.kabupaten]   kode kabupaten ("32.16") atau nama
 * @param {string} [opsi.sumber]      'OpenStreetMap' atau 'SIRS Kemenkes'
 * @param {string} [opsi.kelas]       kelas RS (hanya SIRS)
 * @param {string} [opsi.jenis]       jenis RS (hanya SIRS)
 * @param {string} [opsi.kepemilikan] kepemilikan (hanya SIRS)
 * @param {boolean} [opsi.hanyaKoordinat]
 * @param {boolean} [opsi.igd]        hanya yang punya IGD
 * @param {boolean} [opsi.buka24]     hanya yang buka 24 jam
 * @param {string} [opsi.urut]        'nama' | 'provinsi' | 'baru'
 * @param {number} [opsi.halaman]     1-based
 * @param {number} [opsi.perHalaman]
 * @returns {Promise<{daftar:object[], total:number, halaman:number, perHalaman:number, jumlahHalaman:number}|null>}
 */
export async function cariFaskesNasional({
  cari = null,
  kategori = null,
  provinsi = null,
  kabupaten = null,
  sumber = null,
  kelas = null,
  jenis = null,
  kepemilikan = null,
  hanyaKoordinat = false,
  igd = false,
  buka24 = false,
  urut = 'nama',
  halaman = 1,
  perHalaman = 25,
} = {}) {
  /*
   * Kedaluwarsa tetap ditegakkan untuk data medis, tetapi BUKAN untuk daftar
   * fasilitas: baris OSM kedaluwarsa 2027 dan SIRS tidak memakai kolom itu.
   * Menyaringnya di sini akan mengosongkan daftar tanpa sebab yang terlihat.
   */

  const syarat = []
  const nilai = []

  if (cari) {
    // `%` dan `_` dari masukan pengguna harus di-escape, kalau tidak pencarian
    // "50%" akan cocok dengan semua baris.
    const bersih = String(cari).replace(/[\\%_]/g, (m) => `\\${m}`)
    syarat.push('(f.nama LIKE ? OR f.alamat LIKE ?)')
    nilai.push(`%${bersih}%`, `%${bersih}%`)
  }
  if (kategori) {
    syarat.push('k.kode = ?')
    nilai.push(String(kategori))
  }
  if (provinsi) {
    syarat.push('f.provinsi = ?')
    nilai.push(String(provinsi))
  }
  if (kabupaten) {
    if (/^\d{2}\.\d{2}$/.test(String(kabupaten))) {
      syarat.push('f.kode_kabupaten = ?')
      nilai.push(String(kabupaten))
    } else {
      syarat.push('f.kabupaten = ?')
      nilai.push(String(kabupaten))
    }
  }
  if (sumber) {
    syarat.push('f.sumber = ?')
    nilai.push(String(sumber))
  }
  if (kelas) {
    syarat.push('f.kelas_rs = ?')
    nilai.push(String(kelas))
  }
  if (jenis) {
    syarat.push('f.jenis_rs = ?')
    nilai.push(String(jenis))
  }
  if (kepemilikan) {
    syarat.push('f.kepemilikan = ?')
    nilai.push(String(kepemilikan))
  }
  if (hanyaKoordinat) syarat.push('f.lat IS NOT NULL AND f.lon IS NOT NULL')
  if (igd) syarat.push('f.igd = 1')
  if (buka24) syarat.push('f.buka_24_jam = 1')

  const where = syarat.length ? `WHERE ${syarat.join(' AND ')}` : ''

  const di = Math.min(Math.max(Number(halaman) || 1, 1), MAKS_HALAMAN)
  const n = Math.min(Math.max(Number(perHalaman) || 25, 1), MAKS_HALAMAN)
  const offset = (di - 1) * n

  // Urutan harus STABIL antar halaman, kalau tidak ada baris yang terlewat
  // atau muncul dua kali saat pengguna menekan "berikutnya".
  const URUTAN = {
    nama: 'f.nama ASC, f.id ASC',
    provinsi: 'f.provinsi ASC, f.nama ASC, f.id ASC',
    baru: 'f.diperbarui DESC, f.id DESC',
  }
  const order = URUTAN[urut] ?? URUTAN.nama

  const dasar = 'FROM fasilitas f LEFT JOIN kategori_fasilitas k ON k.id = f.kategori_id'

  const hitung = await eksekusi(`SELECT COUNT(*) AS total ${dasar} ${where}`, nilai)
  if (!hitung) return null
  const total = Number(hitung[0]?.total ?? 0)

  const baris = await eksekusi(
    `SELECT ${KOLOM} ${dasar} ${where} ORDER BY ${order} LIMIT ${n} OFFSET ${offset}`,
    nilai,
  )
  if (!baris) return null

  return {
    daftar: baris.map(rapikan),
    total,
    halaman: di,
    perHalaman: n,
    jumlahHalaman: Math.max(1, Math.ceil(total / n)),
  }
}

/** Rincian satu fasilitas menurut id database. */
export async function faskesNasionalMenurutId(id) {
  const r = await eksekusi(
    `SELECT ${KOLOM}
       FROM fasilitas f LEFT JOIN kategori_fasilitas k ON k.id = f.kategori_id
      WHERE f.id = ?`,
    [Number(id)],
  )
  if (!r || !r.length) return null
  return rapikan(r[0])
}

/**
 * Nilai unik untuk mengisi dropdown filter.
 *
 * Semua diambil dari DATABASE, bukan daftar tetap di kode: kalau nanti ada
 * kategori atau provinsi baru, filternya ikut tanpa mengubah kode.
 */
export async function pilihanFilterNasional() {
  const ambil = async (sql, params = []) => {
    const r = await eksekusi(sql, params)
    return r ? r.map((x) => ({ nilai: x.nilai, jumlah: Number(x.jumlah) })) : []
  }

  const kategori = await ambil(
    `SELECT k.kode AS nilai, COUNT(*) AS jumlah
       FROM fasilitas f JOIN kategori_fasilitas k ON k.id = f.kategori_id
      GROUP BY k.kode ORDER BY jumlah DESC`,
  )
  if (!kategori.length) return null

  const provinsi = await ambil(
    `SELECT f.provinsi AS nilai, COUNT(*) AS jumlah
       FROM fasilitas f
      WHERE f.provinsi IS NOT NULL AND f.provinsi <> ''
      GROUP BY f.provinsi ORDER BY jumlah DESC`,
  )

  const sumber = await ambil(
    `SELECT f.sumber AS nilai, COUNT(*) AS jumlah
       FROM fasilitas f GROUP BY f.sumber ORDER BY jumlah DESC`,
  )

  const kelas = await ambil(
    `SELECT kelas_rs AS nilai, COUNT(*) AS jumlah FROM fasilitas
      WHERE kelas_rs IS NOT NULL AND kelas_rs <> '' GROUP BY kelas_rs ORDER BY jumlah DESC`,
  )

  const jenis = await ambil(
    `SELECT jenis_rs AS nilai, COUNT(*) AS jumlah FROM fasilitas
      WHERE jenis_rs IS NOT NULL AND jenis_rs <> '' GROUP BY jenis_rs ORDER BY jumlah DESC`,
  )

  const kepemilikan = await ambil(
    `SELECT kepemilikan AS nilai, COUNT(*) AS jumlah FROM fasilitas
      WHERE kepemilikan IS NOT NULL AND kepemilikan <> '' GROUP BY kepemilikan ORDER BY jumlah DESC`,
  )

  // Kabupaten dikelompokkan per provinsi supaya dropdown bertingkat bisa
  // dipakai tanpa memuat ratusan baris sekaligus.
  const kab = await eksekusi(
    `SELECT provinsi, kabupaten AS nama, COUNT(*) AS jumlah
       FROM fasilitas
      WHERE provinsi IS NOT NULL AND kabupaten IS NOT NULL AND kabupaten <> ''
      GROUP BY provinsi, kabupaten
      ORDER BY provinsi ASC, kabupaten ASC`,
  )

  return {
    kategori,
    provinsi,
    sumber,
    kelas,
    jenis,
    kepemilikan,
    kabupaten: kab ? kab.map((x) => ({ ...x, jumlah: Number(x.jumlah) })) : [],
  }
}

/** Ringkasan isi database fasilitas — dipakai kepala halaman. */
export async function ringkasanNasional() {
  const r = await eksekusi(
    `SELECT COUNT(*) AS total,
            SUM(f.lat IS NOT NULL AND f.lon IS NOT NULL) AS berkoordinat,
            SUM(f.sumber = 'SIRS Kemenkes') AS sirs,
            SUM(f.sumber = 'OpenStreetMap') AS osm,
            SUM(f.provinsi IS NULL OR f.provinsi = '') AS tanpa_provinsi,
            MAX(f.diperbarui) AS diperbarui_terakhir
       FROM fasilitas f`,
  )
  if (!r || !r.length) return null
  const b = r[0]

  const perKategori = await eksekusi(
    `SELECT k.kode, k.label, COUNT(*) AS jumlah
       FROM fasilitas f JOIN kategori_fasilitas k ON k.id = f.kategori_id
      GROUP BY k.kode, k.label ORDER BY jumlah DESC`,
  )

  return {
    total: Number(b.total ?? 0),
    berkoordinat: Number(b.berkoordinat ?? 0),
    sirs: Number(b.sirs ?? 0),
    osm: Number(b.osm ?? 0),
    tanpaProvinsi: Number(b.tanpa_provinsi ?? 0),
    diperbaruiTerakhir: b.diperbarui_terakhir,
    perKategori: perKategori ? perKategori.map((x) => ({ ...x, jumlah: Number(x.jumlah) })) : [],
  }
}
