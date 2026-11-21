// S7.11 independent review: board card, fixed layout, price row, export rows, clue card, paper sheets.
// - Needs `vite preview --port 4652 --strictPort` on the build of the branch and playwright-core.
// - Usage: node check.mjs → OK/FAIL lines, results.json, captures and PDFs in docs/reviews/S7.11-review/.
import { chromium } from 'playwright-core';
import fs from 'fs';

const BASE = 'http://127.0.0.1:4652/dispatch/';
const OUT = new URL('../', import.meta.url).pathname;
const results = [];
const check = (name, ok, detail = '') => {
  results.push({ name, ok: !!ok, detail });
  console.log(`${ok ? 'OK  ' : 'FAIL'} ${name}${detail ? ' — ' + detail : ''}`);
};
const wait = (p, ms = 200) => p.waitForTimeout(ms);
const hscroll = (p) => p.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
const box = (p, sel) => p.evaluate((s) => {
  const e = document.querySelector(s);
  if (!e) return null;
  const r = e.getBoundingClientRect();
  return [r.left + scrollX, r.top + scrollY, r.width, r.height].map((v) => Math.round(v * 10) / 10);
}, sel);
const eq = (a, b) => !!a && !!b && a.every((v, i) => Math.abs(v - b[i]) < 0.6);

/** Layout snapshot: card, svg, logo, title, price pills and the bottom of every svg shape. */
const layout = (p) => p.evaluate(() => {
  const r = (e) => { if (!e) return null; const b = e.getBoundingClientRect(); return [b.left + scrollX, b.top + scrollY, b.width, b.height].map((v) => Math.round(v * 10) / 10); };
  const svg = document.querySelector('.board-svg');
  const shapes = [...svg.querySelectorAll('rect, circle, path, text')].map((e) => e.getBoundingClientRect()).filter((b) => b.width && b.height);
  return {
    card: r(document.querySelector('.board-card')),
    svg: r(svg),
    logo: r(document.querySelector('.brand svg')),
    title: r(document.querySelector('.title .eyebrow')),
    prices: [...svg.querySelectorAll('g.tag:not(.step-tag) > rect:first-child')].map(r),
    topmost: Math.min(...shapes.map((b) => b.top + scrollY)),
    leftmost: Math.min(...shapes.map((b) => b.left + scrollX)),
    rightmost: Math.max(...shapes.map((b) => b.right + scrollX)),
    bottommost: Math.max(...shapes.map((b) => b.bottom + scrollY)),
  };
});
const sameLayout = (a, b) => eq(a.card, b.card) && eq(a.svg, b.svg) && eq(a.logo, b.logo) && eq(a.title, b.title)
  && a.prices.length === b.prices.length && a.prices.every((x, i) => eq(x, b.prices[i]));

async function page(b, w) {
  const touch = w < 860;
  const ctx = await b.newContext({ viewport: { width: w, height: 900 }, hasTouch: touch, isMobile: touch, deviceScaleFactor: 2 });
  const p = await ctx.newPage();
  p.errors = [];
  p.touch = touch;
  p.on('pageerror', (e) => p.errors.push(e.message));
  await p.goto(BASE + '#/');
  await p.evaluate(() => localStorage.clear());
  return p;
}
async function openGrid(b, w, id) {
  const p = await page(b, w);
  await p.goto(BASE + `#/grille/${id}`);
  await p.reload();
  await p.waitForSelector('.board-svg');
  await wait(p, 300);
  return p;
}
async function tap(p, sel) {
  const l = p.locator(sel).first();
  if (!(await l.isVisible().catch(() => false))) { console.log(`FAIL tap target not visible: ${sel}`); results.push({ name: `tap ${sel}`, ok: false }); return; }
  await l.scrollIntoViewIfNeeded();
  const r = await l.boundingBox();
  if (p.touch) await p.touchscreen.tap(r.x + r.width / 2, r.y + r.height / 2);
  else await p.mouse.click(r.x + r.width / 2, r.y + r.height / 2);
  await wait(p, 150);
}
const reserves = (p) => p.$$eval('.board-svg .reserve', (e) => e.length);
const cellText = (p, c, col) => p.$eval(`.board-svg [data-country="${c}"][data-col="${col}"] text`, (t) => t.textContent).catch(() => '');
const stepTags = (p) => p.$$eval('.board-svg .step-tag', (e) => e.length);

/** Pick a free (not locked) export cell whose column has a reserve cell left. */
async function freeExport(p) {
  const cells = await p.$$eval('.board-svg [data-act="export"]', (e) => e.map((g) => [g.getAttribute('data-country'), +g.getAttribute('data-col')]));
  return cells;
}

const b = await chromium.launch({ executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome' });
const W = [1280, 375, 320];

// 1. Home → grid: the logo does not move; "grille du jour" opens from the home button.
for (const w of W) {
  const p = await page(b, w);
  await p.goto(BASE + '#/');
  await p.waitForSelector('.brand svg');
  await wait(p, 300);
  const logoHome = await box(p, '.brand svg');
  await tap(p, '.band ~ .sact a.btn, .sact a.btn');
  await p.waitForSelector('.board-svg');
  await wait(p, 300);
  const logoGrid = await box(p, '.brand svg');
  const id = await p.evaluate(() => location.hash);
  check(`home→grille du jour @${w}: logo fixed`, eq(logoHome, logoGrid), `${JSON.stringify(logoHome)} → ${JSON.stringify(logoGrid)} (${id})`);
  check(`grille du jour @${w}: no horizontal scroll`, (await hscroll(p)) <= 0, `${await hscroll(p)}`);
  const L = await layout(p);
  check(`grille du jour @${w}: board under the logo, inside the card`, L.topmost >= L.logo[1] + L.logo[3] && L.topmost >= L.card[1] - 0.5 && L.bottommost <= L.card[1] + L.card[3] + 0.5 && L.rightmost <= L.card[0] + L.card[2] + 0.5, JSON.stringify({ top: L.topmost, logo: L.logo, card: L.card }));
  await p.screenshot({ path: `${OUT}daily-${w}.png`, fullPage: true });
  check(`grille du jour @${w}: no JS error`, !p.errors.length, p.errors.join(';'));
  await p.context().close();
}

// 2. Exports per grid and width: nothing moves, reserve consumed, cell fills; board stays under the logo.
for (const w of W) {
  for (const id of [3, 6, 7, 10]) {
    const tag = `G${id}@${w}`;
    const p = await openGrid(b, w, id);
    const before = await layout(p);
    check(`${tag} no horizontal scroll`, (await hscroll(p)) <= 0, `${await hscroll(p)}`);
    check(`${tag} card radius/border/fill = right-hand cards`, await p.evaluate(() => {
      const a = getComputedStyle(document.querySelector('.board-card'));
      const s = document.querySelector('.side .card');
      if (!s) return true;
      const d = getComputedStyle(s);
      return a.borderRadius === d.borderRadius && a.backgroundColor === d.backgroundColor && a.borderTopColor === d.borderTopColor && a.borderTopWidth === d.borderTopWidth;
    }));
    check(`${tag} whole board inside the card (no clipping at the edges)`, before.leftmost >= before.card[0] && before.rightmost <= before.card[0] + before.card[2] && before.topmost >= before.card[1] && before.bottommost <= before.card[1] + before.card[3], JSON.stringify({ l: before.leftmost, r: before.rightmost, t: before.topmost, b: before.bottommost, card: before.card }));
    const scrollable = await p.$eval('.board-scroll', (e) => e.scrollWidth - e.clientWidth);
    check(`${tag} board fits without inner scroll`, scrollable <= 0, `${scrollable}`);
    if (w >= 861) check(`${tag} card top level with the title eyebrow`, Math.abs(before.card[1] - before.title[1]) <= 6, `${before.card[1]} vs ${before.title[1]}`);
    // prices: under the hours, centred on their slot
    if (id === 6 || id === 7) {
      const info = await p.evaluate(() => {
        const svg = document.querySelector('.board-svg');
        const rows = +svg.dataset.rows, cell = +svg.dataset.cell, lead = +svg.dataset.lead;
        return [...svg.querySelectorAll('g.tag:not(.step-tag) > rect:first-child')].filter((r) => +r.getAttribute('y') > rows * cell).map((r) => ({ y: +r.getAttribute('y'), mid: +r.getAttribute('x') + +r.getAttribute('width') / 2, hours: rows * cell, cell, lead }));
      });
      check(`${tag} price pills under the hours`, info.length === 2 && info.every((i) => i.y > i.hours), JSON.stringify(info));
    }
    await p.screenshot({ path: `${OUT}g${id}-start-${w}.png`, fullPage: true });
    // export in column 1 (tutorial 6: top of the column), else the first free cell
    const cells = await freeExport(p);
    const pick = cells.find(([, c]) => c === 1) ?? cells[0];
    const r0 = await reserves(p);
    await tap(p, `.board-svg [data-act="export"][data-country="${pick[0]}"][data-col="${pick[1]}"]`);
    const after = await layout(p);
    const txt = await cellText(p, pick[0], pick[1]);
    const msg = await p.$eval('.msg-slot', (e) => e.textContent.trim()).catch(() => '');
    if (id === 7) check(`${tag} export refused (both published exports locked)`, !/→/.test(txt) && msg.length > 0, msg);
    else {
      check(`${tag} export cell fills (${txt})`, /→1/.test(txt));
      check(`${tag} export takes one reserve cell`, (await reserves(p)) === r0 - 1, `${r0} → ${await reserves(p)}`);
    }
    check(`${tag} card, board, logo, title, prices fixed after export`, sameLayout(before, after), JSON.stringify({ before: [before.card, before.svg, before.logo], after: [after.card, after.svg, after.logo] }));
    check(`${tag} after export: board top ${after.topmost} under logo bottom ${after.logo[1] + after.logo[3]}`, after.topmost >= after.logo[1] + after.logo[3] && after.topmost >= after.card[1]);
    check(`${tag} after export: no horizontal scroll`, (await hscroll(p)) <= 0);
    await p.screenshot({ path: `${OUT}g${id}-export-${w}.png`, fullPage: true });
    if (id !== 7) {
      await tap(p, `.board-svg [data-act="export"][data-country="${pick[0]}"][data-col="${pick[1]}"]`);
      check(`${tag} second tap clears (cap 1)`, !/→/.test(await cellText(p, pick[0], pick[1])) && (await reserves(p)) === r0);
    }
    check(`${tag} no JS error`, !p.errors.length, p.errors.join(';'));
    await p.context().close();
  }
}

// 3. No reserve without neighbor nor STEP
for (const id of [1, 2]) {
  const p = await openGrid(b, 1280, id);
  check(`G${id} (no neighbor, no STEP): no reserve row`, (await reserves(p)) === 0, `${await reserves(p)}`);
  check(`G${id}: no export row`, (await p.$$eval('.board-svg [data-country]', (e) => e.length)) === 0);
  await p.context().close();
}

// 4. G7: STEP pump/turbine, undo, eraser; nothing moves
for (const w of W) {
  const tag = `G7 STEP@${w}`;
  const p = await openGrid(b, w, 7);
  const before = await layout(p);
  const r0 = await reserves(p);
  await tap(p, p.touch ? '.chip[data-piece="STEP"]' : '.prow[data-piece="STEP"]');
  await tap(p, '.board-svg [data-act="step-arrow"][data-col="2"]');
  const mid = await layout(p);
  check(`${tag} pumping (▲ at 8h): nothing moves`, sameLayout(before, mid));
  check(`${tag} pending pump: reserve unchanged until the turbine`, (await reserves(p)) === r0, `${r0} → ${await reserves(p)}`);
  check(`${tag} pumped block under the logo`, mid.topmost >= mid.logo[1] + mid.logo[3] && mid.topmost >= mid.card[1]);
  await tap(p, '.board-svg [data-act="step-arrow"][data-col="5"]');
  const after = await layout(p);
  check(`${tag} pair laid (2 tags)`, (await stepTags(p)) === 2, `${await stepTags(p)}`);
  check(`${tag} pair takes one reserve cell`, (await reserves(p)) === r0 - 1, `${r0} → ${await reserves(p)}`);
  check(`${tag} turbining: nothing moves`, sameLayout(before, after));
  check(`${tag} no horizontal scroll`, (await hscroll(p)) <= 0);
  await p.screenshot({ path: `${OUT}g7-step-${w}.png`, fullPage: true });
  await tap(p, '.tools [data-tool="undo"]');
  const u = await stepTags(p);
  check(`${tag} undo removes the pair`, u === 0, `${u}`);
  check(`${tag} undo: nothing moves`, sameLayout(before, await layout(p)));
  // lay it again and erase it
  await tap(p, p.touch ? '.chip[data-piece="STEP"]' : '.prow[data-piece="STEP"]');
  await tap(p, '.board-svg [data-act="step-arrow"][data-col="2"]');
  await tap(p, '.board-svg [data-act="step-arrow"][data-col="5"]');
  await tap(p, p.touch ? '.chips [data-tool="erase"], .tools [data-tool="erase"]' : '.tools [data-tool="erase"]');
  const tagEl = await p.$('.board-svg [data-act="step-tag"]');
  if (tagEl) await tap(p, '.board-svg [data-act="step-tag"]');
  const e = await stepTags(p);
  check(`${tag} eraser removes the pair`, e === 0, `${e} tags left`);
  check(`${tag} eraser: nothing moves, reserve back`, sameLayout(before, await layout(p)) && (await reserves(p)) === r0, `${await reserves(p)}`);
  check(`${tag} no JS error`, !p.errors.length, p.errors.join(';'));
  await p.context().close();
}

// 5. Clue card and order book (exact inventory with exports: 3, 6, 7; rated: 10)
for (const id of [3, 6, 7, 10]) {
  for (const w of [1280, 375]) {
    const p = await openGrid(b, w, id);
    const book = await p.$eval('.book', (e) => e.textContent);
    check(`G${id}@${w} order book without « Échanges »`, !/Échanges/.test(book));
    const t = await p.$$eval('.card .ct', (e) => e.map((x) => x.textContent.trim()));
    check(`G${id}@${w} card « Publications du marché »`, t.some((x) => /Publications du marché/.test(x)), t.join(' | '));
    const items = await p.$$eval('.clues .clue .txt', (e) => e.map((x) => x.textContent.trim()));
    if (id !== 10) check(`G${id}@${w} imposed exchanges listed first`, /export/i.test(items[0] ?? ''), items[0]);
    if (w === 1280) await p.screenshot({ path: `${OUT}g${id}-clues-${w}.png`, fullPage: true });
    await p.context().close();
  }
}

// 6. Paper: G7 and tutorial 6 (PDF + capture of the preview)
for (const id of [6, 7]) {
  const p = await page(b, 1280);
  await p.goto(BASE + `#/imprimer/${id}`);
  await p.waitForSelector('.a4 .board-svg');
  await wait(p, 300);
  const txt = await p.$eval('.a4', (e) => e.textContent);
  check(`sheet G${id}: « Publications du marché »`, /Publications du marché/.test(txt));
  check(`sheet G${id}: no « Échanges » row in the book`, !(await p.$eval('.a4 .book', (e) => /Échanges/.test(e.textContent))));
  check(`sheet G${id}: export row « DE » cells`, await p.$eval('.a4 .board-svg', (s) => [...s.querySelectorAll('text')].some((t) => t.textContent === 'DE')));
  check(`sheet G${id}: no reserve drawn on paper`, (await p.$$eval('.a4 .reserve', (e) => e.length)) === 0);
  await p.locator('.a4').first().screenshot({ path: `${OUT}sheet-g${id}.png` });
  await p.emulateMedia({ media: 'print' });
  await p.pdf({ path: `${OUT}sheet-g${id}.pdf`, format: 'A4', printBackground: true, preferCSSPageSize: true });
  const pages = (fs.readFileSync(`${OUT}sheet-g${id}.pdf`, 'latin1').match(/\/Type\s*\/Page[^s]/g) ?? []).length;
  check(`sheet G${id}: PDF fits one A4 page`, pages === 1, `${pages} pages`);
  await p.context().close();
}

await b.close();
fs.writeFileSync(`${OUT}scripts/results.json`, JSON.stringify(results, null, 1));
const bad = results.filter((r) => !r.ok);
console.log(`\n${results.length - bad.length}/${results.length} OK`);
