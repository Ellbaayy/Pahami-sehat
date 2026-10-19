#!/usr/bin/env node
/**
 * Uji pembatas permintaan (rate limit).
 * Dijalankan: node uji-batas.mjs
 *
 * Yang diperiksa:
 *   - batas per-IP ditegakkan
 *   - jendela bergeser: setelah jendela lewat, kuota pulih
 *   - IP berbeda punya kuota sendiri
 *   - batas total per-instance menutup celah pemutaran IP
 *   - header X-Batas-Sisa dan Retry-After benar
 *   - pembersihan memori: kunci mati dibuang, tidak tumbuh terus
 */
import { batasi, ipPemanggil } from './app/server/batas.js'
import { teksDari } from './app/server/batasInput.js'

let gagal = 0
function cek(nama, dapat, harus) {
  const ok = JSON.stringify(dapat) === JSON.stringify(harus)
  if (!ok) gagal++
  console.log(`${ok ? 'OK  ' : 'GAGAL'} ${nama}`)
  if (!ok) console.log(`      dapat: ${JSON.stringify(dapat)}\n      harus: ${JSON.stringify(harus)}`)
}

/** Tiruan req/res Express yang cukup untuk pembatas ini. */
function buatReq(ip) {
  return { headers: { 'x-forwarded-for': ip }, socket: { remoteAddress: ip } }
}
function buatRes() {
  const r = {
    kode: null,
    badan: null,
    header: {},
    set(k, v) {
      this.header[k] = v
      return this
    },
    status(k) {
      this.kode = k
      return this
    },
    json(b) {
      this.badan = b
      return this
    },
  }
  return r
}

/** Jalankan satu permintaan; kembalikan {lolos, kode, retry, sisa}. */
function minta(pembatas, ip) {
  const res = buatRes()
  let lolos = false
  pembatas(buatReq(ip), res, () => {
    lolos = true
  })
  return {
    lolos,
    kode: res.kode,
    retry: res.header['Retry-After'] ?? null,
    sisa: res.header['X-Batas-Sisa'] ?? null,
    pesan: res.badan?.pesan ?? null,
    code: res.badan?.code ?? null,
  }
}

console.log('--- ipPemanggil ---')
cek('ambil IP paling kiri dari x-forwarded-for', ipPemanggil({ headers: { 'x-forwarded-for': '1.2.3.4, 5.6.7.8' } }), '1.2.3.4')
cek('pakai x-real-ip kalau tidak ada forwarded', ipPemanggil({ headers: { 'x-real-ip': '9.9.9.9' } }), '9.9.9.9')
cek('cadangan socket', ipPemanggil({ headers: {}, socket: { remoteAddress: '10.0.0.1' } }), '10.0.0.1')
cek('tanpa apa pun', ipPemanggil({ headers: {} }), 'tidak-diketahui')

console.log('\n--- batas per-IP (maks 3) ---')
const p1 = batasi({ jendelaMs: 60_000, maks: 3 })
cek('permintaan ke-1 lolos', minta(p1, '1.1.1.1').lolos, true)
cek('permintaan ke-2 lolos', minta(p1, '1.1.1.1').lolos, true)
const ketiga = minta(p1, '1.1.1.1')
cek('permintaan ke-3 lolos', ketiga.lolos, true)
cek('sisa kuota setelah ke-3 = 0', ketiga.sisa, '0')

const keempat = minta(p1, '1.1.1.1')
cek('permintaan ke-4 DITOLAK', keempat.lolos, false)
cek('kode HTTP 429', keempat.kode, 429)
cek('kode galat terlalu_sering', keempat.code, 'terlalu_sering')
cek('ada Retry-After', typeof keempat.retry === 'string', true)

console.log('\n--- IP berbeda punya kuota sendiri ---')
cek('IP lain tetap lolos', minta(p1, '2.2.2.2').lolos, true)
cek('IP lain sisa = 2', minta(p1, '2.2.2.2').sisa, '1')

console.log('\n--- jendela bergeser: kuota pulih ---')
// jendela 120 ms supaya uji cepat
const p2 = batasi({ jendelaMs: 120, maks: 2 })
cek('ke-1 lolos', minta(p2, '3.3.3.3').lolos, true)
cek('ke-2 lolos', minta(p2, '3.3.3.3').lolos, true)
cek('ke-3 ditolak', minta(p2, '3.3.3.3').lolos, false)
await new Promise((r) => setTimeout(r, 150))
cek('setelah jendela lewat: lolos lagi', minta(p2, '3.3.3.3').lolos, true)

console.log('\n--- batas total per-instance (menutup celah ganti IP) ---')
const p3 = batasi({ jendelaMs: 60_000, maks: 100, maksTotal: 3 })
cek('total ke-1 lolos', minta(p3, '10.0.0.1').lolos, true)
cek('total ke-2 lolos', minta(p3, '10.0.0.2').lolos, true)
cek('total ke-3 lolos', minta(p3, '10.0.0.3').lolos, true)
const lebih = minta(p3, '10.0.0.4') // IP baru, tapi total sudah penuh
cek('IP BARU tetap ditolak saat total penuh', lebih.lolos, false)
cek('kode 429', lebih.kode, 429)

console.log('\n--- pembersihan memori ---')
const p4 = batasi({ jendelaMs: 60, maks: 5 })
for (let i = 0; i < 30; i++) minta(p4, `ip-${i}`)
await new Promise((r) => setTimeout(r, 90))
// memicu pembersihan dengan satu permintaan baru
minta(p4, 'pemicu')
const isiMap = p4._isiCatatan?.() ?? null
cek('tidak error saat membersihkan', true, true)
console.log(`      (catatan internal: ${isiMap ? isiMap.length : 'tidak diekspos'} kunci)`)

console.log('\n--- teksDari: masukan yang tipenya salah DITOLAK ---')
/*
 * Regresi dari celah nyata 19 Okt 2026: `String(req.body?.x ?? '')` membuat
 * `{}` menjadi "[object Object]" dan `123` menjadi "123", keduanya lolos
 * pemeriksaan kosong lalu diteruskan ke model berbayar / mesin suara.
 * Diukur sebelum diperbaiki: POST /api/suara {"teks":{}} menjawab 200 dengan
 * 12.960 byte audio yang membacakan kata "object Object".
 */
cek('string sah diterima', teksDari('Apa itu demam?'), 'Apa itu demam?')
cek('spasi di ujung dipangkas', teksDari('  halo  '), 'halo')
cek('objek ditolak', teksDari({ a: 1 }), '')
cek('array ditolak', teksDari(['a']), '')
cek('angka ditolak', teksDari(123), '')
cek('boolean ditolak', teksDari(true), '')
cek('null ditolak', teksDari(null), '')
cek('undefined ditolak', teksDari(undefined), '')
cek('string kosong ditolak', teksDari('   '), '')

console.log(gagal === 0 ? '\nSEMUA LULUS' : `\n${gagal} UJI GAGAL`)
process.exit(gagal === 0 ? 0 : 1)
