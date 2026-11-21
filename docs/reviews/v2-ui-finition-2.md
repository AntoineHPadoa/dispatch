# Finition tour 2 — S2 + S3 intégrés sur `main` (branche `v2-finition`)

Vérification seule, sans correction, sur `44d1aa0` (`main` : menu bulletin S2 et page de jeu S3 fusionnés). Relu par un agent distinct des auteurs.

## Verdict

- **0 bloquant, 1 à corriger, 2 mineurs.**
- 107 vérifications sur 107 passent : les 7 points de la liste aux 3 largeurs, plus 2 PDF A4.
- La fusion n'a rien cassé dans `game.ts` ni dans `print.ts` : numéro et titre du bulletin sur la page de grille et sur la feuille, STEP ▲/▼, rangée compacte, pied de feuille non coupé.
- Le seul « à corriger » est un reste du défaut S2 n° 1 : le pied de la feuille A4 d'un bulletin porte encore l'id de la grille (« n° 11 ») sous un en-tête « n° 214 ».

## Méthode

- **Build de production** du worktree (`npm run build`, bundle `index-CNGX7S5X.js`), servi par `vite preview` sur `127.0.0.1:4623/dispatch/`.
- **Chrome réel** (Google Chrome stable, headless, piloté par `playwright-core` 1.49.1) ; souris à 1280 px, contexte tactile (`hasTouch`, `isMobile`) à 375 et 320 px ; hauteur 900 px.
- **Contexte neuf** par parcours (localStorage vide). **Date simulée** au 2026-11-21 (n° 214 = grille 11 du jour), et au 2026-11-20 pour `#/imprimer/tout`.
- **Tout est joué** : pas d'injection de progression. Les grilles 11 et 7 sont résolues par de vrais gestes (glisser à la souris, deux touchers au téléphone, pastilles, flèches ▲/▼).
- **Débordement** : `scrollWidth − clientWidth ≤ 0` sur chaque écran visité, 12 écrans à 1280, 13 à 375 et 320.
- **Erreurs** : listener `pageerror` + toute réponse HTTP ≥ 400 hors `favicon.ico` : aucune.
- **Script** : `docs/reviews/v2-ui-finition-2/scripts/run.mjs` (+ `lib.mjs` repris de S3) ; résultats bruts dans `scripts/results.json`.

## Commandes (`web/`)

| Commande | Résultat |
|---|---|
| `npm test` | 6 fichiers, 199 tests verts |
| `npm run typecheck` | OK |
| `npm run build` | OK (97,2 kB JS, 19,6 kB CSS) |
| `../solver/.venv/bin/python scripts/check_unique.py` (venv du checkout principal, lien symbolique) | OK, 11 grilles, 1 composition chacune |

## Résultats

| Interaction | 1280 | 375 | 320 |
|---|---|---|---|
| 1. Accueil à froid (fiche n° 214) → « Prendre le quart » → `#/grille/11`, titre « Plateau d'après-midi », eyebrow « n° 214 · sam. · sans inventaire », onglet « Plateau d'après-midi · Dispatch » → « Accueil » → `#/` | OK | OK | OK |
| 2a. Grille du jour (G11) : pas de STEP au carnet ; poser N, Annuler, gomme, export DE à 9h par la pastille, Annuler l'export | OK | OK | OK |
| 2b. G7 : STEP → 7 ▲ ; ▲ 9h → 4 ▼ ; **Annuler après ▲ seul** (pompage abandonné, barre gardée) ; **gomme après ▲ seul** (flèches cachées, aucun STEP fantôme) ; ▲ 9h ▼ 12h → paire ; pastille export 15h → refus motivé ; import DE 18h posé | OK | OK | OK |
| 2c. Rangée compacte : visible, gomme texte cachée ; choisir N, Import, STEP (puce choisie visible, carnet synchronisé) ; poser N (compteur `1/7`) ; gomme en icône seule active, barre retirée ; défilement 54 px (375) et 109 px (320), fondu aux bords | — (cachée) | OK | OK |
| 3. G11 jouée jusqu'au verdict (2 exports + 9 barres N) → « Programme bouclé », bouton « Accueil » → tampon « Bouclé », 35 cases de silhouette en rose pâle `#f6dbe5`, « Revoir le quart » | OK | OK | OK |
| 4. Carte « Premiers pas » → `#/dossier/premiers-pas` (7 cartes) → tutoriel 7 joué jusqu'au verdict → « Grille suivante » → `#/grille/11`, « n° 214 · sam. » | OK | OK | OK |
| 5a. Aperçus `#/imprimer/11` (« Plateau d'après-midi · n° 214 · sam. · Expert ») et `#/imprimer/7` : 1 feuille chacun ; `#/imprimer/tout` : 11 feuilles au 2026-11-21, 10 au 2026-11-20 (sans le n° 214 à venir) | OK | OK | OK |
| 5b. PDF A4 (média print) : 1 page chacun, feuille rectangulaire (7 lignes pour G7, 7 pour G11 avec exports), en-tête du bulletin, « Dispatch · n° … » sur une ligne et dans le cadre | OK (A4) | | |
| 6. Aucun scroll horizontal : 12 / 13 / 13 écrans, 0 élément hors cadre | OK | OK | OK |
| 7. Commandes | OK | | |

Notes :

- **G11 n'a pas de STEP** (inventaire N seul) : ▲/▼ ne s'y jouent pas ; le point 2 y couvre Annuler, la gomme et l'export. L'import y reste proposé (sans quota publié, l'indice dit « aucun bloc importé ») : conforme aux règles, ce n'est pas un défaut d'interface.
- **G7** : les deux exports sont publiés, d'où le refus motivé à 15h (« Plus d'export vers l'Allemagne dans l'inventaire (2 au total). »). L'export libre est joué sur G11.

## Défauts

### Bloquant

Aucun.

### À corriger

1. **Le pied de la feuille A4 d'un bulletin porte l'id de grille, pas le numéro du bulletin.**
   - Feuille 11 : en-tête « Plateau d'après-midi · n° 214 · sam. · Expert », pied « Dispatch · n° 11 ». Deux numéros pour la même grille sur la même feuille, ce que la correction S2 n° 1 voulait supprimer. Même chose pour les feuilles 8 à 10 dans `#/imprimer/tout`.
   - Où : `web/src/ui/print.ts:47` (`UI.printId(grid.id)`), texte `web/src/i18n/fr.ts:442`.
   - Piste : pour une grille avec `bulletin`, pied « Dispatch · n° 214 » (`grid.bulletin.number`) ; garder l'id pour les tutoriels (« Dispatch · n° 7 » ou « Tutoriel 7 »).
   - Capture : `5-print-11.pdf` (bas de page), `5-print-11-media-print.png`.

### Mineurs

- **m1. Pied de la feuille G7 sur deux lignes, coupé à « descends-/le ».** Le n° reste sur une ligne (correction C3 tenue), mais le texte `printFootBoth` (`web/src/i18n/fr.ts:440`) passe à la ligne au trait d'union de « descends-le ». Lisible, peu soigné. Piste : texte plus court, par exemple « Note exports, imports, ▲ et ▼ sous la grille : le trait monte d'une case par export ou pompage, descend par turbinage. », ou `hyphens: manual` sur `.a4 .foot`. Capture : `5-print-7.pdf`.
- **m2. Bande vide au-dessus de la grille à 320 et 375 px.** Environ 60 px CSS entre la consigne et la première ligne de cases sur G11 (`1-grid-320.png`), réservés aux étiquettes d'indice et à la hauteur d'export. Le défilement est plus long au téléphone sans gain visible quand la colonne n'a pas d'étiquette. À trancher : réserve voulue (stabilité quand un export monte le trait) ou à resserrer. Captures : `1-grid-320.png`, `2-g11-export-320.png`.

## Captures (`docs/reviews/v2-ui-finition-2/`)

Chaque nom se termine par la largeur (`-1280`, `-375`, `-320`), pleine page.

- **1** : `1-home-cold-*`, `1-grid-*` (page de la grille du jour), `1-home-back-*`.
- **2** : `2-g11-export-*` ; `2-g7-pump-*` (▲ choisie, 4 ▼), `2-g7-pair-*`, `2-g7-import-*` ; `2-row-erase-*` et `2-row-scrolled-*` (375, 320).
- **3** : `3-g11-solved-*` (bandeau « Programme bouclé »), `3-home-stamp-*` (tampon, silhouette rose pâle).
- **4** : `4-dossier-*`, `4-tuto7-solved-*`, `4-after-tuto7-*` (fiche du jour).
- **5** : `5-print-11-*`, `5-print-7-*` (aperçus) ; `5-print-11.pdf`, `5-print-7.pdf` (A4) ; `5-print-*-media-print.png` (rendu média print).
