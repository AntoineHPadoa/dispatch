/*
 * Every French text shown to the player: piece and country names, clue texts, rule violations,
 * inventory status. The engine and the UI import from here; no player text lives elsewhere.
 */
import { IMPORT_PIECE, type Clue, type Grid, type PieceId } from '../model/grid';
import { isRamp, shapeKind, type ShapeKind } from '../model/shapes';

interface PieceWords {
  /** Palette label. */
  name: string;
  /** "le gaz" (sets the price). */
  the: string;
  /** "une centrale à gaz" (a running plant). */
  a: string;
  /** "de gaz" (cells of). */
  of: string;
}

export const PIECE_WORDS: Record<PieceId, PieceWords> = {
  N: { name: 'Nucléaire', the: 'le nucléaire', a: 'un réacteur', of: 'de nucléaire' },
  B: { name: 'Barrage', the: 'le barrage', a: 'un barrage', of: 'de barrage' },
  C: { name: 'Charbon', the: 'le charbon', a: 'une centrale à charbon', of: 'de charbon' },
  G: { name: 'Gaz', the: 'le gaz', a: 'une centrale à gaz', of: 'de gaz' },
  T: { name: 'TAC', the: 'la TAC', a: 'une TAC', of: 'de TAC' },
};

/** Stands for the country in exchange messages when totals cover all countries. */
export const ALL_COUNTRIES = 'tous pays confondus';

/** French typography for free text (bulletins): no break between a number and its unit, thin no-break space before « : ». */
export function frenchSpaces(text: string): string {
  return text
    .replace(/(\d) (?=(GW|h|min|s|cases?|créneaux?|blocs?|paires?)\b)/g, '$1\u00a0')
    .replace(/ ([:;!?])/g, '\u202f$1');
}

interface CountryWords { to: string; from: string }

/** Prepositions per country id; unknown ids fall back to the neighbor name. */
const COUNTRY_WORDS: Record<string, CountryWords> = {
  DE: { to: "vers l’Allemagne", from: "d’Allemagne" },
  UK: { to: 'vers le Royaume-Uni', from: 'du Royaume-Uni' },
  GB: { to: 'vers le Royaume-Uni', from: 'du Royaume-Uni' },
  ES: { to: "vers l’Espagne", from: "d’Espagne" },
  IT: { to: "vers l’Italie", from: "d’Italie" },
  BE: { to: 'vers la Belgique', from: 'de Belgique' },
  CH: { to: 'vers la Suisse', from: 'de Suisse' },
};

function countryWords(grid: Grid, id: string): CountryWords {
  const known = COUNTRY_WORDS[id];
  if (known) return known;
  const name = grid.neighbors.find((nb) => nb.id === id)?.name ?? id;
  return { to: `vers ${name}`, from: `de ${name}` };
}

export const countryTo = (grid: Grid, id: string) => countryWords(grid, id).to;
export const countryFrom = (grid: Grid, id: string) => countryWords(grid, id).from;

const plural = (k: number, one: string, many: string = `${one}s`) => `${k} ${k > 1 ? many : one}`;

/** Label of column `col`, or the end of the day when `col` is past the last column. */
export function columnLabel(grid: Grid, col: number): string {
  const label = grid.columns[col];
  if (label !== undefined) return label;
  return `${Math.round((col * 24) / grid.columns.length)}h`;
}

/** "case de gaz", "case importée d’Allemagne" (key = piece id or I:<country>). */
function cellsOf(grid: Grid, key: string, k: number): string {
  if (key.startsWith('I:')) {
    return k ? `${plural(k, 'case importée', 'cases importées')} ${countryFrom(grid, key.slice(2))}`
      : `aucune case importée ${countryFrom(grid, key.slice(2))}`;
  }
  const of = PIECE_WORDS[key as PieceId]?.of ?? `de ${key}`;
  return k ? `${plural(k, 'case')} ${of}` : `aucune case ${of}`;
}

/** French text of a clue, as the market document it stands for (§7). */
export function clueText(grid: Grid, clue: Clue): string {
  const at = (c: number) => columnLabel(grid, c);
  switch (clue.type) {
    case 'price':
      return `À ${at(clue.col)}, c’est ${PIECE_WORDS[clue.piece].the} qui fixe le prix.`;
    case 'bar':
      return `${capitalize(PIECE_WORDS[clue.piece].a)} tourne de ${at(clue.col)} à ${at(clue.col + clue.len)}.`;
    case 'length':
      return `${capitalize(PIECE_WORDS[clue.piece].a)} tourne ${plural(clue.len, 'créneau', 'créneaux')} d’affilée.`;
    case 'column':
      return `Relevé de ${at(clue.col)} : ${Object.entries(clue.counts).map(([k, v]) => cellsOf(grid, k, v)).join(', ')}.`;
    case 'flow': {
      const k = clue.value;
      if (clue.dir === 'export') {
        const to = countryTo(grid, clue.country);
        return k ? `À ${at(clue.col)}, ${plural(k, 'bloc part', 'blocs partent')} ${to}.`
          : `À ${at(clue.col)}, aucun bloc ne part ${to}.`;
      }
      const from = countryFrom(grid, clue.country);
      return k ? `À ${at(clue.col)}, ${plural(k, 'bloc arrive', 'blocs arrivent')} ${from}.`
        : `À ${at(clue.col)}, aucun bloc n’arrive ${from}.`;
    }
    case 'exchanges': {
      const multi = grid.neighbors.length > 1;
      const parts: string[] = [];
      for (const [id, k] of Object.entries(clue.exports ?? {})) {
        const where = multi ? ` ${countryTo(grid, id)}` : '';
        parts.push(k ? `${plural(k, 'bloc exporté', 'blocs exportés')}${where}` : `aucun bloc exporté${where}`);
      }
      for (const [id, k] of Object.entries(clue.imports ?? {})) {
        const where = multi && id !== '*' ? ` ${countryFrom(grid, id)}` : '';
        parts.push(k ? `${plural(k, 'bloc importé', 'blocs importés')}${where}` : `aucun bloc importé${where}`);
      }
      if (clue.step !== undefined) parts.push(clue.step ? plural(clue.step, 'pompage') : 'aucun pompage');
      return `Aujourd’hui : ${parts.join(', ')}.`;
    }
    case 'engaged':
      return `Déjà engagé : ${PIECE_WORDS[clue.piece].a} de ${at(clue.col)} à ${at(clue.col + clue.len)}, `
        + `${isRamp(shapeKind(grid.pieces[clue.piece])) ? 'base ' : ''}ligne ${clue.row + 1}.`;
  }
}

/** Short text of a clue drawn on the grid, for the paper legend: "8h : la TAC fixe le prix", "16h : 1 gaz, 3 TAC". */
export function slotClueShort(grid: Grid, clue: Clue): string {
  const at = (c: number) => columnLabel(grid, c);
  const named = (key: string, k: number) => (key.startsWith('I:')
    ? `${plural(k, 'import')} ${countryFrom(grid, key.slice(2))}`
    : `${k} ${PIECE_WORDS[key as PieceId]?.name.toLowerCase() ?? key}`);
  switch (clue.type) {
    case 'price':
      return `${at(clue.col)} : ${PIECE_WORDS[clue.piece].the} fixe le prix`;
    case 'column':
      return `${at(clue.col)} : ${Object.entries(clue.counts).map(([k, v]) => named(k, v)).join(', ')}`;
    case 'bar':
      return `${at(clue.col)} → ${at(clue.col + clue.len)} : ${PIECE_WORDS[clue.piece].a} tourne`;
    case 'flow':
      return clue.dir === 'export'
        ? `${at(clue.col)} : ${clue.value ? plural(clue.value, 'bloc exporté', 'blocs exportés') : 'aucun export'} ${countryTo(grid, clue.country)}`
        : `${at(clue.col)} : ${clue.value ? plural(clue.value, 'bloc importé', 'blocs importés') : 'aucun import'} ${countryFrom(grid, clue.country)}`;
    default:
      return clueText(grid, clue);
  }
}

function capitalize(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

function lenText(lens: number[]): string {
  const min = lens[0] ?? 1;
  const max = lens[lens.length - 1] ?? min;
  if (lens.length === 1) return plural(min, 'créneau', 'créneaux');
  const contiguous = lens.every((l, i) => i === 0 || l === (lens[i - 1] ?? 0) + 1);
  return contiguous ? `${min} à ${max} créneaux` : `${lens.join(', ')} créneaux`;
}

/** Rule violations, one function per reason. */
export const MSG = {
  bounds: (ramp = false) => `La ${ramp ? 'rampe' : 'barre'} dépasse de la grille.`,
  length: (name: string, lens: number[]) => `La barre ${name} doit faire ${lenText(lens)}.`,
  rampLength: (lens: number[]) => `Une rampe de charbon fait ${lenText(lens)}.`,
  height: (name: string, heights: number[]) => `La barre ${name} doit faire ${heights.join(' ou ')} GW de haut.`,
  silhouette: (col: string) => `Hors de la silhouette à ${col}.`,
  weather: (col: string) => `La météo occupe déjà cette case à ${col}.`,
  overlap: () => 'Case déjà occupée.',
  unavailable: (of: string) => `Pas de centrale ${of} dans cette grille.`,
  unknownCountry: () => 'Ce pays n’est pas relié à la grille.',
  inventoryBar: (name: string, len: number, ramp = false) => `Plus de ${ramp ? 'rampe' : 'barre'} ${name} de ${plural(len, 'créneau', 'créneaux')} dans l’inventaire.`,
  inventoryCells: (name: string, total: number) => `Plus de case ${name} dans l’inventaire (${total} au total).`,
  stock: (piece: string, of: string, total: number) => (piece === 'B'
    ? `Plus d’eau dans le barrage (${plural(total, 'case')} au plus).`
    : `Plus de stock ${of} (${plural(total, 'case')} au plus).`),
  inventoryImports: (from: string, total: number) => `Plus d’import ${from} dans l’inventaire (${total} au total).`,
  inventoryImportsAll: (total: number) => `Plus d’import dans l’inventaire (${total} au total, tous pays).`,
  inventoryExports: (to: string, total: number) => `Plus d’export ${to} dans l’inventaire (${total} au total).`,
  line: (to: string, col: string) => `Ligne ${to} saturée à ${col}.`,
  exportRange: (col: string) => `Export impossible à ${col}.`,
  surplus: (col: string) => `Surplus non absorbé à ${col} : il faut exporter ou pomper.`,
  stepNone: () => 'Cette grille n’a pas de STEP.',
  stepReversed: () => 'STEP inversée : le pompage doit précéder le turbinage.',
  stepCount: (total: number) => `Toutes les paires STEP sont déjà posées (${total}).`,
  co2: (got: number, cap: number) => `Plafond CO₂ dépassé : ${got} / ${cap}.`,
  locked: () => 'Cette centrale est déjà engagée : on ne peut pas la retirer.',
  lockedOver: () => 'Une centrale déjà engagée occupe cette place : on ne peut pas la remplacer.',
  nothingHere: () => 'Aucune centrale sur cette case.',
  tooManyBars: (name: string, extra: number[]) => `Barres ${name} en trop : ${extra.join(', ')}.`,
  tooManyCells: (name: string, got: number, want: number) => `Trop de cases ${name} : ${got} pour ${want}.`,
  tooManyExports: (to: string, got: number, want: number) => `Trop d’exports ${to} : ${got} pour ${want}.`,
  tooManyImports: (from: string, got: number, want: number) => `Trop d’imports ${from} : ${got} pour ${want}.`,
  tooManySteps: (got: number, want: number) => `Trop de paires STEP : ${got} pour ${want}.`,
};

/** Reasons why a grid is not finished yet. */
export const TODO = {
  missing: (k: number) => `Il reste ${plural(k, 'case')} à couvrir.`,
  bars: (name: string, left: number[]) => `Il reste à poser des barres ${name} : ${left.join(', ')}.`,
  cells: (name: string, left: number) => `Il reste ${plural(left, 'case')} ${name} à poser.`,
  exports: (to: string, left: number) => `Il reste ${plural(left, 'bloc')} à exporter ${to}.`,
  imports: (from: string, left: number) => `Il reste ${plural(left, 'case')} à importer ${from}.`,
  steps: (left: number) => `Il reste ${plural(left, 'paire')} STEP à poser.`,
  clue: (text: string) => `Indice non respecté : ${text}`,
  otherSolution: () => 'Pose valide, mais ce n’est pas la solution attendue.',
};

/** "de nucléaire", "d’import d’Allemagne": complement used by inventory messages. */
export function ofPiece(grid: Grid, piece: string, country?: string): string {
  if (piece === IMPORT_PIECE) return country ? `d’import ${countryFrom(grid, country)}` : 'd’import';
  return PIECE_WORDS[piece as PieceId]?.of ?? `de ${piece}`;
}

/** Inventory status labels for the UI. */
export const INVENTORY = {
  free: 'Disponible',
  done: 'Tout posé',
  left: (what: string) => `Reste : ${what}`,
  over: (what: string) => `En trop : ${what}`,
  stock: (used: number, max: number) => `${used} / ${max}`,
};

// ---- interface (home, game screen, print sheet) ------------------------------

/** Deduction techniques (GAME-DESIGN.md §9): name and sentence for the player, by solver id. */
export const TECHNIQUES: Record<string, { name: string; text: string }> = {
  room: { name: 'Pas de place', text: 'Une barre ne peut ni dépasser de la silhouette ni chevaucher une barre déjà posée.' },
  exhausted: { name: 'Inventaire épuisé', text: 'Quand toutes les cases d’une pièce sont trouvées, elle ne va nulle part ailleurs ; une barre plus longue que ce qu’il reste ne passe plus.' },
  price_cap: { name: 'Le prix plafonne la colonne', text: 'Sous un prix publié, aucune case n’est plus chère que ce prix.' },
  record: { name: 'Le relevé compte les cases', text: 'Un relevé atteint interdit d’autres cases de cette pièce ; s’il reste juste assez de cases possibles, elles y passent toutes. Les échanges du jour se comptent de même.' },
  flow: { name: 'Flux publié', text: 'Un flux publié fixe l’export ou l’import d’un créneau avec un pays.' },
  single_cover: { name: 'Une seule barre pour cette case', text: 'Une case qu’une seule barre peut encore couvrir reçoit cette barre.' },
  single_spot: { name: 'La barre qui ne tient qu’à un endroit', text: 'Une barre de l’inventaire qui n’a plus qu’une place possible y va.' },
  program: { name: 'Programme publié', text: 'La barre annoncée par un programme va sur la seule ligne où elle tient.' },
  length: { name: 'Durée de marche', text: 'La barre dont on connaît la durée de marche va à la seule place où cette durée tient.' },
  silhouette: { name: 'La silhouette suit les barres', text: 'Un export ou un pompage qui laisserait une case impossible à couvrir est exclu.' },
  swap: { name: 'Cases interchangeables', text: 'Quand on connaît le nombre de cases de chaque pièce dans une colonne, l’ordre ne compte pas.' },
  top_price: { name: 'La case la plus chère', text: 'Un prix publié exige au moins une case de cette centrale dans la colonne : s’il n’y a qu’une place possible, c’est elle.' },
  ribbon: { name: 'Le creux coupe le ruban', text: 'Chaque ligne se découpe en rubans entre les creux : une barre qui laisserait un bout impossible à remplir est exclue.' },
  just_enough: { name: 'Inventaire juste', text: 'S’il reste exactement autant de cases possibles que de cases à poser pour une pièce, toutes sont à elle.' },
  column_sum: { name: 'Compter la colonne', text: 'Une colonne a autant de cases que sa hauteur : connaissant les autres pièces, on déduit celle qui reste.' },
  carbon: { name: 'Plafond carbone', text: 'Une barre qui ferait dépasser le plafond CO₂ est exclue.' },
  ramp_plateau: { name: 'Le plateau barre la ligne du dessus', text: 'Au-dessus de sa base, la rampe occupe aussi la ligne suivante sur tout son plateau : aucun ruban de cette ligne ne la traverse.' },
  ramp_shoulder: { name: 'L’épaule appelle une case', text: 'La case au-dessus d’une épaule est fermée côté plateau : seule une pièce d’une case, ou une barre qui s’arrête pile là, peut la couvrir.' },
  ramp_lone: { name: 'Une case seule est une épaule', text: 'Une seule case de rampe dans une colonne, c’est une épaule : la rampe continue à deux cases d’un côté et s’arrête de l’autre.' },
  ramp_relay: { name: 'Deux épaules se relaient', text: 'Deux cases de rampe sans plateau autour : une rampe s’arrête et une autre démarre sur son épaule.' },
  share_out: { name: 'Répartition de l’inventaire', text: 'Les barres doivent toutes trouver une ligne : un découpage qui empêche les autres de se placer est exclu.' },
  refuted: { name: 'Hypothèse réfutée', text: 'Si un choix mène à une impasse par les règles simples, il est exclu (une seule hypothèse, jamais imbriquée).' },
};

/** One lore line per tutorial (by grid id), shown under the title instead of an instructions card. */
export const TUTORIAL_LORE: Record<number, string> = {
  1: 'Premier quart au centre de dispatching : le carnet d’ordres est arrivé, à toi de caser chaque centrale sous la courbe.',
  2: 'La bourse vient de publier ses prix : sur ces créneaux, aucune centrale plus chère ne tournera.',
  3: 'La ligne vers l’Allemagne est ouverte : ce qui manque arrive par le câble, ce qui déborde repart.',
  4: 'Un réacteur n’aime pas s’arrêter : chaque creux de la demande lui barre la route.',
  5: 'Le gestionnaire du réseau a annoncé ses échanges avec l’Allemagne : ces créneaux sont réservés.',
  6: 'Quand la bourse affiche un prix, la centrale qui le fixe tourne forcément dans le créneau.',
  7: 'La STEP de montagne remonte son eau quand le courant abonde et la relâche quand la demande grimpe.',
  12: 'La vieille centrale à charbon est lente à se réveiller : elle démarre progressivement et s’éteint de même.',
  13: 'Deux centrales à charbon se passent le relais : l’une s’éteint doucement pendant que l’autre démarre.',
};

/** Name of the `given` trace step (an engaged plant), not a technique the player learns. */
export const GIVEN_STEP = 'Centrale engagée';

/** Clue kinds, as labels above each clue text. */
export const CLUE_KIND: Record<Clue['type'], string> = {
  price: 'Prix',
  bar: 'Programme',
  length: 'Durée de marche',
  column: 'Relevé',
  flow: 'Flux',
  exchanges: 'Échanges du jour',
  engaged: 'Déjà engagée',
};

/** Short plant names for the programme brackets and price tags drawn on the grid. */
export const SHORT_NAME: Record<PieceId, string> = { N: 'Réacteur', B: 'Barrage', C: 'Charbon', G: 'Gaz', T: 'TAC' };

/** Price tag on the grid: "€ Gaz", "€ Nucl.". */
export const priceTag = (piece: PieceId) => {
  const name = PIECE_WORDS[piece].name;
  return `€ ${name.length > 6 ? `${name.slice(0, 4)}.` : name}`;
};

/** Price tag on paper, short to save room: "€ N", "€ G". */
export const priceTagShort = (piece: PieceId) => `€ ${piece}`;

/** Programme bracket label: "Réacteur 4h → 20h". */
export const programLabel = (grid: Grid, piece: PieceId, col: number, len: number) =>
  `${SHORT_NAME[piece]} ${columnLabel(grid, col)} → ${columnLabel(grid, col + len)}`;

/** Shape hint under a plant name in the order book: "ruban de 3 à 6 créneaux", "1 case, pointe", "stock : 2 cases". */
export function pieceHint(piece: PieceId, lens: number[], heights: number[], maxCells?: number, shape: ShapeKind = 'rect'): string {
  if (maxCells !== undefined) return `stock : ${plural(maxCells, 'case')}`;
  if (shape !== 'rect') return `rampe de ${lenText(lens)}`;
  const minL = lens[0] ?? 1;
  const maxL = lens[lens.length - 1] ?? minL;
  const minH = heights[0] ?? 1;
  let text: string;
  if (maxL === 1 && heights.length === 1 && minH === 1) text = piece === 'T' ? '1 case, pointe' : '1 case';
  else if (minL === maxL) text = plural(minL, 'créneau', 'créneaux');
  else if (piece === 'N') text = `ruban de ${minL} à ${maxL} créneaux`;
  else text = lens.length === maxL - minL + 1 ? `${minL} à ${maxL} créneaux` : `${lens.join(', ')} créneaux`;
  if (heights.length > 1) text += `, ${heights.join(' ou ')} GW`;
  else if (minH > 1) text += `, ${minH} GW minimum`;
  return text;
}

/** "TAC à 8h, ligne 6", "Gaz de 4h à 12h, ligne 2" (rows count from 1 at the bottom of the grid, weather cells included: they are imposed plants). */
export function placementLabel(grid: Grid, piece: string, country: string | undefined, row: number, col: number,
  len: number, height = 1, shape: ShapeKind = 'rect'): string {
  const name = piece === IMPORT_PIECE ? `Import ${countryFrom(grid, country ?? '')}` : PIECE_WORDS[piece as PieceId]?.name ?? piece;
  const when = len === 1 ? `à ${columnLabel(grid, col)}` : `de ${columnLabel(grid, col)} à ${columnLabel(grid, col + len)}`;
  if (shape !== 'rect') return `${name} en rampe ${when}, base ligne ${row + 1}`;
  const where = height > 1 ? `lignes ${row + 1} à ${row + height}` : `ligne ${row + 1}`;
  return `${name} ${when}, ${where}`;
}

/** "4 min 12 s". */
export function durationText(ms: number): string {
  const s = Math.max(0, Math.round(ms / 1000));
  const m = Math.floor(s / 60);
  // Non-breaking spaces: the duration never wraps inside a sentence.
  if (m >= 60) return `${Math.floor(m / 60)}\u00a0h\u00a0${m % 60}\u00a0min`;
  return m ? `${m}\u00a0min\u00a0${s % 60}\u00a0s` : `${s}\u00a0s`;
}

export const UI = {
  appName: 'Dispatch',
  tagline: 'Tu construis le programme d’appel du réseau électrique pour une journée : remplis exactement la courbe de demande avec des centrales, en respectant les indices du marché. On déduit, on ne calcule rien.',
  rulesTitle: 'Règle du jeu',
  rules: [
    'Une case vaut 1 créneau en largeur et 1 GW en hauteur. Couvre chaque case de la silhouette exactement une fois.',
    'Une centrale a une forme fixe : sa largeur est sa durée de marche, sa hauteur sa puissance. Le charbon peut démarrer en rampe.',
    'Respecte le carnet d’ordres et les indices du marché. Une seule solution.',
  ],
  bulletin: {
    howTo: 'Comment jouer',
    sheetTag: (n: number, day: string) => `n° ${n} · ${day}`,
    stampTodo: 'À servir',
    stampDone: 'Bouclé',
    take: 'Prendre le quart',
    resumeShift: 'Reprendre le quart',
    reviewShift: 'Revoir le quart',
    previous: 'Quarts précédents',
    dossiers: 'Dossiers d’entraînement',
    difficulty: (label: string) => `Difficulté : ${label}`,
    weekdayShort: ['dim.', 'lun.', 'mar.', 'mer.', 'jeu.', 'ven.', 'sam.'],
    weather: { sun: 'Soleil', moon: 'Nuit', cloud: 'Nuageux', wind: 'Vent' } as const,
    logoLabel: 'Logo Dispatch',
    silhouetteLabel: (min: number, max: number, slots: number) => `Demande de ${min} à ${max} GW sur ${slots} créneaux`,
    firstOn: (date: string) => `Premier bulletin le ${date}`,
    months: ['janvier', 'février', 'mars', 'avril', 'mai', 'juin', 'juillet', 'août', 'septembre', 'octobre', 'novembre', 'décembre'],
  },
  dossier: {
    'premiers-pas': { title: 'Premiers pas', lead: 'Des grilles guidées, une technique chacune, avec l’inventaire exact.' },
  } as Record<string, { title: string; lead: string }>,
  dossierCount: (k: number) => `${k} ${k > 1 ? 'grilles' : 'grille'}`,
  dossierProgress: (done: number, total: number) => `${done} / ${total}`,
  dossierDone: (done: number, total: number) => `${done} / ${total} ${total > 1 ? 'terminées' : 'terminée'}`,
  dossierNext: 'à jouer ensuite',
  status: { new: 'Pas commencée', started: 'En cours', done: 'Terminée' } as const,
  play: 'Jouer',
  resume: 'Reprendre',
  review: 'Revoir',
  back: 'Accueil',
  tutorialOf: (k: number, n: number) => `Tutoriel ${k} sur ${n}`,
  tutorialShort: (k: number) => `Tutoriel ${k}`,
  ratedEyebrow: 'Grille notée',
  noInventory: 'sans inventaire',
  gridNumber: (id: number) => `Grille n° ${id}`,
  instructions: 'Consigne',
  book: 'Carnet d’ordres',
  available: 'Centrales disponibles',
  availableHint: 'formes autorisées, quantités à déduire',
  importName: 'Import',
  importOf: (from: string) => `Import ${from}`,
  importHint: (country: string) => `${country}, 1\u00a0case`,
  /** Book counter: laid / allowed, ∞ when the quantity is free. */
  count: (k: number, max: number | null) => `${k} / ${max ?? '∞'}`,
  /** Name of the card listing every publication of the day (a single name, whatever the grid). */
  cluesTitle: 'Publications du marché',
  cluesChecked: (k: number, n: number) => `${k} sur ${n} ${k > 1 ? 'vérifiés' : 'vérifié'}`,
  clueState: { ok: 'vérifié', open: 'à vérifier', broken: 'contredit' } as const,
  chipsLabel: 'Centrales',
  tools: { erase: 'Gomme', undo: 'Annuler', reset: 'Recommencer', print: 'Imprimer' },
  toolsLabel: 'Outils',
  co2: 'CO₂',
  co2Points: (k: number, cap: number) => `${k} ${k > 1 ? 'points' : 'point'} sur ${cap}`,
  co2Left: (k: number) => (k >= 0 ? `${k} ${k > 1 ? 'restants' : 'restant'}` : `${-k} de trop`),
  co2PerCell: (k: number) => `CO₂ ${k} par case`,
  co2Detail: (parts: string[]) => parts.join(' · '),
  co2Rule: (cap: number, per: string) => `${cap} points au plus ; points par case : ${per}.`,
  co2Kind: 'Plafond CO₂',
  /** CO2 publication generated from `co2_cap`, listed with the market publications. */
  co2ClueKind: 'Limite CO₂',
  co2Clue: (cap: number, per: string) => `Aujourd’hui : ${cap} points de CO₂ au plus.${per ? ` Par case : ${per}.` : ''}`,
  neighborLine: (name: string, cap: number) => `${name} · ${cap} ${cap > 1 ? 'blocs' : 'bloc'} par créneau`,
  stepLine: 'STEP · pompage ▲ puis turbinage ▼',
  stepLineNumbered: 'STEP · pompage ▲ puis turbinage ▼ · numérote les paires : ▲1 ▼1, ▲2 ▼2…',
  stepName: 'STEP',
  stepTagLabel: (pump: string, turbine: string) => `Paire STEP : pompage à ${pump}, turbinage à ${turbine}. Touche pour la retirer.`,
  hintStep: 'STEP : touche ▲ au-dessus du créneau où l’on pompe. Touche une étiquette ▲ ou ▼ posée pour retirer la paire.',
  stepArrowPump: (col: string) => `Pomper à ${col}`,
  stepArrowChosen: (col: string) => `Pompage à ${col} choisi. Touche pour l’annuler.`,
  stepArrowTurbine: (col: string) => `Turbiner à ${col}`,
  stepTooEarly: (pump: string) => `Le turbinage vient après le pompage de ${pump} : touche un créneau plus tard.`,
  exportLabel: (name: string, col: string, value: number, imports: number) =>
    `${name}, ${col} : ${value} exporté${value > 1 ? 's' : ''}${imports ? `, ${imports} importé${imports > 1 ? 's' : ''}` : ''}. Touche pour changer l’export.`,
  exportLocked: (name: string, col: string) => `${name}, ${col} : flux publié, verrouillé.`,
  lockedTap: (col: string) => `Flux publié à ${col} : verrouillé.`,
  /** Idle hint: `list` when the grid has no order book, `exports` when it has a neighbor line. */
  hintChoose: (list: boolean, exports: boolean, phone = false) => 'Glisse sur la grille pour poser la centrale choisie'
    + ` (ou touche la case de départ puis celle d’arrivée). Change de centrale dans ${phone ? 'la barre sous la grille' : list ? 'la liste' : 'le carnet'}.`
    + `${exports ? ' Exporte en touchant une case de la rangée du voisin, sous la grille.' : ''}`,
  hintSecondTap: (label: string) => `${label} : touche maintenant la case d’arrivée.`,
  hintErase: 'Gomme : touche une centrale pour la retirer.',
  poseOk: (label: string) => `${label} : la pose tient.`,
  /** "Remplace 1 barre de gaz et 2 imports d’Allemagne", "1 rampe de charbon" (bars covered by a new placement). */
  replaces: (grid: Grid, bars: readonly { piece: string; country?: string }[]) => {
    const counts = new Map<string, number>();
    for (const b of bars) {
      const key = b.piece === IMPORT_PIECE ? `I:${b.country ?? ''}` : b.piece;
      counts.set(key, (counts.get(key) ?? 0) + 1);
    }
    const parts = [...counts].map(([key, k]) => (key.startsWith('I:')
      ? `${plural(k, 'import')} ${countryFrom(grid, key.slice(2))}`
      : `${plural(k, isRamp(shapeKind(grid.pieces[key as PieceId])) ? 'rampe' : 'barre')} ${PIECE_WORDS[key as PieceId]?.of ?? key}`));
    const list = parts.length > 1 ? `${parts.slice(0, -1).join(', ')} et ${parts[parts.length - 1]}` : parts[0] ?? '';
    return `Remplace ${list}`;
  },
  poseOver: (label: string, replaces: string) => `${label} : ${replaces.charAt(0).toLowerCase()}${replaces.slice(1)}.`,
  poseBad: (label: string, why: string) => `${label} : ${why.charAt(0).toLowerCase()}${why.slice(1)}`,
  removed: (label: string) => `Retiré : ${label}.`,
  /** A pose that turns a clue to contradicted; `clue` is its short text ("16h : le barrage fixe le prix"). */
  poseContradicts: (label: string, clue: string) => `${label} : contredit l’indice « ${clue.replace(/\.$/, '')} ».`,
  undone: 'Dernière action annulée.',
  nothingToUndo: 'Rien à annuler.',
  resetDone: 'Grille remise à zéro. « Annuler » la rétablit.',
  nothingToReset: 'Rien à recommencer.',
  stepPending: (col: string) => `Pompage à ${col}. Touche ▼ sur le créneau du turbinage.`,
  stepAdded: (pump: string, turbine: string) => `STEP : pompage à ${pump}, turbinage à ${turbine}.`,
  stepRemoved: 'Paire STEP retirée.',
  stepPendingDropped: 'Pompage en attente annulé.',
  invalidBars: (k: number) => `${k} ${k > 1 ? 'centrales ne tiennent plus' : 'centrale ne tient plus'} : hachurée${k > 1 ? 's' : ''} en rouge.`,
  doneTitle: 'Programme bouclé',
  doneText: (k: number, time: string) => (k
    ? `Toutes les cases sont couvertes et ${k > 1 ? `les ${k} indices sont vrais` : 'l’indice est vrai'}. ${time}.`
    : `Toutes les cases sont couvertes. ${time}.`),
  next: 'Grille suivante',
  home: 'Accueil',
  gridAria: (title: string) => `Grille ${title}`,
  scrollBoard: 'Faire défiler la grille',
  cells: (k: number) => `${k} ${k > 1 ? 'cases' : 'case'}`,
  pairs: (k: number) => `${k} ${k > 1 ? 'paires' : 'paire'}`,
  importWord: 'import',
  stepLastSlot: 'Pas de pompage sur le dernier créneau : aucun turbinage ne peut suivre.',
  boardHelp: 'Flèches pour déplacer le curseur, Entrée pour poser (case de départ puis d’arrivée), Suppr pour retirer, Échap pour annuler.',
  // Print sheet
  printFoot: 'Couvre tout ce qui est sous le trait épais. Une seule solution.',
  printFootStep: 'Pompage ▲ et turbinage ▼ : note-les sous la grille. Remonte le trait épais d’une case par pompage, descends-le par turbinage.',
  printFootExports: 'Exports et imports : note-les sous chaque créneau. Remonte le trait épais d’une case par export.',
  printFootBoth: 'Note exports, imports, pompage ▲ et turbinage ▼ sous la grille. Le trait épais monte d’une case par export ou pompage, descend par turbinage.',
  printLegend: 'Publications du marché · par créneau',
  /** Day clues on paper (totals, running lengths, CO2), apart from the slot legend. */
  printDayTitle: 'Bilan du jour',
  printId: (id: number) => `Dispatch · n° ${id}`,
  printTitle: 'Impression',
  printAll: 'Imprimer toutes les grilles',
  printThis: 'Imprimer cette grille',
  printPreviewLead: 'Une grille par page A4, en couleur, sans corrigé.',
  engagedTitle: 'Déjà engagée',
};
