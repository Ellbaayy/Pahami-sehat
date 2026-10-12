/**
 * Hook pengenalan suara (Web Speech API).
 *
 * Dipakai tombol mikrofon di kotak isian Tanya AI.
 * Semua berjalan di perangkat pengguna — tidak ada audio yang dikirim ke server kita.
 *
 * Peramban yang mendukung: Google Chrome dan Microsoft Edge.
 * Chromium polos (termasuk Brave) memblokir layanan suara daring milik Google,
 * sehingga gagal dengan error 'network'. Firefox belum menyediakannya.
 * Kalau tidak didukung, hook melaporkan `didukung: false` supaya UI bisa
 * menonaktifkan tombolnya dengan jujur.
 *
 * SOAL BAHASA PESAN GALAT
 * Hook ini mengembalikan KUNCI KAMUS (mis. 'suara.galatIzin'), BUKAN kalimat
 * jadi. Sebelumnya kalimatnya ditulis di sini, sehingga pesan galat mikrofon
 * tetap berbahasa Indonesia walau antarmukanya Inggris — padahal seluruh teks
 * antarmuka wajib lewat kamus. Pemanggil yang menerjemahkan, karena hanya
 * pemanggil yang punya `t`.
 *
 * CATATAN PENTING soal `sementara` dan `onHasil`:
 * `sementara` HANYA berisi teks yang belum pasti (interim). Begitu pengenalan
 * selesai, hasil akhir dikirim lewat `onHasil`, lalu `sementara` dikosongkan.
 * Jadi komponen yang membaca `sementara` saja akan kehilangan hasil akhirnya.
 * Untuk mencegah itu, hook ini menyimpan hasil akhir di `hasil` juga, sehingga
 * pemanggil yang tidak memasang `onHasil` tetap bisa menampilkannya.
 */

import { useCallback, useEffect, useRef, useState } from 'react'

const Rekognisi =
  typeof window !== 'undefined'
    ? window.SpeechRecognition || window.webkitSpeechRecognition
    : undefined

/** Kode galat peramban -> kunci kamus. Yang tidak dikenal pakai kunci umum. */
const KUNCI_GALAT = {
  'not-allowed': 'suara.galatIzin',
  'service-not-allowed': 'suara.galatIzin',
  'no-speech': 'suara.galatTidakAdaSuara',
  'audio-capture': 'suara.galatTanpaMikrofon',
  network: 'suara.galatDaringDiblokir',
}

export function gunakanSuara({ bahasa = 'id-ID', onHasil } = {}) {
  const [mendengar, setMendengar] = useState(false)
  const [error, setError] = useState(null)
  const [sementara, setSementara] = useState('')
  const [hasil, setHasil] = useState('')
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
      setError('suara.galatTidakDidukung')
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
      setHasil('') // mulai merekam ulang -> buang hasil sebelumnya
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
        const bersih = akhir.trim()
        setSementara('')
        // simpan juga di state supaya tetap tampil walau pemanggil tidak
        // memasang onHasil
        setHasil(bersih)
        hasilRef.current?.(bersih)
      }
    }

    r.onerror = (e) => {
      // Kode galat peramban dipetakan ke kunci kamus, bukan kalimat jadi —
      // supaya pesannya ikut bahasa antarmuka. 'aborted' bukan kesalahan.
      if (e.error === 'aborted') return
      setError(KUNCI_GALAT[e.error] ?? 'suara.galatUmum')
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
      setError('suara.galatTidakBisaMulai')
    }
  }, [bahasa])

  const berhenti = useCallback(() => {
    try {
      ref.current?.stop()
    } catch {
      /* diabaikan */
    }
  }, [])

  /** Kosongkan hasil supaya bisa mulai dari bersih. */
  const bersihkan = useCallback(() => {
    setHasil('')
    setSementara('')
    setError(null)
  }, [])

  return {
    didukung: Boolean(Rekognisi),
    mendengar,
    sementara,
    hasil,
    error,
    mulai,
    berhenti,
    bersihkan,
  }
}
