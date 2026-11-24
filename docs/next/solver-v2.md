# Solveur et générateur v2 — conception (S4.1)

Conception d'origine (S4.1), tenue à jour sur les points marqués ; les comptes de grilles (« 11 grilles ») et les mesures datent de S4 et restent comme historique. Base : `GAME-DESIGN.md` (§8, §9, §10, §14), brief v2 §1 et §2, plan rev-3 (S4). Les choix ouverts sont regroupés à la fin (§12), chacun avec ma recommandation.

## 1. Ce qui change, en bref

- **Package neuf** dans `solver/`, au format §14 natif : plus de traduction « pose » dans `check_unique.py`.
- **Pièces décrites case par case** : rectangle, pièce haute, rampe (derrière un drapeau). Le solveur ne connaît plus de « barre » : il connaît des formes posées.
- **Deux solveurs** : exact (CP-SAT, unicité sur la composition §8.1) et de déduction (toutes les techniques du §9, échanges inconnus compris), avec des traces exploitables.
- **Générateur par lots** : diversité imposée, indices minimaux, note provisoire, bulletin par gabarits, sortie au format §14 plus des mesures pour le labo.
- **Jeu de grilles de référence** partagé, joué par Vitest et pytest.

## 2. L'existant et son sort

| Élément | Constat | Sort |
|---|---|---|
| `solver/src/spot_solver/` (2 585 lignes) | format « pose » du prototype ; modes à score v1, v2, cible ; `deduce.py` ignore les totaux d'échanges inconnus ; barres d'une case de haut seulement | archivé dans `docs/archive/solver-v1/` (code, tests, README avec ses mesures), puis supprimé du package |
| `web/scripts/check_unique.py` | traduit §14 → pose (prix = rang, import à 100), lance la CLI en sous-processus | réécrit : importe le nouveau package, lit §14 directement |
| `.github/workflows/deploy.yml` | job solveur : `pytest` + `check_unique.py` | mêmes étapes, nouveau package |
| Idées gardées | variables « ligne r < h[c] » monotones pour la silhouette variable ; comptage par coupes sur la composition ; boucle « règle la plus facile d'abord » ; ajout glouton puis élagage des indices | reprises, réécrites |

## 3. Architecture du package

Nom proposé : `dispatch_solver`, CLI `dispatch-solver` (choix ouvert C2). Python ≥ 3.11, OR-Tools, pytest ; `uv` comme aujourd'hui.

```
solver/src/dispatch_solver/
  grid.py         §14 : dataclasses, lecture/écriture JSON, validate() (port de validateGrid, mêmes messages)
  shapes.py       formes des pièces case par case, énumération des poses
  board.py        silhouette, scénarios d'échanges (exports, imports, STEP), composition §8.1
  clues.py        sémantique des indices, partagée par les deux solveurs
  exact.py        modèle CP-SAT, comptage des compositions, solution
  deduce/
    state.py      état : poses candidates, domaines d'échanges, comptes
    rules.py      une fonction par technique, registre (id, niveau, phrase)
    trace.py      étapes, résumé, export JSON
    rate.py       note provisoire et mesures
  generate/
    silhouettes.py  familles de silhouettes et météo
    reference.py    pose de référence (ordre d'appel)
    cluesel.py      réserve d'indices, ajout glouton, élagage
    lot.py          lots, quotas de diversité, rejets
    bulletin.py     titre, texte, météo par gabarits
  cli.py
solver/tests/     pytest ; lit aussi fixtures/grids/
fixtures/grids/   jeu de référence partagé (§8)
```

Règle : `exact.py` et `deduce/` ne dépendent que de `grid`, `shapes`, `board`, `clues`. Le générateur les appelle ; il ne contient aucune règle de jeu.

## 4. Pièces case par case

### 4.1 Représentation

- Une **forme** est un ensemble de cases relatives à son coin bas-gauche : une liste de colonnes `(dc, bas, hauteur)`. Une pose = (pièce, forme, ligne, colonne) ; ses cases sont calculées une fois.
- Le format §14 ne change pas pour les rectangles : `len` × `height` donnent les formes `w × h` (colonnes `(dc, 0, h)`).
- **Pièce haute** : `height: [2]` ou `[1, 2]` ; déjà prévue par §14 et `validateGrid`, jamais générée jusqu'ici. Rien de neuf dans le solveur : c'est une forme de plus.
- **Import** : forme 1 × 1, pièce `I`, pays en attribut.

### 4.2 Rampe (drapeau)

Format repris de l'étude (`docs/next/rampe.md` §1, trapèze choisi en premier, escalier gardé possible) :

- **La rampe est une forme du charbon** : `"C": {"shape": "trap", "len": [3, 4, 5], "rank": 3, "co2": 3}`. `shape` vaut `"rect"` (défaut), `"trap"` ou `"stair"` ; une seule forme de charbon par grille.
- **Pas de `height`** sur la pièce ni sur ses poses : le profil est fixe. `len` = largeur totale ; `row` = ligne de la base.

| Profil | Cases par colonne | Largeur |
|---|---|---|
| `trap` (1 → 2 → 1) | `1, 2 × (W − 2), 1` | W ≥ 3 |
| `stair` (2 → 1, marche à droite) | `2 × (W − 1), 1` | W ≥ 2 |

- **Drapeau** : le validateur Python n'accepte `shape` ≠ `rect` qu'avec `allow_ramp=True`, et seulement sur C. La CLI (`check`, `check-published`) et `check_unique.py` le passent par défaut, puisque le jeu web joue le trapèze depuis S6 ; `--no-ramp` refuse les rampes.
- **Indices** : `bar` = la pose couvre exactement ces créneaux ; `length` = largeur totale ; `column` compte les cases (2 au plateau, 1 à l'épaule) ; `price` inchangé (rang 3).
- Les 8 mini-grilles de l'étude sont dans le jeu de référence (`valid-ramp-study-*`) : uniques et résolues par le solveur de déduction.

### 4.3 Ce qui reste « rectangle » ailleurs

- Le moteur web (`web/src/engine/`) ne change pas en S4 : il ne connaît que les rectangles, et les grilles publiées n'ont que des rectangles. La généralisation côté web est S6.

## 5. Solveur exact (CP-SAT)

- **Variables** : un booléen par pose possible ; par colonne et par voisin, exports et imports entiers (bornés par `cap`) ; par paire STEP, colonnes de pompage et de turbinage (paires indistinctes, ordonnées pour casser la symétrie) ; hauteur à couvrir `h[c] = résiduel + exports + pompage − turbinage`, encodée par des booléens « ligne r < h[c] » monotones.
- **Contraintes** : chaque case couverte exactement une fois si `r < h[c]`, jamais sinon ; formes permises ; inventaire (exact : barres par largeur, cases ; `max_cells`) ; `exports + imports ≤ cap` par voisin et colonne ; plafond CO₂ ; chaque indice (`clues.py`).
- **Totaux d'échanges** : un total publié (inventaire exact ou indice `exchanges`) est une égalité ; un total non publié est libre. Cas « tous pays » (`"*"`) : somme sur les pays.
- **Composition** (§8.1) : par colonne, cases de chaque pièce (imports par pays) ; exports par voisin et colonne ; pompages et turbinages par colonne. Ce sont des expressions linéaires des variables de pose.
- **Comptage** : énumération avec coupes « au moins une valeur de composition diffère », plafond configurable (2 suffit pour l'unicité, 10 pour le diagnostic). Rend aussi une solution au format `solution` §14.
- **Coût attendu** : 10 à 30 ms par comptage sur l'ancien solveur (mesuré, §7). Pas d'inquiétude.

## 6. Solveur de déduction

### 6.1 État

- **Poses candidates** : ensemble de poses non exclues ; poses acquises.
- **Échanges** : domaine par colonne de `(exports par pays, imports par pays, pompage, turbinage)`, plus les totaux publiés. Les scénarios complets (silhouettes) ne sont énumérés que si leur nombre reste sous un seuil (20 000 comme aujourd'hui) ; au-delà, on raisonne colonne par colonne avec des bornes. C'est ce qui lève la dette « totaux inconnus » : l'ancien `deduce.py` énumérait des vecteurs à total fixé et ne savait pas faire sans total.
- **Comptes** : bornes basse et haute de cases par (pièce, colonne), par pièce sur la journée (inventaire), par voisin.
- Représentation interne en bitsets (entiers Python) pour les cases : intersection et couverture rapides.

### 6.2 Boucle et note

- Comme aujourd'hui : à chaque tour, la technique la plus facile qui s'applique, sur toutes ses occurrences, puis retour au niveau 1. Une technique n'exclut que ce qu'aucune solution n'utilise et n'acquiert que ce que toutes utilisent.
- **Résolue** quand la composition est connue (silhouette fixée, compte connu par pièce et par colonne). **Bloquée** sinon : non publiable.
- **Note provisoire** = niveau de la technique la plus avancée (1 Facile … 4 Expert), plus des mesures brutes pour S5.3 (§6.4). Le calibrage humain remplacera cette note.

### 6.3 Techniques

Toutes celles du §9, réécrites sur des cases et des formes ; les ids restent ceux d'aujourd'hui (les grilles et `fr.ts` les utilisent).

| Niveau | Id | Technique | Ce qui change en v2 |
|---|---|---|---|
| 1 | `room` | Pas de place | aussi en hauteur (pièce haute, plateau de rampe) |
| 1 | `exhausted` | Inventaire épuisé | compte en cases, toutes formes |
| 1 | `price_cap` | Le prix plafonne la colonne | inchangé |
| 1 | `record` | Le relevé compte les cases | clés `I:<pays>` ; **couvre aussi les totaux du jour** (indice `exchanges`, inventaire exact) : total atteint → plus d'échange de ce type ; autant de créneaux possibles que le reste → tous (choix C3) |
| 1 | `flow` | Flux publié | plusieurs voisins |
| 1 | `single_cover` | Une seule pièce pour cette case | « barre » → « pose » |
| 1 | `single_spot` | La pièce qui ne tient qu'à un endroit | idem |
| 1 | `program` | Programme publié | idem |
| 1 | `length` | **Durée de marche** (nouveau id pour l'indice `length`, absent de l'ancien solveur) | une pose de cette largeur existe : si une seule place, elle y va |
| 1 | `silhouette` | La silhouette suit les pièces | domaines d'échanges par colonne |
| 1 | `swap` | Cases interchangeables | inchangé |
| 2 | `top_price` | La case la plus chère | inchangé |
| 2 | `ribbon` | Le creux coupe le ruban | découpage de ligne généralisé aux formes (une rampe occupe deux lignes) |
| 2 | `just_enough` | Inventaire juste | inchangé |
| 2 | `column_sum` | Compter la colonne | inclut exports, imports par pays, STEP |
| 2 | `carbon` | Plafond carbone | imports par pays |
| 3 | `share_out` | Répartition de l'inventaire | inchangé, mêmes plafonds de calcul |
| 4 | `refuted` | Hypothèse réfutée | une seule hypothèse, règles 1-2 |

Plusieurs voisins : chaque règle qui parle d'import ou d'export porte un pays ; `column_sum` et `silhouette` raisonnent sur la somme et sur chaque ligne.

### 6.4 Traces

Chaque étape est un objet JSON :

```json
{"i": 12, "rule": "ribbon", "level": 2,
 "removed": [["N", 0, 3, 4, 1]], "placed": [], "exchanges": {"DE": {"export": [[5, 0]]}},
 "cells": [[0, 3], [0, 4]], "clues": [2], "shapes": ["rect"]}
```

- `cells` : où la technique a porté ; `columns` : créneaux dont un échange ou un compte a changé ; `clues` : indices utilisés ; `shapes` : formes en jeu (`rect`, `tall`, `ramp_trap`, `ramp_stair`) ; `scope: "day"` quand un total du jour a servi.
- **Résumé** (dans la sortie du générateur et pour le labo) : techniques et nombre d'emplois, nombre d'étapes, étapes de niveau ≥ 2, ordre de première apparition, nombre de « goulots » (tours où une seule occurrence d'une seule technique s'appliquait).
- **Repérer une technique due à la rampe** (S1.2) : deux signaux. (1) une étape dont `shapes` contient une rampe et que la même grille, rampe remplacée par un rectangle de même aire, ne produit pas ; (2) une grille unique (CP-SAT) mais **bloquée** avec les règles du §9 : le générateur la garde à part (`blocked_unique`) avec l'état au blocage, pour lecture humaine. C'est là qu'une technique nouvelle se voit.

## 7. Python seul ou déduction en TS ? — Python seul (choix C1)

Mesures (Apple Silicon, ancien solveur instrumenté, 10 grilles par configuration, graine 1, indices sans `given`) :

| Mesure | Valeur |
|---|---|
| Déduction sur les 11 grilles publiées | 0 à 9 ms par grille |
| Générateur, 8 créneaux N,G,T + voisin, sans inventaire | 0,6 s par grille gardée ; 69 ms par déduction |
| idem + 1 STEP | 1,4 s par grille ; 124 ms par déduction |
| 12 créneaux N,B,C,G,T + voisin | 5,8 s par grille ; 442 ms par déduction |
| Comptage CP-SAT | 10 à 30 ms par appel, < 5 % du temps |

Arguments :
- **CP-SAT n'existe qu'en Python** (pas de binding JS officiel). Avec une déduction en TS, le générateur Python lancerait Node à chaque essai d'indice (des centaines par grille) ou serait porté en TS en gardant Python pour CP-SAT : deux langages dans la boucle chaude.
- **Le jeu n'a pas besoin de la déduction en S4-S6** : le labo joue à l'aveugle, la note est montrée après la partie (calculée hors ligne). Le seul besoin côté jeu, l'indice « prochaine déduction », est en v3.
- **Le temps est acceptable** : un lot de 20 grilles de 12 créneaux ≈ 2 min en Python, hors ligne. Les bitsets du §6.1 doivent diviser l'ancien temps par 2 à 5 (objectif : ≤ 200 ms par déduction à 12 créneaux).
- **Le risque de divergence** entre le moteur TS (règles, composition) et Python est couvert par le jeu de référence partagé (§8), pas par un code commun.
- **Pour la v3** : la trace peut être stockée dans la grille et lue par le jeu ; si l'indice doit partir de l'état du joueur, on reposera la question avec ces chiffres.

## 8. Jeu de grilles de référence partagé

- **Où** : `fixtures/grids/` à la racine (hors `web/` et `solver/`, lu par les deux). Un fichier JSON par grille : la grille §14 plus un bloc `expect`.

```json
{"grid": { ... §14 ... },
 "expect": {"valid": true, "errors": [], "compositions": 1, "deduction": "solved",
            "rating": 2, "techniques": ["record", "ribbon"], "requires": []}}
```

- **Valides** (environ 20) : les 11 grilles publiées ; plus des grilles faites à la main pour ce que les 11 ne couvrent pas : deux et trois voisins, pièce haute, `max_cells`, plafond CO₂ par pays, surplus, indice `length`, `exchanges` partiel (exports seuls, imports `"*"`), STEP sans inventaire, rampe trapèze, rampe escalier.
- **Invalides** : une par contrôle du validateur (environ 15, message attendu) ; plus trois grilles bien formées mais fausses : deux compositions, solution de référence qui viole un indice, unique mais bloquée (`deduction: "blocked"`).
- **Vitest** (`web/tests/reference.test.ts`) : `validateGrid` rend `valid` et les erreurs attendues ; pour une grille valide, `evaluate()` sur la solution de référence est `solved`, et la composition est celle attendue. Les fixtures `requires: ["ramp"]` sont sautées jusqu'à S6.
- **pytest** : `validate()` donne le même verdict (même liste d'erreurs, **messages identiques** : pas de codes d'erreur, les messages anglais des deux validateurs sont le contrat ; ceux des fixtures invalides sont écrits à la main dans `build_fixtures.py`), `compositions` et `deduction` / `rating` / `techniques` attendus.
- Toute nouvelle règle de format se teste d'abord par une fixture : c'est le contrat entre les deux langages.

## 9. Générateur

### 9.1 Paramètres (une configuration)

Format réel (S4.6), vérifié avant tout tirage par `check_lot()` : une clé inconnue ou une valeur hors liste refuse le lot entier (code de sortie 2, la liste des erreurs sur stderr, rien d'écrit).

| Paramètre | Valeurs | Défaut |
|---|---|---|
| `weight` | nombre > 0 (poids dans le mélange) | 1 |
| `cols` | 6, 8 ou 12 (créneaux de 4 h, 3 h, 2 h) | 8 |
| `family` | famille (§9.2) ou `any` | `any` |
| `height` | hauteur max du résiduel, 4 à 8 | tirée dans 5-7 |
| `pieces` | lettres parmi N, B, C, G, T (`"NCGT"`, virgules tolérées) | `"NGT"` |
| `tall` | `true` : charbon 1 ou 2 de haut | `false` |
| `ramp` | `"trap"` ou `"stair"` (toujours le charbon) | aucune |
| `neighbors` | 0 à 5 | 0 |
| `step` | 0 à 2 paires | 0 |
| `surplus` | `true` : famille `surplus_midi` | `false` |
| `co2_cap` | `"auto"` (CO₂ de la référence) ou entier | aucun |
| `stock` | cases d'eau du barrage (`max_cells` de B) | aucun |
| `inventory` | `"exact"` ou `"none"` | `"none"` |
| `clue_types` | liste parmi price, column, flow, bar, length, exchanges | toutes |
| `rating` | note imposée (1 à 4) : niveau visé et rejet des autres | libre |
| `max_clues` | rejet au-delà | nombre de créneaux |
| `min_decisions` | décisions minimales (`no_decision` en dessous, §17) ; 0 pour un tutoriel | 1 |

### 9.2 Silhouettes et météo

Familles nommées, chacune avec une demande et une météo cohérentes : `pointe_soir` (montée vers 18-20 h), `deux_bosses` (matin et soir), `midi_solaire` (creux de midi par R fort, la « courbe en canard »), `nuit_plate` (base haute, peu de relief), `surplus_midi` (résiduel négatif à midi, exige un export), `plateau_hiver` (haut et plat), `vent_nocturne` (R la nuit). Le bruit est tiré dans des bornes ; le résiduel est la demande moins R et F.

### 9.3 Étapes pour une grille

1. Tirer silhouette, météo, parc et mécaniques.
2. **Pose de référence** : CP-SAT minimise la somme des rangs des cases (ordre d'appel), départage aléatoire (graine) entre poses de même coût pour varier.
3. Inventaire au niveau voulu ; totaux d'échanges dans l'inventaire (exact) ou dans la réserve d'indices (`exchanges`, sinon).
4. **Réserve d'indices** : tout ce que la référence permet de publier pour les types demandés (prix, relevé par pièce, flux par pays, programme, durée de marche, bilan partiel ou total).
5. **Ajout glouton** : tant que la déduction bloque, ajouter l'indice qui laisse le moins de cases indécises après les règles 1-2 ; départage par type le moins représenté dans la grille (diversité des indices).
6. **Élagage** : retirer un à un ce dont la grille peut se passer. Vérifier §8.3 : retirer n'importe quel indice restant casse l'unicité ou la déduction (testé).
7. **Contrôles** : CP-SAT compte 1 composition ; la déduction aboutit ; note et techniques ; mesures.
8. **Bulletin** (§10).

### 9.4 Rejets (nommés, comptés par lot)

`infeasible`, `trivial` (une seule sorte de pièce, rien à déduire), `not_unique` (plusieurs compositions même avec toute la réserve), `blocked` (unique mais pas déductible : gardée à part si `ramp`, §6.4), `too_many_clues`, `rating_mismatch`, `no_decision` (moins de `min_decisions` décisions, §17), `duplicate` (même silhouette à un décalage près, ou même composition), `quota` (§9.5).

### 9.5 Lots et diversité imposée

Un **lot** est un fichier JSON : `lot` (nom de fichier), `size`, `seed`, `max_attempts` (défaut 15 × `size`), `mix` (configurations pondérées, §9.1), `quotas`, `comment` (libre). Exemple réel (`lab/lots/demo-01.json`, extrait) :

```json
{"lot": "demo-01", "size": 20, "seed": 7, "max_attempts": 600,
 "mix": [{"weight": 3, "cols": 8, "neighbors": 1},
         {"weight": 2, "cols": 12, "neighbors": 2, "co2_cap": "auto"},
         {"weight": 2, "cols": 8, "step": 1, "neighbors": 1},
         {"weight": 3, "cols": 8, "ramp": "trap"},
         {"weight": 2, "cols": 8, "ramp": "trap", "neighbors": 1, "inventory": "exact",
          "clue_types": ["column", "flow", "bar", "length"]},
         {"weight": 1, "cols": 12, "pieces": "NBCGT", "tall": true, "surplus": true, "neighbors": 1}],
 "quotas": {"max_same_family": 3, "max_same_mechanics": 4, "min_per_rating": 2,
            "max_same_clue_profile": 4}}
```

- Quotas connus : `max_same_family` (alias accepté : `max_same_silhouette`), `max_same_mechanics`, `max_same_clue_profile`, `max_same_single_decision` (§17, sans limite par défaut), `max_with_type` et `min_with_type` (§17, objets `{type de décision: n}`, vides par défaut), `min_per_rating`, `min_per_mix`.
- Le lot tire jusqu'à remplir la taille ; une candidate qui ferait dépasser un quota est rejetée (`quota`).
- **Mécaniques** d'une grille = l'ensemble {voisins (nombre), STEP, surplus, CO₂, pièce haute, rampe, inventaire} ; **profil d'indices** = l'ensemble des types utilisés.
- Les quotas par défaut sont un choix ouvert (C4).

### 9.6 Sortie

- Une grille §14 complète (`id` provisoire, `section: "rated"`, `difficulty`, `bulletin`) plus un bloc `lab` ignoré par le jeu :

```json
"lab": {"lot": "demo-01", "seed": 7, "index": 12, "family": "pointe_soir",
        "mechanics": ["neighbors:1", "step"], "clue_profile": ["column", "exchanges", "flow"],
        "trace_summary": {"steps": 18, "level2_steps": 4, "bottlenecks": 2, "techniques": {"ribbon": 2}},
        "generator": "dispatch-solver 2.0.0"}
```

- Le bloc `lab` est retiré à la promotion par le labo (s5) : `grids.json` reste propre.

## 10. Bulletin par gabarits

- **Champs** que le générateur remplit : `title`, `text`, `weather` (une valeur par créneau). Le numéro et la date de publication sont donnés à la promotion par le labo, pas par le générateur.
- **Format** : celui de s2 (S2.1, commit `f45381d` sur `v2-menu`) : `bulletin: {number, title, text, weather, published}`, `weather` parmi `sun`, `moon`, `cloud`, `wind`, un par colonne ; `number` et `published` obligatoires.
- Le générateur ne connaît ni le numéro ni la date : il écrit un **brouillon** dans `lab.bulletin` (`{title, text, weather}`) ; à la promotion, le labo le complète (`number`, `published`) et le place dans `bulletin`. La grille candidate reste valide pour `validateGrid`.

```json
"lab": {"bulletin": {"title": "Pointe du soir",
                     "text": "Le froid tient la soirée. L'Allemagne a de la marge à 21 h.",
                     "weather": ["moon", "moon", "sun", "sun", "cloud", "sun", "moon", "moon"]}}
```

- **Ciel par créneau** : déduit de R et de l'heure : `moon` (créneau de nuit sans R), `wind` (R > 0 la nuit), `sun` (jour, R ≥ 2), `cloud` (jour, R ≤ 1).
- **Traits** calculés sur la grille : famille de silhouette, créneau de la pointe, surplus, voisins actifs dans la solution, STEP, plafond CO₂, pièce dominante, rampe.
- **Titre** : table trait → titres (3 à 5 variantes par trait, choisies par la graine) : « Pointe du soir », « Deux bosses », « Midi au soleil », « Trop de soleil », « Nuit calme », « Le lac remonte » (STEP), « Ligne chargée » (voisins)…
- **Texte** : 2 phrases, chacune un gabarit à trous (`{pays}`, `{heure}`, `{centrale}`) choisi selon les traits ; jamais de chiffre que le joueur doit déduire (pas de fuite de solution : un trait tiré de la solution ne cite que ce qui est déjà publié par un indice).
- Les gabarits sont des données (`generate/bulletin_fr.json`), en français ; ce sont des textes de grille comme `title` et `intro`, pas des textes d'interface : ils ne vont pas dans `fr.ts`.

## 11. Interface pour le labo (S5)

Le serveur Python local du labo importe le package ; la CLI fait la même chose en ligne de commande (depuis `solver/`, `.venv/bin/dispatch-solver`). Données dans `lab/`, versionnées. Une grille se désigne par `--id N` (son id) ou `--index N` (sa position dans le fichier, à partir de 0, = `lab.index`).

| Commande | Sortie | Code de sortie |
|---|---|---|
| `dispatch-solver generate <lot> [--out DIR] [--workers N]` | `DIR/<lot>.json` (grilles §14 + `lab`), `DIR/<lot>.stats.json` (tirages, rejets, notes, rampes, temps) ; `DIR` = `lab/candidates/` par défaut, 6 processus | 0 lot plein ; 1 lot partiel (fichiers écrits) ; 2 lot refusé (rien d'écrit) |
| `dispatch-solver check <fichier> [--id N \| --index N] [--ramp] [--cap K]` | une ligne JSON par grille : `valid`, `errors`, `compositions`, `matches_reference`, `deduction`, `rating`, `techniques`, `summary` | 0 si toutes valides, sinon 1 |
| `dispatch-solver deduce <fichier> (--id N \| --index N) [--max-level k]` | trace complète (§6.4), puis résumé | 0 |
| `dispatch-solver bulletin <fichier> (--id N \| --index N) [--seed S]` | bulletin régénéré (après retouche de la grille) | 0 |
| `dispatch-solver check-published [fichier] [--ramp]` | ce que fait `check_unique.py` : toutes les grilles de `grids.json` uniques et déductibles, solution = référence ; `--ramp` accepte les rampes (`api.check_published(grids, allow_ramp=True)`) | 0 ou 1 |

Fonctions de bibliothèque correspondantes : `generate.lot.run_lot(lot, workers)` (lève `ValueError` sur un lot refusé), `generate.lot.check_lot(lot)` (lot normalisé, liste d'erreurs), `api.check_grid`, `api.deduce_grid`, `generate.bulletin.make_bulletin`. Elles rendent des dicts JSON.

Bloc `lab` d'une candidate : `lot`, `index` (0…), `seed`, `aim` (niveau visé), `mix` (entrée du mélange), `family`, `mechanics` (`ramp:trap`, `neighbors:2`…), `clue_profile`, `trace_summary` (dont `level2_steps`), `ramp_techniques` (`{id: emplois}` des 4 techniques de rampe), `bulletin` (`title`, `text`, `weather`), `generator`, `seconds`. `stats.json` ajoute `ramp_grids`, `ramp_grids_with_technique`, `ramp_techniques`, `seconds_per_kept_grid`, `errors` (20 premiers tirages en erreur).

## 12. Choix ouverts

| | Choix | Recommandation |
|---|---|---|
| C1 | Déduction en Python seul, ou en TS partagée avec le moteur du jeu | **Tranché : Python seul** (§7) |
| C2 | Nom du package | **Tranché : `dispatch_solver` / CLI `dispatch-solver`** ; l'ancien nom `spot-solver` part avec l'archive |
| C3 | Totaux d'échanges : technique nommée à part ou fondue dans « Le relevé compte les cases » | **Tranché : fondue dans `record`** (la trace note `scope: "day"` pour distinguer) |
| C4 | Quotas de diversité par défaut d'un lot de 20 | **Tranché : ≤ 3 par famille de silhouette, ≤ 4 par ensemble de mécaniques, ≤ 4 par profil d'indices, ≥ 2 par note** |
| C5 | Bloc `lab` dans la grille promue | **Tranché (orchestrateur) : retiré à la promotion par le labo** |
| C6 | Format `ramp` et `bulletin` | **Tranché** : `bulletin` aligné sur s2 (`f45381d`) ; rampe alignée sur `rampe.md` (`pieces.C.shape`, §4.2) |

## 13. Découpage des tâches suivantes

- **S4.2** : `grid`, `shapes`, `board`, `clues`, `exact`, `deduce` ; fixtures `fixtures/grids/` et `reference.test.ts` ; `check_unique.py` et CI rebranchés ; archive de l'ancien solveur. Critère : les 11 grilles uniques, déduites, même note qu'aujourd'hui ou écart expliqué.
- **S4.3** : `generate/` et CLI ; lot de démonstration ≥ 20 candidates dans `lab/` (dont rampes trapèze et escalier) ; `CLAUDE.md` (section `solver/`), `GAME-DESIGN.md` §10 et §15.

## 14. Écarts constatés à l'implémentation (S4.2)

- **Modules** : `rate.py` est fondu dans `deduce/trace.py` (`Result.summary()`) ; `api.py` regroupe les points d'entrée (CLI, `check_unique.py`, labo).
- **Étapes non tracées** : les poses qui dépassent la silhouette maximale (aucun export ni pompage ne peut l'atteindre) sont écartées dès la construction du plateau (`board.py`), sans étape « Pas de place ». Sur une grille sans voisin ni STEP, `steps` sous-estime donc un peu le travail du joueur ; à garder en tête en lisant les mesures du labo.
- **Mesure « goulots »** remplacée par `single_effect_steps` (étapes qui ne changent qu'une chose) : compter les tours où une seule technique s'applique imposait de tester toutes les techniques à chaque tour.
- **Silhouette** : les options sont factorisées (option STEP × exports par colonne) au lieu d'énumérer des silhouettes complètes. Les totaux de l'inventaire exact sont réappliqués en silence (comme l'ancien solveur) ; un total publié par un indice `exchanges` est une étape `record` (C3).
- **Inventaire exact** : les largeurs qu'il ne cite pas et les imports à total nul ne sont pas proposés (ce n'est pas une déduction), comme dans l'ancien solveur.
- **Jeu de référence** : les 11 grilles publiées sont lues directement dans `grids.json` (pas de copie) ; `fixtures/grids/` contient 11 grilles faites pour l'occasion, les 8 mini-grilles de la rampe, 18 grilles invalides et 3 non publiables. `solver/scripts/build_fixtures.py` les reconstruit.
- **Résultat sur les 11 grilles** : même note qu'avant pour les 11 ; techniques identiques à 2 près (grille 9 : `room` en plus ; grille 10 : le total d'imports publié passe de `exhausted` à `record`, choix C3).
- **Coût** : 1 à 15 ms par déduction sur les grilles publiées ; le pire cas mesuré (12 créneaux, 2 voisins, grille bloquée) prend 23 s, presque tout en « Hypothèse réfutée ».

## 15. Écarts constatés à l'implémentation (S4.3)

- **Créneaux** : le générateur ne tire que 6, 8 ou 12 colonnes (créneaux de 4, 3 ou 2 h, §2) ; 9 ou 10 colonnes donnaient des heures fractionnaires.
- **Quota de plus** : `min_per_mix` (au moins une grille par configuration du mélange, 1 par défaut), avec un tirage cinq fois plus fréquent des configurations encore sans grille. Sans lui, les configurations lentes (plusieurs voisins) étaient évincées par les rapides.
- **Famille libre** : une configuration `family: "any"` tire parmi les familles encore sous quota ; une famille imposée entre en conflit avec le quota par famille, à éviter dans un lot.
- **Pose de référence** : une configuration avec rampe ou pièce haute exige au moins une telle pose ; un plafond CO₂ automatique nul est rejeté (`trivial`).
- **Bulletin** : les pays prennent leur article (« l'Allemagne », « le Royaume-Uni »).
- **Lot de démonstration** `lab/lots/demo-01.json` : 20 grilles en 11 min (6 processus), 468 tirages ; 7 familles ; notes 3 / 13 / 2 / 2 ; 7 rampes (5 trapèzes, 2 escaliers) ; toutes revérifiées (valides, uniques, référence, déduction). Aucune grille à rampe « unique mais bloquée » sur ce lot (`blocked_ramp: 0`).

## 16. Corrections S4.6 (revues S4.2, S4.3, labo)

- **Contrat** : §9.1, §9.5 et §11 décrivent le format réel ; lot validé avant tirage ; `--index` ; codes de sortie.
- **Note** : le générateur a un levier, le niveau visé (`aim`) ; « Cases interchangeables » ne compte plus la hauteur de colonne (c'est « Compter la colonne », niveau 2) ; la note reste la technique la plus avancée, `level2_steps` est dans `lab.trace_summary` pour le calibrage S5.3.
- **Rampe** : trapèze seul dans les lots (l'escalier reste dans le code et les fixtures, hors lots, `rampe.md` §8) ; largeurs tirées et relais ; 4 techniques nommées (`ramp_plateau`, `ramp_shoulder` niveau 1, `ramp_lone` niveau 2, `ramp_relay` niveau 3), mesurées dans `lab.ramp_techniques`. Le contrefactuel « rampe remplacée par un rectangle » (signal 1 du §6.4) n'est pas implémenté : les techniques nommées le remplacent.
- **Coût** : un plateau (`Puzzle`) par grille pour tous les essais d'indices ; déduction complète seulement près de la fin ; file de travail continue ; « Hypothèse réfutée » plafonnée (`MAX_REFUTE_WORK`) et limitée aux poses qui touchent une case ouverte.


## 17. Générateur v3-gen-1 (session 2 du labo, `docs/next/v3-criteres.md`)

- **Mécaniques mortes nettoyées** (C1), pas rejetées :
  - un voisin sans export ni import dans la référence est retiré de la grille juste après la pose de référence, avant l'inventaire et les indices (`lab.cleaned.neighbors`) ;
  - un plafond CO₂ qu'aucune étape `carbon` n'utilise est retiré après la déduction ; unicité (CP-SAT) et déduction sont refaites sans lui, la note est celle de la seconde déduction (`lab.cleaned.co2_cap`, valeur retirée). Les indices restent minimaux : sans le plafond, aucun ne devient superflu.
- **Décisions** (`deduce/trace.py`, `decisions()`), dans `lab.decisions` par type, ex. `{"exchange": 2, "tall": 1}`. Une décision est un choix de la référence que la déduction doit trancher et qui change la solution :
  - `exchange` : par (voisin, créneau) non nul. Export : sa valeur est fixée par une étape dont la règle n'est pas `flow` (champ `exchanges` de l'étape), et aucun indice `flow` ne le publie ; un export jamais fixé par une étape est imposé d'emblée. Import : une étape autre que `given`/`flow` pose la barre d'import, sans indice `flow` ni relevé `I:<pays>` à ce créneau ; un import trouvé en comptant les colonnes à la fin n'est pas une décision (c'est le remplissage des commentaires).
  - `step` : nombre de paires de la référence, si une étape fixe l'option STEP.
  - `tall` : chaque barre de charbon de hauteur 2 ; `ramp` : chaque barre de charbon à paliers ; sauf indice `engaged` qui la pose.
  - `carbon` : 1 si une étape `carbon` existe (le plafond exclut au moins une pose).
  - `stock` : 1 en carnet libre si la référence épuise `max_cells` du barrage et qu'une étape `exhausted` retire une pose de B.
  - `price` : chaque indice `price` cité par une étape `top_price` (le prix force sa centrale dans une seule case).
  - Calage : sur `v3-jouer-a`, `exchange` + `step` donne exactement la colonne « Déc. » de l'analyse (20/20).
- **Rejet `no_decision`** : moins de `min_decisions` décisions (1 par défaut). Le seuil « ≥ 2 » n'est pas imposé : hypothèse à tester.
- **Quota `max_same_single_decision`** : au plus N grilles d'un lot dont toutes les décisions sont d'un même type, par type. Les lots « jouer » v3g1 prennent 6 sur 20 (≈ 1/3) : les échanges seuls (8 des 15 grilles à décisions de `v3-jouer-a`) ne dominent plus le lot ; la même borne vaut pour les autres types (STEP seule, pièce haute seule, prix seuls), pour ne pas déplacer le monopole. Les grilles à 2 types ou plus n'y sont pas comptées.
- **Quotas par type de décision** (v3-gen-2), qui comptent les grilles qui *contiennent* un type, quelles que soient leurs autres décisions :
  - `max_with_type` : plafond de présence, ex. `{"exchange": 10}` sur 20 (au plus la moitié des grilles avec un échange à trouver). Rejet `quota:with_type`.
  - `min_with_type` : plancher, ex. `{"step": 4, "tall": 4, "carbon": 3, "stock": 2}`, sur le modèle de `min_per_rating`. Les dernières places sont réservées : une grille qui n'apporte aucun type manquant est refusée (`quota:type_floor`, mise en réserve) quand il reste moins de places que la somme des manques. Somme prudente : une grille peut combler deux types à la fois.
  - **Tirage orienté** : une entrée du mélange dont les mécaniques peuvent donner un type sous son plancher est tirée 5 fois plus souvent ; une entrée qui donne un type au plafond, 5 fois moins. Types d'une entrée (`config_types`) : voisins ou surplus → `exchange`, `step`, `tall`, `ramp`, `co2_cap` → `carbon`, `stock`. `price` n'est jamais visé.
  - **Clés combinées** : `"step+carbon"` compte les grilles qui ont les deux types, `"step|carbon"` celles qui en ont au moins un (mécanique globale active, `v3-criteres-s3.md`). Elles valent dans les deux quotas et pour le tirage orienté.
  - **Réservation commune avec les notes** : les manques par note et par type partagent les places restantes. Tant que leur somme dépasse les places, une grille doit la réduire ; ensuite, elle doit la laisser tenir. Deux réservations séparées laissaient la dernière place exiger une paire rare (une Difficile avec le stock : 1 tirage sur 360).
  - Validés par `check_lot()` : types connus, entiers ≥ 0, plancher ≤ plafond et ≤ taille du lot.
- **`price` et `ramp` absents des lots « jouer »** (mesure v3-gen-2 sur les 267 grilles des lots et du site) : `top_price` ne se déclenche que 3 fois, dont 2 dans `v3-rampe`. Un indice `price` agit presque toujours par `price_cap` (il exclut les centrales plus chères, une information donnée, pas un choix) ; 59 % des indices `price` portent sur N, posé d'emblée par la silhouette. Les recettes Difficile / Expert retirent en plus les indices `price`. `ramp` n'apparaît que dans les entrées à rampe, absentes des lots « jouer » (lot dédié `v3-rampe`).
- **Mesures seules** (sans filtre) dans `lab` : `live_mechanics` (C3, types de décision hors `price`), `bars` (C4, barres de la référence hors imports), `nuclear_prices` (C6, indices `price` sur N en carnet libre, 0 en carnet exact). Agrégats dans `.stats.json` : `decisions` (par type, grilles par type, grilles à type unique, grilles par nombre de décisions, par nombre de mécaniques vivantes) et `cleaned`.
- **Lots** `lab/lots/v3g1-jouer-{a,b,c}.json` : configurations de `v3-jouer-*` ; un plafond CO₂ passe en carnet libre (en carnet exact il était mort 3 fois sur 3) ; une entrée sans aucune mécanique reçoit une pièce haute ; une entrée « stock » sans voisin en reçoit un. Bilan : `lab/candidates/archive/V3G1.md` (lots archivés).
- **Lots** `lab/lots/v3g2-jouer-{a,b,c}.json` (v3-gen-2) : au plus 10 grilles avec un échange ; au moins 4 STEP, 4 pièces hautes, 2 stocks, 3 STEP + CO₂ et 6 mécaniques globales (STEP ou CO₂) ; mélanges sans voisin (STEP + CO₂, stock + pièce haute, stock + STEP). Bilan : `lab/candidates/V3G2.md`.

## 18. Notation A et lots « durs » (v3-gen-3, `docs/next/v3-criteres-j2.md`)

- **Notation A** (`deduce/trace.py`, `Result.rating`) : niveau des techniques avec `RATING_LEVELS` (ruban 1, répartition 2, réfutation 3), plafonné à Moyen (`TECHNIQUE_CAP`), plus un cran par mécanique globale couplée (`coupled_globals()` : STEP fixée par une étape et utilisée, ou étape `carbon`, seulement si la composition a un export ou un import). Les niveaux des règles (ordre de la boucle, `max_level` du générateur) ne changent pas ; `technique_level` garde le niveau brut. Résumé de trace : `technique_level`, `coupled_globals`.
- **Mesures** du bloc `lab`, sans filtre ni quota : `coupled_globals`, `compactness` (K = poids des décisions / pièces posées, `compactness()`), `demand_prices` (indices `price` sur C, G ou T dans une colonne d'export, `cluesel.demand_prices()`). `rerate_lots.py` les réécrit avec `decisions` et `live_mechanics`.
- **Clé de quota `coupled`** : dans `max_with_type` et `min_with_type`, et pour le tirage orienté (`config_types` : STEP ou CO₂ avec voisin ou surplus). Une Difficile ou une Expert qui manque oriente aussi les tirages vers ces entrées.
- **Prix de demande (D7)** : entrée `demand_price: true`, ou quota de lot `max_demand_price` (un tirage sur deux, tant que le plafond n'est pas atteint). Un tel prix tiré dans la réserve commence la sélection d'indices et est élagué en dernier ; s'il devient inutile, il part. Rejet `quota:demand_price` au-delà du plafond.
- **Recette des niveaux 3-4** : un plafond CO₂ ou un stock garde son carnet libre (en carnet exact, il est mort).
- **Lots** `lab/lots/v3g3-jouer-{a,b}.json`. Bilan : `lab/candidates/V3G3.md`.

## 19. Lots v3g4 : voisins gardés, quasi-jumelles, rampe comme décision (v3-gen-4)

- **Voisins gardés** (review `v3-gen-3`, point 1) : les mesures du bloc `lab` (`decisions`, `coupled_globals`, `live_mechanics`) étaient déjà prises après le nettoyage, et les quotas les lisaient. La fuite était en amont : une entrée « couplable » (STEP ou CO₂ + voisin) dont la référence ne commerce avec aucun voisin perdait tous ses voisins et donnait une grille sans voisin, comptée pour son entrée et visée par le tirage orienté. Désormais, la référence est recalculée avec un export de 1 ou 2 imposé vers un voisin tiré ; si aucune ne tient, rejet `dead_neighbors`. Un nettoyage partiel (2 voisins → 1) reste permis.
- **Quasi-jumelles** : quotas `max_per_mix` (par entrée, contrôlé même en fin de lot, après la réservation `min_per_mix`) et `max_with_cols` (`{nombre de créneaux: N}`). Tirage : poids divisé par 25 au plafond. `check_lot` refuse `max_per_mix` × entrées < taille et `max_per_mix` < `min_per_mix`.
- **Rampe** : `ramp_steps()` donne, pour chaque rampe de la référence, la règle de l'étape qui la pose (`eliminated` si aucune étape ne la pose : toutes ses autres places ont été exclues), ou rien quand un indice la donne (`engaged`, `bar` qui la nomme, étape `given` / `program` / `length`). Seules les premières comptent dans `decisions.ramp`. Mesure `lab.ramp_settled_by` (`{règle: rampes}`) ; agrégats `.stats.json` : `ramp_settled_by`, `ramp_relays` (grilles à deux rampes ou plus), `cols`.
- **Tirage trop long** : rejet `timeout`. Le worker lève l'erreur au bout de `ATTEMPT_SECONDS` (300 s) ; si le tirage est coincé en code natif, le lot cesse de l'attendre au bout de `HEAD_SECONDS` (600 s) en tête de file, et `faulthandler` écrit sa pile sur stderr. Un worker coincé est arrêté en fin de lot. Un tirage `timeout` dépend du temps machine : seule exception au « même lot pour la même graine ».
- **Avancement** : `run_lot` écrit dans le log, tous les 50 tirages, le nombre de grilles gardées et les rejets ; une impasse de quotas se lit sans attendre la fin du lot.
- **Lots** `lab/lots/v3g4-jouer-{a,b,c}.json`, `lab/lots/v3g4-rampe.json`. Bilan : `lab/candidates/V3G4.md`.

## 20. Remplissage et trous contestés (v3-gen-5, `docs/next/v3-criteres-m23.md`)

- **Mesures** (`deduce/holes.py`), dans le bloc `lab`, sans filtre :
  - `cells` (cases de la référence), `full_n_rows` (lignes dont chaque créneau est du nucléaire), `nuclear_share` (cases de nucléaire / cases), `cells_per_decision` (`cells` / poids des décisions, poids de K ; `null` sans décision) ;
  - `holes = {n, unique, contested, types}` : `find_holes()` liste les suites de 1 ou 2 cases sûres d'une ligne entre briques météo ou bord (une brique au moins) ; `hole_measures()` lance la déduction une fois avec `Solver.observe` (vue de chaque tour). Le point fixe du niveau 1 est le dernier tour avant la première étape de niveau ≥ 2 : la boucle essaie toujours le niveau 1 d'abord. Un trou à 2 types ou plus à ce point est contesté si une étape du tour qui le ramène à un type (étapes qui touchent ses cases ou ses colonnes, ou fixent un échange) est de niveau ≥ 2, fixe un échange ou pose un import. `types` : types au point fixe de chaque trou contesté (`"GI"`, ordre `NBCGTI`).
  - Calage sur les grilles citées par la note (c n°10, v3g3-a n°16, rampe n°10 contestées ; v3g3-b n°12 tranchée trivialement ; a n°3 trois trous à gaz seul ; v3g3-b n°13, 50 cases et 4 lignes de nucléaire) : toutes conformes.
  - Agrégats `.stats.json` (`lot_measures()`) : `cells`, `cells_bands` (≤ 28, 29-39, ≥ 40) et `hard_cells_bands` (Difficile et Expert), `full_n_rows`, `nuclear_share`, `nuclear_under_half`, `cells_per_decision`, `holes` ; `rerate_lots.py` les réécrit.
- **Squelette desserré** (`docs/next/v3-challenge.md` §6.5 : deux contraintes retirées, pas de règle ajoutée) :
  - entrée `max_nuclear: [lo, hi]` : la pose de référence garde au plus cette part de nucléaire, plafond tiré par grille (1 : sans plafond) ; contrainte CP-SAT `100 × cases N ≤ plafond × cases posées`, référence sans plafond si elle est infaisable ; `lab.nuclear_cap` ;
  - entrée `allow_one_plant` : le rejet `one_plant` est levé (grille à une seule sorte de centrale, profil de G7). Le rejet `trivial` (une seule clé, sans échange ni STEP) reste.
- **Options écrites puis éteintes** (consigne du 24 nov. : pas de quota de plus) : entrée `hole_types` (type de chaque trou tiré parmi ceux qui y tiennent ; contrainte CP-SAT « chaque case du trou couverte par ce type »), quota doux `min_with_contested` (une grille Moyen ou plus sans trou contesté attend une fois sur deux tant qu'il manque, `stats.contested_quota`), rejet `filler_cells`. Aucun lot ne s'en sert. `min_per_rating` accepte aussi `{note: n}`.
- **Lots** `lab/lots/v3g5-temoin.json` (témoin : `v3-jouer-a` tel quel, graine 2424, `min_decisions` 0) et `lab/lots/v3g5-squelette.json` (`v3g4-jouer-a` + `max_nuclear` [0,3 ; 1] + `allow_one_plant`). Bilan : `lab/candidates/V3G5.md`.

