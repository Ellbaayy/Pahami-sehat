/**
 * Membacakan jawaban AI.
 *
 * Dua lapis, dipakai berurutan:
 *
 *   1. SUARA NATURAL (utama) — audio MP3 dari server (`POST /api/suara`),
 *      memakai suara neural Microsoft dengan nada yang mengikuti isi kalimat.
 *      Ini yang membuatnya terasa seperti dibacakan orang, bukan robot.
 *   2. SUARA PERAMBAN (cadangan) — Web Speech API, dipakai kalau server tidak
 *      bisa dihubungi atau sedang tidak ada internet. Kualitasnya di bawah
 *      yang utama (di Linux memakai espeak-ng), tetapi selalu ada.
 *
 * Audio dari server diputar lewat elemen <audio>, bukan speechSynthesis,
 * karena yang dikirim adalah berkas MP3 jadi (beberapa kalimat sudah disambung
 * di server). Karena itu lapis 1 hanya butuh satu pemutaran.
 */

import { API_BASE } from './api'

/** Apakah peramban punya text-to-speech bawaan (untuk cadangan). */
export function ttsDidukung() {
  return typeof window !== 'undefined' && 'speechSynthesis' in window
}

let suaraTerpilih = null

/** Pilih suara Indonesia bawaan peramban kalau ada. */
function pilihSuaraBawaan() {
  if (!ttsDidukung()) return null
  if (suaraTerpilih) return suaraTerpilih
  const daftar = window.speechSynthesis.getVoices?.() ?? []
  if (!daftar.length) return null
  suaraTerpilih =
    daftar.find((v) => /^id(\b|-)/i.test(v.lang)) ||
    daftar.find((v) => /indonesia/i.test(v.name)) ||
    daftar.find((v) => /^ms(\b|-)/i.test(v.lang)) ||
    null
  return suaraTerpilih
}

if (ttsDidukung()) {
  window.speechSynthesis.onvoiceschanged = () => {
    suaraTerpilih = null
    pilihSuaraBawaan()
  }
}

/* ------------------------------------------------------- pemutar audio ---- */

/** Elemen audio yang dipakai ulang, supaya tidak menumpuk. */
let pemutar = null
let sumberSekarang = null

function ambilPemutar() {
  if (typeof window === 'undefined') return null
  if (!pemutar) {
    pemutar = new Audio()
    pemutar.preload = 'auto'
  }
  return pemutar
}

/** Sedang membaca (lapis mana pun)? */
export function ttsSedangBicara() {
  const sedangAudio = pemutar ? !pemutar.paused && !pemutar.ended : false
  return sedangAudio || (ttsDidukung() && window.speechSynthesis.speaking)
}

/** Hentikan bacaan dan lepaskan sumber audio. */
export function ttsBerhenti() {
  if (pemutar) {
    try {
      pemutar.pause()
      pemutar.removeAttribute('src')
      pemutar.load()
    } catch {
      /* diabaikan */
    }
  }
  if (sumberSekarang) {
    sumberSekarang.abort?.()
    sumberSekarang = null
  }
  if (ttsDidukung()) window.speechSynthesis.cancel()
}

/* ------------------------------------------------ lapis 2: suara bawaan --- */

function bacaDenganPeramban(teks, { onMulai, onSelesai, onError } = {}) {
  if (!ttsDidukung()) return false
  window.speechSynthesis.cancel()
  const u = new SpeechSynthesisUtterance(teks)
  u.lang = 'id-ID'
  u.rate = 0.95 // sedikit lebih lambat — target pengguna termasuk lansia
  u.pitch = 1
  const suara = pilihSuaraBawaan()
  if (suara) u.voice = suara
  u.onstart = () => onMulai?.()
  u.onend = () => onSelesai?.()
  u.onerror = (e) => {
    if (e?.error === 'interrupted' || e?.error === 'canceled') return
    onError?.(e)
  }
  window.speechSynthesis.speak(u)
  return true
}

/* ------------------------------------------------ lapis 1: suara natural -- */

async function ambilSuaraNatural(teks, bahasa, signal) {
  const res = await fetch(`${API_BASE}/suara`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ teks, bahasa }),
    signal,
  })
  if (!res.ok) throw new Error(`suara ${res.status}`)
  const blob = await res.blob()
  if (!blob.size) throw new Error('audio kosong')
  return URL.createObjectURL(blob)
}

/**
 * Bacakan teks: coba suara natural dulu, jatuh ke suara bawaan kalau gagal.
 *
 * @param {string} teks
 * @param {{bahasa?: string, onMulai?: Function, onSelesai?: Function, onError?: Function}} opsi
 * @returns {boolean} true kalau ada yang mulai dibacakan
 */
export function ttsBaca(teks, { bahasa = 'id', onMulai, onSelesai, onError } = {}) {
  const isi = String(teks ?? '').trim()
  if (!isi) return false

  ttsBerhenti()

  const ac = new AbortController()
  sumberSekarang = ac

  ambilSuaraNatural(isi, bahasa, ac.signal)
    .then((url) => {
      if (ac.signal.aborted) {
        URL.revokeObjectURL(url)
        return
      }
      const a = ambilPemutar()
      if (!a) {
        URL.revokeObjectURL(url)
        throw new Error('tidak ada pemutar')
      }
      a.src = url
      a.onended = () => {
        URL.revokeObjectURL(url)
        onSelesai?.()
      }
      a.onerror = () => {
        URL.revokeObjectURL(url)
        // MP3 dari server gagal diputar -> pakai suara bawaan
        if (!bacaDenganPeramban(isi, { onMulai, onSelesai, onError })) {
          onError?.('Gagal memutar suara.')
        }
      }
      a.onplay = () => onMulai?.()
      return a.play()
    })
    .catch((e) => {
      if (e?.name === 'AbortError') return
      // server tidak bisa dihubungi / tidak ada internet -> suara bawaan
      if (!bacaDenganPeramban(isi, { onMulai, onSelesai, onError })) {
        onError?.(e)
      }
    })

  return true
}
