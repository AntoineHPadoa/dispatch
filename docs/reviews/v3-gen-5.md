# Review `v3-gen-5` (S8.2)

Branche `v3-gen-5` (worktree `~/Programs/spot-elec-v3-gen-5`), 3 commits `cdefd09`, `3575252`, `f119599`, auteur `s5`. Diff `main...v3-gen-5`. Spec : `workers/s5-gen5.md`, réorientée en cours de nuit (mesures pour décrire seulement, options éteintes, lots `v3g5-temoin` et `v3g5-squelette`).

## Verdict : **OK à merger**

Aucun point bloquant. Les mesures sont conformes et recalculées à l'identique. Les options éteintes n'ont aucun effet par défaut. Les lots existants ne changent que dans leur bloc `lab`. Les deux lots sont valides et reproductibles, et tout est vert.

**Le squelette est un demi-succès.** Il réussit comme lot d'essai, mais pas encore comme correctif : le nucléaire recule au milieu de la distribution, pas dans la queue basse (voir §4).

## 1. Ce qui a été lancé

| Commande | Résultat |
|---|---|
| `cd solver && .venv/bin/pytest -q` | **222 passed** (5 min) |
| `.venv/bin/dispatch-solver check-published` | OK, inchangé |
| `solver/.venv/bin/python -m pytest lab/tests -q` (avec `test_candidate_drawings.py`, le test de dessin) | **467 passed** (427 + les 40 nouvelles grilles) |
| `web/` : `npm test` | 432 passed |
| `web/` : `../solver/.venv/bin/python scripts/check_unique.py` | OK |
| `dispatch-solver check --strict` sur `v3g5-temoin` et `v3g5-squelette` (sans `--no-ramp`) | exit 0 et exit 0 |
| `git diff main...v3-gen-5 -- web` | vide : `web/` et `grids.json` intacts |
| Régénération des deux lots (`generate --workers 6` et `--workers 10`, graines 2424 et 2525) | **20/20 grilles identiques** à celles du commit, bloc `lab` compris (hors `seconds`) |

## 2. Mesures

- **Conformité aux définitions (`v3-criteres-m23.md` §2-3)**
  - `cells`, `full_n_rows` et `cells_per_decision` (cases / Σ `DECISION_WEIGHTS`) suivent le §2.
  - `holes` suit le §3 : trous de 1 ou 2 cases sûres sous toutes les silhouettes, fermés par une brique ou le bord (une brique au moins) ; types tirés de `View.dom` (imports en `I`) ; unique / contesté au point fixe du niveau 1.
  - Lire le point fixe dans la trace complète est juste : les règles sont triées par niveau dans `Solver.rules`, donc le dernier tour avant la 1re étape de niveau ≥ 2 est bien le point fixe du niveau 1.
  - Le crochet `Solver.observe` est neutre quand il vaut `None`.
- **Recalcul indépendant sur 6 grilles.** Mon script trouve les trous à part et prend le point fixe par une 2e déduction bornée (`max_level = 1`). Les 6 grilles : squelette n°1 et n°8, témoin n°4, `v3g4-jouer-c` n°10, `v3g3-jouer-a` n°16, `v3g3-jouer-b` n°13.
  - `cells`, `full_n_rows`, `nuclear_share`, `cells_per_decision`, `holes.n` et `holes.unique` : **identiques** sur les 6.
  - `cells` est aussi recoupé par la somme des `len × height` des poses.
  - Contestés : identiques, y compris v3g3-a n°16 (3 trous GTI, dont 2 contestés : le 3e est tranché par une étape triviale).
  - v3g3-b n°13 redonne les chiffres de la spec : 50 cases, 4 lignes pleines, 96 % de nucléaire.
- **Tests** : `solver/tests/test_holes.py`, 12 tests. Ils couvrent les trous, le calage sur 4 grilles de la spec, les agrégats, `rerate()`, le plafond de nucléaire, `allow_one_plant`, et les options éteintes (`filler` éteint, quota doux qui ne rejette jamais, `min_per_rating` par note).
- **`rerate_lots.py` sur les 9 lots actifs** (180 grilles), comparés à `main` grille par grille :
  - hors bloc `lab`, **0 différence** : aucune `difficulty`, aucune grille, aucun indice n'a changé ;
  - dans `lab`, seulement les 5 nouvelles clés (`cells`, `full_n_rows`, `nuclear_share`, `cells_per_decision`, `holes`) ;
  - `.stats.json` : seulement les nouveaux agrégats et `rerated`.

## 3. Options éteintes : aucun effet par défaut

- **`hole_types` et `max_nuclear`** absents : le rng n'est pas consommé (`draw_hole_types` n'est pas appelé, pas de tirage de plafond). `solve_reference` ne fait qu'un essai, sans contrainte ajoutée, comme avant.
- **`allow_one_plant`** à `False` : le rejet `one_plant` est inchangé.
- **`filler_cells` et `min_with_contested`** à `None` :
  - `holds()` rend `False` et la file `held` reste vide ;
  - le `drain(final=True)` ajouté en fin de boucle ne peut rien accepter de plus, car l'état des quotas n'a pas bougé depuis le dernier `drain` qui a suivi une acceptation.
- **`min_per_rating` en nombre** : `need()` rend ce nombre, et le comportement est celui d'avant.
- **Preuve indirecte** : la régénération du témoin, qui ne pose aucune de ces options, retombe sur les mêmes 20 grilles.

## 4. Les deux lots

### Témoin `v3g5-temoin`

- **Mélange** : les 9 entrées de `v3-jouer-a`, identiques. Seul ajout : `min_decisions: 0` sur chaque entrée (le `v3` n'avait pas de rejet `no_decision`).
- **Quotas** : ceux de `v3-jouer-a`. Aucun `min_with_type`, `max_with_type`, `max_same_single_decision`, `max_per_mix`, `max_with_cols` ni `max_demand_price`. Écart accepté : Expert minimum à 0.
- **Reproductible** avec la graine 2424 : vérifié (6 processus).
- **Profil** :
  - F / M / D / E = 7 / 7 / 6 / 0 ;
  - le plus nucléaire de tous les lots : médiane 0,88, 16 grilles à 80 % ou plus ;
  - n°11 : 87 cases, 6 lignes pleines.
- **Effet** : c'est bien « l'ancien mélange vu par le générateur actuel ». Le nettoyage C1 et la notation A changent son profil (17 grilles avec échange, 8 couplées, contre 13 et 2 dans `v3-jouer-a`). Le témoin mesure donc les entrées d'avant, pas le générateur d'avant. C'est ce qui était demandé ; il faut s'en souvenir en lisant la session.

### Squelette `v3g5-squelette`

Mélange de `v3g4-jouer-a`, avec `max_nuclear: [0.3, 1.0]` et `allow_one_plant` sur ses 12 entrées. Plafond `exchange` à 12 (écart accepté).

| | `v3g4-jouer-a` | `v3g5-squelette` |
|---|---|---|
| Part de nucléaire, médiane | 0,81 | **0,61** |
| Part de nucléaire, moyenne | 0,69 | 0,63 |
| Grilles à 80 % ou plus | 10 | **6** |
| Grilles sous 50 % | 5 | **5** |
| Cases de nucléaire par grille, médiane | 20 | 18,5 |
| Autres cases, médiane | 7 | 11,5 |
| Cases, médiane | 25,5 | 27 |
| Grilles à 3 lignes pleines de N ou plus | 3 | 1 |
| Tirages pour 20 grilles | 171 | 464 (dont 301 `too_many_clues`) |
| F / M / D / E | 7 / 9 / 2 / 2 | 6 / 10 / 2 / 2 |
| Grilles à trou contesté | 2 | 1 |

- **Unique, déductible, valide** : `check --strict` exit 0, test de dessin vert, reproductible (graine 2525, 10 processus).
- **Variées** :
  - 7 familles ;
  - 1 à 5 sortes de centrales par grille ;
  - 6 types de décision.
  - Une paire est identique pour la mesure de Jaccard (n°8 et n°11), mais pas au jeu : 50 % contre 19 % de nucléaire.
- **Le nucléaire baisse vraiment, mais au milieu de la distribution.**
  - Le plafond rabote les grilles très nucléaires : 10 → 6 à 80 % ou plus.
  - La queue basse ne bouge pas : 5 grilles sous 50 % de chaque côté.
  - La quantité de nucléaire bouge à peine (médiane 20 → 18,5 cases). Les autres centrales s'ajoutent plus qu'elles ne remplacent.
- **Les plafonds bas meurent au choix d'indices.**
  - Aucune grille gardée n'a un plafond sous 0,42. Un tirage uniforme sur [0,3 ; 1] en donnerait environ 17 %, soit 3 à 4 grilles sur 20.
  - Les 65 % de rejets `too_many_clues` portent donc surtout sur les squelettes les plus maigres.
- **Une seule sorte de centrale (`one_plant` levé)** : oui, 2 grilles, n°18 et n°20. Elles sont jouables : Moyen, uniques et déductibles, 11 et 30 étapes. Mais ce ne sont pas des G7 :
  - G7 : nucléaire + import, carnet exact à longueurs concurrentes, STEP, 2 exports, Difficile ;
  - n°18 : nucléaire + 5 imports, carnet libre, 86 % de nucléaire, K = 0,08, une seule décision (échange) ;
  - n°20 : 12 créneaux, nucléaire + 2 voisins, carnet libre, 82 % de nucléaire, K = 0,27, 30 étapes dont 3 de niveau 2.
  - Sans carnet exact ni STEP, une grille à une seule sorte devient un remplissage de nucléaire : la plainte que le squelette visait.
- **Franchement, le squelette n'est réussi qu'à moitié.**
  - Il est réussi comme lot d'essai : deux contraintes retirées, sans règle ajoutée, et des grilles valides qui font un vrai contraste pour la session.
  - Il n'est pas encore un correctif :
    - la queue basse ne bouge pas ;
    - les plafonds bas sont filtrés par le coût en indices ;
    - les grilles à une seule sorte sont l'inverse de G7 ;
    - les grandes grilles peu nucléaires, la case qui départagerait H2, n'y sont pas : 0 Difficile ou Expert à 40 cases ou plus, 1 grille à 12 créneaux.
  - Le bilan de l'auteur (`V3G5.md`, « Ce qui n'a pas marché ») le dit déjà en grande partie.

## 5. Points

1. **Mineur : `lab.nuclear_cap` ne dit pas si le plafond a servi.**
   - Le plafond tiré est écrit même quand la référence a été refaite sans lui, faute de solution (repli de `solve_reference`).
   - Sur ce lot, aucune grille ne dépasse son plafond, donc rien n'est faux aujourd'hui. Mais la mesure peut mentir.
   - Suggestion : `nuclear_cap: null` ou `nuclear_cap_applied: false` en cas de repli.
2. **Mineur : les plafonds bas sont filtrés en silence.**
   - Aucune grille gardée sous 0,42 (≈ 17 % attendus).
   - Les stats ne comptent pas les rejets par plafond tiré : on ne peut pas savoir combien de `too_many_clues` viennent des plafonds bas.
   - À ajouter avant un 2e essai (par exemple `[0,3 ; 0,7]`, comme le propose l'auteur).
3. **Mineur : la levée de `one_plant` donne des grilles nucléaire + import en carnet libre**, pas des G7. Pour viser G7, il faudrait la réserver à une entrée en carnet exact avec STEP. C'est une piste à décider, pas un défaut du code.
4. **Mineur : `ramp_settled_by` est apparu dans les vieux lots** (`v3-jouer-*`, `v3g3-*`), sous la forme `{}` là où la clé manquait. C'est dans le bloc `lab`, sans effet, mais `V3G5.md` et la docstring de `rerate_lots.py` ne le disent pas.
5. **Mineur : `holes` ajoute « pose un import »** aux étapes non triviales. La spec ne cite que le niveau ≥ 2 et l'échange.
   - C'est cohérent avec la décision `exchange` du §10.7 (une barre d'import posée par une étape), et c'est documenté.
   - Seule conséquence : les chiffres ne sont pas exactement comparables à ceux de la spec si elle ne comptait pas ce cas.
6. **Mineur : le témoin et le squelette dépendent du nombre de processus.**
   - C'est vérifié : même lot avec `--workers 6` et `--workers 10` respectivement.
   - C'est noté dans `.stats.json` (`workers`) et dans `V3G5.md`, mais pas dans le `comment` des fichiers de lot. Qui relance avec la valeur par défaut obtient un autre squelette.
7. **Mineur, hérité : l'impasse `max_per_mix` × plafond `exchange`** n'est toujours pas détectée tôt (review v3-gen-4, point 4). L'auteur le signale, et elle a coûté un assouplissement au squelette.
8. **Conventions** : respectées.
   - Code et commentaires en anglais ; en-tête court de `holes.py`.
   - Commits signés de l'adresse noreply, sans mention d'IA.
   - Branche sans `/`.
   - `GAME-DESIGN.md` §10 et `solver-v2.md` §20 sont à jour.
