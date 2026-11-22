# Review v3-meteo-b (jeu web, météo en briques)

## Tour 2 (commit `0fa410e`)

**Verdict : OK à merger** (après `v3-meteo-a`). Les 3 points sont traités, sans régression.

Périmètre : `git log b28e13a..v3-meteo-b`, un commit `0fa410e` « Web: weather review fixes » (4 fichiers, +21 −8), worktree `../spot-elec-v3-meteo-b`.

### Points du tour 1
- **1. Test B3, corrigé** : `ui.test.ts` filtre les grilles publiées sans météo (`R` et `F` à zéro), avec un garde-fou `dry.length > 0`. Le test garde son objectif : une sauvegarde brute sous `dispatch:progress:v1` est rejouée telle quelle, et la grille est résolue. Une grille météo promue ne le casse plus.
- **2. Validateur TS, corrigé** : `checkWeather` n'est plus appelé sans condition. Il passe par `checkBarGeometry` (pièce connue, et pour `engaged` une `height` valide) et par la branche import, comme `check_bar_geometry` / `check_off_weather` dans `grid.py`. La garde passe de `isCol` à `isNat`, comme `_is_nat` en Python. Nouveau test dans `engine.test.ts` : pièce inconnue et `height: 0` sur la météo, aucune erreur `weather cell`.
- **3. Libellé « ligne N », tranché** : l'humain a répondu à q368 (`answers/q368.md`) qu'on compte toujours depuis le bas de la grille, parce que la météo est une centrale imposée. Le code reste donc tel quel, et le commentaire de `placementLabel` (`fr.ts`) le précise. Ce n'est pas un écart.

### Régressions
- Aucun fichier `src/ui/`, `src/engine/` ou `src/styles/` modifié : plateau et gestes inchangés, captures du tour 1 toujours valables.
- Conventions : commit en anglais sans mention d'IA, auteur noreply, commentaires en anglais.

### Commandes (worktree `v3-meteo-b`)
- `npm test` : 11 fichiers, **411/411** verts (+1 test).
- `npm run typecheck` : OK. `npm run build` : OK.
- `check_unique.py` (solveur de la branche, `PYTHONPATH=../solver/src`) : 13 grilles uniques et déductibles.
- `node scripts/check-ui.mjs` contre `vite preview` (port 4174) : **205/205 OK**.

## Tour 1

**Verdict : À corriger** (un point bloquant, simple : le test B3 casse à la 1re promotion d'une grille avec météo). Le reste est conforme à la règle ; OK à merger après A une fois ce test corrigé.

Périmètre : commit `b28e13a` (`git log v3-meteo-a..v3-meteo-b`), worktree `../spot-elec-v3-meteo-b`, comparé au solveur de `v3-meteo-a` (`0753795`).

## Points

### 1. Bloquant : le test B3 exige qu'aucune grille publiée n'ait de météo
- `web/tests/ui.test.ts` (test de progression B3) parcourt **toutes** les grilles de `grids.json` et attend `weather.R` et `weather.F` à zéro partout.
- La 1re grille météo promue depuis le labo fera échouer `npm test`, donc la CI et le déploiement.
- Contraire à `CLAUDE.md` : « Tests select grids by property […]: a promotion must not break them. »
- Correction attendue : filtrer les grilles sans météo (`grids.filter(...)`), avec un garde-fou `length > 0`. Le test garde son objet : une sauvegarde d'avant se rejoue telle quelle sur une grille sans météo.

### 2. Mineur : validateur TS plus bavard que le Python sur une pièce invalide
- Python (`grid.py`) ne vérifie la météo que dans `check_bar_geometry`, donc seulement si la pièce existe (et, pour un indice `engaged`, si `height` est valide). Exception : les imports, vérifiés à part.
- TS (`model/grid.ts`) appelle `checkWeather` sans condition, pour les indices `engaged` comme pour les placements.
- Effet : une grille déjà invalide (pièce inconnue ou `height` invalide) **et** posée sur la météo reçoit en TS une erreur `covers a weather cell` que le Python n'émet pas. Aucune fixture ne le couvre. Sur les cas valides, le message est identique au caractère près (`'<at>: covers a weather cell at <col>'`, 1re colonne fautive, indices avant placements), et les fixtures partagées passent.
- Correction : appeler `checkWeather` dans les mêmes branches que le Python (via `checkBarGeometry` et dans la branche import).

### 3. Mineur, à trancher par l'humain : « ligne N » compte depuis le bas de la grille, météo comprise
- Message joueur et indice `engaged` : « ligne 3 » pour la 1re ligne libre au-dessus de 2 briques. Sur « Trop de soleil », la 1re case libre de 0h s'appelle « ligne 2 ».
- C'est cohérent avec `row` absolu et c'est signalé dans le rapport de dev. Sans effet sur les 13 grilles publiées. Mais un joueur qui compte les lignes vides lira un autre numéro. À décider avant de publier des grilles météo avec un indice `engaged`.

## Vérifié, conforme

- **Moteur** : `weatherCells` = F + R ; `checkSilhouette` refuse d'abord toute case sous la météo (code `weather`), puis le haut au-delà de `météo + silhouette`. `evaluate` compte les cases manquantes au-dessus de la météo. Les rampes ont une base plate, donc tester la ligne de base suffit.
- **Message joueur** dans `fr.ts` : « La météo occupe déjà cette case à 8h. »
- **Plateau** : `runs()` et le décalage par colonne supprimés. Barre et rampe = une seule forme. La météo reste hachurée, à l'écran comme sur la fiche imprimée. `print.ts` passe par `renderBoard` et n'a pas changé.
- **Gestes** : un glisser en biais (départ et arrivée sur deux lignes) pose une barre droite sur la ligne de départ, jamais pliée (essai 1280 souris, 375 et 320 tactile).
- **Clavier** : `moveCursor` borne la ligne à `floor[col]`. Essai : sur « Trop de soleil », colonne 12h (6 cases météo), 8 × ↓ : le curseur reste sur la 1re case au-dessus de la météo (`review-990-clavier-1280.png`).
- **Progression** : la clé `dispatch:progress:v1` est inchangée. Les sauvegardes des grilles publiées sont rejouées à l'identique et la grille est résolue (test B3, en dehors du point 1).
- **Conventions** : en-têtes en anglais et à jour, aucun texte joueur hors `fr.ts`, commit en anglais sans mention d'IA, auteur noreply. `web/src/lab/` n'est pas touché.

## Commandes (worktree `v3-meteo-b`)

- `npm test` : 11 fichiers, **410/410** verts.
- `npm run typecheck` : OK. `npm run build` : OK.
- `check_unique.py` (solveur de la branche, `PYTHONPATH=../solver/src`, le worktree n'a pas de `.venv`) : 13 grilles uniques et déductibles.
- `node scripts/check-ui.mjs` contre `vite preview` (port 4174) : **205/205 OK**, 13 grilles × 3 largeurs + impression.

## Essai réel

Build d'essai hors repo (`DISPATCH_GRIDS`, `--outDir` dans le scratchpad) : grilles publiées + « Trop de soleil » (`nuit-jouer-a.json` n° 3, id 990) + fixture `valid-bar-above-step` (id 991). Résultat identique à 1280, 375 et 320 px :

| Grille | Geste | Résultat |
|---|---|---|
| 990 | N de 16h à 22h, ligne 3 (marche de météo 2 → 1) | posée, un seul rectangle |
| 990 | N de 6h à 12h, ligne 2 | refusée : « la météo occupe déjà cette case à 8h » |
| 990 | glisser en biais 0h → 6h | barre droite sur la ligne de départ (refusée : hors silhouette) |
| 991 | N de 9h à 24h, ligne 3 (au-dessus des marches R=2 et R=1) | posée, un seul rectangle |
| 991 | N de 3h à 12h, ligne 1 | refusée : « la météo occupe déjà cette case à 6h » |
| 991 | glisser en biais 0h → 6h | barre droite sur la ligne de départ (refusée : météo à 6h) |

- Pas de scroll horizontal de la page à 320 px, aucune erreur JS ni console.
- Fiches imprimées 990 et 991 : météo hachurée en bas, trait épais autour de la demande, une page A4.
- Captures dans `docs/reviews/v3-meteo-b/` : `review-990-{pose,refus}-{1280,375,320}.png`, `review-991-{pose,refus}-{1280,375,320}.png`, `review-990-clavier-1280.png`, `review-990-impression.pdf`, `review-991-impression.pdf`.
