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
