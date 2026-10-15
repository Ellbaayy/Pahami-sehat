/**
 * Hook: ringkasan berita harian untuk lonceng pemberitahuan.
 *
 * Jagi meminta (15 Okt 2026): berita WAJIB segar minimal sehari sekali, dan
 * lonceng harus berbunyi kalau ada yang baru.
 *
 * Cara kerja:
 *   - Ambil GET /api/berita/ringkas sekali saat aplikasi dibuka, lalu tiap
 *     30 menit (bukan tiap detik — server sendiri meng-cache sehari sekali,
 *     jadi lebih sering dari ini tidak ada gunanya).
 *   - Kembalikan { judul, segar, sidik, diperbarui } atau null kalau gagal.
 *     Gagal = lonceng cukup tidak menampilkan butir berita, bukan error.
 *   - Keputusan "baru" (sidik beda dari terakhir dibaca) ada di App.jsx,
 *     karena di sanalah status baca lonceng disimpan.
 */

import { useEffect, useState } from 'react'

const SELANG_MS = 30 * 60 * 1000 // 30 menit

export function useBerita() {
  const [ringkas, setRingkas] = useState(null)

  useEffect(() => {
    let batal = false

    const ambil = async () => {
      try {
        const res = await fetch('/api/berita/ringkas')
        if (!res.ok) return
        const d = await res.json()
        if (batal) return
        if (d?.ok && Array.isArray(d.judul)) setRingkas(d)
      } catch {
        /* server mati / jaringan putus — butir berita cukup tidak muncul */
      }
    }

    ambil()
    const t = window.setInterval(ambil, SELANG_MS)
    return () => {
      batal = true
      window.clearInterval(t)
    }
  }, [])

  return ringkas
}
