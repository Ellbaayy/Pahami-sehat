# Impor Rumah Sakit Nasional — SIRS Kemenkes → MySQL XAMPP

Laporan implementasi, 4 November 2026.

## 1. Sumber data yang digunakan

**SIRS Kementerian Kesehatan RI** — `https://sirs.kemkes.go.id/fo/home/rekap_rs_all?id=0`.

Endpoint itu **bukan halaman HTML**, melainkan **JSON resmi** yang dipakai dashboard
SIRS sendiri:

```json
{"label":"List Rumah Sakit (Nasional)",
 "data":[{"kode":"1171145","nama":"RS Umum Meutia","nama_prop":"Aceh",
          "kab":"Kota Banda Aceh","alamat":"Jl. Cut Meutia No. 55",
          "TELEPON":"082268292278","pemilik":"SWASTA/LAINNYA",
          "kelas":"D","jenis":"RSU"}, ...]}
```

Karena sumbernya sudah JSON resmi, **tidak ada HTML yang diurai** dan tidak ada
selektor rapuh.

Pembanding independen (dipakai untuk memvalidasi kelengkapan tarikan):
`rekap_by_jenis?id=0`, `rekap_by_kelas?id=0`, `rekap_by_kepemilikan?id=0`.
Ketiganya dijumlahkan oleh SIRS sendiri dan harus sama dengan hasil hitung lokal.

**SATUSEHAT** diperiksa dan **tidak dipakai**: `api-satusehat.kemkes.go.id/fhir-r4/v1/Organization`
menjawab **HTTP 401** — butuh kredensial resmi yang tidak dimiliki tim.

## 2. Metode pengambilan

1. `rekap_rs_all?id=0` → **3.325 rumah sakit nasional dalam satu tarikan**, tanpa
   pagination. Jadi tidak ada halaman yang terlewat karena lupa "halaman terakhir".
2. Tiga endpoint rekap resmi diambil sebagai pembanding.
3. Validasi bentuk minimum: baris tanpa `kode` atau `nama` **dibuang dan
   dilaporkan**, bukan disimpan dengan kode karangan.
4. Upsert per batch 200 baris, dengan penghitungan `baru` / `diubah` / `tetap` /
   `gagal` dari keadaan database sebenarnya (bukan ditebak dari hasil upsert).
5. Sinkronisasi ulang menandai `hilang_pada` untuk RS yang tidak lagi muncul —
   **tidak dihapus**.
6. Retry 4 kali dengan backoff untuk setiap permintaan; balasan non-JSON ditolak
   (SIRS membalas halaman galat CodeIgniter dengan status 200 pada parameter yang
   salah).

## 3. Tabel database

Tabel yang **sudah ada** dipakai ulang: `fasilitas`, `kategori_fasilitas`, `wilayah`.
**Tidak ada tabel baru untuk data** dan **tidak ada DROP TABLE / DROP COLUMN**.

Migrasi: `docs/migrasi-sirs.sql` (idempoten, dijaga `information_schema`).

| Perubahan | Alasan |
|---|---|
| `kode_rs VARCHAR(24)` + `UNIQUE` | identifier resmi SIRS; tanpa ini setiap sinkronisasi menyisipkan ulang 3.325 baris |
| `kode_osm` → boleh NULL | baris SIRS tidak punya kode OSM |
| `lat`/`lon` → boleh NULL | **SIRS tidak menyediakan koordinat sama sekali** |
| `jenis_rs`, `kelas_rs`, `kepemilikan`, `status_operasional` | atribut rumah sakit |
| `provinsi`, `kabupaten`, `kecamatan`, `kelurahan`, `kode_provinsi`, `kode_kabupaten` | wilayah administratif (nama **dan** kode) |
| `sumber_diperbarui`, `disinkron_pada`, `hilang_pada` | jejak sinkronisasi |
| tabel `sinkron_fasilitas` | log setiap tarikan, termasuk yang **gagal** |
| tabel `catatan_sumber` | fakta "sumber ini tidak punya koordinat", disimpan di DB |
| tabel `cakupan_faskes` | mencatat bahwa suatu titik+radius sudah diambil **lengkap** |

## 4. Hasil

| Ukuran | Jumlah |
|---|---|
| Ditemukan di sumber | **3.325** |
| Berhasil disimpan | **3.325** |
| Gagal | **0** |
| Duplikat | **0** (3.325 baris / 3.325 kode unik) |
| Dibuang karena kode/nama kosong | **0** |
| Punya koordinat | **0** |
| Tanpa koordinat | **3.325** |
| Punya kode kabupaten | **3.325** |

Semua rumah sakit punya kode wilayah; **513 dari 513** pasangan provinsi+kabupaten
SIRS berhasil dipetakan ke kode wilayah resmi BPS.

Distribusi cocok **persis** dengan rekap resmi SIRS:

| Kelas | Jumlah | | Jenis | Jumlah |
|---|---|---|---|---|
| A | 86 | | RSU | 2.828 |
| B | 451 | | RSIA | 296 |
| C | 1.826 | | RSK Jiwa | 42 |
| D | 872 | | RSK Mata | 42 |
| D PRATAMA | 85 | | RSK GM | 36 |
| Non Kelas | 4 | | RSK Bedah | 31 |
| Belum Ditetapkan | 1 | | (dan 9 jenis lain) | |

Lima provinsi terbanyak: Jawa Timur 449, Jawa Barat 443, Jawa Tengah 375,
Sumatera Utara 206, DKI Jakarta 201.

## 5. Yang TIDAK tersedia di sumber (dan karena itu NULL)

Diperiksa, bukan diasumsikan:

- **Koordinat** — tidak ada di daftar nasional, tidak ada di halaman
  `profile_rs/<kode>`, dan JS peta SIRS (`mapgeo/koordinat`) hanya berisi
  **poligon provinsi** (38 feature MultiPolygon), bukan titik RS.
- **Kecamatan, kelurahan, email, website** — tidak ada di daftar maupun profil.
- **Status operasional** — tidak disediakan sebagai field. Kolomnya NULL; status
  "tidak lagi ditemukan" dicatat lewat `hilang_pada`.

Semuanya NULL — **tidak dikarang** dari alamat.

## 6. Integrasi ke fitur pencarian

Dua tab di halaman **Fasilitas Kesehatan Terdekat**:

**Tab "Fasilitas Terdekat"** — radius di sekitar satu titik (Leaflet/OpenStreetMap).
Diperbaiki hari ini: hasil **tidak lagi dipotong**. Terukur: Jakarta Pusat radius
5 km sebelumnya selalu berhenti di **600** (batas keras `MAKS_HASIL`), dan
`dipotong` bernilai `false` karena bendera itu membandingkan angka yang salah.
Sekarang batas 5.000, `dipotong` berisi **jumlah** yang tidak ikut, dan diukur
ulang: **743 fasilitas** tampil, 743 kartu dirender, `dipotong: 0`.

Juga diperbaiki: daftar dulu dirender `slice(0, 80)` sementara penghitung menulis
angka penuh — pengguna yang menggulir sampai bawah menyimpulkan hanya ada 80.
Sekarang **seluruh** hasil dirender.

**Simpanan** hanya dipakai sebagai jawaban akhir kalau `cakupan_faskes` mencatat
titik+radius itu pernah diambil **lengkap**. Sebelumnya, adanya 3 baris di DB
membuat setiap permintaan berhenti di 3 baris itu dan Overpass tidak pernah
dipanggil. Kalau Overpass gagal, isi DB dikirim dengan penanda
`dariSimpanan: true` + `sebagian: true` dan tombol coba lagi.

**Tab "Rumah Sakit Nasional"** — 3.325 RS resmi, dengan filter:

| Filter | Sumber pilihan |
|---|---|
| Nama / alamat | pencarian bebas, wildcard di-escape |
| Provinsi | 38, dari database |
| Kabupaten/Kota | 513, **mengikuti provinsi** (bertingkat) |
| Jenis | RSU, RSIA, RSK … (16) |
| Kelas | A, B, C, D, D PRATAMA, … (7) |
| Kepemilikan | Pemprop, Pemkab, TNI AD, SWASTA … (19) |

Paginasi 25 baris/halaman. RS tanpa koordinat diberi keterangan
"Tanpa koordinat" dan **tidak** ditampilkan di peta — batas itu ditulis di
bawah daftar, bukan disembunyikan.

## 7. Cara menjalankan

```bash
# 1. XAMPP hidup
sudo /opt/lampp/lampp startmysql

# 2. migrasi (sekali saja, idempoten)
/opt/lampp/bin/mysql -u root < docs/migrasi-sirs.sql

# 3. wilayah (sekali saja; 38 provinsi + 514 kabupaten)
node isi-wilayah.mjs

# 4. impor / sinkronisasi ulang
node impor-sirs.mjs              # impor penuh, aman diulang
node impor-sirs.mjs --kering     # tarik + bandingkan, tanpa menulis DB
node impor-sirs.mjs --batas 500  # uji dengan sebagian data

# 5. petakan nama wilayah SIRS -> kode wilayah resmi
node petakan-wilayah.mjs

# 6. uji
node uji-rs-sirs.mjs             # 50 pemeriksaan
```

Urutan 3 → 4 → 5 penting: `petakan-wilayah.mjs` butuh `wilayah` terisi **dan**
`fasilitas` sudah diimpor.

`--profil` mengambil halaman profil tiap RS (3.325 permintaan, jeda 1,2 detik)
untuk melengkapi status BLU. Tidak dipakai pada impor ini.

## 8. Pengujian

`uji-rs-sirs.mjs` — **50 pemeriksaan, semua lulus**:

- normalisasi nama: 12 kasus, termasuk pemisahan kota vs kabupaten
  ("Bekasi" ≠ "Kota Bekasi", "Kab. Bandung" = "Kabupaten Bandung")
- jumlah & keunikan: 3.325 baris, 3.325 kode, 0 kosong
- wilayah: semua punya kode provinsi & kabupaten, 0 yatim, provinsi konsisten
  dengan kabupatennya, tidak ada kabupaten masuk jenis yang salah
- koordinat: 0 berkoordinat untuk SIRS, 0 di luar Indonesia
- distribusi: 5 kelas + 2 jenis cocok persis dengan rekap resmi
- sinkronisasi: ulang tidak menambah baris, tanpa kegagalan
- filter: total cocok `COUNT(*)`, provinsi Jawa Timur 449, kelas A 86,
  pencarian nama, wildcard `%` tidak cocok ke semua, halaman tidak tumpang tindih

Gerbang `npm test`: **25 berkas, 0 gagal**.

## 9. Kendala yang disebut terbuka

- **Overpass publik sering penuh.** Diukur hari ini: `502 Gateway Timeout — "This
  Overpass API server is currently at capacity. All query workers are busy and
  the request queue is full."` Saat itu terjadi, jawabannya 503 + tombol coba
  lagi, atau isi DB bertanda "sebagian" — bukan peta kosong yang terlihat
  meyakinkan.
- **Muat pertama tab Terdekat 45–55 detik** (batas layanan publik, bukan kode).
  Sesudahnya 62 ms dari MySQL.
- **Tab Nasional tidak punya peta.** Bukan kekurangan yang ditutupi: SIRS memang
  tidak menerbitkan koordinat.
- **Data SIRS bergantung pada pembaruan Kemenkes.** Sinkronisasi ulang kapan pun
  diperlukan; angka di laporan ini adalah keadaan 4 November 2026.
