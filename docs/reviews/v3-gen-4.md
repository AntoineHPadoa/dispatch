# Review — `v3-gen-4` (voisins gardés, quasi-jumelles, rampe comme décision, lots `v3g4-*`)

Relecteur : `s6`. Auteur : `s5`. Branche relue : `v3-gen-4` à `e69c1e8` (3 commits sur `main`). Diff : `main...v3-gen-4`. Numéros `n°` = index + 1.

## Verdict : **OK à merger**

- Le code est conforme à la spec. Les 80 grilles passent `check --strict`. Tout est vert, et rien hors périmètre ne bouge.
- Aucun point bloquant. Le point 1, un écart de quota plus large que celui accepté, est à valider par l'orchestrateur avant le merge.
- **Pour être franc sur les lots** :
  - A et C sont bien plus variés que `v3g3-a`. C contient pourtant une vraie paire de jumelles (c n°6-7).
  - B est le plus monotone des trois : 14 grilles à échange sur 20, et 3 paires de même entrée, même famille et mêmes décisions.
  - Le lot rampe teste la rampe comme forme à placer, presque jamais ses techniques propres : 0 relais, 0 « case seule ».

## Ce qui a été vérifié

| Contrôle | Résultat |
|---|---|
| `cd solver && .venv/bin/pytest -q` | 210 passed (288 s) |
| `pytest lab/tests -q` (dont `test_candidate_drawings.py`, le test de dessin) | 427 passed |
| `web/` : `npm test` | 11 fichiers, 432 tests verts |
| `check_unique.py` | OK |
| `dispatch-solver check-published` | OK, sortie **identique** à celle de `main` (diff vide) |
| `check --strict --no-ramp` sur `v3g4-jouer-a/b/c` | exit 0 ×3 ; 60/60 valides, 1 composition, déduites, note = note stockée ; aucune rampe |
| `check --strict` (rampes permises) sur `v3g4-rampe` | exit 0 ; 20/20, idem |
| Rien d'autre ne bouge | diff vide sur `web/`, `grids.json`, `fixtures/`, les lots et candidates existants |
| Conventions | 3 commits en anglais, auteur noreply, aucune mention d'IA ; en-têtes de `lot.py`, `trace.py` et `rerate_lots.py` à jour ; `GAME-DESIGN.md` §10 et `solver-v2.md` §19 ajoutés |

### Re-mesure après nettoyage

- **Le diagnostic de l'auteur est juste.** Dans `make_candidate`, `decisions`, `coupled_globals`, `live_mechanics` et `mechanics` sont calculés sur `d` après le retrait des voisins morts et du plafond CO₂ inutile. Les quotas lisent ce bloc `lab`. Le défaut ne venait donc pas de la mesure.
- **Correctif** : une entrée à voisins dont la référence ne commerce avec personne est recalculée avec un export imposé (1 ou 2) vers un voisin tiré. Sinon, rejet `dead_neighbors`. Il est testé (`test_an_entry_with_neighbors_keeps_one`, 30 graines, mesures recalculées et comparées).
- **Recompte « globale sans échange »** (décision `step` ou `carbon`, ni export ni import dans la solution) :

| | v3g4 a | v3g4 b | v3g4 c | v3g4 rampe | v3g3 a | v3g3 b |
|---|---|---|---|---|---|---|
| Globale sans échange | **4** (n°2, 9, 15, 19) | 4 | 6 | 0 | **8** | 5 |
| Grilles sans voisin | 8 | 6 | 9 | 4 | 12 | 8 |
| Une seule décision | 5 | 2 | 1 | 3 | 9 | 3 |
| Voisins nettoyés en totalité | 0 | 0 | 0 | 0 | 6 | 1 |

- Les 4 grilles de A viennent toutes d'entrées **sans voisin** : entrée 7 (STEP + stock, n°2 et 9) et entrée 5 (STEP + CO₂, n°15 et 19). Plus aucune ne vient d'une entrée « couplable » vidée. Le défaut de `v3g3` a disparu. `V3G4.md` attribue les 4 grilles à l'entrée STEP + CO₂, mais elle n'en donne que 2 : imprécision sans conséquence.

### Recompte indépendant des lots

Script à part : notes, types (grilles qui contiennent le type), couplage recalculé depuis `solution` et non lu dans `coupled_globals`, K, diversité.

| | a | b | c | rampe |
|---|---|---|---|---|
| F / M / D / E | 7 / 9 / 2 / 2 | 9 / 6 / 3 / 2 | 5 / 11 / 2 / 2 | 5 / 10 / 3 / 2 |
| `exchange` / `step` / `tall` / `carbon` / `stock` / `price` | 10 / 8 / 7 / 6 / 3 / 1 | 14 / 8 / 5 / 6 / 2 / 0 | 11 / 8 / 8 / 8 / 4 / 0 | 14 / 6 / — / 3 / 0 / 2 |
| `ramp` | — | — | — | 19 grilles, 35 décisions |
| Globale couplée (calcul indépendant) | 6 | 6 | 6 | 7 |
| Écart avec `lab.coupled_globals` | 0 | 0 | 0 | 0 |
| K médiane (min - max), K ≥ 0,5 | 0,33 (0,13 - 1,11), 8 | 0,47 (0,08 - 1,29), 10 | 0,38 (0,20 - 0,88), 8 | 0,67 (0,20 - 1,86), 14 |

Tout concorde avec `V3G4.md`.

### Règles de diversité

- **Code** (`Quotas.check`, `_draw`, `check_lot`) :
  - `max_per_mix` est contrôlé même en fin de lot ;
  - `max_with_cols` l'est seulement hors « dernier appel » `min_per_mix` (point 3) ;
  - le tirage divise par 25 le poids d'une entrée plafonnée ;
  - `check_lot` refuse `max_per_mix` × entrées < taille, et `max_per_mix` < `min_per_mix`.
- **Test** : `test_per_mix_and_slot_ceilings` couvre les deux rejets, le tirage pondéré et les trois refus de `check_lot`.
- **Constaté** : max 2 grilles par entrée dans les 4 lots ; 12 créneaux : 1, 3, 5 et **6** (rampe, plafond 5, point 3).
- **Pas de motif imposé** : les deux règles bornent un compte, sans viser d'entrée, de famille ni de forme. C'est conforme à la mise en garde de l'humain.

### Coupe-circuit `timeout`

- **Tirage Python trop long** : alarme `SIGALRM` dans le worker, testée (`test_a_long_draw_is_a_timeout_reject`).
- **Tirage coincé en code natif** : ce cas n'est **pas testé**. Je l'ai sondé à la main.
  - Montage : pool en `fork`, un `make_candidate` qui bloque `SIGALRM` et boucle, `ATTEMPT_SECONDS` = 1, `HEAD_SECONDS` = 3.
  - Résultat : le lot rend la main en 15 s avec 5 rejets `timeout`, et **aucun processus enfant ne reste** après `run_lot` (`pgrep -P`).
  - Pas de fuite.
- **Lot incomplet** : le CLI écrit quand même les fichiers et sort en 1. L'avancement est écrit tous les 50 tirages. Une impasse se voit donc, mais elle n'est pas détectée (point 4).

### Rampe

- **`ramp_steps()`** : une rampe ne compte pas quand elle est engagée, nommée par un programme (`bar`, même colonne et même largeur) ou posée par une étape `given`, `program` ou `length`. Sinon, elle compte avec la règle qui la pose, ou `eliminated`.
- **Test** : `test_a_ramp_given_by_a_clue_is_no_decision` ajoute un programme puis une barre engagée, et vérifie qu'une décision disparaît. Le cas `length` n'est pas testé, mais il est exercé par n°11.
- **Traces lues** (n°1, 11, 13, 17, 20) :

| n° | Note | Ce que fait la déduction sur la rampe | Décision réelle ? |
|---|---|---|---|
| 1 | Expert | 10 étapes excluent des places de charbon (place libre, ruban, CO₂, réfutation), puis « Une seule barre pour cette case » pose les 2 rampes à l'étape 21 | oui, et tardive |
| 11 | Difficile | l'étape `carbon` exclut 15 places de charbon, puis « Durée de marche » pose la rampe de 4 | non comptée (point 5) |
| 13 | Moyen | 5 rampes, inventaire exact, un seul indice (`column` B=0) : 1 posée par « Une seule barre », 4 par élimination après deux réfutations | oui |
| 17 | Facile | 6 créneaux, aucun indice : « Carnet épuisé » sur la TAC, la rampe n'a plus qu'une place | oui, triviale (3 étapes) |
| 20 | Moyen | 1 rampe donnée par le programme (non comptée) ; 2 par « Répartition du carnet », 2 par « Une seule barre » ; plateau et bord émis en route | oui |

- **La rampe se joue réellement.** Elle se joue surtout comme une grande barre à placer : 25 des 35 rampes décidées sont posées par « Une seule barre pour cette case ». Les techniques de rampe n'apparaissent que dans 8 grilles sur 20 (plateau 10 emplois, bord 2, case seule 0, relais 0), et ne posent jamais une rampe elles-mêmes. Comme `v3-rampe`.
- **Notes variées** : F5 / M10 / D3 / E2, au-dessus du minimum de 3 Faciles. Les Difficile et Expert viennent des entrées STEP (+ CO₂) + voisin (n°1, 3, 8, 14), pas de la rampe : en notation A, la rampe seule plafonne à Moyen.
- **Relais : l'explication tient.**
  - `v3-rampe` n'a aucune entrée « relais » : deux rampes viennent du tirage de la référence (`count` = 2 une fois sur 3).
  - 11 grilles ont 2 rampes ou plus.
  - `ramp_relay` exige un relevé de 2 cases de charbon sur la colonne du relais (`rampe.md` §119). Le choix d'indices prend d'abord ce qui tranche aux niveaux 1-2. Il ne sort donc pas.
  - Le forcer serait une recette précise, ce que l'humain refuse. Je suis d'accord pour ne pas l'ajouter.

## Points

### 1. Lot B : plafond `exchange` à 14, et non 12. Mineur, à valider par l'orchestrateur.

- L'écart accepté est 10 → 12. Le lot livré a `max_with_type.exchange` = 14, et 14 grilles sur 20 ont un échange.
- L'historique est cohérent : `cdb91da` passe à 12 ; le lot bloque encore à 18/20 ; `e69c1e8` passe à 14. C'est documenté dans le `comment` du lot et dans `V3G4.md`.
- C'est le lot le plus chargé en échanges (70 %) et le plus monotone (point 2). Si 14 n'est pas acceptable, il faut régénérer B avec un mélange qui a plus d'entrées sans voisin, plutôt que relever encore le plafond.

### 2. Les règles coupent les grappes, pas les paires. Mineur, honnêtement rapporté.

- Avec 2 grilles au plus par entrée, presque chaque entrée donne sa paire : 8 à 9 paires de même entrée par lot. Les 4 paires les plus proches de chaque lot sont **toutes** des paires de même entrée.
- **Paires de même entrée, même famille et mêmes types de décision** :

| | v3g4 a | v3g4 b | v3g4 c | v3g4 rampe | v3g3 a | v3g3 b |
|---|---|---|---|---|---|---|
| Paires de même entrée | 8 | 9 | 8 | 8 | 12 | 14 |
| … même famille et mêmes types | 0 | **3** | 1 | 0 | 3 | 2 |
| Similarité moyenne | 0,26 | 0,30 | 0,26 | 0,37 | 0,26 | 0,29 |
| Paires ≥ 0,6 | 8 | 13 | 10 | 17 | 9 | 14 |

- **c n°6-7 : vraies jumelles**, au-delà de la mesure.
  - Même entrée et même famille.
  - Même barre haute de charbon (col. 8, largeur 3), TAC aux col. 4 et 9.
  - Même indice `column` col. 8 C = 2 ; le n°7 n'ajoute qu'un relevé N.
  - Demandes `[2,2,2,4,7,4,3,2,5,7,5,3]` et `[3,3,3,5,7,5,3,3,5,7,5,3]`.
  - À ne pas proposer dans la même session.
- **b n°6-19** : proches (même début de demande, même indice unique « 2 paires STEP »).
- **b n°4-16** : différentes au fond (imports contre exports), malgré une similarité de 0,91.
- **Verdict monotonie** : A n'est pas monotone, et c'est net par rapport à `v3g3-a`. C est varié, à la paire n°6-7 près. B est le plus uniforme, sans être une grappe. Le lot rampe a la similarité moyenne la plus haute (0,37), en partie par construction (rampe et décision `ramp` partout), et moins de paires proches que `v3-rampe` (17 contre 28).
- **Piste**, sans nouvelle règle : écarter c n°7 et b n°19 de la session, ou tester c n°6-7 à l'aveugle comme le propose l'auteur.

### 3. `max_with_cols` cède à `min_per_mix` en fin de lot. Mineur.

- Le lot rampe a 6 grilles à 12 créneaux pour un plafond de 5. La dernière place est allée à l'entrée 1 (12 créneaux), encore vide, au titre du « dernier appel » `min_per_mix`.
- C'est rapporté dans `V3G4.md`, mais **pas documenté** dans `GAME-DESIGN.md` §10. Le texte dit « au plus N grilles d'un nombre de créneaux donné », alors que `max_per_mix` précise « même en fin de lot ». Il faut soit l'écrire, soit faire tenir `max_with_cols` comme `max_per_mix`.
- Rien ne contrôle la compatibilité entre `max_with_cols` et `min_per_mix` dans `check_lot`. Ici, 4 entrées sur 12 créneaux contre un plafond de 5 : c'est compatible sur le papier. C'est l'ordre d'arrivée qui a forcé le dépassement.

### 4. Une impasse de quotas n'est pas détectée. Mineur.

- Le blocage de B (environ 1 h) venait de quotas incompatibles : il restait des entrées, mais toutes les grilles finies étaient refusées. Le lot n'a pas planté : il tire jusqu'à `max_attempts` (4 000), chaque tirage coûtant ses secondes de CP-SAT avant le refus.
- Le log d'avancement rend l'impasse visible, et le CLI sort en 1 sur un lot incomplet : le blocage n'est plus silencieux.
- Un arrêt anticipé générique (par exemple, N refus de quota consécutifs sans acceptation, alors arrêt avec la liste des quotas en cause) éviterait l'heure perdue. Ce ne serait pas une règle de diversité. À l'appréciation de l'orchestrateur.

### 5. Rampe donnée par « Durée de marche » : non comptée même quand la déduction a travaillé. Mineur, signalé par l'auteur.

- n°11 : la largeur est donnée, mais l'étape `carbon` a exclu 15 places de charbon avant que `length` ne pose la rampe. Le joueur a donc tranché une part de sa place.
- Le choix « ne compte pas » est prudent et sans effet sur les quotas : la grille tient par 3 échanges et le CO₂. C'est le seul cas du lot. À revoir seulement si d'autres grilles « durée de marche » sortent.

### 6. Petits trous de test. Mineur.

- Le chemin « tirage coincé en code natif » (`HEAD_SECONDS`, `terminate()` des workers) n'a pas de test. Ma sonde montre qu'il marche ; elle tient en 20 lignes (pool `fork`, `SIGALRM` bloqué) et pourrait devenir un test.
- `test_a_long_draw_is_a_timeout_reject` laisse le gestionnaire `SIGALRM` installé dans le processus pytest. Le `finally` annule l'alarme, mais ne restaure pas l'ancien gestionnaire. C'est sans effet aujourd'hui.
- `terminate()` passe par `pool._processes`, un attribut privé de `ProcessPoolExecutor`. Le commentaire le dit. À surveiller lors d'une montée de version de Python.

## Hors périmètre

- Les noms des techniques dans `V3G4.md` (« Une case seule est un bord », « Deux bords se relaient ») diffèrent de `docs/next/rampe.md` (« épaule »). Ce sont les libellés actuels du jeu, pas une erreur de la branche.
