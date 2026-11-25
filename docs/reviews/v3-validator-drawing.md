# Review : `v3-validator-drawing` (S6.3)

**Verdict : OK à merger.** Aucun point bloquant, 4 points mineurs.

Branche relue : `v3-validator-drawing`, commit `bbf00c3` (1 commit sur `main` 7ecbace), auteur `v1`. Spec : `workers/v1.md` (S6.2). Rapport de l'auteur : `docs/reviews/v3-validator-drawing-dev.md`.

## Ce qui a été vérifié

### Formule de couverture
- **Validateur** (TS `checkDrawing`, Python `_check_drawing`) : sommet = `demand` + exports + pompages − turbinages, en lignes absolues. La météo occupe les lignes 0 à R+F−1, les poses complètent jusqu'au sommet.
- **Moteur** (`web/src/engine/state.ts` `rawSilhouette`, `evaluate.ts`) : à remplir au-dessus de la météo = `demand` − R − F + exports + pompages − turbinages. Un surplus non absorbé (valeur < 0) est une erreur `surplus`.
- **Résultat** : les deux formules sont identiques à la translation de la météo près. Le cas « brique météo au-dessus du sommet » du validateur correspond au `surplus` du moteur. Les formes viennent du même profil (`shapes.ts` côté TS, `_profile` côté Python, mêmes colonnes que `solver/.../shapes.py`).
- **Cas légaux cherchés**, tous acceptés (`validate(allow_ramp=True) == []`) :
  - STEP : `valid-step-no-inventory`, `unpublishable-unique-but-stuck` ;
  - export au-dessus de la demande : `valid-three-neighbors`, `valid-partial-totals`, `valid-two-neighbors-co2`… ;
  - surplus météo absorbé : `valid-surplus-brick`, `valid-surplus-export`, plus le test ajouté dans `test_weather.py` ;
  - rampes `trap` : `valid-ramp-study-T1..T4`, `valid-technique-ramp-*` ;
  - rampes `stair` : `valid-ramp-stair`, `valid-ramp-study-E1..E4` ;
  - pièces hautes : `valid-trap-max-cells-tall`, `valid-tall-coal*`, `v3-reprises` 1 et 3, `v3-jouer-b` 5.
- **Comparaison à une référence indépendante** : l'ancien vérificateur du test S5.16 (`drawing_errors`, retiré par la branche, repris de `main`) a été rejoué sur 5428 grilles mutées sans autre erreur. 0 désaccord : aucun refus à tort, aucun dessin faux accepté.

### Messages TS / Python
- **Fuzz croisé** : 6000 grilles mutées, issues de 137 grilles valides (fixtures, 13 publiées, candidates du labo). Mutations : décalage de colonne ou de ligne, pose dupliquée ou retirée, export ±1, demande ±1, paire STEP retirée.
  - `validateGrid()` (via `tsx`) et `validate()` rendent exactement la même liste de messages, dans le même ordre : 0 écart sur 6000.
  - Couverture du fuzz : environ 9600 messages `hole`, 1330 `cell above the silhouette`, 3000 `overlaps`.
- **Fixtures** : `invalid-placements-overlap`, `invalid-drawing-hole`, `invalid-drawing-above-silhouette` attendent chacune un seul message, le bon, des deux côtés :
  - côté Python, `build_fixtures.py` les vérifie ;
  - côté TS, `reference.test.ts`.
- **Rebuild** : relancer `build_fixtures.py` ne modifie aucun fichier (`git status` reste propre).
- **§14** : les textes de `GAME-DESIGN.md` sont les mêmes que dans le code.

### Non-régression
- **`dispatch-solver check --strict`**, exit 0 sur les 6 fichiers :
  - `v3-jouer-a`, `v3-jouer-b`, `v3-jouer-c`, `v3-rampe`, `v3-reprises` et `nuit-rejeu-notees` ;
  - toutes les candidates sont `valid: true`, avec 1 composition, `matches_reference` et `solved`.
- **`check-published`** et **`check_unique.py`** : 13/13 grilles uniques et déductibles.
- **Grille 11** : `check_unique.py` affiche `rating=1 (stored rating 4)` sur la grille 11. C'est déjà le cas sur `main`, la branche n'y est pour rien.

### Tests (worktree de la branche)
- `cd solver && .venv/bin/pytest -q` : 186 tests verts (3 min 12).
- `solver/.venv/bin/python -m pytest lab/tests -q` : 177 tests verts.
- `web/` :
  - `npm test` : 418 tests verts (11 fichiers) ;
  - `npm run typecheck` : OK ;
  - `npm run build` : OK ;
  - `check_unique.py` : OK.

### Périmètre et conventions
- **Fichiers non touchés** : `web/src/data/grids.json`, `lab/candidates/` et `lab/lots/` (diff vide).
- **Code et commit** : en anglais, en-têtes de fichiers à jour et succincts.
- **Commit** : auteur noreply, aucune mention d'IA ni de `Co-Authored-By`.
- **Branche** : nom sans `/`.
- **Effet hors validateur** :
  - le jeu n'appelle pas `validateGrid` à l'exécution (seuls les tests et `convert-grids.ts` l'appellent) ;
  - côté solveur, le contrôle touche `api.check_grid` (vérification du labo), `cli check` et `generate/lot.py`.

## Points

1. **Mineur : structure du §14.**
   - Le bloc « Dessin de la solution » est inséré entre le paragraphe « Contrôles du validateur » et la puce `bulletin`.
   - Cette puce appartient à la liste « Champs de la grille complète », qui est plus haut. Elle se retrouve isolée après le bloc, comme si elle faisait partie du contrôle du dessin.
   - Correction : déplacer le bloc après le paragraphe sur l'inventaire exact (fin du §14), ou remonter les « Contrôles du validateur » et le bloc du dessin sous la liste des champs.
2. **Mineur : profil dupliqué en Python.**
   - `grid.py` définit `_profile()`, alors que `dispatch_solver/shapes.py` (`shapes_of`, `Shape.columns`) décrit déjà les mêmes profils `trap` et `stair`.
   - Côté TS, le validateur réutilise bien `profile()` de `shapes.ts`.
   - Si une forme change, il faudra penser aux deux endroits. `shapes.py` n'importe rien de `grid.py` : l'import ne crée pas de cycle.
3. **Mineur : limite sur les chevauchements multiples.**
   - Si une case est recouverte par 3 poses ou plus, seule la dernière pose déjà en place est citée.
   - La limite est documentée dans le rapport de dev, mais pas au §14, qui annonce « un par paire ».
   - Le comportement est identique en TS et en Python (0 écart au fuzz). Sans conséquence pratique, puisque la grille est refusée de toute façon.
4. **Mineur : effets de bord à suivre (hors périmètre).**
   - Le générateur (`generate/lot.py`) appelle `validate()` : une candidate au dessin faux devient un rejet nommé `invalid: solution…` dans les stats, et n'est plus écrite dans le lot. C'est le comportement voulu, mais aucun lot n'a été régénéré pour mesurer l'effet sur les quotas.
   - `lab/candidates/V3.md` cite encore l'ancien test de dessin. L'auteur l'a signalé comme hors périmètre.

## Reproduire
- Fuzz TS / Python et comparaison à l'ancien vérificateur : scripts du scratchpad de la session de review (`fuzz/gen.py`, `fuzz/ts_validate.ts`, `fuzz/cmp.py`). Ils ne sont pas versionnés.
- Les autres vérifications utilisent les commandes de `CLAUDE.md`, lancées dans `../spot-elec-v3-validator-drawing`.
