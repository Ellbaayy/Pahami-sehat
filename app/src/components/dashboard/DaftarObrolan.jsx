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
import { Card, EmptyState, SectionHeading, Button } from '../ui/primitives'
import { cn } from '../../lib/cn'
import { waktuRelatif, ringkasSesi, jumlahTanya } from '../../lib/sesi'

/**
 * Daftar obrolan tersimpan — menggantikan daftar riwayat per-pertanyaan.
 *
 * Yang ditampilkan adalah SESI (satu percakapan utuh), bukan satu pertanyaan.
 * Menekan judulnya membuka sesi itu di halaman Tanya AI, lengkap dengan seluruh
 * utasannya, dan bisa dilanjutkan bertanya.
 *
 * Dua bentuk:
 *   - penuh  (halaman Riwayat): ada kotak centang, bagikan, dan hapus per baris
 *   - ringkas (Beranda): hanya judul + waktu + jumlah pertanyaan, maks `maks`
 *     baris, dengan tautan "Lihat semua". Kotak centang dan tombol per baris
 *     disembunyikan supaya Beranda tetap ringan — bukan tempat mengelola data.
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
  onSeeAll,
  ringkas = false,
  maks = 4,
  t = (k) => k,
  kodeLokal = 'id-ID',
}) {
  const [pilih, setPilih] = useState([])

  const tampil = ringkas ? sesi.slice(0, maks) : sesi
  const ada = pilih.length > 0
  const semuaDipilih = sesi.length > 0 && pilih.length === sesi.length
  /**
   * Id judul bagian ini — dipakai `aria-labelledby` pada <section>.
   *
   * Dulu `aria-labelledby="obrolan-title"` ditulis tetap, tapi di bentuk PENUH
   * (halaman Riwayat) judulnya tidak dirender sama sekali — jadi id itu tidak
   * ada dan bagian ini kehilangan namanya. Sekarang id-nya hanya dipasang kalau
   * judulnya memang ada, dan di bentuk penuh diganti label yang benar-benar
   * tersedia.
   */
  const idJudul = ringkas ? 'obrolan-title' : undefined

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

  const kepala = ringkas ? (
    <SectionHeading
      id="obrolan-title"
      title={t('sesi.terakhir')}
      description={t('sesi.terakhirSub')}
      action={
        onSeeAll && sesi.length ? (
          <Button variant="ghost" size="sm" onClick={onSeeAll} className="shrink-0">
            {t('sesi.lihatSemua')}
            <ArrowRight className="size-4" aria-hidden="true" />
          </Button>
        ) : null
      }
    />
  ) : null

  if (!sesi.length) {
    return (
      <section aria-labelledby={idJudul} aria-label={idJudul ? undefined : t('sesi.judul')}>
        {kepala}
        <EmptyState
          icon={MessageSquareText}
          title={t('sesi.kosongJudul')}
          description={t('sesi.kosongSub')}
          action={
            ringkas && onSeeAll ? null : undefined
          }
        />
      </section>
    )
  }

  return (
    <section
      aria-labelledby={idJudul}
      aria-label={idJudul ? undefined : t('sesi.judul')}
      className="space-y-3"
    >
      {kepala}

      {/* bilah tindakan — hanya di bentuk penuh, dan hanya kalau ada yang dipilih */}
      {!ringkas && ada ? (
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
        {tampil.map((s) => {
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
              {!ringkas ? (
                <button
                  type="button"
                  onClick={() => toggle(s.id)}
                  aria-pressed={dipilih}
                  aria-label={t('sesi.pilihSatu', { judul: s.judul })}
                  className="mt-0.5 grid size-11 shrink-0 place-items-center rounded-lg text-navy-500 transition-colors hover:bg-surface-100 hover:text-navy-800 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-500"
                >
                  {dipilih ? (
                    <CheckSquare className="size-[18px] text-brand-600" aria-hidden="true" />
                  ) : (
                    <Square className="size-[18px]" aria-hidden="true" />
                  )}
                </button>
              ) : null}

              <span className="mt-0.5 grid size-8 shrink-0 place-items-center rounded-lg bg-brand-50 text-brand-600">
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
                  <span className="text-[0.72rem] font-medium text-muted-500">
                    {waktuRelatif(s.diperbarui, t, kodeLokal)}
                  </span>
                  <span className="rounded-full bg-surface-100 px-2 py-0.5 text-[0.68rem] font-semibold text-navy-500">
                    {t('sesi.jumlahTanya', { n })}
                  </span>
                  {aktif && !ringkas ? (
                    <span className="inline-flex items-center gap-1 rounded-full bg-brand-50 px-2 py-0.5 text-[0.68rem] font-bold text-brand-700 ring-1 ring-brand-100">
                      <ArrowRight className="size-3" aria-hidden="true" />
                      {t('sesi.sedangDibuka')}
                    </span>
                  ) : null}
                </div>
              </div>

              {!ringkas ? (
                <>
                  <button
                    type="button"
                    onClick={() => onBagikan?.([s])}
                    aria-label={t('sesi.bagikanSatu', { judul: s.judul })}
                    title={t('sesi.bagikan')}
                    className={cn(
                      'grid size-11 shrink-0 place-items-center rounded-lg text-muted-500 transition-colors',
                      'hover:bg-brand-50 hover:text-brand-600',
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
                </>
              ) : null}
            </article>
          )
        })}
      </Card>
    </section>
  )
}
