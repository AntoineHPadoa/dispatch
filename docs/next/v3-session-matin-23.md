# Session du 23 novembre

- **27 grilles**, environ **50 min à 1 h 15** de jeu (7 grilles dures de v3g3, 8 rampes, 12 grilles v3g4 A/B/C).
- **Lancer** : relancer `lab/run.sh`, ouvrir http://localhost:5173/dispatch/lab.html, choisir « Joueur 1 », onglet « Session », puis « Session du 23 novembre ».
- **Grille 6** (b n°1) est déjà résolue : « Jouer la suivante » la saute. Clique « Rejouer » sur sa ligne pour donner enfin son ressenti.

## À chaque grille

- Le ressenti (1 à 4), sans regarder le temps.
- Un mot : **belle / pas belle, et pourquoi**.
- ★ si tu la garderais.

## La rampe (8 grilles, la 1re dès le début)

- Dans le jeu, c'est la **barre de charbon à paliers** : forme 1-2-1, une base de 3 à 5 créneaux et un plateau d'une case de haut au-dessus, sans les deux bouts (les bords).
- **Pose** : comme une barre. Touche la case de la **base**, glisse jusqu'à la largeur voulue (ou deux tapes, début et fin). Le plateau se dessine tout seul au-dessus.
- Une largeur de 1 ou 2 créneaux est refusée (aperçu rouge).

<details>
<summary>Ce que teste chaque grille, et ma prédiction (à n'ouvrir qu'après la session)</summary>

Notes A du solveur : F Facile, M Moyen, D Difficile, E Expert. K : compacité. « Couplée » : STEP ou CO₂ qui joue avec un échange. Prédiction : ressenti de Joueur 1, puis ★ ou non.

| # | Grille | Note | Cr. | Ce qu'elle teste | Prédiction |
|---|---|---|---|---|---|
| 1 | rampe n°16 | F | 8 | apprendre la rampe : une seule, posée après « le plateau barre la ligne » | 1, pas ★ |
| 2 | jouer-c n°10 | M | 8 | K haut (0,88) sans couplage : 5 échanges + pièce haute | 2, ★ |
| 3 | rampe n°6 | F | 12 | Facile à 7 décisions (5 échanges, 2 rampes) : A la sous-note-t-elle ? | 2, ★ |
| 4 | jouer-a n°5 | E | 8 | couplée STEP + CO₂, K 1,00 | 3, ★ |
| 5 | jouer-c n°18 | M | 8 | globale **sans** échange (STEP + CO₂), K 0,75 | 1, ★ |
| 6 | v3g3-b n°1 | E | 8 | rejeu (85 s sans ressenti) : couplée STEP + CO₂, 5 échanges | 2, déjà ★ |
| 7 | jouer-a n°2 | F | 8 | Facile STEP + stock : le stock sert-il ? | 1, pas ★ |
| 8 | v3g3-b n°14 | D | 6 | courte couplée STEP + pièce haute | 2, ★ |
| 9 | jouer-c n°2 | F | 6 | Facile courte, K 0,67 : « courte et nette » | 1, ★ |
| 10 | jouer-a n°19 | M | 8 | globale sans échange, K 0,86 ; à comparer à la 24 | 1, ★ incertaine |
| 11 | rampe n°17 | F | 6 | rampe sans indice, 3 étapes | 1, pas ★ |
| 12 | jouer-c n°6 | M | 12 | jumelle 1 (pièce haute + CO₂) ; sa sœur est la 26 | 1, pas ★ |
| 13 | v3g3-b n°13 | E | 8 | couplée STEP + CO₂, un seul échange | 3, ★ |
| 14 | rampe n°10 | M | 8 | les techniques de rampe (plateau ×2, bord ×1) servent | 2, ★ |
| 15 | v3g3-a n°5 | E | 8 | couplée STEP + CO₂, K 0,46 | 2, ★ |
| 16 | jouer-a n°16 | M | 8 | frontière F/M : Moyen à une seule pièce haute, K 0,22 | 1, pas ★ |
| 17 | rampe n°14 | D | 8 | rampe + STEP couplée + prix, 4 échanges | 3, ★ |
| 18 | v3g3-b n°12 | E | 8 | couplée STEP + CO₂, K 0,64 | 3, ★ |
| 19 | jouer-a n°14 | M | 8 | frontière F/M et K bas : 3 échanges seuls, K 0,19 | 1, pas ★ |
| 20 | rampe n°1 | E | 8 | rampe la plus dense (K 1,86) : couplée STEP + CO₂, 2 rampes | 3, ★ |
| 21 | v3g3-a n°6 | D | 8 | couplée STEP, 4 échanges, 2 voisins | 2, ★ |
| 22 | rampe n°20 | M | 12 | 4 rampes, forme du relais (la technique n'est pas requise) | 2, ★ |
| 23 | v3g3-a n°16 | D | 8 | couplée CO₂ + pièce haute, 4 échanges, K 1,00 | 3, ★ |
| 24 | jouer-a n°3 | M | 8 | couplée STEP, K 0,78 : même note et même K que la 10, mais couplée | 2, ★ |
| 25 | jouer-b n°5 | D | 6 | courte couplée STEP + pièce haute, K 1,29 | 2, ★ |
| 26 | jouer-c n°7 | M | 12 | jumelle 2 : la reconnais-tu ? | 1, pas ★, « déjà vue » |
| 27 | rampe n°11 | D | 8 | rampe donnée par sa durée de marche (non comptée comme décision) | 2, ★ incertaine |

**Ce que la session doit trancher**

- **Frontière F/M de A** : les Moyens 16, 19, 12, 26 (une décision lourde, K bas) contre les Faciles 7, 9, 3. Si les Moyens sont ressentis 1, A est un cran trop haut : baisser la frontière.
- **Seuil de K** : à note égale, 2 et 24 (K ≥ 0,78) contre 16 et 19 (K ≈ 0,2). Je prédis le ★ au-dessus de 0,5, aucun sous 0,25.
- **Couplée contre globale sans échange** : 24 contre 10 (même note, même K), et 5. Je prédis 24 plus dure (2 contre 1) : c'est le couplage, pas la mécanique seule, qui fait le ressenti.
- **Jumelles** : 12 et 26, 14 grilles d'écart. Si 26 est vue comme une redite, il faut une règle sur (entrée, famille).
- **Rampe** : 1, 11, 3 Faciles d'abord, puis Moyen, Difficile, Expert. Je prédis la rampe ressentie comme une grande barre à placer : ★ si d'autres décisions l'entourent (3, 14, 17, 20), pas ★ seule (1, 11).
- **Dures v3g3** (6 grilles nouvelles) : toutes couplées. Je prédis 2 à 3, toutes ★ : elles fondent le « ★ si couplée ».

**Choix faits**

- Ordre à graine fixe (23) : une rampe Facile d'abord, la 2e rampe Facile aussi, les rampes Difficile et Expert après 4 autres ; grilles 2 et 3 Facile ou Moyen ; jamais deux fois de suite le même lot, la même note, deux 12 créneaux ou deux rampes ; jumelles à 14 places d'écart.
- Aucune grille déjà jouée par Joueur 1, sauf b n°1, rejouée exprès pour son ressenti.
- Peu de B (1 grille) : 14 grilles sur 20 y ont un échange.

</details>
