# S8.6 — Grande review v2, tour 3 : vérification finale

- **Vérifié** : branche `v2-fix-1` (52f5d12), worktree détaché `vfa`. Relecteur distinct des tours 1 et 2 et de leurs correcteurs.
- **Banc** : build de production (`vite preview` sur 4173 et 4672), `lab/run.sh` (8765 + 5173), Chrome 1280 / 375 / 320 px piloté par `playwright-core`.

## Verdict

**Oui : `main` peut recevoir `v2-fix-1` et être publié.**
- 0 bloquant, 0 à corriger.
- Tous les contrôles automatiques sont verts.
- Les 4 parties jouées à la main vont au verdict sans erreur console. Les 2 impressions tiennent sur une page A4.
- Restent **5 décisions humaines** (déjà connues), **3 mineurs** et **1 point non vérifié** (§3). Aucun ne bloque la publication.
- Seul effet visible à la publication : G11 reste affichée **Expert** alors que le solveur la note Facile (attente de la décision q851).

## 1. Contrôles automatiques

| Contrôle | Résultat |
|---|---|
| `solver/.venv/bin/pytest -q` | OK : 172 verts (3 min 12 s). 2 avertissements `DeprecationWarning` venus d'un import tiers, sans effet |
| `pytest lab/tests -q` | OK : 54 verts |
| `npm test` | OK : 9 fichiers, 380 verts |
| `npm run typecheck` | OK |
| `npm run build` | OK : JS 106,8 kB (35,4 kB gzip). `web/dist` = `index.html`, `icon.svg`, `assets/`, sans labo |
| `check_unique.py` | OK : 13 grilles uniques, égales à leur référence et déduites ; G11 `rating=1 (stored rating 4)`, attendu |
| `dispatch-solver check-published` | OK, rampes acceptées |
| `web/scripts/check-ui.mjs` (1280/375/320) | OK : 205/205 |
| `S8-tour1-A/scripts/play.mjs` | OK : 312/312 |
| `S8-tour1-A/scripts/nav.mjs` | OK : 81/82, seul KO celui attendu depuis le tour 1 (fin de tabulation sur `body`) |
| `S8-tour1-A/scripts/lab.mjs` | OK : 24/24 |
| `S8-tour2/scripts/lab-two-players.mjs` | OK : 8/8 sur données du labo vides (voir mineur R1) |
| `convert-grids.ts` | OK : refus, « grids 12, 13 would be lost », code 1 |
| `dispatch-solver check /nope.json` | OK : message sur stderr, code 2 (N2) |

## 2. Parties jouées à la main (Chrome, coup par coup)

| Partie | Largeur | Déroulé | Résultat |
|---|---|---|---|
| Grille du jour, G11 n° 214 « Plateau d'après-midi » | 1280 px, souris | Pose fausse (ruban 12h-21h en haut), Annuler, rechargement (plateau restauré vide), exports 9h et 21h, 9 rubans | OK : « Programme bouclé », 3 sur 3 indices |
| G7 STEP | 375 px, tactile | Ruban faux, Gomme (« Retiré : … »), paire STEP 9h ▲ / 12h ▼, 2 imports, 7 rubans | OK : « les 7 indices sont vrais », 7 sur 7 ; puces des centrales sur 2 lignes, STEP entière (N4) |
| G12 tutoriel rampe | 320 px, tactile | Rampe hors silhouette refusée (« hors de la silhouette à 8h »), puis solution | OK : verdict, pas de défilement horizontal |
| Labo, `nuit-rampe` candidate 2 | 1280 px | Joueur 1 à l'aveugle, note 3 + commentaire. Joueur 2 avec une pose fausse, Annuler, note 2 sans commentaire | OK : note solveur masquée avant la note ; `notes.json` garde 2 notes et le commentaire de J1 ; J2 voit « Joueur 1 : rampe vue tout de suite » et « Joueur 1 : 3 » après sa note ; `plays.jsonl` : `undos: 1` pour J2 |
| Labo, abandons | 1280 px | Pose refusée + 1 coup, rechargement après 11 s ; ouverture seule, rechargement à 3 s ; bouton Abandonner | OK : `unload`, `errors: 1`, `attempt: 2` ; puis `phantom: true`, `attempt: 1` |
| Impression G11 et G13 | A4 | `#/imprimer/11`, `#/imprimer/13` | OK : 1 page chacune, silhouette, pastilles, « Bilan du jour », carnet de rampe lisible |

Données du labo effacées après les essais. Serveurs arrêtés.

## 3. Corrections des tours 1 et 2 (échantillon des « à corriger »)

Toutes tiennent.
- **Rejoué en navigateur** :
  - A1 : compte des indices du verdict (G7, 7 sur 7) ;
  - A5 / C8 : noms des techniques en français dans la révélation (« Inventaire épuisé », « Pas de place ») ;
  - C10 : abandon fantôme ;
  - N1 : commentaires par joueur ;
  - N4 : puces sur 2 lignes à 375 px.
- **Mesuré ici** :
  - C1 : G11 notée 1 ;
  - C7 : `check-published` accepte les rampes ;
  - C11 : le convertisseur refuse d'écraser ;
  - N2 : code de sortie 2.
- **Tests nommés présents et verts** : C1 `test_room_checks_a_bar_against_the_day_total`, C2 `test_ramp_relay_needs_proof`, C3 `test_ramp_lone_skips_sure_coal_cells`, C5 `test_ramp_relay_comes_before_share_out`, C6 `test_step_count_from_a_clue_shapes_the_board`, C10 `test_a_stray_open_is_not_an_attempt`, N1 `test_each_player_keeps_their_own_comment` et `test_older_single_comments_are_kept`.

## 4. Ce qui reste, pour l'humain

### Décisions en attente (connues, avis au tour 2 §4)
1. **G11 publiée : Expert ou Facile** (q851). `RATING_PENDING = {11: 1}` dans `test_published.py`. Publier en l'état affiche toujours « Expert ».
2. **Indices de confort** de G8 (flux 6h) et G7 (programme 15h) : à garder, et à noter dans la règle de sélection des indices.
3. **Intro du tutoriel 3** : texte de `grids.json` à reprendre.
4. **Escalier** : jouable ou refusé par `validateGrid`.
5. **Poids du dépôt** : `docs/reviews/` pèse **203 Mo**. Il faut décider du `.gitignore` des captures et d'une éventuelle réécriture de l'historique. Ce rapport n'ajoute aucune capture.

### Mineurs (nouveaux, non bloquants)
- **R1. Scripts de review non indépendants** : `lab.mjs` laisse une note et un commentaire (« revue S8.1 ») dans `lab/notes.json`. Lancé juste après, `lab-two-players.mjs` sort 5/8. Il sort 8/8 sur des données vides. Il faudrait effacer les données au début de chaque script, ou documenter l'ordre.
- **R2. Labo : compte d'indices incohérent** : sur `nuit-rampe` n° 2, la fiche dit « Indices 0 » et la ligne « Indices » de la révélation est vide. Pourtant, le jeu affiche « 1 sur 1 vérifié » (la ligne d'échanges de l'inventaire exact). La correction A1 (`shownClueCount`) n'a pas été portée au labo.
- **R3. Labo : surtitre « Grille notée »** sur une candidate jouée à l'aveugle. Ce n'est pas une note, mais le mot peut troubler un testeur à qui l'on cache la note.

### Non vérifié
- **Fermeture d'onglet en cours de partie au labo** : avec la fermeture d'un contexte Chrome headless, aucune ligne `abandoned` n'est écrite (2 essais). Le rechargement, lui, est bien journalisé. Il faut confirmer dans un Chrome à l'écran : la fermeture d'un vrai onglet déclenche normalement `pagehide`.
