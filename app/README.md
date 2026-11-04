# Pahami Sehat — Aplikasi (Produk Utama)

> **Ini produk utama** yang dijalankan saat Grand Final dan video demo.
> Sumber halaman penjelasan ada di [`../docs/prototipe`](../docs/prototipe).
> Dokumen ini menjelaskan isi folder `app/`; gambaran proyek ada di
> [`../README.md`](../README.md).

Dashboard edukasi kesehatan **Pahami Sehat** — React di depan, Express di belakang,
model AI **`deepseek-v4-1-flash`** lewat **Kenari.id**.

## Stack

| Lapisan | Isi |
|---|---|
| Frontend | React 19 + Vite 8, Tailwind CSS 4 (`@tailwindcss/vite`), Lucide React |
| Peta | **Leaflet 1.9** + `leaflet.markercluster` 1.5 — ubin OpenStreetMap |
| Backend | Node + Express 5 (`express`, `mysql2`, `msedge-tts`, `tesseract.js`) |
| Model | Kenari.id, [OI]-compatible, default `deepseek-v4-1-flash` |
| Database | MariaDB lewat XAMPP — **opsional**: bahan (berita, konten, pengetahuan) dan fasilitas kesehatan yang sudah pernah diambil |

## Alamat saat disajikan

| Alamat | Isi |
|---|---|
| `/` | **halaman penjelasan** (yang muncul pertama kali) |
| `/app/` | **aplikasi** — dashboard AI yang bisa dipakai |
| `/prototipe/` | salinan halaman penjelasan (tautan lama tetap hidup) |
| `/api/...` | backend |

`npm run build` menaruh aplikasi di `dist/app/` dan halaman penjelasan di
`dist/index.html` (lewat `scripts/salin-prototipe.mjs`, dijalankan `prebuild`),
jadi root situs menampilkan penjelasan lebih dulu.

## Menjalankan

```bash
npm install --include=dev   # --include=dev WAJIB bila NODE_ENV=production

# 1) salin env lalu isi API key Kenari
cp .env.example .env        # lalu isi KENARI_API_KEY=kn-...
chmod 600 .env              # key jangan sampai terbaca user lain

# 2) mode pengembangan — dua terminal
npm run server              # backend  : http://127.0.0.1:8787
npm run dev                 # frontend : Vite, /api diteruskan ke backend

# 3) mode Grand Final — satu perintah, satu port
npm start                   # build + jalankan server di http://127.0.0.1:8787
```

`npm start` adalah cara yang dipakai saat presentasi: Express menyajikan hasil
build dari `dist/` sekaligus melayani `/api`, jadi cukup satu alamat.

> **Catatan:** hasil build memakai ES module. Membuka `dist/index.html` langsung
> lewat `file://` **tidak akan jalan** (diblokir peramban) — harus disajikan lewat
> HTTP, dan `npm start` sudah melakukan itu.

## Database

Database **opsional**. Aplikasi tidak punya akun, jadi tidak ada gerbang masuk
yang bergantung pada MariaDB. Yang disimpan di database: bahan (konten, berita,
pengetahuan, sitasi) **dan** fasilitas kesehatan yang sudah pernah diambil —
tanpa database bahan tetap tersaji lewat berkas cache, dan fasilitas diambil
langsung dari OpenStreetMap seperti sebelumnya.

```bash
sudo /opt/lampp/lampp startmysql
/opt/lampp/bin/mysql -u root < ../docs/skema-database.sql
```

Bawaan `server/db.js` sudah cocok untuk XAMPP (`127.0.0.1:3306`, `root` tanpa
sandi, basis data `pahami_sehat`). Ubah lewat `.env`: `DB_HOST`, `DB_PORT`,
`DB_USER`, `DB_PASSWORD`, `DB_NAMA`. `DB_MATI=1` mematikan database sepenuhnya —
dipakai untuk membuktikan bahan tetap tersaji tanpa database.

**Sudah diverifikasi pada XAMPP sungguhan (4 Nov 2026):** MariaDB 10.4.32 di
`/opt/lampp`, 10 tabel terbentuk, `/api/health` melaporkan `db.aktif: true`, dan
`uji-faskes-db.mjs` **12/12 lulus**. Kalau MySQL mati, `keteranganDb()`
menyebutkan sebabnya (`ECONNREFUSED — …`), bukan sekadar "tidak tersambung".

Tiga tabel dipakai fitur Fasilitas Kesehatan Terdekat: `wilayah`,
`kategori_fasilitas`, `fasilitas` (dengan `sumber`, `sumber_url`,
`diperbarui_pada`, `kedaluwarsa_pada`). Baris yang sudah kedaluwarsa **tidak**
disajikan. Permintaan dari MySQL **6,8 ms**, dari Overpass **40–50 detik**.

### Port 8787

`npm run server` menjalankan `preserver` lebih dulu
(`scripts/bebaskan-port.mjs`). Kalau port dipegang server lama **proyek ini
sendiri** (dicocokkan lewat cmdline + cwd), port dibebaskan otomatis; kalau
dipegang proses lain, skripnya **menolak** dan menyebut PID-nya beserta
alternatifnya — tidak membunuh proses asing. Sebelum ini, `npm run server` bisa
gagal diam-diam karena server uji yang tertinggal.

## Struktur

```
app/
├── .env                      API key (JANGAN di-commit, mode 600)
├── .env.example              contoh isi env + penjelasan tiap variabel
├── api/index.js              pintu masuk serverless Vercel
├── public/ocr/               mesin OCR: worker, core WASM, data bahasa (17 MB)
├── scripts/
│   ├── salin-prototipe.mjs   menyalin docs/prototipe -> dist/ (prebuild)
│   ├── mampatkan-dist.mjs    gzip hasil build
│   └── bebaskan-port.mjs     pre-flight port 8787 (dipanggil `preserver`)
├── server/                   backend Express — 24 berkas
│   ├── index.js              rute + penyajian hasil build + penanganan EADDRINUSE
│   ├── config.js             baca env, validasi key
│   ├── rute.js               endpoint /api/* (termasuk wilayah, faskes, rute)
│   ├── kenari.js             klien Kenari.id (chat + streaming SSE)
│   ├── prompts.js            rubrik wajib + prompt per fitur
│   ├── kataKunci.js          pengenalan topik + PETA_PENCARIAN/PETA_MEDLINEPLUS
│   ├── cari.js               pencarian Wikipedia + MedlinePlus
│   ├── berita.js             jalur RSS berita kesehatan
│   ├── konten.js             topik/artikel/tips harian + rotasi daftar
│   ├── suara.js              TTS neural (msedge-tts)
│   ├── jam.js                jam acuan dari header Date
│   ├── db.js                 jembatan MariaDB (gagal = null + alasanGagal)
│   ├── faskes.js             Overpass multi-cermin: kategori, dedupe, simpanan
│   ├── faskesDb.js           simpan/baca fasilitas di MySQL
│   ├── wilayah.js            kode wilayah bertingkat + titik referensi
│   ├── rute-perjalanan.js    klien Valhalla: costing per moda, polyline6
│   ├── rsSirs.js             rumah sakit resmi SIRS: cari, filter, ringkasan
│   ├── geocoding.js          deteksi wilayah dari `address` Nominatim + peta ISO
│   ├── layanan.js            SEMUA endpoint luar + antrean + simpanan (mudah diganti via env)
│   ├── photon.js             klien Photon: autocomplete, saring negara, simpanan 10 menit
│   ├── ruteAlamat.js         endpoint /api/alamat dan /api/wilayah/lengkap
│   ├── batas.js              pembatas laju
│   ├── batasInput.js         MAKS_TOKEN + LAJU per jalur
│   ├── saji.js               gzip + X-Waktu-Ms + 404 JSON
│   ├── kepala.js             kepala keamanan dasar
│   ├── ekstrak.js            ambil field "jawaban" dari JSON yang mengalir
│   ├── bahasa.js             pilihan bahasa jawaban
│   ├── klaim.js              penyaring klaim prognosis
│   └── teks.js               perapian teks
└── src/                      frontend React
    ├── App.jsx               state global + routing antar panel
    ├── components/LoadingPage.jsx
    ├── lib/api.js            klien API (termasuk pembaca SSE)
    ├── lib/sesi.js           bentuk sesi + localStorage (MAKS_SESI = 20)
    ├── lib/useBahasa.js      kamus id/en
    ├── lib/useServer.js      hook status server
    ├── lib/useBerita.js      ringkasan berita untuk lonceng
    ├── lib/useSuara.js       pemutaran audio
    ├── lib/useFaskes.js      ambil fasilitas + filter kategori
    ├── lib/useCariLokasi.js  pencarian tempat (Nominatim)
    ├── lib/useWilayah.js     dropdown bertingkat 4 tingkat
    ├── lib/useRute.js        hitung rute per moda
    ├── lib/istilahLayanan.js terjemahan istilah layanan OSM -> Indonesia
    ├── lib/tts.js            pemutar audio (variabel modul)
    ├── lib/ocr.js            tesseract.js + angka mutu pembacaan
    ├── lib/keterbacaan.js    alat ukur keterbacaan + SASARAN
    ├── lib/skorHls.js        indeks HLS-SF12 (0–50)
    ├── data/bahasa.js        kamus id + en (437 kunci masing-masing)
    ├── data/tingkat.js       daftar tingkat baca (satu sumber kebenaran)
    ├── data/dummy.js         konten statis
    ├── components/layout/    Sidebar, TopBar, MobileDrawer, nav (7 menu)
    ├── components/ui/        Card, Button, SourcePills, PoinKunci, Peringatan
    ├── components/faskes/    FaskesPanel, RsNasionalPanel, InputLokasi, PemilihTitik,
    │                         PemilihWilayah,
    │                         PanelNavigasi, kategoriWarna
    └── components/dashboard/ panel tiap halaman
```

**Navigasi (7 menu):** Beranda, Tanya AI, Cek Klaim, Fasilitas Kesehatan
Terdekat, Riwayat, Kuesioner, Pengaturan. "Sederhanakan", "Suara", dan "Pindai
Foto" tidak berdiri sendiri karena ketiganya bagian dari Tanya AI.

## Endpoint

| Metode | Path | Isi |
|---|---|---|
| GET | `/api/health` | status server + key & model + status database |
| GET | `/api/meta` | daftar tingkat baca + model aktif + daftar suara |
| GET | `/api/konten` | topik, artikel, tips harian |
| GET | `/api/berita/ringkas` | ringkasan berita untuk lonceng |
| GET | `/api/db` | hitungan + contoh baris |
| GET | `/api/sitasi` | jejak sumber yang dikutip |
| GET | `/api/wilayah` | wilayah administratif bertingkat (`tingkat=provinsi\|kabupaten\|kecamatan\|desa`, `induk=<kode>`) |
| GET | `/api/wilayah/titik` | titik referensi satu wilayah + tingkat ketelitiannya |
| GET | `/api/faskes` | fasilitas kesehatan di sekitar satu titik (`lat`, `lon`, `radius`) |
| GET | `/api/faskes/kategori` | sepuluh kategori fasilitas yang dipakai antarmuka |
| GET | `/api/faskes/cari-lokasi` | cari tempat menurut nama (Nominatim) |
| GET | `/api/rute` | rute perjalanan (`moda=jalan-kaki\|motor\|mobil`, `bahasa=id\|en`) |
| GET | `/api/rs` | rumah sakit resmi SIRS: `cari`, `provinsi`, `kabupaten`, `jenis`, `kelas`, `kepemilikan`, `halaman`, `perHalaman` |
| GET | `/api/rs/filter` | pilihan filter dari isi database |
| GET | `/api/rs/ringkasan` | jumlah, berkoordinat, sinkron terakhir |
| GET | `/api/rs/:kode` | rincian satu RS menurut kode SIRS |
| GET | `/api/alamat/cari` | autocomplete alamat — Photon, cadangan Nominatim (`q`); `sumberCari` menyebut yang menjawab |
| GET | `/api/alamat/titik` | geocoding balik (`lat`, `lon`) |
| GET | `/api/wilayah/lengkap` | provinsi + kabupaten + kecamatan |
| POST | `/api/tanya` | jawab pertanyaan, sesuaikan tingkat baca |
| POST | `/api/tanya/stream` | sama, tapi streaming (SSE) |
| POST | `/api/sederhanakan` | terjemahkan teks medis |
| POST | `/api/verifikasi` | periksa klaim kesehatan |
| POST | `/api/suara` | teks → MP3 (suara neural) |

Error selalu berbentuk `{ ok: false, code, pesan }` — `code` sengaja dipakai UI untuk
memilih pesan yang tepat (`db_mati` ditampilkan sebagai "butuh database",
`insufficient_balance` sebagai peringatan saldo, bukan error merah).

Kode galat fitur fasilitas yang punya arti berbeda di antarmuka:
`koordinat_kosong` (400), `koordinat_tidak_sah` (400), `sumber_gagal` (503 —
"coba lagi", **bukan** "tidak ada fasilitas"). `/api/faskes` mengirim
`Cache-Control: public, max-age=120, stale-while-revalidate=600`.

## Rubric prompting (pembeda teknis)

Setiap panggilan model memuat rubrik wajib yang sama, di `server/prompts.js`:

1. **Kelengkapan** — semua poin kunci, angka, dan peringatan wajib dipertahankan.
2. **Akurasi** — tidak menambah fakta yang tidak ada di sumber.
3. **Keterbacaan** — gaya bahasa mengikuti tingkat pembaca.
4. **Sitasi** — dilarang mengarang judul/nomor/tautan; kalau tidak yakin, `sumber: []`.
5. **Batas peran** — bukan dokter, tidak memberi diagnosis atau dosis.

Poin kunci dikembalikan sebagai `poinKunci[]` dan ditampilkan di UI lewat komponen
`PoinKunci` — jadi kelengkapan informasi bisa **dilihat**, bukan cuma diklaim.

## Tingkat baca

| Tingkat | Umur | Patokan kata/kalimat |
|---|---|---|
| Anak-anak | 9–11 tahun | 7 |
| Remaja | 12–25 tahun | 9 |
| Dewasa | 26–59 tahun | 12 |
| Lansia | 60 tahun ke atas | 8 |

Patokannya **umur pembaca**, bukan kelas sekolah. Lansia sengaja lebih sederhana
dari Dewasa karena anak 9 tahun dan lansia 80 tahun sama-sama butuh bahasa
sederhana. Angka di `SASARAN` (`src/lib/keterbacaan.js`) adalah hasil kalibrasi
pengukuran nyata, bukan angka baku.

## Fasilitas Kesehatan Terdekat

Menu ketujuh. Penjelasan lengkap ada di [`../README.md`](../README.md); yang
perlu diketahui saat mengubah kode:

- **Lokasi bukan hanya GPS.** Urutan utamanya pemilihan wilayah bertingkat
  (Provinsi → Kota/Kabupaten → Kecamatan → Desa/Kelurahan) lewat `useWilayah`.
  GPS tetap ada sebagai alternatif. Aplikasi **tidak pernah** mengisi lokasi
  pengguna dengan koordinat tetap.
- **Peta**: Leaflet + OpenStreetMap, `leaflet.markercluster` untuk penanda
  banyak, warna per kategori di `components/faskes/kategoriWarna.js`.
- **Petunjuk arah** memakai Valhalla (`server/rute-perjalanan.js`), bukan OSRM
  demo — semua profil OSRM demo mengembalikan rute yang sama, jadi tombol moda
  akan jadi hiasan. Mengganti moda **menghitung ulang** rute.
- **Data fasilitas** dari Overpass (multi-cermin), disimpan ke MySQL lewat
  `faskesDb.js`. Tanpa MySQL tetap jalan, langsung dari Overpass.
- **Kejujuran sumber**: kolom kosong ditulis "Tidak tercatat"; kalau sumber
  gagal, tampil `sumber_gagal` + tombol coba lagi, bukan daftar kosong. Tiga
  jebakan "kosong" (`remark` Overpass, simpanan hasil kosong, satu cermin yang
  mengaku kosong) dijelaskan di README akar repo.
- **Batas yang disebut di antarmuka**: muat pertama 40–50 detik, estimasi waktu
  bukan lalu lintas langsung, dan wilayah administratif bukan posisi presisi.

## Catatan responsive

- `<768px`  : top header + navigation drawer, konten satu kolom
- `768–1023`: sidebar rail icon-only
- `≥1024`   : sidebar penuh
- Grid artikel & panel memakai `auto-fit + minmax`, jadi jumlah kolom
  mengikuti ruang yang tersedia, bukan breakpoint kaku
- Tipografi, padding, dan gap memakai `clamp()`
- Konten dibatasi `max-width: 86rem` agar tidak melebar berlebihan di monitor ultrawide

## Aksesibilitas

Semantic HTML, skip link, keyboard navigation dengan focus ring,
`aria-current` / `aria-pressed` / `aria-expanded` / `role=switch` / `role=radiogroup`,
drawer dengan focus trap + Escape, kontras teks ≥ 4.5:1, target sentuh ≥ 44px di
layar sentuh, dan dukungan `prefers-reduced-motion`.

## Keamanan

- API key hanya ada di `app/.env` (mode 600) dan tidak pernah dikirim ke frontend.
- Frontend memanggil `/api/...` di origin yang sama; key tidak pernah menyentuh peramban.
- `.env` sudah masuk `.gitignore`.
- Tidak ada kata sandi, sesi, atau cookie: aplikasi tidak punya akun, jadi
  tidak ada kredensial yang bisa bocor.
- `X-Powered-By` dimatikan; `X-Content-Type-Options: nosniff` dan
  `Referrer-Policy: strict-origin-when-cross-origin` dipasang di semua respons.
- Content-Security-Policy **belum** dipasang — sengaja, karena perlu pengujian
  sendiri supaya tidak mematikan OCR/suara/peta.
