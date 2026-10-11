/**
 * Pembatas permintaan (rate limit) sederhana untuk endpoint yang memakan
 * biaya atau sumber daya luar.
 *
 * KENAPA PERLU
 * Endpoint seperti /api/tanya memanggil dua layanan luar sekaligus: pencarian
 * Wikipedia dan model AI berbayar. Alamat aplikasi ini terbuka untuk umum,
 * jadi tanpa pembatas siapa pun yang tahu alamatnya bisa mengirim ribuan
 * permintaan dan menghabiskan kuota akun Kenari — termasuk saat lomba
 * berlangsung.
 *
 * CARA KERJA
 * Jendela bergeser (sliding window): untuk setiap kunci disimpan daftar waktu
 * permintaan. Permintaan dihitung hanya bila masih di dalam jendela. Ini
 * dipilih daripada jendela tetap karena jendela tetap punya celah: pengguna
 * bisa mengirim 2x batas dalam sekejap di perbatasan jendela.
 *
 * BATAS YANG JUJUR DISEBUT
 * Penyimpanannya di MEMORI PROSES. Di serverless (Vercel), satu permintaan
 * bisa mendarat di instance yang berbeda, jadi batas ini bersifat
 * PER-INSTANCE, bukan global. Artinya:
 *   - Ini sudah cukup untuk menghentikan penyalahgunaan kasar (satu penyerang
 *     yang menghajar beruntun akan tertahan di instance mana pun ia mendarat).
 *   - Ini BUKAN jaminan global. Untuk batas yang benar-benar global diperlukan
 *     penyimpanan bersama (mis. Redis/Upstash). Batasnya didokumentasikan di
 *     sini supaya tidak diklaim lebih kuat daripada kenyataannya.
 *
 * Selain batas per-IP, ada juga batas TOTAL per-instance. Ini menutup celah
 * penyerang yang memutar alamat IP (mis. lewat proxy) — batas per-IP bisa
 * dilewati, batas total tidak.
 */

/** Ambil alamat IP pemanggil, dengan mempertimbangkan proxy Vercel. */
export function ipPemanggil(req) {
  const maju = req?.headers?.['x-forwarded-for']
  if (typeof maju === 'string' && maju.trim()) {
    // yang paling kiri = klien asli
    return maju.split(',')[0].trim().slice(0, 64)
  }
  const nyata = req?.headers?.['x-real-ip']
  if (typeof nyata === 'string' && nyata.trim()) return nyata.trim().slice(0, 64)
  return String(req?.socket?.remoteAddress ?? req?.ip ?? 'tidak-diketahui').slice(0, 64)
}

/**
 * Buat satu pembatas.
 *
 * @param {{ jendelaMs?: number, maks?: number, maksTotal?: number, nama?: string }} opsi
 *   jendelaMs  panjang jendela (bawaan 60 detik)
 *   maks       batas permintaan per kunci dalam satu jendela
 *   maksTotal  batas permintaan untuk SEMUA kunci per-instance (opsional)
 *   nama       dipakai di pesan galat supaya jelas bagian mana yang dibatasi
 * @returns {(req, res, next) => void} middleware Express
 */
export function batasi({ jendelaMs = 60_000, maks = 20, maksTotal = null, nama = 'permintaan' } = {}) {
  /** @type {Map<string, number[]>} kunci -> daftar waktu permintaan */
  const catatan = new Map()
  /** Waktu semua permintaan, untuk batas total per-instance. */
  let semua = []

  // bersihkan kunci yang sudah tidak aktif, supaya memori tidak tumbuh terus.
  // Dijalankan sesekali saja (bukan tiap permintaan) agar tidak membebani.
  let terakhirBersih = 0
  function bersihkan(sekarang) {
    if (sekarang - terakhirBersih < jendelaMs) return
    terakhirBersih = sekarang
    for (const [k, waktu] of catatan) {
      const sisa = waktu.filter((w) => sekarang - w < jendelaMs)
      if (!sisa.length) catatan.delete(k)
      else catatan.set(k, sisa)
    }
    semua = semua.filter((w) => sekarang - w < jendelaMs)
  }

  return function pembatas(req, res, next) {
    const sekarang = Date.now()
    bersihkan(sekarang)

    // 1) batas total per-instance (menutup celah pemutaran alamat IP)
    if (maksTotal !== null && semua.length >= maksTotal) {
      const tunggu = Math.max(1, Math.ceil((semua[0] + jendelaMs - sekarang) / 1000))
      res.set('Retry-After', String(tunggu))
      return res.status(429).json({
        ok: false,
        code: 'terlalu_sering',
        pesan: `Server sedang menerima terlalu banyak ${nama}. Coba lagi dalam ${tunggu} detik.`,
      })
    }

    // 2) batas per-IP
    const kunci = ipPemanggil(req)
    const waktu = (catatan.get(kunci) ?? []).filter((w) => sekarang - w < jendelaMs)

    if (waktu.length >= maks) {
      const tunggu = Math.max(1, Math.ceil((waktu[0] + jendelaMs - sekarang) / 1000))
      res.set('Retry-After', String(tunggu))
      return res.status(429).json({
        ok: false,
        code: 'terlalu_sering',
        pesan: `Terlalu banyak ${nama} dari alamat ini. Coba lagi dalam ${tunggu} detik.`,
      })
    }

    waktu.push(sekarang)
    catatan.set(kunci, waktu)
    if (maksTotal !== null) semua.push(sekarang)

    // beri tahu sisa kuota — membantu saat menguji dan transparan bagi pemakai
    res.set('X-Batas-Sisa', String(Math.max(0, maks - waktu.length)))
    next()
  }
}

/** Untuk pengujian: kembalikan fungsi pembatas beserta isi catatannya. */
export function _buatUntukUji(opsi) {
  return batasi(opsi)
}
