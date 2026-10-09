/**
 * Baca teks dengan suara peramban (Web Speech API).
 *
 * Dipakai oleh tombol "Dengar" di jawaban AI dan sakelar "Putar suara
 * otomatis" di Pengaturan. Semua berjalan di perangkat pengguna —
 * tidak ada audio yang dikirim ke server.
 */

/** Apakah peramban punya kemampuan text-to-speech. */
export function ttsDidukung() {
  return typeof window !== 'undefined' && 'speechSynthesis' in window
}

let suaraTerpilih = null

/** Pilih suara Indonesia kalau ada; kalau tidak, pakai suara bawaan. */
function pilihSuara() {
  if (!ttsDidukung()) return null
  if (suaraTerpilih) return suaraTerpilih
  const daftar = window.speechSynthesis.getVoices?.() ?? []
  if (!daftar.length) return null
  suaraTerpilih =
    daftar.find((v) => /^id(\b|-)/i.test(v.lang)) ||
    daftar.find((v) => /indonesia/i.test(v.name)) ||
    daftar.find((v) => /^ms(\b|-)/i.test(v.lang)) || // Melayu paling dekat
    null
  return suaraTerpilih
}

/** Daftar suara kadang baru terisi setelah event ini. */
if (ttsDidukung()) {
  window.speechSynthesis.onvoiceschanged = () => {
    suaraTerpilih = null
    pilihSuara()
  }
}

/** Sedang membaca? */
export function ttsSedangBicara() {
  return ttsDidukung() && window.speechSynthesis.speaking
}

/** Hentikan bacaan. */
export function ttsBerhenti() {
  if (ttsDidukung()) window.speechSynthesis.cancel()
}

/**
 * Bacakan teks.
 * @param {string} teks
 * @param {{onMulai?: Function, onSelesai?: Function, onError?: Function}} cb
 * @returns {boolean} false kalau peramban tidak mendukung
 */
export function ttsBaca(teks, { onMulai, onSelesai, onError } = {}) {
  if (!ttsDidukung()) {
    onError?.(new Error('Peramban ini tidak mendukung pembacaan suara.'))
    return false
  }
  const isi = String(teks ?? '').trim()
  if (!isi) return false

  window.speechSynthesis.cancel()
  const u = new SpeechSynthesisUtterance(isi)
  u.lang = 'id-ID'
  u.rate = 0.95 // sedikit lebih lambat — target pengguna termasuk lansia
  u.pitch = 1
  const suara = pilihSuara()
  if (suara) u.voice = suara

  u.onstart = () => onMulai?.()
  u.onend = () => onSelesai?.()
  u.onerror = (e) => {
    // 'interrupted'/'canceled' muncul normal saat kita membatalkan sendiri
    if (e?.error === 'interrupted' || e?.error === 'canceled') return
    onError?.(e)
  }

  window.speechSynthesis.speak(u)
  return true
}
