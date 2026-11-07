# Latihan Live Demo — Grand Final LOGICODIX 2026

Dokumen kerja untuk **latihan**, bukan dokumen penyerahan. Angka waktunya
mengikuti guidebook: **15 menit per tim** = 1 menit verifikasi localhost +
7 menit presentasi & demo + 3 menit tanya jawab + 4 menit transisi.

Target: 7 menit demo berjalan **tanpa membaca catatan**, dan setiap fitur
yang ditunjukkan sudah terbukti jalan di laptop ini (bukan asumsi).

---

## 0. Sebelum hari-H — sekali saja

```bash
cd ~/Documents/Projects/pahami-sehat
npm --prefix app ci --include=dev --ignore-scripts   # pasang persis seperti CI
npm --prefix app run build                            # WAJIB: halaman depan ada di dist/
```

Periksa bahwa `.env` berisi kunci dan MySQL menyala:

```bash
sudo /opt/lampp/lampp startmysql     # XAMPP di mesin ini
cat app/.env | grep -c KENARI_API_KEY   # harus 1
```

> Kalau `KENARI_API_KEY` kosong, `npm start` **menolak jalan** dan mencetak
> pesan jelas. Itu fitur, bukan kerusakan — tapi jangan ditemukan 5 menit
> sebelum tampil.

---

## 1. Tiga menit sebelum tampil

```bash
cd ~/Documents/Projects/pahami-sehat/app
npm start
```

`npm start` = build + server di `http://127.0.0.1:8787`, satu alamat untuk
halaman penjelasan **dan** aplikasi. Jangan pakai `npm run dev` saat tampil:
itu butuh dua proses dan port 5173.

Buka **dua** tab sejak awal, jangan mengetik alamat di depan juri:

| Tab | Alamat | Untuk |
|---|---|---|
| 1 | `http://127.0.0.1:8787/` | halaman penjelasan (pembuka) |
| 2 | `http://127.0.0.1:8787/app/` | aplikasi (demo) |

Perbesar peramban ke 100% (Ctrl+0). Tutup semua tab lain — notifikasi dan
judul tab yang tidak relevan terbaca sebagai ketidaksiapan.

**Cek 30 detik yang menyelamatkan presentasi** — jalankan berurutan, jangan
dilewati:

```bash
curl -s -o /dev/null -w "server %{http_code}\n" http://127.0.0.1:8787/api/health
curl -s http://127.0.0.1:8787/api/health | head -c 200; echo
```

Yang harus terlihat: `"server":"ok"`, `"kenari":{"ok":true,...}`,
`"db":{"aktif":true,...}`. Kalau `db.aktif` **false**, fitur Rumah Sakit
Nasional akan kosong — nyalakan MySQL dulu (`sudo /opt/lampp/lampp startmysql`),
lalu muat ulang tab aplikasi.

---

## 2. Naskah 7 menit (tanpa membaca)

Kalimat di bawah ini **contoh**, bukan hafalan wajib. Yang wajib adalah
urutan dan durasinya.

**Ukur, jangan menebak.** Ada pengukur waktu untuk latihan ini:

```bash
node latihan-demo.mjs              # mode manual: tekan Enter tiap segmen selesai
node latihan-demo.mjs --otomatis   # hitung mundur sendiri, kamu tinggal ikuti
```

Skrip itu mencetak target tiap segmen, mengukur durasi nyata, lalu
menampilkan segmen mana yang melewati target lebih dari 5 detik beserta
berapa banyak yang harus dipotong. Angka targetnya diambil dari naskah ini —
kalau naskah berubah, ubah keduanya bersamaan.

> Total target **6:40**, sisa **0:20** dari batas 7:00 — disisakan untuk
> transisi, membuka tab, dan hal yang tidak terduga. Jangan mengejar pas 7:00.

### 0:00–0:50 — Masalah, satu kalimat

> "Hasil SKI 2023: 27,8% penduduk Indonesia tidak punya jaminan kesehatan.
> Dan yang lebih sering terjadi bukan 'tidak mau ke fasilitas kesehatan',
> tapi **tidak paham** apa yang tertulis di hasil pemeriksaan."

Sebut **satu** angka saja, yang sudah diverifikasi. Jangan menumpuk angka —
juri menilai Problem-Solution Fit, bukan statistik.

### 0:50–1:40 — Halaman penjelasan (Tab 1)

Gulir **pelan**, tunjuk tiga hal:

1. **Enam kartu fitur** — sebut namanya, jangan baca isinya.
2. **Bagian Etika & Privasi** — "tidak ada akun, tidak ada cookie, data
   dihapus otomatis 7 hari."
3. **Bagian Sumber Data** — "setiap angka di halaman ini bisa dilacak ke
   dokumen aslinya."

> Jangan menggulir cepat. Juri butuh waktu membaca; layar yang berhenti
> justru terbaca sebagai percaya diri.

### 1:40–3:35 — Tanya AI (Tab 2) — INI INTI DEMO

Klik **Tanya AI**, ketik **satu** pertanyaan yang sudah dilatih:

> `Apa itu demam berdarah dan kapan harus ke dokter?`

Tekan Enter, lalu **diam**. Jawaban butuh ±15 detik. Jangan mengisi jeda
dengan "tunggu ya" — gunakan waktu itu untuk satu kalimat:

> "Jawaban ini disusun dari sumber resmi yang dicari saat itu juga, bukan
> dari ingatan model. Sumbernya bisa dibuka di bawah jawaban."

Saat jawaban muncul, tunjuk **tiga** hal, tidak lebih:

1. **Bahasa sederhana** — "ini versi pembaca usia 12 tahun ke atas."
2. **Sumber yang bisa diklik** — buka satu.
3. **Tombol tingkat baca** — ganti ke **Anak-anak** (9–11 tahun), tunjukkan
   jawabannya menjadi lebih pendek. Ini bukti fitur, bukan klaim.

### 3:35–4:30 — Cek Klaim

Klik **Cek Klaim** → **Pakai contoh** (contohnya sudah terisi: "Vaksin MMR
menyebabkan autisme pada anak.") → **Periksa klaim**.
Tunggu hasil, tunjuk **putusan** — salah satu dari tiga ini:
**Klaim didukung sumber resmi** / **Klaim tidak didukung sumber resmi** / **Belum bisa dipastikan**.

> Kalimat kunci: "Aplikasi ini berani bilang **belum bisa dipastikan** kalau
> sumbernya memang tidak cukup. Itu yang membedakannya dari chatbot biasa."

### 4:30–5:50 — Fasilitas Kesehatan

Klik **Fasilitas Kesehatan** → **Pilih Wilayah** → pilih provinsi →
kabupaten. Tunggu daftar dan peta.

> Muat pertama kali **40–50 detik** untuk wilayah baru. Katakan lebih dulu:
> "ini mengambil data langsung dari OpenStreetMap, jadi sekali pertama agak
> lama — sesudahnya dari simpanan." Kalau tidak disebut, juri mengira macet.

Lalu tunjuk:

- **Sepuluh kategori** berwarna di peta.
- **Petunjuk arah** tiga moda — ganti moda, jarak dan waktunya **berubah**.
- Tab **Rumah Sakit Nasional** — "3.325 rumah sakit resmi Kemenkes,
  dari database, bukan dari peta, karena sumbernya tidak punya koordinat."

### 5:50–6:40 — Kuesioner + penutup

Klik **Kuesioner**, jawab satu pertanyaan, tunjuk progresnya.

> "Ini instrumen HLS-SF12 yang tervalidasi — bukan kuis buatan sendiri.
> Hasilnya memberi skor literasi kesehatan 0–50."

Tutup dengan **satu** kalimat:

> "Semuanya berjalan di laptop ini, tanpa akun, tanpa Google Maps API,
> dan bisa diperiksa ulang sekarang."

---

## 3. Tiga pertanyaan yang paling mungkin ditanya

Siapkan jawaban **pendek** — 20 detik, bukan kuliah.

**"Apa bedanya dengan bertanya ke ChatGPT?"**
> "Empat hal: jawabannya memakai sumber yang bisa dibuka, tingkat baca bisa
> diturunkan sampai anak-anak, tidak perlu akun, dan ada pemeriksaan klaim
> yang berani menolak menjawab."

**"Datanya dari mana, dan bagaimana kalau salah?"**
> "Dari sumber resmi — Kemenkes, WHO, PubMed — dan setiap jawaban
> mencantumkan sumbernya. Kalau sumbernya tidak cukup, aplikasi bilang
> tidak bisa dipastikan, bukan mengarang."

**"Kenapa tidak pakai Google Maps?"**
> "Karena biayanya per permintaan dan syaratnya membatasi penyimpanan.
> Kami memakai OpenStreetMap, Photon, OSRM, dan Valhalla — semuanya terbuka
> dan gratis. Batasnya kami sebut terbuka di aplikasi: estimasi waktunya
> dari profil kecepatan, bukan lalu lintas langsung."

---

## 4. Daftar periksa 60 detik sebelum maju

Centang satu per satu, jangan dilewati:

- [ ] `npm start` jalan, tidak ada galat di terminal
- [ ] `curl /api/health` → `server ok`, `kenari ok`, `db aktif`
- [ ] Tab 1 di `/` — halaman penjelasan tampil
- [ ] Tab 2 di `/app/` — beranda tampil
- [ ] Sudah mencoba **satu kali** Tanya AI sampai jawaban keluar
- [ ] Sudah mencoba **satu kali** pilih wilayah sampai peta muncul
- [ ] Peramban 100%, tanpa tab lain
- [ ] Notifikasi desktop dimatikan
- [ ] Charger tersambung
- [ ] Video demo sudah ada di laptop (cadangan kalau internet mati)

---

## 5. Rencana cadangan (kalau ada yang gagal)

| Gejala | Yang dilakukan | Jangan dilakukan |
|---|---|---|
| Jawaban AI tidak keluar | Sebut apa adanya: "modelnya sedang lambat", ganti pertanyaan | Menunggu diam > 30 detik |
| Peta kosong | Pindah ke tab **Rumah Sakit Nasional** (dari DB, tidak butuh jaringan) | Memuat ulang berkali-kali |
| Server mati | Terminal kedua: `npm start` lagi | Panik menghapus cache |
| Internet mati total | Putar video demo, tunjukkan fitur yang direkam | Berpura-pura aplikasi jalan |
| MySQL mati | Tetap lanjut — fasilitas jalan tanpa DB, RM nasional kosong | Menyembunyikan bahwa DB mati |

Semua rencana cadangan ini menyebut keadaan **apa adanya**. Juri menghargai
jawaban jujur lebih dari demo yang berpura-pura sempurna.

---

## 6. Latihan yang harus benar-benar dilakukan

Bukan dibaca — dijalankan dengan pengukur waktu.

| Latihan | Frekuensi | Target |
|---|---|---|
| Demo penuh dengan timer | 3× | ≤ 7 menit, tanpa membaca |
| Tanya jawab 3 pertanyaan | 3× | tiap jawaban ≤ 30 detik |
| Demo dengan internet dimatikan | 1× | tetap bisa menunjukkan 3 fitur |
| Demo setelah reboot | 1× | `npm start` jalan tanpa langkah tambahan |

Catat waktu tiap latihan di bawah ini:

```
Latihan 1: ____ menit ____ detik    catatan: ____________________
Latihan 2: ____ menit ____ detik    catatan: ____________________
Latihan 3: ____ menit ____ detik    catatan: ____________________
```

**Aturan latihan:** kalau satu langkah lupa, ulangi dari awal — jangan
melanjutkan sambil mengingat-ingat. Yang dilatih adalah urutan, bukan isi.
