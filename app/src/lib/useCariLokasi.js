import { useCallback, useState } from 'react'

/**
 * Pencarian lokasi manual — dipakai saat izin GPS ditolak atau tidak tersedia.
 *
 * Sumbernya Nominatim (OpenStreetMap), sama seperti peta, jadi tidak menambah
 * pihak ketiga baru. Aturan Nominatim yang DIHORMATI:
 *   - satu permintaan per pengguna, tidak ada polling;
 *   - parameter `countrycodes=id` karena aplikasi ini untuk Indonesia;
 *   - `addressdetails=1` supaya label hasilnya bisa dibaca manusia.
 * Nominatim mewajibkan User-Agent yang menyebut aplikasinya; peramban tidak
 * bisa mengubah User-Agent, jadi permintaan diteruskan lewat server kita
 * sendiri (`/api/faskes/cari-lokasi`) yang memasang header itu.
 */
export function useCariLokasi() {
  const [hasil, setHasil] = useState([])
  const [memuat, setMemuat] = useState(false)
  const [galat, setGalat] = useState(null)

  const cari = useCallback(async (kueri) => {
    const q = String(kueri ?? '').trim()
    if (q.length < 3) {
      setHasil([])
      setGalat(null)
      return
    }
    // Koordinat langsung ("-6.2, 106.8") tidak perlu dikirim ke mana pun.
    const koor = q.match(/^(-?\d+(?:[.,]\d+)?)\s*[,;]\s*(-?\d+(?:[.,]\d+)?)$/)
    if (koor) {
      const lat = Number(koor[1].replace(',', '.'))
      const lon = Number(koor[2].replace(',', '.'))
      if (Math.abs(lat) <= 90 && Math.abs(lon) <= 180) {
        setHasil([
          {
            nama: `${lat.toFixed(5)}, ${lon.toFixed(5)}`,
            alamat: 'Koordinat yang Anda masukkan',
            lat,
            lon,
          },
        ])
        setGalat(null)
        return
      }
    }

    setMemuat(true)
    setGalat(null)
    try {
      const res = await fetch(`/api/faskes/cari-lokasi?q=${encodeURIComponent(q)}`)
      const j = await res.json()
      if (!res.ok || !j.ok) {
        setGalat(j?.code ?? `http_${res.status}`)
        setHasil([])
        return
      }
      setHasil(Array.isArray(j.hasil) ? j.hasil : [])
      if (!j.hasil?.length) setGalat('tidak_ditemukan')
    } catch {
      setGalat('jaringan')
      setHasil([])
    } finally {
      setMemuat(false)
    }
  }, [])

  return { hasil, memuat, galat, cari, bersihkan: () => { setHasil([]); setGalat(null) } }
}
