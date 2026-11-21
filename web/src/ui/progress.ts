/*
 * Player progress, kept in localStorage when it is available (pure logic + a guarded store).
 * - Per grid: status (started, done), the saved board and the time spent.
 * - Every storage access is wrapped in try/catch: the game works without storage.
 */
import { localIsoDate } from '../model/bulletin';
import type { Grid } from '../model/grid';
import type { PlacedBar, PlayState } from '../engine';

export type GridStatus = 'new' | 'started' | 'done';

export interface GridProgress {
  status: Exclude<GridStatus, 'new'>;
  state?: PlayState;
  /** Time spent on the grid, in milliseconds. */
  elapsedMs?: number;
}

export interface Progress {
  grids: Record<string, GridProgress>;
}

export const STORAGE_KEY = 'dispatch:progress:v1';

/** Minimal storage interface (window.localStorage, or a stub in tests). */
export interface KeyValueStore {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
}

export const emptyProgress = (): Progress => ({ grids: {} });

const isObj = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v);
const isInt = (v: unknown): v is number => typeof v === 'number' && Number.isInteger(v);

function isBar(v: unknown): v is PlacedBar {
  return isObj(v) && typeof v.piece === 'string' && isInt(v.row) && isInt(v.col) && isInt(v.len)
    && (v.height === undefined || isInt(v.height)) && (v.country === undefined || typeof v.country === 'string');
}

/** Structural check of a saved board; anything else is dropped. */
export function isPlayState(v: unknown): v is PlayState {
  if (!isObj(v) || !Array.isArray(v.bars) || !v.bars.every(isBar)) return false;
  if (!isObj(v.exports) || !Object.values(v.exports).every((a) => Array.isArray(a) && a.every(isInt))) return false;
  return Array.isArray(v.step) && v.step.every((s) => isObj(s) && isInt(s.pump) && isInt(s.turbine));
}

/** Parse stored JSON, keeping only well-formed entries. */
export function parseProgress(raw: string | null): Progress {
  if (!raw) return emptyProgress();
  let data: unknown;
  try { data = JSON.parse(raw); } catch { return emptyProgress(); }
  if (!isObj(data) || !isObj(data.grids)) return emptyProgress();
  const grids: Record<string, GridProgress> = {};
  for (const [id, g] of Object.entries(data.grids)) {
    if (!isObj(g) || (g.status !== 'started' && g.status !== 'done')) continue;
    const entry: GridProgress = { status: g.status };
    if (isPlayState(g.state)) entry.state = g.state;
    if (typeof g.elapsedMs === 'number' && Number.isFinite(g.elapsedMs) && g.elapsedMs >= 0) entry.elapsedMs = g.elapsedMs;
    grids[id] = entry;
  }
  return { grids };
}

export function statusOf(p: Progress, gridId: number): GridStatus {
  return p.grids[String(gridId)]?.status ?? 'new';
}

/** Record a board change. A finished grid stays finished. */
export function recordState(p: Progress, gridId: number, state: PlayState, elapsedMs: number, solved: boolean): Progress {
  const prev = p.grids[String(gridId)];
  const status = solved || prev?.status === 'done' ? 'done' : 'started';
  return { grids: { ...p.grids, [String(gridId)]: { status, state, elapsedMs } } };
}

/** Guarded access to a store: reads and writes never throw. */
export class ProgressStore {
  private cache: Progress;

  constructor(private readonly store: () => KeyValueStore | null) {
    this.cache = this.read() ?? emptyProgress();
  }

  /** What the storage holds now, or null when it is unavailable. */
  private read(): Progress | null {
    try {
      const kv = this.store();
      return kv ? parseProgress(kv.getItem(STORAGE_KEY)) : null;
    } catch { return null; }
  }

  get(): Progress {
    return this.cache;
  }

  /** Re-read the storage (another tab wrote): grids it does not hold stay as cached. */
  refresh(): void {
    const disk = this.read();
    if (disk) this.cache = { grids: { ...this.cache.grids, ...disk.grids } };
  }

  /** Save `p`: only the grids it changed overwrite what the storage holds, so other tabs keep theirs. */
  set(p: Progress): void {
    const changed: Record<string, GridProgress> = {};
    for (const [id, g] of Object.entries(p.grids)) if (this.cache.grids[id] !== g) changed[id] = g;
    const disk = this.read();
    this.cache = { grids: { ...(disk?.grids ?? this.cache.grids), ...changed } };
    try { this.store()?.setItem(STORAGE_KEY, JSON.stringify(this.cache)); } catch { /* storage full or blocked: keep in memory */ }
  }
}

/** Store backed by window.localStorage when the browser allows it. */
export const browserStore = () => {
  const store = new ProgressStore(() => {
    try { return typeof window !== 'undefined' ? window.localStorage : null; } catch { return null; }
  });
  if (typeof window !== 'undefined') {
    window.addEventListener('storage', (e) => { if (e.key === null || e.key === STORAGE_KEY) store.refresh(); });
  }
  return store;
};

/** Play order: tutorials, then rated grids, each by id; bulletins not yet published on `today` are left out. */
export function playOrder(grids: readonly Grid[], today: string = localIsoDate()): Grid[] {
  const rank = (g: Grid) => (g.section === 'tutorial' ? 0 : 1);
  return grids.filter((g) => !g.bulletin || g.bulletin.published <= today).sort((a, b) => rank(a) - rank(b) || a.id - b.id);
}

/** Next grid after `id` in play order, or null after the last one. */
export function nextGrid(grids: readonly Grid[], id: number, today: string = localIsoDate()): Grid | null {
  const order = playOrder(grids, today);
  const i = order.findIndex((g) => g.id === id);
  return i >= 0 ? order[i + 1] ?? null : null;
}
