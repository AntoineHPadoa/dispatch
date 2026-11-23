# Critères d'une belle grille — session `matin-23` (Joueur 1)

Source : session `lab/sessions/matin-23.json`, soit 27 grilles jouées le 23 nov. 2026 (80 min de jeu actif, sur 11 h). Elle est cumulée avec les 42 grilles notées des sessions précédentes : **69 grilles notées par Joueur 1**, sur les lots `v3-jouer-*`, `v3g3-*` et `v3g4-*`. Les lots `nuit-*` et `v3-confort` sont exclus.

- Première partie de chaque grille, hors fantômes. Ressenti et ★ tirés de `notes.json`.
- Note A : `difficulty` des lots. Mesures `lab` des candidats.
- Les mesures nouvelles (remplissage, trous) sont calculées par des scripts du scratchpad, hors dépôt, avec `dispatch_solver` (`deduce/state.py`, `Solver`).
- `n°` = index + 1 ; `#` = place dans la session.

**Parties aidées** (marquées « aide » ci-dessous, et à part dans les calculs) :
- `v3g3-jouer-b` n°14 : 3 abandons (304 s, 315 s, 195 s), puis solution donnée ;
- `v3g3-jouer-a` n°5 : 570 s, 4 cases données ;
- `v3g4-rampe` n°10 : abandon à 217 s, puis aide, résolue en 347 s.

## Verdict : converge pour la beauté, pas encore pour la difficulté

**Acquis** (stables sur 4 sessions et 69 grilles) :
- **Densité de décisions K** :
  - K ≥ 0,5 : 21 ★ sur 28 ; K < 0,2 : 5 ★ sur 23 ;
  - ρ(K, ★) = 0,44, le meilleur prédicteur du ★.
- **Une globale couplée rend la grille plus dure** :
  - ressenti 2,25 (20 grilles) contre 1,24 (49) ; ρ = 0,56 ;
  - 16 grilles couplées sur 20 sont ressenties 2 ou plus.
- **Le remplissage fait rejeter** :
  - 31 grilles sur 69 sont jugées « du remplissage » dans les commentaires ;
  - 4 d'entre elles seulement ont une ★.
- **A range les grilles à peu près dans le bon ordre jusqu'à Difficile** : ρ = 0,53 (contre 0,44 avant cette session).

**Hypothèses**, à trancher :
- **H1 — Frontière Facile / Moyen** :
  - 18 Moyens sur 25 sont ressentis 1 ;
  - un Moyen avec K < 0,5 se joue comme un Facile.
- **H2 — Taille** : à K égal, une grille de 40 cases ou plus, ou avec 4 lignes pleines de nucléaire, est du remplissage.
- **H3 — Trous contestés** :
  - ils rendent la grille belle (79 % de ★ contre 49 %) ;
  - ils ne la rendent pas plus dure.
- **H4 — Difficile et Expert** : A ne les sépare pas.
  - Ressenti moyen : 2,55 pour Difficile, **2,00 pour Expert** ;
  - 3 Expert sur 7 sont ressentis 1.
- **« ★ si couplée » ne tient plus** : 6 ★ sur 13 grilles couplées dans cette session. Une globale couplée rend la grille dure, pas forcément belle.

## 1. Résultats

### Tableau (ordre de la session)

Décisions : `ex` échange, `st` STEP, `co` CO₂, `ha` pièce haute, `ra` rampe, `sk` stock, `px` prix. Couplée : globale couplée à un échange (`st`, `co`).

| # | Grille | A | Ress. | Temps | Abandon / aide | ★ | Couplée | Décisions | K | Commentaire abrégé |
|---|---|---|---|---|---|---|---|---|---|---|
| 1 | rampe n°16 | F | 1 | 47 s | | ★ | | ra | 0,22 | « le palier apporte de la diversité, pas juste du remplissage » |
| 2 | c n°10 | M | 2 | 77 s | | ★ | | 5 ex, ha | 0,88 | « bonne moyenne, les exports ont un vrai impact » |
| 3 | rampe n°6 | F | 1 | 42 s | | | | 5 ex, 2 ra | 0,69 | « j'aime la rampe dans un pic ; trop de nucléaire à côté » |
| 4 | a n°5 | E | 1 | 83 s | | | st, co | 3 ex, st, co | 1,00 | « pas ma facile préférée, se joue bien » |
| 5 | c n°18 | M | 1 | 41 s | | ★ | | st, co | 0,75 | « facile quand on sait utiliser la STEP ; plaisante » |
| 6 | v3g3-b n°1 | E | 3 | 172 s (rejeu) | | ★ | st, co | 5 ex, st, co | 1,10 | « galéré ; 5 nucléaires forcés + exports, bien réfléchi » |
| 7 | a n°2 | F | 1 | 23 s | | ★ | | st, sk | 0,50 | « pour apprendre la STEP ; trop d'indices » |
| 8 | v3g3-b n°14 | D | 4 | 814 s, 3 abandons | **solution** | ★ | st | ex, st, ha | 0,55 | « complètement bloqué ; 1re fois que je demande la solution » |
| 9 | c n°2 | F | 1 | 31 s | | ★ | | st, sk | 0,67 | « petite facile sympathique » |
| 10 | a n°19 | M | 1 | 85 s | | ★ | | st, co | 0,86 | « un cas sympa des STEP » |
| 11 | rampe n°17 | F | 1 | 11 s | | | | ra | 0,33 | « très facile, du remplissage » |
| 12 | c n°6 | M | 1 | 55 s | | | | ha, co | 0,36 | « du remplissage » |
| 13 | v3g3-b n°13 | E | 1 | 99 s | | | st, co | ex, st, co | 0,54 | « très grande grille, peu de mécanique ; plus de temps à remplir le nucléaire » |
| 14 | rampe n°10 | M | 4 | 217 s + 347 s | abandon, **aide** | ★ | | ex, 2 ra | 0,50 | « super ; plusieurs places pour le gaz et les imports à 15 h-18 h » |
| 15 | v3g3-a n°5 | E | 2 | 570 s | **4 cases** | | st, co | st, co | 0,46 | « lu importé pour exporté ; beaucoup de remplissage » |
| 16 | a n°16 | M | 1 | 29 s | | ★ | | ha | 0,22 | « remplissage un peu varié, sans réflexion » |
| 17 | rampe n°14 | D | 2 | 339 s | | | st | 4 ex, st, 2 ra, px | 0,80 | « le haut intéressant, les 5 lignes de nucléaire inutiles » |
| 18 | v3g3-b n°12 | E | 1 | 32 s | | | st, co | ex, st, co | 0,64 | « beaucoup de remplissage, le carré de gaz revient tout le temps » |
| 19 | a n°14 | M | 1 | 39 s | | | | 3 ex | 0,19 | « du remplissage » |
| 20 | rampe n°1 | E | 3 | 304 s | | ★ | st, co | 3 ex, st, 2 ra, co | 1,86 | « compacte ; organiser la demande avec la forme bizarre des usines » |
| 21 | v3g3-a n°6 | D | 3 | 221 s | | ★ | st | 4 ex, st | 0,78 | « dur, cet enchaînement de STEP et d'export » |
| 22 | rampe n°20 | M | 2 | 68 s | | ★ | | 4 ra | 0,57 | « rigolo, l'enchaînement de tous ces 1-2-1 » |
| 23 | v3g3-a n°16 | D | 2 | 281 s* | | ★ | co | 4 ex, ha, co | 1,00 | « bien aimé » (*temps non représentatif) |
| 24 | a n°3 | M | 1 | 31 s | | | st | 4 ex, st | 0,78 | « du remplissage avec de l'import » |
| 25 | b n°5 | D | 3 | 518 s | | ★ | st | 4 ex, st, ha | 1,29 | « trop galéré, j'ai voulu exporter à foison » |
| 26 | c n°7 | M | 2 | 96 s | | ★ | | ha, co | 0,36 | « se joue bien ; pas assez compacte » |
| 27 | rampe n°11 | D | 2 | 95 s | | | co | 3 ex, co | 0,67 | « bonne mais trop de remplissage nucléaire » |

**Bilan** :
- 16 ★ sur 27 ;
- ressentis : 14 × 1, 7 × 2, 4 × 3, 2 × 4 ; premiers abandons de Joueur 1 (2 grilles) ;
- 12 commentaires parlent de remplissage.

### Prédictions du bloc replié

- **Ressenti** : 14 justes sur 27. Il est surestimé 7 fois (#3, 4, 13, 17, 18, 23, 24) et sous-estimé 6 fois (#6, 8, 14, 21, 25, 26).
- **★** : 15 justes sur 27.

| Question | Prédiction | Résultat |
|---|---|---|
| Frontière F/M (Moyens 16, 19, 12, 26 contre Faciles 7, 9, 3) | Moyens ressentis 1 : baisser la frontière | **Juste** : 1, 1, 1, 2 contre 1, 1, 1 |
| Seuil de K (2, 24 contre 16, 19) | ★ au-dessus de 0,5, aucune sous 0,25 | **Faux** : 2 ★ mais 24 non ; 16 ★ (K 0,22) |
| Couplée contre globale sans échange (24 contre 10, et 5) | 24 plus dure | **Faux** : 24, 10 et 5 tous ressentis 1 ; 24 sans ★ (« remplissage avec de l'import ») |
| Jumelles 12 et 26 | 26 vue comme une redite | **Faux** : non reconnue ; 12 ressentie 1, « remplissage » ; 26 ressentie 2, ★ |
| Rampe | ★ si d'autres décisions l'entourent, pas seule | **À moitié** : 1 seule ★ (16) ; 14, 20, 22 ★ ; 17 et 27 sans ★ (nucléaire) |
| Dures v3g3 (6 nouvelles) | 2 à 3, toutes ★ | **Faux** : 4, 1, 2, 1, 3, 2 ; 3 ★ sur 6 |

### Notation A, cumulée sur 69 grilles

| | n | ρ | Erreur moy. | Biais | Exactes |
|---|---|---|---|---|---|
| Avant (42 grilles) | 42 | 0,44 | 0,52 | +0,29 | 20 |
| matin-23 | 27 | 0,44 | 0,93 | +0,70 | 10 |
| **Cumul** | **69** | **0,53** | **0,68** | **+0,45** | **30** |
| Cumul sans les 3 parties aidées | 66 | 0,51 | 0,64 | +0,48 | 30 |
| Cumul, Moyen seulement si K ≥ 0,5 (H1) | 69 | 0,63 | 0,51 | +0,22 | 42 |

Ressentis par note A (cumul) :

| A | n | Ress. 1 / 2 / 3 / 4 | Moyenne |
|---|---|---|---|
| Facile | 26 | 22 / 4 / 0 / 0 | 1,15 |
| Moyen | 25 | **18** / 6 / 0 / 1 | 1,36 |
| Difficile | 11 | 0 / 7 / 2 / 2 | 2,55 |
| Expert | 7 | **3** / 1 / 3 / 0 | **2,00** |

- **Frontière Facile / Moyen** : A est un cran trop haut.
  - Moyen avec K < 0,5 : 2 ressentis 2 sur 16, comme les Faciles (4 sur 26).
  - Moyen avec K ≥ 0,5 : 5 sur 9.
  - Faire de K ≥ 0,5 une condition de Moyen fait passer ρ de 0,53 à 0,63 et l'erreur de 0,68 à 0,51. Le seuil est calé sur ces mêmes données : à confirmer (H1).
- **Expert < Difficile** :
  - les 3 Expert ressentis 1 (a n°5, v3g3-b n°12 et n°13) sont des STEP + CO₂ couplées, avec 1 à 3 échanges ;
  - b n°12 et n°13 sont aussi du remplissage (33 et 50 cases).

### Rampe (8 grilles)

- **Ressentis** : 1, 1, 1 pour les Faciles ; 4 et 2 pour les Moyens ; 2 et 2 pour les Difficiles ; 3 pour l'Expert. Moyenne 2,0. 4 ★ sur 8, 1 abandon (n°10).
- **Ce qu'il en dit** : il aime la forme.
  - « ça apporte un peu de diversité, le remplissage est plus agréable » ;
  - « rigolo, l'enchaînement de tous ces 1-2-1 » ;
  - « prendre une case dans un pic » ;
  - « la forme bizarre des usines ».
- **Ses reproches portent sur le décor, pas sur la rampe** : 4 des 8 grilles ont « trop de nucléaire à côté » (n°6, 11, 14, 17).
- **Sa rampe la plus dure, n°10** (ressentie 4, abandonnée) : la difficulté venait du **choix gaz ou import** en haut à 15 h et 18 h, pas de la rampe.
- **Ressenti** : une forme à placer, agréable, qui rend le remplissage moins mécanique. Elle ne suffit pas à faire une grille seule (n°17, 11 s, « du remplissage »).

## 2. « Remplissage inutile »

Étiquette : sur les 69 commentaires, je classe à la main ceux qui jugent la grille « du remplissage », « trop de nucléaire » ou « pas assez compacte » : **31 grilles « remplissage »**, 38 autres. L'AUC est la probabilité qu'une grille « remplissage » ait une valeur plus haute qu'une autre (0,5 = hasard).

### La mesure proposée par la trace ne marche pas

| Mesure sur la trace | AUC (69) | AUC (matin-23) |
|---|---|---|
| Part des cases posées par une étape triviale (niveau 1, sans échange ni pièce de décision) | 0,69 | 0,58 |
| Part des cases résolues au point fixe du niveau 1 | 0,68 | 0,56 |
| Part des cases fixées avant la 1re décision | inutilisable : souvent 0 | |
| Part triviale, ou posée après la dernière décision | 0,69 | **0,51** |

- **Pourquoi** : le solveur pose le bloc de nucléaire **en dernier**. Il ne le trouve qu'en comptant les colonnes (`column_sum`, `swap`), une fois la silhouette connue. Le joueur, lui, le remplit d'emblée, sans réfléchir.
- **Exemple** : v3g3-b n°13, 50 cases dont 96 % de nucléaire, ressentie 1. Seulement 4 % de ses cases sont triviales pour le solveur.
- **Conclusion** : la trace donne l'ordre du solveur, pas celui du joueur.

### Mesures sur la solution

| Mesure | AUC (69) | AUC (matin-23) | AUC (K ≥ 0,5, 28 grilles) |
|---|---|---|---|
| 1 / K (rappel) | 0,78 | 0,78 | 0,58 |
| **Cases à poser** (`cells`) | 0,69 | 0,78 | **0,85** |
| **Lignes pleines de nucléaire** (`full_n_rows`) | 0,71 | 0,71 | 0,79 |
| **Cases par point de décision** (`cells / Σ poids`, poids de K) | **0,77** | **0,80** | 0,65 |

- **Proposition** :
  - mesure principale : **cases par point de décision (C/D)**, qui ramène K à la case et non à la pièce ;
  - garde-fou : **cases à poser**, qui attrape le remplissage que K laisse passer quand K est déjà bon.

| C/D (69 grilles) | n | « remplissage » | ★ |
|---|---|---|---|
| < 5 | 17 | 3 | 13 |
| 5 à 8 | 15 | 6 | 8 |
| 8 à 12 | 9 | 3 | 8 |
| ≥ 12 | 28 | **19** | 9 |

- **À K ≥ 0,5** :
  - moins de 40 cases : 24 grilles, 3 « remplissage », 20 ★ ;
  - 40 cases ou plus : 4 grilles, **3** « remplissage », 1 ★.
  - Ce sont exactement les cas cités par le joueur : rampe n°14, « 5 lignes de nucléaire » ; v3g3-b n°13 ; v3g3-a n°5.
- **Exceptions** :
  - rampe n°20 : 45 cases, ★ ; 4 rampes enchaînées, le remplissage n'y est pas mécanique.
  - a n°3 (#24) : 22 cases, C/D 3,1, mais « remplissage avec de l'import » ; ses 3 trous n'acceptent que du gaz (voir §3).

## 3. Trous à choix unique contre trous à choix multiple

**Définition mesurée** :
- un **trou** est une suite de cases d'une ligne, de largeur 1 ou 2, fermée de chaque côté par une brique météo ou le bord de la grille (au moins une brique), et sous toutes les silhouettes possibles ;
- les **types** possibles sont le domaine des cases dans la vue de déduction (`View.dom`, imports regroupés en `I`) :
  - au départ ;
  - au point fixe du niveau 1, c'est-à-dire ce que le joueur voit après les évidences (carnet épuisé, largeurs) ;
- un trou est **contesté** s'il garde au moins 2 types au point fixe du niveau 1, et si une étape non triviale le tranche : niveau ≥ 2 ou échange.

**Chiffres** :
- 98 trous dans 49 grilles :
  - au départ, 69 ont au moins 2 types ;
  - au point fixe du niveau 1, il n'en reste que **30** : la plupart des choix apparents tombent par le carnet ;
  - **26 trous sont contestés**, dans 14 grilles.
- Types des trous contestés :
  - gaz / import / TAC : 9 ;
  - gaz / TAC : 7 ;
  - gaz / import : 5 ;
  - import / TAC : 4 ;
  - barrage / gaz : 1.

| Grilles | n | Ress. moyen | ★ | « remplissage » | Temps médian |
|---|---|---|---|---|---|
| Aucun trou | 20 | 1,60 | 50 % | 45 % | 47 s |
| Trous à choix unique seulement | 35 | 1,43 | 49 % | **57 %** | 47 s |
| Au moins un trou contesté | 14 | 1,71 | **79 %** | **14 %** | 98 s |
| *Note A ≥ Moyen : aucun trou* | 11 | 1,91 | 64 % | 27 % | 57 s |
| *Note A ≥ Moyen : choix unique seulement* | 18 | 1,72 | 56 % | **50 %** | 85 s |
| *Note A ≥ Moyen : au moins un contesté* | 14 | 1,71 | **79 %** | **14 %** | 98 s |

- **Hypothèse à moitié confirmée** :
  - **Choix unique au-delà de Facile** : une grille sur deux est jugée « remplissage ». Confirmé.
  - **Choix multiple** : c'est un facteur de **beauté** (79 % de ★, 14 % de remplissage, temps ×2), **pas de difficulté** (ressenti égal). ρ(trous contestés, ★) = 0,24 ; ρ(trous contestés, ressenti) = 0,14.
  - Aucun Facile n'a de trou contesté, et c'est normal : il serait tranché au niveau 1.
- **Cas qui confirment** :
  - rampe n°10 (ressentie 4) : un trou gaz / import en bas à droite, résolu par 2 imports. C'est l'exemple même de son commentaire.
  - c n°10 et v3g3-a n°16 : trous gaz / import / TAC, ★.
- **Contre-exemples** :
  - v3g3-b n°14 : 7 trous à choix unique (gaz), ressentie 4. La difficulté venait de la STEP et de l'export à 6 h.
  - v3g3-b n°12 : trou gaz / import au niveau 1, mais tranché trivialement une fois la silhouette connue (« le carré de gaz revient tout le temps »).
- **Sessions précédentes** : 8 des 14 grilles à trou contesté viennent de `v3-jouer-*`, et 6 de `v3g3` / `v3g4`. La part ne monte pas avec les générateurs récents.

## 4. Propositions pour le générateur

Aucune ne fixe un motif : on mesure, on oriente le tirage, et on ne rejette qu'en Difficile et Expert.

### Mesures à ajouter au bloc `lab`

- `cells` : cases à poser.
- `full_n_rows` : lignes pleines de nucléaire.
- `cells_per_decision` : `cells / Σ poids`, avec les poids de `DECISION_WEIGHTS`.
- `holes` : `{n, unique, contested, types: ["GI", …]}`, avec les définitions du §3.
- Agrégats dans `.stats.json`.
- `rerate_lots.py` les recalcule.

### Favoriser les trous contestés (Moyen et plus)

- **Référence** (`generate/reference.py`) :
  - quand la pose de référence comble un creux étroit, tirer son type parmi ceux qui y tiennent (gaz, TAC, import si un voisin le permet), au lieu du premier trouvé ;
  - le choix d'indices devra alors trancher ce trou, ce qui le rend contesté.
- **Tirage orienté** (`generate/lot.py`) :
  - poids ×2 pour un candidat Moyen et plus avec `holes.contested ≥ 1` ;
  - quota doux `min_with_contested` : un tiers des Moyen et plus ; jamais un rejet.

### Limiter le remplissage

- **Note** : un Moyen exige K ≥ 0,5 ; sinon la grille est notée Facile. C'est H1, à confirmer avant de le coder dans `Result.rating`.
- **Rejet `filler`**, pour Difficile et Expert seulement : `cells ≥ 40`.
  - Sur les 18 Difficile et Expert jouées, il aurait écarté 3 grilles « remplissage » et 1 ★ (v3-b n°20).
- **Quota doux** pour les Moyens : au plus un quart du lot avec `cells_per_decision ≥ 12`.
- Les entrées à 12 créneaux restent, bornées par `max_with_cols` : c'est la taille du remplissage qu'on borne, pas les journées longues.

### Fichiers et coût

| Fichier | Changement |
|---|---|
| `solver/src/dispatch_solver/deduce/trace.py` (ou `deduce/holes.py`) | Mesures : point fixe du niveau 1, et étape qui résout chaque case. Environ 2 s pour 69 grilles dans mes scripts. |
| `generate/lot.py` | Bloc `lab`, poids du tirage, quota `min_with_contested`, rejet `filler` |
| `generate/reference.py` | Tirage du type d'un creux étroit |
| `scripts/rerate_lots.py`, `lab/tests/`, `solver/tests/` | Recalcul et 3-4 tests |
| `GAME-DESIGN.md` §10, `docs/next/solver-v2.md` | Documentation |

Coût : 1 tâche de worker (une demi-journée), 4 lots en environ 10 min, 1 revue.

## 5. Hypothèses à tester cette nuit, et session de demain

Ces consignes peuvent aller telles quelles au générateur.

| Hyp. | Lot v3g5 | Grilles de la session de demain | Ce qui tranche |
|---|---|---|---|
| **H1** Frontière F/M = K ≥ 0,5 | Aucun lot : grilles v3g4 non jouées | **6** Moyens à 8 créneaux. K < 0,5 : a n°8 (0,25), b n°14 (0,18), c n°16 (0,22). K ≥ 0,5 : b n°8 (0,83), a n°15 (0,60), rampe n°18 (0,67). | Les 3 premiers ressentis 1, au moins 2 des 3 suivants ressentis 2 : adopter. |
| **H2** Taille = remplissage | `v3g5-jouer-a`, 20 grilles, mélange de v3g4-a et v3g4-b. Mesures `cells`, `full_n_rows`, `cells_per_decision`. Sans rejet `filler` ni quota de taille, pour avoir des grandes grilles. Au moins 4 Difficile + Expert à 40 cases ou plus, et 4 à 28 cases ou moins. | **4** Difficile et Expert couplées, K ≥ 0,5 : 2 à 40 cases ou plus, 2 à 28 ou moins | Les grandes jugées « remplissage » et sans ★, les petites ★ : le rejet `filler` passe en dur. |
| **H3** Trou contesté = belle | `v3g5-jouer-b`, 20 grilles, mélange de v3g4-c, plus 2 entrées gaz + TAC + 1 voisin (import possible). Tirage du type des creux, quota doux de trous contestés à un tiers des Moyen et plus. Mesure `holes`. | **6** Moyen et Difficile, K ≥ 0,5, moins de 40 cases : 3 avec un trou contesté, 3 avec des trous à choix unique | ★ sur 3 contestés contre ★ sur 1 au plus parmi les uniques : garder le quota. Sinon, la mesure est trop grossière. |
| **H4** Expert ≠ Difficile | Dans les deux lots, au moins 3 Expert chacun. Mesures déjà présentes. | **4** Expert : 2 couplées avec 4 échanges ou plus, 2 avec 1 échange au plus | Si les secondes sont ressenties 1 ou 2, Expert exige aussi au moins 3 décisions d'échange. |

- **Session de demain** : 20 grilles, environ 50 min.
  - 6 grilles H1 ;
  - 14 grilles v3g5, pour H2, H3 et H4 : une grille peut servir deux hypothèses, en visant 4 + 6 + 4 ;
  - ordre comme `matin-23` : jamais deux fois le même lot, la même note ou deux journées de 12 créneaux de suite.
- **Lot rampe** : pas de `v3g5-rampe`. La rampe plaît, et ses défauts sont ceux des autres lots (nucléaire autour), corrigés par H2.

## 6. Suite (options fermées)

| | Option | Coût | Avis |
|---|---|---|---|
| **A** | **Mesures + lots v3g5-a / b cette nuit (§5), session de 20 grilles demain** | 1 tâche générateur + 2 lots + revue ; ~50 min de jeu | **Recommandé** : les 4 hypothèses tiennent en une session, et les mesures servent quoi qu'il arrive. |
| B | Figer dans `GAME-DESIGN.md` les acquis (K, couplée, C1, C2) et la règle Moyen si K ≥ 0,5 | 1 tâche doc + code de la note | Après A : H1 est calée sur les mêmes données, et Difficile / Expert ne sont pas encore distinguées. |
| C | Promouvoir les ★ dures : v3g3-b n°6 (ressentie 4), v3g3-a n°6 (3), rampe n°1 (3), b n°5 (3), v3g3-b n°1 (3) | 1 tâche `add-grid` + `check_unique.py` | Utile au site, indépendant de A. Seulement si l'humain le veut maintenant ; la rampe n'est pas encore publiée. |
| D | Corriger les mineurs de `v3-gen-4` (`min_per_mix` avant les plafonds, jumelles par paire) | petite tâche | Les jumelles ne sont pas perçues (12 / 26) : priorité basse, à joindre à A si le worker a le temps. |
