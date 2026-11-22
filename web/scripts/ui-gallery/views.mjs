/*
 * UI gallery inventory: every view the gallery captures, as data (read by scripts/ui-gallery.mjs).
 * - One entry per view: stable id (W-xx web 1280 px mouse, M-xx mobile 375/320 px touch, P-xx paper),
 *   category, route, grid, width, seeded progress, the actions replayed before the capture, and what it shows.
 * - Grids 901+ are the fictitious gallery grids (scripts/ui-gallery/grids.json); the others are published.
 * - Actions: { t: 'click', sel, label } | { t: 'select', piece } | { t: 'lay', bars } | { t: 'solution', from, to, swap }
 *   | { t: 'hold', from, to } (pointer held mid-drag, finger held by CDP touch events; without `to`: first tap only) | { t: 'export', country, col }
 *   (solution: `to` lays placements [0, to), `skip` leaves out some, `swap` exchanges two plants)
 *   | { t: 'stepTap', col } | { t: 'tool', name } | { t: 'tapCell', row, col } | { t: 'scrollBoard' }.
 *   Rows count from the bottom of the grid (weather cells included), as in grids.json.
 */

/** Progress seeds: grids done with their solution, grids started (n first placements); `clock` starts the view's grid at 12 min 34 s. */
const HOME_PROGRESS = { done: [1, 2, 3, 9, 11], started: { 10: 3 } };
const DOSSIER_PROGRESS = { done: [1, 2, 3], started: { 4: 2 } };
const CLOCK = { clock: true };

/** Views shared by the web and mobile galleries; `only` limits a view to one of them. */
const SCREENS = [
  // Home and dossier
  { n: 1, cat: 'Accueil', route: '#/', shows: 'Accueil au premier passage : fiche du jour (dernier bulletin), quarts précédents, dossier « Premiers pas » à 0 sur 9, lien « Imprimer toutes les grilles ».' },
  { n: 2, cat: 'Accueil', route: '#/', actions: [{ t: 'click', sel: '[data-rules]', label: 'ouvre « Comment jouer »' }], shows: 'Accueil avec les règles du jeu dépliées.' },
  { n: 3, cat: 'Accueil', route: '#/', progress: HOME_PROGRESS, shows: 'Accueil d’un joueur avancé : fiche du jour bouclée (tampon, solution en couleurs, « Revoir le quart »), un quart précédent bouclé, dossier à 3 sur 9.' },
  { n: 4, cat: 'Dossier', route: '#/dossier/premiers-pas', shows: 'Dossier « Premiers pas » neuf : les neuf fiches du tutoriel, la première marquée « à jouer ensuite ».' },
  { n: 5, cat: 'Dossier', route: '#/dossier/premiers-pas', progress: DOSSIER_PROGRESS, shows: 'Dossier en cours : trois fiches terminées, la quatrième en cours et marquée « à jouer ensuite ».' },
  // Tutorial
  { n: 6, cat: 'Tutoriel', grid: 1, shows: 'Premier tutoriel à vide : technique du jour, carnet d’ordres exact (nucléaire, gaz, TAC), aucun indice.' },
  { n: 7, cat: 'Tutoriel', grid: 12, shows: 'Tutoriel de la rampe de charbon à vide : carnet avec les rampes 1 → 2 → 1.' },
  // Rated grid
  { n: 8, cat: 'Grille notée', grid: 11, shows: 'Fiche du jour (Expert) à vide : bulletin en sur-titre, sans inventaire, relevés sur la grille, échanges du jour en liste.' },
  // Clue families
  { n: 9, cat: 'Indices', grid: 902, shows: 'Prix et relevés : quatre prix, trois relevés, un prix et un relevé empilés sur deux créneaux (9h et 15h) ; barrage au stock limité.' },
  { n: 10, cat: 'Indices', grid: 7, shows: 'Flux publiés (exports verrouillés à 0h et 6h), programme, relevé et prix réunis sur un tutoriel, avec la STEP.' },
  { n: 11, cat: 'Indices', grid: 901, shows: 'Programmes (nucléaire, charbon, gaz, dont deux qui se touchent), durées de marche et TAC déjà engagée.' },
  { n: 12, cat: 'Indices', grid: 903, actions: [{ t: 'solution', to: 6 }], shows: 'Trois voisins sous plafond CO₂ : flux import et export, échanges du jour par pays, jauge CO₂ en cours de remplissage.' },
  // Plant families
  { n: 13, cat: 'Centrales', grid: 904, actions: [{ t: 'solution', to: 8 }], shows: 'Les cinq centrales au carnet (nucléaire, charbon et gaz permis en 2 GW de haut) ; quatre sont posées, dont nucléaire et gaz de 2 GW, la TAC ne l’est pas ; au-dessus des renouvelables et du fil de l’eau.' },
  { n: 14, cat: 'Centrales', grid: 13, actions: [{ t: 'solution', skip: [4] }], shows: 'Deux rampes de charbon posées (trapèzes 1 → 2 → 1) qui se relaient, la TAC encore à poser.' },
  { n: 15, cat: 'Centrales', grid: 7, actions: [{ t: 'select', piece: 'STEP' }, { t: 'stepTap', col: 3 }], shows: 'STEP choisie, pompage ▲ choisi à 9h : flèches ▼ sur les créneaux où turbiner, le message attend le turbinage.' },
  { n: 16, cat: 'Centrales', grid: 7, actions: [{ t: 'solution', to: 4 }], shows: 'Paire STEP posée (pompage ▲ à 9h, turbinage ▼ à 12h), exports et imports d’Allemagne posés.' },
  { n: 17, cat: 'Centrales', grid: 905, shows: 'Surplus de renouvelables à 9h (message d’erreur), carnet exact chargé : barres, TAC, import et paire STEP ; l’export de 12h est un flux verrouillé sous la grille.' },
  { n: 18, cat: 'Centrales', grid: 905, actions: [{ t: 'solution', to: 3 }], shows: 'Surplus absorbé par la STEP, export verrouillé, import de Belgique posé.' },
  // Interaction states
  { n: 19, cat: 'Interactions', grid: 1, only: 'W', actions: [{ t: 'select', piece: 'N' }, { t: 'hold', from: { row: 0, col: 0 }, to: { row: 0, col: 5 } }], shows: 'Pose à la souris en cours : nucléaire choisi, aperçu valide de 6 créneaux pendant le glisser (le pointeur n’apparaît pas sur la capture).' },
  { n: 19, cat: 'Interactions', grid: 1, only: 'M', actions: [{ t: 'select', piece: 'N' }, { t: 'hold', from: { row: 0, col: 0 } }], shows: 'Pose en deux touchers : nucléaire choisi, premier toucher posé, le message attend le second.' },
  { n: 20, cat: 'Interactions', grid: 1, actions: [{ t: 'select', piece: 'N' }, { t: 'hold', from: { row: 3, col: 0 }, to: { row: 3, col: 3 } }], shows: 'Aperçu refusé (rouge) : la barre dépasse de la silhouette, le message dit pourquoi.' },
  { n: 21, cat: 'Interactions', grid: 1, actions: [{ t: 'lay', bars: [{ piece: 'G', row: 0, col: 0, len: 2 }] }, { t: 'select', piece: 'N' }, { t: 'hold', from: { row: 0, col: 0 }, to: { row: 0, col: 5 } }], shows: 'Pose par-dessus : l’aperçu du nucléaire remplace le gaz déjà posé (gaz pâli).' },
  { n: 22, cat: 'Interactions', grid: 1, actions: [{ t: 'lay', bars: [{ piece: 'N', row: 3, col: 0, len: 3 }] }], shows: 'Pose refusée : message rouge sous la grille, rien n’est posé.' },
  { n: 23, cat: 'Interactions', grid: 902, actions: [{ t: 'solution', to: 6 }, { t: 'lay', bars: [{ piece: 'T', row: 1, col: 5, len: 1 }] }], shows: 'Indices satisfaits (pastilles vertes) ; la TAC posée à 15h contredit le prix et le relevé de 15h (pastilles rouges, message).' },
  { n: 24, cat: 'Interactions', grid: 1, actions: [{ t: 'solution', to: 3 }, { t: 'tool', name: 'erase' }], shows: 'Gomme active sur une grille à moitié posée.' },
  { n: 25, cat: 'Interactions', grid: 903, actions: [{ t: 'export', country: 'GB', col: 0 }, { t: 'lay', bars: [{ piece: 'T', row: 2, col: 0, len: 1 }] }, { t: 'export', country: 'GB', col: 0 }, { t: 'export', country: 'GB', col: 0 }], shows: 'Centrale invalide hachurée : l’export qui portait la TAC à 0h a été retiré.' },
  // Verdict
  { n: 26, cat: 'Verdict', grid: 7, progress: CLOCK, actions: [{ t: 'solution' }], shows: 'Verdict juste sur un vrai tutoriel : bandeau « Programme bouclé », temps, bouton « Grille suivante ».' },
  { n: 27, cat: 'Verdict', grid: 11, progress: CLOCK, actions: [{ t: 'solution' }], shows: 'Verdict juste sur la fiche du jour (grille notée) : dernière grille notée, le bouton ramène à l’accueil.' },
  { n: 28, cat: 'Verdict', grid: 2, actions: [{ t: 'solution', swap: [2, 3] }], shows: 'Verdict faux : grille pleine mais le prix de 16h est contredit (barrage et TAC échangés).' },
  // Size extremes
  { n: 29, cat: 'Grilles extrêmes', grid: 906, shows: 'Grande grille de 12 créneaux, titre et relevé très longs, onze indices.' },
  { n: 30, cat: 'Grilles extrêmes', grid: 907, shows: 'Grille étroite et haute : six créneaux, pointe à 12 GW.' },
];

const pad = (n) => String(n).padStart(2, '0');

/** Mobile extras: a scrolled wide board and the 320 px witnesses. */
const MOBILE_EXTRA = [
  { id: 'M-31', cat: 'Grilles extrêmes', grid: 906, width: 375, actions: [{ t: 'scrollBoard' }], shows: 'Grande grille défilée vers la droite avec le curseur sous la grille.' },
  { id: 'M-32', cat: 'Témoins 320 px', route: '#/', width: 320, shows: 'Accueil à 320 px.' },
  { id: 'M-33', cat: 'Témoins 320 px', grid: 906, width: 320, shows: 'Grande grille de 12 créneaux à 320 px.' },
  { id: 'M-34', cat: 'Témoins 320 px', grid: 7, width: 320, progress: CLOCK, actions: [{ t: 'solution' }], shows: 'Verdict juste à 320 px.' },
];

function screen(prefix, width) {
  return SCREENS.filter((v) => !v.only || v.only === prefix).map((v) => ({
    ...v, id: `${prefix}-${pad(v.n)}`, width, route: v.route ?? `#/grille/${v.grid}`,
  }));
}

/** Paper sheets: A4 PDF of #/imprimer/<id> rasterised, plus the on-screen print preview. */
const SHEETS = [
  { grid: 1, shows: 'Tutoriel 1 : carnet d’ordres exact, sans indice.' },
  { grid: 7, shows: 'Tutoriel 7 : flux, programme, relevé, prix, cases d’échanges et de STEP à remplir.' },
  { grid: 13, shows: 'Tutoriel des rampes de charbon.' },
  { grid: 8, shows: 'Fiche notée Facile : barrage au stock limité, flux et échanges du jour.' },
  { grid: 11, shows: 'Fiche du jour Expert : sans inventaire, relevés, échanges du jour.' },
  { grid: 901, shows: 'Programmes, durées de marche et centrale engagée.' },
  { grid: 902, shows: 'Prix et relevés empilés sur deux créneaux (9h et 15h).' },
  { grid: 903, shows: 'Trois voisins, flux, échanges par pays et règle du plafond CO₂. Fiche tronquée en bas (imports du Royaume-Uni et d’Espagne et pied de page coupés) : défaut du jeu, montré tel quel.' },
  { grid: 904, shows: 'Les cinq centrales, pièces hautes, renouvelables et fil de l’eau.' },
  { grid: 905, shows: 'Surplus, STEP, export et import imposés par un carnet exact.' },
  { grid: 906, shows: 'Grande grille de 12 créneaux, onze indices. Fiche tronquée en bas (gaz coupé, TAC, import d’Espagne et pied de page absents) : défaut du jeu, montré tel quel.' },
  { grid: 907, shows: 'Grille haute de six créneaux.' },
];

export const VIEWS = {
  web: screen('W', 1280),
  mobile: [...screen('M', 375), ...MOBILE_EXTRA.map((v) => ({ ...v, route: v.route ?? `#/grille/${v.grid}` }))],
  papier: [
    { id: 'P-01', cat: 'Aperçu d’impression', grid: 7, route: '#/imprimer/7', width: 1280, shows: 'Aperçu d’impression à l’écran (1280 px) : barre de retour et bouton Imprimer au-dessus de la fiche.' },
    { id: 'P-02', cat: 'Aperçu d’impression', grid: 7, route: '#/imprimer/7', width: 375, shows: 'Aperçu d’impression sur téléphone (375 px).' },
    ...SHEETS.map((s, i) => ({ ...s, id: `P-${pad(i + 3)}`, cat: 'Fiches A4', route: `#/imprimer/${s.grid}`, width: 'A4', paper: true })),
  ],
};

/** Plain French text of an action list, for the inventory table and the pages. */
export function describeActions(view) {
  const out = [];
  if (view.progress?.done?.length) out.push(`progression : grilles ${view.progress.done.join(', ')} terminées`);
  if (view.progress?.started) out.push(`grilles ${Object.keys(view.progress.started).join(', ')} commencées`);
  if (view.progress?.clock) out.push('chrono amorcé à 12 min 34 s');
  for (const a of view.actions ?? []) {
    if (a.t === 'click') out.push(a.label);
    else if (a.t === 'select') out.push(`choisit ${a.piece}`);
    else if (a.t === 'lay') out.push(`pose ${a.bars.map((b) => `${b.piece} ligne ${b.row} col. ${b.col} ×${b.len}`).join(', ')}`);
    else if (a.t === 'solution' && a.skip) out.push(`pose la solution sauf les poses ${a.skip.join(', ')}`);
    else if (a.t === 'solution') out.push(a.swap ? `pose la solution en échangeant les poses ${a.swap.join(' et ')}` : a.to ? `pose les ${a.to} premières pièces de la solution (avec ses échanges et sa STEP)` : 'pose toute la solution');
    else if (a.t === 'hold') out.push(a.to ? `maintient un glisser de (${a.from.row}, ${a.from.col}) à (${a.to.row}, ${a.to.col})` : `touche la case (${a.from.row}, ${a.from.col})`);
    else if (a.t === 'export') out.push(`touche l’export ${a.country} col. ${a.col}`);
    else if (a.t === 'stepTap') out.push(`touche ▲ col. ${a.col}`);
    else if (a.t === 'tool') out.push(`outil ${a.name}`);
    else if (a.t === 'tapCell') out.push(`touche (${a.row}, ${a.col})`);
    else if (a.t === 'scrollBoard') out.push('fait défiler la grille à droite');
  }
  return out.join(' ; ') || '—';
}
