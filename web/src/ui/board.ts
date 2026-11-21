/*
 * SVG board: the silhouette, weather, exports, STEP, laid pieces and the clues drawn on the grid.
 * - Style A (screen): rounded pastel cells; style B (paper): square cells, black silhouette
 *   contour, empty except what is imposed (weather, engaged plants), boxes to write exchanges in.
 * - boardGeometry() is pure (sizes, rows, hit-testing); renderBoard() returns the SVG markup.
 * - Rows count from 0 at the bottom of the dispatchable part; weather cells sit below row 0.
 * - Fixed layout: the card never moves while the player exports or pumps. Rows cover the highest
 *   reach of every column; the empty reach is drawn as a faint reserve (only with a neighbor or a
 *   STEP). Price tags sit under the slot hours; each neighbor has a row of cells under the grid,
 *   headed by its id in a left gutter, and a tap on a cell exports a block in that slot.
 */
import type { Clue, Grid, PieceId } from '../model/grid';
import {
  barHeight, exportsAt, importsAt, rawSilhouette, residual, type Evaluation, type PlayState, type ClueStatus,
} from '../engine';
import { UI, columnLabel, priceTag, priceTagShort, programLabel } from '../i18n/fr';
import type { Cell, Rect } from './gesture';
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

interface Lane { col: number; len: number; lane: number; clue: Clue; index: number }

/** Programme brackets, each on the first lane where it does not overlap another. */
function programLanes(grid: Grid): Lane[] {
  const lanes: Lane[] = [];
  grid.clues.forEach((clue, index) => {
    if (clue.type !== 'bar') return;
    let lane = 0;
    while (lanes.some((l) => l.lane === lane && l.col < clue.col + clue.len && clue.col < l.col + l.len)) lane++;
    lanes.push({ col: clue.col, len: clue.len, lane, clue, index });
  });
  return lanes;
}

export interface BoardGeometry {
  n: number;
  cell: number;
  /** Rows drawn (visual units, weather included). */
  rows: number;
  /** Weather cells per column (below row 0). */
  weather: number[];
  topPad: number;
  botPad: number;
  width: number;
  height: number;
  programRows: number;
  /** Bottom rows: one export row per neighbor, plus STEP on paper when the grid has one. */
  bottomRows: number;
  /** Width of the left gutter holding the neighbor ids of the export rows (0 without neighbors). */
  lead: number;
  /** Highest cell count of each column (weather included): demand plus every export and pumping it may take. */
  reach: number[];
  /** 1 when the grid has price tags (a fixed row under the hours), else 0. */
  priceRows: number;
}

/** Width of the left gutter of the export rows: the neighbor id ("DE") stands there. */
export const BOARD_LEAD = 22;
export const boardLead = (grid: Grid): number => (grid.neighbors.length ? BOARD_LEAD : 0);
/** Height of one export cell (a touch target), and the pitch of one neighbor row (cells plus its caption). */
export const exportCellHeight = (cell: number): number => Math.max(24, Math.round(cell * 0.55));
const neighborPitch = (cell: number): number => exportCellHeight(cell) + 24;
const PRICE_ROW = 24;

/** Number of tags stacked above each column (records, STEP pairs on screen); prices sit under the hours. */
function tagsPerColumn(grid: Grid, style: BoardStyle): number[] {
  const t = grid.columns.map(() => 0);
  for (const cl of grid.clues) if (cl.type === 'column') t[cl.col]! += 1;
  // One slot per column for the STEP arrows and pair tags, so the board never jumps when the mode opens.
  if (style === 'A' && grid.step) for (let c = 0; c < t.length; c++) t[c]! += 1;
  return t;
}

/**
 * Board sizes. The row count covers the highest the silhouette can go (exports up to the line
 * capacity, STEP pairs), so the rows under the grid never move while the player exports.
 */
export function boardGeometry(grid: Grid, style: BoardStyle, cell: number): BoardGeometry {
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
  const programRows = programLanes(grid).reduce((m, l) => Math.max(m, l.lane + 1), 0);
  const priceRows = grid.clues.some((c) => c.type === 'price') ? 1 : 0;
  // Export rows (one per neighbor); STEP: chosen from the order book on screen, a row of boxes on paper.
  const bottomRows = grid.neighbors.length + (grid.step && style === 'B' ? 1 : 0);
  const lead = boardLead(grid);
  const botPad = 20 + priceRows * PRICE_ROW + programRows * 26 + bottomRows * neighborPitch(cell) + 4;
  return {
    n, cell, rows, weather, topPad, botPad, width: lead + n * cell + 4, height: rows * cell + topPad + botPad,
    programRows, bottomRows, lead, reach: colMax, priceRows,
  };
}

/** Cell under a point given in SVG user units (x from 0, y from the top of the rows). */
export function cellAt(geo: BoardGeometry, x: number, y: number): Cell | null {
  if (x < geo.lead || y < 0) return null;
  const col = Math.floor((x - geo.lead) / geo.cell);
  const v = geo.rows - 1 - Math.floor(y / geo.cell);
  if (col >= geo.n || v < 0) return null;
  return { col, row: v - (geo.weather[col] ?? 0) };
}

/** Runs of contiguous columns with the same weather offset, for drawing a bar. */
function runs(geo: BoardGeometry, col: number, len: number): { col: number; len: number; off: number }[] {
  const out: { col: number; len: number; off: number }[] = [];
  for (let c = col; c < col + len; c++) {
    const off = geo.weather[c] ?? 0;
    const last = out[out.length - 1];
    if (last && last.off === off) last.len++;
    else out.push({ col: c, len: 1, off });
  }
  return out;
}

let uid = 0;

/** SVG markup of the board. */
export function renderBoard(input: BoardInput): { svg: string; geo: BoardGeometry } {
  const { grid, state, ev, style, cell } = input;
  const A = style === 'A';
  const geo = boardGeometry(grid, style, cell);
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
  if (A) {
    const fading = new Set(input.preview?.replacing ?? []);
    state.bars.forEach((b, i) => {
      if (fading.has(i)) return;
      for (let c = b.col; c < b.col + b.len; c++) for (let r = b.row; r < b.row + barHeight(b); r++) hidden.add(`${r},${c}`);
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
        if (hidden.has(`${r},${c}`)) continue;
        s += A ? `<rect x="${bx}" y="${by}" width="${w}" height="${w}" rx="${rad}" fill="#fff" stroke="#eadfe6"/>`
          : `<rect x="${bx}" y="${by}" width="${w}" height="${w}" fill="#fff" stroke="#c7d5d1" stroke-width=".8"/>`;
      } else if (kind === 'pump') {
        s += `<rect x="${bx + 1}" y="${by + 1}" width="${w - 2}" height="${w - 2}" rx="${rad}" fill="#fff" stroke="${PIECE_COLORS.B.ink}" stroke-width="1.6" stroke-dasharray="4 3"/>`;
      } else {
        // Exported block: a filled cell in the neighbor's colour.
        s += `<rect x="${bx + 1}" y="${by + 1}" width="${w - 2}" height="${w - 2}" rx="${rad}" fill="${PIECE_COLORS.I.a}" stroke="${PIECE_COLORS.I.ink}" stroke-width="1.5"/>`;
      }
    }
    // Reserve: what the column can still take (exports, pumping), a faint dashed outline, empty until something rises.
    if (A && (grid.neighbors.length > 0 || grid.step)) {
      for (let r = k + turbines[c]!; r < geo.reach[c]! - weather[c]!; r++) {
        const { bx, by, w } = box(c, weather[c]! + r);
        s += `<rect class="reserve" x="${bx}" y="${by}" width="${w}" height="${w}" rx="${rad}" fill="none" stroke="#e4d9e0" stroke-width="1.2" stroke-dasharray="3 3"/>`;
      }
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
  const drawRect = (col: number, len: number, row: number, h: number, attrs: (rx: number, ry: number, rw: number, rh: number) => string) => {
    let out = '';
    for (const run of runs(geo, col, len)) {
      const rx = x(run.col) + gap / 2;
      const ry = y(run.off + row, h) + gap / 2;
      out += attrs(rx, ry, run.len * cell - gap, h * cell - gap);
    }
    return out;
  };
  const replacing = new Set(input.preview?.replacing ?? []);
  state.bars.forEach((b, i) => {
    if (!A && !b.locked) return;
    const h = barHeight(b);
    const f = fill(b.piece);
    const gone = replacing.has(i);
    s += drawRect(b.col, b.len, b.row, h, (rx, ry, rw, rh) => `<rect x="${rx}" y="${ry}" width="${rw}" height="${rh}" rx="${rad}" fill="${f}"${A ? '' : ` stroke="${ink}" stroke-width="1.2"`}${gone ? ' fill-opacity=".3"' : ''}/>`
      + (invalid.has(i) && !gone ? `<rect x="${rx}" y="${ry}" width="${rw}" height="${rh}" rx="${rad}" fill="url(#hX${id})" stroke="${BAD}" stroke-width="2"/>` : '')
      + (gone ? `<rect class="replacing" x="${rx + 1}" y="${ry + 1}" width="${rw - 2}" height="${rh - 2}" rx="${rad}" fill="${BAD}" fill-opacity=".12" stroke="${BAD}" stroke-opacity=".45" stroke-width="1.4" stroke-dasharray="3 3"/>` : ''));
    const last = runs(geo, b.col, b.len).slice(-1)[0]!;
    const first = runs(geo, b.col, b.len)[0]!;
    if (b.locked) {
      const lx = x(last.col + last.len) - gap / 2 - cell * 0.32;
      const ly = y(last.off + b.row, h) + gap / 2 + cell * 0.07;
      s += `<g transform="translate(${lx} ${ly}) scale(${(cell * 0.0115).toFixed(3)})" fill="none" stroke="${ink}" stroke-width="2" stroke-linecap="round">${ICONS.lock}</g>`;
    }
    const label = b.piece === 'I' ? b.country ?? '' : h > 1 ? `${h} GW` : '';
    if (label) {
      const cx = x(first.col) + (first.len * cell) / 2;
      const cy = y(first.off + b.row, h) + (h * cell) / 2 + cell * 0.08;
      s += T(cx, cy, label, { size: cell * 0.22, op: b.piece === 'I' ? 0.8 : 0.55 });
    }
  });

  // ---- preview, anchor, keyboard cursor
  const pv = input.preview;
  if (pv) {
    const col = pv.valid ? OK : BAD;
    const f = fill(pv.piece);
    s += drawRect(pv.rect.col, pv.rect.len, pv.rect.row, pv.rect.height, (rx, ry, rw, rh) => `<rect class="preview" x="${rx + 1.5}" y="${ry + 1.5}" width="${Math.max(0, rw - 3)}" height="${Math.max(0, rh - 3)}" rx="${rad}" fill="${f}" fill-opacity=".5" stroke="${col}" stroke-width="2" stroke-dasharray="5 3"/>`);
  }
  const ring = (c: Cell, color: string, dash: string) => {
    if (c.col < 0 || c.col >= n) return '';
    const { bx, by, w } = box(c.col, weather[c.col]! + c.row);
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

  // ---- tags above the columns: record, STEP (prices are drawn under the hours)
  // Tags sit above the highest reach of their column: fixed, whatever the player has laid.
  const stack = grid.columns.map(() => 0);
  const topOf = (c: number) => (A ? geo.reach[c]! : H);
  const tagY = (c: number) => y(topOf(c) - 1) - 24 - stack[c]!++ * 22;
  // A pill centred on `mid`, kept inside the board; a verified pill grows by 10 to hold its tick.
  // `content(textCentre, left)` draws what is inside.
  const W = n * cell;
  const minX = X0;
  const maxX = X0 + W;
  // On narrow cells the tick sits on the pill's corner instead, so the pill keeps within its column.
  const pill = (mid: number, py: number, w: number, bg: string, stroke: string | null,
    content: (tc: number, left: number) => string, st: ClueStatus | null) => {
    const corner = st === 'ok' && w + 10 > cell - 2;
    const tot = w + (st === 'ok' && !corner ? 10 : 0);
    const px = Math.min(Math.max(mid - tot / 2, minX), Math.max(minX, maxX - tot));
    let o = `<rect x="${px}" y="${py}" width="${tot}" height="18" rx="9" fill="${bg}"${stroke ? ` stroke="${stroke}"` : ''}/>${content(px + w / 2, px)}`;
    if (st === 'ok') {
      const kx = corner ? Math.min(px + tot - 2, maxX - 4) : px + tot - 7;
      const ky = corner ? py + 1 : py + 9;
      if (corner) o += `<circle cx="${kx}" cy="${ky}" r="6.2" fill="#fff"/>`;
      o += `<circle cx="${kx}" cy="${ky}" r="5" fill="${OK}"/><path d="M${kx - 2.4} ${ky} l1.7 1.7 l2.9 -3.3" stroke="#fff" stroke-width="1.4" fill="none"/>`;
    }
    if (st === 'broken') o += `<rect x="${px - 1.5}" y="${py - 1.5}" width="${tot + 3}" height="21" rx="10.5" fill="none" stroke="${BAD}" stroke-width="2"/>`;
    return o;
  };
  grid.clues.forEach((cl, i) => {
    if (cl.type !== 'column') return;
    const entries = Object.entries(cl.counts);
    const ty = tagY(cl.col);
    // Tighter side padding on narrow cells, so a one-plant record fits its column.
    const narrow = cell < 44;
    const w = (narrow ? 12 : 16) + entries.length * 20;
    const inner = (_tc: number, left: number) => entries.map(([k, v], j) => {
      const bx = left + (narrow ? 7 : 9) + j * 20;
      const p = k.startsWith('I:') ? 'I' : k;
      return `<rect x="${bx - 4}" y="${ty + 5}" width="8" height="8" rx="${A ? 2.5 : 0}" fill="${fill(p)}"${A ? '' : ` stroke="${ink}" stroke-width=".8"`}/>`
        + T(bx + 9, ty + 12.5, String(v));
    }).join('');
    s += `<g class="tag">${pill(x(cl.col) + cell / 2, ty, w, '#fff', A ? '#d9cbd3' : ink, inner, statusOf(i))}</g>`;
  });
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
      const pump = pumps[c]! > 0;
      const full = cell >= 48;
      const labels = stepTagLabels(state.step, c, numbered);
      // The word ("pompe" / "turbine") only goes on a lone icon; several icons in one tag are joined.
      const word = pump ? UI.stepPumpWord : UI.stepTurbineWord;
      const label = labels.length === 1 && full ? `${labels[0]} ${word}` : labels.join('');
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
  grid.columns.forEach((label, c) => { s += T(x(c) + cell / 2, H * cell + 14, label, { w: 600, size: Math.min(10.5, fs + 1), color: soft }); });

  // ---- price tags: under the hour of their slot, a fixed row that shows nothing of the column's height
  grid.clues.forEach((cl, i) => {
    if (cl.type !== 'price') return;
    const ty = H * cell + 21;
    const label = A ? priceTag(cl.piece) : priceTagShort(cl.piece);
    const w = Math.max(cell - 6, label.length * 5.6 + 10);
    s += `<g class="tag">${pill(x(cl.col) + cell / 2, ty, w, A ? fill(cl.piece) : '#fff', A ? null : ink, (tc) => T(tc, ty + 12.5, label), statusOf(i))}</g>`;
  });

  // ---- programme brackets
  for (const l of programLanes(grid)) {
    if (l.clue.type !== 'bar') continue;
    const piece = l.clue.piece as PieceId;
    const by = H * cell + 26 + geo.priceRows * PRICE_ROW + l.lane * 26;
    const x1 = x(l.col) + 6;
    const x2 = x(l.col + l.len) - 6;
    const mid = (x1 + x2) / 2;
    const st = statusOf(l.index);
    const color = A ? PIECE_COLORS[piece].ink : ink;
    s += `<path d="M${x1} ${by - 5} V${by} H${x2} V${by - 5}" fill="none" stroke="${st === 'broken' ? BAD : color}" stroke-width="2" stroke-linecap="round"/>`;
    const label = programLabel(grid, piece, l.col, l.len);
    const tw = label.length * 5.3 + 18;
    s += pill(mid, by + 3, tw, A ? fill(piece) : '#fff', A ? null : ink, (tc) => T(tc, by + 15.5, label), st);
  }

  // ---- neighbors: one row of cells per country under the grid (its id in the gutter), then STEP on paper
  const locked = lockedExports(grid);
  const flowClue = (country: string, c: number) => grid.clues.findIndex((cl) => cl.type === 'flow' && cl.country === country && cl.col === c);
  const focus = input.interactive ? ' tabindex="0" role="button"' : '';
  const baseY = H * cell + 22 + geo.priceRows * PRICE_ROW + geo.programRows * 26;
  const rowH = exportCellHeight(cell);
  const pitch = rowH + 24;
  const cgap = 3;
  grid.neighbors.forEach((nb, k) => {
    const ry = baseY + k * pitch;
    const cap = W < 240 ? nb.name : `${UI.neighborLine(nb.name, nb.cap)}${grid.co2_cap !== null ? ` · ${UI.co2PerCell(nb.co2)}` : ''}`;
    s += T(X0 - 5, ry + rowH / 2 + 3.5, nb.id, { anchor: 'end', w: 800, size: 9.5, color: soft });
    s += T(X0, ry + rowH + 13, cap, { anchor: 'start', w: 700, size: 9, color: soft });
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
      if (fi >= 0 && st === 'broken') s += `<rect x="${px - 1.5}" y="${yy - 1.5}" width="${w + 3}" height="${rowH + 3}" rx="${rad + 1}" fill="none" stroke="${BAD}" stroke-width="2"/>`;
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
    svg: `<svg class="board-svg" data-cell="${cell}" data-rows="${H}" data-top="${geo.topPad}" width="${geo.width}" height="${geo.height}" viewBox="${vb}" xmlns="http://www.w3.org/2000/svg">${s}</svg>`,
    geo,
  };
}
