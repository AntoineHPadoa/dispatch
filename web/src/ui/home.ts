/*
 * Home screen "market bulletin" and dossier page.
 * - Home: logo, « Tutoriel » (desktop, from TUTORIAL_MIN_WIDTH) or the rules toggle (phone), the sheet of the day (bulletin published most recently, see
 *   model/bulletin.ts), the previous sheets, and the training dossiers with their progress.
 * - Dossier page: the grids of one dossier with their status.
 * - Accent: one pink (stamp, price cell, progress, finished items); the finished sheet of the day
 *   shows its solution in the plant colours.
 */
import { TUTORIAL_LORE, TUTORIAL_UI, UI, frenchSpaces } from '../i18n/fr';
import { currentBulletin, localIsoDate, previousBulletins, type BulletinGrid } from '../model/bulletin';
import { dossierNext, dossierProgress, dossiers, type Dossier } from '../model/dossiers';
import type { Grid } from '../model/grid';
import { bulletinTag, displayTitle } from './game';
import { cellSilhouette, miniSilhouette, sheetSilhouette, siteHead } from './home-art';
import { esc, icon } from './palette';
import { statusOf, type GridStatus, type Progress } from './progress';

const stamp = (text: string) => `<span class="stamp">${esc(text)}</span>`;
const dayTag = (g: BulletinGrid) => bulletinTag(g) ?? '';

/** Rating dots (4 levels), with the level as accessible text. */
const dots = (g: Grid) =>
  `<span class="dots" role="img" aria-label="${esc(UI.bulletin.difficulty(g.difficulty.label))}" title="${esc(g.difficulty.label)}">`
  + [1, 2, 3, 4].map((i) => `<i class="${i <= g.difficulty.rating ? 'on' : ''}"></i>`).join('') + '</span>';

const goLabel = (st: GridStatus) => (st === 'done' ? UI.bulletin.reviewShift : st === 'started' ? UI.bulletin.resumeShift : UI.bulletin.take);

function sheetCard(g: BulletinGrid, st: GridStatus): string {
  const b = g.bulletin;
  return `<article class="sheet">
    <div class="band"><div><span class="eyebrow">${esc(dayTag(g))}</span><h2>${esc(b.title)}</h2></div>${stamp(st === 'done' ? UI.bulletin.stampDone : UI.bulletin.stampTodo)}</div>
    <div class="sbody">
      <p>${esc(frenchSpaces(b.text))}</p>
      <div class="sil-wrap">${sheetSilhouette(g, b.weather, (k) => UI.bulletin.weather[k], UI.bulletin.silhouetteLabel(Math.min(...g.demand), Math.max(...g.demand), g.demand.length), st === 'done')}</div>
      <div class="sact">${dots(g)}<a class="btn secondary" href="#/grille/${g.id}">${icon('next')}${esc(goLabel(st))}</a></div>
    </div></article>`;
}

function previousRow(g: BulletinGrid, st: GridStatus): string {
  const done = st === 'done';
  return `<li><a class="prev" href="#/grille/${g.id}">
    ${miniSilhouette(g.demand, 64, 30, done)}
    <span class="ptxt"><b>${esc(dayTag(g))}</b><span>${esc(g.bulletin.title)}</span></span>
    ${done ? stamp(UI.bulletin.stampDone) : dots(g)}
  </a></li>`;
}

function dossierCard(d: Dossier, progress: Progress): string {
  const isDone = (id: number) => statusOf(progress, id) === 'done';
  const { done, total } = dossierProgress(d, isDone);
  const words = UI.dossier[d.id] ?? { title: d.id };
  const demand = d.grids.map((g) => Math.max(...g.demand));
  return `<a class="dcard" href="#/dossier/${d.id}">
    <span class="dsil">${miniSilhouette(demand, 120, 48, done > 0)}</span>
    <span class="dtxt"><b>${esc(words.title)}</b><span>${esc(UI.dossierCount(total))}</span>
      <span class="bar" role="progressbar" aria-label="${esc(UI.dossierDone(done, total))}" aria-valuemin="0" aria-valuemax="${total}" aria-valuenow="${done}"><i style="width:${total ? (done / total) * 100 : 0}%"></i></span>
      <span class="pcount${done ? ' on' : ''}">${esc(UI.dossierProgress(done, total))}</span></span></a>`;
}

/** Line shown before the first publication: the date of the first bulletin, if any. */
function firstBulletinNote(grids: readonly Grid[]): string {
  const days = grids.flatMap((g) => (g.bulletin ? [g.bulletin.published] : [])).sort();
  const first = days[0];
  if (!first) return '';
  const [y, m, d] = first.split('-').map(Number) as [number, number, number];
  return `<p class="first-note">${esc(UI.bulletin.firstOn(`${d} ${UI.bulletin.months[m - 1] ?? ''} ${y}`))}</p>`;
}

export function renderHome(root: HTMLElement, grids: readonly Grid[], progress: Progress, today: string = localIsoDate()): void {
  const sheet = currentBulletin(grids, today);
  const prev = previousBulletins(grids, today);
  const list = dossiers(grids);
  root.innerHTML = `<div class="m home">
    ${siteHead(`<div class="head-actions"><a class="ghost print-all" href="#/imprimer/tout" aria-label="${esc(UI.printAll)}" title="${esc(UI.printAll)}">${icon('print')}<span class="label">${esc(UI.printAll)}</span></a><a class="ghost wide-only" href="#/tutoriel" data-tutorial-open>${esc(TUTORIAL_UI.open)}</a><button type="button" class="ghost narrow-only" aria-expanded="false" aria-controls="rules" data-rules>${esc(UI.bulletin.howTo)}</button></div>`)}
    <h1 class="sr-only">${esc(UI.appName)}</h1>
    <section class="card rules" id="rules" hidden><h2 class="ct">${esc(UI.rulesTitle)}</h2><p class="rtag">${esc(UI.tagline)}</p><ol>${UI.rules.map((r) => `<li>${esc(r)}</li>`).join('')}</ol></section>
    <div class="hgrid">
      ${sheet ? sheetCard(sheet, statusOf(progress, sheet.id)) : firstBulletinNote(grids)}
      ${prev.length ? `<aside class="prevs"><span class="eyebrow">${esc(UI.bulletin.previous)}</span><ul>${prev.map((g) => previousRow(g, statusOf(progress, g.id))).join('')}</ul></aside>` : ''}
    </div>
    ${list.length ? `<section class="dossiers"><span class="eyebrow">${esc(UI.bulletin.dossiers)}</span><div class="dgrid">${list.map((d) => dossierCard(d, progress)).join('')}</div></section>` : ''}
  </div>`;
  const toggle = root.querySelector<HTMLButtonElement>('[data-rules]');
  const rules = root.querySelector<HTMLElement>('#rules');
  toggle?.addEventListener('click', () => {
    if (!rules) return;
    rules.hidden = !rules.hidden;
    toggle.setAttribute('aria-expanded', String(!rules.hidden));
  });
}

const statusChip = (st: GridStatus) => `<span class="status ${st}">${esc(UI.status[st])}</span>`;
const action = (st: GridStatus) => (st === 'done' ? UI.review : st === 'started' ? UI.resume : UI.play);

/** Dossier page: one card per grid (silhouette, technique taught, difficulty, status, button), in order. */
export function renderDossier(root: HTMLElement, d: Dossier, progress: Progress): void {
  const words = UI.dossier[d.id] ?? { title: d.id };
  const next = dossierNext(d, (id) => statusOf(progress, id) === 'done');
  const { done, total } = dossierProgress(d, (id) => statusOf(progress, id) === 'done');
  const cards = d.grids.map((g, i) => {
    const st = statusOf(progress, g.id);
    // The grid's own lore line names its novelty; else the briefing of the first technique it teaches.
    const blurb = TUTORIAL_LORE[g.id] ?? (g.teaches ?? []).map((t) => UI.briefing[t]).find(Boolean);
    const isNext = g.id === next?.id && st !== 'done';
    return `<li class="fiche ${st}${isNext ? ' next' : ''}"><a href="#/grille/${g.id}">
      <span class="fband">${cellSilhouette(g.demand, 11)}<span class="fnum" aria-hidden="true">${i + 1}</span></span>
      <span class="fbody"><span class="eyebrow">${esc(UI.tutorialShort(i + 1))} · ${esc(g.difficulty.label)}${isNext ? ` · ${esc(UI.dossierNext)}` : ''}</span>
        <b>${esc(displayTitle(g))}</b>
        ${blurb ? `<span class="ftxt">${esc(frenchSpaces(blurb))}</span>` : ''}</span>
      <span class="ffoot"><span class="fmeta">${dots(g)}${statusChip(st)}</span><span class="fbtn">${esc(action(st))}</span></span>
    </a></li>`;
  }).join('');
  root.innerHTML = `<div class="m home">
    ${siteHead()}
    <section class="glist"><div class="sh"><h1>${esc(words.title)}</h1></div>
      <div class="prog"><span>${esc(UI.dossierDone(done, total))}</span><span class="bar" role="progressbar" aria-label="${esc(UI.dossierDone(done, total))}" aria-valuemin="0" aria-valuemax="${total}" aria-valuenow="${done}"><i style="width:${total ? (done / total) * 100 : 0}%"></i></span></div>
      <ol class="fiches">${cards}</ol></section>
  </div>`;
}
