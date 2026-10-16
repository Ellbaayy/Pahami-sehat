/**
 * Halaman masuk & daftar.
 *
 * ============================================================================
 * ALUR (sesuai permintaan jagi)
 * ============================================================================
 *
 *   1. GERBANG   "Sudah punya akun?"  ->  [Masuk]  [Buat akun]
 *   2. kalau MASUK   -> satu form (email/telepon + kata sandi)
 *   3. kalau BUAT AKUN -> tiga form berurutan:
 *        Form 1: pilih email atau nomor telepon
 *        Form 2: kata sandi (minimal 8 karakter)
 *        Form 3: ulangi kata sandi
 *   4. SETUP USERNAME  -> "Halo, Bayu!"
 *   5. selesai -> LoadingPage -> Beranda
 *
 * Tombol Google sudah disiapkan tempatnya, tapi baru aktif kalau
 * `VITE_GOOGLE_CLIENT_ID` diisi. Selama belum, tombolnya disembunyikan —
 * lebih baik tidak terlihat daripada terlihat tapi tidak bekerja.
 *
 * ============================================================================
 */

import { useCallback, useMemo, useState } from 'react'
import { Mail, Phone, Lock, Eye, EyeOff, ArrowLeft, Loader2, Check, AlertCircle } from 'lucide-react'
import logo from '../assets/logo-mark.png'

const MIN_SANDI = 8

/** Client ID Google — kosong berarti tombol Google disembunyikan. */
const GOOGLE_ID = import.meta.env?.VITE_GOOGLE_CLIENT_ID || ''

/** Panggil API akun dengan bentuk galat yang seragam. */
async function panggilApi(jalur, opsi = {}) {
  const res = await fetch(jalur, {
    method: opsi.method ?? 'POST',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'same-origin', // cookie sesi ikut terkirim
    body: opsi.body ? JSON.stringify(opsi.body) : undefined,
  })
  let data = null
  try {
    data = await res.json()
  } catch {
    /* balasan bukan JSON — ditangani di bawah */
  }
  if (!res.ok || !data?.ok) {
    const e = new Error(data?.pesan || 'Terjadi kesalahan. Coba lagi.')
    e.code = data?.code
    throw e
  }
  return data
}

/** Kotak galat yang ramah. */
function Galat({ pesan }) {
  if (!pesan) return null
  return (
    <p
      role="alert"
      className="flex items-start gap-2 rounded-xl border border-rose-200 bg-rose-50 px-3.5 py-2.5 text-[0.85rem] text-rose-800"
    >
      <AlertCircle className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
      <span>{pesan}</span>
    </p>
  )
}

/** Tombol utama dengan keadaan memuat. */
function TombolUtama({ children, memuat, ...sisa }) {
  return (
    <button
      {...sisa}
      disabled={memuat || sisa.disabled}
      className="inline-flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-brand-600 px-5 text-[0.95rem] font-semibold text-white transition-colors hover:bg-brand-700 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-600 disabled:opacity-60"
    >
      {memuat ? <Loader2 className="size-4 animate-spin" aria-hidden="true" /> : null}
      {children}
    </button>
  )
}

/** Kolom isian dengan ikon. */
function Kolom({ ikon: Ikon, ...sisa }) {
  return (
    <div className="relative">
      <Ikon
        className="pointer-events-none absolute top-1/2 left-3.5 size-4 -translate-y-1/2 text-navy-400"
        aria-hidden="true"
      />
      <input
        {...sisa}
        className="h-12 w-full rounded-xl border border-line-200 bg-white pr-3.5 pl-10 text-[0.95rem] text-navy-900 transition-colors placeholder:text-navy-400 focus-visible:border-brand-500 focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-brand-500"
      />
    </div>
  )
}

/**
 * Indikator langkah (1-2-3) untuk alur buat akun.
 */
function Langkah({ aktif, jumlah }) {
  return (
    <ol className="flex items-center gap-1.5" aria-label={`Langkah ${aktif} dari ${jumlah}`}>
      {Array.from({ length: jumlah }, (_, i) => (
        <li
          key={i}
          aria-current={i + 1 === aktif ? 'step' : undefined}
          className={`h-1.5 flex-1 rounded-full transition-colors ${
            i + 1 <= aktif ? 'bg-brand-500' : 'bg-line-200'
          }`}
        />
      ))}
    </ol>
  )
}

export default function LoginPage({ t = (k) => k, onSelesai, layarAwal = 'gerbang', onKeluar = null }) {
  // gerbang | masuk | buat1 | buat2 | buat3 | nama
  //
  // `layarAwal` dipakai untuk MEMULAI langsung di layar nama panggilan. Itu
  // diperlukan pengguna yang masuk lewat Google: alur Google tidak melewati
  // halaman ini sama sekali (peramban keluar ke Google lalu kembali ke
  // /app/), jadi langkah "Mau dipanggil apa?" harus dimunculkan App setelah
  // tahu pengguna sudah masuk tapi belum punya nama panggilan.
  const [layar, setLayar] = useState(layarAwal)
  const [identifier, setIdentifier] = useState('')
  const [sandi, setSandi] = useState('')
  const [ulangi, setUlangi] = useState('')
  const [nama, setNama] = useState('')
  const [cara, setCara] = useState('email') // email | telepon
  const [lihatSandi, setLihatSandi] = useState(false)
  const [memuat, setMemuat] = useState(false)
  const [galat, setGalat] = useState('')
  const [catatan, setCatatan] = useState('')

  const bersihkan = useCallback(() => {
    setGalat('')
    setCatatan('')
  }, [])

  const cocok = sandi.length >= MIN_SANDI && sandi === ulangi
  const jenis = useMemo(() => (cara === 'email' ? 'email' : 'telepon'), [cara])

  /* ------------------------------------------------------ 1. gerbang ------ */

  const cekAkun = async (e) => {
    e.preventDefault()
    bersihkan()
    const nilai = identifier.trim()
    if (!nilai) return setGalat('Isi email atau nomor telepon dulu, ya.')
    setMemuat(true)
    try {
      const d = await panggilApi('/api/akun/cek', { body: { identifier: nilai } })
      if (d.terdaftar) {
        setLayar('masuk')
      } else {
        setCatatan('Belum ada akun dengan alamat ini. Yuk buat akun dulu.')
        setLayar('buat1')
      }
    } catch (err) {
      setGalat(err.message)
    } finally {
      setMemuat(false)
    }
  }

  /* -------------------------------------------------------- 2. masuk ------ */

  const lakukanMasuk = async (e) => {
    e.preventDefault()
    bersihkan()
    if (!sandi) return setGalat('Kata sandi belum diisi.')
    setMemuat(true)
    try {
      const d = await panggilApi('/api/akun/masuk', { body: { identifier: identifier.trim(), sandi } })
      if (d.perluNama) {
        setLayar('nama')
      } else {
        onSelesai?.(d.pengguna)
      }
    } catch (err) {
      setGalat(err.message)
    } finally {
      setMemuat(false)
    }
  }

  /* ----------------------------------------------------- 3. buat akun ----- */

  // Form 1 -> Form 2: pastikan bentuknya benar dulu
  const lanjutKeSandi = (e) => {
    e.preventDefault()
    bersihkan()
    const nilai = identifier.trim()
    if (!nilai) return setGalat('Isi dulu, ya.')
    if (cara === 'email' && !/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(nilai)) {
      return setGalat('Bentuk emailnya belum benar. Contoh: nama@email.com')
    }
    if (cara === 'telepon' && !/^(\+?62|0)\d{8,14}$/.test(nilai.replace(/[^\d+]/g, ''))) {
      return setGalat('Bentuk nomornya belum benar. Contoh: 081234567890')
    }
    setLayar('buat2')
  }

  // Form 2 -> Form 3
  const lanjutKeUlangi = (e) => {
    e.preventDefault()
    bersihkan()
    if (sandi.length < MIN_SANDI) return setGalat(`Kata sandi minimal ${MIN_SANDI} karakter.`)
    setLayar('buat3')
  }

  // Form 3 -> daftar
  const lakukanDaftar = async (e) => {
    e.preventDefault()
    bersihkan()
    if (sandi !== ulangi) return setGalat('Kedua kata sandinya belum sama.')
    setMemuat(true)
    try {
      const d = await panggilApi('/api/akun/daftar', {
        body: { identifier: identifier.trim(), sandi },
      })
      setLayar('nama') // nama panggilan selalu diminta setelah daftar
    } catch (err) {
      setGalat(err.message)
    } finally {
      setMemuat(false)
    }
  }

  /* -------------------------------------------------------- 4. username --- */

  const simpanNama = async (e) => {
    e.preventDefault()
    bersihkan()
    const nilai = nama.trim()
    if (nilai.length < 2) return setGalat('Nama panggilan minimal 2 karakter.')
    setMemuat(true)
    try {
      const d = await panggilApi('/api/akun/nama', { body: { namaPengguna: nilai } })
      onSelesai?.(d.pengguna)
    } catch (err) {
      setGalat(err.message)
    } finally {
      setMemuat(false)
    }
  }

  /* ------------------------------------------------------------ tampilan -- */

  return (
    <div className="flex min-h-dvh flex-col items-center justify-center bg-[linear-gradient(135deg,#f5f8fa_0%,#eef4f8_60%,#e8f2f0_100%)] px-5 py-10">
      <div className="w-full max-w-[26rem]">
        {/* kepala */}
        <div className="mb-7 flex flex-col items-center text-center">
          <img src={logo} alt="" width="52" height="48" className="mb-3" />
          <h1 className="text-[1.45rem] font-extrabold tracking-tight text-navy-900">Pahami Sehat</h1>
          <p className="mt-1 text-[0.85rem] text-navy-500">Informasi Kesehatan untuk Semua</p>
        </div>

        <div className="rounded-2xl border border-line-200 bg-white p-6 shadow-[0_14px_40px_-18px_rgba(15,30,51,.22)]">
          {/* ---------------------------------------------------- gerbang -- */}
          {layar === 'gerbang' && (
            <form onSubmit={cekAkun} className="space-y-4">
              <div className="space-y-1.5">
                <h2 className="text-[1.05rem] font-bold text-navy-900">Sudah punya akun?</h2>
                <p className="text-[0.85rem] text-navy-500">
                  Masukkan email atau nomor teleponmu. Eun-soo cek dulu, sudah terdaftar atau belum.
                </p>
              </div>
              <Galat pesan={galat} />
              <Kolom
                ikon={Mail}
                type="text"
                inputMode="email"
                autoComplete="username"
                placeholder="email@contoh.com atau 0812…"
                value={identifier}
                onChange={(e) => setIdentifier(e.target.value)}
                aria-label="Email atau nomor telepon"
              />
              <TombolUtama memuat={memuat} type="submit">
                Lanjut
              </TombolUtama>
              <p className="text-center text-[0.82rem] text-navy-500">
                Belum punya akun?{' '}
                <button
                  type="button"
                  onClick={() => {
                    bersihkan()
                    setLayar('buat1')
                  }}
                  className="font-semibold text-brand-700 underline underline-offset-2 hover:text-brand-800"
                >
                  Buat akun
                </button>
              </p>
            </form>
          )}

          {/* ------------------------------------------------------ masuk -- */}
          {layar === 'masuk' && (
            <form onSubmit={lakukanMasuk} className="space-y-4">
              <button
                type="button"
                onClick={() => {
                  bersihkan()
                  setLayar('gerbang')
                }}
                className="inline-flex items-center gap-1.5 text-[0.82rem] font-semibold text-navy-500 hover:text-navy-700"
              >
                <ArrowLeft className="size-3.5" aria-hidden="true" /> Kembali
              </button>
              <div className="space-y-1.5">
                <h2 className="text-[1.05rem] font-bold text-navy-900">Masuk</h2>
                <p className="text-[0.85rem] break-all text-navy-500">{identifier}</p>
              </div>
              <Galat pesan={galat} />
              <div className="relative">
                <Kolom
                  ikon={Lock}
                  type={lihatSandi ? 'text' : 'password'}
                  autoComplete="current-password"
                  placeholder="Kata sandi"
                  value={sandi}
                  onChange={(e) => setSandi(e.target.value)}
                  aria-label="Kata sandi"
                />
                <button
                  type="button"
                  onClick={() => setLihatSandi((v) => !v)}
                  aria-label={lihatSandi ? 'Sembunyikan kata sandi' : 'Tampilkan kata sandi'}
                  className="absolute top-1/2 right-3 -translate-y-1/2 text-navy-400 hover:text-navy-600"
                >
                  {lihatSandi ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
                </button>
              </div>
              <TombolUtama memuat={memuat} type="submit">
                Masuk
              </TombolUtama>
            </form>
          )}

          {/* -------------------------------------------------- buat: 1/3 -- */}
          {layar === 'buat1' && (
            <form onSubmit={lanjutKeSandi} className="space-y-4">
              <button
                type="button"
                onClick={() => {
                  bersihkan()
                  setLayar('gerbang')
                }}
                className="inline-flex items-center gap-1.5 text-[0.82rem] font-semibold text-navy-500 hover:text-navy-700"
              >
                <ArrowLeft className="size-3.5" aria-hidden="true" /> Kembali
              </button>
              <Langkah aktif={1} jumlah={3} />
              <div className="space-y-1.5">
                <h2 className="text-[1.05rem] font-bold text-navy-900">Buat akun — langkah 1 dari 3</h2>
                <p className="text-[0.85rem] text-navy-500">Mau pakai email atau nomor telepon?</p>
              </div>
              <Galat pesan={galat} />
              <div className="grid grid-cols-2 gap-2" role="radiogroup" aria-label="Cara mendaftar">
                {[
                  { kunci: 'email', label: 'Email', Ikon: Mail },
                  { kunci: 'telepon', label: 'Nomor telepon', Ikon: Phone },
                ].map(({ kunci, label, Ikon }) => (
                  <button
                    key={kunci}
                    type="button"
                    role="radio"
                    aria-checked={cara === kunci}
                    onClick={() => {
                      setCara(kunci)
                      setIdentifier('')
                      bersihkan()
                    }}
                    className={`flex h-11 items-center justify-center gap-2 rounded-xl border text-[0.88rem] font-semibold transition-colors ${
                      cara === kunci
                        ? 'border-brand-500 bg-brand-50 text-brand-800'
                        : 'border-line-200 bg-white text-navy-600 hover:bg-surface-50'
                    }`}
                  >
                    <Ikon className="size-4" aria-hidden="true" />
                    {label}
                  </button>
                ))}
              </div>
              <Kolom
                ikon={cara === 'email' ? Mail : Phone}
                type={cara === 'email' ? 'email' : 'tel'}
                inputMode={cara === 'email' ? 'email' : 'tel'}
                autoComplete={cara === 'email' ? 'email' : 'tel'}
                placeholder={cara === 'email' ? 'nama@email.com' : '081234567890'}
                value={identifier}
                onChange={(e) => setIdentifier(e.target.value)}
                aria-label={cara === 'email' ? 'Email' : 'Nomor telepon'}
              />
              <TombolUtama memuat={memuat} type="submit">
                Lanjut
              </TombolUtama>
            </form>
          )}

          {/* -------------------------------------------------- buat: 2/3 -- */}
          {layar === 'buat2' && (
            <form onSubmit={lanjutKeUlangi} className="space-y-4">
              <button
                type="button"
                onClick={() => {
                  bersihkan()
                  setLayar('buat1')
                }}
                className="inline-flex items-center gap-1.5 text-[0.82rem] font-semibold text-navy-500 hover:text-navy-700"
              >
                <ArrowLeft className="size-3.5" aria-hidden="true" /> Kembali
              </button>
              <Langkah aktif={2} jumlah={3} />
              <div className="space-y-1.5">
                <h2 className="text-[1.05rem] font-bold text-navy-900">Buat akun — langkah 2 dari 3</h2>
                <p className="text-[0.85rem] text-navy-500">
                  Buat kata sandi. Minimal {MIN_SANDI} karakter, bebas mau apa saja.
                </p>
              </div>
              <Galat pesan={galat} />
              <div className="relative">
                <Kolom
                  ikon={Lock}
                  type={lihatSandi ? 'text' : 'password'}
                  autoComplete="new-password"
                  placeholder="Kata sandi baru"
                  value={sandi}
                  onChange={(e) => setSandi(e.target.value)}
                  aria-label="Kata sandi baru"
                />
                <button
                  type="button"
                  onClick={() => setLihatSandi((v) => !v)}
                  aria-label={lihatSandi ? 'Sembunyikan kata sandi' : 'Tampilkan kata sandi'}
                  className="absolute top-1/2 right-3 -translate-y-1/2 text-navy-400 hover:text-navy-600"
                >
                  {lihatSandi ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
                </button>
              </div>
              {/* penanda kekuatan sederhana — hanya panjang, tidak menghakimi */}
              <p className="flex items-center gap-1.5 text-[0.8rem] text-navy-500">
                <Check
                  className={`size-3.5 ${sandi.length >= MIN_SANDI ? 'text-brand-600' : 'text-navy-300'}`}
                  aria-hidden="true"
                />
                {sandi.length >= MIN_SANDI
                  ? `${sandi.length} karakter — sudah cukup`
                  : `Baru ${sandi.length} karakter, minimal ${MIN_SANDI}`}
              </p>
              <TombolUtama memuat={memuat} type="submit" disabled={sandi.length < MIN_SANDI}>
                Lanjut
              </TombolUtama>
            </form>
          )}

          {/* -------------------------------------------------- buat: 3/3 -- */}
          {layar === 'buat3' && (
            <form onSubmit={lakukanDaftar} className="space-y-4">
              <button
                type="button"
                onClick={() => {
                  bersihkan()
                  setLayar('buat2')
                }}
                className="inline-flex items-center gap-1.5 text-[0.82rem] font-semibold text-navy-500 hover:text-navy-700"
              >
                <ArrowLeft className="size-3.5" aria-hidden="true" /> Kembali
              </button>
              <Langkah aktif={3} jumlah={3} />
              <div className="space-y-1.5">
                <h2 className="text-[1.05rem] font-bold text-navy-900">Buat akun — langkah 3 dari 3</h2>
                <p className="text-[0.85rem] text-navy-500">Ulangi kata sandinya supaya tidak salah ketik.</p>
              </div>
              <Galat pesan={galat} />
              <Kolom
                ikon={Lock}
                type={lihatSandi ? 'text' : 'password'}
                autoComplete="new-password"
                placeholder="Ulangi kata sandi"
                value={ulangi}
                onChange={(e) => setUlangi(e.target.value)}
                aria-label="Ulangi kata sandi"
              />
              {ulangi.length > 0 && (
                <p
                  className={`flex items-center gap-1.5 text-[0.8rem] ${
                    cocok ? 'text-brand-700' : 'text-rose-700'
                  }`}
                >
                  {cocok ? (
                    <>
                      <Check className="size-3.5" aria-hidden="true" /> Keduanya sama
                    </>
                  ) : (
                    <>
                      <AlertCircle className="size-3.5" aria-hidden="true" /> Belum sama
                    </>
                  )}
                </p>
              )}
              <TombolUtama memuat={memuat} type="submit" disabled={!cocok}>
                Buat akun
              </TombolUtama>
            </form>
          )}

          {/* ------------------------------------------------------- nama -- */}
          {layar === 'nama' && (
            <form onSubmit={simpanNama} className="space-y-4">
              <div className="space-y-1.5">
                <h2 className="text-[1.05rem] font-bold text-navy-900">Mau dipanggil apa?</h2>
                <p className="text-[0.85rem] text-navy-500">
                  Nama ini dipakai untuk menyapa di Beranda. Cukup nama panggilan — jangan nama lengkap.
                </p>
              </div>
              <Galat pesan={galat} />
              <Kolom
                ikon={Mail}
                type="text"
                autoComplete="nickname"
                placeholder="Contoh: Bayu"
                value={nama}
                onChange={(e) => setNama(e.target.value)}
                maxLength={40}
                aria-label="Nama panggilan"
              />
              <TombolUtama memuat={memuat} type="submit" disabled={nama.trim().length < 2}>
                Simpan
              </TombolUtama>
              {/*
                JALAN KELUAR. Layar ini juga muncul SENDIRI setelah masuk lewat
                Google (lihat `layarAwal`), dan tanpa ini pengguna yang tidak
                mau mengisi nama akan TERJEBAK — tidak ada tombol kembali
                (memang tidak boleh: dia sudah masuk) dan tidak ada cara
                keluar selain menghapus cookie peramban secara manual.
              */}
              {onKeluar && (
                <p className="text-center text-[0.82rem] text-navy-500">
                  Tidak sekarang?{' '}
                  <button
                    type="button"
                    onClick={onKeluar}
                    className="font-semibold text-brand-700 underline underline-offset-2 hover:text-brand-800"
                  >
                    Keluar dari akun ini
                  </button>
                </p>
              )}
            </form>
          )}

          {/* ------------------------------------------------------ google -- */}
          {/* Hanya tampil kalau Client ID sudah diisi. Kalau belum, tombolnya
              disembunyikan — lebih baik tidak terlihat daripada terlihat
              tapi tidak bekerja. */}
          {GOOGLE_ID && (layar === 'gerbang' || layar === 'buat1') && (
            <>
              <div className="my-5 flex items-center gap-3">
                <span className="h-px flex-1 bg-line-200" />
                <span className="text-[0.82rem] text-navy-400">atau</span>
                <span className="h-px flex-1 bg-line-200" />
              </div>
              <a
                href="/api/akun/google"
                className="inline-flex h-12 w-full items-center justify-center gap-2.5 rounded-xl border border-line-200 bg-white text-[0.92rem] font-semibold text-navy-700 transition-colors hover:bg-surface-50"
              >
                <svg viewBox="0 0 24 24" className="size-4.5" aria-hidden="true">
                  <path
                    fill="#4285F4"
                    d="M23.5 12.3c0-.8-.1-1.6-.2-2.3H12v4.5h6.5a5.6 5.6 0 0 1-2.4 3.7v3h3.9c2.3-2.1 3.5-5.2 3.5-8.9Z"
                  />
                  <path
                    fill="#34A853"
                    d="M12 24c3.2 0 5.9-1.1 7.9-2.9l-3.9-3c-1.1.7-2.4 1.2-4 1.2-3.1 0-5.7-2.1-6.6-4.9H1.4v3.1A12 12 0 0 0 12 24Z"
                  />
                  <path fill="#FBBC05" d="M5.4 14.4a7.2 7.2 0 0 1 0-4.6V6.7H1.4a12 12 0 0 0 0 10.7l4-3Z" />
                  <path
                    fill="#EA4335"
                    d="M12 4.8c1.8 0 3.3.6 4.6 1.8l3.4-3.4A12 12 0 0 0 1.4 6.7l4 3.1C6.3 6.9 8.9 4.8 12 4.8Z"
                  />
                </svg>
                Masuk dengan Google
              </a>
            </>
          )}
        </div>

        {/* catatan privasi — jujur, dan sesuai isi database */}
        <p className="mt-5 text-center text-[0.82rem] leading-relaxed text-navy-500">
          Yang disimpan hanya email atau nomor telepon, nama panggilan, dan kata sandi (terenkripsi).
          Tidak ada nama lengkap, NIK, atau alamat.
        </p>
      </div>
    </div>
  )
}
