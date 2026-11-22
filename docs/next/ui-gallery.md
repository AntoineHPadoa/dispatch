# Galerie UI de Dispatch

Trois pages de captures du vrai jeu, une par support (web, mobile, papier), pour commenter l'interface écran par écran. Aucune vue n'est dessinée à la main : chaque image sort du build de galerie, jouée dans Chrome par un script.

## Régénérer

```bash
cd web
node scripts/ui-gallery.mjs                 # build de galerie, captures, 3 pages HTML, tableau ci-dessous
node scripts/ui-gallery.mjs --only W-03,M-07 --skip-build   # quelques vues seulement, build déjà fait
```

- Sorties : `docs/ui-gallery/{web,mobile,papier}/index.html` (commités) et leurs images `img/<id>.png` (gitignorées, ×2).
- Prérequis : Google Chrome (ou `CHROME=…`), `pdftoppm` (poppler) pour rendre le PDF A4. S'il manque ou échoue, le script écrit un `WARN` et capture la fiche en média print (contenu identique au PDF) ; l'étiquette de la page papier suit la méthode réellement employée.
- Le script échoue (code 1) si une vue ne se rejoue pas ; il signale un scroll horizontal ou une erreur JS par `WARN`.

## Comment c'est construit

- **Deux builds** : les vues sur une vraie grille, l'accueil, le dossier et l'aperçu d'impression de la grille 7 se capturent sur le build de prod (`web/dist/`, sans `DISPATCH_GRIDS`) ; seules les vues sur une grille fictive utilisent le build de galerie. Les grilles fictives ne changent donc rien aux vraies vues (par exemple la « grille suivante » après la grille 11).
- **Build de galerie** : `DISPATCH_GRIDS=<fichier>` (voir `web/vite.config.ts`) remplace `src/data/grids.json` par ce fichier et sort dans `web/dist-gallery/`. Le script y met les grilles publiées suivies des grilles fictives.
- **Date figée (galerie seulement)** : le build de galerie remplace le « jour » du jeu par le 31 décembre 2099 (`web/scripts/ui-gallery/bulletin.ts`). Le build de prod garde la vraie date du jour de la capture.
- **Sans la variable**, la config Vite est celle d'avant : le build publié est identique octet pour octet.
- **Horloge figée** : `Date.now` est fixe dans les pages capturées ; un chrono amorcé affiche donc toujours le même temps.
- **Inventaire** : `web/scripts/ui-gallery/views.mjs`, seule source des vues. Le tableau plus bas est réécrit par le script.

## Grilles fictives

`web/scripts/ui-gallery/grids.json`, ids 901 à 907, titres « Galerie · … », sans bulletin. Elles passent `validateGrid()` (test `web/tests/ui-gallery.test.ts`) et portent le badge « grille fictive » dans les pages. Le verdict juste n'est montré que sur de vraies grilles.

| Id | Titre | Ce qu'elle couvre |
|---|---|---|
| 901 | Programmes, durées et centrale engagée | 3 programmes (`bar`) dont 2 qui se touchent, 2 durées (`length`), 1 centrale engagée ; charbon rectangle |
| 902 | Prix et relevés empilés | 4 prix, 3 relevés, prix + relevé sur le même créneau ; barrage au stock limité |
| 903 | Trois voisins sous plafond CO₂ | 3 voisins, flux import et export, échanges par pays et `*`, relevé `I:GB`, plafond CO₂ |
| 904 | Toutes les centrales et la météo | N, B, C, G, T ; pièces de 2 GW de haut ; renouvelables R et fil de l'eau F |
| 905 | Surplus, stockage et carnet chargé | demande résiduelle négative, STEP, export et import en inventaire exact |
| 906 | Grande journée sur douze créneaux | 12 colonnes, titre et relevé longs, 11 indices ; sans solution |
| 907 | Pointe haute sur six créneaux | 6 colonnes, pointe à 12 GW ; sans solution |

## Choix d'inventaire

- **Catégories** : accueil, dossier, tutoriel, grille notée, une vue par famille d'indices, une par famille de centrales, états d'interaction, verdicts, grilles extrêmes ; aperçu d'impression et fiches A4 pour le papier.
- **Vraies grilles d'abord** : une grille fictive ne sert que là où les grilles publiées ne couvrent pas le cas (durée de marche, centrale engagée, plusieurs voisins, plafond CO₂, météo, pièces hautes, charbon rectangle, surplus, 12 colonnes).
- **Web et mobile** ont les mêmes vues aux mêmes numéros (W-09 et M-09 montrent le même état). Seul écart : W-19 montre un glisser à la souris, M-19 la pose en deux touchers (premier toucher posé). Les aperçus pendant un glisser au doigt (M-20, M-21) sont tenus par des événements tactiles CDP sans `touchEnd`.
- **Témoins 320 px** : accueil, grande grille, verdict (M-32 à M-34).
- **Hors périmètre** : animations, gestes (seul leur état figé est montré), lab, tablette, mode sombre.

## Slider de défilement

- Quand la grille est plus large que son cadre, le jeu affiche sous la grille un slider de défilement (`input.board-slider`, `web/src/ui/game.ts`, mis à jour par `syncSlider()`).
- Tableau mesuré par le script sur le build de prod, pour chaque grille publiée : le slider est-il visible à l'ouverture, et de combien de pixels la grille défile.
- **Résultat** : aucune vraie grille ne l'affiche à 1280, 375 ou 320 px, ni entre 320 et 860 px. Il apparaît à 861 px, quand le jeu passe à la mise en page en deux colonnes, et disparaît à un seuil qui dépend de la grille (largeur de fenêtre utile, mesures de la revue S3.2) :

| Grilles | Créneaux | Slider visible de … à … |
|---|---|---|
| 1, 2, 12 | 6 | 861 à 975 px |
| 3, 4, 5, 6 | 6 | 861 à 997 px |
| 13 | 8 | 861 à 1095 px |
| 7, 8, 9, 10, 11 | 8 | 861 à 1117 px |

- **Appareils** : en plus d'une fenêtre d'ordinateur réduite, les grands téléphones couchés (Pixel 7 en 915 × 412, iPhone 15 Pro Max en 932 × 430) l'affichent sur les 13 grilles, et l'iPad mini en paysage (1024 × 768) sur les grilles 7 à 11 et 13. Aucun téléphone en portrait, ni écran d'ordinateur en plein écran (1280 px et plus).
- **Vues** : W-31 à W-33 le montrent sur de vraies grilles (1024 et 960 px) ; W-29, M-29, M-31 et M-33 sur la grille fictive de 12 créneaux, la seule qui le déclenche à 1280, 375 et 320 px.

<!-- slider:start -->

| Grille | Créneaux | 1280 px | 1024 px | 960 px | 375 px | 320 px |
|---|---|---|---|---|---|---|
| 1 · 1. Poser l’inventaire | 6 | non | non | oui (16 px à défiler) | non | non |
| 2 · 2. Le prix plafonne la colonne | 6 | non | non | oui (16 px à défiler) | non | non |
| 3 · 3. Inventaire juste | 6 | non | non | oui (38 px à défiler) | non | non |
| 4 · 4. Le creux coupe le ruban | 6 | non | non | oui (38 px à défiler) | non | non |
| 5 · 5. Flux publié et compter la colonne | 6 | non | non | oui (38 px à défiler) | non | non |
| 6 · 6. La case la plus chère | 6 | non | non | oui (38 px à défiler) | non | non |
| 7 · 7. Pompage, relevé et programme | 8 | non | oui (94 px à défiler) | oui (158 px à défiler) | non | non |
| 8 · Facile | 8 | non | oui (94 px à défiler) | oui (158 px à défiler) | non | non |
| 9 · Moyen | 8 | non | oui (94 px à défiler) | oui (158 px à défiler) | non | non |
| 10 · Difficile | 8 | non | oui (94 px à défiler) | oui (158 px à défiler) | non | non |
| 11 · Expert | 8 | non | oui (94 px à défiler) | oui (158 px à défiler) | non | non |
| 12 · 8. La rampe de charbon | 6 | non | non | oui (16 px à défiler) | non | non |
| 13 · 9. Deux épaules se relaient | 8 | non | oui (72 px à défiler) | oui (136 px à défiler) | non | non |

<!-- slider:end -->

## Vues

<!-- views:start -->

### web

| Vue | Catégorie | Grille | Route | Largeur | Actions | Ce qu’elle montre |
|---|---|---|---|---|---|---|
| W-01 | Accueil | — | `#/` | 1280 px | — | Accueil au premier passage : fiche du jour (dernier bulletin) non jouée, donc bouton plein « Prendre le quart » (il devient « Revoir le quart » à contour une fois la grille bouclée, voir la vue 03) ; quarts précédents, dossier « Premiers pas » à 0 sur 9, lien « Imprimer toutes les grilles ». |
| W-02 | Accueil | — | `#/` | 1280 px | ouvre « Comment jouer » | Accueil avec les règles du jeu dépliées. |
| W-03 | Accueil | — | `#/` | 1280 px | progression : grilles 1, 2, 3, 9, 11 terminées ; grilles 10 commencées | Accueil d’un joueur avancé : fiche du jour bouclée (tampon, solution en couleurs) : le bouton devient « Revoir le quart », à contour, au lieu du bouton plein « Prendre le quart » d’une grille non jouée ; un quart précédent bouclé, dossier à 3 sur 9. |
| W-04 | Dossier | — | `#/dossier/premiers-pas` | 1280 px | — | Dossier « Premiers pas » neuf : les neuf fiches du tutoriel, la première marquée « à jouer ensuite ». |
| W-05 | Dossier | — | `#/dossier/premiers-pas` | 1280 px | progression : grilles 1, 2, 3 terminées ; grilles 4 commencées | Dossier en cours : trois fiches terminées, la quatrième en cours et marquée « à jouer ensuite ». |
| W-06 | Tutoriel | 1 · 1. Poser l’inventaire | `#/grille/1` | 1280 px | — | Premier tutoriel à vide : technique du jour, carnet d’ordres exact (nucléaire, gaz, TAC), aucun indice. |
| W-07 | Tutoriel | 12 · 8. La rampe de charbon | `#/grille/12` | 1280 px | — | Tutoriel de la rampe de charbon à vide : carnet avec les rampes 1 → 2 → 1. |
| W-08 | Grille notée | 11 · Expert | `#/grille/11` | 1280 px | — | Fiche du jour (Expert) à vide : bulletin en sur-titre, sans inventaire, relevés sur la grille, échanges du jour en liste. |
| W-09 | Indices | 902 · Galerie · Prix et relevés empilés (fictive) | `#/grille/902` | 1280 px | — | Prix et relevés : quatre prix, trois relevés, un prix et un relevé empilés sur deux créneaux (9h et 15h) ; barrage au stock limité. |
| W-10 | Indices | 7 · 7. Pompage, relevé et programme | `#/grille/7` | 1280 px | — | Flux publiés (exports verrouillés à 0h et 6h), programme, relevé et prix réunis sur un tutoriel, avec la STEP. |
| W-11 | Indices | 901 · Galerie · Programmes, durées et centrale engagée (fictive) | `#/grille/901` | 1280 px | — | Programmes (nucléaire, charbon, gaz, dont deux qui se touchent), durées de marche et TAC déjà engagée. |
| W-12 | Indices | 903 · Galerie · Trois voisins sous plafond CO₂ (fictive) | `#/grille/903` | 1280 px | pose les 6 premières pièces de la solution (avec ses échanges et sa STEP) | Trois voisins sous plafond CO₂ : flux import et export, échanges du jour par pays, jauge CO₂ en cours de remplissage. |
| W-13 | Centrales | 904 · Galerie · Toutes les centrales et la météo (fictive) | `#/grille/904` | 1280 px | pose les 8 premières pièces de la solution (avec ses échanges et sa STEP) | Les cinq centrales au carnet (nucléaire, charbon et gaz permis en 2 GW de haut) ; quatre sont posées, dont nucléaire et gaz de 2 GW, la TAC ne l’est pas ; au-dessus des renouvelables et du fil de l’eau. |
| W-14 | Centrales | 13 · 9. Deux épaules se relaient | `#/grille/13` | 1280 px | pose la solution sauf les poses 4 | Deux rampes de charbon posées (trapèzes 1 → 2 → 1) qui se relaient, la TAC encore à poser. |
| W-15 | Centrales | 7 · 7. Pompage, relevé et programme | `#/grille/7` | 1280 px | choisit STEP ; touche ▲ col. 3 | STEP choisie, pompage ▲ choisi à 9h : flèches ▼ sur les créneaux où turbiner, le message attend le turbinage. |
| W-16 | Centrales | 7 · 7. Pompage, relevé et programme | `#/grille/7` | 1280 px | pose les 4 premières pièces de la solution (avec ses échanges et sa STEP) | Paire STEP posée (pompage ▲ à 9h, turbinage ▼ à 12h), exports et imports d’Allemagne posés. |
| W-17 | Centrales | 905 · Galerie · Surplus, stockage et carnet chargé (fictive) | `#/grille/905` | 1280 px | — | Surplus de renouvelables à 9h (message d’erreur), carnet exact chargé : barres, TAC, import et paire STEP ; l’export de 12h est un flux verrouillé sous la grille. |
| W-18 | Centrales | 905 · Galerie · Surplus, stockage et carnet chargé (fictive) | `#/grille/905` | 1280 px | pose les 3 premières pièces de la solution (avec ses échanges et sa STEP) | Surplus absorbé par la STEP, export verrouillé, import de Belgique posé. |
| W-19 | Interactions | 1 · 1. Poser l’inventaire | `#/grille/1` | 1280 px | choisit N ; maintient un glisser de (0, 0) à (0, 5) | Pose à la souris en cours : nucléaire choisi, aperçu valide de 6 créneaux pendant le glisser (le pointeur n’apparaît pas sur la capture). |
| W-20 | Interactions | 1 · 1. Poser l’inventaire | `#/grille/1` | 1280 px | choisit N ; maintient un glisser de (3, 0) à (3, 3) | Aperçu refusé (rouge) : la barre dépasse de la silhouette, le message dit pourquoi. |
| W-21 | Interactions | 1 · 1. Poser l’inventaire | `#/grille/1` | 1280 px | pose G ligne 0 col. 0 ×2 ; choisit N ; maintient un glisser de (0, 0) à (0, 5) | Pose par-dessus : l’aperçu du nucléaire remplace le gaz déjà posé (gaz pâli). |
| W-22 | Interactions | 1 · 1. Poser l’inventaire | `#/grille/1` | 1280 px | pose N ligne 3 col. 0 ×3 | Pose refusée : message rouge sous la grille, rien n’est posé. |
| W-23 | Interactions | 902 · Galerie · Prix et relevés empilés (fictive) | `#/grille/902` | 1280 px | pose les 6 premières pièces de la solution (avec ses échanges et sa STEP) ; pose T ligne 1 col. 5 ×1 | Indices satisfaits (pastilles vertes) ; la TAC posée à 15h contredit le prix et le relevé de 15h (pastilles rouges, message). |
| W-24 | Interactions | 1 · 1. Poser l’inventaire | `#/grille/1` | 1280 px | pose les 3 premières pièces de la solution (avec ses échanges et sa STEP) ; outil erase | Gomme active sur une grille à moitié posée. |
| W-25 | Interactions | 903 · Galerie · Trois voisins sous plafond CO₂ (fictive) | `#/grille/903` | 1280 px | touche l’export GB col. 0 ; pose T ligne 2 col. 0 ×1 ; touche l’export GB col. 0 ; touche l’export GB col. 0 | Centrale invalide hachurée : l’export qui portait la TAC à 0h a été retiré. |
| W-26 | Verdict | 7 · 7. Pompage, relevé et programme | `#/grille/7` | 1280 px | chrono amorcé à 12 min 34 s ; pose toute la solution | Verdict juste sur un vrai tutoriel : bandeau « Programme bouclé », temps, bouton « Grille suivante ». |
| W-27 | Verdict | 11 · Expert | `#/grille/11` | 1280 px | chrono amorcé à 12 min 34 s ; pose toute la solution | Verdict juste sur la fiche du jour (grille notée) : dernière grille notée, le bouton ramène à l’accueil. |
| W-28 | Verdict | 2 · 2. Le prix plafonne la colonne | `#/grille/2` | 1280 px | pose la solution en échangeant les poses 2 et 3 | Verdict faux : grille pleine mais le prix de 16h est contredit (barrage et TAC échangés). |
| W-29 | Grilles extrêmes | 906 · Galerie · Grande journée d’hiver sur douze créneaux, avec trois pointes et l’Espagne en renfort (fictive) | `#/grille/906` | 1280 px | — | Grande grille de 12 créneaux, titre et relevé très longs, onze indices ; elle déborde de son cadre, d’où le slider de défilement sous la grille. À 1280 px, seule une grille de 12 créneaux le fait apparaître ; les vraies grilles l’affichent entre 861 px et 975 à 1117 px de large selon la grille (fenêtre d’ordinateur réduite, grand téléphone ou tablette en paysage ; vues W-31 à W-33). |
| W-30 | Grilles extrêmes | 907 · Galerie · Pointe haute sur six créneaux (fictive) | `#/grille/907` | 1280 px | — | Grille étroite et haute : six créneaux, pointe à 12 GW. |
| W-31 | Slider de défilement | 11 · Expert | `#/grille/11` | 1024 px | — | Vraie grille de 8 créneaux dans une fenêtre de 1024 px : elle déborde de son cadre, le slider de défilement sous la grille apparaît, au début. |
| W-32 | Slider de défilement | 11 · Expert | `#/grille/11` | 1024 px | fait défiler la grille à droite | La même grille défilée vers la droite : slider de défilement sous la grille poussé au bout, premiers créneaux masqués. |
| W-33 | Slider de défilement | 1 · 1. Poser l’inventaire | `#/grille/1` | 960 px | — | Vraie grille de 6 créneaux dans une fenêtre de 960 px : slider de défilement sous la grille, au début. |

### mobile

| Vue | Catégorie | Grille | Route | Largeur | Actions | Ce qu’elle montre |
|---|---|---|---|---|---|---|
| M-01 | Accueil | — | `#/` | 375 px | — | Accueil au premier passage : fiche du jour (dernier bulletin) non jouée, donc bouton plein « Prendre le quart » (il devient « Revoir le quart » à contour une fois la grille bouclée, voir la vue 03) ; quarts précédents, dossier « Premiers pas » à 0 sur 9, lien « Imprimer toutes les grilles ». |
| M-02 | Accueil | — | `#/` | 375 px | ouvre « Comment jouer » | Accueil avec les règles du jeu dépliées. |
| M-03 | Accueil | — | `#/` | 375 px | progression : grilles 1, 2, 3, 9, 11 terminées ; grilles 10 commencées | Accueil d’un joueur avancé : fiche du jour bouclée (tampon, solution en couleurs) : le bouton devient « Revoir le quart », à contour, au lieu du bouton plein « Prendre le quart » d’une grille non jouée ; un quart précédent bouclé, dossier à 3 sur 9. |
| M-04 | Dossier | — | `#/dossier/premiers-pas` | 375 px | — | Dossier « Premiers pas » neuf : les neuf fiches du tutoriel, la première marquée « à jouer ensuite ». |
| M-05 | Dossier | — | `#/dossier/premiers-pas` | 375 px | progression : grilles 1, 2, 3 terminées ; grilles 4 commencées | Dossier en cours : trois fiches terminées, la quatrième en cours et marquée « à jouer ensuite ». |
| M-06 | Tutoriel | 1 · 1. Poser l’inventaire | `#/grille/1` | 375 px | — | Premier tutoriel à vide : technique du jour, carnet d’ordres exact (nucléaire, gaz, TAC), aucun indice. |
| M-07 | Tutoriel | 12 · 8. La rampe de charbon | `#/grille/12` | 375 px | — | Tutoriel de la rampe de charbon à vide : carnet avec les rampes 1 → 2 → 1. |
| M-08 | Grille notée | 11 · Expert | `#/grille/11` | 375 px | — | Fiche du jour (Expert) à vide : bulletin en sur-titre, sans inventaire, relevés sur la grille, échanges du jour en liste. |
| M-09 | Indices | 902 · Galerie · Prix et relevés empilés (fictive) | `#/grille/902` | 375 px | — | Prix et relevés : quatre prix, trois relevés, un prix et un relevé empilés sur deux créneaux (9h et 15h) ; barrage au stock limité. |
| M-10 | Indices | 7 · 7. Pompage, relevé et programme | `#/grille/7` | 375 px | — | Flux publiés (exports verrouillés à 0h et 6h), programme, relevé et prix réunis sur un tutoriel, avec la STEP. |
| M-11 | Indices | 901 · Galerie · Programmes, durées et centrale engagée (fictive) | `#/grille/901` | 375 px | — | Programmes (nucléaire, charbon, gaz, dont deux qui se touchent), durées de marche et TAC déjà engagée. |
| M-12 | Indices | 903 · Galerie · Trois voisins sous plafond CO₂ (fictive) | `#/grille/903` | 375 px | pose les 6 premières pièces de la solution (avec ses échanges et sa STEP) | Trois voisins sous plafond CO₂ : flux import et export, échanges du jour par pays, jauge CO₂ en cours de remplissage. |
| M-13 | Centrales | 904 · Galerie · Toutes les centrales et la météo (fictive) | `#/grille/904` | 375 px | pose les 8 premières pièces de la solution (avec ses échanges et sa STEP) | Les cinq centrales au carnet (nucléaire, charbon et gaz permis en 2 GW de haut) ; quatre sont posées, dont nucléaire et gaz de 2 GW, la TAC ne l’est pas ; au-dessus des renouvelables et du fil de l’eau. |
| M-14 | Centrales | 13 · 9. Deux épaules se relaient | `#/grille/13` | 375 px | pose la solution sauf les poses 4 | Deux rampes de charbon posées (trapèzes 1 → 2 → 1) qui se relaient, la TAC encore à poser. |
| M-15 | Centrales | 7 · 7. Pompage, relevé et programme | `#/grille/7` | 375 px | choisit STEP ; touche ▲ col. 3 | STEP choisie, pompage ▲ choisi à 9h : flèches ▼ sur les créneaux où turbiner, le message attend le turbinage. |
| M-16 | Centrales | 7 · 7. Pompage, relevé et programme | `#/grille/7` | 375 px | pose les 4 premières pièces de la solution (avec ses échanges et sa STEP) | Paire STEP posée (pompage ▲ à 9h, turbinage ▼ à 12h), exports et imports d’Allemagne posés. |
| M-17 | Centrales | 905 · Galerie · Surplus, stockage et carnet chargé (fictive) | `#/grille/905` | 375 px | — | Surplus de renouvelables à 9h (message d’erreur), carnet exact chargé : barres, TAC, import et paire STEP ; l’export de 12h est un flux verrouillé sous la grille. |
| M-18 | Centrales | 905 · Galerie · Surplus, stockage et carnet chargé (fictive) | `#/grille/905` | 375 px | pose les 3 premières pièces de la solution (avec ses échanges et sa STEP) | Surplus absorbé par la STEP, export verrouillé, import de Belgique posé. |
| M-19 | Interactions | 1 · 1. Poser l’inventaire | `#/grille/1` | 375 px | choisit N ; touche la case (0, 0) | Pose en deux touchers : nucléaire choisi, premier toucher posé, le message attend le second. |
| M-20 | Interactions | 1 · 1. Poser l’inventaire | `#/grille/1` | 375 px | choisit N ; maintient un glisser de (3, 0) à (3, 3) | Aperçu refusé (rouge) : la barre dépasse de la silhouette, le message dit pourquoi. |
| M-21 | Interactions | 1 · 1. Poser l’inventaire | `#/grille/1` | 375 px | pose G ligne 0 col. 0 ×2 ; choisit N ; maintient un glisser de (0, 0) à (0, 5) | Pose par-dessus : l’aperçu du nucléaire remplace le gaz déjà posé (gaz pâli). |
| M-22 | Interactions | 1 · 1. Poser l’inventaire | `#/grille/1` | 375 px | pose N ligne 3 col. 0 ×3 | Pose refusée : message rouge sous la grille, rien n’est posé. |
| M-23 | Interactions | 902 · Galerie · Prix et relevés empilés (fictive) | `#/grille/902` | 375 px | pose les 6 premières pièces de la solution (avec ses échanges et sa STEP) ; pose T ligne 1 col. 5 ×1 | Indices satisfaits (pastilles vertes) ; la TAC posée à 15h contredit le prix et le relevé de 15h (pastilles rouges, message). |
| M-24 | Interactions | 1 · 1. Poser l’inventaire | `#/grille/1` | 375 px | pose les 3 premières pièces de la solution (avec ses échanges et sa STEP) ; outil erase | Gomme active sur une grille à moitié posée. |
| M-25 | Interactions | 903 · Galerie · Trois voisins sous plafond CO₂ (fictive) | `#/grille/903` | 375 px | touche l’export GB col. 0 ; pose T ligne 2 col. 0 ×1 ; touche l’export GB col. 0 ; touche l’export GB col. 0 | Centrale invalide hachurée : l’export qui portait la TAC à 0h a été retiré. |
| M-26 | Verdict | 7 · 7. Pompage, relevé et programme | `#/grille/7` | 375 px | chrono amorcé à 12 min 34 s ; pose toute la solution | Verdict juste sur un vrai tutoriel : bandeau « Programme bouclé », temps, bouton « Grille suivante ». |
| M-27 | Verdict | 11 · Expert | `#/grille/11` | 375 px | chrono amorcé à 12 min 34 s ; pose toute la solution | Verdict juste sur la fiche du jour (grille notée) : dernière grille notée, le bouton ramène à l’accueil. |
| M-28 | Verdict | 2 · 2. Le prix plafonne la colonne | `#/grille/2` | 375 px | pose la solution en échangeant les poses 2 et 3 | Verdict faux : grille pleine mais le prix de 16h est contredit (barrage et TAC échangés). |
| M-29 | Grilles extrêmes | 906 · Galerie · Grande journée d’hiver sur douze créneaux, avec trois pointes et l’Espagne en renfort (fictive) | `#/grille/906` | 375 px | — | Grande grille de 12 créneaux, titre et relevé très longs, onze indices ; slider de défilement sous la grille, au début. Aucune vraie grille ne l’affiche à 375 ni à 320 px. |
| M-30 | Grilles extrêmes | 907 · Galerie · Pointe haute sur six créneaux (fictive) | `#/grille/907` | 375 px | — | Grille étroite et haute : six créneaux, pointe à 12 GW. |
| M-31 | Grilles extrêmes | 906 · Galerie · Grande journée d’hiver sur douze créneaux, avec trois pointes et l’Espagne en renfort (fictive) | `#/grille/906` | 375 px | fait défiler la grille à droite | Grande grille défilée vers la droite avec le slider de défilement sous la grille, poussé au bout. |
| M-32 | Témoins 320 px | — | `#/` | 320 px | — | Accueil à 320 px. |
| M-33 | Témoins 320 px | 906 · Galerie · Grande journée d’hiver sur douze créneaux, avec trois pointes et l’Espagne en renfort (fictive) | `#/grille/906` | 320 px | — | Grande grille de 12 créneaux à 320 px, avec le slider de défilement sous la grille. |
| M-34 | Témoins 320 px | 7 · 7. Pompage, relevé et programme | `#/grille/7` | 320 px | chrono amorcé à 12 min 34 s ; pose toute la solution | Verdict juste à 320 px. |

### papier

| Vue | Catégorie | Grille | Route | Largeur | Actions | Ce qu’elle montre |
|---|---|---|---|---|---|---|
| P-01 | Aperçu d’impression | 7 · 7. Pompage, relevé et programme | `#/imprimer/7` | 1280 px | — | Aperçu d’impression à l’écran (1280 px) : barre de retour et bouton Imprimer au-dessus de la fiche. |
| P-02 | Aperçu d’impression | 7 · 7. Pompage, relevé et programme | `#/imprimer/7` | 375 px | — | Aperçu d’impression sur téléphone (375 px). |
| P-03 | Fiches A4 | 1 · 1. Poser l’inventaire | `#/imprimer/1` | A4 | — | Tutoriel 1 : carnet d’ordres exact, sans indice. |
| P-04 | Fiches A4 | 7 · 7. Pompage, relevé et programme | `#/imprimer/7` | A4 | — | Tutoriel 7 : flux, programme, relevé, prix, cases d’échanges et de STEP à remplir. |
| P-05 | Fiches A4 | 13 · 9. Deux épaules se relaient | `#/imprimer/13` | A4 | — | Tutoriel des rampes de charbon. |
| P-06 | Fiches A4 | 8 · Facile | `#/imprimer/8` | A4 | — | Fiche notée Facile : barrage au stock limité, flux et échanges du jour. |
| P-07 | Fiches A4 | 11 · Expert | `#/imprimer/11` | A4 | — | Fiche du jour Expert : sans inventaire, relevés, échanges du jour. |
| P-08 | Fiches A4 | 901 · Galerie · Programmes, durées et centrale engagée (fictive) | `#/imprimer/901` | A4 | — | Programmes, durées de marche et centrale engagée. |
| P-09 | Fiches A4 | 902 · Galerie · Prix et relevés empilés (fictive) | `#/imprimer/902` | A4 | — | Prix et relevés empilés sur deux créneaux (9h et 15h). |
| P-10 | Fiches A4 | 903 · Galerie · Trois voisins sous plafond CO₂ (fictive) | `#/imprimer/903` | A4 | — | Trois voisins, flux, échanges par pays et règle du plafond CO₂. Fiche tronquée en bas (imports du Royaume-Uni et d’Espagne et pied de page coupés) : défaut du jeu, montré tel quel. |
| P-11 | Fiches A4 | 904 · Galerie · Toutes les centrales et la météo (fictive) | `#/imprimer/904` | A4 | — | Les cinq centrales, pièces hautes, renouvelables et fil de l’eau. |
| P-12 | Fiches A4 | 905 · Galerie · Surplus, stockage et carnet chargé (fictive) | `#/imprimer/905` | A4 | — | Surplus, STEP, export et import imposés par un carnet exact. |
| P-13 | Fiches A4 | 906 · Galerie · Grande journée d’hiver sur douze créneaux, avec trois pointes et l’Espagne en renfort (fictive) | `#/imprimer/906` | A4 | — | Grande grille de 12 créneaux, onze indices. Fiche tronquée en bas (gaz coupé, TAC, import d’Espagne et pied de page absents) : défaut du jeu, montré tel quel. |
| P-14 | Fiches A4 | 907 · Galerie · Pointe haute sur six créneaux (fictive) | `#/imprimer/907` | A4 | — | Grille haute de six créneaux. |

<!-- views:end -->
