# Critères d'une belle grille — session `v3g3-jouer-b` (Joueur 1)

Source : session `v3g3-jouer-b-1` (6 grilles, 22 nov. 2026, 22h36-22h51), cumulée avec les 37 grilles `v3-jouer-*` de Joueur 1. Premières parties (`attempt == 1`, hors fantômes). Notes A : `difficulty` des lots, déjà re-notés ; ancienne note (V0) : `trace_summary.technique_level`, égale à l'ancienne `difficulty` sur les 60 grilles `v3-jouer-*`. Scripts dans le scratchpad, hors dépôt. Numéros `n°` = index + 1.

**Attribution** : les 6 parties ont d'abord été enregistrées sous « Joueur 2 » (sélecteur resté sur J2). Rythme et frappe sont ceux de Joueur 1. Elles ont depuis été réattribuées dans `plays.jsonl` et `notes.json`. La partie `v3-confort` n°1 (21h40) est sans doute dans le même cas : elle est exclue ici.

## 1. Tableau par grille (ordre de jeu)

Décisions : `ex` échange, `st` STEP, `co` CO₂, `ha` pièce haute. Couplée : mécanique globale avec un échange.

| Grille | Note A | Ress. | Temps | Err./gommes | ★ | Couplée | Décisions | K | Commentaire abrégé |
|---|---|---|---|---|---|---|---|---|---|
| n°11 (6 cr.) | Facile | 2 | 41 s | 1/1 | ★ | non (STEP sans voisin) | st, ha | 1,0 | « belle grille moyenne compacte ; le charbon pas au bon endroit » |
| n°2 (8 cr.) | Difficile | 2 | 38 s | 0/1 | ★ | CO₂ + BE | ex, co | 0,50 | « belle petite grille ; le CO₂ limite le remplissage bête » |
| n°15 (12 cr.) | Facile | 1 | 27 s | 0/0 | | non (stock inutile) | ha | 0,17 | « du remplissage ; pas eu à utiliser les 3 barrages » |
| n°6 (12 cr.) | Difficile | **4** | **311 s** | 5/7, 1 RAZ | ★ | STEP + IT | 5 ex, st | 0,67 | « bien galéré : exporter à 8/10/12h ; la STEP ajoute une couche ; bonne grille » |
| n°19 (8 cr.) | Moyen | 1 | 29 s | 1/0 | | non | 2 ex | 0,15 | « du remplissage » |
| n°1 (8 cr.) | Expert | — | 85 s | 3/1 | ★ | STEP + CO₂ + ES | 5 ex, st, co | 1,1 | aucun (ressenti non validé) |

Bilan : 4 ★ sur 6, 9 min de jeu actif. Les 2 rejets sont les 2 grilles à K < 0,2.

## 2. Notation A

| 42 grilles notées (37 + 5) | ρ avec le ressenti | Erreur moy. | Biais | Exactes |
|---|---|---|---|---|
| Ancienne (V0) | 0,08 | 1,00 | +0,81 | 13 |
| **A** | **0,44** | **0,52** | +0,29 | 20 |
| Les 37 anciennes seules : V0 → A | 0,15 → 0,41 | 1,00 → 0,49 | +0,95 → +0,32 | 12 → 19 |

- **Oui, A suit mieux le ressenti** : ρ ×5 et erreur divisée par 2. Sur ces 5 grilles, A n'a que 1 exacte, mais elle les classe bien (n°6 en tête).
- **Les grilles couplées sont ressenties plus dures** : couplées, ressenti 2, 2, 2, 2, 2, 3, 4 (moyenne 2,43, **7 ★ sur 7**). Non couplées : 29 ressentis 1 sur 35 (moyenne 1,17, 15 ★ sur 35). ρ(nombre de couplées, ressenti) = 0,70.
- **D'où vient l'erreur restante** : 12 des 15 grilles notées Moyen en A sont ressenties 1. Et 5 des 6 Difficile sont ressenties 2. Pour Joueur 1, A est un cran trop haut au-dessus de Facile, mais **dans le bon ordre**. Joueur 2 ressentait +0,6 cran : A reste un compromis entre les deux.

## 3. Ce qui plaît maintenant

| | Session 2 (20) | Session 3 (18) | **v3g3-b (6)** |
|---|---|---|---|
| Couplées | 2 (10 %) | 3 (17 %) | **3 (50 %)** |
| K médian ; K ≥ 0,5 | 0,14 ; 3 | 0,22 ; 2 | **0,67 ; 4** |
| Sans décision | 5 | 2 | **0** |
| ★ | 8 (40 %) | 11 (61 %) | 4 (67 %) |
| Ressenti ≥ 2 | 5 sur 20 | 5 sur 18 | 3 sur 5 |

- **La densité de décisions** : sur les 43 grilles, K ≥ 0,5 donne **9 ★ sur 9** ; K de 0,2 à 0,5, 9 sur 12 ; K < 0,2, 5 sur 22.
- **Une vraie grille dure** : n°6 est le 1er ressenti 4 de Joueur 1 (311 s, contre 317 s pour c n°10). Elle est dure pour la même raison : les exports changent la silhouette et la STEP se cale dessus.
- **Courtes et nettes** : 2 grilles jouées en moins de 45 s et gardées (n°11, n°2). Le CO₂ en carnet libre « limite le remplissage » au lieu de l'inviter.
- **Le défaut qui reste** : une mécanique déclarée mais inutile (n°15, stock jamais utilisé), qui relève de C1, et une grille sans décision lourde (n°19).

## 4. Suite recommandée (une option)

| | Option | Coût | Avis |
|---|---|---|---|
| **A** | **Session 2 sur les 8 Difficile / Expert non jouées de v3g3** (a n°2, 5, 6, 11, 16 ; b n°12, 13, 14), dont 6 tirées, plus rejouer b n°1 pour avoir son ressenti | ~15 min de jeu, 0 dev ; analyse ~1 tâche | **recommandé** : 7 grilles couplées seulement fondent A et le « ★ si couplée ». 6 de plus, à faible coût, avant de figer quoi que ce soit. |
| B | Promouvoir vers le site b n°6 (Difficile, ressenti 4), b n°1 (Expert, ★) et b n°2 (Difficile, ★) | 1 tâche `add-grid` + revue, `check_unique.py` | Le site n'a plus de Difficile / Expert notée depuis A. Seulement si l'humain le demande ; b n°1 sans ressenti. |
| C | Lot `v3g4` : K ≥ 0,3 en mesure de tirage, globale couplée plus fréquente, lot A régénéré | 1 génération + revue + 1 session | Prématuré avant A : les quotas `coupled` actuels produisent déjà des grilles qui plaisent. |
| D | Corriger seulement le lot `v3g3-jouer-a` (autre graine, 26 s) | génération + revue | Utile si A montre que le lot A déçoit ; ses 5 dures sont dans la session proposée. |
| E | Figer les critères (C1, C2, A, K) dans `GAME-DESIGN.md` | 1 tâche doc | Après A : la frontière Facile / Moyen de A est encore trop haute pour Joueur 1. |
