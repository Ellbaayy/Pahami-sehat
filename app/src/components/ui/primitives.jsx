import { Check, Landmark, Link, Loader2, AlertCircle, Search, ArrowRight } from 'lucide-react'
import { cn } from '../../lib/cn'
import IlustrasiAnimasi from './IlustrasiAnimasi'

/* ---------------- Card ---------------- */
export function Card({ className, children, as: Tag = 'div', ...rest }) {
  return (
    <Tag
      className={cn(
        'rounded-2xl border border-line-200/80 bg-white',
        'shadow-[0_1px_2px_rgba(15,30,51,0.04),0_8px_24px_-16px_rgba(15,30,51,0.10)]',
        'transition-[box-shadow,transform,border-color] duration-200 ease-out',
        className,
      )}
      {...rest}
    >
      {children}
    </Tag>
  )
}

/* ---------------- Section heading ---------------- */
/**
 * Judul bagian, dipakai di semua panel fitur.
 *
 * `ilustrasi` bersifat opsional: diisi nama aset dari IlustrasiAnimasi supaya
 * tiap fitur punya ciri visual sendiri. Sengaja tidak selalu diisi —
 * Pengaturan dibiarkan bersih, dan Panel lain diisi secukupnya saja.
 */
export function SectionHeading({ eyebrow, title, description, action, id, ilustrasi, as: Judul = 'h2' }) {
  return (
    <div className="mb-2.5 flex flex-wrap items-end justify-between gap-x-4 gap-y-2 [@media(min-height:1200px)]:mb-[clamp(0.85rem,1.4vw,1.35rem)]">
      <div className="min-w-0">
        {eyebrow ? (
          <p className="mb-1 hidden text-[0.8125rem] font-bold tracking-[0.14em] uppercase text-brand-700 [@media(min-height:1200px)]:block">
            {eyebrow}
          </p>
        ) : null}
        {/*
          `as` menentukan tingkat judul, dan bawaannya `h2`.
          Judul HALAMAN (Tanya AI, Cek Klaim, Riwayat, Kuesioner, Pengaturan)
          memakai `as="h1"` supaya setiap halaman punya satu judul utama — dulu
          hanya Beranda yang punya, sehingga pengguna pembaca layar tidak punya
          penanda halaman. Judul BAGIAN di dalam satu halaman tetap `h2`.
          Tampilannya sengaja tidak diubah: yang berpindah hanya semantiknya.
        */}
        <Judul
          id={id}
          className="text-[clamp(1.05rem,0.95rem+0.45vw,1.35rem)] font-bold tracking-tight text-navy-900"
        >
          {title}
        </Judul>
        {description ? (
          /* Deskripsi penjelas disembunyikan di layar pendek — judul halaman
              tetap ada, dan tanpa ini heading memakan dua baris sehingga
              isi halaman tidak muat satu layar. */
          <p className="mt-1 hidden max-w-[62ch] text-navy-500 [@media(min-height:1200px)]:block [@media(min-height:1200px)]:text-[clamp(0.85rem,0.8rem+0.15vw,0.95rem)]">
            {description}
          </p>
        ) : null}
      </div>
      {action || ilustrasi ? (
        <div className="flex shrink-0 items-center gap-3 self-center">
          {action}
          {ilustrasi ? (
            /* kotak berukuran tetap + object-contain, supaya semua ilustrasi
               menempati ruang yang sama walau rasio gambarnya berbeda-beda.
               Di layar pendek (laptop umum ~700px ke bawah) ilustrasi
               dekoratif ini disembunyikan supaya isi halaman fitur muat
               tanpa scroll — teks judul dan deskripsinya tetap lengkap. */
            <div className="hidden size-[clamp(3.25rem,6vw,5.25rem)] place-items-center [@media(min-height:1200px)]:grid">
              <IlustrasiAnimasi
                nama={ilustrasi}
                className="h-auto max-h-full w-auto max-w-full"
              />
            </div>
          ) : null}
        </div>
      ) : null}
    </div>
  )
}

/* ---------------- Button ---------------- */
const BTN_VARIANTS = {
  /*
   * LATAR TOMBOL UTAMA = brand-600, bukan brand-500.
   * Teks putih di atas brand-500 hanya mencapai rasio kontras 3,12 — di bawah
   * ambang WCAG AA 4,5 untuk teks normal (diukur). Di atas brand-600 rasionya
   * 4,58. Hover/active memakai brand-700 supaya perubahannya tetap terlihat;
   * kalau memakai brand-600 juga, hover jadi tidak kelihatan sama sekali.
   */
  primary:
    'bg-brand-600 text-white hover:bg-brand-700 active:bg-brand-700 shadow-[0_6px_16px_-8px_rgba(13,132,120,0.7)]',
  soft: 'bg-brand-50 text-brand-700 hover:bg-brand-200 border border-brand-100',
  neutral: 'bg-white text-navy-700 border border-line-200 hover:border-line-300 hover:bg-surface-50',
  ghost: 'text-navy-500 hover:text-navy-800 hover:bg-surface-100',
}

const BTN_SIZES = {
  sm: 'h-11 px-4 text-[0.84rem] rounded-lg md:h-10 lg:h-9 lg:px-3.5 lg:text-[0.82rem]',
  md: 'h-11 px-5 text-[0.92rem] rounded-xl',
  lg: 'h-12 px-6 text-[0.95rem] rounded-xl',
}

export function Button({
  variant = 'primary',
  size = 'md',
  loading = false,
  full = false,
  className,
  children,
  disabled,
  ...rest
}) {
  return (
    <button
      type="button"
      disabled={disabled || loading}
      className={cn(
        'inline-flex items-center justify-center gap-2 font-semibold',
        'transition-all duration-200 ease-out',
        'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-500',
        'disabled:cursor-not-allowed disabled:opacity-60',
        BTN_VARIANTS[variant],
        BTN_SIZES[size],
        full && 'w-full',
        className,
      )}
      {...rest}
    >
      {loading ? <Loader2 className="size-4 animate-spin" aria-hidden="true" /> : null}
      {children}
    </button>
  )
}

/* ---------------- Skeleton ---------------- */
export function Skeleton({ className }) {
  return <div className={cn('skeleton rounded-lg', className)} aria-hidden="true" />
}

/* ---------------- Empty state ---------------- */
export function EmptyState({ icon: Icon, title, description, action }) {
  return (
    <div className="flex flex-col items-center gap-2.5 rounded-2xl border border-dashed border-line-300 bg-surface-50/60 px-6 py-4 text-center [@media(min-height:1200px)]:gap-3 [@media(min-height:1200px)]:py-10">
      {/* Ilustrasi netral — muncul hanya saat belum ada isi, jadi tidak pernah
          ramai. Di layar pendek ilustrasinya disembunyikan supaya pesan kosong
          tetap muat satu layar bersama komposer (halaman Tanya AI). */}
      <IlustrasiAnimasi
        nama="kosong"
        className="mb-1 hidden w-[clamp(7.5rem,22vw,11rem)] [@media(min-height:1200px)]:block"
      />
      {Icon ? (
        <span className="grid size-11 place-items-center rounded-full bg-white text-brand-700 shadow-sm">
          <Icon className="size-5" aria-hidden="true" />
        </span>
      ) : null}
      <p className="font-semibold text-navy-800">{title}</p>
      {description ? (
        <p className="max-w-[42ch] text-sm text-navy-500">{description}</p>
      ) : null}
      {action}
    </div>
  )
}

/* ---------------- Source pills ---------------- */
/** Terima array string ("WHO") atau objek ({judul, penerbit}) dari API. */
export function SourcePills({ sources = [], negative = false, label, t = (k) => k }) {
  if (!sources.length) return null
  return (
    <div className="mt-3 flex flex-wrap items-center gap-2 border-t border-dashed border-line-200 pt-3">
      <span className="text-[0.8125rem] font-bold tracking-[0.12em] uppercase text-navy-500">
        {label ?? t('umum.sumber')}
      </span>
      {sources.map((s, i) => {
        const teks = typeof s === 'string' ? s : [s.penerbit, s.judul].filter(Boolean).join(' — ')
        const url = typeof s === 'object' && /^https?:\/\//i.test(s?.url ?? '') ? s.url : ''
        const gaya = cn(
          'inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[0.8125rem] font-semibold',
          negative
            ? 'bg-sky-100 text-sky-700 ring-1 ring-sky-100'
            : 'bg-brand-50 text-brand-700 ring-1 ring-brand-100',
          url && 'underline decoration-dotted underline-offset-2 transition-colors hover:bg-brand-200',
        )
        const isi = (
          <>
            {negative ? (
              <ArrowRight className="size-3.5" aria-hidden="true" />
            ) : (
              <Check className="size-3.5" aria-hidden="true" />
            )}
            {teks || url.replace(/^https?:\/\//, '').slice(0, 40)}
          </>
        )
        // kalau ada URL, jadikan tautan yang bisa dibuka — sumber harus bisa dicek sendiri
        return url ? (
          <a
            key={`${teks}-${i}`}
            href={url}
            target="_blank"
            rel="noopener noreferrer"
            title={url}
            className={gaya}
          >
            {isi}
          </a>
        ) : (
          <span key={`${teks}-${i}`} className={gaya}>
            {isi}
          </span>
        )
      })}
    </div>
  )
}

/* ---------------- Poin kunci (bukti rubrik) ---------------- */
export function PoinKunci({ items = [], t = (k) => k }) {
  if (!items.length) return null
  return (
    <details className="group mt-3 rounded-xl border border-line-200 bg-white/70 px-3.5 py-2.5">
      <summary className="flex cursor-pointer items-center gap-2 text-[0.82rem] font-bold text-navy-700 marker:content-none">
        <span className="text-brand-700 transition-transform group-open:rotate-90" aria-hidden="true">
          ▸
        </span>
        {t('umum.poinKunci')} ({items.length})
      </summary>
      <ul className="mt-2 space-y-1.5 pl-1">
        {items.map((p, i) => (
          <li key={i} className="flex gap-2 text-[0.84rem] leading-snug text-navy-700">
            <span className="text-brand-700" aria-hidden="true">•</span>
            <span>{p}</span>
          </li>
        ))}
      </ul>
      <p className="mt-2 text-[0.8125rem] text-muted-500">{t('umum.poinKunciCatatan')}</p>
    </details>
  )
}

/* ---------------- Peringatan / error ---------------- */
export function Peringatan({ pesan, code, aksi, t = (k) => k }) {
  if (!pesan) return null
  const saldo = code === 'insufficient_balance'
  return (
    <div
      role="alert"
      className={cn(
        'mt-3 flex flex-wrap items-start gap-2.5 rounded-xl border px-4 py-3 text-[0.88rem]',
        saldo ? 'border-amber-200 bg-amber-50 text-amber-800' : 'border-rose-200 bg-rose-50 text-rose-700',
      )}
    >
      <AlertCircle className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
      <div className="min-w-0 flex-1">
        <p className="font-semibold">{pesan}</p>
        {code ? <p className="mt-0.5 text-[0.82rem] opacity-80">{t('galat.kode')}: {code}</p> : null}
      </div>
      {aksi}
    </div>
  )
}


/* ---------------- Sumber jawaban (bisa dicek sendiri) ---------------- */
/**
 * Daftar sumber jawaban AI, dengan URL lengkap yang bisa dibuka.
 * Tujuan: pengguna skeptis bisa memverifikasi sendiri, bukan sekadar percaya.
 */
export function SumberJawaban({ sumber = [], cari = [], label, t = (k) => k }) {
  // gabungkan: sumber yang dipakai model + hasil pencarian yang belum terpakai
  // cari dulu sumber mana yang lembaga resmi (Kemenkes/WHO/BPOM) dari hasil
  // pencarian — supaya sumber yang DIKUTIP model pun tetap dapat tanda resmi
  const resmiSet = new Set((cari || []).filter((h) => h?.resmi).map((h) => h.url))
  const dipakai = (sumber || []).map((s) => ({
    judul: [s.penerbit, s.judul].filter(Boolean).join(' — ') || s.url,
    url: s.url || '',
    resmi: resmiSet.has(s.url),
    dipakai: true,
  }))
  const sudah = new Set(dipakai.map((d) => d.url).filter(Boolean))
  const cadangan = (cari || [])
    .filter((h) => h?.url && !sudah.has(h.url))
    .map((h) => ({ judul: h.judul || h.url, url: h.url, resmi: Boolean(h.resmi), dipakai: false }))

  const semua = [...dipakai, ...cadangan]
  if (!semua.length) return null

  const adaResmi = semua.some((s) => s.resmi)

  return (
    <details
      open
      className="mt-3 rounded-xl border border-line-200 bg-white px-3.5 py-3"
    >
      <summary className="flex cursor-pointer flex-wrap items-center gap-2 text-[0.8rem] font-bold text-navy-800 marker:content-none">
        <Search className="size-3.5 text-brand-700" aria-hidden="true" />
        {label ?? t('sumber.judul')} ({semua.length})
        {adaResmi ? (
          <span className="rounded-full bg-brand-50 px-2 py-0.5 text-[0.8125rem] font-bold text-brand-700 ring-1 ring-brand-100">
            {t('sumber.adaResmi')}
          </span>
        ) : null}
      </summary>

      <p className="mt-2 text-[0.82rem] text-muted-600">
        {t('sumber.cekSendiri')}
        {!dipakai.length ? ` ${t('sumber.belumDikutipCatatan')}` : ''}
      </p>

      <ul className="mt-2.5 space-y-2">
        {semua.map((s, i) => (
          <li key={`${s.url}-${i}`} className="rounded-lg border border-line-100 bg-surface-50/60 p-2.5">
            <div className="flex items-start gap-2">
              {s.resmi ? (
                <Landmark className="mt-0.5 size-4 shrink-0 text-brand-700" aria-hidden="true" />
              ) : s.dipakai ? (
                <Check className="mt-0.5 size-4 shrink-0 text-brand-700" aria-hidden="true" />
              ) : (
                <Link className="mt-0.5 size-4 shrink-0 text-muted-500" aria-hidden="true" />
              )}
              <div className="min-w-0 flex-1">
                <p className="text-[0.84rem] leading-snug font-semibold text-navy-800">
                  {s.judul}
                  {s.resmi ? (
                    <span className="ml-1.5 text-[0.8125rem] font-bold text-brand-700">
                      {t('sumber.resmi')}
                    </span>
                  ) : null}
                  {!s.dipakai ? (
                    <span className="ml-1.5 text-[0.8125rem] font-normal text-muted-500">
                      {t('sumber.belumDikutip')}
                    </span>
                  ) : null}
                </p>
                {s.url ? (
                  <a
                    href={s.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="mt-0.5 block truncate font-mono text-[0.8125rem] text-brand-700 underline decoration-dotted underline-offset-2 hover:text-brand-700"
                    title={s.url}
                    aria-label={`${t('sumber.buka')}: ${s.judul || s.url}`}
                  >
                    {s.url}
                  </a>
                ) : (
                  <p className="mt-0.5 text-[0.8125rem] text-muted-500">{t('sumber.tanpaTautan')}</p>
                )}
              </div>
            </div>
          </li>
        ))}
      </ul>

      <p className="mt-2.5 text-[0.8125rem] text-muted-500">{t('sumber.catatan')}</p>
    </details>
  )
}
