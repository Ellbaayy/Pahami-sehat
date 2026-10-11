/**
 * Batas kesalahan (error boundary) React.
 *
 * KENAPA PERLU
 * Tanpa ini, satu galat di satu komponen membuat SELURUH aplikasi gagal
 * dirender — React melepas seluruh pohon komponen dan halaman menjadi kosong
 * putih. Bagi pengguna itu tampak seperti aplikasi rusak total, padahal
 * bagian lain sebenarnya masih sehat.
 *
 * Dengan batas ini: bagian yang rusak diganti pesan yang bisa dibaca, dan
 * pengguna masih bisa memakai bagian aplikasi yang lain.
 *
 * CATATAN JUJUR: komponen kelas memang gaya lama, tetapi React sampai
 * sekarang belum menyediakan padanan berbasis hook untuk menangkap galat
 * render (tidak ada `useErrorBoundary`). Ini satu-satunya cara resminya.
 */

import { Component } from 'react'
import { AlertTriangle, RotateCcw } from 'lucide-react'

export default class BatasGalat extends Component {
  constructor(props) {
    super(props)
    this.state = { galat: null }
  }

  static getDerivedStateFromError(galat) {
    return { galat }
  }

  componentDidCatch(galat, info) {
    // dicatat ke konsol peramban supaya bisa diperiksa saat mengembangkan.
    // Sengaja tidak dikirim ke server: aplikasi ini menjanjikan tidak
    // mengirim data pengguna, dan jejak galat bisa memuat isi pertanyaan.
    console.error('[Pahami Sehat] galat render:', galat, info?.componentStack)
  }

  coba = () => {
    this.setState({ galat: null })
  }

  render() {
    const { galat } = this.state
    if (!galat) return this.props.children

    const { judul, pesan } = this.props

    return (
      <div
        role="alert"
        className="rounded-2xl border border-rose-200 bg-rose-50 p-[clamp(1.1rem,1rem+0.8vw,1.9rem)]"
      >
        <div className="flex items-start gap-3">
          <span className="grid size-9 shrink-0 place-items-center rounded-xl bg-white text-rose-600 shadow-sm">
            <AlertTriangle className="size-[18px]" aria-hidden="true" />
          </span>
          <div className="min-w-0 flex-1">
            <p className="text-[0.98rem] font-bold text-rose-800">
              {judul ?? 'Bagian ini gagal ditampilkan'}
            </p>
            <p className="mt-1 text-[0.86rem] leading-relaxed text-rose-700">
              {pesan ??
                'Terjadi kesalahan saat menampilkan bagian ini. Bagian aplikasi yang lain masih bisa dipakai.'}
            </p>

            {/* rincian teknis dibuka hanya bila diminta — tidak menakut-nakuti pengguna biasa */}
            <details className="mt-2.5">
              <summary className="cursor-pointer text-[0.78rem] font-semibold text-rose-700">
                Rincian teknis
              </summary>
              <p className="mt-1.5 rounded-lg bg-white/70 p-2.5 font-mono text-[0.72rem] break-words text-rose-800">
                {String(galat?.message ?? galat)}
              </p>
            </details>

            <button
              type="button"
              onClick={this.coba}
              className="mt-3 inline-flex items-center gap-2 rounded-xl border border-rose-200 bg-white px-3.5 py-2 text-[0.84rem] font-semibold text-rose-700 transition-colors hover:bg-rose-100 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-rose-500"
            >
              <RotateCcw className="size-4" aria-hidden="true" />
              Coba tampilkan lagi
            </button>
          </div>
        </div>
      </div>
    )
  }
}
