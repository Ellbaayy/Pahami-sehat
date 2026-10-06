import { ArrowLeft, Activity } from 'lucide-react'
import logo from '../../assets/logo-mark.png'
import { NAV_ITEMS } from './nav'
import { cn } from '../../lib/cn'

/**
 * Sidebar desktop.
 * - <md   : tidak dirender (pindah ke drawer + top header)
 * - md    : rail icon-only  (tablet / laptop sempit)
 * - >=lg  : sidebar penuh 240px dengan label
 */
export default function Sidebar({ active, onSelect }) {
  return (
    <aside
      className="sticky top-0 hidden h-dvh shrink-0 flex-col border-r border-slate-200 bg-white md:flex md:w-[76px] lg:w-[240px]"
      aria-label="Navigasi utama"
    >
      {/* brand */}
      <div className="flex items-center gap-3 px-3 pt-5 pb-4 lg:px-5">
        <img
          src={logo}
          alt=""
          width={34}
          height={31}
          className="size-9 shrink-0 rounded-lg object-contain lg:size-[34px]"
        />
        <span className="hidden min-w-0 leading-tight lg:block">
          <strong className="block truncate text-[0.98rem] font-extrabold tracking-tight text-navy-900">
            Pahami Sehat
          </strong>
          <small className="block text-[0.66rem] leading-tight font-medium text-navy-500">
            Informasi Kesehatan untuk Semua
          </small>
        </span>
      </div>

      <div className="mx-3 mb-2 hidden h-px bg-slate-200 lg:block" />

      {/* menu */}
      <nav className="flex flex-1 flex-col gap-1 overflow-y-auto px-2.5 py-2 lg:px-3.5">
        {NAV_ITEMS.map(({ id, label, icon: Icon }) => {
          const isActive = active === id
          return (
            <button
              key={id}
              type="button"
              onClick={() => onSelect(id)}
              aria-current={isActive ? 'page' : undefined}
              aria-label={label}
              title={label}
              className={cn(
                'group relative flex h-11 items-center gap-3 rounded-xl px-3',
                'text-[0.92rem] font-semibold transition-colors duration-200 ease-out',
                'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-500',
                'justify-center lg:justify-start',
                isActive
                  ? 'bg-brand-50 text-brand-700'
                  : 'text-navy-500 hover:bg-slate-100 hover:text-navy-800 active:bg-slate-200/70',
              )}
            >
              <Icon
                className={cn(
                  'size-[19px] shrink-0 transition-transform duration-200',
                  isActive ? 'text-brand-600' : 'text-navy-500 group-hover:scale-105',
                )}
                aria-hidden="true"
              />
              <span className="hidden truncate lg:inline">{label}</span>
              {isActive ? (
                <span
                  className="absolute left-0 hidden h-5 w-[3px] rounded-r-full bg-brand-500 lg:block"
                  aria-hidden="true"
                />
              ) : null}
            </button>
          )
        })}
      </nav>

      {/* kartu bawah */}
      <div className="p-2.5 lg:p-3.5">
        <div className="hidden rounded-xl bg-brand-50 p-3.5 ring-1 ring-brand-100 lg:block">
          <span className="mb-1.5 inline-flex size-7 items-center justify-center rounded-full bg-white text-brand-600 shadow-sm">
            <Activity className="size-4" aria-hidden="true" />
          </span>
          <p className="text-[0.8rem] leading-snug font-medium text-navy-700">
            Setiap jawaban wajib bersumber resmi — kamu boleh cek sendiri.
          </p>
        </div>

        <a
          href="../../Pahami-Sehat/index.html"
          className="mt-2 flex h-10 items-center justify-center gap-2 rounded-xl text-[0.8rem] font-semibold text-navy-500 transition-colors hover:bg-slate-100 hover:text-navy-800 lg:justify-start lg:px-3"
          title="Kembali ke situs utama"
        >
          <ArrowLeft className="size-4 shrink-0" aria-hidden="true" />
          <span className="hidden lg:inline">Kembali ke situs</span>
        </a>
      </div>
    </aside>
  )
}
