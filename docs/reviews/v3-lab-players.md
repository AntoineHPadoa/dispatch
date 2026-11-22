# Review — `v3-lab-players` (S4.17, auteur s7)

## Tour 2 (S4.20, après S4.19)

**Verdict : OK à merger.** Les 5 points du tour 1 sont traités ; tests verts ; fuite d'aveugle corrigée et vérifiée via l'API.

Branche relue : `v3-lab-players` @ `a84f02d` (1 commit de correction sur `990b842`), 7 fichiers, +32 / −14. Commit par l'adresse noreply, sans mention de Claude ni d'IA.

### Corrections

1. **G11** (bloquant) : `title` passe à « Facile » dans `grids.json`, seule ligne changée du fichier. Aucun test ne citait le titre « Expert » de G11 (les « Expert » restants sont dans des fixtures et `web/src/lab/end.ts`), donc rien à adapter.
2. **Aveugle par lot** : `revealed()` compare maintenant `lot` en plus de `index` et `player`. Test `test_reveal_is_per_lot_and_index` à deux lots : la note de `u:0` ne révèle rien de `t:0` (ni ★, ni commentaire, ni note perçue, ni mesures), puis noter `t:0` le révèle.
3. **Migration** : filtre sur les `(lot, index)` des `items` de la session, plus sur ses lots. Test ajusté avec une partie hors session (`a:7`) qui ne reçoit pas de ★.
4. **Labo arrêté** : précisé dans l'en-tête de `migrate_stars.py` et dans `lab/README.md`.
5. **Ordre, taille impaire** : commentaire du test précisé, condition inchangée (acceptable, aucun effet à 6).

### Essai de la fuite, via l'API

- Copie de `lab/` (données réelles) dans le scratchpad, migration lancée dessus (`stars: {'Joueur 1': 20, 'Joueur 2': 8}`, 41 → 41 notes, comme au tour 1).
- Deux serveurs sur la même copie : `main` (port 8767) et la branche (port 8766). Joueur 2 met une ★ sur `v3-confort:0`. Joueur 1 n'a jamais joué `v3-confort:0` mais a noté l'index 0 de `v3-jouer-a`, `v3-jouer-b` et `nuit-rejeu-notees`.
- `GET /api/notes?player=Joueur 1`, clé `v3-confort:0` :
  - `main` : `felt`, `comment` et ★ de Joueur 2 renvoyés → fuite reproduite ;
  - branche : `{}` → plus de fuite.
- Branche, liste `v3-confort` pour Joueur 1 : `revealed: false, kept: false, kept_any: false, rating: null` ; `/api/reveal/v3-confort/0` → 403.
- Non-régression : `v3-jouer-b:0`, noté par les deux joueurs, montre bien à Joueur 1 la note, le commentaire et la ★ de Joueur 2 ; `/api/reveal` → 200. Joueur 2 voit toujours ses propres notes sur `v3-confort:0`.
- Nettoyage : serveurs arrêtés, copies supprimées, worktree sans modification, vrai `lab/notes.json` intact.

### Nits (non bloquants, à ne pas corriger forcément)

- `test_migration_is_idempotent` : le 2e appel passe encore `{"a"}` (ancienne signature, un ensemble de lots), et la partie de Joueur 2 (`a:1`) est hors session dans les deux appels : le test ne vérifie donc plus l'idempotence d'une ★ de Joueur 2. Passer le même ensemble aux deux appels et y inclure `("a", 1)`.
- `revealed()` lit `p.get("lot", lot)` : une partie sans `lot` compterait pour tous les lots. Sans effet aujourd'hui : les 61 parties de `plays.jsonl` ont toutes un `lot`.

### Tests (venv de `main`)

- `web/` : `npm test` 430 tests verts (11 fichiers) ; `npm run typecheck` OK ; `npm run build` OK.
- `check_unique.py` : « every grid is unique and deducible ».
- `pytest lab/tests -q` : 307 tests verts (+1, le test à deux lots).
- `cd solver && pytest -q` : 196 tests verts (3 min 29 s).

---

## Tour 1

**Verdict : À corriger** — un point bloquant (titre de G11). Le reste est conforme et vert.

Branche relue : `v3-lab-players` @ `990b842` (1 commit sur `main` @ `4241559`), 16 fichiers, +299 / −44.

## Points

### Bloquant

1. **G11 garde le titre « Expert »** (`web/src/data/grids.json`, grille id 11).
   - La `difficulty` passe bien à `{rating: 1, label: "Facile"}`, mais `title` vaut toujours `"Expert"`.
   - Les grilles notées ont leur étiquette pour titre (G8 « Facile », G9 « Moyen », G10 « Difficile ») : le joueur verrait « Expert » sur une grille annoncée Facile.
   - Correction : `"title": "Facile"`. La branche de s5 (worktree `v3-gen-3`) fait déjà ce changement de titre pour les grilles qu'elle renote.

### Mineurs

2. **Aveugle percé par `GET /api/notes` d'un lot à l'autre** (`lab/lab_server.py`, `notes_for` → `revealed`). Bug **préexistant** sur `main`, que la branche étend aux ★.
   - `notes_for` passe toutes les parties (`self.plays()`) à `revealed()`, et `revealed()` compare `index` et `player` sans comparer `lot`.
   - Une grille est donc « révélée » dès que le joueur a noté la grille de même index dans **n'importe quel** lot.
   - Constaté pendant l'essai : Joueur 1 n'a jamais joué `v3-confort:0`, mais `/api/notes?player=Joueur 1` lui renvoie la ★, la note perçue et le commentaire de Joueur 2. Cause : il a noté l'index 0 de `v3-jouer-a`, de `v3-jouer-b` et de `nuit-rejeu-notees`.
   - Les écrans ne sont pas touchés : la liste passe par `candidates()`, qui lit `plays(lot)` et reste juste, et l'écran de fin n'affiche que la ★ du joueur. La fuite reste dans l'API.
   - Correctif d'une ligne : ajouter `p["lot"] == lot` dans `revealed()`, plus un test à deux lots.
3. **La migration filtre sur les lots de la session, pas sur ses grilles** (`lab/scripts/migrate_stars.py`, `migrate(..., session_lots)`).
   - Aujourd'hui, le résultat est exact : les 8 ★ données correspondent aux 8 grilles résolues de `v3-joueur2`.
   - Si Joueur 2 résout une autre grille de `v3-jouer-a/b/c` avant que la migration tourne, il recevra une ★ qu'il n'a pas donnée.
   - Filtrer sur `{(lot, index)}` des `items` serait plus juste. À défaut, lancer la migration juste après le merge.
4. **La migration doit tourner labo arrêté.** Elle réécrit `notes.json` sans le verrou du serveur, et une note écrite pendant ce temps serait perdue. Le README et la note de l'auteur devraient le préciser.
5. **Ordre de session, cas d'une taille impaire.** La règle « grille courte d'abord » passe avant la règle « pas deux longues d'affilée ».
   - Exemple : 4 longues et 3 courtes. Commencer par une courte force deux longues côte à côte.
   - Le code le gère (repli sur `rest[0]`), mais la condition du test `test_order_never_puts_two_long_grids_in_a_row` (`longs <= shorts + 1`) ne tient pas compte de la courte imposée en tête. Le test passe parce qu'il tire 8 grilles, une taille paire.
   - Aucun effet à la taille par défaut (6). Le commentaire du test peut être précisé.

## Vérifications

- **G11** :
  - Seule la `difficulty` de G11 change dans `grids.json` : rating, label et techniques, ces dernières égales à ce que sort `dispatch-solver check --id 11` (`record, room, silhouette`, 4 étapes).
  - `RATING_PENDING` est retiré de `solver/tests/test_published.py`.
- **Conflit avec s5** (worktree `v3-gen-3`, modifications non commitées de G7, G10, du tutoriel 9 et d'autres grilles) :
  - Le patch de s5 sur `grids.json` s'applique proprement sur la branche (`git apply --check`, hunks disjoints) : aucun conflit textuel.
  - s5 modifie `deduce/trace.py`. Après le merge des deux branches, relancer `check_unique.py` et `test_published.py` : le rating ou les techniques de G11 peuvent bouger.
- **★ par joueur** :
  - Schéma `kept: {joueur: true}` comme `comment`. Un ancien booléen est lu pour « Joueur 1 » (`_migrate_kept`, test `test_older_boolean_star_belongs_to_player_1`).
  - Une ★ demande un joueur connu (400 sinon).
  - La liste expose `kept` (la ★ du joueur) et `kept_any`. Ce dernier se réduit à la ★ du joueur tant que la grille n'est pas révélée : pas de fuite par la liste.
  - « Gardées » filtre sur `kept_any || promoted`. La règle de promotion (« gardée dès qu'un joueur l'a gardée ») est documentée dans `lab/README.md`.
- **Migration**, sur une copie de `lab/notes.json` et `lab/plays.jsonl` dans le scratchpad :
  - Résultat : `stars: {'Joueur 1': 20, 'Joueur 2': 8}`, 41 → 41 notes.
  - Les 20 ★ booléennes sont toutes passées à Joueur 1, et aucun autre champ ne change.
  - Joueur 2 a ★ sur exactement ses 8 grilles résolues de `v3-joueur2` (`v3-jouer-a:14`, `b:0`, `b:1`, `b:4`, `b:19`, `c:8`, `c:9`, `c:16`) ; sa 9e résolue, `v3-confort:0`, hors session, est bien exclue.
  - `--dry-run` n'écrit rien, le `.bak` est créé, et un 2e lancement répond `already migrated`.
  - Le vrai `notes.json` n'a pas changé (md5 identique avant et après).
- **Sessions de 6** :
  - Taille par défaut à 6 côté serveur (`DEFAULT_SESSION_SIZE`) et côté web (champ « Taille » prérempli à 6).
  - Le tirage (équilibre par note, familles et mécaniques) est inchangé : le diff ne touche que l'ordre.
  - L'ordre est seedé et déterministe. Il n'a aucune règle sur les notes voisines, donc ne fuit pas de note (la longueur d'une grille est visible de toute façon).
- **Essai réel**, labo du worktree sur les ports 8766 et 5174 (le labo de l'humain occupait 8765 et 5173), avec un dossier `lab` copié dans le scratchpad et les données migrées :
  - Joueur 2, lot `v3-jouer-a`, « Nouvelle session » : session `v3-jouer-a-2`, 6 grilles. Ordre (créneaux, note solveur) : (8,1) (12,2) (8,3) (8,4) (8,2) (8,4). La première est courte et facile, et il n'y a pas deux longues d'affilée.
  - Écran de fin : Joueur 2 voit ★ sur `b:0` et `c:8`. Joueur 1 retire sa ★ de `b:0`, et la ★ de Joueur 2 reste (`{"Joueur 2": true}`). Joueur 2 garde `v3-confort:0`, ce qui écrit `{"Joueur 2": true}` seul. Aucune erreur JS.
  - Pour Joueur 1, la liste `v3-confort` donne `kept: false, kept_any: false` sur la grille 0, qu'il n'a pas notée.
  - Nettoyage : serveurs arrêtés, données d'essai supprimées, worktree sans modification.
- **Tests** (venv de `main`, le worktree n'en a pas) :
  - `web/` : `npm test` 430 tests verts (11 fichiers) ; `npm run typecheck` OK ; `npm run build` OK.
  - `check_unique.py` : « every grid is unique and deducible » ; `dispatch-solver check-published` OK.
  - `pytest lab/tests -q` : 306 tests verts.
  - `cd solver && pytest -q` : 196 tests verts (3 min 48 s).
- **Conventions** :
  - Code et commentaires en anglais, libellés du labo en français, en-tête de `migrate_stars.py` succinct.
  - Commit par l'adresse noreply, sans mention de Claude ni d'IA.
  - `lab/README.md` est à jour (schéma `notes.json`, ★ par joueur, taille 6, ordre).
