/**
 * Klien API Pahami Sehat.
 *
 * Di dev, Vite meneruskan /api ke server Express (lihat vite.config.js).
 * Di produksi, server Express yang sama menyajikan hasil build — jadi
 * alamat relatif "/api" selalu benar di kedua mode.
 */

const BASE = '/api'

/** Error dari API, sudah membawa kode yang bisa ditampilkan ke user. */
export class ApiError extends Error {
  constructor(pesan, code = 'gagal') {
    super(pesan)
    this.name = 'ApiError'
    this.code = code
  }
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

export const ambilMeta = () => minta('/meta')
export const ambilHealth = () => minta('/health')

export const tanya = ({ pertanyaan, tingkat }, signal) =>
  minta('/tanya', { method: 'POST', body: { pertanyaan, tingkat }, signal })

export const sederhanakan = ({ teks, tingkat }, signal) =>
  minta('/sederhanakan', { method: 'POST', body: { teks, tingkat }, signal })

export const verifikasi = ({ klaim, tingkat }, signal) =>
  minta('/verifikasi', { method: 'POST', body: { klaim, tingkat }, signal })

/**
 * Streaming jawaban lewat SSE.
 * @param {{pertanyaan: string, tingkat: string}} param
 * @param {{onStatus?: Function, onDelta?: Function, onHasil?: Function, signal?: AbortSignal}} cb
 * @returns {Promise<object>} hasil final
 */
export async function tanyaStream({ pertanyaan, tingkat }, { onStatus, onDelta, onHasil, signal } = {}) {
  let res
  try {
    res = await fetch(`${BASE}/tanya/stream`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'text/event-stream' },
      body: JSON.stringify({ pertanyaan, tingkat }),
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

      let isi = null
      try {
        isi = data ? JSON.parse(data) : null
      } catch {
        continue
      }

      if (event === 'status') onStatus?.(isi?.pesan ?? '')
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
