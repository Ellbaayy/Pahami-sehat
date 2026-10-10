import { ShieldCheck, AudioLines } from 'lucide-react'
import IlustrasiAnimasi from '../ui/IlustrasiAnimasi'

/**
 * Sapaan pembuka di Beranda.
 *
 * Ilustrasi dokter yang bergerak berdiri di sebelah sapaan supaya halaman
 * langsung terasa hidup. Jumlah ilustrasi di aplikasi ini sengaja dijaga
 * sedikit — dashboard adalah alat kerja, bukan halaman cerita.
 */
export default function Greeting() {
  return (
    <section
      aria-labelledby="greeting-title"
      className="flex items-center gap-[clamp(1rem,3vw,2.75rem)]"
    >
      <div className="min-w-0 flex-1">
        <p className="mb-2 text-[0.72rem] font-bold tracking-[0.14em] uppercase text-brand-600">
          Beranda
        </p>
        <h1
          id="greeting-title"
          className="text-[clamp(1.6rem,1.2rem+1.6vw,2.6rem)] leading-[1.1] font-extrabold tracking-tight text-navy-900"
        >
          Halo! <span aria-hidden="true">👋</span>
        </h1>
        <p className="mt-2 text-[clamp(1.05rem,0.95rem+0.6vw,1.5rem)] font-semibold text-brand-600">
          Ada yang bisa kami bantu?
        </p>
        <p className="mt-2 max-w-[54ch] text-[clamp(0.88rem,0.84rem+0.2vw,1rem)] text-navy-500">
          Temukan informasi kesehatan yang mudah dipahami atau tanyakan apa saja seputar
          kesehatan.
        </p>

        <div className="mt-4 flex flex-wrap gap-2">
          <span className="inline-flex items-center gap-1.5 rounded-full bg-white px-3 py-1.5 text-[0.76rem] font-semibold text-navy-700 ring-1 ring-line-200">
            <ShieldCheck className="size-3.5 text-brand-600" aria-hidden="true" />
            Bersumber resmi
          </span>
          <span className="inline-flex items-center gap-1.5 rounded-full bg-white px-3 py-1.5 text-[0.76rem] font-semibold text-navy-700 ring-1 ring-line-200">
            <AudioLines className="size-3.5 text-sky-700" aria-hidden="true" />
            Mode suara tersedia
          </span>
        </div>
      </div>

      {/* Ilustrasi sapaan — ikut tampil di ponsel (di atas teks), lalu pindah
          ke samping kanan pada layar >=640px. Sebelumnya disembunyikan di
          bawah 640px sehingga animasinya tidak pernah terlihat di ponsel. */}
      <div className="order-first w-[clamp(6rem,26vw,9rem)] shrink-0 sm:order-none sm:w-[clamp(9rem,19vw,15.5rem)]">
        <IlustrasiAnimasi
          nama="sapaan"
          className="h-auto w-full"
        />
        <span className="sr-only">
          Ilustrasi dokter menyapa di halaman beranda
        </span>
      </div>
    </section>
  )
}
