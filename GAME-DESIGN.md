# Dispatch — document de conception

Base de référence pour construire la version propre du jeu. Il décrit ce qui marche dans le prototype, sans l'historique.

## 1. Le jeu en bref

- **Puzzle de logique solo, imprimable** : une grille par page A4, au crayon, une seule solution, comme un Sudoku ou un Kakuro. On déduit, on ne calcule rien. Il n'y a **aucun score**.
- **Thème** : le joueur construit le **programme d'appel** du réseau électrique pour une journée, c'est-à-dire quelle centrale produit quoi à chaque créneau. Le thème vient du marché européen de l'électricité ; il justifie chaque règle, mais les chiffres sont simplifiés.
- **Le cœur** : remplir exactement la courbe de demande avec des **pièces** (une centrale = un rectangle dont la largeur est sa durée de marche et la hauteur sa puissance), en respectant l'inventaire et les **indices du marché**.
- **Difficulté** : notée automatiquement par les techniques de déduction nécessaires (Facile, Moyen, Difficile, Expert).

## 2. La grille

- **Une case = 1 créneau en largeur × 1 GW en hauteur.**
- **Colonnes = créneaux horaires** de la journée : 6 à 12 colonnes (créneaux de 4 h, 3 h ou 2 h). 12 au maximum pour rester lisible sur papier.
- **Demande** : une hauteur par colonne, en GW. La production non pilotable (renouvelables, fil de l'eau) est posée par la météo (§3). Ce qui reste à couvrir avec les centrales pilotables est la **demande résiduelle** ; elle peut être négative (surplus de renouvelables, voir §5).
- **Silhouette** : la forme dessinée par la demande. Chaque case sous la silhouette doit être couverte exactement une fois ; rien au-dessus.
- Les lignes sont numérotées de bas en haut, à partir du bas de la grille (ligne 0), météo comprise. Le bas de la silhouette représente la consommation de base, le haut la pointe.
- **Météo** : elle occupe le bas de chaque colonne, d'abord le fil de l'eau F, puis les renouvelables R. Ce sont des **briques imposées**, comme des usines déjà posées : le joueur ne les pose ni ne les retire, et aucune centrale ne les recouvre. Elles s'affichent en barres hachurées.

## 3. Les centrales (pièces)

Chaque centrale est un **rectangle** : sa **largeur** est sa durée de marche (en créneaux), sa **hauteur** sa puissance (en GW). Chaque pièce déclare les largeurs et les hauteurs autorisées. La géométrie porte la physique :
- **horizontal** (largeur minimale) : une centrale qui ne peut pas s'arrêter vite, comme un réacteur qui tourne plusieurs créneaux d'affilée ;
- **vertical** (hauteur minimale) : une centrale qui ne peut pas produire peu, comme une usine qui ne descend pas sous 2 GW ;
- **une case** : une centrale souple, qui suit la pointe.

Le prototype n'utilise encore que des barres d'une case de haut ; les pièces verticales et rectangulaires sont prévues par les règles.

**Centrales pilotables** (posées par le joueur) :

| Id | Centrale | Forme actuelle | Rang de prix | CO₂ / case |
|---|---|---|---|---|
| N | Nucléaire | barre de 3 à 6 créneaux (ou plus sur les grandes grilles), 1 GW | 1 (le moins cher) | 0 |
| B | Barrage | 1 case ; le stock d'eau est limité par l'inventaire | 2 | 0 |
| C | Charbon | barre de 3 à 5, ou rampe 1 → 2 → 1 de 3 à 5 (voir ci-dessous) | 3 | 3 |
| G | Gaz (cycle combiné) | barre de 2 à 3 | 4 | 1 |
| T | TAC (turbine de pointe) | 1 case | 5 (le plus cher) | 2 |
| I | Import | 1 case, depuis un pays voisin | sans rang | selon le pays |

**Production non pilotable** (posée par la météo, jamais par le joueur) :

| Id | Production | Rôle actuel | Rang de prix | CO₂ / case |
|---|---|---|---|---|
| R | Renouvelables (soleil, vent) | cases imposées par la météo, en bas de la colonne | 0 | 0 |
| F | Fil de l'eau | cases imposées, constantes sur la journée | 0 | 0 |

R et F sont des briques posées par la météo en bas de leur colonne, à position fixe ; une centrale ne peut pas les recouvrir. Le compte de cases à couvrir par colonne reste la demande résiduelle (demande − météo + exports + pompages − turbinages). Elles restent des pièces à part entière pour ouvrir des mécaniques : prévision météo incertaine, écrêtement d'un surplus, indice « production solaire de midi », renouvelables qui varient d'un créneau à l'autre.

**La rampe du charbon** : une grille peut déclarer son charbon en rampe (trapèze 1 → 2 → 1), jamais rectangle et rampe à la fois.
- Une rampe de largeur W occupe W cases sur sa **ligne de base** et W − 2 cases (le **plateau**) sur la ligne juste au-dessus ; les deux cases du bout de la base sont les **épaules**. Elle compte 2W − 2 cases.
- Elle se pose comme une barre : la largeur totale est sa durée de marche, la hauteur est fixe. Elle se pose à n'importe quelle ligne.
- Un escalier 2 → 1 est prévu par le format (`shape: "stair"`) : le validateur du jeu le refuse (§14) et seul le dessin le connaît ; il n'est pas joué (le labo refuse de le jouer ou de le promouvoir, aucune grille publiée n'en a, le moteur n'a pas de test qui le pose).

Le **rang de prix** suit l'ordre d'appel réel (merit order). Il ne sert qu'aux indices de prix : « à 8h, c'est le gaz qui fixe le prix » veut dire que la case pilotable la plus chère de la colonne est du gaz. L'import n'a pas de rang : un indice de prix ne porte jamais sur un créneau qui contient un import.

Toutes les pièces ne sont pas présentes dans chaque grille : la grille déclare les centrales disponibles.

## 4. Règles de pose

1. Chaque pièce est posée entièrement dans la silhouette, **au-dessus des briques météo**, sans chevaucher une autre pièce. Une centrale est un vrai rectangle sur une seule ligne de la grille : chacune de ses cases est libre (ni météo, ni autre centrale). Elle n'épouse jamais le relief de la météo.

```
autorisé            interdit (une barre pliée)
  .. .                .. .
NNN...              ..N...
..RR..              NNRR..
FFFFFF              FFFFFF
```

Les cases vides sous la barre autorisée se remplissent avec d'autres centrales, comme toute case sous la demande. Le dessin interdit reste possible avec deux centrales distinctes si leurs longueurs sont permises.
2. Sa forme fait partie de celles autorisées pour sa pièce : largeur et hauteur pour un rectangle, largeur pour une rampe.
3. Toutes les cases de la silhouette sont couvertes.
4. L'inventaire est respecté (§6) et tous les indices sont vrais (§7).
5. Les contraintes optionnelles de la grille sont respectées (§5).

## 5. Mécaniques optionnelles

Chacune s'active par grille. Elles créent du choix, et c'est ce choix qui fait les grilles difficiles.

- **Voisin (interconnexion)** : un pays voisin relié par une ligne de **capacité limitée** (en blocs par créneau, souvent 1).
  - **Import** : une case de la colonne est fournie par le voisin (pièce I).
  - **Export** : un bloc vendu au voisin ajoute une case à remplir dans la colonne (la silhouette monte de 1).
  - À chaque créneau : imports + exports avec ce pays ≤ capacité de la ligne.
  - Plusieurs voisins possibles (ex. Allemagne, Royaume-Uni, Espagne), chacun avec sa ligne.
  - Les voisins n'ont **pas de prix** : seuls la capacité et les indices comptent.
- **Surplus** : une colonne de demande résiduelle négative doit être absorbée par des exports ou par un pompage de STEP (pas d'écrêtement) : les briques météo au-dessus de la demande sont couvertes par ces exports ou ce pompage. Un surplus casse les rubans de nucléaire, un export permet de les prolonger.
- **STEP (stockage par pompage)** : une paire pompage ▲ / turbinage ▼. Le pompage ajoute une case à remplir dans un créneau, le turbinage en retire une dans un créneau **plus tard**. Le nombre de paires est fixé par la grille. Usage typique : remplir un creux pour prolonger un ruban, raboter une pointe.
- **Plafond CO₂** : la somme du CO₂ des cases posées ne dépasse pas le plafond. Avec plusieurs voisins, chaque pays a son **CO₂ par case importée** : sous plafond, le choix du pays devient une vraie décision. Le contrôle se fait en comptant des cases.

## 6. Inventaire

L'inventaire est le carnet d'ordres du jour : les centrales appelées.

| Format | Usage | Ce que voit le joueur |
|---|---|---|
| **Exact** | tutoriel | la longueur de chaque barre (« N 6, 6, 5 · G 2, 2 · T ×5 ») ; nombre de cases pour les pièces d'une case |
| **Sans inventaire** | toutes les autres grilles | seulement les centrales disponibles ; la déduction repose sur les indices |

- En format exact, il faut poser tout l'inventaire, ni plus ni moins.
- **Sans inventaire, les totaux d'échanges et de stockage sont donnés sous forme d'indices** (§7, « Échanges du jour ») et non comme un inventaire, pour rester cohérent.
- Les formats intermédiaires (nombre de barres, nombre de cases) n'apportent rien de plus que l'exact et ne sont pas retenus.

## 7. Indices du marché

Chaque indice est un document que le marché publie vraiment. La grille en donne le **plus petit ensemble** qui rend la solution unique et déductible.

| Indice | Document | Exemple affiché | Contrainte |
|---|---|---|---|
| **Prix** | prix publié par la bourse | « À 8h, c'est le gaz qui fixe le prix. » | la case la plus chère de la colonne est de cette centrale |
| **Programme** | programme publié d'une centrale | « Un réacteur tourne de 4h à 20h. » | une barre de cette pièce couvre exactement ces créneaux (ligne libre) |
| **Durée de marche** | fiche technique du jour | « Un réacteur tourne 6 créneaux d'affilée. » | une barre de cette pièce a exactement cette longueur (créneaux libres) |
| **Relevé** | relevé de production RTE | « Relevé de 16h : 2 cases de gaz, aucune TAC. » | nombre de cases de ces pièces dans la colonne |
| **Flux** | flux d'interconnexion publié | « À 21h, 1 bloc part vers l'Allemagne. » | export ou import d'un créneau avec un pays |
| **Échanges du jour** | bilan des échanges | « Aujourd'hui : 2 blocs exportés, 1 importé, 1 pompage. » | totaux d'exports, d'imports (par pays ou tous pays confondus) et de paires STEP |
| **Centrale engagée** | contrat déjà signé | « Déjà engagée : TAC à 18h, ligne 5. » | barre pré-posée, non effaçable ; **réservé au tutoriel** (donne la réponse au lieu de la faire déduire) |

## 8. Validité d'une grille

Une grille n'est publiée que si elle remplit les trois conditions des jeux de logique sérieux :

1. **Solution unique**, jugée sur la **composition** : pour chaque colonne, le nombre de cases de chaque pièce (imports par pays), plus les exports, imports et STEP par créneau. Deux dessins de même composition (échanger deux barres de ligne) sont une seule solution.
2. **Résoluble sans essai-erreur** : un solveur de déduction humaine (§9) doit arriver au bout avec des règles simples, sans deviner.
3. **Aucun indice inutile** : retirer n'importe quel indice casse l'unicité ou la déduction.

## 9. Difficulté

Chaque technique a un nom, un niveau et une phrase pour le joueur : elles servent au tutoriel. Le niveau ordonne la déduction (la technique la plus simple d'abord) ; la note de la grille suit la **notation A**, plus bas.

| Niveau | Technique | Phrase pour le joueur |
|---|---|---|
| 1 | Pas de place | Une barre ne peut ni dépasser de la silhouette ni chevaucher une barre déjà posée. |
| 1 | Carnet épuisé | Quand toutes les cases d'une pièce sont trouvées, elle ne va nulle part ailleurs ; une barre plus longue que ce qu'il reste ne passe plus. |
| 1 | Le prix plafonne la colonne | Sous un prix publié, aucune case n'est plus chère que ce prix. |
| 1 | Le relevé compte les cases | Un relevé atteint interdit d'autres cases de cette pièce ; s'il reste juste assez de cases possibles, elles y passent toutes. Vaut aussi pour les totaux du jour (« Échanges du jour »). |
| 1 | Flux publié | Un flux publié fixe l'export ou l'import d'un créneau avec un pays. |
| 1 | Une seule barre pour cette case | Une case qu'une seule barre peut encore couvrir reçoit cette barre. |
| 1 | La barre qui ne tient qu'à un endroit | Une barre du carnet qui n'a plus qu'une place possible y va. |
| 1 | Programme publié | La barre annoncée par un programme va sur la seule ligne où elle tient. |
| 1 | Durée de marche | La barre dont on connaît la durée de marche va à la seule place où cette durée tient. |
| 1 | La silhouette suit les barres | Un export ou un pompage qui laisserait une case impossible à couvrir est exclu. |
| 1 | Cases interchangeables | Quand on connaît le nombre de cases de chaque pièce dans une colonne, l'ordre ne compte pas. |
| 1 | Le plateau barre la ligne du dessus | Au-dessus de sa base, la barre à paliers occupe aussi la ligne suivante sur tout son plateau : aucun ruban de cette ligne ne la traverse. |
| 1 | Le bord appelle une case | La case au-dessus d'un bord est fermée côté plateau : seule une pièce d'une case, ou une barre qui s'arrête pile là, peut la couvrir. |
| 2 | La case la plus chère | Un prix publié exige au moins une case de cette centrale dans la colonne : s'il n'y a qu'une place possible, c'est elle. |
| 2 | Le creux coupe le ruban | Chaque ligne se découpe en rubans entre les creux : une barre qui laisserait un bout impossible à remplir est exclue. |
| 2 | Carnet juste | S'il reste exactement autant de cases possibles que de cases à poser pour une pièce, toutes sont à elle. |
| 2 | Compter la colonne | Une colonne a autant de cases que sa hauteur : connaissant les autres pièces, on déduit celle qui reste. |
| 2 | Plafond carbone | Une barre qui ferait dépasser le plafond CO₂ est exclue. |
| 2 | Une case seule est un bord | Une seule case à paliers dans une colonne, c'est un bord : la barre continue à deux cases d'un côté et s'arrête de l'autre. |
| 3 | Répartition du carnet | Les barres doivent toutes trouver une ligne : un découpage qui empêche les autres de se placer est exclu. |
| 3 | Deux bords se relaient | Deux cases à paliers sans plateau autour : une barre s'arrête et une autre démarre sur son bord. |
| 4 | Hypothèse réfutée | Si un choix mène à une impasse par les règles simples, il est exclu (une seule hypothèse, jamais imbriquée). |

Les quatre techniques de rampe (trapèze, `docs/next/rampe.md` §2) ne servent qu'aux grilles dont le charbon est une rampe ; leurs niveaux sont provisoires. « Le plateau barre la ligne du dessus » et « Le bord appelle une case » sont « Pas de place » et « Une seule barre pour cette case » nommées pour une rampe : elles enseignent le geste, mais ne rendent pas une grille plus difficile. Une brique météo est une case occupée dès le départ : « Pas de place » et « Le creux coupe le ruban » la traitent comme une barre déjà posée, sans technique à part. « Pas de place » regarde aussi plusieurs colonnes à la fois : une barre qui demanderait plus d'exports (ou de pompages) que le jour n'en publie est exclue. « Cases interchangeables » ne compte que les cases sûres et les relevés de la colonne : quand il faut la hauteur de la colonne, c'est « Compter la colonne ». Les noms et phrases sont les mêmes dans `web/src/i18n/fr.ts` et dans les traces du solveur (testé).

**Ce qui crée la difficulté** (constaté sur les tirages) : des choix réels, c'est-à-dire un voisin, un STEP ou l'absence d'inventaire. Sans voisin et avec un inventaire exact, les grilles sont toujours faciles.

**Notation A** (calée sur les parties de deux joueurs, `docs/next/v3-criteres-j2.md`) :

1. **Techniques** : le niveau le plus haut employé, avec « Le creux coupe le ruban » compté 1, « Répartition du carnet » 2 et « Hypothèse réfutée » 3, **plafonné à Moyen** (2). Les techniques seules ne font jamais une grille Difficile.
2. **Mécaniques globales couplées** : +1 cran pour la STEP trouvée par la déduction, +1 pour un plafond CO₂ actif (une étape « Plafond carbone »), **seulement si la solution a au moins un échange** (un export ou un import). Sans voisin, STEP et CO₂ ne rendent pas la grille dure (ressentie 1).
3. Note = techniques plafonnées + mécaniques couplées, au plus Expert (4). Difficile exige donc une mécanique globale couplée ; Expert exige les deux, avec une technique de niveau 2.

Le solveur garde le niveau brut (`technique_level`) et les mécaniques couplées (`coupled_globals`) dans le résumé de sa trace.

Les techniques sont écrites pour des barres d'une case de haut, les seules du prototype. Avec des pièces verticales ou rectangulaires, elles s'étendent naturellement (« pas de place » vaut aussi en hauteur), et de nouvelles techniques apparaîtront, comme une colonne trop basse pour une centrale qui ne descend pas sous 2 GW.

## 10. Génération des grilles

Le générateur (`solver/`, `dispatch_solver.generate`) produit des **lots** de grilles candidates pour le labo.

1. **Tirer une journée** : 6, 8 ou 12 créneaux ; une famille de silhouette (pointe du soir, deux bosses, midi solaire, surplus de midi, nuit plate, plateau d'hiver, vent de nuit) donne la demande et la météo (soleil le jour, vent la nuit) ; les centrales disponibles et les mécaniques actives (voisins, STEP, surplus, plafond CO₂, stock d'un barrage, pièce haute, rampe).
2. **Pose de référence plausible** : l'ordre d'appel réel (somme des rangs minimale, le moins cher d'abord), avec un départage aléatoire entre poses de même coût ; une rampe ou une pièce haute demandée doit y figurer. Pour la rampe, un bonus tiré par case de rampe varie les largeurs, et une grille sur trois en demande deux (relais).
3. **Mécaniques mortes nettoyées** : un voisin avec qui la référence n'échange rien est retiré de la grille avant le choix des indices ; une configuration avec voisins en garde au moins un (si la référence n'échange avec aucun, elle est recalculée avec un export imposé, sinon le tirage est rejeté `dead_neighbors`) ; un plafond CO₂ qu'aucune étape « Plafond carbone » n'utilise est retiré après la déduction (unicité et déduction revérifiées sans lui). Une mécanique affichée sert toujours.
4. **Inventaire** au format voulu (exact ou sans inventaire) ; seules les centrales de la pose de référence sont listées.
5. **Choisir les indices** : réserve de tout ce que la référence peut publier ; on ajoute un à un l'indice qui laisse le moins de cases indécises (techniques de niveaux 1-2), en préférant un type pas encore utilisé, jusqu'à ce que la déduction aboutisse avec les techniques jusqu'au **niveau visé** ; puis on retire ceux qui ne servent plus. Retirer n'importe quel indice restant casse la déduction (§8.3). Le niveau visé est le levier sur les techniques : 1 donne des grilles faciles ; pour 3 et 4, l'indice est tiré parmi ceux qui font progresser, avec un inventaire exact (sauf plafond CO₂ ou stock, morts en carnet exact) et sans prix. Avec la notation A, Difficile et Expert viennent des mécaniques globales couplées, pas du niveau visé.
6. **Contrôles** : une seule composition (CP-SAT), déduction complète (§9), note provisoire et mesures (techniques, nombre d'étapes, étapes de niveau ≥ 2). Rejets nommés et comptés : `infeasible`, `trivial`, `one_plant` (une seule centrale dans la référence), `not_unique`, `blocked`, `dead_neighbors`, `too_many_clues` (au-delà du nombre de créneaux), `rating_mismatch`, `no_decision` (aucune décision, ci-dessous), `duplicate` (même résiduel à un décalage vertical près, ou même composition), `quota`, `error:<type>` (un tirage qui plante ne stoppe pas le lot), `timeout` (un tirage de plus de 5 min est abandonné).
7. **Décisions** : un choix de la solution que la déduction doit trancher (aucun indice ne le donne, la grille vide ne l'impose pas) et qui change la solution. Une grille sans aucune décision est du « remplissage » : rejetée (`no_decision`), sauf configuration `min_decisions: 0` (tutoriels). Types, un par élément :
   - `exchange` : un export non nul d'un créneau fixé par une étape autre que « Flux publié », ou une barre d'import posée par une étape (un import trouvé en comptant les colonnes à la fin n'en est pas une) ;
   - `step` : une paire pompage → turbinage, quand une étape fixe l'option STEP ;
   - `tall` : une barre de charbon posée sur 2 lignes ; `ramp` : une barre de charbon à paliers dont la déduction tranche la place ou la largeur (pas quand un indice la donne : barre engagée, programme qui la nomme, ou étape qui lit un indice, « Programme publié » ou « Durée de marche ») ;
   - `carbon` : le plafond CO₂ exclut au moins une pose ; `stock` : le stock du barrage (carnet libre) est épuisé et une étape « Carnet épuisé » l'applique ;
   - `price` : un prix qui force sa centrale dans une seule case (« La case la plus chère »), par indice.

   Mesures seules, sans filtre : **compacité K** = poids des décisions / pièces posées (barres et imports de la référence), poids 3 pour STEP et CO₂, 2 pour pièce haute et rampe, 1 pour échange, stock et prix ; **mécaniques globales couplées** (celles que compte la notation A, §9) ; **prix de demande** (D7) : indices `price` sur une centrale chère (C, G, T) dans une colonne d'export, le prix qui fait naître une demande du tutoriel 6 ; **règle qui pose chaque rampe** (`ramp_settled_by`, technique de rampe ou générale). Toutes ces mesures sont prises sur la grille nettoyée, celle que joue le joueur, et les quotas s'y appliquent.
8. **Diversité imposée** : un lot mélange des configurations pondérées et applique des quotas (par défaut sur 20 grilles : au plus 3 par famille de silhouette, 4 par ensemble de mécaniques, 4 par profil d'indices, au moins 2 par note ; sans limite par défaut, au plus N grilles dont toutes les décisions sont d'un même type, `max_same_single_decision`, 6 sur 20 dans les lots « jouer » ; par type de décision, un plafond `max_with_type` et un plancher `min_with_type` sur le nombre de grilles qui contiennent ce type, ex. au plus 10 grilles avec un échange, au moins 4 avec la STEP ; une clé `"step+carbon"` exige les deux types, `"step|carbon"` l'un des deux ; la clé `coupled` compte les grilles à mécanique globale couplée ; `max_demand_price` plafonne les grilles à prix de demande, et tant qu'il n'est pas atteint, un tirage sur deux commence la sélection d'indices par un tel prix quand la réserve en a un). Les tirages visent d'abord les notes qui manquent (une Difficile ou une Expert qui manque vise les configurations capables d'une mécanique globale couplée), et les configurations qui peuvent donner un type sous son plancher ; une grille finie refusée seulement pour réserver une note ou un type attend dans une réserve.

   **Quasi-jumelles** : deux règles générales, qui bornent sans imposer de motif. `max_per_mix` : au plus N grilles par entrée du mélange (2 dans les lots v3g4), même en fin de lot (rejet `quota:per_mix`) ; le lot doit avoir assez d'entrées (N × entrées ≥ taille, vérifié). `max_with_cols` : au plus N grilles d'un nombre de créneaux donné, ex. `{"12": 5}`, un quart du lot sur 12 créneaux (rejet `quota:cols`). Une entrée à son plafond, ou dont le nombre de créneaux l'est, est tirée 25 fois moins souvent.
9. **Bulletin** : titre, court texte et ciel par créneau, écrits par gabarits à partir de ce que voit le joueur (jamais de la solution). Le brouillon va dans le bloc `lab` ; le labo lui donne un numéro et une date à la promotion.

Sortie : `lab/candidates/<lot>.json` (grilles §14 plus un bloc `lab` : famille, mécaniques, profil d'indices, niveau visé, résumé de la trace, techniques de rampe employées, décisions par type, mécaniques vivantes, nombre de barres, prix sur le nucléaire en carnet libre, mécaniques globales couplées, compacité K, prix de demande, mécaniques nettoyées, brouillon de bulletin) et `<lot>.stats.json` (tirages, rejets, répartition). Le bloc `lab` est retiré quand une grille entre dans le jeu.

## 11. Tutoriel

Une grille par technique, en inventaire exact, dans cet ordre : poser l'inventaire (cases interchangeables) → le prix plafonne la colonne → inventaire juste → le creux coupe le ruban → flux publié et compter la colonne → la case la plus chère → pompage, relevé et programme. Chaque grille introduit **une** technique nommée, dans son texte d'introduction.

## 12. Hors périmètre actuel (backlog)

- Indice progressif : un bouton « prochaine déduction possible » qui montre une seule étape, tiré du solveur de déduction.
- Courbe de difficulté sur la semaine (facile le lundi, difficile le samedi), avec la même silhouette déclinée.
- Mode annotations (marquer « pas de nucléaire ici »), sur papier comme à l'écran.
- Feuille de règles d'une page avec un exemple résolu, et corrigé séparé.
- Calibrage humain : faire jouer quelques personnes aux grilles notées, chronométrer, ajuster la note.

## 13. Glossaire du thème

- **Programme d'appel** : le plan qui dit quelle centrale produit quoi à chaque créneau.
- **Merit order** : l'ordre d'appel des centrales, de la moins chère à la plus chère.
- **Prix marginal** : le prix d'un créneau est fixé par la centrale la plus chère appelée.
- **Ruban** : une barre de nucléaire, production constante sur plusieurs créneaux.
- **Pointe** : les créneaux de plus forte demande ; une pointe courte et isolée ne se couvre qu'avec des pièces d'une case.
- **Interconnexion** : la ligne vers un pays voisin, de capacité limitée.
- **STEP** : station de transfert d'énergie par pompage.
- **RTE** : le gestionnaire du réseau français, qui publie les relevés de production.

## 14. Format de grille (référence)

```json
{
  "columns": ["0h", "3h", "6h", "9h", "12h", "15h", "18h", "21h"],
  "demand": [4, 3, 6, 8, 6, 8, 8, 5],
  "pieces": {
    "N": {"len": [3, 4, 5, 6], "height": [1], "rank": 1, "co2": 0},
    "G": {"len": [2, 3], "height": [1], "rank": 4, "co2": 1},
    "T": {"len": [1], "height": [1], "rank": 5, "co2": 2}
  },
  "weather": {"R": [0, 0, 1, 2, 2, 1, 0, 0], "F": [1, 1, 1, 1, 1, 1, 1, 1]},
  "neighbors": [{"id": "DE", "name": "Allemagne", "cap": 1, "co2": 3}],
  "step": true,
  "co2_cap": null,
  "inventory": {"level": "none", "pieces": {"N": {}, "G": {}, "T": {}}},
  "clues": [
    {"type": "price", "col": 6, "piece": "T"},
    {"type": "bar", "piece": "N", "col": 2, "len": 5},
    {"type": "length", "piece": "N", "len": 6},
    {"type": "column", "col": 4, "counts": {"G": 2, "T": 0}},
    {"type": "flow", "col": 7, "country": "DE", "dir": "export", "value": 1},
    {"type": "exchanges", "exports": {"DE": 1}, "imports": {"DE": 0}, "step": 1}
  ],
  "solution": {"exports": {"DE": [0, 0, 0, 0, 0, 0, 0, 1]}, "step": [{"pump": 1, "turbine": 6}], "placements": [{"piece": "N", "row": 3, "col": 2, "len": 5}]},
  "difficulty": {"rating": 3, "label": "Difficile", "techniques": ["ribbon", "share_out"]}
}
```

Dans l'exemple, `solution.placements` est un extrait : la seule barre N annoncée par l'indice `bar`, posée au-dessus de la météo. Une vraie grille donne toutes ses poses (voir le contrôle du dessin plus bas).

Champs de la grille complète, en plus de l'exemple ci-dessus :

- **Tête** : `id` (entier > 0), `title`, `section` (`"tutorial"` ou `"rated"`), `intro` (texte affiché avant de jouer, facultatif) et `teaches` (ids des techniques introduites, pour les grilles de tutoriel).
- **`column.counts`** : une clé est un id de pièce, ou `I:<pays>` pour les imports d'un seul voisin (ex. `{"G": 2, "I:DE": 0}`).
- **`row`** (pose de `solution.placements`, indice `engaged`) : ligne de la case du bas, comptée depuis le bas de la grille (0 = première ligne, météo comprise). Une pose ne couvre aucune case de colonne `c` sous `F[c] + R[c]`.
- **`height`** : facultatif sur une pose (`solution.placements`) et sur un indice `engaged` ; 1 par défaut, et toujours une valeur de `pieces.<id>.height`.
- **`pieces.<id>.shape`** : `"rect"` (défaut), `"trap"` (rampe 1 → 2 → 1) ou `"stair"` (escalier 2 → 1, refusé par le validateur du jeu : `pieces.C.shape: ramps are not enabled`, comme le solveur sans son option). Seul le charbon `C` peut être une rampe ; une rampe n'a pas de `height` ; `len` est sa largeur totale (≥ 3 pour `trap`, ≥ 2 pour `stair`). Une pose de rampe garde `{piece, row, col, len}` : `row` est sa ligne de base, ses cases se déduisent de la forme (`web/src/model/shapes.ts`). Exemple : `"C": {"shape": "trap", "len": [3, 4, 5], "rank": 3, "co2": 3}`.
- **`inventory.pieces.<id>.max_cells`** : stock maximal en cases d'une pièce, connu du joueur même au niveau `none` (ex. l'eau d'un barrage : `"B": {"max_cells": 2}`). Le moteur refuse une pose qui dépasse ce stock.

Contrôles du validateur : de 6 à 12 colonnes ; rang et CO₂ de chaque pièce égaux à ceux du §3 ; `pieces` et `inventory.pieces` ont les mêmes clés ; `imports` ne mêle pas `"*"` et des clés par pays ; une rampe est du charbon, sans `height`, assez large ; chaque pose a une largeur et une hauteur permises (aucune hauteur pour une rampe), tient dans la grille, ne couvre aucune case de météo (message `solution.placements[i]: covers a weather cell at <libellé de la 1re colonne fautive>`, par exemple `… at 10h` ; `clues[i]: …` pour un indice `engaged`), et un import fait 1 case ; un bulletin a un numéro, un titre, un texte, un ciel par colonne et une date ISO réelle ; une grille avec STEP publie son nombre de paires (`inventory.step` en exact, `step` d'un indice `exchanges` sinon) ; dans `solution.step`, `pump` est avant `turbine` ; un flux ou un export ne dépasse pas le `cap` de la ligne.

Dessin de la solution, contrôlé seulement sur une grille sans autre erreur :
- **Chevauchement** : deux poses de `solution.placements` ne partagent aucune case. Message `solution.placements[i]: overlaps solution.placements[j] at <libellé>` (j < i, 1re colonne commune), un par paire.
- **Couverture** : dans chaque colonne, la météo et les poses remplissent exactement les lignes 0 à sommet − 1, avec sommet = `demand` + exports + pompages − turbinages (`solution.exports`, `solution.step`). Un message par colonne mal couverte, sur sa ligne fautive la plus basse :
  - `solution: hole at <libellé>, row <r>` : case vide sous le sommet ;
  - `solution: cell above the silhouette at <libellé>, row <r>` : case de pose, ou brique météo d'un surplus non absorbé, au-dessus du sommet.
- Une liste `solution.placements` vide veut dire « pas de dessin de référence » (grille à plusieurs compositions, grille de galerie) : la couverture n'est pas contrôlée. Une grille publiée a toujours son dessin : `check_unique.py` compare sa composition à celle que trouve le solveur.

- **`bulletin`** (facultatif) : le bulletin du marché publié avec la grille, `{"number", "title", "text", "weather", "published"}`.
  - `number` : numéro du bulletin (entier > 0, unique d'une grille à l'autre) ; `title` et `text` : titre et court texte de contexte (non vides).
  - `weather` : un ciel par créneau, parmi `sun`, `moon`, `cloud`, `wind` (autant de valeurs que de colonnes).
  - `published` : jour de publication, ISO `YYYY-MM-DD`.
  - **Fiche du jour** : le bulletin dont la date de publication est la plus récente et ≤ aujourd'hui (date locale du navigateur). Stock épuisé : le dernier publié reste affiché ; avant la première publication, il n'y en a pas (`web/src/model/bulletin.ts`).
  - Les bulletins des 4 premières grilles notées ont été écrits à la main (`web/scripts/bulletins.ts`) ; ceux des grilles promues viennent du brouillon du labo.
  - **Titre** : une grille avec bulletin s'affiche sous le titre de son bulletin (`displayTitle`) ; le champ `title` ne sert qu'aux outils. Une grille promue depuis le labo prend le titre de son bulletin, les 4 premières grilles notées gardent « Facile »… « Expert ».

En inventaire exact : `"inventory": {"level": "exact", "pieces": {"N": {"bars": [6, 6, 5]}, "T": {"cells": 5}}, "exports": {...}, "imports": {...}, "step": 1}`.

## 15. Code (référence)

- `web/` : le jeu (TypeScript + Vite) : format §14 et son validateur (`src/model/grid.ts`), moteur pur (`src/engine/`), interface et impression (`src/ui/`), grilles (`src/data/grids.json`).
- `solver/` : package Python `dispatch_solver` (OR-Tools CP-SAT), au format §14 : validateur (mêmes contrôles et messages que `grid.ts`), pièces décrites case par case (rectangles, pièces hautes, rampes du charbon derrière un drapeau), solveur exact (unicité sur la composition), solveur de déduction humaine (techniques du §9, traces, note), générateur par lots et CLI `dispatch-solver`. Conception : `docs/next/solver-v2.md`.
- `fixtures/grids/` : jeu de grilles de référence (valides, invalides, non publiables) joué par les tests Python et TypeScript, pour que les deux implémentations ne divergent pas.
- `lab/` : lots du générateur et grilles candidates.
- `docs/archive/` : prototype JS d'origine (`demo/`, dont `grids-pose.json`, source des 11 premières grilles via `web/scripts/convert-grids.ts`, outil ponctuel), ancien solveur au format « pose » (`solver-v1/`) et maquettes terminées (`maquettes/`).
