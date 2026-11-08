/**
 * Pencarian SELURUH fasilitas kesehatan nasional.
 * ============================================================================
 *
 * MENGGANTIKAN DUA TAB LAMA
 * -------------------------
 * Sampai 8 Nov 2026 halaman ini punya dua tab: "Fasilitas Terdekat" (radius
 * peta, hanya fasilitas berkoordinat) dan "Rumah Sakit Nasional" (3.325 RS
 * SIRS, tanpa koordinat). Tab radius DIHAPUS atas permintaan pemilik proyek;
 * yang tersisa satu daftar nasional yang mencakup SEMUA fasilitas yang kita
 * punya — 3.325 rumah sakit resmi Kemenkes + 4.098 fasilitas OpenStreetMap
 * (klinik, puskesmas, apotek, laboratorium, praktik mandiri, …).
 *
 * BATAS YANG DISEBUT TERBUKA
 * --------------------------
 * Sebagian besar data SIRS tidak punya koordinat. Baris seperti itu tetap
 * ditampilkan (dengan penanda "lokasi di peta belum tersedia"), TIDAK
 * disembunyikan dan TIDAK diberi koordinat karangan. Tombol petunjuk arah
 * hanya muncul untuk baris yang benar-benar punya koordinat.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Search, MapPin, Building2, Phone, ChevronLeft, ChevronRight, TriangleAlert, ExternalLink, Crosshair, RotateCcw } from 'lucide-react'
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

const angka = (n) => (typeof n === 'number' ? n.toLocaleString('id-ID') : '–')

/**
 * Kunci kamus ditulis HARFIAH, bukan dirangkai `faskes.kat.${kode}`.
 *
 * `uji-bahasa.mjs` mencocokkan nama kunci sebagai string di berkas sumber;
 * kunci yang dirangkai dilaporkan "menganggur" padahal dipakai, dan laporan
 * palsu itu membuat uji kamus tidak lagi dipercaya.
 */
const KATEGORI_LABEL = {
  'rumah-sakit': 'faskes.kat.rumah-sakit',
  puskesmas: 'faskes.kat.puskesmas',
  klinik: 'faskes.kat.klinik',
  'praktik-mandiri': 'faskes.kat.praktik-mandiri',
  farmasi: 'faskes.kat.farmasi',
  laboratorium: 'faskes.kat.laboratorium',
  'penunjang-medis': 'faskes.kat.penunjang-medis',
  'kesehatan-masyarakat': 'faskes.kat.kesehatan-masyarakat',
  tradisional: 'faskes.kat.tradisional',
  khusus: 'faskes.kat.khusus',
}

export default function FaskesNasionalPanel({ t = (k) => k }) {
  const [filter, setFilter] = useState(null)
  const [galatFilter, setGalatFilter] = useState(null)
  const [ringkasan, setRingkasan] = useState(null)

  const [cari, setCari] = useState('')
  const [cariTertunda, setCariTertunda] = useState('')
  const [kategori, setKategori] = useState('')
  const [provinsi, setProvinsi] = useState('')
  const [kabupaten, setKabupaten] = useState('')
  const [sumber, setSumber] = useState('')
  const [kelas, setKelas] = useState('')
  const [hanyaKoordinat, setHanyaKoordinat] = useState(false)
  const [halaman, setHalaman] = useState(1)

  const [hasil, setHasil] = useState(null)
  const [memuat, setMemuat] = useState(false)
  const [galat, setGalat] = useState(null)
  const batalRef = useRef(null)

  /* ---------------------------------------------------------- filter ----- */
  useEffect(() => {
    const kendali = new AbortController()
    ambilJson('/api/faskes/nasional/filter', kendali.signal)
      .then((j) => setFilter(j))
      .catch((e) => {
        if (e.name !== 'AbortError') setGalatFilter(e.message)
      })
    return () => kendali.abort()
  }, [])

  useEffect(() => {
    const kendali = new AbortController()
    ambilJson('/api/faskes/nasional/ringkasan', kendali.signal)
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
  }, [cariTertunda, kategori, provinsi, kabupaten, sumber, kelas, hanyaKoordinat])

  const muat = useCallback(async () => {
    batalRef.current?.abort()
    const kendali = new AbortController()
    batalRef.current = kendali
    setMemuat(true)
    setGalat(null)
    try {
      const p = new URLSearchParams()
      if (cariTertunda) p.set('cari', cariTertunda)
      if (kategori) p.set('kategori', kategori)
      if (provinsi) p.set('provinsi', provinsi)
      if (kabupaten) p.set('kabupaten', kabupaten)
      if (sumber) p.set('sumber', sumber)
      if (kelas) p.set('kelas', kelas)
      if (hanyaKoordinat) p.set('koordinat', '1')
      p.set('halaman', String(halaman))
      p.set('perHalaman', String(PER_HALAMAN))
      const j = await ambilJson(`/api/faskes/nasional?${p.toString()}`, kendali.signal)
      setHasil(j)
    } catch (e) {
      if (e.name !== 'AbortError') {
        setGalat(e.message)
        setHasil(null)
      }
    } finally {
      if (!kendali.signal.aborted) setMemuat(false)
    }
  }, [cariTertunda, kategori, provinsi, kabupaten, sumber, kelas, hanyaKoordinat, halaman])

  useEffect(() => {
    muat()
  }, [muat])

  /* ------------------------------------------------------- turunan ----- */
  const daftarKabupaten = useMemo(() => {
    if (!filter?.kabupaten || !provinsi) return []
    return filter.kabupaten.filter((k) => k.provinsi === provinsi)
  }, [filter, provinsi])

  const labelKategori = useMemo(() => {
    const peta = {}
    for (const k of filter?.kategori ?? []) peta[k.nilai] = k
    return peta
  }, [filter])

  const adaFilter = Boolean(cariTertunda || kategori || provinsi || kabupaten || sumber || kelas || hanyaKoordinat)

  const aturUlang = () => {
    setCari('')
    setKategori('')
    setProvinsi('')
    setKabupaten('')
    setSumber('')
    setKelas('')
    setHanyaKoordinat(false)
    setHalaman(1)
  }

  const totalHalaman = hasil?.jumlahHalaman ?? 1

  return (
    <div className="space-y-3">
      <Card className="p-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <h2 className="flex items-center gap-2 text-[1.02rem] font-bold text-navy-900">
              <Building2 className="size-4 text-brand-600" aria-hidden="true" />
              {t('faskesNasional.judul')}
            </h2>
            <p className="mt-1 max-w-3xl text-[0.8rem] leading-snug text-muted-600">{t('faskesNasional.sumber')}</p>
          </div>
          {ringkasan ? (
            <div className="rounded-xl border border-line-200 bg-surface-50 px-3 py-2 text-[0.78rem] text-navy-800">
              <strong className="tabular-nums">{angka(ringkasan.total)}</strong> {t('faskesNasional.totalFaskes')}
              <span className="ml-2 text-muted-500">
                · {angka(ringkasan.berkoordinat)} {t('faskesNasional.berkoordinat')}
              </span>
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
              placeholder={t('faskesNasional.cariNama')}
              aria-label={t('faskesNasional.cariNama')}
              className="min-h-11 w-full rounded-xl border border-line-200 bg-white pl-9 pr-3 text-[0.86rem] text-navy-900"
            />
          </div>
          {adaFilter ? (
            <button
              type="button"
              onClick={aturUlang}
              className="inline-flex min-h-11 items-center gap-1.5 rounded-xl border border-line-200 bg-white px-3 text-[0.82rem] font-semibold text-navy-700"
            >
              <RotateCcw className="size-3.5" aria-hidden="true" />
              {t('faskesNasional.aturUlang')}
            </button>
          ) : null}
        </div>

        {/* Filter: kategori dulu (pertanyaan paling sering), lalu wilayah. */}
        <div className="mt-2 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
          <label className="block">
            <span className="mb-1 block text-[0.75rem] font-semibold text-muted-600">{t('faskesNasional.kategori')}</span>
            <select
              value={kategori}
              onChange={(e) => setKategori(e.target.value)}
              className="min-h-10 w-full rounded-xl border border-line-200 bg-white px-2.5 text-[0.83rem] text-navy-900"
            >
              <option value="">{t('faskesNasional.semuaKategori')}</option>
              {(filter?.kategori ?? []).map((k) => (
                <option key={k.nilai} value={k.nilai}>
                  {KATEGORI_LABEL[k.nilai] ? t(KATEGORI_LABEL[k.nilai]) : k.nilai} ({k.jumlah})
                </option>
              ))}
            </select>
          </label>

          <label className="block">
            <span className="mb-1 block text-[0.75rem] font-semibold text-muted-600">{t('faskesNasional.provinsi')}</span>
            <select
              value={provinsi}
              onChange={(e) => {
                setProvinsi(e.target.value)
                setKabupaten('')
              }}
              className="min-h-10 w-full rounded-xl border border-line-200 bg-white px-2.5 text-[0.83rem] text-navy-900"
            >
              <option value="">{t('faskesNasional.semuaProvinsi')}</option>
              {(filter?.provinsi ?? []).map((p) => (
                <option key={p.nilai} value={p.nilai}>
                  {p.nilai} ({p.jumlah})
                </option>
              ))}
            </select>
          </label>

          <label className="block">
            <span className="mb-1 block text-[0.75rem] font-semibold text-muted-600">{t('faskesNasional.kabupaten')}</span>
            <select
              value={kabupaten}
              onChange={(e) => setKabupaten(e.target.value)}
              disabled={!provinsi}
              className="min-h-10 w-full rounded-xl border border-line-200 bg-white px-2.5 text-[0.83rem] text-navy-900 disabled:bg-surface-100 disabled:text-muted-400"
            >
              <option value="">{provinsi ? t('faskesNasional.semuaKabupaten') : t('faskesNasional.pilihProvinsiDulu')}</option>
              {daftarKabupaten.map((k) => (
                <option key={k.nama} value={k.nama}>
                  {k.nama} ({k.jumlah})
                </option>
              ))}
            </select>
          </label>

          <label className="block">
            <span className="mb-1 block text-[0.75rem] font-semibold text-muted-600">{t('faskesNasional.sumberLabel')}</span>
            <select
              value={sumber}
              onChange={(e) => setSumber(e.target.value)}
              className="min-h-10 w-full rounded-xl border border-line-200 bg-white px-2.5 text-[0.83rem] text-navy-900"
            >
              <option value="">{t('faskesNasional.semuaSumber')}</option>
              {(filter?.sumber ?? []).map((s) => (
                <option key={s.nilai} value={s.nilai}>
                  {s.nilai} ({s.jumlah})
                </option>
              ))}
            </select>
          </label>

          <label className="block">
            <span className="mb-1 block text-[0.75rem] font-semibold text-muted-600">{t('faskesNasional.kelas')}</span>
            <select
              value={kelas}
              onChange={(e) => setKelas(e.target.value)}
              className="min-h-10 w-full rounded-xl border border-line-200 bg-white px-2.5 text-[0.83rem] text-navy-900"
            >
              <option value="">{t('faskesNasional.semuaKelas')}</option>
              {(filter?.kelas ?? []).map((k) => (
                <option key={k.nilai} value={k.nilai}>
                  {k.nilai} ({k.jumlah})
                </option>
              ))}
            </select>
          </label>

          <label className="flex items-end gap-2 pb-1">
            <input
              type="checkbox"
              checked={hanyaKoordinat}
              onChange={(e) => setHanyaKoordinat(e.target.checked)}
              className="size-4 rounded border-line-300"
            />
            <span className="text-[0.82rem] text-navy-800">{t('faskesNasional.hanyaBerkoordinat')}</span>
          </label>
        </div>

        {galatFilter ? (
          <p className="mt-2 flex items-start gap-1.5 text-[0.78rem] text-rose-700">
            <TriangleAlert className="mt-0.5 size-3.5 shrink-0" aria-hidden="true" />
            {t('faskesNasional.filterGagal')}: {galatFilter}
          </p>
        ) : null}
      </Card>

      {/* Hasil */}
      {galat ? (
        <Card className="p-4">
          <p className="text-[0.85rem] text-rose-700">{galat}</p>
        </Card>
      ) : null}

      {memuat && !hasil ? (
        <Card className="p-4">
          <p className="text-[0.85rem] text-muted-600">{t('faskesNasional.memuat')}</p>
        </Card>
      ) : null}

      {hasil ? (
        <>
          <div className="flex flex-wrap items-center justify-between gap-2 px-1 text-[0.8rem] text-muted-600">
            <span aria-live="polite">
              {hasil.total === 0
                ? t('faskesNasional.tidakAda')
                : `${angka(hasil.total)} ${t('faskesNasional.hasil')} · ${t('faskesNasional.halaman')} ${hasil.halaman}/${totalHalaman}`}
            </span>
            {memuat ? <span className="text-brand-700">{t('faskesNasional.memperbarui')}</span> : null}
          </div>

          <ul className="space-y-2">
            {hasil.daftar.map((f) => (
              <li key={f.id}>
                <Card className="p-3">
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="text-[0.92rem] font-bold text-navy-900">{f.nama}</p>
                      <p className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[0.78rem] text-muted-600">
                        <span className="font-semibold text-brand-800">
                          {labelKategori[f.kategori_id]
                            ? (KATEGORI_LABEL[labelKategori[f.kategori_id].nilai]
                                ? t(KATEGORI_LABEL[labelKategori[f.kategori_id].nilai])
                                : labelKategori[f.kategori_id].nilai)
                            : (f.kategori ?? '–')}
                        </span>
                        {f.kelas_rs ? <span>· {f.kelas_rs}</span> : null}
                        {f.jenis_rs ? <span>· {f.jenis_rs}</span> : null}
                        {f.provinsi ? <span>· {f.provinsi}</span> : null}
                        {f.kabupaten && f.kabupaten !== f.provinsi ? <span>· {f.kabupaten}</span> : null}
                      </p>
                      {f.alamat ? <p className="mt-1 text-[0.78rem] leading-snug text-muted-500">{f.alamat}</p> : null}
                      {f.telepon ? (
                        <p className="mt-1 flex items-center gap-1.5 text-[0.78rem] text-navy-800">
                          <Phone className="size-3" aria-hidden="true" />
                          {f.telepon}
                        </p>
                      ) : null}
                    </div>

                    <div className="flex shrink-0 flex-wrap items-center gap-1.5">
                      {f.adaKoordinat ? (
                        <a
                          href={`https://www.google.com/maps/search/?api=1&query=${f.lat},${f.lon}`}
                          target="_blank"
                          rel="noreferrer noopener"
                          className="inline-flex min-h-9 items-center gap-1 rounded-lg border border-line-200 bg-white px-2.5 text-[0.78rem] font-semibold text-navy-800 transition hover:border-brand-300 hover:text-brand-800"
                        >
                          <MapPin className="size-3.5" aria-hidden="true" />
                          {t('faskesNasional.bukaPeta')}
                        </a>
                      ) : (
                        <span className="inline-flex min-h-9 items-center gap-1 rounded-lg border border-line-200 bg-surface-50 px-2.5 text-[0.75rem] text-muted-500">
                          <Crosshair className="size-3.5" aria-hidden="true" />
                          {t('faskesNasional.tanpaKoordinat')}
                        </span>
                      )}
                      {f.website ? (
                        <a
                          href={f.website}
                          target="_blank"
                          rel="noreferrer noopener"
                          className="inline-flex min-h-9 items-center gap-1 rounded-lg border border-line-200 bg-white px-2.5 text-[0.78rem] font-semibold text-navy-800 transition hover:border-brand-300 hover:text-brand-800"
                        >
                          <ExternalLink className="size-3.5" aria-hidden="true" />
                          {t('faskesNasional.situs')}
                        </a>
                      ) : null}
                    </div>
                  </div>
                </Card>
              </li>
            ))}
          </ul>

          {totalHalaman > 1 ? (
            <div className="flex items-center justify-center gap-2">
              <button
                type="button"
                onClick={() => setHalaman((h) => Math.max(1, h - 1))}
                disabled={hasil.halaman <= 1}
                className="inline-flex min-h-11 items-center gap-1 rounded-xl border border-line-200 bg-white px-3 text-[0.82rem] font-semibold text-navy-800 disabled:opacity-40"
              >
                <ChevronLeft className="size-4" aria-hidden="true" />
                {t('faskesNasional.sebelumnya')}
              </button>
              <span className="text-[0.82rem] tabular-nums text-muted-600">
                {hasil.halaman} / {totalHalaman}
              </span>
              <button
                type="button"
                onClick={() => setHalaman((h) => Math.min(totalHalaman, h + 1))}
                disabled={hasil.halaman >= totalHalaman}
                className="inline-flex min-h-11 items-center gap-1 rounded-xl border border-line-200 bg-white px-3 text-[0.82rem] font-semibold text-navy-800 disabled:opacity-40"
              >
                {t('faskesNasional.berikutnya')}
                <ChevronRight className="size-4" aria-hidden="true" />
              </button>
            </div>
          ) : null}
        </>
      ) : null}
    </div>
  )
}
