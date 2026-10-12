/**
 * Hook: status server (hidup/mati + model yang dipakai).
 *
 * CATATAN: namanya "useServer" karena itu yang ditampilkan — badge "terhubung /
 * belum jalan" di TopBar dan footer. Komentar lama menyebut "status server +
 * meta (model & daftar tingkat)", padahal daftar tingkat TIDAK diambil di sini
 * (ada di src/data/tingkat.js). Yang diambil hanya /api/health.
 *
 * Pemeriksaan diulang tiap 30 detik. Server sendiri menyimpan hasilnya selama
 * 15 detik (lihat server/batasInput.js), jadi pemeriksaan berkala tidak
 * menghajar layanan Kenari.
 */

import { useEffect, useState } from 'react'
import { ambilHealth } from '../lib/api'

export function useServer() {
  const [status, setStatus] = useState({ memuat: true, online: false, model: null, pesan: '' })

  useEffect(() => {
    let batal = false

    const cek = async () => {
      try {
        const d = await ambilHealth()
        if (batal) return
        setStatus({
          memuat: false,
          online: Boolean(d?.kenari?.ok),
          model: d?.model ?? null,
          modelTersedia: d?.kenari?.modelTersedia ?? false,
          pesan: d?.kenari?.ok ? '' : d?.kenari?.pesan || 'Model tidak tersedia.',
        })
      } catch (e) {
        if (batal) return
        setStatus({ memuat: false, online: false, model: null, pesan: e.message })
      }
    }

    cek()
    const t = window.setInterval(cek, 30000)
    return () => {
      batal = true
      window.clearInterval(t)
    }
  }, [])

  return status
}
