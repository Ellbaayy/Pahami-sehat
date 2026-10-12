import { useState } from 'react'
import { MessagesSquare, Loader2, Camera, CameraOff, Wand2 } from 'lucide-react'
import {
  SectionHeading,
  EmptyState,
  SourcePills,
  PoinKunci,
  Peringatan,
  SumberJawaban,
} from '../ui/primitives'
import TombolDengar from '../ui/TombolDengar'
import Komposer from './Komposer'
import PemindaiFoto from './PemindaiFoto'
import { cn } from '../../lib/cn'

/**
 * Panel "Tanya AI" — percakapan penuh, dan sekarang juga satu-satunya tempat
 * semua kemampuan bertemu.
 *
 * Dulu tiap kemampuan punya halaman sendiri (Tanya AI, Sederhanakan, Suara,
 * Pindai Foto) sehingga pengguna harus berpindah-pindah. Sekarang:
 *   - mode "Tanya" / "Sederhanakan" dipilih di komposer (Komposer.jsx)
 *   - hasil suara dan hasil pindai masuk ke kotak isian yang sama
 *   - semuanya muncul sebagai utas percakapan di panel ini
 *
 * Komponen presentasional: nilai input & aksi dikontrol induk supaya chip topik
 * di Beranda bisa menulis ke tempat yang sama.
 */
export default function ThreadPanel({
  input,
  onInputChange,
  onKirim,
  loading,
  thread,
  streaming = '',
  statusPesan = '',
  error = null,
  sumberCari = [],
  t = (k) => k,
  serverOnline = true,
  serverMemuat = false,
  bahasa = 'id',
  mode = 'tanya',
  onModeChange,
  tingkat,
  onTingkatChange,
  labelTingkat = (x) => x,
  onContohSederhanakan,
  pindaiTerbuka = false,
  onPindaiBuka,
  onPindaiTutup,
  onPindaiTeks,
}) {
  const [seretFoto, setSeretFoto] = useState(false)

  return (
    <div className="space-y-[clamp(1rem,1.6vw,1.75rem)]">
      <SectionHeading
        eyebrow={t('tanya.eyebrow')}
        title={t('tanya.judul')}
        description={t('tanya.sub')}
        ilustrasi="tanya"
        action={
          <button
            type="button"
            onClick={pindaiTerbuka ? onPindaiTutup : onPindaiBuka}
            aria-pressed={pindaiTerbuka}
            className={cn(
              'inline-flex shrink-0 items-center gap-2 rounded-xl border px-3.5 py-2 text-[0.85rem] font-semibold transition-colors',
              'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-500',
              pindaiTerbuka
                ? 'border-brand-300 bg-brand-50 text-brand-700'
                : 'border-line-200 bg-white text-navy-600 hover:border-brand-200 hover:bg-brand-50 hover:text-brand-700',
            )}
          >
            {pindaiTerbuka ? (
              <CameraOff className="size-4" aria-hidden="true" />
            ) : (
              <Camera className="size-4" aria-hidden="true" />
            )}
            {pindaiTerbuka ? t('tanya.tutupPindai') : t('tanya.pindaiTombol')}
          </button>
        }
      />

      <div
        onDragOver={(e) => {
          // foto yang dijatuhkan di mana pun pada kartu ini membuka pemindai,
          // supaya tidak perlu mencari tombolnya lebih dulu
          if (![...(e.dataTransfer?.types ?? [])].includes('Files')) return
          e.preventDefault()
          setSeretFoto(true)
        }}
        onDragLeave={() => setSeretFoto(false)}
        onDrop={(e) => {
          if (![...(e.dataTransfer?.types ?? [])].includes('Files')) return
          e.preventDefault()
          setSeretFoto(false)
          onPindaiBuka?.()
        }}
        className={cn(
          'rounded-2xl border bg-white p-[clamp(1rem,0.85rem+0.7vw,1.5rem)] shadow-[0_1px_2px_rgba(15,30,51,0.04)] transition-colors',
          seretFoto ? 'border-brand-400 ring-2 ring-brand-100' : 'border-line-200',
        )}
      >
        <Komposer
          t={t}
          value={input}
          onChange={onInputChange}
          onKirim={onKirim}
          loading={loading}
          serverOnline={serverOnline}
          serverMemuat={serverMemuat}
          mode={mode}
          onModeChange={onModeChange}
          tingkat={tingkat}
          onTingkatChange={onTingkatChange}
          labelTingkat={labelTingkat}
          onContohSederhanakan={onContohSederhanakan}
          onPindaiBuka={onPindaiBuka}
          pindaiTerbuka={pindaiTerbuka}
          idKotak="thread-input"
        />

        {pindaiTerbuka ? (
          <PemindaiFoto
            t={t}
            onTeks={onPindaiTeks}
            onTutup={onPindaiTutup}
            teksKomposer={input}
            serverOnline={serverOnline}
            bahasa={bahasa}
          />
        ) : null}
      </div>

      <SumberJawaban cari={sumberCari} sumber={[]} t={t} />
      {error ? <Peringatan pesan={error.pesan} code={error.code} /> : null}

      {thread.length === 0 && !loading ? (
        <EmptyState
          icon={MessagesSquare}
          title={t('tanya.belumAda')}
          description={t('tanya.belumAdaSub')}
        />
      ) : (
        <ol className="space-y-3">
          {thread.map((m, i) => (
            <li
              key={`${m.id}-${i}`}
              className={cn(
                'rise max-w-[min(100%,46rem)] rounded-2xl border p-4',
                m.role === 'user'
                  ? 'ml-auto border-brand-500 bg-brand-500 text-white'
                  : 'border-line-200 bg-white',
              )}
            >
              <p
                className={cn(
                  'flex flex-wrap items-center gap-2 text-[0.7rem] font-bold tracking-[0.12em] uppercase',
                  m.role === 'user' ? 'text-brand-100' : 'text-brand-600',
                )}
              >
                {m.role === 'user' ? t('tanya.kamu') : 'Pahami Sehat'}
                {/* Mode ditandai per gelembung: satu utas bisa memuat pertanyaan
                    biasa dan permintaan penyederhanaan sekaligus, dan tanpa
                    penanda ini keduanya terlihat sama. */}
                {m.role === 'user' && m.mode === 'sederhanakan' ? (
                  <span className="inline-flex items-center gap-1 rounded-full bg-white/25 px-2 py-0.5 text-[0.64rem] font-bold tracking-normal normal-case">
                    <Wand2 className="size-3" aria-hidden="true" />
                    {t('tanya.modeBadgeSederhanakan')}
                  </span>
                ) : null}
              </p>
              <p
                className={cn(
                  'mt-1 text-[0.95rem] leading-relaxed whitespace-pre-wrap',
                  m.role === 'user' ? 'font-medium text-white' : 'text-navy-700',
                )}
              >
                {m.text}
              </p>
              {m.role === 'ai' ? (
                <>
                  <div className="mt-3 flex flex-wrap items-center gap-2">
                    <TombolDengar teks={m.text} t={t} />
                  </div>
                  <PoinKunci items={m.poinKunci} t={t} />
                  <SourcePills sources={m.sources} negative={m.verdict === 'negative'} t={t} />
                  {m.catatan ? (
                    <p className="mt-2 text-[0.78rem] text-muted-500">{m.catatan}</p>
                  ) : null}
                </>
              ) : null}
            </li>
          ))}

          {loading ? (
            <li className="max-w-[min(100%,46rem)] rounded-2xl border border-line-200 bg-white p-4">
              {streaming ? (
                <>
                  <p className="mb-1 text-[0.7rem] font-bold tracking-[0.12em] uppercase text-brand-600">
                    {t('tanya.sedangMenyusun')}
                  </p>
                  <p className="text-[0.95rem] leading-relaxed whitespace-pre-wrap text-navy-700">
                    {streaming}
                    <span className="ml-0.5 inline-block h-4 w-[2px] animate-pulse bg-brand-500 align-middle" />
                  </p>
                </>
              ) : (
                <>
                  <p className="mb-2 inline-flex items-center gap-1.5 text-[0.78rem] font-semibold text-brand-600">
                    <Loader2 className="size-3.5 animate-spin" aria-hidden="true" />
                    {statusPesan || t('umum.proses')}
                  </p>
                  <div className="skeleton h-3 w-24 rounded" />
                  <div className="skeleton mt-2.5 h-3.5 w-full rounded" />
                  <div className="skeleton mt-2 h-3.5 w-[85%] rounded" />
                </>
              )}
            </li>
          ) : null}
        </ol>
      )}
    </div>
  )
}
