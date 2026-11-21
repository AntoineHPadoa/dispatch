/// <reference types="vite/client" />
/*
 * Client of the local lab server (/dispatch/api/*, proxied by the Vite dev server).
 * - Every call returns parsed JSON or throws an Error carrying the server's message.
 */
import type { Grid } from '../model/grid';
import type { Candidate, Play, PlayRecord, Weather } from './logic';

export interface Bulletin { title?: string; text?: string; weather?: Weather[] }
export interface Reveal {
  difficulty: { rating: number; label: string; techniques: string[] };
  lab: { family?: string; mechanics?: string[]; clue_profile?: string[]; trace_summary?: Candidate['trace_summary'] };
  bulletin: Bulletin;
}
export interface LotInfo { lot: string; count: number; stats: { kept?: number; attempts?: number; rejects?: Record<string, number>; seconds?: number } | null }
export interface Note { kept?: boolean; felt?: Record<string, number>; comment?: string; bulletin?: Bulletin; promoted?: unknown }
export interface Job { id: string; lot: string; status: 'running' | 'done' | 'failed'; log: string[] }
export interface Suggestion { id: number; number: number; published: string }

const BASE = `${import.meta.env.BASE_URL}api`;

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
  candidates: (lot: string) => call<Candidate[]>('GET', `/candidates?lot=${encodeURIComponent(lot)}`),
  grid: (lot: string, index: number) => call<Grid>('GET', `/grid/${lot}/${index}`),
  reveal: (lot: string, index: number) => call<Reveal>('GET', `/reveal/${lot}/${index}`),
  plays: (lot?: string) => call<Play[]>('GET', lot ? `/plays?lot=${encodeURIComponent(lot)}` : '/plays'),
  notes: () => call<Record<string, Note>>('GET', '/notes'),
  addPlay: (p: PlayRecord) => call<Play>('POST', '/plays', p),
  note: (lot: string, index: number, patch: Partial<Note>) => call<Note>('PUT', `/notes/${lot}/${index}`, patch),
  suggest: () => call<Suggestion>('GET', '/suggest'),
  promote: (lot: string, index: number, number: number, published: string) =>
    call<Suggestion>('POST', '/promote', { lot, index, number, published }),
  generate: (lot: object) => call<Job>('POST', '/generate', lot),
  job: (id: string) => call<Job>('GET', `/jobs/${id}`),
};
