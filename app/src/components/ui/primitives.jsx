import { Loader2, AlertCircle } from 'lucide-react'
import { cn } from '../../lib/cn'

/* ---------------- Card ---------------- */
export function Card({ className, children, as: Tag = 'div', ...rest }) {
  return (
    <Tag
      className={cn(
        'rounded-2xl border border-slate-200/80 bg-white',
        'shadow-[0_1px_2px_rgba(15,30,51,0.04),0_8px_24px_-16px_rgba(15,30,51,0.10)]',
        'transition-[box-shadow,transform,border-color] duration-200 ease-out',
        className,
      )}
      {...rest}
    >
      {children}
    </Tag>
  )
}

/* ---------------- Section heading ---------------- */
export function SectionHeading({ eyebrow, title, description, action, id }) {
  return (
    <div className="mb-[clamp(0.85rem,1.4vw,1.35rem)] flex flex-wrap items-end justify-between gap-x-4 gap-y-2">
      <div className="min-w-0">
        {eyebrow ? (
          <p className="mb-1 text-[0.72rem] font-bold tracking-[0.14em] uppercase text-brand-600">
            {eyebrow}
          </p>
        ) : null}
        <h2
          id={id}
          className="text-[clamp(1.05rem,0.95rem+0.45vw,1.35rem)] font-bold tracking-tight text-navy-900"
        >
          {title}
        </h2>
        {description ? (
          <p className="mt-1 max-w-[62ch] text-[clamp(0.85rem,0.8rem+0.15vw,0.95rem)] text-navy-500">
            {description}
          </p>
        ) : null}
      </div>
      {action}
    </div>
  )
}

/* ---------------- Button ---------------- */
const BTN_VARIANTS = {
  primary:
    'bg-brand-500 text-white hover:bg-brand-600 active:bg-brand-600 shadow-[0_6px_16px_-8px_rgba(13,132,120,0.7)]',
  soft: 'bg-brand-50 text-brand-700 hover:bg-brand-100 border border-brand-100',
  neutral: 'bg-white text-navy-700 border border-slate-200 hover:border-slate-300 hover:bg-slate-50',
  ghost: 'text-navy-500 hover:text-navy-800 hover:bg-slate-100',
}

const BTN_SIZES = {
  sm: 'h-11 px-4 text-[0.84rem] rounded-lg md:h-10 lg:h-9 lg:px-3.5 lg:text-[0.82rem]',
  md: 'h-11 px-5 text-[0.92rem] rounded-xl',
  lg: 'h-12 px-6 text-[0.95rem] rounded-xl',
}

export function Button({
  variant = 'primary',
  size = 'md',
  loading = false,
  full = false,
  className,
  children,
  disabled,
  ...rest
}) {
  return (
    <button
      type="button"
      disabled={disabled || loading}
      className={cn(
        'inline-flex items-center justify-center gap-2 font-semibold',
        'transition-all duration-200 ease-out',
        'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-500',
        'disabled:cursor-not-allowed disabled:opacity-60',
        BTN_VARIANTS[variant],
        BTN_SIZES[size],
        full && 'w-full',
        className,
      )}
      {...rest}
    >
      {loading ? <Loader2 className="size-4 animate-spin" aria-hidden="true" /> : null}
      {children}
    </button>
  )
}

/* ---------------- Skeleton ---------------- */
export function Skeleton({ className }) {
  return <div className={cn('skeleton rounded-lg', className)} aria-hidden="true" />
}

/* ---------------- Empty state ---------------- */
export function EmptyState({ icon: Icon, title, description, action }) {
  return (
    <div className="flex flex-col items-center gap-3 rounded-2xl border border-dashed border-slate-300 bg-slate-50/60 px-6 py-10 text-center">
      {Icon ? (
        <span className="grid size-11 place-items-center rounded-full bg-white text-brand-600 shadow-sm">
          <Icon className="size-5" aria-hidden="true" />
        </span>
      ) : null}
      <p className="font-semibold text-navy-800">{title}</p>
      {description ? (
        <p className="max-w-[42ch] text-sm text-navy-500">{description}</p>
      ) : null}
      {action}
    </div>
  )
}

/* ---------------- Source pills ---------------- */
/** Terima array string ("WHO") atau objek ({judul, penerbit}) dari API. */
export function SourcePills({ sources = [], negative = false, label = 'Sumber' }) {
  if (!sources.length) return null
  return (
    <div className="mt-3 flex flex-wrap items-center gap-2 border-t border-dashed border-slate-200 pt-3">
      <span className="text-[0.68rem] font-bold tracking-[0.12em] uppercase text-navy-500">
        {label}
      </span>
      {sources.map((s, i) => {
        const teks = typeof s === 'string' ? s : [s.penerbit, s.judul].filter(Boolean).join(' — ')
        const url = typeof s === 'object' && /^https?:\/\//i.test(s?.url ?? '') ? s.url : ''
        const gaya = cn(
          'inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[0.72rem] font-semibold',
          negative
            ? 'bg-sky-50 text-sky-600 ring-1 ring-sky-100'
            : 'bg-brand-50 text-brand-700 ring-1 ring-brand-100',
          url && 'underline decoration-dotted underline-offset-2 transition-colors hover:bg-brand-100',
        )
        const isi = (
          <>
            <span aria-hidden="true">{negative ? '→' : '✓'}</span>
            {teks || url.replace(/^https?:\/\//, '').slice(0, 40)}
          </>
        )
        // kalau ada URL, jadikan tautan yang bisa dibuka — sumber harus bisa dicek sendiri
        return url ? (
          <a
            key={`${teks}-${i}`}
            href={url}
            target="_blank"
            rel="noopener noreferrer"
            title={url}
            className={gaya}
          >
            {isi}
          </a>
        ) : (
          <span key={`${teks}-${i}`} className={gaya}>
            {isi}
          </span>
        )
      })}
    </div>
  )
}

/* ---------------- Poin kunci (bukti rubrik) ---------------- */
export function PoinKunci({ items = [] }) {
  if (!items.length) return null
  return (
    <details className="group mt-3 rounded-xl border border-slate-200 bg-white/70 px-3.5 py-2.5">
      <summary className="flex cursor-pointer items-center gap-2 text-[0.78rem] font-bold text-navy-700 marker:content-none">
        <span className="text-brand-600 transition-transform group-open:rotate-90" aria-hidden="true">
          ▸
        </span>
        Poin kunci yang dipertahankan ({items.length})
      </summary>
      <ul className="mt-2 space-y-1.5 pl-1">
        {items.map((p, i) => (
          <li key={i} className="flex gap-2 text-[0.84rem] leading-snug text-navy-700">
            <span className="text-brand-500" aria-hidden="true">•</span>
            <span>{p}</span>
          </li>
        ))}
      </ul>
      <p className="mt-2 text-[0.7rem] text-slate-500">
        Daftar ini ditandai lebih dulu sebelum bahasa disederhanakan — bukti kelengkapan informasi terjaga.
      </p>
    </details>
  )
}

/* ---------------- Peringatan / error ---------------- */
export function Peringatan({ pesan, code, aksi }) {
  if (!pesan) return null
  const saldo = code === 'insufficient_balance'
  return (
    <div
      role="alert"
      className={cn(
        'mt-3 flex flex-wrap items-start gap-2.5 rounded-xl border px-4 py-3 text-[0.88rem]',
        saldo ? 'border-amber-200 bg-amber-50 text-amber-800' : 'border-rose-200 bg-rose-50 text-rose-700',
      )}
    >
      <AlertCircle className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
      <div className="min-w-0 flex-1">
        <p className="font-semibold">{pesan}</p>
        {code ? <p className="mt-0.5 text-[0.76rem] opacity-80">Kode: {code}</p> : null}
      </div>
      {aksi}
    </div>
  )
}


/* ---------------- Sumber jawaban (bisa dicek sendiri) ---------------- */
/**
 * Daftar sumber jawaban AI, dengan URL lengkap yang bisa dibuka.
 * Tujuan: pengguna skeptis bisa memverifikasi sendiri, bukan sekadar percaya.
 */
export function SumberJawaban({ sumber = [], cari = [], label = 'Sumber jawaban' }) {
  // gabungkan: sumber yang dipakai model + hasil pencarian yang belum terpakai
  // cari dulu sumber mana yang lembaga resmi (Kemenkes/WHO/BPOM) dari hasil
  // pencarian — supaya sumber yang DIKUTIP model pun tetap dapat tanda resmi
  const resmiSet = new Set((cari || []).filter((h) => h?.resmi).map((h) => h.url))
  const dipakai = (sumber || []).map((s) => ({
    judul: [s.penerbit, s.judul].filter(Boolean).join(' — ') || s.url,
    url: s.url || '',
    resmi: resmiSet.has(s.url),
    dipakai: true,
  }))
  const sudah = new Set(dipakai.map((d) => d.url).filter(Boolean))
  const cadangan = (cari || [])
    .filter((h) => h?.url && !sudah.has(h.url))
    .map((h) => ({ judul: h.judul || h.url, url: h.url, resmi: Boolean(h.resmi), dipakai: false }))

  const semua = [...dipakai, ...cadangan]
  if (!semua.length) return null

  const adaResmi = semua.some((s) => s.resmi)

  return (
    <details
      open
      className="mt-3 rounded-xl border border-slate-200 bg-white px-3.5 py-3"
    >
      <summary className="flex cursor-pointer flex-wrap items-center gap-2 text-[0.8rem] font-bold text-navy-800 marker:content-none">
        <span aria-hidden="true">🔎</span>
        {label} ({semua.length})
        {adaResmi ? (
          <span className="rounded-full bg-brand-50 px-2 py-0.5 text-[0.68rem] font-bold text-brand-700 ring-1 ring-brand-100">
            termasuk sumber resmi
          </span>
        ) : null}
      </summary>

      <p className="mt-2 text-[0.78rem] text-slate-600">
        Silakan cek sendiri lewat tautan di bawah — jangan percaya begitu saja.
        {!dipakai.length ? ' Model belum mengutip satu pun; daftar ini hasil pencarian mentah.' : ''}
      </p>

      <ul className="mt-2.5 space-y-2">
        {semua.map((s, i) => (
          <li key={`${s.url}-${i}`} className="rounded-lg border border-slate-100 bg-slate-50/60 p-2.5">
            <div className="flex items-start gap-2">
              <span className="shrink-0" aria-hidden="true">{s.resmi ? '🏛️' : s.dipakai ? '✅' : '🔗'}</span>
              <div className="min-w-0 flex-1">
                <p className="text-[0.84rem] leading-snug font-semibold text-navy-800">
                  {s.judul}
                  {s.resmi ? (
                    <span className="ml-1.5 text-[0.68rem] font-bold text-brand-600">SUMBER RESMI</span>
                  ) : null}
                  {!s.dipakai ? (
                    <span className="ml-1.5 text-[0.68rem] font-normal text-slate-500">ditemukan, belum dikutip</span>
                  ) : null}
                </p>
                {s.url ? (
                  <a
                    href={s.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="mt-0.5 block truncate font-mono text-[0.72rem] text-brand-700 underline decoration-dotted underline-offset-2 hover:text-brand-800"
                    title={s.url}
                  >
                    {s.url}
                  </a>
                ) : (
                  <p className="mt-0.5 text-[0.72rem] text-slate-500">(tanpa tautan)</p>
                )}
              </div>
            </div>
          </li>
        ))}
      </ul>

      <p className="mt-2.5 text-[0.7rem] text-slate-500">
        Jawaban disusun dari hasil pencarian internet yang diambil saat pertanyaan diproses.
        Tanda ✅ berarti sumber itu dipakai di jawaban; 🏛️ menandai lembaga resmi.
      </p>
    </details>
  )
}
