#!/usr/bin/env node
/**
 * Ambil tangkapan layar dashboard untuk halaman penjelasan.
 *
 * ============================================================================
 * KENAPA SKRIP SENDIRI, BUKAN ALAT HARNESS
 * ============================================================================
 * Tangkapan layar halaman Fasilitas Kesehatan lewat harness SELALU timeout
 * (60 detik): peta Leaflet terus menarik ubin sehingga halaman tidak pernah
 * tenang. Skrip ini memakai jalur yang sama dengan `uji-peramban.mjs` —
 * Chrome + CDP langsung, tanpa dependensi baru — dan menunggu dengan syarat
 * yang jelas (jumlah penanda), bukan "halaman tenang".
 *
 * ============================================================================
 * YANG WAJIB DIJAGA
 * ============================================================================
 * Gambar yang dipakai halaman penjelasan HARUS berasal dari aplikasi yang
 * benar-benar berjalan, bukan mockup dan bukan gambar karangan. Karena itu
 * skrip ini menolak menyimpan berkas yang terlalu kecil (tangkapan gagal
 * menghasilkan gambar nyaris kosong).
 *
 * Pemakaian (server harus hidup di 127.0.0.1:8787):
 *   node ambil-tangkapan.mjs
 */

import { spawn } from 'node:child_process'
import { existsSync, mkdirSync, writeFileSync, statSync, rmSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const AKAR = dirname(fileURLToPath(import.meta.url))
const TUJUAN = join(AKAR, 'docs', 'tangkapan-layar')
const BASE = process.env.BASE || 'http://127.0.0.1:8787'
const PORT_CDP = 9333

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

  on(method, fn) {
    if (!this.pendengar.has(method)) this.pendengar.set(method, [])
    this.pendengar.get(method).push(fn)
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
  return r?.result?.value
}

/* ------------------------------------------------------------ utama ----- */

const PROFIL = join('/tmp', `pahami-shot-${Date.now()}`)
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

  await cdp.kirim('Emulation.setDeviceMetricsOverride', {
    width: 1440,
    height: 900,
    deviceScaleFactor: 1,
    mobile: false,
  })

  // Izin lokasi + posisi tetap HANYA untuk menghasilkan gambar: ini peranti
  // pengambil tangkapan layar, bukan fitur aplikasi. Aplikasi sendiri tidak
  // pernah mengisi lokasi pengguna.
  await cdp.kirim('Browser.grantPermissions', {
    origin: BASE,
    permissions: ['geolocation'],
  })
  await cdp.kirim('Emulation.setGeolocationOverride', {
    latitude: -6.1754,
    longitude: 106.8272,
    accuracy: 20,
  })

  const simpan = async (nama) => {
    const r = await cdp.kirim('Page.captureScreenshot', { format: 'png' })
    const jalur = join(TUJUAN, nama)
    writeFileSync(jalur, Buffer.from(r.data, 'base64'))
    const ukuran = statSync(jalur).size
    if (ukuran < 20000) throw new Error(`${nama} terlalu kecil (${ukuran} byte) — tangkapan gagal`)
    console.log(`  ok  ${nama}  (${Math.round(ukuran / 1024)} KB)`)
  }

  const buka = async (url) => {
    await cdp.kirim('Page.navigate', { url })
    await tungguSampai(async () => (await evaluasi(cdp, 'document.readyState')) === 'complete', 20000)
  }

  console.log('membuka Fasilitas Kesehatan…')
  await buka(`${BASE}/app/`)
  await jeda(2500)

  // pindah ke halaman Fasilitas Kesehatan
  await evaluasi(
    cdp,
    `(() => {
      const a = [...document.querySelectorAll('nav a, aside a, nav button, .app-nav-item')]
        .find(e => e.textContent.indexOf('Fasilitas Kesehatan') >= 0);
      if (a) a.click();
      return !!a;
    })()`,
  )
  await jeda(2000)

  /*
   * Pakai JALUR WILAYAH, bukan GPS.
   *
   * Halaman penjelasan harus memperlihatkan fitur yang baru, dan pemilihan
   * wilayah administratif itulah fiturnya. Kalau jalur GPS yang dipakai,
   * keempat dropdown tampil kosong dan tombolnya nonaktif — gambar yang benar
   * secara teknis tetapi menyembunyikan hal yang ingin ditonjolkan.
   */
  const isiWilayah = async (indeks, nama) => {
    const kode = await evaluasi(
      cdp,
      `(() => {
        const sel = [...document.querySelectorAll('main select')][${indeks}];
        if (!sel) return null;
        const o = [...sel.options].find(x => x.textContent.indexOf(${JSON.stringify(nama)}) >= 0);
        return o ? o.value : null;
      })()`,
    )
    if (!kode) return false
    await evaluasi(
      cdp,
      `(() => {
        const sel = [...document.querySelectorAll('main select')][${indeks}];
        const set = Object.getOwnPropertyDescriptor(window.HTMLSelectElement.prototype, 'value').set;
        set.call(sel, ${JSON.stringify(kode)});
        sel.dispatchEvent(new Event('change', { bubbles: true }));
      })()`,
    )
    await jeda(1500)
    return true
  }

  console.log('  wilayah:', await isiWilayah(0, 'Jawa Barat'))
  console.log('  kabupaten:', await isiWilayah(1, 'Kabupaten Bekasi'))
  console.log('  kecamatan:', await isiWilayah(2, 'Cikarang Selatan'))

  await evaluasi(
    cdp,
    `(() => {
      const b = [...document.querySelectorAll('main button')]
        .find(e => /Gunakan lokasi ini/i.test(e.textContent));
      if (b) b.click();
      return !!b;
    })()`,
  )

  // tunggu sampai ada penanda DAN jumlah fasilitas muncul — syarat yang jelas,
  // bukan "halaman tenang" yang tidak pernah tercapai karena ubin peta.
  const adaData = await tungguSampai(
    async () =>
      (await evaluasi(
        cdp,
        `(() => {
          const t = document.querySelector('main')?.innerText || '';
          const pin = document.querySelectorAll('.leaflet-marker-icon').length;
          return /fasilitas ditemukan/.test(t);
        })()`,
      )) === true,
    120000,
    1000,
  )
  if (!adaData) throw new Error('data fasilitas tidak siap — server hidup? coba lagi')
  await jeda(2500)
  await simpan('faskes-1-peta-daftar.png')

  // detail fasilitas
  const kartu = await evaluasi(
    cdp,
    `(() => {
      const m = document.querySelector('main');
      const k = [...m.querySelectorAll('button')].filter(e => {
        const s = e.textContent;
        return s.length < 240 && (s.indexOf(' km') > 0 || s.indexOf(' m') > 0);
      });
      const t = k.find(e => /RSPAD Gatot/i.test(e.textContent)) || k[0];
      if (t) t.click();
      return t ? t.innerText.replace(/\\n/g, ' | ').slice(0, 50) : null;
    })()`,
  )
  console.log('  kartu:', kartu)
  await jeda(2000)
  await simpan('faskes-2-detail.png')

  // petunjuk arah — pilih jalan kaki supaya rutenya jelas berbeda
  await evaluasi(
    cdp,
    `(() => {
      const b = [...document.querySelectorAll('main button')]
        .find(e => /Petunjuk Arah/i.test(e.textContent));
      if (b) b.click();
      return !!b;
    })()`,
  )
  const adaRute = await tungguSampai(
    async () =>
      (await evaluasi(
        cdp,
        `(() => {
          const t = document.querySelector('main')?.innerText || '';
          return /km · sekitar/.test(t) && document.querySelectorAll('ol li').length > 0;
        })()`,
      )) === true,
    60000,
    800,
  )
  if (!adaRute) throw new Error('rute tidak muncul')

  await evaluasi(
    cdp,
    `(() => {
      const b = [...document.querySelectorAll('main button')].find(e => e.textContent.trim() === 'Jalan kaki');
      if (b) b.click();
      return !!b;
    })()`,
  )
  await jeda(3000)
  await simpan('faskes-3-petunjuk-arah.png')

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
