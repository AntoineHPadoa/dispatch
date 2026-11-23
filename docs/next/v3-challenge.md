# Challenge des postulats v3 (S8.5, nuit du 23 au 24 novembre)

Relecture sceptique de `v3-criteres.md`, `-s3`, `-j2`, `-g3` et `-m23`, avec les calculs refaits sur les données brutes.

**Sources**
- `lab/plays.jsonl` : 1re partie de chaque grille, hors fantômes. `lab/notes.json` : ressenti et ★ de Joueur 1. Blocs `lab` et `.stats.json` des 16 lots `v3*`.
- **69 grilles notées par Joueur 1**, en 4 sessions :
  - S2 : `v3-jouer-a` entier, 20 grilles ;
  - S3 : 17 grilles de `v3-jouer-b/c`, choisies par l'analyste ;
  - G3B : 6 grilles de `v3g3-jouer-b`, tirées par « Nouvelle session » ;
  - M23 : 26 grilles choisies par l'analyste, b n°1 rejouée exclue.
- Les lots `nuit-*` et `v3-confort` sont exclus.
- **Méthode** : tests de permutation (20 000 tirages), bootstrap (4 000 tirages), Fisher exact. Scripts dans le scratchpad, hors dépôt.

**Joueur 1 ne doit pas lire ce document avant d'avoir joué `matin-24`** : le §5 désigne les grilles de contrôle.

## Résumé

- **K, « meilleur prédicteur du ★ », ne tient pas hors échantillon.**
  - K a été construit sur S2 + S3 (ρ 0,72 puis 0,59).
  - Sur matin-23, la seule session jouée après sa définition, avec assez de grilles : ρ(K, ★) = 0,16 (p = 0,44). K ≥ 0,5 y donne 12 ★ sur 19, contre 3 sur 7 en dessous (p = 0,41).
  - Le « 21 ★ sur 28 » cumulé repose sur 9 ★ sur 9 obtenues avant que K existe.
  - À ressenti égal, K n'ajoute presque rien : le ★ suit surtout le ressenti (ρ 0,48) et le temps (ρ 0,32).
- **Ce qui survit** : (a) une globale couplée rend la grille plus dure, y compris hors échantillon (ressenti 2,08 contre 1,43 sur M23) ; (b) une grille sans décision est du remplissage (0 ★ sur 7) ; (c) une mécanique morte fait rejeter. Tout le reste (H1 à H4, trous contestés, seuils de K et de taille) est calé sur les données qui le « confirment ».
- **Signe d'accoutumance, pas de convergence.**
  - Avant M23, les grilles à STEP étaient 7 ★ sur 7, toutes ressenties 2 ou plus. Sur M23 : 8 ★ sur 14, et 8 ressenties 1 (« facile quand on sait utiliser la STEP »).
  - Les couplées passent de 8 ★ sur 8 à 5 sur 12 ; sur M23, ρ(couplée, ★) = −0,36.
  - Le taux de ★ ne monte pas avec les générateurs : 65 % en S3 (lots `v3` d'origine), 58 % en M23 (lots récents). Les prédictions de M23 ne battent pas un prédicteur trivial : 14 sur 27 justes pour le ressenti, autant que « toujours 1 » ; 15 sur 27 pour le ★, contre 16 pour « toujours ★ ».
- **Le minimum local est dans le squelette, pas dans les quotas.**
  - Les itérations ont réglé la couche « décisions ». Le squelette, lui, n'a pas bougé en 15 lots : **80 % de nucléaire par grille** (médiane de 0,67 à 0,89 selon le lot), parce que la pose de référence suit l'ordre de mérite. Or c'est la 1re plainte : 33 commentaires sur 69 contiennent « rempli… ».
  - En chemin, on a perdu le carnet exact (62 % des grilles en `v3` et `v3g1`, 28 % en `v3g4`), les 3 voisins (4 grilles, puis 0) et les 12 créneaux (16 sur 60, puis 9).
  - Le rejet `one_plant` élimine par construction le profil de G7 (une seule sorte de centrale), la grille de référence de beauté.
- **Pour matin-24** : 9 grilles de contrôle (4 témoins tirées au hasard dans `v3-jouer-b/c`, 3 contre-prédictions, 2 rejeux à l'aveugle), des prédictions chiffrées écrites avant, et un gel des règles du générateur tant que les témoins ne montrent pas d'écart.

## Affirmations et solidité

| Affirmation (source) | Solidité | Pourquoi | Test qui trancherait |
|---|---|---|---|
| C1 : une mécanique morte fait rejeter (s2, s3) | **forte** | 1 ★ sur 7 (p ≈ 0,05 seul), mais 5 commentaires explicites et un mécanisme évident : l'écran montre une centrale qu'on ne peut pas utiliser | Aucun : c'est une correction, pas un critère de goût |
| C2 : sans décision, c'est du remplissage (s2, s3) | **forte** sur les extrêmes | 0 ★ sur 7, et les commentaires le disent. Prédite en S2 et vérifiée en S3 : une vraie réplication | Plus testable : aucune grille sans décision n'est jouée depuis `v3g1`. Un ancrage par session suffit (§5). |
| C2 ≥ 2 décisions (s3) | moyenne | 19 ★ sur 24 contre 4 sur 19 avant M23. Sur M23 : 13 sur 23 contre 2 sur 3, intestable car le générateur filtre. La définition de « décision » a changé 3 fois. | Témoins non filtrées (§5) |
| K, densité de décisions, meilleur prédicteur du ★ (j2, m23) | **faible** | Poids (STEP 3, pièce haute 2…) fixés après coup sur 36 grilles. ρ 0,72 en S2, 0,16 sur M23 (p 0,44). À ressenti égal : 5 ★ sur 10 contre 11 sur 33 (ressenti 1, p 0,46). | Contre-prédictions à K bas et petite taille (§5) ; régression du ★ sur ressenti + K, à chaque session |
| Une globale couplée rend plus dur (s3, j2, g3) | **moyenne-forte** | ρ 0,56 (p < 10⁻⁴). Tient sur M23 (ressenti 2,08 contre 1,43). Joueur 2 va dans le même sens. Mais 3,2 erreurs par partie contre 1,0 : une partie de la difficulté vient peut-être de la manipulation (« lu importé pour exporté »). | Erreurs et gommes par type d'action, si le labo les enregistre ; tutoriel STEP joué juste avant une couplée |
| Une globale couplée rend belle (g3, « ★ si couplée ») | **infirmée** | 8 ★ sur 8 avant, 5 sur 12 sur M23 (ρ −0,36) | Déjà tranché : la retirer des cibles |
| Le remplissage fait rejeter (m23) | forte comme **description**, nulle comme **explication** | « Remplissage » est le mot du joueur pour « pas aimée » ; l'étiquette est codée à la main par l'analyste qui propose la mesure. Ce constat ne dit pas d'où vient le remplissage. | Varier le squelette (§3) et voir si le mot disparaît |
| La notation A range bien jusqu'à Difficile (m23) | moyenne | A a été choisie parmi 6 variantes, sur les grilles qu'elle explique. Hors échantillon (M23), ρ = 0,41 : Facile 5 sur 5 ressenties 1, Difficile 6 sur 6 ressenties 2 ou plus, Moyen 7 sur 10 ressenties 1, Expert 3 sur 5 ressenties 1. | Garder A ; ne plus la retoucher sans un lot témoin |
| H1 : un Moyen avec K < 0,5 se joue comme un Facile | **faible** | Seuil calé sur les 69 grilles qu'il « améliore » (ρ 0,53 → 0,63, in-sample). Explication concurrente : Joueur 1, concepteur, ressent 0,6 cran plus bas que Joueur 2. | Les 6 grilles H1 prévues, plus le même jeu par un 2e joueur |
| H2 : la taille fait le remplissage | faible à moyenne | Sur M23, d'où elle sort : ρ(cases, ★) = −0,37 (p 0,065). Avant M23 : −0,12 ; 3 ★ sur 8 à 40 cases ou plus, contre 20 sur 35 en dessous. Confondue avec la part de nucléaire (rampe n°20 : 45 cases, ★). | Grande grille à peu de nucléaire contre petite grille à beaucoup |
| H3 : un trou contesté rend belle | **faible** | 11 ★ sur 14 contre 27 sur 55 (p = 0,07). La définition a au moins 4 choix libres (largeur ≤ 2, une brique au moins, point fixe du niveau 1, « niveau ≥ 2 ou échange »). | Prédire avant de jouer, avec la définition gelée ; covariable « sortes de centrales posées » |
| H4 : Expert n'est pas plus dur que Difficile | **faible** | 7 Expert, dont 3 ressentis 1. Explication concurrente : l'accoutumance à la STEP (les 3 Expert ressentis 1 sont des STEP + CO₂ jouées sur M23). | Même grille couplée en début de session chez un joueur neuf |
| Joueur 2 classe comme Joueur 1 (j2) | faible | ρ 0,56 sur 7 grilles ; il dit « bien » des 8 | Un 3e joueur, avec le même tirage aléatoire |
| Joueur occasionnel : 6 grilles (j2) | faible | 1 joueur, 1 session | À observer, pas à figer |

## 1. Validité statistique

### Ce qui survit à une correction

On a regardé **au moins 75 mesures ou seuils** au fil des 5 documents : environ 25 en S2, 15 en S3, 12 en J2, 6 en G3, 20 en M23. Avec une correction de Bonferroni, le seuil devient p < 0,0007.

| Test (69 grilles) | Valeur | IC 95 % (bootstrap) | p (permutation) | Avec une correction ? | Sur M23 seule (26) |
|---|---|---|---|---|---|
| ρ(couplée, ressenti) | 0,56 | [0,33 ; 0,75] | < 0,0001 | **oui** | 0,28 (p 0,17), même sens |
| ρ(K, ressenti) | 0,55 | [0,37 ; 0,69] | < 0,0001 | **oui** | 0,32 (p 0,12) |
| ρ(ressenti, ★) | 0,48 | [0,29 ; 0,64] | < 0,001 | **oui** | 0,39 (p 0,06) |
| ρ(K, ★) | 0,44 | [0,23 ; 0,64] | 0,0003 | oui en cumul | **0,16 (p 0,44)** |
| ρ(note A, ressenti) | 0,53 | [0,31 ; 0,70] | < 0,001 | oui | 0,41 |
| ≥ 2 décisions → ★ | 32 sur 47 contre 6 sur 22 | | 0,002 (Fisher) | non | intestable (3 grilles sous le seuil) |
| ρ(nombre de décisions, ★) | 0,35 | [0,11 ; 0,56] | 0,006 | non | |
| ρ(temps, ★) | 0,32 | [0,08 ; 0,54] | 0,008 | non | |
| ρ(cases, ★) | −0,26 | [−0,48 ; −0,02] | 0,03 | non | −0,37 (p 0,065) |
| ρ(couplée, ★) | 0,10 | [−0,14 ; 0,32] | 0,42 | non | −0,36 |
| Trou contesté → ★ (H3) | 11 sur 14 contre 27 sur 55 | | 0,07 | non | |

- Le contrôle par session (permutation à l'intérieur de chaque session) donne les mêmes p : l'effet de K n'est pas qu'un effet de lot.
- **Régression logistique** du ★ sur ressenti ≥ 2, K et cases :
  - le ressenti domine (coefficient 2,2, IC [0,8 ; 5,3]) ;
  - K n'est positif que dans 87 % des tirages bootstrap, ce qui n'est pas significatif ;
  - les cases sont négatives dans 96 % des tirages.
- **En clair** : le joueur garde surtout les grilles qui lui ont résisté. K mesure en partie la difficulté, puisqu'il pèse STEP et CO₂ à 3.

### Variables confondues

- **Le lot et le temps** : K moyen par session 0,19 → 0,25 → 0,60 → 0,67 (ρ(date, K) = 0,63), et le ressenti monte avec (ρ(date, ressenti) = 0,31). Chaque comparaison « K haut contre K bas » oppose donc aussi « récent contre ancien ».
- **La fatigue et l'ordre dans la session** : aucun effet visible. ρ(position, ressenti) = 0,21, ρ(position, ★) = −0,11. Le ★ des moitiés : S2 5 puis 3, S3 6 puis 5, M23 8 puis 7. En revanche, M23 s'étale sur 11 h en 4 blocs, dont 13 grilles entre 22h44 et 23h36. Le jugement n'est pas homogène dans le temps, même si le taux de ★ ne bouge pas (7 sur 13 le soir, 8 sur 13 avant).
- **L'apprentissage** : voir §2 (STEP).
- **La sélection par l'analyste** : 43 des 69 grilles ont été choisies pour tester ses hypothèses (S3, M23). Seules S2 (lot entier) et G3B (tirage du labo) sont des échantillons non choisis.
  - S3 est un plan à groupes extrêmes (prédites belles contre prédites rejet) : cela gonfle mécaniquement les effets.
  - Les prédictions de S3 battaient la référence (11 sur 13 contre 8 pour « toujours ★ »). Celles de M23 non.
- **Données à corriger** :
  - `notes.json` donne `kept: Joueur 1 = true` à `v3-jouer-b` n°2, que Joueur 1 avait rejetée (`v3-criteres-s3.md`). La reprise des ★ par joueur (S4.17) a copié le drapeau commun. 1 grille, sans effet sur les conclusions, mais à corriger.
  - Les 3 parties aidées de M23 (abandon puis aide) sont comptées comme les autres, ici comme dans `v3-criteres-m23.md`. Les retirer ne change aucune conclusion (`-m23` : ρ 0,53 → 0,51).

## 2. Circularité

**La boucle** :
1. Le solveur de déduction mesure des « décisions » ;
2. l'analyste choisit des poids et des seuils qui collent au ★ ;
3. le générateur reçoit des quotas sur ces types ;
4. les lots montent sur la mesure (K médian 0,14-0,27 en `v3`, 0,38-0,50 en `v3g4`) ;
5. on fait jouer des grilles choisies sur la même mesure.

Il manque un point de contrôle : **le ★ ne monte pas** (S3 65 %, G3B 67 %, M23 58 %). On optimise bien la mesure. Rien ne montre qu'on optimise le plaisir.

**Restriction de plage.** Une fois une mesure filtrée, on ne peut plus la tester :
- aucune grille sans décision depuis `v3g1` ;
- 3 grilles sur 26 sous 2 décisions en M23 ;
- 19 sur 26 à K ≥ 0,5.

L'effondrement de K sur M23 est en partie cela. Mais c'est justement le régime où le générateur travaille désormais : un K qui ne départage plus rien au-dessus de 0,5 ne guide plus rien.

**Le joueur apprend-il les motifs ?** Oui, pour la STEP, et c'est le signal le plus net :

| | Grilles à STEP | ★ | Ressenti 1 | Couplées : ★ | Couplées : ressenti moyen |
|---|---|---|---|---|---|
| Avant M23 (S2, S3, G3B) | 7 | 7 | 0 | 8 sur 8 | 2,50 |
| M23 | 14 | 8 | 8 | 5 sur 12 | 2,08 |

- Commentaires de M23 : « facile quand on sait utiliser la STEP », « pour apprendre la STEP », et sur la répétition, « le carré de gaz revient tout le temps ». La nouveauté s'use.
- La rampe, nouvelle en M23, reçoit les commentaires de nouveauté (« apporte de la diversité », « rigolo ») : il faut s'attendre à la même usure.

**Le joueur connaît les hypothèses.** Joueur 1 est le concepteur, et il lit les résumés des analyses (le plan les lui résume, par exemple « ce que tu aimes, c'est trouver où vont les échanges »).
- Le vocabulaire de l'analyste entre dans ses commentaires : « compact » 0 fois sur 37 avant `v3-criteres-j2.md` (qui introduit la compacité), 4 fois sur 32 après ; « STEP » 0 puis 7.
- Le commentaire libre et le ★ ne sont donc plus des mesures indépendantes des hypothèses.

**Les prédictions de M23 étaient-elles biaisées vers l'analyste ?** Pas dans le choix des grilles (les contre-exemples y étaient), mais dans la lecture :
- 5 des 6 questions du bloc replié reçoivent une prédiction fausse (4) ou à moitié juste (1) ;
- le verdict reste « converge pour la beauté », alors que le prédicteur de beauté (K) vient d'échouer sur cette session ;
- H1 à H4 sont des hypothèses nées de M23 et cadrées pour être testées sur des grilles du même générateur.

## 3. Minimums locaux

### Diversité des lots `jouer`, `v3` → `v3g4`

| Génération (grilles) | Carnet exact | ≥ 2 voisins (3 voisins) | Sans voisin | 12 cr. | STEP | Plafond CO₂ | Couplées | Sans décision | K médian | Nucléaire / cases (médiane) | Jaccard moyen des paires | Tirages / grille |
|---|---|---|---|---|---|---|---|---|---|---|---|---|
| `v3` (60) | **62 %** | 12 (4) | 16 | 16 | 12 | 11 | 6 | 11 | 0,14-0,27 | 0,80-0,84 | 0,29-0,34 | 8,5-11 |
| `v3g1` (60) | 62 % | 5 (0) | 17 | 10 | 18 | 7 | 13 | 0 | 0,25-0,33 | 0,67-0,89 | 0,29-0,33 | 3,5-20 |
| `v3g2` (60) | 33 % | 6 (2) | 31 | 6 | 33 | 18 | 14 | 0 | 0,33-0,67 | 0,81-0,85 | 0,30-0,34 | 5,6-16 |
| `v3g3` (40) | 33 % | 2 (0) | 20 | 6 | 21 | 12 | 11 | 0 | 0,43-0,54 | 0,79-0,83 | 0,33-0,34 | 3,5-4,4 |
| `v3g4` (60) | **28 %** | 5 (0) | 23 | 9 | 24 | 20 | 18 | 0 | 0,38-0,50 | 0,79-0,87 | 0,31-0,35 | 3,6-8,6 |

- **Diversité de surface : stable.** 7 familles partout (c'est un quota) ; 19 à 20 signatures distinctes sur 20 ; Jaccard des paires autour de 0,33 (traits : famille, taille, carnet, voisins, pièces, types de décision, types d'indices).
- **Part des rejets** : elle **n'explose pas**, elle baisse (8 à 11 tirages par grille en `v3`, 3,6 à 8,6 en `v3g4`). En `v3g4`, les rejets par quota pèsent 7 à 55 tirages par lot (contre 67 à 100 en `v3`). Le rétrécissement ne vient pas des filtres : il vient des **entrées du mélange**, réécrites à chaque version. Exemples, de `v3-jouer-a` à `v3g4-jouer-a` :
  - l'entrée « 3 voisins » a disparu ;
  - l'entrée « surplus, 12 créneaux » aussi ;
  - 6 entrées sur 12 sont passées en carnet libre ;
  - 7 entrées sur 12 portent STEP ou CO₂, contre 2 sur 9.
- **Ce qui converge vraiment** : la part de STEP et de CO₂ monte (12 → 24 et 11 → 20 sur 60), le carnet exact et les journées longues reculent. C'est le motif « STEP / CO₂ couplée, carnet libre, 8 créneaux », celui auquel le joueur s'habitue déjà (§2).

### Ce qu'on ne voit plus

| Mécanique ou type | Où elle était | État | Ce qu'en disait le joueur |
|---|---|---|---|
| **Squelette à peu de nucléaire** | inchangé, toujours rare (0 à 5 grilles sous 50 % de nucléaire par lot de 20) | jamais une cible | 33 commentaires « rempli… » sur 69 ; 4 rampes sur 8 « trop de nucléaire à côté » |
| **Une seule sorte de centrale** (profil de G7) | rejetée par `one_plant` : 152 tirages sur 613 en `v3`, 51 sur 333 en `v3g4` | **impossible par construction** | G7, référence de beauté des deux joueurs |
| **Carnet exact à longueurs concurrentes** | 62 % → 28 % | en recul | b n°20 (★, ressentie 2 et 3), G7 |
| **3 voisins** | 4 grilles en `v3`, 0 en `v3g1`, `v3g3` et `v3g4` | abandonné | a n°15 : ★ ; Joueur 2 : « les trois pays différents, c'est bien » |
| **12 créneaux** | 16 sur 60 → plafonné à 5 par lot | bridé (lassitude de Joueur 2) | b n°20 et v3g3-b n°6 : les deux ressentis 4 des débuts |
| **Prix qui fait naître une demande** (G6) | 0 à 1 étape `top_price` par lot | D7 abandonnée | aimé de Joueur 2 sur G6 |
| **Rampe relais** | 0 étape `ramp_relay` dans les 40 grilles à rampe | jamais requise | « l'enchaînement des 1-2-1 », rampe n°20, ★ |
| **Grille calme sans décision** | 11 sur 60 en `v3` → 0 | interdite | légitime en tutoriel ou en première grille, pas plus |
| **Escalier du charbon** | refusé | hors jeu | jamais joué |

**Le vrai minimum local.** La pose de référence minimise la somme des rangs (`generate/reference.py`) : le nucléaire, rang 1, remplit tout ce qu'il peut. Ce n'est pas une règle du jeu : `GAME-DESIGN.md` réserve le rang aux indices de prix (§ « rang de prix », l. 55). Le choix est fait au §10 (l. 174) pour la plausibilité. Cinq versions du générateur ont ajouté des décisions *au-dessus* d'un bloc de nucléaire constant ; H2 (taille) et le mot « remplissage » en sont les symptômes. C'est un réglage qu'on peut **desserrer**, sans nouvelle règle (§6).

## 4. Hypothèses concurrentes

| Critère | Explication concurrente plausible | Test qui les départage |
|---|---|---|
| K → ★ | Le ★ récompense la résistance : « elle m'a fait réfléchir ». K n'en est qu'un indicateur, puisqu'il pèse lourd STEP et CO₂. | Grilles à K bas mais dures, par concurrence de longueurs ou nombre de solutions partielles : si elles ont leur ★, c'est la résistance qui compte |
| Couplée → dure | La difficulté vient en partie de l'interface (pompage, sens des échanges : 3,2 erreurs contre 1,0) et de la nouveauté. | Erreurs par type d'action ; couplée jouée par un joueur qui sort du tutoriel STEP ; suivi du ressenti des couplées session après session (accoutumance) |
| Sans décision → remplissage | Plutôt : nucléaire massif → remplissage. Mais l'explication ne couvre pas tout : 6 des 7 grilles sans décision ont 60 à 91 % de nucléaire, et a n°18 (45 %) est quand même « remplissage sans réflexion ». | Une grille à faible K, à moins de 40 % de nucléaire et à carnet exact concurrent (§5, contre-prédictions 1 et 2) |
| Notation A | A colle à Joueur 1 parce qu'elle a été choisie sur lui ; Joueur 2 ressent +0,6 cran. | Les mêmes 10 grilles, tirées au hasard, jouées par 2 joueurs neufs |
| H1 : Moyen à K < 0,5 = Facile | Joueur 1 joue au-dessus du public ; pour un joueur moyen, ces Moyens sont des Moyens. | Les 6 grilles H1, jouées aussi par Joueur 2 ou un 3e joueur |
| H2 : taille = remplissage | C'est la part de nucléaire, pas la taille : la rampe n°20 (45 cases, peu de N) a sa ★. | Grande grille à moins de 50 % de nucléaire contre petite grille à plus de 90 % |
| H3 : trou contesté = belle | Les trous contestés vont avec plus de sortes de centrales posées (gaz, TAC, import) : c'est la variété, pas le trou. | Définition gelée avant la session, et comparaison à « sortes posées » égales |
| H4 : Expert ≈ Difficile | Accoutumance : les 3 Expert ressentis 1 sont des STEP + CO₂ jouées après une vingtaine de STEP ; b n°12 et n°13 sont aussi de grandes grilles nucléaires. | Ordre : une Expert couplée en 3e position, une autre en fin de session ; et un joueur neuf |
| Le ★ monte avec les nouveaux lots | Il ne monte pas : 65 % puis 58 %. Le plafond vient peut-être du squelette, ou de l'usure. | Témoins aléatoires de `v3-jouer` mêlées à l'aveugle (§5) |

## 5. Contrôles pour `matin-24`

<details>
<summary>Liste des grilles de contrôle (Joueur 1 : ne pas ouvrir avant d'avoir joué)</summary>

Toutes jamais jouées par aucun joueur, sauf les 2 rejeux. Ordre mêlé aux grilles H1-H4, non signalé dans la fiche, et ces 9 grilles dispersées (pas deux à la suite).

**Témoins (4), tirées au hasard** (`random.seed(24)`) parmi les 15 grilles non jouées de `v3-jouer-b/c` sans mécanique morte. Elles mesurent ce que vaut l'ancien générateur, sans filtre de décisions, dans les mêmes conditions.

| Grille | Note | K | Décisions | Cases, nucléaire | Note |
|---|---|---|---|---|---|
| `v3-jouer-c` n°14 (index 13) | Facile | 0,17 | 3 échanges | 69, 99 % | longue : ne pas la placer après une autre de 12 créneaux |
| `v3-jouer-c` n°3 (index 2) | Facile | 0,06 | 1 échange | 31, 71 % | |
| `v3-jouer-c` n°8 (index 7) | Moyen | 0,27 | 3 échanges | 27, 78 % | |
| `v3-jouer-b` n°12 (index 11) | Facile | 0,08 | 1 échange | 35, 89 % | 12 créneaux, carnet exact |

**Contre-prédictions (3)** : les règles actuelles (K bas, aucune couplée, Facile ou Moyen) prédisent « ressenti 1, pas ★ ». Elles ont toutes un trait que les règles ignorent.

| Grille | Note | K | Trait ignoré | Règles | Mon pari |
|---|---|---|---|---|---|
| `v3-jouer-b` n°4 (index 3) | Facile | 0,17 | **24 % de nucléaire**, carnet exact, 6 créneaux, `surplus_midi` | 1, pas ★ | ★ possible (40 %) |
| `v3g3-jouer-b` n°7 (index 6) | Moyen | 0,21 | **23 % de nucléaire**, 5 sortes posées (C, G, I, N, T), carnet exact | 1, pas ★ | ★ (55 %) |
| `v3g2-jouer-c` n°18 (index 17) | Moyen | 0,44 | **3 voisins**, 4 échanges, carnet exact | 1, ★ incertain | ★ (60 %) |

**Rejeux à l'aveugle (2)**, pour mesurer la stabilité du jugement deux jours après :
- `v3-jouer-a` n°15 (index 14) : ★, ressentie 2 en S2, 3 voisins ;
- `v3-jouer-a` n°17 (index 16) : sans ★, ressentie 2, 53 cases.

Si l'une change de verdict, l'étalon du joueur a bougé, et les comparaisons entre sessions sont à relire.

**Ancrage facultatif (1)** : `v3-jouer-b` n°17 (index 16), sans décision, 87 % de nucléaire. Attendu : ressenti 1, pas ★. Si elle a sa ★, c'est que le jugement a dérivé.

**Combien.** 9 contrôles (10 avec l'ancrage), soit une session d'environ 25 grilles avec 16 grilles H1-H4 au lieu de 20. Je propose de ramener H1 de 6 à 4, car ses Moyens à K bas jouent déjà en partie le rôle de contre-prédictions.

**Ce que ça ne permet pas.** Avec 4 témoins, on ne détecte qu'un écart grossier :
- 0 ou 1 ★ sur 4 chez les témoins, contre 60 % chez les nouvelles : signe que les filtres servent ;
- 3 ou 4 ★ sur 4 : signe qu'ils ne servent pas.

La comparaison doit s'accumuler : **25 % de témoins dans chaque session**, jusqu'à 20 témoins au moins.

**Lot témoin neuf (description, à ne pas générer cette nuit)** : `v3g5-temoin`, 20 grilles.
- Le mélange et les quotas de `lab/lots/v3-jouer-a.json` tels quels, graine 2424.
- Le générateur actuel avec le seul nettoyage C1 : pas de `min_with_type`, `max_with_type`, `max_same_single_decision`, `max_per_mix` ni `max_with_cols`.
- Le rejet `no_decision` est désactivé s'il est réglable ; sinon, le noter.
- On sépare ainsi « nouveau code » et « nouveaux quotas ».

**Protocole.**
1. Avant la session, écrire pour chaque grille une probabilité de ★ et un ressenti attendu, dans le bloc replié de la fiche.
2. Après la session, calculer le score de Brier, comparé à celui de « taux de ★ de la session précédente ».
3. Une hypothèse n'est retenue que si elle bat cette référence.

</details>

## 6. Recommandations

Aucune n'ajoute de règle au générateur.

1. **Arrêter** d'ajouter une mesure ou un quota à chaque session. Geler `v3g4` + C1 pendant 2 sessions et ne mesurer que H1 à H4 sur ce qui existe. Chaque couche ajoutée depuis `v3g1` a été validée sur les données qui l'avaient suggérée.
2. **Arrêter** de traiter K comme une cible. C'est une description utile pour trier un lot, mais elle ne prédit plus le ★ là où le générateur travaille (K ≥ 0,5). Retirer aussi « ★ si couplée » des objectifs : c'est infirmé.
3. **Changer** la manière de tester :
   - une hypothèse née d'une session ne se juge qu'à la suivante ;
   - les prédictions sont chiffrées avant (probabilités) et comparées à une référence triviale ;
   - la moitié au moins des grilles est tirée au hasard dans un lot, et non choisie.
4. **Continuer**, mais avec un témoin : 25 % de grilles de l'ancien générateur ou d'un lot sans quota dans chaque session, mêlées à l'aveugle. C'est la seule façon de savoir si le générateur progresse.
5. **Desserrer le squelette plutôt que serrer les décisions**, sur un lot d'essai `v3g5-squelette` :
   - pose de référence moins strictement au mérite (plafond sur le nucléaire, ou rang tiré au hasard sur une partie des cases) ;
   - rejet `one_plant` levé, pour rendre possibles des grilles à une seule sorte de centrale comme G7.

   Ce sont deux contraintes retirées, pas une règle ajoutée. Elles visent la 1re plainte (« trop de nucléaire »).
6. **Rouvrir les mécaniques perdues en petite dose**, en gardant inchangées 3 ou 4 entrées de `v3-jouer-a` dans chaque lot : 3 voisins, carnet exact, surplus à 12 créneaux, liste de prix. Ce n'est pas un quota de plus : c'est un bout de lot qu'on ne réécrit pas.
7. **Élargir les joueurs et protéger leur aveugle.**
   - Au moins 2 joueurs de plus, sur un même tirage aléatoire de 8 à 10 grilles.
   - Joueur 1 ne lit plus les résumés d'analyse avant de jouer : son vocabulaire suit déjà celui des documents.
   - Corriger `kept` de `v3-jouer-b` n°2.
8. **Surveiller l'usure** : suivre le ressenti et le ★ des couplées et des rampes session après session. Si la STEP s'use, le générateur ne doit pas converger dessus. La diversité entre sessions compte autant que la diversité dans un lot.
