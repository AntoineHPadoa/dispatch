/*
 * Laying over placed bars (placeOver): covered bars are replaced in one action, engaged bars
 * never are, the covered bars go back to the inventory before the budget check, and an undo
 * restores the board as it was.
 */
import { describe, expect, it } from 'vitest';
import { gridById } from './legacy';
import type { Placement } from '../src/model/grid';
import { checkPlaceOver, newGame, place, placeOver, type ActionResult, type PlayState } from '../src/engine';
import { push, start, undo } from '../src/ui/history';

const byId = gridById;

function ok(r: ActionResult): PlayState {
  if (!r.ok) throw new Error(`unexpected refusal: ${r.error.message}`);
  return r.state;
}

// Grid 1: demand [2, 2, 4, 3, 2, 3]; inventory N 6, 6 · G 2 · T ×2.
const g1 = byId(1);
const N = (row: number, col: number, len: number): Placement => ({ piece: 'N', row, col, len });
const T = (row: number, col: number): Placement => ({ piece: 'T', row, col, len: 1 });

describe('placeOver', () => {
  it('replaces one covered bar', () => {
    const s = ok(place(g1, newGame(g1), N(0, 0, 6)));
    const r = placeOver(g1, s, { piece: 'G', row: 0, col: 2, len: 2 });
    expect(r.ok).toBe(true);
    expect(r.replaced.map((b) => b.piece)).toEqual(['N']);
    expect(ok(r).bars).toEqual([{ piece: 'G', row: 0, col: 2, len: 2 }]);
  });

  it('replaces several covered bars at once', () => {
    let s = ok(place(g1, newGame(g1), T(2, 2)));
    s = ok(place(g1, s, T(2, 3)));
    const r = placeOver(g1, s, { piece: 'G', row: 2, col: 2, len: 2 });
    expect(r.replaced).toHaveLength(2);
    expect(ok(r).bars.map((b) => b.piece)).toEqual(['G']);
    expect(checkPlaceOver(g1, s, { piece: 'G', row: 2, col: 2, len: 2 })).toEqual({ ok: true, replaced: [0, 1] });
  });

  it('lays like place() when nothing is covered', () => {
    const r = placeOver(g1, newGame(g1), N(0, 0, 6));
    expect(r.ok).toBe(true);
    expect(r.replaced).toEqual([]);
  });

  it('never replaces an engaged plant', () => {
    const g = byId(1);
    g.clues = [...g.clues, { type: 'engaged', piece: 'T', row: 3, col: 2, len: 1 }];
    const s = newGame(g);
    const r = placeOver(g, s, T(3, 2));
    expect(r.ok).toBe(false);
    if (r.ok) return;
    expect(r.error.code).toBe('locked');
    expect(r.error.message).toContain('engagé');
    expect(r.state).toBe(s);
  });

  it('gives the covered bars back to the inventory before checking it', () => {
    let s = ok(place(g1, newGame(g1), N(0, 0, 6)));
    s = ok(place(g1, s, N(1, 0, 6)));
    // Both 6-slot bars are laid: a third is refused by place(), accepted over one of them.
    expect(place(g1, s, N(1, 0, 6)).ok).toBe(false);
    const r = placeOver(g1, s, N(1, 0, 6));
    expect(r.ok).toBe(true);
    expect(ok(r).bars).toHaveLength(2);
  });

  it('still refuses an exhausted inventory, a wrong shape or the outside of the silhouette', () => {
    let s = ok(place(g1, newGame(g1), T(2, 2)));
    s = ok(place(g1, s, T(3, 2)));
    const third = placeOver(g1, s, T(2, 3));
    expect(third.ok).toBe(false);
    if (!third.ok) expect(third.error.code).toBe('inventory');
    const shape = placeOver(g1, s, { piece: 'G', row: 2, col: 2, len: 1 });
    expect(shape.ok).toBe(false);
    if (!shape.ok) expect(shape.error.code).toBe('length');
    const outside = placeOver(g1, s, { piece: 'G', row: 3, col: 2, len: 2 });
    expect(outside.ok).toBe(false);
    if (!outside.ok) {
      expect(outside.error.code).toBe('silhouette');
      expect(outside.state).toBe(s);
    }
    expect(outside.replaced.map((b) => b.piece)).toEqual(['T']);
  });

  it('is one undo step: undo brings back every replaced bar', () => {
    let s = ok(place(g1, newGame(g1), T(2, 2)));
    s = ok(place(g1, s, T(2, 3)));
    let h = start(s);
    h = push(h, ok(placeOver(g1, s, { piece: 'G', row: 2, col: 2, len: 2 })));
    expect(h.present.bars.map((b) => b.piece)).toEqual(['G']);
    h = undo(h);
    expect(h.present).toBe(s);
    expect(h.present.bars.map((b) => b.piece)).toEqual(['T', 'T']);
  });
});
