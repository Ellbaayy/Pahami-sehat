/**
 * Pemotongan teks pada batas yang wajar.
 *
 * KENAPA DISATUKAN
 * Dulu ada DUA fungsi bernama `potongKalimat` dengan perilaku berbeda:
 *   - server/konten.js — memotong di batas kalimat/kata, menambah "…"
 *   - server/suara.js  — memecah teks jadi daftar KALIMAT untuk dibacakan
 * Nama yang sama untuk dua tugas berbeda mudah tertukar saat dirawat. Yang
 * tugasnya memecah jadi daftar kalimat sekarang bernama `pecahKalimat`
 * (di server/suara.js), dan yang memotong teks tinggal di sini.
 *
 * FUNGSI DI SINI
 *   potongKalimat(teks, maks)  — potong di batas kalimat, atau batas kata
 *   butirDari(teks, maks)      — ambil beberapa kalimat utuh sebagai butir
 */

/**
 * Potong teks supaya tidak melewati `maks` karakter, di batas yang tidak
 * menggantung.
 *
 * Urutan pilihannya:
 *   1. Kalau muat, kembalikan apa adanya.
 *   2. Kalau ada akhir kalimat di paruh kedua, potong di situ — hasilnya utuh.
 *   3. Kalau tidak ada, mundur ke batas KATA lalu tambahkan "…".
 *
 * Langkah 3 penting: memotong di tengah kata pernah menghasilkan teks seperti
 * "…kurang disukai ba" di kartu Beranda.
 *
 * @param {string} teks
 * @param {number} maks
 * @returns {string}
 */
export function potongKalimat(teks, maks) {
  const t = String(teks ?? '').trim()
  if (t.length <= maks) return t

  const potong = t.slice(0, maks)
  const titik = Math.max(
    potong.lastIndexOf('. '),
    potong.lastIndexOf('? '),
    potong.lastIndexOf('! '),
  )
  if (titik > maks * 0.5) return potong.slice(0, titik + 1)

  const spasi = potong.lastIndexOf(' ')
  const rapi = (spasi > 0 ? potong.slice(0, spasi) : potong).replace(/[\s,;:\-–—]+$/, '')
  return `${rapi}…`
}

/**
 * Ambil kalimat-kalimat awal sebagai butir ringkas.
 *
 * Butir WAJIB diakhiri tanda baca. Kalimat sisa dari teks yang terpotong
 * (mis. "Jika aktivitas tersebut baik, tentunya p") hanya membingungkan kalau
 * ditampilkan sebagai butir.
 *
 * @param {string} teks
 * @param {number} maks jumlah butir paling banyak
 * @returns {string[]}
 */
export function butirDari(teks, maks = 3) {
  return String(teks ?? '')
    .split(/(?<=[.!?])\s+/)
    .map((s) => s.trim())
    .filter((s) => s.length > 25 && s.length < 110 && /[.!?]$/.test(s))
    .slice(0, maks)
}
