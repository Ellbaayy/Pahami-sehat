/**
 * Mode hemat sinyal.
 *
 * Menyimpan jawaban terakhir ke localStorage supaya tetap bisa dibaca saat
 * sinyal hilang. Aktif hanya kalau pengguna menyalakannya di Pengaturan.
 *
 * Catatan: ini BUKAN service worker. Yang disimpan hanya jawaban AI terakhir,
 * bukan seluruh halaman — jadi jujur soal batasnya di UI.
 */

const KUNCI = 'pahami-sehat:cache'

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

/** Ambil cache terakhir, atau null. */
export function ambilCache() {
  if (typeof window === 'undefined' || !adaPenyimpanan()) return null
  try {
    const mentah = window.localStorage.getItem(KUNCI)
    if (!mentah) return null
    const d = JSON.parse(mentah)
    if (!d || typeof d !== 'object' || !d.jawaban) return null
    return d
  } catch {
    return null
  }
}

/** Simpan jawaban terakhir (hanya kalau mode hemat sinyal aktif). */
export function simpanCache({ pertanyaan, hasil, tingkat }) {
  if (typeof window === 'undefined' || !adaPenyimpanan()) return false
  try {
    window.localStorage.setItem(
      KUNCI,
      JSON.stringify({
        pertanyaan: String(pertanyaan ?? '').slice(0, 500),
        jawaban: String(hasil?.jawaban ?? '').slice(0, 4000),
        poinKunci: Array.isArray(hasil?.poinKunci) ? hasil.poinKunci.slice(0, 12) : [],
        sumber: Array.isArray(hasil?.sumber) ? hasil.sumber.slice(0, 6) : [],
        tingkat: tingkat ?? null,
        waktu: Date.now(),
      }),
    )
    return true
  } catch {
    return false
  }
}

/** Hapus cache. */
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
