#!/usr/bin/env bash
#
# Siapkan alamat tetap (named Cloudflare Tunnel) untuk Pahami Sehat.
#
# KENAPA PERLU
# `jalankan-online.sh` bisa membuka aplikasi ke internet tanpa akun apa pun, tapi
# alamatnya acak dan berubah setiap dijalankan (….trycloudflare.com). Dengan
# named tunnel, alamatnya tetap — mis. https://pahami-sehat.id — sehingga juri
# bisa membuka URL yang sama tanpa perlu dikirim ulang.
#
# YANG PERLU DISIAPKAN LEBIH DULU (di luar skrip ini, sekali saja):
#   1. Beli domain (mis. pahami-sehat.id di registrar Indonesia)
#   2. Buat akun Cloudflare (gratis) lalu masukkan domain itu ke sana;
#      Cloudflare akan memberi dua nameserver yang harus dipasang di registrar
#   3. Tunggu sampai status domain di Cloudflare "Active" (biasanya menit–jam)
#
# Setelah itu jalankan skrip ini SEKALI:
#     ./siapkan-domain.sh pahami-sehat.id
#
# Skrip ini TIDAK mengubah apa pun di Cloudflare lewat API dan tidak menyimpan
# kredensial: ia hanya memanggil `cloudflared tunnel login` (membuka peramban
# untuk izin), membuat tunnel, dan menulis ~/.cloudflared/config.yml.

set -euo pipefail

AKAR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PORT="${PORT:-8787}"
NAMA_TUNNEL="${NAMA_TUNNEL:-pahami-sehat}"
CLOUDFLARED="${CLOUDFLARED:-$HOME/.local/bin/cloudflared}"
[ -x "$CLOUDFLARED" ] || CLOUDFLARED="$(command -v cloudflared || true)"

DOMAIN="${1:-}"
if [ -z "$DOMAIN" ]; then
  echo "Pemakaian: ./siapkan-domain.sh <domain>" >&2
  echo "Contoh   : ./siapkan-domain.sh pahami-sehat.id" >&2
  exit 1
fi

if [ -z "$CLOUDFLARED" ] || [ ! -x "$CLOUDFLARED" ]; then
  echo "cloudflared tidak ditemukan. Pasang dulu (lihat jalankan-online.sh)." >&2
  exit 1
fi

echo
echo "  Menyiapkan alamat tetap: https://$DOMAIN"
echo "  ───────────────────────────────────────────────────────────"
echo "  Pastikan domain $DOMAIN sudah AKTIF di Cloudflare."
echo "  Kalau belum, langkah ini akan gagal pada tahap pemetaan DNS."
echo

# 1) Login: membuka peramban, jagi memilih domain yang dipakai.
if [ ! -f "$HOME/.cloudflared/cert.pem" ]; then
  echo "Langkah 1/3 — login ke Cloudflare (peramban akan terbuka)…"
  "$CLOUDFLARED" tunnel login
else
  echo "Langkah 1/3 — sudah login (cert.pem ada), dilewati."
fi

# 2) Buat tunnel (kalau belum ada).
echo "Langkah 2/3 — membuat tunnel bernama \"$NAMA_TUNNEL\"…"
if "$CLOUDFLARED" tunnel list 2>/dev/null | awk '{print $2}' | grep -qx "$NAMA_TUNNEL"; then
  echo "  tunnel \"$NAMA_TUNNEL\" sudah ada, dilewati."
else
  "$CLOUDFLARED" tunnel create "$NAMA_TUNNEL"
fi

# 3) Arahkan hostname ke tunnel.
echo "Langkah 3/3 — memetakan $DOMAIN ke tunnel…"
"$CLOUDFLARED" tunnel route dns "$NAMA_TUNNEL" "$DOMAIN" || {
  echo "  (kalau gagal karena DNS sudah ada, itu tidak masalah — lanjutkan saja)" >&2
}

# Ambil UUID tunnel untuk config.yml.
UUID="$("$CLOUDFLARED" tunnel list 2>/dev/null | awk -v n="$NAMA_TUNNEL" '$2==n {print $1; exit}')"
if [ -z "$UUID" ]; then
  echo "Tidak bisa membaca UUID tunnel \"$NAMA_TUNNEL\". Periksa: $CLOUDFLARED tunnel list" >&2
  exit 1
fi

KONFIG="$HOME/.cloudflared/config.yml"
if [ -f "$KONFIG" ]; then
  cp "$KONFIG" "$KONFIG.bak-$(date +%Y%m%d-%H%M%S)"
  echo "  config.yml lama dicadangkan."
fi

cat > "$KONFIG" <<YAML
# Dibuat oleh siapkan-domain.sh — dipakai jalankan-online.sh
tunnel: $NAMA_TUNNEL
credentials-file: $HOME/.cloudflared/$UUID.json

ingress:
  - hostname: $DOMAIN
    service: http://127.0.0.1:$PORT
  - service: http_status:404
YAML

cat <<PESAN

  Selesai. Konfigurasi ditulis ke:
    $KONFIG

  Mulai sekarang cukup jalankan:
    ./jalankan-online.sh

  Skrip itu otomatis memakai named tunnel dan mencetak:
    https://$DOMAIN        (halaman penjelasan)
    https://$DOMAIN/app/   (aplikasi)

  Catatan: alamat ini hidup hanya selama skrip jalan dan mesin ini menyala,
  dan sertifikat HTTPS-nya diurus otomatis oleh Cloudflare.

PESAN
