import { useEffect, useState } from 'react'
import { Volume2, Square } from 'lucide-react'
import { ttsBaca, ttsBerhenti, ttsSedangBicara } from '../../lib/tts'
import { cn } from '../../lib/cn'

/**
 * Tombol "Dengar" — membacakan teks.
 *
 * Suara utamanya datang dari server (suara neural, nadanya mengikuti isi
 * kalimat). Suara bawaan peramban hanya cadangan kalau server tidak bisa
 * dihubungi. Karena itu tombol ini TIDAK disembunyikan lagi di peramban tanpa
 * Web Speech API — yang lama menyembunyikannya, padahal suara server tetap bisa.
 *
 * `bahasa` menentukan suara: 'id', 'jv' (Jawa), atau 'su' (Sunda).
 *
 * Label tombolnya diambil dari kamus lewat `t()` supaya ikut bahasa antarmuka.
 * Sebelumnya "Dengar" dan "Hentikan" ditulis tetap di sini, sehingga tombol ini
 * tetap berbahasa Indonesia di seluruh aplikasi walau antarmukanya Inggris —
 * padahal kunci kamusnya (umum.dengar, umum.hentikan) sudah ada sejak awal.
 */
export default function TombolDengar({
  teks,
  label,
  bahasa = 'auto',
  jenis = 'p',
  className,
  t = (k) => k,
}) {
  const [bicara, setBicara] = useState(false)
  const [error, setError] = useState(null)

  useEffect(() => {
    // kalau komponen dilepas saat sedang bicara, hentikan
    return () => ttsBerhenti()
  }, [])

  const klik = () => {
    if (ttsSedangBicara()) {
      ttsBerhenti()
      setBicara(false)
      return
    }
    setError(null)
    const jalan = ttsBaca(teks, {
      bahasa,
      jenis,
      onMulai: () => setBicara(true),
      onSelesai: () => setBicara(false),
      onError: (e) => {
        setBicara(false)
        // `e` bisa berupa KUNCI kamus (dari lib/tts.js) atau kalimat jadi —
        // kunci yang tidak dikenal dikembalikan apa adanya oleh t().
        setError(typeof e === 'string' ? t(e) : t('umum.suaraGagal'))
      },
    })
    if (!jalan) setError(t('umum.tidakAdaTeks'))
  }

  return (
    <>
      <button
        type="button"
        onClick={klik}
        aria-pressed={bicara}
        className={cn(
          'inline-flex items-center gap-1.5 rounded-lg border border-line-200 bg-white px-3 py-1.5',
          'text-[0.82rem] font-semibold text-navy-600 transition-colors',
          'hover:border-brand-300 hover:bg-brand-50 hover:text-brand-700',
          'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-500',
          bicara && 'border-brand-500 bg-brand-50 text-brand-700',
          className,
        )}
      >
        {bicara ? (
          <Square className="size-3.5 fill-current" aria-hidden="true" />
        ) : (
          <Volume2 className="size-3.5" aria-hidden="true" />
        )}
        {bicara ? t('umum.hentikan') : (label ?? t('umum.dengar'))}
      </button>
      {error ? <span className="ml-2 text-[0.82rem] text-rose-600">{error}</span> : null}
    </>
  )
}
