import { useEffect } from 'react'
import { Mic, Square, RotateCcw, ArrowRight, AudioLines } from 'lucide-react'
import { Card, SectionHeading, Button, Peringatan } from '../ui/primitives'
import TombolDengar from '../ui/TombolDengar'
import { gunakanSuara } from '../../lib/useSuara'
import { cn } from '../../lib/cn'

/**
 * Panel Suara — lapis aksesibilitas "terjangkau".
 *
 * Memakai pengenalan suara peramban (Web Speech API): ucapannya langsung
 * diubah menjadi teks, lalu bisa dikirim ke Tanya AI.
 *
 * Peramban yang belum mendukung (mis. Firefox) akan menampilkan pesan jujur
 * dan tombolnya dinonaktifkan — bukan pura-pura merekam.
 *
 * Seluruh teks diambil dari kamus lewat `t()` supaya ikut bahasa antarmuka.
 * Sebelumnya semuanya ditulis tetap di sini, sehingga panel ini tetap
 * berbahasa Indonesia walau antarmukanya sudah diset Inggris — padahal kunci
 * kamusnya (suara.*) sudah tersedia sejak awal dan tidak pernah dipakai.
 */
export default function VoicePanel({ onUse, t = (k) => k }) {
  const suara = gunakanSuara({ bahasa: 'id-ID' })
  // Teks yang ditampilkan = hasil akhir kalau sudah ada, kalau belum pakai
  // teks sementara (yang muncul sambil bicara). Sebelumnya hanya `sementara`
  // yang dibaca, dan karena hook mengosongkannya begitu hasil akhir datang,
  // kotaknya tetap kosong walau ucapannya sudah dikenali dengan benar.
  const teks = suara.hasil || suara.sementara || ''

  // hentikan mikrofon saat panel ditinggalkan
  useEffect(() => () => suara.berhenti(), []) // eslint-disable-line react-hooks/exhaustive-deps

  const toggle = () => {
    if (suara.mendengar) suara.berhenti()
    else suara.mulai()
  }

  return (
    <div className="space-y-[clamp(1rem,1.6vw,1.75rem)]">
      <SectionHeading
        eyebrow={t('suara.eyebrow')}
        title={t('suara.judul')}
        description={t('suara.sub')}
        ilustrasi="suara"
      />

      <Card className="flex flex-col items-center gap-5 p-[clamp(1.25rem,1rem+1.2vw,2.5rem)] text-center">
        <button
          type="button"
          onClick={toggle}
          disabled={!suara.didukung}
          aria-pressed={suara.mendengar}
          aria-label={
            !suara.didukung
              ? t('suara.ariaTidakDidukung')
              : suara.mendengar
                ? t('suara.ariaHentikan')
                : t('suara.ariaMulai')
          }
          title={suara.didukung ? undefined : t('suara.tidakDidukung')}
          className={cn(
            'grid size-20 place-items-center rounded-full transition-all duration-300 sm:size-24',
            'focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-brand-500',
            'disabled:cursor-not-allowed disabled:opacity-45',
            suara.mendengar
              ? 'scale-105 bg-rose-500 text-white shadow-[0_0_0_10px_rgba(244,63,94,0.15)]'
              : 'bg-brand-500 text-white shadow-[0_0_0_10px_rgba(23,163,152,0.12)] hover:bg-brand-600 active:scale-95',
          )}
        >
          {suara.mendengar ? (
            <Square className="size-7 fill-current" />
          ) : (
            <Mic className="size-8" />
          )}
        </button>

        {/* gelombang suara */}
        <div className="flex h-9 items-end gap-1.5" aria-hidden="true">
          {Array.from({ length: 13 }).map((_, i) => (
            <span
              key={i}
              className={cn(
                'w-1.5 rounded-full transition-all duration-300',
                suara.mendengar ? 'bg-brand-400' : 'bg-surface-200',
              )}
              style={{
                height: suara.mendengar ? `${16 + ((i * 37) % 22)}px` : '6px',
                transformOrigin: 'bottom',
                animation: suara.mendengar ? `wave 0.9s ease-in-out ${i * 0.07}s infinite` : undefined,
              }}
            />
          ))}
        </div>

        <p className="text-[0.95rem] font-semibold text-navy-800">
          {!suara.didukung
            ? t('suara.tidakDidukung')
            : suara.mendengar
              ? t('suara.mendengar')
              : teks
                ? t('suara.dikenali')
                : t('suara.tekan')}
        </p>

        <div className="min-h-[4.5rem] w-full max-w-[46rem] rounded-xl border border-dashed border-line-300 bg-surface-50 px-4 py-3.5 text-left">
          {teks ? (
            <p className="text-[0.95rem] leading-relaxed text-navy-700">{teks}</p>
          ) : (
            <p className="flex items-center gap-2 text-[0.88rem] text-muted-500">
              <AudioLines className="size-4" aria-hidden="true" />
              {t('suara.placeholder')}
            </p>
          )}
        </div>

        <div className="flex w-full max-w-[28rem] flex-col gap-2.5 sm:flex-row">
          <Button
            variant="neutral"
            size="lg"
            onClick={suara.mulai}
            disabled={!suara.didukung || suara.mendengar}
            full
            className="sm:w-auto sm:flex-1"
          >
            <RotateCcw className="size-4" aria-hidden="true" />
            {t('suara.ulangi')}
          </Button>
          <Button
            size="lg"
            onClick={() => onUse(teks)}
            disabled={!teks || suara.mendengar}
            full
            className="sm:w-auto sm:flex-1"
          >
            {t('suara.gunakan')}
            <ArrowRight className="size-4" aria-hidden="true" />
          </Button>
        </div>

        {teks ? (
          <div className="flex flex-wrap items-center justify-center gap-2">
            <TombolDengar teks={teks} label={t('suara.dengarUlang')} t={t} />
          </div>
        ) : null}
      </Card>

      {suara.error ? <Peringatan pesan={suara.error} code="mikrofon" /> : null}

      <p className="text-[0.82rem] text-muted-500">{t('suara.catatan')}</p>
    </div>
  )
}
