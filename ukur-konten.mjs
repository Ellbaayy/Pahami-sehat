/**
 * Ukur berapa permintaan jaringan yang benar-benar dikeluarkan server/konten.js
 * saat cache kosong (meniru cold start di serverless).
 *
 * Caranya: pasang penghitung pada global fetch, lalu jalankan kontenHarian()
 * dengan cache yang sengaja dikosongkan.
 */
import { rm } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

const __dirname = dirname(fileURLToPath(import.meta.url))
const CACHE = join(__dirname, 'app', '.cache-konten.json')

// kosongkan cache supaya benar-benar dari nol
await rm(CACHE, { force: true })

// pasang penghitung sebelum modul konten dipakai
const asli = globalThis.fetch
const tercatat = []
globalThis.fetch = async (url, ...sisa) => {
  const mulai = Date.now()
  try {
    const r = await asli(url, ...sisa)
    tercatat.push({ url: String(url).slice(0, 80), status: r.status, ms: Date.now() - mulai })
    return r
  } catch (e) {
    tercatat.push({ url: String(url).slice(0, 80), status: 'GAGAL', ms: Date.now() - mulai, err: e.message })
    throw e
  }
}

const { kontenHarian } = await import('./app/server/konten.js')

const mulai = Date.now()
const hasil = await kontenHarian({ paksa: true })
const total = Date.now() - mulai

console.log('=== HASIL PENGUKURAN ===')
console.log('total waktu        :', total, 'ms')
console.log('jumlah permintaan  :', tercatat.length)
console.log('topik / artikel    :', hasil.topik.length, '/', hasil.artikel.length)
console.log('artikel di pool    :', hasil.pool?.length ?? 0)
console.log('punya tips         :', Boolean(hasil.tips))
console.log()

const perHost = {}
for (const t of tercatat) {
  const h = new URL(t.url).host
  perHost[h] = (perHost[h] ?? 0) + 1
}
console.log('per host:', perHost)

const gagal = tercatat.filter((t) => t.status === 'GAGAL' || t.status >= 400)
console.log('gagal   :', gagal.length)
for (const g of gagal.slice(0, 5)) console.log('  -', g.url, g.status, g.err ?? '')

// simpan untuk laporan
const { writeFile } = await import('node:fs/promises')
await writeFile(
  '/home/ellbaayy/.hermes/cache/scratch/ukur-konten.json',
  JSON.stringify({ total, jumlah: tercatat.length, perHost, gagal: gagal.length, pool: hasil.pool?.length }, null, 1),
)
