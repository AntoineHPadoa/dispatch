#!/usr/bin/env bash
# Screenshot one page of the running app with headless Chrome.
# - Widths >= 500 px: a real window of that width.
# - Widths < 500 px: headless Chrome will not lay out narrower than 500 px, so the page is loaded
#   in an iframe of that width (the capture keeps the 600 px host page; the app is the left part).
# Usage: capture.sh <url> <width> <out.png> [height]
#   capture.sh "http://localhost:4173/dispatch/#/grille/10" 375 /tmp/g10-375.png
set -euo pipefail
url=$1; width=$2; out=$3; height=${4:-900}
chrome=${CHROME:-"/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"}
flags=(--headless=new --disable-gpu --hide-scrollbars --virtual-time-budget=3000)
if (( width >= 500 )); then
  "$chrome" "${flags[@]}" --window-size="$width,$height" --screenshot="$out" "$url" 2>/dev/null
else
  frame=$(mktemp -t dispatch-frame).html
  printf '<!doctype html><body style="margin:0;background:#888"><iframe src="%s" style="width:%spx;height:%spx;border:0;background:#fff"></iframe></body>' \
    "$url" "$width" "$height" > "$frame"
  "$chrome" "${flags[@]}" --window-size="600,$height" --screenshot="$out" "file://$frame" 2>/dev/null
  rm -f "$frame"
fi
echo "$out"
