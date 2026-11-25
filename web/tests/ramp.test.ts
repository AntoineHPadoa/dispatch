/*
 * Coal ramp tests: shapes cell by cell, validator, engine rules and composition, board outline,
 * order book glyph, gesture. Parity with the Python reference grids (fixtures/grids, ramps included)
 * is in reference.test.ts.
 */
import { describe, expect, it } from 'vitest';
import { validateGrid, type Grid, type Placement } from '../src/model/grid';
import { cellCount, cellsOf, profile } from '../src/model/shapes';
import {
  barIndexAt, checkPlaceOver, checkPlacement, co2Total, composition, evaluate, newGame, pieceCells, place, remove,
  solutionState, type ActionResult, type PlayState,
} from '../src/engine';
import { renderBoard, roundedPath, skyline } from '../src/ui/board';
import { bookEntries, renderBook, renderCo2 } from '../src/ui/panels';
import { sheetSilhouette } from '../src/ui/home-art';
import { isFlat, rectBetween } from '../src/ui/gesture';
import { MSG, UI, clueText, placementLabel } from '../src/i18n/fr';
import { PIECE_COLORS } from '../src/ui/palette';

/** Study grid T1: exact inventory, no clue; the plateau bars the row above the base. */
function t1(patch: Partial<Grid> = {}): Grid {
  return {
    id: 98,
    title: 'T1',
    section: 'tutorial',
    columns: ['0h', '4h', '8h', '12h', '16h', '20h'],
    demand: [3, 3, 2, 2, 2, 2],
    pieces: {
      N: { len: [3, 4, 5, 6], height: [1], rank: 1, co2: 0 },
      C: { shape: 'trap', len: [3, 4, 5], rank: 3, co2: 3 },
      T: { len: [1], height: [1], rank: 5, co2: 2 },
    },
    weather: { R: [0, 0, 0, 0, 0, 0], F: [0, 0, 0, 0, 0, 0] },
    neighbors: [],
    step: false,
    co2_cap: null,
    inventory: { level: 'exact', pieces: { N: { bars: [3, 6] }, C: { bars: [3] }, T: { cells: 1 } } },
    clues: [],
    solution: {
      exports: {},
      step: [],
      placements: [
        { piece: 'N', row: 0, col: 0, len: 6 }, { piece: 'C', row: 1, col: 0, len: 3 },
        { piece: 'T', row: 2, col: 0, len: 1 }, { piece: 'N', row: 1, col: 3, len: 3 },
      ],
    },
    difficulty: { rating: 1, label: 'Facile', techniques: [] },
    ...patch,
  };
}

function ok(r: ActionResult): PlayState {
  if (!r.ok) throw new Error(`unexpected refusal: ${r.error.message}`);
  return r.state;
}

const C = (row: number, col: number, len: number): Placement => ({ piece: 'C', row, col, len });
const N = (row: number, col: number, len: number): Placement => ({ piece: 'N', row, col, len });

describe('shapes', () => {
  it('profiles: trapeze 1-2-1, stair 2-1, rectangle', () => {
    expect(profile('trap', 4)).toEqual([[0, 1], [0, 2], [0, 2], [0, 1]]);
    expect(profile('trap', 3)).toEqual([[0, 1], [0, 2], [0, 1]]);
    expect(profile('stair', 3)).toEqual([[0, 2], [0, 2], [0, 1]]);
    expect(profile('rect', 2, 3)).toEqual([[0, 3], [0, 3]]);
  });

  it('cells of a ramp: base row, plateau on the row above', () => {
    const g = t1();
    expect(cellsOf(g, C(1, 2, 4))).toEqual([[1, 2], [1, 3], [2, 3], [1, 4], [2, 4], [1, 5]]);
    expect(cellCount(g, C(0, 0, 5))).toBe(8);
    expect(cellCount(g, N(0, 0, 5))).toBe(5);
  });
});

describe('validator', () => {
  const errs = (g: unknown) => validateGrid(g).errors;

  it('accepts a trapeze coal ramp', () => {
    expect(errs(t1())).toEqual([]);
  });

  it('a ramp is coal only, has no height, and is wide enough', () => {
    const g = t1();
    expect(errs({ ...g, pieces: { ...g.pieces, C: { ...g.pieces.C!, height: [1] } } }))
      .toContain('pieces.C.height: a ramp has no height');
    expect(errs({ ...g, pieces: { ...g.pieces, N: { ...g.pieces.N!, shape: 'trap' } } }))
      .toContain('pieces.N.shape: only coal (C) can be a ramp');
    expect(errs({ ...g, pieces: { ...g.pieces, C: { ...g.pieces.C!, len: [2, 3] } } }))
      .toContain('pieces.C.len: a trap ramp is at least 3 wide');
    expect(errs({ ...g, pieces: { ...g.pieces, C: { ...g.pieces.C!, shape: 'zigzag' } } }))
      .toContain('pieces.C.shape: one of rect, trap, stair expected');
  });

  it('a stair ramp is refused, as the solver does without its flag', () => {
    const g = t1();
    const bad = { ...g, pieces: { ...g.pieces, C: { ...g.pieces.C!, shape: 'stair', len: [2, 3] } } };
    expect(errs(bad)).toContain('pieces.C.shape: ramps are not enabled');
  });

  it('a laid ramp carries no height, and a rectangle still needs one', () => {
    const g = t1();
    const placements = g.solution.placements.map((p) => (p.piece === 'C' ? { ...p, height: 2 } : p));
    expect(errs({ ...g, solution: { ...g.solution, placements } })).toContain('solution.placements[1].height: height not allowed for C');
    const { height: _drop, ...noHeight } = g.pieces.N!;
    expect(errs({ ...g, pieces: { ...g.pieces, N: noHeight } })).toContain('pieces.N.height: ascending positive integers expected');
  });

  it('the drawing: a cell on a ramp plateau overlaps it, an empty drawing is not checked', () => {
    const g = t1();
    const placements = g.solution.placements.map((p) => (p.piece === 'T' ? { ...p, col: 1 } : p));
    expect(errs({ ...g, solution: { ...g.solution, placements } })).toEqual([
      'solution.placements[2]: overlaps solution.placements[1] at 4h',
      'solution: hole at 0h, row 2',
    ]);
    expect(errs({ ...g, solution: { ...g.solution, placements: [] } })).toEqual([]);
  });
});

describe('engine', () => {
  it('the reference solution is solved; composition counts 1 under a shoulder, 2 under the plateau', () => {
    const g = t1();
    const s = solutionState(g);
    const ev = evaluate(g, s);
    expect(ev.unmet).toEqual([]);
    expect(ev.solved).toBe(true);
    expect(composition(g, s).cells.map((c) => c.C ?? 0)).toEqual([1, 2, 1, 0, 0, 0]);
    expect(pieceCells(g, s, 'C')).toBe(4);
    expect(co2Total(g, s)).toBe(4 * 3 + 2);
  });

  it('the plateau bars the row above the base', () => {
    const g = t1();
    const s = ok(place(g, newGame(g), C(1, 0, 3)));
    const r = checkPlacement(g, s, { piece: 'T', row: 2, col: 1, len: 1 });
    expect(r.ok ? null : r.error.code).toBe('overlap');
    expect(checkPlacement(g, s, { piece: 'T', row: 2, col: 0, len: 1 }).ok).toBe(true);
  });

  it('the plateau must fit under the silhouette', () => {
    const g = t1();
    const r = checkPlacement(g, newGame(g), C(1, 2, 3));
    expect(r.ok ? null : r.error).toEqual({ code: 'silhouette', message: 'Hors de la silhouette à 12h.' });
  });

  it('a ramp too short is refused with its own message', () => {
    const g = t1();
    const r = checkPlacement(g, newGame(g), C(1, 0, 2));
    expect(r.ok ? null : r.error).toEqual({ code: 'length', message: 'Un groupe de charbon à paliers fait 3 à 5 créneaux.' });
    const h = checkPlacement(g, newGame(g), { ...C(1, 0, 3), height: 2 });
    expect(h.ok ? null : h.error.code).toBe('height');
  });

  it('a plateau cell finds, replaces and removes the ramp', () => {
    const g = t1();
    const s = ok(place(g, newGame(g), C(1, 0, 3)));
    expect(barIndexAt(g, s, 2, 1)).toBe(0);
    expect(barIndexAt(g, s, 2, 0)).toBe(-1);
    const over = checkPlaceOver(g, s, { piece: 'T', row: 2, col: 1, len: 1 });
    expect(over.replaced).toEqual([0]);
    expect(ok(remove(g, s, 2, 1)).bars).toEqual([]);
  });

  it('a hidden plateau overlap is reported on the board verdict', () => {
    const g = t1();
    const s: PlayState = { bars: [C(1, 0, 3), N(2, 1, 1)], exports: {}, step: [] };
    expect(evaluate(g, s).invalidBars).toEqual([1]);
  });
});

describe('board', () => {
  it('skyline follows the profile, with the steps on the taller column', () => {
    expect(skyline(0, 100, [1, 2, 1], 10, 2)).toEqual([
      [1, 99], [1, 91], [11, 91], [11, 81], [19, 81], [19, 91], [29, 91], [29, 99],
    ]);
    expect(roundedPath([[0, 0], [10, 0], [10, 10]], 0)).toBe('M0 0 L10 0 L10 10 Z');
    expect(roundedPath([[0, 0], [10, 0], [10, 10], [0, 10]], 2)).toContain('Q10 0');
  });

  it('a ramp is drawn as one outline on screen and on paper (engaged)', () => {
    const g = t1();
    const screen = renderBoard({ grid: g, state: solutionState(g), ev: null, style: 'A', cell: 50 }).svg;
    expect(screen).toMatch(new RegExp(`<path d="M[^"]+" fill="${PIECE_COLORS.C.a}"`));
    const engaged = t1({ clues: [{ type: 'engaged', piece: 'C', row: 1, col: 0, len: 3 }] });
    const paper = renderBoard({ grid: engaged, state: newGame(engaged), ev: null, style: 'B', cell: 40 }).svg;
    expect(paper).toMatch(new RegExp(`<path d="M[^"Q]+ Z" fill="${PIECE_COLORS.C.b}" stroke=`));
  });

  it('the preview of a ramp draws its outline', () => {
    const g = t1();
    const svg = renderBoard({
      grid: g, state: newGame(g), ev: null, style: 'A', cell: 50,
      preview: { rect: { row: 1, col: 0, len: 3, height: 1 }, piece: 'C', valid: true },
    }).svg;
    expect(svg).toContain('<path class="preview"');
  });
});

describe('book, texts and gesture', () => {
  it('the order book shows a ramp glyph and its width range', () => {
    const g = t1();
    expect(bookEntries(g).find((e) => e.key === 'C')?.shape).toBe('trap');
    const html = renderBook(g, newGame(g), 'C');
    // Screen: no hint; a free ramp shows one glyph at the widest scale (5 columns, 3 solid, the middle ones dashed); paper keeps the hint.
    expect(html).not.toContain('à paliers');
    const widths = (h: string) => [...(h.split('data-piece="C"')[1]!.split('data-piece=')[0]!
      .matchAll(/<span class="mb" style="grid-template-columns:repeat\((\d),auto\)"/g))].map((m) => m[1]);
    expect(widths(html)).toEqual(['3']);
    const free = t1({ inventory: { level: 'none', pieces: { N: {}, C: {}, T: {} } } });
    expect(widths(renderBook(free, newGame(free), null))).toEqual(['5']);
    expect(renderBook(g, newGame(g), null, true)).toContain('à paliers, 3 à 5 créneaux');
    // A ramp of 3 on two rows: two blank shoulder slots on the top row.
    expect(html).toMatch(/<span class="mb" style="grid-template-columns:repeat\(3,auto\)"><i class="e"><\/i><i class=""[^>]*><\/i><i class="e"><\/i>/);
  });

  it('a laid ramp is named by its base row', () => {
    expect(placementLabel(t1(), 'C', undefined, 1, 0, 3, 1, 'trap')).toBe('Charbon par paliers de 0h à 12h, base ligne 2');
  });

  it('a ramp is laid by its base row, like a bar', () => {
    const shape = { lens: [3, 4, 5], heights: [1], kind: 'trap' as const };
    expect(isFlat(shape)).toBe(true);
    expect(rectBetween({ row: 1, col: 0 }, { row: 3, col: 4 }, shape)).toEqual({ row: 1, col: 0, len: 5, height: 1 });
  });
});

describe('ramp details: gauge, validator, sheet, messages', () => {
  it('the CO2 gauge counts a ramp by its cells, like the engine', () => {
    const g = t1({ co2_cap: 20 });
    const s = solutionState(g);
    expect(co2Total(g, s)).toBe(14);
    const html = renderCo2(g, s);
    expect(html).toContain(UI.co2Points(14, 20));
    expect(html).toContain('width:60%'); // 12 of the 20 points, coal colour
  });

  it('shape: null is refused, as in Python', () => {
    const g = t1();
    const bad = { ...g, pieces: { ...g.pieces, C: { ...g.pieces.C!, shape: null } } };
    expect(validateGrid(bad).errors).toContain('pieces.C.shape: one of rect, trap, stair expected');
  });

  it('the finished sheet of the day draws a ramp as one outline', () => {
    const g = t1();
    const svg = sheetSilhouette(g, ['sun', 'sun', 'sun', 'sun', 'sun', 'sun'], () => '', 'x', true);
    expect(svg).toMatch(new RegExp(`<path class="sil-piece" d="M[^"]+" fill="${PIECE_COLORS.C.a}"`));
    expect(svg.match(/<rect class="sil-piece"/g)).toHaveLength(3);
  });

  it('messages name a ramp a ramp', () => {
    const g = t1();
    const full = ok(place(g, newGame(g), C(1, 0, 3)));
    const r = place(g, full, C(0, 3, 3));
    expect(!r.ok && r.error.message).toBe(MSG.inventoryBar('de charbon', 3, true));
    expect(MSG.inventoryBar('de charbon', 3, true)).toMatch(/^Plus de groupe à paliers /);
    const out = place(g, newGame(g), C(1, 4, 3));
    expect(!out.ok && out.error.message).toBe('Le groupe à paliers dépasse de la grille.');
    expect(UI.replaces(g, [{ piece: 'C' }])).toBe('Remplace 1 groupe à paliers de charbon');
    expect(UI.replaces(g, [{ piece: 'N' }])).toBe('Remplace 1 groupe de nucléaire');
  });

  it('an engaged ramp is named by its base row', () => {
    expect(clueText(t1(), { type: 'engaged', piece: 'C', row: 1, col: 0, len: 3 })).toBe('Groupe déjà engagé : une centrale à charbon de 0h à 12h, base ligne 2.');
  });

  it('a stair ramp (validated, not in the game yet) is drawn as one outline', () => {
    const g = t1({
      pieces: { ...t1().pieces, C: { len: [2, 3, 4], shape: 'stair', rank: 3, co2: 3 } },
      inventory: { level: 'exact', pieces: { N: { bars: [3, 6] }, C: { bars: [3] }, T: { cells: 1 } } },
    });
    const s: PlayState = { ...newGame(g), bars: [C(1, 0, 3)] };
    expect(cellCount(g, C(1, 0, 3))).toBe(5);
    const svg = renderBoard({ grid: g, state: s, ev: null, style: 'A', cell: 50 }).svg;
    expect(svg.match(new RegExp(`<path d="M[^"]+" fill="${PIECE_COLORS.C.a}"`, 'g'))).toHaveLength(1);
  });
});
