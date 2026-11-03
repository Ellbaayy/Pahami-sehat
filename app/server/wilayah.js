/**
 * Wilayah administratif Indonesia — Provinsi → Kota/Kabupaten → Kecamatan →
 * Desa/Kelurahan.
 *
 * SUMBER: https://wilayah.id/api/ (data BPS/Kemendagri). Diukur 4 Nov 2026:
 * 38 provinsi, kode berformat titik ("32.16.16.2001"). Balasannya berbentuk
 * {"data":[...]}. Dataset ini TIDAK memuat koordinat, jadi titik referensi
 * diambil dari Nominatim dengan cascade desa → kecamatan → kabupaten →
 * provinsi (lihat `cascadeTitik`).
 *
 * KENAPA TIDAK PAKAI emsifa.com: diukur 4 Nov 2026 hanya 34 provinsi — basi,
 * sebelum pemekaran 2022. Jangan dikembalikan.
 *
 * KENAPA KODE, BUKAN NAMA: nama wilayah bisa berubah dan tidak unik (banyak
 * "Sukamaju"), sedangkan kode BPS stabil dan menentukan hubungan antarwilayah.
 * Semua validasi di sini berbasis kode, dan kode yang tidak sah DITOLAK sebelum
 * menyentuh jaringan atau database.
 */

import { existsSync, readFileSync, writeFileSync, mkdirSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const UA =
  'PahamiSehat/1.0 (pendidikan kesehatan; +https://github.com/Ellbaayy/Pahami-sehat)'

/** Bentuk kode per tingkat: 2, 4, 6, dan 10 digit dipisah titik. */
const POLA = {
  provinsi: /^\d{2}$/,
  kabupaten: /^\d{2}\.\d{2}$/,
  kecamatan: /^\d{2}\.\d{2}\.\d{2}$/,
  desa: /^\d{2}\.\d{2}\.\d{2}\.\d{4}$/,
}

const TINGKAT = ['provinsi', 'kabupaten', 'kecamatan', 'desa']

/** Nama jalur API per tingkat. Desa memakai `villages`. */
const JALUR = {
  provinsi: () => 'provinces.json',
  kabupaten: (induk) => `regencies/${induk}.json`,
  kecamatan: (induk) => `districts/${induk}.json`,
  desa: (induk) => `villages/${induk}.json`,
}

/* ---------------------------------------------------------- bagian murni -- */

/** Kode wilayah sah untuk tingkat tertentu? Dipakai juga sebelum query DB. */
export function kodeSah(kode, tingkat) {
  const pola = POLA[tingkat]
  if (!pola) return false
  return pola.test(String(kode ?? ''))
}

/** Kode induk dari kode anak; null untuk provinsi. */
export function indukDari(kode) {
  const bagian = String(kode ?? '').split('.')
  if (bagian.length < 2) return null
  return bagian.slice(0, -1).join('.')
}

/** Tingkat ditentukan dari panjang kode, bukan dari nama. */
export function tingkatDariKode(kode) {
  const bagian = String(kode ?? '').split('.')
  if (bagian.length === 1) return 'provinsi'
  if (bagian.length === 2) return 'kabupaten'
  if (bagian.length === 3) return 'kecamatan'
  if (bagian.length === 4) return 'desa'
  return null
}

/** Balasan wilayah.id -> bentuk seragam; entri tak sah dibuang. */
export function normalisasiWilayah(mentah, tingkat) {
  const isi = Array.isArray(mentah) ? mentah : Array.isArray(mentah?.data) ? mentah.data : []
  return isi
    .filter((x) => x && typeof x.code === 'string' && kodeSah(x.code, tingkat))
    .map((x) => ({ kode: x.code, nama: String(x.name ?? '').trim(), tingkat }))
    .filter((x) => x.nama.length > 0)
}

/**
 * Pilih satu hasil Nominatim yang layak jadi titik referensi.
 *
 * ATURANNYA DIBUAT DARI PENGUKURAN, bukan selera (4 Nov 2026):
 *   - provinsi / kabupaten: hanya `type === 'administrative'`. Hasil
 *     "Jawa Barat" dan "Kabupaten Bekasi" memang administrative.
 *   - kecamatan: TIDAK ADA hasil administrative di Indonesia. Yang ada
 *     `residential` (kavling), `school`, `police`, dan `government`
 *     ("Kantor Kecamatan …"). Hanya kantor pemerintah yang dipakai — kavling
 *     perumahan bukan pusat wilayah dan menyesatkan perhitungan jarak.
 *   - desa: "Sindangsari, Cikarang Selatan" menghasilkan NOL hasil, jadi
 *     tingkat ini hampir selalu jatuh ke kecamatan. Kalau ada kantor
 *     kelurahan/desa atau administrative, itu dipakai.
 *
 * Mengembalikan null bila tidak ada yang layak — pemanggil yang memutuskan
 * jatuh ke tingkat di atasnya. TIDAK memakai hasil pertama begitu saja.
 */
export function pilihHasilNominatim(daftar, tingkat) {
  if (!Array.isArray(daftar) || !daftar.length) return null
  const angka = (v) => {
    const n = Number(v)
    return Number.isFinite(n) ? n : null
  }

  const layak = daftar
    .map((x) => ({
      lat: angka(x?.lat),
      lon: angka(x?.lon),
      tipe: String(x?.type ?? ''),
      kelas: String(x?.class ?? ''),
      nama: String(x?.display_name ?? ''),
    }))
    .filter(
      (x) =>
        x.lat !== null &&
        x.lon !== null &&
        Math.abs(x.lat) <= 90 &&
        Math.abs(x.lon) <= 180 &&
        !(x.lat === 0 && x.lon === 0),
    )

  if (!layak.length) return null

  if (tingkat === 'provinsi' || tingkat === 'kabupaten') {
    return layak.find((x) => x.tipe === 'administrative') ?? null
  }

  // kecamatan & desa: kantor pemerintah lebih dipercaya daripada kavling.
  const kantor = layak.find(
    (x) => x.kelas === 'amenity' && x.tipe === 'government' && /kantor/i.test(x.nama),
  )
  if (kantor) return kantor

  return layak.find((x) => x.tipe === 'administrative') ?? null
}

/**
 * Cascade titik referensi: desa → kecamatan → kabupaten → provinsi.
 *
 * `panggil` adalah fungsi `(tingkat, kueri) => Promise<{lat,lon,label}|null>`
 * yang disuntikkan supaya fungsi ini bisa diuji tanpa jaringan.
 *
 * MENGEMBALIKAN `presisi` APA ADANYA. Pemanggil WAJIB menampilkannya, karena
 * titik tengah kecamatan BUKAN posisi pengguna dan bukan titik tengah desa.
 * Kalau semua tingkat gagal -> null; TIDAK PERNAH mengarang koordinat.
 */
export async function cascadeTitik(wilayah, namaWilayah, panggil) {
  const urutan = []
  const ada = (v) => typeof v === 'string' && v.trim().length > 0

  if (wilayah?.tingkat === 'desa' && ada(namaWilayah.desa) && ada(namaWilayah.kecamatan)) {
    urutan.push({
      tingkat: 'desa',
      kueri: `${namaWilayah.desa}, ${namaWilayah.kecamatan}, ${namaWilayah.kabupaten}`,
    })
  }
  if (wilayah?.tingkat === 'desa' || wilayah?.tingkat === 'kecamatan') {
    if (ada(namaWilayah.kecamatan) && ada(namaWilayah.kabupaten)) {
      urutan.push({
        tingkat: 'kecamatan',
        kueri: `Kantor Kecamatan ${namaWilayah.kecamatan}, ${namaWilayah.kabupaten}`,
      })
    }
  }
  if (ada(namaWilayah.kabupaten) && ada(namaWilayah.provinsi)) {
    urutan.push({
      tingkat: 'kabupaten',
      kueri: `${namaWilayah.kabupaten}, ${namaWilayah.provinsi}`,
    })
  }
  if (ada(namaWilayah.provinsi)) {
    urutan.push({ tingkat: 'provinsi', kueri: namaWilayah.provinsi })
  }

  for (const u of urutan) {
    try {
      const hasil = await panggil(u.tingkat, u.kueri)
      if (hasil && Number.isFinite(hasil.lat) && Number.isFinite(hasil.lon)) {
        return { ...hasil, presisi: u.tingkat }
      }
    } catch {
      // satu tingkat gagal bukan alasan menggagalkan seluruhnya
    }
  }
  return null
}

/* ------------------------------------------------------- pengambil HTTP -- */

const AKAR = join(dirname(fileURLToPath(import.meta.url)), '..')
const BERKAS_CACHE = join(AKAR, '.cache-wilayah.json')
/** 30 hari: pembagian wilayah jarang berubah, dan cache memangkas panggilan. */
const CACHE_MS = 30 * 24 * 60 * 60 * 1000
const simpanan = new Map()

function muatCache() {
  try {
    if (!existsSync(BERKAS_CACHE)) return
    const isi = JSON.parse(readFileSync(BERKAS_CACHE, 'utf8'))
    for (const [k, v] of Object.entries(isi)) {
      if (v?.waktu && Date.now() - v.waktu <= CACHE_MS) simpanan.set(k, v)
    }
  } catch {
    // cache rusak = mulai kosong, bukan gagal start
  }
}

let tulisTertunda = null
function simpanCache() {
  if (tulisTertunda) return
  tulisTertunda = setTimeout(() => {
    tulisTertunda = null
    try {
      mkdirSync(dirname(BERKAS_CACHE), { recursive: true })
      writeFileSync(BERKAS_CACHE, JSON.stringify(Object.fromEntries(simpanan)))
    } catch {
      // sistem berkas read-only tidak boleh menjatuhkan server
    }
  }, 1500)
  tulisTertunda.unref?.()
}

muatCache()

/** Ambil satu tingkat wilayah dari wilayah.id, dengan cache 30 hari. */
export async function ambilWilayah(tingkat, induk = null) {
  if (!TINGKAT.includes(tingkat)) {
    const e = new Error(`tingkat tidak dikenal: ${tingkat}`)
    e.code = 'tingkat'
    throw e
  }
  if (tingkat !== 'provinsi') {
    if (!induk || !kodeSah(induk, tingkatDariKode(induk))) {
      const e = new Error('kode induk tidak sah')
      e.code = 'kode'
      throw e
    }
  }

  const kunci = `${tingkat}:${induk ?? 'root'}`
  const tersimpan = simpanan.get(kunci)
  if (tersimpan && Date.now() - tersimpan.waktu <= CACHE_MS) {
    return { data: tersimpan.data, dariSimpanan: true }
  }

  const res = await fetch(`https://wilayah.id/api/${JALUR[tingkat](induk)}`, {
    headers: { 'User-Agent': UA, Accept: 'application/json' },
    signal: AbortSignal.timeout(15000),
  })
  if (!res.ok) {
    const e = new Error(`HTTP ${res.status}`)
    e.code = 'sumber_gagal'
    throw e
  }

  const data = normalisasiWilayah(await res.json(), tingkat)
  simpanan.set(kunci, { waktu: Date.now(), data })
  simpanCache()
  return { data, dariSimpanan: false }
}

/** Titik referensi nama wilayah lewat Nominatim. Null bila tidak layak. */
export async function titikNama(tingkat, kueri) {
  const url =
    'https://nominatim.openstreetmap.org/search?format=jsonv2&limit=6&countrycodes=id' +
    `&addressdetails=1&q=${encodeURIComponent(kueri)}`
  const res = await fetch(url, {
    headers: { 'User-Agent': UA, 'Accept-Language': 'id,en;q=0.8' },
    signal: AbortSignal.timeout(15000),
  })
  if (!res.ok) return null
  const daftar = await res.json()
  const pilih = pilihHasilNominatim(daftar, tingkat)
  if (!pilih) return null
  return {
    lat: pilih.lat,
    lon: pilih.lon,
    label: pilih.nama,
    sumber: 'Nominatim (OpenStreetMap)',
  }
}

/** Hanya untuk uji: kosongkan simpanan di memori. */
export function _kosongkanSimpananWilayah() {
  simpanan.clear()
}
