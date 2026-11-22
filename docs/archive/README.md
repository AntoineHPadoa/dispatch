# Archive

Superseded by `GAME-DESIGN.md` and `web/`; kept for reference only.

- `demo/` : prototype jouable en JS pur ; `demo/grids-pose.json` est la source des grilles converties par `web/scripts/convert-grids.ts`, `demo/grids.json` servait aux tests v1 de l'ancien solveur.
- `demo-spec.md` : règles et interface du prototype (coût, facture, étoiles).
- `pose-mode.md` : premier cahier du mode « pose » (inventaire à trois niveaux, indices de prix en valeur).
- `scoring-v2.md` : score v2 et objectifs du jour, abandonnés (le jeu n'a plus de score).
- `depth-study.md` : étude de profondeur du concept (pièces à forme, échelle des mécaniques).
- `gameplay-ideas.md` : idées de gameplay de départ.
- `maquettes/` : maquettes HTML terminées de la v2 (labo, menu et bulletin, variantes du logo, planche des grilles de rampe).
- `solver-v1/` : ancien solveur Python (`spot_solver`, format « pose » du prototype, modes à score v1, v2 et cible, déduction sans totaux d'échanges inconnus), ses tests, exemples et README avec ses mesures. Remplacé par `solver/` (`dispatch_solver`). Non exécuté par la CI.
