/**
 * Siapkan halaman penjelasan sebagai HALAMAN DEPAN situs.
 *
 * Struktur akhir di dist/:
 *   dist/index.html        <- halaman penjelasan (yang muncul pertama kali)
 *   dist/prototipe/        <- salinan yang sama, supaya /prototipe/ tetap hidup
 *   dist/app/              <- aplikasi React hasil `vite build`
 *
 * Dijalankan otomatis sebelum `vite build` (scripts.prebuild).
 *
 * Kenapa sumbernya disalin, bukan disimpan di app/public/:
 *   - Sumber tetap satu tempat di git (docs/prototipe), tidak ada dua salinan.
 *   - Hasil salinan masuk .gitignore.
 *   - Kalau ditaruh di app/public/, Vite akan menyalinnya ke dist/app/prototipe/
 *     (karena public/ selalu disalin ke akar outDir) — jadi isinya nyasar.
 *
 * Penyesuaian tautan: di root, tautan halaman penjelasan ke dirinya sendiri
 * (./prototipe/) diubah jadi ./ supaya tidak menunjuk ke salinannya.
 */

import { cp, rm, mkdir, readFile, writeFile, access } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

const __dirname = dirname(fileURLToPath(import.meta.url))
const APP = join(__dirname, '..')
const SUMBER = join(APP, '..', 'docs', 'prototipe')
const DIST = join(APP, 'dist')
const PUBLIK_LAMA = join(APP, 'public', 'prototipe')

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

  // bersihkan sisa cara lama (dulu disalin ke public/prototipe/)
  await rm(PUBLIK_LAMA, { recursive: true, force: true })

  // Dua salinan diperlukan karena keduanya memakai tautan relatif (css/, js/,
  // assets/) — jadi asetnya harus ada di kedua tempat.
  await mkdir(DIST, { recursive: true })
  // 1) isinya ke dist/ supaya jadi halaman depan (dist/index.html)
  await cp(SUMBER, DIST, { recursive: true })
  // 2) salinan utuh di dist/prototipe/ supaya /prototipe/ tetap hidup
  await cp(SUMBER, join(DIST, 'prototipe'), { recursive: true })

  // Halaman depan (dist/index.html): tautan ke aplikasi tetap "./app/".
  // Salinan (dist/prototipe/index.html): harus naik satu tingkat dulu, jadi
  // "./app/" diubah menjadi "../app/" — kalau tidak, tautannya menunjuk ke
  // /prototipe/app/ yang tidak ada.
  const idxDepan = join(DIST, 'index.html')
  const asliDepan = await readFile(idxDepan, 'utf8')
  const depan = asliDepan.replaceAll('href="./prototipe/"', 'href="./"')
  if (depan !== asliDepan) await writeFile(idxDepan, depan, 'utf8')

  const idxSalinan = join(DIST, 'prototipe', 'index.html')
  const asliSalinan = await readFile(idxSalinan, 'utf8')
  const salinan = asliSalinan.replaceAll('href="./app/"', 'href="../app/"')
  if (salinan !== asliSalinan) {
    await writeFile(idxSalinan, salinan, 'utf8')
    console.log('[prototipe] salinan: tautan aplikasi -> ../app/')
  }

  console.log('[prototipe] halaman penjelasan -> dist/index.html (halaman depan)')
  console.log('[prototipe] salinan -> dist/prototipe/ (agar /prototipe/ tetap hidup)')
}

main().catch((e) => {
  console.error('[prototipe] gagal menyiapkan:', e)
  process.exit(1)
})
