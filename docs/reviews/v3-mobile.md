# Relecture — v3-mobile (S7.1 : R1-R22 à 375 et 320 px)

- Branche `v3-mobile`, commit `22ab76a`, auteur s7, créée depuis le `main` qui contient `v3-web-home`, `v3-web-panel` et `v3-web-board`. Relecteur : s8.
- Hors périmètre : le slider sur téléphone (B2), les relevés sous 861 px (choix humain en attente) et le papier.
- Captures dans `docs/reviews/v3-mobile/` du worktree `spot-elec-v3-reviews`, non versionnées car `.gitignore` exclut les PNG. Elles comprennent les 34 vues mobiles de la galerie, rejouées au toucher, et les captures pleine page de l'accueil, du dossier, des grilles 1, 7, 11, 903 et 906 à 375 et 320 px (DPR 2, toucher).

## Verdict

**OK, sans écart.** 2 remarques sur l'existant, sans effet sur le périmètre.

## Vérifications

| Contrôle | Résultat |
|---|---|
| `npm test` | 426 tests verts |
| `npm run typecheck` | OK |
| `npm run build` | OK |
| `check_unique.py` | sans objet : `grids.json` inchangé |
| `check-ui.mjs` contre `vite preview` | 205/205 OK |
| Défilement horizontal | aucun, sur les 14 écrans demandés à 375 et 320 px |
| Conventions | CSS et `home.ts` seulement ; texte joueur repris de `UI.printAll` ; aucune mention d'IA |

## Le changement : icône d'imprimante sur téléphone (q383)

- **`home.ts`** : le lien porte `aria-label` et `title` « Imprimer toutes les grilles », et son texte passe dans un `<span class="label">`.
- **`app.css`** : sous 861 px, le libellé est masqué et seule l'icône reste ; sous 375 px, le logo, le nom et les boutons se resserrent.
- **Mesures** (DOM, Chrome au toucher) :

| Largeur | Hauteur de l'en-tête | Libellé visible | `aria-label` / `title` |
|---|---|---|---|
| 320 | 40 px | non | présents |
| 375 | 40 px | non | présents |
| 860 | 40 px | non | présents |
| 861 | 40 px | oui | présents |

- **Capture** : à 320 px, le logo, « Dispatch », l'icône et « Comment jouer » tiennent sur une ligne. Le point à trancher de `v3-web-home.md` (en-tête sur 3 lignes) est réglé.
- **Accessibilité** : l'`aria-label` répète le texte visible sur ordinateur, sans conflit. Sur téléphone, il donne son nom au lien qui n'a plus que l'icône.

## R1-R22 sur téléphone, vérifiés à 375 et 320 px

| Retour | Constat |
|---|---|
| R1 pastilles de la carte du jour | absentes |
| R2 « Prendre le quart » | étroit, à contour |
| R3 « Jouer » du dossier | tous les boutons à contour (320 px) |
| R4 impression | icône dans l'en-tête de l'accueil ; plus de bouton Imprimer dans le jeu ni dans le bandeau « Bouclé » (M-34) |
| R6 vocabulaire | « carnet », « paliers », « sans carnet exact » |
| R7 et R8 dossier | pas de description sous le titre ; phrases roleplay avec deux-points insécable |
| R9 lore | ligne de lore sur les grilles 1 et 7 ; « Technique du jour » absent |
| R10 petits textes | aucun texte sous les noms du carnet à l'écran (grilles 1, 7, 11, 903 et 906) |
| R11 | pas d'indication sur le carnet exact ; « formes autorisées, quantités à déduire » sur les grilles sans carnet |
| R12 compteurs | « 0 / 7 », « 0 / 2 », « 0 / ∞ » ; « 7 / 7 » à côté des pictos à 320 px (M-34) |
| R13 import | grille 11 : ni ligne ni pastille d'import |
| R14 STEP barrée | barrée une fois la paire posée (M-34) |
| R15 flèches | ▲ et ▼ seuls (M-34) |
| R16 CO₂ | publication « Limite CO₂ » en tête, ordre validé ; jauge sans « plafond » (grille 903) |
| R17 | sans objet sous 861 px ; mise en page inchangée |
| R18 programmes | lignes seules, sans pastille (une sur la grille 7, deux sur la 906) |
| R19 export sous une pièce | contour pointillé violet et bleu gardé (M-34) |
| R20 et R21 marques | coche au coin haut droit des pastilles et des cases de flux, et au bout des lignes de programme (M-34) |
| R22 | relevés sous 861 px hors périmètre : pastille inchangée |

## Remarques sur l'existant (pas des écarts de cette branche)

- **Pastilles de choix sur téléphone** : la barre sous la grille nomme chaque ligne d'import « Import », sans le pays (`renderChips`, `panels.ts`). Sur la grille de galerie 903, qui a trois voisins, on lit trois « Import » identiques. Les grilles publiées n'ont que l'Allemagne, et le carnet en dessous dit bien « Import d'Allemagne ». C'est à prévoir avant de publier une grille à plusieurs voisins.
- **Lignes en plus à 320 px** : « Import du Royaume-Uni » prend 3 lignes dans le carnet (grille 903) et le sur-titre « GRILLE NOTÉE · SANS CARNET EXACT » en prend 2. L'auteur les a signalés ; c'est lisible.
