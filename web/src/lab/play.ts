/*
 * Blind game screen: the real game (mountGame) under a lab strip with candidate, player, timer and abandon.
 * - The grid comes without solver rating or techniques; progress stays in memory (no localStorage).
 * - Errors, undos, erasures and active time are counted by a PlayRecorder; a solved game is saved at the solve.
 * - Leaving the screen, reloading or closing the tab before the solve records an abandoned game
 *   (route change: POST; reload or close: keepalive fetch on pagehide).
 * - After the solve, any way out of the game leads to the end screen (see Playing.pending).
 */
import { api } from './api';
import type { LabCtx } from './ctx';
import { PlayRecorder, displayNumber, formatDuration, type Play } from './logic';
import { esc } from '../ui/palette';
import { mountGame } from '../ui/game';
import { ProgressStore } from '../ui/progress';

export type Finished = Play;

export interface Playing {
  stop: () => void;
  /** The saved play when the grid is solved and the end screen has not been shown yet, else null. */
  pending: () => Promise<Play> | null;
}

export async function mountPlay(root: HTMLElement, ctx: LabCtx, lot: string, index: number, done: (f: Finished) => void): Promise<Playing> {
  const grid = await api.grid(lot, index);
  const rec = new PlayRecorder();
  const player = ctx.player;
  let saved: Promise<Play> | null = null;
  let delivered = false;
  root.innerHTML = `<div class="lab-play"><div class="lab-strip"><b>Candidate ${displayNumber(index)}</b><span class="lab-chip">${esc(lot)}</span>`
    + `<span class="lab-chip">Joueur : ${esc(player)}</span><span class="lab-timer" id="lab-timer">⏱ 00:00</span><span class="lab-sp"></span>`
    + '<button type="button" class="lab-btn" id="lab-giveup">Abandonner</button>'
    + '<button type="button" class="lab-btn acc" id="lab-finish" hidden>Terminer</button></div><div id="lab-game"></div></div>';
  const timer = root.querySelector<HTMLElement>('#lab-timer')!;
  const finishBtn = root.querySelector<HTMLButtonElement>('#lab-finish')!;
  const giveUp = root.querySelector<HTMLButtonElement>('#lab-giveup')!;
  const tick = window.setInterval(() => { timer.textContent = `⏱ ${formatDuration(rec.elapsed())}`; }, 500);

  function post(abandoned: boolean): Promise<Play> {
    if (saved) return saved;
    const record = rec.finish(player, lot, index, abandoned);
    saved = api.addPlay(record).catch((e: Error) => {
      ctx.toast(`Partie non enregistrée : ${e.message}`);
      return { ...record, ts: Math.round(Date.now() / 1000) } as Play;
    });
    return saved;
  }
  const deliver = async (): Promise<void> => { const r = await saved!; delivered = true; done(r); };
  const onVisibility = (): void => rec.setHidden(document.hidden);
  const onPageHide = (): void => {
    if (saved || rec.elapsed() <= 2000) return;
    const record = rec.finish(player, lot, index, true, 'unload');
    saved = Promise.resolve({ ...record, ts: 0 } as Play);
    api.beaconPlay(record);
  };
  document.addEventListener('visibilitychange', onVisibility);
  window.addEventListener('pagehide', onPageHide);

  const store = new ProgressStore(() => null);
  const stop = mountGame(root.querySelector<HTMLElement>('#lab-game')!, grid, {
    grids: [], store, ratedEyebrow: 'Candidate', navigate: ctx.navigate,
    onEvent: (e) => {
      rec.event(e);
      if (e === 'solved') { finishBtn.hidden = false; giveUp.hidden = true; void post(false); }
    },
  });
  giveUp.addEventListener('click', () => { void post(true); void deliver(); });
  finishBtn.addEventListener('click', () => { void post(false); void deliver(); });

  return {
    stop: () => {
      window.clearInterval(tick);
      document.removeEventListener('visibilitychange', onVisibility);
      window.removeEventListener('pagehide', onPageHide);
      stop();
      if (!saved && rec.elapsed() > 2000) void post(true);
    },
    pending: () => (rec.solved && !delivered ? post(false) : null),
  };
}
