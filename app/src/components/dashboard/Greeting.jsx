import { ShieldCheck, AudioLines, Hand } from 'lucide-react'
import IlustrasiAnimasi from '../ui/IlustrasiAnimasi'

/**
 * Sapaan pembuka di Beranda.
 *
 * Ilustrasi dokter yang bergerak berdiri di sebelah sapaan supaya halaman
 * langsung terasa hidup. Jumlah ilustrasi di aplikasi ini sengaja dijaga
 * sedikit — dashboard adalah alat kerja, bukan halaman cerita.
 *
 * Semua teks diambil dari kamus lewat `t()` supaya ikut bahasa antarmuka.
 * Sebelumnya teksnya ditulis tetap di sini, sehingga panel ini tetap berbahasa
 * Indonesia walau antarmukanya sudah diset Inggris — padahal kunci kamusnya
 * (beranda.*) sudah tersedia sejak awal dan tidak pernah dipakai.
 */
export default function Greeting({ t = (k) => k }) {
  return (
    <section
      aria-labelledby="greeting-title"
      className="relative overflow-hidden rounded-[clamp(1.25rem,1rem+1vw,1.75rem)] bg-[linear-gradient(120deg,#eefbf8_0%,#eff8ff_55%,#f5f3ff_100%)] px-[clamp(1.25rem,1rem+1.6vw,2.5rem)] py-[clamp(1.5rem,1.1rem+1.6vw,2.75rem)] ring-1 ring-brand-100/70"
    >
      {/* Aksen halus di pojok — hanya hiasan, diabaikan pembaca layar */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute -top-16 -right-16 size-56 rounded-full bg-brand-200/40 blur-3xl"
      />
      <div
        aria-hidden="true"
        className="pointer-events-none absolute -bottom-20 -left-10 size-48 rounded-full bg-sky-200/40 blur-3xl"
      />
      <div className="relative flex items-center gap-[clamp(1rem,3vw,2.75rem)]">
      <div className="min-w-0 flex-1">
        <p className="mb-2 text-[0.8125rem] font-bold tracking-[0.14em] uppercase text-brand-700">
          {t('nav.beranda')}
        </p>
        <h1
          id="greeting-title"
          className="text-[clamp(1.9rem,1.5rem+2vw,3rem)] leading-[1.05] font-extrabold tracking-tight text-navy-900"
        >
          {t('beranda.sapa')}{' '}
          <Hand
            className="inline-block size-[0.85em] -translate-y-[0.08em] align-baseline text-brand-500"
            aria-hidden="true"
          />
        </h1>
        <p className="mt-2.5 text-[clamp(1.05rem,0.95rem+0.6vw,1.5rem)] font-semibold text-brand-700">
          {t('beranda.tanya')}
        </p>
        <p className="mt-2 max-w-[54ch] text-[clamp(0.88rem,0.84rem+0.2vw,1rem)] leading-relaxed text-navy-500">
          {t('beranda.sub')}
        </p>

        <div className="mt-4 flex flex-wrap gap-2">
          <span className="inline-flex items-center gap-1.5 rounded-full bg-white/80 px-3 py-1.5 text-[0.82rem] font-semibold text-navy-700 ring-1 ring-line-200 backdrop-blur-sm">
            <ShieldCheck className="size-3.5 text-brand-700" aria-hidden="true" />
            {t('beranda.badge1')}
          </span>
          <span className="inline-flex items-center gap-1.5 rounded-full bg-white/80 px-3 py-1.5 text-[0.82rem] font-semibold text-navy-700 ring-1 ring-line-200 backdrop-blur-sm">
            <AudioLines className="size-3.5 text-sky-700" aria-hidden="true" />
            {t('beranda.badge2')}
          </span>
        </div>
      </div>

      {/* Ilustrasi sapaan — ikut tampil di ponsel (di atas teks), lalu pindah
          ke samping kanan pada layar >=640px. Diperbesar supaya tidak tenggelam
          di samping hero yang sekarang punya latar. */}
      <div className="order-first w-[clamp(6.5rem,30vw,10rem)] shrink-0 sm:order-none sm:w-[clamp(10rem,21vw,16rem)]">
        <IlustrasiAnimasi nama="sapaan" className="h-auto w-full drop-shadow-[0_10px_24px_rgba(23,163,152,0.18)]" />
        <span className="sr-only">{t('beranda.altIlustrasi')}</span>
      </div>
      </div>
    </section>
  )
}
