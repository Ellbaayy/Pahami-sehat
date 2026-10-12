import { useCallback, useEffect, useRef, useState } from 'react'
import {
  Camera,
  FileText,
  ImageUp,
  Loader2,
  RotateCcw,
  ScanText,
  Trash2,
  TriangleAlert,
  X,
} from 'lucide-react'
import { Button } from '../ui/primitives'
import {
  MAKS_BYTE,
  MIN_KARAKTER,
  hentikanMesin,
  periksaAngkaMencurigakan,
  pesanProgres,
  pindaiFoto,
} from '../../lib/ocr'
import { cn } from '../../lib/cn'

/**
 * Pemindai foto — membaca teks dari foto (label obat, hasil lab, resep, chat).
 *
 * Dulu ini halaman tersendiri (ScanPanel). Sekarang menjadi bagian dari kotak
 * isian Tanya AI: hasil pembacaannya TIDAK dikirim ke mana pun sendiri,
 * melainkan ditaruh di kotak isian lewat `onTeks` supaya pengguna memeriksa
 * dan membetulkannya lebih dulu. Pengiriman ke AI tetap keputusan pengguna,
 * lewat tombol kirim yang sama seperti pertanyaan yang diketik.
 *
 * Seluruh pembacaan terjadi di peramban. Tidak ada satu pun permintaan jaringan
 * yang dikirim saat memindai, jadi foto pengguna tidak pernah meninggalkan
 * perangkatnya. Karena itu bagian ini tetap berguna walau server AI sedang mati.
 */

/** Batas teks yang boleh diteruskan — sama dengan batas rutenya. */
const MAKS_TANYA = 4000

const CONTOH_BANTUAN = ['pindai.tips1', 'pindai.tips2', 'pindai.tips3']

export default function PemindaiFoto({
  t = (k) => k,
  onTeks,
  onTutup,
  teksKomposer = '',
  serverOnline = true,
  bahasa = 'id',
}) {
  const [berkas, setBerkas] = useState(null)
  const [pratinjau, setPratinjau] = useState('')
  const [loading, setLoading] = useState(false)
  const [progres, setProgres] = useState({ persen: 0, pesan: '' })
  const [hasil, setHasil] = useState(null)
  const [error, setError] = useState(null)
  const [seret, setSeret] = useState(false)

  const inputRef = useRef(null)
  const kameraRef = useRef(null)
  const batalRef = useRef(null)
  const urlRef = useRef('')

  // bebaskan object URL pratinjau saat komponen dilepas
  useEffect(
    () => () => {
      if (urlRef.current) URL.revokeObjectURL(urlRef.current)
    },
    [],
  )

  const pilihBerkas = useCallback((f) => {
    if (!f) return
    if (urlRef.current) URL.revokeObjectURL(urlRef.current)
    const url = URL.createObjectURL(f)
    urlRef.current = url
    setBerkas(f)
    setPratinjau(url)
    setHasil(null)
    setError(null)
    setProgres({ persen: 0, pesan: '' })
  }, [])

  const bersihkan = useCallback(() => {
    if (urlRef.current) URL.revokeObjectURL(urlRef.current)
    urlRef.current = ''
    setBerkas(null)
    setPratinjau('')
    setHasil(null)
    setError(null)
    setProgres({ persen: 0, pesan: '' })
    if (inputRef.current) inputRef.current.value = ''
    if (kameraRef.current) kameraRef.current.value = ''
  }, [])

  const pindai = async () => {
    if (!berkas || loading) return
    setLoading(true)
    setError(null)
    setHasil(null)
    setProgres({ persen: 0, pesan: t('pindai.menyiapkan') })

    const ac = new AbortController()
    batalRef.current = ac

    try {
      const d = await pindaiFoto(berkas, {
        signal: ac.signal,
        onProgres: (persen, status) => {
          const p = pesanProgres(status, persen)
          setProgres({
            persen,
            pesan: p.persen === undefined ? t(p.kunci) : `${t(p.kunci)} ${p.persen}%`,
          })
        },
      })
      setHasil(d)
      // teks masuk ke kotak isian Tanya AI — bukan dikirim ke AI
      onTeks?.(d.teks)
    } catch (e) {
      if (e?.name === 'AbortError') {
        setError({ pesan: t('pindai.dibatalkan') })
      } else {
        // Pesan dari lib/ocr.js berupa KUNCI kamus (mis. 'ocr.galatBukanGambar').
        // Yang bukan kunci ditampilkan apa adanya — bisa jadi pesan asli dari
        // tempat lain, dan menyembunyikannya justru membuat sulit ditelusuri.
        const pesanAsli = typeof e?.message === 'string' ? e.message : ''
        const kunci = /^(ocr|pindai|umum)\./.test(pesanAsli) ? pesanAsli : null
        setError({ pesan: kunci ? t(kunci, e?.nilai) : pesanAsli || t('pindai.gagal') })
      }
    } finally {
      batalRef.current = null
      setLoading(false)
    }
  }

  const batalkan = async () => {
    batalRef.current?.abort()
    await hentikanMesin()
    setLoading(false)
    setProgres({ persen: 0, pesan: '' })
  }

  const ulangi = () => {
    setHasil(null)
    setError(null)
    setProgres({ persen: 0, pesan: '' })
    pindai()
  }

  const terkirim = (teksKomposer || '').trim()
  const terlaluPendek = terkirim.length < MIN_KARAKTER
  const keyakinanRendah = hasil && (hasil.keyakinan < 60 || terlaluPendek)

  /**
   * Angka yang bentuknya mencurigakan pada teks yang sedang tampil.
   *
   * Dihitung dari teks KOTAK ISIAN, bukan dari `hasil.teks` — jadi kalau
   * pengguna membetulkan angkanya sendiri di kotak, tandanya ikut hilang.
   * Ini penting: peringatannya harus mengikuti apa yang benar-benar akan
   * dipakai, dan sekarang yang akan dipakai adalah isi kotak isian.
   */
  const angkaCuriga = hasil ? periksaAngkaMencurigakan(teksKomposer || '') : []

  return (
    <div className="mt-3 rounded-2xl border border-line-200 bg-surface-50/60 p-[clamp(0.9rem,0.75rem+0.6vw,1.35rem)]">
      <div className="mb-3 flex items-start gap-3">
        <span className="grid size-9 shrink-0 place-items-center rounded-xl bg-white text-brand-600 ring-1 ring-brand-100">
          <ScanText className="size-[18px]" aria-hidden="true" />
        </span>
        <div className="min-w-0 flex-1">
          <h3 className="text-[0.95rem] font-bold text-navy-900">{t('tanya.pindaiJudul')}</h3>
          <p className="text-[0.8rem] leading-snug text-navy-500">{t('tanya.pindaiSub')}</p>
        </div>
        <button
          type="button"
          onClick={onTutup}
          aria-label={t('tanya.tutupPindai')}
          title={t('tanya.tutupPindai')}
          className="grid size-8 shrink-0 place-items-center rounded-lg text-navy-500 transition-colors hover:bg-surface-200/70 hover:text-navy-800 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-500"
        >
          <X className="size-4" aria-hidden="true" />
        </button>
      </div>

      <div className="grid gap-[clamp(0.9rem,1.4vw,1.4rem)] md:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)]">
        {/* ------------------------------------------------ sisi foto --- */}
        <div>
          <div
            onDragOver={(e) => {
              e.preventDefault()
              setSeret(true)
            }}
            onDragLeave={() => setSeret(false)}
            onDrop={(e) => {
              e.preventDefault()
              setSeret(false)
              pilihBerkas(e.dataTransfer?.files?.[0])
            }}
            className={cn(
              'relative flex min-h-[11rem] flex-col items-center justify-center gap-3 rounded-2xl border-2 border-dashed px-4 py-6 text-center transition-colors',
              seret ? 'border-brand-500 bg-brand-50' : 'border-line-300 bg-white/70',
            )}
          >
            {pratinjau ? (
              <>
                <img
                  src={pratinjau}
                  alt={t('pindai.altPratinjau')}
                  className="max-h-[16rem] w-auto max-w-full rounded-xl border border-line-200 bg-white object-contain"
                />
                <button
                  type="button"
                  onClick={bersihkan}
                  className="inline-flex items-center gap-1.5 text-[0.8rem] font-semibold text-navy-500 hover:text-navy-800"
                >
                  <Trash2 className="size-3.5" aria-hidden="true" />
                  {t('pindai.ganti')}
                </button>
              </>
            ) : (
              <>
                <span className="grid size-12 place-items-center rounded-full bg-white text-brand-600 shadow-sm">
                  <ImageUp className="size-6" aria-hidden="true" />
                </span>
                <p className="text-[0.9rem] font-semibold text-navy-800">{t('pindai.tarik')}</p>
                <p className="max-w-[38ch] text-[0.78rem] text-muted-500">
                  {t('pindai.format')} · maksimal {MAKS_BYTE / 1048576} MB
                </p>
              </>
            )}
          </div>

          <div className="mt-3 flex flex-wrap gap-2">
            <Button
              type="button"
              variant="neutral"
              size="md"
              onClick={() => inputRef.current?.click()}
              disabled={loading}
            >
              <ImageUp className="size-4" aria-hidden="true" />
              {t('pindai.pilih')}
            </Button>
            <Button
              type="button"
              variant="neutral"
              size="md"
              onClick={() => kameraRef.current?.click()}
              disabled={loading}
            >
              <Camera className="size-4" aria-hidden="true" />
              {t('pindai.kamera')}
            </Button>
          </div>

          {/* dua input: yang satu membuka galeri, yang satu langsung kamera */}
          <input
            ref={inputRef}
            type="file"
            accept="image/*"
            className="sr-only"
            onChange={(e) => pilihBerkas(e.target.files?.[0])}
          />
          <input
            ref={kameraRef}
            type="file"
            accept="image/*"
            capture="environment"
            className="sr-only"
            onChange={(e) => pilihBerkas(e.target.files?.[0])}
          />

          <ul className="mt-3 space-y-1.5">
            {CONTOH_BANTUAN.map((kunci) => (
              <li key={kunci} className="flex gap-2 text-[0.76rem] leading-snug text-muted-600">
                <span className="text-brand-600" aria-hidden="true">
                  •
                </span>
                {t(kunci)}
              </li>
            ))}
          </ul>
        </div>

        {/* ---------------------------------------------- sisi hasil --- */}
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <Button
              type="button"
              size="lg"
              loading={loading}
              disabled={!berkas || loading}
              onClick={pindai}
            >
              {loading ? t('pindai.memindai') : t('pindai.tombol')}
              {!loading ? <ScanText className="size-4" aria-hidden="true" /> : null}
            </Button>
            {loading ? (
              <button
                type="button"
                onClick={batalkan}
                className="inline-flex items-center gap-1.5 text-[0.82rem] font-semibold text-navy-500 hover:text-navy-800"
              >
                {t('pindai.batalkan')}
              </button>
            ) : null}
            {hasil ? (
              <button
                type="button"
                onClick={ulangi}
                className="inline-flex items-center gap-1.5 text-[0.82rem] font-semibold text-navy-500 hover:text-navy-800"
              >
                <RotateCcw className="size-3.5" aria-hidden="true" />
                {t('pindai.ulang')}
              </button>
            ) : null}
          </div>

          {loading ? (
            <div className="mt-3 rounded-xl border border-line-200 bg-white px-3.5 py-3">
              <p className="inline-flex items-center gap-2 text-[0.86rem] font-semibold text-brand-700">
                <Loader2 className="size-4 animate-spin" aria-hidden="true" />
                {progres.pesan || t('pindai.menyiapkan')}
              </p>
              <div
                className="mt-2 h-1.5 overflow-hidden rounded-full bg-surface-200"
                role="progressbar"
                aria-valuemin={0}
                aria-valuemax={100}
                aria-valuenow={Math.round(progres.persen * 100)}
              >
                <span
                  className="block h-full rounded-full bg-brand-500 transition-[width] duration-300"
                  style={{ width: `${Math.max(4, Math.round(progres.persen * 100))}%` }}
                />
              </div>
              <p className="mt-2 text-[0.74rem] text-muted-500">{t('pindai.catatanMesin')}</p>
            </div>
          ) : null}

          {error ? (
            <div
              role="alert"
              className="mt-3 flex items-start gap-2.5 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-[0.86rem] text-rose-700"
            >
              <TriangleAlert className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
              <p className="font-semibold">{error.pesan}</p>
            </div>
          ) : null}

          {hasil ? (
            <div className="rise mt-3 space-y-2">
              <div className="flex flex-wrap items-center gap-2">
                <span className="inline-flex items-center gap-1.5 rounded-full bg-brand-50 px-2.5 py-1 text-[0.74rem] font-bold text-brand-700 ring-1 ring-brand-100">
                  <FileText className="size-3.5" aria-hidden="true" />
                  {terkirim.length} {t('pindai.karakter')}
                </span>
                <span
                  className={cn(
                    'inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[0.74rem] font-bold ring-1',
                    hasil.keyakinan >= 75
                      ? 'bg-brand-50 text-brand-700 ring-brand-100'
                      : hasil.keyakinan >= 50
                        ? 'bg-amber-50 text-amber-800 ring-amber-200'
                        : 'bg-rose-50 text-rose-700 ring-rose-200',
                  )}
                >
                  {t('pindai.keyakinan')} {hasil.keyakinan}%
                </span>
                <span className="text-[0.72rem] text-muted-500">
                  {hasil.lebar}×{hasil.tinggi} px · {t('pindai.diproses')}
                </span>
              </div>

              {keyakinanRendah ? (
                <p className="rounded-xl border border-amber-200 bg-amber-50 px-3.5 py-2.5 text-[0.8rem] text-amber-800">
                  {t('pindai.rendah')}
                </p>
              ) : null}

              {/* peringatan tegas, selalu tampil begitu ada hasil */}
              <div className="flex items-start gap-2.5 rounded-xl border border-amber-200 bg-amber-50 px-3.5 py-2.5">
                <TriangleAlert className="mt-0.5 size-4 shrink-0 text-amber-700" aria-hidden="true" />
                <p className="text-[0.8rem] leading-snug text-amber-900">
                  <strong className="font-bold">{t('pindai.tegasJudul')}</strong>{' '}
                  {t('pindai.tegasIsi')}
                </p>
              </div>

              {angkaCuriga.length ? (
                <div className="rounded-xl border border-rose-200 bg-rose-50 px-3.5 py-2.5">
                  <p className="inline-flex items-center gap-1.5 text-[0.8rem] font-bold text-rose-800">
                    <TriangleAlert className="size-3.5" aria-hidden="true" />
                    {t('pindai.angkaJudul')} ({angkaCuriga.length})
                  </p>
                  <ul className="mt-1.5 space-y-1">
                    {angkaCuriga.map((a, i) => (
                      <li key={`${a.teks}-${i}`} className="text-[0.78rem] leading-snug text-rose-800">
                        <code className="rounded bg-white px-1.5 py-0.5 font-mono font-bold">
                          {a.teks}
                        </code>{' '}
                        {t(a.alasan)}
                      </li>
                    ))}
                  </ul>
                  <p className="mt-1.5 text-[0.74rem] text-rose-700">{t('pindai.angkaCatatan')}</p>
                </div>
              ) : null}

              <p className="text-[0.8rem] font-semibold text-navy-700">{t('pindai.keKotak')}</p>
              {!serverOnline ? (
                <p className="text-[0.78rem] text-amber-700">
                  {t('umum.serverMati')} — {t('umum.jalankan')}{' '}
                  <code className="font-mono">npm run server</code>. {t('pindai.tetapBisa')}
                </p>
              ) : terkirim.length > MAKS_TANYA ? (
                <p className="text-[0.78rem] text-muted-500">{t('pindai.terlaluPanjang')}</p>
              ) : null}
            </div>
          ) : null}

          {!hasil && !loading && !error ? (
            <div className="mt-3 rounded-xl border border-dashed border-line-300 bg-white/70 px-4 py-6 text-center">
              <p className="text-[0.86rem] font-semibold text-navy-700">{t('pindai.kosongJudul')}</p>
              <p className="mx-auto mt-1 max-w-[40ch] text-[0.8rem] text-muted-500">
                {t('pindai.kosongSub')}
              </p>
            </div>
          ) : null}

          <div className="mt-3 rounded-xl border border-line-200 bg-white/70 px-3.5 py-3">
            <p className="text-[0.82rem] font-bold text-navy-800">{t('pindai.privasiJudul')}</p>
            <ul className="mt-1.5 space-y-1.5">
              {[t('pindai.privasi1'), t('pindai.privasi2'), t('pindai.privasi3')].map((b) => (
                <li key={b} className="flex gap-2 text-[0.78rem] leading-snug text-navy-600">
                  <span className="text-brand-600" aria-hidden="true">
                    •
                  </span>
                  {b}
                </li>
              ))}
            </ul>
          </div>
        </div>
      </div>
    </div>
  )
}
