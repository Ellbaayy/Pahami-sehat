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
   * TANGKAPAN 0: TAB RS NASIONAL (SIRS)
   *
   * Diambil PALING AWAL karena tidak butuh lokasi sama sekali — daftarnya
   * berasal dari database, bukan dari pencarian sekitar titik. Kalau diambil
   * belakangan, halaman sudah penuh peta dan daftar fasilitas sehingga tab
   * yang ingin ditonjolkan justru tenggelam.
   * ====================================================================== */
  console.log('  tab RS Nasional…')
  await evaluasi(
    cdp,
    `(() => {
      const b = [...document.querySelectorAll('main [role="tab"], main button')]
        .find(e => /Rumah Sakit Nasional/i.test(e.textContent));
      if (b) b.click();
      return !!b;
    })()`,
  )
  await jeda(2500)
  const adaRs = await tungguSampai(
    async () =>
      (await evaluasi(
        cdp,
        `(() => {
          const t = document.querySelector('main')?.innerText || '';
          return /rumah sakit/i.test(t) && /\\d{3,}/.test(t);
        })()`,
      )) === true,
    30000,
    800,
  )
  if (adaRs) {
    await simpan('faskes-0-rs-nasional.png')
  } else {
    console.log('  (tab RS Nasional tidak siap — dilewati)')
  }

  /* ====================================================================== *
   * TANGKAPAN 1-2: PENCARIAN ALAMAT (fitur baru)
   *
   * Jalur ketik alamat, bukan jalur wilayah: inilah yang menyerupai Google
   * Maps dan yang ingin ditunjukkan. Kandidat dipilih dari daftar saran
   * SUNGGUHAN (Photon), bukan diketik lalu ditekan Enter tanpa melihat.
   * ====================================================================== */
  console.log('  kembali ke tab Cari Fasilitas…')
  await evaluasi(
    cdp,
    `(() => {
      const b = [...document.querySelectorAll('main [role="tab"], main button')]
        .find(e => /Fasilitas Terdekat/i.test(e.textContent));
      if (b) b.click();
      return !!b;
    })()`,
  )
  await jeda(1500)

  console.log('  mengetik alamat…')
  await evaluasi(
    cdp,
    `(() => {
      const i = document.getElementById('input-alamat');
      if (!i) return false;
      i.focus();
      const set = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set;
      set.call(i, 'Malioboro Yogyakarta');
      i.dispatchEvent(new Event('input', { bubbles: true }));
      return true;
    })()`,
  )

  // Tunggu daftar saran benar-benar terisi — bukan sekadar jeda tetap.
  const adaSaran = await tungguSampai(
    async () =>
      (await evaluasi(cdp, `document.querySelectorAll('#alamat-saran li').length > 0`)) === true,
    30000,
    500,
  )
  if (!adaSaran) throw new Error('saran alamat tidak muncul — Photon hidup? coba lagi')
  await jeda(700)
  await simpan('faskes-1-autocomplete.png')

  // Pilih saran pertama, lalu tunggu wilayah terdeteksi.
  console.log('  memilih saran…')
  await evaluasi(
    cdp,
    `(() => {
      const b = document.querySelector('#alamat-saran li button');
      if (b) b.click();
      return !!b;
    })()`,
  )

  const adaWilayah = await tungguSampai(
    async () =>
      (await evaluasi(
        cdp,
        `(() => {
          const t = document.querySelector('main')?.innerText || '';
          return /Provinsi/.test(t) && /Kecamatan/.test(t);
        })()`,
      )) === true,
    45000,
    800,
  )
  if (!adaWilayah) throw new Error('wilayah tidak terdeteksi setelah memilih alamat')

  // Tunggu fasilitas benar-benar datang (bisa 40-50 detik untuk wilayah baru).
  const adaDataAlamat = await tungguSampai(
    async () =>
      (await evaluasi(
        cdp,
        `(() => {
          const t = document.querySelector('main')?.innerText || '';
          return /fasilitas ditemukan/.test(t) && document.querySelectorAll('.leaflet-marker-icon').length > 0;
        })()`,
      )) === true,
    150000,
    1000,
  )
  if (!adaDataAlamat) throw new Error('fasilitas dari alamat tidak siap')
  await jeda(2500)
  await simpan('faskes-2-peta-daftar.png')

  /* ====================================================================== *
   * TANGKAPAN 3: DETAIL FASILITAS
   * ====================================================================== */
  const kartu = await evaluasi(
    cdp,
    `(() => {
      const m = document.querySelector('main');
      const k = [...m.querySelectorAll('button')].filter(e => {
        const s = e.textContent;
        return s.length < 240 && (s.indexOf(' km') > 0 || s.indexOf(' m') > 0);
      });
      const t = k[0];
      if (t) t.click();
      return t ? t.innerText.replace(/\\n/g, ' | ').slice(0, 50) : null;
    })()`,
  )
  console.log('  kartu:', kartu)
  await jeda(2000)
  await simpan('faskes-3-detail.png')

  /* ====================================================================== *
   * TANGKAPAN 4: PETUNJUK ARAH (jalan kaki, supaya beda dari mobil)
   * ====================================================================== */
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
          return /km · sekitar|kurang dari 1 menit/.test(t) && document.querySelectorAll('ol li').length > 0;
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
  await simpan('faskes-4-petunjuk-arah.png')

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
