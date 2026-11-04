-- ============================================================================
-- Migrasi: perbesar kategori_fasilitas.id dari TINYINT ke SMALLINT
-- ============================================================================
--
-- MASALAH YANG DIPERBAIKI
-- -----------------------
-- `id` memakai TINYINT UNSIGNED (maks 255) sebagai AUTO_INCREMENT.
--
-- Kesalahan berpikirnya: "kategori hanya ada 10, jadi 255 sudah lebih dari
-- cukup." Itu keliru, karena `INSERT ... ON DUPLICATE KEY UPDATE` TETAP
-- memakai satu angka AUTO_INCREMENT setiap kali dijalankan — termasuk saat
-- barisnya sudah ada dan hanya labelnya yang diperbarui. Jadi jatahnya habis
-- setelah 255 kali PENYIMPANAN, bukan setelah 255 kategori dibuat.
--
-- Terukur 4 Nov 2026: tabel berisi 10 baris, AUTO_INCREMENT sudah 256, dan
-- SETIAP penyimpanan fasilitas baru gagal:
--
--   HA_ERR_AUTOINC_ERANGE (errno 167)
--   Out of range value for column 'id' at row 1
--
-- Gejalanya menyesatkan: pencarian fasilitas tetap jalan (hanya membaca),
-- tetapi tidak ada fasilitas baru yang pernah tersimpan lagi. Fitur tampak
-- hidup sementara penyimpanannya mati total.
--
-- URUTAN PENTING
-- --------------
-- 1. Lepas foreign key dulu — MySQL menolak mengubah tipe kolom yang dipakai FK
--    (ERROR 1833).
-- 2. Ubah KEDUA kolom. `fasilitas.kategori_id` juga harus SMALLINT; kalau
--    tidak, pemasangan FK gagal dengan errno 150.
-- 3. Pasang kembali FK.
-- 4. Reset AUTO_INCREMENT — memperbesar tipe TIDAK menurunkan penghitungnya.
--    Tanpa langkah ini masalahnya tetap ada meski tipe sudah benar.
--
-- AMAN DIJALANKAN BERULANG: setiap langkah diperiksa dulu ke
-- information_schema, jadi menjalankan berkas ini dua kali tidak error.
-- ============================================================================

USE pahami_sehat;

-- ---------------------------------------------------------------- 1. lepas FK
SET @ada_fk := (
  SELECT COUNT(*) FROM information_schema.TABLE_CONSTRAINTS
  WHERE CONSTRAINT_SCHEMA = 'pahami_sehat'
    AND TABLE_NAME = 'fasilitas'
    AND CONSTRAINT_NAME = 'fk_fasilitas_kategori'
    AND CONSTRAINT_TYPE = 'FOREIGN KEY'
);

SET @sql := IF(@ada_fk > 0,
  'ALTER TABLE fasilitas DROP FOREIGN KEY fk_fasilitas_kategori',
  'DO 0');
PREPARE s FROM @sql; EXECUTE s; DEALLOCATE PREPARE s;

-- ------------------------------------------------- 2. perbesar kedua kolom
SET @tipe_kategori := (
  SELECT COLUMN_TYPE FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = 'pahami_sehat' AND TABLE_NAME = 'kategori_fasilitas' AND COLUMN_NAME = 'id'
);
SET @sql := IF(@tipe_kategori LIKE 'tinyint%',
  'ALTER TABLE kategori_fasilitas MODIFY id SMALLINT UNSIGNED NOT NULL AUTO_INCREMENT',
  'DO 0');
PREPARE s FROM @sql; EXECUTE s; DEALLOCATE PREPARE s;

SET @tipe_fk := (
  SELECT COLUMN_TYPE FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = 'pahami_sehat' AND TABLE_NAME = 'fasilitas' AND COLUMN_NAME = 'kategori_id'
);
SET @sql := IF(@tipe_fk LIKE 'tinyint%',
  'ALTER TABLE fasilitas MODIFY kategori_id SMALLINT UNSIGNED NOT NULL',
  'DO 0');
PREPARE s FROM @sql; EXECUTE s; DEALLOCATE PREPARE s;

-- ------------------------------------------------------- 3. pasang ulang FK
SET @ada_fk := (
  SELECT COUNT(*) FROM information_schema.TABLE_CONSTRAINTS
  WHERE CONSTRAINT_SCHEMA = 'pahami_sehat'
    AND TABLE_NAME = 'fasilitas'
    AND CONSTRAINT_NAME = 'fk_fasilitas_kategori'
    AND CONSTRAINT_TYPE = 'FOREIGN KEY'
);

SET @sql := IF(@ada_fk = 0,
  'ALTER TABLE fasilitas ADD CONSTRAINT fk_fasilitas_kategori FOREIGN KEY (kategori_id) REFERENCES kategori_fasilitas (id) ON DELETE RESTRICT',
  'DO 0');
PREPARE s FROM @sql; EXECUTE s; DEALLOCATE PREPARE s;

-- ---------------------------------------------- 4. reset AUTO_INCREMENT
-- Memperbesar tipe kolom TIDAK menurunkan penghitung AUTO_INCREMENT. Tanpa
-- langkah ini, tabel tetap "penuh" walau tipenya sudah SMALLINT.
SET @maks := (SELECT COALESCE(MAX(id), 0) FROM kategori_fasilitas);
SET @sql := CONCAT('ALTER TABLE kategori_fasilitas AUTO_INCREMENT = ', @maks + 1);
PREPARE s FROM @sql; EXECUTE s; DEALLOCATE PREPARE s;

-- ------------------------------------------------------------ pemeriksaan
SELECT
  (SELECT COLUMN_TYPE FROM information_schema.COLUMNS
    WHERE TABLE_SCHEMA='pahami_sehat' AND TABLE_NAME='kategori_fasilitas' AND COLUMN_NAME='id') AS tipe_id_kategori,
  (SELECT COLUMN_TYPE FROM information_schema.COLUMNS
    WHERE TABLE_SCHEMA='pahami_sehat' AND TABLE_NAME='fasilitas' AND COLUMN_NAME='kategori_id') AS tipe_kategori_id,
  (SELECT COUNT(*) FROM information_schema.TABLE_CONSTRAINTS
    WHERE CONSTRAINT_SCHEMA='pahami_sehat' AND TABLE_NAME='fasilitas'
      AND CONSTRAINT_NAME='fk_fasilitas_kategori') AS fk_ada,
  (SELECT AUTO_INCREMENT FROM information_schema.TABLES
    WHERE TABLE_SCHEMA='pahami_sehat' AND TABLE_NAME='kategori_fasilitas') AS auto_increment;
