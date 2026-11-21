/*
 * Side panels as HTML strings: order book (exact inventory) or available plants (no inventory),
 * clue list with status, CO2 gauge, and the clue text styling (plant chips, slot values).
 * - Screen and paper share the markup; `paper` switches to style B (no usage, no counts).
 */
import { ANY_COUNTRY, IMPORT_PIECE, PIECE_IDS, publishedStepPairs, type Clue, type ExchangesClue, type Grid, type PieceId } from '../model/grid';
import {
  clueText, co2PerCell, pieceCells, totalExports, totalImports, type ClueReport, type ClueStatus, type PlayState,
} from '../engine';
import { CLUE_KIND, PIECE_WORDS, UI, countryFrom, pieceHint } from '../i18n/fr';
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

/** Plants, import lines and the STEP the player can lay, in merit order. */
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
    }
    out.push({ key: `I:${nb.id}`, piece: IMPORT_PIECE, country: nb.id, lens: [1], heights: [1], shape: 'rect' });
  }
  if (grid.step) out.push({ key: STEP_KEY, piece: STEP_KEY, lens: [1], heights: [1], shape: 'rect' });
  return out;
}

/**
 * Mini piece at scale: `w` x `h` cells, dashed from column `dashFrom`; a ramp (`shape`) draws its
 * profile on two rows, the cells outside it left blank.
 */
function mb(p: string, w: number, h: number, o: { used?: boolean; dashFrom?: number; paper?: boolean; label?: string; shape?: ShapeKind } = {}): string {
  const c = PIECE_COLORS[colorKey(p)];
  const prof = profile(o.shape ?? 'rect', w, h);
  const rows = Math.max(...prof.map(([b, k]) => b + k));
  const cells = Array.from({ length: w * rows }, (_, i) => {
    const col = i % w;
    const row = rows - 1 - Math.floor(i / w);
    const [b, k] = prof[col] ?? [0, 0];
    if (row < b || row >= b + k) return '<i class="e"></i>';
    const dashed = o.dashFrom !== undefined && col >= o.dashFrom;
    return `<i class="${dashed ? 'd' : ''}" style="background:${o.paper ? c.b : c.a};--c:${c.ink}"></i>`;
  }).join('');
  return `<span class="mb${o.used ? ' used' : ''}" style="grid-template-columns:repeat(${w},auto)"${o.label ? ` title="${esc(o.label)}"` : ''}>${cells}</span>`;
}

const name = (e: BookEntry) => (e.piece === STEP_KEY ? UI.stepName
  : e.piece === IMPORT_PIECE ? UI.importName : PIECE_WORDS[e.piece as PieceId].name);

function importCells(state: PlayState, country: string): number {
  return state.bars.filter((b) => b.piece === IMPORT_PIECE && b.country === country).reduce((a, b) => a + b.len * (b.height ?? 1), 0);
}

/** Order book (exact) or available plants (none). `selected` is highlighted; paper hides usage. */
export function renderBook(grid: Grid, state: PlayState, selected: PieceKey | null, paper = false): string {
  const inv = grid.inventory;
  const rows = bookEntries(grid).filter((e) => !paper || e.piece !== STEP_KEY).map((e) => {
    let hint: string;
    let glyphs = '';
    let count = '';
    let overUse = false;
    if (e.piece === STEP_KEY) {
      const want = publishedStepPairs(grid);
      const used = state.step.length;
      hint = want === null ? UI.stepPairsToDeduce : UI.pairs(want);
      glyphs = `<span class="step-glyph" aria-hidden="true">▲▼</span>`;
      count = want === null ? UI.pairsLaid(used) : `${used} / ${want}`;
      overUse = want !== null && used > want;
    } else if (e.piece === IMPORT_PIECE) {
      const country = e.country ?? '';
      const nbName = grid.neighbors.find((nb) => nb.id === country)?.name ?? country;
      hint = UI.importHint(nbName);
      if (grid.co2_cap !== null) hint += ` · ${UI.co2PerCell(grid.neighbors.find((nb) => nb.id === country)?.co2 ?? 0)}`;
      const used = importCells(state, country);
      const want = inv.level === 'exact' ? inv.imports?.[country] ?? inv.imports?.[ANY_COUNTRY] : undefined;
      if (want !== undefined) {
        glyphs = Array.from({ length: want }, (_, i) => mb('I', 1, 1, { used: !paper && i < used, paper })).join('');
        if (!paper) { count = `${Math.min(used, 99)} / ${want}`; overUse = used > want; }
        else count = UI.cells(want);
      } else {
        glyphs = mb('I', 1, 1, { paper });
        if (!paper) count = UI.placed(used);
      }
    } else {
      const id = e.piece as PieceId;
      const spec = inv.pieces[id] ?? {};
      hint = pieceHint(id, e.lens, e.heights, spec.max_cells, e.shape);
      if (grid.co2_cap !== null && (grid.pieces[id]?.co2 ?? 0) > 0) hint += ` · ${UI.co2PerCell(grid.pieces[id]?.co2 ?? 0)}`;
      const minH = e.heights[0] ?? 1;
      const used = pieceCells(grid, state, id);
      const shape = e.shape;
      if (spec.bars) {
        const placed = new Map<number, number>();
        for (const b of state.bars) if (b.piece === id) placed.set(b.len, (placed.get(b.len) ?? 0) + 1);
        glyphs = [...spec.bars].sort((a, b) => b - a).map((len) => {
          const k = placed.get(len) ?? 0;
          if (k > 0) placed.set(len, k - 1);
          return mb(id, len, minH, { used: !paper && k > 0, paper, shape });
        }).join('');
      } else if (spec.cells !== undefined || spec.max_cells !== undefined) {
        const total = spec.cells ?? spec.max_cells ?? 0;
        glyphs = Array.from({ length: total }, (_, i) => mb(id, 1, 1, { used: !paper && i < used, paper })).join('');
        count = paper ? UI.cells(total) : `${used} / ${total}`;
        overUse = !paper && used > total;
      } else {
        const minL = e.lens[0] ?? 1;
        const maxL = e.lens[e.lens.length - 1] ?? minL;
        // A ramp shows its shortest shape: a dashed tail would cut its last shoulder.
        glyphs = isRamp(shape) ? mb(id, minL, 1, { paper, shape }) : mb(id, maxL, minH, { dashFrom: minL, paper });
        for (const h of e.heights.slice(1)) glyphs += mb(id, minL, h, { paper });
        if (!paper) count = UI.placed(used);
      }
    }
    const sel = !paper && selected === e.key;
    const over = overUse;
    const body = `<span class="pname"><b>${esc(name(e))}</b><span>${esc(hint)}</span></span>`
      + `<span class="bars">${glyphs}${count ? `<span class="count${over ? ' over' : ''}">${esc(count)}</span>` : ''}</span>`;
    if (paper) return `<div class="prow">${body}</div>`;
    return `<button type="button" class="prow${sel ? ' sel' : ''}" data-piece="${esc(e.key)}" aria-pressed="${sel}">${body}</button>`;
  });
  return `<div class="book">${rows.join('')}</div>`;
}

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
  html = html.replace(/(^|[\s(])(\d+h|\d+)(?=[\s,.)]|$)/g, (_m, pre: string, v: string) => `${pre}<span class="slot">${v}</span>`);
  return html;
}

/** True when the clue is drawn on the grid (slot clues); day clues go to the list. */
export const isDayClue = (clue: Clue) => clue.type === 'length' || clue.type === 'exchanges' || clue.type === 'engaged';

const stateDot = (st: ClueReport['status'] | null) => (st === null ? ''
  : `<span class="state ${st === 'ok' ? 'ok' : st === 'broken' ? 'bad' : ''}" role="img" aria-label="${esc(UI.clueState[st])}"></span>`);

/** One clue list item. */
export function clueItem(grid: Grid, clue: Clue, status: ClueReport['status'] | null, paper = false): string {
  const kind = esc(CLUE_KIND[clue.type]);
  const txt = richClueText(grid, clue);
  if (paper) return `<li class="clue"><span><span class="kind">${kind}</span><span class="txt">${txt}</span></span></li>`;
  return `<li class="clue"><span class="ico">${icon(CLUE_ICON[clue.type] ?? 'price')}</span>`
    + `<span><span class="kind">${kind}</span><span class="txt">${txt}</span></span>${stateDot(status)}</li>`;
}

/** Clues in reading order: day clues first (no slot), then slot clues by column; ties keep the grid order. */
export function orderClues<T extends { clue: Clue }>(reports: readonly T[]): T[] {
  const col = (c: Clue) => ('col' in c && typeof c.col === 'number' ? c.col : -1);
  return reports
    .map((r, i) => ({ r, i }))
    .sort((a, b) => col(a.r.clue) - col(b.r.clue) || a.i - b.i)
    .map(({ r }) => r);
}

/**
 * Day totals an exact inventory imposes (exports, imports, STEP pairs), as an "exchanges" clue:
 * they are market publications like the clues of the no-inventory grids, so they live in the clue
 * card, not in the order book. Null when the inventory imposes none, or the grid has its own clue.
 */
export function inventoryExchanges(grid: Grid): ExchangesClue | null {
  const inv = grid.inventory;
  if (inv.level !== 'exact' || grid.clues.some((c) => c.type === 'exchanges')) return null;
  const clue: ExchangesClue = { type: 'exchanges' };
  if (inv.exports && Object.keys(inv.exports).length) clue.exports = { ...inv.exports };
  if (inv.imports && Object.keys(inv.imports).length) clue.imports = { ...inv.imports };
  if (grid.step && inv.step !== undefined) clue.step = inv.step;
  return clue.exports || clue.imports || clue.step !== undefined ? clue : null;
}

/** Number of clues the clue card lists: the grid's own, plus the exchanges line of an exact inventory. */
export function shownClueCount(grid: Grid): number {
  return grid.clues.length + (inventoryExchanges(grid) ? 1 : 0);
}

/** Status of an exchanges clue on a board: every total met (ok), one exceeded (broken), else open. */
function exchangesStatus(state: PlayState, clue: ExchangesClue): ClueStatus {
  const st: ClueStatus[] = [];
  const count = (got: number, want: number): ClueStatus => (got > want ? 'broken' : got === want ? 'ok' : 'open');
  for (const [k, v] of Object.entries(clue.exports ?? {})) st.push(count(totalExports(state, k), v));
  for (const [k, v] of Object.entries(clue.imports ?? {})) st.push(count(totalImports(state, k), v));
  if (clue.step !== undefined) st.push(count(state.step.length, clue.step));
  return st.includes('broken') ? 'broken' : st.includes('open') ? 'open' : 'ok';
}

/** The clue reports of the board plus the exchanges line of an exact inventory (a day clue, so listed first). */
export function withInventoryExchanges(grid: Grid, state: PlayState, reports: readonly ClueReport[]): ClueReport[] {
  const clue = inventoryExchanges(grid);
  if (!clue) return [...reports];
  return [...reports, { clue, text: clueText(grid, clue), status: exchangesStatus(state, clue) }];
}

/** Clue card: every clue in text, day clues first, then slot clues in time order. */
export function renderClues(grid: Grid, boardReports: readonly ClueReport[], state: PlayState): string {
  const reports = withInventoryExchanges(grid, state, boardReports);
  if (!reports.length) return '';
  const ok = reports.filter((r) => r.status === 'ok').length;
  const title = UI.cluesTitle;
  const list = `<ul class="clues">${orderClues(reports).map((r) => clueItem(grid, r.clue, r.status)).join('')}</ul>`;
  return `<section class="card" aria-label="${esc(title)}"><h2 class="ct">${esc(title)} <small>${esc(UI.cluesChecked(ok, reports.length))}</small></h2>${list}</section>`;
}

/** CO2 gauge in cells, split by plant (only when the grid has a cap). */
export function renderCo2(grid: Grid, state: PlayState): string {
  const cap = grid.co2_cap;
  if (cap === null) return '';
  const parts = new Map<string, number>();
  for (const b of state.bars) {
    const k = b.piece === IMPORT_PIECE ? 'I' : b.piece;
    parts.set(k, (parts.get(k) ?? 0) + co2PerCell(grid, b) * cellCount(grid, b));
  }
  const total = [...parts.values()].reduce((a, b) => a + b, 0);
  const scale = Math.max(cap, total) || 1;
  const segs = [...parts.entries()].filter(([, v]) => v > 0)
    .map(([k, v]) => `<i style="width:${(100 * v) / scale}%;background:${PIECE_COLORS[colorKey(k)].a}"></i>`).join('');
  const detail = [...parts.entries()].filter(([, v]) => v > 0)
    .map(([k, v]) => `${k === 'I' ? UI.importWord : PIECE_WORDS[k as PieceId].name.toLowerCase()} ${v}`);
  const over = total > cap;
  return `<section class="card gauge${over ? ' over' : ''}" aria-label="${esc(UI.co2Kind)}">
    <div class="lbl"><span><b>${esc(UI.co2)}</b> ${esc(UI.co2Points(total, cap))}</span><span class="soft">${esc(UI.co2Cap)}</span></div>
    <div class="track">${segs}</div>
    <div class="lbl small soft"><span>${esc(UI.co2Detail(detail))}</span><span>${esc(UI.co2Left(cap - total))}</span></div></section>`;
}

/** CO2 rule for the paper list: "24 cases au plus (charbon 3, TAC 2, gaz 1)." */
export function co2RuleText(grid: Grid): string | null {
  if (grid.co2_cap === null) return null;
  const per = PIECE_IDS.filter((id) => grid.pieces[id] && (grid.pieces[id]?.co2 ?? 0) > 0)
    .map((id) => `${PIECE_WORDS[id].name.toLowerCase()} ${grid.pieces[id]?.co2}`);
  for (const nb of grid.neighbors) if (nb.co2 > 0) per.push(`import ${countryFrom(grid, nb.id)} ${nb.co2}`);
  return UI.co2Rule(grid.co2_cap, per.join(', '));
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
