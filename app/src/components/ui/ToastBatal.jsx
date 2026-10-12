import { useCallback, useEffect, useRef, useState } from 'react'
import { Undo2, Check } from 'lucide-react'
import { cn } from '../../lib/cn'

/**
 * Notifikasi pembatalan (undo) untuk aksi yang menghapus data.
 *
 * Kenapa pembatalan, bukan dialog "Yakin mau hapus?":
 * - Dialog konfirmasi melatih orang menekan "Ya" tanpa membaca. Setelah
 *   beberapa kali, dialog itu tidak lagi melindungi apa pun.
 * - Pembatalan mengembalikan data yang benar-benar sudah dihapus, jadi
 *   salah tekan tidak berakibat apa-apa. Datanya masih ada saat dibutuhkan.
 * Ini pola yang sama dipakai Gmail dan GitHub.
 *
 * Waktu hitungnya TERLIHAT (garis menyusut), bukan diam-diam habis — supaya
 * orang tahu ada batas waktu dan tidak kaget saat tombolnya hilang.
 *
 * Hitungannya BERHENTI saat kursor diarahkan ke notifikasi atau fokus keyboard
 * masuk ke dalamnya. Orang yang perlu waktu membaca jadi tidak kehilangan
 * kesempatan membatalkan hanya karena lambat.
 *
 * Catatan aksesibilitas: `role="status"` + `aria-live="polite"` membuat
 * pembaca layar mengumumkan penghapusan tanpa memotong kalimat yang sedang
 * dibaca. Tombol "Batalkan" bisa dijangkau keyboard, dan Escape juga
 * membatalkan — sama seperti menekan tombolnya.
 */
const DURASI_MS = 6000
const TICK_MS = 100

export default function ToastBatal({ pesan, labelBatal, onBatal, onTutup, t = (k) => k }) {
  const [sisa, setSisa] = useState(DURASI_MS)
  const [berhenti, setBerhenti] = useState(false)
  const [dibatalkan, setDibatalkan] = useState(false)
  const tombolRef = useRef(null)

  /**
   * Fokus otomatis TIDAK boleh menjeda hitungan.
   *
   * Ini pernah jadi bug nyata: tombol "Batalkan" difokuskan otomatis supaya
   * keyboard bisa langsung memakainya, tapi fokus itu memicu onFocus ->
   * hitungan dijeda — dan karena fokusnya tidak pernah pindah, jedanya tidak
   * pernah selesai. Akibatnya notifikasi tidak pernah menutup sendiri.
   *
   * Jadi fokus pertama (yang program) ditandai, dan jeda hanya berlaku untuk
   * fokus/hover yang benar-benar datang dari pengguna.
   */
  const fokusProgram = useRef(true)

  // hitung mundur; berhenti saat kursor/fokus pengguna ada di dalam notifikasi
  useEffect(() => {
    if (berhenti || dibatalkan) return undefined
    const id = window.setInterval(() => {
      setSisa((s) => {
        const baru = s - TICK_MS
        if (baru <= 0) {
          window.clearInterval(id)
          return 0
        }
        return baru
      })
    }, TICK_MS)
    return () => window.clearInterval(id)
  }, [berhenti, dibatalkan])

  // waktu habis -> tutup (data tetap terhapus, memang itu maksudnya)
  useEffect(() => {
    if (sisa <= 0 && !dibatalkan) onTutup()
  }, [sisa, dibatalkan, onTutup])

  // fokuskan tombol Batalkan supaya keyboard langsung bisa membatalkan.
  // Hanya sekali, dan tidak merebut fokus kalau pengguna sedang mengetik di
  // tempat lain (itu sebabnya activeElement diperiksa lebih dulu).
  useEffect(() => {
    const ae = document.activeElement
    const sedangMengetik =
      ae && (ae.tagName === 'INPUT' || ae.tagName === 'TEXTAREA' || ae.isContentEditable)
    if (!sedangMengetik) tombolRef.current?.focus({ preventScroll: true })
    // fokus program selesai sesudahnya — fokus/hover yang datang setelah ini
    // dianggap niat pengguna dan boleh menjeda hitungan
    const id = window.setTimeout(() => {
      fokusProgram.current = false
    }, 250)
    return () => window.clearTimeout(id)
  }, [])

  const batalkan = useCallback(() => {
    if (dibatalkan) return
    setDibatalkan(true)
    onBatal()
  }, [dibatalkan, onBatal])

  // Escape juga membatalkan — sama seperti menekan tombolnya
  useEffect(() => {
    const onKey = (e) => {
      if (e.key === 'Escape' && !dibatalkan) {
        e.preventDefault()
        batalkan()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [batalkan, dibatalkan])

  // setelah dibatalkan, tampilkan tanda "dikembalikan" sebentar lalu tutup
  useEffect(() => {
    if (!dibatalkan) return undefined
    const id = window.setTimeout(onTutup, 1400)
    return () => window.clearTimeout(id)
  }, [dibatalkan, onTutup])

  const persen = dibatalkan ? 100 : (sisa / DURASI_MS) * 100

  // hover/fokus pengguna menjeda hitungan; fokus program tidak
  const jedaPengguna = () => {
    if (!fokusProgram.current) setBerhenti(true)
  }
  const lanjutkan = () => setBerhenti(false)

  return (
    <div
      className="pointer-events-none fixed inset-x-0 bottom-0 z-[80] flex justify-center px-4 pb-[max(1rem,env(safe-area-inset-bottom))]"
      onMouseEnter={jedaPengguna}
      onMouseLeave={lanjutkan}
      onFocus={jedaPengguna}
      onBlur={lanjutkan}
    >
      <div
        role="status"
        aria-live="polite"
        className={cn(
          'pointer-events-auto w-full max-w-[26rem] overflow-hidden rounded-2xl',
          'border border-navy-800 bg-navy-900 text-white',
          'shadow-[0_16px_44px_-14px_rgba(9,20,36,0.65)]',
        )}
      >
        <div className="flex items-center gap-3 px-4 py-3">
          {dibatalkan ? (
            <Check className="size-4 shrink-0 text-emerald-400" aria-hidden="true" />
          ) : (
            <Undo2 className="size-4 shrink-0 text-white/70" aria-hidden="true" />
          )}
          <p className="min-w-0 flex-1 text-[0.86rem] leading-snug font-medium">
            {dibatalkan ? t('riw.dikembalikan') : pesan}
          </p>
          {!dibatalkan ? (
            <button
              ref={tombolRef}
              type="button"
              onClick={batalkan}
              className={cn(
                'shrink-0 rounded-lg bg-white px-3 py-1.5 text-[0.8rem] font-bold text-navy-900',
                'transition-colors hover:bg-brand-50',
                'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white',
              )}
            >
              {labelBatal ?? t('riw.batalkan')}
            </button>
          ) : null}
        </div>

        {/* garis waktu — menunjukkan sisa waktu, bukan hiasan */}
        <div className="h-[3px] w-full bg-white/15" aria-hidden="true">
          <span
            className={cn(
              'block h-full',
              dibatalkan ? 'bg-emerald-400' : 'bg-brand-400',
              !berhenti && !dibatalkan && 'transition-[width] duration-100 ease-linear',
            )}
            style={{ width: `${persen}%` }}
          />
        </div>
      </div>
    </div>
  )
}
