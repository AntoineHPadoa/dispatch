# Météo en briques imposées — note de conception

Tâche S5.1, 22 novembre 2026. Étude seulement, aucun code du jeu ni du solveur n'a été modifié.

## 1. Pourquoi

- **Signalement** : grille 4 du lot `nuit-jouer-a` (« Trop de soleil »). Le joueur pose un nucléaire de 0h à 10h sur la première ligne libre, et la barre se plie : elle monte d'une case à 8h, puis de trois à 10h (capture `meteo-briques/escalier-aujourdhui.png`).
- **Cause** : ce n'est pas un bug de calcul. Aujourd'hui, `row` compte les lignes **au-dessus de la météo de chaque colonne** (`web/src/ui/board.ts` : « Rows count from 0 at the bottom of the dispatchable part »). Une barre `row 0` posée sur des colonnes de météo 1, 1, 1, 1, 2, 5 se dessine donc en escalier. Le moteur, le validateur et les deux solveurs suivent tous cette convention, si bien que les solutions de référence du labo sont elles-mêmes tordues.
- **Décision de l'humain (q108)** : la météo est un ensemble de briques imposées, comme des usines déjà posées. Une centrale est un vrai rectangle sur la grille.

## 2. La nouvelle règle

### Formulation pour GAME-DESIGN

- **§2 La grille** : « Les lignes sont numérotées de bas en haut, à partir du bas de la grille. La météo occupe le bas de chaque colonne : d'abord le fil de l'eau F, puis les renouvelables R. Ce sont des briques imposées, que le joueur ne pose ni ne retire. »
- **§3 Production non pilotable** : remplacer « R et F ne font que réduire la demande à couvrir » par « R et F sont des briques posées par la météo en bas de leur colonne ; une centrale ne peut pas les recouvrir. »
- **§4 Règles de pose**, règle 1 : « Chaque pièce est posée entièrement dans la silhouette, **au-dessus des briques météo**, sans chevaucher une autre pièce. »
- **§5 Surplus**, en plus : « Les briques météo au-dessus de la demande doivent être absorbées par des exports ou par un pompage. Une marche de météo coupe toute ligne qu'elle traverse : un ruban ne passe pas au-dessus d'une brique. »
- **Demande résiduelle** : la notion reste (cases à couvrir par colonne = demande − météo + exports + pompages − turbinages). Elle sert encore au compte des colonnes, mais plus au dessin.

### Formulation pour §14

- **`row`** (pose, indice `engaged`) : « ligne de la case du bas, comptée depuis le bas de la grille (0 = première ligne, météo comprise). Une pose ne couvre aucune case `r < F[c] + R[c]`. »
- **Validateur**, nouveau contrôle : « chaque case d'une pose ou d'un indice `engaged` est au-dessus de la météo de sa colonne ». Message : `placements[i]: covers a weather cell at <colonne>`, identique en TS et en Python.
- **Rien d'autre ne change dans le format** : mêmes clés, mêmes types. Seul le sens de `row` change, et il est identique à l'ancien sur toute colonne sans météo.

### Exemple : pourquoi « Trop de soleil » n'a plus de solution

- Météo F + R : 1, 1, 1, 1, 2, 5, 6, 4, 2, 1, 1, 1. Demande : 4, 3, 3, 4, 3, 6, 5, 5, 5, 7, 5, 3.
- Pour le nucléaire de 6 de l'inventaire, il n'y a que deux fenêtres de 6 colonnes candidates, et aucune ne marche :
  - **0h-10h** : la barre doit passer au-dessus de la brique la plus haute, 5 à 10h, alors que la demande de 2h n'est que de 3 ;
  - **12h-22h** : à 12h, la météo (6) occupe toute la colonne, export compris.
- La grille n'est donc pas jouable avec la nouvelle règle.

## 3. Effet sur la déduction et la difficulté

### Techniques

| Technique (§9) | Effet |
|---|---|
| Pas de place | **Principale touchée** : une brique météo est une case occupée dès le départ. Une barre ne peut pas passer sur une marche de météo. |
| Le creux coupe le ruban | Une marche de météo coupe la ligne, comme un creux de la silhouette. Même raisonnement, nouvelle cause. |
| Une seule barre pour cette case, La barre qui ne tient qu'à un endroit, Durée de marche, Programme publié | Il reste moins de poses possibles, donc ces techniques se déclenchent plus tôt. Rien ne change dans le raisonnement. |
| Compter la colonne, Cases interchangeables, Relevé, Prix, Flux, Silhouette suit les barres, Inventaire épuisé ou juste, Plafond carbone | Inchangées : elles comptent des cases par colonne, et le compte ne dépend pas de la ligne. |
| Les 4 techniques de rampe | Une rampe ne peut pas non plus passer sur une marche. Raisonnement inchangé. |
| Répartition de l'inventaire, Hypothèse réfutée | Inchangées. Elles portent sur moins de poses possibles. |

- **Nouvelle technique, à nommer seulement** : « La météo coupe la ligne » (« Une barre ne passe pas au-dessus d'une brique météo : chaque marche de la météo coupe la ligne en deux »). C'est « Pas de place » / « Le creux coupe le ruban » appliqué à une brique météo, comme les techniques de rampe nommées au §9. Elle sert au tutoriel et ne change aucune note.

### Difficulté

- **Mesuré**, sur les 10 candidates qui restent valides (§5) : note inchangée pour 10 sur 10 (4 Faciles, 2 Moyennes, 1 Difficile, 3 Expertes). L'échantillon est petit et la déduction de la mesure est approchée (§7).
- **Attendu** : à indices égaux, une grille à météo variable devient plus facile, parce que les marches retirent des poses. Le générateur minimise les indices, donc il compensera en en publiant moins. La météo devient alors un indice gratuit : c'est une nouvelle source de grilles « midi solaire » où le soleil coupe le nucléaire.
- **Non mesurable sans modifier le générateur** : la note des grilles qui seront générées avec la règle.

## 4. Grilles publiées

**Aucune n'est touchée.** Les 13 grilles de `web/src/data/grids.json` ont `R = F = 0` dans toutes les colonnes. L'ancien et le nouveau sens de `row` y sont identiques. Mesure faite avec les deux règles :

| id | Titre | Compositions (avant → après) | Note (avant → après) | Verdict |
|---|---|---|---|---|
| 1 | 1. Poser l'inventaire | 1 → 1 | 1 → 1 | telle quelle |
| 2 | 2. Le prix plafonne la colonne | 1 → 1 | 1 → 1 | telle quelle |
| 3 | 3. Inventaire juste | 1 → 1 | 2 → 2 | telle quelle |
| 4 | 4. Le creux coupe le ruban | 1 → 1 | 2 → 2 | telle quelle |
| 5 | 5. Flux publié et compter la colonne | 1 → 1 | 2 → 2 | telle quelle |
| 6 | 6. La case la plus chère | 1 → 1 | 2 → 2 | telle quelle |
| 7 | 7. Pompage, relevé et programme | 1 → 1 | 2 → 2 | telle quelle |
| 8 | Facile | 1 → 1 | 1 → 1 | telle quelle |
| 9 | Moyen | 1 → 1 | 2 → 2 | telle quelle |
| 10 | Difficile | 1 → 1 | 3 → 3 | telle quelle |
| 11 | Expert | 1 → 1 | 1 → 1 | telle quelle (note stockée 4 : écart antérieur, déjà connu) |
| 12 | 8. La rampe de charbon | 1 → 1 | 1 → 1 | telle quelle |
| 13 | 9. Deux épaules se relaient | 1 → 1 | 3 → 3 | telle quelle |

- **Conséquences** :
  - `grids.json` ne change pas ;
  - la progression des joueurs (`dispatch:progress:v1`) ne demande **aucune migration** : les lignes enregistrées ont le même sens, et l'empreinte `gridFingerprint` ne change pas ;
  - aucune grille n'est à retirer.

## 5. Les 84 candidates du labo

Mesure : solveur exact avec la nouvelle règle (une composition ? égale à la référence ?), puis déduction.

| Lot | Valides telles quelles | Valides, dessin à refaire | Unicité perdue ou référence changée | Sans solution | Total |
|---|---|---|---|---|---|
| nuit-jouer-a | 1 | 1 | 2 | 16 | 20 |
| nuit-jouer-b | 0 | 0 | 7 | 13 | 20 |
| nuit-jouer-c | 2 | 1 | 0 | 17 | 20 |
| nuit-rampe | 1 | 0 | 1 | 18 | 20 |
| nuit-rejeu-notees | 4 | 0 | 0 | 0 | 4 |
| **Total** | **8** | **2** | **10** | **64** | **84** |

- **Avec l'ancienne règle**, les 84 étaient toutes uniques et déductibles.
- **Sans solution (64)** : chacune a une barre de référence qui enjambe une marche, et l'inventaire exact ne tient plus. Les 64 ont toutes au moins une barre tordue, alors que les 8 « telles quelles » n'en ont aucune.
- **Restent publiables (10)** :
  - telles quelles : les 4 du rejeu (grilles publiées 8 à 11), jouer-a n° 6 « Grand froid », jouer-c n° 1 « Grand froid » et n° 16 « La STEP au travail », rampe n° 3 « Journée froide » ;
  - à redessiner, même composition et toujours unique : jouer-a n° 15 « Le pic de 19 heures » et jouer-c n° 15 « Un jour tranquille ». Le solveur donne le nouveau dessin, et les `row` de la solution changent.
- **À jeter (10)** :
  - jouer-a n° 2 et 5 ; jouer-b n° 2, 4, 7, 8, 15, 16 et 19 ; rampe n° 17 ;
  - soit plusieurs compositions, soit une composition unique mais différente de la référence (jouer-a n° 5). Il faudrait choisir de nouveaux indices : autant régénérer.
- **Données de jeu** :
  - parties dans `plays.jsonl` : rejeu n° 1 (2 parties) et jouer-a n° 4 (1 partie, la grille signalée, sans solution désormais) ;
  - note : rejeu n° 1 seulement. Elle reste valide.
- **Conclusion** : il faut régénérer les lots. Avec 12 % de survivantes, trier les lots actuels ne suffit pas.

## 6. Plan de migration

Ordre, avec une estimation en temps de worker. Total d'environ 3 jours, découpable en trois tâches (A, B et C).

| # | Composant | Travail | Estimation | Dépend de |
|---|---|---|---|---|
| 0 | Spécification | GAME-DESIGN §2-§5, §9 (alias « La météo coupe la ligne »), §14 (`row`, contrôle du validateur). | 1 h | — |
| A1 | Validateur Python (`grid.py`) | Contrôle « aucune case sur la météo » pour les poses et les indices `engaged`. | 1 h | 0 |
| A2 | Plateau et solveur exact (`board.py`, `exact.py`) | Lignes absolues dans tout le solveur : une case `(r, c)` existe pour `w[c] ≤ r < w[c] + maxh[c]`. Les briques météo sont occupées d'avance : les booléens « sous la silhouette » partent de `w[c]`. Les poses sont générées en lignes absolues. | 3 h | A1 |
| A3 | Déduction (`deduce/state.py`, `deduce/rules.py`, `trace.py`) | Bornes de ligne décalées de `w[c]` (`range(maxh[c])`, `minh`, `under`) ; les briques météo coupent les lignes pour le ruban ; libellés de trace en ligne absolue ; alias de technique. C'est la plus grosse partie (rules.py fait 44 Ko). | 6 h | A2 |
| A4 | Fixtures (`fixtures/grids/`) | `build_fixtures.py`, plus 3 cas nouveaux : barre sur une marche (invalide), barre au-dessus d'une marche (valide), surplus avec brique au-dessus de la demande. Sur les 66 fixtures actuelles, 61 sont sans météo et 5 ont une météo variable : ces 5 sont à revoir une par une dans le diff. | 2 h | A2 |
| B1 | Moteur et validateur TS (`engine/`, `model/grid.ts`, `model/shapes.ts`) | `checkSilhouette` vérifie aussi `row ≥ w[c]` ; `topIn`, `silhouette` et `evaluate` en lignes absolues ; même message de validateur ; nouvelle erreur joueur dans `fr.ts` (« La météo occupe déjà cette case à 10h »). | 4 h | 0 (A4 pour les tests partagés) |
| B2 | Plateau, gestes, impression (`ui/board.ts`, `ui/game.ts`, `ui/print.ts`) | Supprimer `runs()` et le décalage par colonne : `cellAt` rend directement la ligne visuelle et une barre est un seul rectangle. Le curseur clavier ne descend plus sous la météo. Lancer `check-ui.mjs`. | 3 h | B1 |
| B3 | Progression `localStorage` | Aucune migration (§4). Ajouter un test : `savedBoard` d'une grille publiée sans météo est rejoué tel quel. | 0,5 h | B1 |
| C1 | Générateur (`generate/`) | La pose de référence suit `Puzzle` et n'a pas besoin de changer. La clé de doublon (« résiduel à un décalage près ») doit inclure le profil de météo. Mesurer le taux de rejet `infeasible` des familles à soleil fort (`midi_solaire`, `surplus_midi`) sur un lot d'essai, puis ajuster les marches tirées s'il dépasse environ 50 %. | 4 h | A3 |
| C2 | Labo (`lab/`) | Régénérer sous de nouveaux noms (`v3-jouer-a`…) ; archiver les anciens lots dans `lab/candidates/archive/`, que le labo ne liste plus. Les clés `lot:index` de `notes.json` et `plays.jsonl` restent ainsi valides. Le lot de rejeu est gardé tel quel. Plus environ 10 min de génération. | 2 h | C1 |
| R | Revue | Une revue par tâche (A, B, C) ; `check_unique.py`, pytest et Vitest au vert. | — | — |

- **Parallélisme** : B1 et B2 peuvent démarrer dès la spécification (0), sur les fixtures de A4 dès qu'elles existent. C attend la fin de A.
- **Publication** : rien ne change sur le site tant qu'aucune grille avec météo n'est promue, puisque les grilles publiées n'ont pas de météo. Le merge de B est donc sans effet visible pour les joueurs.

## 7. Méthode de mesure

- **Script** : `docs/next/meteo-briques/mesure.py`, lancé avec `solver/.venv/bin/python`. Il ne modifie pas le solveur : il remplace en mémoire la génération des poses de `Puzzle`. Une pose est placée à une ligne absolue, refusée si une case tombe sur la météo, puis traduite dans les lignes du solveur actuel.
- **Comptage exact** : il est exact avec cette substitution, car seules les cases couvertes comptent.
- **Déduction** : approchée. Une ligne absolue traduite en lignes relatives peut devenir discontinue, ce que les techniques de ruban ne prévoient pas. Les notes de §3 et §5 sont donc indicatives. Les statuts « bloquée / contradiction » des grilles à jeter le confirment : ces grilles ne sont pas uniques de toute façon.
- **Contrôle de la mesure** : avec l'ancienne règle, le script retrouve exactement `dispatch-solver check-published` (13 grilles, mêmes compositions et mêmes notes).
- **Résultats bruts** : `meteo-briques/mesure-publiees.json` et `meteo-briques/mesure-labo.json`. Ce second fichier contient aussi `demo-01` (2 grilles à jeter, 18 sans solution) et `demo` (4 telles quelles).

## 8. Options écartées

- **Garder l'escalier** (statu quo, dessin seulement retouché) : la barre reste tordue, ce qui contredit « une centrale est un rectangle » (§3) et la lecture du joueur.
- **Dessiner la météo au-dessus des centrales** : les barres seraient droites sans toucher au solveur, mais les renouvelables (rang 0) passeraient au-dessus du nucléaire, contre l'ordre de mérite du §2 (« le bas, c'est la base ») et contre la demande de l'humain.
- **Interdire une barre au-dessus d'une marche, en gardant `row` relatif** : plus strict que nécessaire, car une barre posée haut, au-dessus des deux côtés d'une marche, serait refusée alors qu'elle ne touche aucune brique. En plus, le format garderait un `row` qui n'est pas une ligne de la grille.
- **Garder les lignes relatives dans le solveur et traduire les cases** (la méthode de la mesure) : correct pour le comptage, faux pour la déduction (lignes discontinues). C'est bon pour une étude, pas pour le jeu.
- **Trier les lots actuels au lieu de régénérer** : il ne resterait que 10 grilles sur 84, dont 4 sont déjà publiées.

## 9. Questions ouvertes

1. **Que faire des anciens lots ?**
   - **Les archiver et régénérer sous de nouveaux noms (recommandé)** : les notes et les parties gardent leur sens.
   - Les écraser.
2. **Nommer « La météo coupe la ligne » ?**
   - **Oui, comme alias de niveau 1, sans effet sur la note (recommandé)**.
   - Non, « Pas de place » suffit.
3. **Les 8 candidates valides telles quelles et les 2 à redessiner** :
   - **Les reprendre dans les nouveaux lots, avec la mesure refaite par le vrai solveur (recommandé)** ;
   - les laisser dans l'archive.
4. **Une grille de tutoriel sur la météo** :
   - **Oui, une 10e grille de tutoriel « La météo coupe la ligne », après C1 (recommandé)** ;
   - plus tard.
5. **Découpage** :
   - **Trois tâches A (spécification, solveur, fixtures), B (jeu web), C (générateur, labo), avec revue séparée (recommandé)** ;
   - une seule tâche.
6. **Familles à soleil fort, si plus de la moitié des tirages sont rejetés** :
   - **Adoucir les marches de R dans `silhouettes.py` (recommandé)** ;
   - accepter des lots plus lents.
