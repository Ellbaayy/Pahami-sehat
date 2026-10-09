/**
 * Salin halaman penjelasan (docs/prototipe) ke app/public/prototipe/
 * supaya ikut ter-deploy ke Vercel dan bisa diakses di /prototipe/.
 *
 * Dijalankan otomatis sebelum `vite build` dan sebelum `vite dev`
 * (lihat scripts.predev / scripts.prebuild di package.json).
 *
 * Kenapa disalin, bukan disimpan langsung di app/public/:
 *   - Sumbernya tetap satu tempat (docs/prototipe), tidak ada dua salinan di git.
 *   - Hasil salinan masuk .gitignore, jadi tidak ikut ter-commit.
 *
 * Penyesuaian saat menyalin:
 *   - Tautan "Coba Demo" yang semula ../../app/dist/index.html
 *     diarahkan ke / (aplikasi ada di root situs).
 */

import { cp, rm, mkdir, readFile, writeFile, access } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

const __dirname = dirname(fileURLToPath(import.meta.url))
const APP = join(__dirname, '..')
const SUMBER = join(APP, '..', 'docs', 'prototipe')
const TUJUAN = join(APP, 'public', 'prototipe')

async function ada(p) {
  try {
    await access(p)
    return true
  } catch {
    return false
  }
}

async function main() {
  if (!(await ada(SUMBER))) {
    console.warn(`[prototipe] sumber tidak ada: ${SUMBER} — dilewati`)
    return
  }

  // bersihkan lalu salin ulang, supaya file yang dihapus tidak tertinggal
  await rm(TUJUAN, { recursive: true, force: true })
  await mkdir(dirname(TUJUAN), { recursive: true })
  await cp(SUMBER, TUJUAN, { recursive: true })

  // arahkan tombol "Coba Demo" ke root situs (tempat aplikasi berada)
  const idx = join(TUJUAN, 'index.html')
  const semula = await readFile(idx, 'utf8')
  const sesudah = semula.replaceAll('../../app/dist/index.html', '/')
  if (sesudah !== semula) {
    await writeFile(idx, sesudah, 'utf8')
    console.log('[prototipe] tautan "Coba Demo" diarahkan ke /')
  }

  console.log(`[prototipe] disalin ke public/prototipe -> akan tersedia di /prototipe/`)
}

main().catch((e) => {
  console.error('[prototipe] gagal menyalin:', e)
  process.exit(1)
})
