import { launch, open, check, msg, progress, count, hit, tapCell, rightClickCell, lay, choose, tool, hscroll, OUT, results } from './lib.mjs';
import fs from 'fs';
const b = await launch();
const A = '[data-act="step-arrow"]';
for (const w of [1280, 375, 320]) {
  const t = (s) => `[${w}] ${s}`;
  const p = await open(b, w, 7);
  // a bar first, so a wrong Undo would show
  await choose(p, 'N');
  await lay(p, 0, 0, 3);
  let st = await progress(p, 7);
  check(t('pose N 0h→6h'), st?.bars?.length === 1, await msg(p));
  await choose(p, 'STEP');
  check(t('STEP choisi : 7 flèches ▲'), (await count(p, A)) === 7, await msg(p));
  await p.screenshot({ path: `${OUT}/step-1-arrows-${w}.png`, fullPage: true });
  await hit(p, `${A}[data-col="3"]`);
  check(t('▲ à 9h : ▲ choisie + 4 ▼'), (await count(p, A)) === 5, await msg(p));
  await p.screenshot({ path: `${OUT}/step-2-pump-${w}.png`, fullPage: true });
  // Undo after pump only
  await tool(p, 'undo');
  st = await progress(p, 7);
  check(t('Annuler après ▲ seul : pompage abandonné, barre gardée'), (await count(p, A)) === 7 && st.bars.length === 1 && st.step.length === 0, await msg(p));
  // Undo again: removes the bar
  await tool(p, 'undo');
  st = await progress(p, 7);
  check(t('Annuler encore : retire la barre'), st.bars.length === 0, await msg(p));
  await choose(p, 'N'); await lay(p, 0, 0, 3);
  // Eraser after pump only
  await choose(p, 'STEP');
  await hit(p, `${A}[data-col="3"]`);
  await tool(p, 'erase');
  const arrowsAfterErase = await count(p, A);
  await tapCell(p, 0, 1);
  st = await progress(p, 7);
  check(t('Gomme après ▲ seul : flèches cachées, la gomme retire la barre'), arrowsAfterErase === 0 && st.bars.length === 0 && st.step.length === 0, await msg(p));
  await tool(p, 'erase'); // leave erase mode
  // chosen ▲ cancels
  await choose(p, 'STEP');
  await hit(p, `${A}[data-col="2"]`);
  await hit(p, `${A}[data-col="2"]`);
  check(t('Toucher la ▲ choisie : annule le pompage'), (await count(p, A)) === 7, await msg(p));
  // pair
  await hit(p, `${A}[data-col="3"]`);
  await hit(p, `${A}[data-col="4"]`);
  st = await progress(p, 7);
  const tags = await count(p, '[data-act="step-tag"]');
  check(t('▲ 9h puis ▼ 12h : paire posée, flèches cachées (1 paire publiée)'), st.step.length === 1 && st.step[0].pump === 3 && st.step[0].turbine === 4 && (await count(p, A)) === 0 && tags === 2, await msg(p));
  await p.screenshot({ path: `${OUT}/step-3-pair-${w}.png`, fullPage: true });
  // tap on a cell while all pairs placed
  await tapCell(p, 0, 6);
  check(t('Tap sur la grille avec la paire posée : refusé'), (await progress(p, 7)).step.length === 1, await msg(p));
  // Undo after pair, then redo by hand
  await tool(p, 'undo');
  st = await progress(p, 7);
  check(t('Annuler après la paire : paire retirée, ▲ revient'), st.step.length === 0 && (await count(p, A)) === 7, await msg(p));
  await hit(p, `${A}[data-col="3"]`); await hit(p, `${A}[data-col="4"]`);
  check(t('Refaire (nouvelle paire ▲ 9h ▼ 12h)'), (await progress(p, 7)).step.length === 1, await msg(p));
  // tag removes pair
  await hit(p, '[data-act="step-tag"][data-col="4"]');
  check(t('Toucher l’étiquette ▼ : paire retirée'), (await progress(p, 7)).step.length === 0, await msg(p));
  await hit(p, `${A}[data-col="3"]`); await hit(p, `${A}[data-col="4"]`);
  // export pill while STEP chosen (G7: both exports are published, so the pill refuses with its reason)
  await hit(p, '[data-act="export"][data-col="5"]');
  st = await progress(p, 7);
  check(t('Pastille export DE à 15h avec STEP choisi : refus motivé (exports publiés), STEP intact, pas de pompage'), (st.exports?.DE?.[5] ?? 0) === 0 && st.step.length === 1 && (await count(p, A)) === 0, `${JSON.stringify(st.exports)} — ${await msg(p)}`);
  await p.screenshot({ path: `${OUT}/step-4-export-${w}.png`, fullPage: true });
  await hit(p, '[data-act="locked"][data-col="0"]');
  check(t('Pastille export verrouillée à 0h : message'), (await progress(p, 7)).step.length === 1, await msg(p));
  // import
  await choose(p, 'I:DE');
  await lay(p, 0, 6, 1);
  st = await progress(p, 7);
  check(t('Import DE à 18h : posé, STEP intact'), st.bars.some((x) => x.piece === 'I') && st.step.length === 1, await msg(p));
  await p.screenshot({ path: `${OUT}/step-5-import-${w}.png`, fullPage: true });
  if (!p.touch) {
    await choose(p, 'STEP');
    await hit(p, '[data-act="step-tag"][data-col="3"]');
    await hit(p, `${A}[data-col="1"]`);
    await rightClickCell(p, 1, 1);
    check(t('Clic droit sur le créneau du pompage en attente : pompage annulé'), (await count(p, A)) === 7, await msg(p));
    await hit(p, `${A}[data-col="1"]`);
    await p.focus('.board-wrap');
    await p.keyboard.press('Escape');
    check(t('Échap avec pompage en attente'), (await count(p, A)) === 7, await msg(p));
  }
  check(t('pas de scroll horizontal'), (await hscroll(p)) <= 0, String(await hscroll(p)));
  check(t('aucune erreur JS'), p.errors.length === 0, p.errors.join(' | '));
  await p.context().close();
}
await b.close();
fs.writeFileSync('step-results.json', JSON.stringify(results, null, 1));
