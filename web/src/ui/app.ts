/*
 * Hash router of the static site.
 * - #/                home
 * - #/grille/<id>     game screen
 * - #/imprimer/<id>   print preview of one grid (#/imprimer/tout: every grid)
 * The print root (#print-root) holds the A4 sheets; it is the only thing printed.
 */
import type { Grid } from '../model/grid';
import { UI } from '../i18n/fr';
import { mountGame } from './game';
import { renderHome } from './home';
import { esc, icon } from './palette';
import { renderSheets } from './print';
import { browserStore, playOrder } from './progress';

export function startApp(app: HTMLElement, printRoot: HTMLElement, grids: readonly Grid[]): void {
  const store = browserStore();
  let cleanup: (() => void) | null = null;

  const fillPrint = (list: readonly Grid[]) => { printRoot.innerHTML = renderSheets(list, grids); };
  const print = (grid: Grid) => {
    fillPrint([grid]);
    window.print();
  };

  function route() {
    cleanup?.();
    cleanup = null;
    document.body.classList.remove('print-preview');
    printRoot.setAttribute('aria-hidden', 'true');
    const hash = window.location.hash.replace(/^#\/?/, '');
    const [page, arg] = hash.split('/');
    const grid = grids.find((g) => String(g.id) === arg);
    if (page === 'grille' && grid) {
      document.title = `${grid.title} · ${UI.appName}`;
      fillPrint([grid]);
      cleanup = mountGame(app, grid, { grids, store, navigate, print });
    } else if (page === 'imprimer' && (grid || arg === 'tout')) {
      const list = grid ? [grid] : playOrder(grids);
      document.title = `${UI.printTitle} · ${UI.appName}`;
      document.body.classList.add('print-preview');
      printRoot.setAttribute('aria-hidden', 'false');
      fillPrint(list);
      app.innerHTML = `<div class="m print-bar"><a class="backlink" href="${grid ? `#/grille/${grid.id}` : '#/'}">${icon('back')}${esc(grid ? grid.title : UI.back)}</a>`
        + `<span>${esc(UI.printPreviewLead)}</span>`
        + `<button type="button" class="tool on" data-print>${icon('print')}${esc(grid ? UI.printThis : UI.printAll)}</button></div>`;
      app.querySelector('[data-print]')?.addEventListener('click', () => window.print());
    } else {
      document.title = UI.appName;
      printRoot.innerHTML = '';
      renderHome(app, grids, store.get());
    }
    window.scrollTo(0, 0);
  }

  function navigate(hash: string) {
    if (window.location.hash === hash) route();
    else window.location.hash = hash;
  }

  window.addEventListener('hashchange', route);
  route();
}
