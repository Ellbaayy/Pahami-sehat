/**
 * Mengukur keterbacaan teks Indonesia — dipakai untuk MEMBUKTIKAN bahwa
 * jawaban benar-benar berbeda antar tingkat pembaca, bukan hanya diklaim.
 *
 * KENAPA PERLU
 * Sebelum ini, "sudah disesuaikan tingkat baca" hanya bisa dipercaya dari
 * perintah di prompt. Tidak ada satu pun angka yang bisa dibandingkan, jadi
 * tidak mungkin menjawab pertanyaan "apakah jawaban untuk anak-anak memang
 * lebih mudah daripada untuk dewasa?". Skrip latih memakai modul ini untuk
 * mengukur, bukan menebak.
 *
 * JUJUR SOAL ANGKANYA
 * Rumus keterbacaan bahasa Inggris (Flesch, Gunning Fog) TIDAK punya padanan
 * resmi untuk bahasa Indonesia. Karena itu modul ini TIDAK mengklaim angka
 * "kelas baca" yang seolah-olah baku. Yang dihitung adalah besaran yang
 * benar-benar terukur dan bisa dibandingkan.
 *
 * Menghitung suku kata Indonesia: hitung gugus vokal yang berurutan.
 * "hi-per-ten-si" -> 4, "se-hat" -> 2, "baik" -> 1. Diftong ("ai" pada
 * "pantai", "au" pada "pisau") terhitung satu gugus, dan itu memang benar.
 *
 * ==========================================================================
 * TEMUAN PENTING 14 OKT 2026 — PANJANG KATA BUKAN PEMBEDA YANG BISA DIPAKAI
 * ==========================================================================
 * Awalnya panjang kata dipakai sebagai GERBANG: jawaban dinilai gagal kalau
 * persentase kata panjangnya melewati batas tingkatnya. Itu KELIRU, dan
 * salahnya baru ketahuan setelah diperiksa satu per satu:
 *
 * 1. Kata yang paling sering dicap "sulit" ternyata kata sehari-hari:
 *    adalah, karena, latihan, tekanan, artinya, membantu, dimulai, biasanya.
 *    Semuanya 3 suku kata karena hitungan gugus vokal ("a-da-lah"), dan
 *    TIDAK ADA yang sulit bagi pembaca Indonesia mana pun.
 *
 * 2. Diukur terhadap 5 ringkasan artikel Wikipedia Indonesia sebagai lantai
 *    normal prosa Indonesia: kata >=3 suku kata 31–46%, kata >=4 suku kata
 *    9,5–15,6%. Jadi 30–46% itu NORMAL, bukan tanda tulisan yang berat.
 *
 * 3. Yang menentukan: urutan antar tingkat TIDAK konsisten per pertanyaan.
 *    Dengan kata >=4 suku kata, urutan benar di 1 dari 8 pertanyaan. Dengan
 *    >=3 suku kata, juga 1 dari 8. Nilai agregat memang tampak urut, tapi itu
 *    rata-rata yang menyembunyikan urutan yang kacau di dalamnya.
 *
 * KESIMPULANNYA: panjang kata tetap DIUKUR dan DILAPORKAN sebagai penunjuk
 * tren, tetapi TIDAK dipakai untuk menggagalkan jawaban. Yang dipakai sebagai
 * gerbang hanya ukuran panjang kalimat (`asl` dan `kalimatTerpanjang`), karena
 * untuk ukuran itu tangganya memang terbukti benar dan pemeriksaannya masuk
 * akal. Jangan kembalikan panjang kata menjadi gerbang tanpa mengukur ulang
 * urutannya per pertanyaan.
 *
 * Catatan: menyederhanakan kata tetap berguna sebagai USAHA (lihat aturan
 * prompt tingkat). Yang dibuang bukan usahanya, melainkan penilaiannya.
 */

const VOKAL = 'aiueo'

/** Jumlah suku kata satu kata (perkiraan berdasarkan gugus vokal). */
export function sukuKata(kata) {
  const k = String(kata ?? '')
    .toLowerCase()
    .replace(/[^a-z]/g, '')
  if (!k) return 0
  let n = 0
  let vokalSebelumnya = false
  for (const c of k) {
    const v = VOKAL.includes(c)
    if (v && !vokalSebelumnya) n++
    vokalSebelumnya = v
  }
  return Math.max(1, n)
}

/**
 * Pecah teks jadi kalimat yang benar-benar berisi.
 *
 * KENAPA TIDAK CUKUP MEMECAH DI [.!?]
 * Diukur 14 Okt 2026: satu jawaban tingkat dewasa dilaporkan punya "kalimat"
 * sepanjang 56 kata. Setelah diperiksa, itu ternyata DAFTAR BERBUTIR — model
 * menulis langkah-langkah tanpa titik di ujung setiap butir, sehingga seluruh
 * daftar terbaca sebagai satu kalimat. Itu positif palsu: daftar berbutir
 * justru cara menyampaikan yang MUDAH diikuti, bukan kalimat panjang.
 *
 * Karena itu teks dipecah LEBIH DULU di: baris baru, tanda pisah butir
 * (•, -, *, –), dan penomoran di awal baris ("1.", "2)"). Sesudah itu baru
 * dipecah di tanda baca akhir kalimat.
 */
export function daftarKalimat(teks) {
  return String(teks ?? '')
    .replace(/\r\n?/g, '\n')
    // penomoran/butir di awal baris -> jadi batas kalimat
    .replace(/^[ \t]*(?:[•*–-]|\d+[.)])[ \t]+/gm, '\n')
    // baris baru = batas kalimat (daftar berbutir sering tanpa titik)
    .replace(/\n+/g, '. ')
    .replace(/\s+/g, ' ')
    .split(/(?<=[.!?])\s+/)
    .map((s) => s.trim())
    .filter((s) => /[a-zA-Z]/.test(s))
}

/** Pecah teks jadi kata (hanya yang mengandung huruf). */
export function daftarKata(teks) {
  return String(teks ?? '')
    .split(/\s+/)
    .map((w) => w.replace(/^[^a-zA-Z]+|[^a-zA-Z]+$/g, ''))
    .filter((w) => /[a-zA-Z]/.test(w))
}

/**
 * Ukur keterbacaan sebuah teks.
 *
 * @param {string} teks
 * @returns {{
 *   kalimat: number, kata: number, sukuKata: number,
 *   asl: number, asw: number, persenKataSulit: number,
 *   persenKataSangatPanjang: number, kalimatTerpanjang: number
 * }}
 */
export function ukurKeterbacaan(teks) {
  const kalimat = daftarKalimat(teks)
  const kata = daftarKata(teks)
  const nKalimat = Math.max(1, kalimat.length)
  const nKata = kata.length

  if (!nKata) {
    return {
      kalimat: 0, kata: 0, sukuKata: 0,
      asl: 0, asw: 0, persenKataSulit: 0,
      persenKataSangatPanjang: 0, kalimatTerpanjang: 0,
    }
  }

  const suku = kata.reduce((t, k) => t + sukuKata(k), 0)
  const sulit = kata.filter((k) => sukuKata(k) >= 3).length
  const sangatPanjang = kata.filter((k) => sukuKata(k) >= 4).length
  const asl = nKata / nKalimat
  const asw = suku / nKata

  return {
    kalimat: kalimat.length,
    kata: nKata,
    sukuKata: suku,
    asl: Number(asl.toFixed(2)),
    asw: Number(asw.toFixed(2)),
    // kedua ukuran panjang kata ini HANYA untuk tren — lihat catatan di kepala berkas
    persenKataSulit: Number(((sulit / nKata) * 100).toFixed(1)),
    persenKataSangatPanjang: Number(((sangatPanjang / nKata) * 100).toFixed(1)),
    kalimatTerpanjang: kalimatTerpanjangSah(kalimat),
  }
}

/**
 * Kalimat terpanjang, dengan KEPALA DAFTAR dikecualikan.
 *
 * KENAPA PERLU: diukur 14 Okt 2026, satu jawaban dewasa dilaporkan punya
 * "kalimat" 45 kata. Setelah jawabannya diminta ulang dan dibaca utuh,
 * kalimat terpanjang yang sebenarnya hanya 23 kata. Yang 45 itu adalah
 * KEPALA DAFTAR:
 *
 *   "Cuci tangan pada waktu-waktu penting: sebelum, selama, dan setelah
 *    menyiapkan makanan. Sebelum makan. Sebelum dan sesudah merawat orang
 *    sakit di rumah. Setelah dari toilet. ..."
 *
 * Model menulis daftar sebagai kalimat pendek berurutan setelah titik dua,
 * dan pemeriksa kalimat yang naif menggabungkannya kembali menjadi satu
 * kalimat raksasa. Itu positif palsu: kepala daftar yang diikuti butir-butir
 * pendek justru cara menyampaikan yang MUDAH diikuti.
 *
 * ATURANNYA: sebuah kalimat dianggap kepala daftar bila (a) memuat tanda titik
 * dua, DAN (b) diikuti sekurang-kurangnya 3 kalimat pendek (maksimal 8 kata).
 * Dua syarat itu dipakai bersama supaya kalimat biasa yang kebetulan memuat
 * titik dua — mis. "Tanda bahaya yang perlu diwaspadai: jika ... demam, segera
 * ke tenaga kesehatan." — TETAP dihitung panjangnya, karena sesudahnya bukan
 * butir-butir pendek.
 */
function kalimatTerpanjangSah(kalimat) {
  const pendek = (s) => daftarKata(s).length <= 8
  let terpanjang = 0
  for (let i = 0; i < kalimat.length; i++) {
    const s = kalimat[i]
    const sesudahnya = kalimat.slice(i + 1, i + 4)
    const kepalaDaftar =
      s.includes(':') && sesudahnya.length === 3 && sesudahnya.every(pendek)
    if (kepalaDaftar) continue
    terpanjang = Math.max(terpanjang, daftarKata(s).length)
  }
  return terpanjang
}

/**
 * Sasaran keterbacaan per tingkat pembaca.
 *
 * INI SASARAN INTERNAL, BUKAN ANGKA BAKU. Batasnya DIKALIBRASI dari hasil
 * pengukuran nyata (lihat docs/latih-tingkat-*.json dan ukur-kalibrasi.mjs).
 *
 * HANYA `aslMaks` DAN `kalimatTerpanjangMaks` YANG MENGGAGALKAN.
 * `aswMaks`, `sulitMaks`, dan `sangatPanjangMaks` hanya dilaporkan sebagai
 * tren — alasannya ada di catatan panjang di kepala berkas ini. Jangan
 * mengubahnya menjadi gerbang tanpa mengukur urutan per pertanyaan lebih dulu.
 */
export const SASARAN = {
  anak: {
    aslMaks: 7,
    aswMaks: 2.29,
    sulitMaks: 28,
    kalimatTerpanjangMaks: 11,
    sangatPanjangMaks: 5
  },
  lansia: {
    aslMaks: 8,
    aswMaks: 2.54,
    sulitMaks: 43,
    kalimatTerpanjangMaks: 12,
    sangatPanjangMaks: 10
  },
  remaja: {
    aslMaks: 9,
    aswMaks: 2.47,
    sulitMaks: 39,
    kalimatTerpanjangMaks: 14,
    sangatPanjangMaks: 10
  },
  dewasa: {
    aslMaks: 12,
    aswMaks: 2.59,
    sulitMaks: 46,
    kalimatTerpanjangMaks: 23,
    sangatPanjangMaks: 13
  }
}





/** Ukuran yang dipakai untuk MENGGAGALKAN jawaban. */
export const UKURAN_GERBANG = ['aslMaks', 'kalimatTerpanjangMaks']

/**
 * Periksa satu hasil ukur terhadap sasaran tingkatnya.
 *
 * @param {string} tingkat
 * @param {ReturnType<typeof ukurKeterbacaan>} ukur
 * @returns {{lolos: boolean, pelanggaran: string[], tren: string[]}}
 */
export function periksaSasaran(tingkat, ukur) {
  const s = SASARAN[tingkat]
  if (!s) return { lolos: true, pelanggaran: [], tren: [] }
  const pelanggaran = []
  const tren = []

  // --- gerbang: panjang kalimat ---
  if (ukur.asl > s.aslMaks) pelanggaran.push(`kata/kalimat ${ukur.asl} > ${s.aslMaks}`)
  if (ukur.kalimatTerpanjang > s.kalimatTerpanjangMaks) {
    pelanggaran.push(`kalimat terpanjang ${ukur.kalimatTerpanjang} kata > ${s.kalimatTerpanjangMaks}`)
  }

  // --- tren saja: panjang kata ---
  if (ukur.asw > s.aswMaks) tren.push(`suku/kata ${ukur.asw} > ${s.aswMaks}`)
  if (ukur.persenKataSulit > s.sulitMaks) tren.push(`kata >=3 suku ${ukur.persenKataSulit}% > ${s.sulitMaks}%`)
  if (ukur.persenKataSangatPanjang > s.sangatPanjangMaks) {
    tren.push(`kata >=4 suku ${ukur.persenKataSangatPanjang}% > ${s.sangatPanjangMaks}%`)
  }

  return { lolos: pelanggaran.length === 0, pelanggaran, tren }
}
