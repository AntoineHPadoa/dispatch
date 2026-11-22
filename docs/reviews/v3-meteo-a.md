# Review S5.12 — `v3-meteo-a` (météo en briques : règles, solveur, déduction, fixtures)

**Verdict : OK à merger.** Aucun point bloquant ; 2 points mineurs, à corriger dans la foulée ou à la tâche C.

Branche `v3-meteo-a` (`d2e2d93`, `7eddf57`, `0753795`), relue sur `git diff main...v3-meteo-a` (depuis la base `901e96f`). Le diff `main..v3-meteo-a` à deux points montre aussi `lab/`, `web/` et des revues : ce sont les commits de `main` postérieurs à la base, pas des changements de la branche.

## Points

### Mineur 1 — l'exemple du §14 viole maintenant la règle

- `GAME-DESIGN.md` §14 : l'exemple a `"F": [1, 1, 1, 1, 1, 1, 1, 1]` et `"placements": [{"piece": "N", "row": 0, "col": 0, "len": 8}]`.
- Avec `row` absolu, la ligne 0 est du fil de l'eau sur toutes les colonnes : le validateur répondrait `solution.placements[0]: covers a weather cell at 0h`.
- Une barre N de 8 ne passe pas non plus en ligne 1, où R = 1 à 6h. Il faut une ligne ≥ 3 (haut de la météo : F + R = 3 à 9h et 12h), ou une autre pose.
- Correction : une ligne de spec, sans effet sur le code.

### Mineur 2 — la phrase sur la marche est rangée sous « Surplus »

- §5, puce **Surplus** : « Une marche de météo coupe aussi toute ligne qu'elle traverse : un ruban ne passe pas sur une brique. »
- Cette phrase vaut pour toute grille à météo variable, pas seulement en surplus. Elle est déjà dite au §4, règle 1 (schéma), et au §9.
- Correction : la retirer de la puce Surplus, ou la déplacer sous la règle 1. Pas de nouvelle technique dans le texte : conforme.

## Ce qui a été vérifié

### Spécification (`GAME-DESIGN.md`)

- §2 : lignes numérotées depuis le bas de la grille, ligne 0, météo comprise ; météo = briques imposées F puis R, barres hachurées.
- §3 : R et F à position fixe, jamais recouvertes ; le compte à couvrir reste la demande résiduelle.
- §4, règle 1 : rectangle droit sur une seule ligne réelle, chaque case libre, jamais le relief ; schéma autorisé / interdit identique à la consigne, et la phrase « cases vides sous la barre… ».
- §9 : la brique est une case occupée d'avance pour « Pas de place » et « Le creux coupe le ruban », **sans technique ni alias** (l'alias de la note est bien écarté).
- §14 : `row` = ligne de la case du bas, 0 en bas de la grille ; contrôle du validateur et texte du message. Reste l'exemple (mineur 1).

### Validateur Python (`grid.py`)

- Message : `'<at>: covers a weather cell at <col>'`, `<col>` = libellé de la 1re colonne fautive (`8h`), un seul message par pose.
- Couvre les poses de centrale, les imports et les indices `engaged` (via `check_bar_geometry`).
- Ignoré si `weather`, `row`, `col` ou `len` sont mal formés : pas de double erreur.
- Tester `row` seul suffit : dans `shapes.py`, toutes les formes (rect, tall, trap, stair) ont un décalage bas de 0 par colonne.
- Fixtures `invalid-placement-on-weather` (1 message) et `invalid-engaged-on-weather` (`clues[1]` avant `solution.placements[0]`).

### Plateau et solveur exact (`board.py`, `exact.py`)

- `Puzzle.w[c] = F[c] + R[c]` ; poses générées de `max(w − bas)` à `min(w + maxh − haut)` : aucune case sous la météo, aucune barre pliée possible (une pose = une forme posée à une ligne absolue).
- `exact.py` : le booléen « sous la silhouette » n° `r` couvre la case `w[c] + r` ; l'unicité reste calculée sur la composition (code de comptage inchangé).
- Le test `test_placements_stay_above_the_weather` le vérifie sur toutes les poses d'une grille à marche.

### Déduction (`deduce/state.py`, `deduce/rules.py`)

- Relu toutes les utilisations de `minh`, `maxh` et des lignes :
  - `View.top_min` / `top_max` en absolu ; `cells`, `sure`, `column` partent de `w[c]` ;
  - `_at_least`, `_at_most`, `_fits`, `r_silhouette`, `r_column_sum`, `_row_apply` comparent des hauts absolus ;
  - `bounds` garde `minh` / `maxh` comme des comptes de cases (correct : ce sont des nombres de cases par colonne) ;
  - `_row_status` : une case sous `w[c]` est `absent`, donc la brique coupe la ligne pour `ribbon` et `share_out`.
- Traces : `Placement.label` et `row N` donnent la ligne absolue (+1).
- **Recherche active d'erreurs** (scripts hors dépôt, 1 450 grilles aléatoires de 6 à 8 colonnes, plus 600 sans météo pour comparer) : déduction comparée au comptage exact.
  - Marches de météo, inventaire exact et indices `engaged` : 300 graines, 180 uniques toutes résolues, à la bonne composition.
  - Météo plate de hauteur 1 à 3 comparée à la même grille sans météo, lignes décalées : 150 graines, statut, note et techniques identiques (0 écart).
  - Indices `column`, `price`, `bar`, `length` sans inventaire : 400 graines, 0 contradiction.
  - Marches jusqu'à 5, surplus avec voisin (export d'une brique au-dessus de la demande), inventaire exact ou non : 600 graines, 160 uniques. 157 résolues à la bonne composition ; 3 bloquées, mais **la solution reste candidate** (aucune pose de la solution retirée).
    - 2 des 3 ont une météo plate : ce sont exactement les 2 graines bloquées du même lot sans météo.
    - La 3e (marche 3 → 5) a une composition unique mais deux dessins : un G de 2 et un T s'échangent sur 2 lignes à 0h-3h. C'est la limite existante de la déduction (elle veut un dessin résolu), sans lien avec la météo.
  - Au total : **aucune conclusion fausse** (pas de résolution vers une mauvaise composition, ni de « résolue » sur une grille à 2 compositions, ni de contradiction sur une grille qui a une solution), aucun plantage.
- **Comparaison avec `mesure.py`** sur les 10 candidates valides de la note (références traduites `row + w[col]`) : compositions, égalité à la référence, statut, note et techniques **identiques** sur les 10. Le n° 15 de `nuit-jouer-a` (« Le pic de 19 heures ») a une référence §14 invalide après traduction (`covers a weather cell at 9h`, barres pliées), mais la même composition, comme le dit le rapport de l'auteur.

### Fixtures (4 nouvelles, 5 refaites)

Chaque référence redessinée en ASCII (lignes absolues, briques, cases du dessus) : aucune case sur la météo, aucune case vide sous la silhouette, haut de colonne = demande + exports + pompages − turbinages.

| Fixture | Ce qu'elle montre | Dessin |
|---|---|---|
| `valid-bar-above-step` | Deux barres N de 8 passent au-dessus des marches (w = 0, 2, 0, 1) ; en ligne 1, G et N s'arrêtent de part et d'autre de la marche de 6h-9h | juste |
| `valid-surplus-brick` | Brique à 9h au-dessus de la demande (w = 5, demande 4), couverte par l'export DE | juste |
| `valid-surplus-export` | Même mécanisme, w jusqu'à 5 ; T empilés à 6h | juste |
| `valid-technique-length` | Marches de 4 en bord de jour ; `length` présent | juste |
| `valid-technique-ramp-plateau` | La rampe C de 4, base en ligne 3, passe au-dessus des marches (w = 1, 0, 0, 3) ; plateau en ligne 4 | juste |
| `valid-technique-ramp-shoulder` | La rampe C de 3, base en ligne 2, passe au-dessus d'une marche (w = 1, 0, 0) ; `ramp_shoulder` présent | juste |
| `valid-technique-single-spot` | Météo 3 aux deux bords ; `single_spot` présent | juste |
| `invalid-placement-on-weather` | Barre N en ligne 0 sur la brique de 8h | 1 message attendu |
| `invalid-engaged-on-weather` | Même chose + indice `engaged` sur la brique | 2 messages, ordre indices puis solution |

- Les 61 autres fixtures sont identiques à `main`.
- Couverture des techniques : toutes restent présentes dans au moins une fixture (`ramp_lone` passe de 3 à 1, `ramp_shoulder` de 2 à 1).

### Non-régression

- `cd solver && .venv/bin/pytest -q` : **181 passed** (3 min 10).
- `ruff check` et `ruff format --check` : OK.
- `.venv/bin/dispatch-solver check-published` : 13 grilles, sortie **identique octet pour octet** à celle de `main`.
- `web/scripts/check_unique.py` : OK.
- Vitest sur `v3-meteo-b` (qui contient les 3 commits de A) : **411 tests verts**, dont `tests/reference.test.ts` 100 verts.

### Périmètre et conventions

- Fichiers touchés : `GAME-DESIGN.md`, `solver/src/dispatch_solver/{grid,board,exact}.py`, `deduce/{state,rules}.py`, `solver/tests/test_weather.py`, `solver/scripts/build_fixtures.py`, `fixtures/grids/`. Rien dans `web/src/`, `lab/` ni `solver/.../generate/`.
- Code, commentaires et en-têtes en anglais, état actuel seulement.
- Commits en anglais, auteur `…@users.noreply.github.com`, aucune mention de Claude ou d'IA.
