import { useEffect, useState } from 'react'
import { MapPin, LocateFixed, RotateCcw, Loader2 } from 'lucide-react'
import { Card } from '../ui/primitives'
import { useWilayah } from '../../lib/useWilayah'

/**
 * Pemilih lokasi bertingkat: Provinsi → Kota/Kabupaten → Kecamatan → Desa.
 *
 * Ini menjadi cara UTAMA menentukan lokasi. GPS tetap tersedia sebagai
 * alternatif, karena alasan paling umum orang membuka fitur ini adalah "saya
 * sedang di sini" — dan itu tidak boleh dihilangkan.
 *
 * PENTING: yang dipilih di sini adalah WILAYAH ADMINISTRATIF, bukan posisi
 * pengguna. Keterangan tentang itu ditampilkan di panel, bukan disembunyikan.
 */

/**
 * Kunci kamus tingkat presisi.
 *
 * Ditulis EKSPLISIT, bukan dirangkai `wil.tingkat.${presisi}`: uji-bahasa.mjs
 * mencocokkan nama kunci secara harfiah, jadi kunci yang dirangkai dilaporkan
 * "menganggur" padahal dipakai.
 */
const KUNCI_TINGKAT_LOCAL = {
  provinsi: 'wil.tingkat.provinsi',
  kabupaten: 'wil.tingkat.kabupaten',
  kecamatan: 'wil.tingkat.kecamatan',
  desa: 'wil.tingkat.desa',
}

const TINGKAT = [
  { id: 'provinsi', kunci: 'wil.provinsi' },
  { id: 'kabupaten', kunci: 'wil.kabupaten' },
  { id: 'kecamatan', kunci: 'wil.kecamatan' },
  { id: 'desa', kunci: 'wil.desa' },
]

export default function PemilihWilayah({
  t = (k) => k,
  onPilih,
  onGps,
  lokasiAktif = null,
  statusLokasi = 'idle',
  memuatTitik = false,
  presisi = null,
}) {
  const { pilihan, daftar, memuat, galat, muatProvinsi, pilih, aturUlang } = useWilayah()

  /*
   * Kartu ini terbuka saat belum ada lokasi (pengguna memang harus memilih),
   * lalu MELIPAT setelah lokasi aktif — karena 4 dropdown tidak perlu memakan
   * ruang terus-menerus sesudah pilihannya selesai. Diukur 1366×700: kartu
   * terbuka menambah ~208 px, versi melipat ~52 px.
   */
  const [terbuka, setTerbuka] = useState(!lokasiAktif)

  useEffect(() => {
    muatProvinsi()
  }, [muatProvinsi])

  const bolehPakai = Boolean(pilihan.kecamatan)

  if (!terbuka && lokasiAktif) {
    return (
      <Card className="p-2.5">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <p className="min-w-0 text-[0.82rem] text-muted-500">
            <MapPin className="mr-1 inline size-3.5 text-brand-700" aria-hidden="true" />
            {t('wil.aktif')}: <strong className="text-navy-800">{lokasiAktif}</strong>
          </p>
          <button
            type="button"
            onClick={() => setTerbuka(true)}
            className="inline-flex min-h-9 shrink-0 items-center gap-1.5 rounded-lg border border-line-200 bg-white px-2.5 text-[0.8rem] font-semibold text-navy-800 hover:border-brand-300"
          >
            <MapPin className="size-3.5" aria-hidden="true" />
            {t('wil.ubah')}
          </button>
        </div>
        {/* Keterangan presisi ikut di sini supaya tidak perlu kartu tersendiri:
            titik referensi kabupaten bukan posisi pengguna, dan itu harus
            tetap terbaca sesudah pemilih dilipat. */}
        {presisi ? (
          <p className="mt-1 text-[0.74rem] leading-snug text-muted-500">
            {t('wil.presisi', { tingkat: t(KUNCI_TINGKAT_LOCAL[presisi] ?? KUNCI_TINGKAT_LOCAL.kabupaten) })}
          </p>
        ) : null}
      </Card>
    )
  }

  return (
    <Card className="p-2.5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="inline-flex items-center gap-1.5 text-[0.84rem] font-semibold text-navy-800">
          <MapPin className="size-4 text-brand-700" aria-hidden="true" />
          {t('wil.judul')}
        </p>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => {
              aturUlang()
              muatProvinsi()
            }}
            className="inline-flex min-h-9 items-center gap-1.5 rounded-lg border border-line-200 bg-white px-2.5 text-[0.8rem] font-semibold text-navy-800 hover:border-brand-300"
          >
            <RotateCcw className="size-3.5" aria-hidden="true" />
            {t('wil.aturUlang')}
          </button>
          <button
            type="button"
            onClick={onGps}
            className="inline-flex min-h-9 items-center gap-1.5 rounded-lg border border-line-200 bg-white px-2.5 text-[0.8rem] font-semibold text-navy-800 hover:border-brand-300"
          >
            <LocateFixed className="size-3.5" aria-hidden="true" />
            {t('wil.pakaiGps')}
          </button>
        </div>
      </div>

      <p className="mt-1 text-[0.78rem] leading-snug text-muted-500">{t('wil.catatan')}</p>

      <div className="mt-2 grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
        {TINGKAT.map((tk, i) => {
          const indukAda = i === 0 || Boolean(pilihan[TINGKAT[i - 1].id])
          return (
            <label key={tk.id} className="min-w-0">
              <span className="block text-[0.74rem] font-semibold uppercase tracking-wide text-muted-500">
                {t(tk.kunci)}
              </span>
              <select
                value={pilihan[tk.id]?.kode ?? ''}
                disabled={!indukAda || Boolean(memuat[tk.id])}
                onChange={(e) => {
                  const w = daftar[tk.id].find((x) => x.kode === e.target.value) ?? null
                  pilih(tk.id, w)
                }}
                className="mt-0.5 min-h-11 w-full rounded-xl border border-line-200 bg-white px-2.5 text-[0.84rem] text-navy-900 disabled:bg-surface-100 disabled:text-muted-400"
              >
                <option value="">{t('wil.pilih')}</option>
                {daftar[tk.id].map((w) => (
                  <option key={w.kode} value={w.kode}>
                    {w.nama}
                  </option>
                ))}
              </select>
            </label>
          )
        })}
      </div>

      {galat ? (
        <p className="mt-2 text-[0.8rem] text-amber-700">{t('wil.galat')}</p>
      ) : null}

      {statusLokasi === 'ditolak' || statusLokasi === 'galat' || statusLokasi === 'takdidukung' ? (
        <p className="mt-2 text-[0.8rem] text-amber-700">
          {statusLokasi === 'ditolak'
            ? t('faskes.gpsDitolak')
            : statusLokasi === 'takdidukung'
              ? t('faskes.gpsTakDidukung')
              : t('faskes.gpsGalat')}
        </p>
      ) : null}

      <div className="mt-2 flex flex-wrap items-center gap-2">
        <button
          type="button"
          disabled={!bolehPakai || memuatTitik}
          onClick={async () => {
            await onPilih({
              kode: pilihan.desa?.kode ?? pilihan.kecamatan?.kode,
              tingkat: pilihan.desa ? 'desa' : 'kecamatan',
              provinsi: pilihan.provinsi,
              kabupaten: pilihan.kabupaten,
              kecamatan: pilihan.kecamatan,
              desa: pilihan.desa,
            })
            setTerbuka(false)
          }}
          className="inline-flex min-h-11 items-center gap-1.5 rounded-xl bg-brand-600 px-3 text-[0.84rem] font-semibold text-white hover:bg-brand-700 disabled:bg-surface-200 disabled:text-muted-400"
        >
          {memuatTitik ? <Loader2 className="size-4 animate-spin" aria-hidden="true" /> : null}
          {t('wil.gunakan')}
        </button>

        {lokasiAktif ? (
          <span className="min-w-0 text-[0.78rem] text-muted-500">
            {t('wil.aktif')}: <strong className="text-navy-800">{lokasiAktif}</strong>
          </span>
        ) : null}
      </div>
    </Card>
  )
}
