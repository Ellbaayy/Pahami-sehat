/**
 * Skor HLS-SF12 — indeks 0–50 dan kategorinya.
 *
 * ============================================================================
 * KENAPA MODUL INI ADA, DAN KENAPA ANGKANYA BERUBAH
 * ============================================================================
 *
 * Sebelumnya `QuizPanel` menghitung PERSENTASE 0–100% dengan ambang buatan
 * sendiri (≥70 Baik, ≥45 Sedang, <45 Perlu dukungan). Itu membuat hasil
 * aplikasi ini TIDAK BISA DIBANDINGKAN dengan rujukan mana pun: paper
 * validasi HLS-SF12 melaporkan indeks 0–50, bukan persentase.
 *
 * Diukur 21 Okt 2026 — dua cacat pada versi lama:
 *
 *   1. Skalanya beda. Instrumen resmi memakai indeks 0–50. Persentase 0–100%
 *      bukan skala instrumen ini, dan ambang 70/45 tidak berasal dari mana pun.
 *   2. Kategorinya beda. Rujukan memakai EMPAT kategori; versi lama memakai
 *      tiga.
 *
 * ---------------------------------------------------------------------------
 * SUMBER (diperiksa langsung, bukan dari ingatan)
 * ---------------------------------------------------------------------------
 *
 * Instrumen : Duong TV, Aringazina A, Baisunova G, dkk. "Development and
 *             Validation of a New Short-Form Health Literacy Instrument
 *             (HLS-SF12) for the General Public in Six Asian Countries."
 *             HLRP: Health Literacy Research and Practice, 2019.
 *             PMC6607763. Rumus indeks HLS-SF12 dinyatakan SAMA dengan
 *             bentuk penuhnya (HLS-EU-Q47).
 *
 * Rumus     : index = (mean − 1) × (50/3)
 *             mean  = rata-rata nilai 12 item, tiap item 1..4
 *             1     = nilai terendah yang mungkin (indeks jadi 0)
 *             3     = rentang mean (4 − 1)
 *             50    = nilai tertinggi indeks
 *             -> 0 = literasi terendah, 50 = tertinggi
 *
 * Kategori  : HLS-EU Consortium (Sørensen dkk. 2015; Pelikan dkk.):
 *               inadequate  0–25
 *               problematic >25–33
 *               sufficient  >33–42
 *               excellent   >42–50
 *             'inadequate' + 'problematic' bersama disebut
 *             "limited health literacy" (0–33).
 *
 * CATATAN KEJUJURAN: kategori itu ditetapkan untuk HLS-EU-Q47 dan dipakai
 * juga pada HLS-SF12 karena rumus indeksnya sama. Sifatnya penanda, bukan
 * diagnosis — dan aplikasi menyebutkannya apa adanya di antarmuka.
 *
 * ============================================================================
 * SKALA JAWABAN: 1..4, BUKAN 0..3
 * ============================================================================
 *
 * Versi lama menyimpan jawaban sebagai 0..3 lalu membaginya dengan `item × 3`.
 * Rumus resmi memakai 1..4 dan membaginya dengan 3 (rentangnya). Kalau nilai
 * 0..3 dimasukkan ke rumus resmi, mean menjadi terlalu rendah 1 poin dan
 * indeksnya meleset 16,7 poin — kesalahan yang TIDAK terlihat kalau tidak
 * dibandingkan dengan rujukan. Karena itu konversinya dilakukan SEKALI di sini,
 * dan pemanggil tetap boleh mengirim 0..3 (bentuk penyimpanan lama) maupun
 * 1..4 (bentuk instrumen).
 */

/** Jumlah item HLS-SF12. */
export const JUMLAH_ITEM = 12

/** Nilai terendah satu item pada instrumen asli (1..4). */
const ITEM_MIN = 1

/**
 * Empat kategori resmi, dengan batas atas dalamklusif.
 *
 * Ditulis sebagai data, bukan rantai if/else, supaya batasnya bisa diuji
 * satu per satu dan tidak ada yang tertinggal saat diubah.
 */
export const KATEGORI = [
  { kunci: 'inadequate', min: 0, maks: 25 },
  { kunci: 'problematic', min: 25, maks: 33 },
  { kunci: 'sufficient', min: 33, maks: 42 },
  { kunci: 'excellent', min: 42, maks: 50 },
]

/**
 * Hitung indeks HLS-SF12 dari jawaban.
 *
 * @param {Record<number, string|number>} jawaban jawaban per indeks item
 * @param {number} [jumlahItem] jumlah item yang diharapkan (bawaan 12)
 * @param {'instrumen'|'nol'|'otomatis'} [skala] bentuk nilai jawaban
 * @returns {{indeks:number, kategori:string, mean:number, terjawab:number, lengkap:boolean}}
 */
export function hitungIndeks(jawaban, jumlahItem = JUMLAH_ITEM, skala = 'otomatis') {
  const nilai = []
  for (let i = 0; i < jumlahItem; i++) {
    const mentah = jawaban?.[i]
    if (mentah === undefined || mentah === null || mentah === '') continue
    const n = Number(mentah)
    if (!Number.isFinite(n)) continue
    nilai.push(n)
  }

  const terjawab = nilai.length
  const lengkap = terjawab === jumlahItem

  if (terjawab === 0) {
    return { indeks: 0, kategori: 'inadequate', mean: ITEM_MIN, terjawab: 0, lengkap: false }
  }

  /*
   * Skala 0..3 -> 1..4.
   *
   * 'otomatis' menebak dari adanya nilai 0. Tebakan ini TIDAK BISA BENAR
   * SENDIRI untuk jawaban 0..3 yang kebetulan tidak memuat angka 0 — mis. 12
   * jawaban bernilai 3 (bentuk lama) akan terbaca sebagai 3 pada skala
   * instrumen, dan indeksnya meleset 16,7 poin tanpa satu pun galat muncul.
   * Uji menangkapnya. Karena itu pemanggil yang tahu bentuk datanya WAJIB
   * menyebut skalanya, dan 'otomatis' hanya jaring pengaman untuk data lama.
   */
  const pakaiSkalaNol =
    skala === 'nol' || (skala === 'otomatis' && nilai.some((n) => n === 0))
  const nilaiInstrumen = pakaiSkalaNol ? nilai.map((n) => n + 1) : nilai

  const mean = nilaiInstrumen.reduce((a, b) => a + b, 0) / terjawab
  const mentah = (mean - ITEM_MIN) * (50 / 3)
  // Dijepit ke 0..50: pembulatan tidak boleh menghasilkan angka di luar rentang
  // instrumen, karena itu akan terbaca sebagai "lebih tinggi dari maksimum".
  const indeks = Math.min(50, Math.max(0, Math.round(mentah * 10) / 10))

  return { indeks, kategori: kategoriDari(indeks), mean, terjawab, lengkap }
}

/**
 * Kategori untuk sebuah indeks.
 *
 * Batasnya SAMA dengan rujukan, termasuk perlakuan di titik batasnya:
 * 25 masuk 'inadequate', 33 masuk 'problematic', 42 masuk 'sufficient'.
 *
 * @param {number} indeks
 * @returns {string}
 */
export function kategoriDari(indeks) {
  const n = Number(indeks)
  if (!Number.isFinite(n)) return 'inadequate'
  if (n <= 25) return 'inadequate'
  if (n <= 33) return 'problematic'
  if (n <= 42) return 'sufficient'
  return 'excellent'
}

/**
 * Apakah indeks ini termasuk "limited health literacy" (0–33)?
 *
 * Dipakai untuk memutuskan apakah aplikasi menawarkan penyederhanaan bahasa
 * secara proaktif. Ambangnya dari rujukan yang sama, bukan karangan.
 */
export function terbatas(indeks) {
  return Number(indeks) <= 33
}
