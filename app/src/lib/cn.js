import { twMerge } from 'tailwind-merge'

/**
 * Gabungkan kelas Tailwind.
 *
 * Kelas yang datang TERAKHIR menang saat bentrok (`p-4` + `p-2` → `p-2`).
 * Tanpa ini, prop `className` pada komponen kadang tidak berpengaruh: dua
 * kelas hidup berdampingan dan CSS yang menentukan pemenangnya, bukan kode.
 */
export function cn(...parts) {
  return twMerge(parts.filter(Boolean).join(' '))
}
