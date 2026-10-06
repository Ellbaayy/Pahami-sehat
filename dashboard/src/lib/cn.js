/** Gabungkan string class conditional — alih-alih dependensi cnxs. */
export function cn(...parts) {
  return parts.filter(Boolean).join(' ')
}
