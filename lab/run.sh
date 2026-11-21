#!/usr/bin/env bash
# Launch the lab: local server (port 8765) + Vite dev server (port 5173, proxies /api to the server).
# Then open http://localhost:5173/dispatch/lab.html. Ctrl-C stops both.
# Uses solver/.venv (dispatch_solver) when present; without it the lab works but cannot generate or promote.
set -euo pipefail
here="$(cd "$(dirname "$0")" && pwd)"
root="$(dirname "$here")"
py="$root/solver/.venv/bin/python"
[ -x "$py" ] || py=python3
"$py" "$here/lab_server.py" --port 8765 &
server=$!
trap 'kill $server 2>/dev/null' EXIT INT TERM
cd "$root/web"
npm run dev -- --port 5173 --strictPort
