/*
 * Home screen: rules in brief, grid of the day, tutorials in order, rated grids with their level,
 * and the status of each grid (not started, in progress, finished).
 */
import type { Grid } from '../model/grid';
import { TECHNIQUES, UI } from '../i18n/fr';
import { DIFF_CLASS, displayTitle } from './game';
import { esc, icon } from './palette';
import { dailyGrid, statusOf, type GridStatus, type Progress } from './progress';

const statusChip = (st: GridStatus) => `<span class="status ${st}">${esc(UI.status[st])}</span>`;
const action = (st: GridStatus) => (st === 'done' ? UI.review : st === 'started' ? UI.resume : UI.play);

function card(grid: Grid, progress: Progress, eyebrow: string): string {
  const st = statusOf(progress, grid.id);
  const names = (grid.teaches ?? []).map((t) => TECHNIQUES[t]?.name).filter(Boolean);
  const tech = names.length === 1 && names[0] === displayTitle(grid) ? '' : names.join(' · ');
  return `<li><a class="gcard ${st}" href="#/grille/${grid.id}">
    <span class="gtop"><span class="eyebrow">${esc(eyebrow)}</span><span class="diff ${DIFF_CLASS[grid.difficulty.rating] ?? 'd1'}">${esc(grid.difficulty.label)}</span></span>
    <b>${esc(displayTitle(grid))}</b>
    ${tech ? `<span class="tech">${esc(tech)}</span>` : ''}
    <span class="gfoot">${statusChip(st)}<span class="go">${esc(action(st))}${icon('next')}</span></span>
  </a></li>`;
}

export function renderHome(root: HTMLElement, grids: readonly Grid[], progress: Progress): void {
  const tutorials = grids.filter((g) => g.section === 'tutorial').sort((a, b) => a.id - b.id);
  const rated = grids.filter((g) => g.section === 'rated').sort((a, b) => a.id - b.id);
  const daily = dailyGrid(grids, new Date());
  const dailySt = daily ? statusOf(progress, daily.id) : 'new';
  root.innerHTML = `<div class="m home">
    <header class="hero">
      <span class="kicker">${esc(UI.kicker)}</span>
      <h1>${esc(UI.appName)}</h1>
      <p class="lead">${esc(UI.tagline)}</p>
    </header>
    <div class="home-top">
      ${daily ? `<a class="daily" href="#/grille/${daily.id}">
        <span class="eyebrow">${esc(UI.daily)}</span>
        <b>${esc(displayTitle(daily))}</b>
        <span class="dlead">${esc(UI.dailyLead)}</span>
        <span class="gfoot"><span class="diff ${DIFF_CLASS[daily.difficulty.rating] ?? 'd1'}">${esc(daily.difficulty.label)}</span>${statusChip(dailySt)}<span class="go">${esc(action(dailySt))}${icon('next')}</span></span>
      </a>` : ''}
      <section class="card rules"><h2 class="ct">${esc(UI.rulesTitle)}</h2><ol>${UI.rules.map((r) => `<li>${esc(r)}</li>`).join('')}</ol></section>
    </div>
    <section class="glist"><div class="sh"><h2>${esc(UI.tutorials)}</h2><p>${esc(UI.tutorialsLead)}</p></div>
      <ol class="cards">${tutorials.map((g, i) => card(g, progress, UI.tutorialShort(i + 1))).join('')}</ol></section>
    <section class="glist"><div class="sh"><h2>${esc(UI.rated)}</h2><p>${esc(UI.ratedLead)}</p></div>
      <ol class="cards">${rated.map((g) => card(g, progress, g.id === daily?.id ? UI.daily : UI.ratedEyebrow)).join('')}</ol></section>
    <footer class="home-foot"><a class="tool" href="#/imprimer/tout">${icon('print')}${esc(UI.printAll)}</a></footer>
  </div>`;
}
