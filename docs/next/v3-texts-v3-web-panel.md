# Textes à valider — branche v3-web-panel (S6.2)

**Réponse (q230)** : lignes de lore validées ; tutoriels 8 et 9 réécrits sans parler de la forme du charbon (« démarre progressivement »). Publication CO₂ : version A (recommandée, sans objection).

Textes joueur introduits par R9 (ligne de lore des tutoriels) et R16 (publication CO₂). Ils iront dans `web/src/i18n/fr.ts` après validation. Le vocabulaire banni par R6 (« rampe », « épaules », « inventaire ») est évité.

## R9 — Ligne de lore à la place de « Technique du jour »

L'encart violet (titre « Technique du jour », nom de la technique, consigne) disparaît des tutoriels. Une ligne courte en italique le remplace sous le titre. Les grilles notées gardent leur encart « Consigne ».

| Tutoriel | Actuel (encart) | Proposé (ligne de lore) |
|---|---|---|
| 1 · Poser l'inventaire | Technique du jour · Cases interchangeables · « Pose toutes les centrales de l'inventaire, ni plus ni moins… » | Premier quart au centre de dispatching : le carnet d'ordres est arrivé, à toi de caser chaque centrale sous la courbe. |
| 2 · Le prix plafonne la colonne | Technique du jour · « Nouveau : un prix publié par la bourse… » | La bourse vient de publier ses prix : sur ces créneaux, aucune centrale plus chère ne tournera. |
| 3 · Inventaire juste | Technique du jour · « Nouveau : la ligne vers l'Allemagne… » | La ligne vers l'Allemagne est ouverte : ce qui manque arrive par le câble, ce qui déborde repart. |
| 4 · Le creux coupe le ruban | Technique du jour · « Chaque ligne se découpe en rubans… » | Un réacteur n'aime pas s'arrêter : chaque creux de la demande lui barre la route. |
| 5 · Flux publié et compter la colonne | Technique du jour · « Nouveau : un flux publié… » | Le gestionnaire du réseau a annoncé ses échanges avec l'Allemagne : ces créneaux sont réservés. |
| 6 · La case la plus chère | Technique du jour · « Un prix publié exige au moins une case… » | Quand la bourse affiche un prix, la centrale qui le fixe tourne forcément dans le créneau. |
| 7 · Pompage, relevé et programme | Technique du jour · « Nouveau : une STEP (pompage ▲ puis turbinage ▼)… » | La STEP de montagne remonte son eau quand le courant abonde et la relâche quand la demande grimpe. |
| 8 · La rampe de charbon | Technique du jour · « Nouveau : le charbon démarre et s'arrête par paliers… » | La vieille centrale à charbon est lente à se réveiller : elle démarre progressivement et s'éteint de même. |
| 9 · Deux épaules se relaient | Technique du jour · « Deux rampes de charbon cette fois… » | Deux centrales à charbon se passent le relais : l'une s'éteint doucement pendant que l'autre démarre. |

## R16 — Publication CO₂

Générée depuis `co2_cap` et les points par case des centrales et des voisins (format §14 inchangé). Elle s'affiche en tête des « Publications du marché », comme les échanges du jour, et compte dans « n sur N vérifiés » : vérifiée quand la grille est remplie sous la limite, contredite dès que la limite est dépassée. Elle porte aussi les points CO₂ par case, retirés des petits textes du carnet (R10).

Exemple sur la grille de galerie 903 (limite 28 ; charbon 3, gaz 1, TAC 2, imports Allemagne 3, Royaume-Uni 1, Espagne 0).

| Élément | Actuel | Proposé A (recommandé) | Proposé B |
|---|---|---|---|
| Sur-titre | — | Limite CO₂ | Plafond CO₂ |
| Texte | — (seule la jauge, avec « plafond » en haut à droite) | Aujourd'hui : 28 points de CO₂ au plus. Par case : charbon 3, TAC 2, gaz 1, import d'Allemagne 3, import du Royaume-Uni 1. | Le régulateur fixe la limite du jour à 28 points de CO₂ (par case : charbon 3, TAC 2, gaz 1, import d'Allemagne 3, import du Royaume-Uni 1). |
| Jauge, en haut à droite | plafond | (rien) | (rien) |

Les centrales et voisins à 0 point ne sont pas cités.

## Pour information (pas de validation demandée)

| Élément | Actuel | Nouveau |
|---|---|---|
| Compteur d'une centrale sans quantité | 0 case posée | 0 / ∞ |
| Compteur de la STEP sans nombre publié | 0 paire posée | 0 / ∞ |
| En-tête du carnet d'ordres | touche une centrale pour la choisir | (rien) |
| Nom d'une ligne d'import | Import (+ « Allemagne, 1 case » dessous) | Import d'Allemagne |
| Étiquettes STEP sur la grille | ▲ pompe, ▼ turbine | ▲, ▼ |
