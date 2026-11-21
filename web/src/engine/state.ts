/*
 * Play state and board measures (pure, no DOM).
 * - PlayState: laid bars, exports per neighbor and column, STEP pairs. Never mutated: actions
 *   return a new state.
 * - Board measures: residual demand, effective silhouette (exports, pumping, turbining, several
 *   neighbors), cell counts per column, exchange totals, CO2.
 * - A piece's cells come from its shape (model/shapes.ts): rectangle or coal ramp.
 */
import {
  ANY_COUNTRY, IMPORT_PIECE, type EngagedClue, type Grid, type PieceId, type Placement, type StepPair,
} from '../model/grid';
import { cellCount, cellsOf } from '../model/shapes';

export interface PlacedBar extends Placement {
  /** Pre-placed by an `engaged` clue: cannot be removed. */
  locked?: boolean;
}

export interface PlayState {
  readonly bars: readonly Readonly<PlacedBar>[];
  readonly exports: Readonly<Record<string, readonly number[]>>;
  readonly step: readonly Readonly<StepPair>[];
}

export type ErrorCode =
  | 'unavailable' | 'country' | 'length' | 'height' | 'bounds' | 'silhouette' | 'overlap'
  | 'inventory' | 'stock' | 'line' | 'export' | 'surplus'
  | 'step_none' | 'step_reversed' | 'step_count' | 'co2' | 'locked' | 'empty';

export interface EngineError {
  code: ErrorCode;
  /** French text for the player. */
  message: string;
}

const engagedBar = (cl: EngagedClue): PlacedBar => ({
  piece: cl.piece, row: cl.row, col: cl.col, len: cl.len,
  ...(cl.height !== undefined ? { height: cl.height } : {}), locked: true,
});

const isEngaged = (grid: Grid, b: Placement) => grid.clues.some((cl) => cl.type === 'engaged'
  && cl.piece === b.piece && cl.row === b.row && cl.col === b.col && cl.len === b.len);

/** Empty board: no export, no STEP, only the engaged (locked) bars. */
export function newGame(grid: Grid): PlayState {
  const exports: Record<string, number[]> = {};
  for (const nb of grid.neighbors) exports[nb.id] = grid.columns.map(() => 0);
  const bars = grid.clues.flatMap((cl) => (cl.type === 'engaged' ? [engagedBar(cl)] : []));
  return { bars, exports, step: [] };
}

/** The reference solution as a play state. */
export function solutionState(grid: Grid): PlayState {
  const base = newGame(grid);
  const exports: Record<string, number[]> = {};
  for (const [id, vals] of Object.entries(base.exports)) exports[id] = [...(grid.solution.exports[id] ?? vals)];
  const bars = grid.solution.placements.map((p): PlacedBar => (isEngaged(grid, p) ? { ...p, locked: true } : { ...p }));
  return { bars, exports, step: grid.solution.step.map((s) => ({ ...s })) };
}

export const barHeight = (b: Placement) => b.height ?? 1;

/** The piece covers the cell (row, col). */
export const covers = (grid: Grid, b: Placement, row: number, col: number) =>
  col >= b.col && col < b.col + b.len && cellsOf(grid, b).some(([r, c]) => r === row && c === col);

/** Composition key of a bar: piece id, or `I:<country>` for imports. */
export const pieceKey = (b: Placement) => (b.piece === IMPORT_PIECE ? `I:${b.country ?? ''}` : b.piece);

/** Demand left to the dispatchable plants: demand - renewables - run-of-river (may be negative). */
export function residual(grid: Grid): number[] {
  return grid.demand.map((d, c) => d - (grid.weather.R[c] ?? 0) - (grid.weather.F[c] ?? 0));
}

/** Height to fill per column: residual + exports (all neighbors) + pumping - turbining (may be negative). */
export function rawSilhouette(grid: Grid, state: PlayState): number[] {
  const h = residual(grid);
  for (const vals of Object.values(state.exports)) vals.forEach((e, c) => { if (c < h.length) h[c]! += e; });
  for (const s of state.step) {
    if (s.pump >= 0 && s.pump < h.length) h[s.pump]! += 1;
    if (s.turbine >= 0 && s.turbine < h.length) h[s.turbine]! -= 1;
  }
  return h;
}

/** Effective silhouette: a negative height (unabsorbed surplus) counts as 0 cells. */
export function silhouette(grid: Grid, state: PlayState): number[] {
  return rawSilhouette(grid, state).map((v) => Math.max(0, v));
}

export function importsAt(state: PlayState, country: string, col: number, skip = -1): number {
  let k = 0;
  state.bars.forEach((b, i) => {
    // Imports are one-cell rectangles.
    if (i !== skip && b.piece === IMPORT_PIECE && b.country === country && col >= b.col && col < b.col + b.len) k += barHeight(b);
  });
  return k;
}

export const exportsAt = (state: PlayState, country: string, col: number) => state.exports[country]?.[col] ?? 0;

export function totalExports(state: PlayState, country: string): number {
  return (state.exports[country] ?? []).reduce((a, b) => a + b, 0);
}

/** Imported cells over the day, from one country or from all (`*`). */
export function totalImports(state: PlayState, country: string, skip = -1): number {
  let k = 0;
  state.bars.forEach((b, i) => {
    if (i !== skip && b.piece === IMPORT_PIECE && (country === ANY_COUNTRY || b.country === country)) {
      k += b.len * barHeight(b);
    }
  });
  return k;
}

/** Cells of one plant over the day. */
export function pieceCells(grid: Grid, state: PlayState, piece: PieceId, skip = -1): number {
  let k = 0;
  state.bars.forEach((b, i) => { if (i !== skip && b.piece === piece) k += cellCount(grid, b); });
  return k;
}

/** CO2 per cell of a bar (imports: the country's CO2). */
export function co2PerCell(grid: Grid, b: Placement): number {
  if (b.piece === IMPORT_PIECE) return grid.neighbors.find((nb) => nb.id === b.country)?.co2 ?? 0;
  return grid.pieces[b.piece]?.co2 ?? 0;
}

export function co2Total(grid: Grid, state: PlayState, skip = -1): number {
  let t = 0;
  state.bars.forEach((b, i) => { if (i !== skip) t += co2PerCell(grid, b) * cellCount(grid, b); });
  return t;
}

/** Index of the bar covering a cell, or -1. */
export function barIndexAt(grid: Grid, state: PlayState, row: number, col: number): number {
  return state.bars.findIndex((b) => covers(grid, b, row, col));
}
