# S7.14 — passation (demande de l'humain : confier la suite à un agent opus)

Branche `v2-board-tags` (worktree `/Users/padoa/Programs/spot-elec-wt/v2-board-tags`), depuis `main` 1f94578. Maquette publiée : https://claude.ai/artifact/6p2Pmf6QRgn5JNJfLgdQ1H (fichier `docs/reviews/S7.14/maquettes.html`, captures dans `docs/reviews/S7.14/mock/`, script `scripts/mock.mjs`).

## Décision de l'humain (q664)

- Placement **b : bande commune + ligne fine** (prix, relevés et noms de programme dans une seule bande sous les heures ; le programme est une barre fine collée sous la grille).
- Retours sur la maquette, à corriger dans le code :
  1. **Tutoriel 6** : les deux étiquettes de prix (4h et 8h) sont sur 2 lignes dans la variante b ; il les veut **sur la même ligne**. Cause : `bandPlan` (`web/src/ui/board.ts`) réserve +10 px de coche « vérifié » dans l'étendue de chaque pastille ; sur une cellule de 50 px, deux pastilles de prix voisines (largeur cell − 4) se chevauchent alors et partent sur 2 lignes. Or `pill()` ne grandit pas une pastille quand `w + 10 > cell − 2` (la coche passe en coin) : l'étendue réservée doit suivre la même règle. Même défaut sur la grille du jour (relevés).
  2. **STEP** : les flèches ▲ ▼ (et étiquettes de pair) sont « sur le haut » de la carte ; il les veut **accrochées en haut de leur colonne**. Dans le code actuel `tagY` ancre sur `geo.reach` (hauteur maximale atteignable) ; il faut revenir à la hauteur courante de la colonne (météo + silhouette + turbinages, plus 1 si le pompage est en attente), sans que `topPad` change (la hauteur courante ≤ la portée, donc la marge fixe suffit).
  3. Il veut la même ligne pour « réserve invisible et case violette » : même cause que 1.

## Fait (non commité avant cette passation, commité avec elle)

- Point 1 de la consigne #639 : plus de cases de réserve dessinées ; case export en pointillé violet blanc ; case de pompage en attente en pointillé bleu (`input.stepPending`) ; la carte garde sa hauteur (lignes = portée max).
- `bandPlan()` / `BandLayout ('rows' | 'shared')` : plan des indices de créneau sous les heures, rangement en lignes sans chevauchement (`BandItem.lane`), `geo.bandHeight`, décalage `plan.offset` des heures pour la barre fine.
- Tests UI mis à jour (219 verts) ; `npm run typecheck` et `npm run build` verts.
- **Code temporaire à retirer** : `window.__bands` dans `web/src/ui/game.ts` (interrupteur des maquettes) ; le défaut de `bands` doit devenir `'shared'` (variante retenue), et la variante `'rows'` peut être supprimée avec son code (`BAR_PITCH`, accolade dans le rendu).

## Reste à faire

1. Corrections 1 et 2 ci-dessus ; test de placement : deux prix voisins sur la même ligne à cellule de 30 à 60 px, aucun chevauchement entre indices (G7, G10, tutoriel 6, grille du jour, tutoriels 1 à 7), flèches STEP à la hauteur de leur colonne et grille/carte/logo immobiles avant/après export et pompage.
2. Feuille imprimée (style B) cohérente avec le choix b (mêmes bandes sous le rectangle ; les relevés quittent le dessus du rectangle) : PDF G7, G10, tutoriel 6, grille du jour.
3. Vérification Playwright à 1280 / 375 / 320 px (modèle : `docs/reviews/S7.11-review/after/scripts/check.mjs`), captures dans `docs/reviews/S7.14/`.
4. `npm test`, `npm run typecheck`, `npm run build`, `check_unique.py` (grilles inchangées ; venv du dépôt principal : `solver/.venv/bin/python scripts/check_unique.py` depuis `/Users/padoa/Programs/spot-elec/web`).
5. Ne pas fusionner ni pousser ; statut S7.14 puis `agentdeck ctl produce` des livrables.

## Suite (fx9) : fait

- **Maquette régénérée** depuis le vrai code (variante b seule), même URL ; **validée par l'humain (q685)**. Captures `mock/`, script `scripts/mock.mjs`, déplacements mesurés `mock/moves.json`.
- **Variante b seule** : `BandLayout`, `'rows'`, `BAR_PITCH` et l'accolade retirés ; `bandPlan(grid, cell)` n'a qu'une bande ; `window.__bands` retiré de `game.ts`.
- **Prix voisins sur une même ligne** : l'étendue réservée suit `pill()` (`tickedWidth` : +10 seulement si la coche tient dans le créneau, sinon coche en coin). Tutoriel 6 : une ligne de 30 à 60 px ; G7 : relevé 9h et prix 12h sur la même ligne.
- **Flèches STEP** : `tagY` ancre sur la hauteur courante (météo + silhouette + turbinages + 1 si pompage en attente) ; `topPad` inchangé (portée max).
- **Feuille imprimée** : même bande sous le rectangle, barre fine du programme ; en-tête de `print.ts` à jour ; `printCell` estime la bande avec `bandPlan`. PDF `print/sheet-g{6,7,10,11}.pdf`, captures `check/sheet-g*.png`.
- **Tests** : 3 tests de placement ajoutés (prix voisins 30-60 px, aucun chevauchement sur les 11 grilles à 5 tailles de case vérifiées ou non, flèches STEP au haut de colonne) ; 222 verts ; typecheck, build, `check_unique.py` verts (grilles inchangées).
- **Chrome** (`scripts/check.mjs`, 204/204 OK, `check/results.json`) : 11 grilles × 1280/375/320 sans scroll horizontal, plateau dans la carte, aucun chevauchement ; export (tutoriel 6, G10, grille du jour) et pompage/turbinage G7 : carte, grille et logo immobiles ; ▲ ▼ à 0–12 unités du haut de leur colonne ; feuilles G6/G7/G10/G11 sans indice au-dessus du rectangle.
- **Limite** : à 320 px sur G7, le nom du programme est large ; le prix de 12h passe sur une 2e ligne (sans chevauchement).
