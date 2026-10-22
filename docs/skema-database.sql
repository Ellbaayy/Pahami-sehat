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
