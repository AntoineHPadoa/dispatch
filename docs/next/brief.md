# Dispatch v2 — brief

Point de départ : la v1 est en ligne (`https://antoinehpadoa.github.io/dispatch/`). Elle propose 11 grilles (7 tutoriels, 4 notées), une interface web responsive, l'impression A4 et un déploiement automatique à chaque push sur `main`. Lire `CLAUDE.md`, `GAME-DESIGN.md` et `docs/style-reference.html` avant tout.

Ce brief rassemble les décisions prises avec l'humain à la fin de la v1. Les points marqués « à décider » restent ouverts.

## 1. Le labo de grilles (priorité)

Le chantier dont dépend tout le reste : il produit de belles grilles, intéressantes à jouer, avec des mécaniques variées et des niveaux de difficulté justes.

- **Générateur au format §14** : indices `length` et `exchanges`, plusieurs voisins, pièces hautes. Le générateur actuel (`solver/`) reste au format « pose » du prototype.
- **Labo** : une page locale qui montre les grilles candidates avec leurs mesures (techniques nécessaires, nombre d'indices, mécaniques actives). L'humain y joue, note et garde ses préférées. C'est là que passe le temps humain.
- **Calibrage réel** : en jouant dans le labo, on enregistre en local le temps, les erreurs et les annulations. La note de difficulté se recale sur ces mesures, pas sur l'avis du solveur, que les tests humains ont jugé faux (« Expert » perçu comme facile).
- **Diversité imposée** : chaque lot mélange mécaniques et silhouettes.
- **Deux sortes de grilles** : une grille du jour (une par jour) et des grilles fixes, rangées par thème et jouables à tout moment.
- **Dette connue du solveur** : `deduce.py` ignore les totaux d'échanges inconnus, et les modes à score (v1, v2, score cible) sont encore présents. À nettoyer pendant ce chantier.

## 2. Nouvelle forme de centrale : la rampe

- **Retenue** : la rampe (démarrage et arrêt progressifs d'une centrale thermique). C'est la forme la plus réaliste et la plus lisible. Les autres pistes (modulation en U, effacement, batterie) attendent.
- **À décider à l'étude, sur papier, avant le code** :
  - le profil : trapèze symétrique (1 → 2 → 1 GW) ou escalier (2 → 1) ;
  - les degrés de liberté : longueur du plateau, hauteur.
- **Critère d'entrée** : on ne garde la rampe que si les grilles générées font apparaître une vraie déduction nouvelle. Par exemple, ses « épaules » d'une case qui appellent des pièces d'une case ou bloquent un ruban.
- **Coût** : le moteur, le rendu, le solveur exact et le solveur de déduction ne connaissent que des rectangles. Il faut passer à des pièces décrites case par case. À faire en même temps que le générateur.

## 3. Menu : le bulletin du marché

Maquettes : `docs/next/menu-bulletin.html`. La section « Tour 5 » montre les choix retenus ; les tours précédents restent pour mémoire.

- **Concept** : chaque grille est un bulletin publié par le marché. Il porte un numéro, un titre (« Pointe du soir ») et un court texte qui raconte la journée. Le générateur doit produire ce titre, ce texte et la météo par créneau.
- **Fiche du jour C1** (« fiche de quart ») : bande en tête (numéro, jour court, titre, tampon « À servir »), puis le texte de contexte, la silhouette avec la météo et la case qui fixe le prix, une rangée de pastilles neutres pour les centrales, enfin la difficulté et le bouton « Prendre le quart ».
  - Pas de libellés de champs (« Demande », « Interconnexion »…) : le joueur comprend seul.
  - Pas de ciel en dégradé.
- **Bulletins précédents** : numéro et jour court (« n° 213 · mar. »), jamais la date complète. Silhouette, difficulté, tampon « Bouclé ».
- **Grilles fixes** : « dossiers d'entraînement » par thème, avec leur progression. Le tutoriel devient le dossier « Premiers pas ».
- **Palette V1** : encre `#3b3340` pour le texte et le bouton principal, gris chauds pour le reste, et **un seul accent rose** (`#c45c7c`, teintes `#f6dbe5` et `#fbf1f5`) pour le tampon, la case qui fixe le prix, la progression et les éléments bouclés. Sur l'accueil, les couleurs des centrales disparaissent ; elles restent dans la grille de jeu.
- **Logo L1a** : le D en barres de centrales empilées, dans ses couleurs d'origine. C'est la seule touche multicolore de l'accueil. Réserve : en très petit, il se lit comme une pile de barres. À affiner pour que le D se voie.
- **Les pages de grille ne changent pas** : leur sobriété est voulue.

## 4. Tutoriel interactif

- **Modèle** : les petits jeux LinkedIn (Queens, Tango, Zip), qui enseignent en 30 secondes sur une mini-grille guidée.
- **Retenu** :
  - une prise en main de 30 à 60 s (silhouette, carnet, poser, un indice), chaque étape surlignant une case et attendant un geste précis ;
  - chaque technique du §9 enseignée par une micro-grille interactive de 3 ou 4 étapes, proposée quand elle sert dans une vraie grille.
- **Écrit comme des données** : chaque étape décrit ce qu'on surligne, la phrase affichée et le geste attendu. Pas de logique codée par tutoriel.
- **À faire en dernier**, quand les techniques et les grilles sont stables.

## 5. Papier

- **Grille rectangulaire** à la hauteur maximale possible, avec un **trait épais intérieur pour la demande**. Les cases de réserve au-dessus sont en grisé très pâle. Le joueur remonte le trait au crayon quand il exporte ou pompe, et le descend quand il turbine. Cela règle le défaut actuel : le pompage déforme la tête de la grille imprimée.
- La légende des indices en texte existe déjà depuis la v1.
- **À décider** :
  - un livret PDF de plusieurs grilles, avec une page de règles et un exemple résolu (backlog du GAME-DESIGN §12) ;
  - un corrigé en fin de livret (la v1 n'en a pas, par choix).

## 6. Idées en attente

- Au téléphone, une rangée compacte de centrales sous la grille, pour éviter l'aller-retour jusqu'au carnet (relevé par la boucle de finition de la v1).
- Un indice progressif « prochaine déduction », tiré du solveur de déduction (backlog du GAME-DESIGN §12).

## Ordre recommandé

1. **En parallèle** : l'étude de la rampe (sur papier), le menu bulletin, le papier rectangulaire. Ces trois chantiers sont indépendants.
2. **Ensuite** : le générateur au format §14 avec la forme retenue, puis le labo de grilles et le temps de jeu humain.
3. **Enfin** : le tutoriel interactif.

## Façon de travailler retenue en v1

- Valider les visuels avec l'humain sur des maquettes (artifacts) avant tout code d'interface.
- Faire relire chaque livrable par un agent opus distinct de son auteur ; confier les corrections de plus de 3 lignes à un agent neuf.
- Finir chaque itération par une boucle de finition en 3 tours au plus : un vérificateur neuf (liste fixe d'interactions jouée dans un vrai navigateur, captures 1280, 375 et 320 px), puis un correcteur neuf qui vérifie aussi le visuel.
