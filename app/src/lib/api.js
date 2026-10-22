/**
 * Klien API Pahami Sehat.
 *
 * Di dev, Vite meneruskan /api ke server Express (lihat vite.config.js).
 * Di produksi, server Express yang sama menyajikan hasil build — jadi
 * alamat relatif "/api" selalu benar di kedua mode.
 */

/** Dasar alamat API — dipakai juga oleh modul lain (mis. lib/tts.js). */
export const API_BASE = '/api'
const BASE = API_BASE

/** Error dari API, sudah membawa kode yang bisa ditampilkan ke user. */
export class ApiError extends Error {
  constructor(pesan, code = 'gagal') {
    super(pesan)
    this.name = 'ApiError'
    this.code = code
  }
}

/**
 * Kode galat yang LAHIR DI KLIEN (bukan dari server) → kunci kamus.
 *
 * Pesan di dalam berkas ini sengaja berupa kalimat Indonesia karena dipakai
 * sebagai cadangan DI LUAR antarmuka (log, uji). Untuk yang TAMPIL di layar,
 * komponen memakai kunci kamus di bawah supaya mode Inggris tidak menampilkan
 * kalimat Indonesia mentah.
 */
export const KUNCI_GALAT_KLIEN = {
  server_mati: 'galat.serverMati',
  stream_putus: 'galat.streamPutus',
}

async function minta(path, { method = 'GET', body, signal } = {}) {
  let res
  try {
    res = await fetch(`${BASE}${path}`, {
      method,
      headers: body ? { 'Content-Type': 'application/json' } : undefined,
      body: body ? JSON.stringify(body) : undefined,
      signal,
    })
  } catch (e) {
    if (e?.name === 'AbortError') throw e
    throw new ApiError('Tidak bisa menghubungi server. Pastikan `npm run server` jalan.', 'server_mati')
  }

  const teks = await res.text()
  let data = null
  try {
    data = teks ? JSON.parse(teks) : null
  } catch {
    /* balasan bukan JSON */
  }

  if (!res.ok) {
    throw new ApiError(data?.pesan || `Permintaan gagal (HTTP ${res.status}).`, data?.code || 'gagal')
  }
  return data
}

/* ------------------------------------------------------------- endpoint --- */

export const ambilHealth = () => minta('/health')

/**
 * Konten harian untuk Beranda (topik populer, artikel, tips).
 * Diperbarui sekali sehari di sisi server — lihat server/konten.js.
 */
export const ambilKonten = (signal) => minta('/konten', { signal })

export const tanya = ({ pertanyaan, tingkat, bahasa, idSesi }, signal) =>
  minta('/tanya', { method: 'POST', body: { pertanyaan, tingkat, bahasa, idSesi }, signal })

export const sederhanakan = ({ teks, tingkat, bahasa, idSesi }, signal) =>
  minta('/sederhanakan', { method: 'POST', body: { teks, tingkat, bahasa, idSesi }, signal })

export const verifikasi = ({ klaim, tingkat, bahasa, idSesi }, signal) =>
  minta('/verifikasi', { method: 'POST', body: { klaim, tingkat, bahasa, idSesi }, signal })

/**
 * Streaming jawaban lewat SSE.
 *
 * `idSesi` WAJIB ikut terkirim supaya server bisa memakai percakapan
 * sebelumnya sebagai konteks. Tanpa itu, setiap pertanyaan dijawab sendirian
 * dan pertanyaan lanjutan ("terus gimana") kehilangan topiknya. Penanda ini
 * dibuat di peramban (`s<timestamp>`) dan hanya dipakai untuk mengelompokkan
 * giliran percakapan — bukan identitas orang.
 *
 * @param {{pertanyaan: string, tingkat: string, idSesi?: string}} param
 * @param {{onStatus?: Function, onDelta?: Function, onHasil?: Function, onSumber?: Function, signal?: AbortSignal}} cb
 * @returns {Promise<object>} hasil final
 */
export async function tanyaStream({ pertanyaan, tingkat, bahasa, idSesi }, { onStatus, onDelta, onHasil, onSumber, signal } = {}) {
  let res
  try {
    res = await fetch(`${BASE}/tanya/stream`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'text/event-stream' },
      body: JSON.stringify({ pertanyaan, tingkat, bahasa, idSesi }),
      signal,
    })
  } catch (e) {
    if (e?.name === 'AbortError') throw e
    throw new ApiError('Tidak bisa menghubungi server. Pastikan `npm run server` jalan.', 'server_mati')
  }

  if (!res.ok) {
    const teks = await res.text()
    let d = null
    try {
      d = JSON.parse(teks)
    } catch {
      /* bukan JSON */
    }
    throw new ApiError(d?.pesan || `Permintaan gagal (HTTP ${res.status}).`, d?.code || 'gagal')
  }

  const reader = res.body.getReader()
  const decoder = new TextDecoder()
  let buffer = ''
  let hasil = null

  while (true) {
    const { done, value } = await reader.read()
    if (done) break
    buffer += decoder.decode(value, { stream: true })

    let pisah
    while ((pisah = buffer.indexOf('\n\n')) !== -1) {
      const blok = buffer.slice(0, pisah)
      buffer = buffer.slice(pisah + 2)

      let event = null
      let data = null
      for (const line of blok.split('\n')) {
        if (line.startsWith('event:')) event = line.slice(6).trim()
        else if (line.startsWith('data:')) data = line.slice(5).trim()
      }
      if (!event) continue

      // Tanpa nilai awal: `null` awal tidak pernah terbaca karena `catch`
      // langsung `continue`, dan ESLint menandainya `no-useless-assignment`.
      let isi
      try {
        isi = data ? JSON.parse(data) : null
      } catch {
        continue
      }

      if (event === 'status') onStatus?.(isi?.pesan ?? '')
      else if (event === 'sumber') onSumber?.(isi?.hasil ?? [])
      else if (event === 'delta') onDelta?.(isi?.teks ?? '')
      else if (event === 'hasil') {
        hasil = isi
        onHasil?.(isi)
      } else if (event === 'error') {
        throw new ApiError(isi?.pesan || 'Terjadi kesalahan saat memproses.', isi?.code || 'gagal')
      }
    }
  }

  if (!hasil) throw new ApiError('Server menutup koneksi sebelum jawaban selesai.', 'stream_putus')
  return hasil
}
