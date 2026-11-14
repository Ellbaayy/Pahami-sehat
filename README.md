# Pahami Sehat

![Pahami Sehat — informasi kesehatan dalam bahasa yang bisa dipahami semua orang, dibuat oleh NØCTURNE](docs/thumbnail/pahami-sehat-1280x640.png)

**"Informasi Kesehatan untuk Semua"**

Proyek untuk **LOGICODIX 2026 Hackathon** — subtema **Inclusive Health & Well-being**.
Masalah yang disasar: informasi kesehatan di Indonesia bukan langka, tapi sering tidak
sampai dan tidak dipahami oleh yang paling membutuhkan.

> Status: **MVP berjalan.** Fitur AI memanggil model sungguhan
> (`deepseek-v4-1-flash` lewat Kenari.id) dari server Express sendiri, dan
> setiap jawaban disertai sumber yang bisa dibuka pengguna.
>
> **Status tiap fitur — apa adanya (diperiksa ulang 14 Nov 2026):**
>
> | Fitur | Keadaan |
> |---|---|
> | Tanpa akun | **Tidak ada halaman masuk, tidak ada pendaftaran, tidak ada sesi.** Aplikasi langsung terbuka di Beranda; riwayat, kuesioner, dan setelan tinggal di `localStorage` peramban |
> | Tanya AI + sumber | berjalan. Pencarian memakai kata kunci terpilih, bukan kalimat pengguna apa adanya |
> | Sederhanakan teks | berjalan (4 tingkat baca), menjadi salah satu mode di komposer Tanya AI |
> | Cek klaim | berjalan. Tiga putusan (`didukung`, `tidak_didukung`, `tidak_bisa_dipastikan`) dengan **lencana yang menyebut subjeknya** ("Klaim …"), satu kalimat penjelas per putusan, dan daftar sumber yang tidak pernah kosong tanpa keterangan. `tidak_didukung` hanya dipakai bila sumber resmi menyatakan sebaliknya |
> | Fasilitas Kesehatan | berjalan. **Pencarian nasional seluruh faskes** (20.924 baris: 3.325 RS resmi SIRS Kemenkes + 17.599 fasilitas OpenStreetMap) dengan saringan jenis, provinsi, kabupaten/kota, sumber, dan kelas RS. Tab "Fasilitas Terdekat" dihapus 8 Nov 2026. Field yang tidak ada di sumbernya dibiarkan kosong, bukan dikarang |
> | Suara dibacakan | **berjalan sebagai suara neural Microsoft — hanya di versi yang dijalankan di komputer sendiri.** Diukur ulang 20 Okt 2026: `POST /api/suara` menjawab `200 audio/mpeg`, berkas 24 kHz mono 48 kbps, 17.424 byte untuk satu kalimat, 0,80 detik. Di Vercel tetap **`502`** (diukur ulang 20 Okt 2026) karena fungsi serverless tidak bisa mempertahankan WebSocket — batas platform, bukan bug. Rincian: `app/server/suara.js` |
> | Input suara (bicara) | berjalan lewat Web Speech API bawaan peramban. **Butuh Chrome atau Edge**: Brave memblokir layanan suara daring Google, dan Firefox belum menyediakannya. Butuh konteks aman (`https://` atau `localhost`) |
> | Pindai foto / OCR | berjalan, **seluruhnya di peramban**. Foto tidak pernah dikirim ke server, dan fitur ini tetap jalan tanpa internet. Batasnya disebut apa adanya di aplikasi: alat bantu baca, bukan pengganti dokumen asli |
> | Riwayat obrolan | berjalan. Tersimpan di peramban (bukan server), maksimal **20 obrolan** (`MAKS_SESI` di `app/src/lib/sesi.js`). Bisa **dihapus satu per satu atau sekaligus**, dan penghapusan **bisa dibatalkan**. **Tidak lagi ditampilkan di Beranda** — hanya lewat menu **Riwayat** |
> | Berita kesehatan harian | berjalan. Pertanyaan seperti "berita terbaru hari ini" dijawab dari **RSS** (Detik Health, WHO, Google News) — bukan dari ensiklopedia, karena Wikipedia tidak punya berita harian. Setiap berita disebutkan **nama medianya** dan **umurnya**, dan lonceng pemberitahuan berbunyi kalau ada berita segar (diperiksa maksimal sekali sehari) |
> | Bahasa antarmuka | dua bahasa penuh: **Indonesia dan Inggris**, masing-masing **380 kunci** kamus. Judul tab peramban ikut halaman ("Tanya AI — Pahami Sehat"), bukan satu judul untuk semuanya |

>
> Catatan operasional: endpoint yang memanggil layanan berbayar dibatasi
> 20 permintaan/menit per alamat IP (`app/server/batas.js`, angka di `LAJU` pada
> `app/server/batasInput.js`). Pindai foto tidak masuk hitungan itu karena tidak
> menyentuh server sama sekali.

---

## Peta dokumen

| Yang dicari | Bagian |
|---|---|
| Gambaran solusi, latar belakang, target pengguna | [Pengenalan proyek](#pengenalan-proyek) |
| Arsitektur sistem & diagram alur program | [Arsitektur](#arsitektur) · [Alur satu pertanyaan](#alur-satu-pertanyaan) |
| Framework, struktur komponen UI, aset | [Dokumentasi frontend](#dokumentasi-frontend) |
| API endpoints, skema database, `.env.example` | [Dokumentasi backend](#dokumentasi-backend) · [Endpoint](#endpoint) |
| Instalasi & menjalankan di localhost | [Menjalankan di localhost](#menjalankan-di-localhost-laptop-finalis) |

---

## Pengenalan proyek

### Gambaran solusi

**Pahami Sehat** adalah aplikasi web yang menerjemahkan informasi kesehatan resmi
menjadi bahasa yang bisa dipahami siapa pun, lalu menunjukkan sumber aslinya.
Pengguna mengetik pertanyaan seperti "apa itu hipertensi?", memilih tingkat
pemahaman (anak 9–11, remaja, dewasa, lansia), dan menerima jawaban sepanjang
tingkat itu — bukan jawaban seragam untuk semua orang.

Tiga hal yang membedakannya dari chatbot kesehatan biasa:

1. **Sumber bisa diperiksa.** Setiap jawaban membawa URL asli (Wikipedia ID,
   MedlinePlus, RSS Kemenkes/WHO), dan panel sumber membedakan yang **dipakai**
   dari yang cuma **ditemukan**. Model dilarang menambah fakta dari ingatannya.
2. **Tingkat baca diukur, bukan diklaim.** Patokan kata dan panjang kalimat per
   tingkat dikalibrasi dari pengukuran nyata (`app/src/lib/keterbacaan.js`),
   dan hasilnya diuji `uji-keterbacaan.mjs`.
3. **Bisa dipakai tanpa akun dan tanpa database.** Tidak ada login, tidak ada
   data pribadi yang diminta, dan MariaDB bersifat opsional — aplikasi tetap
   menjawab kalau database mati.

### Latar belakang

Masalah yang disasar bukan kelangkaan informasi, melainkan **pemahaman,
jangkauan, dan kepercayaan**. Angka di bawah berasal dari dokumen yang bisa
dibuka; rincian rujukannya ada di `docs/verifikasi-klaim-*.md` dan di bagian
**Latar Belakang & Masalah** pada halaman penjelasan.

| Temuan | Angka | Sumber |
|---|---|---|
| Pasien yang kesulitan memahami informasi kesehatannya sendiri | **33%** problematik + **16,2%** inadekuat (958 responden) | Malini dkk., 2025 — HLS-EU-SQ10-IDN |
| Berat bacaan materi kesehatan di situs ternama | setara **kelas 12,8**, targetnya kelas 8 | Ayre dkk., 2024 — 26 teks, diukur SMOG |
| Penduduk tanpa jaminan kesehatan | **27,8%** | SKI 2023 |
| Hoaks kesehatan yang beredar | **2.622** (Agu 2018 – Sep 2026) | Komdigi |
| Cakupan imunisasi dasar lengkap | **93,7%** (2019) → **84,5%** (2021) | WHO/Kemenkes |
| Remaja 15–18 tahun berliterasi rendah | **72%** dari responden berliterasi rendah | studi lokal |

Konsekuensinya nyata: satu dari tiga pasien tidak memahami informasi
kesehatannya sendiri, dan materi yang seharusnya membantu justru ditulis jauh di
atas kemampuan pembacanya. Aplikasi ini menyerang bagian itu — bukan menambah
artikel baru, melainkan **menyesuaikan bahasa pada pembacanya** dan
**menunjukkan dari mana jawabannya datang**.

### Target pengguna

| Kelompok | Kebutuhannya | Yang menjawab di aplikasi |
|---|---|---|
| **Orang awam dengan literasi kesehatan terbatas** — pasien, keluarga pasien | paham penjelasan dokter/leaflet obat tanpa kamus | 4 tingkat baca, Sederhanakan teks, Mode Suara |
| **Lansia dan keluarga yang merawat** | teks lebih besar, bisa didengarkan, tidak perlu mengetik | tingkat Lansia, mode kontras tinggi, input suara |
| **Remaja 15–18 tahun** | bahasa sehari-hari, tidak menggurui, bisa dari ponsel | tingkat Remaja, tata letak ponsel, kuesioner HLS-SF12 |
| **Orang yang mencari fasilitas kesehatan** | tahu faskes apa yang ada di wilayahnya, jenis, dan kontaknya | pencarian 20.924 faskes nasional dengan 6 saringan |
| **Pembaca yang meragukan klaim kesehatan** | cara memeriksa klaim tanpa harus jadi ahli | Cek Klaim + daftar sumber yang bisa dibuka |

Tingkat baca dipatok ke **umur**, bukan kelas sekolah: anak 9–11, remaja 12–25,
dewasa 26–59, lansia 60+. Alasannya, anak 9 tahun dan lansia 80 tahun sama-sama
butuh kalimat pendek — tetapi isi yang mereka cari berbeda.

---

## Tampilan

Tangkapan layar di bawah diambil langsung dari aplikasi yang berjalan
(`npm run server`) — bukan gambar desain. **27 berkas** di
[`docs/tangkapan-layar/`](docs/tangkapan-layar/), seluruhnya diambil ulang
**7 Nov 2026** oleh tiga skrip yang ikut di repo:

| Skrip | Yang diambil |
|---|---|
| [`ambil-tangkapan-dashboard.mjs`](ambil-tangkapan-dashboard.mjs) | 7 halaman dashboard (1440×900), ponsel (390×844, DPR 2), dan mode kontras tinggi |
| [`ambil-tangkapan.mjs`](ambil-tangkapan.mjs) | 5 tangkapan Fasilitas Kesehatan: daftar nasional, saringan jenis, pencarian nama, saringan wilayah, tampilan ponsel |
| [`ambil-tangkapan-prototipe.mjs`](ambil-tangkapan-prototipe.mjs) | 10 bagian halaman penjelasan (1440×900) + 2 tampilan ponsel |

Desktop diambil pada **1440×900**, ponsel **390×844 dengan DPR 2**
(780×1688 piksel). Ketiga skrip menolak menyimpan berkas di bawah 20 KB, jadi
tangkapan yang gagal tidak lolos diam-diam ke halaman publik.

Jawaban AI di halaman **Tanya AI** dan putusan di **Cek Klaim** bukan contoh
yang ditempel: keduanya diambil dari permintaan sungguhan ke model dan ke
`/api/verifikasi` saat skrip berjalan.

### Aplikasi — tujuh menu

| Beranda | Tanya AI | Cek Klaim |
|---|---|---|
| ![Beranda](docs/tangkapan-layar/dashboard-1-beranda.png) | ![Tanya AI](docs/tangkapan-layar/dashboard-2-tanya-ai.png) | ![Cek Klaim](docs/tangkapan-layar/dashboard-3-cek-klaim.png) |

| Fasilitas Kesehatan | Riwayat | Kuesioner |
|---|---|---|
| ![Fasilitas Kesehatan](docs/tangkapan-layar/dashboard-4-faskes.png) | ![Riwayat](docs/tangkapan-layar/dashboard-5-riwayat.png) | ![Kuesioner](docs/tangkapan-layar/dashboard-6-kuesioner.png) |

| Pengaturan |
|---|
| ![Pengaturan](docs/tangkapan-layar/dashboard-7-pengaturan.png) |

Tiga hal yang perlu diperhatikan saat melihatnya: sidebar sudah **7 menu**
(Fasilitas Kesehatan masuk 4 Nov 2026, di antara Cek Klaim dan Riwayat);
jawaban Tanya AI tampil bersama **daftar sumber yang bisa dibuka**; dan Cek
Klaim menampilkan lencana putusan yang menyebut subjeknya — *"Klaim tidak
didukung sumber resmi"* untuk klaim vaksin MMR–autisme — beserta kalimat
penjelas dan dua sumber NIH di bawahnya.

**Tampilan di ponsel** — sidebar berubah jadi menu gulir:

| Beranda | Menu terbuka |
|---|---|
| ![Beranda di HP](docs/tangkapan-layar/dashboard-hp-1-beranda.png) | ![Menu HP](docs/tangkapan-layar/dashboard-hp-2-menu.png) |

**Mode kontras tinggi** — satu sakelar di Pengaturan: teks jadi hitam penuh,
huruf dasar membesar 112%, garis dan batas fokus dipertebal. Tangkapan di bawah
diambil di **Beranda** dengan mode itu menyala — di halaman Pengaturan sendiri
bedanya nyaris tak terlihat karena teksnya memang sudah gelap:

![Beranda dalam mode kontras tinggi](docs/tangkapan-layar/dashboard-kontras-tinggi.png)

### Fasilitas Kesehatan Nasional

Halaman ini **berubah 8 Nov 2026**. Sebelumnya ada dua tab — "Fasilitas
Terdekat" (pencarian radius di atas peta) dan "Rumah Sakit Nasional" (3.325 RS
SIRS). Tab radius dihapus, dan daftar nasional diperluas menjadi **seluruh
fasilitas kesehatan** yang datanya kami miliki: **20.924 baris** — 3.325 rumah
sakit resmi Kemenkes (SIRS) dan 17.599 fasilitas OpenStreetMap (klinik,
puskesmas, apotek, laboratorium, praktik mandiri, dan lainnya).

Saringan yang tersedia: nama/alamat, jenis fasilitas (10 kategori), provinsi,
kabupaten/kota, sumber data, kelas rumah sakit, dan "hanya yang punya
koordinat". Semua pilihan saringan dibaca dari database, bukan daftar tetap di
kode — kategori atau provinsi baru ikut muncul tanpa mengubah apa pun.

| Daftar nasional (tanpa saringan) | Saringan jenis fasilitas |
|---|---|
| ![Daftar nasional](docs/tangkapan-layar/faskes-0-daftar-nasional.png) | ![Saringan jenis](docs/tangkapan-layar/faskes-1-saringan-jenis.png) |

| Pencarian nama ("siloam") | Saringan wilayah |
|---|---|
| ![Pencarian nama](docs/tangkapan-layar/faskes-2-pencarian-nama.png) | ![Saringan wilayah](docs/tangkapan-layar/faskes-3-saringan-wilayah.png) |

![Tampilan ponsel](docs/tangkapan-layar/faskes-4-hp.png)

Yang perlu diperhatikan: angka di kepala panel (**20.924 fasilitas · 17.727
berkoordinat**) berasal dari database dan ikut berubah kalau datanya berubah;
pencarian "siloam" menyaring dari 20.924 menjadi **75** hasil; memilih provinsi
mengaktifkan dropdown kabupaten/kota; dan **3.197 dari 3.325 rumah sakit SIRS
belum punya koordinat** — baris seperti itu tetap ditampilkan dengan penanda
"Lokasi di peta belum tersedia", bukan diberi titik karangan. 128 sisanya
memakai koordinat objek OSM yang sama; `kode_osm` pada baris itu menyimpan
rujukan asalnya.

Saringan lokasi juga dirapikan 12 Nov 2026. Ditemukan **61 baris yang punya
kabupaten tetapi provinsi kosong** — pilihan provinsi tidak memuatnya, dan
dropdown kabupaten hanya berisi kabupaten milik provinsi yang dipilih, jadi
fasilitas itu mustahil ditemukan lewat saringan lokasi (namanya tetap bisa
dicari). Provinsinya diturunkan dari kabupaten lewat tabel `wilayah`
(`lengkapi-provinsi-faskes.mjs`), bukan ditebak. Selain itu ejaan kabupaten
diseragamkan ke nama resmi (`rapikan-kabupaten-faskes.mjs`): 533 entri dropdown
menyusut jadi **514 kabupaten/kota resmi**, sehingga memilih "Karangasem" tidak
lagi melewatkan baris yang tercatat "Karang Asem". Sisa **20 baris** tetap tanpa
kabupaten karena titiknya tidak jatuh di poligon wilayah mana pun (pulau kecil
dan pesisir); baris itu tetap muncul lewat saringan provinsi, dan kabupatennya
tidak dikarang.

Dua sumber disatukan hanya bila **nama, provinsi, dan kabupaten/kotanya sama**
(terukur 128 rumah sakit). Baris OSM-nya dihapus, koordinatnya dipindahkan ke
baris SIRS resmi, dan `kode_osm` dicatat sebagai rujukan — bukan koordinat
karangan. Di dalam OSM sendiri, objek yang terpetakan dua kali (*way* dan
*node*, nama sama, ≤50 m) juga dibersihkan. Total yang dibersihkan 12 Nov 2026:
**553 baris** (dari 21.477 menjadi 20.924). Rincian aturan dan alasannya:
`app/server/dedupFaskes.js`, diuji `uji-dedup-faskes.mjs`; perintahnya
`node bersihkan-duplikat-faskes.mjs` (dry run) atau `--terapkan`.

Tangkapan di atas diambil dari aplikasi yang benar-benar berjalan lewat
`ambil-tangkapan.mjs` pada 1440×900 (dan 390×844 untuk tampilan ponsel).

### Halaman penjelasan (prototype)

| Pembuka | Masalah & data | Konsep |
|---|---|---|
| ![Pembuka](docs/tangkapan-layar/prototype-1-hero.png) | ![Masalah](docs/tangkapan-layar/prototype-2-masalah.png) | ![Konsep](docs/tangkapan-layar/prototype-3-konsep.png) |

| Alur enam langkah | Fitur utama | Lanjutan fitur |
|---|---|---|
| ![Alur](docs/tangkapan-layar/prototype-4-alur.png) | ![Fitur](docs/tangkapan-layar/prototype-5-fitur.png) | ![Fitur lanjutan](docs/tangkapan-layar/prototype-6-fitur-lanjut.png) |

| Produk — mockup dasbor & ponsel | Kuesioner HLS-SF12 | Sumber & etika |
|---|---|---|
| ![Produk](docs/tangkapan-layar/prototype-7-produk.png) | ![Kuesioner](docs/tangkapan-layar/prototype-8-kuesioner.png) | ![Sumber](docs/tangkapan-layar/prototype-9-sumber.png) |

| Etika & keterbatasan | Prototype di ponsel | Bagian masalah di ponsel |
|---|---|---|
| ![Etika](docs/tangkapan-layar/prototype-10-etika.png) | ![Prototype HP](docs/tangkapan-layar/prototype-hp-1-hero.png) | ![Prototype HP masalah](docs/tangkapan-layar/prototype-hp-2-masalah.png) |

> Mockup perangkat di bagian **Produk** menampilkan **menu yang sama** dengan
> aplikasi sungguhan (Beranda, Tanya AI, Cek Klaim, Fasilitas Kesehatan,
> Riwayat, Kuesioner, Pengaturan) — "Sederhanakan", "Suara", dan "Pindai Foto"
> tidak berdiri sendiri karena ketiganya sudah menjadi bagian dari Tanya AI
> (mode di komposer, tombol mikrofon, dan tombol kamera).

---

## Peta folder

| Folder / berkas | Peran |
|---|---|
| [`app/`](app) | **Produk utama.** Aplikasi dashboard (React + Vite + Express). Ini yang dijalankan saat video demo dan Grand Final. |
| [`docs/prototipe/`](docs/prototipe) | **Halaman penjelasan** (HTML/CSS/JS statis): latar belakang, konsep 4 Lapis Aksesibilitas, alur pemakaian, status tiap fitur. **Tampil sebagai halaman depan situs.** |
| [`docs/tangkapan-layar/`](docs/tangkapan-layar) | **27 tangkapan layar** dashboard & prototype, diambil dari aplikasi yang berjalan (lihat bagian [Tampilan](#tampilan)). |
| [`docs/database/pahami-sehat.sql`](docs/database/pahami-sehat.sql) | **Isi database sungguhan** — struktur 15 tabel + seluruh baris (20.924 fasilitas, 7.837 wilayah, 331 topik, 124 dokumen, 1.074 sitasi). Baris `percakapan` sengaja kosong. Dibuat `buat-dump-database.sh`, diperiksa `periksa-dump-database.sh`. Lihat [Dump isi database ikut repo](#dump-isi-database-ikut-repo). |
| [`docs/skema-database.sql`](docs/skema-database.sql) | **Skema MariaDB** — 12 tabel (`sumber`, `dokumen`, `sitasi`, `konten`, `berita`, `pengetahuan`, `percakapan`, `wilayah`, `kategori_fasilitas`, `fasilitas`, `statistik_faskes`, `sumber_data_faskes`). Idempoten (semua `CREATE TABLE IF NOT EXISTS`), aman dijalankan ulang; sekaligus membersihkan tabel akun versi lama. Tiga tabel lagi (`cakupan_faskes`, `sinkron_fasilitas`, `catatan_sumber`) dibuat saat aplikasi berjalan, jadi database lengkap berisi **15 tabel**. |
| [`impor-sirs.mjs`](impor-sirs.mjs) | **Pengimpor rumah sakit resmi Kemenkes**: SIRS JSON → MySQL, upsert batch, validasi terhadap rekap resmi, log sinkronisasi. Lihat [Rumah sakit resmi Kemenkes](#rumah-sakit-resmi-kemenkes-sirs--3325-rs-di-database). |
| [`isi-wilayah.mjs`](isi-wilayah.mjs) | Pengisi tabel `wilayah` dari `wilayah.id` (38 provinsi + 514 kabupaten/kota + **7.285 kecamatan**). |
| [`lengkapi-provinsi-faskes.mjs`](lengkapi-provinsi-faskes.mjs) | **Pengisi `provinsi` dari `kabupaten`** lewat tabel `wilayah` (dry run bawaan). Dipakai 12 Nov 2026 untuk 61 baris yang punya kabupaten tetapi provinsi kosong — baris seperti itu tidak bisa ditemukan lewat saringan lokasi sama sekali. |
| [`rapikan-kabupaten-faskes.mjs`](rapikan-kabupaten-faskes.mjs) | **Penyeragam ejaan `kabupaten`** ke nama resmi `wilayah` (dry run bawaan). 12 Nov 2026: 12.761 baris dirapikan, 533 entri dropdown menyusut jadi 514 kabupaten resmi, dan 5 pasangan yang kabupatennya milik provinsi lain dipindahkan ke provinsi yang benar. |
| [`petakan-wilayah.mjs`](petakan-wilayah.mjs) | Memetakan nama wilayah SIRS ke kode wilayah resmi; 513/513 berhasil, 6 alias eksplisit. |
| [`impor-statistik-faskes.mjs`](impor-statistik-faskes.mjs) | **Pengisi statistik fasilitas nasional** — 6 kategori Kemenkes 2024 + pembanding BPJS, beserta 4 rujukan pengembangan. `--cari`/`--kering`, aman diulang. Lihat [Statistik fasilitas nasional](#statistik-fasilitas-nasional--angka-resmi-dan-artinya). |
| [`bersihkan-duplikat-faskes.mjs`](bersihkan-duplikat-faskes.mjs) | **Pembersih duplikat faskes** — dry run secara bawaan, `--terapkan` untuk menghapus. Aturannya di `app/server/dedupFaskes.js` (fungsi murni, diuji `uji-dedup-faskes.mjs`): duplikat dalam satu sumber (nama sama, ≤50 m; nama generik ≤5 m) dan lintas sumber (nama + provinsi + kabupaten sama → koordinat OSM dipindahkan ke baris SIRS, `kode_osm` disimpan sebagai rujukan). 12 Nov 2026: 553 baris dibersihkan, 21.477 → 20.924. |
| [`tarik-faskes-nasional.mjs`](tarik-faskes-nasional.mjs) | **Penarik faskes nasional dari OpenStreetMap** — 38 provinsi lewat kode ISO 3166-2 (nama provinsi didapat tanpa geocoding), kueri `nwr` karena apotek/klinik sering dipetakan sebagai bangunan. Idempoten lewat `kode_osm` unik. ±42 menit untuk seluruh Indonesia; `--provinsi ID-JB` untuk satu provinsi. |
| [`petakan-kabupaten-faskes.mjs`](petakan-kabupaten-faskes.mjs) | **Pengisi kabupaten/kota dari batas wilayah resmi** — geoBoundaries ADM2 (519 kab/kota, sumber BPS, CC BY 3.0 IGO), titik-di-dalam-poligon. Terukur: 17.684 baris terisi, 20 tidak jatuh di poligon mana pun (dibiarkan NULL). |
| [`panaskan-faskes.mjs`](panaskan-faskes.mjs) | **Pemanas simpanan faskes sebelum demo** — mengisi `fasilitas` + `cakupan_faskes` untuk lokasi yang akan ditunjukkan, supaya tombol Cari menjawab dari database. Lihat [Tombol "Cari"](#tombol-cari-tidak-lagi-membuat-juri-menunggu). |
| [`panen-pengetahuan.mjs`](panen-pengetahuan.mjs) | **Pengisi database pengetahuan** — mengambil teks asli dari sumber resmi (bukan karangan AI). Lihat [Di mana datanya disimpan](#di-mana-datanya-disimpan). |
| [`jalankan-online.sh`](jalankan-online.sh) | Build → server → Cloudflare Tunnel → cetak alamat publik. Lihat [Membuka aplikasi ke internet](#membuka-aplikasi-ke-internet-tapi-tetap-berjalan-di-laptop-sendiri). |
| [`buat-dump-database.sh`](buat-dump-database.sh) + [`periksa-dump-database.sh`](periksa-dump-database.sh) | **Pembuat dan pemeriksa dump database** yang dibagikan di repo. Generator memakai dua lintasan `mysqldump` (struktur + data tanpa baris `percakapan`); pemeriksa menolak dump yang memuat tabel akun, baris percakapan, atau jumlah tabel selain 15. Dijalankan juga di CI. |
| [`ambil-tangkapan-dashboard.mjs`](ambil-tangkapan-dashboard.mjs) | Mengambil 10 tangkapan dashboard: 7 halaman pada 1440×900, 2 tampilan ponsel, 1 mode kontras tinggi. Jawaban Tanya AI dan putusan Cek Klaim diambil dari permintaan sungguhan. |
| [`ambil-tangkapan.mjs`](ambil-tangkapan.mjs) | Mengambil 5 tangkapan Fasilitas Kesehatan lewat Chrome + CDP, termasuk mengetik sungguhan untuk membuktikan pencarian menyaring. |
| [`ambil-tangkapan-prototipe.mjs`](ambil-tangkapan-prototipe.mjs) | Mengambil 10 bagian halaman penjelasan + 2 tampilan ponsel, menggulir per bagian dan menunggu posisi gulir benar-benar sampai. |
| [`uji-*.mjs`](.) | **38 berkas uji** — 33 di antaranya berjalan lewat `npm test` tanpa jaringan dan tanpa API key; `uji-peramban.mjs` dan `uji-halaman-penjelasan.mjs` butuh server + Chrome; `uji-layanan-peta.mjs` memanggil layanan peta publik sungguhan; `uji-jawaban.mjs` butuh server lokal + API key; `uji-semua.mjs` adalah runner-nya (lihat [Menjalankan uji](#menjalankan-uji)). Angka ini diperiksa ulang 7 Nov 2026 dan diuji `uji-dokumentasi.mjs` — supaya tidak bisa lagi tertinggal diam-diam. |
| [`ukur-*.mjs`](.) | Pengukuran untuk **memilih angka batas** (panjang, suara, tingkat baca, luas pengetahuan) — bukan uji rutin. |
| [`verifikasi-judul.mjs`](verifikasi-judul.mjs) | Membuktikan setiap judul artikel Wikipedia yang dipetakan benar-benar ada. |
| [`periksa-istilah.mjs`](periksa-istilah.mjs) | Memeriksa calon istilah baru ke API sebelum masuk peta pencarian. |
| [`mermaid-diagram.png`](mermaid-diagram.png) | Sumber alur daur konten harian (dipakai `app/server/konten.js`). |
| [`docs/verifikasi-*.md`](docs) | **Berkas pendukung.** Laporan verifikasi setiap angka di bagian "Masalah" — memastikan klaimnya berasal dari dokumen yang bisa dibuka, bukan dari ingatan. |
| [`docs/latih-tingkat-*.json`](docs) | **16 berkas hasil pengukuran** tingkat baca + 1 usulan sasaran, dipakai `ukur-kalibrasi.mjs` untuk menurunkan `SASARAN`. |
| [`docs/sumber-hls-sf12.txt`](docs/sumber-hls-sf12.txt) | Instrumen HLS-SF12 asli + teks Indonesia tervalidasi. |

### Sumber data di halaman penjelasan

Setiap angka di bagian **Latar Belakang & Masalah** diusahakan punya rujukan yang
bisa dibuka. Empat angka kunci ("Kunci Temuan") sudah dilacak sampai **PDF
dokumen primernya** — diunduh dan teks penuhnya diekstrak, bukan dari abstrak
pihak ketiga. Angka yang belum punya sumber tetap **ditandai terbuka** di
halaman dengan label `perlu rujukan`, bukan dihapus diam-diam dan bukan
diklaim seolah ada sumbernya.

Satu angka yang tadinya tanpa sumber — **"materi kesehatan setara kelas 12,8"** —
sekarang punya rujukannya: Ayre dkk. (2024), *Journal of General Internal
Medicine* 39(4):573–577, doi:10.1007/s11606-023-08469-w. Studi itu mengukur 26
teks informasi kesehatan dari situs web ternama (Australia, bahasa Inggris):
rata-rata **kelas 12,8** dengan SMOG, sedangkan targetnya kelas 8. Sifat studi
itu disebut apa adanya di halaman — bukan survei materi Indonesia.

Verifikasi itu juga menemukan **tiga kekeliruan** yang sudah dibetulkan:

| Dulu tertulis | Yang benar |
|---|---|
| Cakupan imunisasi "turun 95% → 80%" | 93,7% (2019) → 84,5% (2021). Angka 95% adalah **target** kekebalan kelompok, bukan capaian |
| Remaja 15–18 tahun "72% literasi rendah" | Dari responden yang berliterasi rendah, kelompok 15–18 tahun adalah **proporsi terbesar (72%)** — bukan 72% remaja berliterasi rendah |
| Puskesmas tanpa dokter "50% di Maluku & Papua" | 48,18% hanya untuk **Papua** (Papua Barat 42,07%; **Maluku 23,45%**; nasional 6,9%, SISDMK 2020) |

Laporan lengkapnya ada di `docs/verifikasi-klaim-kesehatan.md`,
`docs/verifikasi-klaim-tambahan.md`, dan `docs/verifikasi-studi-literasi-kesehatan.md`.

### Alamat di situs

| Alamat | Isi |
|---|---|
| `/` | halaman penjelasan — yang muncul pertama kali dibuka |
| `/app/` | aplikasi yang bisa dipakai |
| `/privasi.html` | kebijakan privasi tersendiri: data yang diproses, pihak ketiga, hak pengguna, kanal kontak |
| `/prototipe/` | salinan halaman penjelasan (tautan lama tetap hidup) |
| `/api/...` | backend |

```
pahami-sehat/
├── .github/workflows/uji.yml  ← integrasi berkelanjutan (uji + build)
├── LICENSE                    ← MIT
├── README.md
├── jalankan-online.sh         ← build + server + Cloudflare Tunnel
├── siapkan-domain.sh          ← INERT: hanya untuk named tunnel (lihat catatan)
├── uji-*.mjs                  ← 38 berkas uji (33 tanpa jaringan)
├── ukur-*.mjs                 ← pengukuran untuk memilih angka batas
├── verifikasi-judul.mjs
├── periksa-istilah.mjs
├── panen-pengetahuan.mjs
├── impor-statistik-faskes.mjs ← statistik nasional (Kemenkes/BPJS) ke MySQL
├── lengkapi-wilayah-faskes.mjs ← isi provinsi faskes OSM (geocoding balik)
├── panaskan-faskes.mjs       ← pemanas simpanan faskes sebelum demo
├── buat-dump-database.sh     ← tulis ulang docs/database/pahami-sehat.sql
├── periksa-dump-database.sh  ← tolak dump yang memuat data pribadi
├── mermaid-diagram.png
├── app/                       ← PRODUK UTAMA (React + Express + Tailwind)
│   ├── .env                   ← API key Kenari (JANGAN di-commit, mode 600)
│   ├── .env.example
│   ├── public/ocr/            ← mesin OCR: worker, core WASM, data bahasa (17 MB)
│   ├── scripts/               ← salin-prototipe, mampatkan-dist, bebaskan-port
│   ├── server/                ← backend Express (32 berkas)
│   ├── src/                   ← frontend React: App.jsx, lib/, data/, components/
│   ├── api/index.js           ← pintu masuk serverless Vercel
│   ├── index.html
│   ├── package.json
│   ├── vercel.json
│   └── vite.config.js
└── docs/
    ├── prototipe/             ← halaman penjelasan (statis, tanpa build)
    │   ├── index.html
    │   ├── css/
    │   ├── js/
    │   └── assets/
    ├── tangkapan-layar/       ← 27 tangkapan layar
    ├── database/              ← dump isi database (15 tabel, tanpa baris percakapan)
    │   └── pahami-sehat.sql
    ├── skema-database.sql
    ├── sumber-hls-sf12.txt
    └── verifikasi-*.md
```

Dua bagian ini saling menaut: sidebar di `app/` punya tombol **"Kembali ke situs"**
ke halaman penjelasan, dan navbar `docs/prototipe/` punya tombol **"Coba Demo"**
ke aplikasi.

---

## Arsitektur

```mermaid
flowchart TB
  subgraph Peramban["Peramban — React 19 + Vite 8 + Tailwind 4 + Radix"]
    UI["Antarmuka (7 menu)<br/>Beranda · Tanya AI · Cek Klaim · Fasilitas Kesehatan<br/>Riwayat · Kuesioner · Pengaturan"]
    OCR["Mesin OCR<br/>tesseract.js / WebAssembly"]
    LS[("localStorage<br/>sesi · kuesioner · setelan")]
    PETA["Peta Leaflet + OpenStreetMap<br/>ubin + penanda berkelompok"]
    RADIX["Radix primitives<br/>sakelar · laci menu · tooltip<br/>fokus & Escape ditangani pustaka"]
  end

  subgraph Server["Express 5 — lokal; Vercel Serverless saat produksi"]
    B["Pembatas laju<br/>20 permintaan/menit per IP + batas total per instance"]
    R["Rute /api/*"]
    DBJ["app/server/db.js<br/>jembatan database — OPSIONAL<br/>gagal = null + alasanGagal, tidak melempar"]
  end

  subgraph Simpanan["MariaDB (XAMPP) — di laptop sendiri"]
    T1[("berita")]
    T2[("konten")]
    T3[("pengetahuan<br/>salinan berlabel tanggal")]
    T4[("sumber")]
    T5[("percakapan<br/>teks 7 hari, tanpa identitas")]
    T6[("dokumen · sitasi<br/>jejak sumber yang dikutip")]
    T7[("wilayah · kategori_fasilitas<br/>fasilitas + sumber & kedaluwarsa")]
    T8[("statistik_faskes · sumber_data_faskes<br/>angka resmi Kemenkes & BPJS, 7 Nov 2026")]
  end

  subgraph Luar["Layanan luar"]
    K["Kenari.id<br/>deepseek-v4-1-flash"]
    W["Wikipedia bahasa Indonesia"]
    M["MedlinePlus<br/>wsearch.nlm.nih.gov"]
    N["RSS berita kesehatan<br/>Detik Health · WHO · Google News"]
    MS["Microsoft Edge TTS<br/>suara neural via WebSocket"]
    OV["Overpass API<br/>OpenStreetMap"]
    PH["Photon<br/>autocomplete alamat"]
    VH["Valhalla<br/>rute jalan kaki · motor"]
    OS["OSRM routed-car / routed-foot<br/>rute mobil · pejalan kaki"]
    NM["Nominatim<br/>geocoding balik · titik referensi wilayah"]
    WID["wilayah.id<br/>38 provinsi, kode bertitik"]
  end

  UI --> B --> R
  UI <--> LS
  UI --> OCR
  UI --> PETA
  UI --> RADIX
  OCR -.->|"tidak pernah keluar<br/>dari perangkat"| OCR

  R -->|"kata kunci terpilih"| W
  R -->|"istilah Inggris"| M
  R -->|"pertanyaan berita"| N
  R -->|"sumber + pertanyaan"| K
  R -->|"teks"| MS
  R -->|"radius + koordinat"| OV
  OV -->|"fasilitas (ODbL)"| R
  R -->|"kueri alamat"| PH
  PH -->|"kandidat + koordinat"| R
  R -->|"asal + tujuan + moda"| VH
  VH -->|"jarak, waktu, langkah"| R
  R -->|"asal + tujuan + moda"| OS
  OS -->|"jarak, waktu, langkah"| R
  R -->|"kode wilayah"| WID
  R -->|"koordinat -> alamat + wilayah"| NM
  MS -->|"audio MP3"| R
  K -->|"jawaban + sumber yang dikutip"| R
  R -->|"jawaban"| UI

  R --> DBJ
  DBJ --> T1
  DBJ --> T2
  DBJ --> T3
  DBJ --> T4
  DBJ --> T5
  DBJ --> T6
  DBJ --> T7
  DBJ --> T8

  classDef store fill:#eef,stroke:#446,color:#113
  classDef opsional fill:#ffe9c9,stroke:#a63,color:#420,stroke-dasharray:4 3
  class LS store
  class T1,T2,T3,T4,T5,T6,T7,T8 store
  class DBJ opsional
```

### Alur satu pertanyaan

1. **Peramban** mengirim pertanyaan ke `POST /api/tanya` (atau `/api/tanya/stream`
   untuk jawaban yang muncul bertahap).
2. **Pembatas laju** memeriksa jumlah permintaan dari alamat IP itu.
3. **Jalur berita** diperiksa lebih dulu (`menanyakanBerita()`). Pertanyaan
   seperti "berita terbaru hari ini" atau "latest health news today" tidak
   dijawab dari ensiklopedia — Wikipedia tidak punya berita harian. Pertanyaan
   itu dijawab dari **RSS** (Detik Health, WHO, Google News), dan setiap berita
   disebutkan beserta **nama medianya** dan **umurnya**. Di dalam aplikasi
   kesehatan, pertanyaan berita tidak perlu menyebut kata "kesehatan" — tetapi
   permintaan berita tentang topik yang jelas bukan kesehatan (politik, bola,
   ekonomi) ditolak dan dijawab sebagai obrolan biasa.
4. **Lapis pencarian** memilih **satu istilah** dari pertanyaan
   (`pilihIstilah()` di `app/server/kataKunci.js`). Nama penyakit selalu menang
   atas kata gejala; kata tindakan seperti `penyebab` atau `operasi` tidak pernah
   dipilih selama ada istilah yang lebih khusus.
5. Istilah itu dipetakan ke **dua bentuk berbeda**, karena dua mesin pencari
   memakai kosakata yang berbeda:
   - Wikipedia ID memakai **judul artikel kanonik** (`PETA_PENCARIAN`,
     **219 entri**), mis. `stunting` → `Hambatan pertumbuhan`.
   - MedlinePlus memakai **istilah Inggris** (`PETA_MEDLINEPLUS`,
     **262 entri**), mis. `rontgen` → `xrays`.
6. **Model AI** menerima pertanyaan + hasil pencarian, lalu menjawab **hanya**
   dari bahan itu. Prompt melarang menambah fakta dari ingatan.
7. Jawaban kembali bersama **sumber yang benar-benar dikutip**, dan panel
   `SumberJawaban` membedakan sumber yang **dipakai** dari yang cuma **ditemukan**.

Diagram urutan untuk satu pertanyaan — termasuk jalur gagal yang paling sering
terjadi (database mati, layanan luar tidak menjawab):

```mermaid
sequenceDiagram
  autonumber
  participant U as Pengguna (peramban)
  participant E as Express /api/tanya
  participant B as Pembatas laju
  participant K as kataKunci.js
  participant W as Wikipedia / MedlinePlus
  participant N as RSS berita
  participant M as Kenari.id (model)
  participant D as MariaDB (opsional)

  U->>E: POST /api/tanya {pertanyaan, tingkat, bahasa}
  E->>B: cek 20 permintaan/menit per IP
  alt melewati batas
    B-->>U: 429 {ok:false, code:"batas_laju"}
  end
  E->>K: menanyakanBerita() ?
  alt pertanyaan berita
    K->>N: ambil judul terbaru
    N-->>K: judul + media + umur
    K-->>E: bahan berita
  else pertanyaan medis
    E->>K: pilihIstilah() -> PETA_PENCARIAN / PETA_MEDLINEPLUS
    K-->>E: satu istilah, dua bentuk
    E->>W: cari judul kanonik + istilah Inggris
    W-->>E: teks sumber (atau kosong)
  end
  E->>D: simpan/ambil konteks percakapan (7 hari)
  D-->>E: konteks, atau null bila DB mati
  E->>M: prompt + bahan + rubrik wajib
  M-->>E: jawaban + sumber yang dikutip
  E->>D: catat dokumen + sitasi (sesudah respons dikirim)
  E-->>U: {jawaban, sumber[], poinKunci[]}
  Note over E,U: DB mati = jawaban tetap keluar, tanpa konteks.<br/>Layanan luar gagal = sumber kosong + keterangan, bukan jawaban karangan.
```

### Tanpa akun — tidak ada gerbang masuk

Diperiksa 20 Okt 2026: **aplikasi langsung terbuka di Beranda.** Tidak ada
halaman masuk, pendaftaran, kata sandi, sesi, atau cookie. Halaman login dihapus
beserta seluruh bagian yang menopangnya, supaya tidak ada sisa gerbang yang bisa
muncul lagi.

Yang ikut dihapus, bukan hanya disembunyikan:

| Bagian | Keadaan |
|---|---|
| `app/src/components/LoginPage.jsx` | dihapus |
| `app/src/lib/useAkun.js` | dihapus |
| `app/server/ruteAkun.js`, `akun.js`, `google.js` | dihapus — `/api/akun/*` kini menjawab **404 JSON** |
| `docs/skema-akun.sql` (`pengguna_baru`, `sesi`, `riwayat_pengguna`) | dihapus |
| `uji-akun.mjs`, `uji-google.mjs` | dihapus |
| Kartu Akun di panel Pengaturan (ganti nama, keluar) | dihapus |
| Kunci kamus `set.akun*` dan `beranda.sapaNama` | dihapus; sapaan kembali "Halo!" |
| Variabel `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `VITE_GOOGLE_CLIENT_ID` | dihapus dari `.env` dan `.env.example` |

**Tidak ada IDENTITAS pengguna yang tersimpan di server.** Riwayat obrolan,
jawaban kuesioner, dan setelan tinggal di `localStorage` peramban. Sejak
22 Okt 2026 server menyimpan **teks percakapan** (tanpa nama, tanpa alamat IP,
tanpa akun) selama **7 hari** sebagai konteks pertanyaan lanjutan — lihat
tabel di bawah dan bagian **Konteks percakapan**.

### Di mana datanya disimpan

| Data | Tempat | Bertahan setelah halaman ditutup? |
|---|---|---|
| Sesi obrolan | `localStorage` (`pahami-sehat:sesi`) | ya, sampai dihapus pengguna (maks. 20 obrolan) |
| Jawaban kuesioner | `localStorage` | ya |
| Setelan bahasa / tingkat baca / kontras / suara | `localStorage` (`pahami-sehat:setelan`) | ya |
| Foto yang dipindai | **tidak disimpan ke mana pun** — dibaca di memori peramban | tidak |
| Teks percakapan (konteks lanjutan) | tabel `percakapan` di MariaDB — **hanya teks, tanpa identitas**, dihapus otomatis setelah **7 hari** | ya, maksimal 7 hari |
| Akun | **tidak ada** — tidak ada tabel akun, sesi, atau cookie | — |

**Riwayat hanya ada di perangkat ini.** Tidak ada sinkronisasi lintas
perangkat, dan itu bukan kekurangan yang disembunyikan: tanpa akun, memang
tidak ada tempat menautkan riwayat ke seseorang. Menghapus riwayat di satu
peramban tidak memengaruhi peramban lain, karena keduanya tidak pernah
terhubung.

**Database bersifat OPSIONAL, dan itu dijaga di kode.** MariaDB (lewat XAMPP)
dipakai untuk menyimpan **bahan**, **teks percakapan**, dan **fasilitas
kesehatan yang sudah pernah diambil**. Kalau MariaDB mati, bahan tetap tersaji
memakai berkas cache, jawaban tetap diberikan tanpa konteks, dan fasilitas
diambil langsung dari OpenStreetMap — `app/server/db.js` mengembalikan `null`
alih-alih melempar galat.

Dibuktikan ulang 20 Okt 2026 dengan `DB_MATI=1`:

| Yang diperiksa | Hasil |
|---|---|
| `GET /api/health` | **HTTP 200**, `{"db":{"aktif":false,"alasan":"dimatikan lewat DB_MATI=1"}}` |
| `GET /api/konten` | **HTTP 200** |
| `GET /api/berita/ringkas` | **HTTP 200** |
| `POST /api/tanya` | **HTTP 200**, jawaban 1.359 karakter, **5 sumber** |
| `GET /api/akun/saya` | **HTTP 404** — rute akun sudah tidak ada |

#### Yang disimpan di database

| Tabel | Isi | Padanan sebelumnya |
|---|---|---|
| `berita` | judul berita RSS, `sidik` UNIQUE mencegah duplikat | `.cache-berita.json` |
| `konten` | artikel & tips harian dari Kemenkes RI dan CNN Indonesia | `.cache-konten.json` |
| `pengetahuan` | **331 topik medis** dari sumber resmi, salinan berlabel tanggal | (baru) |
| `sumber` | lembaga resmi (Kemenkes, WHO, BPOM, NIH, CDC, …) — **12 baris di skema**, bertambah saat panen | (baru) |
| `dokumen` + `sitasi` | **jejak sumber yang dikutip** — klaim "jawaban ini dari WHO" jadi bisa **dilacak**, bukan cuma ditulis | (baru) |
| `wilayah` | **kode wilayah administratif** 4 tingkat (provinsi → desa/kelurahan), kode bertitik disimpan apa adanya | (baru, 4 Nov 2026) |
| `kategori_fasilitas` | sepuluh kategori fasilitas kesehatan + warna penandanya | (baru, 4 Nov 2026) |
| `fasilitas` | fasilitas kesehatan hasil Overpass, **beserta `sumber`, `sumber_url`, `diperbarui_pada`, dan `kedaluwarsa_pada`** | `.cache-faskes.json` |
| `statistik_faskes` | **angka resmi** fasilitas nasional (Kemenkes 2024: 6 kategori, total 49.548; pembanding BPJS September 2026), **beserta kalimat cakupannya** | (baru, 7 Nov 2026) |
| `sumber_data_faskes` | **4 rujukan pengembangan** (Profil Kesehatan Indonesia 2025, Statistik Faskes BPS 2025, SATUSEHAT Data, Data Faskes Mitra JKN) + data yang tersedia di masing-masing | (baru, 7 Nov 2026) |
| `cakupan_faskes` | **daftar lokasi yang sudah dipanaskan** supaya tombol Cari menjawab dari database sebelum demo | (baru, 8 Nov 2026) |
| `sinkron_fasilitas` | **log setiap tarikan SIRS** — mulai, selesai, status, jumlah baru/berubah/tetap, pesan galat | (baru, 4 Nov 2026) |
| `catatan_sumber` | catatan keadaan tiap sumber data (kapan terakhir diperiksa, apa yang berubah) | (baru, 4 Nov 2026) |

Tidak ada tabel akun di skema mana pun. `skema-database.sql` malah
menjalankan `DROP TABLE IF EXISTS riwayat, setelan, pengguna` untuk
membersihkan sisa pemasangan lama — jadi tidak ada tabel identitas yang bisa
terisi lagi tanpa sengaja.

Isi database pada 14 Nov 2026 (hitungan langsung lewat `COUNT(*)`, bukan
perkiraan `table_rows`): `fasilitas` **20.924** · `wilayah` **7.837** ·
`pengetahuan` **331** (270 dari MedlinePlus, 61 dari Wikipedia) · `sitasi` **1.074** ·
`dokumen` **124** · `konten` **100** · `sumber` **23** · `berita` **21** ·
`kategori_fasilitas` **10** · `statistik_faskes` **9** · `sumber_data_faskes` **4** ·
`cakupan_faskes` **19** · `sinkron_fasilitas` **2** · `catatan_sumber` **1** ·
`percakapan` **34**. Seluruhnya bisa dimuat dari dump di repo.

#### Jejak sitasi — cara memeriksanya

Setiap jawaban yang menyertakan sumber akan mencatatnya ke `dokumen` + `sitasi`,
**setelah** respons dikirim supaya pengguna tidak ikut menunggu. Untuk
memeriksa:

```bash
curl -s http://127.0.0.1:8787/api/sitasi
```

Yang dijaga:

- **Hanya URL `http(s)`** yang dicatat — sama seperti penyaring di
  `bentukHasil()`. `javascript:` dan `data:` ditolak, jadi model tidak bisa
  menyelipkan skema lain ke dalam tabel.
- **Anti-duplikat berdasarkan URL**: URL yang sama tidak menambah baris, hanya
  memperbarui tanggalnya. Kalau tidak dijaga, tabel membengkak satu baris
  setiap kali pengguna bertanya. (Kolom `url` panjangnya 700 karakter sehingga
  tidak bisa diberi `UNIQUE` langsung — pengecekannya dilakukan di kode.)
- **`kedaluwarsa` tetap ditegakkan** (30 hari untuk dokumen): baris yang sudah
  basi tidak ikut tersaji.
- **Pertanyaan pengguna tidak ikut masuk tabel sitasi** — endpoint `/api/sitasi`
  sengaja hanya menampilkan sumber mana dipakai untuk jenis jawaban apa, kapan.
  (Teks percakapan punya tabelnya sendiri, `percakapan`, dengan umur 7 hari —
  lihat bagian **Konteks percakapan**.)

Diuji `uji-sitasi.mjs` (**15 pemeriksaan**). Uji itu punya dua bagian: yang
**murni** (tanpa jaringan/database — aturan penolakan URL) dan yang
**terhubung** (butuh MariaDB). Kalau database mati, bagian kedua **dilewati
dengan pesan jelas dan exit 0** — bukan gagal, karena database memang opsional.

#### Satu aturan yang ditegakkan database sendiri

Setiap baris yang memuat informasi medis **wajib** punya kolom `kedaluwarsa`
(`NOT NULL`), dan penyajiannya selalu menyaring `WHERE kedaluwarsa > NOW()`.

```sql
INSERT INTO pengetahuan (topik, jenis, isi, sumber_id, url_sumber, diambil_pada)
VALUES ('uji','penyakit','x',1,'http://x',NOW());
-- ERROR 1364 (HY000): Field 'kedaluwarsa' doesn't have a default value
```

Alasannya bukan kerapian, tapi keselamatan: menyajikan panduan medis yang sudah
kadaluwarsa bukan bug teknis, itu risiko kesehatan. Baris yang basi **tidak
tersaji** — aplikasi harus mengambil ulang dari sumber resmi.

#### Domain yang dianggap "sumber resmi" — dan bug yang pernah ada di daftarnya

Penanda `[SUMBER RESMI]` ditentukan oleh daftar `RESMI` di `app/server/cari.js`.
Daftar itu diperiksa lewat `resmikah()` yang menentukan **prioritas** dokumen:
dokumen lembaga resmi didahulukan dan ditandai, yang lain tidak.

Diukur 2 Nov 2026 ditemukan salah ketik yang berdampak nyata: daftar berisi
`pom.go.id`, **domain yang tidak ada**; domain BPOM yang sebenarnya
`bpom.go.id`. Akibatnya `resmikah('https://www.bpom.go.id/…')` mengembalikan
`false`, sehingga tautan BPOM yang ditautkan pada artikel rujukan **tidak
pernah** diberi tanda resmi — padahal halaman penjelasan menjanjikan BPOM
sebagai salah satu sumbernya. Sudah diperbaiki, dan `resmikah()` sekarang
diekspor supaya bisa diuji: `uji-sumber.mjs` memeriksa 6 URL yang harus
dianggap resmi dan 4 yang tidak boleh (termasuk penyusup
`bpom.go.id.penipu.test` — pencocokan domain tidak boleh asal "mengandung").

Yang benar-benar dipanggil saat menjawab: **Wikipedia bahasa Indonesia** (isi
artikel) dan **MedlinePlus / NIH** (`wsearch.nlm.nih.gov`). Dokumen resmi lain
— Kemenkes, WHO, BPOM, NIH, CDC — masuk sebagai **tautan eksternal yang ada di
dalam artikel rujukan itu**, lalu difilter `resmikah()`; aplikasi tidak mencari
langsung ke situs masing-masing lembaga.

#### Asal 331 topik itu — dan kenapa bukan karangan AI

`panen-pengetahuan.mjs` **mengambil teks asli** dari sumber resmi, bukan
menyuruh model menulis dari ingatannya. Model bisa salah dosis atau mencampur
dua penyakit, dan kesalahan itu akan tersimpan rapi seolah fakta.

| Sumber | Baris | Ditandai |
|---|---|---|
| MedlinePlus (Perpustakaan Kedokteran Nasional AS, bagian NIH) | 270 | `resmi = 1` |
| Wikipedia bahasa Indonesia (pelengkap) | 61 | `resmi = 0` |

Setiap baris menyertakan `url_sumber` yang bisa diperiksa pengguna. Hasil akhir
(diukur 18 Okt 2026): **331 baris, 0 tanpa URL**, rata-rata **2.325 karakter**
(terpendek 125, terpanjang 7.196), masa berlaku **90 hari**. Tiga jebakan yang
ditemukan dan ditutup: istilah Indonesia tidak ditemukan di MedlinePlus (wajib
lewat `PETA_MEDLINEPLUS`), salah tangkap topik ("luka" pernah tersimpan sebagai
penjelasan cedera **bahu**), dan URL artikel yang ternyata ada di **atribut**
tag XML — kesalahan itu sempat membuat semua tautan menunjuk halaman depan
`medlineplus.gov`.

---

## Konteks percakapan (22 Okt 2026)

Tanpa konteks, setiap pertanyaan dijawab **sendirian**. Akibatnya pertanyaan
lanjutan yang tidak menyebut topiknya lagi — *"terus gimana udah terlanjur
nih"* — dicari memakai kata sambungnya sendiri (`terus gimana udah`), tidak
menemukan sumber apa pun, lalu dijawab dengan kalimat generik. Bagi pengguna
itu terbaca sebagai percakapan yang **tidak nyambung**, padahal setiap jawaban
benar untuk pertanyaannya masing-masing.

Empat sebabnya, dan semuanya diperbaiki:

| Sebab | Perbaikan |
|---|---|
| Pertanyaan lanjutan tidak dikenali | `pertanyaanLanjutan()` di `prompts.js` — aturan yang bisa diuji, bukan tebakan model |
| Bahan pencarian memakai kata sambung | Kalau pertanyaannya lanjutan, yang dicari adalah **topik terakhir** (`topikTerakhir()` di `rute.js`) |
| Riwayat tidak pernah masuk prompt | `blokRiwayat()` — riwayat dikirim sebagai **konteks, bukan sumber** |
| Nada tingkat anak seperti bicara ke balita | Nada & larangan `TINGKAT.anak` diperbaiki |

**Riwayat adalah KONTEKS, bukan SUMBER.** Isi jawaban lama tidak boleh menjadi
dasar fakta baru, karena jawaban lama bisa keliru. Fakta tetap harus datang
dari hasil pencarian pada giliran itu — aturan ini ditulis tegas di prompt
(`blokRiwayat()`), karena model cenderung mengulang jawaban sebelumnya sebagai
"kebenaran".

### Batas yang disengaja

| Hal | Nilai | Alasan |
|---|---|---|
| Yang disimpan | **hanya teks** giliran percakapan | tanpa nama, tanpa IP, tanpa akun |
| `id_sesi` | penanda acak `s<timestamp>` dari peramban | mengelompokkan giliran, **bukan** identitas orang |
| Umur simpan | **7 hari** (`MAKS_UMUR_HARI`) | ini konteks, bukan arsip |
| Konteks yang dipakai | **8 giliran** terakhir (`MAKS_GILIRAN_KONTEKS`) | lebih dari itu mengaburkan topik |
| Database mati | jawaban tetap diberikan, **tanpa konteks** | konteks hilang ≠ aplikasi rusak |

Pembersihan berjalan **sekali saat server mulai, lalu tiap 6 jam**
(`bersihkanPercakapan()` di `db.js`, dipanggil dari `index.js`). Tidak
di-`await` dan timernya `unref()` — aplikasi harus siap menerima permintaan
walau pembersihan lambat.

**Sapaan tetap sapaan.** `pertanyaanLanjutan()` memeriksa pola sapaan lebih
dulu, jadi "halo" di tengah percakapan tidak dianggap pertanyaan lanjutan
hanya karena pendek. Tanpa penjagaan itu, pengguna yang menyapa akan menerima
jawaban tentang ginjal.

Dijaga `uji-konteks.mjs` (**49 pemeriksaan**, tanpa jaringan/database/kunci).

---

## Penyaring klaim prognosis (22 Okt 2026)

Diukur 22 Okt 2026: model menulis **"banyak orang dengan satu ginjal tetap hidup
normal"** padahal tidak satu pun sumber memuatnya — lalu menyebutkannya di
`catatan` seolah sudah jujur. Pembaca tetap mempercayai kalimatnya. Aturan prompt
sudah dipertegas, dan putaran berikutnya dengan pertanyaan yang sama melanggar
lagi. **Aturan prompt tidak bisa dipercaya sebagai pengaman.**

Karena itu pengamannya dipindah ke kode: `app/server/klaim.js`, dipanggil
`saringHasil()` di **ketiga** titik jawaban `/api/tanya` (non-stream, stream,
dan percobaan ulang).

### Batas kemampuan yang diakui terbuka

Percobaan pertama mencoba membandingkan **kata** jawaban dengan kata sumber. Itu
**gagal dan sudah dibuang**: sumber MedlinePlus berbahasa **Inggris**, jawaban
berbahasa **Indonesia** — "penyakit ginjal kronis" tidak akan pernah bertemu
"chronic kidney disease", sehingga kalimat yang **benar** ikut terbuang. Positif
palsu seperti itu lebih merugikan daripada tidak ada penyaring sama sekali.

Yang dipakai sekarang hanya menangani **satu kelas klaim** yang bisa diperiksa
tanpa mencocokkan kata lintas bahasa: **klaim prognosis** (harapan hidup, bisa
hidup normal, aman bagi sekelompok orang). Pemeriksaannya tidak bergantung pada
nama penyakitnya, melainkan pada satu pertanyaan:

> Apakah sumber pada giliran ini **membahas prognosis sama sekali**?

Kalau sumber tidak pernah menyebut harapan hidup / bertahan hidup / hidup normal
(Indonesia maupun Inggris), klaim prognosis apa pun tidak punya dasar. Klaim lain
(definisi, gejala, penanganan) **tidak disentuh**.

### Empat pengaman agar tidak merusak jawaban yang benar

| Pengaman | Kenapa |
|---|---|
| Hanya pola prognosis yang dinilai | klaim lain tidak pernah disentuh |
| Kalimat meta/arahan/sapaan **dilindungi** | "sumber tidak memuat…", "periksa ke dokter", "aplikasi ini…" tidak pernah dibuang |
| Sumber membahas prognosis → **tidak menyaring** | kelonggaran disengaja; lebih baik biarkan satu klaim lemah |
| Semua kalimat terkena → **jawaban dikembalikan utuh** | jawaban kosong jauh lebih buruk bagi pengguna |

Daftar berbutir juga dipecah lebih dulu (`daftarKalimat()`), supaya satu butir
salah tidak membuang seluruh daftar.

**Kalau ada yang dibuang, `catatan` menyebutkannya** — pengguna berhak tahu
sebagian jawaban dihapus, bukan menerima jawaban yang tampak utuh.

Dijaga `uji-klaim.mjs` (**43 pemeriksaan**). Perbandingan jumlah pemeriksaan
sengaja condong ke "**TIDAK BOLEH DIBUANG**": penyaring yang salah kalibrasi
lebih berbahaya daripada tidak ada penyaring.

---

## Dokumentasi frontend

### Framework dan pustaka

| Lapisan | Pustaka | Versi terpasang |
|---|---|---|
| Kerangka UI | **React** | 19.3.0 |
| Build & dev server | **Vite** (+ `@vitejs/plugin-react`) | 8.3.2 |
| Gaya | **Tailwind CSS** lewat `@tailwindcss/vite` | 4.3.3 |
| Komponen aksesibel | **Radix UI** — `react-dialog`, `react-switch`, `react-tooltip` | 1.3.1 / 1.4.1 / 1.4.1 |
| Ikon | **lucide-react** | 1.52.0 |
| Peta | **Leaflet** + `leaflet.markercluster` | 1.9.4 / 1.5.3 |
| OCR di peramban | **tesseract.js** (WebAssembly) | 7.0.0 |
| Penggabung kelas | `tailwind-merge` (dibungkus `lib/cn.js`) | 3.7.0 |
| Klien HTTP | `axios` | 1.21.0 |

`shadcn init` **tidak** dipakai: komponen Radix dibungkus sendiri di
`app/src/components/ui/primitives.jsx`, supaya tidak ada lapisan tema yang tidak
kita kendalikan. Gaya global ada di satu berkas, `app/src/index.css` (token
warna, tipografi `clamp()`, `prefers-reduced-motion`).

### Struktur komponen

```
app/src/
├── App.jsx                  state global + routing antar panel (7 menu)
├── index.css                token warna, tipografi, mode kontras tinggi
├── components/
│   ├── layout/    (4)       Sidebar · TopBar · MobileDrawer · nav.js (daftar menu)
│   ├── ui/        (7)       primitives.jsx (Radix) · Button · BatasGalat (error boundary)
│   │                        IlustrasiAnimasi · PanelSalin · ToastBatal · TombolDengar
│   ├── dashboard/ (12)      AskAI · Komposer · ThreadPanel · VerifikasiPanel · QuizPanel
│   │                        SettingsPanel · ArticleGrid · TopicChips · Greeting
│   │                        HealthTip · DaftarObrolan · PemindaiFoto
│   └── faskes/    (2)       FaskesPanel (pembungkus) · FaskesNasionalPanel (daftar 20.924)
├── lib/           (15)      api.js (klien + pembaca SSE) · sesi.js (MAKS_SESI = 20)
│                            useBahasa · useServer · useBerita · useSuara · useRute
│                            useWilayah · useAlamat · ocr.js · tts.js · skorHls.js
│                            keterbacaan.js · cn.js · istilahLayanan.js
└── data/          (3)       bahasa.js (kamus id + en, 380 kunci seimbang)
                             tingkat.js (satu sumber kebenaran tingkat baca) · dummy.js
```

Panel dimuat **lazy** (`React.lazy` + `Suspense`): `QuizPanel`, `VerifikasiPanel`,
dan `FaskesPanel` tidak ikut di bundel awal, jadi unduhan pertama tetap kecil.

**Keadaan disimpan di peramban, bukan di server.** `localStorage` menyimpan sesi
obrolan (maksimal 20), riwayat skor kuesioner (maksimal 10), dan setelan
tampilan. Tidak ada cookie, tidak ada token, tidak ada akun.

### Aset

| Aset | Lokasi | Ukuran / jumlah |
|---|---|---|
| Mesin OCR (worker, core WASM, data bahasa) | `app/public/ocr/` | **17.048.779 byte** (6 berkas) — disajikan lokal, bukan CDN |
| Font Plus Jakarta Sans | `app/src/assets/pjs-var.woff2` | satu berkas variabel |
| Tangkapan layar aplikasi | `docs/tangkapan-layar/` | **27 PNG** (1440×900 dan 390×844 DPR 2) |
| Aset halaman penjelasan | `docs/prototipe/assets/` | 1,5 MB — 9 ilustrasi, 5 tangkapan layar, 1 font, 3 logo/QR |

Ketiga skrip tangkapan (`ambil-tangkapan-dashboard.mjs`, `ambil-tangkapan.mjs`,
`ambil-tangkapan-prototipe.mjs`) menolak menyimpan berkas di bawah 20 KB, jadi
tangkapan yang gagal tidak lolos diam-diam ke halaman publik.

### Aksesibilitas dan responsif

- Breakpoint: `<768px` header + drawer, `768–1023px` sidebar ikon saja, `≥1024px` sidebar penuh.
- Target sentuh ≥44 px, kontras teks ≥4,5:1, `aria-current`/`aria-pressed`/`role=switch`, focus ring, `prefers-reduced-motion`.
- Mode kontras tinggi menaikkan ukuran huruf dasar 112% dan mempertebal garis.
- Dua bahasa penuh (id/en) dengan 380 kunci yang jumlahnya dijaga `uji-bahasa.mjs`.

---

## Dokumentasi backend

### Kerangka dan berkas

Backend adalah **Express 5.3.0** di `app/server/` — **32 berkas**, semuanya ES module.
Yang perlu diketahui sebelum mengubah apa pun:

| Berkas | Tanggung jawab |
|---|---|
| `index.js` | merakit app, menyajikan `dist/`, menangani `EADDRINUSE` |
| `rute.js` | seluruh endpoint `/api/*` (27 rute) |
| `ruteAlamat.js` | `/api/alamat/*` dan `/api/wilayah/lengkap` (3 rute) |
| `config.js` | membaca env, memvalidasi API key, `safeInfo()` tanpa membocorkan key |
| `db.js` | jembatan MariaDB — **tidak pernah melempar**; gagal = `null` + `alasanGagal` |
| `kenari.js` | klien model (chat + streaming SSE) |
| `prompts.js` | rubrik wajib + prompt per fitur |
| `batas.js` / `batasInput.js` | pembatas laju 20 permintaan/menit + `MAKS_TOKEN` per jalur |
| `saji.js` / `kepala.js` | gzip, `X-Waktu-Ms`, 404 JSON, kepala keamanan |
| `faskes.js` / `faskesDb.js` / `faskesNasional.js` | Overpass, simpanan MySQL, daftar nasional |
| `rsSirs.js` / `statistikFaskes.js` | rumah sakit SIRS + angka resmi Kemenkes/BPJS |
| `wilayah.js` / `geocoding.js` / `photon.js` | wilayah bertingkat, deteksi wilayah, autocomplete |
| `rute-perjalanan.js` / `layanan.js` | Valhalla/OSRM, antrean + simpanan semua layanan luar |

### Variabel lingkungan — `app/.env.example`

Salin `app/.env.example` menjadi `app/.env`, lalu isi `KENARI_API_KEY`. Berkas
`.env` **tidak pernah** ikut ter-commit (`.gitignore`) dan harus bermode `600`.

| Variabel | Bawaan | Wajib? | Arti |
|---|---|---|---|
| `KENARI_API_KEY` | — | **ya** | kunci Kenari.id; tanpa ini server menolak start dengan pesan jelas |
| `KENARI_BASE_URL` | `https://kenari.id/v1` | tidak | alamat API model |
| `KENARI_MODEL` | `deepseek-v4-1-flash` | tidak | model yang dipakai |
| `KENARI_REASONING_EFFORT` | `none` | tidak | `none`/`low`; menaikkannya memakan jatah `MAX_TOKENS` |
| `PORT` | `8787` | tidak | port server |
| `MAX_TOKENS` | `1500` | tidak | jatah token jawaban |
| `TEMPERATURE` | `0.3` | tidak | suhu sampling |
| `DB_MATI` | — | tidak | `1` = matikan database sepenuhnya (dipakai uji) |
| `DB_HOST` / `DB_PORT` | `127.0.0.1` / `3306` | tidak | alamat MariaDB |
| `DB_USER` / `DB_PASSWORD` | `root` / kosong | tidak | kredensial XAMPP bawaan |
| `DB_NAMA` | `pahami_sehat` | tidak | nama basis data |

Variabel lain dibaca kode tetapi **tidak** ada di `.env.example` karena hanya
dipakai saat mengukur atau menyiapkan demo: `CACHE_KONTEN`, `CACHE_BERITA`,
`FASKES_BATAS_MS`, `PEMANASAN_TITIK`, `PEMANASAN_RADIUS`, `RUTE_PROVIDER`,
`RUTE_CACHE_MS`, `RUTE_CACHE_MAKS`, `VALHALLA_URL`, `REQUEST_TIMEOUT_MS`
(dipatok maksimum 50 detik), dan `RAHASIA_PAKSA` (hanya untuk uji rute).

### Skema database

Dua berkas, dua keperluan:

| Berkas | Isi |
|---|---|
| `docs/skema-database.sql` | **DDL 12 tabel**, idempoten (`CREATE TABLE IF NOT EXISTS`), aman dijalankan ulang; sekaligus `DROP` tabel akun versi lama |
| `docs/database/pahami-sehat.sql` | **isi database sungguhan** — struktur 15 tabel + seluruh baris (20.924 fasilitas, 7.837 wilayah, 331 topik), tanpa baris `percakapan` |

Tiga tabel dibuat saat aplikasi berjalan, bukan oleh skema: `cakupan_faskes`
(`faskesDb.js`), `sinkron_fasilitas` dan `catatan_sumber` (`impor-sirs.mjs`).
Karena itu database lengkap berisi **15 tabel**, sedangkan `skema-database.sql`
berisi 12.

| Tabel | Isi |
|---|---|
| `sumber` · `dokumen` · `sitasi` | jejak sumber: lembaga, URL yang diambil, dan sitasi per jawaban |
| `konten` · `berita` · `pengetahuan` | bahan: artikel/tips harian, judul RSS, 331 topik medis berlabel tanggal |
| `percakapan` | teks percakapan untuk konteks lanjutan — tanpa identitas, dihapus otomatis 7 hari |
| `wilayah` · `kategori_fasilitas` · `fasilitas` | 7.837 wilayah (38 provinsi / 514 kabupaten / 7.285 kecamatan), 10 kategori, 20.924 faskes |
| `statistik_faskes` · `sumber_data_faskes` | angka resmi Kemenkes 2024 + pembanding BPJS, beserta rujukannya |
| `cakupan_faskes` · `sinkron_fasilitas` · `catatan_sumber` | pemanasan demo, log tarikan SIRS, catatan keadaan sumber |

Aturan yang ditegakkan skema: setiap tabel bermuatan medis wajib punya kolom
`kedaluwarsa` NOT NULL, supaya kode bisa menolak menyajikan panduan basi.

---

## Endpoint

| Metode | Path | Isi |
|---|---|---|
| GET | `/api/health` | status server, key & model, status database |
| GET | `/api/meta` | tingkat baca + model aktif + daftar suara |
| GET | `/api/konten` | 5 topik populer, 18 kartu artikel, tips harian |
| GET | `/api/berita/ringkas` | ringkasan berita untuk lonceng |
| GET | `/api/db` | hitungan + contoh baris (bukan seluruh isi tabel) |
| GET | `/api/sitasi` | sumber mana dipakai untuk jenis jawaban apa |
| POST | `/api/tanya` | jawab pertanyaan, sesuaikan tingkat baca |
| POST | `/api/tanya/stream` | sama, tapi streaming (SSE) |
| POST | `/api/sederhanakan` | terjemahkan teks medis |
| POST | `/api/verifikasi` | periksa klaim kesehatan |
| POST | `/api/suara` | teks → MP3 (suara neural) |
| GET | `/api/faskes` | fasilitas kesehatan di sekitar satu titik (Overpass/OpenStreetMap) |
| GET | `/api/faskes/kategori` | sepuluh kategori fasilitas yang dipakai antarmuka |
| GET | `/api/faskes/:id` | rincian satu fasilitas simpanan menurut id |
| GET | `/api/faskes/nasional` | **pencarian seluruh faskes nasional** — 20.924 baris (SIRS + OpenStreetMap); `?cari=&kategori=&provinsi=&kabupaten=&sumber=&kelas=&koordinat=1&halaman=&perHalaman=&urut=` |
| GET | `/api/faskes/nasional/filter` | pilihan saringan nasional dari database: kategori, provinsi, kabupaten, sumber, kelas, jenis, kepemilikan |
| GET | `/api/faskes/nasional/ringkasan` | jumlah total, berkoordinat, SIRS, OSM, tanpa provinsi, dan per kategori |
| GET | `/api/faskes/nasional/:id` | rincian satu fasilitas nasional menurut id database |
| GET | `/api/faskes/cari-lokasi` | cari lokasi menurut nama tempat (Nominatim) |
| GET | `/api/wilayah` | daftar wilayah administratif bertingkat (`tingkat=provinsi\|kabupaten\|kecamatan\|desa` + `induk=<kode>`) |
| GET | `/api/wilayah/titik` | titik referensi sebuah wilayah beserta tingkat ketelitiannya |
| GET | `/api/rute` | rute perjalanan antar dua titik (`moda=jalan-kaki\|motor\|mobil`, `bahasa=id\|en`) |
| GET | `/api/alamat/cari` | pencarian alamat: **Photon** untuk kandidat, **Nominatim** sebagai cadangan; balasan menyebut `sumberCari` |
| GET | `/api/alamat/titik` | geocoding balik: koordinat → alamat + wilayah |
| GET | `/api/wilayah/lengkap` | provinsi + kabupaten + kecamatan untuk dropdown |
| GET | `/api/rs` | rumah sakit resmi SIRS Kemenkes: cari, filter, paginasi |
| GET | `/api/rs/filter` | pilihan filter (provinsi, kabupaten, jenis, kelas, kepemilikan) |
| GET | `/api/rs/ringkasan` | jumlah RS, berapa berkoordinat, waktu sinkron terakhir |
| GET | `/api/rs/:kode` | rincian satu rumah sakit menurut kode SIRS |
| GET | `/api/statistik-faskes` | statistik fasilitas nasional (Kemenkes 2024, pembanding BPJS) + rujukan; `?cari=` menyaring |

Galat selalu berbentuk `{ ok: false, code, pesan }` — `code` sengaja dipakai UI
untuk memilih pesan yang tepat (`db_mati`, `insufficient_balance`, dan
`input_kosong` ditampilkan berbeda, bukan satu kotak merah yang sama).

### Enam hal yang dijaga di sisi server

- **`app/server/kataKunci.js`** — pengenalan topik kesehatan. Satu daftar
  istilah dipakai bersama oleh `PENGENALAN_TOPIK`, `KATA_KESEHATAN`, dan kedua
  peta pencarian, supaya tidak ada istilah yang dikenali di satu jalur tapi mati
  di jalur lain.
- **`app/server/prompts.js`** — rubrik wajib. Butir 4 melarang mengarang
  sitasi, butir 5 dan 6 melarang memberi diagnosis/resep/dosis dan melarang
  menyimpulkan pengguna mengidap sesuatu.
- **`app/server/batas.js`** + `batasInput.js` — pembatas laju dan anggaran
  token. Penyimpanannya di memori proses, jadi di serverless batas ini
  **per-instance, bukan global** — cukup untuk menahan penyalahgunaan kasar,
  bukan jaminan global. Batasnya disebut apa adanya di komentar berkasnya.
- **`app/server/berita.js`** — jalur berita kesehatan. Parser RSS memperlakukan
  isi media sebagai **data**, bukan instruksi: judul/deskripsi yang menyuruh
  model mengabaikan aturan diabaikan, tag HTML dibuang, link wajib `http(s)`
  (menolak `javascript:` dan `data:`), satu feed dibatasi 30 item dan 2 MB, dan
  tanggal yang tidak sah diperlakukan seperti tanggal kosong — bukan `NaN` yang
  bocor ke pengurutan. Diuji `uji-berita.mjs` (**102 pemeriksaan**).
- **`app/server/db.js`** — jembatan database. Tiga hal yang tidak boleh
  dilanggar: (1) **tidak pernah melempar** — database mati harus menghasilkan
  `null`, bukan galat yang sampai ke pengguna; (2) setelah gagal, koneksi
  berikutnya ditunda 30 detik supaya setiap permintaan tidak ikut menunggu
  timeout; (3) penyajian data medis **selalu** menyaring
  `WHERE kedaluwarsa > NOW()`. Batasnya diakui: satu pool berisi 5 koneksi,
  tanpa kolam cadangan dan tanpa penyimpanan ulang otomatis.
- **`app/server/faskes.js`** — tiga aturan yang menjaga agar aplikasi tidak
  berkata "tidak ada fasilitas" saat sebenarnya gagal: `remark` Overpass
  dilempar sebagai galat, hasil kosong tidak pernah masuk simpanan, dan balasan
  kosong baru dipercaya kalau **dua** cermin yang memuat data Indonesia
  sepakat. Ketiganya diuji lewat `fetch` palsu di `uji-faskes.mjs`
  (**127 pemeriksaan**), jadi tidak butuh jaringan.
- **`app/server/wilayah.js`** + `rute-perjalanan.js` — kode wilayah divalidasi
  sebelum dipakai (bukan dipercaya apa adanya), dan `moda` rute dipetakan ke
  costing Valhalla lewat daftar tertutup tiga entri, jadi moda asing ditolak
  alih-alih diam-diam jadi "mobil".

### Model: `deepseek-v4-1-flash` (dipakai lagi 12 Nov 2026) — dan alasannya

Riwayatnya penting supaya tidak diulang tanpa pengukuran:

- **Sampai 8 Nov 2026** aplikasi memakai `deepseek-v4-1-flash`. Menjelang Grand
  Final ia mulai **menulis kalimat penalarannya ke dalam `content`** meski
  `KENARI_REASONING_EFFORT=none`: "Let me write a JSON response in Indonesian…".
  Jatah token habis untuk penalaran, `finish_reason` menjadi `length`, dan
  **Tanya AI menjawab kosong** (`code: unparsed`). Terukur saat itu: satu gagal
  dari tiga percobaan, masing-masing 40–57 detik.
- **8–12 Nov 2026** aplikasi memakai `deepseek-v4-flash`: 7,0–8,1 detik, JSON
  sah 3/3, tanpa kalimat penalaran.
- **12 Nov 2026** `deepseek-v4-1-flash` diukur ulang atas permintaan pemilik
  proyek dan **dipakai lagi**: 25 pertanyaan `node uji-jawaban.mjs` —
  **0 gagal, 0 tanpa sumber, 0 menolak padahal ada, 0 mendiagnosis**, termasuk
  tiga pertanyaan berita. Waktu jawaban 5,6–22,0 detik (median 10,1 s dari 38
  permintaan) untuk jawaban 700–1.200 karakter; JSON selalu utuh (`finish_reason: stop`) dan
  **tidak ada kalimat penalaran yang bocor ke `content`** pada pemeriksaan
  contoh jawaban.

| Model | Waktu | JSON sah | Catatan |
|---|---:|---|---|
| `deepseek-v4-1-flash` | 5,6–22,0 s (median 10,1 s) | 25/25 ya | **dipakai sekarang** (diukur ulang 12 Nov 2026) |
| `deepseek-v4-flash` | 7,0–8,1 s | 3/3 ya | dipakai 8–12 Nov 2026, lebih cepat & lebih konsisten |
| `glm-5-3-flash` | 17,5 s | ya | lebih lambat |
| `agnes-2-5-flash:free` | 4,0 s | ya | jalur gratis, kuota tidak dijamin |

Kalau gejala 8 Nov kembali (jawaban kosong, `code: unparsed`, atau `content`
yang berisi kalimat berpikir), yang pertama diperiksa adalah **isi `content`**,
lalu ganti balik ke `deepseek-v4-flash` lewat `KENARI_MODEL` di `app/.env` —
tidak perlu mengubah kode.

Selain itu `mintaJson()` **menaikkan jatah token** kalau percobaan pertama
berakhir `finish_reason: length` (`anggaranBerikutnya()` di `batasInput.js`,
diuji `uji-batas.mjs`) — mengulang dengan jatah yang sama hanya akan gagal
dengan cara yang sama.

### Audit 8 Nov 2026 — empat cacat, semuanya diperbaiki

Diperiksa ulang seluruh produk sebelum Grand Final (20 endpoint, 25 pertanyaan,
7 halaman × 2 bahasa, database, dan alur demo). Empat cacat nyata ditemukan:

| Cacat | Gejala | Perbaikan |
|---|---|---|
| Pilih kecamatan meleset | memilih **kecamatan** memusatkan peta di **kota**, jadi daftar fasilitas menampilkan wilayah yang salah — tanpa galat apa pun | `cascadeTitik()` mencoba beberapa bentuk kueri; terukur Danurejan presisi `kecamatan` (−7,79314) |
| Model lambat/terpotong | Tanya AI menjawab **kosong** (`code: unparsed`), 40–57 detik | model pindah ke `deepseek-v4-flash` + jatah token naik saat terpotong |
| HTTP 500 saat model lambat | 3 dari 25 pertanyaan gagal dengan 500 setelah 50 detik | ulang sekali otomatis; kalau tetap lambat → **503 `model_lambat`** dengan pesan jelas |
| "Rontgen dada" tanpa sumber | 1 dari 25 pertanyaan keluar 0 sumber | kunci dipindah dari `Radiografi` (337 karakter) ke `Sinar-X` (765 karakter) |

Sesudah perbaikan, `node uji-jawaban.mjs` (25 pertanyaan, model sungguhan):
**0 gagal, 0 tanpa sumber, 0 menolak padahal ada, 0 mendiagnosis**.

### Jawaban kosong tidak boleh terjadi — dan cara membuktikannya

Diukur 15 Okt 2026: dua fitur pernah menjawab **KOSONG** — "berikan aku berita
terkini" dan Sederhanakan untuk teks medis panjang. Penyebabnya bukan prompt,
melainkan **jatah token**: model `deepseek-v4-1-flash` (yang dipakai saat itu)
adalah model *reasoning*, dan token `reasoning_content` yang ia hasilkan **ikut
memakan `max_tokens`**.
Jawabannya belum sempat ditulis, jatahnya sudah habis (`finish_reason: length`),
JSON-nya terpotong, dan pengguna melihat gelembung hampa.

Tiga lapis perbaikan, semuanya terukur:

1. **Penalaran dimatikan** (`KENARI_REASONING_EFFORT=none`, lihat `config.js`).
   Pada pertanyaan yang sama dengan batas 120 token: dasar 48 token, `low` 21
   token, `none` **5 token** — jawaban yang dihasilkan sama persis. Setelah
   dimatikan, satu jawaban Sederhanakan turun dari >3400 token (terpotong)
   menjadi 474–985 token (utuh), dan seluruh gerbang keterbacaan tetap lulus.
2. **Anggaran token per jalur** (`MAKS_TOKEN` di `app/server/batasInput.js`),
   diukur satu per satu — bukan satu angka untuk semua jalur:
   `tanya` 2000 · `berita` 3000 · `sederhanakan` 3400 · `verifikasi` 2800.
3. **Coba ulang + jawaban darurat.** Balasan yang tidak terbaca sebagai JSON
   diulang sekali; kalau tetap gagal, jalur berita menyusun jawabannya langsung
   dari daftar RSS (judul + media + umur, tanpa mengarang). Di antarmuka,
   jawaban kosong selalu diganti kalimat penjelasan — tidak pernah gelembung
   hampa.

Buktinya ada di uji, bukan di klaim: `uji-berita.mjs` bagian "jawaban darurat",
bagian "uji jalur berita" di `uji-jawaban.mjs` (3 pertanyaan, ikut menentukan
exit code), dan `ukur-panjang.mjs` (batas kata per tingkat).

---

## Menjalankan di localhost (laptop finalis)

Aplikasi punya dua bagian: frontend React dan backend Express yang memanggil model AI.
Bagian ini ditulis untuk **laptop finalis yang baru**, dari nol sampai aplikasi
terbuka di peramban.

### 1. Prasyarat

| Kebutuhan | Versi | Cara memeriksa |
|---|---|---|
| **Node.js** | `^20.19.0` atau `>=22.12.0` (syarat Vite 8) | `node -v` |
| **npm** | ikut Node (diuji pada 11.19.1) | `npm -v` |
| **Git** | apa saja | `git --version` |
| **MariaDB/MySQL** | opsional — XAMPP 10.4.32 diuji | `mysql --version` |
| **Kunci Kenari.id** | wajib | `https://kenari.id` |

Diuji pada Node **v26.9.0** dan npm **11.19.1**. Node 18 atau 20.18 ke bawah akan
gagal saat `npm run build` karena Vite 8 menolak versi itu.

### 2. Ambil kode dan pasang dependensi

```bash
git clone https://github.com/Ellbaayy/Pahami-sehat.git
cd Pahami-sehat/app

npm install --include=dev
```

> **`--include=dev` wajib** bila `NODE_ENV=production` di mesin itu. Tanpa flag
> ini, `vite` dan `@vitejs/plugin-react` tidak terpasang, lalu `npm run build`
> gagal dengan `vite: not found` — pesan yang tidak menyebut sebabnya.

Keluaran yang diharapkan: `added N packages` tanpa `ERESOLVE`, dan folder
`app/node_modules/` terbentuk.

### 3. Siapkan `.env`

```bash
cp .env.example .env
chmod 600 .env
# lalu isi satu baris ini di .env:
#   KENARI_API_KEY=kn-...
```

Tanpa kunci, server **menolak start** dan menyebut `.env` sebagai sebabnya —
bukan gagal diam-diam. Daftar lengkap variabelnya ada di
[Variabel lingkungan](#variabel-lingkungan--appenvexample).

### 4. Jalankan

```bash
# Mode Grand Final — satu perintah, satu port (build + server)
npm start
```

Keluaran yang diharapkan:

```
  api key : terpasang (kn-…)
  dist    : disajikan dari /
  database: tersambung (pahami_sehat@127.0.0.1:3306)
  alamat  : http://127.0.0.1:8787/app/
```

Buka **<http://127.0.0.1:8787/app/>**. Halaman penjelasan ada di
<http://127.0.0.1:8787/>.

Untuk mengembangkan (hot reload), pakai dua terminal:

```bash
npm run server    # backend  : http://127.0.0.1:8787
npm run dev       # frontend : Vite, /api diteruskan ke backend
```

### 5. Pasang database (opsional, tapi disarankan saat demo)

Aplikasi tetap jalan tanpa database. Kalau ingin data lengkap — 20.924 fasilitas,
331 topik, 7.837 wilayah — pakai dump yang sudah ada di repo:

```bash
# Arch/CachyOS: pasang ini DULU, kalau tidak XAMPP gagal dengan pesan
# "only available as 32 bit application" yang MENYESATKAN (binernya 64-bit;
# akar masalahnya php butuh libcrypt.so.1).
sudo pacman -S libxcrypt-compat

sudo /opt/lampp/lampp startmysql
/opt/lampp/bin/mysql -u root -e "CREATE DATABASE IF NOT EXISTS pahami_sehat"
/opt/lampp/bin/mysql -u root pahami_sehat < ../docs/database/pahami-sehat.sql
```

Keluaran yang diharapkan: perintah `mysql` selesai tanpa galat, dan
`/api/health` melaporkan `db: { aktif: true, host: "127.0.0.1", port: 3306 }`.

Kalau hanya butuh skema kosong: `/opt/lampp/bin/mysql -u root < ../docs/skema-database.sql`.

### 6. Periksa bahwa semuanya benar-benar hidup

```bash
curl -s http://127.0.0.1:8787/api/health
curl -s -o /dev/null -w '%{http_code}\n' http://127.0.0.1:8787/app/
curl -s -o /dev/null -w '%{http_code}\n' http://127.0.0.1:8787/
```

Harapan: `/api/health` mengembalikan JSON dengan `"ok": true` dan nama model,
lalu `200` dan `200`.

### 7. Kalau ada yang gagal

| Gejala | Sebab dan jalan keluarnya |
|---|---|
| `vite: not found` | `NODE_ENV=production` melewatkan devDependencies → `npm install --include=dev` |
| `EADDRINUSE :8787` | port dipegang proses lain; `npm run server` sudah membebaskan port milik proyek ini sendiri, dan **menolak** membunuh proses asing sambil menyebut PID-nya |
| Server berhenti dengan pesan soal `.env` | `KENARI_API_KEY` belum diisi |
| `db: { aktif: false }` | MariaDB belum jalan → `sudo /opt/lampp/lampp startmysql`; aplikasi tetap bisa dipakai |
| Halaman kosong saat membuka `dist/index.html` | hasil build memakai ES module; harus lewat HTTP (`npm start`), bukan `file://` |
| Suara tidak berbunyi | `msedge-tts` butuh WebSocket — hanya jalan di server biasa, bukan di Vercel |
| Mikrofon/papan klip mati | peramban hanya mengizinkannya di konteks aman: `localhost` atau `https://` |

### 8. Menjalankan seluruh uji

```bash
cd app && npm test        # 33 berkas uji, tanpa jaringan dan tanpa API key
cd app && npm run lint    # ESLint 10
```

`npm run build` juga menjalankan `prebuild` → `scripts/salin-prototipe.mjs`,
yang menyalin `docs/prototipe/` menjadi `dist/index.html` + `dist/prototipe/`.
Jadi **mengubah halaman penjelasan wajib lewat build** sebelum diuji.

> Hasil build memakai ES module, jadi membuka `dist/index.html` lewat `file://`
> **tidak akan jalan**. Harus disajikan lewat HTTP — `npm start` sudah begitu.

> Tanpa API key, server tidak mau start dan akan memberi pesan jelas soal `.env`.

### Database

**Opsional.** Database hanya menyimpan bahan (berita, konten, pengetahuan,
sitasi) **dan** fasilitas kesehatan yang sudah pernah diambil. Aplikasi tetap
bisa dipakai penuh tanpa MariaDB — tidak ada akun yang butuh database lagi.

```bash
# XAMPP: pasang libxcrypt-compat DULU di Arch/CachyOS.
# Tanpa itu `xampp` gagal dengan pesan "only available as 32 bit application"
# yang MENYESATKAN — binernya 64-bit; akar masalahnya php butuh libcrypt.so.1.
sudo pacman -S libxcrypt-compat

sudo /opt/lampp/lampp startmysql          # MariaDB di port 3306
/opt/lampp/bin/mysql -u root < docs/skema-database.sql

# isi 331 topik medis dari sumber resmi (butuh ~10 menit)
node panen-pengetahuan.mjs --semua
```

Setel koneksinya lewat `.env` (bawaan sudah cocok untuk XAMPP):
`DB_HOST`, `DB_PORT`, `DB_USER`, `DB_PASSWORD`, `DB_NAMA`.
`DB_MATI=1` mematikan database sepenuhnya — dipakai untuk membuktikan bahan
tetap tersaji tanpa database.

Endpoint untuk memeriksa: `GET /api/health` (status db) dan `GET /api/db`
(hitungan + contoh baris, bukan seluruh isi tabel).

#### Dump isi database ikut repo

[`docs/database/pahami-sehat.sql`](docs/database/pahami-sehat.sql) memuat **isi database
sungguhan**, bukan sekadar skema: struktur 15 tabel dan seluruh barisnya — 20.924
fasilitas, 7.837 wilayah, 331 topik pengetahuan, 124 dokumen, 1.074 sitasi. Siapa pun
yang mengkloning repo bisa memuatnya dan langsung punya data, tanpa menarik ulang dari
Kemenkes atau OpenStreetMap.

Tiga tabel di dump tidak ada di `docs/skema-database.sql` karena dibuat saat aplikasi
berjalan: `cakupan_faskes` (`app/server/faskesDb.js`), `sinkron_fasilitas` dan
`catatan_sumber` (`impor-sirs.mjs`). Jadi dump adalah gambar terlengkap keadaan database.

Yang sengaja **tidak** ikut: baris tabel `percakapan` — kolom `teks` berisi kalimat yang
diketik pengguna. Strukturnya tetap ada, barisnya kosong. Tidak ada tabel akun, sesi, atau
riwayat di dump mana pun; skema sudah menghapusnya sejak halaman login dibuang.

```bash
# buat ulang dump dari MariaDB lokal (menimpa berkas yang ada)
./buat-dump-database.sh && ./periksa-dump-database.sh

# muat dump ke database kosong
/opt/lampp/bin/mysql -u root pahami_sehat < docs/database/pahami-sehat.sql
```

`periksa-dump-database.sh` menolak dump yang memuat tabel akun/sesi, baris `percakapan`,
atau jumlah tabel selain 15 — dan langkah yang sama dijalankan di CI. Dump lama di akar
repo (`database-pahami-sehat-*.sql`) tetap diabaikan `.gitignore` dan **tidak boleh**
ikut: isinya memuat hash kata sandi, nomor telepon, dan token sesi dari uji coba akun.

Diperiksa 14 Nov 2026: dump dipulihkan ke basis data kosong, lalu jumlah baris ke-15
tabel dibandingkan satu per satu — 14 tabel sama persis, dan `percakapan` memang 34 di
sumber menjadi 0 di salinan.

**Diverifikasi pada XAMPP sungguhan (4 Nov 2026):** MariaDB **10.4.32** dari
`/opt/lampp`, port 3306, basis data `pahami_sehat`, seluruh 12 tabel dari
`docs/skema-database.sql` terbentuk — plus 3 tabel yang dibuat saat aplikasi
berjalan, sehingga database lengkap berisi **15 tabel** — dan `/api/health` melaporkan
`db: { aktif: true, host: "127.0.0.1", port: 3306 }`. `uji-faskes-db.mjs`
**12/12 lulus** di server yang sama — bukan hanya di instance uji terpisah.

Tiga tabel untuk fitur Fasilitas Kesehatan Terdekat ada di
`docs/skema-database.sql`: `wilayah`, `kategori_fasilitas`, dan `fasilitas`
(beserta `sumber`, `sumber_url`, `diperbarui_pada`, dan `kedaluwarsa_pada`).
Fasilitas yang sudah pernah diambil **disimpan** di sana, jadi permintaan
berikutnya dilayani dari MySQL (6,8 ms) alih-alih menunggu OpenStreetMap
(40–50 detik).

**Untuk Grand Final:** `npm start` adalah yang dipakai saat presentasi — Express
menyajikan hasil build sekaligus melayani `/api`, jadi cukup satu alamat.

## Fasilitas Kesehatan Terdekat (4 Nov 2026)

Menu ketujuh di sidebar. Dua hal yang membuatnya berbeda dari sekadar "peta
rumah sakit": **lokasi tidak lagi hanya GPS**, dan **petunjuk arahnya rute
sungguhan**.

### Menentukan lokasi — wilayah administratif dulu, GPS sebagai pilihan

Empat dropdown bertingkat: **Provinsi → Kota/Kabupaten → Kecamatan →
Desa/Kelurahan**. Mengganti tingkat mana pun mengosongkan dan menonaktifkan
semua tingkat di bawahnya.

Sumbernya `wilayah.id`, yang disalin ke tabel `wilayah` milik aplikasi. Dipilih
setelah membandingkan tiga sumber (4 Nov 2026):

| Sumber | Provinsi | Catatan |
|---|---|---|
| `wilayah.id` | **38** | benar untuk Indonesia sekarang; kode bertitik (`32.16.16` = Kec. Cikarang Selatan) |
| `emsifa.com` | 34 | **usang** — empat provinsi baru belum ada |
| dump `cahyadsn` | — | tidak dipakai; tidak memberi keunggulan |

Kode wilayah disimpan, bukan hanya namanya, supaya identitas wilayah tetap
utuh walau namanya berubah. Titik referensi diambil lewat Nominatim pada
tingkat terdalam yang benar-benar punya koordinat — dan antarmuka
**menyebut tingkat itu apa adanya** ("titik referensi tingkat kota/kabupaten,
bukan posisi Anda secara presisi"). Desa/kelurahan di `wilayah.id` tidak punya
koordinat, jadi titiknya naik ke kecamatan/kabupaten.

GPS tetap ada sebagai metode alternatif. Aplikasi tidak pernah mengisi lokasi
pengguna dengan koordinat tetap.

### Petunjuk arah — OSRM dan Valhalla, masing-masing pada yang benar-benar didukungnya

Tiga moda: jalan kaki, sepeda motor, mobil. **Mengganti moda menghitung ulang
rute**, bukan hanya mengganti ikon.

**Setiap penyedia hanya dipakai untuk moda yang benar-benar dilayaninya.**
Itu bukan preferensi gaya, melainkan hasil pengukuran.

`router.project-osrm.org` (instance demo) **tidak** dipakai sama sekali: untuk
rute Monas → RSPAD Gatot Soebroto, `driving`, `foot`, `bike`, `walking`, dan
`motorcycle` semuanya mengembalikan **4,32 km / 6,4 menit** — profilnya
diabaikan, jadi tombol moda hanya akan menjadi hiasan.

Yang dipakai adalah `routing.openstreetmap.de`, yang menjalankan **instance
terpisah per profil**. Diukur 4 Nov 2026, rute yang sama:

| Host OSRM | Jarak | Waktu | Profil |
|---|---|---|---|
| `routed-car` | 4,32 km | 6,4 menit | mobil |
| `routed-foot` | 1,71 km | 22,9 menit | pejalan kaki |
| `routed-bike` | 2,15 km | 16,1 menit | sepeda |

Ada satu jebakan yang wajib diketahui siapa pun yang mengubah kode ini:
**profil ditentukan oleh HOST, bukan oleh path.** Ketiga baris di atas memakai
path `/route/v1/driving` yang sama. Mengganti `/driving` menjadi `/foot` tidak
mengubah apa pun — sudah diuji, hasilnya tetap rute mobil. Ini terkunci di
`uji-layanan-peta.mjs`.

**OSRM publik tidak mendukung sepeda motor.** Tidak ada host `routed-motor`;
permintaan ke sana membalas 404. Karena itu:

| Moda | Penyedia | Alasan |
|---|---|---|
| Mobil | OSRM `routed-car` (atau Valhalla bila `RUTE_PROVIDER=valhalla`) | keduanya mendukung |
| Jalan kaki | Valhalla `pedestrian`, atau OSRM `routed-foot` | keduanya mendukung |
| Sepeda motor | **Valhalla `motor_scooter` saja** | OSRM publik tidak punya profilnya |

Memberi rute `routed-car` lalu menamainya "sepeda motor" adalah persis
kebohongan yang dilarang pada pekerjaan ini. `OSRM_MODA.motor` bernilai `null`
dengan sengaja — bukan karena lupa diisi.

Valhalla memberi angka yang berbeda untuk ketiga moda. Contoh terukur 4 Nov
2026 (rute Monas → RSPAD Gatot Soebroto):

| Moda | Jarak | Waktu | Langkah |
|---|---|---|---|
| Jalan kaki | 2,14 km | ±30 menit | 24 |
| Sepeda motor | 4,54 km | ±18 menit | 14 |
| Mobil | 4,54 km | ±15 menit | 14 |

> **Batas yang disebut apa adanya (diukur ulang 5 Nov 2026).** Untuk jalan
> kaki, Valhalla memang mengambil jalur berbeda (1,68 km / 21 menit vs
> 2,369 km / 6–7 menit) — inilah yang membuat tombol moda berguna. Tetapi
> untuk **motor dan mobil, Valhalla sering memberi geometri yang SAMA PERSIS**
> dan hanya waktunya berbeda (motor_scooter 6,5 menit vs auto 6,3 menit pada
> rute Malioboro → Stasiun Tugu). Diperiksa langsung ke
> `valhalla1.openstreetmap.de` dengan payload identik, jadi ini sifat
> layanannya, **bukan** bug `rute-perjalanan.js`: costing-nya sudah berbeda dan
> `uji-rute-perjalanan.mjs` memastikan pemetaannya benar. Yang **tidak**
> diklaim lagi adalah bahwa tiga moda *selalu* menghasilkan tiga rute berbeda;
> pada jalan perkotaan tanpa larangan sepeda motor, jalan yang dilalui memang
> sama.

Valhalla **tidak** mendukung `id-ID` (diukur: `language=id-ID` tetap Inggris),
jadi instruksi diterjemahkan sendiri di `terjemahkanManuver()`. Pola yang tidak
dikenal dikembalikan apa adanya — lebih baik Inggris asli daripada terjemahan
karangan. Nama jalan selalu dipertahankan. Pada antarmuka Inggris, instruksi
Valhalla ditampilkan apa adanya (`Drive south.`), bukan diterjemahkan lalu
dicampur.

#### Satu bug bentuk balasan yang mudah terulang

`/api/rute` menyebar objek rute apa adanya (`res.json({ ok: true, ...rute })`).
Artinya **nama kunci yang salah tidak menimbulkan error** — ia hanya hilang,
dan antarmuka menampilkan kolom kosong tanpa keluhan.

Itu benar-benar terjadi: jalur OSRM mengembalikan `jarak`/`waktu`/`garis`,
sedangkan Valhalla mengembalikan `jarakKm`/`waktuMenit`/`geometri`. Selama OSRM
belum dipakai, cacatnya tidak terlihat. Begitu `RUTE_PROVIDER=osrm` dinyalakan,
rute mobil tampil kosong sementara jalan kaki (yang jatuh ke Valhalla) tetap
normal.

Sekarang kedua jalur wajib mengembalikan kunci yang sama, dan
`uji-layanan-peta.mjs` memeriksanya satu per satu.

#### Endpoint layanan bisa diganti tanpa menyentuh kode

Semua alamat layanan ada di `app/server/layanan.js` dan bisa ditimpa lewat
environment: `PHOTON_URL`, `NOMINATIM_URL`, `OSRM_MOBIL`, `OSRM_KAKI`,
`VALHALLA_URL`, `RUTE_PROVIDER`. Tidak ada API key di mana pun — Photon,
Nominatim, OSRM, dan Valhalla semuanya layanan publik tanpa kunci.

### Batas yang disebut di antarmuka, bukan disembunyikan

- **Muat pertama 40–50 detik** untuk wilayah baru — itu batas layanan
  OpenStreetMap publik, bukan kode. Sesudahnya dilayani dari MySQL (6,8 ms).
  Pemanasan saat server start: `PEMANASAN_TITIK="-6.1754,106.8272" npm run server`.
- **Kelengkapan OpenStreetMap tidak rata.** Di Jakarta Pusat hanya 53 dari
  1.702 fasilitas mencantumkan nomor telepon. Kolom kosong ditulis "Tidak
  tercatat", tidak diisi tebakan.
- **Estimasi waktu** memakai profil kecepatan rute, **bukan** lalu lintas
  langsung.
- **Kategori Tradisional dan Khusus kosong di sekitar Jakarta** — OpenStreetMap
  memang belum punya datanya di sana. Kekosongan itu ditampilkan, tidak diisi.
- **Data Kemenkes ADA — 3.325 rumah sakit resmi SIRS** (lihat [bagian SIRS](#rumah-sakit-resmi-kemenkes-sirs--3325-rs-di-database)).
  Yang TIDAK tersedia dari sumber itu adalah **koordinat**, jadi rumah sakit
  SIRS tidak digambar di peta. Sebelumnya README ini menyatakan katalog
  Kemenkes tidak bisa dibaca mesin; itu keliru — `rekap_rs_all?id=0` mengembalikan
  JSON lengkap tanpa paginasi. Kesalahan lama dikoreksi, bukan dihapus diam-diam.
- Cermin Overpass yang menjawab `200` dengan daftar kosong dianggap **gagal**,
  bukan "tidak ada fasilitas" — `overpass.osm.ch` berperilaku begitu karena
  hanya memuat data Swiss.

### Cara menentukan lokasi: ketik alamat, atau pilih wilayah

Menu **Fasilitas Kesehatan Terdekat** punya dua tombol metode lokasi. Keduanya
memakai **sistem pencarian fasilitas yang sama** dan koordinat yang sama-sama
disimpan sebagai `lokasi` tunggal — jadi hasilnya bisa dibandingkan, tetapi
**tidak pernah dicampur**.

| Metode | Titik asal | Sifat titik |
|---|---|---|
| **Ketik alamat** | koordinat hasil geocoding Nominatim | bisa presisi sampai bangunan, atau hanya pusat kota — dan itu **disebutkan** |
| **Pilih wilayah** | titik referensi wilayah dari Nominatim | **PERKIRAAN** (pusat wilayah), dengan peringatan tertulis |
| **Pakai GPS** | koordinat perangkat | tetap tersedia, bukan satu-satunya cara |

Tombol "Pilih di Peta" (klik peta untuk menentukan titik) **dihapus 5 Nov 2026**.
Klik pada peta kini hanya berfungsi untuk memilih fasilitas dari daftar, bukan
untuk memindahkan titik asal. Pencarian titik asal yang presisi tetap bisa
dilakukan lewat kolom alamat.

Mengganti metode **mengosongkan** titik dari metode sebelumnya. Tanpa itu,
pengguna pindah ke "pilih wilayah" tetapi pencarian masih memakai koordinat
alamat lama — campuran yang membuat hasil tidak bisa dijelaskan.

#### Deteksi wilayah: kenapa tidak membaca `address` apa adanya

Diukur 4 Nov 2026 pada sembilan alamat Indonesia: bentuk `address` Nominatim
**tidak konsisten sama sekali**.

| Alamat | Provinsi | Kabupaten | Kecamatan |
|---|---|---|---|
| Malioboro | `state` | `city` = "Kota Yogyakarta" | `city_district` = "Gedongtengen" |
| Monas | **tidak ada `state`** | `city_district` = "Jakarta Pusat" | `suburb` = "Gambir" |
| RSUD Soetomo | `state` | `city` = "Surabaya" | `municipality` = "Gubeng" |
| Kuta | `state` | **`region`** = "Badung" | `town` = "Kuta" |
| UI Depok | `state` | `city` = "Depok" | `village` = "Pondok Cina" |

Membaca satu field tetap menghasilkan wilayah kosong atau salah untuk sebagian
besar alamat. Karena itu:

1. **Provinsi dari `ISO3166-2-lvl4`** — terbukti andal. Diuji dengan 38 kota
   provinsi satu per satu lewat Nominatim: **38 dari 38 kode ISO cocok**
   (ID-JK, ID-YO, ID-JI, ID-BA, …), dipetakan ke kode BPS.
2. **Kabupaten & kecamatan dicocokkan ke tabel `wilayah`** milik aplikasi
   (bukan daftar tetap di kode), dibatasi provinsi — lalu kabupaten yang sama.

Empat cacat nyata yang ditemukan dan diperbaiki dalam proses ini, semuanya
tertangkap sebelum masuk:

- **`city_district` bermakna berbeda antar daerah.** Di DKI berisi *kota
  administrasi* ("Jakarta Pusat"), di DIY berisi *kecamatan* ("Gedongtengen").
  Didaftarkan sebagai kunci kabupaten, Malioboro kehilangan kotanya.
- **Penjagaan "nama provinsi" membuang kota yang sah.** Provinsi "Daerah
  Istimewa Yogyakarta" dan kota "Kota Yogyakarta" sama-sama menjadi
  `yogyakarta` setelah normalisasi; kota itu ikut dibuang. Sekarang penjagaan
  hanya berlaku kalau nilainya menyebut provinsi secara eksplisit.
- **Nominatim membuang awalan "Kota"/"Kabupaten"** ("Depok", "Surabaya",
  "Badung"), sementara tabel menyimpan "Kota Depok". Ditangani pencocokan
  longgar — tetapi hanya dipakai kalau hasilnya **unik** di provinsi itu.
- **"Bekasi" ambigu.** Bisa Kabupaten Bekasi (32.16) atau Kota Bekasi (32.75),
  dan sumbernya tidak pernah menyebut yang mana. Sebelumnya kode memilih
  Kabupaten Bekasi diam-diam. Sekarang wilayahnya **dibiarkan kosong** dan
  dilaporkan tidak dikenali — menebak di sini menempatkan fasilitas di wilayah
  yang salah.

Wilayah yang tidak berhasil dikenali **tidak ditebak**: koordinatnya tetap
dipakai, dan antarmuka menulis "wilayah tidak berhasil dikenali dari sumber".

#### Interaksi peta

Peta dipakai untuk **menampilkan** titik asal, penanda fasilitas, jalur rute,
dan memilih fasilitas dari daftar. Mengklik peta **tidak** mengubah lokasi
pencarian.

Fitur lama "klik peta untuk memilih titik" (beserta geocoding balik lewat
`/api/alamat/titik`, panel "Pakai titik ini", dan komponen `PemilihTitik`)
dihapus 5 Nov 2026 atas permintaan pengguna. Endpoint `/api/alamat/titik` tetap
ada karena masih dipakai geocoding balik saat pengguna memilih saran alamat.

Penanda titik asal diberi label sesuai **sumbernya** ("Lokasi GPS Anda",
"Alamat yang Anda pilih", "Pusat wilayah yang Anda pilih (perkiraan)") —
menulis "Lokasi Anda" untuk semuanya adalah kebohongan kecil yang membuat
pengguna mengira aplikasi tahu posisi presisinya.

Klik pada **penanda fasilitas** dipakai untuk memilih fasilitas tersebut dari
peta; klik pada area kosong tidak melakukan apa pun.

#### Keyboard dan Enter

Panah atas/bawah memindahkan sorotan, **Enter memilih** yang tersorot (atau saran
pertama bila belum ada sorotan), Escape menutup daftar. Memilih saran pertama
saat Enter ditekan bukan "memilih otomatis" yang dilarang: pengguna sendiri yang
menekan Enter setelah daftarnya terlihat.

#### Saran alamat, dan kenapa tidak memilih otomatis

Autocomplete dengan jeda 400 ms + `AbortController` (permintaan lama
dibatalkan, bukan diabaikan setelah datang). Bila ada **lebih dari satu
kandidat**, antarmuka meminta pengguna memilih — hasil pertama tidak dipakai
diam-diam, karena Nominatim mengurutkan menurut kecocokan teks, bukan kebenaran
administratif. Terukur: "Cikarang Selatan" mengembalikan **perumahan** "Permata
Cikarang Selatan" di urutan pertama.

Tingkat ketepatan titik ditampilkan apa adanya (`titik bangunan`, `titik jalan`,
`pusat kabupaten/kota`, `pusat provinsi`), supaya titik yang hanya setepat pusat
kota tidak terlihat sama akuratnya dengan titik bangunan.

#### Penanganan kegagalan

| Kondisi | Perilaku |
|---|---|
| alamat tidak ditemukan | pesan "Alamat tidak ditemukan" + saran pakai pilihan wilayah |
| alamat terlalu umum / ambigu | semua kandidat ditampilkan, pengguna memilih |
| beberapa kandidat | `perluPilih` + peringatan "Pilih yang paling sesuai" |
| koordinat tidak tersedia | hasil tanpa koordinat sah dibuang di server |
| layanan geocoding mati / kuota | dibedakan: `layanan_gagal` vs `kuota`, keduanya menyebut sebabnya |
| wilayah tidak dikenali | koordinat tetap dipakai, wilayah ditulis tidak dikenali |

**Pencarian tidak bergantung pada GPS.** Diuji dengan izin GPS **ditolak**:
alamat Malioboro tetap menghasilkan 314 fasilitas Yogyakarta.

Bukti koordinat alamat benar-benar dipakai (bukan GPS, bukan titik default):
**Monas → 743 fasilitas** (Jakarta) dan **RSUD Soetomo → 196 fasilitas**
(Surabaya) — dua titik berbeda, dua hasil berbeda, pada satu sesi yang sama.

### Tiga jebakan "kosong" — semuanya pernah membuat Jakarta dilaporkan kosong

Pada 4 Nov 2026 aplikasi sempat berkata **"tidak ada fasilitas di sekitar Anda"**
untuk Jakarta Pusat. Itu salah, dan tidak bisa dibela. Ada tiga sebab, dan
ketiganya harus ditutup bersamaan:

1. **`remark` Overpass = galat, bukan hasil.** Saat query timeout di sisi server,
   Overpass membalas **HTTP 200** dengan `elements: []` **dan** sebuah `remark`:

   ```json
   { "elements": [], "remark": "runtime error: Query timed out in \"query\" at line 1 after 2 seconds." }
   ```

   Balasan itu nyaris tidak bisa dibedakan dari "wilayah ini kosong". Sekarang
   `remark` diperiksa lebih dulu dan dilempar sebagai galat.
2. **Hasil kosong tidak pernah masuk simpanan.** Sekali "0 fasilitas" tersimpan,
   ia bertahan 10 menit dan tampil dengan yakin. Sekarang hanya hasil berisi yang
   disimpan, dan entri berjumlah 0 dari versi lama dibuang saat dibaca.
3. **Satu cermin yang bilang kosong belum cukup.** Terukur: `overpass-api.de`
   membalas 502, lalu `lz4.overpass-api.de` membalas 200 dengan **nol elemen**
   untuk Jakarta Pusat — padahal wilayah itu penuh fasilitas. Replika bisa belum
   lengkap. Butuh **dua** cermin yang terbukti memuat data Indonesia dan
   sama-sama kosong; kalau tidak, hasilnya `sumber_gagal`.

**Overpass publik bisa benar-benar penuh**, bukan hanya lambat:

```
502 Gateway Timeout
This Overpass API server is currently at capacity. All query workers are busy
and the request queue is full.
```

Saat itu terjadi, jawaban yang benar adalah 503 `sumber_gagal` dengan tombol coba
lagi — **bukan** peta kosong yang terlihat meyakinkan, dan tentu bukan data
karangan untuk "mengisi" layar. Ketiga aturan di atas diuji tanpa jaringan lewat
`fetch` palsu di `uji-faskes.mjs`.

### Rumah sakit resmi Kemenkes (SIRS) — 3.325 RS di database

**Sumbernya bukan scraping.** `sirs.kemkes.go.id/fo/home/rekap_rs_all?id=0`
ternyata membalas **JSON resmi** yang dipakai dashboard SIRS sendiri, dan satu
tarikan berisi **seluruh 3.325 rumah sakit nasional** — tanpa pagination, jadi
tidak ada halaman yang bisa terlewat.

Kelengkapannya divalidasi terhadap **rekap resmi SIRS sendiri**
(`rekap_by_jenis`, `rekap_by_kelas`, `rekap_by_kepemilikan`): ketiganya harus
sama dengan hitungan lokal. Hasilnya cocok persis, termasuk A 86 · B 451 ·
C 1.826 · D 872 · D PRATAMA 85 dan RSU 2.828 · RSIA 296.

**Yang tidak ada di sumber, dan karena itu NULL** — diperiksa satu per satu,
bukan diasumsikan:

| Field | Status |
|---|---|
| latitude / longitude | **tidak ada** — tidak di daftar nasional, tidak di `profile_rs/<kode>`, dan JS peta SIRS hanya berisi poligon provinsi |
| kecamatan / kelurahan | tidak ada |
| email / website | tidak ada |
| status operasional | tidak ada sebagai field |

Karena itu rumah sakit SIRS **tidak** ditampilkan sebagai titik di peta. Sejak
8 Nov 2026 seluruh faskes ada di satu daftar nasional, dan baris tanpa koordinat
diberi penanda **"Lokasi di peta belum tersedia"** — tidak diberi titik
karangan. Tombol peta hanya muncul untuk baris yang benar-benar berkoordinat.

**Sinkronisasi ulang aman dan idempoten.** Diuji: tarikan kedua menghasilkan
**0 baru, 3.325 tidak berubah, 3.325 kode unik**. RS yang tidak lagi muncul
ditandai `hilang_pada`, **tidak dihapus** — hilang dari satu tarikan bisa berarti
sumbernya sedang terganggu.

**Nama wilayah SIRS ≠ nama wilayah resmi.** Ini kesalahan nyata yang sempat
masuk database: SIRS menulis nama **kabupaten tanpa awalan** ("Bekasi"), sementara
kotanya selalu lengkap ("Kota Bekasi"). Versi pertama pemetaan membuang kata
"kota"/"kabupaten" sebagai awalan, sehingga **57 RS Kabupaten Bekasi masuk ke
Kota Bekasi** (dan 32 RS Bogor ke Kota Bogor). Sekarang jenis wilayah ikut jadi
kunci pencocokan. Hasil akhir: **513 dari 513** pasangan provinsi+kabupaten
terpetakan, dengan 6 alias eksplisit yang bisa dibaca satu per satu.

```bash
/opt/lampp/bin/mysql -u root < docs/migrasi-sirs.sql   # migrasi (idempoten)
node isi-wilayah.mjs                                    # 38 provinsi + 514 kabupaten
node impor-sirs.mjs                                     # impor / sinkron ulang
node petakan-wilayah.mjs                                # nama SIRS -> kode wilayah
node uji-rs-sirs.mjs                                    # 51 pemeriksaan
```

Laporan lengkap: [`docs/laporan-impor-sirs.md`](docs/laporan-impor-sirs.md).

### Statistik fasilitas nasional — angka resmi, dan artinya

Peta fasilitas menjawab "apa yang ada di sekitar saya". Pertanyaan lain —
"berapa jumlah puskesmas di Indonesia" — tidak bisa dijawab dari peta, karena
OpenStreetMap tidak lengkap. Untuk itu dipakai angka laporan resmi, disimpan di
tabel `statistik_faskes`.

**Kemenkes 2024** — fasilitas yang telah mengimplementasikan sistem data dan
aplikasi kesehatan:

| Jenis fasilitas | Jumlah |
|---|---:|
| Rumah sakit | 3.681 |
| Puskesmas | 11.542 |
| Laboratorium kesehatan | 602 |
| Klinik | 18.590 |
| Praktik mandiri | 15.060 |
| Unit transfusi darah | 73 |
| **Total** | **49.548** |

> **49.548 bukan jumlah seluruh fasilitas kesehatan nasional.** Itu jumlah pada
> enam kategori di atas yang sudah tersambung sistem data dan aplikasi
> kesehatan; fasilitas yang belum tersambung tidak ikut dihitung. Kalimat ini
> disimpan di kolom `cakupan` pada setiap baris, ikut di respons API, dan
> diperiksa `uji-statistik-faskes.mjs` — supaya angka ini tidak pernah dikutip
> sebagai "total faskes Indonesia".

**BPJS Kesehatan, September 2026** (pembanding, cara hitung berbeda — jangan
dijumlahkan dengan angka Kemenkes): 23.862 FKTP · 3.221 RS/Klinik Utama ·
6.631 apotek/optik.

Rujukan pengembangan yang tercatat di `sumber_data_faskes`:

| Sumber | Data yang tersedia |
|---|---|
| Kemenkes — Profil Kesehatan Indonesia 2025 | Statistik kesehatan nasional |
| BPS — Statistik Fasilitas Kesehatan 2025 | Rumah sakit dan puskesmas menurut provinsi |
| SATUSEHAT Data | Dashboard dan dataset kesehatan |
| BPJS Kesehatan | Jumlah faskes mitra JKN |

```bash
node impor-statistik-faskes.mjs                 # simpan / perbarui (idempoten)
node impor-statistik-faskes.mjs --kering        # lihat angkanya saja, tanpa menulis
node impor-statistik-faskes.mjs --cari klinik   # cari tanpa menyentuh database
node uji-statistik-faskes.mjs                   # 39 pemeriksaan, tanpa jaringan
```

Endpoint `GET /api/statistik-faskes` (bisa `?cari=klinik`) membaca dari
database; kalau MariaDB mati, ia menjawab dari
[`app/server/statistikFaskes.js`](app/server/statistikFaskes.js) dan menyebut
`dari: "berkas"` — aplikasi tetap hidup, dan sumber angkanya tidak
disembunyikan.

### Tombol "Cari" tidak lagi membuat juri menunggu

Overpass (sumber OSM) butuh **37–49 detik** untuk area yang belum pernah
diambil. Terukur 7 Nov 2026: permintaan pertama di Yogyakarta memakan
**57,9 detik** hanya untuk menampilkan hasil yang sebenarnya sudah ada di
database. Tiga perubahan menutupnya:

1. **Semua cermin Overpass dijalankan bersamaan**, bukan berurutan — yang
   tercepat menang. Dulu cermin pertama yang menggantung 70 detik menahan
   seluruh permintaan sebelum cermin kedua dicoba.
2. **Batas waktu yang dilihat pengguna: 9,5 detik** (`FASKES_BATAS_MS`).
   Kalau tidak ada cermin yang menjawab sampai batas itu, aplikasi memakai
   simpanan database (ditandai `dariSimpanan`) atau menjawab "coba lagi" —
   tidak pernah menggantung satu menit.
3. **Cakupan dicocokkan dengan toleransi**, bukan hanya titik yang sama
   persis. Catatan cakupan pada satu titik berlaku untuk permintaan di
   sekitarnya selama radius catatan masih menutupi jarak + radius yang
   diminta. Dulu geseran 900 m saja sudah dianggap "belum pernah diambil".

Sebelum demo, panaskan lokasi yang akan ditunjukkan — **dengan radius lebih
besar** daripada yang akan dipakai saat demo (mis. panaskan 10 km, demo 5 km),
supaya geseran titik tetap terlayani:

```bash
node panaskan-faskes.mjs --tempat "Danurejan, Yogyakarta" --radius 10000
node panaskan-faskes.mjs --daftar lokasi-demo.txt        # satu lokasi per baris
```

Sesudah dipanaskan, terukur: **0,010–0,032 detik** dari database (dulu 57,9
detik). Data yang lebih tua dari 6 jam tetap disajikan cepat dengan penanda
`basi: true` sambil disegarkan di latar belakang.

### Hasil radius tidak lagi dipotong diam-diam

Terukur 4 Nov 2026: Jakarta Pusat radius 5 km **selalu** berhenti di **600**
fasilitas, dan tidak ada satu pun tanda bahwa ada yang hilang. Ada tiga sebab
yang semuanya harus ditutup:

1. **`MAKS_HASIL = 600`** di `faskes.js` — batas keras. Dinaikkan ke 5.000.
2. **`dipotong` berbohong.** Nilainya `unik.length > MAKS_HASIL` — membandingkan
   angka SEBELUM dipotong, jadi saat hasilnya tepat 600 ia bernilai `false`.
   Sekarang berisi **jumlah** yang tidak ikut terkirim.
3. **`fasilitasSekitarDb` punya batas 600 sendiri**, dan `catatCakupan`
   mencatat "600 = lengkap". Sesudah itu setiap permintaan untuk area tersebut
   dilayani dari DB dan **selalu** 600. Sekarang cakupan hanya dicatat kalau
   hasilnya benar-benar tidak terpotong.

Selain itu daftar dulu dirender `slice(0, 80)` sementara penghitung menulis
angka penuh. Sekarang **seluruh** hasil dirender.

Diukur ulang sesudah perbaikan: **743 fasilitas** di radius 5 km Jakarta Pusat,
743 kartu dirender, `dipotong: 0`, `jumlahDitemukan: 743`. Permintaan kedua
dilayani dari MySQL dalam **62 ms** (dari 50 detik).

### Halaman penjelasan ikut diperbarui

`docs/prototipe/index.html` sekarang punya **enam** kartu fitur (sebelumnya
lima) dan menampilkan **lima tangkapan layar asli** dari aplikasi yang berjalan
— bukan mockup. Gambarnya dihasilkan `ambil-tangkapan.mjs`, yang menolak
menyimpan berkas di bawah 20 KB supaya tangkapan gagal tidak lolos:

```bash
npm run server            # di terminal lain
node ambil-tangkapan.mjs  # -> docs/tangkapan-layar/ dan docs/prototipe/assets/tangkapan-layar/
```

## Melihat halaman penjelasan

```bash
cd docs/prototipe
python3 -m http.server 8080 --bind 127.0.0.1
# buka http://127.0.0.1:8080/
```

Halaman ini juga bisa dibuka langsung dari `index.html` di peramban (semua aset
lokal). Tombol "Coba Aplikasinya" mengarah ke `/app/`, jadi **build aplikasi
dulu** (`npm run build`) kalau ingin tombol itu berfungsi.

---

## Pindai foto (OCR) — seluruhnya di peramban

Fitur ini membaca teks dari foto (label obat, hasil lab, resep) memakai
`tesseract.js` (WebAssembly). **Tidak ada gambar yang dikirim ke server**, dan
fitur ini tetap bekerja tanpa internet maupun tanpa API key.

Mesinnya disajikan dari situs sendiri di `app/public/ocr/`, **bukan dari CDN**.
Itu pilihan yang disengaja: kalau berkasnya diambil dari CDN, pemindaian akan
mengirim permintaan ke pihak ketiga — dan janji "foto tidak keluar dari
perangkat" jadi tidak benar.

Isi `app/public/ocr/` (diukur 20 Okt 2026: **17.048.779 byte ≈ 17 MB**, 6 berkas):

| Berkas | Asal |
|---|---|
| `worker.min.js` | paket `tesseract.js` |
| `tesseract-core-lstm.wasm.js`, `-simd-lstm`, `-relaxedsimd-lstm` (masing-masing ~3,8 MB) | paket `tesseract.js-core` (tiga varian, dipilih sesuai dukungan peramban) |
| `langdata/ind.traineddata`, `langdata/eng.traineddata` (total ~5 MB) | [tessdata_fast](https://github.com/tesseract-ocr/tessdata_fast) (Apache-2.0) |

Memperbarui berkas mesin (hanya kalau versi `tesseract.js` dinaikkan):

```bash
cd app
npm install tesseract.js@<versi>
cp node_modules/tesseract.js/dist/worker.min.js public/ocr/
cp node_modules/tesseract.js-core/tesseract-core-*-lstm.wasm.js public/ocr/
# data bahasa dari tessdata_fast (1,1 MB untuk ind, 3,9 MB untuk eng)
curl -sL -o public/ocr/langdata/ind.traineddata \
  https://github.com/tesseract-ocr/tessdata_fast/raw/main/ind.traineddata
curl -sL -o public/ocr/langdata/eng.traineddata \
  https://github.com/tesseract-ocr/tessdata_fast/raw/main/eng.traineddata
```

### Batas yang diakui terbuka

Diukur dengan tiga foto uji (dibuat dari teks asli, bukan gambar karangan), dan
ini ditulis apa adanya. Angka di bawah berasal dari **membandingkan hasil yang
benar-benar keluar dari aplikasi** dengan teks sumber yang diketahui — bukan dari
perkiraan:

| Foto uji | Akurasi huruf | Angka benar | Baris utuh | Angka yang salah |
|---|---|---|---|---|
| Label obat (teks besar) | 100,0% | 5/5 | 9/9 | — |
| Hasil lab (teks sedang) | 99,7% | 15/16 | 11/12 | `11.2` |
| Hasil lab (teks kecil) | 98,1% | 12/16 | 10/12 | `11.2`, `13.2`, `17.3`, `34` |

Kesalahannya **berpola sama dan sudah diketahui sebabnya**: tanda titik dua `:`
kadang terbaca sebagai angka `1`, sehingga `Hemoglobin : 11.2` menjadi
`111.2`. Diuji pada empat ukuran gambar berbeda (2000–3800 px) — **tidak ada
ukuran yang bebas dari kesalahan ini**. Pada teks kecil kesalahannya bertambah
karena hurufnya terlalu rapat untuk dipisahkan dengan yakin.

Karena itu:

- **Angka yang mencurigakan ditandai**, tidak dibetulkan sendiri. Menebak angka
  medis lebih berbahaya daripada tidak menebak.
- **Peringatan tegas selalu tampil**: ini alat bantu baca, angka hasil lab wajib
  dicocokkan ke kertas aslinya.
- **Keyakinan mesin bukan jaminan.** Pernah 84% tapi angkanya salah. Angka itu
  ditampilkan sebagai keterangan, bukan sebagai lampu hijau.
- **Tulisan tangan belum ditangani.** Resep yang ditulis tangan akan gagal.

Kesimpulan praktis: fitur ini andal untuk **label obat dan teks tercetak yang
jelas**, dan berguna tapi **belum bisa dipercaya sendiri untuk hasil lab** —
persis itulah yang dikatakan aplikasinya kepada pengguna.

### Menguji pindai foto

```bash
node uji-ocr.mjs        # 36 pemeriksaan: perapian teks & penandaan angka
```

Bagian yang butuh peramban sungguhan (mesin OCR-nya sendiri) diuji manual:
jalankan `npm start`, buka `/app/`, pakai tombol kamera di komposer Tanya AI,
masukkan foto label obat atau hasil lab, lalu periksa bahwa teksnya muncul.

**Cara memeriksa "tanpa internet" yang benar.** Yang membuktikan janji
"foto tidak keluar dari perangkat" adalah uji blokir: halangi
`cdn.jsdelivr.net`, `unpkg.com`, `cdnjs.cloudflare.com`, dan
`raw.githubusercontent.com`, lalu pindai ulang — hasilnya harus sama. Uji itu
sudah dijalankan dan lulus (492 karakter, hasil identik).

Menonton tab Network saja **tidak cukup**, dan ini perlu disebut apa adanya:
tesseract.js memuat mesinnya di dalam Web Worker lewat `importScripts()`, dan
panggilan itu **tidak terekam** oleh perekam `fetch`/`XMLHttpRequest` maupun
oleh sebagian tampilan tab Network. Jadi "tab Network kosong" bukan bukti
yang sah untuk berkas yang diambil worker — walau di kasus ini memang tidak
ada permintaan ke luar, karena seluruh berkas disajikan dari
`app/public/ocr/` di situs sendiri.

### Menyetel mutu pembacaan

`app/src/lib/ocr.js` menyimpan angka-angka yang dipilih dari pengukuran, bukan
perkiraan. Kalau hasil pembacaan terasa memburuk, tiga hal ini yang pertama
diperiksa:

| Setelan | Nilai | Kenapa |
|---|---|---|
| `MAKS_SISI` / `MAKS_SISI_BESAR` | 2000 / 2600 px | huruf ~27 px benar untuk teks besar, ~35 px untuk teks kecil, ~44 px mulai salah |
| `TINGGI_HURUF_IDEAL` | 34 px | tinggi huruf yang mendekati keduanya |
| `AMBANG_RENTANG` | 110 | di bawah rentang kontras ini, perentangan kontras dipakai; di atasnya justru merusak (`11.2` jadi `21.2`) |

---

## Tingkat baca

Penyederhanaan teks memakai 4 tingkat, dengan patokan **umur pembaca** — bukan
kelas sekolah, karena "setara kelas 6" tidak berarti apa-apa bagi orang tua atau
lansia (`app/src/data/tingkat.js`):

| Tingkat | Umur | `aslMaks` (kata/kalimat) | `kalimatTerpanjangMaks` |
|---|---|---|---|
| Anak-anak | 9–11 tahun | 7 | 11 |
| Remaja | 12–25 tahun | 9 | 14 |
| Dewasa | 26–59 tahun | 12 | 23 |
| Lansia | 60 tahun ke atas | 8 | 12 |

Lansia ditargetkan **lebih sederhana** dari Dewasa, karena anak 9 tahun dan
lansia 80 tahun sama-sama butuh bahasa sederhana. Rantai penuh
`anak ≤ lansia ≤ remaja ≤ dewasa` **sengaja tidak dipakai sebagai syarat**:
"mana yang lebih sederhana" di antara anak dan lansia tidak punya arti bagi
pengguna.

`SASARAN` di `app/src/lib/keterbacaan.js` adalah hasil **kalibrasi dari
pengukuran nyata** (17 berkas `docs/latih-tingkat-*.json`), bukan angka yang
dikarang. **Hanya `aslMaks` dan `kalimatTerpanjangMaks` yang menggagalkan**;
`aswMaks`, `sulitMaks`, dan `sangatPanjangMaks` hanya dilaporkan sebagai tren.

Bahasa Indonesia **tidak punya rumus keterbacaan resmi** — Flesch dan Gunning
Fog tidak punya padanan baku, jadi modul itu tidak mengklaim "kelas baca".
Yang dihitung: rata-rata kata/kalimat, suku kata/kata (gugus vokal berurutan),
persentase kata sulit, dan kalimat terpanjang. **Panjang kata tidak dipakai
sebagai gerbang**: kata yang paling sering dicap "sulit" ternyata kata
sehari-hari (adalah, karena, latihan, tekanan), dan lantai normal prosa
Indonesia adalah 31–46% kata ≥3 suku kata.

---

## Menjalankan uji

**Satu perintah untuk semuanya:**

```bash
cd app && npm test
```

Perintah itu menjalankan `uji-semua.mjs` di akar repo, yang menelusuri seluruh
berkas `uji-*.mjs` **dari isi folder** — jadi uji baru otomatis ikut tanpa perlu
memperbarui daftar di mana pun. Diukur 12 Nov 2026: **33 berkas lulus, 0 gagal,
±25 detik**, tanpa jaringan dan tanpa API key. Uji yang butuh peramban, server,
atau API key sengaja dikeluarkan dan dijalankan terpisah (lihat bawah) — supaya
gerbang ini tidak bergantung pada keadaan mesin.

Daftar per berkas (jalankan langsung dari akar repo kalau sedang menelusuri satu
uji tertentu):

```bash
node uji-batas.mjs        # batas panjang & laju tiap rute (46)
node uji-tingkat.mjs      # tingkat baca: server & klien memilih bawaan yang sama (baru, 5 Nov)
node uji-dokumentasi.mjs  # angka di README sama dengan isi repo (baru, 5 Nov)
node uji-ekstrak.mjs      # penarikan konten dari HTML sumber
node uji-kata-kunci.mjs   # pencocokan kata kunci topik
node uji-teks.mjs         # perapian teks & pemotongan kalimat
node uji-ocr.mjs          # perapian teks OCR & penandaan angka
node uji-bahasa.mjs       # kesehatan kamus id/en (kunci seimbang, tak menganggur)
node uji-berita.mjs       # deteksi berita, parser RSS, penetrasi
node uji-jam.mjs          # jam acuan dari header internet
node uji-rotasi.mjs       # rotasi daftar konten harian
node uji-tanggal-konten.mjs  # tanggal terbit: parser, urutan, jendela rotasi
node uji-sumber-konten.mjs   # pengurai dua sumber konten (Kemenkes & CNN)
node uji-keterbacaan.mjs  # alat ukur keterbacaan itu sendiri
node uji-sumber.mjs       # lapis sumber + penanda domain resmi (tanpa jaringan)
node uji-klaim.mjs        # penyaring klaim prognosis
node uji-konteks.mjs      # konteks percakapan & pertanyaan lanjutan
node uji-faskes.mjs       # fasilitas: 10 kategori, koordinat, duplikat, IGD, tiga jebakan "kosong" (127)
node uji-suara.mjs        # ejaan singkatan & kestabilan nada
node uji-sitasi.mjs       # jejak sumber (butuh MariaDB; dilewati tanpa DB)
node uji-server.mjs       # kompresi, 404 JSON, galat klien
node uji-skor-hls.mjs     # skor HLS-SF12: indeks 0–50 & empat kategori
node uji-statis.mjs       # kompresi & cache berkas statis (HARUS sesudah build)
node uji-wilayah.mjs      # wilayah bertingkat: validasi kode, cascade, titik referensi (43)
node uji-rs-sirs.mjs      # rumah sakit SIRS: jumlah, wilayah, koordinat, filter, sinkron ulang (50)
node uji-statistik-faskes.mjs  # statistik nasional: total 49.548, cakupan, kaitan kategori (39)
node uji-cn.mjs                  # penggabung kelas Tailwind: kelas terakhir menang (8)
node uji-dedup-faskes.mjs        # aturan pembersihan duplikat faskes: jarak, nama generik, gabung lintas sumber (23)
node uji-ukuran-bundel.mjs       # pagar ukuran bundel: index.js < 460 KB (1)
node uji-peramban.mjs           # peramban sungguhan: 7 halaman × 2 bahasa (105)
node uji-dokumentasi.mjs         # angka di README sama dengan isi repo (37)
node uji-semua.mjs              # satu perintah untuk semuanya (32)
node uji-jam.mjs                # jam acuan dari header internet (17)
node uji-rotasi.mjs             # rotasi daftar konten harian (22)
node uji-faskes-db.mjs          # penyimpanan fasilitas di MySQL (dilewati tanpa MariaDB; 12)
node uji-faskes-nasional.mjs    # pencarian faskes nasional: paginasi, saringan, koordinat (dilewati tanpa MariaDB; 37)
node uji-bahasa.mjs             # kesehatan kamus id/en (kunci seimbang, tak menganggur) (25)
node uji-geocoding.mjs    # deteksi wilayah dari `address` Nominatim nyata, 38 peta ISO (37)
node uji-faskes-db.mjs    # penyimpanan fasilitas di MySQL (dilewati tanpa MariaDB; 12)
node uji-rute-perjalanan.mjs  # rute: tiga moda, polyline6, terjemahan instruksi, tautan Maps (44)
node uji-halaman-penjelasan.mjs  # halaman depan: 6 kartu, 5 tangkapan layar termuat (butuh server + Chrome)
node uji-peramban.mjs     # peramban sungguhan: 7 halaman × 2 bahasa (butuh server + Chrome)
```

Tiga uji terakhir butuh Chrome (dan `uji-halaman-penjelasan` butuh server hidup).
Skripnya memakai CDP langsung, tanpa dependensi baru — dan sengaja begitu:
harness browser biasa timeout pada halaman penjelasan karena tingginya 18.280 px
dengan banyak animasi dan gambar lambat.

### Uji peramban otomatis — 7 halaman × 2 bahasa

Satu-satunya hal yang tidak bisa dibuktikan dari build hijau adalah perilaku di
layar. `uji-peramban.mjs` mengendalikan Chrome lewat protokol DevTools **tanpa
dependensi baru**, lalu memeriksa untuk setiap halaman dan setiap bahasa:
judul halaman tampil, tepat satu `h1`, tidak ada luapan horizontal di
1280×800 maupun 375×812, tidak ada galat runtime, dan — untuk halaman fitur
(Tanya AI, Riwayat, Kuesioner) — isinya **muat satu layar** di 1366×700 dan
375×812. Cek Klaim dan Fasilitas Kesehatan diuji pada versi laptop saja: keduanya
memuat kotak isian/peta plus hasil yang memang bergulir di panelnya sendiri.

```bash
cd app && npm run server     # terminal lain; dist/ harus sudah dibuild
cd .. && node uji-peramban.mjs   # 105 pemeriksaan, ±40 detik
```

Uji ini **tidak** ikut `npm test` — ia butuh server hidup dan peramban, jadi
menjalankannya di dalam gerbang tanpa jaringan akan membuat hasilnya
bergantung pada mesin. Kalau server mati atau Chrome tidak ada, ia berhenti
dengan keterangan **DILEWATI** (exit 0), bukan gagal.

Satu pengecualian disebut terbuka: **Cek Klaim perlu digulir di HP 375×812**
(terukur 1.182 px isi untuk 812 px layar). Halaman itu memuat kotak isian,
deretan contoh, dan area hasil sekaligus; memaksanya muat satu layar di HP akan
mengorbankan keterbacaan. Yang diuji untuk halaman itu adalah versi laptop.

> Uji inilah yang menemukan Beranda melebar ke **612 px** di layar 375 px,
> padahal halaman lain rapi: satu baris teks panjang di kepala bagian Topik
> (`Artikel terbaru terbit … · Terakhir dicek …`) dibungkus `shrink-0` sehingga
> menolak menyusut. Diperbaiki 1 Nov 2026 di `SectionHeading`.

### Lint — gerbang mutu kode

```bash
cd app && npm run lint      # atau: npm run lint:perbaiki
```

ESLint dipasang 21 Okt 2026 dan **langsung menemukan dua cacat nyata yang tidak
tertangkap uji mana pun**:

1. **`kuis.terjawabDari` tertulis DUA KALI** di `src/data/bahasa.js`, di kedua
   blok bahasa. Literal objek JS diam-diam memakai nilai terakhir, jadi kunci
   ganda tidak memunculkan galat dan tidak menggagalkan `uji-bahasa.mjs` —
   persis seperti yang sudah diperingatkan di catatan proyek.
2. **Balapan nyata di `server/rute.js`**: `/api/health` bisa memanggil layanan
   model dan menyambung database berkali-kali untuk satu informasi yang sama
   kalau permintaan datang bersamaan. Sekarang dijaga `sedangUkur`.

Ditambah: `db()` bisa membuat **dua pool** dan meninggalkan salah satunya
terbuka (kebocoran koneksi MariaDB) — sekarang dijaga `menyambung`. Dan beberapa
variabel/import mati yang selama ini tidak terpakai ikut dibuang.

Konfigurasi ini **tidak** mengatur gaya penulisan (indentasi, tanda kutip,
urutan impor). Alasannya: proyek ini belum punya gaya baku, dan ratusan
pelanggaran gaya sekaligus akan membuat gerbang ini dimatikan orang — gerbang
yang dimatikan lebih buruk daripada tidak ada. Yang dijaga hanya kesalahan yang
tidak terlihat dari build hijau.

Kelonggaran yang disengaja, semuanya tertulis di `app/eslint.config.mjs`
beserta alasannya: `require-atomic-updates` untuk empat berkas yang sudah
punya penjaga janji (`konten.js`, `berita.js`, `cari.js`, `db.js`), dan
`rules-of-hooks` untuk dua hook bernama Indonesia (`gunakanBahasa`,
`gunakanSuara`) yang oleh aturan bawaan dianggap bukan hook.

### Yang butuh jaringan

Skrip di bawah **butuh jaringan** atau kuota model, dan hanya dipakai untuk
memilih angka batas dari pengukuran, bukan untuk rutin:

```bash
node ukur-konten.mjs      # berapa permintaan jaringan saat cache konten kosong
node ukur-suara.mjs       # berapa lama TTS benar-benar butuh (ini asal MAKS_SUARA)
node ukur-pengetahuan.mjs # 86 pertanyaan lintas bidang -> berapa dapat sumber
node ukur-tingkat.mjs     # 8 pertanyaan x 4 tingkat (butuh server lokal + key)
node verifikasi-judul.mjs # buktikan setiap judul artikel Wikipedia benar-benar ADA
node periksa-istilah.mjs  # periksa calon istilah baru sebelum masuk peta
node uji-jawaban.mjs      # tembak /api/tanya server lokal, baca JAWABANNYA
node uji-sumber.mjs --jaringan  # buktikan sumbernya benar-benar ada
node ambil-tangkapan.mjs  # ambil 5 tangkapan layar fitur fasilitas (butuh server + Chrome)
```

Fitur Fasilitas Kesehatan memakai empat layanan luar. Semuanya **gratis dan
tanpa kunci**, dan semuanya bisa gagal:

| Layanan | Dipakai untuk | Kalau gagal |
|---|---|---|
| Overpass API (OpenStreetMap) | daftar fasilitas | `503 sumber_gagal` + tombol coba lagi |
| Valhalla (`valhalla1.openstreetmap.de`) | rute tiga moda | pesan galat + tautan Google Maps |
| Nominatim | titik referensi wilayah | `titikGagal` — pilihan wilayah tetap jalan, hanya titiknya tidak ada |
| `wilayah.id` | daftar provinsi/kabupaten/kecamatan/desa | dropdown kosong dengan pesan, bukan daftar karangan |

### Lapisan server — hal yang salahnya tidak terlihat dari build hijau

`uji-server.mjs` menguji empat hal yang **tidak merusak fitur apa pun** kalau
salah, sehingga tidak akan ketahuan dari uji fitur maupun build yang lulus:

| Yang dijaga | Kenapa penting |
|---|---|
| Respons besar dikompresi (gzip) | Diukur 20 Okt 2026: `/api/konten` **6.137 → 1.912 byte (hemat 69%)**. Tanpa ini aplikasi tetap jalan — hanya lambat di jaringan seluler. |
| JSON rusak dijawab **400**, bukan 500 | Kalau salah, kesalahan klien dilaporkan sebagai kesalahan server: pengguna disuruh "coba lagi" padahal isinya yang salah, dan pemantauan melihat 500 seolah server kita yang rusak. |
| `/api/*` tak dikenal → **JSON** | Bawaan Express membalas halaman HTML yang **menyebut "Express"** — memberitahu penyerang kerangka yang dipakai, sekaligus menyesatkan klien yang mengharap JSON. |
| `X-Waktu-Ms` di setiap respons | Menjawab "lambat di server atau di jaringan?" tanpa membuka log. Terukur 20 Okt 2026: `1.1` ms untuk `/api/meta`. Permintaan > 3 detik juga dicatat di log sebagai `[lambat]`. |

Ditambah tiga kepala keamanan (`app/server/kepala.js`): `X-Powered-By`
dimatikan, `X-Content-Type-Options: nosniff`, dan
`Referrer-Policy: strict-origin-when-cross-origin`. **Content-Security-Policy
sengaja belum dipasang** — salah tulis satu direktif bisa mematikan peta, suara,
atau OCR, dan itu butuh pengujiannya sendiri.

**Dua jebakan yang sudah terukur** (dan sebabnya uji ini ditulis):

1. `res.on('finish')` berjalan **setelah** header terkirim, jadi `setHeader` di
   dalamnya tidak berpengaruh — `X-Waktu-Ms` sempat tidak pernah muncul. Yang
   benar: hitung saat header AKAN dikirim (bungkus `res.writeHead`).
2. `fetch` bawaan Node **selalu** mengirim `Accept-Encoding: gzip` sendiri dan
   langsung men-dekompresi balasannya. Mengukur kompresi lewat `fetch`
   menghasilkan kesimpulan palsu ("tidak dikompresi", "ukurannya sama").
   Karena itu pengukuran kompresi memakai **HTTP mentah** (`node:http`).

`uji-suara.mjs` **tidak memanggil layanan suara** (tidak butuh jaringan), jadi
bisa ikut dijalankan di CI. Yang dijaganya: singkatan mana yang dieja dan mana
yang **tidak boleh** dieja — setiap anggota kedua kelompok diuji satu per satu,
sehingga menambah/mengurangi daftarnya tanpa mengukur ulang akan langsung gagal.

`uji-bahasa.mjs` menjaga tiga cacat kamus sekaligus: kunci yang dipakai tapi
tidak ada, kunci yang hanya ada di satu bahasa, dan kunci yang menganggur
(tidak dipakai siapa pun). Ketiganya pernah terjadi di proyek ini.
**Kunci dobel di dalam satu blok bahasa tidak ditangkap uji mana pun** —
literal objek JS diam-diam memakai nilai terakhir, jadi hitung sendiri per kunci
kalau menambah banyak kunci sekaligus.

`uji-keterbacaan.mjs` menguji **alat ukurnya**, bukan jawabannya. Alat ukur yang
salah menghasilkan kesimpulan yang salah dengan sangat meyakinkan, jadi
penghitung suku katanya diuji dengan kata yang jumlahnya bisa dihitung manusia
("hipertensi" = 4, "pantai" = 2 karena diftong), dan daftar berbutir dipastikan
TIDAK dihitung sebagai satu kalimat raksasa.

`uji-sumber.mjs` juga berjalan tanpa jaringan (**109 pemeriksaan**). Versi
`--jaringan` menambahkan pemeriksaan bahwa setiap judul artikel Wikipedia yang
dipetakan benar-benar ada.

### Integrasi berkelanjutan

`.github/workflows/uji.yml` menjalankan seluruh uji di atas ditambah
`node --check` dan `npm run build` pada setiap push dan pull request ke `main`.
Jumlah langkahnya naik setiap kali ada uji baru — **hitung ulang** dengan
`gh run view <id> --json jobs --jq '.jobs[].steps[]'`, jangan dikutip dari sini.
Diukur pada commit `b90f865` (14 Nov 2026, run `43539872861`): **45 langkah**,
semuanya `success`. Workflow sendiri mendaftar 41 langkah (dua di antaranya `uses:`
tanpa nama); empat sisanya langkah bawaan runner: `Set up job`, dua `Post …`, dan
`Complete job`.

**Dua uji yang dulu tertinggal, sekarang sudah masuk CI** (2 Nov 2026):
`uji-klaim.mjs` (43 pemeriksaan) dan `uji-konteks.mjs` (49). Keduanya sudah
lama ada dan selalu hijau di laptop, tetapi tidak pernah terdaftar di workflow —
jadi **92 pemeriksaan penjaga penyaring klaim dan konteks percakapan tidak
pernah dijalankan di runner**. Ini jenis hijau palsu yang sama dengan yang
pernah terjadi pada `uji-tanggal-konten.mjs`. Aturannya tetap: **setiap
`uji-*.mjs` baru wajib ditambahkan sebagai langkah di `uji.yml`** — `npm test`
menemukan berkas uji dari folder, CI tidak.

Dua hal yang **tidak** dijalankan di CI, dan alasannya disebut apa adanya:
`uji-jawaban.mjs` butuh `KENARI_API_KEY` (rahasia tidak boleh jadi penentu pada
pull request orang lain), dan uji berjaringan (`--jaringan`, `ukur-*`,
`verifikasi-judul.mjs`) bisa merah karena Wikipedia berubah, bukan karena kode
kita salah. Keduanya dijalankan manual sebelum deploy.

> **Catatan pemasangan di CI:** langkahnya memakai `npm ci --include=dev
> --ignore-scripts`. Flag `--ignore-scripts` wajib: `msedge-tts` memasang
> `preinstall: npx only-allow pnpm`, yang keluar dengan kode 1 bila dijalankan
> npm (diukur: exit 1 di bawah npm, exit 0 hanya di bawah pnpm). npm 11
> melewatkan install script secara bawaan sehingga ini tidak terasa di komputer
> pengembang, tetapi runner GitHub memakai npm 10 dan menjalankannya.
> Urutan langkah juga penting — dependensi dipasang lebih dulu, karena
> `uji-ocr.mjs` mengimpor `tesseract.js` lewat `app/src/lib/ocr.js`.

### Mengukur & melatih tingkat pembaca

"Latih" di sini **bukan fine-tuning** — Kenari tidak punya endpoint
fine-tuning (diperiksa: `/fine_tuning/jobs`, `/fine-tunes`, `/finetuning/jobs`,
`/models/train`, `/training/jobs` semuanya 404). Latih = memperdalam prompt di
`app/server/prompts.js`, lalu **mengukur hasilnya dengan angka**:

```bash
node ukur-tingkat.mjs                 # 8 pertanyaan x 4 tingkat, butuh server lokal
node ukur-tingkat.mjs --cepat         # 3 pertanyaan saja
node ukur-kalibrasi.mjs docs/latih-tingkat-<cap>.json [--tulis]
```

Hasil 14 Okt 2026 — rata-rata kata/kalimat dari 7 putaran pengukuran (makin
kecil makin mudah diikuti):

| | anak | lansia | remaja | dewasa |
|---|---|---|---|---|
| sebelum | 6,34 | 10,66 | 17,80 | 18,72 |
| sesudah | **6,01** | **6,68** | **7,34** | **10,37** |

Yang diuji bukan "apakah tangganya naik", melainkan **apakah jawaban tiap
tingkat lebih mudah daripada jawaban untuk DEWASA** — itu janji aplikasinya.
Diukur 8 putaran sebelum vs 7 putaran sesudah:

| hubungan wajib | kata/kalimat | kalimat terpanjang |
|---|---|---|
| anak < dewasa | 98,4% → **100,0%** | 95,2% → 96,4% |
| lansia < dewasa | 100,0% → 98,2% | 95,2% → 96,4% |
| remaja < dewasa | 82,0% → **94,6%** | 72,1% → **94,6%** |

Yang paling penting bukan angkanya, melainkan **isi tidak berkurang**: poin
kunci rata-rata anak 7,77 · lansia 7,34 · remaja 7,39 · dewasa 7,09. Sebelum
diperiksa, jawaban lansia justru punya poin kunci paling sedikit — batas kata
per kalimat dibaca model sebagai batas seluruh jawaban.

**Satu putaran bukan bukti.** Dengan prompt yang sama, satu putaran memberi
`remaja < dewasa` 8/8 dan putaran berikutnya 5/8. Karena itu kesimpulan hanya
diambil dari agregasi beberapa putaran.

Yang **tidak** bisa diuji dari terminal — karena butuh peramban sungguhan —
diuji manual di `/app/`: mesin OCR, pengenalan suara, pemutaran suara, dan
papan klip.

---

## Fasilitas Kesehatan Terdekat

Menu ketujuh di sidebar. Pengguna memberi izin lokasi lewat **Geolocation API
peramban**, dan aplikasi menampilkan fasilitas kesehatan nyata di sekitarnya —
rumah sakit, puskesmas, klinik, praktik mandiri, apotek, laboratorium, penunjang
medis, fasilitas kesehatan masyarakat, pengobatan tradisional, dan fasilitas
khusus. Peta memakai **Leaflet + OpenStreetMap** dengan penanda berkelompok
(*marker clustering*).

**Tidak ada koordinat cadangan.** Kalau izin lokasi ditolak, aplikasi tidak
mengisi lokasi apa pun — yang muncul adalah kolom pencarian lokasi manual
(Nominatim, juga OpenStreetMap). Menampilkan fasilitas di sekitar titik karangan
pada konteks kesehatan bukan kemunduran kecil, melainkan kesalahan yang bisa
menyesatkan orang yang sedang mencari pertolongan.

### Sumber datanya, dan mengapa hanya satu

| Sumber | Status saat diukur (2 Nov 2026) | Dipakai? |
|---|---|---|
| OpenStreetMap lewat Overpass API | Menjawab; 1.702 fasilitas nyata dalam radius 10 km di Jakarta Pusat | **Ya** |
| `faskes.kemkes.go.id` | Nama domain tidak ditemukan | Tidak |
| `data.kemkes.go.id` | Nama domain tidak ditemukan | Tidak |
| `api.kemkes.go.id` | HTTP 404 | Tidak |
| `sirs.kemkes.go.id/fo/home/rekap_rs_all?id=0` | **HTTP 200 dan JSON** — seluruh daftar nasional, tanpa paginasi | **Ya** |
| `satusehat.kemkes.go.id` | Gerbang layanan ber-JavaScript; API FHIR-nya membalas **HTTP 401** tanpa kredensial resmi | Tidak |

Catatan koreksi: uji awal sempat menyimpulkan `sirs.kemkes.go.id` hanya berisi
formulir. Itu salah — endpoint `rekap_rs_all` mengembalikan JSON berisi
**3.325 rumah sakit** dan langsung dipakai, tervalidasi terhadap rekapitulasi
resmi SIRS sendiri (kelas A 86 · B 451 · C 1.826 · D 872 · D PRATAMA 85;
RSU 2.828 · RSIA 296). Yang tetap tidak bisa diambil dari sana adalah
**koordinat**, sehingga baris SIRS diberi tanda "Tanpa koordinat" dan tidak
ditampilkan di peta.

### Batas yang disebut apa adanya

- **OpenStreetMap dipetakan sukarela.** Kelengkapan berbeda tajam antarwilayah.
  Diukur di Jakarta Pusat (radius 10 km): 1.702 fasilitas, tetapi hanya **53**
  punya nomor telepon, **25** punya website, dan **6** bertanda IGD. Kolom yang
  tidak tercatat ditampilkan **"Tidak tercatat"** — tidak pernah diisi tebakan.
- **IGD dan 24 jam hanya dilaporkan bila datanya ada** (`emergency=yes`,
  `opening_hours=24/7`, atau "IGD" pada nama). Tidak ada data berarti
  "Tidak diketahui", bukan "tidak ada IGD".
- **Muat pertama untuk lokasi baru lambat: 40–50 detik.** Diukur 3 Nov 2026: radius
  1 km butuh **43 detik**, 5 km **45 detik**, 10 km **53 detik** — jadi memperkecil
  radius TIDAK menolong; yang mahal adalah perjalanan ke Overpass-nya, bukan
  jumlah hasilnya. Antarmuka menyebut alasannya alih-alih diam.
- **Pemanasan menghilangkan penantian itu saat demo.** Hasil disimpan 10 menit di
  server **dan di berkas `.cache-faskes.json`**, jadi bertahan setelah server
  dijalankan ulang. Terukur: permintaan pertama sesudah restart **13 ms**, dan di
  peramban **0,5 detik** — dari 40–50 detik. Simpanan yang tersedia untuk radius
  lebih besar juga dipakai untuk radius yang lebih kecil (disaring), sehingga
  pemanasan 5 km melayani permintaan 1 km.

  ```bash
  # nyalakan pemanasan sebelum demo (titik = tempat juri akan mencoba)
  PEMANASAN_TITIK="-6.1754,106.8272" npm run server
  # beberapa titik sekaligus, dipisah titik koma
  PEMANASAN_TITIK="-6.1754,106.8272;-6.9218,107.6070" PEMANASAN_RADIUS=5000 npm run server
  ```

  **Kosong secara bawaan** — aplikasi tidak menyiapkan data untuk kota yang belum
  tentu dipakai, dan pemanasan tidak pernah mengarang fasilitas maupun menandai
  lokasi pengguna. Pengguna tetap harus memberi izin lokasi sendiri.
- **Di Jakarta, kategori "Kesehatan Tradisional" dan "Fasilitas Khusus" masih
  kosong.** Datanya memang belum dipetakan di OSM, bukan filternya rusak.
- **Batas 600 fasilitas terdekat** ditampilkan terbuka pada layar
  ("Menampilkan 600 dari 1.702 yang ditemukan").

### Penggabungan, penyaringan, dan penyeragaman

Lima cermin Overpass dicoba berurutan dengan anggaran waktu 100 detik. Cermin
yang membalas **200 tetapi kosong** ditolak — `overpass.osm.ch` hanya memuat
data Swiss dan pernah membuat peta tampil kosong padahal permintaannya
"berhasil". Duplikat (satu fasilitas terpetakan sebagai titik *dan* bangunan)
digabung bila namanya sama dan jaraknya di bawah 60 m; kolom yang kosong diisi
dari kembarannya.

### Tujuh cacat yang tertangkap saat pengujian

Semuanya ditemukan dari pengukuran, bukan dugaan — dan semuanya sekarang dijaga
`uji-faskes.mjs`:

1. Cermin yang membalas kosong dianggap berhasil → peta kosong.
2. **122 Posyandu masuk filter Klinik** karena bertag `amenity=clinic`.
3. Saat server gagal, UI menulis "0 fasilitas ditemukan" — itu pernyataan bahwa
   sumbernya menjawab "tidak ada", padahal sumbernya tidak menjawab sama sekali.
4. Tombol Hubungi menggabungkan dua nomor jadi satu nomor palsu
   (`tel:+622****1008+622****0702`).
5. Kolom "Layanan" menampilkan tembok istilah Inggris (`acupuncture;allergology;…`).
6. Menggeser radius memicu permintaan ulang 50 detik untuk data yang sebagian
   besar sudah ada di layar.
7. Daftar milik titik pencarian sebelumnya tetap tampil sambil menampilkan galat
   untuk titik yang baru.

---

## Kuesioner HLS-SF12

12 item asli, satu pertanyaan per layar, diambil dari paper validasinya (Duong
et al., 2019) beserta terjemahan Indonesia yang tervalidasi — rinciannya di
`docs/sumber-hls-sf12.txt`. Kalimatnya sengaja **tidak** diterjemahkan ke
Inggris: menerjemahkan ulang membuat skornya tidak bisa dibandingkan dengan
rujukan.

### Skor: indeks 0–50, empat kategori

Skor memakai **rumus resmi instrumennya**, bukan persentase buatan sendiri:

```
indeks = (mean − 1) × (50/3)
```

`mean` = rata-rata nilai 12 item, tiap item 1–4 (sangat sulit = 1 … sangat
mudah = 4). Hasilnya 0–50, dan kategorinya mengikuti HLS-EU Consortium —
instrumen HLS-SF12 memakai rumus indeks yang sama dengan bentuk penuhnya:

| Kategori | Rentang | Arti |
|---|---|---|
| **Inadequate** | 0–25 | literasi kesehatan kurang |
| **Problematic** | >25–33 | bermasalah |
| **Sufficient** | >33–42 | cukup |
| **Excellent** | >42–50 | sangat baik |

Skor 0–33 bersama-sama disebut **limited health literacy**.

**Sebelum 21 Okt 2026 skornya SALAH SKALA**: yang ditampilkan persentase
0–100% dengan ambang buatan (≥70 / ≥45 / <45, tiga kategori). Akibatnya hasil
aplikasi ini **tidak bisa dibandingkan dengan rujukan mana pun** — paper
validasinya melaporkan indeks 0–50, bukan persentase. Perhitungannya sekarang
ada di `app/src/lib/skorHls.js` dan dijaga `uji-skor-hls.mjs` (35 pemeriksaan,
termasuk angka yang dihitung tangan: mean 2,5 → indeks 25; mean 3 → 33,3).

**Angka dari lima pernyataan lama, dan angka persentase sebelum 21 Okt 2026,
TIDAK bisa dibandingkan dengan hasil sekarang.**

### Yang dilakukan aplikasi setelah skor keluar

Bukan sekadar menampilkan angka:

- **Riwayat skor** tersimpan terpisah dari jawaban (`pahami-sehat:kuesioner-skor`),
  maksimal 10 pengisian, dan hasil terbaru dibandingkan dengan pengisian
  sebelumnya (*naik/turun N poin*). "Ulangi" TIDAK menghapus riwayat — membuang
  riwayat punya tombolnya sendiri.
- **Dua jalan pintas** muncul saat skor ≤ 33 (limited): *Sederhanakan teks*
  membuka Tanya AI dengan mode Sederhanakan aktif, *Dengarkan jawaban* membuka
  Tanya AI dengan mode Tanya. Sebelumnya saran di kartu hasil hanya **menyuruh**
  pengguna menyalakan kedua fitur itu tanpa satu pun tombol yang melakukannya.

Seluruh perhitungan dan penyimpanan jalan di peramban; tidak ada jawaban yang
dikirim ke mana pun. Aplikasi menyebut hasilnya apa adanya: *"Hasil ini alat
bantu belajar, bukan diagnosis medis."*


---

## Etika, Privasi & Green IT

Tiga hal ini adalah **10% dari indikator penilaian LOGICODIX**, dan semuanya
adalah keadaan yang bisa diperiksa di kode — bukan janji di dokumen. Versi yang
ditulis untuk pembaca umum ada di halaman penjelasan, bagian **Privasi, Etika AI,
dan Jejaknya** (`docs/prototipe/index.html`, `id="etika"`).

### Privasi — apa yang keluar dari perangkat

| Data | Perjalanan |
|---|---|
| Foto yang dipindai | Dibaca di peramban (tesseract.js/WebAssembly dari `app/public/ocr/`, **bukan CDN**). Tidak ada permintaan keluar. |
| Jawaban kuesioner | Dihitung di peramban, disimpan di `localStorage`. Tidak pernah dikirim ke server. |
| Riwayat obrolan | `localStorage` peramban. Bisa dihapus satu per satu atau sekaligus. |
| Teks pertanyaan | **Hanya ini** yang dikirim ke server, karena model AI memang perlu membacanya. |
| Teks percakapan (konteks) | Tabel `percakapan` di server aplikasi ini — **hanya teks**, tanpa nama, tanpa IP, tanpa akun. Dihapus otomatis setelah **7 hari**. Dipakai supaya pertanyaan lanjutan tidak kehilangan topiknya. |

Batas yang jujur disebut: teks pertanyaan diproses oleh **layanan model AI pihak
ketiga** (Kenari.id). Karena itu halaman penjelasan memperingatkan pengguna agar
tidak menuliskan nama lengkap, NIK, nomor rekam medis, atau alamat rumah di
dalam pertanyaan (`docs/prototipe/index.html`, bagian
**Privasi, Etika AI, dan Jejaknya**).

**Tidak ada identitas yang diminta, sama sekali.** Tidak ada email, nomor
telepon, kata sandi, nama panggilan, atau data pribadi lain yang dikirim ke
server — karena tidak ada formulir yang memintanya. Panel **Pengaturan** hanya
memuat preferensi tampilan (tingkat baca, kontras, suara, bahasa) dan tidak
meminta data apa pun. Isi percakapan tidak pernah dipakai untuk analitik.

Bahan publik (berita RSS, artikel Kemenkes, salinan berlabel tanggal dari
sumber resmi) tersimpan di database bahan dan tidak berisi apa pun tentang
pengguna.

Yang ditulis ke disk: `.cache-konten.json` dan `.cache-berita.json` (berlaku
24 jam), plus tabel-tabel di atas bila MariaDB dijalankan.

### Etika AI — pagar yang ditanam di prompt

Lima larangan ini ada di `app/server/prompts.js` (`RUBRIK`, butir 4–6) dan
diuji oleh `uji-jawaban.mjs`, bukan sekadar dijanjikan di README:

1. **Tidak mendiagnosis** — butir 5: model bukan dokter, dilarang memberi
   diagnosis, resep, atau dosis.
2. **Tidak menyimpulkan pengguna mengidap sesuatu** — butir 6: pertanyaan
   "apakah saya kena X" dijawab faktor risiko sebagai fakta umum, bukan penilaian
   atas diri pengguna, dan dilarang menyusun daftar kemungkinan penyakit yang
   bersaing.
3. **Tidak memberi persentase** yang tidak ada di sumber.
4. **Tidak mengarang sitasi** — butir 4: kalau sumber tidak tersedia, model
   wajib menyatakan sumbernya belum bisa dipastikan.
5. **Tidak menjawab dari ingatan** — prompt berbunyi *"Jawab HANYA berdasarkan
   hasil pencarian di atas. Jangan menambah fakta dari ingatanmu."*

Konsekuensinya diterima terbuka: kalau pencarian tidak menemukan bahan, aplikasi
akan **mengaku tidak tahu**. Itu disengaja — aplikasi kesehatan yang menebak
lebih berbahaya daripada yang mengaku tidak tahu.

### Green IT — jejak sumber daya

Prinsip: **jangan panggil jaringan kalau hasilnya bisa dipakai ulang.**

| Kendali | Di mana | Angka |
|---|---|---|
| Cache konten kesehatan | `app/server/konten.js` (`BERLAKU_MS`) | 24 jam sekali sehari |
| Rotasi daftar konten | `app/server/konten.js` (`susun()`, `geser`, `JENDELA_ROTASI`) | urutan bergeser supaya artikel yang tampil tidak itu-itu saja — **tapi hanya di dalam 48 artikel terbaru**; artikel di luar jendela tidak pernah dipamerkan sebagai bacaan utama |
| Urutan artikel | `app/server/konten.js` (`urutkanTerbaru()`) | diurutkan menurut tanggal terbit dari sumber, terbaru dulu, SEBELUM diputar |
| Tanggal terbit artikel | `app/server/konten.js` (`bacaTanggalTerbit()`) | dibaca dari `itemprop="datePublished"` di halaman artikel; `null` kalau sumber tidak mencantumkan — tidak pernah ditebak |
| Ambang bentuk simpanan | `app/server/konten.js` (`VERSI_BENTUK`) | naikkan kalau bentuk data artikel berubah, supaya artikel lama diambil ulang |
| Batas pengambilan artikel | `app/server/konten.js` (`MAKS_DETAIL`) | 8, dari yang tadinya bisa sampai 40 |
| Pembatas laju per IP | `app/server/batasInput.js` (`LAJU`) | 20 permintaan/menit (health/meta/berita 120) |
| Simpanan hasil health | `batasInput.js` (`SIMPANAN_HEALTH_MS`) | 15 detik |
| Kompresi gzip respons API | `app/server/saji.js` | `/api/konten` 6.370 → 1.959 byte (**−69%**) |
| Jam acuan tanpa permintaan tambahan | `app/server/jam.js` | memakai header `Date` respons yang sudah ada |
| Kompresi berkas statis | `app/scripts/mampatkan-dist.mjs` + `sajikanFolder` di `app/server/saji.js` | disiapkan **sekali saat build** (`.gz`), bukan per permintaan. Terukur: JS 402.486 → **123.163** byte (−69%), CSS 58.741 → **11.573** byte (−80%), halaman penjelasan 79.765 → **19.997** byte (−75%) |
| Unduhan pertama aplikasi | `/app/` | **461.914 → 135.132 byte (−71%)** — diukur 21 Okt 2026 dari server lokal |
| Cache aset ber-hash | `aturanCache` di `app/server/saji.js` | 1 tahun, `immutable` (nama ber-hash: isi berubah → nama berubah) |
| Cache berkas ber-nama-tetap | `aturanCache` di `app/server/saji.js` | `/app/ocr/` 1 hari + `stale-while-revalidate` 7 hari; halaman penjelasan 5 menit |
| Kerangka aplikasi (`/app/`) | `aturanCache` | `no-cache` — di dalamnya tertulis nama berkas ber-hash, jadi wajib selalu segar |
| Pemindaian foto | `app/src/lib/ocr.js` | 0 permintaan server |

**Yang belum selesai, disebut apa adanya:**

- Pembatas laju disimpan di **memori proses**, jadi di lingkungan serverless
  batasnya berlaku **per-instance, bukan global**. Untuk batas yang benar-benar
  global diperlukan penyimpanan bersama (mis. Redis/Upstash) — belum dipasang.
- Aplikasi ini **belum mengukur emisi karbonnya sendiri**, jadi tidak ada angka
  jejak karbon yang diklaim di mana pun.
- Halaman kebijakan privasi tersendiri **sudah ada** di `/privasi.html`, beserta
  kanal kontak resmi (halaman masalah pada repositori publik). Batas yang masih
  berlaku disebut di sana: karena tidak ada akun dan tidak ada identitas pada
  baris percakapan, data **tidak dapat dicari per orang**, sehingga permintaan
  penghapusan per orang tidak dapat dijalankan; yang menjamin penghapusan adalah
  batas otomatis 7 hari.

### Kepatuhan UU PDP No. 27/2022 dalam praktik

| Prinsip | Keadaan |
|---|---|
| Minimalisasi data | Yang diambil hanya teks pertanyaan. Tidak ada nama lengkap, NIK, alamat, email, atau kata sandi yang diminta — tidak ada formulir yang memintanya. |
| Kendali di tangan subjek data | Riwayat dan jawaban kuesioner disimpan di perangkat pengguna dan bisa dihapus pengguna kapan saja. |
| Keterbukaan | Perpindahan data dijelaskan sebelum pengguna memakainya (panel Pengaturan), bukan disembunyikan. |
| Hak penghapusan | Terpenuhi secara teknis (tombol hapus riwayat, tombol ulangi kuesioner) dan tersedia kanal kontak resmi di `/privasi.html`. **Tidak dapat dicari per orang** karena tidak ada akun; penghapusan dijamin oleh batas otomatis 7 hari pada konteks percakapan di server. |

---

## Tim

**NØCTURNE** — tim peserta LOGICODIX 2026, subtema *Inclusive Health & Well-being*.

| Nama | Peran |
|---|---|
| **Gesang Hemas Bayu Sekti** | Ketua Tim · Inovator, Developer & Video Demo |
| **Rafsanjani Castro Satria Chandra** | Inovator & Developer |
| **Najwa Azahra Purnomo Putri** | Inovator & Analis |
| **Matthew Randyka Jesa** | Inovator & Analis |

---

## Konteks lomba (LOGICODIX 2026)

Indikator penilaian: Problem-Solution Fit 25% · Technology Innovation 25% ·
Software Engineering 25% · UI/UX 15% · Green IT & Ethics 10%.

Tenggat: Hacking Week 7–14 November 2026 · **Last Submission 14 November 2026** ·
Pengumuman finalis 21 November 2026 · Puncak acara 29 November 2026.

Ketentuan yang mengikat: karya MVP berbasis Web/Mobile, source code di repo GitHub,
video demo 3–5 menit **tanpa narasi peserta**, dan aplikasi harus bisa dijalankan
di localhost saat Grand Final.

Video demo **tidak disimpan di repo ini** — pembuatannya di luar repo, dan folder
`video/` sengaja diabaikan `.gitignore` supaya berkas besar tidak ikut ter-commit.

Tim: **NØCTURNE**, empat orang — nama dan perannya di bagian [Tim](#tim).

---

## Membuka aplikasi ke internet, tapi tetap berjalan di laptop sendiri

Aplikasi ini dirancang berjalan di komputer sendiri: satu server Express menyajikan
halaman penjelasan (`/`) dan aplikasi (`/app/`), dan fitur suara neural memakai
WebSocket yang tidak bisa hidup di fungsi serverless. Yang kurang hanya satu: orang
lain tidak bisa membukanya.

**Cloudflare Tunnel** menutup celah itu tanpa membuka port di router dan tanpa
menyewa server:

```bash
./jalankan-online.sh
```

Skrip itu membangun aplikasi, menjalankan server, membuka terowongan, lalu mencetak
alamat `https://….trycloudflare.com` yang bisa dibuka siapa saja. Berhenti dengan
**Ctrl+C** — keduanya ikut berhenti.

### Kenapa ini lebih baik daripada sekadar `http://<ip-lan>`

| | `http://192.168.x.x:8787` | Terowongan Cloudflare |
|---|---|---|
| Bisa dibuka dari luar jaringan | tidak | ya |
| HTTPS | tidak | **ya** |
| Pengenalan suara (mikrofon) | **tidak** — peramban memblokir mikrofon di halaman http | ya |
| Suara neural (TTS) | ya | ya |
| Port terbuka di router | perlu | **tidak** |
| Alamat tetap | ya | berubah tiap dijalankan |

Peramban hanya mengizinkan mikrofon dan papan klip di **konteks aman** — `https://`
atau `localhost`. Diukur 15 Okt 2026: lewat terowongan, `window.isSecureContext`
bernilai `true`, `SpeechRecognition` dan `mediaDevices` tersedia, dan `/api/suara`
menjawab `200` berisi MP3 24 kHz — hal yang tidak bisa dilakukan lewat alamat IP biasa.

### Batasnya, disebut apa adanya

- Alamatnya **hidup hanya selama skrip jalan dan mesin ini menyala**. Tidak ada
  uptime yang dijanjikan, dan terowongan tanpa akun Cloudflare memang tanpa jaminan.
- Alamat `trycloudflare.com` **berubah setiap kali dijalankan**.
- Server tetap hanya mendengarkan di `127.0.0.1`; yang menghubungkannya ke internet
  hanyalah `cloudflared`. Jadi tidak ada port yang terbuka ke jaringan lokal.
- Terowongan ini membuka aplikasi ke publik. Batas laju di `app/server/batas.js`
  tetap berlaku, tetapi **tidak ada autentikasi tambahan** — jangan dipakai untuk
  data pribadi.

`siapkan-domain.sh` dan cabang named tunnel di `jalankan-online.sh` **sengaja
dibiarkan di repo** tetapi **INERT**: keduanya tidak berpengaruh apa pun selama
`~/.cloudflared/config.yml` tidak ada, dan `jalankan-online.sh` otomatis memakai
quick tunnel. Tidak perlu dijalankan.

---

## Alamat produksi (Vercel)

Repo ini masih tersambung ke Vercel dan deploy otomatis berjalan setiap push ke
`main`. Diukur ulang 20 Okt 2026 (setelah fitur akun dihapus):

| Yang diperiksa | Hasil |
|---|---|
| `https://pahami-sehat.vercel.app/app` | **200** — langsung Beranda, tanpa halaman masuk |
| `POST /api/tanya` di produksi | **200** dalam 6,86 detik, jawaban 1.023 karakter, **4 sumber** |
| `GET /api/berita/ringkas` di produksi | **200**, berisi berita |
| `GET /api/health` di produksi | **200**, `db: {"aktif":false}` (Vercel tanpa MariaDB) |
| `POST /api/suara` di produksi | **502** — fungsi serverless tidak bisa mempertahankan WebSocket |
| `GET /api/akun/saya` di produksi | **404** — rute akun sudah tidak ada |

Karena itu **mode Grand Final tetap memakai `npm start` di laptop sendiri**, bukan
alamat Vercel: hanya di situ suara neural bisa bekerja penuh.

Alamat Vercel juga masih muncul di kode QR halaman penjelasan
(`docs/prototipe/index.html`, bagian hero) — kalau alamat publik berubah, QR dan
tautannya perlu diperbarui.

---

## Hal yang tidak diklaim

Disebut di sini supaya tidak ada yang mengira lebih dari kenyataannya:

- Riwayat obrolan **belum** lintas perangkat; tidak ada akun, jadi tidak ada
  tempat menautkannya.
- Suara neural **tidak** bekerja di Vercel.
- Mode Inggris lengkap di antarmuka, tetapi teks instrumen kuesioner tetap
  bahasa Indonesia (dan itu disengaja).
- Angka akurasi OCR berasal dari tiga foto uji, bukan pengukuran besar.
- Belum ada uji otomatis untuk mesin OCR, pengenalan suara, pemutaran suara,
  dan papan klip — semuanya masih diuji manual. Tampilan mode Inggris **sudah**
  diuji otomatis: `uji-peramban.mjs` menjalankan 7 halaman × 2 bahasa.
- **Rute motor dan mobil sering identik.** Untuk jalan perkotaan tanpa larangan
  sepeda motor, Valhalla mengembalikan geometri yang sama untuk kedua moda dan
  hanya waktunya berbeda (§ [Petunjuk arah](#petunjuk-arah--osrm-dan-valhalla-masing-masing-pada-yang-benar-benar-didukungnya)).
  Yang benar-benar berbeda adalah jalan kaki.
- **Konteks percakapan hilang tanpa database.** Riwayat di peramban tetap utuh,
  tetapi pertanyaan lanjutan yang tidak menyebut topiknya ("terus gimana?")
  dijawab tanpa konteks ketika MariaDB tidak menyala. Ini perilaku yang sudah
  ada sedari awal, sekarang disebut juga di sini.
- **Pemakaian serentak dibatasi peramban, bukan server.** Diukur 5 Nov 2026:
  satu pengguna (satu pertanyaan pada satu waktu) mendapat jawaban dalam
  **6–21 detik**. Lima belas pertanyaan yang dibuka serentak memakan
  **43–132 detik** karena permintaan ke layanan model mengantre. Untuk pemakaian
  perorangan di laptop ini tidak terasa; untuk kelas atau presentasi paralel
  perlu satu server per penguji atau pertanyaan yang sudah disiapkan.

### Perbaikan 5 Nov 2026 — dan buktinya

Tiga hal diperbaiki hari itu, masing-masing dengan bukti yang bisa diulang:

| Perbaikan | Bukti |
|---|---|
| **Tingkat baca bawaan** `anak` → `dewasa` di server *dan* klien | `POST /api/tanya {"pertanyaan":"apa saja gejala stroke?"}` (tanpa `tingkat`) dulu menjawab `kunci:"anak"`, 578 karakter bergaya 9–11 tahun; sekarang `kunci:"dewasa"`, 872 karakter. Dijaga **`uji-tingkat.mjs`** (25 pemeriksaan) dan masuk CI |
| **0 kerentanan dependensi** (dari 6: 5 high + 1 moderate) | `body-parser` ^2.4.0, `qs` ^6.17.1, `follow-redirects` ^1.16.2, `axios` ^1.21.0 dipasang sebagai dependensi langsung karena `express@5.3.0` (versi terbaru) dan `msedge-tts@2.1.1` masih menarik versi rentan. `npm audit` sekarang: **`found 0 vulnerabilities`**. Suara neural **diuji ulang sungguhan**: 33.264 byte audio dalam 1,2 detik |
| **Pencatatan kegagalan model** | `/api/verifikasi` sekali menjawab `unparsed` tanpa meninggalkan jejak apa pun di log. Sekarang `mintaJson()` mencetak `jalur`, `finish_reason`, jumlah token, dan 160 karakter awal jawaban mentah — untuk **8 jalur** yang punya percobaan ulang. Tanpa pertanyaan pengguna |

Ditambah dua uji baru yang **mengunci dokumen**: `uji-tingkat.mjs` dan
`uji-dokumentasi.mjs` (menghitung uji, tangkapan layar, dan berkas server
langsung dari folder, lalu membandingkannya dengan angka di README). Keduanya
masuk CI. Sekalian, `uji-halaman-penjelasan.mjs` diperbaiki: ia menuntut
**tepat tiga** tangkapan layar padahal halaman sudah menampilkan **enam** dan
keenamnya termuat (1440×900) — yang salah adalah ujinya, bukan halamannya.

### Perbaikan 7 Nov 2026 — dan buktinya

| Perbaikan | Bukti |
|---|---|
| **Putusan Cek Klaim diperjelas** | Lencana menyebut subjeknya ("Klaim …"), tiap putusan diberi satu kalimat penjelas, dan daftar sumber tidak pernah kosong tanpa keterangan. `tidak_didukung` kini hanya dipakai bila sumber resmi menyatakan sebaliknya — klaim yang tidak dibahas sumber mana pun menjadi `tidak_bisa_dipastikan`. Terlihat pada tangkapan [Cek Klaim](#aplikasi--tujuh-menu) |
| **Sumber angka halaman penjelasan dilengkapi** | "Kelas 12,8" kini bersumber Ayre dkk. (2024); campak ditulis **73 kematian (69 sepanjang 2025 + 4 sampai minggu ke-7 2026)**; imunisasi menyebut selisih WHO 84,2% vs UNICEF/Kemenkes 84,5%; lansia dan remaja diberi rujukan. Rincian: `docs/verifikasi-klaim-tambahan.md` |
| **Luapan 17 px di layar 375 px** | Kartu sumber pada contoh Cek Klaim memuat domain panjang (`medlineplus.gov/autismspectrumdisorder.html`) tanpa `min-width:0`, sehingga grid melebar ke **392 px**. Ditambahkan `min-width:0` + `max-width:100%` pada `.src-card` dan `.src-body small`. Diuji `uji-peramban.mjs`: **105 lulus, 0 gagal** |

Uji pada hari itu: `npm test` **28 lulus, 0 gagal**; `uji-peramban.mjs` **105 lulus, 0 gagal**.

### Konten harian: sumbernya, dan setua apa isinya

**Diperbarui 1 Nov 2026 — sumbernya sudah berganti.** Sumber lama
(`ayosehat.kemkes.go.id`) ternyata **berhenti menerbitkan**: artikel termudanya
terbit 5 Mei 2026, sehingga kartu artikel dan lonceng pemberitahuan menampilkan
tanggal yang sama berbulan-bulan. Sekarang konten diambil dari **dua kanal**:

| Sumber | Alamat | Catatan |
|---|---|---|
| Kemenkes RI | `kemkes.go.id/id/category/rilis-berita` (2 halaman) | Siaran pers resmi. Tanggal dari `<time datetime>`, thumbnail dari `app_asset`. |
| CNN Indonesia | `cnnindonesia.com/gaya-hidup/kesehatan` | Berita kesehatan terkini. Tanggal dari cap waktu di URL, lalu dipastikan ulang dari JSON-LD halaman artikelnya. |

Setiap kartu menyebut **penerbitnya sendiri** (Kemenkes RI atau CNN Indonesia)
dan tanggal terbitnya. Kalau salah satu kanal mati, kanal lain tetap dipakai —
kegagalan satu sumber tidak mengosongkan halaman.

Diukur 1 Nov 2026: 41 artikel terbaca (12 + 12 dari dua halaman Kemenkes, 17
dari CNN), **semuanya bertanggal dan semuanya punya thumbnail**, terbitan
terbaru 1 Nov 2026.

#### Catatan sejarah: keadaan sebelum 1 Nov 2026

Diukur 25 Okt 2026 dari `itemprop="datePublished"` setiap halaman artikel di
halaman depan ayosehat.kemkes.go.id:

| Tanggal terbit | Umur saat diukur | Artikel |
|---|---|---|
| 05 May 2026 | 173 hari | Cara Membaca Label Gizi Pada Kemasan |
| 24 Jun 2025 | 488 hari | Diabetes Ancaman Nyata Generasi Muda |
| 13 Oct 2024 | 742 hari | Kesehatan Jiwa |
| 28 May 2024 | 880 hari | Rokok Membuat Hidup Jadi Redup |
| 22 May 2024 | 886 hari | Cegah Stunting · Pemeriksaan Penunjang Kardiovaskular |
| 16 May 2024 | 892 hari | Apa itu Malaria |
| 02 May 2024 | 906 hari | Cara Menjaga Kesehatan Jantung |
| 06 Apr 2024 | 932 hari | Gangguan Kesehatan Mental |
| 24 Nov 2023 | 1066 hari | Manfaat Ajaib Menyusui Bayi |
| *(tidak dicantumkan)* | — | Perangkat Ajar Kesehatan |

**Artikel termuda pun 173 hari.** Karena itu aplikasi ini tidak pernah mengaku
punya berita baru — yang dilakukannya adalah **menampilkan tanggal terbit
aslinya** di setiap kartu artikel, supaya pembaca bisa menilai sendiri.

Tiga cacat yang ditemukan dan diperbaiki 25 Okt 2026:

1. **Label "Diperbarui 12 Oktober 2026" menyesatkan.** Tanggal itu adalah kapan
   DAFTAR artikel dari sumber pertama kali berubah (sidik isi), bukan tanggal
   terbit apa pun. Sekarang labelnya berbunyi *"Artikel terbaru terbit 5 Mei
   2026 · Terakhir dicek 25 Oktober 2026 · konten ditarik 12 Oktober 2026"* —
   tiga hal berbeda, disebut berbeda.
2. **Tanggal terbit tidak pernah diambil.** `isiArtikel()` membuangnya, jadi
   urutan tampil tidak punya hubungan dengan kebaruan: artikel 2025 bisa berada
   di atas artikel 2026. Sekarang `bacaTanggalTerbit()` mengambilnya dari
   `itemprop="datePublished"` (tidak ada `<time>`, tidak ada
   `article:published_time` — itu satu-satunya penanda yang tersedia).
3. **Rotasi bisa mengangkat artikel 2023 ke depan.** Diukur: dengan 9 artikel,
   `geser` 6–8 menaruh artikel 2023 dan 2024 di baris pertama. Sekarang
   `susun()` mengurutkan menurut tanggal **lebih dulu**, lalu memutar hanya di
   dalam `JENDELA_ROTASI` (48 artikel terbaru). Diuji 60 putaran: artikel 2023
   tidak pernah tampil sama sekali.

**Batas yang diakui (diperbarui 1 Nov 2026):** aplikasi **tidak** menjamin
selalu ada artikel yang terbit hari itu — tergantung kanal sumbernya. Yang
dijamin: setiap kartu menyebut tanggal terbit aslinya, dan lonceng
pemberitahuan menyebut tanggal terbit artikel terbaru (bukan tanggal sistem
mengecek). Kanal yang dulu dicoba dan gagal — `/artikel`, `/rss` (200 tapi
`<item>` = 0), `/feed`, `kemkes.go.id/berita` (404),
`sehatnegeriku.kemkes.go.id/feed/`, `upk.kemkes.go.id/new/feed/` (403) —
**tidak** dipakai lagi; penggantinya `kemkes.go.id/id/category/rilis-berita`
yang diukur menjawab 200 pada 1 Nov 2026.

---

## Lisensi

MIT — lihat [`LICENSE`](LICENSE).
