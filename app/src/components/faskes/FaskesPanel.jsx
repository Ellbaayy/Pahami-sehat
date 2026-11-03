import { useCallback, useMemo, useState } from 'react'
import {
  Hospital,
  MapPin,
  LocateFixed,
  Search,
  Loader2,
  TriangleAlert,
  Navigation,
  Phone,
  Globe,
  Clock,
  ShieldCheck,
  X,
  RefreshCw,
  ExternalLink,
  Flag,
  Crosshair,
} from 'lucide-react'
import { Card, SectionHeading } from '../ui/primitives'
import PetaFaskes from './PetaFaskes'
import PemilihWilayah from './PemilihWilayah'
import PanelNavigasi from './PanelNavigasi'
import { WARNA_KATEGORI } from './kategoriWarna'
import { useFaskes } from '../../lib/useFaskes'
import { useCariLokasi } from '../../lib/useCariLokasi'
import { rapikanLayanan } from '../../lib/istilahLayanan'

/* --------------------------------------------------------------- konstan -- */

/**
 * Urutan filter kategori, sama dengan urutan yang diminta.
 *
 * Kunci kamusnya ditulis EKSPLISIT, bukan dirangkai `faskes.kat.${id}`:
 * `uji-bahasa.mjs` mencocokkan nama kunci secara harfiah, jadi kunci yang
 * dirangkai akan dilaporkan sebagai "menganggur" padahal dipakai.
 */
const FILTER_KATEGORI = [
  { id: 'semua', kunci: 'faskes.kat.semua' },
  { id: 'rumah-sakit', kunci: 'faskes.kat.rumah-sakit' },
  { id: 'puskesmas', kunci: 'faskes.kat.puskesmas' },
  { id: 'klinik', kunci: 'faskes.kat.klinik' },
  { id: 'praktik-mandiri', kunci: 'faskes.kat.praktik-mandiri' },
  { id: 'farmasi', kunci: 'faskes.kat.farmasi' },
  { id: 'laboratorium', kunci: 'faskes.kat.laboratorium' },
  { id: 'penunjang-medis', kunci: 'faskes.kat.penunjang-medis' },
  { id: 'kesehatan-masyarakat', kunci: 'faskes.kat.kesehatan-masyarakat' },
  { id: 'tradisional', kunci: 'faskes.kat.tradisional' },
  { id: 'khusus', kunci: 'faskes.kat.khusus' },
]

const PILIHAN_RADIUS = [1000, 3000, 5000, 10000, 25000, 50000]

const URUTAN = [
  { id: 'jarak-dekat', kunci: 'faskes.urut.jarak-dekat' },
  { id: 'jarak-jauh', kunci: 'faskes.urut.jarak-jauh' },
  { id: 'nama', kunci: 'faskes.urut.nama' },
]

const km = (m) => (m == null ? null : m < 1000 ? `${m} m` : `${(m / 1000).toFixed(1)} km`)

/** Label lokasi dari wilayah terpilih, dari yang paling rinci. */
function labelWilayah(w) {
  const bagian = [w.desa?.nama, w.kecamatan?.nama, w.kabupaten?.nama, w.provinsi?.nama].filter(Boolean)
  return bagian.length ? bagian.join(', ') : 'Wilayah terpilih'
}

/**
 * Fasilitas kesehatan terdekat.
 *
 * Data fasilitas berasal dari OpenStreetMap lewat Overpass API (lihat
 * `app/server/faskes.js`). Lokasi pengguna SELALU dari GPS peramban atau dari
 * pencarian manual yang dipilih sendiri — tidak pernah koordinat contoh.
 */
export default function FaskesPanel({ t = (k) => k, bahasa = 'id' }) {
  const {
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
    muatUlang,
  } = useFaskes()

  const cariLokasi = useCariLokasi()
  const [kategori, setKategori] = useState('semua')
  const [kueri, setKueri] = useState('')
  const [urutan, setUrutan] = useState('jarak-dekat')
  const [hanyaDarurat, setHanyaDarurat] = useState(false)
  const [terpilih, setTerpilih] = useState(null)
  const [kueriLokasi, setKueriLokasi] = useState('')
  // Titik referensi wilayah sedang diambil; dipakai untuk mematikan tombol.
  const [memuatTitik, setMemuatTitik] = useState(false)
  // Wilayah dipilih tetapi titik referensinya tidak ditemukan. Bukan galat
  // sistem — datanya memang tidak ada — jadi pesannya terpisah.
  const [titikGagal, setTitikGagal] = useState(false)
  // Fasilitas yang sedang dibuka petunjuk arahnya.
  const [navigasiKe, setNavigasiKe] = useState(null)
  // Rute aktif, diteruskan ke peta untuk menggambar garis.
  const [ruteAktif, setRuteAktif] = useState(null)

  /** Ambil titik referensi wilayah, lalu jadikan pusat pencarian. */
  const pakaiWilayah = useCallback(
    async (w) => {
      setMemuatTitik(true)
      setTitikGagal(false)
      try {
        const q =
          `/api/wilayah/titik?kode=${encodeURIComponent(w.kode)}` +
          `&provinsi=${encodeURIComponent(w.provinsi?.nama ?? '')}` +
          `&kabupaten=${encodeURIComponent(w.kabupaten?.nama ?? '')}` +
          `&kecamatan=${encodeURIComponent(w.kecamatan?.nama ?? '')}` +
          `&desa=${encodeURIComponent(w.desa?.nama ?? '')}`
        const res = await fetch(q)
        const j = await res.json()
        if (!res.ok || !j.ok) {
          // TIDAK mengarang koordinat: kalau titik referensi tidak ada,
          // pengguna diberi tahu dan diminta memilih wilayah lain.
          setTitikGagal(true)
          return
        }
        setLokasiManual(j.titik.lat, j.titik.lon, labelWilayah(w), 'wilayah', j.titik.presisi)
      } catch {
        setTitikGagal(true)
      } finally {
        setMemuatTitik(false)
      }
    },
    [setLokasiManual],
  )

  const labelKategori = useMemo(() => {
    const peta = {}
    for (const k of FILTER_KATEGORI) peta[k.id] = t(k.kunci)
    return peta
  }, [t])

  const tersaring = useMemo(() => {
    const q = kueri.trim().toLowerCase()
    let hasil = fasilitas
    if (kategori !== 'semua') hasil = hasil.filter((f) => f.kategori === kategori)
    if (hanyaDarurat) hasil = hasil.filter((f) => f.igd === true || f.buka24Jam)
    if (q) {
      hasil = hasil.filter((f) =>
        [f.nama, f.alamat, f.subkategori, f.layanan]
          .filter(Boolean)
          .some((x) => String(x).toLowerCase().includes(q)),
      )
    }
    const urut = [...hasil]
    if (urutan === 'jarak-dekat') urut.sort((a, b) => a.jarakM - b.jarakM)
    else if (urutan === 'jarak-jauh') urut.sort((a, b) => b.jarakM - a.jarakM)
    else urut.sort((a, b) => a.nama.localeCompare(b.nama, 'id'))
    return urut
  }, [fasilitas, kategori, kueri, urutan, hanyaDarurat])

  const jumlahDarurat = useMemo(
    () => fasilitas.filter((f) => f.igd === true || f.buka24Jam).length,
    [fasilitas],
  )

  const adaLokasi = Boolean(lokasi)

  return (
    <section aria-labelledby="faskes-judul" className="space-y-2">
      <SectionHeading
        as="h1"
        id="faskes-judul"
        eyebrow={t('faskes.eyebrow')}
        title={t('faskes.judul')}
        description={t('faskes.deskripsi')}
        action={
          <button
            type="button"
            onClick={mintaLokasi}
            className="inline-flex min-h-11 items-center gap-1.5 rounded-xl border border-line-200 bg-white px-3 text-[0.84rem] font-semibold text-navy-800 transition hover:border-brand-300 hover:text-brand-800"
          >
            <LocateFixed className="size-4" aria-hidden="true" />
            {adaLokasi ? t('faskes.perbaruiLokasi') : t('faskes.pakaiLokasi')}
          </button>
        }
      />

      <PemilihWilayah
        t={t}
        lokasiAktif={lokasi?.label ?? null}
        statusLokasi={statusLokasi}
        memuatTitik={memuatTitik}
        presisi={lokasi?.dari === 'wilayah' ? lokasi.presisi : null}
        onGps={mintaLokasi}
        onPilih={pakaiWilayah}
      />

      {titikGagal ? (
        <p className="rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-[0.82rem] leading-snug text-navy-800">
          {t('wil.titikGagal')}
        </p>
      ) : null}

      <LokasiBar
        t={t}
        lokasi={lokasi}
        statusLokasi={statusLokasi}
        onMinta={mintaLokasi}
        kueriLokasi={kueriLokasi}
        setKueriLokasi={setKueriLokasi}
        cariLokasi={cariLokasi}
        onPilihLokasi={(h) => {
          setLokasiManual(h.lat, h.lon, h.nama, 'nama')
          setKueriLokasi('')
          cariLokasi.bersihkan()
        }}
      />

      {adaLokasi ? (
        <>
          <FilterBar
            t={t}
            labelKategori={labelKategori}
            kategori={kategori}
            setKategori={setKategori}
            radius={radius}
            setRadius={setRadius}
            kueri={kueri}
            setKueri={setKueri}
            urutan={urutan}
            setUrutan={setUrutan}
            hanyaDarurat={hanyaDarurat}
            setHanyaDarurat={setHanyaDarurat}
            jumlahDarurat={jumlahDarurat}
          />

          {galat ? <KotakGalat t={t} galat={galat} onUlang={muatUlang} /> : null}

          <div className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.05fr)]">
            {/* peta */}
            <div className="order-1 h-[22rem] lg:order-2 lg:h-[calc(100vh-19.5rem)] lg:min-h-[24rem]">
              <PetaFaskes
                pusat={lokasi}
                fasilitas={tersaring}
                terpilih={terpilih}
                onPilih={setTerpilih}
                rute={ruteAktif}
              />
            </div>

            {/* daftar */}
            <div className="order-2 flex min-h-0 flex-col gap-2 lg:order-1 lg:h-[calc(100vh-19.5rem)] lg:min-h-[24rem]">
              <div className="flex items-center justify-between gap-2">
                <p className="text-[0.82rem] font-medium text-muted-500">
                  {/* Saat galat, JANGAN menulis "0 fasilitas ditemukan" — itu
                      menyatakan sumbernya menjawab "tidak ada", padahal
                      sumbernya tidak menjawab sama sekali. */}
                  {galat
                    ? t('faskes.gagalMuat')
                    : memuat
                      ? t('faskes.memuat')
                      : t('faskes.jumlah', { n: tersaring.length })}
                </p>
                {data?.dariSimpanan ? (
                  <span className="text-[0.74rem] text-muted-500">
                    {t('faskes.dariSimpanan')}
                  </span>
                ) : null}
              </div>
              {/* Pengambilan pertama dari Overpass diukur 40–48 detik. Diam selama
                  itu membuat pengguna mengira halamannya macet, jadi alasannya
                  disebut apa adanya — bukan dipura-pura cepat. */}
              {memuat ? (
                <p className="text-[0.76rem] leading-snug text-muted-500">
                  {t('faskes.memuatLama')}
                </p>
              ) : null}
              {/* Batas 600 fasilitas terdekat disebut terbuka: menyembunyikannya
                  membuat pengguna mengira 600 itu seluruh isi radius. */}
              {!memuat && !galat && data?.dipotong ? (
                <p className="text-[0.74rem] leading-snug text-muted-500">
                  {t('faskes.dipotong', { n: data.jumlah })}
                </p>
              ) : null}

              <ul className="min-h-0 flex-1 space-y-2 overflow-y-auto pr-1">
                {tersaring.slice(0, 80).map((f) => (
                  <li key={f.id}>
                    <KartuFaskes
                      t={t}
                      f={f}
                      aktif={terpilih?.id === f.id}
                      onPilih={() => setTerpilih(f)}
                    />
                  </li>
                ))}
                {!memuat && !galat && !tersaring.length ? (
                  <li>
                    <p className="rounded-2xl border border-line-200 bg-white px-4 py-6 text-center text-[0.86rem] text-muted-500">
                      {t('faskes.kosong')}
                    </p>
                  </li>
                ) : null}
              </ul>
            </div>
          </div>

          <SumberData t={t} data={data} />
        </>
      ) : (
        <Card className="p-4 text-center">
          <MapPin className="mx-auto size-7 text-brand-700" aria-hidden="true" />
          <p className="mt-2 text-[0.95rem] font-bold text-navy-900">{t('faskes.belumLokasi')}</p>
          <p className="mx-auto mt-1 max-w-[46ch] text-[0.86rem] leading-relaxed text-muted-500">
            {t('faskes.belumLokasiSub')}
          </p>
        </Card>
      )}

      {terpilih ? (
        <PanelDetail
          t={t}
          f={terpilih}
          onTutup={() => {
            setTerpilih(null)
            setNavigasiKe(null)
            setRuteAktif(null)
          }}
          onNavigasi={setNavigasiKe}
          adaLokasi={adaLokasi}
        />
      ) : null}

      {/* Petunjuk arah: hanya bisa dibuka kalau sudah ada lokasi asal. Tanpa
          asal, rute tidak bisa dihitung dan menampilkan panel kosong hanya
          membingungkan. */}
      {navigasiKe && lokasi ? (
        <PanelNavigasi
          t={t}
          asal={lokasi}
          tujuan={navigasiKe}
          onRute={setRuteAktif}
          bahasa={bahasa}
        />
      ) : null}
    </section>
  )
}

/* ------------------------------------------------------------ bagian UI -- */

function LokasiBar({
  t,
  lokasi,
  statusLokasi,
  onMinta,
  kueriLokasi,
  setKueriLokasi,
  cariLokasi,
  onPilihLokasi,
}) {
  const pesan =
    statusLokasi === 'ditolak'
      ? t('faskes.gpsDitolak')
      : statusLokasi === 'takdidukung'
        ? t('faskes.gpsTakDidukung')
        : statusLokasi === 'galat'
          ? t('faskes.gpsGalat')
          : null

  return (
    <Card className="p-3">
      <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
        <span className="inline-flex items-center gap-1.5 text-[0.84rem] font-semibold text-navy-800">
          <MapPin className="size-4 text-brand-700" aria-hidden="true" />
          {lokasi
            ? lokasi.label ?? t('faskes.lokasiTerdeteksi')
            : t('faskes.lokasiBelum')}
        </span>
        {lokasi ? (
          <span className="font-mono text-[0.76rem] text-muted-500">
            {lokasi.lat.toFixed(5)}, {lokasi.lon.toFixed(5)}
            {lokasi.dari === 'gps' ? ` · ${t('faskes.dariGps')}` : ''}
          </span>
        ) : (
          <button
            type="button"
            onClick={onMinta}
            className="inline-flex min-h-9 items-center gap-1.5 rounded-lg bg-brand-600 px-3 text-[0.82rem] font-semibold text-white hover:bg-brand-700"
          >
            <Crosshair className="size-3.5" aria-hidden="true" />
            {t('faskes.izinkanLokasi')}
          </button>
        )}
      </div>

      {pesan ? (
        <p className="mt-2 flex items-start gap-1.5 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-[0.8rem] leading-snug text-navy-800">
          <TriangleAlert className="mt-0.5 size-3.5 shrink-0 text-amber-600" aria-hidden="true" />
          {pesan}
        </p>
      ) : null}

      <form
        className="mt-2 flex flex-wrap items-center gap-2"
        onSubmit={(e) => {
          e.preventDefault()
          cariLokasi.cari(kueriLokasi)
        }}
      >
        <label htmlFor="cari-lokasi" className="sr-only">
          {t('faskes.cariLokasiLabel')}
        </label>
        <div className="flex min-w-0 flex-1 items-center gap-1.5 rounded-xl border border-line-200 bg-surface-100 px-3">
          <Search className="size-4 shrink-0 text-muted-400" aria-hidden="true" />
          <input
            id="cari-lokasi"
            value={kueriLokasi}
            onChange={(e) => setKueriLokasi(e.target.value)}
            placeholder={t('faskes.cariLokasi')}
            className="min-h-11 w-full bg-transparent text-[0.86rem] text-navy-900 outline-none placeholder:text-muted-400"
          />
        </div>
        <button
          type="submit"
          className="min-h-11 rounded-xl border border-line-200 bg-white px-3 text-[0.84rem] font-semibold text-navy-800 hover:border-brand-300 hover:text-brand-800"
        >
          {t('faskes.cari')}
        </button>
      </form>

      {cariLokasi.memuat ? (
        <p className="mt-2 inline-flex items-center gap-1.5 text-[0.8rem] text-muted-500">
          <Loader2 className="size-3.5 animate-spin" aria-hidden="true" />
          {t('faskes.mencariLokasi')}
        </p>
      ) : null}
      {cariLokasi.galat === 'tidak_ditemukan' ? (
        <p className="mt-2 text-[0.8rem] text-muted-500">{t('faskes.lokasiTidakDitemukan')}</p>
      ) : null}
      {cariLokasi.galat === 'jaringan' || cariLokasi.galat === 'lokasi_gagal' ? (
        <p className="mt-2 text-[0.8rem] text-amber-700">{t('faskes.lokasiGalatCari')}</p>
      ) : null}

      {cariLokasi.hasil.length ? (
        <ul className="mt-2 divide-y divide-line-200 overflow-hidden rounded-xl border border-line-200">
          {cariLokasi.hasil.map((h) => (
            <li key={`${h.lat},${h.lon}`}>
              <button
                type="button"
                onClick={() => onPilihLokasi(h)}
                className="flex w-full items-start gap-2 px-3 py-2 text-left hover:bg-surface-100"
              >
                <MapPin className="mt-0.5 size-3.5 shrink-0 text-brand-700" aria-hidden="true" />
                <span className="min-w-0">
                  <span className="block text-[0.85rem] font-semibold text-navy-900">{h.nama}</span>
                  <span className="block truncate text-[0.76rem] text-muted-500">{h.alamat}</span>
                </span>
              </button>
            </li>
          ))}
        </ul>
      ) : null}
    </Card>
  )
}

function FilterBar({
  t,
  labelKategori,
  kategori,
  setKategori,
  radius,
  setRadius,
  kueri,
  setKueri,
  urutan,
  setUrutan,
  hanyaDarurat,
  setHanyaDarurat,
  jumlahDarurat,
}) {
  return (
    <Card className="space-y-2.5 p-3">
      <div className="flex flex-wrap items-center gap-2">
        <label htmlFor="cari-faskes" className="sr-only">
          {t('faskes.cariFaskesLabel')}
        </label>
        <div className="flex min-w-[12rem] flex-1 items-center gap-1.5 rounded-xl border border-line-200 bg-surface-100 px-3">
          <Search className="size-4 shrink-0 text-muted-400" aria-hidden="true" />
          <input
            id="cari-faskes"
            value={kueri}
            onChange={(e) => setKueri(e.target.value)}
            placeholder={t('faskes.cariFaskes')}
            className="min-h-11 w-full bg-transparent text-[0.86rem] text-navy-900 outline-none placeholder:text-muted-400"
          />
          {kueri ? (
            <button
              type="button"
              onClick={() => setKueri('')}
              aria-label={t('faskes.hapusCari')}
              className="text-muted-400 hover:text-navy-700"
            >
              <X className="size-4" aria-hidden="true" />
            </button>
          ) : null}
        </div>

        <label htmlFor="radius" className="sr-only">
          {t('faskes.radius')}
        </label>
        <select
          id="radius"
          value={radius}
          onChange={(e) => setRadius(Number(e.target.value))}
          className="min-h-11 rounded-xl border border-line-200 bg-white px-2.5 text-[0.84rem] font-medium text-navy-800"
        >
          {PILIHAN_RADIUS.map((r) => (
            <option key={r} value={r}>
              {r / 1000} km
            </option>
          ))}
        </select>

        <label htmlFor="urutan" className="sr-only">
          {t('faskes.urutan')}
        </label>
        <select
          id="urutan"
          value={urutan}
          onChange={(e) => setUrutan(e.target.value)}
          className="min-h-11 rounded-xl border border-line-200 bg-white px-2.5 text-[0.84rem] font-medium text-navy-800"
        >
          {URUTAN.map((u) => (
            <option key={u.id} value={u.id}>
              {t(u.kunci)}
            </option>
          ))}
        </select>

        <button
          type="button"
          onClick={() => setHanyaDarurat((v) => !v)}
          aria-pressed={hanyaDarurat}
          className={`inline-flex min-h-11 items-center gap-1.5 rounded-xl border px-3 text-[0.82rem] font-semibold transition ${
            hanyaDarurat
              ? 'border-rose-300 bg-rose-50 text-rose-700'
              : 'border-line-200 bg-white text-navy-800 hover:border-rose-200 hover:text-rose-700'
          }`}
        >
          <ShieldCheck className="size-4" aria-hidden="true" />
          {t('faskes.darurat')}
          {jumlahDarurat ? (
            <span className="rounded-full bg-white/70 px-1.5 text-[0.7rem]">{jumlahDarurat}</span>
          ) : null}
        </button>
      </div>

      {/* Di HP, 11 chip yang membungkus jadi 5 baris mendorong peta dan daftar
          keluar layar (terukur 375×812). Karena itu di layar sempit chip
          digeser mendatar satu baris, dan baru dibungkus di layar lebar. */}
      <div className="-mx-1 flex snap-x gap-1.5 overflow-x-auto px-1 pb-1 sm:flex-wrap sm:overflow-visible">
        {FILTER_KATEGORI.map((k) => {
          const aktif = kategori === k.id
          const warna = WARNA_KATEGORI[k.id]
          return (
            <button
              key={k.id}
              type="button"
              onClick={() => setKategori(k.id)}
              aria-pressed={aktif}
              className={`inline-flex min-h-9 shrink-0 snap-start items-center gap-1.5 whitespace-nowrap rounded-full border px-2.5 text-[0.78rem] font-semibold transition ${
                aktif
                  ? 'border-brand-300 bg-brand-50 text-brand-800'
                  : 'border-line-200 bg-white text-navy-700 hover:border-brand-200'
              }`}
            >
              {warna ? (
                <span
                  aria-hidden="true"
                  className="size-2 rounded-full"
                  style={{ background: warna }}
                />
              ) : null}
              {labelKategori[k.id]}
            </button>
          )
        })}
      </div>
    </Card>
  )
}

function KartuFaskes({ t, f, aktif, onPilih }) {
  const warna = WARNA_KATEGORI[f.kategori] ?? '#334155'
  return (
    <button
      type="button"
      onClick={onPilih}
      aria-current={aktif ? 'true' : undefined}
      className={`w-full rounded-2xl border bg-white p-3 text-left transition ${
        aktif
          ? 'border-brand-400 shadow-[0_0_0_1px_rgba(15,118,110,.25)]'
          : 'border-line-200 hover:border-brand-200'
      }`}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="truncate text-[0.9rem] font-bold text-navy-900">{f.nama}</p>
          <p className="mt-0.5 flex items-center gap-1.5 text-[0.76rem] text-muted-500">
            <span className="size-2 rounded-full" style={{ background: warna }} aria-hidden="true" />
            {f.subkategori ?? t(`faskes.kat.${f.kategori}`)}
            {f.jarakM != null ? <span>· {km(f.jarakM)}</span> : null}
          </p>
        </div>
        <div className="flex shrink-0 flex-col items-end gap-1">
          {f.igd === true ? (
            <span className="rounded-full border border-rose-200 bg-rose-50 px-1.5 py-0.5 text-[0.68rem] font-bold text-rose-700">
              IGD
            </span>
          ) : null}
          {f.buka24Jam ? (
            <span className="rounded-full border border-emerald-200 bg-emerald-50 px-1.5 py-0.5 text-[0.68rem] font-bold text-emerald-700">
              24 jam
            </span>
          ) : null}
        </div>
      </div>
      {f.alamat ? (
        <p className="mt-1 line-clamp-2 text-[0.78rem] leading-snug text-muted-500">{f.alamat}</p>
      ) : null}
    </button>
  )
}

function KotakGalat({ t, galat, onUlang }) {
  const pesan =
    galat.code === 'sumber_gagal'
      ? t('faskes.galatSumber')
      : galat.code === 'jaringan'
        ? t('faskes.galatJaringan')
        : t('faskes.galatUmum')
  return (
    <div className="flex flex-wrap items-center gap-2 rounded-2xl border border-amber-200 bg-amber-50 px-3 py-2.5 text-[0.84rem] text-navy-800">
      <TriangleAlert className="size-4 shrink-0 text-amber-600" aria-hidden="true" />
      <span className="min-w-0 flex-1">{pesan}</span>
      <button
        type="button"
        onClick={onUlang}
        className="inline-flex min-h-9 items-center gap-1.5 rounded-lg border border-amber-300 bg-white px-2.5 text-[0.8rem] font-semibold text-amber-800"
      >
        <RefreshCw className="size-3.5" aria-hidden="true" />
        {t('faskes.cobaLagi')}
      </button>
    </div>
  )
}

function PanelDetail({ t, f, onTutup, onNavigasi, adaLokasi }) {
  const warna = WARNA_KATEGORI[f.kategori] ?? '#334155'
  return (
    <Card className="p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h2 className="text-[1rem] font-bold text-navy-900">{f.nama}</h2>
          <p className="mt-0.5 flex items-center gap-1.5 text-[0.8rem] text-muted-500">
            <span className="size-2 rounded-full" style={{ background: warna }} aria-hidden="true" />
            {f.subkategori ?? t(`faskes.kat.${f.kategori}`)}
            {f.jarakM != null ? <span>· {km(f.jarakM)}</span> : null}
          </p>
        </div>
        <button
          type="button"
          onClick={onTutup}
          aria-label={t('faskes.tutup')}
          className="rounded-lg p-1.5 text-muted-500 hover:bg-surface-100 hover:text-navy-800"
        >
          <X className="size-4" aria-hidden="true" />
        </button>
      </div>

      {/* Foto HANYA ditampilkan kalau memang ada di sumbernya. Tidak ada foto
          tiruan atau stok: gambar bangunan lain lebih menyesatkan daripada
          tidak ada gambar. */}
      {f.foto ? (
        <img
          src={f.foto}
          alt={f.nama}
          referrerPolicy="no-referrer"
          loading="lazy"
          className="mt-3 h-40 w-full rounded-xl object-cover"
        />
      ) : null}

      <dl className="mt-3 grid gap-x-4 gap-y-1.5 text-[0.84rem] sm:grid-cols-2">
        <Baris t={t} label={t('faskes.detail.alamat')}>{f.alamat ?? t('faskes.tidakAdaData')}</Baris>
        <Baris t={t} label={t('faskes.detail.wilayah')}>
          {[f.desa, f.kecamatan, f.kabupaten, f.provinsi].filter(Boolean).join(', ') ||
            t('faskes.tidakAdaData')}
        </Baris>
        <Baris t={t} label={t('faskes.detail.koordinat')}>
          <span className="font-mono text-[0.79rem]">
            {f.lat.toFixed(6)}, {f.lon.toFixed(6)}
          </span>
        </Baris>
        <Baris t={t} label={t('faskes.detail.telepon')}>{f.telepon ?? t('faskes.tidakAdaData')}</Baris>
        <Baris t={t} label={t('faskes.detail.jam')}>{f.jam ?? t('faskes.tidakAdaData')}</Baris>
        <Baris t={t} label={t('faskes.detail.layanan')}>
          {f.layanan ? rapikanLayanan(f.layanan) : t('faskes.tidakAdaData')}
        </Baris>
        {/* IGD & 24 jam: HANYA ditampilkan bila datanya ada. Kalau tidak, baris
            ini tidak muncul sama sekali — bukan "tidak ada IGD". */}
        <Baris t={t} label={t('faskes.detail.igd')}>
          {f.igd === true
            ? t('faskes.igdAda')
            : f.igd === false
              ? t('faskes.igdTidak')
              : t('faskes.tidakDiketahui')}
        </Baris>
        <Baris t={t} label={t('faskes.detail.email')}>{f.email ?? t('faskes.tidakAdaData')}</Baris>
        <Baris t={t} label={t('faskes.detail.sumber')}>{f.sumber}</Baris>
        <Baris t={t} label={t('faskes.detail.verifikasi')}>
          {f.status_verifikasi === 'terverifikasi'
            ? t('faskes.terverifikasi')
            : f.status_verifikasi === 'perlu_dicek'
              ? t('faskes.perluDicek')
              : t('faskes.belumDiverifikasi')}
        </Baris>
      </dl>

      <div className="mt-3 flex flex-wrap gap-2">
        <TautanTombol href={f.sumberUrl} Ikon={ExternalLink} t={t} teks={t('faskes.lihatLokasi')} />
        {/* Petunjuk Arah memakai panel rute sendiri (Valhalla), bukan tautan
            keluar ke OpenStreetMap: pengguna harus melihat jarak, waktu, dan
            instruksi per moda TANPA meninggalkan aplikasi. Tautan Google Maps
            tetap tersedia di dalam panel itu sebagai jalan keluar. */}
        <button
          type="button"
          onClick={() => onNavigasi?.(f)}
          disabled={!adaLokasi}
          title={adaLokasi ? undefined : t('rute.butuhLokasi')}
          className="inline-flex min-h-9 items-center gap-1.5 rounded-lg border border-line-200 bg-white px-2.5 text-[0.8rem] font-semibold text-navy-800 transition hover:border-brand-300 hover:text-brand-800 disabled:border-line-200 disabled:bg-surface-100 disabled:text-muted-400"
        >
          <Navigation className="size-3.5" aria-hidden="true" />
          {t('faskes.petunjukArah')}
        </button>
        {f.telepon ? (
          <TautanTombol
            href={
              // Telepon bisa memuat DUA nomor. `tel:` hanya menerima satu, dan
              // menyambung keduanya menghasilkan nomor palsu.
              `tel:${f.telepon.split(/[,;]/)[0].trim().replace(/[^\d+]/g, '')}`
            }
            Ikon={Phone}
            t={t}
            teks={t('faskes.hubungi')}
          />
        ) : null}
        {f.website ? (
          <TautanTombol href={f.website} Ikon={Globe} t={t} teks={t('faskes.website')} />
        ) : null}
        <TautanTombol
          href={`https://www.openstreetmap.org/${f.id}?note=${encodeURIComponent(
            'Laporkan informasi yang salah',
          )}`}
          Ikon={Flag}
          t={t}
          teks={t('faskes.laporkan')}
        />
      </div>

      <p className="mt-2 flex items-start gap-1.5 text-[0.75rem] leading-snug text-muted-500">
        <Clock className="mt-0.5 size-3 shrink-0" aria-hidden="true" />
        {t('faskes.catatanSumber')}
      </p>
    </Card>
  )
}

function Baris({ label, children }) {
  return (
    <div className="min-w-0">
      <dt className="text-[0.74rem] font-semibold uppercase tracking-wide text-muted-500">{label}</dt>
      <dd className="mt-0.5 break-words text-navy-800">{children}</dd>
    </div>
  )
}

function TautanTombol({ href, Ikon, teks }) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noreferrer noopener"
      className="inline-flex min-h-9 items-center gap-1.5 rounded-lg border border-line-200 bg-white px-2.5 text-[0.8rem] font-semibold text-navy-800 transition hover:border-brand-300 hover:text-brand-800"
    >
      <Ikon className="size-3.5" aria-hidden="true" />
      {teks}
    </a>
  )
}

/** Sumber data dan batasnya, disebut apa adanya. */
function SumberData({ t, data }) {
  if (!data) return null
  const diperiksa = data.diambilPada
    ? new Date(data.diambilPada).toLocaleString(t('umum.kodeLokal') === 'en-US' ? 'en-US' : 'id-ID', {
        day: 'numeric',
        month: 'long',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      })
    : null

  return (
    <Card className="p-3">
      <p className="flex items-center gap-1.5 text-[0.8rem] font-bold text-navy-900">
        <Hospital className="size-4 text-brand-700" aria-hidden="true" />
        {t('faskes.sumberJudul')}
      </p>
      <ul className="mt-1.5 space-y-1 text-[0.78rem] leading-snug text-muted-500">
        {data.sumber?.map((s) => (
          <li key={s.nama}>
            <span className="font-semibold text-navy-800">{s.nama}</span> ({s.lisensi}) —{' '}
            {s.keterangan}
          </li>
        ))}
        {data.sumberTidakTersedia?.map((s) => (
          <li key={s.nama}>
            <span className="font-semibold text-navy-800">{s.nama}</span> — {s.alasan}
          </li>
        ))}
        {diperiksa ? (
          <li>
            {t('faskes.diambilPada')}: {diperiksa}
          </li>
        ) : null}
      </ul>
    </Card>
  )
}
