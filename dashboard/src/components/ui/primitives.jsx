import { Loader2 } from 'lucide-react'
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
export function SourcePills({ sources = [], negative = false }) {
  if (!sources.length) return null
  return (
    <div className="mt-3 flex flex-wrap items-center gap-2 border-t border-dashed border-slate-200 pt-3">
      <span className="text-[0.68rem] font-bold tracking-[0.12em] uppercase text-navy-500">
        Sumber
      </span>
      {sources.map((s) => (
        <span
          key={s}
          className={cn(
            'inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[0.72rem] font-semibold',
            negative
              ? 'bg-sky-50 text-sky-600 ring-1 ring-sky-100'
              : 'bg-brand-50 text-brand-700 ring-1 ring-brand-100',
          )}
        >
          <span aria-hidden="true">{negative ? '→' : '✓'}</span>
          {s}
        </span>
      ))}
    </div>
  )
}
