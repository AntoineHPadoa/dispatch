/*
 * STEP (pumped storage) taps as pure functions, shared by the game screen and the tests.
 * - stepTapResult: the first tap on a slot pumps (pending), a tap on a strictly later slot turbines
 *   and adds the pair; every refusal comes with the message to show and leaves the pending slot as is.
 * - stepPairIndexAt: index of the pair pumping or turbining in a column (tap on its ▲ or ▼ removes it).
 * - stepUndoPlan: a pending pump is not in the undo history, so Undo drops it before any recorded action.
 * - stepEraseResult: the eraser on the pending slot drops the pump (nothing else lives there yet).
 */
import type { Grid } from '../model/grid';
import { addStep, type PlayState } from '../engine';
import { MSG, UI, columnLabel } from '../i18n/fr';
import { publishedStepPairs } from './panels';

export type StepTone = 'ok' | 'bad' | 'info';

export interface StepTapResult {
  /** Slot of the pending pump after the tap, or null. */
  pending: number | null;
  /** New play state when a pair was added. */
  state?: PlayState;
  message: { text: string; tone: StepTone };
}

export function stepTapResult(grid: Grid, state: PlayState, pending: number | null, col: number): StepTapResult {
  const at = (c: number) => columnLabel(grid, c);
  const bad = (text: string): StepTapResult => ({ pending, message: { text, tone: 'bad' } });
  if (pending === null) {
    if (col === grid.columns.length - 1) return bad(UI.stepLastSlot);
    const want = publishedStepPairs(grid);
    if (grid.inventory.level === 'exact' && want !== null && state.step.length >= want) return bad(MSG.stepCount(want));
    return { pending: col, message: { text: UI.stepPending(at(col)), tone: 'info' } };
  }
  if (col <= pending) return bad(UI.stepTooEarly(at(pending)));
  const res = addStep(grid, state, pending, col);
  if (!res.ok) return bad(res.error.message);
  return { pending: null, state: res.state, message: { text: UI.stepAdded(at(pending), at(col)), tone: 'ok' } };
}

/** Index of the STEP pair pumping or turbining in `col`, or -1. */
export function stepPairIndexAt(state: PlayState, col: number): number {
  return state.step.findIndex((p) => p.pump === col || p.turbine === col);
}

/** An arrow tap: the chosen ▲ cancels the pending pump, any other arrow goes through stepTapResult. */
export const stepArrowAction = (pending: number | null, col: number): 'cancel' | 'tap' => (pending === col ? 'cancel' : 'tap');

/** What Undo does: drop the pending pump first (it is not recorded), else undo the last recorded action. */
export function stepUndoPlan(pending: number | null): 'drop-pending' | 'undo' {
  return pending === null ? 'undo' : 'drop-pending';
}

/** The eraser on the pending slot drops the pump; elsewhere it leaves the pending pump alone. */
export function stepEraseResult(pending: number | null, col: number): { pending: number | null; dropped: boolean } {
  return pending !== null && pending === col ? { pending: null, dropped: true } : { pending, dropped: false };
}
