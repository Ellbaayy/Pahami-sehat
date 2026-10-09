/**
 * Rute API Pahami Sehat — dipakai DUA tempat:
 *   1. server lokal  (server/index.js)  — untuk dev & Grand Final
 *   2. serverless    (api/index.js)     — untuk deploy di Vercel
 *
 * Semua logika endpoint ada di sini supaya kedua jalur berperilaku sama persis.
 * Endpoint:
 *   GET  /api/health
 *   GET  /api/meta
 *   POST /api/tanya            { pertanyaan, tingkat }
 *   POST /api/tanya/stream     { pertanyaan, tingkat }   (SSE)
 *   POST /api/sederhanakan     { teks, tingkat }
 *   POST /api/verifikasi       { klaim, tingkat }
 */

import { Router } from 'express'

import { config, safeInfo } from './config.js'
import { KenariError, chat, chatStream, cekSehat } from './kenari.js'
import { buatEkstrak } from './ekstrak.js'
import {
  TINGKAT,
  TINGKAT_DEFAULT,
  promptTanya,
  promptSederhanakan,
  promptVerifikasi,
} from './prompts.js'

/* ---------------------------------------------------------------- util ---- */

/** Ambil JSON dari balasan model, tahan terhadap pagar kode & teks tambahan. */
function ambilJson(teks) {
  if (!teks) return null
  let s = teks.trim()
  // buang pagar kode ```json ... ```
  s = s.replace(/^```(?:json)?\s*/i, '').replace(/```\s*$/, '')
  const awal = s.indexOf('{')
  const akhir = s.lastIndexOf('}')
  if (awal === -1 || akhir === -1 || akhir < awal) return null
  try {
    return JSON.parse(s.slice(awal, akhir + 1))
  } catch {
    return null
  }
}

function rapikanTingkat(v) {
  const k = String(v ?? '').trim().toLowerCase()
  return TINGKAT[k] ? k : TINGKAT_DEFAULT
}

/** Normalisasi hasil model jadi bentuk yang dipakai frontend. */
function bentukHasil(mentah, tingkat, { verdictKey = null } = {}) {
  const t = TINGKAT[tingkat]
  if (!mentah) {
    return {
      ok: false,
      code: 'unparsed',
      pesan: 'Model tidak mengembalikan JSON yang bisa dibaca. Coba lagi.',
      jawaban: '',
      poinKunci: [],
      sumber: [],
      tingkat: { kunci: tingkat, label: t.label, targetKelas: t.targetKelas },
    }
  }
  const sumber = Array.isArray(mentah.sumber)
    ? mentah.sumber
        .filter((s) => s && (s.judul || s.penerbit))
        .map((s) => ({ judul: String(s.judul ?? '').trim(), penerbit: String(s.penerbit ?? '').trim() }))
    : []

  const out = {
    ok: true,
    jawaban: String(mentah.jawaban ?? '').trim(),
    poinKunci: Array.isArray(mentah.poin_kunci) ? mentah.poin_kunci.map((p) => String(p).trim()).filter(Boolean) : [],
    sumber,
    catatan: String(mentah.catatan ?? '').trim(),
    tingkat: { kunci: tingkat, label: t.label, targetKelas: t.targetKelas },
  }
  if (verdictKey) out.verdict = String(mentah[verdictKey] ?? 'tidak_bisa_dipastikan').trim()
  return out
}

/** Bungkus handler async supaya error-nya tertangkap middleware error. */
const bungkus = (fn) => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next)

/* -------------------------------------------------------------- routes ---- */

const rute = Router()

rute.get('/api/health', bungkus(async (_req, res) => {
  const sehat = await cekSehat()
  res.json({ server: 'ok', kenari: sehat, ...safeInfo() })
}))

rute.get('/api/meta', (_req, res) => {
  res.json({
    model: config.model,
    tingkat: Object.entries(TINGKAT).map(([kunci, t]) => ({
      kunci,
      label: t.label,
      targetKelas: t.targetKelas,
    })),
    tingkatDefault: TINGKAT_DEFAULT,
    batasKata: 220,
  })
})

rute.post('/api/tanya', bungkus(async (req, res) => {
  const pertanyaan = String(req.body?.pertanyaan ?? '').trim()
  if (!pertanyaan) return res.status(400).json({ ok: false, code: 'input_kosong', pesan: 'Pertanyaan masih kosong.' })
  if (pertanyaan.length > 4000) return res.status(400).json({ ok: false, code: 'input_terlalu_panjang', pesan: 'Pertanyaan terlalu panjang (maks 4000 karakter).' })

  const tingkat = rapikanTingkat(req.body?.tingkat)
  const p = promptTanya({ pertanyaan, tingkat })
  const hasil = await chat({ messages: [
    { role: 'system', content: p.system },
    { role: 'user', content: p.user },
  ] })

  res.json({ ...bentukHasil(ambilJson(hasil.text), tingkat), usage: hasil.usage })
}))

rute.post('/api/sederhanakan', bungkus(async (req, res) => {
  const teks = String(req.body?.teks ?? '').trim()
  if (!teks) return res.status(400).json({ ok: false, code: 'input_kosong', pesan: 'Teks masih kosong.' })
  if (teks.length > 8000) return res.status(400).json({ ok: false, code: 'input_terlalu_panjang', pesan: 'Teks terlalu panjang (maks 8000 karakter).' })

  const tingkat = rapikanTingkat(req.body?.tingkat)
  const p = promptSederhanakan({ teks, tingkat })
  const hasil = await chat({ messages: [
    { role: 'system', content: p.system },
    { role: 'user', content: p.user },
  ] })

  res.json({ ...bentukHasil(ambilJson(hasil.text), tingkat), usage: hasil.usage })
}))

rute.post('/api/verifikasi', bungkus(async (req, res) => {
  const klaim = String(req.body?.klaim ?? '').trim()
  if (!klaim) return res.status(400).json({ ok: false, code: 'input_kosong', pesan: 'Klaim masih kosong.' })
  if (klaim.length > 4000) return res.status(400).json({ ok: false, code: 'input_terlalu_panjang', pesan: 'Klaim terlalu panjang (maks 4000 karakter).' })

  const tingkat = rapikanTingkat(req.body?.tingkat)
  const p = promptVerifikasi({ klaim, tingkat })
  const hasil = await chat({ messages: [
    { role: 'system', content: p.system },
    { role: 'user', content: p.user },
  ] })

  res.json({ ...bentukHasil(ambilJson(hasil.text), tingkat, { verdictKey: 'verdict' }), usage: hasil.usage })
}))

/**
 * Streaming SSE — untuk efek "mengetik" di UI.
 * Kirim event: `status`, `delta`, `hasil` (JSON final), atau `error`.
 */
rute.post('/api/tanya/stream', bungkus(async (req, res) => {
  const pertanyaan = String(req.body?.pertanyaan ?? '').trim()
  if (!pertanyaan) return res.status(400).json({ ok: false, code: 'input_kosong', pesan: 'Pertanyaan masih kosong.' })

  const tingkat = rapikanTingkat(req.body?.tingkat)
  const p = promptTanya({ pertanyaan, tingkat })

  res.set({
    'Content-Type': 'text/event-stream; charset=utf-8',
    'Cache-Control': 'no-cache, no-transform',
    Connection: 'keep-alive',
    'X-Accel-Buffering': 'no',
  })
  res.flushHeaders?.()

  const kirim = (event, data) => res.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`)

  // batalkan panggilan upstream kalau KLIEN memutus koneksi lebih dulu.
  // Catatan: pakai res.on('close'), bukan req.on('close') — di Node modern
  // 'close' pada request menyala begitu body selesai dibaca, sehingga
  // panggilan AI-nya ikut terbatalkan sendiri.
  const ac = new AbortController()
  res.on('close', () => {
    if (!res.writableEnded) ac.abort()
  })

  try {
    kirim('status', { pesan: `Menghubungi ${config.model}…` })

    // hanya alirkan isi field "jawaban", bukan JSON mentahnya
    const ekstrak = buatEkstrak('jawaban')

    const hasil = await chatStream({
      messages: [
        { role: 'system', content: p.system },
        { role: 'user', content: p.user },
      ],
      signal: ac.signal,
      onDelta: (t) => {
        const bersih = ekstrak.dorong(t)
        if (bersih) kirim('delta', { teks: bersih })
      },
    })

    const final = bentukHasil(ambilJson(hasil.text), tingkat)
    kirim('hasil', { ...final, usage: hasil.usage })
    res.write('event: selesai\ndata: {}\n\n')
  } catch (e) {
    if (!ac.signal.aborted) {
      kirim('error', { code: e.code ?? 'upstream_error', pesan: e.message })
    }
  } finally {
    res.end()
  }
}))

/* -------------------------------------------------------------- errors ---- */

rute.use((err, _req, res, _next) => {
  const kenari = err instanceof KenariError
  const status = kenari ? (err.status === 401 ? 502 : err.status) : 500
  const isi = {
    ok: false,
    code: kenari ? err.code : 'server_error',
    pesan: kenari ? err.message : 'Terjadi kesalahan di server.',
  }
  if (!kenari) console.error('[server]', err)
  if (res.headersSent) return res.end()
  res.status(status).json(isi)
})

export default rute
