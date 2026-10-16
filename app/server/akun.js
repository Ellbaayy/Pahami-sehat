/**
 * Akun pengguna: daftar, masuk, sesi, dan nama panggilan.
 *
 * ============================================================================
 * ATURAN YANG TIDAK BOLEH DILANGGAR
 * ============================================================================
 *
 * 1. SIMPAN SESEDIKIT MUNGKIN. Yang disimpan hanya email ATAU telepon, nama
 *    panggilan, hash kata sandi, dan google_id. Tidak ada nama lengkap, NIK,
 *    tanggal lahir, atau alamat. Aplikasi ini bahkan memperingatkan pengguna
 *    agar tidak menuliskan data seperti itu di pertanyaan — menyimpannya di
 *    akun akan bertentangan dengan peringatan sendiri.
 *
 * 2. KATA SANDI TIDAK PERNAH DISIMPAN APA ADANYA. Dipakai `scrypt` dari
 *    node:crypto (bawaan Node, tanpa dependensi baru) dengan salt acak
 *    per-pengguna. JANGAN diganti SHA/MD5 — keduanya terlalu cepat sehingga
 *    bisa dipecah dengan menebak. scrypt sengaja lambat dan memakan memori.
 *
 * 3. TOKEN SESI DISIMPAN SEBAGAI HASH, bukan aslinya. Kalau isi tabel `sesi`
 *    terbaca (mis. backup bocor), token di situ tidak bisa dipakai masuk.
 *
 * 4. PESAN GALAT TIDAK MEMBOCORKAN. Waktu masuk, jawabannya selalu
 *    "Email/telepon atau kata sandi salah" — tidak pernah "email tidak
 *    terdaftar", karena itu memberi tahu penyerang alamat mana yang ada.
 *
 * 5. DATABASE OPSIONAL, tapi akun TIDAK. Berbeda dari konten/berita, login
 *    tidak punya jalur cadangan: tanpa database tidak ada tempat menyimpan
 *    akun. Jadi fungsi di sini mengembalikan galat yang jelas kalau database
 *    mati — bukan diam-diam gagal.
 *
 * ============================================================================
 */

import { scrypt, randomBytes, timingSafeEqual, createHash } from 'node:crypto'
import { promisify } from 'node:util'
import { db } from './db.js'

const scryptAsync = promisify(scrypt)

/** Panjang hash dan salt, dalam byte. */
const PANJANG_HASH = 64
const PANJANG_SALT = 16

/** Minimal panjang kata sandi. Jagi minta minimal 8 karakter. */
export const MIN_SANDI = 8
/** Batas atas supaya tidak ada yang mengirim kata sandi raksasa (scrypt mahal). */
export const MAKS_SANDI = 200

/** Umur sesi: 30 hari. Sesudah itu pengguna harus masuk lagi. */
const UMUR_SESI_MS = 30 * 24 * 60 * 60 * 1000

/* ---------------------------------------------------------------- galat --- */

/**
 * Galat yang pesannya AMAN ditampilkan ke pengguna.
 * Pesan lain (mis. galat SQL) tidak boleh bocor ke layar.
 */
export class AkunError extends Error {
  constructor(pesan, kode = 'akun_error', status = 400) {
    super(pesan)
    this.name = 'AkunError'
    this.kode = kode
    this.status = status
  }
}

/* ------------------------------------------------------------ normalisasi -- */

/**
 * Email: huruf kecil, tanpa spasi. " Budi@Mail.com " -> "budi@mail.com".
 *
 * WAJIB mengandung '@'. Tanpa syarat ini, nomor telepon seperti
 * "+62 812-3456-7890" ikut dianggap email — dan pendaftaran lewat nomor
 * telepon gagal dengan pesan yang membingungkan ("Bentuk emailnya belum
 * benar") padahal nomornya sah. Kesalahan ini pernah benar-benar terjadi.
 */
export function normalkanEmail(email) {
  const s = String(email ?? '').trim().toLowerCase()
  if (!s || !s.includes('@')) return null
  return s
}

/**
 * Telepon: hanya angka, dengan awalan 0 untuk nomor Indonesia.
 * "+62 812-3456-7890" dan "08123456789" dianggap nomor yang SAMA.
 */
export function normalkanTelepon(telepon) {
  let s = String(telepon ?? '').replace(/[^\d+]/g, '')
  if (!s) return null
  if (s.startsWith('+62')) s = '0' + s.slice(3)
  else if (s.startsWith('62') && s.length > 10) s = '0' + s.slice(2)
  if (!/^0\d{8,14}$/.test(s)) return null
  return s
}

/** Nama panggilan: dibersihkan, maksimal 40 karakter. */
export function normalkanNama(nama) {
  const s = String(nama ?? '')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 40)
  return s || null
}

/** Apakah bentuk emailnya masuk akal? (bukan validasi sempurna, memang tidak mungkin) */
export function emailMasukAkal(email) {
  const s = String(email ?? '').trim()
  return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(s) && s.length <= 190
}

/* --------------------------------------------------------- kata sandi ----- */

/**
 * Buat hash + salt dari kata sandi.
 * @param {string} sandi
 * @returns {Promise<{hash: string, salt: string}>}
 */
export async function hashSandi(sandi) {
  const salt = randomBytes(PANJANG_SALT).toString('hex')
  const kunci = await scryptAsync(sandi, salt, PANJANG_HASH)
  return { hash: kunci.toString('hex'), salt }
}

/**
 * Periksa kata sandi terhadap hash yang tersimpan.
 *
 * Memakai `timingSafeEqual`, bukan `===`. Perbandingan biasa berhenti di
 * huruf pertama yang berbeda, dan selisih waktunya bisa dipakai untuk
 * menebak isi hash sedikit demi sedikit.
 *
 * @returns {Promise<boolean>}
 */
export async function periksaSandi(sandi, hash, salt) {
  if (!hash || !salt) return false
  try {
    const kunci = await scryptAsync(String(sandi), String(salt), PANJANG_HASH)
    const tersimpan = Buffer.from(String(hash), 'hex')
    if (tersimpan.length !== kunci.length) return false
    return timingSafeEqual(kunci, tersimpan)
  } catch {
    return false
  }
}

/**
 * Periksa KEKUATAN kata sandi — dan kembalikan alasan yang bisa dibaca.
 * @returns {{ok: boolean, pesan?: string}}
 */
export function periksaKekuatan(sandi) {
  const s = String(sandi ?? '')
  if (s.length < MIN_SANDI) return { ok: false, pesan: `Kata sandi minimal ${MIN_SANDI} karakter.` }
  if (s.length > MAKS_SANDI) return { ok: false, pesan: `Kata sandi maksimal ${MAKS_SANDI} karakter.` }
  return { ok: true }
}

/* ---------------------------------------------------------------- token --- */

/** Hash token untuk disimpan. sha256 cukup di sini: token sudah acak 32 byte. */
export function hashToken(token) {
  return createHash('sha256').update(String(token)).digest('hex')
}

/** Token sesi acak — 32 byte = 64 karakter hex. Tidak bisa ditebak. */
export function buatToken() {
  return randomBytes(32).toString('hex')
}

/* ---------------------------------------------------------------- akun ---- */

/** Pastikan database ada; kalau tidak, beri galat yang jelas (bukan diam). */
export async function butuhDb() {
  const p = await db()
  if (!p) {
    throw new AkunError(
      'Fitur akun membutuhkan database, dan database sedang tidak tersambung. Nyalakan MariaDB lalu coba lagi.',
      'db_mati',
      503,
    )
  }
  return p
}

/** Bentuk pengguna yang AMAN dikirim ke peramban (tanpa hash/salt). */
export function aman(u) {
  if (!u) return null
  return {
    id: u.id,
    namaPengguna: u.nama_pengguna ?? null,
    email: u.email ?? null,
    telepon: u.telepon ?? null,
    pakaiGoogle: Boolean(u.google_id),
    punyaSandi: Boolean(u.sandi_hash),
  }
}

/**
 * Cari pengguna berdasarkan email ATAU telepon (yang mana pun yang cocok).
 * @returns {Promise<object|null>}
 */
export async function cariPengguna(identifier) {
  const p = await butuhDb()
  const email = normalkanEmail(identifier)
  const telepon = normalkanTelepon(identifier)
  const [baris] = await p.query(
    `SELECT * FROM pengguna_baru WHERE (email IS NOT NULL AND email = ?) OR (telepon IS NOT NULL AND telepon = ?) LIMIT 1`,
    [email, telepon],
  )
  return baris?.[0] ?? null
}

/** Apakah identifier ini sudah dipakai akun lain? */
export async function identifierTerpakai(identifier, kecualiId = null) {
  const p = await butuhDb()
  const email = normalkanEmail(identifier)
  const telepon = normalkanTelepon(identifier)
  const [baris] = await p.query(
    `SELECT id FROM pengguna_baru
      WHERE ((email IS NOT NULL AND email = ?) OR (telepon IS NOT NULL AND telepon = ?))
        AND (? IS NULL OR id <> ?)
      LIMIT 1`,
    [email, telepon, kecualiId, kecualiId],
  )
  return Boolean(baris?.length)
}

/**
 * Daftarkan akun baru.
 *
 * @param {{identifier: string, sandi: string, namaPengguna?: string}} p
 * @returns {Promise<object>} pengguna yang aman dikirim ke peramban
 */
export async function daftar({ identifier, sandi, namaPengguna = null }) {
  const p = await butuhDb()

  const email = normalkanEmail(identifier)
  const telepon = normalkanTelepon(identifier)
  if (!email && !telepon) {
    throw new AkunError('Masukkan email atau nomor telepon yang benar.', 'identifier_tidak_sah')
  }
  if (email && !emailMasukAkal(email)) {
    throw new AkunError('Bentuk emailnya belum benar.', 'email_tidak_sah')
  }

  const kuat = periksaKekuatan(sandi)
  if (!kuat.ok) throw new AkunError(kuat.pesan, 'sandi_lemah')

  if (await identifierTerpakai(identifier)) {
    throw new AkunError('Email atau nomor telepon ini sudah terdaftar. Coba masuk saja.', 'sudah_ada', 409)
  }

  const { hash, salt } = await hashSandi(sandi)
  const nama = normalkanNama(namaPengguna)

  try {
    const [hasil] = await p.query(
      `INSERT INTO pengguna_baru (email, telepon, nama_pengguna, sandi_hash, sandi_salt, dibuat, terakhir)
       VALUES (?, ?, ?, ?, ?, NOW(), NOW())`,
      [email, telepon, nama, hash, salt],
    )
    return aman({
      id: hasil.insertId,
      email,
      telepon,
      nama_pengguna: nama,
      sandi_hash: hash,
    })
  } catch (e) {
    // 1062 = duplikat. Bisa terjadi kalau dua permintaan datang bersamaan —
    // pemeriksaan di atas tidak atomik, jadi tetap harus ditangani di sini.
    if (e?.errno === 1062) {
      throw new AkunError('Email atau nomor telepon ini sudah terdaftar.', 'sudah_ada', 409)
    }
    throw e
  }
}

/**
 * Masuk dengan email/telepon + kata sandi.
 *
 * Pesan galatnya SELALU sama, baik akunnya tidak ada maupun sandinya salah —
 * supaya tidak memberi tahu penyerang alamat mana yang terdaftar.
 */
export async function masuk({ identifier, sandi }) {
  const u = await cariPengguna(identifier)
  const pesanSama = 'Email/telepon atau kata sandi salah.'

  if (!u) {
    // Tetap jalankan scrypt walau akunnya tidak ada, supaya waktu balasannya
    // mirip dengan kasus "akun ada tapi sandi salah". Tanpa ini, selisih
    // waktunya bisa dipakai menebak alamat mana yang terdaftar.
    await hashSandi(String(sandi ?? ''))
    throw new AkunError(pesanSama, 'sandi_salah', 401)
  }

  if (!u.sandi_hash) {
    throw new AkunError(
      'Akun ini dibuat lewat Google. Masuk dengan tombol Google, ya.',
      'pakai_google',
      409,
    )
  }

  const cocok = await periksaSandi(sandi, u.sandi_hash, u.sandi_salt)
  if (!cocok) throw new AkunError(pesanSama, 'sandi_salah', 401)

  const p = await butuhDb()
  await p.query(`UPDATE pengguna_baru SET terakhir = NOW() WHERE id = ?`, [u.id])
  return aman(u)
}

/* ---------------------------------------------------------------- sesi ---- */

/**
 * Buat sesi baru untuk pengguna.
 * @returns {Promise<{token: string, kedaluwarsa: Date}>}
 *   `token` dikirim ke peramban sebagai cookie; yang disimpan di database
 *   hanya hash-nya.
 */
export async function buatSesi(penggunaId, agen = null) {
  const p = await butuhDb()
  const token = buatToken()
  const kedaluwarsa = new Date(Date.now() + UMUR_SESI_MS)
  await p.query(
    `INSERT INTO sesi (pengguna_id, token_hash, dibuat, terakhir, kedaluwarsa, agen)
     VALUES (?, ?, NOW(), NOW(), ?, ?)`,
    [penggunaId, hashToken(token), kedaluwarsa, agen ? String(agen).slice(0, 200) : null],
  )
  return { token, kedaluwarsa }
}

/**
 * Ambil pengguna dari token sesi. Mengembalikan null kalau token tidak sah
 * atau sudah kedaluwarsa — TIDAK melempar, supaya rute bisa memperlakukan
 * "belum masuk" sebagai keadaan biasa, bukan galat.
 */
export async function penggunaDariToken(token) {
  if (!token) return null
  try {
    const p = await db()
    if (!p) return null
    const [baris] = await p.query(
      `SELECT u.*, s.id AS sesi_id, s.kedaluwarsa
         FROM sesi s JOIN pengguna_baru u ON u.id = s.pengguna_id
        WHERE s.token_hash = ? AND s.kedaluwarsa > NOW()
        LIMIT 1`,
      [hashToken(token)],
    )
    const u = baris?.[0]
    if (!u) return null
    // catat kapan terakhir dipakai — supaya pengguna bisa melihat sesi aktif
    p.query(`UPDATE sesi SET terakhir = NOW() WHERE id = ?`, [u.sesi_id]).catch(() => null)
    return aman(u)
  } catch {
    return null
  }
}

/** Hapus satu sesi (keluar dari perangkat ini saja). */
export async function hapusSesi(token) {
  if (!token) return
  try {
    const p = await db()
    if (!p) return
    await p.query(`DELETE FROM sesi WHERE token_hash = ?`, [hashToken(token)])
  } catch {
    /* keluar tetap dianggap berhasil walau database bermasalah */
  }
}

/** Hapus SEMUA sesi pengguna (keluar dari semua perangkat). */
export async function hapusSemuaSesi(penggunaId) {
  const p = await butuhDb()
  await p.query(`DELETE FROM sesi WHERE pengguna_id = ?`, [penggunaId])
}

/* ------------------------------------------------------------- username --- */

/**
 * Simpan nama panggilan (untuk sapaan "Halo Bayu!").
 * @returns {Promise<object>} pengguna yang sudah diperbarui
 */
export async function simpanNamaPengguna(penggunaId, nama) {
  const p = await butuhDb()
  const bersih = normalkanNama(nama)
  if (!bersih) throw new AkunError('Nama panggilan belum diisi.', 'nama_kosong')
  if (bersih.length < 2) throw new AkunError('Nama panggilan minimal 2 karakter.', 'nama_pendek')
  // nama hanya huruf, angka, spasi, titik, garis bawah, dan tanda hubung
  if (!/^[\p{L}\p{N} ._-]+$/u.test(bersih)) {
    throw new AkunError('Nama panggilan hanya boleh huruf, angka, spasi, dan . _ -', 'nama_tidak_sah')
  }
  await p.query(`UPDATE pengguna_baru SET nama_pengguna = ? WHERE id = ?`, [bersih, penggunaId])
  const [baris] = await p.query(`SELECT * FROM pengguna_baru WHERE id = ? LIMIT 1`, [penggunaId])
  return aman(baris?.[0])
}

/* --------------------------------------------------------------- riwayat -- */

/** Simpan (atau perbarui) satu sesi obrolan milik pengguna. */
export async function simpanRiwayat(penggunaId, sesiId, judul, isi) {
  const p = await butuhDb()
  const teks = typeof isi === 'string' ? isi : JSON.stringify(isi ?? [])
  await p.query(
    `INSERT INTO riwayat_pengguna (pengguna_id, sesi_id, judul, dibuat, diperbarui, isi)
     VALUES (?, ?, ?, NOW(), NOW(), ?)
     ON DUPLICATE KEY UPDATE judul = VALUES(judul), diperbarui = NOW(), isi = VALUES(isi)`,
    [penggunaId, String(sesiId).slice(0, 64), judul ? String(judul).slice(0, 200) : null, teks],
  )
}

/** Ambil semua riwayat milik pengguna, terbaru dulu. */
export async function ambilRiwayat(penggunaId, batas = 20) {
  const p = await butuhDb()
  const [baris] = await p.query(
    `SELECT sesi_id, judul, dibuat, diperbarui, isi
       FROM riwayat_pengguna WHERE pengguna_id = ?
      ORDER BY diperbarui DESC LIMIT ?`,
    [penggunaId, Number(batas) || 20],
  )
  return (baris ?? []).map((b) => ({
    id: b.sesi_id,
    judul: b.judul,
    dibuat: b.dibuat,
    diperbarui: b.diperbarui,
    isi: amanParse(b.isi),
  }))
}

/** Hapus satu riwayat milik pengguna. */
export async function hapusRiwayat(penggunaId, sesiId) {
  const p = await butuhDb()
  await p.query(`DELETE FROM riwayat_pengguna WHERE pengguna_id = ? AND sesi_id = ?`, [
    penggunaId,
    String(sesiId).slice(0, 64),
  ])
}

/** Parse JSON dengan aman — isi rusak tidak boleh membuat endpoint melempar. */
function amanParse(teks) {
  if (teks == null) return []
  if (typeof teks !== 'string') return teks
  try {
    return JSON.parse(teks)
  } catch {
    return []
  }
}
