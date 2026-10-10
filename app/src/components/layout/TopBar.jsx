import { useEffect, useRef, useState } from 'react'
import { Menu, Bell, X, Info, Archive, Plug } from 'lucide-react'
import logo from '../../assets/logo-mark.png'
import { cn } from '../../lib/cn'

/**
 * Header khusus mobile (<md). Tablet memakai rail icon-only,
 * jadi header ini tidak ikut muncul di sana.
 *
 * Lonceng di kanan membuka daftar pemberitahuan. Isinya BUKAN contoh: setiap
 * butir dihitung dari keadaan nyata aplikasi (kapan konten harian terakhir
 * diperbarui, berapa jawaban tersimpan, apakah server terhubung). Titik merah
 * menandai ada butir yang belum dibaca, dan itu ikut tersimpan di peramban.
 */

const IKON = { konten: Info, riwayat: Archive, server: Plug }

export default function TopBar({
  onOpenMenu,
  menuOpen,
  notifikasi = [],
  belumDibaca = false,
  onBaca,
  onBuka,
  t = (k) => k,
}) {
  const [buka, setBuka] = useState(false)
  const kotakRef = useRef(null)

  // tutup panel kalau klik di luar atau tekan Escape
  useEffect(() => {
    if (!buka) return
    const luar = (e) => {
      if (kotakRef.current && !kotakRef.current.contains(e.target)) setBuka(false)
    }
    const esc = (e) => {
      if (e.key === 'Escape') setBuka(false)
    }
    document.addEventListener('mousedown', luar)
    document.addEventListener('keydown', esc)
    return () => {
      document.removeEventListener('mousedown', luar)
      document.removeEventListener('keydown', esc)
    }
  }, [buka])

  const jumlah = notifikasi.length

  const bukaTutup = () => {
    const jadi = !buka
    setBuka(jadi)
    // dibuka = dibaca; tandai supaya titik merah tidak muncul lagi
    if (jadi && belumDibaca) onBaca?.()
  }

  const pilih = (n) => {
    setBuka(false)
    onBuka?.(n)
  }

  return (
    <header className="sticky top-0 z-40 border-b border-line-200 bg-white/90 backdrop-blur-md md:hidden">
      <div className="flex h-14 items-center gap-2 px-3 sm:px-4">
        <button
          type="button"
          onClick={onOpenMenu}
          aria-label="Buka menu navigasi"
          aria-expanded={menuOpen ? 'true' : 'false'}
          aria-controls="mobile-drawer"
          className="grid size-10 shrink-0 place-items-center rounded-xl border border-line-200 text-navy-700 transition-colors hover:bg-surface-50 active:bg-surface-100"
        >
          <Menu className="size-5" aria-hidden="true" />
        </button>

        <a href="./" className="-ml-1 flex min-h-11 min-w-0 items-center gap-2 rounded-lg px-1">
          <img src={logo} alt="" width={26} height={24} className="size-[26px] shrink-0 object-contain" />
          <span className="truncate text-[0.95rem] font-extrabold tracking-tight text-navy-900">
            Pahami Sehat
          </span>
        </a>

        <div className="relative ml-auto flex items-center gap-1.5" ref={kotakRef}>
          <button
            type="button"
            onClick={bukaTutup}
            aria-label={
              belumDibaca
                ? `Pemberitahuan, ${jumlah} butir, ada yang belum dibaca`
                : `Pemberitahuan, ${jumlah} butir`
            }
            aria-expanded={buka ? 'true' : 'false'}
            aria-controls="panel-notifikasi"
            className={cn(
              'relative grid size-10 place-items-center rounded-xl text-navy-500 transition-colors',
              'hover:bg-surface-100 hover:text-navy-800',
              buka && 'bg-surface-100 text-navy-800',
            )}
          >
            <Bell className="size-5" aria-hidden="true" />
            {belumDibaca ? (
              <span className="absolute top-2 right-2.5 size-2 rounded-full bg-rose-500 ring-2 ring-white" />
            ) : null}
          </button>

          {buka ? (
            <div
              id="panel-notifikasi"
              role="dialog"
              aria-label="Pemberitahuan"
              className="rise absolute top-12 right-0 z-50 w-[min(20rem,calc(100vw-1.5rem))] overflow-hidden rounded-2xl border border-line-200 bg-white shadow-[0_12px_40px_-12px_rgba(15,30,51,0.28)]"
            >
              <div className="flex items-center justify-between border-b border-line-100 px-3.5 py-2.5">
                <p className="text-[0.82rem] font-bold text-navy-900">
                  Pemberitahuan
                  {jumlah ? <span className="ml-1 font-normal text-muted-500">({jumlah})</span> : null}
                </p>
                <button
                  type="button"
                  onClick={() => setBuka(false)}
                  aria-label="Tutup pemberitahuan"
                  className="grid size-7 place-items-center rounded-lg text-navy-500 transition-colors hover:bg-surface-100 hover:text-navy-800"
                >
                  <X className="size-4" aria-hidden="true" />
                </button>
              </div>

              {jumlah === 0 ? (
                <p className="px-3.5 py-5 text-center text-[0.82rem] text-muted-500">
                  Belum ada pemberitahuan.
                </p>
              ) : (
                <ul className="max-h-[60vh] divide-y divide-line-100 overflow-y-auto">
                  {notifikasi.map((n) => {
                    const Ikon = IKON[n.jenis] ?? Info
                    return (
                      <li key={n.id}>
                        <button
                          type="button"
                          onClick={() => pilih(n)}
                          className="flex w-full items-start gap-2.5 px-3.5 py-3 text-left transition-colors hover:bg-surface-50"
                        >
                          <span
                            className={cn(
                              'mt-0.5 grid size-7 shrink-0 place-items-center rounded-lg',
                              n.jenis === 'server'
                                ? 'bg-amber-50 text-amber-700'
                                : 'bg-brand-50 text-brand-700',
                            )}
                          >
                            <Ikon className="size-3.5" aria-hidden="true" />
                          </span>
                          <span className="min-w-0 flex-1">
                            <span className="block text-[0.84rem] font-semibold text-navy-900">
                              {n.judul}
                            </span>
                            <span className="mt-0.5 block text-[0.78rem] leading-snug text-navy-500">
                              {n.isi}
                            </span>
                            {n.waktu ? (
                              <span className="mt-1 block text-[0.7rem] text-muted-500">{n.waktu}</span>
                            ) : null}
                          </span>
                        </button>
                      </li>
                    )
                  })}
                </ul>
              )}
            </div>
          ) : null}
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
      className="grid size-9 shrink-0 place-items-center rounded-lg text-navy-500 transition-colors hover:bg-surface-100 hover:text-navy-800 lg:hidden"
    >
      <X className="size-5" aria-hidden="true" />
    </button>
  )
}
