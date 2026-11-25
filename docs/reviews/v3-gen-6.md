# Review v3-gen-6 — lot compact `v3g6-compact` (S10.10)

Branche `v3-gen-6` (2 commits, `7e48cfb` code, `eba71b1` lot), auteur `s5`. Base `963fb6c`, `main` est à `0705993`.

## Verdict : **OK à merger**

Aucun point bloquant. Le code est petit, éteint par défaut, testé. Le lot tient ses plafonds (≤ 29 cases, ≤ 1 ligne pleine). Il est nettement plus compact que `v3g4-jouer-a` et `v3g5-squelette`. Il est plus facile qu'eux, et un quart de ses grilles est monotone (une seule pièce haute, Facile). Trois points sont à corriger après le merge, dans la doc ou à la préparation de la session.

## Points

### Écart de quotas : valeur finale différente de celle annoncée (mineur, à corriger dans le suivi)

- **Ce qui est annoncé** : `max_per_mix` passé à 3, avec `max_cells` 30 et le plafond `exchange` d'origine.
- **Ce qui est livré** : `max_per_mix` reste à **2**, `max_cells` 30, `max_full_n_rows` 1, `exchange` ≤ 10 d'origine.
- **L'assouplissement réel** est le plancher `min_with_type.stock`, passé de **2 à 1**. C'est le seul écart aux quotas de `v3g4-jouer-a`.
- **Où c'est documenté** : `lab/candidates/V3G6.md` (« Un écart à la consigne »), dans le `comment` de `lab/lots/v3g6-compact.json` et dans l'alerte de l'auteur. `V3G6.md` dit aussi que l'alerte « 32 cases » est caduque.
- **Pourquoi** : 6 essais à 19/20 (graines 6262 et 6363, `exchange` 10-14, 30 ou 32 cases, `max_per_mix` 2 ou 3). La dernière place devait combler deux manques à la fois, dont une 2e grille `stock` : une petite journée vide rarement le barrage. L'explication tient.
- **Conséquence** : le lot ne compte qu'**une** grille `stock` (n°12). Le récap de l'orchestrateur doit citer le plancher `stock` à 1, pas `max_per_mix` 3.

### `max_cells` et `max_full_n_rows` (OK)

- **Éteints par défaut** : `QUOTAS` les met à `None`, et `check_lot` accepte `None` ou un entier ≥ 0 (testé, -1 rejeté).
- **Aucun effet sur les lots existants**, vérifié à la lecture :
  - sans plafond, `over_size` rend toujours faux ;
  - la journée plus basse (`LOW_HEIGHTS`) ne se tire que sous `max_cells`, donc le générateur aléatoire n'est pas consommé autrement et une même graine redonne le même lot ;
  - la forme à 3 éléments de `_attempt` reste valide (testé).
- **Rejet `quota:cells` correct** :
  - il est pris dans le processus de tirage juste après la pose de référence, avant les indices : 118 rejets sur 217 tirages, pour 24 s au total ;
  - `Quotas.check` refait le contrôle, en filet ;
  - `reference_size` (sans plateau) donne exactement `cells` et `full_n_rows` du bloc `lab`, grilles STEP comprises (testé ; l'auteur l'a vérifié sur 220 grilles des lots existants).
- **Tests** : `solver/tests/test_size_caps.py`, 5 tests. Ils couvrent les bornes, les clés de lot, le rejet dans le processus de tirage, l'égalité des mesures et la journée plus basse.
- **Pas un motif** : c'est un plafond de taille, pas une composition imposée. Il colle à §10 « Critères figés » (compacité = nombre de cases) et à `v3-synthese.md` §2. La part de nucléaire reste libre (médiane 0,78).

### Lot `v3g6-compact` (OK, avec deux réserves)

- **`check --strict --no-ramp`** : exit 0 sur les 20 grilles (relancé).
- **Test de dessin** (`lab/tests/test_candidate_drawings.py`) : voir « Tests ».
- **Mesures recalculées** depuis le JSON. Elles concordent avec `V3G6.md` :

| | `v3g4-jouer-a` | `v3g5-squelette` | `v3g6-compact` |
|---|---|---|---|
| `cells` min-médiane-max | 18-25,5-66 | 16-27-41 | **16-23,5-29** |
| Grilles > 30 cases | 6 | 6 | **0** |
| `full_n_rows` 0 / 1 / ≥ 2 | 14 / 1 / 5 | 16 / 1 / 3 | 16 / 4 / **0** |
| `nuclear_share` médiane | 0,81 | 0,61 | 0,78 |
| F / M / D / E | 7 / 9 / 2 / 2 | 6 / 10 / 2 / 2 | **10 / 6** / 2 / 2 |
| Familles (max par famille) | 7 (3) | 7 (3) | 7 (3) |
| Ensembles de mécaniques | 15 | 13 | 15 |
| Ensembles de décisions | 12 | 11 | **9** |
| Max par entrée du mélange | 2 | 2 | 2 |

- **Plus compact, franchement oui** : aucune grille au-delà de 29 cases (seuil de reproche de la synthèse : 40, ou 2 lignes pleines). C/D médian 6,85 contre 8,65 et 9,65.
- **Notes** : 2 Difficile + 2 Expert = 4, la demande (au moins 3) est tenue. Elles font de 23 à 28 cases.
- **Réserve 1, plus facile (mineur)** : 10 Facile sur 20, contre 7 et 6. Pour une session finale, la moitié du lot en Facile pèse sur le ressenti. `V3G6.md` le dit et propose `min_per_rating {"2": 6}`, sans l'essayer.
- **Réserve 2, monotonie partielle (mineur)** : 5 grilles n'ont qu'une décision `tall` et sont toutes Facile (n°2, 4, 8, 14, 17). C'est un quart du lot sur le même schéma : pose une pièce haute, remplis le reste. Le quota `max_same_single_decision` 6 le permet. Le reste du lot est varié : 9 ensembles de décisions, 15 de mécaniques, 7 familles. Il n'est donc **pas monotone dans l'ensemble**, mais à la session, ces 5 grilles risquent de se ressembler. À noter dans les prédictions de la session.
- **Diversité réduite par la taille** : un seul lot à 12 créneaux (n°13), 17 trous au lieu de 28-30, 3 grilles à une seule sorte de centrale (n°6, 7, 10, par `allow_one_plant`). C'est l'effet attendu d'un plafond de taille ; à garder en tête pour l'interprétation.

### Méthode du labo (mineur)

- `CLAUDE.md` et la synthèse §3 demandent des témoins dans chaque session, pas de quota ajouté sans lot témoin. `max_cells` est éteint par défaut et n'entre pas dans `reference.json` : c'est conforme. La session `matin-25` doit mêler des témoins (par exemple `v3g5-temoin`) pour que S10.3 puisse trancher l'ajout des plafonds à la référence.

### Doc `GAME-DESIGN.md` §10 (mineur)

- Le paragraphe « Taille » est clair et place le rejet au bon endroit (point 6, `quota:cells`).
- Il finit par « Lot `v3g6-compact` : 30 cases, 1 ligne pleine ». C'est un réglage de lot dans une spec générale. La synthèse (§4) et `V3G6.md` le portent déjà : la phrase pourrait sortir de §10.
- L'en-tête de `lot.py` est à jour (une ligne longue dépasse les autres, sans gravité).

### Merge avec `main` (OK)

- `git merge-tree --write-tree main v3-gen-6` : **aucun conflit**, `GAME-DESIGN.md` compris.
- Après merge, §10 reste cohérent : le paragraphe « Taille » précède « Quasi-jumelles », et les « Critères figés » de `main` (compacité = `cells`, seuils de 40 cases indicatifs) le motivent. La synthèse attend justement ce lot (« à confirmer par `v3g6-compact` », §4 « À remplir par S10.3 »).
- Pas de collision avec le rangement de `main` (`candidates/archive/`, données de jeu hors git) : la branche n'ajoute que des fichiers neufs sous `lab/`.

### Conventions (OK)

- Code, commentaires, tests et messages de commit en anglais ; doc en français. Aucune mention de Claude ou d'IA.
- Branche sans `/`. Ni `web/`, ni `grids.json`, ni les lots existants ne sont touchés.
- Point déjà connu, non corrigé : l'impasse de quotas en fin de lot n'est pas détectée tôt. Elle a coûté plus de 45 min (backlog de la synthèse §5).

## Tests (relancés dans le worktree `v3-gen-6`)

- **Solver** (`cd solver && .venv/bin/pytest -q`) : **227 passed** (3e passe, 7 min 51 s).
  - Les 2 passes précédentes : 226 passed, 1 failed. C'est le même test, `test_deduce.py::test_refutation_has_a_budget`, une borne de 10 s en temps réel, dépassée (13 et 16 s) sous une charge machine de 24 à 63.
  - La branche ne touche ni la déduction ni ce test : c'est un test lent sous charge, pas une régression. Mineur, hors branche : cette borne en temps réel rendra la CI instable si la machine est chargée.
  - `tests/test_size_caps.py` + `tests/test_generate.py` relancés à part : 43 passed.
- **`dispatch-solver check-published`** : OK, chaque grille publiée est unique et déductible.
- **`check --strict --no-ramp lab/candidates/v3g6-compact.json`** : exit 0.
- **Labo** (`python -m pytest lab/tests -q`, test de dessin compris) : **487 passed**.
- **Web** (`npm test`, Vitest) : **432 passed**. `scripts/check_unique.py` : « every grid is unique and deducible ».
- **Merge à blanc** (`git merge-tree`) avec `main` à `0705993` : aucun conflit.
