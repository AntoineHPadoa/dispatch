---
name: add-grid
description: Add or change a Dispatch puzzle grid in web/src/data/grids.json — write it by hand in the §14 format, or generate one with the Python solver and convert it — then validate it, check it has exactly one solution, and play it. Use whenever a grid is created, converted, edited or re-checked.
---

# Add a grid

The game reads `web/src/data/grids.json`: a list of grids in the §14 format (`GAME-DESIGN.md` §14, types and validator in `web/src/model/grid.ts`). Commands run from `web/` unless stated.

## 1. Get a grid in the §14 format

**Generate** (solver, prototype "pose" format), then **convert** to §14:

```bash
../solver/.venv/bin/spot-solver generate --mode pose --level none --cols 8 --neighbor --count 1 --seed 3 > /tmp/gen.json
npx tsx scripts/convert-grids.ts /tmp/gen.json /tmp/gen14.json   # prints a report: read it
```

- `generate --help` lists the knobs (`--level exact|none`, `--step`, `--rating`, `--pieces`…).
- The converter handles one neighbor (`neighbor`, renamed `DE` Allemagne), levels `exact` and `none`; it moves day totals to an `exchanges` clue at level `none` and turns each price value into the plant that sets the price, reporting every ambiguous case.
- `npm run convert` (no argument) regenerates the whole `grids.json` from `docs/archive/demo/grids-pose.json`: it overwrites hand edits.

**By hand**: copy a grid of the same kind from `grids.json` and edit it. Rules the validator enforces: 6 to 12 columns; ranks and CO₂ of §3; `pieces` and `inventory.pieces` have the same keys; legal shapes = allowed widths × allowed heights; a STEP grid publishes its number of pairs (`inventory.step` at level `exact`, an `exchanges` clue `step` at level `none`). `npm test` also checks that no price clue sits on a column with an import (§3).

## 2. Put it in `grids.json`

- A generated grid comes out with `id: 1` and a title "Pose 1": set `id` to the next free id and give it a real `title`. The converter only gives tutorial intros to the prototype's own grids, but the id still has to be unique.
- Append the object, with a new unique `id`, a `title`, `section` (`tutorial` with `intro` and `teaches`, or `rated`) and `difficulty` (from the solver: `rating` 1-4, `label`, `techniques`).
- Update the expected id list in `tests/grids.test.ts` ("has the … pose grids").

## 3. Check it

```bash
npm test                                                   # validator + reference solution vs every rule and clue
../solver/.venv/bin/python scripts/check_unique.py         # every grid: compositions=1, plus its rating
../solver/.venv/bin/python scripts/check_unique.py /tmp/gen14.json   # one file only
```

`check_unique.py` must print `OK: every grid is unique`. More than one composition means a missing clue: add one (or keep a stock such as `"B": {"max_cells": 2}`) and re-run.

## 4. Play it

Start the app (skill `run-app`) and open `#/grille/<id>`; check the print sheet at `#/imprimer/<id>`. Player texts (clues, errors) come from `src/i18n/fr.ts`: a new clue shape may need a new text there.
