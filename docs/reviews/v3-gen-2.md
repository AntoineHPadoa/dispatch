# Review — `v3-gen-2` (diversité des décisions, lots `v3g2-*`, S4.11)

Relu par `s6` le 22 novembre 2026. Branche `v3-gen-2`, 2 commits (`1110d12`, `c3ee0ce`) sur `main`. Spec : `workers/s5-div.md`, avec le complément « mécaniques globales en priorité, au moins 4 grilles par lot ».

## Verdict : **OK à merger**

Les quotas par type font ce que la spec demande et sont testés. Les 60 grilles passent `check --strict`, tiennent tous les quotas et sont recalculées à l'identique. Les chiffres de `V3G2.md` sont exacts, à un pourcentage près. Tous les tests sont verts. Aucun point bloquant.

Trois points mineurs touchent la réservation des planchers (points 1 à 3). Ils ne jouent sur aucun des lots livrés, mais il faut les corriger avant de générer d'autres lots avec des planchers serrés.

## Vérifications rejouées

| Vérification | Résultat |
|---|---|
| `cd solver && .venv/bin/pytest -q` | 196 passed (3 min 33) |
| `solver/.venv/bin/python -m pytest lab/tests -q` | 297 passed, dont `test_candidate_drawings.py` : 60/60 grilles `v3g2` |
| `web/` : `npm test` | 429 passed |
| `web/` : `check_unique.py` | OK |
| `check-published`, `main` contre branche | sorties identiques |
| `dispatch-solver check --strict` sur `v3g2-jouer-a/b/c` | exit 0 ×3 ; 60/60 valides, 1 composition = référence, déduites |
| `decisions()` et note recalculées avec `deduce()` | identiques au bloc `lab`, 60/60 |
| Fichiers touchés | ni `web/`, ni `fixtures/`, ni `deduce/`, ni les lots `v3-*` / `v3g1-*` |
| Commits | auteur noreply, messages en anglais, aucune mention d'IA |

## Recomptage des lots (grilles qui contiennent le type)

| | a | b | c | v3g2 | v3g1 | Quota |
|---|---|---|---|---|---|---|
| `exchange` | 10 | 10 | 7 | 27 | 39 | ≤ 10 ✔ |
| `step` | 9 | 12 | 12 | 33 | 18 | ≥ 4 ✔ |
| `tall` | 6 | 6 | 4 | 16 | 20 | ≥ 4 ✔ |
| `carbon` | 5 | 7 | 6 | 18 | 7 | — |
| `stock` | 2 | 4 | 4 | 10 | 2 | ≥ 2 ✔ |
| `price` / `ramp` | 0 / 0 | 0 / 0 | 1 / 0 | 1 / 0 | 0 / 0 | — |
| `step+carbon` | 3 | 5 | 5 | 13 | 3 | ≥ 3 ✔ |
| `step\|carbon` (globale) | 11 | 14 | 13 | 38 | 22 | ≥ 6, et ≥ 4 du complément ✔ |
| Type unique `exchange` / `step` / `tall` | 4 / 3 / 3 | 3 / 0 / 0 | 4 / 3 / 1 | 11 / 6 / 4 | 17 / 7 / 10 | ≤ 6 ✔ |

- **Échanges** : au plus la moitié des grilles dans chaque lot (10, 10, 7).
- **Mécaniques globales** : de 11 à 14 grilles par lot, bien au-delà du minimum de 4.

## Points

### 1. Un lot plein peut finir avec un plancher non tenu, sans le signaler — mineur

- **Mode « réduire »** : tant que la somme des manques (notes + types) dépasse les places, la règle accepte toute grille qui la réduit d'au moins 1 (`d_after < d_now`).
- **Mais cette somme est gonflée** dès que les clés se recouvrent : une grille STEP réduit à la fois `step` et `step|carbon`. Dans les lots livrés, la somme part à 31 pour 20 places (12 pour les notes, 19 pour les types). Le lot reste donc longtemps dans ce mode, où l'on ne vérifie plus que la fin reste atteignable.
- **Contre-exemple rejoué** sur `Quotas` : taille 4, `min_with_type: {"stock": 2, "step": 1, "step|carbon": 2}`. Avec les grilles `carbon`, `carbon`, `stock`, `stock`, les 4 sont acceptées. Le lot est plein et le plancher `step` reste à 0. La 2e grille `carbon` réduit la somme gonflée (4 → 3) alors que le vrai besoin passe à 3 grilles pour 2 places.
- **Conséquence** : `run_lot` rend 20/20 et la CLI sort en 0. Seul `stats.decisions.grids_with_key` montre le trou.
- Les 3 lots livrés tiennent tous leurs planchers (recomptés plus haut).
- **À faire** :
  - en fin de `run_lot`, comparer `grids_with_key` à `min_with_type` ; si un plancher manque, sortir en 1 ou au moins écrire `unmet_floors` dans les stats ;
  - en mode « réduire », exiger que la grille réduise un vrai manque. Le plus simple est de calculer les manques sans compter deux fois une clé couverte par une autre.
  - Ajouter un test sur ce cas.

### 2. `check_lot()` laisse passer des planchers impossibles — mineur

Rejoué sur `check_lot()` avec un mélange limité à `{"cols": 8, "neighbors": 1}` :
- `min_with_type: {"ramp": 2}` ou `{"price": 2}` : aucune erreur. Aucune entrée ne peut donner ces types (`config_types` ne vise jamais `price`). Le lot tire jusqu'à `max_attempts` (4 000) puis échoue en 1. L'échec est propre, mais il coûte cher.
- `min_with_type: {"step+carbon": 3}` avec `max_with_type: {"step": 2}` : non détecté. La comparaison plancher ≤ plafond ne porte que sur la même clé.
- **À faire** :
  - refuser un plancher dont aucune entrée du mélange ne peut donner le type (via `config_types`), et refuser tout plancher sur `price` ;
  - comparer chaque plancher `a+b` aux plafonds de `a` et de `b`.

### 3. `last_call` contourne aussi le plafond `max_with_type` — mineur

- Pour une entrée du mélange encore sous `min_per_mix` quand il ne reste que des places réservées, `last_call` saute tous les quotas de diversité. Ce mécanisme existait déjà ; le nouveau `quota:with_type` a été placé dans le même bloc.
- **Effet observé** : b n°17 (entrée 10, surplus + 2 voisins, la seule de son entrée) porte `surplus_midi` à 4 grilles, pour un plafond de 3. Le plafond des échanges, lui, tient (10 avec cette grille).
- Rien ne garantit qu'il tienne la prochaine fois, et aucun test ne couvre le cas. Pour un plafond que la spec veut ferme, le sortir du bloc `last_call`, ou documenter qu'il cède devant `min_per_mix`.

### 4. Tirage orienté : pas de biais caché — conforme

- **Notes** : Facile 10, Moyen 31, Difficile 9, Expert 10, contre 12 / 28 / 9 / 11 en `v3g1`. Au moins 3 par note et par lot. Aucune note ne disparaît.
- **Familles** : de 7 à 10 grilles chacune sur 60 (`v3g1` : de 8 à 9). Aucune ne disparaît. La seule entorse au plafond de 3 vient du point 3.
- **Pondérations** : `×5` (sous `min_per_mix`) et `×5` (type manquant) se cumulent jusqu'à `×25`, et `÷5` s'applique au plafond atteint. Elles ne touchent que le choix de l'entrée. La famille et la note visée sont tirées à part.
- **Effets de bord**, déjà notés par l'auteur :
  - 40 carnets libres sur 60, contre 23, parce que STEP + CO₂ et stock en exigent un ;
  - les grilles globales restent surtout notées Moyen (22 sur 38), puisque la notation n'a pas bougé ;
  - Difficile ou Expert avec une mécanique globale : 9 sur 19, comme en `v3g1` (9 sur 20).

### 5. Mécaniques globales vivantes — conforme

**Le plafond CO₂ est nécessaire dans 18 grilles sur 18.** Pour chacune des 18 grilles à décision `carbon`, je l'ai rejouée avec `co2_cap: null` : 2 compositions à chaque fois.

**La STEP n'est jamais donnée par un indice.** Sur les 33 grilles à décision `step`, les étapes qui fixent la paire pompage → turbinage sont `silhouette` (27), `ribbon` (4) et `record` (2). Jamais `flow`. Les 2 `record` (b n°7, b n°19) déduisent la hauteur d'une colonne complète, d'où la paire : c'est une déduction, pas une donnée. Les 8 indices `flow` de ces grilles portent tous sur un pays.

**5 grilles STEP + CO₂ tirées au hasard** (graine 613), traces lues :

| Grille | Décisions | Ce que tranche le CO₂ | Ce que tranche la STEP |
|---|---|---|---|
| a n°7 (Moyen) | `step`, `carbon` | `carbon` (niv. 2) exclut 36 poses de G et T dès la 2e étape, ce qui impose le nucléaire | `silhouette` fixe 12h → 18h une fois N posé |
| b n°9 (Moyen) | `step` ×2, `carbon` | exclut G et T le soir, puis `single_cover` pose N 15h-24h | `silhouette` fixe les 2 paires (0h → 9h, 12h → 18h) |
| a n°6 (Expert) | `exchange`, `step`, `carbon` | exclut G 3 le soir, juste avant `refuted` | `silhouette` fixe 12h → 18h ; `flow` ne touche que l'import ES |
| c n°1 (Moyen) | `step`, `carbon` | exclut 20 poses de T la nuit, puis N 0h-9h | `silhouette` fixe 12h → 18h |
| b n°20 (Expert) | `step` ×2, `carbon` | 2 exclusions de T en fin de partie | `silhouette` fixe 12h → 15h et 12h → 18h, après 2 `refuted` |

Aucun plafond inutile, aucun pompage donné par un flux. Seule réserve : dans b n°20, le CO₂ n'agit que tard et par 2 exclusions. Il reste nécessaire (2 compositions sans lui), mais le joueur le ressentira sans doute peu.

### 6. Explication de `price` et `ramp` — tient, à un chiffre près (mineur)

- **Rejoué** sur les 267 grilles (lots du labo, archives comprises, et site, sans `v3g2`) :
  - 73 grilles ont un indice `price` ;
  - `top_price` se déclenche 3 fois (2 dans `v3-rampe`, 1 grille publiée). Exact.
- **Écart** : les indices `price` sur N font **64 %** dans mon calcul, contre 59 % dans `V3G2.md` (63 % avec `v3g2`). Ça ne change pas la conclusion.
- Les recettes Difficile / Expert retirent bien les indices `price` (`_draw`). Aucune entrée à rampe dans les lots « jouer » : exact.
- La proposition de l'auteur est raisonnable : sortir `price` des types promis, ou créer une entrée dédiée avec des prix sur G ou T. C'est à l'humain de trancher.

### 7. Chiffres de `V3G2.md` — exacts

Recomptés et exacts :
- types par lot, `step+carbon`, globales, types uniques ;
- décisions par grille, mécaniques vivantes ;
- notes, Difficile ou Expert avec une mécanique globale ;
- tirages, temps (62 / 162 / 139 s ; `v3g1` 103 / 108 / 27 s), rejets ligne par ligne ;
- barres (médiane et min-max), carnets exacts / libres, créneaux, prix sur N ;
- voisins retirés, grilles sans indice (10 contre 12), pièce haute seule (4 contre 10), carnets libres `v3g1` (23).

Seul écart : le pourcentage du point 6.

### 8. Conventions — conforme

- En-tête de `lot.py` mis à jour, en anglais. Commentaires des lots en anglais.
- `GAME-DESIGN.md` §10 étape 8 et `solver-v2.md` §17 décrivent les nouveaux quotas, les clés combinées et la réservation commune.
- `test_archive.py` accepte `v3g<N>-` par regex : correct et sans effet sur les lots archivés.
- 7 tests ajoutés : plafond, plancher, réservation commune, `check_lot`, tirage orienté, clés combinées. Il manque les cas des points 1 à 3.
