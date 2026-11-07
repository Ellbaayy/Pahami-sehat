#!/usr/bin/env node
/**
 * Ambil tangkapan layar HALAMAN PENJELASAN (`docs/prototipe/`) per bagian.
 *
 * Halaman ini tingginya ~18.000 px dan punya banyak animasi, sehingga harness
 * peramban biasa macet menunggu "halaman tenang". Skrip ini memakai Chrome +
 * CDP langsung (sama seperti `ambil-tangkapan.mjs`) dan menunggu syarat yang
 * jelas: splash hilang, lalu posisi gulir benar-benar sampai.
 *
 * Pemakaian (server harus hidup di 127.0.0.1:8787):
 *   node ambil-tangkapan-prototipe.mjs
 */

import { spawn } from 'node:child_process'
import { existsSync, mkdirSync, writeFileSync, rmSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const AKAR = dirname(fileURLToPath(import.meta.url))
const TUJUAN = join(AKAR, 'docs', 'tangkapan-layar')
const BASE = process.env.BASE || 'http://127.0.0.1:8787'
const PORT_CDP = 9335

class Cdp {
  constructor(url) {
    this.ws = new WebSocket(url)
    this.nomor = 0
    this.tunggu = new Map()
    this.siap = new Promise((r, j) => {
      this.ws.onopen = r
      this.ws.onerror = () => j(new Error('gagal membuka WebSocket CDP'))
    })
    this.ws.onmessage = (m) => {
      const d = JSON.parse(m.data)
      if (d.id && this.tunggu.has(d.id)) {
        const { r, j } = this.tunggu.get(d.id)
        this.tunggu.delete(d.id)
        if (d.error) j(new Error(d.error.message))
        else r(d.result)
        return
      }
    }
  }
  kirim(method, params = {}) {
    const id = ++this.nomor
    this.ws.send(JSON.stringify({ id, method, params }))
    return new Promise((r, j) => this.tunggu.set(id, { r, j }))
  }
  tutup() {
    try {
      this.ws.close()
    } catch {
      /* sudah tertutup */
    }
  }
}

const jeda = (ms) => new Promise((r) => setTimeout(r, ms))

async function tungguSampai(fn, batasMs = 30000, jedaMs = 300) {
  const mulai = Date.now()
  while (Date.now() - mulai < batasMs) {
    try {
      if (await fn()) return true
    } catch {
      /* belum siap */
    }
    await jeda(jedaMs)
  }
  return false
}

async function evaluasi(cdp, ekspresi) {
  const r = await cdp.kirim('Runtime.evaluate', {
    expression: ekspresi,
    returnByValue: true,
    awaitPromise: true,
  })
  if (r?.result?.subtype === 'error') throw new Error(r.result.description ?? 'galat di halaman')
  return r?.result?.value
}

const PROFIL = join('/tmp', `pahami-prot-${Date.now()}`)
let chrome = null

function cariChrome() {
  return [
    process.env.CHROME_PATH,
    '/usr/bin/google-chrome-stable',
    '/usr/bin/google-chrome',
    '/usr/bin/chromium',
    '/usr/bin/chromium-browser',
  ]
    .filter(Boolean)
    .find((p) => existsSync(p))
}

async function main() {
  const bin = cariChrome()
  if (!bin) throw new Error('Chrome/Chromium tidak ditemukan')
  if (!existsSync(TUJUAN)) mkdirSync(TUJUAN, { recursive: true })

  chrome = spawn(
    bin,
    [
      '--headless=new',
      '--no-sandbox',
      '--disable-gpu',
      '--disable-dev-shm-usage',
      '--hide-scrollbars',
      `--remote-debugging-port=${PORT_CDP}`,
      `--user-data-dir=${PROFIL}`,
      'about:blank',
    ],
    { stdio: 'ignore' },
  )

  const siap = await tungguSampai(async () => (await fetch(`http://127.0.0.1:${PORT_CDP}/json/version`)).ok, 20000)
  if (!siap) throw new Error('Chrome tidak membuka port CDP')

  const daftar = await (await fetch(`http://127.0.0.1:${PORT_CDP}/json/list`)).json()
  const cdp = new Cdp(daftar.find((t) => t.type === 'page').webSocketDebuggerUrl)
  await cdp.siap
  await cdp.kirim('Page.enable')
  await cdp.kirim('Runtime.enable')

  const metrik = (width, height, dpr = 1, mobile = false) =>
    cdp.kirim('Emulation.setDeviceMetricsOverride', { width, height, deviceScaleFactor: dpr, mobile })

  const simpan = async (nama) => {
    const r = await cdp.kirim('Page.captureScreenshot', { format: 'png' })
    const isi = Buffer.from(r.data, 'base64')
    if (isi.length < 20000) throw new Error(`${nama} terlalu kecil (${isi.length} byte) — tangkapan gagal`)
    writeFileSync(join(TUJUAN, nama), isi)
    console.log(`  ok  ${nama}  (${Math.round(isi.length / 1024)} KB)`)
  }

  /** Gulir ke sebuah bagian, dengan offset navbar lengket, lalu tunggu benar-benar sampai. */
  const keBagian = async (id, tambahan = 0) => {
    const target = await evaluasi(
      cdp,
      `(() => {
        const el = document.getElementById(${JSON.stringify(id)});
        if (!el) return null;
        const nav = document.querySelector('.navbar');
        const tinggiNav = nav ? nav.getBoundingClientRect().height : 0;
        const y = el.getBoundingClientRect().top + window.scrollY - tinggiNav - 8 + ${tambahan};
        window.scrollTo({ top: Math.max(0, y), behavior: 'instant' });
        return Math.round(Math.max(0, y));
      })()`,
    )
    if (target === null) throw new Error(`bagian #${id} tidak ditemukan`)
    const sampai = await tungguSampai(
      async () => Math.abs((await evaluasi(cdp, 'Math.round(window.scrollY)')) - target) <= 4,
      8000,
      150,
    )
    if (!sampai) throw new Error(`gulir ke #${id} tidak sampai`)
    await jeda(1100) // animasi reveal + gambar lambat
  }

  const buka = async (url) => {
    await cdp.kirim('Page.navigate', { url })
    await tungguSampai(async () => (await evaluasi(cdp, 'document.readyState')) === 'complete', 20000)
    // splash menutup halaman selama ~1 detik
    await tungguSampai(async () => (await evaluasi(cdp, `!document.getElementById('splash')`)) === true, 15000, 250)
    await jeda(600)
  }

  /* ------------------------------------------------------------ desktop -- */
  await metrik(1440, 900)
  await buka(`${BASE}/`)
  console.log('halaman penjelasan 1440×900…')

  await evaluasi(cdp, `window.scrollTo({ top: 0, behavior: 'instant' })`)
  await jeda(900)
  await simpan('prototype-1-hero.png')

  const bagian = [
    ['masalah', 'prototype-2-masalah.png', 0],
    ['konsep', 'prototype-3-konsep.png', 0],
    ['alur', 'prototype-4-alur.png', 0],
    ['fitur', 'prototype-5-fitur.png', 0],
    ['fitur', 'prototype-6-fitur-lanjut.png', 900],
    ['produk', 'prototype-7-produk.png', 0],
    ['kuesioner', 'prototype-8-kuesioner.png', 0],
    ['sumber', 'prototype-9-sumber.png', 0],
    ['etika', 'prototype-10-etika.png', 0],
  ]
  for (const [id, nama, tambahan] of bagian) {
    console.log(`  #${id}${tambahan ? ` +${tambahan}px` : ''}`)
    await keBagian(id, tambahan)
    await simpan(nama)
  }

  /* ------------------------------------------------------------- ponsel -- */
  console.log('halaman penjelasan 390×844…')
  await metrik(390, 844, 2, true)
  await buka(`${BASE}/`)
  await evaluasi(cdp, `window.scrollTo({ top: 0, behavior: 'instant' })`)
  await jeda(900)
  await simpan('prototype-hp-1-hero.png')
  await keBagian('masalah')
  await simpan('prototype-hp-2-masalah.png')

  cdp.tutup()
  console.log('\nselesai — berkas di docs/tangkapan-layar/')
}

try {
  await main()
} catch (e) {
  console.error('GAGAL:', e?.message ?? e)
  process.exitCode = 1
} finally {
  try {
    chrome?.kill('SIGKILL')
  } catch {
    /* sudah mati */
  }
  try {
    rmSync(PROFIL, { recursive: true, force: true })
  } catch {
    /* bukan masalah */
  }
}
