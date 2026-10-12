import { History, ArrowRight, MessageSquareText, Trash2 } from 'lucide-react'
import { Card, SectionHeading, Button, EmptyState } from '../ui/primitives'
import { cn } from '../../lib/cn'

/**
 * Riwayat pertanyaan — daftar yang tampil di Beranda (ringkas) dan di panel
 * Riwayat (lengkap).
 *
 * Teksnya diambil dari kamus lewat `t()` supaya ikut bahasa antarmuka.
 *
 * Tombol hapus per entri hanya muncul kalau `onHapus` diberikan, dan itu
 * keputusan pemanggil: daftar kosong memang tidak punya apa pun untuk dihapus,
 * jadi tombolnya tidak masuk akal.
 *
 * Tombolnya selalu terlihat di layar sentuh (tidak hover-only) karena hover
 * tidak ada di ponsel; di perangkat berkursor, warnanya baru menegas saat
 * barisnya disentuh. Ini yang membuat "hapus" tetap bisa dijangkau tanpa mouse.
 *
 * `onKeTanya` membuat tiap entri bisa dibuka lagi: teks pertanyaannya
 * ditaruh di kotak isian Tanya AI, TIDAK langsung dikirim — pengguna masih
 * bisa mengubahnya dulu. Tanpa prop itu, entri hanya bisa dibaca.
 */
export default function RecentHistory({
  items,
  onSeeAll,
  onHapus,
  onKeTanya,
  max = 4,
  t = (k) => k,
}) {
  const shown = items.slice(0, max)

  return (
    <section aria-labelledby="riwayat-title">
      <SectionHeading
        id="riwayat-title"
        title={t('riw.terakhir')}
        description={t('riw.terakhirSub')}
        action={
          onSeeAll ? (
            <Button variant="ghost" size="sm" onClick={onSeeAll} className="shrink-0">
              {t('riw.lihatSemua')}
              <ArrowRight className="size-4" aria-hidden="true" />
            </Button>
          ) : null
        }
      />

      {shown.length === 0 ? (
        <EmptyState
          icon={History}
          title={t('riw.kosongJudul')}
          description={t('riw.kosongSub')}
        />
      ) : (
        <Card className="divide-y divide-line-100 overflow-hidden">
          {shown.map((h) => (
            <article
              key={h.id}
              className={cn(
                'group flex items-start gap-3 px-[clamp(0.9rem,0.8rem+0.4vw,1.25rem)] py-3.5',
                'transition-colors hover:bg-surface-50',
              )}
            >
              <span className="mt-0.5 grid size-8 shrink-0 place-items-center rounded-lg bg-brand-50 text-brand-600">
                <MessageSquareText className="size-4" aria-hidden="true" />
              </span>
              <div className="min-w-0 flex-1">
                {onKeTanya ? (
                  <button
                    type="button"
                    onClick={() => onKeTanya(h.question)}
                    title={t('riw.bukaDiTanya')}
                    className="block text-left text-[0.92rem] leading-snug font-semibold text-navy-900 underline decoration-dotted underline-offset-2 transition-colors hover:text-brand-700 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-500"
                  >
                    {h.question}
                  </button>
                ) : (
                  <p className="text-[0.92rem] leading-snug font-semibold text-navy-900">
                    {h.question}
                  </p>
                )}
                <p className="mt-0.5 text-[0.82rem] leading-snug text-navy-500">{h.answer}</p>
                <div className="mt-1.5 flex flex-wrap items-center gap-2">
                  <span className="text-[0.72rem] font-medium text-muted-500">{h.time}</span>
                  {h.sources?.map((s) => (
                    <span
                      key={s}
                      className="rounded-full bg-surface-100 px-2 py-0.5 text-[0.68rem] font-semibold text-navy-500"
                    >
                      {s}
                    </span>
                  ))}
                </div>
              </div>

              {onHapus ? (
                <button
                  type="button"
                  onClick={() => onHapus(h.id)}
                  // Nama pertanyaannya ikut disebut supaya pembaca layar tahu
                  // entri mana yang akan dihapus — "Hapus" saja tidak jelas.
                  aria-label={t('riw.hapusSatu', { tanya: h.question })}
                  title={t('riw.hapus')}
                  className={cn(
                    // 44px: ukuran target sentuh minimum supaya tidak salah tekan
                    // di ponsel — ini tombol yang menghapus data.
                    'grid size-11 shrink-0 place-items-center rounded-lg text-muted-500',
                    'transition-colors',
                    'hover:bg-rose-50 hover:text-rose-600',
                    'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-rose-500',
                    // di perangkat berkursor warnanya menegas saat baris disentuh;
                    // di layar sentuh selalu terlihat supaya bisa ditekan
                    'md:opacity-0 md:group-hover:opacity-100 md:group-focus-within:opacity-100',
                  )}
                >
                  <Trash2 className="size-4" aria-hidden="true" />
                </button>
              ) : null}
            </article>
          ))}
        </Card>
      )}
    </section>
  )
}
