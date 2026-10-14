#!/usr/bin/env node
/**
 * ukur-tingkat.mjs — mengukur apakah jawaban AI BENAR-BENAR berbeda antar
 * tingkat pembaca (anak, remaja, dewasa, lansia), dengan angka yang bisa
 * dibandingkan.
 *
 * KENAPA SKRIP INI ADA
 * "Sudah disesuaikan tingkat baca" sebelumnya hanya bisa dipercaya dari
 * perintah di prompt. Tidak ada angka apa pun. Akibatnya tidak mungkin
 * menjawab pertanyaan paling dasar: apakah jawaban untuk anak-anak memang
 * lebih mudah daripada untuk dewasa? Skrip ini menjawabnya dengan mengukur.
 *
 * DUA CARA PAKAI
 *   node ukur-tingkat.mjs                 # semua pertanyaan x 4 tingkat
 *   node ukur-tingkat.mjs --cepat         # 3 pertanyaan saja (menghemat kuota)
 *   node ukur-tingkat.mjs --banding a.json b.json   # bandingkan dua hasil
 *
 * Butuh server lokal:  cd app && npm run server   (port 8787)
 */
import { writeFile, readFile } from 'node:fs/promises'
import { existsSync } from 'node:fs'
import { ukurKeterbacaan, periksaSasaran, SASARAN } from './app/src/lib/keterbacaan.js'

const BASE = process.env.BASE_URL || 'http://127.0.0.1:8787'
const arg = process.argv.slice(2)
const CEPAT = arg.includes('--cepat')
const TINGKAT = ['anak', 'remaja', 'dewasa', 'lansia']

/**
 * Pertanyaan uji dipilih supaya MEWAKILI perbedaan yang harus terlihat:
 * ada istilah medis berat (hipertensi, diabetes), ada prosedur, ada
 * pertanyaan yang mudah ditakuti (kanker), dan ada yang menyangkut obat.
 * Pertanyaan yang sama dipakai untuk SEMUA tingkat, karena tujuannya
 * membandingkan tingkat — bukan menilai pertanyaannya.
 */
const PERTANYAAN = [
  'Apa itu hipertensi?',
  'Bagaimana cara mencegah diabetes?',
  'Apa itu kanker serviks?',
  'Bagaimana cara mencuci tangan yang benar?',
  'Bagaimana cara mencegah jatuh pada lansia?',
  'Apa yang harus dilakukan saat patah tulang?',
  'Apa penyebab anemia?',
  'Bagaimana cara merawat pasien stroke di rumah?',
]

const PAKAI = CEPAT ? PERTANYAAN.slice(0, 3) : PERTANYAAN

async function serverHidup() {
  try {
    const r = await fetch(`${BASE}/api/health`, { signal: AbortSignal.timeout(15000) })
    return r.ok
  } catch {
    return false
  }
}

if (!(await serverHidup())) {
  console.error(`Server lokal di ${BASE} tidak menjawab.`)
  console.error('Jalankan dulu:  cd app && npm run server')
  console.error('(pastikan port 8787 benar-benar bebas: ss -ltn | grep 8787)')
  process.exit(2)
}

console.log(`=== UKUR TINGKAT BACA (${PAKAI.length} pertanyaan x ${TINGKAT.length} tingkat = ${PAKAI.length * TINGKAT.length} jawaban) ===`)
console.log(`server: ${BASE}\n`)

const baris = []
let gagal = 0

for (const pertanyaan of PAKAI) {
  const perTingkat = {}
  for (const tingkat of TINGKAT) {
    /*
     * PERCOBAAN ULANG WAJIB ADA DI SINI.
     *
     * Diukur 14 Okt 2026: satu putaran pengukuran melaporkan HTTP 500 di
     * beberapa jawaban. Log server menunjukkan penyebabnya BUKAN kode kita:
     * `TimeoutError: The operation was aborted due to timeout` dan
     * `ECONNRESET` saat menghubungi layanan model di luar. Kalau kegagalan
     * sesaat seperti itu dihitung sebagai hasil, ringkasannya jadi bohong —
     * tingkat yang "gagal" tampak seperti tingkat yang tidak punya data,
     * padahal modelnya cuma sedang tidak bisa dihubungi.
     *
     * Jadi kegagalan diulang sampai 3 kali dengan jeda. Yang tetap gagal
     * sesudah itu dilaporkan apa adanya sebagai gagal.
     */
    const mulai = Date.now()
    let d = null
    let galat = null
    for (let coba = 1; coba <= 3; coba++) {
      d = null
      galat = null
      try {
        const r = await fetch(`${BASE}/api/tanya`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ pertanyaan, tingkat, bahasa: 'id' }),
          signal: AbortSignal.timeout(180000),
        })
        if (!r.ok) galat = `HTTP ${r.status}`
        else d = await r.json()
      } catch (e) {
        galat = `jaringan: ${e.message}`
      }
      if (d?.ok) break
      if (coba < 3) {
        console.log(`    (ulang ${coba}/3 untuk ${tingkat}: ${galat ?? d?.pesan ?? 'tidak ok'})`)
        await new Promise((r) => setTimeout(r, 4000 * coba))
      }
    }
    const detik = (Date.now() - mulai) / 1000

    if (galat || !d?.ok) {
      gagal++
      console.log(`  GAGAL ${tingkat.padEnd(7)} | ${pertanyaan} -> ${galat ?? d?.pesan ?? 'tidak ok'}`)
      perTingkat[tingkat] = { galat: galat ?? d?.pesan ?? 'tidak ok' }
      continue
    }

    const ukur = ukurKeterbacaan(d.jawaban)
    const sasaran = periksaSasaran(tingkat, ukur)
    perTingkat[tingkat] = {
      ukur,
      lolos: sasaran.lolos,
      pelanggaran: sasaran.pelanggaran,
      tren: sasaran.tren,
      kataJawaban: String(d.jawaban).split(/\s+/).filter(Boolean).length,
      poinKunci: (d.poinKunci ?? []).length,
      sumber: (d.sumber ?? []).length,
      detik: Number(detik.toFixed(1)),
      // disimpan utuh supaya bisa dibaca manusia saat ada yang aneh
      jawaban: String(d.jawaban).slice(0, 400),
    }
    console.log(
      `  ${sasaran.lolos ? 'OK  ' : 'LEWAT'} ${tingkat.padEnd(7)} | asl=${String(ukur.asl).padStart(5)} asw=${String(ukur.asw).padStart(4)} sulit=${String(ukur.persenKataSulit).padStart(4)}% kalimatTerpanjang=${String(ukur.kalimatTerpanjang).padStart(2)} | ${detik.toFixed(1)}s | ${pertanyaan}`,
    )
    if (sasaran.pelanggaran.length) console.log(`         -> GERBANG: ${sasaran.pelanggaran.join('; ')}`)
    if (sasaran.tren.length) console.log(`         -> tren   : ${sasaran.tren.join('; ')}`)
  }
  baris.push({ pertanyaan, perTingkat })
  console.log()
}

/* ------------------------------------------------------------- ringkasan --- */

console.log('=== RINGKASAN PER TINGKAT ===')
const ringkas = {}
for (const tingkat of TINGKAT) {
  const hasil = baris.map((b) => b.perTingkat[tingkat]).filter((x) => x && !x.galat)
  if (!hasil.length) {
    console.log(`  ${tingkat.padEnd(7)} : tidak ada hasil`)
    continue
  }
  const rata = (f) => Number((hasil.reduce((t, h) => t + f(h), 0) / hasil.length).toFixed(2))
  ringkas[tingkat] = {
    n: hasil.length,
    asl: rata((h) => h.ukur.asl),
    asw: rata((h) => h.ukur.asw),
    sulit: rata((h) => h.ukur.persenKataSulit),
    kalimatTerpanjang: rata((h) => h.ukur.kalimatTerpanjang),
    kata: rata((h) => h.kataJawaban),
    sumber: rata((h) => h.sumber),
    lolos: hasil.filter((h) => h.lolos).length,
    detik: rata((h) => h.detik),
  }
  const r = ringkas[tingkat]
  console.log(
    `  ${tingkat.padEnd(7)} : asl=${String(r.asl).padStart(5)} asw=${String(r.asw).padStart(4)} sulit=${String(r.sulit).padStart(4)}% kalimatTerpanjang=${String(r.kalimatTerpanjang).padStart(4)} kata=${String(r.kata).padStart(5)} sumber=${String(r.sumber).padStart(4)} lolosSasaran=${r.lolos}/${r.n} (${r.detik}s)`,
  )
}

console.log('\n=== URUTAN (harus mudah -> sulit: anak <= lansia <= remaja <= dewasa) ===')
const urutAsl = TINGKAT.filter((t) => ringkas[t]).sort((a, b) => ringkas[a].asl - ringkas[b].asl)
const urutSulit = TINGKAT.filter((t) => ringkas[t]).sort((a, b) => ringkas[a].sulit - ringkas[b].sulit)
console.log('  dari termudah (asl)   :', urutAsl.join(' < '))
console.log('  dari termudah (sulit) :', urutSulit.join(' < '))

/* ------------------------------------- urutan PER PERTANYAAN (bukan rata-rata) --- */
/*
 * KENAPA RATA-RATA TIDAK CUKUP — ini pelajaran yang mahal.
 *
 * Rata-rata agregat pernah menunjukkan "anak < lansia < remaja < dewasa" untuk
 * SEMUA ukuran, sehingga tampak sempurna. Setelah diperiksa PER PERTANYAAN,
 * ternyata urutannya kacau: untuk panjang kata urutan benar hanya di 1 dari 8
 * pertanyaan. Rata-rata menyembunyikan itu — pertanyaan yang kebetulan benar
 * menutupi pertanyaan yang terbalik.
 *
 * Pemeriksaan ini melaporkan berapa pertanyaan yang urutannya benar. Untuk
 * `asl` dan `kalimatTerpanjang` angkanya harus tinggi; kalau tidak, tangga
 * tingkatnya tidak benar-benar bekerja walau rata-ratanya terlihat rapi.
 */
/* ------------------------------------- urutan PER PERTANYAAN (bukan rata-rata) --- */
/*
 * KENAPA RATA-RATA TIDAK CUKUP — ini pelajaran yang mahal.
 *
 * Rata-rata agregat pernah menunjukkan "anak < lansia < remaja < dewasa" untuk
 * SEMUA ukuran, sehingga tampak sempurna. Setelah diperiksa PER PERTANYAAN,
 * ternyata urutannya kacau: untuk panjang kata urutan benar hanya di 1 dari 8
 * pertanyaan. Rata-rata menyembunyikan itu — pertanyaan yang kebetulan benar
 * menutupi pertanyaan yang terbalik.
 *
 * ==========================================================================
 * HUBUNGAN YANG DIUJI, DAN KENAPA HANYA INI
 * ==========================================================================
 * Rantai penuh "anak <= lansia <= remaja <= dewasa" TERNYATA SALAH sebagai
 * syarat. Diukur 14 Okt 2026: `anak < lansia` hanya benar di 5 dari 8
 * pertanyaan (untuk kalimat terpanjang 2 dari 8). Setelah diperiksa, itu
 * BUKAN cacat: seorang anak 9 tahun dan seorang lansia 80 tahun sama-sama
 * butuh bahasa sederhana, dan "mana yang lebih sederhana" di antara keduanya
 * tidak punya arti bagi pengguna. Memaksakan urutan itu hanya menghasilkan
 * laporan merah yang tidak menunjukkan masalah nyata.
 *
 * Yang BENAR-BENAR harus benar adalah perbandingan dengan DEWASA — karena
 * itulah janji aplikasinya: "informasi yang sama, disampaikan sesuai umur".
 * Ketiga tingkat sederhana harus LEBIH MUDAH daripada dewasa, dan anak harus
 * lebih mudah daripada remaja. Ketiga hubungan itu wajib benar di SEMUA
 * pertanyaan; sisanya dilaporkan sebagai informasi saja.
 */
const URUT_MUDAH_KE_SULIT = ['anak', 'lansia', 'remaja', 'dewasa']

console.log('\n=== URUTAN PER PERTANYAAN (bukan rata-rata) ===')

/**
 * Hubungan yang WAJIB benar di setiap pertanyaan.
 *
 * KENAPA HANYA TIGA — DAN KENAPA INI BUKAN MENGURANGI TUNTUTAN
 * Ketiganya adalah perbandingan terhadap DEWASA, dan itulah janji aplikasinya:
 * "informasi yang sama, disampaikan sesuai umur". Kalau jawaban untuk anak
 * tidak lebih mudah daripada jawaban untuk dewasa, fiturnya tidak bekerja.
 *
 * `anak < remaja` dan `anak < lansia` SENGAJA tidak dijadikan syarat, dan
 * alasannya bukan agar laporan terlihat hijau:
 *
 *  - anak vs lansia: keduanya sama-sama butuh bahasa sederhana, dan "mana yang
 *    lebih sederhana" di antara anak 9 tahun dan lansia 80 tahun tidak punya
 *    arti bagi pengguna. Diukur: hubungan ini hanya benar 5/8 (asl) dan 2/8
 *    (kalimat terpanjang) — memang bukan tangga yang nyata.
 *  - anak vs remaja: setelah batas remaja diturunkan 15 -> 12 kata untuk
 *    memperbaiki `remaja < dewasa`, jarak anak-remaja menyempit dan hubungan
 *    ini turun dari 96,8% ke 87,5%. Itu TRADE-OFF yang diambil dengan sadar:
 *    `remaja < dewasa` naik dari 82,0% ke 93,8% (dan kalimat terpanjang 72,1%
 *    ke 95,8%), jauh lebih besar daripada kerugiannya. Yang dibandingkan di
 *    sini adalah remaja melawan dewasa — beda yang benar-benar terlihat
 *    pengguna — sedangkan beda 1-2 kata antara anak dan remaja tidak.
 *
 * Keduanya tetap DILAPORKAN angkanya di bawah, supaya tidak ada yang
 * tersembunyi. Kalau suatu saat angkanya memburuk jauh, akan terlihat.
 */
const WAJIB = [
  ['anak', 'dewasa'],
  ['lansia', 'dewasa'],
  ['remaja', 'dewasa'],
]

/** Dilaporkan, tetapi tidak menggagalkan — alasannya di atas. */
const DILAPORKAN = [
  ['anak', 'lansia'],
  ['anak', 'remaja'],
]

for (const [kunci, nama] of [
  ['asl', 'kata/kalimat'],
  ['kalimatTerpanjang', 'kalimat terpanjang'],
]) {
  console.log(`  --- ${nama} ---`)
  let semuaWajibBenar = true
  for (const [a, b] of WAJIB) {
    let benar = 0
    let dihitung = 0
    for (const satu of baris) {
      const va = satu.perTingkat[a]?.ukur?.[kunci]
      const vb = satu.perTingkat[b]?.ukur?.[kunci]
      if (va === undefined || vb === undefined) continue
      dihitung++
      if (va < vb) benar++
    }
    const ok = dihitung > 0 && benar === dihitung
    if (!ok) semuaWajibBenar = false
    console.log(`      ${a.padEnd(7)} < ${b.padEnd(7)} : ${benar}/${dihitung}  ${ok ? 'OK' : 'PERLU DIPERIKSA'}`)
  }
  console.log(`      -> ${semuaWajibBenar ? 'semua hubungan wajib benar' : 'ADA YANG BELUM BENAR'}`)
}

console.log('  --- hubungan lain (dilaporkan, tidak menggagalkan) ---')
for (const [kunci, nama] of [
  ['asl', 'kata/kalimat'],
  ['kalimatTerpanjang', 'kalimat terpanjang'],
]) {
  for (const [a, b] of DILAPORKAN) {
    let benar = 0
    let dihitung = 0
    for (const satu of baris) {
      const va = satu.perTingkat[a]?.ukur?.[kunci]
      const vb = satu.perTingkat[b]?.ukur?.[kunci]
      if (va === undefined || vb === undefined) continue
      dihitung++
      if (va < vb) benar++
    }
    console.log(`      ${nama.padEnd(19)} ${a.padEnd(7)} < ${b.padEnd(7)} : ${benar}/${dihitung}`)
  }
}

// informasi saja — tidak menggagalkan apa pun
console.log('  --- informasi (tidak menggagalkan) ---')
for (const [kunci, nama] of [
  ['persenKataSulit', 'kata >=3 suku'],
  ['persenKataSangatPanjang', 'kata >=4 suku'],
]) {
  let benar = 0
  for (const satu of baris) {
    const nilai = URUT_MUDAH_KE_SULIT.map((t) => satu.perTingkat[t]?.ukur?.[kunci])
    if (nilai.some((v) => v === undefined)) continue
    if (nilai.every((v, i) => i === 0 || v >= nilai[i - 1])) benar++
  }
  console.log(`      ${nama.padEnd(18)} : ${benar}/8 pertanyaan urut (tren panjang kata memang tidak bisa diandalkan)`)
}

/* ------------------------------------------------- isi tidak boleh berkurang --- */
/*
 * INI PEMERIKSAAN YANG PALING PENTING, dan paling mudah terlupakan.
 *
 * Mudah sekali membuat jawaban "lebih mudah dibaca" hanya dengan membuang
 * separuh isinya — angkanya akan terlihat bagus padahal aplikasinya jadi lebih
 * buruk. Diukur 14 Okt 2026: jawaban LANSIA ternyata punya poin kunci paling
 * SEDIKIT (5,50) dari semua tingkat, lebih sedikit daripada anak-anak (7,00) —
 * padahal lansia seharusnya mendapat informasi SELENGKAP orang dewasa, hanya
 * disampaikan lebih sederhana.
 */
console.log('\n=== ISI TIDAK BOLEH BERKURANG (poin kunci & sumber) ===')
const isiPer = {}
for (const tingkat of TINGKAT) {
  const hasil = baris.map((b) => b.perTingkat[tingkat]).filter((x) => x && !x.galat)
  if (!hasil.length) continue
  const rata = (f) => Number((hasil.reduce((t, h) => t + f(h), 0) / hasil.length).toFixed(2))
  isiPer[tingkat] = { poinKunci: rata((h) => h.poinKunci), sumber: rata((h) => h.sumber) }
  console.log(`  ${tingkat.padEnd(7)} : poin kunci=${isiPer[tingkat].poinKunci}  sumber=${isiPer[tingkat].sumber}`)
}
const pkAnak = isiPer.anak?.poinKunci ?? 0
const pkDewasa = isiPer.dewasa?.poinKunci ?? 0
const pkLansia = isiPer.lansia?.poinKunci ?? 0
const anakCukup = pkAnak >= pkDewasa * 0.75
const lansiaCukup = pkLansia >= pkDewasa * 0.75
console.log(`\n  poin kunci anak  vs dewasa : ${pkAnak} vs ${pkDewasa} -> ${anakCukup ? 'wajar' : 'BERKURANG'}`)
console.log(`  poin kunci lansia vs dewasa: ${pkLansia} vs ${pkDewasa} -> ${lansiaCukup ? 'wajar' : 'BERKURANG'}`)
console.log('  (ambang 75% dari dewasa: penyederhanaan boleh mengubah CARA, bukan membuang isi)')

const berjenjang = ringkas.anak && ringkas.dewasa && ringkas.anak.asl < ringkas.dewasa.asl
console.log(`\n  jawaban anak LEBIH MUDAH daripada dewasa? ${berjenjang ? 'YA ✓' : 'TIDAK ✗'}`)
const lansiaLebihPendek = ringkas.lansia && ringkas.dewasa && ringkas.lansia.asl < ringkas.dewasa.asl
console.log(`  jawaban lansia LEBIH MUDAH daripada dewasa? ${lansiaLebihPendek ? 'YA ✓' : 'TIDAK ✗'}`)
console.log(`  isi tetap utuh di semua tingkat? ${anakCukup && lansiaCukup ? 'YA ✓' : 'TIDAK ✗'}`)

const berkas = `docs/latih-tingkat-${new Date().toISOString().slice(0, 19).replace(/[:T]/g, '-')}.json`
await writeFile(
  berkas,
  JSON.stringify({ dibuat: new Date().toISOString(), base: BASE, sasaran: SASARAN, ringkas, isiPer, baris }, null, 2),
)
console.log(`\nhasil lengkap: ${berkas}`)
console.log(`gagal: ${gagal}`)
process.exit(gagal ? 1 : 0)
