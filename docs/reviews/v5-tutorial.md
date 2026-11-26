# S4.1 — Revue du tutoriel interactif v5

- **Relu** : `git diff main...v2-tutorial-ui` au commit ebe5e9f (inclut `v2-tutorial-grids`). Fichiers lus : `web/src/tutorial/*`, `web/src/ui/tutorial.ts`, les ajouts dans `game.ts`, `home.ts`, `app.ts`, `panels.ts` et `dossiers.ts`, ainsi que `fr.ts`, `app.css`, `check-ui.mjs` et les tests.
- **Références** : le brief, le plan rev-3, la note `docs/next/tutoriel-v5.html` (rév. 4) et les décisions humaines prises après la note.
- **Vérifié dans Chrome** : `npm run build` puis `npm run preview`, avec `check-ui.mjs` et mon propre script Playwright, écrit à part. Il couvre le parcours complet, les rechargements, le clavier, les gestes hors script, « Revoir l'explication », le passage téléphone → ordinateur et les découvertes 15-22.
- **Verdict** : 3 bloquants, 4 à corriger, 7 mineurs. Le garde strict laisse passer un coup qui écrase une centrale déjà posée. « Revoir l'explication » efface la grille du joueur.

## Contrôles du dépôt

| Commande | Résultat |
|---|---|
| `npm test` | OK : 496 tests verts (13 fichiers) |
| `npm run typecheck` | OK |
| `npm run build` | OK |
| `scripts/check_unique.py` | OK : 13 grilles uniques et déductibles (8-11, 14-22) |
| `dispatch-solver check --id N --strict`, N = 14 à 22 | OK pour les 9 grilles : 1 composition, référence identique, déduction résolue. Notes : 14, 15, 18, 19 et 20 Facile ; 16, 17, 21 et 22 Moyen |
| `check-ui.mjs` (1280 / 375 / 320 px) | OK : 285/285 |

## Bloquants

### B1. Un coup guidé « n'importe quelle ligne » peut écraser une centrale déjà posée

- **Cause** : `guide.ts:62-68`. `sameBar` ignore la ligne quand `anyRow` est vrai, et `layAt` pose par `placeOver` (`game.ts:396`), qui remplace les centrales couvertes.
- **Conséquence** : un coup qui remplace une centrale déjà posée est accepté comme coup attendu.
- **Reproduit** :
  - G1 : deux fois le réacteur de 6 sur la ligne 1. Le second remplace le premier (« remplace 1 groupe nucléaire »). L'étape est validée avec un seul réacteur posé (capture `04b-n6-twice-1280.png`).
  - G5 : une TAC à 18h, ligne 2. Elle remplace un gaz de 2 et l'étape avance. Une seconde TAC à la ligne 4 ouvre « Quart bouclé » sur une grille fausse : un gaz manque, une case est vide et le carnet affiche 1/2 (`12-end-with-wrong-board-1280.png`).
- **Pourquoi c'est bloquant** : c'est ce que la tâche interdit (« aucun coup hors script ne modifie l'état »). Le joueur finit le tutoriel sur une grille non résolue, avec un texte qui la dit bouclée.
- **Correctif possible** : dans `gate()`, refuser un `place` qui remplacerait une centrale (`checkPlaceOver(...).replaced` non vide). Ou n'accepter que les lignes des coups attendus encore libres.

### B2. « Revoir l'explication » efface la grille du joueur

- **Cause** : `replay()` (`ui/tutorial.ts:329-336`) appelle `sync()` (`:114-119`). Pour un script de découverte, `expectedBoard()` rend la grille initiale, que `restore()` applique (`game.ts`, hôte de `mountTutorial`). L'historique d'annulation repart de zéro.
- **Reproduit** : sur la grille 15, poser un gaz puis cliquer « Revoir l'explication ». Dans `dispatch:progress:v1`, `bars` passe de 1 centrale à 0, et la grille revient vide (`14-g15-replay-1280.png`, `15-g15-after-replay-1280.png`).
- **Aggravant** : le bouton reste visible sur une grille finie, donc une grille résolue est effacée de la même façon.

### B3. Une grille Premiers pas commencée sur téléphone est vidée à la 1re ouverture sur ordinateur

- **Cause** : même chemin que B2. Sous 1024 px, aucun run n'est enregistré. À ≥ 1024 px, `startRun()` est suivi de `sync()`, qui remet la grille initiale.
- **Reproduit** : sur la grille 16 à 375 px, poser un nucléaire de 3, puis élargir à 1280 px. La découverte s'ouvre et la progression passe de 1 centrale à 0 (`16a-g16-375-played.png`, `16-g16-widened-1280.png`). L'effet est identique pour une fenêtre étroite qu'on agrandit.
- **Correctif commun B2 + B3** : ne synchroniser la grille que pour un script qui a des étapes guidées (l'intro). Une découverte ne touche jamais la grille.

## À corriger

### A1. Le sur-titre compte la bulle de fin parmi la présentation

- **Constat** : il affiche « Présentation · 1 / 8 » … « 7 / 8 », alors qu'il y a 7 bulles de présentation. La bulle de fin affiche « Présentation · 8 / 8 » (`02-present-1-1280.png`, `12-end-with-wrong-board-1280.png`).
- **Attendu par la note** : « 1 / 7 », et un sur-titre « Résolution » sur la bulle de fin.
- **Cause** : `stepRank()` (`guide.ts:111-116`) compte toutes les étapes `present`, la dernière comprise.

### A2. Échap pendant la résolution guidée abandonne tout le tutoriel

- **Cause** : `ui/tutorial.ts:291`. Échap n'est épargné que si le focus est dans la grille.
- **Reproduit** : choisir une centrale dans le carnet (le focus est alors sur le bouton du carnet), puis Échap. Le run passe à `skipped` sans confirmation, la bulle disparaît et seul « Revoir le tutoriel » reste (`07-escape-guided-1280.png`). Pour reprendre, il faut repasser les 7 bulles de présentation.
- **Proposition** : sur une étape guidée, Échap ne fait rien (ou seulement « Passer » si le focus est dans la bulle).

### A3. Clavier : le focus sort de la bulle pendant la présentation

- **Tab** : depuis « Suivant », Tab part vers le `body`, puis vers le logo, la grille, Gomme, Recommencer et le carnet, tous sous le voile. Aucun retour à la bulle.
- **Attributs** : la bulle n'a ni `aria-modal`, ni `inert` sur le reste de la page (`ui/tutorial.ts:89`).
- **Fermeture** : quand la bulle se ferme (Fermer, Passer, fin), le focus tombe sur `body`.
- **Ce qui reste sûr** : Entrée fait avancer où que soit le focus, et les gestes sur la page sont refusés. L'état ne bouge pas, mais un joueur au clavier se perd.
- **Proposition** : piéger Tab dans la bulle sur les étapes `present`, puis rendre le focus à la grille quand la bulle se ferme.

### A4. Après un rechargement, une centrale posée sur l'autre ligne saute de ligne

- **Constat** : `expectedBoard()` rejoue la ligne du script (`guide.ts:131-141`), pas celle que le joueur a choisie.
- **Reproduit** : G1, premier réacteur posé sur la ligne 2, puis rechargement. Le réacteur réapparaît sur la ligne 1.
- **Lien avec B1** : si le joueur repose alors sur la ligne 1, B1 fait finir le tutoriel avec un seul réacteur (`12b-end-after-reload-1280.png`).
- **Proposition** : garder dans le run la ligne effectivement jouée, ou comparer les grilles à permutation de lignes près.

## Mineurs

- **M1. Passer sur la bulle de fin** : « Passer » (et Échap) sur « Quart bouclé » marquent le run `skipped`, pas `finished`, et n'ouvrent pas la grille 15 (`ui/tutorial.ts:220`). Masquer « Passer » sur la dernière bulle.
- **M2. Deux boutons pour la même action** : une découverte d'une seule bulle affiche « Fermer » et « Terminer » (`13-g15-discovery-1280.png`).
- **M3. « Dernier dossier »** : grille 22, `fr.ts:294` et `fr.ts:603`. Dans le jeu, un dossier est le groupe de grilles (Premiers pas). Proposer « Dernière grille ».
- **M4. Outils annoncés puis refusés** : `intro.tools` présente Gomme et Annuler (« À toi, je reste à côté »). Pendant la résolution, les outils sont refusés (« les outils attendent la fin de la résolution »). Une demi-phrase dans `intro.tools` éviterait la surprise.
- **M5. Exemple d'en-tête faux** : l'en-tête de `guide.ts:16` appelle `record(grid, script, run, board, attempt)`, alors que la signature est `record(script, run, result)`.
- **M6. Bulle de G22** : elle se place au-dessus de la ligne IT et couvre la majeure partie de la grille (`20-g22-d1-1280.png`). C'est acceptable pour une bulle de présentation ; `side: 'right'` laisserait la grille visible.
- **M7. 25 mots non testés** : aucun test ne vérifie la limite. Elle tient aujourd'hui : maximum 25 mots (`intro.board`), relevé par un script.

## Vérifié sans écart

- **État**
  - Les runs sont sous `dispatch:tutorial:v1`, jamais sous `dispatch:progress:v1`.
  - Lecture et écriture passent par try/catch (`guide.ts:173-186`, `tutorialStorage`).
  - `validRun()` écarte un run hors script.
- **Garde, hors B1**
  - Un coup décalé d'un créneau est refusé, avec « Pas encore : joue le coup indiqué » (check-ui).
  - Gomme, Annuler et Recommencer sont refusés avec leur message (`09-gomme-refused-1280.png`).
  - Une pose hors silhouette est refusée par le moteur (`04-anyrow-row3-1280.png`).
  - Une étape de présentation bloque la page.
- **Reprise** : un rechargement au milieu de G1 (1 coup sur 2 joué) reprend sur la même étape avec `played: [0]`, hors A4.
- **Parcours complet à 1280 px**
  - Le bouton « Tutoriel » de l'accueil ouvre la grille 14, puis 7 bulles et 5 coups guidés.
  - « Terminer » (au clavier, Entrée) ouvre la grille 15 avec sa découverte.
  - Après la fin, la grille 14 affiche « Revoir le tutoriel ». Le bouton « Tutoriel » relance le tutoriel depuis la 1re bulle.
  - « Passer » laisse la grille jouable, avec « Revoir le tutoriel ».
  - Aucune erreur JS ni console.
- **Découvertes**
  - Elles ne s'ouvrent qu'à la 1re ouverture et ne reviennent pas après un rechargement.
  - Échap ferme une découverte.
  - Les 11 bulles des grilles 15-22 s'affichent sur leur cible (captures `20-*`).
- **Découpes**
  - La production du bas est centrée sur ses cases : anneau de 77 à 569 × 361 à 433, cases de 83 à 563 × 367 à 427, soit 6 px de marge de chaque côté (`02-present-3-1280.png`).
  - Les découpes du carnet, des publications, du bord de grille, des lignes DE et IT, de la STEP, de `chip:C` et de la jauge CO₂ sont justes.
- **375 et 320 px**
  - Pas de bulle, pas de « Revoir » (masqué en CSS), pas de scroll horizontal.
  - L'accueil garde « Comment jouer » (`30-home-375.png`, `30-g14-320.png`, `30-g15-320.png`).
- **Grilles et script**
  - Les 5 coups guidés résolvent la grille 14 (test `tutorial-script.test.ts`).
  - Chaque texte guidé est juste au moment où il est lu : 2 blocs libres à 0h, 1 seul à 15h après les réacteurs, une seule rangée de 3 (6h-15h), 18h-21h pour les gaz de 2, 2 blocs à 18h pour les TAC.
  - L'ordre diffère un peu de la trace : la trace fait « Pas de place » puis le relevé, le script fait l'inverse. Le titre de G1 est le prix (la pose vient de « Un seul groupe pour ce bloc »). Les deux déductions restent valides à ce stade.
- **Textes**
  - La voix du chef de quart est tenue, au tutoiement.
  - Aucun gras, 25 mots au plus partout.
  - « production non pilotable » : la bande du bas n'est plus « du soleil ».
  - Aucune bulle ni grille pour « Le bloc le plus cher », « Deux bords se relaient » ou « Le creux coupe le ruban ».
  - Les gestes décrits ont été vérifiés à l'écran : import posé comme une pièce d'un bloc, charbon haut glissé sur deux lignes, ▲▼ de la STEP, quota CO₂ (4 points, gaz 1, nucléaire 0).
- **Conventions**
  - Code, commentaires et clés en anglais. Textes joueur seulement dans `fr.ts`.
  - En-têtes courts, sur l'état actuel. `GAME-DESIGN.md` §11 et `CLAUDE.md` sont à jour.
  - Les tests choisissent les grilles par propriété (`section`, `kind`, `next`), sans compte en dur.

## Relecture des corrections (S4.3)

- **Relu** : `git diff ebe5e9f..2b7e372` (`guide.ts`, `ui/tutorial.ts`, `script.ts`, `fr.ts`, `check-ui.mjs`, tests).
- **Rejoué** : les reproductions de la review, rejouées dans Chrome sur la build de 2b7e372 (preview). Captures dans `v5-tutorial/fixes/`.
- **Verdict** : les 14 constats sont corrigés, sans régression trouvée. **Prêt à merger.**

### Contrôles du dépôt

| Commande | Résultat |
|---|---|
| `npm test` | OK : 500 tests verts (13 fichiers), dont 4 nouveaux pour B1, A4, B2/B3 et M7 |
| `npm run typecheck`, `npm run build` | OK |
| `scripts/check_unique.py` | OK |
| `check-ui.mjs` | OK : 315/315 |

### Constat par constat

| # | Rejoué | Résultat |
|---|---|---|
| B1 | Deux réacteurs de 6 sur la ligne 1. Une TAC sur un gaz (18h, ligne 2). Une TAC sur la TAC déjà posée | Corrigé : les trois sont refusés (« Pas encore : joue le coup indiqué »), la grille reste inchangée. La fin du tutoriel donne une grille `done` (8 centrales). `gate()` refuse toute pose qui remplacerait une centrale (`checkPlaceOver().replaced`). |
| B2 | Grille 15 : poser un gaz, puis « Revoir l'explication » | Corrigé : la grille est gardée pendant et après la bulle (`b2-g15-after-replay-1280.png`). |
| B3 | Grille 16 : un nucléaire posé à 375 px, puis élargir à 1280 px | Corrigé : la découverte s'ouvre et la centrale reste (`b3-g16-widened-1280.png`). `touchesBoard()` limite la synchronisation de la grille à l'intro. |
| A1 | Sur-titres de l'intro | Corrigé : « Présentation · 1 / 7 » … « 7 / 7 », puis « Résolution · k / 5 ». La bulle de fin affiche « Résolution » (`a1-end-1280.png`). |
| A2 | Échap pendant la résolution, focus sur une centrale du carnet | Corrigé : la bulle reste. Échap depuis la bulle elle-même passe le tutoriel, ce qui est voulu. |
| A3 | Tab sur une bulle de présentation ; focus à la fermeture | Corrigé : Tab reste dans la bulle et `aria-modal` est posé. À la fermeture, le focus revient sur la grille (`.board-wrap`). |
| A4 | 1er réacteur posé sur la ligne 2, puis rechargement | Corrigé : il reste sur la ligne 2 (`rows: {"7:0": 2}` dans le run). Le second se pose sur la ligne 1. |
| M1 | Bulle de fin | Corrigé : pas de « Passer ». Échap termine le run (`finished`) et ouvre la grille 15. |
| M2 | Découverte d'une bulle (grille 15) | Corrigé : seul « Terminer » est affiché. |
| M3 | Grille 22 | Corrigé : « Dernière grille » dans le texte de la grille et dans la bulle. |
| M4 | `intro.tools` | Corrigé : « Ils serviront ensuite : d'abord, on résout ensemble. » (23 mots). |
| M5 | En-tête de `guide.ts` | Corrigé : l'exemple suit les signatures (`applyMove`, `record(script, run, g)`). |
| M6 | Grille 22 | Corrigé : bulle à droite, grille dégagée (`m6-g22-1280.png`). |
| M7 | Limite de 25 mots | Corrigé : un test Vitest vérifie chaque bulle. |

### Relecture du diff

- **`rows`**
  - Le run garde la ligne choisie, clé `<étape>:<coup>`.
  - Il est validé à la lecture (`isRun`) et conservé par `next()` et `skip()`.
  - `startRun()` le remet à zéro, à la relance comme au bouton « Tutoriel ».
  - `expectedBoard()` le rejoue.
- **Refus d'une pose qui écraserait** : il ne joue que pendant une étape guidée de l'intro, car `guard()` rend `OPEN` quand la bulle est cachée. Le jeu libre et les découvertes ne changent pas.
- **Clavier**
  - Le piège de Tab et la gestion d'Entrée ne valent que sur une étape de présentation.
  - Sur une étape guidée, le clavier reste au jeu : curseur de la grille, Échap qui annule un geste.

### Réserve de s2 : « Revoir le tutoriel » remet la grille 14 à zéro

- **Rejoué** : sur une grille 14 finie, « Revoir le tutoriel » vide la grille. Le statut reste `done` dans `dispatch:progress:v1`, même après « Passer » et un rechargement (`reserve-g14-reload-1280.png`).
- **Avis : acceptable.**
  - Le geste est explicite et son libellé dit qu'on refait le tutoriel.
  - La résolution guidée doit repartir de la grille vide.
  - La grille 14 n'est dans aucun dossier, et son statut `done` n'est pas perdu.
- **Seul effet visible** : une grille 14 marquée finie mais affichée vide si le joueur passe le tutoriel relancé. C'est cohérent avec un nouveau départ.
