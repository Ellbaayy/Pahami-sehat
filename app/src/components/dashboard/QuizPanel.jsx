import { useState } from 'react'
import { ClipboardList, AlertCircle, Check } from 'lucide-react'
import { Card, SectionHeading, Button, EmptyState } from '../ui/primitives'
import { QUIZ_ITEMS, QUIZ_SCALE } from '../../data/dummy'
import { cn } from '../../lib/cn'

/** Kuesioner HLS-SF12 versi ringkas — dihitung lokal di peramban, tanpa kirim data. */
export default function QuizPanel() {
  const [answers, setAnswers] = useState({})
  const [error, setError] = useState('')
  const [result, setResult] = useState(null)

  const answered = Object.keys(answers).length

  const submit = (e) => {
    e.preventDefault()
    if (answered < QUIZ_ITEMS.length) {
      setError(`Masih ada ${QUIZ_ITEMS.length - answered} pernyataan yang belum dijawab.`)
      return
    }
    setError('')

    const total = QUIZ_ITEMS.reduce((sum, _, i) => sum + Number(answers[i]), 0)
    const max = (QUIZ_ITEMS.length - 1) * 4
    const pct = Math.round((total / max) * 100)

    let category
    let advice
    if (pct >= 70) {
      category = 'Baik'
      advice =
        'Kamu sudah nyaman mencari dan menilai informasi kesehatan. Pertahankan, dan bantu orang di sekitarmu yang masih kesulitan.'
    } else if (pct >= 45) {
      category = 'Sedang'
      advice =
        'Sebagian besar sudah bisa, bagian menilai kebenaran informasi masih perlu diperkuat. Biasakan cek ke Kemenkes, WHO, atau BPOM sebelum percaya.'
    } else {
      category = 'Perlu dukungan'
      advice =
        'Aktifkan penyederhanaan ke tingkat anak-anak dan mode suara agar informasi lebih mudah dijangkau. Bawa hasil ini ke tenaga kesehatan terdekat.'
    }

    setResult({ pct, category, advice })
  }

  const reset = () => {
    setAnswers({})
    setResult(null)
    setError('')
  }

  const R = 52
  const CIRC = 2 * Math.PI * R

  return (
    <div className="space-y-[clamp(1rem,1.6vw,1.75rem)]">
      <SectionHeading
        eyebrow="Alat ukur"
        title="Kuesioner HLS-SF12"
        description="Versi ringkas untuk demo. Semua perhitungan dilakukan lokal di browser — tidak ada data yang dikirim ke mana pun."
      />

      <form onSubmit={submit} noValidate>
        <fieldset className="space-y-3">
          <legend className="sr-only">Pernyataan literasi kesehatan</legend>

          {QUIZ_ITEMS.map((text, i) => {
            const legendId = `q-${i}`
            return (
              <Card key={text} className="p-[clamp(0.9rem,0.8rem+0.4vw,1.25rem)]">
                <p
                  id={legendId}
                  className="mb-3 text-[0.95rem] font-semibold text-navy-900"
                >
                  <span className="mr-1.5 text-brand-600">{i + 1}.</span>
                  {text}
                </p>
                <div
                  role="radiogroup"
                  aria-labelledby={legendId}
                  className="grid grid-cols-2 gap-2 sm:flex sm:flex-wrap"
                >
                  {QUIZ_SCALE.map((label, j) => {
                    const checked = answers[i] === String(j)
                    return (
                      <label
                        key={label}
                        className={cn(
                          'flex h-10 cursor-pointer items-center justify-center gap-1.5 rounded-xl border px-3 text-[0.82rem] font-semibold transition-all duration-200',
                          'focus-within:outline-2 focus-within:outline-offset-2 focus-within:outline-brand-500',
                          'sm:flex-1 sm:justify-center',
                          checked
                            ? 'border-brand-400 bg-brand-50 text-brand-700'
                            : 'border-slate-200 bg-white text-navy-500 hover:border-slate-300 hover:bg-slate-50',
                        )}
                      >
                        <input
                          type="radio"
                          name={`q-${i}`}
                          value={j}
                          checked={checked}
                          onChange={() => {
                            setAnswers((prev) => ({ ...prev, [i]: String(j) }))
                            setError('')
                          }}
                          className="sr-only"
                        />
                        {checked ? <Check className="size-3.5" aria-hidden="true" /> : null}
                        <span className="text-center leading-tight">{label}</span>
                      </label>
                    )
                  })}
                </div>
              </Card>
            )
          })}
        </fieldset>

        {error ? (
          <p
            role="alert"
            className="mt-4 inline-flex items-center gap-2 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-[0.88rem] font-semibold text-rose-700"
          >
            <AlertCircle className="size-4 shrink-0" aria-hidden="true" />
            {error}
          </p>
        ) : null}

        <div className="mt-4 flex flex-col gap-2.5 sm:flex-row">
          <Button type="submit" size="lg" full className="sm:w-auto">
            Lihat hasil
          </Button>
          <Button
            type="button"
            variant="neutral"
            size="lg"
            onClick={reset}
            full
            className="sm:w-auto"
          >
            Ulangi
          </Button>
          <span className="self-center text-[0.82rem] text-slate-500 sm:ml-auto">
            {answered} dari {QUIZ_ITEMS.length} terjawab
          </span>
        </div>
      </form>

      {result ? (
        <Card
          className="rise flex flex-col items-center gap-5 p-[clamp(1.1rem,0.9rem+0.8vw,1.75rem)] sm:flex-row"
          aria-live="polite"
        >
          <svg viewBox="0 0 120 120" className="size-[130px] shrink-0 -rotate-90" aria-hidden="true">
            <circle cx="60" cy="60" r={R} fill="none" stroke="#e8eef5" strokeWidth="12" />
            <circle
              cx="60"
              cy="60"
              r={R}
              fill="none"
              stroke="#17a398"
              strokeWidth="12"
              strokeLinecap="round"
              strokeDasharray={CIRC}
              strokeDashoffset={CIRC - (CIRC * result.pct) / 100}
              style={{ transition: 'stroke-dashoffset .7s cubic-bezier(.22,.61,.36,1)' }}
            />
          </svg>
          <div className="min-w-0 flex-1 text-center sm:text-left">
            <p className="text-[2rem] leading-none font-extrabold text-navy-900">
              {result.pct}
              <span className="text-[1.1rem] font-bold text-navy-500">%</span>
            </p>
            <p className="mt-1 text-[clamp(1rem,0.96rem+0.25vw,1.18rem)] font-bold text-brand-700">
              Literasi kesehatan: {result.category}
            </p>
            <p className="mt-2 max-w-[60ch] text-[0.92rem] leading-relaxed text-navy-700">
              {result.advice}
            </p>
            <p className="mt-3 text-[0.76rem] text-slate-500">
              Simulasi demo — bukan diagnosis medis.
            </p>
          </div>
        </Card>
      ) : answered === 0 ? (
        <EmptyState
          icon={ClipboardList}
          title="Hasil akan tampil di sini"
          description="Jawab kelima pernyataan di atas, lalu tekan Lihat hasil."
        />
      ) : null}
    </div>
  )
}
