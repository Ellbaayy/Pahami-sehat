/**
 * Klien Photon — autocomplete alamat.
 * ============================================================================
 *
 * KENAPA PHOTON DULU, NOMINATIM KEMUDIAN
 * --------------------------------------
 * Diukur 4 Nov 2026: Photon menjawab jauh lebih cepat untuk pencarian
 * sebagian kata ("monas jak", "maliob"), karena indeksnya memang dibuat untuk
 * itu. Nominatim dirancang untuk pencarian alamat lengkap dan lebih lambat.
 *
 * TAPI Photon BUKAN pengganti Nominatim di sini, karena dua hal yang terukur:
 *
 *   1. `lang=id` => **HTTP 400**. Jadi `lang` tidak pernah dikirim.
 *   2. `state` berisi "Yogyakarta"/"Jawa", bukan nama provinsi resmi
 *      ("Daerah Istimewa Yogyakarta"/"Jawa Barat"). Kalau wilayah dideteksi
 *      dari Photon, pencocokan ke tabel `wilayah` akan gagal untuk sebagian
 *      besar alamat.
 *
 * Karena itu: Photon dipakai untuk MENEMUKAN kandidat (cepat), dan wilayahnya
 * DIPERKAYA lewat geocoding balik Nominatim di endpoint — bukan ditebak dari
 * `state` Photon.
 *
 * KEBIJAKAN YANG DIHORMATI
 * ------------------------
 * - Maksimal ~1 permintaan/detik (antrean di `layanan.js`).
 * - `limit` kecil (6) — autocomplete tidak butuh 50 hasil.
 * - Simpanan 10 menit: mengetik ulang kueri yang sama tidak memanggil ulang.
 */

import { PHOTON, antre, buatSimpanan } from './layanan.js'

const simpanan = buatSimpanan({ maks: PHOTON.cacheMaks, umurMs: PHOTON.cacheMs })

/** Indonesia: tolak hasil di luar batas negara (Photon bisa memberi negara lain). */
const diIndonesia = (lat, lon) =>
  Number.isFinite(lat) && Number.isFinite(lon) && lat >= -11.5 && lat <= 6.5 && lon >= 94 && lon <= 141.1

/**
 * Ubah Feature Photon menjadi bentuk yang dipakai antarmuka.
 *
 * PENTING: koordinat Photon berurutan **[lon, lat]** (GeoJSON), BUKAN
 * [lat, lon]. Menukarnya menghasilkan titik di Somalia untuk setiap alamat
 * Indonesia — kesalahan klasik yang tidak terlihat sampai peta dibuka.
 */
function bentuk(f) {
  const p = f?.properties ?? {}
  const c = f?.geometry?.coordinates ?? []
  const lon = Number(c[0])
  const lat = Number(c[1])
  if (!diIndonesia(lat, lon)) return null

  const bagian = [p.name, p.street, p.district, p.city, p.county, p.state, p.country].filter(Boolean)
  const unik = bagian.filter((x, i) => bagian.indexOf(x) === i)

  return {
    nama: p.name || p.street || p.city || 'Lokasi',
    alamat: unik.join(', '),
    lat,
    lon,
    // Jenis dari Photon dipakai apa adanya; pemetaan ke istilah Indonesia
    // dilakukan di `tingkatKetepatan` saat endpoint menyusun balasan.
    tipe: p.type ?? null,
    osm: p.osm_key && p.osm_value ? `${p.osm_key}=${p.osm_value}` : null,
    kodePos: p.postcode ?? null,
    /**
     * Wilayah dari Photon SENGAJA tidak dipakai sebagai hasil akhir.
     * `state` Photon bukan nama provinsi resmi; lihat catatan di atas.
     * Yang dipakai hanya petunjuk mentah untuk ditampilkan sekilas.
     */
    petunjukWilayah: {
      kecamatan: p.district ?? p.locality ?? null,
      kabupaten: p.city ?? p.county ?? null,
      provinsi: p.state ?? null,
      kodePos: p.postcode ?? null,
    },
  }
}

/**
 * Cari alamat lewat Photon.
 *
 * @param {string} kueri
 * @param {{limit?:number}} opsi
 * @returns {Promise<{hasil: object[], dariSimpanan: boolean}>}
 * @throws {Error} dengan `status` kalau layanan menolak — pemanggil membedakan
 *                 "tidak ditemukan" dari "layanan mati".
 */
export async function cariPhoton(kueri, { limit = PHOTON.limit } = {}) {
  const q = String(kueri ?? '').trim()
  if (q.length < 3) return { hasil: [], dariSimpanan: false }

  const kunci = `${q.toLowerCase()}|${limit}`
  const tersimpan = simpanan.ambil(kunci)
  if (tersimpan) return { hasil: tersimpan, dariSimpanan: true }

  await antre('photon', PHOTON.jedaMs)

  const parameter = new URLSearchParams({ q, limit: String(limit) })
  // `lang` hanya dikirim kalau memang diatur lewat env (instance sendiri).
  // Instance publik membalas HTTP 400 untuk lang=id — terukur.
  if (PHOTON.lang) parameter.set('lang', PHOTON.lang)

  const res = await fetch(`${PHOTON.url}?${parameter.toString()}`, {
    headers: { Accept: 'application/json' },
    signal: AbortSignal.timeout(15_000),
  })
  if (!res.ok) {
    const e = new Error(`Photon HTTP ${res.status}`)
    e.status = res.status
    throw e
  }
  const j = await res.json()
  const hasil = (j?.features ?? []).map(bentuk).filter(Boolean)
  simpanan.simpan(kunci, hasil)
  return { hasil, dariSimpanan: false }
}

/** Untuk uji: kosongkan simpanan. */
export function _kosongkanSimpananPhoton() {
  simpanan.kosongkan()
}

export function _ukuranSimpananPhoton() {
  return simpanan.ukuran
}
