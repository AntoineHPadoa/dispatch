# Review v3-meteo-c — générateur, archive, lots v3

Branche `v3-meteo-c` (auteur `c1`). Worktree `/Users/padoa/Programs/spot-elec-v3-meteo-c`.

## Tour 2 — HEAD `c281094` (commits `f821e7a`, `c281094`)

### Verdict : **OK à merger**

Le bloquant est corrigé, le test de dessin est en place et attrape les défauts, tous les tests sont verts. Restent 2 mineurs, hors périmètre et listés par l'auteur.

### Points

1. **Bloquant du tour 1 — corrigé.** `v3-reprises` 4 et 5 sont redessinées par le solveur exact.
   - `draw_solution.py` rejoué sur les 6 lots vivants (90 grilles) : 0 erreur. Aucune case sur la météo, aucun chevauchement, aucun trou, couverture exacte.
   - Composition comparée à la version du tour 1 (`reference_composition`) : identique pour les 6 grilles.
   - Seuls changent `solution.placements` et `lab.redrawn` (`"solver"`) sur 4 et 5. Les grilles 0 à 3 sont identiques octet pour octet.
   - Dessins :

```
reprises:4   R=[0,0,0,1,1,0,0,0]     reprises:5   R=[1,0,1,1,0,0]
      t                              NNNNNN
     GG                              nnnnnn
  t  nnn                             NNNNNN
NNNNnnnn                             nnnnnn
nnnnNNNN                             NNNNNN
NNNRRNNN                             RiRRgg
```

   - `dispatch-solver check --strict` sur `v3-reprises` : exit 0. 6/6 valides, 1 composition, égale à la référence, déduites. Notes inchangées : 4 Moyen, 5 Facile.
   - `V3.md` corrigé : tableau des reprises, sens de `lab.redrawn` (`false` / `"lifted"` / `"solver"`), et l'erreur de la 1re version expliquée.
2. **Nouveau test `lab/tests/test_candidate_drawings.py` — conforme.**
   - Il rejoue les 90 candidates de `lab/candidates/*.json`. Le glob n'est pas récursif, donc `archive/` est exclu ; `.stats.json` et `.blocked.json` sont ignorés.
   - Formes : rectangle `len` × `height`, rampes `trap` 1-2-1 et `stair` 2-1. Comme dans mon script pour `trap`.
   - **Essai sur une copie altérée** (dans le scratchpad, rien de committé) : une pose dupliquée sur la grille 5, une pose retirée sur la grille 4, avec `archive/` copié à côté.
     - Résultat : 2 échecs, exactement `v3-reprises:4` (`hole at (0, …)`) et `v3-reprises:5` (`placements[…] N on placements[0] N at (1, 5)`). 6 passent, et aucun lot archivé n'est joué.
   - Un test unitaire couvre aussi le trou, le chevauchement et la pose sur la météo.
3. **Mineurs du tour 1.**
   - **Corrigés** :
     - mineur 7 : limites de `rejects_by_family` documentées dans `lot.py` et `V3.md`. Une erreur garde sa famille configurée : les valeurs par défaut posent toujours `family`, donc plus de `"?"` ;
     - reste du point 9 : l'exemple §14 a sa barre N en `row: 3, col: 2, len: 5`, comme l'indice `bar`. La phrase « extrait » est ajoutée. `check` sur l'exemple ne signale plus que les champs de tête absents d'un extrait (`id`, `title`, `section`).
   - **Laissés, listés dans la note `ctl` de S5.16** :
     - mineur 6 : le validateur ne contrôle pas le dessin. Il n'est pas touché, comme demandé, et vaut une tâche à part ;
     - mineur 8 : conseil trompeur de la page du labo sur un lot archivé. La correction est dans `web/src/lab/`, hors périmètre.
   - Remarque sans suite : une erreur levée *après* `draw_day` est rangée sous la famille configurée, pas sous la famille tirée. C'est sans effet aujourd'hui (0 erreur dans les 4 lots), et le commentaire de `lot.py` le dit.
4. **Pas de régression.**
   - `cd solver && .venv/bin/pytest -q` : 182 passed (3 min 16).
   - `solver/.venv/bin/python -m pytest lab/tests -q` : 178 passed. C'était 86 au tour 1, plus 92 nouveaux tests (90 dessins + 2).
   - `web/` : `npm test` 414 passed (11 fichiers) ; `check_unique.py` « OK: every grid is unique and deducible ».
5. **Conventions** : 2 commits en anglais, sans mention d'IA. `web/` n'est toujours pas touché. Le worktree est propre.

## Tour 1 — HEAD `0d49781`, relue contre `main` (`320c4fc`)

## Verdict : **À corriger**

Un bloquant : 2 grilles de `v3-reprises` ont une solution de référence dont le dessin est illégal (barres qui se chevauchent, cases vides). Le reste est bon : générateur, 88 autres grilles, labo, doc, tests.

## Points

### 1. Bloquant — `v3-reprises` 4 et 5 : dessin de référence illégal

- **Constat** : la « remontée » pose chaque barre sur la ligne juste au-dessus de la météo de ses colonnes, sans tenir compte des autres barres. Résultat :
  - **4** (« Le pic de 19 heures ») : deux N sur la ligne 2 aux colonnes 0-2 ; cases vides en ligne 0 (colonnes 0-2) et en ligne 1 (colonnes 5-7).
  - **5** (« Un jour tranquille ») : l'import et le G recouvrent des N en ligne 5 ; cases vides en ligne 0 (colonnes 1, 4, 5).
- **Dessins** (minuscule/majuscule alternées par pose ; `.` = case vide sous la silhouette) :

```
reprises:4               reprises:5
      t                  NiNNgg   <- I et G posés sur des N
     GG                  nnnnnn
  t  nnn                 NNNNNN
NNNnNNNN  <- 2 N ici     nnnnnn
NNNNN...                 NNNNNN
...RRnnn                 R.RR..
```

- **Pourquoi `check --strict` passe** : la composition (cases par pièce et par colonne) est juste et unique, et le validateur ne contrôle ni le chevauchement ni les trous du dessin. Ce trou du validateur existe sur `main` aussi (mineur 6).
- **Effet** : la règle 1 du §4 (« chacune de ses cases est libre ») est violée par la référence. Une promotion publierait ce dessin, que l'accueil affiche une fois la grille finie (`home-art.ts`). `V3.md` écrit « Même composition, toujours unique » sans signaler le dessin.
- **Correctif** : redessiner 4 et 5 avec le solveur, comme le prévoyait la note (§5 : « Le solveur donne le nouveau dessin »). Un dessin légal existe : pour 5, par exemple, N×6 en lignes 1, 2, 4, 5 ; N×3 en ligne 3 aux colonnes 0 et 3 ; I en (0, 1) ; G en (0, 4-5). Il a la même composition (vérifié).
- **À ajouter** : un test qui rejoue le dessin de chaque candidate (pas de chevauchement, silhouette couverte exactement). Mon script : `docs/reviews/v3-meteo-c/draw_solution.py`.
- Grille 1 (aussi remontée) : dessin correct.

### 2. Lots `v3-*` — conforme

- **`check --strict` rejoué** sur les 90 grilles (`v3-jouer-a/b/c`, `v3-rampe`, `v3-reprises`, `nuit-rejeu-notees`) : exit 0 pour les 6 fichiers. 90/90 valides, 1 composition, non plafonné, égale à la référence, déduites, déduction égale à la référence, note recalculée égale à la note écrite.
  - Remarque : la CLI n'a pas d'option `--ramp`. Les rampes sont acceptées par défaut (`--no-ramp` pour les refuser), donc la consigne est satisfaite.
- **Dessins des 90 solutions** : script de contrôle (météo sous la ligne `R+F`, cases des poses, rampes `trap`, couverture exacte de demande + exports + pompages − turbinages).
  - 88/90 propres : aucune case sur la météo, aucun chevauchement, aucun trou.
  - Les 2 en échec sont celles du point 1.
- **5 grilles échantillonnées** parmi les plus variables en météo : `v3-jouer-a:14`, `v3-jouer-b:2`, `v3-jouer-b:14`, `v3-jouer-c:9`, `v3-rampe:13` (rampes). Aucune barre pliée, aucune case sur la météo. Dessins dans `docs/reviews/v3-meteo-c/drawings.txt`.
- **Tableau de calibrage de `V3.md`** : recalculé depuis les sorties de `check`, toutes les cellules sont justes.
  - Par lot : a 5/9/3/3, b 6/8/3/3, c 9/5/3/3, rampe 3/11/2/4, reprises 2/1/0/3, rejeu 2/1/1/0.
  - Total 27/35/12/16. Sans rampe (moins `v3-rampe` et `v3-reprises:3`) : 24/24/10/11. v3 seuls : 22/23/9/11.
  - L'objectif d'au moins 8 par note est atteint.

### 3. Générateur — conforme

- **Clé de doublon** : la clé de forme inclut le profil `R+F` par colonne, en absolu. Le résiduel reste à un décalage vertical près.
  - `test_duplicate_key_includes_the_weather` couvre 3 cas : même résiduel avec une autre météo, F en plus, et doublon décalé.
  - Limite acceptable : la clé somme R et F, donc `R=[1,0], F=[1,0]` et `R=[2,0], F=[0,0]` sont un doublon. Le dessin des briques est le même.
- **`rejects_by_family`** : correct pour ce qu'il mesure, c'est-à-dire les rejets du générateur (`infeasible`, `one_plant`, `trivial`, `too_many_clues`…) par famille tirée.
  - Les sommes collent à `V3.md` : 636 tirages traités, `midi_solaire` 53, `surplus_midi` 83, 0 `infeasible`.
  - Mineur 7 : les rejets de quota n'y figurent pas, et les tirages annulés en fin de lot non plus. Son total d'`attempts` vaut donc `attempts` − 11 dans chaque lot.
- **`silhouettes.py` non modifié** : décision justifiée.
  - Réplication indépendante : 216 tirages forcés en `midi_solaire` et `surplus_midi`, sur les 3 mix `v3-jouer-*`, sélection d'indices court-circuitée. Résultat : 0 `infeasible` sur 216.
  - C'est cohérent avec le code : la référence cherche avec imports en secours puis sans exports, et la TAC d'une case comble presque tout.
  - Seuil de 50 % très loin.
- **Archive côté CLI** : `dispatch-solver generate` refuse un nom archivé dans `--out/archive/` (exit 2, testé).

### 4. `v3-reprises` — conforme hors point 1

- **6 grilles, composition égale à la source** (comparé avec `reference_composition` sur les sources archivées).
  - Seules diffèrent : `id` partout, `solution` sur 1, 4 et 5, plus `clues` et `difficulty.techniques` sur 5.
  - 0, 2 et 3 sont identiques à leur source.
  - Uniques d'après `check`.
- **Grille 5 sans indice** : 1 composition, déduite (`exhausted`, `room`, `silhouette`, `single_cover`), Facile comme sa source. L'export forcé par le surplus rend l'ancien indice de flux inutile.
- **Écart avec la consigne (10 grilles)** : justifié.
  - Les 10 de la note = 8 « telles quelles » (dont les 4 du rejeu) + 2 à redessiner.
  - `v3-reprises` en prend 6 ; les 4 du rejeu restent dans `nuit-rejeu-notees`, gardé tel quel (4/4 vérifiées).
  - Les dupliquer aurait compté deux fois les grilles publiées 8 à 11.
  - `nuit-jouer-c:0` (« telle quelle » dans la note) a quand même été remontée, à cause de F = 1 partout. Son nouveau dessin est correct.

### 5. Labo — conforme

Testé avec le code du worktree sur une copie de `lab/` (serveur sur le port 8775, Vite sur 5183, sans toucher au labo de l'humain sur 8765). La copie contenait les vrais `plays.jsonl` et `notes.json` de `main`, plus une note gardée et une session qui pointent vers `nuit-jouer-a:3` (archivé).

- **Lots listés** : `nuit-rejeu-notees`, `v3-jouer-a/b/c`, `v3-rampe`, `v3-reprises`. Aucun archivé (API et sélecteur de la page).
- **Clés archivées, rien ne plante** :
  - lecture : `candidates`, `reveal`, `bulletin`, `plays`, `notes`, la page de fin `#/fin/nuit-jouer-a/3` et la session archivée (16 items « Non jouable », pas d'erreur JS) ;
  - refus attendus en 410 : `grid`, nouvelle session et promotion sur le lot archivé ;
  - `sessions/archive/` n'est pas listé.
- **« Nouvelle session » sur `v3-jouer-a`** : session `v3-jouer-a-1` de 4 grilles créée. « Jouer » ouvre la partie, météo en briques affichée. Captures dans `docs/reviews/v3-meteo-c/`.
- **Nettoyage** : copie, serveurs et sorties supprimés ; worktree propre (`git status` vide).
- Mineur 8 : ouvrir `#/partie/<lot archivé>/<i>` à la main affiche « Le serveur du labo ne répond pas ou a refusé : lot … is archived. Lance le labo avec lab/run.sh. ». Le conseil final trompe, mais la page n'est atteignable que par URL.
- Constat sans suite : une note gardée sur un lot archivé reste modifiable (`PUT /api/notes`) et n'apparaît pas dans « Gardées ». C'est cohérent avec « non promouvable ».

### 6. Mineur — le validateur ne contrôle pas le chevauchement des poses

- Ni `validateGrid` ni le port Python ne refusent deux poses de `solution.placements` qui se recouvrent, ni une silhouette mal couverte par le dessin.
- C'est ce qui a laissé passer le point 1. Le défaut existe sur `main` aussi, hors périmètre de la branche, mais il vaut une tâche.

### 7. Mineur — `rejects_by_family`

- **À documenter** : les rejets de quota n'y sont pas comptés.
- **Écart de total** : son `attempts` vaut le total moins les tirages annulés en fin de lot (11 par lot). `V3.md` cite les bons chiffres (636), mais le `.stats.json` ne le dit pas.
- **Famille perdue** : une exception dans `_attempt` renvoie une `info` sans famille, rangée sous `"?"`.

### 8. Mineur — message d'erreur du labo sur un lot archivé

Voir le point 5.

### 9. Doc — conforme, un reste

- **`GAME-DESIGN.md` §5** : la phrase « Une marche de météo coupe aussi toute ligne… » est retirée de la puce Surplus. La règle 1 du §4 la couvre déjà.
- **`GAME-DESIGN.md` §14** : la barre N passe en `row: 3`, au-dessus de la météo (max `R+F` = 3). Le validateur ne signale plus de case sur la météo.
  - Mineur : l'exemple reste invalide sur un autre point, déjà présent sur `main`. `len: 8` n'est pas une largeur permise pour N (`[3, 4, 5, 6]`), et l'indice `bar` annonce `len: 5`.
  - `dispatch-solver check` sur l'exemple : `solution.placements[0].len: width not allowed for N`.
- **`lab/README.md`** : l'archive est décrite (non listée, lecture seule, clés valides, noms jamais réutilisés, `sessions/archive/`).
- **Autres fichiers à jour** : `CLAUDE.md`, `solver/README.md`, `cli.py`, `rerate_lots.py` et les skills `add-grid` et `run-app` pointent vers les nouveaux chemins.

### 10. Tests — tous verts

- `cd solver && .venv/bin/pytest -q` : 182 passed (3 min 20).
- `solver/.venv/bin/python -m pytest lab/tests -q` : 86 passed.
  - `test_real_candidate_is_promotable_then_refused_twice` est réparé : candidate choisie par propriété (jouable et passant le vrai vérificateur) dans `v3-jouer-a`.
  - `test_archive.py` couvre l'archive.
- `web/` : `npm test` 414 passed (11 fichiers) ; `check_unique.py` « OK: every grid is unique and deducible ».

### 11. Périmètre et conventions — conformes

- `web/` n'est pas touché (`git diff main...v3-meteo-c -- web/` vide), `grids.json` compris.
- 4 commits en anglais, sans mention d'IA ; branche sans `/`.
- En-têtes de fichier en anglais, état actuel seulement. Le français reste dans `V3.md` et les docs.
