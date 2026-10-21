/**
 * Jalankan SELURUH uji tanpa jaringan dalam satu perintah.
 *
 * ============================================================================
 * KENAPA SKRIP INI ADA
 * ============================================================================
 *
 * Sebelumnya ada 17 berkas `uji-*.mjs` di akar repo dan TIDAK ADA satu pun
 * perintah untuk menjalankannya semua. Artinya: untuk tahu apakah seluruh uji
 * masih lulus, orang harus menyalin daftar nama dari README — dan daftar itu
 * sudah pernah ketinggalan (uji-bahasa, uji-suara, uji-sitasi tidak tercantum
 * di bagian "Uji" README saat ditambahkan). Uji yang tidak pernah dijalankan
 * sama saja dengan tidak ada, dan itu bagian dari indikator Software
 * Engineering yang dinilai lomba.
 *
 * Daftarnya diambil dari ISI FOLDER, bukan ditulis tangan — jadi uji baru
 * otomatis ikut tanpa perlu ada yang mengingat memperbarui daftar.
 *
 * URUTAN PENTING: `uji-statis.mjs` memeriksa `dist/` yang sungguhan, jadi ia
 * dijalankan PALING AKHIR dan hanya kalau `dist/` ada. Kalau belum dibuild, ia
 * dilewati dengan keterangan — bukan digagalkan, karena isi kode bisa saja
 * benar sementara build-nya belum dijalankan.
 *
 * Yang TIDAK dijalankan di sini, dan alasannya:
 *   - uji-jawaban.mjs           -> butuh server + KENARI_API_KEY (berbayar)
 *   - uji-sumber.mjs --jaringan -> butuh Wikipedia/MedlinePlus
 *   - ukur-*.mjs, verifikasi-judul.mjs, periksa-istilah.mjs, panen-*.mjs
 *     -> alat ukur, bukan uji; butuh jaringan dan sebagian butuh kuota model
 *
 * Pemakaian:  node uji-semua.mjs
 *             node uji-semua.mjs --dengan-jaringan   (tambah uji sumber)
 */

import { readdirSync, existsSync } from 'node:fs'
import { spawnSync } from 'node:child_process'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const AKAR = dirname(fileURLToPath(import.meta.url))
const denganJaringan = process.argv.includes('--dengan-jaringan')

/** Uji yang butuh jaringan atau rahasia — tidak ikut secara bawaan. */
const BUTUH_LUAR = new Set(['uji-jawaban.mjs'])

/** Uji yang memeriksa hasil build; hanya jalan kalau `dist/` ada. */
const BUTUH_BUILD = new Set(['uji-statis.mjs'])

const adaDist = existsSync(join(AKAR, 'app', 'dist', 'index.html'))

const berkas = readdirSync(AKAR)
  .filter((f) => /^uji-.*\.mjs$/.test(f))
  // jangan menjalankan skrip ini sendiri
  .filter((f) => f !== 'uji-semua.mjs')
  .filter((f) => !BUTUH_LUAR.has(f))
  .sort()

if (!berkas.length) {
  console.error('Tidak ada berkas uji-*.mjs ditemukan.')
  process.exit(1)
}

const hasil = []
const mulaiSemua = Date.now()

for (const f of berkas) {
  if (BUTUH_BUILD.has(f) && !adaDist) {
    console.log(`\n\ud83d\udc64 ${f} — DILEWATI (dist/ belum ada, jalankan: cd app && npm run build)`)
    hasil.push({ f, status: 'dilewati' })
    continue
  }

  const argumen = []
  if (f === 'uji-sumber.mjs' && denganJaringan) argumen.push('--jaringan')

  console.log(`\n${'='.repeat(64)}\n${f}${argumen.length ? ` ${argumen.join(' ')}` : ''}\n${'='.repeat(64)}`)

  const mulai = Date.now()
  const r = spawnSync(process.execPath, [join(AKAR, f), ...argumen], {
    cwd: AKAR,
    stdio: 'inherit',
  })
  const ms = Date.now() - mulai

  hasil.push({ f, status: r.status === 0 ? 'lulus' : 'GAGAL', ms })
}

/* ------------------------------------------------------------ ringkasan --- */

const lulus = hasil.filter((h) => h.status === 'lulus')
const gagal = hasil.filter((h) => h.status === 'GAGAL')
const dilewati = hasil.filter((h) => h.status === 'dilewati')

console.log(`\n${'='.repeat(64)}\nRINGKASAN\n${'='.repeat(64)}`)
for (const h of hasil) {
  const tanda = h.status === 'lulus' ? 'ok   ' : h.status === 'GAGAL' ? 'GAGAL' : 'lewati'
  const waktu = h.ms !== undefined ? `  ${(h.ms / 1000).toFixed(1)}s` : ''
  console.log(`  ${tanda}  ${h.f}${waktu}`)
}
console.log(
  `\n  ${lulus.length} lulus, ${gagal.length} gagal, ${dilewati.length} dilewati` +
    `  (${((Date.now() - mulaiSemua) / 1000).toFixed(1)} detik)`,
)

if (gagal.length) {
  console.log(`\n  Yang gagal: ${gagal.map((h) => h.f).join(', ')}`)
  process.exit(1)
}
