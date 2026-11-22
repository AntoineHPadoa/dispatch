# Session de jeu 1 — 16 candidates à l'aveugle

But : jouer pour la première fois des candidates du labo, sans rien savoir d'elles, et dire à chaque fois si la grille est belle et pourquoi. Ces parties serviront en S3 à écrire les critères d'une belle grille.

## 1. Avant de jouer

- Lancer `lab/run.sh` depuis la racine du dépôt, puis ouvrir `http://localhost:5173/dispatch/lab.html`.
- Choisir son joueur dans la barre du haut (il ne change plus pendant une partie).
- Vérifier que **« Mode création » est désactivé** (bouton non surligné) : sinon la liste montre les notes et les techniques.
- Ne pas ouvrir l'annexe en bas de cette fiche avant la fin de la session.

## 2. Ordre de jeu

Le `n°` est celui qu'affiche le labo dans la liste du lot.

| # | lot | n° |
|---|---|---|
| 1 | nuit-jouer-a | 4 |
| 2 | nuit-jouer-c | 18 |
| 3 | nuit-jouer-c | 15 |
| 4 | nuit-jouer-b | 18 |
| 5 | nuit-jouer-c | 2 |
| 6 | nuit-jouer-c | 12 |
| 7 | nuit-jouer-b | 5 |
| 8 | nuit-jouer-b | 1 |
| 9 | nuit-jouer-b | 20 |
| 10 | nuit-jouer-b | 3 |
| 11 | nuit-rampe | 3 |
| 12 | nuit-jouer-a | 1 |
| 13 | nuit-jouer-a | 3 |
| 14 | demo-01 | 13 |
| 15 | nuit-jouer-b | 19 |
| 16 | nuit-rampe | 20 |

Pas besoin de tout jouer d'une traite : le labo garde chaque partie terminée. Si une grille est vraiment bloquante, « Abandonner » est aussi une information utile.

## 3. À chaque fin de partie

Sur l'écran de fin, **dans cet ordre** (le bouton « Valider et révéler » verrouille la note et le commentaire) :

1. **Difficulté ressentie** : 1 Facile, 2 Moyen, 3 Difficile, 4 Expert.
2. **Commentaire** : une phrase « belle / pas belle, parce que… ». Ce qui aide le plus en S3 :
   - le moment où ça se débloque (« tout tombe après le flux de 18h ») ou son absence ;
   - le type d'effort (« trop de calcul », « j'ai dû faire une hypothèse », « répétitif ») ;
   - un indice inutile ou au contraire indispensable ;
   - une mécanique qui ajoute ou qui encombre.
3. **Valider et révéler**.
4. **Garder** (☆ → ★) si tu la publierais ; ne rien faire vaut rejet.

## 4. Vérification en passant : fermeture d'onglet

Point non vérifié de `docs/reviews/S8-tour3.md` §4 : en headless, fermer l'onglet n'écrivait aucune ligne `abandoned`. À faire **sur la partie 3** (une grille courte) :

1. Ouvrir la partie, attendre environ 5 s **sans rien poser**, puis fermer l'onglet (Cmd+W).
2. Vérifier la dernière ligne du journal : `tail -n 1 lab/plays.jsonl`. Attendu : `"outcome": "abandoned"`, `"reason": "unload"`, `"phantom": true`, `"lot": "nuit-jouer-c"`, `"index": 14`.
3. Rouvrir le labo et jouer la partie 3 normalement. Comme l'ouverture sans coup est « fantôme », la vraie partie garde `attempt: 1` et reste exploitable pour le calibrage.

Si aucune ligne n'apparaît, le noter dans le commentaire de la partie 3 (« fermeture d'onglet non journalisée ») et le signaler.

## 5. Annexe — à ne lire qu'après la session

<details>
<summary>Notes du solveur, catégories et mécaniques des 16 grilles (spoilers)</summary>

### Composition de l'échantillon

- **Notes solveur** (recalculées S8.3) : 4 Facile, 4 Moyen, 4 Difficile, 4 Expert, jamais deux de suite de la même note, en commençant par une Facile.
- **Créneaux** : 2 × 6, 10 × 8, 4 × 12.
- **Lots** : jouer-a 3, jouer-b 6, jouer-c 4, rampe 2, demo-01 1.
- **Sans indice** : 3 (n° 1, 8 et 11 de l'ordre de jeu), dont une Expert (n° 11).
- **Rampe** : 3 grilles. Les 2 du lot `nuit-rampe` (dont la seule du lot qui emploie `ramp_lone`, « Une case seule est une épaule »), plus `demo-01` n° 13, seule Expert de tous les lots qui suive le schéma « astuce centrale ».
- **Mécaniques couvertes** : 1, 2 et 4 voisins, surplus, stock, STEP, plafond CO₂, pièces hautes, rampe ; inventaire exact (14) et inventaire libre (2).
- **Astuce centrale / difficulté étalée** : Moyen 2 / 2, Difficile 2 / 2, Expert 1 / 2 (+ 1 non classée). Les Faciles sont « sans objet » (aucune étape au-dessus du niveau 1).

### Règle de classement

Sur la trace de `dispatch-solver deduce`, chaque étape a un niveau (1 : pas de place, plus haut, colonne pleine… ; 2 : ruban, compter la colonne, inventaire juste, plafond carbone, case seule épaule ; 3 : répartition de l'inventaire ; 4 : hypothèse réfutée). Une étape « dure » est de niveau 2 ou plus ; le « pic » est l'ensemble des étapes au niveau maximal de la grille (sa note).
- **Astuce centrale** : le pic tient en 1 à 3 étapes consécutives, il y a au plus 2 autres étapes dures dans toute la trace, et le pic est suivi d'au moins 3 étapes dont 75 % au moins de niveau 1 (la cascade).
- **Difficulté étalée** : au moins 3 étapes dures, réparties en au moins 2 passages séparés par des étapes de niveau 1.
- **Non classée** : le reste (ex. un seul long bloc dur, ou la clé en toute dernière étape).

Sur les 65 candidates non Faciles des 6 lots, la règle donne 14 astuces, 25 étalées et 26 non classées. Par note : Moyen 9 / 11 / 21, Difficile 4 / 4 / 1, Expert 1 / 10 / 4. Les Expert sont presque toutes étalées : la réfutation y arrive après plusieurs étapes dures.

Notation des traces ci-dessous : un chiffre par étape, son niveau.

### Les 16 grilles

| # | lot n° | Note solveur | Créneaux | Indices | Mécaniques | Catégorie | Trace et pourquoi |
|---|---|---|---|---|---|---|---|
| 1 | jouer-a 4 | Facile | 12 | 0 | 1 voisin, surplus, inventaire exact | sans objet | `11111111` : 8 étapes de niveau 1. |
| 2 | jouer-c 18 | Moyen | 8 | 3 (colonne, flux) | 4 voisins, inventaire exact | astuce centrale | `11111111221111` : 2 rubans consécutifs (étapes 9-10), puis 4 étapes de niveau 1. |
| 3 | jouer-c 15 | Facile | 6 | 1 (flux) | 1 voisin, inventaire exact | sans objet | `111111`. Sert aussi au test de fermeture d'onglet. |
| 4 | jouer-b 18 | Difficile | 8 | 1 (flux) | 2 voisins, inventaire exact | astuce centrale | `11111332111` : 2 répartitions d'inventaire (étapes 6-7) puis « inventaire juste » et 3 étapes de niveau 1. Cascade courte. |
| 5 | jouer-c 2 | Moyen | 6 | 1 (colonne) | 1 voisin, stock, inventaire exact | difficulté étalée | `1111222111112` : 2 rubans et un inventaire juste (étapes 5-7), puis un « compter la colonne » à la fin. |
| 6 | jouer-c 12 | Facile | 8 | 1 (colonne) | STEP, plafond CO₂, inventaire exact | sans objet | `111111`. |
| 7 | jouer-b 5 | Expert | 8 | 2 (échanges ×2) | 1 voisin, plafond CO₂, inventaire libre | difficulté étalée | `2113333411111111112` : plafond carbone (étape 1), 4 répartitions puis une hypothèse réfutée (étapes 4-8), un dernier « compter la colonne » (étape 19). Limite : 10 étapes faciles suivent la réfutation, mais elle est préparée par 4 répartitions. |
| 8 | jouer-b 1 | Difficile | 8 | 0 | 2 voisins, surplus, inventaire exact | astuce centrale | `1131111111` : une seule répartition (étape 3), puis 7 étapes de niveau 1. Le cas le plus pur de l'échantillon. |
| 9 | jouer-b 20 | Moyen | 8 | 1 (colonne) | 2 voisins, STEP, inventaire exact | astuce centrale | `111211111` : un seul « compter la colonne » (étape 4), puis 5 étapes de niveau 1. |
| 10 | jouer-b 3 | Facile | 8 | 6 (barre, colonne, échanges, prix) | 2 voisins, surplus, inventaire libre | sans objet | 14 étapes de niveau 1 : facile mais longue, beaucoup d'indices. |
| 11 | rampe 3 | Expert | 8 | 0 | rampe, inventaire exact | non classée | `33342422411111111` : un seul bloc dur de 9 étapes en tête (3 répartitions, 3 réfutations, 3 rubans), puis 8 étapes de niveau 1 dont plateau et épaule. Ni étape isolée ni difficulté répartie : « gros bloc puis cascade ». |
| 12 | jouer-a 1 | Difficile | 8 | 3 (colonne, flux) | 1 voisin, pièces hautes, inventaire exact | difficulté étalée | `1111122333131131111212` : 9 étapes dures en 5 passages sur 22 (rubans, 5 répartitions, 2 « compter la colonne »). |
| 13 | jouer-a 3 | Moyen | 8 | 1 (colonne) | stock, inventaire exact | difficulté étalée | `211221212` : 5 étapes dures en 4 passages sur 9 ; aucune cascade. |
| 14 | demo-01 13 | Expert | 12 | 3 (colonne, flux) | 1 voisin, rampe, inventaire exact | astuce centrale | `1111444` puis 32 étapes de niveau 1 : 3 hypothèses réfutées d'affilée (étapes 5-7), puis une longue cascade dont 15 étapes de rampe (plateau, épaule). Seule Expert « astuce » des 6 lots. |
| 15 | jouer-b 19 | Difficile | 12 | 2 (barre, colonne) | 1 voisin, stock, inventaire exact | difficulté étalée | `3331111321112` : 3 répartitions d'emblée, une 4e et un inventaire juste au milieu (étapes 8-9), un « compter la colonne » à la fin. |
| 16 | rampe 20 | Expert | 12 | 1 (colonne) | 1 voisin, surplus, rampe, inventaire exact | difficulté étalée | `1121333232334111` : 10 étapes dures ; la case seule épaule (`ramp_lone`, étape 3), 6 répartitions et 2 rubans, la réfutation à l'étape 13, puis 3 étapes faciles. |

### Ce qu'il faudra regarder en S3

- Les astuces centrales (n° 2, 4, 8, 9, 14) sont-elles plus souvent gardées et commentées « ça se débloque » que les étalées (n° 5, 7, 12, 13, 15, 16) de même note ?
- La n° 11 (sans indice, gros bloc dur) et la n° 7 (cas limite) départagent les deux lectures.
- Les Faciles servent de témoin : une grille sans difficulté peut-elle être « belle » ?

</details>
