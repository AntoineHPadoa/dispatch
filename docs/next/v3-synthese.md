# Synthèse v3 : solveur, générateur et labo (22-25 novembre 2026)

Bilan du workspace `v3-lab-solver` : quatre jours de jeu à l'aveugle dans le labo, d'analyses et de lots. **111 grilles notées par Joueur 1** en 6 sessions, dont la session finale `matin-25` (15 grilles), et 8 par Joueur 2. Ce document résume ; le détail et les calculs sont dans les sources citées entre parenthèses.

## 1. Ce qui a changé

**Le jeu**
- **Météo en usines imposées** : les cases de soleil, de vent et de fil de l'eau sont des briques posées d'avance en bas de leur colonne. Une centrale est un vrai rectangle sur une ligne de la grille, jamais pliée en escalier (`docs/next/meteo-briques.md`, `GAME-DESIGN.md` §2-§5). Aucune grille publiée n'était touchée.
- **Notation A** : les techniques seules plafonnent à Moyen ; Difficile et Expert exigent une mécanique globale (STEP, plafond CO₂) **couplée à un échange** (`GAME-DESIGN.md` §9). G11 est passée Facile.

**Le labo** (`lab/README.md`)
- **Sessions** : une liste de grilles à enchaîner, avec « Jouer la suivante » et un retour « belle ou pas belle, pourquoi » après chaque grille. « Nouvelle session » tire 6 grilles d'un lot, équilibrées par note, sans rien révéler.
- **★ par joueur** et commentaire par joueur dans `notes.json`.
- **À l'aveugle** : ni note du solveur, ni technique, ni mesure d'un autre joueur avant son propre ressenti.
- **Archive** : les lots mis de côté restent lisibles (clés `lot:index` intactes) mais ne se jouent plus.

**Le générateur** (`GAME-DESIGN.md` §10, `lab/candidates/V3*.md`)
- **Décisions** : un choix que la déduction doit trancher (échange, STEP, pièce haute, rampe, CO₂, stock, prix). Une grille sans décision est rejetée.
- **Nettoyage** des mécaniques mortes : voisin sans échange, plafond CO₂ inutile.
- **Diversité** : quotas par famille, mécaniques et profil d'indices ; au plus 2 grilles par entrée du mélange (quasi-jumelles) ; plafond de grilles à 12 créneaux.
- **Mesures** du bloc `lab`, sans filtre : cases (`cells`), lignes pleines de nucléaire, part de nucléaire, compacité K, trous, mécaniques couplées.
- **Plafonds de taille** (`v3-gen-6`) : `max_cells` et `max_full_n_rows`, rejet `quota:cells` pris juste après la pose de référence. Confirmés en `matin-25`, ils entrent dans la référence (§4).
- **Timeout** : un tirage de plus de 5 min est abandonné (`timeout`) au lieu de bloquer le lot.

## 2. Ce qui a été appris

### Solide

- **C1, une mécanique morte fait rejeter** : 4 rejets sur 4 en session 2, 1 ★ sur 7 au total, commentaires explicites (`v3-criteres.md`, `v3-challenge.md`).
- **C2, sans décision c'est du remplissage** : 0 ★ sur 7. Avec au moins 2 décisions, 14 ★ sur 19, contre 4 sur 18 (p ≈ 0,002). Prédit en session 2, vérifié en session 3, ancrage tenu en M24 (`v3-criteres-s3.md`, `v3-criteres-m24.md`).
- **Une globale couplée rend la grille plus dure, mais s'use** : ressenti 2,25 contre 1,24 (ρ 0,56, 69 grilles). Sans échange, STEP et CO₂ sont ressentis 1, Joueur 2 compris (`v3-criteres-j2.md`). L'usure : ressenti des couplées 2,33 (S3), 3,0 (G3B), 2,08 (M23), 1,86 (M24), puis 2,0 (M25, contre 1,5 sans couplée). Plus dure ne veut pas dire plus belle : 6 ★ sur 13 couplées en M23 (`v3-criteres-m23.md`).
- **La compacité, c'est le nombre de cases, confirmée hors échantillon** : en `matin-25`, 1re session jouée après la définition de `max_cells`, les grilles de 30 cases ou moins ont **8 ★ sur 10**, celles de 40 ou plus **0 sur 4**, toutes reprochées « trop grosses » (p = 0,015). Compactes `v3g6-compact` 7 ★ sur 9, grandes 0 sur 3 (`v3-criteres-m25.md`).
  - **Les cases mesurent le mieux le « trop gros pour rien »** : AUC 0,88 avant M25, 0,97 en M25, 0,89 sur 110 grilles ; hauteur (demande max) 0,70, créneaux 0,66, part de nucléaire 0,73.
  - **Seuils** (cumul, ★) : 70 % à 24 cases ou moins, 66 % à 25-30, 56 % à 31-39, **24 % à 40 ou plus** ; au-delà de 30 cases, 13 des 14 reproches « trop gros ». 2 lignes pleines de nucléaire ou plus : 26 %.
  - **Hauteur et créneaux n'ajoutent rien une fois les cases plafonnées** : à 30 cases ou moins, 8 GW et plus font 5 ★ sur 9, sans reproche. Le « 10 GW sur 12 créneaux » de Joueur 1 décrit des grilles de 45 à 87 cases.
  - Calé sur Joueur 1 seul : à revoir avec des joueurs neufs.
- **Peu de nucléaire → plus de ★** : 12 ★ sur 15 sous 50 %, contre 42 sur 81 (p = 0,04). Ça ne suffit pas sans décision.
- **Règle objective de difficulté** : abandon → Expert ; sinon 6 s par case ou plus → Difficile ; sinon une gomme, annulation, remise à zéro, ou 2,5 s par case → Moyen ; sinon Facile. Accord avec le ressenti : 81 % en M24, mais **47 % en M25** (il ressent plus que la règle : +0,53 cran), 69 % sur 110 grilles. Sur les petites grilles, une fausse piste sans gomme ne laisse pas de trace (`v3-criteres-m25.md`). Les erreurs (poses refusées) ne signalent rien : 9 Faciles sur 15 en ont (`v3-criteres-m24.md` §3). Réserve : la règle reprend l'échelle décrite par Joueur 1 pendant M24, l'accord n'est donc pas indépendant ; elle n'est pas testée sur un novice.

### Infirmé

- **K, densité de décisions, comme prédicteur du ★** : ρ 0,72 sur les sessions qui l'ont construit, puis 0,16 en M23 et 0,14 en M24 (`v3-challenge.md`, `v3-criteres-m24.md`).
- **H1, un Moyen à K < 0,5 se joue comme un Facile** : les 4 Moyens testés ont leur ★ et sont ressentis 1 ou 2 quel que soit K. Cause probable : l'expertise de Joueur 1, pas la grille.
- **H3, un trou contesté rend la grille belle** : 2 ★ sur 3 contre 2 sur 2 pour les trous uniques.
- **« Le squelette guérit le remplissage »** : `v3g5-squelette` baisse le nucléaire (61 % contre 81 %) mais garde 3 « remplissage » sur 7, autant que les témoins. Sans décision, le gaz se pose aussi mécaniquement que le nucléaire.
- **« Les filtres font plus de ★ »** : nouveaux lots 62 % de ★, témoins 43 %, p = 0,65. `v3g5-temoin`, sans les quotas ajoutés depuis `v3g1`, fait autant que `v3g4`. Les 3 contre-prédictions du challenger (ancien générateur, peu de nucléaire ou 3 voisins) ont toutes leur ★.

### Ouvert

- **Un plafond de hauteur ou de créneaux en plus des cases** : pas de signal propre (ci-dessus). Seule réserve : sous 30 cases, les 2 grilles à 12 créneaux n'ont pas de ★ (`v3g6-compact` n°13, « remplir avec du nucléaire partout »). Trop peu pour un seuil.
- **Le remplissage de nucléaire dans une petite grille** : 2 compactes de 28 cases sur 9 restent « trop de nucléaire » (n°1 et n°13, 86 et 96 % de nucléaire). Le plafond de taille ne le traite pas.
- **H4, Expert à 4 échanges ou plus plus dur qu'Expert à 1** : dans le bon sens, sur 2 grilles seulement.
- **Le ressenti d'un novice** : Joueur 1 joue 8 % plus vite à chaque session à note égale, sans que son ressenti bouge. Joueur 2 ressent +0,57 cran et met 2,5 fois plus de temps. On ne sait pas si un Moyen est un Moyen pour un joueur neuf.
- **La stabilité du jugement** : aucun vrai rejeu à l'aveugle, le labo montre l'ancienne ★.

## 3. La démarche à garder

- **Des témoins dans chaque session** : des grilles de l'ancien générateur ou tirées au hasard, mêlées à l'aveugle. Il en faut une vingtaine pour voir un écart de ★ ; 7 n'ont rien tranché.
- **Des prédictions chiffrées avant de jouer** (P(★), ressenti), comparées à une référence triviale (« P = taux moyen », « toujours 1 »). M24 : nos prédictions ne battent pas cette référence. M25 : elles la battent (Brier 0,212 contre 0,240), sans certitude (74 % des tirages bootstrap), et grâce aux grandes grilles.
- **Plusieurs joueurs** : un concepteur qui a fait 96 grilles ne juge plus pour le public.
- **Une hypothèse se juge à la session suivante**, sur des grilles qui ne l'ont pas construite. Ce qui n'est confirmé que sur les données d'origine reste une hypothèse.
- **Pas d'empilement de quotas** : chaque quota ajouté sans témoin a coûté de la diversité (carnet exact, 3 voisins, 12 créneaux perdus en route, `v3-challenge.md` §3) sans gain de ★ mesurable.

## 4. Réglage recommandé et lots

**Configuration de référence** : `lab/lots/reference.json`, à copier en changeant le nom du lot et la graine.
- **Mélange** de `v3g4-jouer-a`, plus deux entrées de `v3-jouer-a` perdues en route : 3 voisins, surplus sur 8 créneaux.
- **Gardés** : nettoyage C1 et rejet `no_decision` (C2), tous deux par défaut ; quotas de diversité généraux ; au plus 2 grilles par entrée ; au plus 3 grilles sur 12 créneaux, faute encore de plafond de taille.
- **Retirés** : planchers et plafonds par type de décision, quota de décision unique, prix de demande. Aucun effet visible au ★.
- **Essai** (hors dépôt) : 20 grilles sur 20 en 67 tirages, 31 s. 8 Faciles, 7 Moyens, 3 Difficiles et 2 Experts. Médiane 27 cases, mais 4 grilles à 40 cases ou plus : c'est ce que vise `v3g6-compact`.

**Plafonds de taille, ajoutés** après la session finale `matin-25` (`v3-criteres-m25.md`) : la compacité y est confirmée hors échantillon.
- `max_cells` **30** et `max_full_n_rows` **1**, les valeurs jouées. Le plafond de lignes pleines n'est pas testé seul : il vient avec celui des cases.
- `allow_one_plant` sur chaque entrée : une journée basse ne laisse souvent qu'une sorte de centrale.
- **Pas de plafond de hauteur ni de créneaux** : les données ne les soutiennent pas une fois les cases plafonnées. Le plafond de 3 grilles sur 12 créneaux reste ; sous 30 cases, il en sort peu (2 sur 20).
- **Essai de la référence** (hors dépôt, graine 3101) : 20 grilles sur 20 en 213 tirages, 27 s, `check --strict --no-ramp` vert. 7 Faciles, 7 Moyens, 4 Difficiles, 2 Experts. Médiane 24 cases (12 à 30), 17 grilles sans ligne pleine. 123 rejets `quota:cells`, peu coûteux.

**Lots gardés** (dans le labo) : `v3-jouer-a/b/c` (témoins historiques), `v3g2-jouer-c`, `v3g3-jouer-a/b`, `v3g4-jouer-a/b/c`, `v3g4-rampe`, `v3g5-temoin`, `v3g5-squelette`, `nuit-rejeu-notees` (rejeu des grilles publiées notées). Ils portent les 55 grilles ★.

**Lots archivés** (`lab/candidates/archive/`) : jamais joués, `v3-rampe` (remplacé par `v3g4-rampe`), `v3-reprises`, `v3g1-jouer-a/b/c`, `v3g2-jouer-a/b` ; et `v3-confort` (G8 sans son indice de confort, test fini, 1 partie), désormais versionné pour que sa clé résolve sur tout clone.

**Données de jeu** : `plays.jsonl`, `notes.json` et les sessions restent locales, hors git (dépôt public, commentaires personnels). Sessions de test finies rangées dans `lab/sessions/archive/` : `v3-confort`, `v3g3-dures` (fondue dans `matin-23`).

**`v3g6-compact`** : gardé dans le labo, comme lot joué de la session finale (11 grilles encore jamais jouées). Ce n'est pas le lot de référence : son plancher `stock` à 1 et ses quotas par type viennent de `v3g4`, que la référence a retirés. Un nouveau lot part de `reference.json`.

## 5. Backlog des prochains chantiers

**UX**
- Montrer les hauteurs optionnelles dans l'inventaire (charbon sur 2 lignes) : déjà lancé par `v3-design`. « Je n'avais pas compris que le charbon pouvait se poser sur 2 lignes » revient deux fois.
- Le jeu n'affiche nulle part qu'on peut exporter autant qu'on veut (dans la capacité du voisin) : Joueur 1 a « buggué » dessus sur `v3g6-compact` n°6 (`matin-25`).
- Sélecteur de joueur du labo trop facile à laisser sur la mauvaise personne : 6 parties de Joueur 1 enregistrées sous Joueur 2 (`v3-criteres-g3.md`). Piste : demander le joueur au début de chaque session.

**Tutoriel d'onboarding**
- La STEP et le CO₂ couplé sont durs pour un joueur neuf : Joueur 2 a mis 619 s, avec 14 gommes, sur une STEP + échange.
- La pièce haute n'est pas comprise sans aide.
- Joueur 2 s'est arrêté après 8 grilles (34 min actives) : sessions de 6 grilles pour un joueur occasionnel. Les grilles à 12 créneaux usent (65 % de temps en plus).

**Labo**
- Mesurer le temps de réflexion (inactivité) et le délai avant la 1re pose : aujourd'hui, « se poser pour regarder » ne se distingue pas d'une manipulation lente.
- Vrais rejeux à l'aveugle : masquer l'état résolu, la ★ et le commentaire d'une grille déjà jouée.
- Détecter les impasses de quotas avant de lancer un lot : `v3g4-jouer-b` et `v3g5-squelette` ont calé à 18/20.
- Remplacer le hook GitHub limité.
- La règle objective sous-estime son ressenti sur les petites grilles (47 % d'accord en M25) : avec le temps d'inactivité, revoir le seuil de 2,5 s par case, et tester si une erreur signale une fausse piste (4 des 5 grilles ressenties Moyen et cotées Facile en ont une).

**Générateur**
- **Facile surreprésenté sous plafond** : `v3g6-compact` sort 10 Faciles sur 20, dont 5 pièces hautes seules. Essai à faire : `min_per_rating` `{"2": 6}`, contre un lot témoin.
- **Nucléaire dans les petites grilles** : 2 compactes sur 9 restent « trop de nucléaire ». Piste à tester contre témoin : combiner `max_cells` avec `max_nuclear` (squelette), qui seul n'avait rien donné.
- **12 créneaux sous 30 cases** : la moitié des tirages tombe en `quota:cells`, et les 2 grilles de ce type jouées n'ont pas de ★. À trancher : garder des journées de 12 créneaux, ou les réserver aux grilles plus grandes.

**Protocole de recrutement**
- 10 grilles communes, tirées au hasard, dont 3 témoins ; mêmes grilles pour chaque joueur.
- Ressenti et ★ du joueur, et règle objective calculée à côté (gommes, s / case, abandon).
- Au moins 2 joueurs neufs avant de retoucher la notation A.

**Promotion vers le site**

Candidates les mieux reçues, à faire jouer aux nouveaux joueurs avant promotion (skill `add-grid`) :

| Grille | Cases | Note A | ★ | Pourquoi |
|---|---|---|---|---|
| `v3-jouer-c` n°10 | 29 | Expert | J1 + J2 | « super grille », plafond CO₂ |
| `v3-jouer-a` n°15 | 25 | Moyen | J1 + J2 | empilement des exports |
| `v3-jouer-c` n°17 | 36 | Facile | J1 + J2 | plusieurs mécaniques |
| `v3-jouer-b` n°1 | 34 | Difficile | J1 + J2 | import et export |
| `v3-jouer-b` n°20 | 51 | Difficile | J1 + J2 | belle, mais grande |
| `v3g5-squelette` n°2 | 21 | Difficile | J1 | « plusieurs mécaniques et compact » |
| `v3g3-jouer-b` n°2 | 24 | Difficile | J1 | le CO₂ limite le remplissage |
| `v3g3-jouer-b` n°11 | 17 | Facile | J1 | « belle grille compacte » |
| `v3g4-jouer-a` n°12 | 27 | Expert | J1 | coordonner export et STEP |
| `v3g4-rampe` n°10 | 30 | Moyen | J1 | rampe, ressentie 4 |
| `v3g4-rampe` n°1 | 25 | Expert | J1 | rampe compacte |
| `v3-jouer-a` n°2 | 27 | Difficile | J1 | l'astuce est la pompe |
| `v3g6-compact` n°6 | 23 | Expert | J1 | ressentie 3, STEP + CO₂ couplées |
| `v3g6-compact` n°5 | 19 | Moyen | J1 | ressentie 3, « étonnamment galéré » sur la STEP |
| `v3g5-temoin` n°4 | 31 | Facile | J1 | ressentie 3, coordonner les imports |
| `v3g6-compact` n°11 | 16 | Facile | J1 | « bonne grille de démarrage » |
