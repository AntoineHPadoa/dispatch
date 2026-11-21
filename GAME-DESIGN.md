# Dispatch — document de conception

Base de référence pour construire la version propre du jeu. Il décrit ce qui marche dans le prototype, sans l'historique.

## 1. Le jeu en bref

- **Puzzle de logique solo, imprimable** : une grille par page A4, au crayon, une seule solution, comme un Sudoku ou un Kakuro. On déduit, on ne calcule rien. Il n'y a **aucun score**.
- **Thème** : le joueur construit le **programme d'appel** du réseau électrique pour une journée, c'est-à-dire quelle centrale produit quoi à chaque créneau. Le thème vient du marché européen de l'électricité ; il justifie chaque règle, mais les chiffres sont simplifiés.
- **Le cœur** : remplir exactement la courbe de demande avec des **pièces** (une centrale = un rectangle dont la largeur est sa durée de marche et la hauteur sa puissance), en respectant l'inventaire et les **indices du marché**.
- **Difficulté** : notée automatiquement par les techniques de déduction nécessaires (Facile, Moyen, Difficile, Expert).

## 2. La grille

- **Une case = 1 créneau en largeur × 1 GW en hauteur.**
- **Colonnes = créneaux horaires** de la journée : 6 à 12 colonnes (créneaux de 4 h, 3 h ou 2 h). 12 au maximum pour rester lisible sur papier.
- **Demande** : une hauteur par colonne, en GW. La production non pilotable (renouvelables, fil de l'eau) est posée par la météo (§3). Ce qui reste à couvrir avec les centrales pilotables est la **demande résiduelle** ; elle peut être négative (surplus de renouvelables, voir §5).
- **Silhouette** : la forme dessinée par la demande. Chaque case sous la silhouette doit être couverte exactement une fois ; rien au-dessus.
- Les lignes sont numérotées de bas en haut. Le bas de la silhouette représente la consommation de base, le haut la pointe.

## 3. Les centrales (pièces)

Chaque centrale est un **rectangle** : sa **largeur** est sa durée de marche (en créneaux), sa **hauteur** sa puissance (en GW). Chaque pièce déclare les largeurs et les hauteurs autorisées. La géométrie porte la physique :
- **horizontal** (largeur minimale) : une centrale qui ne peut pas s'arrêter vite, comme un réacteur qui tourne plusieurs créneaux d'affilée ;
- **vertical** (hauteur minimale) : une centrale qui ne peut pas produire peu, comme une usine qui ne descend pas sous 2 GW ;
- **une case** : une centrale souple, qui suit la pointe.

Le prototype n'utilise encore que des barres d'une case de haut ; les pièces verticales et rectangulaires sont prévues par les règles.

**Centrales pilotables** (posées par le joueur) :

| Id | Centrale | Forme actuelle | Rang de prix | CO₂ / case |
|---|---|---|---|---|
| N | Nucléaire | barre de 3 à 6 créneaux (ou plus sur les grandes grilles), 1 GW | 1 (le moins cher) | 0 |
| B | Barrage | 1 case ; le stock d'eau est limité par l'inventaire | 2 | 0 |
| C | Charbon | barre de 3 à 5 | 3 | 3 |
| G | Gaz (cycle combiné) | barre de 2 à 3 | 4 | 1 |
| T | TAC (turbine de pointe) | 1 case | 5 (le plus cher) | 2 |
| I | Import | 1 case, depuis un pays voisin | sans rang | selon le pays |

**Production non pilotable** (posée par la météo, jamais par le joueur) :

| Id | Production | Rôle actuel | Rang de prix | CO₂ / case |
|---|---|---|---|---|
| R | Renouvelables (soleil, vent) | cases imposées par la météo, en bas de la colonne | 0 | 0 |
| F | Fil de l'eau | cases imposées, constantes sur la journée | 0 | 0 |

Aujourd'hui, R et F ne font que réduire la demande à couvrir. Elles restent des pièces à part entière pour ouvrir des mécaniques : prévision météo incertaine, écrêtement d'un surplus, indice « production solaire de midi », renouvelables qui varient d'un créneau à l'autre.

Le **rang de prix** suit l'ordre d'appel réel (merit order). Il ne sert qu'aux indices de prix : « à 8h, c'est le gaz qui fixe le prix » veut dire que la case pilotable la plus chère de la colonne est du gaz. L'import n'a pas de rang : un indice de prix ne porte jamais sur un créneau qui contient un import.

Toutes les pièces ne sont pas présentes dans chaque grille : la grille déclare les centrales disponibles.

## 4. Règles de pose

1. Chaque pièce est posée entièrement dans la silhouette, sans chevaucher une autre pièce.
2. Sa largeur et sa hauteur font partie de celles autorisées pour sa pièce.
3. Toutes les cases de la silhouette sont couvertes.
4. L'inventaire est respecté (§6) et tous les indices sont vrais (§7).
5. Les contraintes optionnelles de la grille sont respectées (§5).

## 5. Mécaniques optionnelles

Chacune s'active par grille. Elles créent du choix, et c'est ce choix qui fait les grilles difficiles.

- **Voisin (interconnexion)** : un pays voisin relié par une ligne de **capacité limitée** (en blocs par créneau, souvent 1).
  - **Import** : une case de la colonne est fournie par le voisin (pièce I).
  - **Export** : un bloc vendu au voisin ajoute une case à remplir dans la colonne (la silhouette monte de 1).
  - À chaque créneau : imports + exports avec ce pays ≤ capacité de la ligne.
  - Plusieurs voisins possibles (ex. Allemagne, Royaume-Uni, Espagne), chacun avec sa ligne.
  - Les voisins n'ont **pas de prix** : seuls la capacité et les indices comptent.
- **Surplus** : une colonne de demande résiduelle négative doit être absorbée par des exports (pas d'écrêtement). Un surplus casse les rubans de nucléaire, un export permet de les prolonger.
- **STEP (stockage par pompage)** : une paire pompage ▲ / turbinage ▼. Le pompage ajoute une case à remplir dans un créneau, le turbinage en retire une dans un créneau **plus tard**. Le nombre de paires est fixé par la grille. Usage typique : remplir un creux pour prolonger un ruban, raboter une pointe.
- **Plafond CO₂** : la somme du CO₂ des cases posées ne dépasse pas le plafond. Avec plusieurs voisins, chaque pays a son **CO₂ par case importée** : sous plafond, le choix du pays devient une vraie décision. Le contrôle se fait en comptant des cases.

## 6. Inventaire

L'inventaire est le carnet d'ordres du jour : les centrales appelées.

| Format | Usage | Ce que voit le joueur |
|---|---|---|
| **Exact** | tutoriel | la longueur de chaque barre (« N 6, 6, 5 · G 2, 2 · T ×5 ») ; nombre de cases pour les pièces d'une case |
| **Sans inventaire** | toutes les autres grilles | seulement les centrales disponibles ; la déduction repose sur les indices |

- En format exact, il faut poser tout l'inventaire, ni plus ni moins.
- **Sans inventaire, les totaux d'échanges et de stockage sont donnés sous forme d'indices** (§7, « Échanges du jour ») et non comme un inventaire, pour rester cohérent.
- Les formats intermédiaires (nombre de barres, nombre de cases) n'apportent rien de plus que l'exact et ne sont pas retenus.

## 7. Indices du marché

Chaque indice est un document que le marché publie vraiment. La grille en donne le **plus petit ensemble** qui rend la solution unique et déductible.

| Indice | Document | Exemple affiché | Contrainte |
|---|---|---|---|
| **Prix** | prix publié par la bourse | « À 8h, c'est le gaz qui fixe le prix. » | la case la plus chère de la colonne est de cette centrale |
| **Programme** | programme publié d'une centrale | « Un réacteur tourne de 4h à 20h. » | une barre de cette pièce couvre exactement ces créneaux (ligne libre) |
| **Durée de marche** | fiche technique du jour | « Un réacteur tourne 6 créneaux d'affilée. » | une barre de cette pièce a exactement cette longueur (créneaux libres) |
| **Relevé** | relevé de production RTE | « Relevé de 16h : 2 cases de gaz, aucune TAC. » | nombre de cases de ces pièces dans la colonne |
| **Flux** | flux d'interconnexion publié | « À 21h, 1 bloc part vers l'Allemagne. » | export ou import d'un créneau avec un pays |
| **Échanges du jour** | bilan des échanges | « Aujourd'hui : 2 blocs exportés, 1 importé, 1 pompage. » | totaux d'exports, d'imports (par pays ou tous pays confondus) et de paires STEP |
| **Centrale engagée** | contrat déjà signé | « Déjà engagée : TAC à 18h, ligne 5. » | barre pré-posée, non effaçable ; **réservé au tutoriel** (donne la réponse au lieu de la faire déduire) |

## 8. Validité d'une grille

Une grille n'est publiée que si elle remplit les trois conditions des jeux de logique sérieux :

1. **Solution unique**, jugée sur la **composition** : pour chaque colonne, le nombre de cases de chaque pièce (imports par pays), plus les exports, imports et STEP par créneau. Deux dessins de même composition (échanger deux barres de ligne) sont une seule solution.
2. **Résoluble sans essai-erreur** : un solveur de déduction humaine (§9) doit arriver au bout avec des règles simples, sans deviner.
3. **Aucun indice inutile** : retirer n'importe quel indice casse l'unicité ou la déduction.

## 9. Difficulté

Note = la technique la plus avancée nécessaire, à la Sudoku. Chaque technique a un nom et une phrase pour le joueur : elles servent au tutoriel.

| Niveau | Technique | Phrase pour le joueur |
|---|---|---|
| 1 | Pas de place | Une barre ne peut ni dépasser de la silhouette ni chevaucher une barre déjà posée. |
| 1 | Inventaire épuisé | Quand toutes les cases d'une pièce sont trouvées, elle ne va nulle part ailleurs ; une barre plus longue que ce qu'il reste ne passe plus. |
| 1 | Le prix plafonne la colonne | Sous un prix publié, aucune case n'est plus chère que ce prix. |
| 1 | Le relevé compte les cases | Un relevé atteint interdit d'autres cases de cette pièce ; s'il reste juste assez de cases possibles, elles y passent toutes. |
| 1 | Flux publié | Un flux publié fixe l'export ou l'import d'un créneau avec un pays. |
| 1 | Une seule barre pour cette case | Une case qu'une seule barre peut encore couvrir reçoit cette barre. |
| 1 | La barre qui ne tient qu'à un endroit | Une barre de l'inventaire qui n'a plus qu'une place possible y va. |
| 1 | Programme publié | La barre annoncée par un programme va sur la seule ligne où elle tient. |
| 1 | La silhouette suit les barres | Un export ou un pompage qui laisserait une case impossible à couvrir est exclu. |
| 1 | Cases interchangeables | Quand on connaît le nombre de cases de chaque pièce dans une colonne, l'ordre ne compte pas. |
| 2 | La case la plus chère | Un prix publié exige au moins une case de cette centrale dans la colonne : s'il n'y a qu'une place possible, c'est elle. |
| 2 | Le creux coupe le ruban | Chaque ligne se découpe en rubans entre les creux : une barre qui laisserait un bout impossible à remplir est exclue. |
| 2 | Inventaire juste | S'il reste exactement autant de cases possibles que de cases à poser pour une pièce, toutes sont à elle. |
| 2 | Compter la colonne | Une colonne a autant de cases que sa hauteur : connaissant les autres pièces, on déduit celle qui reste. |
| 2 | Plafond carbone | Une barre qui ferait dépasser le plafond CO₂ est exclue. |
| 3 | Répartition de l'inventaire | Les barres doivent toutes trouver une ligne : un découpage qui empêche les autres de se placer est exclu. |
| 4 | Hypothèse réfutée | Si un choix mène à une impasse par les règles simples, il est exclu (une seule hypothèse, jamais imbriquée). |

**Ce qui crée la difficulté** (constaté sur les tirages) : des choix réels, c'est-à-dire un voisin, un STEP ou l'absence d'inventaire. Sans voisin et avec un inventaire exact, les grilles sont toujours faciles.

**À recalibrer en priorité** : en test humain, les grilles notées Expert et Difficile ont été jugées très faciles. Le classement des techniques (en particulier « Hypothèse réfutée » et « Répartition de l'inventaire ») ne correspond pas encore à la difficulté ressentie. Il faut le recalibrer avec des parties chronométrées de plusieurs joueurs (voir §12).

Les techniques sont écrites pour des barres d'une case de haut, les seules du prototype. Avec des pièces verticales ou rectangulaires, elles s'étendent naturellement (« pas de place » vaut aussi en hauteur), et de nouvelles techniques apparaîtront, comme une colonne trop basse pour une centrale qui ne descend pas sous 2 GW.

## 10. Génération des grilles

1. Tirer une silhouette, les centrales disponibles et les mécaniques actives (paramètres : nombre de créneaux, hauteur, pièces, voisins, STEP, surplus, plafond CO₂).
2. Calculer une **pose de référence plausible** : l'ordre d'appel réel (le moins cher d'abord), qui place le nucléaire en base et les centrales chères en pointe.
3. Construire l'inventaire au format voulu (exact ou sans inventaire).
4. **Choisir les indices** : ajouter un à un l'indice qui laisse le moins de cases indécises, jusqu'à ce que la déduction aboutisse, puis retirer ceux qui ne servent plus.
5. Vérifier l'unicité par un solveur exact (le prototype utilise OR-Tools CP-SAT) et la résolubilité par le solveur de déduction ; noter la difficulté ; rejeter au-delà d'un nombre maximal d'indices ou si la note ne correspond pas à la note visée.
6. **Viser la diversité** : varier les silhouettes, les mécaniques et les types d'indices d'une grille à l'autre (retour de test : la démo manque de diversité).

## 11. Tutoriel

Une grille par technique, en inventaire exact, dans cet ordre : poser l'inventaire (cases interchangeables) → le prix plafonne la colonne → inventaire juste → le creux coupe le ruban → flux publié et compter la colonne → la case la plus chère → pompage, relevé et programme. Chaque grille introduit **une** technique nommée, dans son texte d'introduction.

## 12. Hors périmètre actuel (backlog)

- Indice progressif : un bouton « prochaine déduction possible » qui montre une seule étape, tiré du solveur de déduction.
- Courbe de difficulté sur la semaine (facile le lundi, difficile le samedi), avec la même silhouette déclinée.
- Mode annotations (marquer « pas de nucléaire ici »), sur papier comme à l'écran.
- Feuille de règles d'une page avec un exemple résolu, et corrigé séparé.
- Calibrage humain : faire jouer quelques personnes aux grilles notées, chronométrer, ajuster la note.

## 13. Glossaire du thème

- **Programme d'appel** : le plan qui dit quelle centrale produit quoi à chaque créneau.
- **Merit order** : l'ordre d'appel des centrales, de la moins chère à la plus chère.
- **Prix marginal** : le prix d'un créneau est fixé par la centrale la plus chère appelée.
- **Ruban** : une barre de nucléaire, production constante sur plusieurs créneaux.
- **Pointe** : les créneaux de plus forte demande ; une pointe courte et isolée ne se couvre qu'avec des pièces d'une case.
- **Interconnexion** : la ligne vers un pays voisin, de capacité limitée.
- **STEP** : station de transfert d'énergie par pompage.
- **RTE** : le gestionnaire du réseau français, qui publie les relevés de production.

## 14. Format de grille (référence)

```json
{
  "columns": ["0h", "3h", "6h", "9h", "12h", "15h", "18h", "21h"],
  "demand": [4, 3, 6, 8, 6, 8, 8, 5],
  "pieces": {
    "N": {"len": [3, 4, 5, 6], "height": [1], "rank": 1, "co2": 0},
    "G": {"len": [2, 3], "height": [1], "rank": 4, "co2": 1},
    "T": {"len": [1], "height": [1], "rank": 5, "co2": 2}
  },
  "weather": {"R": [0, 0, 1, 2, 2, 1, 0, 0], "F": [1, 1, 1, 1, 1, 1, 1, 1]},
  "neighbors": [{"id": "DE", "name": "Allemagne", "cap": 1, "co2": 3}],
  "step": true,
  "co2_cap": null,
  "inventory": {"level": "none", "pieces": {"N": {}, "G": {}, "T": {}}},
  "clues": [
    {"type": "price", "col": 6, "piece": "T"},
    {"type": "bar", "piece": "N", "col": 2, "len": 5},
    {"type": "length", "piece": "N", "len": 6},
    {"type": "column", "col": 4, "counts": {"G": 2, "T": 0}},
    {"type": "flow", "col": 7, "country": "DE", "dir": "export", "value": 1},
    {"type": "exchanges", "exports": {"DE": 1}, "imports": {"DE": 0}, "step": 1}
  ],
  "solution": {"exports": {"DE": [0, 0, 0, 0, 0, 0, 0, 1]}, "step": [{"pump": 1, "turbine": 6}], "placements": [{"piece": "N", "row": 0, "col": 0, "len": 8}]},
  "difficulty": {"rating": 3, "label": "Difficile", "techniques": ["ribbon", "share_out"]}
}
```

Champs de la grille complète, en plus de l'exemple ci-dessus :

- **Tête** : `id` (entier > 0), `title`, `section` (`"tutorial"` ou `"rated"`), `intro` (texte affiché avant de jouer, facultatif) et `teaches` (ids des techniques introduites, pour les grilles de tutoriel).
- **`column.counts`** : une clé est un id de pièce, ou `I:<pays>` pour les imports d'un seul voisin (ex. `{"G": 2, "I:DE": 0}`).
- **`height`** : facultatif sur une pose (`solution.placements`) et sur un indice `engaged` ; 1 par défaut, et toujours une valeur de `pieces.<id>.height`.
- **`inventory.pieces.<id>.max_cells`** : stock maximal en cases d'une pièce, connu du joueur même au niveau `none` (ex. l'eau d'un barrage : `"B": {"max_cells": 2}`). Le moteur refuse une pose qui dépasse ce stock.

Contrôles du validateur : de 6 à 12 colonnes ; rang et CO₂ de chaque pièce égaux à ceux du §3 ; `pieces` et `inventory.pieces` ont les mêmes clés ; `imports` ne mêle pas `"*"` et des clés par pays ; chaque pose a une largeur et une hauteur permises, tient dans la grille, et un import fait 1 case ; un bulletin a un numéro, un titre, un texte, un ciel par colonne et une date ISO réelle ; une grille avec STEP publie son nombre de paires (`inventory.step` en exact, `step` d'un indice `exchanges` sinon) ; dans `solution.step`, `pump` est avant `turbine` ; un flux ou un export ne dépasse pas le `cap` de la ligne.

- **`bulletin`** (facultatif) : le bulletin du marché publié avec la grille, `{"number", "title", "text", "weather", "published"}`.
  - `number` : numéro du bulletin (entier > 0, unique d'une grille à l'autre) ; `title` et `text` : titre et court texte de contexte (non vides).
  - `weather` : un ciel par créneau, parmi `sun`, `moon`, `cloud`, `wind` (autant de valeurs que de colonnes).
  - `published` : jour de publication, ISO `YYYY-MM-DD`.
  - **Fiche du jour** : le bulletin dont la date de publication est la plus récente et ≤ aujourd'hui (date locale du navigateur). Stock épuisé : le dernier publié reste affiché ; avant la première publication, il n'y en a pas (`web/src/model/bulletin.ts`).
  - Les bulletins des 4 grilles notées sont écrits à la main dans `web/scripts/bulletins.ts`, repris par `npm run convert`.

En inventaire exact : `"inventory": {"level": "exact", "pieces": {"N": {"bars": [6, 6, 5]}, "T": {"cells": 5}}, "exports": {...}, "imports": {...}, "step": 1}`.

## 15. Code (référence)

- `web/` : le jeu (TypeScript + Vite) : format §14 et son validateur (`src/model/grid.ts`), moteur pur (`src/engine/`), interface et impression (`src/ui/`), grilles (`src/data/grids.json`).
- `solver/` : solveur exact (Python, OR-Tools CP-SAT), solveur de déduction humaine (`deduce.py`, règles du §9), générateur à indices minimaux et CLI. Il contient aussi des modes à score (v1, v2, score cible), qui ne font plus partie du jeu.
- `docs/archive/demo/` : prototype JS d'origine ; `grids-pose.json` est la source des 11 grilles actuelles (`web/scripts/convert-grids.ts`).
