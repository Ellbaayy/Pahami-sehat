import { buatSimpanan, OSRM_MODA } from './layanan.js'

/**
 * Rute perjalanan multimoda lewat Valhalla.
 *
 * ============================================================================
 * KENAPA VALHALLA, DAN KENAPA BUKAN OSRM DEMO
 * ============================================================================
 * Diukur 4 Nov 2026 dari Jakarta (Monas → RSPAD Gatot Soebroto):
 *
 *   router.project-osrm.org   driving     4.32 km / 6.4 menit
 *                             foot        4.32 km / 6.4 menit   <- SAMA
 *                             bike        4.32 km / 6.4 menit   <- SAMA
 *                             walking     4.32 km / 6.4 menit   <- SAMA
 *                             motorcycle  4.32 km / 6.4 menit   <- SAMA
 *
 * OSRM demo mengabaikan profil dan selalu memakai profil mobil. Memakainya
 * berarti mengganti ikon transportasi tanpa mengganti rutenya — persis yang
 * dilarang pada instruksi pekerjaan ini.
 *
 *   valhalla1.openstreetmap.de  auto           4.54 km / 15.4 menit
 *                               pedestrian     2.14 km / 29.6 menit  <- beda
 *                               motor_scooter  4.54 km / 17.9 menit  <- beda
 *                               bicycle        5.02 km / 18.7 menit
 *                               motorcycle     5.03 km / 16.1 menit
 *
 * ============================================================================
 * BATAS YANG DISEBUT APA ADANYA
 * ============================================================================
 *   - Peladen Valhalla publik ini untuk demo/pengujian, BUKAN SLA produksi.
 *     Alamatnya bisa diganti lewat VALHALLA_URL.
 *   - `language: "id-ID"` TIDAK didukung (diukur: instruksi tetap Inggris),
 *     jadi terjemahan dilakukan sendiri di `terjemahkanManuver` dan HANYA untuk
 *     pola yang dikenal. Kalimat yang tidak dikenal dikembalikan apa adanya —
 *     lebih baik Inggris asli daripada terjemahan karangan.
 *   - Estimasi waktu berasal dari profil kecepatan Valhalla, BUKAN lalu lintas
 *     langsung. Antarmuka wajib menyebut itu.
 */

const BASE = process.env.VALHALLA_URL || 'https://valhalla1.openstreetmap.de'
const UA =
  'PahamiSehat/1.0 (pendidikan kesehatan; +https://github.com/Ellbaayy/Pahami-sehat)'
const TIMEOUT_MS = 25_000

/**
 * Simpanan rute.
 *
 * Rute tidak berubah selama jalan dan aturannya tidak berubah, jadi menyimpan
 * 30 menit aman. Ini juga yang membuat mengganti-ganti moda bolak-balik tidak
 * menghajar peladen routing publik (yang dibiayai sumbangan).
 */
const simpananRute = buatSimpanan({
  maks: Number(process.env.RUTE_CACHE_MAKS || '120'),
  umurMs: Number(process.env.RUTE_CACHE_MS || String(30 * 60 * 1000)),
})

/**
 * Moda yang didukung -> costing Valhalla. Tiga moda, tidak lebih (YAGNI).
 *
 * Valhalla dipakai untuk SEMUA moda di sini karena ia satu-satunya penyedia
 * publik yang benar-benar membedakan ketiganya (terukur: pedestrian 2,14 km /
 * 29,6 mnt vs motor_scooter 4,54 / 17,9 vs auto 4,54 / 15,4). OSRM tersedia
 * sebagai jalur alternatif untuk mobil — lihat `ruteLewatOsrm` — dan dipakai
 * kalau `RUTE_PROVIDER=osrm`.
 */
export const COSTING = {
  'jalan-kaki': 'pedestrian',
  motor: 'motor_scooter',
  mobil: 'auto',
}

/**
 * Kemampuan OSRM — SATU sumber kebenaran, diimpor dari `layanan.js`.
 *
 * Jangan mendefinisikan ulang di sini. Versi sebelumnya punya dua daftar
 * yang saling bertentangan: `layanan.js` mengaku motor didukung lewat
 * `routed-car`, sementara berkas ini menulis `motor: null`. Kalau keduanya
 * dipakai di jalur berbeda, salah satunya akan memberi rute mobil berlabel
 * motor — dan tidak ada galat apa pun yang menandainya.
 */
export { OSRM_MODA }

/** Moda -> kode travelmode Google Maps (3e0 mobil, 3e1 sepeda, 3e2 jalan, 3e3 motor). */
const GM_MODE = { 'jalan-kaki': '2', motor: '3', mobil: '0' }

/**
 * Decoder encoded polyline (presisi 6 untuk Valhalla, 5 untuk OSRM).
 * Algoritma standar Google; tidak ada dependensi baru.
 *
 * Mengembalikan array [lat, lon] — urutan itu yang dipakai Leaflet
 * (`polyline` menerima [lat, lon]), bukan [lon, lat].
 */
export function uraiPolyline(str, presisi = 6) {
  if (!str || typeof str !== 'string') return []
  const faktor = 10 ** presisi
  const hasil = []
  let i = 0
  let lat = 0
  let lon = 0

  while (i < str.length) {
    let jumlah = 0
    let geser = 0
    let b
    do {
      if (i >= str.length) return hasil
      b = str.charCodeAt(i++) - 63
      jumlah |= (b & 0x1f) << geser
      geser += 5
    } while (b >= 0x20)
    lat += jumlah & 1 ? ~(jumlah >> 1) : jumlah >> 1

    jumlah = 0
    geser = 0
    do {
      if (i >= str.length) return hasil
      b = str.charCodeAt(i++) - 63
      jumlah |= (b & 0x1f) << geser
      geser += 5
    } while (b >= 0x20)
    lon += jumlah & 1 ? ~(jumlah >> 1) : jumlah >> 1

    hasil.push([lat / faktor, lon / faktor])
  }
  return hasil
}

/**
 * Terjemahkan satu instruksi Valhalla ke bahasa Indonesia.
 *
 * Hanya pola yang dikenal yang diterjemahkan; sisanya dikembalikan apa adanya.
 * Nama jalan DIPERTAHANKAN karena itu satu-satunya bagian yang tidak boleh
 * berubah — salah menyebut nama jalan lebih berbahaya daripada menyebutnya
 * dalam bahasa Inggris.
 */
export function terjemahkanManuver(teks, moda = 'mobil', bahasa = 'id') {
  let keluaran = String(teks ?? '').trim()
  if (!keluaran) return ''
  /*
   * Valhalla memberi instruksi bahasa Inggris asli. Untuk antarmuka Inggris,
   * instruksi itu DIPAKAI APA ADANYA — menerjemahkan ke Indonesia lalu
   * menampilkannya di antarmuka Inggris menghasilkan kalimat campur bahasa
   * (terbukti di peramban: "Starting point: your GPS location" diikuti
   * "Berkendara selatan.").
   */
  if (bahasa !== 'id') return keluaran

  const naikKendaraan = moda === 'mobil' || moda === 'motor'

  const aturan = [
    [/^walk\b/i, 'Berjalan'],
    [/^drive\b/i, naikKendaraan ? 'Berkendara' : 'Berjalan'],
    [/^ride\b/i, 'Berkendara'],
    [/^turn sharp left\b/i, 'Belok tajam ke kiri'],
    [/^turn sharp right\b/i, 'Belok tajam ke kanan'],
    [/^turn slight left\b/i, 'Agak ke kiri'],
    [/^turn slight right\b/i, 'Agak ke kanan'],
    [/^turn left\b/i, 'Belok kiri'],
    [/^turn right\b/i, 'Belok kanan'],
    [/^continue\b/i, 'Lanjutkan'],
    [/^bear left\b/i, 'Ambil lajur kiri'],
    [/^bear right\b/i, 'Ambil lajur kanan'],
    [/^take the stairs\b/i, 'Naiki tangga'],
    [/^take the elevator\b/i, 'Gunakan lift'],
    [/^take the escalator\b/i, 'Gunakan eskalator'],
    [/^arrive at\b/i, 'Tiba di'],
    [/^you have arrived\b/i, 'Anda telah tiba'],
    [/^merge\b/i, 'Gabung ke jalur'],
    [/^make a u-turn\b/i, 'Putar balik'],
    [/^enter the roundabout\b/i, 'Masuk bundaran'],
    [/^exit the roundabout\b/i, 'Keluar dari bundaran'],
    [/^start\b/i, 'Mulai'],
  ]

  for (const [pola, ganti] of aturan) {
    if (pola.test(keluaran)) {
      keluaran = keluaran.replace(pola, ganti)
      break
    }
  }

  // Frase penghubung. URUTAN PENTING, dan sudah dua kali salah di sini:
  //   1. Mengganti "the walkway" lebih dulu membuat "on the walkway" menjadi
  //      "on jalur pejalan kaki" — kata "on" tertinggal.
  //   2. Mengganti "on the" lebih dulu menghabiskan kata "the", sehingga
  //      "the walkway" tidak cocok lagi dan hasilnya "di walkway".
  // Obatnya: preposisi dulu, lalu KATA BENDA TANPA ARTIKEL (bukan "the X").
  keluaran = keluaran
    .replace(/\bonto the\b/gi, 'ke')
    .replace(/\bonto\b/gi, 'ke')
    .replace(/\bon the\b/gi, 'di')
    .replace(/\balong the\b/gi, 'sepanjang')
    .replace(/\bat the\b/gi, 'di')
    .replace(/\bwalkway\b/gi, 'jalur pejalan kaki')
    .replace(/\bsidewalk\b/gi, 'trotoar')
    .replace(/\bfootway\b/gi, 'jalur pejalan kaki')
    .replace(/\bpath\b/gi, 'jalur')
    .replace(/\byour destination\b/gi, 'tujuan Anda')
    .replace(/\bdestination\b/gi, 'tujuan')
    .replace(/\bnorth\b/gi, 'utara')
    .replace(/\bsouth\b/gi, 'selatan')
    .replace(/\beast\b/gi, 'timur')
    .replace(/\bwest\b/gi, 'barat')

  return keluaran
    .replace(/\s+/g, ' ')
    .replace(/\s+\./g, '.')
    .trim()
}

/** Koordinat sah untuk dipakai di tautan luar. */
function koordinatSah(lat, lon) {
  const a = Number(lat)
  const b = Number(lon)
  if (!Number.isFinite(a) || !Number.isFinite(b)) return false
  if (Math.abs(a) > 90 || Math.abs(b) > 180) return false
  return !(a === 0 && b === 0)
}

/**
 * Tautan Google Maps; null bila koordinat tujuan tidak sah.
 *
 * Asal boleh kosong (Google Maps akan memakai lokasi perangkat pengguna),
 * tetapi TUJUAN wajib sah — tautan dengan tujuan 0,0 akan membuka tempat yang
 * salah di tengah laut.
 */
export function tautanGoogleMaps({ latAsal, lonAsal, latTujuan, lonTujuan, moda = 'mobil' } = {}) {
  if (!koordinatSah(latTujuan, lonTujuan)) return null
  const tujuan = `${Number(latTujuan)},${Number(lonTujuan)}`
  const asal = koordinatSah(latAsal, lonAsal) ? `${Number(latAsal)},${Number(lonAsal)}` : ''
  const travel = GM_MODE[moda] ?? '0'
  return `https://www.google.com/maps/dir/${asal}/${tujuan}/data=!4m2!4m1!3e${travel}`
}

/**
 * Balasan Valhalla -> bentuk seragam untuk antarmuka. Null bila rusak.
 *
 * TIDAK melempar: pemanggil memperlakukan null sebagai "rute belum bisa
 * dihitung", bukan sebagai kerusakan aplikasi.
 */
export function normalkanRute(j, moda, bahasa = 'id') {
  try {
    const trip = j?.trip
    const leg = trip?.legs?.[0]
    const sum = trip?.summary
    if (!leg || !sum) return null

    const panjang = Number(sum.length)
    const waktu = Number(sum.time)
    if (!Number.isFinite(panjang) || !Number.isFinite(waktu)) return null

    const langkah = (leg.maneuvers ?? [])
      .filter((m) => m && typeof m.instruction === 'string')
      .map((m) => ({
        instruksi: terjemahkanManuver(m.instruction, moda, bahasa),
        jarakM: Math.round(Number(m.length ?? 0) * 1000),
        waktuDetik: Math.round(Number(m.time ?? 0)),
        tipe: Number(m.type ?? 0),
      }))
      .filter((l) => l.instruksi.length > 0)

    const geometri = uraiPolyline(leg.shape, 6)
    if (!geometri.length) return null

    return {
      moda,
      jarakKm: panjang,
      waktuMenit: waktu / 60,
      geometri,
      langkah,
    }
  } catch {
    return null
  }
}

/**
 * Ambil rute.
 *
 * PROVIDER DIPILIH BERDASARKAN DUKUNGAN NYATA, BUKAN SELERA:
 *
 *   mobil        -> OSRM (routed-car) kalau RUTE_PROVIDER=osrm, jika tidak Valhalla
 *   jalan-kaki   -> Valhalla (pedestrian)
 *   motor        -> Valhalla (motor_scooter) — OSRM publik tidak punya profil ini
 *
 * Valhalla selalu menjadi cadangan: kalau OSRM gagal, rute tetap ada. Yang
 * TIDAK pernah dilakukan adalah memakai rute mobil lalu menyebutnya motor
 * atau jalan kaki — itu akan lulus tampilan tetapi salah isi.
 *
 * Melempar HANYA dengan `code` yang bisa ditampilkan antarmuka:
 *   'moda'          -> moda tidak dikenal (galat pemanggil, 400)
 *   'sumber_gagal'  -> layanan routing gagal / balasan tak terbaca (503)
 */
export async function ambilRute({ latAsal, lonAsal, latTujuan, lonTujuan, moda = 'mobil', bahasa = 'id' }) {
  const costing = COSTING[moda]
  if (!costing) {
    const e = new Error('moda tidak dikenal')
    e.code = 'moda'
    throw e
  }

  const provider = String(process.env.RUTE_PROVIDER ?? 'valhalla').toLowerCase()
  const osrm = OSRM_MODA[moda]

  /*
   * Simpanan rute.
   *
   * Kunci memuat kedua titik (dibulatkan 5 desimal ~1 m) dan modanya: rute
   * Monas->RSPAD dengan mobil TIDAK sama dengan Monas->RSPAD jalan kaki, jadi
   * moda wajib ikut jadi kunci. Tanpa pembulatan, angka desimal yang
   * bergetar sedikit (sisa geseran peta) akan membuat simpanan tidak pernah
   * kena.
   */
  const kunci =
    `${moda}|${Number(latAsal).toFixed(5)},${Number(lonAsal).toFixed(5)}|` +
    `${Number(latTujuan).toFixed(5)},${Number(lonTujuan).toFixed(5)}|${bahasa}`
  const tersimpan = simpananRute.ambil(kunci)
  if (tersimpan) return { ...tersimpan, dariSimpanan: true }

  /*
   * OSRM hanya dipakai kalau (a) moda itu benar-benar didukungnya dan
   * (b) providernya dipilih. Kalau tidak, jalur Valhalla yang diambil.
   */
  if (provider === 'osrm' && osrm) {
    try {
      const r = await ruteLewatOsrm({ latAsal, lonAsal, latTujuan, lonTujuan, moda, bahasa, osrm })
      simpananRute.simpan(kunci, r)
      return r
    } catch {
      // Sengaja tidak diteruskan: Valhalla di bawah adalah cadangan yang sah,
      // dan pengguna lebih butuh rute daripada pesan galat penyedia.
    }
  }

  const r = await ruteLewatValhalla({ latAsal, lonAsal, latTujuan, lonTujuan, moda, bahasa, costing })
  simpananRute.simpan(kunci, r)
  return r
}

/**
 * Rute lewat OSRM.
 *
 * `overview=full&geometries=geojson` dipakai supaya garis rute datang sebagai
 * GeoJSON — tidak perlu decoder polyline, dan urutannya sudah [lon, lat] yang
 * tinggal dibalik untuk Leaflet.
 */
async function ruteLewatOsrm({ latAsal, lonAsal, latTujuan, lonTujuan, moda, bahasa, osrm }) {
  const koor = `${Number(lonAsal)},${Number(latAsal)};${Number(lonTujuan)},${Number(latTujuan)}`
  // Perhatikan: URUTANNYA lon,lat — OSRM memakai urutan yang sama dengan
  // GeoJSON, bukan lat,lon seperti Valhalla. Menukarnya menghasilkan rute
  // ke Somalia.
  const url =
    `${osrm.host}/route/v1/${osrm.profil}/${koor}` +
    `?overview=full&geometries=geojson&steps=true&alternatives=false`

  const res = await fetch(url, {
    headers: { 'User-Agent': UA, Accept: 'application/json' },
    signal: AbortSignal.timeout(TIMEOUT_MS),
  })
  if (!res.ok) throw new Error(`OSRM HTTP ${res.status}`)
  const j = await res.json().catch(() => null)
  if (j?.code !== 'Ok' || !j.routes?.length) throw new Error(`OSRM: ${j?.code ?? 'tanpa rute'}`)

  const r = j.routes[0]
  const langkah = (r.legs?.[0]?.steps ?? []).map((s) => ({
    instruksi: terjemahkanManuver(kalimatOsrm(s), moda, bahasa),
    // Nama kunci DISAMAKAN dengan bentuk Valhalla (`jarakM`/`waktuDetik`),
    // karena `langkah` dari kedua penyedia dibaca oleh antarmuka yang sama.
    // Sebelumnya di sini `jarak`/`waktu`, dan itu membuat kolom jarak per
    // langkah kosong saat rute datang dari OSRM.
    jarakM: Math.round(Number(s.distance ?? 0)),
    waktuDetik: Math.round(Number(s.duration ?? 0)),
    jenis: s.maneuver?.type ?? null,
  }))

  return {
    moda,
    /*
     * Nama kunci mengikuti bentuk Valhalla (`jarakKm`, `waktuMenit`,
     * `geometri`). Dua penyedia yang mengembalikan bentuk berbeda dari satu
     * fungsi adalah sumber bug yang tidak terlihat: `/api/rute` hanya
     * menyebar `...rute`, jadi kunci yang salah nama tidak error — ia hanya
     * hilang, dan antarmuka menampilkan "None" tanpa keluhan.
     */
    jarakKm: Number((Number(r.distance ?? 0) / 1000).toFixed(3)),
    waktuMenit: Number(Number(r.duration ?? 0)) / 60,
    // Garis rute: [lon, lat] -> [lat, lon] untuk Leaflet.
    geometri: (r.geometry?.coordinates ?? []).map(([lon, lat]) => [lat, lon]),
    langkah,
    sumber: 'OSRM',
    penyedia: osrm.host,
  }
}

/**
 * Susun satu instruksi dari langkah OSRM.
 *
 * OSRM memberi `maneuver.type` + `name` terpisah, bukan kalimat. Digabung di
 * sini supaya bentuknya sama dengan Valhalla, sehingga `terjemahkanManuver`
 * hanya perlu menangani satu bentuk.
 */
const ARAH_OSRM = {
  depart: 'Start',
  arrive: 'Arrive at destination',
  turn: 'Turn',
  'new name': 'Continue',
  merge: 'Merge',
  'on ramp': 'Take the ramp',
  'off ramp': 'Take the exit',
  fork: 'Keep',
  'end of road': 'Turn',
  continue: 'Continue',
  roundabout: 'At the roundabout, take the exit',
  rotary: 'At the roundabout, take the exit',
  'roundabout turn': 'At the roundabout, turn',
  notification: 'Continue',
}

function kalimatOsrm(s) {
  const tipe = s.maneuver?.type ?? 'continue'
  const dasar = ARAH_OSRM[tipe] ?? 'Continue'
  const arah = s.maneuver?.modifier ? ` ${s.maneuver.modifier}` : ''
  const nama = s.name ? ` onto ${s.name}` : ''
  return `${dasar}${arah}${nama}`
}

/** Rute lewat Valhalla — jalur utama untuk semua moda, dan cadangan OSRM. */
async function ruteLewatValhalla({ latAsal, lonAsal, latTujuan, lonTujuan, moda, bahasa, costing }) {
  const isi = {
    locations: [
      { lat: Number(latAsal), lon: Number(lonAsal) },
      { lat: Number(latTujuan), lon: Number(lonTujuan) },
    ],
    costing,
    // `id-ID` tidak didukung (diukur), jadi bahasa Inggris dipakai dan
    // terjemahan dilakukan sendiri. Menulis id-ID hanya menyamarkan masalah.
    directions_options: { units: 'kilometers', language: 'en-US' },
  }

  let res
  try {
    res = await fetch(`${BASE}/route`, {
      method: 'POST',
      headers: {
        'User-Agent': UA,
        'Content-Type': 'application/json',
        Accept: 'application/json',
      },
      body: JSON.stringify(isi),
      signal: AbortSignal.timeout(TIMEOUT_MS),
    })
  } catch (e) {
    const g = new Error(`tidak dapat menghubungi layanan rute: ${e?.message ?? e}`)
    g.code = 'sumber_gagal'
    throw g
  }

  if (!res.ok) {
    const g = new Error(`layanan rute membalas HTTP ${res.status}`)
    g.code = 'sumber_gagal'
    throw g
  }

  const j = await res.json().catch(() => null)
  const rute = normalkanRute(j, moda, bahasa)
  if (!rute) {
    const g = new Error('balasan rute tidak dapat dibaca')
    g.code = 'sumber_gagal'
    throw g
  }
  return { ...rute, sumber: 'Valhalla', penyedia: BASE }
}
