/**
 * Uji statistik fasilitas nasional (server/statistikFaskes.js) — tanpa jaringan.
 *
 * KENAPA ADA: angka 49.548 gampang dikutip sebagai "jumlah seluruh faskes
 * Indonesia" padahal artinya lain — hanya fasilitas yang sudah
 * mengimplementasikan sistem data dan aplikasi kesehatan. Kesalahan seperti
 * itu tidak akan memunculkan galat apa pun: aplikasi tetap jalan, angkanya
 * tetap tampil, hanya maknanya yang salah.
 *
 * Uji ini menjaga tiga hal yang tidak boleh melenceng:
 *   1. angka tiap kategori dan jumlahnya (49.548),
 *   2. kalimat cakupan yang menempel pada angkanya,
 *   3. kaitan kategori ke `kategori_fasilitas` yang benar-benar ada.
 */

import {
  STATISTIK_KEMENKES,
  STATISTIK_BPJS,
  SUMBER_DATA,
  CAKUPAN_KEMENKES,
  CAKUPAN_BPJS,
  totalKemenkes,
  cariStatistik,
  ringkasanStatistik,
} from './app/server/statistikFaskes.js'
import { daftarKategori } from './app/server/faskes.js'

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

console.log('== angka Kemenkes 2024 ==')
const harapan = new Map([
  ['Rumah sakit', 3681],
  ['Puskesmas', 11542],
  ['Laboratorium kesehatan', 602],
  ['Klinik', 18590],
  ['Praktik mandiri', 15060],
  ['Unit transfusi darah', 73],
])
cek('jumlah kategori 6', STATISTIK_KEMENKES.length === 6)
for (const b of STATISTIK_KEMENKES) {
  cek(`${b.jenis} = ${harapan.get(b.jenis) ?? '(tidak dikenal)'}`, b.jumlah === harapan.get(b.jenis))
}
cek('tidak ada kategori asing', STATISTIK_KEMENKES.every((b) => harapan.has(b.jenis)))
cek('total 49.548', totalKemenkes() === 49548)
cek('total sama dengan penjumlahan manual', 3681 + 11542 + 602 + 18590 + 15060 + 73 === 49548)

console.log('\n== angka BPJS September 2026 (pembanding) ==')
const bpjs = new Map(STATISTIK_BPJS.map((b) => [b.jenis, b.jumlah]))
cek('FKTP 23.862', bpjs.get('FKTP') === 23862)
cek('RS/Klinik Utama 3.221', bpjs.get('RS/Klinik Utama') === 3221)
cek('Apotek/Optik 6.631', bpjs.get('Apotek/Optik') === 6631)

console.log('\n== cakupan ikut pada setiap angka ==')
cek('cakupan Kemenkes menyebut "bukan jumlah seluruh"', CAKUPAN_KEMENKES.includes('bukan jumlah seluruh'))
cek('cakupan Kemenkes menyebut sistem data', CAKUPAN_KEMENKES.includes('sistem data'))
cek('cakupan BPJS menyebut "pembanding"', CAKUPAN_BPJS.includes('pembanding'))
cek('ringkasan menempelkan cakupan Kemenkes', ringkasanStatistik().kemenkes.cakupan === CAKUPAN_KEMENKES)
cek('ringkasan menempelkan cakupan BPJS', ringkasanStatistik().bpjs.cakupan === CAKUPAN_BPJS)

console.log('\n== kaitan ke kategori peta ==')
const kodeSah = new Set(daftarKategori().map((k) => k.id))
for (const b of STATISTIK_KEMENKES) {
  if (b.kodeKategori === null) continue
  cek(`kode kategori "${b.kodeKategori}" ada di daftarKategori()`, kodeSah.has(b.kodeKategori))
}
cek('unit transfusi darah tidak dipaksa punya kategori', STATISTIK_KEMENKES.find((b) => b.jenis === 'Unit transfusi darah')?.kodeKategori === null)

console.log('\n== pencarian ==')
cek('cari "puskes" menemukan Puskesmas', cariStatistik('puskes').some((b) => b.jenis === 'Puskesmas'))
cek('cari "klinik" menemukan Klinik', cariStatistik('klinik').some((b) => b.jenis === 'Klinik'))
cek('cari "bpjs" menemukan tiga baris BPJS', cariStatistik('bpjs').length === 3)
cek('cari kosong mengembalikan kosong', cariStatistik('').length === 0)
cek('cari "tidak-ada-ini" kosong', cariStatistik('tidak-ada-ini').length === 0)
cek('hasil cari membawa lembaga dan periode', cariStatistik('fktp')[0]?.lembaga === 'BPJS Kesehatan' && cariStatistik('fktp')[0]?.periode === 'September 2026')

console.log('\n== bentuk ringkasan untuk endpoint ==')
const r = ringkasanStatistik()
cek('kemenkes.total 49.548', r.kemenkes.total === 49548)
cek('bpjs.total 33.714', r.bpjs.total === 23862 + 3221 + 6631)
cek('sumberData berisi 4 rujukan', SUMBER_DATA.length === 4)
cek('sumberData menyebut Profil Kesehatan Indonesia 2025', SUMBER_DATA.some((s) => s.nama.includes('Profil Kesehatan Indonesia 2025')))
cek('sumberData menyebut BPS', SUMBER_DATA.some((s) => s.penerbit === 'BPS'))
cek('sumberData menyebut SATUSEHAT', SUMBER_DATA.some((s) => s.nama.includes('SATUSEHAT')))
cek('sumberData menyebut BPJS Kesehatan', SUMBER_DATA.some((s) => s.penerbit === 'BPJS Kesehatan'))
cek('setiap rujukan menyebut data yang tersedia', SUMBER_DATA.every((s) => typeof s.data === 'string' && s.data.length > 5))
cek('tautan sumber tidak dikarang (null)', SUMBER_DATA.every((s) => s.tautan === undefined || s.tautan === null))

console.log('')
console.log(gagal === 0 ? `SEMUA LULUS — ${lulus} pemeriksaan` : `GAGAL — ${lulus} lulus, ${gagal} gagal`)
process.exit(gagal === 0 ? 0 : 1)
