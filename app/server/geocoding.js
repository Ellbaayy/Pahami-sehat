/**
 * Geocoding alamat -> koordinat + wilayah administratif.
 * ============================================================================
 *
 * Sumber: Nominatim (OpenStreetMap). Aturan yang DIHORMATI:
 *   - `countrycodes=id` — aplikasi ini untuk Indonesia;
 *   - `limit` kecil (6) dan tidak ada polling;
 *   - User-Agent yang menyebut aplikasi dipasang di SERVER, bukan peramban
 *     (peramban tidak bisa mengubah User-Agent, dan Nominatim memblokir
 *     permintaan tanpa identitas).
 *
 * KENAPA DETEKSI WILAYAH TIDAK MEMBACA `address` APA ADANYA
 * ---------------------------------------------------------
 * Diukur 4 Nov 2026 pada 9 alamat Indonesia: bentuk `address` Nominatim TIDAK
 * konsisten sama sekali.
 *
 *   "Jl. Malioboro"   -> state "Daerah Istimewa Yogyakarta", city "Kota Yogyakarta",
 *                        kecamatan muncul sebagai `suburb` = "Sosromenduran"
 *                        (itu nama kelurahan, bukan kecamatan)
 *   "RSUD Soetomo"    -> kecamatan muncul sebagai `municipality` = "Gubeng"
 *   "Jl. Asia Afrika" -> kecamatan muncul sebagai `district` = "Lengkong"
 *   "Monas"           -> **tidak ada `state` sama sekali**; DKI Jakarta masuk ke `city`
 *   "Kuta"            -> `town` = "Kuta", tidak ada city/county
 *   "Cikarang Selatan"-> `county` kosong, `kab` tidak dikenali
 *
 * Membaca satu field tetap (mis. `state` untuk provinsi, `city` untuk kabupaten)
 * menghasilkan wilayah KOSONG atau SALAH untuk sebagian besar alamat. Karena
 * itu berkas ini memakai dua pendekatan berlapis:
 *
 *   1. **ISO3166-2-lvl4** -> kode provinsi BPS. Terukur andal: ID-JK, ID-YO,
 *      ID-JI, ID-BA semuanya benar. Ini yang dipakai lebih dulu untuk provinsi.
 *   2. **Nama-nama yang ada di address**, dicocokkan ke tabel `wilayah` milik
 *      aplikasi (bukan ke daftar tetap di kode) — untuk kabupaten dan kecamatan.
 *
 * Kalau tidak ada yang cocok, hasilnya `null` dan antarmuka MENGATAKAN wilayah
 * tidak dikenali. Tidak ada tebakan: menempatkan rumah sakit di provinsi yang
 * salah karena menebak lebih buruk daripada mengaku tidak tahu.
 */

/** ISO 3166-2 -> kode BPS provinsi. 38 provinsi, diukur 4 Nov 2026. */
export const ISO_PROVINSI = {
  'ID-AC': '11', // Aceh
  'ID-SU': '12', // Sumatera Utara
  'ID-SB': '13', // Sumatera Barat
  'ID-RI': '14', // Riau
  'ID-JA': '15', // Jambi
  'ID-SS': '16', // Sumatera Selatan
  'ID-BE': '17', // Bengkulu
  'ID-LA': '18', // Lampung
  'ID-BB': '19', // Kepulauan Bangka Belitung
  'ID-KR': '21', // Kepulauan Riau
  'ID-JK': '31', // DKI Jakarta
  'ID-JB': '32', // Jawa Barat
  'ID-JT': '33', // Jawa Tengah
  'ID-YO': '34', // Daerah Istimewa Yogyakarta
  'ID-JI': '35', // Jawa Timur
  'ID-BT': '36', // Banten
  'ID-BA': '51', // Bali
  'ID-NB': '52', // Nusa Tenggara Barat
  'ID-NT': '53', // Nusa Tenggara Timur
  'ID-KB': '61', // Kalimantan Barat
  'ID-KT': '62', // Kalimantan Tengah
  'ID-KS': '63', // Kalimantan Selatan
  'ID-KI': '64', // Kalimantan Timur
  'ID-KU': '65', // Kalimantan Utara
  'ID-SA': '71', // Sulawesi Utara
  'ID-ST': '72', // Sulawesi Tengah
  'ID-SN': '73', // Sulawesi Selatan
  'ID-SG': '74', // Sulawesi Tenggara
  'ID-GO': '75', // Gorontalo
  'ID-SR': '76', // Sulawesi Barat
  'ID-MA': '81', // Maluku
  'ID-MU': '82', // Maluku Utara
  'ID-PA': '91', // Papua
  'ID-PB': '92', // Papua Barat
  'ID-PS': '93', // Papua Selatan
  'ID-PT': '94', // Papua Tengah
  'ID-PE': '95', // Papua Pegunungan
  'ID-PD': '96', // Papua Barat Daya
}

/**
 * Kunci-kunci `address` Nominatim yang mungkin memuat kabupaten/kota.
 *
 * Urutannya penting: dari yang paling spesifik ke paling umum. `county` di
 * Indonesia biasanya kabupaten, `city` kota, `municipality` bisa keduanya
 * tergantung daerah (di Surabaya ia berisi kecamatan!).
 *
 * `region` ditambahkan 4 Nov 2026 setelah terukur: "Kuta Bali" mengembalikan
 * `region = "Badung"` dan TIDAK punya city/county. Tanpa kunci ini, kabupaten
 * Badung tidak dikenali sama sekali.
 *
 * DKI Jakarta istimewa: ia tidak punya `state` (ISO memberi provinsinya), dan
 * `city` berisi KOTA ADMINISTRASI ("Jakarta Pusat"), yang di tabel wilayah
 * berstatus kota dengan nama "Kota Administrasi Jakarta Pusat". Pencocokan
 * longgar menanganinya.
 */
const KUNCI_KABUPATEN = ['city', 'county', 'region', 'municipality', 'town', 'village', 'suburb']

/**
 * Kunci yang mungkin memuat kecamatan. Tidak ada jaminan konsisten — di
 * Surabaya kecamatan ada di `municipality`, di Bandung di `district`, di
 * Yogyakarta di `suburb`. Karena itu semuanya dicoba, dan hasilnya divalidasi
 * terhadap tabel `wilayah` (kecamatan harus berada di kabupaten yang benar).
 */
const KUNCI_KECAMATAN = [
  'city_district',
  'district',
  'suburb',
  'municipality',
  'village',
  'town',
  'hamlet',
  'neighbourhood',
]

/**
 * Normalisasi nama wilayah untuk pencocokan.
 *
 * Disalin dari `petakan-wilayah.mjs` (tidak diimpor karena berkas itu ada di
 * akar repo dengan dependensi mysql2 — server tidak boleh menyeretnya). Kalau
 * aturannya berubah, UBAH DI DUA TEMPAT; `uji-geocoding.mjs` memeriksa
 * keduanya menghasilkan kunci yang sama.
 */
export function normalNama(n) {
  return pisahJenis(n).nama
}

export function pisahJenis(n) {
  let s = String(n ?? '')
    .toLowerCase()
    .trim()
  s = s.replace(/\bdaerah istimewa yogyakarta\b/g, 'yogyakarta')
  s = s.replace(/\bdaerah khusus ibukota jakarta\b/g, 'jakarta')
  s = s.replace(/\bdki jakarta\b/g, 'jakarta')
  s = s.replace(/\bnanggroe aceh darussalam\b/g, 'aceh')
  s = s.replace(/\bkepulauan bangka belitung\b/g, 'bangka belitung')
  let jenis = 'kabupaten'
  if (/^(kota administrasi|kota|kodya|kotamadya)\b/.test(s)) jenis = 'kota'
  s = s.replace(/^(kota administrasi)\s+/, '')
  s = s.replace(/^(kabupaten administrasi)\s+/, '')
  s = s.replace(/^kab\.?\s+/, '')
  s = s.replace(/^(kabupaten|kota|kodya|kotamadya)\s+/, '')
  s = s.replace(/\bkepulauan\b/g, 'kep')
  s = s.replace(/[.,\-/]/g, ' ')
  s = s.replace(/\s+/g, ' ')
  s = s.trim()
  return { jenis, nama: s }
}

/**
 * Deteksi wilayah administratif dari satu hasil Nominatim.
 *
 * @param {object} alamat  objek `address` dari Nominatim
 * @param {object} tabel   { provinsi: [{kode,nama}], kabupaten: [{kode,nama,kode_induk}],
 *                           kecamatan: [{kode,nama,kode_induk}] }
 * @returns {{provinsi, kabupaten, kecamatan, kelurahan, tingkat, kodeProvinsi,
 *            kodeKabupaten, kodeKecamatan, dikenal:boolean}}
 */
export function deteksiWilayah(alamat, tabel) {
  const a = alamat ?? {}
  const hasil = {
    provinsi: null,
    kabupaten: null,
    kecamatan: null,
    kelurahan: null,
    kodeProvinsi: null,
    kodeKabupaten: null,
    kodeKecamatan: null,
    // tingkat = seberapa dalam yang BERHASIL dikenali. Dipakai antarmuka untuk
    // menyebut ketepatan lokasi apa adanya ("hanya sampai provinsi").
    tingkat: 'tidak_dikenal',
    dikenal: false,
  }

  /* 1. Provinsi: kode ISO dulu, baru nama. ------------------------------- */
  const iso = a['ISO3166-2-lvl4']
  if (iso && ISO_PROVINSI[iso]) {
    const p = (tabel.provinsi ?? []).find((x) => x.kode === ISO_PROVINSI[iso])
    if (p) {
      hasil.kodeProvinsi = p.kode
      hasil.provinsi = p.nama
    }
  }
  if (!hasil.kodeProvinsi) {
    // Cadangan: cocokkan nama provinsi dari address. DKI Jakarta tidak punya
    // `state`, jadi `city` ikut diperiksa.
    const calon = [a.state, a.region, a.city, a.province].filter(Boolean)
    for (const c of calon) {
      const p = (tabel.provinsi ?? []).find((x) => normalNama(x.nama) === normalNama(c))
      if (p) {
        hasil.kodeProvinsi = p.kode
        hasil.provinsi = p.nama
        break
      }
    }
  }

  /*
   * `city_district` adalah kunci yang MAKNA-nya berubah antar daerah — bukan
   * sekadar tidak konsisten:
   *
   *   Monas (DKI)      -> city_district = "Jakarta Pusat"  = KOTA ADMINISTRASI
   *   Malioboro (DIY)  -> city_district = "Gedongtengen"   = KECAMATAN
   *
   * Dulu kunci ini ditaruh di daftar kabupaten, dan akibatnya Malioboro
   * kehilangan kabupatennya ("Kota Yogyakarta" ada di `city`, bukan di sini).
   * Sekarang ia dicoba sebagai kabupaten LEBIH DULU (untuk DKI), lalu —
   * kalau tidak cocok di tingkat kabupaten — sebagai kecamatan.
   */
  const cityDistrict = a.city_district

  /* 2. Kabupaten/kota: harus berada di provinsi yang sudah dikenali. ----- */
  // Membatasi dengan provinsi mencegah "Bandung" (Jawa Barat) bertemu
  // "Bandung" di provinsi lain — kesalahan yang lebih buruk daripada kosong.
  if (hasil.kodeProvinsi) {
    /*
     * Nominatim sering membuang awalan "Kota"/"Kabupaten":
     *   "Universitas Indonesia" -> city "Depok"      (DB: "Kota Depok")
     *   "RSUD Dr. Soetomo"      -> city "Surabaya"   (DB: "Kota Surabaya")
     *   "Kuta Bali"             -> region "Badung"   (DB: "Kabupaten Badung")
     *
     * Karena itu pencocokan dilakukan DUA KALI: pertama ketat (jenis + nama),
     * lalu longgar (nama saja) — tetapi longgar hanya dipakai kalau hasilnya
     * UNIK di provinsi itu. Kalau "Bekasi" bisa berarti Kabupaten atau Kota,
     * keduanya tidak dipakai, dan wilayah dibiarkan kosong daripada salah.
     */
    const kandidatKab = (tabel.kabupaten ?? []).filter((x) => x.kode_induk === hasil.kodeProvinsi)
    const cocokLonggar = (nilai) => {
      const n = normalNama(nilai)
      if (!n) return null
      const sama = kandidatKab.filter((x) => normalNama(x.nama) === n)
      if (sama.length === 1) return sama[0]
      return null
    }

    // `city_district` dicoba lebih dulu sebagai kabupaten (kasus DKI).
    if (cityDistrict) {
      const ncd = normalNama(cityDistrict)
      const samaCd = kandidatKab.filter((x) => normalNama(x.nama) === ncd)
      if (samaCd.length === 1) {
        hasil.kodeKabupaten = samaCd[0].kode
        hasil.kabupaten = samaCd[0].nama
      }
    }

    for (const kunci of hasil.kodeKabupaten ? [] : KUNCI_KABUPATEN) {
      const nilai = a[kunci]
      if (!nilai) continue
      /*
       * Lewati nilai yang sebenarnya nama PROVINSI.
       *
       * Terukur pada Monas: `city` berisi "Daerah Khusus Ibukota Jakarta" —
       * itu provinsi, bukan kabupaten. Tanpa penjagaan ini, pencocokan longgar
       * bisa memakainya dan menempatkan titik di kabupaten yang salah.
       *
       * TETAPI penjagaan ini sempat MERUSAK kasus Yogyakarta, dan itu terbukti
       * di uji: provinsi "Daerah Istimewa Yogyakarta" dinormalkan menjadi
       * "yogyakarta", dan `city` = "Kota Yogyakarta" juga menjadi "yogyakarta".
       * Akibatnya kota yang sah dibuang sebagai "nama provinsi", dan Malioboro
       * kehilangan kabupatennya.
       *
       * Perbaikannya: hanya lewati kalau NILAI ASLINYA menyebut provinsi
       * secara eksplisit (mengandung kata provinsi/daerah/dki/dki jakarta),
       * bukan sekadar hasil normalisasi yang kebetulan sama.
       */
      const asli = String(nilai).toLowerCase()
      const provinsiEksplisit =
        /\b(provinsi|prov\.|daerah istimewa|daerah khusus ibukota|dki)\b/.test(asli) ||
        normalNama(nilai) === normalNama(hasil.provinsi)
      // "Kota Yogyakarta" TIDAK mengandung kata provinsi di atas, jadi lolos.
      if (provinsiEksplisit && pisahJenis(nilai).jenis !== 'kota') continue
      const kj = pisahJenis(nilai)
      /*
       * Pencocokan KETAT hanya dipakai kalau sumbernya MENYEBUT jenisnya.
       *
       * Beda penting antara dua sumber data:
       *   - SIRS membuang awalan kabupaten, jadi "Bekasi" = Kabupaten Bekasi.
       *     Aturan itu dipakai di petakan-wilayah.mjs dan benar di sana.
       *   - Nominatim membuang awalan KEDUANYA, jadi "Bekasi" bisa berarti
       *     Kabupaten Bekasi (32.16) MAUPUN Kota Bekasi (32.75). Tidak ada
       *     cara tahu dari teksnya.
       *
       * Terbukti di uji: dengan pencocokan ketat, "Bekasi" langsung dipilihkan
       * Kabupaten Bekasi — padahal sumbernya tidak pernah mengatakan itu.
       * Sekarang tanpa awalan eksplisit, hanya pencocokan LONGAR yang dipakai,
       * dan longar menolak kalau ada lebih dari satu kandidat.
       */
      const adaAwalanJenis = /^(kota administrasi|kota|kodya|kotamadya|kabupaten|kab\.)\b/i.test(
        String(nilai).trim(),
      )
      const ketat = adaAwalanJenis
        ? kandidatKab.find((x) => pisahJenis(x.nama).jenis === kj.jenis && normalNama(x.nama) === kj.nama)
        : null
      const k = ketat ?? cocokLonggar(nilai)
      if (k) {
        hasil.kodeKabupaten = k.kode
        hasil.kabupaten = k.nama
        break
      }
    }
  }

  /* 3. Kecamatan: harus berada di kabupaten yang sudah dikenali. -------- */
  if (hasil.kodeKabupaten) {
    for (const kunci of KUNCI_KECAMATAN) {
      const nilai = a[kunci]
      if (!nilai) continue
      const n = normalNama(nilai)
      if (!n) continue
      const k = (tabel.kecamatan ?? []).find((x) => x.kode_induk === hasil.kodeKabupaten && normalNama(x.nama) === n)
      if (k) {
        hasil.kodeKecamatan = k.kode
        hasil.kecamatan = k.nama
        break
      }
    }
  }

  /* 4. Kelurahan/desa: hanya nama, tidak dipakai untuk filter. ----------- */
  // Tabel `wilayah` di aplikasi tidak memuat tingkat desa (sengaja: SIRS tidak
  // menyediakannya). Jadi kelurahan hanya ditampilkan sebagai teks dari
  // sumber, TIDAK dipakai sebagai kunci apa pun.
  hasil.kelurahan = a.village || a.hamlet || a.neighbourhood || null

  hasil.tingkat = hasil.kodeKecamatan
    ? 'kecamatan'
    : hasil.kodeKabupaten
      ? 'kabupaten'
      : hasil.kodeProvinsi
        ? 'provinsi'
        : 'tidak_dikenal'
  hasil.dikenal = Boolean(hasil.kodeProvinsi)
  return hasil
}

/**
 * Tebak apakah sebuah hasil "cukup akurat" untuk dipakai sebagai titik asal.
 *
 * Nominatim bisa mengembalikan KOTA untuk kueri "Cikarang Selatan" (bukan
 * kecamatannya). Memakai titik kota itu sebagai asal pencarian fasilitas
 * menghasilkan daftar yang salah tempat, padahal terlihat meyakinkan. Hasil
 * seperti itu tetap DITAMPILKAN, tetapi diberi label tingkat ketepatannya.
 */
export function tingkatKetepatan(hasil) {
  const t = String(hasil?.type ?? '')
  const at = String(hasil?.addresstype ?? '')
  if (['house', 'building', 'amenity', 'shop', 'office', 'tourism'].includes(at)) return 'titik'
  if (['road', 'residential', 'neighbourhood', 'quarter'].includes(at)) return 'jalan'
  if (['village', 'hamlet', 'suburb', 'quarter'].includes(at) || ['village', 'hamlet'].includes(t)) return 'kelurahan'
  if (['district', 'municipality'].includes(at)) return 'kecamatan'
  if (['city', 'town', 'county'].includes(at)) return 'kabupaten'
  if (['state', 'region'].includes(at)) return 'provinsi'
  return 'lain'
}
