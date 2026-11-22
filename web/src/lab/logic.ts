/*
 * Lab logic (pure): candidate filter and sort, play recorder, aggregates, bulletin helpers.
 * - filterCandidates / sortCandidates drive the lot table.
 * - PlayRecorder counts moves, errors, undos, erasures and active time (hidden tab excluded) of one game and builds the record sent.
 * - playStats keeps first plays only (attempt 1, no stray open): a replay has a biased time; replays are counted apart.
 * - "error" = a pose refused by the engine or one that contradicts a clue (not an export or STEP pair against a clue).
 * - labClueCount reuses the game's shownClueCount.
 * - Session helpers: progress, first unresolved item, next item to play, end of the session.
 * - playStats / feltAverage summarise the plays and the felt ratings of a candidate.
 */
import { GIVEN_STEP, TECHNIQUES } from '../i18n/fr';
import type { Grid } from '../model/grid';
import { shownClueCount } from '../ui/panels';
import type { GameEvent } from '../ui/game';

/** Clues the game's clue card lists for this grid (exchanges line of an exact inventory included); undefined without a source. */
export function labClueCount(src: Pick<Grid, 'clues' | 'inventory' | 'step'> | undefined): number | undefined {
  return src ? shownClueCount(src as Grid) : undefined;
}

export type Weather = 'sun' | 'moon' | 'cloud' | 'wind';
export const WEATHERS: readonly Weather[] = ['sun', 'moon', 'cloud', 'wind'];

export interface Candidate {
  lot: string;
  index: number;
  title: string;
  cols: number;
  clues: number;
  /** The grid parts the game counts its clue card from (clues, inventory, step); see labClueCount. */
  clue_source?: Pick<Grid, 'clues' | 'inventory' | 'step'>;
  rating: number | null;
  techniques: string[];
  family: string | null;
  mechanics: string[];
  clue_profile: string[];
  trace_summary: { steps?: number; level2_steps?: number; single_effect_steps?: number; techniques?: Record<string, number> };
  silhouette: number[];
  /** False until the current player has rated the grid (or creation mode): rating, techniques, steps and felt are then empty. */
  revealed: boolean;
  /** False for staircase ramps, which the web game cannot play yet (trapezoids are played). */
  playable: boolean;
  plays: number;
  kept: boolean;
  felt: Record<string, number>;
  promoted: { id: number; number: number; published: string } | null;
}

export interface Play {
  id?: string;
  player: string;
  lot: string;
  index: number;
  /** Set by the server on another player's play of a grid the current player has not rated: no measure. */
  masked?: boolean;
  outcome: 'solved' | 'abandoned';
  ms: number;
  wall_ms?: number;
  errors: number;
  undos: number;
  erasers: number;
  resets: number;
  felt?: number | null;
  attempt?: number;
  /** Abandoned without any move or within the first seconds (a stray open): not counted as an attempt. */
  phantom?: boolean;
  moves?: number;
  ts: number;
}

/** Candidates are numbered from 0 by the generator and shown from 1. */
export const displayNumber = (index: number): string => String(index + 1);

/** Technique names as the game and GAME-DESIGN §9 write them (fr.ts TECHNIQUES); an unknown id is shown with spaces. */
export const techniqueLabel = (t: string): string =>
  t === 'given' ? GIVEN_STEP : TECHNIQUES[t]?.name ?? t.replace(/_/g, ' ');

export interface Filters {
  rating: string;
  mechanic: string;
  family: string;
  status: '' | 'new' | 'played' | 'kept';
}

export const noFilters = (): Filters => ({ rating: '', mechanic: '', family: '', status: '' });

/** Mechanics are stored as "neighbors:2" or "step"; the filter matches the part before the colon. */
export const mechanicName = (m: string): string => m.split(':')[0] ?? m;

export function filterCandidates(list: readonly Candidate[], f: Filters): Candidate[] {
  return list.filter((c) =>
    (!f.rating || String(c.rating) === f.rating)
    && (!f.mechanic || c.mechanics.some((m) => mechanicName(m) === f.mechanic))
    && (!f.family || c.family === f.family)
    && (!f.status || (f.status === 'new' && c.plays === 0) || (f.status === 'played' && c.plays > 0) || (f.status === 'kept' && c.kept)));
}

export type SortKey = 'index' | 'family' | 'cols' | 'rating' | 'clues' | 'steps' | 'mechanics' | 'techniques' | 'plays' | 'felt';

export const feltAverage = (felt: Record<string, number>): number | null => {
  const v = Object.values(felt);
  return v.length ? v.reduce((a, b) => a + b, 0) / v.length : null;
};

function sortValue(c: Candidate, key: SortKey): string | number {
  switch (key) {
    case 'index': return c.index;
    case 'family': return c.family ?? '';
    case 'cols': return c.cols;
    case 'rating': return c.rating ?? 0;
    case 'clues': return c.clues;
    case 'steps': return c.trace_summary.steps ?? 0;
    case 'mechanics': return c.mechanics.length;
    case 'techniques': return c.techniques.length;
    case 'plays': return c.plays;
    case 'felt': return feltAverage(c.felt) ?? 0;
  }
}

/** Stable sort; ties keep the candidate order. */
export function sortCandidates(list: readonly Candidate[], key: SortKey, dir: 1 | -1): Candidate[] {
  return list.map((c, i) => ({ c, i })).sort((a, b) => {
    const va = sortValue(a.c, key), vb = sortValue(b.c, key);
    return (va < vb ? -1 : va > vb ? 1 : 0) * dir || a.i - b.i;
  }).map((x) => x.c);
}

export interface PlayRecord {
  player: string;
  lot: string;
  index: number;
  outcome: 'solved' | 'abandoned';
  /** Active time: the time the tab was hidden is not counted. */
  ms: number;
  /** Time on the wall clock, hidden time included. */
  wall_ms: number;
  /** Start of the game, epoch seconds. */
  started: number;
  errors: number;
  undos: number;
  erasers: number;
  resets: number;
  /** Poses, exports and STEP pairs laid. */
  moves: number;
  reason?: 'unload';
}

/** Counts the events of one game and its active time (clock injected for tests). */
export class PlayRecorder {
  private moves = 0;
  private errors = 0;
  private undos = 0;
  private erasers = 0;
  private resets = 0;
  private startedAt: number;
  private endedAt: number | null = null;
  private hiddenMs = 0;
  private hiddenSince: number | null = null;
  solved = false;

  constructor(private readonly clock: () => number = Date.now) {
    this.startedAt = clock();
  }

  event(e: GameEvent): void {
    if (this.endedAt !== null) return;
    if (e === 'move') this.moves++;
    else if (e === 'error') this.errors++;
    else if (e === 'undo') this.undos++;
    else if (e === 'erase') this.erasers++;
    else if (e === 'reset') this.resets++;
    else if (e === 'solved') { this.solved = true; this.end(); }
  }

  /** The tab was hidden or shown again: hidden time is left out of the active time. */
  setHidden(hidden: boolean): void {
    if (this.endedAt !== null) return;
    if (hidden && this.hiddenSince === null) this.hiddenSince = this.clock();
    else if (!hidden && this.hiddenSince !== null) { this.hiddenMs += this.clock() - this.hiddenSince; this.hiddenSince = null; }
  }

  private end(): void {
    if (this.endedAt !== null) return;
    this.endedAt = this.clock();
    if (this.hiddenSince !== null) { this.hiddenMs += this.endedAt - this.hiddenSince; this.hiddenSince = null; }
  }

  /** Active time so far (frozen at the end of the game). */
  elapsed(): number {
    const now = this.endedAt ?? this.clock();
    const hidden = this.hiddenMs + (this.hiddenSince !== null && this.endedAt === null ? now - this.hiddenSince : 0);
    return Math.max(0, now - this.startedAt - hidden);
  }

  /** The record to send; a solved game ends at the solve, an abandoned one now. A solved game stays solved whatever follows. */
  finish(player: string, lot: string, index: number, abandoned = false, reason?: 'unload'): PlayRecord {
    this.end();
    const wall = Math.max(0, Math.round(this.endedAt! - this.startedAt));
    const ms = Math.min(wall, Math.round(this.elapsed()));
    return {
      player, lot, index, outcome: this.solved && !abandoned ? 'solved' : 'abandoned',
      ms, wall_ms: wall, started: Math.round(this.startedAt / 1000),
      errors: this.errors, undos: this.undos, erasers: this.erasers, resets: this.resets, moves: this.moves,
      ...(reason ? { reason } : {}),
    };
  }
}

export function formatDuration(ms: number): string {
  const s = Math.round(ms / 1000);
  return `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`;
}

export interface PlayStats {
  /** True when some plays are masked (another player's, on a grid not yet rated): only the count is known. */
  masked: boolean;
  /** First plays: attempt 1 (or unknown), stray opens left out. */
  games: number;
  solved: number;
  /** Plays of a grid the player had already played: left out of the measures. */
  replays: number;
  /** Median time of solved games, in ms (null when none). */
  medianMs: number | null;
  meanErrors: number | null;
}

export function playStats(plays: readonly Play[]): PlayStats {
  const masked = plays.some((p) => p.masked);
  const real = plays.filter((p) => !p.phantom);
  const first = real.filter((p) => (p.attempt ?? 1) === 1);
  const solved = first.filter((p) => !p.masked && p.outcome === 'solved');
  const times = solved.map((p) => p.ms).sort((a, b) => a - b);
  const mid = Math.floor(times.length / 2);
  const medianMs = times.length ? (times.length % 2 ? times[mid]! : (times[mid - 1]! + times[mid]!) / 2) : null;
  const meanErrors = solved.length ? solved.reduce((a, p) => a + p.errors, 0) / solved.length : null;
  return { masked, games: first.length, solved: solved.length, replays: real.length - first.length, medianMs, meanErrors };
}

/** Next weather in the sun, moon, cloud, wind cycle. */
export const nextWeather = (w: Weather): Weather => WEATHERS[(WEATHERS.indexOf(w) + 1) % WEATHERS.length]!;
export const WEATHER_ICON: Record<Weather, string> = { sun: '☀', moon: '☾', cloud: '☁', wind: '≋' };

/** Skeleton of a new lot (the form lets the human edit it before generation). */
export function lotTemplate(name: string, size: number, seed: number): object {
  return {
    lot: name, size, seed,
    mix: [
      { weight: 3, cols: 8, neighbors: 1 },
      { weight: 2, cols: 12, neighbors: 2, co2_cap: 'auto' },
      { weight: 2, cols: 8, step: 1, neighbors: 1 },
    ],
    quotas: { max_same_silhouette: 3, max_same_mechanics: 4, min_per_rating: 2, max_same_clue_profile: 4 },
  };
}

/** Name for the next lot: lot-NN after the highest lot-NN present. */
export function nextLotName(existing: readonly string[]): string {
  const n = Math.max(0, ...existing.map((l) => Number(/^lot-(\d+)$/.exec(l)?.[1] ?? 0)));
  return `lot-${String(n + 1).padStart(2, '0')}`;
}

// ---- sessions: an ordered list of candidates played in a row (lab/sessions/<id>.json)
export type SessionState = 'solved' | 'abandoned' | 'todo';
export interface SessionItem {
  position: number;
  lot: string;
  index: number;
  /** Number shown in the lot list (index + 1). */
  number: number;
  state: SessionState;
  attempts: number;
  playable: boolean;
  /** Text shown instead of a play button: the item cannot be launched. */
  hold?: string;
}
export interface SessionData { id: string; title: string; items: SessionItem[] }
export interface SessionInfo { id: string; title: string; count: number }

/** An item the player can launch now: not held and playable. */
export const canPlay = (it: SessionItem): boolean => !it.hold && it.playable;
/** Still to play: not solved and launchable (an abandoned grid is played again). */
export const toPlay = (it: SessionItem): boolean => it.state !== 'solved' && canPlay(it);

export function sessionProgress(items: SessionItem[]): { solved: number; total: number } {
  return { solved: items.filter((i) => i.state === 'solved').length, total: items.length };
}
/** First item still to play, in session order. */
export const firstToPlay = (items: SessionItem[]): SessionItem | undefined => items.find(toPlay);
/** Next item to play after position `position` (1-based), without wrapping around. */
export const nextToPlay = (items: SessionItem[], position: number): SessionItem | undefined =>
  items.find((i) => i.position > position && toPlay(i));
/** Nothing left to play: every item is solved, held or unplayable. */
export const sessionDone = (items: SessionItem[]): boolean => !items.some(toPlay);
/** Hash of the game screen for an item; the session id rides along so the end screen knows where to go next. */
export const sessionPlayHash = (id: string, it: Pick<SessionItem, 'lot' | 'index'>): string => `#/partie/${it.lot}/${it.index}/${id}`;
