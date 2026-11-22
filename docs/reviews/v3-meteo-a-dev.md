# S5.2 partie A — météo en briques : rapport de dev

Branche `v3-meteo-a` (worktree `../spot-elec-v3-meteo-a`), depuis `main` 901e96f. Rien de mergé ni de poussé.

| Commit | Contenu |
|---|---|
| `d2e2d93` | Spec : GAME-DESIGN §2, §3, §4 (règle 1 + schéma autorisé / interdit), §5 (surplus), §9 (paragraphe), §14 (`row`, contrôle du validateur) |
| `7eddf57` | Solveur : validateur, plateau, solveur exact, déduction ; `tests/test_weather.py` |
| `0753795` | Fixtures : `build_fixtures.py`, 5 fixtures à météo refaites, 4 nouvelles |

## Message du validateur (contrat TS)

- Texte exact : `<at>: covers a weather cell at <libellé de colonne>`.
  - `<at>` = `solution.placements[i]` ou `clues[i]` (indice `engaged`).
  - `<libellé>` = `columns[c]` de la **1re colonne fautive** de gauche à droite ; **un seul message par pose**.
  - Exemple : `solution.placements[0]: covers a weather cell at 8h`.
- Condition : `row < F[c] + R[c]` pour une colonne `c` de `[col, col + len)` (bornée à `n`). La case du bas est la plus basse dans toutes les formes, rampes comprises : tester `row` suffit.
- Ignoré si `weather` est invalide ou si `row`, `col` ou `len` sont mal formés (déjà signalés ailleurs).
- **Ordre** :
  - pièce : après `.len`, `goes past the last column` et `.height` (fin de `check_bar_geometry`) ;
  - import : après `goes past the last column` ;
  - les indices sont validés avant la solution, donc `clues[i]` vient avant `solution.placements[j]` (fixture `invalid-engaged-on-weather`).

## Ce qui a changé, par composant

- **Spécification** : GAME-DESIGN uniquement. Aucune technique ni alias nouveau : §9 dit seulement que « Pas de place » et « Le creux coupe le ruban » traitent une brique comme une barre posée.
- **A1 Validateur** (`grid.py`) : closure `check_off_weather`, appelée par `check_bar_geometry` (poses et `engaged`) et pour les imports.
- **A2 Plateau** (`board.py`) : `Puzzle.w[c] = F[c] + R[c]`. Une pose va de `max(w − bas de forme)` à `min(w + maxh − haut de forme)`. Les cellules et masques sont en lignes absolues.
- **A2 Solveur exact** (`exact.py`) : le booléen « ligne sous la silhouette » n° `r` couvre la case absolue `w[c] + r`. `h` reste une hauteur (résiduel + échanges).
- **A3 Déduction** :
  - `state.py` : `View.top_min` / `top_max` (= `w + minh` / `w + maxh`) ; `cells`, `sure`, `column` commencent à `w[c]`. `minh` / `maxh` restent des hauteurs (comptes de `bounds`).
  - `rules.py` :
    - `_at_least` / `_at_most` prennent un haut absolu et le comparent à `w[c] + h` ;
    - `_fits`, `r_silhouette` (besoin, plafond, lignes d'import) en absolu ;
    - `_row_status` : une case sous `w[c]` est `absent`, donc la brique coupe la ligne pour `ribbon` et `share_out` ;
    - les boucles de lignes vont jusqu'à `max(top_max)`.
  - **Traces** : `Placement.label` et les messages `row N` donnent la ligne absolue, sans code à part.
- **A4 Fixtures** : voir plus bas.

## Écarts à la note (`meteo-briques.md`)

- **Pas d'alias** « La météo coupe la ligne » : décision de l'humain, la note est ignorée sur ce point.
- **Message** : la note écrit `placements[i]: …`, mais le préfixe réel des autres messages est `solution.placements[i]`. Je l'ai gardé, et `<colonne>` est le libellé (`8h`), pas l'indice.
- **`trace.py`** : non modifié, rien n'y dépendait des lignes.
- **3e cas nouveau** (« surplus avec brique au-dessus de la demande ») : `valid-surplus-export` le montrait déjà. J'ai quand même ajouté `valid-surplus-brick`, dédié.
- **Fichiers hors périmètre** : `web/`, `generate/` et `lab/` ne sont pas touchés. `build_fixtures.py` écrit seulement dans `fixtures/grids/`.

## A4 — fixtures (70 fichiers, 66 → 70)

- **Nouvelles** :
  - `valid-bar-above-step` : des barres passent au-dessus d'une marche (contrôlé dans le script) ;
  - `valid-surplus-brick` : une brique au-dessus de la demande, absorbée par un export ;
  - `invalid-placement-on-weather` (barre sur une marche) ;
  - `invalid-engaged-on-weather` (indice et pose, 2 messages).
- **Les 5 fixtures à météo variable**, revues une à une en ASCII avant / après. Toutes ont des barres droites, aucune case sur la météo, et les hauts de colonne égaux à demande + échanges :

| Fixture | Avant | Après |
|---|---|---|
| `valid-surplus-export` | 3 barres pliées ; note 2 | même brouillon, nouvelle référence et nouveaux indices ; note 2 (+ `flow`) ; brique à 9h au-dessus de la demande |
| `valid-technique-length` | graine 4 | graine 6, autre grille ; note 2, mêmes techniques |
| `valid-technique-ramp-plateau` | graine 0 | graine 0, même journée, nouvelle référence : la rampe passe au-dessus d'une marche ; note 2 (sans `ramp_lone` ni `ramp_shoulder`) |
| `valid-technique-ramp-shoulder` | graine 0 (copie de la précédente) | graine 2, autre grille ; note 2, `ramp_shoulder` présent |
| `valid-technique-single-spot` | graine 3 ; note 1 | graine 0, autre grille ; note 2 (+ `column_sum`) |

- Les 61 autres fixtures sont identiques, octet pour octet.

## Tests

- **pytest** (`solver/`) : **181 verts** (178 existants + 3 dans `test_weather.py` : poses au-dessus de la météo, marche qui coupe la ligne avec unicité et déduction, messages du validateur). ruff check + format OK.
- **`dispatch-solver check-published`** : OK, 13 grilles uniques et déductibles, notes inchangées.
- **`web/scripts/check_unique.py`** : OK.
- **Vitest** (`web/tests/reference.test.ts`) : non lancé. Il **cassera** tant que B n'est pas fait (nouveau message, nouvelles références) : c'est attendu.

## `mesure.py` comparé au vrai solveur

- **Les 10 candidates valides de la note** : références traduites en lignes absolues (`row + w[col]`). Résultat identique sur les 10 pour les compositions (1), l'égalité à la référence, le statut (`solved`), la note et la liste des techniques.

| Candidate | Note | Référence §14 valide après traduction |
|---|---|---|
| jouer-a n° 6 Grand froid | 4 | oui |
| jouer-a n° 15 Le pic de 19 heures | 2 | **non** (3 barres pliées : dessin à refaire, composition identique) |
| jouer-c n° 1 Grand froid | 1 | oui |
| jouer-c n° 15 Un jour tranquille | 1 | oui (6 barres pliées, mais leur traduction tombe juste) |
| jouer-c n° 16 La STEP au travail | 4 | oui |
| rampe n° 3 Journée froide | 4 | oui |
| rejeu n° 1-4 | 1, 2, 3, 1 | oui |

- **Contrôle élargi** (comptage exact sur les 108 lignes de `mesure-labo.json`, `demo` compris) : 107 identiques.
  - L'écart restant, jouer-b n° 2 (index 1), a 2 compositions des deux côtés. Seul « référence parmi les 2 trouvées » diffère : le plafond `cap=2` rend des compositions qui dépendent du solveur. Ce n'est pas un écart de règle.
