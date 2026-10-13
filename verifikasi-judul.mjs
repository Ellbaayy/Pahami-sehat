#!/usr/bin/env node
/**
 * Verifikasi DEFINITIF semua judul yang akan dipakai di peta.
 *
 * KENAPA DIULANG: dua percobaan sebelumnya memberi hasil yang SALING
 * BERTENTANGAN untuk judul yang sama ("Penyakit refluks gastroesofageal"
 * dilaporkan HILANG sekali, ADA sekali). Sebabnya: `prop=extracts` punya
 * `exlimit` bawaan 1 dan maksimum 20 judul per permintaan — mengirim 25 judul
 * membuat sebagian halaman tidak diproses, dan halaman yang tidak diproses
 * tampak seperti "tidak ada".
 *
 * Jadi: batch 20 judul, `exlimit=20`, dan SETIAP judul yang dilaporkan HILANG
 * diperiksa ulang satu per satu (satu judul per permintaan) sebagai konfirmasi.
 * Kegagalan jaringan TIDAK boleh dibaca sebagai "artikelnya tidak ada".
 */
import { writeFile } from 'node:fs/promises'

const UA = 'PahamiSehat/1.0 (pemeriksaan istilah; kontak: ellbaayy)'
const jeda = (ms) => new Promise((r) => setTimeout(r, ms))

const JUDUL = [
  // --- gigi & mulut
  'Karies gigi', 'Seriawan', 'Gingivitis', 'Karang gigi', 'Gigi bungsu',
  'Halitosis', 'Bisul gigi', 'Plak gigi',
  // --- mata
  'Katarak', 'Glaukoma', 'Rabun jauh', 'Rabun dekat', 'Buta warna',
  'Sindrom mata kering', 'Konjungtivitis', 'Presbiopia',
  // --- tht
  'Sinusitis', 'Radang amandel', 'Radang telinga tengah', 'Tinitus', 'Mimisan',
  'Polip hidung', 'Vertigo',
  // --- saraf
  'Epilepsi', 'Migrain', 'Neuropati', 'Kesemutan', "Bell's palsy",
  'Penyakit Parkinson', 'Sklerosis multipel', 'Neuralgia', 'Atrofi otot',
  // --- kulit
  'Eksem', 'Jerawat', 'Psoriasis', 'Panau', 'Kudis', 'Kurap', 'Bisul',
  'Biduran', 'Vitiligo', 'Kutil', 'Cacar air', 'Herpes simpleks',
  // --- jiwa
  'Gangguan kecemasan', 'Gangguan bipolar', 'Skizofrenia', 'Bunuh diri',
  'Gangguan stres pascatrauma', 'Gangguan pemusatan perhatian dan hiperaktivitas',
  'Autisme', 'Gangguan makan', 'Anoreksia nervosa',
  // --- gizi
  'Hambatan pertumbuhan', 'Gizi seimbang', 'Malagizi', 'Busung lapar',
  'Anemia defisiensi besi',
  // --- anak & ibu
  'Air susu ibu', 'Bayi', 'Imunisasi', 'Jaundis', 'Eklampsia',
  'Komplikasi kehamilan',
  // --- lansia
  'Osteoporosis', 'Inkontinensia',
  // --- tropis & menular
  'Leptospirosis', 'Chikungunya', 'Demam tifoid', 'Cacingan', 'Cacar monyet',
  'Infeksi saluran kemih', 'Filariasis', 'Hepatitis B', 'Hepatitis C',
  'Infeksi saluran napas atas',
  // --- kronis & metabolik
  'Asam urat', 'Penyakit paru obstruktif kronis', 'Kelenjar tiroid',
  'Hipotiroidisme', 'Hipertiroidisme', 'Hemoroid', 'Penyakit refluks gastroesofagus',
  'Batu empedu', 'Kanker payudara', 'Kanker leher rahim', 'Kanker usus besar',
  'Kanker prostat', 'Leukemia', 'Limfoma',
  // --- gawat darurat
  'Retak tulang', 'Pendarahan', 'Tenggelam', 'Syok', 'Anafilaksis',
  'Resusitasi jantung paru', 'Gigitan ular', 'Keracunan',
  // --- pencegahan
  'Mencuci tangan', 'Higiene', 'Kesehatan dan keselamatan kerja',
  // --- yang SUDAH dipakai peta lama (perlu dipastikan tidak ada yang mati)
  'Strok', 'Demam berdarah dengue', 'Tuberkulosis', 'AIDS', 'Demam tifoid',
  'Indeks massa tubuh', 'Anemia', 'Kanker paru-paru', 'Penyakit Alzheimer',
  'Serangan jantung', 'Gagal ginjal', 'Sirosis', 'Demensia', 'Kemoterapi',
  'Antibiotik', 'Fisioterapi', 'Endoskopi', 'Biopsi', 'Spirometri', 'Radiografi',
  'Ultrasonografi medis', 'Elektrokardiografi', 'Tomografi terkomputasi',
  'Reaksi berantai polimerase', 'Tes diagnostik cepat', 'Hitung darah lengkap',
  'Urinalisis', 'Apus Pap', 'Laboratorium klinik', 'Pemeriksaan fisik',
  'Tanda dan gejala', 'Faktor risiko', 'Komplikasi', 'Dehidrasi', 'Alergi',
  'Infeksi', 'Luka', 'Luka bakar', 'Tersedak', 'Pertolongan pertama',
  'Perawatan di rumah', 'Bedah', 'Obesitas', 'Kelelahan', 'Nyeri otot',
  'Faringitis', 'Diabetes melitus', 'Tekanan darah tinggi',
]

const semua = [...new Set(JUDUL)]
console.log(`=== VERIFIKASI DEFINITIF (${semua.length} judul, batch 20, exlimit=20) ===\n`)

const info = new Map()

async function tanya(daftar) {
  const url =
    'https://id.wikipedia.org/w/api.php?action=query&prop=extracts|pageprops' +
    '&exintro=1&exlimit=20&explaintext=1&exsentences=1&redirects=1&format=json&titles=' +
    encodeURIComponent(daftar.join('|'))
  const r = await fetch(url, { headers: { 'User-Agent': UA }, signal: AbortSignal.timeout(30000) })
  const teks = await r.text()
  if (/too many requests/i.test(teks)) throw new Error('DIBATASI')
  if (!r.ok) throw new Error('HTTP ' + r.status)
  const d = JSON.parse(teks)
  const petaNama = new Map()
  for (const n of d?.query?.normalized ?? []) petaNama.set(n.from, n.to)
  for (const rr of d?.query?.redirects ?? []) petaNama.set(rr.from, rr.to)
  const perJudul = new Map()
  for (const hal of Object.values(d?.query?.pages ?? {})) perJudul.set(hal.title, hal)
  const hasil = new Map()
  for (const asli of daftar) {
    const lewat = petaNama.get(asli) ?? asli
    const hal = perJudul.get(lewat) ?? perJudul.get(asli)
    hasil.set(asli, hal ? { ada: hal.missing === undefined, hal } : null)
  }
  return hasil
}

const B = 20
for (let i = 0; i < semua.length; i += B) {
  const bagian = semua.slice(i, i + B)
  let hasil = null
  for (let coba = 1; coba <= 3; coba++) {
    try {
      hasil = await tanya(bagian)
      break
    } catch (e) {
      console.log(`  batch ${i / B + 1}: ${e.message} — tunggu 20 detik (coba ${coba}/3)`)
      await jeda(20000)
    }
  }
  if (!hasil) {
    console.log(`  batch ${i / B + 1}: GAGAL TOTAL — ditandai tidak diketahui`)
    for (const j of bagian) info.set(j, { ada: false, galat: 'gagal diperiksa' })
    continue
  }
  let ada = 0
  for (const [j, v] of hasil) {
    info.set(j, v?.hal ? { ada: v.ada, judul: v.hal.title, awal: String(v.hal.extract ?? '').replace(/\s+/g, ' ').slice(0, 120), dis: v.hal.pageprops?.disambiguation !== undefined } : { ada: false })
    if (v?.ada) ada++
  }
  console.log(`  batch ${i / B + 1}: ${ada}/${bagian.length} ada`)
  await jeda(3000)
}

/* konfirmasi satu-per-satu untuk yang dilaporkan HILANG */
const hilangAwal = semua.filter((j) => !info.get(j)?.ada)
console.log(`\n=== KONFIRMASI SATU PER SATU (${hilangAwal.length} judul) ===`)
for (const j of hilangAwal) {
  let hal = null
  for (let coba = 1; coba <= 3; coba++) {
    try {
      const hasil = await tanya([j])
      hal = hasil.get(j)?.hal ?? null
      if (hasil.get(j)?.ada) break
    } catch {
      await jeda(20000)
    }
  }
  const ada = Boolean(hal && hal.missing === undefined)
  console.log(`  ${ada ? 'ADA   ' : 'HILANG'}  ${j}${hal && hal.title !== j ? ` -> "${hal.title}"` : ''}`)
  if (ada) {
    info.set(j, { ada: true, judul: hal.title, awal: String(hal.extract ?? '').replace(/\s+/g, ' ').slice(0, 120), dis: hal.pageprops?.disambiguation !== undefined })
  } else if (hal) {
    info.set(j, { ada: false, judul: null, awal: '', dis: false })
  }
  await jeda(2500)
}

console.log('\n=== HASIL AKHIR ===')
const adaList = semua.filter((j) => info.get(j)?.ada)
const takList = semua.filter((j) => info.get(j)?.ada === false)
const disList = semua.filter((j) => info.get(j)?.dis)
const alihList = semua.filter((j) => info.get(j)?.ada && info.get(j)?.judul !== j)
console.log(`ADA          : ${adaList.length}/${semua.length}`)
console.log(`TIDAK ADA    : ${takList.length} -> ${takList.join(', ')}`)
console.log(`DISAMBIGUASI : ${disList.length} -> ${disList.join(', ')}`)
console.log(`DIALIHKAN    : ${alihList.length} -> ${alihList.map((j) => `${j}=>"${info.get(j).judul}"`).join(', ')}`)

await writeFile(
  '/home/ellbaayy/.hermes/cache/scratch/verifikasi-definitif.json',
  JSON.stringify(Object.fromEntries(semua.map((j) => [j, info.get(j) ?? null])), null, 1),
)
console.log('tersimpan: /home/ellbaayy/.hermes/cache/scratch/verifikasi-definitif.json')
