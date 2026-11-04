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

/*
 * Titik yang BARU DIPILIH lewat klik peta — berbeda rupa dari titik asal,
 * karena maknanya berbeda: yang ini belum dipakai untuk mencari. Bentuknya
 * pin (bukan bulatan) supaya tidak tertukar dengan penanda fasilitas.
 */
const IKON_PILIHAN = L.divIcon({
  className: 'faskes-pin-pilihan',
  html: `<span style="display:block;width:14px;height:14px;border-radius:9999px 9999px 9999px 0;transform:rotate(-45deg);background:#b45309;border:2px solid #fff;box-shadow:0 1px 5px rgba(15,30,51,.5)"></span>`,
  iconSize: [18, 18],
  iconAnchor: [9, 16],
})

export default function PetaFaskes({
  pusat,
  fasilitas = [],
  terpilih = null,
  onPilih,
  zoom = 14,
  rute = null,
  /**
   * Mode "pilih titik di peta" (seperti Google Maps: klik peta -> titik baru).
   *
   * Saat aktif, setiap klik pada peta memanggil `onKlikPeta({lat, lon})` dan
   * SERVER yang menentukan alamat serta wilayahnya (geocoding balik). Peta
   * tidak menebak nama wilayah dari koordinat — itu pekerjaan geocoder, dan
   * hasilnya harus datang dari sumber, bukan dari perhitungan klien.
   */
  modePilihTitik = false,
  onKlikPeta = null,
  /** Titik yang sedang dipilih di peta tetapi belum dipakai sebagai asal. */
  titikPilihan = null,
}) {
  const wadahRef = useRef(null)
  const petaRef = useRef(null)
  const klasterRef = useRef(null)
  const lokasiRef = useRef(null)
  const garisRef = useRef(null)
  const pilihanRef = useRef(null)
  // Callback disimpan di ref supaya efek pembuatan peta tidak perlu bergantung
  // padanya — kalau tidak, setiap render ulang induk akan MEMBUAT ULANG peta
  // (penanda berkedip, posisi melompat).
  const klikRef = useRef(null)
  klikRef.current = onKlikPeta

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
      pilihanRef.current = null
    }
  }, [pusat, zoom])

  /* ---- klik peta: pilih titik (hanya saat mode aktif) ------------------ */
  useEffect(() => {
    const peta = petaRef.current
    if (!peta) return

    const saatKlik = (e) => {
      /*
       * Klik pada PENANDA tidak boleh dianggap "pilih titik baru".
       * Leaflet meneruskan klik penanda ke peta, jadi tanpa pemeriksaan ini
       * memilih fasilitas dari daftar sekaligus memindahkan titik asal —
       * perilaku yang membingungkan dan merusak data pencarian.
       */
      if (e.originalEvent?.target?.closest?.('.leaflet-marker-icon')) return
      if (e.originalEvent?.target?.closest?.('.leaflet-popup')) return
      klikRef.current?.({ lat: e.latlng.lat, lon: e.latlng.lng })
    }

    if (modePilihTitik) {
      peta.on('click', saatKlik)
      // Kursor berubah supaya pengguna tahu peta sekarang bisa diklik.
      const el = peta.getContainer()
      el.style.cursor = 'crosshair'
      return () => {
        peta.off('click', saatKlik)
        el.style.cursor = ''
      }
    }
    return undefined
  }, [modePilihTitik])

  /* ---- penanda titik pilihan (belum dipakai sebagai asal) -------------- */
  useEffect(() => {
    const peta = petaRef.current
    if (!peta) return

    if (pilihanRef.current) {
      peta.removeLayer(pilihanRef.current)
      pilihanRef.current = null
    }
    if (!titikPilihan) return

    pilihanRef.current = L.marker([titikPilihan.lat, titikPilihan.lon], {
      icon: IKON_PILIHAN,
      keyboard: false,
      zIndexOffset: 1200,
    })
      .addTo(peta)
      .bindTooltip('Titik yang dipilih', { direction: 'top', offset: [0, -12] })
  }, [titikPilihan])

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
