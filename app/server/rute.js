/**
 * Rute API Pahami Sehat — dipakai DUA tempat:
 *   1. server lokal  (server/index.js)  — untuk dev & Grand Final
 *   2. serverless    (api/index.js)     — untuk deploy di Vercel
 *
 * Semua logika endpoint ada di sini supaya kedua jalur berperilaku sama persis.
 * Endpoint:
 *   GET  /api/health
 *   GET  /api/meta
 *   POST /api/tanya            { pertanyaan, tingkat }
 *   POST /api/tanya/stream     { pertanyaan, tingkat }   (SSE)
 *   POST /api/sederhanakan     { teks, tingkat }
 *   POST /api/verifikasi       { klaim, tingkat }
 */

import { Router } from 'express'

import { config, safeInfo } from './config.js'
import { KenariError, chat, chatStream, cekSehat } from './kenari.js'
import { buatEkstrak } from './ekstrak.js'
import { buatSuara, tentukanBahasa, pilihSuara } from './suara.js'
import {
  TINGKAT,
  TINGKAT_DEFAULT,
  deteksiSantai,
  promptBerita,
  promptTanya,
  promptSantai,
  promptSederhanakan,
  promptVerifikasi,
  promptTanyaDenganCari,
  promptSederhanakanDenganCari,
  promptVerifikasiDenganCari,
} from './prompts.js'
import { ambilBeritaKesehatan, menanyakanBerita, ringkasanBerita } from './berita.js'
import { cariInternet } from './cari.js'
import { kataKunciPencarian, istilahKesehatan, PETA_MEDLINEPLUS, PETA_MEDLINEPLUS_BIDANG } from './kataKunci.js'
import { batasi } from './batas.js'
import {
  LAJU,
  MAKS_SEDERHANAKAN,
  MAKS_SUARA,
  MAKS_TANYA,
  MAKS_VERIFIKASI,
  SIMPANAN_HEALTH_MS,
} from './batasInput.js'
import { kontenHarianLengkap } from './konten.js'
import { bahasaJawaban } from './bahasa.js'

/* ---------------------------------------------------------------- util ---- */

/** Ambil JSON dari balasan model, tahan terhadap pagar kode & teks tambahan. */
function ambilJson(teks) {
  if (!teks) return null
  let s = teks.trim()
  // buang pagar kode ```json ... ```
  s = s.replace(/^```(?:json)?\s*/i, '').replace(/```\s*$/, '')
  const awal = s.indexOf('{')
  const akhir = s.lastIndexOf('}')
  if (awal === -1 || akhir === -1 || akhir < awal) return null
  try {
    return JSON.parse(s.slice(awal, akhir + 1))
  } catch {
    return null
  }
}

function rapikanTingkat(v) {
  const k = String(v ?? '').trim().toLowerCase()
  return TINGKAT[k] ? k : TINGKAT_DEFAULT
}

/** Normalisasi hasil model jadi bentuk yang dipakai frontend. */
function bentukHasil(mentah, tingkat, { verdictKey = null } = {}) {
  const t = TINGKAT[tingkat]
  if (!mentah) {
    return {
      ok: false,
      code: 'unparsed',
      pesan: 'Model tidak mengembalikan JSON yang bisa dibaca. Coba lagi.',
      jawaban: '',
      poinKunci: [],
      sumber: [],
      tingkat: { kunci: tingkat, label: t.label, usia: t.usia },
    }
  }
  const sumber = Array.isArray(mentah.sumber)
    ? mentah.sumber
        .filter((s) => s && (s.judul || s.penerbit || s.url))
        .map((s) => ({
          judul: String(s.judul ?? '').trim(),
          penerbit: String(s.penerbit ?? '').trim(),
          // hanya terima URL http(s) — jangan biarkan model menyelipkan skema lain
          url: /^https?:\/\//i.test(String(s.url ?? '')) ? String(s.url).trim() : '',
        }))
    : []

  const out = {
    ok: true,
    jawaban: String(mentah.jawaban ?? '').trim(),
    poinKunci: Array.isArray(mentah.poin_kunci) ? mentah.poin_kunci.map((p) => String(p).trim()).filter(Boolean) : [],
    sumber,
    catatan: String(mentah.catatan ?? '').trim(),
    tingkat: { kunci: tingkat, label: t.label, usia: t.usia },
  }
  if (verdictKey) out.verdict = String(mentah[verdictKey] ?? 'tidak_bisa_dipastikan').trim()
  return out
}

/** Bahasa jawaban: 'id' (default) atau 'en'. */
function rapikanBahasa(v) {
  return String(v ?? '').toLowerCase().startsWith('en') ? 'en' : 'id'
}

/**
 * Bahasa jawaban: ikuti bahasa pesan pengguna; kalau pesannya terlalu
 * pendek/netral untuk dipastikan, baru pakai bahasa antarmuka.
 */
function pilihBahasa(pesan, bahasaUi) {
  const b = bahasaJawaban(pesan, bahasaUi)
  return { nama: b.nama, kodeAsal: b.dariPesan ? 'pesan' : null, kode: b.kode }
}

/** Ringkas daftar hasil pencarian untuk dikirim ke frontend (tanpa isi panjang). */
function ringkasHasilCari(hasil = []) {
  return hasil.slice(0, 8).map((h) => ({
    judul: String(h.judul ?? '').slice(0, 160),
    url: /^https?:\/\//i.test(String(h.url ?? '')) ? h.url : '',
    resmi: Boolean(h.resmi),
  }))
}

/**
 * Ringkas daftar berita untuk dikirim ke frontend.
 * Berbeda dari ringkasHasilCari: berita punya sumber (nama media) dan tanggal,
 * dan link Google News ditandai karena tidak bisa dibuka dari server.
 */
function ringkasBerita(berita = []) {
  return berita.map((b) => ({
    judul: String(b.judul ?? '').slice(0, 160),
    url: /^https?:\/\//i.test(String(b.link ?? '')) ? b.link : '',
    sumber: String(b.sumber ?? ''),
    tanggal: String(b.tanggal ?? ''),
    umurHari: b.umurHari ?? null,
    linkTidakBisaDibuka: Boolean(b.linkTidakBisaDibuka),
  }))
}

/**
 * Cari sumber untuk sebuah pertanyaan.
 *
 * Bahan pencariannya dipilih oleh kataKunci.js — SATU tempat untuk seluruh
 * aturan (kata ganti orang, pemetaan kata keluhan, istilah kesehatan).
 *
 * Kalimat pengguna TIDAK lagi dipakai sebagai kandidat pencarian. Dulu itu
 * dilakukan sebagai cadangan, dan hasilnya selalu artikel yang tidak nyambung:
 * "...saya sering merasa lemas" menghasilkan "Arjuna" dan "Hantu Longga",
 * "saya menderita gatal-gatal..." menghasilkan "Siproheptadin". Kalau istilah
 * yang dipilih tidak menemukan apa-apa, lebih baik mengembalikan kosong dan
 * membiarkan model berkata jujur bahwa sumbernya belum ditemukan.
 *
 * DUA istilah yang dipakai, dan keduanya perlu:
 *   - `kunci`  -> bahan pencarian Wikipedia Indonesia (istilah hasil pemetaan,
 *                 mis. "rontgen" menjadi "Radiografi").
 *   - `istilah` -> bahan pencarian MedlinePlus (istilah yang dikenali
 *                 pengguna, mis. "rontgen" menjadi "x-ray"). Koleksi
 *                 MedlinePlus berbahasa Inggris, jadi istilah Indonesia tidak
 *                 pernah menemukan apa pun di sana — sudah diukur.
 *
 * @param {string} teks - pertanyaan/teks pengguna apa adanya
 * @returns {Promise<{ hasil: Array, dipakaiKataKunci: string|null }>}
 */
async function cariDenganCadangan(teks) {
  const kunci = kataKunciPencarian(teks)
  if (!kunci) return { hasil: [], dipakaiKataKunci: null }

  // Padanan MedlinePlus diambil dari istilah yang DIKENALI pengguna, bukan dari
  // `kunci` hasil pemetaan. PETA_MEDLINEPLUS berkunci 'rontgen'/'usg', sedangkan
  // `kunci` sudah menjadi 'Radiografi'/'Ultrasonografi medis' — dan tidak ada
  // satu pun padanannya di sana.
  const istilah = istilahKesehatan(teks)
  const istilahMedlinePlus = PETA_MEDLINEPLUS[istilah] ?? null

  // Cadangan yang lebih umum untuk BIDANG topiknya. Dipakai cariInternet()
  // hanya kalau istilah spesifik di atas menghasilkan nol dokumen. Ini yang
  // membuat pertanyaan tentang topik yang belum pernah dipetakan tetap punya
  // bahan, bukan langsung "tidak ada sumber".
  const istilahMedlinePlusBidang = PETA_MEDLINEPLUS_BIDANG[istilah] ?? null

  const { hasil } = await cariInternet(kunci, { istilahMedlinePlus, istilahMedlinePlusBidang })
  return { hasil, dipakaiKataKunci: hasil.length ? kunci : null }
}

/** Bungkus handler async supaya error-nya tertangkap middleware error. */
const bungkus = (fn) => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next)

/* -------------------------------------------------------------- routes ---- */

const rute = Router()

/**
 * Pembatas permintaan.
 *
 * Endpoint di bawah ini memanggil layanan luar yang BERBIAYA atau BERBEBAN:
 * model AI Kenari (berbayar) dan Wikipedia/Kemenkes (berbagi sumber daya).
 * Alamat aplikasi terbuka untuk umum, jadi tanpa pembatas siapa pun bisa
 * menghabiskan kuota akun — termasuk saat lomba berlangsung.
 *
 * Angka batasnya ada di server/batasInput.js (satu sumber kebenaran), bukan
 * ditulis ulang di sini. Sebelumnya setiap rute menulis angkanya sendiri dan
 * akibatnya tidak konsisten — ada yang terlewat sama sekali.
 *
 * Lihat catatan jujur soal sifat per-instance di server/batas.js.
 */
const batasTanya = batasi({ ...LAJU.tanya, nama: 'pertanyaan' })
const batasCari = batasi({ ...LAJU.sederhanakan, nama: 'permintaan' })
const batasVerifikasi = batasi({ ...LAJU.verifikasi, nama: 'permintaan' })
const batasSuara = batasi({ ...LAJU.suara, nama: 'permintaan suara' })
const batasKonten = batasi({ ...LAJU.konten, nama: 'permintaan konten' })
const batasHealth = batasi({ ...LAJU.health, nama: 'pemeriksaan kesehatan' })
const batasMeta = batasi({ ...LAJU.meta, nama: 'permintaan meta' })
const batasBerita = batasi({ ...LAJU.berita, nama: 'ringkasan berita' })

/**
 * Tolak masukan yang kepanjangan, dengan pesan yang menyebut batasnya.
 * Dipakai bersama supaya setiap rute berperilaku sama.
 *
 * @returns {boolean} true kalau sudah dijawab (pemanggil harus berhenti)
 */
function tolakKalauPanjang(res, nilai, maks, nama) {
  if (nilai.length <= maks) return false
  res.status(400).json({
    ok: false,
    code: 'input_terlalu_panjang',
    pesan: `${nama} terlalu panjang (maks ${maks.toLocaleString('id-ID')} karakter, terkirim ${nilai.length.toLocaleString('id-ID')}).`,
  })
  return true
}

/**
 * Simpanan hasil pemeriksaan kesehatan.
 *
 * /api/health memanggil /models di Kenari. Tanpa simpanan, setiap permintaan
 * menembak Kenari — diukur ~0,29 detik per panggilan, dan endpoint ini terbuka
 * untuk umum. Dengan simpanan 15 detik, pemantauan tetap dapat jawaban segar
 * sementara hujan permintaan tidak lagi membebani akun.
 */
let simpananHealth = null

rute.get('/api/health', batasHealth, bungkus(async (_req, res) => {
  const sekarang = Date.now()
  if (simpananHealth && sekarang - simpananHealth.waktu < SIMPANAN_HEALTH_MS) {
    res.set('X-Health-Cache', 'hit')
    return res.json(simpananHealth.isi)
  }
  const sehat = await cekSehat()
  const isi = { server: 'ok', kenari: sehat, ...safeInfo() }
  simpananHealth = { waktu: sekarang, isi }
  res.set('X-Health-Cache', 'miss')
  res.json(isi)
}))

/**
 * Konten harian untuk Beranda: topik populer, artikel, dan tips.
 *
 * Isinya diambil dari kanal resmi Kemenkes dan diperbarui sekali sehari
 * (lihat server/konten.js). Frontend memakai ini supaya halaman Beranda
 * tidak menampilkan artikel yang itu-itu saja.
 *
 * SOAL `?paksa=1`
 * Parameter ini memaksa pengambilan ulang dari situs Kemenkes. Dulu terbuka
 * untuk siapa pun, dan itu berbahaya: dengan pembatas 60/menit, satu penyerang
 * bisa memaksa 3.600 permintaan/jam ke server pemerintah — berisiko membuat IP
 * kita diblokir, dan merusak fitur ini untuk semua orang.
 *
 * Sekarang hanya berfungsi kalau RAHASIA_PAKSA diisi di environment DAN
 * nilainya cocok. Di produksi variabel itu tidak diisi, jadi parameter ini
 * tidak berpengaruh apa-apa di sana. Saat menguji di komputer sendiri,
 * jalankan:  RAHASIA_PAKSA=uji npm run server  lalu pakai ?paksa=uji
 */
rute.get('/api/konten', batasKonten, bungkus(async (req, res) => {
  const rahasia = String(process.env.RAHASIA_PAKSA ?? '').trim()
  const diminta = String(req.query?.paksa ?? '')
  const paksa = Boolean(rahasia) && diminta === rahasia
  const data = await kontenHarianLengkap({ paksa })
  res.set('Cache-Control', 'public, max-age=300, stale-while-revalidate=86400')
  res.json({ ok: true, ...data })
}))

rute.get('/api/meta', batasMeta, (_req, res) => {
  res.json({
    model: config.model,
    tingkat: Object.entries(TINGKAT).map(([kunci, t]) => ({
      kunci,
      label: t.label,
      usia: t.usia,
    })),
    tingkatDefault: TINGKAT_DEFAULT,
  })
})

/**
 * Ringkasan berita harian untuk lonceng pemberitahuan.
 *
 * Jagi meminta (15 Okt 2026): berita WAJIB segar minimal sehari sekali, dan
 * lonceng harus berbunyi kalau ada yang baru. Endpoint ini yang dibaca hook
 * `useBerita` di aplikasi: jumlah berita segar (<= 1 hari), 3 judul teratas,
 * tanggal diperbarui, dan sidik jari daftarnya.
 *
 * Murah: fetch RSS-nya di-cache sekali sehari di sisi server (lihat
 * ringkasanBerita di berita.js), jadi endpoint ini hanya membaca simpanan.
 */
rute.get('/api/berita/ringkas', batasBerita, bungkus(async (_req, res) => {
  const d = await ringkasanBerita()
  res.set('Cache-Control', 'public, max-age=300, stale-while-revalidate=86400')
  res.json({ ok: true, ...d })
}))

/**
 * Suara natural untuk jawaban AI.
 *
 * Menerima teks + bahasa, mengembalikan MP3. Dipakai tombol "Dengar" di
 * aplikasi. Nada tiap kalimat mengikuti isinya (lihat server/suara.js).
 *
 * Kalau layanan suara Microsoft tidak bisa dihubungi, balasannya 502 dengan
 * kode `suara_gagal` supaya frontend bisa jatuh ke suara bawaan peramban
 * tanpa menampilkan error yang membingungkan.
 */
rute.post('/api/suara', batasSuara, bungkus(async (req, res) => {
  const teks = String(req.body?.teks ?? '').trim()
  if (!teks) {
    return res.status(400).json({ ok: false, code: 'input_kosong', pesan: 'Teks masih kosong.' })
  }
  // Dulu tidak ada batas sama sekali. Diuji: teks 3000, 4001, dan 20000
  // karakter semuanya menggantung sampai koneksi diputus platform (60 detik)
  // tanpa balasan apa pun. Sekarang ditolak lebih awal dengan pesan jelas.
  if (tolakKalauPanjang(res, teks, MAKS_SUARA, 'Teks yang dibacakan')) return

  // Bahasa ditentukan dari ISI TEKS lebih dulu (Jawa/Sunda), baru kode dari
  // aplikasi sebagai cadangan — kode itu bahasa antarmuka, bukan bahasa jawaban.
  const diminta = String(req.body?.bahasa ?? '').trim().toLowerCase()
  const bahasa = tentukanBahasa(teks, diminta)

  try {
    const audio = await buatSuara(teks, { bahasa })
    res.set({
      'Content-Type': 'audio/mpeg',
      'Content-Length': String(audio.length),
      // suara untuk teks yang sama tidak berubah -> boleh disimpan sebentar
      'Cache-Control': 'public, max-age=3600',
    })
    return res.send(audio)
  } catch (e) {
    // Pesan galat dari layanan suara TIDAK dikirim ke klien. Endpoint ini
    // terbuka untuk umum, dan pesan itu bisa memuat alamat internal atau
    // rincian WebSocket. Cukup dicatat di log server.
    console.error('[suara]', e?.message ?? e)
    return res.status(502).json({
      ok: false,
      code: 'suara_gagal',
      pesan: 'Suara natural sedang tidak bisa dibuat. Peramban akan memakai suara bawaannya.',
      suara: pilihSuara(bahasa),
    })
  }
}))

rute.post('/api/tanya', batasTanya, bungkus(async (req, res) => {
  const pertanyaan = String(req.body?.pertanyaan ?? '').trim()
  if (!pertanyaan) return res.status(400).json({ ok: false, code: 'input_kosong', pesan: 'Pertanyaan masih kosong.' })
  if (tolakKalauPanjang(res, pertanyaan, MAKS_TANYA, 'Pertanyaan')) return

  const tingkat = rapikanTingkat(req.body?.tingkat)
  const bhs = pilihBahasa(pertanyaan, rapikanBahasa(req.body?.bahasa))

  // Pertanyaan soal BERITA kesehatan terkini: pakai jalur berita (RSS),
  // bukan Wikipedia — karena yang ditanyakan memang kabar harian, bukan
  // penjelasan medis. Berita tetap harus dicek ke sumber resminya.
  //
  // Diperiksa SEBELUM `deteksiSantai()` (15 Okt 2026): "berita terbaru hari
  // ini" hanya 3 kata tanpa kata tanya, jadi mode santai menangkapnya lebih
  // dulu dan pertanyaannya dijawab sebagai sapaan — jalur berita tidak pernah
  // tercapai. Permintaan berita yang jelas harus menang atas mode santai.
  if (menanyakanBerita(pertanyaan)) {
    const berita = await ambilBeritaKesehatan({ maks: 8 })
    const p = promptBerita({ pertanyaan, tingkat, berita, bahasa: bhs.nama, kodeAsal: bhs.kodeAsal })
    const hasil = await chat({ messages: [
      { role: 'system', content: p.system },
      { role: 'user', content: p.user },
    ] })
    const out = bentukHasil(ambilJson(hasil.text), tingkat)
    return res.json({ ...out, berita: true, hasilCari: ringkasBerita(berita), usage: hasil.usage })
  }

  // Obrolan biasa (sapaan / basa-basi) tidak perlu dicari di internet dan
  // tidak perlu menampilkan daftar sumber — tidak ada yang diverifikasi.
  if (deteksiSantai(pertanyaan)) {
    const ps = promptSantai({ pertanyaan, bahasa: bhs.nama, kodeAsal: bhs.kodeAsal })
    const h = await chat({ messages: [
      { role: 'system', content: ps.system },
      { role: 'user', content: ps.user },
    ] })
    const santai = bentukHasil(ambilJson(h.text), tingkat)
    return res.json({ ...santai, santai: true, hasilCari: [], usage: h.usage })
  }

  // cari di internet dulu supaya jawabannya berbasis sumber nyata
  const { hasil: hasilCari } = await cariDenganCadangan(pertanyaan)

  const p = promptTanyaDenganCari({ pertanyaan, tingkat, hasilCari, bahasa: bhs.nama, kodeAsal: bhs.kodeAsal })
  const hasil = await chat({ messages: [
    { role: 'system', content: p.system },
    { role: 'user', content: p.user },
  ] })

  const out = bentukHasil(ambilJson(hasil.text), tingkat)
  res.json({ ...out, hasilCari: ringkasHasilCari(hasilCari), usage: hasil.usage })
}))

rute.post('/api/sederhanakan', batasCari, bungkus(async (req, res) => {
  const teks = String(req.body?.teks ?? '').trim()
  if (!teks) return res.status(400).json({ ok: false, code: 'input_kosong', pesan: 'Teks masih kosong.' })
  if (tolakKalauPanjang(res, teks, MAKS_SEDERHANAKAN, 'Teks')) return

  const tingkat = rapikanTingkat(req.body?.tingkat)
  const bhs = pilihBahasa(teks, rapikanBahasa(req.body?.bahasa))

  // pakai 120 karakter pertama sebagai kata kunci pencarian — cukup untuk
  // menemukan istilahnya tanpa membuang waktu pada teks panjang.
  // Kalau teksnya bahasa daerah, pencarian itu kosong, jadi dipakai cadangan
  // istilah Indonesia lewat cariDenganCadangan.
  const { hasil: hasilCari } = await cariDenganCadangan(teks.slice(0, 120))

  const p = promptSederhanakanDenganCari({ teks, tingkat, hasilCari, bahasa: bhs.nama, kodeAsal: bhs.kodeAsal })
  const hasil = await chat({ messages: [
    { role: 'system', content: p.system },
    { role: 'user', content: p.user },
  ] })

  const out = bentukHasil(ambilJson(hasil.text), tingkat)
  res.json({ ...out, hasilCari: ringkasHasilCari(hasilCari), usage: hasil.usage })
}))

rute.post('/api/verifikasi', batasVerifikasi, bungkus(async (req, res) => {
  const klaim = String(req.body?.klaim ?? '').trim()
  if (!klaim) return res.status(400).json({ ok: false, code: 'input_kosong', pesan: 'Klaim masih kosong.' })
  if (tolakKalauPanjang(res, klaim, MAKS_VERIFIKASI, 'Klaim')) return

  const tingkat = rapikanTingkat(req.body?.tingkat)
  const bhs = pilihBahasa(klaim, rapikanBahasa(req.body?.bahasa))

  const { hasil: hasilCari } = await cariDenganCadangan(klaim)

  const p = promptVerifikasiDenganCari({ klaim, tingkat, hasilCari, bahasa: bhs.nama, kodeAsal: bhs.kodeAsal })
  const hasil = await chat({ messages: [
    { role: 'system', content: p.system },
    { role: 'user', content: p.user },
  ] })

  res.json({
    ...bentukHasil(ambilJson(hasil.text), tingkat, { verdictKey: 'verdict' }),
    hasilCari: ringkasHasilCari(hasilCari),
    usage: hasil.usage,
  })
}))

/**
 * Streaming SSE — untuk efek "mengetik" di UI.
 * Kirim event: `status`, `delta`, `hasil` (JSON final), atau `error`.
 *
 * BATAS PANJANG: dulu endpoint ini TIDAK punya batas sama sekali — dan itulah
 * yang berbahaya, karena inilah endpoint yang benar-benar dipakai aplikasi.
 * Diuji: 200.000 karakter diterima dan diproses (HTTP 200), padahal /api/tanya
 * menolak masukan yang sama dengan 400. Sekarang batasnya sama dengan
 * /api/tanya.
 *
 * PENTING soal urutan: penolakan harus dikirim sebagai JSON BIASA, bukan
 * sebagai event SSE. Kalau header sudah di-flush sebagai text/event-stream,
 * klien akan mencoba membacanya sebagai stream dan pesan galatnya tidak
 * pernah sampai. Karena itu pemeriksaan input dilakukan SEBELUM header.
 */
rute.post('/api/tanya/stream', batasTanya, bungkus(async (req, res) => {
  const pertanyaan = String(req.body?.pertanyaan ?? '').trim()
  if (!pertanyaan) return res.status(400).json({ ok: false, code: 'input_kosong', pesan: 'Pertanyaan masih kosong.' })
  if (tolakKalauPanjang(res, pertanyaan, MAKS_TANYA, 'Pertanyaan')) return

  const tingkat = rapikanTingkat(req.body?.tingkat)
  const bhs = pilihBahasa(pertanyaan, rapikanBahasa(req.body?.bahasa))

  res.set({
    'Content-Type': 'text/event-stream; charset=utf-8',
    'Cache-Control': 'no-cache, no-transform',
    Connection: 'keep-alive',
    'X-Accel-Buffering': 'no',
  })
  res.flushHeaders?.()

  const kirim = (event, data) => res.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`)

  // batalkan panggilan upstream kalau KLIEN memutus koneksi lebih dulu.
  // Catatan: pakai res.on('close'), bukan req.on('close') — di Node modern
  // 'close' pada request menyala begitu body selesai dibaca, sehingga
  // panggilan AI-nya ikut terbatalkan sendiri.
  const ac = new AbortController()
  res.on('close', () => {
    if (!res.writableEnded) ac.abort()
  })

  try {
    // Pertanyaan soal BERITA kesehatan terkini: pakai jalur berita (RSS),
    // bukan Wikipedia — yang ditanyakan memang kabar harian, bukan penjelasan medis.
    //
    // Diperiksa SEBELUM `deteksiSantai()` (15 Okt 2026): "berita terbaru hari
    // ini" hanya 3 kata tanpa kata tanya, jadi mode santai menangkapnya lebih
    // dulu dan pertanyaannya dijawab sebagai sapaan — jalur berita tidak pernah
    // tercapai. Permintaan berita yang jelas harus menang atas mode santai.
    if (menanyakanBerita(pertanyaan)) {
      kirim('status', { pesan: 'Mengambil berita kesehatan terbaru…' })
      const berita = await ambilBeritaKesehatan({ maks: 8 })
      kirim('sumber', { hasil: ringkasBerita(berita) })

      kirim('status', { pesan: 'Menyiapkan jawaban…' })
      const p = promptBerita({ pertanyaan, tingkat, berita, bahasa: bhs.nama, kodeAsal: bhs.kodeAsal })
      const ekstrakBerita = buatEkstrak('jawaban')

      const hasilBerita = await chatStream({
        messages: [
          { role: 'system', content: p.system },
          { role: 'user', content: p.user },
        ],
        signal: ac.signal,
        onDelta: (t) => {
          const bersih = ekstrakBerita.dorong(t)
          if (bersih) kirim('delta', { teks: bersih })
        },
      })

      const finalBerita = bentukHasil(ambilJson(hasilBerita.text), tingkat)
      kirim('hasil', { ...finalBerita, berita: true, hasilCari: ringkasBerita(berita), usage: hasilBerita.usage })
      res.write('event: selesai\ndata: {}\n\n')
      return
    }

    // Obrolan biasa: langsung jawab tanpa mencari dan tanpa daftar sumber.
    if (deteksiSantai(pertanyaan)) {
      kirim('status', { pesan: 'Menyiapkan jawaban…' })
      const ps = promptSantai({ pertanyaan, bahasa: bhs.nama, kodeAsal: bhs.kodeAsal })
      const ekstrakSantai = buatEkstrak('jawaban')

      const h = await chatStream({
        messages: [
          { role: 'system', content: ps.system },
          { role: 'user', content: ps.user },
        ],
        signal: ac.signal,
        onDelta: (t) => {
          const bersih = ekstrakSantai.dorong(t)
          if (bersih) kirim('delta', { teks: bersih })
        },
      })

      const santai = bentukHasil(ambilJson(h.text), tingkat)
      kirim('hasil', { ...santai, santai: true, hasilCari: [], usage: h.usage })
      res.write('event: selesai\ndata: {}\n\n')
      return
    }

    // 1) cari di internet dulu
    kirim('status', { pesan: 'Mencari sumber terpercaya…' })
    const { hasil: hasilCari } = await cariDenganCadangan(pertanyaan)
    kirim('sumber', { hasil: ringkasHasilCari(hasilCari) })

    // 2) baru minta model menyusun jawaban dari hasil itu
    kirim('status', { pesan: 'Menyiapkan jawaban…' })
    const p = promptTanyaDenganCari({ pertanyaan, tingkat, hasilCari, bahasa: bhs.nama, kodeAsal: bhs.kodeAsal })

    // hanya alirkan isi field "jawaban", bukan JSON mentahnya
    const ekstrak = buatEkstrak('jawaban')

    const hasil = await chatStream({
      messages: [
        { role: 'system', content: p.system },
        { role: 'user', content: p.user },
      ],
      signal: ac.signal,
      onDelta: (t) => {
        const bersih = ekstrak.dorong(t)
        if (bersih) kirim('delta', { teks: bersih })
      },
    })

    const final = bentukHasil(ambilJson(hasil.text), tingkat)
    kirim('hasil', { ...final, hasilCari: ringkasHasilCari(hasilCari), usage: hasil.usage })
    res.write('event: selesai\ndata: {}\n\n')
  } catch (e) {
    if (!ac.signal.aborted) {
      kirim('error', { code: e.code ?? 'upstream_error', pesan: e.message })
    }
  } finally {
    res.end()
  }
}))


/* -------------------------------------------------------------- errors ---- */

rute.use((err, _req, res, _next) => {
  const kenari = err instanceof KenariError
  // Body yang terlalu besar ditangkap express.json() sebagai err.type.
  // Tanpa penanganan ini, pengguna melihat "500 Terjadi kesalahan di server"
  // padahal masalahnya cuma kiriman kepanjangan.
  const terlaluBesar = err?.type === 'entity.too.large'
  const status = terlaluBesar ? 413 : kenari ? (err.status === 401 ? 502 : err.status) : 500
  const isi = {
    ok: false,
    code: terlaluBesar ? 'body_terlalu_besar' : kenari ? err.code : 'server_error',
    pesan: terlaluBesar
      ? 'Kiriman terlalu besar (maks 1 MB).'
      : kenari
        ? err.message
        : 'Terjadi kesalahan di server.',
  }
  if (!kenari && !terlaluBesar) console.error('[server]', err)
  if (res.headersSent) return res.end()
  res.status(status).json(isi)
})

export default rute
