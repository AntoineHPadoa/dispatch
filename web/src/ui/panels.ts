/*
 * Side panels as HTML strings: order book (exact inventory) or available plants (no inventory),
 * clue list with status, CO2 gauge, and the clue text styling (plant chips, slot values).
 * - Screen and paper share the markup; `paper` switches to style B (no usage, no counts).
 */
import { ANY_COUNTRY, IMPORT_PIECE, PIECE_IDS, type Clue, type Grid, type PieceId } from '../model/grid';
import {
  co2PerCell, pieceCells, totalExports, type ClueReport, type PlayState,
} from '../engine';
import { CLUE_KIND, PIECE_WORDS, UI, clueText, countryFrom, pieceHint } from '../i18n/fr';
import { CLUE_ICON, PIECE_COLORS, colorKey, esc, icon } from './palette';

/** A selectable entry of the book: a plant id, or `I:<country>` for imports. */
export type PieceKey = string;

export interface BookEntry {
  key: PieceKey;
  piece: string;
  country?: string;
  lens: number[];
  heights: number[];
}

/** Book entry of the STEP (pumped storage): chosen like a plant, laid as pump then turbine. */
export const STEP_KEY = 'STEP';

/** STEP pairs published by the grid (exact inventory or exchanges clue), or null when to deduce. */
export function publishedStepPairs(grid: Grid): number | null {
  if (!grid.step) return null;
  if (grid.inventory.step !== undefined) return grid.inventory.step;
  for (const c of grid.clues) if (c.type === 'exchanges' && c.step !== undefined) return c.step;
  return null;
}

/** Plants, import lines and the STEP the player can lay, in merit order. */
export function bookEntries(grid: Grid): BookEntry[] {
  const out: BookEntry[] = [];
  for (const id of PIECE_IDS) {
    const def = grid.pieces[id];
    if (!def || grid.inventory.pieces[id] === undefined) continue;
    out.push({ key: id, piece: id, lens: def.len, heights: def.height });
  }
  const inv = grid.inventory;
  for (const nb of grid.neighbors) {
    if (inv.level === 'exact') {
      const own = inv.imports?.[nb.id];
      const any = inv.imports?.[ANY_COUNTRY];
      if (!(own && own > 0) && !(own === undefined && any && any > 0)) continue;
    }
    out.push({ key: `I:${nb.id}`, piece: IMPORT_PIECE, country: nb.id, lens: [1], heights: [1] });
  }
  if (grid.step) out.push({ key: STEP_KEY, piece: STEP_KEY, lens: [1], heights: [1] });
  return out;
}

/** Mini bar at scale: `w` x `h` cells, dashed from column `dashFrom`. */
function mb(p: string, w: number, h: number, o: { used?: boolean; dashFrom?: number; paper?: boolean; label?: string } = {}): string {
  const c = PIECE_COLORS[colorKey(p)];
  const cells = Array.from({ length: w * h }, (_, i) => {
    const dashed = o.dashFrom !== undefined && i % w >= o.dashFrom;
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
      hint = pieceHint(id, e.lens, e.heights, spec.max_cells);
      if (grid.co2_cap !== null && (grid.pieces[id]?.co2 ?? 0) > 0) hint += ` · ${UI.co2PerCell(grid.pieces[id]?.co2 ?? 0)}`;
      const minH = e.heights[0] ?? 1;
      const used = pieceCells(state, id);
      if (spec.bars) {
        const placed = new Map<number, number>();
        for (const b of state.bars) if (b.piece === id) placed.set(b.len, (placed.get(b.len) ?? 0) + 1);
        glyphs = [...spec.bars].sort((a, b) => b - a).map((len) => {
          const k = placed.get(len) ?? 0;
          if (k > 0) placed.set(len, k - 1);
          return mb(id, len, minH, { used: !paper && k > 0, paper });
        }).join('');
      } else if (spec.cells !== undefined || spec.max_cells !== undefined) {
        const total = spec.cells ?? spec.max_cells ?? 0;
        glyphs = Array.from({ length: total }, (_, i) => mb(id, 1, 1, { used: !paper && i < used, paper })).join('');
        count = paper ? UI.cells(total) : `${used} / ${total}`;
        overUse = !paper && used > total;
      } else {
        const minL = e.lens[0] ?? 1;
        const maxL = e.lens[e.lens.length - 1] ?? minL;
        glyphs = mb(id, maxL, minH, { dashFrom: minL, paper });
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
  return `<div class="book">${rows.join('')}${exchangesLine(grid, state, paper)}</div>`;
}

/** Exact inventory: exports, imports and STEP pairs to place, as pills. */
function exchangesLine(grid: Grid, state: PlayState, paper: boolean): string {
  const inv = grid.inventory;
  if (inv.level !== 'exact') return '';
  const pills: string[] = [];
  const pill = (cls: string, txt: string, done: boolean) => `<span class="xpill ${cls}${!paper && done ? ' done' : ''}">${esc(txt)}</span>`;
  for (const nb of grid.neighbors) {
    const want = inv.exports?.[nb.id] ?? 0;
    if (want > 0) {
      const got = totalExports(state, nb.id);
      pills.push(pill('exp', paper ? `→ ${nb.id} ${want}` : UI.exportPill(nb.id, got, want), got === want));
    }
  }
  if (paper && grid.step && (inv.step ?? 0) > 0) {
    const want = inv.step ?? 0;
    pills.push(pill('step', paper ? `▲▼ ${UI.pairs(want)}` : UI.stepPill(state.step.length, want), state.step.length === want));
  }
  if (!pills.length) return '';
  return `<div class="prow xrow"><span class="pname"><b>${esc(UI.exchangesTitle)}</b><span>${esc(paper ? UI.noteBelowPaper : UI.noteBelow)}</span></span><span class="bars">${pills.join('')}</span></div>`;
}

/** Clue text with plant chips and slot values highlighted (text itself comes from fr.ts). */
export function richClueText(grid: Grid, clue: Clue, text = clueText(grid, clue)): string {
  let html = esc(text);
  const piece = 'piece' in clue ? clue.piece : null;
  const chip = (p: string, label: string) => `<span class="pc" style="--dot:${PIECE_COLORS[colorKey(p)].a}">${label}</span>`;
  if (piece) {
    const w = PIECE_WORDS[piece];
    for (const phrase of [w.a, w.the, w.of.replace(/^de /, ''), w.name.toLowerCase()]) {
      const re = new RegExp(`(^|[\\s'’])(${phrase.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})(?=[\\s,.]|$)`, 'i');
      if (re.test(html)) { html = html.replace(re, (_m, pre: string, word: string) => `${pre}${chip(piece, word)}`); break; }
    }
  }
  if (clue.type === 'column') {
    for (const k of Object.keys(clue.counts)) {
      if (k.startsWith('I:')) continue;
      const word = PIECE_WORDS[k as PieceId]?.of.replace(/^de /, '');
      if (!word) continue;
      html = html.replace(new RegExp(`(de |d’|d')(${word})(?=[\\s,.])`), (_m, pre: string, wd: string) => `${pre}${chip(k, wd)}`);
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

/** Clue card: day clues listed, slot clues counted; every clue in text in a collapsed list. */
export function renderClues(grid: Grid, reports: readonly ClueReport[]): string {
  if (!grid.clues.length) return '';
  const ok = reports.filter((r) => r.status === 'ok').length;
  const day = reports.filter((r) => isDayClue(r.clue));
  const slot = reports.filter((r) => !isDayClue(r.clue));
  const items = (rs: readonly ClueReport[]) => `<ul class="clues">${rs.map((r) => clueItem(grid, r.clue, r.status)).join('')}</ul>`;
  // Day clues listed, slot clues one click away; without day clues, every clue is listed.
  const title = day.length ? UI.dayClues : UI.gridClues;
  const list = items(day.length ? day : reports);
  const note = day.length && slot.length ? `<p class="note">${esc(UI.gridCluesNote)}</p>` : '';
  const all = day.length && slot.length ? `<details class="all-clues"><summary>${esc(UI.allClues)}</summary>${items(reports)}</details>` : '';
  return `<section class="card" aria-label="${esc(title)}"><h2 class="ct">${esc(title)} <small>${esc(UI.cluesChecked(ok, reports.length))}</small></h2>${list}${note}${all}</section>`;
}

/** CO2 gauge in cells, split by plant (only when the grid has a cap). */
export function renderCo2(grid: Grid, state: PlayState): string {
  const cap = grid.co2_cap;
  if (cap === null) return '';
  const parts = new Map<string, number>();
  for (const b of state.bars) {
    const k = b.piece === IMPORT_PIECE ? 'I' : b.piece;
    parts.set(k, (parts.get(k) ?? 0) + co2PerCell(grid, b) * b.len * (b.height ?? 1));
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
  return total === undefined ? '' : `${pieceCells(state, e.piece as PieceId)}/${total}`;
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
