# Critères v3 — session finale `matin-25` (Joueur 1)

Source : `lab/sessions/matin-25.json`, 15 grilles, **13,9 min de jeu actif**, 1re partie de chaque grille (aucun fantôme, aucun abandon). Ressenti et ★ de `notes.json`. Fiche et prédictions : `v3-session-matin-25.md`. **C** compacte (`v3g6-compact`, ≤ 30 cases), **T** témoin (`v3g5-temoin`), **G** grande (≥ 40 cases). Haut. = demande max (GW) ; « trop gros » = commentaire qui reproche la taille, les cases ou lignes de nucléaire inutiles. Règle = règle objective de difficulté (`GAME-DESIGN.md` §10). Scripts dans le scratchpad, hors dépôt.

| # | Grille | Rôle | A | Cases | Haut. | Créneaux | Temps | Règle | Ress. | ★ | P(★) | Commentaire abrégé |
|---|---|---|---|---|---|---|---|---|---|---|---|---|
| 1 | compact n°20 | C | F | 23 | 4 | 8 | 34 s | 1 | 2 | ★ | 0,60 | « bien placer toutes ses usines pour rentrer » |
| 2 | temoin n°12 | T | D | 22 | 7 | 8 | 107 s | 2 | 2 | ★ | 0,65 | « planté sur l'emplacement de la STEP » |
| 3 | compact n°6 | C | E | 23 | 6 | 8 | 124 s | 2 | 3 | ★ | 0,75 | « buggué sur comment la remplir » ; export illimité pas affiché |
| 4 | temoin n°11 | G | D | 87 | 8 | 12 | 59 s | 1 | 1 | | 0,10 | « 6 lignes de remplissage, ennuyant comme un rat mort » |
| 5 | compact n°16 | C | M | 26 | 6 | 8 | 35 s | 1 | 1 | ★ | 0,45 | « du CO₂ qui apporte quelque chose » |
| 6 | compact n°7 | C | D | 27 | 6 | 8 | 41 s | 1 | 2 | ★ | 0,60 | « one shot, mais pas si facile » |
| 7 | temoin n°8 | T | D | 45 | 8 | 12 | 58 s | 1 | 2 | | 0,30 | « beaucoup de cases inutiles », trop gros |
| 8 | compact n°11 | C | F | 16 | 4 | 6 | 20 s | 1 | 1 | ★ | 0,40 | « facile compact, bonne grille de démarrage » |
| 9 | jouer-c n°5 | G | M | 55 | 6 | 12 | 39 s | 1 | 1 | | 0,20 | « tant de remplissage », trop gros |
| 10 | compact n°4 | C | F | 17 | 5 | 8 | 20 s | 1 | 1 | ★ | 0,35 | « assez compact pour ne pas être rébarbatif » |
| 11 | compact n°13 | C | D | 28 | 5 | **12** | 19 s | 1 | 1 | | 0,60 | « remplir avec du nucléaire partout » |
| 12 | temoin n°4 | T | F | 31 | 7 | 8 | 84 s | 2 | 3 | ★ | 0,45 | « coordonner tous ses imports » |
| 13 | compact n°1 | C | E | 28 | 6 | 8 | 40 s | 1 | 2 | | 0,70 | « bonne coordination export/STEP, mais trop de nucléaire » |
| 14 | jouer-c n°3 | G | E | 42 | 6 | 8 | 74 s | 1 | 2 | | 0,30 | « 2 lignes de nucléaire de moins : aussi dur, moins redondant » |
| 15 | compact n°5 | C | M | 19 | 4 | 8 | 80 s | 2 | 3 | ★ | 0,55 | « étonnamment galéré » sur la STEP |

## Résultats

- **Brier** : prédictions **0,212**, référence « P = 0,593 » (taux de `matin-24`) 0,240, P = 0,5 : 0,250. 1re session où les prédictions battent la référence, mais pas de façon sûre (bootstrap : meilleures dans 74 % des tirages). Le gain vient des grandes (0,05 contre 0,35) ; sur les compactes, trop pessimistes (5,0 ★ attendues, 7 obtenues ; 0,28 contre 0,21). Ressenti : 9 justes sur 15, contre 6 pour « toujours 1 ».

| Groupe | n | ★ | Ressenti | Note A | Temps médian | s / case | Cases (méd.) | « trop gros » |
|---|---|---|---|---|---|---|---|---|
| Compactes | 9 | **7 (78 %)** | 1,78 | 2,33 | 35 s | 1,43 | 23 | 1 (#13, « trop de nucléaire ») |
| Témoins | 3 | 2 (67 %) | 2,33 | 2,33 | 84 s | 2,71 | 31 | 1 (#7, 45 cases) |
| Grandes | 3 | **0** | 1,33 | 3,00 | 59 s | 0,72 | 55 | **3** |

- **Paires à note égale** : compactes 4 ★ sur 6 (E #3, D #6, M #5 et #15), grandes 0 sur 3. Les grandes se jouent plus vite par case (0,7 s) : du remplissage, ressenti 1 ou 2 malgré une note A plus haute.
- **Compacité confirmée hors échantillon.** Seuils fixés avant la session : ≤ 30 cases **8 ★ sur 10**, ≥ 40 cases **0 sur 4**, toutes les 4 « trop gros » (p = 0,015, Fisher). AUC de `cells` sur M25 : 0,97 pour « trop gros », 0,96 pour l'absence de ★. Critères « pour les plafonds » de la fiche : tous tenus (≥ 6 ★ sur 9 compactes, ≤ 1 sur 3 grandes, aucun « pas compact » sur une compacte, la Facile monotone #10 a sa ★). Contre les témoins, l'écart reste faible (78 % contre 67 %) : 2 des 3 témoins tirés faisaient ≤ 31 cases, et le seul gros (45 cases) n'a pas de ★.
- **Ce que les compactes n'évitent pas** : #11 et #13 (28 cases) restent du remplissage de nucléaire, 96 et 86 % de part N. #11 est la seule compacte à 12 créneaux.

## Seuils, cumul des sessions (110 grilles notées, Joueur 1)

| Mesure | AUC « trop gros » (14 grilles) avant M25 / M25 / cumul | AUC « pas de ★ », cumul | Paliers de ★ (cumul) |
|---|---|---|---|
| **Cases** | **0,88 / 0,97 / 0,89** | **0,69** | ≤ 24 : 70 % ; 25-30 : 66 % ; 31-39 : 56 % ; **≥ 40 : 24 %** |
| Lignes pleines de N | 0,78 / 0,71 / 0,75 | 0,56 | 0 : 58 % ; 1 : 82 % ; **≥ 2 : 26 %** |
| Hauteur (demande max) | 0,76 / 0,79 / 0,70 | 0,64 | ≤ 5 GW : 74 % ; 6-7 : 60 % ; **≥ 8 : 32 %** |
| Créneaux | 0,61 / 0,77 / 0,66 | 0,60 | 6 : 90 % ; 8 : 56 % ; **12 : 43 %** |
| Surface (lignes affichées × créneaux) | 0,75 / 0,86 / 0,77 | 0,63 | ≤ 48 : 70 % ; > 80 : 40 % |

- **Les cases mesurent le mieux le « trop gros pour rien »**, sur chaque échantillon. Au-delà de 30 cases : 13 des 14 reproches ; à 30 ou moins : 1 sur 62.
- **Hauteur et créneaux n'ajoutent presque rien une fois les cases plafonnées.** À 30 cases ou moins : 8 GW et plus, 5 ★ sur 9 (contre 37 sur 53), aucun reproche. Au-delà de 30 cases, 12 créneaux ne font pas pire que 6 ou 8 (10 ★ sur 21 contre 10 sur 27). Son « 10 GW × 12 créneaux » décrit des grilles de 45 à 87 cases : c'est la taille qu'il voit.
- **Une réserve sur 12 créneaux** : sous 30 cases, 2 grilles en tout, 0 ★ (#11 et `v3-jouer-b` n°19, « remplissage rapide »). Trop peu pour un seuil.

## Règle objective contre son ressenti

- **Accord 7 sur 15 (47 %)**, contre 81 % en M24 ; cumul 76 sur 110 (69 %). Biais +0,53 : il ressent **plus** que la règle.
- Les 8 désaccords sont tous dans ce sens. 5 grilles ressenties 2 pour une règle à 1 (#1, 6, 7, 13, 14) : jouées vite, sans gomme, mais avec une fausse piste dite (« planté sur les tailles de nucléaire », « one shot mais pas si facile »). 4 d'entre elles ont au moins une erreur, que la règle ignore. 3 grilles ressenties 3 pour une règle à 2 (#3, 12, 15) : 80 à 124 s, sous les 6 s par case.
- **Lecture** : sur des petites grilles, s / case grossit peu ce qui fait réfléchir ; une hésitation sans gomme ne laisse aucune trace. Il manque toujours le temps d'inactivité. La règle reste un repère, pas une mesure de son ressenti.
