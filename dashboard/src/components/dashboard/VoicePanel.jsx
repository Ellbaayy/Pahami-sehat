import { useState } from 'react'
import { Mic, Square, RotateCcw, ArrowRight, AudioLines } from 'lucide-react'
import { Card, SectionHeading, Button } from '../ui/primitives'
import { cn } from '../../lib/cn'

const SAMPLE = 'Apa arti hasil laboratorium gula darah puasa saya?'

/**
 * Panel Suara — mode aksesibilitas "terjangkau".
 * Simulasi perekaman murni di sisi klien, tanpa Web Speech API
 * supaya selalu bisa didemonstrasikan di perangkat apa pun.
 */
export default function VoicePanel({ onUse }) {
  const [recording, setRecording] = useState(false)
  const [transcript, setTranscript] = useState('')

  const start = () => {
    setTranscript('')
    setRecording(true)
    window.setTimeout(() => {
      setRecording(false)
      setTranscript(SAMPLE)
    }, 1800)
  }

  const stop = () => setRecording(false)

  return (
    <div className="space-y-[clamp(1rem,1.6vw,1.75rem)]">
      <SectionHeading
        eyebrow="Mode suara"
        title="Tanya dengan suara"
        description="Cocok untuk yang lebih nyaman mendengarkan daripada membaca. Teks hasil rekaman bisa langsung dikirim ke Tanya AI."
      />

      <Card className="flex flex-col items-center gap-5 p-[clamp(1.25rem,1rem+1.2vw,2.5rem)] text-center">
        <button
          type="button"
          onClick={recording ? stop : start}
          aria-pressed={recording}
          aria-label={recording ? 'Hentikan perekaman' : 'Mulai perekaman suara'}
          className={cn(
            'grid size-20 place-items-center rounded-full transition-all duration-300 sm:size-24',
            'focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-brand-500',
            recording
              ? 'scale-105 bg-rose-500 text-white shadow-[0_0_0_10px_rgba(244,63,94,0.15)]'
              : 'bg-brand-500 text-white shadow-[0_0_0_10px_rgba(23,163,152,0.12)] hover:bg-brand-600 active:scale-95',
          )}
        >
          {recording ? <Square className="size-7 fill-current" /> : <Mic className="size-8" />}
        </button>

        {/* gelombang suara */}
        <div className="flex h-9 items-end gap-1.5" aria-hidden="true">
          {Array.from({ length: 13 }).map((_, i) => (
            <span
              key={i}
              className={cn(
                'w-1.5 rounded-full transition-all duration-300',
                recording ? 'bg-brand-400' : 'bg-slate-200',
              )}
              style={{
                height: recording ? `${16 + ((i * 37) % 22)}px` : '6px',
                transformOrigin: 'bottom',
                animation: recording ? `wave 0.9s ease-in-out ${i * 0.07}s infinite` : undefined,
              }}
            />
          ))}
        </div>

        <p className="text-[0.95rem] font-semibold text-navy-800">
          {recording ? 'Mendengarkan… silakan bicara' : transcript ? 'Rekaman selesai' : 'Tekan untuk bicara'}
        </p>

        <div className="min-h-[4.5rem] w-full max-w-[46rem] rounded-xl border border-dashed border-slate-300 bg-slate-50 px-4 py-3.5 text-left">
          {transcript ? (
            <p className="text-[0.95rem] leading-relaxed text-navy-700">{transcript}</p>
          ) : (
            <p className="flex items-center gap-2 text-[0.88rem] text-slate-500">
              <AudioLines className="size-4" aria-hidden="true" />
              Teks hasil ucapan akan muncul di sini.
            </p>
          )}
        </div>

        <div className="flex w-full max-w-[28rem] flex-col gap-2.5 sm:flex-row">
          <Button
            variant="neutral"
            size="lg"
            onClick={start}
            disabled={recording}
            full
            className="sm:w-auto sm:flex-1"
          >
            <RotateCcw className="size-4" aria-hidden="true" />
            Ulangi
          </Button>
          <Button
            size="lg"
            onClick={() => onUse(transcript || SAMPLE)}
            disabled={!transcript || recording}
            full
            className="sm:w-auto sm:flex-1"
          >
            Gunakan hasil
            <ArrowRight className="size-4" aria-hidden="true" />
          </Button>
        </div>
      </Card>
    </div>
  )
}
