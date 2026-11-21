import { launch, open, check, msg, progress, count, hit, tapCell, lay, choose, tool, hscroll, OUT, results } from './lib.mjs';
import fs from 'fs';
const b = await launch();
const sol = [[0,0,3],[0,3,3],[1,0,4],[1,4,4],[2,1,4],[2,5,3],[3,3,4]];
for (const w of [1280, 375]) {
  const p = await open(b, w, 7);
  await choose(p, 'STEP');
  await hit(p, '[data-act="step-arrow"][data-col="3"]');
  await hit(p, '[data-act="step-arrow"][data-col="4"]');
  await choose(p, 'N');
  for (const [r, c, l] of sol) await lay(p, r, c, l);
  await choose(p, 'I:DE');
  await lay(p, 0, 6, 1); await lay(p, 0, 7, 1);
  const st = await progress(p, 7);
  await p.waitForTimeout(300);
  const banner = await p.evaluate(() => document.body.innerText.includes('Programme bouclé'));
  check(`[${w}] partie complète G7 jusqu’au verdict`, banner, `barres ${st.bars.length}, step ${JSON.stringify(st.step)} — ${await msg(p)}`);
  await p.screenshot({ path: `${OUT}/game-g7-solved-${w}.png`, fullPage: true });
  // after the verdict: STEP chosen shows no arrows
  await choose(p, 'STEP').catch(() => {});
  check(`[${w}] après le verdict : pas de flèches STEP`, (await count(p, '[data-act="step-arrow"]')) === 0, '');
  check(`[${w}] aucune erreur JS`, p.errors.length === 0, p.errors.join(' | '));
  await p.context().close();
}
await b.close();
fs.writeFileSync('game-results.json', JSON.stringify(results, null, 1));
