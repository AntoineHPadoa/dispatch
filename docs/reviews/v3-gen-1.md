# Review — `v3-gen-1` (générateur v3-gen-1 et lots `v3g1-*`, S4.1)

Relu par `s6` le 22 novembre 2026. Branche `v3-gen-1`, 2 commits (`4b651bc`, `450cc02`) sur `main` (`0481622`). Spec : `workers/s5.md`, avec la règle des indices de confort retirée en cours de route.

## Verdict : **OK à merger**

Le code fait ce que la spec demande, les 60 grilles passent toutes les vérifications et tous les tests sont verts. Aucun point bloquant.

Un point de fond est à traiter dans une tâche suivante, pas avant le merge : le quota limite les grilles « échanges seuls », mais **les échanges restent présents dans 65 % des grilles**. Détail et propositions au point 1.

## Vérifications rejouées

| Vérification | Résultat |
|---|---|
| `cd solver && .venv/bin/pytest -q` | 190 passed (3 min 30) |
| `solver/.venv/bin/python -m pytest lab/tests -q` | 237 passed, dont `test_candidate_drawings.py` sur les 60 nouvelles grilles |
| `web/` : `npm test` | 428 passed |
| `web/` : `check_unique.py` | OK, toutes les grilles publiées |
| `check-published`, `main` contre branche | sorties identiques (14 lignes) : site non touché |
| `dispatch-solver check --strict` sur `v3g1-jouer-a/b/c` | exit 0 ×3 ; 60/60 valides, 1 composition = référence, déduites |
| Script de contrôle sur les 60 grilles | 0 voisin sans échange, 0 plafond CO₂ sans étape `carbon`, 0 grille sans décision ; `decisions()` et note recalculées = bloc `lab`, 60/60 |
| Calage sur `v3-jouer-a` (`exchange` + `step`) | identique à la colonne « Déc. » de `v3-criteres.md`, 20/20 |
| Lots `v3-jouer-*`, `web/`, `fixtures/` | aucun fichier modifié par la branche |
| Règle des indices de confort | absente : `GAME-DESIGN.md` l. 124 garde « Aucun indice inutile » ; `cluesel.py` ne change que la référence « §10 step 4 → 5 » |
| Commits | auteur noreply, messages en anglais, aucune mention d'IA |

### Trace contre décompte, 5 grilles à la main

| Grille | Décisions (`lab`) | Lecture de la trace | Accord |
|---|---|---|---|
| a n° 10 (index 9) | `exchange: 1` | export BE à 8h fixé par `silhouette` (1) ; l'import BE à 16h n'est jamais posé par une étape, seulement atteint par exclusions (non compté, conforme à la définition) | oui |
| a n° 6 (index 5) | `exchange: 3, stock: 1` | 2 imports DE posés par `single_cover`, export DE à 21h par `silhouette` ; B `max_cells` 2 utilisé en entier, étape `exhausted` sur B | oui |
| b n° 3 (index 2) | `exchange: 3, carbon: 1` | export IT 21h par `record`, 15h par `ribbon`, import IT 3h par `single_cover` ; étape `carbon` (exclut 3 imports) | oui |
| c n° 1 (index 0) | `exchange: 2, step: 1` | `exhausted` fixe la paire 8h → 20h et les exports DE 4h et 8h | oui |
| b n° 19 (index 18) | `exchange: 1, stock: 1` | export DE 20h par `silhouette` ; B 3/3 cases, `exhausted` applique le stock | oui |

Une étape `flow` n'est jamais comptée : le code exige une règle autre que `flow` et l'absence d'indice `flow` (test `test_a_published_flow_is_not_a_decision`, passé sans skip).

## Points

### 1. Quota de diversité : appliqué, mais il ne répond qu'à moitié à la demande — mineur (suite à donner)

- **Appliqué et documenté** : `max_same_single_decision` (6 sur 20, par type) dans `lot.py`, `GAME-DESIGN.md` §10 étape 8, `solver-v2.md` §17, `V3G1.md`. Test `test_single_decision_quota`.
- **Répartition réelle** (grilles qui contiennent le type) :

| Type | a | b | c | Total |
|---|---|---|---|---|
| `exchange` | 14 | 15 | 10 | **39 / 60** |
| `tall` | 7 | 6 | 7 | 20 |
| `step` | 5 | 4 | 9 | 18 |
| `carbon` | 1 | 3 | 3 | 7 |
| `stock` | 1 | 1 | 0 | 2 |
| `price`, `ramp` | 0 | 0 | 0 | 0 |

- **Ce que le quota fait** : il plafonne les grilles « échanges seuls » (6 / 6 / 5) et oblige à marier les échanges à une 2e mécanique. 26 grilles sur 60 ont 2 mécaniques vivantes, contre 5 sur 20 dans `v3-jouer-a`.
- **Ce qu'il ne fait pas** : le lot A a toujours 14 grilles sur 20 avec des échanges, exactement comme `v3-jouer-a`. CO₂ (7/60) et stock (2/60) restent marginaux, `price` n'apparaît jamais. Le quota compte les grilles à type unique, pas la présence d'un type. Le jeu repose donc toujours d'abord sur les échanges, puis sur la pièce haute et la STEP.
- **Ce qu'il faudrait changer** :
  - **Plafond de présence** : `max_with_type: {"exchange": 10}`, soit au plus la moitié des grilles avec un échange à trouver, quelle que soit l'autre mécanique.
  - **Plancher par type**, sur le modèle de `min_per_rating` : `min_with_type: {"step": 4, "tall": 4, "carbon": 3, "stock": 2}`, avec des tirages qui visent les types manquants comme pour les notes.
  - **Mélanges sans voisin** : le lot C montre que STEP + CO₂ en carnet libre marche (c n° 14, 15, 18, avec décisions `step` + `carbon`). Ajouter STEP + CO₂, stock + pièce haute, stock + STEP.
  - **`price`** : le type est mesuré mais n'apparaît jamais (`top_price` rare). Soit la sélection d'indices le favorise dans une entrée dédiée, soit on le sort de la liste pour ne pas promettre une mécanique qui n'existe pas.

### 2. Grilles « pièce haute seule » : 10 sur 60 reposent sur une hypothèse non testée — mineur

- `tall` vaut 1 dès qu'une barre de charbon fait 2 de haut, conformément à la spec (« pièce haute posée en 2 »).
- 10 grilles n'ont que cette décision : a n° 13, 14, 16, 18 ; b n° 8, 17, 18 ; c n° 5, 16, 20.
- Or C5 (« la pièce haute compte comme une décision ») est une hypothèse que la session 3 teste justement. Si elle tombe, ces 10 grilles sont du remplissage. À relire après la session 3 ; à signaler à l'humain avant qu'il joue ces lots.

### 3. Imports atteints par élimination non comptés — mineur

- Sur les 31 imports des 60 grilles, 18 sont posés par une étape (`single_cover`) et comptés. 13 ne sont jamais posés explicitement : le solveur les atteint par exclusions (`room`, `exhausted`…), puis ils tombent au comptage final.
- C'est la définition choisie et documentée (« un import trouvé en comptant les colonnes à la fin n'en est pas une »), et elle redonne le calage 20/20. Mais une partie de ces 13 imports demande au joueur un vrai choix d'emplacement (a n° 10 : 3 exclusions successives sur I:BE). Le décompte est donc un minorant pour les imports. À garder en tête si le seuil « ≥ 2 décisions » est testé.

### 4. Chiffres de `V3G1.md` : exacts, à une approximation près — mineur

- Vérifiés et exacts : notes par lot, tirages, rejets (les 26 lignes), temps, décisions par type, décisions par grille, types uniques, mécaniques vivantes, prix sur N, carnets exacts / libres, créneaux, rappel `v3-jouer-a` (5 sans décision, 6 sans échange ni STEP, 5 à 2 mécaniques vivantes).
- **Écart** : barres médianes indiquées 9 (A) et 10 (B), alors que le calcul donne 8,5 et 9,5. C : 9, exact. Min-max exacts.

### 5. Faciles — conforme

- 4 / 5 / 3. Les 3 Faciles de C sont expliquées dans `V3G1.md` (rejet `no_decision` et quota de type unique), sans forcer. Accepté par l'orchestrateur.

### 6. Nettoyage des mécaniques mortes — conforme

- Voisins retirés : 3 / 5 / 6, tracés dans `lab.cleaned`. Le label `mechanics` est recalculé après nettoyage (a n° 9 : `neighbors:2`, UK retiré).
- Aucun plafond CO₂ retiré dans les lots : les entrées CO₂ sont en carnet libre, où le plafond sert 7 fois sur 7. Le chemin de retrait est couvert par `test_dead_mechanics_are_cleaned`, qui exige au moins un retrait.
- Après retrait du plafond, unicité (CP-SAT) et déduction sont refaites et la note est recalculée. La minimalité des indices tient tant que la déduction est monotone, ce que `solver-v2.md` §17 affirme.

### 7. Mesures seules et conventions — conforme

- `live_mechanics`, `bars`, `nuclear_prices` et `cleaned` sont présents dans le bloc `lab` et agrégés dans `.stats.json`. Aucun ne filtre.
- En-têtes de `lot.py` et `trace.py` à jour, en anglais. Clé `min_decisions` validée par `check_config()` et testée.
