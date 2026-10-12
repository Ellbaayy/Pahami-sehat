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
import ScanPanel from './components/dashboard/ScanPanel'
import { SectionHeading, EmptyState } from './components/ui/primitives'
import BatasGalat from './components/ui/BatasGalat'
import LoadingPage from './components/LoadingPage'
import { History, ArrowLeft, PlugZap, Plug } from 'lucide-react'
import { TOPICS, ARTICLES, HEALTH_TIP, contohRiwayat } from './data/dummy'
import { TINGKAT, TINGKAT_DEFAULT } from './data/tingkat'
import { useServer } from './lib/useServer'
import { gunakanBahasa } from './lib/useBahasa'
import { tanyaStream, ambilKonten } from './lib/api'
import { ttsBaca, ttsBerhenti } from './lib/tts'

const DEFAULT_SETTINGS = { level: TINGKAT_DEFAULT, kontras: false, tts: false, lang: 'id' }

/**
 * Terjemahkan pesan status yang dikirim server lewat SSE.
 *
 * Server mengirim teks status dalam bahasa Indonesia ("Mencari sumber
 * terpercaya…"). Kalau teks itu ditampilkan apa adanya, antarmuka berbahasa
 * Inggris akan menampilkan kalimat Indonesia di tengah proses — jadi teks yang
 * dikenali dipetakan ke kunci kamus, dan yang tidak dikenali ditampilkan
 * apa adanya (server boleh menambah status baru tanpa merusak tampilan).
 */
const STATUS_SERVER = {
  'Menyiapkan jawaban…': 'tanya.menyiapkan',
  'Mencari sumber terpercaya…': 'tanya.mencari',
}

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

/**
 * Sidebar desktop/tablet: terbuka (penuh) atau tertutup (rail ikon).
 *
 * Disimpan di peramban supaya pilihan jagi tidak kembali tertutup setiap
 * halaman dimuat ulang. Bawaannya TERBUKA — halaman yang baru pertama dibuka
 * harus langsung memperlihatkan navigasi lengkap, bukan rail ikon.
 */
const KUNCI_SIDEBAR = 'pahami-sehat:sidebar-terbuka'

function bacaSidebar() {
  try {
    return localStorage.getItem(KUNCI_SIDEBAR) !== '0'
  } catch {
    return true
  }
}

function simpanSidebar(terbuka) {
  try {
    localStorage.setItem(KUNCI_SIDEBAR, terbuka ? '1' : '0')
  } catch {
    /* penyimpanan diblokir — pilihan tetap jalan untuk sesi ini */
  }
}

export default function App() {
  const [active, setActive] = useState('beranda')
  const [drawerOpen, setDrawerOpen] = useState(false)
  const [sidebarTerbuka, setSidebarTerbuka] = useState(bacaSidebar)
  // pemberitahuan: titik merah hilang setelah panel dibuka sekali
  const [notifDibaca, setNotifDibaca] = useState(() => {
    try {
      return localStorage.getItem('pahami-sehat:notif-dibaca') === '1'
    } catch {
      return false
    }
  })

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

  /**
   * Riwayat yang ditampilkan.
   *
   * `null` berarti "belum ada riwayat sungguhan" — dan itu BUKAN sama dengan
   * "kosong". Yang ditampilkan saat null adalah contoh (contohRiwayat), supaya
   * halaman Beranda tidak pernah kosong saat pertama dibuka. Pemisahan ini
   * penting: notifikasi jumlah pertanyaan dan keadaan kosong di panel Riwayat
   * harus menghitung yang SUNGGUHAN, bukan contohnya. Sebelumnya keduanya
   * memakai satu daftar, sehingga contoh ikut dihitung sebagai "4 pertanyaan
   * tersimpan" padahal belum ada satu pun pertanyaan diajukan.
   */
  const [riwayat, setRiwayat] = useState(() => bacaRiwayat())
  const [settings, setSettings] = useState(() => bacaSetelan())

  const { kode: kodeBahasa, t } = gunakanBahasa(settings.lang)

  // Yang ditampilkan: riwayat sungguhan kalau ada, kalau belum pakai contoh.
  // Contohnya ikut bahasa antarmuka (lihat data/dummy.js).
  const history = riwayat?.length ? riwayat : contohRiwayat(kodeBahasa)
  const adaRiwayatSungguhan = Boolean(riwayat?.length)

  // simpan riwayat ke peramban setiap kali berubah — hanya yang sungguhan,
  // supaya contoh tidak pernah ikut tersimpan sebagai data pengguna
  useEffect(() => {
    if (riwayat) simpanRiwayat(riwayat)
  }, [riwayat])

  const server = useServer()

  // Pesan status dari server diterjemahkan lewat kamus supaya ikut bahasa
  // antarmuka. Yang tidak dikenali ditampilkan apa adanya.
  const terjemahkanStatus = useCallback(
    (pesan) => (STATUS_SERVER[pesan] ? t(STATUS_SERVER[pesan]) : pesan),
    [t],
  )

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

  // --- pemberitahuan -------------------------------------------------------
  // Isinya dihitung dari keadaan nyata, bukan contoh: kapan konten harian
  // terakhir diperbarui, berapa jawaban tersimpan, dan apakah server hidup.
  const notifikasi = []
  if (konten.diperbarui) {
    notifikasi.push({
      id: 'konten',
      jenis: 'konten',
      judul: t('notif.kontenJudul'),
      isi: t('notif.kontenIsi'),
      // tanggal mengikuti bahasa antarmuka, bukan selalu Indonesia
      waktu: new Date(konten.diperbarui).toLocaleDateString(t('umum.kodeLokal'), {
        day: 'numeric',
        month: 'long',
        year: 'numeric',
      }),
    })
  }
  // Notifikasi ini menghitung riwayat SUNGGUHAN, bukan contohnya. Sebelumnya
  // memakai daftar tampilan, sehingga contoh ikut dihitung dan pengguna baru
  // langsung melihat "4 pertanyaan tersimpan" padahal belum bertanya sekali pun.
  if (adaRiwayatSungguhan) {
    notifikasi.push({
      id: 'riwayat',
      jenis: 'riwayat',
      judul: t('notif.riwayatJudul', { n: riwayat.length }),
      isi: t('notif.riwayatIsi'),
    })
  }
  if (!server.memuat && !server.online) {
    notifikasi.push({
      id: 'server',
      jenis: 'server',
      judul: t('notif.serverJudul'),
      isi: t('notif.serverIsi'),
    })
  }

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
      setStatusPesan(t('tanya.menyiapkan'))
      setAskedQuestion(text)
      setInput('')

      // bubble user muncul langsung; jawaban AI menyusul saat stream selesai
      setThread((prev) => [...prev, { id: `u${Date.now()}`, role: 'user', text }])

      tanyaStream(
        { pertanyaan: text, tingkat: settings.level, bahasa: kodeBahasa },
        {
          signal: ac.signal,
          onStatus: (p) => setStatusPesan(terjemahkanStatus(p)),
          onSumber: (h) => setSumberCari(h),
          onDelta: (t) => setStreamTeks((prev) => prev + t),
          onHasil: (h) => {
            setResult(h)
            setThread((prev) => [...prev, { id: `a${Date.now()}`, role: 'ai', ...kePesan(h) }])
            // putar suara otomatis kalau diaktifkan di Pengaturan
            if (ttsAutoRef.current) ttsBaca(h.jawaban)
            setRiwayat((prev) =>
              [
                {
                  id: `n${Date.now()}`,
                  question: text,
                  answer:
                    h.jawaban?.length > 96 ? `${h.jawaban.slice(0, 96).trimEnd()}…` : h.jawaban,
                  time: t('riw.baruSaja'),
                  sources: (h.sumber ?? []).map((s) => s.penerbit || s.judul).filter(Boolean),
                },
                ...(prev ?? []),
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
    [loading, settings.level, t, terjemahkanStatus],
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

  /**
   * Teruskan teks hasil pindai foto ke fitur lain.
   *
   * Teks ditaruh di kotak isian, bukan langsung dikirim: pengguna masih bisa
   * memeriksa dan memperbaiki hasil pembacaan sebelum AI memakainya. Ini juga
   * sebabnya hasil pindai tidak pernah otomatis dikirim ke mana pun.
   */
  const kirimHasilPindai = (tujuan, teks) => {
    setInput(teks)
    navigate(tujuan)
  }

  return (
    <>
      <LoadingPage t={t} />
      <div className="flex min-h-dvh w-full bg-bg">
      <a
        href="#konten"
        className="sr-only focus:not-sr-only focus:fixed focus:top-3 focus:left-3 focus:z-[60] focus:rounded-xl focus:bg-brand-600 focus:px-4 focus:py-2.5 focus:text-sm focus:font-semibold focus:text-white"
      >
        Lompat ke konten utama
      </a>

      <Sidebar active={active} onSelect={navigate} terbuka={sidebarTerbuka} t={t} />

      <div className="flex min-w-0 flex-1 flex-col">
        <BatasGalat
          judul={t('galat.atasJudul')}
          pesan={t('galat.atasPesan')}
          t={t}
        >
          <TopBar
          onOpenMenu={() => setDrawerOpen(true)}
          menuOpen={drawerOpen}
          sidebarTerbuka={sidebarTerbuka}
          onToggleSidebar={() =>
            setSidebarTerbuka((v) => {
              const jadi = !v
              simpanSidebar(jadi)
              return jadi
            })
          }
          notifikasi={notifikasi}
          belumDibaca={!notifDibaca}
          onBaca={() => {
            setNotifDibaca(true)
            try {
              localStorage.setItem('pahami-sehat:notif-dibaca', '1')
            } catch {
              /* diabaikan */
            }
          }}
          onBuka={(n) => {
            if (n.jenis === 'konten') navigate('beranda')
            else if (n.jenis === 'riwayat') navigate('riwayat')
          }}
          t={t}
          />
        </BatasGalat>
        <MobileDrawer
          open={drawerOpen}
          onClose={() => setDrawerOpen(false)}
          active={active}
          onSelect={navigate}
          t={t}
        />

        <BatasGalat
          judul={t('galat.isiJudul')}
          pesan={t('galat.isiPesan')}
          t={t}
        >
        <main
          id="konten"
          className="flex-1 px-[clamp(1rem,0.35rem+2.1vw,2.5rem)] py-[clamp(1.25rem,1rem+1vw,2.25rem)]"
        >
          <div className="mx-auto w-full max-w-[86rem]">
            {active === 'beranda' ? (
              <div className="space-y-[clamp(1.4rem,1.1rem+1.1vw,2.4rem)]">
                <Greeting t={t} />

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
                  bahasa={kodeBahasa}
                />
                <TopicChips
                  topics={konten.topik}
                  selected={selectedTopic}
                  onSelect={handleTopic}
                  diperbarui={konten.diperbarui}
                  diperiksa={konten.diperiksa}
                  t={t}
                />
                <HealthTip tip={konten.tips} t={t} />
                <ArticleGrid articles={konten.artikel} t={t} />
                <RecentHistory items={history} onSeeAll={() => navigate('riwayat')} t={t} />
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
                bahasa={kodeBahasa}
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
                bahasa={kodeBahasa}
                teksAwal={input}
                onTeksAwalDipakai={() => setInput('')}
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
                bahasa={kodeBahasa}
              />
            ) : null}

            {active === 'suara' ? <VoicePanel onUse={useVoiceResult} t={t} /> : null}

            {active === 'pindai' ? (
              <ScanPanel
                t={t}
                serverOnline={server.online}
                onKirimKe={kirimHasilPindai}
                bahasa={kodeBahasa}
              />
            ) : null}

            {active === 'riwayat' ? (
              <div className="space-y-[clamp(1rem,1.6vw,1.75rem)]">
                <SectionHeading
                  eyebrow={t('riw.eyebrow')}
                  title={t('riw.judul')}
                  description={t('riw.sub')}
                  ilustrasi="riwayat"
                />
                {/* Yang dinilai "kosong" adalah riwayat SUNGGUHAN. Kalau contoh
                    masih ditampilkan, daftarnya tetap tampil — bukan pesan
                    kosong, karena pesan "belum ada riwayat" di bawah contoh
                    justru membingungkan. */}
                {!adaRiwayatSungguhan ? (
                  <>
                    <EmptyState
                      icon={History}
                      title={t('riw.kosongJudul')}
                      description={t('riw.kosongSub')}
                      action={
                        <button
                          type="button"
                          onClick={() => navigate('beranda')}
                          className="mt-1 inline-flex items-center gap-2 rounded-xl bg-brand-500 px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-brand-600"
                        >
                          <ArrowLeft className="size-4" aria-hidden="true" />
                          {t('riw.keBeranda')}
                        </button>
                      }
                    />
                    <p className="text-[0.78rem] font-semibold tracking-[0.1em] uppercase text-muted-500">
                      {t('riw.contohJudul')}
                    </p>
                  </>
                ) : null}
                <RecentHistory items={history} max={history.length} t={t} />
              </div>
            ) : null}

            {active === 'kuesioner' ? <QuizPanel t={t} /> : null}
            {active === 'pengaturan' ? (
              <SettingsPanel settings={settings} onChange={setSettings} t={t} labelTingkat={labelTingkat} />
            ) : null}
          </div>
        </main>
        </BatasGalat>

        <BatasGalat
          judul={t('galat.bawahJudul')}
          pesan={t('galat.bawahPesan')}
          t={t}
        >
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
        </BatasGalat>
      </div>
      </div>
    </>
  )
}
