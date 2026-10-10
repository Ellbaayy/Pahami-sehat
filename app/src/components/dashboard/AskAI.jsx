import { useId, useState } from 'react'
import { Sparkles, Mic, Send, Loader2, WifiOff } from 'lucide-react'
import { Button, Card, SourcePills, Skeleton, PoinKunci, Peringatan, SumberJawaban } from '../ui/primitives'
import TombolDengar from '../ui/TombolDengar'
import { gunakanSuara } from '../../lib/useSuara'
import { cn } from '../../lib/cn'

/**
 * Card utama "Tanya AI".
 * - layar besar : textarea + tombol sejajar horizontal
 * - layar kecil : textarea full-width, tombol pindah ke bawah & full-width
 * Jawaban datang dari server (streaming) lewat props dari App.
 */
export default function AskAI({
  value,
  onChange,
  onAsk,
  loading = false,
  question = '',
  result = null,
  streaming = '',
  statusPesan = '',
  error = null,
  sumberCari = [],
  t = (k) => k,
  serverOnline = true,
  serverMemuat = false,
  bahasa = 'id',
}) {
  const id = useId()

  // mikrofon sungguhan — hasilnya langsung masuk ke kotak pertanyaan
  const suara = gunakanSuara({
    bahasa: 'id-ID',
    onHasil: (teks) => onChange(teks),
  })

  const canSubmit = value.trim().length > 0 && !loading && !serverMemuat

  const handleSubmit = (e) => {
    e.preventDefault()
    if (!canSubmit) return
    onAsk(value)
  }

  const toggleMic = () => {
    if (suara.mendengar) suara.berhenti()
    else suara.mulai()
  }

  return (
    <Card className="p-[clamp(1rem,0.85rem+0.7vw,1.6rem)]">
      <div className="mb-3 flex items-center gap-2.5">
        <span className="grid size-9 shrink-0 place-items-center rounded-xl bg-brand-50 text-brand-600 ring-1 ring-brand-100">
          <Sparkles className="size-[18px]" aria-hidden="true" />
        </span>
        <div className="min-w-0">
          <h2 className="text-[clamp(0.98rem,0.94rem+0.2vw,1.1rem)] font-bold text-navy-900">
            {t('tanya.judul')}
          </h2>
          <p className="text-[0.8rem] leading-snug text-navy-500">
            {t('tanya.sub')}
          </p>
        </div>
      </div>

      {!serverOnline && !serverMemuat ? (
        <div className="mb-3 flex items-center gap-2 rounded-xl border border-amber-200 bg-amber-50 px-3.5 py-2.5 text-[0.82rem] font-medium text-amber-800">
          <WifiOff className="size-4 shrink-0" aria-hidden="true" />
          <span>
            {t('umum.serverMati')}. {t('umum.jalankan')} <code className="font-mono">npm run server</code>.
          </span>
        </div>
      ) : null}

      <form onSubmit={handleSubmit} className="flex flex-col gap-3 lg:flex-row lg:items-stretch">
        <div
          className={cn(
            'flex flex-1 items-start gap-2 rounded-2xl border bg-white px-3.5 py-3 transition-colors duration-200',
            'focus-within:border-brand-500 focus-within:ring-2 focus-within:ring-brand-100',
            loading ? 'border-brand-200' : 'border-line-200 hover:border-line-300',
          )}
        >
          <label htmlFor={id} className="sr-only">
            {t('tanya.judul')}
          </label>
          <textarea
            id={id}
            rows={2}
            value={value}
            onChange={(e) => onChange(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault()
                if (canSubmit) onAsk(value)
              }
            }}
            placeholder={t('tanya.placeholder')}
            className="min-h-[3.25rem] flex-1 resize-none bg-transparent text-[0.95rem] leading-relaxed text-navy-900 outline-none placeholder:text-muted-500"
          />
          <button
            type="button"
            onClick={toggleMic}
            aria-pressed={suara.mendengar}
            disabled={!suara.didukung}
            title={
              suara.didukung
                ? 'Rekam pertanyaan dengan suara'
                : 'Peramban ini belum mendukung pengenalan suara — coba Chrome atau Edge'
            }
            aria-label={
              !suara.didukung
                ? 'Pengenalan suara tidak didukung peramban ini'
                : suara.mendengar
                  ? 'Hentikan perekaman suara'
                  : 'Rekam pertanyaan dengan suara'
            }
            className={cn(
              'grid size-10 shrink-0 place-items-center rounded-full transition-all duration-200',
              'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-500',
              'disabled:cursor-not-allowed disabled:opacity-45',
              suara.mendengar
                ? 'bg-rose-500 text-white animate-pulse'
                : 'bg-surface-100 text-navy-500 hover:bg-brand-50 hover:text-brand-600',
            )}
          >
            <Mic className="size-[17px]" aria-hidden="true" />
          </button>
        </div>

        <Button
          type="submit"
          size="lg"
          loading={loading}
          disabled={!canSubmit}
          full
          className="lg:w-auto lg:shrink-0"
        >
          {loading ? t('umum.proses') : t('tanya.kirim')}
          {!loading ? <Send className="size-4" aria-hidden="true" /> : null}
        </Button>
      </form>

      <p className="mt-2 text-[0.8rem] text-muted-500">
        {suara.mendengar ? (
          suara.sementara ? (
            <span className="text-brand-600">“{suara.sementara}”</span>
          ) : (
            t('tanya.mendengar')
          )
        ) : loading && statusPesan ? (
          <span className="inline-flex items-center gap-1.5 text-brand-600">
            <Loader2 className="size-3.5 animate-spin" aria-hidden="true" />
            {statusPesan}
          </span>
        ) : (
          <>
            <span className="hidden sm:inline">
              {t('tanya.kirim')}
            </span>
            <span className="sm:hidden">{t('tanya.kirim')}</span>
          </>
        )}
      </p>

      {suara.error ? <Peringatan pesan={suara.error} code="mikrofon" /> : null}
      <SumberJawaban cari={sumberCari} sumber={result?.sumber || []} />
      {error ? <Peringatan pesan={error.pesan} code={error.code} /> : null}

      {/* ---- hasil ---- */}
      {loading ? (
        <div className="mt-4" aria-live="polite" aria-busy="true">
          {streaming ? (
            <div className="rounded-xl border border-brand-200 bg-white p-4">
              <p className="mb-1 text-[0.7rem] font-bold tracking-[0.12em] uppercase text-brand-600">
                {t('tanya.sedangMenyusun')}
              </p>
              <p className="text-[0.92rem] leading-relaxed whitespace-pre-wrap text-navy-700">
                {streaming}
                <span className="ml-0.5 inline-block h-4 w-[2px] animate-pulse bg-brand-500 align-middle" />
              </p>
            </div>
          ) : (
            <div className="space-y-2.5">
              <Skeleton className="h-3 w-28" />
              <Skeleton className="h-3.5 w-full" />
              <Skeleton className="h-3.5 w-[88%]" />
            </div>
          )}
        </div>
      ) : result ? (
        <div className="rise mt-4 rounded-xl border border-line-200 bg-surface-50/70 p-4" aria-live="polite">
          <p className="mb-1 text-[0.7rem] font-bold tracking-[0.12em] uppercase text-brand-600">
            {result.verdict === 'tidak_didukung'
              ? t('tanya.verdictNegatif')
              : t('tanya.jawaban')}
          </p>
          {question ? (
            <p className="mb-1.5 text-[0.86rem] font-semibold text-navy-800">“{question}”</p>
          ) : null}
          <p className="text-[0.92rem] leading-relaxed whitespace-pre-wrap text-navy-700">
            {result.jawaban}
          </p>
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <TombolDengar teks={result.jawaban} bahasa={bahasa} />
          </div>
          <PoinKunci items={result.poinKunci} />
          <SourcePills
            sources={result.sumber}
            negative={result.verdict === 'tidak_didukung'}
          />
          {result.catatan ? (
            <p className="mt-2 text-[0.78rem] text-muted-500">{result.catatan}</p>
          ) : null}
        </div>
      ) : null}
    </Card>
  )
}
