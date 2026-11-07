import { ArrowLeft, Activity } from 'lucide-react'
import logo from '../../assets/logo-mark.png'
import { NAV_ITEMS } from './nav'
import { DrawerCloseButton } from './TopBar'
import { cn } from '../../lib/cn'
import * as Dialog from '@radix-ui/react-dialog'

/**
 * Drawer navigasi untuk layar kecil (<md).
 * - aria-modal + Escape untuk keyboard
 * - backdrop menutup saat diklik
 * - fokus dikunci ke dalam drawer selama terbuka
 */
export default function MobileDrawer({ open, onClose, active, onSelect, t = (k) => k }) {
  if (!open) return null

  return (
    <Dialog.Root open={open} onOpenChange={onClose}>
      <Dialog.Portal>
        <Dialog.Overlay className="absolute inset-0 z-40 bg-navy-900/45 backdrop-blur-[2px]" />
        <Dialog.Content
          id="mobile-drawer"
          className="rise absolute inset-y-0 left-0 flex w-[min(19rem,84vw)] flex-col border-r border-line-200 bg-white shadow-2xl"
        >
          <div className="flex items-center gap-3 border-b border-line-100 px-4 py-3.5">
            <img src={logo} alt="" width={30} height={27} className="size-[30px] shrink-0 object-contain" />
            <span className="min-w-0 leading-tight">
              <strong className="block truncate text-[0.95rem] font-extrabold tracking-tight text-navy-900">
                Pahami Sehat
              </strong>
              <small className="block truncate text-[0.8125rem] font-medium text-navy-500">
                {t('nav.isiDrawer')}
              </small>
            </span>
            <span className="ml-auto">
              <DrawerCloseButton onClick={onClose} t={t} />
            </span>
          </div>

          <nav className="flex flex-1 flex-col gap-1 overflow-y-auto px-3 py-4" aria-label={t('nav.drawerDashboard')}>
            {NAV_ITEMS.map(({ id, kunci, label, icon: Icon }) => {
              const teks = t(kunci) || label
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
                      : 'text-navy-500 hover:bg-surface-100 hover:text-navy-800 active:bg-surface-200/70',
                  )}
                >
                  <Icon
                    className={cn('size-5 shrink-0', isActive ? 'text-brand-700' : 'text-navy-500')}
                    aria-hidden="true"
                  />
                  {teks}
                </button>
              )
            })}
          </nav>

          <div className="border-t border-line-100 p-3.5">
            <div className="rounded-xl bg-brand-50 p-3.5 ring-1 ring-brand-100">
              <span className="mb-1.5 inline-flex size-7 items-center justify-center rounded-full bg-white text-brand-700 shadow-sm">
                <Activity className="size-4" aria-hidden="true" />
              </span>
              <p className="text-[0.82rem] leading-snug font-medium text-navy-700">
                {t('nav.tagline')}
              </p>
            </div>
            <a
              href="/"
              className="mt-2 flex h-11 items-center justify-center gap-2 rounded-xl text-[0.85rem] font-semibold text-navy-500 transition-colors hover:bg-surface-100"
            >
              <ArrowLeft className="size-4" aria-hidden="true" />
              {t('nav.kembali')}
            </a>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  )
}
