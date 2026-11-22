# Relecture — v3-carnet (S6.7 : carnet K-B)

- Branche `v3-carnet`, commit `891fd10`, auteur s4, créée depuis `main` `9e2ad22`. Relecteur : s8.
- Référence : l'option K-B choisie par l'humain (artifact Carnet), soit le prototype `v3-carnet-proto` `98e8aa1` avec `?book=b`.
  - une barre par longueur, avec la longueur écrite dedans ;
  - un compteur « n / max » par taille ;
  - les hauteurs optionnelles en rangées pointillées.
- Fichiers locaux dans `docs/reviews/v3-carnet/` du worktree `spot-elec-v3-reviews` : paires prototype/branche (`pair-*.png`), cas « 1 / 0 » (`over-1-gaz3.png`) et relevé de comparaison (`bookcmp.jsonl`). Ils ne sont pas versionnés.

## Verdict

**OK, sans écart bloquant.** 2 écarts mineurs de rendu par rapport au prototype.

## Vérifications

| Contrôle | Résultat |
|---|---|
| `npm test` | 427 tests verts |
| `npm run typecheck` | OK |
| `npm run build` | OK |
| `check_unique.py` | sans objet : `grids.json` inchangé (seul `scripts/ui-gallery/grids.json` gagne les grilles 908, 909 et 910) |
| `check-ui.mjs` sur la branche | 205/205 OK, papier compris |
| Conventions | code en anglais, aucun texte joueur ajouté (`UI.count` réutilisé), aucune mention d'IA |

## Rendu comparé au prototype `?book=b`

**Méthode** : les deux builds de galerie tournent côte à côte (prototype avec `?book=b`, branche sans paramètre). Pour chaque cas, j'injecte le même état dans `localStorage`, à la manière de `book-audit.mjs` du prototype : vierge, moitié (une pose sur deux de la solution) ou plein (toute la solution). Je fais une capture de la carte du carnet (DPR 2) et je compare les pixels. En tout : grilles 7, 908, 909, 910, 1 et 12, à 1280, 375 et 320 px, dans les 3 états, soit 54 paires.

**Résultat** :
- les 54 paires ont la même taille et le même texte ;
- même dessin : une barre par longueur, la longueur écrite dedans, une queue pointillée pour une plage (« 3–6 »), des rangées pointillées pour les hauteurs optionnelles, et la barre barrée une fois toute la largeur posée ;
- aucune paire n'est identique au pixel près, à cause des 2 écarts ci-dessous.

## Écarts mineurs (par rapport au prototype)

1. **Compteurs décalés de 2 px vers la droite.** La branche réutilise `.count`, qui porte `margin-left: 2px` (`app.css`), là où le prototype avait `.gcount` sans marge. Chaque compteur se décale donc de 2 px, et les groupes suivants avec lui (paires `pair-7-1280-vierge.png`, `pair-1-1280-vierge.png`). C'est invisible à l'œil.
2. **Le compteur d'une largeur terminée n'est pas estompé.** Le prototype passait le compteur d'un groupe complet à 45 % d'opacité (`.grp.done .gcount`). La branche barre bien la barre, mais laisse le compteur (« 1 / 1 », « 2 / 2 ») à pleine teinte (`pair-908-1280-pleine.png`). Il faut soit reprendre cette règle, soit confirmer que l'humain n'y tient pas.

## Cas « 1 / 0 » en rouge

**Cohérent, et inaccessible en jeu normal.**
- **Rendu** : une largeur posée que le carnet n'a pas obtient sa propre barre et le compteur « 1 / 0 » en rouge gras, comme tout dépassement (`.count.over`). Essai sur la grille 1 avec une barre de gaz de 3, alors que le carnet n'a qu'une barre de 2 : « Gaz [3] 1 / 0 [2] 0 / 1 » (`over-1-gaz3.png`).
- **Accessibilité en jeu** : `checkBudget` (`engine/rules.ts`, vers la ligne 105) refuse déjà de poser une barre dont la longueur manque au carnet (« Plus de barre … dans le carnet »). Ce cas n'apparaît donc qu'avec une partie sauvegardée incohérente, dont le jeu affiche les barres hachurées en rouge. C'est un garde-fou d'affichage, sans surprise pour le joueur.

## Fusion avec v3-mobile

- `main` (`afe0ba4`) contient déjà `v3-mobile`. La fusion de `v3-carnet` dessus ne donne aucun conflit (fusion automatique de `app.css`).
- Arbre fusionné : 428 tests verts, typecheck OK, build OK, `check-ui.mjs` 205/205.

## Remarque

- Les pastilles de choix sous la grille, sur téléphone, gardent un seul compteur « posées / max » par centrale, sans détail par largeur. Signalé par l'auteur ; c'est hors K-B, qui ne porte que sur le carnet.
