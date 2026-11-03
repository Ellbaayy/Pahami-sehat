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

/** Moda yang didukung -> costing Valhalla. Tiga moda, tidak lebih (YAGNI). */
export const COSTING = {
  'jalan-kaki': 'pedestrian',
  motor: 'motor_scooter',
  mobil: 'auto',
}

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
 * Ambil rute dari Valhalla.
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
  return rute
}
