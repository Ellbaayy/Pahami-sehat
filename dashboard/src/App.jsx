import { useCallback, useState } from 'react'
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
import { SectionHeading, EmptyState } from './components/ui/primitives'
import { History, ArrowLeft } from 'lucide-react'
import {
  TOPICS,
  TOPIC_ANSWERS,
  ARTICLES,
  HEALTH_TIP,
  HISTORY,
} from './data/dummy'

/** Pemetaan pertanyaan → jawaban simulasi (tanpa API). */
function answerFor(text, topicId) {
  if (topicId && TOPIC_ANSWERS[topicId]) return TOPIC_ANSWERS[topicId]

  const t = text.toLowerCase()
  if (/(hoaks|klaim|autisme|menyebabkan|bohong|tidak benar|viral)/.test(t)) {
    return {
      text: 'Verdict: tidak ditemukan pada dokumen resmi manapun yang kami rujuk. Klaim semacam ini beredar luas tanpa bukti — sebelum dibagikan, verifikasi dulu ke Kemenkes, WHO, atau BPOM.',
      sources: ['WHO', 'BPOM'],
      verdict: 'negative',
    }
  }
  if (/(demam|panas|suhu)/.test(t)) return TOPIC_ANSWERS.demam
  if (/(obat|minum|antibiotik|dosis|resep)/.test(t)) return TOPIC_ANSWERS.obat
  if (/(imunisasi|vaksin|suntik)/.test(t)) return TOPIC_ANSWERS.imunisasi
  if (/(gizi|gula|nutrisi|label|kalori)/.test(t)) return TOPIC_ANSWERS.gizi
  if (/(mental|cemas|sedih|stres|tidur)/.test(t)) return TOPIC_ANSWERS.mental
  return TOPIC_ANSWERS.generic
}

const DEFAULT_SETTINGS = { level: 'SD', offline: false, tts: false, lang: 'id' }

export default function App() {
  const [active, setActive] = useState('beranda')
  const [drawerOpen, setDrawerOpen] = useState(false)
  const [unread, setUnread] = useState(true)

  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState(null)
  const [askedQuestion, setAskedQuestion] = useState('')
  const [selectedTopic, setSelectedTopic] = useState(null)
  const [thread, setThread] = useState([])
  const [history, setHistory] = useState(HISTORY)
  const [settings, setSettings] = useState(DEFAULT_SETTINGS)

  const navigate = useCallback((id) => {
    setActive(id)
    setDrawerOpen(false)
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }, [])

  const ask = useCallback(
    (raw, topicOverride) => {
      const text = (raw || '').trim()
      if (!text || loading) return

      const topic = topicOverride ?? null
      setLoading(true)
      setResult(null)
      setAskedQuestion(text)
      setInput('')

      // simulasi latensi — murni frontend
      window.setTimeout(() => {
        const answer = answerFor(text, topic)
        setResult(answer)
        setThread((prev) => [
          ...prev,
          { id: `u${Date.now()}`, role: 'user', text },
          {
            id: `a${Date.now() + 1}`,
            role: 'ai',
            text: answer.text,
            sources: answer.sources,
            verdict: answer.verdict,
          },
        ])
        setHistory((prev) => [
          {
            id: `n${Date.now()}`,
            question: text,
            answer:
              answer.text.length > 96 ? `${answer.text.slice(0, 96).trimEnd()}…` : answer.text,
            time: 'Baru saja',
            sources: answer.sources,
          },
          ...prev,
        ])
        setLoading(false)
      }, 900)
    },
    [loading],
  )

  const handleTopic = (id) => {
    if (!id) {
      setSelectedTopic(null)
      return
    }
    setSelectedTopic(id)
    const label = TOPICS.find((t) => t.id === id)?.label ?? ''
    ask(`Apa yang perlu saya ketahui tentang ${label.toLowerCase()}?`, id)
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
                <AskAI
                  value={input}
                  onChange={setInput}
                  onAsk={ask}
                  loading={loading}
                  question={askedQuestion}
                  result={result}
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
              />
            ) : null}

            {active === 'suara' ? <VoicePanel onUse={useVoiceResult} /> : null}

            {active === 'riwayat' ? (
              <div className="space-y-[clamp(1rem,1.6vw,1.75rem)]">
                <SectionHeading
                  eyebrow="Arsip"
                  title="Riwayat"
                  description="Seluruh pertanyaan yang diajukan di dashboard ini. Tidak dikirim ke server mana pun."
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
              <SettingsPanel settings={settings} onChange={setSettings} />
            ) : null}
          </div>
        </main>

        <footer className="border-t border-slate-200 bg-white px-[clamp(1rem,0.35rem+2.1vw,2.5rem)] py-5">
          <div className="mx-auto flex w-full max-w-[86rem] flex-wrap items-center justify-between gap-x-6 gap-y-2">
            <p className="text-[0.8rem] font-semibold text-navy-700">
              Pahami Sehat <span className="font-normal text-slate-500">· Prototipe frontend</span>
            </p>
            <p className="text-[0.78rem] text-slate-500">
              Data dummy, tanpa backend — seluruh jawaban disimulasikan di peramban.
            </p>
          </div>
        </footer>
      </div>
    </div>
  )
}
