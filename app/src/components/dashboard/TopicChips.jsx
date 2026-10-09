import { cn } from '../../lib/cn'
import { SectionHeading } from '../ui/primitives'

/**
 * Topik populer.
 * - desktop : chip tersusun horizontal
 * - tablet  : chip wrap ke baris berikutnya
 * - mobile  : rail chip bisa digeser horizontal (tanpa overflow halaman)
 */
export default function TopicChips({ topics, selected, onSelect }) {
  return (
    <section aria-labelledby="topik-title">
      <SectionHeading id="topik-title" title="Topik populer" />

      <div
        role="group"
        aria-label="Pilih topik kesehatan"
        className="no-scrollbar flex snap-x gap-2.5 overflow-x-auto pb-1 md:flex-wrap md:overflow-x-visible"
      >
        {topics.map((t) => {
          const isActive = selected === t.id
          return (
            <button
              key={t.id}
              type="button"
              onClick={() => onSelect(isActive ? null : t.id)}
              aria-pressed={isActive}
              className={cn(
                'h-11 shrink-0 snap-start rounded-full px-4 text-[0.88rem] font-semibold',
                'transition-all duration-200 ease-out',
                'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-500',
                isActive
                  ? 'bg-brand-500 text-white shadow-[0_6px_16px_-8px_rgba(13,132,120,0.8)]'
                  : 'border border-slate-200 bg-white text-navy-700 hover:-translate-y-0.5 hover:border-brand-300 hover:bg-brand-50 active:translate-y-0',
              )}
            >
              {t.label}
            </button>
          )
        })}
      </div>
    </section>
  )
}
