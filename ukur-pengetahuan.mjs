#!/usr/bin/env node
/**
 * Ukur LUAS PENGETAHUAN kesehatan yang bisa dijangkau aplikasi.
 *
 * Dijalankan: node ukur-pengetahuan.mjs            (tembak Wikipedia + MedlinePlus)
 *             node ukur-pengetahuan.mjs --cepat    (hanya kata kunci, tanpa jaringan)
 *
 * KENAPA UJI INI ADA
 * ------------------
 * `uji-sumber.mjs` mengukur satu bidang saja: ALAT PEMERIKSAAN PENUNJANG
 * (rontgen, USG, MRI, EKG, laboratorium, PCR, rapid test). Bidang itu sudah
 * 14/14. Yang belum pernah diukur: apakah aplikasi mengenali topik kesehatan
 * LAIN di luar daftar yang sudah ditulis — gigi, mata, THT, saraf, kulit,
 * jiwa, gizi, anak, lansia, penyakit tropis, kanker, dan pertolongan pertama.
 *
 * Cara mengukurnya harus sama dengan cara aplikasi bekerja, kalau tidak
 * angkanya menipu:
 *
 *   1. `kataKunciPencarian(teks)`  -> bahan Wikipedia Indonesia
 *   2. `istilahKesehatan(teks)`    -> kunci PETA_MEDLINEPLUS
 *   3. `cariInternet(kunci, { istilahMedlinePlus })` -> sumber sungguhan
 *
 * Jadi tiap baris di bawah melaporkan EMPAT hal: apakah pertanyaannya dikenali
 * sebagai topik kesehatan, kata kunci apa yang dipilih, padanan MedlinePlus
 * apa yang dipakai, dan berapa sumber yang benar-benar didapat.
 *
 * Hasilnya disimpan ke berkas JSON di luar repo supaya bisa dibandingkan
 * sebelum/sesudah perubahan (jangan mengandalkan ingatan atas angka).
 */
import { writeFile } from 'node:fs/promises'
import {
  kataKunciPencarian,
  istilahKesehatan,
  menyentuhKesehatan,
  PETA_MEDLINEPLUS,
  PETA_MEDLINEPLUS_BIDANG,
  PETA_PENCARIAN,
} from './app/server/kataKunci.js'
import { cariInternet } from './app/server/cari.js'

const cepat = process.argv.includes('--cepat')
const KELUARAN = process.argv.find((a) => a.startsWith('--simpan='))?.slice(9)
  ?? '/home/ellbaayy/.hermes/cache/scratch/ukur-pengetahuan.json'

/**
 * Daftar pertanyaan — SENGAJA lintas bidang, dan SEMUA kalimatnya wajar
 * diucapkan orang awam (bukan istilah teknis yang cuma ada di buku).
 *
 * Tiap butir: [pertanyaan, bidang, kendali]
 *   kendali = true  -> ini BUKAN pertanyaan kesehatan; harus tetap tertahan
 *                      sebagai obrolan biasa, dan TIDAK boleh ikut dicari.
 */
const TANYA = [
  // --- gigi & mulut -------------------------------------------------------
  ['Bagaimana cara merawat gigi berlubang?', 'gigi', false],
  ['Apa itu sariawan?', 'gigi', false],
  ['Kenapa gusi saya sering berdarah?', 'gigi', false],
  ['Apa itu gigi bungsu dan apakah harus dicabut?', 'gigi', false],
  ['Bagaimana cara mencegah karang gigi?', 'gigi', false],
  ['Bau mulut terus, apa penyebabnya?', 'gigi', false],

  // --- mata --------------------------------------------------------------
  ['Apa itu katarak?', 'mata', false],
  ['Apa itu glaukoma?', 'mata', false],
  ['Mata saya minus terus bertambah, kenapa?', 'mata', false],
  ['Apa itu mata kering?', 'mata', false],
  ['Apa itu buta warna?', 'mata', false],
  ['Bagaimana cara merawat mata setelah operasi katarak?', 'mata', false],

  // --- THT ---------------------------------------------------------------
  ['Apa itu sinusitis?', 'tht', false],
  ['Apa itu infeksi telinga?', 'tht', false],
  ['Telinga saya berdenging terus, apa itu?', 'tht', false],
  ['Apa itu amandel dan kapan harus dioperasi?', 'tht', false],
  ['Hidung saya mampet terus, apa penyebabnya?', 'tht', false],

  // --- saraf -------------------------------------------------------------
  ['Apa itu epilepsi?', 'saraf', false],
  ['Apa itu migrain?', 'saraf', false],
  ['Apa itu neuropati diabetik?', 'saraf', false],
  ['Tangan saya kesemutan terus, apa penyebabnya?', 'saraf', false],
  ['Apa itu bell palsy?', 'saraf', false],
  ['Apa itu parkinson?', 'saraf', false],

  // --- kulit -------------------------------------------------------------
  ['Apa itu eksim?', 'kulit', false],
  ['Bagaimana cara mengatasi jerawat?', 'kulit', false],
  ['Apa itu psoriasis?', 'kulit', false],
  ['Apa itu panu dan bagaimana mengobatinya?', 'kulit', false],
  ['Apa itu kudis?', 'kulit', false],
  ['Kulit saya gatal dan bersisik, apa penyebabnya?', 'kulit', false],

  // --- jiwa --------------------------------------------------------------
  ['Bagaimana cara mengatasi gangguan kecemasan?', 'jiwa', false],
  ['Apa itu gangguan bipolar?', 'jiwa', false],
  ['Apa itu skizofrenia?', 'jiwa', false],
  ['Bagaimana cara membantu orang yang ingin bunuh diri?', 'jiwa', false],
  ['Apa itu gangguan stres pasca trauma?', 'jiwa', false],
  ['Anak saya sulit fokus, apakah itu ADHD?', 'jiwa', false],
  ['Bagaimana cara menjaga kesehatan mental remaja?', 'jiwa', false],

  // --- gizi --------------------------------------------------------------
  ['Apa itu stunting?', 'gizi', false],
  ['Bagaimana cara mencegah kekurangan zat besi?', 'gizi', false],
  ['Apa itu anemia defisiensi besi?', 'gizi', false],
  ['Berapa kebutuhan air minum sehari?', 'gizi', false],
  ['Apa itu gizi seimbang?', 'gizi', false],
  ['Bagaimana cara membaca label gizi kemasan?', 'gizi', false],
  ['Apa itu obesitas pada anak?', 'gizi', false],

  // --- anak & ibu --------------------------------------------------------
  ['Apa itu ASI eksklusif?', 'anak', false],
  ['Bagaimana cara merawat bayi baru lahir?', 'anak', false],
  ['Apa saja imunisasi dasar yang wajib untuk bayi?', 'anak', false],
  ['Bagaimana cara menurunkan demam pada anak?', 'anak', false],
  ['Apa itu ikterus pada bayi baru lahir?', 'anak', false],
  ['Bagaimana cara mencegah kematian ibu melahirkan?', 'anak', false],
  ['Apa itu preeklamsia?', 'anak', false],

  // --- lansia ------------------------------------------------------------
  ['Bagaimana cara merawat lansia dengan demensia?', 'lansia', false],
  ['Bagaimana cara mencegah jatuh pada lansia?', 'lansia', false],
  ['Apa itu osteoporosis?', 'lansia', false],
  ['Bagaimana cara menjaga kesehatan lansia?', 'lansia', false],

  // --- penyakit tropis & menular ----------------------------------------
  ['Apa itu leptospirosis?', 'tropis', false],
  ['Apa itu chikungunya?', 'tropis', false],
  ['Apa itu demam tifoid?', 'tropis', false],
  ['Apa itu cacingan?', 'tropis', false],
  ['Apa itu rabies?', 'tropis', false],
  ['Apa itu cacar monyet?', 'tropis', false],
  ['Apa itu hepatitis B?', 'tropis', false],
  ['Bagaimana cara mencegah penularan tuberkulosis?', 'tropis', false],
  ['Apa itu infeksi saluran kemih?', 'tropis', false],

  // --- kronis & metabolik ------------------------------------------------
  ['Apa itu asam urat?', 'kronis', false],
  ['Apa itu penyakit paru obstruktif kronik?', 'kronis', false],
  ['Apa itu gagal jantung kongestif?', 'kronis', false],
  ['Apa itu penyakit tiroid?', 'kronis', false],
  ['Apa itu wasir?', 'kronis', false],
  ['Apa itu asam lambung naik?', 'kronis', false],
  ['Apa itu kanker payudara?', 'kanker', false],
  ['Apa itu kanker serviks?', 'kanker', false],
  ['Apa itu kanker usus besar?', 'kanker', false],
  ['Bagaimana cara mendeteksi kanker sejak dini?', 'kanker', false],

  // --- pertolongan pertama & keselamatan --------------------------------
  ['Apa yang harus dilakukan saat patah tulang?', 'gawat', false],
  ['Bagaimana pertolongan pertama pada luka bakar?', 'gawat', false],
  ['Apa yang harus dilakukan saat orang tenggelam?', 'gawat', false],
  ['Bagaimana cara menghentikan perdarahan?', 'gawat', false],
  ['Apa itu syok anafilaktik?', 'gawat', false],
  ['Bagaimana cara menolong orang yang tersedak?', 'gawat', false],
  ['Bagaimana cara mencegah cedera di tempat kerja?', 'gawat', false],

  // --- pencegahan & hidup sehat -----------------------------------------
  ['Bagaimana cara mencuci tangan yang benar?', 'cegah', false],
  ['Bagaimana cara memberantas sarang nyamuk?', 'cegah', false],
  ['Apa itu imunisasi dan mengapa penting?', 'cegah', false],
  ['Bagaimana cara berhenti merokok?', 'cegah', false],
  ['Apa itu kesehatan kerja?', 'cegah', false],
  ['Bagaimana cara menjaga kebersihan makanan?', 'cegah', false],

  // --- KENDALI: bukan pertanyaan kesehatan, harus tertahan --------------
  ['hati-hati ya di jalan', 'kendali', true],
  ['makasih banyak ya', 'kendali', true],
  ['apa kabar hari ini', 'kendali', true],
  ['tolong buatkan puisi tentang hujan', 'kendali', true],
  ['berapa harga tiket kereta ke bandung', 'kendali', true],
]

const baris = []
let dikenali = 0
let dapatSumber = 0
let kosong = 0
let bocor = 0

console.log(`=== UKUR PENGETAHUAN (${TANYA.length} pertanyaan, ${cepat ? 'tanpa jaringan' : 'dengan jaringan'}) ===\n`)

for (const [q, bidang, kendali] of TANYA) {
  const sehat = menyentuhKesehatan(q)
  const kk = kataKunciPencarian(q)
  const istilah = istilahKesehatan(q)
  const mp = PETA_MEDLINEPLUS[istilah] ?? null
  const mpBidang = PETA_MEDLINEPLUS_BIDANG[istilah] ?? null
  const dipetakan = PETA_PENCARIAN[istilah] ?? null

  let jumlah = 0
  let judul = []
  if (!cepat && !kendali) {
    try {
      const { hasil } = await cariInternet(kk, {
        istilahMedlinePlus: mp,
        istilahMedlinePlusBidang: mpBidang,
      })
      jumlah = hasil.length
      judul = hasil.map((h) => h.judul)
    } catch (e) {
      judul = ['GALAT: ' + e.message]
    }
  }

  if (kendali) {
    const lolos = !sehat
    if (!lolos) bocor++
    console.log(`${lolos ? 'OK   ' : 'BOCOR'} [kendali] "${q}" -> sehat=${sehat}`)
  } else {
    if (sehat) dikenali++
    if (!cepat) {
      if (jumlah > 0) dapatSumber++
      else kosong++
    }
    const tanda = cepat ? '' : jumlah > 0 ? `${String(jumlah).padStart(2)} sumber` : '   0 SUMBER'
    console.log(
      `${cepat ? (sehat ? 'OK   ' : 'BUTA ') : jumlah > 0 ? 'OK   ' : 'KOSONG'} [${bidang.padEnd(7)}] ${tanda} | kk="${kk}" mp=${mp ?? mpBidang ?? '-'} peta=${dipetakan ?? '-'} | ${q}`,
    )
    if (!cepat && jumlah > 0) console.log(`        ${judul.slice(0, 4).join(' · ')}`)
  }

  baris.push({ q, bidang, kendali, sehat, kk, istilah, mp, dipetakan, jumlah, judul })
  if (!cepat) await new Promise((r) => setTimeout(r, 1200))
}

const kesehatan = baris.filter((b) => !b.kendali)
console.log(`\n=== RINGKASAN ===`)
console.log(`dikenali sebagai topik kesehatan : ${dikenali}/${kesehatan.length}`)
if (!cepat) {
  console.log(`mendapat sumber                  : ${dapatSumber}/${kesehatan.length}`)
  console.log(`0 sumber                          : ${kosong}/${kesehatan.length}`)
  console.log(`kendali yang bocor                : ${bocor}/${baris.length - kesehatan.length}`)

  // kelompokkan yang masih kosong supaya perbaikan berikutnya terarah
  const perBidang = {}
  for (const b of kesehatan) {
    perBidang[b.bidang] ??= { total: 0, kosong: 0 }
    perBidang[b.bidang].total++
    if (!b.jumlah) perBidang[b.bidang].kosong++
  }
  console.log('\nper bidang (0 sumber / total):')
  for (const [bid, v] of Object.entries(perBidang).sort((a, b) => b[1].kosong - a[1].kosong)) {
    console.log(`  ${bid.padEnd(8)} ${v.kosong}/${v.total}${v.kosong ? '  <- masih buta' : ''}`)
  }
}

await writeFile(KELUARAN, JSON.stringify({ waktu: new Date().toISOString(), cepat, baris }, null, 1))
console.log(`\nhasil disimpan: ${KELUARAN}`)
