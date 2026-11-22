# Review — branche `v3-lab-fixes` (R2, R3 de S8 tour 3)

**Verdict : OK à merger.** Aucun point bloquant. Les mineurs ci-dessous peuvent attendre.

Périmètre : `main..v3-lab-fixes`, 1 commit (`088516a`), 8 fichiers, +59 −11.

## Vérifications

- **R2, compte d'indices** : corrigé, et sans copie de la logique du jeu.
  - Le serveur expose `clue_source` (`clues`, `inventory`, `step`). `labClueCount` appelle `shownClueCount` de `ui/panels.ts`, la fonction du jeu.
  - `api.candidates` remplace `clues` par ce compte. Il sert à la fiche, à la colonne et au tri (`list.ts`, `logic.ts`).
  - La ligne « Indices » de la révélation (`end.ts`) affiche maintenant le compte, puis le `clue_profile` entre parenthèses s'il existe. Elle n'est plus vide.
  - Données de `nuit-rampe` : l'index 1 (n° 2, `exports {BE: 0}`, 0 indice) donne 1, comme la carte du jeu. L'index 2 (n° 3, exports et imports vides) donne 0, comme le jeu, qui n'a pas de ligne d'échanges. Le cas témoin de S8 tour 3 (« n° 2 ») est donc l'**index 1**, pas l'index 2 comme le dit la consigne.
- **R3, surtitre** : corrigé. `gameEyebrow()` est extrait de `mountGame`, sans changement de logique. Un `ratedEyebrow` optionnel du `GameContext` remplace `UI.ratedEyebrow`, et seul le labo le passe (`'Candidate'`, dans `play.ts`).
- **Jeu publié** : rien ne change. Sans `ratedEyebrow`, le surtitre reste « Grille notée » (testé). `grids.json` et `fr.ts` ne sont pas touchés.
- **Règles de l'aveugle** (`lab/README.md`) : elles tiennent.
  - `clue_source` envoie le contenu des indices avant la partie. Ce n'est pas une mesure du solveur, et le jeu montre déjà ces indices.
  - La note, les techniques, les étapes et le titre restent masqués.
  - `end.ts` ne lit la grille qu'après la révélation.
- **Tests**
  - `npm test` : 382 verts. `npm run typecheck` : OK. `pytest lab/tests` : 54 verts.
  - Les tests ajoutés sont pertinents. Le premier compare labo et jeu sur toutes les grilles publiées. Le second vérifie le surtitre publié et celui du labo. Le test serveur couvre `clue_source`.
- **Conventions** : code et commentaires en anglais. L'en-tête de `logic.ts` est à jour. L'auteur est l'adresse noreply. Aucune mention de Claude ou de l'IA.

## Points mineurs

1. **Champ `clues` du serveur devenu trompeur** : `lab_server.py` envoie toujours `len(g["clues"])`. Il ne sert plus que de repli quand `clue_source` manque, ce qui n'arrive jamais. Il vaudrait mieux le supprimer, ou le renommer pour dire qu'il s'agit des indices bruts.
2. **Requête en plus dans `end.ts`** : `api.grid(lot, index)` est appelé à chaque `draw()` révélé, rien que pour compter les indices. `/api/reveal` pourrait porter `clue_source`.
3. **Cast `src as Grid`** dans `labClueCount` : il est correct tant que `shownClueCount` ne lit que `clues`, `inventory` et `step`. Si ce n'est plus le cas, le compilateur ne préviendra pas. On peut typer `shownClueCount` et `inventoryExchanges` sur ce `Pick`.
4. **Assertion conditionnelle du test** : dans `lab-logic.test.ts`, la vérification `clues.length + 1` est sous `if (g)`. Le filtre `x.inventory.exports` accepte aussi `{}`. Le cas est bien couvert aujourd'hui (5 grilles publiées), mais ce test passerait en silence si aucune grille ne convenait.
5. **Redondance à l'écran** : le surtitre « Candidate » s'affiche au-dessus du titre « Candidate N ». C'est neutre, donc conforme à R3, mais redondant. « Candidate du labo » ou le nom du lot serait plus informatif.

Pas de capture : le compte vient par construction de la fonction du jeu, et je l'ai vérifié sur les données de `nuit-rampe`.
