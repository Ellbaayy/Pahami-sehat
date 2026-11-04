import { useCallback, useEffect, useMemo, useRef, useState } from 'react'

/**
 * Pengambil data fasilitas kesehatan (`/api/faskes`).
 *
 * ATURAN YANG DIPEGANG:
 *   - Koordinat SELALU berasal dari pengguna (GPS atau pencarian manual).
 *     Tidak ada koordinat cadangan; kalau belum ada lokasi, tidak ada permintaan.
 *   - Galat GPS dan galat server dibedakan, karena tindakan penggunaannya beda:
 *     GPS ditolak -> tawarkan pencarian manual; server gagal -> tawarkan coba lagi.
 *   - Simpanan menyimpan hasil per TITIK, bukan per radius.
 *
 * KENAPA SIMPANANNYA PER TITIK — ini cacat yang terukur, bukan kerapian:
 * setiap radius baru dulu berarti satu permintaan Overpass lagi, dan Overpass
 * publik menjawab 40–50 detik. Akibatnya menggeser pilihan radius dari 5 km ke
 * 1 km membuat pengguna menunggu satu menit untuk daftar yang SEBAGIAN BESAR
 * sudah ada di layar. Sekarang hasil disimpan per titik bersama radius yang
 * dicakupnya: memperkecil radius disaring di perangkat (seketika, tanpa
 * jaringan), memperbesar radius mengambil data baru. Datanya tetap data nyata
 * dari server — tidak ada fasilitas yang dikarang untuk mengisi daftar.
 */

const simpanan = new Map()

function kunciPusat(lat, lon) {
  return `${lat.toFixed(3)},${lon.toFixed(3)}`
}

/** Saring hasil yang sudah ada ke radius yang lebih kecil. */
function potongRadius(data, radius) {
  const semua = data.fasilitas ?? []
  const fasilitas = semua.filter((f) => f.jarakM <= radius)
  const perKategori = {}
  for (const f of fasilitas) perKategori[f.kategori] = (perKategori[f.kategori] ?? 0) + 1
  return {
    ...data,
    radius,
    fasilitas,
    jumlah: fasilitas.length,
    perKategori,
    /*
     * `dipotong` HARUS dihitung ulang, tidak boleh ikut dari `...data`.
     *
     * Setelah disaring ke radius lebih kecil, angka "yang tidak dimuat" milik
     * radius sebelumnya sudah tidak berlaku. Membiarkannya berarti layar
     * menampilkan "sisanya 123 tidak dimuat" untuk daftar yang sebenarnya
     * sudah lengkap di radius ini — pernyataan yang salah.
     *
     * Sisa yang benar = (yang di server tidak terkirim) + (yang tersaring
     * keluar karena radius lebih kecil).
     */
    dipotong: (data.dipotong ?? 0) + (semua.length - fasilitas.length),
    dariSimpanan: true,
  }
}

export function useFaskes() {
  const [lokasi, setLokasi] = useState(null) // {lat, lon, dari: 'gps'|'manual'|'nama'}
  const [statusLokasi, setStatusLokasi] = useState('idle') // idle|minta|ok|ditolak|galat|takdidukung
  const [radius, setRadius] = useState(5000)
  const [data, setData] = useState(null)
  const [memuat, setMemuat] = useState(false)
  const [galat, setGalat] = useState(null) // {code, pesan, keadaan}
  const pembatal = useRef(null)
  const titikTerakhir = useRef(null)

  /** Minta lokasi ke peramban. Tidak pernah memakai koordinat contoh. */
  const mintaLokasi = useCallback(() => {
    if (typeof navigator === 'undefined' || !navigator.geolocation) {
      setStatusLokasi('takdidukung')
      return
    }
    setStatusLokasi('minta')
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setLokasi({
          lat: pos.coords.latitude,
          lon: pos.coords.longitude,
          akurasi: pos.coords.accuracy ?? null,
          dari: 'gps',
        })
        setStatusLokasi('ok')
      },
      (err) => {
        // 1 = PERMISSION_DENIED, 2 = POSITION_UNAVAILABLE, 3 = TIMEOUT
        setStatusLokasi(err?.code === 1 ? 'ditolak' : 'galat')
      },
      { enableHighAccuracy: true, timeout: 12000, maximumAge: 60_000 },
    )
  }, [])

  /** Penetapan lokasi hasil pencarian manual (nama tempat / koordinat). */
  const setLokasiManual = useCallback((lat, lon, label = null, dari = 'manual', presisi = null) => {
    setLokasi({ lat, lon, label, dari, presisi })
    setStatusLokasi('ok')
  }, [])

  /** Ambil fasilitas untuk lokasi + radius saat ini. */
  const muat = useCallback(
    async (paksa = false) => {
      if (!lokasi) return
      const pusat = kunciPusat(lokasi.lat, lokasi.lon)

      if (!paksa) {
        const tersimpan = simpanan.get(pusat)
        // Radius yang diminta SUDAH tercakup hasil yang ada -> saring lokal.
        if (tersimpan && tersimpan.data.radius >= radius) {
          setData(
            tersimpan.data.radius === radius
              ? { ...tersimpan.data, dariSimpanan: true }
              : potongRadius(tersimpan.data, radius),
          )
          setGalat(null)
          return
        }
      }

      pembatal.current?.abort()
      const ac = new AbortController()
      pembatal.current = ac
      setMemuat(true)
      setGalat(null)
      try {
        const url = `/api/faskes?lat=${lokasi.lat}&lon=${lokasi.lon}&radius=${radius}`
        const res = await fetch(url, { signal: ac.signal })
        const j = await res.json()
        if (!res.ok || !j.ok) {
          // Jangan sisakan daftar milik TITIK LAIN di layar sambil menampilkan
          // galat — pengguna akan mengira daftar itu jawaban untuk lokasinya
          // sekarang. Daftar yang sah untuk titik yang sama boleh tetap tampil.
          if (titikTerakhir.current !== pusat) setData(null)
          setGalat({
            code: j?.code ?? `http_${res.status}`,
            pesan: j?.pesan ?? null,
            keadaan: j?.keadaan ?? [],
          })
          return
        }
        simpanan.set(pusat, { data: j })
        titikTerakhir.current = pusat
        setData(j)
      } catch (e) {
        if (e?.name === 'AbortError') return
        if (titikTerakhir.current !== pusat) setData(null)
        setGalat({ code: 'jaringan', pesan: null, keadaan: [] })
      } finally {
        setMemuat(false)
      }
    },
    [lokasi, radius],
  )

  useEffect(() => {
    muat(false)
    return () => pembatal.current?.abort()
  }, [muat])

  /** Daftar fasilitas mentah dari server (sudah terurut jarak). */
  const fasilitas = useMemo(() => data?.fasilitas ?? [], [data])

  return {
    lokasi,
    statusLokasi,
    radius,
    setRadius,
    data,
    fasilitas,
    memuat,
    galat,
    mintaLokasi,
    setLokasiManual,
    muatUlang: () => muat(true),
  }
}
