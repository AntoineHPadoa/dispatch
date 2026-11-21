# Vérification S7 — finition (branche `v2-polish`, après S7.7)

Vérification seule, sans correction. Build de la branche servi par `vite preview` (port 4630), Chrome piloté par Playwright, date figée au 2026-11-21, à 1280, 375 et 320 px (tactile sous 860 px).

- Script : `docs/reviews/S7-finition/scripts/verify.mjs` (résultats bruts : `scripts/results.json`).
- Rendu 2 paires STEP : `scripts/two-pairs.ts` (G7 avec `inventory.step = 2`, rendu par `renderBoard`), puis capture par `verify.mjs`.
- Captures : `docs/reviews/S7-finition/`. Le préfixe donne le numéro du parcours, le suffixe la largeur.

## Verdict

**Mergeable** : 0 bloquant, 0 à corriger, 2 mineurs, qui existaient déjà sur `main`. Les 6 décisions de l'humain sont respectées aux 3 largeurs.

## Vérifications automatiques

| Commande | Résultat |
|---|---|
| `npm test` | 203 tests verts (6 fichiers) |
| `npm run typecheck` | OK |
| `npm run build` | OK (JS 98,8 kB, CSS 21,2 kB) |
| `check_unique.py` (venv `spot-elec/solver`, sur `grids.json` de la branche) | OK : 11 grilles, 1 composition chacune |

## Interactions × largeur

| # | Parcours | 1280 | 375 | 320 |
|---|---|---|---|---|
| 1 | accueil → grille du jour → logo → accueil (+ dossier) : logo immobile | OK : (66,0 ; 26,0) sur les 4 écrans | OK : (16,0 ; 18,0) | OK : (16,0 ; 18,0) |
| 1 | 1280 resserrée : case la plus haute alignée sur l'eyebrow « N° 214 » | OK : case y = 88,0, eyebrow y = 86,0 (`1-game11-eyebrow-line-1280.png`) | — | — |
| 1 | 1280 resserrée : colonne de droite collée au plateau, marge à droite | OK : plateau 66–550, colonne 580–1100 (520 px), écart 30 px, marge droite 180 px | — | — |
| 1 | « Prendre le quart » reste le bouton principal | OK (fond encre) | OK | OK |
| 2 | dossier « Premiers pas » → tutoriel 1 → retour navigateur | OK | OK | OK |
| 3 | G7 : ▲ puis ▼, paire posée, ▲ ▼ bleu clair `#e3eefa`, sans numéro (1 paire) | OK (« ▲ pompe » / « ▼ turbine ») | OK (▲ / ▼) | OK (▲ / ▼) |
| 3 | G7 : aucun trait entre ▲ et ▼ | OK | OK | OK |
| 3 | G7 : Annuler retire la paire | OK | OK | OK |
| 3 | G7 : gomme sur une barre | OK | OK | OK |
| 3 bis | grille de test à 2 paires : numéro par paire, pastilles assez larges | OK (rendu hors navigateur réel, voir plus bas) | — | — |
| 4 | grille du jour bouclée → accueil : solution en couleurs (9 pièces nucléaire) | OK | OK | OK |
| 4 | « Revoir le quart » en bouton secondaire discret | OK : fond transparent, contour encre 1 px, 38 px, à droite | OK | OK |
| 5 | PDF A4 G7, G10, grille du jour (G11) : 1 page chacun | OK | — | — |
| 5 | Feuille : au moins une ligne blanche au-dessus du point le plus haut atteignable | OK (G7 : 8 lignes pour 7 ; G11 : 8 pour 7) | — | — |
| 6 | Icône d'onglet | OK : `<link rel="icon" href="icon.svg">` statique, HTTP 200 `image/svg+xml`, lisible en 16 px sur onglet clair et sombre (`6-favicon.png`) | — | — |
| 7 | Aucun scroll horizontal (7 écrans par largeur) | OK | OK | OK |
| — | Aucune erreur JS | OK | OK | OK |

Notes :

- **Traits STEP.** Un premier contrôle a compté des rectangles pointillés : 2 cases d'indice violettes (présentes avant la STEP), la case à couvrir au pompage (bleue) et la case retirée au turbinage (grise, barrée). C'est le marquage attendu des cases, pas un trait entre ▲ et ▼. Le contrôle final ne compte que les lignes et les chemins : 0 avant, 0 après (`3-step-pair-*.png`).
- **2 paires.** Aucune grille de `grids.json` n'a 2 paires. Rendu de G7 avec `inventory.step = 2` (`3-two-pairs.png`) :
  - paires distinctes : « ▲1 pompe » / « ▲2▼1 » / « ▼2 turbine » ;
  - même créneau de pompage : « ▲1▲2 » ;
  - en compact (cell 34) : mêmes libellés, aucun texte ne déborde de sa pastille ;
  - en mode STEP avec 1 paire posée : les flèches portent « ▲2 ».
  - Les tests unitaires couvrent les mêmes cas (`tests/ui.test.ts:442-466`).
- **Feuille imprimée.** Hauteur = max atteignable (demande + exports + paires STEP) + 1 ligne (`board.ts:134-136`). G10 vérifié par la même règle (`5-print-10.png`).

## Défauts

Aucun **bloquant**, aucun **à corriger**.

### Mineurs

**m1 — Les puces de centrales de la fiche d'accueil restent grises sous la solution en couleurs (téléphone), et disparaissent sur ordinateur.** `web/src/styles/app.css:245` et `:260`, `web/src/ui/home.ts:46`.
- La classe `.chips` sert à la fois à la rangée de puces de la page de grille et à la liste de la fiche d'accueil. `.chips { display: none }` (l. 245) la masque donc partout sur ordinateur, et la règle téléphone (l. 260, `width: 0; min-width: 100%`) la réaffiche sous 860 px.
- Effet : à 375 et 320 px, la fiche bouclée montre la solution en jaune nucléaire au-dessus de puces « Nucléaire » et « Allemagne » grises (`4-home-done-320.png`, `4-sheet-done-375.png`). À 1280 px, la fiche n'a aucune puce (`4-home-done-1280.png`).
- Le défaut existait déjà sur `main` (mêmes règles) ; la solution en couleurs le rend plus visible.
- Piste : renommer la liste de l'accueil (par exemple `.plant-chips`) et décider si ses puces prennent la couleur de la centrale une fois la fiche bouclée.

**m2 — Sur téléphone, une bande vide d'environ 60 px sépare la consigne du plateau.** `web/src/ui/game.ts:252`, `web/src/styles/app.css:53` et `:257`.
- Le plateau garde la place des exports et des paires STEP possibles au-dessus de la demande, pour ne pas bouger quand on exporte. Sur ordinateur, `--lift` remonte le plateau ; sous 860 px, rien ne compense.
- Visible sur G11 et G7 à 375 et 320 px (`1-game11-320.png`, `3-step-pair-320.png`). C'est un choix assumé qui existait déjà avant S7, et hors des 6 décisions. Signalé pour un prochain passage.

## Bilan

- Bloquant : 0.
- À corriger : 0.
- Mineur : 2 (m1 puces de la fiche d'accueil, m2 bande vide au-dessus du plateau sur téléphone), tous deux déjà présents sur `main`.
