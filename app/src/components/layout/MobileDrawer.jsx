import { useEffect, useRef } from 'react'
import { ArrowLeft, Activity } from 'lucide-react'
import logo from '../../assets/logo-mark.png'
import { NAV_ITEMS } from './nav'
import { DrawerCloseButton } from './TopBar'
import { cn } from '../../lib/cn'

/**
 * Drawer navigasi untuk layar kecil (<md).
 * - aria-modal + Escape untuk keyboard
 * - backdrop menutup saat diklik
 * - fokus dikunci ke dalam drawer selama terbuka
 */
export default function MobileDrawer({ open, onClose, active, onSelect }) {
  const panelRef = useRef(null)
  const previouslyFocused = useRef(null)

  useEffect(() => {
    if (!open) return undefined

    previouslyFocused.current = document.activeElement
    document.body.style.overflow = 'hidden'

    const onKey = (e) => {
      if (e.key === 'Escape') {
        onClose()
        return
      }
      if (e.key !== 'Tab' || !panelRef.current) return

      const focusables = panelRef.current.querySelectorAll(
        'button, a[href], input, select, textarea, [tabindex]:not([tabindex="-1"])',
      )
      if (!focusables.length) return
      const first = focusables[0]
      const last = focusables[focusables.length - 1]

      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault()
        last.focus()
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault()
        first.focus()
      }
    }

    document.addEventListener('keydown', onKey)
    const t = window.setTimeout(() => {
      panelRef.current?.querySelector('button')?.focus()
    }, 60)

    return () => {
      document.removeEventListener('keydown', onKey)
      window.clearTimeout(t)
      document.body.style.overflow = ''
      previouslyFocused.current?.focus?.()
    }
  }, [open, onClose])

  if (!open) return null

  return (
    <div className="fixed inset-0 z-50 md:hidden">
      <div
        className="absolute inset-0 bg-navy-900/45 backdrop-blur-[2px]"
        onClick={onClose}
        aria-hidden="true"
      />

      <div
        id="mobile-drawer"
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-label="Menu navigasi"
        className="rise absolute inset-y-0 left-0 flex w-[min(19rem,84vw)] flex-col border-r border-slate-200 bg-white shadow-2xl"
      >
        <div className="flex items-center gap-3 border-b border-slate-100 px-4 py-3.5">
          <img src={logo} alt="" width={30} height={27} className="size-[30px] shrink-0 object-contain" />
          <span className="min-w-0 leading-tight">
            <strong className="block truncate text-[0.95rem] font-extrabold tracking-tight text-navy-900">
              Pahami Sehat
            </strong>
            <small className="block truncate text-[0.66rem] font-medium text-navy-500">
              Informasi Kesehatan untuk Semua
            </small>
          </span>
          <span className="ml-auto">
            <DrawerCloseButton onClick={onClose} />
          </span>
        </div>

        <nav className="flex flex-1 flex-col gap-1 overflow-y-auto px-3 py-4" aria-label="Menu dashboard">
          {NAV_ITEMS.map(({ id, label, icon: Icon }) => {
            const isActive = active === id
            return (
              <button
                key={id}
                type="button"
                onClick={() => onSelect(id)}
                aria-current={isActive ? 'page' : undefined}
                className={cn(
                  'flex h-12 items-center gap-3 rounded-xl px-3.5 text-left',
                  'text-[0.95rem] font-semibold transition-colors duration-200',
                  'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-500',
                  isActive
                    ? 'bg-brand-50 text-brand-700'
                    : 'text-navy-500 hover:bg-slate-100 hover:text-navy-800 active:bg-slate-200/70',
                )}
              >
                <Icon
                  className={cn('size-5 shrink-0', isActive ? 'text-brand-600' : 'text-navy-500')}
                  aria-hidden="true"
                />
                {label}
              </button>
            )
          })}
        </nav>

        <div className="border-t border-slate-100 p-3.5">
          <div className="rounded-xl bg-brand-50 p-3.5 ring-1 ring-brand-100">
            <span className="mb-1.5 inline-flex size-7 items-center justify-center rounded-full bg-white text-brand-600 shadow-sm">
              <Activity className="size-4" aria-hidden="true" />
            </span>
            <p className="text-[0.82rem] leading-snug font-medium text-navy-700">
              Setiap jawaban wajib bersumber resmi — kamu boleh cek sendiri.
            </p>
          </div>
          <a
            href="/prototipe/"
            className="mt-2 flex h-11 items-center justify-center gap-2 rounded-xl text-[0.85rem] font-semibold text-navy-500 transition-colors hover:bg-slate-100"
          >
            <ArrowLeft className="size-4" aria-hidden="true" />
            Kembali ke situs
          </a>
        </div>
      </div>
    </div>
  )
}
