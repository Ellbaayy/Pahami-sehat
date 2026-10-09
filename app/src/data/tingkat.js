/**
 * Tingkat baca — satu sumber kebenaran untuk UI.
 * `kunci` adalah nilai yang dikirim ke API; `label` yang dilihat pengguna.
 */

export const TINGKAT = [
  { kunci: 'anak', label: 'Anak-anak', targetKelas: 6 },
  { kunci: 'remaja', label: 'Remaja', targetKelas: 9 },
  { kunci: 'dewasa', label: 'Dewasa', targetKelas: 12 },
  { kunci: 'lansia', label: 'Lansia', targetKelas: 8 },
]

export const TINGKAT_DEFAULT = 'anak'

export const labelTingkat = (kunci) =>
  TINGKAT.find((t) => t.kunci === kunci)?.label ?? TINGKAT[0].label

/** Verdict API → bentuk yang dipakai UI. */
export const VERDICT_NEGATIF = 'tidak_didukung'
