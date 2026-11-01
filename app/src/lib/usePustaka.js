import { useEffect, useState } from 'react'

/**
 * Pengambil katalog pustaka (`/api/pustaka`), dipakai bersama oleh halaman
 * Sumber Resmi dan Jurnal.
 *
 * KENAPA DI SIMPAN DI TINGKAT MODUL: kedua halaman memakai balasan yang sama.
 * Tanpa simpanan ini, berpindah menu bolak-balik akan memanggil server terus,
 * dan server harus mengulang pengambilan ke sepuluh lembaga + enam jurnal.
 * Simpanan di sini hanya untuk sesi peramban; kesegaran datanya tetap diatur
 * server (3 jam).
 */
let simpanan = null
let janji = null

export function usePustaka() {
  const [data, setData] = useState(simpanan)
  const [memuat, setMemuat] = useState(!simpanan)
  const [galat, setGalat] = useState(false)

  useEffect(() => {
    let hidup = true

    if (simpanan) {
      setData(simpanan)
      setMemuat(false)
      return () => {
        hidup = false
      }
    }

    if (!janji) {
      janji = fetch('/api/pustaka')
        .then((r) => (r.ok ? r.json() : Promise.reject(new Error(`HTTP ${r.status}`))))
        .then((j) => {
          simpanan = j
          return j
        })
        .finally(() => {
          janji = null
        })
    }

    janji
      .then((j) => {
        if (!hidup) return
        setData(j)
        setMemuat(false)
      })
      .catch(() => {
        if (!hidup) return
        setGalat(true)
        setMemuat(false)
      })

    return () => {
      hidup = false
    }
  }, [])

  return { data, memuat, galat }
}

/** Tanggal ISO -> teks lokal. Mengembalikan null kalau tanggalnya tidak ada. */
export function tanggalPanjang(iso, t) {
  if (!iso) return null
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return null
  const lokal = t('umum.kodeLokal') === 'en-US' ? 'en-US' : 'id-ID'
  return d.toLocaleDateString(lokal, { day: 'numeric', month: 'long', year: 'numeric' })
}
