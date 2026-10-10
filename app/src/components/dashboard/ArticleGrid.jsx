import { useState } from 'react'
import { FileText, Syringe, Utensils, ArrowRight, Clock, ChevronDown, ChevronUp } from 'lucide-react'
import { Card, SectionHeading, Button } from '../ui/primitives'
import { cn } from '../../lib/cn'

const TINTS = {
  brand: { wrap: 'bg-brand-50 text-brand-600', tag: 'bg-white/80 text-brand-700 ring-brand-100' },
  sky: { wrap: 'bg-sky-100 text-sky-700', tag: 'bg-white/80 text-sky-700 ring-sky-100' },
  amber: { wrap: 'bg-amber-50 text-amber-600', tag: 'bg-white/80 text-amber-700 ring-amber-100' },
  rose: { wrap: 'bg-rose-50 text-rose-600', tag: 'bg-white/80 text-rose-700 ring-rose-100' },
  purple: { wrap: 'bg-purple-50 text-purple-600', tag: 'bg-white/80 text-purple-700 ring-purple-100' },
  teal: { wrap: 'bg-teal-50 text-teal-600', tag: 'bg-white/80 text-teal-700 ring-teal-100' },
}

const ICONS = { Literasi: FileText, Vaksinasi: Syringe, Gizi: Utensils }

function ArticleCard({ article }) {
  const [open, setOpen] = useState(false)
  const Icon = ICONS[article.category] ?? FileText
  const tint = TINTS[article.tint] ?? TINTS.brand
  const punyaGambar = Boolean(article.gambar)

  return (
    <Card
      as="article"
      className="group flex flex-col overflow-hidden transition-transform duration-200 hover:-translate-y-1 hover:border-brand-200 focus-within:border-brand-300"
    >
      {/* thumbnail — pakai gambar asli dari sumber bila ada */}
      <div className={cn('relative aspect-video w-full overflow-hidden', tint.wrap)}>
        {punyaGambar ? (
          <img
            src={article.gambar}
            alt=""
            className="absolute inset-0 h-full w-full object-cover"
            loading="lazy"
            decoding="async"
            onError={(e) => {
              // gambar gagal dimuat: sembunyikan, latar warna tetap tampil
              e.currentTarget.style.display = 'none'
            }}
          />
        ) : (
          <>
            <svg
              viewBox="0 0 320 180"
              className="absolute inset-0 h-full w-full opacity-30"
              aria-hidden="true"
            >
              <g fill="currentColor">
                <circle cx="30" cy="30" r="4" />
                <circle cx="60" cy="30" r="4" />
                <circle cx="90" cy="30" r="4" />
                <circle cx="30" cy="60" r="4" />
                <circle cx="60" cy="60" r="4" />
                <circle cx="290" cy="150" r="4" />
                <circle cx="260" cy="150" r="4" />
                <circle cx="230" cy="150" r="4" />
              </g>
            </svg>
            <span className="absolute inset-0 grid place-items-center">
              <Icon className="size-14" strokeWidth={1.4} aria-hidden="true" />
            </span>
          </>
        )}
        <span
          className={cn(
            'absolute top-3 left-3 rounded-full px-2.5 py-1 text-[0.7rem] font-bold ring-1',
            tint.tag,
          )}
        >
          {article.category}
        </span>
      </div>

      <div className="flex flex-1 flex-col p-[clamp(0.9rem,0.8rem+0.4vw,1.25rem)]">
        <h3 className="text-[clamp(0.98rem,0.94rem+0.2vw,1.08rem)] leading-snug font-bold text-navy-900 transition-colors group-hover:text-brand-700">
          {article.title}
        </h3>
        <p className="mt-1.5 text-[0.87rem] leading-relaxed text-navy-500">{article.excerpt}</p>

        {open ? (
          <div className="rise mt-3 border-t border-dashed border-line-200 pt-3">
            <p className="text-[0.87rem] leading-relaxed text-navy-700">{article.body}</p>
            <p className="mt-2 text-[0.74rem] font-semibold text-brand-700">
              Sumber: {article.source}
            </p>
            {article.url ? (
              <a
                href={article.url}
                target="_blank"
                rel="noopener noreferrer"
                className="mt-1.5 inline-flex items-center gap-1 text-[0.74rem] font-semibold text-brand-700 underline decoration-dotted underline-offset-2 hover:text-brand-700"
              >
                Baca artikel aslinya
                <ArrowRight className="size-3" aria-hidden="true" />
              </a>
            ) : null}
          </div>
        ) : null}

        <div className="mt-auto flex flex-wrap items-center justify-between gap-3 pt-4">
          <span className="inline-flex items-center gap-1.5 text-[0.76rem] font-medium text-muted-500">
            <Clock className="size-3.5" aria-hidden="true" />
            {article.readTime}
          </span>
          <Button variant="soft" size="sm" onClick={() => setOpen((v) => !v)} aria-expanded={open}>
            {open ? 'Tutup' : 'Baca'}
            {open ? (
              <ChevronUp className="size-4" aria-hidden="true" />
            ) : (
              <ArrowRight
                className="size-4 transition-transform group-hover:translate-x-0.5"
                aria-hidden="true"
              />
            )}
          </Button>
        </div>
      </div>
    </Card>
  )
}

/**
 * Grid artikel — jumlah kolom mengikuti ruang yang tersedia (auto-fit + minmax),
 * bukan breakpoint kaku: 1 kolom di layar sempit, 3 kolom di desktop besar.
 */
export default function ArticleGrid({ articles }) {
  return (
    <section aria-labelledby="artikel-title">
      <SectionHeading
        id="artikel-title"
        title="Artikel Kesehatan"
        description="Bacaan singkat yang sudah disederhanakan, lengkap dengan rujukannya."
      />

      <div className="grid grid-cols-[repeat(auto-fit,minmax(min(100%,16.5rem),1fr))] gap-[clamp(0.85rem,1.2vw,1.35rem)]">
        {articles.map((a) => (
          <ArticleCard key={a.id} article={a} />
        ))}
      </div>
    </section>
  )
}
