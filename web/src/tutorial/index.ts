/*
 * Tutorial scripts by grid id (script.ts), the pure runner (guide.ts) and the spotlight geometry (layout.ts).
 * Example: const script = scriptFor(grid.id); if (script) mountTutorial(...);
 */
import { INTRO, TUTORIAL_SCRIPTS } from './script';
import type { TutorialScript } from './types';

export const SCRIPTS: readonly TutorialScript[] = Object.values(TUTORIAL_SCRIPTS);

export const scriptFor = (gridId: number): TutorialScript | null => TUTORIAL_SCRIPTS[gridId] ?? null;

/** Grid of the guided tutorial (opened by the « Tutoriel » button, outside the « Premiers pas » dossier). */
export const INTRO_GRID_ID = INTRO.gridId;

export * from './guide';
export * from './layout';
export type * from './types';
