/*
 * Training dossiers: fixed grids gathered by theme, playable at any time (pure, no DOM).
 * - "Premiers pas" holds the tutorial section in id order, except the guided tutorial grid (opened from
 *   the home « Tutoriel » button).
 * - dossierProgress(): how many grids of a dossier are finished.
 */
import type { Grid } from './grid';
import { INTRO } from '../tutorial/script';

export interface Dossier {
  id: string;
  grids: Grid[];
}

export function dossiers(grids: readonly Grid[]): Dossier[] {
  const tutorial = grids.filter((g) => g.section === 'tutorial' && g.id !== INTRO.gridId).sort((a, b) => a.id - b.id);
  return tutorial.length ? [{ id: 'premiers-pas', grids: tutorial }] : [];
}

/** Finished grids of a dossier and its size; `isDone` tells whether a grid is finished. */
export function dossierProgress(d: Dossier, isDone: (gridId: number) => boolean): { done: number; total: number } {
  return { done: d.grids.filter((g) => isDone(g.id)).length, total: d.grids.length };
}

/** The grid a dossier card opens: the first unfinished one, else the first. */
export function dossierNext(d: Dossier, isDone: (gridId: number) => boolean): Grid | null {
  return d.grids.find((g) => !isDone(g.id)) ?? d.grids[0] ?? null;
}
