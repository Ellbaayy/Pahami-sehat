# Verifikasi 4 Klaim Data Kesehatan Indonesia

Tanggal verifikasi: 14 Oktober 2026
Metode: pencarian web (Exa/brave-free) + peramban sungguhan (browser_exec) + pembacaan teks halaman.
Catatan: `web_extract` tidak berfungsi di mesin ini; `browser_exec` dan `curl`/`pdftotext` digunakan.

---

## A. "33% pasien bermasalah, 16,2% tak memadai" (pemahaman pasien atas informasi kesehatan)

**STATUS: TERBUKTI**

**SUMBER:**
- Judul: *Health literacy and associated factors among patients with chronic diseases in Indonesia*
- Penulis: Hema Malini, Ferry Efendi, Kusrini Semarwati Kadar, Devia Putri Lenggogeni, Yanti Puspita Sari
- Jurnal: Journal of Public Health (Germany), Vol. 33, Issue 3, hlm. 591–598, terbit Maret 2025
- DOI: https://doi.org/10.1007/s10389-023-02035-8
- URL repositori institusi (abstrak lengkap): https://scholar.unair.ac.id/en/publications/health-literacy-and-associated-factors-among-patients-with-chroni/

**KUTIPAN VERBATIM:**
> "For the health literacy level, 33% were on the problematic level and 16.2% inadequate."

(Konfirmasi redaksi berita yang mengutip studi ini: "Sebuah studi berjudul Health literacy and associated factors among patients with chronic diseases in Indonesia yang terbit pada Maret 2025 di Journal of Public Health (Jerman), mengungkap bahwa 33 persen pasien masuk kategori problematik. Sementara 16,2 persen tidak memadai." — TribunNews, https://www.tribunnews.com/nasional/7730030/studi-literasi-kesehatan-indonesia-masih-rendah)

**CARA DITEMUKAN:** web_search dengan frasa "16,2" literasi kesehatan Indonesia inadekuat problematik → abstrak di scholar.unair.ac.id memuat angka persisnya.

**CATATAN:** Angka berasal dari instrumen HLS-EU-SQ10-IDN (958 responden, tiga rumah sakit publik). Ini BUKAN survei 2013–2014 Semarang (yang melaporkan 64–65% literasi rendah) — konteksnya berbeda; jangan dicampur.

---

## B. "Materi kesehatan setara kelas 12,8" (tingkat keterbacaan materi edukasi kesehatan)

**STATUS: TIDAK DITEMUKAN**

**SUMBER:** TIDAK DITEMUKAN

**KUTIPAN VERBATIM:** —

**CARA DITEMUKAN:** 4 kueri berbeda (Indonesia & Inggris): "keterbacaan materi kesehatan Indonesia Flesch-Kincaid kelas 12"; "readability Indonesian health education materials grade level 12.8"; "keterbacaan bahan ajar kesehatan 12,8 tingkat kelas"; "Kemenkes media edukasi kesehatan Flesch Kincaid grade level". Tidak ada satu pun sumber yang melaporkan angka grade level **12,8** untuk materi kesehatan berbahasa Indonesia.

**CATATAN (near-miss yang perlu diketahui):**
- Studi keterbacaan artikel kesehatan WHO berbahasa Inggris (Alinea, Vol. 10 No. 2, 2021) melaporkan rata-rata **Fog Index 12,55** — mendekati 12,8 tetapi bukan angka yang sama, dan bukan materi berbahasa Indonesia.
- Studi Australia (NSW) melaporkan "a typical text was written at about a grade 12 reading level" (bukan 12,8) — https://pmc.ncbi.nlm.nih.gov/articles/PMC10148726/
- Studi berbahasa Indonesia yang ada memakai Cloze Procedure atau Flesch Reading Ease (skor negatif), bukan grade level desimal.
- **Kesimpulan: klaim 12,8 belum dapat dibuktikan. Kemungkinan angka ini keliru, berasal dari sumber yang salah kutip, atau dari studi yang tidak terindeks. Perlakukan sebagai tidak terverifikasi.**

---

## C. "6 dari 10 warga Masela dapat info dari cerita lisan; hanya 25% dari tenaga kesehatan; 10% dari media daring/TV"

**STATUS: TERBUKTI** (sebagai pernyataan yang muncul di artikel jurnalistik tersebut)

**SUMBER:**
- Judul: *Kebenaran Terlambat Datang Dari Pulau yang Tak Tersentuh Sinyal*
- Penulis: Adipatra Kenaro
- Penerbit: humaniora.id (Humaniora), 7 November 2025
- URL: https://www.humaniora.id/kebenaran-terlambat-datang-dari-pulau-yang-tak-tersentuh-sinyal/

**KUTIPAN VERBATIM:**
> "Sekitar enam dari sepuluh warga menggantungkan pengetahuannya pada cerita lisan dari orang tua, tetua adat, atau tokoh agama."
> "Sementara itu, hanya seperempat masyarakat yang memperoleh informasi langsung dari tenaga kesehatan."
> "Lebih kecil lagi, hanya 10% masyarakat yang mengaku mendapat pengetahuan dari media daring atau televisi."
> "Sisanya, sekitar 5%, mendapatkan informasi dari sumber lain seperti relawan, pekerja LSM, atau pendatang."

**CARA DITEMUKAN:** web_search "Masela informasi kesehatan Maluku Barat Daya masyarakat cerita lisan" → artikel humaniora.id; teks lengkap dikonfirmasi via browser_exec.

**CATATAN PENTING:** Angka-angka ini berasal dari **grafik dalam artikel jurnalistik** ("Grafik 1. Peta Sumber Informasi Kesehatan di Pulau Terpencil"), bukan dari survei akademik terverifikasi. Artikel ini juga menyebut narasumber (Toni Walkim, Kepala Puskesmas Marsela; "Bu Maria", kader posyandu). **Tidak ditemukan studi akademik/skripsi/jurnal independen** yang memuat ketiga angka ini. Sitasi yang jujur: "laporan jurnalistik humaniora.id, 2025", bukan studi peer-reviewed. Angka ini cocok persis dengan klaim (6/10 = 60%; 25% tenaga kesehatan; 10% media).

---

## D. Dua klaim terpisah

### D1. "27,8% penduduk belum punya jaminan kesehatan"

**STATUS: TERBUKTI**

**SUMBER:**
- Judul: *Seperempat Lebih Penduduk Indonesia Belum Punya Jaminan Kesehatan*
- Penulis: (redaksi Kompas) — Kompas.id
- Data asal: Survei Kesehatan Indonesia (SKI) 2023, Kementerian Kesehatan RI
- URL: https://www.kompas.id/artikel/lebih-dari-seperempat-penduduk-indonesia-belum-punya-jaminan-kesehatan
- Konfirmasi silang: https://brief.id/sekitar-278-penduduk-indonesia-belum-memiliki-jaminan-kesehatan/ ; https://ntbsatu.com/2024/06/24/341-persen-masyarakat-ntb-belum-punya-jaminan-kesehatan-2.html

**KUTIPAN VERBATIM:**
> "JAKARTA, KOMPAS — Masih ada setidaknya 27,8 persen penduduk Indonesia yang belum memiliki jaminan kesehatan, baik jaminan kesehatan melalui program pemerintah maupun swasta. ... Hal itu tampak dari hasil Survei Kesehatan Indonesia (SKI) 2023. Dari data yang dilaporkan, 27,8 persen penduduk belum memiliki jaminan kesehatan."

Angka pembanding (Susenas BPS 2023): "persentase ini hampir sama dengan data Survei Sosial Ekonomi Nasional (Susenas) Badan Pusat Statistik (BPS) yakni 27,6 persen pada 2023." (NTBSatu)

**CARA DITEMUKAN:** web_search "27,8 persen penduduk Indonesia belum memiliki jaminan kesehatan BPS" → Kompas.id, dikonfirmasi dua sumber lain.

**CATATAN:** Provinsi dengan kepemilikan jaminan kesehatan terendah menurut SKI 2023: Papua Pegunungan (55,4%), Papua Tengah (42,7%), Maluku Utara (41,5%), Maluku (39,4%), Jambi (37,0%).

---

### D2. "50% Puskesmas di Maluku & Papua tanpa dokter"

**STATUS: TERBUKTI-DENGAN-ANGKA-BERBEDA**

**SUMBER:**
- Judul: *Masalah Ketersediaan Nakes, Hampir 50 Persen Puskesmas di Papua-Papua Barat Tak Miliki Dokter*
- Penulis: (redaksi) — JagaIndonesia.com
- Data asal: Sistem Informasi SDM Kesehatan (SISDMK) 2020; dikutip dari pernyataan Emanuel Melkiades Laka Lena (Ketua Panja RUU Kesehatan), 11 April 2023
- URL: https://www.jagaindonesia.com/masalah-ketersediaan-nakes-hampir-50-persen-puskesmas-di-papua-papua-barat-tak-miliki-dokter/

**KUTIPAN VERBATIM:**
> "Data Sistem Informasi SDM Kesehatan (SISDMK) pada 2020 menyebutkan bahwa Provinsi Papua dan Papua Barat menjadi provinsi dengan persentase Puskesmas tanpa dokter tertinggi. Rinciannya, Provinsi Papua (48,18 persen), diikuti oleh provinsi Papua Barat (42,07 persen) dan provinsi Maluku (23,45 persen)."
> "Berdasarkan data, 6,9 persen itu Puskesmas tidak memiliki dokter. Tertinggi di Papua sekitar 48 persen."

Sumber pendukung (Kompas.id): "Berdasarkan data Kementerian Kesehatan 2021, masih ada 42,1 persen puskesmas yang belum memenuhi standar sumber daya tenaga kesehatan. ... Kondisi paling parah terjadi di Papua, di mana 42,6 persen puskesmasnya tanpa dilayani dokter." — https://www.kompas.id/artikel/masih-timpangnya-distribusi-tenaga-kesehatan-di-indonesia

Sumber pendukung (Profil Kesehatan Indonesia 2023, Kemenkes) memuat Gambar 2.7 "PERSENTASE PUSKESMAS TANPA DOKTER MENURUT PROVINSI TAHUN 2023" — http://kemkes.go.id/app_asset/file_content_download/172231123666a86244b83fd8.51637104.pdf

Data lebih baru (akhir 2024): Papua Pegunungan 62,57%, Papua Tengah 45,60%, Papua Selatan 32,94%, Papua Barat Daya 20,19%, Papua 14,63%, Papua Barat 13,75% (Nadi Papua, dari Kemenkes/Katadata).

**CARA DITEMUKAN:** web_search "Puskesmas tanpa dokter Maluku Papua persen tenaga kesehatan terpencil".

**CATATAN:** Klaim "50% di Maluku & Papua" **tidak persis**. Angka riil: Papua ~48,18% (2020), Papua Barat ~42,07%, **Maluku hanya 23,45%**. Jadi "hampir 50%" hanya berlaku untuk Papua, dan tidak untuk Maluku. Secara nasional hanya 6,9% Puskesmas tanpa dokter (2020), turun ke 4,97% (2023).

---

## Tabel Ringkasan Status

| Klaim | Status | Sumber utama | Angka riil |
|---|---|---|---|
| A. 33% problematik, 16,2% inadekuat | **TERBUKTI** | Malini et al., J. Public Health (Germany) 33(3):591–598, Mar 2025 | 33% problematik; 16,2% inadekuat |
| B. Materi kesehatan setara kelas 12,8 | **TIDAK DITEMUKAN** | — | tidak ada sumber dengan grade level 12,8 (near-miss: Fog Index 12,55 pada teks WHO berbahasa Inggris) |
| C. Masela: 6/10 cerita lisan; 25% nakes; 10% media | **TERBUKTI** (laporan jurnalistik) | Adipatra Kenaro, humaniora.id, 7 Nov 2025 | 60% / 25% / 10% / 5% — dari grafik artikel, bukan studi akademik |
| D1. 27,8% tanpa jaminan kesehatan | **TERBUKTI** | SKI 2023 via Kompas.id | 27,8% (SKI 2023); 27,6% (Susenas BPS 2023) |
| D2. 50% Puskesmas Maluku & Papua tanpa dokter | **TERBUKTI-DENGAN-ANGKA-BERBEDA** | SISDMK 2020 via JagaIndonesia | Papua 48,18%; Papua Barat 42,07%; Maluku 23,45%; nasional 6,9% |

---

## Rekomendasi Sitasi

- **A:** Malini H, Efendi F, Kadar KS, Lenggogeni DP, Sari YP. Health literacy and associated factors among patients with chronic diseases in Indonesia. *Journal of Public Health (Germany)*. 2025;33(3):591–598. doi:10.1007/s10389-023-02035-8
- **B:** Jangan sitasi angka 12,8 tanpa sumber. Jika perlu, gunakan temuan yang benar-benar ada (Fog Index 12,55 pada teks kesehatan WHO) dengan deskripsi yang tepat.
- **C:** Kenaro A. "Kebenaran Terlambat Datang Dari Pulau yang Tak Tersentuh Sinyal." *humaniora.id*, 7 November 2025. (sebutkan bahwa data berasal dari grafik laporan jurnalistik, bukan survei akademik)
- **D1:** Kementerian Kesehatan RI. *Survei Kesehatan Indonesia (SKI) 2023*; dilaporkan Kompas.id. (pembanding: Susenas BPS 2023 = 27,6%)
- **D2:** Kementerian Kesehatan RI, Sistem Informasi SDM Kesehatan (SISDMK) 2020; dikutip JagaIndonesia.com, 2023. Sebut angka per provinsi secara spesifik, jangan generalisasi "Maluku & Papua = 50%".
