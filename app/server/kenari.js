/**
 * Klien Kenari.id (OpenAI-compatible).
 * Pakai fetch bawaan Node — tanpa dependensi HTTP tambahan.
 */

import { config } from './config.js'

export class KenariError extends Error {
  constructor(message, { status, code, body } = {}) {
    super(message)
    this.name = 'KenariError'
    this.status = status ?? 502
    this.code = code ?? 'upstream_error'
    this.body = body
  }
}

/** Terjemahkan error upstream jadi pesan yang bisa ditindaklanjuti. */
function terjemahkanError(status, teks) {
  let code = 'upstream_error'
  let pesan = 'Layanan AI sedang tidak bisa dihubungi.'

  if (/insufficient_balance/i.test(teks)) {
    code = 'insufficient_balance'
    pesan = 'Saldo akun Kenari tidak cukup untuk permintaan ini. Isi saldo di kenari.id/pay lalu coba lagi.'
  } else if (status === 401 || /invalid.?key|unauthorized/i.test(teks)) {
    code = 'invalid_key'
    pesan = 'API key Kenari ditolak. Periksa nilai KENARI_API_KEY di file app/.env.'
  } else if (status === 429 || /rate.?limit/i.test(teks)) {
    code = 'rate_limited'
    pesan = 'Terlalu banyak permintaan ke Kenari. Tunggu sebentar lalu coba lagi.'
  } else if (status === 404 || /model not found/i.test(teks)) {
    code = 'model_not_found'
    pesan = `Model "${config.model}" tidak tersedia di Kenari. Cek daftar model atau ganti KENARI_MODEL di app/.env.`
  } else if (status >= 500) {
    code = 'upstream_error'
    pesan = 'Server Kenari sedang bermasalah. Coba lagi beberapa saat lagi.'
  }
  return { code, pesan }
}

/**
 * Panggilan chat non-streaming. Mengembalikan teks jawaban + usage.
 * @returns {Promise<{text: string, usage: object|null, model: string}>}
 */
export async function chat({ messages, maxTokens, temperature }) {
  const res = await fetch(`${config.baseUrl}/chat/completions`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${config.apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: config.model,
      messages,
      max_tokens: maxTokens ?? config.maxTokens,
      temperature: temperature ?? config.temperature,
      stream: false,
    }),
    signal: AbortSignal.timeout(config.requestTimeoutMs),
  })

  const teks = await res.text()
  if (!res.ok) {
    const { code, pesan } = terjemahkanError(res.status, teks)
    throw new KenariError(pesan, { status: res.status, code, body: teks.slice(0, 500) })
  }

  let data
  try {
    data = JSON.parse(teks)
  } catch {
    throw new KenariError('Balasan Kenari tidak bisa dibaca (bukan JSON).', {
      code: 'bad_response',
      body: teks.slice(0, 500),
    })
  }

  const pilihan = data.choices?.[0]
  const pesan = pilihan?.message ?? {}
  // sebagian model menaruh jawaban di reasoning_content — ambil yang ada isinya
  const text = (pesan.content || pesan.reasoning_content || '').trim()

  return { text, usage: data.usage ?? null, model: data.model ?? config.model, finish: pilihan?.finish_reason ?? null }
}

/**
 * Panggilan chat streaming. Memanggil `onDelta(teks)` untuk setiap potongan.
 * @returns {Promise<{text: string, usage: object|null}>}
 */
export async function chatStream({ messages, maxTokens, temperature, onDelta, signal }) {
  const batas = AbortSignal.any([
    AbortSignal.timeout(config.requestTimeoutMs),
    ...(signal ? [signal] : []),
  ])

  const res = await fetch(`${config.baseUrl}/chat/completions`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${config.apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: config.model,
      messages,
      max_tokens: maxTokens ?? config.maxTokens,
      temperature: temperature ?? config.temperature,
      stream: true,
    }),
    signal: batas,
  })

  if (!res.ok) {
    const teks = await res.text()
    const { code, pesan } = terjemahkanError(res.status, teks)
    throw new KenariError(pesan, { status: res.status, code, body: teks.slice(0, 500) })
  }

  let penuh = ''
  let usage = null
  let buffer = ''

  const decoder = new TextDecoder()
  for await (const chunk of res.body) {
    buffer += decoder.decode(chunk, { stream: true })
    const baris = buffer.split('\n')
    buffer = baris.pop() ?? ''

    for (const raw of baris) {
      const line = raw.trim()
      if (!line.startsWith('data:')) continue
      const isi = line.slice(5).trim()
      if (isi === '[DONE]') continue

      let d
      try {
        d = JSON.parse(isi)
      } catch {
        continue
      }
      if (d.usage) usage = d.usage

      const delta = d.choices?.[0]?.delta ?? {}
      const potongan = delta.content || delta.reasoning_content || ''
      if (potongan) {
        penuh += potongan
        onDelta?.(potongan)
      }
    }
  }

  return { text: penuh.trim(), usage }
}

/** Cek key masih hidup + model tersedia. */
export async function cekSehat() {
  const res = await fetch(`${config.baseUrl}/models`, {
    headers: { Authorization: `Bearer ${config.apiKey}` },
    signal: AbortSignal.timeout(20000),
  })
  if (!res.ok) {
    const { code, pesan } = terjemahkanError(res.status, await res.text())
    return { ok: false, code, pesan }
  }
  const data = await res.json()
  const ids = (data.data ?? []).map((m) => m.id)
  return {
    ok: true,
    totalModel: ids.length,
    modelTersedia: ids.includes(config.model),
  }
}
