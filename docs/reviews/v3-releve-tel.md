# Relecture — v3-releve-tel (S7.4 : relevés sur téléphone, M-3)

- Branche `v3-releve-tel`, commit `e73e5ba`, auteur s7, créée depuis `main` `a1aaa80`. Relecteur : s8.
- Référence : le choix M-3 de l'humain, prototype `v3-pills-proto` `bf552dc` avec `?pills=m3`.
  - sous le créneau, un marqueur « relevé » portant la marque R21 en coin, pour un relevé à plusieurs centrales quand la case fait moins de 48 unités ;
  - un tap fait défiler jusqu'à la publication et la surligne ;
  - le relevé à une centrale reste en clair, et l'ordinateur garde O-E.
- Fichiers locaux dans `docs/reviews/v3-releve-tel/` du worktree `spot-elec-v3-reviews`, non versionnés : captures `proto-*` et `branch-*`, planche `sheet.png`, relevé `releve.log`.

## Verdict

**OK, sans écart bloquant.** 1 écart mineur (focus après un tap), 1 point à confirmer (style du relevé à une centrale).

## Vérifications

| Contrôle | Résultat |
|---|---|
| Vitest | 429 tests verts (1 nouveau) |
| typecheck, build | OK |
| `check_unique.py` | sans objet : `grids.json` inchangé |
| `check-ui.mjs` sur la branche | 205/205 OK. Aucune grille publiée n'a de relevé à plusieurs centrales, donc check-ui ne rencontre pas de marqueur : le contrôle du marqueur repose sur les grilles de galerie 902 et 906, ci-dessous. |
| Conventions | code en anglais ; texte joueur dans `fr.ts` (`UI.recordJump`, nom accessible seulement) ; aucune mention d'IA |

## Rendu à 375 et 320 px, comparé au prototype `?pills=m3`

Captures du bas de la grille (bande des indices et rangées de pays) sur les grilles 902, 906 et 10, vierges ou terminées, à 375 et 320 px, au toucher.

- **902 et 906** : 2 marqueurs par grille, aux mêmes créneaux que le prototype (902 : 3h et 9h ; 906 : 8h et 18h). La marque R21 est au coin haut droit (coche verte une fois la grille terminée). Aucun défilement horizontal.
- **10** : aucun marqueur, puisque ses deux relevés ne portent qu'une centrale. Ils restent en clair.
- **Différences de style avec le prototype** :
  - **Icône du marqueur** : le prototype dessinait trois barres pleines ; la branche reprend l'icône « relevé » de la liste des publications, au trait plus fin. C'est cohérent avec la liste ; je ne le compte pas comme écart.
  - **Relevé à une centrale (point à confirmer)** : le prototype le passait en pastille nue de couleur avec son chiffre, comme O-E (« 0 » rose sur 902, « 3 » jaune sur 10). La branche garde la pastille actuelle, avec contour, carré de couleur et chiffre (`sheet.png`, lignes 1, 2 et 5). La consigne dit que ce relevé « reste en clair », ce que fait la branche. Il faut confirmer avec l'humain s'il voulait aussi le style nu du prototype.
- Les différences de hauteur sur 906 viennent des programmes. Le prototype est antérieur à R18 et y montre encore des pastilles « Réacteur 4h → 20h » ; la branche montre des lignes. C'est attendu.

## Comportement

| Contrôle | Résultat |
|---|---|
| Accessibilité | `role="button"`, `tabindex="0"`, `aria-label` « Relevé de 3h : lire la publication » (902) ou « Relevé de 8h : … » (906) ; contour de focus au clavier (`:focus-visible`) |
| Clavier | la touche Tab atteint le marqueur ; Entrée et Espace placent le focus sur la publication `li[data-clue]` (902 et 906, à 375 et 320 px) |
| Tap | 30 essais (902 à 375 et 320 px, 906 à 375 px). Dans les 30 cas, la page défile, la publication est surlignée (`.flash`) et entièrement visible. Dans 29 cas, le focus est sur la publication ; dans 1 cas (902 à 375 px), il reste sur le marqueur. |
| Effet sur la pose | l'état sauvegardé (`localStorage`) est inchangé après le tap ; aucune pose, aucun message d'erreur. La zone de tap (30 × 26) reste dans la bande des indices, sans atteindre la grille ni les rangées de pays (vérifié par calcul : la zone finit avant le bas de la bande). |
| 1280 px | SVG de la grille identique à celui de la base `a1aaa80` (aux identifiants près) sur 902, 906 et 10, vierges et terminées. L'ordinateur garde O-E. |

## Écart mineur : focus après un tap

Un tap sur le marqueur peut laisser le focus sur le marqueur (1 essai sur 30). `jumpToClue` (`game.ts`) remet le focus sur la publication à l'image suivante (`requestAnimationFrame`). Mais le focus que Chrome donne au marqueur après `pointerup` peut arriver plus tard. L'utilisateur au doigt voit bien la publication surlignée. Seul le lecteur d'écran peut alors rester sur le marqueur. Pour corriger : appeler `preventDefault()` sur `pointerdown` du marqueur, ou redonner le focus au `click`.

Remarque : `.clue:focus { outline: none; }` retire tout contour de focus à la publication atteinte. Une fois le surlignage de 1,8 s passé, rien ne montre plus où est le focus. C'est acceptable, puisque l'élément n'est focusable que par ce saut.

## Fusion avec main et v3-exports

- `main` (`f16375b`) contient déjà `v3-exports`. La fusion de `v3-releve-tel` ne donne aucun conflit, avec fusion automatique de `fr.ts`, `app.css`, `board.ts`, `panels.ts` et `ui.test.ts`.
- Arbre fusionné : 432 tests verts, typecheck OK, build OK, `check-ui.mjs` 205/205.
