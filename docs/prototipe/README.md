# Prototipe Halaman Penjelasan — Pahami Sehat

> **Bukan produk utama.** Produk yang dipakai/dinilai ada di folder [`../../app`](../../app).
> Folder ini adalah **halaman penjelasan statis**: latar belakang, konsep 4 lapis
> aksesibilitas, alur pemakaian, dan status tiap fitur — berguna untuk video demo
> dan presentasi. Gambaran proyek ada di [`../../README.md`](../../README.md).

**"Informasi Kesehatan untuk Semua"**

Halaman ini **tidak punya demo interaktif**. Semua yang bisa dicoba ada di
aplikasi (tombol "Coba Aplikasinya" → `/app/`). Skrip `js/main.js` hanya
mengurus hal presentasional: splash singkat, navbar menempel, menu mobile,
animasi muncul saat di-scroll, penanda menu aktif, dan tombol kembali ke atas.
**Tidak ada panggilan jaringan, tidak ada penyimpanan, tidak ada simulasi.**

## Menjalankan

Dari folder repo ini:

```bash
python3 -m http.server 8080 --bind 127.0.0.1
```

lalu buka <http://127.0.0.1:8080/>.
Bisa juga cukup membuka `index.html` langsung di peramban (semua aset lokal,
tanpa build).

Kalau dibuka lewat server Express (`npm start` di `app/`), halaman ini menempati
**root situs** (`/`) dan salinannya di `/prototipe/` — hasil
`app/scripts/salin-prototipe.mjs` saat `npm run build`.

## Struktur

```
docs/prototipe/
├── index.html          # seluruh section halaman
├── css/
│   ├── fonts.css       # @font-face Plus Jakarta Sans (vendored)
│   └── style.css       # design tokens + gaya + responsif (mobile first)
├── js/
│   └── main.js         # presentasi saja (IIFE, tanpa dependensi)
├── assets/
│   ├── logo-mark.png   # LOGO ASLI — dipotong dari gambar referensi desain
│   ├── logo-tim.jpeg   # logo tim NØCTURNE
│   ├── qr-pahami-sehat.png
│   ├── fonts/pjs-var.woff2
│   └── ilustrasi/      # hero, masalah, konsep, alur, fitur, produk, kuesioner, klaim, tenang
└── Pahami-Sehat.jpeg   # gambar referensi desain (source of truth)
```

## Section halaman

Urutan `<section>` **wajib sama** dengan urutan tautan di navbar dan footer,
karena keduanya dibaca sebagai daftar isi.

1. Splash singkat (1 detik, lalu hilang)
2. Navbar (sticky, scroll-spy, hamburger di ≤860 px)
3. `#beranda` — hero: tagline, 4 feature badge, tombol "Coba Aplikasinya",
   kartu QR ke aplikasi, dan statistik
4. `#masalah` — **Latar Belakang & Masalah**: 5 celah utama + Kunci Temuan.
   Setiap angka diusahakan punya rujukan yang bisa dibuka; yang belum ada
   sumbernya ditandai `perlu rujukan`, bukan dihapus diam-diam
5. `#konsep` — **4 Lapis Aksesibilitas**: Terpahami, Terjangkau, Tersambung,
   Terpercaya
6. `#alur` — **Alur Pemakaian**: MULAI → pilih bahasa + tingkat baca →
   butuh bantuan apa → proses AI → titik keputusan → SELESAI
7. `#fitur` — **Fitur Utama**: Penerjemah Bahasa Medis, Mode Suara &
   Bahasa Sehari-hari, Mode Kontras Tinggi, Verifikasi klaim
8. `#produk` — mockup laptop + mockup ponsel (ilustrasi, bukan tangkapan layar)
9. `#kuesioner` — **Cek Tingkat Literasi Kesehatan** (instrumen HLS-SF12)
10. `#sumber` — **Daftar Rujukan**
11. `#etika` — **Privasi, Etika AI, dan Jejaknya**
12. Quote band + footer

> Mockup perangkat di bagian **Produk** menampilkan **menu yang sama** dengan
> aplikasi sungguhan: Beranda, Tanya AI, Cek Klaim, Riwayat, Kuesioner,
> Pengaturan. "Sederhanakan", "Suara", dan "Pindai Foto" tidak berdiri sendiri
> karena ketiganya sudah menjadi bagian dari Tanya AI.

## Aksesibilitas & responsif

- Uji lebar: 320 · 375 · 390 · 430 · 768 · 1024 · 1366 · 1440 · 1920 px
- Mobile first, tanpa horizontal overflow, navbar jadi hamburger di ≤860 px
- HTML semantik, `skip-link`, `aria-label`, `aria-pressed`, `role="switch"`,
  target sentuh ≥44 px, fokus terlihat, menghormati `prefers-reduced-motion`
- Font + logo disimpan lokal — halaman tetap tampil penuh tanpa internet

## Catatan

Logo di `assets/logo-mark.png` adalah potongan langsung dari desain referensi
`Pahami-Sehat.jpeg` — konsep dan warna logo tidak diubah.

Alamat di kartu QR (`https://pahami-sehat.vercel.app/app`) masih mengarah ke
deployment Vercel. Kalau alamat publik berubah (mis. terowongan Cloudflare),
gambar QR **dan** tautannya perlu diperbarui bersama.
