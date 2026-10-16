#!/usr/bin/env node
/**
 * uji-sitasi.mjs — membuktikan klaim "jawaban ini bersumber dari X" bisa DILACAK.
 *
 * KENAPA SKRIP INI ADA
 * Sebelumnya tabel `dokumen` dan `sitasi` ada di skema tapi SELALU KOSONG:
 * tidak ada kode yang mengisinya. Jadi klaim sumber hanya *ditulis* di layar,
 * tidak bisa diperiksa. Skrip ini memastikan pengisiannya benar-benar terjadi.
 *
 * DUA JENIS UJI, dan bedanya penting:
 *
 *   1. UJI MURNI (tanpa jaringan, tanpa database) — menguji aturan yang bisa
 *      diperiksa dari kode: URL non-http(s) harus DITOLAK, dan pemanggilan
 *      tanpa database harus mengembalikan 0/nol, bukan melempar.
 *
 *   2. UJI TERHUBUNG (butuh MariaDB) — menguji bahwa setelah jawaban sungguhan
 *      dibuat, barisnya benar-benar masuk ke tabel. Bagian ini DILEWATI dengan
 *      pesan jelas kalau database mati, bukan gagal — karena database memang
 *      opsional, dan CI tidak boleh merah hanya karena itu.
 *
 * Cara pakai:
 *   node uji-sitasi.mjs                 # semua uji
 *   DB_MATI=1 node uji-sitasi.mjs       # buktikan jalur tanpa database aman
 */

import { catatDokumen, catatSumberDikutip, catatSitasi, dbSiap, tutupDb, tanya } from './app/server/db.js'

let lulus = 0
let gagal = 0
let dilewati = 0

function cek(nama, dapat, harap) {
  const ok = JSON.stringify(dapat) === JSON.stringify(harap)
  if (ok) {
    lulus++
    console.log(`  ok    ${nama}`)
  } else {
    gagal++
    console.log(`  GAGAL ${nama}`)
    console.log(`        harap: ${JSON.stringify(harap)}`)
    console.log(`        dapat: ${JSON.stringify(dapat)}`)
  }
}

console.log('\n=== UJI MURNI: aturan yang tidak butuh jaringan/database ===')

// URL non-http(s) TIDAK boleh dicatat — sama seperti penyaring di bentukHasil().
// Tanpa ini, model bisa menyelipkan javascript: atau data: ke dalam tabel.
cek('javascript: ditolak', await catatSumberDikutip('tanya', [{ url: 'javascript:alert(1)' }]), 0)
cek('data: ditolak', await catatSumberDikutip('tanya', [{ url: 'data:text/html,x' }]), 0)
cek('url kosong ditolak', await catatSumberDikutip('tanya', [{ url: '' }]), 0)
cek('tanpa url ditolak', await catatSumberDikutip('tanya', [{ judul: 'Tanpa URL' }]), 0)
cek('daftar kosong -> 0', await catatSumberDikutip('tanya', []), 0)
cek('bukan array -> 0', await catatSumberDikutip('tanya', null), 0)

// catatDokumen tanpa URL harus null, bukan melempar
cek('catatDokumen tanpa url -> null', await catatDokumen({}), null)

const siap = await dbSiap()
console.log(`\n=== database: ${siap ? 'TERSAMBUNG' : 'TIDAK TERSAMBUNG'} ===`)

if (!siap) {
  dilewati++
  console.log('  (uji terhubung DILEWATI — database opsional, bukan kegagalan)')
  console.log('  Nyalakan untuk menguji penuh: sudo /opt/lampp/lampp startmysql')
} else {
  console.log('\n=== UJI TERHUBUNG: barisnya benar-benar masuk? ===')

  const urlUji = `https://uji-sitasi.example/halaman-${Date.now()}`

  // 1. catat dokumen baru
  const id1 = await catatDokumen({ url: urlUji, judul: 'Uji Sitasi', domain: 'uji-sitasi.example' })
  cek('catatDokumen mengembalikan id', typeof id1 === 'number' && id1 > 0, true)

  // 2. ANTI-DUPLIKAT: URL yang sama tidak boleh menambah baris
  const id2 = await catatDokumen({ url: urlUji, judul: 'Uji Sitasi Lagi', domain: 'uji-sitasi.example' })
  cek('URL sama -> id SAMA (tidak dobel)', id2, id1)

  const hitung = await tanya('SELECT COUNT(*) AS n FROM dokumen WHERE url = ?', [urlUji])
  cek('hanya 1 baris untuk URL itu', hitung?.[0]?.n, 1)

  // 3. judul diperbarui, bukan dibiarkan kosong
  const judul = await tanya('SELECT judul FROM dokumen WHERE id = ?', [id1])
  cek('judul terbaru tersimpan', judul?.[0]?.judul, 'Uji Sitasi Lagi')

  // 4. sitasi tercatat dan bisa dilacak balik ke sumbernya
  await catatSitasi('tanya', id1, null)
  const lacak = await tanya(
    `SELECT s.jenis_jawaban, d.url, src.domain
       FROM sitasi s
       JOIN dokumen d   ON d.id = s.dokumen_id
       JOIN sumber  src ON src.id = d.sumber_id
      WHERE d.id = ? ORDER BY s.id DESC LIMIT 1`,
    [id1],
  )
  cek('sitasi bisa dilacak ke dokumennya', lacak?.[0]?.url, urlUji)
  cek('jenis jawaban tercatat', lacak?.[0]?.jenis_jawaban, 'tanya')

  // 5. kedaluwarsa WAJIB terisi — baris tanpa kedaluwarsa tidak boleh tersaji
  const berlaku = await tanya('SELECT COUNT(*) AS n FROM dokumen WHERE url = ? AND kedaluwarsa > NOW()', [urlUji])
  cek('dokumen baru masih berlaku', berlaku?.[0]?.n, 1)

  // 6. kedaluwarsa benar-benar menyaring: dibuat basi -> tidak lagi tersaji
  await tanya('UPDATE dokumen SET kedaluwarsa = DATE_SUB(NOW(), INTERVAL 1 DAY) WHERE id = ?', [id1])
  const basi = await tanya('SELECT COUNT(*) AS n FROM dokumen WHERE url = ? AND kedaluwarsa > NOW()', [urlUji])
  cek('setelah basi -> tidak tersaji', basi?.[0]?.n, 0)

  // bersihkan baris uji supaya tabel tidak kotor
  await tanya('DELETE FROM sitasi WHERE dokumen_id = ?', [id1])
  await tanya('DELETE FROM dokumen WHERE id = ?', [id1])
  await tanya('DELETE FROM sumber WHERE domain = ? AND resmi = 0', ['uji-sitasi.example'])
  console.log('  (baris uji dibersihkan)')
}

await tutupDb()

console.log('\n=== RINGKASAN ===')
console.log(`lulus    : ${lulus}`)
console.log(`gagal    : ${gagal}`)
if (dilewati) console.log(`dilewati : ${dilewati} bagian (database tidak tersambung)`)
process.exit(gagal ? 1 : 0)
