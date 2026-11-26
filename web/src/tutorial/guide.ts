/*
 * Tutorial runner logic (pure, no DOM): where a script stands, which player move it accepts, and the
 * board it expects.
 * - A run is the current step index plus the moves already played in that step (guided steps may
 *   expect several moves, in any order). Present steps advance with next(); guided steps advance
 *   when every expected move is played.
 * - Strict guiding: gate() refuses any attempt that is not one of the step's unplayed moves (undo,
 *   reset, eraser and STEP tag removal included), and any pose that would replace a plant already
 *   laid. Export taps (+1 each) are accepted while they climb towards the expected value; a STEP pair
 *   is two taps (pump, then turbine).
 * - expectedBoard() replays the script's moves from the initial board (with the row the player chose
 *   for `anyRow` moves), so a reload resumes on the exact board the run expects. Only a script with
 *   guided steps owns the board (touchesBoard): a discovery never changes it.
 * - Runs are stored under their own localStorage key (never the progress key), guarded by try/catch.
 *
 * Example:
 *   let run = startRun();
 *   const g = gate(grid, script, run, board, attempt);
 *   if (g.ok) { board = applyMove(grid, board, attempt); run = record(script, run, g); }
 */
import type { Grid, Placement } from '../model/grid';
import { addStep, barIndexAt, checkPlaceOver, exportsAt, placeOver, remove, setExport, type PlayState } from '../engine';
import type { ExpectedMove, GuidedStep, TutorialScript, TutorialStep } from './types';

/** Screen width from which the tutorial runs (below it, the grid plays normally). */
export const TUTORIAL_MIN_WIDTH = 1024;

export type RunStatus = 'running' | 'finished' | 'skipped';

export interface TutorialRun {
  status: RunStatus;
  /** Index of the current step in `script.steps`. */
  step: number;
  /** Indexes (in the current guided step's `moves`) already played. */
  played: number[];
  /** Row the player chose for each `anyRow` move played, by `<step>:<move>`. */
  rows?: Record<string, number>;
}

/** What the player tries on the board. `value` of setExport is the value after the tap. */
export type Attempt =
  | ExpectedMove
  | { action: 'pump'; col: number }
  | { action: 'turbine'; pump: number; col: number }
  | { action: 'tool'; tool: 'erase' | 'undo' | 'reset' }
  | { action: 'removeStep' };

/** `move`: index of the completed expected move (null on a partial one); `row`: the row laid, for an `anyRow` pose. */
export type GateResult = { ok: true; move: number | null; row?: number } | { ok: false };

export const startRun = (): TutorialRun => ({ status: 'running', step: 0, played: [] });

export function currentStep(script: TutorialScript, run: TutorialRun): TutorialStep | null {
  return run.status === 'running' ? script.steps[run.step] ?? null : null;
}

const isGuided = (s: TutorialStep | null): s is GuidedStep => s?.kind === 'guided';

/** Advance past the current step (present steps; also used once a guided step is complete). */
export function next(script: TutorialScript, run: TutorialRun): TutorialRun {
  if (run.status !== 'running') return run;
  const step = run.step + 1;
  return { ...run, status: step >= script.steps.length ? 'finished' : 'running', step, played: [] };
}

/** Does the script drive the board (guided steps)? A discovery only shows bubbles. */
export const touchesBoard = (script: TutorialScript): boolean => script.steps.some((s) => s.kind === 'guided');

export const skip = (run: TutorialRun): TutorialRun => ({ ...run, status: 'skipped', played: [] });

const sameBar = (a: Placement, b: Placement, anyRow: boolean) => a.piece === b.piece && a.col === b.col && a.len === b.len
  && (a.height ?? 1) === (b.height ?? 1) && (a.country ?? '') === (b.country ?? '') && (anyRow || a.row === b.row);

/** Does the attempt match (or, for an export or a pump tap, progress towards) this expected move? */
function matches(grid: Grid, board: PlayState, exp: ExpectedMove, at: Attempt): boolean {
  switch (exp.action) {
    case 'place': return at.action === 'place' && sameBar(at.bar, exp.bar, !!exp.anyRow);
    case 'remove': {
      if (at.action !== 'remove') return false;
      const i = barIndexAt(grid, board, exp.row, exp.col);
      return i >= 0 && i === barIndexAt(grid, board, at.row, at.col);
    }
    case 'setExport': {
      if (at.action !== 'setExport' || at.country !== exp.country || at.col !== exp.col) return false;
      return at.value > exportsAt(board, exp.country, exp.col) && at.value <= exp.value;
    }
    case 'addStep':
      return (at.action === 'pump' && at.col === exp.pump)
        || (at.action === 'turbine' && at.pump === exp.pump && at.col === exp.turbine)
        || (at.action === 'addStep' && at.pump === exp.pump && at.turbine === exp.turbine);
  }
}

/** Is this attempt one of the current guided step's unplayed moves? `move`: its index, or null on a partial one. */
export function gate(grid: Grid, script: TutorialScript, run: TutorialRun, board: PlayState, at: Attempt): GateResult {
  const step = currentStep(script, run);
  if (!isGuided(step)) return { ok: false };
  // A pose never replaces a plant while the guide runs: the expected one goes on free cells.
  if (at.action === 'place' && checkPlaceOver(grid, board, at.bar).replaced.length) return { ok: false };
  const k = step.moves.findIndex((m, i) => !run.played.includes(i) && matches(grid, board, m, at));
  if (k < 0) return { ok: false };
  const exp = step.moves[k]!;
  const complete = exp.action === 'setExport' ? at.action === 'setExport' && at.value === exp.value
    : exp.action === 'addStep' ? at.action !== 'pump'
      : true;
  if (exp.action === 'place' && exp.anyRow && at.action === 'place') return { ok: true, move: k, row: at.bar.row };
  return { ok: true, move: complete ? k : null };
}

/**
 * Record an accepted attempt (gate() said ok on the board before it): marks its move played and,
 * when the guided step is complete, opens the next step.
 */
export function record(script: TutorialScript, run: TutorialRun, result: GateResult): TutorialRun {
  if (!result.ok || result.move === null) return run;
  const step = currentStep(script, run);
  if (!isGuided(step)) return run;
  const played = [...run.played, result.move];
  const rows = result.row === undefined ? run.rows : { ...run.rows, [`${run.step}:${result.move}`]: result.row };
  const after = { ...run, played, ...(rows ? { rows } : {}) };
  return played.length >= step.moves.length ? next(script, after) : after;
}

/**
 * Eyebrow of the bubble: rank among the presentation steps (those before the first guided step) or
 * among the guided steps; a presentation step after the solve is the end bubble; or discovery.
 */
export function stepRank(script: TutorialScript, run: TutorialRun): { kind: 'present' | 'guided' | 'end' | 'discovery'; k: number; n: number } {
  const s = script.steps[run.step];
  if (script.kind === 'discovery' || !s) return { kind: 'discovery', k: 0, n: 0 };
  const firstGuided = script.steps.findIndex((x) => x.kind === 'guided');
  const kind = s.kind === 'guided' ? 'guided' : firstGuided >= 0 && run.step > firstGuided ? 'end' : 'present';
  const same = script.steps.map((_, i) => i).filter((i) => (kind === 'guided' ? script.steps[i]!.kind === 'guided'
    : kind === 'present' ? script.steps[i]!.kind === 'present' && (firstGuided < 0 || i < firstGuided) : i === run.step));
  return { kind, k: same.indexOf(run.step) + 1, n: same.length };
}

/** Apply one expected move to a board with the engine (null when the engine refuses it). */
export function applyMove(grid: Grid, board: PlayState, m: ExpectedMove): PlayState | null {
  const r = m.action === 'place' ? placeOver(grid, board, m.bar)
    : m.action === 'remove' ? remove(grid, board, m.row, m.col)
      : m.action === 'setExport' ? setExport(grid, board, m.country, m.col, m.value)
        : addStep(grid, board, m.pump, m.turbine);
  return r.ok ? r.state : null;
}

/**
 * The board a run expects: `initial` plus every move of the steps before the current one and the
 * moves played in it. Null when the script does not replay (a broken script).
 */
export function expectedBoard(grid: Grid, script: TutorialScript, run: TutorialRun, initial: PlayState): PlayState | null {
  let board: PlayState | null = initial;
  const last = Math.min(run.step, script.steps.length);
  for (let i = 0; i <= last && board; i++) {
    const s = script.steps[i] ?? null;
    if (!isGuided(s)) continue;
    s.moves.forEach((m, k) => {
      if (!board || (i === run.step && !run.played.includes(k))) return;
      const row = m.action === 'place' && m.anyRow ? run.rows?.[`${i}:${k}`] : undefined;
      board = applyMove(grid, board, row === undefined || m.action !== 'place' ? m : { ...m, bar: { ...m.bar, row } });
    });
  }
  return board;
}

// ---- storage

export const TUTORIAL_KEY = 'dispatch:tutorial:v1';

export interface KeyValue {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
}

export type RunMap = Record<string, TutorialRun>;

const isRun = (v: unknown): v is TutorialRun => {
  if (typeof v !== 'object' || v === null) return false;
  const r = v as Record<string, unknown>;
  return (r.status === 'running' || r.status === 'finished' || r.status === 'skipped')
    && Number.isInteger(r.step) && (r.step as number) >= 0
    && Array.isArray(r.played) && r.played.every((k) => Number.isInteger(k) && k >= 0)
    && (r.rows === undefined || (typeof r.rows === 'object' && r.rows !== null && Object.values(r.rows).every((x) => Number.isInteger(x) && (x as number) >= 0)));
};

export function parseRuns(raw: string | null): RunMap {
  if (!raw) return {};
  let data: unknown;
  try { data = JSON.parse(raw); } catch { return {}; }
  if (typeof data !== 'object' || data === null || Array.isArray(data)) return {};
  const out: RunMap = {};
  for (const [id, r] of Object.entries(data as Record<string, unknown>)) if (isRun(r)) out[id] = r;
  return out;
}

/** Read the run of a grid (null: never started, or storage unavailable). */
export function loadRun(kv: (() => KeyValue | null), gridId: number): TutorialRun | null {
  try { return parseRuns(kv()?.getItem(TUTORIAL_KEY) ?? null)[String(gridId)] ?? null; } catch { return null; }
}

/** Save the run of a grid; storage errors are ignored (the tutorial then lives in memory only). */
export function saveRun(kv: (() => KeyValue | null), gridId: number, run: TutorialRun): void {
  try {
    const store = kv();
    if (!store) return;
    const runs = parseRuns(store.getItem(TUTORIAL_KEY));
    runs[String(gridId)] = run;
    store.setItem(TUTORIAL_KEY, JSON.stringify(runs));
  } catch { /* blocked or full storage */ }
}

/** The « Tutoriel » button: start the run over from its first step, unless one is under way. */
export function restartUnlessRunning(kv: (() => KeyValue | null), gridId: number): void {
  if (loadRun(kv, gridId)?.status !== 'running') saveRun(kv, gridId, startRun());
}

/** A run that is still valid for this script (a step index past the end, or played moves out of range, start over). */
export function validRun(script: TutorialScript, run: TutorialRun | null): TutorialRun | null {
  if (!run) return null;
  if (run.status !== 'running') return run;
  const step = script.steps[run.step];
  if (!step) return null;
  if (step.kind === 'present' ? run.played.length > 0 : run.played.some((k) => k >= step.moves.length)) return null;
  return run;
}
