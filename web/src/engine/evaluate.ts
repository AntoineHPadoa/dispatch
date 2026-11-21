/*
 * Whole-board verdict (pure): rule violations, uncovered cells, clue status, inventory left,
 * composition and the solved flag.
 * - A clue still open once every cell is covered is reported broken (nothing left to lay).
 * - A grid is solved when every rule, inventory item and clue holds and the composition (§8.1:
 *   cells per piece and column, exports, pumping and turbining per column) equals the reference
 *   one. Two drawings with the same composition are both accepted.
 *
 * Example: const ev = evaluate(grid, state); if (ev.solved) celebrate(); else list(ev.unmet);
 */
import { ANY_COUNTRY, type Clue, type Grid, type PieceId } from '../model/grid';
import {
  ALL_COUNTRIES, INVENTORY, MSG, TODO, clueText, columnLabel, countryFrom, countryTo, ofPiece,
} from '../i18n/fr';
import { checkShape, checkSilhouette } from './rules';
import {
  barHeight, co2Total, exportsAt, importsAt, pieceCells, pieceKey, rawSilhouette,
  solutionState, totalExports, totalImports, type EngineError, type PlacedBar, type PlayState,
} from './state';

export type ClueStatus = 'ok' | 'open' | 'broken';

export interface ClueReport {
  clue: Clue;
  text: string;
  /** ok: holds; open: not yet met but still reachable; broken: already contradicted. */
  status: ClueStatus;
}

export interface InventoryItem {
  /** Piece id, `exp:<country>`, `imp:<country>` (`imp:*` for all countries) or `step`. */
  key: string;
  status: 'free' | 'todo' | 'done' | 'over';
  text: string;
  /** What is left to lay: bar widths, or a count. */
  left?: number[] | number;
}

/** §8.1 composition: what two equivalent solutions share. */
export interface Composition {
  /** Per column: cells per piece key (piece id or `I:<country>`), zero counts omitted. */
  cells: Record<string, number>[];
  /** Per neighbor: exported blocks per column. */
  exports: Record<string, number[]>;
  pumps: number[];
  turbines: number[];
}

export interface Evaluation {
  /** Height to fill per column (0 when the surplus is not absorbed). */
  silhouette: number[];
  /** Broken rules, in French. */
  errors: EngineError[];
  /** Indexes of bars breaking a rule (outside the silhouette, overlapping, wrong shape). */
  invalidBars: number[];
  missing: number;
  missingByCol: number[];
  co2: number;
  clues: ClueReport[];
  inventory: InventoryItem[];
  composition: Composition;
  matchesReference: boolean;
  /** Everything that keeps the grid from being solved, in French. */
  unmet: string[];
  solved: boolean;
}

/** Composition of a board. */
export function composition(grid: Grid, state: PlayState): Composition {
  const n = grid.columns.length;
  const cells: Record<string, number>[] = Array.from({ length: n }, () => ({}));
  for (const b of state.bars) {
    for (let c = b.col; c < Math.min(n, b.col + b.len); c++) {
      const col = cells[c]!;
      const k = pieceKey(b);
      col[k] = (col[k] ?? 0) + barHeight(b);
    }
  }
  const exports: Record<string, number[]> = {};
  for (const nb of grid.neighbors) exports[nb.id] = grid.columns.map((_, c) => exportsAt(state, nb.id, c));
  const pumps = grid.columns.map(() => 0);
  const turbines = grid.columns.map(() => 0);
  for (const s of state.step) {
    if (s.pump >= 0 && s.pump < n) pumps[s.pump]! += 1;
    if (s.turbine >= 0 && s.turbine < n) turbines[s.turbine]! += 1;
  }
  return { cells, exports, pumps, turbines };
}

function canonical(c: Composition): string {
  const sortObj = (o: Record<string, unknown>) => Object.fromEntries(Object.entries(o).sort(([a], [b]) => a.localeCompare(b)));
  return JSON.stringify({
    cells: c.cells.map(sortObj), exports: sortObj(c.exports), pumps: c.pumps, turbines: c.turbines,
  });
}

const refCache = new WeakMap<Grid, string>();

function referenceKey(grid: Grid): string {
  let k = refCache.get(grid);
  if (k === undefined) {
    k = canonical(composition(grid, solutionState(grid)));
    refCache.set(grid, k);
  }
  return k;
}

/** Status of one count against its target: over is broken, equal is ok, under is open. */
const countStatus = (got: number, want: number): ClueStatus => (got > want ? 'broken' : got === want ? 'ok' : 'open');

function worst(statuses: ClueStatus[]): ClueStatus {
  if (statuses.includes('broken')) return 'broken';
  if (statuses.includes('open')) return 'open';
  return 'ok';
}

interface Board {
  comp: Composition;
  missingByCol: number[];
  /** Bars that break no rule (hatched ones do not count towards a clue). */
  validBars: PlacedBar[];
}

/** Program/length clue with no matching bar: open while the piece can still be laid, else broken. */
function barClueStatus(grid: Grid, board: Board, piece: PieceId, matches: (b: PlacedBar) => boolean): ClueStatus {
  if (board.validBars.some((b) => b.piece === piece && matches(b))) return 'ok';
  const spec = grid.inventory.level === 'exact' ? grid.inventory.pieces[piece] : undefined;
  const mine = board.validBars.filter((b) => b.piece === piece);
  if (spec?.bars && mine.length >= spec.bars.length) return 'broken';
  if (spec?.cells !== undefined && mine.reduce((a, b) => a + b.len * barHeight(b), 0) >= spec.cells) return 'broken';
  return 'open';
}

/** Status of one clue on the board. */
export function clueStatus(grid: Grid, state: PlayState, board: Board, clue: Clue): ClueStatus {
  switch (clue.type) {
    case 'price': {
      const cells = board.comp.cells[clue.col] ?? {};
      if (Object.keys(cells).some((k) => k.startsWith('I:'))) return 'broken';
      const want = grid.pieces[clue.piece]?.rank ?? 0;
      let top: PieceId | null = null;
      for (const k of Object.keys(cells) as PieceId[]) {
        const r = grid.pieces[k]?.rank ?? 0;
        if (r > want) return 'broken';
        if (top === null || r > (grid.pieces[top]?.rank ?? 0)) top = k;
      }
      if (board.missingByCol[clue.col] !== 0) return 'open';
      return top === clue.piece ? 'ok' : 'broken';
    }
    case 'bar':
      return barClueStatus(grid, board, clue.piece, (b) => b.col === clue.col && b.len === clue.len);
    case 'length':
      return barClueStatus(grid, board, clue.piece, (b) => b.len === clue.len);
    case 'column': {
      const cells = board.comp.cells[clue.col] ?? {};
      const st = worst(Object.entries(clue.counts).map(([k, v]) => countStatus(cells[k] ?? 0, v)));
      if (st === 'broken') return st;
      if (board.missingByCol[clue.col] !== 0) return 'open';
      return st === 'ok' ? 'ok' : 'broken';
    }
    case 'flow': {
      const got = clue.dir === 'export' ? exportsAt(state, clue.country, clue.col) : importsAt(state, clue.country, clue.col);
      return countStatus(got, clue.value);
    }
    case 'exchanges': {
      const st: ClueStatus[] = [];
      for (const [k, v] of Object.entries(clue.exports ?? {})) st.push(countStatus(totalExports(state, k), v));
      for (const [k, v] of Object.entries(clue.imports ?? {})) st.push(countStatus(totalImports(state, k), v));
      if (clue.step !== undefined) st.push(countStatus(state.step.length, clue.step));
      return worst(st);
    }
    case 'engaged':
      return state.bars.some((b) => b.piece === clue.piece && b.row === clue.row && b.col === clue.col
        && b.len === clue.len) ? 'ok' : 'broken';
  }
}

/** Inventory items, plus the rule violations (over) and the work left (todo) they imply. */
function inventoryReport(grid: Grid, state: PlayState, errors: EngineError[], todo: string[]): InventoryItem[] {
  const inv = grid.inventory;
  const items: InventoryItem[] = [];
  for (const [id, spec] of Object.entries(inv.pieces) as [PieceId, NonNullable<typeof inv.pieces[PieceId]>][]) {
    const name = ofPiece(grid, id);
    const used = pieceCells(state, id);
    if (spec.bars) {
      const left = [...spec.bars];
      const extra: number[] = [];
      for (const b of state.bars) {
        if (b.piece !== id) continue;
        const i = left.indexOf(b.len);
        if (i >= 0) left.splice(i, 1); else extra.push(b.len);
      }
      left.sort((a, b) => b - a);
      if (extra.length) {
        errors.push({ code: 'inventory', message: MSG.tooManyBars(name, extra) });
        items.push({ key: id, status: 'over', text: INVENTORY.over(extra.join(', ')), left });
      } else if (left.length) {
        todo.push(TODO.bars(name, left));
        items.push({ key: id, status: 'todo', text: INVENTORY.left(left.join(', ')), left });
      } else {
        items.push({ key: id, status: 'done', text: INVENTORY.done, left });
      }
    } else if (spec.cells !== undefined) {
      const left = spec.cells - used;
      if (left < 0) {
        errors.push({ code: 'inventory', message: MSG.tooManyCells(name, used, spec.cells) });
        items.push({ key: id, status: 'over', text: INVENTORY.over(String(-left)), left });
      } else if (left > 0) {
        todo.push(TODO.cells(name, left));
        items.push({ key: id, status: 'todo', text: INVENTORY.left(String(left)), left });
      } else {
        items.push({ key: id, status: 'done', text: INVENTORY.done, left });
      }
    } else if (spec.max_cells !== undefined) {
      const over = used > spec.max_cells;
      if (over) errors.push({ code: 'stock', message: MSG.stock(id, name, spec.max_cells) });
      items.push({ key: id, status: over ? 'over' : 'free', text: INVENTORY.stock(used, spec.max_cells), left: spec.max_cells - used });
    } else {
      items.push({ key: id, status: 'free', text: INVENTORY.free });
    }
  }

  const exchange = (key: string, got: number, want: number, over: string, left: string) => {
    if (got > want) {
      errors.push({ code: 'inventory', message: over });
      items.push({ key, status: 'over', text: INVENTORY.over(String(got - want)), left: want - got });
    } else if (got < want) {
      todo.push(left);
      items.push({ key, status: 'todo', text: INVENTORY.left(String(want - got)), left: want - got });
    } else {
      items.push({ key, status: 'done', text: INVENTORY.done, left: 0 });
    }
  };
  if (inv.level === 'exact') {
    for (const nb of grid.neighbors) {
      const to = countryTo(grid, nb.id);
      const got = totalExports(state, nb.id);
      const want = inv.exports?.[nb.id] ?? 0;
      exchange(`exp:${nb.id}`, got, want, MSG.tooManyExports(to, got, want), TODO.exports(to, want - got));
    }
    const any = inv.imports?.[ANY_COUNTRY];
    const sources = any !== undefined ? [ANY_COUNTRY] : grid.neighbors.map((nb) => nb.id);
    for (const id of sources) {
      const from = id === ANY_COUNTRY ? ALL_COUNTRIES : countryFrom(grid, id);
      const got = totalImports(state, id);
      const want = inv.imports?.[id] ?? 0;
      exchange(`imp:${id}`, got, want, MSG.tooManyImports(from, got, want), TODO.imports(from, want - got));
    }
    if (grid.step) {
      const want = inv.step ?? 0;
      exchange('step', state.step.length, want, MSG.tooManySteps(state.step.length, want), TODO.steps(want - state.step.length));
    }
  }
  return items;
}

/** Full verdict on a board. */
export function evaluate(grid: Grid, state: PlayState): Evaluation {
  const n = grid.columns.length;
  const raw = rawSilhouette(grid, state);
  const sil = raw.map((v) => Math.max(0, v));
  const errors: EngineError[] = [];
  const todo: string[] = [];
  const at = (c: number) => columnLabel(grid, c);

  // Silhouette: surplus, exports, STEP
  raw.forEach((v, c) => { if (v < 0) errors.push({ code: 'surplus', message: MSG.surplus(at(c)) }); });
  for (const nb of grid.neighbors) {
    for (let c = 0; c < n; c++) {
      const e = exportsAt(state, nb.id, c);
      if (e < 0 || !Number.isInteger(e)) errors.push({ code: 'export', message: MSG.exportRange(at(c)) });
      if (e + importsAt(state, nb.id, c) > nb.cap) errors.push({ code: 'line', message: MSG.line(countryTo(grid, nb.id), at(c)) });
    }
  }
  if (state.step.length && !grid.step) errors.push({ code: 'step_none', message: MSG.stepNone() });
  for (const s of state.step) {
    if (s.pump < 0 || s.turbine >= n || s.pump >= s.turbine) {
      errors.push({ code: 'step_reversed', message: MSG.stepReversed() });
    }
  }

  // Bars: shape, silhouette, overlap; only valid bars cover cells
  const invalidBars: number[] = [];
  const covered = new Set<string>();
  state.bars.forEach((b, i) => {
    const check = checkShape(grid, b);
    const fits = check.ok ? checkSilhouette(grid, sil, b) : check;
    let error = fits.ok ? null : fits.error;
    const own: string[] = [];
    if (!error) {
      for (let c = b.col; c < b.col + b.len; c++) {
        for (let r = b.row; r < b.row + barHeight(b); r++) own.push(`${r},${c}`);
      }
      if (own.some((k) => covered.has(k))) error = { code: 'overlap', message: MSG.overlap() };
    }
    if (error) {
      invalidBars.push(i);
      errors.push(error);
      return;
    }
    own.forEach((k) => covered.add(k));
  });
  const missingByCol = sil.map((h, c) => {
    let m = 0;
    for (let r = 0; r < h; r++) if (!covered.has(`${r},${c}`)) m++;
    return m;
  });
  const missing = missingByCol.reduce((a, b) => a + b, 0);

  // Inventory and CO2
  const inventory = inventoryReport(grid, state, errors, todo);
  const co2 = co2Total(grid, state);
  if (grid.co2_cap !== null && co2 > grid.co2_cap) errors.push({ code: 'co2', message: MSG.co2(co2, grid.co2_cap) });

  // Clues
  const comp = composition(grid, state);
  const bad = new Set(invalidBars);
  const board: Board = { comp, missingByCol, validBars: state.bars.filter((_, i) => !bad.has(i)) };
  // Once every cell is covered, a clue still open can no longer be met by laying: it is contradicted.
  const settle = (st: ClueStatus): ClueStatus => (missing === 0 && st === 'open' ? 'broken' : st);
  const clues = grid.clues.map((clue) => ({ clue, text: clueText(grid, clue), status: settle(clueStatus(grid, state, board, clue)) }));

  // Verdict
  const unmet: string[] = [];
  const add = (m: string) => { if (!unmet.includes(m)) unmet.push(m); };
  errors.forEach((e) => add(e.message));
  if (missing > 0) add(TODO.missing(missing));
  todo.forEach(add);
  clues.forEach((c) => { if (c.status !== 'ok') add(TODO.clue(c.text)); });
  const matchesReference = canonical(comp) === referenceKey(grid);
  if (unmet.length === 0 && !matchesReference) add(TODO.otherSolution());

  return {
    silhouette: sil, errors, invalidBars, missing, missingByCol, co2, clues, inventory, composition: comp,
    matchesReference, unmet, solved: unmet.length === 0,
  };
}
