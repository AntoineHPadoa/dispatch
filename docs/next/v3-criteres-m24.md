# Critères v3 — session `matin-24` (Joueur 1)

Source : `lab/sessions/matin-24.json`, 27 grilles jouées le 24 nov. 2026, **27,5 min de jeu actif** (contre environ 80 min sur `matin-23`). Cumul : **96 grilles notées par Joueur 1** en 5 sessions : S2 (20), S3 (17), G3B (6), M23 (26) et M24 (27).

- 1re partie de chaque grille, hors fantômes ; ressenti et ★ tirés de `notes.json` ; mesures des blocs `lab` (`v3g2-jouer-c` n°18 recalculée avec `filling_measures`, sans `holes`).
- **Étiquette « remplissage / pas compact »** : codée à la main sur les 96 commentaires (regex, puis lecture de chaque commentaire). M24 : 8 grilles.
- **Méthode** : Brier, permutation (20 000 tirages), bootstrap (2 000 à 4 000 tirages), Fisher unilatéral. Scripts dans le scratchpad, hors dépôt.
- `#` = place dans la session ; `n°` = index + 1.

## Résumé

- **Les prédictions ne battent pas la référence triviale.** Brier 0,246 contre 0,241 pour « P(★) = 0,593 ». Pour le ressenti, 15 justes sur 27, exactement comme « toujours 1 ». Aucune hypothèse H1 à H4 n'est retenue au sens du protocole.
- **Les filtres ne se voient pas au ★.** Témoins (7) : 43 % de ★. Nouveaux lots (16) : 62 % (p = 0,65). Les 3 contre-prédictions, grilles de l'ancien générateur à peu de nucléaire ou à 3 voisins, ont **toutes** leur ★. C'est le contenu de la grille qui compte, pas l'âge du générateur.
- **Le squelette n'est pas mieux reçu** : 4 ★ sur 7, 3 « remplissage » sur 7, autant que les témoins. Baisser le nucléaire ne réduit pas la taille (médiane 28 cases). Or **la compacité, c'est le nombre de cases** : AUC 0,89 pour `cells` sur les 4 reproches « pas compact » de M24, contre 0,51 pour `nuclear_share`.
- **Son échelle de ressenti colle aux mesures.** Règle objective : Facile = aucune gomme ni annulation et moins de 2,5 s par case ; Difficile = 6 s par case ou plus ; Expert = abandon. Elle s'accorde à **81 %** avec M24, contre 60 à 62 % en S2 et M23. Le biais (ressenti sous-déclaré de 0,3 à 0,45 cran) disparaît en M24 (+0,11). Les **erreurs** (poses refusées) ne signalent rien : 9 Faciles sur 15 en ont.
- **L'expertise se voit au chrono, pas au ressenti.** À note A égale, le temps par case baisse de 8 % par session (IC [−15 % ; −1 %]), mais le ressenti déclaré ne bouge pas (+0,03 cran par session, IC [−0,04 ; +0,10]). Exemple : les Difficiles de M24 se jouent à 1,7 s par case, contre 4 à 8 s avant. **Recommandation : 2 joueurs neufs** sur un même tirage aléatoire, avec la règle objective à côté du ressenti.

## 1. Protocole du challenger

### Score de Brier

| | Brier ★ | Ressenti : justes / 27 | Écart moyen (ressenti) |
|---|---|---|---|
| Prédictions du bloc replié | 0,246 | 15 | 0,52 |
| Référence `matin-23` (P = 0,593 ; « toujours 1 ») | **0,241** | 15 | 0,52 |
| P = 0,5 | 0,250 | | |

- **Résultat : 16 ★ sur 27**, contre 11,65 attendues. La prédiction globale (« moins que `matin-23` ») est fausse : c'est autant.
- Écart au bootstrap : prédictions moins référence entre −0,08 et +0,09, et meilleures dans 46 % des tirages : **pas de différence**.
- **Calibration** :
  - les grilles cotées sous 0,5 ont quand même 9 ★ sur 17 (53 %) ;
  - celles à 0,5 ou plus : 7 sur 10.
  - ρ(P, ★) = 0,33 (p = 0,09).
- **Ressenti** : 5 surestimés (#6, 9, 15, 21, 22), 7 sous-estimés (#3, 7, 14, 16, 17, 24, 25). Les Difficiles cotés 3 (#6, #15) sont joués à 1 et 2.

**Par groupe** (n petits, à titre indicatif) :

| Groupe | n | ★ | Brier | Référence | Bat la référence ? |
|---|---|---|---|---|---|
| Témoins historiques + ancrage | 5 | 1 | 0,19 | 0,31 | oui |
| Contre-prédictions | 3 | 3 | 0,26 | 0,17 | non |
| `v3g5-temoin` | 3 | 2 | 0,36 | 0,23 | non |
| Squelette | 7 | 4 | 0,21 | 0,25 | à peine |
| H1 (4 Moyens) | 4 | **4** | 0,29 | 0,17 | non |
| H2-H4 | 5 | 2 | 0,24 | 0,28 | à peine |

**Hypothèses H1 à H4** (cases « ce qui trancherait » de la fiche) :

| Hyp. | Attendu | Observé | Verdict |
|---|---|---|---|
| H1 : un Moyen à K < 0,5 se joue comme un Facile | #11, #17 ressentis 1 ; #4 ou #21 ressentie 2 | #11 : 1, #17 : **2** ; #4 : 1, #21 : 1. Les 4 ont leur ★. | **infirmée** : K ne sépare rien |
| H2 : la taille fait le remplissage | #18 « remplissage » sans ★ ; #15 et #27 ★ | #18 : « aurait pu être plus compacte », sans ★ ✓ ; #27 ★ ✓ ; #15 (18 cases) sans ★ ✗ | à moitié |
| H3 : un trou contesté rend belle | ★ sur #2, #15, #17 plus que sur #4, #21 | contestés 2 ★ sur 3 ; uniques 2 sur 2 | **infirmée** |
| H4 : Expert ≥ 4 échanges plus dure que ≤ 1 | #26 ressentie 1-2, #27 ressentie 3+ | #26 : 2 (114 s), #27 : 3 (184 s) | confirmée, sur 2 grilles |

### Témoins contre nouveaux lots

Comparaison faite **dans la session**, à l'aveugle, avec les grilles mêlées.

| Groupe (M24) | n | ★ | Ressenti moyen | Temps médian | s / case | « remplissage » | Cases | Nucléaire | K |
|---|---|---|---|---|---|---|---|---|---|
| Témoins historiques (`v3-jouer-b/c`) | 4 | 1 (25 %) | 1,50 | 45 s | 1,47 | 3 | 33 | 0,83 | 0,12 |
| `v3g5-temoin` | 3 | 2 (67 %) | 1,33 | 27 s | 1,05 | 0 | 28 | 0,90 | 0,56 |
| **Témoins, total** | **7** | **3 (43 %)** | **1,43** | 44 s | 1,31 | 3 | 30 | 0,89 | 0,20 |
| Squelette | 7 | 4 (57 %) | 1,43 | 34 s | 1,14 | 3 | 28 | 0,46 | 0,27 |
| `v3g4` (H1 à H4) | 9 | 6 (67 %) | 1,67 | 54 s | 1,74 | 1 | 27 | 0,84 | 0,83 |
| **Nouveaux, total** | **16** | **10 (62 %)** | 1,56 | 40 s | 1,46 | 4 | 27,5 | 0,68 | 0,49 |
| Contre-prédictions | 3 | **3 (100 %)** | 1,67 | 64 s | 2,57 | 0 | 26 | 0,24 | 0,21 |

- **Écart de ★** entre nouveaux et témoins : +19 points, p = 0,65 (permutation). **Indétectable** avec 7 témoins : le challenger prévoyait qu'il en faudrait 20.
- **L'ancien générateur ne perd que sur ses grilles typiques** : grandes, très nucléaires, sans décision. Les 4 témoins historiques ont 1 ★ (b n°12). En revanche, ses grilles à peu de nucléaire ou à 3 voisins (contre-prédictions) ont 3 ★ sur 3.
- **Le filtre « décisions » se voit** surtout dans K (0,20 contre 0,49) et un peu dans le temps. Il ne se voit **ni au ressenti** (1,43 contre 1,56) **ni au ★** de façon significative.
- **`v3g5-temoin`** (code actuel, quotas de `v3-jouer-a`) fait 2 ★ sur 3, autant que `v3g4`. Les quotas ajoutés depuis `v3g1` n'apportent rien de visible.
- **Réponse** : on ne peut pas dire que nos filtres servent. On peut dire qu'ils ne nuisent pas, et que ce qui fait le ★ est ailleurs que dans les quotas.

### Contre-prédictions et ancrage

| # | Grille | Trait ignoré par les règles | Règles | Pari du challenger | Résultat | Commentaire |
|---|---|---|---|---|---|---|
| 7 | `v3-jouer-b` n°4 | 24 % de nucléaire, carnet exact | 1, pas ★ | ★ 40 % | **★, ressentie 2** | « la grille se remplit vite, donc pas l'impression de juste faire du remplissage » ; mauvais pari sur l'export |
| 24 | `v3g3-jouer-b` n°7 | 23 % de nucléaire, 5 sortes posées | 1, pas ★ | ★ 55 % | **★, ressentie 2** (95 s, 3 gommes) | « plein de possibilités de placement sur le gaz, les imports et le charbon » |
| 22 | `v3g2-jouer-c` n°18 | 3 voisins, carnet exact | 1, ★ incertain | ★ 60 % | **★, ressentie 1** | « j'aime bien le stack de l'export, mais imposé » |
| 5 | `v3-jouer-b` n°17 (ancrage) | sans décision, 87 % de nucléaire | 1, pas ★ | | **1, pas ★** ✓ | « que du remplissage… mais compacte, donc pas ennuyante » |

- **Les règles actuelles (K, couplée, note A) se trompent 3 fois sur 3 pour le ★.** Les paris du challenger font mieux (Brier 0,24 contre 0,81 pour « pas ★ » à P = 0,1) sans battre la référence 0,593 (0,17).
- **L'ancrage tient** : le jugement n'a pas dérivé sur une grille sans décision.
- **Peu de nucléaire → ★** se confirme hors échantillon :
  - avant M24, 7 ★ sur 8 grilles sous 50 % de nucléaire, contre 31 sur 61 ;
  - sur M24, 5 sur 7 contre 11 sur 20 ;
  - cumul : **12 sur 15 contre 42 sur 81** (p = 0,04, unilatéral).
  - Mais ce n'est pas la seule cause : 2 des 7 grilles M24 sous 50 % sont du « remplissage » (squelette n°10 et n°16, voir §2).

## 2. Le squelette (`v3g5-squelette`)

| # | n° | A | ★ | Ress. | Nucléaire | Cases | Lignes N | C/D | Commentaire abrégé |
|---|---|---|---|---|---|---|---|---|---|
| 6 | 2 | D | ★ | 2 | 0,43 | 21 | 0 | 2,1 | « plusieurs mécaniques et compact » |
| 8 | 15 | M | ★ | 1 | 0,60 | 30 | 0 | 10,0 | « peu de possibilités… une bonne grille facile » |
| 10 | 16 | M | | 1 | **0,37** | 30 | 0 | 15,0 | « remplissage en suivant les indices de gauche à droite » |
| 12 | 17 | M | | 1 | 0,94 | 35 | 2 | 11,7 | « trop de nucléaire, juste du remplissage » |
| 19 | 10 | F | | 1 | **0,46** | 24 | 0 | 12,0 | « juste du remplissage… le nucléaire dès qu'on peut » |
| 23 | 7 | F | ★ | 1 | 0,40 | 25 | 0 | 12,5 | « remplissage intéressant, il faut faire gaffe à ses centrales » |
| 25 | 12 | M | ★ | **3** | 0,68 | 28 | 0 | 7,0 | « bien galéré à placer gaz et nucléaire… j'ai bien aimé » |

- **Pas mieux reçu** : 4 ★ sur 7 (57 %), contre 6 sur 9 pour `v3g4`. Ressenti 1,43 ; 3 « remplissage » sur 7, autant que les 7 témoins.
- **Le nucléaire baisse, le reproche reste.** n°16 (37 %) et n°10 (46 %) sont du « remplissage en suivant les indices » : sans décision, le gaz se pose aussi mécaniquement que le nucléaire. Seule n°17 (94 %, 2 lignes pleines) reçoit le reproche « trop de nucléaire ».
- **Ce qui marche** : n°2 (21 cases, C/D 2,1) et n°12 (difficulté concentrée sur gaz et nucléaire). Des grilles **petites et chargées de décisions**, peu importe le nucléaire.

### Mesures contre ★ et « remplissage »

AUC = probabilité qu'une grille « remplissage » (ou ★) ait une valeur plus haute qu'une autre ; 0,5 = hasard.

| Mesure | AUC remplissage M24 (27) | M24, A ≥ Moyen (19) | Cumul (96) | ρ(mesure, ★) cumul |
|---|---|---|---|---|
| `cells` | **0,77** | **0,83** | **0,69** | −0,23 (p 0,02) |
| `cells_per_decision` | **0,77** | 0,82 | **0,69** | −0,25 (p 0,02) |
| `full_n_rows` | 0,65 | 0,72 | 0,57 | −0,10 |
| `nuclear_share` | 0,56 | 0,52 | 0,59 | −0,14 |
| K | 0,23 | 0,24 | 0,25 | +0,37 (p 0,001) |

- **Seuils simples sur M24** :
  - `full_n_rows` ≥ 2 : 3 grilles (c n°14, squelette n°17, a n°4), 3 « remplissage », 0 ★ ;
  - `cells` ≥ 40 : 2 grilles, 2 « remplissage », 0 ★.
  - Ces seuils sont nets mais attrapent peu de grilles.

### « Pas mal de grilles auraient mérité d'être plus compactes »

**Les grilles visées** (4 sur 27) :
- **explicitement** : #18 `v3g4-jouer-a` n°4 (47 cases, « trop grosse pour être satisfaisante »), #20 `v3-jouer-c` n°3 (31 cases, « poser beaucoup de blocs sans que ça apporte quoi que ce soit, pas assez compacte ») ;
- **implicitement** : #3 `v3-jouer-c` n°14 (69 cases, « assailli par toutes les cases… grille de brute ») et #10 squelette n°16 (30 cases ; la suivante est jugée « plus compacte que la précédente, plus plaisante »).

| Mesure | AUC sur ces 4 grilles (M24) |
|---|---|
| **`cells`** | **0,89** |
| `cells_per_decision` | 0,80 |
| `full_n_rows` | 0,71 |
| `nuclear_share` | 0,51 |

- **Sur l'historique**, les 9 commentaires qui citent « compact » vont dans le même sens :
  - éloges : 17, 18, 21, 25 et 31 cases ;
  - reproches : 31, 47, 47, 49 cases, plus 69 (c n°14).
- **Réponse** : `cells` capte le mieux le reproche, avec `cells_per_decision` en appui pour les grilles moyennes sans décision (c n°3 : 31 cases, C/D 31). `nuclear_share` ne capte rien. **La compacité est une taille, pas une composition** ; le squelette a visé la composition.

## 3. Son échelle de ressenti, vérifiée

### Ce que disent les mesures (M24)

| Ressenti | n | s / case (médiane) | Temps médian | Gomme, annulation ou RAZ ≥ 1 | Erreur ≥ 1 | Abandon |
|---|---|---|---|---|---|---|
| 1 Facile, « rempli sans réfléchir » | 15 | **1,05** | 27 s | **1** | 9 | 0 |
| 2 Moyen, « mon intuition s'est trompée » | 10 | 2,17 | 73 s | **6** | 7 | 0 |
| 3 Difficile, « me poser pour regarder » | 2 | **7,95** | 219 s | 2 | 2 | 0 |
| 4 Expert, « s'il y avait une solution » | 0 | | | | | |

- **Facile** : vérifié. Peu de temps par case, et 14 sur 15 sans gomme.
- **Moyen** : vérifié à 6 sur 10. Les 4 autres (#2, #6, #14, #16) n'ont ni gomme ni annulation. Ce sont des grilles « de réflexion sans erreur » (« première fois avec 2 pompages », « pas l'habitude de caler 2 centrales de 1 »). Elles sont ressenties 2 par nouveauté, pas par une intuition trompée.
- **Difficile** : vérifié sur 2 grilles (184 et 255 s, 7 à 9 s par case).
- **Expert** : aucune grille. Sur l'historique, 3 ressentis 4, dont 2 abandons (v3g3-b n°14, rampe n°10) et 1 partie de 311 s : cohérent.
- **Les erreurs ne signalent pas la difficulté.** Une erreur est une pose refusée par le moteur ou contraire à un indice : 9 Faciles sur 15 en ont, souvent 1 ou 2. C'est une faute de manipulation, pas une correction de raisonnement. **La gomme** (et la RAZ) est le bon signal.
- **Mesure manquante** : le labo n'enregistre **ni temps d'inactivité, ni délai avant la 1re pose**. `ms` exclut seulement l'onglet caché. Exemple : #7 a 64 s actifs pour 3 h 35 de montre. On ne peut donc pas distinguer « se poser pour regarder » (une pause) d'une manipulation lente.

### Règle objective proposée

Seuils ronds, posés d'après sa description et non optimisés. Une recherche sur grille ne gagne que 4 points (71 % contre 67 % avant M24).

1. **Expert** : au moins une partie abandonnée sur la grille.
2. Sinon, **Difficile** : 6 s par case ou plus (temps actif / `cells`).
3. Sinon, **Moyen** : au moins une gomme, annulation ou RAZ, ou 2,5 s par case ou plus.
4. Sinon, **Facile**.

| Session | n | Accord exact | Écart moyen | ρ(règle, ressenti) | Biais ressenti − règle |
|---|---|---|---|---|---|
| S2 | 20 | 60 % | 0,55 | 0,39 | −0,45 |
| S3 | 17 | 88 % | 0,12 | 0,81 | −0,12 |
| G3B | 6 | 50 % | 0,67 | 0,74 | −0,33 |
| M23 | 26 | 62 % | 0,46 | 0,69 | −0,38 |
| **M24** | 27 | **81 %** | **0,19** | 0,70 | **+0,11** |
| Cumul | 96 | 71 % | 0,35 | 0,65 | −0,21 |

- **L'écart ne grandit pas avec l'expertise** : il n'a pas de tendance (60, 88, 50, 62, puis 81 %).
- **Avant M24, il sous-déclarait** : biais de −0,3 à −0,45 cran. En M23, 5 grilles jouées avec gommes ou lentement sont ressenties 1, et 3 grilles à plus de 6 s par case sont ressenties 2.
- **En M24, avec son échelle explicite, le biais disparaît.** Il a donc bien appliqué ce qu'il annonce. Ce n'est pas indépendant : son échelle est comportementale par construction.
- **M24 : 5 désaccords**, dont 4 Moyens sans correction (plus haut) et #21 (1 gomme, ressentie 1).
- **Réponse à « à check si objectivement j'ai bien raté »** : non, il n'a pas raté. 81 % d'accord, et ses Moyens ont 2 fois plus de temps par case que ses Faciles.

## 4. Expertise du joueur

| Session | Note A moyenne | Ressenti moyen | Ressenti − A | s / case (médiane) | Erreurs / partie | Gommes et RAZ / partie | Abandons | ★ |
|---|---|---|---|---|---|---|---|---|
| S2 | 1,55 | 1,25 | −0,30 | 1,73 | 0,9 | 1,5 | 1 | 40 % |
| S3 | 1,71 | 1,35 | −0,35 | 1,35 | 1,2 | 2,1 | 0 | 65 % |
| G3B | 2,33 | 2,17 | −0,17 | 2,00 | 1,7 | 1,8 | 2 | 67 % |
| M23 | 2,42 | 1,73 | −0,69 | 2,00 | 2,4 | 2,0 | 3 | 58 % |
| M24 | 1,96 | 1,52 | −0,44 | 1,39 | 1,4 | 0,9 | 0 | 59 % |

**À note A égale** (régression sur A et le rang de la session, 96 grilles) :

| Variable | Effet par session | IC 95 % (bootstrap) |
|---|---|---|
| Ressenti déclaré | +0,03 cran | [−0,04 ; +0,10] |
| Niveau selon la règle | −0,08 cran | [−0,18 ; +0,02] |
| **Temps par case** (log) | **−8 %** | **[−15 % ; −1 %]** |

| s / case (médiane) | S2 | S3 | G3B | M23 | M24 |
|---|---|---|---|---|---|
| Facile | 1,26 | 1,12 | 1,52 | 1,01 | 0,93 |
| Moyen | 2,88 | 1,22 | 0,77 | 1,69 | 1,46 |
| **Difficile** | 7,89 (1) | 4,34 | 5,11 | 8,25 | **1,74** (3) |
| Expert | – | 10,9 (1) | 2,66 (1) | 4,37 | 5,67 (2) |

- **Le ressenti moyen ne baisse pas** à note A égale. En revanche, **le joueur va plus vite** : la session entière a pris 27,5 min, et les 3 Difficiles de M24 ont été joués à 1,7 s par case, contre 4 à 8 s avant.
- **L'usure des globales couplées continue** : ressenti 2,33 (S3), 3,0 (G3B), 2,08 (M23), puis **1,86** (M24). Temps par case : 6,7 s en M23, **1,7 s** en M24. ★ : 3 sur 7.
- **H1 et le reproche « je ne distingue plus Moyen de Facile » ont la même cause** : sur M24, 9 Moyens sur 14 sont ressentis 1, et les 4 H1 sont toutes ressenties 1 ou 2, quel que soit K.

**Implications** :
- **Poids du ressenti** : le ressenti de Joueur 1 reste cohérent avec ses gestes (81 %). Mais il est **calé sur un expert**, et le chrono montre que l'expertise monte encore. Il faut le garder pour le ★, et caler la difficulté sur les mesures (gommes, abandons, s / case) par note A, en suivant la dérive par session.
- **Nouveaux joueurs indispensables** : la note A sert un public qui n'a pas fait 96 grilles. Joueur 1 ne peut plus dire si un Moyen est un Moyen pour un novice. Il faut au moins 2 joueurs neufs, sur le même tirage aléatoire de 8 à 10 grilles.
- **Notation** : caler A sur un novice. Ne pas baisser la frontière Facile / Moyen d'après Joueur 1 : H1 est infirmée, et sa cause probable, l'expertise, ne vaut pas pour le public.

## 5. Verdict et suite

**Acquis** (tient hors échantillon) :
- C1 (mécanique morte) et C2 (sans décision = remplissage), dont l'ancrage tenu en M24.
- **Une globale couplée rend plus dure, mais s'use** : ressenti 1,86 en M24.
- **La taille fait le reproche « pas compact »** : `cells`, AUC 0,89 sur M24, et les 9 commentaires qui citent « compact » vont dans le même sens. 40 cases ou plus, ou 2 lignes pleines de nucléaire : 0 ★ sur 3 en M24.
- **Peu de nucléaire → plus de ★** : 12 sur 15 contre 42 sur 81 (p = 0,04), y compris sur des grilles de l'ancien générateur. Mais cela ne suffit pas sans décision (squelette n°10, n°16).
- **Une règle objective de difficulté** existe (81 % d'accord en M24, 71 % en cumul). La gomme y compte, pas l'erreur.

**Infirmé** :
- **H1** (K ≥ 0,5 comme frontière F / M) ; **H3** (trou contesté → ★).
- **K comme prédicteur du ★** : ρ = +0,14 sur M24 (p = 0,49), pour la 2e session de suite.
- **« Le squelette guérit le remplissage »** : 3 « remplissage » sur 7, autant que les témoins.
- **« Les nouveaux lots plaisent plus »** : 62 % contre 43 %, p = 0,65 ; et `v3g5-temoin` sans quotas fait autant que `v3g4`.

**Ouvert** :
- **H4** (Expert à 4 échanges ou plus > Expert à 1 échange) : 2 grilles dans le bon sens ;
- **Témoins** : 7 sur 20 nécessaires ;
- la vraie difficulté pour un novice ;
- **la stabilité du jugement** : rejeux non faits, le labo montre l'ancienne ★.

| | Option | Coût | Avis |
|---|---|---|---|
| **A** | **Recruter 2 joueurs neufs** : même tirage de 10 grilles (dont 3 témoins), ressenti et ★, règle objective calculée à côté | 1 session de 30 min par joueur ; 1 tirage | **Recommandé.** C'est le seul moyen de caler A et de savoir si les ★ de Joueur 1 sont des ★ d'expert. Toutes les autres options en dépendent. |
| B | **Corriger le labo** : temps d'inactivité et délai avant la 1re pose ; vrai rejeu à l'aveugle (masquer l'état résolu, la ★ et le commentaire) | petite tâche `web/src/lab` + `lab_server.py` | À faire avant A si c'est rapide : la mesure « se poser pour regarder » manque, et sans rejeu on ne mesure pas la dérive. |
| C | **Lot compact** (`v3g6-compact`) : plafond de cases (≤ 30, aucune grille à 2 lignes pleines de nucléaire) à la place du plafond de nucléaire, mélange de `v3g4-jouer-a` | 1 tâche générateur + 1 lot | Vise le reproche le mieux mesuré. Mais c'est un réglage de plus calé sur Joueur 1 : à jouer par les nouveaux joueurs de A. |
| D | **Figer dans `GAME-DESIGN.md`** C1, C2, « couplée = plus dure » et la règle objective de difficulté (pour le labo, pas pour la note) | 1 tâche doc | Utile, mais la notation A doit attendre A. |
