#!/usr/bin/env node
/**
 * Petakan nama wilayah SIRS -> kode wilayah resmi (BPS/Kemendagri).
 * ============================================================================
 *
 * KENAPA PERLU
 * ------------
 * SIRS menyimpan nama wilayah sebagai TEKS BEBAS, dan cara penulisannya beda
 * dari dataset resmi wilayah.id. Terukur 4 Nov 2026:
 *
 *   SIRS                    wilayah.id                     baris
 *   "Yogyakarta"            "Daerah Istimewa Yogyakarta"      77
 *   "Aceh Barat"            "Kabupaten Aceh Barat"         banyak
 *   "Kota Banda Aceh"       "Kota Banda Aceh"              sudah sama
 *
 * Hanya **85 dari 513** pasangan provinsi+kabupaten yang cocok persis. Tanpa
 * pemetaan, filter kabupaten/kota di antarmuka menampilkan 514 pilihan yang
 * sebagian besar tidak menghasilkan satu baris pun.
 *
 * KENAPA DI NODE, BUKAN SQL
 * -------------------------
 * Versi SQL-nya butuh `CREATE FUNCTION ... BEGIN ... END`, dan itu mustahil
 * dijalankan lewat `mysql < berkas.sql` tanpa `DELIMITER` — sudah dicoba dan
 * gagal dengan ERROR 1064 di MariaDB 10.4. Di Node, normalisasinya juga bisa
 * diuji tanpa database.
 *
 * ATURAN PENTING: provinsi IKUT jadi kunci pencocokan. Banyak nama kabupaten
 * berulang antarprovinsi, dan menempatkan rumah sakit di provinsi yang salah
 * lebih buruk daripada tidak mencocokkan sama sekali. Yang tidak cocok
 * dibiarkan NULL dan DILAPORKAN, bukan ditebak.
 *
 * Pemakaian:
 *   node petakan-wilayah.mjs           tulis hasil ke database
 *   node petakan-wilayah.mjs --kering  laporkan saja
 */

import { readFileSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import mysql from './app/node_modules/mysql2/promise.js'

const AKAR = dirname(fileURLToPath(import.meta.url))
const KERING = process.argv.includes('--kering')

/**
 * Normalisasi nama wilayah jadi bentuk yang bisa dibandingkan.
 *
 * Urutannya penting: "daerah istimewa yogyakarta" harus diganti SEBELUM kata
 * "yogyakarta" berdiri sendiri, dan "kota administrasi" sebelum "kota" —
 * kalau terbalik, hasilnya "daerah istimewa " yang tidak cocok dengan apa pun.
 */
/**
 * Pisahkan nama wilayah menjadi { jenis, nama }.
 * ============================================================================
 *
 * KENAPA JENIS HARUS DIPERTAHANKAN
 * --------------------------------
 * Versi pertama fungsi ini membuang kata "kota"/"kabupaten" sebagai awalan, dan
 * itu menghasilkan kesalahan nyata yang terukur di database:
 *
 *   SIRS "Bekasi"       -> dipetakan ke 32.75 KOTA Bekasi    (salah)
 *   SIRS "Kota Bekasi"  -> dipetakan ke 32.75 KOTA Bekasi    (benar)
 *
 * Padahal SIRS menulis nama KABUPATEN tanpa awalan: "Bekasi" berarti Kabupaten
 * Bekasi (32.16), sementara kota selalu ditulis lengkap "Kota Bekasi". Akibatnya
 * 57 rumah sakit ditempatkan di kota yang salah. Hal yang sama terjadi pada
 * Bogor (32 RS) dan kabupaten/kota lain yang berbagi nama.
 *
 * Aturannya sekarang:
 *   - diawali "kota"/"kodya"/"kotamadya"        -> jenis 'kota'
 *   - diawali "kabupaten"/"kab."                -> jenis 'kabupaten'
 *   - tanpa awalan (kebiasaan SIRS)             -> jenis 'kabupaten'
 *
 * "Kota Administrasi Jakarta Selatan" (wilayah.id) dan "Kota Jakarta Selatan"
 * (SIRS) sama-sama berjenis 'kota', jadi keduanya tetap bertemu.
 */
export function pisahJenis(n) {
  let s = String(n ?? '').toLowerCase().trim()
  s = s.replace(/\bdaerah istimewa yogyakarta\b/g, 'yogyakarta')
  s = s.replace(/\bdaerah khusus ibukota jakarta\b/g, 'jakarta')
  s = s.replace(/\bdki jakarta\b/g, 'jakarta')
  s = s.replace(/\bnanggroe aceh darussalam\b/g, 'aceh')
  s = s.replace(/\bkepulauan bangka belitung\b/g, 'bangka belitung')

  let jenis = 'kabupaten'
  if (/^(kota administrasi|kota|kodya|kotamadya)\b/.test(s)) jenis = 'kota'

  /*
   * Urutan penghapusan awalan PENTING, dan versi sebelumnya salah:
   *
   *   s.replace(/^(kabupaten|kab\.|kota|kodya|kotamadya)\b/, '')
   *
   * "Kab. Bandung" -> `\bkab\.\b` TIDAK cocok, karena `\b` setelah titik
   * menuntut karakter kata, sementara berikutnya spasi. Yang cocok justru
   * alternatif `kabupaten`? Tidak juga. Hasil akhirnya "kab bandung" —
   * terukur di uji: `"Kab. Bandung"` menjadi `kabupaten|kab bandung`, sehingga
   * tidak pernah bertemu dengan "Kabupaten Bandung" dari data resmi.
   *
   * Sekarang "kab." ditangani terpisah (dengan titik dan spasi opsional),
   * SEBELUM "kabupaten", dan `\b` tidak dipakai untuk bentuk bertitik.
   */
  s = s.replace(/^(kota administrasi)\s+/, '')
  s = s.replace(/^(kabupaten administrasi)\s+/, '')
  s = s.replace(/^kab\.?\s+/, '')
  s = s.replace(/^(kabupaten|kota|kodya|kotamadya)\s+/, '')
  s = s.replace(/\bkepulauan\b/g, 'kep')
  s = s.replace(/[.,\-/]/g, ' ')
  s = s.replace(/\s+/g, ' ').trim()
  return { jenis, nama: s }
}

/** Bentuk datar untuk perbandingan cepat: "kota|jakarta selatan". */
export function kunciJenis(n) {
  const { jenis, nama } = pisahJenis(n)
  return `${jenis}|${nama}`
}

/** Nama saja tanpa jenis — dipakai untuk alias yang sudah eksplisit. */
export function normalNama(n) {
  return pisahJenis(n).nama
}

function konfigurasiDb() {
  const env = {}
  try {
    for (const baris of readFileSync(join(AKAR, 'app', '.env'), 'utf8').split('\n')) {
      const m = baris.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/)
      if (m) env[m[1]] = m[2].replace(/^["']|["']$/g, '')
    }
  } catch {
    /* bawaan XAMPP */
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

async function main() {
  const pool = mysql.createPool({ ...konfigurasiDb(), connectionLimit: 4 })
  try {
    const [wil] = await pool.query('SELECT kode, nama, tingkat, kode_induk FROM wilayah')
    const provinsi = wil.filter((w) => w.tingkat === 'provinsi')
    const kabupaten = wil.filter((w) => w.tingkat === 'kabupaten')

    // Indeks: provinsi dinormalkan -> kode provinsi
    const petaProvinsi = new Map(provinsi.map((p) => [normalNama(p.nama), p.kode]))
    /*
     * Indeks kabupaten memakai KUNCI BERJENIS ("kota|bekasi" vs
     * "kabupaten|bekasi"). Tanpa pembeda jenis, "Bekasi" dari SIRS (kabupaten,
     * karena SIRS membuang awalan) bertabrakan dengan "Kota Bekasi" milik
     * wilayah.id dan 57 rumah sakit jatuh ke kota yang salah — kesalahan yang
     * benar-benar terjadi dan baru ketahuan dari pemeriksaan sampel.
     */
    const petaKabupaten = new Map(kabupaten.map((k) => [`${k.kode_induk}|${kunciJenis(k.nama)}`, k.kode]))
    // Cadangan: kunci tanpa jenis, hanya dipakai kalau hasilnya unik dalam
    // provinsi itu. Menangani kasus SIRS menulis "Kab. X" sementara wilayah.id
    // menulis "X" (atau sebaliknya).
    const petaKabLuwes = new Map()
    const kabLuwesGanda = new Set()
    for (const k of kabupaten) {
      const kunci = `${k.kode_induk}|${normalNama(k.nama)}`
      if (petaKabLuwes.has(kunci)) kabLuwesGanda.add(kunci)
      else petaKabLuwes.set(kunci, k.kode)
    }
    for (const k of kabLuwesGanda) petaKabLuwes.delete(k)
    /*
     * Putaran kedua: abaikan spasi sama sekali.
     *
     * Terukur 4 Nov 2026, 19 dari 513 kabupaten tidak cocok pada putaran
     * pertama, dan polanya konsisten: SIRS memisah kata, data resmi menggabung.
     *
     *   SIRS                  wilayah.id
     *   Labuhan Batu          Labuhanbatu
     *   Gunung Kidul          Gunungkidul
     *   Palangka Raya         Palangkaraya
     *   Sawah Lunto           Sawahlunto
     *   Muko Muko             Mukomuko
     *   Pematang Siantar      Pematangsiantar
     *
     * Ini BUKAN tebakan: "Labuhan Batu" dan "Labuhanbatu" adalah nama yang
     * sama. Tetap dibatasi provinsi yang sama, dan hanya dipakai kalau
     * hasilnya UNIK di provinsi itu — kalau dua kabupaten berbeda menjadi sama
     * setelah spasi dibuang, keduanya tidak dipetakan.
     */
    const petaKabTanpaSpasi = new Map()
    const ganda = new Set()
    for (const k of kabupaten) {
      const kunci = `${k.kode_induk}|${kunciJenis(k.nama).replace(/\s+/g, '')}`
      if (petaKabTanpaSpasi.has(kunci)) ganda.add(kunci)
      else petaKabTanpaSpasi.set(kunci, k.kode)
    }
    for (const k of ganda) petaKabTanpaSpasi.delete(k)
    if (ganda.size) console.log(`catatan: ${ganda.size} nama kabupaten ambigu setelah spasi dibuang — dilewati`)

    /*
     * Putaran ketiga: singkatan & nama yang benar-benar berbeda.
     *
     * Enam sisa kegagalan (4 Nov 2026) bukan soal spasi, melainkan ejaan atau
     * singkatan, jadi tidak bisa diselesaikan aturan umum — dipetakan eksplisit
     * supaya bisa dibaca dan dipertanggungjawabkan satu per satu:
     *
     *   SIRS                              wilayah.id
     *   Kota Padang Sidempuan             Kota Padangsidimpuan
     *   Toba Samosir                      Kabupaten Toba        (nama berubah 2020)
     *   Kota baru                         Kabupaten Kotabaru   (SIRS huruf kecil)
     *   Mahakam Hulu                      Kabupaten Mahakam Ulu (Hulu vs Ulu)
     *   Kepulauan Siau Tagulandang Biaro  Kabupaten Kep. Siau Tagulandang Biaro
     *   Pangkajene Kepulauan              Kabupaten Pangkajene dan Kepulauan
     *
     * Tiap baris di bawah adalah keputusan yang bisa diperiksa, bukan hasil
     * kemiripan teks. Kalau salah, mudah dibatalkan satu per satu.
     */
    const ALIAS_KABUPATEN = [
      // [kodeProvinsi, kunci SIRS, kunci wilayah resmi] — dua kunci terakhir
      // sudah berbentuk "jenis|nama", jadi bisa dicari langsung di petaKabupaten.
      ['12', 'kota|padang sidempuan', 'kota|padangsidimpuan'],
      ['12', 'kabupaten|toba samosir', 'kabupaten|toba'],
      ['63', 'kota|baru', 'kabupaten|kotabaru'], // SIRS menulis "Kota baru" (huruf kecil) utk Kab. Kotabaru
      ['64', 'kabupaten|mahakam hulu', 'kabupaten|mahakam ulu'],
      ['71', 'kabupaten|siau tagulandang biaro', 'kabupaten|kep siau tagulandang biaro'], // "Kepulauan" sudah jadi "kep"
      ['73', 'kabupaten|pangkajene kep', 'kabupaten|pangkajene dan kep'],
    ]
    const petaAlias = new Map()
    for (const [kodeProv, kunciSirs, kunciResmi] of ALIAS_KABUPATEN) {
      const kode = petaKabupaten.get(`${kodeProv}|${kunciResmi}`)
      if (!kode) {
        console.log(`catatan: alias "${kunciSirs}" -> "${kunciResmi}" tidak menemukan wilayah resmi; dilewati`)
        continue
      }
      petaAlias.set(`${kodeProv}|${kunciSirs}`, kode)
    }

    console.log(`wilayah: ${provinsi.length} provinsi, ${kabupaten.length} kabupaten/kota`)

    const [rs] = await pool.query(
      `SELECT DISTINCT provinsi, kabupaten FROM fasilitas
        WHERE sumber = 'SIRS Kemenkes' AND provinsi IS NOT NULL`,
    )
    console.log(`pasangan provinsi+kabupaten di SIRS: ${rs.length}`)

    const cocokProv = new Map()
    const cocokKab = new Map()
    const gagalProv = []
    const gagalKab = []

    for (const { provinsi: namaProv, kabupaten: namaKab } of rs) {
      const np = normalNama(namaProv)
      const kodeProv = petaProvinsi.get(np)
      if (kodeProv) cocokProv.set(namaProv, kodeProv)
      else if (!gagalProv.includes(namaProv)) gagalProv.push(namaProv)

      if (!namaKab) continue
      /*
       * Urutan pencocokan, dari yang paling ketat:
       *   1. kunci berjenis  ("kabupaten|bekasi" != "kota|bekasi")
       *   2. kunci berjenis tanpa spasi ("labuhanbatu" == "labuhan batu")
       *   3. kunci tanpa jenis, hanya bila unik dalam provinsi
       *   4. alias eksplisit untuk nama yang benar-benar berbeda
       * Yang lolos ke nomor 4 sudah dilihat satu per satu, bukan hasil mirip teks.
       */
      const kj = kunciJenis(namaKab)
      const kodeKab =
        (kodeProv ? petaKabupaten.get(`${kodeProv}|${kj}`) : undefined) ??
        (kodeProv ? petaKabTanpaSpasi.get(`${kodeProv}|${kj.replace(/\s+/g, '')}`) : undefined) ??
        (kodeProv ? petaKabLuwes.get(`${kodeProv}|${normalNama(namaKab)}`) : undefined) ??
        (kodeProv ? petaAlias.get(`${kodeProv}|${kj}`) : undefined)
      if (kodeKab) cocokKab.set(`${namaProv}|${namaKab}`, kodeKab)
      else if (!gagalKab.some((g) => g.provinsi === namaProv && g.kabupaten === namaKab)) {
        gagalKab.push({ provinsi: namaProv, kabupaten: namaKab })
      }
    }

    console.log('')
    console.log(`provinsi cocok : ${cocokProv.size} dari ${new Set(rs.map((r) => r.provinsi)).size}`)
    if (gagalProv.length) console.log(`  BELUM COCOK  : ${gagalProv.join(', ')}`)
    console.log(`kabupaten cocok: ${cocokKab.size} dari ${rs.filter((r) => r.kabupaten).length}`)
    if (gagalKab.length) {
      console.log(`  BELUM COCOK  : ${gagalKab.length} kabupaten/kota`)
      for (const g of gagalKab.slice(0, 12)) console.log(`    - ${g.provinsi} / ${g.kabupaten}`)
      if (gagalKab.length > 12) console.log(`    … dan ${gagalKab.length - 12} lagi`)
    }

    if (KERING) {
      console.log('')
      console.log('mode --kering: tidak ada yang ditulis.')
      return
    }

    console.log('')
    console.log('menulis ke database…')
    let nProv = 0
    for (const [nama, kode] of cocokProv) {
      const [h] = await pool.query(
        `UPDATE fasilitas SET kode_provinsi = ?
          WHERE sumber = 'SIRS Kemenkes' AND provinsi = ?
            AND (kode_provinsi IS NULL OR kode_provinsi <> ?)`,
        [kode, nama, kode],
      )
      nProv += h.affectedRows
    }
    let nKab = 0
    for (const [kunci, kode] of cocokKab) {
      const [namaProv, namaKab] = kunci.split('|')
      const [h] = await pool.query(
        `UPDATE fasilitas SET kode_kabupaten = ?, kode_provinsi = ?
          WHERE sumber = 'SIRS Kemenkes' AND provinsi = ? AND kabupaten = ?
            AND (kode_kabupaten IS NULL OR kode_kabupaten <> ?)`,
        [kode, kode.slice(0, 2), namaProv, namaKab, kode],
      )
      nKab += h.affectedRows
    }

    const [[h]] = await pool.query(
      `SELECT COUNT(*) total,
              SUM(kode_provinsi IS NOT NULL) prov_ok,
              SUM(kode_kabupaten IS NOT NULL) kab_ok
         FROM fasilitas WHERE sumber = 'SIRS Kemenkes'`,
    )
    console.log('')
    console.log(`baris diperbarui: provinsi ${nProv}, kabupaten ${nKab}`)
    console.log(`hasil akhir: ${h.total} RS | kode provinsi ${h.prov_ok} | kode kabupaten ${h.kab_ok}`)
    if (Number(h.kab_ok) < Number(h.total)) {
      console.log(`  ${h.total - h.kab_ok} RS tidak punya kode kabupaten — nama di sumber tidak`)
      console.log('  bisa dicocokkan. Dibiarkan NULL, bukan ditebak.')
    }
  } finally {
    await pool.end()
  }
}

// Hanya jalankan main() kalau dipanggil langsung, supaya normalNama bisa diimpor uji.
if (process.argv[1] && process.argv[1].endsWith('petakan-wilayah.mjs')) {
  try {
    await main()
  } catch (e) {
    console.error('GAGAL:', e?.message ?? e)
    process.exitCode = 1
  }
}
