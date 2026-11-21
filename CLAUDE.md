# Dispatch

Printable logic puzzle on the power grid: fill the day's demand curve with power plants (rectangles: width = running time, height = power), following the market clues. One solution per grid, no score. Static web game (French) published on GitHub Pages. Game rules and grid format: `GAME-DESIGN.md`.

## Map

- `web/` — the game (TypeScript + Vite, no framework, Vitest).
  - `src/model/grid.ts` — grid format (§14) types and `validateGrid()`.
  - `src/engine/` — pure engine, no DOM, immutable state: actions, rules, clue status, verdict on the composition (§8.1).
  - `src/ui/` — hash router, home, game screen (SVG board, gestures, undo, progress in `localStorage`), print sheets; `src/styles/` screen and print CSS.
  - `src/i18n/fr.ts` — every text shown to the player.
  - `src/data/grids.json` — the 11 grids (7 tutorial, 4 rated).
  - `scripts/convert-grids.ts` (prototype format → §14), `scripts/check_unique.py` (uniqueness with the solver).
  - `tests/` — Vitest: grids, engine, place-over, convert, UI logic.
- `lab/` — grid lab (the human's creation tool): `lab_server.py` (local JSON API, standard library only), `run.sh` (one launch command), `candidates/` (lots written by `dispatch-solver generate`), `lots/`, `plays.jsonl`, `notes.json`, `players.json`; tests in `lab/tests/`. Page: `web/lab.html` + `web/src/lab/` (dev server only, never in the published build).
- `solver/` — Python (OR-Tools CP-SAT): exact solver, human-deduction solver and difficulty rating, grid generator, CLI `spot-solver`. Its score modes (v1, v2, target) are not part of the game: leave them.
- `docs/next/` — next iteration brief, `docs/next/brief.md` (local, untracked).
- `docs/style-reference.html` — visual reference (screen style A, paper style B); `docs/reviews/` reviews and captures; `docs/archive/` prototype and superseded notes (read-only).
- `.github/workflows/deploy.yml` — solver tests + uniqueness check, web tests, build and publish on every push to `main`.

## Commands

```bash
cd web
npm ci                    # install
npm run dev               # http://localhost:5173/dispatch/
npm test                  # Vitest
npm run typecheck         # tsc --noEmit
npm run build             # typecheck + build to web/dist
npm run preview           # production build at http://localhost:4173/dispatch/
npm run convert           # regenerate src/data/grids.json from docs/archive/demo/grids-pose.json
../solver/.venv/bin/python scripts/check_unique.py   # every grid has exactly one composition; run after any change to grids.json (CI runs it too)

cd solver
uv sync                   # creates .venv
.venv/bin/pytest -q       # solver tests
```

```bash
lab/run.sh                # lab server (8765) + Vite; open http://localhost:5173/dispatch/lab.html
solver/.venv/bin/python -m pytest lab/tests -q   # lab server tests
```

Skills in `.claude/skills/`: `add-grid` (create, convert, check, play a grid), `run-app` (servers, headless Chrome captures, print PDF), `deploy` (workflow, checking the live site).

## Conventions

- Code, identifiers, comments, logs and developer errors in English; player-facing text in French, only in `web/src/i18n/fr.ts`.
- File headers: short English bullets on what the file does, current state only.
- Grids follow §14 and must pass `validateGrid()`; change the format in `grid.ts`, the validator and `GAME-DESIGN.md` §14 together.
- A piece's legal shapes are its allowed widths × allowed heights. A STEP grid publishes its number of pairs (`inventory.step`, or `step` in an `exchanges` clue). A price clue names a plant, never a value, and never sits on a column with an import.
- A grid is solved on its composition (cells per piece and column, exports, pumping, turbining), not on the drawing.
- The lab plays the real game screen blind (no solver rating or techniques until the end); its measures go to `lab/plays.jsonl` through the server, never to `localStorage`. Promotion writes `web/src/data/grids.json`: run `check_unique.py` and commit it like any grid change.
- Progress lives in `localStorage` under `dispatch:progress:v1`: renaming the key wipes players' progress.
- UI follows `docs/style-reference.html`; the page never scrolls horizontally (check at 320 px).

## Git

- Branch names without `/` (use `-`).
- No mention of Claude or AI in commits, PRs or code (no `Co-Authored-By`, no "Generated with").
- Commit author: the repo's noreply address (`git config user.email`); the history is public.
- `backup-before-squash` is a local-only branch (old history): never push it; push `main` only.
- Every deliverable is reviewed by an agent other than its author: report in `docs/reviews/<task>.md`, captures in `docs/reviews/<task>/`.
- Pushing to `main` publishes the site. Workers commit on their own `v2-<topic>` branch in a worktree and never merge or push; the orchestrator merges into `main` and pushes once a deliverable has passed review and the finishing loop, with tests, typecheck and `check_unique.py` green.
