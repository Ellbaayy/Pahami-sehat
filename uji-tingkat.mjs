#!/usr/bin/env node
/**
 * Uji tingkat baca — memaksa SERVER dan ANTARMUKA sepakat.
 * Dijalankan: node uji-tingkat.mjs   (tanpa jaringan, tanpa DB, tanpa kunci)
 *
 * KENAPA ADA (5 Nov 2026)
 * Bawaan tingkat baca dulu 'anak' di DUA tempat:
 *   - app/server/prompts.js   (dipakai saat permintaan tidak menyebut tingkat)
 *   - app/src/data/tingkat.js (setelan awal antarmuka)
 *
 * Akibatnya terukur pada permintaan tanpa field `tingkat`:
 *
 *   POST /api/tanya {"pertanyaan":"apa saja gejala stroke?"}
 *   -> tingkat {kunci:"anak"}, 578 karakter, gaya pembaca 9–11 tahun
 *
 * Pengguna yang tidak menyebut tingkat sedang TIDAK meminta versi anak-anak.
 * Aplikasi ini disusun untuk orang dewasa yang sulit memahami istilah medis,
 * jadi menjawab mereka dengan kalimat 8 kata membuat pertanyaan pertama
 * terasa diremehkan.
 *
 * Uji ini menjaga TIGA hal yang tidak terlihat dari build hijau:
 *   1. `TINGKAT_DEFAULT` server dan klien sama persis.
 *   2. Nilai itu memang salah satu tingkat yang sah di kedua daftar —
 *      kalau tidak, `rapikanTingkat()` diam-diam mengembalikan kunci yang
 *      tidak ada di TINGKAT, dan seluruh prompt jatuh ke `?? deanak` di
 *      `promptTanya()` tanpa galat apa pun.
 *   3. Tingkat yang DIKIRIM tetap dihormati apa adanya (tidak dipaksa sama).
 */

import { TINGKAT, TINGKAT_DEFAULT as DEFAULT_SERVER } from './app/server/prompts.js'
import {
  TINGKAT as DAFTAR_KLIEN,
  TINGKAT_DEFAULT as DEFAULT_KLIEN,
  labelTingkat,
  usiaTingkat,
} from './app/src/data/tingkat.js'

let gagal = 0
function cek(nama, dapat, harus) {
  const ok = JSON.stringify(dapat) === JSON.stringify(harus)
  if (!ok) gagal++
  console.log(`${ok ? '  ok   ' : '  GAGAL'} ${nama}`)
  if (!ok) console.log(`        dapat: ${JSON.stringify(dapat)}\n        harus: ${JSON.stringify(harus)}`)
}

console.log('== bawaan tingkat baca ==')
cek('server dan klien memilih tingkat bawaan yang SAMA', DEFAULT_SERVER, DEFAULT_KLIEN)
cek('bawaan bukan versi anak-anak', DEFAULT_SERVER !== 'anak', true)
cek('bawaan ada di daftar server', Boolean(TINGKAT[DEFAULT_SERVER]), true)
cek('bawaan ada di daftar klien', DAFTAR_KLIEN.some((t) => t.kunci === DEFAULT_KLIEN), true)

console.log('\n== daftar tingkat server dan klien sepadan ==')
const kunciServer = Object.keys(TINGKAT).sort()
const kunciKlien = DAFTAR_KLIEN.map((t) => t.kunci).sort()
cek('kunci tingkat identik', kunciKlien, kunciServer)
// Dibandingkan PER KUNCI, bukan menurut urutan array: urutan di antarmuka
// (anak, remaja, dewasa, lansia) dan urutan kunci objek di server boleh
// berbeda; yang tidak boleh berbeda adalah isi tiap tingkat.
const petaKlien = Object.fromEntries(DAFTAR_KLIEN.map((t) => [t.kunci, t]))
cek(
  'label per tingkat identik',
  Object.fromEntries(kunciServer.map((k) => [k, petaKlien[k]?.label])),
  Object.fromEntries(kunciServer.map((k) => [k, TINGKAT[k]?.label])),
)
cek(
  'rentang usia per tingkat identik',
  Object.fromEntries(kunciServer.map((k) => [k, petaKlien[k]?.usia])),
  Object.fromEntries(kunciServer.map((k) => [k, TINGKAT[k]?.usia])),
)

console.log('\n== setiap tingkat tetap bisa dipilih sendiri ==')
for (const t of DAFTAR_KLIEN) {
  cek(`labelTingkat(${t.kunci})`, labelTingkat(t.kunci), t.label)
  cek(`usiaTingkat(${t.kunci})`, usiaTingkat(t.kunci), t.usia)
  cek(`${t.kunci} punya aturan kalimat di prompt`, Boolean(TINGKAT[t.kunci]?.kalimat), true)
}

console.log('\n== tingkat yang dikirim tidak dipaksa menjadi bawaan ==')
// rapikanTingkat tidak diekspor; perilakunya diuji lewat aturan yang sama:
// hanya kunci yang ada di TINGKAT yang diterima, sisanya jatuh ke bawaan.
const rapikan = (v) => {
  const k = String(v ?? '').trim().toLowerCase()
  return TINGKAT[k] ? k : DEFAULT_SERVER
}
for (const t of DAFTAR_KLIEN) cek(`rapikan(${t.kunci}) dipertahankan`, rapikan(t.kunci), t.kunci)
cek('rapikan("") -> bawaan', rapikan(''), DEFAULT_SERVER)
cek('rapikan("ngawur") -> bawaan', rapikan('ngawur'), DEFAULT_SERVER)

console.log(gagal ? `\nGAGAL — ${gagal} pemeriksaan` : '\nSEMUA LULUS')
process.exit(gagal ? 1 : 0)
