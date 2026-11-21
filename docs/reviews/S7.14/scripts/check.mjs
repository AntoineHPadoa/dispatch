// S7.14 check in Chrome: slot-clue band (variant b), STEP arrows on their column top, fixed card, paper sheets.
// - Needs `vite preview --port 4662 --strictPort --host 127.0.0.1` on the branch build, and playwright-core.
// - Usage: node check.mjs → OK/FAIL lines, ../check/results.json, captures in ../check/.
import { chromium } from 'playwright-core';
import fs from 'fs';

const BASE = 'http://127.0.0.1:4662/dispatch/';
const OUT = new URL('../check/', import.meta.url).pathname;
fs.mkdirSync(OUT, { recursive: true });
const results = [];
const check = (name, ok, detail = '') => {
  results.push({ name, ok: !!ok, detail });
  console.log(`${ok ? 'OK  ' : 'FAIL'} ${name}${detail && !ok ? ' — ' + detail : ''}`);
};
const hscroll = (p) => p.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);

/** Card, svg and logo boxes (page coordinates). */
const layout = (p) => p.evaluate(() => {
  const r = (e) => { if (!e) return null; const b = e.getBoundingClientRect(); return [b.left + scrollX, b.top + scrollY, b.width, b.height].map((v) => Math.round(v * 10) / 10); };
  const svg = document.querySelector('.board-svg');
  const shapes = [...svg.querySelectorAll('rect, circle, path, text')].map((e) => e.getBoundingClientRect()).filter((b) => b.width && b.height);
  return {
    card: r(document.querySelector('.board-card')), svg: r(svg), logo: r(document.querySelector('.brand svg')),
    topmost: Math.min(...shapes.map((b) => b.top + scrollY)), bottommost: Math.max(...shapes.map((b) => b.bottom + scrollY)),
    leftmost: Math.min(...shapes.map((b) => b.left + scrollX)), rightmost: Math.max(...shapes.map((b) => b.right + scrollX)),
  };
});
const eq = (a, b) => !!a && !!b && a.every((v, i) => Math.abs(v - b[i]) < 0.6);
const sameLayout = (a, b) => eq(a.card, b.card) && eq(a.svg, b.svg) && eq(a.logo, b.logo);

/** Pills under the hours (svg user units) and how many overlap on the same line. */
const band = (p, root = '') => p.evaluate((root) => {
  const svg = document.querySelector(`${root} .board-svg`);
  const rows = +svg.dataset.rows, cell = +svg.dataset.cell;
  const pills = [...svg.querySelectorAll('rect[height="18"][rx="9"]')]
    .map((r) => ({ x1: +r.getAttribute('x'), x2: +r.getAttribute('x') + +r.getAttribute('width'), y: +r.getAttribute('y') }))
    .filter((q) => q.y > rows * cell);
  let overlaps = 0;
  pills.forEach((a, i) => pills.forEach((b, j) => { if (i < j && Math.abs(a.y - b.y) < 18 && a.x1 < b.x2 && b.x1 < a.x2) overlaps++; }));
  return { pills, overlaps, lines: new Set(pills.map((q) => q.y)).size };
}, root);

/** For each STEP arrow: gap (user units) between its circle bottom and the top cell of its column. */
const arrowGaps = (p) => p.evaluate(() => {
  const svg = document.querySelector('.board-svg');
  const rows = +svg.dataset.rows, cell = +svg.dataset.cell, lead = +svg.dataset.lead;
  const out = [];
  for (const g of svg.querySelectorAll('[data-act="step-arrow"]')) {
    const c = +g.dataset.col;
    const circ = g.querySelector('circle');
    const bottom = +circ.getAttribute('cy') + +circ.getAttribute('r');
    const cells = [...svg.querySelectorAll('rect')].filter((r) => {
      const x = +r.getAttribute('x'), y = +r.getAttribute('y'), w = +r.getAttribute('width'), h = +r.getAttribute('height');
      return x >= lead + c * cell && x < lead + (c + 1) * cell && y >= 0 && y + h <= rows * cell + 0.5 && Math.abs(w - h) < 0.5 && w > cell / 2;
    });
    const top = Math.min(...cells.map((r) => +r.getAttribute('y')));
    out.push({ c, gap: Math.round((top - bottom) * 10) / 10 });
  }
  return out;
});

async function openGrid(b, w, id) {
  const touch = w < 860;
  const ctx = await b.newContext({ viewport: { width: w, height: 900 }, hasTouch: touch, isMobile: touch, deviceScaleFactor: 2 });
  const p = await ctx.newPage();
  p.touch = touch;
  p.errors = [];
  p.on('pageerror', (e) => p.errors.push(e.message));
  await p.goto(BASE + '#/');
  await p.evaluate(() => localStorage.clear());
  await p.goto(BASE + `#/grille/${id}`);
  await p.reload();
  await p.waitForSelector('.board-svg');
  await p.waitForTimeout(300);
  return p;
}
async function tap(p, sel) {
  const l = p.locator(sel).first();
  await l.scrollIntoViewIfNeeded();
  const r = await l.boundingBox();
  if (p.touch) await p.touchscreen.tap(r.x + r.width / 2, r.y + r.height / 2);
  else await p.mouse.click(r.x + r.width / 2, r.y + r.height / 2);
  await p.waitForTimeout(200);
}

const b = await chromium.launch({ executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome' });
const W = [1280, 375, 320];

// 1. Every grid at every width: no horizontal scroll, board inside the card, no overlap in the band.
for (const w of W) {
  for (let id = 1; id <= 11; id++) {
    const p = await openGrid(b, w, id);
    const L = await layout(p);
    const B = await band(p);
    const tag = `G${id}@${w}`;
    check(`${tag} no horizontal scroll`, (await hscroll(p)) <= 0, `${await hscroll(p)}`);
    check(`${tag} board inside the card, under the logo`, L.leftmost >= L.card[0] - 0.5 && L.rightmost <= L.card[0] + L.card[2] + 0.5 && L.topmost >= L.card[1] - 0.5 && L.bottommost <= L.card[1] + L.card[3] + 0.5 && L.topmost >= L.logo[1] + L.logo[3], JSON.stringify(L));
    check(`${tag} no two clues overlap in the band (${B.pills.length} pills, ${B.lines} line(s))`, B.overlaps === 0, JSON.stringify(B.pills));
    if (id === 6) check(`${tag} both prices on one line`, B.pills.length === 2 && B.lines === 1, JSON.stringify(B.pills));
    check(`${tag} no JS error`, !p.errors.length, p.errors.join(';'));
    if (id === 6 || id === 7 || id === 10 || id === 11) await p.locator('.board-card').screenshot({ path: `${OUT}g${id}-${w}.png` });
    await p.context().close();
  }
}

// 2. Exports: the card, the board and the logo stay put; the dashed violet cell shows; clues still apart.
for (const w of W) {
  for (const [id, col] of [[6, 1], [10, 0], [11, 2]]) {
    const p = await openGrid(b, w, id);
    const before = await layout(p);
    const violet = () => p.$$eval('.board-svg rect[stroke="#8f78cf"][stroke-dasharray="4 3"]', (e) => e.length);
    const v0 = await violet();
    await tap(p, `.board-svg [data-act="export"][data-col="${col}"]`);
    const after = await layout(p);
    const tag = `G${id}@${w} export`;
    check(`${tag}: nothing moves (card, board, logo)`, sameLayout(before, after), JSON.stringify({ before, after }));
    check(`${tag}: one dashed violet cell appears`, v0 === 0 && (await violet()) === 1, `${v0} → ${await violet()}`);
    check(`${tag}: still no overlap in the band`, (await band(p)).overlaps === 0);
    check(`${tag}: no horizontal scroll`, (await hscroll(p)) <= 0);
    await p.locator('.board-card').screenshot({ path: `${OUT}g${id}-export-${w}.png` });
    await p.context().close();
  }
}

// 3. G7 STEP: arrows on their column top, nothing moves while pumping and turbining.
for (const w of W) {
  const p = await openGrid(b, w, 7);
  const before = await layout(p);
  const tag = `G7 STEP@${w}`;
  await tap(p, p.touch ? '.chip[data-piece="STEP"]' : '.prow[data-piece="STEP"]');
  const g0 = await arrowGaps(p);
  check(`${tag} every ▲ sits just above the top of its column (gap 0–12)`, g0.length === 7 && g0.every((a) => a.gap > 0 && a.gap < 12), JSON.stringify(g0));
  check(`${tag} STEP mode: nothing moves`, sameLayout(before, await layout(p)));
  await p.locator('.board-card').screenshot({ path: `${OUT}g7-step-${w}.png` });
  await tap(p, '.board-svg [data-act="step-arrow"][data-col="2"]');
  const g1 = await arrowGaps(p);
  check(`${tag} pending pump: ▲ and ▼ on their column tops`, g1.every((a) => a.gap > 0 && a.gap < 12), JSON.stringify(g1));
  check(`${tag} pending pump: nothing moves`, sameLayout(before, await layout(p)));
  await p.locator('.board-card').screenshot({ path: `${OUT}g7-pump-${w}.png` });
  await tap(p, '.board-svg [data-act="step-arrow"][data-col="5"]');
  check(`${tag} pair laid: 2 tags, nothing moves`, (await p.$$eval('.board-svg .step-tag', (e) => e.length)) === 2 && sameLayout(before, await layout(p)));
  const L = await layout(p);
  check(`${tag} pair laid: board under the logo, inside the card`, L.topmost >= L.logo[1] + L.logo[3] && L.topmost >= L.card[1] - 0.5);
  await p.locator('.board-card').screenshot({ path: `${OUT}g7-pair-${w}.png` });
  check(`${tag} no horizontal scroll`, (await hscroll(p)) <= 0);
  check(`${tag} no JS error`, !p.errors.length, p.errors.join(';'));
  await p.context().close();
}

// 4. Paper sheets: the same band under the rectangle, nothing above it, no overlap.
{
  const ctx = await b.newContext({ viewport: { width: 900, height: 1200 }, deviceScaleFactor: 1.5 });
  const p = await ctx.newPage();
  for (const id of [6, 7, 10, 11]) {
    await p.goto(BASE + `#/imprimer/${id}`);
    await p.waitForSelector('.a4 .board-svg');
    await p.waitForTimeout(300);
    const B = await band(p, '.a4');
    const above = await p.evaluate(() => {
      const svg = document.querySelector('.a4 .board-svg');
      return [...svg.querySelectorAll('rect[height="18"][rx="9"]')].filter((r) => +r.getAttribute('y') < 0).length;
    });
    const n = await p.evaluate((id) => id, id);
    check(`sheet G${n}: slot clues under the rectangle, none above (${B.pills.length} pills)`, above === 0 && B.pills.length > 0);
    check(`sheet G${n}: no overlap in the band`, B.overlaps === 0, JSON.stringify(B.pills));
    if (id === 6) check('sheet G6: both prices on one line', B.lines === 1);
    await p.locator('.a4').first().screenshot({ path: `${OUT}sheet-g${id}.png` });
  }
  await ctx.close();
}

await b.close();
fs.writeFileSync(`${OUT}results.json`, JSON.stringify(results, null, 1));
const fails = results.filter((r) => !r.ok).length;
console.log(`${results.length - fails}/${results.length} OK`);
