import { useCallback, useEffect, useRef, useState } from 'react'
import Sidebar from './components/layout/Sidebar'
import TopBar from './components/layout/TopBar'
import MobileDrawer from './components/layout/MobileDrawer'
import Greeting from './components/dashboard/Greeting'
import AskAI from './components/dashboard/AskAI'
import TopicChips from './components/dashboard/TopicChips'
import ArticleGrid from './components/dashboard/ArticleGrid'
import HealthTip from './components/dashboard/HealthTip'
import RecentHistory from './components/dashboard/RecentHistory'
import VoicePanel from './components/dashboard/VoicePanel'
import QuizPanel from './components/dashboard/QuizPanel'
import SettingsPanel from './components/dashboard/SettingsPanel'
import ThreadPanel from './components/dashboard/ThreadPanel'
import SederhanakanPanel from './components/dashboard/SederhanakanPanel'
import VerifikasiPanel from './components/dashboard/VerifikasiPanel'
import { SectionHeading, EmptyState } from './components/ui/primitives'
import { History, ArrowLeft, PlugZap, Plug } from 'lucide-react'
import { TOPICS, ARTICLES, HEALTH_TIP, HISTORY } from './data/dummy'
import { TINGKAT, TINGKAT_DEFAULT } from './data/tingkat'
import { useServer } from './lib/useServer'
import { gunakanBahasa } from './lib/useBahasa'
import { tanyaStream, ambilKonten } from './lib/api'
import { ttsBaca, ttsBerhenti } from './lib/tts'

const DEFAULT_SETTINGS = { level: TINGKAT_DEFAULT, kontras: false, tts: false, lang: 'id' }

/** Balasan API → bentuk yang dipakai komponen tampilan. */
function kePesan(h) {
  return {
    text: h.jawaban,
    sources: h.sumber ?? [],
    poinKunci: h.poinKunci ?? [],
    catatan: h.catatan ?? '',
    // komponen tampilan memakai 'negative' untuk memilih gaya pill sumber
    verdict: h.verdict === 'tidak_didukung' ? 'negative' : 'ok',
  }
}

/**
 * Riwayat pertanyaan.
 *
 * Disimpan di localStorage peramban supaya benar-benar bertahan setelah
 * halaman dimuat ulang — bukan hanya selama sesi. Panel Riwayat menyatakan
 * "tersimpan di memori peramban saja", jadi datanya memang harus ada di sana;
 * sebelumnya riwayat hanya hidup di state React dan hilang begitu halaman
 * disegarkan.
 *
 * Isinya sengaja dibatasi 12 entri terakhir, dan jawaban dipotong 96 karakter
 * supaya tidak memakan ruang penyimpanan.
 */
const KUNCI_RIWAYAT = 'pahami-sehat:riwayat'
const MAKS_RIWAYAT = 12

function bacaRiwayat() {
  try {
    const isi = JSON.parse(localStorage.getItem(KUNCI_RIWAYAT) || '[]')
    if (!Array.isArray(isi) || !isi.length) return null
    return isi.filter((x) => x && x.id && x.question)
  } catch {
    return null
  }
}

function simpanRiwayat(daftar) {
  try {
    localStorage.setItem(KUNCI_RIWAYAT, JSON.stringify(daftar.slice(0, MAKS_RIWAYAT)))
  } catch {
    /* penyimpanan penuh / diblokir — riwayat tetap jalan untuk sesi ini */
  }
}

/**
 * Setelan pengguna.
 *
 * Disimpan di localStorage supaya bertahan antar kunjungan. Panel Pengaturan
 * menyatakan "Disimpan di peramban ini saja", jadi datanya memang harus ada di
 * sana. Ini penting terutama untuk mode kontras tinggi: pengguna gangguan
 * penglihatan tidak boleh dipaksa menyalakannya ulang setiap kali membuka
 * aplikasi.
 *
 * Nilai dari penyimpanan TIDAK dipercaya begitu saja — bisa saja sudah tua
 * atau diubah tangan. Setiap kolom diperiksa satu per satu, dan yang tidak
 * sah diganti nilai bawaan.
 */
const KUNCI_SETELAN = 'pahami-sehat:setelan'

function bacaSetelan() {
  try {
    const isi = JSON.parse(localStorage.getItem(KUNCI_SETELAN) || 'null')
    if (!isi || typeof isi !== 'object') return DEFAULT_SETTINGS
    const tingkatSah = TINGKAT.some((x) => x.kunci === isi.level)
    return {
      level: tingkatSah ? isi.level : DEFAULT_SETTINGS.level,
      kontras: isi.kontras === true,
      tts: isi.tts === true,
      lang: isi.lang === 'en' ? 'en' : 'id',
    }
  } catch {
    return DEFAULT_SETTINGS
  }
}

function simpanSetelan(s) {
  try {
    localStorage.setItem(KUNCI_SETELAN, JSON.stringify(s))
  } catch {
    /* penyimpanan diblokir — setelan tetap jalan untuk sesi ini */
  }
}

export default function App() {
  const [active, setActive] = useState('beranda')
  const [drawerOpen, setDrawerOpen] = useState(false)
  const [unread, setUnread] = useState(true)

  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [streamTeks, setStreamTeks] = useState('')
  const [statusPesan, setStatusPesan] = useState('')
  const [error, setError] = useState(null)
  const [sumberCari, setSumberCari] = useState([])
  const [result, setResult] = useState(null)
  const [askedQuestion, setAskedQuestion] = useState('')
  const [selectedTopic, setSelectedTopic] = useState(null)
  const [thread, setThread] = useState([])
  const [history, setHistory] = useState(() => bacaRiwayat() ?? HISTORY)
  const [settings, setSettings] = useState(() => bacaSetelan())

  // simpan riwayat ke peramban setiap kali berubah
  useEffect(() => {
    simpanRiwayat(history)
  }, [history])

  const server = useServer()
  const { kode: kodeBahasa, t } = gunakanBahasa(settings.lang)
  const labelTingkat = useCallback((kunci) => t(`tingkat.${kunci}`), [t])
  const batalRef = useRef(null)

  // supaya `ask` selalu melihat nilai tts terbaru tanpa ikut jadi dependensi
  const ttsAutoRef = useRef(settings.tts)
  ttsAutoRef.current = settings.tts

  // --- konten harian (topik populer, artikel, tips) ----------------------
  // Isinya diperbarui sekali sehari di sisi server (server/konten.js).
  // Selama belum termuat — atau kalau server tidak bisa dihubungi — yang
  // tampil adalah konten bawaan supaya halaman tidak pernah kosong.
  const [konten, setKonten] = useState({
    topik: TOPICS,
    artikel: ARTICLES,
    tips: HEALTH_TIP,
    dariServer: false,
    diperbarui: null,
    diperiksa: null,
  })

  useEffect(() => {
    const ac = new AbortController()
    ambilKonten(ac.signal)
      .then((d) => {
        if (!d?.ok) return
        setKonten({
          topik: d.topik?.length ? d.topik : TOPICS,
          artikel: d.artikel?.length ? d.artikel : ARTICLES,
          tips: d.tips ?? HEALTH_TIP,
          dariServer: true,
          diperbarui: d.diperbarui ?? null,
          diperiksa: d.diperiksa ?? null,
        })
      })
      .catch(() => {
        /* server mati / offline -> pakai konten bawaan, tidak perlu diumumkan */
      })
    return () => ac.abort()
  }, [])

  // setelan disimpan ke peramban setiap kali berubah
  useEffect(() => {
    simpanSetelan(settings)
  }, [settings])

  // --- mode kontras tinggi ----------------------------------------------
  // Mengubah warna teks & permukaan, ketebalan garis, ukuran huruf dasar, dan
  // batas fokus sekaligus. Dipasang sebagai kelas pada <html> supaya seluruh
  // halaman ikut — termasuk bagian yang bukan dirender React.
  useEffect(() => {
    const akar = document.documentElement
    akar.classList.toggle('kontras-tinggi', Boolean(settings.kontras))
    return () => akar.classList.remove('kontras-tinggi')
  }, [settings.kontras])

  const navigate = useCallback((id) => {
    setActive(id)
    setDrawerOpen(false)
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }, [])

  const ask = useCallback(
    (raw) => {
      const text = (raw || '').trim()
      if (!text || loading) return

      batalRef.current?.abort()
      const ac = new AbortController()
      batalRef.current = ac

      setLoading(true)
      setResult(null)
      setError(null)
      setStreamTeks('')
      setSumberCari([])
      setStatusPesan('Menyiapkan jawaban…')
      setAskedQuestion(text)
      setInput('')

      // bubble user muncul langsung; jawaban AI menyusul saat stream selesai
      setThread((prev) => [...prev, { id: `u${Date.now()}`, role: 'user', text }])

      tanyaStream(
        { pertanyaan: text, tingkat: settings.level, bahasa: kodeBahasa },
        {
          signal: ac.signal,
          onStatus: (p) => setStatusPesan(p),
          onSumber: (h) => setSumberCari(h),
          onDelta: (t) => setStreamTeks((prev) => prev + t),
          onHasil: (h) => {
            setResult(h)
            setThread((prev) => [...prev, { id: `a${Date.now()}`, role: 'ai', ...kePesan(h) }])
            // putar suara otomatis kalau diaktifkan di Pengaturan
            if (ttsAutoRef.current) ttsBaca(h.jawaban)
            setHistory((prev) =>
              [
                {
                  id: `n${Date.now()}`,
                  question: text,
                  answer:
                    h.jawaban?.length > 96 ? `${h.jawaban.slice(0, 96).trimEnd()}…` : h.jawaban,
                  time: 'Baru saja',
                  sources: (h.sumber ?? []).map((s) => s.penerbit || s.judul).filter(Boolean),
                },
                ...prev,
              ].slice(0, MAKS_RIWAYAT),
            )
          },
        },
      )
        .catch((e) => {
          if (e?.name === 'AbortError') return
          setError({ pesan: e.message, code: e.code })
        })
        .finally(() => {
          setLoading(false)
          setStreamTeks('')
          setStatusPesan('')
        })
    },
    [loading, settings.level],
  )

  const handleTopic = (id) => {
    if (!id) {
      setSelectedTopic(null)
      return
    }
    setSelectedTopic(id)
    const t = konten.topik.find((x) => x.id === id)
    const label = t?.label ?? ''
    // pakai kalimat tanya yang disiapkan server; kalau tidak ada, susun sendiri
    ask(t?.tanya ?? `Apa yang perlu saya ketahui tentang ${label.toLowerCase()}?`)
  }

  const useVoiceResult = (text) => {
    setInput(text)
    navigate('tanya')
  }

  return (
    <div className="flex min-h-dvh w-full bg-bg">
      <a
        href="#konten"
        className="sr-only focus:not-sr-only focus:fixed focus:top-3 focus:left-3 focus:z-[60] focus:rounded-xl focus:bg-brand-600 focus:px-4 focus:py-2.5 focus:text-sm focus:font-semibold focus:text-white"
      >
        Lompat ke konten utama
      </a>

      <Sidebar active={active} onSelect={navigate} t={t} />

      <div className="flex min-w-0 flex-1 flex-col">
        <TopBar
          onOpenMenu={() => setDrawerOpen(true)}
          menuOpen={drawerOpen}
          unread={unread}
          onDismissNotif={() => setUnread(false)}
        />
        <MobileDrawer
          open={drawerOpen}
          onClose={() => setDrawerOpen(false)}
          active={active}
          onSelect={navigate}
          t={t}
        />

        <main
          id="konten"
          className="flex-1 px-[clamp(1rem,0.35rem+2.1vw,2.5rem)] py-[clamp(1.25rem,1rem+1vw,2.25rem)]"
        >
          <div className="mx-auto w-full max-w-[86rem]">
            {active === 'beranda' ? (
              <div className="space-y-[clamp(1.4rem,1.1rem+1.1vw,2.4rem)]">
                <Greeting />

                <AskAI
                  t={t}
                  value={input}
                  onChange={setInput}
                  onAsk={ask}
                  loading={loading}
                  question={askedQuestion}
                  result={result}
                  streaming={streamTeks}
                  statusPesan={statusPesan}
                  error={error}
                  sumberCari={sumberCari}
                  serverOnline={server.online}
                  serverMemuat={server.memuat}
                />
                <TopicChips
                  topics={konten.topik}
                  selected={selectedTopic}
                  onSelect={handleTopic}
                  diperbarui={konten.diperbarui}
                  diperiksa={konten.diperiksa}
                />
                <HealthTip tip={konten.tips} />
                <ArticleGrid articles={konten.artikel} />
                <RecentHistory items={history} onSeeAll={() => navigate('riwayat')} />
              </div>
            ) : null}

            {active === 'tanya' ? (
              <ThreadPanel
                t={t}
                input={input}
                onInputChange={setInput}
                onAsk={ask}
                loading={loading}
                thread={thread}
                streaming={streamTeks}
                statusPesan={statusPesan}
                error={error}
                sumberCari={sumberCari}
                serverOnline={server.online}
                serverMemuat={server.memuat}
              />
            ) : null}

            {active === 'sederhanakan' ? (
              <SederhanakanPanel
                t={t}
                labelTingkat={labelTingkat}
                tingkat={settings.level}
                onTingkatChange={(lv) => setSettings((s) => ({ ...s, level: lv }))}
                serverOnline={server.online}
                serverMemuat={server.memuat}
              />
            ) : null}

            {active === 'verifikasi' ? (
              <VerifikasiPanel
                t={t}
                labelTingkat={labelTingkat}
                tingkat={settings.level}
                onTingkatChange={(lv) => setSettings((s) => ({ ...s, level: lv }))}
                serverOnline={server.online}
                serverMemuat={server.memuat}
              />
            ) : null}

            {active === 'suara' ? <VoicePanel onUse={useVoiceResult} /> : null}

            {active === 'riwayat' ? (
              <div className="space-y-[clamp(1rem,1.6vw,1.75rem)]">
                <SectionHeading
                  eyebrow="Arsip"
                  title="Riwayat"
                  description="Pertanyaan yang diajukan pada sesi ini. Tersimpan di memori peramban saja."
                  ilustrasi="riwayat"
                />
                {history.length === 0 ? (
                  <EmptyState
                    icon={History}
                    title="Belum ada riwayat"
                    description="Mulai dari Beranda untuk mengajukan pertanyaan pertama."
                    action={
                      <button
                        type="button"
                        onClick={() => navigate('beranda')}
                        className="mt-1 inline-flex items-center gap-2 rounded-xl bg-brand-500 px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-brand-600"
                      >
                        <ArrowLeft className="size-4" aria-hidden="true" />
                        Ke Beranda
                      </button>
                    }
                  />
                ) : (
                  <RecentHistory items={history} max={history.length} />
                )}
              </div>
            ) : null}

            {active === 'kuesioner' ? <QuizPanel t={t} /> : null}
            {active === 'pengaturan' ? (
              <SettingsPanel settings={settings} onChange={setSettings} t={t} labelTingkat={labelTingkat} />
            ) : null}
          </div>
        </main>

        <footer className="border-t border-line-200 bg-white px-[clamp(1rem,0.35rem+2.1vw,2.5rem)] py-5">
          <div className="mx-auto flex w-full max-w-[86rem] flex-wrap items-center justify-between gap-x-6 gap-y-2">
            <p className="text-[0.8rem] font-semibold text-navy-700">
              Pahami Sehat <span className="font-normal text-muted-500">· Created by NØCTURNE</span>
            </p>
            <p className="flex items-center gap-1.5 text-[0.78rem] text-muted-500">
              {server.memuat ? (
                <>
                  <Plug className="size-3.5" aria-hidden="true" /> {t('umum.memeriksa')}
                </>
              ) : server.online ? (
                <>
                  <PlugZap className="size-3.5 text-brand-600" aria-hidden="true" />
                  {t('umum.terhubung')}
                </>
              ) : (
                <>
                  <Plug className="size-3.5 text-amber-600" aria-hidden="true" />
                  {t('umum.serverMati')} — {t('umum.jalankan')}{' '}
                  <code className="font-mono">npm run server</code>
                </>
              )}
            </p>
            <p className="flex items-center gap-1.5 text-[0.78rem] text-muted-500">
              <a
                href="https://lottiefiles.com/free-animation/doctor-welcoming-pacient-xsA9dFGcUA"
                target="_blank"
                rel="noopener noreferrer"
                className="underline decoration-dotted underline-offset-2 hover:text-navy-700"
              >
                Ilustrasi animasi: LottieFiles
              </a>
            </p>
          </div>
        </footer>
      </div>
    </div>
  )
}
