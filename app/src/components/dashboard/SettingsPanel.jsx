import { WifiOff, Volume2, Languages } from 'lucide-react'
import { Card, SectionHeading } from '../ui/primitives'
import { cn } from '../../lib/cn'
import { TINGKAT } from '../../data/tingkat'

function Switch({ checked, onChange, label }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      onClick={() => onChange(!checked)}
      className={cn(
        'relative h-7 w-12 shrink-0 rounded-full transition-colors duration-200',
        'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-500',
        checked ? 'bg-brand-500' : 'bg-slate-300',
      )}
    >
      <span
        className={cn(
          'absolute top-1 left-1 size-5 rounded-full bg-white shadow transition-transform duration-200',
          checked && 'translate-x-5',
        )}
      />
    </button>
  )
}

function Row({ title, description, control }) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-3 px-[clamp(0.95rem,0.85rem+0.4vw,1.35rem)] py-4">
      <div className="min-w-0 flex-1">
        <p className="text-[0.95rem] font-semibold text-navy-900">{title}</p>
        <p className="mt-0.5 text-[0.84rem] leading-snug text-navy-500">{description}</p>
      </div>
      <div className="shrink-0">{control}</div>
    </div>
  )
}

export default function SettingsPanel({ settings, onChange }) {
  const set = (key, value) => onChange({ ...settings, [key]: value })

  return (
    <div className="space-y-[clamp(1rem,1.6vw,1.75rem)]">
      <SectionHeading
        eyebrow="Preferensi"
        title="Pengaturan"
        description="Disimpan di browser ini saja. Tidak ada akun, tidak ada server."
      />

      <Card className="divide-y divide-slate-100 overflow-hidden">
        <Row
          title="Tingkat baca"
          description="Target penyederhanaan jawaban dan artikel."
          control={
            <div
              role="group"
              aria-label="Pilih tingkat baca"
              className="flex rounded-xl border border-slate-200 bg-white p-1"
            >
              {TINGKAT.map((t) => (
                <button
                  key={t.kunci}
                  type="button"
                  onClick={() => set('level', t.kunci)}
                  aria-pressed={settings.level === t.kunci}
                  className={cn(
                    'h-9 min-w-[3.25rem] rounded-lg px-3 text-[0.85rem] font-bold transition-colors duration-200',
                    'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-500',
                    settings.level === t.kunci
                      ? 'bg-brand-500 text-white'
                      : 'text-navy-500 hover:bg-slate-100 hover:text-navy-800',
                  )}
                >
                  {t.label}
                </button>
              ))}
            </div>
          }
        />

        <Row
          title={
            <span className="inline-flex items-center gap-2">
              <WifiOff className="size-4 text-brand-600" aria-hidden="true" />
              Mode hemat sinyal
            </span>
          }
          description="Simpan jawaban terakhir di perangkat ini supaya tetap bisa dibaca saat sinyal hilang."
          control={
            <Switch
              checked={settings.offline}
              onChange={(v) => set('offline', v)}
              label="Mode hemat sinyal"
            />
          }
        />

        <Row
          title={
            <span className="inline-flex items-center gap-2">
              <Volume2 className="size-4 text-sky-600" aria-hidden="true" />
              Putar suara otomatis
            </span>
          }
          description="Setiap jawaban AI langsung dibacakan dengan suara peramban (TTS)."
          control={
            <Switch
              checked={settings.tts}
              onChange={(v) => set('tts', v)}
              label="Putar suara otomatis"
            />
          }
        />

        <Row
          title={
            <span className="inline-flex items-center gap-2">
              <Languages className="size-4 text-brand-600" aria-hidden="true" />
              Bahasa antarmuka
            </span>
          }
          description="Isi jawaban mengikuti bahasa yang kamu pilih."
          control={
            <select
              aria-label="Bahasa antarmuka"
              value={settings.lang}
              onChange={(e) => set('lang', e.target.value)}
              className="h-11 rounded-xl border border-slate-200 bg-white px-3.5 text-[0.88rem] font-semibold text-navy-700 transition-colors hover:border-slate-300 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-500"
            >
              <option value="id">Bahasa Indonesia</option>
              <option value="en">English</option>
            </select>
          }
        />
      </Card>

      <p className="text-[0.8rem] text-slate-500">
        Tingkat baca berlaku untuk semua jawaban AI. Semua preferensi ini tersimpan di peramban, bukan di server.
      </p>
    </div>
  )
}
