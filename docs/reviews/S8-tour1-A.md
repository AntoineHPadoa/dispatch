# S8.1 — Grande review v2, tour 1, partie A : jeu, clics, cohérence visuelle

- **Relu** : `main` au commit 93de017, joué comme un joueur exigeant et regardé comme un designer. Le code, la doc et le solveur sont couverts par la review rvb.
- **Banc** : build de production (`vite preview`, port 4672) pour le jeu ; `lab/run.sh` (serveur 8765 + Vite 5173) pour le labo. Chrome piloté par Playwright, 1280 px souris, 375 et 320 px tactile, `deviceScaleFactor` 2.
- **Scripts** (nouveaux, dans `S8-tour1-A/scripts/`) :
  - `play.mjs` : les 13 grilles × 3 largeurs, de l'ouverture au verdict ;
  - `nav.mjs` : accueil, dossier, règles, navigation, clavier, impression ;
  - `lab.mjs` : labo ;
  - `solve-helper.mjs` : pose d'une case, d'une barre ou de la solution ;
  - `probe.mjs` : sondes DOM ponctuelles.
- **Date du jeu** : 2026-11-21, donc la fiche du jour est G11 (n° 214). La grille non publiée est testée en reculant l'horloge au 2026-11-19.
- **Dépôt** : `npm test` 367 tests verts, `npm run typecheck` OK. `check_unique.py` n'a pas été lancé : `grids.json` n'a pas changé et le worktree n'a pas de `solver/.venv`.
- **Verdict** : 418 contrôles automatiques, 416 OK. Les 2 KO sont expliqués plus bas et ne sont pas des défauts du jeu. Constats : **0 bloquant, 5 à corriger, 12 mineurs**.

## Liste fixe (écrite avant de jouer)

| # | Parcours | 1280 | 375 | 320 |
|---|---|---|---|---|
| 1 | Accueil à froid : fiche du jour G11, tampon « À servir », 3 quarts précédents, aucun scroll horizontal, aucun texte superposé | OK (puces absentes, constat 2) | OK | OK |
| 2 | « Comment jouer » ouvre les règles (`aria-expanded` passe à true) | OK | OK | OK |
| 3 | Dossier « Premiers pas » : 9 fiches, progression, « À jouer ensuite » sur la 1re | OK (texte « Sept », constat 3) | OK | OK |
| 4 | Retour arrière du navigateur : dossier → accueil, quart précédent → accueil | OK | OK | OK |
| 5 | Logo à la même place sur l'accueil et sur la grille ; clic sur le logo → accueil | OK | OK | OK |
| 6 | URL directe `#/grille/4` puis rechargement ; `#/grille/99` et `#/dossier/inconnu` → accueil | OK | OK | OK |
| 7 | Grille non publiée (horloge au 19/11) : fiche du jour G9, `#/grille/11` inaccessible, `#/imprimer/tout` donne 11 feuilles | OK | OK | OK |
| 8 | 13 grilles, chacune : ouvrir, poser la 1re barre, la gommer, annuler (elle revient), recommencer (plateau vide) | OK 13/13 | OK 13/13 | OK 13/13 |
| 9 | 13 grilles : solution de `grids.json` jusqu'au verdict « Programme bouclé ». Couvre l'export (G3-G6, G8-G11), l'import, le pompage/turbinage (G7) et la rampe (G12, G13) | OK 13/13 | OK 13/13 | OK 13/13 |
| 10 | Aucun scroll horizontal à l'ouverture ni après le verdict ; aucune erreur JS ni console | OK 13/13 | OK 13/13 | OK 13/13 |
| 11 | « Grille suivante » après un tutoriel (G7 → G12 → G13 → fiche du jour) ; G11 bouclée → « Accueil » | OK | OK | OK |
| 12 | Fiche du jour bouclée : tampon « Bouclé », solution dessinée sur la fiche, bouton « Revoir le quart » | OK (constat 6) | OK | OK |
| 13 | Impression G7, G11, G13 : 1 page A4 chacune ; `#/imprimer/tout` : 13 pages | OK | — | — |
| 14 | Labo, lot `nuit-jouer-a` : table de 20 candidates, jeu à l'aveugle (ni note ni technique), solution jusqu'au verdict, « Terminer », note perçue, révélation, « Garder » | OK (constats 5, 9, 10, 11, 12) | — | — |
| 15 | Labo, lot `nuit-rampe` : une candidate à rampe se joue jusqu'au verdict | OK | — | — |
| 16 | Labo, lot `nuit-jouer-b` à 375 px : même parcours | — | OK | — |
| 17 | Labo : aucune promotion, données du run effacées (`lab/notes.json`, `lab/plays.jsonl` supprimés) | OK | — | — |
| 18 | Clavier : ordre de tabulation sur l'accueil, anneau de focus visible ; une barre posée sur G1 avec flèches + Entrée | OK | — | — |
| 19 | Libellés : aucun bouton ni lien sans nom accessible (accueil, dossier, G7, G12) ; `lang="fr"` ; cibles ≥ 24 px | OK (barres de progression sans nom, constat 13) | OK | — |

**Les 2 KO, sans défaut du jeu** :
- **Tabulation** : après le dernier lien, le focus quitte la page vers le navigateur (`body`), donc sans anneau. C'est attendu.
- **Labo** : `Failed to load resource: 404`. C'est `/favicon.ico`, car `lab.html` ne déclare pas d'icône (mineur 11).

**Mesures** : `play-results.json` (312 contrôles), `nav-results.json` (82), `lab-results.json` (24).

## Constats

### Bloquant

Aucun. Les 13 grilles se jouent jusqu'au verdict aux trois largeurs, à la souris, au doigt et au clavier, sans erreur console ni scroll horizontal.

### À corriger

**1. Le verdict compte moins d'indices que le panneau des publications**
- **Où** :
  - `web/src/ui/game.ts:277` passe `grid.clues.length` à `UI.doneText` (`web/src/i18n/fr.ts:430`) ;
  - le panneau ajoute « Échanges du jour », tiré de l'inventaire exact (`inventoryExchanges`, `web/src/ui/panels.ts:210`).
- **Effet** :
  - G7 : « les 6 indices sont vrais » sous « 7 sur 7 vérifiés » ;
  - G3 et G4 : « Toutes les cases sont couvertes. » alors que le panneau affiche « 1 sur 1 vérifié » ;
  - même écart sur G5 et G6, qui ont des échanges en inventaire exact.
- **Captures** : `S8-tour1-A/g7-solved-1280.png`, `g3-solved-1280.png`.
- **Correction** : compter les indices affichés, avec la même liste que le panneau : `grid.clues.length + (inventoryExchanges(grid) ? 1 : 0)` (`panels.ts:210`, `withInventoryExchanges` l. 231). Ajouter un test sur G3 et G7.

**2. Accueil sur ordinateur : la rangée de puces des centrales de la fiche du jour est masquée**
- **Où** :
  - `web/src/styles/app.css:241` : `.chips { display: none; }` vise la rangée de puces de la page de grille, mais masque aussi `ul.chips` de la fiche (`web/src/ui/home.ts:43`) ;
  - sous 860 px, la règle téléphone (`app.css:256`) la réaffiche.
- **Effet** : à 1280 px, la fiche C1 n'a pas sa « rangée de pastilles neutres » (brief §3). Elle apparaît à 375 et 320 px.
- **Captures** : `home-1280.png` (sans puces), `home-375.png` (avec).
- **Historique** : déjà relevé dans `S7-finition.md` (l. 62-65), toujours présent.
- **Correction** : renommer la liste de l'accueil (`.plant-chips`) et lui donner ses propres règles.

**3. Dossier « Premiers pas » : le chapeau annonce « Sept grilles guidées » pour 9 grilles**
- **Où** : `web/src/i18n/fr.ts:333`.
- **Captures** : `dossier-1280.png` (« 0 / 9 terminées » juste dessous).
- **Correction** : « Neuf grilles guidées… ». Mieux : écrire le chapeau sans nombre, puisque la carte de l'accueil affiche déjà « 9 grilles ».

**4. Règle du jeu : « Une centrale est un rectangle »**
- **Où** : `web/src/i18n/fr.ts:311`.
- **Effet** : depuis les tutoriels 8 et 9, la rampe de charbon est un trapèze. La règle affichée par « Comment jouer » contredit ce que le joueur pose.
- **Capture** : `home-rules-375.png`.
- **Correction** : « Une centrale a une forme fixe : sa largeur est sa durée de marche, sa hauteur sa puissance (le charbon peut démarrer en rampe). » Ou ajouter une 4e règle courte sur la rampe.

**5. Labo : les noms des techniques révélées ne sont pas ceux du jeu**
- **Où** : `web/src/lab/logic.ts:60-65` (`TECHNIQUE_LABELS`).
- **Effet** :
  - après la note, le labo affiche « Record », « Somme de colonne », « Épuisement », « Place », « Couverture unique » ;
  - le jeu, `GAME-DESIGN.md` §9 et `TECHNIQUES` de `fr.ts` disent « Le relevé compte les cases », « Compter la colonne », « Inventaire épuisé », « Pas de place », « Une seule barre pour cette case » ;
  - « Record » est un contresens pour un relevé ;
  - les 4 techniques de rampe sont absentes de la table, donc affichées par leur id.
- **Capture** : `lab-end-nuit-jouer-a-1280.png`.
- **Correction** : construire les libellés à partir de `TECHNIQUES` (`fr.ts`), avec au besoin un nom court par technique, au lieu d'une seconde table.

### Mineurs

**6. Fiche du jour bouclée : les exports débordent de la silhouette sans marque**
- Sur `home-solved-*.png`, les colonnes 9h et 21h de G11 montent d'une case au-dessus de la demande. Ce sont les exports, dessinés comme du nucléaire.
- Sur la grille, un export a sa case violette en pointillé ; ici rien ne l'explique.
- Correction : contour en pointillé, ou une case neutre pour l'export sur la silhouette bouclée (`web/src/ui/home-art.ts`).

**7. Feuille imprimée G7**
- « Aujourd'hui : 2 blocs exportés… » garde le soulignement pointillé de l'écran sous les nombres, sans objet sur papier.
- Le titre « Publications du marché » apparaît deux fois, à gauche (« par créneau ») et à droite.
- Capture : `pdf-7.png`.
- Correction :
  - retirer le soulignement en `@media print` ou dans le rendu papier (`web/src/styles/print.css`) ;
  - titrer le bloc de droite « Bilan du jour », ou fusionner les deux.

**8. Typographie : espaces insécables manquantes**
- À 375 px, le bulletin de G11 coupe « 6 / GW » en fin de ligne (`home-rules-375.png`). Texte : `web/scripts/bulletins.ts:36`.
- Correction : insécable entre nombre et unité dans les bulletins et dans `fr.ts`, et fine insécable devant « : ».

**9. Labo : la dernière colonne de la table est cachée à 1280 px**
- Effet :
  - `.lab-tbl table { min-width: 760px }` (`web/src/lab/lab.css:35`) ;
  - la table fait 949 px dans 914 px, et la colonne ☆ défile hors champ ;
  - sous macOS, aucune barre de défilement ne le signale (« P… » coupé dans `lab-list-nuit-jouer-a-1280.png`).
- Correction : retirer `white-space: nowrap` sur la colonne Mécaniques ou réduire son contenu, pour que la table tienne à 1280 px.

**10. Labo, fiche de candidate**
- Une candidate sans indice affiche « Indices 0 () » (`web/src/lab/list.ts:74`, `lab-detail-nuit-jouer-b-375.png`).
- « Rampe : pas encore jouable dans le jeu. » (`list.ts:75`) ne vaut plus que pour l'escalier : le trapèze se joue (`lab/lab_server.py:72-76`).
- Correction : n'écrire la parenthèse que si le profil n'est pas vide ; « Escalier : pas encore jouable dans le jeu. »

**11. Labo : `lab.html` n'a pas de favicon**
- Chrome demande `/favicon.ico`, ce qui donne une erreur 404 dans la console.
- Correction : `<link rel="icon" href="icon.svg">` comme `index.html:8`.

**12. Labo : « Valider et révéler » garde l'air d'un bouton actif une fois désactivé**
- Après la révélation, le bouton est `disabled` mais reste en encre pleine (`lab-end-*.png`).
- Correction : style `:disabled` atténué sur `.lab-btn.pri`.

**13. Barres de progression sans nom accessible**
- `role="progressbar"` de la carte de dossier et de la page du dossier (`web/src/ui/home.ts:68` et `:128`), sans `aria-label`.
- Le lecteur d'écran annonce « 0 » seul.
- Correction : `aria-label` = `UI.dossierDone(done, total)`.

**14. Carnet : unités inégales**
- « ruban de 3 à 6 » (sans unité) côtoie « rampe de 3 à 5 créneaux » et « 2 à 3 créneaux » (`g13-start-375.png`, `g12-solved-375.png`).
- Correction : « ruban de 3 à 6 créneaux », ou retirer « créneaux » partout. Textes dans `fr.ts`.

**15. Intro du tutoriel 3 : « Touche une pastille sous un créneau pour exporter »**
- Dans le jeu, « pastille » désigne les indices sous les heures. L'export se fait sur une case en pointillé de la rangée DE.
- L'aide du jeu dit d'ailleurs « Exporte en touchant une case de la rangée du voisin ».
- Où : `web/src/data/grids.json:300` (repris par `npm run convert`).
- Correction : « Touche une case de la rangée DE sous la grille pour exporter un bloc ».

**16. Barre d'outils à 1280 px sur une grille de 6 créneaux : « Imprimer » passe seul sur une 2e ligne**
- Capture : `kbd-g1.png`. Effet visuel seulement.
- Correction : `flex-wrap` avec `justify-content: center` sur une ligne quand la carte est étroite, ou réduire le padding de `.tool`.

**17. Observation pour rvb : la candidate 1 de `nuit-rampe` est quasi triviale**
- 2 étapes, une seule technique (« Épuisement ×2 »), aucun indice, note Facile (`lab-end-nuit-rampe-1280.png`).
- Elle a passé le rejet `trivial`. À regarder côté générateur.

## Cohérence visuelle

- **Palette V1 tenue** :
  - encre `#3b3340` sur les titres et le bouton principal ;
  - rose unique pour le tampon, la progression, la fiche « À jouer ensuite » et la sélection du carnet ;
  - couleurs des centrales seulement sur la grille, le logo et la fiche bouclée.
- **Typographie** : une seule famille, mêmes surtitres en capitales espacées (« TUTORIEL 7 SUR 9 », « QUARTS PRÉCÉDENTS », « DOSSIERS D'ENTRAÎNEMENT »).
- **Cartes** : mêmes rayons et bords fins sur l'accueil, le dossier et la grille.
- **Labo** : il garde la palette et la typographie, avec des cartes plus denses et des tags techniques en anglais (`neighbors:1`, `inventory:exact`, `deux_bosses`). Acceptable pour un outil de création local.
- **États** :
  - la sélection (fond rose pâle + bord rose) est la même dans le carnet et dans les puces ;
  - le désactivé est atténué (« Annuler » au départ) ;
  - le bouclé : bandeau vert « Programme bouclé », tampon « Bouclé », coches vertes.
  - Le vert du verdict est le seul vert hors centrales : il reste lisible et cohérent avec les coches.
- **Tons et textes** : tutoiement constant, phrases courtes, aucune faute relevée en dehors des constats 3, 4, 8, 14 et 15.

## Les 5 constats à corriger en premier

1. **Constat 1** : le verdict compte les indices autrement que le panneau. Le joueur le voit à chaque grille d'inventaire exact avec échanges (5 grilles sur 13).
2. **Constat 2** : la rangée de puces de la fiche du jour, masquée sur ordinateur. C'est un écart au brief C1, déjà signalé en S7-finition.
3. **Constat 4** : « Une centrale est un rectangle » contredit les tutoriels de rampe.
4. **Constat 3** : « Sept grilles guidées » pour 9.
5. **Constat 5** : les noms des techniques du labo, différents du jeu, avec le contresens « Record ». C'est la page où l'humain calibre les notes.

---

## Corrections (S8.3, branche `v2-fix-1`)

Commits `411b6c5` à `5ef20c8`. Bilan : **5 à corriger sur 5 faits**, **12 mineurs : 10 faits, 2 non** (grilles publiées, et une observation pour le générateur).

| Constat | État | Correction | Vérification |
|---|---|---|---|
| 1 compte d'indices du verdict | **Fait** | `shownClueCount(grid)` (`panels.ts`) : indices de la grille plus la ligne d'échanges de l'inventaire exact, la même liste que le panneau. | Test sur toutes les grilles ; G7 dit « les 7 indices » |
| 2 puces de la fiche du jour à 1280 px | **Fait** | La liste de l'accueil devient `ul.plant-chips`, avec ses propres règles. | `after/home-1280.png`, `home-solved-1280.png` |
| 3 « Sept grilles guidées » | **Fait** | « Des grilles guidées, une technique chacune… » (sans nombre). | `after/dossier-1280.png` |
| 4 « Une centrale est un rectangle » | **Fait** | « Une centrale a une forme fixe : sa largeur est sa durée de marche, sa hauteur sa puissance. Le charbon peut démarrer en rampe. » | `after/home-rules-375.png` |
| 5 noms des techniques du labo | **Fait** | Lus dans `TECHNIQUES` de `fr.ts` ; seconde table supprimée (aussi B C8). | `after/lab-end-nuit-jouer-a-1280.png` |
| 6 exports sur la fiche bouclée | **Fait** | Contour pointillé violet sur chaque case exportée (`home-art.ts`, classe `sil-export`). | Test ; `after/home-solved-1280.png` |
| 7 feuille imprimée G7 | **Fait** | Plus de soulignement des nombres sur papier ; bloc de droite titré « Bilan du jour ». | `after/print-7.pdf`, `after/print-preview-7.png` |
| 8 insécables | **En partie** | Le texte du bulletin passe par `frenchSpaces()` à l'affichage (nombre + unité, fine insécable avant « : »). Le texte stocké dans `grids.json` et les autres chaînes de `fr.ts` ne sont pas réécrits (grilles publiées). | Test |
| 9 table du labo à 1280 px | **Fait** | Colonne Mécaniques renvoyée à la ligne : la colonne ★ est visible. | `after/lab-list-nuit-jouer-a-1280.png` |
| 10 fiche de candidate | **Fait** | Parenthèse seulement si le profil d'indices n'est pas vide ; « Escalier : pas encore jouable ». | — |
| 11 favicon du labo | **Fait** | `<link rel="icon">` dans `lab.html`. Le KO console de `lab.mjs` disparaît (24/24). | `lab-results.json` |
| 12 bouton désactivé | **Fait** | `.lab-btn:disabled` atténué. | `after/lab-end-nuit-jouer-a-1280.png` |
| 13 barres de progression | **Fait** | `aria-label` = « N / M terminées ». | — |
| 14 unités du carnet | **Fait** | « ruban de 3 à 6 créneaux ». | — |
| 15 intro du tutoriel 3 | **Non** | Le texte est dans `grids.json` (grille publiée) : à changer par l'orchestrateur avec l'humain. Proposition : « Touche une case de la rangée DE sous la grille pour exporter un bloc. » | — |
| 16 barre d'outils sur 2 lignes | **Fait** | Padding des boutons 10 → 8 px : une rangée sur G1, G7, G11 à 1280, 375 et 320 px. | sonde DOM |
| 17 candidate rampe n° 1 triviale | **Non** | Observation pour le générateur, transmise : le rejet `trivial` ne vise que les grilles à une seule clé sans échange. À revoir avec le calibrage. | — |

### Contrôles rejoués (Chrome, build de production)

- Scripts de cette review, sorties dans `after/` (`OUT_DIR`, seul changement aux scripts) :
  - `play.mjs` : 312/312 (13 grilles × 3 largeurs, de l'ouverture au verdict) ;
  - `nav.mjs` : 81/82, le même KO attendu qu'avant (fin de tabulation sur `body`) ;
  - `lab.mjs` : 24/24 (le 404 du favicon a disparu). Données du labo effacées après le passage.
- `web/scripts/check-ui.mjs` (nouveau, B C19) : 205/205.
