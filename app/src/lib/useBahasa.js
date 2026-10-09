/**
 * Hook bahasa antarmuka.
 *
 * Membaca pilihan bahasa dari state Pengaturan (lewat prop), lalu memberi
 * fungsi `t()` untuk menerjemahkan kunci. Juga menyetel atribut `lang` pada
 * <html> supaya pembaca layar dan pemeriksa ejaan ikut menyesuaikan.
 */

import { useEffect, useMemo } from 'react'
import { buatT, kamus, BAHASA_DEFAULT } from '../data/bahasa'

export function gunakanBahasa(bahasa = BAHASA_DEFAULT) {
  const kode = kamus(bahasa) ? bahasa : BAHASA_DEFAULT

  const t = useMemo(() => buatT(kode), [kode])

  useEffect(() => {
    if (typeof document !== 'undefined') {
      document.documentElement.lang = kode
    }
  }, [kode])

  return { kode, t, kamus: kamus(kode) }
}
