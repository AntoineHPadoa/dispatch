/*
 * Lot screen: choose a lot, launch a new one, filter and sort its candidates, play or keep one.
 * - Blind by player: rating, steps, techniques and perceived ratings show "?" until the current player has rated the grid
 *   (the server withholds them); creation mode shows them all.
 * - The side panel shows the selected candidate with its plays by player.
 */
import { api, type LotInfo } from './api';
import type { LabCtx } from './ctx';
import {
  displayNumber, feltAverage, filterCandidates, formatDuration, lotTemplate, techniqueLabel, nextLotName, noFilters, playStats, sortCandidates,
  type Candidate, type Filters, type Play, type SortKey,
} from './logic';
import { esc } from '../ui/palette';

const FAMILIES = ['pointe_soir', 'deux_bosses', 'midi_solaire', 'nuit_plate', 'surplus_midi', 'plateau_hiver', 'vent_nocturne'];
const MECHANICS = ['neighbors', 'step', 'surplus', 'co2', 'tall', 'ramp', 'inventory'];
const HEADS: [SortKey | null, string][] = [[ 'index', '#'], [null, 'Silhouette'], ['family', 'Famille'], ['cols', 'Cr.'], ['rating', 'Note'], ['clues', 'Indices'],
  ['steps', 'Étapes'], ['mechanics', 'Mécaniques'], ['techniques', 'Techniques'], ['plays', 'Parties'], ['felt', 'Perçue'], [null, '★']];

export function silhouetteSvg(d: readonly number[], w = 5, h = 5): string {
  const max = Math.max(1, ...d);
  return `<svg width="${d.length * w}" height="${max * h}" aria-hidden="true">`
    + d.map((v, c) => `<rect x="${c * w}" y="${(max - v) * h}" width="${w - 1}" height="${v * h}" fill="currentColor" opacity=".5"/>`).join('') + '</svg>';
}

const chip = (t: string, cls = '') => `<span class="lab-chip ${cls}">${esc(t)}</span>`;
const techChip = (t: string) => `<span class="lab-chip" title="${esc(t)}">${esc(techniqueLabel(t))}</span>`;
const HIDDEN = '<span class="lab-note" title="Visible après ta note">?</span>';

export async function renderList(root: HTMLElement, ctx: LabCtx): Promise<() => void> {
  const lots: LotInfo[] = await api.lots();
  if (!ctx.lot || !lots.some((l) => l.lot === ctx.lot)) ctx.lot = lots[lots.length - 1]?.lot ?? '';
  let cands: Candidate[] = ctx.lot ? await api.candidates(ctx.lot) : [];
  let plays: Play[] = ctx.lot ? await api.plays(ctx.lot) : [];
  let filters: Filters = noFilters();
  if (!ctx.creation) filters = { ...filters, rating: '' };
  let key: SortKey = 'index';
  let dir: 1 | -1 = 1;
  let sel: number | null = cands[0]?.index ?? null;
  let poll: number | undefined;

  const opts = (values: string[], current: string, any: string) =>
    `<option value="">${any}</option>` + values.map((v) => `<option${v === current ? ' selected' : ''}>${esc(v)}</option>`).join('');

  function stats(): string {
    const s = lots.find((l) => l.lot === ctx.lot)?.stats;
    if (!s) return '';
    const rejects = Object.entries(s.rejects ?? {}).map(([k, v]) => `<span>${esc(k)} <b>${v}</b></span>`).join('');
    return `<div class="lab-card"><div class="lab-note">Lot ${esc(ctx.lot)} : ${s.kept ?? '?'} gardées sur ${s.attempts ?? '?'} tirages, ${s.seconds ?? '?'} s. Rejets :</div><div class="lab-rejects">${rejects || '<span>aucun</span>'}</div></div>`;
  }

  function row(c: Candidate): string {
    const felt = feltAverage(c.felt);
    return `<tr class="lab-row${c.index === sel ? ' sel' : ''}" data-i="${c.index}"><td>${displayNumber(c.index)}</td><td class="lab-sil">${silhouetteSvg(c.silhouette)}</td>`
      + `<td>${esc(c.family ?? '')}</td><td class="num">${c.cols}</td><td class="num">${c.revealed ? `<b>${c.rating ?? '?'}</b>` : HIDDEN}</td><td class="num">${c.clues}</td>`
      + `<td class="num">${c.revealed ? (c.trace_summary.steps ?? '') : HIDDEN}</td><td>${c.mechanics.map((m) => chip(m)).join(' ')}</td>`
      + `<td class="lab-wrap">${c.revealed ? c.techniques.map(techChip).join(' ') : HIDDEN}</td>`
      + `<td>${c.plays ? chip(`${c.plays}`, 'ok') : '<span class="lab-note">non jouée</span>'}</td>`
      + `<td class="num">${c.revealed ? (felt === null ? '' : felt.toFixed(1)) : HIDDEN}</td>`
      + `<td><button type="button" class="lab-star${c.kept ? ' on' : ''}" data-star="${c.index}" aria-label="${c.kept ? 'Retirer des gardées' : 'Garder'}">${c.kept ? '★' : '☆'}</button></td></tr>`;
  }

  function detail(): string {
    const c = cands.find((x) => x.index === sel);
    if (!c) return '<p class="lab-note">Aucune candidate sélectionnée.</p>';
    const mine = plays.filter((p) => p.index === c.index);
    const byPlayer = ctx.players.map((p) => {
      const s = playStats(mine.filter((x) => x.player === p));
      const games = `${s.games} partie${s.games > 1 ? 's' : ''}`;
      return `<dt>${esc(p)}</dt><dd>${!s.games ? 'aucune' : s.masked ? `${games} (détails après ta note)` : `${games}, ${s.solved} résolue${s.solved > 1 ? 's' : ''}${s.medianMs !== null ? `, ${formatDuration(s.medianMs)}` : ''}${c.felt[p] ? `, perçue ${c.felt[p]}` : ''}`}</dd>`;
    }).join('');
    return `<h3>Candidate ${displayNumber(c.index)}</h3><div class="lab-big">${silhouetteSvg(c.silhouette, 10, 10)}</div>`
      + `<dl class="lab-kv"><dt>Famille</dt><dd>${esc(c.family ?? '')}</dd><dt>Créneaux</dt><dd>${c.cols}</dd><dt>Note solveur</dt><dd>${c.revealed ? (c.rating ?? '?') : '🔒 après ta note'}</dd>`
      + `<dt>Indices</dt><dd>${c.clues} (${esc(c.clue_profile.join(', '))})</dd>${byPlayer}</dl>`
      + `<div class="lab-actions">${c.playable ? `<button type="button" class="lab-btn pri" data-play="${c.index}">Jouer à l'aveugle</button>` : '<span class="lab-note">Rampe : pas encore jouable dans le jeu.</span>'}`
      + `<button type="button" class="lab-btn" data-star="${c.index}">${c.kept ? '★ Gardée' : '☆ Garder'}</button></div>`
      + (c.promoted ? `<p class="lab-note">Promue : grille ${c.promoted.id}, bulletin n° ${c.promoted.number}.</p>` : '');
  }

  function draw(): void {
    const list = sortCandidates(filterCandidates(cands, filters), key, dir);
    root.innerHTML = `<div class="lab-m"><div class="lab-head"><h2>Lot</h2>`
      + `<select id="lab-lot" aria-label="Lot">${lots.map((l) => `<option value="${esc(l.lot)}"${l.lot === ctx.lot ? ' selected' : ''}>${esc(l.lot)} · ${l.count}</option>`).join('')}</select>`
      + `<button type="button" class="lab-btn pri" id="lab-new">Lancer un lot…</button></div>`
      + `<div id="lab-gen"></div>${stats()}`
      + `<div class="lab-filters"><label>Note <select data-f="rating"${ctx.creation ? '' : ' disabled title="Mode création requis : la note est cachée"'}>${opts(['1', '2', '3', '4'], filters.rating, 'toutes')}</select></label>`
      + `<label>Mécanique <select data-f="mechanic">${opts(MECHANICS, filters.mechanic, 'toutes')}</select></label>`
      + `<label>Silhouette <select data-f="family">${opts(FAMILIES, filters.family, 'toutes')}</select></label>`
      + `<label>Statut <select data-f="status">${['', 'new', 'played', 'kept'].map((v) => `<option value="${v}"${v === filters.status ? ' selected' : ''}>${{ '': 'tous', new: 'non jouée', played: 'jouée', kept: 'gardée' }[v]}</option>`).join('')}</select></label>`
      + `<span class="lab-note">${list.length} sur ${cands.length}</span></div>`
      + `<div class="lab-cols"><div class="lab-tbl"><table><thead><tr>${HEADS.map(([k, label]) =>
        `<th${k ? ` data-k="${k}" aria-sort="${k === key ? (dir > 0 ? 'ascending' : 'descending') : 'none'}"` : ''}>${label}</th>`).join('')}</tr></thead>`
      + `<tbody>${list.map(row).join('')}</tbody></table></div><aside class="lab-card" id="lab-detail">${detail()}</aside></div></div>`;
  }

  async function refresh(): Promise<void> {
    cands = await api.candidates(ctx.lot);
    plays = await api.plays(ctx.lot);
    draw();
  }

  function genForm(): void {
    const box = root.querySelector<HTMLElement>('#lab-gen')!;
    const name = nextLotName(lots.map((l) => l.lot));
    box.innerHTML = `<div class="lab-card"><h3>Nouveau lot</h3><textarea id="lab-lotjson" rows="12" spellcheck="false">${esc(JSON.stringify(lotTemplate(name, 20, 1), null, 1))}</textarea>`
      + `<div class="lab-actions"><button type="button" class="lab-btn acc" id="lab-run">Lancer la génération</button><button type="button" class="lab-btn" id="lab-cancel">Fermer</button></div>`
      + `<pre class="lab-log" id="lab-log" hidden></pre></div>`;
  }

  async function runGeneration(): Promise<void> {
    const area = root.querySelector<HTMLTextAreaElement>('#lab-lotjson')!;
    const log = root.querySelector<HTMLElement>('#lab-log')!;
    let lot: object;
    try { lot = JSON.parse(area.value); } catch (e) { ctx.toast(`JSON invalide : ${(e as Error).message}`); return; }
    try {
      let job = await api.generate(lot);
      log.hidden = false;
      poll = window.setInterval(async () => {
        job = await api.job(job.id);
        log.textContent = job.log.join('\n');
        log.scrollTop = log.scrollHeight;
        if (job.status !== 'running') {
          window.clearInterval(poll);
          ctx.toast(job.status === 'done' ? 'Lot généré.'
            : job.status === 'partial' ? `Lot partiel (${job.kept ?? '?'}/${job.size ?? '?'}) : les candidates trouvées sont dans la liste.`
              : 'La génération a échoué (voir le journal).');
          if (job.status !== 'failed') { lots.splice(0, lots.length, ...(await api.lots())); ctx.lot = job.lot; await refresh(); }
        }
      }, 1000);
    } catch (e) { ctx.toast((e as Error).message); }
  }

  root.onclick = async (e) => {
    const t = e.target as Element;
    const star = t.closest<HTMLElement>('[data-star]');
    const play = t.closest<HTMLElement>('[data-play]');
    const th = t.closest<HTMLElement>('th[data-k]');
    const tr = t.closest<HTMLElement>('tr[data-i]');
    if (star) {
      const c = cands.find((x) => x.index === Number(star.dataset.star))!;
      await api.note(ctx.lot, c.index, { kept: !c.kept });
      await refresh();
    } else if (play) ctx.navigate(`#/partie/${ctx.lot}/${play.dataset.play}`);
    else if (th) { const k = th.dataset.k as SortKey; if (k === key) dir = dir === 1 ? -1 : 1; else { key = k; dir = 1; } draw(); }
    else if (tr) { sel = Number(tr.dataset.i); draw(); }
    else if (t.id === 'lab-new') genForm();
    else if (t.id === 'lab-cancel') root.querySelector<HTMLElement>('#lab-gen')!.innerHTML = '';
    else if (t.id === 'lab-run') await runGeneration();
  };
  root.onchange = async (e) => {
    const t = e.target as HTMLSelectElement;
    if (t.id === 'lab-lot') { ctx.lot = t.value; sel = null; await refresh(); sel = cands[0]?.index ?? null; draw(); }
    else if (t.dataset.f) { filters = { ...filters, [t.dataset.f]: t.value }; draw(); }
  };

  draw();
  return () => { window.clearInterval(poll); root.onclick = null; root.onchange = null; };
}
