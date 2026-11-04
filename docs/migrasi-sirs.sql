-- =============================================================================
-- Migrasi 4 Nov 2026 — rumah sakit resmi Kemenkes (SIRS) masuk tabel `fasilitas`
-- =============================================================================
-- Tujuan: tabel `fasilitas` yang sudah dipakai fitur Fasilitas Kesehatan
-- Terdekat dipakai ULANG untuk data resmi SIRS Kemenkes. Tidak ada tabel baru
-- selain log sinkronisasi, dan TIDAK ADA DROP TABLE / DROP COLUMN.
--
-- Kenapa perlu migrasi sama sekali: skema lama dibuat khusus untuk
-- OpenStreetMap, dan dua asumsinya tidak berlaku untuk data SIRS yang terukur
-- 4 Nov 2026:
--
--   1. `kode_osm` NOT NULL dan unik. SIRS memakai kode rumah sakit sendiri
--      (mis. 1171015), bukan "way/500318061". Tanpa kolom kode resmi, setiap
--      sinkronisasi akan menyisipkan ulang 3.325 baris.
--   2. `lat`/`lon` NOT NULL. SIRS TIDAK menyediakan koordinat sama sekali —
--      diperiksa di daftar nasional, di halaman profil RS, dan di seluruh JS
--      halaman peta (yang hanya berisi poligon provinsi). Membuatnya NOT NULL
--      berarti memaksa mengarang koordinat, persis yang dilarang.
--
-- Aman dijalankan berulang: setiap perubahan dijaga pemeriksaan
-- information_schema, jadi tidak perlu tahu keadaan awal tabelnya.
--
-- Jalankan: /opt/lampp/bin/mysql -u root < docs/migrasi-sirs.sql
-- =============================================================================

USE pahami_sehat;

-- -----------------------------------------------------------------------------
-- 1. Kode rumah sakit resmi (identifier eksternal dari sumber)
-- -----------------------------------------------------------------------------
SET @ada := (SELECT COUNT(*) FROM information_schema.COLUMNS
             WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'fasilitas'
               AND COLUMN_NAME = 'kode_rs');
SET @sql := IF(@ada = 0,
  'ALTER TABLE fasilitas ADD COLUMN kode_rs VARCHAR(24) NULL AFTER kode_osm,
   ADD UNIQUE KEY uq_fasilitas_kode_rs (kode_rs)',
  'DO 0');
PREPARE s FROM @sql; EXECUTE s; DEALLOCATE PREPARE s;

-- -----------------------------------------------------------------------------
-- 2. `kode_osm` boleh NULL — baris SIRS tidak punya kode OSM
-- -----------------------------------------------------------------------------
-- NULL berulang diizinkan MySQL untuk UNIQUE, jadi `uq_fasilitas_osm` tetap
-- mencegah duplikat OSM tanpa memaksa baris SIRS punya kode palsu.
ALTER TABLE fasilitas MODIFY COLUMN kode_osm VARCHAR(40) NULL;

-- -----------------------------------------------------------------------------
-- 3. Koordinat boleh NULL
-- -----------------------------------------------------------------------------
ALTER TABLE fasilitas
  MODIFY COLUMN lat DECIMAL(10,7) NULL,
  MODIFY COLUMN lon DECIMAL(10,7) NULL;

-- -----------------------------------------------------------------------------
-- 4. Kolom baru: atribut rumah sakit + wilayah administratif nama
-- -----------------------------------------------------------------------------
-- `wilayah_*` menyimpan NAMA, bukan hanya kode: SIRS memberi nama provinsi dan
-- kabupaten/kota sebagai teks bebas ("Aceh", "Kota Banda Aceh"), dan memetakan
-- 3.325 baris ke kode wilayah bertitik butuh pencocokan nama yang tidak selalu
-- berhasil. Nama aslinya disimpan apa adanya supaya tidak ada tebakan.
SET @ada := (SELECT COUNT(*) FROM information_schema.COLUMNS
             WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'fasilitas'
               AND COLUMN_NAME = 'jenis_rs');
SET @sql := IF(@ada = 0,
  'ALTER TABLE fasilitas
     ADD COLUMN jenis_rs       VARCHAR(40)  NULL AFTER subkategori,
     ADD COLUMN kelas_rs       VARCHAR(20)  NULL AFTER jenis_rs,
     ADD COLUMN kepemilikan    VARCHAR(60)  NULL AFTER kelas_rs,
     ADD COLUMN status_operasional VARCHAR(40) NULL AFTER kepemilikan,
     ADD COLUMN provinsi       VARCHAR(80)  NULL AFTER status_operasional,
     ADD COLUMN kabupaten      VARCHAR(80)  NULL AFTER provinsi,
     ADD COLUMN kecamatan      VARCHAR(80)  NULL AFTER kabupaten,
     ADD COLUMN kelurahan      VARCHAR(80)  NULL AFTER kecamatan,
     ADD COLUMN kode_provinsi  VARCHAR(8)   NULL AFTER kelurahan,
     ADD COLUMN kode_kabupaten VARCHAR(8)   NULL AFTER kode_provinsi',
  'DO 0');
PREPARE s FROM @sql; EXECUTE s; DEALLOCATE PREPARE s;

-- -----------------------------------------------------------------------------
-- 5. Kolom audit sinkronisasi
-- -----------------------------------------------------------------------------
-- `hilang_pada` = kapan sumber resmi TIDAK lagi memuat RS ini. Barisnya TIDAK
-- dihapus: rumah sakit bisa hilang dari satu tarikan karena gangguan sumber,
-- dan menghapusnya berarti menghilangkan data yang besok muncul lagi.
-- `aktif` diturunkan dari `hilang_pada`, bukan ditebak dari nama.
SET @ada := (SELECT COUNT(*) FROM information_schema.COLUMNS
             WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'fasilitas'
               AND COLUMN_NAME = 'hilang_pada');
SET @sql := IF(@ada = 0,
  'ALTER TABLE fasilitas
     ADD COLUMN sumber_diperbarui DATETIME NULL AFTER diperiksa_pada,
     ADD COLUMN disinkron_pada   DATETIME NULL AFTER sumber_diperbarui,
     ADD COLUMN hilang_pada      DATETIME NULL AFTER disinkron_pada',
  'DO 0');
PREPARE s FROM @sql; EXECUTE s; DEALLOCATE PREPARE s;

-- -----------------------------------------------------------------------------
-- 6. Indeks untuk filter antarmuka
-- -----------------------------------------------------------------------------
SET @ada := (SELECT COUNT(*) FROM information_schema.STATISTICS
             WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'fasilitas'
               AND INDEX_NAME = 'idx_fasilitas_provinsi');
SET @sql := IF(@ada = 0,
  'ALTER TABLE fasilitas
     ADD KEY idx_fasilitas_provinsi (provinsi),
     ADD KEY idx_fasilitas_kabupaten (kabupaten),
     ADD KEY idx_fasilitas_kelas (kelas_rs),
     ADD KEY idx_fasilitas_jenis (jenis_rs),
     ADD KEY idx_fasilitas_sumber (sumber)',
  'DO 0');
PREPARE s FROM @sql; EXECUTE s; DEALLOCATE PREPARE s;

-- -----------------------------------------------------------------------------
-- 7. Tabel log sinkronisasi
-- -----------------------------------------------------------------------------
-- Satu baris per tarikan, termasuk yang GAGAL. Tanpa catatan kegagalan,
-- "terakhir sinkron 3 hari lalu" tidak bisa dibedakan dari "terakhir dicoba
-- 3 hari lalu dan gagal".
CREATE TABLE IF NOT EXISTS sinkron_fasilitas (
  id             BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  sumber         VARCHAR(60)  NOT NULL,
  mulai          DATETIME     NOT NULL,
  selesai        DATETIME     NULL,
  status         ENUM('jalan','sukses','gagal') NOT NULL DEFAULT 'jalan',
  jumlah_sumber  INT UNSIGNED NULL,
  jumlah_baru    INT UNSIGNED NOT NULL DEFAULT 0,
  jumlah_diubah  INT UNSIGNED NOT NULL DEFAULT 0,
  jumlah_tetap   INT UNSIGNED NOT NULL DEFAULT 0,
  jumlah_gagal   INT UNSIGNED NOT NULL DEFAULT 0,
  jumlah_hilang  INT UNSIGNED NOT NULL DEFAULT 0,
  tanpa_koordinat INT UNSIGNED NULL,
  pesan          TEXT         NULL,
  KEY idx_sinkron_mulai (mulai)
) ENGINE=InnoDB;

-- -----------------------------------------------------------------------------
-- 8. Kategori untuk rumah sakit resmi
-- -----------------------------------------------------------------------------
-- Fitur lama memakai 10 kategori OSM; RS dari SIRS masuk ke kategori yang sudah
-- ada (rumah-sakit) supaya filter antarmuka tidak berubah arti. Labelnya tetap
-- konsisten dengan istilah yang dipakai di halaman.
INSERT INTO kategori_fasilitas (kode, label) VALUES ('rumah-sakit', 'Rumah Sakit')
  ON DUPLICATE KEY UPDATE label = VALUES(label);

-- -----------------------------------------------------------------------------
-- 9. Kunci untuk fakta "sumber ini tidak punya koordinat"
-- -----------------------------------------------------------------------------
-- Disimpan di database, bukan hanya di kode, supaya sinkronisasi berikutnya
-- tidak diam-diam dianggap "gagal melengkapi" sesuatu yang memang tidak ada di
-- sumbernya.
CREATE TABLE IF NOT EXISTS catatan_sumber (
  sumber    VARCHAR(60) NOT NULL PRIMARY KEY,
  catatan   TEXT        NULL,
  diperiksa DATETIME    NULL
) ENGINE=InnoDB;
