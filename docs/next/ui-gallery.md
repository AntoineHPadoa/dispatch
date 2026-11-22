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
- **Galeries web et mobile refaites sur le jeu actuel** (corrections R1 à R22, version téléphone, carnet par taille) : toutes les vues se rejouent, aucune n'est retirée ; W-34/W-35 et M-35/M-36 montrent le carnet chargé (grille 908) et la hauteur optionnelle (grille 910). Les légendes sont dans `showsW` et `showsM` (`views.mjs`), écrites d'après les images ; la galerie papier n'est pas régénérée (`--kinds web,mobile`).
- **Témoins 320 px** : accueil, grande grille, verdict (M-32 à M-34).
- **Hors périmètre** : animations, gestes (seul leur état figé est montré), lab, tablette, mode sombre.

## Slider de défilement

- Quand la grille est plus large que son cadre, le jeu affiche sous la grille un slider de défilement (`input.board-slider`, `web/src/ui/game.ts`, mis à jour par `syncSlider()`).
- Tableau mesuré par le script sur le build de prod, pour chaque grille publiée : le slider est-il visible à l'ouverture, et de combien de pixels la grille défile.
- **Résultat** : aucune grille publiée ne l'affiche, à aucune des largeurs mesurées. Sur ordinateur, le jeu reste sur une seule colonne (panneaux sous la grille) tant que la grille entière ne tient pas à côté (R17) ; sous 861 px, aucune grille publiée ne déborde de son cadre.
- **Vues** : W-31 à W-33 montrent de vraies grilles à 1024 et 960 px, sans slider ; W-29 la grille fictive de 12 créneaux, qui tient aussi à 1280 px. Sur téléphone, seule la grille fictive de 12 créneaux garde un slider (M-29, M-31, M-33).

<!-- slider:start -->

| Grille | Créneaux | 1280 px | 1024 px | 960 px | 375 px | 320 px |
|---|---|---|---|---|---|---|
| 1 · 1. Poser le carnet | 6 | non | non | non | non | non |
| 2 · 2. Le prix plafonne la colonne | 6 | non | non | non | non | non |
| 3 · 3. Carnet juste | 6 | non | non | non | non | non |
| 4 · 4. Le creux coupe le ruban | 6 | non | non | non | non | non |
| 5 · 5. Flux publié et compter la colonne | 6 | non | non | non | non | non |
| 6 · 6. La case la plus chère | 6 | non | non | non | non | non |
| 7 · 7. Pompage, relevé et programme | 8 | non | non | non | non | non |
| 8 · Facile | 8 | non | non | non | non | non |
| 9 · Moyen | 8 | non | non | non | non | non |
| 10 · Difficile | 8 | non | non | non | non | non |
| 11 · Expert | 8 | non | non | non | non | non |
| 12 · 8. Le charbon par paliers | 6 | non | non | non | non | non |
| 13 · 9. Deux bords se relaient | 8 | non | non | non | non | non |

<!-- slider:end -->

## Vues

<!-- views:start -->

### web

| Vue | Catégorie | Grille | Route | Largeur | Actions | Ce qu’elle montre |
|---|---|---|---|---|---|---|
| W-01 | Accueil | — | `#/` | 1280 px | — | Accueil au premier passage : fiche du jour n° 214 non jouée (tampon « À servir », bouton à contour « Prendre le quart », sans pastilles de centrales) ; quarts précédents, dossier « Premiers pas » à 0 / 9 ; « Imprimer toutes les grilles » en haut, à côté de « Comment jouer ». |
| W-02 | Accueil | — | `#/` | 1280 px | ouvre « Comment jouer » | Accueil avec « Règle du jeu » dépliée au-dessus de la fiche du jour. |
| W-03 | Accueil | — | `#/` | 1280 px | progression : grilles 1, 2, 3, 9, 11 terminées ; grilles 10 commencées | Accueil d’un joueur avancé : fiche du jour bouclée (tampon « Bouclé », solution en couleurs, bouton à contour « Revoir le quart », même style que « Prendre le quart ») ; quart n° 212 bouclé, dossier à 3 / 9. |
| W-04 | Dossier | — | `#/dossier/premiers-pas` | 1280 px | — | Dossier « Premiers pas » neuf : titre sans description, neuf cartes avec une ligne de récit, boutons à contour « Jouer » ; la première marquée « à jouer ensuite ». |
| W-05 | Dossier | — | `#/dossier/premiers-pas` | 1280 px | progression : grilles 1, 2, 3 terminées ; grilles 4 commencées | Dossier en cours : trois cartes terminées (« Revoir »), la quatrième « En cours » et marquée « à jouer ensuite » (« Reprendre »), boutons à contour. |
| W-06 | Tutoriel | 1 · 1. Poser le carnet | `#/grille/1` | 1280 px | — | Premier tutoriel « Poser le carnet » à vide : ligne de récit en italique ; carnet d’ordres par taille, la longueur écrite dans la barre : nucléaire 6 (0 / 2), gaz 2 (0 / 1), TAC 0 / 2 ; aucun indice ; outils Gomme, Annuler, Recommencer. |
| W-07 | Tutoriel | 12 · 8. Le charbon par paliers | `#/grille/12` | 1280 px | — | Tutoriel « Le charbon par paliers » à vide : ligne de récit ; nucléaire en deux tailles, 6 (0 / 1) et 3 (0 / 1), charbon dessiné en paliers de largeur 3 (0 / 1), TAC 0 / 1. |
| W-08 | Grille notée | 11 · Expert | `#/grille/11` | 1280 px | — | Fiche du jour (Expert) à vide : sur-titre « sans carnet exact », nucléaire en barre « 3–6 » (longueurs permises écrites dedans, la fin en pointillé), compteur « 0 / ∞ », pas de ligne d’import ; relevés en pastilles de couleur sous la grille, échanges du jour en liste. |
| W-09 | Indices | 902 · Galerie · Prix et relevés empilés (fictive) | `#/grille/902` | 1280 px | — | Prix et relevés : quatre prix en pastilles « € » et trois relevés en pastilles de couleur, prix et relevé empilés à 9h et 15h ; carnet nucléaire « 3–6 », gaz « 2–3 » et TAC en « 0 / ∞ », barrage « 0 / 3 ». |
| W-10 | Indices | 7 · 7. Pompage, relevé et programme | `#/grille/7` | 1280 px | — | Flux publiés (exports verrouillés à 0h et 6h, ✓ vert en coin de pastille), programme en ligne colorée sous les cases de 15h à 24h, relevé et prix sur la même grille ; carnet avec import d’Allemagne et STEP. |
| W-11 | Indices | 901 · Galerie · Programmes, durées et centrale engagée (fictive) | `#/grille/901` | 1280 px | — | Programmes en lignes colorées sous les cases (nucléaire, charbon, gaz, sur deux lignes, sans pastille de texte), deux durées de marche et TAC déjà engagée (cadenas). |
| W-12 | Indices | 903 · Galerie · Trois voisins sous plafond CO₂ (fictive) | `#/grille/903` | 1280 px | pose les 6 premières pièces de la solution (avec ses échanges et sa STEP) | Trois voisins sous limite CO₂ : publication « Limite CO₂ » réduite à la limite (28 points au plus), flux import et export (✓ en coin), échanges du jour par pays ; jauge continue à 19 points sur 28 avec la légende des coûts par case (charbon 3, import d’Allemagne 3, TAC 2, gaz 1, import du Royaume-Uni 1) ; carnet en barres « 3–6 », « 3–4 », « 2–3 » et une ligne d’import par voisin. |
| W-13 | Centrales | 904 · Galerie · Toutes les centrales et la météo (fictive) | `#/grille/904` | 1280 px | pose les 8 premières pièces de la solution (avec ses échanges et sa STEP) | Les cinq centrales, dont nucléaire, charbon et gaz de 2 GW de haut, posées au-dessus des renouvelables (R) et du fil de l’eau (F), cases imposées hachurées ; dans le carnet, la hauteur optionnelle de 2 GW est dessinée en pointillé au-dessus des barres « 3–6 », « 3–5 » et « 2–3 » ; barrage 2 / 2 barré, TAC non posée. |
| W-14 | Centrales | 13 · 9. Deux bords se relaient | `#/grille/13` | 1280 px | pose la solution sauf les poses 4 | Deux charbons par paliers posés qui se relaient, une case encore vide pour la TAC ; nucléaire 4 (3 / 3) et charbon 4 (2 / 2) barrés dans le carnet. |
| W-15 | Centrales | 7 · 7. Pompage, relevé et programme | `#/grille/7` | 1280 px | choisit STEP ; touche ▲ col. 3 | STEP choisie, pompage ▲ choisi à 9h : flèches ▼ au-dessus des créneaux suivants, le message attend le turbinage. |
| W-16 | Centrales | 7 · 7. Pompage, relevé et programme | `#/grille/7` | 1280 px | pose les 4 premières pièces de la solution (avec ses échanges et sa STEP) | Paire STEP posée (▲ à 9h, ▼ à 12h, sans mots), barrée dans le carnet (1 / 1) ; nucléaire en tailles 4 (0 / 4) et 3 (2 / 3), import d’Allemagne posé à 18h et 21h et barré (2 / 2) ; exports verrouillés à 0h et 6h. |
| W-17 | Centrales | 905 · Galerie · Surplus, stockage et carnet chargé (fictive) | `#/grille/905` | 1280 px | — | Surplus de renouvelables à 9h (case R bordée de rouge, message d’erreur) ; carnet d’ordres exact : nucléaire 3 (0 / 2), gaz 2 (0 / 1), TAC 0 / 2, import de Belgique 0 / 1, STEP 0 / 1 ; l’export de 12h est un flux verrouillé sous la grille. |
| W-18 | Centrales | 905 · Galerie · Surplus, stockage et carnet chargé (fictive) | `#/grille/905` | 1280 px | pose les 3 premières pièces de la solution (avec ses échanges et sa STEP) | Surplus absorbé par la STEP (▲ à 9h, ▼ à 18h), export verrouillé à 12h, import de Belgique posé à 0h ; nucléaire 3 (2 / 2), import (1 / 1) et STEP (1 / 1) barrés dans le carnet. |
| W-19 | Interactions | 1 · 1. Poser le carnet | `#/grille/1` | 1280 px | choisit N ; maintient un glisser de (0, 0) à (0, 5) | Pose à la souris en cours : nucléaire choisi, aperçu valide (vert) de 6 créneaux pendant le glisser ; le pointeur n’apparaît pas sur la capture. |
| W-20 | Interactions | 1 · 1. Poser le carnet | `#/grille/1` | 1280 px | choisit N ; maintient un glisser de (3, 0) à (3, 3) | Aperçu refusé (rouge) : la barre dépasse de la silhouette, le message dit pourquoi. |
| W-21 | Interactions | 1 · 1. Poser le carnet | `#/grille/1` | 1280 px | pose G ligne 0 col. 0 ×2 ; choisit N ; maintient un glisser de (0, 0) à (0, 5) | Pose par-dessus : l’aperçu du nucléaire remplace le gaz déjà posé (gaz pâli), message « remplace 1 barre de gaz ». |
| W-22 | Interactions | 1 · 1. Poser le carnet | `#/grille/1` | 1280 px | pose N ligne 3 col. 0 ×3 | Pose refusée : message rouge sous la grille, rien n’est posé. |
| W-23 | Interactions | 902 · Galerie · Prix et relevés empilés (fictive) | `#/grille/902` | 1280 px | pose les 6 premières pièces de la solution (avec ses échanges et sa STEP) ; pose T ligne 1 col. 5 ×1 | Indices satisfaits (✓ vert en coin de pastille et dans la liste) ; la TAC posée à 15h contredit le prix et le relevé de 15h (petite icône rouge en coin, ! rouge dans la liste, message). |
| W-24 | Interactions | 1 · 1. Poser le carnet | `#/grille/1` | 1280 px | pose les 3 premières pièces de la solution (avec ses échanges et sa STEP) ; outil erase | Gomme active (bouton à contour foncé) sur une grille à moitié posée : message « Gomme : touche une centrale pour la retirer » ; nucléaire 6 (2 / 2) et gaz 2 (1 / 1) barrés dans le carnet. |
| W-25 | Interactions | 903 · Galerie · Trois voisins sous plafond CO₂ (fictive) | `#/grille/903` | 1280 px | touche l’export GB col. 0 ; pose T ligne 2 col. 0 ×1 ; touche l’export GB col. 0 ; touche l’export GB col. 0 | Centrale invalide hachurée en rouge : l’export qui portait la TAC à 0h a été retiré ; jauge CO₂ à 2 points sur 28, avec sa légende des coûts. |
| W-26 | Verdict | 7 · 7. Pompage, relevé et programme | `#/grille/7` | 1280 px | chrono amorcé à 12 min 34 s ; pose toute la solution | Verdict juste sur un vrai tutoriel : bandeau « Programme bouclé », 12 min 34 s, bouton « Grille suivante » seul ; ✓ en coin de chaque pastille, cases exportées en contour pointillé dans le nucléaire, carnet barré. |
| W-27 | Verdict | 11 · Expert | `#/grille/11` | 1280 px | chrono amorcé à 12 min 34 s ; pose toute la solution | Verdict juste sur la fiche du jour : dernière grille notée, bouton « Accueil » seul ; ✓ en coin des relevés, cases exportées en contour pointillé. |
| W-28 | Verdict | 2 · 2. Le prix plafonne la colonne | `#/grille/2` | 1280 px | pose la solution en échangeant les poses 2 et 3 | Verdict faux : grille pleine, mais le prix de 16h est contredit (barrage et TAC échangés) : icône rouge en coin de la pastille, ! dans la liste, message. |
| W-29 | Grilles extrêmes | 906 · Galerie · Grande journée d’hiver sur douze créneaux, avec trois pointes et l’Espagne en renfort (fictive) | `#/grille/906` | 1280 px | — | Grande grille de 12 créneaux, titre et relevé très longs, onze indices : à 1280 px la grille entière tient à côté du panneau, sans slider de défilement ; pastilles de relevé empilées sous les créneaux. |
| W-30 | Grilles extrêmes | 907 · Galerie · Pointe haute sur six créneaux (fictive) | `#/grille/907` | 1280 px | — | Grille étroite et haute : six créneaux, pointe à 12 GW. |
| W-31 | Slider de défilement | 11 · Expert | `#/grille/11` | 1024 px | — | Vraie grille de 8 créneaux dans une fenêtre de 1024 px : elle tient entière à côté du panneau, il n’y a plus de slider de défilement sous la grille. |
| W-32 | Slider de défilement | 11 · Expert | `#/grille/11` | 1024 px | fait défiler la grille à droite | La même grille après avoir poussé son défilement au bout à droite : rien ne bouge, aucun créneau n’est masqué et aucun slider n’apparaît. |
| W-33 | Slider de défilement | 1 · 1. Poser le carnet | `#/grille/1` | 960 px | — | Vraie grille de 6 créneaux dans une fenêtre de 960 px : elle tient entière à côté du carnet, sans slider de défilement. |
| W-34 | Carnet d’ordres | 908 · Galerie · Carnet chargé (fictive) | `#/grille/908` | 1280 px | — | Carnet chargé, exact : nucléaire en deux tailles, 6 (0 / 1) et 4 (0 / 2), avec la hauteur optionnelle de 2 GW en pointillé au-dessus ; barrage 0 / 2 ; charbon par paliers de 3 (0 / 1) ; gaz 3 (0 / 1) et 2 (0 / 1) ; TAC 0 / 2 ; import d’Allemagne 0 / 2. |
| W-35 | Carnet d’ordres | 910 · Galerie · Le soleil en trop (fictive) | `#/grille/910` | 1280 px | — | Hauteur optionnelle : carnet exact où le charbon, imposé en une barre de 3 (0 / 1), montre en pointillé la rangée de sa hauteur possible de 2 GW ; nucléaire 3 (0 / 4), gaz 2 (0 / 3), TAC 0 / 2 ; à l’ouverture, le surplus de 9h est signalé sous la grille. |

### mobile

| Vue | Catégorie | Grille | Route | Largeur | Actions | Ce qu’elle montre |
|---|---|---|---|---|---|---|
| M-01 | Accueil | — | `#/` | 375 px | — | Accueil au premier passage sur téléphone : en-tête avec une icône d’imprimante et « Comment jouer » ; fiche du jour n° 214 non jouée (tampon « À servir », bouton à contour « Prendre le quart ») ; quarts précédents et dossier « Premiers pas » à 0 / 9 empilés dessous. |
| M-02 | Accueil | — | `#/` | 375 px | ouvre « Comment jouer » | Accueil avec « Règle du jeu » dépliée au-dessus de la fiche du jour. |
| M-03 | Accueil | — | `#/` | 375 px | progression : grilles 1, 2, 3, 9, 11 terminées ; grilles 10 commencées | Accueil d’un joueur avancé : fiche du jour bouclée (tampon « Bouclé », solution en couleurs, bouton à contour « Revoir le quart ») ; quart n° 212 bouclé, dossier à 3 / 9. |
| M-04 | Dossier | — | `#/dossier/premiers-pas` | 375 px | — | Dossier « Premiers pas » neuf : neuf cartes empilées, chacune avec une ligne de récit et un bouton à contour « Jouer » ; la première marquée « à jouer ensuite ». |
| M-05 | Dossier | — | `#/dossier/premiers-pas` | 375 px | progression : grilles 1, 2, 3 terminées ; grilles 4 commencées | Dossier en cours : trois cartes terminées (« Revoir »), la quatrième « En cours » et marquée « à jouer ensuite » (« Reprendre »). |
| M-06 | Tutoriel | 1 · 1. Poser le carnet | `#/grille/1` | 375 px | — | Premier tutoriel à vide : ligne de récit ; sous la grille, la barre des centrales (Nucléaire 0/2, Gaz 0/1, TAC 0/2) avec la gomme en icône, puis Annuler et Recommencer ; plus bas, le carnet par taille : nucléaire 6, gaz 2, TAC. |
| M-07 | Tutoriel | 12 · 8. Le charbon par paliers | `#/grille/12` | 375 px | — | Tutoriel « Le charbon par paliers » à vide : barre des centrales Nucléaire 0/2, Charbon 0/1, TAC 0/1 ; carnet : nucléaire 6 (0 / 1) et 3 (0 / 1), charbon par paliers de 3 (0 / 1), TAC 0 / 1. |
| M-08 | Grille notée | 11 · Expert | `#/grille/11` | 375 px | — | Fiche du jour (Expert) à vide : relevés en pastilles de couleur sous la grille, rangée d’export vers l’Allemagne ; une seule puce « Nucléaire », sans compteur ; carnet nucléaire « 3–6 » en « 0 / ∞ » ; échanges du jour en liste. |
| M-09 | Indices | 902 · Galerie · Prix et relevés empilés (fictive) | `#/grille/902` | 375 px | — | Prix et relevés : prix en pastilles courtes « €N », « €T », « €G », « €B » et relevés en pastilles de couleur, empilés à 9h et 15h ; puces sans compteur ; carnet nucléaire « 3–6 », gaz « 2–3 », barrage 0 / 3. |
| M-10 | Indices | 7 · 7. Pompage, relevé et programme | `#/grille/7` | 375 px | — | Flux publiés (exports verrouillés à 0h et 6h, ✓ en coin), programme en ligne colorée sous les cases de 15h à 24h, relevé et prix courts « €N » ; puces Nucléaire 0/7, Import 0/2, STEP 0/1 ; carnet nucléaire 4 (0 / 4) et 3 (0 / 3). |
| M-11 | Indices | 901 · Galerie · Programmes, durées et centrale engagée (fictive) | `#/grille/901` | 375 px | — | Programmes en lignes colorées sous les cases (nucléaire, charbon, gaz), TAC déjà engagée (cadenas) ; durées de marche et programmes en liste ; carnet « 3–6 », « 3–5 », « 2–3 ». |
| M-12 | Indices | 903 · Galerie · Trois voisins sous plafond CO₂ (fictive) | `#/grille/903` | 375 px | pose les 6 premières pièces de la solution (avec ses échanges et sa STEP) | Trois voisins sous limite CO₂ : trois rangées d’échange sous la grille, flux verrouillés avec ✓ ; la barre des centrales montre trois puces « Import » sans nom de pays ; publication « Limite CO₂ » réduite à la limite (28 points au plus) ; jauge continue à 19 points sur 28 avec la légende des coûts par case. |
| M-13 | Centrales | 904 · Galerie · Toutes les centrales et la météo (fictive) | `#/grille/904` | 375 px | pose les 8 premières pièces de la solution (avec ses échanges et sa STEP) | Les cinq centrales, dont nucléaire, charbon et gaz de 2 GW, posées au-dessus des renouvelables (R) et du fil de l’eau (F) hachurés ; carnet avec la hauteur optionnelle de 2 GW en pointillé ; barrage 2 / 2 barré, TAC non posée. |
| M-14 | Centrales | 13 · 9. Deux bords se relaient | `#/grille/13` | 375 px | pose la solution sauf les poses 4 | Deux charbons par paliers posés qui se relaient, une case vide pour la TAC ; puces Nucléaire 3/3 et Charbon 2/2, lignes barrées dans le carnet. |
| M-15 | Centrales | 7 · 7. Pompage, relevé et programme | `#/grille/7` | 375 px | choisit STEP ; touche ▲ col. 3 | STEP choisie (puce STEP active), pompage ▲ choisi à 9h : flèches ▼ au-dessus des créneaux suivants, le message attend le turbinage. |
| M-16 | Centrales | 7 · 7. Pompage, relevé et programme | `#/grille/7` | 375 px | pose les 4 premières pièces de la solution (avec ses échanges et sa STEP) | Paire STEP posée (▲ à 9h, ▼ à 12h) et import d’Allemagne posé à 18h et 21h ; puces Import 2/2 et STEP 1/1, lignes barrées dans le carnet ; nucléaire 4 (0 / 4) et 3 (2 / 3). |
| M-17 | Centrales | 905 · Galerie · Surplus, stockage et carnet chargé (fictive) | `#/grille/905` | 375 px | — | Surplus de renouvelables à 9h (case R bordée de rouge, message d’erreur) ; puces Nucléaire, Gaz, TAC, Import, STEP avec compteurs ; l’export de 12h est un flux verrouillé sous la grille. |
| M-18 | Centrales | 905 · Galerie · Surplus, stockage et carnet chargé (fictive) | `#/grille/905` | 375 px | pose les 3 premières pièces de la solution (avec ses échanges et sa STEP) | Surplus absorbé par la STEP (▲ à 9h, ▼ à 18h), import de Belgique posé à 0h ; nucléaire 3 (2 / 2), import et STEP barrés dans le carnet. |
| M-19 | Interactions | 1 · 1. Poser le carnet | `#/grille/1` | 375 px | choisit N ; touche la case (0, 0) | Pose en deux touchers : nucléaire choisi, premier toucher posé sur 0h (case cerclée), le message attend la case d’arrivée. |
| M-20 | Interactions | 1 · 1. Poser le carnet | `#/grille/1` | 375 px | choisit N ; maintient un glisser de (3, 0) à (3, 3) | Glisser au doigt tenu : aperçu refusé (rouge) d’un nucléaire hors de la silhouette, le message dit pourquoi. |
| M-21 | Interactions | 1 · 1. Poser le carnet | `#/grille/1` | 375 px | pose G ligne 0 col. 0 ×2 ; choisit N ; maintient un glisser de (0, 0) à (0, 5) | Glisser au doigt tenu : l’aperçu du nucléaire remplace le gaz déjà posé (gaz pâli, barré dans le carnet), message « remplace 1 barre de gaz ». |
| M-22 | Interactions | 1 · 1. Poser le carnet | `#/grille/1` | 375 px | pose N ligne 3 col. 0 ×3 | Pose refusée : message rouge sous les outils, rien n’est posé. |
| M-23 | Interactions | 902 · Galerie · Prix et relevés empilés (fictive) | `#/grille/902` | 375 px | pose les 6 premières pièces de la solution (avec ses échanges et sa STEP) ; pose T ligne 1 col. 5 ×1 | Indices satisfaits (✓ vert en coin) ; la TAC posée à 15h contredit le prix et le relevé de 15h (icônes rouges en coin, ! dans la liste, message). |
| M-24 | Interactions | 1 · 1. Poser le carnet | `#/grille/1` | 375 px | pose les 3 premières pièces de la solution (avec ses échanges et sa STEP) ; outil erase | Gomme active (icône cerclée au bout de la barre des centrales) : message « Gomme : touche une centrale pour la retirer » ; nucléaire 6 et gaz 2 barrés dans le carnet. |
| M-25 | Interactions | 903 · Galerie · Trois voisins sous plafond CO₂ (fictive) | `#/grille/903` | 375 px | touche l’export GB col. 0 ; pose T ligne 2 col. 0 ×1 ; touche l’export GB col. 0 ; touche l’export GB col. 0 | Centrale invalide hachurée en rouge à 0h : l’export qui la portait a été retiré ; trois puces « Import » sans nom de pays ; jauge CO₂ à 2 points sur 28 avec la légende des coûts. |
| M-26 | Verdict | 7 · 7. Pompage, relevé et programme | `#/grille/7` | 375 px | chrono amorcé à 12 min 34 s ; pose toute la solution | Verdict juste sur un vrai tutoriel : bandeau « Programme bouclé », 12 min 34 s, bouton « Grille suivante » ; ✓ en coin des pastilles, carnet barré. |
| M-27 | Verdict | 11 · Expert | `#/grille/11` | 375 px | chrono amorcé à 12 min 34 s ; pose toute la solution | Verdict juste sur la fiche du jour : bouton « Accueil » seul ; ✓ en coin des relevés. |
| M-28 | Verdict | 2 · 2. Le prix plafonne la colonne | `#/grille/2` | 375 px | pose la solution en échangeant les poses 2 et 3 | Verdict faux : grille pleine, prix de 16h contredit (barrage et TAC échangés) : icône rouge en coin de « €B », ! dans la liste, message. |
| M-29 | Grilles extrêmes | 906 · Galerie · Grande journée d’hiver sur douze créneaux, avec trois pointes et l’Espagne en renfort (fictive) | `#/grille/906` | 375 px | — | Grande grille de 12 créneaux, plus large que l’écran : slider de défilement sous la grille, au début ; pastilles de relevé et de prix sous les créneaux. |
| M-30 | Grilles extrêmes | 907 · Galerie · Pointe haute sur six créneaux (fictive) | `#/grille/907` | 375 px | — | Grille étroite et haute : six créneaux, pointe à 12 GW ; pastilles « €N » et « €TAC ». |
| M-31 | Grilles extrêmes | 906 · Galerie · Grande journée d’hiver sur douze créneaux, avec trois pointes et l’Espagne en renfort (fictive) | `#/grille/906` | 375 px | fait défiler la grille à droite | Grande grille défilée vers la droite : slider de défilement sous la grille poussé au bout, premiers créneaux masqués. |
| M-32 | Témoins 320 px | — | `#/` | 320 px | — | Accueil à 320 px : en-tête avec l’icône d’imprimante, fiche du jour non jouée. |
| M-33 | Témoins 320 px | 906 · Galerie · Grande journée d’hiver sur douze créneaux, avec trois pointes et l’Espagne en renfort (fictive) | `#/grille/906` | 320 px | — | Grande grille de 12 créneaux à 320 px, slider de défilement sous la grille ; titre sur cinq lignes. |
| M-34 | Témoins 320 px | 7 · 7. Pompage, relevé et programme | `#/grille/7` | 320 px | chrono amorcé à 12 min 34 s ; pose toute la solution | Verdict juste à 320 px : bandeau « Programme bouclé », bouton « Grille suivante », carnet nucléaire 4 et 3 barrés sur deux lignes. |
| M-35 | Carnet d’ordres | 908 · Galerie · Carnet chargé (fictive) | `#/grille/908` | 375 px | — | Carnet chargé, exact : puces Nucléaire 0/3, Barrage 0/2, Charbon 0/1, Gaz 0/2, TAC 0/2, Import 0/2 sur trois rangs ; carnet : nucléaire 6 (0 / 1) et 4 (0 / 2) avec la hauteur optionnelle en pointillé, charbon par paliers de 3, gaz 3 et 2. |
| M-36 | Carnet d’ordres | 910 · Galerie · Le soleil en trop (fictive) | `#/grille/910` | 375 px | — | Hauteur optionnelle : charbon imposé en une barre de 3 (0 / 1), sa rangée possible de 2 GW en pointillé dans le carnet ; surplus de 9h signalé ; puces avec compteurs. |

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
