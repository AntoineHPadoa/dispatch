/*
 * End-of-game screen: the player rates the perceived difficulty first, then the solver rating and
 * techniques are revealed next to it. The grid can be kept from here.
 * - Everything is read for the player of the game (not the selector), from the game just played or the last one.
 * - The rating is stored with the play, once: after the reveal the buttons are locked.
 * - Comments are kept per player: the box holds the player's own; the others' show after the reveal.
 */
import { api, type Note } from './api';
import type { LabCtx } from './ctx';
import { displayNumber, feltAverage, formatDuration, techniqueLabel, type Play } from './logic';
import { esc } from '../ui/palette';

const LEVELS = ['Facile', 'Moyen', 'Difficile', 'Expert'];

/** The play shown here: the one just finished, else the player's last on this candidate (null when there is none). */
export async function playToShow(ctx: LabCtx, lot: string, index: number): Promise<Play | null> {
  const f = ctx.finished;
  if (f && f.lot === lot && f.index === index) return f;
  const mine = (await api.plays(lot)).filter((p) => p.index === index && p.player === ctx.player && !p.masked);
  return mine.at(-1) ?? null;
}

export async function renderEnd(root: HTMLElement, ctx: LabCtx, lot: string, index: number, rec: Play): Promise<void> {
  const player = rec.player;
  const notes = await api.notes(player);
  const note: Note = notes[`${lot}:${index}`] ?? {};
  let felt = rec.felt ?? 0;
  let revealed = felt > 0;
  let kept = !!note.kept;

  async function draw(): Promise<void> {
    const reveal = revealed ? await api.reveal(lot, index, player) : null;
    const others = ctx.players.filter((p) => p !== player && note.felt?.[p]);
    const locked = revealed ? ' disabled' : '';
    root.innerHTML = `<div class="lab-m"><div class="lab-head"><a class="lab-btn" href="#/">← Lot</a><h2>Candidate ${displayNumber(index)}</h2>`
      + `<span class="lab-chip ${rec.outcome === 'solved' ? 'ok' : ''}">${rec.outcome === 'solved' ? 'Résolue' : 'Abandonnée'}</span></div>`
      + `<div class="lab-cols2"><div class="lab-stack">`
      + `<div class="lab-card"><h3>Ta partie</h3><dl class="lab-kv"><dt>Joueur</dt><dd>${esc(player)}</dd><dt>Temps actif</dt><dd>${formatDuration(rec.ms)}</dd>`
      + `<dt>Erreurs</dt><dd>${rec.errors}</dd><dt>Annulations</dt><dd>${rec.undos}</dd><dt>Gommes</dt><dd>${rec.erasers}</dd></dl></div>`
      + `<div class="lab-card"><h3>Difficulté perçue</h3><p class="lab-note">${revealed ? 'Note enregistrée, elle ne change plus.' : 'À donner avant de voir la note du solveur.'}</p>`
      + `<div class="lab-seg" id="lab-felt" role="group" aria-label="Difficulté perçue">${LEVELS.map((l, i) => `<button type="button" data-felt="${i + 1}" aria-pressed="${felt === i + 1}"${locked}>${i + 1} ${l}</button>`).join('')}</div>`
      + `<label class="lab-field">Commentaire (facultatif)<textarea id="lab-comment" rows="2"${locked}>${esc(note.comment?.[player] ?? '')}</textarea></label>`
      + `<div class="lab-actions"><button type="button" class="lab-btn pri" id="lab-reveal"${locked}>Valider et révéler</button>`
      + `<button type="button" class="lab-btn" id="lab-keep">${kept ? '★ Gardée' : '☆ Garder cette grille'}</button></div></div></div>`
      + `<div class="lab-card lab-reveal">${reveal ? revealHtml(reveal, felt, others.map((p) => `${p} : ${note.felt![p]}`)) : '<div class="lab-ph">🔒 Note du solveur et techniques cachées jusqu\'à ta note.</div>'}</div></div></div>`;
  }

  function revealHtml(r: Awaited<ReturnType<typeof api.reveal>>, mine: number, others: string[]): string {
    const ts = r.lab.trace_summary ?? {};
    const gap = mine - r.difficulty.rating;
    const all = feltAverage({ ...note.felt, [player]: note.felt?.[player] ?? mine });
    return `<h3>Révélation</h3><div class="lab-cmp"><span class="lab-note">Solveur</span><span class="lab-note">Toi</span><b>${r.difficulty.rating} · ${esc(LEVELS[r.difficulty.rating - 1] ?? '')}</b><b>${mine} · ${esc(LEVELS[mine - 1] ?? '')}</b></div>`
      + `<dl class="lab-kv"><dt>Écart</dt><dd>${gap === 0 ? 'aucun' : `${gap > 0 ? '+' : ''}${gap} vs solveur`}</dd>`
      + (others.length ? `<dt>Autres</dt><dd>${esc(others.join(', '))}</dd>` : '')
      + commentsHtml()
      + (all !== null ? `<dt>Moyenne perçue</dt><dd>${all.toFixed(1)}</dd>` : '')
      + `<dt>Techniques</dt><dd>${r.difficulty.techniques.map((t) => `<span class="lab-chip" title="${esc(t)}">${esc(techniqueLabel(t))}${ts.techniques?.[t] ? ` ×${ts.techniques[t]}` : ''}</span>`).join(' ')}</dd>`
      + `<dt>Étapes</dt><dd>${ts.steps ?? '?'}${ts.level2_steps !== undefined ? ` dont ${ts.level2_steps} de niveau 2` : ''}</dd>`
      + `<dt>Étapes à effet unique</dt><dd>${ts.single_effect_steps ?? '?'}</dd><dt>Indices</dt><dd>${esc((r.lab.clue_profile ?? []).join(', '))}</dd>`
      + `<dt>Mécaniques</dt><dd>${esc((r.lab.mechanics ?? []).join(', ') || 'aucune')}</dd></dl>`;
  }

  /** The other players' comments (an older one without author is labelled as such). */
  function commentsHtml(): string {
    const rows = Object.entries(note.comment ?? {}).filter(([p]) => p !== player)
      .map(([p, c]) => `<div><b>${esc(p || 'Avant')}</b> : ${esc(c)}</div>`);
    return rows.length ? `<dt>Commentaires</dt><dd>${rows.join('')}</dd>` : '';
  }

  root.onclick = async (e) => {
    const t = e.target as HTMLElement;
    const f = t.closest<HTMLButtonElement>('[data-felt]');
    if (f && !revealed) { felt = Number(f.dataset.felt); root.querySelectorAll('[data-felt]').forEach((b) => b.setAttribute('aria-pressed', String(b === f))); }
    else if (t.id === 'lab-reveal' && !revealed) {
      if (!felt) { ctx.toast('Donne d\'abord ta note perçue.'); return; }
      if (!rec.id) { ctx.toast('Partie non enregistrée : la note ne peut pas être gardée.'); return; }
      const comment = root.querySelector<HTMLTextAreaElement>('#lab-comment')!.value;
      try {
        rec.felt = (await api.ratePlay(rec.id, felt, comment)).felt ?? felt;
      } catch (err) { ctx.toast((err as Error).message); return; }
      Object.assign(note, (await api.notes(player))[`${lot}:${index}`] ?? {});
      revealed = true;
      await draw();
    } else if (t.id === 'lab-keep') {
      kept = !kept;
      await api.note(lot, index, { kept });
      t.textContent = kept ? '★ Gardée' : '☆ Garder cette grille';
    }
  };
  await draw();
}
