/**
 * Tingkat baca — satu sumber kebenaran untuk UI.
 *
 * Patokannya UMUR pembaca, bukan kelas sekolah. "Setara kelas 6" tidak berarti
 * apa-apa bagi orang tua atau lansia, sedangkan rentang umur bisa langsung
 * dikenali siapa pun. Pembaca Pahami Sehat juga bukan hanya pelajar.
 *
 * `kunci` adalah nilai yang dikirim ke API; `label` dan `usia` yang dilihat
 * pengguna.
 */

export const TINGKAT = [
  { kunci: 'anak', label: 'Anak-anak', usia: '9–11 tahun' },
  { kunci: 'remaja', label: 'Remaja', usia: '12–25 tahun' },
  { kunci: 'dewasa', label: 'Dewasa', usia: '26–59 tahun' },
  { kunci: 'lansia', label: 'Lansia', usia: '60 tahun ke atas' },
]

export const TINGKAT_DEFAULT = 'anak'

export const labelTingkat = (kunci) =>
  TINGKAT.find((t) => t.kunci === kunci)?.label ?? TINGKAT[0].label

/** Rentang umur sebuah tingkat — dipakai di teks bantuan dan label tombol. */
export const usiaTingkat = (kunci) =>
  TINGKAT.find((t) => t.kunci === kunci)?.usia ?? TINGKAT[0].usia

/** Verdict API → bentuk yang dipakai UI. */
export const VERDICT_NEGATIF = 'tidak_didukung'
