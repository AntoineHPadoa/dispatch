/*
 * Lab entry point (lab.html, dev server only): hash router and shared state.
 * - #/ lot table, #/partie/<lot>/<i> blind game, #/fin/<lot>/<i> end of game, #/gardees kept grids.
 * - The player (two on one machine) and the creation mode are remembered in localStorage; plays and notes live on the server.
 * - The player cannot change during a game; the end screen needs a game of the current player.
 * - After a solve, leaving the game by any link goes to the end screen first.
 */
import '../styles/app.css';
import './lab.css';
import { api, viewer } from './api';
import type { LabCtx } from './ctx';
import { playToShow, renderEnd } from './end';
import { renderKept } from './keep';
import { renderList } from './list';
import { mountPlay, type Finished, type Playing } from './play';
import { esc } from '../ui/palette';

const PLAYER_KEY = 'dispatch:lab:player';
const CREATION_KEY = 'dispatch:lab:creation';
const app = document.getElementById('app')!;
const top = document.getElementById('lab-top')!;
const toastEl = document.getElementById('lab-toast')!;

let toastTimer: number | undefined;
function toast(text: string): void {
  toastEl.textContent = text;
  toastEl.hidden = false;
  window.clearTimeout(toastTimer);
  toastTimer = window.setTimeout(() => { toastEl.hidden = true; }, 3000);
}

const ctx: LabCtx = {
  players: [], player: '', lot: '', creation: false, toast, finished: null,
  navigate: (hash) => { if (location.hash === hash) void route(); else location.hash = hash; },
};
let cleanup: (() => void) | null = null;
let playing: Playing | null = null;

function setPlayer(p: string): void {
  ctx.player = p;
  viewer.player = p;
  try { localStorage.setItem(PLAYER_KEY, p); } catch { /* storage blocked: the choice lasts for the page only */ }
}

function setCreation(on: boolean): void {
  ctx.creation = on;
  viewer.creation = on;
  try { localStorage.setItem(CREATION_KEY, on ? '1' : '0'); } catch { /* ignore */ }
}

function drawTop(page: string): void {
  const frozen = page === 'play' ? ' disabled title="Le joueur ne change pas pendant une partie"' : '';
  const tab = (hash: string, id: string, label: string) =>
    `<a class="lab-tab" href="${hash}" ${page === id ? 'aria-current="page"' : ''}>${label}</a>`;
  top.innerHTML = `<div class="lab-bar"><b class="lab-brand">Labo</b>${tab('#/', 'list', 'Lot')}${tab('#/gardees', 'kept', 'Gardées')}`
    + `<span class="lab-sp"></span><span class="lab-seg" role="group" aria-label="Joueur">`
    + ctx.players.map((p) => `<button type="button" data-player="${esc(p)}" aria-pressed="${p === ctx.player}"${frozen}>${esc(p)}</button>`).join('')
    + `</span><button type="button" class="lab-btn${ctx.creation ? ' acc' : ''}" id="lab-creation" aria-pressed="${ctx.creation}"${frozen}`
    + ' title="Montre note, techniques et étapes sans avoir joué : pour trier un lot, pas pour calibrer">Mode création</button></div>';
}
top.addEventListener('click', (e) => {
  const t = e.target as Element;
  const b = t.closest<HTMLElement>('[data-player]');
  if (b) { setPlayer(b.dataset.player!); void route(); }
  else if (t.closest('#lab-creation')) { setCreation(!ctx.creation); void route(); }
});

async function route(): Promise<void> {
  const [page, lot, idx] = location.hash.replace(/^#\/?/, '').split('/');
  // A solved grid is saved at the solve: whichever link leaves the game, the end screen comes first.
  const solved = page === 'fin' ? null : playing?.pending();
  if (solved) {
    const rec = await solved;
    ctx.finished = rec;
    cleanup?.();
    cleanup = null;
    playing = null;
    location.replace(`#/fin/${rec.lot}/${rec.index}`);
    return;
  }
  cleanup?.();
  cleanup = null;
  playing = null;
  try {
    if (page === 'partie' && lot && idx) {
      drawTop('play');
      ctx.lot = lot;
      playing = await mountPlay(app, ctx, lot, Number(idx), (f: Finished) => { ctx.finished = f; ctx.navigate(`#/fin/${lot}/${idx}`); });
      cleanup = playing.stop;
    } else if (page === 'fin' && lot && idx) {
      drawTop('end');
      const rec = await playToShow(ctx, lot, Number(idx));
      if (!rec) { toast('Joue d\'abord cette candidate avec ce joueur.'); location.replace('#/'); return; }
      await renderEnd(app, ctx, lot, Number(idx), rec);
    } else if (page === 'gardees') {
      drawTop('kept');
      await renderKept(app, ctx);
    } else {
      drawTop('list');
      cleanup = await renderList(app, ctx);
    }
  } catch (e) {
    app.innerHTML = `<div class="m"><p class="lab-error">Le serveur du labo ne répond pas ou a refusé : ${esc((e as Error).message)}. `
      + 'Lance le labo avec <code>lab/run.sh</code>.</p></div>';
  }
  window.scrollTo(0, 0);
}

async function boot(): Promise<void> {
  try {
    ctx.players = await api.players();
  } catch {
    ctx.players = ['Joueur 1'];
  }
  let saved: string | null = null;
  try { saved = localStorage.getItem(PLAYER_KEY); } catch { /* ignore */ }
  setPlayer(saved && ctx.players.includes(saved) ? saved : ctx.players[0]!);
  let creation = false;
  try { creation = localStorage.getItem(CREATION_KEY) === '1'; } catch { /* ignore */ }
  setCreation(creation);
  window.addEventListener('hashchange', () => void route());
  await route();
}
void boot();
