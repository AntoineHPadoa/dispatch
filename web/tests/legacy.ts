/*
 * Former tutorial grids (ids 1-7, 12 and 13), no longer published, kept as test data.
 * - Source: fixtures/legacy-tutorials.json, shared with the Python tests (solver/tests/conftest.py).
 * - gridById(): a published grid, else a former tutorial, as a fresh copy.
 */
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import gridsJson from '../src/data/grids.json';
import type { Grid } from '../src/model/grid';

export const legacyGrids = JSON.parse(readFileSync(resolve(__dirname, '../../fixtures/legacy-tutorials.json'), 'utf8')) as Grid[];

const published = gridsJson as unknown as Grid[];

export const gridById = (id: number): Grid => {
  const g = published.find((x) => x.id === id) ?? legacyGrids.find((x) => x.id === id);
  if (!g) throw new Error(`no grid ${id}`);
  return structuredClone(g);
};
