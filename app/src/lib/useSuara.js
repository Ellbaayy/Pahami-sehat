/**
 * Hook pengenalan suara (Web Speech API).
 *
 * Dipakai tombol mikrofon di Tanya AI dan panel Suara.
 * Semua berjalan di perangkat pengguna — tidak ada audio yang dikirim ke server kita.
 *
 * Peramban yang mendukung: Chrome, Edge, dan turunan Chromium.
 * Firefox/Safari sebagian belum — kalau tidak didukung, hook melaporkan
 * `didukung: false` supaya UI bisa menonaktifkan tombolnya dengan jujur.
 */

import { useCallback, useEffect, useRef, useState } from 'react'

const Rekognisi =
  typeof window !== 'undefined'
    ? window.SpeechRecognition || window.webkitSpeechRecognition
    : undefined

export function gunakanSuara({ bahasa = 'id-ID', onHasil } = {}) {
  const [mendengar, setMendengar] = useState(false)
  const [error, setError] = useState(null)
  const [sementara, setSementara] = useState('')
  const ref = useRef(null)
  const hasilRef = useRef(onHasil)
  hasilRef.current = onHasil

  // bersihkan saat komponen dilepas
  useEffect(() => {
    return () => {
      try {
        ref.current?.abort()
      } catch {
        /* diabaikan */
      }
    }
  }, [])

  const mulai = useCallback(() => {
    if (!Rekognisi) {
      setError('Peramban ini belum mendukung pengenalan suara. Coba Chrome atau Edge.')
      return
    }
    if (ref.current) return // sedang jalan

    const r = new Rekognisi()
    r.lang = bahasa
    r.continuous = false
    r.interimResults = true
    r.maxAlternatives = 1

    r.onstart = () => {
      setError(null)
      setMendengar(true)
    }

    r.onresult = (e) => {
      let akhir = ''
      let antara = ''
      for (let i = e.resultIndex; i < e.results.length; i++) {
        const t = e.results[i][0].transcript
        if (e.results[i].isFinal) akhir += t
        else antara += t
      }
      if (antara) setSementara(antara)
      if (akhir) {
        setSementara('')
        hasilRef.current?.(akhir.trim())
      }
    }

    r.onerror = (e) => {
      const pesan =
        e.error === 'not-allowed' || e.error === 'service-not-allowed'
          ? 'Izin mikrofon ditolak. Izinkan akses mikrofon di peramban lalu coba lagi.'
          : e.error === 'no-speech'
            ? 'Tidak ada suara yang terdengar. Coba bicara lagi.'
            : e.error === 'audio-capture'
              ? 'Mikrofon tidak terdeteksi.'
              : `Pengenalan suara gagal (${e.error}).`
      setError(pesan)
    }

    r.onend = () => {
      setMendengar(false)
      setSementara('')
      ref.current = null
    }

    ref.current = r
    try {
      r.start()
    } catch {
      ref.current = null
      setError('Tidak bisa memulai mikrofon.')
    }
  }, [bahasa])

  const berhenti = useCallback(() => {
    try {
      ref.current?.stop()
    } catch {
      /* diabaikan */
    }
  }, [])

  return {
    didukung: Boolean(Rekognisi),
    mendengar,
    sementara,
    error,
    mulai,
    berhenti,
    bersihkanError: () => setError(null),
  }
}
