#!/usr/bin/env node
/**
 * Uji lapisan rute perjalanan — TANPA jaringan.
 *
 * Yang dijaga:
 *   1. Pemetaan moda -> costing Valhalla BENAR, dan tiga moda memakai tiga
 *      costing BERBEDA. OSRM demo sengaja tidak dipakai: diukur 4 Nov 2026 ia
 *      mengembalikan rute identik untuk driving/foot/bike/walking/motorcycle
 *      (4,32 km / 6,4 menit semuanya), jadi mengganti moda hanya akan mengganti
 *      ikon — persis yang dilarang.
 *   2. Decoder polyline6 menghasilkan angka yang masuk akal.
 *   3. Instruksi Valhalla diterjemahkan ke bahasa Indonesia, dan nama jalan
 *      DIPERTAHANKAN.
 *   4. Tautan Google Maps hanya dibuat dari koordinat yang sah.
 *   5. Balasan rusak menjadi null, bukan melempar.
 */

import {
  COSTING,
  uraiPolyline,
  terjemahkanManuver,
  tautanGoogleMaps,
  normalkanRute,
} from './app/server/rute-perjalanan.js'

let lulus = 0
let gagal = 0
const cek = (nama, syarat, catatan = '') => {
  if (syarat) {
    lulus += 1
    console.log(`  ok    ${nama}`)
  } else {
    gagal += 1
    console.log(`  GAGAL ${nama}${catatan ? ` -> ${catatan}` : ''}`)
  }
}

console.log('\n== pemetaan moda ==')
cek('jalan kaki -> pedestrian', COSTING['jalan-kaki'] === 'pedestrian')
cek('motor -> motor_scooter', COSTING.motor === 'motor_scooter')
cek('mobil -> auto', COSTING.mobil === 'auto')
cek('tepat tiga moda', Object.keys(COSTING).length === 3, Object.keys(COSTING).join(','))
cek(
  'tidak ada moda yang jatuh ke costing sama',
  new Set(Object.values(COSTING)).size === 3,
  Object.values(COSTING).join(','),
)

console.log('\n== decoder polyline ==')
// Satu titik butuh DUA nilai (lat lalu lon), jadi '??' — bukan '?'.
// '?' hanya berisi lat, dan decoder mengembalikan [] untuk masukan terpotong.
const satu = uraiPolyline('??', 6)
cek('satu titik terurai dari "??"', satu.length === 1, String(satu.length))
cek('(0,0) terbaca', satu[0]?.[0] === 0 && satu[0]?.[1] === 0, JSON.stringify(satu[0]))
cek('masukan terpotong "?" -> [] (bukan melempar)', uraiPolyline('?', 6).length === 0)
cek('string kosong -> []', Array.isArray(uraiPolyline('', 6)) && uraiPolyline('', 6).length === 0)
cek('non-string -> []', uraiPolyline(null, 6).length === 0)

const contoh = uraiPolyline('_p~iF~ps|U_ulLnnqC_mqNvxq`@', 5)
cek('contoh 3 titik terurai', contoh.length === 3, String(contoh.length))
cek(
  'titik pertama 38.5,-120.2 (presisi 5)',
  Math.abs(contoh[0][0] - 38.5) < 0.001 && Math.abs(contoh[0][1] + 120.2) < 0.001,
  JSON.stringify(contoh[0]),
)
cek(
  'semua koordinat angka wajar',
  contoh.every(([a, b]) => Math.abs(a) <= 90 && Math.abs(b) <= 180),
)
cek('presisi 6 memberi nilai berbeda dari presisi 5', uraiPolyline('_p~iF~ps|U', 6)[0][0] !== uraiPolyline('_p~iF~ps|U', 5)[0][0])

console.log('\n== terjemahan instruksi ==')
cek(
  '"Walk north ..." -> berjalan',
  /jalan/i.test(terjemahkanManuver('Walk north on the walkway.', 'pedestrian')),
  terjemahkanManuver('Walk north on the walkway.', 'pedestrian'),
)
cek(
  '"Turn left" -> belok kiri',
  /belok kiri/i.test(terjemahkanManuver('Turn left onto Jalan Medan Merdeka.', 'auto')),
  terjemahkanManuver('Turn left onto Jalan Medan Merdeka.', 'auto'),
)
cek('"Turn right" -> belok kanan', /belok kanan/i.test(terjemahkanManuver('Turn right onto Jalan A.', 'auto')))
cek('"Take the stairs" -> tangga', /tangga/i.test(terjemahkanManuver('Take the stairs.', 'pedestrian')))
cek('"Arrive at" -> tiba', /tiba/i.test(terjemahkanManuver('Arrive at your destination.', 'auto')))
cek(
  'nama jalan DIPERTAHANKAN',
  /Jalan Medan Merdeka/.test(terjemahkanManuver('Turn left onto Jalan Medan Merdeka.', 'auto')),
  terjemahkanManuver('Turn left onto Jalan Medan Merdeka.', 'auto'),
)
cek(
  'instruksi tak dikenal tetap dikembalikan (bukan dikosongkan)',
  terjemahkanManuver('Some unknown maneuver.', 'auto').length > 0,
)
cek('kosong -> string kosong', terjemahkanManuver('', 'auto') === '')

cek(
  'tidak ada kata "on" tersisa di kalimat Indonesia',
  !/\bon\b/i.test(terjemahkanManuver('Walk north on the walkway.', 'pedestrian')),
  terjemahkanManuver('Walk north on the walkway.', 'pedestrian'),
)
cek(
  'preposisi + objek sama-sama diterjemahkan',
  terjemahkanManuver('Walk north on the walkway.', 'pedestrian') ===
    'Berjalan utara di jalur pejalan kaki.',
  terjemahkanManuver('Walk north on the walkway.', 'pedestrian'),
)
cek(
  '"Turn left onto Jalan X" memakai "ke"',
  /\bke\b/.test(terjemahkanManuver('Turn left onto Jalan Medan Merdeka.', 'auto')),
  terjemahkanManuver('Turn left onto Jalan Medan Merdeka.', 'auto'),
)

cek(
  'arah mata angin diterjemahkan',
  /utara/.test(terjemahkanManuver('Continue north on Jalan A.', 'auto')),
  terjemahkanManuver('Continue north on Jalan A.', 'auto'),
)

console.log('\n== tautan Google Maps ==')
const gm = tautanGoogleMaps({
  latAsal: -6.1754,
  lonAsal: 106.8272,
  latTujuan: -6.176667,
  lonTujuan: 106.837152,
  moda: 'motor',
})
cek('domain google.com/maps', gm.startsWith('https://www.google.com/maps/dir/'), gm?.slice(0, 60))
cek('koordinat tujuan ada', gm.includes('-6.176667,106.837152'))
cek('koordinat asal ada', gm.includes('-6.1754,106.8272'))
cek('moda ikut terbawa', /3e[0-3]/.test(gm), gm.slice(-12))
cek(
  'koordinat tidak sah -> null',
  tautanGoogleMaps({ latAsal: 0, lonAsal: 0, latTujuan: 0, lonTujuan: 0, moda: 'mobil' }) === null,
)
cek(
  'tanpa asal tetap boleh (asal kosong)',
  tautanGoogleMaps({ latTujuan: -6.2, lonTujuan: 106.8, moda: 'mobil' }) !== null,
)

console.log('\n== normalisasi balasan Valhalla ==')
const contohValhalla = {
  trip: {
    summary: { length: 2.14, time: 1776 },
    legs: [
      {
        shape: '_p~iF~ps|U_ulLnnqC_mqNvxq`@',
        maneuvers: [
          { instruction: 'Walk north on the walkway.', length: 0.1, time: 70, type: 1 },
          { instruction: 'Turn left onto Jalan A.', length: 0.5, time: 300, type: 14 },
        ],
      },
    ],
  },
}
const nr = normalkanRute(contohValhalla, 'jalan-kaki')
cek('jarak km dari length', nr?.jarakKm === 2.14, String(nr?.jarakKm))
cek('waktu menit dari time', Math.round(nr?.waktuMenit) === 30, String(nr?.waktuMenit))
cek('geometri terurai jadi array', Array.isArray(nr?.geometri) && nr.geometri.length > 0)
cek('jumlah langkah ikut', nr?.langkah?.length === 2, String(nr?.langkah?.length))
cek(
  'langkah sudah Indonesia',
  /jalan|belok|tiba/i.test(nr?.langkah?.[0]?.instruksi ?? ''),
  nr?.langkah?.[0]?.instruksi,
)
cek('moda tercatat di hasil', nr?.moda === 'jalan-kaki')
cek('balasan kosong -> null', normalkanRute({}, 'mobil') === null)
cek('balasan null -> null', normalkanRute(null, 'mobil') === null)
cek('tanpa legs -> null', normalkanRute({ trip: { summary: { length: 1, time: 1 } } }, 'mobil') === null)


console.log('\n== bahasa Inggris tidak diterjemahkan ==')
cek(
  'bahasa en: instruksi apa adanya',
  terjemahkanManuver('Walk north on the walkway.', 'pedestrian', 'en') ===
    'Walk north on the walkway.',
  terjemahkanManuver('Walk north on the walkway.', 'pedestrian', 'en'),
)
cek(
  'bahasa id: tetap diterjemahkan',
  /berjalan/i.test(terjemahkanManuver('Walk north on the walkway.', 'pedestrian', 'id')),
)
cek(
  'normalkanRute en memakai instruksi asli',
  normalkanRute(
    {
      trip: {
        summary: { length: 1, time: 60 },
        legs: [
          {
            shape: '_p~iF~ps|U_ulLnnqC_mqNvxq`@',
            maneuvers: [{ instruction: 'Turn left onto Jalan A.', length: 0.1, time: 60, type: 14 }],
          },
        ],
      },
    },
    'auto',
    'en',
  )?.langkah?.[0]?.instruksi === 'Turn left onto Jalan A.',
)

console.log('')
console.log(gagal === 0 ? `SEMUA LULUS — ${lulus} pemeriksaan` : `${lulus} lulus, ${gagal} GAGAL`)
process.exit(gagal === 0 ? 0 : 1)
