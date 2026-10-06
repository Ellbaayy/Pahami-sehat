import { useState } from 'react'
import { Lightbulb, Check, ChevronDown, ChevronUp } from 'lucide-react'
import { Card, Button } from '../ui/primitives'

/** Tips Kesehatan Hari Ini — satu kartu featured, menonjol tanpa ramai. */
export default function HealthTip({ tip }) {
  const [open, setOpen] = useState(false)
  if (!tip) return null

  return (
    <Card className="relative overflow-hidden border-brand-100 bg-brand-50/60 p-[clamp(1.05rem,0.9rem+0.6vw,1.6rem)]">
      <span className="absolute inset-y-0 left-0 w-[3px] bg-brand-500" aria-hidden="true" />

      <div className="flex flex-wrap items-start gap-3 pl-2">
        <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-white text-amber-500 ring-1 ring-amber-100">
          <Lightbulb className="size-5" aria-hidden="true" />
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-[0.72rem] font-bold tracking-[0.14em] uppercase text-brand-600">
            {tip.label}
          </p>
          <h3 className="mt-1 text-[clamp(1.02rem,0.96rem+0.35vw,1.28rem)] font-extrabold tracking-tight text-navy-900">
            {tip.title}
          </h3>
          <p className="mt-2 max-w-[68ch] text-[clamp(0.88rem,0.85rem+0.15vw,0.96rem)] leading-relaxed text-navy-700">
            {tip.body}
          </p>

          {open ? (
            <div className="rise mt-3 max-w-[68ch] rounded-xl bg-white/80 p-3.5 ring-1 ring-brand-100">
              <p className="text-[0.87rem] leading-relaxed text-navy-700">
                Mulai dari satu kebiasaan kecil yang mudah dijaga, misalnya menentukan jam
                tidur tetap setiap hari. Kebiasaan yang konsisten lebih mudah dipertahankan
                daripada perubahan besar sekaligus. Bila keluhan tidur berlanjut lebih dari
                dua minggu dan mengganggu aktivitas, diskusikan dengan tenaga kesehatan.
              </p>
            </div>
          ) : null}

          <ul className="mt-3.5 flex flex-wrap gap-2">
            {tip.bullets.map((b) => (
              <li
                key={b}
                className="inline-flex items-center gap-1.5 rounded-full bg-white px-3 py-1.5 text-[0.78rem] font-semibold text-navy-700 ring-1 ring-brand-100"
              >
                <Check className="size-3.5 text-brand-600" aria-hidden="true" />
                {b}
              </li>
            ))}
          </ul>

          <div className="mt-4 flex flex-wrap items-center gap-3">
            <span className="rounded-full bg-white px-2.5 py-1 text-[0.72rem] font-semibold text-brand-700 ring-1 ring-brand-100">
              Sumber: {tip.source}
            </span>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setOpen((v) => !v)}
              aria-expanded={open}
              className="-ml-1"
            >
              {open ? 'Tutup' : 'Baca selengkapnya'}
              {open ? (
                <ChevronUp className="size-4" aria-hidden="true" />
              ) : (
                <ChevronDown className="size-4" aria-hidden="true" />
              )}
            </Button>
          </div>
        </div>
      </div>
    </Card>
  )
}
