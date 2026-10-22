#!/usr/bin/env node
/**
 * Uji penyaring klaim tanpa sumber — TANPA jaringan, TANPA model, TANPA DB.
 *
 * KENAPA UJI INI PALING PENTING DI BERKAS INI
 * -------------------------------------------
 * Penyaring yang salah kalibrasi LEBIH BERBAHAYA daripada tidak ada penyaring:
 * ia membuang kalimat yang sebenarnya benar, dan pengguna kehilangan informasi
 * yang sah tanpa tahu kenapa. Karena itu jumlah pemeriksaan "TIDAK BOLEH
 * DIBUANG" sengaja lebih banyak daripada pemeriksaan "harus dibuang".
 *
 * Kalau menambah pola ke `klaim.js`, tambahkan dulu kasus "jangan dibuang" di
 * sini — bukan sebaliknya.
 *
 * Jalankan: node uji-klaim.mjs
 */
import { saringKlaimTanpaSumber, daftarKalimat, teksSumber } from './app/server/klaim.js'

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

/* Sumber tiruan: teks MedlinePlus tentang penyakit ginjal. SENGAJA tidak
 * memuat pernyataan apa pun tentang "satu ginjal" atau "harapan hidup". */
const SUMBER_GINJAL = `
Kidney Diseases. Your kidneys filter wastes and extra water from your blood.
Kidney disease means your kidneys are damaged and cannot filter blood the way
they should. Chronic kidney disease is a condition in which the kidneys are
damaged and cannot filter blood as well as they should. Diabetes and high
blood pressure are the most common causes. Symptoms include swelling in the
legs, tiredness, vomiting, and loss of appetite.
`

/* ===========================================================================
 * 1. KLAIM KARANGAN HARUS DIBUANG
 *
 * Setiap kasus dibungkus kalimat pendamping yang SAH. Alasannya penting:
 * penyaring punya pengaman "jangan pernah mengosongkan jawaban" — kalau
 * jawaban hanya terdiri dari satu kalimat dan kalimat itu terbuang, jawaban
 * asli dikembalikan utuh. Jadi menguji dengan satu kalimat saja TIDAK
 * menguji penyaringnya; ia menguji pengamannya.
 * ======================================================================== */
console.log('\n1. Klaim yang tidak ditopang sumber dibuang')

const PENAMPUNG = 'Ginjal menyaring kotoran dari darah.'

const KARANGAN = [
  'Banyak orang dengan satu ginjal tetap hidup normal.',
  'Orang dengan satu ginjal tetap bisa hidup sehat.',
  'Biasanya aman bagi orang yang hanya punya satu ginjal.',
  'Kebanyakan orang dengan satu ginjal tidak bermasalah.',
]
for (const k of KARANGAN) {
  const r = saringKlaimTanpaSumber(`${PENAMPUNG} ${k}`, SUMBER_GINJAL)
  periksa(
    `dibuang: "${k}"`,
    r.dibuang.length === 1 && !r.jawaban.includes(k) && r.jawaban.includes(PENAMPUNG),
    `sisa="${r.jawaban}"`,
  )
}

// Kasus nyata 22 Okt 2026: kalimat ini muncul di jawaban tingkat dewasa.
const nyata = 'Tidak benar. Satu ginjal yang sehat masih bisa menjalankan fungsi penyaringan darah. Banyak orang dengan satu ginjal tetap hidup normal.'
const rNyata = saringKlaimTanpaSumber(nyata, SUMBER_GINJAL)
periksa(
  'kasus nyata: hanya kalimat karangan yang dibuang',
  rNyata.dibuang.length === 1 && /Banyak orang dengan satu ginjal/.test(rNyata.dibuang[0].kalimat),
  `dibuang=${JSON.stringify(rNyata.dibuang.map((d) => d.kalimat))}`,
)
periksa(
  'kasus nyata: kalimat lain tetap ada',
  /Tidak benar/.test(rNyata.jawaban) && /Satu ginjal yang sehat/.test(rNyata.jawaban),
  `sisa="${rNyata.jawaban}"`,
)

/* ===========================================================================
 * 2. KALIMAT YANG BENAR TIDAK BOLEH DISENTUH
 * ======================================================================== */
console.log('\n2. Kalimat yang sah TIDAK dibuang')

const AMAN = [
  // penjelasan yang istilahnya ada di sumber
  'Ginjal menyaring kotoran dan kelebihan air dari darah.',
  'Penyebab tersering adalah diabetes dan tekanan darah tinggi.',
  'Tanda yang muncul antara lain kaki bengkak dan rasa lelah.',
  // kalimat meta tentang sumbernya — ini bentuk kejujuran, bukan klaim
  'Sumber yang tersedia tidak memuat angka harapan hidup untuk orang dengan satu ginjal.',
  'Hasil pencarian tidak memuat aturan seperti itu.',
  'Aplikasi ini tidak bisa memeriksa tubuh Anda.',
  'Informasi itu belum ditemukan.',
  // arahan keselamatan
  'Segera periksa ke dokter bila kaki bengkak.',
  'Beri tahu orang tua bila badan terasa tidak enak.',
  'Dokter bisa memeriksa lewat tes darah dan tes urine.',
  // definisi & penjelasan umum
  'Gagal ginjal berarti ginjal bekerja kurang dari 15 persen.',
  'Ini disebut penyakit ginjal kronis.',
]
for (const k of AMAN) {
  const r = saringKlaimTanpaSumber(k, SUMBER_GINJAL)
  periksa(`aman: "${k.slice(0, 55)}..."`, r.dibuang.length === 0, `dibuang=${JSON.stringify(r.dibuang)}`)
}

/* ===========================================================================
 * 3. KALAU SUMBER MEMANG MEMBAHAS PROGNOSIS -> TIDAK DISARING
 * ======================================================================== */
console.log('\n3. Sumber yang membahas prognosis -> tidak ada yang dibuang')

const SUMBER_PROGNOSIS = `
Chronic kidney disease. Most people with one kidney live a normal, healthy life.
Life expectancy is usually normal when the remaining kidney is healthy.
`
const rProg = saringKlaimTanpaSumber(
  'Banyak orang dengan satu ginjal tetap hidup normal.',
  SUMBER_PROGNOSIS,
)
periksa('sumber bahas prognosis -> kalimat dibiarkan', rProg.dibuang.length === 0, `dibuang=${JSON.stringify(rProg.dibuang)}`)
periksa('sumber bahas prognosis -> jawaban utuh', rProg.jawaban.includes('tetap hidup normal'))

// "survival" juga menandakan sumber membahas prognosis
const rSurv = saringKlaimTanpaSumber('Orang dengan satu ginjal bisa hidup normal.', 'Five-year survival is high.')
periksa('kata "survival" di sumber -> dibiarkan', rSurv.dibuang.length === 0)

/* ===========================================================================
 * 4. TANPA SUMBER -> TIDAK MENYARING SAMA SEKALI
 * ======================================================================== */
console.log('\n4. Tanpa bahan sumber, tidak ada yang disaring')

const tanpaBahan = saringKlaimTanpaSumber('Banyak orang dengan satu ginjal tetap hidup normal.', '')
periksa('sumber kosong -> jawaban utuh', tanpaBahan.dibuang.length === 0 && tanpaBahan.jawaban !== '')
periksa('sumber kosong -> diperiksa = 0', tanpaBahan.diperiksa === 0)
const spasi = saringKlaimTanpaSumber('Banyak orang tetap hidup normal.', '   ')
periksa('sumber hanya spasi -> jawaban utuh', spasi.dibuang.length === 0)

/* ===========================================================================
 * 4b. PENYARING TIDAK BOLEH MENGOSONGKAN JAWABAN
 * ======================================================================== */
console.log('\n4b. Kalau semua kalimat terkena, jawaban dikembalikan utuh')

const semuaPrognosis = 'Banyak orang tetap hidup normal. Semua orang bisa hidup lama.'
const rSemua = saringKlaimTanpaSumber(semuaPrognosis, SUMBER_GINJAL)
periksa(
  'semua kalimat terkena -> jawaban TIDAK dikosongkan',
  rSemua.jawaban.trim().length > 0,
  `jawaban="${rSemua.jawaban}"`,
)
periksa('semua kalimat terkena -> tidak ada laporan pembuangan', rSemua.dibuang.length === 0)

/* ===========================================================================
 * 5. DAFTAR BUKAN SATU KALIMAT
 * ======================================================================== */
console.log('\n5. Daftar berbutir dipecah, bukan dianggap satu kalimat')

const daftar = `Langkah di rumah:
- Kurangi garam
- Jaga tekanan darah
- Jangan merokok`
const kDaftar = daftarKalimat(daftar)
periksa('butir daftar dipecah', kDaftar.length === 4, `jumlah=${kDaftar.length}: ${JSON.stringify(kDaftar)}`)
periksa('tanda butir dibuang dari isi', kDaftar.every((k) => !k.startsWith('-')))

// Satu butir karangan tidak boleh membuang seluruh daftar
const campur = `Yang bisa dilakukan:
- Kurangi garam
- Banyak orang dengan satu ginjal tetap hidup normal
- Jaga tekanan darah`
const rCampur = saringKlaimTanpaSumber(campur, SUMBER_GINJAL)
periksa('hanya butir karangan yang dibuang', rCampur.dibuang.length === 1, `dibuang=${JSON.stringify(rCampur.dibuang.map((d) => d.kalimat))}`)
periksa('butir lain tetap ada', /Kurangi garam/.test(rCampur.jawaban) && /Jaga tekanan darah/.test(rCampur.jawaban))

// Angka bertitik tidak boleh dianggap akhir kalimat
const angka = daftarKalimat('Dosisnya 15.000 unit per hari. Minum setelah makan.')
periksa('angka bertitik tidak memecah kalimat', angka.length === 2, `jumlah=${angka.length}: ${JSON.stringify(angka)}`)

/* ===========================================================================
 * 6. LAPORAN PEMBUANGAN BISA DIPERIKSA
 * ======================================================================== */
console.log('\n6. Pembuangan dilaporkan, bukan disembunyikan')

const lap = saringKlaimTanpaSumber(`${PENAMPUNG} Banyak orang dengan satu ginjal tetap hidup normal.`, SUMBER_GINJAL)
periksa('dibuang memuat kalimatnya', lap.dibuang[0]?.kalimat?.includes('Banyak orang'))
periksa('dibuang memuat alasannya', typeof lap.dibuang[0]?.alasan === 'string' && lap.dibuang[0].alasan.length > 10)
periksa('jumlah diperiksa dilaporkan', lap.diperiksa === 2)

/* ===========================================================================
 * 7. TEKS SUMBER
 * ======================================================================== */
console.log('\n7. Teks sumber disusun dari isi sebenarnya, bukan judul saja')

periksa('kosong -> string kosong', teksSumber([]) === '')
periksa('undefined -> string kosong', teksSumber() === '')
const tS = teksSumber([{ judul: 'Kidney Diseases', isi: 'kidneys filter wastes' }])
periksa('judul ikut', tS.includes('Kidney Diseases'))
periksa('isi ikut', tS.includes('kidneys filter wastes'))
const tR = teksSumber([{ judul: 'A', ringkas: 'ringkasan penting' }])
periksa('ringkas dipakai kalau isi tidak ada', tR.includes('ringkasan penting'))

/* ===========================================================================
 * 8. JAWABAN KOSONG TIDAK MELEDAK
 * ======================================================================== */
console.log('\n8. Masukan aneh tidak membuat galat')

periksa('jawaban kosong', saringKlaimTanpaSumber('', SUMBER_GINJAL).jawaban === '')
periksa('jawaban undefined', saringKlaimTanpaSumber(undefined, SUMBER_GINJAL).jawaban === '')
periksa('jawaban null', saringKlaimTanpaSumber(null, SUMBER_GINJAL).jawaban === '')
periksa('sumber undefined', saringKlaimTanpaSumber('halo', undefined).dibuang.length === 0)

/* ===========================================================================
 * RINGKASAN
 * ======================================================================== */
console.log(`\n=== RINGKASAN: ${lulus} lulus, ${gagal} gagal ===`)
process.exit(gagal ? 1 : 0)
