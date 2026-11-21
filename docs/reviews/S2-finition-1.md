# Finition S2, tour 1 — vérification (branche `v2-menu`)

Vérification seule, sans correction, sur `173b1fe` (corrections S2.5 incluses). Relu par un agent distinct de l'auteur.

## Verdict

- **0 bloquant, 2 à corriger, 3 mineurs.**
- Les 7 interactions de la liste passent aux 3 largeurs (21 cases interaction × largeur OK sur 21).
- Les 2 « à corriger » portent sur la cohérence entre l'accueil bulletin et la page de grille (numéro, libellés hérités de l'ancien accueil), hors des parcours testés.

## Méthode

- **Build de production** du worktree (`npm run build`), servi par `vite preview` sur `127.0.0.1:4517/dispatch/`.
- **Chrome réel** (Chrome stable, headless, piloté par CDP via `puppeteer-core` 23.11.1), viewport émulé à 1280, 375 et 320 px (pas d'iframe : la largeur est la vraie largeur de mise en page).
- **Contexte neuf** par largeur (localStorage vide) ; la progression est injectée sous `dispatch:progress:v1` puis la page est rechargée.
- **Pose de la solution** : `solutionState()` du moteur appliqué à `grids.json` ; pour la grille notée, toute la solution sauf le dernier export, puis un vrai clic sur la pastille d'export (DE, 21h).
- **Date simulée** : `Date` et `Date.now()` décalés avant le chargement (`evaluateOnNewDocument`), au 2026-11-17 (avant le 1er bulletin) et au 2026-11-20 (n° 214 publié le lendemain).
- **Débordement** : `document.documentElement.scrollWidth ≤ clientWidth` et liste des éléments dont le bord droit dépasse, sur chaque écran visité.
- **Palette** : couleurs calculées (`color`, `background-color`, `border-color`, `fill`, `stroke`) de tous les éléments de `.home`, plus `background-image` et dégradés SVG.
- **Erreurs** : aucune erreur JS ni console sur l'ensemble des parcours (seul `favicon.ico` répond 404, ignoré).
- **Commandes** (`web/`) : `npm test` 188 tests verts ; `npm run typecheck` OK.

## Résultats

| Interaction | 1280 | 375 | 320 |
|---|---|---|---|
| 1. Accueil à froid : fiche n° 214, 3 quarts précédents, dossier « Premiers pas » 0 / 7, logo, « Comment jouer » ouvert puis refermé (`hidden`, `aria-expanded`) | OK | OK | OK |
| 2. « Prendre le quart » → `#/grille/11` → retour `#/` | OK | OK | OK |
| 3. Grille notée n° 11 finie (dernier export cliqué) → bandeau « Programme bouclé », statut `done` stocké, tampon « Bouclé » et « Revoir le quart » sur l'accueil | OK | OK | OK |
| 4. Carte dossier → `#/dossier/premiers-pas` (7 cartes) → tutoriel 1 → « Grille suivante » × 7 → tutoriels 2 à 7 puis `#/grille/8` ; page dossier 7 « Terminée », carte 7 / 7 | OK | OK | OK |
| 5a. Date 2026-11-17 : « Premier bulletin le 18 novembre 2026 », ni fiche ni quarts précédents ; tutoriel 7 fini → « Retour aux grilles » (`#/`) ; `#/imprimer/tout` = 7 feuilles (tutoriels seuls) | OK | OK | OK |
| 5b. Date 2026-11-20 : fiche n° 213, quarts 212 et 211, « 214 » absent de la page ; grille 10 finie → `#/` (pas de suivante) ; `#/imprimer/tout` = 10 feuilles (sans la grille 11) ; PDF : 10 pages A4 | OK | OK | OK |
| 6. Aucun scroll horizontal : 12 écrans par largeur (accueil froid, règles ouvertes, bouclé, 2 dates ; grille, grille bouclée, tutoriels 1 et 7 bouclés ; dossier ; 2 aperçus d'impression), 0 élément hors cadre | OK | OK | OK |
| 7. Conformité maquette Tour 5 (palette V1, accent rose unique, pastilles neutres, pas de dégradé) | OK | OK | OK |

Détail de l'interaction 7 :

- **Accent unique** `#c45c7c` (eyebrow, tampons, progression, compte du dossier) ; teintes `#f8e8ef` (bande), `#f6dbe5` (silhouettes bouclées), `#fbf1f5` (fond des cartes dossier) : les 4 valeurs V1 de la maquette.
- **Neutres** : encre `#3b3340`, gris chauds `#5d5463`, `#8f8593`, `#9a929c`, `#cfc6cc`, bordures `#ece6ea` / `#efe5eb`.
- **Pastilles** neutres (carrés `#cfc6cc`, fond blanc), comme la maquette.
- **Logo** L1a en couleurs d'origine (`#f7e2a0`, `#f8c8a9`, `#f4b5c4`), seule exception colorée, conforme au choix Tour 5 ; aucune autre couleur de centrale sur l'accueil.
- **Pas de dégradé** : aucun `linearGradient` / `radialGradient` SVG, aucun `background-image` dans `.home` ; seul le fond de page à points (`radial-gradient` 1 px), repris tel quel de la maquette.
- Écarts déjà acceptés en S2, non relevés : pas d'« Archives », pas de case rose quand la grille n'a pas d'indice de prix (n° 214), page dossier.

## Défauts

### Bloquant

Aucun.

### À corriger

1. **La page de grille ne porte pas le numéro du bulletin.**
   - L'accueil présente « n° 214 · sam. — Plateau d'après-midi » ; « Prendre le quart » ouvre une page titrée « Grille n° 11 », eyebrow « Grille du jour · sans inventaire », sans le numéro 214 ni le titre du bulletin. Même chose pour les quarts précédents (n° 213 → « Grille n° 10 ») et pour la feuille imprimée (« Grille n° 8 » … « Grille n° 11 »).
   - Le brief (§ concept) pose que chaque grille est un bulletin qui porte un numéro et un titre ; le joueur voit deux numérotations pour la même grille.
   - Où : `web/src/ui/game.ts:74-77` (`displayTitle` → `UI.gridNumber(grid.id)` pour une grille notée), repris par `print.ts:41` et le titre de l'onglet (`app.ts`).
   - Piste : pour une grille qui a un `bulletin`, titre = titre du bulletin, eyebrow = `UI.bulletin.sheetTag(numéro, jour)` (+ « sans inventaire ») ; idem sur la feuille A4.
   - Captures : `2-grid-1280.png`, `3-grid-solved-375.png`, `5-print-veille.pdf`.

2. **Libellés hérités de l'ancien accueil « liste de grilles ».**
   - Le lien retour de la page de grille et de la page dossier s'appelle « Toutes les grilles » (`UI.back`, `web/src/i18n/fr.ts:330`) et le bouton de fin de la dernière grille « Retour aux grilles » (`UI.home`, `fr.ts:419`) ; tous deux mènent à l'accueil bulletin, qui ne liste plus les grilles.
   - Sur la page dossier, « Toutes les grilles » ramène à l'accueil et non à une liste.
   - Piste : « Accueil » ou « Retour au bulletin » ; vérifier les autres usages de `UI.back` (aperçu d'impression).
   - Captures : `4-dossier-done-320.png`, `2-grid-1280.png`, `3-grid-solved-1280.png`.

### Mineurs

- **m1. Après le dernier tutoriel, « Grille suivante » ouvre le plus ancien bulletin** (`#/grille/8`, n° 211), pas la fiche du jour : `playOrder` trie les notées par id (`web/src/ui/progress.ts:123-126`). Défendable (ordre de difficulté), mais l'accueil met en avant le n° 214. Piste : après le dossier, renvoyer vers la fiche du jour ou vers l'accueil. Capture `4-tuto7-solved-375.png`.
- **m2. Une grille non publiée reste ouverte par URL directe** : au 2026-11-20, `#/grille/11` affiche la grille de demain (eyebrow « Grille notée ») et `#/imprimer/11` l'imprime (`web/src/ui/app.ts:34-36` et `:45`, aucun filtre de date). Il faut deviner l'URL, et `grids.json` est de toute façon dans le bundle ; la page n'est liée nulle part. Piste : retomber sur l'accueil si `bulletin.published > today`. Capture `5-direct-url-grid11-veille-1280.png`.
- **m3. Fiche bouclée sans trace dans la silhouette** : une fois le n° 214 bouclé, seul le tampon change ; la silhouette de la fiche reste en cases blanches, alors que les quarts précédents et les dossiers passent leurs mini-silhouettes en rose pâle quand ils sont finis. Cohérence visuelle à décider (la maquette ne montre pas de fiche du jour bouclée). Capture `3-home-stamp-375.png`.

## Captures (`docs/reviews/S2-finition-1/`)

Chaque nom se termine par la largeur (`-1280`, `-375`, `-320`), pleine page.

- **1** : `1-home-cold-*` (accueil à froid, 2026-11-21), `1-home-rules-open-*` (« Comment jouer » ouvert).
- **2** : `2-grid-*` (page de la grille du jour), `2-home-back-*` (retour accueil).
- **3** : `3-grid-solved-*` (bandeau « Programme bouclé »), `3-home-stamp-*` (tampon « Bouclé »).
- **4** : `4-dossier-*`, `4-tuto1-solved-*`, `4-tuto7-solved-*`, `4-dossier-done-*` (7 « Terminée »), `4-home-dossier-done-*` (7 / 7).
- **5** : `5-home-avant-*` / `5-print-avant-*` (2026-11-17), `5-home-veille-*` / `5-grid10-solved-veille-*` / `5-print-veille-*` (2026-11-20), PDF `5-print-avant.pdf` (7 pages) et `5-print-veille.pdf` (10 pages), `5-direct-url-grid11-veille-1280.png` (m2).
- **7** : `7-home-progress-1280.png` (n° 213 et 2 tutoriels bouclés), `7-maquette-tour5-L1a.png` (maquette Tour 5, accueil V1 avec L1a, pour comparaison).

## Corrections

Branche `v2-menu`, tour 1 de corrections.

- **À corriger 1** : une grille avec `bulletin` porte son titre et son numéro partout (`displayTitle`, `bulletinTag` dans `web/src/ui/game.ts`).
  - Page de grille : titre = titre du bulletin, eyebrow « n° 214 · sam. · sans inventaire ».
  - Feuille imprimée : « n° 214 · sam. · Expert » ; titre d'onglet = titre du bulletin.
  - Tutoriels inchangés ; `UI.daily` supprimé (plus utilisé).
- **À corriger 2** : `UI.back` et `UI.home` valent « Accueil ». Usages vérifiés : page de grille, page dossier, barre d'aperçu d'impression (`#/imprimer/tout`), fin de la dernière grille.
- **m1** : `nextGrid(grids, id, today, isDone)` : après le dernier tutoriel, la suite est la fiche du jour, ou l'accueil si elle est bouclée.
- **m2** : `isPublished()` (`model/bulletin.ts`) ; `#/grille/<id>` et `#/imprimer/<id>` d'une grille non publiée affichent l'accueil (le hash reste dans l'URL).
- **m3** : la silhouette de la fiche du jour bouclée passe en rose pâle (`.sil-cell.done`) ; la case du prix garde le rose franc.

### Tests

- `npm test` : 192 tests verts (+4 : titre et numéro, feuille imprimée, libellés « Accueil », `isPublished`, suite après le dernier tutoriel) ; `npm run typecheck` et `npm run build` OK ; `check_unique.py` : OK, 11 grilles uniques.

### Vérification dans Chrome

- Chrome stable, headless, `puppeteer-core`, build de production servi par `vite preview`, 1280 / 375 / 320 px, date simulée au 2026-11-21 et au 2026-11-20 ; script `after/shots.mjs`. Aucune erreur JS, 0 débordement horizontal.
- Écart de méthode : la grille bouclée est injectée dans `localStorage` (solution complète, statut `done`), sans cliquer le dernier export.
- **Interaction 2** : « Prendre le quart » → `#/grille/11`, titre « Plateau d'après-midi », eyebrow « n° 214 · sam. · sans inventaire », lien « Accueil » → `#/`.
- **Interaction 3** : bandeau « Programme bouclé », bouton « Accueil » ; accueil : tampon « Bouclé », 35 cases de la silhouette en rose pâle.
- **Interaction 4** : tutoriel 7 bouclé → « Grille suivante » → `#/grille/11` (fiche du jour) ; avec la fiche déjà bouclée → « Accueil » ; page dossier : lien « Accueil ».
- **Interaction 5** : au 2026-11-20, `#/grille/11` et `#/imprimer/11` affichent l'accueil (0 feuille) ; grille 10 titrée « Creux de midi », eyebrow « n° 213 · ven. » ; `#/imprimer/tout` = 10 feuilles. Feuille 11 au 2026-11-21 : « Plateau d'après-midi · n° 214 · sam. · Expert ».
- Captures : `docs/reviews/S2-finition-1/after/` (`2-grid`, `2-home-back`, `3-grid-solved`, `3-home-stamp`, `4-tuto7-solved`, `4-after-tuto7`, `4-dossier`, `print-11`, `5-direct-url-veille`, `5-grid10-veille`, aux 3 largeurs).
