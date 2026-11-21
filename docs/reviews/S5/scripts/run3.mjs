import { chromium } from 'playwright';
import { readFileSync } from 'node:fs';
const S = process.env.S, OUT = '/Users/padoa/Programs/spot-elec-wt/v2-lab/docs/reviews/S5';
const BASE = 'http://localhost:5173/dispatch/lab.html';
const b = await chromium.launch({ channel: 'chrome' });
const p = await (await b.newContext({ viewport: { width: 1280, height: 900 } })).newPage();
async function cellXY(row, col) {
  return p.evaluate(([row, col]) => {
    const svg = document.querySelector('.board-svg');
    const cell = +svg.dataset.cell, rows = +svg.dataset.rows, top = +svg.dataset.top;
    const r = svg.getBoundingClientRect(); const sx = +svg.getAttribute('width') / r.width, sy = +svg.getAttribute('height') / r.height;
    return { x: r.left + (col * cell + cell / 2 + 2) / sx, y: r.top + (top + (rows - 1 - row) * cell + cell / 2) / sy };
  }, [row, col]);
}
async function lay(row, col, len) { const a = await cellXY(row, col), c = await cellXY(row, col + len - 1); await p.mouse.move(a.x, a.y); await p.mouse.down(); await p.mouse.move(c.x, c.y, { steps: 6 }); await p.mouse.up(); await p.waitForTimeout(120); }
await p.goto(BASE + '#/partie/demo/1'); await p.waitForSelector('.board-svg'); await p.waitForTimeout(300);
const g = JSON.parse(readFileSync(S + '/labdata/candidates/demo.json', 'utf8'))[0];
for (const c of [3, 4]) { await p.click(`[data-act="export"][data-col="${c}"]`); await p.waitForTimeout(100); }
for (const pl of g.solution.placements) { await p.click(`.side [data-piece="${pl.piece}"]`); await lay(pl.row, pl.col, pl.len); console.log(pl.piece, (await p.textContent('.msg-slot')).trim().slice(0, 70)); }
const n0 = readFileSync(S + '/labdata/plays.jsonl', 'utf8').trim().split('\n').length;
console.log('solved banner:', await p.isVisible('.banner'), '| Terminer visible:', await p.isVisible('#lab-finish'));
await p.screenshot({ path: OUT + '/play-solved-1280.png' });
await p.waitForTimeout(1500);
await p.click('.done-tools a'); await p.waitForTimeout(800);
const lines = readFileSync(S + '/labdata/plays.jsonl', 'utf8').trim().split('\n');
console.log('after banner link: url', p.url(), '| added', lines.length - n0, lines.at(-1));
// exports: find candidate elements under the grid
const ex = await p.$$eval('[data-export], [data-col][data-country], .export, .pastille', (els) => els.map((e) => e.outerHTML.slice(0, 120)));
console.log('export els', ex.length, ex.slice(0, 3));
await b.close();
