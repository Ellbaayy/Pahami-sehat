# RESUME — Pahami Sehat

**Diperbarui:** 2026-10-11 02:30 WIB
**Status:** aplikasi jalan di lokal (`http://127.0.0.1:8787`) · situs publik `https://pahami-sehat.vercel.app`
**BELUM memuat** perubahan sesi ini (belum di-push).

Repo: `https://github.com/Ellbaayy/Pahami-sehat` (branch `main`, remote `origin`)

---

## Ringkasan cepat

| # | Hal | Status |
|---|---|---|
| 1 | Kartu "Tips Kesehatan Hari Ini" ngawur (rokok + teks tidur + kalimat menggantung) | **DIPERBAIKI** |
| 2 | Panel Suara tidak bisa input suara | **SEBAB DITEMUKAN** — peramban (Brave/Firefox), bukan aplikasi. Chrome sudah dipasang |
| 3 | QR code di halaman prototipe | **TERPASANG** (belum ikut terbit karena belum push) |
| 4 | Tanya AI mengambil sumber tidak relevan | **TEMUAN BARU** — belum diperbaiki |

---

## 1. Kartu "Tips Kesehatan Hari Ini" — DIPERBAIKI

### Gejala
Kartu menampilkan judul "Rokok Membuat Hidup Jadi Redup" tetapi:
- paragrafnya berakhir terpotong di tengah kata: "...kurang disukai ba"
- ada kotak berisi saran **jam tidur** (topik sama sekali lain)
- salah satu butir berbunyi "...tentunya p" (kalimat menggantung)

### Akar masalah (tiga sebab berbeda)
1. `HealthTip.jsx` memuat **teks tetap di dalam komponen** (kotak tentang tidur). Muncul di bawah judul apa pun.
2. `server/konten.js` memotong `tubuh` dengan `slice(0, 900)` — terpotong di tengah kata. Sisa kalimatnya
   lolos filter panjang (25–110 karakter) lalu tampil sebagai "butir".
3. `ringkas` memakai meta description Kemenkes apa adanya; deskripsi itu **memang sudah terpotong**
   di 125 karakter oleh penerbitnya sendiri ("...disukai ba").

### Perbaikan
- `app/server/konten.js`
  - `potongKalimat()`: kalau tidak ada batas kalimat, mundur ke **batas kata** + "…" (tidak lagi tengah kata)
  - `butirDari()`: butir **wajib** diakhiri tanda baca
  - `ringkas`: wajib berakhir di akhir kalimat
  - `tubuh`: dipotong lewat `potongKalimat(gabung, 900)`, bukan `slice()`
  - `susun()`: artikel yang isinya masih kepotong ("…") **ditolak** jadi tips
  - field baru `selengkapnya` (teks lanjutan untuk tombol "Baca selengkapnya")
- `app/src/components/dashboard/HealthTip.jsx`
  - teks tetap **dibuang**; kotak lanjutan membaca `tip.selengkapnya`
  - tombol "Baca selengkapnya" hanya muncul kalau ada lanjutannya
  - label "Sumber: Kemenkes RI" kini **bisa diklik** ke artikel aslinya
- `app/src/data/dummy.js` — konten cadangan diberi `selengkapnya` yang nyambung

### Bukti
- Kartu sekarang: judul "Cegah Stunting dengan Pola Asuh yang Baik", body utuh, 3 butir semuanya berakhir tanda baca
- `ada kata "tidur" di kartu? False`
- Keempat artikel: `excerpt` dan `body` semuanya berakhir tanda baca, tidak ada yang berakhir "…"
- Tangkapan layar: `~/.cache/pahami-sehat/bukti-kartu-tips-sesudah.png`

### Cara membatalkan
```bash
cd ~/Pahami-sehat
git checkout -- app/server/konten.js app/src/components/dashboard/HealthTip.jsx app/src/data/dummy.js
```

---

## 2. Panel Suara tidak bisa input suara — SEBAB DITEMUKAN

### Kesimpulan
Aplikasi memakai **Web Speech API**. Fitur itu **tidak berjalan di Brave dan Firefox**:

| Peramban | Hasil uji langsung | Putusan |
|---|---|---|
| **Brave** (beta-bin 1.95.87) | constructor ada, izin mikrofon **lolos** (`onstart`), lalu `onerror: network` | layanan suara Google diblokir Brave |
| **Firefox 157** | `window.SpeechRecognition` **undefined** | belum disediakan untuk halaman web |
| **Chrome 155** | terpasang, halaman berjalan | satu-satunya yang bisa |

Bukti uji Brave (urutan pentingnya): `constructor ada: true` → `start() dipanggil` → `onstart: mikrofon terbuka`
→ `onerror: network`. Jadi **bukan izin, bukan mikrofon** — yang gagal layanan suaranya.

Firefox punya kode in-tree (`SpeechRecognitionFeature.sys.mjs`, notifikasi unduh model) tetapi belum
aktif default; shim webcompat bahkan memasang `window.SpeechRecognition = function(){}` palsu.

Mikrofon mesin sehat: `pw-record --rate 16000 --channels 1 out.wav` menghasilkan berkas 94880 byte.

### Tindakan yang sudah dilakukan
- **Google Chrome 155.0.8059.39 dipasang** (`yay -S google-chrome`, paket AUR). Biner: `/usr/bin/google-chrome-stable`
- Chrome sudah dibuka ke `http://127.0.0.1:8787/app/`
- **Menunggu uji dari user**: panel Suara → tekan mikrofon → izinkan → bicara

### Catatan penting
- Chrome **headless tidak bisa** membuktikan fitur ini (butuh suara asli + izin nyata). Bukti sah hanya dari klien asli.
- Jalur alternatif (STT lewat server) **belum bisa**: Kenari punya `whisper-large-v3-turbo`, tetapi saldo akun
  kosong → `HTTP 402 insufficient_balance`. Jalur itu juga mengirim rekaman ke server, sehingga klaim di UI
  ("Tidak ada rekaman yang dikirim ke server kami") harus diubah lebih dulu.
- Saran perbaikan kecil (belum dikerjakan): deteksi Brave supaya tombol mikrofon **mati sejak awal** dengan
  pesan "pakai Chrome atau Edge", bukan tombol aktif yang pasti gagal.

---

## 3. QR code di halaman prototipe — TERPASANG

- Berkas: `docs/prototipe/assets/qr-pahami-sehat.png` (495×495)
- **Isi QR:** `https://pahami-sehat.vercel.app/app` (dibaca dengan `zbarimg`)
- Kartu QR diletakkan di **hero**, tepat setelah tombol "Coba Aplikasinya" / "Lihat Gambaran Produk"
- Gaya: kelas `.qr-card`, `.qr-img`, `.qr-copy`, `.qr-url` di `docs/prototipe/css/style.css`
- Teks kartu: "Buka aplikasinya di ponsel" + penjelasan + tautan `pahami-sehat.vercel.app/app`

### Bukti
- Tersaji: `/assets/qr-pahami-sehat.png` → 200 (dan salinannya di `/prototipe/`)
- **Bisa dipindai**: QR di-crop dari halaman yang benar-benar dirender, dibaca ulang → `https://pahami-sehat.vercel.app/app`
- Alamat tujuan hidup: `https://pahami-sehat.vercel.app/app` → 200
- Tata letak: 150×150 di desktop; di layar ponsel 390px jadi 190×190, tidak meluber
- Tangkapan layar: `~/.cache/pahami-sehat/qr-di-prototipe.png`

### Riwayat penting
QR versi **pertama** (`.../` saja) pernah dipasang lalu **dihapus atas permintaanmu**; versi sekarang
(`.../app`) yang terpasang. Cara mencabut lagi:
```bash
cd ~/Pahami-sehat
git checkout -- docs/prototipe/index.html docs/prototipe/css/style.css
rm docs/prototipe/assets/qr-pahami-sehat.png
```
⚠️ `git checkout` di atas **ikut membuang perubahanmu sendiri** di dua berkas itu — pakai hanya kalau itu memang yang diinginkan.

---

## 4. TEMUAN BARU: Tanya AI mengambil sumber yang tidak relevan

Dari tangkapan layar: pertanyaan "saya menderita gatal-gatal, kira-kira apa yg sedang terjadi"
dijawab dengan **sumber tentang OCD** (Wikipedia + PubMed 25150561), lalu model berkata jujur
"aku cuma punya info tentang OCD... belum ada jawaban untuk gatalmu".

### Akar masalah (sudah diuji)
`server/cari.js` → `cariWikipedia(q)` mengirim **seluruh kalimat pertanyaan** sebagai `gsrsearch`.
Hasil uji langsung ke API Wikipedia:

| Query yang dikirim | Hasil |
|---|---|
| `"saya menderita gatal-gatal, kira-kira apa yg sedang terjadi"` (utuh) | `Siproheptadin` — tidak nyambung |
| `"gatal-gatal"` (kata kunci saja) | `Daun gatal`, `Keputihan`, `Dermatitis atopik` |
| `"pruritus"` | `Dermatitis atopik`, `Biduran` |

Jadi **pencariannya tidak mengekstrak kata kunci** dari pertanyaan. Ini sisi lemah yang sebenarnya.

### Yang sudah bagus (jangan dirusak)
- Model **jujur**: tidak mengarang, ia menyatakan sumbernya tidak memuat info soal gatal.
- Ada fungsi penyaring relevansi di `cari.js` (~baris 248) yang memeriksa kata pada judul/isi.

### Arah perbaikan (belum dikerjakan)
1. Buang kata umum/pertanyaan ("saya", "kira-kira", "apa", "yang") sebelum mencari — sisakan kata isi.
2. Kalau hasil pencarian tidak memuat kata kunci pertanyaan, **jangan tampilkan sebagai "sumber jawaban"** —
   lebih jujur menyatakan "sumber tidak ditemukan" daripada menyodorkan topik lain.
3. Pertimbangkan memakai beberapa kata kunci (2–3 varian) lalu gabungkan hasilnya.

---

## 5. Berkas yang berubah (git status saat resume ini dibuat)

```
 M app/server/konten.js                       <- Hansel (perbaikan kartu Tips)
 M app/src/components/dashboard/HealthTip.jsx <- Hansel (perbaikan kartu Tips)
 M app/src/data/dummy.js                      <- Hansel (perbaikan kartu Tips)
 M docs/prototipe/index.html                  <- QR (Hansel) + perubahanmu sendiri
 M docs/prototipe/css/style.css               <- QR (Hansel) + perubahanmu sendiri
?? docs/prototipe/assets/qr-pahami-sehat.png  <- Hansel (baru)
 M app/src/App.jsx                            <- perubahanmu sendiri (sebelum sesi ini)
 M app/src/index.css                          <- perubahanmu sendiri
 M docs/prototipe/js/main.js                  <- perubahanmu sendiri
?? app/src/components/LoadingPage.jsx         <- perubahanmu sendiri (baru)
```

**Jangan `git add .`** — perbaikan Tips, QR, dan perubahanmu sendiri sebaiknya jadi commit terpisah.

---

## 6. Langkah berikutnya

1. **Uji panel Suara di Chrome** (menunggu kamu) — ini satu-satunya bukti yang sah untuk fitur itu.
2. **Push ke GitHub** supaya Vercel ikut memperbarui (perbaikan Tips + QR). Perintah siap:
   ```bash
   cd ~/Pahami-sehat
   git add app/server/konten.js app/src/components/dashboard/HealthTip.jsx app/src/data/dummy.js
   git commit -m "Perbaiki kartu Tips: buang teks tempelan, hentikan pemotongan tengah kata"
   git add docs/prototipe/index.html docs/prototipe/css/style.css docs/prototipe/assets/qr-pahami-sehat.png
   git commit -m "Tambah kartu QR di halaman penjelasan"
   git push
   ```
3. **Perbaiki pencarian Tanya AI** (bagian 4) — pilih dulu mau dikerjakan atau tidak.

---

## 7. Catatan operasional (jebakan yang sudah terbukti)

- **`npm start` harus dari `~/Pahami-sehat/app`**, bukan `~/Pahami-sehat` (tidak ada `package.json` di root).
- **Cache konten**: mengubah kode `susun()`/`isiArtikel()` **tidak** mengubah kartu selama sidik jari isi sama.
  `?paksa=1` hanya memaksa pencarian, bukan penyusunan ulang. Untuk melihat hasil kode baru:
  hentikan server → hapus `app/.cache-konten.json` → jalankan lagi. (Backup lama:
  `~/.cache/pahami-sehat/cache-konten-20261010-235312.json`)
- **`.env`** berisi `KENARI_API_KEY` (mode 600, gitignored). Key diambil dari `~/.hermes/.env`
  (variabel `HERMES_CUSTOM_KENARI_ID_API_KEY`). **Jangan pernah tempel key ke chat.**
- **Server yang dijalankan dari sesi agent menempel pada sesi itu.** Untuk presentasi jalankan sendiri:
  `cd ~/Pahami-sehat/app && npm start`, atau lewat jendela sendiri:
  `kitty -e bash ~/.cache/pahami-sehat/jalankan-app.sh`
- **Port 8787** hanya satu pemakai. Kalau `npm start` bilang port terpakai: `ss -tlnp | grep 8787`.
- Alamat: `/` halaman penjelasan · `/app/` aplikasi · `/prototipe/` salinan · `/api/...` backend.

---

## 8. Berkas bukti

| Berkas | Isi |
|---|---|
| `~/.cache/pahami-sehat/bukti-kartu-tips-sesudah.png` | kartu Tips setelah perbaikan |
| `~/.cache/pahami-sehat/qr-di-prototipe.png` | halaman penjelasan dengan kartu QR (desktop) |
| `~/.cache/pahami-sehat/qr-dari-halaman.png` | potongan QR yang di-crop dari halaman |
| `~/.cache/pahami-sehat/qr-ponsel.png` | tampilan ponsel (dari percobaan QR versi pertama) |
| `~/.cache/pahami-sehat/cache-konten-20261010-235312.json` | backup cache konten sebelum dihapus |
| `~/.cache/pahami-sehat/jalankan-app.sh` | skrip menjalankan app di jendela sendiri |
| `~/.cache/pahami-sehat/pasang-chrome.sh` | skrip pemasangan Chrome (sudah dijalankan) |
