/*
 * Shared reference grids (fixtures/grids/, also played by the Python tests in solver/tests).
 * - Validity: validateGrid() finds exactly the expected errors (same messages as the Python validator).
 * - Valid publishable grids: the reference solution is solved by the engine and its composition is the
 *   one the Python solvers found.
 * - Grids that need a feature the web engine does not have yet (`requires`) are skipped; ramps are supported.
 * - The folder must exist: a missing one fails the run instead of skipping the parity.
 */
import { readFileSync, readdirSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { validateGrid, type Grid } from '../src/model/grid';
import { evaluate } from '../src/engine/evaluate';
import { solutionState } from '../src/engine/state';

interface Expect {
  valid: boolean;
  errors: string[];
  compositions?: number;
  deduction?: string;
  composition?: unknown;
  requires: string[];
}

interface Fixture {
  name: string;
  grid: unknown;
  expect: Expect;
}

const DIR = resolve(__dirname, '../../fixtures/grids');
const SUPPORTED = new Set<string>(['ramp']);
// Only about the Python allow_ramp flag: the game always accepts ramps.
const PYTHON_ONLY = new Set(['invalid-ramp-disabled.json']);
const fixtures = readdirSync(DIR)
  .filter((f) => f.endsWith('.json') && !PYTHON_ONLY.has(f))
  .sort()
  .map((f) => ({ file: f, ...(JSON.parse(readFileSync(resolve(DIR, f), 'utf8')) as Fixture) }));
const playable = fixtures.filter((fx) => fx.expect.requires.every((r) => SUPPORTED.has(r)));

describe('shared reference grids', () => {
  it('has valid, invalid and unpublishable grids', () => {
    expect(fixtures.filter((fx) => fx.file.startsWith('valid-')).length).toBeGreaterThanOrEqual(8);
    expect(fixtures.filter((fx) => fx.file.startsWith('invalid-')).length).toBeGreaterThanOrEqual(15);
    expect(fixtures.some((fx) => fx.file.startsWith('unpublishable-'))).toBe(true);
  });

  it.each(playable.map((fx) => [fx.file, fx] as const))('%s: validator verdict', (_f, fx) => {
    const res = validateGrid(fx.grid);
    expect(res.errors).toEqual(fx.expect.errors);
    expect(res.ok).toBe(fx.expect.valid);
  });

  const solved = playable.filter((fx) => fx.expect.valid && fx.expect.composition !== undefined);
  it.each(solved.map((fx) => [fx.file, fx] as const))('%s: reference solved, same composition', (_f, fx) => {
    const grid = fx.grid as Grid;
    const ev = evaluate(grid, solutionState(grid));
    expect(ev.unmet).toEqual([]);
    expect(ev.solved).toBe(true);
    expect(ev.composition).toEqual(fx.expect.composition);
  });
});
