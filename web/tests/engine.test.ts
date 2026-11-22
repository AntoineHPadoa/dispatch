/*
 * Engine tests: reference solutions, one invalid case per rule and per clue type, composition
 * judging (two drawings, one composition), silhouette and immutability.
 */
import { describe, expect, it } from 'vitest';
import gridsJson from '../src/data/grids.json';
import { validateGrid, type Clue, type Grid, type PieceId, type Placement } from '../src/model/grid';
import {
  addStep, checkPlacement, clueText, evaluate, newGame, place, remove, removeStep, residual, setExport,
  silhouette, solutionState, weatherCells, type ActionResult, type PlayState,
} from '../src/engine';

const grids = gridsJson as unknown as Grid[];
const byId = (id: number) => structuredClone(grids.find((g) => g.id === id)!);

/** Synthetic grid with every mechanic: 2 neighbors, STEP, exact inventory. */
function makeGrid(patch: Partial<Grid> = {}): Grid {
  return {
    id: 99,
    title: 'Test',
    section: 'rated',
    columns: ['0h', '4h', '8h', '12h', '16h', '20h'],
    demand: [2, 2, 3, 3, 2, 1],
    pieces: {
      N: { len: [3, 4, 5, 6], height: [1], rank: 1, co2: 0 },
      B: { len: [1], height: [1], rank: 2, co2: 0 },
      G: { len: [2, 3], height: [1], rank: 4, co2: 1 },
      T: { len: [1], height: [1], rank: 5, co2: 2 },
    },
    weather: { R: [0, 0, 0, 0, 0, 0], F: [0, 0, 0, 0, 0, 0] },
    neighbors: [{ id: 'DE', name: 'Allemagne', cap: 1, co2: 3 }, { id: 'UK', name: 'Royaume-Uni', cap: 1, co2: 0 }],
    step: true,
    co2_cap: null,
    inventory: {
      level: 'exact',
      pieces: { N: { bars: [6, 6] }, G: { bars: [2] }, T: { cells: 1 } },
      exports: { DE: 1, UK: 0 },
      imports: { DE: 1, UK: 0 },
      step: 1,
    },
    clues: [],
    solution: { exports: {}, step: [], placements: [] },
    difficulty: { rating: 1, label: 'Facile', techniques: [] },
    ...patch,
  };
}

/** Unwrap a successful action. */
function ok(r: ActionResult): PlayState {
  if (!r.ok) throw new Error(`unexpected refusal: ${r.error.message}`);
  return r.state;
}

function refused(r: ActionResult) {
  expect(r.ok).toBe(false);
  if (r.ok) throw new Error('unreachable');
  return r.error;
}

const N = (row: number, col: number, len: number): Placement => ({ piece: 'N', row, col, len });

describe('reference solutions', () => {
  it.each(grids.map((g) => [g.id, g] as const))('grid %i is solved by its reference solution', (_id, g) => {
    const ev = evaluate(g, solutionState(g));
    expect(ev.unmet).toEqual([]);
    expect(ev.errors).toEqual([]);
    expect(ev.missing).toBe(0);
    expect(ev.matchesReference).toBe(true);
    expect(ev.solved).toBe(true);
    expect(ev.clues.every((c) => c.status === 'ok')).toBe(true);
  });

  it.each(grids.map((g) => [g.id, g] as const))('grid %i: the reference solution replays through the actions', (_id, g) => {
    let s = newGame(g);
    for (const [id, vals] of Object.entries(g.solution.exports)) vals.forEach((v, c) => { if (v) s = ok(setExport(g, s, id, c, v)); });
    for (const p of g.solution.step) s = ok(addStep(g, s, p.pump, p.turbine));
    for (const p of g.solution.placements) s = ok(place(g, s, p));
    expect(evaluate(g, s).solved).toBe(true);
  });

  it('an empty board is not solved and says why', () => {
    const g = byId(1);
    const ev = evaluate(g, newGame(g));
    expect(ev.solved).toBe(false);
    expect(ev.missing).toBe(16);
    expect(ev.unmet).toContain('Il reste 16 cases à couvrir.');
    expect(ev.unmet).toContain('Il reste à poser des barres de nucléaire : 6, 6.');
  });
});

describe('silhouette', () => {
  it('residual = demand - renewables - run-of-river', () => {
    const g = makeGrid({ weather: { R: [0, 1, 1, 0, 0, 0], F: [1, 1, 1, 1, 1, 1] } });
    expect(residual(g)).toEqual([1, 0, 1, 2, 1, 0]);
  });

  it('adds exports of every neighbor and pumping, removes turbining', () => {
    const g = makeGrid({ inventory: { ...makeGrid().inventory, level: 'none', pieces: { N: {} } } });
    delete g.inventory.exports;
    delete g.inventory.imports;
    delete g.inventory.step;
    let s = newGame(g);
    s = ok(setExport(g, s, 'DE', 1, 1));
    s = ok(setExport(g, s, 'UK', 1, 1));
    s = ok(addStep(g, s, 0, 2));
    expect(silhouette(g, s)).toEqual([3, 4, 2, 3, 2, 1]);
  });
});

describe('weather cells (imposed bricks, absolute rows)', () => {
  // Weather 1, 1, 2, 3, 1, 1 at the bottom; 3, 3, 3, 3, 3, 1 cells to fill above it.
  const g = makeGrid({
    demand: [4, 4, 5, 6, 4, 2],
    weather: { R: [0, 0, 1, 2, 0, 0], F: [1, 1, 1, 1, 1, 1] },
    inventory: { level: 'none', pieces: { N: {}, B: {}, G: {}, T: {} } },
    neighbors: [],
    step: false,
  });
  const s0 = newGame(g);

  it('the cells to fill start right above the weather', () => {
    expect(weatherCells(g)).toEqual([1, 1, 2, 3, 1, 1]);
    expect(silhouette(g, s0)).toEqual([3, 3, 3, 3, 3, 1]);
    const ev = evaluate(g, s0);
    expect(ev.floor).toEqual([1, 1, 2, 3, 1, 1]);
    expect(ev.missingByCol).toEqual([3, 3, 3, 3, 3, 1]);
  });

  it('a bar on a weather cell is refused, at the first column it covers', () => {
    expect(refused(place(g, s0, N(1, 0, 3)))).toEqual({ code: 'weather', message: 'La météo occupe déjà cette case à 8h.' });
    expect(refused(place(g, s0, N(0, 0, 3)))).toEqual({ code: 'weather', message: 'La météo occupe déjà cette case à 0h.' });
    expect(refused(place(g, s0, { piece: 'T', row: 2, col: 3, len: 1 })).code).toBe('weather');
  });

  it('a straight bar above a weather step is laid on one row, never folded', () => {
    const s = ok(place(g, s0, N(3, 0, 4)));
    expect(s.bars).toEqual([{ piece: 'N', row: 3, col: 0, len: 4 }]);
    const ev = evaluate(g, s);
    expect(ev.errors).toEqual([]);
    // Row 3 is the top cell of columns 0 and 1, the middle of 8h and the bottom of 12h.
    expect(ev.missingByCol).toEqual([2, 2, 2, 2, 3, 1]);
    // The top of the silhouette still binds: row 4 is out at 0h.
    expect(refused(place(g, s0, N(4, 0, 4)))).toEqual({ code: 'silhouette', message: 'Hors de la silhouette à 0h.' });
  });

  it('a saved bar on the weather is reported, not removed', () => {
    const ev = evaluate(g, { ...s0, bars: [N(1, 0, 3)] });
    expect(ev.invalidBars).toEqual([0]);
    expect(ev.errors).toContainEqual({ code: 'weather', message: 'La météo occupe déjà cette case à 8h.' });
  });

  it('the validator refuses a placement or an engaged plant on the weather', () => {
    const bad = makeGrid({
      ...g,
      clues: [{ type: 'engaged', piece: 'T', row: 1, col: 3, len: 1 }],
      solution: { exports: {}, step: [], placements: [N(3, 0, 4), N(2, 2, 3)] },
    });
    const errors = validateGrid(bad).errors;
    expect(errors).toContain('clues[0]: covers a weather cell at 12h');
    expect(errors).toContain('solution.placements[1]: covers a weather cell at 12h');
    expect(errors.filter((e) => e.includes('weather cell'))).toHaveLength(2);
  });
});

describe('placement rules (one invalid case per rule)', () => {
  const g = makeGrid();
  const s0 = newGame(g);

  it('width', () => {
    expect(refused(place(g, s0, N(0, 0, 2)))).toEqual({ code: 'length', message: 'La barre de nucléaire doit faire 3 à 6 créneaux.' });
  });

  it('height', () => {
    expect(refused(place(g, s0, { ...N(0, 0, 6), height: 2 })).code).toBe('height');
  });

  it('bounds', () => {
    expect(refused(place(g, s0, { piece: 'G', row: 0, col: 5, len: 2 })).code).toBe('bounds');
  });

  it('outside the silhouette', () => {
    expect(refused(place(g, s0, N(2, 0, 3)))).toEqual({ code: 'silhouette', message: 'Hors de la silhouette à 0h.' });
  });

  it('overlap', () => {
    const s = ok(place(g, s0, N(0, 0, 6)));
    expect(refused(place(g, s, { piece: 'T', row: 0, col: 3, len: 1 }))).toEqual({ code: 'overlap', message: 'Case déjà occupée.' });
  });

  it('piece not in the grid', () => {
    expect(refused(place(g, s0, { piece: 'B', row: 0, col: 0, len: 1 })).code).toBe('unavailable');
    expect(refused(place(g, s0, { piece: 'I', country: 'FR', row: 0, col: 0, len: 1 })).code).toBe('country');
  });

  it('inventory: bar width not in the order book, bar already used, cells exhausted', () => {
    expect(refused(place(g, s0, N(0, 0, 3))).message).toBe('Plus de barre de nucléaire de 3 créneaux dans l’inventaire.');
    let s = ok(place(g, s0, { piece: 'G', row: 0, col: 0, len: 2 }));
    expect(refused(place(g, s, { piece: 'G', row: 1, col: 0, len: 2 })).code).toBe('inventory');
    s = ok(place(g, s, { piece: 'T', row: 0, col: 2, len: 1 }));
    expect(refused(place(g, s, { piece: 'T', row: 0, col: 3, len: 1 })).message).toBe('Plus de case de TAC dans l’inventaire (1 au total).');
  });

  it('inventory: imports and exports', () => {
    let s = ok(place(g, s0, { piece: 'I', country: 'DE', row: 0, col: 0, len: 1 }));
    expect(refused(place(g, s, { piece: 'I', country: 'DE', row: 0, col: 1, len: 1 })).code).toBe('inventory');
    expect(refused(place(g, s0, { piece: 'I', country: 'UK', row: 0, col: 1, len: 1 })).code).toBe('inventory');
    s = ok(setExport(g, s0, 'DE', 2, 1));
    expect(refused(setExport(g, s, 'DE', 3, 1)).message).toBe('Plus d’export vers l’Allemagne dans l’inventaire (1 au total).');
  });

  it('stock (level none)', () => {
    const h = makeGrid({ inventory: { level: 'none', pieces: { B: { max_cells: 1 } } } });
    const s = ok(place(h, newGame(h), { piece: 'B', row: 0, col: 0, len: 1 }));
    expect(refused(place(h, s, { piece: 'B', row: 0, col: 1, len: 1 }))).toEqual({ code: 'stock', message: 'Plus d’eau dans le barrage (1 case au plus).' });
    expect(evaluate(h, { ...s, bars: [...s.bars, { piece: 'B', row: 0, col: 1, len: 1 }] }).errors.map((e) => e.code)).toContain('stock');
  });

  it('dam water stock on grid 8: a third dam cell is refused', () => {
    const h = byId(8);
    let s = newGame(h);
    s = ok(place(h, s, { piece: 'B', row: 0, col: 0, len: 1 }));
    s = ok(place(h, s, { piece: 'B', row: 0, col: 1, len: 1 }));
    expect(refused(place(h, s, { piece: 'B', row: 0, col: 5, len: 1 }))).toEqual({ code: 'stock', message: 'Plus d’eau dans le barrage (2 cases au plus).' });
    const over: PlayState = { ...s, bars: [...s.bars, { piece: 'B', row: 0, col: 5, len: 1 }] };
    const ev = evaluate(h, over);
    expect(ev.errors).toContainEqual({ code: 'stock', message: 'Plus d’eau dans le barrage (2 cases au plus).' });
    expect(ev.inventory.find((it) => it.key === 'B')).toMatchObject({ status: 'over', text: '3 / 2' });
  });

  it('saturated line, for an import and for an export', () => {
    let s = ok(setExport(g, s0, 'DE', 0, 1));
    expect(refused(place(g, s, { piece: 'I', country: 'DE', row: 0, col: 0, len: 1 }))).toEqual({ code: 'line', message: 'Ligne vers l’Allemagne saturée à 0h.' });
    s = ok(place(g, s0, { piece: 'I', country: 'DE', row: 0, col: 1, len: 1 }));
    expect(refused(setExport(g, s, 'DE', 1, 1)).code).toBe('line');
    expect(refused(setExport(g, s0, 'DE', 0, 2)).code).toBe('line');
    expect(refused(setExport(g, s0, 'DE', 0, -1)).code).toBe('export');
  });

  it('STEP: none, reversed, too many', () => {
    expect(refused(addStep(makeGrid({ step: false, inventory: { level: 'exact', pieces: {} } }), s0, 0, 1)).code).toBe('step_none');
    expect(refused(addStep(g, s0, 3, 1))).toEqual({ code: 'step_reversed', message: 'STEP inversée : le pompage doit précéder le turbinage.' });
    expect(refused(addStep(g, s0, 2, 2)).code).toBe('step_reversed');
    const s = ok(addStep(g, s0, 0, 2));
    expect(refused(addStep(g, s, 1, 3)).code).toBe('step_count');
    expect(ok(removeStep(s, 0)).step).toEqual([]);
  });

  it('CO2 cap', () => {
    const h = makeGrid({ co2_cap: 2 });
    const s = ok(place(h, newGame(h), { piece: 'G', row: 0, col: 0, len: 2 }));
    expect(refused(place(h, s, { piece: 'T', row: 0, col: 2, len: 1 }))).toEqual({ code: 'co2', message: 'Plafond CO₂ dépassé : 4 / 2.' });
  });

  it('unabsorbed surplus', () => {
    const h = makeGrid({ demand: [2, 2, -1, 3, 2, 1] });
    expect(evaluate(h, newGame(h)).errors).toContainEqual({ code: 'surplus', message: 'Surplus non absorbé à 8h : il faut exporter ou pomper.' });
    const s = ok(setExport(h, newGame(h), 'DE', 2, 1));
    expect(evaluate(h, s).errors.map((e) => e.code)).not.toContain('surplus');
  });

  it('a bar left outside the silhouette by a turbining is reported, not removed', () => {
    let s = ok(place(g, s0, { piece: 'G', row: 2, col: 2, len: 2 }));
    s = ok(addStep(g, s, 0, 3));
    expect(s.bars).toHaveLength(1);
    const ev = evaluate(g, s);
    expect(ev.invalidBars).toEqual([0]);
    expect(ev.errors).toContainEqual({ code: 'silhouette', message: 'Hors de la silhouette à 12h.' });
  });

  it('engaged bars are locked; removing needs a bar', () => {
    const h = makeGrid({ clues: [{ type: 'engaged', piece: 'T', row: 0, col: 5, len: 1 }] });
    const s = newGame(h);
    expect(s.bars).toEqual([{ piece: 'T', row: 0, col: 5, len: 1, locked: true }]);
    expect(refused(remove(h, s, 0, 5)).code).toBe('locked');
    expect(refused(remove(h, s, 0, 0)).code).toBe('empty');
    const t = ok(place(h, s, { piece: 'G', row: 0, col: 0, len: 2 }));
    expect(ok(remove(h, t, 0, 1)).bars).toHaveLength(1);
  });

  it('checkPlacement previews without changing the board', () => {
    expect(checkPlacement(g, s0, N(0, 0, 6))).toEqual({ ok: true });
    expect(s0.bars).toHaveLength(0);
  });

  it('evaluate reports overlap, extra bars and line saturation on a hand-made board', () => {
    const s: PlayState = {
      bars: [N(0, 0, 6), N(0, 0, 6), N(1, 0, 6)],
      exports: { DE: [1, 0, 0, 0, 0, 0], UK: [0, 0, 0, 0, 0, 0] },
      step: [{ pump: 4, turbine: 1 }],
    };
    const s2 = { ...s, bars: [...s.bars, { piece: 'I' as const, country: 'DE', row: 2, col: 0, len: 1 }] };
    const codes = evaluate(g, s2).errors.map((e) => e.code);
    expect(codes).toEqual(expect.arrayContaining(['overlap', 'inventory', 'line', 'step_reversed']));
  });
});

describe('clues (one broken case per type)', () => {
  const status = (g: Grid, s: PlayState, clue: Clue) => {
    const h = { ...g, clues: [clue] };
    return evaluate(h, s).clues[0]!.status;
  };

  it('price: plant, more expensive plant, import, incomplete column', () => {
    const g = byId(6);
    const s = solutionState(g);
    expect(status(g, s, { type: 'price', col: 2, piece: 'G' })).toBe('ok');
    expect(status(g, s, { type: 'price', col: 2, piece: 'N' })).toBe('broken');
    expect(status(g, s, { type: 'price', col: 1, piece: 'G' })).toBe('broken');
    const withImport: PlayState = { ...s, bars: s.bars.filter((b) => !(b.piece === 'G')) };
    expect(status(g, withImport, { type: 'price', col: 2, piece: 'G' })).toBe('open');
    const imp: PlayState = { ...withImport, bars: [...withImport.bars, { piece: 'I', country: 'DE', row: 6, col: 2, len: 1 }] };
    expect(status(g, imp, { type: 'price', col: 2, piece: 'N' })).toBe('broken');
  });

  it('bar (published program)', () => {
    const g = byId(7);
    const s = solutionState(g);
    expect(status(g, s, { type: 'bar', piece: 'N', col: 5, len: 3 })).toBe('ok');
    // inventory exhausted without a conforming bar: broken
    expect(status(g, s, { type: 'bar', piece: 'N', col: 2, len: 3 })).toBe('broken');
    // a bar still to lay: open
    const partial: PlayState = { ...s, bars: s.bars.filter((b) => b.piece !== 'N') };
    expect(status(g, partial, { type: 'bar', piece: 'N', col: 2, len: 3 })).toBe('open');
    // a hatched (invalid) bar on the right slots does not verify the clue
    const hatched: PlayState = { ...partial, bars: [{ piece: 'N', row: 40, col: 5, len: 3 }] };
    expect(status(g, hatched, { type: 'bar', piece: 'N', col: 5, len: 3 })).toBe('open');
  });

  it('length (running time)', () => {
    const g = byId(7);
    const s = solutionState(g);
    expect(status(g, s, { type: 'length', piece: 'N', len: 4 })).toBe('ok');
    expect(status(g, s, { type: 'length', piece: 'N', len: 6 })).toBe('broken');
    const partial: PlayState = { ...s, bars: s.bars.filter((b) => b.piece !== 'N') };
    expect(status(g, partial, { type: 'length', piece: 'N', len: 6 })).toBe('open');
  });

  it('column (production record)', () => {
    const g = byId(8);
    const s = solutionState(g);
    expect(status(g, s, { type: 'column', col: 7, counts: { N: 1 } })).toBe('ok');
    expect(status(g, s, { type: 'column', col: 7, counts: { N: 2 } })).toBe('broken');
    expect(status(g, s, { type: 'column', col: 1, counts: { N: 1, B: 0 } })).toBe('broken');
    expect(status(g, s, { type: 'column', col: 0, counts: { N: 0 } })).toBe('broken');
  });

  it('flow (export and import)', () => {
    const g = byId(7);
    const s = solutionState(g);
    expect(status(g, s, { type: 'flow', col: 0, country: 'DE', dir: 'export', value: 1 })).toBe('ok');
    expect(status(g, ok(setExport(g, s, 'DE', 0, 0)), { type: 'flow', col: 0, country: 'DE', dir: 'export', value: 1 })).toBe('open');
    expect(status(g, s, { type: 'flow', col: 6, country: 'DE', dir: 'import', value: 0 })).toBe('broken');
  });

  it('exchanges (day totals)', () => {
    const g = byId(8);
    const s = solutionState(g);
    expect(status(g, s, { type: 'exchanges', exports: { DE: 2 }, imports: { DE: 0 } })).toBe('ok');
    expect(status(g, s, { type: 'exchanges', exports: { DE: 1 } })).toBe('broken');
    // Under the target: open, even on a full board (an export, an import or a STEP pair can still meet it).
    expect(status(g, newGame(g), { type: 'exchanges', imports: { '*': 1 } })).toBe('open');
    expect(status(g, s, { type: 'exchanges', imports: { '*': 1 } })).toBe('open');
    const g7 = byId(7);
    expect(status(g7, solutionState(g7), { type: 'exchanges', step: 0 })).toBe('broken');
  });

  it('review S8 B C16: on a full board an exchanges clue short of exports stays open, a cell clue is broken', () => {
    const g = byId(8);
    const sol = solutionState(g);
    expect(evaluate(g, sol).missingByCol.every((m) => m === 0)).toBe(true);
    const exported = Object.values(sol.exports).flat().reduce((a, b) => a + b, 0);
    expect(status(g, sol, { type: 'exchanges', exports: { DE: exported + 1 } })).toBe('open');
    expect(status(g, sol, { type: 'flow', col: 0, country: 'DE', dir: 'export', value: 1 })).not.toBe('broken');
    expect(status(g, sol, { type: 'column', col: 0, counts: { N: 0 } })).toBe('broken');
  });

  it('review S8 B M13: a hatched bar counts towards no clue', () => {
    const g = byId(6);
    const s = solutionState(g);
    const price = g.clues.find((c) => c.type === 'price')!;
    const col = (price as { col: number }).col;
    const pricier = (Object.keys(g.pieces) as PieceId[]).filter((k) => g.pieces[k]!.rank > g.pieces[(price as { piece: PieceId }).piece]!.rank);
    expect(pricier.length).toBeGreaterThan(0);
    const stray = { ...s, bars: [...s.bars, { piece: pricier[0]!, row: g.demand[col]! + 3, col, len: 1 }] };
    const ev = evaluate(g, stray);
    expect(ev.invalidBars.length).toBe(1);
    expect(status(g, stray, price)).not.toBe('broken');
  });

  it('engaged (pre-placed bar)', () => {
    const g = byId(1);
    const clue: Clue = { type: 'engaged', piece: 'G', row: 2, col: 2, len: 2 };
    expect(status(g, solutionState(g), clue)).toBe('ok');
    expect(status(g, newGame(g), clue)).toBe('broken');
  });

  it('an unmet clue blocks the verdict with its text', () => {
    const g = byId(7);
    g.clues = [{ type: 'bar', piece: 'N', col: 2, len: 3 }];
    const ev = evaluate(g, solutionState(g));
    expect(ev.solved).toBe(false);
    expect(ev.unmet).toEqual(['Indice non respecté : Un réacteur tourne de 6h à 15h.']);
  });

  it('texts read as market documents', () => {
    const g = makeGrid();
    expect(clueText(g, { type: 'price', col: 2, piece: 'G' })).toBe("À 8h, c’est le gaz qui fixe le prix.");
    expect(clueText(g, { type: 'bar', piece: 'N', col: 1, len: 5 })).toBe('Un réacteur tourne de 4h à 24h.');
    expect(clueText(g, { type: 'length', piece: 'N', len: 6 })).toBe("Un réacteur tourne 6 créneaux d’affilée.");
    expect(clueText(g, { type: 'column', col: 4, counts: { G: 2, T: 0 } })).toBe('Relevé de 16h : 2 cases de gaz, aucune case de TAC.');
    expect(clueText(g, { type: 'flow', col: 5, country: 'DE', dir: 'export', value: 1 })).toBe("À 20h, 1 bloc part vers l’Allemagne.");
    expect(clueText(g, { type: 'flow', col: 5, country: 'UK', dir: 'import', value: 0 })).toBe("À 20h, aucun bloc n’arrive du Royaume-Uni.");
    expect(clueText(g, { type: 'exchanges', exports: { DE: 2 }, step: 1 })).toBe("Aujourd’hui : 2 blocs exportés vers l’Allemagne, 1 pompage.");
    expect(clueText(g, { type: 'engaged', piece: 'T', row: 4, col: 4, len: 1 })).toBe('Déjà engagé : une TAC de 16h à 20h, ligne 5.');
  });
});

describe('composition (§8.1)', () => {
  it('two drawings of one composition are both accepted', () => {
    const g = byId(8);
    // Reference row 0: N 0h-15h + N 15h-24h; here N 0h-9h + N 9h-24h (the solver’s drawing)
    const other: PlayState = {
      ...solutionState(g),
      bars: [N(0, 0, 3), N(0, 3, 5), { piece: 'B', row: 1, col: 1, len: 1 }, N(1, 3, 4), { piece: 'B', row: 2, col: 5, len: 1 }],
    };
    const ref = evaluate(g, solutionState(g));
    const alt = evaluate(g, other);
    expect(other.bars).not.toEqual(solutionState(g).bars);
    expect(alt.composition).toEqual(ref.composition);
    expect(alt.solved).toBe(true);
    expect(ref.solved).toBe(true);
  });

  it('swapping two rows of the same plants is the same solution', () => {
    const g = byId(9);
    const s = solutionState(g);
    const swapped: PlayState = { ...s, bars: s.bars.map((b) => (b.row === 0 ? { ...b, row: 1 } : b.row === 1 ? { ...b, row: 0 } : b)) };
    expect(evaluate(g, swapped).solved).toBe(true);
  });

  it('a valid board with another composition is not the expected solution', () => {
    const g = makeGrid({
      demand: [1, 1, 1, 1, 1, 1],
      neighbors: [],
      step: false,
      inventory: { level: 'none', pieces: { N: {}, G: {} } },
      pieces: { N: { len: [3], height: [1], rank: 1, co2: 0 }, G: { len: [3], height: [1], rank: 4, co2: 1 } },
      solution: { exports: {}, step: [], placements: [N(0, 0, 3), { piece: 'G', row: 0, col: 3, len: 3 }] },
    });
    const s: PlayState = { bars: [{ piece: 'G', row: 0, col: 0, len: 3 }, N(0, 3, 3)], exports: {}, step: [] };
    const ev = evaluate(g, s);
    expect(ev.errors).toEqual([]);
    expect(ev.matchesReference).toBe(false);
    expect(ev.unmet).toEqual(['Pose valide, mais ce n’est pas la solution attendue.']);
    expect(ev.solved).toBe(false);
  });
});

describe('immutability', () => {
  const deepFreeze = <T>(o: T): T => {
    if (o && typeof o === 'object') {
      Object.values(o).forEach(deepFreeze);
      Object.freeze(o);
    }
    return o;
  };

  it('actions return a new state and never touch the old one', () => {
    const g = makeGrid();
    const s0 = deepFreeze(newGame(g));
    const s1 = deepFreeze(ok(place(g, s0, N(0, 0, 6))));
    const s2 = deepFreeze(ok(setExport(g, s1, 'DE', 2, 1)));
    const s3 = deepFreeze(ok(addStep(g, s2, 0, 2)));
    const s4 = ok(remove(g, s3, 0, 0));
    ok(removeStep(s3, 0));
    evaluate(g, s3);
    expect(s0.bars).toHaveLength(0);
    expect(s1.exports.DE).toEqual([0, 0, 0, 0, 0, 0]);
    expect(s2.step).toHaveLength(0);
    expect(s3.bars).toHaveLength(1);
    expect(s4.bars).toHaveLength(0);
  });

  it('a refused action hands back the same state', () => {
    const g = makeGrid();
    const s0 = newGame(g);
    const r = place(g, s0, N(5, 0, 6));
    expect(r.state).toBe(s0);
  });
});
