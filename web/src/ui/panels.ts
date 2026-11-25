/*
 * Side panels as HTML strings: order book (exact inventory) or available plants (no inventory),
 * clue list with status, CO2 gauge, and the clue text styling (plant chips, slot values).
 * - Screen book: one glyph per width with the width written in it and a "laid / allowed" counter per
 *   width; optional heights are dashed rows above the filled first row, optional widths a dashed tail.
 * - Paper (style B): every bar drawn, shape hints under the names, no usage.
 */
import { ANY_COUNTRY, IMPORT_PIECE, PIECE_IDS, mergeExchanges, publishedStepPairs, type Clue, type ExchangesClue, type Grid, type PieceId } from '../model/grid';
import {
  clueText, co2PerCell, pieceCells, totalExports, totalImports, type ClueReport, type ClueStatus, type PlayState,
} from '../engine';
import { CLUE_KIND, PIECE_WORDS, UI, countryFrom, exchangeLineText, pieceHint } from '../i18n/fr';
import { CLUE_ICON, PIECE_COLORS, colorKey, esc, icon } from './palette';
import { cellCount, isRamp, profile, shapeKind, type ShapeKind } from '../model/shapes';

/** A selectable entry of the book: a plant id, or `I:<country>` for imports. */
export type PieceKey = string;

export interface BookEntry {
  key: PieceKey;
  piece: string;
  country?: string;
  lens: number[];
  heights: number[];
  /** Rectangle, or a coal ramp laid by its base row. */
  shape: ShapeKind;
}

/** Book entry of the STEP (pumped storage): chosen like a plant, laid as pump then turbine. */
export const STEP_KEY = 'STEP';

export { publishedStepPairs } from '../model/grid';

/** True when no block can come from `country` today: a line without capacity, or a published zero total. */
function importRuledOut(grid: Grid, country: string): boolean {
  if ((grid.neighbors.find((nb) => nb.id === country)?.cap ?? 0) <= 0) return true;
  const imports = mergeExchanges(grid.clues)?.imports;
  return imports !== undefined && (imports[ANY_COUNTRY] === 0 || imports[country] === 0);
}

/** Plants, import lines and the STEP the player can lay, in merit order (no import line when none is possible). */
export function bookEntries(grid: Grid): BookEntry[] {
  const out: BookEntry[] = [];
  for (const id of PIECE_IDS) {
    const def = grid.pieces[id];
    if (!def || grid.inventory.pieces[id] === undefined) continue;
    out.push({ key: id, piece: id, lens: def.len, heights: def.height ?? [1], shape: shapeKind(def) });
  }
  const inv = grid.inventory;
  for (const nb of grid.neighbors) {
    if (inv.level === 'exact') {
      const own = inv.imports?.[nb.id];
      const any = inv.imports?.[ANY_COUNTRY];
      if (!(own && own > 0) && !(own === undefined && any && any > 0)) continue;
    } else if (importRuledOut(grid, nb.id)) continue;
    out.push({ key: `I:${nb.id}`, piece: IMPORT_PIECE, country: nb.id, lens: [1], heights: [1], shape: 'rect' });
  }
  if (grid.step) out.push({ key: STEP_KEY, piece: STEP_KEY, lens: [1], heights: [1], shape: 'rect' });
  return out;
}

/**
 * Mini piece at scale: `w` x `h` cells, dashed from column `dashFrom`; a ramp (`shape`) draws its
 * profile on two rows, the cells outside it left blank.
 */
function mb(p: string, w: number, h: number, o: { used?: boolean; dashFrom?: number; dashTo?: number; dashTop?: number; paper?: boolean; label?: string; shape?: ShapeKind; width?: string } = {}): string {
  const c = PIECE_COLORS[colorKey(p)];
  const prof = profile(o.shape ?? 'rect', w, h);
  const rows = Math.max(...prof.map(([b, k]) => b + k));
  const cells = Array.from({ length: w * rows }, (_, i) => {
    const col = i % w;
    const row = rows - 1 - Math.floor(i / w);
    const [b, k] = prof[col] ?? [0, 0];
    if (row < b || row >= b + k) return '<i class="e"></i>';
    const dashed = (o.dashFrom !== undefined && col >= o.dashFrom && col < (o.dashTo ?? Infinity)) || (o.dashTop !== undefined && row >= o.dashTop);
    return `<i class="${dashed ? 'd' : ''}" style="background:${o.paper ? c.b : c.a};--c:${c.ink}"></i>`;
  }).join('');
  // The width, written over the bottom row (screen).
  const width = o.width ? `<em class="mb-w">${esc(o.width)}</em>` : '';
  return `<span class="mb${o.used ? ' used' : ''}" style="grid-template-columns:repeat(${w},auto)"${o.label ? ` title="${esc(o.label)}"` : ''}>${cells}${width}</span>`;
}

/** Width written in a glyph: "4", "3–6" for a range; none for a one-cell piece. */
const widthLabel = (min: number, max = min): string | undefined => (max <= 1 ? undefined : min === max ? String(min) : `${min}–${max}`);

/** One glyph and its own "laid / allowed" counter (screen book). */
function group(glyph: string, laid: number, allowed: number | null): string {
  const over = allowed !== null && laid > allowed;
  const done = allowed !== null && laid === allowed;
  return `<span class="grp${done ? ' done' : ''}">${glyph}<span class="gcount${over ? ' over' : ''}">${esc(UI.count(Math.min(laid, 99), allowed))}</span></span>`;
}

const name = (e: BookEntry) => (e.piece === STEP_KEY ? UI.stepName
  : e.piece === IMPORT_PIECE ? UI.importName : PIECE_WORDS[e.piece as PieceId].name);

function importCells(state: PlayState, country: string): number {
  return state.bars.filter((b) => b.piece === IMPORT_PIECE && b.country === country).reduce((a, b) => a + b.len * (b.height ?? 1), 0);
}

/**
 * Allowed shapes as mini pieces: a dashed tail for a range of widths, one piece per width otherwise.
 * Screen: a trapezoid ramp of contiguous widths is one glyph (smallest ramp solid, added middle columns dashed).
 * Screen: optional heights are dashed rows on the same piece, which carries its width ("3–6" for a range).
 * Paper: one more piece per extra height.
 */
function shapeGlyphs(e: BookEntry, paper: boolean): string {
  const id = e.piece;
  const minL = e.lens[0] ?? 1;
  const maxL = e.lens[e.lens.length - 1] ?? minL;
  const minH = e.heights[0] ?? 1;
  const ramp = isRamp(e.shape);
  const gaps = e.lens.length !== maxL - minL + 1;
  if (!paper) {
    const maxH = ramp ? 1 : e.heights[e.heights.length - 1] ?? minH;
    const dashTop = maxH > minH ? minH : undefined;
    // A trapezoid ramp of contiguous widths: one glyph at the widest scale, the smallest ramp in colour,
    // the columns added in the middle dashed.
    if (e.shape === 'trap' && !gaps && maxL > minL) {
      return mb(id, maxL, 1, { shape: e.shape, dashFrom: minL - 1, dashTo: maxL - 1, width: widthLabel(minL, maxL) });
    }
    return ramp || gaps
      ? e.lens.map((len) => mb(id, len, ramp ? 1 : maxH, { shape: e.shape, dashTop, width: widthLabel(len) })).join('')
      : mb(id, maxL, maxH, { dashFrom: minL, dashTop, width: widthLabel(minL, maxL) });
  }
  // A ramp draws each width (a dashed tail would cut its last shoulder); so do widths with a gap.
  let out = ramp || e.lens.length !== maxL - minL + 1
    ? e.lens.map((len) => mb(id, len, ramp ? 1 : minH, { paper, shape: e.shape })).join('')
    : mb(id, maxL, minH, { dashFrom: minL, paper });
  for (const h of e.heights.slice(1)) out += mb(id, minL, h, { paper });
  return out;
}

/**
 * Order book (exact) or available plants (none). `selected` is highlighted.
 * - Screen: the glyphs carry every constraint (widths, heights, counts); counters read "laid / allowed" or "laid / ∞".
 * - Paper: shape hints under the names, no usage.
 */
export function renderBook(grid: Grid, state: PlayState, selected: PieceKey | null, paper = false): string {
  const inv = grid.inventory;
  const rows = bookEntries(grid).filter((e) => !paper || e.piece !== STEP_KEY).map((e) => {
    let hint = '';
    let glyphs = '';
    let count = '';
    let overUse = false;
    let label = name(e);
    if (e.piece === STEP_KEY) {
      const want = publishedStepPairs(grid);
      const used = state.step.length;
      glyphs = Array.from({ length: want ?? 1 }, (_, i) =>
        `<span class="step-glyph${want !== null && i < used ? ' used' : ''}" aria-hidden="true">▲▼</span>`).join('');
      count = UI.count(used, want);
      overUse = want !== null && used > want;
    } else if (e.piece === IMPORT_PIECE) {
      const country = e.country ?? '';
      const nbName = grid.neighbors.find((nb) => nb.id === country)?.name ?? country;
      if (paper) {
        hint = UI.importHint(nbName);
        if (grid.co2_cap !== null) hint += ` · ${UI.co2PerCell(grid.neighbors.find((nb) => nb.id === country)?.co2 ?? 0)}`;
      } else label = UI.importOf(countryFrom(grid, country));
      const used = importCells(state, country);
      const want = inv.level === 'exact' ? inv.imports?.[country] ?? inv.imports?.[ANY_COUNTRY] : undefined;
      if (want !== undefined && !paper) {
        glyphs = group(mb('I', 1, 1, { used: used >= want }), used, want);
      } else if (want !== undefined) {
        glyphs = Array.from({ length: want }, () => mb('I', 1, 1, { paper })).join('');
        count = UI.cells(want);
      } else {
        glyphs = mb('I', 1, 1, { paper });
        if (!paper) count = UI.count(used, null);
      }
    } else {
      const id = e.piece as PieceId;
      const spec = inv.pieces[id] ?? {};
      if (paper) {
        hint = pieceHint(id, e.lens, e.heights, spec.max_cells, e.shape);
        if (grid.co2_cap !== null && (grid.pieces[id]?.co2 ?? 0) > 0) hint += ` · ${UI.co2PerCell(grid.pieces[id]?.co2 ?? 0)}`;
      }
      const minH = e.heights[0] ?? 1;
      const used = pieceCells(grid, state, id);
      const shape = e.shape;
      if (spec.bars && !paper) {
        // One glyph per width, longest first, each with its counter; a laid width the inventory lacks shows as over.
        const maxH = isRamp(shape) ? 1 : e.heights[e.heights.length - 1] ?? minH;
        const dashTop = maxH > minH ? minH : undefined;
        const placed = new Map<number, number>();
        for (const b of state.bars) if (b.piece === id) placed.set(b.len, (placed.get(b.len) ?? 0) + 1);
        const widths = [...new Set([...spec.bars, ...placed.keys()])].sort((a, b) => b - a);
        glyphs = widths.map((len) => {
          const allowed = spec.bars!.filter((l) => l === len).length;
          const laid = placed.get(len) ?? 0;
          return group(mb(id, len, maxH, { used: allowed > 0 && laid >= allowed, shape, dashTop, width: widthLabel(len) }), laid, allowed);
        }).join('');
      } else if (spec.bars) {
        // Paper: every bar of the inventory, longest first.
        glyphs = [...spec.bars].sort((a, b) => b - a).map((len) => mb(id, len, minH, { paper, shape })).join('');
      } else if ((spec.cells !== undefined || spec.max_cells !== undefined) && !paper) {
        const total = spec.cells ?? spec.max_cells ?? 0;
        glyphs = group(mb(id, 1, 1, { used: used >= total }), used, total);
      } else if (spec.cells !== undefined || spec.max_cells !== undefined) {
        // Paper: one square per cell and the cell count.
        const total = spec.cells ?? spec.max_cells ?? 0;
        glyphs = Array.from({ length: total }, () => mb(id, 1, 1, { paper })).join('');
        count = UI.cells(total);
      } else {
        glyphs = shapeGlyphs(e, paper);
        if (!paper) count = UI.count(used, null);
      }
    }
    const sel = !paper && selected === e.key;
    const body = `<span class="pname"><b>${esc(label)}</b>${hint ? `<span>${esc(hint)}</span>` : ''}</span>`
      + `<span class="bars"><span class="glyphs">${glyphs}</span>${count ? `<span class="count${overUse ? ' over' : ''}">${esc(count)}</span>` : ''}</span>`;
    if (paper) return `<div class="prow">${body}</div>`;
    return `<button type="button" class="prow${sel ? ' sel' : ''}" data-piece="${esc(e.key)}" aria-pressed="${sel}">${body}</button>`;
  });
  return `<div class="book">${rows.join('')}</div>`;
}

/** Hours ("8h") and counts of an escaped text, highlighted as slot values. */
const slotValues = (html: string): string => html.replace(/(^|[\s(])(\d+h|\d+)(?=[\s,.)]|$)/g, (_m, pre: string, v: string) => `${pre}<span class="slot">${v}</span>`);

/** Clue text with plant chips and slot values highlighted (text itself comes from fr.ts). */
export function richClueText(grid: Grid, clue: Clue, text = clueText(grid, clue)): string {
  let html = esc(text);
  const piece = 'piece' in clue ? clue.piece : null;
  // The punctuation right after a chip stays glued to it (no lone "." on a new line).
  const chip = (p: string, label: string, punct = '') => `<span class="nw"><span class="pc" style="--dot:${PIECE_COLORS[colorKey(p)].a}">${label}</span>${punct}</span>`;
  if (piece) {
    const w = PIECE_WORDS[piece];
    for (const phrase of [w.a, w.the, w.of.replace(/^de /, ''), w.name.toLowerCase()]) {
      const re = new RegExp(`(^|[\\s'’])(${phrase.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})([,.;:]?)(?=[\\s,.]|$)`, 'i');
      if (re.test(html)) { html = html.replace(re, (_m, pre: string, word: string, punct: string) => `${pre}${chip(piece, word, punct)}`); break; }
    }
  }
  if (clue.type === 'column') {
    for (const k of Object.keys(clue.counts)) {
      if (k.startsWith('I:')) continue;
      const word = PIECE_WORDS[k as PieceId]?.of.replace(/^de /, '');
      if (!word) continue;
      html = html.replace(new RegExp(`(de |d’|d')(${word})([,.;:]?)(?=[\\s,.]|$)`), (_m, pre: string, wd: string, punct: string) => `${pre}${chip(k, wd, punct)}`);
    }
  }
  // Slot values: hours ("8h") and counts.
  return slotValues(html);
}

/** True when the clue is drawn on the grid (slot clues); day clues go to the list. */
export const isDayClue = (clue: Clue) => clue.type === 'length' || clue.type === 'exchanges' || clue.type === 'engaged';

const stateDot = (st: ClueReport['status'] | null) => (st === null ? ''
  : `<span class="state ${st === 'ok' ? 'ok' : st === 'broken' ? 'bad' : ''}" role="img" aria-label="${esc(UI.clueState[st])}"></span>`);

/** One clue list item. */
export function clueItem(grid: Grid, clue: Clue, status: ClueReport['status'] | null, paper = false, index = -1): string {
  const kind = esc(CLUE_KIND[clue.type]);
  const txt = richClueText(grid, clue);
  if (paper) return `<li class="clue"><span><span class="kind">${kind}</span><span class="txt">${txt}</span></span></li>`;
  return `<li class="clue"${index >= 0 ? ` data-clue="${index}"` : ''}><span class="ico">${icon(CLUE_ICON[clue.type] ?? 'price')}</span>`
    + `<span><span class="kind">${kind}</span><span class="txt">${txt}</span></span>${stateDot(status)}</li>`;
}

/**
 * Clues in the order of the publications card (the CO2 limit comes before them all): the day's exchanges,
 * the day clues without an hour (duration, engaged plant), the programmes by start hour, then every other
 * clue by hour. Ties keep the grid order.
 */
export function orderClues<T extends { clue: Clue }>(reports: readonly T[]): T[] {
  const col = (c: Clue) => ('col' in c && typeof c.col === 'number' ? c.col : -1);
  const rank = (c: Clue) => (c.type === 'exchanges' ? 0 : c.type === 'length' || c.type === 'engaged' ? 1 : c.type === 'bar' ? 2 : 3);
  return reports
    .map((r, i) => ({ r, i }))
    .sort((a, b) => rank(a.r.clue) - rank(b.r.clue) || (rank(a.r.clue) >= 2 ? col(a.r.clue) - col(b.r.clue) : 0) || a.i - b.i)
    .map(({ r }) => r);
}

/**
 * Day totals an exact inventory imposes (exports, imports; the STEP pairs are not published), as an "exchanges" clue:
 * they are market publications like the clues of the no-inventory grids, so they live in the clue
 * card, not in the order book. Null when the inventory imposes none, or the grid has its own clue.
 */
export function inventoryExchanges(grid: Grid): ExchangesClue | null {
  const inv = grid.inventory;
  if (inv.level !== 'exact' || grid.clues.some((c) => c.type === 'exchanges')) return null;
  const clue: ExchangesClue = { type: 'exchanges' };
  if (inv.exports && Object.keys(inv.exports).length) clue.exports = { ...inv.exports };
  if (inv.imports && Object.keys(inv.imports).length) clue.imports = { ...inv.imports };
  return clue.exports || clue.imports ? clue : null;
}

/**
 * Display lines of an exchanges clue, one per subject, each checked on its own: every country (its
 * exports and imports together), then the import total of all countries (`*`). The STEP pairs are not a publication:
 * the STEP plant shows them ("laid / N").
 */
export function exchangeLines(clue: ExchangesClue): ExchangesClue[] {
  const ids: string[] = [];
  for (const id of [...Object.keys(clue.exports ?? {}), ...Object.keys(clue.imports ?? {})]) if (!ids.includes(id)) ids.push(id);
  ids.sort((a, b) => Number(a === ANY_COUNTRY) - Number(b === ANY_COUNTRY));
  const lines = ids.map((id) => {
    const line: ExchangesClue = { type: 'exchanges' };
    if (clue.exports?.[id] !== undefined) line.exports = { [id]: clue.exports[id] };
    if (clue.imports?.[id] !== undefined) line.imports = { [id]: clue.imports[id] };
    return line;
  });
  return lines;
}

/** Number of clues the clue card lists: the grid's own (an exchanges clue by its lines), the exchanges lines of an exact inventory, the CO2 limit. */
export function shownClueCount(grid: Grid): number {
  const merged = mergeExchanges(grid.clues) ?? inventoryExchanges(grid);
  return grid.clues.filter((c) => c.type !== 'exchanges').length + (merged ? exchangeLines(merged).length : 0)
    + (typeof grid.co2_cap === 'number' ? 1 : 0);
}

/** Status of an exchanges clue on a board: every total met (ok), one exceeded (broken), else open. */
function exchangesStatus(state: PlayState, clue: ExchangesClue): ClueStatus {
  const st: ClueStatus[] = [];
  const count = (got: number, want: number): ClueStatus => (got > want ? 'broken' : got === want ? 'ok' : 'open');
  for (const [k, v] of Object.entries(clue.exports ?? {})) st.push(count(totalExports(state, k), v));
  for (const [k, v] of Object.entries(clue.imports ?? {})) st.push(count(totalImports(state, k), v));
  return st.includes('broken') ? 'broken' : st.includes('open') ? 'open' : 'ok';
}

/** The clue reports of the board plus the exchanges line of an exact inventory (a day clue, so listed first). */
export function withInventoryExchanges(grid: Grid, state: PlayState, reports: readonly ClueReport[]): ClueReport[] {
  const clue = inventoryExchanges(grid);
  if (!clue) return [...reports];
  return [...reports, { clue, text: clueText(grid, clue), status: exchangesStatus(state, clue) }];
}

/**
 * Clue reports with the exchanges clues (a grid may publish several) merged into one publication,
 * split into its display lines (one per country, then the all-country totals), each with its own status.
 * The lines sit where the first exchanges clue was.
 */
export function splitExchanges(grid: Grid, state: PlayState, reports: readonly ClueReport[]): ClueReport[] {
  const merged = mergeExchanges(reports.map((r) => r.clue));
  const lines = merged ? exchangeLines(merged).map((line) => ({ clue: line, text: exchangeLineText(grid, line), status: exchangesStatus(state, line) })) : [];
  const first = reports.findIndex((r) => r.clue.type === 'exchanges');
  const out: ClueReport[] = [];
  reports.forEach((r, i) => {
    if (i === first) out.push(...lines);
    if (r.clue.type !== 'exchanges') out.push(r);
  });
  return out;
}

/** CO2 points of the board, by plant ('I' for every import). */
function co2Parts(grid: Grid, state: PlayState): Map<string, number> {
  const parts = new Map<string, number>();
  for (const b of state.bars) {
    const k = b.piece === IMPORT_PIECE ? 'I' : b.piece;
    parts.set(k, (parts.get(k) ?? 0) + co2PerCell(grid, b) * cellCount(grid, b));
  }
  return parts;
}

/** A plant name inside a sentence: lower case, acronyms (TAC) kept. */
const inText = (n: string) => (n === n.toUpperCase() ? n : n.toLowerCase());

/** Points per cell of every emitting plant and import line, in merit order: "charbon 3, TAC 2, import d’Allemagne 3". */
function co2PerCellText(grid: Grid): string {
  const byPoints = (a: { co2: number }, b: { co2: number }) => b.co2 - a.co2;
  const plants = PIECE_IDS.map((id) => ({ id, co2: grid.pieces[id]?.co2 ?? 0 })).filter((p) => p.co2 > 0).sort(byPoints)
    .map((p) => `${inText(PIECE_WORDS[p.id].name)} ${p.co2}`);
  const imports = grid.neighbors.filter((nb) => nb.co2 > 0).sort(byPoints)
    .map((nb) => `${UI.importWord} ${countryFrom(grid, nb.id)} ${nb.co2}`);
  return [...plants, ...imports].join(', ');
}

/**
 * CO2 limit as a market publication, generated from `co2_cap` (null without a cap):
 * contradicted once the cap is exceeded, checked when the board is full under the cap.
 */
export function co2ClueItem(grid: Grid, state: PlayState, full: boolean): { html: string; status: ClueStatus } | null {
  const cap = grid.co2_cap;
  if (cap === null) return null;
  const total = [...co2Parts(grid, state).values()].reduce((a, b) => a + b, 0);
  const status: ClueStatus = total > cap ? 'broken' : full ? 'ok' : 'open';
  const txt = esc(UI.co2Clue(cap)).replace(/(^|\s)(\d+)(?=[\s,.]|$)/g, '$1<span class="slot">$2</span>');
  const html = `<li class="clue"><span class="ico">${icon('co2')}</span>`
    + `<span><span class="kind">${esc(UI.co2ClueKind)}</span><span class="txt">${txt}</span></span>${stateDot(status)}</li>`;
  return { html, status };
}

/** The day's exchanges as one publication: a line per country, each with its own status. */
function exchangesItem(lines: readonly ClueReport[]): string {
  const rows = lines.map((r) => `<span class="xline"><span class="txt">${slotValues(esc(r.text))}</span>${stateDot(r.status)}</span>`).join('');
  return `<li class="clue clue-exchanges"><span class="ico">${icon(CLUE_ICON.exchanges ?? 'price')}</span>`
    + `<span class="xlines"><span class="kind">${esc(CLUE_KIND.exchanges)}</span>${rows}</span></li>`;
}

/** Clue card: the CO2 limit and every clue in text, day clues first, then slot clues in time order. `full`: no cell left to cover. */
export function renderClues(grid: Grid, boardReports: readonly ClueReport[], state: PlayState, full = false): string {
  const reports = splitExchanges(grid, state, withInventoryExchanges(grid, state, boardReports));
  const co2 = co2ClueItem(grid, state, full);
  if (!reports.length && !co2) return '';
  const ok = reports.filter((r) => r.status === 'ok').length + (co2?.status === 'ok' ? 1 : 0);
  const n = reports.length + (co2 ? 1 : 0);
  const title = UI.cluesTitle;
  const exch = reports.filter((r) => r.clue.type === 'exchanges');
  let grouped = false;
  const items = orderClues(reports).map((r) => {
    if (r.clue.type !== 'exchanges') return clueItem(grid, r.clue, r.status, false, grid.clues.indexOf(r.clue));
    if (grouped) return '';
    grouped = true;
    return exchangesItem(exch);
  }).join('');
  const list = `<ul class="clues">${co2?.html ?? ''}${items}</ul>`;
  return `<section class="card" aria-label="${esc(title)}"><h2 class="ct">${esc(title)} <small>${esc(UI.cluesChecked(ok, n))}</small></h2>${list}</section>`;
}

/** CO2 points per cell of a book entry (plant or import line; 0 for the STEP). */
function co2Of(grid: Grid, e: BookEntry): number {
  if (e.piece === IMPORT_PIECE) return grid.neighbors.find((nb) => nb.id === e.country)?.co2 ?? 0;
  if (e.piece === STEP_KEY) return 0;
  return grid.pieces[e.piece as PieceId]?.co2 ?? 0;
}

/** Emitting lines the player can lay today, most points per cell first (ties keep the book order). */
export function co2Costs(grid: Grid): { color: string; name: string; per: number }[] {
  return bookEntries(grid).map((e) => ({ e, per: co2Of(grid, e) })).filter(({ per }) => per > 0)
    .sort((a, b) => b.per - a.per)
    .map(({ e, per }) => ({
      color: PIECE_COLORS[colorKey(e.piece === IMPORT_PIECE ? 'I' : e.piece)].a,
      name: e.piece === IMPORT_PIECE ? UI.importOf(countryFrom(grid, e.country ?? '')) : PIECE_WORDS[e.piece as PieceId].name,
      per,
    }));
}

/**
 * CO2 card (only when the grid has a limit): points spent and left, a continuous track split by
 * plant colour, then the legend of the points per cell of every emitting line the player can lay.
 */
export function renderCo2(grid: Grid, state: PlayState): string {
  const cap = grid.co2_cap;
  if (cap === null) return '';
  const parts = co2Parts(grid, state);
  const total = [...parts.values()].reduce((a, b) => a + b, 0);
  const scale = Math.max(cap, total) || 1;
  const segs = [...parts.entries()].filter(([, v]) => v > 0)
    .map(([k, v]) => `<i style="width:${(100 * v) / scale}%;background:${PIECE_COLORS[colorKey(k)].a}"></i>`).join('');
  const legend = co2Costs(grid).map((c) => `<span><i class="sw" style="background:${c.color}"></i>${esc(c.name)} <span class="per">${c.per}</span></span>`).join('');
  const over = total > cap;
  return `<section class="card gauge${over ? ' over' : ''}" aria-label="${esc(UI.co2Kind)}">
    <div class="lbl"><span><b>${esc(UI.co2)}</b> ${esc(UI.co2Points(total, cap))}</span><span class="soft">${esc(UI.co2Left(cap - total))}</span></div>
    <div class="track">${segs}</div>
    ${legend ? `<div class="co2-legend" aria-label="${esc(UI.co2LegendLabel)}">${legend}</div>` : ''}</section>`;
}

/** CO2 rule for the paper list: "24 cases au plus (charbon 3, TAC 2, gaz 1)." */
export function co2RuleText(grid: Grid): string | null {
  if (grid.co2_cap === null) return null;
  return UI.co2Rule(grid.co2_cap, co2PerCellText(grid));
}


/** Used / total of a book entry for the compact row ('' when nothing to count). */
function entryCount(grid: Grid, state: PlayState, e: BookEntry): string {
  const inv = grid.inventory;
  if (e.piece === STEP_KEY) {
    const want = publishedStepPairs(grid);
    return want === null ? '' : `${state.step.length}/${want}`;
  }
  if (inv.level !== 'exact') return '';
  if (e.piece === IMPORT_PIECE) {
    const want = inv.imports?.[e.country ?? ''] ?? inv.imports?.[ANY_COUNTRY];
    return want === undefined ? '' : `${importCells(state, e.country ?? '')}/${want}`;
  }
  const spec = inv.pieces[e.piece as PieceId] ?? {};
  if (spec.bars) return `${state.bars.filter((b) => b.piece === e.piece).length}/${spec.bars.length}`;
  const total = spec.cells ?? spec.max_cells;
  return total === undefined ? '' : `${pieceCells(grid, state, e.piece as PieceId)}/${total}`;
}

/** Compact row of plants (phone, under the board): a tap chooses the plant; the eraser is an icon. */
export function renderChips(grid: Grid, state: PlayState, selected: PieceKey | null, erasing: boolean): string {
  const chips = bookEntries(grid).map((e) => {
    const sel = selected === e.key;
    const c = PIECE_COLORS[colorKey(e.piece)];
    const mark = e.piece === STEP_KEY ? `<span class="step-glyph" aria-hidden="true">▲▼</span>`
      : `<i class="sw" style="background:${c.a};border-color:${c.ink}"></i>`;
    const n = entryCount(grid, state, e);
    return `<button type="button" class="chip${sel ? ' sel' : ''}" data-piece="${esc(e.key)}" aria-pressed="${sel}">${mark}<b>${esc(name(e))}</b>${n ? `<small>${esc(n)}</small>` : ''}</button>`;
  }).join('');
  return `<div class="chips-row">${chips}</div>` + `<button type="button" class="chip erase-chip${erasing ? ' sel' : ''}" data-tool="erase" aria-pressed="${erasing}" aria-label="${esc(UI.tools.erase)}" title="${esc(UI.tools.erase)}">${icon('erase')}</button>`;
}
