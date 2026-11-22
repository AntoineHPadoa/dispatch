# Relecture — v3-web-home (S6.1 : R1-R4, R6-R8)

- Branche `v3-web-home`, commits `6d80672` et `2e97e40`, auteur s5. Relecteur : s8.
- Référence : retours R1-R4 et R6-R8 (`plan/rev-6.md` § S4), textes validés dans `docs/next/v3-texts-v3-web-home.md`, section « Décision (réponse q262) » : vocabulaire « paliers » et « bords », « carnet ».
- Captures dans `docs/reviews/v3-web-home/` du worktree `spot-elec-v3-reviews`, non versionnées car `.gitignore` exclut les PNG. Références avant : `docs/ui-gallery/web/img/` de `v3-ui-gallery`.

## Verdict

**OK pour le web, sans écart bloquant.** 2 écarts mineurs et 1 point à trancher sur la limite des 861 px.

## Vérifications

| Contrôle | Résultat |
|---|---|
| `npm test` | 414 tests verts |
| `npm run typecheck` | OK |
| `npm run build` | OK |
| `check_unique.py` (`grids.json` modifié : titres et intros) | OK, chaque grille unique et déductible |
| `check-ui.mjs` contre `vite preview` | 205/205 OK |
| Captures 1280 px | W-01, W-02, W-04, W-05, W-26 comparées aux références |
| Conventions | code en anglais, textes joueur dans `fr.ts` et `grids.json`, aucune mention d'IA |
| Vocabulaire R6 | aucune occurrence de « rampe », « épaule » ou « inventaire » dans `src/i18n/fr.ts`, `src/data/grids.json` et `src/ui/*.ts` |

## Retours, un par un

| Retour | Statut | Constat |
|---|---|---|
| R1 pastilles de la carte du jour | traité | `plantChips` et son CSS supprimés (`home.ts`, `app.css`). W-01. |
| R2 « Prendre le quart » | traité | Toujours `btn secondary` : étroit, à contour, comme « Revoir le quart ». W-01. |
| R3 « Jouer » du dossier | traité | Règle `.fiche.next .fbtn` (fond noir) supprimée. W-05 : tous les boutons sont à contour. |
| R4 impression | traité | « Imprimer toutes les grilles » dans l'en-tête, à côté de « Comment jouer ». Bouton retiré de la barre d'outils du jeu. Ctrl+P : voir plus bas. |
| R6 vocabulaire | traité | Conforme à la décision q262 : « barre à paliers », « charbon par paliers », « bord », « carnet », « sans carnet exact ». |
| R7 description du dossier | traité | `<p>` retiré de la page du dossier. W-05. |
| R8 cartes en roleplay | traité, 1 écart mineur | `UI.briefing` conforme aux phrases validées, version « paliers » et « bords » pour les tutos 8 et 9. Écart de typographie : voir l'écart 1. |

## Ctrl+P sur l'écran de jeu, comparé à `#/imprimer/<id>`

**Identiques ; l'écart relevé par l'auteur est acceptable.**

Méthode : PDF A4 de Chrome headless pour `#/grille/<id>` et `#/imprimer/<id>`, grilles 1, 7 et 12. Poppler (`pdftotext`, `pdftoppm`) est cassé sur la machine (bibliothèque `gpgme` absente). Rastérisation avec `sips`, comparaison avec `pypdf` et Pillow (`uv run --with`).

| Grille | Pages | Texte extrait | Écart max. par pixel (72 dpi) |
|---|---|---|---|
| 1 | 1 / 1 | identique | 26/255 |
| 7 | 1 / 1 | identique | 27/255 |
| 12 | 1 / 1 | identique | 27/255 |

- Les écarts de pixels sont de l'anticrénelage : un décalage inférieur au point, invisible à l'œil (`ctrlp-grille-7.png` contre `imprimer-7.png`).
- Seules les métadonnées diffèrent : le titre du PDF (« Poser le carnet · Dispatch » contre « Impression · Dispatch ») et les tags d'accessibilité (`#print-root` est `aria-hidden` sur l'écran de jeu). Sans effet sur la feuille.
- Ce comportement existait déjà sur `main` : la route `grille` remplit `#print-root` (`app.ts:41`). La branche n'a eu qu'à retirer le bouton.

## Bouton « Imprimer » gardé dans le bandeau « Bouclé »

**Cohérent avec la lettre de R4, à confirmer par l'humain.** R4 supprime le bouton « de la barre d'outils du jeu ». Le bouton du bandeau de fin (`game.ts:288`) n'est pas dans cette barre : c'est une action de fin de partie, à côté de « Grille suivante » (W-26). Sur `main`, il remplaçait déjà le bouton de la barre une fois la grille finie (« one Print button only »). Si l'intention de R4 est de ne plus imprimer qu'avec Ctrl+P et depuis l'accueil, il faut aussi retirer ce bouton. Je ne le compte pas comme écart.

## Point à trancher : sous 861 px, l'en-tête de l'accueil change

`app.css:148-149` (`.home .site-head { flex-wrap: wrap }`, `.head-actions`) s'applique à toutes les largeurs. À 375 et 320 px, l'en-tête passe d'une à trois lignes : logo, puis « Imprimer toutes les grilles », puis « Comment jouer » (`home-375.png`, `home-320.png`). La carte du jour descend d'environ 90 px.

C'est une conséquence directe de R4, puisque le bouton quitte le pied de page pour l'en-tête. Mais la limite fixée par R17 est que la mise en page ne change pas sous 861 px. Deux options : accepter et reprendre en S7 (mobile), ou garder le bouton en pied de page sous 861 px. check-ui reste vert, sans défilement horizontal.

## Écarts mineurs

1. **Cartes du dossier : le « : » peut commencer une ligne.** `home.ts:108` affiche `UI.briefing` avec `esc(blurb)`, sans `frenchSpaces` (la carte du jour l'utilise, `home.ts:33`). L'espace avant « : » est donc sécable. Sur W-05, carte 8 : « Le charbon monte et descend par paliers » puis, à la ligne, « : surveille ses bords. ». Le même risque touche toutes les phrases R8, qui ont toutes un « : ».
2. **Champ `lead` mort.** `fr.ts:341` garde `lead: ''` pour « Premiers pas », et `home.ts:51,97` le recopie, alors que plus rien ne l'affiche. La note de textes proposait de le retirer. Sans effet pour le joueur.

## Pour l'orchestrateur : fusion avec v3-web-panel

Essai de fusion sur `main` : `v3-web-panel`, puis `v3-web-home`. Un seul conflit, dans `web/tests/ramp.test.ts` (vers la ligne 185) :
- `v3-web-panel` attend « rampe de 3 à 5 créneaux » sur le papier ;
- `v3-web-home` renomme cette indication « à paliers, 3 à 5 créneaux ».

La résolution consiste à garder le test de `v3-web-panel` en remplaçant la chaîne papier par « à paliers, 3 à 5 créneaux ». Aucun conflit dans `fr.ts` : la suppression de `techniqueOfDay` par `v3-web-panel` passe.

## Corrections relues (`def3ced`)

**OK : les écarts sont corrigés, rien de cassé.**
- **Bouton « Imprimer » du bandeau « Bouclé »** : retiré, suivant la décision humaine q381. Le bouton, `print` de `GameContext`, `UI.tools.print`, la règle CSS `.print-tool` et le `print` du labo (`lab/play.ts`) sont supprimés ensemble ; plus aucune référence dans `web/src`. Ctrl+P et « Imprimer toutes les grilles » restent les deux chemins d'impression.
- **Écart 1, deux-points** : `frenchSpaces(blurb)` (`home.ts`). Sur le dossier à 1280 px, la carte 8 affiche désormais « par paliers : surveille ses bords » sans « : » en début de ligne.
- **Écart 2, champ `lead`** : supprimé de `fr.ts` et de `home.ts`.
- **Point à trancher, en-tête sous 861 px** : inchangé par ce commit, il reste à décider.
- **Fusion à trois** : voir `v3-web-board.md`, section « Fusion finale ».
