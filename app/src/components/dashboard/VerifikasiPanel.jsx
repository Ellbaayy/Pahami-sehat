import { useState } from 'react'
import { ShieldCheck, ShieldAlert, ShieldQuestion, Loader2 } from 'lucide-react'
import { Button, Card, SectionHeading, SourcePills, PoinKunci, Peringatan } from '../ui/primitives'
import TombolDengar from '../ui/TombolDengar'
import { TINGKAT } from '../../data/tingkat'
import { verifikasi } from '../../lib/api'

const CONTOH = 'Vaksin MMR menyebabkan autisme pada anak.'

const VERDICT = {
  didukung: {
    label: 'Didukung sumber',
    Ikon: ShieldCheck,
    kelas: 'border-emerald-200 bg-emerald-50 text-emerald-800',
  },
  tidak_didukung: {
    label: 'Tidak didukung sumber',
    Ikon: ShieldAlert,
    kelas: 'border-rose-200 bg-rose-50 text-rose-700',
  },
  tidak_bisa_dipastikan: {
    label: 'Belum bisa dipastikan',
    Ikon: ShieldQuestion,
    kelas: 'border-amber-200 bg-amber-50 text-amber-800',
  },
}

/**
 * Cek klaim kesehatan — untuk broadcast WhatsApp yang mencurigakan.
 * Model diminta jujur: "tidak bisa dipastikan" adalah jawaban yang sah.
 */
export default function VerifikasiPanel({ tingkat, onTingkatChange, serverOnline, serverMemuat, t = (k) => k, labelTingkat = (x) => x }) {
  const [klaim, setKlaim] = useState('')
  const [loading, setLoading] = useState(false)
  const [hasil, setHasil] = useState(null)
  const [error, setError] = useState(null)

  const kirim = async () => {
    const isi = klaim.trim()
    if (!isi || loading) return
    setLoading(true)
    setHasil(null)
    setError(null)
    try {
      const d = await verifikasi({ klaim: isi, tingkat })
      setHasil(d)
    } catch (e) {
      setError({ pesan: e.message, code: e.code })
    } finally {
      setLoading(false)
    }
  }

  const v = hasil ? VERDICT[hasil.verdict] ?? VERDICT.tidak_bisa_dipastikan : null
  const labelVerdict = { didukung: t('ver.didukung'), tidak_didukung: t('ver.tidakDidukung'), tidak_bisa_dipastikan: t('ver.tidakPasti') }

  return (
    <div className="space-y-[clamp(1rem,1.6vw,1.75rem)]">
      <SectionHeading
        eyebrow="Fitur inti"
        title={t('ver.judul')}
        description={t('ver.sub')}
        ilustrasi="verifikasi"
      />

      <Card className="p-[clamp(1rem,0.85rem+0.7vw,1.6rem)]">
        <div className="mb-3 flex flex-wrap items-center gap-3">
          <span className="text-[0.84rem] font-semibold text-navy-700">{t('umum.tingkatBaca')}:</span>
          <div
            role="group"
            aria-label={t('umum.tingkatBaca')}
            className="flex flex-wrap gap-1 rounded-xl border border-slate-200 bg-white p-1"
          >
            {TINGKAT.map((t) => (
              <button
                key={t.kunci}
                type="button"
                onClick={() => onTingkatChange(t.kunci)}
                aria-pressed={tingkat === t.kunci}
                title={`Perkiraan umur pembaca ${t.usia}`}
                className={
                  'h-11 whitespace-nowrap rounded-lg px-3 text-[0.82rem] font-bold transition-colors duration-200 ' +
                  'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-500 ' +
                  (tingkat === t.kunci
                    ? 'bg-brand-500 text-white'
                    : 'text-navy-500 hover:bg-slate-100 hover:text-navy-800')
                }
              >
                {labelTingkat(t.kunci)}
              </button>
            ))}
          </div>
          <button
            type="button"
            onClick={() => {
              setKlaim(CONTOH)
              setHasil(null)
              setError(null)
            }}
            className="ml-auto text-[0.8rem] font-semibold text-brand-600 hover:text-brand-700"
          >
            {t('umum.pakaiContoh')}
          </button>
        </div>

        <label htmlFor="teks-klaim" className="sr-only">
          {t('ver.label')}
        </label>
        <textarea
          id="teks-klaim"
          rows={3}
          value={klaim}
          onChange={(e) => setKlaim(e.target.value)}
          placeholder={t('ver.placeholder')}
          className="w-full resize-y rounded-xl border border-slate-200 bg-white px-3.5 py-3 text-[0.92rem] leading-relaxed text-navy-900 outline-none transition-colors placeholder:text-slate-500 focus:border-brand-400 focus:ring-2 focus:ring-brand-100"
        />

        <div className="mt-3">
          <Button
            type="button"
            size="lg"
            loading={loading}
            disabled={!klaim.trim() || !serverOnline}
            onClick={kirim}
          >
            {loading ? t('umum.proses') : t('ver.tombol')}
          </Button>
        </div>

        {!serverOnline && !serverMemuat ? (
          <p className="mt-2.5 text-[0.8rem] text-amber-700">
            {t('umum.serverMati')} — {t('umum.jalankan')} <code className="font-mono">npm run server</code>.
          </p>
        ) : null}
      </Card>

      {error ? <Peringatan pesan={error.pesan} code={error.code} /> : null}

      {loading ? (
        <Card className="p-[clamp(1rem,0.85rem+0.7vw,1.6rem)]">
          <p className="inline-flex items-center gap-2 text-[0.88rem] font-semibold text-brand-600">
            <Loader2 className="size-4 animate-spin" aria-hidden="true" />
            {t('ver.proses')}
          </p>
        </Card>
      ) : hasil && v ? (
        <Card className="rise p-[clamp(1rem,0.85rem+0.7vw,1.6rem)]">
          <div className={`mb-3 inline-flex items-center gap-2 rounded-xl border px-3.5 py-2 ${v.kelas}`}>
            <v.Ikon className="size-4 shrink-0" aria-hidden="true" />
            <span className="text-[0.86rem] font-bold">{labelVerdict[hasil.verdict] ?? v.label}</span>
          </div>

          <p className="text-[0.95rem] leading-relaxed whitespace-pre-wrap text-navy-800">
            {hasil.jawaban}
          </p>

          <div className="mt-3 flex flex-wrap items-center gap-2">
            <TombolDengar teks={hasil.jawaban} />
          </div>
          <PoinKunci items={hasil.poinKunci} />
          <SourcePills
            sources={hasil.sumber}
            negative={hasil.verdict === 'tidak_didukung'}
          />
          {hasil.catatan ? (
            <p className="mt-2 text-[0.78rem] text-slate-500">{hasil.catatan}</p>
          ) : null}
        </Card>
      ) : null}
    </div>
  )
}
