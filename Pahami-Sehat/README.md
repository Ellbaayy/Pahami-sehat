# Pahami Sehat — Prototipe Frontend

**"Informasi Kesehatan untuk Semua"**

Prototipe website statis untuk platform informasi kesehatan *Pahami Sehat*.
Seluruh fitur yang butuh backend (AI, RAG, suara, verifikasi, kuesioner)
dijalankan sebagai **simulasi murni di sisi browser** — tanpa server,
tanpa database, tanpa API.

## Menjalankan

Dari folder project:

```bash
python3 -m http.server 8080 --bind 127.0.0.1
```

lalu buka <http://127.0.0.1:8080/>.
Bisa juga cukup membuka `index.html` langsung di peramban (semua aset lokal).

## Struktur

```
Pahami-Sehat/
├── index.html          # seluruh section halaman
├── css/
│   ├── fonts.css       # @font-face Plus Jakarta Sans (vendored)
│   └── style.css       # design tokens + gaya + responsif (mobile first)
├── js/
│   └── main.js         # seluruh interaksi/demo (IIFE, tanpa dependensi)
├── assets/
│   ├── logo-mark.png   # LOGO ASLI — dipotong dari gambar referensi desain
│   └── fonts/pjs-var.woff2
└── Pahami-Sehat.jpeg   # gambar referensi desain (source of truth)
```

## Section halaman

1. Navbar (sticky, scroll-spy, hamburger di mobile)
2. Hero — tagline + 4 feature badges
3. Latar Belakang & Masalah — 5 celah utama + Kunci Temuan
4. Konsep: 4 Lapis Aksesibilitas (Terpahami, Terjangkau, Tersambung, Terpercaya)
5. Alur Pemakaian — alur resmi dari `alur-pahami-sehat.pdf`:
   flow 6 langkah (MULAI → pilih bahasa/level → butuh bantuan apa → proses AI →
   titik keputusan → SELESAI) + panel interaktif:
   - **Langkah 1**: pilih bahasa + tingkat baca (SD/SMP/SMA),
     tersinkron dengan demo penerjemah & mode suara
   - **Langkah 2**: pilih bantuan (1 Terjemahkan / 2 Cek Info / 3 Kuesioner),
     scroll ke demo yang sesuai
6. Fitur Utama — 4 kartu dengan demo interaktif:
   - Penerjemah: input teks/foto(OCR simulasi)/rekam suara, titik keputusan
     **keterbacaan ≤ target level?** (level baca input diukur nyata dengan
     Flesch-Kincaid dikalibrasi ×0,6 untuk bahasa Indonesia; bila belum lolos
     → loop balik 1×), output = versi sederhana + indikator level baca
     + SUMBER + tombol **Dengar** (TTS Web Speech API)
   - Mode suara: mic simulasi + TTS + pilihan bahasa daerah
   - Mode hemat sinyal: toggle + titik keputusan **sinyal internet tersedia?**
     (cabang cache vs versi terbaru, ikut `navigator.onLine` + event online/offline)
   - Verifikasi: percabangan **VERDICT SESUAI** (kutipan sumber) vs
     **VERDICT TIDAK DITEMUKAN** (diarahkan ke Kemenkes/WHO/BPOM),
     keputusan berdasar topik resmi & penanda klaim hoaks
7. Gambaran Produk — mockup laptop (sidebar aktif) + mockup mobile
8. Kuesioner HLS-SF12 — skor + donut chart + **saran** per kategori hasil
9. Quote/tagline
10. Cara Menembak Rubrik Penilaian — 5 pilar dengan bobot persen
11. Footer

## Aksesibilitas & responsif

- Uji lebar: 320 · 375 · 390 · 430 · 768 · 1024 · 1366 · 1440 · 1920 px
- Mobile first, tanpa horizontal overflow, navbar jadi hamburger di ≤860 px
- HTML semantik, `skip-link`, `aria-label`, `aria-pressed`, `role="switch"`,
  target sentuh ≥44 px, fokus terlihat, menghormati `prefers-reduced-motion`
- Font + logo disimpan lokal — halaman tetap tampil penuh tanpa internet

## Catatan

Logo di `assets/logo-mark.png` adalah potongan langsung dari desain referensi
`Pahami-Sehat.jpeg` — konsep dan warna logo tidak diubah.
