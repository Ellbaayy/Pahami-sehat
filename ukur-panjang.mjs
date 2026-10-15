#!/usr/bin/env node
/**
 * Ukur panjang jawaban per tingkat baca terhadap BATAS_PANJANG_TINGKAT.
 *
 * KENAPA ADA: batas kata per tingkat pernah DIABAIKAN model. Diukur 15 Okt 2026
 * sebelum perintah "periksa panjang" ditambahkan: jawaban tingkat anak keluar
 * 196 kata dari batas 150, dan lansia 215–232 kata dari batas 170. Sesudah
 * perintah itu, rata-ratanya 113 kata (anak) dan 166 kata (lansia).
 *
 * Butuh server lokal (`npm run server`) dan memanggil model sungguhan.
 * Jalankan dari akar repo:
 *   node ukur-panjang.mjs          # 2 putaran x 4 tingkat
 *   node ukur-panjang.mjs 3        # 3 putaran
 */
import { BATAS_PANJANG_TINGKAT } from './app/server/prompts.js'

const BASE = `http://127.0.0.1:${process.env.PORT ?? 8787}`

/** Teks contoh yang memang panjang — sengaja, supaya batasnya benar-benar teruji. */
const TEKS =
  'Hipertensi merupakan kondisi kronis yang ditandai dengan peningkatan tekanan darah arteri secara persisten di atas nilai ambang batas normal, yaitu 140/90 mmHg pada pengukuran klinik. Komplikasi meliputi hipertrofi ventrikel kiri, nefropati, retinopati hipertensif, dan stroke hemoragik. Faktor risiko mencakup riwayat keluarga, obesitas abdominal, asupan natrium berlebih (>2000 mg/hari), konsumsi alkohol, merokok, diabetes melitus tipe 2, dan dislipidemia. Terapi lini pertama meliputi ACE inhibitor, ARB, calcium channel blocker, dan diuretik tiazid; target tekanan darah <140/90 mmHg untuk dewasa, <130/80 mmHg bila disertai diabetes atau penyakit ginjal kronis. Pemantauan berkala meliputi pemeriksaan tekanan darah mandiri, elektrolit serum, kreatinin, dan laju filtrasi glomerulus setiap 6 bulan. Edukasi pasien mencakup pembatasan natrium, aktivitas fisik aerobik 150 menit per minggu, penurunan berat badan, dan kepatuhan minum obat.'

const putaran = Number(process.argv[2] ?? 2)

try {
  const h = await fetch(`${BASE}/api/health`, { signal: AbortSignal.timeout(15000) })
  if (!h.ok) throw new Error(String(h.status))
} catch {
  console.error(`Server lokal di ${BASE} tidak menjawab. Jalankan dulu: cd app && npm run server`)
  process.exit(2)
}

const hasil = {}
for (let p = 0; p < putaran; p++) {
  for (const tingkat of Object.keys(BATAS_PANJANG_TINGKAT)) {
    const t0 = Date.now()
    let j = null
    try {
      const r = await fetch(`${BASE}/api/sederhanakan`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ teks: TEKS, tingkat, bahasa: 'id' }),
        signal: AbortSignal.timeout(120000),
      })
      j = await r.json()
    } catch (e) {
      console.log(`putaran ${p + 1} ${tingkat.padEnd(7)} GAGAL: ${String(e.message).slice(0, 60)}`)
      continue
    }
    const kata = String(j.jawaban ?? '').split(/\s+/).filter(Boolean).length
    const batas = BATAS_PANJANG_TINGKAT[tingkat]
    ;(hasil[tingkat] ??= []).push({ kata, batas, ok: Boolean(j.ok) })
    console.log(
      `putaran ${p + 1} ${tingkat.padEnd(7)} kata=${String(kata).padStart(4)} (batas ${batas}) ` +
        `ok=${j.ok} toks=${j.usage?.completion_tokens} detik=${((Date.now() - t0) / 1000).toFixed(1)}`,
    )
  }
}

console.log('\nRINGKASAN — panjang jawaban per tingkat')
let semuaLolos = true
for (const [tingkat, arr] of Object.entries(hasil)) {
  const baris = arr.filter((a) => a.ok)
  const lolos = baris.filter((a) => a.kata <= a.batas).length
  const rata = baris.length ? Math.round(baris.reduce((s, a) => s + a.kata, 0) / baris.length) : 0
  if (lolos !== baris.length) semuaLolos = false
  console.log(`${tingkat.padEnd(7)} rata-rata ${String(rata).padStart(4)} kata | dalam batas ${lolos}/${baris.length}`)
}
console.log(
  '\nCatatan: panjang jawaban BERVARIASI antar putaran. Kesimpulan hanya boleh diambil dari\n' +
    'beberapa putaran — inilah alasan skrip ini menerima argumen jumlah putaran.',
)
process.exit(semuaLolos ? 0 : 1)
