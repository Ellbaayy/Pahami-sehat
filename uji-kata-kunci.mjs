#!/usr/bin/env node
/**
 * Uji pemilihan kata kunci pencarian.
 * Dijalankan: node uji-kata-kunci.mjs
 *
 * Yang diperiksa: pertanyaan asli dari laporan pengguna harus menghasilkan
 * bahan pencarian yang berupa ISTILAH KESEHATAN, bukan kata ganti orang.
 */
import {
  kataKunciPencarian,
  kataPenting,
  menyentuhKesehatan,
  ISTILAH_CARI,
  PETA_DAERAH,
} from './app/server/kataKunci.js'

let gagal = 0
function cek(nama, dapat, harus) {
  const ok = JSON.stringify(dapat) === JSON.stringify(harus)
  if (!ok) gagal++
  console.log(`${ok ? 'OK  ' : 'GAGAL'} ${nama}`)
  if (!ok) console.log(`      dapat: ${JSON.stringify(dapat)}\n      harus: ${JSON.stringify(harus)}`)
}

console.log('--- kata kunci: kasus asli yang dilaporkan ---')
cek(
  'gatal-gatal',
  kataKunciPencarian('saya menderita gatal-gatal, kira-kira apa yg sedang terjadi'),
  'gatal',
)
cek(
  'lemas -> kelelahan',
  kataKunciPencarian(
    'tolong jelaskan kepada saya apa yang sebenarnya sedang terjadi pada tubuh saya kalau saya sering merasa lemas',
  ),
  'kelelahan',
)
cek('sakit kepala (bukan "sakit")', kataKunciPencarian('kepala saya sakit kepala terus'), 'sakit kepala')
cek('sesak napas', kataKunciPencarian('kalau malam saya sesak napas'), 'sesak napas')
cek('pegal -> nyeri otot', kataKunciPencarian('badan saya pegal pegal'), 'nyeri otot')
cek('demam berdarah menang atas demam', kataKunciPencarian('apa gejala demam berdarah'), 'demam berdarah')
cek('radang tenggorokan -> faringitis', kataKunciPencarian('tenggorokan saya radang tenggorokan'), 'faringitis')

console.log('\n--- kata kunci: bahasa daerah ---')
cek('Jawa: gatel', kataKunciPencarian('aku krasa gatel tenan, piye iki'), 'gatal')
cek('Jawa: mumet', kataKunciPencarian('sirahku mumet'), 'pusing')
cek('Jawa: pegel', kataKunciPencarian('awakku pegel'), 'nyeri otot')
cek('Jawa: watuk', kataKunciPencarian('anakku watuk', ), 'batuk')
cek('Sunda: bareuh', kataKunciPencarian('suku kuring bareuh'), 'bengkak')
cek('Sunda: mencret', kataKunciPencarian('barudak mencret'), 'diare')
cek('daerah + kata ganti tetap bersih', kataKunciPencarian('aku krasa gatel'), 'gatal')

console.log('\n--- kata kunci: yang tidak boleh lagi terjadi ---')
const terlarang = ['saya', 'kepada', 'menderita', 'merasa', 'tolong', 'jelaskan', 'sedang', 'terjadi']
for (const t of terlarang) {
  const hasil = kataKunciPencarian('tolong jelaskan kepada saya apa yang sebenarnya sedang terjadi')
  cek(`tidak memuat "${t}"`, hasil.includes(t), false)
}

console.log('\n--- kata kunci: teks tanpa istilah kesehatan ---')
cek('pertanyaan umum', kataKunciPencarian('bagaimana cara membuat kue bolu'), 'membuat kue bolu')
cek('teks kosong', kataKunciPencarian(''), '')
cek('hanya kata ganti', kataKunciPencarian('tolong jelaskan kepada saya'), '')

console.log('\n--- kata penting (penyaring sumber) ---')
cek(
  'kata ganti terbuang',
  kataPenting('saya menderita gatal-gatal kira-kira apa yang sedang terjadi'),
  ['gatal', 'gatal', 'kira', 'kira'],
)
cek('kosong', kataPenting(''), [])

console.log('\n--- menyentuh kesehatan ---')
cek('makasih BUKAN kesehatan (jangan tertangkap "asi")', menyentuhKesehatan('makasih ya'), false)
cek('influenza BUKAN "flu"', menyentuhKesehatan('influenza'), true)
cek('lemas = kesehatan', menyentuhKesehatan('badan lemas'), true)
cek('obrolan biasa', menyentuhKesehatan('halo apa kabar'), false)

console.log('\n--- daftar istilah ---')
console.log(`jumlah istilah: ${ISTILAH_CARI.length}`)
cek('terurut dari terpanjang', ISTILAH_CARI.every((t, i) => i === 0 || ISTILAH_CARI[i - 1].length >= t.length), true)
cek(
  'semua hasil pemetaan daerah ada di daftar istilah',
  Object.values(PETA_DAERAH).every(
    (v) => ISTILAH_CARI.includes(v) || ISTILAH_CARI.some((t) => t.includes(v)),
  ),
  true,
)

console.log(gagal === 0 ? '\nSEMUA LULUS' : `\n${gagal} UJI GAGAL`)
process.exit(gagal === 0 ? 0 : 1)
