# S6.2 : le validateur contrôle le dessin de la solution (rapport de dev)

Branche `v3-validator-drawing` (worktree `../spot-elec-v3-validator-drawing`), depuis `main` 7ecbace.

## Objectif
- `validateGrid()` (TS) et `validate()` (Python) refusent deux poses qui se recouvrent et une silhouette mal couverte par le dessin de la solution.
- Suite du point 6 de `docs/reviews/v3-meteo-c.md`.
- Hors périmètre : `grids.json`, lots du labo, `lab/candidates/V3.md` (il cite encore l'ancien test de dessin).

## Ce qui a été fait
- **Règle** (formule de §3, du moteur et du test S5.16) : sommet de la colonne = `demand` + exports + pompages − turbinages. La météo et les poses remplissent exactement les lignes 0 à sommet − 1.
- **Quand** : contrôle lancé seulement sur une grille sans autre erreur. Les cellules se calculent alors sans risque, et les fixtures invalides gardent leur erreur unique.
- **Messages** (identiques TS / Python, écrits dans `GAME-DESIGN.md` §14) :
  - `solution.placements[i]: overlaps solution.placements[j] at <col>` : un par paire, j < i, 1re colonne commune ;
  - `solution: hole at <col>, row <r>` : un par colonne, ligne fautive la plus basse ;
  - `solution: cell above the silhouette at <col>, row <r>` : idem. Couvre aussi la brique météo d'un surplus non absorbé.
- **`placements` vide = pas de dessin** : la couverture n'est pas contrôlée. Ce cas existe déjà : 2 grilles de la galerie UI (906, 907) et `unpublishable-trap-tall-vs-two-bars` (deux compositions, pas de référence). Une grille publiée est couverte par `check_unique.py`, qui compare sa composition à celle du solveur.
- **Fixtures** (`build_fixtures.py`, sur la base invalide commune) : `invalid-placements-overlap`, `invalid-drawing-hole`, `invalid-drawing-above-silhouette`. Le rebuild ne change aucune autre fixture.
- **Test S5.16** : `lab/tests/test_candidate_drawings.py` appelle maintenant `validate(grid, allow_ramp=True)` et exige un dessin non vide. Son vérificateur maison est retiré.
- **Tests ciblés** : `web/tests/ramp.test.ts` (case sur le plateau d'une rampe, dessin vide) ; `solver/tests/test_weather.py` (surplus absorbé ou non par des exports, chevauchement sans case en trop).
- **Limite connue** : si une pose recouvre une case déjà recouverte deux fois, seule la dernière pose en place est citée (même chose en TS et en Python).

## Tests réalisés
Commit `bbf00c3` sur `v3-validator-drawing`.
- **Solveur** : `cd solver && .venv/bin/pytest -q`, 186 tests verts (3 min 09).
- **Publication** : `dispatch-solver check-published` et `check_unique.py` OK, 13 grilles uniques et déductibles.
- **Labo** : `pytest lab/tests -q`, 177 tests verts. Dont 90/90 candidates actives validées par le validateur, dessin compris.
- **Web** : `npm test` 418 tests verts (11 fichiers), dont les 3 nouvelles fixtures ; `npm run typecheck` et `npm run build` OK.
- **Non-régression** : 13/13 grilles publiées et 90/90 candidates passent `validate(allow_ramp=True)` sans erreur.
- **Lint** : `ruff check` propre sur les fichiers touchés (61 erreurs déjà présentes ailleurs sur `main`).
