// Shared state of the lab screens (current player and lot, result of the last game).
import type { Play } from './logic';

export interface LabCtx {
  players: string[];
  player: string;
  lot: string;
  /** Creation mode: solver measures are shown whatever the player has played (to sort a lot without playing it). */
  creation: boolean;
  /** The game just played, as saved by the server, shown on the end screen. */
  finished: Play | null;
  navigate: (hash: string) => void;
  toast: (text: string) => void;
}
