/**
 * Rute akun: daftar, masuk, keluar, profil, nama panggilan, dan riwayat.
 *
 * ============================================================================
 * CARA SESI BEKERJA
 * ============================================================================
 *
 * Setelah masuk, server mengirim cookie bernama `ps_sesi`:
 *
 *   HttpOnly  -> TIDAK bisa dibaca JavaScript. Kalau ada celah XSS di halaman,
 *                penyerang tetap tidak bisa mencuri sesinya.
 *   SameSite=Lax -> cookie tidak ikut terkirim pada permintaan lintas-situs,
 *                sehingga situs lain tidak bisa "menumpang" sesi pengguna.
 *   Secure    -> hanya lewat HTTPS. Dinyalakan HANYA kalau permintaannya
 *                memang HTTPS (di laptop sendiri memakai http, jadi jangan
 *                dipaksa — kalau dipaksa, cookie tidak akan terkirim sama
 *                sekali dan login tampak "berhasil tapi tidak masuk").
 *   Path=/    -> berlaku untuk seluruh aplikasi.
 *
 * Cookie dibaca manual dari header, tanpa pustaka `cookie-parser` — satu
 * dependensi lebih sedikit, dan kebutuhannya hanya satu cookie.
 *
 * ============================================================================
 */

import { Router } from 'express'
import { batasi } from './batas.js'
import {
  AkunError,
  daftar,
  masuk,
  buatSesi,
  penggunaDariToken,
  hapusSesi,
  hapusSemuaSesi,
  simpanNamaPengguna,
  simpanRiwayat,
  ambilRiwayat,
  hapusRiwayat,
  cariPengguna,
  identifierTerpakai,
  normalkanEmail,
  normalkanTelepon,
  emailMasukAkal,
} from './akun.js'

const rute = Router()

/** Nama cookie sesi. */
const COOKIE = 'ps_sesi'

/**
 * Batas laju khusus login.
 *
 * Percobaan masuk dibatasi 10 per menit per IP. Tanpa ini, kata sandi bisa
 * ditebak berulang-ulang dengan cepat. Pendaftaran dibatasi lebih ketat
 * (5 per menit) karena tidak ada alasan wajar untuk mendaftar berkali-kali.
 */
const batasMasuk = batasi({ jendelaMs: 60_000, maks: 10, nama: 'percobaan masuk' })
const batasDaftar = batasi({ jendelaMs: 60_000, maks: 5, nama: 'pendaftaran' })
const batasUmum = batasi({ jendelaMs: 60_000, maks: 60, nama: 'permintaan akun' })

/** Bungkus handler async supaya galatnya tertangkap middleware galat. */
const bungkus = (fn) => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next)

/** Apakah permintaan ini lewat HTTPS? Dipakai untuk menyalakan flag Secure. */
function lewatHttps(req) {
  return (
    req.secure === true ||
    String(req.headers['x-forwarded-proto'] ?? '').split(',')[0].trim() === 'https'
  )
}

/**
 * Setel cookie sesi.
 *
 * `secure` hanya dinyalakan kalau permintaannya HTTPS. Kalau selalu
 * dinyalakan, di laptop sendiri (http://127.0.0.1) cookie-nya TIDAK akan
 * dikirim peramban — dan gejalanya menyesatkan: login menjawab "berhasil"
 * tapi pengguna tetap dianggap belum masuk.
 */
function setelCookie(req, res, token, kedaluwarsa) {
  const bagian = [
    `${COOKIE}=${token}`,
    'Path=/',
    'HttpOnly',
    'SameSite=Lax',
    `Expires=${kedaluwarsa.toUTCString()}`,
  ]
  if (lewatHttps(req)) bagian.push('Secure')
  res.setHeader('Set-Cookie', bagian.join('; '))
}

/** Hapus cookie sesi (keluar). */
function hapusCookie(res) {
  res.setHeader('Set-Cookie', `${COOKIE}=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0`)
}

/** Baca cookie sesi dari header, tanpa pustaka tambahan. */
export function bacaToken(req) {
  const mentah = req?.headers?.cookie
  if (!mentah) return null
  for (const bagian of String(mentah).split(';')) {
    const i = bagian.indexOf('=')
    if (i < 0) continue
    if (bagian.slice(0, i).trim() === COOKIE) return bagian.slice(i + 1).trim() || null
  }
  return null
}

/**
 * Lampirkan pengguna yang sedang masuk ke `req.pengguna` (null kalau belum).
 * Tidak pernah menolak permintaan — rute yang menentukan perlu masuk atau tidak.
 */
async function kenaliPengguna(req, _res, next) {
  try {
    req.pengguna = await penggunaDariToken(bacaToken(req))
  } catch {
    req.pengguna = null
  }
  next()
}

/** Tolak kalau belum masuk. */
function wajibMasuk(req, _res, next) {
  if (!req.pengguna) {
    return next(new AkunError('Kamu perlu masuk dulu.', 'belum_masuk', 401))
  }
  next()
}

/* ------------------------------------------------------------------ rute -- */

/**
 * Bentuk galat akun supaya frontend bisa menampilkannya dengan rapi.
 * Pesannya sudah aman (ditulis manusia), jadi boleh dikirim apa adanya.
 */
function kirimGalat(res, e) {
  if (e instanceof AkunError) {
    return res.status(e.status).json({ ok: false, code: e.kode, pesan: e.message })
  }
  // Galat tak terduga: JANGAN bocorkan isinya ke pengguna (bisa memuat detail SQL)
  console.error('[akun] galat tak terduga:', e?.message ?? e)
  return res.status(500).json({ ok: false, code: 'galat_server', pesan: 'Terjadi kesalahan. Coba lagi.' })
}

/** Siapa yang sedang masuk? (dipakai aplikasi saat dibuka) */
rute.get(
  '/api/akun/saya',
  batasUmum,
  kenaliPengguna,
  bungkus(async (req, res) => {
    res.json({ ok: true, masuk: Boolean(req.pengguna), pengguna: req.pengguna ?? null })
  }),
)

/**
 * Periksa apakah identifier sudah terdaftar — dipakai halaman gerbang supaya
 * bisa mengarahkan "sudah punya akun" vs "belum punya akun".
 *
 * CATATAN KEAMANAN: endpoint ini memang membocorkan apakah sebuah alamat
 * terdaftar. Itu memang tujuannya (jagi meminta alurnya begitu), dan risikonya
 * dibatasi: dibatasi laju, hanya menerima email/telepon berbentuk sah, dan
 * TIDAK memberi tahu apa pun selain ada/tidak ada.
 */
rute.post(
  '/api/akun/cek',
  batasMasuk,
  bungkus(async (req, res) => {
    const identifier = String(req.body?.identifier ?? '').trim()
    const email = normalkanEmail(identifier)
    const telepon = normalkanTelepon(identifier)
    if (!email && !telepon) {
      return res.status(400).json({ ok: false, code: 'identifier_tidak_sah', pesan: 'Masukkan email atau nomor telepon yang benar.' })
    }
    if (email && !emailMasukAkal(email)) {
      return res.status(400).json({ ok: false, code: 'email_tidak_sah', pesan: 'Bentuk emailnya belum benar.' })
    }
    const ada = await identifierTerpakai(identifier)
    // Jenis identifier dipakai frontend untuk menampilkan label yang tepat
    res.json({ ok: true, terdaftar: ada, jenis: email ? 'email' : 'telepon' })
  }),
)

/** Daftar akun baru + langsung masuk. */
rute.post(
  '/api/akun/daftar',
  batasDaftar,
  bungkus(async (req, res) => {
    try {
      const pengguna = await daftar({
        identifier: String(req.body?.identifier ?? '').trim(),
        sandi: String(req.body?.sandi ?? ''),
        namaPengguna: req.body?.namaPengguna ?? null,
      })
      const { token, kedaluwarsa } = await buatSesi(pengguna.id, req.headers['user-agent'])
      setelCookie(req, res, token, kedaluwarsa)
      res.status(201).json({ ok: true, pengguna, perluNama: !pengguna.namaPengguna })
    } catch (e) {
      kirimGalat(res, e)
    }
  }),
)

/** Masuk. */
rute.post(
  '/api/akun/masuk',
  batasMasuk,
  bungkus(async (req, res) => {
    try {
      const pengguna = await masuk({
        identifier: String(req.body?.identifier ?? '').trim(),
        sandi: String(req.body?.sandi ?? ''),
      })
      const { token, kedaluwarsa } = await buatSesi(pengguna.id, req.headers['user-agent'])
      setelCookie(req, res, token, kedaluwarsa)
      res.json({ ok: true, pengguna, perluNama: !pengguna.namaPengguna })
    } catch (e) {
      kirimGalat(res, e)
    }
  }),
)

/** Keluar dari perangkat ini. */
rute.post(
  '/api/akun/keluar',
  batasUmum,
  bungkus(async (req, res) => {
    await hapusSesi(bacaToken(req))
    hapusCookie(res)
    res.json({ ok: true })
  }),
)

/** Keluar dari SEMUA perangkat. */
rute.post(
  '/api/akun/keluar-semua',
  batasUmum,
  kenaliPengguna,
  wajibMasuk,
  bungkus(async (req, res) => {
    await hapusSemuaSesi(req.pengguna.id)
    hapusCookie(res)
    res.json({ ok: true })
  }),
)

/** Simpan nama panggilan (untuk sapaan "Halo Bayu!"). */
rute.post(
  '/api/akun/nama',
  batasUmum,
  kenaliPengguna,
  wajibMasuk,
  bungkus(async (req, res) => {
    try {
      const pengguna = await simpanNamaPengguna(req.pengguna.id, req.body?.namaPengguna)
      res.json({ ok: true, pengguna })
    } catch (e) {
      kirimGalat(res, e)
    }
  }),
)

/* --------------------------------------------------------------- riwayat -- */

/** Ambil riwayat obrolan milik pengguna yang sedang masuk. */
rute.get(
  '/api/akun/riwayat',
  batasUmum,
  kenaliPengguna,
  wajibMasuk,
  bungkus(async (req, res) => {
    const daftarRiwayat = await ambilRiwayat(req.pengguna.id, 20)
    res.json({ ok: true, riwayat: daftarRiwayat })
  }),
)

/**
 * Pindahkan riwayat dari peramban ke akun — dipakai SEKALI saat pengguna
 * masuk pertama kali, supaya obrolan lama tidak hilang.
 *
 * Aman dipanggil berulang: `sesi_id` unik per pengguna, jadi kiriman yang
 * sama hanya memperbarui, tidak menggandakan.
 */
rute.post(
  '/api/akun/riwayat/pindah',
  batasUmum,
  kenaliPengguna,
  wajibMasuk,
  bungkus(async (req, res) => {
    const daftarLama = Array.isArray(req.body?.riwayat) ? req.body.riwayat.slice(0, 20) : []
    let dipindah = 0
    for (const s of daftarLama) {
      const id = String(s?.id ?? '').trim()
      if (!id) continue
      try {
        await simpanRiwayat(req.pengguna.id, id, s?.judul ?? null, s?.pesan ?? s?.isi ?? [])
        dipindah += 1
      } catch {
        /* satu sesi gagal tidak menghalangi yang lain */
      }
    }
    res.json({ ok: true, dipindah })
  }),
)

/** Simpan satu sesi obrolan (dipakai setelah percakapan berubah). */
rute.put(
  '/api/akun/riwayat/:sesiId',
  batasUmum,
  kenaliPengguna,
  wajibMasuk,
  bungkus(async (req, res) => {
    const sesiId = String(req.params.sesiId ?? '').trim()
    if (!sesiId) return res.status(400).json({ ok: false, code: 'sesi_kosong', pesan: 'ID sesi kosong.' })
    await simpanRiwayat(req.pengguna.id, sesiId, req.body?.judul ?? null, req.body?.pesan ?? [])
    res.json({ ok: true })
  }),
)

/** Hapus satu riwayat milik pengguna. */
rute.delete(
  '/api/akun/riwayat/:sesiId',
  batasUmum,
  kenaliPengguna,
  wajibMasuk,
  bungkus(async (req, res) => {
    await hapusRiwayat(req.pengguna.id, req.params.sesiId)
    res.json({ ok: true })
  }),
)

export { kenaliPengguna, wajibMasuk, COOKIE }
export default rute
