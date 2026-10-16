-- ============================================================================
--  Pahami Sehat — Skema AKUN (login)
--  Dibuat: 16 Oktober 2026
--  Mesin: MySQL/MariaDB (XAMPP)
-- ============================================================================
--
--  ATURAN PALING PENTING DI FILE INI
--  ---------------------------------
--  SIMPAN SESEDIKIT MUNGKIN. Yang disimpan hanya yang benar-benar dipakai
--  untuk masuk dan menyapa:
--
--      email ATAU telepon   -> untuk masuk
--      nama_pengguna        -> untuk sapaan "Halo Bayu!"
--      sandi_hash + salt    -> untuk memeriksa kata sandi
--      google_id            -> kalau masuk lewat Google
--
--  Yang SENGAJA TIDAK ADA di sini (dan tidak boleh ditambahkan tanpa
--  persetujuan jagi): nama lengkap, NIK, tanggal lahir, alamat, foto,
--  jenis kelamin, nomor rekam medis. Aplikasi ini bahkan sudah memperingatkan
--  pengguna agar tidak menuliskan data seperti itu di dalam pertanyaan —
--  jadi menyimpannya di akun akan bertentangan dengan peringatan sendiri.
--
--  KATA SANDI TIDAK PERNAH DISIMPAN APA ADANYA. Yang disimpan adalah hasil
--  scrypt (hash) + salt acak per-pengguna. Bahkan kalau seluruh isi tabel ini
--  terbaca, kata sandinya tidak bisa dipakai untuk masuk. Jangan pernah
--  mengganti ini dengan SHA/MD5 — keduanya terlalu cepat sehingga bisa
--  dipecah dengan menebak.
--
--  Jalankan ulang file ini AMAN (idempoten).
-- ============================================================================

USE pahami_sehat;

-- ---------------------------------------------------------------------------
-- 1. TABEL PENGGUNA
--    Menggantikan tabel `pengguna` versi lama yang hanya punya token_sesi.
--    Versi lama TIDAK punya akun sama sekali (token acak per peramban), jadi
--    tidak ada datanya yang perlu dipindahkan.
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS pengguna_baru (
  id            INT AUTO_INCREMENT PRIMARY KEY,

  -- Identitas untuk masuk. SALAH SATU boleh kosong, tidak keduanya.
  -- Ditulis dalam bentuk sudah dinormalkan (huruf kecil, tanpa spasi) supaya
  -- "Budi@Mail.com " dan "budi@mail.com" dianggap akun yang sama.
  email         VARCHAR(190) NULL,
  telepon       VARCHAR(20)  NULL,

  -- Nama panggilan untuk sapaan di Beranda. Bukan nama lengkap.
  nama_pengguna VARCHAR(40)  NULL,

  -- Kata sandi: hash scrypt (128 hex char = 64 byte) + salt acak 32 hex char.
  -- Keduanya NULL kalau pengguna HANYA masuk lewat Google.
  sandi_hash    CHAR(128)    NULL,
  sandi_salt    CHAR(32)     NULL,

  -- Kalau masuk lewat Google. Disimpan sebagai teks karena ID Google bukan
  -- angka yang aman dianggap bilangan.
  google_id     VARCHAR(64)  NULL,

  dibuat        DATETIME     NOT NULL,
  terakhir      DATETIME     NULL,

  -- Email/telepon harus unik supaya tidak ada dua akun untuk alamat yang sama.
  -- NULL dianggap berbeda di MySQL, jadi baris tanpa email tetap boleh banyak.
  UNIQUE KEY uq_pengguna_email   (email),
  UNIQUE KEY uq_pengguna_telepon (telepon),
  UNIQUE KEY uq_pengguna_google  (google_id),

  -- Setiap akun HARUS punya minimal satu cara masuk. Ini ditegakkan database,
  -- bukan hanya kode — supaya tidak mungkin ada baris "akun tanpa identitas".
  CONSTRAINT ck_pengguna_ada_identitas
    CHECK (email IS NOT NULL OR telepon IS NOT NULL OR google_id IS NOT NULL)
) ENGINE=InnoDB;

-- ---------------------------------------------------------------------------
-- 2. TABEL SESI
--    Satu akun boleh punya BANYAK sesi — itulah yang membuat pengguna bisa
--    masuk dari HP dan laptop sekaligus.
--
--    Yang disimpan adalah HASH token, bukan tokennya. Alasannya: kalau isi
--    tabel ini terbaca (mis. backup bocor), token yang ada di situ TIDAK bisa
--    dipakai untuk masuk. Sama prinsipnya dengan kata sandi.
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS sesi (
  id           BIGINT AUTO_INCREMENT PRIMARY KEY,
  pengguna_id  INT         NOT NULL,
  token_hash   CHAR(64)    NOT NULL,   -- sha256(token) dalam hex
  dibuat       DATETIME    NOT NULL,
  terakhir     DATETIME    NULL,
  kedaluwarsa  DATETIME    NOT NULL,   -- sesi lama tidak boleh berlaku selamanya
  agen         VARCHAR(200) NULL,      -- keterangan peramban, untuk pengguna sendiri
  UNIQUE KEY uq_sesi_token (token_hash),
  KEY idx_sesi_pengguna (pengguna_id),
  KEY idx_sesi_kedaluwarsa (kedaluwarsa),
  CONSTRAINT fk_sesi_pengguna FOREIGN KEY (pengguna_id) REFERENCES pengguna_baru(id) ON DELETE CASCADE
) ENGINE=InnoDB;

-- ---------------------------------------------------------------------------
-- 3. RIWAYAT per pengguna
--    Menggantikan penyimpanan di localStorage. Pertanyaan tetap TIDAK
--    disimpan apa adanya untuk keperluan analitik — ini murni supaya
--    pengguna sendiri bisa melanjutkan obrolannya dari perangkat lain.
--
--    CATATAN NAMA: constraint-nya diberi akhiran `_baru` karena nama
--    `fk_riwayat_pengguna` SUDAH DIPAKAI tabel `riwayat` versi lama. Nama
--    constraint harus unik per-database di MariaDB, bukan per-tabel —
--    kesalahan ini sempat membuat CREATE TABLE gagal (errno 121).
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS riwayat_pengguna (
  id           BIGINT AUTO_INCREMENT PRIMARY KEY,
  pengguna_id  INT         NOT NULL,
  sesi_id      VARCHAR(64) NOT NULL,   -- id sesi obrolan dari aplikasi
  judul        VARCHAR(200) NULL,
  dibuat       DATETIME    NOT NULL,
  diperbarui   DATETIME    NOT NULL,
  isi          MEDIUMTEXT  NULL,       -- daftar pesan (JSON), milik pengguna sendiri
  UNIQUE KEY uq_riwayat_pengguna (pengguna_id, sesi_id),
  KEY idx_riwayat_pengguna_baru (pengguna_id, diperbarui),
  CONSTRAINT fk_riwayat_pengguna_baru FOREIGN KEY (pengguna_id) REFERENCES pengguna_baru(id) ON DELETE CASCADE
) ENGINE=InnoDB;
