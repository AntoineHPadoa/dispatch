/*
 * Lab entry point (lab.html, dev server only): hash router and shared state.
 * - #/ lot table, #/partie/<lot>/<i> blind game, #/fin/<lot>/<i> end of game, #/gardees kept grids.
 * - The player (two on one machine) is remembered in localStorage; plays and notes live on the server.
 */
import '../styles/app.css';
import './lab.css';
import { api } from './api';
import type { LabCtx } from './ctx';
import { renderEnd } from './end';
import { renderKept } from './keep';
import { renderList } from './list';
import { mountPlay, type Finished } from './play';
import { esc } from '../ui/palette';

const PLAYER_KEY = 'dispatch:lab:player';
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
  players: [], player: '', lot: '', toast, finished: null,
  navigate: (hash) => { if (location.hash === hash) void route(); else location.hash = hash; },
};
let cleanup: (() => void) | null = null;

function setPlayer(p: string): void {
  ctx.player = p;
  try { localStorage.setItem(PLAYER_KEY, p); } catch { /* storage blocked: the choice lasts for the page only */ }
}

function drawTop(page: string): void {
  const tab = (hash: string, id: string, label: string) =>
    `<a class="lab-tab" href="${hash}" ${page === id ? 'aria-current="page"' : ''}>${label}</a>`;
  top.innerHTML = `<div class="lab-bar"><b class="lab-brand">Labo</b>${tab('#/', 'list', 'Lot')}${tab('#/gardees', 'kept', 'Gardées')}`
    + `<span class="lab-sp"></span><span class="lab-seg" role="group" aria-label="Joueur">`
    + ctx.players.map((p) => `<button type="button" data-player="${esc(p)}" aria-pressed="${p === ctx.player}">${esc(p)}</button>`).join('')
    + '</span></div>';
}
top.addEventListener('click', (e) => {
  const b = (e.target as Element).closest<HTMLElement>('[data-player]');
  if (!b) return;
  setPlayer(b.dataset.player!);
  drawTop(location.hash.startsWith('#/gardees') ? 'kept' : 'list');
});

async function route(): Promise<void> {
  cleanup?.();
  cleanup = null;
  const [page, lot, idx] = location.hash.replace(/^#\/?/, '').split('/');
  try {
    if (page === 'partie' && lot && idx) {
      drawTop('play');
      ctx.lot = lot;
      cleanup = await mountPlay(app, ctx, lot, Number(idx), (f: Finished) => { ctx.finished = f; ctx.navigate(`#/fin/${lot}/${idx}`); });
    } else if (page === 'fin' && lot && idx) {
      drawTop('end');
      await renderEnd(app, ctx, lot, Number(idx));
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
  ctx.player = saved && ctx.players.includes(saved) ? saved : ctx.players[0]!;
  window.addEventListener('hashchange', () => void route());
  await route();
}
void boot();
