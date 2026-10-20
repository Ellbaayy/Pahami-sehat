# Pahami Sehat

**"Informasi Kesehatan untuk Semua"**

Proyek untuk **LOGICODIX 2026 Hackathon** — subtema **Inclusive Health & Well-being**.
Masalah yang disasar: informasi kesehatan di Indonesia bukan langka, tapi sering tidak
sampai dan tidak dipahami oleh yang paling membutuhkan.

> Status: **MVP berjalan.** Fitur AI memanggil model sungguhan
> (`deepseek-v4-1-flash` lewat Kenari.id) dari server Express sendiri, dan
> setiap jawaban disertai sumber yang bisa dibuka pengguna.
>
> **Status tiap fitur — apa adanya (diperiksa ulang 20 Okt 2026):**
>
> | Fitur | Keadaan |
> |---|---|
> | Tanpa akun | **Tidak ada halaman masuk, tidak ada pendaftaran, tidak ada sesi.** Aplikasi langsung terbuka di Beranda; riwayat, kuesioner, dan setelan tinggal di `localStorage` peramban |
> | Tanya AI + sumber | berjalan. Pencarian memakai kata kunci terpilih, bukan kalimat pengguna apa adanya |
> | Sederhanakan teks | berjalan (4 tingkat baca), menjadi salah satu mode di komposer Tanya AI |
> | Cek klaim | berjalan (verdict + sumber) |
> | Suara dibacakan | **berjalan sebagai suara neural Microsoft — hanya di versi yang dijalankan di komputer sendiri.** Diukur ulang 20 Okt 2026: `POST /api/suara` menjawab `200 audio/mpeg`, berkas 24 kHz mono 48 kbps, 17.424 byte untuk satu kalimat, 0,80 detik. Di Vercel tetap **`502`** (diukur ulang 20 Okt 2026) karena fungsi serverless tidak bisa mempertahankan WebSocket — batas platform, bukan bug. Rincian: `app/server/suara.js` |
> | Input suara (bicara) | berjalan lewat Web Speech API bawaan peramban. **Butuh Chrome atau Edge**: Brave memblokir layanan suara daring Google, dan Firefox belum menyediakannya. Butuh konteks aman (`https://` atau `localhost`) |
> | Pindai foto / OCR | berjalan, **seluruhnya di peramban**. Foto tidak pernah dikirim ke server, dan fitur ini tetap jalan tanpa internet. Batasnya disebut apa adanya di aplikasi: alat bantu baca, bukan pengganti dokumen asli |
> | Riwayat obrolan | berjalan. Tersimpan di peramban (bukan server), maksimal **20 obrolan** (`MAKS_SESI` di `app/src/lib/sesi.js`). Bisa **dihapus satu per satu atau sekaligus**, dan penghapusan **bisa dibatalkan**. **Tidak lagi ditampilkan di Beranda** — hanya lewat menu **Riwayat** |
> | Berita kesehatan harian | berjalan. Pertanyaan seperti "berita terbaru hari ini" dijawab dari **RSS** (Detik Health, WHO, Google News) — bukan dari ensiklopedia, karena Wikipedia tidak punya berita harian. Setiap berita disebutkan **nama medianya** dan **umurnya**, dan lonceng pemberitahuan berbunyi kalau ada berita segar (diperiksa maksimal sekali sehari) |
> | Bahasa antarmuka | dua bahasa penuh: **Indonesia dan Inggris**, masing-masing **303 kunci** kamus |
>
> Catatan operasional: endpoint yang memanggil layanan berbayar dibatasi
> 20 permintaan/menit per alamat IP (`app/server/batas.js`, angka di `LAJU` pada
> `app/server/batasInput.js`). Pindai foto tidak masuk hitungan itu karena tidak
> menyentuh server sama sekali.

---

## Tampilan

Tangkapan layar di bawah diambil langsung dari aplikasi yang berjalan
(`npm run server`) — bukan gambar desain. Seluruh **21 berkas** di
[`docs/tangkapan-layar/`](docs/tangkapan-layar/) diambil ulang **20 Okt 2026**,
sesudah halaman login dihapus dan kartu privasi di Pengaturan dibuang, jadi yang
terlihat di README adalah tampilan yang benar-benar berlaku sekarang.

Dashboard diambil pada **1280×577** (laptop), ponsel **390×844** dengan DPR 2
(780×1688 piksel), dan mode kontras tinggi **1440×900**. Yang terlihat di bagian
**Produk** adalah mockup perangkat, dan itu memang ilustrasi di dalam halaman —
sisanya tampilan sungguhan.

### Aplikasi — dashboard

| Beranda | Tanya AI | Cek Klaim |
|---|---|---|
| ![Beranda](docs/tangkapan-layar/dashboard-1-beranda.png) | ![Tanya AI](docs/tangkapan-layar/dashboard-2-tanya-ai.png) | ![Cek Klaim](docs/tangkapan-layar/dashboard-3-cek-klaim.png) |

| Riwayat | Kuesioner | Pengaturan |
|---|---|---|
| ![Riwayat](docs/tangkapan-layar/dashboard-4-riwayat.png) | ![Kuesioner](docs/tangkapan-layar/dashboard-5-kuesioner.png) | ![Pengaturan](docs/tangkapan-layar/dashboard-6-pengaturan.png) |

**Tampilan di ponsel** — sidebar berubah jadi menu gulir:

| Beranda | Menu terbuka |
|---|---|
| ![Beranda di HP](docs/tangkapan-layar/dashboard-hp-1-beranda.png) | ![Menu HP](docs/tangkapan-layar/dashboard-hp-2-menu.png) |

**Mode kontras tinggi** — satu sakelar: teks jadi hitam penuh, huruf dasar
membesar 112%, garis dan batas fokus dipertebal:

![Mode kontras tinggi](docs/tangkapan-layar/dashboard-kontras-tinggi.png)

### Halaman penjelasan (prototype)

| Pembuka | Masalah & data | Konsep |
|---|---|---|
| ![Pembuka](docs/tangkapan-layar/prototype-1-hero.png) | ![Masalah](docs/tangkapan-layar/prototype-2-masalah.png) | ![Konsep](docs/tangkapan-layar/prototype-3-konsep.png) |

| Alur enam langkah | Lima fitur utama | Lanjutan fitur |
|---|---|---|
| ![Alur](docs/tangkapan-layar/prototype-4-alur.png) | ![Fitur](docs/tangkapan-layar/prototype-5-fitur.png) | ![Fitur lanjutan](docs/tangkapan-layar/prototype-6-fitur-lanjut.png) |

| Produk — mockup dasbor & ponsel | Kuesioner HLS-SF12 | Sumber & etika |
|---|---|---|
| ![Produk](docs/tangkapan-layar/prototype-7-produk.png) | ![Kuesioner](docs/tangkapan-layar/prototype-8-kuesioner.png) | ![Sumber](docs/tangkapan-layar/prototype-9-sumber.png) |

| Etika & keterbatasan | Prototype di ponsel | Bagian masalah di ponsel |
|---|---|---|
| ![Etika](docs/tangkapan-layar/prototype-10-etika.png) | ![Prototype HP](docs/tangkapan-layar/prototype-hp-1-hero.png) | ![Prototype HP masalah](docs/tangkapan-layar/prototype-hp-2-masalah.png) |

> Mockup perangkat di bagian **Produk** menampilkan **menu yang sama** dengan
> aplikasi sungguhan (Beranda, Tanya AI, Cek Klaim, Riwayat, Kuesioner,
> Pengaturan) — "Sederhanakan", "Suara", dan "Pindai Foto" tidak berdiri sendiri
> karena ketiganya sudah menjadi bagian dari Tanya AI (mode di komposer, tombol
> mikrofon, dan tombol kamera).

---

## Peta folder

| Folder / berkas | Peran |
|---|---|
| [`app/`](app) | **Produk utama.** Aplikasi dashboard (React + Vite + Express). Ini yang dijalankan saat video demo dan Grand Final. |
| [`docs/prototipe/`](docs/prototipe) | **Halaman penjelasan** (HTML/CSS/JS statis): latar belakang, konsep 4 Lapis Aksesibilitas, alur pemakaian, status tiap fitur. **Tampil sebagai halaman depan situs.** |
| [`docs/tangkapan-layar/`](docs/tangkapan-layar) | **21 tangkapan layar** dashboard & prototype, diambil dari aplikasi yang berjalan (lihat bagian [Tampilan](#tampilan)). |
| [`docs/skema-database.sql`](docs/skema-database.sql) | **Skema MariaDB bahan** — 6 tabel. Idempoten (semua `CREATE TABLE IF NOT EXISTS`), aman dijalankan ulang; sekaligus membersihkan tabel akun versi lama. |
| [`panen-pengetahuan.mjs`](panen-pengetahuan.mjs) | **Pengisi database pengetahuan** — mengambil teks asli dari sumber resmi (bukan karangan AI). Lihat [Di mana datanya disimpan](#di-mana-datanya-disimpan). |
| [`jalankan-online.sh`](jalankan-online.sh) | Build → server → Cloudflare Tunnel → cetak alamat publik. Lihat [Membuka aplikasi ke internet](#membuka-aplikasi-ke-internet-tapi-tetap-berjalan-di-laptop-sendiri). |
| [`uji-*.mjs`](.) | **15 berkas uji** — 14 di antaranya berjalan tanpa jaringan (total **560 pemeriksaan**, terukur 20 Okt 2026); `uji-jawaban.mjs` butuh server lokal + API key (lihat [Menjalankan uji](#menjalankan-uji)). |
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
pihak ketiga. Tiga angka yang belum ditemukan sumbernya **ditandai terbuka** di
halaman dengan label `perlu rujukan`, bukan dihapus diam-diam dan bukan
diklaim seolah ada sumbernya.

Verifikasi itu juga menemukan **dua kekeliruan** yang sudah dibetulkan:

| Dulu tertulis | Yang benar |
|---|---|
| Cakupan imunisasi "turun 95% → 80%" | 93,7% (2019) → 84,5% (2021). Angka 95% adalah **target** kekebalan kelompok, bukan capaian |
| Remaja 15–18 tahun "72% literasi rendah" | Dari responden yang berliterasi rendah, kelompok 15–18 tahun adalah **proporsi terbesar (72%)** — bukan 72% remaja berliterasi rendah |

Laporan lengkapnya ada di `docs/verifikasi-klaim-kesehatan.md`,
`docs/verifikasi-klaim-tambahan.md`, dan `docs/verifikasi-studi-literasi-kesehatan.md`.

### Alamat di situs

| Alamat | Isi |
|---|---|
| `/` | halaman penjelasan — yang muncul pertama kali dibuka |
| `/app/` | aplikasi yang bisa dipakai |
| `/prototipe/` | salinan halaman penjelasan (tautan lama tetap hidup) |
| `/api/...` | backend |

```
pahami-sehat/
├── .github/workflows/uji.yml  ← integrasi berkelanjutan (uji + build)
├── LICENSE                    ← MIT
├── README.md
├── jalankan-online.sh         ← build + server + Cloudflare Tunnel
├── siapkan-domain.sh          ← INERT: hanya untuk named tunnel (lihat catatan)
├── uji-*.mjs                  ← 15 berkas uji (14 tanpa jaringan)
├── ukur-*.mjs                 ← pengukuran untuk memilih angka batas
├── verifikasi-judul.mjs
├── periksa-istilah.mjs
├── panen-pengetahuan.mjs
├── mermaid-diagram.png
├── app/                       ← PRODUK UTAMA (React + Express + Tailwind)
│   ├── .env                   ← API key Kenari (JANGAN di-commit, mode 600)
│   ├── .env.example
│   ├── public/ocr/            ← mesin OCR: worker, core WASM, data bahasa (17 MB)
│   ├── scripts/               ← salin-prototipe.mjs (prebuild)
│   ├── server/                ← backend Express (19 berkas)
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
    ├── tangkapan-layar/       ← 21 tangkapan layar
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
  subgraph Peramban["Peramban — React 19 + Vite 8 + Tailwind 4"]
    UI["Antarmuka<br/>Beranda · Tanya AI · Cek Klaim · Riwayat · Kuesioner · Pengaturan"]
    OCR["Mesin OCR<br/>tesseract.js / WebAssembly"]
    LS[("localStorage<br/>sesi · kuesioner · setelan")]
  end

  subgraph Server["Express 5 — lokal; Vercel Serverless saat produksi"]
    B["Pembatas laju<br/>20 permintaan/menit per IP + batas total per instance"]
    R["Rute /api/*"]
    DBJ["app/server/db.js<br/>jembatan database — OPSIONAL untuk bahan<br/>gagal = null, tidak pernah melempar"]
  end

  subgraph Simpanan["MariaDB (XAMPP) — di laptop sendiri"]
    T1[("berita")]
    T2[("konten")]
    T3[("pengetahuan<br/>salinan berlabel tanggal")]
    T4[("sumber")]
    T6[("dokumen · sitasi<br/>jejak sumber yang dikutip")]
  end

  subgraph Luar["Layanan luar"]
    K["Kenari.id<br/>deepseek-v4-1-flash"]
    W["Wikipedia bahasa Indonesia"]
    M["MedlinePlus<br/>wsearch.nlm.nih.gov"]
    N["RSS berita kesehatan<br/>Detik Health · WHO · Google News"]
    MS["Microsoft Edge TTS<br/>suara neural via WebSocket"]
  end

  UI --> B --> R
  UI <--> LS
  UI --> OCR
  OCR -.->|"tidak pernah keluar<br/>dari perangkat"| OCR

  R -->|"kata kunci terpilih"| W
  R -->|"istilah Inggris"| M
  R -->|"pertanyaan berita"| N
  R -->|"sumber + pertanyaan"| K
  R -->|"teks"| MS
  MS -->|"audio MP3"| R
  K -->|"jawaban + sumber yang dikutip"| R
  R -->|"jawaban"| UI

  R --> DBJ
  DBJ --> T1
  DBJ --> T2
  DBJ --> T3
  DBJ --> T4
  DBJ --> T6

  classDef store fill:#eef,stroke:#446,color:#113
  classDef opsional fill:#ffe9c9,stroke:#a63,color:#420,stroke-dasharray:4 3
  class LS store
  class T1,T2,T3,T4,T6 store
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

**Tidak ada data pengguna yang tersimpan di server.** Riwayat obrolan,
jawaban kuesioner, dan setelan tinggal di `localStorage` peramban. Karena itu
aplikasi sekarang bisa dipakai tanpa MariaDB sama sekali — database hanya
menyimpan bahan (lihat bagian berikut).

### Di mana datanya disimpan

| Data | Tempat | Bertahan setelah halaman ditutup? |
|---|---|---|
| Sesi obrolan | `localStorage` (`pahami-sehat:sesi`) | ya, sampai dihapus pengguna (maks. 20 obrolan) |
| Jawaban kuesioner | `localStorage` | ya |
| Setelan bahasa / tingkat baca / kontras / suara | `localStorage` (`pahami-sehat:setelan`) | ya |
| Foto yang dipindai | **tidak disimpan ke mana pun** — dibaca di memori peramban | tidak |
| Pertanyaan & jawaban pengguna | **tidak disimpan di server** — tidak ada tabel percakapan di jalur aplikasi | tidak |
| Akun | **tidak ada** — tidak ada tabel akun, sesi, atau cookie | — |

**Riwayat hanya ada di perangkat ini.** Tidak ada sinkronisasi lintas
perangkat, dan itu bukan kekurangan yang disembunyikan: tanpa akun, memang
tidak ada tempat menautkan riwayat ke seseorang. Menghapus riwayat di satu
peramban tidak memengaruhi peramban lain, karena keduanya tidak pernah
terhubung.

**Database bahan bersifat OPSIONAL, dan itu dijaga di kode.** MariaDB (lewat
XAMPP) dipakai untuk menyimpan **bahan**, bukan percakapan pengguna. Kalau
MariaDB mati, bahan tetap tersaji memakai berkas cache — `app/server/db.js`
mengembalikan `null` alih-alih melempar galat.

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
| `konten` | artikel & tips harian dari Kemenkes | `.cache-konten.json` |
| `pengetahuan` | **331 topik medis** dari sumber resmi, salinan berlabel tanggal | (baru) |
| `sumber` | lembaga resmi (Kemenkes, WHO, BPOM, NIH, CDC, …) — **12 baris di skema**, bertambah saat panen | (baru) |
| `dokumen` + `sitasi` | **jejak sumber yang dikutip** — klaim "jawaban ini dari WHO" jadi bisa **dilacak**, bukan cuma ditulis | (baru) |

Tidak ada tabel akun di skema mana pun. `skema-database.sql` malah
menjalankan `DROP TABLE IF EXISTS riwayat, setelan, pengguna` untuk
membersihkan sisa pemasangan lama — jadi tidak ada tabel identitas yang bisa
terisi lagi tanpa sengaja.

Isi database pada 20 Okt 2026 (hitungan langsung lewat `COUNT(*)`, bukan
perkiraan `table_rows`): `pengetahuan` **331** baris (270 dari MedlinePlus,
61 dari Wikipedia) · `sumber` **19** baris · `dokumen` **88** ·
`sitasi` **351** · `berita` 3 · `konten` 7.

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
- **Pertanyaan pengguna tidak ikut disimpan** — endpoint `/api/sitasi` sengaja
  hanya menampilkan sumber mana dipakai untuk jenis jawaban apa, kapan.

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

## Endpoint

| Metode | Path | Isi |
|---|---|---|
| GET | `/api/health` | status server, key & model, status database |
| GET | `/api/meta` | tingkat baca + model aktif + daftar suara |
| GET | `/api/konten` | topik populer, artikel, tips harian |
| GET | `/api/berita/ringkas` | ringkasan berita untuk lonceng |
| GET | `/api/db` | hitungan + contoh baris (bukan seluruh isi tabel) |
| GET | `/api/sitasi` | sumber mana dipakai untuk jenis jawaban apa |
| POST | `/api/tanya` | jawab pertanyaan, sesuaikan tingkat baca |
| POST | `/api/tanya/stream` | sama, tapi streaming (SSE) |
| POST | `/api/sederhanakan` | terjemahkan teks medis |
| POST | `/api/verifikasi` | periksa klaim kesehatan |
| POST | `/api/suara` | teks → MP3 (suara neural) |

Galat selalu berbentuk `{ ok: false, code, pesan }` — `code` sengaja dipakai UI
untuk memilih pesan yang tepat (`db_mati`, `insufficient_balance`, dan
`input_kosong` ditampilkan berbeda, bukan satu kotak merah yang sama).

### Lima hal yang dijaga di sisi server

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

### Jawaban kosong tidak boleh terjadi — dan cara membuktikannya

Diukur 15 Okt 2026: dua fitur pernah menjawab **KOSONG** — "berikan aku berita
terkini" dan Sederhanakan untuk teks medis panjang. Penyebabnya bukan prompt,
melainkan **jatah token**: model `deepseek-v4-1-flash` adalah model *reasoning*,
dan token `reasoning_content` yang ia hasilkan **ikut memakan `max_tokens`**.
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

## Menjalankan aplikasi (produk utama)

Aplikasi punya dua bagian: frontend React dan backend Express yang memanggil model AI.

```bash
cd app
npm install --include=dev    # --include=dev WAJIB bila NODE_ENV=production

# 1) siapkan API key sekali saja
cp .env.example .env         # lalu isi KENARI_API_KEY=kn-...
chmod 600 .env

# 2) mode pengembangan (dua terminal)
npm run server               # backend  di http://127.0.0.1:8787
npm run dev                  # frontend Vite (otomatis meneruskan /api ke backend)

# 3) mode Grand Final — satu perintah, satu port
npm start                    # build + server di http://127.0.0.1:8787
```

`npm run build` juga menjalankan `prebuild` → `scripts/salin-prototipe.mjs`,
yang menyalin `docs/prototipe/` menjadi `dist/index.html` + `dist/prototipe/`.
Jadi **mengubah halaman penjelasan wajib lewat build** sebelum diuji.

> Hasil build memakai ES module, jadi membuka `dist/index.html` lewat `file://`
> **tidak akan jalan**. Harus disajikan lewat HTTP — `npm start` sudah begitu.

> Tanpa API key, server tidak mau start dan akan memberi pesan jelas soal `.env`.

### Database

**Opsional.** Database hanya menyimpan bahan (berita, konten, pengetahuan,
sitasi). Aplikasi tetap bisa dipakai penuh tanpa MariaDB — tidak ada akun yang
butuh database lagi.

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

**Untuk Grand Final:** `npm start` adalah yang dipakai saat presentasi — Express
menyajikan hasil build sekaligus melayani `/api`, jadi cukup satu alamat.

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

Semua uji di bawah ini berjalan tanpa jaringan dan tanpa API key, kecuali yang
ditandai. Jalankan dari akar repo:

```bash
node uji-batas.mjs        # 33 pemeriksaan: batas panjang & laju tiap rute
node uji-ekstrak.mjs      # 8  pemeriksaan: penarikan konten dari HTML sumber
node uji-kata-kunci.mjs   # 33 pemeriksaan: pencocokan kata kunci topik
node uji-teks.mjs         # 16 pemeriksaan: perapian teks & pemotongan kalimat
node uji-ocr.mjs          # 36 pemeriksaan: perapian teks & penandaan angka
node uji-bahasa.mjs       # 25 pemeriksaan: kesehatan kamus id/en
node uji-berita.mjs       # 102 pemeriksaan: deteksi berita, parser RSS, penetrasi
node uji-jam.mjs          # 17 pemeriksaan: jam acuan dari header internet
node uji-rotasi.mjs       # 22 pemeriksaan: rotasi daftar konten harian
node uji-keterbacaan.mjs  # 38 pemeriksaan: alat ukur keterbacaan itu sendiri
node uji-sumber.mjs       # 99 pemeriksaan: lapis sumber (tanpa jaringan)
node uji-suara.mjs        # 90 pemeriksaan: ejaan singkatan & kestabilan nada
node uji-sitasi.mjs       # 15 pemeriksaan: jejak sumber (butuh MariaDB)
node uji-server.mjs       # 26 pemeriksaan: kompresi, 404 JSON, galat klien
```

**Total 560 pemeriksaan, semuanya lulus** — diukur 20 Okt 2026, setelah
`uji-akun.mjs` dan `uji-google.mjs` ikut dihapus bersama fitur akun. Angka per
berkas di atas dihitung dari keluaran uji itu sendiri, bukan dari ingatan;
kalau uji bertambah, hitung ulang.

Dua skrip di bawah **butuh jaringan** dan hanya dipakai untuk memilih angka
batas dari pengukuran, bukan untuk rutin:

```bash
node ukur-konten.mjs      # berapa permintaan jaringan saat cache konten kosong
node ukur-suara.mjs       # berapa lama TTS benar-benar butuh (ini asal MAKS_SUARA)
node ukur-pengetahuan.mjs # 86 pertanyaan lintas bidang -> berapa dapat sumber
node ukur-tingkat.mjs     # 8 pertanyaan x 4 tingkat (butuh server lokal + key)
node verifikasi-judul.mjs # buktikan setiap judul artikel Wikipedia benar-benar ADA
node periksa-istilah.mjs  # periksa calon istilah baru sebelum masuk peta
node uji-jawaban.mjs      # tembak /api/tanya server lokal, baca JAWABANNYA
```

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

`uji-sumber.mjs` juga berjalan tanpa jaringan (99 pemeriksaan). Versi
`--jaringan` menambahkan pemeriksaan bahwa setiap judul artikel Wikipedia yang
dipetakan benar-benar ada.

### Integrasi berkelanjutan

`.github/workflows/uji.yml` menjalankan seluruh uji di atas ditambah
`node --check` dan `npm run build` pada setiap push dan pull request ke `main`.
Diukur 20 Okt 2026 lewat `gh run view <id> --json jobs --jq '.jobs[].steps[]'`:
**23 langkah** (termasuk `Set up job`, dua `Post …`, dan `Complete job`), dan
semuanya `success` pada commit `8ada582`. Sebelum fitur akun dihapus angkanya
25 — dua langkah `uji-akun.mjs` dan `uji-google.mjs` ikut hilang.

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
diuji manual di `/app/`: mesin OCR, pengenalan suara, pemutaran suara, papan
klip, dan tampilan mode Inggris.

---

## Kuesioner HLS-SF12

12 item asli, satu pertanyaan per layar, diambil dari paper validasinya (Duong
et al., 2019) beserta terjemahan Indonesia yang tervalidasi — rinciannya di
`docs/sumber-hls-sf12.txt`. Kalimatnya sengaja **tidak** diterjemahkan ke
Inggris: menerjemahkan ulang membuat skornya tidak bisa dibandingkan dengan
rujukan.

Skor: tiap jawaban bernilai 0–3 (sangat sulit = 0 … sangat mudah = 3), jadi
maksimum = 12 × 3 = 36. Persentase = `total / 36`, lalu tiga kategori:
**≥ 70% Baik** · **≥ 45% Sedang** · **< 45% Perlu dukungan** — masing-masing
dengan saran tindak lanjut. Seluruh perhitungan jalan di peramban; tidak ada
jawaban yang dikirim ke mana pun.

Aplikasi menyebut hasilnya apa adanya: *"Hasil ini alat bantu belajar, bukan
diagnosis medis."*

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
| Rotasi daftar konten | `app/server/konten.js` (`susun()`, `geser`) | urutan bergeser supaya artikel yang tampil tidak itu-itu saja |
| Batas pengambilan artikel | `app/server/konten.js` (`MAKS_DETAIL`) | 8, dari yang tadinya bisa sampai 40 |
| Pembatas laju per IP | `app/server/batasInput.js` (`LAJU`) | 20 permintaan/menit (health/meta/berita 120) |
| Simpanan hasil health | `batasInput.js` (`SIMPANAN_HEALTH_MS`) | 15 detik |
| Kompresi gzip respons | `app/server/saji.js` | `/api/konten` 6.370 → 1.959 byte (**−69%**) |
| Jam acuan tanpa permintaan tambahan | `app/server/jam.js` | memakai header `Date` respons yang sudah ada |
| Cache aset ber-hash | `app/vercel.json` | 1 tahun, `immutable` |
| Cache berkas ber-nama-tetap | `app/vercel.json` (`/app/ocr/`) | 1 hari + `stale-while-revalidate` |
| Pemindaian foto | `app/src/lib/ocr.js` | 0 permintaan server |

**Yang belum selesai, disebut apa adanya:**

- Pembatas laju disimpan di **memori proses**, jadi di lingkungan serverless
  batasnya berlaku **per-instance, bukan global**. Untuk batas yang benar-benar
  global diperlukan penyimpanan bersama (mis. Redis/Upstash) — belum dipasang.
- Aplikasi ini **belum mengukur emisi karbonnya sendiri**, jadi tidak ada angka
  jejak karbon yang diklaim di mana pun.
- Belum ada halaman kebijakan privasi tersendiri dan alamat kontak resmi untuk
  permintaan penghapusan data.

### Kepatuhan UU PDP No. 27/2022 dalam praktik

| Prinsip | Keadaan |
|---|---|
| Minimalisasi data | Yang diambil hanya teks pertanyaan. Tidak ada nama lengkap, NIK, alamat, email, atau kata sandi yang diminta — tidak ada formulir yang memintanya. |
| Kendali di tangan subjek data | Riwayat dan jawaban kuesioner disimpan di perangkat pengguna dan bisa dihapus pengguna kapan saja. |
| Keterbukaan | Perpindahan data dijelaskan sebelum pengguna memakainya (panel Pengaturan), bukan disembunyikan. |
| Hak penghapusan | Terpenuhi secara teknis (tombol hapus riwayat), **belum** terpenuhi secara prosedural (belum ada kanal kontak resmi). |

---

## Konteks lomba (LOGICODIX 2026)

Indikator penilaian: Problem-Solution Fit 25% · Technology Innovation 25% ·
Software Engineering 25% · UI/UX 15% · Green IT & Ethics 10%.

Tenggat: Hacking Week 7–14 November 2026 · **Last Submission 14 November 2026** ·
Pengumuman finalis 21 November 2026 · Puncak acara 29 November 2026.

Ketentuan yang mengikat: karya MVP berbasis Web/Mobile, source code di repo GitHub,
video demo 3–5 menit **tanpa narasi peserta**, dan aplikasi harus bisa dijalankan
di localhost saat Grand Final.

Tim: **NØCTURNE**.

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
  papan klip, dan tampilan mode Inggris — semuanya masih diuji manual.

---

## Lisensi

MIT — lihat [`LICENSE`](LICENSE).
