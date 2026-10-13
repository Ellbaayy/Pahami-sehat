#!/usr/bin/env node
/**
 * Uji sumber untuk ALAT PEMERIKSAAN PENUNJANG.
 *
 * Dijalankan: node uji-sumber.mjs
 * Jaringan:   node uji-sumber.mjs --jaringan   (menembak Wikipedia & MedlinePlus)
 *
 * KENAPA UJI INI ADA
 * ------------------
 * Aplikasi pernah menjawab "Aku tidak punya bahan bacaan tentang pemeriksaan
 * penunjang" untuk pertanyaan yang wajar. Modelnya tidak bersalah: aturannya
 * melarang menjawab di luar hasil pencarian, dan hasil pencariannya memang
 * KOSONG.
 *
 * Diukur pada 20 pertanyaan kesehatan: 9 mendapat 0 sumber, dan hampir
 * semuanya alat pemeriksaan (rontgen, USG, MRI, EKG, laboratorium, PCR,
 * rapid test). Empat sebabnya:
 *
 *   1. Hanya SATU kata kunci dipakai, dan yang terpilih justru kata paling
 *      umum — "pemeriksaan penunjang" menjadi "pemeriksaan", lalu Wikipedia
 *      menjawabnya dengan Badan Pemeriksa Keuangan.
 *   2. Penyaring relevansi membuang artikel yang BENAR, karena menuntut judul
 *      memuat kata kunci: kk "usg" membuang "Ultrasonografi medis",
 *      kk "mri" membuang "Pencitraan resonansi magnetik",
 *      kk "ekg" membuang "Elektrokardiografi".
 *   3. Daftar istilah kesehatan tidak memuat nama alat pemeriksaan sama sekali.
 *   4. Wikipedia Indonesia memang tidak punya artikelnya untuk sebagian alat.
 *
 * Uji ini menjaga keempatnya. Bagian tanpa jaringan mengunci sebab 1-3;
 * bagian --jaringan membuktikan sebab 4 benar-benar tertutup oleh MedlinePlus.
 */
import {
  kataKunciPencarian,
  istilahKesehatan,
  menyentuhKesehatan,
  PETA_PENCARIAN,
  PETA_MEDLINEPLUS,
  ISTILAH_CARI,
} from './app/server/kataKunci.js'
import { cariInternet } from './app/server/cari.js'

let gagal = 0
function cek(nama, dapat, harus) {
  const ok = JSON.stringify(dapat) === JSON.stringify(harus)
  if (!ok) gagal++
  console.log(`${ok ? 'OK  ' : 'GAGAL'} ${nama}`)
  if (!ok) console.log(`      dapat: ${JSON.stringify(dapat)}\n      harus: ${JSON.stringify(harus)}`)
}
function cekBenar(nama, syarat, keterangan = '') {
  if (!syarat) gagal++
  console.log(`${syarat ? 'OK  ' : 'GAGAL'} ${nama}${syarat ? '' : '  <- ' + keterangan}`)
}

/* ==========================================================================
   1. KATA KUNCI — sebab yang paling langsung
   ========================================================================== */

console.log('--- kata kunci: pertanyaan yang dulu gagal ---')

// Pertanyaan asli yang dilaporkan: dulu menghasilkan "pemeriksaan", kata paling
// umum, dan Wikipedia menjawabnya dengan Badan Pemeriksa Keuangan.
cek(
  'pemeriksaan penunjang tidak jatuh jadi "pemeriksaan"',
  kataKunciPencarian('Apa yang perlu saya ketahui tentang pemeriksaan penunjang?'),
  'Pemeriksaan fisik',
)
cek('pemeriksaan penunjang (tanpa kata tanya)', kataKunciPencarian('pemeriksaan penunjang'), 'Pemeriksaan fisik')
cek('rontgen dada tidak jatuh jadi "rontgen"', kataKunciPencarian('Apa itu rontgen dada?'), 'Radiografi')
cek('rontgen -> Radiografi', kataKunciPencarian('rontgen itu apa'), 'Radiografi')
cek('usg -> Ultrasonografi medis', kataKunciPencarian('Apa itu USG?'), 'Ultrasonografi medis')
cek('mri -> Pencitraan resonansi magnetik', kataKunciPencarian('Apa itu MRI?'), 'Pencitraan resonansi magnetik')
cek('ekg -> Elektrokardiografi', kataKunciPencarian('Apa itu EKG?'), 'Elektrokardiografi')
cek('ct scan -> Tomografi terkomputasi', kataKunciPencarian('Apa itu CT scan?'), 'Tomografi terkomputasi')
cek('tes pcr -> Reaksi berantai polimerase', kataKunciPencarian('Apa itu tes PCR?'), 'Reaksi berantai polimerase')
cek('laboratorium -> Laboratorium klinik', kataKunciPencarian('cara membaca hasil laboratorium'), 'Laboratorium klinik')
cek('tes darah -> Hitung darah lengkap', kataKunciPencarian('Apa itu tes darah lengkap?'), 'Hitung darah lengkap')
cek('rapid test -> Tes diagnostik cepat', kataKunciPencarian('Apa itu rapid test?'), 'Tes diagnostik cepat')
cek('endoskopi', kataKunciPencarian('Apa itu endoskopi?'), 'Endoskopi')
cek('biopsi', kataKunciPencarian('Apa itu biopsi?'), 'Biopsi')
cek('spirometri', kataKunciPencarian('Apa itu spirometri?'), 'Spirometri')
cek('pap smear -> Apus Pap', kataKunciPencarian('Apa itu pap smear?'), 'Apus Pap')

console.log('\n--- kata kunci: yang lama TIDAK BOLEH rusak ---')
cek('gatal-gatal tetap "gatal"', kataKunciPencarian('saya menderita gatal-gatal, kira-kira apa yg sedang terjadi'), 'gatal')
cek('lemas tetap "kelelahan"', kataKunciPencarian('saya sering merasa lemas'), 'kelelahan')
cek('sakit kepala tetap utuh', kataKunciPencarian('kepala saya sakit kepala terus'), 'sakit kepala')
cek('sesak napas tetap utuh', kataKunciPencarian('kalau malam saya sesak napas'), 'sesak napas')
cek('pegal tetap "nyeri otot"', kataKunciPencarian('badan saya pegal pegal'), 'nyeri otot')
cek('demam berdarah menang atas demam', kataKunciPencarian('apa gejala demam berdarah'), 'demam berdarah')
cek('radang tenggorokan tetap "faringitis"', kataKunciPencarian('tenggorokan saya radang tenggorokan'), 'faringitis')
cek('Jawa: gatel tetap "gatal"', kataKunciPencarian('aku krasa gatel tenan, piye iki'), 'gatal')
cek('Jawa: pegel tetap "nyeri otot"', kataKunciPencarian('awakku pegel'), 'nyeri otot')
cek('pertanyaan umum tetap apa adanya', kataKunciPencarian('bagaimana cara membuat kue bolu'), 'membuat kue bolu')
cek('teks kosong tetap kosong', kataKunciPencarian(''), '')

/* ==========================================================================
   2. ISTILAH — kunci untuk mencari padanan MedlinePlus
   ========================================================================== */

console.log('\n--- istilah kesehatan (sebelum dipetakan) ---')
// Ini yang membedakan dua jalur pencarian: Wikipedia memakai istilah HASIL
// pemetaan, MedlinePlus memakai istilah yang DIKENALI pengguna. Kalau fungsi
// ini mengembalikan hasil pemetaan, padanan MedlinePlus tidak akan pernah
// ketemu — dan itu pernah terjadi pada rancangan pertama.
cek('rontgen -> "rontgen" (bukan Radiografi)', istilahKesehatan('rontgen itu apa'), 'rontgen')
cek('rontgen dada -> frasa utuh, bukan "Radiografi"', istilahKesehatan('Apa itu rontgen dada?'), 'rontgen dada')
cek('usg -> "usg" (bukan Ultrasonografi medis)', istilahKesehatan('Apa itu USG?'), 'usg')
cek('pemeriksaan penunjang tetap utuh', istilahKesehatan('pemeriksaan penunjang'), 'pemeriksaan penunjang')
cek('teks tanpa istilah -> kosong', istilahKesehatan('bagaimana cara membuat kue bolu'), '')

/* ==========================================================================
   2b. KATA TINDAKAN — jangan mencuri kata penyakitnya
   ==========================================================================
   Diukur di produksi 13 Okt 2026: 4 dari 16 pertanyaan kesehatan mendapat 0
   sumber, dan semuanya pola yang sama — kata tindakan ("penyebab", "operasi")
   lebih panjang daripada nama penyakitnya, jadi ia yang terpilih sebagai bahan
   pencarian. Penyaring relevansi menuntut kata kunci ada di JUDUL artikel, dan
   Wikipedia tidak punya artikel berjudul "Penyebab" atau "Operasi".
   ========================================================================== */

console.log('\n--- kata tindakan: nama penyakit harus menang ---')
cek('"Apa penyebab anemia?" -> Anemia', kataKunciPencarian('Apa penyebab anemia?'), 'Anemia')
cek(
  '"cara merawat luka pasca operasi" -> Bedah, bukan "operasi"',
  kataKunciPencarian('Bagaimana cara merawat luka pasca operasi?'),
  'Bedah',
)
cek(
  '"merawat pasien stroke di rumah" -> Strok',
  kataKunciPencarian('Bagaimana cara merawat pasien stroke di rumah?'),
  'Strok',
)
cek('"risiko saya terkena stroke" -> Strok', kataKunciPencarian('Apa risiko saya terkena stroke?'), 'Strok')
cek('"apakah saya mengidap diabetes" -> Diabetes melitus', kataKunciPencarian('Apakah saya mengidap diabetes?'), 'Diabetes melitus')
cek('"pengobatan tuberkulosis" -> Tuberkulosis', kataKunciPencarian('apa pengobatan untuk tuberkulosis'), 'Tuberkulosis')
cek('"kemoterapi" tetap dirinya sendiri', kataKunciPencarian('apa itu kemoterapi'), 'Kemoterapi')
cek('"luka bakar" tetap utuh', kataKunciPencarian('bagaimana cara menangani luka bakar ringan'), 'Luka bakar')
cek('"demensia" tetap dirinya sendiri', kataKunciPencarian('bagaimana cara merawat pasien demensia'), 'Demensia')

// Kalau pesannya HANYA kata tindakan, kata itu tetap dipakai — lebih baik
// daripada kosong. (Ini perilaku cadangan, bukan yang diharapkan.)
cek('hanya kata tindakan -> tetap dipakai', kataKunciPencarian('apa penyebabnya'), 'penyebabnya')

// Kedua jalur pencarian harus memilih istilah yang SAMA. Kalau berbeda, satu
// jalur mencari "anemia" sementara yang lain mencari "penyebab".
console.log('\n--- dua jalur memilih istilah yang konsisten ---')
for (const q of [
  'Apa penyebab anemia?',
  'Bagaimana cara merawat pasien stroke di rumah?',
  'apa pengobatan untuk tuberkulosis',
  'bagaimana cara menangani luka bakar ringan',
]) {
  const ist = istilahKesehatan(q)
  const kk = kataKunciPencarian(q)
  cekBenar(`"${q}" -> istilah "${ist}" terpakai di Wikipedia`, PETA_PENCARIAN[ist] === kk || ist === kk, `kk="${kk}"`)
}

// Istilah bertanda hubung MATI setelah normalkan() mengubahnya jadi spasi.
// Ini pernah terjadi pada 'pegal-pegal' dan 'kanker paru-paru'.
console.log('\n--- nama penyakit menang atas kata gejala ---')
// Diukur 13 Okt 2026: "Saya demam dan bintik merah, apa saya kena DBD?" memilih
// "bintik" (6 huruf) karena lebih panjang daripada "dbd" (3 huruf), dan Wikipedia
// menjawabnya dengan "Bintik Fordyce" — kelenjar minyak di kulit, bukan DBD.
cek(
  'DBD + bintik -> Demam berdarah dengue (bukan "bintik")',
  kataKunciPencarian('Saya demam dan bintik merah, apa saya kena DBD?'),
  'Demam berdarah dengue',
)
cek('singkatan "dbd" -> Demam berdarah dengue', kataKunciPencarian('apa itu dbd'), 'Demam berdarah dengue')
cek('singkatan "tbc" -> Tuberkulosis', kataKunciPencarian('saya batuk sudah 3 minggu apakah tbc'), 'Tuberkulosis')
// Tanpa nama penyakit, kata gejala tetap dipakai — ini perilaku yang benar.
cek('hanya gejala -> tetap kata gejala', kataKunciPencarian('saya demam'), 'demam')
cek('hanya gejala -> bintik tetap bintik', kataKunciPencarian('saya demam bintik merah'), 'bintik')
cek('"demam berdarah" (frasa) tetap menang', kataKunciPencarian('apa gejala demam berdarah'), 'demam berdarah')

console.log('\n--- kata homonim: "hati-hati" bukan topik kesehatan ---')
// Diukur 13 Okt 2026: mendaftarkan 'hati' sebagai kata kesehatan membuat
// "hati-hati ya di jalan" dianggap pertanyaan kesehatan, dan karena
// deteksiSantai() memeriksa kata kesehatan LEBIH DULU, obrolan biasa ikut mati.
cek('"hati-hati ya di jalan" BUKAN kesehatan', menyentuhKesehatan('hati-hati ya di jalan'), false)
cek('"aku hati hati banget" BUKAN kesehatan', menyentuhKesehatan('aku hati hati banget'), false)
cek('"halo apa kabar" tetap bukan kesehatan', menyentuhKesehatan('halo apa kabar'), false)
// Kata yang benar-benar menunjuk organnya harus tetap dikenali.
cek('"penyakit hati" = kesehatan', menyentuhKesehatan('gejala penyakit hati'), true)
cek('"liver" -> Penyakit hati', kataKunciPencarian('apa itu liver'), 'Penyakit hati')

console.log('\n--- tidak ada entri bertanda hubung (mati setelah normalisasi) ---')
for (const [nama, peta] of [
  ['PETA_PENCARIAN', PETA_PENCARIAN],
  ['PETA_MEDLINEPLUS', PETA_MEDLINEPLUS],
]) {
  const mati = Object.keys(peta).filter(
    (k) => k.replace(/[^\p{L}\p{N}\s]/gu, ' ').replace(/\s+/g, ' ').trim().toLowerCase() !== k.toLowerCase(),
  )
  cek(`${nama}: tidak ada entri bertanda hubung`, mati, [])
}

// Kunci yang sama ditulis DUA KALI dalam satu blok objek JS membuat yang
// terakhir menang tanpa error dan tanpa gagal uji. Ini tidak tertangkap uji
// mana pun di repo, jadi diperiksa langsung dari berkas sumbernya.
console.log('\n--- tidak ada kunci dobel di dalam satu peta ---')
{
  const fs = await import('node:fs')
  const src = fs.readFileSync(new URL('./app/server/kataKunci.js', import.meta.url), 'utf8')
  for (const nama of ['PETA_PENCARIAN', 'PETA_MEDLINEPLUS']) {
    const i = src.indexOf('export const ' + nama)
    const j = src.indexOf('\n}', i)
    const kunci = [...src.slice(i, j).matchAll(/^\s{2}'?([a-zA-Z0-9\-\s]+)'?:\s*'/gm)].map((m) => m[1])
    const dobel = [...new Set(kunci.filter((k, idx) => kunci.indexOf(k) !== idx))]
    cek(`${nama}: tidak ada kunci dobel (${kunci.length} kunci)`, dobel, [])
  }
}

/* ==========================================================================
   3. PETA — kunci harus cocok satu sama lain
   ========================================================================== */

console.log('\n--- peta istilah ---')
// Setiap kunci PETA_MEDLINEPLUS harus berupa istilah yang benar-benar
// dikenali ISTILAH_CARI. Kalau tidak, padanannya tidak akan pernah terpakai.
const medlineTidakTerpakai = Object.keys(PETA_MEDLINEPLUS).filter((k) => !ISTILAH_CARI.includes(k))
cek('semua kunci PETA_MEDLINEPLUS dikenali ISTILAH_CARI', medlineTidakTerpakai, [])

// Setiap kunci PETA_PENCARIAN juga harus dikenali, kalau tidak pemetaannya mati.
const pencarianTidakTerpakai = Object.keys(PETA_PENCARIAN).filter((k) => !ISTILAH_CARI.includes(k))
cek('semua kunci PETA_PENCARIAN dikenali ISTILAH_CARI', pencarianTidakTerpakai, [])

// Istilah pencarian harus benar-benar dikenali saat muncul di kalimat.
const contoh = [
  ['pemeriksaan penunjang', 'Pemeriksaan fisik'],
  ['rontgen', 'Radiografi'],
  ['usg', 'Ultrasonografi medis'],
  ['mri', 'Pencitraan resonansi magnetik'],
  ['ekg', 'Elektrokardiografi'],
  ['ct scan', 'Tomografi terkomputasi'],
  ['laboratorium', 'Laboratorium klinik'],
  ['endoskopi', 'Endoskopi'],
  ['biopsi', 'Biopsi'],
  ['spirometri', 'Spirometri'],
]
for (const [kata, harap] of contoh) {
  cekBenar(`"${kata}" -> "${harap}"`, PETA_PENCARIAN[kata] === harap, `dapat ${PETA_PENCARIAN[kata]}`)
}

// Istilah terpanjang harus menang — kalau tidak, "rontgen dada" bisa jatuh
// menjadi "rontgen" dan "pemeriksaan penunjang" menjadi "pemeriksaan".
cekBenar(
  'ISTILAH_CARI terurut dari terpanjang',
  ISTILAH_CARI.every((t, i) => i === 0 || ISTILAH_CARI[i - 1].length >= t.length),
)
cekBenar(
  '"pemeriksaan penunjang" lebih panjang dari "pemeriksaan"',
  'pemeriksaan penunjang'.length > 'pemeriksaan'.length,
)

/* ==========================================================================
   4. JARINGAN — buktikan sumbernya benar-benar ada
   ========================================================================== */

const pakaiJaringan = process.argv.includes('--jaringan')
if (!pakaiJaringan) {
  console.log('\n(bagian jaringan dilewati — jalankan: node uji-sumber.mjs --jaringan)')
} else {
  console.log('\n--- jaringan: pertanyaan harus mendapat sumber ---')

  // Pertanyaan yang dulu mendapat 0 sumber.
  const TANYA = [
    ['Apa yang perlu saya ketahui tentang pemeriksaan penunjang?', 'Pemeriksaan fisik'],
    ['Apa itu rontgen dada?', 'Radiografi'],
    ['Apa itu USG?', 'Ultrasonografi medis'],
    ['Apa itu MRI?', 'Pencitraan resonansi magnetik'],
    ['Apa itu EKG?', 'Elektrokardiografi'],
    ['Apa itu CT scan?', 'Tomografi terkomputasi'],
    ['Apa itu tes PCR?', 'Reaksi berantai polimerase'],
    ['Bagaimana cara membaca hasil laboratorium?', 'Laboratorium klinik'],
    ['Apa itu endoskopi?', 'Endoskopi'],
    ['Apa itu biopsi?', 'Biopsi'],
    ['Apa itu rapid test?', 'Tes diagnostik cepat'],
  ]

  let kosong = 0
  for (const [q, kkHarap] of TANYA) {
    const kk = kataKunciPencarian(q)
    const istilah = istilahKesehatan(q)
    const mp = PETA_MEDLINEPLUS[istilah] ?? null
    const { hasil } = await cariInternet(kk, { istilahMedlinePlus: mp })
    const dariWikipedia = hasil.filter((h) => !h.resmi)
    const dariMedline = hasil.filter((h) => h.jenis === 'medlineplus')

    if (!hasil.length) kosong++
    cekBenar(
      `${hasil.length} sumber | kk="${kk}" | ${q}`,
      hasil.length > 0,
      'TIDAK ADA SUMBER',
    )
    if (hasil.length) {
      console.log(`        Wikipedia: ${dariWikipedia.map((h) => h.judul).join(', ') || '-'}`)
      console.log(`        MedlinePlus: ${dariMedline.map((h) => h.judul).join(', ') || '-'}`)
    }
    // kata kunci yang diharapkan memang yang dipakai
    cekBenar(`  kata kunci = "${kkHarap}"`, kk === kkHarap, `dapat "${kk}"`)
    await new Promise((r) => setTimeout(r, 1500))
  }

  console.log(`\n  ${TANYA.length - kosong}/${TANYA.length} pertanyaan mendapat sumber (sebelumnya 2/11)`)

  // Kasus buruk yang TIDAK BOLEH kembali: artikel tidak nyambung.
  console.log('\n--- jaringan: artikel tidak nyambung harus tetap tertahan ---')
  const BURUK = [
    ['demam berdarah', ['Penyakit virus Ebola']],
    ['gatal', ['Daun gatal']],
    ['pemeriksaan penunjang', ['Badan Pemeriksa Keuangan Republik Indonesia']],
    ['rontgen', ['Wilhelm Conrad Röntgen', 'Louis Slotin']],
  ]
  for (const [kk, terlarang] of BURUK) {
    const { hasil } = await cariInternet(kk, { istilahMedlinePlus: PETA_MEDLINEPLUS[kk] ?? null })
    const judul = hasil.map((h) => h.judul)
    for (const t of terlarang) {
      cekBenar(`"${kk}" TIDAK memakai "${t}"`, !judul.includes(t), `dapat: ${judul.join(', ')}`)
    }
    await new Promise((r) => setTimeout(r, 1500))
  }
}

console.log(gagal === 0 ? '\nSEMUA LULUS' : `\n${gagal} UJI GAGAL`)
process.exit(gagal === 0 ? 0 : 1)
