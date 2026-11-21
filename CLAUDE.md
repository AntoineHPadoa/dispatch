# Dispatch

Printable logic puzzle on the power grid: fill the day's demand curve with power plants (rectangles: width = running time, height = power), following the market clues. One solution per grid, no score. Static web game (French) published on GitHub Pages. Game rules and grid format: `GAME-DESIGN.md`.

## Map

- `web/` — the game (TypeScript + Vite, no framework, Vitest).
  - `src/model/grid.ts` — grid format (§14) types and `validateGrid()`.
  - `src/engine/` — pure engine, no DOM, immutable state: actions, rules, clue status, verdict on the composition (§8.1).
  - `src/ui/` — hash router, home, game screen (SVG board, gestures, undo, progress in `localStorage`), print sheets; `src/styles/` screen and print CSS.
  - `src/i18n/fr.ts` — every text shown to the player.
  - `src/data/grids.json` — the 11 grids (7 tutorial, 4 rated).
  - `scripts/convert-grids.ts` (prototype format → §14), `scripts/check_unique.py` (every grid unique, equal to its reference and deducible, with `dispatch_solver`).
  - `tests/` — Vitest: grids, engine, place-over, convert, UI logic, shared reference grids.
- `solver/` — Python package `dispatch_solver` (OR-Tools CP-SAT), §14 native: validator (port of `validateGrid`, same messages), cell-by-cell shapes (rectangles, tall pieces, coal ramps `trap`/`stair` behind a flag), exact solver (uniqueness on the composition), human-deduction solver (§9 techniques, traces, provisional rating), generator (lots with imposed diversity, minimal clues, bulletin drafts), CLI `dispatch-solver`. Design: `docs/next/solver-v2.md`. The old pose-format solver is in `docs/archive/solver-v1/`.
- `fixtures/grids/` — shared reference grids (valid, invalid, unpublishable, each with `expect`), played by pytest and by `web/tests/reference.test.ts`; rebuilt by `solver/scripts/build_fixtures.py`.
- `lab/` — grid lab data: `lots/<lot>.json` (generator configs and quotas), `candidates/<lot>.json` (§14 grids + `lab` block: measures, bulletin draft) and `.stats.json`.
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
.venv/bin/pytest -q       # solver tests (~1 min)
.venv/bin/dispatch-solver check ../web/src/data/grids.json --id 7   # validity, compositions, deduction, rating
.venv/bin/dispatch-solver deduce ../web/src/data/grids.json --id 11 # deduction trace
.venv/bin/dispatch-solver generate ../lab/lots/demo-01.json         # fill a lot into lab/candidates/
```

Skills in `.claude/skills/`: `add-grid` (create, convert, check, play a grid), `run-app` (servers, headless Chrome captures, print PDF), `deploy` (workflow, checking the live site).

## Conventions

- Code, identifiers, comments, logs and developer errors in English; player-facing text in French, only in `web/src/i18n/fr.ts`.
- File headers: short English bullets on what the file does, current state only.
- Grids follow §14 and must pass `validateGrid()`; change the format in `grid.ts`, the validator and `GAME-DESIGN.md` §14 together.
- A piece's legal shapes are its allowed widths × allowed heights. A STEP grid publishes its number of pairs (`inventory.step`, or `step` in an `exchanges` clue). A price clue names a plant, never a value, and never sits on a column with an import.
- A grid is solved on its composition (cells per piece and column, exports, pumping, turbining), not on the drawing.
- Progress lives in `localStorage` under `dispatch:progress:v1`: renaming the key wipes players' progress.
- UI follows `docs/style-reference.html`; the page never scrolls horizontally (check at 320 px).

## Git

- Branch names without `/` (use `-`).
- No mention of Claude or AI in commits, PRs or code (no `Co-Authored-By`, no "Generated with").
- Commit author: the repo's noreply address (`git config user.email`); the history is public.
- `backup-before-squash` is a local-only branch (old history): never push it; push `main` only.
- Every deliverable is reviewed by an agent other than its author: report in `docs/reviews/<task>.md`, captures in `docs/reviews/<task>/`.
- Pushing to `main` publishes the site. Workers commit on their own `v2-<topic>` branch in a worktree and never merge or push; the orchestrator merges into `main` and pushes once a deliverable has passed review and the finishing loop, with tests, typecheck and `check_unique.py` green.
