#!/usr/bin/env bash
# Menolak dump database yang tidak aman untuk repo publik, atau tidak utuh.
# Pakai: ./periksa-dump-database.sh [berkas]
set -uo pipefail
cd "$(dirname "$0")" || exit 1

BERKAS="${1:-docs/database/pahami-sehat.sql}"
JUMLAH_TABEL_DIHARAPKAN=15
BATAS_BYTE=52428800   # 50 MB — batas peringatan GitHub

gagal=0
lapor() { printf '  %-5s %s\n' "$1" "$2"; }

if [ ! -s "$BERKAS" ]; then
  lapor GAGAL "berkas tidak ada atau kosong: $BERKAS"
  exit 1
fi
lapor OK "berkas ada ($(du -h "$BERKAS" | cut -f1))"

for tabel in pengguna pengguna_baru sesi riwayat riwayat_pengguna setelan; do
  if grep -q "CREATE TABLE \`$tabel\`" "$BERKAS"; then
    lapor GAGAL "tabel terlarang ikut terekspor: $tabel"
    gagal=1
  fi
done
[ "$gagal" -eq 0 ] && lapor OK "tidak ada tabel akun/sesi/riwayat"

if [ "${IKUT_PERCAKAPAN:-0}" = "1" ]; then
  lapor LEWAT "baris percakapan ikut (IKUT_PERCAKAPAN=1)"
elif grep -q "INSERT INTO \`percakapan\`" "$BERKAS"; then
  lapor GAGAL "percakapan memuat baris (teks yang diketik pengguna)"
  gagal=1
else
  lapor OK "percakapan hanya struktur, tanpa baris"
fi

jumlah=$(grep -c '^CREATE TABLE' "$BERKAS")
if [ "$jumlah" -ne "$JUMLAH_TABEL_DIHARAPKAN" ]; then
  lapor GAGAL "jumlah tabel $jumlah, seharusnya $JUMLAH_TABEL_DIHARAPKAN (perbarui angka ini kalau skema berubah)"
  gagal=1
else
  lapor OK "jumlah tabel $jumlah"
fi

byte=$(stat -c%s "$BERKAS")
if [ "$byte" -gt "$BATAS_BYTE" ]; then
  lapor GAGAL "ukuran $byte byte melewati batas GitHub 50 MB"
  gagal=1
else
  lapor OK "ukuran $byte byte"
fi

[ "$gagal" -eq 0 ] && echo "LULUS — dump aman dibagikan" || echo "GAGAL — jangan di-commit"
exit "$gagal"
