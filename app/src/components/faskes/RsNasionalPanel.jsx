/**
 * Pencarian Rumah Sakit Nasional (data resmi SIRS Kemenkes)
 * ============================================================================
 *
 * KENAPA PANEL TERPISAH DARI PETA
 * -------------------------------
 * Fitur "Fasilitas Kesehatan Terdekat" bekerja dengan radius di sekitar satu
 * titik, dan hanya bisa memuat fasilitas BERKOORDINAT. Data SIRS — 3.325 rumah
 * sakit resmi — tidak punya koordinat sama sekali (diukur 4 Nov 2026: daftar
 * nasional hanya berisi 9 field, halaman profil RS tidak memuat koordinat, dan
 * JS peta SIRS hanya berisi poligon provinsi).
 *
 * Menggabungkannya ke daftar radius berarti menampilkan rumah sakit seolah punya
 * titik akurat di peta. Karena itu panel ini memakai daftar + filter, dan
 * menyebut batasnya terbuka: "lokasi di peta tidak tersedia untuk data ini".
 *
 * Yang TIDAK dilakukan panel ini: mengarang koordinat dari alamat, atau
 * menyembunyikan rumah sakit yang tidak punya koordinat. Semuanya tampil.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Search, MapPin, Building2, Phone, ChevronLeft, ChevronRight, TriangleAlert, ExternalLink } from 'lucide-react'
import { Card } from '../ui/primitives'

const PER_HALAMAN = 25

/** Ambil JSON dengan penanganan galat yang menyebut sebabnya, bukan "gagal". */
async function ambilJson(url, signal) {
  const res = await fetch(url, { signal })
  const teks = await res.text()
  let j
  try {
    j = JSON.parse(teks)
  } catch {
    throw new Error(`balasan bukan JSON (HTTP ${res.status})`)
  }
  if (!res.ok || j?.ok === false) {
    throw new Error(j?.pesan || `HTTP ${res.status}`)
  }
  return j
}

const rupiah = (n) => (typeof n === 'number' ? n.toLocaleString('id-ID') : '–')

export default function RsNasionalPanel({ t = (k) => k }) {
  const [filter, setFilter] = useState(null)
  const [galatFilter, setGalatFilter] = useState(null)

  const [cari, setCari] = useState('')
  const [cariTertunda, setCariTertunda] = useState('')
  const [provinsi, setProvinsi] = useState('')
  const [kabupaten, setKabupaten] = useState('')
  const [jenis, setJenis] = useState('')
  const [kelas, setKelas] = useState('')
  const [kepemilikan, setKepemilikan] = useState('')
  const [halaman, setHalaman] = useState(1)

  const [hasil, setHasil] = useState(null)
  const [memuat, setMemuat] = useState(false)
  const [galat, setGalat] = useState(null)
  const [ringkasan, setRingkasan] = useState(null)
  const batalRef = useRef(null)

  /* ---------------------------------------------------------- filter ----- */
  useEffect(() => {
    const kendali = new AbortController()
    ambilJson('/api/rs/filter', kendali.signal)
      .then((j) => setFilter(j))
      .catch((e) => {
        if (e.name !== 'AbortError') setGalatFilter(e.message)
      })
    return () => kendali.abort()
  }, [])

  useEffect(() => {
    const kendali = new AbortController()
    ambilJson('/api/rs/ringkasan', kendali.signal)
      .then((j) => setRingkasan(j))
      .catch(() => null)
    return () => kendali.abort()
  }, [])

  /* ------------------------------------------------------ pencarian ----- */
  // Ketikan ditunda 350 ms: tanpa itu setiap huruf memicu satu permintaan, dan
  // hasil yang datang tidak berurutan membuat daftar berkedip ke hasil lama.
  useEffect(() => {
    const id = setTimeout(() => setCariTertunda(cari.trim()), 350)
    return () => clearTimeout(id)
  }, [cari])

  // Setiap perubahan filter mengembalikan tampilan ke halaman 1. Tanpa ini,
  // memfilter dari halaman 5 bisa menghasilkan halaman yang kosong.
  useEffect(() => {
    setHalaman(1)
  }, [cariTertunda, provinsi, kabupaten, jenis, kelas, kepemilikan])

  const muat = useCallback(async () => {
    batalRef.current?.abort()
    const kendali = new AbortController()
    batalRef.current = kendali
    setMemuat(true)
    setGalat(null)
    try {
      const p = new URLSearchParams()
      if (cariTertunda) p.set('cari', cariTertunda)
      if (provinsi) p.set('provinsi', provinsi)
      if (kabupaten) p.set('kabupaten', kabupaten)
      if (jenis) p.set('jenis', jenis)
      if (kelas) p.set('kelas', kelas)
      if (kepemilikan) p.set('kepemilikan', kepemilikan)
      p.set('halaman', String(halaman))
      p.set('perHalaman', String(PER_HALAMAN))
      const j = await ambilJson(`/api/rs?${p.toString()}`, kendali.signal)
      setHasil(j)
    } catch (e) {
      if (e.name !== 'AbortError') {
        setGalat(e.message)
        setHasil(null)
      }
    } finally {
      if (!kendali.signal.aborted) setMemuat(false)
    }
  }, [cariTertunda, provinsi, kabupaten, jenis, kelas, kepemilikan, halaman])

  useEffect(() => {
    muat()
  }, [muat])

  /* ------------------------------------------------------- turunan ----- */
  const daftarKabupaten = useMemo(() => {
    if (!filter?.kabupaten || !provinsi) return []
    return filter.kabupaten.filter((k) => k.provinsi === provinsi)
  }, [filter, provinsi])

  const adaFilter = Boolean(cariTertunda || provinsi || kabupaten || jenis || kelas || kepemilikan)

  const aturUlang = () => {
    setCari('')
    setProvinsi('')
    setKabupaten('')
    setJenis('')
    setKelas('')
    setKepemilikan('')
    setHalaman(1)
  }

  const totalHalaman = hasil?.jumlahHalaman ?? 1

  return (
    <div className="space-y-3">
      {/* Kepala: menjelaskan sumber & batasnya sekaligus, supaya tidak ada
          yang mengira daftar ini punya titik peta. */}
      <Card className="p-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <h2 className="flex items-center gap-2 text-[1.02rem] font-bold text-navy-900">
              <Building2 className="size-4 text-brand-600" aria-hidden="true" />
              {t('rs.judul')}
            </h2>
            <p className="mt-1 max-w-3xl text-[0.8rem] leading-snug text-muted-600">{t('rs.sumber')}</p>
          </div>
          {ringkasan ? (
            <div className="rounded-xl border border-line-200 bg-surface-50 px-3 py-2 text-[0.78rem] text-navy-800">
              <strong className="tabular-nums">{rupiah(ringkasan.total)}</strong> {t('rs.totalRs')}
              {ringkasan.berkoordinat === 0 ? (
                <span className="ml-2 text-muted-500">· {t('rs.tanpaKoordinatSemua')}</span>
              ) : null}
            </div>
          ) : null}
        </div>

        {/* Pencarian nama */}
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <div className="relative min-w-[15rem] flex-1">
            <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-400" aria-hidden="true" />
            <input
              type="search"
              value={cari}
              onChange={(e) => setCari(e.target.value)}
              placeholder={t('rs.cariNama')}
              aria-label={t('rs.cariNama')}
              className="min-h-11 w-full rounded-xl border border-line-200 bg-white pl-9 pr-3 text-[0.86rem] text-navy-900"
            />
          </div>
          {adaFilter ? (
            <button
              type="button"
              onClick={aturUlang}
              className="min-h-11 rounded-xl border border-line-200 bg-white px-3 text-[0.82rem] font-semibold text-navy-700"
            >
              {t('rs.aturUlang')}
            </button>
          ) : null}
        </div>

        {/* Filter bertingkat: provinsi dulu, kabupaten hanya muncul setelahnya */}
        <div className="mt-2 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
          <label className="block">
            <span className="mb-1 block text-[0.75rem] font-semibold text-muted-600">{t('rs.provinsi')}</span>
            <select
              value={provinsi}
              onChange={(e) => {
                setProvinsi(e.target.value)
                setKabupaten('')
              }}
              className="min-h-10 w-full rounded-xl border border-line-200 bg-white px-2.5 text-[0.83rem] text-navy-900"
            >
              <option value="">{t('rs.semuaProvinsi')}</option>
              {(filter?.provinsi ?? []).map((p) => (
                <option key={p.nilai} value={p.nilai}>
                  {p.nilai} ({p.jumlah})
                </option>
              ))}
            </select>
          </label>

          <label className="block">
            <span className="mb-1 block text-[0.75rem] font-semibold text-muted-600">{t('rs.kabupaten')}</span>
            <select
              value={kabupaten}
              onChange={(e) => setKabupaten(e.target.value)}
              disabled={!provinsi}
              className="min-h-10 w-full rounded-xl border border-line-200 bg-white px-2.5 text-[0.83rem] text-navy-900 disabled:bg-surface-100 disabled:text-muted-400"
            >
              <option value="">{provinsi ? t('rs.semuaKabupaten') : t('rs.pilihProvinsiDulu')}</option>
              {daftarKabupaten.map((k) => (
                <option key={k.kode} value={k.kode}>
                  {k.nama} ({k.jumlah})
                </option>
              ))}
            </select>
          </label>

          <label className="block">
            <span className="mb-1 block text-[0.75rem] font-semibold text-muted-600">{t('rs.jenis')}</span>
            <select
              value={jenis}
              onChange={(e) => setJenis(e.target.value)}
              className="min-h-10 w-full rounded-xl border border-line-200 bg-white px-2.5 text-[0.83rem] text-navy-900"
            >
              <option value="">{t('rs.semuaJenis')}</option>
              {(filter?.jenis ?? []).map((j) => (
                <option key={j.nilai} value={j.nilai}>
                  {j.nilai} ({j.jumlah})
                </option>
              ))}
            </select>
          </label>

          <label className="block">
            <span className="mb-1 block text-[0.75rem] font-semibold text-muted-600">{t('rs.kelas')}</span>
            <select
              value={kelas}
              onChange={(e) => setKelas(e.target.value)}
              className="min-h-10 w-full rounded-xl border border-line-200 bg-white px-2.5 text-[0.83rem] text-navy-900"
            >
              <option value="">{t('rs.semuaKelas')}</option>
              {(filter?.kelas ?? []).map((k) => (
                <option key={k.nilai} value={k.nilai}>
                  {k.nilai} ({k.jumlah})
                </option>
              ))}
            </select>
          </label>

          <label className="block">
            <span className="mb-1 block text-[0.75rem] font-semibold text-muted-600">{t('rs.kepemilikan')}</span>
            <select
              value={kepemilikan}
              onChange={(e) => setKepemilikan(e.target.value)}
              className="min-h-10 w-full rounded-xl border border-line-200 bg-white px-2.5 text-[0.83rem] text-navy-900"
            >
              <option value="">{t('rs.semuaKepemilikan')}</option>
              {(filter?.kepemilikan ?? []).map((k) => (
                <option key={k.nilai} value={k.nilai}>
                  {k.nilai} ({k.jumlah})
                </option>
              ))}
            </select>
          </label>
        </div>

        {galatFilter ? (
          <p className="mt-2 flex items-center gap-1.5 text-[0.76rem] text-amber-700">
            <TriangleAlert className="size-3.5" aria-hidden="true" />
            {galatFilter}
          </p>
        ) : null}
      </Card>

      {/* Hasil */}
      <Card className="p-0">
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-line-200 px-4 py-2.5">
          <p className="text-[0.84rem] font-medium text-navy-800">
            {galat ? (
              <span className="text-amber-700">{t('rs.gagal')}</span>
            ) : memuat && !hasil ? (
              t('rs.memuat')
            ) : hasil ? (
              t('rs.jumlah', { n: rupiah(hasil.total) })
            ) : (
              '—'
            )}
          </p>
          {hasil && totalHalaman > 1 ? (
            <div className="flex items-center gap-1.5 text-[0.78rem] text-muted-600">
              <button
                type="button"
                onClick={() => setHalaman((h) => Math.max(1, h - 1))}
                disabled={halaman <= 1 || memuat}
                aria-label={t('rs.sebelumnya')}
                className="inline-flex size-8 items-center justify-center rounded-lg border border-line-200 bg-white disabled:opacity-40"
              >
                <ChevronLeft className="size-4" aria-hidden="true" />
              </button>
              <span className="tabular-nums">
                {halaman} / {totalHalaman}
              </span>
              <button
                type="button"
                onClick={() => setHalaman((h) => Math.min(totalHalaman, h + 1))}
                disabled={halaman >= totalHalaman || memuat}
                aria-label={t('rs.berikutnya')}
                className="inline-flex size-8 items-center justify-center rounded-lg border border-line-200 bg-white disabled:opacity-40"
              >
                <ChevronRight className="size-4" aria-hidden="true" />
              </button>
            </div>
          ) : null}
        </div>

        {galat ? (
          <div className="px-4 py-6">
            <p className="text-[0.85rem] text-navy-800">{galat}</p>
            <p className="mt-1 text-[0.78rem] text-muted-500">{t('rs.galatDb')}</p>
            <button
              type="button"
              onClick={muat}
              className="mt-2 min-h-9 rounded-lg border border-line-200 bg-white px-3 text-[0.8rem] font-semibold text-navy-800"
            >
              {t('rs.cobaLagi')}
            </button>
          </div>
        ) : null}

        {!galat && hasil && !hasil.daftar.length ? (
          <p className="px-4 py-8 text-center text-[0.88rem] text-muted-500">{t('rs.kosong')}</p>
        ) : null}

        {!galat && hasil?.daftar?.length ? (
          <ul className="divide-y divide-line-200">
            {hasil.daftar.map((rs) => (
              <li key={rs.kode_rs} className="px-4 py-2.5">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="text-[0.9rem] font-semibold text-navy-900">{rs.nama}</p>
                    <p className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-[0.77rem] text-muted-600">
                      <span className="inline-flex items-center gap-1">
                        <MapPin className="size-3" aria-hidden="true" />
                        {[rs.kabupaten, rs.provinsi].filter(Boolean).join(', ')}
                      </span>
                      {rs.jenis_rs ? <span>· {rs.jenis_rs}</span> : null}
                      {rs.kelas_rs ? <span>· {t('rs.kelasLabel')} {rs.kelas_rs}</span> : null}
                      {rs.kepemilikan ? <span>· {rs.kepemilikan}</span> : null}
                    </p>
                    {rs.alamat ? <p className="mt-0.5 text-[0.76rem] leading-snug text-muted-500">{rs.alamat}</p> : null}
                    {/* Telepon hanya ditampilkan kalau ADA di sumber. SIRS
                        mengisi string kosong untuk banyak RS. */}
                    {rs.telepon ? (
                      <p className="mt-0.5 inline-flex items-center gap-1 text-[0.76rem] text-muted-600">
                        <Phone className="size-3" aria-hidden="true" />
                        <a href={`tel:${rs.telepon.replace(/[^\d+]/g, '')}`} className="underline underline-offset-2">
                          {rs.telepon}
                        </a>
                      </p>
                    ) : null}
                  </div>
                  <div className="flex shrink-0 flex-col items-end gap-1">
                    <span className="rounded-md bg-surface-100 px-1.5 py-0.5 font-mono text-[0.7rem] text-muted-600">
                      {rs.kode_rs}
                    </span>
                    {rs.adaKoordinat ? (
                      <span className="text-[0.7rem] text-emerald-700">{t('rs.adaKoordinat')}</span>
                    ) : (
                      <span className="text-[0.7rem] text-muted-400">{t('rs.tanpaKoordinat')}</span>
                    )}
                  </div>
                </div>
              </li>
            ))}
          </ul>
        ) : null}

        {hasil && totalHalaman > 1 ? (
          <div className="flex items-center justify-between gap-2 border-t border-line-200 px-4 py-2.5 text-[0.78rem] text-muted-600">
            <button
              type="button"
              onClick={() => setHalaman((h) => Math.max(1, h - 1))}
              disabled={halaman <= 1 || memuat}
              className="inline-flex min-h-8 items-center gap-1 rounded-lg border border-line-200 bg-white px-2 disabled:opacity-40"
            >
              <ChevronLeft className="size-3.5" aria-hidden="true" />
              {t('rs.sebelumnya')}
            </button>
            <span className="tabular-nums">
              {rupiah((halaman - 1) * PER_HALAMAN + 1)}–{rupiah(Math.min(halaman * PER_HALAMAN, hasil.total))}{' '}
              {t('rs.dari')} {rupiah(hasil.total)}
            </span>
            <button
              type="button"
              onClick={() => setHalaman((h) => Math.min(totalHalaman, h + 1))}
              disabled={halaman >= totalHalaman || memuat}
              className="inline-flex min-h-8 items-center gap-1 rounded-lg border border-line-200 bg-white px-2 disabled:opacity-40"
            >
              {t('rs.berikutnya')}
              <ChevronRight className="size-3.5" aria-hidden="true" />
            </button>
          </div>
        ) : null}
      </Card>

      <p className="flex items-start gap-1.5 px-1 text-[0.75rem] leading-snug text-muted-500">
        <ExternalLink className="mt-0.5 size-3 shrink-0" aria-hidden="true" />
        {t('rs.catatanSumber')}
      </p>
    </div>
  )
}
