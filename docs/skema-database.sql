-- ============================================================================
--  Pahami Sehat — Skema database
--  Dibuat: 15 Oktober 2026
--  Mesin: MySQL/MariaDB (XAMPP)
-- ============================================================================
--
--  ATURAN PALING PENTING DI FILE INI
--  ---------------------------------
--  Setiap tabel yang memuat informasi medis WAJIB punya kolom `kedaluwarsa`
--  yang NOT NULL. Alasannya bukan soal kerapian, tapi keselamatan:
--  panduan medis berubah. Kalau aplikasi menyajikan "dosis obat X = Y"
--  dari baris yang sudah kedaluwarsa, itu bukan bug teknis — itu risiko
--  kesehatan. Dengan kolom ini, kode bisa menolak menyajikan data basi
--  alih-alih diam-diam memakainya.
--
--  Prinsip kedua: yang disimpan adalah SALINAN BERLABEL TANGGAL, bukan
--  "kebenaran". Kolom url_sumber selalu ikut, supaya pengguna bisa
--  memeriksa sendiri ke sumber aslinya.
-- ============================================================================

CREATE DATABASE IF NOT EXISTS pahami_sehat
  CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

USE pahami_sehat;

-- ---------------------------------------------------------------------------
-- 1. KATALOG SUMBER RESMI
--    Daftar lembaga yang dianggap resmi. Diambil dari daftar di cari.js
--    supaya satu sumber kebenaran, tidak diduplikasi di dua tempat.
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS sumber (
  id          INT AUTO_INCREMENT PRIMARY KEY,
  domain      VARCHAR(120) NOT NULL,
  nama        VARCHAR(160) NOT NULL,
  jenis       ENUM('pemerintah','who','jurnal','lainnya') DEFAULT 'lainnya',
  resmi       TINYINT(1)   NOT NULL DEFAULT 1,
  catatan     VARCHAR(300) NULL,
  UNIQUE KEY uq_sumber_domain (domain)
) ENGINE=InnoDB;

-- ---------------------------------------------------------------------------
-- 2. DOKUMEN / HALAMAN YANG PERNAH DIAMBIL (sitasi)
--    Ini yang menjawab "sumber-sumber" yang diminta.
--    `sidik_isi` = hash isi halaman; dipakai untuk tahu dokumen BERUBAH
--    tanpa harus membandingkan seluruh teksnya.
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS dokumen (
  id            BIGINT AUTO_INCREMENT PRIMARY KEY,
  sumber_id     INT          NOT NULL,
  url           VARCHAR(700) NOT NULL,
  judul         VARCHAR(300) NULL,
  bahasa        CHAR(2)      NULL,
  diambil_pada  DATETIME     NOT NULL,
  sidik_isi     CHAR(64)     NULL,          -- sha256 isi teks
  kedaluwarsa   DATETIME     NOT NULL,      -- WAJIB (lihat aturan di atas)
  teks          MEDIUMTEXT   NULL,
  KEY idx_dokumen_url (url(255)),
  KEY idx_dokumen_kedaluwarsa (kedaluwarsa),
  CONSTRAINT fk_dokumen_sumber FOREIGN KEY (sumber_id) REFERENCES sumber(id)
) ENGINE=InnoDB;

-- ---------------------------------------------------------------------------
-- 3. SITASI — penghubung antara jawaban dan dokumen
--    Setiap kali AI menjawab, baris di sini mencatat dokumen mana yang
--    dipakai. Jadi klaim "jawaban ini bersumber dari Kemenkes" bisa
--    DILACAK, bukan cuma ditulis.
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS sitasi (
  id           BIGINT AUTO_INCREMENT PRIMARY KEY,
  jenis_jawaban ENUM('tanya','verifikasi','berita','sederhanakan') NOT NULL,
  rujukan_id   BIGINT     NULL,     -- id di tabel terkait (polymorphic)
  dokumen_id   BIGINT     NOT NULL,
  dipakai_pada DATETIME   NOT NULL,
  CONSTRAINT fk_sitasi_dokumen FOREIGN KEY (dokumen_id) REFERENCES dokumen(id)
) ENGINE=InnoDB;

-- ---------------------------------------------------------------------------
-- 4. KONTEN HARIAN (artikel & tips)
--    Menggantikan .cache-konten.json. Kolom `sidik` adalah fitur yang sudah
--    ada di kode: kalau sidik sama, konten TIDAK diperbarui dan tanggal
--    "diperbarui" tidak ikut berubah.
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS konten (
  id          INT AUTO_INCREMENT PRIMARY KEY,
  slug        VARCHAR(180) NOT NULL,
  kategori    VARCHAR(80)  NULL,
  judul       VARCHAR(300) NOT NULL,
  ringkas     TEXT         NULL,
  url_sumber  VARCHAR(700) NULL,
  gambar      VARCHAR(700) NULL,
  sidik       CHAR(64)     NULL,
  diperiksa   DATETIME     NULL,
  diperbarui  DATETIME     NULL,
  aktif       TINYINT(1)   NOT NULL DEFAULT 1,
  UNIQUE KEY uq_konten_slug (slug),
  KEY idx_konten_sidik (sidik)
) ENGINE=InnoDB;

-- ---------------------------------------------------------------------------
-- 5. BERITA HARIAN
--    Menggantikan .cache-berita.json.
--    `sidik` UNIQUE supaya berita yang sama tidak masuk dua kali.
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS berita (
  id        BIGINT AUTO_INCREMENT PRIMARY KEY,
  judul     VARCHAR(300) NOT NULL,
  sumber    VARCHAR(120) NULL,
  url       VARCHAR(700) NULL,
  terbit    DATETIME     NULL,
  diambil   DATETIME     NOT NULL,
  kategori  VARCHAR(80)  NULL,
  sidik     CHAR(64)     NOT NULL,
  UNIQUE KEY uq_berita_sidik (sidik),
  KEY idx_berita_diambil (diambil)
) ENGINE=InnoDB;

-- ---------------------------------------------------------------------------
-- 6. PENGETAHUAN MEDIS
--    ⚠️  TABEL INI YANG PALING BERISIKO.
--    Rancangannya SENGAJA dibatasi:
--      - HANYA untuk menyimpan salinan berlabel tanggal + tautan sumber.
--      - BUKAN pengganti sumber resmi.
--      - `kedaluwarsa` NOT NULL dan sengaja PENDEK (mis. 30 hari), karena
--        panduan medis bisa berubah lebih cepat daripada dokumen umum.
--    Kode WAJIB menolak menyajikan baris yang sudah lewat kedaluwarsa dan
--    mengambil ulang dari sumber resmi.
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS pengetahuan (
  id           BIGINT AUTO_INCREMENT PRIMARY KEY,
  topik        VARCHAR(200) NOT NULL,
  jenis        ENUM('penyakit','obat','gejala','prosedur','istilah') NOT NULL,
  isi          MEDIUMTEXT   NOT NULL,
  ringkas      TEXT         NULL,
  sumber_id    INT          NOT NULL,
  url_sumber   VARCHAR(700) NOT NULL,
  diambil_pada DATETIME     NOT NULL,
  kedaluwarsa  DATETIME     NOT NULL,       -- pendek, sengaja
  sidik        CHAR(64)     NULL,
  KEY idx_pengetahuan_topik (topik),
  KEY idx_pengetahuan_kedaluwarsa (kedaluwarsa),
  CONSTRAINT fk_pengetahuan_sumber FOREIGN KEY (sumber_id) REFERENCES sumber(id)
) ENGINE=InnoDB;

-- ---------------------------------------------------------------------------
-- 7. TIDAK ADA TABEL AKUN
--    Aplikasi ini tidak punya akun, tidak punya halaman masuk, dan tidak
--    menyimpan identitas siapa pun. Riwayat obrolan, jawaban kuesioner, dan
--    setelan tinggal di localStorage peramban pengguna.
--
--    Tabel akun versi lama (pengguna, setelan, riwayat) DIHAPUS dari skema ini.
--    Kalau database di komputer ini masih menyimpannya dari pemasangan
--    sebelumnya, ketiga perintah di bawah membersihkannya. Aman dijalankan
--    berulang kali; tidak menyentuh tabel bahan (sumber, dokumen, sitasi,
--    konten, berita, pengetahuan) MAUPUN tabel percakapan di nomor 8.
-- ---------------------------------------------------------------------------
DROP TABLE IF EXISTS riwayat;
DROP TABLE IF EXISTS setelan;
DROP TABLE IF EXISTS pengguna;

-- ---------------------------------------------------------------------------
-- 8. PERCAKAPAN — konteks untuk pertanyaan lanjutan
--    ⚠️  TABEL INI MEMUAT TEKS YANG DIKETIK PENGGUNA. Baca batasnya dulu.
--
--    KENAPA ADA: tanpa konteks, pertanyaan lanjutan seperti "terus gimana
--    udah terlanjur nih" dicari dengan kata kuncinya sendiri, tidak menemukan
--    sumber, dan dijawab generik — percakapan terasa tidak nyambung.
--
--    BATAS YANG DISENGAJA:
--      - HANYA teks giliran percakapan. Tidak ada nama, tidak ada alamat IP,
--        tidak ada sidik peramban, tidak ada akun.
--      - `id_sesi` adalah tanda pengenal ACAK yang dibuat peramban pengguna
--        sendiri, bukan identitas orang.
--      - UMURNYA PENDEK: baris lebih tua dari 7 hari dihapus oleh
--        `bersihkanPercakapan()` di db.js. Ini konteks, bukan arsip.
--      - TIDAK ADA kolom `kedaluwarsa` di sini, dan itu bukan kelalaian:
--        aturan `kedaluwarsa` berlaku untuk INFORMASI MEDIS yang bisa basi.
--        Percakapan bukan bahan medis — ia hanya dipakai sebagai konteks
--        percakapan, dan jawaban tetap disusun dari sumber yang diambil segar.
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS percakapan (
  id        BIGINT AUTO_INCREMENT PRIMARY KEY,
  id_sesi   VARCHAR(64)  NOT NULL,
  peran     ENUM('pengguna','aplikasi') NOT NULL,
  teks      MEDIUMTEXT   NOT NULL,
  dibuat    DATETIME     NOT NULL,
  KEY idx_percakapan_sesi (id_sesi, id),
  KEY idx_percakapan_dibuat (dibuat)
) ENGINE=InnoDB;

-- ---------------------------------------------------------------------------
-- 9. ISI AWAL — daftar sumber resmi (dari cari.js)
-- ---------------------------------------------------------------------------
INSERT INTO sumber (domain, nama, jenis, resmi) VALUES
  ('kemkes.go.id',                'Kementerian Kesehatan RI',       'pemerintah', 1),
  ('kemenkes.go.id',              'Kementerian Kesehatan RI',       'pemerintah', 1),
  ('sehatnegeriku.kemkes.go.id',  'Sehat Negeriku (Kemenkes)',      'pemerintah', 1),
  ('ayosehat.kemkes.go.id',       'Ayo Sehat (Kemenkes)',           'pemerintah', 1),
  ('p2p.kemkes.go.id',            'P2P Kemenkes',                   'pemerintah', 1),
  ('pom.go.id',                   'BPOM RI',                        'pemerintah', 1),
  ('who.int',                     'WHO',                            'who',        1),
  ('nih.gov',                     'NIH (AS)',                       'pemerintah', 1),
  ('ncbi.nlm.nih.gov',            'NCBI',                           'jurnal',     1),
  ('pubmed.ncbi.nlm.nih.gov',     'PubMed',                         'jurnal',     1),
  ('medlineplus.gov',             'MedlinePlus (NIH)',              'pemerintah', 1),
  ('cdc.gov',                     'CDC (AS)',                       'pemerintah', 1)
ON DUPLICATE KEY UPDATE nama = VALUES(nama);

-- ============================================================================
--  Tabel fitur Fasilitas Kesehatan (4 Nov 2026)
--  Ditambahkan untuk: pemilihan wilayah administratif, penyimpanan fasilitas,
--  dan halaman detail. Tabel lama TIDAK diubah.
-- ============================================================================

-- ---------------------------------------------------------------------------
-- 8. WILAYAH ADMINISTRATIF
--    Diisi bertahap dari wilayah.id (data BPS/Kemendagri). Kode dipakai sebagai
--    primary key karena hubungan antarwilayah ditentukan oleh KODE, bukan nama
--    (nama bisa berubah dan tidak unik; banyak "Sukamaju").
--
--    kode_induk menunjuk baris di tabel yang sama: provinsi tanpa induk,
--    kabupaten -> provinsi, kecamatan -> kabupaten, desa -> kecamatan.
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS wilayah (
  kode        VARCHAR(16)  NOT NULL,
  nama        VARCHAR(120) NOT NULL,
  tingkat     ENUM('provinsi','kabupaten','kecamatan','desa') NOT NULL,
  kode_induk  VARCHAR(16)  NULL,
  diperbarui  DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP
                           ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (kode),
  KEY idx_wilayah_induk (kode_induk),
  KEY idx_wilayah_tingkat (tingkat),
  CONSTRAINT fk_wilayah_induk FOREIGN KEY (kode_induk)
    REFERENCES wilayah (kode) ON DELETE RESTRICT
) ENGINE=InnoDB;

-- ---------------------------------------------------------------------------
-- 9. KATEGORI FASILITAS
--    Diisi dari daftar KATEGORI di app/server/faskes.js supaya satu sumber
--    kebenaran. Jangan disalin manual ke sini.
-- ---------------------------------------------------------------------------
-- id sengaja SMALLINT, bukan TINYINT:
-- `INSERT ... ON DUPLICATE KEY UPDATE` tetap MEMAKAI satu angka AUTO_INCREMENT
-- setiap kali kuncinya sudah ada, jadi jatah 0..255 habis setelah 255 kali
-- penyimpanan — bukan setelah 255 kategori dibuat. Terukur 4 Nov 2026: tabel
-- berisi 10 baris tetapi AUTO_INCREMENT sudah 256, dan SETIAP penyimpanan
-- fasilitas baru gagal dengan HA_ERR_AUTOINC_ERANGE (errno 167).
CREATE TABLE IF NOT EXISTS kategori_fasilitas (
  id     SMALLINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  kode   VARCHAR(40)  NOT NULL,
  label  VARCHAR(80)  NOT NULL,
  UNIQUE KEY uq_kategori_kode (kode)
) ENGINE=InnoDB;

-- ---------------------------------------------------------------------------
-- 10. FASILITAS KESEHATAN
--     HASIL PEMETAAN OSM yang disimpan, BUKAN kebenaran. Kolom sumber dan
--     url_sumber selalu ikut supaya pengguna bisa memeriksa aslinya.
--
--     kedaluwarsa mengikuti aturan proyek (lihat kepala berkas ini): baris yang
--     lewat tanggal ini TIDAK disajikan. Jam operasional yang basi bisa membuat
--     orang datang ke fasilitas yang sudah tutup — itu risiko nyata, bukan
--     kerapian.
--
--     Kolom yang tidak diketahui bernilai NULL. JANGAN diisi tebakan.
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS fasilitas (
  id                BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  kode_osm          VARCHAR(40)   NOT NULL,   -- mis. "way/500318061"
  nama              VARCHAR(200)  NOT NULL,
  -- Tipenya WAJIB sama dengan kategori_fasilitas.id (SMALLINT), karena kolom
  -- ini dipakai sebagai foreign key ke sana. MySQL menolak FK yang tipenya
  -- berbeda — errno 150 "Foreign key constraint is incorrectly formed".
  kategori_id       SMALLINT UNSIGNED NOT NULL,
  subkategori       VARCHAR(80)   NULL,
  alamat            VARCHAR(400)  NULL,
  kode_desa         VARCHAR(16)   NULL,
  lat               DECIMAL(10,7) NOT NULL,
  lon               DECIMAL(10,7) NOT NULL,
  telepon           VARCHAR(120)  NULL,
  email             VARCHAR(160)  NULL,
  website           VARCHAR(400)  NULL,
  jam_operasional   VARCHAR(200)  NULL,
  layanan           VARCHAR(400)  NULL,
  igd               TINYINT(1)    NULL,       -- NULL = tidak diketahui
  buka_24_jam       TINYINT(1)    NOT NULL DEFAULT 0,
  foto_url          VARCHAR(500)  NULL,
  sumber            VARCHAR(60)   NOT NULL DEFAULT 'OpenStreetMap',
  url_sumber        VARCHAR(500)  NULL,
  status_verifikasi ENUM('belum','terverifikasi','perlu_dicek')
                                  NOT NULL DEFAULT 'belum',
  diperbarui        DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP
                                  ON UPDATE CURRENT_TIMESTAMP,
  diperiksa_pada    DATETIME      NULL,
  kedaluwarsa       DATETIME      NOT NULL,
  UNIQUE KEY uq_fasilitas_osm (kode_osm),
  KEY idx_fasilitas_kategori (kategori_id),
  KEY idx_fasilitas_desa (kode_desa),
  KEY idx_fasilitas_titik (lat, lon),
  KEY idx_fasilitas_kedaluwarsa (kedaluwarsa),
  CONSTRAINT fk_fasilitas_kategori FOREIGN KEY (kategori_id)
    REFERENCES kategori_fasilitas (id) ON DELETE RESTRICT
) ENGINE=InnoDB;

-- ---------------------------------------------------------------------------
-- 11. STATISTIK FASILITAS NASIONAL
--     Angka acuan dari laporan resmi — BUKAN hasil pemetaan OSM dan BUKAN
--     tambahan dari tabel `fasilitas`. Keduanya menjawab pertanyaan berbeda:
--     `fasilitas` = titik yang berhasil dipetakan, tabel ini = jumlah menurut
--     laporan lembaga.
--
--     PERINGATAN: angka Kemenkes 2024 (total 49.548) adalah jumlah fasilitas
--     yang SUDAH MENGIMPLEMENTASIKAN sistem data dan aplikasi kesehatan pada
--     enam kategori — bukan jumlah seluruh fasilitas kesehatan nasional.
--     Karena itu kalimat cakupan WAJIB ikut tersimpan di setiap baris: angka
--     tanpa cakupan gampang dikutip sebagai "total faskes Indonesia".
--
--     Angka BPJS adalah pembanding dengan cara hitung berbeda; jangan
--     dijumlahkan dengan angka Kemenkes.
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS statistik_faskes (
  id            INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  lembaga       VARCHAR(80)  NOT NULL,   -- 'Kemenkes' / 'BPJS Kesehatan'
  periode       VARCHAR(30)  NOT NULL,   -- '2024' / 'September 2026'
  jenis         VARCHAR(80)  NOT NULL,   -- 'Puskesmas', 'FKTP', ...
  jumlah        INT UNSIGNED NOT NULL,
  cakupan       VARCHAR(300) NOT NULL,   -- apa yang sebenarnya dihitung
  -- Padanan kategori peta OSM; NULL kalau laporan ini tidak punya padanannya
  -- (mis. unit transfusi darah tidak dipetakan sebagai kategori tersendiri).
  kode_kategori VARCHAR(40)  NULL,
  catatan       VARCHAR(200) NULL,
  dicatat       DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP
                             ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uq_statistik (lembaga, periode, jenis),
  KEY idx_statistik_lembaga (lembaga, periode)
) ENGINE=InnoDB;

-- ---------------------------------------------------------------------------
-- 12. SUMBER DATA RESMI UNTUK PENGEMBANGAN
--     Daftar rujukan yang dipakai mengembangkan aplikasi (profil kesehatan,
--     portal data, aplikasi DFO). Bukan pengganti tabel `sumber`: `sumber`
--     dipakai untuk mengutip isi jawaban medis, tabel ini untuk mencatat
--     bahan acuan data fasilitas.
--
--     tautan dibiarkan NULL kalau alamat pastinya belum diperiksa — menebak
--     URL resmi lebih buruk daripada mengosongkannya.
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS sumber_data_faskes (
  id       INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  nama     VARCHAR(160) NOT NULL,
  penerbit VARCHAR(120) NOT NULL,
  jenis    VARCHAR(40)  NOT NULL,   -- 'profil' / 'statistik' / 'dashboard'
  data     VARCHAR(200) NULL,       -- apa yang tersedia di sumber ini
  tautan   VARCHAR(400) NULL,
  catatan  VARCHAR(300) NULL,
  dicatat  DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY uq_sumber_data (nama)
) ENGINE=InnoDB;
