import { useState } from 'react'
import {
  MessageSquareText,
  Trash2,
  Share2,
  Square,
  CheckSquare,
  X,
  ArrowRight,
} from 'lucide-react'
import { Card, EmptyState } from '../ui/primitives'
import { cn } from '../../lib/cn'
import { waktuRelatif, ringkasSesi, jumlahTanya } from '../../lib/sesi'

/**
 * Daftar obrolan tersimpan — menggantikan daftar riwayat per-pertanyaan.
 *
 * Yang ditampilkan adalah SESI (satu percakapan utuh), bukan satu pertanyaan.
 * Menekan judulnya membuka sesi itu di halaman Tanya AI, lengkap dengan seluruh
 * utasannya, dan bisa dilanjutkan bertanya.
 *
 * Bentuk `ringkas` (daftar 4 obrolan terakhir di Beranda) SUDAH DIHAPUS
 * (keputusan jagi, 18 Okt 2026) — Beranda tidak lagi menampilkan obrolan
 * terakhir. Komponen ini kini hanya dipakai di halaman Riwayat, jadi kotak
 * centang, bagikan, dan hapus per baris selalu tampil.
 *
 * Kotak centangnya selalu terlihat, bukan hanya saat kursor melayang, supaya
 * bisa dipakai di layar sentuh.
 *
 * Yang dinilai "kosong" adalah daftar sungguhan: tidak ada lagi contoh
 * karangan yang mengisinya.
 */
export default function DaftarObrolan({
  sesi = [],
  aktifId = null,
  onBuka,
  onHapus,
  onBagikan,
  t = (k) => k,
  kodeLokal = 'id-ID',
}) {
  const [pilih, setPilih] = useState([])

  const ada = pilih.length > 0
  const semuaDipilih = sesi.length > 0 && pilih.length === sesi.length

  const toggle = (id) =>
    setPilih((p) => (p.includes(id) ? p.filter((x) => x !== id) : [...p, id]))

  const jalankanHapus = () => {
    if (!pilih.length) return
    onHapus?.(pilih)
    setPilih([])
  }

  const jalankanBagikan = () => {
    if (!pilih.length) return
    onBagikan?.(sesi.filter((s) => pilih.includes(s.id)))
    setPilih([])
  }

  if (!sesi.length) {
    return (
      <section aria-label={t('sesi.judul')}>
        <EmptyState
          icon={MessageSquareText}
          title={t('sesi.kosongJudul')}
          description={t('sesi.kosongSub')}
        />
      </section>
    )
  }

  return (
    <section aria-label={t('sesi.judul')} className="space-y-3">
      {/* bilah tindakan — hanya kalau ada yang dipilih */}
      {ada ? (
        <div className="flex flex-wrap items-center gap-2 rounded-xl border border-brand-200 bg-brand-50 px-3.5 py-2.5">
          <p className="text-[0.85rem] font-semibold text-brand-800">
            {t('sesi.dipilih', { n: pilih.length })}
          </p>
          <div className="ml-auto flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => setPilih(semuaDipilih ? [] : sesi.map((s) => s.id))}
              className="inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-[0.8rem] font-semibold text-brand-700 transition-colors hover:bg-brand-100 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-500"
            >
              {semuaDipilih ? (
                <X className="size-3.5" aria-hidden="true" />
              ) : (
                <CheckSquare className="size-3.5" aria-hidden="true" />
              )}
              {semuaDipilih ? t('sesi.batalPilihSemua') : t('sesi.pilihSemua')}
            </button>
            <button
              type="button"
              onClick={jalankanBagikan}
              className="inline-flex items-center gap-1.5 rounded-lg bg-white px-3 py-1.5 text-[0.8rem] font-semibold text-brand-700 ring-1 ring-brand-200 transition-colors hover:bg-brand-100 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-500"
            >
              <Share2 className="size-3.5" aria-hidden="true" />
              {t('sesi.bagikan')}
            </button>
            <button
              type="button"
              onClick={jalankanHapus}
              className="inline-flex items-center gap-1.5 rounded-lg bg-white px-3 py-1.5 text-[0.8rem] font-semibold text-rose-700 ring-1 ring-rose-200 transition-colors hover:bg-rose-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-rose-500"
            >
              <Trash2 className="size-3.5" aria-hidden="true" />
              {t('sesi.hapus')}
            </button>
            <button
              type="button"
              onClick={() => setPilih([])}
              className="inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-[0.8rem] font-semibold text-navy-500 transition-colors hover:bg-white focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-500"
            >
              {t('sesi.batalPilih')}
            </button>
          </div>
        </div>
      ) : null}

      <Card className="divide-y divide-line-100 overflow-hidden">
        {sesi.map((s) => {
          const dipilih = pilih.includes(s.id)
          const aktif = s.id === aktifId
          const n = jumlahTanya(s)
          return (
            <article
              key={s.id}
              className={cn(
                'group flex items-start gap-3 px-[clamp(0.9rem,0.8rem+0.4vw,1.25rem)] py-3.5 transition-colors',
                dipilih ? 'bg-brand-50/70' : 'hover:bg-surface-50',
              )}
            >
              <button
                type="button"
                onClick={() => toggle(s.id)}
                aria-pressed={dipilih}
                aria-label={t('sesi.pilihSatu', { judul: s.judul })}
                className="mt-0.5 grid size-11 shrink-0 place-items-center rounded-lg text-navy-500 transition-colors hover:bg-surface-100 hover:text-navy-800 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-500"
              >
                {dipilih ? (
                  <CheckSquare className="size-[18px] text-brand-700" aria-hidden="true" />
                ) : (
                  <Square className="size-[18px]" aria-hidden="true" />
                )}
              </button>

              <span className="mt-0.5 grid size-8 shrink-0 place-items-center rounded-lg bg-brand-50 text-brand-700">
                <MessageSquareText className="size-4" aria-hidden="true" />
              </span>

              <div className="min-w-0 flex-1">
                <button
                  type="button"
                  onClick={() => onBuka?.(s.id)}
                  title={t('sesi.bukaJudul')}
                  className="block text-left text-[0.92rem] leading-snug font-semibold text-navy-900 underline decoration-dotted underline-offset-2 transition-colors hover:text-brand-700 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-500"
                >
                  {s.judul}
                </button>
                {ringkasSesi(s) ? (
                  <p className="mt-0.5 line-clamp-2 text-[0.82rem] leading-snug text-navy-500">
                    {ringkasSesi(s)}
                  </p>
                ) : null}
                <div className="mt-1.5 flex flex-wrap items-center gap-2">
                  <span className="text-[0.8125rem] font-medium text-muted-500">
                    {waktuRelatif(s.diperbarui, t, kodeLokal)}
                  </span>
                  <span className="rounded-full bg-surface-100 px-2 py-0.5 text-[0.8125rem] font-semibold text-navy-500">
                    {t('sesi.jumlahTanya', { n })}
                  </span>
                  {aktif ? (
                    <span className="inline-flex items-center gap-1 rounded-full bg-brand-50 px-2 py-0.5 text-[0.8125rem] font-bold text-brand-700 ring-1 ring-brand-100">
                      <ArrowRight className="size-3" aria-hidden="true" />
                      {t('sesi.sedangDibuka')}
                    </span>
                  ) : null}
                </div>
              </div>

              <button
                type="button"
                onClick={() => onBagikan?.([s])}
                aria-label={t('sesi.bagikanSatu', { judul: s.judul })}
                title={t('sesi.bagikan')}
                className={cn(
                  'grid size-11 shrink-0 place-items-center rounded-lg text-muted-500 transition-colors',
                  'hover:bg-brand-50 hover:text-brand-700',
                  'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-500',
                  'md:opacity-0 md:group-hover:opacity-100 md:group-focus-within:opacity-100',
                )}
              >
                <Share2 className="size-4" aria-hidden="true" />
              </button>
              <button
                type="button"
                onClick={() => onHapus?.([s.id])}
                aria-label={t('sesi.hapusSatu', { judul: s.judul })}
                title={t('riw.hapus')}
                className={cn(
                  'grid size-11 shrink-0 place-items-center rounded-lg text-muted-500 transition-colors',
                  'hover:bg-rose-50 hover:text-rose-600',
                  'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-rose-500',
                  'md:opacity-0 md:group-hover:opacity-100 md:group-focus-within:opacity-100',
                )}
              >
                <Trash2 className="size-4" aria-hidden="true" />
              </button>
            </article>
          )
        })}
      </Card>
    </section>
  )
}
