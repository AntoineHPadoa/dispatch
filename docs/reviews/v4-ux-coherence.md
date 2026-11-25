# Cohérence de l'UX d'une grille sur ordinateur (S3.3)

Audit de l'écran de jeu à 1280 px, branche `v2-ux-desktop` au commit `31f0f39` (S2.3 à S2.5 faits, S2.6 « ordre des publications » pas encore : l'ordre décrit ici est l'ancien). Lecture seule, pas de code. Captures dans `v4-ux-coherence/`.

## Synthèse

1. **Un même échange est dit 4 à 5 fois avec 3 noms de pays différents.** Les quotas ne concordent pas : la centrale import affiche `∞` alors que la publication donne 4.
2. **Le violet sert à tout ce qui touche un pays.** Import posé, relevé d'import, export enregistré et case exportée : seule une flèche de 9 px les distingue.
3. **Le vocabulaire flotte.** Pour l'unité : *case*, *bloc*, *barre*, *GW*. Pour le panneau : *carnet d'ordres*, *centrales disponibles*, *liste*. Pour les règles : *indices*, *publications*.
4. **Les états vérifié / contredit / ouvert ont 3 rendus différents** selon l'endroit : rond, badge ou texte vert. Le compteur d'en-tête ignore les publications contredites.
5. **Les signes posés sur le plateau ne suivent aucun modèle commun.** Pastilles d'heure : `€ Nucl.`, `4`, trait coloré, cadenas. Cases ajoutées ou retirées : 4 pointillés différents, sans légende. La colonne de droite change de place selon la largeur de la grille.

## Grilles jouées

Jouées dans Chrome (Playwright, clics réels) au départ, à mi-partie, à la fin, et dans des états faux. Les candidats du labo ont été servis par la build « galerie » (`DISPATCH_GRIDS`), sans passer par le labo ni écrire dans `plays.jsonl`.

| Capture | Grille | Ce qu'elle couvre |
|---|---|---|
| `01` | tuto 8 (id 12) | rampe de charbon `stair`, 6 colonnes, carnet exact |
| `02` | tuto 7 (id 7) | STEP, 1 pays, programme, relevé, prix, flux |
| `03` | n° 213 (id 10) | 1 pays, sans carnet exact, consigne |
| `04` `05` | `v3g2-jouer-c:4` | STEP + export + CO₂ + 7 indices, sans carnet exact |
| `06` | `v3g2-jouer-c:16` | 3 pays, 2 flux |
| `07` | `v3-jouer-c:19` | 4 pays, imports et exports mêlés, carnet exact |
| `08` `09` | `v3-jouer-c:13` | 12 colonnes, 12 indices, 1 prix contredit |
| `10` | `v3g3-jouer-a:15` | rampe `trap` 3–4, import publié, CO₂ |
| `11` | `v3g3-jouer-b:13` | STEP + rampe + export, carnet exact |
| `12` | tuto 2 (id 2) | grille pleine mais un prix faux |
| `z-*` | — | zooms ×2 des zones citées |

---

## Incohérences fortes

### F1. Le quota d'import n'est pas le même dans les centrales et dans les publications

![](v4-ux-coherence/z-g205-centrales-publications.png)

- **Où** : la ligne « Import d'Italie » des centrales affiche `3 / ∞`. La publication dit « Italie : ↓ 4 imports » et le compteur sous la rangée IT `↓ 3/4` (`10`). Même cas sur la n° 213 : `Import d'Allemagne 0 / ∞` face à « ↓ 2 imports » et `↓ 0/2` (`03`).
- **Pourquoi ça gêne** : deux nombres différents pour la même quantité, sur un même écran. Le joueur ne sait plus lequel croire. `∞` laisse penser qu'il peut importer sans limite.
- **Proposition** : le dénominateur de la centrale import reprend le total publié, comme S2.4 l'a fait pour la STEP (« 0 / N »). `∞` seulement quand aucun total n'est publié nulle part.

### F2. Un échange est dit 4 à 5 fois, avec 3 noms de pays

![](v4-ux-coherence/z-g204-exchange-rows.png)

- **Où** (`07`, 4 pays, carnet exact), pour un seul import d'Italie :
  - la centrale « Import d'Italie — 1 / 1 » ;
  - la case violette `IT` sur le plateau ;
  - le relevé `↓1` dans la rangée IT ;
  - le compteur `↓ 1/1` sous la rangée ;
  - la publication « Italie : ↓ 1 import ».
- **Les noms** : la rangée s'appelle `IT`, sa légende « Italie · 1 bloc par créneau », la centrale « Import d'Italie », la case du plateau `IT`.
- **Pourquoi ça gêne** : l'œil fait des allers-retours entre 5 endroits pour une seule information. Le relevé `↓1` ressemble à une action à faire alors qu'il ne fait que recopier la case du plateau. Le code pays (`UK`, `BE`) n'est expliqué que par la petite légende.
- **Proposition** :
  - **Une place par rôle** : la publication porte l'indice ; le compteur sous la rangée porte la progression ; la centrale import porte le nombre posé, sans quota s'il est déjà publié.
  - **Le relevé d'import** devient une trace discrète (contour seul, sans fond), ou disparaît si le compteur suffit.
  - **Le nom** de la rangée est le nom complet (« Italie »), le code reste sur la case du plateau.

### F3. Le violet couvre 4 objets différents, que seule la flèche distingue

![](v4-ux-coherence/z-g202-step-axis.png)

- **Où** :
  - import posé : case violette pleine `DE` ;
  - relevé d'import : case violette pleine `↓1` ;
  - export enregistré : case violette pleine `↑1` ;
  - case exportée sur le plateau : pointillé violet, posé par-dessus une barre une fois couverte (`02`, `05`, `07`, `11`).
- **Pourquoi ça gêne** : dans la rangée pays, `↑1` et `↓1` ont le même fond, la même bordure et la même taille. Seule la flèche (≈ 9 px) indique le sens, alors qu'export et import n'agissent pas du tout pareil sur la grille : l'un ajoute de la demande, l'autre la couvre.
- **Proposition** : une règle de forme valable partout.
  - **Export** : toujours en contour pointillé violet, dans la rangée pays comme sur le plateau. C'est le pointillé que la case exportée a déjà.
  - **Import** : toujours en violet plein, sur le plateau et dans la centrale.

  Le sens se lit alors sans lire la flèche.

### F4. Unité et objets : case, bloc, barre, GW, créneau, centrale, pièce

- **Où** :
  - la légende pays « Espagne · **1 bloc** par créneau · CO₂ 0 par **case** » mélange deux unités sur une même ligne (`z-g202-step-axis`) ;
  - le flux « À 3h, 1 **bloc** part vers l'Espagne », le relevé « 1 **case** de nucléaire » ;
  - les erreurs « La **barre** dépasse… », « Plus de **barre** … dans le carnet », « Carnet épuisé : quand toutes les **cases** d'une **pièce** sont trouvées… » ;
  - le message de pose « **Nucléaire** de 15h à 24h » nomme la centrale ;
  - le charbon porte « 2 GW » sur la barre (`11`), aucune autre barre n'a d'étiquette.
  - Dans `fr.ts` : 73 *case(s)*, 32 *barre(s)*, 27 *bloc(s)*, 25 *centrale(s)*, 6 *pièce(s)*.
- **Pourquoi ça gêne** : le joueur se demande si un *bloc* d'échange vaut une *case* de grille. Il le vaut, mais rien ne le dit.
- **Proposition** : trois mots, chacun pour un seul usage.
  - ***case*** : unité de la grille (1 créneau × 1 GW), y compris pour les échanges (« 1 case part vers l'Espagne », « 1 case par créneau »).
  - ***centrale*** : le type (Nucléaire, Gaz).
  - ***barre*** : une centrale posée.

  On abandonne *bloc* et *pièce*. *Bloc* est un mot naturel pour l'énergie : le choix entre *case* et *bloc* est à faire par l'auteur, l'important est de n'en garder qu'un.

---

## Incohérences moyennes

### M1. Le panneau des centrales change de nom selon le niveau de carnet

- **Où** : « Carnet d'ordres » (carnet exact, `02`, `07`) ou « Centrales disponibles — formes autorisées, quantités à déduire » (`03`, `04`). Le surtitre « SANS CARNET EXACT » et une consigne « Sans carnet exact. Il faudra répartir les **barres** » répètent la même info (`03`). L'aide sous les outils dit « Change de centrale dans **la liste** » ou « dans **le carnet** ».
- **Pourquoi ça gêne** : c'est le même panneau, au même endroit, avec le même rôle. Le nom change alors que seule la nature des quantités change. Sur `03`, l'information « sans carnet exact » apparaît trois fois.
- **Proposition** : un titre fixe, « Centrales ». Le niveau se lit à la place du compteur : `3 / 5` pour un carnet exact, `3 posées` sinon. On garde une seule mention de « sans carnet exact » (la consigne du bulletin si elle existe, sinon le surtitre), et l'aide dit toujours « dans les centrales ».

### M2. Les pastilles sous les heures n'ont pas de modèle commun

![](v4-ux-coherence/z-g201-axis-pills.png)

- **Où** :
  - prix : texte abrégé `€ Nucl.`, `€ Gaz`, `€ Barr.`, sur fond couleur de la centrale ;
  - relevé : un chiffre seul (`4`, `2`) sur fond couleur, sans nom de centrale ;
  - programme : un trait coloré entre la grille et les heures, sans libellé ;
  - flux : un cadenas dans la case de la rangée pays, avec `↑1`, ou vide si la valeur vaut 0 (`z-g204-exchange-rows`, IT 21h).
  - Les publications ont chacune une icône (étiquette, histogramme, calendrier, double flèche), qu'on ne retrouve jamais sur le plateau.
- **Pourquoi ça gêne** : un relevé de nucléaire (jaune) et un de charbon (beige) ne se distinguent que par une nuance de fond. Le chiffre seul ne dit pas s'il s'agit d'un relevé ou d'une autre contrainte. Le lien entre une pastille et sa publication reste à deviner.
- **Proposition** : une seule forme de pastille, [icône de la publication] + [valeur] + [point couleur]. Pour le prix : 🏷 + point jaune. Pour le relevé : 📊 4 + point jaune. Pour le flux : ⇄ dans la rangée pays. Le programme garde son trait, avec l'icône calendrier à son départ.

### M3. Vérifié, contredit et ouvert se lisent de 3 façons

- **Où** :
  - publications : rond vert coché, rond rouge « ! », rond vide ;
  - pastilles d'heure, trait de programme et flux : mini-badge coché ou « ! » ; rien quand l'état est ouvert ;
  - compteurs d'échanges : texte vert sans coche quand c'est atteint (`↑ 1/1`), gris sinon, et pas d'état « dépassé » visible ;
  - en-tête : « 1 sur 12 vérifié » alors qu'une publication est contredite (`09`) : le contredit n'est pas compté.
- **Pourquoi ça gêne** : le joueur qui balaye l'écran pour trouver ce qui cloche doit lire 3 codes différents. L'en-tête rassure (« 1 vérifié ») alors qu'il y a une erreur.
- **Proposition** :
  - **Mêmes signes partout** : le même badge (coche verte, « ! » rouge) sur pastille, trait, compteur et publication.
  - **En-tête** : « 1 vérifiée · 1 contredite · sur 12 ».
  - **Compteurs d'échanges** : badge coche quand c'est atteint, « ! » quand c'est dépassé.

### M4. Les cases ajoutées ou retirées de la silhouette ont 4 dessins, sans légende, et la STEP porte la couleur du barrage

![](v4-ux-coherence/z-g207-board.png)

- **Où** (`02`, `05`, `11`, `z-g202-step-axis`) :
  - case exportée : pointillé violet ;
  - case pompée : pointillé bleu (la couleur du barrage, `board.ts:501`) ;
  - case turbinée : pointillé gris barré d'une diagonale ;
  - surplus météo : pointillé rouge, plus un trait noir pointillé qui marque la demande sous les cases `R` (`board.ts:483-489`).
  - Les cases météo ne portent qu'une lettre, `R` ou `F`, jamais expliquée à l'écran.
  - Les pastilles ▲/▼ de la STEP sont bleu barrage ; sur le tuto 2, le barrage est la même teinte (`12`).
- **Pourquoi ça gêne** : le trait noir pointillé et la lettre `F` sont incompréhensibles sans lire les règles. Une case pompée bleue se lit comme « mettre du barrage ici ».
- **Proposition** :
  - **Une seule famille** : pointillé = la demande a bougé. Couleur du contour = la cause (violet export, teinte propre à la STEP). Signe dans la case : ▲ ajoutée, ▼ retirée.
  - **Une ligne de légende** sous le plateau, affichée seulement si la grille en a besoin : « R renouvelable · F fil de l'eau · ┄ demande avant météo ».
  - **Une teinte STEP** distincte du barrage.

### M5. La mise en page bouge d'une grille à l'autre

- **Où** :
  - la colonne de droite commence à x = 490 px (6 colonnes, `01`, `12`), 632 px (8 colonnes) ou 848 px (12 colonnes, `08`) ;
  - à 12 colonnes, « formes autorisées, quantités à déduire » passe sur une deuxième ligne ;
  - la carte du plateau garde 100 à 200 px vides au-dessus des grilles à 8 colonnes (`03`, `06`, `07`), mais pas au-dessus de celles à 6 ;
  - les outils (Gomme, Annuler, Recommencer) et le message de pose sont centrés sous la carte, alors que le bandeau de fin et « Grille suivante » sont alignés à gauche (`05`).
- **Pourquoi ça gêne** : d'une grille à l'autre, le joueur ne retrouve pas les centrales et les publications au même endroit. Le vide au-dessus du plateau fait croire à une partie manquante. Le bandeau de fin semble détaché des outils.
- **Proposition** :
  - **Colonne de droite** de largeur fixe (≈ 520 px), calée à droite du conteneur ; le plateau prend le reste.
  - **Hauteur de la carte** : la place au-dessus du plateau n'est réservée que si la grille permet exports ou pompages, et seulement à leur hauteur maximale.
  - **Outils, message et bandeau** sur un même axe (tous centrés ou tous à gauche).

### M6. Le CO₂ est réparti entre trois endroits, dans deux ordres différents

- **Où** (`10`, `z-g205-centrales-publications`) :
  - la limite est une publication (« 32 points de CO₂ au plus ») ;
  - la jauge est dans un panneau séparé (« CO₂ 8 points sur 32 — 24 restants ») ;
  - les coûts par case sont dans la légende de ce panneau (« Charbon 3, TAC 2, Import d'Italie 2, Gaz 1 », triés par coût) et dans la légende de la rangée pays (« CO₂ 2 par case ») ;
  - les centrales, triées par ordre de mérite, n'affichent pas leur coût.
- **Pourquoi ça gêne** : pour choisir une centrale, il faut chercher son coût deux panneaux plus bas, dans un autre ordre.
- **Proposition** :
  - **Coût dans les centrales** : chaque ligne de centrale porte son coût (« CO₂ 2 ») quand la grille a une limite.
  - **Jauge dans la publication** : la publication « Limite CO₂ » porte la jauge (8 / 32) ; le panneau séparé disparaît.
  - **Légende pays** : elle ne répète plus le coût.

### M7. Fin de partie : indices ou publications, et rien quand la grille est pleine mais fausse

- **Où** :
  - le bandeau dit « Toutes les cases sont couvertes et les 7 **indices** sont vrais », sous un panneau « **Publications** du marché — 7 sur 7 vérifiés » (`05`) ;
  - l'en-tête accorde au masculin (« vérifiés », sous-entendu *indices*) sous le titre *Publications* ;
  - une grille pleine dont un prix est faux n'a pas de bandeau (`12`) : seul le message de la dernière pose, en rouge, le signale.
- **Pourquoi ça gêne** : deux mots pour un même objet. Quand la grille est pleine sans être juste, le joueur n'a pas de point d'arrivée. Il doit comprendre seul qu'il n'a pas fini.
- **Proposition** :
  - **Un seul mot**, « publications », partout : bandeau « les 7 publications sont vérifiées », en-tête « 7 sur 7 vérifiées ».
  - **Un bandeau neutre** quand la grille est pleine mais fausse : « Toutes les cases sont couvertes, 1 publication est contredite ».

---

## Détails

| # | Où | Constat | Proposition |
|---|---|---|---|
| D1 | Centrales (`z-g202-centrales`) | L'étiquette `3-6` / `2-3` chevauche les blocs du pictogramme, et le pointillé ne se lit plus en dessous. | Placer l'étiquette à droite du pictogramme, ou sur un fond blanc. |
| D2 | Centrales, carnet exact (`07`, `11`) | Une forme épuisée devient un trait barré `—6—` : on perd la forme. | Garder le pictogramme, grisé, barré d'un trait fin. |
| D3 | Compteurs d'échanges (`z-g204-exchange-rows`) | Le format change : `↑ 1/1`, `↓ 0/∞`, mais `↑ 0` sans dénominateur quand le total vaut 0 (`fr.ts:438`). | Toujours `↑ x/y` (`↑ 0/0`). |
| D4 | Publications (`z-g205-centrales-publications`) | « ↑ ∞ export » au singulier, « 0 import » au singulier, « 2 exports » au pluriel : l'accord avec ∞ sonne faux. | « exports à volonté » en toutes lettres dans la publication, et ∞ seulement dans les compteurs. |
| D5 | Flèches | La STEP utilise ▲/▼ (triangles) et les échanges ↑/↓ (flèches). Le sens est le même (▲ pompage et ↑ export ajoutent de la demande), mais les glyphes diffèrent. | Un seul jeu de glyphes. |
| D6 | Message de pose | « Nucléaire de 15h à 24h » alors que l'axe s'arrête à `21h` : 24h n'apparaît nulle part. | « de 15h à minuit », ou un repère de fin d'axe. |
| D7 | Publications ↔ pastilles | Les heures et les nombres soulignés en pointillé dans les publications ressemblent à des liens. Le lien existe dans l'autre sens : un clic sur une pastille saute à sa publication (`record-jump`, `game.ts:548`), mais rien ne l'annonce. Sens publication → plateau non vérifié. | Lien dans les deux sens, signalé au survol (curseur et surbrillance de la pastille), ou soulignement retiré. |
| D8 | Surtitre | « GRILLE NOTÉE · SANS CARNET EXACT », « N° 213 · VEN. · SANS CARNET EXACT », « TUTORIEL 7 SUR 9 » : trois formats. | Acceptable : seules les grilles du labo affichent « GRILLE NOTÉE ». À vérifier après promotion. |
| D9 | Rangée pays | La légende sous la rangée (« Allemagne · 1 bloc par créneau ») est en 9 px gris, collée aux compteurs. | Mettre le nom du pays en libellé de rangée (voir F2) et la capacité en titre de colonne de la rangée. |

## Limites de l'audit

- Ordre des publications d'avant S2.6.
- Pas de capture d'une barre hachurée rouge (« centrale qui ne tient plus ») : le moteur refuse la pose qui la créerait dans les scénarios joués.
- Pas d'état de survol capturé.
- Grilles du labo jouées hors labo (build « galerie ») : même écran, sans le mode aveugle.
