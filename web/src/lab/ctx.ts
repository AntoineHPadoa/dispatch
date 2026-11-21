// Shared state of the lab screens (current player and lot, result of the last game).
import type { PlayRecord } from './logic';

export interface LabCtx {
  players: string[];
  player: string;
  lot: string;
  /** Record of the game just played, shown on the end screen. */
  finished: PlayRecord | null;
  navigate: (hash: string) => void;
  toast: (text: string) => void;
}
