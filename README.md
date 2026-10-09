# Pahami Sehat

**"Informasi Kesehatan untuk Semua"**

Proyek untuk **LOGICODIX 2026 Hackathon** — subtema **Inclusive Health & Well-being**.
Masalah yang disasar: informasi kesehatan di Indonesia bukan langka, tapi sering tidak
sampai dan tidak dipahami oleh yang paling membutuhkan.

> Status: **prototipe frontend.** Seluruh fitur AI, RAG, suara, verifikasi, dan
> kuesioner masih **simulasi di sisi browser** — belum ada backend, database, atau API.

---

## Peta folder

| Folder | Peran |
|---|---|
| [`app/`](app) | **Produk utama.** Aplikasi dashboard (React + Vite). Ini yang dijalankan saat video demo dan Grand Final. |
| [`docs/prototipe/`](docs/prototipe) | **Halaman penjelasan** (HTML/CSS/JS statis): latar belakang, konsep 4 Lapis Aksesibilitas, alur pemakaian, demo tiap fitur. Untuk presentasi & video demo. |

```
pahami-sehat/
├── app/                      ← PRODUK UTAMA (React + Vite + Tailwind)
│   ├── index.html
│   ├── package.json
│   ├── vite.config.js
│   ├── public/               logo
│   └── src/                  App.jsx, data/, components/, lib/, assets/
└── docs/
    └── prototipe/            ← halaman penjelasan (statis, tanpa build)
        ├── index.html
        ├── css/
        ├── js/
        └── assets/
```

Dua bagian ini saling menaut: sidebar di `app/` punya tombol **"Kembali ke situs"**
ke halaman penjelasan, dan navbar `docs/prototipe/` punya tombol **"Coba Demo"**
ke aplikasi.

---

## Menjalankan aplikasi (produk utama)

```bash
cd app
npm install --include=dev    # --include=dev WAJIB bila NODE_ENV=production
npm run dev                  # dev server
npm run build                # hasil build -> app/dist/
npm run preview              # pratinjau hasil build
```

**Untuk Grand Final (offline/localhost):** jalankan `npm run build`, lalu sajikan
`app/dist/` dari laptop sendiri — hasil build sudah memakai path relatif (`base: './'`),
jadi tetap jalan tanpa internet.

```bash
cd app
npm run build
python3 -m http.server 8080 --bind 127.0.0.1 --directory dist
# buka http://127.0.0.1:8080/
```

## Melihat halaman penjelasan

```bash
cd docs/prototipe
python3 -m http.server 8080 --bind 127.0.0.1
# buka http://127.0.0.1:8080/
```

Halaman ini juga bisa dibuka langsung dari `index.html` di peramban (semua aset lokal).
Tombol "Coba Demo" mengarah ke `app/dist/index.html`, jadi **build aplikasi dulu**
kalau ingin tombol itu berfungsi.

---

## Tingkat baca

Penyederhanaan teks memakai 4 tingkat, dengan target Flesch-grade (dikalibrasi ×0,6
untuk bahasa Indonesia):

| Tingkat | Target |
|---|---|
| Anak-anak | kelas 6 |
| Remaja | kelas 9 |
| Dewasa | kelas 12 |
| Lansia | kelas 8 |

Lansia ditargetkan **lebih sederhana** dari Dewasa karena Flesch-grade mengukur
kerumitan teks, bukan usia pembaca.

---

## Konteks lomba (LOGICODIX 2026)

Indikator penilaian: Problem-Solution Fit 25% · Technology Innovation 25% ·
Software Engineering 25% · UI/UX 15% · Green IT & Ethics 10%.

Tenggat: Hacking Week 7–14 November 2026 · **Last Submission 14 November 2026** ·
Pengumuman finalis 21 November 2026 · Puncak acara 29 November 2026.

Ketentuan yang mengikat: karya MVP berbasis Web/Mobile, source code di repo GitHub,
video demo 3–5 menit **tanpa narasi peserta**, dan aplikasi harus bisa dijalankan
di localhost saat Grand Final.
