/**
 * Pencarian lokasi dengan dua cara: ketik alamat, atau pilih wilayah.
 * ============================================================================
 *
 * KENAPA DUA METODE DIPISAH JELAS
 * -------------------------------
 * Setiap metode menghasilkan titik asal dengan sifat yang berbeda, dan
 * mencampurnya membuat pengguna tidak tahu apa yang sedang dipakai:
 *
 *   - **Ketik alamat** -> koordinat hasil geocoding. Akurat sampai tingkat
 *     bangunan/jalan kalau sumbernya tahu; kalau sumbernya hanya tahu kota,
 *     titiknya pusat kota dan itu disebut terbuka.
 *   - **Pilih wilayah** -> titik referensi wilayah. Itu PERKIRAAN, bukan
 *     lokasi presisi, dan labelnya harus mengatakan begitu.
 *
 * Mengganti metode MENGOSONGKAN titik dari metode sebelumnya. Tidak pernah ada
 * campuran "koordinat dari alamat + label dari wilayah".
 */

import { useState } from 'react'
import { Search, MapPin, X, Loader2, TriangleAlert, Check, Map } from 'lucide-react'
import { useAlamat } from '../../lib/useAlamat'
import PemilihWilayah from './PemilihWilayah'

/** Nama tingkat ketepatan untuk ditampilkan apa adanya. */
const LABEL_KETEPATAN = {
  titik: 'ketepatan: titik/bangunan',
  jalan: 'ketepatan: jalan',
  kelurahan: 'ketepatan: kelurahan/desa',
  kecamatan: 'ketepatan: kecamatan',
  kabupaten: 'ketepatan: pusat kabupaten/kota',
  provinsi: 'ketepatan: pusat provinsi',
  lain: 'ketepatan: tidak diketahui',
}

export default function InputLokasi({
  t = (k) => k,
  lokasi,
  statusLokasi,
  memuatTitik,
  onAlamat, // (hasilGeocoding) => void  — koordinat dari geocoding
  onWilayah, // (wilayah) => void        — titik referensi wilayah
  onGps,
}) {
  const [metode, setMetode] = useState('alamat') // 'alamat' | 'wilayah'
  const a = useAlamat()

  const wilayahDipilih = lokasi?.dari === 'wilayah' ? lokasi : null
  const alamatDipilih = lokasi?.dari === 'alamat' ? lokasi : null

  const gantiMetode = (m) => {
    if (m === metode) return
    setMetode(m)
    // Titik dari metode lama DIBUANG, bukan disimpan diam-diam: kalau tidak,
    // pengguna pindah ke "pilih wilayah" tapi pencarian masih memakai
    // koordinat alamat sebelumnya.
    a.bersihkan()
    if (m === 'wilayah') onAlamat(null)
    else onWilayah(null)
  }

  const pilihSaran = (h) => {
    a.pilih(h)
    onAlamat(h)
  }

  return (
    <section
      aria-labelledby="input-lokasi-judul"
      className="rounded-2xl border border-line-200/80 bg-white p-3 shadow-sm"
    >
      <h2 id="input-lokasi-judul" className="sr-only">
        {t('lokasi.judul')}
      </h2>

      {/* Pemilih metode ------------------------------------------------- */}
      <div className="flex flex-wrap items-center gap-1.5">
        <div role="tablist" aria-label={t('lokasi.judul')} className="flex gap-1 rounded-lg bg-surface-100 p-0.5">
          <button
            type="button"
            role="tab"
            aria-selected={metode === 'alamat'}
            onClick={() => gantiMetode('alamat')}
            className={
              metode === 'alamat'
                ? 'inline-flex min-h-8 items-center gap-1 rounded-md bg-white px-2.5 text-[0.8rem] font-semibold text-brand-800 shadow-sm'
                : 'inline-flex min-h-8 items-center gap-1 rounded-md px-2.5 text-[0.8rem] font-medium text-navy-700'
            }
          >
            <Search className="size-3.5" aria-hidden="true" />
            {t('lokasi.ketikAlamat')}
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={metode === 'wilayah'}
            onClick={() => gantiMetode('wilayah')}
            className={
              metode === 'wilayah'
                ? 'inline-flex min-h-8 items-center gap-1 rounded-md bg-white px-2.5 text-[0.8rem] font-semibold text-brand-800 shadow-sm'
                : 'inline-flex min-h-8 items-center gap-1 rounded-md px-2.5 text-[0.8rem] font-medium text-navy-700'
            }
          >
            <Map className="size-3.5" aria-hidden="true" />
            {t('lokasi.pilihWilayah')}
          </button>
        </div>

        {/* GPS tetap tersedia, tetapi BUKAN satu-satunya cara. */}
        <button
          type="button"
          onClick={onGps}
          className="ml-auto inline-flex min-h-8 items-center gap-1 rounded-lg border border-line-200 bg-white px-2.5 text-[0.78rem] font-medium text-navy-700"
        >
          <MapPin className="size-3.5" aria-hidden="true" />
          {t('lokasi.pakaiGps')}
        </button>
      </div>

      {/* METODE 1: ketik alamat ---------------------------------------- */}
      {metode === 'alamat' ? (
        <div className="mt-2">
          <label htmlFor="input-alamat" className="sr-only">
            {t('lokasi.labelAlamat')}
          </label>
          <div className="relative">
            <Search
              className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-400"
              aria-hidden="true"
            />
            <input
              id="input-alamat"
              type="search"
              value={a.kueri}
              onChange={(e) => a.setKueri(e.target.value)}
              placeholder={t('lokasi.placeholder')}
              autoComplete="off"
              aria-describedby="alamat-bantuan"
              aria-expanded={a.saran.length > 0}
              aria-controls="alamat-saran"
              className="min-h-10 w-full rounded-lg border border-line-200 bg-white pl-9 pr-9 text-[0.85rem] text-navy-900 placeholder:text-muted-400"
            />
            {a.memuat ? (
              <Loader2 className="absolute right-3 top-1/2 size-4 -translate-y-1/2 animate-spin text-muted-400" aria-hidden="true" />
            ) : a.kueri ? (
              <button
                type="button"
                onClick={() => a.setKueri('')}
                aria-label={t('lokasi.hapus')}
                className="absolute right-2 top-1/2 -translate-y-1/2 rounded p-1 text-muted-400 hover:text-navy-700"
              >
                <X className="size-3.5" aria-hidden="true" />
              </button>
            ) : null}
          </div>

          <p id="alamat-bantuan" className="mt-1 text-[0.72rem] leading-snug text-muted-500">
            {t('lokasi.contohAlamat')}
          </p>

          {/* Saran ---------------------------------------------------- */}
          {a.saran.length > 0 ? (
            <div className="mt-1.5">
              {a.perluPilih ? (
                <p className="mb-1 flex items-center gap-1 text-[0.74rem] font-medium text-amber-800">
                  <TriangleAlert className="size-3.5" aria-hidden="true" />
                  {t('lokasi.pilihSalahSatu')}
                </p>
              ) : null}
              <ul
                id="alamat-saran"
                role="listbox"
                className="max-h-56 divide-y divide-line-200 overflow-y-auto rounded-lg border border-line-200 bg-white"
              >
                {a.saran.map((h, i) => {
                  const w = h.wilayah ?? {}
                  return (
                    <li key={`${h.lat}-${h.lon}-${i}`} role="option" aria-selected={false}>
                      <button
                        type="button"
                        onClick={() => pilihSaran(h)}
                        className="flex w-full items-start gap-2 px-2.5 py-2 text-left hover:bg-surface-50"
                      >
                        <MapPin className="mt-0.5 size-3.5 shrink-0 text-brand-600" aria-hidden="true" />
                        <span className="min-w-0">
                          <span className="block truncate text-[0.83rem] font-semibold text-navy-900">{h.nama}</span>
                          <span className="block text-[0.74rem] leading-snug text-muted-500">{h.alamat}</span>
                          <span className="mt-0.5 flex flex-wrap items-center gap-x-1.5 text-[0.71rem] text-muted-500">
                            {/* Wilayah ditampilkan SEBELUM pencarian dijalankan,
                                sesuai permintaan: pengguna melihat apa yang
                                dikenali sumber, bukan setelah menunggu. */}
                            {w.kecamatan ? <span>{w.kecamatan}</span> : null}
                            {w.kabupaten ? <span>· {w.kabupaten}</span> : null}
                            {w.provinsi ? <span>· {w.provinsi}</span> : null}
                            {!w.dikenal ? (
                              <span className="text-amber-700">· {t('lokasi.wilayahTidakDikenal')}</span>
                            ) : null}
                            <span className="text-muted-400">· {LABEL_KETEPATAN[h.ketepatan] ?? h.ketepatan}</span>
                          </span>
                        </span>
                      </button>
                    </li>
                  )
                })}
              </ul>
            </div>
          ) : null}

          {/* Galat layanan vs tidak ditemukan: dua hal berbeda --------- */}
          {a.galat ? (
            <p className="mt-1.5 flex items-start gap-1.5 rounded-lg border border-amber-200 bg-amber-50 px-2.5 py-1.5 text-[0.76rem] leading-snug text-amber-900">
              <TriangleAlert className="mt-0.5 size-3.5 shrink-0" aria-hidden="true" />
              {a.galat.code === 'kuota'
                ? t('lokasi.kuota')
                : a.galat.code === 'layanan_gagal' || a.galat.code === 'jaringan'
                  ? t('lokasi.layananMati')
                  : t('lokasi.tidakDitemukan')}
            </p>
          ) : null}

          {/* Titik yang sudah dipilih -------------------------------- */}
          {alamatDipilih ? (
            <div className="mt-2 rounded-lg border border-emerald-200 bg-emerald-50 px-2.5 py-2">
              <p className="flex items-start gap-1.5 text-[0.8rem] font-semibold text-emerald-900">
                <Check className="mt-0.5 size-3.5 shrink-0" aria-hidden="true" />
                <span className="min-w-0">
                  {alamatDipilih.label || t('lokasi.alamatTerpilih')}
                </span>
              </p>
              <p className="mt-0.5 pl-5 text-[0.74rem] leading-snug text-emerald-800">
                {alamatDipilih.lat.toFixed(5)}, {alamatDipilih.lon.toFixed(5)}
                {alamatDipilih.ketepatanText ? ` · ${alamatDipilih.ketepatanText}` : null}
              </p>
              <WilayahTerdeteksi t={t} wilayah={alamatDipilih.wilayah} />
            </div>
          ) : null}
        </div>
      ) : null}

      {/* METODE 2: pilih wilayah ---------------------------------------- */}
      {metode === 'wilayah' ? (
        <div className="mt-2">
          <PemilihWilayah
            t={t}
            lokasiAktif={wilayahDipilih?.label ?? null}
            statusLokasi={statusLokasi}
            memuatTitik={memuatTitik}
            presisi={wilayahDipilih?.presisi ?? null}
            onGps={onGps}
            onPilih={onWilayah}
          />
          {/* Sifat titik wilayah disebut terbuka: ini PERKIRAAN. */}
          <p className="mt-1 flex items-start gap-1.5 text-[0.73rem] leading-snug text-amber-800">
            <TriangleAlert className="mt-0.5 size-3.5 shrink-0" aria-hidden="true" />
            {t('lokasi.wilayahPerkiraan')}
          </p>
        </div>
      ) : null}
    </section>
  )
}

/** Tampilkan wilayah yang berhasil dikenali, APA ADANYA. */
function WilayahTerdeteksi({ t, wilayah }) {
  const w = wilayah ?? {}
  const baris = [
    ['Provinsi', w.provinsi],
    ['Kabupaten/Kota', w.kabupaten],
    ['Kecamatan', w.kecamatan],
    ['Kelurahan/Desa', w.kelurahan],
  ].filter(([, v]) => v)

  if (!w.dikenal) {
    return (
      <p className="mt-1 flex items-start gap-1.5 rounded-md bg-amber-100/70 px-2 py-1 text-[0.73rem] leading-snug text-amber-900">
        <TriangleAlert className="mt-0.5 size-3 shrink-0" aria-hidden="true" />
        {t('lokasi.wilayahTidakDikenalPanjang')}
      </p>
    )
  }

  return (
    <dl className="mt-1.5 grid grid-cols-[auto_1fr] gap-x-2 gap-y-0.5 pl-5 text-[0.73rem] leading-snug text-emerald-900">
      {baris.map(([k, v]) => (
        <div key={k} className="contents">
          <dt className="font-medium text-emerald-700">{k}</dt>
          <dd className="min-w-0">{v}</dd>
        </div>
      ))}
      {/* Kecamatan kosong BUKAN kelalaian: sumbernya memang tidak memberi
          kecamatan untuk titik ini. Mengosongkan barisnya lebih jujur daripada
          mengisinya dengan nama kabupaten. */}
      {!w.kecamatan ? (
        <div className="contents">
          <dt className="font-medium text-emerald-700">Kecamatan</dt>
          <dd className="text-emerald-700/80">{t('lokasi.tidakDiketahui')}</dd>
        </div>
      ) : null}
    </dl>
  )
}
