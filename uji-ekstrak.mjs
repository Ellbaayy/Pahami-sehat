/**
 * Uji pengekstrak JSON streaming: apakah escape \n dan \t ikut terbawa?
 *
 * Ini penting untuk jawaban AI: jawaban sering memuat baris baru (daftar
 * bernomor, pemisah bagian). Kalau \n hilang, seluruh jawaban jadi satu
 * paragraf panjang di UI.
 */
import { buatEkstrak } from './app/server/ekstrak.js'

let gagal = 0
function cek(nama, dapat, harus) {
  const ok = dapat === harus
  if (!ok) gagal++
  console.log(`${ok ? 'OK  ' : 'GAGAL'} ${nama}`)
  if (!ok) console.log(`      dapat: ${JSON.stringify(dapat)}\n      harus: ${JSON.stringify(harus)}`)
}

/** Jalankan JSON lewat pengekstrak, potong-potong seperti stream. */
function lewatStream(json, ukuranPotong = 7) {
  const e = buatEkstrak('jawaban')
  let keluar = ''
  for (let i = 0; i < json.length; i += ukuranPotong) {
    keluar += e.dorong(json.slice(i, i + ukuranPotong))
  }
  return keluar
}

console.log('--- escape dasar ---')
const j1 = JSON.stringify({ jawaban: 'Baris satu.\nBaris dua.' })
cek('\\n jadi baris baru', lewatStream(j1), 'Baris satu.\nBaris dua.')

const j2 = JSON.stringify({ jawaban: 'a\tb' })
cek('\\t jadi tab', lewatStream(j2), 'a\tb')

const j3 = JSON.stringify({ jawaban: 'kata "kutip" di dalam' })
cek('\\" jadi kutip', lewatStream(j3), 'kata "kutip" di dalam')

const j4 = JSON.stringify({ jawaban: 'garis miring \\ ini' })
cek('\\\\ jadi backslash', lewatStream(j4), 'garis miring \\ ini')

const j5 = JSON.stringify({ jawaban: 'emoji 😀 dan é' })
cek('unicode langsung', lewatStream(j5), 'emoji 😀 dan é')

const j6 = JSON.stringify({ jawaban: 'tanda é di-escape' }).replace('é', '\\u00e9')
cek('\\u00e9 jadi é', lewatStream(j6), 'tanda é di-escape')

console.log('\n--- jawaban bertingkat (kasus nyata) ---')
const jawaban = 'Langkah pencegahan:\n1. Cuci tangan.\n2. Pakai masker.\n\nCatatan: bukan diagnosis.'
const j7 = JSON.stringify({ jawaban, poin_kunci: ['a', 'b'], catatan: '' })
cek('jawaban daftar bernomor utuh', lewatStream(j7), jawaban)

console.log('\n--- potongan sangat kecil (1 karakter) ---')
cek('potong 1 karakter', lewatStream(j7, 1), jawaban)

console.log(gagal === 0 ? '\nSEMUA LULUS' : `\n${gagal} UJI GAGAL`)
process.exit(gagal === 0 ? 0 : 1)
