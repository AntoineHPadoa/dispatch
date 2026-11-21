# Spot-Élec — idées de gameplay

Jeu de logique imprimable autour du marché européen de l'électricité : solo, papier-crayon, une page A4, une solution unique ou un score cible, pour un « puzzle du jour ».

Sources : deux vidéos de Heu?reka sur le marché de l'électricité (transcripts reconstruits). Les nombres sont ceux des vidéos, arrondis pour se calculer de tête.

---

## 1. Fiche mécanique : ce que les vidéos donnent au jeu

| Règle réelle | Ce qu'en tire le jeu |
|---|---|
| **Offre = demande, exactement.** L'électricité ne se stocke pas : chaque heure, production = consommation. | Contrainte dure de toute grille : on remplit pile la demande, ni plus ni moins. |
| **Merit order.** On appelle les centrales de la moins chère à la plus chère, sur le seul **coût variable** (combustible). Les coûts fixes n'entrent pas dans le classement. | Chaque techno a un coût par bloc ; on empile du moins cher au plus cher. |
| **Prix unique = coût de la centrale marginale.** Toute l'électricité de l'heure est payée au coût variable de la dernière centrale appelée (exemple vidéo : 850 €/MWh à 9 h le 29/08/2022, alors que la moyenne pondérée des coûts est de 119 €). | Deux scores possibles : le *coût de production* (somme des coûts) et la *facture marché* (prix marginal × demande). L'écart entre les deux est la leçon principale. |
| **Ordres de grandeur (vidéo 2)** : ENR et fil de l'eau 0 € ; nucléaire ≈ 10 € ; barrage ≈ 50 € (valeur de l'eau) ; charbon/fioul ≈ 150 € ; CCG 120-420 € ; TAC 700-850 € ; plafond légal 3 000 €. | Barème des cartes/cases. |
| **Le nucléaire ne fait pas de « dentelle »** : +6,5 % en 30 min contre +62 % pour le gaz et +176 % pour l'hydraulique. | Contrainte de rampe : le nucléaire varie d'au plus 1 cran entre deux créneaux. |
| **Les barrages ont un stock limité** ; ouvrir les vannes ne coûte rien maintenant mais prive de l'eau demain : c'est un coût d'opportunité. | Jetons d'eau en nombre limité sur la journée. |
| **ENR et fil de l'eau** : non pilotables, production fixée par la météo (3 GW de solaire/éolien disponibles sur 28 installés dans l'exemple). | Cases préremplies par le « bulletin météo » du jour. |
| **Rubans et pixels.** La base est achetée à l'avance (rubans : 1 MW toutes les heures pendant des semaines ou des mois, ARENH à 42 €) ; la « dentelle » horaire s'achète la veille sur le spot (pixel = 1 MW pendant 1 h). | Métaphore visuelle directe : Tetris / pixel art. |
| **Le spot ne voit que des ordres**, pas les centrales : chaque acteur envoie une liste d'achats/ventes par palier de prix ; Euphemia les fusionne en un seul merit order. Seuls 8,1 GW sur 60 changent de main sur le spot. | Puzzle de déduction : reconstruire le merit order à partir des ordres. |
| **Interconnexions** : un prix par heure et par zone ; les zones convergent vers un prix commun tant que les lignes ne saturent pas. | Carte d'îlots reliés par des lignes de capacité limitée. |
| **Thermosensibilité** : +2,4 GW par degré en moins l'hiver. Pointes vers 8-12 h et 19-20 h, chauffe-eau vers 22 h. | Cartes « événement » : vague de froid, panne. |
| **Jour J : RTE prend la main** une heure avant le temps réel ; ceux qui ont mal prévu paient les écarts. | Mode « ajustement » : on corrige un programme existant au moindre coût. |

Rôles possibles pour le joueur : **la bourse** (Euphemia, qui construit le programme d'appel), **RTE** (qui équilibre le jour J), **un fournisseur** (qui achète rubans et pixels), **un observateur** (qui déduit qui produit quoi).

---

## 2. Sept concepts

Légende commune des technos :

```
 F = fil de l'eau   0 €     R = renouvelables (soleil, vent)  0 €
 N = nucléaire     10 €     B = barrage (stock limité)       50 €
 C = charbon/CCG  120-150 € G = gaz                         150 €
 T = TAC (pointe)  850 €
```

### Concept A — « Le Tetris des pixels » (rôle : la bourse) ★ recommandé

**Règle**
1. La grille a 6 créneaux de 4 h (colonnes) ; chaque case est un bloc de 5 GW pendant 4 h.
2. La ligne du haut donne la demande de chaque créneau : la colonne doit être remplie exactement jusque-là.
3. F et R sont préremplis par la météo. On empile ensuite N, puis B, puis G, du bas vers le haut.
4. Contraintes : N ≤ 4 par colonne et varie d'au plus 1 d'une colonne à la voisine ; 3 jetons B pour la journée, au plus 2 par colonne ; G sans limite.
5. Objectif : le coût de production minimal ; à coût égal, la **facture** minimale (Σ prix marginal de la colonne × demande).

**Grille du jour**

```
 Demande    3   6   9   6   9   5      (blocs de 5 GW)
          ┌───┬───┬───┬───┬───┬───┐
       9  │   │   │   │   │   │   │
       8  │   │   │   │   │   │   │
       7  │   │   │   │   │   │   │
       6  │   │   │   │   │   │   │
       5  │   │   │   │   │   │   │
       4  │   │   │   │   │   │   │
       3  │   │   │ R │ R │   │   │
       2  │   │ R │ R │ R │ R │   │
       1  │ F │ F │ F │ F │ F │ F │
          └───┴───┴───┴───┴───┴───┘
           0h  4h  8h  12h 16h 20h
 Stock d'eau : B B B         Facture à battre : 2 240
```

**Solution**

```
 Demande    3   6   9   6   9   5
          ┌───┬───┬───┬───┬───┬───┐
       9  │   │   │ B │   │ G │   │
       8  │   │   │ B │   │ G │   │
       7  │   │   │ N │   │ G │   │
       6  │   │ B │ N │ N │ N │   │
       5  │   │ N │ N │ N │ N │ N │
       4  │   │ N │ N │ N │ N │ N │
       3  │ N │ N │ R │ R │ N │ N │
       2  │ N │ R │ R │ R │ R │ N │
       1  │ F │ F │ F │ F │ F │ F │
          └───┴───┴───┴───┴───┴───┘
 Marginal   N   B   B   N   G   N
 Prix      10  50  50  10 150  10
 Facture   30 300 450  60 1350 50   = 2 240
 Coût : 20 N × 10 + 3 B × 50 + 3 G × 150 = 800
```

Raisonnement : le nucléaire est plafonné par la demande résiduelle (2, 4, 6, 3, 7, 4) et par la rampe : 2 → 3 → 4 → 3 → 4 → 4. Restent 0, 1, 2, 0, 3, 0 blocs à combler. Le coût est le même où que l'eau aille (800). Mais à 16 h il manque 3 blocs alors que B est limité à 2 par colonne : le gaz y sera marginal quoi qu'on fasse. L'eau va donc à 4 h et 8 h pour que le gaz ne fixe le prix que dans une seule colonne. Les autres placements donnent au moins 2 840 (unicité vérifiée par force brute).

**Ce qu'il enseigne** : le merit order, la rampe du nucléaire, la valeur de l'eau, et surtout l'écart entre le coût réel (800) et la facture marché (2 240), qui vient du prix marginal.

**Événements du jour** (une ligne au-dessus de la grille) : « Grand soleil : +1 R à 8 h et 12 h » ; « Réacteur en maintenance : N ≤ 3 » ; « Sécheresse : 1 seul jeton B » ; « Vague de froid : +1 à toute la demande » ; « Prix du gaz ×2 » (seule la facture change, pas la solution : bonne question piège).

**Points faibles** : les grilles faciles se résolvent par glouton. La difficulté vient des contraintes croisées (rampe, plafond de B par colonne, minimum technique du nucléaire à ajouter) et doit être réglée par un générateur/solveur.

#### A bis — « Objectif du jour » : relâcher le merit order

Le merit order n'est qu'un objectif parmi d'autres : minimiser le coût. Une même grille A peut se résoudre sous un autre critère imprimé en tête de page. Un objectif seul reste un tri, donc trivial (on trie par CO₂ au lieu de trier par coût) ; le puzzle naît d'un **objectif combiné** : un plafond sur un critère, puis l'optimum sur un autre.

Objectifs possibles : coût minimal (le marché réel), CO₂ minimal, facture minimale, eau épargnée pour demain, imports minimaux (souveraineté).

On ajoute au barème une colonne CO₂ (en unités par bloc) :

```
 Techno         €/bloc   CO₂/bloc   Limite
 N nucléaire       10       0        rampe ±1, ≤ 4
 C charbon        150       3        ≤ 2 par colonne
 G gaz (CCG)      200       1        sans limite
```

Comme dans la vidéo (prix 2022), le charbon est **moins cher** que le gaz mais émet **3 fois plus**.

**Grille du jour** : celle de A, avec une sécheresse (aucun jeton B). Le nucléaire est forcé comme en A (2, 3, 4, 3, 4, 4) ; il reste 0, 1, 2, 0, 3, 0 blocs thermiques à placer (C ou G).

```
 Demande       3   6   9   6   9   5
 Thermique     0   1   2   0   3   0   ← à remplir en C ou G

 OBJECTIF 1 — coût minimal (merit order réel)
 Thermique     ·   C  CC   ·  CCG  ·
 Marginal      N   C   C   N   G   N
 Coût 1 150    CO₂ 16    Facture 4 190

 OBJECTIF 2 — CO₂ minimal
 Thermique     ·   G  GG   ·  GGG  ·
 Marginal      N   G   G   N   G   N
 Coût 1 400    CO₂  6    Facture 4 940

 OBJECTIF 3 — CO₂ ≤ 10, puis coût minimal, puis facture minimale
 Thermique     ·   G  CC   ·  GGG  ·
 Marginal      N   G   C   N   G   N
 Coût 1 300    CO₂ 10    Facture 4 490
```

Raisonnement de l'objectif 3 : chaque charbon à la place d'un gaz rapporte 50 € et coûte 2 CO₂. Partant de 6 CO₂ (tout gaz), on a droit à 2 charbons. Où les mettre ? Le coût est le même partout (1 300), mais un charbon ne baisse la facture que s'il chasse **tout** le gaz d'une colonne. La colonne 8 h (2 blocs, demande 9) est la seule où 2 charbons suffisent, d'où l'unique solution à 4 490 (les autres placements donnent 4 640). Les trois solutions ont été vérifiées par force brute.

**Ce qu'il enseigne** : le merit order n'est pas une loi physique, c'est un choix d'objectif. Changer d'objectif change le programme d'appel. Le coût de la décarbonation se lit sur la grille : −6 CO₂ pour +150 €.

**Pour le puzzle du jour** : la grille reste la même et seule la carte « objectif » change. On peut ainsi proposer une même grille sur 3 jours avec 3 objectifs, ou en mode difficile un objectif à trois étages.

---

### Concept B — « Le carnet d'ordres troué » (rôle : Euphemia)

**Règle**
1. On reçoit la liste des offres de vente du jour (quantité, prix), dont certaines cases sont effacées (« ? »).
2. On reçoit des indices sur le résultat : prix spot, centrale marginale, volume appelé.
3. On reconstruit le merit order (on trie et on cumule) pour retrouver les « ? ».
4. Questions bonus : un événement modifie la demande ; quel est le nouveau prix ?

**Fiche du jour** — demande France 9 h-10 h : **60 GW**

```
 ┌─────────────────────────┬──────┬────────┐
 │ Offre                   │  GW  │ €/MWh  │
 ├─────────────────────────┼──────┼────────┤
 │ Barrages (eau stockée)  │   8  │   50   │
 │ TAC de pointe           │   3  │  850   │
 │ Fil de l'eau            │   7  │    0   │
 │ CCG Engie               │   ?  │  120   │
 │ Nucléaire EDF           │  29  │   10   │
 │ Charbon EDF             │   6  │  150   │
 │ Éolien + solaire        │   3  │    0   │
 └─────────────────────────┴──────┴────────┘
 Indice : le prix spot est 150 €/MWh et le charbon
          n'est appelé qu'à moitié.
 Q1. Combien de GW offre la CCG ?
 Q2. Il fait 2 °C de moins (+2,4 GW/°C ≈ +5 GW). Nouveau prix ?
```

**Solution**

```
 Merit order (cumul en GW)
   0 €  F+R  ██████████                                    10
  10 €  N    █████████████████████████████                 39
  50 €  B    ████████                                      47
 120 €  CCG  ██████████                                    57
 150 €  Cha  ███▒▒▒                                        63
 850 €  TAC  ██▒                                           66
 Cha : ███ appelé à 60 GW, ▒▒▒ appelé en plus à 65 GW
 TAC : ██ appelé à 65 GW, ▒ jamais appelé
 60 GW → le charbon est marginal : 150 €
 65 GW → la TAC est marginale    : 850 €
```

- Cumul : 10 (F+R) → 39 (N) → 47 (B) → 47 + ? (CCG) → + 3 GW de charbon = 60, donc **? = 10 GW**.
- Avec +5 GW : charbon complet (63), puis 2 GW de TAC : **850 €/MWh**. Une demande en hausse de 8 % multiplie le prix par 5,7.
- Bonus : à 150 €, le nucléaire touche 140 € de plus que son coût sur 29 GWh, soit 4 060 k€ de marge sur l'heure.

**Ce qu'il enseigne** : le mécanisme d'enchère, la centrale marginale, l'effet falaise près de la pointe.

**Événements** : une offre manquante différente chaque jour ; un acteur qui retire de la capacité (« manipulation à la Enron ») ; un prix négatif quand les ENR dépassent la demande.

**Points faibles** : calcul plus que logique ; vite répétitif seul. C'est un bon tutoriel ou une mise en jambe, pas le cœur du jeu.

---

### Concept C — « Qui produit quoi ? » (rôle : observateur, grille d'Einstein)

**Règle** : grille logique classique. Quatre centrales, quatre attributs (techno, exploitant, puissance), des indices tirés du marché. Le merit order sert d'outil de déduction : une centrale non appelée ne peut pas être moins chère qu'une centrale appelée.

**Énoncé**

Centrales : Belvent, Corbière, Lavaud, Mornay. Exploitants : Alba, Borée, Cyan, Delta. Technos : nucléaire (10 €), barrage (50 €), CCG (120 €), TAC (850 €). Puissances offertes : 2, 3, 4 et 5 GW. Il faut 10 GW ce soir.

```
 1. Lavaud, exploitée par Cyan, n'est pas appelée ce soir.
 2. Mornay brûle du gaz.
 3. Mornay est appelée pour 2 GW, la moitié de ce qu'elle offre.
 4. Belvent offre 1 GW de plus que Lavaud.
 5. Alba exploite la centrale la plus puissante : du nucléaire.
 6. Borée n'exploite pas de barrage.

             │ Nuc Bar CCG TAC │ Alb Bor Cya Del │ 2  3  4  5
 ────────────┼─────────────────┼─────────────────┼────────────
 Belvent     │                 │                 │
 Corbière    │                 │                 │
 Lavaud      │                 │                 │
 Mornay      │                 │                 │
 ────────────┼─────────────────┤
 2 GW        │                 │
 ...
 Q. Quel est le prix spot ce soir ?
```

**Solution**

```
 Corbière │ Nucléaire │ Alba  │ 5 GW │ appelée 5
 Belvent  │ Barrage   │ Delta │ 3 GW │ appelée 3
 Mornay   │ CCG       │ Borée │ 4 GW │ appelée 2  ← marginale
 Lavaud   │ TAC       │ Cyan  │ 2 GW │ non appelée
 Prix spot : 120 €/MWh      (5 + 3 + 2 = 10 GW)
```

Chemin : (1)+(2) Lavaud n'est pas appelée alors que la centrale au gaz Mornay l'est. Lavaud est donc plus chère qu'elle : Lavaud = TAC, Mornay = CCG. (3) Mornay = 4 GW. (4) parmi {2, 3, 5}, seul Lavaud 2 / Belvent 3 marche, donc Corbière 5. (5) Corbière = nucléaire, Alba ; Belvent = barrage. (6) Borée = Mornay, Delta = Belvent.

**Ce qu'il enseigne** : le merit order comme raisonnement (« si X tourne, tout ce qui est moins cher tourne ») et le prix marginal.

**Événements** : indices issus de l'actualité (« grève à Corbière », « Belvent est à sec »).

**Points faibles** : format bien connu et facile à générer, mais le thème électricité y est un habillage : on apprend peu de choses nouvelles après 3 grilles.

---

### Concept D — « Les îlots » (rôle : la bourse européenne, couplage)

**Règle**
1. Une carte de 3 pays, chacun avec sa demande et ses offres.
2. Des lignes d'interconnexion de capacité limitée (GW).
3. On choisit les flux (≤ capacité) pour minimiser le coût total, puis on donne le prix de chaque pays (centrale marginale locale).
4. Une ligne non saturée aligne les prix des deux côtés ; une ligne saturée les sépare.

**Carte du jour**

```
      ┌─────────────┐        ┌─────────────┐        ┌─────────────┐
      │   ESPAGNE   │        │   FRANCE    │        │  ALLEMAGNE  │
      │ dem. 12 GW  │◄══2══►│ dem. 45 GW  │◄══3══►│ dem. 55 GW  │
      │ Sol 15 @ 0  │        │ Nuc 50 @ 10 │        │ ENR 20 @ 0  │
      │ Gaz 10 @150 │        │ Gaz 20 @150 │        │ Cha 30 @100 │
      └─────────────┘        └─────────────┘        │ Gaz 20 @150 │
                                                    └─────────────┘
 Q1. Flux sur chaque ligne ?  Q2. Prix de chaque pays ?
 Q3. Et si la ligne FR-DE passait à 10 GW ?
```

**Solution**

```
   ES ──2──► FR ──3──► DE        (les deux lignes saturées)

   ES : 12 = Sol 12        + export 2 → Sol 14/15, marginal Sol  →   0 €
   FR : 45 + export 3 = Nuc 46 + import 2 → Nuc 46/50, marginal  →  10 €
   DE : 55 = ENR 20 + Cha 30 + import 3 + Gaz 2, marginal Gaz    → 150 €

 Q3 : FR exporte 7 (et non plus 3) : son nucléaire est plein
      (45 + 7 − 2 = 50), DE n'a plus besoin de gaz (20 + 7 + 28 Cha),
      la ligne FR-DE n'est plus saturée et le charbon fixe le prix des
      deux côtés : FR passe de 10 € à 100 €, DE descend de 150 € à 100 €.
      ES reste à 0 € (ligne ES-FR toujours saturée).
```

**Ce qu'il enseigne** : un prix par zone, la convergence des prix par les lignes, et le fait contre-intuitif qu'une interconnexion plus grosse fait *monter* le prix français tout en baissant le coût européen.

**Événements** : ligne coupée, canicule en Espagne, vent fort en Allemagne (prix négatif importé).

**Points faibles** : la solution demande un raisonnement d'optimisation en réseau, plus dur à rendre « logique » qu'arithmétique au-delà de 3-4 pays. La taille doit rester petite.

---

### Concept E — « Commandant RTE » (rôle : RTE le jour J)

**Règle**
1. On part d'un programme d'appel figé la veille (une heure, ou une colonne de la grille A).
2. On tire une ou deux cartes événement (froid, panne, vent qui tombe) qui créent un écart.
3. On le comble avec les réserves disponibles, chacune avec son coût et sa contrainte de délai.
4. Objectif : l'écart comblé au coût réel minimal, coût d'opportunité de l'eau compris.

**Situation du jour** — 18 h-19 h, programme prévu 62 GW

```
 ┌── ÉVÉNEMENTS ─────────────────────────────────────────┐
 │ ❄  Il fait 2 °C de moins que prévu : +4,8 GW          │
 │ ⚠  Un réacteur de 1,3 GW s'arrête d'urgence           │
 └──────────────────────────────── Écart à combler : 6,1 GW
 ┌── RÉSERVES ───────────────┬──────┬───────┬──────────────────────┐
 │ Barrage (vannes)          │ 2 GW │  50 € │ eau qui manquera     │
 │                           │      │       │ demain à la pointe   │
 │ CCG en marche (monter)    │ 3 GW │ 150 € │                      │
 │ Effacement industriel     │ 2 GW │ 300 € │                      │
 │ TAC de pointe             │ 5 GW │ 850 € │                      │
 │ Nucléaire (monter)        │ 1 GW │  10 € │ préavis 2 h : non    │
 └───────────────────────────┴──────┴───────┴──────────────────────┘
 Note : demain à 19 h, sans cette eau, il faudra une TAC de secours
 au plafond de 3 000 €.
```

**Solution**

```
 Piège : Barrage 2 + CCG 3 + Effacement 1,1   → 100 + 450 + 330 =   880 k€
         ... mais demain : 2 GW × 3 000 €     →                  + 6 000 k€
 Bon   : CCG 3 + Effacement 2 + TAC 1,1       → 450 + 600 + 935 = 1 985 k€
 Le nucléaire est exclu (préavis). Prix d'écart : 850 €/MWh, payé
 par les fournisseurs qui ont sous-estimé la demande.
```

**Ce qu'il enseigne** : pourquoi le spot se fait la veille (délais de démarrage), la valeur de l'eau, le règlement des écarts.

**Événements** : c'est le moteur du concept, avec un deck de cartes de 30 à 50 événements combinables.

**Points faibles** : peu de choix par situation (3 à 5 réserves) : le puzzle est court. C'est plus fort comme couche d'événements par-dessus A que seul.

---

### Concept F — « Rubans et pixels » (rôle : fournisseur alternatif)

**Règle**
1. La courbe de consommation de tes clients est donnée sur 6 créneaux.
2. Tu achètes à l'avance des rubans (1 GW sur tous les créneaux) : 2 rubans ARENH à 42 €, puis autant de rubans à terme que tu veux à 90 €.
3. Le reste s'achète au prix spot de chaque créneau, révélé dans la grille du jour.
4. Un excédent de ruban est revendu à la moitié du prix spot.
5. Objectif : choisir le nombre de rubans à terme qui minimise ta facture.

**Grille du jour**

```
 Créneau      0h   4h   8h  12h  16h  20h
 Besoin (GW)   3    4    6    5    7    4
 Spot (€)     60   80  150  120  200   70

 GW 7 │                        ▓
    6 │             ▓          ▓
    5 │             ▓    ▓     ▓
    4 │        ▓    ▓    ▓     ▓    ▓
    3 │   ▓    ▓    ▓    ▓     ▓    ▓
    2 │ ══════════════ ARENH ═══════════
    1 │ ══════════════ ARENH ═══════════
      └────────────────────────────────
 Q. Combien de rubans à terme acheter ?
```

**Solution** : on évalue chaque ruban supplémentaire. Sa valeur moyenne vaut le prix spot là où il sert, et la moitié là où il est en excédent.

```
 3e ruban : sert partout              → (60+80+150+120+200+70)/6       = 113 €  > 90 ✔
 4e ruban : excédent à 0h             → (30+80+150+120+200+70)/6       = 108 €  > 90 ✔
 5e ruban : excédent à 0h, 4h, 20h    → (30+40+150+120+200+35)/6       =  96 €  > 90 ✔
 6e ruban : sert à 8h et 16h seulement → (30+40+150+60+200+35)/6       =  86 €  < 90 ✘
 Réponse : 3 rubans à terme. Base = 5 GW, la dentelle (6 et 7 GW) au spot.
```

**Ce qu'il enseigne** : la base à l'avance et la dentelle au spot, l'ARENH, le risque d'un spot cher.

**Événements** : spot révélé seulement après le choix (variante aux dés pour jouer en « vrai » fournisseur), plafond ARENH réduit, client industriel en plus.

**Points faibles** : la réponse est un seul nombre, c'est donc plus un exercice de calcul marginal qu'un puzzle. Sans incertitude, l'intérêt de rejouer est faible.

---

### Concept G — « Le producteur » (rôle : producteur, enchères)

Le producteur ne choisit pas le programme d'appel : il le **subit**. Son seul levier, ce sont ses offres : quelle quantité, à quel prix. Le marché le paie au prix marginal, quelle que soit son offre.

**Règle**
1. Tu possèdes un petit parc ; les offres des concurrents et la demande sont connues.
2. Pour chacune de tes centrales, tu choisis la quantité offerte (tu peux en retenir) et le prix (multiple de 10 €).
3. Le marché empile toutes les offres ; à prix égal, le concurrent passe avant toi.
4. Ta marge = Σ (prix spot − ton coût) × quantité appelée.
5. Le régulateur ajoute des règles d'une question à l'autre.

**Fiche du jour** — demande : **50 GW**

```
 CONCURRENTS (fixes)               TON PARC
 ┌──────────────────┬────┬──────┐  ┌────────────┬────┬──────┐
 │ ENR + fil        │ 10 │   0 €│  │ Barrage    │  5 │  50 €│
 │ Nucléaire        │ 25 │  10 €│  │ Charbon    │  6 │ 150 €│
 │ CCG concurrente  │  8 │ 120 €│  └────────────┴────┴──────┘
 │ TAC de pointe    │ 10 │ 850 €│
 └──────────────────┴────┴──────┘
 Q1. Sans régulateur : quelle offre maximise ta marge ?
 Q2. Régulateur : chaque offre ≤ ton coût + 50 €. Ta meilleure offre ?
 Q3. En plus : retirer de la capacité un jour où le prix dépasse
     500 € coûte une amende de 4 000. Ta meilleure offre ?
```

**Solution**

```
 Référence « honnête » (offre au coût) : 35 + B 5 + CCG 8 + C 2 = 50
   → prix 150 €, marge = 100×5 + 0×2                         =   500

 Q1 : tout offrir, le charbon à 840 € (juste sous la TAC)
   35 + B 5 + CCG 8 = 48, puis C 2 GW à 840 → prix 840 €
   marge = 790×5 + 690×2                                      = 5 330
   (retenir du charbon pour faire appeler la TAC ne donne que
    4 700 : on gagne 10 € de prix mais on perd 1 GW appelé)

 Q2 : plafond coût + 50 → l'offre honnête plafonnée rapporte
   prix 200 €, marge = 150×5 + 50×2                           =   850
   Retenir 5 GW de charbon (« maintenance ») : 35 + 5 + 8 + C 1 = 49
   → il manque 1 GW, la TAC est appelée → prix 850 €
   marge = 800×5 + 700×1                                      = 4 700  ✔

 Q3 : retenir rapporte 4 700 − 4 000 = 700 < 850
   → tout offrir au plafond                                   =   850  ✔
```

**Ce qu'il enseigne** : le prix unique au coût marginal récompense le producteur qui est **pivot**, c'est-à-dire indispensable à la pointe. Retenir de la capacité fait grimper le prix (la manœuvre d'Enron citée dans la vidéo), et c'est pour cette raison que le nucléaire d'EDF est surveillé. Chaque règle de régulation se voit dans le changement de la meilleure stratégie.

**Événements** : un concurrent en panne te rend pivot ; vague de froid ; le régulateur durcit ou assouplit l'amende ; tu détiens une partie de la TAC.

**Points faibles** : face à des concurrents figés, c'est de l'optimisation, pas de la théorie des jeux. La solution est unique mais l'espace de choix est petit. Une variante à 2 joueurs (offres sous enveloppe) serait plus riche, mais sort du cadre « solo imprimable ».

---

## 3. Comparatif et recommandation

| Concept | Rôle | Solution | Profondeur | Apprentissage | Génération quotidienne | Durée |
|---|---|---|---|---|---|---|
| **A** Tetris des pixels | Bourse | unique (coût puis facture) | ★★★ | ★★★ merit order, rampe, eau, prix marginal | ★★★ grille + solveur simple | 10-20 min |
| **A bis** Objectif du jour | Bourse/planificateur | unique (objectif combiné) | ★★★ | ★★★ coût vs CO₂, merit order = un choix | ★★★ même grille, carte objectif | 10-20 min |
| **B** Carnet troué | Euphemia | unique | ★ | ★★ enchère, falaise de prix | ★★★ trivial | 3-5 min |
| **C** Qui produit quoi | Observateur | unique | ★★ | ★ | ★★ générateur d'Einstein classique | 10-15 min |
| **D** Les îlots | Couplage UE | unique | ★★ | ★★★ prix par zone, convergence | ★ dur à garantir au-delà de 3 pays | 10 min |
| **E** Commandant RTE | RTE | unique (coût) | ★ | ★★ jour J, écarts, valeur de l'eau | ★★ deck de cartes | 3-5 min |
| **F** Rubans et pixels | Fournisseur | un nombre | ★ | ★★ terme vs spot, ARENH | ★★★ trivial | 5 min |
| **G** Le producteur | Producteur | unique par question | ★★ | ★★★ pouvoir de marché, régulation | ★★ | 5-10 min |

**Ma recommandation : A comme cœur du jeu, E comme couche d'événements, B en tutoriel.**

- **A** est le seul concept où le thème *est* le puzzle : une grille de pixels qui reprend la métaphore Tetris/pixel art des vidéos, avec des contraintes croisées qui donnent de la vraie logique. Il a deux scores (coût et facture), donc des niveaux de difficulté naturels.
- **A bis** se greffe sur A sans coût de règles : la carte « objectif du jour » (coût, CO₂, combiné) multiplie les puzzles à partir d'une même grille et montre que le merit order est un choix.
- **G** est la meilleure porte d'entrée pour le rôle producteur : court, à questions successives, et c'est lui qui explique le mieux pourquoi le prix marginal pose problème.
- **E** donne les « événements du jour » du brief sans format à part : une carte en tête de la grille A (« panne de réacteur », « vague de froid ») modifie les contraintes.
- **B** est l'onboarding idéal : 3 minutes pour comprendre le prix marginal avant la première grille A.
- **D** mérite une version « semaine spéciale Europe » une fois A rodé : sa leçon (la France paie plus cher quand elle exporte) est la plus surprenante, mais sa difficulté est plus dure à régler.
- **C** et **F** : à écarter ou à garder en bonus. C est un habillage, F est un calcul.

**Prochaine étape suggérée** (hors périmètre de ce document) : un petit solveur pour A (programmation linéaire en nombres entiers ou backtracking, 6 colonnes × 10 lignes), qui vérifie l'unicité de la solution et classe la difficulté d'une grille générée. Sans lui, pas de puzzle du jour fiable.
