import { launch, open, check, msg, progress, count, hit, tapCell, lay, choose, tool, hscroll, OUT, results } from './lib.mjs';
import fs from 'fs';
const b = await launch();
// 1280: the row is hidden, the book is used
{
  const p = await open(b, 1280, 3);
  check('[1280] rangée compacte cachée', !(await p.isVisible('.chips')), '');
  check('[1280] bouton Gomme texte visible', await p.isVisible('.tools .erase-tool'), '');
  await p.context().close();
}
for (const w of [375, 320]) {
  const t = (s) => `[${w}] ${s}`;
  const p = await open(b, w, 3);
  check(t('rangée visible, Gomme texte cachée'), (await p.isVisible('.chips')) && !(await p.isVisible('.tools .erase-tool')), '');
  const keys = await p.$$eval('.chips [data-piece]', (e) => e.map((x) => x.getAttribute('data-piece')));
  const dims = await p.$eval('.chips-row', (r) => ({ sw: r.scrollWidth, cw: r.clientWidth }));
  check(t(`puces : ${keys.join(', ')}`), keys.length >= 3, `rangée ${dims.sw}px pour ${dims.cw}px visibles`);
  await p.screenshot({ path: `${OUT}/row-1-start-${w}.png`, fullPage: true });
  for (const k of keys) {
    await choose(p, k);
    const sel = await p.$eval(`.chips [data-piece="${k}"]`, (e) => e.classList.contains('sel') && e.getAttribute('aria-pressed') === 'true');
    const book = await p.$eval(`.side [data-piece="${k}"]`, (e) => e.classList.contains('sel'));
    const vis = await p.$eval(`.chips [data-piece="${k}"]`, (e) => { const r = e.getBoundingClientRect(), q = e.parentElement.getBoundingClientRect(); return r.left >= q.left - 1 && r.right <= q.right + 1; });
    check(t(`choisir ${k} : puce sélectionnée, carnet synchronisé, puce visible`), sel && book && vis, await msg(p));
  }
  // lay each kind: N (len 3) at row0 col0, G (len 2) at row3 col4, import at row3 col0
  await choose(p, 'N'); await lay(p, 0, 0, 3);
  let st = await progress(p, 3);
  const n1 = await p.$eval('.chips [data-piece="N"] small', (e) => e.textContent);
  check(t('poser N 0h→6h depuis la rangée, compteur à jour'), st?.bars?.length === 1, `compteur ${n1} — ${await msg(p)}`);
  await choose(p, 'G'); await lay(p, 3, 4, 2);
  st = await progress(p, 3);
  check(t('poser G depuis la rangée'), st.bars.some((x) => x.piece === 'G'), await msg(p));
  await choose(p, 'I:DE'); await lay(p, 3, 0, 1);
  st = await progress(p, 3);
  check(t('poser un import depuis la rangée'), st.bars.some((x) => x.piece === 'I'), await msg(p));
  await p.screenshot({ path: `${OUT}/row-2-laid-${w}.png`, fullPage: true });
  // eraser chip
  await tool(p, 'erase');
  const on = await p.$eval('.chips .erase-chip', (e) => e.classList.contains('sel') && e.getAttribute('aria-pressed') === 'true');
  const noSel = await p.$$eval('.chips .chip.sel[data-piece]', (e) => e.length);
  await p.screenshot({ path: `${OUT}/row-3-erase-${w}.png`, fullPage: true });
  await tapCell(p, 0, 1);
  st = await progress(p, 3);
  check(t('gomme en icône : active, retire la barre N'), on && st.bars.length === 2, `puces encore sélectionnées : ${noSel} — ${await msg(p)}`);
  await tool(p, 'erase');
  const off = await p.$eval('.chips .erase-chip', (e) => !e.classList.contains('sel'));
  check(t('2e tap sur la gomme : désactivée'), off, await msg(p));
  // scroll the row
  const scrolled = await p.$eval('.chips-row', (r) => { r.scrollLeft = 0; const a = r.scrollLeft; r.scrollLeft = 9999; return { a, b: r.scrollLeft, max: r.scrollWidth - r.clientWidth }; });
  check(t('défiler la rangée'), scrolled.max <= 0 || scrolled.b > scrolled.a, JSON.stringify(scrolled));
  // touch swipe on the row
  check(t('pas de scroll horizontal de la page'), (await hscroll(p)) <= 0, String(await hscroll(p)));
  check(t('aucune erreur JS'), p.errors.length === 0, p.errors.join(' | '));
  await p.context().close();
}
// G10 export (free exports) on phone and desktop
for (const w of [1280, 320]) {
  const p = await open(b, w, 10);
  await hit(p, '[data-act="export"][data-col="4"]');
  let st = await progress(p, 10);
  check(`[${w}] G10 export DE à 12h par la pastille`, (st?.exports?.DE?.[4] ?? 0) === 1, await msg(p));
  await p.screenshot({ path: `${OUT}/export-g10-${w}.png`, fullPage: true });
  await tool(p, 'undo');
  st = await progress(p, 10);
  check(`[${w}] G10 annuler l’export`, (st?.exports?.DE?.[4] ?? 0) === 0, await msg(p));
  check(`[${w}] G10 aucune erreur JS`, p.errors.length === 0, p.errors.join(' | '));
  await p.context().close();
}
await b.close();
fs.writeFileSync('row-results.json', JSON.stringify(results, null, 1));
