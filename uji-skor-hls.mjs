/**
 * Uji skor HLS-SF12: rumus indeks 0–50 dan keempat kategorinya.
 *
 * ============================================================================
 * KENAPA UJI INI ADA
 * ============================================================================
 *
 * Versi lama menghitung persentase 0–100% dengan ambang buatan sendiri. Tidak
 * ada satu pun uji yang menangkapnya, karena memang tidak ada uji untuk skor.
 * Yang dijaga di sini adalah hal-hal yang salahnya TIDAK terlihat dari
 * antarmuka: hasilnya tetap tampil wajar (angka + label) walaupun rumusnya
 * keliru.
 *
 * Angka pembanding dihitung TANGAN dari rumus rujukan:
 *   index = (mean − 1) × (50/3)
 *
 * Tanpa jaringan, tanpa API key.
 * Pemakaian: node uji-skor-hls.mjs
 */

import { hitungIndeks, kategoriDari, terbatas, KATEGORI, JUMLAH_ITEM } from './app/src/lib/skorHls.js'

let lulus = 0
let gagal = 0

function periksa(nama, syarat, keterangan = '') {
  if (syarat) {
    lulus++
    console.log(`  ok    ${nama}`)
  } else {
    gagal++
    console.log(`  GAGAL ${nama}${keterangan ? ` — ${keterangan}` : ''}`)
  }
}

/** Jawaban 12 item dari satu nilai, dalam bentuk instrumen (1..4). */
const semua = (n) => Object.fromEntries(Array.from({ length: JUMLAH_ITEM }, (_, i) => [i, n]))

/** Jawaban 12 item dalam bentuk penyimpanan lama (0..3). */
const semuaNol = (n) => Object.fromEntries(Array.from({ length: JUMLAH_ITEM }, (_, i) => [i, n]))

console.log('\n=== 1. Titik ekstrem ===')

// mean = 1 -> (1-1) x 50/3 = 0
periksa('semua "sangat sulit" (1) -> indeks 0', hitungIndeks(semua(1)).indeks === 0)
// mean = 4 -> (4-1) x 50/3 = 50
periksa('semua "sangat mudah" (4) -> indeks 50', hitungIndeks(semua(4)).indeks === 50)

// Bentuk lama 0..3 harus memberi hasil yang SAMA PERSIS — tapi hanya kalau
// skalanya DISEBUT. Tanpa itu, jawaban 0..3 yang tidak memuat angka 0 (mis.
// semua bernilai 3) tidak bisa dibedakan dari skala instrumen.
periksa(
  'bentuk lama 0..3 (skala disebut) memberi indeks yang sama dengan 1..4',
  hitungIndeks(semuaNol(0), 12, 'nol').indeks === hitungIndeks(semua(1), 12, 'instrumen').indeks &&
    hitungIndeks(semuaNol(3), 12, 'nol').indeks === hitungIndeks(semua(4), 12, 'instrumen').indeks,
  `0..3: ${hitungIndeks(semuaNol(0), 12, 'nol').indeks}/${hitungIndeks(semuaNol(3), 12, 'nol').indeks}, ` +
    `1..4: ${hitungIndeks(semua(1), 12, 'instrumen').indeks}/${hitungIndeks(semua(4), 12, 'instrumen').indeks}`,
)

// Dan 'otomatis' TIDAK boleh dipercaya untuk kasus tanpa angka 0 — inilah
// cacat yang ditemukan uji ini sendiri, dan alasannya skala wajib disebut.
periksa(
  "skala 'otomatis' memang tidak bisa menebak 0..3 tanpa angka 0 (cacat yang diketahui)",
  hitungIndeks(semuaNol(3), 12, 'otomatis').indeks !== hitungIndeks(semua(4), 12, 'instrumen').indeks,
  'kalau ini lulus, tebakan otomatis jadi lebih pintar dari yang diakui — perbarui catatannya',
)

console.log('\n=== 2. Angka yang dihitung tangan ===')

// mean = 2,5 -> (2,5-1) x 50/3 = 1,5 x 16,6667 = 25,0
const campur25 = { 0: 1, 1: 2, 2: 3, 3: 4, 4: 1, 5: 2, 6: 3, 7: 4, 8: 1, 9: 2, 10: 3, 11: 4 }
periksa(
  'mean 2,5 -> indeks 25',
  hitungIndeks(campur25).indeks === 25,
  `didapat ${hitungIndeks(campur25).indeks}`,
)

// mean = 3 -> (3-1) x 50/3 = 33,3
const meanTiga = semua(3)
periksa(
  'mean 3 -> indeks 33,3',
  hitungIndeks(meanTiga).indeks === 33.3,
  `didapat ${hitungIndeks(meanTiga).indeks}`,
)

// mean = 1,5 -> (0,5) x 16,6667 = 8,3
const rendah = Object.fromEntries(Array.from({ length: 12 }, (_, i) => [i, i % 2 === 0 ? 1 : 2]))
periksa(
  'mean 1,5 -> indeks 8,3',
  hitungIndeks(rendah).indeks === 8.3,
  `didapat ${hitungIndeks(rendah).indeks}`,
)

console.log('\n=== 3. Batas kategori (harus PERSIS seperti rujukan) ===')

const batas = [
  [0, 'inadequate'],
  [12.5, 'inadequate'],
  [25, 'inadequate'],
  [25.1, 'problematic'],
  [30, 'problematic'],
  [33, 'problematic'],
  [33.1, 'sufficient'],
  [38, 'sufficient'],
  [42, 'sufficient'],
  [42.1, 'excellent'],
  [50, 'excellent'],
]
for (const [nilai, harap] of batas) {
  periksa(`indeks ${nilai} -> ${harap}`, kategoriDari(nilai) === harap, `didapat ${kategoriDari(nilai)}`)
}

console.log('\n=== 4. Empat kategori, bukan tiga ===')

periksa('KATEGORI berisi 4 tingkat', KATEGORI.length === 4, `ada ${KATEGORI.length}`)
periksa(
  'kategori menutup seluruh rentang 0..50 tanpa celah',
  KATEGORI[0].min === 0 && KATEGORI[3].maks === 50,
  `${KATEGORI[0].min}..${KATEGORI[3].maks}`,
)
for (let i = 1; i < KATEGORI.length; i++) {
  periksa(
    `batas ${KATEGORI[i - 1].kunci} -> ${KATEGORI[i].kunci} bersambung`,
    KATEGORI[i - 1].maks === KATEGORI[i].min,
    `${KATEGORI[i - 1].maks} != ${KATEGORI[i].min}`,
  )
}

console.log('\n=== 5. Jawaban tidak lengkap ===')

const sebagian = { 0: 4, 1: 4, 2: 4 }
const s = hitungIndeks(sebagian)
periksa('3 dari 12 terjawab: ditandai belum lengkap', s.lengkap === false && s.terjawab === 3)
periksa(
  '3 dari 12 terjawab: indeks dihitung dari yang ada (mean 4 -> 50)',
  s.indeks === 50,
  `didapat ${s.indeks}`,
)
periksa('tanpa jawaban: indeks 0, tidak melempar galat', hitungIndeks({}).indeks === 0)

console.log('\n=== 6. Masukan rusak tidak boleh menghasilkan angka mustahil ===')

periksa('null -> indeks 0', hitungIndeks(null).indeks === 0)
periksa('string kosong diabaikan', hitungIndeks({ 0: '', 1: '4' }).terjawab === 1)
periksa(
  'indeks tidak pernah di luar 0..50',
  [semua(1), semua(4), campur25, { 0: 4 }].every((j) => {
    const v = hitungIndeks(j).indeks
    return v >= 0 && v <= 50
  }),
)
periksa('kategoriDari(NaN) tidak melempar galat', kategoriDari(NaN) === 'inadequate')
periksa('kategoriDari(undefined) tidak melempar galat', kategoriDari(undefined) === 'inadequate')

console.log('\n=== 7. "Limited health literacy" (0–33) ===')

periksa('indeks 20 -> terbatas', terbatas(20) === true)
periksa('indeks 33 -> terbatas (batas ikut)', terbatas(33) === true)
periksa('indeks 34 -> tidak terbatas', terbatas(34) === false)

console.log('\n=== 8. Hasil yang MUSTAHIL dicapai kalau rumusnya salah ===')

// Pemeriksaan silang: rumus persentase lama (total/(12x3)x100) TIDAK boleh
// lagi dipakai. Kalau ada yang mengembalikannya, angka ini akan muncul.
const semuaTiga = semua(3)
const persenLama = Math.round((12 * 2) / (12 * 3) * 100) // bentuk penyimpanan lama: 2 dari 0..3
periksa(
  'hasil bukan persentase 0..100 (rumus lama memberi 67 untuk jawaban yang sama)',
  hitungIndeks(semuaTiga).indeks !== persenLama,
  `indeks ${hitungIndeks(semuaTiga).indeks} vs persen lama ${persenLama}`,
)

console.log(`\n=== RINGKASAN: ${lulus} lulus, ${gagal} gagal ===`)
process.exit(gagal === 0 ? 0 : 1)
