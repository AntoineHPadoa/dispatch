# Spot-Élec — mode « puzzle de pose » (mode par défaut)

On déduit, on ne calcule pas. Plus de score par défaut : chaque grille a **une seule pose possible**, comme un Sudoku ou un Kakuro. Le score cible reste un mode à part (`scoring-v2.md`).

Les règles de pose ne changent pas (`demo-spec.md` §1-2) : barres horizontales sous la silhouette, sans trou ni chevauchement ; export, import, STEP et écrêtement modifient la silhouette comme avant.

## 1. Les trois contraintes d'une grille

1. **Paver exactement la silhouette**, comme avant.
2. **Poser tout l'inventaire, ni plus ni moins.** L'inventaire, c'est le carnet d'ordres du jour : les centrales appelées.
3. **Respecter les indices de prix.** La bourse publie le prix de certains créneaux. Prix d'un créneau = prix de sa case la plus chère (barème v2 : N 0, B 1, C 1, G 2, T 5, import = prix du voisin à ce créneau ; 0 si la colonne n'a rien à paver).

Contraintes optionnelles de la grille, qu'on vérifie d'un coup d'œil : `co2_cap` (compter des cases), STEP (nombre de paires imposé), exports et imports (voir l'inventaire).

## 2. Inventaire : trois niveaux de difficulté

| Niveau | `inventory.level` | Ce que le joueur sait | Exemple affiché |
|---|---|---|---|
| Facile | `exact` | la longueur de chaque barre | N 6, 6, 5 · G 2, 2 · T ×5 |
| Moyen | `bars` | le nombre de barres et de cases par techno | N : 3 barres, 17 cases · G : 2 barres, 4 cases · T : 5 |
| Difficile | `cells` | seulement le nombre de cases par techno | N 17 · G 4 · T 5 |

Pour les pièces d'une case (T, B, import), les trois niveaux disent la même chose : un nombre de cases.

**Échanges et stockage** dans l'inventaire :
- `exports` : nombre total de blocs à exporter, par pays (le créneau est à déduire) ;
- `imports` : nombre total de cases importées, **par pays** ou **tous pays confondus** (`"I": 3`). Dans le second cas, un plafond CO₂ peut forcer le choix du pays : c'est là que le CO₂ par pays reste une vraie décision ;
- `step` : nombre exact de paires pompage/turbinage ;
- écrêtement : interdit en mode pose (la grille fournit assez d'export pour absorber un surplus), pour garder des grilles lisibles.

## 3. Indices de prix

`price_clues` : une valeur par créneau, ou `null` si le prix n'est pas publié. Un indice publié est une contrainte : la case la plus chère de la colonne a exactement ce prix.

Le nombre d'indices est le **second réglage** de difficulté : moins il y en a, plus il faut déduire.

## 4. Unicité

Une grille est publiable si une seule **composition** satisfait toutes les contraintes : pour chaque colonne, le nombre de cases par pièce (imports par pays), plus les exports par créneau et par pays, plus les STEP. Deux dessins de même composition (échanger deux rubans de ligne) comptent pour une seule solution. Le joueur vérifie au corrigé une ligne de compositions ou de prix.

## 5. Générateur : indices minimaux

Pour un niveau d'inventaire donné :

1. Tirer une silhouette et un parc (comme aujourd'hui), et calculer une pose de référence plausible, par exemple la pose de score v2 minimal, pour que la solution « ait du sens » thématiquement.
2. En déduire l'inventaire au niveau demandé.
3. Chercher le **plus petit ensemble d'indices de prix** qui rend la composition unique : partir de zéro indice ; tant qu'il y a plusieurs solutions, révéler un créneau où deux solutions diffèrent (choisir celui qui élimine le plus de solutions) ; puis tenter de retirer chaque indice un par un en gardant l'unicité.
4. Rejeter la grille si elle demande plus de `max_clues` indices (par défaut la moitié des créneaux) : sinon le puzzle se résume à recopier des prix.
5. Difficulté proposée : niveau d'inventaire (facile 0, moyen 3, difficile 6) + 2 × (créneaux sans indice / créneaux) × 5 + mécaniques actives. La formule est à ajuster sur les tirages.

Mesures attendues sur quelques centaines de tirages par niveau : taux de grilles publiables, nombre moyen d'indices, temps.

## 6. Format de grille « pose »

```json
{
  "mode": "pose",
  "residual": [2, 4, 6, 3, 7, 4],
  "pieces": {"N": {"len": [3,4,5,6], "price": 0, "co2": 0},
             "G": {"len": [2,3], "price": 2, "co2": 1},
             "T": {"len": [1], "price": 5, "co2": 2}},
  "inventory": {
    "level": "exact",
    "pieces": {"N": {"bars": [6, 6, 5]}, "G": {"bars": [2, 2]}, "T": {"cells": 5}},
    "exports": {"X": 0},
    "imports": {},
    "step": 0
  },
  "price_clues": [0, 2, 5, 0, null, 2],
  "constraints": {"co2_cap": null},
  "solution": {"exports": [...], "step": [...], "placements": [...]}
}
```

Selon le niveau, `inventory.pieces[id]` vaut `{"bars": [6,6,5]}` (exact), `{"count": 3, "cells": 17}` (moyen) ou `{"cells": 17}` (difficile).

## 7. Exemple (illustratif, à vérifier par le solveur)

Grille « pointe isolée », demande résiduelle 2 4 6 3 7 4, niveau facile :

```
 Inventaire : N 6, N 6, N 5 · G 2, G 2 · T ×5
 Prix publiés :  0   2   5   0   ?   2

  7 |             T
  6 |       T     T
  5 |       T     T
  4 |    G──G     G──G
  3 |    N──N──N──N──N
  2 | N──N──N──N──N──N
  1 | N──N──N──N──N──N
      0h  4h  8h 12h 16h 20h
```

Déduction : les deux barres de 6 ne tiennent qu'en lignes 1 et 2 ; la barre de 5 ne peut pas inclure 0h (hauteur 2), donc elle va de 4h à 20h en ligne 3 ; la ligne 4 est coupée par le creux de 12h, d'où un G de chaque côté ; restent 5 cases isolées pour 5 TAC, et l'indice « 5 » à 8h le confirme.
