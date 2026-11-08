#!/usr/bin/env node
/**
 * Periksa halaman penjelasan (landing page) di peramban sungguhan:
 *   - enam kartu fitur ada, termasuk Fasilitas Kesehatan Terdekat
 *   - ketiga tangkapan layar BENAR-BENAR termuat (naturalWidth > 0)
 *   - tidak ada gambar rusak
 *   - tidak ada luapan mendatar di 1366x700 maupun 375x812
 *
 * Kenapa skrip sendiri: harness browser timeout pada halaman ini (18.280 px,
 * banyak animasi + gambar lambat), sedangkan jalur CDP langsung stabil.
 *
 * Pemakaian: node uji-halaman-penjelasan.mjs   (server hidup di :8787)
 */

import { spawn } from 'node:child_process'
import { existsSync, rmSync } from 'node:fs'
import { join } from 'node:path'

const BASE = process.env.BASE || 'http://127.0.0.1:8787'
const PORT_CDP = 9334
const PROFIL = join('/tmp', `pahami-uji-landing-${Date.now()}`)

let gagal = 0
const cek = (nama, lulus, bukti = '') => {
  if (!lulus) gagal++
  console.log(`  ${lulus ? 'LULUS' : 'GAGAL'}  ${nama}${bukti ? `  — ${bukti}` : ''}`)
}
const jeda = (ms) => new Promise((r) => setTimeout(r, ms))

class Cdp {
  constructor(url) {
    this.ws = new WebSocket(url)
    this.nomor = 0
    this.tunggu = new Map()
    this.siap = new Promise((r, j) => {
      this.ws.onopen = r
      this.ws.onerror = () => j(new Error('WebSocket CDP gagal'))
    })
    this.ws.onmessage = (m) => {
      let d
      try {
        d = JSON.parse(m.data)
      } catch {
        return
      }
      if (d.id && this.tunggu.has(d.id)) {
        const { r, j } = this.tunggu.get(d.id)
        this.tunggu.delete(d.id)
        if (d.error) j(new Error(d.error.message))
        else r(d.result)
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

async function evaluasi(cdp, expr) {
  const r = await cdp.kirim('Runtime.evaluate', { expression: expr, returnByValue: true, awaitPromise: true })
  if (r?.exceptionDetails) throw new Error(r.exceptionDetails.text)
  return r?.result?.value
}

async function tunggu(fn, batas = 25000, j = 300) {
  const mulai = Date.now()
  while (Date.now() - mulai < batas) {
    if (await fn()) return true
    await jeda(j)
  }
  return false
}

const bin = [
  process.env.CHROME_PATH,
  '/usr/bin/google-chrome-stable',
  '/usr/bin/google-chrome',
  '/usr/bin/chromium',
  '/usr/bin/chromium-browser',
].find((p) => p && existsSync(p))
if (!bin) {
  console.error('Chrome/Chromium tidak ditemukan')
  process.exit(1)
}

const chrome = spawn(
  bin,
  ['--headless=new', '--no-sandbox', '--disable-gpu', '--disable-dev-shm-usage', '--hide-scrollbars',
    `--remote-debugging-port=${PORT_CDP}`, `--user-data-dir=${PROFIL}`, 'about:blank'],
  { stdio: 'ignore' },
)

let cdp = null
try {
  if (!(await tunggu(async () => (await fetch(`http://127.0.0.1:${PORT_CDP}/json/version`).catch(() => ({ ok: false }))).ok, 20000))) {
    throw new Error('Chrome tidak membuka port CDP')
  }
  const daftar = await (await fetch(`http://127.0.0.1:${PORT_CDP}/json/list`)).json()
  cdp = new Cdp(daftar.find((t) => t.type === 'page').webSocketDebuggerUrl)
  await cdp.siap
  await cdp.kirim('Page.enable')
  await cdp.kirim('Runtime.enable')

  const ukuran = async (w, h, mobile) => {
    await cdp.kirim('Emulation.setDeviceMetricsOverride', { width: w, height: h, deviceScaleFactor: 1, mobile })
    await jeda(600)
  }

  console.log('\n== halaman penjelasan 1366x700 ==')
  await ukuran(1366, 700, false)
  await cdp.kirim('Page.navigate', { url: `${BASE}/` })
  await tunggu(async () => (await evaluasi(cdp, 'document.readyState')) === 'complete', 20000)
  await jeda(1500)

  cek('judul halaman benar', /Pahami Sehat/.test(await evaluasi(cdp, 'document.title')), await evaluasi(cdp, 'document.title'))
  cek('enam kartu fitur', (await evaluasi(cdp, "document.querySelectorAll('.feature-card').length")) === 6)
  cek(
    'judul bagian "Enam cara informasi"',
    /Enam cara informasi/.test(await evaluasi(cdp, 'document.body.innerText')),
  )
  /*
   * Kartu nomor 6 berubah 8 Nov 2026: dari "Fasilitas Kesehatan Terdekat &
   * Petunjuk Arah" menjadi "Pencarian Fasilitas Kesehatan Nasional". Tab
   * radius dihapus, jadi pemeriksaan teks lama (pemilihan wilayah bertingkat,
   * tiga moda, "bukan lalu lintas langsung") TIDAK BOLEH dipertahankan —
   * memeriksa teks yang sudah sengaja dihapus membuat uji merah selamanya.
   *
   * Yang diperiksa sekarang adalah klaim yang MEMANG ada di halaman.
   */
  const teks = await evaluasi(cdp, 'document.body.innerText')
  cek('kartu Fasilitas Kesehatan Nasional ada', teks.includes('Pencarian Fasilitas Kesehatan Nasional'))
  cek('menyebut jumlah faskes yang dicakup', /7\.423|7\.4\d\d/.test(teks))
  cek('menyebut dua sumber data', /SIRS/.test(teks) && /OpenStreetMap/.test(teks))
  cek('menyebut saringan wilayah', /provinsi/i.test(teks) && /kabupaten/i.test(teks))
  cek(
    'menyebut koordinat tidak dikarang',
    /Lokasi di peta belum tersedia/i.test(teks) || /tidak.*koordinat/i.test(teks),
  )

  // ---- tangkapan layar harus BENAR-BENAR termuat ----
  // `loading="lazy"` menahan gambar di bawah lipatan. Pengguna menggulir, jadi
  // uji ini juga menggulir — memaksa src lebih dulu akan menyembunyikan
  // kesalahan jalur yang sebenarnya.
  //
  // KENAPA TIDAK LAGI "TEPAT 3" (diperbaiki 5 Nov 2026): halaman penjelasan
  // menambah tiga tangkapan layar Fitur Fasilitas Kesehatan, jadi jumlahnya
  // menjadi 6. Angka mati `=== 3` membuat uji MERAH padahal keenam gambar
  // termuat dengan ukuran benar (1440×900) — yang salah ujinya, bukan
  // halamannya. Batas minimum tetap ada supaya galeri kosong tetap tertangkap;
  // yang membuktikan setiap gambar BENAR-BENAR tampil adalah pemeriksaan
  // `naturalWidth > 0` per gambar di bawah, dan itu tidak berubah.
  console.log('\n== tangkapan layar (setelah digulir) ==')
  const jumlahShot = await evaluasi(cdp, "document.querySelectorAll('img.shot').length")
  cek('tangkapan layar terpasang (minimal 3)', jumlahShot >= 3, String(jumlahShot))

  for (let i = 0; i < jumlahShot; i++) {
    await evaluasi(
      cdp,
      `(() => {
        const g = document.querySelectorAll('img.shot')[${i}];
        const y = g.getBoundingClientRect().top + window.scrollY - 100;
        window.scrollTo({ top: y, behavior: 'instant' });
      })()`,
    )
    const ok = await tunggu(
      async () => (await evaluasi(cdp, `(() => { const g = document.querySelectorAll('img.shot')[${i}]; return !!g && g.complete && g.naturalWidth > 0; })()`)) === true,
      20000,
      400,
    )
    const dim = await evaluasi(
      cdp,
      `(() => { const g = document.querySelectorAll('img.shot')[${i}]; return g.naturalWidth + 'x' + g.naturalHeight; })()`,
    )
    const nama = await evaluasi(cdp, `document.querySelectorAll('img.shot')[${i}].getAttribute('src').split('/').pop()`)
    cek(`gambar ${nama} termuat`, ok, dim)
  }

  cek(
    'tidak ada gambar rusak di halaman',
    (await evaluasi(cdp, "[...document.images].filter(i => i.complete && i.naturalWidth === 0).length")) === 0,
    String(await evaluasi(cdp, "[...document.images].filter(i => i.complete && i.naturalWidth === 0).map(i => i.getAttribute('src')).join(', ')")),
  )

  cek(
    'tidak ada luapan mendatar (1366 px)',
    (await evaluasi(cdp, 'document.documentElement.scrollWidth <= window.innerWidth + 1')) === true,
    `${await evaluasi(cdp, 'document.documentElement.scrollWidth')} vs ${await evaluasi(cdp, 'window.innerWidth')}`,
  )

  // ---- mobile ----
  console.log('\n== halaman penjelasan 375x812 ==')
  await ukuran(375, 812, true)
  await jeda(1200)
  cek(
    'tidak ada luapan mendatar (375 px)',
    (await evaluasi(cdp, 'document.documentElement.scrollWidth <= window.innerWidth + 1')) === true,
    `${await evaluasi(cdp, 'document.documentElement.scrollWidth')} vs ${await evaluasi(cdp, 'window.innerWidth')}`,
  )

  // ---- tautan internal ----
  const rusak = await evaluasi(
    cdp,
    `(() => {
      const id = new Set([...document.querySelectorAll('[id]')].map(e => e.id));
      return [...document.querySelectorAll('a[href^="#"]')]
        .map(a => a.getAttribute('href').slice(1))
        .filter(h => h && !id.has(h));
    })()`,
  )
  cek('semua tautan jangkar punya tujuan', Array.isArray(rusak) && rusak.length === 0, JSON.stringify(rusak))

  cek(
    'halaman aplikasi masih bisa dibuka',
    (await evaluasi(cdp, `fetch('${BASE}/app/').then(r => r.ok)`)) === true,
  )
} catch (e) {
  gagal++
  console.error('\nGAGAL:', e?.message ?? e)
} finally {
  cdp?.tutup()
  try {
    chrome.kill('SIGKILL')
  } catch {
    /* sudah mati */
  }
  try {
    rmSync(PROFIL, { recursive: true, force: true })
  } catch {
    /* bukan masalah */
  }
}

console.log('')
console.log(gagal === 0 ? 'SEMUA LULUS' : `${gagal} GAGAL`)
process.exit(gagal === 0 ? 0 : 1)
