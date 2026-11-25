/*
 * Placement rules and player actions (pure; each action returns a new state or a French reason).
 * - checkPlacement: shape (piece, width, height or ramp profile, bounds), weather cells, silhouette, overlap, inventory, stock,
 *   line capacity and CO2 cap, for a live preview or before laying a bar.
 * - Actions: place, remove, setExport, addStep, removeStep.
 *
 * Example: const r = place(grid, state, {piece: 'N', row: 0, col: 0, len: 6});
 *          if (r.ok) state = r.state; else show(r.error.message);
 */
import { ANY_COUNTRY, IMPORT_PIECE, type Grid, type Placement, type StepPair } from '../model/grid';
import { MSG, PIECE_WORDS, columnLabel, countryFrom, countryTo, groupSubject, ofPiece } from '../i18n/fr';
import {
  barHeight, barIndexAt, co2PerCell, co2Total, exportsAt, importsAt, pieceCells, silhouette, totalExports, weatherCells,
  totalImports, type EngineError, type ErrorCode, type PlacedBar, type PlayState,
} from './state';
import { cellCount, cellsOf, isRamp, shapeKind, topIn } from '../model/shapes';

export type Check = { ok: true } | { ok: false; error: EngineError };
export type ActionResult = { ok: true; state: PlayState } | { ok: false; state: PlayState; error: EngineError };

const fail = (code: ErrorCode, message: string): { ok: false; error: EngineError } => ({ ok: false, error: { code, message } });
const OK: Check = { ok: true };

/** Piece, width, height and bounds (independent from the board). */
export function checkShape(grid: Grid, bar: Placement): Check {
  const n = grid.columns.length;
  let lens: number[];
  let heights: number[];
  if (bar.piece === IMPORT_PIECE) {
    if (!grid.neighbors.some((nb) => nb.id === bar.country)) return fail('country', MSG.unknownCountry());
    lens = [1];
    heights = [1];
  } else {
    const def = grid.pieces[bar.piece];
    if (!def || grid.inventory.pieces[bar.piece] === undefined) {
      return fail('unavailable', MSG.unavailable(ofPiece(grid, bar.piece)));
    }
    lens = def.len;
    // A ramp has a fixed profile: its placements carry no height (or 1).
    heights = isRamp(shapeKind(def)) ? [1] : def.height ?? [1];
    if (isRamp(shapeKind(def)) && !lens.includes(bar.len)) return fail('length', MSG.rampLength(lens));
  }
  const subject = groupSubject(grid, bar.piece, bar.country);
  if (!lens.includes(bar.len)) return fail('length', MSG.length(subject, lens));
  if (!heights.includes(barHeight(bar))) return fail('height', MSG.height(subject, heights));
  if (bar.row < 0 || bar.col < 0 || bar.col + bar.len > n) return fail('bounds', MSG.bounds(bar.piece !== IMPORT_PIECE && isRamp(shapeKind(grid.pieces[bar.piece]))));
  return OK;
}

/**
 * Every cell of the bar lies above the weather and under the silhouette `sil` (cells to fill per
 * column, counted from the top of the weather). Rows are absolute.
 */
export function checkSilhouette(grid: Grid, sil: readonly number[], bar: Placement): Check {
  const floor = weatherCells(grid);
  for (const [r, c] of cellsOf(grid, bar)) {
    if (r < (floor[c] ?? 0)) return fail('weather', MSG.weather(columnLabel(grid, c)));
  }
  for (let c = bar.col; c < bar.col + bar.len; c++) {
    if (topIn(grid, bar, c) > (floor[c] ?? 0) + (sil[c] ?? 0)) return fail('silhouette', MSG.silhouette(columnLabel(grid, c)));
  }
  return OK;
}

const cellKeys = (grid: Grid, b: Placement) => new Set(cellsOf(grid, b).map(([r, c]) => `${r},${c}`));

/** Indexes of the bars (other than `skip`) sharing a cell with `bar`. */
function sharing(grid: Grid, state: PlayState, bar: Placement, skip = -1): number[] {
  const mine = cellKeys(grid, bar);
  const out: number[] = [];
  state.bars.forEach((o, i) => {
    if (i !== skip && cellsOf(grid, o).some(([r, c]) => mine.has(`${r},${c}`))) out.push(i);
  });
  return out;
}

/** Inventory, stock, line capacity and CO2 cap, as if `bar` were added (bar `skip` ignored). */
export function checkBudget(grid: Grid, state: PlayState, bar: Placement, skip = -1): Check {
  const inv = grid.inventory;
  const cells = cellCount(grid, bar);
  if (bar.piece === IMPORT_PIECE) {
    const country = bar.country ?? '';
    for (let c = bar.col; c < bar.col + bar.len; c++) {
      const cap = grid.neighbors.find((nb) => nb.id === country)?.cap ?? 0;
      if (exportsAt(state, country, c) + importsAt(state, country, c, skip) + barHeight(bar) > cap) {
        return fail('line', MSG.line(countryTo(grid, country), columnLabel(grid, c)));
      }
    }
    if (inv.level === 'exact') {
      const own = inv.imports?.[country];
      if (own !== undefined && totalImports(state, country, skip) + cells > own) {
        return fail('inventory', MSG.inventoryImports(countryFrom(grid, country), own));
      }
      const any = inv.imports?.[ANY_COUNTRY];
      if (any !== undefined && totalImports(state, ANY_COUNTRY, skip) + cells > any) {
        return fail('inventory', MSG.inventoryImportsAll(any));
      }
      if (own === undefined && any === undefined) return fail('inventory', MSG.inventoryImports(countryFrom(grid, country), 0));
    }
  } else {
    const spec = inv.pieces[bar.piece] ?? {};
    const name = ofPiece(grid, bar.piece);
    if (spec.bars) {
      const placed = state.bars.filter((b, i) => i !== skip && b.piece === bar.piece && b.len === bar.len).length;
      if (placed >= spec.bars.filter((l) => l === bar.len).length) return fail('inventory', MSG.inventoryBar(PIECE_WORDS[bar.piece].group, bar.len, isRamp(shapeKind(grid.pieces[bar.piece]))));
    }
    if (spec.cells !== undefined && pieceCells(grid, state, bar.piece, skip) + cells > spec.cells) {
      return fail('inventory', MSG.inventoryCells(name, spec.cells));
    }
    if (spec.max_cells !== undefined && pieceCells(grid, state, bar.piece, skip) + cells > spec.max_cells) {
      return fail('stock', MSG.stock(bar.piece, name, spec.max_cells));
    }
  }
  if (grid.co2_cap !== null) {
    const after = co2Total(grid, state, skip) + co2PerCell(grid, bar) * cells;
    if (after > grid.co2_cap) return fail('co2', MSG.co2(after, grid.co2_cap));
  }
  return OK;
}

/** Can `bar` be laid on the current board? Returns the first broken rule, in French. */
export function checkPlacement(grid: Grid, state: PlayState, bar: Placement): Check {
  const shape = checkShape(grid, bar);
  if (!shape.ok) return shape;
  const sil = checkSilhouette(grid, silhouette(grid, state), bar);
  if (!sil.ok) return sil;
  if (sharing(grid, state, bar).length) return fail('overlap', MSG.overlap());
  return checkBudget(grid, state, bar);
}

const refuse = (state: PlayState, check: { ok: false; error: EngineError }): ActionResult => ({ ok: false, state, error: check.error });

/** Lay a bar. */
export function place(grid: Grid, state: PlayState, bar: Placement): ActionResult {
  const check = checkPlacement(grid, state, bar);
  if (!check.ok) return refuse(state, check);
  const copy: PlacedBar = { piece: bar.piece, row: bar.row, col: bar.col, len: bar.len };
  if (bar.height !== undefined) copy.height = bar.height;
  if (bar.piece === IMPORT_PIECE) copy.country = bar.country;
  return { ok: true, state: { ...state, bars: [...state.bars, copy] } };
}

/** A placement that may lay over bars already on the board: the bars it would replace. */
export type OverCheck = { ok: true; replaced: number[] } | { ok: false; error: EngineError; replaced: number[] };

/** Indexes of the bars a placement would cover. */
export function coveredBars(grid: Grid, state: PlayState, bar: Placement): number[] {
  return sharing(grid, state, bar);
}

/**
 * Can `bar` be laid, replacing the bars it covers? Engaged bars are never replaced. The covered
 * bars go back to the inventory before the budget check.
 */
export function checkPlaceOver(grid: Grid, state: PlayState, bar: Placement): OverCheck {
  const shape = checkShape(grid, bar);
  if (!shape.ok) return { ...shape, replaced: [] };
  const replaced = coveredBars(grid, state, bar);
  if (replaced.some((i) => state.bars[i]?.locked)) return { ...fail('locked', MSG.lockedOver()), replaced };
  const rest: PlayState = { ...state, bars: state.bars.filter((_, i) => !replaced.includes(i)) };
  const sil = checkSilhouette(grid, silhouette(grid, rest), bar);
  if (!sil.ok) return { ...sil, replaced };
  const budget = checkBudget(grid, rest, bar);
  if (!budget.ok) return { ...budget, replaced };
  return { ok: true, replaced };
}

/** Lay a bar over the board: the bars it covers are removed first, in one action. */
export function placeOver(grid: Grid, state: PlayState, bar: Placement): ActionResult & { replaced: PlacedBar[] } {
  const check = checkPlaceOver(grid, state, bar);
  const replaced = check.replaced.map((i) => state.bars[i]!).filter(Boolean);
  if (!check.ok) return { ...refuse(state, check), replaced };
  const rest: PlayState = { ...state, bars: state.bars.filter((_, i) => !check.replaced.includes(i)) };
  const r = place(grid, rest, bar);
  return r.ok ? { ...r, replaced } : { ...r, state, replaced };
}

/** Remove the bar covering a cell (engaged bars stay). */
export function remove(grid: Grid, state: PlayState, row: number, col: number): ActionResult {
  const i = barIndexAt(grid, state, row, col);
  if (i < 0) return refuse(state, fail('empty', MSG.nothingHere()));
  if (state.bars[i]?.locked) return refuse(state, fail('locked', MSG.locked()));
  return { ok: true, state: { ...state, bars: state.bars.filter((_, k) => k !== i) } };
}

/**
 * Set the blocks exported to one neighbor in one column. Bars left outside the new silhouette
 * are kept; evaluate() reports them.
 */
export function setExport(grid: Grid, state: PlayState, country: string, col: number, value: number): ActionResult {
  const nb = grid.neighbors.find((x) => x.id === country);
  if (!nb) return refuse(state, fail('country', MSG.unknownCountry()));
  if (col < 0 || col >= grid.columns.length || value < 0 || !Number.isInteger(value)) {
    return refuse(state, fail('export', MSG.exportRange(columnLabel(grid, col))));
  }
  if (value + importsAt(state, country, col) > nb.cap) {
    return refuse(state, fail('line', MSG.line(countryTo(grid, country), columnLabel(grid, col))));
  }
  const want = grid.inventory.level === 'exact' ? grid.inventory.exports?.[country] ?? 0 : undefined;
  if (want !== undefined && totalExports(state, country) - exportsAt(state, country, col) + value > want) {
    return refuse(state, fail('inventory', MSG.inventoryExports(countryTo(grid, country), want)));
  }
  const vals = [...(state.exports[country] ?? grid.columns.map(() => 0))];
  vals[col] = value;
  return { ok: true, state: { ...state, exports: { ...state.exports, [country]: vals } } };
}

/** Add a STEP pair: pumping in `pump`, turbining in a later column. */
export function addStep(grid: Grid, state: PlayState, pump: number, turbine: number): ActionResult {
  if (!grid.step) return refuse(state, fail('step_none', MSG.stepNone()));
  const n = grid.columns.length;
  if (pump < 0 || turbine >= n || pump >= turbine) return refuse(state, fail('step_reversed', MSG.stepReversed()));
  const want = grid.inventory.level === 'exact' ? grid.inventory.step ?? 0 : undefined;
  if (want !== undefined && state.step.length >= want) return refuse(state, fail('step_count', MSG.stepCount(want)));
  const pair: StepPair = { pump, turbine };
  return { ok: true, state: { ...state, step: [...state.step, pair] } };
}

/** Remove the STEP pair at `index`. */
export function removeStep(state: PlayState, index: number): ActionResult {
  if (index < 0 || index >= state.step.length) return refuse(state, fail('empty', MSG.nothingHere()));
  return { ok: true, state: { ...state, step: state.step.filter((_, k) => k !== index) } };
}
