#!/usr/bin/env node
/**
 * Ambil tangkapan layar DASHBOARD (7 halaman) + ponsel + mode kontras tinggi.
 *
 * ============================================================================
 * KENAPA SKRIP SENDIRI
 * ============================================================================
 * `ambil-tangkapan.mjs` hanya mengurus halaman Fasilitas Kesehatan (peta
 * Leaflet tidak pernah "tenang", jadi harness biasa timeout). Skrip ini
 * memakai jalur yang sama — Chrome + CDP langsung, tanpa dependensi baru —
 * tetapi untuk halaman-halaman lain, dan menunggu SYARAT yang jelas
 * (aria-current pada menu, putusan klaim muncul, sumber jawaban muncul),
 * bukan sekadar jeda tetap.
 *
 * Gambar diambil dari aplikasi yang BENAR-BENAR berjalan:
 *   - Tanya AI menampilkan jawaban model sungguhan beserta daftar sumbernya.
 *   - Cek Klaim menampilkan putusan sungguhan dari /api/verifikasi.
 * Kalau server tidak hidup, skrip berhenti — bukan menyimpan gambar kosong.
 *
 * Pemakaian (server harus hidup di 127.0.0.1:8787):
 *   node ambil-tangkapan-dashboard.mjs
 */

import { spawn } from 'node:child_process'
import { existsSync, mkdirSync, writeFileSync, rmSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const AKAR = dirname(fileURLToPath(import.meta.url))
const TUJUAN = join(AKAR, 'docs', 'tangkapan-layar')
const BASE = process.env.BASE || 'http://127.0.0.1:8787'
const PORT_CDP = 9334

/* ------------------------------------------------------------- CDP tipis -- */

class Cdp {
  constructor(url) {
    this.ws = new WebSocket(url)
    this.nomor = 0
    this.tunggu = new Map()
    this.pendengar = new Map()
    this.siap = new Promise((r, j) => {
      this.ws.onopen = r
      this.ws.onerror = () => j(new Error('gagal membuka WebSocket CDP'))
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
        return
      }
      for (const f of this.pendengar.get(d.method) ?? []) f(d.params)
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

async function tungguSampai(fn, batasMs = 60000, jedaMs = 400) {
  const mulai = Date.now()
  let galatTerakhir = null
  while (Date.now() - mulai < batasMs) {
    try {
      if (await fn()) return true
    } catch (e) {
      // Jangan telan galat tanpa jejak: kalau syaratnya tidak pernah tercapai
      // karena ekspresinya sendiri yang salah, pesannya harus terlihat.
      galatTerakhir = e?.message ?? String(e)
    }
    await jeda(jedaMs)
  }
  if (galatTerakhir) console.error('  (galat terakhir saat menunggu:', galatTerakhir + ')')
  return false
}

async function evaluasi(cdp, ekspresi) {
  const r = await cdp.kirim('Runtime.evaluate', {
    expression: ekspresi,
    returnByValue: true,
    awaitPromise: true,
  })
  const hasil = r?.result
  if (hasil?.subtype === 'error') throw new Error(hasil.description ?? 'galat di halaman')
  return hasil?.value
}

/* ------------------------------------------------------------ utama ----- */

const PROFIL = join('/tmp', `pahami-dash-${Date.now()}`)
let chrome = null

function cariChrome() {
  const kandidat = [
    process.env.CHROME_PATH,
    '/usr/bin/google-chrome-stable',
    '/usr/bin/google-chrome',
    '/usr/bin/chromium',
    '/usr/bin/chromium-browser',
  ].filter(Boolean)
  return kandidat.find((p) => existsSync(p)) ?? null
}

async function main() {
  const bin = cariChrome()
  if (!bin) throw new Error('Chrome/Chromium tidak ditemukan')
  if (!existsSync(TUJUAN)) mkdirSync(TUJUAN, { recursive: true })

  // Server harus hidup: gambar harus berasal dari aplikasi yang berjalan.
  const sehat = await fetch(`${BASE}/api/health`).then((r) => r.ok).catch(() => false)
  if (!sehat) throw new Error(`server tidak menjawab di ${BASE} — jalankan npm run server dulu`)

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

  const siap = await tungguSampai(async () => {
    const r = await fetch(`http://127.0.0.1:${PORT_CDP}/json/version`)
    return r.ok
  }, 20000)
  if (!siap) throw new Error('Chrome tidak membuka port CDP')

  const daftar = await (await fetch(`http://127.0.0.1:${PORT_CDP}/json/list`)).json()
  const halaman = daftar.find((t) => t.type === 'page')
  const cdp = new Cdp(halaman.webSocketDebuggerUrl)
  await cdp.siap
  await cdp.kirim('Page.enable')
  await cdp.kirim('Runtime.enable')

  const metrik = (width, height, dpr = 1, mobile = false) =>
    cdp.kirim('Emulation.setDeviceMetricsOverride', {
      width,
      height,
      deviceScaleFactor: dpr,
      mobile,
    })

  const simpan = async (nama) => {
    const r = await cdp.kirim('Page.captureScreenshot', { format: 'png' })
    const isi = Buffer.from(r.data, 'base64')
    if (isi.length < 20000) throw new Error(`${nama} terlalu kecil (${isi.length} byte) — tangkapan gagal`)
    writeFileSync(join(TUJUAN, nama), isi)
    console.log(`  ok  ${nama}  (${Math.round(isi.length / 1024)} KB)`)
  }

  const buka = async (url) => {
    await cdp.kirim('Page.navigate', { url })
    await tungguSampai(async () => (await evaluasi(cdp, 'document.readyState')) === 'complete', 20000)
  }

  /** Klik menu sidebar berdasarkan labelnya, lalu tunggu menu itu aktif. */
  const pilih = async (label) => {
    const diklik = await evaluasi(
      cdp,
      `(() => {
        const b = [...document.querySelectorAll('aside button[aria-label]')]
          .find(e => e.getAttribute('aria-label') === ${JSON.stringify(label)});
        if (b) b.click();
        return !!b;
      })()`,
    )
    if (!diklik) throw new Error(`menu "${label}" tidak ditemukan di sidebar`)
    const aktif = await tungguSampai(
      async () =>
        (await evaluasi(
          cdp,
          `(() => {
            const b = [...document.querySelectorAll('aside button[aria-label]')]
              .find(e => e.getAttribute('aria-label') === ${JSON.stringify(label)});
            return b?.getAttribute('aria-current') === 'page';
          })()`,
        )) === true,
      15000,
      250,
    )
    if (!aktif) throw new Error(`menu "${label}" tidak menjadi aktif`)
    await jeda(1200) // biarkan animasi masuk selesai
  }

  /* ------------------------------------------------ desktop 1440×900 --- */
  await metrik(1440, 900)
  await buka(`${BASE}/app/`)
  const siapApp = await tungguSampai(
    async () => (await evaluasi(cdp, `!!document.querySelector('main h1')`)) === true,
    30000,
    400,
  )
  if (!siapApp) throw new Error('aplikasi tidak selesai memuat (main h1 tidak muncul)')
  await jeda(1500) // LoadingPage + kartu beranda

  console.log('beranda…')
  await simpan('dashboard-1-beranda.png')

  /* Tanya AI — jawaban SUNGGUHAN, bukan empty state. */
  console.log('tanya ai…')
  await pilih('Tanya AI')
  await evaluasi(
    cdp,
    `(() => {
      const t = document.querySelector('main textarea');
      if (!t) return false;
      t.focus();
      const set = Object.getOwnPropertyDescriptor(window.HTMLTextAreaElement.prototype, 'value').set;
      set.call(t, 'Apa itu hipertensi?');
      t.dispatchEvent(new Event('input', { bubbles: true }));
      return true;
    })()`,
  )
  await jeda(400)
  const dikirim = await evaluasi(
    cdp,
    `(() => {
      const b = [...document.querySelectorAll('main button[type="submit"]')]
        .find(e => !e.disabled);
      if (b) b.click();
      return !!b;
    })()`,
  )
  if (!dikirim) throw new Error('tombol kirim Tanya AI tidak bisa diklik')

  let percobaan = 0
  const adaJawaban = await tungguSampai(
    async () => {
      const st = await evaluasi(
        cdp,
        `(() => {
          const m = document.querySelector('main');
          const t = m?.innerText || '';
          const sibuk = !!m?.querySelector('[aria-busy="true"]');
          const hentikan = [...(m?.querySelectorAll('button') || [])].some((b) =>
            /Hentikan/i.test(b.textContent),
          );
          const mengutip = !t.includes('belum mengutip satu pun');
          const adaSumber = t.includes('Sumber jawaban (');
          return {
            panjang: t.length,
            sibuk,
            hentikan,
            mengutip,
            adaSumber,
          };
        })()`,
      )
      if (++percobaan % 5 === 0) console.log('   keadaan:', JSON.stringify(st))
      return st.panjang > 1200 && !st.sibuk && !st.hentikan && st.mengutip && st.adaSumber
    },
    180000,
    1000,
  )
  if (!adaJawaban) throw new Error('jawaban AI + daftar sumber tidak selesai dalam 180 detik')
  await jeda(1200)
  await simpan('dashboard-2-tanya-ai.png')

  /* Cek Klaim — putusan SUNGGUHAN. */
  console.log('cek klaim…')
  await pilih('Cek Klaim')
  await evaluasi(
    cdp,
    `(() => {
      const b = [...document.querySelectorAll('main button')]
        .find(e => /Pakai contoh/i.test(e.textContent));
      if (b) b.click();
      return !!b;
    })()`,
  )
  await jeda(500)
  const periksa = await evaluasi(
    cdp,
    `(() => {
      const b = [...document.querySelectorAll('main button')]
        .find(e => /Periksa klaim/i.test(e.textContent) && !e.disabled);
      if (b) b.click();
      return !!b;
    })()`,
  )
  if (!periksa) throw new Error('tombol "Periksa klaim" tidak bisa diklik')
  const adaPutusan = await tungguSampai(
    async () => (await evaluasi(cdp, `!!document.querySelector('main [data-putusan]')`)) === true,
    120000,
    1000,
  )
  if (!adaPutusan) throw new Error('putusan Cek Klaim tidak muncul dalam 120 detik')
  await jeda(1200)
  await simpan('dashboard-3-cek-klaim.png')

  console.log('fasilitas kesehatan…')
  await pilih('Fasilitas Kesehatan')
  await jeda(1200)
  await simpan('dashboard-4-faskes.png')

  console.log('riwayat…')
  await pilih('Riwayat')
  await simpan('dashboard-5-riwayat.png')

  console.log('kuesioner…')
  await pilih('Kuesioner')
  await simpan('dashboard-6-kuesioner.png')

  console.log('pengaturan…')
  await pilih('Pengaturan')
  await simpan('dashboard-7-pengaturan.png')

  /* ------------------------------------------------ kontras tinggi ----- */
  console.log('kontras tinggi…')
  const sakelar = await evaluasi(
    cdp,
    `(() => {
      const s = [...document.querySelectorAll('main [role="switch"], main input[type="checkbox"]')]
        .find(e => /kontras/i.test(e.getAttribute('aria-label') || e.closest('label')?.innerText || ''));
      if (!s) return false;
      if (!s.checked) s.click();
      return true;
    })()`,
  )
  if (!sakelar) throw new Error('sakelar kontras tinggi tidak ditemukan di Pengaturan')
  await jeda(1200)
  await simpan('dashboard-kontras-tinggi.png')
  // kembalikan supaya tangkapan ponsel di bawah memakai tampilan normal
  await evaluasi(
    cdp,
    `(() => {
      const s = [...document.querySelectorAll('main [role="switch"], main input[type="checkbox"]')]
        .find(e => /kontras/i.test(e.getAttribute('aria-label') || e.closest('label')?.innerText || ''));
      if (s && s.checked) s.click();
      return true;
    })()`,
  )
  await jeda(800)

  /* ------------------------------------------------------- ponsel ------ */
  console.log('ponsel 390×844…')
  await metrik(390, 844, 2, true)
  await buka(`${BASE}/app/`)
  await tungguSampai(
    async () => (await evaluasi(cdp, `!!document.querySelector('main h1')`)) === true,
    30000,
    400,
  )
  await jeda(1800)
  await simpan('dashboard-hp-1-beranda.png')

  const menu = await evaluasi(
    cdp,
    `(() => {
      const b = [...document.querySelectorAll('button[aria-label]')]
        .find(e => /Buka menu/i.test(e.getAttribute('aria-label')));
      if (b) b.click();
      return !!b;
    })()`,
  )
  if (!menu) throw new Error('tombol "Buka menu" tidak ditemukan di ponsel')
  await jeda(900)
  await simpan('dashboard-hp-2-menu.png')

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
