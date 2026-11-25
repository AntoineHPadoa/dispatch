/*
 * Every French text shown to the player: piece and country names, clue texts, rule violations,
 * inventory status. The engine and the UI import from here; no player text lives elsewhere.
 */
import { ANY_COUNTRY, IMPORT_PIECE, type Clue, type ExchangesClue, type Grid, type PieceId } from '../model/grid';
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
  /** "groupe gaz": a laid plant, and its plural ("groupes nucléaires"; charbon, gaz, TAC and barrage stay invariable). */
  group: string;
  groups: string;
}

export const PIECE_WORDS: Record<PieceId, PieceWords> = {
  N: { name: 'Nucléaire', the: 'le nucléaire', a: 'un réacteur', of: 'de nucléaire', group: 'groupe nucléaire', groups: 'groupes nucléaires' },
  B: { name: 'Barrage', the: 'le barrage', a: 'un barrage', of: 'de barrage', group: 'groupe barrage', groups: 'groupes barrage' },
  C: { name: 'Charbon', the: 'le charbon', a: 'une centrale à charbon', of: 'de charbon', group: 'groupe charbon', groups: 'groupes charbon' },
  G: { name: 'Gaz', the: 'le gaz', a: 'une centrale à gaz', of: 'de gaz', group: 'groupe gaz', groups: 'groupes gaz' },
  T: { name: 'TAC', the: 'la TAC', a: 'une TAC', of: 'de TAC', group: 'groupe TAC', groups: 'groupes TAC' },
};

/** Stands for the country in exchange messages when totals cover all countries. */
export const ALL_COUNTRIES = 'tous pays confondus';

/** French typography for free text (bulletins): no break between a number and its unit, thin no-break space before « : ». */
export function frenchSpaces(text: string): string {
  return text
    .replace(/(\d) (?=(GW|h|min|s|blocs?|créneaux?|paires?)\b)/g, '$1\u00a0')
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

/** "bloc de gaz", "bloc importé d’Allemagne" (key = piece id or I:<country>). */
function cellsOf(grid: Grid, key: string, k: number): string {
  if (key.startsWith('I:')) {
    return k ? `${plural(k, 'bloc importé', 'blocs importés')} ${countryFrom(grid, key.slice(2))}`
      : `aucun bloc importé ${countryFrom(grid, key.slice(2))}`;
  }
  const of = PIECE_WORDS[key as PieceId]?.of ?? `de ${key}`;
  return k ? `${plural(k, 'bloc')} ${of}` : `aucun bloc ${of}`;
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
        const where = !multi ? '' : id === '*' ? ', tous pays confondus' : ` ${countryFrom(grid, id)}`;
        parts.push(k ? `${plural(k, 'bloc importé', 'blocs importés')}${where}` : `aucun bloc importé${where}`);
      }
      if (clue.step !== undefined) parts.push(clue.step ? plural(clue.step, 'pompage') : 'aucun pompage');
      const text = parts.join(', ');
      return `${text.charAt(0).toUpperCase()}${text.slice(1)}.`;
    }
    case 'engaged':
      return `Groupe déjà engagé : un ${PIECE_WORDS[clue.piece].group} de ${at(clue.col)} à ${at(clue.col + clue.len)}, `
        + `${isRamp(shapeKind(grid.pieces[clue.piece])) ? 'base ' : ''}ligne ${clue.row + 1}.`;
  }
}

/**
 * One line of the "day's exchanges" publication, for one country: "Allemagne : ↑ 2 exports, ↓ 1 import".
 * A direction without a published total reads "∞" (none allowed at all: "0" on an exact inventory).
 * The total of every country reads on its own: "4 blocs exportés au total".
 */
export function exchangeLineText(grid: Grid, line: ExchangesClue): string {
  const both = { ...line.exports, ...line.imports };
  if (ANY_COUNTRY in both) {
    const parts: string[] = [];
    const total = (k: number, one: string, many: string, none: string) => `${k ? plural(k, one, many) : none} au total`;
    const imp = line.imports?.[ANY_COUNTRY];
    const exp = line.exports?.[ANY_COUNTRY];
    if (imp !== undefined) parts.push(total(imp, 'bloc importé', 'blocs importés', 'aucun bloc importé'));
    if (exp !== undefined) parts.push(total(exp, 'bloc exporté', 'blocs exportés', 'aucun bloc exporté'));
    const text = parts.join(', ');
    return `${text.charAt(0).toUpperCase()}${text.slice(1)}`;
  }
  const id = Object.keys(both)[0] ?? '';
  const name = grid.neighbors.find((nb) => nb.id === id)?.name ?? id;
  const exact = grid.inventory.level === 'exact';
  const shared = (dir: 'exports' | 'imports') => grid.inventory[dir]?.[ANY_COUNTRY] !== undefined;
  const value = (dir: 'exports' | 'imports') => line[dir]?.[id] ?? (exact && !shared(dir) ? 0 : null);
  const part = (arrow: string, k: number | null, one: string) => `${arrow} ${k === null ? '∞' : k} ${one}${k !== null && k > 1 ? 's' : ''}`;
  return `${name} : ${part('↑', value('exports'), 'export')}, ${part('↓', value('imports'), 'import')}`;
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
  bounds: (ramp = false) => `Le groupe${ramp ? ' à paliers' : ''} dépasse de la grille.`,
  length: (subject: string, lens: number[]) => `${subject} doit faire ${lenText(lens)}.`,
  rampLength: (lens: number[]) => `Un groupe de charbon à paliers fait ${lenText(lens)}.`,
  height: (subject: string, heights: number[]) => `${subject} doit faire ${heights.join(' ou ')} GW de haut.`,
  silhouette: (col: string) => `Hors de la silhouette à ${col}.`,
  weather: (col: string) => `La météo occupe déjà ce bloc à ${col}.`,
  overlap: () => 'Bloc déjà occupé.',
  unavailable: (of: string) => `Pas de centrale ${of} dans cette grille.`,
  unknownCountry: () => 'Ce pays n’est pas relié à la grille.',
  /** `group` is the plant's group ("groupe nucléaire"): "Plus de groupe nucléaire de 4 créneaux dans le carnet d’ordres." */
  inventoryBar: (group: string, len: number, ramp = false) => `Plus de ${group}${ramp ? ' à paliers' : ''} de ${plural(len, 'créneau', 'créneaux')} dans le carnet d’ordres.`,
  inventoryCells: (name: string, total: number) => `Plus de bloc ${name} dans le carnet d’ordres (${total} au total).`,
  stock: (piece: string, of: string, total: number) => (piece === 'B'
    ? `Plus d’eau dans le barrage (${plural(total, 'bloc')} au plus).`
    : `Plus de stock ${of} (${plural(total, 'bloc')} au plus).`),
  inventoryImports: (from: string, total: number) => `Plus d’import ${from} dans le carnet d’ordres (${total} au total).`,
  inventoryImportsAll: (total: number) => `Plus d’import dans le carnet d’ordres (${total} au total, tous pays).`,
  inventoryExports: (to: string, total: number) => `Plus d’export ${to} dans le carnet d’ordres (${total} au total).`,
  line: (to: string, col: string) => `Ligne ${to} saturée à ${col}.`,
  exportRange: (col: string) => `Export impossible à ${col}.`,
  surplus: (col: string) => `Surplus non absorbé à ${col} : il faut exporter ou pomper.`,
  stepNone: () => 'Cette grille n’a pas de STEP.',
  stepReversed: () => 'STEP inversée : le pompage doit précéder le turbinage.',
  stepCount: (total: number) => `Toutes les paires STEP sont déjà posées (${total}).`,
  co2: (got: number, cap: number) => `Plafond CO₂ dépassé : ${got} / ${cap}.`,
  locked: () => 'Ce groupe est déjà engagé : on ne peut pas le retirer.',
  lockedOver: () => 'Un groupe déjà engagé occupe cette place : on ne peut pas le remplacer.',
  nothingHere: () => 'Aucun groupe sur ce bloc.',
  tooManyBars: (groups: string, extra: number[]) => `${capitalize(groups)} en trop : ${extra.join(', ')}.`,
  tooManyCells: (name: string, got: number, want: number) => `Trop de blocs ${name} : ${got} pour ${want}.`,
  tooManyExports: (to: string, got: number, want: number) => `Trop d’exports ${to} : ${got} pour ${want}.`,
  tooManyImports: (from: string, got: number, want: number) => `Trop d’imports ${from} : ${got} pour ${want}.`,
  tooManySteps: (got: number, want: number) => `Trop de paires STEP : ${got} pour ${want}.`,
};

/** Reasons why a grid is not finished yet. */
export const TODO = {
  missing: (k: number) => `Il reste ${plural(k, 'bloc')} à couvrir.`,
  bars: (groups: string, left: number[]) => `Il reste à poser des ${groups} : ${left.join(', ')}.`,
  cells: (name: string, left: number) => `Il reste ${plural(left, 'bloc')} ${name} à poser.`,
  exports: (to: string, left: number) => `Il reste ${plural(left, 'bloc')} à exporter ${to}.`,
  imports: (from: string, left: number) => `Il reste ${plural(left, 'bloc')} à importer ${from}.`,
  steps: (left: number) => `Il reste ${plural(left, 'paire')} STEP à poser.`,
  clue: (text: string) => `Indice non respecté : ${text}`,
  otherSolution: () => 'Pose valide, mais ce n’est pas la solution attendue.',
};

/** Subject of a rule message about a laid plant: "Le groupe nucléaire", "L’import d’Allemagne". */
export function groupSubject(grid: Grid, piece: string, country?: string): string {
  if (piece === IMPORT_PIECE) return `L’import${country ? ` ${countryFrom(grid, country)}` : ''}`;
  return `Le ${PIECE_WORDS[piece as PieceId]?.group ?? piece}`;
}

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
  room: { name: 'Pas de place', text: 'Un groupe ne peut ni dépasser de la silhouette ni chevaucher un groupe déjà posé.' },
  exhausted: { name: 'Carnet épuisé', text: 'Quand tous les blocs d’une centrale sont trouvés, elle ne va nulle part ailleurs ; un groupe plus long que ce qu’il reste ne passe plus.' },
  price_cap: { name: 'Le prix plafonne la colonne', text: 'Sous un prix publié, aucun bloc n’est plus cher que ce prix.' },
  record: { name: 'Le relevé compte les blocs', text: 'Un relevé atteint interdit d’autres blocs de cette centrale ; s’il reste juste assez de blocs possibles, ils y passent tous. Les échanges du jour se comptent de même.' },
  flow: { name: 'Flux publié', text: 'Un flux publié fixe l’export ou l’import d’un créneau avec un pays.' },
  single_cover: { name: 'Un seul groupe pour ce bloc', text: 'Un bloc qu’un seul groupe peut encore couvrir reçoit ce groupe.' },
  single_spot: { name: 'Le groupe qui ne tient qu’à un endroit', text: 'Un groupe du carnet d’ordres qui n’a plus qu’une place possible y va.' },
  program: { name: 'Programme publié', text: 'Le groupe annoncé par un programme va sur la seule ligne où il tient.' },
  length: { name: 'Durée de marche', text: 'Le groupe dont on connaît la durée de marche va à la seule place où cette durée tient.' },
  silhouette: { name: 'La silhouette suit les groupes', text: 'Un export ou un pompage qui laisserait un bloc impossible à couvrir est exclu.' },
  swap: { name: 'Blocs interchangeables', text: 'Quand on connaît le nombre de blocs de chaque centrale dans une colonne, l’ordre ne compte pas.' },
  top_price: { name: 'Le bloc le plus cher', text: 'Un prix publié exige au moins un bloc de cette centrale dans la colonne : s’il n’y a qu’une place possible, c’est elle.' },
  ribbon: { name: 'Le creux coupe le ruban', text: 'Chaque ligne se découpe en rubans entre les creux : un groupe qui laisserait un bout impossible à remplir est exclu.' },
  just_enough: { name: 'Carnet juste', text: 'S’il reste exactement autant de blocs possibles que de blocs à poser pour une centrale, tous sont à elle.' },
  column_sum: { name: 'Compter la colonne', text: 'Une colonne a autant de blocs que sa hauteur : connaissant les autres centrales, on déduit celle qui reste.' },
  carbon: { name: 'Plafond carbone', text: 'Un groupe qui ferait dépasser le plafond CO₂ est exclu.' },
  ramp_plateau: { name: 'Le plateau barre la ligne du dessus', text: 'Au-dessus de sa base, le groupe à paliers occupe aussi la ligne suivante sur tout son plateau : aucun ruban de cette ligne ne le traverse.' },
  ramp_shoulder: { name: 'Le bord appelle un bloc', text: 'Le bloc au-dessus d’un bord est fermé côté plateau : seul un groupe d’un bloc, ou un groupe qui s’arrête pile là, peut le couvrir.' },
  ramp_lone: { name: 'Un bloc seul est un bord', text: 'Un seul bloc à paliers dans une colonne, c’est un bord : le groupe continue sur deux blocs d’un côté et s’arrête de l’autre.' },
  ramp_relay: { name: 'Deux bords se relaient', text: 'Deux blocs à paliers sans plateau autour : un groupe s’arrête et un autre démarre sur son bord.' },
  share_out: { name: 'Répartition du carnet', text: 'Les groupes doivent tous trouver une ligne : un découpage qui empêche les autres de se placer est exclu.' },
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
  engaged: 'Déjà engagé',
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

/** Shape hint under a plant name in the order book: "ruban de 3 à 6 créneaux", "1 bloc, pointe", "stock : 2 blocs". */
export function pieceHint(piece: PieceId, lens: number[], heights: number[], maxCells?: number, shape: ShapeKind = 'rect'): string {
  if (maxCells !== undefined) return `stock : ${plural(maxCells, 'bloc')}`;
  if (shape !== 'rect') return `à paliers, ${lenText(lens)}`;
  const minL = lens[0] ?? 1;
  const maxL = lens[lens.length - 1] ?? minL;
  const minH = heights[0] ?? 1;
  let text: string;
  if (maxL === 1 && heights.length === 1 && minH === 1) text = piece === 'T' ? '1 bloc, pointe' : '1 bloc';
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
  if (shape !== 'rect') return `${name} par paliers ${when}, base ligne ${row + 1}`;
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
    'Un bloc vaut 1 créneau en largeur et 1 GW en hauteur. Couvre chaque bloc de la silhouette exactement une fois.',
    'Une centrale a une forme fixe : sa largeur est sa durée de marche, sa hauteur sa puissance. Le charbon peut démarrer par paliers.',
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
    'premiers-pas': { title: 'Premiers pas' },
  } as Record<string, { title: string }>,
  /** Dossier card blurb in the shift chief's voice, by the first technique the grid teaches. */
  briefing: {
    swap: 'Premier quart : le carnet est exact, tu poses tout, ni plus ni moins.',
    price_cap: 'La bourse affiche un prix : aucune centrale plus chère n’a sa place sous ce créneau.',
    just_enough: 'La ligne vers l’Allemagne s’ouvre : exporte juste ce qu’il faut pour boucler.',
    ribbon: 'Le nucléaire tourne en ruban : repère où la demande creuse et où il peut passer.',
    flow: 'Berlin annonce son échange : compte ta colonne, le dernier bloc se déduit.',
    top_price: 'La bourse exige une centrale chère sur ce créneau : trouve où elle peut tourner.',
    silhouette: 'La STEP entre en scène : pompe la nuit, turbine au pic, et suis le programme de RTE.',
    ramp_plateau: 'Le charbon monte et descend par paliers : surveille ses bords.',
    ramp_relay: 'Deux charbons par paliers se croisent : l’un s’arrête, l’autre démarre.',
  } as Record<string, string>,
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
  gridNumber: (id: number) => `Grille n° ${id}`,
  instructions: 'Consigne',
  book: 'Carnet d’ordres',
  importName: 'Import',
  importOf: (from: string) => `Import ${from}`,
  importHint: (country: string) => `${country}, 1\u00a0bloc`,
  /** Book counter: laid / allowed, ∞ when the quantity is free. */
  count: (k: number, max: number | null) => `${k} / ${max ?? '∞'}`,
  /** Name of the card listing every publication of the day (a single name, whatever the grid). */
  cluesTitle: 'Publications du marché',
  cluesChecked: (k: number, n: number) => `${k} sur ${n} ${k > 1 ? 'vérifiés' : 'vérifié'}`,
  clueState: { ok: 'vérifié', open: 'à vérifier', broken: 'contredit' } as const,
  /** Accessible name of the price scale: plants from the cheapest to the dearest. */
  priceLadderLabel: (names: string[]) => `Ordre de prix : ${names.map((n) => (n === n.toUpperCase() ? n : n.toLowerCase())).join(', ')}`,
  chipsLabel: 'Centrales',
  tools: { erase: 'Gomme', undo: 'Annuler', reset: 'Recommencer' },
  toolsLabel: 'Outils',
  co2: 'CO₂',
  co2Points: (k: number, cap: number) => `${k} ${k > 1 ? 'points' : 'point'} sur ${cap}`,
  co2Left: (k: number) => (k >= 0 ? `${k} ${k > 1 ? 'restants' : 'restant'}` : `${-k} de trop`),
  co2PerCell: (k: number) => `CO₂ ${k} par bloc`,
  /** Accessible name of the legend under the CO2 gauge (plant, points per cell). */
  co2LegendLabel: 'Points de CO₂ par bloc',
  co2Rule: (cap: number, per: string) => `${cap} points au plus ; points par bloc : ${per}.`,
  co2Kind: 'Plafond CO₂',
  /** CO2 publication generated from `co2_cap`, listed with the market publications. */
  co2ClueKind: 'Limite CO₂',
  co2Clue: (cap: number) => `${cap} points de CO₂ au plus.`,
  neighborLine: (name: string, cap: number) => `${name} · ${cap} ${cap > 1 ? 'blocs' : 'bloc'} par créneau`,
  /** Day's exchanges under a neighbor row: "↑ 1/2", "↓ 1/∞" (total not published), or "↑ 0" when none is allowed. */
  exchangeCount: (arrow: string, got: number, want: number | null) => (want === 0 && got === 0 ? `${arrow} 0` : `${arrow} ${got}/${want ?? '∞'}`),
  /** Spoken part of a neighbor cell that carries an import record. */
  importRecordLabel: (k: number) => `Relevé d’import : ${k}.`,
  stepLine: 'STEP · pompage ▲ puis turbinage ▼',
  stepLineNumbered: 'STEP · pompage ▲ puis turbinage ▼ · numérote les paires : ▲1 ▼1, ▲2 ▼2…',
  stepName: 'STEP',
  recordJump: (col: string) => `Relevé de ${col} : lire la publication`,
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
  /** Idle hint: `exports` when the grid has a neighbor line. */
  hintChoose: (exports: boolean, phone = false) => 'Glisse sur la grille pour poser la centrale choisie'
    + ` (ou touche le bloc de départ puis celui d’arrivée). Change de centrale dans ${phone ? 'la rangée de centrales sous la grille' : 'le carnet d’ordres'}.`
    + `${exports ? ' Exporte en touchant un bloc de la rangée du voisin, sous la grille.' : ''}`,
  hintSecondTap: (label: string) => `${label} : touche maintenant le bloc d’arrivée.`,
  hintErase: 'Gomme : touche une centrale pour la retirer.',
  poseOk: (label: string) => `${label} : la pose tient.`,
  /** "Remplace 1 groupe de gaz et 2 imports d’Allemagne", "1 groupe à paliers de charbon" (groups covered by a new placement). */
  replaces: (grid: Grid, bars: readonly { piece: string; country?: string }[]) => {
    const counts = new Map<string, number>();
    for (const b of bars) {
      const key = b.piece === IMPORT_PIECE ? `I:${b.country ?? ''}` : b.piece;
      counts.set(key, (counts.get(key) ?? 0) + 1);
    }
    const parts = [...counts].map(([key, k]) => (key.startsWith('I:')
      ? `${plural(k, 'import')} ${countryFrom(grid, key.slice(2))}`
      : `${k} ${k > 1 ? PIECE_WORDS[key as PieceId]?.groups ?? key : PIECE_WORDS[key as PieceId]?.group ?? key}${isRamp(shapeKind(grid.pieces[key as PieceId])) ? ' à paliers' : ''}`));
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
  invalidBars: (k: number) => `${k} ${k > 1 ? 'groupes ne tiennent plus' : 'groupe ne tient plus'} : hachuré${k > 1 ? 's' : ''} en rouge.`,
  doneTitle: 'Programme bouclé',
  doneText: (k: number, time: string) => (k
    ? `Tous les blocs sont couverts et ${k > 1 ? `les ${k} indices sont vrais` : 'l’indice est vrai'}. ${time}.`
    : `Tous les blocs sont couverts. ${time}.`),
  next: 'Grille suivante',
  home: 'Accueil',
  gridAria: (title: string) => `Grille ${title}`,
  scrollBoard: 'Faire défiler la grille',
  cells: (k: number) => `${k} ${k > 1 ? 'blocs' : 'bloc'}`,
  pairs: (k: number) => `${k} ${k > 1 ? 'paires' : 'paire'}`,
  importWord: 'import',
  stepLastSlot: 'Pas de pompage sur le dernier créneau : aucun turbinage ne peut suivre.',
  boardHelp: 'Flèches pour déplacer le curseur, Entrée pour poser (bloc de départ puis d’arrivée), Suppr pour retirer, Échap pour annuler.',
  // Print sheet
  printFoot: 'Couvre tout ce qui est sous le trait épais. Une seule solution.',
  printFootStep: 'Pompage ▲ et turbinage ▼ : note-les sous la grille. Remonte le trait épais d’un bloc par pompage, descends-le par turbinage.',
  printFootExports: 'Exports et imports : note-les sous chaque créneau. Remonte le trait épais d’un bloc par export.',
  printFootBoth: 'Note exports, imports, pompage ▲ et turbinage ▼ sous la grille. Le trait épais monte d’un bloc par export ou pompage, descend par turbinage.',
  printLegend: 'Publications du marché · par créneau',
  /** Day clues on paper (totals, running lengths, CO2), apart from the slot legend. */
  printDayTitle: 'Bilan du jour',
  printId: (id: number) => `Dispatch · n° ${id}`,
  printTitle: 'Impression',
  printAll: 'Imprimer toutes les grilles',
  printThis: 'Imprimer cette grille',
  printPreviewLead: 'Une grille par page A4, en couleur, sans corrigé.',
  engagedTitle: 'Déjà engagé',
};
