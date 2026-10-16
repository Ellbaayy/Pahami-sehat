/**
 * Jam acuan untuk penjadwalan "sekali sehari".
 *
 * KENAPA PAKAI JAM INTERNET (permintaan jagi, 16 Okt 2026): jadwal penyegaran
 * dulu memakai jam mesin (`Date.now()`). Jam mesin bisa meleset, dan di
 * serverless setiap instance bisa punya jam berbeda — akibatnya pengecekan
 * bisa terjadi dua kali sehari atau justru terlewat.
 *
 * Karena setiap penyegaran TOH sudah menghubungi internet, sekalian jamnya
 * diambil dari sana. Caranya GRATIS — tidak ada permintaan tambahan: header
 * `Date` dari respons yang sudah kita terima dipakai sebagai titik acuan, lalu
 * dimajukan dengan jam mesin yang berjalan sejak respons itu diterima. Jadi
 * ketelitiannya tidak bergantung pada ketepatan jam mesin, hanya pada selang
 * waktu sesudahnya.
 *
 * Modul ini dipakai bersama oleh `konten.js` dan `berita.js` supaya keduanya
 * memakai acuan waktu yang sama, bukan dua perhitungan terpisah.
 */

let jamServerMs = 0 // jam internet (ms) saat respons terakhir diterima
let jamServerDiterima = 0 // Date.now() pada saat itu
let selisihJamMs = 0 // internet - mesin, untuk dilaporkan

/** Batas tahun yang masih masuk akal untuk header `Date`. */
const TAHUN_MIN = Date.UTC(2020, 0, 1)
const TAHUN_MAKS = Date.UTC(2100, 0, 1)

/**
 * Simpan jam server dari header `Date` sebuah respons.
 *
 * Tidak pernah melempar — header yang aneh tidak boleh mengganggu pengambilan
 * konten. Nilai di luar batas tahun diabaikan supaya jam ngawur tidak merusak
 * jadwal.
 */
export function catatJamServer(res) {
  try {
    const h = res?.headers?.get?.('date')
    if (!h) return
    const ms = Date.parse(h)
    if (!Number.isFinite(ms) || ms < TAHUN_MIN || ms > TAHUN_MAKS) return
    jamServerMs = ms
    jamServerDiterima = Date.now()
    selisihJamMs = ms - jamServerDiterima
  } catch {
    /* header aneh tidak boleh mengganggu */
  }
}

/** Waktu sekarang: jam internet kalau sudah terbaca, kalau belum jam mesin. */
export function jamSekarang() {
  if (jamServerMs && jamServerDiterima) return jamServerMs + (Date.now() - jamServerDiterima)
  return Date.now()
}

/** Selisih jam internet vs jam mesin (ms). 0 kalau belum pernah terbaca. */
export function selisihJam() {
  return selisihJamMs
}

/**
 * Apakah jam internet sudah pernah terbaca?
 *
 * Dipisah dari `selisihJam()` karena selisih 0 berarti DUA hal yang berbeda:
 * "jam mesin kebetulan sama persis" dan "belum pernah terbaca sama sekali".
 * Tanpa penanda ini, laporan status tidak bisa membedakan keduanya.
 */
export function jamInternetTerbaca() {
  return Boolean(jamServerMs && jamServerDiterima)
}

/**
 * Bungkus `fetch` supaya setiap respons otomatis memperbarui jam acuan.
 * Dipakai modul yang ingin ikut memakai jam internet tanpa mengubah setiap
 * pemanggilan `fetch` satu per satu.
 */
export async function fetchJam(url, opsi) {
  const res = await fetch(url, opsi)
  catatJamServer(res)
  return res
}
