import { useEffect, useState } from 'react'
import logo from '../assets/logo-mark.png'

/**
 * Halaman muat aplikasi — tampil tepat 1 detik lalu menghilang.
 *
 * Desainnya sengaja berbeda dari splash halaman penjelasan (prototipe):
 * di sana latar terang lembut dengan logo bernapas; di sini latar gradien
 * navy → teal gelap dengan garis detak jantung yang tergambar sekali —
 * tetap satu tema: logo yang sama, Plus Jakarta Sans, tagline yang sama,
 * dan aksen teal khas Pahami Sehat.
 */
const DURASI = 1000 // 1 detik
const FADE = 450 // waktu memudar setelah 1 detik

export default function LoadingPage({ t = (k) => k }) {
  const [fase, setFase] = useState('tampil') // tampil → keluar → lepas

  useEffect(() => {
    const t1 = window.setTimeout(() => setFase('keluar'), DURASI)
    const t2 = window.setTimeout(() => setFase('lepas'), DURASI + FADE)
    return () => {
      window.clearTimeout(t1)
      window.clearTimeout(t2)
    }
  }, [])

  if (fase === 'lepas') return null

  return (
    <div
      role="status"
      aria-live="polite"
      aria-label={t('load.memuat')}
      className={`fixed inset-0 z-[70] flex flex-col items-center justify-center overflow-hidden bg-[linear-gradient(135deg,#0f1e33_0%,#12324a_55%,#0d6a61_130%)] px-6 transition-opacity duration-[450ms] ${
        fase === 'keluar' ? 'pointer-events-none opacity-0' : 'opacity-100'
      }`}
    >
      {/* lingkaran lembut supaya latarnya tidak datar */}
      <span
        aria-hidden="true"
        className="pointer-events-none absolute -top-24 -left-20 size-72 rounded-full bg-brand-500/20 blur-3xl"
      />
      <span
        aria-hidden="true"
        className="pointer-events-none absolute -bottom-24 -right-16 size-64 rounded-full bg-sky-500/15 blur-3xl"
      />

      <div className="relative flex flex-col items-center text-center">
        <span className="splash-breath rounded-3xl bg-white p-3.5 shadow-[0_18px_40px_rgba(0,0,0,.35)]">
          <img src={logo} alt="" width="64" height="58" className="size-16 object-contain" />
        </span>

        <strong className="mt-5 text-2xl font-extrabold tracking-tight text-white">
          Pahami Sehat
        </strong>
        <span className="mt-1 text-sm font-medium text-brand-200">
          {t('nav.isiDrawer')}
        </span>

        {/* garis detak jantung — tergambar sekali selama 1 detik */}
        <svg
          viewBox="0 0 160 44"
          aria-hidden="true"
          className="mt-6 h-11 w-44 text-brand-300"
        >
          <polyline
            className="splash-ecg"
            points="0,22 46,22 54,22 60,8 68,36 76,14 82,22 160,22"
            fill="none"
            stroke="currentColor"
            strokeWidth="3"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>

        <p className="mt-4 text-xs font-semibold tracking-wide text-white/60">
          {t('load.menyiapkan')}
        </p>
      </div>

      {/* garis progres tipis di dasar layar — penuh tepat dalam 1 detik */}
      <div className="absolute inset-x-0 bottom-0 h-1 bg-white/10" aria-hidden="true">
        <span className="splash-fill block h-full w-full bg-gradient-to-r from-brand-400 to-brand-200" />
      </div>
    </div>
  )
}
