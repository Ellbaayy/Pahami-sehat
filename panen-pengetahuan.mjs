#!/usr/bin/env node
/**
 * panen-pengetahuan.mjs — panen pengetahuan medis dari SUMBER RESMI ke database.
 *
 * ============================================================================
 * KENAPA SKRIP INI TIDAK MENYURUH AI MENGARANG
 * ============================================================================
 *
 * Jagi meminta (15 Okt 2026): "cari data sumber-sumber dan update terbaru soal
 * kesehatan, penyakit, hal yang luas soal medis, lalu simpan di database, agar
 * AI punya banyak pengetahuan."
 *
 * Cara yang SALAH: menyuruh model menulis artikel tentang penyakit dari
 * ingatannya. Model bisa salah dosis, salah angka, atau mencampur dua penyakit
 * — dan kesalahan itu tersimpan rapi di database seolah-olah fakta. Untuk
 * aplikasi kesehatan itu bukan bug, itu bahaya.
 *
 * Cara yang dipakai di sini: AMBIL TEKS ASLINYA dari sumber resmi, simpan
 * bersama URL dan tanggal. AI tidak mengarang apa pun — ia hanya menyimpan
 * salinan yang bisa diperiksa siapa pun.
 *
 * Sumber:
 *   1. MedlinePlus (Perpustakaan Kedokteran Nasional AS, bagian NIH)
 *      — API resmi wsearch.nlm.nih.gov, mengembalikan ringkasan resmi.
 *   2. Wikipedia Indonesia (API resmi) — hanya sebagai pelengkap berbahasa
 *      Indonesia, dan ditandai resmi=0 supaya jelas bedanya.
 *
 * Setiap baris WAJIB punya `kedaluwarsa` (ditegakkan skema database). Bawaannya
 * 90 hari untuk topik penyakit: panduan medis bisa berubah, jadi yang basi
 * tidak boleh tersaji. Kode penyajian menyaring `kedaluwarsa > NOW()`.
 *
 * CARA PAKAI
 *   node panen-pengetahuan.mjs                  # 20 topik pertama (uji cepat)
 *   node panen-pengetahuan.mjs --maks 50        # 50 topik
 *   node panen-pengetahuan.mjs --semua          # semua 377 istilah
 *   node panen-pengetahuan.mjs --berlaku 30     # masa berlaku 30 hari
 *   node panen-pengetahuan.mjs --kering         # jangan tulis ke database
 *
 * Butuh MariaDB jalan:  sudo /opt/lampp/lampp startmysql
 */

import { writeFile, mkdir } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { ISTILAH_CARI, PETA_MEDLINEPLUS } from './app/server/kataKunci.js'
import { simpanPengetahuan, tutupDb, dbSiap } from './app/server/db.js'

const __dirname = dirname(fileURLToPath(import.meta.url))
const arg = process.argv.slice(2)
const SEMUA = arg.includes('--semua')
const KERING = arg.includes('--kering')
const MAKS = SEMUA ? 9999 : Number((arg[arg.indexOf('--maks') + 1] || '20').replace(/\D/g, '')) || 20
const BERLAKU = Number((arg[arg.indexOf('--berlaku') + 1] || '90').replace(/\D/g, '')) || 90

const UA = 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120 Safari/537.36'

/** Jeda antar permintaan — sopan terhadap server sumber, jangan dibanjiri. */
const JEDA_MS = 700

const tunggu = (ms) => new Promise((r) => setTimeout(r, ms))

/**
 * Periksa apakah isi yang diambil benar-benar membahas topiknya.
 *
 * KENAPA INI ADA — kesalahan nyata yang sudah terjadi:
 *   topik "luka"  -> tersimpan penjelasan tentang BAHU ("shoulder joint"),
 *                    karena MedlinePlus mencocokkan kata "wound" ke halaman
 *                    cedera bahu.
 *   topik "rujukan" -> tersimpan arti KAMUS ("referensi untuk menyokong
 *                    pendapat"), bukan rujukan medis.
 *
 * Menyimpan yang salah lebih buruk daripada tidak menyimpan: pengguna
 * bertanya "luka", lalu diberi penjelasan tentang bahu. Jadi isi yang tidak
 * cocok DITOLAK, bukan disimpan dengan harapan tidak apa-apa.
 *
 * @param {string} istilah  topik aslinya (bahasa Indonesia)
 * @param {string} isi      teks yang diambil
 * @param {string} inggris  padanan Inggris yang dipakai untuk mencari
 * @returns {boolean}
 */
function cocokTopiknya(istilah, isi, inggris) {
  const teks = String(isi).toLowerCase()
  if (!teks) return false

  // kumpulkan kata kunci: dari istilah Indonesia DAN padanan Inggrisnya
  const kata = String(istilah)
    .toLowerCase()
    .split(/[\s,/()]+/)
    .filter((w) => w.length >= 4)
  const kataIng = String(inggris)
    .toLowerCase()
    .split(/[\s,/()]+/)
    .filter((w) => w.length >= 4)

  const semua = [...new Set([...kata, ...kataIng])]
  if (!semua.length) return true // topik terlalu pendek untuk diperiksa

  // salah satu kata harus muncul di 300 karakter pertama — bagian yang
  // menjelaskan "apa ini". Kalau tidak ada satu pun, kemungkinan besar salah.
  const kepala = teks.slice(0, 300)
  const ada = semua.some((w) => kepala.includes(w))
  if (ada) return true

  // Kalau gagal di kepala, izinkan lewat kalau katanya muncul di mana saja
  // DAN isinya tidak lebih pendek dari 200 karakter (hindari frasa nyasar).
  return semua.some((w) => teks.includes(w)) && teks.length >= 200
}

/* ======================================================== MedlinePlus (NIH) == */

/**
 * Ambil ringkasan resmi dari API MedlinePlus.
 *
 * Kenapa MedlinePlus: isinya ditulis Perpustakaan Kedokteran Nasional AS
 * (bagian NIH), berbahasa Inggris, dan sudah berupa ringkasan yang bisa
 * dipakai langsung — bukan artikel mentah yang perlu ditebak-tebak.
 *
 * @param {string} istilah
 * @returns {Promise<{judul:string, isi:string, url:string}|null>}
 */
async function dariMedlinePlus(istilah) {
  // Terjemahkan dulu ke istilah Inggris yang dipakai MedlinePlus. Aplikasi
  // SUDAH punya peta ini (PETA_MEDLINEPLUS, 262 entri) yang dipakai jalur
  // pencarian biasa — jadi tidak perlu bikin peta kedua yang bisa berbeda.
  const inggris = PETA_MEDLINEPLUS[String(istilah).toLowerCase()] || istilah

  const url =
    'https://wsearch.nlm.nih.gov/ws/query?db=healthTopics&retmax=1&term=' +
    encodeURIComponent(inggris)
  const res = await fetch(url, { headers: { 'User-Agent': UA }, signal: AbortSignal.timeout(25_000) })
  if (!res.ok) return null
  const xml = await res.text()

  const blok = xml.match(/<document[^>]*>([\s\S]*?)<\/document>/)
  if (!blok) return null

  // URL artikel ada di ATRIBUT tag <document>, bukan di dalam isinya.
  // Kesalahan sebelumnya: mencari `url="..."` di dalam blok[1] (isi tag),
  // sehingga tidak pernah ketemu dan semua baris jatuh ke halaman depan
  // medlineplus.gov — tautan yang tidak berguna untuk memeriksa sumber.
  const urlDok = xml.match(/<document[^>]*\surl="([^"]+)"/)?.[1] ?? null

  const ambil = (nama) => {
    const m = blok[1].match(new RegExp(`<content name="${nama}">([\\s\\S]*?)</content>`))
    return m ? m[1] : ''
  }

  // buang penanda <span class="qt0"> dan tag lain, lalu ubah &lt;p&gt; jadi baris
  const bersih = (t) =>
    t
      .replace(/<span[^>]*>/g, '')
      .replace(/<\/span>/g, '')
      .replace(/&lt;p&gt;/g, '\n\n')
      .replace(/&lt;\/p&gt;/g, '')
      .replace(/&lt;[^&]*?&gt;/g, '')
      .replace(/&amp;/g, '&')
      .replace(/&quot;/g, '"')
      .replace(/&#39;/g, "'")
      .replace(/&nbsp;/g, ' ')
      .replace(/\n{3,}/g, '\n\n')
      .trim()

  const judul = bersih(ambil('title'))
  const isi = bersih(ambil('FullSummary'))
  if (!isi || isi.length < 120) return null
  // tolak kalau isinya ternyata membahas hal lain (lihat cocokTopiknya)
  if (!cocokTopiknya(istilah, isi, inggris)) return null

  // Tanpa URL artikel yang benar, sumbernya tidak bisa diperiksa pengguna —
  // lebih baik tidak menyimpan sama sekali daripada menyimpan tautan halaman depan.
  if (!urlDok || !/^https?:\/\//i.test(urlDok)) return null

  return { judul: judul || istilah, isi, url: urlDok, domain: 'medlineplus.gov' }
}

/* ============================================== Wikipedia Indonesia (pelengkap) == */

/**
 * Ringkasan Wikipedia Indonesia — PELENGKAP saja.
 *
 * Ditandai resmi=0 di database karena Wikipedia bukan lembaga kesehatan.
 * Gunanya hanya supaya ada padanan berbahasa Indonesia; sumber utama tetap
 * lembaga resmi.
 */
async function dariWikipedia(istilah) {
  const url =
    'https://id.wikipedia.org/api/rest_v1/page/summary/' +
    encodeURIComponent(istilah.replace(/ /g, '_'))
  const res = await fetch(url, {
    headers: { 'User-Agent': UA, Accept: 'application/json' },
    signal: AbortSignal.timeout(20_000),
  })
  if (!res.ok) return null
  const j = await res.json()
  const isi = String(j?.extract ?? '').trim()
  if (isi.length < 120) return null
  // buang halaman disambiguasi / bukan topik kesehatan
  if (j?.type === 'disambiguation') return null
  // tolak arti kamus / topik meleset (mis. "rujukan" -> arti kata umum)
  if (!cocokTopiknya(istilah, isi, istilah)) return null
  return {
    judul: j.title || istilah,
    isi,
    url: j?.content_urls?.desktop?.page ?? `https://id.wikipedia.org/wiki/${encodeURIComponent(istilah)}`,
    domain: 'id.wikipedia.org',
  }
}

/* ============================================================== jalannya == */

async function utama() {
  const daftar = [...new Set(ISTILAH_CARI)].slice(0, MAKS)
  console.log(`=== PANEN PENGETAHUAN DARI SUMBER RESMI ===`)
  console.log(`topik      : ${daftar.length}${SEMUA ? ' (semua)' : ` dari ${ISTILAH_CARI.length}`}`)
  console.log(`berlaku    : ${BERLAKU} hari`)
  console.log(`tulis DB   : ${KERING ? 'TIDAK (--kering)' : 'ya'}`)
  console.log('')

  if (!KERING) {
    const siap = await dbSiap()
    if (!siap) {
      console.log('BERHENTI: MariaDB tidak tersambung.')
      console.log('Nyalakan dulu:  sudo /opt/lampp/lampp startmysql')
      process.exit(1)
    }
  }

  const hasil = { dibuat: new Date().toISOString(), berlakuHari: BERLAKU, topik: [] }
  let masuk = 0
  let gagal = 0
  let resmi = 0
  let pelengkap = 0

  for (let i = 0; i < daftar.length; i++) {
    const istilah = daftar[i]
    const label = `[${String(i + 1).padStart(3)}/${daftar.length}] ${istilah}`
    try {
      // Sumber utama: lembaga resmi
      const utama1 = await dariMedlinePlus(istilah)
      if (utama1) {
        resmi += 1
        if (!KERING) {
          await simpanPengetahuan({
            topik: istilah,
            jenis: tebakJenis(istilah),
            isi: utama1.isi,
            ringkas: utama1.isi.slice(0, 400),
            url: utama1.url,
            domain: utama1.domain,
            berlakuHari: BERLAKU,
          })
        }
        masuk += 1
        console.log(`${label}  RESMI  ${utama1.isi.length} char`)
      } else {
        // Pelengkap: hanya kalau sumber resmi tidak punya
        await tunggu(JEDA_MS)
        const pel = await dariWikipedia(istilah)
        if (pel) {
          pelengkap += 1
          if (!KERING) {
            await simpanPengetahuan({
              topik: istilah,
              jenis: tebakJenis(istilah),
              isi: pel.isi,
              ringkas: pel.isi.slice(0, 400),
              url: pel.url,
              domain: pel.domain,
              berlakuHari: Math.min(BERLAKU, 60), // pelengkap: masa berlaku lebih pendek
            })
          }
          masuk += 1
          console.log(`${label}  pelengkap  ${pel.isi.length} char`)
        } else {
          gagal += 1
          console.log(`${label}  -- tidak ada di sumber mana pun`)
        }
      }
      hasil.topik.push({ istilah, resmi: Boolean(utama1) })
    } catch (e) {
      gagal += 1
      console.log(`${label}  GAGAL: ${String(e?.message ?? e).slice(0, 70)}`)
    }
    await tunggu(JEDA_MS)
  }

  hasil.masuk = masuk
  hasil.gagal = gagal
  hasil.resmi = resmi
  hasil.pelengkap = pelengkap

  await mkdir(join(__dirname, 'docs'), { recursive: true })
  const berkas = join(__dirname, 'docs', `panen-pengetahuan-${Date.now()}.json`)
  await writeFile(berkas, JSON.stringify(hasil, null, 2), 'utf8')

  console.log('')
  console.log('=== RINGKASAN ===')
  console.log(`masuk           : ${masuk}`)
  console.log(`  dari lembaga resmi : ${resmi}`)
  console.log(`  pelengkap          : ${pelengkap}`)
  console.log(`tidak ditemukan : ${gagal}`)
  console.log(`catatan         : ${berkas}`)

  await tutupDb()
}

/**
 * Tebak jenis entri dari bentuk istilahnya. Kasar saja — tujuannya supaya
 * kolom `jenis` berguna untuk penyaringan, bukan untuk klasifikasi medis.
 */
function tebakJenis(istilah) {
  const t = String(istilah).toLowerCase()
  if (/^(cara|pemeriksaan|tes|uji|skrining|vaksin|imunisasi|operasi|terapi)/.test(t)) return 'prosedur'
  if (/(obat|antibiotik|vaksin|imunisasi|vitamin|suplemen)/.test(t)) return 'obat'
  if (/(nyeri|demam|batuk|mual|pusing|gejala|sesak|bengkak)/.test(t)) return 'gejala'
  if (/(pemeriksaan|kadar|angka|tekanan|gula darah|kolesterol|indeks)/.test(t)) return 'istilah'
  return 'penyakit'
}

utama().catch(async (e) => {
  console.error('GAGAL:', e)
  await tutupDb()
  process.exit(1)
})
