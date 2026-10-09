/**
 * Konfigurasi server — semua dari environment variable.
 * Key TIDAK pernah ditulis di kode; diambil dari process.env.KENARI_API_KEY
 * (diisi lewat `--env-file=.env` atau environment shell).
 */

function required(name) {
  const v = process.env[name]
  if (!v || !v.trim()) {
    throw new Error(
      `Environment variable ${name} belum diisi.\n` +
        `Buat file app/.env berisi:\n  ${name}=<api-key-kenari>\n` +
        `atau jalankan dengan: ${name}=... npm run start`,
    )
  }
  return v.trim()
}

export const config = {
  port: Number(process.env.PORT || 8787),
  apiKey: required('KENARI_API_KEY'),
  baseUrl: (process.env.KENARI_BASE_URL || 'https://kenari.id/v1').replace(/\/+$/, ''),
  model: process.env.KENARI_MODEL || 'deepseek-v4-1-flash',
  /** batas token output; Kenari tidak menolak hingga 4000 pada akun saldo 0 */
  maxTokens: Number(process.env.MAX_TOKENS || 1500),
  temperature: Number(process.env.TEMPERATURE || 0.3),
  requestTimeoutMs: Number(process.env.REQUEST_TIMEOUT_MS || 120000),
}

/** Info aman untuk ditampilkan (tanpa membocorkan key). */
export function safeInfo() {
  return {
    model: config.model,
    baseUrl: config.baseUrl,
    keyTerpasang: Boolean(config.apiKey),
    keyPrefix: config.apiKey.slice(0, 3) + '…',
    maxTokens: config.maxTokens,
  }
}
