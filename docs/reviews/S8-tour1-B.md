# S8.2 — Grande review v2, tour 1, partie B : code, doc, pratiques agentiques, solveur, labo

Relecture de `main` à `93de017`, worktree `v2-review-1b`. Lecture seule : rien n'est corrigé ici. Le jeu dans le navigateur est couvert par la partie A (rva).

## Synthèse

- **0 bloquant, 19 à corriger, 17 mineurs.**
- **Ce qui est solide** :
  - Le moteur web est pur : ni DOM, ni `localStorage`, ni `Date` dans `src/engine` et `src/model`.
  - Le solveur exact est fiable : la coupe porte sur toute la composition, et un timeout lève une erreur au lieu de compter la grille comme unique.
  - Le validateur Python suit le validateur TS : 0 écart sur 6 000 grilles mutées comparées à `validateGrid` sous `node`.
  - Le serveur du labo est bien protégé (Host, Origin, Content-Type JSON).
- **Ce qui ne va pas** :
  - Les 4 constats « à corriger » de S4.6 sur la rampe sont tous encore ouverts : le code du solveur n'a pas bougé depuis `13b5a2a`.
  - Une vérification manque dans la déduction. Elle gonfle la note de 2 des 5 grilles « sans indice » notées Difficile ou Expert.
  - `npm run convert` écrase les tutoriels de rampe.
  - Plusieurs tests sont couplés au contenu de `grids.json` : la première promotion depuis le labo cassera `npm test`.
  - La doc et les skills datent d'avant la rampe et le labo : 11 grilles annoncées, rampe « pas encore dans le jeu ».

### Commandes lancées

| Commande | Résultat |
|---|---|
| `solver/.venv/bin/pytest -q` | 159 tests verts, 3 min 12 s (171 s CPU). README et CLAUDE.md annoncent ~50 s / ~1 min |
| `pytest lab/tests -q` | 47 tests verts, 19 s |
| `npm test` | 9 fichiers, 367 tests verts, 0,4 s |
| `npm run typecheck`, `npm run build` | OK (JS 105,6 kB, 35 kB gzip) |
| `check_unique.py` | 13 grilles : une composition, égale à la référence, déduite, même note. `OK` |

Pour aller vite, deux relecteurs ont lu à part le code web (`web/src` hors labo) et le solveur. J'ai revérifié moi-même chacun de leurs constats repris ci-dessous dans le code. Ceux marqués « mesuré » ont été rejoués par script.

---

## Bloquant

Aucun.

---

## À corriger

### Solveur et générateur

**C1. Vérification « pose × totaux d'échanges du jour » absente de la déduction : notes gonflées**
- **Où** : `solver/src/dispatch_solver/deduce/rules.py:365-370` (`room`). `room` et `silhouette` contrôlent chaque colonne à part, et `deduce/state.py:46-79` (`apply_totals`) n'élague que par bornes.
- **Scénario** (mesuré) : dans nuit-jouer-a[3], un N6 candidat en ligne 2 (0h-12h) exige un export à 8h et un autre à 10h. Or il ne reste qu'un export une fois celui de 12h imposé.
  - Seul `share_out` (niveau 3) élimine ce candidat : la grille est notée Difficile.
  - Une règle de niveau 1 qui vérifie qu'une silhouette compatible avec les totaux exacts existe la fait passer en Facile.
  - Avec la même règle, nuit-jouer-a[1] passe d'Expert à Difficile.
  - Les autres grilles ne changent pas, et la composition reste la référence.
- **Correction** : ajouter cette vérification à `room` (niveau 1), ou en faire une règle de niveau 2. Puis renoter les lots de nuit **avant** de calibrer dans le labo.

**C2. `ramp_relay` pose sans preuve (S4.6 AC3, ouvert)**
- **Où** : `rules.py:677-679`.
- **Scénario** : la règle conclut au relais de deux rampes sans vérifier que l'autre côté ne peut pas fournir les cases à lui seul. Sur une grille où il le peut, la déduction pose une rampe à tort. Elle annonce alors « déduite » ou une note pour une grille qu'un humain ne peut pas résoudre ainsi.
- **Correction** : exiger que l'autre côté ne puisse pas couvrir seul ; ajouter une fixture qui piège la règle actuelle.

**C3. `ramp_lone` compte les cases sûres (S4.6 AC2, ouvert)**
- **Où** : `rules.py:642-650`.
- **Scénario** : la règle compte les 2 cases de la rampe dans la colonne sans retirer celles déjà sûres, contrairement à `_count_hi` (`rules.py:385`). Le défaut est latent : sur 15 déclenchements (lot nuit-rampe, demo-01, fixtures rampe, avec puis sans chaque indice), aucune exclusion fausse.
- **Correction** : reprendre le comptage de `_count_hi` ; ajouter un test.

**C4. `ramp_plateau` et `ramp_shoulder` ne sont que `room` et `single_cover` renommées (S4.6 AC4, ouvert)**
- **Où** : `rules.py:587-618`.
- **Scénario** : NUIT.md compte « 12 grilles sur 20 demandent une technique de rampe ». En réalité, ces grilles demandent `room` ou `single_cover` sur une pièce rampe. La mesure de l'apport de la rampe est donc surestimée.
- **Correction** : soit donner à ces techniques une condition propre à la rampe, soit les présenter comme des étiquettes de `room` et `single_cover`, et corriger NUIT.md et `rampe.md`.

**C5. `ramp_relay` n'apparaît jamais**
- **Où** : `rules.py:76-77`.
- **Ce qui se passe** : la règle n'est pas impossible par construction, mais elle l'est en pratique.
  - Elle demande `lo(C,c) ≥ 2`, ce qui suppose un relevé C de la colonne.
  - Elle est rangée après `share_out`, au même niveau 3.
  - Sur T4, la grille d'étude du relais, `share_out` trouve le relais avant elle (mesuré).
- **Correction** : la placer avant `share_out` une fois rendue juste (C2), ou l'abandonner et le dire dans `docs/next/rampe.md`.

**C6. STEP au niveau `none` jamais généré (S4.6 AC1, ouvert)**
- **Où** : `solver/src/dispatch_solver/board.py:76-82` (`with_clues`). Le `Puzzle` n'est reconstruit que si les clés de composition changent, pas si `rules.step` change.
- **Scénario** : les 11 grilles STEP des lots de nuit sont toutes en inventaire exact ; aucune n'a d'indice `exchanges` avec `step`. Toute une famille de grilles manque au calibrage.
- **Correction** : reconstruire aussi quand `rules.step` change ; vérifier qu'un lot `inventory: none` + `step` produit des grilles.

**C7. `dispatch-solver check-published` échoue par défaut sur les grilles publiées**
- **Où** : `solver/src/dispatch_solver/cli.py:64-66` et `api.py:52`. Doc périmée : `solver/README.md:18`, `grid.py:5-6` (« web engine does not know ramps yet »), `docs/next/solver-v2.md:72`.
- **Scénario** : sans `--ramp`, la commande affiche « grid 12/13: invalid: pieces.C.shape: ramps are not enabled », puis `FAILED`. Le README la dit pourtant « comme web/scripts/check_unique.py », qui passe `allow_ramp=True`.
- **Correction** : `allow_ramp=True` par défaut pour `check-published` ; mettre à jour les trois textes.

### Labo

**C8. Les étiquettes de techniques du labo sont une deuxième liste, incomplète**
- **Où** : `web/src/lab/logic.ts:58-66` (`TECHNIQUE_LABELS`), qui doublonne `TECHNIQUES` de `web/src/i18n/fr.ts:216` avec d'autres noms (« Épuisement » contre « Inventaire épuisé »).
- **Scénario** :
  - Le commentaire promet « every rule id of RULES », mais les 4 techniques de rampe manquent. Elles s'affichent `ramp plateau`, `ramp relay`…
  - GAME-DESIGN §9 et `trace.py` exigent un seul jeu de noms, testé.
  - Le doc-commentaire est doublé (l.58-59).
- **Correction** : lire `TECHNIQUES[t].name` de `fr.ts` et supprimer `TECHNIQUE_LABELS`.

**C9. Les agrégats du labo ignorent `attempt`**
- **Où** : `web/src/lab/logic.ts:210-217` (`playStats`).
- **Scénario** : le README dit « filter on `attempt == 1` to calibrate », mais la médiane des temps et la moyenne des erreurs prennent toutes les parties résolues, rejeux compris. Un rejeu en 40 s tire la médiane vers le bas.
- **Correction** : ne garder que `attempt === 1` dans `playStats` (et afficher le nombre de rejeux à part).

**C10. Un abandon fantôme fait passer la vraie première partie en `attempt: 2`**
- **Où** : `lab/lab_server.py:266-268` et `web/src/lab/play.ts:55`.
- **Scénario** : le joueur ouvre une candidate, recharge l'onglet par erreur après 3 s. Un abandon `reason: unload` est enregistré. Sa vraie partie compte alors comme un rejeu et sort du calibrage (C9 corrigé).
- **Correction** : ne pas compter dans `attempt` les abandons de moins de N secondes ou sans aucune pose (ajouter un compteur de poses au `PlayRecorder`).

### Code web

**C11. `npm run convert` écrase `grids.json` et supprime les tutoriels de rampe**
- **Où** : `web/scripts/convert-grids.ts:288-294`, en-tête l.3 (« Keeps the 11 pose grids »). La commande est donnée dans CLAUDE.md (« regenerate src/data/grids.json ») et dans le skill add-grid.
- **Scénario** (mesuré, sortie dans un fichier temporaire) : la conversion rend 11 grilles. Les ids 12 et 13, tutoriels de rampe, disparaissent, comme toute grille promue par le labo. Les grilles 1 à 11 sortent identiques.
- **Correction** : la conversion a déjà servi ; archiver le script avec le prototype (`docs/archive/`), ou le faire refuser d'écrire une sortie qui perd des ids. Retirer la commande de CLAUDE.md.

**C12. Tests couplés au nombre, à l'ordre et à la date des grilles**
- **Où** :
  - `web/tests/grids.test.ts:136-140` : ids `[1..13]` en dur, `slice(7, 11)`, `slice(11)` ;
  - `grids.test.ts:152,155,186` : `grids[5]`, `grids[6]` ;
  - `web/tests/bulletin.test.ts:221-224` : `toHaveLength(9)` ;
  - `web/tests/ui.test.ts:260` : `nextGrid(grids, 7)?.id === 12`.
- **Scénario** : la promotion depuis le labo ajoute une grille à `grids.json` et casse `npm test` sans régression. Le skill add-grid dit d'ailleurs « Update the expected id list ».
- **Correction** : sélectionner par propriété (`section`, `shape`, id), comparer à des comptes dérivés (`dossiers(grids)[0].grids.length`). Le seul invariant à figer : les ids sont uniques et croissants.

**C13. Test dépendant de la date du jour**
- **Où** : `web/tests/ui.test.ts:258-262`.
- **Scénario** : `playOrder(grids)` et `nextGrid(grids, 13)` prennent la vraie date (`localIsoDate()`). Le test ne passe que parce qu'on est après le 18 novembre 2026, date du premier bulletin. Un bulletin promu à une date future le fera échouer.
- **Correction** : passer `today` explicitement, comme `bulletin.test.ts`.

**C14. Texte joueur faux : « Sept grilles guidées »**
- **Où** : `web/src/i18n/fr.ts:333`.
- **Scénario** : le dossier « Premiers pas » en contient 9 (ids 1-7, 12, 13).
- **Correction** : `lead` fonction du nombre, appelée avec `d.grids.length`.

**C15. Le focus clavier saute de voisin sur une pastille d'export**
- **Où** : `web/src/ui/game.ts:556`. Le sélecteur `[data-act][data-col]` n'a pas `data-country`, et écrase le focus que `activate()` vient de poser (l.544 le fait bien).
- **Scénario** : grille à 2 voisins, Entrée sur la pastille du 2ᵉ pays : le focus part sur celle du 1er. Aucune grille publiée n'a 2 voisins, mais le générateur en produit (nuit-jouer-b : 5 grilles).
- **Correction** : supprimer la ligne 556 (`activate` gère le focus) ou ajouter `data-country`.

**C16. Un indice d'échanges ou de flux passe en « contredit » alors qu'il est encore atteignable**
- **Où** : `web/src/engine/evaluate.ts:319` (`settle`).
- **Scénario** : dès que toutes les cases sont couvertes, tout indice `open` devient `broken`. Or ajouter un export ou une paire STEP relève la silhouette : l'indice `exchanges` ou `flow` reste atteignable. Par exemple, sur la grille 8, tout couvert sans exporter : l'indice d'échanges passe en rouge, avec « contredit l'indice ».
- **Correction** : n'appliquer `settle` qu'aux indices de cases (price, column, bar, length), ou décrire ce choix dans GAME-DESIGN §8.

### Doc et pratiques agentiques

**C17. CLAUDE.md : carte du dépôt périmée**
- **Où** : `CLAUDE.md`.
- **Écarts** :
  - l.12 : « the 11 grids (7 tutorial, 4 rated) » ; il y en a 13 (9 tutoriels dont 2 rampes, 4 notées) ;
  - `lab/` est décrit deux fois (l.15 et l.18) ;
  - `docs/next/brief.md` est dit « local, untracked » mais il est versionné, comme `docs/next/rampe/` ;
  - `npm run convert` est présenté comme une commande courante (C11) ;
  - la durée de pytest est fausse (~1 min annoncée, 3 min mesurées) ;
  - ni `dispatch-solver check-published` ni `generate --out` ne sont cités.
- **Correction** : une passe sur la carte ; ne plus écrire de compte de grilles en dur (« the grids, tutorials then rated »).

**C18. Skills `add-grid` et `deploy` périmés**
- **`.claude/skills/add-grid/SKILL.md`** :
  - l.21 : « Grids with a coal ramp cannot go in until the web game knows ramps » (faux depuis `c72fce8`) ;
  - le chemin principal, la promotion depuis le labo, n'est pas décrit ;
  - il demande de tenir à jour la liste d'ids en dur des tests (C12) ;
  - il cite `npm run convert` (C11).
- **`.claude/skills/deploy/SKILL.md`** : ignore le job `solver` de la CI (pytest + `check_unique.py`, dont dépend `build`) et ne donne pas `check_unique.py` dans « Before pushing ».
- **Correction** : réécrire `add-grid` autour de « labo → promotion → check_unique → npm test », avec le chemin à la main en second ; ajouter le job solver à `deploy`.

**C19. Les scripts de vérification navigateur sont éparpillés dans `docs/reviews/`**
- **Où** : 35 scripts `.mjs`/`.ts` (par exemple `docs/reviews/S7.14-review/scripts/check.mjs`, `S7.11-review/scripts/check.mjs`, `S3/scripts/lib.mjs`).
- **Scénario** :
  - 25 importent `playwright-core`, qui n'est pas une dépendance de `web/package.json`.
  - Chaque review a réécrit son `measure()`, son `openGrid()` et sa recherche de défilement horizontal. Un agent neuf ne sait pas lequel reprendre.
  - Les contrôles les plus utiles (pas de défilement horizontal à 320 px, pastilles entières, une page A4 par grille) ne tournent nulle part en continu.
- **Correction** :
  - créer `web/scripts/check-ui.mjs`, à partir de `S7.14-review/scripts/check.mjs`, le plus complet : toutes les grilles à 1280, 375 et 320 px, défilement, chevauchements, PDF ;
  - ajouter `playwright-core` en devDependency et le citer dans le skill `run-app` ;
  - les reviews suivantes l'appellent au lieu d'en écrire un.

---

## Mineur

### Solveur

- **M1. Couverture de la parité des messages** : seuls 38 des 96 messages de `web/src/model/grid.ts` sont exercés par `fixtures/grids/`. Exemples jamais vérifiés des deux côtés : `title`, `section`, `co2_cap`, `flow.dir`, `engaged.row`, `bulletin.text`. **Correction** : quelques fixtures invalides de plus, ou un fuzz différentiel (le script de la relecture fait 6 000 mutations en quelques secondes) lancé en CI.
- **M2. CLI** :
  - `deduce` sans `--id` répond « pass --id » alors que `--index` existe (`solver/src/dispatch_solver/cli.py:87,95`) ;
  - un fichier absent ou un JSON invalide finit en traceback ;
  - `TimeoutError` n'est rattrapé ni dans `check_grid` ni dans la CLI ;
  - `deduce` ne valide pas la grille ;
  - `check` rend 0 même sur une grille non unique, ce qui piège les scripts.
  - **Correction** : messages d'erreur propres ; un code de sortie non nul en option (`--strict`).
- **M3. Étapes gratuites** : les poses qui dépassent la silhouette maximale sont filtrées dès la construction (`board.py:89`), sans étape tracée. Le nombre d'étapes sous-estime donc le travail sur les grilles sans export ni STEP, ce qui fausse un peu les mesures `steps` du labo. **Correction** : le documenter dans `solver-v2.md`, ou tracer une étape `room` initiale.
- **M4. Temps de pytest** : 3 min 12 s mesurées contre « ~50 s » dans `solver/README.md:11`. Corriger le texte, ou marquer les tests longs (`-m slow`) pour un tour rapide en local.

### Labo

- **M5. `/api/bulletin/<lot>/<i>` n'est pas à l'aveugle** (`lab/lab_server.py:529-530`) : le brouillon de bulletin (titre, texte) est servi sans contrôle de note. L'écran « gardées » l'affiche (`web/src/lab/keep.ts:24`) pour une candidate gardée sans avoir été jouée. Le titre trahit souvent la mécanique (« Frontière ouverte », « Trop de soleil »), pas la note. **Correction** : l'acceptable, mais le dire dans `lab/README.md` (« Blind rules »).
- **M6. Les commentaires des autres joueurs ne sont pas masqués** : `notes_for` (`lab_server.py:311-324`) masque `felt` mais pas `comment`, écrit par le joueur qui a noté. « Trop dur » ou « facile » d'un autre joueur s'affiche avant qu'on ait noté. **Correction** : masquer `comment` avec `felt`.
- **M7. `sendBeacon` avec un Blob `application/json`** (`web/src/lab/api.ts:50`). L'appel est en même origine, donc sans préflight : il devrait passer. En revanche, son retour `false` est ignoré, et l'abandon est alors perdu sans trace. Je ne l'ai pas vérifié en navigateur. **Correction** : `fetch(..., {keepalive: true})`, avec l'en-tête JSON explicite.
- **M8. README du labo** :
  - `lab/README.md:37` cite les origines « localhost:5173 ou 127.0.0.1:5173 », mais le code accepte aussi le port du serveur (l.471) ;
  - les textes restent d'avant `93de017` : `web/src/lab/logic.ts:28` et `web/src/lab/list.ts:75` (« Rampe : pas encore jouable »), puis `lab_server.py:182` et `:403`, qui ne valent plus que pour l'escalier.
  - **Correction** : parler de l'escalier.
- **M9. Titres de grilles hétérogènes** : la promotion prend le titre du bulletin comme titre de grille (`lab_server.py:412`), alors que les 4 grilles notées publiées s'appellent « Facile », « Moyen », « Difficile », « Expert ». **Correction** : choisir une règle et l'écrire dans §14.
- **M10. Textes du labo hors `fr.ts`** : « Abandonner », « Joueur : », « Candidate N » (en anglais, l'intitulé vu par le joueur dans l'écran de jeu) sont en dur dans `web/src/lab/*.ts` et `lab_server.py:188-189`. C'est un outil interne, mais la convention du dépôt ne fait pas d'exception. **Correction** : écrire l'exception dans CLAUDE.md, ou passer le titre en français.

### Code web

- **M11. Doublons de logique** :
  - l'inventaire est calculé dans `web/src/engine/evaluate.ts:180-256` (`ev.inventory`, lu nulle part hors tests) et recompté dans `web/src/ui/panels.ts:85-150` ;
  - `importCells` (`panels.ts:81`) refait `totalImports` (`state.ts:107`) ;
  - `publishedStepPairs`, une règle du domaine, est dans `ui/panels.ts:31` et recodée dans `model/grid.ts:421` ;
  - `gesture.ts:30` redéfinit `ShapeKind` ;
  - `step.ts:14` `StepTone` est identique à `Tone` ;
  - `print.ts:13` importe des helpers de `game.ts`, le module DOM de l'écran.
  - **Correction** : brancher le carnet sur `ev.inventory` ou le supprimer ; déplacer `publishedStepPairs` dans `model/`.
- **M12. Code et clés i18n morts** :
  - `fr.ts:27` `IMPORT_NAME` et `fr.ts:30` `STEP_NAME` ne sont jamais importés ;
  - les clés `kicker`, `importPill`, `stepCellLabel` et `stepEarlier` ne sont jamais lues ;
  - `INVENTORY` (`fr.ts:205`) ne s'affiche pas (M11) ;
  - `panels.ts:242` choisit entre `UI.dayClues` et `UI.gridClues`, qui valent tous deux « Publications du marché » : c'est un reste de variante.
- **M13. Indices prix et flux** : `evaluate.ts:139-149,163` lit la composition avec les barres invalides (hachurées), alors que bar et length les excluent (`validBars`). Un prix peut ainsi passer en « contredit » à cause d'une barre déjà signalée.
- **M14. Progression** : `ui/progress.ts:42-63` ne confronte l'état sauvé ni à la grille ni à ses barres engagées. Si une grille change sous le même id, l'ancien plateau est rejoué sans les barres verrouillées. **Correction** : stocker une empreinte de la grille et ignorer l'état si elle diffère. Les cas de corruption sont, eux, bien gérés et testés.
- **M15. Escalier, statut flou** : GAME-DESIGN §3 (l.52), `lab_server.py:73` et `ramp.test.ts:243` disent l'escalier « pas encore dans le jeu ». Pourtant `model/shapes.ts`, le validateur et `gesture.ts` le connaissent. Aucun test moteur ne pose une rampe `stair`. **Correction** : décider s'il est jouable. Si oui, des tests moteur ; si non, le refuser dans `validateGrid` (ou derrière une option comme en Python).
- **M16. Textes et commentaires périmés** :
  - `fr.ts:311` : « Une centrale est un rectangle » ;
  - `web/src/ui/print.ts:32` : « no exports drawn », que contredit `initialState` ;
  - `web/tests/ramp.test.ts:204` : `describe('review fixes')`, une référence à l'historique ;
  - littéraux `'I'` au lieu de `IMPORT_PIECE` (`shapes.ts:43`, `panels.ts:108,253`, `fr.ts:200,288,405`) ;
  - grammaire française en dur dans `panels.ts:173`.

### Doc et dépôt

- **M17. Doc périmée et poids du dépôt** :
  - `GAME-DESIGN.md:243` : « source des 11 grilles actuelles » ;
  - `solver/README.md:37` : les fixtures de rampe seraient « sautées par Vitest tant que le jeu web ne connaît pas les rampes » (faux, `reference.test.ts:32`), et « Les 11 grilles publiées » ;
  - `docs/next/solver-v2.md:151,174,306,315` : chiffres « 11 grilles », à garder comme historique en le disant en tête ;
  - `lab/candidates/NUIT.md`, sections « Ouvrir le labo » (branches `v2-lab`, `v2-gen`) et « pas jouables tant que la rampe n'est pas dans le jeu » ;
  - `lab/lots/nuit-rampe.json:6`, même phrase ;
  - `docs/next/` mêle conceptions à jour (`solver-v2.md`, `rampe.md`) et maquettes finies (`lab-mockup.html` 133 ko, `menu-bulletin.html`, `logo-variants.html`, `rampe-grilles.html`) à déplacer dans `docs/archive/`.
  - **Poids** : `docs/reviews/` fait 163 Mo versionnés (1 156 PNG, 53 PDF) dans un dépôt public de 166 Mo au total. Chaque review ajoute 5 à 20 Mo, à jamais dans l'historique. **Correction** : versionner le rapport et 2-3 captures clés seulement, et laisser le reste hors dépôt (`.gitignore` sur `docs/reviews/*/` sauf `*.md`) ou en artefact de CI. Le passé ne s'allège qu'en réécrivant l'historique, à décider.

---

## Les 18 grilles « sans indice » notées Difficile ou Expert

La note recalculée est égale à la note stockée pour les 18 grilles.

| Grille | Note | Étapes (niveau ≥ 2) | Techniques clés | Verdict |
|---|---|---|---|---|
| jouer-a[1] | Expert | 21 (16) | `share_out` ×12, `refuted` ×1, STEP 1 paire | **gonflée** : Difficile avec la vérification C1 |
| jouer-a[3] | Difficile | 9 (3) | `share_out` ×3, export total 2 | **gonflée** : Facile avec C1 |
| jouer-a[18] | Difficile | 21 (8) | `ribbon` ×6, `share_out` ×2, 3 voisins | réelle |
| jouer-b[0] | Difficile | 11 (5) | `share_out` ×5, N [5, 3×8], B 3 cases | réelle : vraie répartition |
| rampe[2] | Expert | 17 (9) | `share_out` ×3, `refuted` ×3, 4 rampes | réelle |
| les 13 Facile | Facile | 1 à 11 (0) | `exhausted`, `single_cover`, `room`, `silhouette` | — |

**Verdict** : la note n'est pas mal calculée, mais 2 notes sur 5 sont gonflées par la vérification manquante (C1).
- Les 3 autres grilles sont de vrais problèmes de répartition : un inventaire exact de nombreuses barres du même type, sans indice. `share_out` (niveau 3) y est vraiment nécessaire.
- Les 13 grilles Facile le sont parce que la grille se résout sur la composition. Par exemple, dans jouer-b[8], une case d'un ruban large d'une case ne peut être que du T, et `exhausted` règle le reste.
- C'est juste, mais pour le labo, il faut savoir qu'une grille sans indice peut se jouer sans poser la moitié des barres. À voir avec les joueurs : est-ce encore un puzzle ?

---

## Les 5 constats à corriger en premier

1. **C1, vérification des totaux d'échanges dans la déduction**, puis renoter les lots : sans elle, le calibrage du labo part de notes fausses.
2. **C12 + C13, tests indépendants du contenu de `grids.json`** : sinon la première promotion depuis le labo casse la CI et bloque la publication.
3. **C2 + C3 + C5, rendre justes `ramp_relay` et `ramp_lone`** (S4.6, ouverts depuis deux tours) : une règle de déduction fausse peut déclarer déductible une grille qui ne l'est pas.
4. **C11 + C17 + C18, `npm run convert` hors du chemin, CLAUDE.md et skills à jour** : un agent neuf qui suit la doc peut effacer les tutoriels de rampe et croit la rampe hors du jeu.
5. **C9 + C10, agrégats du labo sur `attempt == 1` et abandons fantômes exclus** : les mesures du labo sont la base du recalibrage (§9, « À recalibrer en priorité »).
