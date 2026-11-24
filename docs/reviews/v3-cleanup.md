# Review `v3-cleanup` (S10.4, auteur `s4`)

## Tour 2 (S10.8, après S10.7)

**Verdict : OK à merger.** Le bloquant est corrigé, les 4 mineurs aussi, sans régression. Une précaution à prendre au merge (ci-dessous), qui ne touche pas la branche.

Relu : `fe53349..8d7f915`, 1 commit, 6 fichiers, +217 / −10. Worktree propre.

**Bloquant 1, données de jeu hors git : corrigé.**
- `.gitignore` : `lab/plays.jsonl*`, `lab/notes.json*`, `lab/sessions/.counters.json`, `lab/sessions/**/*.json`, plus l'exception `!lab/sessions/archive/v3-session-1.json`.
- `git check-ignore --no-index` sur les vrais fichiers du dossier principal : `plays.jsonl`, `plays.jsonl.bak-S7.6`, `notes.json`, `notes.json.bak-S4.22`, `sessions/matin-24.json`, `sessions/.counters.json`, `sessions/archive/v3-confort.json` sont ignorés. Ne sont pas ignorés, comme voulu : `sessions/archive/v3-session-1.json`, `players.json`, les candidats, `lab/tests/`.
- `git ls-files lab/` : aucune donnée de jeu suivie. Seuls fichiers proches : `players.json` (`["Joueur 1", "Joueur 2"]`, pseudonymes) et `sessions/archive/v3-session-1.json` (liste `lot`/`index`/`hold`, sans commentaire). L'exception est tranchée et dite.
- `lab/README.md` dit la même règle que le `.gitignore` : ce qui est versionné, ce qui reste local, pourquoi, l'exception, et « Back them up outside git ». `CLAUDE.md` le dit en une demi-phrase. La synthèse §4 aussi.

**Mineurs : tous corrigés.**
- 2 : §10 dit « Seuils indicatifs, calés sur un seul joueur et à confirmer ». La synthèse distingue la mesure, solide, des seuils, à confirmer par `v3g6-compact` et des joueurs neufs.
- 3 : la réserve est ajoutée dans la synthèse (accord non indépendant, pas testée sur un novice) et dans §10.
- 4 : « 6 ★ sur 13 couplées en M23 » (conforme à `v3-criteres-m23.md`) ; « Joueur 2 s'est arrêté après 8 grilles (34 min actives) : sessions de 6 grilles ».
- 5 : `v3-confort` est archivé dans `lab/candidates/archive/v3-confort.json`, identique octet pour octet au fichier non suivi du dossier principal. Il est versionné, et la synthèse §4 le classe.

**Précaution au merge (orchestrateur, pas un correctif de branche).** Le dossier principal garde un `lab/candidates/v3-confort.json` non suivi. Après le merge, le serveur cherche un lot d'abord dans `candidates/`, puis dans l'archive (`lab_server.py:197`). Cette copie ferait donc réapparaître `v3-confort` comme lot actif et jouable. Il faut la supprimer après le merge (contenu identique à l'archive, rien n'est perdu).

**Tests (worktree `v3-cleanup`)**
- `python -m pytest lab/tests -q` : **341 passed** (39 s).
- `cd web && npm test` : **432 tests, 11 fichiers, verts**.
- Solveur, `check_unique.py` et `grids.json` ne sont pas touchés par S10.7 : pas relancés.

---

## Tour 1

**Verdict : À corriger.** Un seul point bloquant, la consigne « données de jeu hors git » qui n'est pas appliquée (`.gitignore`, `lab/README.md`). Le reste est fidèle et prêt : la synthèse est juste, §10 est correct, l'archive ne casse aucune clé et les tests sont verts. Quatre points mineurs, à corriger dans la même passe si possible.

Branche relue : `main...v3-cleanup`, 1 commit `fe53349`, 24 fichiers, +491 / −8. Worktree `~/Programs/spot-elec-v3-cleanup` propre.

## Bloquant

1. **Consigne « données de jeu hors git » non appliquée.**
   - `.gitignore` n'est pas modifié par la branche : `lab/plays.jsonl`, `lab/notes.json`, `lab/sessions/*.json`, `lab/sessions/.counters.json` et les `*.bak*` restent non suivis mais pas ignorés. Un `git add lab/` les publierait sur le dépôt public.
   - `lab/README.md` titre toujours « Files (all in `lab/`, versioned) » et décrit `plays.jsonl`, `notes.json` et `sessions/<id>.json` parmi les fichiers versionnés. Il faut dire qu'ils restent locaux, et pourquoi (dépôt public, commentaires personnels).
   - À trancher au passage : `lab/sessions/archive/v3-session-1.json` est déjà versionné sur `main` (liste de grilles seulement, sans commentaire). Le garder par une exception (`!lab/sessions/archive/`) ou le sortir, mais le dire.
   - `CLAUDE.md` liste lui aussi `plays.jsonl` et `notes.json` dans `lab/` sans dire qu'ils sont hors git. Une demi-phrase suffit.
   - Vérifié : aucun fichier de données personnelles n'est committé par la branche (diff limité aux docs, aux lots déplacés et à `lots/reference.json`).

## Mineurs

2. **§10, seuil de compacité gravé trop fort.** « À 40 cases ou plus, ou avec 2 lignes pleines de nucléaire, une grille passe pour du remplissage » repose sur 0 ★ sur 3 grilles en M24. `v3-criteres-m24.md` (option C) le dit « calé sur Joueur 1 », et le challenger classe « les seuils de taille » parmi ce qui est calé sur les données qui le confirment. La mesure (`cells` plutôt que la part de nucléaire, AUC 0,89) est solide. Le seuil chiffré mérite « indicatif, à confirmer par `v3g6-compact` et des joueurs neufs ». À noter aussi : m24 propose de figer C1, C2, la couplée et la règle objective (option D), pas la compacité. Son ajout vient de la spec S10.4, il est défendable, mais pas avec un seuil présenté comme acquis.
3. **Règle objective de difficulté : nuance manquante.** La synthèse la classe « solide » avec 81 % d'accord en M24. Or m24 précise que la règle a été posée pendant M24, sur l'échelle que le joueur a décrite, et que l'accord « n'est pas indépendant : son échelle est comportementale par construction ». Ajouter cette réserve d'une ligne, et préciser qu'elle n'est pas testée sur un novice.
4. **Deux chiffres mal attribués ou approximatifs dans la synthèse.**
   - « 5 ★ sur 12 couplées en M23 (`v3-criteres-m23.md`) » : ce chiffre vient de `v3-challenge.md` (l. 27 et 44). `v3-criteres-m23.md` dit « 6 ★ sur 13 ». Citer le challenge, ou reprendre 6 sur 13.
   - Backlog tutoriel : « Un joueur occasionnel décroche après ~6 grilles ». `v3-criteres-j2.md` dit que Joueur 2 s'est arrêté après **8 grilles** (34 min actives) ; 6 grilles est la recommandation de session qui en découle. Écrire « s'arrête après 8 grilles, 34 min ; sessions de 6 grilles ».
5. **`v3-confort` n'apparaît nulle part.** Le lot `lab/candidates/v3-confort.json` existe seulement en non suivi sur `main`. Il porte 1 partie, 1 note et une session (`sessions/v3-confort.json`). Sa clé ne casse rien dans le dossier principal, puisque le fichier y est, mais la synthèse (§4, lots gardés et archivés) ne dit ni s'il est gardé, ni versionné, ni archivé. Le classer, ou l'archiver dans `candidates/archive/` et le versionner, pour que la clé résolve sur tout clone.

## Vérifié sans remarque

**Synthèse (`docs/next/v3-synthese.md`)**
- Chiffres recoupés dans les sources citées : C1 (1 ★ sur 7), C2 (0 ★ sur 7 ; 14 sur 19 contre 4 sur 18, p ≈ 0,002), couplée (2,25 contre 1,24, ρ 0,56, 69 grilles ; usure 2,33 / 3,0 / 2,08 / 1,86), compacité (AUC 0,89 contre 0,51, 9 commentaires, 0 ★ sur 3), nucléaire (12 sur 15 contre 42 sur 81, p = 0,04), règle objective (81 % et 71 %, 9 Faciles sur 15 avec erreurs), K (0,72 → 0,16 → 0,14), squelette (61 % contre 81 %, 3 sur 7), filtres (62 % contre 43 %, p = 0,65), Joueur 2 (+0,57 cran, 2,5 fois, 619 s, 14 gommes, 65 %), expertise (−8 % par session).
- Classements fidèles à la section « Verdict » de `v3-criteres-m24.md` (acquis, infirmé, ouvert, point par point) et compatibles avec le challenge : C2, classé « moyenne » par le challenger avant M24, est passé « acquis » dans m24 avec l'ancrage tenu ; « ★ si couplée » est bien rangé dans « plus dure ne veut pas dire plus belle ».
- Comptes sur une copie des vraies données : 55 grilles ★ par Joueur 1, toutes dans les lots gardés ; 8 ★ par Joueur 2.
- Tableau de promotion, 12 lignes : cases, note A (`difficulty.label`), ★ par joueur et commentaires conformes à `candidates/*.json` et `notes.json` (« n° » compté à partir de 1, comme dans le labo).
- Démarche, réglage recommandé et backlog : complets par rapport à la spec ; chaque point du backlog est actionnable.
- Emplacements S10.3 explicites : deux blocs « À remplir par S10.3 » (verdict de `v3g6-compact` / `matin-25` et plafonds `max_cells`, `max_full_n_rows` ; sort du lot).

**`GAME-DESIGN.md`**
- Seul §10 change : une phrase sur `reference.json` et le bloc « Critères figés » + « Règle objective ». Les autres sections sont intactes.
- Rien d'infirmé n'est gravé : K, trous et part de nucléaire sont dits « descriptifs » ; H1 et H3 n'apparaissent pas.
- La notation (§9) n'est pas modifiée ; les renvois « point 3 » et « point 7 » pointent bien sur le nettoyage et les décisions.

**Archives**
- 7 lots déplacés par `git mv` (renommages purs) : `v3-rampe`, `v3-reprises`, `v3g1-jouer-a/b/c`, `v3g2-jouer-a/b`, plus `V3G1.md`.
- Sur une copie de `lab/plays.jsonl` (131 parties), `notes.json` (100 clés) et `sessions/*.json` (99 items) du dossier principal : aucune clé ne pointe vers un lot archivé, toutes les autres résolvent dans la branche et aucun index n'est hors bornes. Seule exception : `v3-confort` (point 5).
- Serveur du labo lancé sur une copie (branche + vraies données) : 13 lots listés (les 13 annoncés comme gardés), 8 sessions ouvertes sans erreur, notes et parties servies.
- Renvoi mis à jour dans `docs/next/solver-v2.md` (`archive/V3G1.md`).

**`lab/lots/reference.json`** : mélange et quotas conformes à la description de la synthèse §4 et au commentaire du fichier ; nom de lot `v3-ref-1` libre.

**`CLAUDE.md`** : à jour (référence, sessions, ★ par joueur, archive, synthèse), concis, sans historique. Hors le point 1.

**Conventions** : commit en anglais, auteur noreply du dépôt, aucune mention de Claude ni d'IA, documents en français.

## Tests

Lancés dans le worktree `v3-cleanup`, avec le `.venv` du solveur du dossier principal (le code du solveur est inchangé par la branche) :

- `python -m pytest lab/tests -q` : **341 passed** (39 s).
- `cd solver && pytest -q` : **222 passed** (5 min 26).
- `cd web && npm ci && npm test` : **432 tests, 11 fichiers, verts**.
- `python scripts/check_unique.py` : **OK**, toutes les grilles uniques et déductibles.
- `dispatch-solver generate lab/lots/reference.json --out <scratchpad>` : 20 grilles sur 20 en 31 s. 7 Faciles, 8 Moyens, 3 Difficiles, 2 Experts ; médiane 28 cases ; 4 grilles à 40 cases ou plus (41, 50, 50, 51). La synthèse annonce 8 Faciles, 7 Moyens et une médiane de 27 : l'écart porte sur une grille, sans effet sur la conclusion. Elle vient sans doute du code de `main` contre celui de l'essai. Pour info seulement.
- Worktree resté propre après les tests (`node_modules/` ignoré).
