# Spot-Élec — score v2 et objectifs du jour

Remplace le duo coût/facture de `demo-spec.md` (§3) par un score jouable au crayon. Les règles de pose (pièces, silhouette, export, import, STEP, écrêtement) ne changent pas.

## 1. Barème en petits entiers

Les chiffres sont **inspirés** du réel (l'ordre est respecté : nucléaire < eau ≈ charbon < gaz < TAC), pas fidèles.

| Pièce | Prix | CO₂ / case | Forme |
|---|---|---|---|
| N nucléaire | 0 | 0 | barre de 3 à 6 (ou selon la grille) |
| B barrage | 1 | 0 | 1 case, stock limité |
| C charbon | 1 | 3 | barre de 3 à 5 |
| G gaz CCG | 2 | 1 | barre de 2 à 3 |
| T TAC | 5 | 2 | 1 case |
| I import | prix voisin du créneau (−2 à 5) | 0 | 1 case |

Prix voisin : un entier par créneau, de −2 (surplus chez le voisin) à 5.

## 2. Le score en une phrase

> **Chaque créneau vaut le prix de sa case la plus chère. Score = somme des créneaux − recettes d'export + pénalités d'écrêtement. Le plus bas gagne.**

- Prix de créneau = max des prix des cases posées dans la colonne ; 0 si la colonne n'a rien à paver.
- Recette d'export = prix voisin du créneau, par bloc exporté (un prix voisin négatif coûte).
- Écrêtement = `curtail_penalty` par case (2 par défaut).
- CO₂ = somme des CO₂ des cases (sert aux contraintes, pas au score).

Sur papier, le joueur écrit un chiffre sous chaque colonne et additionne une dizaine de petits nombres.

**Export rentable**, la mécanique que tu voulais : un bloc exporté ajoute une case à paver, mais si cette case ne fait pas monter le prix du créneau (elle prolonge un ruban N à 0, par exemple), la recette fait baisser le score. Exporter n'est plus un moyen de combler un créneau, c'est un gain.

### Correctifs après les premiers tirages du solveur (S5.4)

Le solveur a montré que l'export dominait (scores de −40 à −100) et que 70 à 97 % des grilles tirées avaient plusieurs solutions. Règles corrigées :

1. **Budget d'export journalier** : en plus de la capacité par créneau, chaque voisin a `export_budget` = nombre total de blocs exportables sur la journée (2 par défaut). Les prix voisins restent entre −2 et 3 ; 4 et 5 sont réservés aux pointes exceptionnelles.
2. **Départage** : à score égal, la solution qui échange le **moins de blocs** avec les voisins (imports + exports) l'emporte. Sur papier : « ne commerce pas pour rien ».
3. **Unicité jugée sur le programme visible** : une solution se résume à **la ligne des prix de créneau + les échanges (imports et exports par créneau et par pays) + les STEP + l'écrêtement**. Ce qu'il y a sous la case la plus chère d'une colonne ne compte pas (N, C ou G dessous donnent le même prix). Une grille est publiable si, sous son objectif et après départage, un seul programme visible est optimal. C'est aussi ce que le joueur vérifie au corrigé : une ligne de chiffres.

### Correctif 2 : départage par le coût (S7, remplace le point 3 ci-dessus)

Avec « prix = max de la colonne », les cases sous la plus chère étaient gratuites : on pouvait y gâcher des TAC sans perte, et deux dessins dont un absurde passaient pour la même solution.

4. **Coût** = somme des prix de **toutes** les cases posées (imports au prix voisin du créneau). Sur papier : une addition sur les seules cases colorées.
5. **Ordre de départage** : score, puis coût, puis nombre de blocs échangés. Tous les trois sont minimisés (pour `target` : score = cible, puis coût, puis échanges).
6. **Unicité sur la composition** : une grille est publiable si, après ces départages, une seule **composition** est optimale : pour chaque colonne, le nombre de cases par pièce (et par pays pour les imports), plus les exports, les STEP et l'écrêtement. Le dessin des barres à composition égale ne compte toujours pas.

## 3. Ce qu'on perd, ce qu'on gagne

- **On perd** : le duo coût/facture et donc la leçon « le coût réel (800) n'est pas la facture (2 240) ». Le glossaire peut la garder comme explication du score.
- **On garde** : la leçon centrale, le prix marginal. Une seule case de TAC fait passer un créneau de 0 à 5.
- **On gagne** : un score calculable de tête, et des égalités plus fréquentes, qui deviennent un levier de conception (voir §4).
- **Risque, que tu as relevé** : trop simple. Réponse : la difficulté vient de la géométrie et des objectifs ci-dessous, pas du calcul. Le solveur (S5.4) mesurera si les grilles restent riches (nombre de solutions proches de l'optimum, nombre de pièces contraintes).

## 4. Catalogue d'objectifs du jour

Un objectif = une **optimisation** + zéro, une ou plusieurs **contraintes**. Les bons objectifs changent la forme de la solution, pas seulement le chiffre.

| Objectif | Énoncé joueur | Ce que ça change | Type |
|---|---|---|---|
| **Score minimal** | « Fais le plus petit score. » | Objectif par défaut | optimisation `min_score` |
| **Score cible** | « Fais exactement 9. » | Il faut trouver *la* configuration qui tombe juste ; on élimine des pistes par le haut et par le bas, comme au Kakuro. Rend l'unicité plus facile à obtenir. | optimisation `target` |
| **Prix plafond** | « Aucun créneau au-dessus de 2. » | Interdit la TAC (5) partout ; force l'eau, le stockage ou l'export à couvrir les pointes. | contrainte `price_cap` |
| **Plafond CO₂** | « 10 CO₂ au plus. » | Charbon contre gaz : change les longueurs de barres utilisables. | contrainte `co2_cap` |
| **Souveraineté** | « Aucun import. » | Les pointes doivent se couvrir chez soi : TAC, eau, STEP. | contrainte `no_import` |
| **Prix lisse** | « Deux créneaux voisins ne diffèrent pas de plus de 2. » | Interdit une TAC isolée entre deux créneaux à 0 ; oblige à « monter en pente » (gaz avant et après). | contrainte `smooth` |

Écarté : le « mode producteur » (maximiser les recettes d'export). Avec ce score, il se confond avec le score minimal, puisque l'export y est déjà une recette. Le concept G reste à part.

Combinaisons recommandées pour les grilles difficiles : score minimal + prix plafond + CO₂ ; score cible + souveraineté ; score minimal + prix lisse.

## 5. Format de grille v2 (pour le solveur et la démo)

Changements par rapport à `demo/grids.json` v1 :

```json
{
  "pieces": { "N": {"len": [3,4,5,6], "price": 0, "co2": 0},
              "G": {"len": [2,3], "price": 2, "co2": 1},
              "B": {"len": [1], "price": 1, "co2": 0, "cap": 3} },
  "neighbor": {"name": "Allemagne", "price": [0,0,1,2,2,5,3,1], "cap": 1, "import": true, "export": true},
  "curtail_penalty": 2,
  "objective": {
    "optimize": "min_score",
    "target": null,
    "constraints": {"price_cap": 2, "co2_cap": 10, "no_import": true, "smooth": 2}
  },
  "optimum": {"score": 7, "co2": 10},
  "solution": { "exports": [...], "step": [...], "placements": [...] }
}
```

- `cost` devient `price` ; `optimum` ne contient plus que `score` et `co2`.
- **Plusieurs voisins (S6.1)** : `neighbors` remplace `neighbor` et devient une liste. Chaque voisin a `id` (ex. `"DE"`), `name`, `price` (par créneau), `cap` (par créneau, propre à sa ligne), `import`, `export`, et **`co2`** = CO₂ par case importée de ce pays (ex. DE 2, UK 1, FR 0), compté dans le plafond CO₂. L'export ne compte pas de CO₂. Une case importée se note avec l'id du pays (`"I:DE"`) dans les placements ; les exports deviennent `exports: {"DE": [...], "UK": [...]}`. Un ancien `neighbor` unique se lit comme une liste d'un voisin `"X"` avec `co2: 0`.
- Contraintes absentes = non actives.
- **Unicité** : une grille est publiable si, sous son objectif, une seule **composition** est optimale (pour `target` : une seule composition atteint la cible). La composition = pour chaque colonne, le nombre de cases par pièce, plus les exports, les STEP et l'écrêtement. Le dessin des barres ne compte pas.

## 6. La grille 8 rejouée au nouveau barème

Prix voisins convertis : `0 0 1 2 2 5 3 1`. La solution de référence v1 (CO₂ ≤ 10) donne :

```
 Créneau      0h  3h  6h  9h  12h 15h 18h 21h
 Cases      I N I N I NNN G I NNN G I NN GGGG NN GGGG NN I NN
 Prix        0   0   1   2   2   2   2   1      = 10
 Export                              1 bloc à 3       −3
 Score                                              =  7      CO₂ 10
```

Ce n'est pas forcément l'optimum au nouveau barème : le solveur (S5.4) le recalculera, et S5.2 recalibrera les grilles.
