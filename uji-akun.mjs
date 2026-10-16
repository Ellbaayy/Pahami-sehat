#!/usr/bin/env node
/**
 * uji-akun.mjs — uji akun: daftar, masuk, sesi, nama panggilan, keamanan.
 *
 * KENAPA SKRIP INI ADA
 * Fitur akun menyimpan kata sandi. Kesalahan di sini tidak seperti kesalahan
 * tampilan — kalau kata sandi tersimpan apa adanya, atau pesan galatnya
 * membocorkan alamat mana yang terdaftar, akibatnya tidak bisa ditarik lagi.
 * Jadi bagian yang paling penting diuji di sini bukan "apakah bisa masuk",
 * melainkan:
 *
 *   - kata sandi TIDAK PERNAH tersimpan apa adanya
 *   - dua kata sandi berbeda menghasilkan hash berbeda (salt bekerja)
 *   - pesan galat masuk TIDAK membedakan "akun tidak ada" dari "sandi salah"
 *   - token sesi disimpan sebagai hash, bukan aslinya
 *   - normalisasi email/telepon konsisten (satu orang = satu akun)
 *
 * DUA BAGIAN, dan bedanya penting:
 *   1. MURNI — tanpa jaringan & tanpa database. Menguji aturan yang bisa
 *      diperiksa dari kode saja (normalisasi, kekuatan sandi, hash).
 *   2. TERHUBUNG — butuh MariaDB. DILEWATI dengan pesan jelas kalau database
 *      mati, bukan gagal — karena bagian akun memang butuh database, dan CI
 *      tidak boleh merah hanya karena itu.
 *
 * Cara pakai:
 *   node uji-akun.mjs
 */

import {
  hashSandi,
  periksaSandi,
  periksaKekuatan,
  normalkanEmail,
  normalkanTelepon,
  normalkanNama,
  emailMasukAkal,
  hashToken,
  buatToken,
  daftar,
  masuk,
  buatSesi,
  penggunaDariToken,
  hapusSesi,
  simpanNamaPengguna,
  identifierTerpakai,
  AkunError,
} from './app/server/akun.js'
import { dbSiap, tanya, tutupDb } from './app/server/db.js'

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

/** Pastikan sebuah fungsi MELEMPAR galat dengan kode tertentu. */
async function cekTolak(nama, fn, kodeHarap) {
  try {
    await fn()
    gagal++
    console.log(`  GAGAL ${nama} — seharusnya ditolak, tapi lolos`)
  } catch (e) {
    const ok = e instanceof AkunError && (!kodeHarap || e.kode === kodeHarap)
    if (ok) {
      lulus++
      console.log(`  ok    ${nama} (${e.kode})`)
    } else {
      gagal++
      console.log(`  GAGAL ${nama} — kode: ${e?.kode ?? e?.message}, harap: ${kodeHarap}`)
    }
  }
}

/* ===================================================== BAGIAN 1: MURNI === */

console.log('\n=== NORMALISASI: satu orang harus jadi satu akun ===')

cek('email huruf besar -> kecil', normalkanEmail('Budi@Mail.COM'), 'budi@mail.com')
cek('email dengan spasi dibersihkan', normalkanEmail('  budi@mail.com  '), 'budi@mail.com')
// Ini pernah salah: tanpa syarat '@', nomor telepon ikut dianggap email dan
// pendaftaran lewat telepon gagal dengan pesan yang membingungkan.
cek('nomor telepon BUKAN email', normalkanEmail('+62 812-3456-7890'), null)
cek('tanpa @ bukan email', normalkanEmail('budimail.com'), null)
cek('kosong -> null', normalkanEmail(''), null)

cek('+62 -> 0', normalkanTelepon('+6281234567890'), '081234567890')
cek('62 -> 0', normalkanTelepon('6281234567890'), '081234567890')
cek('spasi & tanda hubung dibuang', normalkanTelepon('0812-3456-7890'), '081234567890')
cek('sudah 0 tetap 0', normalkanTelepon('081234567890'), '081234567890')
cek('terlalu pendek ditolak', normalkanTelepon('0812'), null)
cek('huruf ditolak', normalkanTelepon('bukan-nomor'), null)

cek('nama dirapikan spasinya', normalkanNama('  Bayu   Pratama  '), 'Bayu Pratama')
cek('nama dipotong 40 karakter', normalkanNama('x'.repeat(60)).length, 40)
cek('nama kosong -> null', normalkanNama('   '), null)

cek('email wajar diterima', emailMasukAkal('budi@mail.com'), true)
cek('email tanpa titik ditolak', emailMasukAkal('budi@mail'), false)
cek('email tanpa @ ditolak', emailMasukAkal('budimail.com'), false)

console.log('\n=== KEKUATAN KATA SANDI ===')
cek('7 karakter ditolak', periksaKekuatan('1234567').ok, false)
cek('8 karakter diterima', periksaKekuatan('12345678').ok, true)
cek('kosong ditolak', periksaKekuatan('').ok, false)
cek('terlalu panjang ditolak', periksaKekuatan('x'.repeat(300)).ok, false)

console.log('\n=== HASH KATA SANDI — bagian paling penting ===')

const h1 = await hashSandi('rahasia123')
cek('hash panjang 128 hex (64 byte)', h1.hash.length, 128)
cek('salt panjang 32 hex (16 byte)', h1.salt.length, 32)
cek('hash BUKAN kata sandinya', h1.hash.includes('rahasia123'), false)
cek('salt BUKAN kata sandinya', h1.salt.includes('rahasia123'), false)

// Dua hash untuk kata sandi yang SAMA harus BERBEDA — inilah gunanya salt.
// Tanpa salt, dua pengguna dengan sandi sama akan punya hash sama, dan satu
// tabel tebakan bisa membuka keduanya sekaligus.
const h2 = await hashSandi('rahasia123')
cek('sandi sama -> hash BEDA (salt bekerja)', h1.hash === h2.hash, false)
cek('sandi sama -> salt BEDA', h1.salt === h2.salt, false)

cek('sandi benar diterima', await periksaSandi('rahasia123', h1.hash, h1.salt), true)
cek('sandi salah ditolak', await periksaSandi('rahasia124', h1.hash, h1.salt), false)
cek('hash kosong ditolak', await periksaSandi('rahasia123', null, null), false)

console.log('\n=== TOKEN SESI ===')
const tk = buatToken()
cek('token 64 karakter hex', tk.length, 64)
cek('dua token berbeda', buatToken() === buatToken(), false)
cek('hash token 64 hex', hashToken(tk).length, 64)
cek('hash token BUKAN tokennya', hashToken(tk) === tk, false)
cek('hash konsisten', hashToken(tk) === hashToken(tk), true)

/* ================================================ BAGIAN 2: TERHUBUNG === */

const siap = await dbSiap()
console.log(`\n=== database: ${siap ? 'TERSAMBUNG' : 'TIDAK TERSAMBUNG'} ===`)

if (!siap) {
  dilewati++
  console.log('  (uji terhubung DILEWATI — fitur akun memang butuh database)')
  console.log('  Nyalakan: sudo /opt/lampp/lampp startmysql')
} else {
  console.log('\n=== DAFTAR & MASUK (lewat fungsi, bukan HTTP) ===')

  const cap = `uji${Date.now()}`
  const email = `${cap}@uji-contoh.com`

  // --- daftar
  const u = await daftar({ identifier: email, sandi: 'rahasia123' })
  cek('daftar mengembalikan id', typeof u.id === 'number' && u.id > 0, true)
  cek('email tersimpan ternormalisasi', u.email, email)
  cek('nama masih kosong', u.namaPengguna, null)

  // --- kata sandi di database TIDAK boleh apa adanya
  const baris = await tanya('SELECT sandi_hash, sandi_salt FROM pengguna_baru WHERE id = ?', [u.id])
  cek('hash tersimpan 128 hex', baris?.[0]?.sandi_hash?.length, 128)
  cek('hash BUKAN sandi aslinya', baris?.[0]?.sandi_hash === 'rahasia123', false)
  cek('sandi asli TIDAK ada di kolom mana pun', JSON.stringify(baris?.[0] ?? {}).includes('rahasia123'), false)

  // --- daftar dua kali harus ditolak
  await cekTolak('daftar email sama ditolak', () => daftar({ identifier: email, sandi: 'lain12345' }), 'sudah_ada')
  await cekTolak('sandi terlalu pendek ditolak', () => daftar({ identifier: `x${cap}@uji.com`, sandi: 'pendek' }), 'sandi_lemah')
  await cekTolak('email bentuk salah ditolak', () => daftar({ identifier: 'bukan-email', sandi: 'rahasia123' }), 'identifier_tidak_sah')

  cek('identifier terpakai terdeteksi', await identifierTerpakai(email), true)
  cek('identifier belum terpakai terdeteksi', await identifierTerpakai(`${cap}-lain@uji.com`), false)

  // --- masuk
  const m = await masuk({ identifier: email, sandi: 'rahasia123' })
  cek('masuk dengan sandi benar', m.id, u.id)

  // --- pesan galat TIDAK boleh membedakan kedua kasus ini
  let pesanSandiSalah = ''
  let pesanAkunTidakAda = ''
  try {
    await masuk({ identifier: email, sandi: 'salahsekali' })
  } catch (e) {
    pesanSandiSalah = e.message
  }
  try {
    await masuk({ identifier: `tidakada-${cap}@uji.com`, sandi: 'salahsekali' })
  } catch (e) {
    pesanAkunTidakAda = e.message
  }
  cek('pesan galat IDENTIK untuk sandi salah & akun tidak ada', pesanSandiSalah === pesanAkunTidakAda, true)
  cek('pesan tidak menyebut kata "tidak terdaftar"', /tidak terdaftar|not found/i.test(pesanSandiSalah), false)

  // --- sesi
  const s = await buatSesi(u.id, 'uji')
  cek('token sesi 64 hex', s.token.length, 64)

  const sBaris = await tanya('SELECT token_hash FROM sesi WHERE pengguna_id = ? ORDER BY id DESC LIMIT 1', [u.id])
  cek('token disimpan sebagai HASH', sBaris?.[0]?.token_hash === s.token, false)
  cek('hash token cocok', sBaris?.[0]?.token_hash, hashToken(s.token))

  const dariToken = await penggunaDariToken(s.token)
  cek('token sah -> pengguna ditemukan', dariToken?.id, u.id)
  cek('token ngawur -> null', await penggunaDariToken('token-palsu'), null)
  cek('token kosong -> null', await penggunaDariToken(''), null)

  // --- beberapa sesi untuk satu akun (HP + laptop)
  const s2 = await buatSesi(u.id, 'uji-2')
  cek('dua sesi berbeda tokennya', s.token === s2.token, false)
  cek('keduanya sah', (await penggunaDariToken(s.token))?.id, u.id)
  cek('yang kedua juga sah', (await penggunaDariToken(s2.token))?.id, u.id)

  // --- keluar hanya menghapus SATU sesi
  await hapusSesi(s.token)
  cek('sesi yang dihapus tidak berlaku', await penggunaDariToken(s.token), null)
  cek('sesi lain tetap berlaku', (await penggunaDariToken(s2.token))?.id, u.id)

  // --- nama panggilan
  const berNama = await simpanNamaPengguna(u.id, '  Bayu  ')
  cek('nama panggilan tersimpan', berNama.namaPengguna, 'Bayu')
  await cekTolak('nama kosong ditolak', () => simpanNamaPengguna(u.id, '   '), 'nama_kosong')
  await cekTolak('nama 1 karakter ditolak', () => simpanNamaPengguna(u.id, 'B'), 'nama_pendek')
  await cekTolak('nama dengan simbol aneh ditolak', () => simpanNamaPengguna(u.id, '<script>x</script>'), 'nama_tidak_sah')

  // --- telepon: format berbeda harus dianggap akun yang SAMA
  const telp = `08${String(Date.now()).slice(-10)}`
  const ut = await daftar({ identifier: telp, sandi: 'rahasia123' })
  const mt = await masuk({ identifier: `+62${telp.slice(1)}`, sandi: 'rahasia123' })
  cek('telepon format lain -> akun sama', mt.id, ut.id)

  // --- bersihkan
  await tanya('DELETE FROM sesi WHERE pengguna_id IN (?, ?)', [u.id, ut.id])
  await tanya('DELETE FROM pengguna_baru WHERE id IN (?, ?)', [u.id, ut.id])
  console.log('  (akun uji dibersihkan)')
}

await tutupDb()

console.log('\n=== RINGKASAN ===')
console.log(`lulus    : ${lulus}`)
console.log(`gagal    : ${gagal}`)
if (dilewati) console.log(`dilewati : ${dilewati} bagian (database tidak tersambung)`)
process.exit(gagal ? 1 : 0)
