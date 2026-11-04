/**
 * Konfigurasi layanan luar — SATU tempat, mudah diganti lewat env.
 * ============================================================================
 *
 * KENAPA DIPUSATKAN
 * -----------------
 * Alamat layanan publik bisa mati, pindah, atau berubah kebijakan. Kalau
 * hostname ditulis tersebar di beberapa berkas, menggantinya berarti
 * memburu string di seluruh proyek. Di sini semuanya satu blok, dan setiap
 * nilai bisa ditimpa lewat environment tanpa menyentuh kode.
 *
 * SEMUA layanan di bawah GRATIS dan TANPA API KEY. Tidak ada Google Maps API
 * di mana pun: peta memakai Leaflet + OpenStreetMap, pencarian alamat memakai
 * Photon dan Nominatim, rute memakai OSRM dan Valhalla. Jadi tidak ada kunci
 * rahasia yang perlu disembunyikan dari frontend — dan tidak ada tagihan per
 * permintaan.
 *
 * PEMBAGIAN TUGAS (diukur 4 Nov 2026, bukan asumsi)
 * -------------------------------------------------
 *   Photon      -> autocomplete/ketik cepat. Jauh lebih cepat dari Nominatim
 *                  dan mendukung pencarian sebagian kata. TIDAK dipakai untuk
 *                  deteksi wilayah (lihat catatan di bawah).
 *   Nominatim   -> geocoding balik (koordinat -> alamat) dan deteksi wilayah
 *                  administratif. Memberi ISO3166-2-lvl4 yang andal.
 *   OSRM        -> rute kendaraan bermotor dan profil lain yang BENAR-BENAR
 *                  tersedia di instance-nya.
 *   Valhalla    -> rute jalan kaki, sepeda motor, dan mobil.
 *
 * CATATAN PHOTON YANG TERUKUR: parameter `lang=id` membuat Photon membalas
 * **HTTP 400**. Tanpa `lang`, hasil Indonesia keluar normal. Jadi `lang`
 * sengaja TIDAK dikirim ke Photon — bukan lupa.
 *
 * CATATAN PHOTON SOAL WILAYAH: `state` dari Photon berisi "Yogyakarta" atau
 * "Jawa", bukan "Daerah Istimewa Yogyakarta"/"Jawa Barat". Karena itu wilayah
 * hasil Photon TIDAK dianggap final; deteksi wilayah tetap lewat Nominatim
 * supaya kode BPS-nya benar.
 */

const env = (nama, bawaan) => {
  const v = process.env[nama]
  return v === undefined || v === '' ? bawaan : v
}

/* ------------------------------------------------------------- geocoding -- */

export const PHOTON = {
  /** Endpoint pencarian. Bisa diganti ke instance sendiri. */
  url: env('PHOTON_URL', 'https://photon.komoot.io/api/'),
  /** Batas hasil per permintaan; Photon mengizinkan sampai 50. */
  limit: Number(env('PHOTON_LIMIT', '6')),
  /**
   * Photon meminta tidak lebih dari ~1 permintaan/detik untuk instance
   * publik. Nilai ini dipakai sebagai jarak minimum antar permintaan dari
   * server yang sama (lihat antrean di bawah).
   */
  jedaMs: Number(env('PHOTON_JEDA_MS', '700')),
  /** Umur simpanan hasil pencarian, milidetik. */
  cacheMs: Number(env('PHOTON_CACHE_MS', String(10 * 60 * 1000))),
  /** Ukuran maksimum simpanan (jumlah kueri). */
  cacheMaks: Number(env('PHOTON_CACHE_MAKS', '200')),
  /**
   * `lang` TIDAK dikirim: terukur HTTP 400 di instance publik. Kalau instance
   * sendiri mendukungnya, isi lewat env dan nilainya akan dipakai.
   */
  lang: env('PHOTON_LANG', ''),
}

export const NOMINATIM = {
  url: env('NOMINATIM_URL', 'https://nominatim.openstreetmap.org'),
  /**
   * Kebijakan Nominatim: maksimal 1 permintaan/detik, dan WAJIB User-Agent
   * yang menyebut aplikasi. Keduanya dihormati di sisi server — peramban
   * tidak bisa mengubah User-Agent, jadi permintaan selalu diteruskan.
   */
  jedaMs: Number(env('NOMINATIM_JEDA_MS', '1100')),
  cacheMs: Number(env('NOMINATIM_CACHE_MS', String(10 * 60 * 1000))),
  cacheMaks: Number(env('NOMINATIM_CACHE_MAKS', '200')),
  ua: env(
    'NOMINATIM_UA',
    'PahamiSehat/1.0 (pendidikan kesehatan; +https://github.com/Ellbaayy/Pahami-sehat)',
  ),
}

/* ---------------------------------------------------------------- rute --- */

/**
 * OSRM: profil ditentukan oleh HOST, bukan oleh path.
 *
 * TERUKUR 4 Nov 2026 — ini penting dan mudah salah:
 *
 *   routing.openstreetmap.de/routed-car/route/v1/driving  -> 4,32 km / 6,4 mnt
 *   routing.openstreetmap.de/routed-foot/route/v1/driving -> 1,71 km / 22,9 mnt
 *   routing.openstreetmap.de/routed-bike/route/v1/driving -> 2,15 km / 16,1 mnt
 *
 * Perhatikan: ketiganya memakai path `/driving`, tetapi hasilnya BERBEDA —
 * jadi yang menentukan profil adalah nama host (`routed-car`, `routed-foot`,
 * `routed-bike`). Mengganti `/driving` menjadi `/foot` TIDAK mengubah apa pun.
 *
 * Instance `router.project-osrm.org` hanya menyediakan profil mobil. Karena
 * itu ia TIDAK dipakai untuk pejalan kaki: memakainya berarti memberi rute
 * mobil lalu menyebutnya "jalan kaki".
 *
 * MOTOR: `null`. BUKAN lupa — peladen publik routing.openstreetmap.de tidak
 * punya host `routed-motor` (diukur: host itu tidak ada). Memberi rute
 * `routed-car` lalu menamainya "sepeda motor" adalah persis kebohongan yang
 * dilarang. Untuk motor, Valhalla yang dipakai.
 */
export const OSRM_MODA = {
  mobil: {
    host: env('OSRM_MOBIL', 'https://routing.openstreetmap.de/routed-car'),
    // Path tetap '/driving' untuk ketiga host — lihat catatan di atas.
    profil: 'driving',
  },
  'jalan-kaki': {
    host: env('OSRM_KAKI', 'https://routing.openstreetmap.de/routed-foot'),
    profil: 'driving',
  },
  motor: null,
}

export const OSRM = {
  moda: OSRM_MODA,
  /** Kesegaran simpanan rute. Rute tidak berubah selama jalan tidak berubah. */
  cacheMs: Number(env('OSRM_CACHE_MS', String(30 * 60 * 1000))),
  cacheMaks: Number(env('OSRM_CACHE_MAKS', '120')),
  timeoutMs: Number(env('OSRM_TIMEOUT_MS', '20000')),
}

export const VALHALLA = {
  url: env('VALHALLA_URL', 'https://valhalla1.openstreetmap.de/route'),
  cacheMs: Number(env('VALHALLA_CACHE_MS', String(30 * 60 * 1000))),
  cacheMaks: Number(env('VALHALLA_CACHE_MAKS', '120')),
  timeoutMs: Number(env('VALHALLA_TIMEOUT_MS', '25000')),
}

/* --------------------------------------------------------- pembatas laju -- */

/**
 * Antrean sederhana per layanan: satu permintaan pada satu waktu, dengan jarak
 * minimum `jedaMs`.
 *
 * KENAPA PERLU: kebijakan Photon dan Nominatim meminta tidak lebih dari satu
 * permintaan per detik. Tanpa antrean, mengetik cepat dari beberapa pengguna
 * sekaligus bisa memicu pemblokiran IP — dan itu mematikan fitur untuk semua
 * orang, bukan hanya yang mengetik cepat.
 *
 * Bukan pengganti pembatas laju per-IP (itu ada di `batas.js`): ini menjaga
 * kesopanan ke PIHAK LUAR, sedangkan yang itu melindungi server sendiri.
 */
const antrean = new Map()

export function antre(nama, jedaMs) {
  const sebelumnya = antrean.get(nama) ?? Promise.resolve()
  const sekarang = sebelumnya.then(async () => {
    // Jarak dihitung dari SELESAINYA permintaan sebelumnya, bukan mulainya.
    await new Promise((r) => {
      setTimeout(r, jedaMs)
    })
  })
  // Rantai tidak boleh putus karena satu penolakan.
  antrean.set(
    nama,
    sekarang.catch(() => {}),
  )
  return sekarang
}

/* ------------------------------------------------------------- simpanan -- */

/**
 * Simpanan kecil dengan batas ukuran dan masa berlaku.
 *
 * Dipakai untuk hasil pencarian alamat dan rute. Tanpa ini, mengetik ulang
 * kueri yang sama (atau membuka kembali lokasi yang sama) menghabiskan kuota
 * layanan publik — dan layanan itu memblokir kalau dipakai berlebihan.
 */
export function buatSimpanan({ maks = 200, umurMs = 600000 } = {}) {
  const isi = new Map()
  return {
    ambil(kunci) {
      const v = isi.get(kunci)
      if (!v) return null
      if (Date.now() - v.waktu > umurMs) {
        isi.delete(kunci)
        return null
      }
      return v.nilai
    },
    simpan(kunci, nilai) {
      if (isi.size >= maks) {
        // Buang yang paling tua — cukup untuk beban seperti ini.
        const tertua = [...isi.entries()].sort((a, b) => a[1].waktu - b[1].waktu)[0]
        if (tertua) isi.delete(tertua[0])
      }
      isi.set(kunci, { waktu: Date.now(), nilai })
    },
    kosongkan() {
      isi.clear()
    },
    get ukuran() {
      return isi.size
    },
  }
}

/* ---------------------------------------------------- ringkasan konfigurasi -- */

/** Dipakai /api/meta dan uji: memastikan tidak ada API key yang bocor. */
export function ringkasanLayanan() {
  return {
    peta: 'Leaflet + OpenStreetMap (tanpa API key)',
    pencarianAlamat: {
      utama: 'Photon',
      url: PHOTON.url,
      catatan: 'lang tidak dikirim (HTTP 400 di instance publik)',
    },
    geocodingBalik: { layanan: 'Nominatim', url: NOMINATIM.url },
    rute: {
      /*
       * `motor: null` berarti OSRM TIDAK mendukung moda itu. Ditulis sebagai
       * null, bukan dihilangkan: menghilangkannya membuat pembaca mengira
       * moda itu lupa didaftarkan, padahal sengaja tidak didaftarkan.
       */
      osrm: Object.fromEntries(
        Object.entries(OSRM.moda).map(([moda, k]) => [moda, k ? k.host : null]),
      ),
      osrmTidakMendukung: Object.entries(OSRM.moda)
        .filter(([, k]) => !k)
        .map(([moda]) => moda),
      valhalla: VALHALLA.url,
    },
    googleMapsApiKey: false,
  }
}
