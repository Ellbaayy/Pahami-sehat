#!/usr/bin/env node
/**
 * Bebaskan port sebelum server dijalankan.
 *
 * ============================================================================
 * KENAPA ADA
 * ============================================================================
 * Selama pengembangan, server sering tertinggal hidup di latar belakang:
 * terminal ditutup, tab ditutup, atau proses lama tidak sempat dimatikan.
 * Akibatnya `npm run server` berikutnya GAGAL — dan sebelum ada penjagaan ini,
 * kegagalannya bahkan tidak terlihat sama sekali (Express tetap memanggil
 * callback `listen` walaupun bind-nya gagal), sehingga tampak "server siap"
 * padahal yang menjawab di port itu adalah proses lama.
 *
 * Skrip ini berjalan otomatis lewat `preserver` di package.json, jadi
 * `npm run server` selalu berhasil.
 *
 * ============================================================================
 * BATAS YANG DISENGAJA — hanya menghentikan server PROYEK INI
 * ============================================================================
 * Proses lain yang kebetulan memakai port yang sama TIDAK dibunuh. Membunuh
 * proses orang lain secara otomatis jauh lebih berbahaya daripada pesan galat
 * yang jelas. Kalau yang menahan port bukan server proyek ini, skrip berhenti
 * dan menyebutkan PID-nya supaya diputuskan sendiri.
 */

import { execFileSync } from 'node:child_process'
import { existsSync, readFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const AKAR = resolve(dirname(fileURLToPath(import.meta.url)), '..')

/** PORT dari `.env` (kalau ada) atau dari lingkungan; bawaan 8787. */
function portDiminta() {
  if (process.env.PORT) return Number(process.env.PORT)
  const env = join(AKAR, '.env')
  if (existsSync(env)) {
    try {
      const baris = readFileSync(env, 'utf8')
        .split('\n')
        .map((b) => b.trim())
        .find((b) => b.startsWith('PORT='))
      if (baris) {
        const nilai = Number(baris.slice(5).replace(/["']/g, '').trim())
        if (Number.isFinite(nilai) && nilai > 0) return nilai
      }
    } catch {
      // .env tidak terbaca bukan alasan menggagalkan start.
    }
  }
  return 8787
}

/** PID yang mendengarkan port, atau null. Memakai `ss`, lalu `lsof`. */
function pidPemegangPort(port) {
  try {
    const keluaran = execFileSync('ss', ['-ltnpH', `sport = :${port}`], {
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'ignore'],
    })
    const cocok = keluaran.match(/pid=(\d+)/)
    if (cocok) return Number(cocok[1])
    // Ada yang mendengarkan tetapi PID tidak terbaca (milik pengguna lain).
    return keluaran.trim() ? -1 : null
  } catch {
    try {
      const keluaran = execFileSync('lsof', ['-ti', `tcp:${port}`, '-sTCP:LISTEN'], {
        encoding: 'utf8',
        stdio: ['ignore', 'pipe', 'ignore'],
      })
      const pid = Number(keluaran.trim().split('\n')[0])
      return Number.isFinite(pid) && pid > 0 ? pid : null
    } catch {
      return null
    }
  }
}

/** Apakah PID ini server Pahami Sehat dari folder ini? */
function serverProyekIni(pid) {
  if (!pid || pid < 0) return false
  try {
    const cwd = execFileSync('readlink', ['-f', `/proc/${pid}/cwd`], {
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'ignore'],
    }).trim()
    const cmd = readFileSync(`/proc/${pid}/cmdline`, 'utf8').split('\0').join(' ')
    const menyebutServer = cmd.includes('server/index.js')
    const akarSama = cwd === AKAR || cwd === join(AKAR, 'server')
    return menyebutServer && akarSama
  } catch {
    return false
  }
}

function tungguBebas(port, batasMs = 6000) {
  const mulai = Date.now()
  while (Date.now() - mulai < batasMs) {
    if (pidPemegangPort(port) === null) return true
    try {
      execFileSync('sleep', ['0.2'])
    } catch {
      // kalau `sleep` tidak ada, tetap lanjut memeriksa
    }
  }
  return pidPemegangPort(port) === null
}

const port = portDiminta()
const pid = pidPemegangPort(port)

if (pid === null) {
  // Port bebas — tidak ada yang perlu dilakukan.
  process.exit(0)
}

if (serverProyekIni(pid)) {
  console.log(`  [port] ${port} masih dipegang server lama proyek ini (PID ${pid}).`)
  console.log('  [port] Menghentikan server lama…')
  try {
    process.kill(pid, 'SIGTERM')
  } catch {
    // sudah mati di antara pemeriksaan dan kill
  }
  if (tungguBebas(port)) {
    console.log(`  [port] ${port} bebas.`)
    process.exit(0)
  }
  try {
    process.kill(pid, 'SIGKILL')
  } catch {
    // sudah mati
  }
  if (tungguBebas(port)) {
    console.log(`  [port] ${port} bebas (server lama dihentikan paksa).`)
    process.exit(0)
  }
  console.error(`\n  GAGAL: ${port} masih dipakai setelah server lama dihentikan.\n`)
  process.exit(1)
}

console.error(
  `\n  GAGAL: port ${port} dipakai proses LAIN (PID ${pid || 'tidak terbaca'}), bukan server proyek ini.` +
    `\n  Port ini sengaja TIDAK dibebaskan otomatis supaya proses orang lain tidak ikut terbunuh.` +
    `\n` +
    `\n  Pilihan:` +
    `\n    1) Periksa dulu:  ss -ltnp | grep ${port}` +
    `\n    2) Pakai port lain:  PORT=${port + 1} npm run server` +
    `\n`,
)
process.exit(1)
