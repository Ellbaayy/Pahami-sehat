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

/**
 * Tingkat baca bawaan — untuk pengguna yang belum memilih.
 *
 * KENAPA 'dewasa' (diperbaiki 5 Nov 2026): bawaannya dulu 'anak', sehingga
 * pengguna baru langsung menerima jawaban bergaya pembaca 9–11 tahun tanpa
 * pernah memintanya. Aplikasi ini disusun untuk orang dewasa yang kesulitan
 * memahami istilah medis; merendahkan tingkat baca sebagai keadaan awal
 * membuat pertanyaan pertama terasa diremehkan. Tingkat yang lebih sederhana
 * tetap satu klik di Pengaturan.
 *
 * HARUS SAMA dengan `TINGKAT_DEFAULT` di app/server/prompts.js. Kalau kedua
 * nilai berbeda, jawaban tanpa tingkat (mis. dari curl) dan jawaban dari
 * antarmuka akan memakai gaya berbeda — dan itu baru ketahuan dari keluhan
 * pengguna, bukan dari build. Dijaga uji-batas.mjs.
 */
export const TINGKAT_DEFAULT = 'dewasa'

export const labelTingkat = (kunci) =>
  TINGKAT.find((t) => t.kunci === kunci)?.label ?? TINGKAT[0].label

/** Rentang umur sebuah tingkat — dipakai di teks bantuan dan label tombol. */
export const usiaTingkat = (kunci) =>
  TINGKAT.find((t) => t.kunci === kunci)?.usia ?? TINGKAT[0].usia

/** Verdict API → bentuk yang dipakai UI. */
export const VERDICT_NEGATIF = 'tidak_didukung'
