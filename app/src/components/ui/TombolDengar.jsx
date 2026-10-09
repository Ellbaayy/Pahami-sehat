import { useEffect, useState } from 'react'
import { Volume2, Square } from 'lucide-react'
import { ttsBaca, ttsBerhenti, ttsDidukung, ttsSedangBicara } from '../../lib/tts'
import { cn } from '../../lib/cn'

/**
 * Tombol "Dengar" — membacakan teks dengan suara peramban.
 * Menyembunyikan diri kalau peramban tidak mendukung, supaya tidak ada
 * tombol mati.
 */
export default function TombolDengar({ teks, label = 'Dengar', className }) {
  const [bicara, setBicara] = useState(false)
  const [error, setError] = useState(null)

  useEffect(() => {
    // kalau komponen dilepas saat sedang bicara, hentikan
    return () => ttsBerhenti()
  }, [])

  if (!ttsDidukung()) return null

  const klik = () => {
    if (ttsSedangBicara()) {
      ttsBerhenti()
      setBicara(false)
      return
    }
    setError(null)
    const jalan = ttsBaca(teks, {
      onMulai: () => setBicara(true),
      onSelesai: () => setBicara(false),
      onError: (e) => {
        setBicara(false)
        setError(typeof e === 'string' ? e : 'Gagal memutar suara.')
      },
    })
    if (!jalan) setError('Tidak ada teks untuk dibacakan.')
  }

  return (
    <>
      <button
        type="button"
        onClick={klik}
        aria-pressed={bicara}
        className={cn(
          'inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-1.5',
          'text-[0.82rem] font-semibold text-navy-600 transition-colors',
          'hover:border-brand-300 hover:bg-brand-50 hover:text-brand-700',
          'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-500',
          bicara && 'border-brand-400 bg-brand-50 text-brand-700',
          className,
        )}
      >
        {bicara ? (
          <Square className="size-3.5 fill-current" aria-hidden="true" />
        ) : (
          <Volume2 className="size-3.5" aria-hidden="true" />
        )}
        {bicara ? 'Hentikan' : label}
      </button>
      {error ? (
        <span className="ml-2 text-[0.76rem] text-rose-600">{error}</span>
      ) : null}
    </>
  )
}
