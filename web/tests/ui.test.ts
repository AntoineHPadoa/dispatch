/*
 * Pure UI logic: laying gestures (drag, two taps, shape constraints), undo history, saved
 * progress (parsing, status, storage failures), grid of the day and play order, board geometry.
 */
import { describe, expect, it } from 'vitest';
import gridsJson from '../src/data/grids.json';
import type { Grid } from '../src/model/grid';
import { evaluate, newGame, place, solutionState } from '../src/engine';
import {
  cancel, idle, isSingleCell, moveTo, press, previewRect, rectBetween, release, tap, type Shape,
} from '../src/ui/gesture';
import { canUndo, MAX_PAST, push, reset, start, undo } from '../src/ui/history';
import {
  ProgressStore, STORAGE_KEY, dailyGrid, emptyProgress, isPlayState, localDayNumber, nextGrid, parseProgress,
  playOrder, recordState, statusOf, type KeyValueStore,
} from '../src/ui/progress';
import { boardGeometry, cellAt, lockedExports, maxStepPairs, renderBoard } from '../src/ui/board';
import { applyLockedExports, displayTitle, initialState, nextExportValue } from '../src/ui/game';
import { bookEntries, isDayClue, renderBook, renderCo2, richClueText } from '../src/ui/panels';
import { renderSheet } from '../src/ui/print';

const grids = gridsJson as unknown as Grid[];
const byId = (id: number) => structuredClone(grids.find((g) => g.id === id)!);

const BAR: Shape = { lens: [3, 4, 5, 6], heights: [1] };
const CELL: Shape = { lens: [1], heights: [1] };
const TALL: Shape = { lens: [1], heights: [2, 3] };
const RECT: Shape = { lens: [2, 3], heights: [1, 2] };

describe('gestures', () => {
  it('a drag along a row gives the bar between start and end cells', () => {
    let g = press(idle(), { row: 1, col: 4 });
    g = moveTo(g, { row: 1, col: 2 });
    const r = release(g, { row: 1, col: 1 }, BAR);
    expect(r.commit).toEqual({ row: 1, col: 1, len: 4, height: 1 });
    expect(r.state.drag).toBeNull();
    expect(r.state.anchor).toBeNull();
  });

  it('a flat piece stays on the start row when the drag drifts', () => {
    expect(rectBetween({ row: 2, col: 0 }, { row: 4, col: 3 }, BAR)).toEqual({ row: 2, col: 0, len: 4, height: 1 });
  });

  it('a one-slot piece stays in the start column; a tall piece spans rows', () => {
    expect(rectBetween({ row: 0, col: 3 }, { row: 2, col: 5 }, TALL)).toEqual({ row: 0, col: 3, len: 1, height: 3 });
    expect(rectBetween({ row: 3, col: 4 }, { row: 2, col: 2 }, RECT)).toEqual({ row: 2, col: 2, len: 3, height: 2 });
  });

  it('two taps: the first sets the anchor, the second lays the bar', () => {
    const first = release(press(idle(), { row: 0, col: 1 }), { row: 0, col: 1 }, BAR);
    expect(first.commit).toBeNull();
    expect(first.state.anchor).toEqual({ row: 0, col: 1 });
    const second = release(press(first.state, { row: 0, col: 4 }), { row: 0, col: 4 }, BAR);
    expect(second.commit).toEqual({ row: 0, col: 1, len: 4, height: 1 });
    expect(second.state.anchor).toBeNull();
  });

  it('a one-cell-only piece is laid on the first tap', () => {
    expect(isSingleCell(CELL)).toBe(true);
    expect(isSingleCell(TALL)).toBe(false);
    expect(tap(idle(), { row: 2, col: 3 }, CELL).commit).toEqual({ row: 2, col: 3, len: 1, height: 1 });
  });

  it('keyboard taps work like touches; cancel forgets the anchor', () => {
    const a = tap(idle(), { row: 0, col: 0 }, BAR);
    expect(cancel(a.state).anchor).toBeNull();
    expect(tap(a.state, { row: 0, col: 2 }, BAR).commit).toEqual({ row: 0, col: 0, len: 3, height: 1 });
  });

  it('preview: the drag in progress, or the anchor to the hovered cell, never the lone anchor', () => {
    let g = press(idle(), { row: 0, col: 0 });
    expect(previewRect(g, BAR)).toBeNull();
    expect(previewRect(g, CELL)).toEqual({ row: 0, col: 0, len: 1, height: 1 });
    g = moveTo(g, { row: 0, col: 2 });
    expect(previewRect(g, BAR)).toEqual({ row: 0, col: 0, len: 3, height: 1 });
    const anchored = tap(idle(), { row: 1, col: 1 }, BAR).state;
    expect(previewRect(anchored, BAR)).toBeNull();
    expect(previewRect(moveTo(anchored, { row: 1, col: 5 }), BAR)).toEqual({ row: 1, col: 1, len: 5, height: 1 });
  });
});

describe('history', () => {
  it('undo walks back, never past the start', () => {
    let h = start('a');
    expect(canUndo(h)).toBe(false);
    h = push(push(h, 'b'), 'c');
    h = undo(h);
    expect(h.present).toBe('b');
    h = undo(undo(h));
    expect(h.present).toBe('a');
    expect(canUndo(h)).toBe(false);
  });

  it('pushing the same value is a no-op; reset is undoable', () => {
    const h = start('a');
    expect(push(h, 'a')).toBe(h);
    const r = reset(push(h, 'b'), 'a');
    expect(r.present).toBe('a');
    expect(undo(r).present).toBe('b');
  });

  it('keeps at most MAX_PAST steps', () => {
    let h = start(0);
    for (let i = 1; i <= MAX_PAST + 20; i++) h = push(h, i);
    expect(h.past.length).toBe(MAX_PAST);
    expect(h.present).toBe(MAX_PAST + 20);
  });
});

describe('progress', () => {
  const g1 = byId(1);
  const s1 = solutionState(g1);

  it('status: new, then started, then done (and done sticks)', () => {
    let p = emptyProgress();
    expect(statusOf(p, 1)).toBe('new');
    p = recordState(p, 1, newGame(g1), 1000, false);
    expect(statusOf(p, 1)).toBe('started');
    p = recordState(p, 1, s1, 2000, true);
    expect(statusOf(p, 1)).toBe('done');
    p = recordState(p, 1, newGame(g1), 3000, false);
    expect(statusOf(p, 1)).toBe('done');
  });

  it('parsing keeps well-formed entries only', () => {
    expect(parseProgress(null)).toEqual(emptyProgress());
    expect(parseProgress('{not json')).toEqual(emptyProgress());
    const raw = JSON.stringify({ grids: {
      1: { status: 'started', state: s1, elapsedMs: 5 },
      2: { status: 'weird' },
      3: { status: 'done', state: { bars: 'x' }, elapsedMs: -1 },
    } });
    const p = parseProgress(raw);
    expect(Object.keys(p.grids)).toEqual(['1', '3']);
    expect(p.grids['1']?.state).toEqual(JSON.parse(JSON.stringify(s1)));
    expect(p.grids['3']).toEqual({ status: 'done' });
    expect(isPlayState({ bars: [], exports: { DE: [0, 1] }, step: [{ pump: 0, turbine: 2 }] })).toBe(true);
    expect(isPlayState({ bars: [{ piece: 'N', row: 0, col: 0 }], exports: {}, step: [] })).toBe(false);
  });

  it('a store that throws never breaks the game', () => {
    const broken: KeyValueStore = {
      getItem: () => { throw new Error('blocked'); },
      setItem: () => { throw new Error('full'); },
    };
    const store = new ProgressStore(() => broken);
    expect(store.get()).toEqual(emptyProgress());
    const p = recordState(store.get(), 1, s1, 1, true);
    expect(() => store.set(p)).not.toThrow();
    expect(statusOf(store.get(), 1)).toBe('done');
    expect(new ProgressStore(() => { throw new Error('no storage'); }).get()).toEqual(emptyProgress());
  });

  it('round-trips through a working store', () => {
    const data = new Map<string, string>();
    const kv: KeyValueStore = { getItem: (k) => data.get(k) ?? null, setItem: (k, v) => { data.set(k, v); } };
    new ProgressStore(() => kv).set(recordState(emptyProgress(), 7, s1, 42, false));
    expect(data.has(STORAGE_KEY)).toBe(true);
    expect(statusOf(new ProgressStore(() => kv).get(), 7)).toBe('started');
  });

  it('two stores on one storage keep each other\'s grids', () => {
    const data = new Map<string, string>();
    const kv: KeyValueStore = { getItem: (k) => data.get(k) ?? null, setItem: (k, v) => { data.set(k, v); } };
    const a = new ProgressStore(() => kv);
    const b = new ProgressStore(() => kv);
    b.set(recordState(b.get(), 8, s1, 10, true));
    // a never saw grid 8: saving grid 9 must not erase it
    a.set(recordState(a.get(), 9, s1, 5, false));
    const fresh = new ProgressStore(() => kv).get();
    expect(statusOf(fresh, 8)).toBe('done');
    expect(statusOf(fresh, 9)).toBe('started');
    expect(statusOf(a.get(), 8)).toBe('done');
    // refresh picks up what another store wrote since
    b.set(recordState(b.get(), 1, s1, 5, false));
    a.refresh();
    expect(statusOf(a.get(), 1)).toBe('started');
    // data cleared while a page is open: a only rewrites what it changed
    data.clear();
    a.set(recordState(a.get(), 2, s1, 5, false));
    expect(statusOf(new ProgressStore(() => kv).get(), 2)).toBe('started');
    expect(statusOf(new ProgressStore(() => kv).get(), 9)).toBe('new');
  });

  it('grid of the day: a rated grid, stable over the day, changing the next day', () => {
    const morning = dailyGrid(grids, new Date(2026, 10, 21, 7));
    const evening = dailyGrid(grids, new Date(2026, 10, 21, 23, 59));
    const tomorrow = dailyGrid(grids, new Date(2026, 10, 22, 7));
    expect(morning?.section).toBe('rated');
    expect(evening?.id).toBe(morning?.id);
    expect(tomorrow?.id).not.toBe(morning?.id);
    expect(localDayNumber(new Date(1970, 0, 2))).toBe(1);
    const rated = grids.filter((g) => g.section === 'rated');
    const seen = new Set(Array.from({ length: rated.length }, (_, d) => dailyGrid(grids, new Date(2026, 0, 1 + d))?.id));
    expect(seen.size).toBe(rated.length);
  });

  it('play order: tutorials then rated grids; next grid follows it', () => {
    const order = playOrder(grids).map((g) => g.section);
    expect(order.lastIndexOf('tutorial')).toBeLessThan(order.indexOf('rated'));
    expect(nextGrid(grids, 7)?.section).toBe('rated');
    expect(nextGrid(grids, playOrder(grids).slice(-1)[0]!.id)).toBeNull();
  });
});

describe('board and game helpers', () => {
  it('geometry covers the highest silhouette and maps points to cells', () => {
    const g = byId(10);
    const geo = boardGeometry(g, 'A', 50);
    const top = Math.max(...g.demand) + g.neighbors.reduce((a, nb) => a + nb.cap, 0);
    expect(geo.rows).toBe(top);
    expect(cellAt(geo, 0, (geo.rows - 1) * 50 + 1)).toEqual({ row: 0, col: 0 });
    expect(cellAt(geo, 50 * 3 + 10, (geo.rows - 3) * 50 + 10)).toEqual({ row: 2, col: 3 });
    expect(cellAt(geo, -1, 10)).toBeNull();
    expect(cellAt(geo, 50 * g.columns.length + 1, 10)).toBeNull();
    expect(boardGeometry(g, 'B', 40).rows).toBe(Math.max(...g.demand));
  });

  it('export flows are fixed from the start and re-applied on saved boards', () => {
    const g = byId(7);
    const locked = lockedExports(g);
    expect(locked.size).toBeGreaterThan(0);
    const s = initialState(g);
    for (const [key, v] of locked) {
      const [country, col] = key.split(':') as [string, string];
      expect(s.exports[country]?.[Number(col)]).toBe(v);
    }
    expect(applyLockedExports(g, newGame(g))).toEqual(s);
  });

  it('tapping a neighbor pill cycles the export within the line capacity', () => {
    expect(nextExportValue(0, 0, 1)).toBe(1);
    expect(nextExportValue(1, 0, 1)).toBe(0);
    expect(nextExportValue(0, 1, 1)).toBe(0);
    expect(nextExportValue(1, 0, 3)).toBe(2);
  });

  it('STEP pairs: from the inventory or the exchanges clue', () => {
    expect(maxStepPairs(byId(7))).toBe(1);
    expect(maxStepPairs(byId(1))).toBe(0);
  });

  it('every grid renders on screen and on paper; paper never shows the answer', () => {
    for (const g of grids) {
      const s = solutionState(g);
      const screen = renderBoard({ grid: g, state: s, ev: evaluate(g, s), style: 'A', cell: 50, interactive: true }).svg;
      expect(screen).toContain('<svg');
      const sheet = renderSheet(g, null);
      const laid = s.bars.filter((b) => !b.locked).length;
      expect(laid).toBeGreaterThan(0);
      // Paper draws only engaged plants: no unlocked plant fill colour for a laid bar at row 0.
      expect(sheet).not.toContain('class="state');
      expect(sheet).not.toContain('▲ pompe');
    }
  });

  it('invalid plants are hatched, not removed', () => {
    const g = byId(1);
    let s = newGame(g);
    const r = place(g, s, { piece: 'T', row: 3, col: 2, len: 1 });
    expect(r.ok).toBe(true);
    if (r.ok) s = r.state;
    const lowered = { ...g, demand: g.demand.map((d, c) => (c === 2 ? 3 : d)) };
    const ev = evaluate(lowered, s);
    expect(ev.invalidBars).toEqual([0]);
    expect(renderBoard({ grid: lowered, state: s, ev, style: 'A', cell: 50 }).svg).toContain('url(#hX');
  });

  it('book: exact inventory marks laid bars, no inventory shows shapes and the dam stock', () => {
    const g1 = byId(1);
    const s = solutionState(g1);
    expect(renderBook(g1, s, 'N')).toContain('mb used');
    expect(renderBook(g1, newGame(g1), 'N')).not.toContain('mb used');
    const g8 = byId(8);
    expect(bookEntries(g8).map((e) => e.key)).toEqual(['N', 'B', 'I:DE']);
    expect(renderBook(g8, newGame(g8), null)).toContain('stock : 2 cases');
    expect(renderBook(g8, newGame(g8), null, true)).not.toContain('posée');
  });

  it('clue texts get plant chips and slot values; day clues are the unslotted ones', () => {
    const g = byId(7);
    const price = g.clues.find((c) => c.type === 'price')!;
    const html = richClueText(g, price);
    expect(html).toContain('class="pc"');
    expect(html).toContain('class="slot"');
    expect(isDayClue(price)).toBe(false);
    expect(isDayClue({ type: 'length', piece: 'N', len: 4 })).toBe(true);
  });

  it('display titles: tutorials lose their number, rated grids get one', () => {
    expect(displayTitle(byId(1))).toBe('Poser l’inventaire'.replace('’', "'"));
    expect(displayTitle(byId(8))).toBe('Grille n° 8');
  });
});

describe('print sheet', () => {
  /** Grid 1 plus weather, an engaged plant and a CO2 cap: mechanics no shipped grid has yet. */
  function rich(): Grid {
    const g = byId(1);
    g.demand = g.demand.map((d, c) => d + 1 + (c === 1 ? 1 : 0));
    g.weather = { R: g.columns.map((_, c) => (c === 1 ? 1 : 0)), F: g.columns.map(() => 1) };
    g.co2_cap = 9;
    g.clues = [...g.clues, { type: 'engaged', piece: 'T', row: 3, col: 2, len: 1 }];
    return g;
  }

  it('shows the imposed plants and weather, the CO2 rule, never a status or the answer', () => {
    const g = rich();
    const sheet = renderSheet(g, 1);
    expect(sheet).toContain('url(#hF');
    expect(sheet).toContain('url(#hR');
    expect(sheet).toContain('<g transform'); // lock on the engaged plant
    expect(sheet).toContain('Plafond CO₂');
    expect(sheet).toContain('points au plus');
    expect(sheet).not.toContain('class="state');
    expect(sheet).toContain('Dispatch · n° 1');
    // Only the engaged plant is drawn: one plant rectangle with the TAC paper colour.
    expect(sheet.match(/fill="#f0b8c4"/g)?.length).toBe(1);
  });

  it('on screen, the CO2 gauge counts points and flags an overflow', () => {
    const g = rich();
    const s = initialState(g);
    const r = place(g, s, { piece: 'T', row: 0, col: 0, len: 1 });
    expect(r.ok).toBe(true);
    const html = renderCo2(g, r.ok ? r.state : s);
    expect(html).toContain('4 points sur 9');
    expect(html).not.toContain('gauge over');
  });
});
