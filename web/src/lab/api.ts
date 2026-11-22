/// <reference types="vite/client" />
/*
 * Client of the local lab server (/dispatch/api/*, proxied by the Vite dev server).
 * - Every call returns parsed JSON or throws an Error carrying the server's message.
 * - Reads carry the viewer (player, creation mode): the server hides the solver measures from a player who has not rated the grid.
 */
import type { Grid } from '../model/grid';
import type { Candidate, Play, PlayRecord, Weather } from './logic';

export interface Bulletin { title?: string; text?: string; weather?: Weather[] }
export interface Reveal {
  difficulty: { rating: number; label: string; techniques: string[] };
  lab: { family?: string; mechanics?: string[]; clue_profile?: string[]; trace_summary?: Candidate['trace_summary'] };
  bulletin: Bulletin;
}
/** Who is looking: drives what the server reveals. */
export const viewer = { player: '', creation: false };
export interface LotInfo { lot: string; count: number; stats: { kept?: number; attempts?: number; rejects?: Record<string, number>; seconds?: number } | null }
export interface Note { kept?: boolean; felt?: Record<string, number>; comment?: Record<string, string>; bulletin?: Bulletin; promoted?: unknown }
export interface Job { id: string; lot: string; status: 'running' | 'done' | 'partial' | 'failed'; log: string[]; kept?: number; size?: number }
export interface Suggestion { id: number; number: number; published: string }

const BASE = `${import.meta.env.BASE_URL}api`;

const viewerQuery = (player = viewer.player): string => `player=${encodeURIComponent(player)}${viewer.creation ? '&creation=1' : ''}`;

async function call<T>(method: string, path: string, body?: unknown): Promise<T> {
  const res = await fetch(BASE + path, {
    method, headers: body ? { 'Content-Type': 'application/json' } : undefined, body: body ? JSON.stringify(body) : undefined,
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error((data as { error?: string }).error ?? `HTTP ${res.status}`);
  return data as T;
}

export const api = {
  players: () => call<string[]>('GET', '/players'),
  lots: () => call<LotInfo[]>('GET', '/lots'),
  candidates: (lot: string) => call<Candidate[]>('GET', `/candidates?lot=${encodeURIComponent(lot)}&${viewerQuery()}`),
  grid: (lot: string, index: number) => call<Grid>('GET', `/grid/${lot}/${index}`),
  /** Solver measures: refused (403) until `player` has rated the grid, unless in creation mode. */
  reveal: (lot: string, index: number, player?: string) => call<Reveal>('GET', `/reveal/${lot}/${index}?${viewerQuery(player)}`),
  bulletin: (lot: string, index: number) => call<Bulletin>('GET', `/bulletin/${lot}/${index}`),
  plays: (lot?: string, player?: string) => call<Play[]>('GET', `/plays?${lot ? `lot=${encodeURIComponent(lot)}&` : ''}${viewerQuery(player)}`),
  notes: (player?: string) => call<Record<string, Note>>('GET', `/notes?${viewerQuery(player)}`),
  addPlay: (p: PlayRecord) => call<Play>('POST', '/plays', p),
  /** Fire-and-forget on page unload: a keepalive fetch survives the page and sends the JSON header the server requires. */
  beaconPlay: (p: PlayRecord): void => {
    void fetch(`${BASE}/plays`, { method: 'POST', keepalive: true, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(p) }).catch(() => undefined);
  },
  /** Felt rating of a play, once (409 afterwards). */
  ratePlay: (id: string, felt: number, comment: string) => call<Play>('POST', `/plays/${id}/rate`, { felt, comment }),
  note: (lot: string, index: number, patch: Partial<Note>) => call<Note>('PUT', `/notes/${lot}/${index}`, patch),
  suggest: () => call<Suggestion>('GET', '/suggest'),
  promote: (lot: string, index: number, number: number, published: string) =>
    call<Suggestion>('POST', '/promote', { lot, index, number, published }),
  generate: (lot: object) => call<Job>('POST', '/generate', lot),
  job: (id: string) => call<Job>('GET', `/jobs/${id}`),
};
