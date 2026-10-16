import { useEffect, useRef, useState } from 'react'
import { Copy, Check, X, TriangleAlert } from 'lucide-react'
import { Button } from './primitives'
import { salinTeks } from '../../lib/sesi'

/**
 * Panel salin manual — jaring pengaman kalau papan klip diblokir peramban.
 *
 * Kenapa perlu: `navigator.clipboard` hanya tersedia di konteks aman, dan
 * `document.execCommand('copy')` bisa gagal di sebagian peramban. Tanpa panel
 * ini, pengguna yang papan klipnya diblokir tidak punya cara sama sekali untuk
 * membagikan obrolannya — padahal teksnya sudah siap.
 *
 * Jadi teksnya ditampilkan utuh dan LANGSUNG TERPILIH, supaya cukup menekan
 * Ctrl+C (atau Cmd+C). Tombol "Salin lagi" dicoba sekali lagi karena kegagalan
 * pertama sering hanya soal izin yang belum diberikan.
 *
 * Tidak ada yang dipalsukan di sini: kalau penyalinan otomatis gagal, panel ini
 * mengatakannya apa adanya dan menyerahkan kendali ke pengguna.
 */
export default function PanelSalin({ teks, onTutup, t = (k) => k }) {
  const [hasil, setHasil] = useState(null)
  const areaRef = useRef(null)

  // pilih seluruh teks begitu panel terbuka, supaya Ctrl+C langsung berguna
  useEffect(() => {
    const ta = areaRef.current
    if (!ta) return
    ta.focus({ preventScroll: true })
    ta.setSelectionRange(0, ta.value.length)
  }, [])

  // Escape menutup, sama seperti tombol Tutup
  useEffect(() => {
    const onKey = (e) => {
      if (e.key === 'Escape') onTutup?.()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onTutup])

  const coba = async () => {
    const ok = await salinTeks(teks)
    setHasil(ok)
    if (ok) {
      const ta = areaRef.current
      if (ta) ta.setSelectionRange(0, 0)
    } else {
      // gagal lagi -> pilih ulang supaya Ctrl+C tetap siap dipakai
      areaRef.current?.focus({ preventScroll: true })
      areaRef.current?.setSelectionRange(0, teks.length)
    }
  }

  return (
    <div className="fixed inset-0 z-[90] flex items-end justify-center p-3 sm:items-center sm:p-6">
      <div
        className="absolute inset-0 bg-navy-900/50 backdrop-blur-[2px]"
        onClick={onTutup}
        aria-hidden="true"
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="salin-judul"
        className="rise relative flex max-h-[85dvh] w-full max-w-[42rem] flex-col overflow-hidden rounded-2xl border border-line-200 bg-white shadow-2xl"
      >
        <div className="flex items-start gap-3 border-b border-line-100 px-4 py-3.5">
          <span className="grid size-9 shrink-0 place-items-center rounded-xl bg-amber-50 text-amber-600 ring-1 ring-amber-100">
            <TriangleAlert className="size-[18px]" aria-hidden="true" />
          </span>
          <div className="min-w-0 flex-1">
            <h2 id="salin-judul" className="text-[0.95rem] font-bold text-navy-900">
              {t('salin.judul')}
            </h2>
            <p className="text-[0.8rem] leading-snug text-navy-500">{t('salin.sub')}</p>
          </div>
          <button
            type="button"
            onClick={onTutup}
            aria-label={t('sesi.tutup')}
            title={t('sesi.tutup')}
            className="grid size-11 shrink-0 place-items-center rounded-lg text-navy-500 transition-colors hover:bg-surface-100 hover:text-navy-800 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-500 md:size-9"
          >
            <X className="size-4" aria-hidden="true" />
          </button>
        </div>

        <div className="min-h-0 flex-1 p-4">
          <label htmlFor="salin-teks" className="sr-only">
            {t('salin.label')}
          </label>
          <textarea
            id="salin-teks"
            ref={areaRef}
            readOnly
            value={teks}
            onFocus={(e) => e.target.setSelectionRange(0, e.target.value.length)}
            className="h-full max-h-[46dvh] min-h-[12rem] w-full resize-none rounded-xl border border-line-200 bg-surface-50/70 px-3.5 py-3 font-mono text-[0.8rem] leading-relaxed text-navy-800 outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-100"
          />
          <p className="mt-2 text-[0.82rem] text-muted-500">{t('salin.petunjuk')}</p>
          {hasil === true ? (
            <p className="mt-1.5 inline-flex items-center gap-1.5 text-[0.8rem] font-semibold text-brand-700">
              <Check className="size-3.5" aria-hidden="true" />
              {t('salin.berhasil')}
            </p>
          ) : hasil === false ? (
            <p className="mt-1.5 inline-flex items-center gap-1.5 text-[0.8rem] font-semibold text-amber-700">
              <TriangleAlert className="size-3.5" aria-hidden="true" />
              {t('salin.masihGagal')}
            </p>
          ) : null}
        </div>

        <div className="flex flex-wrap items-center justify-end gap-2 border-t border-line-100 px-4 py-3">
          <Button variant="neutral" size="md" onClick={onTutup}>
            {t('sesi.tutup')}
          </Button>
          <Button size="md" onClick={coba}>
            <Copy className="size-4" aria-hidden="true" />
            {t('salin.cobaLagi')}
          </Button>
        </div>
      </div>
    </div>
  )
}
