#!/usr/bin/env bash
#
# Jalankan Pahami Sehat di laptop sendiri, lalu buka aksesnya ke internet.
#
# KENAPA SKRIP INI ADA
# Aplikasi ini memang dirancang berjalan di komputer sendiri: server Express
# menyajikan halaman penjelasan (/) dan aplikasi (/app/), dan fitur suara neural
# memakai WebSocket yang tidak bisa hidup di fungsi serverless. Yang kurang hanya
# satu: orang lain tidak bisa membukanya. Cloudflare Tunnel menutup celah itu
# tanpa membuka port di router dan tanpa menyewa server.
#
# YANG DIPEROLEH
#   - alamat https://…trycloudflare.com yang bisa dibuka siapa saja
#   - HTTPS sungguhan -> mikrofon (pengenalan suara) dan papan klip ikut bekerja,
#     yang TIDAK bisa dilakukan lewat http://<ip-lan> biasa
#   - suara neural tetap berbunyi, karena prosesnya tetap di laptop ini
#
# YANG PERLU DIINGAT
#   - alamatnya HIDUP hanya selama skrip ini jalan dan mesin ini menyala
#   - alamat trycloudflare BERUBAH setiap kali dijalankan (lihat catatan di bawah
#     kalau ingin alamat tetap)
#   - server hanya mendengarkan di 127.0.0.1; yang menghubungkannya ke internet
#     hanyalah cloudflared, jadi port tidak pernah terbuka ke jaringan
#
# Pemakaian:  ./jalankan-online.sh
# Berhenti :  Ctrl+C  (keduanya ikut berhenti)

set -euo pipefail

AKAR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PORT="${PORT:-8787}"
CLOUDFLARED="${CLOUDFLARED:-$HOME/.local/bin/cloudflared}"

if ! command -v node >/dev/null 2>&1; then
  echo "node tidak ditemukan. Pasang Node.js dulu." >&2
  exit 1
fi

if [ ! -f "$AKAR/app/.env" ]; then
  echo "app/.env belum ada. Salin app/.env.example jadi app/.env lalu isi KENARI_API_KEY." >&2
  exit 1
fi

if [ ! -x "$CLOUDFLARED" ] && ! command -v cloudflared >/dev/null 2>&1; then
  echo "cloudflared tidak ditemukan. Pasang dengan salah satu cara:" >&2
  echo "  sudo pacman -S cloudflared" >&2
  echo "  curl -sL -o ~/.local/bin/cloudflared https://github.com/cloudflare/cloudflared/releases/latest/download/cloudflared-linux-amd64 && chmod +x ~/.local/bin/cloudflared" >&2
  exit 1
fi
[ -x "$CLOUDFLARED" ] || CLOUDFLARED="$(command -v cloudflared)"

# Pastikan portnya benar-benar bebas — server lama yang masih hidup membuat
# server baru mati diam-diam, dan kita tanpa sadar menguji kode lama.
if ss -ltn 2>/dev/null | grep -q ":$PORT "; then
  echo "Port $PORT sudah dipakai proses lain." >&2
  echo "Matikan dulu (cari pid: ss -ltnp | grep $PORT) lalu jalankan lagi." >&2
  exit 1
fi

echo "Membangun aplikasi…"
(cd "$AKAR/app" && npm run build >/dev/null)

echo "Menjalankan server di http://127.0.0.1:$PORT …"
(cd "$AKAR/app" && node --env-file=.env server/index.js) &
PID_SERVER=$!

# Berhentikan keduanya dengan Ctrl+C, dan jangan tinggalkan proses yatim.
bersihkan() {
  echo
  echo "Menghentikan…"
  kill "$PID_SERVER" 2>/dev/null || true
  [ -n "${PID_TUNNEL:-}" ] && kill "$PID_TUNNEL" 2>/dev/null || true
  wait 2>/dev/null || true
  echo "Selesai."
}
trap bersihkan INT TERM EXIT

# Tunggu server benar-benar siap sebelum menerowongkan.
for i in $(seq 1 30); do
  if curl -sf -o /dev/null "http://127.0.0.1:$PORT/api/health"; then break; fi
  sleep 0.5
done

if ! curl -sf -o /dev/null "http://127.0.0.1:$PORT/api/health"; then
  echo "Server tidak menjawab di port $PORT. Periksa pesan galat di atas." >&2
  exit 1
fi
echo "Server siap."

# --- Pilih cara membuka terowongan -------------------------------------------
#
# NAMED TUNNEL (alamat TETAP) dipakai kalau domain sendiri sudah disiapkan —
# lihat ~/.cloudflared/config.yml. Kalau belum ada, jatuh ke quick tunnel
# (alamat acak yang berubah tiap dijalankan).
#
# KENAPA DIBEDAKAN: named tunnel punya alamat tetap dan TIDAK punya batas 200
# permintaan bersamaan seperti quick tunnel. Saat penjurian, alamat tetap berarti
# juri membuka URL yang sama tanpa perlu dikirim ulang.
CONFIG_CLOUDFLARED="${CLOUDFLARED_CONFIG:-$HOME/.cloudflared/config.yml}"

echo "Membuka terowongan Cloudflare…"
LOG_TUNNEL="$(mktemp)"
ALAMAT=""

if [ -f "$CONFIG_CLOUDFLARED" ]; then
  # Ambil hostname pertama dari config.yml supaya alamatnya bisa dicetak.
  HOSTNAME_TETAP="$(grep -oE 'hostname:[[:space:]]*[A-Za-z0-9.-]+' "$CONFIG_CLOUDFLARED" | head -1 | awk '{print $2}')"
  if [ -n "$HOSTNAME_TETAP" ]; then
    echo "  memakai named tunnel: $HOSTNAME_TETAP"
    "$CLOUDFLARED" tunnel --config "$CONFIG_CLOUDFLARED" run > "$LOG_TUNNEL" 2>&1 &
    PID_TUNNEL=$!
    # Named tunnel tidak selalu mencetak alamatnya; pakai hostname dari config.
    for i in $(seq 1 30); do
      if grep -qiE "Registered tunnel connection|Connection .* registered" "$LOG_TUNNEL" 2>/dev/null; then break; fi
      if ! kill -0 "$PID_TUNNEL" 2>/dev/null; then
        echo "Named tunnel berhenti. Log:" >&2
        tail -20 "$LOG_TUNNEL" >&2
        exit 1
      fi
      sleep 1
    done
    ALAMAT="https://$HOSTNAME_TETAP"
  else
    echo "  config.yml ada tetapi tidak memuat 'hostname' — beralih ke quick tunnel." >&2
  fi
fi

if [ -z "$ALAMAT" ]; then
  "$CLOUDFLARED" tunnel --url "http://127.0.0.1:$PORT" --no-autoupdate > "$LOG_TUNNEL" 2>&1 &
  PID_TUNNEL=$!

  for i in $(seq 1 60); do
    ALAMAT="$(grep -oE 'https://[a-z0-9-]+\.trycloudflare\.com' "$LOG_TUNNEL" 2>/dev/null | head -1 || true)"
    [ -n "$ALAMAT" ] && break
    sleep 1
  done
fi

if [ -z "$ALAMAT" ]; then
  echo "Alamat terowongan tidak muncul. Log:" >&2
  tail -20 "$LOG_TUNNEL" >&2
  exit 1
fi

cat <<PESAN

  Pahami Sehat siap dibuka siapa saja
  ───────────────────────────────────────────────────────────
  Halaman penjelasan : $ALAMAT
  Aplikasi           : $ALAMAT/app/
  Lokal              : http://127.0.0.1:$PORT

  Tutup dengan Ctrl+C. Alamat ini mati begitu skrip berhenti
  atau mesin ini dimatikan.

PESAN

wait "$PID_TUNNEL"
