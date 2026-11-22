# Relecture — v3-co2 (S6.9 : carte CO₂)

- Branche `v3-co2`, commit `4d81c80`, auteur s6, partie de `v3-carnet` (fusionnée depuis dans `main`). Relecteur : s8.
- Référence : le choix de l'humain sur l'artifact CO₂.
  - jauge continue, comme l'option C-A ;
  - légende des coûts en dessous, comme C-B, mais chiffres en graisse normale.
- Décisions communes aux options :
  - publication « Limite CO₂ » réduite à la limite ;
  - CO₂ retiré de la légende d'un pays quand son import est impossible ce jour-là ;
  - légende limitée aux émetteurs posables.
- Prototype : `v3-co2-proto` `e5a1fe2`, avec `?co2=a` pour la jauge et `?co2=b` pour la légende.
- Captures dans `docs/reviews/v3-co2/` du worktree `spot-elec-v3-reviews`, non versionnées car `.gitignore` exclut les PNG.
  - planches de comparaison a | b | branche : `cmp-911-1280.png`, `cmp-911-375.png`, `cmp-903-1280.png`, `cmp-903-375.png`, `cmp-903-375-card.png`, `cmp-voisins.png` ;
  - captures de la branche : `actuel-*.png`.

## Verdict

**OK, sans écart bloquant ni mineur.** 2 remarques.

## Vérifications

| Contrôle | Résultat |
|---|---|
| `npm test` | 427 tests verts |
| `npm run typecheck` | OK |
| `npm run build` | OK |
| `check_unique.py` | sans objet : `grids.json` inchangé (la grille 911 entre seulement dans `scripts/ui-gallery/grids.json`) |
| `check-ui.mjs` sur la branche | 205/205 OK |
| Conventions | code en anglais ; textes joueur dans `fr.ts` (`co2Clue` raccourci, `co2LegendLabel` ajouté, `co2Detail` retiré) ; aucune mention d'IA |

## Comparaison au prototype

**Méthode** : le script `co2-audit.mjs` du prototype, que j'ai étendu aux 4 états à 375 px. Je l'ai lancé sur trois builds de galerie : prototype `?co2=a`, prototype `?co2=b`, branche.
- grilles 911 et 903 ;
- états zéro (vierge), moitié (environ la moitié de la limite), limite (solution de référence) et dépassée (une centrale sans CO₂ remplacée par des TAC) ;
- 1280 et 375 px.

**Constat** :

| Élément | Attendu | Branche |
|---|---|---|
| Jauge | continue, comme C-A | barre continue, une couleur par centrale, de même longueur que C-A dans les 4 états |
| Points dépensés et restants | en tête de carte | « CO₂ 27 points sur 28 », et à droite « 1 restant » ou « 7 de trop », comme C-A et C-B |
| Légende | comme C-B, chiffres en graisse normale | pastille, nom et points par case, sur la même ligne et dans le même ordre que C-B ; chiffres en `.per` encre, non gras (gras dans C-B) |
| Ordre de la légende | | du plus au moins cher, à égalité dans l'ordre du carnet : charbon 3, import d'Allemagne 3, TAC 2, gaz 1, import du Royaume-Uni 1 (903), comme les prototypes |
| Émetteurs posables seulement | | 911 : la légende ne montre que « TAC 2 », puisque le nucléaire ne coûte rien et que les imports du Royaume-Uni et de Belgique sont impossibles ce jour-là |
| Publication « Limite CO₂ » | réduite à la limite | « Aujourd'hui : 4 points de CO₂ au plus. » (911), identique aux prototypes ; « ! » rouge une fois la limite dépassée |
| Légende des pays sous la grille | sans CO₂ si l'import est impossible | 911 : « Royaume-Uni · 1 bloc par créneau » et « Belgique · 1 bloc par créneau », sans CO₂. 903 : le CO₂ reste sur les trois pays importables (Espagne à 0 compris). Identique au prototype |
| Téléphone, 375 px | | même carte, légende repliée sur 2 lignes, aucun défilement horizontal |

## Remarques (sans écart)

- **Dépassement peu visible sur la jauge.** Au-delà de la limite, la jauge reste une barre pleine aux couleurs des centrales. Le liseré rouge `.gauge.over .track` est masqué par les segments, comme sur C-A. Le dépassement se lit dans « 7 de trop » et le « ! » rouge de la publication. Signalé par l'auteur ; c'est le rendu C-A qui a été choisi. À revoir si l'humain veut un signal visible sur la jauge.
- **Accessibilité de la légende.** `aria-label` sur un `div` sans rôle (`renderCo2`, `panels.ts`) : les lecteurs d'écran ignorent ce nom sur un élément générique. Un `role="group"` (ou une liste) le rendrait audible. Sans effet visuel.

## Fusion avec main

- `main` (`a1aaa80`) a avancé depuis la base de la branche. La fusion de `v3-co2` ne donne aucun conflit.
- Arbre fusionné : 428 tests verts, typecheck OK, build OK, `check-ui.mjs` 205/205.
