# spot-solver

> Les modes à score (v1, v2, cible) ne servent plus au jeu ; seul le mode pose compte.

Solveur exact (OR-Tools CP-SAT), vérificateur d'unicité, solveur de déduction humaine (pur Python, note de
difficulté) et générateur de grilles pour Dispatch.
Règles de pose : `../docs/archive/demo-spec.md` §1-2 ; score v2, objectifs et format : `../docs/archive/scoring-v2.md`.

## Installation

```bash
cd solver
uv sync            # Python >= 3.11, ortools, pytest (groupe dev)
uv run pytest -q   # 82 tests, ~15 s
```

## Commandes

```bash
# Optimum, solution complète, nombre de compositions optimales, difficulté (JSON)
uv run spot-solver solve examples/grid8_v2.json --pretty
uv run spot-solver solve ../docs/archive/demo/grids.json --id 7      # grille v1 : coût puis facture

# Une ligne par grille d'un fichier (v1 ou v2 détecté seul), comparée à `optimum` si présent
uv run spot-solver check ../docs/archive/demo/grids.json

# Grilles publiables (composition optimale unique) en JSON v2 sur stdout, stats sur stderr
uv run spot-solver generate --cols 8 --count 5 --seed 1 > out.json
uv run spot-solver generate --cols 10 --pieces N,B,C,G,T --neighbor --step 1 --surplus \
    --co2-cap 12 --min-difficulty 10 --count 3 --seed 1
uv run spot-solver generate --cols 8 --pieces N,B,G,T --neighbors DE:2,UK:1,FR:0 --co2-cap 6 --count 2
uv run spot-solver generate --cols 8 --objective target --no-import --neighbor --count 3
```

Options du générateur : `--cols` (4 à 12), `--hmin`/`--hmax`, `--pieces` (parmi N,B,C,G,T, barème v2),
`--b-cap`, `--n-cap`, `--neighbor` (un voisin) ou `--neighbors id:co2,...`, `--neighbor-cap`, `--step`,
`--surplus` (une colonne négative, écrêtement à `--curtail-penalty`), `--objective min_score|target`,
`--price-cap`, `--co2-cap`, `--no-import`, `--smooth`, `--min-difficulty`, `--seed`, `--max-attempts`.

## Format v2 lu et écrit

Celui de `scoring-v2.md` §5 :

- `pieces` : `{id: {len, price, co2, cap?}}` ; `cost` (v1) est accepté à la place de `price`.
- `neighbor` (un voisin, lu comme le voisin `X` à CO₂ 0 ; import noté `I`, `exports` en liste)
  ou `neighbors` : liste de `{id, name, price[], cap, export_budget, import, export, co2}` ; import noté
  `I:DE`, `exports` en objet `{"DE": [...], ...}`. `export_budget` (blocs exportables sur la journée)
  vaut 2 par défaut en v2 et n'existe pas en v1.
- `step`, `curtail_penalty`, `objective: {optimize: min_score|target, target, constraints: {price_cap, co2_cap, no_import, smooth}}`.
- Écrits par le générateur : `optimum: {score, co2}`, `solution: {exports, step, curtail, placements}`,
  `difficulty: {value, cells, mechanics, decoys, optimal_compositions}`. `solve` rend aussi `trades`
  (blocs échangés de la solution).

## Comment ça marche

- **Placement exact** : un booléen par barre possible (pièce, ligne, colonne, longueur) ; chaque case
  sous la silhouette est couverte exactement une fois. La silhouette est variable (exports, STEP,
  écrêtement), via des booléens « ligne r < h[c] » monotones. Les compter par colonne ne suffirait pas :
  deux barres de 2 qui se chevauchent sur une colonne de hauteur 2 entre deux colonnes de hauteur 1 sont
  comptables mais pas posables.
- **Score v2** : prix de colonne = max des prix des pièces présentes (0 si rien à paver), − recettes
  d'export + pénalités d'écrêtement. Départage à score égal : le **coût** minimal (somme des prix de
  toutes les cases posées, imports au prix du voisin ; `scoring-v2.md` points 4-6), puis le moins de blocs
  échangés (imports + exports). Plus de cases chères gâchées sous la case la plus chère d'une colonne. Mode v1 : coût minimal, puis facture minimale à ce coût.
- **Comptage** : score (ou cible), coût puis nombre d'échanges fixés à leur optimum, on énumère les
  solutions distinctes par coupes « au moins une variable diffère ». En v2 comme en v1, une solution
  distincte est une **composition** : cases par pièce et par colonne (imports par pays), exports, STEP,
  écrêtement (v2 seulement) ; le dessin des barres ne compte pas. Plafond 10 (`--cap`) : « >= 10 ».
- **Difficulté** = `cases/10 + mécaniques + 2·log2(1 + leurres)` :
  la taille compte peu ; chaque mécanique active (pièce au-delà de N, voisin, CO₂ importé, STEP, surplus,
  contrainte) ajoute une règle à tenir ; les leurres (plafond 20) mesurent combien de pistes presque
  justes il faut écarter, ce qui fait la vraie difficulté. Un leurre est une **composition au score
  optimal (ou à la cible) dont le coût est le coût optimal + 1**. Choix le plus simple, valable pour
  `min_score` comme pour `target` : compter les compositions à score optimal + 1 les noierait dans les
  variantes gaspilleuses (cases chères sous une case plus chère).

## Mode pose

Conception : `../docs/archive/pose-mode.md`. Une grille `"mode": "pose"` n'a pas de score : elle est publiable si une seule
**composition** (cases par pièce et créneau, imports par pays, exports, STEP) pose tout l'inventaire en
respectant les indices de prix. `solve` et `check` détectent le mode seuls.

```bash
uv run spot-solver solve examples/pose_s7.json --pretty
uv run spot-solver generate --mode pose --level bars --cols 8 --neighbor --pieces N,G,T --count 5 > pose.json
uv run spot-solver generate --mode pose --level cells --cols 8 --neighbors DE:2,FR:0 --co2-cap 8 --max-clues 4
```

- **Format lu** : celui de `pose-mode.md` §6, plus les voisins (`neighbor` / `neighbors`, comme en v2), qui
  donnent les prix et les capacités des échanges. `inventory.pieces[id]` vaut `{"bars": [...]}`,
  `{"count": n, "cells": m}` ou `{"cells": m}` ; c'est la forme des clés qui compte, `level` ne sert qu'à
  la difficulté. Une pièce absente de l'inventaire n'est pas posée. `exports` : total par voisin (une clé
  absente = 0). `imports` : total par pays (`{"DE": 2}`) ou tous pays confondus (`{"I": 3}`) ; sans clé,
  aucun import. `step` : nombre exact de paires. Pas d'écrêtement (`curtail_penalty` ignoré).
- **Modèle** : le modèle v2 (`model.build`) plus des égalités sur l'inventaire (barres par longueur, nombre
  de barres, cases), les imports, les exports et le STEP, et `col_price[c] == indice` pour chaque indice
  publié. `co2_cap` vient de `constraints`. Comptage : coupes « au moins une variable de composition
  diffère », plafond 10 (`--cap`).
- **Générateur** (`pose.py` pour le modèle, `generate.py` pour la recherche) :
  1. silhouette et parc tirés comme en v2 (sans écrêtement), pose de référence = score v2 minimal avec le
     départage par le coût puis par le moins d'échanges ;
  2. inventaire au niveau demandé (`exact` : barres des pièces longues, cases des pièces d'une case ;
     `bars` : nombre de barres et de cases ; `cells` : cases) ;
  3. test avec **tous** les prix publiés : s'il reste plusieurs compositions, la grille est rejetée
     (« not unique ») ;
  4. sinon, indices minimaux : départ sans indice, on publie à chaque tour le créneau qui écarte le plus
     de compositions parmi les 10 premières énumérées, jusqu'à l'unicité ; puis on retire un à un les
     indices qui ne servent plus. Comme l'unicité est monotone en les indices, l'ensemble final est
     minimal : retirer n'importe lequel de ses indices donne plusieurs compositions (testé) ;
  5. rejet si plus de `--max-clues` indices (défaut : la moitié des créneaux, arrondie à l'entier inférieur) ;
  6. difficulté = niveau (exact 0, bars 3, cells 6) + 2 × (créneaux sans indice / créneaux) × 5 + mécaniques
     (pièces au-delà de N, voisins, CO₂ importé, STEP, plafond CO₂). Formule de la conception, non recalée.

### Exemple §7

Avec le solveur, la grille « pointe isolée » est **publiable** (1 composition, CO₂ 14) et ses prix sont
`[0, 2, 5, 0, 5, 2]`. Elle l'est même **sans aucun indice** : l'inventaire seul force la pose (le raisonnement
du §7 n'utilise l'indice « 5 » à 8h que pour confirmer), donc l'ensemble minimal d'indices est vide. Le fichier
est `examples/pose_s7.json` (avec ses 5 indices d'origine) ; le test `test_example_section_7` vérifie les deux.

### Mesures (ancien générateur : indices de prix, unicité seule)

100 tirages par ligne (seed 1, les trois niveaux voient les mêmes silhouettes), Apple Silicon, 8 workers.
« Publiables » = grilles gardées sur 100 tirages ; « indices » = moyenne sur les grilles gardées ;
« temps » = moyenne par tirage (référence + recherche des indices).

| Configuration | Niveau | Publiables | Indices (moy.) | Temps / tirage |
|---|---|---|---|---|
| A : 6 créneaux, N,G,T, sans voisin | exact / bars / cells | 88 / 88 / 88 | 0 / 0 / 0 | 0,03 s |
| B : 6 créneaux, N,G,T, voisin | exact | 83 | 0,30 | 0,06 s |
| | bars | 72 | 0,29 | 0,06 s |
| | cells | 69 | 0,32 | 0,06 s |
| C : 8 créneaux, N,G,T, voisin + 1 STEP | exact | 14 | 0,50 | 0,08 s |
| | bars | 12 | 0,50 | 0,09 s |
| | cells | 10 | 0,50 | 0,08 s |
| D : 8 créneaux, N,B,G,T, sans voisin | exact / bars / cells | 94 / 94 / 94 | 0,45 / 0,45 / 0,45 | 0,06 s |
| E : 8 créneaux, N,G,T, DE (CO₂ 2) + FR (CO₂ 0), plafond 8 | exact | 6 | 2,8 | 0,11 s |
| | bars | 4 | 3,0 | 0,11 s |
| | cells | 4 | 3,0 | 0,11 s |

Lecture :
- Les rejets sont presque tous « pas unique même avec tous les prix » : STEP (C : 86 à 90 rejets) et
  deux voisins (E : 92 à 94) créent des compositions de même profil de prix, que les indices ne départagent pas.
  « Trop d'indices » est rare (0 à 5 sur 100). Aucun tirage infeasible, aucune lenteur (≤ 0,11 s en moyenne).
- Sans voisin (A, D), la pose de référence est presque toujours forcée par l'inventaire : 0 indice, peu
  de différence entre les niveaux. Les niveaux se distinguent surtout avec voisin (B : 83 → 69 publiables).
- Ces grilles sont souvent faciles : la difficulté se règle surtout par le niveau et les mécaniques.
  Pour des grilles à indices, préférer un voisin, sans STEP, ou accepter un taux de publiables bas.

## Déduction humaine et indices du lore (mode pose)

Les mesures ci-dessus montraient des grilles trop faciles : l'inventaire seul forçait presque toujours la pose,
et le niveau d'inventaire ne changeait rien. Cette section applique les standards des jeux de logique :
**résoluble sans essai-erreur**, **note par la technique la plus avancée nécessaire**, **techniques nommées**,
**aucun indice inutile**.

```bash
uv run spot-solver deduce examples/pose_s7.json             # déroulé des déductions, puis la note
uv run spot-solver deduce grilles.json --id 3 --max-level 2 # ne s'autorise que les règles des niveaux 1-2
uv run spot-solver generate --mode pose --level none --cols 8 --neighbor --step 1 --count 5 > pose.json
uv run spot-solver generate --mode pose --level none --cols 8 --neighbor --rating 4 --count 3
uv run spot-solver generate --mode pose --clue-types legacy ...   # ancien générateur (prix, unicité seule)
```

### Indices du lore

Dans `clues` (liste). `price_clues` reste lu (chaque valeur devient un indice `price`). Le générateur écrit
aussi un champ `text` (affichage en français) ; il n'est pas lu.

| Type | JSON | Affichage | Contrainte |
|---|---|---|---|
| `price` | `{"type": "price", "col": 2, "value": 2}` | « À 8h, le prix est de 2 : c'est le gaz qui le fixe. » | prix de colonne = valeur |
| `bar` | `{"type": "bar", "piece": "N", "col": 1, "len": 4}` | « Un(e) réacteur tourne de 4h à 20h. » | une barre de la pièce couvre exactement ces créneaux, ligne libre |
| `column` | `{"type": "column", "col": 4, "counts": {"G": 2, "T": 0}}` | « Relevé de 16h : 2 cases de gaz, aucune case de TAC. » | cases de chaque pièce citée dans la colonne |
| `given` | `{"type": "given", "piece": "G", "row": 3, "col": 1, "len": 2}` | « Déjà engagé(e) : centrale à gaz de 4h à 12h, ligne 4. » | barre pré-posée |
| `flow` | `{"type": "flow", "col": 5, "country": "DE", "dir": "export", "value": 1}` | « À 20h, 1 bloc exporté vers DE. » | export (ou import, `"dir": "import"`) du créneau avec ce pays |

`country` vaut `X` pour un voisin unique (`neighbor`). Chaque indice est une contrainte du modèle CP-SAT
(`pose.apply_clue`) ; l'unicité reste vérifiée sur la composition.

### Niveau d'inventaire `none`

`inventory.pieces[id] = {}` : la pièce est disponible, sans compte (ni barres, ni cases). Seules les pièces de
la pose de référence sont listées. Les échanges (`exports`, `imports`, `step`) gardent leurs totaux.
`exact`, `bars` et `cells` sont inchangés.

### Solveur de déduction (`deduce.py`)

- **État** : barres candidates (pièce, ligne, colonne, longueur), silhouettes encore possibles (choix des
  exports et des STEP), comptes à respecter (inventaire, relevés, flux d'import, plafond de pièce).
- **Boucle** : à chaque tour, la règle **la plus facile** qui s'applique est appliquée à toutes ses occurrences,
  puis on recommence au niveau 1. Les règles n'excluent que des candidats qu'aucune solution n'utilise et ne
  posent que des barres que toutes les solutions utilisent.
- **Résolue** quand la silhouette est unique et que la **composition** est connue : chaque case n'a plus
  qu'une pièce possible, ou chaque colonne a un compte connu par pièce (« Cases interchangeables »).
  Sinon la grille est **bloquée** : non résoluble sans essai-erreur, donc non publiable.
- **Note** = niveau de la règle la plus avancée utilisée : 1 Facile, 2 Moyen, 3 Difficile, 4 Expert. `solve`
  la rend dans `difficulty.rating` (`null` si bloquée) avec `difficulty.techniques` (règles utilisées).
- **Vérifié** : quand la déduction aboutit, CP-SAT trouve une seule composition, la même (tests sur tirages).
  Grilles uniques mais bloquées : elles existent (ex. `UNIQUE_BUT_GUESS` dans `tests/test_deduce.py`), et sont
  rejetées.

### Règles de déduction (pour le tutoriel)

| Niveau | Règle | Id | Phrase pour le joueur |
|---|---|---|---|
| 0 | Centrale engagée | `given` | Une barre déjà posée par l'énoncé est acquise. |
| 1 | Pas de place | `room` | Une barre ne peut ni dépasser de la silhouette ni chevaucher une barre déjà posée. |
| 1 | Inventaire épuisé | `exhausted` | Quand toutes les cases d'une pièce sont trouvées, elle ne va nulle part ailleurs ; une barre plus longue que ce qu'il reste ne passe plus. |
| 1 | Le prix plafonne la colonne | `price_cap` | Sous un prix publié, aucune case n'est plus chère que ce prix. |
| 1 | Le relevé compte les cases | `record` | Un relevé de production donne le nombre de cases d'une pièce dans la colonne : s'il est atteint, plus aucune ; s'il reste juste assez de cases possibles, elles y passent toutes. |
| 1 | Flux publié | `flow` | Un flux d'interconnexion publié fixe l'export ou l'import d'un créneau avec un pays. |
| 1 | Une seule barre pour cette case | `single_cover` | Une case à paver qu'une seule barre peut encore couvrir reçoit cette barre. |
| 1 | La barre qui ne tient qu'à un endroit | `single_spot` | Une barre de l'inventaire qui n'a plus qu'une place possible y va. |
| 1 | Programme publié | `program` | La barre annoncée par un programme de centrale va sur la seule ligne où elle tient. |
| 1 | La silhouette suit les barres | `silhouette` | Un export ou un pompage qui laisserait une case impossible à couvrir, ou une barre posée hors de la silhouette, est exclu. |
| 1 | Cases interchangeables | `swap` | Quand on connaît le nombre de cases de chaque pièce dans une colonne, l'ordre de ces cases ne compte pas : la composition est trouvée. |
| 2 | La case la plus chère | `top_price` | Un prix publié exige au moins une case à ce prix dans la colonne : s'il n'y a qu'une case possible, c'est elle. |
| 2 | Le creux coupe le ruban | `ribbon` | Chaque ligne se découpe en rubans entre les creux : une barre qui laisserait un bout de ruban impossible à remplir est exclue, une barre présente dans tous les découpages est posée. |
| 2 | Inventaire juste | `just_enough` | S'il reste exactement autant de cases possibles que de cases à poser pour une pièce, toutes ces cases sont à elle. |
| 2 | Compter la colonne | `column_sum` | Une colonne a autant de cases que sa hauteur : connaissant le compte des autres pièces (relevés, inventaire, ligne d'échange, prix), on en déduit celui qui reste. |
| 2 | Plafond carbone | `carbon` | Une barre qui, ajoutée au CO₂ minimal déjà engagé, dépasserait le plafond est exclue. |
| 3 | Répartition de l'inventaire | `share_out` | Les barres de l'inventaire doivent toutes trouver une ligne : un découpage de ligne qui empêche les autres lignes de recevoir le reste est exclu. |
| 4 | Hypothèse réfutée | `refuted` | Si poser une barre (ou choisir un export) mène, par les règles simples, à une impasse, ce choix est exclu. |

Niveau 0 : un fait donné par l'énoncé, il ne compte pas dans la note. « Hypothèse réfutée » est une contradiction
à un coup : elle n'enchaîne que des règles des niveaux 1-2, jamais une hypothèse dans l'hypothèse.

### Générateur à indices minimaux

1. Tirage, pose de référence et inventaire comme avant (la pose de référence est gardée telle quelle).
2. **Réserve d'indices** : tout ce que la pose de référence peut publier, pour les types demandés
   (`--clue-types`, tous par défaut) : un prix par créneau, un relevé par créneau et par pièce, un flux par
   créneau et par pays, un programme et une barre engagée par barre posée.
3. **Ajout glouton** : tant que la déduction bloque, on ajoute l'indice qui laisse le moins de cases indécises
   après les règles simples (niveaux 1-2) ; à égalité : prix, relevé, flux, programme, barre engagée.
4. **Élagage** : on retire un à un les indices dont la grille peut se passer (barres engagées d'abord, prix en
   dernier). La résolubilité est monotone en les indices : retirer n'importe quel indice restant bloque la
   déduction (testé).
5. Rejets : `unsolvable` (bloquée même avec toute la réserve ; jamais observé), plus de `--max-clues` indices
   (défaut : le nombre de créneaux), note différente de `--rating` (`too easy`). Avec `--rating r`, la
   déduction s'interdit les règles au-delà du niveau r ; une grille de note inférieure est rejetée.
6. Filet de sécurité : CP-SAT recompte les compositions (toujours 1 sur les mesures).

### Mesures (déduction, indices du lore)

100 tirages par ligne, seed 1 (les trois niveaux voient les mêmes silhouettes), tous les types d'indices,
note libre (`--rating` absent), Apple Silicon, 3 lots en parallèle. « Indices » : moyenne et maximum sur les
grilles gardées, « 0 » = grilles sans aucun indice. Notes : F Facile, M Moyen, D Difficile, E Expert.

| Configuration | Niveau | Publiables | Indices moy. / max / « 0 » | Notes F / M / D / E | Temps / tirage |
|---|---|---|---|---|---|
| A : 6 créneaux, N,G,T, sans voisin | exact | 88 (12 triviales) | 0,00 / 0 / 88 | 88 / 0 / 0 / 0 | 0,02 s |
|  | cells | 88 (12 triviales) | 0,00 / 0 / 88 | 88 / 0 / 0 / 0 | 0,03 s |
|  | none | 88 (12 triviales) | 2,64 / 5 / 0 | 40 / 48 / 0 / 0 | 0,10 s |
| B : 8 créneaux, N,G,T, voisin | exact | 100 | 1,09 / 4 / 32 | 28 / 40 / 27 / 5 | 0,38 s |
|  | cells | 100 | 1,26 / 4 / 24 | 27 / 44 / 25 / 4 | 0,44 s |
|  | none | 99 (1 trop d'indices) | 1,97 / 6 / 20 | 8 / 59 / 8 / 24 | 0,58 s |
| C : 8 créneaux, N,G,T, voisin + 1 STEP | exact | 100 | 2,14 / 5 / 10 | 14 / 43 / 10 / 33 | 1,44 s |
|  | cells | 100 | 2,35 / 6 / 8 | 18 / 40 / 2 / 40 | 1,74 s |
|  | none | 100 | 2,52 / 8 / 7 | 12 / 41 / 3 / 44 | 1,64 s |
| D : 8 créneaux, N,B,G,T, sans voisin | exact | 94 (6 triviales) | 0,51 / 2 / 63 | 72 / 22 / 0 / 0 | 0,07 s |
|  | cells | 94 (6 triviales) | 0,51 / 2 / 63 | 72 / 22 / 0 / 0 | 0,07 s |
|  | none | 94 (6 triviales) | 3,71 / 7 / 15 | 25 / 41 / 0 / 28 | 0,40 s |

Types d'indices retenus (total sur les grilles gardées) :

| Configuration | Niveau | prix | relevé | flux | programme | barre engagée |
|---|---|---|---|---|---|---|
| A : 6 créneaux, N,G,T, sans voisin | exact | 0 | 0 | 0 | 0 | 0 |
|  | cells | 0 | 0 | 0 | 0 | 0 |
|  | none | 123 | 46 | 0 | 63 | 0 |
| B : 8 créneaux, N,G,T, voisin | exact | 21 | 29 | 5 | 20 | 34 |
|  | cells | 23 | 32 | 5 | 24 | 42 |
|  | none | 52 | 57 | 2 | 28 | 56 |
| C : 8 créneaux, N,G,T, voisin + 1 STEP | exact | 23 | 38 | 107 | 8 | 38 |
|  | cells | 24 | 36 | 110 | 17 | 48 |
|  | none | 29 | 40 | 111 | 21 | 51 |
| D : 8 créneaux, N,B,G,T, sans voisin | exact | 28 | 0 | 0 | 19 | 1 |
|  | cells | 28 | 0 | 0 | 19 | 1 |
|  | none | 177 | 55 | 0 | 89 | 28 |

Lecture :
- **Oui, on obtient des grilles difficiles**, mais seulement avec une mécanique qui crée du choix : un voisin
  (B : 24 % d'Expert au niveau `none`), un STEP (C : 33 à 44 % d'Expert à tous les niveaux), ou sans
  inventaire (D `none` : 28 % d'Expert). Les grilles Expert demandent surtout de placer exports et STEP
  (« Hypothèse réfutée » sur les silhouettes) ou de trancher entre import et nucléaire.
- **Sans voisin, `exact` et `cells` restent triviales** (A : 0 indice, 100 % Facile ; D : 63 % sans indice) :
  la pose de référence (nucléaire en bas, gaz puis TAC) est forcée par les comptes. Le niveau `none` est le
  seul qui rende ces grilles intéressantes (A : 2,6 indices, moitié Moyen).
- **`exact` et `cells` donnent presque les mêmes grilles** (notes à ±8 points près) : connaître les
  longueurs de barres aide peu, car la composition, pas le dessin, est demandée.
- **Le STEP n'est plus un obstacle** : 100 % de publiables en C contre 10 à 14 % avec les seuls prix, car un
  flux ou un relevé fixe le pompage.
- Note D (Difficile) rare hors B : « Répartition de l'inventaire » sert surtout quand les longueurs
  comptent (`exact`, `cells` avec voisin).
- **Barres engagées fréquentes** avec voisin (B, C : 34 à 56 indices `given` sur 100 grilles) : l'heuristique
  gloutonne les aime car elles fixent beaucoup de cases. `--clue-types price,column,flow,bar` les exclut.
- Temps : 0,02 à 1,7 s par tirage ; le niveau 4 (hypothèses) domine en C.

Recommandation : régler la difficulté par la **note** (`--rating`), pas par le niveau d'inventaire. Garder
`exact` pour les grilles d'apprentissage (Facile, souvent sans indice), et `none` pour tout le reste ; `cells`
et `bars` n'apportent rien de plus qu'`exact`. Pour des grilles Difficile/Expert : `none` avec un voisin ou un STEP.

## Temps mesurés (Apple Silicon, 8 workers)

- Grilles v1 : 0,01 à 0,15 s chacune (optimum + unicité).
- Grilles v2 (8 à 12 créneaux, toutes mécaniques) : 0,1 à 0,5 s ; quelques secondes avec les leurres.
- Génération, 6 configurations × 5 grilles (seed 1, `N,G,T` 8 créneaux ; avec voisin ; 10 créneaux
  `N,B,C,G,T` voisin + STEP + surplus + CO₂ ≤ 12 ; `N,B,G,T` trois voisins CO₂ ≤ 6 ; score cible sans
  import ; `N,B,G,T` voisin + plafond 2 + lisse 2) : **30 publiables sur 41 tirages (73 %)**, contre
  30 sur 53 (57 %) avec l'ancienne unicité sur les prix, mesurée sur les mêmes configurations. De 45 %
  (trois voisins) à 100 % (`N,G,T` seuls ; score cible). Ces 6 configurations sont celles du README
  précédent reconstituées : sa liste exacte n'y était pas notée (65 % à l'époque).

## Choix d'interprétation

- **Déduction, composition plutôt que dessin** : la grille est résolue quand la composition est connue, même si
  plusieurs dessins restent (deux rubans échangeables, l'ordre de cases d'une case dans une colonne). Exiger le
  dessin rejetterait des grilles uniques au sens de la conception (§4).
- **Déduction, « Hypothèse réfutée »** : contradiction à un coup par les règles 1-2, classée Expert. C'est la seule
  forme d'hypothèse admise ; une grille qui demande davantage est « non résoluble sans essai-erreur ».
- **Niveau `none`** : seules les centrales perdent leurs comptes ; exports, imports et STEP gardent leur total
  (ce sont des données de marché publiées), sinon la silhouette serait libre.
- **Indices `column`** : le générateur publie un relevé par pièce (une case de compte par indice), pour que la
  minimalité porte sur chaque fait. Le format accepte plusieurs pièces.
- **Indice `bar`** : « au moins une barre » de la pièce sur ces créneaux, ligne libre.
- **Générateur** : en bibliothèque, `GenParams.clue_types=None` garde l'ancien générateur (prix, unicité seule),
  pour les tests existants ; la CLI publie par défaut tous les types d'indices. Une grille à indices du lore
  n'écrit que `clues` (pas `price_clues`). `--max-clues` vaut par défaut le nombre de créneaux (la moitié en
  ancien mode). `difficulty.value` (ancienne formule) compte désormais tous les types d'indices.
- **Limites du solveur de déduction** : plus de 20 000 silhouettes possibles → grille non traitée (`unsupported`) ;
  « Répartition de l'inventaire » est sautée au-delà de 4 000 découpages par ligne.

- **Mode pose, grille triviale** : une pose de référence qui n'a qu'un seul type d'ingrédient (une seule
  pièce, ni import, ni export, ni STEP) est rejetée (`trivial`, 6 à 12 % des tirages sans voisin) : il n'y
  a rien à déduire.
- **Mode pose, STEP et écrêtement** : le STEP est en nombre exact (pas « au plus ») ; l'écrêtement est
  interdit et `curtail_penalty` ignoré, une colonne négative doit être absorbée par un export. Le
  générateur pose `--surplus` sans pénalité ; `--objective`, `--price-cap`, `--smooth` et `--no-import`
  sont ignorés en mode pose.
- **Mode pose, imports tous pays** : le générateur les écrit `{"I": total}` seulement s'il y a plusieurs
  voisins importateurs **et** un plafond CO₂ ; sinon un total par pays.
- **Mode pose, indices** : un indice publie le prix de la pose de référence. Le choix gourmand se fait sur
  les 10 premières compositions énumérées, une approximation si elles sont plus nombreuses.
- **Écrêtement** : autorisé seulement si `curtail_penalty` est présent (demo-spec §1) ; le « 2 par défaut »
  de scoring-v2 est la valeur par défaut du générateur.
- **Prix de colonne négatif** : une colonne pavée seulement d'imports à prix négatif vaut ce prix ; une
  colonne vide vaut 0.
- **STEP** : au plus `step` paires (pas forcément toutes) ; plusieurs paires peuvent partager un créneau.
- **Plusieurs voisins** : chaque ligne a sa capacité (`exports + imports <= cap` par voisin). On peut
  importer d'un pays et exporter vers un autre dans le même créneau. `price_cap` s'applique aussi aux imports.
- **Score cible** : départage par le moins d'échanges, comme en `min_score` ; publiable si un seul
  composition atteint la cible après départage. Le générateur prend la plus petite cible au-dessus
  de l'optimum qui est publiable.
- **Départage puis unicité** : le coût puis le nombre d'échanges sont minimisés avant le comptage, donc
  deux compositions au même score mais plus chères, ou avec plus d'échanges, ne comptent pas comme
  concurrentes.
- **Coût v2** : somme brute des prix des cases (sans recettes d'export ni écrêtement, contrairement au
  `cost` v1) ; renvoyé par `solve` dans `cost`.
- **Prix voisins générés** : marche aléatoire entre −2 et 3, puis chaque créneau a 10 % de chances de
  passer à 4 ou 5 (pointe exceptionnelle).
- **Sortie** : une grille à `neighbor` unique garde le format v1 (`I`, `exports` en liste), pour rester
  compatible avec `docs/archive/demo/engine.js`.

## Observations pour la conception (S5.2)

- Les correctifs de `scoring-v2.md` (budget d'export 2, départage par le coût puis le moins d'échanges, unicité sur la
  composition) ramènent les scores dans −8 à 14 avec un voisin, et le taux de publiables de 3-30 %
  à 42-100 %.
- Avec trois voisins, chacun à 2 blocs d'export, les scores restent nettement négatifs (−11 à −24) :
  l'export pèse encore lourd dès qu'il y a plusieurs lignes.
