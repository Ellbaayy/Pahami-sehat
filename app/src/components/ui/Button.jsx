import { cn } from '../../lib/cn'

const GAYA = {
  utama: 'bg-brand-600 text-white hover:bg-brand-700 border-transparent',
  kedua: 'bg-white text-navy-900 border-line-300 hover:bg-surface-50',
  halus: 'bg-brand-50 text-brand-700 border-transparent hover:bg-brand-100',
  bahaya: 'bg-white text-red-700 border-red-200 hover:bg-red-50',
}
const UKURAN = {
  sm: 'h-9 px-3 text-[0.8125rem]',
  md: 'h-11 px-4 text-sm', // 44 px — target sentuh minimum
  lg: 'h-12 px-5 text-[0.9375rem]',
}

export function Button({ varian = 'utama', ukuran = 'md', className, as: Tag = 'button', ...rest }) {
  return (
    <Tag
      className={cn(
        'inline-flex items-center justify-center gap-2 rounded-xl border font-semibold',
        'transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-600',
        'disabled:cursor-not-allowed disabled:opacity-50',
        GAYA[varian],
        UKURAN[ukuran],
        className,
      )}
      {...rest}
    />
  )
}
