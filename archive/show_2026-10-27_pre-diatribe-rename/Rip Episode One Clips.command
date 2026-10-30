#!/bin/bash
# Double-click: downloads ONLY the short sections episode one uses (not whole videos) into Transcripts/show/ep01/clips/.
# Needs yt-dlp and ffmpeg (installs ffmpeg with Homebrew the first time if missing). Safe to run again — it skips files it already has.
cd "$(dirname "$0")" || exit 1
export PATH="/opt/homebrew/bin:/usr/local/bin:$PATH"
for v in 3.9 3.10 3.11 3.12 3.13 3.14; do [ -d "$HOME/Library/Python/$v/bin" ] && export PATH="$HOME/Library/Python/$v/bin:$PATH"; done
CERT="$(python3 -m certifi 2>/dev/null)"; [ -f "$CERT" ] && export SSL_CERT_FILE="$CERT"
command -v yt-dlp >/dev/null || { echo "yt-dlp missing — run 'Pull the Transcripts.command' once first"; read -r -p "Enter to close"; exit 1; }
# ffmpeg: use one on PATH, else a self-contained copy from Python (imageio-ffmpeg) — no Homebrew needed.
FF="$(command -v ffmpeg)"
if [ -z "$FF" ]; then
  python3 -c "import imageio_ffmpeg" 2>/dev/null || { echo "getting ffmpeg (one time, ~30 MB)…"; python3 -m pip install --user -q imageio-ffmpeg || { echo "ffmpeg download failed"; read -r -p "Enter"; exit 1; }; }
  FF="$(python3 -c "import imageio_ffmpeg; print(imageio_ffmpeg.get_ffmpeg_exe())")"
fi
[ -x "$FF" ] || { echo "no ffmpeg found"; read -r -p "Enter"; exit 1; }
echo "✓ ffmpeg: $FF"
# YouTube now needs a JavaScript runtime to list video formats (without it you get audio only).
python3 -m pip install --user -q -U "yt-dlp[default]" deno 2>/dev/null || true
DENO="$(python3 -c "import deno,os; print(deno.find_deno_bin())" 2>/dev/null)"
[ -x "$DENO" ] || DENO="$(command -v deno)"
[ -x "$DENO" ] && echo "✓ js runtime: $DENO" || echo "⚠ no js runtime found — clips may come down audio-only"
YT="python3 -m yt_dlp"; python3 -c "import yt_dlp" 2>/dev/null || YT="yt-dlp"
OUT="Transcripts/show/ep01/clips"; mkdir -p "$OUT"
rip() {  # name, video id, start, end
  f="$OUT/$1.mp4"
  if [ -f "$f" ] && "$FF" -hide_banner -i "$f" 2>&1 | grep -q "Video:"; then echo "✓ have $1"; return; fi
  echo; echo "── $1  ($2  $3–$4)"
  $YT "https://www.youtube.com/watch?v=$2" ${DENO:+--js-runtimes "deno:$DENO"} --download-sections "*$3-$4" --force-keyframes-at-cuts --force-overwrites \
    -f "bv*[vcodec^=avc1][height<=1080]+ba[ext=m4a]/bv*[height<=1080]+ba/b" --merge-output-format mp4 --ffmpeg-location "$FF" -o "$f" --no-warnings || echo "✗ $1 failed (if it says 429, wait an hour and run again)"
  "$FF" -hide_banner -i "$f" 2>&1 | grep -q "Video:" && echo "  ✓ video" || echo "  ⚠ $1 has no video track"
  sleep 8
}
# Shapiro — "This Roadster Clip Is Jaw-Dropping" (2026-10-16)
rip shapiro_01_open          uvHVMkXDiNc 0:13    0:41
rip shapiro_02_pools         uvHVMkXDiNc 5:45    6:30
rip shapiro_03_fascism       uvHVMkXDiNc 9:40    11:40
rip shapiro_04_communism     uvHVMkXDiNc 13:12   14:44
rip shapiro_05_senate        uvHVMkXDiNc 25:44   26:08
# Tucker + Nathan Apffel (2026-04-06)
rip tucker_01_socialism      ykBp1WhdfLE 1:51:12 1:53:08
# Bad Faith + Isabella Weber (2026-10-22)
rip badfaith_01_coldopen     m5Gk-tQ2v-w 0:20    0:46
rip badfaith_02_realsocialist m5Gk-tQ2v-w 39:08  40:05
rip badfaith_03_theword      m5Gk-tQ2v-w 55:36   57:12
echo; ls -la "$OUT"; echo; echo "Done — tell Claude."; read -r -p "Press Enter to close."
