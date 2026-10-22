/**
 * Jembatan database (MariaDB/MySQL lewat XAMPP).
 *
 * ============================================================================
 * ATURAN PALING PENTING DI BERKAS INI
 * ============================================================================
 *
 * DATABASE INI OPSIONAL. Aplikasi HARUS tetap jalan tanpa database.
 *
 * Kenapa: Pahami Sehat sudah terbukti jalan dengan cache JSON. Menambahkan
 * database tidak boleh membuat aplikasi yang tadinya hidup jadi mati hanya
 * karena MySQL belum dinyalakan. Kalau `dbSiap()` mengembalikan false, semua
 * pemanggil WAJIB jatuh kembali ke jalur berkas/JSON seperti sebelumnya.
 *
 * Jadi urutannya selalu: coba database -> gagal -> pakai yang lama.
 * Tidak pernah: database gagal -> melempar error ke pengguna.
 *
 * ============================================================================
 * ATURAN KEDUA: JANGAN MENYAJIKAN DATA MEDIS YANG SUDAH BASI
 * ============================================================================
 *
 * Setiap baris yang memuat informasi medis punya kolom `kedaluwarsa` yang
 * NOT NULL (ditegakkan skema — INSERT tanpa itu ditolak database). Fungsi
 * penyajian di sini SELALU menyaring `WHERE kedaluwarsa > NOW()`.
 *
 * Alasannya bukan kerapian, tapi keselamatan: menyajikan panduan medis yang
 * sudah kadaluwarsa bukan bug teknis, itu risiko kesehatan. Lebih baik
 * menyajikan kosong dan mengambil ulang dari sumber resmi daripada menyajikan
 * yang basi.
 *
 * ============================================================================
 */

import { createRequire } from 'node:module'

const require = createRequire(import.meta.url)

/** Konfigurasi dari lingkungan; ada bawaan supaya XAMPP langsung bisa dipakai. */
const KONFIG = {
  host: process.env.DB_HOST || '127.0.0.1',
  port: Number(process.env.DB_PORT || 3306),
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || '',
  database: process.env.DB_NAMA || 'pahami_sehat',
  waitForConnections: true,
  connectionLimit: 5,
  charset: 'utf8mb4_unicode_ci',
}

/**
 * DB dimatikan lewat `DB_MATI=1`. Dipakai uji supaya bisa membuktikan
 * aplikasi tetap jalan tanpa database — bukan cuma diklaim di komentar.
 */
const DIMATIKAN = process.env.DB_MATI === '1'

/* ==========================================================================
 * BATAS PERCAKAPAN TERSIMPAN
 * ==========================================================================
 * Angka-angka ini menentukan berapa banyak "ingatan" yang dipakai saat
 * menjawab pertanyaan lanjutan. Semuanya SENGAJA kecil: yang dibutuhkan
 * hanyalah topik beberapa giliran terakhir, bukan seluruh riwayat obrolan.
 *
 *   MAKS_UMUR_HARI       — sesudah ini, baris dihapus. Konteks percakapan
 *                          bukan arsip; menyimpan lebih lama hanya menambah
 *                          risiko tanpa manfaat apa pun bagi jawaban.
 *   MAKS_GILIRAN_KONTEKS — 8 giliran = 4 pertanyaan + 4 jawaban terakhir.
 *                          Lebih dari itu membuat prompt panjang, lambat, dan
 *                          justru mengaburkan topik yang sedang dibahas.
 *   MAKS_TEKS_GILIRAN    — jawaban panjang dipotong. Yang diambil untuk
 *                          konteks hanya bagian AWAL (topiknya), karena di
 *                          situlah subjek percakapan dinyatakan.
 * ========================================================================== */
export const MAKS_UMUR_HARI = 7
export const MAKS_GILIRAN_KONTEKS = 8
export const MAKS_TEKS_GILIRAN = 2000

let pool = null
let terakhirGagal = 0
/** Janji penyambungan yang sedang berjalan — lihat penjelasan di `db()`. */
let menyambung = null

/** Jangan mencoba menyambung ulang lebih sering dari ini (milidetik). */
const JEDA_COBA_MS = 30_000

/**
 * Ambil koneksi database. Mengembalikan null kalau database tidak tersedia —
 * TIDAK PERNAH melempar. Pemanggil yang menentukan apa yang dilakukan kalau null.
 *
 * @returns {Promise<import('mysql2/promise').Pool|null>}
 */
export async function db() {
  if (DIMATIKAN) return null
  if (pool) return pool

  // setelah gagal, tunggu sebentar sebelum mencoba lagi — kalau tidak,
  // setiap permintaan pengguna akan menunggu timeout koneksi
  if (terakhirGagal && Date.now() - terakhirGagal < JEDA_COBA_MS) return null

  /*
   * KUNCI PENYAMBUNGAN — ini bukan kerapian, ini mencegah kebocoran pool.
   *
   * Tanpa ini, dua permintaan yang datang bersamaan sama-sama melihat
   * `pool === null`, sama-sama membuat pool, dan yang kalah menimpa variabel
   * `pool` tanpa pernah menutup pool-nya sendiri. Setiap kejadian seperti itu
   * meninggalkan satu pool berisi koneksi terbuka yang tidak pernah dipakai
   * dan tidak pernah ditutup — di MariaDB itu terlihat sebagai koneksi
   * menggantung sampai batas `max_connections` habis.
   *
   * `menyambung` menyimpan JANJI, bukan hasil: pemanggil kedua menunggu janji
   * yang sama, jadi `createPool` hanya berjalan sekali.
   */
  if (menyambung) return menyambung

  menyambung = (async () => {
    try {
      const mysql = require('mysql2/promise')
      const p = mysql.createPool(KONFIG)
      // uji benar-benar bisa dipakai, bukan cuma objeknya terbentuk
      const c = await p.getConnection()
      await c.ping()
      c.release()
      pool = p
      return pool
    } catch {
      terakhirGagal = Date.now()
      pool = null
      return null
    } finally {
      menyambung = null
    }
  })()

  return menyambung
}

/** Apakah database tersedia sekarang? Aman dipanggil kapan saja. */
export async function dbSiap() {
  return (await db()) !== null
}

/**
 * Keterangan singkat untuk /api/health — tanpa membocorkan kata sandi.
 *
 * ASYNC dengan sengaja: ia harus MENCOBA menyambung dulu. Versi sinkron
 * sebelumnya melaporkan "tidak tersambung" hanya karena belum pernah dicoba —
 * itu menyesatkan, dan pernah benar-benar terjadi.
 */
export async function keteranganDb() {
  if (DIMATIKAN) return { aktif: false, alasan: 'dimatikan lewat DB_MATI=1' }
  const p = await db()
  if (!p) return { aktif: false, alasan: 'tidak tersambung' }
  return { aktif: true, host: KONFIG.host, port: KONFIG.port, database: KONFIG.database }
}

/**
 * Jalankan query dengan aman. Mengembalikan null kalau database tidak ada
 * atau query gagal — supaya pemanggil bisa jatuh ke jalur berkas.
 *
 * @param {string} sql
 * @param {any[]} [params]
 * @returns {Promise<any[]|null>}
 */
export async function tanya(sql, params = []) {
  const p = await db()
  if (!p) return null
  try {
    const [baris] = await p.query(sql, params)
    return baris
  } catch {
    return null
  }
}

/* ==========================================================================
 * BERITA
 * ======================================================================== */

/**
 * Simpan daftar berita. Duplikat dicegah oleh `sidik` UNIQUE, jadi aman
 * dipanggil berulang dengan daftar yang sama.
 *
 * @param {Array<{judul:string, sumber?:string, url?:string, umurHari?:number|null}>} daftar
 * @returns {Promise<number|null>} jumlah baris yang benar-benar ditulis, atau null kalau tidak ada DB
 */
export async function simpanBerita(daftar = []) {
  const p = await db()
  if (!p || !daftar.length) return null
  try {
    const nilai = daftar.map((b) => [
      String(b.judul ?? '').slice(0, 300),
      b.sumber ? String(b.sumber).slice(0, 120) : null,
      b.url ? String(b.url).slice(0, 700) : null,
      sidikDari(b.judul ?? ''),
      new Date(),
    ])
    const [hasil] = await p.query(
      `INSERT INTO berita (judul, sumber, url, sidik, diambil)
       VALUES ?
       ON DUPLICATE KEY UPDATE diambil = VALUES(diambil)`,
      [nilai],
    )
    return hasil?.affectedRows ?? 0
  } catch {
    return null
  }
}

/**
 * Ambil berita terbaru dari database.
 * @param {number} batas
 */
export async function ambilBerita(batas = 20) {
  return tanya(
    `SELECT judul, sumber, url, diambil
       FROM berita
      ORDER BY diambil DESC, id DESC
      LIMIT ?`,
    [Number(batas) || 20],
  )
}

/** Hitung berita yang diambil dalam N hari terakhir. */
export async function hitungBeritaSegar(hari = 1) {
  const baris = await tanya(
    `SELECT COUNT(*) AS n FROM berita WHERE diambil >= DATE_SUB(NOW(), INTERVAL ? DAY)`,
    [Number(hari) || 1],
  )
  return baris?.[0]?.n ?? null
}

/* ==========================================================================
 * KONTEN HARIAN
 * ======================================================================== */

/**
 * Simpan artikel konten. `slug` UNIQUE mencegah duplikat.
 * @param {Array<object>} artikel
 */
export async function simpanKonten(artikel = []) {
  const p = await db()
  if (!p || !artikel.length) return null
  try {
    const nilai = artikel.map((a) => [
      String(a.id ?? a.slug ?? '').slice(0, 180),
      a.category ? String(a.category).slice(0, 80) : null,
      String(a.title ?? '').slice(0, 300),
      a.excerpt ? String(a.excerpt) : null,
      a.url ? String(a.url).slice(0, 700) : null,
      a.gambar ? String(a.gambar).slice(0, 700) : null,
      sidikDari(JSON.stringify(a)),
      new Date(),
      new Date(),
    ])
    const [hasil] = await p.query(
      `INSERT INTO konten (slug, kategori, judul, ringkas, url_sumber, gambar, sidik, diperiksa, diperbarui)
       VALUES ?
       ON DUPLICATE KEY UPDATE
         judul = VALUES(judul),
         ringkas = VALUES(ringkas),
         url_sumber = VALUES(url_sumber),
         gambar = VALUES(gambar),
         sidik = VALUES(sidik),
         diperiksa = VALUES(diperiksa)`,
      [nilai],
    )
    return hasil?.affectedRows ?? 0
  } catch {
    return null
  }
}

/** Ambil konten yang masih aktif. */
export async function ambilKonten(batas = 20) {
  return tanya(
    `SELECT slug, kategori, judul, ringkas, url_sumber, gambar, diperbarui
       FROM konten
      WHERE aktif = 1
      ORDER BY diperbarui DESC
      LIMIT ?`,
    [Number(batas) || 20],
  )
}

/* ==========================================================================
 * SUMBER RESMI & SITASI
 * ======================================================================== */

/** Cari id sumber berdasarkan domain. null kalau tidak ada DB atau tidak ketemu. */
export async function idSumber(domain) {
  const baris = await tanya(`SELECT id FROM sumber WHERE domain = ? LIMIT 1`, [String(domain)])
  return baris?.[0]?.id ?? null
}

/**
 * Catat dokumen yang dipakai sebagai sumber, dan kembalikan id-nya.
 *
 * ANTI-DUPLIKAT: sebelum menyisipkan, dicari dulu berdasarkan `url`. Kalau
 * sudah ada, baris itu yang DIPERBARUI (tanggal diambil & masa berlaku),
 * bukan disisipkan lagi. Tanpa ini, tabel `dokumen` membengkak satu baris
 * setiap kali pengguna bertanya — URL yang sama tercatat puluhan kali.
 * (Kolom `url` tidak bisa diberi UNIQUE langsung: panjangnya 700 dan melebihi
 * batas indeks; jadi pengecekannya dilakukan di sini.)
 *
 * @param {{domain?:string, url:string, judul?:string, bahasa?:string, teks?:string, berlakuHari?:number}} d
 * @returns {Promise<number|null>} id dokumen, atau null kalau tidak ada DB
 */
export async function catatDokumen(d = {}) {
  const p = await db()
  if (!p || !d.url) return null
  try {
    const url = String(d.url).slice(0, 700)

    // sudah pernah dicatat? perbarui saja, jangan tambah baris baru
    const [ada] = await p.query(`SELECT id FROM dokumen WHERE url = ? LIMIT 1`, [url])
    const hari = Number(d.berlakuHari) > 0 ? Number(d.berlakuHari) : 30
    if (ada?.length) {
      await p.query(
        `UPDATE dokumen
            SET diambil_pada = NOW(),
                kedaluwarsa  = DATE_ADD(NOW(), INTERVAL ? DAY),
                judul        = COALESCE(?, judul)
          WHERE id = ?`,
        [hari, d.judul ? String(d.judul).slice(0, 300) : null, ada[0].id],
      )
      return ada[0].id
    }

    let sid = d.domain ? await idSumber(d.domain) : null
    if (!sid) {
      // sumber belum terdaftar — daftarkan supaya tautannya tetap bisa dilacak
      const domain = String(d.domain || ambilHost(url) || url).slice(0, 120)
      const [h] = await p.query(
        `INSERT INTO sumber (domain, nama, jenis, resmi)
         VALUES (?, ?, 'lainnya', 0)
         ON DUPLICATE KEY UPDATE id = LAST_INSERT_ID(id)`,
        [domain, String(d.namaSumber || domain).slice(0, 160)],
      )
      sid = h?.insertId ?? null
    }
    if (!sid) return null

    const [hasil] = await p.query(
      `INSERT INTO dokumen (sumber_id, url, judul, bahasa, diambil_pada, sidik_isi, kedaluwarsa, teks)
       VALUES (?, ?, ?, ?, NOW(), ?, DATE_ADD(NOW(), INTERVAL ? DAY), ?)`,
      [
        sid,
        url,
        d.judul ? String(d.judul).slice(0, 300) : null,
        d.bahasa ? String(d.bahasa).slice(0, 2) : null,
        d.teks ? sidikDari(String(d.teks)) : null,
        hari,
        d.teks ? String(d.teks) : null,
      ],
    )
    return hasil?.insertId ?? null
  } catch {
    return null
  }
}

/** Ambil nama host dari URL, dengan aman (URL rusak tidak melempar). */
function ambilHost(url) {
  try {
    return new URL(String(url)).hostname
  } catch {
    return null
  }
}

/**
 * Catat SEMUA sumber yang dikutip model untuk satu jawaban.
 *
 * Ini yang membuat klaim "jawaban ini bersumber dari Kemenkes" bisa DILACAK,
 * bukan cuma ditulis. Dipanggil setelah jawaban jadi, jadi kegagalan di sini
 * tidak pernah memengaruhi jawaban yang sudah dikirim ke pengguna.
 *
 * @param {'tanya'|'verifikasi'|'berita'|'sederhanakan'} jenis
 * @param {Array<{judul?:string, penerbit?:string, url?:string}>} daftarSumber
 * @returns {Promise<number>} jumlah sitasi yang berhasil dicatat
 */
export async function catatSumberDikutip(jenis, daftarSumber = []) {
  const p = await db()
  if (!p || !Array.isArray(daftarSumber) || !daftarSumber.length) return 0
  let n = 0
  for (const s of daftarSumber) {
    const url = String(s?.url ?? '').trim()
    // Hanya URL http(s) yang dicatat — sama seperti penyaring di bentukHasil().
    if (!/^https?:\/\//i.test(url)) continue
    try {
      const dokId = await catatDokumen({
        url,
        judul: s?.judul || s?.penerbit || null,
        domain: ambilHost(url),
        namaSumber: s?.penerbit || null,
        berlakuHari: 30,
      })
      if (!dokId) continue
      await catatSitasi(jenis, dokId, null)
      n += 1
    } catch {
      /* satu sumber gagal dicatat tidak menghalangi yang lain */
    }
  }
  return n
}

/**
 * Ambil dokumen yang MASIH BERLAKU saja.
 * Baris yang sudah lewat kedaluwarsa tidak pernah ikut — itu intinya.
 */
export async function ambilDokumenBerlaku(domain = null, batas = 10) {
  if (domain) {
    return tanya(
      `SELECT d.url, d.judul, d.diambil_pada, d.kedaluwarsa, s.nama AS sumber
         FROM dokumen d JOIN sumber s ON s.id = d.sumber_id
        WHERE d.kedaluwarsa > NOW() AND s.domain = ?
        ORDER BY d.diambil_pada DESC
        LIMIT ?`,
      [String(domain), Number(batas) || 10],
    )
  }
  return tanya(
    `SELECT d.url, d.judul, d.diambil_pada, d.kedaluwarsa, s.nama AS sumber
       FROM dokumen d JOIN sumber s ON s.id = d.sumber_id
      WHERE d.kedaluwarsa > NOW()
      ORDER BY d.diambil_pada DESC
      LIMIT ?`,
    [Number(batas) || 10],
  )
}

/** Catat bahwa sebuah jawaban memakai dokumen tertentu. */
export async function catatSitasi(jenisJawaban, dokumenId, rujukanId = null) {
  return tanya(
    `INSERT INTO sitasi (jenis_jawaban, rujukan_id, dokumen_id, dipakai_pada)
     VALUES (?, ?, ?, NOW())`,
    [jenisJawaban, rujukanId, dokumenId],
  )
}

/* ==========================================================================
 * PENGETAHUAN MEDIS — bagian yang paling berhati-hati
 * ======================================================================== */

/**
 * Simpan salinan berlabel tanggal untuk sebuah topik medis.
 *
 * `berlakuHari` sengaja PENDEK (bawaan 30 hari, boleh lebih pendek). Setelah
 * lewat, baris itu tidak akan tersaji lagi dan kode harus mengambil ulang dari
 * sumber resmi.
 *
 * @param {{topik:string, jenis:string, isi:string, ringkas?:string, url:string, domain?:string, berlakuHari?:number}} p
 */
export async function simpanPengetahuan(p = {}) {
  const pool2 = await db()
  if (!pool2 || !p.topik || !p.isi || !p.url) return null
  try {
    let sid = p.domain ? await idSumber(p.domain) : null
    if (!sid) {
      const [h] = await pool2.query(
        `INSERT INTO sumber (domain, nama, jenis, resmi)
         VALUES (?, ?, 'lainnya', 0)
         ON DUPLICATE KEY UPDATE id = LAST_INSERT_ID(id)`,
        [String(p.domain || new URL(p.url).hostname).slice(0, 120), String(p.domain || p.url).slice(0, 160)],
      )
      sid = h?.insertId ?? null
    }
    if (!sid) return null

    const hari = Number(p.berlakuHari) > 0 ? Number(p.berlakuHari) : 30
    const [hasil] = await pool2.query(
      `INSERT INTO pengetahuan (topik, jenis, isi, ringkas, sumber_id, url_sumber, diambil_pada, kedaluwarsa, sidik)
       VALUES (?, ?, ?, ?, ?, ?, NOW(), DATE_ADD(NOW(), INTERVAL ? DAY), ?)`,
      [
        String(p.topik).slice(0, 200),
        p.jenis || 'istilah',
        String(p.isi),
        p.ringkas ? String(p.ringkas) : null,
        sid,
        String(p.url).slice(0, 700),
        hari,
        sidikDari(String(p.isi)),
      ],
    )
    return hasil?.insertId ?? null
  } catch {
    return null
  }
}

/**
 * Ambil pengetahuan yang MASIH BERLAKU untuk sebuah topik.
 * Yang sudah kedaluwarsa tidak pernah ikut — pemanggil harus mengambil
 * ulang dari sumber resmi kalau hasilnya kosong.
 */
export async function ambilPengetahuan(topik, batas = 3) {
  return tanya(
    `SELECT p.topik, p.jenis, p.isi, p.ringkas, p.url_sumber, p.diambil_pada, p.kedaluwarsa, s.nama AS sumber
       FROM pengetahuan p JOIN sumber s ON s.id = p.sumber_id
      WHERE p.kedaluwarsa > NOW() AND p.topik LIKE ?
      ORDER BY p.diambil_pada DESC
      LIMIT ?`,
    [`%${String(topik)}%`, Number(batas) || 3],
  )
}

/* ==========================================================================
 * PERCAKAPAN — konteks untuk pertanyaan lanjutan
 * ======================================================================== */

/**
 * Simpan satu giliran percakapan (pertanyaan pengguna + jawaban aplikasi).
 *
 * ============================================================================
 * KENAPA INI ADA, DAN BATASNYA
 * ============================================================================
 *
 * Sebelum ini, server sama sekali tidak menyimpan percakapan: setiap
 * pertanyaan dijawab sendirian. Akibatnya pertanyaan lanjutan seperti
 * "terus gimana udah terlanjur nih" dicari dengan kata kunci "terus gimana
 * udah", tidak menemukan sumber apa pun, dan dijawab dengan kalimat generik.
 * Pengguna melihat percakapan yang "tidak nyambung" padahal jawabannya benar
 * untuk pertanyaan yang BERDIRI SENDIRI.
 *
 * Batas yang disengaja, dan tidak boleh dilonggarkan tanpa keputusan sadar:
 *
 *   1. YANG DISIMPAN HANYA TEKS PERCAKAPAN. Tidak ada nama, tidak ada alamat
 *      IP, tidak ada sidik peramban, tidak ada akun. `id_sesi` adalah tanda
 *      pengenal acak yang dibuat peramban pengguna sendiri.
 *   2. UMURNYA PENDEK dan dihapus otomatis (lihat `MAKS_UMUR_HARI`). Ini
 *      konteks percakapan, bukan arsip.
 *   3. DATABASE OPSIONAL — kalau mati, semua fungsi di sini mengembalikan
 *      null/kosong dan aplikasi tetap menjawab seperti sebelumnya. Konteks
 *      yang hilang membuat jawaban kurang nyambung, BUKAN membuat aplikasi
 *      rusak. Jangan pernah melempar galat dari sini.
 *
 * @param {{idSesi:string, peran:'pengguna'|'aplikasi', teks:string}} g
 * @returns {Promise<number|null>}
 */
export async function simpanGiliran({ idSesi, peran, teks } = {}) {
  const p = await db()
  if (!p || !idSesi || !teks) return null
  const isi = String(teks).trim()
  if (!isi) return null
  try {
    const [hasil] = await p.query(
      `INSERT INTO percakapan (id_sesi, peran, teks, dibuat)
       VALUES (?, ?, ?, NOW())`,
      [
        String(idSesi).slice(0, 64),
        peran === 'aplikasi' ? 'aplikasi' : 'pengguna',
        isi.slice(0, MAKS_TEKS_GILIRAN),
      ],
    )
    return hasil?.insertId ?? null
  } catch {
    return null
  }
}

/**
 * Ambil giliran percakapan terakhir sebuah sesi, URUT LAMA → BARU.
 *
 * Dipakai untuk menyusun konteks prompt. `maks` dihitung dalam GILIRAN
 * (satu pertanyaan + satu jawaban = 2 giliran), bukan dalam karakter.
 *
 * @param {string} idSesi
 * @param {number} maks
 * @returns {Promise<Array<{peran:string, teks:string}>>}
 */
export async function ambilGiliran(idSesi, maks = MAKS_GILIRAN_KONTEKS) {
  if (!idSesi) return []
  const n = Math.min(Math.max(Number(maks) || MAKS_GILIRAN_KONTEKS, 1), 40)
  const baris = await tanya(
    `SELECT peran, teks FROM (
       SELECT peran, teks, dibuat, id
         FROM percakapan
        WHERE id_sesi = ? AND dibuat > DATE_SUB(NOW(), INTERVAL ? DAY)
        ORDER BY id DESC
        LIMIT ?
     ) AS terakhir
     ORDER BY id ASC`,
    [String(idSesi).slice(0, 64), MAKS_UMUR_HARI, n],
  )
  return (baris ?? []).map((b) => ({ peran: b.peran, teks: b.teks }))
}

/**
 * Hapus percakapan yang sudah lewat umur simpan.
 *
 * Dipanggil sesekali (bukan setiap permintaan) supaya tabel tidak tumbuh
 * selamanya. Sengaja TIDAK dipanggil saat start: aplikasi harus tetap bisa
 * menyala walau database sedang sibuk.
 *
 * @returns {Promise<number|null>} jumlah baris terhapus, atau null
 */
export async function bersihkanPercakapan() {
  const baris = await tanya(
    `DELETE FROM percakapan WHERE dibuat < DATE_SUB(NOW(), INTERVAL ? DAY)`,
    [MAKS_UMUR_HARI],
  )
  return baris?.affectedRows ?? null
}

/* ==========================================================================
 * ALAT KECIL
 * ======================================================================== */

/** Sidik jari FNV-1a — sama seperti yang dipakai berita.js, biar konsisten. */
export function sidikDari(teks = '') {
  let h = 2166136261
  const s = String(teks)
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i)
    h = Math.imul(h, 16777619)
  }
  return (h >>> 0).toString(16)
}

/** Tutup pool — dipakai skrip uji supaya proses bisa keluar. */
export async function tutupDb() {
  if (pool) {
    try {
      await pool.end()
    } catch {
      /* sudah tertutup */
    }
    pool = null
  }
}
