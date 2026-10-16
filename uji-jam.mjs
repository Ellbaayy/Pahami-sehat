/**
 * Uji jam acuan (server/jam.js) — tanpa jaringan.
 *
 * KENAPA ADA: penjadwalan "sekali sehari" dulu memakai jam mesin. Jam mesin
 * bisa meleset, dan di serverless tiap instance bisa punya jam berbeda —
 * akibatnya pengecekan bisa dua kali sehari atau terlewat. Sekarang jam
 * diambil dari header `Date` respons HTTP yang sudah diambil.
 *
 * Yang diuji di sini adalah bagian yang TIDAK butuh jaringan: pembacaan header,
 * penolakan nilai rusak, cadangan ke jam mesin, dan pemajuan waktu.
 */

import { catatJamServer, jamSekarang, selisihJam, jamInternetTerbaca } from './app/server/jam.js'

let lulus = 0
let gagal = 0
const cek = (nama, syarat) => {
  if (syarat) {
    lulus += 1
    console.log('  ok    ' + nama)
  } else {
    gagal += 1
    console.log('  GAGAL ' + nama)
  }
}

/** Bikin objek mirip Respons dengan header tertentu. */
const res = (date) => ({ headers: { get: (n) => (n.toLowerCase() === 'date' ? date : null) } })

console.log('== sebelum ada respons: jatuh ke jam mesin ==')
cek('jamInternetTerbaca() false', jamInternetTerbaca() === false)
cek('selisihJam() 0', selisihJam() === 0)
cek('jamSekarang() ~ Date.now()', Math.abs(jamSekarang() - Date.now()) < 1000)

console.log('\n== header Date yang sah dibaca ==')
const sekarang = Date.now()
catatJamServer(res(new Date(sekarang).toUTCString()))
cek('jamInternetTerbaca() true', jamInternetTerbaca() === true)
cek('jamSekarang() dekat waktu header', Math.abs(jamSekarang() - sekarang) < 1500)
cek('selisihJam() masuk akal (<2s)', Math.abs(selisihJam()) < 2000)

console.log('\n== header tidak ada / kosong tidak mengubah apa pun ==')
const sebelum = jamSekarang()
catatJamServer(res(undefined))
catatJamServer({ headers: { get: () => null } })
catatJamServer({})
catatJamServer(null)
cek('jam tetap (tidak rusak)', Math.abs(jamSekarang() - sebelum) < 1500)

console.log('\n== header ngawur DITOLAK (tidak boleh merusak jadwal) ==')
const jangkar = jamSekarang()
for (const buruk of [
  'bukan tanggal',
  '',
  'Thu, 01 Jan 1970 00:00:00 GMT',
  'Tue, 01 Jan 1900 00:00:00 GMT',
  'Sat, 01 Jan 2200 00:00:00 GMT',
  'NaN',
]) {
  catatJamServer(res(buruk))
  cek(`tolak "${buruk.slice(0, 26)}"`, Math.abs(jamSekarang() - jangkar) < 1500)
}

console.log('\n== selisih jam yang besar tetap dilaporkan apa adanya ==')
const maju = Date.now() + 5 * 60 * 1000 // 5 menit lebih cepat
catatJamServer(res(new Date(maju).toUTCString()))
cek('selisihJam() ~ +300s', Math.abs(selisihJam() - 5 * 60 * 1000) < 2000)
cek('jamSekarang() ikut jam header', Math.abs(jamSekarang() - maju) < 2000)

console.log('\n== waktu MAJU setelah header (bukan beku) ==')
const t1 = jamSekarang()
await new Promise((r) => setTimeout(r, 60))
const t2 = jamSekarang()
cek('jamSekarang() maju sendiri', t2 > t1)
cek('kemajuannya wajar (<2s untuk 60ms tunggu)', t2 - t1 < 2000)

console.log(`\n${lulus} lulus, ${gagal} gagal`)
process.exit(gagal ? 1 : 0)
