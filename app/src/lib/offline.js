/**
 * Mode hemat sinyal.
 *
 * Menyimpan 10 jawaban terakhir ke localStorage supaya tetap bisa dibaca dan
 * didengar saat sinyal hilang. Aktif hanya kalau pengguna menyalakannya di
 * Pengaturan.
 *
 * Catatan: ini BUKAN service worker. Yang disimpan hanya jawaban AI, bukan
 * seluruh halaman — jadi jujur soal batasnya di UI.
 */

const KUNCI = 'pahami-sehat:cache'
const MAKS = 10

/** Apakah localStorage bisa dipakai (mode privat bisa memblokirnya). */
function adaPenyimpanan() {
  try {
    const uji = '__pahami_uji__'
    window.localStorage.setItem(uji, '1')
    window.localStorage.removeItem(uji)
    return true
  } catch {
    return false
  }
}

/** Baca seluruh daftar tersimpan (terbaru dulu). Selalu array. */
export function ambilCache() {
  if (typeof window === 'undefined' || !adaPenyimpanan()) return []
  try {
    const mentah = window.localStorage.getItem(KUNCI)
    if (!mentah) return []
    const d = JSON.parse(mentah)
    if (Array.isArray(d)) return d.filter((x) => x && x.jawaban)
    // kompatibel dengan format lama (satu objek)
    if (d && typeof d === 'object' && d.jawaban) return [d]
    return []
  } catch {
    return []
  }
}

/** Ambil satu jawaban terakhir (dipakai di Beranda). */
export function ambilTerakhir() {
  return ambilCache()[0] ?? null
}

/**
 * Simpan jawaban baru di depan daftar, pangkas jadi 10.
 * @returns {boolean} berhasil disimpan
 */
export function simpanCache({ pertanyaan, hasil, tingkat }) {
  if (typeof window === 'undefined' || !adaPenyimpanan()) return false
  try {
    const lama = ambilCache()
    const baru = {
      id: `c${Date.now()}`,
      pertanyaan: String(pertanyaan ?? '').slice(0, 500),
      jawaban: String(hasil?.jawaban ?? '').slice(0, 4000),
      poinKunci: Array.isArray(hasil?.poinKunci) ? hasil.poinKunci.slice(0, 12) : [],
      sumber: Array.isArray(hasil?.sumber) ? hasil.sumber.slice(0, 6) : [],
      tingkat: tingkat ?? null,
      waktu: Date.now(),
    }
    // hindari duplikat kalau jawaban sama persis diajukan dua kali
    const tanpaDuplikat = lama.filter((x) => x.pertanyaan !== baru.pertanyaan || x.jawaban !== baru.jawaban)
    window.localStorage.setItem(KUNCI, JSON.stringify([baru, ...tanpaDuplikat].slice(0, MAKS)))
    return true
  } catch {
    return false
  }
}

/** Hapus satu entri berdasarkan id. */
export function hapusSatu(id) {
  if (typeof window === 'undefined' || !adaPenyimpanan()) return
  try {
    const sisa = ambilCache().filter((x) => x.id !== id)
    window.localStorage.setItem(KUNCI, JSON.stringify(sisa))
  } catch {
    /* diabaikan */
  }
}

/** Hapus semua simpanan. */
export function hapusCache() {
  if (typeof window === 'undefined' || !adaPenyimpanan()) return
  try {
    window.localStorage.removeItem(KUNCI)
  } catch {
    /* diabaikan */
  }
}

/** Apakah peramban sedang offline. */
export function sedangOffline() {
  return typeof navigator !== 'undefined' && navigator.onLine === false
}

/** Jumlah maksimum yang disimpan — dipakai UI supaya tidak menebak. */
export const MAKS_TERSIMPAN = MAKS
