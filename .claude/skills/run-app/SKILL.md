---
name: run-app
description: Launch the Dispatch web app locally and take screenshots or PDFs of it with headless Chrome (desktop 1280 px, phone 375 px, narrow 320 px, A4 print sheets). Use to see a UI or print change working, to check a layout at a given width, or to attach captures to a review.
---

# Run the app and capture it

All commands run from `web/`.

## Start a server

- Dev, with hot reload: `npm run dev` → `http://localhost:5173/dispatch/`.
- Production build, as on GitHub Pages: `npm run build && npm run preview -- --port 4173 --strictPort` → `http://localhost:4173/dispatch/`.
- Both are long-running: start them in the background (or a visible tmux pane), then wait until `curl -s -o /dev/null -w '%{http_code}' <url>` prints `200`.

The app is served under `/dispatch/` (`base` in `vite.config.ts`): always use that path in URLs.

## Routes (hash router, `src/ui/app.ts`)

- `#/` home · `#/grille/<id>` game screen · `#/imprimer/<id>` print preview of one grid · `#/imprimer/tout` every grid.

## Screenshots

```bash
../.claude/skills/run-app/capture.sh "http://localhost:4173/dispatch/#/grille/10" 1280 /tmp/g10-1280.png
../.claude/skills/run-app/capture.sh "http://localhost:4173/dispatch/#/grille/10" 375 /tmp/g10-375.png
../.claude/skills/run-app/capture.sh "http://localhost:4173/dispatch/#/" 320 /tmp/home-320.png
```

- Headless Chrome does not lay a page out narrower than 500 px: `--window-size=375,…` renders at 500 px and crops. Below 500 px the script loads the app in an iframe of the requested width inside a 600 px host page (grey on the right).
- Optional 4th argument: height (default 900). Chrome path override: `CHROME=/path/to/chrome`.
- Open the PNG with the Read tool to look at it.

## Full browser check (every grid, three widths)

`scripts/check-ui.mjs` (playwright-core, a dev dependency) plays every published grid in Chrome at 1280 px (mouse), 375 and 320 px (touch): no horizontal scroll, clue pills whole and apart, the reference solution laid until the verdict, no JS error; home and dossier; one A4 page per grid. Reviews call it instead of writing their own script.

```bash
npm run build && npm run preview -- --port 4173 --strictPort &
node scripts/check-ui.mjs --out /tmp/check-ui            # captures + results.json; exit 1 on a failed check
node scripts/check-ui.mjs --ids 7,13 --widths 320         # a subset
```

## Print sheets (PDF)

```bash
"/Applications/Google Chrome.app/Contents/MacOS/Google Chrome" --headless=new --disable-gpu \
  --virtual-time-budget=3000 --no-pdf-header-footer --print-to-pdf=/tmp/sheet7.pdf \
  "http://localhost:4173/dispatch/#/imprimer/7"
```

One grid = one A4 page (`src/styles/print.css`); `#/imprimer/tout` gives one page per grid.

## Stop

Kill the server when done (`kill %1`, or the PID of `vite`), so the port is free next time.

## The lab (grid creation tool)

- One command from the repo root: `lab/run.sh` starts the lab server (port 8765) and Vite (port 5173, proxies `/dispatch/api` to the server). Open `http://localhost:5173/dispatch/lab.html`.
- Routes: `#/` lot table · `#/partie/<lot>/<i>` blind game · `#/fin/<lot>/<i>` end of game (rating, reveal) · `#/gardees` kept grids, bulletin, promotion.
- Data is in `lab/`: `candidates/<lot>.json`, `plays.jsonl`, `notes.json`, `players.json` (two player names). Delete `plays.jsonl` / `notes.json` after a test session you do not want to keep.
- Generating a lot and promoting a grid need `dispatch_solver` (`cd solver && uv sync`); without it the page works on existing candidates (`lab/candidates/demo.json` is a demo lot built from published grids).
- Capture: `../.claude/skills/run-app/capture.sh "http://localhost:5173/dispatch/lab.html#/" 1280 /tmp/lab.png`.
