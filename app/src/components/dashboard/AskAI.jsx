import { useId, useState } from 'react'
import { Sparkles, Mic, Send } from 'lucide-react'
import { Button, Card, SourcePills, Skeleton } from '../ui/primitives'
import { cn } from '../../lib/cn'

/**
 * Card utama "Tanya AI".
 * - layar besar : textarea + tombol sejajar horizontal
 * - layar kecil : textarea full-width, tombol pindah ke bawah & full-width
 * Semua state lewat props dari induk (React state saja, tanpa backend).
 */
export default function AskAI({
  value,
  onChange,
  onAsk,
  loading = false,
  question = '',
  result = null,
}) {
  const id = useId()
  const [listening, setListening] = useState(false)

  const canSubmit = value.trim().length > 0 && !loading

  const handleSubmit = (e) => {
    e.preventDefault()
    if (!canSubmit) return
    onAsk(value)
  }

  const toggleMic = () => {
    if (listening) {
      setListening(false)
      return
    }
    setListening(true)
    // simulasi input suara — murni frontend
    window.setTimeout(() => {
      setListening(false)
      onChange('Apa arti hasil laboratorium saya ini?')
    }, 1500)
  }

  return (
    <Card className="p-[clamp(1rem,0.85rem+0.7vw,1.6rem)]">
      <div className="mb-3 flex items-center gap-2.5">
        <span className="grid size-9 shrink-0 place-items-center rounded-xl bg-brand-50 text-brand-600 ring-1 ring-brand-100">
          <Sparkles className="size-[18px]" aria-hidden="true" />
        </span>
        <div className="min-w-0">
          <h2 className="text-[clamp(0.98rem,0.94rem+0.2vw,1.1rem)] font-bold text-navy-900">
            Tanya AI
          </h2>
          <p className="text-[0.8rem] leading-snug text-navy-500">
            Jawaban disederhanakan dan selalu menyertakan sumber.
          </p>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="flex flex-col gap-3 lg:flex-row lg:items-stretch">
        <div
          className={cn(
            'flex flex-1 items-start gap-2 rounded-2xl border bg-white px-3.5 py-3 transition-colors duration-200',
            'focus-within:border-brand-400 focus-within:ring-2 focus-within:ring-brand-100',
            loading ? 'border-brand-200' : 'border-slate-200 hover:border-slate-300',
          )}
        >
          <label htmlFor={id} className="sr-only">
            Tulis pertanyaan kesehatan
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
            placeholder="Tulis pertanyaan, tempel teks, atau kirim suara..."
            className="min-h-[3.25rem] flex-1 resize-none bg-transparent text-[0.95rem] leading-relaxed text-navy-900 outline-none placeholder:text-slate-500"
          />
          <button
            type="button"
            onClick={toggleMic}
            aria-pressed={listening}
            aria-label={listening ? 'Hentikan perekaman suara' : 'Rekam pertanyaan dengan suara'}
            className={cn(
              'grid size-10 shrink-0 place-items-center rounded-full transition-all duration-200',
              'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-500',
              listening
                ? 'bg-rose-500 text-white animate-pulse'
                : 'bg-slate-100 text-navy-500 hover:bg-brand-50 hover:text-brand-600',
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
          {loading ? 'Memproses…' : 'Tanya Sekarang'}
          {!loading ? <Send className="size-4" aria-hidden="true" /> : null}
        </Button>
      </form>

      <p className="mt-2 text-[0.8rem] text-slate-500">
        {listening ? (
          'Mendengarkan… bicara sekarang.'
        ) : (
          <>
            <span className="hidden sm:inline">
              Tekan Enter untuk kirim, Shift+Enter untuk baris baru.
            </span>
            <span className="sm:hidden">Ketuk tombol kirim untuk bertanya.</span>
          </>
        )}
      </p>

      {/* ---- hasil ---- */}
      {loading ? (
        <div className="mt-4 space-y-2.5" aria-live="polite" aria-busy="true">
          <Skeleton className="h-3 w-28" />
          <Skeleton className="h-3.5 w-full" />
          <Skeleton className="h-3.5 w-[88%]" />
        </div>
      ) : result ? (
        <div className="rise mt-4 rounded-xl border border-slate-200 bg-slate-50/70 p-4" aria-live="polite">
          <p className="mb-1 text-[0.7rem] font-bold tracking-[0.12em] uppercase text-brand-600">
            {result.verdict === 'negative' ? 'Verdict — tidak ditemukan' : 'Jawaban tersederhanakan'}
          </p>
          {question ? (
            <p className="mb-1.5 text-[0.86rem] font-semibold text-navy-800">“{question}”</p>
          ) : null}
          <p className="text-[0.92rem] leading-relaxed text-navy-700">{result.text}</p>
          <SourcePills sources={result.sources} negative={result.verdict === 'negative'} />
        </div>
      ) : null}
    </Card>
  )
}
