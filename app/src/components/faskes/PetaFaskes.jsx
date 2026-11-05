import { useEffect, useRef } from 'react'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'
import 'leaflet.markercluster'
import 'leaflet.markercluster/dist/MarkerCluster.css'
import 'leaflet.markercluster/dist/MarkerCluster.Default.css'
import { WARNA_KATEGORI, WARNA_LOKASI } from './kategoriWarna'

/** Sebutan titik asal sesuai sumbernya — dipakai sebagai tooltip penanda. */
const LABEL_SUMBER = {
  gps: 'Lokasi GPS Anda',
  alamat: 'Alamat yang Anda pilih',
  wilayah: 'Pusat wilayah yang Anda pilih (perkiraan)',
  nama: 'Lokasi yang Anda cari',
  /*
   * 'manual' = titik yang diketik/dipilih pengguna yang bukan hasil pencarian
   * alamat. Sejak 5 Nov 2026 titik yang diklik di peta dihapus, jadi penanda
   * ini hanya muncul untuk titik yang LABEL-nya memang datang dari pengguna;
   * label cadangan 'Titik yang Anda tentukan' sengaja tidak dipakai lagi untuk
   * alamat hasil geocoding (lihat efek penanda di bawah).
   */
  manual: 'Titik yang Anda tentukan',
}

/**
 * Peta fasilitas kesehatan — Leaflet + OpenStreetMap.
 *
 * KENAPA DIBUNGKUS KOMPONEN SENDIRI: Leaflet memegang DOM secara langsung
 * (bukan React). Kalau peta dibuat ulang tiap render, penanda berkedip dan
 * posisi peta melompat. Di sini peta dibuat SEKALI, lalu penanda dan pusat
 * diperbarui lewat efek yang terpisah.
 *
 * IKON: sengaja tidak memakai berkas gambar Leaflet bawaan (bug jalur aset di
 * bundler). Penanda digambar sebagai `divIcon` HTML sederhana — warnanya
 * berbeda per kategori supaya bisa dibedakan tanpa membaca label.
 */

function ikonPenanda(warna, kecil = false) {
  const ukuran = kecil ? 10 : 14
  return L.divIcon({
    className: 'faskes-pin',
    html: `<span style="display:block;width:${ukuran}px;height:${ukuran}px;border-radius:9999px;background:${warna};border:2px solid #fff;box-shadow:0 1px 4px rgba(15,30,51,.45)"></span>`,
    iconSize: [ukuran + 4, ukuran + 4],
    iconAnchor: [(ukuran + 4) / 2, (ukuran + 4) / 2],
  })
}

const IKON_LOKASI = L.divIcon({
  className: 'faskes-pin-lokasi',
  html: `<span style="display:block;width:16px;height:16px;border-radius:9999px;background:${WARNA_LOKASI};border:3px solid #fff;box-shadow:0 0 0 4px rgba(15,118,110,.28)"></span>`,
  iconSize: [22, 22],
  iconAnchor: [11, 11],
})

export default function PetaFaskes({ pusat, fasilitas = [], terpilih = null, onPilih, zoom = 14, rute = null }) {
  const wadahRef = useRef(null)
  const petaRef = useRef(null)
  const klasterRef = useRef(null)
  const lokasiRef = useRef(null)
  const garisRef = useRef(null)

  // ---- buat peta sekali ----
  useEffect(() => {
    if (!wadahRef.current || petaRef.current) return
    const peta = L.map(wadahRef.current, {
      center: pusat ? [pusat.lat, pusat.lon] : [-2.5, 118],
      zoom: pusat ? zoom : 5,
      zoomControl: true,
      scrollWheelZoom: true,
    })
    L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 19,
      attribution:
        '&copy; <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noreferrer">OpenStreetMap</a>',
    }).addTo(peta)

    klasterRef.current = L.markerClusterGroup({
      showCoverageOnHover: false,
      maxClusterRadius: 55,
      spiderfyOnMaxZoom: true,
      disableClusteringAtZoom: 17,
    })
    peta.addLayer(klasterRef.current)

    petaRef.current = peta
    return () => {
      peta.remove()
      petaRef.current = null
      klasterRef.current = null
      lokasiRef.current = null
    }
  }, [pusat, zoom])

  // ---- pusat & penanda lokasi pengguna ----
  useEffect(() => {
    const peta = petaRef.current
    if (!peta || !pusat) return
    peta.setView([pusat.lat, pusat.lon], Math.max(peta.getZoom(), zoom))
    if (lokasiRef.current) {
      lokasiRef.current.setLatLng([pusat.lat, pusat.lon])
      // Tooltip ikut diperbarui: pengguna bisa mengganti metode lokasi tanpa
      // peta dibuat ulang, dan label lama akan menyesatkan.
      lokasiRef.current.setTooltipContent(LABEL_SUMBER[pusat.dari] ?? 'Titik asal pencarian')
      return
    }
    lokasiRef.current = L.marker([pusat.lat, pusat.lon], {
      icon: IKON_LOKASI,
      keyboard: false,
      zIndexOffset: 1000,
    })
      .addTo(peta)
      /*
       * Label menyebut SUMBER titiknya, bukan selalu "Lokasi Anda".
       *
       * Titik asal bisa datang dari GPS, dari alamat yang diketik, atau dari
       * pusat wilayah administratif. Menulis "Lokasi Anda" untuk dua yang
       * terakhir adalah kebohongan kecil yang membuat pengguna mengira
       * aplikasi tahu posisi presisinya.
       */
      .bindTooltip(LABEL_SUMBER[pusat.dari] ?? 'Titik asal pencarian', {
        direction: 'top',
        offset: [0, -10],
      })
  }, [pusat, zoom])

  // ---- penanda fasilitas ----
  useEffect(() => {
    const peta = petaRef.current
    const klaster = klasterRef.current
    if (!peta || !klaster) return

    klaster.clearLayers()
    for (const f of fasilitas) {
      const warna = WARNA_KATEGORI[f.kategori] ?? '#334155'
      const m = L.marker([f.lat, f.lon], {
        icon: ikonPenanda(warna, f.id === terpilih),
        title: f.nama,
        keyboard: true,
      })
      m.bindTooltip(
        `<strong>${f.nama}</strong><br/>${f.subkategori ?? ''}${
          f.jarakM != null ? ` · ${Math.round(f.jarakM / 100) / 10} km` : ''
        }`,
        { direction: 'top', offset: [0, -8] },
      )
      m.on('click', () => onPilih?.(f))
      klaster.addLayer(m)
    }
    peta.addLayer(klaster)
  }, [fasilitas, terpilih, onPilih])

  // ---- terbangkan ke fasilitas terpilih ----
  useEffect(() => {
    const peta = petaRef.current
    if (!peta || !terpilih) return
    peta.flyTo([terpilih.lat, terpilih.lon], Math.max(peta.getZoom(), 16), {
      duration: 0.6,
    })
  }, [terpilih])

  // ---- garis rute ----
  useEffect(() => {
    const peta = petaRef.current
    if (!peta) return

    if (garisRef.current) {
      peta.removeLayer(garisRef.current)
      garisRef.current = null
    }
    if (!rute?.geometri?.length) return

    garisRef.current = L.polyline(rute.geometri, {
      // Warna sengaja kontras dengan penanda kategori (merah/biru/hijau) dan
      // dengan jalan peta yang abu-abu pucat.
      color: '#0e7490',
      weight: 6,
      opacity: 0.9,
      lineJoin: 'round',
      lineCap: 'round',
    }).addTo(peta)

    // Tampilkan seluruh perjalanan, bukan hanya salah satu ujungnya.
    try {
      peta.fitBounds(garisRef.current.getBounds(), { padding: [28, 28] })
    } catch {
      // bounds kosong (geometri 1 titik) bukan alasan menjatuhkan peta
    }
  }, [rute])

  return (
    <div
      ref={wadahRef}
      role="application"
      aria-label="Peta fasilitas kesehatan"
      className="h-full min-h-[18rem] w-full overflow-hidden rounded-2xl border border-line-200 bg-surface-100"
    />
  )
}
