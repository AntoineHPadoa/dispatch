# Critères d'une belle grille — session 3 (`v3-jouer-b`, `v3-jouer-c`, G11)

Source : 18 parties à l'aveugle de Joueur 1 (session `v3-session-3`), cumulées avec la session 2 (`v3-jouer-a-1`) : 40 premières parties (`attempt == 1`, hors fantômes), dont 38 avec un ressenti et 37 sur des grilles `v3-jouer-*`. Mesures `decisions` recalculées avec le code de `main` (`deduce/trace.py`), sans toucher aux lots. Numéros `n°` = index + 1. Scripts : scratchpad du worker, hors dépôt.

## Résumé

- **Prédictions** : 12 justes sur 14 fermes (★ 7 sur 8 prédites belles, rejet 4 sur 5 prédits rejetés), plus 2 sur 3 pour C5. Les 2 erreurs : b n°3 (3 décisions, « du remplissage ») et b n°11 (voisin mort, gardée quand même).
- **Critères** : C1 et C2 confirmés sur 37 grilles (0 décision : 0 ★ sur 7 ; ≥ 2 décisions : 14 ★ sur 19 contre 4 sur 18, p ≈ 0,002). C5 confirmé. C6 infirmé. C4 toujours indécis, penche oui (seuil 12 barres).
- **Ce qui rend une grille dure pour le joueur** : une mécanique *globale*, c'est-à-dire la STEP ou un plafond CO₂ actif. Les 5 grilles qui en ont sont toutes ressenties 2 ou 3 et occupent 5 des 6 parties les plus longues. Sans elles : 5 ressentis 2 sur 32, aucun 3. Corrélation avec le ressenti : ρ 0,67, contre 0,19 pour la note du solveur.
- **Notation** : abaisser ruban (1), répartition du carnet (2) et réfutation (3) divise par 2 l'écart à la note ressentie (erreur moyenne 0,89 → 0,45), mais n'améliore pas l'ordre (ρ 0,21). Il faut aussi que Difficile exige une mécanique globale. Sur les grilles publiées, G10 et le tutoriel 9 passent de Difficile à Moyen.
- **G11** : ressenti 1 en 23 s, « remplissage en faisant les exports minimum ». Étiquette recommandée : **Facile**. « Pas assez de grilles compliquées » est juste : les lots ont peu de STEP + CO₂ (4 grilles sur 60 dans `v3-jouer-*`, 3 sur 60 dans `v3g1-*`), et c'est précisément ce qui résiste.

## Tableau par grille (session 3)

Ressenti 1 Facile … 4 Expert. Déc. : décisions de `main` par type (`ex` échange, `st` STEP, `co` CO₂, `ha` pièce haute). Morte : mécanique déclarée sans effet. ✔ / ✘ : prédiction de `v3-criteres.md` tenue ou non.

| Grille | Note | Ress. | Temps | Err./gommes | ★ | Déc. | Barres | Morte | Prédiction | | Commentaire abrégé |
|---|---|---|---|---|---|---|---|---|---|---|---|
| b n°1 | Moyen | 2 | 141 s | 1/2, 1 RAZ | ★ | 6 ex, co | 8 | | belle | ✔ | « une difficulté pour l'import/export » |
| b n°2 | Moyen | 1 | 88 s | 0/8 | | 3 ex | 18 | | rejet si C4 | ✔ | « seule difficulté : le nombre de nucléaires ; les barrages tombent en bas » |
| b n°3 | Difficile | 1 | 28 s | 1/0 | | 3 ex | 13 | | belle | ✘ | « du remplissage » |
| b n°5 | Moyen | 1 | 47 s | 1/1 | ★ | ha | 11 | | C5 | ✔ | « petite réflexion sur où poser le charbon » |
| b n°8 | Moyen | 1 | 39 s | 0/0 | | 1 ex | 8 | CO₂ | rejet | ✔ | « le CO₂ ne sert à rien, centrales imposées » |
| b n°10 | Moyen | 2 | 74 s | 1/2 | ★ | ha | 9 | | C5 | ✔ | « le charbon n'était pas évident, plusieurs places possibles » |
| b n°11 | Facile | 1 | 24 s | 1/0 | ★ | 2 ex | 11 | IT | rejet | ✘ | « remplissage, mais un petit peu intéressant » |
| b n°14 | Moyen | 1 | 29 s | 2/0 | ★ | 2 ex | 7 | | belle | ✔ | « les 2 imports pour placer les 5 nucléaires ; facile mais agréable » |
| b n°18 | Difficile | 1 | 73 s | 2/0 | ★ | 4 ex | 14 | | belle ? | ✔ | « bonne facile, un peu plus que du remplissage » |
| b n°19 | Expert | 1 | 29 s | 0/0 | | ha (donnée par un relevé) | 9 | | C5 | ✘* | « grâce à l'indice sur le charbon, remplissage rapide » |
| b n°20 | Difficile | 2 | 231 s | 4/13 | ★ | 1 ex, st | 12 | | belle | ✔ | « pas loin de difficile ; carnet imposé, plus assez de centrales d'une taille » |
| c n°2 | Moyen | 1 | 39 s | 1/0 | | 0 | 10 | | rejet | ✔ | « du remplissage » |
| c n°5 | Difficile | 1 | 19 s | 0/0 | ★ | 2 ex | 7 | | belle | ✔ | « bonne facile, le placement des exports la rend cool » |
| c n°10 | Expert | 3 | 317 s | 6/3, 3 RAZ | ★ | 3 ex, st, co | 11 | | belle | ✔ | « super ; galéré avec le CO₂ ; exporter permet du nucléaire à la place du gaz » |
| c n°13 | Moyen | 1 | 42 s | 0/0 | | 0 | 13 | | rejet | ✔ | « se brute-force en mettant du nucléaire partout » |
| c n°17 | Facile | 2 | 96 s | 1/2 | ★ | 2 ex | 8 | | belle | ✔ | « mélange plusieurs mécaniques, un peu de réflexion » |
| c n°19 | Facile | 1 | 23 s | 0/0 | | 1 ex | 8 | UK, ES, DE | rejet | ✔ | « remplissage, plein d'indices inutiles sur l'import/export » |
| G11 | Expert (publiée), Facile (solveur) | 1 | 23 s | 0/0 | — | 2 ex | 9 | | ressenti 1 | ✔ | « remplissage en faisant les exports minimum » |

\* b n°19 : la pièce haute est fixée par le relevé « 2 cases de charbon à 12h ». La mesure `decisions` la compte quand même, car elle n'exclut que les indices `engaged`.

**Calibrage session 3** : les notes Facile 1, 1, 2 ; Moyen six 1, deux 2 ; Difficile 1, 1, 1, 2 ; Expert 1, 3. Au cumul, sur 4 Expert ressenties, une seule (c n°10) dépasse 1.

## Conclusions par critère (37 grilles, 18 ★)

| | Critère | Session 3 | Cumul | Verdict |
|---|---|---|---|---|
| C1 | Aucune mécanique morte | 1 ★ sur 3 (b n°11) | 1 ★ sur 7, contre 17 sur 30 (p ≈ 0,05) ; 5 commentaires explicites | **confirmé**. L'exception a 2 décisions et un commentaire tiède. Déjà traité au générateur (`v3-gen-1` nettoie). |
| C2 ≥ 1 | Au moins une décision | 0 ★ sur 2 | 0 ★ sur 7 ; 7 commentaires « remplissage » ou « nucléaire partout » | **confirmé** (nécessaire) |
| C2 ≥ 2 | Au moins deux décisions | 8 ★ sur 10, contre 2 sur 7 | 14 ★ sur 19, contre 4 sur 18 (p ≈ 0,002) | **confirmé**. Les 4 ★ sous le seuil ont une seule décision « lourde » : STEP (a n°2), pièce haute (b n°5, n°10), export non vu (a n°10). |
| C4 | Pas trop de barres | b n°2 (18) rejetée, b n°18 (14) ★ | parmi C1 + ≥ 2 décisions : 13 barres et plus, 1 ★ sur 3 ; 12 et moins, 12 ★ sur 13 (p ≈ 0,07) | **toujours indécis**, penche oui. 2 commentaires accusent le nombre (b n°2, a n°17). Seuil plausible : 12. |
| C5 | La pièce haute compte comme décision | 2 ★ sur 3 grilles à pièce haute seule | idem (aucune en session 2) | **confirmé**, à une réserve près : la pièce haute ne compte pas quand un indice la donne (b n°19). |
| C6 | Pas de prix « nucléaire » en carnet libre | b n°5 et n°10 : 2 prix N chacune, toutes deux ★ | 2 ★ sur 4 à ≥ 2 prix N | **infirmé** au seuil ≤ 1. Le vrai défaut, c'est le carnet libre sans décision (c n°13, c n°2), et C2 le couvre déjà. |
| C3 | Plusieurs mécaniques vivantes | 3 ★ sur 3 | 7 ★ sur 8, contre 11 sur 29 (p ≈ 0,017) ; ρ ressenti 0,52 | **probable**, en partie confondu avec C2 |

Sans le compter comme critère : **C1 + C2 ≥ 2** gardent 16 grilles, dont 13 ★. Elles en écartent 21, dont 5 ★.

## G11

- **Partie** : ressenti 1, 23 s, 0 erreur, 13 coups. Commentaire : « remplissage en faisant les exports minimum ».
- **Solveur** : Facile, quelle que soit la variante de notation (4 étapes de niveau 1).
- **Recommandation** : option (b), **étiquette Facile**. Le test qui garde l'écart de côté peut être retiré. Le texte de la grille ne promet rien d'Expert ; seul le titre « Expert » change.

## Notation (changements 4 et 5)

**Méthode** : on rejoue `scripts/rerate_lots.py` sur des copies de `v3-jouer-a/b/c` et `nuit-rejeu-notees` (scratchpad), avec les niveaux de règles modifiés au chargement, sans toucher `solver/`. L'ordre des règles est inchangé. « Réfutation 3 » sert d'approximation au changement 4a, qui regroupe les réfutations : il est plus fin, mais n'a pas été codé. On compare ensuite aux 38 ressentis (28 à 1, 9 à 2, 1 à 3). Seul G8 reste signalé à la réévaluation (`useless_clue:1`) : c'est son indice de confort, connu.

| Variante | Exact | Erreur moy. | Surnotées | ρ | F/M/D/E (38 parties) | F/M/D/E (60 grilles) |
|---|---|---|---|---|---|---|
| V0 actuelle | 14 | 0,89 | 23 | 0,22 | 10/17/7/4 | 20/22/9/9 |
| V1 ruban → 1 | 20 | 0,74 | 14 | 0,21 | 22/5/7/4 | 35/7/9/9 |
| V2 + répartition → 2 | 23 | 0,55 | 11 | 0,21 | 22/12/0/4 | 35/16/0/9 |
| **V3 + réfutation → 3** | 24 | 0,45 | 10 | 0,21 | 22/12/4/0 | 35/16/9/0 |
| R : V3, Difficile exige une mécanique globale | 24 | 0,37 | 10 | 0,27 | 22/15/1/0 | — |
| M : 1 + STEP + CO₂ actif (seul) | 33 | 0,13 | 0 | 0,68 | 33/4/1/0 | — |

- **Lecture** : les trois baisses de niveau sont justifiées par les traces. Le ruban porte sur des lignes du dessin. La répartition est faite d'instinct sur les petites grilles (b n°3, c n°5 : 19-28 s). La réfutation, c'est 7 à 12 hypothèses ligne par ligne pour une seule idée du joueur. Ces baisses suppriment la moitié des surnotes, mais pas le désordre : la note du solveur ne classe pas les grilles comme le joueur.
- **Ce qui classe** : le nombre de mécaniques globales (M). M est trop pauvre pour servir de note à lui seul : il est ajusté sur 5 grilles, et il mettrait presque tout en Facile, tutoriels compris.
- **Proposition** : V3, plus une règle de plafond, la variante R : **Difficile exige une mécanique globale vivante (STEP trouvée ou CO₂ actif), Expert en exige deux**. Formule : note = min(niveau des techniques, 2 + nombre de mécaniques globales). Le changement 5 (des décisions qui montent la note) n'est pas retenu : les grilles à 3-4 échanges, comme b n°2, n°3 et n°18, sont ressenties 1.
- **Effet sur les grilles publiées** (même calcul, appliqué à `grids.json`) :
  - **G10 « Difficile » → Moyen** (`share_out`, aucune mécanique globale) ;
  - **tutoriel 9 « Deux bords se relaient » Difficile → Moyen** (`share_out` avant `ramp_relay`) ;
  - G11 : déjà Facile au solveur ;
  - **inchangées** : toutes les autres grilles publiées, y compris les tutoriels 4 et 7 et G9, dont la note de 2 tient aussi à `column_sum` et pas seulement au ruban ;
  - **conséquence** : plus aucune grille notée Difficile ni Expert n'est publiée. C'est cohérent avec le ressenti, mais il faut de vraies grilles dures avant de mettre la notation en `main` (voir plus bas).

## « Pas assez de grilles compliquées »

**Ce qui a résisté** (les 6 parties les plus longues sur 40) :

| Grille | Temps | Gommes, RAZ | Ress. | Mécanique globale | Ce qui coince (commentaire) |
|---|---|---|---|---|---|
| c n°10 | 317 s | 3, 3 | 3 | STEP + CO₂ | le CO₂ : comprendre qu'exporter laisse du nucléaire remplacer le gaz |
| b n°20 | 231 s | 13 | 2 | STEP | le carnet exact sur 12 créneaux : il manque des centrales d'une taille |
| a n°2 | 213 s | 3, 1 | 2 | STEP | où turbiner |
| a n°19 | 210 s | 7, 1 | 2 | STEP | 3 cases de nucléaire viennent du pompage et de l'export |
| a n°10 | 163 s | 8 | 1 | — | export vers l'Italie non vu (point d'interface) |
| b n°1 | 141 s | 2, 1 | 2 | CO₂ | la répartition des 6 exports sous le plafond |

- **Les mécaniques globales couplent des heures éloignées** : la STEP (pomper à 6h, turbiner à 18h) et le plafond CO₂ (un budget sur la journée) obligent à raisonner sur toute la journée. Les échanges, eux, se trouvent colonne par colonne. Avec une STEP ou un CO₂ actif : 5 grilles, ressentis 2, 2, 2, 2, 3. Sans : 32 grilles, 27 ressentis 1.
- **Ce qui ne résiste pas** :
  - la taille seule (12 créneaux, ρ 0,17) ;
  - le nombre de barres (ρ −0,14 ; b n°2, 18 barres, « seule difficulté : le nombre ») ;
  - les techniques 3-4 du solveur : 3 Expert ressenties 1 sur 4 ;
  - un indice qui livre la mécanique : b n°19 (relevé du charbon) et G11 (exports « minimum »).

**Propositions au générateur**, par effet attendu :

1. **Lot « dur »** : chaque grille a au moins une mécanique globale vivante, et les Expert en ont deux, couplées à un voisin. Recette de c n°10 : 8 créneaux, carnet libre, 1 voisin, une STEP, un plafond CO₂ qui oblige à exporter pour remplacer du gaz par du nucléaire. Nouvelle mesure `global_mechanics` dans le bloc `lab`, avec un quota par lot.
2. **STEP à 2 paires** (`inventory.step: 2`), où un seul couple pompage-turbinage tient. Aucune grille jouée n'en a ; `v3g1-jouer-b` n°4 en a une.
3. **CO₂ seulement en carnet libre, et contraignant** : garder la grille si une étape `carbon` retire une barre *et* que la solution exporte. C'est la condition de l'« astuce » de c n°10.
4. **Taille** : 8 créneaux par défaut. 12 créneaux seulement avec une mécanique globale, et au plus 12 barres (C4, en mesure).
5. **Carnet** : exact avec des longueurs en concurrence entre centrales (b n°20), ou libre avec CO₂ ou STEP. Jamais libre sans les deux : sinon on remplit de nucléaire (c n°2, c n°13).
6. **Indices** : aucun indice ne doit fixer la décision principale. Il faut exclure les relevés de colonne sur la pièce haute et les flux sur la STEP. Pour les échanges, préférer les totaux du jour (`exchanges`) aux flux par créneau.
7. **Types de décisions**, du plus ressenti au moins ressenti : STEP ≈ CO₂ > pièce haute ≈ exports empilés sur plusieurs voisins > export isolé. Pour viser Difficile : au moins 1 décision globale et 2 autres.

Grilles déjà générées et jamais jouées, qui testent la proposition 1 : `v3-jouer-c` n°6, 9, 15 et `v3g1-jouer-c` n°14, 15, 18 (STEP + CO₂ actif).

## Session « 2e joueur »

Fichier `lab/sessions/v3-joueur2.json` : 12 grilles, Facile en tête, puis ordre aléatoire (graine fixe). Joueur 2 n'a encore aucune partie, donc il n'y a aucun doublon à éviter. Justification dans le bloc replié, **à ne pas ouvrir par Joueur 2**.

<details>
<summary>Composition (ne pas ouvrir avant d'avoir joué)</summary>

| Grille | Raison | Joueur 1 |
|---|---|---|
| c n°17 | Facile belle, en tête | ★, 2 |
| c n°10 | meilleure grille, STEP + CO₂ | ★, 3 |
| b n°20 | STEP + carnet exact 12 créneaux | ★, 2 |
| b n°1 | CO₂ + 6 exports | ★, 2 |
| a n°19 | STEP + export | ★, 2 |
| a n°15 | exports empilés sur 3 voisins | ★, 2 |
| b n°5 | C5 : pièce haute seule | ★, 1 |
| b n°19 | C5 : pièce haute donnée par un relevé ; Expert au solveur | rejet, 1 |
| b n°2 | C4 : 18 barres, 3 décisions | rejet, 1 |
| b n°18 | C4 : 14 barres, 4 décisions | ★, 1 |
| c n°13 | contrôle C2 : carnet libre sans décision | rejet, 1 |
| c n°9 | jamais jouée : STEP + CO₂ sans voisin (proposition 1) | — |

À regarder : accord des ★ entre joueurs (6 ★ de J1), ressenti de c n°9 et c n°10 (≥ 2 attendu), et C4 (b n°2 contre b n°18).

</details>

## Questions à l'humain

1. **G11** : passer l'étiquette à Facile ? Recommandation : oui.
2. **Notation** : adopter V3 (ruban 1, répartition 2, réfutation 3) et la règle « Difficile exige une mécanique globale, Expert deux » ? G10 et le tutoriel 9 passent alors à Moyen. Recommandation : oui, mais livrée avec le premier lot « dur », pour ne pas vider Difficile en attendant.
3. **Lot « dur »** : générer un lot centré sur la STEP et le CO₂ (propositions 1 à 4) avant la prochaine session de Joueur 1 ? Recommandation : oui, en commençant par faire jouer les 6 grilles STEP + CO₂ déjà générées.
4. **C5** : la pièce haute compte comme décision, sauf quand un relevé de colonne ou un indice `engaged` la fixe (ajuster `decisions`) ? Recommandation : oui.
5. **C6** : abandonner le critère des prix nucléaires en carnet libre ? Recommandation : oui ; C2 couvre le défaut.
6. **C4** : mesurer les barres (seuil 12) sans rejeter, jusqu'à la session de Joueur 2 ? Recommandation : oui.
7. **Session Joueur 2** : la jouer telle quelle (12 grilles) ? Recommandation : oui.
