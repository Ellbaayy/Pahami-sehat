/**
 * Uji kamus dua bahasa: kelengkapan dan pemakaian.
 *
 * Menangkap tiga jenis cacat yang semuanya pernah terjadi di proyek ini:
 *   1. kunci dipakai di komponen tapi tidak ada di kamus -> tampil mentah
 *   2. kunci ada di `id` tapi tidak ada di `en`          -> sisa Indonesia
 *   3. kunci ada di kamus tapi tidak dipakai siapa pun   -> kode mati
 *
 * Jenis ke-3 yang paling mudah terlewat: dulu ada 22 kunci (beranda.*,
 * suara.*, kuis.*, riw.*) yang sudah disiapkan tapi tidak pernah dipakai,
 * sehingga empat panel tetap berbahasa Indonesia walau antarmukanya Inggris.
 *
 * Jalankan:  node uji-bahasa.mjs
 */

import { readFileSync, readdirSync, statSync } from 'node:fs'
import { join } from 'node:path'
import { kamus, buatT } from './app/src/data/bahasa.js'

let lulus = 0
let gagal = 0
const cek = (nama, syarat, rinci = '') => {
  if (syarat) {
    lulus++
    console.log(`  ok    ${nama}`)
  } else {
    gagal++
    console.log(`  GAGAL ${nama}${rinci ? `\n        ${rinci}` : ''}`)
  }
}

const id = kamus('id')
const en = kamus('en')

function berkasSumber(dir, keluar = []) {
  for (const n of readdirSync(dir)) {
    const p = join(dir, n)
    if (statSync(p).isDirectory()) berkasSumber(p, keluar)
    else if (/\.(jsx|js)$/.test(p)) keluar.push(p)
  }
  return keluar
}

/* ---------------------------------------------- 1. kunci dipakai ada di kamus */
console.log('\nkunci yang dipakai komponen')
const hilang = new Set()
const dipakai = new Set()
for (const f of berkasSumber('app/src')) {
  if (f.endsWith('data/bahasa.js')) continue
  const t = readFileSync(f, 'utf8')
  for (const m of t.matchAll(/\bt\(\s*'([a-zA-Z]+\.[A-Za-z0-9_]+)'/g)) dipakai.add(m[1])
  for (const m of t.matchAll(/\bt\(\s*`([a-zA-Z]+\.[A-Za-z0-9_]+)`/g)) dipakai.add(m[1])
  // t(`tingkat.${kunci}`) -> catat prefiksnya sebagai "dipakai secara dinamis"
  for (const m of t.matchAll(/\bt\(\s*`([a-zA-Z]+)\.\$\{/g)) dipakai.add(`${m[1]}.*`)
}
for (const k of dipakai) {
  if (k.endsWith('.*')) continue
  if (!(k in id)) hilang.add(k)
}
cek('setiap kunci yang dipakai ada di kamus id', hilang.size === 0, [...hilang].join(', '))
cek('setiap kunci yang dipakai ada di kamus en', [...dipakai].every((k) => k.endsWith('.*') || k in en))

/* --------------------------------------------------- 2. kelengkapan id vs en */
console.log('\nkelengkapan dua bahasa')
const hanyaId = Object.keys(id).filter((k) => !(k in en))
const hanyaEn = Object.keys(en).filter((k) => !(k in id))
cek('tidak ada kunci yang hanya ada di id', hanyaId.length === 0, hanyaId.join(', '))
cek('tidak ada kunci yang hanya ada di en', hanyaEn.length === 0, hanyaEn.join(', '))

/* ------------------------------------------------------ 3. kunci tidak terpakai */
console.log('\nkunci yang tidak dipakai siapa pun (kode mati)')

/**
 * Deteksi "dipakai" tidak bisa hanya melihat pola `t('kunci')`.
 *
 * Banyak kunci diteruskan lewat VARIABEL, bukan literal:
 *   - Sidebar:  t(kunci)  dengan kunci dari NAV_ITEMS
 *   - Settings: labelTingkat(t.kunci) -> t(`tingkat.${kunci}`)
 *   - ScanPanel: t(p.kunci) dari pesanProgres()
 * Percobaan pertama memakai pola literal saja dan melaporkan 41 kunci
 * "menganggur" — hampir semuanya positif palsu. Karena itu kunci dianggap
 * dipakai kalau STRING-nya muncul di berkas sumber mana pun, atau kalau
 * prefiksnya dipakai secara dinamis.
 */
const teksSemua = berkasSumber('app/src')
  .filter((f) => !f.endsWith('data/bahasa.js'))
  .map((f) => readFileSync(f, 'utf8'))
  .join('\n')

const dinamis = [...dipakai].filter((k) => k.endsWith('.*')).map((k) => k.slice(0, -2))
const takDipakai = Object.keys(id).filter((k) => {
  if (dipakai.has(k)) return false
  if (dinamis.includes(k.split('.')[0])) return false
  return !teksSemua.includes(`'${k}'`) && !teksSemua.includes(`"${k}"`)
})
cek('tidak ada kunci kamus yang menganggur', takDipakai.length === 0, takDipakai.join(', '))

/* ------------------------------------------------------- 4. pengganti {n} */
console.log('\npengganti nilai')
const tId = buatT('id')
const tEn = buatT('en')
cek(
  'pengganti {n} bekerja di id',
  tId('kuis.belumDijawab', { n: 3 }) === 'Masih ada 3 pernyataan yang belum dijawab.',
  tId('kuis.belumDijawab', { n: 3 }),
)
cek(
  'pengganti {n} bekerja di en',
  tEn('kuis.belumDijawab', { n: 3 }) === '3 statements are still unanswered.',
  tEn('kuis.belumDijawab', { n: 3 }),
)
cek(
  'dua nilai sekaligus',
  tId('kuis.terjawabDari', { a: 2, b: 5 }) === '2 dari 5 terjawab',
  tId('kuis.terjawabDari', { a: 2, b: 5 }),
)
cek(
  'nilai yang tidak diberikan dibiarkan apa adanya',
  tId('kuis.terjawabDari', { a: 2 }).includes('{b}'),
)
cek('tanpa argumen nilai tetap utuh', tId('kuis.terjawabDari').includes('{a}'))
cek('kunci tak dikenal dikembalikan apa adanya', tId('tidak.ada') === 'tidak.ada')

/* --------------------------------------------------- 5. kunci wajib ada */
console.log('\nkunci penting (dipakai fitur inti)')
for (const k of [
  'nav.beranda', 'nav.pindai', 'beranda.sapa', 'suara.judul', 'suara.tekan',
  'riw.terakhir', 'kuis.judul', 'kuis.lihat', 'tips.label', 'art.judul',
  'topik.judul', 'pindai.judul', 'pindai.tegasJudul', 'umum.kodeLokal',
]) {
  cek(`ada di id & en: ${k}`, k in id && k in en)
}

console.log(`\n${lulus} lulus, ${gagal} gagal\n`)
process.exit(gagal ? 1 : 0)
