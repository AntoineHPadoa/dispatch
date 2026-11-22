# Review — `v3-gen-3` (notation A, lots durs `v3g3-*`, G7, G8, G10, tutoriel 9)

Relecteur : `s6`. Auteur : `s5`. Branche relue : `v3-gen-3` à `fc50e72` (3 commits sur `80fea72`). Diff : `main...v3-gen-3`.

## Verdict : **OK à merger**

- Le code, `grids.json`, les fixtures et la re-notation sont conformes à la spec et aux deux ajouts. Tout est vert, sur la branche comme sur le merge à blanc avec `main`.
- Le merge avec `main`, qui contient déjà `v3-lab-players`, est propre. G11 y reste Facile.
- **Pour être franc sur les lots** : ils ne sont que légèrement plus durs au sens du joueur. Le lot A ne l'est pas du tout, et il est plus monotone que `v3g2-a`. Ce n'est pas bloquant pour le merge, puisque ce sont des candidates du labo. En revanche, l'objectif « lot dur » n'est atteint que par B (point 1).

## Ce qui a été vérifié

| Contrôle | Résultat |
|---|---|
| `cd solver && .venv/bin/pytest -q` | 206 passed (215 s) |
| `dispatch-solver check-published` | OK, 13 grilles uniques et déductibles |
| `pytest lab/tests -q` (dont `test_candidate_drawings.py`, le test de dessin) | 337 passed |
| `web/` : `npm test` | 11 fichiers, 429 tests verts |
| `check_unique.py` | OK |
| `check --strict` sur `v3g3-jouer-a` et `-b` | exit 0 ×2, 40/40 valides, 1 composition, déduites |
| Merge à blanc `main` + `v3-gen-3` (`git merge-tree`) | **aucun conflit**, ni sur `grids.json` ni sur `test_published.py` |
| Sur l'arbre fusionné | `test_published` + `test_rating` + fixtures : 59 verts ; `lab/tests` : 347 verts ; vitest : 432 verts ; `check_unique.py` : OK |
| Conventions | commits en anglais, auteur noreply, aucune mention d'IA ; en-têtes de fichiers à jour ; `GAME-DESIGN.md` §9-§10 et `solver-v2.md` §18 mis à jour |

### Notation A

- **Conforme à la décision** (`deduce/trace.py`) :
  - `RATING_LEVELS` = ruban 1, `share_out` 2, `refuted` 3 ;
  - plafond `TECHNIQUE_CAP` = 2 ;
  - puis `+ len(coupled_globals)`, borné à 4.
- **Mécanique couplée** : STEP fixée par une étape et pompée dans la composition, ou étape `carbon`. Elle ne compte que si la composition a un export ou un import.
- **Ordre de déduction inchangé** :
  - les niveaux des `Rule` ne bougent pas ; seul `Result.rating` remappe ;
  - `max_level` du générateur et la boucle restent sur les niveaux bruts ;
  - `technique_level` garde le niveau brut dans le résumé.
- **Étiquettes publiées recalculées par un script indépendant** (remappage à la main de la trace, couplage lu dans `solution`, pas dans `coupled_globals`). Les 13 grilles concordent, sur la branche comme sur l'arbre fusionné :

| Grille | Trace (niveaux A) | Globales | Échange | A | Publié |
|---|---|---|---|---|---|
| G7 (tuto 7) | `1111111111111112` | STEP | oui | **Difficile** | Difficile |
| G8 | `1131111` (réfutation) | — | oui | **Moyen** | Moyen |
| G10 | `11222111111` (`share_out`) | — | oui | **Moyen** | Moyen |
| Tuto 9 (id 13) | `2212211` (`share_out`) | — | non | **Moyen** | Moyen |
| G11 (après merge) | `1111` | — | oui | Facile | Facile |
| Les 8 autres | inchangées | | | | |

### `grids.json`

- **Ids et ordre** : identiques à ceux de `main` (13 grilles).
- **Champs changés** : seulement ceux attendus.
  - G7 et tuto 9 : `difficulty` ;
  - G10 : `difficulty` et `title` (« Difficile » → « Moyen ») ;
  - G8 : `difficulty`, `title` (« Facile » → « Moyen ») et **le flux de confort retiré** (`flow` col 2, DE, export 0) ;
  - G11 : non touchée dans le diff de la branche (base `80fea72`). Le merge prend le Facile de `main`.
- **`difficulty.techniques` de G8** : la liste change aussi (`refuted` entre, `flow` sort). C'est la conséquence logique du retrait de l'indice.

### Re-notation des lots actifs

Mon recomptage depuis les fichiers (`main` contre branche) donne exactement le tableau de `V3G3.md` :

| | Avant F/M/D/E | Après F/M/D/E |
|---|---|---|
| Total des 12 lots actifs (210 grilles) | 49/94/30/37 | 91/96/17/6 |

- Ce qui change : les ids, l'ordre et tous les champs hors `lab` et `difficulty` sont identiques.
- Ce qui est exclu : `v3-confort` (non suivi) et les archives.
- `recheck` : seulement `nuit-rejeu-notees` n°1 (`useless_clue`, connu).

### Fixtures

Le diff est relu et justifié :
- **Notes** : 19 fixtures changent de note, comme le veut la notation A. Exemples : `valid-tall-coal` et `valid-technique-length` passent Moyen → Facile (ruban 1) ; `valid-trap-co2-country` passe 2 → 3 (CO₂ couplé à un import).
- **Rattrapage de dérive** : 39 fixtures `invalid-*` perdent l'`intro` de la grille 5. Le commit `a6a0f4a` l'avait retirée de `grids.json` sans rebâtir les fixtures. Même chose pour « Sans inventaire » → « Sans carnet exact » dans `unpublishable-two-compositions`.
- **`min_decisions: 0`** sur les 4 grilles « technique » : mêmes graines, mêmes grilles. Ce n'est qu'un déblocage de `build_fixtures.py`.

### Lots `v3g3-jouer-a/b` : plafonds

Recompté depuis les candidates :

| | a | b | Plafond | |
|---|---|---|---|---|
| Globale couplée | 5 | 6 | ≤ 6 (1/3), ≥ 4 | ✔ |
| Prix de demande D7 | 0 | 1 | ≤ 5 (1/4) | ✔ |
| K | mesure seule, aucun filtre ni quota dans `lot.py` | | | ✔ |
| D/E sans mécanique couplée | 0 | 0 | — | ✔ (cohérent avec A) |

Le `coupled_globals` du bloc `lab` concorde avec mon calcul indépendant (décision `step` ou `carbon`, plus un échange dans `solution`) sur les 100 grilles `v3g2` et `v3g3`.

## Points

### 1. Le lot A n'est pas plus dur que `v3g2-a`, et il est plus monotone. Mineur (lab), mais à dire à l'humain.

| | v3g3 a | v3g3 b | v3g2 a | v3g2 b | v3g2 c |
|---|---|---|---|---|---|
| Globale couplée | **5** | 6 | **6** | 5 | 3 |
| Globale **sans** échange (profil c n°9, ressenti 1) | **8** | 5 | **5** | 9 | 10 |
| Grilles sans voisin | **12** | 8 | 9 | 10 | 12 |
| Grilles à une seule décision | **9** | 3 | 6 | 0 | 4 |
| 12 créneaux | 1 | **5** | 1 | 2 | 3 |
| Plus de 12 barres | 4 | 5 | 0 | 2 | 0 |

- **Gain de dureté** : par lot, 5,5 grilles couplées contre 4,7 en `v3g2`. Le gain réel au sens du joueur est donc faible. Il est même nul pour A, qui en a moins que `v3g2-a`. La hausse des Difficile/Expert (11 sur 40) vient surtout de la notation : toutes les grilles couplées y montent, alors qu'en `v3g2` 4 grilles couplées restaient Moyen.
- **Cause, propre à A** : le nettoyage des voisins morts (§10.3) transforme les entrées « couplables » en profil facile.
  - Les entrées 0 (STEP + CO₂ + 1 voisin), 2 (STEP + 1 voisin) et 3 (CO₂ + 2 voisins) ont perdu leur voisin 5 fois : n°3, 7, 12, 13 et 14.
  - Résultat : 4 grilles « STEP seule sans voisin » (n°1, 13, 14, 18) et 3 « STEP + CO₂ sans voisin » (n°3, 4, 7).
  - `V3G3.md` annonce une baisse de ce profil (13 sur 40 contre 24 sur 60). C'est vrai sur l'ensemble, grâce à B, mais faux pour A : 8 grilles contre 5 en `v3g2-a`.
- **Jumelles dans B**, le motif qui a fait quitter Joueur 2 (b n°19 après b n°5) :
  - entrée 5, 4 grilles, toutes à 12 créneaux : n°15 et n°16 sont quasi jumelles (12 créneaux, sans voisin, une seule décision « pièce haute », Facile) ;
  - entrée 6, 3 grilles (n°5, 8, 17) : « 2 paires STEP + stock », sans voisin, dont 2 Faciles à 14 et 16 barres.
  - Aucun quota ne limite le nombre de grilles par entrée du mélange.
- **Ressemblance globale** (similarité de Jaccard sur famille, créneaux, carnet, mécaniques, profil d'indices, types de décision et voisins) : moyenne 0,28 (A) et 0,30 (B), contre 0,23 à 0,29 en `v3g2`. Paires ≥ 0,6 : 10 et 15, contre 13 à 15. **Les lots ne sont pas globalement plus uniformes.** La monotonie se concentre sur les grappes citées ci-dessus.
- **Piste**, sans règle précise : retirer le lot A de la prochaine session et tirer d'abord dans B (n°1, 2, 6, 12, 13, 14). Ou régénérer A avec une autre graine : 26 s. Ajouter un plafond par entrée de mélange ou par nombre de créneaux serait une règle de plus, que l'humain veut éviter. À trancher par lui.

### 2. D7 : essai sans effet. Mineur, bien rapporté.

- 1 grille sur 40 (b n°4), et le prix n'y tranche rien (aucune étape `top_price`).
- Le mécanisme (graine d'indice élaguée en dernier) est correct et testé sur le tutoriel 6.
- La conclusion de `V3G3.md` (« il faudrait construire la journée pour le prix ») est juste.

### 3. Quotas dépassés en fin de lot B. Mineur, préexistant.

- `exchange` : 12 grilles pour un plafond de 10.
- Famille `nuit_plate` : 4 pour un maximum de 3.
- Cause : les deux places viennent de `min_per_mix`, qui passe avant les plafonds en fin de lot. C'est le même comportement qu'en `v3g2-b` (`surplus_midi` 4). L'auteur l'a signalé pour `exchange`, pas pour la famille.

### 4. G8 exige maintenant une réfutation. Mineur, information.

- Sans son flux de confort, la 1re grille notée passe par « Hypothèse réfutée » : niveau brut 4, noté Moyen en A.
- C'est la consigne de l'humain. Le lot `v3-confort`, qui teste cette version, n'a pas encore été joué.
- G8, G9 et G10 s'appellent maintenant tous trois « Moyen », comme demandé.

### 5. Le couplage compte les imports trouvés au comptage final. Mineur, à noter.

- `coupled_globals` considère qu'il y a échange dès qu'il y a un import, même trouvé seulement en comptant les colonnes (ce n'est pas une décision `exchange`).
- C'est ce qui met G7 en Difficile, et c'est conforme à la décision 3 (« la solution a au moins un échange »).
- Conséquence : une grille peut être Difficile avec un échange qui ne se décide pas, ce qui pourrait l'adoucir. Les données de jeu disent qu'il faut le surveiller, pas le changer.

## Hors périmètre

- `GAME-DESIGN.md` §9 garde la colonne « Niveau » brute (ruban 2, répartition 3, réfutation 4), désormais lue comme l'ordre de la déduction. Le texte l'explique. Ce n'est pas une erreur.
