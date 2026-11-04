import { useEffect } from 'react'
import {
  Footprints,
  Bike,
  Car,
  Navigation,
  ExternalLink,
  RefreshCw,
  Loader2,
  TriangleAlert,
} from 'lucide-react'
import { Card } from '../ui/primitives'
import { useRute } from '../../lib/useRute'

/**
 * Panel petunjuk arah.
 *
 * Tiga moda memanggil server dengan costing berbeda (pedestrian /
 * motor_scooter / auto). Diukur 4 Nov 2026 untuk rute Monas -> RSPAD:
 * jalan kaki 2,14 km, motor 4,54 km, mobil 4,54 km dengan waktu berbeda.
 * Jadi hasilnya memang berubah, bukan cuma ikonnya.
 */

const MODA = [
  { id: 'jalan-kaki', Ikon: Footprints, kunci: 'rute.jalanKaki' },
  { id: 'motor', Ikon: Bike, kunci: 'rute.motor' },
  { id: 'mobil', Ikon: Car, kunci: 'rute.mobil' },
]

export default function PanelNavigasi({ t = (k) => k, asal, tujuan, onRute, bahasa = 'id' }) {
  const { rute, moda, memuat, galat, hitung } = useRute(bahasa)

  // Hitung sekali saat panel dibuka; `hitung` stabil (useCallback tanpa dep).
  useEffect(() => {
    if (asal && tujuan) {
      hitung({
        latAsal: asal.lat,
        lonAsal: asal.lon,
        latTujuan: tujuan.lat,
        lonTujuan: tujuan.lon,
      })
    }
  }, [asal, tujuan, hitung])

  // Teruskan ke peta supaya garis rute ikut tergambar.
  useEffect(() => {
    onRute?.(rute)
  }, [rute, onRute])

  const gantiModa = (m) =>
    hitung({
      latAsal: asal.lat,
      lonAsal: asal.lon,
      latTujuan: tujuan.lat,
      lonTujuan: tujuan.lon,
      modaBaru: m,
    })

  const asalWilayah = asal?.dari === 'wilayah'

  return (
    <Card className="p-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="inline-flex items-center gap-1.5 text-[0.84rem] font-bold text-navy-900">
          <Navigation className="size-4 text-brand-700" aria-hidden="true" />
          {t('rute.judul')}
        </p>
        <div className="flex gap-1.5" role="group" aria-label={t('rute.moda')}>
          {MODA.map(({ id, Ikon, kunci }) => (
            <button
              key={id}
              type="button"
              onClick={() => gantiModa(id)}
              aria-pressed={moda === id}
              className={`inline-flex min-h-9 items-center gap-1.5 rounded-lg border px-2.5 text-[0.8rem] font-semibold ${
                moda === id
                  ? 'border-brand-300 bg-brand-50 text-brand-800'
                  : 'border-line-200 bg-white text-navy-800 hover:border-brand-200'
              }`}
            >
              <Ikon className="size-3.5" aria-hidden="true" />
              {t(kunci)}
            </button>
          ))}
        </div>
      </div>

      {/*
        Asal dibedakan terus terang: GPS pengguna vs titik referensi wilayah.
        Menyamakan keduanya akan membuat estimasi perjalanan tampak berasal dari
        posisi rumah pengguna, padahal hanya dari pusat wilayah.
      */}
      <p className="mt-1 text-[0.76rem] leading-snug text-muted-500">
        {asalWilayah ? t('rute.asalWilayah') : t('rute.asalGps')}
      </p>

      {memuat ? (
        <p className="mt-2 inline-flex items-center gap-1.5 text-[0.82rem] text-muted-500">
          <Loader2 className="size-3.5 animate-spin" aria-hidden="true" />
          {t('rute.menghitung')}
        </p>
      ) : null}

      {galat ? (
        <div className="mt-2 flex flex-wrap items-center gap-2 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-[0.82rem] text-navy-800">
          <TriangleAlert className="size-4 shrink-0 text-amber-600" aria-hidden="true" />
          <span className="min-w-0 flex-1">{t('rute.galat')}</span>
          <button
            type="button"
            onClick={() => gantiModa(moda)}
            className="inline-flex min-h-9 items-center gap-1.5 rounded-lg border border-amber-300 bg-white px-2.5 text-[0.8rem] font-semibold text-amber-800"
          >
            <RefreshCw className="size-3.5" aria-hidden="true" />
            {t('faskes.cobaLagi')}
          </button>
        </div>
      ) : null}

      {rute && !rute.gagal ? (
        <>
          <p className="mt-2 text-[0.9rem] font-semibold text-navy-900">
            {/*
             * Waktu < 1 menit ditulis "kurang dari 1 menit" lewat kunci
             * TERPISAH, bukan dengan menyisipkan teks ke dalam templat
             * `rute.ringkas`.
             *
             * Alasannya: templat itu berbunyi '{jarak} km · sekitar {menit}
             * menit'. Menyisipkan "kurang dari 1 menit" ke dalamnya
             * menghasilkan "sekitar kurang dari 1 menit menit" — dua kata
             * "menit" dan satu "sekitar" yang salah.
             *
             * Terukur: rute 140 m dulu tampil "sekitar 0 menit".
             */}
            {Number(rute.waktuMenit ?? 0) < 1
              ? t('rute.ringkasKurangSatuMenit', { jarak: Number(rute.jarakKm ?? 0).toFixed(2) })
              : t('rute.ringkas', {
                  jarak: Number(rute.jarakKm ?? 0).toFixed(2),
                  menit: Math.round(Number(rute.waktuMenit ?? 0)),
                })}
          </p>
          <p className="text-[0.74rem] leading-snug text-muted-500">{t('rute.catatanWaktu')}</p>

          {rute.langkah?.length ? (
            <ol className="mt-2 max-h-56 space-y-1 overflow-y-auto pr-1 text-[0.82rem] text-navy-800">
              {rute.langkah.map((l, i) => (
                <li key={`${i}-${l.instruksi.slice(0, 12)}`} className="flex gap-2">
                  <span className="w-5 shrink-0 text-right font-mono text-[0.72rem] text-muted-500">
                    {i + 1}
                  </span>
                  <span className="min-w-0">{l.instruksi}</span>
                </li>
              ))}
            </ol>
          ) : null}
        </>
      ) : null}

      {rute?.googleMaps ? (
        <a
          href={rute.googleMaps}
          target="_blank"
          rel="noreferrer noopener"
          className="mt-2 inline-flex min-h-9 items-center gap-1.5 rounded-lg border border-line-200 bg-white px-2.5 text-[0.8rem] font-semibold text-navy-800 hover:border-brand-300"
        >
          <ExternalLink className="size-3.5" aria-hidden="true" />
          {t('rute.googleMaps')}
        </a>
      ) : null}
    </Card>
  )
}
