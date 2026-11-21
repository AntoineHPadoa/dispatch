# Rampe : étude des deux profils (S1.1)

Étude sur papier de la rampe (brief §2) : une centrale thermique qui démarre et s'arrête par paliers, posée d'un bloc. Deux profils sont traités à fond : le **trapèze 1 → 2 → 1** et l'**escalier 2 → 1**. Aucun code de jeu n'est écrit ici.

- **Planche visuelle** des 8 mini-grilles (style papier B, énoncé, solution, déductions) : https://claude.ai/artifact/HN1VS9hZ5ngGY141CKAzLg (source : `docs/next/rampe-grilles.html`).
- **Vérification** : `docs/next/rampe/check_ramp.py` (CP-SAT, jetable, hors du package) sur `docs/next/rampe/grids.json`.
- **Recommandation** : traiter le **trapèze** en premier (§5).

## 1. Cadre commun aux deux profils

### La pièce

- **La rampe est une forme du charbon (C)**, pas une nouvelle centrale.
  - Le charbon est la centrale thermique lente à démarrer : c'est lui que la rampe raconte.
  - Aucune grille actuelle n'utilise C : pas de reprise.
  - Pas de 6ᵉ rang de prix ni de nouvelle couleur.
- **Rang 3, CO₂ 3 par case**, comme le charbon du §3.
- **Une seule forme par grille** : la grille déclare si son charbon est un rectangle (défaut) ou une rampe, jamais les deux.
- Écarté : une pièce à part (« cycle combiné en rampe »), qui ajoute un rang et une couleur sans gain de jeu.

### Format proposé (§14)

```json
"pieces": { "C": { "shape": "trap", "len": [3, 4, 5], "rank": 3, "co2": 3 } },
"solution": { "placements": [ { "piece": "C", "row": 1, "col": 2, "len": 4 } ] }
```

- `shape` : `"rect"` (défaut), `"trap"` (trapèze) ou `"stair"` (escalier). Pas de `height` pour une rampe : la hauteur est fixe.
- `len` : **largeur totale**, épaules comprises (la durée de marche).
- Une pose garde ses champs actuels : `row` est la **ligne de la base**, `col` le premier créneau. Les cases se déduisent de la forme.
- Inventaire exact : même champ `bars` (« Charbon, rampes de 4 et 4 »).

### Position verticale

- La base occupe une ligne, le plateau la ligne juste au-dessus. La rampe se pose **à n'importe quelle ligne**, comme une barre.
- Pas de gravité : les cases sous la rampe sont couvertes par d'autres pièces, comme aujourd'hui.
- Les épaules sont **en bas** (courbe de charge qui monte puis descend). La forme inversée (plateau en bas, épaules en haut) est écartée : elle se lirait comme une baisse de charge et doublerait les cas.
- **La conséquence clé** : la case juste au-dessus d'une épaule est **fermée d'un côté** par le plateau. C'est d'elle que viennent presque toutes les déductions nouvelles.

### Composition et validité (§8)

- Inchangées : la solution se juge sur le nombre de cases par pièce et par colonne. Une rampe compte 1 case dans une colonne d'épaule (ou de marche), 2 sous son plateau.
- Deux dessins de même composition restent une seule solution.

## 2. Trapèze 1 → 2 → 1

### Degrés de liberté

- **Longueur** : largeur totale W ≥ 3, plateau de W − 2 créneaux. Liste par grille ; `[3, 4, 5]` par défaut, jusqu'à 6 ou 7 sur 12 colonnes.
- **Hauteur** : fixe, épaules à 1 GW et plateau à 2 GW.
  - Écarté : un plateau plus haut (2 → 3 → 2). C'est une barre d'1 GW sous une rampe : une forme de plus, aucune déduction de plus.
  - Écarté pour l'instant : une rampe à deux paliers (1 → 2 → 3 → 2 → 1). À reconsidérer si le labo manque de variété.

### Formes légales

| Largeur | Profil (cases par colonne) | Cases | CO₂ |
|---|---|---|---|
| 3 | 1 2 1 | 4 | 12 |
| 4 | 1 2 2 1 | 6 | 18 |
| 5 | 1 2 2 2 1 | 8 | 24 |
| W | 1, 2 × (W − 2), 1 | 2W − 2 | 3 × (2W − 2) |

Le nombre de cases est toujours pair.

### Règles de pose

1. Toutes les cases de la rampe sont dans la silhouette, sans chevaucher une autre pièce : W cases sur la ligne de base, W − 2 sur la ligne du dessus.
2. Sa largeur fait partie de celles permises.
3. Le reste du §4 ne change pas.

### Effet sur les indices

- **Prix** : inchangé. Une case de rampe est du charbon, épaule ou plateau. « À 8h, c'est le charbon qui fixe le prix » demande au moins une case de rampe à 8h.
- **Relevé** : il compte des cases, et le compte dit maintenant quelque chose de la forme.
  - 1 case de charbon : une épaule (début ou fin, à trouver).
  - 2 cases : un plateau, ou deux épaules de deux rampes qui se relaient.
  - 3 cases : un plateau et l'épaule d'une autre rampe.
- **Programme** (`bar`) : « Une centrale à charbon tourne de 8h à 24h », épaules comprises. Il fixe la composition du charbon sur ces créneaux (1, 2…2, 1) ; la ligne reste libre. Le texte actuel convient.
- **Durée** (`length`) : la largeur totale.
- **Flux, échanges, STEP** : inchangés. Un export ou un pompage au-dessus d'une épaule ajoute une case coincée ; un turbinage peut en retirer une. Piste de déduction non explorée par les mini-grilles.
- **Plafond CO₂** : 3 par case, se compte comme aujourd'hui.
- **Centrale engagée** : une rampe pré-posée se dessine comme les autres pièces.

### Mini-grilles

Vérifiées par CP-SAT : une seule composition, chaque indice nécessaire, et les poses clés de la déduction forcées. Détail pas à pas et dessins dans la planche.

| Grille | Format | Indices | Déduction nouvelle |
|---|---|---|---|
| T1, 6 col. | inventaire exact | aucun | **Le plateau barre la ligne du dessus** (le ruban de 6 passe sous la rampe), puis **l'épaule appelle une case** : au bord du jour, la case au-dessus de l'épaule ne peut être qu'une TAC. |
| T2, 8 col. | inventaire exact | 3 | **Une case seule est une épaule** : le relevé de 9h (1 case de charbon) laisse deux rampes possibles, démarrage ou arrêt ; le prix du gaz à 3h tranche. |
| T3, 6 col. | sans inventaire | 2 | **Le mur décalé** : la rampe ferme la ligne 1 dès 8h et la ligne 2 dès 12h ; le ruban de ligne 2 couvre la case au-dessus de l'épaule et s'arrête pile contre le plateau. |
| T4, 8 col. | inventaire exact | aucun | **Deux épaules se relaient** : à 9h, deux cases de charbon sans plateau, l'arrêt d'une rampe et le démarrage d'une autre posée un étage plus haut. |

Pourquoi ces déductions n'existent pas sans la rampe :

- Une barre ferme une ligne à ses deux bouts ; une pièce haute ferme plusieurs lignes **au même créneau**. Seule la rampe ferme deux lignes **à un créneau d'écart**, d'où la case coincée au-dessus de l'épaule (T1, T3).
- Avec des rectangles, une case de charbon dans un relevé ne dit rien de l'étendue de la pièce. Avec la rampe, elle désigne un bout (T2).
- Deux rectangles ne s'emboîtent pas en diagonale ; deux rampes oui (T4).

Limites :

- T1 et T4 n'ont **aucun indice** : l'inventaire exact suffit. Ce sont des grilles de tutoriel, qui montrent la géométrie forcée.
- T2, étape 3 (trouver la ligne de la rampe) passe par un court raisonnement par cas. Acceptable en Moyen, pas en Facile.

### Techniques §9 à ajouter

| Niveau (provisoire) | Technique | Phrase pour le joueur |
|---|---|---|
| 1 | Le plateau barre la ligne du dessus | Au-dessus de sa base, la rampe occupe aussi la ligne suivante sur tout son plateau : aucun ruban de cette ligne ne la traverse. |
| 1 | L'épaule appelle une case | La case au-dessus d'une épaule est fermée côté plateau : seule une pièce d'une case, ou une barre qui s'arrête pile là, peut la couvrir. |
| 2 | Une case seule est une épaule | Une seule case de rampe dans une colonne, c'est une épaule : la rampe continue à deux cases d'un côté et s'arrête de l'autre. |
| 3 | Deux épaules se relaient | Deux cases de rampe sans plateau autour : une rampe s'arrête et une autre démarre sur son épaule. |

Les niveaux suivent le barème actuel et seront recalés par le calibrage humain (S5.3).

## 3. Escalier 2 → 1

### Degrés de liberté

- **Longueur** : largeur totale W ≥ 2 : deux cases sur W − 1 créneaux, puis une marche d'une case. Liste par grille ; `[2, 3, 4]` par défaut.
- **Hauteur** : fixe, 2 GW puis 1 GW.
- **Sens** : la marche est **toujours à droite** (arrêt progressif). Le miroir (1 → 2, démarrage progressif) est écarté : deux formes à distinguer pour le joueur, et le trapèze couvre déjà le cas symétrique.

### Formes légales

| Largeur | Profil | Cases | CO₂ |
|---|---|---|---|
| 2 | 2 1 | 3 | 9 |
| 3 | 2 2 1 | 5 | 15 |
| 4 | 2 2 2 1 | 7 | 21 |
| W | 2 × (W − 1), 1 | 2W − 1 | 3 × (2W − 1) |

Le nombre de cases est toujours impair.

### Règles de pose

- Les mêmes que le trapèze : W cases sur la ligne de base, W − 1 sur la ligne du dessus, à partir du même créneau.
- Le départ est un **mur de deux cases** : il ferme deux lignes au même créneau, comme une pièce haute du §3.
- Une seule case coincée par escalier : au-dessus de la marche, fermée à gauche.

### Effet sur les indices

- **Prix, programme, durée, flux, échanges, CO₂** : comme pour le trapèze.
- **Relevé** :
  - 1 case de charbon : la marche finale, **sans ambiguïté** ; la colonne d'avant a 2 cases, celle d'après n'a plus cet escalier.
  - 2 cases : le départ ou le corps de l'escalier, ou deux marches.
  - 3 cases : une marche et le départ d'un autre escalier.

### Mini-grilles

| Grille | Format | Indices | Déduction nouvelle |
|---|---|---|---|
| E1, 8 col. | inventaire exact | 2 | **La marche ferme l'escalier** : la case seule de 12h est la marche, l'escalier de 4 tourne de 3h à 15h ; puis la case au-dessus de la marche ne peut être qu'une TAC. |
| E2, 6 col. | sans inventaire | 3 | **La marche suit la descente** : à 4h la silhouette tombe à deux cases ; l'escalier parti de 0h y pose sa marche, il fait 2 créneaux. |
| E3, 8 col. | inventaire exact | 1 | **La marche appelle une case** : au-dessus de la marche, la case est fermée à gauche ; sans TAC, un gaz de 3 doit y commencer. |
| E4, 8 col. | inventaire exact | 1 | **Les marches se relaient** : 3 cases de charbon à 6h, ce sont deux escaliers, la marche de l'un sous le départ de l'autre. |

Limites :

- E1 tranche le sens en un coup : plus direct que T2, donc plus facile.
- E2 est la seule où l'escalier se déduit de la silhouette seule ; c'est aussi la plus simple des huit.

### Techniques §9 à ajouter

| Niveau (provisoire) | Technique | Phrase pour le joueur |
|---|---|---|
| 1 | La marche appelle une case | La case au-dessus de la marche est fermée côté escalier : seule une pièce d'une case, ou une barre qui y commence, peut la couvrir. |
| 1 | La marche suit la descente | Quand la silhouette n'a plus de place pour la ligne du haut de l'escalier, il y pose sa marche : sa largeur s'en déduit. |
| 2 | La marche ferme l'escalier | Une seule case d'escalier dans une colonne, c'est sa marche : il a deux cases juste avant, et rien après. |
| 3 | Les marches se relaient | Trois cases d'escalier dans une colonne : la marche de l'un et le départ d'un autre. |

## 4. Coût

Le gros du travail est commun aux deux profils : passer de pièces rectangles à des **pièces décrites case par case**. L'écart entre trapèze et escalier est sous 5 %.

- **Format et validateur** (`web/src/model/grid.ts`, GAME-DESIGN §3, §4, §14) :
  - champ `shape`, contrôles (W ≥ 3 ou ≥ 2, pas de `height`), cases d'une pose ;
  - environ 60 lignes et leurs tests.
- **Moteur TS** (`web/src/engine/`) :
  - un helper `cellsOf(placement)` remplace les calculs de rectangle de `state.ts` (`cellsInColumn`, `pieceCells`, test de contenance) et de `rules.ts` (`checkSilhouette`, `overlaps`, `checkBudget`, `coveredBars`) ;
  - `evaluate.ts` compte déjà par colonne ; programme et durée lisent `col` et `len`, inchangés ;
  - environ 150 lignes touchées, plus les tests.
- **Rendu SVG** (`web/src/ui/board.ts`) :
  - `drawRect` devient un tracé de polygone (contour de 8 sommets pour le trapèze, 6 pour l'escalier) ;
  - écran A : coins arrondis à recalculer sur un tracé, y compris les coins rentrants ;
  - aperçu pendant le glisser, pose invalide, pièce engagée ;
  - environ 120 lignes.
- **Gestes** (`web/src/ui/gesture.ts`) : le glisser donne la largeur, la ligne touchée est la base. Pas de sens à choisir pour aucun des deux profils. Environ 30 lignes.
- **Carnet et miniatures** (`web/src/ui/panels.ts`) : une silhouette de rampe dans la rangée du charbon, l'indication « rampe de 3 à 5 créneaux ». Environ 40 lignes.
- **Impression** (`web/src/ui/print.ts`) : reprend le rendu en style B ; seul le carnet imprimé change. Environ 10 lignes.
- **Textes** (`web/src/i18n/fr.ts`) : indication de forme, noms et phrases des techniques. Environ 20 lignes.
- **Solveur exact** (nouveau package S4) : CP-SAT énumère déjà des poses booléennes ; une pose devient un ensemble de cases. Faible, environ 50 lignes.
- **Solveur de déduction** (S4) : le poste le plus lourd. Le découpage en rubans doit gérer les murs décalés, les cases coincées et les 4 techniques nouvelles. Environ 300 à 400 lignes dans la réécriture.
- **Ordre de grandeur** : moteur et validateur 1 j, rendu, gestes et carnet 1,5 j, solveur exact 0,5 j, déduction 2 j, tests et grilles 1 j.

## 5. Comparaison et recommandation

| Critère | Trapèze 1 → 2 → 1 | Escalier 2 → 1 |
|---|---|---|
| Réalisme | Montée et descente en charge : la courbe d'une centrale thermique. | Arrêt progressif seul ; un démarrage à pleine puissance est moins crédible. |
| Lecture | Symétrique, aucun sens à apprendre ; se lit comme une bosse. | Orienté : il faut retenir que la marche est à droite. |
| Cases coincées | Deux par rampe. | Une par escalier ; le départ se comporte comme une pièce haute. |
| Relevé d'une case | Une épaule, mais de quel côté ? Une vraie déduction (T2). | La marche, sans ambiguïté : plus direct, plus facile (E1). |
| Relais | Deux épaules dans une colonne, en diagonale (T4). | Trois cases dans une colonne (E4). |
| Silhouettes | Colle à la bosse de la journée (matin et soir). | Colle aux descentes du soir seulement. |
| Encombrement | 3 créneaux au minimum : plus dur à caser sur 6 colonnes. | 2 créneaux au minimum. |
| Coût | Commun ; contour de 8 sommets. | Commun ; contour de 6 sommets. |

**Recommandation : le trapèze en premier.**

- Plus réaliste et symétrique : rien à apprendre sur le sens.
- Plus riche : deux cases coincées par pièce, un relevé d'une case qui oblige à regarder des deux côtés, des relais en diagonale.
- L'escalier reste documenté ici. Il pourra revenir comme seconde forme si le labo manque de variété ; son départ en mur double les pièces hautes déjà prévues.

## 6. Points ouverts

- **Critère d'entrée (S1.2)** : chercher dans les traces du solveur de déduction, sur un lot de grilles générées, les 4 techniques du §2 ci-dessus. Une grille qui ne les emploie pas n'apporte rien.
- **STEP et exports** au-dessus d'une épaule : piste de déduction à mesurer dans le labo.
- **Rampe sur une autre centrale** (gaz) : hors v2 ; une seule pièce en rampe par grille.
- **Niveaux** des techniques : provisoires, recalés par S5.3.

## 7. Vérification

- `solver/.venv/bin/python docs/next/rampe/check_ramp.py` : pour chacune des 8 grilles,
  - une seule composition (nombre de cases par pièce et colonne) ;
  - chaque indice nécessaire (sans lui, au moins 2 compositions) ;
  - les poses clés de la déduction présentes dans toute solution (2 à 4 par grille).
- Résultat : 8 / 8 OK.
- Le script ne vérifie pas la déduction humaine : les étapes de la planche sont écrites à la main, puis confrontées au solveur pose par pose.

## 8. Décision

_À compléter après le choix de l'humain._
