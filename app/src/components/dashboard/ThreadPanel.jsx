import { MessagesSquare, Mic, Loader2 } from 'lucide-react'
import { SectionHeading, EmptyState, SourcePills, PoinKunci, Peringatan, SumberJawaban } from '../ui/primitives'
import TombolDengar from '../ui/TombolDengar'
import { gunakanSuara } from '../../lib/useSuara'
import { cn } from '../../lib/cn'

const PLACEHOLDER = 'Tulis pertanyaan, tempel teks, atau kirim suara...'

/**
 * Panel "Tanya AI" — thread percakapan penuh.
 * Komponen presentasional: nilai input & aksi dikontrol induk
 * supaya tombol chip topik di Beranda bisa menulis ke tempat yang sama.
 */
export default function ThreadPanel({
  input,
  onInputChange,
  onAsk,
  loading,
  thread,
  streaming = '',
  statusPesan = '',
  error = null,
  sumberCari = [],
  t = (k) => k,
  serverOnline = true,
  serverMemuat = false,
}) {
  const suara = gunakanSuara({ bahasa: 'id-ID', onHasil: onInputChange })
  const canSubmit = input.trim().length > 0 && !loading && !serverMemuat

  const toggleMic = () => {
    if (suara.mendengar) suara.berhenti()
    else suara.mulai()
  }

  return (
    <div className="space-y-[clamp(1rem,1.6vw,1.75rem)]">
      <SectionHeading
        eyebrow="Asisten"
        title={t('tanya.judul')}
        description={t('tanya.sub')}
      />

      <div className="rounded-2xl border border-slate-200 bg-white p-[clamp(1rem,0.85rem+0.7vw,1.5rem)] shadow-[0_1px_2px_rgba(15,30,51,0.04)]">
        <form
          onSubmit={(e) => {
            e.preventDefault()
            if (canSubmit) onAsk(input)
          }}
          className="flex flex-col gap-3 lg:flex-row lg:items-stretch"
        >
          <div className="flex flex-1 items-start gap-2 rounded-2xl border border-slate-200 bg-white px-3.5 py-3 transition-colors focus-within:border-brand-400 focus-within:ring-2 focus-within:ring-brand-100 hover:border-slate-300">
            <label htmlFor="thread-input" className="sr-only">
              Pertanyaan kesehatan
            </label>
            <textarea
              id="thread-input"
              rows={2}
              value={input}
              onChange={(e) => onInputChange(e.target.value)}
              placeholder={PLACEHOLDER}
              className="min-h-[3.25rem] flex-1 resize-none bg-transparent text-[0.95rem] leading-relaxed text-navy-900 outline-none placeholder:text-slate-500"
            />
            <button
              type="button"
              onClick={toggleMic}
              aria-pressed={suara.mendengar}
              disabled={!suara.didukung}
              title={
                suara.didukung
                  ? 'Rekam dengan suara'
                  : 'Peramban ini belum mendukung pengenalan suara — coba Chrome atau Edge'
              }
              aria-label={suara.mendengar ? 'Hentikan perekaman suara' : 'Rekam dengan suara'}
              className={cn(
                'grid size-9 shrink-0 place-items-center rounded-full transition-colors duration-200',
                'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-500',
                'disabled:cursor-not-allowed disabled:opacity-45',
                suara.mendengar
                  ? 'bg-rose-500 text-white animate-pulse'
                  : 'bg-slate-100 text-navy-500 hover:bg-brand-50 hover:text-brand-600',
              )}
            >
              <Mic className="size-4" aria-hidden="true" />
            </button>
          </div>

          <button
            type="submit"
            disabled={!canSubmit}
            className={cn(
              'h-12 rounded-xl bg-brand-500 px-6 text-[0.95rem] font-semibold text-white',
              'transition-all duration-200 hover:bg-brand-600 active:scale-[0.98]',
              'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-500',
              'disabled:cursor-not-allowed disabled:opacity-60',
              'lg:shrink-0',
              loading ? 'animate-pulse' : '',
            )}
          >
            {loading ? t('umum.proses') : t('tanya.kirim')}
          </button>
        </form>

        {suara.mendengar ? (
          <p className="mt-2.5 text-[0.8rem] text-brand-600">
            {suara.sementara ? `“${suara.sementara}”` : t('tanya.mendengar')}
          </p>
        ) : !serverOnline && !serverMemuat ? (
          <p className="mt-2.5 text-[0.8rem] text-amber-700">
            {t('umum.serverMati')} — {t('umum.jalankan')} <code className="font-mono">npm run server</code>.
          </p>
        ) : null}
      </div>

      {suara.error ? <Peringatan pesan={suara.error} code="mikrofon" /> : null}
      <SumberJawaban cari={sumberCari} sumber={[]} />
      {error ? <Peringatan pesan={error.pesan} code={error.code} /> : null}

      {thread.length === 0 && !loading ? (
        <EmptyState
          icon={MessagesSquare}
          title={t('tanya.belumAda')}
          description={t('tanya.belumAdaSub')}
        />
      ) : (
        <ol className="space-y-3">
          {thread.map((m, i) => (
            <li
              key={`${m.id}-${i}`}
              className={cn(
                'rise max-w-[min(100%,46rem)] rounded-2xl border p-4',
                m.role === 'user'
                  ? 'ml-auto border-brand-500 bg-brand-500 text-white'
                  : 'border-slate-200 bg-white',
              )}
            >
              <p
                className={cn(
                  'text-[0.7rem] font-bold tracking-[0.12em] uppercase',
                  m.role === 'user' ? 'text-brand-100' : 'text-brand-600',
                )}
              >
                {m.role === 'user' ? t('tanya.kamu') : 'Pahami Sehat'}
              </p>
              <p
                className={cn(
                  'mt-1 text-[0.95rem] leading-relaxed whitespace-pre-wrap',
                  m.role === 'user' ? 'font-medium text-white' : 'text-navy-700',
                )}
              >
                {m.text}
              </p>
              {m.role === 'ai' ? (
                <>
                  <div className="mt-3 flex flex-wrap items-center gap-2">
                    <TombolDengar teks={m.text} />
                  </div>
                  <PoinKunci items={m.poinKunci} />
                  <SourcePills sources={m.sources} negative={m.verdict === 'negative'} />
                  {m.catatan ? (
                    <p className="mt-2 text-[0.78rem] text-slate-500">{m.catatan}</p>
                  ) : null}
                </>
              ) : null}
            </li>
          ))}

          {loading ? (
            <li className="max-w-[min(100%,46rem)] rounded-2xl border border-slate-200 bg-white p-4">
              {streaming ? (
                <>
                  <p className="mb-1 text-[0.7rem] font-bold tracking-[0.12em] uppercase text-brand-600">
                    {t('tanya.sedangMenyusun')}
                  </p>
                  <p className="text-[0.95rem] leading-relaxed whitespace-pre-wrap text-navy-700">
                    {streaming}
                    <span className="ml-0.5 inline-block h-4 w-[2px] animate-pulse bg-brand-500 align-middle" />
                  </p>
                </>
              ) : (
                <>
                  <p className="mb-2 inline-flex items-center gap-1.5 text-[0.78rem] font-semibold text-brand-600">
                    <Loader2 className="size-3.5 animate-spin" aria-hidden="true" />
                    {statusPesan || t('umum.proses')}
                  </p>
                  <div className="skeleton h-3 w-24 rounded" />
                  <div className="skeleton mt-2.5 h-3.5 w-full rounded" />
                  <div className="skeleton mt-2 h-3.5 w-[85%] rounded" />
                </>
              )}
            </li>
          ) : null}
        </ol>
      )}
    </div>
  )
}
