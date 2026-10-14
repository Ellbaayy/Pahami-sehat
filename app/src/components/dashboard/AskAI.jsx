import { Sparkles, WifiOff, ArrowRight } from 'lucide-react'
import { Card } from '../ui/primitives'
import Komposer from './Komposer'

/**
 * Kartu "Tanya AI" di Beranda — PINTU MASUK, bukan tempat jawaban.
 *
 * Begitu pertanyaan dikirim, halaman langsung berpindah ke Tanya AI: pertanyaan
 * muncul di sana sebagai gelembung pertama dan jawabannya menyusul di tempat
 * yang sama. Karena itu kartu ini memakai komposer versi `ringkas` (tanpa
 * pemilih mode, tombol kamera, dan tingkat baca) dan tidak pernah menampilkan
 * hasil — hasilnya selalu di halaman Tanya AI, supaya tidak ada dua tempat
 * berbeda yang menampilkan hal yang sama.
 */
export default function AskAI({
  value,
  onChange,
  onKirim,
  loading = false,
  t = (k) => k,
  serverOnline = true,
  serverMemuat = false,
}) {
  return (
    <Card className="p-[clamp(1rem,0.85rem+0.7vw,1.6rem)]">
      <div className="mb-3 flex items-center gap-2.5">
        <span className="grid size-9 shrink-0 place-items-center rounded-xl bg-brand-50 text-brand-700 ring-1 ring-brand-100">
          <Sparkles className="size-[18px]" aria-hidden="true" />
        </span>
        <div className="min-w-0">
          <h2 className="text-[clamp(0.98rem,0.94rem+0.2vw,1.1rem)] font-bold text-navy-900">
            {t('tanya.judul')}
          </h2>
          <p className="text-[0.8rem] leading-snug text-navy-500">{t('tanya.sub')}</p>
        </div>
      </div>

      {!serverOnline && !serverMemuat ? (
        <div className="mb-3 flex items-center gap-2 rounded-xl border border-amber-200 bg-amber-50 px-3.5 py-2.5 text-[0.82rem] font-medium text-amber-800">
          <WifiOff className="size-4 shrink-0" aria-hidden="true" />
          <span>
            {t('umum.serverMati')}. {t('umum.jalankan')}{' '}
            <code className="font-mono">npm run server</code>.
          </span>
        </div>
      ) : null}

      <Komposer
        t={t}
        value={value}
        onChange={onChange}
        onKirim={onKirim}
        loading={loading}
        serverOnline={serverOnline}
        serverMemuat={serverMemuat}
        ringkas
        idKotak="beranda-input"
      />

      {/* Menjelaskan apa yang akan terjadi setelah menekan kirim — tanpa ini
          perpindahan halaman terasa seperti kejutan. */}
      <p className="mt-2.5 inline-flex items-center gap-1.5 text-[0.78rem] text-muted-500">
        <ArrowRight className="size-3.5" aria-hidden="true" />
        {t('tanya.pindahCatatan')}
      </p>
    </Card>
  )
}
