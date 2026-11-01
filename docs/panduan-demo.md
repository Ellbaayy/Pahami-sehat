# Panduan Demo — Grand Final LOGICODIX 2026

Disusun 1 November 2026. **Semua angka waktu di bawah diukur di mesin ini**, bukan perkiraan —
perintah pengukurnya dicantumkan supaya dapat diperiksa ulang sebelum hari-H.

---

## 0. Aturan panggung yang mengikat

| Hal | Ketentuan |
|---|---|
| Durasi | 15 menit per tim: **1 menit verifikasi localhost + 7 menit presentasi & live demo + 3 menit Q&A + 4 menit transisi** |
| Wajib | Aplikasi harus dapat dijalankan **di localhost** pada laptop sendiri |
| Bukan bagian panggung | Video demo 3–5 menit tanpa narasi peserta — itu syarat submission, bukan demo langsung |

---

## 1. Angka terukur sebagai dasar urutan demo

| Jalur | Waktu terukur | Catatan |
|---|---|---|
| `POST /api/tanya` — panggilan **pertama** sesudah server hidup | **43,2 detik** | Pencarian sumber hidup (MedlinePlus/Wikipedia) ikut berjalan |
| `POST /api/tanya` — panggilan berikutnya | **7,5 detik** | Sumber sudah tersimpan di cache |
| `POST /api/verifikasi` (Cek Klaim) | **11,8 detik** | Contoh: klaim "air lemon menyembuhkan kanker" |
| `POST /api/suara` — satu kalimat | **1,4 detik** | 27.936 byte, `audio/mpeg` |
| `GET /api/konten` | 0,25 detik | 7.204 byte |
| `GET /api/berita/ringkas` | 0,002 detik (cache) | 451 byte |
| `GET /` · `/app/` · `/privasi.html` | 0,001–0,002 detik | halaman statis & kerangka aplikasi |

**Konsekuensi yang harus dipegang:** jangan pernah menjawab pertanyaan demo yang belum pernah
ditanyakan setelah server dinyalakan. Selisih 43 detik dan 7 detik itu terasa sangat panjang di
panggung. Karena itu ada protokol pemanasan di bagian 2.

---

## 2. Persiapan (mulai 20 menit sebelum tampil)

### 2.1 Nyalakan basis data — jangan dilewati

XAMPP di mesin ini **tidak punya autostart**, jadi MariaDB harus dinyalakan setiap kali komputer
hidup. Tanpa basis data aplikasi tetap menjawab, tetapi **konteks percakapan hilang** — dan itu
justru yang paling terlihat ketika juri mengajukan pertanyaan lanjutan.

```bash
sudo /opt/lampp/lampp startmysql
ss -ltn | grep 3306                       # harus ada yang mendengarkan
curl -s http://127.0.0.1:8787/api/health  # "db": {"aktif": true, ...}
```

### 2.2 Bangun dan jalankan server

```bash
cd ~/Documents/Projects/pahami-sehat/app
npm run build          # hanya kalau ada perubahan kode sejak build terakhir
npm run server
```

Buka **`http://127.0.0.1:8787`** di Chrome — alamat localhost, bukan alamat terowongan.

### 2.3 Pemanasan (wajib, ±1 menit)

Ajukan berurutan di antarmuka, sampai masing-masing selesai:

1. "Apa itu tekanan darah tinggi?" — tingkat **Dewasa**
2. "Apa itu demam berdarah?" — tingkat **Anak-anak**
3. "Bagaimana cara mencegah diabetes?" — tingkat **Dewasa**
4. Buka **Cek Klaim**, uji: "Minum air lemon setiap pagi bisa menyembuhkan kanker"
5. Tekan **Dengar** pada jawaban nomor 1 (mengisi jalur suara)

Tujuannya dua: mengisi cache sumber sehingga demo berjalan 7 detik, dan mengisi halaman
**Riwayat** sebagai jawaban cadangan kalau jaringan panggung bermasalah.

### 2.4 Menyiapkan layar

- Zoom peramban 100%, satu jendela, tab lain ditutup, notifikasi dimatikan.
- Ukuran jendela 1280×800. Untuk menunjukkan tampilan ponsel, pakai mode perangkat di DevTools
  (375×812) — **jangan** mengecilkan jendela biasa, hasilnya bukan tata letak ponsel.
- Siapkan satu jendela terminal untuk bukti localhost pada menit pertama.

---

## 3. Peta 15 menit

### Menit 0:00–1:00 — verifikasi localhost

Yang ditunjukkan, berurutan:

1. Terminal: `curl -s http://127.0.0.1:8787/api/health` → tampil `server: ok`, `db.aktif: true`,
   nama model. Ini bukti aplikasi berjalan **di laptop ini**, bukan di peladen sewaan.
2. Peramban: buka `http://127.0.0.1:8787` → halaman penjelasan tampil.
3. Klik **Coba Aplikasinya** → dashboard terbuka.

### Menit 1:00–3:00 — babak 1: masalah dan empat lapis aksesibilitas

- Beranda: sapaan, empat lencana kemampuan.
- Pindah ke halaman penjelasan, bagian **Masalah** (30 detik): satu angka yang punya rujukan
  lengkap, dan satu angka yang **ditandai "sumber belum ditemukan"** — tunjukkan bahwa penandaan
  itu disengaja.
- Bagian **Konsep**: Terpahami · Terjangkau · Tersambung · Terpercaya.

### Menit 3:00–5:00 — babak 2: Tanya AI dan tingkat baca

- Pertanyaan sudah dihangatkan: "Apa itu tekanan darah tinggi?" tingkat **Dewasa** → jawaban
  muncul ±7 detik, sumber ikut tampil.
- Ganti tingkat ke **Anak-anak**, ajukan pertanyaan yang sama → bandingkan panjang kalimatnya.
  Angka yang boleh disebut (hasil pengukuran 14 Okt 2026, rata-rata 7 putaran): rata-rata
  **6,01 kata/kalimat untuk anak** versus **10,37 untuk dewasa**.
- Tunjukkan **Dengar** (±1,4 detik untuk satu kalimat).

### Menit 5:00–6:30 — babak 3: sumber dan klaim

- Panel sumber: bedakan **"dipakai"** versus **"ditemukan, belum dikutip"**.
- **Cek Klaim** dengan klaim yang sudah diuji: "Minum air lemon setiap pagi bisa menyembuhkan
  kanker" → jawaban menolak klaim, ±12 detik, dan mengarahkan ke tenaga kesehatan.

### Menit 6:30–7:30 — babak 4: pindai foto dan kuesioner

- Komposer → tombol kamera → pindai satu foto berisi teks pendek (label obat atau catatan obat).
  Pemindaian berjalan **di peramban**, tanpa kirim gambar ke server.
- **Kuesioner**: tunjukkan 12 pernyataan HLS-SF12, isi 2–3 soal saja, lalu tunjukkan bentuk hasil
  dan penjelasan skala **indeks 0–50**.

### Menit 7:30–8:00 — babak 5: etika dan batas

Sebut tiga hal, singkat:

1. Tidak mendiagnosis dan tidak memberi persentase peluang.
2. Klaim prognosis yang tidak ada di sumber dihapus oleh pemeriksa di sisi server.
3. Privasi: tanpa akun, konteks percakapan di server tanpa identitas dan **dihapus otomatis
   setelah 7 hari**; kebijakan lengkap ada di `/privasi.html`.

### Menit 8:00–11:00 — Q&A

Enam pertanyaan yang paling mungkin, beserta jawaban yang **hanya memakai fakta proyek**:

| Pertanyaan | Jawaban ringkas |
|---|---|
| "Kenapa tidak memakai GPT/API besar saja?" | Model dipakai lewat gerbang, tetapi yang membedakan bukan modelnya: pencarian sumber resmi, penyaring klaim prognosis, dan penyesuaian tingkat baca diukur, bukan diklaim. |
| "Bagaimana kalau jawabannya salah?" | Setiap jawaban membawa sumber yang bisa dibuka; yang tidak ada di sumber ditandai; aplikasi menolak mendiagnosis. Akurasi diukur lewat uji jawaban, bukan diasumsikan. |
| "Data pengguna disimpan di mana?" | Riwayat dan kuesioner di peramban pengguna. Server hanya menyimpan teks pertanyaan + jawaban tanpa identitas, maksimal 7 hari. |
| "Bisa jalan tanpa internet?" | Halaman penjelasan, kuesioner, dan pindai foto: ya. Tanya AI butuh internet karena mengambil sumber resmi. |
| "Bagaimana dengan Green IT?" | Konten disimpan 24 jam, satu tarikan per hari; aset ber-hash di-cache setahun; pemindaian foto tidak menyentuh server. Angka penghematan unduhan diukur, bukan ditebak. |
| "Apa yang belum selesai?" | Disebut apa adanya: belajarnya berupa prompt + pengukuran (bukan fine-tuning, karena penyedia tidak punya endpoint itu), pembatas laju masih per-instance, dan aplikasi belum mengukur emisi karbonnya sendiri. |

### Menit 11:00–15:00 — transisi

Tidak ada yang perlu dilakukan; gunakan untuk menyiapkan tim berikutnya.

---

## 4. Risiko dan cadangan

| Risiko | Gejala | Tindakan |
|---|---|---|
| MariaDB lupa dinyalakan | Pertanyaan lanjutan dijawab seolah baru | Tetap lanjut; jangan berjanji konteks. Sebut terus terang bahwa basis data sedang mati dan aplikasi tetap menjawab. |
| Model lambat / waktu habis | Jawaban tidak muncul >60 detik | Hentikan dengan tombol **Hentikan**, lalu pakai pertanyaan lain yang sudah dihangatkan. |
| Internet panggung mati | Tanya AI gagal mengambil sumber | Buka **Riwayat** dan tunjukkan jawaban hasil pemanasan; lanjut ke kuesioner dan pindai foto yang berjalan tanpa internet. |
| Suara gagal | Tidak ada audio | Sebut bahwa peramban memakai suara bawaannya; fitur lain tidak terpengaruh. |
| Pemindaian foto lambat | Proses >10 detik | Pindai teks lebih pendek. Mesin OCR berjalan di perangkat, jadi kecepatan bergantung laptop. |
| Layar proyektor kecil | Teks terpotong | Perbesar zoom ke 125%; tata letak sudah diuji pada 1280×800 dan 375×812. |

---

## 5. Yang tidak boleh dilakukan saat demo

- Mengetik nama lengkap, NIK, nomor rekam medis, atau alamat di dalam pertanyaan.
- Menyimpulkan diagnosis, atau menyebut persentase peluang penyakit.
- Menyebut angka yang tidak ada di halaman **Sumber Data**.
- Mengatakan "paling akurat", "menggantikan dokter", atau klaim lain yang tidak dapat dibuktikan.
- Mengubah kode setelah submission berakhir — versi yang dinilai adalah versi terakhir sebelum
  tenggat, dan tidak boleh diubah setelahnya.

---

## 6. Daftar periksa 60 detik sebelum tampil

1. `ss -ltn | grep 3306` → ada.
2. `curl -s http://127.0.0.1:8787/api/health` → `db.aktif: true`.
3. Lima pertanyaan pemanasan selesai.
4. Halaman **Riwayat** berisi jawaban cadangan.
5. Zoom 100%, notifikasi mati, tab lain ditutup.
6. Terminal siap dengan perintah `curl` untuk menit pertama.
