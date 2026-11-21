// Real-Chrome check of the three blockers of S5 (B1 blind list, B2 solved then Accueil, B3 reload/close).
// Usage: DATA=<lab dir> OUT=<capture dir> node blockers.mjs   (lab server on 8765, Vite on 5173)
import { chromium } from 'playwright';
import { readFileSync, existsSync } from 'node:fs';
const DATA = process.env.DATA, OUT = process.env.OUT;
const BASE = 'http://localhost:5173/dispatch/lab.html';
const plays = () => (existsSync(DATA + '/plays.jsonl') ? readFileSync(DATA + '/plays.jsonl', 'utf8').trim().split('\n').filter(Boolean).map((l) => JSON.parse(l)) : []);
const sol = JSON.parse(readFileSync(DATA + '/candidates/demo.json', 'utf8'))[0].solution;
let failures = 0;
const check = (name, ok, info = '') => { console.log(`${ok ? 'PASS' : 'FAIL'} ${name} ${info}`); if (!ok) failures++; };
const b = await chromium.launch({ channel: 'chrome' });
const ctx = await b.newContext({ viewport: { width: 1280, height: 900 } });
const errors = [];
async function open() { const p = await ctx.newPage(); p.on('pageerror', (e) => errors.push(e.message)); return p; }
async function cellXY(p, row, col) {
  return p.evaluate(([row, col]) => {
    const svg = document.querySelector('.board-svg');
    const cell = +svg.dataset.cell, rows = +svg.dataset.rows, top = +svg.dataset.top;
    const r = svg.getBoundingClientRect(); const sx = +svg.getAttribute('width') / r.width, sy = +svg.getAttribute('height') / r.height;
    return { x: r.left + (col * cell + cell / 2 + 2) / sx, y: r.top + (top + (rows - 1 - row) * cell + cell / 2) / sy };
  }, [row, col]);
}
async function lay(p, row, col, len) { const a = await cellXY(p, row, col), c = await cellXY(p, row, col + len - 1); await p.mouse.move(a.x, a.y); await p.mouse.down(); await p.mouse.move(c.x, c.y, { steps: 6 }); await p.mouse.up(); await p.waitForTimeout(120); }
async function solveFirst(p) {
  for (const c of [3, 4]) { await p.click(`[data-act="export"][data-col="${c}"]`); await p.waitForTimeout(100); }
  for (const pl of sol.placements) { await p.click(`.side [data-piece="${pl.piece}"]`); await lay(p, pl.row, pl.col, pl.len); }
}

// ---- B1: the list does not reveal rating, techniques, steps, felt before the player's own rating
let p = await open();
await p.goto(BASE); await p.waitForSelector('.lab-row');
const hiddenText = await p.evaluate(() => document.body.innerText);
check('B1 no technique id or label in the list', !/single_cover|Couverture unique|exhausted|Épuisement|ribbon|Ruban|Flux|Record/.test(hiddenText));
const noteCells = await p.$$eval('.lab-row', (rows) => rows.map((r) => r.children[4].textContent.trim()));
check('B1 note column shows ? on every row', noteCells.every((t) => t === '?'), JSON.stringify(noteCells));
check('B1 draft titles are hidden', !(await p.evaluate(() => /Facile|Moyen|Difficile|Expert/.test(document.querySelector('.lab-tbl').innerText + document.querySelector('#lab-detail').innerText))));
await p.screenshot({ path: OUT + '/B1-list-blind-1280.png' });
// Joueur 2 plays and rates candidate 2 (index 1); Joueur 1 must not see it
await p.click('[data-player="Joueur 2"]'); await p.waitForTimeout(300);
await p.click('tr[data-i="1"]'); await p.click('[data-play="1"]'); await p.waitForSelector('.board-svg');
await p.waitForTimeout(2300); await p.click('#lab-giveup'); await p.waitForSelector('#lab-felt');
await p.click('[data-felt="4"]'); await p.click('#lab-reveal'); await p.waitForSelector('.lab-cmp');
check('B1 after own rating the reveal shows the technique labels', /Technique/.test(await p.innerText('.lab-reveal')));
check('C4 rating locked after the reveal', await p.$$eval('[data-felt], #lab-reveal', (els) => els.every((e) => e.disabled)));
await p.screenshot({ path: OUT + '/B1-end-revealed-1280.png' });
await p.goto(BASE + '#/'); await p.waitForSelector('.lab-row');
const j2 = await p.$$eval('.lab-row', (rows) => rows.map((r) => r.children[4].textContent.trim()));
check('B1 Joueur 2 sees the rating of the grid they rated only', j2[1] !== '?' && j2[0] === '?' && j2[2] === '?', JSON.stringify(j2));
await p.click('[data-player="Joueur 1"]'); await p.waitForTimeout(400);
const j1 = await p.$$eval('.lab-row', (rows) => rows.map((r) => [r.children[4].textContent.trim(), r.children[10].textContent.trim()]));
check('B1 Joueur 1 still sees ? (rating and Perçue) on that grid', j1.every(([a, f]) => a === '?' && f === '?'), JSON.stringify(j1));
await p.click('tr[data-i="1"]');
const detail = await p.innerText('#lab-detail');
check('B1 other player measures hidden in the panel', !/résolue|perçue 4|00:0/.test(detail), detail.replace(/\n/g, ' | ').slice(0, 200));
await p.screenshot({ path: OUT + '/B1-list-other-player-1280.png' });
await p.click('#lab-creation'); await p.waitForTimeout(400);
check('B1 creation mode shows the ratings', (await p.$$eval('.lab-row', (rows) => rows.map((r) => r.children[4].textContent.trim()))).every((t) => /^\d$/.test(t)));
await p.screenshot({ path: OUT + '/B1-list-creation-mode-1280.png' });
await p.click('#lab-creation');
// direct URL of an end screen without a play of this player is refused (M3)
await p.goto(BASE + '#/fin/demo/3'); await p.waitForTimeout(600);
check('M3 end screen of a never played grid redirects to the list', p.url().endsWith('#/') || p.url().endsWith('lab.html'), p.url());
await p.close();

// ---- B2: solve, then leave by the game's own links
p = await open();
await p.goto(BASE + '#/partie/demo/0'); await p.waitForSelector('.board-svg');
const n0 = plays().length;
await solveFirst(p);
await p.waitForSelector('.banner');
await p.waitForTimeout(600);
check('B2 solved play saved at the solve', plays().length === n0 + 1 && plays().at(-1).outcome === 'solved', JSON.stringify(plays().at(-1)));
await p.screenshot({ path: OUT + '/B2-solved-1280.png' });
await p.click('.done-tools a'); await p.waitForSelector('#lab-felt', { timeout: 5000 });
check('B2 the game link leads to the end screen', p.url().includes('#/fin/demo/0'), p.url());
check('B2 still one line, solved', plays().length === n0 + 1 && plays().at(-1).outcome === 'solved');
await p.screenshot({ path: OUT + '/B2-end-1280.png' });
await p.goto(BASE + '#/partie/demo/0'); await p.waitForSelector('.board-svg');
await solveFirst(p); await p.waitForSelector('.banner');
await p.click('.lab-tab[href="#/"]'); await p.waitForSelector('#lab-felt', { timeout: 5000 });
check('B2 the Lot tab after a solve also goes to the end screen', p.url().includes('#/fin/demo/0'));
check('B2 two solved lines for two solved games', plays().filter((x) => x.outcome === 'solved').length === 2 && plays().at(-1).attempt === 2, JSON.stringify(plays().at(-1)));
await p.close();

// ---- B3: reload and close in the middle of a game
p = await open();
await p.goto(BASE + '#/partie/demo/2'); await p.waitForSelector('.board-svg');
const n1 = plays().length;
await p.waitForTimeout(3200);
await p.reload(); await p.waitForSelector('.board-svg'); await p.waitForTimeout(500);
const afterReload = plays().slice(n1);
check('B3 reload records an abandoned game', afterReload.length === 1 && afterReload[0].outcome === 'abandoned' && afterReload[0].reason === 'unload' && afterReload[0].ms >= 3000, JSON.stringify(afterReload));
await p.waitForTimeout(2300);
await p.close({ runBeforeUnload: true }); await new Promise((r) => setTimeout(r, 800));
const afterClose = plays().slice(n1 + 1);
check('B3 closing the tab records another abandoned game', afterClose.length === 1 && afterClose[0].reason === 'unload' && afterClose[0].attempt === 2, JSON.stringify(afterClose));
check('no JS error', errors.length === 0, errors.join(';'));
await b.close();
console.log(failures ? `${failures} FAILURE(S)` : 'ALL OK');
process.exit(failures ? 1 : 0);
