# Textes à valider : accueil, dossier, vocabulaire (R6, R8)

Branche `v3-web-home`. Rien de ceci n'est intégré avant ta réponse.

## R6 : vocabulaire banni (« rampe », « épaule », « inventaire »)

Choix proposés (recommandation) :
- **rampe** → **escalier** (« charbon en escalier ») ; la barre normale reste « barre ».
- **épaule** → **marche** (les extrémités d'un escalier).
- **inventaire** → **carnet** (le panneau s'appelle déjà « Carnet d'ordres »).

| Où | Actuel | Proposé |
|---|---|---|
| Règles, 2 | « Le charbon peut démarrer en rampe. » | « Le charbon peut monter ou descendre en escalier. » |
| Erreur dépassement | « La rampe dépasse de la grille. » | « L'escalier dépasse de la grille. » |
| Erreur longueur | « Une rampe de charbon fait 3 à 5 créneaux. » | « Un escalier de charbon fait 3 à 5 créneaux. » |
| Erreur carnet (barre) | « Plus de barre/rampe Gaz de 4 créneaux dans l'inventaire. » | « … dans le carnet. » (rampe → escalier) |
| Erreur carnet (cases) | « Plus de case Gaz dans l'inventaire (6 au total). » | « … dans le carnet (6 au total). » |
| Erreurs imports/exports | « Plus d'import/d'export … dans l'inventaire (…) » | « … dans le carnet (…) » |
| Technique `exhausted` | « Inventaire épuisé » | « Carnet épuisé » |
| Technique `just_enough` | « Inventaire juste » + « …tous sont à elle » | « Carnet juste » (texte inchangé) |
| Technique `share_out` | « Répartition de l'inventaire » | « Répartition du carnet » |
| Technique `single_spot` | « Une barre de l'inventaire qui n'a plus… » | « Une barre du carnet qui n'a plus… » |
| Technique `ramp_plateau` | « Le plateau barre la ligne du dessus » / « la rampe occupe aussi la ligne suivante » | titre inchangé ; « l'escalier occupe aussi… » |
| Technique `ramp_shoulder` | « L'épaule appelle une case » / « …au-dessus d'une épaule… » | « La marche appelle une case » / « …au-dessus d'une marche… » |
| Technique `ramp_lone` | « Une case seule est une épaule » | « Une case seule est une marche » (« escalier » dans le texte) |
| Technique `ramp_relay` | « Deux épaules se relaient » | « Deux marches se relaient » |
| Dossier « Premiers pas » | « …avec l'inventaire exact. » | supprimé (R7), voir R8 |
| `noInventory` | « sans inventaire » | « sans liste exacte » |
| Indication carnet (`pieceHint`) | « rampe de 3 à 5 créneaux » | « escalier de 3 à 5 créneaux » |
| Libellé de pose | « Charbon en rampe de 4h à 8h, base ligne 2 » | « Charbon en escalier de 4h à 8h, base ligne 2 » |
| « Remplace… » | « 1 rampe de charbon » | « 1 escalier de charbon » |
| Grille 1 (titre) | « 1. Poser l'inventaire » | « 1. Poser le carnet » |
| Grille 3 (titre) | « 3. Inventaire juste » | « 3. Carnet juste » |
| Grille 12 (titre) | « 8. La rampe de charbon » | « 8. L'escalier de charbon » |
| Grille 13 (titre) | « 9. Deux épaules se relaient » | « 9. Deux marches se relaient » |
| Grilles 1, 3, 8–13 (intro) | « inventaire », « rampe », « épaules » | mêmes remplacements, phrase par phrase |

Alternative si « escalier » ne te plaît pas : « palier » (rampe → « charbon par paliers », épaule → « bord »).

## R8 : descriptions des cartes du dossier, en roleplay

Voix : le chef de quart qui briefe le joueur au poste de dispatching. Une phrase, tutoiement.
Aujourd'hui la carte affiche la phrase technique (colonne « actuel », résumée). Proposé :

| Technique | Actuel (résumé) | Proposé |
|---|---|---|
| swap (grille 1) | Cases interchangeables | « Premier quart : le carnet est exact, tu poses tout, ni plus ni moins. » |
| price_cap (2) | Le prix plafonne la colonne | « La bourse affiche un prix : aucune centrale plus chère n'a sa place sous ce créneau. » |
| just_enough (3) | Inventaire juste | « La ligne vers l'Allemagne s'ouvre : exporte juste ce qu'il faut pour boucler. » |
| ribbon (4) | Le creux coupe le ruban | « Le nucléaire tourne en ruban : repère où la demande creuse et où il peut passer. » |
| flow + column_sum (5) | Flux publié, compter la colonne | « Berlin annonce son échange : compte ta colonne, la dernière case se déduit. » |
| top_price (6) | La case la plus chère | « La bourse exige une centrale chère sur ce créneau : trouve où elle peut tourner. » |
| silhouette + record + program (7) | Pompage, relevé, programme | « La STEP entre en scène : pompe la nuit, turbine au pic, et suis le programme de RTE. » |
| ramp_plateau + ramp_shoulder (12) | Le plateau barre la ligne du dessus | « Le charbon monte et descend en escalier : surveille ses marches. » |
| ramp_relay (13) | Deux marches se relaient | « Deux escaliers de charbon se croisent : l'un s'arrête, l'autre démarre. » |

Les grilles notées (8 à 11) n'ont pas de carte de dossier ; l'accueil n'est pas touché par R8.

## R7 / dossier « Premiers pas »
La phrase d'introduction est retirée de la page du dossier (R7). La carte d'accueil ne l'affiche pas non plus : la chaîne `lead` peut donc disparaître de `fr.ts`.

## Décision (réponse q262)
Vocabulaire « palier » retenu : rampe → barre à paliers / charbon par paliers, épaule → bord, inventaire → carnet (« sans carnet exact » pour les grilles sans liste). Phrases roleplay R8 intégrées, avec « paliers » et « bords » pour les grilles de charbon. Texte dans `web/src/i18n/fr.ts` (`UI.briefing`, `MSG`, `TECHNIQUES`) et `web/src/data/grids.json` (titres et intros des grilles 1, 3, 8 à 13).
