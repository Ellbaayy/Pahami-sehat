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
    'nav.pindai': 'Pindai Foto',
    'nav.riwayat': 'Riwayat',
    'nav.kuesioner': 'Kuesioner',
    'nav.pengaturan': 'Pengaturan',
    'nav.kembali': 'Kembali ke situs',
    'nav.menu': 'Buka menu',
    'nav.tutupSidebar': 'Tutup sidebar',
    'nav.bukaSidebar': 'Buka sidebar',

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
    'beranda.sapa': 'Halo!',
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

    // pindai foto (OCR di peramban)
    'pindai.eyebrow': 'Fitur baru',
    'pindai.judul': 'Pindai Foto',
    'pindai.sub': 'Foto label obat, hasil lab, atau resep — teksnya dibaca langsung di perangkat, tanpa diunggah ke mana pun.',
    'pindai.altPratinjau': 'Pratinjau foto yang akan dipindai',
    'pindai.ganti': 'Ganti foto',
    'pindai.tarik': 'Tarik foto ke sini, atau pilih dari perangkat',
    'pindai.format': 'JPG, PNG, atau WebP',
    'pindai.pilih': 'Pilih foto',
    'pindai.kamera': 'Pakai kamera',
    'pindai.tombol': 'Pindai teks',
    'pindai.memindai': 'Memindai…',
    'pindai.batalkan': 'Batalkan',
    'pindai.ulang': 'Pindai ulang',
    'pindai.menyiapkan': 'Menyiapkan…',
    'pindai.siapMesin': 'Menyiapkan mesin pembaca…',
    'pindai.nyalakanMesin': 'Menyalakan mesin…',
    'pindai.muatBahasa': 'Memuat data bahasa…',
    'pindai.siapPembaca': 'Menyiapkan pembaca…',
    'pindai.bacaTeks': 'Membaca teks pada foto…',
    'pindai.prosesUmum': 'Memproses…',
    'pindai.dibatalkan': 'Pemindaian dibatalkan.',
    'pindai.gagal': 'Pemindaian gagal.',
    'pindai.catatanMesin': 'Pemindaian pertama memuat mesin pembaca (±5 MB) — berikutnya langsung jalan.',
    'pindai.karakter': 'karakter terbaca',
    'pindai.keyakinan': 'Keyakinan mesin',
    'pindai.diproses': 'diproses di perangkat ini',
    'pindai.rendah': 'Hasilnya kurang meyakinkan. Coba foto ulang dengan cahaya lebih terang dan tulisan yang memenuhi bingkai — atau betulkan langsung di kotak bawah.',
    'pindai.tegasJudul': 'Ini alat bantu baca, bukan pengganti dokumen aslinya.',
    'pindai.tegasIsi': 'Untuk hasil lab atau resep, angka wajib dicocokkan lagi dengan kertas aslinya. Mesin pembaca bisa salah pada angka, dan salah angka di sini berbahaya.',
    'pindai.angkaJudul': 'Angka yang perlu diperiksa',
    'pindai.angkaCatatan': 'Tanda ini dari pemeriksaan bentuk angka, bukan dari AI. Mesin tidak membetulkannya sendiri — sengaja, karena menebak angka medis lebih berbahaya daripada tidak.',
    'pindai.labelTeks': 'Teks hasil pembacaan — boleh disunting sebelum dipakai',
    'pindai.placeholder': 'Teks yang terbaca akan muncul di sini…',
    'pindai.keTanya': 'Tanya AI soal ini',
    'pindai.tetapBisa': 'Teksnya tetap bisa dibaca dan disalin; dua tombol di atas baru bekerja setelah server hidup.',
    'pindai.terlaluPanjang': 'Teksnya lebih panjang dari batas Tanya AI — masih bisa disederhanakan, tetapi belum bisa ditanyakan sekaligus.',
    'pindai.kosongJudul': 'Belum ada hasil',
    'pindai.kosongSub': 'Pilih foto dulu, lalu tekan “Pindai teks”. Mesin pembaca berjalan di peramban — tidak ada foto yang dikirim ke server.',
    'pindai.tips1': 'Letakkan label obat atau hasil lab rata di atas meja, jangan dipegang.',
    'pindai.tips2': 'Pastikan cahaya cukup dan tidak ada bayangan tangan menutupi tulisan.',
    'pindai.tips3': 'Dekatkan sampai tulisannya memenuhi bingkai — huruf yang terlalu kecil paling sering gagal terbaca.',
    'pindai.privasiJudul': 'Apa yang terjadi pada fotomu',
    'pindai.privasi1': 'Foto dibaca di peramban memakai mesin WebAssembly yang disajikan situs ini sendiri — bukan dari CDN, jadi tidak ada permintaan keluar sama sekali.',
    'pindai.privasi2': 'Tidak ada foto, teks hasil, maupun riwayat pemindaian yang disimpan di server. Menutup halaman ini menghapus semuanya.',
    'pindai.privasi3': 'Teks hanya dikirim ke server AI kalau kamu sendiri menekan “Sederhanakan” atau “Tanya AI soal ini”.',

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
    'nav.pindai': 'Scan Photo',
    'nav.riwayat': 'History',
    'nav.kuesioner': 'Questionnaire',
    'nav.pengaturan': 'Settings',
    'nav.kembali': 'Back to site',
    'nav.menu': 'Open menu',
    'nav.tutupSidebar': 'Collapse sidebar',
    'nav.bukaSidebar': 'Expand sidebar',

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

    'beranda.sapa': 'Hello!',
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

    'pindai.eyebrow': 'New feature',
    'pindai.judul': 'Scan Photo',
    'pindai.sub': 'Photograph a medicine label, lab result, or prescription — the text is read on your device, never uploaded anywhere.',
    'pindai.altPratinjau': 'Preview of the photo to be scanned',
    'pindai.ganti': 'Change photo',
    'pindai.tarik': 'Drop a photo here, or pick one from your device',
    'pindai.format': 'JPG, PNG, or WebP',
    'pindai.pilih': 'Choose photo',
    'pindai.kamera': 'Use camera',
    'pindai.tombol': 'Scan text',
    'pindai.memindai': 'Scanning…',
    'pindai.batalkan': 'Cancel',
    'pindai.ulang': 'Scan again',
    'pindai.menyiapkan': 'Preparing…',
    'pindai.siapMesin': 'Preparing the reader engine…',
    'pindai.nyalakanMesin': 'Starting the engine…',
    'pindai.muatBahasa': 'Loading language data…',
    'pindai.siapPembaca': 'Preparing the reader…',
    'pindai.bacaTeks': 'Reading the text in the photo…',
    'pindai.prosesUmum': 'Processing…',
    'pindai.dibatalkan': 'Scan cancelled.',
    'pindai.gagal': 'Scan failed.',
    'pindai.catatanMesin': 'The first scan loads the reader engine (±5 MB) — later scans start right away.',
    'pindai.karakter': 'characters read',
    'pindai.keyakinan': 'Engine confidence',
    'pindai.diproses': 'processed on this device',
    'pindai.rendah': 'The result is not convincing. Try again with brighter light and the text filling the frame — or correct it directly in the box below.',
    'pindai.tegasJudul': 'This is a reading aid, not a replacement for the original document.',
    'pindai.tegasIsi': 'For lab results or prescriptions, always re-check the numbers against the original paper. The reader can get numbers wrong, and a wrong number here is dangerous.',
    'pindai.angkaJudul': 'Numbers worth checking',
    'pindai.angkaCatatan': 'These flags come from a shape check on the numbers, not from AI. The reader deliberately does not correct them itself — guessing at medical numbers is more dangerous than not guessing.',
    'pindai.labelTeks': 'Text read from the photo — edit it before using it',
    'pindai.placeholder': 'The text that was read will appear here…',
    'pindai.keTanya': 'Ask AI about this',
    'pindai.tetapBisa': 'The text can still be read and copied; the two buttons above start working once the server is running.',
    'pindai.terlaluPanjang': 'This text is longer than the Ask AI limit — it can still be simplified, but not asked about all at once.',
    'pindai.kosongJudul': 'No result yet',
    'pindai.kosongSub': 'Choose a photo first, then press “Scan text”. The reader runs in your browser — no photo is sent to the server.',
    'pindai.tips1': 'Lay the medicine label or lab result flat on a table, do not hold it.',
    'pindai.tips2': 'Make sure there is enough light and no hand shadow covers the writing.',
    'pindai.tips3': 'Move closer until the text fills the frame — small letters are the most common failure.',
    'pindai.privasiJudul': 'What happens to your photo',
    'pindai.privasi1': 'The photo is read in your browser by a WebAssembly engine served from this site itself — not from a CDN, so no outbound request is made at all.',
    'pindai.privasi2': 'No photo, resulting text, or scan history is stored on the server. Closing this page erases everything.',
    'pindai.privasi3': 'The text is only sent to the AI server when you yourself press “Simplify” or “Ask AI about this”.',

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
