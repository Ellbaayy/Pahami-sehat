import { cn } from '../../lib/cn'
import { SectionHeading } from '../ui/primitives'

/**
 * Topik populer.
 * - desktop : chip tersusun horizontal
 * - tablet  : chip wrap ke baris berikutnya
 * - mobile  : rail chip bisa digeser horizontal (tanpa overflow halaman)
 *
 * Isinya berasal dari konten harian (server/konten.js). Dua tanggalnya
 * dibedakan dengan sengaja:
 *   - "Diperbarui"    -> kapan isinya benar-benar berubah
 *   - "Terakhir dicek"-> kapan sistem mengecek sumbernya (bisa tiap hari,
 *                        walau isinya belum tentu berubah)
 * Jadi kalau belum ada artikel baru, halaman tidak berpura-pura memperbarui
 * apa pun — yang tampil apa adanya adalah tanggal pengecekannya.
 *
 * Label topiknya sendiri (mis. "Cegah Stunting") TIDAK diterjemahkan — itu
 * judul artikel dari sumber Kemenkes, bukan teks antarmuka.
 */
export default function TopicChips({
  topics,
  selected,
  onSelect,
  diperbarui,
  diperiksa,
  t = (k) => k,
}) {
  // Tanggal mengikuti bahasa antarmuka, supaya "12 Oktober 2026" tidak muncul
  // di tengah halaman berbahasa Inggris.
  const lokal = t('umum.kodeLokal') === 'en-US' ? 'en-US' : 'id-ID'
  const tgl = (iso) =>
    iso
      ? new Date(iso).toLocaleDateString(lokal, {
          day: 'numeric',
          month: 'long',
          year: 'numeric',
        })
      : null

  const tglDiperbarui = tgl(diperbarui)
  const tglDiperiksa = tgl(diperiksa)
  const belumBerubah = tglDiperbarui && tglDiperiksa && tglDiperbarui === tglDiperiksa

  return (
    <section aria-labelledby="topik-title">
      <SectionHeading
        id="topik-title"
        title={t('topik.judul')}
        description={t('topik.sub')}
        action={
          tglDiperiksa ? (
            <p className="text-[0.74rem] font-medium text-muted-600">
              {belumBerubah
                ? t('topik.diperbaruiPada', { tanggal: tglDiperbarui })
                : t('topik.dicekDiperbarui', { dicek: tglDiperiksa, diperbarui: tglDiperbarui })}
            </p>
          ) : null
        }
      />

      <div
        role="group"
        aria-label={t('topik.aria')}
        className="no-scrollbar flex snap-x gap-2.5 overflow-x-auto pb-1 md:flex-wrap md:overflow-x-visible"
      >
        {topics.map((topik) => {
          const isActive = selected === topik.id
          return (
            <button
              key={topik.id}
              type="button"
              onClick={() => onSelect(isActive ? null : topik.id)}
              aria-pressed={isActive}
              className={cn(
                'h-11 shrink-0 snap-start rounded-full px-4 text-[0.88rem] font-semibold',
                'transition-all duration-200 ease-out',
                'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-500',
                isActive
                  ? 'bg-brand-600 text-white shadow-[0_6px_16px_-8px_rgba(13,132,120,0.8)]'
                  : 'border border-line-200 bg-white text-navy-700 hover:-translate-y-0.5 hover:border-brand-300 hover:bg-brand-50 active:translate-y-0',
              )}
            >
              {topik.label}
            </button>
          )
        })}
      </div>
    </section>
  )
}
