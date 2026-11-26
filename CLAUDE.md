# Dispatch

Printable logic puzzle on the power grid: fill the day's demand curve with power plants (fixed shapes: width = running time, height = power; coal may ramp), following the market clues. One solution per grid, no score. Static web game (French) published on GitHub Pages. Game rules and grid format: `GAME-DESIGN.md`.

## Map

- `web/` — the game (TypeScript + Vite, no framework, Vitest).
  - `src/model/grid.ts` — grid format (§14) types and `validateGrid()`.
  - `src/engine/` — pure engine, no DOM, immutable state: actions, rules, clue status, verdict on the composition (§8.1).
  - `src/ui/` — hash router, home, game screen (SVG board, gestures, undo, progress in `localStorage`), print sheets; `src/styles/` screen and print CSS.
  - `src/i18n/fr.ts` — every text shown to the player.
  - `src/data/grids.json` — the published grids: rated grids with a daily bulletin, and the tutorial (the guided grid, then « Premiers pas », `GAME-DESIGN.md` §11). Never write a grid count anywhere: the lab promotes new ones.
  - `src/tutorial/` — tutorial script format (`types.ts`) and the real scripts (`script.ts`); former tutorials are test data in `fixtures/legacy-tutorials.json`.
  - `scripts/check_unique.py` (every grid unique, equal to its reference and deducible, with `dispatch_solver`), `scripts/check-ui.mjs` (every grid played in Chrome at 1280/375/320 px, print pages), `scripts/convert-grids.ts` (one-off prototype → §14 converter; refuses to overwrite `grids.json` when ids would be lost).
  - `tests/` — Vitest: grids, engine, place-over, convert, UI logic, lab logic, shared reference grids. Tests select grids by property or id and derive counts: a promotion must not break them.
- `lab/` — grid lab (the human's creation tool, `lab/README.md`): `lab_server.py` (local JSON API, standard library only), `run.sh` (one launch command), `lots/<lot>.json` (generator configs and quotas; `lots/reference.json` = settings to copy for a new lot), `candidates/<lot>.json` (§14 grids + `lab` block: decisions, measures such as `cells`, bulletin draft) and `.stats.json` (`candidates/archive/`: lots set aside, hidden and read-only, `lot:index` keys still resolve), `V3*.md` (one report per generator version), `sessions/<id>.json` (grids to play in a row, drawn by « Nouvelle session »), `plays.jsonl` (one line per game), `notes.json` (felt rating, comment and ★ per player), `players.json`; sessions, plays and notes are local only, git-ignored (public repo); tests in `lab/tests/`. Page: `web/lab.html` + `web/src/lab/` (dev server only, never in the published build).
- `solver/` — Python package `dispatch_solver` (OR-Tools CP-SAT), §14 native: validator (port of `validateGrid`, same messages), cell-by-cell shapes (rectangles, tall pieces, coal ramps `trap`/`stair` behind a flag), exact solver (uniqueness on the composition), human-deduction solver (§9 techniques, traces, provisional rating), generator (lots with imposed diversity, minimal clues, bulletin drafts), CLI `dispatch-solver`. Design: `docs/next/solver-v2.md`. The old pose-format solver is in `docs/archive/solver-v1/`.
- `fixtures/grids/` — shared reference grids (valid, invalid, unpublishable, each with `expect`), played by pytest and by `web/tests/reference.test.ts`; rebuilt by `solver/scripts/build_fixtures.py`.
- `docs/next/` — current designs: `brief.md` (v2 brief), `solver-v2.md` (solver and generator), `rampe.md` + `rampe/` (coal ramp study and its grids), `meteo-briques.md` (weather as fixed bricks). `v3-synthese.md`: what the lab sessions established (solid, refuted and open criteria, method, reference settings, backlog); start there. `v3-criteres*.md`, `v3-challenge.md` and `v3-session-*.md` are its sources.
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
../solver/.venv/bin/python scripts/check_unique.py   # every grid has exactly one composition; run after any change to grids.json (CI runs it too)
node scripts/check-ui.mjs --base http://127.0.0.1:4173/dispatch/   # against npm run preview: every grid in Chrome, 3 widths

cd solver
uv sync                   # creates .venv
.venv/bin/pytest -q       # solver tests (~3 min)
.venv/bin/dispatch-solver check ../web/src/data/grids.json --id 7   # validity, compositions, deduction, rating (--strict: exit 1 unless publishable)
.venv/bin/dispatch-solver deduce ../web/src/data/grids.json --id 11 # deduction trace (--index N for a lab candidate)
.venv/bin/dispatch-solver check-published                           # every published grid, like check_unique.py
.venv/bin/dispatch-solver generate ../lab/lots/reference.json --out /tmp/lot-try   # fill a lot (default lab/candidates/; refuses an archived name; copy reference.json under a new lot name for a real lot)
.venv/bin/python scripts/rerate_lots.py ../lab/candidates/v3-jouer-a.json   # re-rate a lot after a deduction change
.venv/bin/python scripts/build_fixtures.py                          # rebuild fixtures/grids/ after a solver change, review the diff
```

```bash
lab/run.sh                # lab server (8765) + Vite; open http://localhost:5173/dispatch/lab.html
solver/.venv/bin/python -m pytest lab/tests -q   # lab server tests
```

Skills in `.claude/skills/`: `add-grid` (promote from the lab or write a grid, check, play it), `run-app` (servers, headless Chrome captures, print PDF), `deploy` (workflow, checking the live site).

## Conventions

- Code, identifiers, comments, logs and developer errors in English; player-facing text in French, only in `web/src/i18n/fr.ts`. Exception: the lab (`web/src/lab/`, `lab/lab_server.py`), an internal tool, keeps its French labels in its own files.
- File headers: short English bullets on what the file does, current state only.
- Grids follow §14 and must pass `validateGrid()`; change the format in `grid.ts`, the validator and `GAME-DESIGN.md` §14 together.
- A piece's legal shapes are its allowed widths × allowed heights. A STEP grid publishes its number of pairs (`inventory.step`, or `step` in an `exchanges` clue). A price clue names a plant, never a value, and never sits on a column with an import.
- A grid is solved on its composition (cells per piece and column, exports, pumping, turbining), not on the drawing.
- The lab plays the real game screen blind (no solver rating or techniques until the end); its measures go to `lab/plays.jsonl` through the server, never to `localStorage`. Promotion writes `web/src/data/grids.json`: run `check_unique.py` and commit it like any grid change.
- Lab method (`docs/next/v3-synthese.md` §3): control grids in every session, predictions written before playing, several players; judge a hypothesis on the next session, never add a generator quota without a control lot. Generator criteria and the lab's objective difficulty rule: `GAME-DESIGN.md` §10.
- Progress lives in `localStorage` under `dispatch:progress:v1`: renaming the key wipes players' progress.
- UI follows `docs/style-reference.html`; the page never scrolls horizontally (check at 320 px).

## Git

- Branch names without `/` (use `-`).
- No mention of Claude or AI in commits, PRs or code (no `Co-Authored-By`, no "Generated with").
- Commit author: the repo's noreply address (`git config user.email`); the history is public.
- `backup-before-squash` is a local-only branch (old history): never push it; push `main` only.
- Every deliverable is reviewed by an agent other than its author: report in `docs/reviews/<task>.md`, captures in `docs/reviews/<task>/`.
- Pushing to `main` publishes the site. Workers commit on their own `v2-<topic>` branch in a worktree and never merge or push; the orchestrator merges into `main` and pushes once a deliverable has passed review and the finishing loop, with tests, typecheck and `check_unique.py` green.
