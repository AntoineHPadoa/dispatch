/*
 * Lab logic (pure): candidate filter and sort, play recorder, aggregates, bulletin helpers.
 * - filterCandidates / sortCandidates drive the lot table.
 * - PlayRecorder counts errors, undos, erasures and time of one game and builds the record sent to the server.
 * - playStats / feltAverage summarise the plays and the felt ratings of a candidate.
 */
import type { GameEvent } from '../ui/game';

export type Weather = 'sun' | 'moon' | 'cloud' | 'wind';
export const WEATHERS: readonly Weather[] = ['sun', 'moon', 'cloud', 'wind'];

export interface Candidate {
  lot: string;
  index: number;
  title: string;
  cols: number;
  clues: number;
  rating: number | null;
  techniques: string[];
  family: string | null;
  mechanics: string[];
  clue_profile: string[];
  trace_summary: { steps?: number; level2_steps?: number; single_effect_steps?: number; techniques?: Record<string, number> };
  silhouette: number[];
  /** False for ramp grids, which the web game cannot play yet. */
  playable: boolean;
  plays: number;
  kept: boolean;
  felt: Record<string, number>;
  promoted: { id: number; number: number; published: string } | null;
}

export interface Play {
  player: string;
  lot: string;
  index: number;
  outcome: 'solved' | 'abandoned';
  ms: number;
  errors: number;
  undos: number;
  erasers: number;
  resets: number;
  ts: number;
}

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
  ms: number;
  errors: number;
  undos: number;
  erasers: number;
  resets: number;
}

/** Counts the events of one game and the time since it started (clock injected for tests). */
export class PlayRecorder {
  private errors = 0;
  private undos = 0;
  private erasers = 0;
  private resets = 0;
  private startedAt: number;
  private endedAt: number | null = null;
  solved = false;

  constructor(private readonly clock: () => number = Date.now) {
    this.startedAt = clock();
  }

  event(e: GameEvent): void {
    if (this.endedAt !== null) return;
    if (e === 'error') this.errors++;
    else if (e === 'undo') this.undos++;
    else if (e === 'erase') this.erasers++;
    else if (e === 'reset') this.resets++;
    else if (e === 'solved') { this.solved = true; this.endedAt = this.clock(); }
  }

  elapsed(): number {
    return (this.endedAt ?? this.clock()) - this.startedAt;
  }

  /** The record to send; an abandoned game ends now, a solved one at the solve. */
  finish(player: string, lot: string, index: number, abandoned = false): PlayRecord {
    if (this.endedAt === null) this.endedAt = this.clock();
    return {
      player, lot, index, outcome: abandoned || !this.solved ? 'abandoned' : 'solved',
      ms: Math.max(0, Math.round(this.endedAt - this.startedAt)),
      errors: this.errors, undos: this.undos, erasers: this.erasers, resets: this.resets,
    };
  }
}

export function formatDuration(ms: number): string {
  const s = Math.round(ms / 1000);
  return `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`;
}

export interface PlayStats {
  games: number;
  solved: number;
  /** Median time of solved games, in ms (null when none). */
  medianMs: number | null;
  meanErrors: number | null;
}

export function playStats(plays: readonly Play[]): PlayStats {
  const solved = plays.filter((p) => p.outcome === 'solved');
  const times = solved.map((p) => p.ms).sort((a, b) => a - b);
  const mid = Math.floor(times.length / 2);
  const medianMs = times.length ? (times.length % 2 ? times[mid]! : (times[mid - 1]! + times[mid]!) / 2) : null;
  const meanErrors = solved.length ? solved.reduce((a, p) => a + p.errors, 0) / solved.length : null;
  return { games: plays.length, solved: solved.length, medianMs, meanErrors };
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
      { weight: 2, cols: 10, neighbors: 2, co2_cap: 'auto' },
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
