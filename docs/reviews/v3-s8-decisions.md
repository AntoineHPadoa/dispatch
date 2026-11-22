# Review — v3-s8-decisions

- Branche : `v3-s8-decisions` (worktree `~/Programs/spot-elec-s8`), commit `452e67d`, auteur `s7`.
- Reviewer : `s6`.

## Verdict : **À corriger**

La partie escalier est correcte et peut être mergée telle quelle. Il faut retirer de la branche le changement du tutoriel 3, que l'humain abandonne.

## Points

1. **Bloquant : retirer le changement de `web/src/data/grids.json`.**
   - L'humain abandonne le changement du texte du tutoriel 3 : les textes de tutoriel relèvent d'un autre chantier.
   - Le commit unique `452e67d` mêle les deux sujets. Il faut retirer le hunk `grids.json` et reformuler le message de commit (« align tutorial 3 intro… » à supprimer).
   - Pour information, le texte proposé était juste : le voisin est bien `DE` / « Allemagne », et le geste (« une case de la rangée de l'Allemagne, sous la grille ») correspond à `UI.hint…` dans `fr.ts:426` (« Exporte en touchant une case de la rangée du voisin, sous la grille ») et à `board.ts` (une rangée par voisin, légendée par `nb.name`). Le diff ne touchait que `intro`, et les ids comme la progression restaient intacts.

2. **OK : l'escalier est refusé avec le même message que le solveur.**
   - `web/src/model/grid.ts:321` : `pieces.<id>.shape: ramps are not enabled`, identique à `solver/src/dispatch_solver/grid.py:447`.
   - Même comportement que Python sans `allow_ramp` : le test passe avant les contrôles « only coal » et « no height », donc une seule erreur. Python fait un `return` au même endroit.
   - Le trapèze reste accepté : les tutoriels 8 et 9 passent `check_unique.py`, et les tests `ramp.test.ts` sur `trap` sont verts.

3. **OK : fixtures et tests.**
   - `reference.test.ts` met à part les fixtures qui contiennent un escalier (`valid-ramp-stair.json` et `valid-ramp-study-E1..E4.json`). Il vérifie qu'elles sont refusées avec le bon message au lieu de les ignorer en silence. Le reste des fixtures est joué comme avant.
   - Nouveau test dans `ramp.test.ts` : un `C` en `stair` est refusé.
   - Aucune grille publiée n'a d'escalier. Le labo refusait déjà de jouer ou de promouvoir un escalier (`lab_server.py:248` et `:573`) : rien ne change de ce côté.

4. **Mineur : `GAME-DESIGN.md` §14.**
   - Le paragraphe sur `shape` et la puce « Un escalier 2 → 1… » plus haut dans le document sont à jour.
   - La phrase récapitulative « Contrôles du validateur : … » plus bas ne cite pas le refus de l'escalier. On peut ajouter « un escalier est refusé » à côté de « une rampe est du charbon… ». Ce n'est pas bloquant, puisque le message est écrit dans le paragraphe sur `shape`.

5. **OK : périmètre.**
   - 5 fichiers : `GAME-DESIGN.md`, `grids.json`, `grid.ts`, `ramp.test.ts` et `reference.test.ts`.
   - Aucun fichier de `web/src/ui/` touché, rien dans `solver/` (et donc rien dans `generate/`).

6. **OK : conventions.**
   - Code, commentaire et commit en anglais.
   - Auteur : l'adresse noreply du repo.
   - Aucune mention de Claude ni d'IA.
   - Nom de branche sans `/`.

## Tests lancés (sur `452e67d`)

- `npm test` : 11 fichiers, 424 tests verts.
- `npm run typecheck` : OK.
- `npm run build` : OK.
- `scripts/check_unique.py` : « OK: every grid is unique and deducible ».
- `solver` `pytest -q` : 186 tests verts (196 s).
- Le worktree n'a pas de `.venv` : j'ai utilisé celui du dépôt principal, en mode éditable. `solver/` n'est pas modifié par la branche, donc le résultat vaut pour elle.
