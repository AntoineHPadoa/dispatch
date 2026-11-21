// S8.1 review: grid lab in Chrome (lab/run.sh running, dev server on 5173).
// - Lot table of a night lot, blind game of one candidate up to its solution, felt rating, keep.
// - Also a ramp candidate (nuit-rampe) to check it is playable; no promotion.
// - Usage: `node lab.mjs`; lab data written by the run (plays.jsonl, notes.json) is reverted with git afterwards.
import { chromium } from 'playwright-core';
import fs from 'fs';
import { playSolutionOn } from './solve-helper.mjs';

const BASE = 'http://localhost:5173/dispatch/lab.html';
const OUT = process.env.OUT_DIR ?? new URL('../', import.meta.url).pathname;
const LAB = new URL('../../../../lab/candidates/', import.meta.url).pathname;
const results = [];
const check = (name, ok, detail = '') => {
  results.push({ name, ok: !!ok, detail: ok ? '' : String(detail) });
  console.log(`${ok ? 'OK  ' : 'KO  '} ${name}${!ok && detail ? ' — ' + String(detail).slice(0, 300) : ''}`);
};
const b = await chromium.launch({ executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome' });

for (const [lot, w] of [['nuit-jouer-a', 1280], ['nuit-rampe', 1280], ['nuit-jouer-b', 375]]) {
  const ctx = await b.newContext({ viewport: { width: w, height: 900 }, deviceScaleFactor: 2 });
  const p = await ctx.newPage();
  p.touch = false; const errors = [];
  p.on('pageerror', (e) => errors.push('pageerror: ' + e.message));
  p.on('response', (r) => { if (r.status() >= 400) errors.push(`HTTP ${r.status()} ${r.request().method()} ${r.url()}`); });
  p.on('console', (m) => { if (m.type() === 'error') errors.push('console: ' + m.text()); });
  await p.goto(BASE + '#/'); await p.waitForSelector('#lab-lot');
  await p.selectOption('#lab-lot', lot); await p.waitForTimeout(500);
  const rows = await p.$$eval('.lab-row', (r) => r.length);
  const data = JSON.parse(fs.readFileSync(`${LAB}${lot}.json`));
  const cands = data.grids ?? data.candidates ?? data;
  check(`lab ${lot}@${w}: table lists ${rows} candidates (file ${cands.length})`, rows === cands.length, `${rows} vs ${cands.length}`);
  const hs = await p.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  check(`lab ${lot}@${w}: no horizontal scroll`, hs <= 0, hs);
  await p.screenshot({ path: `${OUT}lab-list-${lot}-${w}.png`, fullPage: true });
  // Pick the first playable candidate.
  await p.click('.lab-row >> nth=0'); await p.waitForTimeout(300);
  const idx = await p.evaluate(() => +document.querySelector('.lab-row.sel')?.dataset.i);
  const playable = await p.$('[data-play]');
  check(`lab ${lot}@${w}: candidate ${idx} playable`, !!playable, await p.evaluate(() => document.querySelector('.lab-actions')?.textContent));
  await p.screenshot({ path: `${OUT}lab-detail-${lot}-${w}.png`, fullPage: true });
  if (!playable) { await ctx.close(); continue; }
  await playable.click(); await p.waitForSelector('.board-svg'); await p.waitForTimeout(300);
  const blind = await p.evaluate(() => document.body.innerText);
  check(`lab ${lot}@${w}: blind (no rating or technique shown)`, !/Facile|Moyen|Difficile|Expert|Technique du jour/i.test(blind.split('Publications')[0] ?? blind), blind.slice(0, 200));
  await p.screenshot({ path: `${OUT}lab-play-${lot}-${w}.png`, fullPage: true });
  const g = cands[idx];
  await playSolutionOn(p, g);
  await p.waitForTimeout(400);
  const solved = await p.evaluate(() => !!document.querySelector('.banner[role="status"]'));
  check(`lab ${lot}@${w}: solution -> verdict`, solved, await p.evaluate(() => document.querySelector('.msg, [role=status]')?.textContent));
  await p.screenshot({ path: `${OUT}lab-solved-${lot}-${w}.png`, fullPage: true });
  if (solved) {
    await p.click('#lab-finish'); await p.waitForTimeout(500);
    await p.click('[data-felt="2"]'); await p.fill('#lab-comment', 'revue S8.1');
    await p.click('#lab-reveal'); await p.waitForTimeout(600);
    const rev = await p.evaluate(() => document.querySelector('.lab-reveal')?.innerText ?? '');
    check(`lab ${lot}@${w}: reveal after the felt rating`, /Solveur/.test(rev), rev.slice(0, 200));
    await p.click('#lab-keep'); await p.waitForTimeout(400);
    const kept = await p.evaluate(() => document.querySelector('#lab-keep')?.textContent);
    check(`lab ${lot}@${w}: kept (${kept})`, /Gardée/.test(kept ?? ''));
    await p.screenshot({ path: `${OUT}lab-end-${lot}-${w}.png`, fullPage: true });
    await p.goto(BASE + '#/gardees'); await p.waitForTimeout(600);
    await p.screenshot({ path: `${OUT}lab-kept-${w}.png`, fullPage: true });
  }
  check(`lab ${lot}@${w}: no console/JS error`, !errors.length, errors.join(' | '));
  await ctx.close();
}
fs.writeFileSync(`${OUT}lab-results.json`, JSON.stringify(results, null, 1));
console.log(`${results.filter((r) => r.ok).length}/${results.length} OK`);
await b.close();
