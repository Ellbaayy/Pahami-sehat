import { History, ArrowRight, MessageSquareText } from 'lucide-react'
import { Card, SectionHeading, Button, EmptyState } from '../ui/primitives'

/** Riwayat Terakhir — pertanyaan sebelumnya (contoh awal + sesi berjalan). */
export default function RecentHistory({ items, onSeeAll, max = 4 }) {
  const shown = items.slice(0, max)

  return (
    <section aria-labelledby="riwayat-title">
      <SectionHeading
        id="riwayat-title"
        title="Riwayat Terakhir"
        description="Pertanyaan yang baru saja kamu ajukan di perangkat ini."
        action={
          onSeeAll ? (
            <Button variant="ghost" size="sm" onClick={onSeeAll} className="shrink-0">
              Lihat semua
              <ArrowRight className="size-4" aria-hidden="true" />
            </Button>
          ) : null
        }
      />

      {shown.length === 0 ? (
        <EmptyState
          icon={History}
          title="Belum ada riwayat"
          description="Mulai dengan mengetik pertanyaan pada kartu Tanya AI di atas."
        />
      ) : (
        <Card className="divide-y divide-slate-100 overflow-hidden">
          {shown.map((h) => (
            <article
              key={h.id}
              className="flex items-start gap-3 px-[clamp(0.9rem,0.8rem+0.4vw,1.25rem)] py-3.5 transition-colors hover:bg-slate-50"
            >
              <span className="mt-0.5 grid size-8 shrink-0 place-items-center rounded-lg bg-brand-50 text-brand-600">
                <MessageSquareText className="size-4" aria-hidden="true" />
              </span>
              <div className="min-w-0 flex-1">
                <p className="text-[0.92rem] leading-snug font-semibold text-navy-900">{h.question}</p>
                <p className="mt-0.5 text-[0.82rem] leading-snug text-navy-500">{h.answer}</p>
                <div className="mt-1.5 flex flex-wrap items-center gap-2">
                  <span className="text-[0.72rem] font-medium text-slate-500">{h.time}</span>
                  {h.sources?.map((s) => (
                    <span
                      key={s}
                      className="rounded-full bg-slate-100 px-2 py-0.5 text-[0.68rem] font-semibold text-navy-500"
                    >
                      {s}
                    </span>
                  ))}
                </div>
              </div>
            </article>
          ))}
        </Card>
      )}
    </section>
  )
}
