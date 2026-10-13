#!/usr/bin/env node
/**
 * Periksa calon istilah BARU sebelum dimasukkan ke kataKunci.js.
 *
 * Aturan repo ini: setiap pasangan yang masuk PETA_PENCARIAN / PETA_MEDLINEPLUS
 * harus DIUJI dulu ke API-nya — bukan ditulis dari ingatan. Skrip ini yang
 * melakukannya, dan mencetak buktinya supaya bisa dibaca manusia.
 *
 * KENAPA BERKELOMPOK, BUKAN SATU PER SATU
 * ---------------------------------------
 * Versi pertama skrip ini menembak `action=query&titles=` untuk SETIAP judul
 * secara terpisah. Hasilnya menipu: dari 123 calon, 107 dilaporkan "tidak ada"
 * — padahal "Katarak", "Epilepsi", "Sinusitis" semuanya ADA. Yang terjadi
 * adalah pembatasan Wikimedia (HTTP 429, "You are making too many requests to
 * the API"): permintaan gagal, dan kegagalan itu tersimpan sebagai "tidak ada".
 *
 * Pelajarannya: KEGAGALAN JARINGAN TIDAK BOLEH DIBACA SEBAGAI "TIDAK ADA".
 * Sekarang satu permintaan memuat sampai 25 judul (batas API 50, dipakai 25
 * supaya ringan), ada jeda 3 detik antarkelompok, dan setiap judul yang TIDAK
 * ditemukan DIPERIKSA ULANG satu per satu sebagai konfirmasi.
 *
 * Dijalankan: node periksa-istilah.mjs
 */
import { writeFile } from 'node:fs/promises'

const UA = 'PahamiSehat/1.0 (pemeriksaan istilah; kontak: ellbaayy)'

/* Calon: [istilah Indonesia yang ditulis pengguna, judul artikel Wikipedia ID, istilah MedlinePlus] */
const CALON = [
  // gigi & mulut
  ['gigi berlubang', 'Karies gigi', 'tooth decay'],
  ['karies', 'Karies gigi', 'tooth decay'],
  ['sariawan', 'Sariawan', 'canker sores'],
  ['gusi berdarah', 'Radang gusi', 'gum disease'],
  ['gingivitis', 'Gingivitis', 'gum disease'],
  ['periodontitis', 'Periodontitis', 'gum disease'],
  ['karang gigi', 'Kalkulus gigi', 'gum disease'],
  ['gigi bungsu', 'Gigi bungsu', 'wisdom teeth'],
  ['bau mulut', 'Bau mulut', 'bad breath'],
  ['abses gigi', 'Abses gigi', 'tooth decay'],
  ['plak gigi', 'Plak gigi', 'gum disease'],
  // mata
  ['katarak', 'Katarak', 'cataract'],
  ['glaukoma', 'Glaukoma', 'glaucoma'],
  ['rabun jauh', 'Rabun jauh', 'nearsightedness'],
  ['miopia', 'Rabun jauh', 'nearsightedness'],
  ['rabun dekat', 'Rabun dekat', 'farsightedness'],
  ['buta warna', 'Buta warna', 'color blindness'],
  ['mata kering', 'Sindrom mata kering', 'dry eye'],
  ['konjungtivitis', 'Konjungtivitis', 'pink eye'],
  ['belekan', 'Konjungtivitis', 'pink eye'],
  ['presbiopi', 'Presbiopi', 'farsightedness'],
  // tht
  ['sinusitis', 'Sinusitis', 'sinusitis'],
  ['amandel', 'Radang amandel', 'tonsillitis'],
  ['radang amandel', 'Radang amandel', 'tonsillitis'],
  ['tonsilitis', 'Radang amandel', 'tonsillitis'],
  ['infeksi telinga', 'Otitis media', 'ear infections'],
  ['otitis', 'Otitis media', 'ear infections'],
  ['telinga berdenging', 'Tinitus', 'tinnitus'],
  ['tinitus', 'Tinitus', 'tinnitus'],
  ['mimisan', 'Mimisan', 'nosebleeds'],
  ['polip hidung', 'Polip hidung', 'nasal disorders'],
  ['vertigo', 'Vertigo', 'dizziness and vertigo'],
  // saraf
  ['epilepsi', 'Epilepsi', 'epilepsy'],
  ['ayan', 'Epilepsi', 'epilepsy'],
  ['migrain', 'Migrain', 'migraine'],
  ['neuropati', 'Neuropati', 'diabetic neuropathy'],
  ['kesemutan', 'Parestesia', 'paresthesia'],
  ['bell palsy', 'Paralisis Bell', 'facial paralysis'],
  ['parkinson', 'Penyakit Parkinson', 'parkinson disease'],
  ['sklerosis multipel', 'Sklerosis multipel', 'multiple sclerosis'],
  ['neuralgia', 'Neuralgia', 'neuralgia'],
  // kulit
  ['eksim', 'Eksim', 'eczema'],
  ['jerawat', 'Jerawat', 'acne'],
  ['psoriasis', 'Psoriasis', 'psoriasis'],
  ['panu', 'Panu', 'fungal infections'],
  ['kudis', 'Skabies', 'scabies'],
  ['skabies', 'Skabies', 'scabies'],
  ['kurap', 'Kurap', 'fungal infections'],
  ['bisul', 'Bisul', 'boils'],
  ['urtikaria', 'Urtikaria', 'hives'],
  ['vitiligo', 'Vitiligo', 'vitiligo'],
  ['kutil', 'Kutil', 'warts'],
  ['cacar air', 'Cacar air', 'chickenpox'],
  ['herpes', 'Herpes', 'herpes'],
  // jiwa
  ['gangguan kecemasan', 'Gangguan kecemasan', 'anxiety'],
  ['kecemasan', 'Gangguan kecemasan', 'anxiety'],
  ['gangguan bipolar', 'Gangguan bipolar', 'bipolar disorder'],
  ['bipolar', 'Gangguan bipolar', 'bipolar disorder'],
  ['skizofrenia', 'Skizofrenia', 'schizophrenia'],
  ['bunuh diri', 'Bunuh diri', 'suicide'],
  ['ptsd', 'Gangguan stres pascatrauma', 'post-traumatic stress disorder'],
  ['adhd', 'Gangguan pemusatan perhatian dan hiperaktivitas', 'attention deficit hyperactivity disorder'],
  ['autisme', 'Autisme', 'autism spectrum disorder'],
  ['gangguan makan', 'Gangguan makan', 'eating disorders'],
  ['anoreksia', 'Anoreksia nervosa', 'eating disorders'],
  // gizi
  ['stunting', 'Stunting', 'child nutrition'],
  ['gizi seimbang', 'Gizi seimbang', 'nutrition'],
  ['malnutrisi', 'Malnutrisi', 'malnutrition'],
  ['kwashiorkor', 'Kwashiorkor', 'malnutrition'],
  ['anemia defisiensi besi', 'Anemia defisiensi besi', 'iron deficiency anemia'],
  ['kekurangan zat besi', 'Anemia defisiensi besi', 'iron deficiency anemia'],
  // anak & ibu
  ['asi eksklusif', 'Air susu ibu', 'breastfeeding'],
  ['bayi baru lahir', 'Bayi', 'newborn screening'],
  ['imunisasi dasar', 'Imunisasi', 'childhood vaccines'],
  ['ikterus', 'Ikterus', 'jaundice'],
  ['preeklamsia', 'Preeklamsia', 'preeclampsia'],
  ['eklamsia', 'Eklamsia', 'preeclampsia'],
  ['asi', 'Air susu ibu', 'breastfeeding'],
  // lansia
  ['osteoporosis', 'Osteoporosis', 'osteoporosis'],
  ['inkontinensia', 'Inkontinensia urin', 'urinary incontinence'],
  ['sarkopenia', 'Sarkopenia', 'muscle weakness'],
  ['jatuh lansia', 'Jatuh (kesehatan)', 'falls'],
  // tropis & menular
  ['leptospirosis', 'Leptospirosis', 'leptospirosis'],
  ['chikungunya', 'Chikungunya', 'chikungunya'],
  ['demam tifoid', 'Demam tifoid', 'typhoid fever'],
  ['tifoid', 'Demam tifoid', 'typhoid fever'],
  ['cacingan', 'Cacingan', 'parasitic diseases'],
  ['cacar monyet', 'Cacar monyet', 'mpox'],
  ['infeksi saluran kemih', 'Infeksi saluran kemih', 'urinary tract infections'],
  ['isk', 'Infeksi saluran kemih', 'urinary tract infections'],
  ['filariasis', 'Filariasis', 'lymphatic filariasis'],
  ['hepatitis b', 'Hepatitis B', 'hepatitis b'],
  ['hepatitis c', 'Hepatitis C', 'hepatitis c'],
  // kronis & metabolik
  ['asam urat', 'Asam urat', 'gout'],
  ['gout', 'Asam urat', 'gout'],
  ['ppok', 'Penyakit paru obstruktif kronik', 'copd'],
  ['tiroid', 'Kelenjar tiroid', 'thyroid diseases'],
  ['hipotiroid', 'Hipotiroidisme', 'hypothyroidism'],
  ['hipertiroid', 'Hipertiroidisme', 'hyperthyroidism'],
  ['wasir', 'Wasir', 'hemorrhoids'],
  ['ambeien', 'Wasir', 'hemorrhoids'],
  ['gerd', 'Penyakit refluks gastroesofagus', 'gerd'],
  ['asam lambung', 'Penyakit refluks gastroesofagus', 'gerd'],
  ['batu empedu', 'Batu empedu', 'gallstones'],
  ['kanker payudara', 'Kanker payudara', 'breast cancer'],
  ['kanker serviks', 'Kanker serviks', 'cervical cancer'],
  ['kanker usus besar', 'Kanker usus besar', 'colorectal cancer'],
  ['kanker prostat', 'Kanker prostat', 'prostate cancer'],
  ['leukemia', 'Leukemia', 'leukemia'],
  ['limfoma', 'Limfoma', 'lymphoma'],
  // gawat darurat
  ['patah tulang', 'Patah tulang', 'fractures'],
  ['perdarahan', 'Perdarahan', 'bleeding'],
  ['tenggelam', 'Tenggelam', 'drowning'],
  ['syok', 'Syok (medis)', 'shock'],
  ['anafilaksis', 'Anafilaksis', 'anaphylaxis'],
  ['cpr', 'Resusitasi jantung paru', 'cpr'],
  ['rjp', 'Resusitasi jantung paru', 'cpr'],
  ['gigitan ular', 'Gigitan ular', 'snake bites'],
  ['keracunan', 'Keracunan', 'poisoning'],
  // pencegahan
  ['cuci tangan', 'Cuci tangan', 'handwashing'],
  ['kesehatan kerja', 'Kesehatan kerja', 'occupational health'],
  ['higiene', 'Higiene', 'hygiene'],
]

const jeda = (ms) => new Promise((r) => setTimeout(r, ms))

/**
 * Cek banyak judul Wikipedia dalam SATU permintaan (batas API 50 judul).
 * Mengembalikan Map judul-asli -> {ada, judul, awal} atau {ada:false, galat}.
 *
 * PENTING: kalau permintaannya sendiri gagal (429/timeout), SELURUH kelompok
 * ditandai galat — bukan "tidak ada". Kegagalan jaringan tidak boleh disamarkan
 * jadi kesimpulan tentang isi ensiklopedia.
 */
async function cekWikipediaKelompok(judulList) {
  const url =
    'https://id.wikipedia.org/w/api.php?action=query&prop=extracts&exintro=1&explaintext=1' +
    '&exsentences=1&redirects=1&format=json&titles=' +
    encodeURIComponent(judulList.join('|'))
  const r = await fetch(url, { headers: { 'User-Agent': UA }, signal: AbortSignal.timeout(25000) })
  const teks = await r.text()
  if (!r.ok || /too many requests/i.test(teks)) {
    const galat = /too many requests/i.test(teks) ? 'DIBATASI (429)' : 'HTTP ' + r.status
    return { galat, hasil: new Map(judulList.map((j) => [j, { ada: false, galat }])) }
  }
  let d
  try {
    d = JSON.parse(teks)
  } catch {
    return { galat: 'bukan JSON', hasil: new Map(judulList.map((j) => [j, { ada: false, galat: 'bukan JSON' }])) }
  }
  // `normalized` + `redirects` memetakan judul yang kita kirim ke judul asli
  const petaNama = new Map()
  for (const n of d?.query?.normalized ?? []) petaNama.set(n.from, n.to)
  for (const rr of d?.query?.redirects ?? []) petaNama.set(rr.from, rr.to)
  const perJudul = new Map()
  for (const hal of Object.values(d?.query?.pages ?? {})) {
    perJudul.set(hal.title, {
      ada: hal.missing === undefined,
      judul: hal.title,
      awal: String(hal.extract ?? '').replace(/\s+/g, ' ').slice(0, 110),
    })
  }
  const hasil = new Map()
  for (const asli of judulList) {
    const lewat = petaNama.get(asli) ?? asli
    const info = perJudul.get(lewat) ?? perJudul.get(asli)
    hasil.set(asli, info ?? { ada: false })
  }
  return { hasil }
}

async function cekMedline(istilah) {
  const url =
    'https://wsearch.nlm.nih.gov/ws/query?db=healthTopics&term=' + encodeURIComponent(istilah) + '&retmax=6'
  const r = await fetch(url, {
    headers: { 'User-Agent': UA, Accept: 'application/xml,text/xml' },
    signal: AbortSignal.timeout(15000),
  })
  if (!r.ok) return { ada: false, judul: [], galat: 'HTTP ' + r.status }
  const xml = await r.text()
  const judul = [...xml.matchAll(/<content name="title">([\s\S]*?)<\/content>/g)].map((m) =>
    m[1].replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim(),
  )
  return { ada: judul.length > 0, judul: judul.slice(0, 3) }
}

/* ---------------------------------------------------------------- Wikipedia -- */

const judulUnik = [...new Set(CALON.map((c) => c[1]))]
console.log(`=== WIKIPEDIA INDONESIA (${judulUnik.length} judul unik, kelompok 25) ===\n`)

const wikiInfo = new Map()
const KELOMPOK = 25
for (let i = 0; i < judulUnik.length; i += KELOMPOK) {
  const bagian = judulUnik.slice(i, i + KELOMPOK)
  let { hasil, galat } = await cekWikipediaKelompok(bagian)
  if (galat) {
    console.log(`kelompok ${i / KELOMPOK + 1}: ${galat} — menunggu 20 detik lalu mengulang`)
    await jeda(20000)
    ;({ hasil } = await cekWikipediaKelompok(bagian))
  }
  for (const [k, v] of hasil) wikiInfo.set(k, v)
  const ada = [...hasil.values()].filter((v) => v.ada).length
  console.log(`kelompok ${i / KELOMPOK + 1}: ${ada}/${bagian.length} judul ada`)
  await jeda(3000)
}

/* --------------------------------------------------------------- MedlinePlus -- */

console.log('\n=== MEDLINEPLUS (satu per satu, jeda 500 ms) ===\n')
const mpUnik = [...new Set(CALON.map((c) => c[2]))]
const mpInfo = new Map()
for (const istilah of mpUnik) {
  try {
    mpInfo.set(istilah, await cekMedline(istilah))
  } catch (e) {
    mpInfo.set(istilah, { ada: false, judul: [], galat: e.message })
  }
  await jeda(500)
}

/* ------------------------------------------------------------------- laporan -- */

const hasil = CALON.map(([istilah, wiki, medline]) => {
  const w = wikiInfo.get(wiki) ?? { ada: false, galat: 'tidak diperiksa' }
  const m = mpInfo.get(medline) ?? { ada: false, judul: [] }
  return {
    istilah,
    wiki,
    medline,
    wikiAda: Boolean(w.ada),
    wikiJudul: w.judul ?? null,
    wikiAwal: w.awal ?? null,
    wikiGalat: w.galat ?? null,
    mpAda: Boolean(m.ada),
    mpJudul: m.judul ?? [],
    mpGalat: m.galat ?? null,
  }
})

console.log('=== YANG WIKIPEDIA-NYA ADA (aman dipakai di PETA_PENCARIAN) ===\n')
for (const h of hasil.filter((h) => h.wikiAda)) {
  console.log(`  ${h.istilah.padEnd(24)} -> ${h.wikiJudul}`)
  console.log(`      ${h.wikiAwal}`)
}

const takAda = hasil.filter((h) => !h.wikiAda)
console.log(`\n=== TIDAK ADA / GAGAL (${takAda.length}) ===`)
for (const h of takAda) console.log(`  ${h.istilah.padEnd(24)} -> ${h.wiki}${h.wikiGalat ? '   [' + h.wikiGalat + ']' : ''}`)

const mpKosong = hasil.filter((h) => !h.mpAda)
console.log(`\n=== MedlinePlus kosong (${mpKosong.length}) ===`)
for (const h of mpKosong) console.log(`  ${h.medline}${h.mpGalat ? '   [' + h.mpGalat + ']' : ''}`)

console.log(`\n=== RINGKASAN ===`)
console.log(`total calon             : ${hasil.length}`)
console.log(`Wikipedia ADA           : ${hasil.filter((h) => h.wikiAda).length}`)
console.log(`Wikipedia tidak ada     : ${takAda.length}`)
console.log(`MedlinePlus ADA         : ${hasil.filter((h) => h.mpAda).length}`)

await writeFile(
  '/home/ellbaayy/.hermes/cache/scratch/periksa-istilah.json',
  JSON.stringify(hasil, null, 1),
)
console.log('tersimpan: /home/ellbaayy/.hermes/cache/scratch/periksa-istilah.json')
