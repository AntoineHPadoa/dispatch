# Génération de nuit (S5.7) — 21 novembre 2026

Générateur : `dispatch-solver 2.0.0`, commit `13b5a2a` (v2-solver), branche `v2-gen`. Un lot à la fois, 6 processus.

## Notes recalculées (S8.3)

La déduction a été corrigée après la génération (review S8 tour 1, partie B, C1 à C5) : « Pas de place » vérifie aussi qu'une pose qui monte plusieurs colonnes tient dans les totaux d'échanges du jour. Les grilles n'ont pas été retirées ; leurs notes, techniques et mesures ont été recalculées par `solver/scripts/rerate_lots.py` (une composition, déduction complète, chaque indice retiré à tour de rôle). Les tableaux plus bas gardent les chiffres de la nuit.

| Note | jouer-a | jouer-b | jouer-c | rampe | rejeu | Total | Jouables |
|---|---|---|---|---|---|---|---|
| Facile | 6 | 9 | 7 | 7 | 2 | 31 | 24 |
| Moyen | 8 | 4 | 10 | 8 | 1 | 31 | 23 |
| Difficile | 4 | 3 | 0 | 1 | 1 | 9 | 8 |
| Expert | 2 | 4 | 3 | 4 | 0 | 13 | 9 |

- **13 notes changent** (14 avec `demo-01`), toutes à la baisse : jouer-a n° 1 (Expert → Difficile), 3 et 12 (Difficile → Facile) ; jouer-b n° 7 (Moyen → Facile), 19 (Expert → Moyen) ; jouer-c n° 5 (Moyen → Facile), 8, 18 et 19 (Difficile → Moyen) ; rampe n° 8 (Expert → Moyen) ; rejeu n° 3, la grille publiée 11 (Expert → Facile, décision en attente).
- **Toutes restent publiables** : une composition, déduites, aucun indice devenu inutile. Exception, sans lien avec la correction : la grille publiée 8 (rejeu n° 0) a un indice inutile, le flux de 6h (déjà le cas avant).
- **Grilles sans indice notées Difficile ou Expert** : 4 au lieu de 5 (jouer-a n° 1 et 18, jouer-b n° 0, rampe n° 2) ; jouer-a n° 3 passe en Facile.
- **Techniques de rampe** : « Le plateau barre la ligne du dessus » et « L'épaule appelle une case » sont « Pas de place » et « Une seule barre pour cette case » sur une rampe : des étiquettes pour le joueur, pas un apport de la rampe. Seule « Une case seule est une épaule » est propre à la rampe : **1 grille sur 20** du lot rampe l'emploie (`ramp_grids_with_own_technique`), et non 12 comme écrit plus bas.

## Bilan

- **5 lots, 84 grilles** : 3 lots à jouer (60), 1 lot à rampe (20), 1 lot de rejeu des grilles notées publiées (4).
- **Toutes vérifiées** par `dispatch-solver check` (`--ramp` pour le lot rampe) : 84/84 valides, une seule composition, égale à la référence, déductibles. Note recalculée identique à la note écrite pour toutes.
- **Temps total** : 10 min 1 s de génération (59 s + 277 s + 126 s + 33 s), plus 2 min pour un premier essai du lot C.
- **Calibrage** : au moins 8 grilles par note, même en ne comptant que les grilles jouables (sans rampe).

| Note | jouer-a | jouer-b | jouer-c | rampe | rejeu | Total | Jouables |
|---|---|---|---|---|---|---|---|
| Facile | 4 | 8 | 6 | 7 | 1 | 26 | 19 |
| Moyen | 8 | 4 | 8 | 7 | 1 | 28 | 21 |
| Difficile | 5 | 3 | 3 | 1 | 1 | 13 | 12 |
| Expert | 3 | 5 | 3 | 5 | 1 | 17 | 12 |

## Lots

### nuit-jouer-a — jouer, 20 grilles, 59 s
- Graine 101, 221 tirages. Rejets : 66 `one_plant`, 52 `trivial`, 33 `quota:clue_profile`, 19 `too_many_clues`, 18 `quota:family`, 2 de réservation (note, mélange).
- Créneaux : 15 × 8, 4 × 12, 1 × 6. Familles : 7, 2 à 3 grilles chacune.
- Mécaniques : 11 × 1 voisin, 2 × 2 voisins, 1 × 3 voisins ; 12 inventaires exacts ; 4 stocks ; 3 pièces hautes ; 3 surplus ; 2 CO₂ ; 1 STEP.
- Indices (grilles qui en ont le type) : 14 column, 8 price, 5 flow, 5 bar, 5 exchanges, 1 length.

### nuit-jouer-b — jouer, 20 grilles, 277 s
- Graine 202, 810 tirages. Rejets : 429 `one_plant`, 130 `trivial`, 89 `too_many_clues`, 50 `quota:clue_profile`, 39 `quota:family`, 23 `quota:mix`, 18 `quota:mechanics`, 1 `duplicate`.
- Créneaux : 11 × 8, 7 × 12, 2 × 6. Familles : 7, 2 à 3 grilles chacune.
- Mécaniques : 10 × 1 voisin, 5 × 2 voisins ; 12 inventaires exacts ; 4 CO₂ ; 3 stocks ; 3 pièces hautes ; 3 surplus ; 2 STEP.
- Indices : 10 column, 8 exchanges, 5 bar, 3 price, 3 flow, 1 length.

### nuit-jouer-c — jouer, 20 grilles, 126 s
- Graine 303, 922 tirages (`max_attempts` porté de 900 à 1800 : le premier essai s'est arrêté à 19 grilles). Rejets : 320 `one_plant`, 197 `quota:mechanics`, 153 `trivial`, 111 `quota:clue_profile`, 78 `too_many_clues`, 21 `quota:family`, 9 de réservation, 2 `duplicate`.
- Créneaux : 12 × 8, 6 × 6, 2 × 12. Familles : 7, 2 à 3 grilles chacune.
- Mécaniques : 11 × 1 voisin, 1 × 2 voisins, 1 × 4 voisins ; 14 inventaires exacts ; 5 STEP ; 3 stocks ; 3 pièces hautes ; 3 surplus ; 2 CO₂.
- Indices : 12 column, 7 bar, 5 exchanges, 4 price, 4 flow.

### nuit-rampe — rampe (trapèze seul), 20 grilles, 33 s
- Graine 404, 71 tirages. Rejets : 11 `quota:family`, 10 `quota:clue_profile`, 9 `too_many_clues`, 9 `quota:mechanics`, 1 `not_unique`. Aucune grille « unique mais bloquée » (`blocked_ramp: 0`).
- Créneaux : 12 × 8, 7 × 12, 1 × 6. 12 grilles avec 1 voisin ; 11 inventaires exacts ; 4 surplus ; 1 CO₂ ; 1 STEP.
- **Techniques de rampe : 12 grilles sur 20 en emploient au moins une, mais seule 1 emploie une technique propre à la rampe** (voir « Notes recalculées » : plateau et épaule sont des étiquettes).

| Technique | Grilles | Emplois |
|---|---|---|
| `ramp_plateau` (niveau 1) | 11 | 17 |
| `ramp_shoulder` (niveau 1) | 6 | 11 |
| `ramp_lone` (niveau 2) | 1 | 1 |
| `ramp_relay` (niveau 3) | 0 | 0 |

- Le relais n'apparaît toujours pas, alors que 11 grilles ont 2 à 5 morceaux de charbon dans la solution : quand les rampes se relaient, la déduction ne passe pas par la technique « relais ».
- Le trapèze se joue dans le jeu et dans le labo depuis le commit `93de017`.

### nuit-rejeu-notees — calibrage, 4 grilles
- Les 4 grilles `rated` publiées (ids 8 à 11), avec un bloc `lab` (famille `publiee`, `published_id`), pour les rejouer à l'aveugle et les renoter.
- Note du solveur actuel : Facile, Moyen, Difficile, Expert, identique aux notes publiées.

## Points à regarder

- **18 grilles sans aucun indice** (5 dans jouer-a, 4 dans jouer-b, 4 dans jouer-c, 5 dans rampe), toutes à inventaire exact : l'inventaire suffit à les résoudre. 13 sont notées Facile, mais 3 Difficile et 2 Expert (jouer-a n° 1, 3 et 18, jouer-b n° 0, rampe n° 2, index à partir de 0). À trier dans le labo.
- **Quota de famille dépassé** dans le lot rampe : 4 `surplus_midi` pour un maximum de 3. La dernière grille vient de la configuration surplus, encore sans grille à ce moment : son minimum par configuration passe avant le quota de famille.
- Les rejets `one_plant` et `trivial` font 59 % des tirages des lots à jouer : sans conséquence sur la qualité, mais c'est la principale perte de temps.

## Ouvrir le labo

```bash
lab/run.sh        # puis ouvrir http://localhost:5173/dispatch/lab.html
```

## Fichiers

- Configurations : `lab/lots/nuit-jouer-a.json`, `nuit-jouer-b.json`, `nuit-jouer-c.json`, `nuit-rampe.json`.
- Grilles et mesures : `lab/candidates/<lot>.json` et `<lot>.stats.json` pour les 5 lots.
