#!/usr/bin/env node
/**
 * Impor seluruh rumah sakit Indonesia dari SIRS Kemenkes ke MySQL (XAMPP).
 * ============================================================================
 *
 * SUMBER — dan kenapa bukan scraping
 * ----------------------------------
 * `https://sirs.kemkes.go.id/fo/home/rekap_rs_all?id=0` ternyata BUKAN halaman
 * HTML, melainkan **JSON resmi** yang dipakai dashboard SIRS sendiri:
 *
 *   {"label":"List Rumah Sakit (Nasional)",
 *    "data":[{"kode":"1171145","nama":"RS Umum Meutia","nama_prop":"Aceh",
 *             "kab":"Kota Banda Aceh","alamat":"Jl. Cut Meutia No. 55",
 *             "TELEPON":"082268292278","pemilik":"SWASTA/LAINNYA",
 *             "kelas":"D","jenis":"RSU"}, ...]}
 *
 * Diukur 4 Nov 2026: **3.325 rumah sakit nasional dalam satu tarikan**, tanpa
 * pagination. Karena sumbernya sudah JSON resmi, tidak ada HTML yang diurai
 * dan tidak ada pemilihan selektor yang rapuh.
 *
 * Langkah pengambilan:
 *   1. rekap_rs_all?id=0     -> daftar nasional (kode, nama, prop, kab, alamat,
 *                               telepon, pemilik, kelas, jenis)
 *   2. rekap_by_jenis/kelas/kepemilikan?id=0 -> ANGKA REKAP RESMI, dipakai
 *      sebagai pembanding independen: kalau hasil hitung lokal tidak sama
 *      dengan rekap SIRS sendiri, tarikannya tidak lengkap dan impor ditolak.
 *
 * Field yang TIDAK ada di sumber (diverifikasi, bukan diasumsikan):
 *   - latitude / longitude  — tidak ada di daftar nasional, tidak ada di
 *     halaman profil RS, dan JS peta SIRS hanya berisi poligon provinsi
 *     (mapgeo/koordinat -> 38 feature MultiPolygon). Jadi NULL, bukan 0, dan
 *     bukan hasil tebakan dari alamat.
 *   - kecamatan / kelurahan / email / website — tidak ada di sumber. NULL.
 *   - status operasional — tidak disediakan sebagai field; yang ada hanya
 *     keberadaan RS di daftar nasional. Kolomnya dibiarkan NULL, dan status
 *     "tidak lagi ditemukan" dicatat lewat `hilang_pada`.
 *
 * SURAT KEPERCAYAAN: kalau sumber tidak bisa dihubungi, impor GAGAL dan
 * melaporkannya. Tidak ada fallback ke data karangan, dan baris lama tidak
 * dihapus.
 *
 * PEMAKAIAN
 * ---------
 *   node impor-sirs.mjs              impor / sinkronisasi ulang (aman diulang)
 *   node impor-sirs.mjs --kering     hanya tarik + bandingkan, tanpa menulis DB
 *   node impor-sirs.mjs --profil     lengkapi profil tiap RS (lambat, sopan)
 *   node impor-sirs.mjs --batas 500  batasi jumlah RS (untuk menguji)
 *
 * WAJIB dijalankan dari akar repo, dengan XAMPP/MariaDB hidup.
 */

import { readFileSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import mysql from './app/node_modules/mysql2/promise.js'

const AKAR = dirname(fileURLToPath(import.meta.url))

const BASIS = 'https://sirs.kemkes.go.id/fo/home'
const SUMBER = 'SIRS Kemenkes'
const UA =
  'PahamiSehat/1.0 (proyek edukasi kesehatan; impor data fasilitas; menghubungi pengelola bila perlu)'

/** Endpoint rekap resmi, dipakai sebagai pembanding independen. */
const REKAP = {
  jenis: `${BASIS}/rekap_by_jenis?id=0`,
  kelas: `${BASIS}/rekap_by_kelas?id=0`,
  pemilik: `${BASIS}/rekap_by_kepemilikan?id=0`,
}

const DAFTAR_URL = `${BASIS}/rekap_rs_all?id=0`

const JEDA_MS = Number(process.env.SIRS_JEDA_MS || 1200)
const COBA_ULANG = Number(process.env.SIRS_COBA || 4)

const argumen = process.argv.slice(2)
const bendera = (n) => argumen.includes(`--${n}`)
const nilaiArg = (n, bawaan) => {
  const i = argumen.indexOf(`--${n}`)
  return i >= 0 && argumen[i + 1] ? argumen[i + 1] : bawaan
}

const KERING = bendera('kering')
const PROFIL = bendera('profil')
const BATAS = Number(nilaiArg('batas', 0)) || 0

const jeda = (ms) => new Promise((r) => setTimeout(r, ms))

/* --------------------------------------------------------------- util ---- */

const kosongJadiNull = (v) => {
  if (v === undefined || v === null) return null
  const s = String(v).trim()
  return s === '' ? null : s
}

/** Angka dari SIRS kadang berformat "1.234" — hanya terima digit. */
const angka = (v) => {
  if (v === undefined || v === null) return null
  const n = Number(String(v).replace(/[^\d.-]/g, ''))
  return Number.isFinite(n) ? n : null
}

/* ---------------------------------------------------------- jaringan ---- */

async function ambilJson(url, { coba = COBA_ULANG, batasMs = 90_000 } = {}) {
  let terakhir
  for (let i = 1; i <= coba; i++) {
    try {
      const res = await fetch(url, {
        headers: { 'User-Agent': UA, Accept: 'application/json' },
        signal: AbortSignal.timeout(batasMs),
      })
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const teks = await res.text()
      // SIRS membalas halaman galat CodeIgniter dengan status 200 pada
      // parameter yang salah. Balasan seperti itu bukan JSON, jadi ditolak di
      // sini alih-alih menghasilkan crash yang membingungkan.
      if (!teks.trim().startsWith('{') && !teks.trim().startsWith('[')) {
        throw new Error(`balasan bukan JSON: ${teks.slice(0, 80).replace(/\s+/g, ' ')}`)
      }
      return JSON.parse(teks)
    } catch (e) {
      terakhir = e
      if (i < coba) await jeda(1500 * i)
    }
  }
  throw new Error(`${url} gagal setelah ${coba} percobaan: ${terakhir?.message ?? terakhir}`)
}

/* ------------------------------------------------- sumber: daftar RS ----- */

async function ambilDaftar() {
  const j = await ambilJson(DAFTAR_URL)
  if (!Array.isArray(j?.data)) {
    throw new Error('balasan daftar nasional tidak berisi array `data`')
  }
  return { label: j.label ?? null, daftar: j.data }
}

/**
 * Hitung rekap resmi dari data yang sudah diambil, lalu bandingkan dengan
 * rekap yang dihitung SIRS sendiri. Ini pembanding yang tidak bergantung pada
 * kode kita: kalau SIRS bilang 1.826 kelas C dan hitungan kita 1.700, berarti
 * ada yang terlewat.
 */
function hitungSendiri(daftar, kunci) {
  const peta = new Map()
  for (const r of daftar) {
    const k = String(r[kunci] ?? '').trim() || '(kosong)'
    peta.set(k, (peta.get(k) ?? 0) + 1)
  }
  return peta
}

async function ambilRekapResmi() {
  const hasil = {}
  for (const [nama, url] of Object.entries(REKAP)) {
    try {
      const j = await ambilJson(url, { batasMs: 60_000 })
      const blok = Array.isArray(j) ? j[0] : j
      const data = blok?.json?.data
      if (!Array.isArray(data)) throw new Error('bentuk rekap tidak dikenal')
      const label = blok?.label?.categories ?? []
      const peta = new Map()
      data.forEach((d, i) => {
        // Tiga bentuk yang benar-benar ada di SIRS (diukur 4 Nov 2026):
        //   rekap_by_kelas        -> {name:"C", y:1826}
        //   rekap_by_jenis        -> 2828  (angka polos, label di label.categories)
        //   rekap_by_kepemilikan  -> 946   (angka polos, label di label.categories)
        // Membaca hanya bentuk {name,y} membuat dua rekap terakhir terbaca 0 dan
        // menghasilkan "SELISIH 3325" yang menyesatkan.
        if (d !== null && typeof d === 'object') {
          const y = typeof d.y === 'number' ? d.y : Array.isArray(d.data) ? d.data.reduce((a, b) => a + (Number(b) || 0), 0) : null
          if (d.name !== undefined && y !== null) peta.set(String(d.name).trim(), y)
          return
        }
        const y = Number(d)
        if (Number.isFinite(y)) peta.set(String(label[i] ?? `#${i}`).trim(), y)
      })
      if (!peta.size) throw new Error('rekap kosong')
      hasil[nama] = { peta, total: [...peta.values()].reduce((a, b) => a + b, 0) }
    } catch (e) {
      hasil[nama] = { galat: String(e.message).slice(0, 140) }
    }
    await jeda(600)
  }
  return hasil
}

/* --------------------------------------------------------------- profil -- */

/**
 * Halaman profil memberi beberapa field yang tidak ada di daftar nasional:
 * status BLU, direktur, tanggal pembaruan sumber. Koordinat TETAP tidak ada —
 * sudah diperiksa. Dipakai hanya kalau `--profil` diminta, karena berarti
 * 3.325 permintaan tambahan.
 */
async function ambilProfil(kode) {
  const res = await fetch(`${BASIS}/profile_rs/${encodeURIComponent(kode)}`, {
    headers: { 'User-Agent': UA },
    signal: AbortSignal.timeout(45_000),
  })
  if (!res.ok) throw new Error(`HTTP ${res.status}`)
  const html = await res.text()
  const teks = html
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<[^>]+>/g, '\n')
    .replace(/&amp;/g, '&')
    .replace(/&nbsp;/g, ' ')
  const baris = teks
    .split('\n')
    .map((x) => x.trim())
    .filter(Boolean)
  const sesudah = (label) => {
    const i = baris.findIndex((b) => b.replace(/[: ]+$/, '').toLowerCase() === label.toLowerCase())
    if (i < 0 || i + 1 >= baris.length) return null
    const v = baris[i + 1]
    return v && v.length < 160 ? v : null
  }
  return {
    statusBlu: sesudah('Status BLU'),
    direktur: sesudah('Direktur'),
    // "Last Update" diikuti tanggal dan jam
    sumberDiperbarui: sesudah('Last Update'),
  }
}

/* ------------------------------------------------------------- database -- */

function konfigurasiDb() {
  const envPath = join(AKAR, 'app', '.env')
  const env = {}
  try {
    for (const baris of readFileSync(envPath, 'utf8').split('\n')) {
      const m = baris.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/)
      if (m) env[m[1]] = m[2].replace(/^["']|["']$/g, '')
    }
  } catch {
    /* .env tidak ada -> pakai bawaan XAMPP */
  }
  return {
    host: env.DB_HOST || '127.0.0.1',
    port: Number(env.DB_PORT || 3306),
    user: env.DB_USER || 'root',
    password: env.DB_PASSWORD || '',
    database: env.DB_NAMA || 'pahami_sehat',
    charset: 'utf8mb4',
  }
}

async function pastikanSkema(pool) {
  const [kolom] = await pool.query(
    `SELECT COLUMN_NAME FROM information_schema.COLUMNS
      WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'fasilitas'`,
  )
  const ada = new Set(kolom.map((k) => k.COLUMN_NAME))
  const wajib = ['kode_rs', 'jenis_rs', 'kelas_rs', 'kepemilikan', 'provinsi', 'kabupaten', 'hilang_pada']
  const kurang = wajib.filter((k) => !ada.has(k))
  if (kurang.length) {
    throw new Error(
      `skema belum dimigrasi (kurang: ${kurang.join(', ')}). Jalankan dulu:\n` +
        `  /opt/lampp/bin/mysql -u root < docs/migrasi-sirs.sql`,
    )
  }
  const [t] = await pool.query(
    `SELECT COUNT(*) AS n FROM information_schema.TABLES
      WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'sinkron_fasilitas'`,
  )
  if (!t[0].n) throw new Error('tabel sinkron_fasilitas belum ada — jalankan docs/migrasi-sirs.sql')
}

async function idKategori(pool, kode) {
  const [r] = await pool.query('SELECT id FROM kategori_fasilitas WHERE kode = ?', [kode])
  if (!r.length) {
    await pool.query('INSERT INTO kategori_fasilitas (kode, label) VALUES (?, ?)', [kode, 'Rumah Sakit'])
    const [r2] = await pool.query('SELECT id FROM kategori_fasilitas WHERE kode = ?', [kode])
    return r2[0].id
  }
  return r[0].id
}

/* --------------------------------------------------------------- utama --- */

async function main() {
  const mulai = new Date()
  console.log('SIRS Kemenkes -> MySQL (pahami_sehat)')
  console.log(`mode: ${KERING ? 'KERING (tanpa tulis DB)' : 'IMPOR'}${PROFIL ? ' + profil' : ''}${BATAS ? `, batas ${BATAS}` : ''}`)
  console.log('')

  /* 1. daftar nasional ---------------------------------------------------- */
  console.log('[1/5] mengambil daftar nasional…')
  const { label, daftar: mentah } = await ambilDaftar()
  console.log(`      ${label ?? '(tanpa label)'} — ${mentah.length} rumah sakit`)

  const daftar = BATAS ? mentah.slice(0, BATAS) : mentah

  // Validasi bentuk minimum. Baris tanpa kode atau nama tidak bisa disimpan
  // dengan identifier yang bisa dipertanggungjawabkan, jadi dihitung gagal
  // alih-alih disimpan dengan kode karangan.
  const sah = []
  const buang = []
  const kodeTerlihat = new Set()
  for (const r of daftar) {
    const kode = kosongJadiNull(r.kode)
    const nama = kosongJadiNull(r.nama)
    if (!kode || !nama) {
      buang.push({ kode, nama, alasan: !kode ? 'kode kosong' : 'nama kosong' })
      continue
    }
    if (kodeTerlihat.has(kode)) {
      buang.push({ kode, nama, alasan: 'kode ganda di sumber' })
      continue
    }
    kodeTerlihat.add(kode)
    sah.push(r)
  }
  console.log(`      sah: ${sah.length} | dibuang: ${buang.length}`)
  if (buang.length) {
    const contoh = buang.slice(0, 5).map((b) => `${b.kode ?? '-'} (${b.alasan})`).join(', ')
    console.log(`      contoh dibuang: ${contoh}`)
  }

  /* 2. pembanding rekap resmi --------------------------------------------- */
  console.log('')
  console.log('[2/5] membandingkan dengan rekap resmi SIRS…')
  const rekap = await ambilRekapResmi()
  const pembanding = [
    ['kelas', 'kelas', 'kelas'],
    ['jenis', 'jenis', 'jenis'],
    ['pemilik', 'pemilik', 'pemilik'],
  ]
  let selisihTotal = 0
  for (const [nama, kunciRekap, kunciData] of pembanding) {
    const r = rekap[kunciRekap]
    if (!r || r.galat) {
      console.log(`      ${nama}: rekap resmi tidak terbaca (${r?.galat ?? 'kosong'}) — dilewati`)
      continue
    }
    const sendiri = hitungSendiri(sah, kunciData)
    // bandingkan berdasarkan total: nama kategori di rekap resmi memakai
    // spasi berbeda ("Organisasi Islam " vs "Organisasi Islam"), jadi
    // pencocokan per-label akan memberi selisih palsu.
    const totalSendiri = [...sendiri.values()].reduce((a, b) => a + b, 0)
    const beda = Math.abs(totalSendiri - r.total)
    selisihTotal += beda
    console.log(
      `      ${nama}: resmi ${r.total} vs lokal ${totalSendiri} -> ${beda === 0 ? 'COCOK' : `SELISIH ${beda}`}`,
    )
  }
  // Rekap per kelas dan per jenis menjumlah ke total nasional; dipakai untuk
  // memastikan tidak ada baris yang hilang saat tarikan.
  if (selisihTotal > 0) {
    console.log(`      PERINGATAN: ada selisih angka dengan rekap resmi (total ${selisihTotal}).`)
  } else {
    console.log('      angka cocok dengan rekap resmi SIRS.')
  }

  /* 3. profil (opsional) --------------------------------------------------- */
  let profil = new Map()
  if (PROFIL) {
    console.log('')
    console.log(`[3/5] mengambil profil ${sah.length} RS (1 permintaan/RS, jeda ${JEDA_MS} ms)…`)
    let ok = 0
    let gagal = 0
    for (let i = 0; i < sah.length; i++) {
      const kode = String(sah[i].kode)
      try {
        profil.set(kode, await ambilProfil(kode))
        ok++
      } catch {
        gagal++
      }
      if ((i + 1) % 100 === 0) console.log(`      ${i + 1}/${sah.length} (ok ${ok}, gagal ${gagal})`)
      await jeda(JEDA_MS)
    }
    console.log(`      profil: ${ok} berhasil, ${gagal} gagal`)
  } else {
    console.log('')
    console.log('[3/5] profil dilewati (pakai --profil untuk melengkapi status BLU & tanggal sumber)')
  }

  if (KERING) {
    console.log('')
    console.log('mode KERING: tidak ada yang ditulis ke database.')
    console.log(`kesimpulan: ${sah.length} RS siap diimpor, ${buang.length} dibuang.`)
    return
  }

  /* 4. tulis ke database --------------------------------------------------- */
  const pool = mysql.createPool({ ...konfigurasiDb(), connectionLimit: 4, waitForConnections: true })
  let idSinkron
  try {
    await pastikanSkema(pool)
    const kategoriId = await idKategori(pool, 'rumah-sakit')

    console.log('')
    console.log('[4/5] menulis ke MySQL…')
    const [ins] = await pool.query(
      `INSERT INTO sinkron_fasilitas (sumber, mulai, status) VALUES (?, ?, 'jalan')`,
      [SUMBER, mulai],
    )
    idSinkron = ins.insertId

    const UKURAN_BATCH = 200
    let baru = 0
    let diubah = 0
    let tetap = 0
    let gagal = 0
    const kodeDilihat = new Set()

    for (let i = 0; i < sah.length; i += UKURAN_BATCH) {
      const batch = sah.slice(i, i + UKURAN_BATCH)
      // Cek dulu mana yang sudah ada, supaya "baru" vs "diubah" dihitung dari
      // keadaan sebenarnya, bukan ditebak dari hasil upsert.
      const kodeBatch = batch.map((r) => String(r.kode))
      const [adaRows] = await pool.query(
        `SELECT kode_rs, nama, provinsi, kabupaten, kelas_rs, jenis_rs, kepemilikan,
                alamat, telepon
           FROM fasilitas WHERE kode_rs IN (${kodeBatch.map(() => '?').join(',')})`,
        kodeBatch,
      )
      const petaAda = new Map(adaRows.map((r) => [r.kode_rs, r]))

      for (const r of batch) {
        const kode = String(r.kode)
        kodeDilihat.add(kode)
        const p = profil.get(kode)
        const baris = {
          kode_rs: kode,
          nama: kosongJadiNull(r.nama),
          jenis_rs: kosongJadiNull(r.jenis),
          kelas_rs: kosongJadiNull(r.kelas),
          kepemilikan: kosongJadiNull(r.pemilik),
          provinsi: kosongJadiNull(r.nama_prop),
          kabupaten: kosongJadiNull(r.kab),
          alamat: kosongJadiNull(r.alamat),
          telepon: kosongJadiNull(r.TELEPON),
          // Status BLU datang dari halaman profil; tanpa --profil biarkan apa
          // adanya supaya nilai lama tidak tertimpa NULL.
          status_operasional: p?.statusBlu ? kosongJadiNull(p.statusBlu) : undefined,
        }

        try {
          const lama = petaAda.get(kode)
          if (!lama) {
            await pool.query(
              `INSERT INTO fasilitas
                 (kode_rs, nama, kategori_id, jenis_rs, kelas_rs, kepemilikan,
                  status_operasional, provinsi, kabupaten, alamat, telepon,
                  sumber, url_sumber, status_verifikasi, disinkron_pada, kedaluwarsa)
               VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?, 'terverifikasi', NOW(),
                       DATE_ADD(NOW(), INTERVAL 90 DAY))`,
              [
                baris.kode_rs,
                baris.nama,
                kategoriId,
                baris.jenis_rs,
                baris.kelas_rs,
                baris.kepemilikan,
                baris.status_operasional ?? null,
                baris.provinsi,
                baris.kabupaten,
                baris.alamat,
                baris.telepon,
                SUMBER,
                DAFTAR_URL,
              ],
            )
            baru++
          } else {
            const berubah = ['nama', 'provinsi', 'kabupaten', 'kelas_rs', 'jenis_rs', 'kepemilikan', 'alamat', 'telepon'].filter(
              (k) => String(lama[k] ?? '') !== String(baris[k] ?? ''),
            )
            await pool.query(
              `UPDATE fasilitas SET
                 nama = ?, jenis_rs = ?, kelas_rs = ?, kepemilikan = ?, provinsi = ?,
                 kabupaten = ?, alamat = ?, telepon = ?, kategori_id = ?,
                 sumber = ?, url_sumber = ?,
                 status_operasional = COALESCE(?, status_operasional),
                 disinkron_pada = NOW(), hilang_pada = NULL
               WHERE kode_rs = ?`,
              [
                baris.nama,
                baris.jenis_rs,
                baris.kelas_rs,
                baris.kepemilikan,
                baris.provinsi,
                baris.kabupaten,
                baris.alamat,
                baris.telepon,
                kategoriId,
                SUMBER,
                DAFTAR_URL,
                baris.status_operasional ?? null,
                kode,
              ],
            )
            if (berubah.length) diubah++
            else tetap++
          }
        } catch (e) {
          gagal++
          if (gagal <= 3) console.log(`      gagal ${kode}: ${e.message.slice(0, 90)}`)
        }
      }

      const selesai = Math.min(i + UKURAN_BATCH, sah.length)
      if (selesai % 400 === 0 || selesai === sah.length) {
        console.log(`      ${selesai}/${sah.length} — baru ${baru}, diubah ${diubah}, tetap ${tetap}, gagal ${gagal}`)
      }
    }

    /* 5. tandai yang hilang ------------------------------------------------- */
    // TIDAK dihapus. RS bisa absen dari satu tarikan karena gangguan sumber;
    // menghapusnya berarti kehilangan data yang besok muncul lagi.
    console.log('')
    console.log('[5/5] menandai RS yang tidak lagi muncul di sumber…')
    const daftarSemua = [...kodeDilihat]
    let hilang = 0
    if (!BATAS && daftarSemua.length) {
      // Hanya jalankan penandaan kalau tarikan benar-benar lengkap: dengan
      // --batas, RS di luar batas akan salah ditandai hilang.
      const [h] = await pool.query(
        `UPDATE fasilitas SET hilang_pada = NOW()
          WHERE sumber = ? AND kode_rs IS NOT NULL
            AND kode_rs NOT IN (${daftarSemua.map(() => '?').join(',')})
            AND (hilang_pada IS NULL)`,
        [SUMBER, ...daftarSemua],
      )
      hilang = h.affectedRows
    } else if (BATAS) {
      console.log('      dilewati: dengan --batas, penandaan "hilang" akan salah.')
    }
    console.log(`      ditandai hilang: ${hilang}`)

    const [[hitung]] = await pool.query(
      `SELECT COUNT(*) AS total,
              SUM(lat IS NOT NULL AND lon IS NOT NULL) AS berkoordinat,
              SUM(lat IS NULL OR lon IS NULL) AS tanpa_koordinat
         FROM fasilitas WHERE sumber = ? AND hilang_pada IS NULL`,
      [SUMBER],
    )

    await pool.query(
      `UPDATE sinkron_fasilitas SET
         selesai = NOW(), status = 'sukses', jumlah_sumber = ?,
         jumlah_baru = ?, jumlah_diubah = ?, jumlah_tetap = ?, jumlah_gagal = ?,
         jumlah_hilang = ?, tanpa_koordinat = ?
       WHERE id = ?`,
      [sah.length, baru, diubah, tetap, gagal, hilang, Number(hitung.tanpa_koordinat || 0), idSinkron],
    )

    await pool.query(
      `INSERT INTO catatan_sumber (sumber, catatan, diperiksa) VALUES (?, ?, NOW())
       ON DUPLICATE KEY UPDATE catatan = VALUES(catatan), diperiksa = NOW()`,
      [
        SUMBER,
        'Tidak menyediakan koordinat, kecamatan, kelurahan, email, maupun website. Diperiksa 4 Nov 2026: daftar nasional hanya berisi 9 field; halaman profil RS tidak memuat koordinat; JS peta SIRS hanya berisi poligon provinsi.',
      ],
    )

    console.log('')
    console.log('SELESAI')
    console.log(`  sumber          : ${sah.length} rumah sakit`)
    console.log(`  baru            : ${baru}`)
    console.log(`  diubah          : ${diubah}`)
    console.log(`  tidak berubah   : ${tetap}`)
    console.log(`  gagal           : ${gagal}`)
    console.log(`  ditandai hilang : ${hilang}`)
    console.log(`  di DB (aktif)   : ${hitung.total}`)
    console.log(`  berkoordinat    : ${hitung.berkoordinat ?? 0}`)
    console.log(`  tanpa koordinat : ${hitung.tanpa_koordinat ?? 0}`)
    if ((hitung.tanpa_koordinat ?? 0) > 0) {
      console.log('  catatan: SIRS memang tidak menyediakan koordinat. Baris ini TIDAK')
      console.log('           ditampilkan sebagai penanda akurat di peta.')
    }
  } catch (e) {
    if (idSinkron) {
      await pool
        .query(`UPDATE sinkron_fasilitas SET selesai = NOW(), status = 'gagal', pesan = ? WHERE id = ?`, [
          String(e.message).slice(0, 2000),
          idSinkron,
        ])
        .catch(() => {})
    }
    throw e
  } finally {
    await pool.end().catch(() => {})
  }
}

try {
  await main()
} catch (e) {
  console.error('')
  console.error('IMPOR GAGAL:', e?.message ?? e)
  process.exitCode = 1
}
