# dispatch-solver

Solveurs et générateur des grilles de Dispatch, au format §14 de `GAME-DESIGN.md`. Conception : `docs/next/solver-v2.md`. L'ancien solveur (format « pose », modes à score) est archivé dans `docs/archive/solver-v1/`.

## Installation et tests

```bash
cd solver
uv sync                 # Python >= 3.11, OR-Tools, pytest
.venv/bin/pytest -q     # ~170 tests, ~3 min
```

## Commandes

```bash
.venv/bin/dispatch-solver check ../web/src/data/grids.json --id 7     # validité, compositions, déduction, note (JSON)
.venv/bin/dispatch-solver deduce ../web/src/data/grids.json --id 11   # trace de déduction complète
.venv/bin/dispatch-solver check-published                             # comme web/scripts/check_unique.py (rampes acceptées)
.venv/bin/dispatch-solver check ../lab/candidates/demo-01.json --index 0 --strict  # code 1 si la grille n'est pas publiable
.venv/bin/dispatch-solver generate ../lab/lots/demo-01.json --out /tmp/lot # remplit un lot (par défaut dans lab/candidates/)
.venv/bin/python scripts/build_fixtures.py [rampe/grids.json]         # reconstruit fixtures/grids/
```

## Modules

| Module | Rôle |
|---|---|
| `grid.py` | validateur §14, portage de `validateGrid()` (mêmes messages) ; rampes derrière `allow_ramp` (passé par `check-published`, `check`, le labo) |
| `shapes.py` | formes case par case : rectangle, pièce haute, rampe `trap` (1-2-1) et `stair` (2-1) du charbon |
| `clues.py` | sens de l'inventaire et des indices, partagé par les deux solveurs |
| `board.py` | poses possibles, options de silhouette (STEP × exports par colonne), composition §8.1 |
| `exact.py` | CP-SAT : compte les compositions (unicité) et rend une solution |
| `deduce/` | solveur de déduction : techniques du §9, trace, note provisoire |
| `generate/` | brouillon, pose de référence (ordre d'appel), sélection d'indices minimale |
| `api.py`, `cli.py` | points d'entrée (dicts JSON) pour la CLI, `check_unique.py` et le labo |

## Jeu de référence partagé

`fixtures/grids/` (racine du dépôt) : grilles valides, invalides et non publiables, chacune avec son bloc `expect`. Les tests pytest (`tests/test_grid.py`, `tests/test_fixtures.py`) et Vitest (`web/tests/reference.test.ts`) les jouent : même verdict du validateur, même composition, rampes comprises. Les grilles publiées sont jouées en plus, directement depuis `web/src/data/grids.json`.
