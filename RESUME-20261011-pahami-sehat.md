# RESUME — Pahami Sehat

**Diperbarui:** 2026-10-11 · **Aplikasi lokal:** `http://127.0.0.1:8787` · **Situs publik:** `https://pahami-sehat.vercel.app`

## Ringkasan

| # | Hal | Status |
|---|---|---|
| 1 | Kartu "Tips Kesehatan Hari Ini" tampil ngawur (saran jam tidur di bawah judul rokok, kalimat menggantung) | **diperbaiki** |
| 2 | Panel Suara tidak bisa menerima suara | **sebab ditemukan** — peramban, bukan aplikasi |
| 3 | Kartu QR di halaman penjelasan | **terpasang** |
| 4 | Tanya AI mengambil sumber tidak relevan | **temuan, belum diperbaiki** |

## 1. Kartu "Tips Kesehatan Hari Ini"

Tiga sebab berbeda:

1. `app/src/components/dashboard/HealthTip.jsx` memuat **teks tetap** soal jam tidur, sehingga kotak itu muncul di bawah judul apa pun.
2. `app/server/konten.js` memotong `tubuh` dengan `slice(0, 900)` — putus di tengah kata, dan sisa kalimatnya lolos filter panjang lalu tampil sebagai "butir".
3. `ringkas` memakai meta description Kemenkes apa adanya, padahal deskripsi itu sudah terpotong di 125 karakter oleh penerbitnya sendiri.

Perbaikan:

- `potongKalimat()` mundur ke **batas kata** (bukan tengah kata) dan menutup dengan "…".
- `butirDari()` hanya menerima butir yang **berakhir tanda baca**.
- `ringkas` wajib berakhir di akhir kalimat; `tubuh` dipotong lewat `potongKalimat()`.
- Artikel yang isinya masih terpotong ("…") **ditolak** jadi tips.
- Field baru `selengkapnya` mengisi kotak lanjutan — tetap kalimat sumber, bukan tulisan tetap di komponen.
- Label sumber kini **bisa diklik** ke artikel aslinya.

Hasil: judul "Cegah Stunting dengan Pola Asuh yang Baik", body utuh, 3 butir semuanya berakhir tanda baca, tidak ada kata "tidur" di kartu.

## 2. Panel Suara

Aplikasi memakai Web Speech API. Fitur itu **tidak berjalan di Brave** (izin mikrofon lolos, lalu `onerror: network`) dan **tidak ada di Firefox** (`SpeechRecognition` undefined). Chrome bisa. Jadi masalahnya peramban, bukan aplikasi.

## 3. Kartu QR

`docs/prototipe/assets/qr-pahami-sehat.png` (495×495) berisi `https://pahami-sehat.vercel.app/app`; kartunya diletakkan di hero halaman penjelasan, setelah tombol utama.

## 4. Temuan: Tanya AI mengambil sumber tidak relevan

`app/server/cari.js` mengirim **seluruh kalimat pertanyaan** ke Wikipedia, sehingga sumber yang disodorkan bisa tidak nyambung — contoh: pertanyaan soal gatal dijawab dengan sumber tentang OCD, dan model jujur mengatakan sumbernya tidak memuat info soal gatal.

Arah perbaikan (belum dikerjakan): buang kata umum/pertanyaan sebelum mencari, dan jangan menampilkan hasil yang tidak memuat kata kunci pertanyaan.

## Catatan operasional

- `npm start` dijalankan dari `app/` — tidak ada `package.json` di root.
- Cache konten (`app/.cache-konten.json`) perlu dihapus untuk melihat hasil perubahan `susun()`/`isiArtikel()`.
- `.env` berisi kunci API (mode 600, gitignored); hanya `.env.example` yang ter-track.
- Port 8787 hanya untuk satu pemakai.
