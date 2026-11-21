// S7.11 check: board card (fixed layout, prices under the hours, export rows, exchanges in the clue card), in Chrome.
// - Needs `vite preview --port 4651 --strictPort` on the build of the branch and playwright-core.
// - Plays tutorial 6, G7, G10 and G11 at 1280, 375 and 320 px; usage: node verify.mjs
//   → OK/FAIL lines, results.json and captures in docs/reviews/S7.11/.
import { chromium } from 'playwright-core';
import fs from 'fs';

const BASE = 'http://127.0.0.1:4651/dispatch/';
const OUT = new URL('../', import.meta.url).pathname;
const results = [];
const check = (name, ok, detail = '') => { results.push({ name, ok: !!ok, detail }); console.log(`${ok ? 'OK  ' : 'FAIL'} ${name}${detail ? ' — ' + detail : ''}`); };
const wait = (p, ms = 250) => p.waitForTimeout(ms);
const over = (p) => p.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
const rect = (p, sel) => p.evaluate((s) => { const e = document.querySelector(s); if (!e) return null; const r = e.getBoundingClientRect(); return [r.left, r.top, r.width, r.height].map((v) => +v.toFixed(1)); }, sel);
const same = (a, b) => a && b && a.every((v, i) => Math.abs(v - b[i]) < 0.6);

async function open(b, w, id) {
  const touch = w < 860;
  const ctx = await b.newContext({ viewport: { width: w, height: 900 }, hasTouch: touch, isMobile: touch, deviceScaleFactor: 2 });
  const p = await ctx.newPage();
  p.errors = []; p.touch = touch;
  p.on('pageerror', (e) => p.errors.push(e.message));
  await p.goto(BASE + '#/');
  await p.evaluate(() => localStorage.clear());
  await p.goto(BASE + `#/grille/${id}`);
  await p.reload();
  await p.waitForSelector('.board-svg');
  await wait(p);
  return p;
}
async function tap(p, sel) {
  const l = p.locator(sel).first();
  await l.scrollIntoViewIfNeeded();
  const r = await l.boundingBox();
  if (p.touch) await p.touchscreen.tap(r.x + r.width / 2, r.y + r.height / 2);
  else await p.mouse.click(r.x + r.width / 2, r.y + r.height / 2);
  await wait(p, 150);
}
const exportCells = (p) => p.$$eval('.board-svg [data-act="export"]', (e) => e.map((g) => [g.getAttribute('data-country'), +g.getAttribute('data-col')]));
const snap = async (p) => ({ card: await rect(p, '.board-card'), svg: await rect(p, '.board-svg'), logo: await rect(p, '.brand svg'), ttl: await rect(p, '.ttl .eyebrow') });

const b = await chromium.launch({ executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome' });
for (const w of [1280, 375, 320]) {
  for (const id of [6, 7, 10, 11]) {
    const tag = `G${id}@${w}`;
    const p = await open(b, w, id);
    const before = await snap(p);
    const o = await over(p);
    check(`${tag} no horizontal scroll`, o <= 0, `${o}`);
    check(`${tag} card level with the title eyebrow (desktop) / under the logo (phone)`, w >= 861 ? Math.abs(before.card[1] - before.ttl[1]) <= 4 : before.card[1] > before.logo[1], `card ${before.card[1]} eyebrow ${before.ttl[1]}`);
    check(`${tag} card has the border, radius and fill of the right-hand cards`, await p.evaluate(() => { const c = getComputedStyle(document.querySelector('.board-card')), s = document.querySelector('.side .card'); const d = s ? getComputedStyle(s) : c; return c.borderRadius === d.borderRadius && c.backgroundColor === d.backgroundColor && c.borderTopWidth === d.borderTopWidth && c.borderTopColor === d.borderTopColor; }));
    check(`${tag} board inside the card`, await p.evaluate(() => { const c = document.querySelector('.board-card').getBoundingClientRect(), s = document.querySelector('.board-svg').getBoundingClientRect(); return s.left >= c.left - 0.5 && s.top >= c.top - 0.5 && s.bottom <= c.bottom + 0.5; }));
    if (id === 7) {
      const prices = await p.evaluate(() => { const svg = document.querySelector('.board-svg'); const rows = +svg.dataset.rows, cell = +svg.dataset.cell; const ys = [...svg.querySelectorAll('g.tag > rect:first-child')].map((r) => +r.getAttribute('y')); return { hoursY: rows * cell, ys }; });
      check(`${tag} the 2 price pills sit under the hours`, prices.ys.filter((y) => y > prices.hoursY).length === 2, JSON.stringify(prices));
    }
    const cells = await exportCells(p);
    const ncols = await p.evaluate(() => document.querySelectorAll('.board-svg text').length && 0);
    check(`${tag} export row: cells for the neighbor`, cells.length > 0, `${cells.length}`);
    check(`${tag} DE heads the row`, await p.evaluate(() => [...document.querySelectorAll('.board-svg text')].some((t) => t.textContent === 'DE')));
    await p.screenshot({ path: `${OUT}g${id}-start-${w}.png`, fullPage: true });
    // export a block in a free slot (not locked)
    const free = cells.find(([, col]) => col >= 1);
    const target = `.board-svg [data-act="export"][data-country="${free[0]}"][data-col="${free[1]}"]`;
    const reserveBefore = await p.$$eval('.board-svg .reserve', (e) => e.length);
    await tap(p, target);
    const after = await snap(p);
    const filled = await p.$eval(target + ' text', (t) => t.textContent).catch(() => '');
    // G7 publishes both of its exports (locked): a third one is refused, and nothing may move either.
    if (id !== 7) check(`${tag} the export cell fills (→1)`, /→/.test(filled), filled);
    const reserveAfter = await p.$$eval('.board-svg .reserve', (e) => e.length);
    if (id !== 7) check(`${tag} the export took a reserve cell`, reserveAfter === reserveBefore - 1, `${reserveBefore} → ${reserveAfter}`);
    check(`${tag} grid, card and logo did not move after an export`, same(before.card, after.card) && same(before.svg, after.svg) && same(before.logo, after.logo) && same(before.ttl, after.ttl), JSON.stringify({ before, after }));
    check(`${tag} no horizontal scroll after the export`, (await over(p)) <= 0);
    await p.screenshot({ path: `${OUT}g${id}-export-${w}.png`, fullPage: true });
    if (id === 7) check(`${tag} the third export is refused with a message`, /Plus d|déjà|inventaire|exporté|épuis/i.test(await p.$eval('.msg-slot', (e) => e.textContent)), await p.$eval('.msg-slot', (e) => e.textContent));
    await tap(p, target);
    if (id !== 7) check(`${tag} a second tap clears the export`, !/→/.test(await p.$eval(target + ' text', (t) => t.textContent).catch(() => '')));
    check(`${tag} no JS error`, p.errors.length === 0, p.errors.join(';'));
    await p.context().close();
  }
}

// STEP on G7: pumping does not move the card
for (const w of [1280, 375]) {
  const p = await open(b, w, 7);
  const before = await snap(p);
  await tap(p, w < 861 ? '.chip[data-piece="STEP"]' : '.prow[data-piece="STEP"]');
  await tap(p, '.board-svg [data-act="step-arrow"][data-col="2"]');
  await tap(p, '.board-svg [data-act="step-arrow"][data-col="5"]');
  const pairs = await p.$$eval('.board-svg .step-tag', (e) => e.length);
  const after = await snap(p);
  check(`G7@${w} STEP pair laid (2 tags)`, pairs === 2, `${pairs}`);
  check(`G7@${w} card, grid and logo did not move after pumping`, same(before.card, after.card) && same(before.svg, after.svg) && same(before.logo, after.logo), JSON.stringify({ before, after }));
  await p.screenshot({ path: `${OUT}g7-step-${w}.png`, fullPage: true });
  await p.context().close();
}

// clue card: exchanges line for the tutorials with exports; no "Échanges" row in the book
for (const id of [3, 6, 7]) {
  const p = await open(b, 1280, id);
  const book = await p.$eval('.side .book', (e) => e.textContent);
  check(`G${id} the order book has no Échanges row`, !/Échanges/.test(book), book.slice(0, 120));
  const clueTitle = await p.$eval('.side .card:has(.clues) .ct', (e) => e.textContent);
  check(`G${id} clue card named « Publications du marché »`, /Publications du marché/.test(clueTitle), clueTitle);
  const first = await p.$eval('.side .clues .clue .txt', (e) => e.textContent);
  check(`G${id} the exchanges line comes first`, /^Aujourd’hui/.test(first), first);
  await p.screenshot({ path: `${OUT}g${id}-clues-1280.png`, fullPage: true });
  await p.context().close();
}
await b.close();
fs.writeFileSync(`${OUT}scripts/results.json`, JSON.stringify(results, null, 1));
const bad = results.filter((r) => !r.ok);
console.log(`\n${results.length - bad.length}/${results.length} OK`);
process.exit(bad.length ? 1 : 0);
