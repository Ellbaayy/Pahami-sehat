/**
 * Hook: status server + meta (model & daftar tingkat).
 * Dipakai untuk menampilkan badge "terhubung / belum jalan" di TopBar.
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
