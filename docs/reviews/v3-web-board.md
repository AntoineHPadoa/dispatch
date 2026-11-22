# Relecture — v3-web-board (S6.3 : R17-R21)

- Branche `v3-web-board`, commits `93ba96f` (R17-R21) et `cf1ebff` (R22, relu en complément : voir la section R22), auteur s7. Relecteur : s8.
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

## R22 : relevés en O-E sur ordinateur (complément, `cf1ebff`)

**OK, sans écart.** Référence : le choix de l'humain (O-E sur ordinateur, rendu actuel gardé sous 861 px) et le prototype de s4 (`v3-pills-proto` `d5e44f3`, `?pills=e`).

- **Rendu** : à partir de 861 px, un relevé est un groupe de pastilles de couleur nues, une par centrale, qui portent leur chiffre, sans contour ni fond. Le groupe est centré sur sa colonne (`recordLayout`, `board.ts`).
- **Retour à la ligne** : même règle que le prototype, qui part de la place disponible (`room = cell - 10`) : 3 pastilles par ligne à partir de cellules de 53 px, 2 en dessous. La note de l'orchestrateur à s7 disait « au-delà de trois centrales » ; le code suit le prototype validé, ce qui revient au même aux tailles usuelles. W-29 (grille 906) : 5 centrales réparties 3 + 2.
- **Marque R21** : au coin haut droit du groupe, par `clueMark`. Sur W-23, le relevé « 0 » contredit à 15h porte le « ! » rouge.
- **Rangées de la bande** : elles s'adaptent à la hauteur d'un relevé replié.
- **Sous 861 px et papier** : la pastille de relevé est inchangée.

| Contrôle | Résultat |
|---|---|
| `npm test` | 418 tests verts |
| typecheck, build | OK |
| `check-ui.mjs` | 205/205 OK |
| Slider, 861 à 1441 px, 13 grilles plus 902 et 906 | 465 mesures, 0 slider, 0 `.stacked` |
| Sous 861 px (375, 500, 700, 860 px), comparé à `93ba96f` | identique |
| Passage de la frontière de 861 px dans les deux sens (grilles 7, 902, 906) | pastilles nues à 861 px et plus, pastille de relevé à 860 px et moins ; la bascule se fait au redimensionnement, sans recharger |

## Fusion avec v3-web-home et v3-web-panel

Essai sur `main` (à jour, `v3-meteo-c` compris), dans l'ordre `v3-web-home`, `v3-web-panel`, `v3-web-board` :
- **`v3-web-home` puis `v3-web-panel`** : un seul conflit, `web/tests/ramp.test.ts`, déjà signalé dans `v3-web-home.md`. Résolution : garder le bloc de `v3-web-panel` (pas d'indication à l'écran, un picto par largeur) et remplacer l'attendu papier `'rampe de 3 à 5 créneaux'` par `'à paliers, 3 à 5 créneaux'`. Ne pas prendre le fichier entier d'un seul côté : `--theirs` fait échouer 4 tests qui portent sur les textes de `v3-web-home`.
- **`v3-web-board`** : aucun conflit. Fusion automatique de `app.css`, `board.ts`, `game.ts` et `ui.test.ts`.
- **Arbre fusionné** : 418 tests verts, typecheck OK, build OK, `check-ui.mjs` 205/205.
- **Refait avec R22 (`cf1ebff`)** : toujours aucun conflit pour `v3-web-board` ; 419 tests verts, typecheck OK.

## Fusion finale (home `def3ced`, panel `9a0f7dd`, board `cf1ebff`)

Fusion sur `main` (`7ecbace`) dans l'ordre home, panel, board.
- **Conflit** : toujours un seul, `web/tests/ramp.test.ts` (home × panel), résolu comme décrit plus haut. `v3-web-board` passe sans conflit, y compris dans `game.ts`, que les corrections de home touchent aussi.
- **Résultats sur l'arbre fusionné** :
  - Vitest : 421 tests verts ;
  - typecheck et build OK ;
  - `check_unique.py` OK ;
  - tests du labo (`pytest lab/tests`) : 178 verts ;
  - `check-ui.mjs` : 205/205.
- **Contrôle visuel à 1280 px** : grille 7 (compteur à côté des pictos, aucun bouton Imprimer) et dossier « Premiers pas » (deux-points insécables, boutons à contour).
