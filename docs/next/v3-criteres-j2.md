# Critères d'une belle grille — Joueur 2, et G7 comme référence

Sources : 8 parties de Joueur 2 (session `v3-joueur2`, `attempt == 1`, hors fantômes), ses 8 commentaires dans `lab/notes.json`, ses deux retours oraux sur G6 et G7 (site publié, sans mesure), et les 36 parties notées de Joueur 1 sur `v3-jouer-*`. Mesures recalculées avec le code de `main` (`deduce`, `decisions`), sans toucher aux lots. Les notations V3, R et A sont recalculées après coup, en remappant les niveaux sur la trace. Scripts dans le scratchpad du worker, hors dépôt. Numéros `n°` = index + 1.

Lecture des commentaires : Joueur 2 a tapé en disposition QWERTY sur un clavier AZERTY (`q` = a, `;` = m). Exemple : « lq po;pe qjoute de lq difficulte » se lit « la pompe ajoute de la difficulté ».

## Résumé

- **Joueur 2 ressent plus dur que Joueur 1** : +0,57 cran en moyenne sur les 7 grilles jouées par les deux (2,43 contre 1,86), et 2,5 fois plus de temps (médiane 219 s contre 88 s). Les deux classent les grilles à peu près dans le même ordre (ρ 0,56). Pour lui, **la STEP est la mécanique dure** : b n°20 lui a pris 619 s, avec 10 erreurs et 14 gommes, et il a « galéré avec les pompes » sur G7.
- **C1 et C2 ne sont pas testables sur lui** : ses 8 grilles ont toutes au moins une décision et aucune mécanique morte, et la grille témoin (c n°13) n'a pas été jouée. Il garde tout (8 commentaires sur 8 commencent par « bien » ou « bon »), et son ressenti suit le temps (ρ 0,64), pas les décisions (ρ 0,10).
- **Contre-exemple à « mécanique globale = dur »** : c n°9 (STEP + CO₂, **sans voisin**, Expert au solveur) a été ressentie 1 en 103 s, « bonne grille pour débuter ». Une mécanique globale ne rend la grille dure que **couplée à un échange**. Les deux grilles ressenties 3-4 par les deux joueurs (c n°10, G7) en ont une.
- **G7, référence de beauté** : 8 créneaux, 25 cases, 7 barres d'une seule sorte de centrale, 1 voisin. Une seule décision, la STEP, trouvée à l'étape 9 sur 16 ; le reste se met en place autour. Dans les lots, **2 candidates** sur 120 lui ressemblent au sens strict, 4 au sens large. La compacité proposée, K = poids des décisions / pièces posées, sépare les ★ de Joueur 1 mieux que le nombre de décisions (ρ 0,72 contre 0,56).
- **Lassitude** : il s'est arrêté après 34 min de jeu actif (55 min au total), 8 grilles. Les 4 grilles à 12 créneaux lui ont pris 65 % de temps de plus que celles à 8. Il a quitté en ouvrant b n°19 (12 créneaux, pièce haute seule), juste après b n°5 (12 créneaux, pièce haute seule), « grille normale ». Pour un joueur occasionnel : **6 grilles**.

## 1. Joueur 2 contre Joueur 1

| Ordre | Grille | Note solveur | Mécaniques (décisions) | J1 ress. / temps | J2 ress. / temps | J2 err. / gommes | Commentaire de J2 (décodé) |
|---|---|---|---|---|---|---|---|
| 1 | c n°17 | Facile | 12 cr., 2 ex | 2 / 96 s | 2 / 298 s | 3 / 0, 1 RAZ | « galère le temps de comprendre les règles » |
| 2 | c n°9 | Expert | STEP + CO₂, sans voisin | — | **1** / 103 s | 0 / 0 | « bonne grille pour débuter » |
| 3 | b n°20 | Difficile | 12 cr., 1 ex + STEP | 2 / 231 s | **3** / **619 s** | 10 / 14 | « la pompe ajoute de la difficulté » |
| *pause* | | | | | | | 13 min |
| 4 | b n°1 | Moyen | 6 ex + CO₂, carnet libre | 2 / 141 s | 1 / 122 s | 6 / 4 | « nombre de cases infini, facile à caser » |
| 5 | b n°2 | Moyen | 12 cr., 3 ex, 18 barres | 1 / 88 s | 2 / 219 s | 2 / 10 | « ambiance Tetris, galéré à placer les nucléaires » |
| 6 | c n°10 | Expert | 3 ex + STEP + CO₂ | 3 / 317 s | **4** / 278 s | 4 / 11 | « il y avait tout, ça rend plus compliqué » |
| 7 | a n°15 | Moyen | 3 ex sur 3 voisins | 2 / 80 s | 3 / 197 s | 2 / 5 | « les trois pays différents, c'est bien » |
| 8 | b n°5 | Moyen | 12 cr., pièce haute | 1 / 47 s | 2 / 227 s | 2 / 6 | « grille normale » |
| 9 | b n°19 | Expert | 12 cr., pièce haute | 1 / 29 s | ouverte 8 s, abandon | — | arrêt de la session |

Non jouées : b n°19, a n°19, b n°18, c n°13.

**C1, C2.**
- Ni testables ni contredits. Aucune de ses 8 grilles n'a de mécanique morte, toutes ont au moins une décision, et la grille témoin C2 (c n°13) n'a pas été jouée.
- `notes.json` ne garde qu'un drapeau `kept` par grille, commun aux deux joueurs. Ses ★ ne sont donc pas isolables. Seul indice : b n°2, rejetée par Joueur 1, est maintenant gardée, donc Joueur 2 l'a gardée.
- Il ne trie pas : il dit « bien » de tout. C2 reste fondé sur Joueur 1 seul.

**Ressenti.**
- Plus haut sur 5 grilles, égal sur 1, plus bas sur 1 (b n°1, carnet libre). Moyenne 2,25 sur ses 8 grilles. Joueur 1 n'a jamais mis 4.
- Ce qui monte son ressenti : la STEP (b n°20 : 3 ; c n°10 : 4 ; G7 : « difficile ») et la taille (b n°2, 18 barres : 2 contre 1).
- Ce qui ne le monte pas : le CO₂ en carnet libre (b n°1 : 1) et une mécanique globale sans voisin (c n°9 : 1).
- Corrélation de son ressenti avec ses temps : ρ 0,64 ; avec les mécaniques globales : ρ −0,01 ; avec les décisions : ρ 0,10 (n = 8).

**Ce qui l'a lassé** :
- **La longueur d'abord** : 34 min actives pour 8 grilles. Les mêmes 7 grilles ont pris 17 min à Joueur 1. Son temps par grille ne baisse pas (1re moitié 19 min, 2e moitié 15 min) : il ne gagne pas en vitesse.
- **La répétition ensuite** : 7 grilles sur 8 se jouent pareil (empiler du nucléaire, placer des échanges : « ambiance Tetris »). Il quitte en 8 s sur b n°19, sœur de b n°5 qu'il vient de finir (12 créneaux, pièce haute seule).
- **Pas une mécanique** : la STEP l'a fait souffrir (b n°20, 10 min), mais il a repris après une pause de 13 min et a mis 4 à c n°10, avec « il y avait tout » dit comme un compliment.

## 2. G7, référence de beauté

G7 est le **tutoriel 7** « Pompage, relevé et programme » (`section: tutorial`). G6 est le tutoriel 6. Les grilles notées commencent à G8.

| Mesure | G7 | G6 | médiane `v3g*` (120) |
|---|---|---|---|
| Créneaux, cases de demande | 8, 25 (hauteur 1 à 5) | 6, 36 | 8, 37 |
| Pièces posées (barres + imports) | 7 + 2 = 9 | 7 | 11 |
| Sortes de centrales | **1** (N, longueurs 3-4, carnet exact) | 2 | 2 |
| Voisins | 1 (DE) : 2 exports, 2 imports | 1 : 2 exports | — |
| Mécanique globale | **STEP 1 paire, couplée aux échanges** | aucune | — |
| Décisions | **1 : la STEP**. Les exports sont publiés par flux, les imports trouvés au comptage final. | 2 ex + 1 prix | 3 |
| Indices | 6 : 2 prix N, 1 relevé, 2 flux, 1 programme | 2 prix | 3 |
| Compacité K (voir plus bas) | 0,33 | 0,43 | 0,40 |

**Trace** (`dispatch-solver deduce`, un chiffre par étape) :
- **Avec le programme** : `1111111112211222`, 16 étapes, Moyen. Les 9 premières, toutes de niveau 1, construisent la silhouette ; l'étape 9 (`silhouette`) trouve « pompage 9h → turbinage 12h ». Viennent ensuite 4 rubans, le programme (étape 12) et `column_sum`.
- **Sans le programme** (`check` : unique, résolue) : `111111111222232`, 15 étapes, **Difficile** en notation actuelle. Le programme est remplacé par `share_out` (répartition du carnet, niveau 3).
- **Rôle de l'indice** :
  - il intervient **après** la STEP, qu'il ne touche pas ;
  - il ne fait qu'épargner une répartition du carnet ;
  - en notation V3 (répartition au niveau 2), les deux versions sont notées Moyen : l'indice ne tient plus la note ;
  - c'est aussi la technique que le tutoriel **enseigne** (`teaches: program`).

**Pourquoi elle est élégante, en mesures.**
- Petite et homogène : 25 cases, une seule sorte de centrale.
- Une seule décision, globale et couplée à un voisin : la STEP change la silhouette ; les imports et le programme se déduisent ensuite.
- C'est la forme « une astuce qui débloque tout » de la session 1 : un seul pivot (étape 9), puis une cascade sans nouvelle idée. Aucune grille des lots n'avait cette forme parmi celles jouées par Joueur 1.

**Combien lui ressemblent** (lots `v3g1-*` et `v3g2-*`, 120 candidates) :

| Filtre | Grilles |
|---|---|
| A, strict : 8 cr., STEP trouvée, au moins un échange, ≤ 10 pièces, ≤ 32 cases, ≤ 2 sortes | **2** : `v3g1-jouer-a` n°1, `v3g2-jouer-c` n°10 |
| B : 8 cr., mécanique globale (STEP ou CO₂) couplée à un échange, ≤ 10 pièces, ≤ 32 cases | 4 : les 2 ci-dessus, plus `v3g2-jouer-b` n°14 et `v3g2-jouer-c` n°5 |
| C : globale couplée, ≤ 12 pièces | 22 (10 + 12) |
| Pour mémoire : globale **sans** échange (profil de c n°9) | 33 (9 + 24) |

Les lots `v3g2` ont beaucoup de mécaniques globales (38 sur 60), mais 24 d'entre elles sont sans échange : c'est le profil que Joueur 2 a trouvé facile.

**Mesure de compacité proposée.**
- Formule : **K = poids des décisions / pièces posées** (barres + imports). Poids : STEP et CO₂ 3, pièce haute et rampe 2, échange, stock et prix 1.
- Sur les 36 grilles notées par Joueur 1 :
  - corrélation : ρ 0,72 avec ★ et 0,57 avec le ressenti, contre 0,56 et 0,46 pour le nombre de décisions ; la taille seule ne dit rien (cases : ρ −0,15) ;
  - K < 0,2 : 4 ★ sur 20 ;
  - K ≥ 0,2 : 13 ★ sur 16.
- Dans `v3g*`, 48 grilles sur 120 ont K ≥ 0,5.
- Limite : K note G7 dans la moyenne (0,33), car sa STEP ne pèse que 3 et ses 2 imports comptent comme des pièces sans décision. Il faut donc lire K **avec** le filtre B (globale couplée, petite grille) : ce filtre décrit le profil de G7, K mesure la densité de décisions.

## 3. Grille 6 : « la demande de gaz qui apparaît »

- **G6 est le tutoriel 6** « La case la plus chère », qui enseigne `top_price`.
  - La demande est plate (6 partout) et le carnet exact pose 6 barres N de 24h : le nucléaire couvre toute la demande.
  - Le prix de 8h est « gaz ». Le gaz ne peut donc exister que si un export porte la colonne à 7.
  - La technique `top_price` (niveau 2, étape 6 sur 9) place la case de gaz et l'export de 8h ; la barre G de longueur 2 entraîne l'export de 12h.
  - Ce que Joueur 2 a aimé, c'est **un indice de prix qui fait naître une demande par un export**.
- **Rareté** : **absente des lots**.
  - Sur les 180 candidates `v3*-jouer-*`, une seule a une étape `top_price` (`v3g2-jouer-c` n°7), et elle ne fixe aucun échange.
  - 23 indices de prix nomment une centrale chère (C, G, T), et aucun ne tombe sur une colonne avec un export.
  - Cause probable : le générateur n'empêche rien (`clue_pool` accepte un prix sur une colonne d'export), mais l'élagage final retire les prix en dernier recours et ne cherche pas à les garder.

## 4. Décisions en attente : ce que change Joueur 2

| Décision | Recommandation de S3 | Avec Joueur 2 |
|---|---|---|
| G11 en Facile | oui | **inchangée**. Joueur 2 ne l'a pas jouée. Même avec son décalage de +0,6 cran, un ressenti 1 en 23 s chez Joueur 1 ne donne pas Expert. |
| Notation V3 (ruban 1, répartition 2, réfutation 3) | oui | **oui, avec un réglage** (ci-dessous) |
| « Difficile exige une mécanique globale » (R) | oui | **la préciser : globale couplée à un échange** (c n°9) |
| C5 : la pièce haute compte comme une décision, sauf si un indice la donne | oui | inchangée. b n°5 : ressenti 2, « grille normale » ; rien de contraire. |
| C6 : abandon des prix nucléaires | oui | inchangée. b n°1, carnet libre : « cases infinies, facile », c'est le défaut que C2 couvre. |
| C4 : barres mesurées, sans rejet | oui | **oui, et ne jamais en faire un rejet**. b n°2 (18 barres) : 2 et « ambiance Tetris », gardée. Le coût de la taille relève de la longueur de session (question 5), pas de la beauté. |

**Notation : chaque variante comparée aux deux joueurs.** Erreur moyenne, en crans ; biais positif = solveur au-dessus du ressenti.

| Variante | Joueur 1 (36) : exact / erreur / biais | Joueur 2 (8) : exact / erreur / biais | G7 | G10, tuto 9 |
|---|---|---|---|---|
| V0 actuelle | 12 / 0,94 / +0,89 | 4 / 0,75 / +0,25 | Moyen | Difficile |
| V3 | 22 / 0,47 / +0,25 | 0 / 1,12 / −0,38 | Moyen | Moyen |
| R = min(V3, 2 + globales) | 22 / 0,39 / +0,17 | 0 / 1,12 / −0,38 | Moyen | Moyen |
| **A = min(V3, 2) + globales couplées** | 19 / 0,47 / +0,31 | 2 / 0,88 / −0,12 | **Difficile** | Moyen |

- **Ce qu'on lit** : la notation sert un joueur de référence. V3 et R collent à Joueur 1 et sous-notent Joueur 2.
- **Variante A** :
  - principe : les techniques ne dépassent jamais Moyen, et chaque mécanique globale couplée à un échange ajoute un cran ;
  - elle partage l'écart entre les deux joueurs (biais +0,31 et −0,12) ;
  - elle met G7 en Difficile, comme les deux joueurs (« compliquée », « difficile »), et c n°10 en Expert (ressentis 3 et 4) ;
  - c n°9 reste Moyen (ressenti 1).
- **Effets publiés de A** : G7 (tutoriel) Moyen → Difficile ; G10 et tutoriel 9 Difficile → Moyen (comme R) ; les autres grilles ne bougent pas.
- **Effet sur les lots** : `v3g2` donne 20 F / 30 M / 5 D / 5 E, de quoi publier des Difficile et des Expert.
- **Réserve** : 8 parties pour Joueur 2. A repose sur 4 grilles à mécanique globale couplée, jouées par les deux.

**Indices de confort à la lumière de G7.**
- La décision en cours : l'humain penche pour les retirer partout, après un test à l'aveugle. Le lot `v3-confort` (G8 sans son flux de 6h) n'a pas encore été joué.
- G7 ne la remet pas en cause :
  - son « programme de 15h » est l'objet du tutoriel, pas un confort ;
  - il ne touche pas la décision principale (la STEP est trouvée avant lui) ;
  - en V3 et en A, il ne change plus la note.
- Le vrai critère est celui de S3 (proposition 6) : **un indice ne fixe jamais la décision principale**. G7 le respecte ; b n°19 (pièce haute donnée par un relevé) et G11 (exports « minimum ») ne le respectent pas.

## 5. Longueur de session

| | Joueur 1 | Joueur 2 |
|---|---|---|
| Temps médian par grille | 48 s | 227 s |
| Session | 42 parties, 53 min actives (avec pauses, en 3 h 20) | 8 parties, 34 min actives (55 min au total), puis arrêt |
| 12 créneaux contre 8 (médiane) | — | 263 s contre 160 s |

Recommandation pour un joueur occasionnel :
- **6 grilles** : environ 25 min au rythme de Joueur 2, sous son seuil de lassitude de 34 min.
- **Au plus 2 grilles à 12 créneaux**, jamais à la suite.
- **Une STEP couplée au plus**, pas avant la 3e grille.
- **Jamais deux grilles du même profil à la suite**, par exemple b n°5 puis b n°19.
- **Une 1re grille courte** : c n°17 lui a coûté 298 s rien que pour apprendre les règles.
- Le tirage actuel (`draw_session`, 16 par défaut) équilibre les notes, mais ni la taille ni les profils voisins. Pour une session « 2e joueur », mettre la taille à 6.

## Décisions à valider

1. **G11 en Facile** : oui ou non ? Recommandation : **oui** (inchangé).
2. **Notation A** (V3 plafonnée à Moyen, plus un cran par mécanique globale couplée à un échange) **plutôt que R** ? G7 passe Difficile ; G10 et le tutoriel 9 passent Moyen. Recommandation : **oui**, livrée avec le premier lot « dur ».
3. **Mécanique globale « couplée »** : ne compter la STEP et le CO₂ que si la solution a au moins un échange, dans la notation et dans les quotas du lot « dur » ? Recommandation : **oui** (c n°9 ressentie 1).
4. **C4** : mesurer les barres sans jamais rejeter ? Recommandation : **oui**.
5. **C5 et C6** : garder C5, abandonner C6 ? Recommandation : **oui aux deux** (inchangé).
6. **Programme de G7** : le garder (tutoriel qui l'enseigne), et réserver le retrait des indices de confort aux grilles notées, après le test `v3-confort` ? Recommandation : **oui**.
7. **Compacité K** : l'ajouter au bloc `lab` comme mesure, avec le filtre « globale couplée, ≤ 10 pièces, ≤ 32 cases », pour viser des grilles comme G7 ? Recommandation : **oui, en mesure seule**.
8. **Prix qui fait naître une demande (G6)** : réserver dans la sélection d'indices un prix sur une centrale chère qui tombe sur une colonne d'export, quand il existe ? Recommandation : **oui, en essai sur un lot**.
9. **Sessions des joueurs occasionnels à 6 grilles**, avec les règles d'ordre de la question 5 ? Recommandation : **oui**.
10. **`kept` par joueur dans `notes.json`**, pour isoler les ★ de chacun ? Recommandation : **oui** : aujourd'hui, les ★ de Joueur 2 sont illisibles.
