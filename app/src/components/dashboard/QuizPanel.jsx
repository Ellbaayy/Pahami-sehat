import { useState } from 'react'
import {
  Frown,
  Annoyed,
  Smile,
  Laugh,
  ArrowLeft,
  ArrowRight,
  Check,
  AlertCircle,
  Clock,
  Info,
  Lightbulb,
} from 'lucide-react'
import { Card, SectionHeading, Button, EmptyState } from '../ui/primitives'
import { QUIZ_ITEMS } from '../../data/dummy'
import { cn } from '../../lib/cn'

/**
 * Kunci penyimpanan jawaban kuesioner.
 *
 * KENAPA DISIMPAN: dulu jawaban hanya hidup di state komponen, jadi begitu
 * pengguna pindah menu — atau menutup halaman — 12 jawabannya HILANG dan harus
 * diisi ulang dari awal. Itu bertentangan dengan janji di kartu "Tips
 * Mengisi": "jawaban Anda bersifat rahasia dan hanya untuk meningkatkan
 * kualitas layanan". Menyimpannya di peramban sendiri juga menjaga janji
 * "tidak ada jawaban yang dikirim ke mana pun".
 */
const KUNCI_JAWABAN = 'pahami-sehat:kuesioner'

/** Baca jawaban tersimpan. Nilai yang tidak sah dibuang, bukan dipercaya. */
function bacaJawaban() {
  try {
    const isi = JSON.parse(localStorage.getItem(KUNCI_JAWABAN) || '{}')
    if (!isi || typeof isi !== 'object') return {}
    const bersih = {}
    for (const [k, v] of Object.entries(isi)) {
      const i = Number(k)
      const j = Number(v)
      if (Number.isInteger(i) && i >= 0 && i < QUIZ_ITEMS.length && Number.isInteger(j) && j >= 0 && j <= 3) {
        bersih[i] = String(j)
      }
    }
    return bersih
  } catch {
    return {}
  }
}

function simpanJawaban(jawaban) {
  try {
    localStorage.setItem(KUNCI_JAWABAN, JSON.stringify(jawaban))
  } catch {
    /* penyimpanan diblokir — jawaban tetap jalan untuk sesi ini */
  }
}

/**
 * Kuesioner HLS-SF12 — 12 item asli, satu pertanyaan per langkah.
 *
 * Instrumennya diambil dari paper validasinya (Duong et al., 2019) beserta
 * terjemahan bahasa Indonesia yang tervalidasi — bukan pernyataan karangan.
 * Rinciannya di docs/sumber-hls-sf12.txt. Karena kalimatnya baku, sengaja
 * TIDAK diterjemahkan ke Inggris: menerjemahkan ulang membuat skornya tidak
 * bisa dibandingkan dengan rujukan.
 *
 * Tata letaknya mengikuti rancangan yang diminta: judul + progres di atas,
 * satu pertanyaan per layar dengan navigasi "Sebelumnya/Selanjutnya", opsi
 * berupa baris penuh (radio + ikon + label + subteks), dan sidebar kanan
 * berisi progres, keterangan instrumen, serta tips pengisian.
 *
 * Perhitungan skor dijalankan lokal di peramban — tidak ada jawaban yang
 * dikirim ke mana pun.
 */

/**
 * Empat pilihan jawaban.
 *
 * Label dan subteksnya lewat kamus karena ini teks antarmuka, bukan teks
 * instrumen. (Subteksnya sendiri menyalin persis rancangan yang diminta jagi.)
 *
 * Skor mengikuti HLS-SF12: sangat sulit = 0 … sangat mudah = 3, jadi makin
 * rendah berarti makin sedikit yang sanggup dilakukan pengguna.
 */
const OPSI = (t) => [
  { label: t('kuis.opsi0'), sub: t('kuis.opsi0Sub'), Ikon: Frown, ikon: 'rose' },
  { label: t('kuis.opsi1'), sub: t('kuis.opsi1Sub'), Ikon: Annoyed, ikon: 'amber' },
  { label: t('kuis.opsi2'), sub: t('kuis.opsi2Sub'), Ikon: Smile, ikon: 'emerald' },
  { label: t('kuis.opsi3'), sub: t('kuis.opsi3Sub'), Ikon: Laugh, ikon: 'brand' },
]

/** Warna latar/ikon tiap tingkat jawaban — makin ke kanan makin hijau. */
const WARNA = {
  rose: 'bg-rose-100 text-rose-600',
  amber: 'bg-amber-100 text-amber-600',
  emerald: 'bg-emerald-100 text-emerald-600',
  brand: 'bg-brand-100 text-brand-700',
}

export default function QuizPanel({ t = (k) => k }) {
  const [answers, setAnswers] = useState(bacaJawaban)
  const [error, setError] = useState('')
  const [result, setResult] = useState(null)
  const /** Langkah yang sedang tampil, 0-based. */ [langkah, setLangkah] = useState(0)

  const TOTAL = QUIZ_ITEMS.length
  const jawaban = Number(answers[langkah])
  const terjawab = Object.keys(answers).length
  const persen = Math.round((terjawab / TOTAL) * 100)
  const terakhir = langkah >= TOTAL - 1

  const pilih = (j) => {
    setAnswers((prev) => {
      const baru = { ...prev, [langkah]: String(j) }
      simpanJawaban(baru)
      return baru
    })
    setError('')
  }

  const maju = (e) => {
    e.preventDefault()
    if (!terakhir) {
      setLangkah((s) => Math.min(TOTAL - 1, s + 1))
      window.scrollTo({ top: 0, behavior: 'smooth' })
      return
    }
    // Lompatan bebas artinya masih ada yang bolong. Pesan "masih ada N yang
    // belum dijawab" saja tidak cukup: pengguna perlu TAHU soal yang bolong,
    // kalau tidak dia harus menebak satu per satu di antara 12 pertanyaan.
    // Jadi langsung dibawa ke soal pertama yang belum terjawab.
    const bolong = QUIZ_ITEMS.findIndex((_, i) => answers[i] === undefined)
    if (bolong >= 0) {
      setError(t('kuis.belumDijawab', { n: TOTAL - terjawab }))
      setLangkah(bolong)
      window.scrollTo({ top: 0, behavior: 'smooth' })
      return
    }
    setError('')
    hitung()
  }

  const mundur = () => {
    setLangkah((s) => Math.max(0, s - 1))
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  const hitung = () => {
    // Skala jawaban 0–3 (4 pilihan), jadi skor maksimum = jumlah item x 3.
    // Sebelumnya dibagi (jumlah item - 1) x 4, sehingga 100% tidak pernah tercapai.
    const total = QUIZ_ITEMS.reduce((sum, _, i) => sum + Number(answers[i]), 0)
    const maks = TOTAL * 3
    const pct = Math.round((total / maks) * 100)

    let kategori
    let saran
    if (pct >= 70) {
      kategori = t('kuis.baik')
      saran = t('kuis.saranBaik')
    } else if (pct >= 45) {
      kategori = t('kuis.sedang')
      saran = t('kuis.saranSedang')
    } else {
      kategori = t('kuis.perluDukungan')
      saran = t('kuis.saranPerlu')
    }

    setResult({ pct, kategori, saran })
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  const ulangi = () => {
    setAnswers({})
    // hapus juga dari penyimpanan — kalau tidak, jawaban lama hidup lagi
    // begitu halaman disegarkan (kesalahan yang sama seperti pada daftar obrolan)
    simpanJawaban({})
    setResult(null)
    setError('')
    setLangkah(0)
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  const opsi = OPSI(t)
  const R = 26
  const CIRC = 2 * Math.PI * R
  /** Id judul pertanyaan yang sedang tampil — dipakai `aria-labelledby`.
   * Sebelumnya di sini tertulis tetap "q-0", padahal elemen ber-id itu TIDAK
   * PERNAH ada di halaman. Akibatnya grup radio tidak punya nama aksesibel:
   * pembaca layar hanya membacakan keempat pilihan tanpa pertanyaannya. */
  const idJudul = `q-soal-${langkah}`

  return (
    <div className="grid gap-[clamp(1rem,0.5rem+1.6vw,1.75rem)] lg:grid-cols-[minmax(0,1fr)_20rem] lg:items-start">
      <div className="space-y-[clamp(1rem,1.6vw,1.75rem)] min-w-0">
        <SectionHeading
          as="h1"
          eyebrow={t('kuis.eyebrow')}
          title={t('kuis.judul')}
          description={t('kuis.sub')}
          ilustrasi="kuesioner"
          action={
            <span className="inline-flex items-center gap-1.5 rounded-full border border-line-200 bg-white px-3 py-1.5 text-[0.82rem] font-semibold text-navy-600">
              <Clock className="size-3.5 text-brand-700" aria-hidden="true" />
              {t('kuis.waktu')}
            </span>
          }
        />

        {/* --- penanda posisi pertanyaan --------------------------------- */}
        <div>
          <div className="mb-2 flex items-baseline justify-between gap-3">
            <p className="text-[1.05rem] font-extrabold text-brand-700">
              {langkah + 1} <span className="text-navy-400">/ {TOTAL}</span>
            </p>
            <p className="text-[0.82rem] text-muted-500">
              {t('kuis.pertanyaanDari', { n: langkah + 1, b: TOTAL })}
            </p>
          </div>
          <div
            className="h-2 overflow-hidden rounded-full bg-surface-200"
            role="progressbar"
            aria-valuemin={1}
            aria-valuemax={TOTAL}
            aria-valuenow={langkah + 1}
            aria-label={t('kuis.pertanyaanDari', { n: langkah + 1, b: TOTAL })}
          >
            <span
              className="block h-full rounded-full bg-brand-500 transition-[width] duration-300 motion-reduce:transition-none"
              style={{ width: `${((langkah + 1) / TOTAL) * 100}%` }}
            />
          </div>
        </div>

        {/* --- kartu pertanyaan ------------------------------------------- */}
        <form onSubmit={maju} noValidate>
          <Card className="p-[clamp(1rem,0.85rem+0.7vw,1.6rem)]">
            <div className="mb-3 flex items-start gap-3">
              <span className="grid size-9 shrink-0 place-items-center rounded-xl bg-brand-50 text-[0.95rem] font-extrabold text-brand-700 ring-1 ring-brand-100">
                {langkah + 1}
              </span>
              <p
                id={idJudul}
                className="min-w-0 pt-1 text-[clamp(0.98rem,0.9rem+0.3vw,1.12rem)] leading-snug font-bold text-navy-900"
              >
                {QUIZ_ITEMS[langkah]}
              </p>
            </div>

            <p className="mb-3 text-[0.82rem] text-muted-500">{t('kuis.instruksi')}</p>

            <div role="radiogroup" aria-labelledby={idJudul} className="space-y-2">
              {opsi.map((o, j) => {
                const checked = jawaban === j
                return (
                  <label
                    key={o.label}
                    className={cn(
                      'flex cursor-pointer items-start gap-3 rounded-xl border px-3.5 py-3 transition-all duration-200',
                      'focus-within:outline-2 focus-within:outline-offset-2 focus-within:outline-brand-500',
                      checked
                        ? 'border-brand-300 bg-brand-50'
                        : 'border-line-200 bg-white hover:border-line-300 hover:bg-surface-50',
                    )}
                  >
                    <input
                      type="radio"
                      name={`q-${langkah}`}
                      value={j}
                      checked={checked}
                      onChange={() => pilih(j)}
                      className="sr-only"
                    />
                    {/* lingkaran radio terlihat — supaya status terpilih tidak
                        hanya ditandai oleh warna latar */}
                    <span
                      className={cn(
                        'mt-0.5 grid size-[18px] shrink-0 place-items-center rounded-full border-2 transition-colors',
                        checked ? 'border-brand-500' : 'border-line-300',
                      )}
                      aria-hidden="true"
                    >
                      {checked ? (
                        <span className="size-2 rounded-full bg-brand-500" />
                      ) : null}
                    </span>

                    <span className={cn('grid size-9 shrink-0 place-items-center rounded-lg', WARNA[o.ikon])}>
                      <o.Ikon className="size-[18px]" aria-hidden="true" />
                    </span>

                    <span className="min-w-0 flex-1">
                      <span className="block text-[0.92rem] font-bold text-navy-900">{o.label}</span>
                      <span className="mt-0.5 block text-[0.8rem] leading-snug text-navy-500">
                        {o.sub}
                      </span>
                    </span>
                  </label>
                )
              })}
            </div>
          </Card>

          {error ? (
            <p
              role="alert"
              className="mt-3 inline-flex items-center gap-2 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-[0.86rem] font-semibold text-rose-700"
            >
              <AlertCircle className="size-4 shrink-0" aria-hidden="true" />
              {error}
            </p>
          ) : null}

          <div className="mt-4 flex flex-wrap items-center gap-2.5">
            <Button
              type="button"
              variant="neutral"
              size="lg"
              onClick={mundur}
              disabled={langkah === 0}
            >
              <ArrowLeft className="size-4" aria-hidden="true" />
              {t('kuis.sebelumnya')}
            </Button>
            <Button type="submit" size="lg" className="sm:ml-auto">
              {terakhir ? t('kuis.lihat') : t('kuis.selanjutnya')}
              {terakhir ? (
                <Check className="size-4" aria-hidden="true" />
              ) : (
                <ArrowRight className="size-4" aria-hidden="true" />
              )}
            </Button>
          </div>
        </form>

        {result ? (
          <Card
            className="rise flex flex-col items-center gap-5 p-[clamp(1.1rem,0.9rem+0.8vw,1.75rem)] sm:flex-row"
            aria-live="polite"
          >
            <svg viewBox="0 0 120 120" className="size-[130px] shrink-0 -rotate-90" aria-hidden="true">
              <circle cx="60" cy="60" r={R} fill="none" stroke="#e8eef5" strokeWidth="12" />
              <circle
                cx="60"
                cy="60"
                r={R}
                fill="none"
                stroke="#17a398"
                strokeWidth="12"
                strokeLinecap="round"
                strokeDasharray={CIRC}
                strokeDashoffset={CIRC - (CIRC * result.pct) / 100}
                style={{ transition: 'stroke-dashoffset .7s cubic-bezier(.22,.61,.36,1)' }}
              />
            </svg>
            <div className="min-w-0 flex-1 text-center sm:text-left">
              <p className="text-[2rem] leading-none font-extrabold text-navy-900">
                {result.pct}
                <span className="text-[1.1rem] font-bold text-navy-500">%</span>
              </p>
              <p className="mt-1 text-[clamp(1rem,0.96rem+0.25vw,1.18rem)] font-bold text-brand-700">
                {t('kuis.hasil')}: {result.kategori}
              </p>
              <p className="mt-2 max-w-[60ch] text-[0.92rem] leading-relaxed text-navy-700">
                {result.saran}
              </p>
              <p className="mt-3 text-[0.82rem] text-muted-500">{t('kuis.catatan')}</p>
              <div className="mt-4">
                <Button variant="neutral" size="md" onClick={ulangi}>
                  {t('kuis.ulangi')}
                </Button>
              </div>
            </div>
          </Card>
        ) : null}

        {!result && terjawab === 0 ? (
          <EmptyState
            title={t('kuis.hasilTampil')}
            description={t('kuis.hasilTampilSub')}
          />
        ) : null}
      </div>

      {/* ---------------- sidebar kanan ---------------- */}
      <aside className="space-y-[clamp(1rem,1.6vw,1.75rem)] min-w-0">
        {/* progres kuesioner */}
        <Card className="p-4">
          <div className="flex items-center gap-3.5">
            <svg viewBox="0 0 120 120" className="size-[68px] shrink-0 -rotate-90" aria-hidden="true">
              <circle cx="60" cy="60" r={R} fill="none" stroke="#e8eef5" strokeWidth="14" />
              <circle
                cx="60"
                cy="60"
                r={R}
                fill="none"
                stroke="#17a398"
                strokeWidth="14"
                strokeLinecap="round"
                strokeDasharray={CIRC}
                strokeDashoffset={CIRC - (CIRC * persen) / 100}
                style={{ transition: 'stroke-dashoffset .5s ease' }}
              />
            </svg>
            <div className="min-w-0">
              <p className="text-[1.35rem] leading-none font-extrabold text-navy-900">{persen}%</p>
              <p className="mt-1 text-[0.86rem] font-bold text-navy-800">{t('kuis.progres')}</p>
              <p className="text-[0.82rem] text-muted-500">
                {t('kuis.selesai', { n: terjawab, b: TOTAL })}
              </p>
            </div>
          </div>
          <div className="mt-3 h-2 overflow-hidden rounded-full bg-surface-200">
            <span
              className="block h-full rounded-full bg-brand-500 transition-[width] duration-500 motion-reduce:transition-none"
              style={{ width: `${persen}%` }}
            />
          </div>
          <p className="mt-2 text-[0.82rem] text-muted-500">
            {t('kuis.terjawabDari', { a: terjawab, b: TOTAL })}
          </p>
        </Card>

        <Card className="p-4">
          <div className="flex items-center gap-2">
            <Info className="size-4 shrink-0 text-brand-700" aria-hidden="true" />
            <h2 className="text-[0.92rem] font-bold text-navy-900">{t('kuis.tentang')}</h2>
          </div>
          <p className="mt-2 text-[0.82rem] leading-relaxed text-navy-600">{t('kuis.tentangIsi')}</p>
        </Card>

        <Card className="p-4">
          <div className="flex items-center gap-2">
            <Lightbulb className="size-4 shrink-0 text-amber-500" aria-hidden="true" />
            <h2 className="text-[0.92rem] font-bold text-navy-900">{t('kuis.tips')}</h2>
          </div>
          <ul className="mt-2.5 space-y-2">
            {[t('kuis.tip1'), t('kuis.tip2'), t('kuis.tip3')].map((tip) => (
              <li key={tip} className="flex gap-2 text-[0.8rem] leading-snug text-navy-600">
                <Check className="mt-0.5 size-3.5 shrink-0 text-brand-700" aria-hidden="true" />
                <span>{tip}</span>
              </li>
            ))}
          </ul>
        </Card>

        <div className="rounded-xl bg-brand-600 p-4 text-white">
          <p className="text-[0.84rem] leading-relaxed">{t('kuis.saranDari')}</p>
        </div>
      </aside>
    </div>
  )
}
