import { ShieldCheck, AudioLines } from 'lucide-react'

/** Ilustrasi kesehatan — SVG inline, tanpa request eksternal, tanpa distorsi. */
function HealthIllustration() {
  return (
    <svg
      viewBox="0 0 260 200"
      role="img"
      aria-label="Ilustrasi hati dengan garis detak jantung"
      className="h-full w-full"
    >
      <rect x="8" y="10" width="244" height="180" rx="26" fill="#eefbf8" />
      <circle cx="214" cy="46" r="16" fill="#d3f5ee" />
      <circle cx="44" cy="156" r="10" fill="#dbeefe" />
      <circle cx="230" cy="140" r="6" fill="#a8eadf" />

      {/* hati */}
      <path
        d="M130 168c-2 0-4-1-5-2-22-14-52-36-52-66 0-19 15-33 33-33 10 0 19 5 24 13 5-8 14-13 24-13 18 0 33 14 33 33 0 30-30 52-52 66-1 1-3 2-5 2z"
        fill="#17a398"
      />
      {/* garis ECG */}
      <path
        d="M74 112h24l9-22 13 44 11-30 8 16h35"
        fill="none"
        stroke="#ffffff"
        strokeWidth="6"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      {/* daun */}
      <path
        d="M56 62c14-4 26 3 29 15-14 4-26-3-29-15z"
        fill="#35c1b0"
      />
      <path d="M56 62c8 2 16 8 21 15" fill="none" stroke="#0d8478" strokeWidth="2.5" strokeLinecap="round" />
    </svg>
  )
}

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
          <span className="inline-flex items-center gap-1.5 rounded-full bg-white px-3 py-1.5 text-[0.76rem] font-semibold text-navy-700 ring-1 ring-slate-200">
            <ShieldCheck className="size-3.5 text-brand-600" aria-hidden="true" />
            Bersumber resmi
          </span>
          <span className="inline-flex items-center gap-1.5 rounded-full bg-white px-3 py-1.5 text-[0.76rem] font-semibold text-navy-700 ring-1 ring-slate-200">
            <AudioLines className="size-3.5 text-sky-600" aria-hidden="true" />
            Mode suara tersedia
          </span>
        </div>
      </div>

      {/* Ilustrasi — menyusut proporsional di tablet, disembunyikan di layar sangat kecil */}
      <div className="hidden aspect-[13/10] w-[clamp(9.5rem,20vw,17rem)] shrink-0 sm:block">
        <HealthIllustration />
      </div>
    </section>
  )
}
