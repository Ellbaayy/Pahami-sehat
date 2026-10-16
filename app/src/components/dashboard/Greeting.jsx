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
export default function Greeting({ t = (k) => k, nama = null }) {
  // Nama panggilan dipakai untuk menyapa: "Halo Bayu!" — bukan "Halo!" saja.
  // Kalau nama belum diisi (mis. akun lama), kembali ke sapaan biasa supaya
  // tidak muncul "Halo null!".
  const sapa = nama ? t('beranda.sapaNama', { nama }) : t('beranda.sapa')
  return (
    <section
      aria-labelledby="greeting-title"
      className="flex items-center gap-[clamp(1rem,3vw,2.75rem)]"
    >
      <div className="min-w-0 flex-1">
        <p className="mb-2 text-[0.72rem] font-bold tracking-[0.14em] uppercase text-brand-700">
          {t('nav.beranda')}
        </p>
        <h1
          id="greeting-title"
          className="text-[clamp(1.6rem,1.2rem+1.6vw,2.6rem)] leading-[1.1] font-extrabold tracking-tight text-navy-900"
        >
          {sapa}{' '}
          <Hand
            className="inline-block size-[0.85em] -translate-y-[0.08em] align-baseline text-brand-500"
            aria-hidden="true"
          />
        </h1>
        <p className="mt-2 text-[clamp(1.05rem,0.95rem+0.6vw,1.5rem)] font-semibold text-brand-700">
          {t('beranda.tanya')}
        </p>
        <p className="mt-2 max-w-[54ch] text-[clamp(0.88rem,0.84rem+0.2vw,1rem)] text-navy-500">
          {t('beranda.sub')}
        </p>

        <div className="mt-4 flex flex-wrap gap-2">
          <span className="inline-flex items-center gap-1.5 rounded-full bg-white px-3 py-1.5 text-[0.76rem] font-semibold text-navy-700 ring-1 ring-line-200">
            <ShieldCheck className="size-3.5 text-brand-700" aria-hidden="true" />
            {t('beranda.badge1')}
          </span>
          <span className="inline-flex items-center gap-1.5 rounded-full bg-white px-3 py-1.5 text-[0.76rem] font-semibold text-navy-700 ring-1 ring-line-200">
            <AudioLines className="size-3.5 text-sky-700" aria-hidden="true" />
            {t('beranda.badge2')}
          </span>
        </div>
      </div>

      {/* Ilustrasi sapaan — ikut tampil di ponsel (di atas teks), lalu pindah
          ke samping kanan pada layar >=640px. Sebelumnya disembunyikan di
          bawah 640px sehingga animasinya tidak pernah terlihat di ponsel. */}
      <div className="order-first w-[clamp(6rem,26vw,9rem)] shrink-0 sm:order-none sm:w-[clamp(9rem,19vw,15.5rem)]">
        <IlustrasiAnimasi nama="sapaan" className="h-auto w-full" />
        <span className="sr-only">{t('beranda.altIlustrasi')}</span>
      </div>
    </section>
  )
}
