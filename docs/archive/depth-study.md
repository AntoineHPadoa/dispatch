# Spot-Élec — étude de profondeur du concept A

Objectif : transformer le « Tetris des pixels » (concept A de `gameplay-ideas.md`) en un jeu qui apprend ses mécaniques une à une, puis les combine en grilles difficiles.

## 1. Le constat : en cases libres, A se résout tout seul

Dans A, une colonne n'est qu'un **compte** de blocs par techno. Le joueur empile le moins cher d'abord, regarde la rampe du nucléaire, et place l'eau. Une fois le truc compris, chaque grille se résout en une passe gloutonne. Ajouter des barèmes (CO₂, prix du gaz) change les nombres, pas le raisonnement.

Il faut donc des contraintes qui **interagissent entre colonnes** : c'est ce qui force à anticiper, à revenir en arrière, à voir la grille comme un tout.

## 2. La piste : des pièces à forme sur la courbe résiduelle

### Principe

- La grille ne montre plus la demande brute mais la **demande résiduelle** : demande − fil de l'eau − ENR (fixés par la météo). C'est une silhouette (skyline) qu'il faut paver exactement, sans trou ni débordement.
- Chaque techno pilotable est une **pièce horizontale** dont la longueur traduit une contrainte physique :

```
 N  nucléaire   ▬▬▬▬▬▬  barre de 3 à 6 créneaux   10 €/case   « un réacteur ne s'arrête pas pour 4 h »
 G  CCG gaz     ▬▬      barre de 2 à 3 créneaux  150 €/case   « durée minimale de marche »
 T  TAC         ▪       1 case                    850 €/case   « démarre vite, coûte cher »
 B  barrage     ▪       1 case, stock limité       50 €/case   « l'eau est comptée »
```

- Une barre posée à la ligne *r* exige que la demande résiduelle soit ≥ *r* sur toute sa longueur. **La géométrie encode donc la physique** : le bas de la silhouette est la base (rubans de nucléaire), le haut est la pointe (pièces courtes et chères). Une pointe isolée, qu'aucune barre ne peut atteindre, ne se comble qu'avec des pièces de 1 case.

### Exemple : la même grille en cases libres et en pièces

Demande résiduelle (blocs) sur 6 créneaux de 4 h : **2 4 6 3 7 4** (c'est la grille A une fois F et R retirés). Stock d'eau : 3.

```
 CASES LIBRES (concept A, rampe N ±1, N ≤ 4)     PIÈCES À FORME
                                                 (N barre 3-6, G barre 2-3, T 1, B 1)
  7 |             G                                7 |             B
  6 |       B     G                                6 |       T     B
  5 |       B     G                                5 |       T     B
  4 |    B  N     N  N                             4 |    G──G     G──G
  3 |    N  N  N  N  N                             3 |    N──N──N──N──N
  2 | N  N  N  N  N  N                             2 | N──N──N──N──N──N
  1 | N  N  N  N  N  N                             1 | N──N──N──N──N──N
      0h 4h 8h 12h16h20h                               0h 4h 8h 12h16h20h
  Coût 800 · Facture 2 240                        Coût 2 620 · Facture 7 400
  Aucune TAC                                       2 TAC, forcées par la forme
```

Ce que la version à pièces fait raisonner (et que les cases libres ignorent) :

1. **Les rubans d'abord.** Deux lignes de 6 et une de 5 : le nucléaire couvre toute la base, mais la ligne 3 ne peut pas inclure 0 h (demande 2).
2. **La ligne 4 est coupée par le creux de 12 h** (demande 3). À gauche, les cases 4 h-8 h forment une barre G de 2 ; à droite, 16 h-20 h aussi. Pas de nucléaire : il faudrait 3 créneaux consécutifs.
3. **Deux pointes isolées** : 8 h (lignes 5-6) et 16 h (lignes 5-7). Le creux de 12 h les sépare, aucune barre ne les relie. Il faut 5 cases de 1 : 3 B et 2 T.
4. **Où mettre l'eau ?** Le coût est le même (2 620) que l'eau aille à 8 h ou à 16 h. La facture tranche : à 16 h, l'eau permet d'éviter que la TAC fixe le prix de la colonne la plus chargée. Mettre B à 16 h donne 7 400 contre 8 100 ou 12 300 pour les deux autres placements.

**La leçon émerge sans être écrite dans les règles** : une pointe courte et isolée coûte très cher, parce que seules les centrales de pointe peuvent la suivre. C'est le cœur de la vidéo 2 (« le nucléaire ne fait pas de dentelle », « on a toujours besoin du thermique pour coller à la demande »).

Vérification : script de branch-and-bound jetable. Optimum de coût 2 620, 3 compositions distinctes, une seule à la facture minimale (7 400).

### Ce que coûte la piste (risques)

- **Plusieurs dessins pour une même solution.** On peut échanger deux barres de ligne sans rien changer. La solution se juge donc sur la **composition** de chaque colonne (combien de cases N, G, T, B), pas sur le dessin. Le jeu doit le dire et le vérifier ainsi.
- **Unicité plus dure à garantir.** Sans solveur, chaque grille de démo passera par le script jetable. Pour un puzzle du jour en production, le solveur devient indispensable.
- **Calcul mental plus lourd** pour la facture. Dans l'artifact, le score se calcule en direct ; sur papier, on peut ne garder que le coût dans les premières grilles.

## 3. L'échelle des mécaniques

Un palier = une mécanique nouvelle, introduite seule sur une petite grille, puis réutilisée.

| # | Palier | Règle ajoutée | Nouveau raisonnement | Piège typique | Ancrage vidéo |
|---|---|---|---|---|---|
| 0 | Demande exacte | paver la silhouette, sans trou ni débordement | lire une courbe de charge | dépasser la ligne | « l'électricité ne se stocke pas » |
| 1 | Merit order et facture | coût par case ; prix de colonne = case la plus chère | coût ≠ facture | croire que la facture suit le coût | prix marginal, 850 € le 29/08/2022 |
| 2 | Rubans nucléaires | N = barre de 3 à 6 | la base se joue en lignes entières | un creux casse un ruban | « pas de dentelle » |
| 3 | Gaz et pointe | G = barre de 2 à 3, T = 1 case | les pointes isolées coûtent cher | poser G là où T suffit, ou l'inverse | TAC, CCG, durée de marche |
| 4 | Eau comptée | B = 1 case, stock limité | allouer une ressource rare entre colonnes | dépenser l'eau sur le coût plutôt que sur la facture | valeur de l'eau |
| 5 | Stockage (STEP) | paire pompe / turbine : +1 case à paver en creux, −1 case en pointe | déplacer la demande dans le temps | pomper là où le creux casse un ruban | (extension, hors vidéos) |
| 6 | Surplus ENR | des cases ENR peuvent dépasser la demande : écrêter (pénalité) ou exporter | gérer le trop-plein, prix négatif | laisser un ruban N tourner sous un surplus | prix négatifs |
| 7 | Import | cases achetées au prix voisin, ≤ capacité de ligne par créneau | comparer son coût marginal au prix voisin | importer en creux, où c'est inutile | interconnexions, couplage |
| 8 | Export | demande en plus, payée au prix voisin, ≤ capacité | prolonger un ruban en vendant la nuit | exporter du gaz à perte | « îlots », convergence des prix |
| 9 | Objectif du jour | plafond CO₂ (ou autre), puis coût | arbitrer entre deux critères | optimiser le mauvais critère | concept A bis |
| 10 | Événements | carte qui modifie la grille (panne, froid, sécheresse, ligne coupée) | réparer un programme existant | tout recommencer | RTE au jour J |

### Mini-exemples des paliers 5 à 8 (sur la grille ci-dessus)

```
 STEP (1 paire, rendement 1)                IMPORT / EXPORT (ligne de 1 bloc par créneau)
 Pompe à 0 h : la demande passe de 2 à 3,   Prix voisin :  40  40 300  60 900  40
 la ligne 3 devient un ruban N de 6 (+10).  Import à 16 h à 900 ? Non : la TAC est à 850.
 Turbine à 8 h : remplace une TAC (−850).   Import à 8 h à 300 : remplace la TAC (−550).
 Gain net : 840.                            Export à 0 h à 40 : prolonge le ruban de la
                                            ligne 3 (coût N 10, recette 40 → +30).
  3 | P──N──N──N──N──N                        3 | X──N──N──N──N──N     X = export
      ↑ pompe       ↓ turbine à 8 h               ↑ vendu 40 €, coûte 10 €
```

Ces deux mécaniques rendent la grille **bidirectionnelle** : on ne remplit plus seulement la silhouette, on peut la remodeler (rehausser un creux, raboter une pointe). C'est là que se trouvent les grilles difficiles.

## 4. Ce qui fait une grille difficile

Les combinaisons qui obligent à anticiper :

- **Creux qui coupe un ruban + STEP ou export** : faut-il combler le creux (pompe, export) pour gagner un long ruban N, ou couper et payer du gaz ?
- **Deux pointes isolées + eau insuffisante + import plafonné** : où mettre la TAC inévitable pour que la facture reste basse ?
- **Surplus ENR à midi + ruban N obligatoire** : le nucléaire ne peut pas s'effacer 4 h. Exporter, écrêter ou pomper ?
- **Plafond CO₂ + gaz/charbon en barres de longueurs différentes** : le charbon (moins cher, plus sale) est une barre longue, le gaz une barre courte. Respecter le plafond change la géométrie, pas seulement le barème.
- **Événement en cours de grille** (mode difficile) : la grille est d'abord résolue, puis une carte tombe (panne d'un ruban N à partir de 16 h). Il faut réparer à moindre coût sans tout reposer.

Réglages de difficulté sans nouvelle règle : nombre de colonnes (6 → 8 → 12), hauteur, nombre de creux, stock d'eau, capacité de ligne.

## 5. Écarté, et pourquoi

- **Rendement de STEP réaliste (≈ 75 %)** : demi-cases, calcul pénible sur papier. On garde 1 pour 1, ou 4 pompées pour 3 rendues en mode expert.
- **Pièces verticales ou en L** : jolies en Tetris, mais sans sens physique (une centrale n'a pas de forme verticale). Les pièces restent horizontales : la longueur, c'est la durée.
- **Coût de démarrage séparé** : la longueur minimale des barres l'encode déjà. Un deuxième mécanisme pour la même idée embrouille.
- **Plusieurs pays complets (concept D)** : trop lourd pour une grille A4. L'import/export se résume à un voisin avec une ligne de prix.
- **Marché d'ajustement en temps réel** : c'est le mode événement (palier 10), pas un palier à part.

## 6. Grilles de démo proposées (S4.2, après ton feu vert)

| Grille | Paliers | Taille | Ce qu'elle enseigne |
|---|---|---|---|
| 1 | 0-1 | 4 × 4 | paver, coût vs facture |
| 2 | 2 | 6 × 4 | rubans, le creux qui coupe |
| 3 | 3 | 6 × 6 | la pointe isolée (l'exemple ci-dessus, sans eau) |
| 4 | 4 | 6 × 7 | l'eau se met pour la facture |
| 5 | 5 | 6 × 6 | pomper pour réparer un ruban |
| 6 | 6-8 | 6 × 6 | surplus ENR à midi, export la nuit, import à la pointe |
| 7 | 2-5 combinés | 8 × 8 | grille difficile « montagne » |
| 8 | 2-9 combinés | 8 × 8 | grille difficile avec plafond CO₂ |

Chaque grille aura une solution de référence et sera vérifiée par le script jetable (optimum de coût, puis unicité de la composition à facture minimale).
