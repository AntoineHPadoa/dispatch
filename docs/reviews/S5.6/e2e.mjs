import { chromium } from 'playwright-core';
import { readFileSync, writeFileSync } from 'node:fs';
import { choose } from './lib.mjs';
async function xy(p, row, col, W) {
  return p.evaluate(([row, col, W]) => {
    const svg = document.querySelector('.board-svg'); const sc = document.querySelector('.board-scroll');
    const cell = +svg.dataset.cell, rows = +svg.dataset.rows, top = +svg.dataset.top;
    const want = col * cell;
    if (want < sc.scrollLeft || want + cell > sc.scrollLeft + sc.clientWidth) sc.scrollLeft = Math.max(0, want - 10);
    const r = svg.getBoundingClientRect(); const sx = +svg.getAttribute('width') / r.width, sy = +svg.getAttribute('height') / r.height;
    return { x: r.left + (col * cell + cell / 2 + 2) / sx, y: r.top + (top + (rows - 1 - (W[col] + row)) * cell + cell / 2) / sy };
  }, [row, col, W]);
}
async function lay(p, row, col, len, W) {
  const a = await xy(p, row, col, W), b = await xy(p, row, col + len - 1, W);
  await p.mouse.move(a.x, a.y); await p.mouse.down(); await p.mouse.move(b.x, b.y, { steps: 6 }); await p.mouse.up(); await p.waitForTimeout(80);
}
const BASE = 'http://127.0.0.1:5173/dispatch/lab.html';
const LAB = '/tmp/s56-lab';
const results = [];
const check = (n, ok, d = '') => { results.push(ok); console.log(`${ok ? 'OK  ' : 'FAIL'} ${n}${d ? ' — ' + d : ''}`); };
const b = await chromium.launch({ executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome' });
const p = await (await b.newContext({ viewport: { width: 1280, height: 900 } })).newPage();
const errs = []; p.on('pageerror', (e) => errs.push(e.message));
p.on('console', (m) => m.type() === 'error' && !/404/.test(m.text()) && errs.push(m.text()));
await p.goto(BASE + '#/');
await p.waitForSelector('#lab-new');
await p.click('#lab-new');
const lot = { lot: 'e2e-1', size: 3, seed: 3, max_attempts: 200, mix: [{ weight: 1, cols: 8, neighbors: 1 }, { weight: 1, cols: 8 }],
  quotas: { max_same_family: 3, max_same_mechanics: 4, max_same_clue_profile: 4, min_per_rating: 0 } };
await p.fill('#lab-lotjson', JSON.stringify(lot));
await p.click('#lab-run');
await p.waitForSelector('.lab-row', { timeout: 180000 });
const cands = JSON.parse(readFileSync(`${LAB}/candidates/e2e-1.json`));
check('generated 3 candidates, indices from 0', cands.length === 3 && cands[0].lab.index === 0, cands.map((c) => c.lab.index).join(','));
check('list shows 3 rows', (await p.$$('.lab-row')).length === 3);
await p.screenshot({ path: 'e2e-list.png' });
// pick the first candidate and play it blind
const idx = 0, g = cands[idx];
await p.click(`.lab-row[data-i="${idx}"]`);
await p.click(`[data-play="${idx}"]`);
await p.waitForSelector('.board-svg');
check('blind: no solver word on the game page', !/ribbon|record|Facile|Moyen|Difficile|Expert/.test(await p.textContent('body')));
// exports
const pills = p.locator('svg g.pill');
for (const [country, arr] of Object.entries(g.solution.exports)) {
  for (let c = 0; c < arr.length; c++) for (let k = 0; k < arr[c]; k++) {
    const cls = await pills.nth(c).getAttribute('class');
    if (!/locked/.test(cls)) await pills.nth(c).click();
  }
}
const W = g.columns.map((_, c) => (g.weather.R[c] ?? 0) + (g.weather.F[c] ?? 0));
const order = [...g.solution.placements].sort((a, b) => a.piece.localeCompare(b.piece));
for (const pl of order) {
  await choose(p, pl.piece === 'I' ? `I:${pl.country}` : pl.piece);
  await lay(p, pl.row, pl.col, pl.len, W);
  await p.waitForTimeout(100);
}
await p.waitForTimeout(300);
await p.screenshot({ path: 'e2e-play.png' });
check('finish button visible (solved)', await p.isVisible('#lab-finish'));
await p.click('#lab-finish');
await p.waitForSelector('#lab-felt');
await p.click('[data-felt="2"]');
await p.click('#lab-reveal');
await p.waitForSelector('.lab-cmp');
const rv = await p.textContent('.lab-reveal');
check('reveal shows rating and techniques', /Solveur/.test(rv) && /Techniques/.test(rv));
await p.screenshot({ path: 'e2e-end.png' });
await p.click('#lab-keep');
await p.goto(BASE + '#/gardees');
await p.waitForSelector('.lab-row');
check('kept list has the candidate', (await p.$$('.lab-row')).length === 1);
await p.fill('#b-title', 'Titre édité');
await p.fill('#b-text', 'Texte édité pour le test.');
await p.click('#b-save');
await p.click('#p-go'); await p.click('#p-yes');
await p.waitForTimeout(1500);
const toast = await p.textContent('#lab-toast');
console.log('toast:', toast);
check('promotion succeeded', /Promue/.test(toast));
await p.screenshot({ path: 'e2e-keep.png' });
check('no JS error', errs.length === 0, errs.join(' | '));
const plays = readFileSync(`${LAB}/plays.jsonl`, 'utf8').trim().split('\n').map(JSON.parse);
check('one solved play recorded', plays.length === 1 && plays[0].outcome === 'solved' && plays[0].felt === 2, JSON.stringify(plays[0]));
await b.close();
console.log(results.every(Boolean) ? 'ALL OK' : 'SOME FAILED');
