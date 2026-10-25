import { cn } from '../../lib/cn'
import { SectionHeading } from '../ui/primitives'

/**
 * Topik populer.
 * - desktop : chip tersusun horizontal
 * - tablet  : chip wrap ke baris berikutnya
 * - mobile  : rail chip bisa digeser horizontal (tanpa overflow halaman)
 *
 * Isinya berasal dari konten harian (server/konten.js). Tiga tanggalnya
 * dibedakan dengan sengaja — jangan disatukan lagi:
 *   - "ditarik"  -> kapan DAFTAR artikel dari sumber berubah. Ini BUKAN tanggal
 *                   terbit artikel mana pun. Dulu kalimatnya berbunyi
 *                   "Diperbarui 12 Oktober 2026" dan pembaca wajar menyimpulkan
 *                   isinya baru — padahal artikel termuda saat itu terbit
 *                   05 May 2026. Kalimatnya sudah diganti (25 Okt 2026).
 *   - "dicek"    -> kapan sistem mengecek sumbernya (bisa tiap hari walau isinya
 *                   belum berubah)
 *   - "terbit"   -> tanggal terbit artikel TERBARU yang sedang tampil. Ini
 *                   satu-satunya angka yang menjawab "isinya setua apa".
 * Jadi kalau belum ada artikel baru, halaman tidak berpura-pura memperbarui
 * apa pun.
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
  tanggalArtikelTerbaru = null,
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

  const tglDitarik = tgl(diperbarui)
  const tglDiperiksa = tgl(diperiksa)
  const tglTerbit = tgl(tanggalArtikelTerbaru)

  // Kalimat tanggal: yang disebut lebih dulu adalah yang PALING berguna bagi
  // pembaca — tanggal terbit artikel terbaru. Tanggal penarikan/pengecekan
  // hanya pelengkap, supaya tidak terbaca sebagai "isinya baru".
  //
  // Kalau tidak satu pun artikel punya tanggal (sumber tidak mencantumkannya),
  // itu DINYATAKAN — jangan diamkan, karena diam membuat pembaca mengira
  // artikelnya baru.
  const keterangan = tglTerbit
    ? t('topik.terbaruTerbit', { tanggal: tglTerbit })
    : tglDiperiksa
      ? t('topik.dicek', { tanggal: tglDiperiksa })
      : null

  // Baris kedua: penarikan + pengecekan, atau pernyataan bahwa sumber tidak
  // mencantumkan tanggal sama sekali.
  const pelengkap = tglDitarik
    ? tglDiperiksa
      ? t('topik.dicekDitarik', { dicek: tglDiperiksa, ditarik: tglDitarik })
      : t('topik.ditarik', { tanggal: tglDitarik })
    : !tglTerbit && tglDiperiksa
      ? t('topik.tanpaTanggal')
      : null

  return (
    <section aria-labelledby="topik-title">
      <SectionHeading
        id="topik-title"
        title={t('topik.judul')}
        description={t('topik.sub')}
        action={
          keterangan || pelengkap ? (
            <p className="text-[0.8125rem] font-medium text-muted-600">
              {keterangan}
              {keterangan && pelengkap ? (
                <span className="text-muted-500">
                  {' · '}
                  {pelengkap}
                </span>
              ) : (
                pelengkap
              )}
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
