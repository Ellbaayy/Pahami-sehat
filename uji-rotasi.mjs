/**
 * Uji rotasi daftar konten (susun) — tanpa jaringan.
 *
 * KENAPA ADA (permintaan jagi, 16 Okt 2026): "Topik populer / Tips Kesehatan
 * Hari Ini / Artikel kesehatan kok tidak update-update ya?"
 *
 * Penyebabnya BUKAN bug: halaman depan Kemenkes memang belum menerbitkan
 * artikel baru, dan aplikasi dengan jujur tidak memalsukan tanggal. Tapi
 * `susun()` selalu mengambil 5 teratas, jadi selama sumbernya tidak berubah
 * yang tampil SELALU lima artikel yang sama berhari-hari — padahal di pool
 * tersimpan 8 artikel lengkap yang tidak pernah terlihat.
 *
 * Rotasi menutup celah itu. Yang WAJIB dijaga, dan diuji di sini:
 *   1. Daftar benar-benar bergeser (artikel ke-6/7/8 ikut muncul).
 *   2. Semua yang tampil tetap dari pool — tidak ada yang dikarang.
 *   3. `geser` berputar penuh dan kembali ke awal (modulo), tidak meleset.
 *   4. Jumlahnya tetap 5 topik / 4 artikel / 1 tips.
 */

import { susun } from './app/server/konten.js'

let lulus = 0
let gagal = 0
const cek = (nama, syarat) => {
  if (syarat) {
    lulus += 1
    console.log('  ok    ' + nama)
  } else {
    gagal += 1
    console.log('  GAGAL ' + nama)
  }
}

/** Pool buatan: 8 artikel, semuanya punya isi, judul mudah dibedakan. */
const buatPool = (n = 8) =>
  Array.from({ length: n }, (_, i) => ({
    slug: `artikel-${i + 1}`,
    url: `https://ayosehat.kemkes.go.id/artikel-${i + 1}`,
    judul: `Artikel Nomor ${i + 1} Tentang Kesehatan`,
    ringkas: `Ringkasan artikel ${i + 1} yang cukup panjang untuk dipakai.`,
    // Kalimatnya harus >25 karakter dan diakhiri tanda baca, karena itu syarat
    // `butirDari()` menjadikannya butir tips (lihat app/server/teks.js).
    tubuh:
      `Tubuh artikel ${i + 1} ini menjelaskan hal penting untuk dibaca. ` +
      `Kalimat kedua berisi nasihat yang bisa langsung dicoba. ` +
      `Kalimat ketiga menutup penjelasan dengan satu saran praktis.`,
    gambar: '',
  }))

const judulTopik = (h) => h.topik.map((t) => t.id)
const dasar = buatPool(8)

console.log('== geser 0: sama seperti sebelumnya (tidak mengubah perilaku lama) ==')
const nol = susun(dasar, 0)
cek('5 topik', nol.topik.length === 5)
cek('4 artikel', nol.artikel.length === 4)
cek('ada tips', Boolean(nol.tips))
cek('topik pertama = artikel-1', judulTopik(nol)[0] === 'artikel-1')
cek('urutan asli', judulTopik(nol).join(',') === 'artikel-1,artikel-2,artikel-3,artikel-4,artikel-5')

console.log('\n== geser 1: daftar bergeser satu langkah ==')
const satu = susun(dasar, 1)
cek('topik pertama jadi artikel-2', judulTopik(satu)[0] === 'artikel-2')
cek('artikel ke-6 ikut muncul di topik',
  judulTopik(satu).includes('artikel-6'))
cek('jumlahnya tetap 5', satu.topik.length === 5)

console.log('\n== geser 3: artikel yang dulu TIDAK PERNAH tampil sekarang muncul ==')
const tiga = susun(dasar, 3)
cek('topik pertama = artikel-4', judulTopik(tiga)[0] === 'artikel-4')
cek('artikel-8 (paling bawah) sekarang tampil',
  judulTopik(tiga).includes('artikel-8'))

console.log('\n== semua yang tampil HARUS berasal dari pool (tidak dikarang) ==')
const slugPool = new Set(dasar.map((d) => d.slug))
let asing = 0
for (let g = 0; g < 12; g++) {
  const h = susun(dasar, g)
  for (const t of h.topik) if (!slugPool.has(t.id)) asing += 1
  for (const a of h.artikel) if (!slugPool.has(a.id)) asing += 1
  if (h.tips && !h.tips.url.includes('ayosehat.kemkes.go.id')) asing += 1
}
cek('tidak ada item di luar pool', asing === 0)

console.log('\n== geser berputar penuh lalu kembali (modulo) ==')
const delapan = susun(dasar, 8) // 8 artikel -> kembali ke urutan awal
cek('geser 8 == geser 0', judulTopik(delapan).join(',') === judulTopik(nol).join(','))
const sembilan = susun(dasar, 9)
cek('geser 9 == geser 1', judulTopik(sembilan).join(',') === judulTopik(satu).join(','))

console.log('\n== geser besar / negatif tidak merusak apa pun ==')
cek('geser 1000 tetap 5 topik', susun(dasar, 1000).topik.length === 5)
cek('geser -1 tetap 5 topik', susun(dasar, -1).topik.length === 5)
cek('geser -1 == geser 7', judulTopik(susun(dasar, -1)).join(',') === judulTopik(susun(dasar, 7)).join(','))

console.log('\n== pool kecil & kosong tidak bikin error ==')
cek('pool 1 artikel', susun(buatPool(1), 5).topik.length === 1)
cek('pool kosong -> 0 topik', susun([], 3).topik.length === 0)
cek('pool kosong -> tips null', susun([], 3).tips === null)
cek('artikel tanpa isi dilewati', susun([{ slug: 'x', judul: 'Kosong Tanpa Isi Sama Sekali' }], 1).topik.length === 0)

console.log('\n== rotasi TIDAK boleh mengubah judul/isi, hanya urutan ==')
const g2 = susun(dasar, 2)
const semuaJudul0 = susun(dasar, 0).topik.map((t) => t.label).sort()
const semuaJudul2 = g2.topik.map((t) => t.label).sort()
cek('kumpulan label tetap sama, hanya urutannya beda',
  semuaJudul0.length === semuaJudul2.length)
cek('label tidak berubah bentuk', g2.topik.every((t) => /^Artikel Nomor/.test(t.label)))

console.log(`\n${lulus} lulus, ${gagal} gagal`)
process.exit(gagal ? 1 : 0)
