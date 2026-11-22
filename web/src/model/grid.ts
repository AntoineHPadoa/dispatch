/*
 * Grid format (GAME-DESIGN.md §14): TypeScript types and a structural validator.
 * - Types describe one puzzle: silhouette (demand - weather), pieces, neighbors, STEP, CO2 cap,
 *   inventory, market clues, reference solution, difficulty and the optional market bulletin.
 * - validateGrid() checks structure, cross-references (columns, pieces, countries) and geometry of the
 *   laid pieces (allowed width, height and ramp shape, inside the grid, STEP order, line capacity); it does not
 *   check that the solution satisfies the rules (that is the engine's job).
 */

import { RAMP_MIN_WIDTH, RAMP_PIECE, SHAPE_KINDS, type ShapeKind } from './shapes';

/** Dispatchable plants, from cheapest to most expensive (merit order). */
export const PIECE_IDS = ['N', 'B', 'C', 'G', 'T'] as const;
export type PieceId = (typeof PIECE_IDS)[number];

/** Import cells: piece "I" with a `country` (neighbor id). */
export const IMPORT_PIECE = 'I';
export type PlacementPiece = PieceId | typeof IMPORT_PIECE;

/** Merit-order rank and CO2 per cell of each plant (GAME-DESIGN.md §3); grids must match. */
export const PIECE_SPEC: Record<PieceId, { rank: number; co2: number }> = {
  N: { rank: 1, co2: 0 },
  B: { rank: 2, co2: 0 },
  C: { rank: 3, co2: 3 },
  G: { rank: 4, co2: 1 },
  T: { rank: 5, co2: 2 },
};

/** Allowed number of time slots per grid (§2). */
export const MIN_COLUMNS = 6;
export const MAX_COLUMNS = 12;

export interface PieceDef {
  /** Shape: a rectangle (default), or a coal ramp (`trap` 1 -> 2 -> 1, `stair` 2 -> 1; see shapes.ts). */
  shape?: ShapeKind;
  /** Allowed widths (time slots), ascending; a ramp's total width. */
  len: number[];
  /** Allowed heights (GW), ascending; absent for a ramp (fixed profile). */
  height?: number[];
  /** Merit-order rank: 1 is the cheapest. Only used by price clues. */
  rank: number;
  /** CO2 per cell. */
  co2: number;
}

/** Non-dispatchable production per column: renewables (R) and run-of-river (F). */
export interface Weather {
  R: number[];
  F: number[];
}

export interface Neighbor {
  id: string;
  name: string;
  /** Line capacity per column: imports + exports <= cap. */
  cap: number;
  /** CO2 per imported cell. */
  co2: number;
}

/** One piece in the inventory. `{}` means "available, no count". */
export interface InventoryPieceSpec {
  /** Exact bar widths to lay (exact level, long pieces). */
  bars?: number[];
  /** Exact number of cells to lay (exact level, one-cell pieces). */
  cells?: number;
  /** Maximum number of cells (stock, e.g. the water of a dam). */
  max_cells?: number;
}

export type InventoryLevel = 'exact' | 'none';

export interface Inventory {
  level: InventoryLevel;
  /** Available pieces; a piece absent here cannot be laid. */
  pieces: Partial<Record<PieceId, InventoryPieceSpec>>;
  /** Exact level only: exported blocks per neighbor over the day. */
  exports?: Record<string, number>;
  /** Exact level only: imported cells per neighbor, or "*" for all countries. */
  imports?: Record<string, number>;
  /** Exact level only: number of STEP pairs. */
  step?: number;
}

/** Key for all countries in exchange totals. */
export const ANY_COUNTRY = '*';

/** "At 8h, gas sets the price": the most expensive dispatchable cell of the column is this piece. */
export interface PriceClue {
  type: 'price';
  col: number;
  piece: PieceId;
}

/** "A reactor runs from 4h to 20h": a bar of this piece covers exactly these columns (any row). */
export interface BarClue {
  type: 'bar';
  piece: PieceId;
  col: number;
  len: number;
}

/** "A reactor runs 6 slots in a row": a bar of this piece has exactly this width (any place). */
export interface LengthClue {
  type: 'length';
  piece: PieceId;
  len: number;
}

/**
 * "16h record: 2 gas cells, no TAC": cells per piece in the column.
 * Keys are piece ids, or `I:<country>` for imports from one neighbor.
 */
export interface ColumnClue {
  type: 'column';
  col: number;
  counts: Record<string, number>;
}

/** "At 21h, 1 block goes to Germany": export or import of one column with one neighbor. */
export interface FlowClue {
  type: 'flow';
  col: number;
  country: string;
  dir: 'export' | 'import';
  value: number;
}

/** "Today: 2 blocks exported, 1 imported, 1 pumping": day totals (imports key "*" = all countries). */
export interface ExchangesClue {
  type: 'exchanges';
  exports?: Record<string, number>;
  imports?: Record<string, number>;
  step?: number;
}

/** Pre-placed, locked bar (tutorial only). */
export interface EngagedClue {
  type: 'engaged';
  piece: PieceId;
  row: number;
  col: number;
  len: number;
  height?: number;
}

export type Clue =
  | PriceClue
  | BarClue
  | LengthClue
  | ColumnClue
  | FlowClue
  | ExchangesClue
  | EngagedClue;

export type ClueType = Clue['type'];
export const CLUE_TYPES: readonly ClueType[] = [
  'price', 'bar', 'length', 'column', 'flow', 'exchanges', 'engaged',
];

/** A laid piece. Rows count from 0 at the bottom (a ramp's base row); `height` defaults to 1. */
export interface Placement {
  piece: PlacementPiece;
  row: number;
  col: number;
  len: number;
  height?: number;
  /** Neighbor id, for imports only. */
  country?: string;
}

export interface StepPair {
  /** Pumping column (adds one cell to fill). */
  pump: number;
  /** Turbining column (removes one cell), strictly later than `pump`. */
  turbine: number;
}

export interface Solution {
  /** Exported blocks per neighbor and column. */
  exports: Record<string, number[]>;
  step: StepPair[];
  placements: Placement[];
}

export interface Difficulty {
  rating: 1 | 2 | 3 | 4;
  label: string;
  /** Deduction techniques needed (ids of the human solver rules). */
  techniques: string[];
}

export type Section = 'tutorial' | 'rated';

/** Sky shown for one time slot of the bulletin. */
export const WEATHER_KINDS = ['sun', 'moon', 'cloud', 'wind'] as const;
export type WeatherKind = (typeof WEATHER_KINDS)[number];

/** Market bulletin published with a grid (§14): number, headline, story, sky per slot, publication day. */
export interface Bulletin {
  /** Issue number, unique across the published grids. */
  number: number;
  title: string;
  /** Short context text telling the day. */
  text: string;
  /** One sky per column. */
  weather: WeatherKind[];
  /** Publication day, ISO `YYYY-MM-DD`. */
  published: string;
}

export interface Grid {
  id: number;
  title: string;
  section: Section;
  /** Tutorial text shown before playing. */
  intro?: string;
  /** Tutorial: technique ids this grid introduces. */
  teaches?: string[];
  columns: string[];
  demand: number[];
  pieces: Partial<Record<PieceId, PieceDef>>;
  weather: Weather;
  neighbors: Neighbor[];
  /** STEP available (the number of pairs comes from the inventory or an exchanges clue). */
  step: boolean;
  co2_cap: number | null;
  inventory: Inventory;
  clues: Clue[];
  solution: Solution;
  difficulty: Difficulty;
  /** Market bulletin; grids without one are never shown as a daily sheet. */
  bulletin?: Bulletin;
}

// ---- validation -------------------------------------------------------------

export interface ValidationResult {
  ok: boolean;
  errors: string[];
}

type Obj = Record<string, unknown>;

const isObj = (v: unknown): v is Obj => typeof v === 'object' && v !== null && !Array.isArray(v);
const isInt = (v: unknown): v is number => typeof v === 'number' && Number.isInteger(v);
const isNat = (v: unknown): v is number => isInt(v) && v >= 0;
const isPos = (v: unknown): v is number => isInt(v) && v > 0;
const isPieceId = (v: unknown): v is PieceId =>
  typeof v === 'string' && (PIECE_IDS as readonly string[]).includes(v);

/** True for a real calendar day written `YYYY-MM-DD`. */
export function isIsoDate(v: unknown): v is string {
  if (typeof v !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(v)) return false;
  const [y, m, d] = v.split('-').map(Number) as [number, number, number];
  const date = new Date(Date.UTC(y, m - 1, d));
  return date.getUTCFullYear() === y && date.getUTCMonth() === m - 1 && date.getUTCDate() === d;
}

/** Ascending list of positive integers, without duplicates. */
function isSizeList(v: unknown): v is number[] {
  return Array.isArray(v) && v.length > 0 && v.every(isPos) && v.every((x, i) => i === 0 || x > (v[i - 1] as number));
}

function isIntArray(v: unknown, n: number): v is number[] {
  return Array.isArray(v) && v.length === n && v.every(isInt);
}

/** STEP pairs published by the grid (exact inventory or exchanges clue), or null when to deduce. */
export function publishedStepPairs(grid: Grid): number | null {
  if (!grid.step) return null;
  if (grid.inventory.step !== undefined) return grid.inventory.step;
  for (const c of grid.clues) if (c.type === 'exchanges' && c.step !== undefined) return c.step;
  return null;
}

/** Validate the structure of a grid (§14). Error messages are developer-facing (English). */
export function validateGrid(raw: unknown): ValidationResult {
  const errors: string[] = [];
  const err = (m: string) => errors.push(m);
  if (!isObj(raw)) return { ok: false, errors: ['grid: not an object'] };
  const g = raw;

  if (!isPos(g.id)) err('id: positive integer expected');
  if (typeof g.title !== 'string' || !g.title) err('title: non-empty string expected');
  if (g.section !== 'tutorial' && g.section !== 'rated') err('section: "tutorial" or "rated" expected');
  if (g.intro !== undefined && typeof g.intro !== 'string') err('intro: string expected');
  if (g.teaches !== undefined && !(Array.isArray(g.teaches) && g.teaches.every((t) => typeof t === 'string'))) {
    err('teaches: string list expected');
  }

  // Columns, demand, weather
  const cols = Array.isArray(g.columns) ? g.columns : [];
  const n = cols.length;
  if (!Array.isArray(g.columns) || n < MIN_COLUMNS || n > MAX_COLUMNS || !cols.every((c) => typeof c === 'string')) {
    err(`columns: ${MIN_COLUMNS} to ${MAX_COLUMNS} labels expected`);
  }
  if (!isIntArray(g.demand, n)) err(`demand: ${n} integers expected`);
  if (!isObj(g.weather) || !isIntArray(g.weather.R, n) || !isIntArray(g.weather.F, n)) {
    err(`weather: R and F with ${n} integers each expected`);
  } else if (!g.weather.R.every((v) => v >= 0) || !g.weather.F.every((v) => v >= 0)) {
    err('weather: values must be >= 0');
  }

  // Pieces
  const pieceIds = new Set<PieceId>();
  if (!isObj(g.pieces) || Object.keys(g.pieces).length === 0) {
    err('pieces: non-empty object expected');
  } else {
    for (const [id, def] of Object.entries(g.pieces)) {
      if (!isPieceId(id)) { err(`pieces.${id}: unknown piece`); continue; }
      pieceIds.add(id);
      if (!isObj(def)) { err(`pieces.${id}: object expected`); continue; }
      if (!isSizeList(def.len)) err(`pieces.${id}.len: ascending positive integers expected`);
      const kind = def.shape === undefined ? 'rect' : def.shape;
      if (!(SHAPE_KINDS as readonly unknown[]).includes(kind)) {
        err(`pieces.${id}.shape: one of ${SHAPE_KINDS.join(', ')} expected`);
      } else if (kind !== 'rect') {
        if (id !== RAMP_PIECE) err(`pieces.${id}.shape: only coal (${RAMP_PIECE}) can be a ramp`);
        if (def.height !== undefined) err(`pieces.${id}.height: a ramp has no height`);
        const min = RAMP_MIN_WIDTH[kind as Exclude<ShapeKind, 'rect'>];
        if (isSizeList(def.len) && (def.len[0] as number) < min) err(`pieces.${id}.len: a ${kind} ramp is at least ${min} wide`);
      }
      if (kind === 'rect' && !isSizeList(def.height)) err(`pieces.${id}.height: ascending positive integers expected`);
      if (!isPos(def.rank)) err(`pieces.${id}.rank: positive integer expected`);
      else if (def.rank !== PIECE_SPEC[id].rank) err(`pieces.${id}.rank: ${PIECE_SPEC[id].rank} expected (§3)`);
      if (!isNat(def.co2)) err(`pieces.${id}.co2: integer >= 0 expected`);
      else if (def.co2 !== PIECE_SPEC[id].co2) err(`pieces.${id}.co2: ${PIECE_SPEC[id].co2} expected (§3)`);
    }
  }
  const pieceDef = (id: PieceId): Obj | null => {
    const p = isObj(g.pieces) ? g.pieces[id] : undefined;
    return isObj(p) ? p : null;
  };
  const allowsLen = (id: PieceId, len: unknown) => {
    const d = pieceDef(id);
    return !!d && Array.isArray(d.len) && d.len.includes(len);
  };
  const allowsHeight = (id: PieceId, height: unknown) => {
    const d = pieceDef(id);
    if (d && d.shape !== undefined && d.shape !== 'rect') return height === 1; // a ramp has a fixed profile
    return !!d && Array.isArray(d.height) && d.height.includes(height);
  };
  /** Geometry of a laid bar: allowed width and height, inside the grid. */
  const checkBarGeometry = (at: string, id: PieceId, p: Obj) => {
    if (isPos(p.len) && !allowsLen(id, p.len)) err(`${at}.len: width not allowed for ${id}`);
    if (isNat(p.col) && isPos(p.len) && p.col + p.len > n) err(`${at}: goes past the last column`);
    if (!allowsHeight(id, p.height ?? 1)) err(`${at}.height: height not allowed for ${id}`);
  };
  const neighborCap = (id: unknown): number | null => {
    if (!Array.isArray(g.neighbors)) return null;
    const nb = g.neighbors.find((x) => isObj(x) && x.id === id);
    return isObj(nb) && isPos(nb.cap) ? nb.cap : null;
  };

  // Neighbors
  const countries = new Set<string>();
  if (!Array.isArray(g.neighbors)) {
    err('neighbors: list expected');
  } else {
    g.neighbors.forEach((nb, i) => {
      if (!isObj(nb) || typeof nb.id !== 'string' || !nb.id || typeof nb.name !== 'string') {
        err(`neighbors[${i}]: {id, name, cap, co2} expected`);
        return;
      }
      if (nb.id === ANY_COUNTRY || countries.has(nb.id)) err(`neighbors[${i}].id: invalid or duplicate id`);
      countries.add(nb.id);
      if (!isPos(nb.cap)) err(`neighbors[${i}].cap: positive integer expected`);
      if (!isNat(nb.co2)) err(`neighbors[${i}].co2: integer >= 0 expected`);
    });
  }

  if (typeof g.step !== 'boolean') err('step: boolean expected');
  if (g.co2_cap !== null && !isNat(g.co2_cap)) err('co2_cap: null or integer >= 0 expected');

  const isCol = (c: unknown): c is number => isNat(c) && c < n;
  const checkCountryTotals = (where: string, v: unknown, allowAny: boolean) => {
    if (v === undefined) return;
    if (!isObj(v)) { err(`${where}: object expected`); return; }
    for (const [k, x] of Object.entries(v)) {
      if (!(countries.has(k) || (allowAny && k === ANY_COUNTRY))) err(`${where}.${k}: unknown country`);
      if (!isNat(x)) err(`${where}.${k}: integer >= 0 expected`);
    }
    if (allowAny && ANY_COUNTRY in v && Object.keys(v).length > 1) {
      err(`${where}: "${ANY_COUNTRY}" cannot be mixed with per-country keys`);
    }
  };

  // Inventory
  if (!isObj(g.inventory)) {
    err('inventory: object expected');
  } else {
    const inv = g.inventory;
    if (inv.level !== 'exact' && inv.level !== 'none') err('inventory.level: "exact" or "none" expected');
    if (!isObj(inv.pieces)) {
      err('inventory.pieces: object expected');
    } else {
      for (const id of pieceIds) if (!(id in inv.pieces)) err(`inventory.pieces.${id}: missing (declared in pieces)`);
      for (const [id, spec] of Object.entries(inv.pieces)) {
        if (!isPieceId(id) || !pieceIds.has(id)) { err(`inventory.pieces.${id}: not a grid piece`); continue; }
        if (!isObj(spec)) { err(`inventory.pieces.${id}: object expected`); continue; }
        for (const k of Object.keys(spec)) {
          if (!['bars', 'cells', 'max_cells'].includes(k)) err(`inventory.pieces.${id}.${k}: unknown key`);
        }
        if (spec.bars !== undefined) {
          if (!Array.isArray(spec.bars) || !spec.bars.every((l) => allowsLen(id, l))) {
            err(`inventory.pieces.${id}.bars: widths allowed for ${id} expected`);
          }
        }
        if (spec.cells !== undefined && !isNat(spec.cells)) err(`inventory.pieces.${id}.cells: integer >= 0 expected`);
        if (spec.max_cells !== undefined && !isNat(spec.max_cells)) {
          err(`inventory.pieces.${id}.max_cells: integer >= 0 expected`);
        }
        const exactKeys = (spec.bars !== undefined ? 1 : 0) + (spec.cells !== undefined ? 1 : 0);
        if (inv.level === 'exact' && exactKeys !== 1) err(`inventory.pieces.${id}: exact level needs bars or cells`);
        if (inv.level === 'none' && exactKeys !== 0) err(`inventory.pieces.${id}: no bars/cells at level none`);
      }
    }
    if (inv.level === 'none' && (inv.exports !== undefined || inv.imports !== undefined || inv.step !== undefined)) {
      err('inventory: exchange totals belong to an exchanges clue at level none');
    }
    checkCountryTotals('inventory.exports', inv.exports, false);
    checkCountryTotals('inventory.imports', inv.imports, true);
    if (inv.step !== undefined && !isNat(inv.step)) err('inventory.step: integer >= 0 expected');
    if (isPos(inv.step) && g.step !== true) err('inventory.step: grid has no STEP');
  }

  // A STEP grid must publish its number of pairs: exact inventory, or an exchanges clue.
  if (g.step === true && isObj(g.inventory)) {
    const published = (g.inventory.level === 'exact' && g.inventory.step !== undefined)
      || (Array.isArray(g.clues) && g.clues.some((c) => isObj(c) && c.type === 'exchanges' && c.step !== undefined));
    if (!published) err('step: a STEP grid must publish its number of pairs (inventory.step or an exchanges clue step)');
  }

  // Clues
  if (!Array.isArray(g.clues)) {
    err('clues: list expected');
  } else {
    g.clues.forEach((cl, i) => {
      const at = `clues[${i}]`;
      if (!isObj(cl) || !CLUE_TYPES.includes(cl.type as ClueType)) { err(`${at}: unknown clue type`); return; }
      const needPiece = () => { if (!isPieceId(cl.piece) || !pieceIds.has(cl.piece)) err(`${at}.piece: not a grid piece`); };
      const needCol = () => { if (!isCol(cl.col)) err(`${at}.col: column index expected`); };
      switch (cl.type) {
        case 'price':
          needPiece(); needCol();
          break;
        case 'bar':
          needPiece(); needCol();
          if (isPieceId(cl.piece) && !allowsLen(cl.piece, cl.len)) err(`${at}.len: width not allowed`);
          if (isNat(cl.col) && isPos(cl.len) && cl.col + cl.len > n) err(`${at}: bar goes past the last column`);
          break;
        case 'length':
          needPiece();
          if (isPieceId(cl.piece) && !allowsLen(cl.piece, cl.len)) err(`${at}.len: width not allowed`);
          break;
        case 'column':
          needCol();
          if (!isObj(cl.counts) || Object.keys(cl.counts).length === 0) { err(`${at}.counts: object expected`); break; }
          for (const [k, v] of Object.entries(cl.counts)) {
            const ok = (isPieceId(k) && pieceIds.has(k)) || (k.startsWith('I:') && countries.has(k.slice(2)));
            if (!ok) err(`${at}.counts.${k}: unknown piece`);
            if (!isNat(v)) err(`${at}.counts.${k}: integer >= 0 expected`);
          }
          break;
        case 'flow':
          needCol();
          if (typeof cl.country !== 'string' || !countries.has(cl.country)) err(`${at}.country: unknown country`);
          if (cl.dir !== 'export' && cl.dir !== 'import') err(`${at}.dir: "export" or "import" expected`);
          if (!isNat(cl.value)) err(`${at}.value: integer >= 0 expected`);
          else if (neighborCap(cl.country) !== null && cl.value > (neighborCap(cl.country) as number)) {
            err(`${at}.value: over the line capacity`);
          }
          break;
        case 'exchanges':
          checkCountryTotals(`${at}.exports`, cl.exports, false);
          checkCountryTotals(`${at}.imports`, cl.imports, true);
          if (cl.step !== undefined && !isNat(cl.step)) err(`${at}.step: integer >= 0 expected`);
          break;
        case 'engaged':
          needPiece(); needCol();
          if (!isNat(cl.row)) err(`${at}.row: integer >= 0 expected`);
          if (cl.height !== undefined && !isPos(cl.height)) err(`${at}.height: positive integer expected`);
          else if (isPieceId(cl.piece) && pieceIds.has(cl.piece)) checkBarGeometry(at, cl.piece, cl);
          break;
      }
    });
  }

  // Solution
  if (!isObj(g.solution)) {
    err('solution: object expected');
  } else {
    const sol = g.solution;
    if (!isObj(sol.exports)) {
      err('solution.exports: object expected');
    } else {
      for (const [k, v] of Object.entries(sol.exports)) {
        if (!countries.has(k)) err(`solution.exports.${k}: unknown country`);
        if (!isIntArray(v, n) || !v.every((x) => x >= 0)) err(`solution.exports.${k}: ${n} integers >= 0 expected`);
        else if (neighborCap(k) !== null && v.some((x) => x > (neighborCap(k) as number))) {
          err(`solution.exports.${k}: over the line capacity`);
        }
      }
    }
    if (!Array.isArray(sol.step)) {
      err('solution.step: list expected');
    } else {
      sol.step.forEach((s, i) => {
        if (!isObj(s) || !isCol(s.pump) || !isCol(s.turbine)) err(`solution.step[${i}]: {pump, turbine} columns expected`);
        else if (s.pump >= s.turbine) err(`solution.step[${i}]: pump must come before turbine`);
      });
      if (sol.step.length > 0 && g.step !== true) err('solution.step: grid has no STEP');
    }
    if (!Array.isArray(sol.placements)) {
      err('solution.placements: list expected');
    } else {
      sol.placements.forEach((p, i) => {
        const at = `solution.placements[${i}]`;
        if (!isObj(p)) { err(`${at}: object expected`); return; }
        if (p.piece === IMPORT_PIECE) {
          if (typeof p.country !== 'string' || !countries.has(p.country)) err(`${at}.country: unknown country`);
        } else if (!isPieceId(p.piece) || !pieceIds.has(p.piece)) {
          err(`${at}.piece: not a grid piece`);
        } else if (p.country !== undefined) {
          err(`${at}.country: only for imports`);
        }
        if (!isNat(p.row) || !isCol(p.col) || !isPos(p.len)) err(`${at}: row, col, len expected`);
        if (p.height !== undefined && !isPos(p.height)) { err(`${at}.height: positive integer expected`); return; }
        if (p.piece === IMPORT_PIECE) {
          if (isPos(p.len) && p.len !== 1) err(`${at}.len: an import is one cell`);
          if ((p.height ?? 1) !== 1) err(`${at}.height: an import is one cell`);
          if (isNat(p.col) && isPos(p.len) && p.col + p.len > n) err(`${at}: goes past the last column`);
        } else if (isPieceId(p.piece) && pieceIds.has(p.piece)) {
          checkBarGeometry(at, p.piece, p);
        }
      });
    }
  }

  // Difficulty
  const d = g.difficulty;
  if (!isObj(d) || !isInt(d.rating) || d.rating < 1 || d.rating > 4 || typeof d.label !== 'string'
    || !Array.isArray(d.techniques) || !d.techniques.every((t) => typeof t === 'string')) {
    err('difficulty: {rating 1-4, label, techniques[]} expected');
  }

  // Bulletin (optional)
  if (g.bulletin !== undefined) {
    const b = g.bulletin;
    if (!isObj(b)) {
      err('bulletin: object expected');
    } else {
      if (!isPos(b.number)) err('bulletin.number: positive integer expected');
      if (typeof b.title !== 'string' || !b.title.trim()) err('bulletin.title: non-empty string expected');
      if (typeof b.text !== 'string' || !b.text.trim()) err('bulletin.text: non-empty string expected');
      if (!Array.isArray(b.weather) || b.weather.length !== n
        || !b.weather.every((w) => (WEATHER_KINDS as readonly unknown[]).includes(w))) {
        err(`bulletin.weather: ${n} values among ${WEATHER_KINDS.join(', ')} expected`);
      }
      if (!isIsoDate(b.published)) err('bulletin.published: ISO date YYYY-MM-DD expected');
      for (const k of Object.keys(b)) {
        if (!['number', 'title', 'text', 'weather', 'published'].includes(k)) err(`bulletin.${k}: unknown key`);
      }
    }
  }

  return { ok: errors.length === 0, errors };
}

/** Validate and narrow; throws with every error when the grid is malformed. */
export function assertGrid(raw: unknown): Grid {
  const res = validateGrid(raw);
  if (!res.ok) throw new Error(`Invalid grid:\n- ${res.errors.join('\n- ')}`);
  return raw as Grid;
}
