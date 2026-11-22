/*
 * SVG board: the silhouette, weather, exports, STEP, laid pieces and the clues drawn on the grid.
 * - Style A (screen): rounded pastel cells; style B (paper): square cells, black silhouette
 *   contour, empty except what is imposed (weather, engaged plants), boxes to write exchanges in.
 * - boardGeometry() is pure (sizes, rows, hit-testing); renderBoard() returns the SVG markup.
 * - Rows are absolute, 0 at the bottom of the grid: the weather fills the bottom of each column
 *   (hatched, imposed) and a piece is one straight shape on the rows above it, never folded.
 * - Fixed layout: the card never moves while the player exports or pumps. Rows cover the highest
 *   reach of every column, so the room above the demand is reserved from the start but drawn empty:
 *   a dashed cell shows only where an export or a pumping has been laid.
 * - Slot clues (price, record) share one band under the slot hours, aligned on the columns. A
 *   programme is a thin coloured line right under the grid on its range, packed on as few lanes as
 *   possible; on paper its name also stands in the band. Each neighbor has a row of cells under the
 *   band, headed by its id in a left gutter, and a tap on a cell exports a block in that slot. Under
 *   it (screen), the day's exchanges against what is laid ("→ 1/2  ← 0/2"), then the neighbor caption.
 * - Records: a pill of colour squares and counts; with `recordChips` (desktop), a bare group of colour
 *   chips holding the counts, centred on the slot, three to a line at most before wrapping.
 * - Records on a narrow screen (pill style, cells under RECORD_MARKER_CELL): a record of several plants
 *   is a small marker with the record icon; a tap scrolls to its publication. One plant stays in clear.
 * - A clue's state is one mark on the top right corner of its pill (or cell, or programme line end):
 *   a green tick once verified, a red "!" once contradicted.
 * - An exported or pumped cell keeps its dashed outline when a piece covers it.
 * - Rectangles are drawn as rects; a coal ramp as one outline following its profile (rounded
 *   corners on screen, concave ones included; square on paper).
 */
import { ANY_COUNTRY, type Grid, type PieceId, type Placement } from '../model/grid';
import { cellsOf, isRamp, kindOf, profileOf, topIn } from '../model/shapes';
import {
  barHeight, exportsAt, importsAt, rawSilhouette, residual, totalExports, totalImports, type Evaluation, type PlayState, type ClueStatus,
} from '../engine';
import { UI, columnLabel, priceTag, priceTagShort, programLabel } from '../i18n/fr';
import type { Cell, Rect } from './gesture';
import { bookEntries } from './panels';
import {
  BAD, ICONS, INK_A, INK_B, OK, PIECE_COLORS, SOFT_A, SOFT_B, ACCENT, colorKey, esc,
} from './palette';

export type BoardStyle = 'A' | 'B';

export interface BoardPreview {
  rect: Rect;
  piece: string;
  valid: boolean;
  /** Indexes of the bars this placement would replace (drawn faded, pale red). */
  replacing?: number[];
}

export interface BoardInput {
  grid: Grid;
  state: PlayState;
  /** Verdict of the board (screen); null on paper. */
  ev: Evaluation | null;
  style: BoardStyle;
  cell: number;
  preview?: BoardPreview | null;
  anchor?: Cell | null;
  cursor?: Cell | null;
  /** Slot of the chosen pump while the turbine is still to choose (screen). */
  stepPending?: number | null;
  /** STEP chosen in the book: arrows ▲ (pump) then ▼ (turbine) show above the columns. */
  stepMode?: boolean;
  /** Interactive pills (neighbors, STEP) get focus and button roles. */
  interactive?: boolean;
  /** Records drawn as bare colour chips (desktop screen); otherwise as a pill. */
  recordChips?: boolean;
}

/** One chip of a record group, relative to the group's top-left corner. */
export interface RecordChip { key: string; value: number; dx: number; dy: number; w: number }
/** Record drawn as colour chips: group size and chips. */
export interface RecordLayout { w: number; h: number; chips: RecordChip[] }

const DIGIT = 5.9;
const CHIP_GAP = 2;
const CHIP_PAD = 3;
const CHIP_ROW = 15;
/**
 * Record as bare colour chips, each holding its count: one line while it fits its slot (at most
 * three chips on most cells), then the chips wrap; every line is centred on the group.
 */
export function recordLayout(counts: Record<string, number>, cell: number): RecordLayout {
  const entries = Object.entries(counts);
  const cw = (v: number) => Math.max(13, String(v).length * DIGIT + 5);
  const line = (list: [string, number][]) => list.reduce((a, [, v], j) => a + cw(v) + (j ? CHIP_GAP : 0), 0);
  const room = cell - 4 - 2 * CHIP_PAD;
  const rows: [string, number][][] = [];
  let cur: [string, number][] = [];
  for (const e of entries) {
    if (cur.length && line([...cur, e]) > room) { rows.push(cur); cur = []; }
    cur.push(e);
  }
  if (cur.length) rows.push(cur);
  const w = Math.max(19, Math.max(...rows.map(line)) + 2 * CHIP_PAD);
  const chips: RecordChip[] = [];
  rows.forEach((r, i) => {
    let dx = (w - line(r)) / 2;
    for (const [key, value] of r) { chips.push({ key, value, dx, dy: i * CHIP_ROW, w: cw(value) }); dx += cw(value) + CHIP_GAP; }
  });
  return { w, h: 18 + (rows.length - 1) * CHIP_ROW, chips };
}

/** Export flow clues fix the export of one column: `country:col` -> value. */
export function lockedExports(grid: Grid): Map<string, number> {
  const m = new Map<string, number>();
  for (const cl of grid.clues) if (cl.type === 'flow' && cl.dir === 'export') m.set(`${cl.country}:${cl.col}`, cl.value);
  return m;
}

const STEP_BLUE = '#e3eefa';

/** Icons of the STEP tags in column `c`: ▲ for a pump, ▼ for a turbine, with the pair number when `numbered`. */
export function stepTagLabels(step: readonly { pump: number; turbine: number }[], c: number, numbered: boolean): string[] {
  const out: string[] = [];
  step.forEach((q, i) => { if (q.pump === c) out.push(`▲${numbered ? i + 1 : ''}`); });
  step.forEach((q, i) => { if (q.turbine === c) out.push(`▼${numbered ? i + 1 : ''}`); });
  return out;
}

/** Most STEP pairs the board may hold (inventory or exchanges clue; the validator requires one). */
export function maxStepPairs(grid: Grid): number {
  if (!grid.step) return 0;
  if (grid.inventory.step !== undefined) return grid.inventory.step;
  const ex = grid.clues.find((c) => c.type === 'exchanges' && c.step !== undefined);
  return ex && ex.type === 'exchanges' ? ex.step ?? 0 : 0;
}

export interface BoardGeometry {
  n: number;
  cell: number;
  /** Rows drawn (visual units, weather included). */
  rows: number;
  /** Weather cells per column (the bottom rows, never covered). */
  weather: number[];
  topPad: number;
  botPad: number;
  width: number;
  height: number;
  /** Bottom rows: one export row per neighbor, plus STEP on paper when the grid has one. */
  bottomRows: number;
  /** Width of the left gutter holding the neighbor ids of the export rows (0 without neighbors). */
  lead: number;
  /** Highest cell count of each column (weather included): demand plus every export and pumping it may take. */
  reach: number[];
  /** Height of the slot-clue band under the hours (0 without slot clues). */
  bandHeight: number;
}

/**
 * Blocks the day allows with a neighbor in one direction: exact inventory, else the exchanges clue.
 * Null when unknown, or when only a total shared by every neighbor ("*") is published: it is not split by row.
 */
export function allowedExchange(grid: Grid, country: string, dir: 'exports' | 'imports'): number | null {
  const inv = grid.inventory;
  if (inv.level === 'exact') return inv[dir]?.[ANY_COUNTRY] !== undefined ? null : inv[dir]?.[country] ?? 0;
  const ex = grid.clues.find((c) => c.type === 'exchanges');
  const m = ex && ex.type === 'exchanges' ? ex[dir] : undefined;
  return m?.[country] ?? null;
}

/** Width of the left gutter of the export rows: the neighbor id ("DE") stands there. */
export const BOARD_LEAD = 22;
export const boardLead = (grid: Grid): number => (grid.neighbors.length ? BOARD_LEAD : 0);
/** Height of one export cell (a touch target), and the pitch of one neighbor row (cells plus its caption). */
export const exportCellHeight = (cell: number): number => Math.max(24, Math.round(cell * 0.55));
const neighborPitch = (cell: number): number => exportCellHeight(cell) + 24;

/** Number of tags stacked above each column: the STEP arrows and pair tags; slot clues sit under the hours. */
function tagsPerColumn(grid: Grid, style: BoardStyle): number[] {
  const t = grid.columns.map(() => 0);
  // One slot per column for the STEP arrows and pair tags, so the board never jumps when the mode opens.
  if (style === 'A' && grid.step) for (let c = 0; c < t.length; c++) t[c]! += 1;
  return t;
}

// ---- slot-clue band under the hours
const BAND_PITCH = 26;
/** Gap under the grid for the programme bar: on paper it clears the thick demand contour (3.2 wide). */
export const barTop = (style: BoardStyle): number => (style === 'B' ? 4 : 1);
const barDrop = (style: BoardStyle): number => barTop(style) + 3;
/** Pitch of the programme lanes under the grid (a 4 high line plus its gap). */
const LINE_PITCH = 7;

type BandKind = 'price' | 'column' | 'bar';
export interface BandItem {
  kind: BandKind;
  /** Index of the clue in `grid.clues`. */
  index: number;
  label: string;
  /** Pill width without the verified tick. */
  w: number;
  /** Centre of the pill (user units). */
  mid: number;
  /** Extent of the item (pill as wide as once verified, programme bar), for the packing. */
  x1: number;
  x2: number;
  /** Top of the item inside the band, and its lane in its group. */
  top: number;
  lane: number;
  /** Programme: its range (user units). */
  range?: [number, number];
  /** Record drawn as chips (`recordChips`): its layout. */
  rec?: RecordLayout;
  /** Record folded to a marker (narrow cells): a tap jumps to its publication. */
  marker?: boolean;
}

/** Below this cell size (phones), a record of several plants folds to a marker. */
export const RECORD_MARKER_CELL = 48;
/** Width of a record marker. */
const MARKER_W = 26;

/** A programme line under the grid (screen): its clue, range and lane (0 right under the grid). */
export interface ProgrammeLine { index: number; range: [number, number]; lane: number }

export interface BandPlan {
  items: BandItem[];
  /** Programme lines (screen only; on paper programmes are band items). */
  lines: ProgrammeLine[];
  height: number;
  /** Shift of the hour labels (room for the programme lines). */
  offset: number;
}

/**
 * Where each slot clue sits under the hours. Every item is centred on its slot (a paper programme
 * on its range); items that would come closer than 4 go on the next lane, so nothing overlaps
 * whatever the play state (the state mark sits on the corner). Screen programmes are only lines
 * under the grid: two that share no slot share a lane. The lines push the hours and the band down.
 */
export function bandPlan(grid: Grid, cell: number, style: BoardStyle = 'A', recordChips = false): BandPlan {
  const X0 = boardLead(grid);
  const xs = (c: number) => X0 + c * cell;
  const minX = X0;
  const maxX = X0 + grid.columns.length * cell;
  const raw: Omit<BandItem, 'top' | 'lane'>[] = [];
  const extent = (mid: number, tot: number) => {
    const px = Math.min(Math.max(mid - tot / 2, minX), Math.max(minX, maxX - tot));
    return [px, px + tot] as const;
  };
  const lines: ProgrammeLine[] = [];
  const lineEnds: number[] = [];
  grid.clues.forEach((cl, index) => {
    if (cl.type === 'bar' && style === 'A') {
      lines.push({ index, range: [xs(cl.col) + 6, xs(cl.col + cl.len) - 6], lane: 0 });
    } else if (cl.type === 'price') {
      const long = priceTag(cl.piece);
      const label = long.length * 5.6 + 10 > cell - 4 ? priceTagShort(cl.piece) : long;
      const w = Math.min(cell - 4, Math.max(cell - 6, label.length * 5.6 + 10));
      const mid = xs(cl.col) + cell / 2;
      const [x1, x2] = extent(mid, w);
      raw.push({ kind: 'price', index, label, w, mid, x1, x2 });
    } else if (cl.type === 'column' && recordChips && style === 'A') {
      const rec = recordLayout(cl.counts, cell);
      const mid = xs(cl.col) + cell / 2;
      const [x1, x2] = extent(mid, rec.w);
      raw.push({ kind: 'column', index, label: '', w: rec.w, mid, x1, x2, rec });
    } else if (cl.type === 'column' && style === 'A' && cell < RECORD_MARKER_CELL && Object.keys(cl.counts).length > 1) {
      const mid = xs(cl.col) + cell / 2;
      const [x1, x2] = extent(mid, MARKER_W);
      raw.push({ kind: 'column', index, label: '', w: MARKER_W, mid, x1, x2, marker: true });
    } else if (cl.type === 'column') {
      const narrow = cell < 44;
      const count = Object.keys(cl.counts).length;
      // A single record never outgrows its slot: it keeps 4 units of gap with its neighbours.
      const w = Math.min((narrow ? 12 : 16) + count * 20, count === 1 ? cell - 4 : Infinity);
      const mid = xs(cl.col) + cell / 2;
      const [x1, x2] = extent(mid, w);
      raw.push({ kind: 'column', index, label: '', w, mid, x1, x2 });
    } else if (cl.type === 'bar') {
      const label = programLabel(grid, cl.piece as PieceId, cl.col, cl.len);
      const w = label.length * 5.3 + 18;
      const r1 = xs(cl.col) + 6;
      const r2 = xs(cl.col + cl.len) - 6;
      const mid = (r1 + r2) / 2;
      const [p1, p2] = extent(mid, w);
      raw.push({ kind: 'bar', index, label, w, mid, x1: Math.min(p1, r1), x2: Math.max(p2, r2), range: [r1, r2] });
    }
  });
  // Lines: greedy by start, a line goes on the first lane free before it (slots never shared).
  for (const l of [...lines].sort((a, b) => a.range[0] - b.range[0] || a.index - b.index)) {
    let lane = lineEnds.findIndex((e) => e < l.range[0]);
    if (lane < 0) { lane = lineEnds.length; lineEnds.push(0); }
    lineEnds[lane] = l.range[1];
    l.lane = lane;
  }
  const items: BandItem[] = [];
  const offset = lineEnds.length ? barDrop(style) + (lineEnds.length - 1) * LINE_PITCH
    : raw.some((r) => r.kind === 'bar') ? barDrop(style) : 0;
  const ends: number[] = [];
  // A lane is as tall as its tallest item (a wrapped record takes more than one line).
  const laneH: number[] = [];
  for (const m of [...raw].sort((a, b) => a.x1 - b.x1 || a.index - b.index)) {
    let lane = ends.findIndex((e) => e + 4 <= m.x1);
    if (lane < 0) { lane = ends.length; ends.push(0); laneH.push(BAND_PITCH); }
    ends[lane] = m.x2;
    laneH[lane] = Math.max(laneH[lane]!, (m.rec?.h ?? 18) + 8);
    items.push({ ...m, lane, top: 0 });
  }
  const laneTop = laneH.map((_, l) => offset + laneH.slice(0, l).reduce((a, b) => a + b, 0));
  for (const it of items) it.top = laneTop[it.lane]!;
  lines.sort((a, b) => a.index - b.index);
  return { items, lines, height: offset + laneH.reduce((a, b) => a + b, 0), offset };
}

/**
 * Board sizes. The row count covers the highest the silhouette can go (exports up to the line
 * capacity, STEP pairs), so the rows under the grid never move while the player exports.
 */
export function boardGeometry(grid: Grid, style: BoardStyle, cell: number, recordChips = false): BoardGeometry {
  const n = grid.columns.length;
  const res = residual(grid);
  const weather = grid.columns.map((_, c) => (grid.weather.R[c] ?? 0) + (grid.weather.F[c] ?? 0));
  const locked = lockedExports(grid);
  const exact = grid.inventory.level === 'exact';
  const exportTotal = exact ? Object.values(grid.inventory.exports ?? {}).reduce((a, b) => a + b, 0) : Infinity;
  /** Most the silhouette can rise in column `c`: exports (published ones are fixed) plus pumping. */
  const extraAt = (c: number) => {
    const exports = grid.neighbors.reduce((a, nb) => a + (locked.get(`${nb.id}:${c}`) ?? nb.cap), 0);
    return Math.min(exports, exportTotal) + maxStepPairs(grid);
  };
  const colMax = res.map((r, c) => weather[c]! + Math.max(0, r + extraAt(c)));
  // Paper: one blank row above the highest point any column can reach.
  const rows = Math.max(1, ...colMax) + (style === 'B' ? 1 : 0);
  const tags = tagsPerColumn(grid, style);
  // Tags sit above what a column can reach (paper: above the rectangle), so nothing depends on the play state.
  const tops = style === 'B' ? res.map(() => rows) : colMax;
  const need = Math.max(0, ...tags.map((k, c) => (k ? k * 22 + 6 - (rows - tops[c]!) * cell : 0)));
  const topPad = Math.max(8, need);
  const bandHeight = bandPlan(grid, cell, style, recordChips).height;
  // Export rows (one per neighbor); STEP: chosen from the order book on screen, a row of boxes on paper.
  const bottomRows = grid.neighbors.length + (grid.step && style === 'B' ? 1 : 0);
  const lead = boardLead(grid);
  const botPad = 20 + (bandHeight ? bandHeight + 4 : 0) + bottomRows * neighborPitch(cell) + 4;
  return {
    n, cell, rows, weather, topPad, botPad, width: lead + n * cell + 4, height: rows * cell + topPad + botPad,
    bottomRows, lead, reach: colMax, bandHeight,
  };
}

/** Cell under a point given in SVG user units (x from 0, y from the top of the rows). */
export function cellAt(geo: BoardGeometry, x: number, y: number): Cell | null {
  if (x < geo.lead || y < 0) return null;
  const col = Math.floor((x - geo.lead) / geo.cell);
  const v = geo.rows - 1 - Math.floor(y / geo.cell);
  if (col >= geo.n || v < 0) return null;
  return { col, row: v };
}

/**
 * SVG path of a polygon with every corner rounded to `r` (at most half of each side), concave
 * corners included; `r` = 0 keeps square corners.
 */
export function roundedPath(pts: readonly (readonly [number, number])[], r: number): string {
  const n = pts.length;
  const f = (v: number) => Number(v.toFixed(2));
  if (r <= 0) return `M${pts.map(([px, py]) => `${f(px)} ${f(py)}`).join(' L')} Z`;
  let d = '';
  for (let i = 0; i < n; i++) {
    const [x0, y0] = pts[(i - 1 + n) % n]!;
    const [x1, y1] = pts[i]!;
    const [x2, y2] = pts[(i + 1) % n]!;
    const l1 = Math.hypot(x0 - x1, y0 - y1);
    const l2 = Math.hypot(x2 - x1, y2 - y1);
    const k = Math.min(r, l1 / 2, l2 / 2);
    const a = [x1 + ((x0 - x1) * k) / l1, y1 + ((y0 - y1) * k) / l1];
    const b = [x1 + ((x2 - x1) * k) / l2, y1 + ((y2 - y1) * k) / l2];
    d += `${i ? ' L' : 'M'}${f(a[0]!)} ${f(a[1]!)} Q${f(x1)} ${f(y1)} ${f(b[0]!)} ${f(b[1]!)}`;
  }
  return `${d} Z`;
}

/**
 * Outline of a run of columns standing on one base line (`yBase`, bottom of the cells): column i
 * spans [x0 + i * cell, x0 + (i + 1) * cell] with height `heights[i]` cells. The `gap` between
 * cells is kept on the outer edges; a step sits on the edge of the taller column.
 */
export function skyline(x0: number, yBase: number, heights: readonly number[], cell: number, gap: number): [number, number][] {
  const g = gap / 2;
  const top = (h: number) => yBase - h * cell + g;
  const pts: [number, number][] = [[x0 + g, yBase - g], [x0 + g, top(heights[0]!)]];
  for (let i = 1; i < heights.length; i++) {
    const h0 = heights[i - 1]!;
    const h1 = heights[i]!;
    if (h0 === h1) continue;
    const sx = x0 + i * cell + (h1 > h0 ? g : -g);
    pts.push([sx, top(h0)], [sx, top(h1)]);
  }
  const xr = x0 + heights.length * cell - g;
  pts.push([xr, top(heights[heights.length - 1]!)], [xr, yBase - g]);
  return pts;
}

/**
 * State mark of a clue, centred on (`kx`, `ky`), a pill's top right corner: a green tick once
 * verified, a red "!" once contradicted, nothing while open. A white ring sets it off the pill.
 */
export function clueMark(kx: number, ky: number, st: ClueStatus | null): string {
  if (st !== 'ok' && st !== 'broken') return '';
  const ring = `<circle cx="${kx}" cy="${ky}" r="6.2" fill="#fff"/>`;
  if (st === 'ok') {
    return `<g class="mark ok">${ring}<circle cx="${kx}" cy="${ky}" r="5" fill="${OK}"/>`
      + `<path d="M${kx - 2.4} ${ky} l1.7 1.7 l2.9 -3.3" stroke="#fff" stroke-width="1.4" fill="none"/></g>`;
  }
  return `<g class="mark bad">${ring}<circle cx="${kx}" cy="${ky}" r="5" fill="${BAD}"/>`
    + `<path d="M${kx} ${ky - 2.6} v3" stroke="#fff" stroke-width="1.5" stroke-linecap="round"/>`
    + `<circle cx="${kx}" cy="${ky + 2.3}" r=".8" fill="#fff"/></g>`;
}

let uid = 0;

/** SVG markup of the board. */
export function renderBoard(input: BoardInput): { svg: string; geo: BoardGeometry } {
  const { grid, state, ev, style, cell } = input;
  const A = style === 'A';
  const chips = !!input.recordChips && A;
  const geo = boardGeometry(grid, style, cell, chips);
  const plan = bandPlan(grid, cell, style, chips);
  const { n, rows: H, weather } = geo;
  const ink = A ? INK_A : INK_B;
  const soft = A ? SOFT_A : SOFT_B;
  const gap = A ? 3 : 0;
  const rad = A ? Math.round(cell * 0.15) : 0;
  const id = ++uid;
  const fs = Math.max(7.5, Math.min(9.5, cell * 0.19));
  const fill = (p: string) => (A ? PIECE_COLORS[colorKey(p)].a : PIECE_COLORS[colorKey(p)].b);
  const res = residual(grid);
  const raw = A ? rawSilhouette(grid, state) : res;
  const sil = raw.map((v) => Math.max(0, v));
  const pumps = grid.columns.map(() => 0);
  const turbines = grid.columns.map(() => 0);
  if (A) for (const s of state.step) { pumps[s.pump]! += 1; turbines[s.turbine]! += 1; }
  const exportsOf = (c: number) => grid.neighbors.reduce((a, nb) => a + exportsAt(state, nb.id, c), 0);
  const statusOf = (i: number): ClueStatus | null => (ev ? ev.clues[i]?.status ?? null : null);
  const y = (v: number, h = 1) => (H - v - h) * cell;
  const X0 = geo.lead;
  const x = (c: number) => X0 + c * cell;
  const T = (tx: number, ty: number, txt: string, o: { anchor?: string; w?: number; size?: number; color?: string; op?: number } = {}) =>
    `<text x="${tx}" y="${ty}" text-anchor="${o.anchor ?? 'middle'}" font-family="Manrope, system-ui, sans-serif" font-size="${o.size ?? fs}" font-weight="${o.w ?? 800}" fill="${o.color ?? ink}"${o.op !== undefined ? ` fill-opacity="${o.op}"` : ''}>${esc(txt)}</text>`;

  let s = `<defs>
    <pattern id="hR${id}" width="6" height="6" patternUnits="userSpaceOnUse" patternTransform="rotate(45)"><rect width="6" height="6" fill="${PIECE_COLORS.R.a}"/><line x1="0" y1="0" x2="0" y2="6" stroke="${PIECE_COLORS.R.ink}" stroke-width="1.4" stroke-opacity=".45"/></pattern>
    <pattern id="hF${id}" width="6" height="6" patternUnits="userSpaceOnUse" patternTransform="rotate(-45)"><rect width="6" height="6" fill="${PIECE_COLORS.F.a}"/><line x1="0" y1="0" x2="0" y2="6" stroke="${PIECE_COLORS.F.ink}" stroke-width="1.4" stroke-opacity=".45"/></pattern>
    <pattern id="hX${id}" width="7" height="7" patternUnits="userSpaceOnUse" patternTransform="rotate(45)"><line x1="0" y1="0" x2="0" y2="7" stroke="${BAD}" stroke-width="2" stroke-opacity=".35"/></pattern>
  </defs>`;

  // ---- cells: weather, silhouette, exports, pumping, turbined ghosts
  // Cells under an opaque bar are not drawn: their outline would show at the bar's edges.
  const hidden = new Set<string>();
  /** Cells under any laid piece, faded ones included (their outline shows through). */
  const hiddenAny = new Set<string>();
  if (A) {
    const fading = new Set(input.preview?.replacing ?? []);
    state.bars.forEach((b, i) => {
      for (const [r, c] of cellsOf(grid, b)) {
        hiddenAny.add(`${r},${c}`);
        if (!fading.has(i)) hidden.add(`${r},${c}`);
      }
    });
  }
  const box = (c: number, v: number) => ({ bx: x(c) + gap / 2, by: y(v) + gap / 2, w: cell - gap });
  for (let c = 0; c < n; c++) {
    const F = grid.weather.F[c] ?? 0;
    const R = grid.weather.R[c] ?? 0;
    const surplus = Math.max(0, -raw[c]!);
    for (let v = 0; v < F + R; v++) {
      const k = v < F ? 'F' : 'R';
      const { bx, by, w } = box(c, v);
      s += `<rect x="${bx}" y="${by}" width="${w}" height="${w}" rx="${rad}" fill="url(#h${k}${id})"${A ? '' : ` stroke="${ink}" stroke-width=".8"`}/>`;
      s += T(bx + w / 2, by + w / 2 + cell * 0.07, k, { size: cell * 0.2, op: 0.55 });
      if (v >= F + R - surplus) {
        s += `<rect x="${bx + 1}" y="${by + 1}" width="${w - 2}" height="${w - 2}" rx="${rad}" fill="none" stroke="${BAD}" stroke-width="1.6" stroke-dasharray="4 3"/>`;
      }
    }
    if (grid.demand[c]! < F + R) {
      const ly = y(grid.demand[c]!, 0);
      s += `<line x1="${x(c) - 4}" x2="${x(c + 1) + 4}" y1="${ly}" y2="${ly}" stroke="${ink}" stroke-width="1.6" stroke-dasharray="6 3"/>`;
    }
    const k = sil[c]!;
    const e = A ? exportsOf(c) : 0;
    for (let r = 0; r < k; r++) {
      const { bx, by, w } = box(c, weather[c]! + r);
      const kind = r >= k - pumps[c]! ? 'pump' : r >= k - pumps[c]! - e ? 'exp' : 'sil';
      if (kind === 'sil') {
        if (hidden.has(`${weather[c]! + r},${c}`)) continue;
        s += A ? `<rect x="${bx}" y="${by}" width="${w}" height="${w}" rx="${rad}" fill="#fff" stroke="#eadfe6"/>`
          : `<rect x="${bx}" y="${by}" width="${w}" height="${w}" fill="#fff" stroke="#c7d5d1" stroke-width=".8"/>`;
      } else if (kind === 'pump') {
        s += `<rect x="${bx + 1}" y="${by + 1}" width="${w - 2}" height="${w - 2}" rx="${rad}" fill="#fff" stroke="${PIECE_COLORS.B.ink}" stroke-width="1.6" stroke-dasharray="4 3"/>`;
      } else {
        // Exported block: a dashed violet cell above the column.
        s += `<rect x="${bx + 1}" y="${by + 1}" width="${w - 2}" height="${w - 2}" rx="${rad}" fill="#fff" stroke="${PIECE_COLORS.I.ink}" stroke-width="1.6" stroke-dasharray="4 3"/>`;
      }
    }
    // The pump chosen but not yet turbined: its dashed cell shows already.
    if (A && input.stepPending === c) {
      const { bx, by, w } = box(c, weather[c]! + k + turbines[c]!);
      s += `<rect x="${bx + 1}" y="${by + 1}" width="${w - 2}" height="${w - 2}" rx="${rad}" fill="#fff" stroke="${PIECE_COLORS.B.ink}" stroke-width="1.6" stroke-dasharray="4 3"/>`;
    }
    // Paper: the grid is a full rectangle; cells above the demand line are plain white too.
    if (!A) {
      for (let r = k; r < H - weather[c]!; r++) {
        const { bx, by, w } = box(c, weather[c]! + r);
        s += `<rect x="${bx}" y="${by}" width="${w}" height="${w}" fill="#fff" stroke="#c7d5d1" stroke-width=".8"/>`;
      }
    }
    for (let t = 0; t < turbines[c]!; t++) {
      const { bx, by, w } = box(c, weather[c]! + k + t);
      s += `<rect x="${bx + 1}" y="${by + 1}" width="${w - 2}" height="${w - 2}" rx="${rad}" fill="none" stroke="${soft}" stroke-opacity=".6" stroke-width="1.2" stroke-dasharray="2 3"/>`
        + `<path d="M${bx + 8} ${by + 8} L${bx + w - 8} ${by + w - 8}" stroke="${soft}" stroke-opacity=".5" stroke-width="1.2"/>`;
    }
  }

  // ---- pieces
  const invalid = new Set(ev?.invalidBars ?? []);
  /** A rectangle: one shape on its row. */
  const drawRect = (col: number, len: number, row: number, h: number, attrs: (rx: number, ry: number, rw: number, rh: number) => string) =>
    attrs(x(col) + gap / 2, y(row, h) + gap / 2, len * cell - gap, h * cell - gap);
  /** A ramp: one outline following its profile, standing on its base row. */
  const drawRamp = (b: Placement, attrs: (d: string, inset: number) => string, inset = 0) => {
    const heights = profileOf(grid, b).map(([, h]) => h);
    return attrs(roundedPath(skyline(x(b.col), y(b.row, 0), heights, cell, gap + 2 * inset), rad), inset);
  };
  const replacing = new Set(input.preview?.replacing ?? []);
  state.bars.forEach((b, i) => {
    if (!A && !b.locked) return;
    const h = barHeight(b);
    const f = fill(b.piece);
    const gone = replacing.has(i);
    const paperStroke = A ? '' : ` stroke="${ink}" stroke-width="1.2"`;
    if (isRamp(kindOf(grid, b))) {
      s += drawRamp(b, (d) => `<path d="${d}" fill="${f}"${paperStroke}${gone ? ' fill-opacity=".3"' : ''}/>`
        + (invalid.has(i) && !gone ? `<path d="${d}" fill="url(#hX${id})" stroke="${BAD}" stroke-width="2"/>` : ''));
      if (gone) s += drawRamp(b, (d) => `<path class="replacing" d="${d}" fill="${BAD}" fill-opacity=".12" stroke="${BAD}" stroke-opacity=".45" stroke-width="1.4" stroke-dasharray="3 3"/>`, 1);
    } else {
      s += drawRect(b.col, b.len, b.row, h, (rx, ry, rw, rh) => `<rect x="${rx}" y="${ry}" width="${rw}" height="${rh}" rx="${rad}" fill="${f}"${paperStroke}${gone ? ' fill-opacity=".3"' : ''}/>`
        + (invalid.has(i) && !gone ? `<rect x="${rx}" y="${ry}" width="${rw}" height="${rh}" rx="${rad}" fill="url(#hX${id})" stroke="${BAD}" stroke-width="2"/>` : '')
        + (gone ? `<rect class="replacing" x="${rx + 1}" y="${ry + 1}" width="${rw - 2}" height="${rh - 2}" rx="${rad}" fill="${BAD}" fill-opacity=".12" stroke="${BAD}" stroke-opacity=".45" stroke-width="1.4" stroke-dasharray="3 3"/>` : ''));
    }
    if (b.locked) {
      // Top right corner of the last column (a ramp's last shoulder).
      const lx = x(b.col + b.len) - gap / 2 - cell * 0.32;
      const ly = y(topIn(grid, b, b.col + b.len - 1), 0) + gap / 2 + cell * 0.07;
      s += `<g transform="translate(${lx} ${ly}) scale(${(cell * 0.0115).toFixed(3)})" fill="none" stroke="${ink}" stroke-width="2" stroke-linecap="round">${ICONS.lock}</g>`;
    }
    const label = b.piece === 'I' ? b.country ?? '' : h > 1 ? `${h} GW` : '';
    if (label) {
      const cx = x(b.col) + (b.len * cell) / 2;
      const cy = y(b.row, h) + (h * cell) / 2 + cell * 0.08;
      s += T(cx, cy, label, { size: cell * 0.22, op: b.piece === 'I' ? 0.8 : 0.55 });
    }
  });

  // ---- exported and pumped cells under a piece keep their dashed outline (drawn over the piece)
  if (A) {
    for (let c = 0; c < n; c++) {
      const k = sil[c]!;
      const e = exportsOf(c);
      for (let r = Math.max(0, k - pumps[c]! - e); r < k; r++) {
        if (!hiddenAny.has(`${weather[c]! + r},${c}`)) continue;
        const { bx, by, w } = box(c, weather[c]! + r);
        const color = r >= k - pumps[c]! ? PIECE_COLORS.B.ink : PIECE_COLORS.I.ink;
        s += `<rect class="covered" x="${bx + 2.5}" y="${by + 2.5}" width="${w - 5}" height="${w - 5}" rx="${Math.max(0, rad - 2)}" fill="none" stroke="${color}" stroke-width="1.6" stroke-dasharray="4 3" pointer-events="none"/>`;
      }
    }
  }

  // ---- preview, anchor, keyboard cursor
  const pv = input.preview;
  if (pv) {
    const col = pv.valid ? OK : BAD;
    const f = fill(pv.piece);
    const bar: Placement = { piece: pv.piece as Placement['piece'], row: pv.rect.row, col: pv.rect.col, len: pv.rect.len };
    if (pv.piece in grid.pieces && isRamp(kindOf(grid, bar))) {
      s += drawRamp(bar, (d) => `<path class="preview" d="${d}" fill="${f}" fill-opacity=".5" stroke="${col}" stroke-width="2" stroke-dasharray="5 3"/>`, 1.5);
    } else s += drawRect(pv.rect.col, pv.rect.len, pv.rect.row, pv.rect.height, (rx, ry, rw, rh) => `<rect class="preview" x="${rx + 1.5}" y="${ry + 1.5}" width="${Math.max(0, rw - 3)}" height="${Math.max(0, rh - 3)}" rx="${rad}" fill="${f}" fill-opacity=".5" stroke="${col}" stroke-width="2" stroke-dasharray="5 3"/>`);
  }
  const ring = (c: Cell, color: string, dash: string) => {
    if (c.col < 0 || c.col >= n) return '';
    const { bx, by, w } = box(c.col, c.row);
    return `<rect x="${bx - 1}" y="${by - 1}" width="${w + 2}" height="${w + 2}" rx="${rad + 1}" fill="none" stroke="${color}" stroke-width="2"${dash ? ` stroke-dasharray="${dash}"` : ''} pointer-events="none"/>`;
  };
  if (input.anchor) s += ring(input.anchor, ink, '');
  if (input.cursor) s += ring(input.cursor, ACCENT, '3 2');

  // ---- silhouette contour (paper)
  if (!A) {
    let d = `M${x(0)} ${H * cell}`;
    for (let c = 0; c < n; c++) {
      const top = y(weather[c]! + sil[c]!, 0);
      d += ` L${x(c)} ${top} L${x(c + 1)} ${top}`;
    }
    s += `<path d="${d} L${x(n)} ${H * cell} Z" fill="none" stroke="${ink}" stroke-width="3.2" stroke-linejoin="miter"/>`;
  }

  // ---- tags above the columns: STEP (the slot clues are drawn under the hours)
  // STEP tags and arrows hang on the current top of their column (pumped, exported and turbined
  // cells included, plus the pending pump); topPad keeps room above the highest reach, so the card
  // never moves when a column rises.
  const stack = grid.columns.map(() => 0);
  const topOf = (c: number) => weather[c]! + sil[c]! + turbines[c]! + (input.stepPending === c ? 1 : 0);
  const tagY = (c: number) => y(topOf(c) - 1) - 24 - stack[c]!++ * 22;
  // A pill centred on `mid`, kept inside the board; `content(textCentre, left)` draws what is inside.
  // Its state mark sits on its top right corner.
  const W = n * cell;
  const minX = X0;
  const maxX = X0 + W;
  const pill = (mid: number, py: number, w: number, bg: string, stroke: string | null,
    content: (tc: number, left: number) => string, st: ClueStatus | null) => {
    const px = Math.min(Math.max(mid - w / 2, minX), Math.max(minX, maxX - w));
    return `<rect x="${px}" y="${py}" width="${w}" height="18" rx="9" fill="${bg}"${stroke ? ` stroke="${stroke}"` : ''}/>${content(px + w / 2, px)}`
      + clueMark(Math.min(px + w - 2, maxX - 4), py + 1, st);
  };
  if (A) {
    // STEP tags: "▲ pompe" over the pumped column, "▼ turbine" over the turbined one, both light blue
    // (the shared colour and icons tell the pair); a tap on a tag removes its pair. With several pairs
    // each icon carries its pair number. In STEP mode, arrows ▲ then ▼ sit in the same band.
    let tags = '';
    const pending = input.stepPending ?? null;
    const numbered = maxStepPairs(grid) > 1;
    for (let c = 0; c < n; c++) {
      if (!pumps[c] && !turbines[c]) continue;
      const ty = tagY(c);
      const full = cell >= 48;
      const labels = stepTagLabels(state.step, c, numbered);
      // Arrows only (▲ pump, ▼ turbine); several in one tag are joined.
      const label = labels.join('');
      const w = full ? Math.max(cell - 8, label.length * 5 + 12) : Math.max(cell - 8, label.length * 5.5 + 8);
      const mid = x(c) + cell / 2;
      const k = state.step.findIndex((q) => q.pump === c || q.turbine === c);
      const pair = k >= 0 ? state.step[k] : undefined;
      const act = input.interactive && pair
        ? ` data-act="step-tag" data-col="${c}" tabindex="0" role="button" aria-label="${esc(UI.stepTagLabel(columnLabel(grid, pair.pump), columnLabel(grid, pair.turbine)))}"` : '';
      tags += `<g class="tag step-tag${act ? ' act' : ''}"${act}>`
        + pill(mid, ty, w, STEP_BLUE, PIECE_COLORS.B.ink, (tc) => T(tc, ty + 12.5, label, { size: full ? 8.5 : 9.5 }), null)
        + '</g>';
    }
    s += tags;
    if (input.stepMode) {
      // ▲ over each slot to choose the pump; once chosen, it stays filled and ▼ shows on later slots.
      const r = Math.min(11, cell / 2 - 3);
      const nextPair = state.step.length + 1;
      for (let c = 0; c < n; c++) {
        const chosen = pending === c;
        const kind = pending === null ? (c < n - 1 ? 'up' : null) : chosen ? 'up' : c > pending ? 'down' : null;
        if (!kind) continue;
        const ty = tagY(c);
        const cx = x(c) + cell / 2;
        const cy = ty + 9;
        const col = PIECE_COLORS.B.ink;
        const label = kind === 'up' ? (chosen ? UI.stepArrowChosen(columnLabel(grid, c)) : UI.stepArrowPump(columnLabel(grid, c))) : UI.stepArrowTurbine(columnLabel(grid, c));
        const act = input.interactive ? ` data-act="step-arrow" data-col="${c}" tabindex="0" role="button" aria-label="${esc(label)}"` : '';
        s += `<g class="step-arrow${act ? ' act' : ''}"${act}><circle cx="${cx}" cy="${cy}" r="${r}" fill="${chosen ? col : STEP_BLUE}" stroke="${col}" stroke-width="1.4"/>`
          + T(cx, cy + 4, (kind === 'up' ? '▲' : '▼') + (numbered ? String(nextPair) : ''), { size: numbered ? 9 : 11, color: chosen ? '#fff' : col }) + '</g>';
      }
    }
  }

  // ---- column labels
  grid.columns.forEach((label, c) => { s += T(x(c) + cell / 2, H * cell + 14 + plan.offset, label, { w: 600, size: Math.min(10.5, fs + 1), color: soft }); });

  // ---- slot clues: one band under the hours, aligned on the columns (see bandPlan)
  const bandY = H * cell + 20;
  for (const it of plan.items) {
    const cl = grid.clues[it.index]!;
    const st = statusOf(it.index);
    if (cl.type === 'price') {
      const py = bandY + it.top + 3;
      s += `<g class="tag">${pill(it.mid, py, it.w, A ? fill(cl.piece) : '#fff', A ? null : ink, (tc) => T(tc, py + 12.5, it.label), st)}</g>`;
    } else if (cl.type === 'column' && it.rec) {
      // Bare chips centred on the slot; the state mark on the group's top right corner.
      const rec = it.rec;
      const py = bandY + it.top + 3;
      const px = Math.min(Math.max(it.mid - rec.w / 2, minX), Math.max(minX, maxX - rec.w));
      s += `<g class="tag record-chips">${rec.chips.map((e) => {
        const p = e.key.startsWith('I:') ? 'I' : e.key;
        const ex = px + e.dx;
        const ey = py + e.dy;
        return `<rect x="${ex}" y="${ey + 2.5}" width="${e.w}" height="13" rx="4" fill="${fill(p)}"/>` + T(ex + e.w / 2, ey + 12.5, String(e.value), { size: 9 });
      }).join('')}${clueMark(Math.min(px + rec.w - 2, maxX - 4), py + 1, st)}</g>`;
    } else if (cl.type === 'column' && it.marker) {
      // Record marker: the record icon in a small pill, its mark on the corner; a slot-high hit area
      // around it (inside the band, clear of the grid) takes the tap.
      const py = bandY + it.top + 3;
      const px = Math.min(Math.max(it.mid - it.w / 2, minX), Math.max(minX, maxX - it.w));
      const act = input.interactive
        ? ` data-act="record-jump" data-col="${cl.col}" data-clue="${it.index}" tabindex="0" role="button" aria-label="${esc(UI.recordJump(columnLabel(grid, cl.col)))}"` : '';
      s += `<g class="tag record-marker${act ? ' act' : ''}"${act}>`
        + `<rect class="hit" x="${px - 2}" y="${py - 4}" width="${it.w + 4}" height="26" fill="transparent"/>`
        + pill(it.mid, py, it.w, '#fff', '#d9cbd3', (tc) => `<g transform="translate(${tc - 6} ${py + 3}) scale(.6)" fill="none" stroke="${ink}" stroke-width="2.2" stroke-linecap="round">${ICONS.rel}</g>`, st)
        + '</g>';
    } else if (cl.type === 'column') {
      const entries = Object.entries(cl.counts);
      const py = bandY + it.top + 3;
      const narrow = cell < 44;
      const inner = (_tc: number, left: number) => entries.map(([k, v], j) => {
        const bx = left + (narrow ? 7 : 9) + j * 20;
        const p = k.startsWith('I:') ? 'I' : k;
        return `<rect x="${bx - 4}" y="${py + 5}" width="8" height="8" rx="${A ? 2.5 : 0}" fill="${fill(p)}"${A ? '' : ` stroke="${ink}" stroke-width=".8"`}/>`
          + T(bx + 9, py + 12.5, String(v));
      }).join('');
      s += `<g class="tag">${pill(it.mid, py, it.w, '#fff', A ? '#d9cbd3' : ink, inner, st)}</g>`;
    } else if (cl.type === 'bar' && it.range) {
      // Paper: a thin bar right under the grid on the programme's range; its name sits in the band.
      const [r1, r2] = it.range;
      s += `<rect x="${r1}" y="${H * cell + barTop(style)}" width="${r2 - r1}" height="4" rx="2" fill="${ink}"/>`;
      const py = bandY + it.top + 3;
      s += pill(it.mid, py, it.w, '#fff', ink, (tc) => T(tc, py + 12.5, it.label), st);
    }
  }
  // Screen: one coloured line per programme on its range, packed on lanes; the mark on its right end.
  for (const l of plan.lines) {
    const cl = grid.clues[l.index]!;
    if (cl.type !== 'bar') continue;
    const [r1, r2] = l.range;
    const ly = H * cell + barTop(style) + l.lane * LINE_PITCH;
    s += `<rect class="programme" x="${r1}" y="${ly}" width="${r2 - r1}" height="4" rx="2" fill="${PIECE_COLORS[cl.piece as PieceId].ink}"/>`
      + clueMark(r2, ly + 2, statusOf(l.index));
  }

  // ---- neighbors: one row of cells per country under the grid (its id in the gutter), then STEP on paper
  const locked = lockedExports(grid);
  const flowClue = (country: string, c: number) => grid.clues.findIndex((cl) => cl.type === 'flow' && cl.country === country && cl.col === c);
  const focus = input.interactive ? ' tabindex="0" role="button"' : '';
  const baseY = H * cell + 24 + geo.bandHeight;
  const rowH = exportCellHeight(cell);
  const pitch = rowH + 24;
  const cgap = 3;
  grid.neighbors.forEach((nb, k) => {
    const ry = baseY + k * pitch;
    // The CO2 of an import line shows only when that import is possible today.
    const importable = grid.co2_cap !== null && bookEntries(grid).some((e) => e.key === `I:${nb.id}`);
    const long = `${UI.neighborLine(nb.name, nb.cap)}${importable ? ` · ${UI.co2PerCell(nb.co2)}` : ''}`;
    s += T(X0 - 5, ry + rowH / 2 + 3.5, nb.id, { anchor: 'end', w: 800, size: 9.5, color: soft });
    // Screen: the day's exchanges with this neighbor under the first block ("→ 1/2  ← 0/2"; a laid
    // or published flow counts), green once met, red beyond, grey when none is allowed; then the caption.
    const capY = ry + rowH + 13;
    let capX = X0 + cgap / 2;
    if (A) {
      const flows: [string, number | null, number][] = [
        ['→', allowedExchange(grid, nb.id, 'exports'), totalExports(state, nb.id)],
        ['←', allowedExchange(grid, nb.id, 'imports'), totalImports(state, nb.id)],
      ];
      for (const [arrow, want, got] of flows) {
        if (want === null) continue;
        const t = UI.exchangeCount(arrow, got, want);
        const color = got > want ? BAD : want > 0 && got === want ? OK : soft;
        s += T(capX, capY, t, { anchor: 'start', w: 800, size: 9, color });
        capX += t.length * 5.4 + 8;
      }
    }
    // The long caption only where it fits beside the counts, else the neighbor's name alone.
    const cap = W >= 240 && capX - X0 + long.length * 4.9 <= W ? long : nb.name;
    s += T(capX, capY, cap, { anchor: 'start', w: 700, size: 9, color: soft });
    for (let c = 0; c < n; c++) {
      const px = x(c) + cgap / 2;
      const w = cell - cgap;
      const yy = ry;
      const fi = flowClue(nb.id, c);
      const flow = fi >= 0 ? grid.clues[fi] : undefined;
      if (!A) {
        s += `<rect x="${px}" y="${yy}" width="${w}" height="${rowH}" fill="#fff" stroke="${ink}" stroke-width=".8"/>`;
        if (flow && flow.type === 'flow') {
          s += T(px + w / 2, yy + rowH / 2 + 3.5, flow.dir === 'export' ? `→${flow.value}` : `←${flow.value}`, { size: 8.5 });
        }
        continue;
      }
      const e = exportsAt(state, nb.id, c);
      const im = importsAt(state, nb.id, c);
      const isLocked = locked.has(`${nb.id}:${c}`);
      const st = fi >= 0 ? statusOf(fi) : null;
      const text = e && im ? `→${e} ←${im}` : e ? `→${e}` : im ? `←${im}` : flow && flow.type === 'flow' && flow.dir === 'import' && flow.value ? `←${flow.value}` : '';
      const aria = isLocked ? UI.exportLocked(nb.name, columnLabel(grid, c)) : UI.exportLabel(nb.name, columnLabel(grid, c), e, im);
      const act = !input.interactive ? '' : ` data-act="${isLocked ? 'locked' : 'export'}" data-country="${esc(nb.id)}" data-col="${c}"${focus}`;
      s += `<g class="pill${act ? ' act' : ''}${isLocked ? ' locked' : ''}"${act} aria-label="${esc(aria)}">`;
      if (!e && !im) {
        const pending = flow && flow.type === 'flow' && flow.dir === 'import' && flow.value > 0;
        s += `<rect x="${px}" y="${yy}" width="${w}" height="${rowH}" rx="${rad}" fill="#fbf7f9" stroke="${pending ? PIECE_COLORS.I.ink : '#dccfd7'}" stroke-width="1.2" stroke-dasharray="3 3"/>`
          + (text ? T(px + w / 2, yy + rowH / 2 + 3.5, text, { w: 700, size: 9, color: ink }) : '');
      } else {
        s += `<rect x="${px}" y="${yy}" width="${w}" height="${rowH}" rx="${rad}" fill="${PIECE_COLORS.I.a}" stroke="${fi >= 0 ? ink : PIECE_COLORS.I.ink}" stroke-width="${fi >= 0 ? 1.5 : 1.2}"/>`
          + T(px + w / 2 + (isLocked ? 5 : 0), yy + rowH / 2 + 3.5, text, { size: 9 });
      }
      // A published export is fixed: padlock inside its cell. A published import only outlines
      // the cell (the player still exports there freely).
      if (isLocked) {
        s += `<g transform="translate(${px + 3} ${yy + (rowH - 12) / 2}) scale(.5)" fill="none" stroke="${ink}" stroke-width="2.4" stroke-linecap="round">${ICONS.lock}</g>`;
      }
      if (fi >= 0) s += clueMark(px + w - 2, yy + 1, st);
      s += '</g>';
    }
  });
  if (grid.step && !A) {
    const ry = baseY + grid.neighbors.length * pitch;
    if (X0) s += T(X0 - 5, ry + rowH / 2 + 3.5, '▲▼', { anchor: 'end', w: 800, size: 9, color: soft });
    s += T(X0, ry + rowH + 13, maxStepPairs(grid) > 1 ? UI.stepLineNumbered : UI.stepLine, { anchor: 'start', w: 700, size: 9, color: soft });
    for (let c = 0; c < n; c++) {
      s += `<rect x="${x(c) + cgap / 2}" y="${ry}" width="${cell - cgap}" height="${rowH}" fill="#fff" stroke="${ink}" stroke-width=".8"/>`;
    }
  }

  const vb = `-2 ${-geo.topPad} ${geo.width} ${geo.height}`;
  return {
    svg: `<svg class="board-svg" data-cell="${cell}" data-lead="${geo.lead}" data-rows="${H}" data-top="${geo.topPad}" width="${geo.width}" height="${geo.height}" viewBox="${vb}" xmlns="http://www.w3.org/2000/svg">${s}</svg>`,
    geo,
  };
}
