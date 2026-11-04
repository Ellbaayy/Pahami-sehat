/**
 * Pemilih titik di peta — "klik peta untuk memilih lokasi".
 * ============================================================================
 *
 * KENAPA ADA, PADAHAL SUDAH ADA PENCARIAN ALAMAT
 * ----------------------------------------------
 * Ada alamat yang tidak bisa ditemukan geocoder: gang tanpa nama, rumah di
 * dalam kompleks, lokasi di area baru. Google Maps pun menyediakan jalan
 * keluar ini. Tanpa cara memilih titik langsung, pengguna seperti itu tidak
 * punya pilihan sama sekali selain memilih wilayah yang jauh lebih luas.
 *
 * ATURAN YANG DIPEGANG
 * --------------------
 * 1. Titiknya datang dari KLIK PENGGUNA, bukan dari tebakan.
 * 2. Alamat dan wilayahnya ditanyakan ke SERVER (`/api/alamat/titik`, geocoding
 *    balik). Klien tidak mengarang nama wilayah dari koordinat.
 * 3. Titik ini BELUM dipakai untuk mencari sampai pengguna menekan "Pakai
 *    titik ini". Tanpa langkah konfirmasi, setiap klik yang tidak disengaja
 *    akan memicu ulang seluruh pencarian fasilitas.
 */

import { useCallback, useEffect, useState } from 'react'
import { MapPin, Loader2, Check, X, TriangleAlert, Crosshair } from 'lucide-react'

export default function PemilihTitik({ t = (k) => k, onPakai, aktif, onAktif, onKlikPeta }) {
  const [titik, setTitik] = useState(null)
  const [alamat, setAlamat] = useState(null)
  const [wilayah, setWilayah] = useState(null)
  const [memuat, setMemuat] = useState(false)
  const [galat, setGalat] = useState(null)

  /**
   * Dipanggil peta setiap kali pengguna mengklik.
   *
   * Geocoding balik dijalankan di sini, dan SELALU: pengguna berhak melihat
   * alamat titik yang baru dipilih sebelum memakainya. Kalau layanannya gagal,
   * titik tetap bisa dipakai — koordinatnya sah — tetapi wilayahnya ditulis
   * tidak dikenali, bukan ditebak.
   */
  const saatKlik = useCallback(async ({ lat, lon }) => {
    setTitik({ lat, lon })
    setAlamat(null)
    setWilayah(null)
    setGalat(null)
    setMemuat(true)
    try {
      const res = await fetch(`/api/alamat/titik?lat=${lat}&lon=${lon}`)
      const j = await res.json()
      if (!res.ok || !j.ok) {
        setGalat(j?.code ?? `http_${res.status}`)
        return
      }
      setAlamat(j.alamat ?? null)
      setWilayah(j.wilayah ?? null)
    } catch {
      setGalat('jaringan')
    } finally {
      setMemuat(false)
    }
  }, [])

  /*
   * Daftarkan handler klik ke peta.
   *
   * Peta hidup di komponen lain (PetaFaskes), jadi handler harus DIANGKAT ke
   * induk lalu diteruskan ke sana. Alternatifnya — menaruh logika geocoding di
   * dalam peta — membuat peta tahu urusan API, batas yang tidak perlu
   * dilanggar.
   */
  useEffect(() => {
    onKlikPeta?.(aktif ? saatKlik : null)
  }, [aktif, saatKlik, onKlikPeta])

  const mulai = () => {
    onAktif?.(true)
    setTitik(null)
    setAlamat(null)
    setWilayah(null)
    setGalat(null)
  }

  const batal = () => {
    onAktif?.(false)
    setTitik(null)
    setAlamat(null)
    setWilayah(null)
    setGalat(null)
  }

  const pakai = () => {
    if (!titik) return
    onPakai?.({
      lat: titik.lat,
      lon: titik.lon,
      nama: alamat ?? t('lokasi.titikDipilih'),
      alamat,
      // Ketepatan "titik" karena pengguna menunjuk tepat di peta.
      ketepatan: 'titik',
      wilayah: wilayah ?? { dikenal: false },
      dariPeta: true,
    })
    batal()
  }

  if (!aktif) {
    return (
      <button
        type="button"
        onClick={mulai}
        className="inline-flex min-h-8 items-center gap-1.5 rounded-lg border border-line-200 bg-white px-2.5 text-[0.78rem] font-medium text-navy-700"
      >
        <Crosshair className="size-3.5" aria-hidden="true" />
        {t('lokasi.pilihTitikPeta')}
      </button>
    )
  }

  return (
    <div className="rounded-lg border border-brand-300 bg-brand-50/60 px-2.5 py-2">
      <div className="flex flex-wrap items-center justify-between gap-1.5">
        <p className="flex items-center gap-1.5 text-[0.78rem] font-semibold text-brand-900">
          <Crosshair className="size-3.5" aria-hidden="true" />
          {t('lokasi.pilihTitikAktif')}
        </p>
        <button
          type="button"
          onClick={batal}
          className="inline-flex min-h-7 items-center gap-1 rounded-md border border-line-200 bg-white px-2 text-[0.75rem] font-medium text-navy-700"
        >
          <X className="size-3" aria-hidden="true" />
          {t('lokasi.batalPilihTitik')}
        </button>
      </div>

      {!titik ? (
        <p className="mt-1 text-[0.74rem] leading-snug text-brand-800">{t('lokasi.pilihTitikPeta')}</p>
      ) : (
        <div className="mt-1.5">
          {memuat ? (
            <p className="flex items-center gap-1.5 text-[0.75rem] text-brand-800">
              <Loader2 className="size-3.5 animate-spin" aria-hidden="true" />
              {t('rs.memuat')}
            </p>
          ) : (
            <>
              <p className="flex items-start gap-1.5 text-[0.76rem] font-medium text-navy-900">
                <MapPin className="mt-0.5 size-3.5 shrink-0 text-brand-700" aria-hidden="true" />
                <span className="min-w-0">
                  {alamat ?? t('lokasi.titikDipilih')}
                  <span className="ml-1 font-normal text-muted-500">
                    ({titik.lat.toFixed(5)}, {titik.lon.toFixed(5)})
                  </span>
                </span>
              </p>

              {wilayah?.dikenal ? (
                <p className="mt-0.5 pl-5 text-[0.73rem] text-brand-800">
                  {[wilayah.kecamatan, wilayah.kabupaten, wilayah.provinsi].filter(Boolean).join(' · ')}
                </p>
              ) : (
                /* Wilayah tidak dikenali: DITULIS, bukan dikosongkan diam-diam.
                   Pengguna perlu tahu bahwa titiknya sah tetapi wilayahnya
                   tidak bisa dipastikan dari layanan. */
                <p className="mt-0.5 flex items-start gap-1.5 pl-5 text-[0.72rem] leading-snug text-amber-800">
                  <TriangleAlert className="mt-0.5 size-3 shrink-0" aria-hidden="true" />
                  {galat ? t('lokasi.layananMati') : t('lokasi.titikTanpaWilayah')}
                </p>
              )}
            </>
          )}

          <button
            type="button"
            onClick={pakai}
            disabled={memuat}
            className="mt-1.5 inline-flex min-h-8 items-center gap-1.5 rounded-lg bg-brand-700 px-2.5 text-[0.78rem] font-semibold text-white disabled:bg-surface-200 disabled:text-muted-400"
          >
            <Check className="size-3.5" aria-hidden="true" />
            {t('lokasi.pakaiTitikIni')}
          </button>
        </div>
      )}
    </div>
  )
}
