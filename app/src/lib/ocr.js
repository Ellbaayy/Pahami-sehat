/**
 * Pembacaan teks dari foto (OCR) — seluruhnya berjalan di peramban.
 *
 * Kenapa di peramban, bukan di server:
 *   1. Foto pengguna TIDAK PERNAH meninggalkan perangkatnya. Aplikasi ini
 *      menjanjikan hal itu, dan pada foto hasil lab, resep, atau label obat
 *      janji tersebut paling berarti.
 *   2. Tetap jalan tanpa internet dan tanpa biaya — penting untuk Grand Final
 *      yang harus bisa dijalankan di localhost.
 *
 * Mesinnya tesseract.js (WebAssembly). Semua berkasnya disajikan dari situs
 * sendiri di `public/ocr/`, TIDAK dari CDN — jadi saat memindai tidak ada satu
 * pun permintaan yang keluar dari peramban. Ini juga yang membuat halaman ini
 * tetap berfungsi saat server AI mati.
 *
 * Berkas di `public/ocr/` disalin dari paket npm, bukan dikarang:
 *   - worker.min.js, tesseract-core-*.wasm.js  ← paket tesseract.js / -core
 *   - langdata/ind.traineddata, eng.traineddata ← tessdata_fast (Apache-2.0)
 * Cara memperbaruinya ada di README.
 */

import { createWorker, OEM } from 'tesseract.js'

/* ------------------------------------------------------------ konfigurasi --- */

/**
 * Semua berkas mesin disajikan dari situs sendiri, bukan CDN.
 * `BASE_URL` bernilai '/app/' di produksi dan '/' saat `npm run dev`,
 * jadi jalur di bawah benar di kedua mode.
 *
 * Ditulis dengan `?.` karena modul ini juga diimpor oleh skrip uji Node
 * (uji-ocr.mjs), dan di sana `import.meta.env` tidak ada.
 */
const DASAR = import.meta.env?.BASE_URL || '/app/'
const OCR = `${DASAR}ocr/`

/** Bahasa yang dimuat sekaligus: Indonesia untuk istilah medis, Inggris untuk singkatan. */
const BAHASA = 'ind+eng'

/** Batas foto yang diterima (byte) dan sisi terpanjang setelah diperkecil. */
export const MAKS_BYTE = 12 * 1024 * 1024
/**
 * Batas sisi gambar yang diproses.
 *
 * Angka 2000 dan 2600 dipilih dari pengukuran, bukan perkiraan. Pada foto uji
 * hasil lab, membaca baris "Hemoglobin : 11.2 g/dL":
 *   huruf ~27 px -> benar        (teks besar, gambar ~2000 px)
 *   huruf ~35 px -> benar        (teks kecil, gambar ~2600 px)
 *   huruf ~44 px -> SALAH ("11.2" hilang titiknya)
 * Jadi tidak ada satu ukuran yang benar untuk semua foto: yang besar justru
 * lebih baik pada gambar lebih kecil, dan sebaliknya. Karena itu ukurannya
 * ditentukan dari tinggi huruf yang terukur (lihat perkirakanTinggiHuruf).
 */
export const MAKS_SISI = 2000
/** Batas sisi saat gambar harus DIPERBESAR karena hurufnya terlalu kecil. */
export const MAKS_SISI_BESAR = 2600

/** Hasil dianggap tidak terbaca kalau lebih pendek dari ini. */
export const MIN_KARAKTER = 8

/** Status dari mesin OCR dipetakan ke kunci kamus, bukan teks siap pakai. */
const KUNCI_PROGRES = {
  'loading tesseract core': 'pindai.siapMesin',
  'initializing tesseract': 'pindai.nyalakanMesin',
  'loading language traineddata': 'pindai.muatBahasa',
  'initializing api': 'pindai.siapPembaca',
  'recognizing text': 'pindai.bacaTeks',
}

/* ------------------------------------------------------------ mesin (worker) --- */

/**
 * Worker dibuat sekali lalu dipakai ulang. Membuatnya butuh memuat berkas WASM
 * (~4 MB) dan data bahasa (~5 MB), jadi membuat ulang setiap pemindaian akan
 * terasa sangat lambat pada pemindaian kedua dan seterusnya.
 */
let worker = null
let janjiWorker = null

/**
 * Pelapor kemajuan aktif. Worker dibuat sekali dan hidup terus, sedangkan
 * panel yang menampilkan kemajuan bisa ditutup — jadi laporannya lewat
 * variabel ini, bukan disematkan saat worker dibuat.
 */
let lapor = null

function buatWorker() {
  return createWorker(BAHASA, OEM.LSTM_ONLY, {
    workerPath: `${OCR}worker.min.js`,
    corePath: `${OCR}tesseract-core-lstm.wasm.js`,
    langPath: `${OCR}langdata`,
    // berkas .traineddata yang kami sajikan sudah mentah, bukan .gz
    gzip: false,
    // simpan data bahasa di cache peramban supaya pemindaian berikutnya
    // tidak mengunduhnya lagi (5 MB)
    cacheMethod: 'write',
    logger: (m) => lapor?.(m),
  })
}

async function ambilWorker() {
  if (worker) return worker
  if (!janjiWorker) {
    janjiWorker = buatWorker()
      .then((w) => {
        worker = w
        return w
      })
      .catch((e) => {
        // jangan tinggalkan janji yang sudah gagal — kalau tidak, setiap
        // percobaan berikutnya akan memakai kegagalan yang sama
        janjiWorker = null
        throw e
      })
  }
  return janjiWorker
}

/**
 * Hentikan mesin dan lepaskan memorinya.
 * Dipakai saat pengguna menekan "Batalkan" — pengenalan teks tidak bisa
 * dihentikan di tengah jalan, jadi satu-satunya cara jujur adalah mematikan
 * worker-nya. Pemindaian berikutnya akan menyalakannya lagi dari cache.
 */
export async function hentikanMesin() {
  const w = worker
  worker = null
  janjiWorker = null
  if (w) {
    try {
      await w.terminate()
    } catch {
      /* sudah mati — tidak perlu dilaporkan */
    }
  }
}

/* --------------------------------------------------------------- gambar --- */

async function buatBitmap(file) {
  if (typeof createImageBitmap === 'function') {
    try {
      return await createImageBitmap(file)
    } catch {
      /* jatuh ke cara lama di bawah */
    }
  }
  // cara lama: <img> dari object URL — untuk peramban yang tidak bisa
  // createImageBitmap langsung dari File
  const url = URL.createObjectURL(file)
  try {
    const img = new Image()
    await new Promise((selesai, gagal) => {
      img.onload = selesai
      img.onerror = () => gagal(new Error('Foto tidak bisa dibuka.'))
      img.src = url
    })
    return img
  } finally {
    URL.revokeObjectURL(url)
  }
}

/**
 * Keabuan, plus perentangan kontras HANYA kalau fotonya memang kekurangan kontras.
 *
 * Terukur pada foto uji (persentil 2%..98%):
 *   foto normal          rentang 229 & 232  -> perentangan MERUSAK ("11.2" jadi "21.2")
 *   hasil lab huruf kecil rentang 142       -> perentangan tidak menolong
 *   foto gelap/redup      rentang 43        -> perentangan MENOLONG ("12-500" jadi "12.500")
 * Jadi perentangan tidak boleh selalu dipakai; ia baru berguna di bawah ~110.
 *
 * Yang TIDAK dilakukan: ambang hitam-putih keras. Pada foto HP pencahayaan
 * hampir selalu tidak rata, dan ambang global justru menghapus bagian gelap
 * atau membakar bagian terang.
 *
 * @returns {number} rentang kontras yang terukur (p98 - p2), untuk dilaporkan
 */
function rentangkanKontras(data) {
  const hist = new Uint32Array(256)
  for (let i = 0; i < data.length; i += 4) {
    const y = (0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2]) | 0
    data[i] = data[i + 1] = data[i + 2] = y
    hist[y]++
  }

  const total = data.length / 4
  let jumlah = 0
  let bawah = 0
  let atas = 255
  for (let v = 0; v < 256; v++) {
    jumlah += hist[v]
    if (jumlah >= total * 0.02) {
      bawah = v
      break
    }
  }
  jumlah = 0
  for (let v = 0; v < 256; v++) {
    jumlah += hist[v]
    if (jumlah >= total * 0.98) {
      atas = v
      break
    }
  }

  const rentang = atas - bawah
  // kontras sudah cukup, atau terlalu rata untuk bisa ditolong
  if (rentang >= AMBANG_RENTANG || rentang < 12) return rentang

  const skala = 255 / rentang
  for (let i = 0; i < data.length; i += 4) {
    let v = (data[i] - bawah) * skala
    v = v < 0 ? 0 : v > 255 ? 255 : v
    data[i] = data[i + 1] = data[i + 2] = v
  }
  return rentang
}

/** Di bawah rentang ini, perentangan kontras baru dipakai (lihat penjelasan di atas). */
const AMBANG_RENTANG = 110

/**
 * Perkirakan tinggi huruf pada gambar (piksel), lewat profil proyeksi baris.
 *
 * Kenapa perlu diukur: mesin tesseract mulai salah membaca tanda baca menjadi
 * angka ketika hurufnya kecil. Terukur pada foto uji: dengan tinggi huruf
 * ~30 px, "Hemoglobin : 11.2" terbaca "Hemoglobin 1121.2" — titik dua jadi
 * angka 1. Pada hasil lab itu bukan sekadar kurang rapi, itu mengubah arti
 * angkanya. Dengan tinggi huruf ~60 px pembacaannya benar.
 *
 * Caranya: anggap piksel yang berbeda dari latar sebagai tinta, hitung berapa
 * banyak piksel tinta per baris, lalu cari rentetan baris bertinta. Panjang
 * rentetan itu kira-kira setinggi huruf (termasuk bagian atas/bawah huruf).
 * Dipakai nilai TENGAH, bukan rata-rata, supaya satu blok judul besar tidak
 * menutupi fakta bahwa teks isinya kecil.
 */
function perkirakanTinggiHuruf(data, lebar, tinggi) {
  // mana yang tinta: kalau latarnya gelap, tintanya yang terang
  let jumlah = 0
  for (let i = 0; i < data.length; i += 4) jumlah += data[i]
  const rata = jumlah / (data.length / 4)
  const tintaGelap = rata >= 128

  const ambangTinta = tintaGelap ? rata * 0.75 : rata * 1.25
  const ambangBaris = Math.max(3, lebar * 0.01)

  const tinggiRentetan = []
  let mulai = -1
  for (let y = 0; y < tinggi; y++) {
    let adaTinta = 0
    const dasar = y * lebar * 4
    for (let x = 0; x < lebar; x++) {
      const v = data[dasar + x * 4]
      if (tintaGelap ? v < ambangTinta : v > ambangTinta) adaTinta++
    }
    if (adaTinta >= ambangBaris) {
      if (mulai < 0) mulai = y
    } else if (mulai >= 0) {
      tinggiRentetan.push(y - mulai)
      mulai = -1
    }
  }
  if (mulai >= 0) tinggiRentetan.push(tinggi - mulai)

  // buang derau (terlalu tipis) dan blok latar (terlalu tebal)
  const sah = tinggiRentetan.filter((h) => h >= 5 && h <= tinggi * 0.6).sort((a, b) => a - b)
  if (!sah.length) return 0
  return sah[Math.floor(sah.length / 2)]
}

/**
 * Tinggi huruf yang jadi sasaran (piksel). Diukur: pada hasil lab, tinggi huruf
 * ~27 px (teks besar) dan ~35 px (teks kecil) sama-sama terbaca benar, sedangkan
 * ~44 px mulai salah. Jadi sasarannya di bawah 44.
 */
const TINGGI_HURUF_IDEAL = 34

/**
 * Siapkan foto untuk dibaca.
 *
 * Sisi terpanjang dibatasi supaya foto 12 MP tidak menghabiskan memori. Tapi
 * pembatasan itu bisa membuat huruf menjadi terlalu kecil — atau, kalau foto
 * aslinya kecil, pembesaran berlebihan justru merusak angka. Karena itu setelah
 * gambar pertama jadi, tinggi huruf DIUKUR, lalu gambar digambar ulang pada
 * skala yang mendekati TINGGI_HURUF_IDEAL.
 */
async function siapkanGambar(file) {
  const bitmap = await buatBitmap(file)
  const lebarAsal = bitmap.width || bitmap.naturalWidth
  const tinggiAsal = bitmap.height || bitmap.naturalHeight
  if (!lebarAsal || !tinggiAsal) throw new Error('Ukuran foto tidak terbaca.')

  const gambar = (skala) => {
    const lebar = Math.max(1, Math.round(lebarAsal * skala))
    const tinggi = Math.max(1, Math.round(tinggiAsal * skala))

    // Pembesaran dilakukan BERTAHAP (maksimal 2x per langkah) dan dengan
    // kualitas penyaringan tinggi. Satu langkah drawImage dari 1100 px ke
    // 2600 px menghasilkan gambar yang lebih buram daripada penyaring LANCZOS.
    let sumber = bitmap
    let lebarKini = lebarAsal
    let tinggiKini = tinggiAsal
    while (lebarKini * 2 < lebar) {
      const c = document.createElement('canvas')
      c.width = lebarKini * 2
      c.height = tinggiKini * 2
      const cx = c.getContext('2d')
      cx.imageSmoothingEnabled = true
      cx.imageSmoothingQuality = 'high'
      cx.drawImage(sumber, 0, 0, c.width, c.height)
      sumber = c
      lebarKini = c.width
      tinggiKini = c.height
    }

    const canvas = document.createElement('canvas')
    canvas.width = lebar
    canvas.height = tinggi
    const ctx = canvas.getContext('2d', { willReadFrequently: true })
    if (!ctx) throw new Error('Peramban ini tidak bisa mengolah gambar.')
    ctx.imageSmoothingEnabled = true
    ctx.imageSmoothingQuality = 'high'
    ctx.drawImage(sumber, 0, 0, lebar, tinggi)
    const citra = ctx.getImageData(0, 0, lebar, tinggi)
    const rentang = rentangkanKontras(citra.data)
    ctx.putImageData(citra, 0, 0)
    return { canvas, lebar, tinggi, data: citra.data, rentang }
  }

  const sisi = Math.max(lebarAsal, tinggiAsal)
  const skalaAwal = Math.min(1, MAKS_SISI / sisi)
  let hasil = gambar(skalaAwal)
  let tinggiHuruf = perkirakanTinggiHuruf(hasil.data, hasil.lebar, hasil.tinggi)

  // --- sesuaikan skala supaya tinggi huruf mendekati sasaran ---
  if (tinggiHuruf > 0) {
    const perlu = TINGGI_HURUF_IDEAL / tinggiHuruf
    let skalaBaru = skalaAwal * perlu
    // batasi: jangan sampai gambar jadi sangat besar, dan jangan mengecilkan
    // foto yang sudah besar sampai hurufnya hilang
    skalaBaru = Math.min(skalaBaru, MAKS_SISI_BESAR / sisi)
    skalaBaru = Math.max(skalaBaru, Math.min(1, MAKS_SISI / sisi) * 0.5)

    if (Math.abs(skalaBaru - skalaAwal) / skalaAwal > 0.1) {
      const ulang = gambar(skalaBaru)
      const tinggiBaru = perkirakanTinggiHuruf(ulang.data, ulang.lebar, ulang.tinggi)
      // pakai hasil ulang hanya kalau hurufnya memang jadi lebih dekat ke sasaran
      if (tinggiBaru > 0 && Math.abs(tinggiBaru - TINGGI_HURUF_IDEAL) < Math.abs(tinggiHuruf - TINGGI_HURUF_IDEAL)) {
        hasil = ulang
        tinggiHuruf = tinggiBaru
      }
    }
  }

  bitmap.close?.()
  return {
    canvas: hasil.canvas,
    lebar: hasil.lebar,
    tinggi: hasil.tinggi,
    lebarAsal,
    tinggiAsal,
    tinggiHuruf,
    rentangKontras: hasil.rentang,
  }
}

/* --------------------------------------------------------------- teks --- */

/**
 * Cari gugus angka yang bentuknya mencurigakan, untuk diperiksa pengguna.
 *
 * Kenapa ini ada: kesalahan yang paling berbahaya pada OCR hasil lab bukan
 * huruf yang salah, melainkan ANGKA yang salah — "11.2" terbaca "111.2" atau
 * "211.2" mengubah arti hasil pemeriksaan. Diukur pada foto uji, mesin memang
 * kadang menempelkan angka 1 pada tanda titik dua atau titik desimal.
 *
 * Fungsinya BUKAN membetulkan (itu menebak-nebak, dan menebak pada angka
 * medis lebih berbahaya daripada tidak), melainkan menandai supaya pengguna
 * memeriksa sendiri sebelum memakai hasilnya.
 *
 * @returns {Array<{teks: string, alasan: string}>}
 */
export function periksaAngkaMencurigakan(teks) {
  const temuan = []
  const lihat = new Set()
  const isi = String(teks ?? '')

  const tambah = (potongan, alasan) => {
    const kunci = `${potongan}|${alasan}`
    if (lihat.has(kunci)) return
    lihat.add(kunci)
    temuan.push({ teks: potongan, alasan })
  }

  // 1) tanda hubung rentang yang berubah jadi tanda minus di depan angka,
  //    mis. "(13.2 - 17.3)" menjadi "(13.2 -17.3)" — tidak berbahaya, tapi
  //    kalau angkanya menempel bisa terbaca sebagai pengurangan
  // 2) angka 1 yang menempel di depan desimal: 111.2, 211.2, 1121.2, 1112
  for (const m of isi.matchAll(/\b\d*(?:111|211|1121|1112)\d*\.?\d*\b/g)) {
    const p = m[0]
    if (p.length >= 4) {
      tambah(p, 'Angka ini mungkin kelebihan digit "1" dari tanda titik dua (:) yang salah terbaca.')
    }
  }

  // 3) angka berkoma panjang tanpa pemisah ribuan yang wajar
  for (const m of isi.matchAll(/\b\d{7,}\b/g)) {
    tambah(m[0], 'Rangkaian angka ini panjang dan tanpa pemisah — periksa apakah pemisahnya hilang.')
  }

  // 4) persen yang menempel pada angka lain, mis. "34Yo" atau "34%o"
  for (const m of isi.matchAll(/\b\d{2,3}\s?(?:Yo|96|%o)\b/g)) {
    tambah(m[0], 'Tanda persen tampaknya terbaca sebagai huruf atau angka.')
  }

  // CATATAN: sengaja TIDAK ada aturan "angka ini sepertinya kehilangan titik
  // desimal". Awalnya ada, tapi langsung terbukti salah: "126 mg/dL" dan
  // "232 mg/dL" — angka gula darah dan kolesterol yang memang bilangan bulat —
  // ikut ditandai. Angka bulat yang sah tidak bisa dibedakan dari angka
  // desimal yang titiknya hilang, dan peringatan yang sering salah justru
  // membuat pengguna mengabaikan peringatan yang benar.

  return temuan
}

/**
 * Rapikan hasil mentah OCR.
 *
 * Yang dilakukan:
 *   - buang spasi di ujung baris dan baris yang isinya cuma tanda baca
 *   - sambung baris yang terpotong di tengah kalimat (baris berikutnya diawali
 *     huruf kecil) — tanpa ini, satu paragraf jadi satu kalimat per baris dan
 *     hasilnya tidak enak dibaca
 *   - rapatkan baris kosong beruntun
 */
export function rapikanTeks(mentah) {
  const baris = String(mentah ?? '')
    .replace(/\r\n?/g, '\n')
    .split('\n')
    .map((b) => b.replace(/[ \t]+/g, ' ').trim())
    .filter((b) => {
      if (!b) return true
      // baris yang hanya berisi 1–2 tanda baca hampir selalu sampah OCR
      return /[0-9A-Za-zÀ-ÿ]/.test(b) || b.length > 2
    })

  const gabung = []
  for (const b of baris) {
    const sebelum = gabung[gabung.length - 1]
    const lanjutanKalimat =
      sebelum &&
      sebelum.length > 0 &&
      !/[.!?:;"'”’)\]]$/.test(sebelum) &&
      /^[a-zà-ÿ]/.test(b)
    if (lanjutanKalimat) {
      gabung[gabung.length - 1] = `${sebelum} ${b}`
    } else {
      gabung.push(b)
    }
  }

  return gabung
    .join('\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
}

/* --------------------------------------------------------------- pindai --- */

/**
 * Baca teks dari sebuah foto.
 *
 * @param {File|Blob} file foto dari kamera atau berkas
 * @param {{onProgres?: (persen: number, pesan: string) => void, signal?: AbortSignal}} [opsi]
 * @returns {Promise<{teks: string, keyakinan: number, lebar: number, tinggi: number}>}
 */
export async function pindaiFoto(file, { onProgres, signal } = {}) {
  if (!file) throw new Error('Belum ada foto yang dipilih.')
  if (file.size > MAKS_BYTE) {
    throw new Error(
      `Foto terlalu besar (${(file.size / 1048576).toFixed(1)} MB). Batasnya ${MAKS_BYTE / 1048576} MB.`,
    )
  }
  if (file.type && !file.type.startsWith('image/')) {
    throw new Error('Berkas itu bukan gambar. Pilih foto (JPG, PNG, atau WebP).')
  }
  if (signal?.aborted) throw new DOMException('Dibatalkan', 'AbortError')

  const { canvas, lebar, tinggi } = await siapkanGambar(file)

  // pengenalan teks TIDAK bisa dihentikan di tengah jalan, jadi pembatalan
  // diperiksa sebelum dan sesudah tahap yang benar-benar berat ini
  if (signal?.aborted) throw new DOMException('Dibatalkan', 'AbortError')

  lapor = (m) => onProgres?.(m.progress ?? 0, m.status ?? '')
  try {
    const w = await ambilWorker()
    if (signal?.aborted) throw new DOMException('Dibatalkan', 'AbortError')

    const hasil = await w.recognize(canvas, {}, { text: true })
    const teks = rapikanTeks(hasil?.data?.text)
    const keyakinan = Math.round(hasil?.data?.confidence ?? 0)

    return { teks, keyakinan, lebar, tinggi }
  } finally {
    lapor = null
  }
}

/**
 * Kunci kamus untuk status mesin OCR, plus persentasenya.
 * Panel yang menerjemahkannya lewat `t()` — jadi pesannya ikut bahasa antarmuka.
 */
export function pesanProgres(status, persen) {
  const kunci = KUNCI_PROGRES[status] || 'pindai.prosesUmum'
  if (status !== 'recognizing text') return { kunci }
  return { kunci, persen: Math.round((persen || 0) * 100) }
}
