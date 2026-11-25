# Session `matin-25` (Joueur 1) : session finale

- **15 grilles**, environ 20 min de jeu actif (1 min par grille en `matin-24`, un peu plus ici pour 3 grandes grilles), 35 à 40 min avec les notes.
- **Lancer** : relancer `lab/run.sh`, ouvrir http://localhost:5173/dispatch/lab.html, choisir « **Joueur 1** », onglet « **Session** », « Session finale », puis « Jouer la suivante ».
- **À chaque grille** : ressenti, belle ou pas belle et pourquoi, ★.
- **Consigne** : ne lis pas les analyses (`v3-criteres-*`, `v3-synthese.md`, `V3G6.md`, reviews) avant d'avoir fini la session, ni le bloc replié ci-dessous.

<details>
<summary>Rôle des grilles et prédictions (Joueur 1 : ne pas ouvrir avant d'avoir joué)</summary>

## Question

Des grilles de 30 cases au plus (`v3g6-compact`) sont-elles mieux reçues que des témoins et que des grilles de 40 cases ou plus, à difficulté proche ? La réponse décide si `max_cells` et `max_full_n_rows` entrent dans `lab/lots/reference.json` (S10.3).

## Composition

Graine `random.Random("matin-25")`. Exclues : les 100 grilles déjà jouées par Joueur 1 (`plays.jsonl`, hors phantoms) et les grilles sans décision.

- **9 compactes** (`v3g6-compact`, 16 à 28 cases) :
  - ses 4 Difficiles et Expertes : n°1, 6, 7, 13 ;
  - 5 tirées au hasard parmi les 16 autres, au plus 2 monotones (pièce haute seule, Facile) : n°4, 5, 11, 16, 20. Une seule monotone est sortie (n°4).
  - Bilan : 3 F, 2 M, 2 D, 2 E.
- **3 témoins** (`v3g5-temoin`, générateur sans quotas ajoutés) tirés au hasard : n°4, 8, 12.
- **3 grandes** (40 cases ou plus, `v3g4-*` ou `v3g5-*`), une par note pour coller aux compactes : M `v3g4-jouer-c` n°5, D `v3g5-temoin` n°11, E `v3g4-jouer-c` n°3.
- **Ordre** : motif C T C G C C T C G C C T C G C (jamais plus de 2 compactes d'affilée), permutation de la graine dans chaque groupe, une Facile en tête, jamais deux grilles de 12 créneaux d'affilée.

## Prédictions, écrites avant la session

P(★) = probabilité de ★ ; Ress. = ressenti attendu (1 à 4). N = part de nucléaire, K = densité de décisions.

| # | Grille | Note | Rôle | Traits | P(★) | Ress. |
|---|---|---|---|---|---|---|
| 1 | `v3g6-compact` n°20 | F | compacte | 23 cases, 2 échanges + pièce haute, 65 % N | 0,60 | 1 |
| 2 | `v3g5-temoin` n°12 | D | témoin | 22 cases, 3 échanges + STEP couplée | 0,65 | 2 |
| 3 | `v3g6-compact` n°6 | E | compacte | 23 cases, 3 échanges + STEP + CO₂ couplées, K 1,29, 1 ligne pleine | 0,75 | 3 |
| 4 | `v3g5-temoin` n°11 | D | grande | 87 cases, 12 créneaux, 6 lignes pleines, CO₂ couplée | 0,10 | 2 |
| 5 | `v3g6-compact` n°16 | M | compacte | 26 cases, STEP + CO₂ non couplées | 0,45 | 1 |
| 6 | `v3g6-compact` n°7 | D | compacte | 27 cases, 3 échanges + STEP, nucléaire et import seuls | 0,60 | 2 |
| 7 | `v3g5-temoin` n°8 | D | témoin | 45 cases, 12 créneaux, 7 échanges + CO₂ couplée | 0,30 | 2 |
| 8 | `v3g6-compact` n°11 | F | compacte | 16 cases, 6 créneaux, 1 échange | 0,40 | 1 |
| 9 | `v3g4-jouer-c` n°5 | M | grande | 55 cases, 12 créneaux, 2 échanges + pièce haute | 0,20 | 1 |
| 10 | `v3g6-compact` n°4 | F | compacte, monotone | 17 cases, pièce haute seule, 41 % N | 0,35 | 1 |
| 11 | `v3g6-compact` n°13 | D | compacte | 28 cases, 12 créneaux, 2 échanges + CO₂ couplée | 0,60 | 2 |
| 12 | `v3g5-temoin` n°4 | F | témoin | 31 cases, 5 échanges | 0,45 | 1 |
| 13 | `v3g6-compact` n°1 | E | compacte | 28 cases, 2 échanges + STEP + CO₂ couplées | 0,70 | 3 |
| 14 | `v3g4-jouer-c` n°3 | E | grande | 42 cases, 4 lignes pleines, STEP + CO₂ couplées | 0,30 | 2 |
| 15 | `v3g6-compact` n°5 | M | compacte | 19 cases, échange + STEP couplée | 0,55 | 1 |

- **Total attendu** : 7,0 ★ sur 15 (47 %).
  - Compactes : 5,0 sur 9 (56 %) ; témoins : 1,4 sur 3 (47 %) ; grandes : 0,6 sur 3 (20 %).
  - Je parie sur la taille (0 ★ sur 3 à 40 cases ou plus en `matin-24`) et sur l'usure des globales couplées : les Expertes compactes ressenties 3, pas 4.
- **Ce qui trancherait** (échantillon petit, à lire comme une indication) :
  - **Pour les plafonds** : au moins 6 ★ sur 9 compactes, au plus 1 sur 3 grandes, et aucun commentaire « pas compact » sur une compacte.
  - **Contre** : compactes pas mieux reçues que les témoins (écart d'une ★ ou moins), ou « trop simple, monotone » sur les compactes Faciles.
  - **Paires à difficulté égale** : E #3 et #13 contre #14 ; D #6 et #11 contre #4 ; M #5 et #15 contre #9.

## Référence triviale à battre

- `matin-24` : **16 ★ sur 27**, soit P(★) = 0,593 pour chaque grille.
- **Après la session**, calculer le score de Brier : moyenne de (P − ★)², avec ★ = 1 ou 0.
  - Mes prédictions : Brier = 0,212.
  - Référence 0,593 : Brier = 0,240. Résultat et analyse : `v3-criteres-m25.md`.
  - L'hypothèse « compact = plus de ★ » n'est retenue que si ses prédictions battent la référence.
- Ressenti : comparer aussi les justes à « toujours 1 », et la règle objective de difficulté (`GAME-DESIGN.md` §10) au ressenti.

</details>
