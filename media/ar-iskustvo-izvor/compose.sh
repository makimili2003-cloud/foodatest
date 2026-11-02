#!/bin/bash
# Montaža AR animacije: AI kadar (Higgsfield) + pravi ekran stranice jela + overlay grafike.
# Upotreba: compose.sh ai.mp4 izlazni_folder
set -e
D=$(cd "$(dirname "$0")" && pwd)
AI=$1; OUT=$2; mkdir -p "$OUT"
W=540; H=1170
ffmpeg -v error -y -i "$AI" \
  -loop 1 -i "$D/ui-ar.png" -loop 1 -i "$D/ov-scan.png" -loop 1 -i "$D/ov-lock.png" -loop 1 -i "$D/ov-link.png" \
  -loop 1 -i "$D/ov-tap-link.png" -loop 1 -i "$D/ov-tap-ar.png" -loop 1 -i "$D/ov-ar.png" \
  -filter_complex "\
[0:v]fps=30,scale=-2:$H:flags=lanczos,crop=$W:$H,setsar=1,trim=0:10,setpts=PTS-STARTPTS[b];\
[1:v]scale=$W:$H,format=rgba[ui];\
[b][ui]overlay=enable='between(t,3,4.5)'[v1];\
[v1][2:v]overlay=enable='between(t,0.3,2.0)'[v2];\
[v2][3:v]overlay=enable='between(t,2.0,3.0)'[v3];\
[v3][4:v]overlay=enable='between(t,2.3,3.0)'[v4];\
[v4][5:v]overlay=enable='between(t,2.7,2.95)'[v5];\
[v5][6:v]overlay=enable='between(t,4.0,4.3)'[v6];\
[v6][7:v]overlay=enable='between(t,4.6,9.4)',format=yuv420p[out]" \
  -map "[out]" -t 10 -an -c:v libx264 -preset slow -crf 25 -profile:v high -pix_fmt yuv420p -movflags +faststart "$OUT/ar-iskustvo.mp4"
ffmpeg -v error -y -i "$OUT/ar-iskustvo.mp4" -an -c:v libvpx-vp9 -b:v 0 -crf 38 -row-mt 1 "$OUT/ar-iskustvo.webm"
ffmpeg -v error -y -ss 7 -i "$OUT/ar-iskustvo.mp4" -frames:v 1 -c:v libwebp -quality 80 "$OUT/ar-iskustvo-poster.webp"
ls -la "$OUT"
