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
    'nav.verifikasi': 'Cek Klaim',
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
    'umum.pakaiContoh': 'Pakai contoh',
    'umum.tingkatBaca': 'Tingkat baca',
    'umum.sumber': 'Sumber',
    'umum.poinKunci': 'Poin kunci yang dipertahankan',
    'umum.poinKunciCatatan': 'Daftar ini ditandai lebih dulu sebelum bahasa disederhanakan — bukti kelengkapan informasi terjaga.',
    'umum.suaraGagal': 'Gagal memutar suara.',
    'umum.tidakAdaTeks': 'Tidak ada teks untuk dibacakan.',
    /** Dipakai untuk memilih format tanggal yang sesuai bahasa antarmuka. */
    'umum.kodeLokal': 'id-ID',

    // beranda
    'beranda.sapa': 'Halo!',
    'beranda.tanya': 'Ada yang bisa kami bantu?',
    'beranda.sub': 'Temukan informasi kesehatan yang mudah dipahami atau tanyakan apa saja seputar kesehatan.',
    'beranda.badge1': 'Bersumber resmi',
    'beranda.badge2': 'Mode suara tersedia',
    'beranda.altIlustrasi': 'Ilustrasi dokter menyapa di halaman beranda',

    // tanya AI
    'tanya.eyebrow': 'Asisten',
    'tanya.judul': 'Tanya AI',
    'tanya.sub': 'Disederhanakan sesuai tingkat baca, poin kunci tetap dipertahankan, sumber selalu disertakan.',
    'tanya.placeholder': 'Tulis pertanyaan, tempel teks, atau kirim suara...',
    'tanya.kirim': 'Tanya Sekarang',
    'tanya.menyiapkan': 'Menyiapkan jawaban…',
    'tanya.mencari': 'Mencari sumber terpercaya…',
    'tanya.mendengar': 'Mendengarkan… bicara sekarang.',
    'tanya.belumAda': 'Belum ada percakapan',
    'tanya.belumAdaSub': 'Ajukan pertanyaan pertamamu — hasilnya akan muncul sebagai utas di sini.',
    'tanya.sedangMenyusun': 'Menyusun jawaban…',
    'tanya.kamu': 'Kamu',
    'tanya.terlaluPanjang': 'Teksnya melebihi batas Tanya. Pendekkan dulu, atau pilih mode Sederhanakan yang batasnya lebih longgar.',
    'tanya.pindahCatatan': 'Setelah dikirim, kamu langsung pindah ke halaman Tanya AI.',

    // mode di kotak isian Tanya AI
    'tanya.modeAria': 'Pilih cara memakai teks',
    'tanya.modeTanya': 'Tanya',
    'tanya.modeBadgeSederhanakan': 'Sederhanakan',

    // pindai foto — dilipat di dalam kotak isian Tanya AI
    'tanya.pindaiTombol': 'Pindai foto',
    'tanya.pindaiJudul': 'Ubah foto jadi teks',
    'tanya.pindaiSub': 'Baca teks dari foto label obat, hasil lab, atau resep. Semuanya dibaca di perangkat ini, tidak diunggah ke mana pun.',
    'tanya.tutupPindai': 'Tutup pemindai',
    'pindai.keKotak': 'Teksnya sudah masuk ke kotak isian di atas — periksa dan betulkan dulu, baru kirim.',

    // sumber
    'sumber.judul': 'Sumber jawaban',
    'sumber.cekSendiri': 'Silakan cek sendiri lewat tautan di bawah — jangan percaya begitu saja.',
    'sumber.adaResmi': 'termasuk sumber resmi',
    'sumber.resmi': 'SUMBER RESMI',
    'sumber.belumDikutip': 'ditemukan, belum dikutip',
    'sumber.belumDikutipCatatan': 'Model belum mengutip satu pun; daftar ini hasil pencarian mentah.',
    'sumber.tanpaTautan': '(tanpa tautan)',
    'sumber.buka': 'Buka sumber',
    'sumber.catatan': 'Jawaban disusun dari hasil pencarian internet yang diambil saat pertanyaan diproses. Tanda centang berarti sumber itu dipakai di jawaban; ikon gedung menandai lembaga resmi.',

    // sederhanakan — sekarang jadi mode di kotak isian Tanya AI
    'sed.tombol': 'Sederhanakan',
    'sed.sub': 'Tempel teks dari hasil lab, label obat, artikel, atau broadcast WhatsApp — lalu tekan Sederhanakan. Model menandai poin kunci lebih dulu, baru menyederhanakan bahasanya.',
    'sed.placeholder': 'Tempel teks medis di sini…',
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

    // suara — hanya tombol mikrofon di kotak isian Tanya AI yang tersisa
    'suara.tidakDidukung': 'Peramban ini belum mendukung pengenalan suara — coba Chrome atau Edge',
    'suara.ariaMulai': 'Mulai perekaman suara',
    'suara.ariaHentikan': 'Hentikan perekaman',
    'suara.ariaTidakDidukung': 'Pengenalan suara tidak didukung peramban ini',

    // pindai foto (OCR di peramban) — dilipat di dalam kotak isian Tanya AI
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
    'pindai.tetapBisa': 'Teksnya tetap bisa dibaca dan disalin; tombol kirim baru bekerja setelah server hidup.',
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
    'kuis.eyebrow': 'Kuesioner Kesehatan',
    'kuis.judul': 'Kuesioner HLS-SF12',
    'kuis.sub': 'Kuesioner ini berisi 12 pertanyaan untuk menilai seberapa mudah informasi kesehatan dipahami oleh Anda.',
    'kuis.waktu': '± 5 menit',
    'kuis.instruksi': 'Pilih salah satu jawaban yang paling sesuai dengan kondisi Anda.',
    'kuis.pertanyaanDari': 'Pertanyaan {n} dari {b}',
    'kuis.sebelumnya': 'Sebelumnya',
    'kuis.selanjutnya': 'Selanjutnya',
    'kuis.lihat': 'Lihat hasil',
    'kuis.ulangi': 'Ulangi',
    'kuis.hasil': 'Literasi kesehatan',
    'kuis.progres': 'Progres Kuesioner',
    'kuis.selesai': '{n} dari {b} pertanyaan selesai',
    'kuis.terjawabDari': '{a} dari {b} terjawab',

    // empat pilihan jawaban + subteksnya
    'kuis.opsi0': 'Sangat sulit',
    'kuis.opsi0Sub': 'Saya hampir tidak mengerti sama sekali.',
    'kuis.opsi1': 'Kadang sulit',
    'kuis.opsi1Sub': 'Saya sering bingung, perlu waktu lebih lama untuk memahami.',
    'kuis.opsi2': 'Mudah',
    'kuis.opsi2Sub': 'Saya cukup mudah memahami sebagian besar informasi.',
    'kuis.opsi3': 'Sangat mudah',
    'kuis.opsi3Sub': 'Saya sangat mudah memahami informasi kesehatan.',

    // obrolan tersimpan
    'sesi.eyebrow': 'Arsip',
    'sesi.judul': 'Riwayat Obrolan',
    'sesi.sub': 'Setiap obrolan tersimpan utuh di peramban ini — bisa dibuka lagi dan dilanjutkan kapan saja. Tidak ada yang dikirim ke server.',
    'sesi.terakhir': 'Obrolan Terakhir',
    'sesi.terakhirSub': 'Lanjutkan percakapan yang baru kamu buka di perangkat ini.',
    'sesi.lihatSemua': 'Lihat semua',
    'sesi.kosongJudul': 'Belum ada obrolan',
    'sesi.kosongSub': 'Mulai bertanya pada kartu Tanya AI — obrolannya akan tersimpan di sini.',
    'sesi.baru': 'Obrolan baru',
    'sesi.belumDisimpan': 'Obrolan baru',
    'sesi.belumDisimpanCatatan': 'Belum tersimpan — tersimpan begitu jawabannya datang.',
    'sesi.tersimpanCatatan': 'Tersimpan di peramban ini. Bisa dibuka lagi kapan saja.',
    'sesi.bukaJudul': 'Buka obrolan ini',
    'sesi.jumlahTanya': '{n} pertanyaan',
    'sesi.sedangDibuka': 'Sedang dibuka',
    'sesi.bagikan': 'Bagikan',
    'sesi.bagikanSatu': 'Bagikan obrolan: {judul}',
    'sesi.bagikanJudul': 'Obrolan tersimpan',
    'sesi.bagikanCatatan': 'Dibagikan dari Pahami Sehat. Jawaban AI tetap sebaiknya dicek ke sumber resminya.',
    'sesi.hapus': 'Hapus',
    'sesi.hapusSemua': 'Hapus semua',
    'sesi.hapusSatu': 'Hapus obrolan: {judul}',
    'sesi.pilihSatu': 'Pilih obrolan: {judul}',
    'sesi.dipilih': '{n} obrolan dipilih',
    'sesi.pilihSemua': 'Pilih semua',
    'sesi.batalPilihSemua': 'Batalkan pilihan',
    'sesi.batalPilih': 'Batal',
    'sesi.terhapus': '{n} obrolan dihapus dari riwayat.',
    'sesi.disalin': '{n} obrolan disalin — tempel di mana saja.',
    'sesi.tutup': 'Tutup',
    'sesi.baruSaja': 'Baru saja',
    'sesi.menitLalu': '{n} menit lalu',
    'sesi.jamLalu': '{n} jam lalu',
    'sesi.kemarin': 'Kemarin',
    'sesi.hariLalu': '{n} hari lalu',

    // panel salin manual (kalau papan klip diblokir peramban)
    'salin.judul': 'Salin sendiri',
    'salin.sub': 'Peramban ini tidak mengizinkan penyalinan otomatis. Teksnya sudah siap di bawah.',
    'salin.label': 'Teks obrolan untuk disalin',
    'salin.petunjuk': 'Teksnya sudah terpilih semua — tekan Ctrl+C (atau Cmd+C di Mac) untuk menyalinnya.',
    'salin.cobaLagi': 'Coba salin lagi',
    'salin.berhasil': 'Berhasil disalin.',
    'salin.masihGagal': 'Masih diblokir. Pakai Ctrl+C seperti di atas.',

    // tombol yang dipakai bersama notifikasi pembatalan
    'riw.hapus': 'Hapus',
    'riw.batalkan': 'Batalkan',
    'riw.dikembalikan': 'Riwayat dikembalikan.',

    // artikel & topik di Beranda
    'art.judul': 'Artikel kesehatan',
    'art.sub': 'Bacaan singkat dari kanal resmi Kemenkes RI.',
    'art.baca': 'Baca',
    'art.bacaAsli': 'Baca artikel aslinya',
    'art.tutup': 'Tutup',
    'art.sumber': 'Sumber',
    'topik.judul': 'Topik populer',
    'topik.sub': 'Ketuk salah satu untuk langsung bertanya.',
    'topik.aria': 'Pilih topik kesehatan',
    'topik.diperbaruiPada': 'Diperbarui {tanggal}',
    'topik.dicekDiperbarui': 'Terakhir dicek {dicek} · diperbarui {diperbarui}',

    // tips kesehatan
    'tips.label': 'Tips Kesehatan Hari Ini',
    'tips.selengkapnya': 'Baca selengkapnya',
    'tips.tutup': 'Tutup',
    'tips.sumber': 'Sumber',

    // tanya AI (tambahan)

    // kuesioner (tambahan)
    'kuis.tentang': 'Tentang Kuesioner',
    'kuis.tentangIsi':
      'Kuesioner HLS-SF12 mengukur tingkat literasi kesehatan Anda, sehingga kami dapat memberikan informasi kesehatan yang sesuai dengan kebutuhan Anda.',
    'kuis.tips': 'Tips Mengisi',
    'kuis.tip1': 'Pilih jawaban yang paling sesuai dengan pengalaman Anda.',
    'kuis.tip2': 'Tidak ada jawaban benar atau salah.',
    'kuis.tip3': 'Jawaban Anda bersifat rahasia dan hanya digunakan untuk meningkatkan kualitas layanan.',
    'kuis.saranDari':
      'Semakin mudah Anda memahami informasi kesehatan, semakin baik keputusan untuk kesehatan Anda.',
    'kuis.hasilTampil': 'Hasil akan tampil di sini',
    'kuis.hasilTampilSub': 'Jawab ke-12 pertanyaan di atas, lalu tekan Lihat hasil.',
    'kuis.baik': 'Baik',
    'kuis.sedang': 'Sedang',
    'kuis.perluDukungan': 'Perlu dukungan',
    'kuis.saranBaik': 'Kamu sudah nyaman mencari dan menilai informasi kesehatan. Pertahankan, dan bantu orang di sekitarmu yang masih kesulitan.',
    'kuis.saranSedang': 'Sebagian besar sudah bisa, bagian menilai kebenaran informasi masih perlu diperkuat. Biasakan cek ke Kemenkes, WHO, atau BPOM sebelum percaya.',
    'kuis.saranPerlu': 'Aktifkan penyederhanaan ke tingkat anak-anak dan mode suara agar informasi lebih mudah dijangkau. Bawa hasil ini ke tenaga kesehatan terdekat.',
    'kuis.catatan': 'Hasil ini alat bantu belajar, bukan diagnosis medis.',
    'kuis.belumDijawab': 'Masih ada {n} pernyataan yang belum dijawab.',
    'kuis.terjawabDari': '{a} dari {b} terjawab',

    // pengaturan (tambahan)

    // pemberitahuan
    'notif.judul': 'Pemberitahuan',
    'notif.panel': 'Pemberitahuan',
    'notif.tutup': 'Tutup pemberitahuan',
    'notif.kosong': 'Belum ada pemberitahuan.',
    'notif.lonceng': 'Pemberitahuan, {n} butir',
    'notif.loncengBaru': 'Pemberitahuan, {n} butir, ada yang belum dibaca',
    'notif.kontenJudul': 'Konten harian diperbarui',
    'notif.kontenIsi': 'Topik populer dan artikel sudah memakai terbitan terbaru.',
    'notif.serverJudul': 'Server tidak terhubung',
    'notif.serverIsi': 'Jawaban AI belum bisa dibuat. Periksa koneksi lalu muat ulang.',
    'notif.obrolanJudul': '{n} obrolan tersimpan',
    'notif.obrolanIsi': 'Tersimpan di peramban ini saja — buka Riwayat Obrolan untuk melanjutkannya.',

    // navigasi tambahan (drawer & sidebar)
    'nav.tutupMenu': 'Tutup menu navigasi',
    'nav.drawer': 'Menu navigasi',
    'nav.drawerDashboard': 'Menu dashboard',
    'nav.isiDrawer': 'Informasi Kesehatan untuk Semua',

    // halaman pemuatan
    'load.memuat': 'Memuat Pahami Sehat',

    // panel galat
    'galat.judul': 'Bagian ini gagal ditampilkan',
    'galat.pesan': 'Terjadi kesalahan saat menampilkan bagian ini. Bagian aplikasi yang lain masih bisa dipakai.',
    'galat.rincian': 'Rincian teknis',
    'galat.cobaLagi': 'Coba tampilkan lagi',
    'galat.atasJudul': 'Bagian atas aplikasi gagal ditampilkan',
    'galat.atasPesan': 'Navigasi dan tombol pemberitahuan tidak bisa ditampilkan. Isi halaman di bawahnya masih bisa dipakai.',
    'galat.isiJudul': 'Isi halaman gagal ditampilkan',
    'galat.isiPesan': 'Terjadi kesalahan saat menampilkan bagian ini. Coba pindah ke menu lain lewat navigasi, atau muat ulang halaman.',
    'galat.bawahJudul': 'Bagian bawah halaman gagal ditampilkan',
    'galat.bawahPesan': 'Keterangan kaki halaman tidak bisa ditampilkan. Isi halaman di atasnya masih bisa dipakai.',

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
    'nav.verifikasi': 'Check Claim',
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
    'umum.pakaiContoh': 'Use example',
    'umum.tingkatBaca': 'Reading level',
    'umum.sumber': 'Sources',
    'umum.poinKunci': 'Key points preserved',
    'umum.poinKunciCatatan': 'This list is marked first, before the language is simplified — proof that no information was lost.',
    'umum.suaraGagal': 'Could not play the audio.',
    'umum.tidakAdaTeks': 'There is no text to read aloud.',
    /** Dipakai untuk memilih format tanggal yang sesuai bahasa antarmuka. */
    'umum.kodeLokal': 'en-US',

    'beranda.sapa': 'Hello!',
    'beranda.tanya': 'How can we help?',
    'beranda.sub': 'Find easy-to-understand health information, or ask anything about health.',
    'beranda.badge1': 'From official sources',
    'beranda.badge2': 'Voice mode available',
    'beranda.altIlustrasi': 'Illustration of a doctor waving on the home page',

    'tanya.eyebrow': 'Assistant',
    'tanya.judul': 'Ask AI',
    'tanya.sub': 'Simplified to your reading level, key points preserved, sources always included.',
    'tanya.placeholder': 'Type a question, paste text, or send voice...',
    'tanya.kirim': 'Ask Now',
    'tanya.menyiapkan': 'Preparing the answer…',
    'tanya.mencari': 'Searching trustworthy sources…',
    'tanya.mendengar': 'Listening… speak now.',
    'tanya.belumAda': 'No conversation yet',
    'tanya.belumAdaSub': 'Ask your first question — the result will appear as a thread here.',
    'tanya.sedangMenyusun': 'Composing the answer…',
    'tanya.kamu': 'You',
    'tanya.terlaluPanjang': 'This text is over the Ask limit. Shorten it, or pick Simplify mode, which allows more.',
    'tanya.pindahCatatan': 'Once sent, you move straight to the Ask AI page.',

    'tanya.modeAria': 'Choose how to use the text',
    'tanya.modeTanya': 'Ask',
    'tanya.modeBadgeSederhanakan': 'Simplify',

    'tanya.pindaiTombol': 'Scan a photo',
    'tanya.pindaiJudul': 'Turn a photo into text',
    'tanya.pindaiSub': 'Read the text from a photo of a medicine label, lab result, or prescription. Everything is read on this device, never uploaded.',
    'tanya.tutupPindai': 'Close the scanner',
    'pindai.keKotak': 'The text is now in the box above — check and correct it first, then send.',

    'sumber.judul': 'Answer sources',
    'sumber.cekSendiri': 'Check them yourself via the links below — do not just take our word for it.',
    'sumber.adaResmi': 'includes official sources',
    'sumber.resmi': 'OFFICIAL SOURCE',
    'sumber.belumDikutip': 'found, not cited',
    'sumber.belumDikutipCatatan': 'The model did not cite any; this list is raw search output.',
    'sumber.tanpaTautan': '(no link)',
    'sumber.buka': 'Open source',
    'sumber.catatan': 'The answer was composed from internet search results retrieved while processing the question. A check mark means the source was used in the answer; a building icon marks an official institution.',

    'sed.tombol': 'Simplify',
    'sed.sub': 'Paste text from lab results, medicine labels, articles, or WhatsApp broadcasts — then press Simplify. The model marks the key points first, then simplifies the wording.',
    'sed.placeholder': 'Paste medical text here…',
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

    'suara.tidakDidukung': 'This browser does not support speech recognition yet — try Chrome or Edge',
    'suara.ariaMulai': 'Start recording',
    'suara.ariaHentikan': 'Stop recording',
    'suara.ariaTidakDidukung': 'Speech recognition is not supported by this browser',

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
    'pindai.tetapBisa': 'The text can still be read and copied; the send button starts working once the server is running.',
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

    'kuis.eyebrow': 'Health Questionnaire',
    'kuis.judul': 'HLS-SF12 Questionnaire',
    'kuis.sub': 'This questionnaire has 12 questions to assess how easily you understand health information.',
    'kuis.waktu': '± 5 minutes',
    'kuis.instruksi': 'Choose the one answer that best matches your condition.',
    'kuis.pertanyaanDari': 'Question {n} of {b}',
    'kuis.sebelumnya': 'Previous',
    'kuis.selanjutnya': 'Next',
    'kuis.lihat': 'See result',
    'kuis.ulangi': 'Retry',
    'kuis.hasil': 'Health literacy',
    'kuis.progres': 'Questionnaire Progress',
    'kuis.selesai': '{n} of {b} questions completed',
    'kuis.terjawabDari': '{a} of {b} answered',

    'kuis.opsi0': 'Very difficult',
    'kuis.opsi0Sub': 'I hardly understand it at all.',
    'kuis.opsi1': 'Sometimes difficult',
    'kuis.opsi1Sub': 'I often get confused and need more time to understand.',
    'kuis.opsi2': 'Easy',
    'kuis.opsi2Sub': 'I understand most of the information quite easily.',
    'kuis.opsi3': 'Very easy',
    'kuis.opsi3Sub': 'I understand health information very easily.',

    'sesi.eyebrow': 'Archive',
    'sesi.judul': 'Conversation History',
    'sesi.sub': 'Every conversation is stored whole in this browser — reopen and continue it any time. Nothing is sent to a server.',
    'sesi.terakhir': 'Recent Conversations',
    'sesi.terakhirSub': 'Pick up a conversation you just opened on this device.',
    'sesi.lihatSemua': 'See all',
    'sesi.kosongJudul': 'No conversations yet',
    'sesi.kosongSub': 'Start asking in the Ask AI card — the conversation will be stored here.',
    'sesi.baru': 'New conversation',
    'sesi.belumDisimpan': 'New conversation',
    'sesi.belumDisimpanCatatan': 'Not saved yet — it is saved as soon as the answer arrives.',
    'sesi.tersimpanCatatan': 'Stored in this browser. Reopen it any time.',
    'sesi.bukaJudul': 'Open this conversation',
    'sesi.jumlahTanya': '{n} questions',
    'sesi.sedangDibuka': 'Currently open',
    'sesi.bagikan': 'Share',
    'sesi.bagikanSatu': 'Share conversation: {judul}',
    'sesi.bagikanJudul': 'Saved conversation',
    'sesi.bagikanCatatan': 'Shared from Pahami Sehat. AI answers are still best checked against the official source.',
    'sesi.hapus': 'Delete',
    'sesi.hapusSemua': 'Delete all',
    'sesi.hapusSatu': 'Delete conversation: {judul}',
    'sesi.pilihSatu': 'Select conversation: {judul}',
    'sesi.dipilih': '{n} conversations selected',
    'sesi.pilihSemua': 'Select all',
    'sesi.batalPilihSemua': 'Clear selection',
    'sesi.batalPilih': 'Cancel',
    'sesi.terhapus': '{n} conversations deleted from history.',
    'sesi.disalin': '{n} conversations copied — paste them anywhere.',
    'sesi.tutup': 'Close',
    'sesi.baruSaja': 'Just now',
    'sesi.menitLalu': '{n} minutes ago',
    'sesi.jamLalu': '{n} hours ago',
    'sesi.kemarin': 'Yesterday',
    'sesi.hariLalu': '{n} days ago',

    'salin.judul': 'Copy it yourself',
    'salin.sub': 'This browser does not allow automatic copying. The text is ready below.',
    'salin.label': 'Conversation text to copy',
    'salin.petunjuk': 'The text is already selected — press Ctrl+C (or Cmd+C on a Mac) to copy it.',
    'salin.cobaLagi': 'Try copying again',
    'salin.berhasil': 'Copied successfully.',
    'salin.masihGagal': 'Still blocked. Use Ctrl+C as described above.',

    'riw.hapus': 'Delete',
    'riw.batalkan': 'Undo',
    'riw.dikembalikan': 'History restored.',

    'art.judul': 'Health articles',
    'art.sub': 'Short reads from the official channel of Indonesia\u2019s Ministry of Health.',
    'art.baca': 'Read',
    'art.bacaAsli': 'Read the original article',
    'art.tutup': 'Close',
    'art.sumber': 'Source',
    'topik.judul': 'Popular topics',
    'topik.sub': 'Tap one to ask about it right away.',
    'topik.aria': 'Choose a health topic',
    'topik.diperbaruiPada': 'Updated {tanggal}',
    'topik.dicekDiperbarui': 'Last checked {dicek} · updated {diperbarui}',

    'tips.label': 'Health Tip of the Day',
    'tips.selengkapnya': 'Read more',
    'tips.tutup': 'Close',
    'tips.sumber': 'Source',

    'kuis.tentang': 'About the Questionnaire',
    'kuis.tentangIsi':
      'The HLS-SF12 questionnaire measures your health literacy level, so we can give you health information that matches your needs.',
    'kuis.tips': 'Tips for Filling It In',
    'kuis.tip1': 'Choose the answer that best matches your experience.',
    'kuis.tip2': 'There are no right or wrong answers.',
    'kuis.tip3': 'Your answers are confidential and used only to improve service quality.',
    'kuis.saranDari':
      'The easier you understand health information, the better the decisions you make for your health.',
    'kuis.hasilTampil': 'Your result will appear here',
    'kuis.hasilTampilSub': 'Answer all 12 questions above, then press See result.',
    'kuis.baik': 'Good',
    'kuis.sedang': 'Moderate',
    'kuis.perluDukungan': 'Needs support',
    'kuis.saranBaik': 'You are already comfortable finding and judging health information. Keep it up, and help those around you who still struggle.',
    'kuis.saranSedang': 'Most of it is fine; judging whether information is true still needs work. Get used to checking Kemenkes, WHO, or BPOM before believing anything.',
    'kuis.saranPerlu': 'Turn on simplification to the children level and voice mode so information is easier to reach. Bring this result to the nearest health worker.',
    'kuis.catatan': 'This result is a learning aid, not a medical diagnosis.',
    'kuis.belumDijawab': '{n} statements are still unanswered.',
    'kuis.terjawabDari': '{a} of {b} answered',

    'notif.judul': 'Notifications',
    'notif.panel': 'Notifications',
    'notif.tutup': 'Close notifications',
    'notif.kosong': 'No notifications yet.',
    'notif.lonceng': 'Notifications, {n} items',
    'notif.loncengBaru': 'Notifications, {n} items, unread ones present',
    'notif.kontenJudul': 'Daily content updated',
    'notif.kontenIsi': 'Popular topics and articles now use the latest release.',
    'notif.serverJudul': 'Server not connected',
    'notif.serverIsi': 'AI answers cannot be produced yet. Check your connection and reload.',
    'notif.obrolanJudul': '{n} conversations saved',
    'notif.obrolanIsi': 'Stored in this browser only — open Conversation History to continue them.',

    'nav.tutupMenu': 'Close navigation menu',
    'nav.drawer': 'Navigation menu',
    'nav.drawerDashboard': 'Dashboard menu',
    'nav.isiDrawer': 'Health Information for Everyone',

    'load.memuat': 'Loading Pahami Sehat',

    'galat.judul': 'This section failed to display',
    'galat.pesan': 'Something went wrong while displaying this section. The rest of the app still works.',
    'galat.rincian': 'Technical details',
    'galat.cobaLagi': 'Try showing it again',
    'galat.atasJudul': 'The top of the app failed to display',
    'galat.atasPesan': 'Navigation and the notifications button cannot be shown. The page content below still works.',
    'galat.isiJudul': 'The page content failed to display',
    'galat.isiPesan': 'Something went wrong while displaying this section. Try another menu via the navigation, or reload the page.',
    'galat.bawahJudul': 'The bottom of the page failed to display',
    'galat.bawahPesan': 'The footer cannot be shown. The page content above still works.',

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
 *
 * Kunci yang belum diterjemahkan dikembalikan apa adanya supaya tidak
 * menampilkan teks kosong.
 *
 * Nilai bisa disisipkan lewat argumen kedua, mis. t('kuis.belumDijawab', { n: 3})
 * dengan teks kamus "Masih ada {n} pernyataan yang belum dijawab."
 * Ini dipakai supaya kalimat yang memuat angka tetap bisa diterjemahkan utuh —
 * menyambung potongan kalimat di komponen membuat terjemahannya kaku.
 */
export function buatT(bahasa) {
  const k = kamus(bahasa)
  const dasar = kamus(BAHASA_DEFAULT)
  return (kunci, nilai) => {
    const teks = k[kunci] ?? dasar[kunci] ?? kunci
    if (!nilai || typeof nilai !== 'object') return teks
    return String(teks).replace(/\{(\w+)\}/g, (utuh, nama) =>
      Object.prototype.hasOwnProperty.call(nilai, nama) ? String(nilai[nama]) : utuh,
    )
  }
}
