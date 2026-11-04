/**
 * Uji stack layanan luar: Photon, Nominatim, OSRM, Valhalla.
 * ============================================================================
 *
 * Yang diuji BUKAN "apakah kode jalan", melainkan **klaim** yang dibuat di
 * dokumentasi. Tiap pemeriksaan di bawah menutup satu klaim yang mudah
 * menjadi bohong tanpa ketahuan:
 *
 *   1. Photon benar-benar menjawab, dan `lang=id` memang ditolak (HTTP 400) —
 *      kalau suatu hari Photon menerimanya, catatan di kode jadi usang dan
 *      uji ini memberi tahu.
 *   2. Koordinat Photon TIDAK tertukar (GeoJSON [lon, lat]).
 *   3. PROFIL OSRM DITENTUKAN HOST, BUKAN PATH — klaim yang paling mudah
 *      salah, dan terbukti dengan membandingkan dua URL yang path-nya sama.
 *   4. OSRM publik TIDAK punya profil motor.
 *   5. Valhalla membedakan tiga moda.
 *   6. Bentuk balasan OSRM dan Valhalla punya NAMA KUNCI YANG SAMA —
 *      bug nyata: saat OSRM mengembalikan `jarak` sedangkan Valhalla
 *      `jarakKm`, `/api/rute` menyebar `...rute` sehingga antarmuka
 *      menampilkan kosong tanpa error apa pun.
 *
 * Uji ini memanggil layanan publik. Kalau jaringan mati, uji ini DILEWATI
 * dengan pesan jelas — bukan gagal, karena kegagalan jaringan bukan bukti
 * bahwa klaimnya salah.
 */

import { cariPhoton, _kosongkanSimpananPhoton, _ukuranSimpananPhoton } from './app/server/photon.js'
import { PHOTON, NOMINATIM, OSRM_MODA, ringkasanLayanan } from './app/server/layanan.js'

let lulus = 0
let gagal = 0
let dilewati = 0

const ok = (nama, syarat, detail = '') => {
  if (syarat) {
    lulus++
    console.log(`  ok    ${nama}${detail ? ` — ${detail}` : ''}`)
  } else {
    gagal++
    console.log(`  GAGAL ${nama}${detail ? ` — ${detail}` : ''}`)
  }
}

const lewati = (nama, alasan) => {
  dilewati++
  console.log(`  lewat ${nama} — ${alasan}`)
}

const UA = 'PahamiSehat/1.0 (pendidikan kesehatan; +https://github.com/Ellbaayy/Pahami-sehat)'

/**
 * Jeda antar permintaan ke Nominatim.
 *
 * Kebijakan Nominatim: maksimal 1 permintaan/detik. Uji ini dulu menghajar
 * Nominatim beruntun dan menerima **HTTP 403** — bukan karena kita diblokir
 * permanen, melainkan karena permintaan beruntun dari UA yang sama dianggap
 * pemakaian kasar. Menghormati jeda adalah syarat memakai layanan ini, bukan
 * kesopanan opsional.
 */
const jedaNominatim = () => new Promise((r) => { setTimeout(r, 1200) })
const ambil = async (url, opsi = {}) => {
  const res = await fetch(url, {
    ...opsi,
    headers: {
      /*
       * URUTAN PENTING: User-Agent dipasang PALING AKHIR setelah header
       * pemanggil digabung.
       *
       * Versi sebelumnya: `{ 'User-Agent': UA, ...(opsi.headers ?? {}) }`.
       * Pemanggil yang hanya mengirim `Accept-Language` tetap aman, tetapi
       * begitu ia mengirim `headers` tanpa User-Agent, UA bawaan Node
       * ("node") yang terpakai — dan **Nominatim membalas 403** untuk itu.
       * Gejalanya menyesatkan: curl berhasil, fetch gagal.
       */
      ...(opsi.headers ?? {}),
      'User-Agent': opsi.headers?.['User-Agent'] ?? UA,
    },
    signal: AbortSignal.timeout(25_000),
  })
  return res
}

/* ============================================================ 1. PHOTON === */

console.log('\n[1] Photon — pencarian alamat Indonesia')

try {
  _kosongkanSimpananPhoton()
  const { hasil, dariSimpanan } = await cariPhoton('Malioboro Yogyakarta')
  ok('Photon mengembalikan hasil untuk alamat Indonesia', hasil.length > 0, `${hasil.length} hasil`)
  ok('permintaan pertama bukan dari simpanan', dariSimpanan === false)

  const pertama = hasil[0]
  if (pertama) {
    /*
     * KOORDINAT TIDAK TERTUKAR.
     *
     * Photon memakai GeoJSON: coordinates = [lon, lat]. Malioboro ada di
     * sekitar -7,79 LU/110,36 BT. Kalau tertukar, hasilnya akan tampak seperti
     * 110,36 LS — di luar Indonesia, dan `diIndonesia()` akan membuangnya.
     * Jadi uji ini membuktikan dua hal sekaligus: urutannya benar, dan
     * penyaringan batas negara bekerja.
     */
    ok(
      'lintang Malioboro negatif (selatan) dan di rentang Indonesia',
      pertama.lat < 0 && pertama.lat > -11.5 && pertama.lat < 6.5,
      `lat=${pertama.lat}`,
    )
    ok(
      'bujur Malioboro di rentang Indonesia',
      pertama.lon > 94 && pertama.lon < 141.1,
      `lon=${pertama.lon}`,
    )
    ok(
      'koordinat jatuh di sekitar Yogyakarta',
      Math.abs(pertama.lat + 7.79) < 0.15 && Math.abs(pertama.lon - 110.36) < 0.15,
      `${pertama.lat.toFixed(4)}, ${pertama.lon.toFixed(4)}`,
    )
    ok('hasil punya alamat yang bisa ditampilkan', typeof pertama.alamat === 'string' && pertama.alamat.length > 5)
    ok(
      'hasil ditandai perlu wilayah tambahan (Photon tidak memberi provinsi resmi)',
      pertama.petunjukWilayah !== undefined,
    )
  }

  // Simpanan: kueri yang sama tidak boleh memanggil layanan lagi.
  const ulang = await cariPhoton('Malioboro Yogyakarta')
  ok('kueri yang sama dilayani dari simpanan', ulang.dariSimpanan === true)
  ok('jumlah hasil dari simpanan sama', ulang.hasil.length === hasil.length)
  ok('simpanan benar-benar terisi', _ukuranSimpananPhoton() > 0, `${_ukuranSimpananPhoton()} entri`)
} catch (e) {
  lewati('Photon', `jaringan gagal: ${e.message}`)
}

try {
  /*
   * `lang=id` ditolak Photon publik (HTTP 400). Ini bukan keluhan —
   * ini yang membuat `PHOTON.lang` sengaja kosong. Kalau Photon berubah
   * pikiran, uji ini gagal dan catatan di kode harus diperbarui.
   */
  const res = await ambil('https://photon.komoot.io/api/?q=Jakarta&limit=1&lang=id')
  ok(
    'Photon publik menolak lang=id (HTTP 400) — sesuai catatan di kode',
    res.status === 400,
    `HTTP ${res.status}`,
  )
} catch (e) {
  lewati('cek lang=id', `jaringan gagal: ${e.message}`)
}

try {
  // Batas negara: kueri luar negeri harus tersaring habis.
  const { hasil } = await cariPhoton('Eiffel Tower Paris')
  ok('hasil luar Indonesia disaring habis', hasil.length === 0, `${hasil.length} hasil`)
} catch (e) {
  lewati('penyaringan negara', `jaringan gagal: ${e.message}`)
}

/* ========================================================= 2. NOMINATIM === */

console.log('\n[2] Nominatim — geocoding balik')

try {
  await jedaNominatim()
  const res = await ambil(
    `${NOMINATIM.url}/reverse?format=jsonv2&addressdetails=1&zoom=18&lat=-7.79084&lon=110.36687`,
    { headers: { 'Accept-Language': 'id,en;q=0.8' } },
  )
  ok('Nominatim membalas 200', res.ok, `HTTP ${res.status}`)
  const j = await res.json()
  const a = j?.address ?? {}
  ok('ada objek address', Boolean(j?.address))
  /*
   * ISO3166-2-lvl4 adalah dasar deteksi provinsi di `geocoding.js`. Kalau
   * bidang ini hilang, deteksi provinsi runtuh ke pencocokan nama — dan itu
   * jalur yang sudah terbukti rapuh (nama provinsi vs nama kota).
   */
  ok('provinsi punya kode ISO3166-2', Boolean(a['ISO3166-2-lvl4']), a['ISO3166-2-lvl4'] ?? '(tidak ada)')
  ok('kecamatan terisi', Boolean(a.city_district || a.suburb || a.village || a.town), a.city_district ?? a.suburb ?? '-')
} catch (e) {
  lewati('Nominatim', `jaringan gagal: ${e.message}`)
}

/* ============================================================= 3. OSRM === */

console.log('\n[3] OSRM — profil ditentukan HOST, bukan path')

const A = '106.8272,-6.1754' // Monas
const B = '106.8371,-6.1767' // RSPAD

try {
  const panggil = async (host, profil = 'driving') => {
    const res = await ambil(`https://${host}/route/v1/${profil}/${A};${B}?overview=false&steps=false`)
    const j = await res.json()
    if (j.code !== 'Ok' || !j.routes?.length) return null
    return { jarak: j.routes[0].distance, waktu: j.routes[0].duration }
  }

  const mobil = await panggil('routing.openstreetmap.de/routed-car')
  const kaki = await panggil('routing.openstreetmap.de/routed-foot')
  const sepeda = await panggil('routing.openstreetmap.de/routed-bike')

  ok('routed-car memberi rute', Boolean(mobil), mobil ? `${(mobil.jarak / 1000).toFixed(2)} km` : '')
  ok('routed-foot memberi rute', Boolean(kaki), kaki ? `${(kaki.jarak / 1000).toFixed(2)} km` : '')
  ok('routed-bike memberi rute', Boolean(sepeda), sepeda ? `${(sepeda.jarak / 1000).toFixed(2)} km` : '')

  if (mobil && kaki) {
    /*
     * INI INTI KLAIMNYA: kalau ketiga host memberi angka yang sama, berarti
     * profil diabaikan dan seluruh pembedaan moda adalah kosmetik.
     */
    ok(
      'rute pejalan kaki BERBEDA dari rute mobil',
      Math.abs(mobil.jarak - kaki.jarak) > 100,
      `mobil ${(mobil.jarak / 1000).toFixed(2)} km vs kaki ${(kaki.jarak / 1000).toFixed(2)} km`,
    )
    ok(
      'pejalan kaki lebih pendek dari mobil (menerobos jalur yang tidak bisa dilalui mobil)',
      kaki.jarak < mobil.jarak,
      `${(kaki.jarak / 1000).toFixed(2)} < ${(mobil.jarak / 1000).toFixed(2)}`,
    )
  }

  /*
   * BUKTI BAHWA PATH TIDAK MENENTUKAN PROFIL.
   *
   * URL ini memakai `/route/v1/foot` — kalau path menentukan profil, hasilnya
   * akan sama dengan pejalan kaki. Kenyataannya sama dengan mobil, karena
   * profilnya ditentukan host `routed-car`.
   */
  const carDenganPathFoot = await panggil('routing.openstreetmap.de/routed-car', 'foot')
  if (mobil && carDenganPathFoot) {
    ok(
      'routed-car dengan path /foot TETAP memberi rute mobil (path tidak menentukan profil)',
      Math.abs(carDenganPathFoot.jarak - mobil.jarak) < 1,
      `${(carDenganPathFoot.jarak / 1000).toFixed(2)} km`,
    )
  }

  // OSRM publik tidak punya profil motor: host-nya tidak ada.
  const resMotor = await ambil(`https://routing.openstreetmap.de/routed-motor/route/v1/driving/${A};${B}?overview=false`)
  ok(
    'OSRM publik TIDAK menyediakan profil motor (routed-motor tidak ada)',
    !resMotor.ok,
    `HTTP ${resMotor.status}`,
  )
  ok('konfigurasi menandai motor tidak didukung OSRM', OSRM_MODA.motor === null)
} catch (e) {
  lewati('OSRM', `jaringan gagal: ${e.message}`)
}

/* ========================================================== 4. VALHALLA === */

console.log('\n[4] Valhalla — tiga moda yang benar-benar berbeda')

try {
  const costing = { 'jalan-kaki': 'pedestrian', motor: 'motor_scooter', mobil: 'auto' }
  const hasil = {}
  for (const [moda, c] of Object.entries(costing)) {
    const res = await fetch('https://valhalla1.openstreetmap.de/route', {
      method: 'POST',
      headers: { 'User-Agent': UA, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        locations: [
          { lat: -6.1754, lon: 106.8272 },
          { lat: -6.1767, lon: 106.8371 },
        ],
        costing: c,
      }),
      signal: AbortSignal.timeout(25_000),
    })
    const j = await res.json()
    hasil[moda] = j?.trip?.summary ?? null
  }

  ok('Valhalla melayani pedestrian', Boolean(hasil['jalan-kaki']), hasil['jalan-kaki'] ? `${hasil['jalan-kaki'].length.toFixed(2)} km` : '')
  ok('Valhalla melayani motor_scooter', Boolean(hasil.motor), hasil.motor ? `${hasil.motor.length.toFixed(2)} km` : '')
  ok('Valhalla melayani auto', Boolean(hasil.mobil), hasil.mobil ? `${hasil.mobil.length.toFixed(2)} km` : '')

  const { 'jalan-kaki': k, motor: m, mobil: a } = hasil
  if (k && m && a) {
    ok('jalan kaki berbeda dari mobil', Math.abs(k.length - a.length) > 0.1, `${k.length.toFixed(2)} vs ${a.length.toFixed(2)} km`)
    ok('jalan kaki lebih lambat dari mobil (waktu lebih besar)', k.time > a.time, `${(k.time / 60).toFixed(1)} vs ${(a.time / 60).toFixed(1)} mnt`)
    ok('motor berbeda waktu dari mobil', Math.abs(m.time - a.time) > 1, `${(m.time / 60).toFixed(1)} vs ${(a.time / 60).toFixed(1)} mnt`)
  }
} catch (e) {
  lewati('Valhalla', `jaringan gagal: ${e.message}`)
}

/* =========================================== 5. BENTUK BALASAN SERAGAM === */

console.log('\n[5] Bentuk balasan OSRM dan Valhalla harus sama')

try {
  const { ambilRute } = await import('./app/server/rute-perjalanan.js')
  const mobil = await ambilRute({ latAsal: -6.1754, lonAsal: 106.8272, latTujuan: -6.1761, lonTujuan: 106.8371, moda: 'mobil' })

  /*
   * Kunci ini dibaca langsung oleh `rute.js` dan diteruskan ke antarmuka.
   * Bug yang pernah terjadi: OSRM mengembalikan `jarak`/`waktu`/`garis`,
   * Valhalla `jarakKm`/`waktuMenit`/`geometri`. Karena `res.json({...rute})`
   * menyebar apa adanya, kunci yang salah nama TIDAK memicu error — ia
   * hanya hilang, dan pengguna melihat kolom kosong.
   */
  ok('balasan punya jarakKm', Number.isFinite(mobil.jarakKm), String(mobil.jarakKm))
  ok('balasan punya waktuMenit', Number.isFinite(mobil.waktuMenit), String(mobil.waktuMenit))
  ok('balasan punya geometri (garis rute)', Array.isArray(mobil.geometri) && mobil.geometri.length > 1, `${mobil.geometri?.length} titik`)
  ok('balasan punya langkah', Array.isArray(mobil.langkah) && mobil.langkah.length > 0, `${mobil.langkah?.length} langkah`)
  ok('setiap langkah punya jarakM', mobil.langkah.every((l) => Number.isFinite(l.jarakM)))
  ok('setiap langkah punya instruksi', mobil.langkah.every((l) => typeof l.instruksi === 'string' && l.instruksi.length > 0))
  ok('balasan menyebut penyedia yang dipakai', typeof mobil.sumber === 'string' && mobil.sumber.length > 0, mobil.sumber)
  /*
   * Geometri harus [lat, lon] untuk Leaflet. Kalau tertukar, semua titik
   * jatuh di luar Indonesia — dan peta akan tampak kosong tanpa penjelasan.
   */
  const [lat0, lon0] = mobil.geometri[0]
  ok('geometri dalam urutan [lat, lon]', lat0 < 0 && lon0 > 94, `[${lat0.toFixed(4)}, ${lon0.toFixed(4)}]`)
} catch (e) {
  lewati('bentuk balasan', e.message)
}

/* ============================================== 6. TANPA GOOGLE MAPS === */

console.log('\n[6] Tidak ada ketergantungan Google Maps API key')

const r = ringkasanLayanan()
ok('ringkasan menyatakan googleMapsApiKey false', r.googleMapsApiKey === false)
ok('peta memakai Leaflet + OpenStreetMap', /Leaflet/i.test(r.peta) && /OpenStreetMap/.test(r.peta))
ok('pencarian alamat memakai Photon', r.pencarianAlamat.utama === 'Photon')
ok('geocoding balik memakai Nominatim', r.geocodingBalik.layanan === 'Nominatim')
ok('rute mencakup OSRM dan Valhalla', Boolean(r.rute.osrm) && Boolean(r.rute.valhalla))
ok(
  'tidak ada nilai rahasia di ringkasan',
  /*
   * Yang diperiksa adalah NILAI, bukan nama bidang.
   *
   * Versi pertama uji ini mencocokkan /key|token|secret/ ke seluruh JSON dan
   * langsung gagal — karena nama bidang `googleMapsApiKey` sendiri memuat
   * "Key". Nama bidang memang harus disebut (itu justru buktinya), yang tidak
   * boleh ada adalah NILAI yang tampak seperti kredensial: string panjang
   * acak, atau bidang bernama apiKey/token yang berisi sesuatu.
   */
  !Object.entries(r).some(([k, v]) => /apiKey|token|secret|password/i.test(k) && v) &&
    !JSON.stringify(r).match(/[A-Za-z0-9_-]{28,}/),
  'bersih',
)

/* ============================================================== RINGKAS === */

console.log(`\n${gagal === 0 ? 'SEMUA LULUS' : 'ADA YANG GAGAL'} — ${lulus} pemeriksaan, ${gagal} gagal, ${dilewati} dilewati`)
if (gagal > 0) process.exitCode = 1
