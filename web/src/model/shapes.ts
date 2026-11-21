/*
 * Piece shapes, cell by cell (pure).
 * - A shape is a profile: per column, the (bottom offset, height) of the piece from its lower-left
 *   corner. Rectangles come from `len` x `height`; coal ramps from `pieces.C.shape`:
 *   - trap: 1 -> 2 -> 1, total width `len` (>= 3), plateau on the row above the base;
 *   - stair: 2 -> 1, two cells on `len` - 1 slots then a one-cell step on the right (`len` >= 2).
 * - A placement keeps its §14 fields {piece, row, col, len[, height]}: `row` is the base row of a
 *   ramp, and the shape comes from the grid's piece definition.
 *
 * Example: cellsOf(grid, {piece: 'C', row: 1, col: 2, len: 4})
 *          -> [[1,2], [1,3], [2,3], [1,4], [2,4], [1,5]]
 */
import type { Grid, PieceDef, Placement } from './grid';

export const SHAPE_KINDS = ['rect', 'trap', 'stair'] as const;
export type ShapeKind = (typeof SHAPE_KINDS)[number];

/** Ramps: the only piece that can take one, and the least total width of each profile. */
export const RAMP_PIECE = 'C';
export const RAMP_MIN_WIDTH: Record<Exclude<ShapeKind, 'rect'>, number> = { trap: 3, stair: 2 };

/** Per column of the piece: bottom offset and height, from its lower-left cell. */
export type Profile = readonly (readonly [number, number])[];

export const isRamp = (kind: ShapeKind) => kind !== 'rect';

/** Shape of a piece definition (imports and pieces without `shape` are rectangles). */
export const shapeKind = (def: Pick<PieceDef, 'shape'> | undefined): ShapeKind => def?.shape ?? 'rect';

/** Profile of a shape of width `len` (and `height` for a rectangle). */
export function profile(kind: ShapeKind, len: number, height = 1): Profile {
  const cols: [number, number][] = [];
  for (let i = 0; i < len; i++) {
    if (kind === 'trap') cols.push([0, i === 0 || i === len - 1 ? 1 : 2]);
    else if (kind === 'stair') cols.push([0, i === len - 1 ? 1 : 2]);
    else cols.push([0, height]);
  }
  return cols;
}

/** Shape kind of a placement on a grid. */
export const kindOf = (grid: Grid, b: Placement): ShapeKind =>
  (b.piece === 'I' ? 'rect' : shapeKind(grid.pieces[b.piece]));

export const profileOf = (grid: Grid, b: Placement): Profile => profile(kindOf(grid, b), b.len, b.height ?? 1);

/** Cells `[row, col]` of a placement, column by column from the bottom. */
export function cellsOf(grid: Grid, b: Placement): [number, number][] {
  const out: [number, number][] = [];
  profileOf(grid, b).forEach(([bottom, h], i) => {
    for (let k = 0; k < h; k++) out.push([b.row + bottom + k, b.col + i]);
  });
  return out;
}

/** Cells of a placement in one column. */
export function cellsInColumn(grid: Grid, b: Placement, col: number): number {
  if (col < b.col || col >= b.col + b.len) return 0;
  return profileOf(grid, b)[col - b.col]?.[1] ?? 0;
}

/** Number of cells of a placement. */
export const cellCount = (grid: Grid, b: Placement) => profileOf(grid, b).reduce((a, [, h]) => a + h, 0);

/** Highest row + 1 the placement reaches in column `col` (0 outside it). */
export function topIn(grid: Grid, b: Placement, col: number): number {
  if (col < b.col || col >= b.col + b.len) return 0;
  const [bottom, h] = profileOf(grid, b)[col - b.col] ?? [0, 0];
  return b.row + bottom + h;
}
