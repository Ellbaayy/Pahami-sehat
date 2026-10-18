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
| Backend | Node + Express 5 (`express`, `mysql2`, `msedge-tts`, `tesseract.js`) |
| Model | Kenari.id, OpenAI-compatible, default `deepseek-v4-1-flash` |
| Database | MariaDB lewat XAMPP — **wajib untuk akun**, opsional untuk bahan |

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

Gerbang masuk memakai fitur akun, dan **fitur akun butuh MariaDB**. Tanpa
database, `POST /api/akun/daftar` dan `/masuk` menjawab `503 {"code":"db_mati"}`,
sehingga aplikasi tidak bisa dimasuki. Bahan (konten, berita, pengetahuan) tetap
tersaji tanpa database lewat berkas cache.

```bash
sudo /opt/lampp/lampp startmysql
/opt/lampp/bin/mysql -u root < ../docs/skema-database.sql
/opt/lampp/bin/mysql -u root < ../docs/skema-akun.sql
```

Bawaan `server/db.js` sudah cocok untuk XAMPP (`127.0.0.1:3306`, `root` tanpa
sandi, basis data `pahami_sehat`). Ubah lewat `.env`: `DB_HOST`, `DB_PORT`,
`DB_USER`, `DB_PASSWORD`, `DB_NAMA`. `DB_MATI=1` mematikan database sepenuhnya —
dipakai untuk membuktikan bahan tetap tersaji tanpa database.

## Struktur

```
app/
├── .env                      API key (JANGAN di-commit, mode 600)
├── .env.example              contoh isi env + penjelasan tiap variabel
├── api/index.js              pintu masuk serverless Vercel
├── public/ocr/               mesin OCR: worker, core WASM, data bahasa (17 MB)
├── scripts/salin-prototipe.mjs  menyalin docs/prototipe -> dist/ (prebuild)
├── server/                   backend Express — 22 berkas
│   ├── index.js              rute + penyajian hasil build
│   ├── config.js             baca env, validasi key
│   ├── rute.js               endpoint /api/*
│   ├── ruteAkun.js           endpoint /api/akun/* (masuk, daftar, Google, riwayat)
│   ├── akun.js               hash sandi (scrypt), token sesi, riwayat akun
│   ├── google.js             OAuth server-side (state, penautan akun)
│   ├── kenari.js             klien Kenari.id (chat + streaming SSE)
│   ├── prompts.js            rubrik wajib + prompt per fitur
│   ├── kataKunci.js          pengenalan topik + PETA_PENCARIAN/PETA_MEDLINEPLUS
│   ├── cari.js               pencarian Wikipedia + MedlinePlus
│   ├── berita.js             jalur RSS berita kesehatan
│   ├── konten.js             topik/artikel/tips harian + rotasi daftar
│   ├── suara.js              TTS neural (msedge-tts)
│   ├── jam.js                jam acuan dari header Date
│   ├── db.js                 jembatan MariaDB (gagal = null, tidak melempar)
│   ├── batas.js              pembatas laju
│   ├── batasInput.js         MAKS_TOKEN + LAJU per jalur
│   ├── saji.js               gzip + X-Waktu-Ms + 404 JSON
│   ├── kepala.js             kepala keamanan dasar
│   ├── ekstrak.js            ambil field "jawaban" dari JSON yang mengalir
│   ├── bahasa.js             pilihan bahasa jawaban
│   └── teks.js               perapian teks
└── src/                      frontend React
    ├── App.jsx               state global + routing antar panel + gerbang akun
    ├── components/LoginPage.jsx   gerbang masuk (masuk / buat akun 3 langkah / nama)
    ├── components/LoadingPage.jsx
    ├── lib/api.js            klien API (termasuk pembaca SSE)
    ├── lib/sesi.js           bentuk sesi + localStorage (MAKS_SESI = 20)
    ├── lib/useAkun.js        hook akun + pemindahan riwayat sekali
    ├── lib/useBahasa.js      kamus id/en
    ├── lib/useServer.js      hook status server
    ├── lib/useBerita.js      ringkasan berita untuk lonceng
    ├── lib/useSuara.js       pemutaran audio
    ├── lib/tts.js            pemutar audio (variabel modul)
    ├── lib/ocr.js            tesseract.js + angka mutu pembacaan
    ├── lib/keterbacaan.js    alat ukur keterbacaan + SASARAN
    ├── data/bahasa.js        kamus id + en (319 kunci masing-masing)
    ├── data/tingkat.js       daftar tingkat baca (satu sumber kebenaran)
    ├── data/dummy.js         konten statis
    ├── components/layout/    Sidebar, TopBar, MobileDrawer, nav
    ├── components/ui/        Card, Button, SourcePills, PoinKunci, Peringatan
    └── components/dashboard/ panel tiap halaman
```

## Endpoint

| Metode | Path | Isi |
|---|---|---|
| GET | `/api/health` | status server + key & model + status database |
| GET | `/api/meta` | daftar tingkat baca + model aktif + daftar suara |
| GET | `/api/konten` | topik, artikel, tips harian |
| GET | `/api/berita/ringkas` | ringkasan berita untuk lonceng |
| GET | `/api/db` | hitungan + contoh baris |
| GET | `/api/sitasi` | jejak sumber yang dikutip |
| POST | `/api/tanya` | jawab pertanyaan, sesuaikan tingkat baca |
| POST | `/api/tanya/stream` | sama, tapi streaming (SSE) |
| POST | `/api/sederhanakan` | terjemahkan teks medis |
| POST | `/api/verifikasi` | periksa klaim kesehatan |
| POST | `/api/suara` | teks → MP3 (suara neural) |
| GET | `/api/akun/saya` | siapa yang sedang masuk |
| POST | `/api/akun/cek` · `/daftar` · `/masuk` · `/keluar` · `/keluar-semua` · `/nama` | akun |
| GET | `/api/akun/google` · `/api/akun/google/callback` | OAuth Google |
| GET/POST/PUT/DELETE | `/api/akun/riwayat*` | riwayat milik akun |

Error selalu berbentuk `{ ok: false, code, pesan }` — `code` sengaja dipakai UI untuk
memilih pesan yang tepat (`db_mati` ditampilkan sebagai "butuh database",
`insufficient_balance` sebagai peringatan saldo, bukan error merah).

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
- Kata sandi disimpan sebagai **hash scrypt + salt**, sesi sebagai cookie
  **HttpOnly + SameSite=Lax**; token sesi disimpan sebagai hash di database.
- `X-Powered-By` dimatikan; `X-Content-Type-Options: nosniff` dan
  `Referrer-Policy: strict-origin-when-cross-origin` dipasang di semua respons.
- Content-Security-Policy **belum** dipasang — sengaja, karena perlu pengujian
  sendiri supaya tidak mematikan OCR/suara/peta.
