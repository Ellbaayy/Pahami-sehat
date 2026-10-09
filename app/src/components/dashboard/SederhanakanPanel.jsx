import { useState } from 'react'
import { FileText, Loader2, Wand2, Trash2 } from 'lucide-react'
import { Button, Card, SectionHeading, SourcePills, PoinKunci, Peringatan } from '../ui/primitives'
import TombolDengar from '../ui/TombolDengar'
import { TINGKAT } from '../../data/tingkat'
import { sederhanakan } from '../../lib/api'

const CONTOH = `Hipertensi merupakan kondisi kronis yang ditandai dengan peningkatan tekanan darah arteri secara persisten di atas nilai ambang batas normal. Komplikasi meliputi hipertrofi ventrikel kiri, nefropati, dan retinopati. Terapi lini pertama: ACE inhibitor atau ARB, target <140/90 mmHg.`

/**
 * Penerjemah bahasa medis — fitur inti Pahami Sehat.
 * Tempel teks medis mentah (hasil lab, label obat, artikel, broadcast WA),
 * lalu model menyederhanakannya pada tingkat baca yang dipilih.
 */
export default function SederhanakanPanel({ tingkat, onTingkatChange, serverOnline, serverMemuat }) {
  const [teks, setTeks] = useState('')
  const [loading, setLoading] = useState(false)
  const [hasil, setHasil] = useState(null)
  const [error, setError] = useState(null)

  const kirim = async () => {
    const isi = teks.trim()
    if (!isi || loading) return
    setLoading(true)
    setHasil(null)
    setError(null)
    try {
      const d = await sederhanakan({ teks: isi, tingkat })
      setHasil(d)
    } catch (e) {
      setError({ pesan: e.message, code: e.code })
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="space-y-[clamp(1rem,1.6vw,1.75rem)]">
      <SectionHeading
        eyebrow="Fitur inti"
        title="Sederhanakan teks medis"
        description="Tempel teks dari hasil lab, label obat, artikel, atau broadcast WhatsApp. Model menandai poin kunci lebih dulu, baru menyederhanakan bahasanya."
      />

      <Card className="p-[clamp(1rem,0.85rem+0.7vw,1.6rem)]">
        <div className="mb-3 flex flex-wrap items-center gap-3">
          <span className="text-[0.84rem] font-semibold text-navy-700">Tingkat baca:</span>
          <div
            role="group"
            aria-label="Pilih tingkat baca"
            className="flex flex-wrap gap-1 rounded-xl border border-slate-200 bg-white p-1"
          >
            {TINGKAT.map((t) => (
              <button
                key={t.kunci}
                type="button"
                onClick={() => onTingkatChange(t.kunci)}
                aria-pressed={tingkat === t.kunci}
                title={`Target setara kelas ${t.targetKelas}`}
                className={
                  'h-9 rounded-lg px-3 text-[0.82rem] font-bold transition-colors duration-200 ' +
                  'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-500 ' +
                  (tingkat === t.kunci
                    ? 'bg-brand-500 text-white'
                    : 'text-navy-500 hover:bg-slate-100 hover:text-navy-800')
                }
              >
                {t.label}
              </button>
            ))}
          </div>
          <button
            type="button"
            onClick={() => {
              setTeks(CONTOH)
              setHasil(null)
              setError(null)
            }}
            className="ml-auto text-[0.8rem] font-semibold text-brand-600 hover:text-brand-700"
          >
            Pakai contoh
          </button>
        </div>

        <label htmlFor="teks-medis" className="sr-only">
          Teks medis yang akan disederhanakan
        </label>
        <textarea
          id="teks-medis"
          rows={5}
          value={teks}
          onChange={(e) => setTeks(e.target.value)}
          placeholder="Tempel teks medis di sini…"
          className="w-full resize-y rounded-xl border border-slate-200 bg-white px-3.5 py-3 text-[0.92rem] leading-relaxed text-navy-900 outline-none transition-colors placeholder:text-slate-500 focus:border-brand-400 focus:ring-2 focus:ring-brand-100"
        />

        <div className="mt-3 flex flex-wrap items-center gap-3">
          <Button
            type="button"
            size="lg"
            loading={loading}
            disabled={!teks.trim() || !serverOnline}
            onClick={kirim}
          >
            {loading ? 'Memproses…' : 'Sederhanakan'}
            {!loading ? <Wand2 className="size-4" aria-hidden="true" /> : null}
          </Button>
          {teks ? (
            <button
              type="button"
              onClick={() => {
                setTeks('')
                setHasil(null)
                setError(null)
              }}
              className="inline-flex items-center gap-1.5 text-[0.82rem] font-semibold text-navy-500 hover:text-navy-800"
            >
              <Trash2 className="size-3.5" aria-hidden="true" />
              Kosongkan
            </button>
          ) : null}
          <span className="ml-auto text-[0.78rem] text-slate-500">{teks.length} karakter</span>
        </div>

        {!serverOnline && !serverMemuat ? (
          <p className="mt-2.5 text-[0.8rem] text-amber-700">
            Server AI belum terhubung — jalankan <code className="font-mono">npm run server</code>.
          </p>
        ) : null}
      </Card>

      {error ? <Peringatan pesan={error.pesan} code={error.code} /> : null}

      {loading ? (
        <Card className="p-[clamp(1rem,0.85rem+0.7vw,1.6rem)]">
          <p className="inline-flex items-center gap-2 text-[0.88rem] font-semibold text-brand-600">
            <Loader2 className="size-4 animate-spin" aria-hidden="true" />
            Menandai poin kunci lalu menyederhanakan bahasa…
          </p>
        </Card>
      ) : hasil ? (
        <Card className="rise p-[clamp(1rem,0.85rem+0.7vw,1.6rem)]">
          <div className="mb-3 flex flex-wrap items-center gap-2">
            <span className="inline-flex items-center gap-1.5 rounded-full bg-brand-50 px-2.5 py-1 text-[0.74rem] font-bold text-brand-700 ring-1 ring-brand-100">
              <FileText className="size-3.5" aria-hidden="true" />
              Tingkat {hasil.tingkat.label} · target kelas {hasil.tingkat.targetKelas}
            </span>
          </div>

          <p className="text-[0.95rem] leading-relaxed whitespace-pre-wrap text-navy-800">
            {hasil.jawaban}
          </p>

          <div className="mt-3 flex flex-wrap items-center gap-2">
            <TombolDengar teks={hasil.jawaban} />
          </div>
          <PoinKunci items={hasil.poinKunci} />
          <SourcePills sources={hasil.sumber} />
          {hasil.catatan ? (
            <p className="mt-2 text-[0.78rem] text-slate-500">{hasil.catatan}</p>
          ) : null}
        </Card>
      ) : null}
    </div>
  )
}
