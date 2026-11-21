/*
 * Pure UI logic: laying gestures (drag, two taps, shape constraints), undo history, saved
 * progress (parsing, status, storage failures), grid of the day and play order, board geometry.
 */
import { describe, expect, it } from 'vitest';
import gridsJson from '../src/data/grids.json';
import type { Grid } from '../src/model/grid';
import { evaluate, newGame, place, solutionState } from '../src/engine';
import {
  alongShape, cancel, idle, isFlat, isSingleCell, moveTo, press, previewRect, rectBetween, release, tap, type Shape,
} from '../src/ui/gesture';
import { canUndo, MAX_PAST, push, reset, start, undo } from '../src/ui/history';
import {
  ProgressStore, STORAGE_KEY, dailyGrid, emptyProgress, isPlayState, localDayNumber, nextGrid, parseProgress,
  playOrder, recordState, statusOf, type KeyValueStore,
} from '../src/ui/progress';
import { boardGeometry, cellAt, lockedExports, maxStepPairs, renderBoard } from '../src/ui/board';
import {
  applyLockedExports, boardMessage, displayTitle, exportTap, initialState, isInitialState, newlyBroken, nextExportValue,
  poseMessage, techniqueLine,
} from '../src/ui/game';
import { MSG, durationText } from '../src/i18n/fr';
import { STEP_KEY, bookEntries, isDayClue, publishedStepPairs, renderBook, renderCo2, richClueText } from '../src/ui/panels';
import { renderSheet, slotLegend } from '../src/ui/print';
import { stepEraseResult, stepPairIndexAt, stepTapResult, stepUndoPlan } from '../src/ui/step';
import { UI } from '../src/i18n/fr';

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

describe('gestures after another gesture', () => {
  it('a drag, then a tap elsewhere: the anchor alone, no stale preview', () => {
    let g = press(idle(), { row: 0, col: 0 });
    g = moveTo(g, { row: 0, col: 5 });
    const dragged = release(g, { row: 0, col: 5 }, BAR);
    expect(dragged.commit).not.toBeNull();
    const pressed = press(dragged.state, { row: 1, col: 0 });
    expect(previewRect(pressed, BAR)).toBeNull();
    const first = release(pressed, { row: 1, col: 0 }, BAR);
    expect(first.state.anchor).toEqual({ row: 1, col: 0 });
    expect(previewRect(first.state, BAR)).toBeNull();
  });

  it('a drag ending on another row does not leak into the next two-tap preview', () => {
    let g = press(idle(), { row: 0, col: 0 });
    g = moveTo(g, { row: 2, col: 1 });
    const first = tap(release(g, { row: 2, col: 1 }, BAR).state, { row: 1, col: 3 }, BAR);
    expect(previewRect(first.state, BAR)).toBeNull();
    expect(previewRect(cancel(moveTo(idle(), { row: 0, col: 4 })), BAR)).toBeNull();
  });

  it('a second tap on the anchor drops it, with nothing to lay or preview', () => {
    const a = tap(idle(), { row: 1, col: 0 }, BAR);
    const again = press(a.state, { row: 1, col: 0 });
    expect(previewRect(again, BAR)).toBeNull();
    const r = release(again, { row: 1, col: 0 }, BAR);
    expect(r.commit).toBeNull();
    expect(r.dropped).toBe(true);
    expect(r.state.anchor).toBeNull();
    expect(tap(a.state, { row: 1, col: 0 }, BAR).dropped).toBe(true);
    // A one-cell piece is still laid on a single tap.
    expect(tap(idle(), { row: 1, col: 0 }, CELL).commit).toEqual({ row: 1, col: 0, len: 1, height: 1 });
  });
});

describe('pose messages', () => {
  it('a pose that contradicts a clue says so in the bad tone', () => {
    const g2 = byId(2);
    const price = g2.clues.find((c) => c.type === 'price')!;
    if (price.type !== 'price') throw new Error('price clue expected');
    const s0 = newGame(g2);
    const other = (['T', 'G', 'N'] as const).find((p) => p !== price.piece && g2.pieces[p])!;
    const r = place(g2, s0, { piece: other, row: 0, col: price.col, len: 1 });
    const before = evaluate(g2, s0).clues;
    const after = evaluate(g2, r.ok ? r.state : s0).clues;
    const broken = newlyBroken(before, after);
    expect(broken?.clue).toBe(price);
    const m = poseMessage(g2, 'TAC à 16h, ligne 1', [], broken);
    expect(m.tone).toBe('bad');
    expect(m.text).toMatch(/^TAC à 16h, ligne 1 : contredit l’indice « .+ fixe le prix »\.$/);
  });

  it('without a contradiction: replaced plants, else the pose fits', () => {
    const g1 = byId(1);
    expect(poseMessage(g1, 'TAC à 8h, ligne 2', [], null)).toEqual({ text: 'TAC à 8h, ligne 2 : la pose tient.', tone: 'ok' });
    expect(poseMessage(g1, 'TAC à 8h, ligne 2', [{ piece: 'N' }], null).text).toBe('TAC à 8h, ligne 2 : remplace 1 barre de nucléaire.');
    const ok = [{ clue: byId(2).clues[0]!, text: '', status: 'broken' as const }];
    expect(newlyBroken(ok, ok)).toBeNull();
  });

  it('durations never wrap inside', () => {
    expect(durationText(254000)).toBe('4\u00a0min\u00a014\u00a0s');
    expect(durationText(9000)).toBe('9\u00a0s');
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
    // Paper is a full rectangle at the same maximum height as the screen.
    expect(boardGeometry(g, 'B', 40).rows).toBe(top);
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
    expect(displayTitle(byId(1))).toBe('Poser l’inventaire');
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

describe('STEP in the order book', () => {
  const g7 = byId(7);

  it('is a book entry with its published pairs, or pairs to deduce', () => {
    expect(bookEntries(g7).map((e) => e.key)).toContain(STEP_KEY);
    expect(bookEntries(byId(1)).map((e) => e.key)).not.toContain(STEP_KEY);
    expect(publishedStepPairs(g7)).toBe(1);
    const html = renderBook(g7, initialState(g7), STEP_KEY);
    expect(html).toContain('data-piece="STEP"');
    expect(html).toContain('1 paire');
    expect(html).toContain('0 / 1');
    const free = { ...structuredClone(g7), inventory: { level: 'none' as const, pieces: { N: {} } } };
    expect(publishedStepPairs(free)).toBeNull();
    expect(renderBook(free, newGame(free), null)).toContain('paires à déduire');
  });

  it('screen: no STEP row; tags removable by a tap, linked by a line; pending pump drawn', () => {
    const s = { ...initialState(g7), step: [{ pump: 3, turbine: 4 }] };
    const svg = renderBoard({ grid: g7, state: s, ev: evaluate(g7, s), style: 'A', cell: 50, interactive: true }).svg;
    expect(svg).not.toContain('STEP · pompage');
    expect(svg.match(/data-act="step-tag"/g)?.length).toBe(2);
    expect(svg).toContain('class="step-link"');
    const pending = renderBoard({ grid: g7, state: initialState(g7), ev: null, style: 'A', cell: 50, stepPending: 2 }).svg;
    expect(pending).toContain('class="step-pending"');
    expect(boardGeometry(g7, 'A', 50).bottomRows).toBe(1);
  });

  it('paper keeps its STEP boxes and draws no pair', () => {
    const sheet = renderSheet(g7, 7);
    expect(sheet).toContain('STEP · pompage');
    expect(sheet).not.toContain('step-tag');
    expect(sheet).not.toContain('data-piece="STEP"');
    expect(boardGeometry(g7, 'B', 40).bottomRows).toBe(2);
  });
});

describe('review S6.3 round 1', () => {
  const ok = <T>(r: { ok: true; state: T } | { ok: false }): T => { if (!r.ok) throw new Error('refused'); return r.state; };
  it('a tap on an export pill of a line full of imports is refused with its reason', () => {
    const g = byId(10);
    const s = ok(place(g, newGame(g), { piece: 'I', country: 'DE', row: 0, col: 7, len: 1 }));
    expect(exportTap(g, s, 'DE', 7)).toEqual({ state: null, refused: 'Ligne vers l’Allemagne saturée à 21h.' });
    const free = exportTap(g, s, 'DE', 6);
    expect(free.refused).toBeUndefined();
    expect(free.state?.exports.DE?.[6]).toBe(1);
  });

  it('a full but wrong board says why, and its unmet clue is contradicted', () => {
    const g = byId(8);
    g.clues.push({ type: 'exchanges', imports: { '*': 1 } });
    const ev = evaluate(g, solutionState(g));
    expect(ev.missing).toBe(0);
    expect(ev.solved).toBe(false);
    expect(ev.clues[ev.clues.length - 1]!.status).toBe('broken');
    const m = boardMessage(ev, { text: 'Nucléaire à 0h, ligne 1 : la pose tient.', tone: 'ok' });
    expect(m?.tone).toBe('bad');
    expect(m?.text).toMatch(/^Indice non respecté : Aujourd’hui/);
    // A refusal from the last action stays on screen.
    expect(boardMessage(ev, { text: 'refus', tone: 'bad' })).toEqual({ text: 'refus', tone: 'bad' });
    // Cells left to cover: no verdict yet, the idle hint shows.
    expect(boardMessage(evaluate(g, newGame(g)), null)).toBeNull();
  });

  it('only a published export carries a padlock; a published import pill still exports', () => {
    const g5 = byId(5);
    const imp = g5.clues.find((c) => c.type === 'flow' && c.dir === 'import');
    expect(imp).toBeDefined();
    const svg5 = renderBoard({ grid: g5, state: initialState(g5), ev: evaluate(g5, initialState(g5)), style: 'A', cell: 40, interactive: true }).svg;
    expect(svg5).not.toContain('pill act locked');
    const g7 = byId(7);
    const svg7 = renderBoard({ grid: g7, state: initialState(g7), ev: null, style: 'A', cell: 40, interactive: true }).svg;
    expect(svg7).toContain('class="pill act locked" data-act="locked"');
  });

  it('a verified record tag stays within its column on narrow cells', () => {
    const g = byId(10);
    const s = solutionState(g);
    const cell = 35;
    const svg = renderBoard({ grid: g, state: s, ev: evaluate(g, s), style: 'A', cell }).svg;
    const tags = [...svg.matchAll(/<g class="tag"><rect x="([\d.]+)" y="[^"]+" width="([\d.]+)"/g)];
    expect(tags.length).toBeGreaterThan(0);
    for (const [, x, w] of tags) {
      const col = Math.floor((Number(x) + Number(w) / 2) / cell);
      expect(Number(x)).toBeGreaterThanOrEqual(col * cell);
      expect(Number(x) + Number(w)).toBeLessThanOrEqual((col + 1) * cell);
    }
  });

  it('the print sheet lists the slot clues in text and its footer covers exchanges and STEP', () => {
    const g7 = byId(7);
    const legend = slotLegend(g7);
    expect(legend).toContain('<li>3h : le nucléaire fixe le prix</li>');
    expect(legend).toContain('<li>9h : 4 nucléaire</li>');
    expect(legend).toContain('<li>0h : 1 bloc exporté vers l’Allemagne</li>');
    expect(legend).toContain('<li>15h → 24h : un réacteur tourne</li>');
    expect(renderSheet(g7, 7)).toContain(UI.printFootBoth);
    expect(slotLegend(byId(1))).toBe('');
  });
});

describe('review S6.3 round 3', () => {
  it('a vertical move of a one-row piece is no move: no preview, and its release is a tap', () => {
    expect(isFlat(BAR)).toBe(true);
    expect(isFlat(TALL)).toBe(false);
    const start = { row: 1, col: 2 };
    expect(alongShape(start, { row: 3, col: 2 }, BAR)).toEqual(start);
    expect(alongShape(start, { row: 3, col: 5 }, BAR)).toEqual({ row: 1, col: 5 });
    expect(alongShape(start, { row: 3, col: 2 }, TALL)).toEqual({ row: 3, col: 2 });
    let g = press(idle(), start);
    g = moveTo(g, alongShape(start, { row: 4, col: 2 }, BAR));
    expect(previewRect(g, BAR)).toBeNull();
    const r = release(g, alongShape(start, { row: 4, col: 2 }, BAR), BAR);
    expect(r.commit).toBeNull();
    expect(r.state.anchor).toEqual(start);
  });

  it('a new board is initial; a plant, a STEP pair or an export is not', () => {
    for (const g of grids) expect(isInitialState(g, initialState(g))).toBe(true);
    const g1 = byId(1);
    expect(isInitialState(g1, solutionState(g1))).toBe(false);
    const g10 = byId(10);
    const tapped = exportTap(g10, initialState(g10), g10.neighbors[0]!.id, 0).state!;
    expect(isInitialState(g10, tapped)).toBe(false);
    const g7 = byId(7);
    expect(isInitialState(g7, { ...initialState(g7), step: [{ pump: 2, turbine: 4 }] })).toBe(false);
  });

  it('the technique line is left out when the title already names every technique', () => {
    expect(techniqueLine(byId(2))).toBe('');
    expect(techniqueLine(byId(5))).toBe('');
    expect(techniqueLine(byId(1))).toBe('Cases interchangeables');
    expect(techniqueLine(byId(7))).toContain('Programme publié');
    expect(techniqueLine(byId(10))).toBe('');
  });

  it('the stock refusal has one colon only', () => {
    expect(MSG.stock('B', 'du barrage', 2)).toBe('Plus d’eau dans le barrage (2 cases au plus).');
    expect(MSG.stock('G', 'de gaz', 1)).toBe('Plus de stock de gaz (1 case au plus).');
  });
});

describe('STEP taps (grid 7: 8 slots, one published pair)', () => {
  const g7 = byId(7);
  const s0 = newGame(g7);
  // Slots: 0 = 0h, 1 = 3h, 5 = 15h, 7 = 21h.
  const withPair = () => stepTapResult(g7, stepTapResult(g7, s0, null, 1).state ?? s0, 1, 5).state!;

  it('refuses a pump on the last slot', () => {
    const r = stepTapResult(g7, s0, null, 7);
    expect(r.pending).toBeNull();
    expect(r.state).toBeUndefined();
    expect(r.message).toEqual({ text: UI.stepLastSlot, tone: 'bad' });
  });

  it('the first tap pumps: pending slot, info message', () => {
    const r = stepTapResult(g7, s0, null, 1);
    expect(r.pending).toBe(1);
    expect(r.state).toBeUndefined();
    expect(r.message).toEqual({ text: UI.stepPending('3h'), tone: 'info' });
  });

  it('refuses a turbine on the same slot or earlier, and keeps the pending pump', () => {
    const same = stepTapResult(g7, s0, 1, 1);
    expect(same).toMatchObject({ pending: 1, message: { text: UI.stepTooEarly('3h'), tone: 'bad' } });
    expect(same.state).toBeUndefined();
    const before = stepTapResult(g7, s0, 1, 0);
    expect(before).toMatchObject({ pending: 1, message: { text: UI.stepTooEarly('3h'), tone: 'bad' } });
  });

  it('a turbine on a later slot adds the pair and clears the pending pump', () => {
    const r = stepTapResult(g7, s0, 1, 5);
    expect(r.pending).toBeNull();
    expect(r.state?.step).toEqual([{ pump: 1, turbine: 5 }]);
    expect(r.message).toEqual({ text: UI.stepAdded('3h', '15h'), tone: 'ok' });
  });

  it('with the exact inventory full, refuses a new pump', () => {
    const r = stepTapResult(g7, withPair(), null, 2);
    expect(r.pending).toBeNull();
    expect(r.message).toEqual({ text: MSG.stepCount(1), tone: 'bad' });
  });

  it('finds the pair pumping or turbining in a column, so a tap there removes it', () => {
    const s = withPair();
    expect(stepPairIndexAt(s, 1)).toBe(0);
    expect(stepPairIndexAt(s, 5)).toBe(0);
    expect(stepPairIndexAt(s, 3)).toBe(-1);
    expect(stepPairIndexAt(s0, 1)).toBe(-1);
  });
});

describe('STEP pump without its turbine (pending pump, not in the undo history)', () => {
  it('Undo drops the pending pump before undoing a recorded action', () => {
    expect(stepUndoPlan(1)).toBe('drop-pending');
    expect(stepUndoPlan(0)).toBe('drop-pending');
    expect(stepUndoPlan(null)).toBe('undo');
  });

  it('the eraser on the pending slot drops the pump; elsewhere it keeps it', () => {
    expect(stepEraseResult(3, 3)).toEqual({ pending: null, dropped: true });
    expect(stepEraseResult(3, 4)).toEqual({ pending: 3, dropped: false });
    expect(stepEraseResult(null, 3)).toEqual({ pending: null, dropped: false });
  });
});
