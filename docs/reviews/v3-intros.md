# Relecture — v3-intros (S6.13 : intros des tutoriels retirées)

- Branche `v3-intros`, commit `a6a0f4a`, auteur s5, créée depuis `main` `f16375b`. Relecteur : s8.
- Référence : la décision humaine q735.
  - Les intros des tutoriels sortent de `grids.json`. Le champ `intro` reste dans le format, pour les grilles fictives et le labo.
  - La fiche papier d'un tutoriel imprime la ligne de lore à la place de l'intro et du nom de la technique.
- Fichiers locaux dans `docs/reviews/v3-intros/` du worktree `spot-elec-v3-reviews`, non versionnés : fiches A4 `base-*.png` et `branch-*.png` (grilles 1, 3, 7 et 8).

## Verdict

**OK, sans écart.**

## Vérifications

| Contrôle | Résultat |
|---|---|
| Diff de `grids.json` | seul le champ `intro` des 9 tutoriels (1-7, 12, 13) disparaît ; les 13 grilles et tous leurs autres champs sont identiques, intros des grilles notées comprises |
| Vitest | 432 tests verts |
| typecheck, build | OK |
| `check_unique.py` | OK, chaque grille unique et déductible |
| Tests du labo (`pytest lab/tests`) | 177 verts |
| `check-ui.mjs` sur la branche | 205/205 OK |
| Conventions | code en anglais ; texte joueur repris de `TUTORIAL_LORE` (`fr.ts`) ; aucune mention d'IA |

## Fiche papier (`#/imprimer/<id>`, PDF Chrome, base `f16375b` contre branche)

| Grille | Base | Branche |
|---|---|---|
| 1 (tuto) | « Cases interchangeables. Pose toutes les centrales du carnet… » | « Premier quart au centre de dispatching : le carnet d'ordres est arrivé, à toi de caser chaque centrale sous la courbe. » |
| 3 (tuto) | « Carnet juste. Nouveau : la ligne vers l'Allemagne… » | « La ligne vers l'Allemagne est ouverte : ce qui manque arrive par le câble, ce qui déborde repart. » |
| 7 (tuto) | « La silhouette suit les barres · … Nouveau : une STEP… » | « La STEP de montagne remonte son eau quand le courant abonde et la relâche quand la demande grimpe. » |
| 8 (notée) | texte identique | texte identique |

- Chaque fiche tient toujours sur 1 page A4. Le reste de la fiche ne change pas, à la mise en page près, puisque la ligne de lore est plus courte que l'ancienne intro.
- Le pied de page « Note exports, imports, pompage ▲ et turbinage ▼… » reste : il garde le mode d'emploi papier de la STEP.

## Écran inchangé

Le balisage de `#app` est identique entre la base et la branche (aux identifiants SVG près) pour les grilles 1, 3, 7, 12 et 8, à 1280 et 375 px. Les tutoriels affichaient déjà la ligne de lore, et non l'intro.

## Fusion avec main et v3-releve-tel

- `main` (`010a4a3`) contient déjà `v3-releve-tel`. La fusion de `v3-intros` ne donne aucun conflit.
- Arbre fusionné : 433 tests verts, typecheck OK, build OK, `check_unique.py` OK, `check-ui.mjs` 205/205.

## Remarque

Avec cette branche, les règles que portaient les intros des tutos (le pompage ajoute une case à couvrir, la pose du charbon par paliers, l'import qui se pose comme une centrale d'une case) disparaissent aussi du papier. C'est la décision q735, qui règle le point resté ouvert dans `v3-web-panel.md`.
