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
import { existsSync, mkdirSync, writeFileSync, rmSync } from 'node:fs'
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

/**
 * Klik di koordinat layar lewat CDP.
 *
 * DIPERLUKAN untuk peta: klik pada Leaflet tidak bisa ditiru dengan
 * `element.click()` karena Leaflet membaca koordinat dari event mouse
 * (`clientX`/`clientY`), dan `.click()` tidak membawa keduanya. Tanpa
 * Input.dispatchMouseEvent, kliknya "berhasil" tanpa efek apa pun — peta tidak
 * pernah menerima titik.
 */
async function klik(cdp, x, y) {
  const dasar = { x, y, button: 'left', clickCount: 1 }
  await cdp.kirim('Input.dispatchMouseEvent', { type: 'mouseMoved', x, y })
  await cdp.kirim('Input.dispatchMouseEvent', { type: 'mousePressed', ...dasar })
  await cdp.kirim('Input.dispatchMouseEvent', { type: 'mouseReleased', ...dasar })
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

  /**
   * Simpan tangkapan ke DUA tempat.
   *
   * `docs/tangkapan-layar/` adalah arsip, tetapi yang benar-benar dipakai
   * halaman penjelasan adalah `docs/prototipe/assets/tangkapan-layar/`.
   * SEBELUMNYA skrip ini hanya menulis ke arsip, sehingga halaman penjelasan
   * terus menampilkan gambar lama — dan tidak ada yang memberi tahu, karena
   * rujukan `<img>`-nya hanya "gagal diam-diam" sebagai gambar rusak.
   *
   * Menyalinnya di sini membuat keduanya tidak mungkin menyimpang.
   */
  const simpan = async (nama) => {
    const r = await cdp.kirim('Page.captureScreenshot', { format: 'png' })
    const isi = Buffer.from(r.data, 'base64')
    const jalur = join(TUJUAN, nama)
    writeFileSync(jalur, isi)
    const ukuran = isi.length
    if (ukuran < 20000) throw new Error(`${nama} terlalu kecil (${ukuran} byte) — tangkapan gagal`)

    const untukHalaman = join(AKAR, 'docs', 'prototipe', 'assets', 'tangkapan-layar', nama)
    mkdirSync(dirname(untukHalaman), { recursive: true })
    writeFileSync(untukHalaman, isi)

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

  /* ====================================================================== *
   * TANGKAPAN 0: DAFTAR NASIONAL APA ADANYA
   *
   * Diambil lebih dulu, tanpa satu pun filter aktif, supaya angka besar
   * (7.423 fasilitas) terlihat. Angka ini berasal dari database, bukan
   * dikarang — kalau database berubah, tangkapan ini ikut berubah.
   * ====================================================================== */
  console.log('  daftar nasional…')
  const adaDaftar = await tungguSampai(
    async () =>
      (await evaluasi(
        cdp,
        `(() => {
          const t = document.querySelector('main')?.innerText || '';
          const m = t.match(/([\\d\\.]+)\\s*fasilitas ditemukan/);
          return m ? Number(m[1].replace(/\\./g, '')) : 0;
        })()`,
      )) > 1000,
    40000,
    800,
  )
  if (adaDaftar) {
    await simpan('faskes-0-daftar-nasional.png')
  } else {
    throw new Error('daftar nasional tidak memuat hasil — server/database mati?')
  }

  /* ====================================================================== *
   * TANGKAPAN 1: SARINGAN JENIS FASILITAS
   *
   * Memilih "Rumah Sakit" membuktikan saringan benar-benar menyaring: angka
   * turun dari 7.423 menjadi jumlah rumah sakit saja.
   * ====================================================================== */
  console.log('  saringan jenis…')
  const angkaAwal = await evaluasi(
    cdp,
    `(() => {
      const t = document.querySelector('main')?.innerText || '';
      const m = t.match(/([\\d\\.]+)\\s*fasilitas ditemukan/);
      return m ? Number(m[1].replace(/\\./g, '')) : 0;
    })()`,
  )
  await evaluasi(
    cdp,
    `(() => {
      const s = document.querySelectorAll('main select')[0];
      if (!s) return false;
      const o = [...s.options].find(o => o.value === 'rumah-sakit');
      if (!o) return false;
      s.value = o.value;
      s.dispatchEvent(new Event('change', { bubbles: true }));
      return true;
    })()`,
  )
  const angkaSaring = await tungguSampai(
    async () =>
      (await evaluasi(
        cdp,
        `(() => {
          const t = document.querySelector('main')?.innerText || '';
          const m = t.match(/([\\d\\.]+)\\s*fasilitas ditemukan/);
          return m ? Number(m[1].replace(/\\./g, '')) : 0;
        })()`,
      )) > 0,
    20000,
    600,
  )
  if (!angkaSaring) throw new Error('saringan jenis tidak menghasilkan apa pun')
  await jeda(800)
  await simpan('faskes-1-saringan-jenis.png')

  /* ====================================================================== *
   * TANGKAPAN 2: PENCARIAN NAMA
   *
   * Diketik sungguhan lewat CDP (bukan disetel lewat JS) supaya yang terekam
   * adalah perilaku yang dilihat pengguna, termasuk jeda 350 ms-nya.
   * ====================================================================== */
  console.log('  pencarian nama…')
  await evaluasi(
    cdp,
    `(() => {
      const s = document.querySelectorAll('main select')[0];
      if (s) { s.value = ''; s.dispatchEvent(new Event('change', { bubbles: true })); }
      return true;
    })()`,
  )
  await jeda(600)
  await evaluasi(
    cdp,
    `(() => {
      const i = document.querySelector('main input[type="search"]');
      if (i) i.focus();
      return !!i;
    })()`,
  )
  for (const huruf of 'siloam') {
    await cdp.kirim('Input.dispatchKeyEvent', { type: 'keyDown', text: huruf })
    await cdp.kirim('Input.dispatchKeyEvent', { type: 'keyUp' })
    await jeda(70)
  }
  const adaCari = await tungguSampai(
    async () =>
      (await evaluasi(
        cdp,
        `(() => {
          const t = document.querySelector('main')?.innerText || '';
          const m = t.match(/([\\d\\.]+)\\s*fasilitas ditemukan/);
          const n = m ? Number(m[1].replace(/\\./g, '')) : 0;
          return n > 0 && n < 200;
        })()`,
      )) === true,
    20000,
    600,
  )
  if (!adaCari) throw new Error('pencarian nama tidak menyaring hasil')
  await jeda(700)
  await simpan('faskes-2-pencarian-nama.png')

  /* ====================================================================== *
   * TANGKAPAN 3: SARINGAN WILAYAH (bertahap)
   *
   * Provinsi saja dulu: memilih provinsi mengaktifkan dropdown kabupaten,
   * dan itu yang ingin terlihat di gambar.
   * ====================================================================== */
  console.log('  saringan wilayah…')
  await evaluasi(
    cdp,
    `(() => {
      const i = document.querySelector('main input[type="search"]');
      if (i) { i.value = ''; i.dispatchEvent(new Event('input', { bubbles: true })); }
      return true;
    })()`,
  )
  await jeda(700)
  await evaluasi(
    cdp,
    `(() => {
      const sel = document.querySelectorAll('main select');
      if (!sel[1]) return false;
      const o = [...sel[1].options].find(o => /jawa timur/i.test(o.text));
      if (!o) return false;
      sel[1].value = o.value;
      sel[1].dispatchEvent(new Event('change', { bubbles: true }));
      return true;
    })()`,
  )
  const adaWilayah = await tungguSampai(
    async () =>
      (await evaluasi(
        cdp,
        `(() => {
          const sel = document.querySelectorAll('main select');
          return !!(sel[2] && !sel[2].disabled && sel[2].options.length > 2);
        })()`,
      )) === true,
    20000,
    600,
  )
  if (!adaWilayah) throw new Error('saringan provinsi tidak mengaktifkan kabupaten')
  await jeda(800)
  await simpan('faskes-3-saringan-wilayah.png')

  /* ====================================================================== *
   * TANGKAPAN 4: HP 375 px
   *
   * Diambil terakhir karena ukuran viewport diubah: setelah ini semua
   * tangkapan berikutnya akan ikut sempit.
   * ====================================================================== */
  console.log('  tampilan HP…')
  await cdp.kirim('Emulation.setDeviceMetricsOverride', {
    width: 390,
    height: 844,
    deviceScaleFactor: 2,
    mobile: true,
  })
  await jeda(1200)
  await evaluasi(cdp, 'window.scrollTo(0, 0)')
  await jeda(600)
  await simpan('faskes-4-hp.png')

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
