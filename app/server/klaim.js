/**
 * Pemeriksa klaim prognosis — DETERMINISTIK, tanpa model.
 *
 * ============================================================================
 * KENAPA BERKAS INI ADA
 * ============================================================================
 *
 * Diukur 22 Okt 2026: model menulis "banyak orang dengan satu ginjal tetap
 * hidup normal" padahal tidak satu pun sumber memuat pernyataan itu — lalu ia
 * MENYEBUTKANNYA di `catatan` seolah sudah jujur. Pembaca tetap mempercayai
 * kalimatnya. Aturan prompt sudah ditulis tegas ("KLAIM TANPA SUMBER TIDAK
 * BOLEH MASUK JAWABAN"), tetapi aturan prompt TIDAK BISA DIPERCAYA sebagai
 * pengaman: putaran berikutnya dengan pertanyaan yang sama melanggar lagi.
 *
 * ============================================================================
 * BATAS KEMAMPUAN YANG DIAKUI TERBUKA — INI YANG PALING PENTING
 * ============================================================================
 *
 * Percobaan pertama di berkas ini mencoba MEMBANDINGKAN KATA jawaban dengan
 * kata sumber. Itu GAGAL dan sudah dibuang, karena sumber MedlinePlus
 * berbahasa INGGRIS sedangkan jawaban berbahasa INDONESIA: "penyakit ginjal
 * kronis" tidak akan pernah bertemu "chronic kidney disease". Akibatnya
 * kalimat yang BENAR ikut terbuang. Positif palsu seperti itu LEBIH MERUGIKAN
 * daripada tidak ada penyaring sama sekali — pengguna kehilangan informasi
 * yang sah tanpa tahu sebabnya.
 *
 * Karena itu berkas ini TIDAK mencoba memeriksa semua klaim. Ia hanya menangani
 * SATU kelas klaim yang:
 *   (a) sudah TERBUKTI salah dalam pengukuran, dan
 *   (b) bisa diperiksa dengan andal tanpa mencocokkan kata lintas bahasa.
 *
 * Kelas itu: KLAIM PROGNOSIS — pernyataan tentang harapan hidup, bisa/tidaknya
 * hidup normal, atau aman/tidaknya suatu keadaan. Untuk kelas ini pemeriksaannya
 * tidak bergantung pada nama penyakitnya, melainkan pada satu pertanyaan:
 *
 *     Apakah sumber pada giliran ini MEMBICARAKAN prognosis sama sekali?
 *
 * Kalau sumber tidak pernah membahas harapan hidup / bertahan hidup / hidup
 * normal, maka kalimat prognosis apa pun TIDAK punya dasar — dalam bahasa apa
 * pun. Pemeriksaan ini tidak perlu tahu bahasa sumbernya.
 *
 * Klaim lain (definisi, gejala, penanganan) TIDAK disentuh. Untuk itu, aturan
 * prompt + daftar sumber yang ditampilkan tetap menjadi pertahanannya, dan
 * keterbatasannya disebut apa adanya di README.
 */

/**
 * Kalimat yang menyatakan PROGNOSIS — harapan hidup, bisa hidup normal,
 * atau aman/tidaknya suatu keadaan.
 *
 * Sengaja sempit. Menambah pola di sini berarti memperbesar kemungkinan
 * kalimat yang sebenarnya sah ikut terbuang.
 */
const POLA_PROGNOSIS = [
  // hidup / bertahan / harapan hidup
  /\b(?:tetap|masih|bisa|akan)\s+(?:bisa\s+)?hidup\b/i,
  /\bhidup\s+(?:normal|sehat|wajar|lama|panjang|berkualitas)\b/i,
  /\b(?:harapan|angka)\s+hidup\b/i,
  /\bbertahan\s+(?:hidup|lama)\b/i,
  /\blife\s+expectancy\b/i,
  // aman / tidak berbahaya bagi sekelompok orang
  /\b(?:aman|tidak berbahaya|tidak bermasalah)\s+(?:untuk|bagi)\b/i,
  /\b(?:banyak|kebanyakan|sebagian besar)\s+orang\b/i,
  /\b(?:tidak|nggak)\s+(?:akan\s+)?(?:bertahan|bermasalah|berpengaruh|berbahaya)\b/i,
  /\b(?:prognosis|kesembuhan|umur panjang)\b/i,
]

/**
 * Kata yang menandakan SUMBER MEMANG MEMBAHAS prognosis.
 *
 * Dicampur Indonesia + Inggris dengan sengaja: sumber bisa dari Wikipedia
 * Indonesia, MedlinePlus (Inggris), atau pengetahuan tersimpan. Kalau salah
 * satu kata ini muncul, sumber dianggap membahas prognosis, dan TIDAK ADA
 * kalimat yang dibuang. Arah kelonggaran ini disengaja: lebih baik membiarkan
 * satu klaim lemah daripada membuang klaim yang sah.
 */
const SUMBER_BAHAS_PROGNOSIS = [
  'harapan hidup', 'angka hidup', 'bertahan hidup', 'hidup normal', 'hidup lama',
  'prognosis', 'kesembuhan', 'umur panjang', 'jangka panjang',
  'life expectancy', 'survival', 'prognosis', 'live a normal', 'normal life',
  'long-term outlook', 'outlook',
]

/** Kalimat yang TIDAK PERNAH disentuh, walau berbentuk prognosis. */
const JANGAN_SENTUH = [
  /\bsumber\b/i,
  /\bhasil pencarian\b/i,
  /\btidak (?:ada|memuat|menyebut|menjelaskan|ditemukan)\b/i,
  /\bbelum (?:ada|bisa|ditemukan|dipastikan)\b/i,
  /\baplikasi ini\b/i,
  /\bdokter\b/i,
  /\btenaga kesehatan\b/i,
  /\b(?:periksa|pemeriksaan|tes|rumah sakit|puskesmas|klinik)\b/i,
  /\b(?:segera|darurat|hubungi|bilang|beri tahu|ceritakan)\b/i,
  /\b(?:orang tua|orang dewasa|guru)\b/i,
  /^(?:halo|hai|terima kasih)\b/i,
]

/**
 * Pecah jawaban menjadi kalimat, dengan kesadaran bahwa DAFTAR BUKAN KALIMAT.
 *
 * Jebakan yang sudah kena di proyek ini: butir daftar tanpa titik di ujung
 * terbaca sebagai satu "kalimat" sangat panjang. Kalau pemeriksa ini memakai
 * pemecahan naif, satu butir daftar yang salah bisa membuang seluruh daftar.
 *
 * @param {string} teks
 * @returns {string[]}
 */
export function daftarKalimat(teks) {
  const baris = String(teks ?? '').split(/\n+/)
  const hasil = []
  for (const b of baris) {
    const bersih = b.replace(/^\s*(?:[-*•]|\d+[.)])\s+/, '').trim()
    if (!bersih) continue
    // pecah per akhir kalimat; titik di angka (mis. "15.000") tidak dihitung
    for (const k of bersih.split(/(?<=[.!?])\s+(?=[A-ZÀ-Ý"“])/)) {
      const s = k.trim()
      if (s) hasil.push(s)
    }
  }
  return hasil
}

/**
 * Apakah teks sumber membahas prognosis sama sekali?
 * @param {string} sumberTeks
 * @returns {boolean}
 */
export function sumberMembahasPrognosis(sumberTeks) {
  const t = String(sumberTeks ?? '').toLowerCase()
  return SUMBER_BAHAS_PROGNOSIS.some((k) => t.includes(k))
}

/**
 * Saring klaim prognosis yang tidak punya dasar di sumber.
 *
 * KAPAN TIDAK MENYARING APA PUN (dan itu disengaja):
 *   - jawaban kosong
 *   - tidak ada teks sumber sama sekali
 *   - sumber MEMANG membahas prognosis
 *
 * @param {string} jawaban
 * @param {string} sumberTeks - gabungan seluruh teks sumber giliran ini
 * @returns {{ jawaban: string, dibuang: Array<{kalimat:string, alasan:string}>, diperiksa: number }}
 */
export function saringKlaimTanpaSumber(jawaban, sumberTeks) {
  const asli = String(jawaban ?? '')

  if (!asli.trim()) return { jawaban: asli, dibuang: [], diperiksa: 0 }
  if (!String(sumberTeks ?? '').trim()) return { jawaban: asli, dibuang: [], diperiksa: 0 }
  if (sumberMembahasPrognosis(sumberTeks)) return { jawaban: asli, dibuang: [], diperiksa: 0 }

  const kalimat = daftarKalimat(asli)
  if (!kalimat.length) return { jawaban: asli, dibuang: [], diperiksa: 0 }

  const dibuang = []
  const disimpan = []

  for (const k of kalimat) {
    if (JANGAN_SENTUH.some((re) => re.test(k))) {
      disimpan.push(k)
      continue
    }
    if (!POLA_PROGNOSIS.some((re) => re.test(k))) {
      disimpan.push(k)
      continue
    }
    dibuang.push({
      kalimat: k,
      alasan: 'klaim prognosis, padahal tidak satu pun sumber membahas prognosis',
    })
  }

  // Semua kalimat terbuang berarti penyaringnya terlalu agresif untuk jawaban
  // ini. Mengembalikan jawaban kosong jauh lebih buruk daripada membiarkan satu
  // klaim lemah — pengguna tidak akan menerima apa pun.
  if (!disimpan.length) {
    return { jawaban: asli, dibuang: [], diperiksa: kalimat.length }
  }

  return {
    jawaban: disimpan.join(' ').replace(/\s+/g, ' ').trim(),
    dibuang,
    diperiksa: kalimat.length,
  }
}

/**
 * Susun teks sumber untuk pemeriksaan.
 *
 * Yang dipakai adalah teks sumber SEBENARNYA (`isi`/`ringkas`), bukan judul.
 * Judul saja tidak cukup: "Kidney Diseases" tidak membahas prognosis apa pun.
 *
 * @param {Array<object>} hasilCari
 * @returns {string}
 */
export function teksSumber(hasilCari = []) {
  return (hasilCari ?? [])
    .filter(Boolean)
    .map((h) => [h.judul, h.isi, h.ringkas].filter(Boolean).join(' '))
    .join('\n')
}
