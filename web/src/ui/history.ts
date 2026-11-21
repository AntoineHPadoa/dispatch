/*
 * Undo history (pure, immutable): a present value and the past values before it.
 * - push: record a new present; undo: go back one step; reset: back to a start value, undoable.
 *
 * Example: let h = start(s0); h = push(h, s1); h = undo(h);   // h.present === s0
 */

export interface History<T> {
  readonly past: readonly T[];
  readonly present: T;
}

/** Cap on remembered steps, to bound memory on long sessions. */
export const MAX_PAST = 500;

export const start = <T>(present: T): History<T> => ({ past: [], present });

export function push<T>(h: History<T>, next: T): History<T> {
  if (next === h.present) return h;
  const past = [...h.past, h.present];
  return { past: past.length > MAX_PAST ? past.slice(past.length - MAX_PAST) : past, present: next };
}

export const canUndo = <T>(h: History<T>) => h.past.length > 0;

export function undo<T>(h: History<T>): History<T> {
  if (!canUndo(h)) return h;
  return { past: h.past.slice(0, -1), present: h.past[h.past.length - 1] as T };
}

/** Back to `initial`; the cleared board can itself be undone. */
export const reset = <T>(h: History<T>, initial: T): History<T> => push(h, initial);
