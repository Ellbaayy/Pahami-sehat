# Pahami Sehat — Aplikasi (Produk Utama)

> **Ini produk utama** yang dijalankan saat Grand Final dan video demo.
> Sumber halaman penjelasan ada di [`../docs/prototipe`](../docs/prototipe).

Dashboard edukasi kesehatan **Pahami Sehat** — React di depan, Express di belakang,
model AI **`deepseek-v4-1-flash`** lewat **Kenari.id**.

## Stack

| Lapisan | Isi |
|---|---|
| Frontend | React 19 + Vite 8, Tailwind CSS 4 (`@tailwindcss/vite`), Lucide React |
| Backend | Node + Express 5 (satu dependensi saja) |
| Model | Kenari.id, OpenAI-compatible, default `deepseek-v4-1-flash` |

## Menjalankan

### Alamat saat disajikan

| Alamat | Isi |
|---|---|
| `/` | **halaman penjelasan** (yang muncul pertama kali) |
| `/app/` | **aplikasi** — dashboard AI yang bisa dipakai |
| `/prototipe/` | salinan halaman penjelasan (tautan lama tetap hidup) |
| `/api/...` | backend |

`npm run build` menaruh aplikasi di `dist/app/` dan halaman penjelasan di
`dist/index.html`, jadi root situs menampilkan penjelasan lebih dulu.

```bash
npm install --include=dev   # --include=dev WAJIB bila NODE_ENV=production

# 1) salin env lalu isi API key Kenari
cp .env.example .env        # lalu isi KENARI_API_KEY=kn-...
chmod 600 .env              # key jangan sampai terbaca user lain

# 2) mode pengembangan — dua terminal
npm run server              # backend  : http://127.0.0.1:8787
npm run dev                 # frontend : Vite, /api diteruskan ke backend

# 3) mode Grand Final — satu perintah, satu port, tanpa internet
npm start                   # build + jalankan server di http://127.0.0.1:8787
```

`npm start` adalah cara yang dipakai saat presentasi: Express menyajikan hasil build
dari `dist/` sekaligus melayani `/api`, jadi cukup satu alamat.

> **Catatan:** hasil build memakai ES module. Membuka `dist/index.html` langsung
> lewat `file://` **tidak akan jalan** (diblokir peramban) — harus disajikan lewat
> HTTP, dan `npm start` sudah melakukan itu.

## Struktur

```
app/
├── .env                      API key (JANGAN di-commit, mode 600)
├── .env.example              contoh isi env
├── server/                   backend Express
│   ├── index.js              route + penyajian hasil build
│   ├── config.js             baca env, validasi key
│   ├── kenari.js             klien Kenari.id (chat + streaming SSE)
│   ├── prompts.js            rubrik prompting per fitur
│   └── ekstrak.js            ambil field "jawaban" dari JSON yang mengalir
└── src/                      frontend React
    ├── App.jsx               state global + routing antar panel
    ├── lib/api.js            klien API (termasuk pembaca SSE)
    ├── lib/useServer.js      hook status server
    ├── data/tingkat.js       daftar tingkat baca (satu sumber kebenaran)
    ├── data/dummy.js         konten statis (artikel, tips, topik)
    ├── components/layout/    Sidebar, TopBar, MobileDrawer, nav
    ├── components/ui/        Card, Button, SourcePills, PoinKunci, Peringatan
    └── components/dashboard/ panel tiap halaman
```

## Endpoint

| Metode | Path | Isi |
|---|---|---|
| GET | `/api/health` | status server + apakah key & model hidup |
| GET | `/api/meta` | daftar tingkat baca + model aktif |
| POST | `/api/tanya` | jawab pertanyaan, sesuaikan tingkat baca |
| POST | `/api/tanya/stream` | sama, tapi streaming (SSE) |
| POST | `/api/sederhanakan` | terjemahkan teks medis |
| POST | `/api/verifikasi` | periksa klaim kesehatan |

Error selalu berbentuk `{ ok: false, code, pesan }` — `code` sengaja dipakai UI untuk
memilih pesan yang tepat (`insufficient_balance` ditampilkan sebagai peringatan saldo,
bukan error merah).

## Rubric prompting (pembeda teknis)

Setiap panggilan model memuat rubrik wajib yang sama, di `server/prompts.js`:

1. **Kelengkapan** — semua poin kunci, angka, dan peringatan wajib dipertahankan.
2. **Akurasi** — tidak menambah fakta yang tidak ada di sumber.
3. **Keterbacaan** — gaya bahasa mengikuti tingkat pembaca.
4. **Sitasi** — dilarang mengarang judul/nomor/tautan; kalau tidak yakin, `sumber: []`.
5. **Batas peran** — bukan dokter, tidak memberi diagnosis atau dosis.

Poin kunci dikembalikan sebagai `poin_kunci[]` dan ditampilkan di UI lewat komponen
`PoinKunci` — jadi kelengkapan informasi bisa **dilihat**, bukan cuma diklaim.

## Tingkat baca

| Tingkat | Target Flesch-grade |
|---|---|
| Anak-anak | kelas 6 |
| Remaja | kelas 9 |
| Dewasa | kelas 12 |
| Lansia | kelas 8 |

Lansia sengaja lebih sederhana dari Dewasa: Flesch-grade mengukur kerumitan teks,
bukan usia pembaca.

## Catatan responsive

- `<768px`  : top header + navigation drawer, konten satu kolom
- `768–1023`: sidebar rail icon-only
- `≥1024`   : sidebar penuh 240px
- Grid artikel & panel memakai `auto-fit + minmax`, jadi jumlah kolom
  mengikuti ruang yang tersedia, bukan breakpoint kaku
- Tipografi, padding, dan gap memakai `clamp()`
- Konten dibatasi `max-width: 86rem` agar tidak melebar berlebihan di monitor ultrawide

## Aksesibilitas

Semantic HTML, skip link, keyboard navigation dengan focus ring,
`aria-current` / `aria-pressed` / `aria-expanded` / `role=switch` / `role=radiogroup`,
drawer dengan focus trap + Escape, kontras teks ≥ 4.5:1, target sentuh ≥ 40px di layar
sentuh, dan dukungan `prefers-reduced-motion`.

## Keamanan

- API key hanya ada di `server/.env` (mode 600) dan tidak pernah dikirim ke frontend.
- Frontend memanggil `/api/...` di origin yang sama; key tidak pernah menyentuh peramban.
- `.env` sudah masuk `.gitignore`.
