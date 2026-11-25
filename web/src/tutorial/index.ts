/*
 * Tutorial scripts by grid id, and the pure runner (guide.ts) and geometry (layout.ts).
 * Example: const script = scriptFor(grid.id); if (script) mountTutorial(...);
 */
import { PROVISIONAL_SCRIPT } from './provisional';
import type { TutorialScript } from './types';

export const SCRIPTS: readonly TutorialScript[] = [PROVISIONAL_SCRIPT];

export const scriptFor = (gridId: number): TutorialScript | null => SCRIPTS.find((s) => s.gridId === gridId) ?? null;

export * from './guide';
export * from './layout';
export type * from './types';
