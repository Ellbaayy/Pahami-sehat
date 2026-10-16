#!/usr/bin/env node
/**
 * uji-google.mjs — uji masuk dengan Google (alur server-side).
 *
 * KENAPA SKRIP INI ADA
 * Login lewat Google memindahkan kepercayaan ke pihak ketiga: kalau salah,
 * akibatnya bukan tampilan yang jelek, melainkan AKUN ORANG LAIN bisa dibuka.
 * Karena itu yang diuji di sini bukan "apakah tombolnya jalan" — itu diuji
 * manual di peramban — melainkan aturan yang menentukan siapa yang masuk:
 *
 *   1. `state` DIPERIKSA. Tanpa itu, penyerang bisa mengirim korban ke tautan
 *      balikan berisi `code` milik penyerang, dan korban masuk ke akun
 *      penyerang tanpa sadar (login CSRF).
 *   2. `state` SEKALI PAKAI. Cookie-nya dihapus saat balikan diterima.
 *   3. Akun HANYA ditautkan kalau emailnya sudah diverifikasi Google.
 *   4. Client secret TIDAK PERNAH sampai ke peramban (tidak ada di HTML mana
 *      pun, dan tidak ada variabel `VITE_` yang memuatnya).
 *   5. Akun Google TIDAK menyimpan nama lengkap — hanya email + google_id.
 *
 * CARA KERJA
 * Server Express asli dinyalakan di PORT acak, dengan `globalThis.fetch`
 * DIGANTI supaya jawaban Google bisa ditentukan sendiri. Jadi tidak ada
 * jaringan dan tidak ada data Google sungguhan yang dipakai — tetapi jalur
 * kodenya utuh: rute, cookie, `state`, dan penulisan ke database.
 *
 * TIDAK BUTUH RAHASIA. Client id/secret sungguhan tidak diperlukan: kalau
 * belum diisi, uji memakai nilai tiruan dan tetap berjalan — jadi CI (yang
 * memang tidak menyimpan rahasia) tetap menguji aturan keamanannya.
 *
 * DILEWATI, bukan GAGAL, kalau MariaDB tidak tersambung: bagian yang menulis
 * akun memang butuh database, dan CI tidak boleh merah karenanya.
 *
 * Cara pakai:
 *   node uji-google.mjs
 */

import { createServer } from 'node:http'

/**
 * KENAPA IMPORT-NYA DINAMIS, BUKAN `import` DI ATAS BERKAS
 *
 * `app/server/index.js` menarik `config.js`, dan config.js MENOLAK JALAN kalau
 * `KENARI_API_KEY` belum diisi — perilaku yang benar untuk server sungguhan,
 * tetapi mematikan uji ini di CI yang memang tidak punya kunci rahasia.
 *
 * Karena itu variabel lingkungan diisi LEBIH DULU (hanya kalau masih kosong,
 * jadi kunci sungguhan tidak pernah tertimpa), baru modulnya diimpor. Uji ini
 * tidak pernah memanggil model, jadi kunci tiruan tidak apa-apa.
 */
process.env.KENARI_API_KEY ??= 'kunci-tiruan-uji-tanpa-jaringan'

/**
 * Kredensial Google TIRUAN kalau belum ada.
 *
 * Uji ini TIDAK memanggil Google sungguhan — `globalThis.fetch` diganti di
 * bawah — jadi client id/secret sungguhan tidak diperlukan. Dengan nilai
 * tiruan, aturan keamanan yang paling penting (`state` diperiksa, tidak
 * ditukar sebelum diperiksa, sekali pakai) tetap teruji di CI yang memang
 * tidak menyimpan rahasia.
 */
process.env.GOOGLE_CLIENT_ID ??= 'client-id-tiruan-uji.apps.googleusercontent.com'
process.env.GOOGLE_CLIENT_SECRET ??= 'client-secret-tiruan-uji'

const { dbSiap, tanya, tutupDb } = await import('./app/server/db.js')
const { default: app } = await import('./app/server/index.js')

let lulus = 0
let gagal = 0
let dilewati = 0

function cek(nama, dapat, harap) {
  const ok = JSON.stringify(dapat) === JSON.stringify(harap)
  if (ok) {
    lulus++
    console.log(`  ok    ${nama}`)
  } else {
    gagal++
    console.log(`  GAGAL ${nama}`)
    console.log(`        harap: ${JSON.stringify(harap)}`)
    console.log(`        dapat: ${JSON.stringify(dapat)}`)
  }
}

function lewati(pesan) {
  dilewati++
  console.log(`  --    DILEWATI: ${pesan}`)
}

/* --------------------------------------------------------------- prasyarat -- */

console.log('\n=== PRASYARAT ===')
console.log('  google    : TIDAK dipanggil sungguhan (jawabannya diganti di uji ini)')

const dbAktif = await dbSiap().catch(() => false)
console.log(`  database  : ${dbAktif ? 'tersambung' : 'TIDAK tersambung (bagian database dilewati)'}`)

/* --------------------------------------------------- server + fetch palsu -- */

const PORT = 8900 + Math.floor(Math.random() * 90)
const BASE = `http://127.0.0.1:${PORT}`
const server = createServer(app)
await new Promise((r) => server.listen(PORT, '127.0.0.1', r))

/** Jawaban Google yang sedang berlaku untuk uji ini. */
let balasanToken = { ok: true, status: 200, isi: { access_token: 'token-uji' } }
let balasanProfil = {
  ok: true,
  status: 200,
  isi: { sub: 'sub-uji-1', email: 'uji.google@contoh.com', email_verified: true },
}
/** Catatan panggilan ke Google, untuk memeriksa apa yang benar-benar dikirim. */
const panggilan = []

const fetchAsli = globalThis.fetch
globalThis.fetch = async (url, opsi = {}) => {
  const alamat = String(url)
  if (alamat.includes('oauth2.googleapis.com') || alamat.includes('googleapis.com')) {
    panggilan.push({ url: alamat, opsi })
    const b = alamat.includes('/token') ? balasanToken : balasanProfil
    return {
      ok: b.ok,
      status: b.status,
      json: async () => b.isi,
      text: async () => JSON.stringify(b.isi),
    }
  }
  return fetchAsli(url, opsi) // ke server sendiri, diteruskan apa adanya
}


/**
 * Pembantu query.
 *
 * PENTING: `tanya()` di app/server/db.js sudah membongkar hasil `pool.query`
 * sendiri — untuk SELECT ia mengembalikan ARRAY BARIS, dan untuk
 * INSERT/UPDATE ia mengembalikan objek header (memuat `insertId`).
 * Jadi jangan dibongkar lagi dengan `const [x] = await tanya(...)`:
 * pada INSERT, header itu bukan iterable dan skripnya berhenti dengan
 * "intermediate value is not iterable".
 */
async function pilih(sql, params = []) {
  const hasil = await tanya(sql, params)
  return Array.isArray(hasil) ? hasil : []
}
async function jalankan(sql, params = []) {
  return tanya(sql, params)
}

/** Panggil server sendiri. `redirect: 'manual'` supaya pengalihan tidak diikuti. */
async function ambil(jalur, opsi = {}) {
  const res = await fetchAsli(BASE + jalur, { redirect: 'manual', ...opsi })
  const setCookie = res.headers.getSetCookie?.() ?? []
  const cookie = setCookie.map((c) => c.split(';')[0]).join('; ')
  const teks = await res.text()
  return { status: res.status, lokasi: res.headers.get('location'), cookie, setCookie, teks, res }
}

/* ================================================== 1. MULAI MASUK ======== */

console.log('\n=== MULAI: rute /api/akun/google ===')

const mulai = await ambil('/api/akun/google')
cek('tidak menjawab 404 (rutenya ada)', mulai.status === 302, true)
cek('mengalihkan ke Google', String(mulai.lokasi).startsWith('https://accounts.google.com/o/oauth2/v2/auth'), true)

const url = new URL(mulai.lokasi)
cek('client_id ikut dikirim', url.searchParams.get('client_id'), process.env.GOOGLE_CLIENT_ID)
cek(
  'redirect_uri menunjuk callback kita',
  url.searchParams.get('redirect_uri'),
  `${BASE}/api/akun/google/callback`,
)
cek('response_type=code', url.searchParams.get('response_type'), 'code')
cek('hanya minta openid + email', url.searchParams.get('scope'), 'openid email')
cek('state ada dan panjang (32 byte hex)', /^[0-9a-f]{64}$/.test(url.searchParams.get('state') ?? ''), true)

const stateAsli = url.searchParams.get('state')
const cookieState = mulai.cookie

cek('cookie state disetel', cookieState.startsWith('ps_oauth_state='), true)
cek('cookie state HttpOnly', /HttpOnly/i.test(mulai.setCookie.join('; ')), true)
cek('cookie state SameSite=Lax', /SameSite=Lax/i.test(mulai.setCookie.join('; ')), true)
cek(
  'CLIENT SECRET TIDAK ADA di alamat Google',
  String(mulai.lokasi).includes(process.env.GOOGLE_CLIENT_SECRET),
  false,
)
cek('CLIENT SECRET TIDAK ADA di balasan', mulai.teks.includes(process.env.GOOGLE_CLIENT_SECRET), false)

// Dua permintaan berturut-turut harus memakai `state` BERBEDA — kalau sama,
// nilainya bisa ditebak dan penangkal CSRF-nya tidak berguna.
const mulai2 = await ambil('/api/akun/google')
cek('state berbeda tiap permintaan', new URL(mulai2.lokasi).searchParams.get('state') === stateAsli, false)

/* ========================================= 2. STATE: PENANGKAL CSRF ======= */

console.log('\n=== STATE: permintaan tanpa diawali tombol Google ===')

const tanpaState = await ambil('/api/akun/google/callback?code=kode-palsu')
cek('code tanpa state DITOLAK', tanpaState.status, 400)
cek('tidak ada cookie sesi yang terbit', /ps_sesi=/.test(tanpaState.cookie), false)
cek('pesannya bisa dibaca manusia', /tidak sah|kedaluwarsa/i.test(tanpaState.teks), true)

const stateSalah = await ambil('/api/akun/google/callback?code=kode-palsu&state=' + 'a'.repeat(64), {
  headers: { cookie: cookieState },
})
cek('state yang tidak cocok DITOLAK', stateSalah.status, 400)
cek('tidak ada cookie sesi yang terbit', /ps_sesi=/.test(stateSalah.cookie), false)

// Yang paling penting: `code` TIDAK boleh ditukar sebelum `state` diperiksa.
cek('code TIDAK ditukar saat state salah', panggilan.length, 0)

/* ============================================ 3. PENGGUNA MENOLAK ========= */

console.log('\n=== PENGGUNA MENOLAK di layar Google ===')

const ditolak = await ambil('/api/akun/google/callback?error=access_denied&state=' + stateAsli, {
  headers: { cookie: cookieState },
})
cek('tidak ada sesi yang terbit', /ps_sesi=/.test(ditolak.cookie), false)
cek('pesannya jelas dan tidak menakutkan', /dibatalkan/i.test(ditolak.teks), true)
cek('tidak memanggil Google sama sekali', panggilan.length, 0)

/* ==================================== 4. ALUR BERHASIL -> AKUN BARU ======= */

console.log('\n=== ALUR BERHASIL: akun baru ===')

if (!dbAktif) {
  lewati('MariaDB tidak tersambung — bagian ini butuh database')
} else {
  const email = `uji.google.${Date.now()}@contoh.com`
  balasanProfil = { ok: true, status: 200, isi: { sub: `sub-${Date.now()}`, email, email_verified: true } }

  const balik = await ambil(`/api/akun/google/callback?code=kode-sah&state=${stateAsli}`, {
    headers: { cookie: cookieState },
  })

  cek('pengalihan kembali ke aplikasi', balik.status, 302)
  cek('tujuannya /app/', balik.lokasi, '/app/')
  cek('cookie sesi terbit', /ps_sesi=/.test(balik.cookie), true)
  cek(
    'cookie state dihapus (sekali pakai)',
    balik.setCookie.some((c) => c.startsWith('ps_oauth_state=;')),
    true,
  )

  // --- apa yang benar-benar dikirim ke Google
  const keToken = panggilan.find((p) => p.url.includes('/token'))
  cek('menukar code ke Google', Boolean(keToken), true)
  cek('memakai grant_type=authorization_code', keToken?.opsi?.body?.includes('grant_type=authorization_code'), true)
  cek('client_secret ikut (dari server)', keToken?.opsi?.body?.includes(process.env.GOOGLE_CLIENT_SECRET), true)
  cek('redirect_uri SAMA PERSIS saat menukar', keToken?.opsi?.body?.includes(encodeURIComponent(`${BASE}/api/akun/google/callback`)), true)
  cek('tidak mengirim password/scope aneh', keToken?.opsi?.body?.includes('scope'), false)

  // --- apa yang tersimpan di database
  const baris = await pilih(
    `SELECT id, email, nama_pengguna, sandi_hash, google_id FROM pengguna_baru WHERE email = ? LIMIT 1`,
    [email],
  )
  const u = baris[0]
  cek('akun baru dibuat', Boolean(u), true)
  cek('google_id tersimpan', Boolean(u?.google_id), true)
  cek('sandi_hash KOSONG (tidak ada sandi karangan)', u?.sandi_hash, null)
  cek('nama lengkap TIDAK disimpan', u?.nama_pengguna, null)

  // --- sesi benar-benar bisa dipakai
  const token = /ps_sesi=([0-9a-f]+)/.exec(balik.cookie)?.[1]
  const saya = await ambil('/api/akun/saya', { headers: { cookie: `ps_sesi=${token}` } })
  const data = JSON.parse(saya.teks)
  cek('sesi Google dianggap sudah masuk', data.masuk, true)
  cek('perluNama (nama panggilan belum diisi)', data.pengguna?.namaPengguna, null)
  cek('ditandai pakaiGoogle', data.pengguna?.pakaiGoogle, true)

  /* ============================== 5. MASUK ULANG: akun yang sama ========= */

  console.log('\n=== MASUK ULANG: google_id yang sama ===')

  const mulai3 = await ambil('/api/akun/google')
  const state3 = new URL(mulai3.lokasi).searchParams.get('state')
  const balik2 = await ambil(`/api/akun/google/callback?code=kode-sah-2&state=${state3}`, {
    headers: { cookie: mulai3.cookie },
  })
  cek('masuk lagi berhasil', balik2.status, 302)

  const ulang = await pilih(`SELECT COUNT(*) AS n FROM pengguna_baru WHERE email = ?`, [email])
  cek('TIDAK membuat akun kedua', Number(ulang[0]?.n), 1)

  /* ==================== 6. PENAUTAN ke akun kata sandi yang sudah ada ==== */

  console.log('\n=== PENAUTAN: email yang sudah punya akun kata sandi ===')

  const emailTaut = `uji.taut.${Date.now()}@contoh.com`
  const hasilDaftar = await jalankan(
    `INSERT INTO pengguna_baru (email, nama_pengguna, sandi_hash, sandi_salt, dibuat, terakhir)
     VALUES (?, 'Taut', REPEAT('a', 128), REPEAT('b', 32), NOW(), NOW())`,
    [emailTaut],
  )
  const idTaut = hasilDaftar?.insertId
  cek('akun penautan dibuat (prasyarat uji)', Boolean(idTaut), true)

  balasanProfil = { ok: true, status: 200, isi: { sub: `sub-taut-${Date.now()}`, email: emailTaut, email_verified: true } }
  const mulai4 = await ambil('/api/akun/google')
  const state4 = new URL(mulai4.lokasi).searchParams.get('state')
  await ambil(`/api/akun/google/callback?code=kode-taut&state=${state4}`, { headers: { cookie: mulai4.cookie } })

  const taut = await pilih(`SELECT google_id, sandi_hash FROM pengguna_baru WHERE id = ?`, [idTaut])
  cek('google_id DITautkan ke akun yang ada', Boolean(taut[0]?.google_id), true)
  cek('kata sandi lamanya TETAP ada', Boolean(taut[0]?.sandi_hash), true)

  const hitungTaut = await pilih(`SELECT COUNT(*) AS n FROM pengguna_baru WHERE email = ?`, [emailTaut])
  cek('tidak membuat akun duplikat', Number(hitungTaut[0]?.n), 1)

  /* ==================== 7. EMAIL BELUM DIVERIFIKASI -> DITOLAK ========== */

  console.log('\n=== EMAIL BELUM DIVERIFIKASI: tidak boleh menautkan ===')

  const emailBelum = `uji.belum.${Date.now()}@contoh.com`
  // PENTING: `ok: true` — jawaban Google sendiri BERHASIL (HTTP 200), yang
  // belum terverifikasi hanya emailnya. Kalau `ok` dibuat false, yang diuji
  // jadi jalur "Google gagal", bukan jalur "email belum diverifikasi".
  balasanProfil = { ok: true, status: 200, isi: { sub: `sub-belum-${Date.now()}`, email: emailBelum, email_verified: false } }
  const mulai5 = await ambil('/api/akun/google')
  const state5 = new URL(mulai5.lokasi).searchParams.get('state')
  const belum = await ambil(`/api/akun/google/callback?code=kode-belum&state=${state5}`, {
    headers: { cookie: mulai5.cookie },
  })

  cek('ditolak, bukan dibuatkan akun', /ps_sesi=/.test(belum.cookie), false)
  cek('pesannya menjelaskan sebabnya', /verifikasi/i.test(belum.teks), true)
  const hitungBelum = await pilih(`SELECT COUNT(*) AS n FROM pengguna_baru WHERE email = ?`, [emailBelum])
  cek('TIDAK ada akun yang dibuat', Number(hitungBelum[0]?.n), 0)

  /* ==================== 8. GOOGLE MENOLAK -> pesan aman ================= */

  console.log('\n=== GOOGLE MENOLAK pertukaran code ===')

  balasanToken = { ok: false, status: 400, isi: { error: 'invalid_grant' } }
  balasanProfil = { ok: true, status: 200, isi: { sub: 'x', email: null, email_verified: true } }
  const mulai6 = await ambil('/api/akun/google')
  const state6 = new URL(mulai6.lokasi).searchParams.get('state')
  const gagalTukar = await ambil(`/api/akun/google/callback?code=kode-basi&state=${state6}`, {
    headers: { cookie: mulai6.cookie },
  })

  cek('tidak ada sesi yang terbit', /ps_sesi=/.test(gagalTukar.cookie), false)
  cek('bukan halaman galat mentah', gagalTukar.status, 502)
  cek('detail Google (invalid_grant) TIDAK bocor ke pengguna', /invalid_grant/.test(gagalTukar.teks), false)

  balasanToken = { ok: true, status: 200, isi: { access_token: 'token-uji' } }

  /* ==================== 9. BERSIHKAN ==================================== */

  const hapus = await pilih(
    `SELECT id FROM pengguna_baru WHERE email LIKE 'uji.google.%@contoh.com' OR email LIKE 'uji.taut.%@contoh.com' OR email LIKE 'uji.belum.%@contoh.com'`,
  )
  for (const b of hapus) {
    await jalankan(`DELETE FROM sesi WHERE pengguna_id = ?`, [b.id])
    await jalankan(`DELETE FROM pengguna_baru WHERE id = ?`, [b.id])
  }
  console.log(`  (akun uji dibersihkan: ${hapus.length})`)
}

/* ============================================== 10. JEJAK DI FRONTEND ==== */

console.log('\n=== TOMBOL DI HALAMAN MASUK ===')

const halaman = await ambil('/app/')
const punyaTombol = /Masuk dengan Google|accounts\.google\.com/.test(halaman.teks)
console.log(`  /app/ memuat referensi Google: ${punyaTombol}`)
console.log('  (setelah `npm run build` dengan VITE_GOOGLE_CLIENT_ID terisi, tombolnya muncul — diperiksa manual di peramban)')

globalThis.fetch = fetchAsli
server.close()
await tutupDb()

console.log('\n=== RINGKASAN ===')
console.log(`lulus    : ${lulus}`)
console.log(`gagal    : ${gagal}`)
if (dilewati) console.log(`dilewati : ${dilewati} bagian`)
process.exit(gagal ? 1 : 0)
