/*
 * Laying gestures on the board (pure, no DOM).
 * - Drag: press on a start cell, release on an end cell; the rectangle between them is the bar.
 * - Two taps (phone, keyboard): tap the start cell, then the end cell. A one-cell-only piece is
 *   laid on the first tap; a second tap on the start cell drops it.
 * - `hover` is where the pointer last was: after a release or a tap it is that cell, so a stale
 *   cell from an earlier gesture never feeds the two-tap preview.
 * - The rectangle follows the piece shape: a piece one row high stays on the start row, a piece
 *   one slot wide stays in the start column. A drag of a piece one row high only follows columns
 *   (`alongShape`), so a vertical swipe never previews a bar.
 *
 * Example:
 *   let g = idle();
 *   g = press(g, {row: 0, col: 1});
 *   g = moveTo(g, {row: 0, col: 4});
 *   const r = release(g, {row: 0, col: 4}, shape);   // r.commit = {row: 0, col: 1, len: 4, height: 1}
 */

export interface Cell {
  row: number;
  col: number;
}

/** Allowed widths and heights of the selected piece. */
export interface Shape {
  lens: readonly number[];
  heights: readonly number[];
}

export interface Rect {
  row: number;
  col: number;
  len: number;
  height: number;
}

export interface GestureState {
  /** First tap of a two-tap gesture, waiting for the end cell. */
  readonly anchor: Cell | null;
  /** Pointer pressed: start cell and current cell. */
  readonly drag: { readonly start: Cell; readonly current: Cell } | null;
  /** Last cell under a hovering pointer (mouse), for the two-tap preview. */
  readonly hover: Cell | null;
}

export interface Release {
  state: GestureState;
  /** Rectangle to lay, when the gesture is complete. */
  commit: Rect | null;
  /** The tap landed on the anchor: the two-tap gesture was dropped. */
  dropped?: boolean;
}

const same = (a: Cell, b: Cell) => a.row === b.row && a.col === b.col;

export const idle = (): GestureState => ({ anchor: null, drag: null, hover: null });

/** A piece that can only be one cell: laid on the first tap. */
export const isSingleCell = (shape: Shape) =>
  Math.max(...shape.lens) === 1 && Math.max(...shape.heights) === 1;

/** Rectangle spanned by two cells, constrained by the piece shape. */
export function rectBetween(a: Cell, b: Cell, shape: Shape): Rect {
  const flat = Math.max(...shape.heights) === 1;
  const narrow = Math.max(...shape.lens) === 1;
  const row = flat ? a.row : Math.min(a.row, b.row);
  const height = flat ? 1 : Math.abs(a.row - b.row) + 1;
  const col = narrow ? a.col : Math.min(a.col, b.col);
  const len = narrow ? 1 : Math.abs(a.col - b.col) + 1;
  return { row, col, len, height };
}

/** A piece one row high: the board lets vertical swipes scroll the page (touch). */
export const isFlat = (shape: Shape) => Math.max(...shape.heights) === 1;

/**
 * Cell a drag from `start` stands for: a piece one row high stays on the start row, so a move
 * that only changes row is no move at all (no preview, and a release there is a tap).
 */
export function alongShape(start: Cell, cell: Cell, shape: Shape): Cell {
  return isFlat(shape) ? { row: start.row, col: cell.col } : cell;
}

export function press(state: GestureState, cell: Cell): GestureState {
  return { ...state, drag: { start: cell, current: cell } };
}

export function moveTo(state: GestureState, cell: Cell): GestureState {
  if (state.drag) {
    if (same(state.drag.current, cell)) return state;
    return { ...state, drag: { ...state.drag, current: cell }, hover: cell };
  }
  if (state.hover && same(state.hover, cell)) return state;
  return { ...state, hover: cell };
}

/** End of a press. A press that moved to another cell is a drag; otherwise it is a tap. */
export function release(state: GestureState, cell: Cell, shape: Shape): Release {
  const drag = state.drag;
  const base: GestureState = { ...state, drag: null, hover: cell };
  if (drag && !same(drag.start, cell)) {
    return { state: { ...base, anchor: null }, commit: rectBetween(drag.start, cell, shape) };
  }
  return tap(base, cell, shape);
}

/** A tap (or Enter on the keyboard cursor). */
export function tap(state: GestureState, cell: Cell, shape: Shape): Release {
  const base: GestureState = { ...state, drag: null, hover: cell };
  if (state.anchor && same(state.anchor, cell)) return { state: { ...base, anchor: null }, commit: null, dropped: true };
  if (state.anchor) return { state: { ...base, anchor: null }, commit: rectBetween(state.anchor, cell, shape) };
  if (isSingleCell(shape)) return { state: base, commit: rectBetween(cell, cell, shape) };
  return { state: { ...base, anchor: cell }, commit: null };
}

/** Forget any gesture in progress (Escape, piece change, pointer cancel). */
export const cancel = (state: GestureState): GestureState => ({ ...state, anchor: null, drag: null, hover: null });

/** Rectangle to preview: the drag in progress, or the anchor to the hovered cell. */
export function previewRect(state: GestureState, shape: Shape): Rect | null {
  if (state.drag) {
    const { start, current } = state.drag;
    if (same(start, current) && !state.anchor) return isSingleCell(shape) ? rectBetween(start, start, shape) : null;
    // Pressing the anchor again drops it on release: nothing to preview.
    if (same(start, current) && state.anchor && same(state.anchor, start)) return null;
    return rectBetween(state.anchor && same(start, current) ? state.anchor : start, current, shape);
  }
  if (state.anchor && state.hover && !same(state.anchor, state.hover)) return rectBetween(state.anchor, state.hover, shape);
  return null;
}
