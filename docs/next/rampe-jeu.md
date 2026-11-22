# Rampe dans le jeu web : conception (S6.1)

Comment le jeu web passe de pièces rectangles à des pièces décrites case par case, pour la rampe **trapèze 1 → 2 → 1** du charbon (étude : `docs/next/rampe.md`). L'escalier reste hors du jeu, mais rien n'est fermé : la forme est une donnée.

## 1. Principe : une forme = un profil par colonne

- **Profil** : pour chaque colonne de la pièce, `(décalage du bas, hauteur)`, depuis son coin bas gauche. C'est la représentation du solveur v2 (`solver/src/dispatch_solver/shapes.py`, branche `v2-solver`).
  - rectangle `len × h` : `(0, h)` répété `len` fois ;
  - trapèze de largeur W : `(0,1)`, `(0,2)` × (W − 2), `(0,1)` ;
  - escalier de largeur W : `(0,2)` × (W − 1), `(0,1)`.
- **Une pose garde ses champs** `{piece, row, col, len[, height]}` : la forme vient de `grid.pieces[piece].shape`. Rien de neuf dans `PlayState` ni dans la progression enregistrée (`dispatch:progress:v1` inchangé).
- **Un seul module** `web/src/model/shapes.ts` : `profileOf(grid, pose)`, `cellsOf(grid, pose)` (liste de `[row, col]`), `cellsInColumn`, `cellCount`. Tout le reste du code passe par lui ; plus aucun calcul `row … row + height` ailleurs.

## 2. Format et validateur (`web/src/model/grid.ts`, §14)

- `PieceDef.shape?: 'rect' | 'trap' | 'stair'` (défaut `rect`) ; `height` devient facultatif, **absent pour une rampe**.
- Contrôles, alignés sur `solver/src/dispatch_solver/grid.py` :
  - seul le charbon `C` peut être une rampe ; `trap` : largeur ≥ 3, `stair` : largeur ≥ 2 ;
  - une rampe n'a pas de `height`, ni dans `pieces` ni sur une pose (ou `height` 1) ;
  - inventaire exact : `bars` donne les largeurs totales, comme une barre.
- **Parité avec Python** : un test Vitest lit `fixtures/grids/*.json` (venu de `v2-solver`) et compare le verdict de `validateGrid()` à `expect.valid`. Les fixtures marquées `requires: ["ramp"]` sont attendues valides (le jeu active les rampes) ; `invalid-ramp-disabled` ne concerne que le drapeau Python, elle est écartée du test avec une ligne qui le dit.
- `GAME-DESIGN.md` : §3 (C : barre ou rampe), §4 (règle 2 : « sa forme »), §9 (4 techniques), §14 (champ `shape`, contrôles) mis à jour ensemble.

## 3. Moteur (`web/src/engine/`)

- `state.ts` : `covers`, `cellsInColumn`, `pieceCells`, `totalImports`, `co2Total`, `barIndexAt` passent par `cellsOf` ; ils prennent la grille en paramètre.
- `rules.ts` :
  - `checkShape` : largeur permise ; hauteur permise pour un rectangle, absente pour une rampe ; bornes ;
  - `checkSilhouette` : par colonne, le haut de la pièce (`row + bas + hauteur`) sous la silhouette ;
  - `overlaps`, `coveredBars` : intersection d'ensembles de cases ;
  - `checkBudget` : `cellCount` au lieu de `len × height`.
- `evaluate.ts` : composition et cases couvertes par `cellsOf`. Programme, durée et centrale engagée lisent `col` et `len` : inchangés.
- **Composition (§8.1) inchangée** : une rampe compte 1 case dans une colonne d'épaule, 2 sous le plateau ; deux dessins de même composition restent une seule solution.

## 4. Rendu SVG (`web/src/ui/board.ts`)

- `drawRect` devient `drawShape` : un **contour en ligne de toits** (bas plat, haut qui suit le profil), découpé par paliers de météo comme aujourd'hui.
  - Écran A : coins arrondis à chaque sommet, rentrants compris (arc de rayon borné par la moitié des arêtes).
  - Papier B : angles vifs, trait 1,2 comme les autres pièces.
- Hachure d'une pose invalide, pose remplacée (pâle), aperçu pendant le glisser, cadenas d'une pièce engagée : même tracé.
- Le cadenas se place en haut à droite de la **dernière colonne** (l'épaule de fin).
- Pas d'étiquette « 2 GW » sur une rampe : la forme suffit.
- Cases cachées sous une pièce, hauteur des pastilles au-dessus des colonnes : par `cellsOf`.

## 5. Geste (`web/src/ui/gesture.ts`)

- `Shape` reçoit `kind`. Une rampe se pose **comme une barre** : la ligne touchée est la **base**, le glisser (ou deux tapes) donne la largeur totale ; le plateau se dessine au-dessus.
- Elle compte comme « plate » pour le geste : un glisser vertical fait défiler la page sur téléphone.
- Pendant le glisser, une largeur interdite (1 ou 2 créneaux) s'affiche en aperçu rouge d'une ligne, avec le message « Une rampe de charbon fait 3 à 5 créneaux ».
- Variantes à trancher sur maquette (artifact) : voir §9.

## 6. Carnet, rangée de centrales, impression

- **Carnet** (`panels.ts`) : la miniature `mb()` dessine un trapèze (2 lignes, plateau sans les épaules) ; indication « rampe de 3 à 5 créneaux » ; inventaire exact : une miniature par rampe, barrée une fois posée.
- **Rangée compacte au téléphone** : même miniature, à petite échelle.
- **Impression** : le carnet imprimé reprend la miniature ; une rampe engagée se dessine en style B. Aucun autre changement (la grille papier est un rectangle de cases).

## 7. Textes (`web/src/i18n/fr.ts`)

- `pieceHint` : « rampe de 3 à 5 créneaux » ; `placementLabel` : « Charbon en rampe de 8h à 20h, base ligne 2 » ; message de largeur interdite.
- `TECHNIQUES` : 4 entrées (§9 de l'étude) — `ramp_plateau` « Le plateau barre la ligne du dessus », `ramp_shoulder` « L'épaule appelle une case », `ramp_lone` « Une case seule est une épaule », `ramp_relay` « Deux épaules se relaient ».
- Textes d'indices inchangés (« Une centrale à charbon tourne de 8h à 24h » vaut pour une rampe, épaules comprises).

## 8. Grilles

- **8 mini-grilles de l'étude** : converties au §14 (elles le sont déjà dans `fixtures/grids/valid-ramp-study-*.json`), validées et rejouées par le moteur dans Vitest (la solution de référence est résolue, une pose hors forme est refusée).
- **Dans le jeu** : T1 et T4 (aucun indice, inventaire exact : la géométrie seule) ajoutées comme tutoriels 8 et 9 du dossier « Premiers pas » (ids 12 et 13) via le skill `add-grid`, après la fusion de `v2-solver` (S6.3). Les 4 bulletins publiés ne changent pas.
- Les grilles escalier (E1 à E4) passent le validateur et le moteur, mais n'entrent pas dans le jeu.
- `check_unique.py` doit connaître les rampes : il tourne sur `dispatch_solver` (branche `v2-solver`, drapeau `allow_ramp`). **Dépendance** : `v2-solver` fusionnée dans `main` avant ma fusion de `main`, sinon je l'adapte.

## 9. Ce qui reste rectangle

- Toutes les autres pièces (N, B, G, T), les imports, les cases de météo, les exports, le pompage et le turbinage.
- La grille papier, les pastilles d'échange, les crochets de programme.
- Une grille déclare son charbon rectangle **ou** rampe, jamais les deux.

## 10. Choix d'interface pour l'humain (maquette)

Le geste de pose d'une rampe, en 2 variantes à 1280 et 375 px :

- **A, glisser la largeur** (recommandée) : le même geste que pour une barre ; la base suit le doigt, le plateau se dessine dès 3 créneaux.
- **B, tampon** : la largeur se choisit dans le carnet (3, 4, 5) ; une tape pose la rampe à partir de la case touchée ; l'aperçu suit le pointeur.

## 11. Vérification prévue

- Vitest : `shapes.ts` (profils, cases), validateur (rampe valide, C seul, pas de `height`, largeur minimale, parité fixtures), moteur (pose, chevauchement d'un plateau, silhouette, composition, 8 mini-grilles résolues), rendu (tracé de la rampe, aperçu, cadenas), geste.
- `npm run typecheck`, `npm run build`, `check_unique.py`.
- Chrome réel (Playwright) à 1280, 375 et 320 px : poser, remplacer, effacer une rampe, résoudre T1 et T4, impression ; captures dans `docs/reviews/S6.1/`.
