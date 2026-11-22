# Relecture — v3-web-panel (S6.2, R9-R16)

- Branche `v3-web-panel`, commit `8834402`, auteur s6. Relecteur : s8.
- Référence : retours R9-R16 (`plan/rev-6.md` § S4), textes validés dans `docs/next/v3-texts-v3-web-panel.md` (réponse q230).
- Captures après changement : `docs/reviews/v3-web-panel/W-*-apres.png` dans le worktree `spot-elec-v3-reviews`, non versionnées (PNG exclus par `.gitignore`) (1280 px, script de galerie rejoué sur le commit). Références avant : `docs/ui-gallery/web/img/` de `v3-ui-gallery`.

## Verdict

**OK, sans écart bloquant.** 3 écarts mineurs, 1 point à trancher par l'humain.

## Vérifications

| Contrôle | Résultat |
|---|---|
| `npm test` | 415 tests verts (11 fichiers) |
| `npm run typecheck` | OK |
| `npm run build` | OK |
| `check_unique.py` | sans objet : `grids.json` inchangé |
| `check-ui.mjs` contre `vite preview` | 205/205 OK (13 grilles × 1280/375/320, accueil, dossier, 1 page A4 par grille) |
| Captures 1280 px | W-06, W-08, W-12, W-13, W-16, W-26 comparées aux références |
| Sous 861 px | CSS de mise en page inchangé (seuls `.intro.lore` et `.step-glyph.used` ajoutés) ; check-ui 375/320 vert. Le contenu du panneau change aussi sur téléphone, comme prévu. |
| Papier | ne plante pas (check-ui) ; `renderBook(…, paper=true)` garde les petits textes, `print.ts` garde l'intro des tutos et la règle CO₂ « Plafond CO₂ ». |
| Conventions | code en anglais, textes joueur dans `fr.ts`, aucune mention d'IA. |

## Retours, un par un

| Retour | Statut | Constat |
|---|---|---|
| R9 lore | traité | Encart supprimé, ligne en italique (`game.ts:180`, `fr.ts:248`). Textes identiques à ceux validés, tutos 8-9 compris. Test : chaque tuto a sa ligne, sans vocabulaire de forme. |
| R10 petits textes | traité | Plus de texte sous les noms à l'écran ; les largeurs passent dans les pictos (`shapeGlyphs`, `panels.ts`). Les points CO₂ par case passent dans la publication R16. Les lignes « Allemagne · 1 bloc par créneau » sous la grille restent : elles relèvent de la grille, hors R10. |
| R11 | traité | « touche une centrale pour la choisir » retiré ; « formes autorisées, quantités à déduire » reste sur les grilles sans inventaire (hors R11). |
| R12 compteurs | traité | `fr.ts:378` : « n / max » ou « n / ∞ » ; les barres comptent des barres (`panels.ts:157`). |
| R13 import | traité | `importRuledOut` (`panels.ts:33`) : ligne masquée si capacité 0 ou 0 import publié. Vu sur W-08 (grille 11). |
| R14 STEP barrée | traité | Un picto par paire publiée, barré une fois posé (W-26 : 1 / 1 barré). Sans nombre publié, un seul picto jamais barré : cohérent (pas de maximum). |
| R15 flèches | traité | `board.ts` : ▲/▼ seuls (W-16). |
| R16 CO₂ | traité, 1 écart mineur | Publication « Limite CO₂ » en tête, comptée dans « n sur N » ; jauge sans « plafond ». Ordre des centrales différent du texte validé (écart 2). |

## Point à trancher : le texte d'intro des tutos n'est plus affiché

**Conséquence voulue de R9, pas une perte non demandée.** L'encart « Technique du jour » se composait de trois parties : sur-titre, nom de la technique et `grid.intro`. R9 supprime l'encart entier. Le tableau validé en q230 montre, dans la colonne « Actuel (encart) », les débuts de ces intros (« Nouveau : un prix publié… »), remplacés par la ligne de lore.

Mais ces intros portaient aussi des règles qui n'apparaissent plus nulle part à l'écran :
- tuto 7 : « Le pompage ▲ ajoute une case à couvrir, le turbinage ▼ en retire une » ;
- tuto 8 : comment se pose le charbon progressif (base et plateau) ;
- tuto 3 : l'import se pose comme une centrale d'une case (l'export reste expliqué par la phrase d'aide sous la grille).

Elles restent sur la fiche papier (`print.ts:36`). À l'humain de confirmer que c'est acceptable, ou que « Comment jouer » doit les porter.

## Écarts mineurs

1. **Le compteur passe à la ligne sous les pictos d'une centrale à nombreuses barres.** `panels.ts:157` ajoute « n / max » aux barres, sans place prévue. Avec 7 barres nucléaires (tuto 7), « 7 / 7 » tombe seul sur une deuxième ligne, sous les pictos (`W-26-apres.png`, `W-16-apres.png`). La rangée grandit et le compteur n'est plus aligné sur les autres. Avant, les barres n'avaient pas de compteur. CSS en cause : `.bars { flex-wrap: wrap }` (`app.css:101`).
2. **Publication CO₂ : l'ordre diffère du texte validé.** Validé (version A) : « charbon 3, TAC 2, gaz 1, import d'Allemagne 3… ». Affiché sur la grille 903 : « charbon 3, gaz 1, TAC 2, … ». En cause, `co2PerCellText` (`panels.ts:278`), qui suit `PIECE_IDS`. Il faut soit l'ordre validé, soit l'accord de l'humain sur l'ordre de préséance.
3. **Labo : le compte d'indices de la table des lots oublie la publication CO₂.** `shownClueCount` compte désormais `co2_cap`, mais `labClueCount` reçoit `clue_source`, que `lab/lab_server.py:214` réduit à `clues`, `inventory` et `step`, donc sans `co2_cap`. Sur une grille CO₂, la table des lots (`web/src/lab/api.ts:40`) affiche N−1, alors que le jeu et la fin de partie (`end.ts:54`, grille complète) affichent N. Lots concernés : `demo-01`, `nuit-jouer-a/b/c`, `nuit-rampe`. Correction : ajouter `co2_cap` à `clue_source` et au type `Pick` de `lab/logic.ts:17`.

## Hors écart (pour information)

- « Import d'Allemagne » / « Import du Royaume-Uni » sur 2 lignes à 1280 px (colonne de nom à 96 px) : signalé par l'auteur, lisible.
- Jauge CO₂ : le détail garde « tac » en minuscules (« tac 2 »), comme avant la branche.

## Corrections relues (`9a0f7dd`)

**OK : les 3 écarts sont corrigés, rien de cassé.**
1. **Compteur à la ligne** : les pictos passent dans un bloc `.glyphs` qui se replie seul ; `.bars` ne se replie plus, et `.count` est en `flex: none` et `nowrap`. Sur la grille 7 à 1280 px, « 0 / 7 » reste sur la ligne du nucléaire, à droite des pictos. Un test couvre ce cas. check-ui ne trouve aucun défilement horizontal à 375 et 320 px.
2. **Ordre CO₂** : les centrales, puis les imports, chacun par points décroissants ; à égalité, le tri garde l'ordre de préséance. On obtient « charbon 3, TAC 2, gaz 1, import d'Allemagne 3, import du Royaume-Uni 1 », exactement le texte validé. Un test le vérifie.
3. **Compte d'indices du labo** : `clue_source` inclut `co2_cap` (`lab_server.py`) et `ClueSource` l'accepte (`lab/logic.ts`). Tests du labo : 178 verts ; test Vitest ajouté.
- **Point à trancher, règles des intros de tutos absentes de l'écran** : hors de ce commit, il reste à décider.
- **Fusion à trois** : voir `v3-web-board.md`, section « Fusion finale ».
