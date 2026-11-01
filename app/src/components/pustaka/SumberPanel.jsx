import { Landmark, Globe2, ExternalLink, Link2, TriangleAlert, Loader2, CheckCircle2 } from 'lucide-react'
import { Card, SectionHeading } from '../ui/primitives'
import { usePustaka, tanggalPanjang } from '../../lib/usePustaka'

/**
 * Halaman "Sumber Resmi" — sepuluh platform kesehatan yang menjadi rujukan
 * aplikasi ini, dibagi Nasional dan Internasional.
 *
 * ATURAN YANG DIPEGANG HALAMAN INI: status setiap lembaga ditampilkan apa
 * adanya. Yang kanalnya bisa dibaca otomatis diberi lencana "Terhubung" dan
 * menampilkan kabar terbarunya; yang tidak punya jalur mesin diberi lencana
 * "Tautan resmi" beserta SEBABNYA (lihat `catatan` di server). Tidak ada
 * lembaga yang diberi kabar karangan supaya halaman terlihat penuh.
 */
export default function SumberPanel({ t }) {
  const { data, memuat, galat } = usePustaka()
  const sumber = Array.isArray(data?.sumber) ? data.sumber : []
  const nasional = sumber.filter((s) => s.kategori === 'nasional')
  const internasional = sumber.filter((s) => s.kategori !== 'nasional')
  const diperiksa = tanggalPanjang(data?.diperiksa, t)

  return (
    <section aria-labelledby="sumber-judul" className="space-y-4">
      <SectionHeading
        as="h1"
        id="sumber-judul"
        eyebrow={t('sum.eyebrow')}
        title={t('sum.judul')}
        description={t('sum.deskripsi')}
        action={
          diperiksa ? (
            <p className="text-[0.8rem] font-medium text-muted-500">
              {t('sum.diperiksa')}: {diperiksa}
            </p>
          ) : null
        }
      />

      {memuat ? (
        <div className="flex items-center gap-2 rounded-2xl border border-line-200 bg-white px-4 py-6 text-navy-700">
          <Loader2 className="size-4 animate-spin" aria-hidden="true" />
          <p className="text-[0.9rem]">{t('sum.memuat')}</p>
        </div>
      ) : null}

      {galat && !sumber.length ? (
        <div className="flex items-start gap-2 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-4 text-[0.88rem] text-navy-800">
          <TriangleAlert className="mt-0.5 size-4 shrink-0 text-amber-600" aria-hidden="true" />
          <p>{t('sum.galat')}</p>
        </div>
      ) : null}

      <div className="grid gap-4 lg:grid-cols-2">
        <Kelompok
          judul={t('sum.nasional')}
          ikon={Landmark}
          daftar={nasional}
          t={t}
        />
        <Kelompok
          judul={t('sum.internasional')}
          ikon={Globe2}
          daftar={internasional}
          t={t}
        />
      </div>
    </section>
  )
}

function Kelompok({ judul, ikon: Ikon, daftar, t }) {
  return (
    <div className="space-y-2.5">
      <h2 className="flex items-center gap-2 text-[0.95rem] font-bold text-navy-900">
        <Ikon className="size-4 text-brand-700" aria-hidden="true" />
        {judul}
      </h2>
      {daftar.length ? (
        <ul className="space-y-2.5">
          {daftar.map((s) => (
            <li key={s.id}>
              <KartuSumber sumber={s} t={t} />
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-[0.85rem] text-muted-500">{t('sum.kosong')}</p>
      )}
    </div>
  )
}

function Lencana({ status, t }) {
  const peta = {
    terhubung: {
      teks: t('sum.terhubung'),
      kelas: 'border-brand-200 bg-brand-50 text-brand-800',
      Ikon: CheckCircle2,
    },
    tautan: {
      teks: t('sum.tautan'),
      kelas: 'border-line-200 bg-surface-100 text-navy-700',
      Ikon: Link2,
    },
    gagal: {
      teks: t('sum.gagal'),
      kelas: 'border-amber-200 bg-amber-50 text-amber-800',
      Ikon: TriangleAlert,
    },
  }
  const p = peta[status] ?? peta.gagal
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[0.72rem] font-semibold ${p.kelas}`}
    >
      <p.Ikon className="size-3" aria-hidden="true" />
      {p.teks}
    </span>
  )
}

function KartuSumber({ sumber, t }) {
  return (
    <Card className="p-3 [@media(min-height:1200px)]:p-4">
      <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1.5">
        <div className="min-w-0">
          <p className="text-[0.92rem] font-bold text-navy-900">{sumber.singkat}</p>
          <p className="text-[0.78rem] leading-snug text-muted-500">{sumber.nama}</p>
        </div>
        <Lencana status={sumber.status} t={t} />
      </div>

      {sumber.item.length ? (
        <ul className="mt-2.5 space-y-1.5 border-t border-line-200 pt-2.5">
          {sumber.item.slice(0, 2).map((a) => (
            <li key={a.tautan || a.judul}>
              <a
                href={a.tautan}
                target="_blank"
                rel="noreferrer noopener"
                className="group flex items-start gap-1.5 text-[0.84rem] font-medium leading-snug text-navy-800 hover:text-brand-800"
              >
                <ExternalLink
                  className="mt-0.5 size-3 shrink-0 text-muted-400 group-hover:text-brand-700"
                  aria-hidden="true"
                />
                <span>
                  {a.judul}
                  {a.tanggal ? (
                    <span className="ml-1 font-normal text-muted-500">
                      · {tanggalPanjang(a.tanggal, t)}
                    </span>
                  ) : null}
                </span>
              </a>
            </li>
          ))}
        </ul>
      ) : null}

      {sumber.catatan ? (
        <p className="mt-2.5 border-t border-line-200 pt-2.5 text-[0.78rem] leading-snug text-muted-500">
          {sumber.catatan}
        </p>
      ) : null}

      <a
        href={sumber.situs}
        target="_blank"
        rel="noreferrer noopener"
        className="mt-2.5 inline-flex items-center gap-1 text-[0.8rem] font-semibold text-brand-700 hover:text-brand-800"
      >
        {t('sum.buka')}
        <ExternalLink className="size-3" aria-hidden="true" />
      </a>
    </Card>
  )
}
