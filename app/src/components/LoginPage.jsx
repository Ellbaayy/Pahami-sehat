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

import { useCallback, useState } from 'react'
import { Mail, Phone, Lock, Eye, EyeOff, ArrowLeft, Loader2, Check, AlertCircle, ShieldCheck, HeartHandshake, Users } from 'lucide-react'
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

export default function LoginPage({ t = (k) => k, onSelesai, layarAwal = 'masuk', onKeluar = null }) {
  // masuk | buat1 | buat2 | buat3 | nama
  //
  // 'masuk' = halaman masuk satu-satunya (alamat + kata sandi sekaligus).
  // 'buat1'..'buat3' = tiga langkah MEMBUAT akun. Tidak ada lagi layar
  // 'gerbang' — dulu ia hanya memeriksa apakah alamat sudah terdaftar, dan
  // itu membuat halaman masuk terasa seperti dua halaman.
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

  /**
   * Kunci re-mount saat layar berpindah, supaya animasi masuk (.rise) ikut
   * berjalan ulang. Tanpa ini, berpindah layar terasa seperti teks yang
   * diganti — bukan layar yang berganti.
   */
  const [kunciLayar, setKunciLayar] = useState(0)

  const keLayar = useCallback((l) => {
    setLayar(l)
    setKunciLayar((k) => k + 1)
  }, [])

  const bersihkan = useCallback(() => {
    setGalat('')
  }, [])

  const cocok = sandi.length >= MIN_SANDI && sandi === ulangi

  /* --------------------------------------------------------- 1. masuk ------ */

  /**
   * Halaman masuk SATU-satunya: alamat dan kata sandi sekaligus.
   *
   * KENAPA DIUBAH (permintaan jagi, 16 Okt 2026): sebelumnya dua langkah —
   * isi alamat dulu, diperiksa ke server, baru kolom kata sandi muncul. Itu
   * membuat halaman masuk terasa seperti dua halaman, dan menambah satu
   * perjalanan ke server sebelum pengguna sempat mengetik sandi. Sekarang
   * keduanya ada di satu formulir. Halaman lain hanya untuk MEMBUAT akun.
   *
   * Pesan galatnya SENGAJA tidak membedakan "akun tidak ada" dari "sandi
   * salah" — server memang menyamakan keduanya, berikut waktu balasannya,
   * supaya alamat mana yang terdaftar tidak bisa ditebak orang lain. Karena
   * itu jalan ke pembuatan akun ditawarkan lewat tautan "Belum punya akun?",
   * BUKAN lewat pesan galat.
   */
  const lakukanMasuk = async (e) => {
    e.preventDefault()
    bersihkan()
    const nilai = identifier.trim()
    if (!nilai) return setGalat('Isi email atau nomor telepon dulu, ya.')
    if (!sandi) return setGalat('Kata sandi belum diisi.')
    setMemuat(true)
    try {
      const d = await panggilApi('/api/akun/masuk', { body: { identifier: nilai, sandi } })
      if (d.perluNama) {
        keLayar('nama')
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
    keLayar('buat2')
  }

  // Form 2 -> Form 3
  const lanjutKeUlangi = (e) => {
    e.preventDefault()
    bersihkan()
    if (sandi.length < MIN_SANDI) return setGalat(`Kata sandi minimal ${MIN_SANDI} karakter.`)
    keLayar('buat3')
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
      keLayar('nama') // nama panggilan selalu diminta setelah daftar
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

  /* ------------------------------------------------------------ tampilan --
   *
   * Split-screen mengikuti referensi jagi (Antarmuka Login Hidup Sehat
   * Minimalis). Alur kerja: masuk -> (buat: 3 langkah) -> nama panggilan.
   * Halaman masuk kini SATU formulir (alamat + kata sandi sekaligus); sisanya
   * khusus untuk MEMBUAT akun. Semua handler di atas sudah disesuaikan.
   *
   * Di ponsel, panel kiri disembunyikan dan kartu mengambil seluruh lebar.
   * Di tablet/desktop, panel kiri tampil sebagai sisi branding.
   *
   * Teks di sini bahasa Indonesia tetap, sama seperti sebelumnya — LoginPage
   * memang belum ikut kamus dua bahasa.
   */

  return (
    <div className="grid min-h-dvh lg:grid-cols-[55%_45%]">
      {/* ------------------------------------------------ panel kiri (branding) -- */}
      <aside
        aria-hidden="true"
        className="relative hidden overflow-hidden lg:flex lg:flex-col lg:justify-center lg:px-[clamp(2rem,5vw,4.5rem)] lg:py-16"
        style={{
          background:
            'linear-gradient(160deg, #eefbf8 0%, #e8f4f0 45%, #eef4fb 100%)',
        }}
      >
        {/* aksen blur lembut di pojok — hanya hiasan */}
        <div className="pointer-events-none absolute -top-24 -left-24 size-72 rounded-full bg-brand-200/40 blur-3xl" />
        <div className="pointer-events-none absolute -right-16 -bottom-24 size-80 rounded-full bg-sky-200/40 blur-3xl" />
        {/* watermark logo */}
        <img
          src={logo}
          alt=""
          className="pointer-events-none absolute -right-10 -bottom-12 w-[46%] opacity-[0.06]"
        />

        <div className="relative max-w-xl">
          <h1 className="text-[clamp(2.3rem,3.4vw,3.4rem)] leading-[1.08] font-extrabold tracking-tight text-navy-900">
            Langkah kecil untuk hidup{' '}
            <span className="text-brand-600">lebih sehat</span>
          </h1>
          <p className="mt-5 max-w-[46ch] text-[clamp(0.95rem,0.9rem+0.3vw,1.05rem)] leading-relaxed text-navy-500">
            Dapatkan informasi kesehatan yang akurat, mudah dipahami, dan
            terpercaya untuk masa depan yang lebih baik.
          </p>

          <ul className="mt-9 flex flex-wrap gap-x-8 gap-y-5">
            {[
              { teks: 'Informasi Terpercaya', ikon: ShieldCheck, warna: 'text-brand-700' },
              { teks: 'Mudah Dipahami', ikon: HeartHandshake, warna: 'text-sky-700' },
              { teks: 'Untuk Semua', ikon: Users, warna: 'text-brand-700' },
            ].map(({ teks, ikon: Ikon, warna }) => (
              <li key={teks} className="flex items-center gap-2.5">
                <span className="grid size-9 shrink-0 place-items-center rounded-full bg-white ring-1 ring-line-200">
                  <Ikon className={`size-4 ${warna}`} />
                </span>
                <span className="text-[0.82rem] font-semibold text-navy-700">{teks}</span>
              </li>
            ))}
          </ul>
        </div>
      </aside>

      {/* ------------------------------------------------- panel kanan (kartu) -- */}
      <div className="relative flex min-h-dvh flex-col items-center justify-center overflow-hidden bg-[linear-gradient(165deg,#eefbf8_0%,#e8f4f0_60%,#eef4fb_100%)] px-5 py-6 lg:h-dvh lg:bg-none lg:bg-[#e8f4f0] lg:overflow-y-auto">
        {/* aksen untuk ponsel (panel kiri disembunyikan) */}
        <div className="pointer-events-none absolute -top-20 -right-20 size-56 rounded-full bg-brand-200/40 blur-3xl lg:hidden" />
        <div className="pointer-events-none absolute -bottom-16 -left-16 size-56 rounded-full bg-sky-200/40 blur-3xl lg:hidden" />

        <div className="relative w-full max-w-[26.5rem]">
          <div
            key={kunciLayar}
            className="rise rounded-[1.5rem] bg-white p-[clamp(1.5rem,1.2rem+1.2vw,2.25rem)] text-center shadow-[0_24px_60px_-16px_rgba(15,30,51,.18)]"
          >
            {/* kepala kartu */}
            <div className="mb-6 flex flex-col items-center">
              <img src={logo} alt="" width="46" height="43" className="mb-2.5" />
              <h2 className="text-[1.3rem] font-extrabold tracking-tight text-navy-900">
                Pahami Sehat
              </h2>
              <p className="mt-1 text-[0.85rem] text-navy-500">Informasi Kesehatan untuk Semua</p>
            </div>

            {/* ------------------------------------------------------ masuk --
             *
             * SATU formulir untuk masuk: alamat dan kata sandi sekaligus
             * (permintaan jagi, 16 Okt 2026). Sebelumnya dua langkah dengan
             * pemeriksaan ke server di antaranya — terasa seperti dua
             * halaman, dan menambah satu perjalanan ke server sebelum
             * pengguna sempat mengetik sandi.
             *
             * Jalan ke pembuatan akun sengaja lewat tautan di bawah, BUKAN
             * lewat pesan galat: server menyamakan pesan "akun tidak ada"
             * dengan "sandi salah" supaya alamat mana yang terdaftar tidak
             * bisa ditebak orang lain (lihat `masuk()` di server/akun.js).
             * Kalau pesan galat yang membedakannya, sifat rahasia itu hilang.
             */}
            {layar === 'masuk' && (
              <form onSubmit={lakukanMasuk} className="space-y-4 text-left">
                <div className="space-y-1.5 text-center">
                  <h3 className="text-[1.05rem] font-bold text-navy-900">Masuk ke akunmu</h3>
                  <p className="text-[0.85rem] text-navy-500">
                    Pakai email atau nomor telepon yang sudah terdaftar.
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
                    className="absolute top-1/2 right-1.5 flex min-h-11 min-w-11 -translate-y-1/2 items-center justify-center rounded-lg text-navy-400 hover:text-navy-600"
                  >
                    {lihatSandi ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
                  </button>
                </div>
                <TombolUtama memuat={memuat} type="submit">
                  Masuk
                </TombolUtama>
                <p className="text-center text-[0.82rem] text-navy-500">
                  Belum punya akun?{' '}
                  <button
                    type="button"
                    onClick={() => {
                      bersihkan()
                      setSandi('')
                      keLayar('buat1')
                    }}
                    className="inline-flex min-h-11 items-center font-semibold text-brand-700 underline underline-offset-2 hover:text-brand-800"
                  >
                    Buat akun
                  </button>
                </p>
              </form>
            )}

            {/* -------------------------------------------------- buat: 1/3 -- */}
            {layar === 'buat1' && (
              <form onSubmit={lanjutKeSandi} className="space-y-4 text-left">
                <button
                  type="button"
                  onClick={() => {
                    bersihkan()
                    setSandi('')
                    keLayar('masuk')
                  }}
                  className="inline-flex items-center gap-1.5 text-[0.82rem] font-semibold text-navy-500 hover:text-navy-700"
                >
                  <ArrowLeft className="size-3.5" aria-hidden="true" /> Kembali
                </button>
                <Langkah aktif={1} jumlah={3} />
                <div className="space-y-1.5 text-center">
                  <h3 className="text-[1.05rem] font-bold text-navy-900">Buat akun — langkah 1 dari 3</h3>
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
              <form onSubmit={lanjutKeUlangi} className="space-y-4 text-left">
                <button
                  type="button"
                  onClick={() => {
                    bersihkan()
                    keLayar('buat1')
                  }}
                  className="inline-flex items-center gap-1.5 text-[0.82rem] font-semibold text-navy-500 hover:text-navy-700"
                >
                  <ArrowLeft className="size-3.5" aria-hidden="true" /> Kembali
                </button>
                <Langkah aktif={2} jumlah={3} />
                <div className="space-y-1.5 text-center">
                  <h3 className="text-[1.05rem] font-bold text-navy-900">Buat akun — langkah 2 dari 3</h3>
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
                    className="absolute top-1/2 right-1.5 flex min-h-11 min-w-11 -translate-y-1/2 items-center justify-center rounded-lg text-navy-400 hover:text-navy-600"
                  >
                    {lihatSandi ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
                  </button>
                </div>
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
              <form onSubmit={lakukanDaftar} className="space-y-4 text-left">
                <button
                  type="button"
                  onClick={() => {
                    bersihkan()
                    keLayar('buat2')
                  }}
                  className="inline-flex items-center gap-1.5 text-[0.82rem] font-semibold text-navy-500 hover:text-navy-700"
                >
                  <ArrowLeft className="size-3.5" aria-hidden="true" /> Kembali
                </button>
                <Langkah aktif={3} jumlah={3} />
                <div className="space-y-1.5 text-center">
                  <h3 className="text-[1.05rem] font-bold text-navy-900">Buat akun — langkah 3 dari 3</h3>
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
              <form onSubmit={simpanNama} className="space-y-4 text-left">
                <div className="space-y-1.5 text-center">
                  <h3 className="text-[1.05rem] font-bold text-navy-900">Mau dipanggil apa?</h3>
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
                {onKeluar && (
                  <p className="text-center text-[0.82rem] text-navy-500">
                    Tidak sekarang?{' '}
                    <button
                      type="button"
                      onClick={onKeluar}
                      className="inline-flex min-h-11 items-center font-semibold text-brand-700 underline underline-offset-2 hover:text-brand-800"
                    >
                      Keluar dari akun ini
                    </button>
                  </p>
                )}
              </form>
            )}

            {/* ------------------------------------------------------ google -- */}
            {GOOGLE_ID && (layar === 'masuk' || layar === 'buat1') && (
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

          {/* catatan privasi — di luar kartu, mengikuti referensi */}
          <p className="mt-4 flex items-center justify-center gap-1.5 text-center text-[0.8rem] leading-relaxed text-navy-500">
            <ShieldCheck className="size-3.5 shrink-0 text-brand-600" aria-hidden="true" />
            Privasi Anda prioritas kami! Data minimal, kata sandi terenkripsi, tanpa NIK
            atau alamat.
          </p>
        </div>
      </div>
    </div>
  )
}
