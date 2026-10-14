# Storyboard Video Demo — Pahami Sehat

LOGICODIX 2026 · Subtema *Inclusive Health & Well-being* · Batas submission **14 November 2026**

> Berkas ini rencana produksi. Setiap angka yang muncul di video diambil dari yang **sudah
> diverifikasi** di `docs/prototipe/index.html` dan `docs/verifikasi-*.md` — tidak ada angka
> baru yang dikarang di sini. Semua bagian yang perlu diisi sudah lengkap.

**Tim:** NØCTURNE · Gesang Hemas Bayu Sekti (ketua) · Rafsanjani Castro Satria Chandra ·
Najwa Azzahra Purnomo Putri · Matthew Randyka Jesa

---

## 1. Aturan panitia yang mengikat (dari guidebook, hal. 14–16)

Dibaca dari `~/Dokumen/lomba/LOGICODIX-2026-Guidebook.pdf` (OCR — berkasnya tidak punya lapisan teks):

| Ketentuan | Bunyi aslinya |
|---|---|
| Durasi | "Video berdurasi **3-5 menit**" |
| Isi | "Video menampilkan **fitur-fitur aplikasi secara langsung**, termasuk fitur integrasi AI" |
| Suara | "Video berupa demonstrasi hasil aplikasi **tanpa suara presentasi atau penjelasan dari peserta**" |
| Alur | "Video demonstrasi harus menunjukkan **alur penggunaan** dan cara kerja produk" |
| Produk | "video demonstrasi **produk fungsional**" |

**Target durasi: 4 menit 15 detik** — aman di tengah rentang 3–5 menit, masih ada ruang kalau
satu adegan melar.

### Satu hal yang perlu diputuskan jagi

Frasa "tanpa suara presentasi atau penjelasan dari peserta" bisa dibaca dua cara:

1. **Longgar (yang Eun-soo pakai):** yang dilarang adalah **narasi peserta**. Suara yang keluar
   dari aplikasinya sendiri **bukan** narasi peserta — itu justru produk yang sedang didemonstrasikan.
   Jadi fitur "Dengar" tetap ditampilkan berbunyi.
2. **Ketat:** tidak boleh ada suara apa pun, termasuk dari aplikasi. Kalau ini yang dimaksud,
   adegan suara diganti **subtitle** yang menyebut "suara neural, terdengar di perangkat pengguna".

**Keputusan jagi (14 Okt 2026): SKIP — tidak perlu tanya panitia.** Video dibuat **tanpa narasi
peserta** dan **tanpa suara aplikasi**; adegan suara (Adegan 7) ditampilkan lewat **subtitle** saja.
Ini bacaan paling aman: tidak mungkin melanggar, karena memang tidak ada suara apa pun di berkasnya.

---

## 2. Kesesuaian dengan indikator penilaian

Setiap adegan di bawah mengejar satu indikator. Bobotnya: Problem-Solution Fit 25% ·
Technology Innovation 25% · Software Engineering 25% · UI/UX 15% · Green IT & Ethics 10%.

| Indikator | Adegan yang mengejarnya |
|---|---|
| Problem-Solution Fit 25% | Adegan 2 (masalah, berangka) · Adegan 4 (jawaban bersumber) |
| Technology Innovation 25% | Adegan 5 (pencarian berjenjang + AI) · Adegan 7 (suara neural) |
| Software Engineering 25% | Adegan 10 (arsitektur, uji, CI) |
| UI/UX 15% | Adegan 3 (4 lapis aksesibilitas) · Adegan 6 (tingkat baca) |
| Green IT & Ethics 10% | Adegan 9 (privasi + pindai foto di perangkat) · Adegan 10 (Green IT) |

---

## 3. Adegan demi adegan

Format tiap adegan: **waktu · yang tampil · teks di layar · yang diklik · mengejar apa**.
Semua teks di layar ditulis **Indonesia** (istilah teknis tetap Inggris), sesuai gaya halaman penjelasan.

### Adegan 1 — Pembuka · 0:00–0:15 (15 detik)

- **Tampil:** kartu judul, latar gradien lembut yang sama dengan halaman penjelasan.
- **Teks di layar:**
  - Logo Pahami Sehat (`app/src/assets/logo-mark.png`)
  - **Pahami Sehat** — *Informasi Kesehatan untuk Semua*
  - **Logo tim NØCTURNE** (`docs/prototipe/assets/logo-tim.jpeg`) + **NØCTURNE**
  - Gesang Hemas Bayu Sekti *(ketua)* · Rafsanjani Castro Satria Chandra · Najwa Azzahra Purnomo Putri · Matthew Randyka Jesa
  - LOGICODIX 2026 — Inclusive Health & Well-being
- **Klik:** tidak ada.
- **Mengejar:** identitas tim (wajib) + kesan pertama UI/UX.
- **Catatan:** logo tim **wajib tampil** dan namanya **wajib** disebut di sini.
- **Catatan produksi:** `logo-tim.jpeg` berlatar **hitam** (1254×1254). Di kartu pembuka yang
  latarnya terang, jangan ditempel kotak-kotak — beri **bingkai/kartu gelap** atau tampilkan
  dengan latar hitam penuh supaya tidak terlihat seperti tempelan.

### Adegan 2 — Masalah · 0:15–0:50 (35 detik)

- **Tampil:** halaman penjelasan bagian **Masalah** (`/` → `#masalah`), digulir pelan lewat 5 kartu celah.
- **Teks di layar (muncul satu per satu, semua dari sumber yang sudah diverifikasi):**
  - `33% pasien tingkat problematik, 16,2% inadekuat — 958 responden (Malini dkk., 2025)`
  - `Materi kesehatan setara kelas 12,8 — terlalu berat untuk pembaca 9–11 tahun`
  - `27,8% penduduk belum punya jaminan kesehatan (SKI 2023)`
  - `Puskesmas tanpa dokter: 48% di Papua, 23% di Maluku (SISDMK 2020)`
  - `2.622 hoaks kesehatan (Komdigi)`
  - `Akses informasi = variabel berdampak terbesar: OR 22,864 (Simpang Kawat)`
- **Klik:** gulir saja.
- **Mengejar:** Problem-Solution Fit.
- **Catatan kejujuran:** di halaman penjelasan, tiga hal masih bertanda `sumber belum ditemukan`
  / `perlu rujukan` (mis. "kelas 12,8", dua butir kesenjangan). **Jangan tampilkan penanda itu
  di video** — cukup pilih angka yang sudah bersumber. Jangan pula menghapusnya dari halaman.

### Adegan 3 — Solusi & 4 lapis aksesibilitas · 0:50–1:15 (25 detik)

- **Tampil:** bagian **Konsep** (`#konsep`), ilustrasi empat lapis.
- **Teks di layar:**
  - `Satu platform, empat lapis aksesibilitas:`
  - `1 · Bahasa lebih sederhana — 4 tingkat baca menurut umur`
  - `2 · Bisa didengar — jawaban dibacakan suara neural`
  - `3 · Bisa dipindai — foto jadi teks, seluruhnya di perangkat`
  - `4 · Selalu bersumber — tiap jawaban menunjuk sumbernya`
- **Klik:** tidak ada.
- **Mengejar:** UI/UX + kerangka solusi.

### Adegan 4 — Inti: Tanya AI + sumber · 1:15–2:00 (45 detik)

- **Tampil:** `/app/` → menu **Tanya AI**.
- **Aksi berurutan:**
  1. Ketik: `Apa itu demam berdarah?` → tekan **Tanya Sekarang**.
  2. Jawaban mengalir (streaming) — diamkan 4–6 detik supaya terlihat prosesnya.
  3. Gulir ke panel **Sumber Jawaban** — tunjukkan beda "dipakai" vs "ditemukan, belum dikutip".
  4. Tunjukkan **poin kunci** dan **tingkat baca** yang dipakai.
- **Teks di layar:** `Jawaban selalu menunjuk sumbernya — dan sumber yang benar-benar dikutip dibedakan dari yang hanya ditemukan.`
- **Mengejar:** Problem-Solution Fit + Technology Innovation.
- **Catatan produksi:** jawaban butuh **4–6 detik**. Beri jeda sebelum memotong; jangan sampai
  terlihat menggantung.

### Adegan 5 — Cek Klaim · 2:00–2:25 (25 detik)

- **Tampil:** menu **Cek Klaim**.
- **Aksi:** tempel satu klaim kesehatan yang beredar → tekan periksa → tunjukkan **verdict + sumber**.
- **Teks di layar:** `Klaim diperiksa, bukan dipercaya begitu saja.`
- **Mengejar:** Problem-Solution Fit (hoaks, lihat angka 2.622 di Adegan 2).

### Adegan 6 — Sederhanakan + tingkat baca · 2:25–2:50 (25 detik)

- **Tampil:** **Tanya AI** → mode **Sederhanakan**.
- **Aksi:** tempel teks medis pendek (mis. label obat) → kirim → tunjukkan hasil yang lebih sederhana.
- **Teks di layar:** `Teks medis yang rumit jadi bahasa yang bisa dipahami.`
- **Mengejar:** UI/UX + Problem-Solution Fit.

### Adegan 7 — Suara neural · 2:50–3:15 (25 detik)

- **Tampil:** jawaban dari Adegan 4, tekan tombol **Dengar**.
- **Aksi:** tombol berubah jadi **Hentikan**; diamkan ~8 detik supaya terlihat prosesnya; tekan **Hentikan**.
- **Teks di layar (subtitle — video tanpa suara):**
  - `Suara neural dengan nada mengikuti isi kalimat.`
  - `Lima suara tersedia: Indonesia (perempuan & laki-laki), Jawa, Sunda, Inggris.`
  - `Bisa dihentikan kapan saja.`
- **Mengejar:** Technology Innovation + aksesibilitas.
- **Catatan produksi (PENTING):**
  - **Video ini TANPA SUARA** (keputusan jagi). Jadi Adegan 7 ditampilkan **lewat subtitle** —
    tunjukkan tombol berubah "Dengar" → "Hentikan" dan bilah suara berjalan, tanpa perlu audio.
  - Sink audio mesin ini **sengaja di-MUTE oleh jagi** — jangan diubah.
  - **Harus dijalankan di localhost** (`npm run server` → `http://127.0.0.1:8787`). Di versi
    daring (Vercel) fitur ini menjawab `502` karena batas platform serverless.
  - Pakai Chrome atau Edge. Brave/Firefox tidak mendukung pengenalan suara.

### Adegan 8 — Pindai foto + Kuesioner · 3:15–3:40 (25 detik)

- **Tampil:** mode **Pindai foto** di komposer (ikon kamera), lalu menu **Kuesioner**.
- **Aksi:** unggah satu foto berisi teks → tekan **Pindai teks** → hasil masuk ke kotak isian.
  Lalu pindah ke Kuesioner, tunjukkan 1 soal + donut progres.
- **Teks di layar:** `Foto dipindai di perangkat — tidak ada satu pun permintaan yang keluar dari peramban.`
- **Mengejar:** Green IT & Ethics + Technology Innovation.
- **Catatan produksi:** memilih berkas **tidak** memulai pemindaian — tombol **Pindai teks**
  masih harus diklik.

### Adegan 9 — Privasi & Etika · 3:40–4:00 (20 detik)

- **Tampil:** menu **Pengaturan**, gulir ke bagian privasi. Lalu menu **Riwayat**.
- **Teks di layar:**
  - `Riwayat & jawaban kuesioner disimpan di perangkat, bukan di server.`
  - `Bisa dihapus kapan saja — dan penghapusannya bisa dibatalkan.`
  - `Yang dikirim ke server hanya teks pertanyaan. Tidak ada nama, akun, atau identitas.`
- **Klik:** tunjukkan tombol hapus riwayat + notifikasi **Batalkan**.
- **Mengejar:** Green IT & Ethics (10%).

### Adegan 10 — Rekayasa & Green IT · 4:00–4:15 (15 detik)

- **Tampil:** README di GitHub — bagian **Arsitektur** (diagram Mermaid + tabel tempat penyimpanan data),
  lalu sebentar tampilkan tab CI yang hijau.
- **Teks di layar:**
  - `React + Vite + Express · 16 langkah CI hijau · uji tanpa jaringan`
  - `Pindai foto jalan di perangkat: hemat daya server, data tidak keluar`
  - `Kode terbuka: github.com/Ellbaayy/Pahami-sehat`
- **Mengejar:** Software Engineering (25%) + Green IT (10%).
- **Catatan produksi:** ambil tangkapan CI dari **run terakhir yang hijau**; jangan pakai
  tangkapan lama yang sudah tidak cocok dengan commit terakhir.

### Adegan 11 — Penutup · 4:15 (10 detik)

- **Tampil:** kartu penutup, latar sama dengan pembuka.
- **Teks di layar:**
  - Logo Pahami Sehat + **Pahami Sehat**
  - **Logo tim NØCTURNE** + **NØCTURNE**
  - `Informasi kesehatan yang bisa dipahami semua orang.`
  - `LOGICODIX 2026 — Inclusive Health & Well-being`
- **Mengejar:** kesan akhir + identitas tim (kedua kalinya, supaya juri tidak lupa).

---

## 4. Yang harus disiapkan sebelum merekam

- [x] **Nama tim:** **NØCTURNE**
- [x] **Anggota (urutan sesuai daftar jagi):**
      1. **Gesang Hemas Bayu Sekti** — ketua tim
      2. Rafsanjani Castro Satria Chandra
      3. Najwa Azzahra Purnomo Putri
      4. Matthew Randyka Jesa
- [x] **Logo tim:** `docs/prototipe/assets/logo-tim.jpeg` (1254×1254, latar hitam) — sudah disalin ke repo
- [x] **Aturan "tanpa suara"** — diputuskan **skip** oleh jagi: video dibuat **tanpa narasi peserta**,
      dan suara aplikasi ditampilkan lewat subtitle. Tidak perlu tanya panitia.
- [ ] **Jalankan server:** `cd app && npm run server` → buktikan `curl -s http://127.0.0.1:8787/api/health`
- [ ] **Siapkan bahan uji:** 1 foto berisi teks (untuk pindai), 1 klaim kesehatan (untuk cek klaim),
      1 teks label obat (untuk sederhanakan)
- [ ] **Jeda uji suara minimal 20 detik** sebelum take suara (batas laju layanan)
- [ ] **Bersihkan riwayat & kuesioner** di localStorage supaya take terlihat rapi dari nol
- [ ] **Resolusi rekaman:** layar laptop ini **1366×768** (monitor `eDP-1`). Rekam pada resolusi itu,
      jangan memaksa 1920×1080 — tidak ada di monitor ini.
- [ ] **Musik latar:** opsional, volumenya rendah. Kalau ragu soal aturan suara, lewati.

## 5. Alat rekam yang tersedia di mesin ini

Sudah Eun-soo cek dan **uji benar-benar jalan** — tidak perlu memasang apa pun:

| Alat | Lokasi | Catatan |
|---|---|---|
| `gpu-screen-recorder` | `/usr/bin/gpu-screen-recorder` | rekam Wayland/Hyprland, hemat sumber daya |
| `ffmpeg` / `ffprobe` | `~/.hermes/tools/ffmpeg-9.0.1-linux-x64/bin/` | pemotongan, penggabungan, ekspor, penghitungan durasi |

Sesi ini Wayland (`wayland-1`), X11 juga aktif (`:1`). Monitor: `eDP-1` **1366×768**.

**Hasil uji rekam (14 Okt 2026):**

| Uji | Hasil |
|---|---|
| Video saja (`-w screen -f 30`) | ✓ h264, 1366×768, 30 fps, berkas sah |
| Video + suara (`-a default_output`) | ✓ h264 + **opus 48 kHz stereo** |
| Track audio benar-benar berisi suara | ✓ `mean_volume -28,6 dB`, `max_volume -19,9 dB` (bukan diam) |
| Perangkat audio tersedia | `default_output` · `easyeffects_sink.monitor` · `alsa_output.…analog-stereo.monitor` |

## 6. Perintah produksi (sudah diuji)

```bash
FF=~/.hermes/tools/ffmpeg-9.0.1-linux-x64/bin

# 1. jalankan aplikasi di localhost (yang akan dinilai saat Grand Final)
cd ~/Documents/Projects/pahami-sehat/app && npm run server
curl -s http://127.0.0.1:8787/api/health          # harus {"server":"ok",...}

# 2. rekam layar — video TANPA SUARA (keputusan jagi), hentikan dengan Ctrl+C
gpu-screen-recorder -w screen -f 30 -o ~/Video/take1.mp4

# 3. cek durasi & stream sebelum memotong
$FF/ffprobe -v error -show_entries format=duration \
  -show_entries stream=codec_type,codec_name,width,height -of default=noprint_wrappers=1 take1.mp4

# 4. potong satu adegan (tanpa render ulang — cepat & tanpa turun mutu)
$FF/ffmpeg -i take1.mp4 -ss 00:00:15 -to 00:00:50 -c copy adegan2.mp4

# 5. gabung semua adegan jadi satu berkas akhir
$FF/ffmpeg -f concat -safe 0 -i daftar.txt -c copy pahami-sehat-demo.mp4
```

> **Penting soal suara:** sink audio mesin ini **sengaja di-MUTE oleh jagi**, dan video dibuat
> **tanpa suara** — jadi tidak ada yang perlu dinaikkan. Adegan 7 (suara neural) ditampilkan lewat
> **subtitle** saja. Kalau nanti jagi berubah pikiran dan ingin ada suara aplikasi, mintakan izin
> dulu sebelum mengubah setelan volume.

## 7. Pemeriksaan akhir sebelum submission

- [ ] Durasi **3–5 menit** (hitung dengan `ffprobe -show_entries format=duration`)
- [ ] **Tidak ada narasi peserta** — dengar ulang seluruh berkas sekali
- [ ] Fitur **integrasi AI** terlihat jelas (Adegan 4–7)
- [ ] **Alur penggunaan** utuh: tanya → jawab → sumber → dengar → simpan
- [ ] Nama tim + logo tampil (Adegan 1 & 11)
- [ ] Semua angka di video **ada sumbernya** — tidak ada statistik baru
- [ ] Kode di repo **dibekukan** sebelum 14 November (setelah submission tidak boleh diubah)
- [ ] Berkas diunggah lewat mekanisme submission panitia
