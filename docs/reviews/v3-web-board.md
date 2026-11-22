# Relecture — v3-web-board (S6.3 : R17-R21)

- Branche `v3-web-board`, commit `93ba96f`, auteur s7. Relecteur : s8. R22 hors périmètre : il attend le choix de l'artifact Pastilles.
- Référence : retours R17-R21 (`plan/rev-6.md` § S4). Pas de texte joueur nouveau : `fr.ts` et `grids.json` sont inchangés.
- Fichiers locaux dans `docs/reviews/v3-web-board/` du worktree `spot-elec-v3-reviews` : captures 1280 px (`W-*-apres.png`), relevé du slider (`survey-board.txt`), comparaison sous 861 px (`narrow-main.txt`, `narrow-board.txt`) et script de relevé (`survey.mjs`). Ils ne sont pas versionnés.

## Verdict

**OK, sans écart bloquant ni mineur.** 2 remarques sans effet pour le joueur. La fusion avec les deux autres branches est propre.

## Vérifications

| Contrôle | Résultat |
|---|---|
| `npm test` | 417 tests verts (3 nouveaux) |
| `npm run typecheck` | OK |
| `npm run build` | OK |
| `check_unique.py` | sans objet : `grids.json` inchangé |
| `check-ui.mjs` contre `vite preview` | 205/205 OK. Un premier passage a donné 9 KO `ERR_INTERNET_DISCONNECTED` (ressource externe, réseau coupé), absents au second passage. |
| Conventions | code en anglais, aucun texte joueur ajouté, aucune mention d'IA |

## R17 : plus de slider sur ordinateur

**Relevé refait par moi, 0 slider.** Script `survey.mjs` (playwright-core et Chrome), sur le build de la branche avec les grilles de galerie :
- largeurs de 861 à 1441 px par pas de 20, soit 31 largeurs ;
- les 13 grilles publiées plus la 906 ;
- relevé par grille et par largeur : slider affiché, débordement de `.board-scroll`, défilement horizontal de la page, classe `.stacked`.

| Passage | Mesures | Slider ou débordement | `.stacked` |
|---|---|---|---|
| largeur croissante, 14 grilles | 434 | 0 | 0 |
| largeur décroissante, grilles 1, 7, 10-13 et 906 | 217 | 0 | 0 |

- La correction tient : la colonne de la grille reçoit sa largeur exacte (`--board-col`, `game.ts`, fonction `fit`), et le panneau ne reprend plus la place prévue pour la grille.
- Le repli `.game.stacked` (une colonne quand des cases de 30 px ne tiennent pas à côté) ne se déclenche pour aucune grille actuelle entre 861 et 1441 px. Ce chemin n'est donc vérifié par aucun navigateur, seulement par lecture du code. Le seuil dépend bien du nombre de créneaux (`beside / n < MIN_CELL`), comme R17 le demande.

**Sous 861 px, rien ne change.** `.stacked` n'est jamais posé quand `max-width: 860px` est vrai, et `--board-col` est alors retiré. J'ai comparé `main` et la branche sur les 14 grilles à 375, 500, 700 et 860 px, à partir de la position et de la taille de `.play`, `.side` et du SVG :
- positions et largeurs identiques partout ;
- seules les hauteurs baissent sur les grilles à programme (7 et 906, de 26 à 45 px), parce que R18 retire la bande de pastilles de programme ;
- la grille 906 a le même slider à 375 px sur `main` et sur la branche : c'est l'existant téléphone, hors périmètre.

## R18 : lignes de programme

**Fait, sur le minimum de rangées.**
- `bandPlan` (`board.ts`) range les lignes par début croissant, chacune sur la première rangée libre. Sur des intervalles, ce glouton est optimal.
- W-11 (grille 901, trois programmes) : nucléaire 0h-18h et gaz 18h-24h partagent la rangée 0, charbon 12h-21h passe en rangée 1. Il faut 2 rangées, puisque le nucléaire et le charbon se chevauchent ; avant, les trois lignes se superposaient.
- Plus de pastille « Réacteur 4h → 20h » à l'écran ; le papier garde le nom dans la bande.

## R19 : export sous une centrale

**Fait.** Une case exportée ou pompée garde son contour pointillé par-dessus la pièce posée : violet pour l'export, bleu pour le pompage (W-26, grille 7 bouclée : exports à 0h et 6h, pompage à 9h). Le rendu correspond à la carte « Bouclé » de l'accueil.

## R20 et R21 : une seule marque, en haut à droite

**Fait.**
- Une seule fonction, `clueMark` (`board.ts`), dessine la coche verte ou le « ! » rouge sur le coin haut droit, avec un anneau blanc.
- Elle sert pour les pastilles de prix, les pastilles de relevé et les cases de flux, et au bout droit des lignes de programme, qui n'ont plus de pastille.
- Plus aucune bordure rouge.
- Vu sur W-23 (prix et relevé contredits à 15h : « ! » rouge ; prix vérifiés : coche) et sur W-26 (prix, relevé et flux vérifiés).
- La liste « Publications du marché » ne change pas.

## Remarques (sans écart)

- Les pastilles ne s'élargissent plus de 10 px pour la coche, qui va toujours au coin. Signalé par l'auteur ; c'est l'effet attendu de R21.
- Le chemin `.stacked` n'est vérifié que par lecture du code (voir R17). Une grille de 14 créneaux ou plus, ou de très grands créneaux, l'exercerait.

## Fusion avec v3-web-home et v3-web-panel

Essai sur `main` (à jour, `v3-meteo-c` compris), dans l'ordre `v3-web-home`, `v3-web-panel`, `v3-web-board` :
- **`v3-web-home` puis `v3-web-panel`** : un seul conflit, `web/tests/ramp.test.ts`, déjà signalé dans `v3-web-home.md`. Résolution : garder le bloc de `v3-web-panel` (pas d'indication à l'écran, un picto par largeur) et remplacer l'attendu papier `'rampe de 3 à 5 créneaux'` par `'à paliers, 3 à 5 créneaux'`. Ne pas prendre le fichier entier d'un seul côté : `--theirs` fait échouer 4 tests qui portent sur les textes de `v3-web-home`.
- **`v3-web-board`** : aucun conflit. Fusion automatique de `app.css`, `board.ts`, `game.ts` et `ui.test.ts`.
- **Arbre fusionné** : 418 tests verts, typecheck OK, build OK, `check-ui.mjs` 205/205.
