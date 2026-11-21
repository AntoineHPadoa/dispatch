# Dispatch

Un puzzle de logique sur le réseau électrique. Tu construis le programme d'appel d'une journée : remplis exactement la courbe de demande avec des centrales (un rectangle par centrale : sa largeur est sa durée de marche, sa hauteur sa puissance), en respectant le carnet d'ordres et les indices du marché. Une seule solution, aucun calcul : on déduit, comme au Sudoku. Chaque grille s'imprime sur une page A4.

**Jouer en ligne** : https://antoinehpadoa.github.io/dispatch/

## Développer

```bash
cd web
npm ci
npm run dev     # http://localhost:5173/dispatch/
npm test
```

Règles du jeu et format des grilles : [`GAME-DESIGN.md`](GAME-DESIGN.md). Le solveur et générateur de grilles (Python) est dans [`solver/`](solver/README.md).

## Publier

Chaque push sur `main` lance les tests, construit le site et le publie sur GitHub Pages (`.github/workflows/deploy.yml`).
