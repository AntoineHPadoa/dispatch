# Review `v3-final` (S10.3, auteur s4)

## Tour 2 (S10.14, après S10.13)

**Verdict : OK à merger.** Les 3 bloquants et les 4 mineurs sont corrigés, sans régression. Seul reste le point 8, côté orchestrateur.

Correctif relu : commit `6dea2ec`, sur `a171217`. 4 fichiers : `GAME-DESIGN.md`, `docs/next/v3-criteres-m25.md`, `docs/next/v3-synthese.md` et `lab/lots/reference.json`.

### Bloquants

- **1. Règle objective : corrigé.** Elle sort de « Solide » et passe en tête d'« Ouvert », sous le titre « instable ». Le texte donne 81 % en M24 (la session qui l'a construite), 47 % en M25, le biais de +0,53, la piste de la fausse piste sans gomme et « un repère, pas une mesure ».
- **2. `GAME-DESIGN.md` §10 : corrigé.**
  - La règle objective reste en dehors des « Critères figés ». Elle gagne la phrase demandée : elle sous-estime le ressenti sur les petites grilles (47 % en `matin-25`), c'est un repère, pas une mesure.
  - La compacité reste parmi les critères figés, mais le seul énoncé figé est désormais « 40 cases ou plus = remplissage ». Le plafond à 30 y est présenté comme un choix prudent, avec la zone 31-39 non tranchée.
- **3. Compacité : corrigé, partout.**
  - **Formulation** : `v3-criteres-m25.md`, synthèse §1, §2 et §4, `GAME-DESIGN.md` §10 et le commentaire de `reference.json` reprennent la formulation demandée.
  - **Écarts cités** : `v3-criteres-m25.md` liste maintenant ce qui n'est pas confirmé. On y trouve le critère « contre » atteint, avec des témoins petits, et les prédictions qui font pire sur les compactes (0,28 contre 0,21). Le plafond 31-39 et l'échantillon y figurent aussi. Le Brier par groupe est repris en §3 de la synthèse.
  - **Backlog** : il gagne le test 31-39 (lot à 39 contre lot à 30, à l'aveugle).
  - **`reference.json`** : JSON valide. Les réglages sont inchangés, seul le commentaire change.

### Mineurs

- **4. Synthèse §4 : corrigé.** La mention « faute encore de plafond » a disparu. Le premier essai devient « Essai avant plafonds ». Le compte des ★ est ventilé : 55 avant M25, plus 2 de `v3g5-temoin`, et 7 pour `v3g6-compact`, mis à part. C'est cohérent avec les 9 ★ de M25.
- **5. Chiffres périmés : corrigé.** « 111 grilles » remplace 96 en §3. L'en-tête et le titre du cumul disent « 111 notées, dont 110 avec une partie ».
- **6. Codage « nucléaire » : corrigé.** Les cas #11 et #13 ont maintenant leur propre colonne « nucléaire » et ne comptent plus en « trop gros ». Les chiffres qui en dépendent suivent :
  - 13 grilles « trop gros » au lieu de 14 ;
  - « les 13 reproches au-delà de 30 cases, aucun sur 62 » ;
  - AUC des cases en M25 à 1,00, ce qui se vérifie à la main : les 4 « trop gros » sont les 4 grilles à 40 cases ou plus.
  
  Les autres AUC recalculées (hauteur, créneaux, surface, cumul 0,91) ne sont pas refaites ici. Elles reposent sur le même codage manuel, et leur sens ne change pas.
- **7. `allow_one_plant` : corrigé.** La raison est dite technique et sans donnée de jeu dans la synthèse et dans `reference.json`. Le backlog gagne « surveiller les monotones ».

### Non-régression

- **Tests** : `pytest lab/tests -q` (venv du dossier principal, worktree `v3-final`) donne 361 passed. `web/` ne lit toujours pas `reference.json`.
- **Cohérence** : aucun « solide » ni « confirmé » ne subsiste pour la règle ou pour le seuil de 30.
- **Commit** : en anglais, auteur noreply, sans mention de Claude ni d'IA.
- **Détails non bloquants, antérieurs au correctif** :
  - les paliers cumulés donnent 56 % (31-39) et 82 % (1 ligne pleine), contre 57 % et 83 % dans mon recalcul : c'est un écart d'arrondi ;
  - la synthèse numérote les compactes par lot (n°1 et n°13), alors que `v3-criteres-m25.md` les numérote par session (#13 et #11) ;
  - la réserve sur les grilles à 12 créneaux n'en cite qu'une des deux.

### Reste pour l'orchestrateur

- **Point 8 toujours valable** : `docs/next/v3-session-matin-25.md` est toujours non suivi dans le dossier principal, identique à celui de la branche. Il faut le supprimer avant le merge.

## Tour 1

**Verdict : À corriger.** 3 points bloquants, tous rédactionnels (synthèse et `GAME-DESIGN.md` §10). Les chiffres sont justes, les tests verts, et `reference.json` peut rester tel quel si sa justification est reformulée.

Branche `v3-final`, 1 commit `a171217` sur `main` (`03f4de2`) : `docs/next/v3-criteres-m25.md`, `docs/next/v3-session-matin-25.md`, `docs/next/v3-synthese.md`, `lab/lots/reference.json`, `GAME-DESIGN.md`.

## Ce qui a été vérifié

- **Chiffres par grille** : recalculés depuis `lab/plays.jsonl` (1re partie, hors fantômes), `lab/notes.json`, `lab/sessions/matin-25.json` et les lots. Les 15 lignes sont identiques : cases, hauteur, créneaux, temps, note A, règle, ressenti, ★. Jeu actif 13,9 min, aucun abandon ni fantôme.
- **Brier** : prédictions 0,212, référence 0,593 → 0,240, P = 0,5 → 0,250. Bootstrap : 73 % (10 000 tirages), contre 74 % annoncé. Sous-groupes justes : grandes 0,05 contre 0,35 ; compactes 5,0 ★ attendues pour 7 obtenues. Ressenti : 9 justes contre 6 pour « toujours 1 ».
- **Groupes** : compactes 7/9, ressenti 1,78, note A 2,33, médiane 35 s ; témoins 2/3, 2,33, 2,33, 84 s ; grandes 0/3, 1,33, 3,00, 59 s. ≤ 30 cases : 8/10 ; ≥ 40 cases : 0/4 (Fisher unilatéral 15/1001 = 0,015).
- **Règle objective** : accord 7/15, biais +0,53. Les 8 désaccords vont tous dans le même sens. 4 des 5 « 2 contre 1 » ont une erreur. Cumul 76/110.
- **Cumul** (111 grilles notées par J1 avec `cells`, dont 110 avec une partie) :
  - paliers de cases : 70 / 66 / 57 / 24 % ;
  - lignes pleines : 58 / 83 / 26 % ;
  - hauteur : 74 / 61 / 32 % ;
  - créneaux : 90 / 56 / 43 % ;
  - AUC « pas de ★ » : cases 0,68, hauteur 0,64, créneaux 0,60 ;
  - à ≤ 30 cases et ≥ 8 GW : 5/9 ;
  - à ≤ 30 cases et 12 créneaux : 2 grilles, 0 ★ ;
  - au-delà de 30 cases : 12 créneaux 10/21, 6 ou 8 créneaux 11/28.

  Ces chiffres collent à ±1 grille avec l'analyse. Les AUC « trop gros » reposent sur un codage manuel des commentaires (14 grilles) que je n'ai pas refait mot à mot. Les ordres de grandeur sont cohérents avec les paliers.
- **Référence** : `dispatch-solver generate lab/lots/reference.json` (graine du fichier) produit 20/20 en 27 s. Répartition : 7 F, 8 M, 3 D, 2 E ; médiane 21 cases (14 à 29) ; 15 grilles sans ligne pleine ; 2 grilles à 12 créneaux. C'est cohérent avec l'essai annoncé (graine 3101). `allow_one_plant` existe (`solver/.../generate/lot.py:88`) et figure déjà dans `v3g6-compact`.
- **Tests** : `pytest lab/tests -q` donne 361 passed. `web/` ne lit pas `reference.json` (aucune référence dans `web/tests` ni `web/src`), donc `npm test` n'était pas requis.
- **Conventions** : commit en anglais, auteur noreply, aucune mention de Claude ni d'IA ; documents en français.

## Points

### 1. Bloquant : la règle objective reste classée « Solide »

Dans `v3-synthese.md` §2, la règle est toujours sous « Solide », alors que l'accord tombe à 47 % sur la seule session qui ne l'a pas construite. C'est justement le test hors échantillon prévu, et elle l'échoue. Les 8 écarts vont tous dans le même sens, donc c'est un biais, pas du bruit.

- **À faire** : la déplacer en « Ouvert » (ou « instable »), avec le chiffre de 47 % et la piste de la fausse piste sans gomme.
- **Contrôle de cohérence** : la synthèse énonce elle-même « ce qui n'est confirmé que sur les données d'origine reste une hypothèse ».

### 2. Bloquant : `GAME-DESIGN.md` §10 n'est pas aligné sur ce classement

- **Règle** : la ligne 207 (« Règle objective de difficulté ») est inchangée et ne dit rien de M25. Il faut y écrire qu'elle sous-estime le ressenti sur les petites grilles (47 % en M25) et qu'elle sert de repère, pas de mesure.
- **Compacité** : elle entre dans les « Critères figés (tenus hors échantillon…) » (ligne 198), avec des seuils formulés plus fort que les données (voir point 3).

### 3. Bloquant : « compacité confirmée hors échantillon » dit plus que les données

Ce que M25 confirme vraiment hors échantillon : **à 40 cases ou plus, une grille est du remplissage** (0 ★ sur 4, 4 reproches, seuil fixé avant la session). C'est solide pour Joueur 1.

Ce qu'elle ne confirme pas :

- **Le plafond à 30 plutôt qu'à 35 ou 39.** Une seule grille de M25 est entre 31 et 39 cases (★). En cumul, 25-30 donne 66 % contre 57 % à 31-39 : l'écart est faible et non testé. 30 est la valeur jouée, pas un seuil mesuré.
- **« Compactes mieux que témoins ».** La fiche avait écrit un critère **contre** : « compactes pas mieux reçues que les témoins (écart d'une ★ ou moins) ». Avec 7/9 contre 2/3, soit 6/9 à l'échelle, on est à une ★ : ce critère est atteint. L'analyse ne cite que les critères « pour », tous tenus. Elle doit dire que le critère « contre » l'est aussi, ce qui s'explique par des témoins tirés petits (22 et 31 cases).
- **Les prédictions sur les compactes.** Les prédictions ne battent la référence que grâce aux grandes. Sur les compactes, elles font pire (0,28 contre 0,21). La règle de la fiche (« l'hypothèse n'est retenue que si ses prédictions battent la référence ») est tenue en global, pas sur le groupe concerné.
- **L'échantillon.** 15 grilles, un seul joueur, concepteur devenu expert (8 % plus rapide par session). Les 3 grandes ont été choisies pour être grandes.

**À faire** : dans `v3-criteres-m25.md`, la synthèse (§1, §2, §4), `GAME-DESIGN.md` §10 et le commentaire de `reference.json`, écrire à peu près ceci :

> ≥ 40 cases (ou ≥ 2 lignes pleines) : remplissage, confirmé hors échantillon sur un joueur. Plafond de référence à 30 cases : choix prudent, la valeur jouée. La zone 31-39 n'est pas tranchée.

- **`reference.json`** : garder `max_cells: 30` et `max_full_n_rows: 1` est défendable, puisque le coût mesuré est faible (20/20, 27 s). Il faut le présenter comme un choix et non comme un seuil démontré, et ajouter au backlog le test de la zone 31-39 contre témoins.
- **`max_full_n_rows: 1`** : soutenu par le cumul (≥ 2 lignes : 26 %, contre 83 % à 1 ligne). Il reste corrélé aux cases, ce que la synthèse dit déjà.

### 4. Mineur : la synthèse §4 garde des phrases d'avant les plafonds

- **« Gardés »** : on y lit encore « au plus 3 grilles sur 12 créneaux, faute encore de plafond de taille », alors que le plafond est désormais ajouté.
- **Premier « Essai »** : « Médiane 27 cases, mais 4 grilles à 40 cases ou plus : c'est ce que vise `v3g6-compact` » décrit l'ancienne référence. Il cohabite avec le nouvel essai : préciser « avant plafonds » ou le supprimer.
- **« Ils portent les 55 grilles ★ »** : ce total date d'avant M25. M25 ajoute 9 ★, dont 7 sur `v3g6-compact`, qui figure maintenant parmi les lots gardés. Il faut le mettre à jour, ou dire que `v3g6-compact` est à part.

### 5. Mineur : chiffres périmés ailleurs dans la synthèse

- **§3** : « un concepteur qui a fait 96 grilles » vaut désormais 111.
- **§1** : l'en-tête annonce bien 111 grilles et 6 sessions, mais le comptage de l'analyse est « 110 grilles notées ». Dire lequel vaut : 111 notées, dont 110 avec une partie.

### 6. Mineur : codage « trop gros » des compactes incohérent

- **Table des groupes** : elle compte un « trop gros » chez les compactes (#13, « trop de nucléaire »), alors que les critères disent « aucun "pas compact" sur une compacte ».
- **#11** : « remplir avec du nucléaire partout » n'est pas compté, alors qu'il est du même type que #13.
- **À faire** : choisir une seule lecture, par exemple un « remplissage de nucléaire » distinct de « trop gros ». Les conclusions ne changent pas.

### 7. Mineur : `allow_one_plant` entre dans la référence sans donnée propre

Une seule grille monotone a été jouée (n°4, ★). La raison donnée, technique (« une journée basse ne laisse souvent qu'une sorte de centrale »), est plausible, mais les Faciles monotones étaient 5 sur 20 dans `v3g6-compact`. À noter au backlog : surveiller la part de monotones dans le prochain lot de référence.

### 8. Pour l'orchestrateur : fichier non suivi dans `main`

`docs/next/v3-session-matin-25.md` est non suivi dans le dossier principal et identique à celui de la branche. Le supprimer (ou le déplacer) avant le merge, sinon git refusera d'écraser le fichier non suivi.
