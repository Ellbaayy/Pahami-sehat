import { useId } from 'react'
import { Sparkles, Wand2, Mic, Send, Camera } from 'lucide-react'
import { Button } from '../ui/primitives'
import { gunakanSuara } from '../../lib/useSuara'
import { TINGKAT } from '../../data/tingkat'
import { cn } from '../../lib/cn'

/**
 * Kotak isian Tanya AI — satu-satunya pintu masuk pertanyaan.
 *
 * Dulu tiap kemampuan punya halamannya sendiri: Tanya AI, Sederhanakan, Suara,
 * dan Pindai Foto. Sekarang semuanya berkumpul di sini, karena keempatnya
 * sebenarnya satu hal yang sama: menyiapkan TEKS untuk diproses.
 *
 *   - mode "Tanya"          -> teks dikirim sebagai pertanyaan
 *   - mode "Sederhanakan"   -> teks yang ditempel disederhanakan (istilah medis)
 *   - tombol mikrofon       -> ucapan jadi teks, masuk ke kotak ini
 *   - tombol kamera         -> foto jadi teks, masuk ke kotak ini (PemindaiFoto)
 *
 * Hasil suara dan hasil pindai SELALU masuk ke kotak isian lebih dulu, tidak
 * pernah langsung dikirim: pengguna harus bisa memeriksa dan membetulkan
 * sebelum AI memakainya.
 *
 * `ringkas` dipakai kartu di Beranda — di sana kotaknya hanya pintu masuk
 * (mode, kamera, dan tingkat baca disembunyikan), karena kiriman dari Beranda
 * langsung berpindah ke halaman Tanya AI.
 */

/** Batas teks per mode — sama dengan batas rutenya di server. */
const MAKS_TANYA = 4000
const MAKS_SEDERHANAKAN = 8000

export default function Komposer({
  t = (k) => k,
  value,
  onChange,
  onKirim,
  loading = false,
  serverOnline = true,
  serverMemuat = false,
  mode = 'tanya',
  onModeChange,
  tingkat,
  onTingkatChange,
  labelTingkat = (x) => x,
  onContohSederhanakan,
  onPindaiBuka,
  pindaiTerbuka = false,
  ringkas = false,
  idKotak = 'tanya-input',
}) {
  const id = useId()
  const suara = gunakanSuara({ bahasa: 'id-ID', onHasil: onChange })
  const sederhanakan = mode === 'sederhanakan'
  const maks = sederhanakan ? MAKS_SEDERHANAKAN : MAKS_TANYA
  const terlaluPanjang = (value || '').length > maks
  const canSubmit = value.trim().length > 0 && !loading && !serverMemuat && !terlaluPanjang

  const kirim = (e) => {
    e.preventDefault()
    if (!canSubmit) return
    onKirim(value, mode)
  }

  const toggleMic = () => {
    if (suara.mendengar) suara.berhenti()
    else suara.mulai()
  }

  const tombolKirim = sederhanakan ? t('sed.tombol') : t('tanya.kirim')

  return (
    <>
      {!ringkas ? (
        <div className="mb-3 flex flex-wrap items-center gap-3">
          <div
            role="group"
            aria-label={t('tanya.modeAria')}
            className="flex flex-wrap gap-1 rounded-xl border border-line-200 bg-white p-1"
          >
            {[
              { kunci: 'tanya', label: t('tanya.modeTanya'), Ikon: Sparkles },
              { kunci: 'sederhanakan', label: t('sed.tombol'), Ikon: Wand2 },
            ].map(({ kunci, label, Ikon }) => (
              <button
                key={kunci}
                type="button"
                onClick={() => onModeChange?.(kunci)}
                aria-pressed={mode === kunci}
                className={cn(
                  'inline-flex h-11 items-center gap-2 whitespace-nowrap rounded-lg px-3.5 text-[0.85rem] font-bold transition-colors duration-200',
                  'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-500',
                  mode === kunci
                    ? 'bg-brand-600 text-white'
                    : 'text-navy-500 hover:bg-surface-100 hover:text-navy-800',
                )}
              >
                <Ikon className="size-4" aria-hidden="true" />
                {label}
              </button>
            ))}
          </div>

          {sederhanakan ? (
            <>
              <span className="text-[0.84rem] font-semibold text-navy-700">
                {t('umum.tingkatBaca')}:
              </span>
              <div
                role="group"
                aria-label={t('umum.tingkatBaca')}
                className="flex flex-wrap gap-1 rounded-xl border border-line-200 bg-white p-1"
              >
                {TINGKAT.map((x) => (
                  <button
                    key={x.kunci}
                    type="button"
                    onClick={() => onTingkatChange?.(x.kunci)}
                    aria-pressed={tingkat === x.kunci}
                    title={t(`usia.${x.kunci}`)}
                    className={cn(
                      'h-11 whitespace-nowrap rounded-lg px-3 text-[0.82rem] font-bold transition-colors duration-200',
                      'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-500',
                      tingkat === x.kunci
                        ? 'bg-brand-600 text-white'
                        : 'text-navy-500 hover:bg-surface-100 hover:text-navy-800',
                    )}
                  >
                    {labelTingkat(x.kunci)}
                  </button>
                ))}
              </div>
              {onContohSederhanakan ? (
                <button
                  type="button"
                  onClick={onContohSederhanakan}
                  className="ml-auto text-[0.8rem] font-semibold text-brand-700 hover:text-brand-700"
                >
                  {t('umum.pakaiContoh')}
                </button>
              ) : null}
            </>
          ) : null}
        </div>
      ) : null}

      {!serverOnline && !serverMemuat ? (
        <div className="mb-3 flex items-center gap-2 rounded-xl border border-amber-200 bg-amber-50 px-3.5 py-2.5 text-[0.82rem] font-medium text-amber-800">
          <span>
            {t('umum.serverMati')}. {t('umum.jalankan')}{' '}
            <code className="font-mono">npm run server</code>.
          </span>
        </div>
      ) : null}

      <form onSubmit={kirim} className="flex flex-col gap-3 lg:flex-row lg:items-stretch">
        <div
          className={cn(
            'flex flex-1 items-start gap-2 rounded-2xl border bg-white px-3.5 py-3 transition-colors duration-200',
            'focus-within:border-brand-500 focus-within:ring-2 focus-within:ring-brand-100',
            loading ? 'border-brand-200' : 'border-line-200 hover:border-line-300',
          )}
        >
          <label htmlFor={idKotak || id} className="sr-only">
            {sederhanakan ? t('sed.label') : t('tanya.judul')}
          </label>
          <textarea
            id={idKotak || id}
            rows={2}
            value={value}
            onChange={(e) => onChange(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault()
                if (canSubmit) onKirim(value, mode)
              }
            }}
            placeholder={sederhanakan ? t('sed.placeholder') : t('tanya.placeholder')}
            className="min-h-[3.25rem] flex-1 resize-none bg-transparent text-[1rem] leading-relaxed text-navy-900 outline-none placeholder:text-muted-500"
          />

          {!ringkas ? (
            <button
              type="button"
              onClick={onPindaiBuka}
              aria-pressed={pindaiTerbuka}
              aria-label={t('tanya.pindaiTombol')}
              title={t('tanya.pindaiTombol')}
              className={cn(
                'grid size-11 shrink-0 place-items-center rounded-full transition-all duration-200',
                'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-500',
                pindaiTerbuka
                  ? 'bg-brand-600 text-white'
                  : 'bg-surface-100 text-navy-500 hover:bg-brand-50 hover:text-brand-700',
              )}
            >
              <Camera className="size-[18px]" aria-hidden="true" />
            </button>
          ) : null}

          <button
            type="button"
            onClick={toggleMic}
            aria-pressed={suara.mendengar}
            disabled={!suara.didukung}
            title={suara.didukung ? t('suara.ariaMulai') : t('suara.tidakDidukung')}
            aria-label={
              !suara.didukung
                ? t('suara.ariaTidakDidukung')
                : suara.mendengar
                  ? t('suara.ariaHentikan')
                  : t('suara.ariaMulai')
            }
            className={cn(
              'grid size-11 shrink-0 place-items-center rounded-full transition-all duration-200',
              'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-500',
              'disabled:cursor-not-allowed disabled:opacity-45',
              suara.mendengar
                ? 'bg-rose-500 text-white animate-pulse'
                : 'bg-surface-100 text-navy-500 hover:bg-brand-50 hover:text-brand-700',
            )}
          >
            <Mic className="size-[18px]" aria-hidden="true" />
          </button>
        </div>

        <Button
          type="submit"
          size="lg"
          loading={loading}
          disabled={!canSubmit}
          full
          className="lg:w-auto lg:shrink-0"
        >
          {loading ? t('umum.proses') : tombolKirim}
          {!loading ? <Send className="size-4" aria-hidden="true" /> : null}
        </Button>
      </form>

      {/* Baris status di bawah kotak: hanya diisi kalau ADA yang perlu
          dikatakan — suara yang sedang didengar, galat, atau info mode
          Sederhanakan. Kalau sedang diam (mode Tanya biasa), baris ini KOSONG
          dan tidak dirender sama sekali: dulu ia menampilkan placeholder yang
          SAMA dengan yang ada di dalam kotak, sehingga teksnya terbaca dua
          kali dan tampak seperti konten pengisi. */}
      {suara.mendengar || suara.error || terlaluPanjang || sederhanakan ? (
        <p className="mt-2 text-[0.82rem] text-muted-500" aria-live="polite">
          {suara.mendengar ? (
            suara.sementara ? (
              <span className="text-brand-700">“{suara.sementara}”</span>
            ) : (
              t('tanya.mendengar')
            )
          ) : suara.error ? (
            <span className="text-rose-700">{t(suara.error)}</span>
          ) : terlaluPanjang ? (
            <span className="text-amber-700">{t('tanya.terlaluPanjang')}</span>
          ) : (
            <>
              {t('sed.sub')}
              {value.length > 0 ? (
                <span className="ml-2 text-muted-500">
                  {value.length}/{MAKS_SEDERHANAKAN}
                </span>
              ) : null}
            </>
          )}
        </p>
      ) : null}
    </>
  )
}
