/*
 * Blind game screen: the real game (mountGame) under a lab strip with candidate, player, timer and abandon.
 * - The grid comes without solver rating or techniques; progress stays in memory (no localStorage).
 * - Errors, undos, erasures and time are counted by a PlayRecorder and posted when the game ends.
 * - Leaving the page before the end records an abandoned game.
 */
import { api } from './api';
import type { LabCtx } from './ctx';
import { PlayRecorder, formatDuration, type PlayRecord } from './logic';
import { esc } from '../ui/palette';
import { mountGame } from '../ui/game';
import { ProgressStore } from '../ui/progress';

export type Finished = PlayRecord;

export async function mountPlay(root: HTMLElement, ctx: LabCtx, lot: string, index: number, done: (f: Finished) => void): Promise<() => void> {
  const grid = await api.grid(lot, index);
  const rec = new PlayRecorder();
  const player = ctx.player;
  let posted = false;
  root.innerHTML = `<div class="lab-play"><div class="lab-strip"><b>Candidate ${index}</b><span class="lab-chip">${esc(lot)}</span>`
    + `<span class="lab-chip">Joueur : ${esc(player)}</span><span class="lab-timer" id="lab-timer">⏱ 00:00</span><span class="lab-sp"></span>`
    + '<button type="button" class="lab-btn" id="lab-giveup">Abandonner</button>'
    + '<button type="button" class="lab-btn acc" id="lab-finish" hidden>Terminer</button></div><div id="lab-game"></div></div>';
  const timer = root.querySelector<HTMLElement>('#lab-timer')!;
  const finishBtn = root.querySelector<HTMLButtonElement>('#lab-finish')!;
  const tick = window.setInterval(() => { timer.textContent = `⏱ ${formatDuration(rec.elapsed())}`; }, 500);

  async function post(abandoned: boolean): Promise<PlayRecord | null> {
    if (posted) return null;
    posted = true;
    const record = rec.finish(player, lot, index, abandoned);
    try { await api.addPlay(record); } catch (e) { ctx.toast(`Partie non enregistrée : ${(e as Error).message}`); }
    return record;
  }

  const store = new ProgressStore(() => null);
  const stop = mountGame(root.querySelector<HTMLElement>('#lab-game')!, grid, {
    grids: [], store, navigate: ctx.navigate, print: () => undefined,
    onEvent: (e) => { rec.event(e); if (e === 'solved') finishBtn.hidden = false; },
  });
  root.querySelector('#lab-giveup')!.addEventListener('click', async () => {
    const r = await post(true);
    if (r) done(r);
  });
  finishBtn.addEventListener('click', async () => {
    const r = await post(false);
    if (r) done(r);
  });

  return () => {
    window.clearInterval(tick);
    stop();
    if (!posted && rec.elapsed() > 2000) void post(true);
  };
}
