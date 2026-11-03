import { useCallback, useState } from 'react'

/**
 * Pengambil rute perjalanan.
 *
 * Galat disimpan sebagai KODE, bukan kalimat — komponen yang menerjemahkan,
 * karena hanya komponen yang punya `t` (aturan proyek: pesan galat di `lib/`
 * berupa kunci kamus).
 *
 * Setiap pergantian moda MEMANGGIL ULANG server. Itu disengaja: mengganti moda
 * harus menghasilkan rute yang benar-benar berbeda (jalan kaki 2,14 km vs mobil
 * 4,54 km), bukan sekadar mengganti ikon.
 */

export function useRute(bahasa = 'id') {
  const [rute, setRute] = useState(null)
  const [moda, setModa] = useState('mobil')
  const [memuat, setMemuat] = useState(false)
  const [galat, setGalat] = useState(null)

  const hitung = useCallback(async ({ latAsal, lonAsal, latTujuan, lonTujuan, modaBaru }) => {
    const m = modaBaru ?? 'mobil'
    setModa(m)
    setMemuat(true)
    setGalat(null)
    try {
      const url =
        `/api/rute?latAsal=${encodeURIComponent(latAsal)}` +
        `&lonAsal=${encodeURIComponent(lonAsal)}` +
        `&latTujuan=${encodeURIComponent(latTujuan)}` +
        `&lonTujuan=${encodeURIComponent(lonTujuan)}` +
        `&moda=${encodeURIComponent(m)}` +
        `&bahasa=${encodeURIComponent(bahasa)}`
      const res = await fetch(url)
      const j = await res.json()
      if (!res.ok || !j.ok) {
        setGalat(j?.code ?? `http_${res.status}`)
        // Tautan Google Maps tetap disimpan walau rute gagal: itu jalan keluar
        // terakhir yang berguna bagi pengguna.
        setRute(j?.googleMaps ? { googleMaps: j.googleMaps, gagal: true } : null)
        return
      }
      setRute(j)
    } catch {
      setGalat('jaringan')
      setRute(null)
    } finally {
      setMemuat(false)
    }
  }, [bahasa])

  const bersihkan = useCallback(() => {
    setRute(null)
    setGalat(null)
  }, [])

  return { rute, moda, memuat, galat, hitung, bersihkan }
}
