/*
 * Converted grids (src/data/grids.json): structure (§14) and reference solutions.
 * - Each grid passes validateGrid().
 * - Each reference solution satisfies every rule and clue, checked by a small standalone
 *   checker written here on purpose (independent from src/engine).
 */
import { describe, expect, it } from 'vitest';
import gridsJson from '../src/data/grids.json';
import { cellCount, cellsOf } from '../src/model/shapes';
import {
  ANY_COUNTRY, IMPORT_PIECE, PIECE_SPEC, validateGrid, type Clue, type Grid, type PieceId, type Placement,
} from '../src/model/grid';

const grids = gridsJson as unknown as Grid[];

/** Every rule or clue the reference solution breaks (empty when valid). */
function solutionErrors(g: Grid): string[] {
  const errs: string[] = [];
  const n = g.columns.length;
  const sol = g.solution;
  const nbIds = g.neighbors.map((nb) => nb.id);

  // Silhouette
  const h = g.demand.map((d, c) => d - g.weather.R[c]! - g.weather.F[c]!);
  for (const id of nbIds) (sol.exports[id] ?? []).forEach((e, c) => { h[c]! += e; });
  for (const s of sol.step) {
    if (!g.step) errs.push('STEP without STEP');
    if (s.pump >= s.turbine) errs.push('STEP reversed');
    h[s.pump]! += 1;
    h[s.turbine]! -= 1;
  }
  h.forEach((v, c) => { if (v < 0) errs.push(`negative height at ${c}`); });

  // Placements: shape, silhouette, overlap, coverage
  const cell = new Map<string, Placement>();
  for (const p of sol.placements) {
    const ph = p.height ?? 1;
    if (p.piece === IMPORT_PIECE) {
      if (p.len !== 1 || ph !== 1) errs.push('import is one cell');
    } else {
      const def = g.pieces[p.piece];
      if (!def) { errs.push(`unknown piece ${p.piece}`); continue; }
      if (!def.len.includes(p.len)) errs.push(`bad width ${p.piece} ${p.len}`);
      if (!(def.height ?? [1]).includes(ph)) errs.push(`bad height ${p.piece} ${ph}`);
    }
    for (const [r, c] of cellsOf(g, p)) {
      if (c >= n || r >= h[c]!) errs.push(`outside silhouette at ${r},${c}`);
      const k = `${r},${c}`;
      if (cell.has(k)) errs.push(`overlap at ${k}`);
      cell.set(k, p);
    }
  }
  for (let c = 0; c < n; c++) for (let r = 0; r < h[c]!; r++) if (!cell.has(`${r},${c}`)) errs.push(`hole at ${r},${c}`);

  const colCells = (c: number) => [...cell.entries()].filter(([k]) => Number(k.split(',')[1]) === c).map(([, p]) => p);
  const imports = (id: string, c?: number) => sol.placements
    .filter((p) => p.piece === IMPORT_PIECE && p.country === id && (c === undefined || c === p.col)).length;
  const exportsOf = (id: string) => (sol.exports[id] ?? []).reduce((a, b) => a + b, 0);
  const pieceCells = (id: PieceId) => sol.placements.filter((p) => p.piece === id)
    .reduce((a, p) => a + cellCount(g, p), 0);

  // Lines
  for (const nb of g.neighbors) {
    for (let c = 0; c < n; c++) {
      if ((sol.exports[nb.id]?.[c] ?? 0) + imports(nb.id, c) > nb.cap) errs.push(`line saturated ${nb.id} ${c}`);
    }
  }

  // Exchange totals (inventory at exact level, clue at level none)
  const checkTotals = (where: string, t: { exports?: Record<string, number>; imports?: Record<string, number>; step?: number }) => {
    for (const [k, v] of Object.entries(t.exports ?? {})) if (exportsOf(k) !== v) errs.push(`${where} exports ${k}`);
    for (const [k, v] of Object.entries(t.imports ?? {})) {
      const got = k === ANY_COUNTRY ? nbIds.reduce((a, id) => a + imports(id), 0) : imports(k);
      if (got !== v) errs.push(`${where} imports ${k}`);
    }
    if (t.step !== undefined && sol.step.length !== t.step) errs.push(`${where} step`);
  };

  // Inventory
  for (const p of sol.placements) {
    if (p.piece !== IMPORT_PIECE && g.inventory.pieces[p.piece] === undefined) errs.push(`${p.piece} not available`);
  }
  for (const [id, spec] of Object.entries(g.inventory.pieces) as [PieceId, NonNullable<Grid['inventory']['pieces'][PieceId]>][]) {
    const lens = sol.placements.filter((p) => p.piece === id).map((p) => p.len).sort();
    if (spec.bars && JSON.stringify(lens) !== JSON.stringify([...spec.bars].sort())) errs.push(`inventory bars ${id}`);
    if (spec.cells !== undefined && pieceCells(id) !== spec.cells) errs.push(`inventory cells ${id}`);
    if (spec.max_cells !== undefined && pieceCells(id) > spec.max_cells) errs.push(`stock ${id}`);
  }
  checkTotals('inventory', g.inventory);

  // CO2
  if (g.co2_cap !== null) {
    let co2 = 0;
    for (const p of sol.placements) {
      const per = p.piece === IMPORT_PIECE ? g.neighbors.find((nb) => nb.id === p.country)!.co2 : g.pieces[p.piece]!.co2;
      co2 += per * p.len * (p.height ?? 1);
    }
    if (co2 > g.co2_cap) errs.push('CO2 cap');
  }

  // Clues
  const clueOk = (cl: Clue): boolean => {
    switch (cl.type) {
      case 'price': {
        const cs = colCells(cl.col);
        if (cs.some((p) => p.piece === IMPORT_PIECE)) return false;
        const top = cs.reduce<PieceId | null>((a, p) => {
          const id = p.piece as PieceId;
          return a === null || g.pieces[id]!.rank > g.pieces[a]!.rank ? id : a;
        }, null);
        return top === cl.piece;
      }
      case 'bar':
        return sol.placements.some((p) => p.piece === cl.piece && p.col === cl.col && p.len === cl.len);
      case 'length':
        return sol.placements.some((p) => p.piece === cl.piece && p.len === cl.len);
      case 'column':
        return Object.entries(cl.counts).every(([k, v]) => colCells(cl.col).filter((p) =>
          (k.startsWith('I:') ? p.piece === IMPORT_PIECE && p.country === k.slice(2) : p.piece === k)).length === v);
      case 'flow':
        return (cl.dir === 'export' ? sol.exports[cl.country]?.[cl.col] ?? 0 : imports(cl.country, cl.col)) === cl.value;
      case 'exchanges': {
        const before = errs.length;
        checkTotals('clue', cl);
        return errs.length === before;
      }
      case 'engaged':
        return sol.placements.some((p) => p.piece === cl.piece && p.row === cl.row && p.col === cl.col && p.len === cl.len);
    }
  };
  g.clues.forEach((cl, i) => { if (!clueOk(cl)) errs.push(`clue ${i} (${cl.type})`); });
  return errs;
}

describe('converted grids', () => {
  it('has the 11 pose grids: 7 tutorial then 4 rated', () => {
    expect(grids.map((g) => g.id)).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11]);
    expect(grids.filter((g) => g.section === 'tutorial')).toHaveLength(7);
    expect(grids.slice(7).every((g) => g.section === 'rated')).toBe(true);
  });

  it.each(grids.map((g) => [g.id, g] as const))('grid %i passes structural validation', (_id, g) => {
    expect(validateGrid(g).errors).toEqual([]);
  });

  it.each(grids.map((g) => [g.id, g] as const))('grid %i: reference solution satisfies rules and clues', (_id, g) => {
    expect(solutionErrors(g)).toEqual([]);
  });

  it('the checker catches a broken solution or clue', () => {
    const g = structuredClone(grids[5]!);
    g.solution.placements.pop();
    expect(solutionErrors(g).join()).toMatch(/hole/);
    const h = structuredClone(grids[5]!);
    h.clues = [{ type: 'price', col: 2, piece: 'N' }];
    expect(solutionErrors(h).join()).toMatch(/clue 0/);
  });

  it('tutorial grids keep their intro and introduced technique', () => {
    for (const g of grids.filter((x) => x.section === 'tutorial')) {
      expect(g.intro).toBeTruthy();
      expect(g.teaches?.length).toBeGreaterThan(0);
    }
  });

  it('no price clue sits on a column with an import (§3)', () => {
    for (const g of grids) {
      for (const cl of g.clues) {
        if (cl.type !== 'price') continue;
        expect(g.solution.placements.some((p) => p.piece === IMPORT_PIECE && p.col === cl.col)).toBe(false);
      }
    }
  });

  it('level none grids carry no exchange totals in the inventory', () => {
    for (const g of grids.filter((x) => x.inventory.level === 'none')) {
      expect(g.inventory.exports).toBeUndefined();
      expect(g.inventory.imports).toBeUndefined();
      if (g.neighbors.length || g.step) expect(g.clues.some((c) => c.type === 'exchanges')).toBe(true);
    }
  });
});

describe('validateGrid', () => {
  const base = grids[6]!;
  const broken = (patch: (g: Record<string, unknown>) => void) => {
    const g = structuredClone(base) as unknown as Record<string, unknown>;
    patch(g);
    return validateGrid(g);
  };

  it('rejects malformed grids with a message', () => {
    expect(validateGrid(null).ok).toBe(false);
    expect(broken((g) => { g.demand = [1, 2]; }).errors.join()).toMatch(/demand/);
    expect(broken((g) => { (g.pieces as Record<string, unknown>).X = {}; }).errors.join()).toMatch(/unknown piece/);
    expect(broken((g) => { (g.clues as unknown[]).push({ type: 'price', col: 99, piece: 'N' }); }).errors.join()).toMatch(/col/);
    expect(broken((g) => { (g.clues as unknown[]).push({ type: 'flow', col: 0, country: 'UK', dir: 'export', value: 1 }); }).errors.join()).toMatch(/country/);
    expect(broken((g) => { (g.clues as unknown[]).push({ type: 'magic' }); }).errors.join()).toMatch(/clue type/);
    expect(broken((g) => { g.step = false; }).errors.join()).toMatch(/STEP/);
  });

  it('a STEP grid must publish its number of pairs', () => {
    expect(validateGrid(structuredClone(base)).ok).toBe(true);
    const noTotal = broken((g) => {
      delete (g.inventory as Record<string, unknown>).step;
      for (const c of g.clues as Record<string, unknown>[]) if (c.type === 'exchanges') delete c.step;
    });
    expect(noTotal.errors.join()).toMatch(/must publish its number of pairs/);
    // an exchanges-clue total is enough at level none
    const viaClue = broken((g) => {
      delete (g.inventory as Record<string, unknown>).step;
      (g.clues as unknown[]).push({ type: 'exchanges', step: 1 });
    });
    expect(viaClue.errors.join()).not.toMatch(/publish/);
  });

  type Rec = Record<string, unknown>;
  const placements = (g: Rec) => (g.solution as { placements: Rec[] }).placements;
  const errorsOf = (patch: (g: Rec) => void) => broken(patch).errors.join('\n');

  it('base grid is valid', () => {
    expect(validateGrid(base).errors).toEqual([]);
  });

  it('checks the geometry of solution placements', () => {
    expect(errorsOf((g) => { placements(g).find((p) => p.piece === 'N')!.len = 9; })).toMatch(/placements\[\d+\]\.len: width not allowed/);
    expect(errorsOf((g) => { const p = placements(g).find((x) => x.piece === 'N')!; p.col = 7; p.len = 3; })).toMatch(/goes past the last column/);
    expect(errorsOf((g) => { placements(g).find((p) => p.piece === 'N')!.height = 2; })).toMatch(/height not allowed/);
    expect(errorsOf((g) => { placements(g).push({ piece: 'I', country: 'DE', row: 0, col: 0, len: 2 }); })).toMatch(/an import is one cell/);
    expect(errorsOf((g) => { placements(g).push({ piece: 'I', country: 'DE', row: 0, col: 0, len: 1, height: 2 }); })).toMatch(/an import is one cell/);
    expect(errorsOf((g) => { placements(g).push({ piece: 'I', country: 'DE', row: 0, col: 8, len: 1 }); })).toMatch(/column index|col/);
  });

  it('checks the geometry of engaged bars', () => {
    const engaged = (extra: Rec) => (g: Rec) => {
      (g.clues as Rec[]).push({ type: 'engaged', piece: 'N', row: 0, col: 0, len: 3, ...extra });
    };
    expect(errorsOf(engaged({}))).toBe('');
    expect(errorsOf(engaged({ len: 9 }))).toMatch(/\.len: width not allowed/);
    expect(errorsOf(engaged({ col: 6, len: 3 }))).toMatch(/goes past the last column/);
    expect(errorsOf(engaged({ height: 2 }))).toMatch(/height not allowed/);
  });

  it('requires pump before turbine', () => {
    const step = (g: Rec) => (g.solution as { step: Rec[] }).step;
    expect(errorsOf((g) => { step(g)[0] = { pump: 4, turbine: 1 }; })).toMatch(/pump must come before turbine/);
    expect(errorsOf((g) => { step(g)[0] = { pump: 2, turbine: 2 }; })).toMatch(/pump must come before turbine/);
  });

  it('matches ranks and CO2 to §3', () => {
    const piece = (g: Rec) => (g.pieces as Record<string, Rec>).N!;
    expect(errorsOf((g) => { piece(g).rank = 4; })).toMatch(/pieces\.N\.rank: 1 expected/);
    expect(errorsOf((g) => { piece(g).co2 = 1; })).toMatch(/pieces\.N\.co2: 0 expected/);
    expect(PIECE_SPEC.G).toEqual({ rank: 4, co2: 1 });
  });

  it('accepts 6 to 12 columns only', () => {
    const resize = (n: number) => (g: Rec) => {
      g.columns = Array.from({ length: n }, (_, i) => `${i}h`);
      g.demand = new Array<number>(n).fill(1);
      g.weather = { R: new Array<number>(n).fill(0), F: new Array<number>(n).fill(0) };
    };
    expect(errorsOf(resize(5))).toMatch(/columns: 6 to 12 labels expected/);
    expect(errorsOf(resize(13))).toMatch(/columns: 6 to 12 labels expected/);
    expect(errorsOf(resize(6))).not.toMatch(/columns:/);
    expect(errorsOf(resize(12))).not.toMatch(/columns:/);
  });

  it('refuses "*" mixed with country keys in imports', () => {
    const inv = (g: Rec) => g.inventory as Rec;
    expect(errorsOf((g) => { inv(g).imports = { '*': 2, DE: 1 }; })).toMatch(/cannot be mixed/);
    expect(errorsOf((g) => { (g.clues as Rec[]).push({ type: 'exchanges', imports: { '*': 2, DE: 1 } }); })).toMatch(/cannot be mixed/);
    expect(errorsOf((g) => { inv(g).imports = { '*': 2 }; })).toBe('');
  });

  it('requires pieces and inventory.pieces to have the same keys', () => {
    expect(errorsOf((g) => { delete (g.inventory as { pieces: Rec }).pieces.N; })).toMatch(/inventory\.pieces\.N: missing/);
    expect(errorsOf((g) => { (g.inventory as { pieces: Rec }).pieces.T = { cells: 1 }; })).toMatch(/inventory\.pieces\.T: not a grid piece/);
  });

  it('refuses a flow above the line capacity', () => {
    const cap = (base.neighbors[0] as { cap: number }).cap;
    expect(errorsOf((g) => { (g.clues as Rec[]).push({ type: 'flow', col: 0, country: 'DE', dir: 'export', value: cap + 1 }); })).toMatch(/clues\[\d+\]\.value: over the line capacity/);
    expect(errorsOf((g) => { (g.clues as Rec[]).push({ type: 'flow', col: 0, country: 'DE', dir: 'import', value: cap }); })).toBe('');
    expect(errorsOf((g) => { (g.solution as { exports: Record<string, number[]> }).exports.DE![0] = cap + 1; })).toMatch(/solution\.exports\.DE: over the line capacity/);
  });
});
