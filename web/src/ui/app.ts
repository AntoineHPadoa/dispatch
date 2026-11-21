/*
 * Hash router of the static site.
 * - #/                home
 * - #/grille/<id>     game screen
 * - #/dossier/<id>    training dossier (grids of one theme)
 * - #/imprimer/<id>   print preview of one grid (#/imprimer/tout: every grid)
 * The print root (#print-root) holds the A4 sheets; it is the only thing printed.
 */
import type { Grid } from '../model/grid';
import { UI } from '../i18n/fr';
import { displayTitle, mountGame } from './game';
import { isPublished, localIsoDate } from '../model/bulletin';
import { dossiers } from '../model/dossiers';
import { renderDossier, renderHome } from './home';
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
    const found = grids.find((g) => String(g.id) === arg);
    // A bulletin not yet published is not reachable by URL.
    const grid = found && isPublished(found, localIsoDate()) ? found : undefined;
    if (page === 'grille' && grid) {
      document.title = `${displayTitle(grid)} · ${UI.appName}`;
      fillPrint([grid]);
      cleanup = mountGame(app, grid, { grids, store, navigate, print });
    } else if (page === 'dossier' && dossiers(grids).some((d) => d.id === arg)) {
      const d = dossiers(grids).find((x) => x.id === arg)!;
      document.title = `${UI.dossier[d.id]?.title ?? d.id} · ${UI.appName}`;
      printRoot.innerHTML = '';
      renderDossier(app, d, store.get());
    } else if (page === 'imprimer' && (grid || arg === 'tout')) {
      const list = grid ? [grid] : playOrder(grids, localIsoDate());
      document.title = `${UI.printTitle} · ${UI.appName}`;
      document.body.classList.add('print-preview');
      printRoot.setAttribute('aria-hidden', 'false');
      fillPrint(list);
      app.innerHTML = `<div class="m print-bar"><a class="backlink" href="${grid ? `#/grille/${grid.id}` : '#/'}">${icon('back')}${esc(grid ? displayTitle(grid) : UI.back)}</a>`
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
