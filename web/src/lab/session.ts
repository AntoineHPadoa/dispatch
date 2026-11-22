/*
 * Session screen (#/session/<id>): the candidates of a session in order, with the state of each for the current player.
 * - Numbered list (lot and number small), state chip, progress "7 / 16", main button "Jouer la suivante" (first not solved).
 * - An item with a `hold` text is shown with that text and cannot be launched.
 * - A game launched from here carries the session id in its hash: its end screen offers the next grid (see end.ts).
 * - `#/session` alone opens the only session, or lists them; `#/session/<id>/fin` adds the end-of-session banner.
 * - Blind: the server sends no rating, note or draft title; this page shows none.
 */
import { api } from './api';
import type { LabCtx } from './ctx';
import { firstToPlay, sessionDone, sessionPlayHash, sessionProgress, toPlay, type SessionItem, type SessionState } from './logic';
import { esc } from '../ui/palette';

const STATE: Record<SessionState, { label: string; cls: string }> = {
  solved: { label: 'Résolue', cls: 'ok' },
  abandoned: { label: 'Abandonnée', cls: 'acc' },
  todo: { label: 'À jouer', cls: '' },
};

export async function renderSession(root: HTMLElement, ctx: LabCtx, id: string | undefined, ended: boolean): Promise<void> {
  if (!id) {
    const all = await api.sessions();
    if (all.length === 1) { location.replace(`#/session/${all[0]!.id}`); return; }
    root.innerHTML = '<div class="lab-m"><h2>Sessions</h2>'
      + (all.length ? `<div class="lab-card"><ul class="lab-sess-list">${all.map((s) => `<li><a href="#/session/${esc(s.id)}">${esc(s.title)}</a> <span class="lab-note">${s.count} grilles</span></li>`).join('')}</ul></div>`
        : '<p class="lab-note">Aucune session : ajoute un fichier dans <code>lab/sessions/</code>.</p>') + '</div>';
    return;
  }
  const s = await api.session(id, ctx.player);
  const { solved, total } = sessionProgress(s.items);
  const next = firstToPlay(s.items);
  const left = s.items.filter(toPlay).length;
  const banner = ended
    ? (sessionDone(s.items)
      ? '<div class="lab-card lab-banner ok" role="status"><b>Session terminée</b> : toutes les grilles jouables sont résolues.</div>'
      : `<div class="lab-card lab-banner" role="status"><b>Fin de la liste.</b> Il reste ${left} grille${left > 1 ? 's' : ''} à jouer ou à rejouer.</div>`)
    : '';
  root.innerHTML = `<div class="lab-m"><div class="lab-head"><h2>${esc(s.title)}</h2><span class="lab-chip" id="lab-progress">${solved} / ${total}</span>`
    + `<span class="lab-chip">Joueur : ${esc(ctx.player)}</span><span class="lab-sp"></span>`
    + (next ? `<a class="lab-btn pri" id="lab-next" href="${sessionPlayHash(id, next)}">Jouer la suivante (${next.position})</a>` : '<span class="lab-note">Rien à jouer.</span>')
    + `</div>${banner}<ol class="lab-sess">${s.items.map((it) => itemHtml(id, it, next)).join('')}</ol></div>`;
}

function itemHtml(id: string, it: SessionItem, next: SessionItem | undefined): string {
  const st = STATE[it.state];
  const action = it.hold ? `<span class="lab-note">${esc(it.hold)}</span>`
    : !it.playable ? '<span class="lab-note">Non jouable</span>'
      : `<a class="lab-btn${next?.position === it.position ? ' acc' : ''}" href="${sessionPlayHash(id, it)}">${it.state === 'solved' ? 'Rejouer' : it.state === 'abandoned' ? 'Reprendre' : 'Jouer'}</a>`;
  return `<li class="lab-sess-item${it.hold ? ' hold' : ''}${next?.position === it.position ? ' next' : ''}" data-position="${it.position}">`
    + `<span class="lab-sess-n">${it.position}</span><span class="lab-sess-src"><span class="lab-chip ${st.cls}">${st.label}</span>`
    + `<span class="lab-note">${esc(it.lot)} · n° ${it.number}${it.attempts > 1 ? ` · ${it.attempts} parties` : ''}</span></span>${action}</li>`;
}
