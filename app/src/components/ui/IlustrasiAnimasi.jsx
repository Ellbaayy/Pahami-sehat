import { useEffect, useState } from 'react'

import sapaanWebp from '../../assets/ilustrasi/sapaan.webp'
import sapaanDiam from '../../assets/ilustrasi/sapaan.png'
import kosongWebp from '../../assets/ilustrasi/kosong.webp'
import kosongDiam from '../../assets/ilustrasi/kosong.png'

/**
 * Ilustrasi karakter yang bergerak.
 *
 * Dua alasan kenapa tidak memakai pustaka Lottie di peramban:
 *   1. Pustaka itu menambah ~80 KB ke unduhan awal. Aplikasi ini justru punya
 *      fitur "mode hemat sinyal", jadi berat ekstra terasa bertolak belakang.
 *   2. Animasi Lottie tidak bisa dijeda, sedangkan produk ini menonjolkan
 *      aksesibilitas pada `prefers-reduced-motion`.
 *
 * Sebagai gantinya, animasinya sudah dirender lebih dulu dan disimpan sebagai
 * WebP animasi (transparan, looping, 60-110 KB). Kalau pengguna memilih
 * "kurangi gerak", yang ditampilkan hanyalah bingkai diamnya.
 *
 * Sumber animasi: LottieFiles, gratis di bawah Lottie Simple License
 * (boleh komersial, atribusi tidak wajib tetapi kami cantumkan di footer).
 */

const ASET = {
  sapaan: { webp: sapaanWebp, diam: sapaanDiam, lebar: 360, tinggi: 240 },
  kosong: { webp: kosongWebp, diam: kosongDiam, lebar: 220, tinggi: 220 },
}

function bacaKurangiGerak() {
  if (typeof window === 'undefined' || !window.matchMedia) return false
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches
}

/** Dampingkan preferensi pengguna atas gerak, termasuk saat berubah di tengah jalan. */
export function useKurangiGerak() {
  const [kurang, setKurang] = useState(bacaKurangiGerak)

  useEffect(() => {
    if (!window.matchMedia) return
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)')
    const onUbah = (e) => setKurang(e.matches)
    mq.addEventListener('change', onUbah)
    return () => mq.removeEventListener('change', onUbah)
  }, [])

  return kurang
}

/**
 * @param {'sapaan'|'kosong'} nama - nama ilustrasi
 */
export default function IlustrasiAnimasi({ nama, className = '' }) {
  const aset = ASET[nama]
  const kurang = useKurangiGerak()
  if (!aset) return null

  return (
    <img
      src={kurang ? aset.diam : aset.webp}
      alt=""
      width={aset.lebar}
      height={aset.tinggi}
      className={`select-none ${className}`}
      decoding="async"
      draggable={false}
    />
  )
}