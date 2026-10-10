/**
 * Hook pengenalan suara (Web Speech API).
 *
 * Dipakai tombol mikrofon di Tanya AI, panel Suara, dan panel Tanya.
 * Semua berjalan di perangkat pengguna — tidak ada audio yang dikirim ke server kita.
 *
 * Peramban yang mendukung: Google Chrome dan Microsoft Edge.
 * Chromium polos (termasuk Brave) memblokir layanan suara daring milik Google,
 * sehingga gagal dengan error 'network'. Firefox belum menyediakannya.
 * Kalau tidak didukung, hook melaporkan `didukung: false` supaya UI bisa
 * menonaktifkan tombolnya dengan jujur.
 *
 * CATATAN PENTING soal `sementara` dan `onHasil`:
 * `sementara` HANYA berisi teks yang belum pasti (interim). Begitu pengenalan
 * selesai, hasil akhir dikirim lewat `onHasil`, lalu `sementara` dikosongkan.
 * Jadi komponen yang membaca `sementara` saja akan kehilangan hasil akhirnya —
 * pernah terjadi di panel Suara, kotaknya tetap kosong padahal Chrome sudah
 * mengenali ucapannya dengan benar. Untuk mencegah itu terulang, hook ini
 * menyimpan hasil akhir di `hasil` juga, sehingga pemanggil yang tidak
 * memasang `onHasil` tetap bisa menampilkannya.
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
      // Pesannya dibedakan per sebab supaya pengguna tahu harus berbuat apa.
      // 'network' paling sering muncul di Chromium tanpa layanan suara Google
      // (Brave, Chromium polos, distro Linux) — layanan pengenalan suara
      // memang daring, jadi tanpa sambungan ke sana fitur ini tidak bisa jalan.
      let pesan
      switch (e.error) {
        case 'not-allowed':
        case 'service-not-allowed':
          pesan = 'Izin mikrofon ditolak. Izinkan akses mikrofon di peramban, lalu coba lagi.'
          break
        case 'no-speech':
          pesan = 'Tidak ada suara yang terdengar. Coba bicara lagi lebih dekat ke mikrofon.'
          break
        case 'audio-capture':
          pesan = 'Mikrofon tidak terdeteksi. Pastikan ada mikrofon yang terpasang.'
          break
        case 'network':
          pesan =
            'Peramban ini memblokir layanan suara daring, jadi pengenalan suara tidak bisa jalan. Coba di Google Chrome atau Microsoft Edge.'
          break
        case 'aborted':
          return // dibatalkan sendiri — bukan kesalahan
        default:
          pesan = `Pengenalan suara gagal (${e.error}).`
      }
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
    bersihkanError: () => setError(null),
  }
}
