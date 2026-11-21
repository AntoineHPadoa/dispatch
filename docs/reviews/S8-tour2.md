# S8.4 — Grande review v2, tour 2 : contrôle des corrections, régressions, regard neuf

- **Relu** : branche `v2-fix-1` (74a091e), worktree `v2-review-2`. Relecteur distinct des auteurs de S8.1, S8.2 et S8.3.
- **Banc** : build de production (`vite preview` sur 4672 et 4173), `lab/run.sh` (8765 + 5173), Chrome piloté par `playwright-core` 1.48.2.
- **Verdict** : **24/24 corrections vérifiées**. Constats nouveaux : **0 bloquant, 1 à corriger, 4 mineurs**.

## Commandes

| Commande | Résultat |
|---|---|
| `solver/.venv/bin/pytest -q` | 172 verts, 3 min 14 s |
| `pytest lab/tests -q` | 49 verts |
| `npm test` | 9 fichiers, 379 verts |
| `npm run typecheck`, `npm run build` | OK (JS 106,6 kB, 35,3 kB gzip) |
| `check_unique.py` | `OK` ; G11 `rating=1 (stored rating 4)`, en attente |
| `web/scripts/check-ui.mjs` (1280/375/320) | 205/205 |
| `S8-tour1-A/scripts/play.mjs` | 312/312 : 13 grilles × 3 largeurs jusqu'au verdict, dont STEP (G7) et rampe (G12, G13) |
| `S8-tour1-A/scripts/nav.mjs` | 81/82 ; seul KO, celui attendu de A (fin de tabulation sur `body`) |
| `S8-tour1-A/scripts/lab.mjs` | 24/24 ; données du labo effacées après |
| `dispatch-solver check-published` (sans option) | `OK`, rampes acceptées |
| `npx tsx scripts/convert-grids.ts` | refus : « grids 12, 13 would be lost » |

## 1. Corrections vérifiées

Preuves : « test » = test nommé, vert ; « Chrome » = rejoué en navigateur ici ; « mesure » = script lancé ici.

| Constat | Vérifié | Preuve |
|---|---|---|
| A1 compte d'indices du verdict | Oui | Chrome : G7 « les 7 indices sont vrais » sous « 7 sur 7 » (`S8-tour2/g7-chips-375.png`) ; test `shownClueCount` |
| A2 puces de la fiche à 1280 px | Oui | Chrome : puces Nucléaire / Allemagne visibles à 1280 px, fiche ouverte et bouclée |
| A3 « Sept grilles guidées » | Oui | `fr.ts` : chapeau sans nombre ; capture dossier de `nav.mjs` |
| A4 « Une centrale est un rectangle » | Oui | `fr.ts` : règle « forme fixe… rampe » |
| A5 noms des techniques du labo | Oui | `techniqueLabel` lit `TECHNIQUES` ; test `lab-logic` sur chaque id ; `lab.mjs` 24/24 |
| B C1 pose × totaux du jour | Oui | tests `test_room_checks_a_bar_against_the_day_total`… ; mesure : G11 passe de `refuted` à 4 étapes (2 `record`, 1 `room`, 1 `silhouette`) |
| B C2 `ramp_relay` sans preuve | Oui | `test_ramp_relay_needs_proof` ; lecture : borne par lignes distinctes de l'autre côté |
| B C3 `ramp_lone` et cases sûres | Oui | `test_ramp_lone_skips_sure_coal_cells` |
| B C4 plateau / épaule = étiquettes | Oui | `RAMP_LABELS` / `RAMP_OWN`, stat `ramp_grids_with_own_technique`, NUIT.md |
| B C5 ordre de `ramp_relay` | Oui | rangée avant `share_out` ; `test_ramp_relay_comes_before_share_out` |
| B C6 STEP au niveau `none` | Oui | `with_clues` compare `rules.step` ; `_Judge` part des indices obligatoires ; test |
| B C7 `check-published` et rampes | Oui | mesure : `OK` sans option ; `--no-ramp` refuse (test) |
| B C8 seconde table d'étiquettes | Oui | `TECHNIQUE_LABELS` supprimée |
| B C9 agrégats sur `attempt` 1 | Oui | `playStats` filtre `phantom` puis `attempt` ; test |
| B C10 abandon fantôme | Oui | Chrome : ouverture sans coup, rechargement à 3,5 s → `reason: unload`, `moves: 0`, `phantom: true` dans `plays.jsonl` |
| B C11 `npm run convert` | Oui | script npm retiré ; mesure : refus d'écraser, ids 12 et 13 |
| B C12 tests couplés à `grids.json` | Oui | plus aucun `slice(7…)`, `toHaveLength(9)`, `grids[5]` ni `=== 12` dans `web/tests/` |
| B C13 test daté | Oui | `today` passé à `playOrder` et `nextGrid` |
| B C14 « Sept grilles » | Oui | même correction que A3 |
| B C15 focus de la pastille d'export | Oui | Chrome : candidate `nuit-jouer-b` n° 1 (BE, UK), Entrée sur `export|1|UK` → le focus reste sur `export|1|UK` |
| B C16 échanges « contredit » trop tôt | Oui | `settle` limité aux indices de cases ; test engine |
| B C17 CLAUDE.md | Oui | carte sans compte de grilles, `lab/` une fois, commandes à jour |
| B C18 skills | Oui | `add-grid` autour de la promotion, `deploy` cite le job `solver` |
| B C19 script navigateur commun | Oui | `check-ui.mjs` lancé : 205/205 |

**Mineurs laissés « non » ou « en partie » : les raisons tiennent.**
- **A8 insécables (en partie)** : tient. `frenchSpaces()` à l'affichage évite de réécrire des grilles publiées ; le bulletin est le seul texte libre long.
- **A15 intro du tutoriel 3 (non)** : tient. C'est du texte de grille publiée, il revient à l'humain (avis en §4).
- **A17 candidate rampe triviale (non)** : tient. C'est une observation pour le calibrage, pas un défaut.
- **B M1 fuzz différentiel (en partie)** : tient. Le job solveur n'a pas Node ; les 5 fixtures ajoutées couvrent les messages cités.
- **B M11 doublons (en partie)** : tient pour `StepTone` (cycle d'import). `ev.inventory` contre le carnet reste un vrai doublon, sans effet joueur : à traiter avec le prochain changement du carnet.
- **B M15 escalier (en partie)** et **B M17 poids (en partie)** : décisions humaines (§4).
- **B M16 textes périmés (en partie)** : tient. Le `'I'` restant de `panels.ts` est une clé de couleur, pas un id de pièce.

## 2. Régressions

Aucune trouvée. Contrôles :
- **Jeu** : 13 grilles × 3 largeurs jusqu'au verdict (`play.mjs`, `check-ui.mjs`), dont une grille STEP (G7) et deux grilles à rampe (G12, G13), sans erreur console ni défilement horizontal.
- **Impression** : une page A4 par grille (`check-ui.mjs`), `#/imprimer/tout` (`nav.mjs`).
- **Labo** : table, partie à l'aveugle, révélation, garde (`lab.mjs`), abandon au rechargement (C10).
- **Solveur** : les 13 grilles publiées restent uniques, égales à leur référence et déduites ; seule la note de G11 change (attendu, C1).
- **Progression** : l'empreinte `fp` est facultative à la lecture, donc les sauvegardes des joueurs actuels (sans `fp`) sont toujours rejouées. La clé `dispatch:progress:v1` est inchangée.

## 3. Constats nouveaux

### Bloquant

Aucun.

### À corriger

**N1. Labo : la note d'un 2e joueur efface le commentaire du 1er**
- **Où** : `lab/lab_server.py:306-307` (`rate_play`) et `:340-341` (`update_note`). `comment` est une seule chaîne par candidate, alors que `felt` est un dictionnaire par joueur. Le jeu envoie toujours le champ, même vide (`web/src/lab/end.ts:68`).
- **Effet** (mesuré, test ad hoc sur le serveur) : Joueur 1 note 4 avec « trop dur », puis Joueur 2 note 2 sans commentaire. `notes.json` contient alors `{'felt': {'Joueur 1': 4, 'Joueur 2': 2}, 'comment': ''}`. Le commentaire de Joueur 1 est perdu. C'est antérieur au tour 1, mais le masquage de M6 suppose des commentaires par joueur.
- **Correction** : `comment` en dictionnaire par joueur, comme `felt`, masqué de la même façon. L'écran de fin affiche le commentaire du joueur courant. Ajouter un test à 2 joueurs à côté de `test_comments_are_masked_like_felt_ratings`.

### Mineurs

**N2. CLI : un fichier absent sort en code 1, pas 2**
- `solver/src/dispatch_solver/cli.py:7` et le bilan S8.3 (M2) annoncent le code 2. Or `_load` fait `sys.exit(message)`, qui rend 1. Mesure : `dispatch-solver check /nope.json` → « cannot read… », code 1.
- **Correction** : `print(..., file=sys.stderr); sys.exit(2)`, ou corriger le texte.

**N3. En-tête périmé de `web/src/lab/play.ts:6`**
- L'en-tête dit « sendBeacon on pagehide », alors que M7 est passé à `fetch(..., {keepalive: true})`.
- **Correction** : « keepalive fetch on pagehide ».

**N4. Puces des centrales sur téléphone : la dernière est coupée sans indice de défilement**
- À 375 px, sur G7, la rangée de puces sous la grille (`.chips-row`, `web/src/styles/app.css:256`) coupe la puce STEP en « S ». La barre de défilement est masquée (`scrollbar-width: none`). Le joueur ne voit pas qu'elle défile.
- Capture : `S8-tour2/g7-chips-375.png`. Défaut antérieur, non relevé par A.
- **Correction** : un fondu sur le bord droit quand la rangée déborde, ou retour à la ligne (`flex-wrap`) sous 400 px.

**N5. Fiche bouclée : pointillés d'export et STEP dans la même colonne**
- `web/src/ui/home-art.ts:83-88` met en pointillé les `out` cases du haut de chaque colonne. Si la colonne a aussi un pompage (+1), c'est la case pompée, pas l'export, qui reçoit le pointillé. Une colonne turbinée garde, elle, la bonne hauteur.
- Aucune grille notée publiée n'a de STEP aujourd'hui, mais une promotion depuis le labo peut en apporter.
- **Correction** : ne compter que les exports au-dessus de la demande moins le turbinage, ou dessiner aussi la case pompée (▲).

## 4. Points en attente de l'humain (avis, sans trancher)

- **G11 publiée, Expert → Facile** : ne pas republier « Facile » tout de suite. La chute tient à une seule étape `room` qui croise deux colonnes et le total d'exports du jour, rangée au niveau 1. Mesuré : avec cette vérification en règle de niveau 2, G11 sort **Moyen**, en 5 étapes (G8 et G10 inchangées). Je la placerais au niveau 2, puis je ferais jouer G11 à l'aveugle au labo avant de changer l'étiquette.
- **Indices « inutiles » de G8 (flux 6h) et G7 (programme 15h)** : les garder. Sans eux, la grille reste unique, mais plus dure : G8 passe de 1 à **4** et G7 de 2 à **3** (mesuré). Ce sont des indices de confort, voulus pour un tutoriel et pour une grille Facile. Il suffit de le noter dans la règle de sélection des indices.
- **Intro du tutoriel 3** : adopter la proposition de S8.3 (« Touche une case de la rangée DE sous la grille pour exporter un bloc »). Le texte actuel nomme « pastille » ce qui, dans le jeu, est un indice. C'est un tutoriel, sans enjeu de note ni de progression.
- **Escalier, jouable ou refusé** : le refuser dans `validateGrid` (derrière une option, comme en Python) tant qu'aucun test moteur ne le pose. Le labo le refuse déjà, et aucune grille n'en a besoin pour le calibrage du trapèze.
- **Poids du dépôt** : `docs/reviews/` pèse maintenant **202 Mo** (163 Mo au tour 1), dont 25 Mo pour le seul `S8-tour1-A/after/`. Je mettrais un `.gitignore` sur `docs/reviews/*/` sauf les captures citées dans un rapport, et réserverais la réécriture de l'historique à une décision séparée. Ce rapport n'ajoute qu'une capture (0,3 Mo).

## Captures

- `S8-tour2/g7-chips-375.png` : G7 bouclée à 375 px, « les 7 indices » (A1 vérifié) et la puce STEP coupée (N4).
