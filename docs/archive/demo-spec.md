# Spot-Élec — spécification du jeu de démo

Référence de conception : `depth-study.md` (pièces à forme, échelle des mécaniques). Données : `demo/grids.json` (8 grilles vérifiées par force brute, solution de référence incluse). Ce document fixe les règles exactes que le moteur doit appliquer.

## 1. Modèle

- **Grille** : `columns.length` créneaux (colonnes). Les lignes sont numérotées à partir de 0 en bas.
- **Demande résiduelle** `residual[c]` : demande − fil de l'eau − renouvelables. Elle peut être négative (surplus de renouvelables).
- **Hauteur à paver** de la colonne *c* :
  `h[c] = residual[c] + exports[c] + pumps[c] − turbines[c]`.
  Si `h[c] < 0`, le déficit est **écrêté** : `curtail[c] = −h[c]` (autorisé seulement si `curtail_penalty` est défini, sinon la grille est invalide) et la hauteur effective vaut 0.
- **Pièces** (`pieces`, clé = id) : barre horizontale d'une longueur prise dans `len`, coût `cost` par case, `co2` par case, `cap` optionnel = nombre total de **cases** utilisables.
  - Ids possibles : `N` nucléaire, `C` charbon, `G` gaz CCG, `T` TAC, `B` barrage.
  - `I` import : pièce implicite de longueur 1, présente si `neighbor.import`. Coût = `neighbor.price[c]`, CO₂ 0.
- **Voisin** (`neighbor`, optionnel) : `price[c]` par créneau, `cap` = capacité de la ligne par créneau.
  - Export : le joueur règle `exports[c]` de 0 à `cap` si `neighbor.export`. Chaque bloc exporté ajoute une case à paver et **rapporte** `price[c]` (un prix négatif coûte).
  - Contrainte de ligne : `exports[c] + (nombre de cases I dans la colonne c) ≤ cap`.
- **STEP** (`step`, optionnel = nombre de paires) : une paire = un créneau de pompage *p* et un créneau de turbinage *t* avec `p < t`. Le pompage ajoute 1 à `h[p]`, le turbinage retire 1 à `h[t]`. Rendement 1, pas de coût propre.
- **Plafond CO₂** (`co2_cap`, optionnel).

## 2. Validité d'une pose

Une barre (pièce, ligne r, colonne c, longueur L) est valide si :
1. `L` ∈ `pieces[id].len` et `c + L ≤ nombre de colonnes` ;
2. pour toute colonne k de c à c+L−1 : `r < h[k]` (sous la silhouette) et la case est libre ;
3. le total de cases de cette pièce ne dépasse pas `cap` ;
4. pour `I`, la contrainte de ligne reste respectée.

Quand le joueur change un export ou une STEP, la silhouette bouge. Les barres qui en sortent ne sont **pas supprimées** : elles sont marquées invalides (rouge) et la grille ne peut pas être complète tant qu'elles restent.

## 3. Grille complète, scores, étoiles

- **Complète** : toutes les cases `r < h[c]` sont couvertes, aucune barre invalide, aucune contrainte violée (caps, ligne, STEP, écrêtement autorisé), `CO₂ ≤ co2_cap`.
- **Coût** = Σ coûts des cases posées (I au prix du créneau) + Σ `curtail[c] × curtail_penalty` − Σ `exports[c] × price[c]`.
- **Facture** = Σ sur les colonnes de `h[c] × (prix de la case la plus chère de la colonne)`, avec le prix de I = `price[c]` ; une colonne de hauteur 0 compte 0.
- **CO₂** = Σ co2 des cases posées.
- **Étoiles** : ★ grille complète ; ★★ et coût = `optimum.cost` ; ★★★ et facture = `optimum.facture`. Afficher l'écart à l'optimum (« coût : 1 120, optimum 980 ») dès que la grille est complète.
- À ★★★ : afficher `lesson`.

Les optimums de `grids.json` ont été calculés avec exactement ces formules. Test de non-régression : appliquer `solution` (exports, step, placements) doit redonner `optimum.cost`, `optimum.facture` et `optimum.co2`, avec la grille complète.

## 4. Interface attendue

- **Liste des 8 grilles** (titre, paliers, étoiles obtenues), grille 1 sélectionnée par défaut. Progression gardée en `localStorage` (accès dans un try/catch ; la page fonctionne sans).
- **En-tête de grille** : titre, texte `intro`, rappel des règles actives (palette).
- **Palette** : une tuile par pièce (couleur, lettre, longueurs autorisées, €/case, CO₂/case, cases restantes si `cap`), plus les outils Gomme, Export (si autorisé), STEP (si `step`).
- **Grille** :
  - colonnes étiquetées (`columns`), cases à paver bien visibles (silhouette), cases au-dessus de la silhouette estompées ;
  - surplus (`residual < 0`) signalé sous la colonne ;
  - sous chaque colonne, si voisin : prix voisin, et contrôles d'export (− / +) avec l'usage de la ligne (`exports + imports / cap`) ;
  - STEP : clic sur l'outil, puis sur le créneau de pompage, puis sur celui de turbinage ; affichage d'une flèche ou d'un repère ▲/▼ ; un nouveau clic sur un repère retire la paire.
- **Poser une barre** : appui sur une case puis glisser le long de la ligne et relâcher, **ou** toucher une case de départ puis une case d'arrivée sur la même ligne (pour le mobile). Aperçu en direct (vert si valide, rouge sinon, avec la raison).
- **Retirer** : Gomme puis clic sur une barre, ou clic droit sur une barre.
- **Panneau de score** en direct : coût, facture, CO₂ (et plafond), cases restantes, liste des erreurs en français clair (« La barre N doit faire 3 à 6 créneaux », « Ligne saturée à 16h »…).
- Boutons : Recommencer, Voir la solution (applique la solution de référence, sans étoiles), grille suivante.
- Couleurs : N jaune, C brun foncé, G orange, T rouge, B bleu, I violet ; export hachuré ; écrêtement grisé barré.

## 5. Contraintes techniques

- Fichiers dans `demo/` :
  - `engine.js` : moteur **pur** (pas de DOM), utilisable dans le navigateur (global `SpotEngine`) et dans Node (`module.exports`) : hauteurs, validité d'une pose, état complet, coût, facture, CO₂, étoiles, liste d'erreurs ;
  - `grids.js` : `grids.json` exposé tel quel (global `SPOT_GRIDS` et `module.exports`), généré depuis `grids.json` sans le modifier ;
  - `index.html` : l'interface, charge `grids.js` et `engine.js` par chemins relatifs ;
  - `test_engine.js` : tests Node (`node demo/test_engine.js`) : pour les 8 grilles, la solution redonne les optimums ; plus des cas invalides (barre trop courte, hors silhouette, cap dépassé, ligne saturée, STEP inversée, CO₂ dépassé).
- Pas de framework ni de build ; aucune dépendance externe (si besoin, uniquement cdnjs.cloudflare.com avec version exacte).
- Contrat de page : `<title>` de 2 à 4 mots (« Spot-Élec démo »), couleurs en variables CSS sur `:root`, thème sombre via `@media (prefers-color-scheme: dark)` sur `:root:not([data-theme="light"])` et sur `:root[data-theme="dark"]`, `body` avec un fond explicite, utilisable sur mobile (marge latérale 16 px, pas de défilement horizontal de la page ; la grille peut défiler dans son propre conteneur).
- Code, noms et commentaires en anglais ; textes affichés en français.

## 6. Les 8 grilles (résumé, détail dans `grids.json`)

| # | Titre | Paliers | Taille | Optimum coût / facture | Leçon |
|---|---|---|---|---|---|
| 1 | Premier programme | 0-1 | 4 × 4 | 530 / 530 | le gaz se concentre dans la plus petite colonne |
| 2 | Les rubans | 2 | 6 × 3 | 1 850 / 5 210 | un creux coupe les rubans |
| 3 | La pointe isolée | 3 | 6 × 7 | 5 020 / 12 300 | la pointe isolée exige des TAC |
| 4 | L'eau comptée | 4 | 6 × 7 | 2 620 / 7 400 | l'eau va là où elle évite que la TAC fixe le prix |
| 5 | Pomper la nuit | 5 | 8 × 5 | 530 / 1 090 | pomper pour créer un ruban en haut de la pointe |
| 6 | Trop de soleil | 6-8 | 6 × 4 | 970 / 2 130 | exporter le surplus, prolonger les rubans |
| 7 | La montagne | 2-5 | 8 × 7 | 980 / 2 340 | un pompage relie deux pointes |
| 8 | Plafond carbone | 2-3, 7-9 | 8 × 6 | 1 970 / 3 850 (CO₂ 10) | le plafond CO₂ remplace le charbon par du gaz |

Chaque grille a une seule composition optimale au sens (coût, puis facture), vérifiée par un script exhaustif (plusieurs dessins peuvent donner la même composition ; le moteur juge les nombres, pas le dessin).
