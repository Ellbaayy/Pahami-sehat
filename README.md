# Pahami Sehat

**"Informasi Kesehatan untuk Semua"**

Proyek untuk **LOGICODIX 2026 Hackathon** — subtema **Inclusive Health & Well-being**.
Masalah yang disasar: informasi kesehatan di Indonesia bukan langka, tapi sering tidak
sampai dan tidak dipahami oleh yang paling membutuhkan.

> Status: **MVP berjalan.** Fitur AI sudah memanggil model sungguhan
> (`deepseek-v4-1-flash` lewat Kenari.id) dari server Express sendiri.
> Yang masih simulasi: input suara dan OCR (belum pakai Web Speech API / Tesseract).

---

## Peta folder

| Folder | Peran |
|---|---|
| [`app/`](app) | **Produk utama.** Aplikasi dashboard (React + Vite + Express). Ini yang dijalankan saat video demo dan Grand Final. |
| [`docs/prototipe/`](docs/prototipe) | **Halaman penjelasan** (HTML/CSS/JS statis): latar belakang, konsep 4 Lapis Aksesibilitas, alur pemakaian, status tiap fitur. **Tampil sebagai halaman depan situs.** |

### Alamat di situs

| Alamat | Isi |
|---|---|
| `/` | halaman penjelasan — yang muncul pertama kali dibuka |
| `/app/` | aplikasi yang bisa dipakai |
| `/prototipe/` | salinan halaman penjelasan (tautan lama tetap hidup) |

```
pahami-sehat/
├── app/                      ← PRODUK UTAMA (React + Express + Tailwind)
│   ├── .env                  API key Kenari (JANGAN di-commit)
│   ├── server/               backend Express: route, klien Kenari, prompt, rubrik
│   ├── src/                  frontend React: App.jsx, lib/, data/, components/
│   ├── index.html
│   ├── package.json
│   └── vite.config.js
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

**Untuk Grand Final:** `npm start` adalah yang dipakai saat presentasi — Express
menyajikan hasil build sekaligus melayani `/api`, jadi cukup satu alamat.

> Hasil build memakai ES module, jadi membuka `dist/index.html` lewat `file://`
> **tidak akan jalan**. Harus disajikan lewat HTTP — `npm start` sudah begitu.

> Tanpa API key, server tidak mau start dan akan memberi pesan jelas soal `.env`.

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
