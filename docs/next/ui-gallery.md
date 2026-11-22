# Galerie UI de Dispatch

Trois pages de captures du vrai jeu, une par support (web, mobile, papier), pour commenter l'interface écran par écran. Aucune vue n'est dessinée à la main : chaque image sort du build de galerie, jouée dans Chrome par un script.

## Régénérer

```bash
cd web
node scripts/ui-gallery.mjs                 # build de galerie, captures, 3 pages HTML, tableau ci-dessous
node scripts/ui-gallery.mjs --only W-03,M-07 --skip-build   # quelques vues seulement, build déjà fait
```

- Sorties : `docs/ui-gallery/{web,mobile,papier}/index.html` (commités) et leurs images `img/<id>.png` (gitignorées, ×2).
- Prérequis : Google Chrome (ou `CHROME=…`), `pdftoppm` (poppler) pour les fiches A4 ; sans lui, la fiche est capturée en média print.
- Le script échoue (code 1) si une vue ne se rejoue pas ; il signale un scroll horizontal ou une erreur JS par `WARN`.

## Comment c'est construit

- **Build de galerie** : `DISPATCH_GRIDS=<fichier>` (voir `web/vite.config.ts`) remplace `src/data/grids.json` par ce fichier et sort dans `web/dist-gallery/`. Le script y met les grilles publiées suivies des grilles fictives.
- **Date figée** : le build de galerie remplace le « jour » du jeu par le 31 décembre 2099 (`web/scripts/ui-gallery/bulletin.ts`). Tout bulletin compte comme publié et la fiche du jour est le dernier bulletin.
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
- **Web et mobile** ont les mêmes vues aux mêmes numéros (W-09 et M-09 montrent le même état). Écarts : à la souris, l'aperçu refusé (W-20) et la pose par-dessus (W-21) se voient pendant le glisser ; au tactile, la pose se fait en deux touchers (M-19).
- **Témoins 320 px** : accueil, grande grille, verdict (M-32 à M-34).
- **Hors périmètre** : animations, gestes (seul leur état figé est montré), lab, tablette, mode sombre.

## Vues

<!-- views:start -->

### web

| Vue | Catégorie | Grille | Route | Largeur | Actions | Ce qu’elle montre |
|---|---|---|---|---|---|---|
| W-01 | Accueil | — | `#/` | 1280 px | — | Accueil au premier passage : fiche du jour (dernier bulletin), quarts précédents, dossier « Premiers pas » à 0 sur 9, lien « Imprimer toutes les grilles ». |
| W-02 | Accueil | — | `#/` | 1280 px | ouvre « Comment jouer » | Accueil avec les règles du jeu dépliées. |
| W-03 | Accueil | — | `#/` | 1280 px | progression : grilles 1, 2, 3, 9, 11 terminées ; grilles 10 commencées | Accueil d’un joueur avancé : fiche du jour bouclée (tampon, solution en couleurs, « Revoir le quart »), un quart précédent bouclé, dossier à 3 sur 9. |
| W-04 | Dossier | — | `#/dossier/premiers-pas` | 1280 px | — | Dossier « Premiers pas » neuf : les neuf fiches du tutoriel, la première marquée « à jouer ensuite ». |
| W-05 | Dossier | — | `#/dossier/premiers-pas` | 1280 px | progression : grilles 1, 2, 3 terminées ; grilles 4 commencées | Dossier en cours : trois fiches terminées, la quatrième en cours et marquée « à jouer ensuite ». |
| W-06 | Tutoriel | 1 · 1. Poser l’inventaire | `#/grille/1` | 1280 px | — | Premier tutoriel à vide : technique du jour, carnet d’ordres exact (nucléaire, gaz, TAC), aucun indice. |
| W-07 | Tutoriel | 12 · 8. La rampe de charbon | `#/grille/12` | 1280 px | — | Tutoriel de la rampe de charbon à vide : carnet avec les rampes 1 → 2 → 1. |
| W-08 | Grille notée | 11 · Expert | `#/grille/11` | 1280 px | — | Fiche du jour (Expert) à vide : bulletin en sur-titre, sans inventaire, relevés sur la grille, échanges du jour en liste. |
| W-09 | Indices | 902 · Galerie · Prix et relevés empilés (fictive) | `#/grille/902` | 1280 px | — | Prix et relevés : quatre prix, trois relevés, un prix et un relevé empilés sur 9h ; barrage au stock limité. |
| W-10 | Indices | 7 · 7. Pompage, relevé et programme | `#/grille/7` | 1280 px | — | Flux publiés (exports verrouillés à 0h et 6h), programme, relevé et prix réunis sur un tutoriel, avec la STEP. |
| W-11 | Indices | 901 · Galerie · Programmes, durées et centrale engagée (fictive) | `#/grille/901` | 1280 px | — | Programmes (nucléaire, charbon, gaz, dont deux qui se touchent), durées de marche et TAC déjà engagée. |
| W-12 | Indices | 903 · Galerie · Trois voisins sous plafond CO₂ (fictive) | `#/grille/903` | 1280 px | pose les 6 premières pièces de la solution (avec ses échanges et sa STEP) | Trois voisins sous plafond CO₂ : flux import et export, échanges du jour par pays, jauge CO₂ en cours de remplissage. |
| W-13 | Centrales | 904 · Galerie · Toutes les centrales et la météo (fictive) | `#/grille/904` | 1280 px | pose les 8 premières pièces de la solution (avec ses échanges et sa STEP) | Les cinq centrales, dont nucléaire et gaz de 2 GW de haut, au-dessus des renouvelables et du fil de l’eau. |
| W-14 | Centrales | 13 · 9. Deux épaules se relaient | `#/grille/13` | 1280 px | pose la solution sauf les poses 4 | Deux rampes de charbon posées (trapèzes 1 → 2 → 1) qui se relaient, la TAC encore à poser. |
| W-15 | Centrales | 7 · 7. Pompage, relevé et programme | `#/grille/7` | 1280 px | choisit STEP ; touche ▲ col. 3 | STEP choisie, pompage ▲ choisi à 9h : flèches ▼ sur les créneaux où turbiner, le message attend le turbinage. |
| W-16 | Centrales | 7 · 7. Pompage, relevé et programme | `#/grille/7` | 1280 px | pose les 4 premières pièces de la solution (avec ses échanges et sa STEP) | Paire STEP posée (pompage ▲ à 9h, turbinage ▼ à 12h), exports et imports d’Allemagne posés. |
| W-17 | Centrales | 905 · Galerie · Surplus, stockage et carnet chargé (fictive) | `#/grille/905` | 1280 px | — | Surplus de renouvelables à 9h (message d’erreur), carnet exact chargé : barres, TAC, export, import et paire STEP. |
| W-18 | Centrales | 905 · Galerie · Surplus, stockage et carnet chargé (fictive) | `#/grille/905` | 1280 px | pose les 3 premières pièces de la solution (avec ses échanges et sa STEP) | Surplus absorbé par la STEP, export verrouillé, import de Belgique posé. |
| W-19 | Interactions | 1 · 1. Poser l’inventaire | `#/grille/1` | 1280 px | choisit N ; maintient un glisser de (0, 0) à (0, 5) | Pose à la souris en cours : nucléaire choisi, aperçu valide de 6 créneaux pendant le glisser (le pointeur n’apparaît pas sur la capture). |
| W-20 | Interactions | 1 · 1. Poser l’inventaire | `#/grille/1` | 1280 px | choisit N ; maintient un glisser de (3, 0) à (3, 3) | Aperçu refusé (rouge) : la barre dépasse de la silhouette, le message dit pourquoi. |
| W-21 | Interactions | 1 · 1. Poser l’inventaire | `#/grille/1` | 1280 px | pose G ligne 0 col. 0 ×2 ; choisit N ; maintient un glisser de (0, 0) à (0, 5) | Pose par-dessus : l’aperçu du nucléaire remplace le gaz déjà posé (gaz pâli). |
| W-22 | Interactions | 1 · 1. Poser l’inventaire | `#/grille/1` | 1280 px | pose N ligne 3 col. 0 ×3 | Pose refusée : message rouge sous la grille, rien n’est posé. |
| W-23 | Interactions | 902 · Galerie · Prix et relevés empilés (fictive) | `#/grille/902` | 1280 px | pose les 6 premières pièces de la solution (avec ses échanges et sa STEP) ; pose T ligne 1 col. 5 ×1 | Indices satisfaits (pastilles vertes) ; la TAC posée à 15h contredit le prix et le relevé de 15h (pastilles rouges, message). |
| W-24 | Interactions | 1 · 1. Poser l’inventaire | `#/grille/1` | 1280 px | pose les 3 premières pièces de la solution (avec ses échanges et sa STEP) ; outil erase | Gomme active sur une grille à moitié posée. |
| W-25 | Interactions | 903 · Galerie · Trois voisins sous plafond CO₂ (fictive) | `#/grille/903` | 1280 px | touche l’export GB col. 0 ; pose T ligne 2 col. 0 ×1 ; touche l’export GB col. 0 ; touche l’export GB col. 0 | Centrale invalide hachurée : l’export qui portait la TAC à 0h a été retiré. |
| W-26 | Verdict | 7 · 7. Pompage, relevé et programme | `#/grille/7` | 1280 px | chrono amorcé à 12 min 34 s ; pose toute la solution | Verdict juste sur un vrai tutoriel : bandeau « Programme bouclé », temps, bouton « Grille suivante ». |
| W-27 | Verdict | 11 · Expert | `#/grille/11` | 1280 px | chrono amorcé à 12 min 34 s ; pose toute la solution | Verdict juste sur la fiche du jour (grille notée). |
| W-28 | Verdict | 2 · 2. Le prix plafonne la colonne | `#/grille/2` | 1280 px | pose la solution en échangeant les poses 2 et 3 | Verdict faux : grille pleine mais le prix de 16h est contredit (barrage et TAC échangés). |
| W-29 | Grilles extrêmes | 906 · Galerie · Grande journée d’hiver sur douze créneaux, avec trois pointes et l’Espagne en renfort (fictive) | `#/grille/906` | 1280 px | — | Grande grille de 12 créneaux, titre et relevé très longs, onze indices. |
| W-30 | Grilles extrêmes | 907 · Galerie · Pointe haute sur six créneaux (fictive) | `#/grille/907` | 1280 px | — | Grille étroite et haute : six créneaux, pointe à 12 GW. |

### mobile

| Vue | Catégorie | Grille | Route | Largeur | Actions | Ce qu’elle montre |
|---|---|---|---|---|---|---|
| M-01 | Accueil | — | `#/` | 375 px | — | Accueil au premier passage : fiche du jour (dernier bulletin), quarts précédents, dossier « Premiers pas » à 0 sur 9, lien « Imprimer toutes les grilles ». |
| M-02 | Accueil | — | `#/` | 375 px | ouvre « Comment jouer » | Accueil avec les règles du jeu dépliées. |
| M-03 | Accueil | — | `#/` | 375 px | progression : grilles 1, 2, 3, 9, 11 terminées ; grilles 10 commencées | Accueil d’un joueur avancé : fiche du jour bouclée (tampon, solution en couleurs, « Revoir le quart »), un quart précédent bouclé, dossier à 3 sur 9. |
| M-04 | Dossier | — | `#/dossier/premiers-pas` | 375 px | — | Dossier « Premiers pas » neuf : les neuf fiches du tutoriel, la première marquée « à jouer ensuite ». |
| M-05 | Dossier | — | `#/dossier/premiers-pas` | 375 px | progression : grilles 1, 2, 3 terminées ; grilles 4 commencées | Dossier en cours : trois fiches terminées, la quatrième en cours et marquée « à jouer ensuite ». |
| M-06 | Tutoriel | 1 · 1. Poser l’inventaire | `#/grille/1` | 375 px | — | Premier tutoriel à vide : technique du jour, carnet d’ordres exact (nucléaire, gaz, TAC), aucun indice. |
| M-07 | Tutoriel | 12 · 8. La rampe de charbon | `#/grille/12` | 375 px | — | Tutoriel de la rampe de charbon à vide : carnet avec les rampes 1 → 2 → 1. |
| M-08 | Grille notée | 11 · Expert | `#/grille/11` | 375 px | — | Fiche du jour (Expert) à vide : bulletin en sur-titre, sans inventaire, relevés sur la grille, échanges du jour en liste. |
| M-09 | Indices | 902 · Galerie · Prix et relevés empilés (fictive) | `#/grille/902` | 375 px | — | Prix et relevés : quatre prix, trois relevés, un prix et un relevé empilés sur 9h ; barrage au stock limité. |
| M-10 | Indices | 7 · 7. Pompage, relevé et programme | `#/grille/7` | 375 px | — | Flux publiés (exports verrouillés à 0h et 6h), programme, relevé et prix réunis sur un tutoriel, avec la STEP. |
| M-11 | Indices | 901 · Galerie · Programmes, durées et centrale engagée (fictive) | `#/grille/901` | 375 px | — | Programmes (nucléaire, charbon, gaz, dont deux qui se touchent), durées de marche et TAC déjà engagée. |
| M-12 | Indices | 903 · Galerie · Trois voisins sous plafond CO₂ (fictive) | `#/grille/903` | 375 px | pose les 6 premières pièces de la solution (avec ses échanges et sa STEP) | Trois voisins sous plafond CO₂ : flux import et export, échanges du jour par pays, jauge CO₂ en cours de remplissage. |
| M-13 | Centrales | 904 · Galerie · Toutes les centrales et la météo (fictive) | `#/grille/904` | 375 px | pose les 8 premières pièces de la solution (avec ses échanges et sa STEP) | Les cinq centrales, dont nucléaire et gaz de 2 GW de haut, au-dessus des renouvelables et du fil de l’eau. |
| M-14 | Centrales | 13 · 9. Deux épaules se relaient | `#/grille/13` | 375 px | pose la solution sauf les poses 4 | Deux rampes de charbon posées (trapèzes 1 → 2 → 1) qui se relaient, la TAC encore à poser. |
| M-15 | Centrales | 7 · 7. Pompage, relevé et programme | `#/grille/7` | 375 px | choisit STEP ; touche ▲ col. 3 | STEP choisie, pompage ▲ choisi à 9h : flèches ▼ sur les créneaux où turbiner, le message attend le turbinage. |
| M-16 | Centrales | 7 · 7. Pompage, relevé et programme | `#/grille/7` | 375 px | pose les 4 premières pièces de la solution (avec ses échanges et sa STEP) | Paire STEP posée (pompage ▲ à 9h, turbinage ▼ à 12h), exports et imports d’Allemagne posés. |
| M-17 | Centrales | 905 · Galerie · Surplus, stockage et carnet chargé (fictive) | `#/grille/905` | 375 px | — | Surplus de renouvelables à 9h (message d’erreur), carnet exact chargé : barres, TAC, export, import et paire STEP. |
| M-18 | Centrales | 905 · Galerie · Surplus, stockage et carnet chargé (fictive) | `#/grille/905` | 375 px | pose les 3 premières pièces de la solution (avec ses échanges et sa STEP) | Surplus absorbé par la STEP, export verrouillé, import de Belgique posé. |
| M-19 | Interactions | 1 · 1. Poser l’inventaire | `#/grille/1` | 375 px | choisit N ; touche la case (0, 0) | Pose en deux touchers : nucléaire choisi, premier toucher posé, le message attend le second. |
| M-22 | Interactions | 1 · 1. Poser l’inventaire | `#/grille/1` | 375 px | pose N ligne 3 col. 0 ×3 | Pose refusée : message rouge sous la grille, rien n’est posé. |
| M-23 | Interactions | 902 · Galerie · Prix et relevés empilés (fictive) | `#/grille/902` | 375 px | pose les 6 premières pièces de la solution (avec ses échanges et sa STEP) ; pose T ligne 1 col. 5 ×1 | Indices satisfaits (pastilles vertes) ; la TAC posée à 15h contredit le prix et le relevé de 15h (pastilles rouges, message). |
| M-24 | Interactions | 1 · 1. Poser l’inventaire | `#/grille/1` | 375 px | pose les 3 premières pièces de la solution (avec ses échanges et sa STEP) ; outil erase | Gomme active sur une grille à moitié posée. |
| M-25 | Interactions | 903 · Galerie · Trois voisins sous plafond CO₂ (fictive) | `#/grille/903` | 375 px | touche l’export GB col. 0 ; pose T ligne 2 col. 0 ×1 ; touche l’export GB col. 0 ; touche l’export GB col. 0 | Centrale invalide hachurée : l’export qui portait la TAC à 0h a été retiré. |
| M-26 | Verdict | 7 · 7. Pompage, relevé et programme | `#/grille/7` | 375 px | chrono amorcé à 12 min 34 s ; pose toute la solution | Verdict juste sur un vrai tutoriel : bandeau « Programme bouclé », temps, bouton « Grille suivante ». |
| M-27 | Verdict | 11 · Expert | `#/grille/11` | 375 px | chrono amorcé à 12 min 34 s ; pose toute la solution | Verdict juste sur la fiche du jour (grille notée). |
| M-28 | Verdict | 2 · 2. Le prix plafonne la colonne | `#/grille/2` | 375 px | pose la solution en échangeant les poses 2 et 3 | Verdict faux : grille pleine mais le prix de 16h est contredit (barrage et TAC échangés). |
| M-29 | Grilles extrêmes | 906 · Galerie · Grande journée d’hiver sur douze créneaux, avec trois pointes et l’Espagne en renfort (fictive) | `#/grille/906` | 375 px | — | Grande grille de 12 créneaux, titre et relevé très longs, onze indices. |
| M-30 | Grilles extrêmes | 907 · Galerie · Pointe haute sur six créneaux (fictive) | `#/grille/907` | 375 px | — | Grille étroite et haute : six créneaux, pointe à 12 GW. |
| M-31 | Grilles extrêmes | 906 · Galerie · Grande journée d’hiver sur douze créneaux, avec trois pointes et l’Espagne en renfort (fictive) | `#/grille/906` | 375 px | fait défiler la grille à droite | Grande grille défilée vers la droite avec le curseur sous la grille. |
| M-32 | Témoins 320 px | — | `#/` | 320 px | — | Accueil à 320 px. |
| M-33 | Témoins 320 px | 906 · Galerie · Grande journée d’hiver sur douze créneaux, avec trois pointes et l’Espagne en renfort (fictive) | `#/grille/906` | 320 px | — | Grande grille de 12 créneaux à 320 px. |
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
| P-09 | Fiches A4 | 902 · Galerie · Prix et relevés empilés (fictive) | `#/imprimer/902` | A4 | — | Prix et relevés empilés sur un créneau. |
| P-10 | Fiches A4 | 903 · Galerie · Trois voisins sous plafond CO₂ (fictive) | `#/imprimer/903` | A4 | — | Trois voisins, flux, échanges par pays et règle du plafond CO₂. |
| P-11 | Fiches A4 | 904 · Galerie · Toutes les centrales et la météo (fictive) | `#/imprimer/904` | A4 | — | Les cinq centrales, pièces hautes, renouvelables et fil de l’eau. |
| P-12 | Fiches A4 | 905 · Galerie · Surplus, stockage et carnet chargé (fictive) | `#/imprimer/905` | A4 | — | Surplus, STEP, export et import imposés par un carnet exact. |
| P-13 | Fiches A4 | 906 · Galerie · Grande journée d’hiver sur douze créneaux, avec trois pointes et l’Espagne en renfort (fictive) | `#/imprimer/906` | A4 | — | Grande grille de 12 créneaux, onze indices. |
| P-14 | Fiches A4 | 907 · Galerie · Pointe haute sur six créneaux (fictive) | `#/imprimer/907` | A4 | — | Grille haute de six créneaux. |

<!-- views:end -->
