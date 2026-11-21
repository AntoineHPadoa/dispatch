/*
 * End-of-game screen: the player rates the perceived difficulty first, then the solver rating and
 * techniques are revealed next to it. The grid can be kept from here.
 */
import { api } from './api';
import type { LabCtx } from './ctx';
import { feltAverage, formatDuration } from './logic';
import { esc } from '../ui/palette';

const LEVELS = ['Facile', 'Moyen', 'Difficile', 'Expert'];

export async function renderEnd(root: HTMLElement, ctx: LabCtx, lot: string, index: number): Promise<void> {
  const rec = ctx.finished && ctx.finished.lot === lot && ctx.finished.index === index ? ctx.finished : null;
  const notes = await api.notes();
  const note = notes[`${lot}:${index}`] ?? {};
  let felt = note.felt?.[ctx.player] ?? 0;
  let revealed = felt > 0;
  let kept = !!note.kept;

  async function draw(): Promise<void> {
    const reveal = revealed ? await api.reveal(lot, index) : null;
    const others = ctx.players.filter((p) => p !== ctx.player && note.felt?.[p]);
    root.innerHTML = `<div class="lab-m"><div class="lab-head"><a class="lab-btn" href="#/">← Lot</a><h2>Candidate ${index}</h2>`
      + `<span class="lab-chip ${rec?.outcome === 'solved' ? 'ok' : ''}">${rec ? (rec.outcome === 'solved' ? 'Résolue' : 'Abandonnée') : 'Partie précédente'}</span></div>`
      + `<div class="lab-cols2"><div class="lab-stack">`
      + (rec ? `<div class="lab-card"><h3>Ta partie</h3><dl class="lab-kv"><dt>Joueur</dt><dd>${esc(ctx.player)}</dd><dt>Temps</dt><dd>${formatDuration(rec.ms)}</dd>`
        + `<dt>Erreurs</dt><dd>${rec.errors}</dd><dt>Annulations</dt><dd>${rec.undos}</dd><dt>Gommes</dt><dd>${rec.erasers}</dd></dl></div>` : '')
      + `<div class="lab-card"><h3>Difficulté perçue</h3><p class="lab-note">À donner avant de voir la note du solveur.</p>`
      + `<div class="lab-seg" id="lab-felt" role="group" aria-label="Difficulté perçue">${LEVELS.map((l, i) => `<button type="button" data-felt="${i + 1}" aria-pressed="${felt === i + 1}">${i + 1} ${l}</button>`).join('')}</div>`
      + `<label class="lab-field">Commentaire (facultatif)<textarea id="lab-comment" rows="2">${esc(note.comment ?? '')}</textarea></label>`
      + `<div class="lab-actions"><button type="button" class="lab-btn pri" id="lab-reveal">Valider et révéler</button>`
      + `<button type="button" class="lab-btn" id="lab-keep">${kept ? '★ Gardée' : '☆ Garder cette grille'}</button></div></div></div>`
      + `<div class="lab-card lab-reveal">${reveal ? revealHtml(reveal, felt, others.map((p) => `${p} : ${note.felt![p]}`)) : '<div class="lab-ph">🔒 Note du solveur et techniques cachées jusqu\'à ta note.</div>'}</div></div></div>`;
  }

  function revealHtml(r: Awaited<ReturnType<typeof api.reveal>>, mine: number, others: string[]): string {
    const ts = r.lab.trace_summary ?? {};
    const gap = mine - r.difficulty.rating;
    const all = feltAverage({ ...note.felt, [ctx.player]: mine });
    return `<h3>Révélation</h3><div class="lab-cmp"><span class="lab-note">Solveur</span><span class="lab-note">Toi</span><b>${r.difficulty.rating} · ${esc(LEVELS[r.difficulty.rating - 1] ?? '')}</b><b>${mine} · ${esc(LEVELS[mine - 1] ?? '')}</b></div>`
      + `<dl class="lab-kv"><dt>Écart</dt><dd>${gap === 0 ? 'aucun' : `${gap > 0 ? '+' : ''}${gap} vs solveur`}</dd>`
      + (others.length ? `<dt>Autres</dt><dd>${esc(others.join(', '))}</dd>` : '')
      + (all !== null ? `<dt>Moyenne perçue</dt><dd>${all.toFixed(1)}</dd>` : '')
      + `<dt>Techniques</dt><dd>${r.difficulty.techniques.map((t) => `<span class="lab-chip">${esc(t)}${ts.techniques?.[t] ? ` ×${ts.techniques[t]}` : ''}</span>`).join(' ')}</dd>`
      + `<dt>Étapes</dt><dd>${ts.steps ?? '?'}${ts.level2_steps !== undefined ? ` dont ${ts.level2_steps} de niveau 2` : ''}</dd>`
      + `<dt>Étapes à effet unique</dt><dd>${ts.single_effect_steps ?? '?'}</dd><dt>Indices</dt><dd>${esc((r.lab.clue_profile ?? []).join(', '))}</dd>`
      + `<dt>Mécaniques</dt><dd>${esc((r.lab.mechanics ?? []).join(', ') || 'aucune')}</dd></dl>`;
  }

  root.onclick = async (e) => {
    const t = e.target as HTMLElement;
    const f = t.closest<HTMLElement>('[data-felt]');
    if (f) { felt = Number(f.dataset.felt); root.querySelectorAll('[data-felt]').forEach((b) => b.setAttribute('aria-pressed', String(b === f))); }
    else if (t.id === 'lab-reveal') {
      if (!felt) { ctx.toast('Donne d\'abord ta note perçue.'); return; }
      const comment = root.querySelector<HTMLTextAreaElement>('#lab-comment')!.value;
      Object.assign(note, await api.note(lot, index, { felt: { [ctx.player]: felt }, comment }));
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
