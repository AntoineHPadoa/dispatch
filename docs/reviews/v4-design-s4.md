# Review v4-design S4 (S4.8)

Périmètre : `git diff 42f0e89..main`, avec `main` en 13b25d3 (merge de `v2-ux-desktop`). 14 commits, de ea45b41 (S4.1) à 742c01e (S4.20). Écran desktop seulement ; mobile et papier non jugés.

## Verdict

**Un point bloquant : le déploiement de 13b25d3 a échoué**, et le site en ligne sert encore 42f0e89. La relecture du code ne trouve pas d'autre point bloquant.

## Bloquant

1. **CI rouge : les tests du solver échouent** (run GitHub Actions 45694936439, job `solver`, étape `pytest`). Les jobs `build` et `deploy` sont donc sautés.
   - **Cause** : `solver/tests/test_rules_text.py::test_same_ids_names_and_sentences` exige que les noms et phrases des techniques soient identiques entre `web/src/i18n/fr.ts` (`TECHNIQUES`) et `solver/src/dispatch_solver/deduce/trace.py` (`RULES`). S4.4/S4.13 ont réécrit les textes de `fr.ts` (bloc / groupe) sans toucher au solver.
   - **Reproduit en local** : `solver/.venv/bin/pytest -q -x` → `1 failed, 212 passed`. Premier écart : `room` (« Un groupe ne peut ni dépasser… » dans `fr.ts`, « Une barre ne peut ni dépasser… » dans le solver).
   - **Deuxième test touché** : `test_design_table_lists_every_technique` lit aussi la table des techniques de `GAME-DESIGN.md` §9. Les noms renommés (« Le bloc le plus cher », « Un seul groupe pour ce bloc », « Blocs interchangeables », « Le relevé compte les blocs », « La silhouette suit les groupes », « Le groupe qui ne tient qu'à un endroit », « Le bord appelle un bloc », « Un bloc seul est un bord ») doivent y être reportés.
   - **Correctif en cours** : au moment de ce rapport, `solver/src/dispatch_solver/deduce/trace.py` et `GAME-DESIGN.md` sont modifiés et non commités dans `/Users/padoa/Programs/spot-elec`. Je n'y ai pas touché.
   - **À relancer après le correctif** : `solver/.venv/bin/pytest -q` en entier (~5 min). Ensuite, à cause des noms de techniques des traces :
     - `solver/.venv/bin/python scripts/build_fixtures.py`, et relire le diff des fixtures ;
     - au besoin, `rerate_lots.py`.

   Puis pousser et vérifier que le run passe au vert.

## Site en ligne

- **Dernier run** : `13b25d3`, `failure` à 20:30:58 UTC (voir le point bloquant).
- **Site servi** : `https://antoinehpadoa.github.io/dispatch/` a `last-modified: 14:29:05 GMT` et les assets `index-C2wW-HAF.css` / `index-DwSZmxk8.js`, ceux du build de 42f0e89 (run 45633495816, success). Un build local de `main` donne `index-C_07Ok-1.css` / `index-DVICGFPx.js`.
- **Conséquence** : la comparaison à 1280 px du site en ligne avec les captures M4 n'est pas possible tant que le déploiement n'est pas passé.
- **À la place**, captures du build local de `main` à 1280 px (grilles 2, 6, 7, 9 ; fichiers dans le scratchpad, non versionnés). Grille 7 comparée à `docs/reviews/v4-m4/a-full-apres5.png` : tout est conforme.
  - heures plus grosses ;
  - pas de trait noir de demande ;
  - export en pointillé violet ;
  - légende pays « ↑ 2/2 ↓ 0/2 · Allemagne · 1 bloc par créneau » d'une seule chaîne ;
  - marges symétriques ;
  - publication « Allemagne : ↑ 2 exports, ↓ 2 imports » (exports avant imports) ;
  - pastilles des publications alignées ;
  - surtitre sans « sans carnet exact » ;
  - panneau « Carnet d'ordres ».

  Grille 2 : l'échelle de prix « nucléaire < barrage < TAC », avec le barrage cerclé, sur la publication de prix.

## Relecture du code

- **Moteur (`engine/rules.ts`, `engine/evaluate.ts`)** : seuls les textes changent. Les conditions de `checkShape`, `checkBudget` et `inventoryReport` sont inchangées. Seuls changent les arguments de message : `groupSubject` et `PIECE_WORDS[...].group(s)` au lieu de `ofPiece`.
- **`grids.json`** : 4 textes seulement (titre de la grille 6, deux `intro` / bulletin « blocs », une intro « groupes »). Aucune donnée de jeu touchée.
- **Vocabulaire joueur (`fr.ts`)** : plus aucune « case » ni « barre » au sens d'unité ou de pièce (les deux restes sont le verbe « barrer », l. 276 et 289). Accords vérifiés :
  - « aucun bloc importé » ;
  - « Tous les blocs sont couverts » ;
  - « 1 groupe ne tient plus : hachuré » ;
  - « Groupes nucléaires en trop » (`capitalize`) ;
  - « Plus de groupe charbon à paliers de 4 créneaux dans le carnet d'ordres » ;
  - « Le groupe nucléaire doit faire… » / « L'import d'Allemagne doit faire… ».

  « Carnet d'ordres » est utilisé partout : titre du panneau, aide, messages d'inventaire, impression.
- **Conventions** :
  - textes joueur dans `fr.ts` (dont `priceLadderLabel`) ;
  - code et commentaires en anglais ;
  - pas de mention d'IA.
- **Échelle de prix (`panels.ts` `priceLadder`)** : elle suit l'ordre de `bookEntries` (rang de mérite), sans import ni STEP, et n'apparaît qu'à partir de 2 centrales. `role="img"` et un `aria-label` sont présents.
- **Plateau (`board.ts`)** : proportions rapportées à une cellule de 40 px. Les pastilles STEP sont empilées, une par extrémité de paire, numérotées dans l'ordre de pose. Les marges sont symétriques (`width: 2 * lead`), reprises aux 3 calculs de `game.ts` `fit()`.

## Non bloquant

1. **Teinte STEP du carnet d'ordres** : `.step-glyph` (`web/src/styles/app.css:119`) reste bleu (`#4f7fb8` sur `#e3eefa`), alors que le plateau passe à l'ardoise (`STEP_INK` `#5d6f93`, `palette.ts:10`). Le carnet et le plateau ne montrent plus la même couleur pour la STEP.
2. **Nom de constante** : `STEP_BLUE` (`web/src/ui/board.ts:170`) vaut désormais l'ardoise claire `#e7ebf3` ; à renommer (`STEP_WASH`).
3. **Code mort** : `stepTagLabels` (`web/src/ui/board.ts:173`) n'est plus appelée que par `tests/ui.test.ts`, puisque les pastilles empilées n'en ont plus besoin.
4. **Commentaire décalé** : `web/src/i18n/fr.ts:471` annonce « Remplace 1 groupe de gaz… », mais le texte produit est « 1 groupe gaz » (le test l. 403 attend « 2 groupes nucléaires »).
5. **Redite** : la publication « Déjà engagé » (`fr.ts:308`) a pour texte « Groupe déjà engagé : un groupe charbon de 0h à 12h » (`fr.ts:121`), d'où deux fois « déjà engagé » à la suite. C'est conforme à la décision q273 ; je le signale seulement.
6. **Légende pays à taille fixe** : elle reste à `font-size="9"` (`board.ts:821`), alors que le texte des cases d'échange grandit avec la cellule (`exchangeSize`). Aux grandes cellules, la légende paraît petite à côté.

## Commandes lancées

| Commande | Résultat |
|---|---|
| `solver/.venv/bin/pytest -q -x` (main 13b25d3, arbre de travail du dépôt principal) | 1 failed, 212 passed (arrêt au 1er échec), 5 min 10 s |
| API Actions, run 45694936439 | `solver` failure à l'étape `pytest`, `build` et `deploy` skipped |
| `curl -I` sur le site en ligne | `last-modified` 14:29:05 GMT, assets du build de 42f0e89 |
| `vite build` de `main` + captures 1280 px (grilles 2, 6, 7, 9) | rendu conforme aux captures M4 |

Tests web, typecheck, `check_unique.py` et `check-ui` non relancés : l'orchestrateur les a vus verts (442 tests, 205/205), et le diff relu ne me fait pas douter d'eux.
