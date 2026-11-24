# Session `matin-24` (Joueur 1)

- **27 grilles**, environ 80 min de jeu actif (3 min par grille en moyenne sur `matin-23`), 1 h 30 à 1 h 45 avec les notes.
- **Lancer** : relancer `lab/run.sh`, ouvrir http://localhost:5173/dispatch/lab.html, choisir « **Joueur 1** », onglet « **Session** », « Session du 24 novembre », puis « Jouer la suivante ».
- **À chaque grille** : ressenti, belle ou pas belle et pourquoi, ★.
- **Consigne** : ne relis pas les documents d'analyse (`v3-criteres-*`, `v3-challenge.md`, `V3G5.md`, reviews) avant d'avoir fini la session, ni le bloc replié ci-dessous.

<details>
<summary>Rôle des grilles et prédictions (Joueur 1 : ne pas ouvrir avant d'avoir joué)</summary>

## Composition

- **8 contrôles du challenger** (`v3-challenge.md` §5) : 4 témoins historiques, 3 contre-prédictions, l'ancrage. Jamais deux à la suite ; 3 dans le 1er tiers, 2 dans le 2e, 3 dans le 3e.
- **Rejeux retirés** (`v3-jouer-a` n°15 et n°17), sur consigne. La page Session les montre déjà « Résolue », « Jouer la suivante » les saute, et l'écran de fin affiche l'ancienne ★ et l'ancien commentaire : ils ne mesureraient plus la stabilité du jugement. Limite du labo à corriger avant un vrai rejeu à l'aveugle : masquer l'état résolu, la ★ et le commentaire existants.
- **H1** : 4 Moyens de `v3g4` à 8 créneaux, réduits de 6 à 4. K < 0,5 : a n°8, b n°14. K ≥ 0,5 : b n°8, a n°15. Écartés : c n°16 (15 % de nucléaire, recoupe les contre-prédictions) et rampe n°18 (la rampe brouille le test).
- **Tirage au hasard**, graine `random.Random("matin-24")`, sur les grilles jamais jouées par Joueur 1 :
  - `v3g5-squelette` : 7 grilles sur 20 (n°2, 7, 10, 12, 15, 16, 17). Les deux grilles à une seule sorte (n°18, n°20) ne sont pas sorties.
  - `v3g5-temoin` : 3 grilles (n°3, 9, 20).
  - `v3g4`, au hasard dans chaque case visée : H2 grande, a n°4 (tirée entre a n°4 et c n°3) ; H4 à 1 échange au plus, b n°1 (entre b n°1 et c n°1). Choisies : a n°12 (seule Expert couplée à 4 échanges ou plus), c n°9 et b n°19 (les deux seules Moyen ou Difficile à K ≥ 0,5 et moins de 40 cases avec un trou contesté).
  - **10 grilles tirées sur 19 non-contrôles**, plus 2 tirées dans une case visée.
- **Ordre** : permutation de la même graine, sous contraintes. Une Facile hors contrôle en tête, jamais deux fois le même lot, ni deux grilles de 12 créneaux, ni deux contrôles d'affilée. Aucune rampe.

## Prédictions, écrites avant la session

P(★) = probabilité de ★ ; Ress. = ressenti attendu (1 à 4). N = part de nucléaire, K = densité de décisions.

| # | Grille | Note | Rôle | Traits | P(★) | Ress. |
|---|---|---|---|---|---|---|
| 1 | `v3g5-temoin` n°20 | F | témoin v3g5 | 30 cases, 90 % N, 2 échanges | 0,35 | 1 |
| 2 | `v3g4-jouer-b` n°19 | M | H3 contesté | STEP ×2 + CO₂ non couplées, K 1,12, 1 trou contesté | 0,65 | 2 |
| 3 | `v3-jouer-c` n°14 | F | **contrôle** : témoin historique | 12 créneaux, 69 cases, 99 % N | 0,15 | 1 |
| 4 | `v3g4-jouer-a` n°15 | M | H1 K ≥ 0,5 | STEP + CO₂, 88 % N, K 0,60 | 0,50 | 1 |
| 5 | `v3-jouer-b` n°17 | F | **contrôle** : ancrage | sans décision, 87 % N | 0,10 | 1 |
| 6 | `v3g5-squelette` n°2 | D | squelette | 5 échanges + CO₂ couplée, 21 cases, 43 % N | 0,75 | 3 |
| 7 | `v3-jouer-b` n°4 | F | **contrôle** : contre-prédiction | 24 % N, carnet exact, 6 créneaux, 9 trous uniques | 0,40 | 1 |
| 8 | `v3g5-squelette` n°15 | M | squelette | STEP seule, 60 % N, K 0,27 | 0,40 | 1 |
| 9 | `v3g5-temoin` n°9 | M | témoin v3g5 | STEP couplée, carnet exact, 84 % N | 0,60 | 2 |
| 10 | `v3g5-squelette` n°16 | M | squelette | pièce haute seule, 37 % N, K 0,17 | 0,35 | 1 |
| 11 | `v3g4-jouer-a` n°8 | M | H1 K < 0,5 | pièce haute seule, 18 cases, 33 % N | 0,40 | 1 |
| 12 | `v3g5-squelette` n°17 | M | squelette | 94 % N, 2 lignes pleines, prix | 0,30 | 1 |
| 13 | `v3-jouer-c` n°8 | M | **contrôle** : témoin historique | 3 échanges, 78 % N | 0,40 | 1 |
| 14 | `v3g5-temoin` n°3 | M | témoin v3g5 | STEP couplée, 93 % N | 0,45 | 1 |
| 15 | `v3g4-jouer-c` n°9 | D | H2 petite + H3 contesté | 18 cases, 4 échanges + CO₂ couplée, 1 trou contesté | 0,75 | 3 |
| 16 | `v3-jouer-b` n°12 | F | **contrôle** : témoin historique | 12 créneaux, carnet exact, 1 échange | 0,15 | 1 |
| 17 | `v3g4-jouer-b` n°14 | M | H1 K < 0,5 | 2 échanges, 88 % N, 1 trou contesté | 0,35 | 1 |
| 18 | `v3g4-jouer-a` n°4 | D | H2 grande | 47 cases, 83 % N, CO₂ couplée | 0,40 | 2 |
| 19 | `v3g5-squelette` n°10 | F | squelette | pièce haute seule, 46 % N | 0,30 | 1 |
| 20 | `v3-jouer-c` n°3 | F | **contrôle** : témoin historique | 1 échange, 71 % N | 0,20 | 1 |
| 21 | `v3g4-jouer-b` n°8 | M | H1 K ≥ 0,5 | 3 échanges + pièce haute, carnet exact, K 0,83 | 0,65 | 2 |
| 22 | `v3g2-jouer-c` n°18 | M | **contrôle** : contre-prédiction | 3 voisins, 4 échanges, carnet exact | 0,60 | 2 |
| 23 | `v3g5-squelette` n°7 | F | squelette | pièce haute, carnet exact, 40 % N | 0,35 | 1 |
| 24 | `v3g3-jouer-b` n°7 | M | **contrôle** : contre-prédiction | 23 % N, 5 sortes posées, carnet exact | 0,50 | 1 |
| 25 | `v3g5-squelette` n°12 | M | squelette | STEP + stock, 68 % N | 0,45 | 1 |
| 26 | `v3g4-jouer-b` n°1 | E | H4 ≤ 1 échange | STEP + CO₂ couplées, 1 échange | 0,50 | 2 |
| 27 | `v3g4-jouer-a` n°12 | E | H4 ≥ 4 échanges + H2 petite | STEP + CO₂ couplées, 4 échanges, 27 cases | 0,65 | 3 |

- **Total attendu** : 11,65 ★ sur 27 (43 %), en dessous de `matin-23`. Je parie sur l'accoutumance à la STEP (ressenti 1 pour les STEP non couplées) et sur peu de ★ chez les témoins historiques (1 sur 4 au plus).
- **Ce qui trancherait** :
  - **H1** : #11 et #17 ressenties 1, au moins une de #4 et #21 ressentie 2.
  - **H2** : #18 « remplissage » et sans ★, #15 et #27 avec ★.
  - **H3** : ★ sur #2, #15, #17 (contestés) plus souvent que sur #4, #21 (trous uniques).
  - **H4** : #26 ressentie 1 ou 2, #27 ressentie 3 ou plus.
  - **Squelette** : moins de commentaires « remplissage » sur ses 7 grilles que sur les 3 `v3g5-temoin` et les 4 témoins historiques.

## Référence triviale à battre

- `matin-23` : **16 ★ sur 27**, soit P(★) = 0,593 pour chaque grille.
- **Après la session**, calculer le score de Brier : moyenne de (P − ★)², avec ★ = 1 ou 0.
  - Mes prédictions : Brier = … (à remplir).
  - Référence 0,593 : Brier = … (à remplir).
  - Une hypothèse n'est retenue que si ses prédictions battent la référence.
- Ressenti : comparer aussi les justes à « toujours 1 ».

</details>
