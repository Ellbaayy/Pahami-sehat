import { Menu, Bell, X } from 'lucide-react'
import logo from '../../assets/logo-mark.png'

/**
 * Header khusus mobile (<md). Tablet memakai rail icon-only,
 * jadi header ini tidak ikut muncul di sana.
 */
export default function TopBar({ onOpenMenu, menuOpen, unread, onDismissNotif }) {
  return (
    <header className="sticky top-0 z-40 border-b border-slate-200 bg-white/90 backdrop-blur-md md:hidden">
      <div className="flex h-14 items-center gap-2 px-3 sm:px-4">
        <button
          type="button"
          onClick={onOpenMenu}
          aria-label="Buka menu navigasi"
          aria-expanded={menuOpen ? 'true' : 'false'}
          aria-controls="mobile-drawer"
          className="grid size-10 shrink-0 place-items-center rounded-xl border border-slate-200 text-navy-700 transition-colors hover:bg-slate-50 active:bg-slate-100"
        >
          <Menu className="size-5" aria-hidden="true" />
        </button>

        <a href="./" className="-ml-1 flex min-h-11 min-w-0 items-center gap-2 rounded-lg px-1">
          <img src={logo} alt="" width={26} height={24} className="size-[26px] shrink-0 object-contain" />
          <span className="truncate text-[0.95rem] font-extrabold tracking-tight text-navy-900">
            Pahami Sehat
          </span>
        </a>

        <div className="ml-auto flex items-center gap-1.5">
          <button
            type="button"
            onClick={onDismissNotif}
            aria-label={unread ? 'Notifikasi, 1 belum dibaca' : 'Notifikasi, tidak ada yang baru'}
            className="relative grid size-10 place-items-center rounded-xl text-navy-500 transition-colors hover:bg-slate-100 hover:text-navy-800"
          >
            <Bell className="size-5" aria-hidden="true" />
            {unread ? (
              <span className="absolute top-2 right-2.5 size-2 rounded-full bg-rose-500 ring-2 ring-white" />
            ) : null}
          </button>
        </div>
      </div>
    </header>
  )
}

export function DrawerCloseButton({ onClick }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label="Tutup menu navigasi"
      className="grid size-9 shrink-0 place-items-center rounded-lg text-navy-500 transition-colors hover:bg-slate-100 hover:text-navy-800 lg:hidden"
    >
      <X className="size-5" aria-hidden="true" />
    </button>
  )
}
