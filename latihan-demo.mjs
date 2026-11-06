#!/usr/bin/env node
/**
 * Pengukur latihan live demo Pahami Sehat.
 *
 * KENAPA ADA: panduan latihan di `docs/latihan-live-demo.md` sudah lengkap,
 * tetapi belum pernah dijalankan. Tanpa pengukur, "sudah 7 menit?" hanya
 * perkiraan — dan di Grand Final waktu per tim adalah 7 menit presentasi +
 * demo, dihitung oleh panitia.
 *
 * CARA PAKAI (dua terminal):
 *   Terminal 1:  node latihan-demo.mjs
 *   Terminal 2 (saat mulai bicara):  kirim Enter ke terminal 1 setiap selesai
 *                satu segmen.
 *
 * Atau mode otomatis:  node latihan-demo.mjs --otomatis
 *   Setiap segmen diberi waktu target dari panduan; skrip akan memberi tahu
 *   kapan harus pindah. Kamu tinggal mengikuti.
 *
 * Segmen dan target diambil dari `docs/latihan-live-demo.md` (naskah 7 menit),
 * BUKAN dikarang di sini — supaya kalau panduannya berubah, skrip ini ikut
 * diubah dan keduanya tidak bisa menyimpang diam-diam.
 */

import { createInterface } from 'node:readline'

/*
 * Segmen 7 menit dari docs/latihan-live-demo.md.
 * "kunci" = penanda yang harus benar-benar dikerjakan, bukan sekadar dibaca.
 */
const SEGMEN = [
  { nama: 'Masalah — satu kalimat', target: 50, kunci: '27,8% tanpa jaminan KESEHATAN, bukan angka lain' },
  { nama: 'Halaman penjelasan', target: 50, kunci: 'tunjuk 3 hal: kartu, etika, sumber data' },
  { nama: 'Tanya AI + ganti tingkat baca', target: 115, kunci: 'jawaban nyata + buka 1 sumber + ganti ke Anak-anak' },
  { nama: 'Cek Klaim', target: 55, kunci: 'sebut salah satu dari 3 putusan' },
  { nama: 'Fasilitas Kesehatan + rute', target: 80, kunci: 'SEBUT 40-50 detik lebih dulu, lalu tunjuk 10 kategori' },
  { nama: 'Rumah Sakit Nasional', target: 25, kunci: '3.325 RS dari DB, bukan peta' },
  { nama: 'Kuesioner + penutup', target: 25, kunci: 'HLS-SF12 tervalidasi, skor 0-50' },
]

const TOTAL_TARGET = SEGMEN.reduce((s, x) => s + x.target, 0)
const AMAN = 420   // 7 menit = 420 detik

const warna = {
  merah: (t) => `\x1b[31m${t}\x1b[0m`,
  hijau: (t) => `\x1b[32m${t}\x1b[0m`,
  kuning: (t) => `\x1b[33m${t}\x1b[0m`,
  tebal: (t) => `\x1b[1m${t}\x1b[0m`,
  redup: (t) => `\x1b[2m${t}\x1b[0m`,
}

const mmss = (d) => {
  const m = Math.floor(Math.abs(d) / 60)
  const s = Math.round(Math.abs(d) % 60)
  return `${d < 0 ? '-' : ''}${m}:${String(s).padStart(2, '0')}`
}

function tampilkanTarget() {
  console.log(warna.tebal('\n=== TARGET SEGMEN (dari docs/latihan-live-demo.md) ===\n'))
  SEGMEN.forEach((s, i) => {
    console.log(`  ${String(i + 1).padStart(2)}. ${s.nama.padEnd(34)} ${mmss(s.target).padStart(5)}`)
    console.log(warna.redup(`      kunci: ${s.kunci}`))
  })
  console.log(`\n  ${warna.tebal('TOTAL')} ${mmss(TOTAL_TARGET)} — batas 7:00, sisa ${mmss(AMAN - TOTAL_TARGET)}`)
  console.log(warna.redup('  Angka ini TARGET, bukan durasi sebenarnya. Yang diukur: waktu tiap segmen.'))
}

async function main() {
  const otomatis = process.argv.includes('--otomatis')
  tampilkanTarget()

  if (!otomatis) {
    console.log(warna.tebal('\n=== MODE MANUAL ==='))
    console.log('Tekan Enter setiap SELESAI satu segmen. Ctrl+C untuk berhenti.\n')
  } else {
    console.log(warna.tebal('\n=== MODE OTOMATIS ==='))
    console.log('Skrip akan memberi tahu kapan harus pindah segmen.')
    console.log('Kamu tidak perlu menekan apa pun — ikuti saja panduannya.\n')
  }

  const rl = createInterface({ input: process.stdin, output: process.stdout })
  const tanya = (q) => new Promise((r) => rl.question(q, r))
  const jeda = (ms) => new Promise((r) => setTimeout(r, ms))

  const hasil = []
  const mulaiTotal = Date.now()
  let keluar = false
  process.on('SIGINT', () => { keluar = true; rl.close() })

  for (const [i, seg] of SEGMEN.entries()) {
    if (keluar) break
    const t0 = Date.now()
    const lewat = (t0 - mulaiTotal) / 1000

    console.log(warna.tebal(`\n[${i + 1}/${SEGMEN.length}] ${seg.nama}`))
    console.log(`  target ${mmss(seg.target)} · total berjalan ${mmss(lewat)} / 7:00`)
    console.log(warna.kuning(`  kunci: ${seg.kunci}`))

    if (otomatis) {
      // hitung mundur per detik supaya terlihat, berhenti tepat di target
      for (let sisa = seg.target; sisa > 0; sisa--) {
        if (keluar) break
        process.stdout.write(`\r  sisa ${mmss(sisa)}   `)
        await jeda(1000)
      }
      process.stdout.write('\r              \r')
    } else {
      await tanya(warna.redup('  [Enter] kalau segmen ini selesai… '))
    }

    const durasi = (Date.now() - t0) / 1000
    const selisih = durasi - seg.target
    hasil.push({ ...seg, durasi, selisih })
    const tanda = selisih > 5 ? warna.merah('LEBIH') : selisih < -10 ? warna.hijau('cepat') : warna.hijau('pas')
    console.log(`  → ${mmss(durasi)} (${selisih >= 0 ? '+' : ''}${mmss(selisih)} dari target) ${tanda}`)
  }

  rl.close()

  // ------------------------------------------------------------- ringkasan ---
  const total = hasil.reduce((s, x) => s + x.durasi, 0)
  const lebih = hasil.filter((x) => x.selisih > 5)

  console.log(warna.tebal('\n=== RINGKASAN ===\n'))
  console.log(`  ${'Segmen'.padEnd(34)} ${'target'.padStart(7)} ${'nyata'.padStart(7)} ${'selisih'.padStart(8)}`)
  console.log(`  ${'-'.repeat(34)} ${'-'.repeat(7)} ${'-'.repeat(7)} ${'-'.repeat(8)}`)
  for (const h of hasil) {
    const t = h.selisih > 5 ? warna.merah : h.selisih < -10 ? warna.hijau : warna.hijau
    console.log(`  ${h.nama.padEnd(34)} ${mmss(h.target).padStart(7)} ${mmss(h.durasi).padStart(7)} ${t((h.selisih >= 0 ? '+' : '') + mmss(h.selisih)).padStart(8)}`)
  }
  console.log(`  ${'-'.repeat(34)} ${'-'.repeat(7)} ${'-'.repeat(7)} ${'-'.repeat(8)}`)
  const tTot = total > AMAN ? warna.merah : warna.hijau
  console.log(`  ${'TOTAL'.padEnd(34)} ${mmss(TOTAL_TARGET).padStart(7)} ${tTot(mmss(total).padStart(7))} ${tTot(((total - TOTAL_TARGET >= 0 ? '+' : '') + mmss(total - TOTAL_TARGET)).padStart(8))}`)

  console.log()
  if (total <= AMAN) {
    console.log(warna.hijau(`  ✓ ${mmss(total)} — MASUK batas 7:00 (sisa ${mmss(AMAN - total)})`))
  } else {
    console.log(warna.merah(`  ✗ ${mmss(total)} — MELEWATI batas 7:00 sebanyak ${mmss(total - AMAN)}`))
  }

  if (lebih.length) {
    console.log(warna.tebal('\n  Segmen yang perlu dipotong:'))
    for (const h of lebih.sort((a, b) => b.selisih - a.selisih)) {
      console.log(warna.merah(`    ${h.nama}  +${mmss(h.selisih)}`))
    }
  } else {
    console.log(warna.hijau('\n  Tidak ada segmen yang melewati target lebih dari 5 detik.'))
  }

  console.log(warna.redup('\n  Catatan: angka ini mengukur WAKTU, bukan mutu. Satu segmen yang'))
  console.log(warna.redup('  lebih cepat belum tentu lebih baik — bisa berarti ada yang terlewat.'))
}

main().catch((e) => {
  console.error('GAGAL:', e.message)
  process.exit(1)
})
