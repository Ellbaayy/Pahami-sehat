/**
 * Masuk dengan Google — alur SERVER-SIDE (authorization code).
 *
 * ============================================================================
 * KENAPA SERVER-SIDE, BUKAN TOMBOL JAVASCRIPT
 * ============================================================================
 *
 * Dua cara Google menyediakan login:
 *
 *   a. JavaScript di peramban (Google Identity Services) — client ID saja.
 *   b. Server-side (kode otorisasi) — client ID + client SECRET.
 *
 * Aplikasi ini memakai (b) karena akunnya memang hidup di server: yang tahu
 * siapa yang masuk adalah cookie sesi `ps_sesi` yang diterbitkan server, bukan
 * peramban. Kalau memakai (a), server tetap harus percaya pada apa yang
 * dikirim peramban — dan itu artinya siapa pun bisa mengaku siapa saja.
 *
 * ============================================================================
 * ATURAN YANG TIDAK BOLEH DILANGGAR
 * ============================================================================
 *
 * 1. CLIENT SECRET TIDAK PERNAH SAMPAI KE PERAMBAAN. Pertukaran `code` menjadi
 *    token HANYA terjadi di server (fungsi `tukarCode` di bawah). Jangan
 *    pernah mengirim secret ke sisi klien, dan jangan menaruhnya di variabel
 *    yang diawali `VITE_` — semua yang diawali `VITE_` ditanamkan Vite ke
 *    berkas JavaScript yang bisa dibaca siapa saja.
 *
 * 2. `state` WAJIB DIPERIKSA. Tanpa itu, penyerang bisa menyiapkan tautan
 *    balikan dengan `code` miliknya sendiri lalu membuat korban masuk ke akun
 *    penyerang (login CSRF) — korban merasa sudah masuk, padahal aktivitasnya
 *    masuk ke akun orang lain. Nilai `state` acak disimpan di cookie HttpOnly
 *    dan dibandingkan saat balikan datang.
 *
 * 3. YANG DISIMPAN HANYA `sub` DAN EMAIL. `sub` adalah ID tetap milik
 *    pengguna di Google; email dipakai untuk menautkan dengan akun yang sudah
 *    ada. Nama, foto, jenis kelamin, dan lokasi DIBUANG — sama seperti akun
 *    biasa, yang disimpan hanya email/telepon, nama panggilan, dan hash sandi.
 *
 * 4. PENAUTAN AKUN HANYA KALAU EMAILNYA TERVERIFIKASI. Google sudah
 *    membuktikan pemilik email itu, dan jawabannya datang langsung dari server
 *    Google lewat HTTPS (bukan dari peramban), jadi menautkan berdasarkan
 *    email aman. Kalau Google mengatakan emailnya BELUM terverifikasi,
 *    tautannya DITOLAK — kalau tidak, akun bisa diambil alih hanya dengan
 *    mendaftarkan alamat orang lain di layanan lain.
 *
 * 5. REDIRECT URI HARUS SAMA PERSIS antara saat mengirim dan saat menukar.
 *    Google menolak dengan `redirect_uri_mismatch` kalau berbeda satu huruf
 *    pun (termasuk `http` vs `https` dan ada/tidaknya garis miring di akhir).
 *    Karena itu keduanya dihitung dari fungsi yang sama (`redirectUriDari`).
 *
 * ============================================================================
 */

import { randomBytes } from 'node:crypto'
import { AkunError, aman, butuhDb, normalkanEmail } from './akun.js'

/** Titik akhir Google. Ditulis di satu tempat supaya mudah diaudit. */
const URL_OTORISASI = 'https://accounts.google.com/o/oauth2/v2/auth'
const URL_TOKEN = 'https://oauth2.googleapis.com/token'
const URL_PROFIL = 'https://www.googleapis.com/oauth2/v3/userinfo'

/** Batas waktu bicara dengan Google — jangan menggantung pengguna. */
const BATAS_MS = 10_000

/** Hanya butuh identitas: `openid` + `email`. Tidak minta kontak, kalender, dsb. */
const CAKUPAN = 'openid email'

/** Client ID & Secret dari lingkungan. Secret TIDAK pernah keluar dari berkas ini. */
const CLIENT_ID = String(process.env.GOOGLE_CLIENT_ID ?? '').trim()
const CLIENT_SECRET = String(process.env.GOOGLE_CLIENT_SECRET ?? '').trim()

/**
 * Apakah login Google sudah dikonfigurasi?
 *
 * Dipakai rute untuk menjawab dengan jujur kalau belum diisi, bukan
 * mengalihkan pengguna ke halaman galat Google yang membingungkan.
 */
export function googleSiap() {
  return Boolean(CLIENT_ID && CLIENT_SECRET)
}

/**
 * Protokol permintaan, dengan mempertimbangkan proxy (Vercel).
 *
 * Di Vercel, Express melihat koneksi internalnya sebagai HTTP walau yang
 * datang dari pengguna adalah HTTPS. Header `x-forwarded-proto` yang
 * memberitahu keadaan sebenarnya — dan kalau salah di sini, redirect URI yang
 * dibangun tidak akan cocok dengan yang terdaftar di Google.
 */
function protokol(req) {
  const maju = String(req?.headers?.['x-forwarded-proto'] ?? '')
    .split(',')[0]
    .trim()
  if (maju) return maju
  return req?.secure ? 'https' : 'http'
}

/**
 * Alamat balikan yang dipakai untuk permintaan INI.
 *
 * Dihitung dari permintaan, bukan ditulis tetap, supaya laptop
 * (http://127.0.0.1:8787) dan alamat produksi sama-sama bekerja tanpa
 * mengubah kode — yang perlu dilakukan hanya mendaftarkan alamatnya di
 * Google Cloud Console.
 */
export function redirectUriDari(req) {
  const host = String(req?.headers?.host ?? '127.0.0.1:8787')
  return `${protokol(req)}://${host}/api/akun/google/callback`
}

/** Nilai `state` acak — 32 byte, tidak bisa ditebak. */
export function buatState() {
  return randomBytes(32).toString('hex')
}

/**
 * Alamat yang harus dibuka peramban untuk mulai masuk dengan Google.
 *
 * @param {{redirectUri: string, state: string}} p
 */
export function urlMasuk({ redirectUri, state }) {
  const q = new URLSearchParams({
    client_id: CLIENT_ID,
    redirect_uri: redirectUri,
    response_type: 'code',
    scope: CAKUPAN,
    state,
    // `select_account` supaya pengguna bisa memilih akun lain, bukan otomatis
    // memakai akun yang sedang aktif di peramban (di komputer bersama, itu
    // justru bikin bingung: "kok masuk sebagai orang lain?").
    prompt: 'select_account',
  })
  return `${URL_OTORISASI}?${q.toString()}`
}

/** Galat yang datang dari Google, dengan pesan yang aman dibaca pengguna. */
function galatGoogle(pesan, kode) {
  return new AkunError(pesan, kode, 502)
}

/**
 * Tukar `code` menjadi token, lalu ambil identitas pengguna dari Google.
 *
 * DUA panggilan jaringan, keduanya dari SERVER ke Google:
 *   1. POST /token        -> menukar code + client_secret menjadi access_token
 *   2. GET  /userinfo     -> mengambil sub + email dengan access_token itu
 *
 * @returns {Promise<{sub: string, email: string|null}>}
 */
export async function tukarCode(code, redirectUri) {
  const kode = String(code ?? '').trim()
  if (!kode) throw new AkunError('Kode dari Google kosong.', 'google_tanpa_kode', 400)

  const isi = new URLSearchParams({
    code: kode,
    client_id: CLIENT_ID,
    client_secret: CLIENT_SECRET,
    redirect_uri: redirectUri,
    grant_type: 'authorization_code',
  })

  let jawabToken
  try {
    jawabToken = await fetch(URL_TOKEN, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: isi.toString(),
      signal: AbortSignal.timeout(BATAS_MS),
    })
  } catch {
    throw galatGoogle('Tidak bisa menghubungi Google. Coba lagi sebentar lagi.', 'google_tak_terhubung')
  }

  if (!jawabToken.ok) {
    // Badan jawabannya memuat keterangan seperti "invalid_grant" — itu untuk
    // kita, bukan untuk pengguna. Jangan ditampilkan apa adanya.
    const teks = await jawabToken.text().catch(() => '')
    console.error('[google] tukar code gagal:', jawabToken.status, teks.slice(0, 300))
    throw galatGoogle('Google menolak proses masuk ini. Coba ulangi dari tombol Google.', 'google_tolak')
  }

  const token = await jawabToken.json().catch(() => null)
  const akses = token?.access_token
  if (!akses) {
    throw galatGoogle('Google tidak mengirim token akses.', 'google_tanpa_token')
  }

  let jawabProfil
  try {
    jawabProfil = await fetch(URL_PROFIL, {
      headers: { Authorization: `Bearer ${akses}` },
      signal: AbortSignal.timeout(BATAS_MS),
    })
  } catch {
    throw galatGoogle('Tidak bisa mengambil data akun dari Google.', 'google_profil_gagal')
  }

  if (!jawabProfil.ok) {
    throw galatGoogle('Google tidak memberi data akun ini.', 'google_profil_gagal')
  }

  const profil = await jawabProfil.json().catch(() => null)
  const sub = profil?.sub ? String(profil.sub) : ''
  if (!sub) throw galatGoogle('Google tidak mengirim ID akun.', 'google_tanpa_sub')

  // ATURAN 4: email yang belum terverifikasi TIDAK boleh dipakai menautkan.
  // Nama kolomnya berbeda antar versi titik akhir, jadi keduanya diperiksa.
  const terverifikasi = profil?.email_verified ?? profil?.verified_email
  const email = normalkanEmail(profil?.email)
  if (terverifikasi === false) {
    throw new AkunError(
      'Email akun Google ini belum diverifikasi, jadi belum bisa dipakai masuk. Verifikasi dulu di Google, ya.',
      'google_email_belum_verifikasi',
      403,
    )
  }

  return { sub: sub.slice(0, 64), email }
}

/**
 * Masuk (atau daftar) memakai identitas Google.
 *
 * TIGA kemungkinan, berurutan:
 *   1. `google_id` sudah dikenal        -> langsung masuk.
 *   2. Emailnya sudah punya akun        -> tautkan `google_id` ke akun itu.
 *      (Aman: Google sudah membuktikan pemilik emailnya — lihat ATURAN 4.)
 *   3. Tidak ada sama sekali            -> buat akun baru.
 *
 * @param {{sub: string, email: string|null, agen?: string|null}} p
 * @returns {Promise<object>} pengguna dalam bentuk yang aman dikirim ke peramban
 */
export async function masukDenganGoogle({ sub, email }) {
  const p = await butuhDb()
  const mail = normalkanEmail(email)

  // --- 1. sudah pernah masuk lewat Google
  const [sudah] = await p.query(`SELECT * FROM pengguna_baru WHERE google_id = ? LIMIT 1`, [sub])
  if (sudah?.[0]) {
    await p.query(`UPDATE pengguna_baru SET terakhir = NOW() WHERE id = ?`, [sudah[0].id])
    return aman(sudah[0])
  }

  // --- 2. emailnya sudah terdaftar dengan kata sandi -> tautkan
  if (mail) {
    const [ada] = await p.query(`SELECT * FROM pengguna_baru WHERE email = ? LIMIT 1`, [mail])
    if (ada?.[0]) {
      const lama = ada[0]
      if (lama.google_id && lama.google_id !== sub) {
        // Dua akun Google berbeda mengaku email yang sama. Ini tidak mungkin
        // terjadi kalau emailnya benar-benar terverifikasi, jadi lebih baik
        // berhenti daripada menebak.
        throw new AkunError(
          'Email ini sudah tertaut ke akun Google yang lain. Masuk pakai akun Google itu, atau pakai kata sandi.',
          'google_bentrok',
          409,
        )
      }
      await p.query(`UPDATE pengguna_baru SET google_id = ?, terakhir = NOW() WHERE id = ?`, [sub, lama.id])
      return aman({ ...lama, google_id: sub })
    }
  }

  // --- 3. akun baru
  //
  // Nama panggilan SENGAJA dibiarkan kosong: aplikasi akan menanyakannya
  // ("Mau dipanggil apa?"). Nama dari Google adalah nama lengkap, dan
  // menyimpannya bertentangan dengan janji privasi aplikasi ini.
  try {
    const [hasil] = await p.query(
      `INSERT INTO pengguna_baru (email, google_id, dibuat, terakhir) VALUES (?, ?, NOW(), NOW())`,
      [mail, sub],
    )
    return aman({ id: hasil.insertId, email: mail, google_id: sub, nama_pengguna: null })
  } catch (e) {
    // 1062 = duplikat: dua permintaan balikan datang hampir bersamaan.
    if (e?.errno === 1062) {
      const [ulang] = await p.query(`SELECT * FROM pengguna_baru WHERE google_id = ? LIMIT 1`, [sub])
      if (ulang?.[0]) return aman(ulang[0])
    }
    throw e
  }
}
