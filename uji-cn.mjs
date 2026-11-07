/**
 * Uji penggabung kelas (src/lib/cn.js) — tanpa jaringan.
 *
 * KENAPA ADA: `cn('p-4', 'p-2')` dulu menghasilkan DUA kelas, dan yang menang
 * ditentukan urutan di CSS, bukan urutan pemanggilan. Akibatnya kelas yang
 * sengaja ditimpa lewat prop `className` kadang tidak berpengaruh — bug
 * tampilan yang tidak bisa diprediksi dari kodenya.
 */

import { cn } from './app/src/lib/cn.js'

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

cek('kelas dasar tetap', cn('p-4', 'bg-white') === 'p-4 bg-white')
cek('kelas bentrok: yang terakhir menang', cn('p-4', 'p-2') === 'p-2')
cek('kelas bentrok di tengah', cn('px-2', 'px-6') === 'px-6')
cek('nilai kosong dibuang', cn('p-4', null, undefined, false, '') === 'p-4')
cek('array disatukan', cn(['a']) === 'a')
cek('varian berbeda tidak saling menghapus', cn('md:p-4', 'p-2') === 'md:p-4 p-2')
cek('warna merek: terakhir menang', cn('text-navy-900', 'text-brand-700') === 'text-brand-700')
cek('tanpa argumen', cn() === '')

console.log('')
console.log(gagal === 0 ? `SEMUA LULUS — ${lulus} pemeriksaan` : `GAGAL — ${lulus} lulus, ${gagal} gagal`)
process.exit(gagal === 0 ? 0 : 1)
