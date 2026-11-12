/**
 * Perencana pembersihan duplikat fasilitas — FUNGSI MURNI, tanpa database.
 *
 * ============================================================================
 * MASALAH YANG DIPECAHKAN
 * ============================================================================
 *
 * Dua sumber (SIRS Kemenkes dan OpenStreetMap) diimpor dengan kunci unik
 * masing-masing: `kode_rs` untuk SIRS, `kode_osm` untuk OSM. Tidak ada yang
 * menyatukan keduanya, jadi satu rumah sakit bisa masuk DUA kali — sekali
 * sebagai baris resmi SIRS (tanpa koordinat) dan sekali sebagai objek OSM
 * (berkoordinat). Terukur 12 Nov 2026: 21.477 baris, 589 di antaranya (2,7%)
 * adalah fasilitas yang sama tercatat lebih dari sekali.
 *
 * Di dalam OSM sendiri ada duplikat sejenis: satu fasilitas terpetakan sebagai
 * *way* (gedung) DAN *node* (titik) dengan nama sama di koordinat yang hampir
 * identik (terukur < 50 m, sering 0 m).
 *
 * ============================================================================
 * ATURAN YANG DIPAKAI (dan kenapa bukan yang lain)
 * ============================================================================
 *
 * A. DALAM SATU SUMBER: nama sama (setelah dinormalkan) DAN jarak < 50 m.
 *    Yang disimpan: baris paling lengkap; bila sama lengkap, id terkecil.
 *    Jarak dipakai supaya cabang jaringan dengan nama sama di kota yang sama
 *    (mis. dua gerai apotek) TIDAK ikut terhapus.
 *
 * B. LINTAS SUMBER: nama sama DAN provinsi sama DAN kabupaten/kota sama, dan
 *    kelompoknya memuat SIRS sekaligus OSM. Yang disimpan: baris SIRS (identitas
 *    resmi: kode RS, kelas, kepemilikan). Baris OSM dihapus, TETAPI koordinatnya
 *    dipindahkan ke baris SIRS dan `kode_osm` disimpan sebagai rujukan asal
 *    koordinat. Koordinatnya nyata milik objek OSM yang sama — bukan dikarang —
 *    dan tetap bisa dilacak lewat `kode_osm`.
 *
 *    Kenapa SIRS yang disimpan, bukan OSM: filter "kelas rumah sakit" dan
 *    identitas resmi hanya ada di SIRS. Kehilangan koordinat untuk 128 rumah
 *    sakit lebih merugikan daripada kehilangan identitas resminya.
 *
 * Yang SENGAJA tidak dilakukan: menggabungkan baris hanya karena namanya mirip
 * ("RS Hermina" vs "RS Hermina Makassar") atau karena kotanya sama tanpa nama
 * yang sama. Itu akan mengarang keyakinan bahwa dua entitas berbeda adalah satu.
 */

/** Normalkan nama untuk perbandingan: huruf kecil, spasi dirapatkan. */
export function normalkan(nama) {
  return String(nama ?? '')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim()
}

/**
 * Apakah nilai benar-benar berisi angka.
 *
 * PENTING: `Number(null)` adalah 0 dan `Number('')` juga 0. Tanpa pemeriksaan
 * ini, dua baris SIRS yang SAMA-SAMA TIDAK berkoordinat akan dianggap berada di
 * titik 0,0 yang sama lalu dihapus sebagai "duplikat" — kesalahan yang pernah
 * muncul di dry run pertama 12 Nov 2026.
 */
function adaAngka(v) {
  return v !== null && v !== undefined && String(v).trim() !== '' && Number.isFinite(Number(v))
}

/** Jarak dua titik dalam meter (haversine). */
export function jarakMeter(a, b) {
  if (![a?.lat, a?.lon, b?.lat, b?.lon].every(adaAngka)) return Infinity
  const R = 6371000
  const rad = (d) => (Number(d) * Math.PI) / 180
  const lat1 = rad(a.lat)
  const lat2 = rad(b.lat)
  const dLat = rad(b.lat) - rad(a.lat)
  const dLon = rad(b.lon) - rad(a.lon)
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLon / 2) ** 2
  return 2 * R * Math.asin(Math.min(1, Math.sqrt(h)))
}

/** Berapa banyak kolom yang benar-benar terisi — dipakai memilih baris terbaik. */
export function isian(baris) {
  const kolom = [
    'alamat', 'telepon', 'email', 'website', 'jam_operasional', 'layanan',
    'provinsi', 'kabupaten', 'kecamatan', 'kelurahan', 'kode_provinsi', 'kode_kabupaten',
    'jenis_rs', 'kelas_rs', 'kepemilikan', 'subkategori',
  ]
  let n = 0
  for (const k of kolom) {
    const v = baris?.[k]
    if (v !== null && v !== undefined && String(v).trim() !== '') n += 1
  }
  if (adaAngka(baris?.lat) && adaAngka(baris?.lon)) n += 2
  if (baris?.kode_rs) n += 1
  if (baris?.kode_osm) n += 1
  return n
}

/** Nama yang tidak unik: dua fasilitas berbeda bisa memakai nama yang sama. */
const NAMA_GENERIK = new Set([
  'posyandu', 'pustu', 'polindes', 'poskesdes', 'apotek', 'klinik', 'puskesmas',
  'rumah sakit', 'rs', 'rsud', 'pkm', 'pusling', 'bidan', 'dokter', 'laboratorium',
  'lab', 'optik', 'toko obat', 'balai pengobatan', 'praktik mandiri',
])

/** Apakah nama ini terlalu umum untuk dipakai sebagai bukti "fasilitas yang sama". */
export function namaGenerik(nama) {
  const n = normalkan(nama)
  return n.length < 8 || NAMA_GENERIK.has(n)
}

/**
 * Susun rencana pembersihan.
 *
 * @param {Array<object>} baris  baris fasilitas (id, nama, sumber, lat, lon, provinsi, kabupaten, ...)
 * @param {{jangkauanMeter?: number}} opsi
 * @returns {{hapus: Array<{id:number, alasan:string, kembar:number[]}>, gabung: Array<object>, ringkasan: object}}
 */
export function rencanakanDedup(baris, { jangkauanMeter = 50, jangkauanNamaPendek = 5 } = {}) {
  /*
   * Nama generik seperti "posyandu", "pustu", "polindes", atau "apotek" tidak
   * unik: dua fasilitas berbeda di desa yang sama bisa punya nama itu dan
   * berjarak < 50 m. Untuk nama seperti itu (atau nama di bawah 8 huruf),
   * batasnya diperketat menjadi 5 m — praktis hanya menangkap objek yang SAMA
   * yang terpetakan dua kali. "puskesmas" (9 huruf) juga generik, jadi daftar
   * kata ini diperlukan; panjang nama saja tidak cukup.
   */
  const semua = (baris ?? []).filter((b) => b && Number.isFinite(Number(b.id)))
  const dihapus = new Map() // id -> alasan
  const gabung = []

  // ---- Aturan A: duplikat dalam satu sumber ----
  const perNamaSumber = new Map()
  for (const b of semua) {
    const kunci = `${normalkan(b.nama)}\u0000${b.sumber ?? ''}`
    if (!perNamaSumber.has(kunci)) perNamaSumber.set(kunci, [])
    perNamaSumber.get(kunci).push(b)
  }

  const alasanA = []
  for (const kelompok of perNamaSumber.values()) {
    if (kelompok.length < 2) continue
    /*
     * Pengelompokan "pemimpin" (greedy leader), BUKAN rantai transitif.
     *
     * Rantai transitif pernah dipakai dan hasilnya menipu: A–B 40 m, B–C 40 m,
     * tetapi A–C 67 m — C ikut terhapus padahal jaraknya ke baris yang
     * dipertahankan sudah lewat batas. Dengan cara ini SETIAP baris yang
     * dihapus dijamin berjarak ≤ batas dari baris yang benar-benar disimpan,
     * sehingga alasannya bisa diperiksa satu per satu.
     */
    const sisa = [...kelompok].sort((a, b) => isian(b) - isian(a) || a.id - b.id)
    const dipakai = new Set()
    for (let i = 0; i < sisa.length; i += 1) {
      const simpan = sisa[i]
      if (dipakai.has(simpan.id)) continue
      for (let j = i + 1; j < sisa.length; j += 1) {
        const b = sisa[j]
        if (dipakai.has(b.id)) continue
        const batas = namaGenerik(simpan.nama) || namaGenerik(b.nama) ? jangkauanNamaPendek : jangkauanMeter
        const jarak = jarakMeter(b, simpan)
        if (jarak > batas) continue
        dipakai.add(b.id)
        dihapus.set(b.id, `duplikat ${b.sumber ?? ''} dari #${simpan.id} (nama sama, ${Math.round(jarak)} m)`)
        alasanA.push({ id: b.id, simpan: simpan.id, jarak: Math.round(jarak) })
      }
    }
  }

  // ---- Aturan B: duplikat lintas sumber ----
  const perNamaWilayah = new Map()
  for (const b of semua) {
    if (dihapus.has(b.id)) continue
    const kunci = [normalkan(b.nama), normalkan(b.provinsi), normalkan(b.kabupaten)].join('\u0000')
    if (!perNamaWilayah.has(kunci)) perNamaWilayah.set(kunci, [])
    perNamaWilayah.get(kunci).push(b)
  }

  for (const kelompok of perNamaWilayah.values()) {
    if (kelompok.length < 2) continue
    const sirs = kelompok.filter((b) => b.sumber === 'SIRS Kemenkes')
    const osm = kelompok.filter((b) => b.sumber === 'OpenStreetMap')
    if (!sirs.length || !osm.length) continue

    const tetap = [...sirs].sort((a, b) => a.id - b.id)[0]
    const sumberKoordinat = osm.find((b) => adaAngka(b.lat) && adaAngka(b.lon))

    if (sumberKoordinat) {
      gabung.push({
        id: tetap.id,
        dariId: sumberKoordinat.id,
        lat: Number(sumberKoordinat.lat),
        lon: Number(sumberKoordinat.lon),
        // kode_osm hanya diisi kalau baris SIRS belum punya; kalau sudah, dibiarkan.
        kodeOsm: tetap.kode_osm || sumberKoordinat.kode_osm || null,
      })
    }
    for (const b of osm) {
      dihapus.set(b.id, `duplikat OSM dari #${tetap.id} (nama + kabupaten sama, sumber SIRS resmi)`)
    }
  }

  // Baris yang disimpan tidak boleh ikut terhapus (jaga-jaga urutan aturan).
  for (const g of gabung) dihapus.delete(g.id)

  const daftarHapus = [...dihapus.entries()]
    .map(([id, alasan]) => ({ id: Number(id), alasan }))
    .sort((a, b) => a.id - b.id)

  return {
    hapus: daftarHapus,
    gabung,
    ringkasan: {
      total: semua.length,
      dihapus: daftarHapus.length,
      sisa: semua.length - daftarHapus.length,
      digabungKoordinat: gabung.length,
      dalamSumber: alasanA.length,
      lintasSumber: daftarHapus.length - alasanA.length,
      jarakDalamSumber: {
        nol: alasanA.filter((a) => a.jarak === 0).length,
        sampai10: alasanA.filter((a) => a.jarak > 0 && a.jarak <= 10).length,
        sampai25: alasanA.filter((a) => a.jarak > 10 && a.jarak <= 25).length,
        sampai50: alasanA.filter((a) => a.jarak > 25).length,
      },
    },
  }
}
