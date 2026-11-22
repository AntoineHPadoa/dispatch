# Revue S3.1 : galerie UI ↔ vrai jeu

Revue indépendante de la branche `v3-ui-gallery` (commits `f508e03`, `7bc4490`) : les trois galeries (web, mobile, papier) montrent-elles le vrai jeu ?

## Verdict

- **76 vues contrôlées sur 76** (W-01…W-30, M-01…M-34 sans M-20 ni M-21, P-01…P-14), chacune recapturée par mon propre script et comparée au pixel près.
- **56 OK, 2 écarts, 18 écarts mineurs de légende.**
  - **Écarts (image ≠ vrai jeu)** : W-27 et M-27. Le bouton sous le verdict de la grille 11 est « Grille suivante » dans la galerie, « Accueil » dans le jeu publié.
  - **Écarts mineurs de légende** : W/M-09, W/M-13, W/M-17 (6 vues) ; P-03…P-14 (12 fiches) annoncées « PDF, 192 dpi » alors que ce sont des captures d'élément en média print, au contenu identique au PDF.
- **Build publié inchangé** : `dist/` identique octet pour octet à celui de `main`. Tests, typecheck, build et `check_unique.py` verts.
- **Deux défauts du jeu** révélés par la galerie, qu'elle montre fidèlement : les fiches A4 des grilles 903 (P-10) et 906 (P-13) sont tronquées en bas de page.
- À renvoyer à s1 avant publication : W-27/M-27 et l'étiquette des fiches A4. Le reste peut partir tel quel.

## Méthode

- **Builds** : mon propre build de galerie (`DISPATCH_GRIDS` = grilles publiées + `scripts/ui-gallery/grids.json`, fusion faite par moi). Il est identique octet pour octet au `web/dist-gallery/` de s1. Le build de prod vient de `main`. Les deux sont servis par `vite preview` (ports 4301 et 4302).
- **Captures** : script playwright écrit sans reprendre celui de s1.
  - Inventaire retapé à partir de la table de `docs/next/ui-gallery.md`, sans importer `views.mjs`.
  - Cases visées par la matrice `getScreenCTM()` du SVG (s1 calcule la géométrie à la main).
  - Gestes souris et tactiles à moi ; graines `localStorage` écrites par moi.
- **Paramètres repris tels que déclarés**, pour pouvoir comparer au pixel : largeurs 1280 / 375 / 320, hauteurs de fenêtre 800 / 812, `deviceScaleFactor` 2, `Date.now` figé (chrono à 12 min 34 s), capture pleine page.
- **Comparaison** : différence pixel à pixel dans un canvas Chrome (seuil 24 par canal). Chaque différence a été regardée.
- **Légendes** : j'ai regardé les 30 images web, les 14 fiches papier et les vues propres au mobile (M-19, M-23, M-31…M-34).
  - Les autres vues mobiles sont identiques au pixel à ma capture du même état. Elles partagent la légende de leur jumelle web, vérifiée sur l'image web.
- **Vraies grilles** : les 49 vues sur vraies grilles ont aussi été capturées sur le build de prod (comparaison galerie ↔ jeu publié).
  - Le 22 novembre 2026, la fiche du jour en prod est la grille 11 : la date figée de la galerie ne change donc rien.
- **Papier** : PDF A4 de `#/imprimer/<id>` rendu à 192 dpi.
  - `pdftoppm` est cassé sur cette machine (`libgpgmepp.6.dylib` manquante) ; j'ai rendu les PDF avec PDFKit (macOS).
  - Le rendu PDF a été comparé à l'image de s1 et à une capture d'élément `.a4` en média print.
- **Captures de revue** dans `docs/reviews/v3-ui-gallery/` (gitignorées) :
  - `gal/` et `prod/` : mes captures ;
  - `pdfpng/` : les PDF rendus ;
  - `a4shot/` : capture d'élément A4 ;
  - `diff-*/` : les différences en rouge ;
  - `view/w27-*.png` : le bouton de W-27 dans les deux builds.

## Verdicts par vue

« Pixel » : comparaison de l'image de la galerie avec ma capture du build de galerie. « Prod » : avec ma capture du build publié (vraies grilles seulement). « Glyphes » : seul le rendu de quelques lettres diffère (police chargée à froid, premier écran d'une session), sans aucune différence de contenu.

### Web (1280 px)

| Vue | Pixel | Prod | Légende | Verdict |
|---|---|---|---|---|
| W-01 | glyphes | identique | exacte | OK |
| W-02 | identique | identique | exacte | OK |
| W-03 | identique | identique | exacte (la grille 10 commencée ne se voit pas sur l'accueil, et la légende ne le prétend pas) | OK |
| W-04 | identique | identique | exacte | OK |
| W-05 | identique | identique | exacte | OK |
| W-06 | glyphes | glyphes | exacte | OK |
| W-07 | identique | identique | exacte | OK |
| W-08 | identique | identique | exacte | OK |
| W-09 | identique | — | « un prix et un relevé empilés sur 9h » : 15h porte aussi un prix (gaz) et un relevé (0 TAC) empilés | écart mineur de légende |
| W-10 | identique | identique | exacte | OK |
| W-11 | identique | — | exacte (le gaz 18h→24h touche le réacteur 0h→18h) | OK |
| W-12 | identique | — | exacte | OK |
| W-13 | identique | — | « Les cinq centrales » : quatre sont posées, la TAC n'est que dans la liste (0 case posée) | écart mineur de légende |
| W-14 | identique | identique | exacte | OK |
| W-15 | identique | identique | exacte | OK |
| W-16 | identique | identique | exacte (les exports de 0h et 6h sont verrouillés par les flux, pas posés) | OK |
| W-17 | identique | — | « carnet exact chargé : barres, TAC, export, import et paire STEP » : le carnet n'a pas d'export ; l'export est un flux verrouillé sous la grille | écart mineur de légende |
| W-18 | identique | — | exacte | OK |
| W-19 | identique | identique | exacte | OK |
| W-20 | identique | identique | exacte | OK |
| W-21 | identique | identique | exacte | OK |
| W-22 | identique | identique | exacte | OK |
| W-23 | identique | — | exacte (le message ne cite que le prix, les deux pastilles de 15h sont rouges) | OK |
| W-24 | identique | identique | exacte | OK |
| W-25 | identique | — | exacte | OK |
| W-26 | identique | identique | exacte | OK |
| W-27 | identique | **différent** | le bouton sous le verdict est « Grille suivante » ; en prod, après la grille 11, c'est « Accueil » | **écart** |
| W-28 | identique | identique | exacte | OK |
| W-29 | identique | — | exacte | OK |
| W-30 | identique | — | exacte | OK |

### Mobile (375 px, M-32…M-34 à 320 px)

| Vue | Pixel | Prod | Légende | Verdict |
|---|---|---|---|---|
| M-01 | identique | identique | exacte | OK |
| M-02 | glyphes | glyphes | exacte | OK |
| M-03 | identique | identique | exacte | OK |
| M-04 | identique | identique | exacte | OK |
| M-05 | identique | identique | exacte | OK |
| M-06 | identique | identique | exacte | OK |
| M-07 | identique | identique | exacte | OK |
| M-08 | identique | identique | exacte | OK |
| M-09 | identique | — | même imprécision que W-09 (15h aussi empilé) | écart mineur de légende |
| M-10 | identique | identique | exacte | OK |
| M-11 | identique | — | exacte | OK |
| M-12 | identique | — | exacte | OK |
| M-13 | identique | — | même imprécision que W-13 (TAC non posée) | écart mineur de légende |
| M-14 | identique | identique | exacte | OK |
| M-15 | identique | identique | exacte | OK |
| M-16 | identique | identique | exacte | OK |
| M-17 | identique | — | même imprécision que W-17 (pas d'export au carnet) | écart mineur de légende |
| M-18 | identique | — | exacte | OK |
| M-19 | identique | glyphes | exacte | OK |
| M-22 | identique | identique | exacte | OK |
| M-23 | identique | — | exacte | OK |
| M-24 | identique | identique | exacte | OK |
| M-25 | identique | — | exacte | OK |
| M-26 | identique | identique | exacte | OK |
| M-27 | identique | **différent** | même défaut que W-27 : « Grille suivante » au lieu d'« Accueil » | **écart** |
| M-28 | identique | identique | exacte | OK |
| M-29 | identique | — | exacte | OK |
| M-30 | identique | — | exacte | OK |
| M-31 | identique | — | exacte | OK |
| M-32 | identique | identique | exacte | OK |
| M-33 | identique | — | exacte | OK |
| M-34 | identique | identique | exacte | OK |

### Papier

- Pour P-03…P-14, « Pixel » compare l'image de s1 à ma capture de l'élément `#print-root .a4` en média print, c'est-à-dire la méthode que s1 a réellement employée.
- « PDF » compare au vrai PDF A4 rendu à 192 dpi. Les différences ne touchent que les bords des traits : la largeur diffère d'un pixel (1588 contre 1587 px) et l'anticrénelage aussi. Le contenu est identique, vérifié à l'œil sur P-04 et P-13.

| Vue | Pixel | Prod | PDF | Légende | Verdict |
|---|---|---|---|---|---|
| P-01 | identique | identique | — | exacte | OK |
| P-02 | identique | identique | — | exacte | OK |
| P-03 | identique | identique (PDF) | contenu identique | étiquette « PDF » fausse | écart mineur de légende |
| P-04 | identique | identique (PDF) | contenu identique | étiquette « PDF » fausse | écart mineur de légende |
| P-05 | glyphes | glyphes (PDF) | contenu identique | étiquette « PDF » fausse | écart mineur de légende |
| P-06 | identique | identique (PDF) | contenu identique | étiquette « PDF » fausse | écart mineur de légende |
| P-07 | identique | identique (PDF) | contenu identique | étiquette « PDF » fausse | écart mineur de légende |
| P-08 | identique | — | contenu identique | étiquette « PDF » fausse | écart mineur de légende |
| P-09 | identique | — | contenu identique | étiquette « PDF » fausse ; « empilés sur un créneau » : il y en a deux (9h, 15h) | écart mineur de légende |
| P-10 | glyphes | — | contenu identique, **fiche tronquée** (voir défauts du jeu) | étiquette « PDF » fausse ; la troncature n'est pas signalée | écart mineur de légende |
| P-11 | identique | — | contenu identique | étiquette « PDF » fausse | écart mineur de légende |
| P-12 | identique | — | contenu identique | étiquette « PDF » fausse | écart mineur de légende |
| P-13 | identique | — | contenu identique, **fiche tronquée** (voir défauts du jeu) | étiquette « PDF » fausse ; la troncature n'est pas signalée | écart mineur de légende |
| P-14 | identique | — | contenu identique | étiquette « PDF » fausse | écart mineur de légende |

## Écarts à corriger (renvoyés à s1)

1. **W-27, M-27 : bouton qui n'existe pas dans le jeu publié.**
   - Dans le build de galerie, les grilles 901…907 suivent la grille 13 : après la grille 11, la « grille suivante » est la 901, une fiche fictive.
   - Dans le jeu publié, la grille 11 est la dernière grille notée : le bouton est « Accueil » (capture `docs/reviews/v3-ui-gallery/view/w27-prod.png`).
   - W-26, M-26 et M-34 (grille 7, suivie de la 12 dans les deux builds) ne sont pas touchés. Aucune autre vue sur vraie grille ne diffère de la prod.
   - **Pistes** : ne pas laisser les grilles fictives entrer dans la chaîne « suivante » ; ou prendre W-27/M-27 sur le build de prod ; ou montrer le verdict d'une grille notée qui a une suivante.
2. **Fiches A4 étiquetées « PDF, 192 dpi » alors que ce sont des captures d'élément.**
   - `pdftoppm` échoue sur cette machine (lib `gpgme` manquante). Le script passe alors en silence à son repli, la capture d'élément `#print-root .a4` en média print, sans `WARN`.
   - La page papier affiche pourtant « A4 (PDF, 192 dpi) » sur chaque fiche, et son chapeau dit « PDF de Chrome, page entière ».
   - Le contenu est le même que le PDF ; seule la provenance annoncée est fausse.
   - **Pistes** : `brew reinstall gpgme poppler`, ou faire écrire au script un `WARN` et une étiquette qui suit la méthode réellement employée.
3. **Imprécisions de légende** (W/M-09, P-09, W/M-13, W/M-17) : corrections d'un mot, détaillées dans les tables.
   - La consigne de la grille fictive 902 (« un prix et un relevé sur le même créneau ») a la même imprécision.
4. **P-10 et P-13** : dire dans la légende que la fiche est tronquée, pour que la relecture le voie comme un défaut du jeu et non de la galerie.

## Pages HTML

- **Taille naturelle** : chaque `<img>` porte `width`/`height` égaux à la moitié de la taille du PNG (captures ×2). Vérifié sur les 76 images.
  - `.frame img { max-width: none }` dans un cadre à défilement horizontal : rien n'est réduit, recadré ni étiré.
  - Aucun `object-fit`, `transform` ni `clip` ; le seul `max-height` est celui de la boîte de zoom.
- **Zoom** : la boîte de zoom affiche l'image à sa largeur en pixels (pleine résolution).
- **Pas de vue fantôme** :
  - web : 30 figures pour 30 images ; mobile : 32 pour 32 ; papier : 14 pour 14 ;
  - chaque entrée du sommaire pointe vers une figure ;
  - les compteurs du chapeau (30, 32, 14 vues) et des badges (10, 12, 7) sont justes.
- **Seul texte inexact** : l'étiquette et le chapeau « PDF » de la page papier (écart 2).

## Couverture

| Élément | Web | Mobile | Papier |
|---|---|---|---|
| Indice `column` (relevé) | W-08, W-09 | M-08, M-09 | P-07, P-09 |
| Indice `price` | W-09, W-28 | M-09, M-28 | P-04, P-09 |
| Indice `flow` | W-10, W-12 | M-10, M-12 | P-04, P-10 |
| Indice `exchanges` | W-08, W-12 | M-08, M-12 | P-07, P-10 |
| Indice `bar` (programme) | W-10, W-11 | M-10, M-11 | P-04, P-08 |
| `length`, `engaged` | W-11 | M-11 | P-08 |
| Formes fixes (N, G, T, barrage) | W-06, W-09 | M-06, M-09 | P-03, P-09 |
| Pièces de 2 GW | W-13 | M-13 | P-11 |
| Rampe charbon | W-07, W-14 | M-07, M-14 | P-05 |
| Charbon rectangle | W-11 (carnet) | M-11 | P-08 |
| STEP pompage | W-15 | M-15 | P-04, P-12 (cases à remplir) |
| STEP turbinage | W-16, W-18 | M-16, M-18 | P-04, P-12 |
| Imports | W-16, W-18 | M-16, M-18 | P-04, P-12 |
| Exports | W-10, W-12, W-18 | M-10, M-12, M-18 | P-04, P-10 |
| Renouvelables, fil de l'eau | W-13, W-17 | M-13, M-17 | P-11, P-12 |
| Plafond CO₂ | W-12 | M-12 | P-10 |
| Verdict juste (vraie grille) | W-26, W-27 | M-26, M-27, M-34 | — |
| Verdict faux | W-28 | M-28 | — |

- **États d'interaction couverts** :
  - pièce choisie, aperçu valide (W-19), aperçu refusé (W-20), pose par-dessus (W-21) ;
  - pose refusée (W/M-22), premier toucher en attente (M-19) ;
  - pastilles vertes et rouges (W/M-23), gomme (W/M-24), centrale invalide hachurée (W/M-25) ;
  - STEP en attente du turbinage (W/M-15), grille défilée (M-31).
- **M-20 et M-21 manquent** : l'aperçu refusé et la pose par-dessus ne se voient que pendant un glisser maintenu, et le script ne sait pas tenir un doigt posé.
  - La raison donnée par la doc (« au tactile, la pose se fait en deux touchers ») est incomplète : le jeu accepte aussi le glisser au doigt (le message mobile dit « Glisse sur la grille… »), avec le même aperçu.
  - Ces deux états existent donc sur téléphone mais ne sont pas montrés. On pourrait les capturer avec des `Input.dispatchTouchEvent` (CDP) sans `touchEnd`.
- **États non couverts**, sans gravité pour la relecture :
  - curseur clavier (jeu au clavier) ;
  - message « case verrouillée » quand on touche un flux publié ;
  - abandon d'un pompage en attente.

## Grilles fictives

- **Validité** :
  - les 7 grilles (901…907) passent `validateGrid()` (`web/tests/ui-gallery.test.ts`, dans les 384 tests verts) ;
  - le validateur Python dit aussi `valid: true` pour chacune (`dispatch-solver check`) ;
  - leurs ids ne recoupent aucune grille publiée, et aucune n'a de bulletin.
- **Badge** : « grille fictive » sur les 10 vues web, 12 mobiles et 7 papier concernées, sans oubli ni excès.
  - Dans l'image même, chaque grille fictive se reconnaît à son titre « Galerie · … » et à sa consigne « Grille fictive de galerie… ».
- **Verdict juste** : il n'est montré que sur les grilles 7 et 11, deux vraies grilles.
- **Non-unicité** : aucune grille fictive n'est unique (`compositions: 2` pour les 7). C'est sans conséquence pour la galerie.
  - Mais le pied de page papier dit « Une seule solution », y compris sur 906 et 907, dont la consigne dit « sans solution ». À savoir en relisant.

## Build

- **Tests** : `npm test` dans le worktree, 10 fichiers et 384 tests verts.
- **Typecheck** : `npm run typecheck` OK.
- **Build** : `npm run build` OK.
- **Unicité** : `check_unique.py` (venv du solver de `main`, solver inchangé par la branche) : « every grid is unique and deducible ».
- **`dist/` inchangé** : `dist/` de la branche contre `dist/` de `main` (rebuild de `main` dans un dossier temporaire), `diff -r` sans aucune différence. `vite.config.ts` n'ajoute rien sans `DISPATCH_GRIDS`.
- **Build de galerie** : sorti dans `dist-gallery/`, gitignoré. Mon propre build de galerie est identique au sien.

## Défauts du jeu (hors galerie)

La galerie les montre fidèlement ; ils sont à corriger dans le jeu, pas dans la galerie.

1. **Fiches A4 tronquées** : le vrai PDF tient sur une page et coupe le contenu qui dépasse.
   - **903 (P-10, trois voisins sous plafond CO₂)** : la liste des centrales s'arrête après l'import d'Allemagne. Les imports du Royaume-Uni et d'Espagne et le pied de page manquent.
   - **906 (P-13, 12 créneaux, 11 indices)** : le gaz est coupé ; la TAC, l'import d'Espagne et le pied de page manquent.
   - Ce sont des grilles fictives, mais une grille publiée avec trois voisins ou douze créneaux perdrait de l'information à l'impression.
2. **Récit du bulletin et pictogrammes météo** : sur la fiche du jour (P-07) comme sur les fiches notées (P-06), ils ne sont pas imprimés.
   - Ils ne sont pas non plus sur l'écran de jeu (W-08) : seule la carte d'accueil les montre (W-01). Le papier reprend donc bien l'écran de jeu, mais le texte du bulletin n'existe nulle part ailleurs que sur l'accueil.
3. **Nombre de paires STEP** : sur papier (P-04, P-12), le carnet ne le donne pas, alors que l'écran affiche « STEP · 1 paire ».
   - Il reste publié par les échanges du jour (« 1 pompage »), donc la règle est tenue, mais l'écran et le papier diffèrent.
4. **Grille de 12 créneaux à 1280 px (W-29)** : elle ne tient pas dans son cadre. Il faut faire défiler la grille ; la bande d'indices et l'étiquette « Charbon 14h→… » sont coupées à droite.
5. **Pas de solution sur papier** : aucune fiche n'en montre. Les cases préremplies sont les flux publiés (→1, ←1, →0) et la TAC engagée de 901, qui sont des indices.
