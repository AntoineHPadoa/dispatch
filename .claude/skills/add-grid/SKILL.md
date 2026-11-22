---
name: add-grid
description: Add or change a Dispatch puzzle grid in web/src/data/grids.json — promote a candidate from the grid lab (main path), or write one by hand in the §14 format — then validate it, check it has exactly one solution, and play it. Use whenever a grid is created, promoted, edited or re-checked.
---

# Add a grid

The game reads `web/src/data/grids.json`: a list of grids in the §14 format (`GAME-DESIGN.md` §14, types and validator in `web/src/model/grid.ts`). Coal ramps (`pieces.C.shape: "trap"`) are played by the game; the stair (`"stair"`) is not. Commands run from `web/` unless stated.

## 1. Main path: lab → promotion

1. Fill a lot with the generator (or from the lab page, "Nouveau lot"):

   ```bash
   cd ../solver
   .venv/bin/dispatch-solver generate ../lab/lots/demo-01.json            # lab/candidates/demo-01.json + .stats.json
   .venv/bin/dispatch-solver check ../lab/candidates/demo-01.json --index 3 --strict   # one candidate (index from 0 = lab.index)
   ```

   A lot (`lab/lots/*.json`) mixes configurations (`cols` 6, 8 or 12, `neighbors`, `step`, `ramp`, `tall`, `surplus`, `co2_cap`, `stock`, `inventory`, `clue_types`, `rating`) under diversity quotas; see `solver/src/dispatch_solver/generate/lot.py`. After a change to the deduction, re-rate existing lots with `solver/scripts/rerate_lots.py`.

2. Play and rate candidates blind in the lab (`lab/run.sh`, then `http://localhost:5173/dispatch/lab.html`; skill `run-app`, section "The lab").
3. Promote from the lab (screen « Gardées », button « Promouvoir vers grids.json »): the server drops the `lab` block, sets the next free `id`, `section: "rated"`, the bulletin (number, title, text, sky, publication date), checks the grid with the solver (valid, one composition, the reference one, deducible) and appends it to `grids.json`.
4. Check and commit (section 3). Tests select grids by property and derive their counts: nothing to update in `web/tests/`.

## 2. Second path: by hand

Copy a grid of the same kind from `grids.json` and edit it, with a new unique `id` (ids stay increasing), a `title`, `section` (`tutorial` with `intro` and `teaches`, or `rated` with a `bulletin`) and `difficulty` (from the solver: `rating` 1-4, `label`, `techniques`).

Rules the validator enforces: 6 to 12 columns; ranks and CO₂ of §3; `pieces` and `inventory.pieces` have the same keys; legal shapes = allowed widths × allowed heights; a STEP grid publishes its number of pairs (`inventory.step` at level `exact`, an `exchanges` clue `step` at level `none`). `npm test` also checks that no price clue sits on a column with an import (§3).

`scripts/convert-grids.ts` (prototype → §14) is a one-off: it refuses to overwrite `grids.json` because it would drop every grid added since.

## 3. Check it

```bash
npm test                                                   # validator + reference solution vs every rule and clue
../solver/.venv/bin/python scripts/check_unique.py         # every grid: compositions=1, deducible, plus its rating
../solver/.venv/bin/python scripts/check_unique.py /tmp/one.json      # one file only
```

`check_unique.py` must print `OK: every grid is unique and deducible`, and the rating it prints must equal the stored one (`(stored rating N)` flags a difference). More than one composition means a missing clue; `deduction=stuck` means the grid needs guessing: add a clue (or keep a stock such as `"B": {"max_cells": 2}`) and re-run.

## 4. Play it

Start the app (skill `run-app`) and open `#/grille/<id>`; check the print sheet at `#/imprimer/<id>`. `node scripts/check-ui.mjs --ids <id>` plays it to the verdict at 1280, 375 and 320 px. Player texts (clues, errors) come from `src/i18n/fr.ts`: a new clue shape may need a new text there.
