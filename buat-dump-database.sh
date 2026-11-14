#!/usr/bin/env bash
# Membuat dump database lengkap yang aman dibagikan di repo publik.
# Struktur 15 tabel + seluruh baris, KECUALI baris tabel percakapan.
# Pakai: ./buat-dump-database.sh [berkas-tujuan]
#   IKUT_PERCAKAPAN=1 ikutkan juga isi percakapan (JANGAN untuk repo publik).
set -euo pipefail
cd "$(dirname "$0")" || exit 1

TUJUAN="${1:-docs/database/pahami-sehat.sql}"
NAMA_DB="${DB_NAMA:-pahami_sehat}"
HOST_DB="${DB_HOST:-127.0.0.1}"
PORT_DB="${DB_PORT:-3306}"
USER_DB="${DB_USER:-root}"
MYSQLDUMP="${MYSQLDUMP:-/opt/lampp/bin/mysqldump}"

opsi=(--host="$HOST_DB" --port="$PORT_DB" --user="$USER_DB"
      --no-tablespaces --single-transaction --quick
      --default-character-set=utf8mb4 --skip-comments)
if [ -n "${DB_PASSWORD:-}" ]; then opsi+=("--password=$DB_PASSWORD"); fi

mkdir -p "$(dirname "$TUJUAN")"
kerja="$(mktemp -d)"
trap 'rm -rf "$kerja"' EXIT

# Lintasan 1: struktur semua tabel, tanpa satu baris pun.
"$MYSQLDUMP" "${opsi[@]}" --no-data "$NAMA_DB" > "$kerja/struktur.sql"

# Lintasan 2: seluruh baris, kecuali percakapan.
abaikan=()
if [ "${IKUT_PERCAKAPAN:-0}" != "1" ]; then
  abaikan+=("--ignore-table=$NAMA_DB.percakapan")
fi
"$MYSQLDUMP" "${opsi[@]}" --no-create-info --order-by-primary \
  "${abaikan[@]}" "$NAMA_DB" > "$kerja/data.sql"

{
  printf -- '-- ============================================================================\n'
  printf -- '--  Pahami Sehat - isi database (bukan hanya skema)\n'
  printf -- '--  Dibuat: %s dari basis data `%s` (MariaDB 10.4, XAMPP).\n' "$(date +%Y-%m-%d)" "$NAMA_DB"
  printf -- '--  Isi: struktur 15 tabel + seluruh baris tabel rujukan dan fasilitas.\n'
  printf -- '--  Tabel `percakapan` hanya strukturnya: berisi teks yang diketik pengguna.\n'
  printf -- '--  Muat ulang:\n'
  printf -- '--    /opt/lampp/bin/mysql -u root %s < %s\n' "$NAMA_DB" "$TUJUAN"
  printf -- '--  Perbarui berkas ini dengan: ./buat-dump-database.sh\n'
  printf -- '-- ============================================================================\n\n'
  cat "$kerja/struktur.sql"
  printf '\n'
  cat "$kerja/data.sql"
} > "$TUJUAN"

echo "Ditulis: $TUJUAN ($(du -h "$TUJUAN" | cut -f1))"
./periksa-dump-database.sh "$TUJUAN"
