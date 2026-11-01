import { BookOpen, ExternalLink, Loader2, TriangleAlert } from 'lucide-react'
import { Card, SectionHeading } from '../ui/primitives'
import { usePustaka, tanggalPanjang } from '../../lib/usePustaka'

/**
 * Halaman "Jurnal" — publikasi ilmiah terbaru dari enam jurnal dan basis
 * publikasi: PubMed, The Lancet, Nature Medicine, The BMJ, JAMA Network, dan
 * Cochrane Library.
 *
 * ATURAN KEJUJURAN: judul ditampilkan APA ADANYA dalam bahasa aslinya. Tidak
 * diterjemahkan, karena menerjemahkan judul karya ilmiah lalu menampilkannya
 * seolah-olah judul aslinya adalah kesalahan yang serius di konteks akademik.
 * Setiap butir selalu menautkan ke dokumen resminya (DOI/PubMed).
 */
export default function JurnalPanel({ t }) {
  const { data, memuat, galat } = usePustaka()
  const jurnal = Array.isArray(data?.jurnal) ? data.jurnal : []
  const diperiksa = tanggalPanjang(data?.diperiksa, t)

  return (
    <section aria-labelledby="jurnal-judul" className="space-y-4">
      <SectionHeading
        as="h1"
        id="jurnal-judul"
        eyebrow={t('jur.eyebrow')}
        title={t('jur.judul')}
        description={t('jur.deskripsi')}
        action={
          diperiksa ? (
            <p className="text-[0.8rem] font-medium text-muted-500">
              {t('jur.diperiksa')}: {diperiksa}
            </p>
          ) : null
        }
      />

      {memuat ? (
        <div className="flex items-center gap-2 rounded-2xl border border-line-200 bg-white px-4 py-6 text-navy-700">
          <Loader2 className="size-4 animate-spin" aria-hidden="true" />
          <p className="text-[0.9rem]">{t('jur.memuat')}</p>
        </div>
      ) : null}

      {galat && !jurnal.length ? (
        <div className="flex items-start gap-2 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-4 text-[0.88rem] text-navy-800">
          <TriangleAlert className="mt-0.5 size-4 shrink-0 text-amber-600" aria-hidden="true" />
          <p>{t('jur.galat')}</p>
        </div>
      ) : null}

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {jurnal.map((j) => (
          <Card key={j.id} className="flex flex-col p-3 [@media(min-height:1200px)]:p-4">
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <h2 className="flex items-center gap-1.5 text-[0.95rem] font-bold text-navy-900">
                  <BookOpen className="size-4 shrink-0 text-brand-700" aria-hidden="true" />
                  {j.nama}
                </h2>
                <p className="text-[0.76rem] leading-snug text-muted-500">{j.penerbit}</p>
              </div>
              {j.item.length ? (
                <span className="shrink-0 rounded-full border border-line-200 bg-surface-100 px-2 py-0.5 text-[0.72rem] font-semibold text-navy-700">
                  {t('jur.butir', { n: j.item.length })}
                </span>
              ) : null}
            </div>

            {j.item.length ? (
              <ul className="mt-2.5 flex-1 space-y-2 border-t border-line-200 pt-2.5">
                {/* Semua tulisan ditampilkan (server membatasi 12 per jurnal).
                    Memotongnya di sini membuat halaman hanya jadi contoh,
                    padahal tujuannya jadi bahan bacaan. */}
                {j.item.map((a) => (
                  <li key={a.tautan || a.judul}>
                    <a
                      href={a.tautan}
                      target="_blank"
                      rel="noreferrer noopener"
                      className="group block text-[0.83rem] font-semibold leading-snug text-navy-800 hover:text-brand-800"
                      title={t('jur.doi')}
                    >
                      {a.judul}
                    </a>
                    <p className="mt-0.5 text-[0.74rem] leading-snug text-muted-500">
                      {a.penulis ? <span>{a.penulis}</span> : null}
                      {a.penulis && a.tanggal ? <span> · </span> : null}
                      {a.tanggal ? (
                        <time dateTime={a.tanggal}>{tanggalPanjang(a.tanggal, t)}</time>
                      ) : null}
                      {!a.penulis && !a.tanggal ? <span>{t('jur.tanpaTanggal')}</span> : null}
                    </p>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="mt-2.5 flex-1 border-t border-line-200 pt-2.5 text-[0.8rem] leading-snug text-muted-500">
                {j.catatan || t('jur.kosong')}
              </p>
            )}

            <a
              href={j.situs}
              target="_blank"
              rel="noreferrer noopener"
              className="mt-2.5 inline-flex items-center gap-1 text-[0.8rem] font-semibold text-brand-700 hover:text-brand-800"
            >
              {t('jur.buka')}
              <ExternalLink className="size-3" aria-hidden="true" />
            </a>
          </Card>
        ))}
      </div>
    </section>
  )
}