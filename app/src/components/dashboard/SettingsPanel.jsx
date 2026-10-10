import { WifiOff, Volume2, Languages } from 'lucide-react'
import { Card, SectionHeading } from '../ui/primitives'
import { cn } from '../../lib/cn'
import { TINGKAT } from '../../data/tingkat'
import { BAHASA } from '../../data/bahasa'

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
    <div className="flex flex-col gap-y-3 px-[clamp(0.95rem,0.85rem+0.4vw,1.35rem)] py-4 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between sm:gap-x-4">
      <div className="min-w-0 sm:flex-1">
        <p className="text-[0.95rem] font-semibold text-navy-900">{title}</p>
        <p className="mt-0.5 text-[0.84rem] leading-snug text-navy-500">{description}</p>
      </div>
      <div className="sm:shrink-0">{control}</div>
    </div>
  )
}

export default function SettingsPanel({ settings, onChange, t = (k) => k, labelTingkat = (x) => x }) {
  const set = (key, value) => onChange({ ...settings, [key]: value })

  return (
    <div className="space-y-[clamp(1rem,1.6vw,1.75rem)]">
      <SectionHeading
        eyebrow="Preferensi"
        title={t('set.judul')}
        description={t('set.sub')}
      />

      <Card className="divide-y divide-slate-100 overflow-hidden">
        <Row
          title={t('set.tingkat')}
          description={t('set.tingkatSub')}
          control={
            <div
              role="group"
              aria-label={t('umum.tingkatBaca')}
              className="flex flex-wrap gap-1 rounded-xl border border-slate-200 bg-white p-1"
            >
              {TINGKAT.map((t) => (
                <button
                  key={t.kunci}
                  type="button"
                  onClick={() => set('level', t.kunci)}
                  aria-pressed={settings.level === t.kunci}
                  title={`Perkiraan umur pembaca ${t.usia}`}
                  className={cn(
                    'h-11 min-w-[3.25rem] whitespace-nowrap rounded-lg px-3 text-[0.85rem] font-bold transition-colors duration-200',
                    'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-500',
                    settings.level === t.kunci
                      ? 'bg-brand-500 text-white'
                      : 'text-navy-500 hover:bg-slate-100 hover:text-navy-800',
                  )}
                >
                  {labelTingkat(t.kunci)}
                </button>
              ))}
            </div>
          }
        />

        <Row
          title={
            <span className="inline-flex items-center gap-2">
              <WifiOff className="size-4 text-brand-600" aria-hidden="true" />
              {t('set.offline')}
            </span>
          }
          description={t('set.offlineSub')}
          control={
            <Switch
              checked={settings.offline}
              onChange={(v) => set('offline', v)}
              label={t('set.offline')}
            />
          }
        />

        <Row
          title={
            <span className="inline-flex items-center gap-2">
              <Volume2 className="size-4 text-sky-600" aria-hidden="true" />
              {t('set.tts')}
            </span>
          }
          description={t('set.ttsSub')}
          control={
            <Switch
              checked={settings.tts}
              onChange={(v) => set('tts', v)}
              label={t('set.tts')}
            />
          }
        />

        <Row
          title={
            <span className="inline-flex items-center gap-2">
              <Languages className="size-4 text-brand-600" aria-hidden="true" />
              {t('set.bahasa')}
            </span>
          }
          description={t('set.bahasaSub')}
          control={
            <select
              aria-label={t('set.bahasa')}
              value={settings.lang}
              onChange={(e) => set('lang', e.target.value)}
              className="h-11 rounded-xl border border-slate-200 bg-white px-3.5 text-[0.88rem] font-semibold text-navy-700 transition-colors hover:border-slate-300 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-500"
            >
              {BAHASA.map((b) => (
                <option key={b.kunci} value={b.kunci}>
                  {b.label}
                </option>
              ))}
            </select>
          }
        />
      </Card>

      <p className="text-[0.8rem] text-slate-500">
        {t('set.catatan')}
      </p>
    </div>
  )
}
