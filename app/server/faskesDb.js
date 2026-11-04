/**
 * Penyimpanan fasilitas kesehatan di MySQL (XAMPP).
 *
 * POLA WAJIB PROYEK INI: database OPSIONAL. Kalau DB mati, fungsi di sini
 * mengembalikan null/kosong dan pemanggil jatuh ke jalur Overpass. Tidak ada
 * satu pun fungsi di sini yang melempar galat ke pengguna hanya karena DB mati
 * — lihat aturan pertama di `app/server/db.js`.
 *
 * SEMUA nilai masuk lewat placeholder `?` (prepared statement). Kolom yang
 * tidak diketahui disimpan NULL — tidak pernah string kosong, tidak pernah
 * tebakan.
 */

import { eksekusi, dbSiap } from './db.js'
import { KATEGORI } from './faskes.js'

/**
 * Umur simpan satu baris fasilitas.
 *
 * 90 hari adalah kompromi yang disebut terbuka di README: jam operasional bisa
 * berubah lebih cepat, tetapi memperpendeknya membuat daftar cepat kosong
 * sementara Overpass butuh 40–50 detik untuk mengisinya lagi.
 */
const UMUR_HARI = 90

let kategoriSiap = false

/**
 * Pastikan tabel kategori terisi dari daftar KATEGORI.
 *
 * Dijalankan sekali per proses, dan idempoten (ON DUPLICATE KEY UPDATE) supaya
 * label yang berubah di kode ikut tersusulkan tanpa menggandakan baris.
 */
async function pastikanKategori() {
  if (kategoriSiap) return true
  for (const k of KATEGORI) {
    await eksekusi(
      'INSERT INTO kategori_fasilitas (kode, label) VALUES (?, ?) ON DUPLICATE KEY UPDATE label = VALUES(label)',
      [k.id, k.label],
    )
  }
  kategoriSiap = true
  return true
}

async function idKategori(kode) {
  const r = await eksekusi('SELECT id FROM kategori_fasilitas WHERE kode = ?', [kode])
  return r?.[0]?.id ?? null
}

/**
 * Normalkan baris hasil query.
 *
 * PENTING: MySQL mengembalikan kolom DECIMAL sebagai STRING, bukan number.
 * Tanpa konversi ini, `lat.toFixed()` di antarmuka melempar galat
 * ("toFixed is not a function") hanya untuk data yang datang dari database —
 * artinya bug yang tidak akan pernah muncul saat DB mati.
 *
 * `igd` juga dikembalikan sebagai 0/1/NULL; di sini diubah kembali jadi
 * true/false/null supaya arti "tidak diketahui" tidak hilang.
 */
function normalkanBaris(b) {
  if (!b) return null
  return {
    ...b,
    lat: Number(b.lat),
    lon: Number(b.lon),
    igd: b.igd === null || b.igd === undefined ? null : Boolean(Number(b.igd)),
    buka24Jam: Boolean(Number(b.buka24Jam)),
  }
}

/** Batas baris yang aman disisipkan ke SQL (bilangan bulat 1..2000). */
function batas(n) {
  const v = Math.trunc(Number(n))
  if (!Number.isFinite(v) || v < 1) return 50
  return Math.min(v, 2000)
}

/** true/false/null -> 1/0/NULL, supaya "tidak diketahui" tidak jadi 0. */
const b1 = (v) => (v === true ? 1 : v === false ? 0 : null)

/**
 * Simpan satu fasilitas (upsert berdasarkan `kode_osm`).
 * Mengembalikan id baris, atau null kalau DB tidak tersedia.
 */
export async function simpanFasilitas(f) {
  if (!(await dbSiap())) return null
  await pastikanKategori()

  const kat = await idKategori(f.kategori)
  // Kategori tak dikenal TIDAK dibuat diam-diam: lebih baik dilewati daripada
  // mengisi tabel kategori dengan nilai karangan.
  if (!kat) return null

  const kedaluwarsa = new Date(Date.now() + UMUR_HARI * 86400000)

  await eksekusi(
    `INSERT INTO fasilitas
       (kode_osm, nama, kategori_id, subkategori, alamat, kode_desa, lat, lon,
        telepon, email, website, jam_operasional, layanan, igd, buka_24_jam,
        foto_url, sumber, url_sumber, diperiksa_pada, kedaluwarsa)
     VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,NOW(),?)
     ON DUPLICATE KEY UPDATE
       nama=VALUES(nama), kategori_id=VALUES(kategori_id),
       subkategori=VALUES(subkategori), alamat=VALUES(alamat),
       kode_desa=VALUES(kode_desa), lat=VALUES(lat), lon=VALUES(lon),
       telepon=VALUES(telepon), email=VALUES(email), website=VALUES(website),
       jam_operasional=VALUES(jam_operasional), layanan=VALUES(layanan),
       igd=VALUES(igd), buka_24_jam=VALUES(buka_24_jam),
       foto_url=VALUES(foto_url), sumber=VALUES(sumber),
       url_sumber=VALUES(url_sumber), diperiksa_pada=NOW(),
       kedaluwarsa=VALUES(kedaluwarsa)`,
    [
      f.kode_osm,
      f.nama,
      kat,
      f.subkategori ?? null,
      f.alamat ?? null,
      f.kode_desa ?? null,
      f.lat,
      f.lon,
      f.telepon ?? null,
      f.email ?? null,
      f.website ?? null,
      f.jam ?? null,
      f.layanan ?? null,
      b1(f.igd ?? null),
      b1(f.buka24Jam) ?? 0,
      f.foto ?? null,
      f.sumber ?? 'OpenStreetMap',
      f.sumberUrl ?? null,
      kedaluwarsa,
    ],
  )

  const r = await eksekusi('SELECT id FROM fasilitas WHERE kode_osm = ?', [f.kode_osm])
  return r?.[0]?.id ?? null
}

/** Simpan banyak sekaligus. Gagal satu baris tidak menghentikan sisanya. */
export async function simpanBanyak(daftar) {
  if (!Array.isArray(daftar) || !daftar.length) return 0
  let n = 0
  for (const f of daftar) {
    try {
      if (await simpanFasilitas(f)) n += 1
    } catch {
      // satu baris gagal bukan alasan membuang seluruh hasil
    }
  }
  return n
}


/* ---------------------------------------------------------------------------
 * Cakupan: apakah isi DB untuk satu titik+radius benar-benar LENGKAP?
 * ---------------------------------------------------------------------------
 * KENAPA PERLU. Versi pertama /api/faskes memakai aturan "kalau DB
 * mengembalikan baris apa pun, pakai itu". Terukur 4 Nov 2026: DB berisi 3
 * baris hasil uji di Cikarang, lalu SETIAP permintaan radius berhenti di 3
 * baris itu dan Overpass tidak pernah dipanggil. Pengguna melihat "3
 * fasilitas" untuk area yang sebenarnya berisi ratusan.
 *
 * Sekarang setiap pengambilan dari Overpass mencatat cakupannya:
 *   titik (dibulatkan ~1 km), radius, jumlah, dan waktu ambil.
 * Simpanan hanya dipakai sebagai jawaban akhir kalau ADA catatan cakupan yang
 * radiusnya >= radius yang diminta dan umurnya masih segar. Kalau tidak,
 * Overpass tetap dipanggil.
 *
 * Catatan disimpan terpisah dari baris `fasilitas`, karena "3 baris ini adalah
 * SELURUH isi radius 5 km" adalah fakta tentang pengambilan, bukan tentang
 * fasilitasnya.
 */
const CAKUPAN_SEGAR_MS = 6 * 60 * 60 * 1000 // 6 jam

/*
 * Siapkan tabel cakupan SEKALI per proses.
 *
 * Memakai Promise, bukan penanda boolean yang diset setelah `await`. Versi
 * boolean memicu `require-atomic-updates` (dan peringatannya benar): dua
 * permintaan bersamaan bisa sama-sama melihat `false` lalu sama-sama membuat
 * tabel. Dengan Promise, pemanggil kedua cukup menunggu promise yang sama.
 */
let janjiTabelCakupan = null

function pastikanTabelCakupan() {
  if (!janjiTabelCakupan) {
    janjiTabelCakupan = (async () => {
      if (!(await dbSiap())) return false
      await eksekusi(
        `CREATE TABLE IF NOT EXISTS cakupan_faskes (
           id        BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
           lat_bulat DECIMAL(9,5) NOT NULL,
           lon_bulat DECIMAL(9,5) NOT NULL,
           radius_m  INT UNSIGNED NOT NULL,
           jumlah    INT UNSIGNED NOT NULL,
           diambil   DATETIME     NOT NULL,
           UNIQUE KEY uq_cakupan (lat_bulat, lon_bulat, radius_m)
         ) ENGINE=InnoDB`,
      )
      return true
    })().catch(() => {
      // Gagal sekali jangan dikunci selamanya: kalau DB hidup lagi, coba lagi.
      janjiTabelCakupan = null
      return false
    })
  }
  return janjiTabelCakupan
}

/** Titik dibulatkan ~1,1 km supaya geseran kecil di peta tidak bikin catatan baru. */
const bulatkan = (x) => Math.round(Number(x) * 100) / 100

/** Catat bahwa hasil untuk titik+radius ini sudah diambil LENGKAP dari Overpass. */
export async function catatCakupan(lat, lon, radiusM, jumlah) {
  if (!(await pastikanTabelCakupan())) return false
  return eksekusi(
    `INSERT INTO cakupan_faskes (lat_bulat, lon_bulat, radius_m, jumlah, diambil)
     VALUES (?, ?, ?, ?, NOW())
     ON DUPLICATE KEY UPDATE jumlah = VALUES(jumlah), diambil = NOW()`,
    [bulatkan(lat), bulatkan(lon), Math.round(radiusM), jumlah],
  )
}

/**
 * Apakah ada catatan cakupan yang menutupi radius ini?
 *
 * Radius yang dicatat lebih BESAR juga menutupi: kalau kita pernah mengambil
 * 5 km di titik ini, permintaan 2 km pasti tercakup.
 */
export async function cakupanLengkap(lat, lon, radiusM) {
  if (!(await pastikanTabelCakupan())) return false
  const r = await eksekusi(
    `SELECT jumlah FROM cakupan_faskes
      WHERE lat_bulat = ? AND lon_bulat = ? AND radius_m >= ?
        AND diambil > DATE_SUB(NOW(), INTERVAL ? SECOND)
      ORDER BY radius_m ASC LIMIT 1`,
    [bulatkan(lat), bulatkan(lon), Math.round(radiusM), Math.floor(CAKUPAN_SEGAR_MS / 1000)],
  )
  return Array.isArray(r) && r.length > 0
}

/** Hapus catatan cakupan — untuk uji. */
export async function _lupakanCakupan() {
  if (!(await dbSiap())) return
  await eksekusi('DELETE FROM cakupan_faskes').catch(() => {})
}

const PILIH = `
  SELECT f.id, f.kode_osm, f.nama, k.kode AS kategori, f.subkategori, f.alamat,
         f.kode_desa, f.lat, f.lon, f.telepon, f.email, f.website,
         f.jam_operasional AS jam, f.layanan, f.igd, f.buka_24_jam AS buka24Jam,
         f.foto_url AS foto, f.sumber, f.url_sumber AS sumberUrl,
         f.status_verifikasi, f.diperbarui, f.diperiksa_pada
    FROM fasilitas f
    JOIN kategori_fasilitas k ON k.id = f.kategori_id`

/** Cari fasilitas menurut teks bebas (nama/alamat/layanan). */
export async function cariFasilitas(teks, { limit = 50 } = {}) {
  if (!(await dbSiap())) return null
  const q = `%${String(teks ?? '').trim()}%`
  const r = await eksekusi(
    `${PILIH}
     WHERE f.kedaluwarsa > NOW()
       AND (f.nama LIKE ? OR f.alamat LIKE ? OR f.layanan LIKE ?)
     ORDER BY f.nama LIMIT ${batas(limit)}`,
    [q, q, q],
  )
  return r ? r.map(normalkanBaris) : null
}

/**
 * Fasilitas di dalam kotak pembatas sekitar satu titik.
 *
 * Memakai BETWEEN pada lat/lon supaya indeks `idx_fasilitas_titik` terpakai;
 * jarak sebenarnya dihitung pemanggil (haversine) karena perhitungan itu tidak
 * bisa memakai indeks.
 */
export async function fasilitasSekitarDb(lat, lon, radiusM, { limit = 5000 } = {}) {
  if (!(await dbSiap())) return null
  const dLat = radiusM / 111320
  const dLon = radiusM / (111320 * Math.cos((lat * Math.PI) / 180))
  /*
   * Batas 600 yang LAMA adalah cacat yang terukur.
   *
   * Diukur 4 Nov 2026 di Jakarta Pusat radius 5 km: permintaan berhenti tepat
   * di 600 baris, lalu `catatCakupan` mencatat "600 = lengkap". Sesudah itu
   * setiap permintaan untuk area tersebut dilayani dari DB dan SELALU 600 —
   * sisanya tidak pernah terlihat, dan tidak ada satu pun tanda bahwa ada yang
   * hilang. Inilah bentuk paling berbahaya dari "cuma sedikit yang muncul":
   * angkanya terlihat wajar.
   *
   * Dinaikkan ke 5.000, disamakan dengan MAKS_HASIL di faskes.js. Pesan ini
   * sengaja TIDAK menjanjikan objek {daftar, dipotong}: fungsi ini tetap
   * mengembalikan array supaya semua pemanggil lama tidak rusak. Kalau batas
   * ini suatu saat terlewati lagi, angkanya akan kembali terlihat wajar — jadi
   * pemanggil yang butuh kepastian harus memeriksa `cakupanLengkap()`.
   */
  const r = await eksekusi(
    `${PILIH}
     WHERE f.kedaluwarsa > NOW()
       AND f.lat BETWEEN ? AND ?
       AND f.lon BETWEEN ? AND ?
     ORDER BY f.id ASC
     LIMIT ${batas(limit)}`,
    [lat - dLat, lat + dLat, lon - dLon, lon + dLon],
  )
  return r ? r.map(normalkanBaris) : null
}

/** Satu fasilitas menurut id (untuk halaman detail). */
export async function ambilFasilitas(id) {
  if (!(await dbSiap())) return null
  const r = await eksekusi(`${PILIH} WHERE f.id = ? AND f.kedaluwarsa > NOW()`, [Number(id)])
  return normalkanBaris(r?.[0])
}

/** Hanya untuk uji: paksa pengisian ulang tabel kategori sesudah dibersihkan. */
export function _lupakanKategori() {
  kategoriSiap = false
}
