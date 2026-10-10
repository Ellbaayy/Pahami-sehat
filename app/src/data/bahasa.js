/**
 * Teks antarmuka dua bahasa (Indonesia / Inggris).
 *
 * Dipakai lewat hook `useBahasa()` — komponen memanggil `t('kunci')`.
 * Pilihan bahasa disimpan di Pengaturan dan langsung mengubah seluruh
 * antarmuka, bukan sekadar label di halaman Pengaturan.
 *
 * Catatan: jawaban AI mengikuti bahasa ini juga (dikirim sebagai `bahasa`
 * ke server), jadi istilah teknis tetap konsisten.
 */

export const BAHASA = [
  { kunci: 'id', label: 'Bahasa Indonesia', singkat: 'ID' },
  { kunci: 'en', label: 'English', singkat: 'EN' },
]

export const BAHASA_DEFAULT = 'id'

const KAMUS = {
  id: {
    // navigasi
    'nav.beranda': 'Beranda',
    'nav.tanya': 'Tanya AI',
    'nav.sederhanakan': 'Sederhanakan',
    'nav.verifikasi': 'Cek Klaim',
    'nav.suara': 'Suara',
    'nav.riwayat': 'Riwayat',
    'nav.kuesioner': 'Kuesioner',
    'nav.pengaturan': 'Pengaturan',
    'nav.kembali': 'Kembali ke situs',
    'nav.menu': 'Buka menu',

    // umum
    'umum.terhubung': 'Terhubung',
    'umum.memeriksa': 'Memeriksa server…',
    'umum.serverMati': 'Server AI belum jalan',
    'umum.jalankan': 'jalankan',
    'umum.dengar': 'Dengar',
    'umum.hentikan': 'Hentikan',
    'umum.proses': 'Memproses…',
    'umum.kosongkan': 'Kosongkan',
    'umum.pakaiContoh': 'Pakai contoh',
    'umum.tingkatBaca': 'Tingkat baca',
    'umum.sumber': 'Sumber',
    'umum.poinKunci': 'Poin kunci yang dipertahankan',

    // beranda
    'beranda.sapa': 'Halo! 👋',
    'beranda.tanya': 'Ada yang bisa kami bantu?',
    'beranda.sub': 'Temukan informasi kesehatan yang mudah dipahami atau tanyakan apa saja seputar kesehatan.',
    'beranda.badge1': 'Bersumber resmi',
    'beranda.badge2': 'Mode suara tersedia',

    // tanya AI
    'tanya.judul': 'Tanya AI',
    'tanya.sub': 'Disederhanakan sesuai tingkat baca, poin kunci tetap dipertahankan, sumber selalu disertakan.',
    'tanya.placeholder': 'Tulis pertanyaan, tempel teks, atau kirim suara...',
    'tanya.kirim': 'Tanya Sekarang',
    'tanya.menyiapkan': 'Menyiapkan jawaban…',
    'tanya.mencari': 'Mencari sumber terpercaya…',
    'tanya.jawaban': 'Jawaban tersederhanakan',
    'tanya.verdictNegatif': 'Verdict — tidak didukung sumber',
    'tanya.mendengar': 'Mendengarkan… bicara sekarang.',
    'tanya.belumAda': 'Belum ada percakapan',
    'tanya.belumAdaSub': 'Ajukan pertanyaan pertamamu — hasilnya akan muncul sebagai utas di sini.',
    'tanya.sedangMenyusun': 'Menyusun jawaban…',
    'tanya.kamu': 'Kamu',

    // sumber
    'sumber.judul': 'Sumber jawaban',
    'sumber.cekSendiri': 'Silakan cek sendiri lewat tautan di bawah — jangan percaya begitu saja.',
    'sumber.resmi': 'SUMBER RESMI',
    'sumber.belumDikutip': 'ditemukan, belum dikutip',
    'sumber.tanpaTautan': '(tanpa tautan)',
    'sumber.catatan': 'Jawaban disusun dari hasil pencarian internet yang diambil saat pertanyaan diproses.',

    // sederhanakan
    'sed.judul': 'Sederhanakan teks medis',
    'sed.sub': 'Tempel teks dari hasil lab, label obat, artikel, atau broadcast WhatsApp. Model menandai poin kunci lebih dulu, baru menyederhanakan bahasanya.',
    'sed.placeholder': 'Tempel teks medis di sini…',
    'sed.tombol': 'Sederhanakan',
    'sed.label': 'Teks medis yang akan disederhanakan',
    'sed.proses': 'Menandai poin kunci lalu menyederhanakan bahasa…',

    // verifikasi
    'ver.judul': 'Cek klaim kesehatan',
    'ver.sub': "Tempel klaim dari broadcast atau media sosial. Model menilai apakah klaim itu didukung dokumen resmi — dan berani menjawab 'belum bisa dipastikan' kalau memang tidak ada dasarnya.",
    'ver.placeholder': 'Tempel klaim atau broadcast di sini…',
    'ver.tombol': 'Periksa klaim',
    'ver.label': 'Klaim yang akan diperiksa',
    'ver.proses': 'Mencocokkan klaim dengan sumber resmi…',
    'ver.didukung': 'Didukung sumber',
    'ver.tidakDidukung': 'Tidak didukung sumber',
    'ver.tidakPasti': 'Belum bisa dipastikan',

    // suara
    'suara.judul': 'Tanya dengan suara',
    'suara.sub': 'Cocok untuk yang lebih nyaman berbicara daripada mengetik. Hasil ucapannya langsung jadi teks, siap dikirim ke Tanya AI.',
    'suara.tekan': 'Tekan untuk bicara',
    'suara.mendengar': 'Mendengarkan… silakan bicara',
    'suara.dikenali': 'Ucapan dikenali',
    'suara.tidakDidukung': 'Peramban ini belum mendukung pengenalan suara',
    'suara.ulangi': 'Ulangi',
    'suara.gunakan': 'Gunakan hasil',
    'suara.placeholder': 'Teks hasil ucapan akan muncul di sini.',

    // kuesioner
    'kuis.judul': 'Kuesioner HLS-SF12',
    'kuis.sub': 'Versi ringkas. Semua perhitungan dilakukan lokal di peramban — tidak ada jawaban yang dikirim ke mana pun.',
    'kuis.lihat': 'Lihat hasil',
    'kuis.ulangi': 'Ulangi',
    'kuis.terjawab': 'terjawab',
    'kuis.belum': 'Belum ada riwayat',
    'kuis.hasil': 'Literasi kesehatan',

    // riwayat
    'riw.judul': 'Riwayat',
    'riw.sub': 'Pertanyaan yang diajukan pada sesi ini. Tersimpan di memori peramban saja.',

    // pengaturan
    'set.judul': 'Pengaturan',
    'set.sub': 'Disimpan di peramban ini saja. Tidak ada akun, tidak ada server.',
    'set.tingkat': 'Tingkat baca',
    'set.tingkatSub': 'Target penyederhanaan jawaban dan artikel, dipilih menurut umur pembaca.',
    'set.kontras': 'Mode kontras tinggi',
    'set.kontrasSub': 'Teks lebih gelap, huruf lebih besar, garis dan batas fokus dipertebal — untuk gangguan penglihatan.',
    'set.tts': 'Putar suara otomatis',
    'set.ttsSub': 'Setiap jawaban AI langsung dibacakan dengan suara peramban.',
    'set.bahasa': 'Bahasa antarmuka',
    'set.bahasaSub': 'Mengubah seluruh tampilan dan bahasa jawaban AI.',
    'set.catatan': 'Semua preferensi tersimpan di peramban, bukan di server.',


    // label tingkat baca
    'tingkat.anak': 'Anak-anak',
    'tingkat.remaja': 'Remaja',
    'tingkat.dewasa': 'Dewasa',
    'tingkat.lansia': 'Lansia',
  },

  en: {
    'nav.beranda': 'Home',
    'nav.tanya': 'Ask AI',
    'nav.sederhanakan': 'Simplify',
    'nav.verifikasi': 'Check Claim',
    'nav.suara': 'Voice',
    'nav.riwayat': 'History',
    'nav.kuesioner': 'Questionnaire',
    'nav.pengaturan': 'Settings',
    'nav.kembali': 'Back to site',
    'nav.menu': 'Open menu',

    'umum.terhubung': 'Connected',
    'umum.memeriksa': 'Checking server…',
    'umum.serverMati': 'AI server is not running',
    'umum.jalankan': 'run',
    'umum.dengar': 'Listen',
    'umum.hentikan': 'Stop',
    'umum.proses': 'Processing…',
    'umum.kosongkan': 'Clear',
    'umum.pakaiContoh': 'Use example',
    'umum.tingkatBaca': 'Reading level',
    'umum.sumber': 'Sources',
    'umum.poinKunci': 'Key points preserved',

    'beranda.sapa': 'Hello! 👋',
    'beranda.tanya': 'How can we help?',
    'beranda.sub': 'Find easy-to-understand health information, or ask anything about health.',
    'beranda.badge1': 'From official sources',
    'beranda.badge2': 'Voice mode available',

    'tanya.judul': 'Ask AI',
    'tanya.sub': 'Simplified to your reading level, key points preserved, sources always included.',
    'tanya.placeholder': 'Type a question, paste text, or send voice...',
    'tanya.kirim': 'Ask Now',
    'tanya.menyiapkan': 'Preparing the answer…',
    'tanya.mencari': 'Searching trustworthy sources…',
    'tanya.jawaban': 'Simplified answer',
    'tanya.verdictNegatif': 'Verdict — not supported by sources',
    'tanya.mendengar': 'Listening… speak now.',
    'tanya.belumAda': 'No conversation yet',
    'tanya.belumAdaSub': 'Ask your first question — the result will appear as a thread here.',
    'tanya.sedangMenyusun': 'Composing the answer…',
    'tanya.kamu': 'You',

    'sumber.judul': 'Answer sources',
    'sumber.cekSendiri': 'Check them yourself via the links below — do not just take our word for it.',
    'sumber.resmi': 'OFFICIAL SOURCE',
    'sumber.belumDikutip': 'found, not cited',
    'sumber.tanpaTautan': '(no link)',
    'sumber.catatan': 'The answer was composed from internet search results retrieved while processing the question.',

    'sed.judul': 'Simplify medical text',
    'sed.sub': 'Paste text from lab results, medicine labels, articles, or WhatsApp broadcasts. The model marks key points first, then simplifies the wording.',
    'sed.placeholder': 'Paste medical text here…',
    'sed.tombol': 'Simplify',
    'sed.label': 'Medical text to simplify',
    'sed.proses': 'Marking key points, then simplifying the wording…',

    'ver.judul': 'Check health claims',
    'ver.sub': "Paste a claim from a broadcast or social media. The model judges whether it is supported by official documents — and will say 'cannot be determined' when there is no basis.",
    'ver.placeholder': 'Paste the claim or broadcast here…',
    'ver.tombol': 'Check claim',
    'ver.label': 'Claim to check',
    'ver.proses': 'Matching the claim against official sources…',
    'ver.didukung': 'Supported by sources',
    'ver.tidakDidukung': 'Not supported by sources',
    'ver.tidakPasti': 'Cannot be determined',

    'suara.judul': 'Ask by voice',
    'suara.sub': 'For those more comfortable speaking than typing. Your speech becomes text, ready to send to Ask AI.',
    'suara.tekan': 'Tap to speak',
    'suara.mendengar': 'Listening… please speak',
    'suara.dikenali': 'Speech recognised',
    'suara.tidakDidukung': 'This browser does not support speech recognition yet',
    'suara.ulangi': 'Retry',
    'suara.gunakan': 'Use result',
    'suara.placeholder': 'Your transcribed speech will appear here.',

    'kuis.judul': 'HLS-SF12 Questionnaire',
    'kuis.sub': 'Short version. All calculation happens locally in your browser — no answers are sent anywhere.',
    'kuis.lihat': 'See result',
    'kuis.ulangi': 'Retry',
    'kuis.terjawab': 'answered',
    'kuis.belum': 'No history yet',
    'kuis.hasil': 'Health literacy',

    'riw.judul': 'History',
    'riw.sub': 'Questions asked in this session. Stored in browser memory only.',

    'set.judul': 'Settings',
    'set.sub': 'Stored in this browser only. No account, no server.',
    'set.tingkat': 'Reading level',
    'set.tingkatSub': 'Target simplification level for answers and articles, chosen by reader age.',
    'set.kontras': 'High contrast mode',
    'set.kontrasSub': 'Darker text, larger type, thicker borders and focus rings — for low vision.',
    'set.tts': 'Auto-play voice',
    'set.ttsSub': 'Every AI answer is read aloud with the browser voice.',
    'set.bahasa': 'Interface language',
    'set.bahasaSub': 'Changes the whole interface and the language of AI answers.',
    'set.catatan': 'All preferences are stored in the browser, not on the server.',

    'tingkat.anak': 'Children',
    'tingkat.remaja': 'Teens',
    'tingkat.dewasa': 'Adults',
    'tingkat.lansia': 'Elderly',
  },
}

/** Ambil kamus untuk satu bahasa. */
export function kamus(bahasa) {
  return KAMUS[bahasa] ?? KAMUS[BAHASA_DEFAULT]
}

/**
 * Buat fungsi penerjemah.
 * Kunci yang belum diterjemahkan dikembalikan apa adanya supaya tidak
 * menampilkan teks kosong.
 */
export function buatT(bahasa) {
  const k = kamus(bahasa)
  const dasar = kamus(BAHASA_DEFAULT)
  return (kunci) => k[kunci] ?? dasar[kunci] ?? kunci
}
