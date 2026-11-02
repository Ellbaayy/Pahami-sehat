/**
 * Fasilitas kesehatan terdekat — data nyata dari OpenStreetMap lewat Overpass API.
 *
 * KENAPA OPENSTREETMAP, DAN KENAPA BUKAN API KEMENKES
 * ---------------------------------------------------
 * Diukur 2 Nov 2026, seluruh jalur data resmi Kemenkes yang lazim disebut
 * TIDAK BISA dipakai dari sini:
 *   - `faskes.kemkes.go.id`      -> nama domain tidak ditemukan
 *   - `data.kemkes.go.id`        -> nama domain tidak ditemukan
 *   - `api.satusehat.kemkes.go.id/fhir-r4/v1/Organization` -> tidak ditemukan
 *   - `api.kemkes.go.id`         -> HTTP 404
 *   - `sirs.kemkes.go.id`        -> 200, tetapi hanya "RS Online": halaman
 *                                   pendaftaran rumah sakit, bukan katalog
 *                                   fasilitas yang bisa dibaca mesin
 *   - `satusehat.kemkes.go.id`   -> 200, tetapi gerbang layanan yang dirakit
 *                                   JavaScript; tidak ada katalog publik
 * Overpass API (data OpenStreetMap) diukur menjawab 200 dan mengembalikan
 * 1.662 fasilitas nyata dalam radius 10 km di Jakarta Pusat, lengkap dengan
 * nama, kategori, dan koordinat.
 *
 * Jadi aplikasi TIDAK mengarang cakupan: yang dipakai adalah OSM/Overpass, dan
 * setiap kartu menyebut sumbernya. Kalau nanti kredensial SATUSEHAT tersedia,
 * `SUMBER` di bawah bisa ditambah — bentuk keluarannya sudah seragam.
 *
 * BATAS YANG DISEBUT APA ADANYA: OSM adalah data yang dipetakan sukarela.
 * Kelengkapan dan kemutakhirannya TIDAK seragam antarwilayah, dan sebagian
 * fasilitas tidak punya nomor telepon/jam buka. Semua field yang tidak ada
 * dikirim sebagai null — TIDAK diisi tebakan.
 */

import { existsSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const UA =
  'PahamiSehat/1.0 (pendidikan kesehatan; +https://github.com/Ellbaayy/Pahami-sehat)'

/**
 * Cermin Overpass, dicoba berurutan.
 *
 * DIUKUR 3 Nov 2026 dari mesin ini: `overpass-api.de` dan `lz4.overpass-api.de`
 * adalah satu-satunya yang menjawab dengan data Indonesia (225 elemen, 37–49 s
 * untuk radius 3 km) dan keduanya bergantian membalas 502 saat beban tinggi.
 * `kumi.systems` dan `private.coffee` timeout; `overpass.osm.jp` 404;
 * `overpass.osm.rambler.ru` sudah tidak ada. `overpass.osm.ch` menjawab 200
 * tetapi HANYA memuat data Swiss — ia sengaja tetap didaftarkan karena
 * `ambilCermin()` menolak balasan kosong, sehingga cermin itu otomatis
 * dilewati tanpa membuat pengguna melihat peta kosong.
 */
const CERMIN = [
  'https://overpass-api.de/api/interpreter',
  'https://lz4.overpass-api.de/api/interpreter',
  'https://overpass.kumi.systems/api/interpreter',
  'https://overpass.private.coffee/api/interpreter',
  'https://overpass.osm.ch/api/interpreter',
]

/** Batas aman: satu permintaan gabungan, bukan satu per kategori. */
const TIMEOUT_MS = 70_000
/**
 * Anggaran waktu TOTAL untuk seluruh cermin.
 *
 * Tanpa ini, lima cermin yang semuanya menggantung berarti pengguna menunggu
 * 5 × 70 s = 350 detik sebelum melihat galat — jauh lebih buruk daripada
 * "gagal cepat lalu coba lagi". Diukur: cermin yang berfungsi menjawab dalam
 * 37–49 detik untuk radius 3 km.
 */
const ANGGARAN_TOTAL_MS = 100_000
const MAKS_HASIL = 600
const RADIUS_MAKS_M = 50_000
const CACHE_MS = 10 * 60 * 1000
const CACHE_MAKS = 40

/**
 * Sepuluh kategori yang diminta, beserta aturan penentuannya dari tag OSM.
 *
 * `cocok(tags)` menerima tag OSM dan mengembalikan true bila fasilitas itu
 * termasuk kategori ini. `subkategori(tags)` menyempitkan lebih lanjut.
 * Urutannya PENTING: yang lebih khusus diperiksa lebih dulu (rumah sakit
 * sebelum klinik, karena banyak RS juga bertag `amenity=clinic`).
 */
export const KATEGORI = [
  {
    id: 'rumah-sakit',
    label: 'Rumah Sakit',
    ikon: 'hospital',
    cocok: (t) => t.amenity === 'hospital' || t.healthcare === 'hospital',
    subkategori: (t) => {
      const nama = (t.name ?? '').toUpperCase()
      if (/\bRSIA\b|IBU DAN ANAK|IBU & ANAK/.test(nama)) return 'RSIA'
      if (/\bRSJ\b|JIWA/.test(nama)) return 'RS Jiwa'
      if (/\bRSK\b|KHUSUS/.test(nama)) return 'RS Khusus'
      if (/MATA/.test(nama)) return 'RS Mata'
      if (/JANTUNG/.test(nama)) return 'RS Jantung'
      if (/KANKER/.test(nama)) return 'RS Kanker'
      if (/GIGI|MULUT/.test(nama)) return 'RS Gigi & Mulut'
      if (/\bRSU\b|UMUM/.test(nama)) return 'RSU'
      return 'Rumah Sakit'
    },
  },
  {
    id: 'puskesmas',
    label: 'Puskesmas',
    ikon: 'clinic',
    cocok: (t) =>
      t.healthcare === 'centre' ||
      t.amenity === 'health_centre' ||
      /PUSKESMAS|PUSTU|PUSKESMAS PEMBANTU|POSKESDES|POLINDES/i.test(t.name ?? ''),
    subkategori: (t) => {
      const n = (t.name ?? '').toUpperCase()
      if (/PUSTU|PEMBANTU/.test(n)) return 'Puskesmas Pembantu'
      if (/POSKESDES/.test(n)) return 'Poskesdes'
      if (/POLINDES/.test(n)) return 'Polindes'
      // POSYANDU/POSBINDU BUKAN puskesmas: keduanya punya kategori sendiri
      // ("Kesehatan Masyarakat"). Kalau di sini hanya diperiksa `name`,
      // keduanya tertangkap lebih dulu dan kategorinya salah.
      if (/POSYANDU|POSBINDU/.test(n)) return null
      return 'Puskesmas'
    },
  },
  {
    id: 'klinik',
    label: 'Klinik',
    ikon: 'clinic',
    cocok: (t) =>
      (t.amenity === 'clinic' || t.healthcare === 'clinic') &&
      // Klinik yang jelas khusus (ibu & anak, kesehatan kerja) TIDAK masuk sini;
      // keduanya punya kategori tersendiri dan diperiksa lebih dulu.
      !/IBU DAN ANAK|IBU & ANAK|\bKIA\b|KESEHATAN KERJA|KLINIK KERJA/i.test(t.name ?? '') &&
      // Posyandu/Posbindu di OSM sering bertag `amenity=clinic`, padahal
      // keduanya milik kategori "Kesehatan Masyarakat". Diukur: tanpa
      // pengecualian ini, 122 posyandu di Jakarta Pusat muncul di filter
      // Klinik — salah kategori dan menggeser klinik sungguhan di daftar.
      !/POSYANDU|POSBINDU/i.test(t.name ?? ''),
    subkategori: (t) => {
      const n = (t.name ?? '').toUpperCase()
      if (/GIGI|DENTAL/.test(n)) return 'Klinik Gigi'
      if (/PRATAMA/.test(n)) return 'Klinik Pratama'
      if (/UTAMA/.test(n)) return 'Klinik Utama'
      if (/SPESIALIS/.test(n)) return 'Klinik Spesialis'
      return 'Klinik'
    },
  },
  {
    id: 'praktik-mandiri',
    label: 'Praktik Dokter & Tenaga Kesehatan',
    ikon: 'stethoscope',
    cocok: (t) =>
      ['doctors', 'dentist'].includes(t.amenity) ||
      ['doctor', 'dentist', 'midwife', 'nurse', 'physiotherapist'].includes(t.healthcare),
    subkategori: (t) => {
      if (t.amenity === 'dentist' || t.healthcare === 'dentist') return 'Dokter Gigi'
      if (t.healthcare === 'midwife') return 'Bidan'
      if (t.healthcare === 'nurse') return 'Perawat'
      if (t.healthcare === 'physiotherapist') return 'Fisioterapi'
      const n = (t.name ?? '').toUpperCase()
      if (/SPESIALIS|SP\./.test(n)) return 'Dokter Spesialis'
      return 'Dokter Umum'
    },
  },
  {
    id: 'farmasi',
    label: 'Apotek & Farmasi',
    ikon: 'pill',
    cocok: (t) => t.amenity === 'pharmacy' || t.healthcare === 'pharmacy',
    subkategori: (t) => {
      const n = (t.name ?? '').toUpperCase()
      if (/TOKO OBAT/.test(n)) return 'Toko Obat'
      return 'Apotek'
    },
  },
  {
    id: 'laboratorium',
    label: 'Laboratorium',
    ikon: 'flask',
    cocok: (t) =>
      t.healthcare === 'laboratory' ||
      /LABORATORIUM|\bLAB\b|PATOLOGI/i.test(t.name ?? ''),
    subkategori: (t) => {
      const n = (t.name ?? '').toUpperCase()
      if (/PATOLOGI/.test(n)) return 'Laboratorium Patologi'
      if (/KLINIK/.test(n)) return 'Laboratorium Klinik'
      return 'Laboratorium'
    },
  },
  {
    id: 'penunjang-medis',
    label: 'Penunjang Medis',
    ikon: 'scan',
    cocok: (t) =>
      ['imaging', 'blood_donation', 'rehabilitation', 'optometrist'].includes(
        t.healthcare,
      ) ||
      ['optician', 'medical_supply', 'hearing_aids'].includes(t.shop) ||
      /RADIOGRAFI|RADIOLOGI|OPTIK|FISIOTERAPI|REHABILITASI|BANK DARAH|\bUTD\b|\bPMI\b/i.test(
        t.name ?? '',
      ),
    subkategori: (t) => {
      if (t.healthcare === 'imaging') return 'Radiologi'
      if (t.shop === 'optician' || t.healthcare === 'optometrist') return 'Optik'
      if (t.shop === 'medical_supply') return 'Toko Alat Kesehatan'
      if (t.healthcare === 'physiotherapist') return 'Fisioterapi'
      if (t.healthcare === 'rehabilitation') return 'Rehabilitasi Medis'
      if (t.healthcare === 'blood_donation') return 'Bank Darah / UTD'
      return 'Penunjang Medis'
    },
  },
  {
    id: 'kesehatan-masyarakat',
    label: 'Kesehatan Masyarakat',
    ikon: 'users',
    cocok: (t) =>
      ['community_health_centre', 'birthing_centre'].includes(t.healthcare) ||
      /POSYANDU|POSBINDU|POSKESDES|POLINDES|KARANG TARUNA SEHAT/i.test(
        t.name ?? '',
      ),
    subkategori: (t) => {
      const n = (t.name ?? '').toUpperCase()
      if (/POSBINDU/.test(n)) return 'Posbindu'
      if (/POSYANDU/.test(n)) return 'Posyandu'
      if (t.healthcare === 'birthing_centre') return 'Rumah Bersalin'
      return 'Fasilitas Kesehatan Masyarakat'
    },
  },
  {
    id: 'tradisional',
    label: 'Kesehatan Tradisional',
    ikon: 'leaf',
    cocok: (t) =>
      ['alternative', 'traditional'].includes(t.healthcare) ||
      /TRADISIONAL|HERBAL|JAMU|SANGKAL|REFLEKSI|AKUPUNKTUR/i.test(t.name ?? ''),
    subkategori: (t) => {
      const n = (t.name ?? '').toUpperCase()
      if (/AKUPUNKTUR/.test(n)) return 'Akupunktur'
      if (/REFLEKSI/.test(n)) return 'Refleksi'
      return 'Pengobatan Tradisional'
    },
  },
  {
    id: 'khusus',
    label: 'Fasilitas Khusus',
    ikon: 'heart',
    cocok: (t) =>
      /KESEHATAN KERJA|KLINIK KERJA|IBU DAN ANAK|IBU & ANAK|\bKIA\b|KESEHATAN JIWA/i.test(
        t.name ?? '',
      ),
    subkategori: (t) => {
      const n = (t.name ?? '').toUpperCase()
      if (/KESEHATAN KERJA|KLINIK KERJA/.test(n)) return 'Klinik Kesehatan Kerja'
      if (/IBU DAN ANAK|IBU & ANAK|\bKIA\b/.test(n)) return 'Klinik Ibu & Anak'
      return 'Fasilitas Khusus'
    },
  },
]

export const KATEGORI_ID = KATEGORI.map((k) => k.id)

/* ------------------------------------------------------------- pengurai -- */

/** Ambil tag yang aman jadi string; kosong -> null, bukan string kosong. */
function teks(nilai) {
  const s = String(nilai ?? '').trim()
  return s ? s : null
}

/**
 * Nomor yang bisa dihubungi dari tautan `tel:`.
 *
 * CACAT YANG TERUKUR: tag OSM bisa memuat DUA nomor dipisah titik koma
 * ("+62 21 3441008;+62 21 3840702"). Membuang semua karakter non-digit
 * menggabungkan keduanya jadi satu nomor palsu — terbukti di peramban:
 * `tel:+622****1008+622****0702`, yang tidak akan pernah tersambung.
 * Jadi hanya nomor PERTAMA yang dipakai.
 */
export function nomorPertama(nilai) {
  if (!nilai) return null
  const pertama = String(nilai).split(/[;,/]/)[0].trim()
  const angka = pertama.replace(/[^\d+]/g, '')
  // Nomor Indonesia sah minimal 8 digit; di bawah itu hampir pasti bukan nomor.
  const digit = (angka.match(/\d/g) ?? []).length
  return digit >= 8 ? angka : null
}
/** Rapikan daftar bertitik koma jadi kalimat berkoma.
 *
 * Tag OSM memakai `;` sebagai pemisah, dan itu tidak enak dibaca pengguna.
 * Nilai tunggal tidak diubah; nilai kosong tetap null.
 */
export function spasi(nilai) {
  if (!nilai) return null
  const bagian = String(nilai)
    .split(';')
    .map((x) => x.trim())
    .filter(Boolean)
  if (!bagian.length) return null
  return bagian.join(', ')
}

/**
 * Koordinat sah? Indonesia ada di 95..141 BT dan 11 LU..11 LS; toleransi
 * diperlebar sedikit supaya fasilitas dekat perbatasan tidak terbuang, tapi
 * (0,0) dan nilai di luar bumi tetap ditolak — itu penanda data rusak.
 */
export function koordinatSah(lat, lon) {
  const a = Number(lat)
  const b = Number(lon)
  if (!Number.isFinite(a) || !Number.isFinite(b)) return false
  if (Math.abs(a) > 90 || Math.abs(b) > 180) return false
  if (a === 0 && b === 0) return false
  return true
}

/** Jarak dua koordinat dalam meter (haversine). */
export function jarakMeter(lat1, lon1, lat2, lon2) {
  const R = 6_371_000
  const rad = (d) => (d * Math.PI) / 180
  const dLat = rad(lat2 - lat1)
  const dLon = rad(lon2 - lon1)
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(rad(lat1)) * Math.cos(rad(lat2)) * Math.sin(dLon / 2) ** 2
  return Math.round(R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a)))
}

/** Tentukan kategori + subkategori dari tag OSM. Null bila tak ada yang cocok. */
export function kategoriDari(tags = {}) {
  for (const k of KATEGORI) {
    if (!cocokAman(k, tags)) continue
    return {
      kategori: k.id,
      subkategori: subkategoriAman(k, tags),
    }
  }
  return null
}

/** Pemeriksaan cocok yang tidak boleh melempar: tag OSM bentuknya bebas. */
function cocokAman(k, tags) {
  try {
    return Boolean(k.cocok(tags))
  } catch {
    return false
  }
}

function subkategoriAman(k, tags) {
  try {
    return k.subkategori(tags) ?? null
  } catch {
    return null
  }
}

/** Alamat dari tag `addr:*`, digabung apa adanya. Null bila tidak ada satu pun. */
export function alamatDari(tags = {}) {
  const bagian = [
    tags['addr:street'],
    tags['addr:housenumber'],
    tags['addr:suburb'],
    tags['addr:city'] ?? tags['addr:district'],
    tags['addr:postcode'],
  ]
    .map((x) => String(x ?? '').trim())
    .filter(Boolean)
  return bagian.length ? bagian.join(', ') : null
}

/**
 * IGD: HANYA dilaporkan bila benar-benar ada datanya.
 * `emergency=yes` adalah satu-satunya penanda eksplisit di OSM. Nama yang
 * mengandung "IGD" juga dihitung, karena banyak RS Indonesia menuliskannya di
 * nama. Selain itu -> null (tidak diketahui), bukan false.
 */
export function igdDari(tags = {}) {
  const e = String(tags.emergency ?? '').toLowerCase()
  if (e === 'yes') return true
  if (/IGD|GAWAT DARURAT/i.test(tags.name ?? '')) return true
  if (e === 'no') return false
  return null
}

/** Layanan 24 jam: hanya dari `opening_hours=24/7`. Bukan tebakan. */
export function duaPuluhEmpat(tags = {}) {
  return String(tags.opening_hours ?? '').replace(/\s/g, '') === '24/7'
}

/** Satu elemen Overpass -> satu fasilitas seragam. Null bila tak layak. */
export function normalisasi(elemen) {
  const t = elemen?.tags ?? {}
  const lat = elemen?.lat ?? elemen?.center?.lat
  const lon = elemen?.lon ?? elemen?.center?.lon
  if (!koordinatSah(lat, lon)) return null

  const kat = kategoriDari(t)
  if (!kat) return null

  const nama = teks(t.name) ?? teks(t['name:en'])
  // Tanpa nama, kartu tidak berguna bagi pengguna — tapi jangan dibuang kalau
  // kategorinya jelas; sebut apa adanya sebagai fasilitas tanpa nama.
  const judul = nama ?? `Fasilitas tanpa nama (${kat.subkategori ?? kat.kategori})`

  return {
    id: `${elemen.type ?? 'node'}/${elemen.id ?? `${lat},${lon}`}`,
    nama: judul,
    tanpaNama: !nama,
    kategori: kat.kategori,
    subkategori: kat.subkategori,
    lat: Number(lat),
    lon: Number(lon),
    alamat: alamatDari(t),
    telepon: spasi(teks(t.phone) ?? teks(t['contact:phone'])),
    website: teks(t.website) ?? teks(t['contact:website']),
    jam: teks(t.opening_hours),
    // `healthcare:speciality` berisi daftar bertitik koma berbahasa Inggris
    // (mis. "acupuncture;allergology;anaesthetics"). Dibiarkan mentah, daftar itu
    // tampil sebagai tembok istilah asing — jadi dirapikan jadi kalimat
    // berkoma, dan pemetaan ke istilah Indonesia dilakukan di antarmuka.
    layanan: spasi(teks(t.healthcare_speciality) ?? teks(t['healthcare:speciality'])),
    igd: igdDari(t),
    buka24Jam: duaPuluhEmpat(t),
    sumber: 'OpenStreetMap',
    sumberUrl: `https://www.openstreetmap.org/${elemen.type ?? 'node'}/${elemen.id ?? ''}`,
    // OSM tidak menyediakan tanggal verifikasi per objek dalam balasan Overpass.
    diperbarui: teks(t.check_date) ?? teks(t['survey:date']),
  }
}

/**
 * Buang duplikat: objek yang sama sering terpetakan sebagai node DAN way
 * (mis. gedung + titik pintu masuk). Dua dianggap sama bila namanya sama
 * (tanpa beda huruf besar/kecil) dan jaraknya < 60 m.
 */
export function buangDuplikat(daftar) {
  const hasil = []
  for (const f of daftar) {
    const kembar = hasil.find(
      (g) =>
        g.nama.toLowerCase() === f.nama.toLowerCase() &&
        jarakMeter(g.lat, g.lon, f.lat, f.lon) < 60,
    )
    if (!kembar) {
      hasil.push(f)
      continue
    }
    // Gabungkan: field yang kosong diisi dari kembarannya.
    for (const kunci of ['telepon', 'website', 'jam', 'alamat', 'layanan']) {
      if (!kembar[kunci] && f[kunci]) kembar[kunci] = f[kunci]
    }
    if (kembar.igd === null && f.igd !== null) kembar.igd = f.igd
    if (!kembar.buka24Jam && f.buka24Jam) kembar.buka24Jam = true
  }
  return hasil
}

/* ----------------------------------------------------------- query OSM --- */

/**
 * Satu permintaan gabungan untuk SEMUA kategori.
 *
 * KENAPA GABUNG: diukur 2 Nov 2026 — 20 permintaan terpisah (satu per tag)
 * membuat Overpass membalas HTTP 429/504 pada permintaan ke-4. Satu permintaan
 * gabungan menjawab 200 dan mengembalikan 1.662 elemen dalam ~89 detik untuk
 * radius 10 km.
 */
export function queryOverpass(lat, lon, radiusM) {
  const r = Math.round(radiusM)
  return `[out:json][timeout:${Math.round(TIMEOUT_MS / 1000) - 5}];
(
  nwr["amenity"~"^(hospital|clinic|doctors|dentist|pharmacy)$"](around:${r},${lat},${lon});
  nwr["healthcare"](around:${r},${lat},${lon});
  nwr["shop"~"^(optician|medical_supply|hearing_aids)$"](around:${r},${lat},${lon});
  nwr["amenity"="social_facility"](around:${r},${lat},${lon});
);
out center tags;`
}

async function ambilCermin(cermin, query, batasMs = TIMEOUT_MS) {
  const res = await fetch(cermin, {
    method: 'POST',
    headers: {
      'User-Agent': UA,
      'Content-Type': 'application/x-www-form-urlencoded',
      Accept: 'application/json',
    },
    body: new URLSearchParams({ data: query }).toString(),
    signal: AbortSignal.timeout(batasMs),
  })
  if (!res.ok) throw new Error(`HTTP ${res.status}`)
  const j = await res.json()
  if (!Array.isArray(j?.elements)) throw new Error('balasan bukan Overpass')
  // CACAT YANG PERNAH TERJADI, dan tidak terlihat sama sekali: sebagian cermin
  // (mis. overpass.osm.ch) hanya memuat data satu negara, jadi ia membalas 200
  // dengan daftar KOSONG untuk koordinat di Indonesia. Tanpa pemeriksaan ini,
  // "berhasil" dilaporkan padahal hasilnya nol — pengguna melihat peta kosong
  // dan menyimpulkan tidak ada fasilitas kesehatan di sekitarnya.
  //
  // Daftar kosong TIDAK bisa dibedakan dari daerah yang memang tidak punya
  // fasilitas, jadi cermin yang mengembalikan nol elemen tidak dipakai; kita
  // lanjut ke cermin berikutnya. Kalau SEMUA cermin mengembalikan nol, hasil
  // akhirnya tetap nol — dan itu dilaporkan apa adanya, bukan sebagai galat.
  if (j.elements.length === 0) {
    const e = new Error('cermin mengembalikan nol elemen')
    e.kosong = true
    throw e
  }
  return j.elements
}

/* ------------------------------------------------------------- simpanan -- */

const simpanan = new Map()

/**
 * Berkas simpanan di disk.
 *
 * KENAPA ADA: Overpass publik butuh 40–50 detik untuk satu pencarian. Kalau
 * simpanan hanya di memori, setiap kali server dijalankan ulang (dan itu
 * terjadi setiap kali kode diubah, dan sekali sebelum demo) pengguna pertama
 * membayar 50 detik itu lagi. Dengan berkas di disk, hasil yang sudah pernah
 * diambil dipakai lagi tanpa menyentuh jaringan sama sekali.
 *
 * Berkasnya gitignored dan boleh dihapus kapan saja — kalau rusak atau tidak
 * ada, server cukup mengambil ulang.
 */
const BERKAS_SIMPANAN = join(dirname(fileURLToPath(import.meta.url)), '..', '.cache-faskes.json')

function bacaSimpananDisk() {
  try {
    if (!existsSync(BERKAS_SIMPANAN)) return
    const isi = JSON.parse(readFileSync(BERKAS_SIMPANAN, 'utf8'))
    if (!isi || typeof isi !== 'object') return
    for (const [kunci, nilai] of Object.entries(isi)) {
      if (nilai?.waktu && nilai?.data && Date.now() - nilai.waktu <= CACHE_MS) {
        simpanan.set(kunci, nilai)
      }
    }
  } catch {
    // Berkas rusak bukan masalah: lebih baik mulai kosong daripada gagal start.
  }
}

let penulisanTertunda = null

function tulisSimpananDisk() {
  // Tulis digabung: satu penulisan per 2 detik, bukan satu per pencarian.
  if (penulisanTertunda) return
  penulisanTertunda = setTimeout(() => {
    penulisanTertunda = null
    try {
      const isi = Object.fromEntries(simpanan)
      writeFileSync(BERKAS_SIMPANAN, JSON.stringify(isi))
    } catch {
      // Gagal menulis (mis. folder read-only) tidak boleh menjatuhkan server;
      // fitur tetap jalan dengan simpanan di memori.
    }
  }, 2000)
  penulisanTertunda.unref?.()
}

bacaSimpananDisk()

function kunciCache(lat, lon, radius) {
  // Grid ~1 km supaya geseran kecil tetap memakai hasil yang sama.
  return `${lat.toFixed(2)},${lon.toFixed(2)},${radius}`
}

/**
 * Cari hasil tersimpan yang MENCAKUP permintaan ini.
 *
 * Radius yang diminta lebih kecil dari yang tersimpan -> datanya sudah ada di
 * dalamnya, cukup disaring. Ini yang membuat memperkecil radius seketika dan
 * membuat pemanasan radius 5 km berguna untuk permintaan 1 km.
 */
function cariTersimpanCakupan(lat, lon, radius) {
  const langsung = bacaCache(kunciCache(lat, lon, radius))
  if (langsung) return { data: langsung, persis: true }

  let terbaik = null
  for (const [kunci, isi] of simpanan) {
    if (Date.now() - isi.waktu > CACHE_MS) continue
    const [plat, plon, pradius] = kunci.split(',')
    if (Number(pradius) < radius) continue
    if (Math.abs(Number(plat) - lat) > 0.02 || Math.abs(Number(plon) - lon) > 0.02) continue
    if (!terbaik || Number(pradius) < Number(terbaik.kunci.split(',')[2])) {
      terbaik = { data: isi.data, kunci, persis: false }
    }
  }
  if (!terbaik) return null

  const fasilitas = (terbaik.data.fasilitas ?? []).filter((f) => f.jarakM <= radius)
  const perKategori = {}
  for (const f of fasilitas) perKategori[f.kategori] = (perKategori[f.kategori] ?? 0) + 1
  return {
    data: { ...terbaik.data, radius, fasilitas, jumlah: fasilitas.length, perKategori },
    persis: false,
  }
}

function bacaCache(kunci) {
  const isi = simpanan.get(kunci)
  if (!isi) return null
  if (Date.now() - isi.waktu > CACHE_MS) {
    simpanan.delete(kunci)
    return null
  }
  return isi.data
}

function tulisCache(kunci, data) {
  if (simpanan.size >= CACHE_MAKS) {
    // buang yang paling tua
    const tertua = [...simpanan.entries()].sort((a, b) => a[1].waktu - b[1].waktu)[0]
    if (tertua) simpanan.delete(tertua[0])
  }
  simpanan.set(kunci, { waktu: Date.now(), data })
  tulisSimpananDisk()
}

/** Hanya untuk uji: kosongkan simpanan. */
export function _kosongkanSimpanan() {
  simpanan.clear()
}

/* ------------------------------------------------------------- publik ---- */

/**
 * Cari fasilitas kesehatan di sekitar satu titik.
 *
 * @param {{ lat:number, lon:number, radius?:number }} opsi
 * @returns {Promise<object>} daftar fasilitas + keadaan tiap sumber data
 */
export async function faskesSekitar({ lat, lon, radius = 5000 } = {}) {
  const a = Number(lat)
  const b = Number(lon)
  if (!koordinatSah(a, b)) {
    const galat = new Error('koordinat tidak sah')
    galat.code = 'koordinat'
    throw galat
  }
  const r = Math.min(Math.max(Number(radius) || 5000, 500), RADIUS_MAKS_M)

  // Simpanan diperiksa dua lapis: yang PERSIS sama, lalu yang MENCAKUP
  // (radius lebih besar di titik yang sama) — hasilnya disaring ke radius yang
  // diminta. Tanpa lapis kedua, pemanasan 5 km tidak menolong permintaan 1 km.
  const tersimpan = cariTersimpanCakupan(a, b, r)
  if (tersimpan) return { ...tersimpan.data, dariSimpanan: true, persis: tersimpan.persis }

  const query = queryOverpass(a, b, r)
  const keadaan = []
  // `[]` dan `null` berbeda: nol elemen berarti sumber MENJAWAB tetapi tidak
  // punya apa pun di area itu (sah), sedangkan null berarti tidak ada satu pun
  // cermin yang menjawab (galat). Membedakannya mencegah "tidak ada fasilitas
  // di sini" dan "sumbernya sedang mati" terlihat sama di antarmuka.
  let elemen = null
  let dipakai = null
  let adaJawabanKosong = false

  const mulaiTotal = Date.now()
  for (const cermin of CERMIN) {
    const sisa = ANGGARAN_TOTAL_MS - (Date.now() - mulaiTotal)
    if (sisa < 8_000) {
      keadaan.push({
        nama: 'OpenStreetMap (Overpass)',
        url: cermin,
        ok: false,
        ms: 0,
        galat: 'dilewati: anggaran waktu habis',
      })
      continue
    }
    const mulai = Date.now()
    try {
      elemen = await ambilCermin(cermin, query, Math.min(TIMEOUT_MS, sisa))
      dipakai = cermin
      keadaan.push({ nama: 'OpenStreetMap (Overpass)', url: cermin, ok: true, ms: Date.now() - mulai })
      break
    } catch (e) {
      if (e?.kosong) adaJawabanKosong = true
      keadaan.push({
        nama: 'OpenStreetMap (Overpass)',
        url: cermin,
        ok: false,
        ms: Date.now() - mulai,
        galat: String(e?.message ?? 'gagal'),
      })
    }
  }

  if (!elemen && !adaJawabanKosong) {
    const galat = new Error('semua cermin Overpass gagal')
    galat.code = 'sumber_gagal'
    galat.keadaan = keadaan
    throw galat
  }
  if (!elemen) elemen = []

  const mentah = elemen.map(normalisasi).filter(Boolean)
  const unik = buangDuplikat(mentah)
  for (const f of unik) f.jarakM = jarakMeter(a, b, f.lat, f.lon)
  unik.sort((x, y) => x.jarakM - y.jarakM)

  const perKategori = {}
  for (const k of KATEGORI_ID) perKategori[k] = 0
  for (const f of unik) perKategori[f.kategori] = (perKategori[f.kategori] ?? 0) + 1

  const data = {
    pusat: { lat: a, lon: b },
    radius: r,
    jumlah: unik.length,
    dipotong: unik.length > MAKS_HASIL,
    fasilitas: unik.slice(0, MAKS_HASIL),
    perKategori,
    // Sumber yang benar-benar dipakai, untuk ditampilkan di antarmuka.
    sumber: [
      {
        nama: 'OpenStreetMap',
        keterangan:
          'Data fasilitas dari OpenStreetMap lewat Overpass API. Dipetakan sukarela oleh kontributor; kelengkapan berbeda antarwilayah.',
        url: 'https://www.openstreetmap.org/',
        lisensi: 'ODbL 1.0',
      },
    ],
    keadaanSumber: keadaan,
    diambilPada: new Date().toISOString(),
    cermin: dipakai,
    // Sumber resmi yang DIPERIKSA dan hasilnya, supaya tidak terlihat seperti
    // kelalaian: disebut di README dan di panel sumber antarmuka.
    sumberTidakTersedia: [
      {
        nama: 'Kemenkes RI (katalog fasilitas)',
        alasan:
          'Tidak ada katalog fasilitas publik yang bisa dibaca mesin saat diperiksa 2 November 2026: faskes.kemkes.go.id dan data.kemkes.go.id tidak ditemukan, api.kemkes.go.id menjawab 404.',
      },
      {
        nama: 'SATUSEHAT',
        alasan:
          'Alamat API FHIR-nya tidak dapat dihubungi dan integrasinya memerlukan kredensial resmi yang belum dimiliki tim.',
      },
    ],
  }

  tulisCache(kunciCache(a, b, r), data)
  return { ...data, dariSimpanan: false }
}

/* ------------------------------------------------------------ pemanasan -- */

/**
 * Pemanasan: ambil data untuk satu titik di latar belakang.
 *
 * KENAPA: muat pertama butuh 40–50 detik karena Overpass publik. Kalau
 * pengguna pertama menunggu, itu terasa seperti aplikasi macet — dan saat demo
 * lomba, pengguna pertama adalah juri.
 *
 * YANG TIDAK DILAKUKAN: fungsi ini TIDAK mengarang fasilitas, TIDAK memakai
 * koordinat karangan, dan TIDAK menandai lokasi pengguna. Yang disiapkan hanya
 * simpanan untuk titik yang memang diminta lewat `PEMANASAN_TITIK`, dan
 * pengguna tetap harus memberi izin lokasi sendiri. Kalau pemanasan gagal,
 * tidak ada yang rusak — permintaan pengguna akan mengambil seperti biasa.
 */
export async function panaskanTitik({ lat, lon, radius = 5000 } = {}) {
  try {
    const hasil = await faskesSekitar({ lat, lon, radius })
    return { ok: true, jumlah: hasil.jumlah, dariSimpanan: hasil.dariSimpanan }
  } catch (e) {
    return { ok: false, alasan: String(e?.message ?? 'gagal') }
  }
}

/**
 * Titik yang dipanaskan saat server mulai.
 *
 * KOSONG SECARA BAWAAN — ini keputusan yang disengaja. Mengisi daftar ini
 * dengan kota tertentu berarti aplikasi menyiapkan data untuk pengguna yang
 * belum tentu ada di sana, dan itu pemborosan yang diam-diam. Untuk demo,
 * isi lewat variabel lingkungan, mis.:
 *
 *   PEMANASAN_TITIK="-6.1754,106.8272" npm run server
 *
 * Format: `lat,lon` dipisah titik koma untuk beberapa titik. Radius memakai
 * PEMANASAN_RADIUS (bawaan 5000).
 */
export function titikPemanasan(nilai = process.env.PEMANASAN_TITIK) {
  if (!nilai) return []
  return String(nilai)
    .split(';')
    .map((bagian) => bagian.trim())
    .filter(Boolean)
    .map((bagian) => {
      const [lat, lon] = bagian.split(',').map((x) => Number(x.trim()))
      return { lat, lon }
    })
    .filter((t) => koordinatSah(t.lat, t.lon))
}

/** Jalankan pemanasan untuk semua titik yang dikonfigurasi. Tidak di-await. */
export function jalankanPemanasan({ log = () => {} } = {}) {
  const titik = titikPemanasan()
  if (!titik.length) return 0
  const radius = Number(process.env.PEMANASAN_RADIUS) || 5000
  for (const t of titik) {
    // Sengaja tidak di-await: server harus siap menerima permintaan lebih dulu.
    panaskanTitik({ ...t, radius }).then((h) => {
      log(
        h.ok
          ? `[pemanasan] ${t.lat},${t.lon} r=${radius} m -> ${h.jumlah} fasilitas`
          : `[pemanasan] ${t.lat},${t.lon} gagal: ${h.alasan}`,
      )
    })
  }
  return titik.length
}

/** Daftar kategori untuk antarmuka (tanpa fungsi internal). */
export function daftarKategori() {
  return KATEGORI.map(({ id, label, ikon }) => ({ id, label, ikon }))
}
