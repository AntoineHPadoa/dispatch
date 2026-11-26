/*
 * Tutorial tests: every shipped script (grid, texts, techniques, full replay to a solved board),
 * the strict gate, run progress and resume board, run storage, and the spotlight geometry.
 */
import { describe, expect, it } from 'vitest';
import gridsJson from '../src/data/grids.json';
import type { Grid, Placement } from '../src/model/grid';
import { evaluate, newGame } from '../src/engine';
import { TECHNIQUES, TUTORIAL } from '../src/i18n/fr';
import { gameEyebrow, initialState } from '../src/ui/game';
import { renderBoard } from '../src/ui/board';
import { richText, sameBoard } from '../src/ui/tutorial';
import {
  INTRO_GRID_ID, SCRIPTS, TUTORIAL_KEY, restartUnlessRunning, scriptFor, applyMove, arrowOffset, stepRank, cellBox, currentStep, expectedBoard, gate, loadRun, next, parseRuns, placeBubble,
  record, saveRun, shadePath, skip, startRun, union, validRun, type Attempt, type KeyValue, type TutorialRun,
} from '../src/tutorial';
import type { TutorialScript } from '../src/tutorial/types';

const grids = gridsJson as unknown as Grid[];

/** Small grid with a neighbor (2 lines), STEP and an exact inventory. */
const grid: Grid = {
  id: 99, title: 'Test', section: 'rated',
  columns: ['0h', '4h', '8h', '12h', '16h', '20h'],
  demand: [2, 2, 3, 3, 2, 1],
  pieces: { N: { len: [3, 4, 5, 6], height: [1], rank: 1, co2: 0 }, G: { len: [2, 3], height: [1], rank: 4, co2: 1 } },
  weather: { R: [0, 0, 0, 0, 0, 0], F: [0, 0, 0, 0, 0, 0] },
  neighbors: [{ id: 'DE', name: 'Allemagne', cap: 2, co2: 3 }],
  step: true,
  co2_cap: null,
  inventory: { level: 'exact', pieces: { N: { bars: [6, 3] }, G: { bars: [2] } }, exports: { DE: 2 }, imports: { DE: 1 }, step: 1 },
  clues: [],
  solution: { exports: {}, step: [], placements: [] },
  difficulty: { rating: 1, label: 'Facile', techniques: [] },
};

const N = (row: number, col: number, len: number): Placement => ({ piece: 'N', row, col, len });

const script: TutorialScript = {
  gridId: 99, kind: 'intro',
  steps: [
    { kind: 'present', text: 'a', target: { kind: 'anchor', anchor: 'board' } },
    { kind: 'guided', technique: 'room', text: 'b', moves: [{ action: 'place', bar: N(0, 0, 6) }] },
    { kind: 'guided', technique: 'swap', text: 'c', moves: [{ action: 'place', bar: N(1, 0, 3), anyRow: true }, { action: 'setExport', country: 'DE', col: 2, value: 2 }] },
    { kind: 'guided', technique: 'silhouette', text: 'd', moves: [{ action: 'addStep', pump: 0, turbine: 3 }] },
    { kind: 'present', text: 'e' },
  ],
};

const at = (step: number, played: number[] = []): TutorialRun => ({ status: 'running', step, played });

describe('shipped scripts', () => {
  it.each(SCRIPTS.map((s) => [s.gridId, s] as const))('script of grid %i: grid, texts and techniques exist', (_id, s) => {
    expect(grids.some((g) => g.id === s.gridId)).toBe(true);
    for (const st of s.steps) {
      expect(TUTORIAL[st.text], st.text).toBeTruthy();
      if (st.kind === 'present') expect(st.title && TUTORIAL[st.title], `${st.text} title`).toBeTruthy();
      if (st.kind === 'guided') {
        expect(TECHNIQUES[st.technique], st.technique).toBeTruthy();
        expect(st.moves.length).toBeGreaterThan(0);
      }
    }
    if (s.next !== undefined) expect(grids.some((g) => g.id === s.next)).toBe(true);
  });

  it.each(SCRIPTS.filter((s) => s.kind === 'intro').map((s) => [s.gridId, s] as const))('intro of grid %i replays to a solved board', (_id, s) => {
    const g = grids.find((x) => x.id === s.gridId)!;
    const end = expectedBoard(g, s, { status: 'running', step: s.steps.length, played: [] }, initialState(g));
    expect(end).not.toBeNull();
    expect(evaluate(g, end!).solved).toBe(true);
  });

  it.each(SCRIPTS.map((s) => [s.gridId, s] as const))('script of grid %i: each guided move is accepted by the gate in its step', (_id, s) => {
    const g = grids.find((x) => x.id === s.gridId)!;
    let run = startRun();
    let board = initialState(g);
    while (run.status === 'running') {
      const st = currentStep(s, run)!;
      if (st.kind === 'present') { run = next(s, run); continue; }
      const k = st.moves.findIndex((_, i) => !run.played.includes(i));
      const m = st.moves[k]!;
      const attempt: Attempt = m;
      const r = gate(g, s, run, board, attempt);
      expect(r, `step ${run.step}`).toEqual({ ok: true, move: k });
      board = applyMove(g, board, m)!;
      expect(board, `step ${run.step}`).not.toBeNull();
      run = record(s, run, r);
    }
    expect(run.status).toBe('finished');
  });
});

describe('wiring', () => {
  it('every tutorial grid has a script; the intro grid is the « Tutoriel » one', () => {
    for (const g of grids.filter((x) => x.section === 'tutorial')) expect(scriptFor(g.id), `grid ${g.id}`).not.toBeNull();
    expect(scriptFor(INTRO_GRID_ID)?.kind).toBe('intro');
    expect(grids.filter((x) => x.section !== 'tutorial').every((g) => scriptFor(g.id) === null)).toBe(true);
  });

  it('eyebrow: « Tutoriel » for the intro grid, the rank in « Premiers pas » for the others', () => {
    const intro = grids.find((g) => g.id === INTRO_GRID_ID)!;
    expect(gameEyebrow(intro, grids)).toBe('Tutoriel');
    const firsts = grids.filter((g) => g.section === 'tutorial' && g.id !== INTRO_GRID_ID).sort((a, b) => a.id - b.id);
    expect(gameEyebrow(firsts[0]!, grids)).toBe(`Tutoriel 1 sur ${firsts.length}`);
    expect(scriptFor(INTRO_GRID_ID)?.next).toBe(firsts[0]!.id);
  });

  it('the « Tutoriel » button starts a finished or skipped run over, never a run under way', () => {
    const m = new Map<string, string>();
    const kv = () => ({ getItem: (k: string) => m.get(k) ?? null, setItem: (k: string, v: string) => { m.set(k, v); } });
    restartUnlessRunning(kv, 14);
    expect(loadRun(kv, 14)).toEqual(startRun());
    saveRun(kv, 14, at(3, [1]));
    restartUnlessRunning(kv, 14);
    expect(loadRun(kv, 14)).toEqual(at(3, [1]));
    saveRun(kv, 14, skip(at(3)));
    restartUnlessRunning(kv, 14);
    expect(loadRun(kv, 14)).toEqual(startRun());
  });
});

describe('strict gate', () => {
  const b0 = newGame(grid);

  it('refuses every move on a present step', () => {
    expect(gate(grid, script, at(0), b0, { action: 'place', bar: N(0, 0, 6) })).toEqual({ ok: false });
  });

  it('accepts only the expected bar', () => {
    expect(gate(grid, script, at(1), b0, { action: 'place', bar: N(0, 0, 6) })).toEqual({ ok: true, move: 0 });
    expect(gate(grid, script, at(1), b0, { action: 'place', bar: N(0, 0, 5) }).ok).toBe(false);
    expect(gate(grid, script, at(1), b0, { action: 'place', bar: N(1, 0, 3) }).ok).toBe(false);
    expect(gate(grid, script, at(1), b0, { action: 'place', bar: { ...N(0, 0, 6), height: 1 } }).ok).toBe(true);
    for (const tool of ['erase', 'undo', 'reset'] as const) expect(gate(grid, script, at(1), b0, { action: 'tool', tool }).ok).toBe(false);
    expect(gate(grid, script, at(1), b0, { action: 'removeStep' }).ok).toBe(false);
  });

  it('anyRow matches the bar on another row', () => {
    expect(gate(grid, script, at(2), b0, { action: 'place', bar: N(2, 0, 3) })).toEqual({ ok: true, move: 0 });
  });

  it('export taps climb to the expected value, then complete the move', () => {
    const b1 = applyMove(grid, b0, { action: 'setExport', country: 'DE', col: 2, value: 1 })!;
    expect(gate(grid, script, at(2), b0, { action: 'setExport', country: 'DE', col: 2, value: 1 })).toEqual({ ok: true, move: null });
    expect(gate(grid, script, at(2), b1, { action: 'setExport', country: 'DE', col: 2, value: 2 })).toEqual({ ok: true, move: 1 });
    expect(gate(grid, script, at(2), b0, { action: 'setExport', country: 'DE', col: 3, value: 1 }).ok).toBe(false);
    expect(gate(grid, script, at(2), b1, { action: 'setExport', country: 'DE', col: 2, value: 0 }).ok).toBe(false);
  });

  it('STEP: the pump tap is partial, the turbine tap completes', () => {
    expect(gate(grid, script, at(3), b0, { action: 'pump', col: 0 })).toEqual({ ok: true, move: null });
    expect(gate(grid, script, at(3), b0, { action: 'pump', col: 1 }).ok).toBe(false);
    expect(gate(grid, script, at(3), b0, { action: 'turbine', pump: 0, col: 3 })).toEqual({ ok: true, move: 0 });
    expect(gate(grid, script, at(3), b0, { action: 'turbine', pump: 0, col: 4 }).ok).toBe(false);
  });

  it('a played move is not accepted twice', () => {
    expect(gate(grid, script, at(2, [0]), b0, { action: 'place', bar: N(1, 0, 3) }).ok).toBe(false);
  });

  it('remove matches any cell of the expected bar', () => {
    const s: TutorialScript = { gridId: 99, kind: 'intro', steps: [{ kind: 'guided', technique: 'room', text: 'x', moves: [{ action: 'remove', row: 0, col: 0 }] }] };
    const b = applyMove(grid, b0, { action: 'place', bar: N(0, 0, 6) })!;
    expect(gate(grid, s, at(0), b, { action: 'remove', row: 0, col: 4 })).toEqual({ ok: true, move: 0 });
    expect(gate(grid, s, at(0), b, { action: 'remove', row: 1, col: 4 }).ok).toBe(false);
  });
});

describe('run progress', () => {
  it('a multi-move step opens the next step once every move is played, in any order', () => {
    let run = record(script, at(2), { ok: true, move: 1 });
    expect(run).toEqual(at(2, [1]));
    run = record(script, run, { ok: true, move: 0 });
    expect(run).toEqual(at(3));
  });

  it('a partial move does not advance', () => {
    expect(record(script, at(2), { ok: true, move: null })).toEqual(at(2));
  });

  it('next() after the last step finishes; skip() stops', () => {
    expect(next(script, at(4)).status).toBe('finished');
    expect(skip(at(1)).status).toBe('skipped');
    expect(currentStep(script, skip(at(1)))).toBeNull();
  });

  it('expectedBoard replays the steps before and the moves played in the current one', () => {
    const b = expectedBoard(grid, script, at(2, [1]), newGame(grid))!;
    expect(b.bars).toHaveLength(1);
    expect(b.exports.DE![2]).toBe(2);
    const end = expectedBoard(grid, script, { status: 'finished', step: 5, played: [] }, newGame(grid))!;
    expect(end.step).toEqual([{ pump: 0, turbine: 3 }]);
    expect(end.bars).toHaveLength(2);
  });

  it('stepRank counts present and guided steps apart; a discovery script has no count', () => {
    expect(stepRank(script, at(0))).toEqual({ kind: 'present', k: 1, n: 2 });
    expect(stepRank(script, at(3))).toEqual({ kind: 'guided', k: 3, n: 3 });
    expect(stepRank(script, at(4))).toEqual({ kind: 'present', k: 2, n: 2 });
    expect(stepRank({ ...script, kind: 'discovery' }, at(0)).kind).toBe('discovery');
  });

  it('expectedBoard is null when the script does not replay', () => {
    const bad: TutorialScript = { ...script, steps: [{ kind: 'guided', technique: 'room', text: 'x', moves: [{ action: 'place', bar: N(0, 0, 2) }] }] };
    expect(expectedBoard(grid, bad, at(1), newGame(grid))).toBeNull();
  });

  it('validRun drops a run that no longer fits the script', () => {
    expect(validRun(script, at(9))).toBeNull();
    expect(validRun(script, at(0, [0]))).toBeNull();
    expect(validRun(script, at(2, [5]))).toBeNull();
    expect(validRun(script, at(2, [1]))).toEqual(at(2, [1]));
    expect(validRun(script, { status: 'finished', step: 9, played: [] })?.status).toBe('finished');
  });

  it('sameBoard ignores the order of the bars', () => {
    const a = applyMove(grid, applyMove(grid, newGame(grid), { action: 'place', bar: N(0, 0, 6) })!, { action: 'place', bar: N(1, 0, 3) })!;
    const b = { ...a, bars: [...a.bars].reverse() };
    expect(sameBoard(a, b)).toBe(true);
    expect(sameBoard(a, newGame(grid))).toBe(false);
  });
});

describe('run storage', () => {
  const memory = () => {
    const m = new Map<string, string>();
    return { getItem: (k: string) => m.get(k) ?? null, setItem: (k: string, v: string) => { m.set(k, v); }, m };
  };

  it('saves under its own key and reads back per grid', () => {
    const kv = memory();
    saveRun(() => kv, 99, at(2, [1]));
    saveRun(() => kv, 12, skip(at(0)));
    expect([...kv.m.keys()]).toEqual([TUTORIAL_KEY]);
    expect(TUTORIAL_KEY).not.toBe('dispatch:progress:v1');
    expect(loadRun(() => kv, 99)).toEqual(at(2, [1]));
    expect(loadRun(() => kv, 12)?.status).toBe('skipped');
    expect(loadRun(() => kv, 7)).toBeNull();
  });

  it('a throwing or missing storage never throws', () => {
    const bad: KeyValue = { getItem: () => { throw new Error('blocked'); }, setItem: () => { throw new Error('full'); } };
    expect(loadRun(() => bad, 1)).toBeNull();
    expect(() => saveRun(() => bad, 1, startRun())).not.toThrow();
    expect(loadRun(() => { throw new Error('no window'); }, 1)).toBeNull();
    expect(loadRun(() => null, 1)).toBeNull();
  });

  it('parseRuns keeps only well-formed runs', () => {
    expect(parseRuns('not json')).toEqual({});
    expect(parseRuns('[1]')).toEqual({});
    expect(parseRuns(JSON.stringify({ 1: at(0), 2: { status: 'x', step: 0, played: [] }, 3: { status: 'running', step: -1, played: [] } }))).toEqual({ 1: at(0) });
  });
});

describe('spotlight geometry', () => {
  const view = { width: 1280, height: 800 };
  const bubble = { width: 340, height: 120 };

  it('cellBox maps cells to the screen through the board measures', () => {
    // 6 columns of 40, lead 20, 5 rows, top pad 10, drawn at scale 1 at (100, 50).
    const m = { cell: 40, lead: 20, rows: 5, top: 10, width: 2 * 20 + 6 * 40 + 4 };
    const svg = { left: 100, top: 50, width: m.width, height: 300 };
    expect(cellBox(svg, m, [0, 0], [0, 0])).toEqual({ left: 122, top: 50 + 10 + 4 * 40, width: 40, height: 40 });
    expect(cellBox(svg, m, [2, 3], [1, 2])).toEqual({ left: 100 + 22 + 80, top: 50 + 10 + 2 * 40, width: 80, height: 80 });
    expect(cellBox(svg, m, [5, 5]).height).toBe(200);
    // Drawn at half size.
    expect(cellBox({ ...svg, width: m.width / 2 }, m, [0, 0], [0, 0]).width).toBe(20);
  });

  it('cellBox frames the weather cells of a rendered board (rows from the bottom, weather included)', () => {
    const g = structuredClone(grids.find((x) => x.neighbors.length > 0)!);
    const R = g.columns.map((_, c) => (c % 3) + 1);
    g.weather = { ...g.weather, R };
    g.demand = g.demand.map((d, c) => d + R[c]!);
    const cell = 50;
    const { svg, geo } = renderBoard({ grid: g, state: initialState(g), ev: null, style: 'A', cell, interactive: true, recordChips: true });
    // Weather rects, in user units (viewBox from (-2, -topPad)): drawn at scale 1 with the svg at (0, 0).
    const rects = [...svg.matchAll(/<rect x="([\d.]+)" y="(-?[\d.]+)" width="([\d.]+)" height="[\d.]+" rx="[\d.]+" fill="url\(#hR/g)]
      .map((m) => ({ left: +m[1]! + 2, top: +m[2]! + geo.topPad, width: +m[3]!, height: +m[3]! }));
    expect(rects).toHaveLength(R.reduce((a, b) => a + b, 0));
    const drawn = union(rects)!;
    const m = { cell, lead: geo.lead, rows: geo.rows, top: geo.topPad, width: geo.width };
    const cut = cellBox({ left: 0, top: 0, width: geo.width, height: geo.height }, m, [0, g.columns.length - 1], [0, Math.max(...R) - 1]);
    // The cut is the cells' squares; the drawn tiles sit inside with the same gap on every side.
    const gap = drawn.left - cut.left;
    expect(gap).toBeGreaterThanOrEqual(0);
    expect(gap).toBeLessThan(cell / 10);
    expect(drawn.top - cut.top).toBeCloseTo(gap, 5);
    expect(cut.left + cut.width - (drawn.left + drawn.width)).toBeCloseTo(gap, 5);
    expect(cut.top + cut.height - (drawn.top + drawn.height)).toBeCloseTo(gap, 5);
    // One row: the bottom row of the grid only.
    const row0 = cellBox({ left: 0, top: 0, width: geo.width, height: geo.height }, m, [0, 0], [0, 0]);
    const first = rects.filter((r) => Math.abs(r.left - drawn.left) < 1).sort((a, b) => b.top - a.top)[0]!;
    expect(first.top - row0.top).toBeCloseTo(gap, 5);
  });

  it('placeBubble: below by default, else the side with room, always inside the viewport', () => {
    expect(placeBubble({ left: 400, top: 100, width: 200, height: 100 }, bubble, view)).toMatchObject({ side: 'bottom', top: 214, left: 330 });
    expect(placeBubble({ left: 400, top: 600, width: 200, height: 150 }, bubble, view).side).toBe('top');
    expect(placeBubble({ left: 100, top: 20, width: 600, height: 760 }, bubble, view).side).toBe('right');
    expect(placeBubble({ left: 400, top: 100, width: 200, height: 100 }, bubble, view, 'left')).toMatchObject({ side: 'left', left: 400 - 14 - 340 });
    const edge = placeBubble({ left: 1250, top: 100, width: 20, height: 20 }, bubble, view);
    expect(edge.left + bubble.width).toBeLessThanOrEqual(view.width - 12);
    const huge = placeBubble({ left: 0, top: 0, width: 1280, height: 800 }, bubble, view);
    expect(huge.left).toBeGreaterThanOrEqual(12);
    expect(huge.top).toBeGreaterThanOrEqual(12);
    expect(huge.top + bubble.height).toBeLessThanOrEqual(800 - 12);
  });

  it('arrowOffset aims at the target centre, away from the corners', () => {
    const t = { left: 500, top: 100, width: 100, height: 40 };
    expect(arrowOffset('top', { left: 400, top: 160 }, bubble, t)).toBe(150);
    expect(arrowOffset('top', { left: 600, top: 160 }, bubble, t)).toBe(18);
    expect(arrowOffset('left', { left: 620, top: 0 }, bubble, t)).toBe(102);
  });

  it('placeBubble centres the bubble without a target', () => {
    expect(placeBubble(null, bubble, view)).toEqual({ left: 470, top: 340, side: 'center' });
  });

  it('union and shade path', () => {
    expect(union([{ left: 0, top: 0, width: 10, height: 10 }, { left: 20, top: 5, width: 10, height: 10 }])).toEqual({ left: 0, top: 0, width: 30, height: 15 });
    expect(union([])).toBeNull();
    expect(shadePath(view, [])).toBe('M0 0H1280V800H0Z');
    expect(shadePath(view, [{ left: 10, top: 10, width: 100, height: 50 }]).match(/M/g)).toHaveLength(2);
  });

  it('richText escapes and bolds', () => {
    expect(richText('La **grille** <b>')).toBe('La <b>grille</b> &lt;b&gt;');
  });
});
