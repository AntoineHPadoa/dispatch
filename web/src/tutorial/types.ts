/*
 * Tutorial script format (data only, no DOM, no logic).
 * - A script belongs to one grid: `intro` (the guided tutorial grid: presentation spotlights, then a
 *   strict guided solve) or `discovery` (a « Premiers pas » grid: 1-2 spotlights the first time the
 *   player opens it, replayable with « Revoir l'explication »).
 * - Every text is a key of `TUTORIAL` in `i18n/fr.ts` (never French here).
 * - A spotlight targets a named UI anchor (element carrying `data-tutorial="<anchor>"`), a zone of
 *   the board (columns × absolute rows, 0 at the bottom of the grid), or cells of an exchange line.
 * - A guided step waits for engine moves (`engine/rules.ts` actions); any other move is refused.
 *
 * Example:
 *   const s: TutorialScript = { gridId: 101, kind: 'intro', next: 102, steps: [
 *     { kind: 'present', text: 'intro.board', target: { kind: 'anchor', anchor: 'board' } },
 *     { kind: 'guided', technique: 'swap', text: 'intro.solve1',
 *       target: { kind: 'board', cols: [0, 7], rows: [0, 0] },
 *       moves: [{ action: 'place', bar: { piece: 'N', row: 0, col: 0, len: 8 } }] },
 *   ] };
 */
import type { PieceId, Placement } from '../model/grid';

/** Key of a text in `TUTORIAL` (i18n/fr.ts), dot-separated, e.g. `intro.board`. */
export type TextKey = string;

/**
 * Named UI anchors of the game screen. The screen sets `data-tutorial="<anchor>"` on each.
 * - board: the whole board (grid + axes); margins: labels and clues around the grid (column heads,
 *   demand scale, price marks); exchanges: the exchange line(s) under the board;
 * - chips: the plant chips; chip:<piece>: one plant chip; book: the order book card;
 * - clues: the « Publications du marché » card; co2: the CO2 gauge; step: the STEP control;
 * - tools: Gomme/Annuler/Recommencer; tool:erase|undo|reset: one tool; replay: « Revoir l'explication ».
 */
export type UiAnchor =
  | 'board' | 'margins' | 'exchanges' | 'chips' | `chip:${PieceId}` | 'book' | 'clues' | 'co2' | 'step'
  | 'tools' | 'tool:erase' | 'tool:undo' | 'tool:reset' | 'replay';

/** Inclusive range [from, to]. */
export type Range = readonly [number, number];

export type SpotTarget =
  /** A UI element. */
  | { kind: 'anchor'; anchor: UiAnchor }
  /** A rectangle of board cells: columns, absolute rows (omitted rows = the full column height). */
  | { kind: 'board'; cols: Range; rows?: Range }
  /** Cells of one exchange line (one neighbor), over some columns. */
  | { kind: 'exchange'; country: string; cols: Range }
  /** One clue of the grid, by its index in `grid.clues` (card entry and its mark on the board). */
  | { kind: 'clue'; index: number };

/** A move the guided step expects: the same arguments as the engine action of that name. */
export type ExpectedMove =
  /**
   * `place` (or `placeOver`) of this bar. Matched on piece, col, len, height and country; `row` too
   * unless `anyRow` (stacked groups whose order does not count, technique `swap`).
   */
  | { action: 'place'; bar: Placement; anyRow?: boolean }
  | { action: 'remove'; row: number; col: number }
  /** `setExport(country, col, value)`: the exchange cell ends at `value` exports. */
  | { action: 'setExport'; country: string; col: number; value: number }
  | { action: 'addStep'; pump: number; turbine: number };

/** Where the bubble sits relative to its target; `auto` lets the engine choose. */
export type BubbleSide = 'auto' | 'top' | 'bottom' | 'left' | 'right';

interface StepBase {
  /** Bubble text. 1-2 sentences, 25 words at most. */
  text: TextKey;
  /** Highlighted element or zone; none = centered bubble over a dimmed screen. */
  target?: SpotTarget;
  side?: BubbleSide;
}

/** Presentation spotlight: the player reads, then clicks « Suivant » (or « Passer » the script). */
export interface PresentStep extends StepBase {
  kind: 'present';
}

/**
 * Guided move: only the expected moves are accepted (any order when several); the step ends when
 * all are played. Undo/erase of a guided move is refused while the guide runs.
 */
export interface GuidedStep extends StepBase {
  kind: 'guided';
  /** §9 technique applied at this step: key of `TECHNIQUES` in fr.ts, its name shown in bold. */
  technique: string;
  moves: readonly ExpectedMove[];
}

export type TutorialStep = PresentStep | GuidedStep;

export interface TutorialScript {
  /** Grid id in grids.json. */
  gridId: number;
  /** `intro`: launched by the « Tutoriel » button; `discovery`: first opening of a « Premiers pas » grid. */
  kind: 'intro' | 'discovery';
  steps: readonly TutorialStep[];
  /** Grid opened at the end (intro: first grid of « Premiers pas »). */
  next?: number;
}
