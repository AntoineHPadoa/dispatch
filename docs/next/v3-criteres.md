# Critères d'une belle grille — session 2 (`v3-jouer-a`, 22 novembre 2026)

Source : 20 parties à l'aveugle de Joueur 1 (session `v3-jouer-a-1`), `lab/plays.jsonl` (`attempt == 1`, hors fantômes), `lab/notes.json`, blocs `lab` et traces complètes (`dispatch-solver deduce --index N`). Les numéros `n°` sont ceux du labo (index + 1).

## Résumé

- **Le solveur surnote** : 20 grilles sur 20 ressenties Facile ou Moyen (ressenti 1 ou 2), dont les 3 Expert (ressenti 1). La note solveur explique peu le ressenti (ρ de Spearman 0,28) ; le nombre de **décisions de silhouette** (exports, imports, pompages à trouver) l'explique mieux (ρ 0,60).
- **Ce qui fait une ★** : trouver où vont les échanges ou la STEP. Les 8 ★ ont toutes au moins 1 décision, et 6 sur 8 en ont au moins 2 (contre 2 rejetées sur 12, p ≈ 0,015). Les 5 Faciles du solveur n'en ont aucune : 0 ★, et 5 commentaires « remplissage ».
- **Ce qui fait rejeter à coup sûr** : une mécanique déclarée qui ne sert à rien (voisin sans aucun échange, plafond CO₂ jamais contraignant). 4 grilles sur 4 rejetées, dont 3 commentées explicitement.
- **L'intuition « astuce centrale »** n'est testable qu'à moitié. La forme de la trace ne sépare rien (la règle de la session 1 ne trouve aucune astuce sur 20 grilles), car le solveur ne déduit pas dans l'ordre du joueur. En revanche, « plusieurs mécaniques réellement utilisées » tient : 4 ★ sur 5 grilles à 2 mécaniques vivantes, contre 4 sur 15. 20 parties d'un seul joueur ne suffisent pas pour trancher.
- **Indices de confort** : aucune candidate générée n'en a, l'élagage final au niveau 4 les retire. La seule grille publiée qui en a un et qui a été jouée (G8) a été ressentie 1, « prendre en main » : il joue son rôle en Facile. Règle proposée : un indice de confort est permis en tutoriel et en Facile, jamais ailleurs.

## Données

Ressenti : 1 Facile … 4 Expert. Temps actif de la 1re partie. « Décisions » : exports, imports et pompages non nuls que la déduction trouve sans qu'un flux les donne. « Morte » : mécanique déclarée sans effet (voisin sans échange dans la référence, plafond CO₂ sans étape `carbon`). Trace : un chiffre par étape, son niveau. Catégorie : règle de `v3-session-1.md` (astuce, étalée, non classée, sans objet).

| n° | Note | Ress. | Temps | Err./gomme | ★ | Mécaniques (carnet) | Ind. | Déc. | Morte | Trace | Catégorie | Commentaire abrégé |
|---|---|---|---|---|---|---|---|---|---|---|---|---|
| 1 | Facile | 1 | 39 s | 0/0 | | 1 voisin (exact) | 0 | 0 | | `11111` | sans objet | « juste du remplissage » |
| 2 | Difficile | 2 | 213 s | 0/3 | ★ | 1 voisin, STEP (exact) | 1 | 1 | | `111211113311` | étalée | « l'astuce est la pompe : trouver où turbiner, satisfaisant » |
| 3 | Moyen | 1 | 62 s | 2/0 | | 1 voisin (libre) | 7 | 1 | | `11111111222222` | non classée | « sans intérêt, remplissage » |
| 4 | Facile | 1 | 55 s | 1/0 | | 1 voisin (exact) | 1 | 0 | | `111111` | sans objet | « remplir en commençant par le nucléaire ; tuto, pas belle » |
| 5 | Moyen | 1 | 44 s | 1/0 | ★ | 1 voisin, 6 créneaux (exact) | 0 | 2 | | `211111222` | étalée | « les mécaniques forcent à mettre les cases au bon endroit » |
| 6 | Expert | 1 | 104 s | 1/4 | ★ | 1 voisin, pièce haute (exact) | 2 | 2 | | `111122111412` | étalée | « bonne facile ; encore eu par le charbon sur 2 lignes » |
| 7 | Facile | 1 | 33 s | 0/0 | | 3 voisins (exact) | 0 | 0 | 3 voisins | `11111` | sans objet | « nul, échanges inutiles, rien n'est possible » |
| 8 | Moyen | 1 | 47 s | 1/1 | | stock (libre) | 3 | 0 | | `1111222222` | non classée | « du remplissage » |
| 9 | Expert | 1 (2 au 5e essai) | 34 s, abandon ; 320 s en 5 essais | 1/1 | ★ | 1 voisin, surplus, pièce haute (exact) | 2 | 3 | | `133331111412` | étalée | « pas compris que le charbon monte sur 2 lignes ; ensuite pas mal » |
| 10 | Moyen | 1 | 163 s | 2/8 | ★ | 1 voisin (libre) | 5 | 1 | | `11111111111112112` | non classée | « belle facile, mêle plusieurs mécaniques ; export IT pas vu » |
| 11 | Difficile | 2 | 57 s | 1/0 | ★ | 1 voisin, pièce haute (exact) | 2 | 2 | | `11111122223111111` | non classée | « entre facile et moyen ; grille plus grande » |
| 12 | Difficile | 1 | 98 s | 1/1 | | 2 voisins, CO₂, 12 cr. (exact) | 1 | 1 | DE, CO₂ | `111131111222211111` | étalée | « remplir les trous ; Allemagne inutile » |
| 13 | Facile | 1 | 29 s | 1/0 | | aucune (exact) | 0 | 0 | | `11` | sans objet | « uniquement du remplissage » |
| 14 | Moyen | 1 | 41 s | 0/0 | | 1 voisin, surplus, 12 cr. (libre) | 9 | 1 | | `111111112221122` | étalée | « belle facile grâce aux exports, sinon remplissage » |
| 15 | Moyen | 2 | 80 s | 1/0 | ★ | 3 voisins, surplus (exact) | 1 | 3 | | `111111111111212` | non classée | « l'empilement des exports fait réfléchir » |
| 16 | Moyen | 1 | 48 s | 1/0 | | 2 voisins, CO₂, 12 cr. (exact) | 1 | 2 | BE, CO₂ | `1111111111122211` | non classée | « remplissage ; CO₂ sans intérêt avec carnet imposé ; la météo impose la forme » |
| 17 | Moyen | 2 | 107 s | 2/2 | | 2 voisins, CO₂, 12 cr. (exact) | 3 | 2 | CO₂ | `1111111111122222211` | non classée | « moyenne par le nombre de centrales ; vite ennuyeux » |
| 18 | Facile | 1 | 47 s | 0/0 | | aucune (libre) | 5 | 0 | | `111111` | sans objet | « très facile, remplissage sans réflexion » |
| 19 | Moyen | 2 | 210 s | 2/7 | ★ | 1 voisin, STEP (exact) | 3 | 3 | | `111111122221111111` | non classée | « belle : 3 cases de nucléaire viennent du pompage + export » |
| 20 | Expert | 1 | 31 s | 0/0 | | 1 voisin, pièce haute (exact) | 1 | 1 | | `1111111133114112` | étalée | « bonne facile, satisfaisante, sans difficulté » |

### Calibrage (question 1)

| Note solveur | Grilles | Ressenti | Temps médian | ★ |
|---|---|---|---|---|
| Facile | 5 | 1, 1, 1, 1, 1 | 39 s | 0 |
| Moyen | 9 | six 1, trois 2 | 62 s | 4 |
| Difficile | 3 | 2, 2, 1 | 98 s | 2 |
| Expert | 3 | 1, 1, 1 | 67 s | 2 |

- **Corrélations** (ρ de Spearman, 19 parties, n° 9 exclue car abandonnée) :
  - avec le ressenti : décisions 0,60 ; étapes 0,48 ; note 0,28 ; indices 0,10 ; créneaux 0,04 ;
  - avec le temps : coups 0,80 ; gommes 0,78 ; étapes 0,62 ; décisions 0,55 ; note 0,44.
- **Facile est juste** : 5 sur 5 ressenties 1. Au-dessus, l'échelle est décalée d'au moins un cran.
- **Où le solveur se trompe** :
  - **Rubans** (`ribbon`, niveau 2) : 6 Moyennes ne doivent leur note qu'à cette technique (n° 3, 8, 14, 16, 17, 19). Ressenti 1, 1, 1, 1, 2, 2, et les deux « 2 » ont 2 ou 3 décisions. Le solveur raisonne sur les lignes du dessin (la trace « exclut N 3 row 5… ») ; le joueur, lui, compte des cases par colonne.
  - **Hypothèse réfutée** (n° 6, 9, 20, toutes Expert) : ressenti 1. Sur n° 6 et 9, la « réfutation » est 7 à 12 hypothèses, une par ligne, pour une seule idée du joueur : « le charbon 3 ne va pas à 0h-9h ». Sur n° 20, ce sont 2 lignes pour un seul choix entre 2 emplacements.
  - **Répartition du carnet** (`share_out`, niveau 3 ; n° 2, 9, 11, 12, 20) : ressenti 2, 1, 2, 1, 1.
  - **Décisions sous-notées** : ce que le joueur appelle « l'astuce » est trouvé par des étapes de niveau 1 : `silhouette` pour le pompage de n° 19, `exhausted` pour les exports. Le solveur ne voit pas l'effort qu'elles demandent.
- **Erreurs** : 0 à 2 par partie, sans signal (ρ 0,25 avec le ressenti). **Annulations** : 0 sur 20 parties ; le joueur gomme à la place (39 gommes). **Abandons** : seule n° 9, 4 fois, par règle mal comprise (pièce haute), pas par difficulté. **Remises à zéro** : n° 2 et 19, les deux plus longues.

### Gardées et rejetées (question 2)

| Mesure | ★ (8) | Rejetées (12) | Lecture |
|---|---|---|---|
| Décisions ≥ 1 | 8 | 6 | nécessaire |
| Décisions ≥ 2 | 6 | 2 | meilleur séparateur (p ≈ 0,015, Fisher unilatéral) |
| Mécanique morte | 0 | 4 | éliminatoire |
| Mécaniques vivantes ≥ 2 | 4 | 1 | voir question 3 |
| Pièce haute | 3 sur 4 | 1 sur 4 | confondue avec les décisions et la règle mal comprise |
| Inventaire libre | 1 sur 5 | 4 sur 5 | prix « nucléaire » = colonne pleine de N, à remplir |
| Barres posées (médiane) | 8,5 | 11 | ρ = −0,57 avec ★ ; commentaire n° 17 |
| Temps actif (médiane) | 104 s | 47 s | conséquence, pas critère |
| Gommes ≥ 2 | 5 | 1 | idem |
| Indices (médiane) | 2 | 1 | pas d'effet |
| Créneaux, famille | — | — | pas d'effet visible (7 familles, 2-3 grilles chacune) |

- **Beauté ≠ difficulté** : 4 ★ sur 8 ont un ressenti 1 (n° 5, 6, 9, 10). Une Facile peut être belle si elle demande des décisions.
- 12 tests regardés sur 20 parties : seuls les critères appuyés aussi par les commentaires sont « confirmés » ci-dessous.

### Astuce centrale (question 3)

- **Mesure de la session 1** (pic dur court puis cascade de niveau 1) : **0 astuce sur 20**, 7 étalées, 8 non classées, 5 sans objet. Elle ne sépare rien.
- **Pourquoi** : le solveur ne déduit pas dans l'ordre du joueur. Sur n° 2, le joueur dit « l'astuce à trouver est la pompe » ; le solveur ne la trouve qu'à l'étape 10 sur 12, après avoir épinglé les barres. Les difficultés du solveur portent sur le dessin (rubans, lignes), pas sur les décisions du joueur.
- **Mesure v2 essayée, le pivot de mécanique** : la 1re étape qui trouve une décision, suivie d'au moins 3 étapes. 4 ★ sur 7 contre 4 sur 13 : écart non significatif.
- **Mesure qui tient, les mécaniques vivantes** : nombre de mécaniques distinctes qui changent la solution et que la déduction doit trouver (échanges, STEP, pièce haute, CO₂ utilisé). Avec au moins 2 : 4 ★ sur 5 (n° 6, 9, 11, 19 ; n° 20 rejetée), contre 4 ★ sur 15 en dessous (p ≈ 0,06).
- **Verdict** : la moitié « plusieurs mécaniques » de l'intuition est soutenue ; la moitié « une astuce qui débloque tout » n'est pas mesurable sur la trace actuelle. Il faudrait une trace dans l'ordre du joueur (décisions d'abord). Avec 20 parties d'un seul joueur, rien n'est tranché : il faut une 2e session et un 2e joueur.

### Commentaires classés (question 4)

| Classe | n° | Ce qui revient |
|---|---|---|
| Beauté + | 2, 5, 6, 9, 10, 11, 14 (mitigé), 15, 19, 20 | placer les échanges ou la STEP « au bon endroit », mélange de mécaniques |
| Beauté − | 1, 3, 4, 7, 8, 12, 13, 16, 18 | « remplissage » (8 fois, plus « remplir les trous »), mécanique déclarée inutile (n° 7, 12, 16) |
| Difficulté | 6, 9, 11, 17, 20 | toutes « facile » ou « entre facile et moyen » ; difficulté par la taille (n° 11) ou le nombre de barres (n° 17), pas par la logique |
| Règle mal comprise | 6, 9 | le charbon peut faire 2 lignes de haut (pièce haute) |
| Remarque de conception | 16 | « la météo rend les grilles trop faciles en imposant une forme » : hypothèse, non mesurée ici |

**Points UI** (pas des critères de génération ; certains sont déjà transmis à un autre workspace) :
- Le carnet ne montre pas qu'une pièce peut monter sur 2 lignes (n° 6, 9 : 4 abandons sur n° 9).
- L'indice « Échanges du jour » n'a pas été vu (n° 10 : « l'export à l'Italie n'est pas dans les publications », alors qu'il y est).
- Un voisin sans échange possible s'affiche quand même comme centrale utilisable ou dans les publications (n° 7, 12 ; G8 au rejeu : « étrange de mettre l'import d'Allemagne dans les usines utilisables si on n'a pas le droit »). La cause est dans le générateur (critère C1), l'affichage n'en est que le symptôme.

### Indices de confort (question 5)

- **Dans les candidates** : aucun. L'élagage final de `select_clues` se fait au niveau 4 : tout indice retirable sans perdre l'unicité ni la déduction complète est retiré, quitte à monter la note. Les « indices inutiles » cités par le joueur (n° 7, 12) sont les lignes d'échanges à 0 du carnet exact, pas des indices : c'est une mécanique morte (C1).
- **Dans les grilles publiées** : G8 (flux 6h) a été jouée au labo (`nuit-rejeu-notees` n° 1) : ressenti 1, 76 s, 4 gommes, « bonne grille facile… permet de prendre en main les indices et l'UI ». Sans ce flux, le solveur la note Expert (S8 tour 2). Elle remplit son rôle de Facile. G7 (tutoriel) n'a pas été jouée au labo.
- **Règle proposée** (`GAME-DESIGN.md` §8.3 et §10.4) : « Retirer un indice casse l'unicité ou fait monter la note. Un indice qui ne sert qu'à tenir la note visée n'est permis qu'en tutoriel et en Facile. » Ailleurs, la session montre que le joueur veut plus de difficulté, pas moins.

## Critères proposés

| | Critère | Mesure (bloc `lab` ou trace) | Seuil | Preuve | Statut |
|---|---|---|---|---|---|
| C1 | Aucune mécanique morte | voisin sans export ni import dans `solution` ; `co2_cap` sans étape `carbon` | 0 | 4/4 rejetées, 3 commentaires (n° 7, 12, 16) + G8 au rejeu ; le CO₂ est mort 3 fois sur 3 en carnet exact | **confirmé** |
| C2 | Des décisions à trouver | exports + imports + pompages non nuls fixés par une étape autre que `flow` | ≥ 2 (≥ 1 au minimum) | ★ 6/8 contre 2/12 ; 5 commentaires positifs les citent (n° 2, 5, 14, 15, 19) ; 0 décision = 5 « remplissage » sur 5 | **confirmé** (seuil à retester) |
| C3 | Plusieurs mécaniques vivantes | types distincts parmi échanges trouvés, STEP, pièce haute posée en 2, CO₂ utilisé | ≥ 2 | 4 ★ sur 5 contre 4/15 | hypothèse |
| C4 | Pas trop de barres | barres de `solution.placements` hors imports | ≤ 1,25 × créneaux (10 pour 8) | médiane 8,5 contre 11 ; commentaire n° 17 | hypothèse |
| C5 | La pièce haute compte comme une décision | grilles `tall` sans échange trouvé | à mesurer | confondu : les 3 ★ à pièce haute ont aussi ≥ 2 décisions | hypothèse |
| C6 | Pas de prix « nucléaire » en carnet libre | indices `price` avec `piece == "N"` | ≤ 1 | carnet libre : 1 ★ sur 5 ; n° 3 en a 4, n° 14 en a 5 | hypothèse |
| C7 | La note ne juge pas la beauté | — | — | 4 ★ sur 8 ressenties 1 | confirmé |

Sur les 60 grilles de `v3-jouer-a/b/c`, C1 + C2 (≥ 2) en gardent 21 (6 + 8 + 7), soit 35 %. 16 sur 60 ont une mécanique morte.

## Changements proposés (`solver/`), par effet attendu

| # | Changement | Fichier | Effet | Coût |
|---|---|---|---|---|
| 1 | **Rejet `dead_mechanic`** : retirer de la grille un voisin sans échange dans la référence (avant la sélection d'indices), poser `co2_cap` seulement en carnet libre et le retirer si aucune étape `carbon` | `generate/lot.py` | élimine 16/60 grilles « rejetées d'office » | S (2 h, tests compris) |
| 2 | **Mesure `decisions`** dans `trace_summary`, seuil `min_decisions` par lot (2 pour les lots « jouer ») et nouveau rejet nommé | `deduce/trace.py`, `generate/lot.py` | vise le meilleur séparateur ; ≈ 3× plus de tirages (lot B : ≈ 40 min au lieu de 13) | M (½ j) |
| 3 | **Mesure `live_mechanics`** dans le bloc `lab`, quota qui favorise ≥ 2 | `generate/lot.py` | teste C3 en session 3 | S |
| 4 | **Noter sur la composition, pas sur le dessin** : (a) regrouper les réfutations d'un même empan de colonnes en une seule hypothèse et la noter 3 quand l'alternative est unique ; (b) tester `ribbon` au niveau 1 avec `rerate_lots.py` avant de changer la règle | `deduce/rules.py`, `scripts/rerate_lots.py` | étiquettes plus justes (Expert → Moyen sur n° 6, 9, 20 attendu) ; change des notes publiées (`check_unique.py`, fixtures) | M à L (1-2 j) |
| 5 | **Les décisions comptent dans la note** : une étape `silhouette` ou `exhausted` qui fixe ≥ 2 échanges non nuls vaut niveau 2 | `deduce/rules.py` | rapproche la note du ressenti (ρ 0,60 contre 0,28) ; à valider après le n° 4 | M |
| 6 | Plafond de barres `max_bars` par lot | `generate/lot.py` | teste C4 | S |
| 7 | Pas de `price` sur N en carnet libre (réserve d'indices) | `generate/cluesel.py` | teste C6 | S |
| 8 | Écrire la règle des indices de confort (§8.3, §10.4, en-tête de `cluesel.py`) | doc | clôt la décision S8 n° 2 | S |

Ordre conseillé : 1 et 2 d'abord (génération), puis 3, 6, 7 en mesures seules ; 4 et 5 après la session 3, car ils changent des notes publiées.

## Session suivante

- **Lot** : une session écrite à la main de 17 grilles non jouées, tirées de `v3-jouer-b` et `v3-jouer-c`, plus G11 (`nuit-rejeu-notees` n° 4) pour la décision S8 n° 1. Ordre aléatoire, une Facile en premier. Liste et prédictions dans l'annexe repliée ci-dessous : **l'humain ne l'ouvre pas avant d'avoir joué**.
- **À regarder** :
  - C2 : les grilles prédites « belles » sont-elles gardées, et celles sans décision rejetées ?
  - C1 seul : une grille à mécanique morte mais avec 2 décisions est-elle rejetée quand même ?
  - C5 : pièce haute sans échange (3 grilles).
  - C4 : grilles à 14-18 barres qui passent C2.
  - CO₂ vivant en carnet libre (2 grilles).
  - Calibrage : ressenti des Difficile et Expert de b/c, et de G11.
- **Un 2e joueur**, même sur 8 grilles : tout repose aujourd'hui sur un seul goût.

<details>
<summary>Composition et prédictions (à n'ouvrir qu'après la session)</summary>

| lot | n° | Note | Décisions | Morte | Barres | Teste | Prédiction |
|---|---|---|---|---|---|---|---|
| v3-jouer-b | 1 | Moyen | 6 | | 8 | C2, CO₂ vivant (libre) | belle |
| v3-jouer-b | 3 | Difficile | 3 | | 13 | C2 | belle |
| v3-jouer-b | 14 | Moyen | 2 | | 7 | C2, 6 créneaux | belle |
| v3-jouer-b | 18 | Difficile | 4 | | 14 | C2 contre C4 | belle ? |
| v3-jouer-b | 20 | Difficile | 2 | | 12 | C2, STEP | belle |
| v3-jouer-b | 2 | Moyen | 3 | | 18 | C4 | rejet si C4 vrai |
| v3-jouer-c | 5 | Difficile | 2 | | 7 | C2 | belle |
| v3-jouer-c | 10 | Expert | 4 | | 11 | C2, C3, CO₂ vivant | belle |
| v3-jouer-c | 17 | Facile | 2 | | 8 | une Facile belle ? | belle |
| v3-jouer-b | 5 | Moyen | 0 | | 11 | C5, pièce haute seule | rejet si C5 faux |
| v3-jouer-b | 10 | Moyen | 0 | | 9 | C5 | idem |
| v3-jouer-b | 19 | Expert | 0 | | 9 | C5, calibrage Expert | idem |
| v3-jouer-b | 8 | Moyen | 1 | CO₂ | 8 | C1 | rejet |
| v3-jouer-b | 11 | Facile | 2 | IT | 11 | C1 seul | rejet |
| v3-jouer-c | 19 | Facile | 1 | UK, ES, DE | 8 | C1 | rejet |
| v3-jouer-c | 13 | Moyen | 0 | | 13 | C2, carnet libre | rejet |
| v3-jouer-c | 2 | Moyen | 0 | | 10 | C2, carnet libre | rejet |
| nuit-rejeu-notees | 4 | Expert (publiée), Facile (solveur) | — | — | — | décision G11 | ressenti 1 attendu |

Fichier de session à écrire (par l'orchestrateur, pas par ce worker) : `lab/sessions/<id>.json` avec ces `{lot, index}` (index = n° − 1).

</details>

## Annexe — décisions en attente de S8, en clair

Source : `docs/reviews/S8-tour3.md` §4 et `S8-tour2.md` §4.

**1. G11 : « Expert » ou « Facile » ?**
- **Contexte** : G11 est publiée sous l'étiquette Expert. Une correction du solveur lui a appris un raisonnement simple (« cette barre demanderait plus d'exports que le jour n'en publie »). Il résout maintenant G11 en 4 étapes faciles et la note Facile. Le site affiche toujours Expert, et un test garde l'écart de côté.
- **Options** : (a) garder Expert, ce qui est faux selon le solveur ; (b) passer à Facile ; (c) compter ce raisonnement comme Moyen (niveau 2), et G11 devient Moyen ; (d) la faire jouer à l'aveugle, puis choisir.
- **Recommandation** : (d), elle est déjà au labo et prend 2 minutes. Ensuite, retenir l'étiquette du ressenti. Cette session montre que les Expert du solveur sont ressenties Facile : « Expert » est presque sûrement faux.

**2. Indices de confort de G7 et G8**
- **Contexte** : la règle dit « aucun indice inutile ». Or G8 publie « à 6h, aucun bloc ne part vers l'Allemagne », et G7 « un réacteur tourne de 15h à 24h ». Sans ces indices, la solution reste unique, mais il faut des raisonnements bien plus durs : G8 passerait de Facile à Expert, G7 de Moyen à Difficile.
- **Options** : (a) les retirer : les grilles deviennent plus dures, on change leurs étiquettes ; (b) les garder et écrire l'exception dans la règle.
- **Recommandation** : (b). La règle devient : « un indice qui ne sert qu'à tenir la note est permis en tutoriel et en Facile, nulle part ailleurs ». G8 jouée au labo : ressentie 1, « permet de prendre en main ». Elle fait son travail.

**3. Texte d'introduction du tutoriel 3**
- **Contexte** : l'intro dit « Touche une pastille sous un créneau pour exporter un bloc ». Dans le jeu, on exporte en touchant une case de la rangée du voisin sous la grille ; « pastille » ne désigne pas cela, et le texte ne correspond pas à l'aide affichée (« Exporte en touchant une case de la rangée du voisin, sous la grille »).
- **Options** : (a) garder ; (b) reprendre la phrase de l'aide du jeu.
- **Recommandation** : (b), « Touche une case de la rangée de l'Allemagne, sous la grille, pour exporter un bloc ». C'est du texte, sans effet sur les notes ni sur la progression.

**4. L'escalier du charbon**
- **Contexte** : le format connaît deux formes de charbon « par paliers » : le trapèze (1, 2, 1 de haut), joué dans les tutoriels 8 et 9, et l'escalier (2 puis 1), que personne ne joue. Le labo refuse l'escalier ; aucune grille n'en a ; le moteur du jeu n'est pas testé dessus. Aujourd'hui, le validateur du jeu l'accepte (vérifié dans `grid.ts`), alors que celui du solveur le refuse sans option.
- **Options** : (a) le rendre jouable : tests moteur, gestes, dessin ; (b) le refuser dans le validateur du jeu tant qu'il n'est pas testé ; (c) le retirer du format.
- **Recommandation** : (b). Coût minimal, aucune grille touchée, et la porte reste ouverte.

**5. Poids du dépôt**
- **Contexte** : les captures des revues pesaient lourd (200 Mo). Depuis, le `.gitignore` exclut les images et PDF de `docs/reviews/` : aucune n'est suivie par git (vérifié), et l'historique pèse 4,8 Mo. Les 213 Mo restants sont des fichiers locaux, hors git.
- **Options** : (a) rien de plus ; (b) réécrire l'historique ; (c) supprimer aussi les captures locales anciennes.
- **Recommandation** : (a). Le problème est réglé, et une réécriture n'apporterait rien sur 4,8 Mo. Option (c) au goût de chacun, sans effet sur le dépôt.

## Questions à l'humain

1. **C1 (mécanique morte)** : on rejette ou on nettoie au générateur (retirer le voisin, retirer le plafond CO₂ en carnet exact) ? Recommandation : nettoyer (changement n° 1), on garde ainsi la grille.
2. **C2 (décisions)** : seuil 2 pour les lots « jouer », en acceptant ≈ 3× plus de tirages ? Recommandation : oui.
3. **Notation** : on attend la session 3 avant de toucher aux niveaux (changements n° 4 et 5) ? Recommandation : oui ; ils changent des notes publiées.
4. **Session 3** : on la joue avec la composition proposée (17 grilles + G11) ? Recommandation : oui, et avec un 2e joueur sur 8 grilles si possible.
5. **Décisions S8** : G11 jouée d'abord (d), confort permis en tutoriel et Facile, intro du tuto 3 reprise, escalier refusé, rien de plus pour le poids ? Recommandation : oui aux 5.
