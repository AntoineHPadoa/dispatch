/*
 * Kept grids screen: list of kept candidates, bulletin editing (title, text, weather per slot) and promotion
 * to web/src/data/grids.json (number, date and id proposed from the published grids, confirmed before writing).
 */
import { api, type Bulletin, type Suggestion } from './api';
import type { LabCtx } from './ctx';
import { WEATHER_ICON, feltAverage, nextWeather, type Candidate, type Weather } from './logic';
import { esc } from '../ui/palette';

export async function renderKept(root: HTMLElement, ctx: LabCtx): Promise<void> {
  const lots = await api.lots();
  const kept: Candidate[] = [];
  for (const l of lots) kept.push(...(await api.candidates(l.lot)).filter((c) => c.kept || c.promoted));
  let sel: Candidate | null = kept[0] ?? null;
  let bulletin: Bulletin = {};
  let columns = 0;
  let suggestion: Suggestion | null = null;
  let confirming = false;

  async function select(c: Candidate | null): Promise<void> {
    sel = c;
    confirming = false;
    if (c) {
      const r = await api.reveal(c.lot, c.index);
      bulletin = { ...r.bulletin, weather: [...(r.bulletin.weather ?? [])] };
      columns = c.cols;
      suggestion = await api.suggest();
    }
    draw();
  }

  function table(): string {
    if (!kept.length) return '<p class="lab-note">Aucune grille gardée. Garde une candidate avec l\'étoile du lot.</p>';
    return `<div class="lab-tbl"><table><thead><tr><th>Lot</th><th>#</th><th>Note solveur</th><th>Perçue</th><th>Parties</th><th>Statut</th></tr></thead><tbody>`
      + kept.map((c) => {
        const f = feltAverage(c.felt);
        return `<tr class="lab-row${sel === c ? ' sel' : ''}" data-k="${esc(c.lot)}:${c.index}"><td>${esc(c.lot)}</td><td>${c.index}</td><td class="num">${c.rating ?? '?'}</td>`
          + `<td class="num">${f === null ? '' : f.toFixed(1)}</td><td class="num">${c.plays}</td>`
          + `<td>${c.promoted ? `<span class="lab-chip ok">promue · n° ${c.promoted.number}</span>` : 'brouillon'}</td></tr>`;
      }).join('') + '</tbody></table></div>';
  }

  function panel(): string {
    if (!sel) return '';
    const weather = Array.from({ length: columns }, (_, i) => (bulletin.weather?.[i] ?? 'sun') as Weather);
    const done = !!sel.promoted;
    return `<div class="lab-card"><h3>Bulletin de la candidate ${sel.index} (${esc(sel.lot)})</h3>`
      + `<label class="lab-field">Titre<input id="b-title" value="${esc(bulletin.title ?? '')}"></label>`
      + `<label class="lab-field">Texte<textarea id="b-text" rows="3">${esc(bulletin.text ?? '')}</textarea></label>`
      + `<div class="lab-field">Météo par créneau (clic = changer)<div class="lab-weather">${weather.map((w, i) => `<button type="button" data-w="${i}" aria-label="Créneau ${i + 1}">${WEATHER_ICON[w]}</button>`).join('')}</div></div>`
      + `<div class="lab-actions"><button type="button" class="lab-btn" id="b-save">Enregistrer le bulletin</button></div></div>`
      + `<div class="lab-card"><h3>Promotion vers le jeu</h3>` + (done ? '<p class="lab-note">Déjà promue.</p>' : `<div class="lab-row2">`
      + `<label>n° bulletin <input id="p-num" type="number" value="${suggestion?.number ?? ''}"></label>`
      + `<label>Publication <input id="p-date" type="date" value="${suggestion?.published ?? ''}"></label></div>`
      + `<p class="lab-note">Proposés d'après les grilles publiées. L'id (${suggestion?.id ?? '?'}) est attribué à l'écriture.</p>`
      + `<ol class="lab-steps"><li>retire le bloc <code>lab</code>, place le bulletin</li><li>valide la grille et vérifie l'unicité</li><li>ajoute la grille à <code>web/src/data/grids.json</code> (rien n'est poussé)</li></ol>`
      + (confirming
        ? `<div class="lab-ph">Ajouter cette grille à grids.json ? <button type="button" class="lab-btn pri" id="p-yes">Confirmer</button> <button type="button" class="lab-btn" id="p-no">Annuler</button></div>`
        : '<div class="lab-actions"><button type="button" class="lab-btn acc" id="p-go">Promouvoir vers grids.json</button></div>')) + '</div>';
  }

  function draw(): void {
    root.innerHTML = `<div class="lab-m"><div class="lab-cols2"><div><h2>Gardées <span class="lab-chip acc">${kept.length}</span></h2>${table()}</div><div class="lab-stack">${panel()}</div></div></div>`;
  }

  function readBulletin(): Bulletin {
    return {
      title: root.querySelector<HTMLInputElement>('#b-title')?.value ?? bulletin.title,
      text: root.querySelector<HTMLTextAreaElement>('#b-text')?.value ?? bulletin.text,
      weather: bulletin.weather,
    };
  }

  root.onclick = async (e) => {
    const t = e.target as HTMLElement;
    const tr = t.closest<HTMLElement>('tr[data-k]');
    const w = t.closest<HTMLElement>('[data-w]');
    try {
      if (tr) { const [lot, i] = tr.dataset.k!.split(':'); await select(kept.find((c) => c.lot === lot && c.index === Number(i)) ?? null); }
      else if (w) {
        bulletin = readBulletin();
        const i = Number(w.dataset.w);
        const list = Array.from({ length: columns }, (_, k) => (bulletin.weather?.[k] ?? 'sun') as Weather);
        list[i] = nextWeather(list[i]!);
        bulletin.weather = list;
        draw();
      } else if (t.id === 'b-save' && sel) { bulletin = readBulletin(); await api.note(sel.lot, sel.index, { bulletin }); ctx.toast('Bulletin enregistré.'); }
      else if (t.id === 'p-go') { bulletin = readBulletin(); confirming = true; draw(); }
      else if (t.id === 'p-no') { confirming = false; draw(); }
      else if (t.id === 'p-yes' && sel) {
        const number = Number(root.querySelector<HTMLInputElement>('#p-num')?.value ?? suggestion?.number);
        const published = root.querySelector<HTMLInputElement>('#p-date')?.value ?? suggestion?.published ?? '';
        await api.note(sel.lot, sel.index, { bulletin });
        const res = await api.promote(sel.lot, sel.index, number, published);
        ctx.toast(`Promue : grille ${res.id}, bulletin n° ${res.number}.`);
        sel.promoted = { id: res.id, number: res.number, published: res.published };
        confirming = false;
        draw();
      }
    } catch (err) { confirming = false; ctx.toast((err as Error).message); draw(); }
  };

  await select(sel);
}
