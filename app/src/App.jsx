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
import TombolDengar from './components/ui/TombolDengar'
import { History, ArrowLeft, PlugZap, Plug, WifiOff } from 'lucide-react'
import { TOPICS, ARTICLES, HEALTH_TIP, HISTORY } from './data/dummy'
import { TINGKAT_DEFAULT } from './data/tingkat'
import { useServer } from './lib/useServer'
import { tanyaStream } from './lib/api'
import { ttsBaca, ttsBerhenti } from './lib/tts'
import { ambilCache, hapusCache, simpanCache, sedangOffline } from './lib/offline'

const DEFAULT_SETTINGS = { level: TINGKAT_DEFAULT, offline: false, tts: false, lang: 'id' }

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

export default function App() {
  const [active, setActive] = useState('beranda')
  const [drawerOpen, setDrawerOpen] = useState(false)
  const [unread, setUnread] = useState(true)

  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [streamTeks, setStreamTeks] = useState('')
  const [statusPesan, setStatusPesan] = useState('')
  const [error, setError] = useState(null)
  const [result, setResult] = useState(null)
  const [askedQuestion, setAskedQuestion] = useState('')
  const [selectedTopic, setSelectedTopic] = useState(null)
  const [thread, setThread] = useState([])
  const [history, setHistory] = useState(HISTORY)
  const [settings, setSettings] = useState(DEFAULT_SETTINGS)

  const server = useServer()
  const batalRef = useRef(null)

  // supaya `ask` selalu melihat nilai tts terbaru tanpa ikut jadi dependensi
  const ttsAutoRef = useRef(settings.tts)
  ttsAutoRef.current = settings.tts

  // --- mode hemat sinyal -------------------------------------------------
  const [cache, setCache] = useState(() => ambilCache())
  const [offline, setOffline] = useState(() => sedangOffline())

  // pantau status jaringan
  useEffect(() => {
    const naik = () => setOffline(false)
    const turun = () => setOffline(true)
    window.addEventListener('online', naik)
    window.addEventListener('offline', turun)
    return () => {
      window.removeEventListener('online', naik)
      window.removeEventListener('offline', turun)
    }
  }, [])

  // simpan cache saat jawaban baru masuk, kalau modenya menyala
  useEffect(() => {
    if (!settings.offline || !result) return
    const pertanyaan = askedQuestion
    const oke = simpanCache({ pertanyaan, hasil: result, tingkat: settings.level })
    if (oke) setCache(ambilCache())
  }, [result, settings.offline, settings.level, askedQuestion])

  // matikan mode hemat sinyal → bersihkan simpanan
  const ubahSettings = useCallback((baru) => {
    setSettings((lama) => {
      if (lama.offline && !baru.offline) {
        hapusCache()
        setCache(null)
      }
      return baru
    })
  }, [])

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
      setStatusPesan('Menghubungi server…')
      setAskedQuestion(text)
      setInput('')

      // bubble user muncul langsung; jawaban AI menyusul saat stream selesai
      setThread((prev) => [...prev, { id: `u${Date.now()}`, role: 'user', text }])

      tanyaStream(
        { pertanyaan: text, tingkat: settings.level },
        {
          signal: ac.signal,
          onStatus: (p) => setStatusPesan(p),
          onDelta: (t) => setStreamTeks((prev) => prev + t),
          onHasil: (h) => {
            setResult(h)
            setThread((prev) => [...prev, { id: `a${Date.now()}`, role: 'ai', ...kePesan(h) }])
            // putar suara otomatis kalau diaktifkan di Pengaturan
            if (ttsAutoRef.current) ttsBaca(h.jawaban)
            setHistory((prev) => [
              {
                id: `n${Date.now()}`,
                question: text,
                answer:
                  h.jawaban?.length > 96 ? `${h.jawaban.slice(0, 96).trimEnd()}…` : h.jawaban,
                time: 'Baru saja',
                sources: (h.sumber ?? []).map((s) => s.penerbit || s.judul).filter(Boolean),
              },
              ...prev,
            ])
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
    const label = TOPICS.find((t) => t.id === id)?.label ?? ''
    ask(`Apa yang perlu saya ketahui tentang ${label.toLowerCase()}?`)
  }

  const useVoiceResult = (text) => {
    setInput(text)
    navigate('tanya')
  }

  return (
    <div className="flex min-h-dvh w-full bg-[#f7fafc]">
      <a
        href="#konten"
        className="sr-only focus:not-sr-only focus:fixed focus:top-3 focus:left-3 focus:z-[60] focus:rounded-xl focus:bg-brand-600 focus:px-4 focus:py-2.5 focus:text-sm focus:font-semibold focus:text-white"
      >
        Lompat ke konten utama
      </a>

      <Sidebar active={active} onSelect={navigate} />

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
        />

        <main
          id="konten"
          className="flex-1 px-[clamp(1rem,0.35rem+2.1vw,2.5rem)] py-[clamp(1.25rem,1rem+1vw,2.25rem)]"
        >
          <div className="mx-auto w-full max-w-[86rem]">
            {active === 'beranda' ? (
              <div className="space-y-[clamp(1.4rem,1.1rem+1.1vw,2.4rem)]">
                <Greeting />

                {/* mode hemat sinyal: jawaban terakhir tetap bisa dibaca tanpa internet */}
                {settings.offline && cache ? (
                  <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4">
                    <div className="mb-1.5 flex flex-wrap items-center gap-2">
                      <WifiOff className="size-4 shrink-0 text-amber-700" aria-hidden="true" />
                      <p className="text-[0.8rem] font-bold tracking-wide text-amber-800 uppercase">
                        {offline ? 'Sedang offline — jawaban terakhir' : 'Jawaban terakhir tersimpan'}
                      </p>
                    </div>
                    <p className="text-[0.86rem] font-semibold text-navy-800">“{cache.pertanyaan}”</p>
                    <p className="mt-1 text-[0.92rem] leading-relaxed whitespace-pre-wrap text-navy-700">
                      {cache.jawaban}
                    </p>
                    <div className="mt-2 flex flex-wrap items-center gap-3">
                      <TombolDengar teks={cache.jawaban} label="Dengar tersimpan" />
                      <span className="text-[0.76rem] text-amber-700">
                        Tersimpan di perangkat ini saja
                      </span>
                    </div>
                  </div>
                ) : null}

                <AskAI
                  value={input}
                  onChange={setInput}
                  onAsk={ask}
                  loading={loading}
                  question={askedQuestion}
                  result={result}
                  streaming={streamTeks}
                  statusPesan={statusPesan}
                  error={error}
                  serverOnline={server.online}
                  serverMemuat={server.memuat}
                />
                <TopicChips topics={TOPICS} selected={selectedTopic} onSelect={handleTopic} />
                <HealthTip tip={HEALTH_TIP} />
                <ArticleGrid articles={ARTICLES} />
                <RecentHistory items={history} onSeeAll={() => navigate('riwayat')} />
              </div>
            ) : null}

            {active === 'tanya' ? (
              <ThreadPanel
                input={input}
                onInputChange={setInput}
                onAsk={ask}
                loading={loading}
                thread={thread}
                streaming={streamTeks}
                statusPesan={statusPesan}
                error={error}
                serverOnline={server.online}
                serverMemuat={server.memuat}
              />
            ) : null}

            {active === 'sederhanakan' ? (
              <SederhanakanPanel
                tingkat={settings.level}
                onTingkatChange={(lv) => setSettings((s) => ({ ...s, level: lv }))}
                serverOnline={server.online}
                serverMemuat={server.memuat}
              />
            ) : null}

            {active === 'verifikasi' ? (
              <VerifikasiPanel
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

            {active === 'kuesioner' ? <QuizPanel /> : null}
            {active === 'pengaturan' ? (
              <SettingsPanel settings={settings} onChange={ubahSettings} />
            ) : null}
          </div>
        </main>

        <footer className="border-t border-slate-200 bg-white px-[clamp(1rem,0.35rem+2.1vw,2.5rem)] py-5">
          <div className="mx-auto flex w-full max-w-[86rem] flex-wrap items-center justify-between gap-x-6 gap-y-2">
            <p className="text-[0.8rem] font-semibold text-navy-700">
              Pahami Sehat <span className="font-normal text-slate-500">· LOGICODIX 2026</span>
            </p>
            <p className="flex items-center gap-1.5 text-[0.78rem] text-slate-500">
              {server.memuat ? (
                <>
                  <Plug className="size-3.5" aria-hidden="true" /> Memeriksa server…
                </>
              ) : server.online ? (
                <>
                  <PlugZap className="size-3.5 text-brand-600" aria-hidden="true" />
                  Terhubung · {server.model}
                </>
              ) : (
                <>
                  <Plug className="size-3.5 text-amber-600" aria-hidden="true" />
                  Server AI belum jalan — jalankan{' '}
                  <code className="font-mono">npm run server</code>
                </>
              )}
            </p>
          </div>
        </footer>
      </div>
    </div>
  )
}
