# Synthèse v3 : solveur, générateur et labo (22-25 novembre 2026)

Bilan du workspace `v3-lab-solver` : trois jours de jeu à l'aveugle dans le labo, d'analyses et de lots. **96 grilles notées par Joueur 1** en 5 sessions, 8 par Joueur 2. Ce document résume ; le détail et les calculs sont dans les sources citées entre parenthèses.

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
- **Timeout** : un tirage de plus de 5 min est abandonné (`timeout`) au lieu de bloquer le lot.

## 2. Ce qui a été appris

### Solide

- **C1, une mécanique morte fait rejeter** : 4 rejets sur 4 en session 2, 1 ★ sur 7 au total, commentaires explicites (`v3-criteres.md`, `v3-challenge.md`).
- **C2, sans décision c'est du remplissage** : 0 ★ sur 7. Avec au moins 2 décisions, 14 ★ sur 19, contre 4 sur 18 (p ≈ 0,002). Prédit en session 2, vérifié en session 3, ancrage tenu en M24 (`v3-criteres-s3.md`, `v3-criteres-m24.md`).
- **Une globale couplée rend la grille plus dure, mais s'use** : ressenti 2,25 contre 1,24 (ρ 0,56, 69 grilles). Sans échange, STEP et CO₂ sont ressentis 1, Joueur 2 compris (`v3-criteres-j2.md`). L'usure : ressenti des couplées 2,33 (S3), 3,0 (G3B), 2,08 (M23), puis 1,86 (M24). Plus dure ne veut pas dire plus belle : 5 ★ sur 12 couplées en M23 (`v3-criteres-m23.md`).
- **La compacité, c'est le nombre de cases** : `cells` attrape le reproche « pas compact » avec une AUC de 0,89 en M24, contre 0,51 pour la part de nucléaire. 40 cases ou plus, ou 2 lignes pleines de nucléaire : 0 ★ sur 3. Les 9 commentaires « compact » vont dans le même sens : éloges à 17-31 cases, reproches à 31-69 (`v3-criteres-m24.md` §2).
- **Peu de nucléaire → plus de ★** : 12 ★ sur 15 sous 50 %, contre 42 sur 81 (p = 0,04). Ça ne suffit pas sans décision.
- **Règle objective de difficulté** : abandon → Expert ; sinon 6 s par case ou plus → Difficile ; sinon une gomme, annulation, remise à zéro, ou 2,5 s par case → Moyen ; sinon Facile. Accord avec le ressenti : 81 % en M24, 71 % sur 96 grilles. Les erreurs (poses refusées) ne signalent rien : 9 Faciles sur 15 en ont (`v3-criteres-m24.md` §3).

### Infirmé

- **K, densité de décisions, comme prédicteur du ★** : ρ 0,72 sur les sessions qui l'ont construit, puis 0,16 en M23 et 0,14 en M24 (`v3-challenge.md`, `v3-criteres-m24.md`).
- **H1, un Moyen à K < 0,5 se joue comme un Facile** : les 4 Moyens testés ont leur ★ et sont ressentis 1 ou 2 quel que soit K. Cause probable : l'expertise de Joueur 1, pas la grille.
- **H3, un trou contesté rend la grille belle** : 2 ★ sur 3 contre 2 sur 2 pour les trous uniques.
- **« Le squelette guérit le remplissage »** : `v3g5-squelette` baisse le nucléaire (61 % contre 81 %) mais garde 3 « remplissage » sur 7, autant que les témoins. Sans décision, le gaz se pose aussi mécaniquement que le nucléaire.
- **« Les filtres font plus de ★ »** : nouveaux lots 62 % de ★, témoins 43 %, p = 0,65. `v3g5-temoin`, sans les quotas ajoutés depuis `v3g1`, fait autant que `v3g4`. Les 3 contre-prédictions du challenger (ancien générateur, peu de nucléaire ou 3 voisins) ont toutes leur ★.

### Ouvert

- **H4, Expert à 4 échanges ou plus plus dur qu'Expert à 1** : dans le bon sens, sur 2 grilles seulement.
- **Le ressenti d'un novice** : Joueur 1 joue 8 % plus vite à chaque session à note égale, sans que son ressenti bouge. Joueur 2 ressent +0,57 cran et met 2,5 fois plus de temps. On ne sait pas si un Moyen est un Moyen pour un joueur neuf.
- **La stabilité du jugement** : aucun vrai rejeu à l'aveugle, le labo montre l'ancienne ★.

## 3. La démarche à garder

- **Des témoins dans chaque session** : des grilles de l'ancien générateur ou tirées au hasard, mêlées à l'aveugle. Il en faut une vingtaine pour voir un écart de ★ ; 7 n'ont rien tranché.
- **Des prédictions chiffrées avant de jouer** (P(★), ressenti), comparées à une référence triviale (« P = taux moyen », « toujours 1 »). M24 : nos prédictions ne battent pas cette référence.
- **Plusieurs joueurs** : un concepteur qui a fait 96 grilles ne juge plus pour le public.
- **Une hypothèse se juge à la session suivante**, sur des grilles qui ne l'ont pas construite. Ce qui n'est confirmé que sur les données d'origine reste une hypothèse.
- **Pas d'empilement de quotas** : chaque quota ajouté sans témoin a coûté de la diversité (carnet exact, 3 voisins, 12 créneaux perdus en route, `v3-challenge.md` §3) sans gain de ★ mesurable.

## 4. Réglage recommandé et lots

**Configuration de référence** : `lab/lots/reference.json`, à copier en changeant le nom du lot et la graine.
- **Mélange** de `v3g4-jouer-a`, plus deux entrées de `v3-jouer-a` perdues en route : 3 voisins, surplus sur 8 créneaux.
- **Gardés** : nettoyage C1 et rejet `no_decision` (C2), tous deux par défaut ; quotas de diversité généraux ; au plus 2 grilles par entrée ; au plus 3 grilles sur 12 créneaux, faute encore de plafond de taille.
- **Retirés** : planchers et plafonds par type de décision, quota de décision unique, prix de demande. Aucun effet visible au ★.
- **Essai** (hors dépôt) : 20 grilles sur 20 en 67 tirages, 31 s. 8 Faciles, 7 Moyens, 3 Difficiles et 2 Experts. Médiane 27 cases, mais 4 grilles à 40 cases ou plus : c'est ce que vise `v3g6-compact`.

> **À remplir par S10.3** : verdict de la session finale `v3g6-compact` (`matin-25`) et plafonds de taille à ajouter à la référence (`max_cells`, `max_full_n_rows` de `v3-gen-6`), ou raison de ne pas les ajouter.

**Lots gardés** (dans le labo) : `v3-jouer-a/b/c` (témoins historiques), `v3g2-jouer-c`, `v3g3-jouer-a/b`, `v3g4-jouer-a/b/c`, `v3g4-rampe`, `v3g5-temoin`, `v3g5-squelette`, `nuit-rejeu-notees` (rejeu des grilles publiées notées). Ils portent les 55 grilles ★.

**Lots archivés** (`lab/candidates/archive/`, jamais joués) : `v3-rampe` (remplacé par `v3g4-rampe`), `v3-reprises`, `v3g1-jouer-a/b/c`, `v3g2-jouer-a/b`.

> **À remplir par S10.3** : sort de `v3g6-compact` (gardé, ou lot de référence).

## 5. Backlog des prochains chantiers

**UX**
- Montrer les hauteurs optionnelles dans l'inventaire (charbon sur 2 lignes) : déjà lancé par `v3-design`. « Je n'avais pas compris que le charbon pouvait se poser sur 2 lignes » revient deux fois.
- Sélecteur de joueur du labo trop facile à laisser sur la mauvaise personne : 6 parties de Joueur 1 enregistrées sous Joueur 2 (`v3-criteres-g3.md`). Piste : demander le joueur au début de chaque session.

**Tutoriel d'onboarding**
- La STEP et le CO₂ couplé sont durs pour un joueur neuf : Joueur 2 a mis 619 s, avec 14 gommes, sur une STEP + échange.
- La pièce haute n'est pas comprise sans aide.
- Un joueur occasionnel décroche après ~6 grilles, et les grilles à 12 créneaux usent (65 % de temps en plus).

**Labo**
- Mesurer le temps de réflexion (inactivité) et le délai avant la 1re pose : aujourd'hui, « se poser pour regarder » ne se distingue pas d'une manipulation lente.
- Vrais rejeux à l'aveugle : masquer l'état résolu, la ★ et le commentaire d'une grille déjà jouée.
- Détecter les impasses de quotas avant de lancer un lot : `v3g4-jouer-b` et `v3g5-squelette` ont calé à 18/20.
- Remplacer le hook GitHub limité.

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
