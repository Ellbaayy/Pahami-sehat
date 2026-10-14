import { ArrowLeft, Activity } from 'lucide-react'
import logo from '../../assets/logo-mark.png'
import { NAV_ITEMS } from './nav'
import { cn } from '../../lib/cn'

/**
 * Sidebar desktop/tablet.
 *
 * - <md   : tidak dirender (pindah ke drawer + TopBar)
 * - md+   : selalu tampil, dan bisa DIBUKA-TUTUP dari tombol di TopBar:
 *             tertutup -> rail ikon 76px (hanya ikon, label disembunyikan)
 *             terbuka  -> sidebar penuh 240px dengan label
 *
 * Kenapa lebarnya dua nilai tetap dan bukan lebar bebas: tata letak di
 * kanannya (`flex-1`) ikut bergeser, jadi lebar tetap membuat pergeserannya
 * mulus dan tidak ada teks yang terpotong di tengah transisi.
 *
 * Pilihan buka/tutup disimpan di peramban oleh App.jsx, jadi tidak kembali
 * tertutup setiap halaman dimuat ulang.
 *
 * @param {boolean} terbuka - true = sidebar penuh, false = rail ikon
 */
export default function Sidebar({ active, onSelect, terbuka = true, t = (k) => k }) {
  return (
    <aside
      id="sidebar-utama"
      className={cn(
        'sticky top-0 hidden h-dvh shrink-0 flex-col border-r border-line-200 bg-white md:flex',
        'transition-[width] duration-300 ease-out motion-reduce:transition-none',
        terbuka ? 'md:w-[240px]' : 'md:w-[76px]',
      )}
      aria-label={t('nav.menu')}
    >
      {/* brand — saat tertutup hanya logonya yang tampil */}
      <div className={cn('flex items-center gap-3 pt-5 pb-4', terbuka ? 'px-5' : 'justify-center px-3')}>
        <img
          src={logo}
          alt=""
          width={34}
          height={31}
          className="size-9 shrink-0 rounded-lg object-contain"
        />
        {terbuka ? (
          <span className="hidden min-w-0 leading-tight md:block">
            <strong className="block truncate text-[0.98rem] font-extrabold tracking-tight text-navy-900">
              Pahami Sehat
            </strong>
            <small className="block text-[0.66rem] leading-tight font-medium text-navy-500">
              {t('nav.isiDrawer')}
            </small>
          </span>
        ) : null}
      </div>

      <div className={cn('mx-3 mb-2 h-px bg-surface-200', !terbuka && 'hidden')} />

      {/* menu */}
      <nav
        className={cn('flex flex-1 flex-col gap-1 overflow-y-auto py-2', terbuka ? 'px-3.5' : 'px-2.5')}
      >
        {NAV_ITEMS.map(({ id, kunci, label, icon: Icon }) => {
          const teks = t(kunci) || label
          const isActive = active === id
          return (
            <button
              key={id}
              type="button"
              onClick={() => onSelect(id)}
              aria-current={isActive ? 'page' : undefined}
              aria-label={teks}
              title={teks}
              className={cn(
                'group relative flex h-11 items-center gap-3 rounded-xl px-3',
                'text-[0.92rem] font-semibold transition-colors duration-200 ease-out',
                'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-500',
                terbuka ? 'justify-start' : 'justify-center',
                isActive
                  ? 'bg-brand-50 text-brand-700'
                  : 'text-navy-500 hover:bg-surface-100 hover:text-navy-800 active:bg-surface-200/70',
              )}
            >
              <Icon
                className={cn(
                  'size-[19px] shrink-0 transition-transform duration-200',
                  isActive ? 'text-brand-700' : 'text-navy-500 group-hover:scale-105',
                )}
                aria-hidden="true"
              />
              {terbuka ? <span className="truncate">{teks}</span> : null}
              {isActive && terbuka ? (
                <span
                  className="absolute left-0 h-5 w-[3px] rounded-r-full bg-brand-500"
                  aria-hidden="true"
                />
              ) : null}
            </button>
          )
        })}
      </nav>

      {/* kartu bawah — disembunyikan saat tertutup supaya rail tetap bersih */}
      <div className={cn(terbuka ? 'p-3.5' : 'p-2.5')}>
        {terbuka ? (
          <div className="rounded-xl bg-brand-50 p-3.5 ring-1 ring-brand-100">
            <span className="mb-1.5 inline-flex size-7 items-center justify-center rounded-full bg-white text-brand-700 shadow-sm">
              <Activity className="size-4" aria-hidden="true" />
            </span>
            <p className="text-[0.8rem] leading-snug font-medium text-navy-700">
              Setiap jawaban wajib bersumber resmi — kamu boleh cek sendiri.
            </p>
          </div>
        ) : null}

        <a
          href="/"
          className={cn(
            'flex h-10 items-center gap-2 rounded-xl text-[0.8rem] font-semibold text-navy-500 transition-colors hover:bg-surface-100 hover:text-navy-800',
            terbuka ? 'mt-2 justify-start px-3' : 'mt-0 justify-center',
          )}
          title={t('nav.kembali')}
        >
          <ArrowLeft className="size-4 shrink-0" aria-hidden="true" />
          {terbuka ? <span className="truncate">{t('nav.kembali')}</span> : null}
        </a>
      </div>
    </aside>
  )
}
