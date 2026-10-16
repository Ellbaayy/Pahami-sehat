/**
 * Hook akun: siapa yang sedang masuk, dan pindahkan riwayat lama sekali saja.
 *
 * ============================================================================
 * KENAPA ADA DI SINI, BUKAN DI App.jsx
 * ============================================================================
 *
 * Logika akun punya cukup banyak keadaan (memuat, belum masuk, sudah masuk,
 * gagal) dan efek samping (memindahkan riwayat lama). Menaruhnya di dalam
 * App.jsx — yang sudah panjang — membuatnya sulit dibaca dan sulit diuji.
 *
 * ============================================================================
 * PEMINDAHAN RIWAYAT LAMA
 * ============================================================================
 *
 * Jagi minta riwayat yang sudah ada di peramban TIDAK hilang. Jadi saat
 * pertama kali masuk, riwayat dari localStorage dikirim ke akun.
 *
 * Dijalankan SEKALI per pengguna, dan ditandai di localStorage. Penandanya
 * memuat id pengguna, jadi kalau orang lain masuk di peramban yang sama,
 * riwayat orang sebelumnya TIDAK ikut terkirim ke akun yang baru.
 */

import { useCallback, useEffect, useState } from 'react'
import { bacaSesi } from './sesi.js'

const KUNCI_SUDAH_PINDAH = 'pahami-sehat:riwayat-dipindah'

/** Panggil API akun; galat dikembalikan sebagai { ok:false, pesan }. */
async function api(jalur, opsi = {}) {
  try {
    const res = await fetch(jalur, {
      method: opsi.method ?? 'GET',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'same-origin',
      body: opsi.body ? JSON.stringify(opsi.body) : undefined,
    })
    const data = await res.json().catch(() => null)
    if (!res.ok || !data?.ok) return { ok: false, pesan: data?.pesan ?? 'Gagal menghubungi server.' }
    return data
  } catch {
    return { ok: false, pesan: 'Server tidak bisa dihubungi.' }
  }
}

export function useAkun() {
  const [pengguna, setPengguna] = useState(null)
  const [memuat, setMemuat] = useState(true)

  /** Periksa sekali saat aplikasi dibuka: siapa yang sedang masuk? */
  const periksa = useCallback(async () => {
    const d = await api('/api/akun/saya')
    setPengguna(d.ok && d.masuk ? d.pengguna : null)
    setMemuat(false)
    return d.ok && d.masuk ? d.pengguna : null
  }, [])

  useEffect(() => {
    periksa()
  }, [periksa])

  /**
   * Pindahkan riwayat dari peramban ke akun — sekali saja per pengguna.
   * Kalau gagal, TIDAK ada yang hilang: riwayat aslinya tetap di peramban.
   */
  const pindahkanRiwayatLama = useCallback(async (idPengguna) => {
    if (!idPengguna) return 0
    try {
      const sudah = localStorage.getItem(KUNCI_SUDAH_PINDAH)
      if (sudah === String(idPengguna)) return 0 // sudah pernah untuk pengguna ini

      const daftar = bacaSesi()
      if (Array.isArray(daftar) && daftar.length) {
        const d = await api('/api/akun/riwayat/pindah', {
          method: 'POST',
          body: { riwayat: daftar.slice(0, 20) },
        })
        if (!d.ok) return 0
        localStorage.setItem(KUNCI_SUDAH_PINDAH, String(idPengguna))
        return d.dipindah ?? 0
      }
      // tidak ada riwayat lama — tetap tandai supaya tidak diperiksa berulang
      localStorage.setItem(KUNCI_SUDAH_PINDAH, String(idPengguna))
      return 0
    } catch {
      return 0
    }
  }, [])

  /** Dipanggil halaman login setelah berhasil masuk atau mendaftar. */
  const setelahMasuk = useCallback(
    async (p) => {
      setPengguna(p)
      await pindahkanRiwayatLama(p?.id)
    },
    [pindahkanRiwayatLama],
  )

  /** Keluar dari perangkat ini. */
  const keluar = useCallback(async () => {
    await api('/api/akun/keluar', { method: 'POST' })
    setPengguna(null)
  }, [])

  /** Simpan nama panggilan baru. */
  const simpanNama = useCallback(async (nama) => {
    const d = await api('/api/akun/nama', { method: 'POST', body: { namaPengguna: nama } })
    if (d.ok) setPengguna(d.pengguna)
    return d
  }, [])

  return { pengguna, memuat, setelahMasuk, keluar, simpanNama, periksa }
}
