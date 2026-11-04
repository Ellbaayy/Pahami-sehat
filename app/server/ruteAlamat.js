/**
 * Pencarian alamat (geocoding) + deteksi wilayah administratif.
 * ============================================================================
 *
 * Bedanya dengan `/api/faskes/cari-lokasi` yang lama:
 *   - yang lama hanya mengembalikan nama + koordinat;
 *   - yang ini juga MENDETEKSI PROVINSI/KABUPATEN/KECAMATAN dan memberi tahu
 *     tingkat ketepatannya, supaya pengguna melihat wilayah apa yang dikenali
 *     SEBELUM pencarian fasilitas dijalankan.
 *
 * Dua endpoint:
 *   GET /api/alamat/cari?q=...       saran/autocomplete (batas 6 hasil)
 *   GET /api/alamat/:id?lat=&lon=    rincian satu hasil + wilayahnya
 *
 * Rute rincian memakai lat/lon, bukan id Nominatim, karena id Nominatim tidak
 * stabil antar-permintaan (place_id bisa berubah saat data OSM diperbarui).
 * Koordinat selalu dikirim balik oleh server, jadi tidak ada yang bisa
 * "mengarang" titik: titik yang dipakai adalah titik yang dikembalikan sumber.
 */

import { Router } from 'express'
import { batasi } from './batas.js'
import { LAJU } from './batasInput.js'
import { deteksiWilayah, tingkatKetepatan, normalNama } from './geocoding.js'
import { cariPhoton } from './photon.js'
import { NOMINATIM, antre, buatSimpanan } from './layanan.js'
import { eksekusi } from './db.js'

const ruteAlamat = Router()
const batasAlamat = batasi({ ...LAJU.faskes, nama: 'permintaan alamat' })

const UA = NOMINATIM.ua
const NOMINATIM_BASE = NOMINATIM.url

/*
 * Simpanan geocoding balik.
 *
 * Geocoding balik dipanggil dua kali untuk alur yang sama: sekali saat
 * pengguna memilih kandidat (untuk wilayah), sekali lagi kalau ia memakai
 * titik peta. Kueri yang sama persis sering berulang (pengguna memilih,
 * batal, memilih lagi), dan kebijakan Nominatim membatasi 1 permintaan/detik —
 * jadi menyimpan hasilnya bukan optimasi, melainkan cara mematuhi kebijakan.
 */
const simpananBalik = buatSimpanan({ maks: NOMINATIM.cacheMaks, umurMs: NOMINATIM.cacheMs })

/** Bungkus handler supaya galat tak terduga jadi 500 JSON, bukan HTML. */
const bungkus = (fn) => (req, res) =>
  Promise.resolve(fn(req, res)).catch((e) => {
    if (!res.headersSent) res.status(500).json({ ok: false, code: 'galat_server', pesan: String(e?.message ?? e) })
  })

/**
 * Tabel wilayah untuk pencocokan.
 *
 * Dibaca dari DATABASE, bukan daftar tetap di kode: kalau `wilayah.id` menambah
 * atau mengubah nama wilayah, deteksi ikut menyesuaikan tanpa ubah kode.
 * Disimpan di memori proses karena isinya jarang berubah dan dipakai tiap
 * permintaan.
 */
let tabelWilayah = null
let janjiTabel = null

function muatTabelWilayah() {
  if (tabelWilayah) return Promise.resolve(tabelWilayah)
  if (!janjiTabel) {
    janjiTabel = (async () => {
      const semua = await eksekusi(
        `SELECT kode, nama, tingkat, kode_induk FROM wilayah
          WHERE tingkat IN ('provinsi','kabupaten','kecamatan')`,
      )
      if (!Array.isArray(semua) || !semua.length) return null
      const t = { provinsi: [], kabupaten: [], kecamatan: [] }
      for (const w of semua) {
        if (t[w.tingkat]) t[w.tingkat].push(w)
      }
      tabelWilayah = t
      return t
    })().catch(() => {
      janjiTabel = null
      return null
    })
  }
  return janjiTabel
}

/** Ambil satu halaman hasil Nominatim. */
async function tanyaNominatim(q, batasMs = 12_000) {
  const url =
    `${NOMINATIM_BASE}/search?format=jsonv2&addressdetails=1&countrycodes=id` +
    `&limit=6&q=${encodeURIComponent(q)}`
  await antre('nominatim', NOMINATIM.jedaMs)
  const res = await fetch(url, {
    headers: { 'User-Agent': UA, 'Accept-Language': 'id,en;q=0.8' },
    signal: AbortSignal.timeout(batasMs),
  })
  if (!res.ok) {
    // 403/429 = kuota atau pemblokiran. Dibedakan dari galat lain karena
    // pengguna berhak tahu ini bukan salahnya dan bukan salah alamatnya.
    const e = new Error(`HTTP ${res.status}`)
    e.status = res.status
    throw e
  }
  const j = await res.json()
  return Array.isArray(j) ? j : []
}

/** Geocoding balik: koordinat -> alamat. Dipakai saat pengguna memberi titik
 *  langsung (mis. "‑6.2, 106.8") atau memilih hasil yang hanya punya koordinat. */
async function balikGeocoding(lat, lon, batasMs = 12_000) {
  // Dibulatkan 5 desimal (~1 m): cukup presisi, dan membuat kueri berulang
  // untuk titik yang sama benar-benar memakai simpanan.
  const kunci = `${Number(lat).toFixed(5)},${Number(lon).toFixed(5)}`
  const tersimpan = simpananBalik.ambil(kunci)
  if (tersimpan !== null) return tersimpan

  const url =
    `${NOMINATIM_BASE}/reverse?format=jsonv2&addressdetails=1&zoom=18` +
    `&lat=${encodeURIComponent(lat)}&lon=${encodeURIComponent(lon)}`
  await antre('nominatim', NOMINATIM.jedaMs)
  const res = await fetch(url, {
    headers: { 'User-Agent': UA, 'Accept-Language': 'id,en;q=0.8' },
    signal: AbortSignal.timeout(batasMs),
  })
  if (!res.ok) throw new Error(`HTTP ${res.status}`)
  const j = await res.json()
  const hasil = j && j.address ? j : null
  // Hasil kosong ikut disimpan: titik di tengah laut memang tidak punya
  // alamat, dan menanyakan ulang ke layanan hanya membuang kuota.
  simpananBalik.simpan(kunci, hasil)
  return hasil
}

/**
 * Ubah satu hasil jadi bentuk yang dipakai antarmuka.
 *
 * Menerima DUA bentuk: hasil Nominatim (`lat`/`lon` string, `address` objek)
 * dan hasil Photon dari `photon.js` (`lat`/`lon` angka, `alamat` sudah jadi,
 * `petunjukWilayah`). Dibedakan lewat adanya `petunjukWilayah` — bukan lewat
 * nama layanan, supaya penambahan provider lain tidak memaksa perubahan di
 * sini.
 */
function bentukHasil(x, tabel) {
  const dariPhoton = x.petunjukWilayah !== undefined

  const lat = Number(x.lat)
  const lon = Number(x.lon)
  if (!Number.isFinite(lat) || !Number.isFinite(lon)) return null
  // Indonesia: tolak koordinat di luar batas. Nominatim kadang mengembalikan
  // hasil negara lain walau `countrycodes=id` sudah dipasang.
  if (lat < -11.5 || lat > 6.5 || lon < 94 || lon > 141.1) return null

  if (dariPhoton) {
    /*
     * Wilayah TIDAK diambil dari `petunjukWilayah`.
     *
     * Photon memberi `state: "Yogyakarta"`, bukan "Daerah Istimewa
     * Yogyakarta"; `city`/`county` juga tidak konsisten dengan pembagian
     * BPS. Memakainya akan menghasilkan kode wilayah yang salah atau kosong.
     *
     * Jadi wilayah ditanyakan ke Nominatim lewat titik koordinatnya. Itu satu
     * permintaan tambahan per pemilihan, bukan per ketikan — dan hasilnya
     * disimpan, jadi memilih alamat yang sama dua kali tidak menambah beban.
     */
    const petunjuk = x.petunjukWilayah ?? {}
    return {
      nama: x.nama ?? 'Lokasi',
      alamat: x.alamat ?? '',
      lat,
      lon,
      ketepatan: tingkatKetepatanDariPhoton(x.tipe),
      tipe: x.tipe ?? null,
      kategori: 'photon',
      kodePos: x.kodePos ?? petunjuk.kodePos ?? null,
      /*
       * `petunjukWilayah` DITERUSKAN ke antarmuka — bukan untuk identitas
       * wilayah (itu tetap dari Nominatim), melainkan untuk membedakan
       * kandidat yang namanya sama di kota berbeda. "Malioboro" ada di
       * Surabaya dan Yogyakarta; tanpa petunjuk ini daftar saran menampilkan
       * dua baris yang tampak identik.
       */
      petunjukWilayah: petunjuk,
      // Ditandai belum final: endpoint mengisi ini lewat geocoding balik
      // sebelum balasan dikirim. Kalau gagal, `dikenal:false` — bukan tebakan.
      wilayah: { dikenal: false, sumber: 'belum' },
      perluWilayah: true,
    }
  }

  const alamat = x.address ?? {}
  const w = deteksiWilayah(alamat, tabel ?? {})
  const bagian = String(x.display_name ?? '').split(',').map((s) => s.trim())
  return {
    // `nama` = bagian pertama display_name (biasanya nama tempat/jalan),
    // `alamat` = display_name penuh. Dua-duanya dari sumber, tidak dikarang.
    nama: bagian[0] || x.name || 'Lokasi',
    alamat: x.display_name ?? '',
    lat,
    lon,
    // Ketepatan disebut apa adanya: "titik" (gedung), "jalan", "kelurahan",
    // "kecamatan", "kabupaten", "provinsi". Antarmuka memakainya untuk
    // memberi tahu pengguna seberapa presisi titik ini.
    ketepatan: tingkatKetepatan(x),
    tipe: x.type ?? null,
    kategori: x.category ?? null,
    kodePos: alamat.postcode ?? null,
    wilayah: w,
  }
}

/**
 * Terjemahkan `type` Photon ke istilah ketepatan yang sama dengan Nominatim.
 *
 * Pemetaan ini DIPERIKSA terhadap nilai yang benar-benar keluar dari Photon
 * untuk alamat Indonesia (house, street, district, city, state, ...), bukan
 * daftar tebakan. Jenis yang tidak dikenal menghasilkan null — lebih baik
 * tidak menyebut ketepatan daripada menyebut yang salah.
 */
const KETEPATAN_PHOTON = {
  house: 'titik',
  street: 'jalan',
  locality: 'kelurahan',
  district: 'kecamatan',
  city: 'kabupaten',
  county: 'kabupaten',
  state: 'provinsi',
  country: 'provinsi',
}

function tingkatKetepatanDariPhoton(tipe) {
  return KETEPATAN_PHOTON[String(tipe ?? '').toLowerCase()] ?? null
}

/* ------------------------------------------------------------------ cari -- */

ruteAlamat.get('/api/alamat/cari', batasAlamat, bungkus(async (req, res) => {
  const q = String(req.query?.q ?? '').trim()
  if (q.length < 3) {
    res.status(400).json({ ok: false, code: 'kueri_pendek', pesan: 'Tulis minimal 3 karakter.', hasil: [] })
    return
  }
  if (q.length > 200) {
    res.status(400).json({ ok: false, code: 'kueri_panjang', pesan: 'Alamat terlalu panjang.', hasil: [] })
    return
  }

  const tabel = await muatTabelWilayah()
  if (!tabel) {
    // Tanpa tabel wilayah, pencarian alamat MASIH bisa jalan — hanya deteksi
    // wilayahnya kosong. Menolak seluruh permintaan karena tabel filter tidak
    // siap akan mematikan fitur yang tidak bergantung padanya.
    // (Kegagalan ini tetap terlihat: setiap hasil akan berlabel "tidak dikenal".)
  }

  try {
    /*
     * KANDIDAT: Photon dulu, Nominatim sebagai cadangan.
     *
     * Photon jauh lebih cepat untuk pencarian sebagian kata, dan itu yang
     * dibutuhkan autocomplete. Tapi Photon tidak memberi nama provinsi resmi
     * (lihat catatan di photon.js), jadi hasilnya hanya KANDIDAT: wilayahnya
     * tetap diperkaya lewat balikGeocoding -> deteksiWilayah di `bentukHasil`.
     *
     * Kalau Photon gagal (mati, 400, timeout), Nominatim dipakai supaya
     * fitur tidak ikut mati. Kegagalan itu dicatat di balasan (`sumberCari`)
     * agar tidak terlihat seperti Photon yang berhasil.
     */
    let mentah = []
    let sumberCari = 'photon'
    let photonGagal = null
    try {
      const p = await cariPhoton(q)
      mentah = p.hasil
      if (p.dariSimpanan) sumberCari = 'photon-simpanan'
    } catch (e) {
      photonGagal = e?.status ? `http_${e.status}` : 'jaringan'
      sumberCari = 'nominatim-cadangan'
    }

    // Photon kosong BUKAN berarti alamat tidak ada: indeksnya bisa melewatkan
    // alamat lengkap bergaya Indonesia (RT/RW, nama kompleks). Jadi Nominatim
    // tetap ditanya sebelum menyimpulkan "tidak ditemukan".
    if (!mentah.length) {
      const n = await tanyaNominatim(q)
      mentah = n
      sumberCari = photonGagal ? 'nominatim-cadangan' : 'nominatim'
    }

    const hasil = mentah.map((x) => bentukHasil(x, tabel)).filter(Boolean)

    // Kueri berupa koordinat: Nominatim tidak menemukan apa pun, tetapi
    // pengguna jelas memberi titik. Balik-geocoding memberi wilayahnya.
    if (!hasil.length) {
      const koor = q.match(/^(-?\d+(?:[.,]\d+)?)\s*[,;]\s*(-?\d+(?:[.,]\d+)?)$/)
      if (koor) {
        const lat = Number(koor[1].replace(',', '.'))
        const lon = Number(koor[2].replace(',', '.'))
        if (Math.abs(lat) <= 90 && Math.abs(lon) <= 180) {
          let titik = null
          try {
            titik = await balikGeocoding(lat, lon)
          } catch {
            titik = null
          }
          const w = titik ? deteksiWilayah(titik.address, tabel ?? {}) : deteksiWilayah({}, tabel ?? {})
          res.json({
            ok: true,
            kueri: q,
            jumlah: 1,
            hasil: [
              {
                nama: `${lat.toFixed(5)}, ${lon.toFixed(5)}`,
                alamat: titik?.display_name ?? 'Koordinat yang Anda masukkan',
                lat,
                lon,
                ketepatan: 'titik',
                tipe: 'koordinat',
                kategori: 'manual',
                kodePos: titik?.address?.postcode ?? null,
                wilayah: w,
              },
            ],
          })
          return
        }
      }
    }

    if (!hasil.length) {
      res.json({ ok: true, kueri: q, jumlah: 0, hasil: [], code: 'tidak_ditemukan' })
      return
    }

    /*
     * Beberapa kandidat: JANGAN pilih yang pertama diam-diam.
     *
     * Nominatim mengurutkan menurut kecocokan teks, bukan menurut kebenaran
     * administratif. Terukur: kueri "Cikarang Selatan" mengembalikan
     * "Permata Cikarang Selatan" (perumahan) di urutan pertama, sedangkan
     * kecamatan bernama sama bisa ada di urutan kedua. Antarmuka WAJIB meminta
     * pengguna memilih; server hanya menandai `perluPilih` supaya UI tidak
     * lupa.
     */
    res.set('Cache-Control', 'public, max-age=300')
    res.json({
      ok: true,
      kueri: q,
      jumlah: hasil.length,
      perluPilih: hasil.length > 1,
      /*
       * `sumberCari` menyebut layanan yang benar-benar menjawab: 'photon',
       * 'photon-simpanan', 'nominatim', atau 'nominatim-cadangan' (Photon
       * gagal). Ini bukan hiasan — tanpa ini, kegagalan Photon tidak terlihat
       * dan orang akan menyimpulkan Photon bekerja padahal tidak.
       */
      sumberCari,
      hasil,
    })
  } catch (e) {
    const kode = e?.status === 429 || e?.status === 403 ? 'kuota' : 'layanan_gagal'
    res.status(503).json({
      ok: false,
      code: kode,
      pesan:
        kode === 'kuota'
          ? 'Layanan pencarian alamat sedang membatasi permintaan. Coba lagi sebentar lagi, atau pakai pilihan wilayah.'
          : 'Layanan pencarian alamat sedang tidak dapat diakses. Coba lagi, atau pakai pilihan wilayah.',
      hasil: [],
    })
  }
}))

/* --------------------------------------------------------------- rincian -- */

ruteAlamat.get('/api/alamat/titik', batasAlamat, bungkus(async (req, res) => {
  const lat = Number(req.query?.lat)
  const lon = Number(req.query?.lon)
  if (!Number.isFinite(lat) || !Number.isFinite(lon)) {
    res.status(400).json({ ok: false, code: 'koordinat_kosong', pesan: 'Koordinat diperlukan.' })
    return
  }
  if (lat < -11.5 || lat > 6.5 || lon < 94 || lon > 141.1) {
    res.status(400).json({ ok: false, code: 'di_luar_indonesia', pesan: 'Titik itu di luar Indonesia.' })
    return
  }

  const tabel = await muatTabelWilayah()
  try {
    const j = await balikGeocoding(lat, lon)
    if (!j) {
      // Sumber menjawab tetapi tanpa address. Wilayah TIDAK ditebak: dilaporkan
      // tidak dikenali, dan koordinat tetap dipakai apa adanya.
      res.json({
        ok: true,
        lat,
        lon,
        alamat: null,
        wilayah: deteksiWilayah({}, tabel ?? {}),
        code: 'wilayah_tidak_dikenal',
      })
      return
    }
    const w = deteksiWilayah(j.address, tabel ?? {})
    res.set('Cache-Control', 'public, max-age=300')
    res.json({
      ok: true,
      lat,
      lon,
      alamat: j.display_name ?? null,
      kodePos: j.address?.postcode ?? null,
      ketepatan: 'titik',
      wilayah: w,
    })
  } catch {
    res.status(503).json({
      ok: false,
      code: 'layanan_gagal',
      pesan: 'Layanan pencarian alamat sedang tidak dapat diakses.',
    })
  }
}))

/* ------------------------------------------------------ wilayah (filter) -- */

/**
 * Daftar provinsi + kabupaten + kecamatan untuk dropdown, dibaca dari database.
 *
 * Kecamatan ikut disediakan karena deteksi wilayah alamat bisa berhenti di
 * tingkat kecamatan, dan pengguna perlu melihatnya sebagai teks — bukan untuk
 * memfilter, karena fasilitas SIRS tidak punya kolom kecamatan.
 */
ruteAlamat.get('/api/wilayah/lengkap', batasMetaLengkap(), bungkus(async (_req, res) => {
  const semua = await eksekusi(
    `SELECT kode, nama, tingkat, kode_induk FROM wilayah
      WHERE tingkat IN ('provinsi','kabupaten','kecamatan')
      ORDER BY kode`,
  )
  if (!Array.isArray(semua)) {
    res.status(503).json({ ok: false, code: 'db_mati', pesan: 'Database tidak tersambung.' })
    return
  }
  const kel = { provinsi: [], kabupaten: [], kecamatan: [] }
  for (const w of semua) if (kel[w.tingkat]) kel[w.tingkat].push(w)
  res.set('Cache-Control', 'public, max-age=3600')
  res.json({ ok: true, ...kel })
}))

function batasMetaLengkap() {
  return batasi({ ...LAJU.meta, nama: 'permintaan wilayah lengkap' })
}

/* ---------------------------------------------------------------- normal -- */

/**
 * Normalisasi nama wilayah dipakai juga oleh uji, dan sengaja diekspor dari
 * sini supaya uji tidak perlu mengimpor modul server penuh.
 */
export { normalNama }

export default ruteAlamat
