// S7.15 review check in Chrome, independent of the S7.14 script.
// - App at 1280/375/320: every grid, no page or board horizontal scroll, every clue pill whole and apart
//   from the other pills, the hours and the export cells; card/board/logo still after export, pump, turbine.
// - Off-app SVGs (render.ts): solved states with ticks, STEP arrows stacked on tags.
// - Navigation home -> grid of the day (logo position), paper sheets (PDF + checks).
// - Usage: vite preview on 127.0.0.1:4671, then `node check.mjs [svgs.json]`.
import { chromium } from 'playwright-core';
import fs from 'fs';

const BASE = 'http://127.0.0.1:4671/dispatch/';
const OUT = new URL('../', import.meta.url).pathname;
const SVGS = process.argv[2];
const results = [];
const check = (name, ok, detail = '') => {
  results.push({ name, ok: !!ok, detail: ok ? '' : detail });
  console.log(`${ok ? 'OK  ' : 'KO  '} ${name}${!ok && detail ? ' — ' + String(detail).slice(0, 400) : ''}`);
};

// Runs in the page: every pill (rect h=18 rx=9) with its tick and text, hours, export cells, STEP marks.
function measure(root) {
  const svg = (root ? document.querySelector(root) : document).querySelector('.board-svg');
  const cell = +svg.dataset.cell, rows = +svg.dataset.rows;
  const R = (e) => { const b = e.getBoundingClientRect(); return { x1: b.left, x2: b.right, y1: b.top, y2: b.bottom }; };
  const S = R(svg);
  const texts = [...svg.querySelectorAll('text')].map((t) => ({ t: t.textContent, y: +t.getAttribute('y'), b: R(t) }));
  const circles = [...svg.querySelectorAll('circle')].map((c) => ({ e: c, b: R(c) }));
  const pills = [...svg.querySelectorAll('rect[height="18"][rx="9"]')].map((r) => {
    const b = R(r);
    const inner = texts.filter((t) => { const cx = (t.b.x1 + t.b.x2) / 2, cy = (t.b.y1 + t.b.y2) / 2; return cx > b.x1 && cx < b.x2 && cy > b.y1 && cy < b.y2; });
    const ticks = circles.filter((c) => { const cx = (c.b.x1 + c.b.x2) / 2, cy = (c.b.y1 + c.b.y2) / 2; return cx >= b.x1 - 3 && cx <= b.x2 + 3 && cy >= b.y1 - 3 && cy <= b.y2 + 3 && !c.e.closest('.step-arrow'); });
    const all = [b, ...ticks.map((c) => c.b)];
    const g = { x1: Math.min(...all.map((q) => q.x1)), x2: Math.max(...all.map((q) => q.x2)), y1: Math.min(...all.map((q) => q.y1)), y2: Math.max(...all.map((q) => q.y2)) };
    const under = +r.getAttribute('y') > rows * cell;
    return { b, g, under, step: !!r.closest('.step-tag'), label: inner.map((t) => t.t).join(' '), textOut: inner.filter((t) => t.b.x1 < b.x1 - 0.5 || t.b.x2 > b.x2 + 0.5).map((t) => t.t) };
  });
  const hourY = rows * cell + 14;
  const hours = texts.filter((t) => t.y === hourY || t.y === hourY + 4).map((t) => ({ t: t.t, b: t.b }));
  const exports = [...svg.querySelectorAll('[data-act="export"]')].map((e) => R(e));
  const arrows = [...svg.querySelectorAll('.step-arrow')].map((e) => ({ col: +e.dataset.col, b: R(e.querySelector('circle')) }));
  return { S, cell, rows, pills, hours, exports, arrows };
}
const hit = (a, b, tol = 0.25) => a.x1 < b.x2 - tol && b.x1 < a.x2 - tol && a.y1 < b.y2 - tol && b.y1 < a.y2 - tol;
/** Overlap and clipping problems of a measure. */
function problems(m) {
  const out = [];
  const P = m.pills;
  P.forEach((a, i) => P.forEach((b, j) => { if (i < j && hit(a.g, b.g)) out.push(`overlap "${a.label}" / "${b.label}"`); }));
  for (const p of P) {
    for (const h of m.hours) if (hit(p.g, h.b)) out.push(`pill "${p.label}" on hour ${h.t}`);
    for (const e of m.exports) if (hit(p.g, e)) out.push(`pill "${p.label}" on an export cell`);
    for (const a of m.arrows) if (hit(p.b, a.b)) out.push(`pill "${p.label}" under an arrow`);
    if (p.g.x1 < m.S.x1 - 0.5 || p.g.x2 > m.S.x2 + 0.5 || p.g.y1 < m.S.y1 - 0.5 || p.g.y2 > m.S.y2 + 0.5) out.push(`pill "${p.label}" clipped by the board`);
    if (p.textOut.length) out.push(`text out of pill "${p.label}"`);
  }
  for (const a of m.arrows) if (a.b.y1 < m.S.y1 - 0.5) out.push(`arrow ${a.col} clipped at the top`);
  m.arrows.forEach((a, i) => m.arrows.forEach((b, j) => { if (i < j && hit(a.b, b.b)) out.push(`arrows ${a.col}/${b.col} overlap`); }));
  return out;
}

const b = await chromium.launch({ executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome' });
const W = [1280, 375, 320];
async function page(w) {
  const touch = w < 860;
  const ctx = await b.newContext({ viewport: { width: w, height: 860 }, hasTouch: touch, isMobile: touch, deviceScaleFactor: 2 });
  const p = await ctx.newPage();
  p.touch = touch; p.errors = [];
  p.on('pageerror', (e) => p.errors.push(e.message));
  await p.goto(BASE + '#/');
  await p.evaluate(() => { try { localStorage.clear(); } catch {} });
  return p;
}
async function openGrid(w, id) {
  const p = await page(w);
  await p.goto(BASE + `#/grille/${id}`);
  await p.reload();
  await p.waitForSelector('.board-svg');
  await p.waitForTimeout(250);
  return p;
}
async function tap(p, sel) {
  const l = p.locator(sel).first();
  await l.scrollIntoViewIfNeeded();
  const r = await l.boundingBox();
  if (p.touch) await p.touchscreen.tap(r.x + r.width / 2, r.y + r.height / 2); else await p.mouse.click(r.x + r.width / 2, r.y + r.height / 2);
  await p.waitForTimeout(220);
}
// Dashed cells drawn above the demand (export: violet, pending pump: blue), inside the grid area only.
const dashedCells = (p, color) => p.evaluate((color) => {
  const svg = document.querySelector('.board-svg');
  const top = +svg.dataset.rows * +svg.dataset.cell;
  return [...svg.querySelectorAll('rect[stroke-dasharray="4 3"][stroke-width="1.6"]')].filter((r) => +r.getAttribute('y') < top && (!color || r.getAttribute('stroke') === color)).length;
}, color);
const boxes = (p) => p.evaluate(() => {
  const r = (s) => { const e = document.querySelector(s); if (!e) return null; const q = e.getBoundingClientRect(); return [q.left + scrollX, q.top + scrollY, q.width, q.height].map((v) => Math.round(v * 100) / 100); };
  return { card: r('.board-card'), grid: r('.board-svg'), logo: r('.brand svg') ?? r('.brand') };
});
const same = (a, b) => ['card', 'grid', 'logo'].every((k) => a[k] && b[k] && a[k].every((v, i) => Math.abs(v - b[k][i]) < 0.5));
const hscroll = (p) => p.evaluate(() => {
  const d = document.documentElement.scrollWidth - document.documentElement.clientWidth;
  const inner = [...document.querySelectorAll('*')].filter((e) => { const s = getComputedStyle(e); return /(auto|scroll)/.test(s.overflowX) && e.scrollWidth > e.clientWidth + 1 && !e.classList.contains('chips-row'); }).map((e) => e.className || e.tagName);
  return { page: d, inner };
});
const shot = (p, name, sel = '.board-card') => p.locator(sel).first().screenshot({ path: `${OUT}${name}.png` });

// Grid of the day: the first grid link on the home page.
let today = null;
{
  const p = await page(1280);
  await p.goto(BASE + '#/');
  await p.waitForTimeout(300);
  today = await p.evaluate(() => { const a = document.querySelector('a[href*="#/grille/"]'); return a ? +a.getAttribute('href').split('/').pop() : null; });
  check(`grid of the day found on the home page (G${today})`, today);
  await p.context().close();
}

// 1. Every grid at every width.
const cells = {};
for (const w of W) {
  for (let id = 1; id <= 11; id++) {
    const p = await openGrid(w, id);
    const tag = `G${id}@${w}`;
    const hs = await hscroll(p);
    check(`${tag} no horizontal scroll (page ${hs.page}, inner ${hs.inner.length})`, hs.page <= 0 && !hs.inner.length, JSON.stringify(hs));
    const m = await p.evaluate(measure);
    cells[`${id}@${w}`] = m.cell;
    const pr = problems(m);
    check(`${tag} cell ${m.cell}: ${m.pills.length} pills, none overlapped or cut`, !pr.length, pr.join('; '));
    // Nothing above the demand at the start (no reserve drawn, no dashed cell).
    const dashed = await dashedCells(p);
    // G7 publishes two exports (flow clues): their dashed cells show from the start.
    check(`${tag} no dashed cell before any move${id === 7 ? ' but the 2 published exports' : ''}`, dashed === (id === 7 ? 2 : 0), String(dashed));
    // Price pairs on neighbouring slots share a line.
    const lines = new Set(m.pills.filter((q) => q.under).map((q) => Math.round(q.b.y1)));
    if (id === 6) check(`${tag} tutorial 6: both price pills on one line`, lines.size === 1, [...lines].join(','));
    check(`${tag} no JS error`, !p.errors.length, p.errors.join(';'));
    if ([6, 7, today].includes(id)) await shot(p, `g${id}-${w}`);
    await p.context().close();
  }
}

// 2. Exports: card, board and logo still; a dashed violet cell appears; clues still clean.
for (const w of W) {
  for (const id of [...new Set([6, 7, today])]) {
    const p = await openGrid(w, id);
    const cols = await p.$$eval('.board-svg [data-act="export"]', (e) => e.map((x) => +x.dataset.col));
    const before = await boxes(p);
    const v0 = await dashedCells(p, '#8f78cf');
    // G7 publishes its exports (exact inventory): a free tap is refused, so tap a slot of G6/G11 only.
    const col = cols[Math.floor(cols.length / 2)];
    await tap(p, `.board-svg [data-act="export"][data-col="${col}"]`);
    const after = await boxes(p);
    const violet = await dashedCells(p, '#8f78cf');
    const tag = `G${id}@${w} export at slot ${col}`;
    check(`${tag}: card, board and logo still`, same(before, after), JSON.stringify({ before, after }));
    if (id === 7) check(`${tag}: export refused (exact inventory already published), ${v0} published dashed cells kept`, violet === v0 && v0 === 2, `${v0} -> ${violet}`);
    else check(`${tag}: one dashed violet cell appears`, v0 === 0 && violet === 1, `${v0} -> ${violet}`);
    const pr = problems(await p.evaluate(measure));
    check(`${tag}: clues still whole and apart`, !pr.length, pr.join('; '));
    check(`${tag}: no horizontal scroll`, (await hscroll(p)).page <= 0);
    await shot(p, `g${id}-export-${w}`);
    await p.context().close();
  }
}

// 3. G7 STEP: arrows on the column tops, pump and turbine leave the card still.
const arrowGaps = (p) => p.evaluate(() => {
  const svg = document.querySelector('.board-svg');
  const cell = +svg.dataset.cell, rows = +svg.dataset.rows, lead = +svg.dataset.lead;
  return [...svg.querySelectorAll('.step-arrow')].map((g) => {
    const c = +g.dataset.col;
    const circ = g.querySelector('circle');
    const bottom = +circ.getAttribute('cy') + +circ.getAttribute('r');
    const xs = +circ.getAttribute('cx');
    const sq = [...svg.querySelectorAll('rect')].filter((r) => {
      const x = +r.getAttribute('x'), y = +r.getAttribute('y'), w = +r.getAttribute('width'), h = +r.getAttribute('height');
      return x >= lead + c * cell - 0.5 && x + w <= lead + (c + 1) * cell + 0.5 && y >= 0 && y + h <= rows * cell + 0.5 && Math.abs(w - h) < 0.5 && w > cell / 2;
    });
    const top = Math.min(...sq.map((r) => +r.getAttribute('y')));
    return { c, gap: Math.round((top - bottom) * 10) / 10, centred: Math.abs(xs - (lead + c * cell + cell / 2)) < 0.5 };
  });
});
for (const w of W) {
  const p = await openGrid(w, 7);
  const tag = `G7 STEP@${w}`;
  const before = await boxes(p);
  await tap(p, p.touch ? '.chip[data-piece="STEP"]' : '.prow[data-piece="STEP"]');
  const g0 = await arrowGaps(p);
  check(`${tag} STEP mode: ${g0.length} ▲ on their column top (gap 0..14), centred`, g0.length && g0.every((a) => a.gap >= 0 && a.gap <= 14 && a.centred), JSON.stringify(g0));
  check(`${tag} STEP mode: card, board and logo still`, same(before, await boxes(p)));
  await shot(p, `g7-step-${w}`);
  const pump = g0[2]?.c ?? 2;
  await tap(p, `.board-svg [data-act="step-arrow"][data-col="${pump}"]`);
  const g1 = await arrowGaps(p);
  check(`${tag} pump pending at slot ${pump}: ▲ and ▼ on their column tops`, g1.length && g1.every((a) => a.gap >= 0 && a.gap <= 14), JSON.stringify(g1));
  check(`${tag} pump pending: one dashed blue cell`, (await dashedCells(p, '#6f9bd0')) === 1, String(await dashedCells(p)));
  check(`${tag} pump pending: card, board and logo still`, same(before, await boxes(p)));
  let pr = problems(await p.evaluate(measure));
  check(`${tag} pump pending: clues whole and apart`, !pr.length, pr.join('; '));
  await shot(p, `g7-pump-${w}`);
  const turb = g1.filter((a) => a.c > pump).pop()?.c;
  await tap(p, `.board-svg [data-act="step-arrow"][data-col="${turb}"]`);
  check(`${tag} turbine at slot ${turb}: card, board and logo still`, same(before, await boxes(p)), JSON.stringify({ before, after: await boxes(p) }));
  pr = problems(await p.evaluate(measure));
  check(`${tag} pair laid: clues whole and apart`, !pr.length, pr.join('; '));
  const tags = await p.$$eval('.board-svg .step-tag', (e) => e.length);
  check(`${tag} pair laid: 2 STEP tags`, tags === 2, String(tags));
  await shot(p, `g7-pair-${w}`);
  // STEP mode reopened over the laid pair: arrows stack over the tags.
  const reopen = await p.$$eval('.board-svg .step-arrow', (e) => e.length);
  if (!reopen) await tap(p, p.touch ? '.chip[data-piece="STEP"]' : '.prow[data-piece="STEP"]');
  pr = problems(await p.evaluate(measure));
  const tagsVsArrows = await p.evaluate(() => {
    const R = (e) => e.getBoundingClientRect();
    const t = [...document.querySelectorAll('.board-svg .step-tag rect')].map(R);
    const a = [...document.querySelectorAll('.board-svg .step-arrow circle')].map(R);
    return t.some((x) => a.some((y) => x.left < y.right && y.left < x.right && x.top < y.bottom && y.top < x.bottom));
  });
  check(`${tag} STEP mode over the laid pair: arrows clear of tags, nothing clipped`, !pr.length && !tagsVsArrows, pr.join('; '));
  check(`${tag} STEP mode over the laid pair: card, board and logo still`, same(before, await boxes(p)));
  await shot(p, `g7-pair-step-${w}`);
  check(`${tag} no horizontal scroll`, (await hscroll(p)).page <= 0);
  check(`${tag} no JS error`, !p.errors.length, p.errors.join(';'));
  await p.context().close();
}

// 4. Navigation: home -> grid of the day, the logo keeps its place.
for (const w of W) {
  const p = await page(w);
  await p.goto(BASE + '#/');
  await p.waitForTimeout(300);
  const logo = () => p.evaluate(() => { const e = document.querySelector('.brand svg') ?? document.querySelector('.brand'); const q = e.getBoundingClientRect(); return [q.left, q.top, q.width, q.height].map((v) => Math.round(v * 100) / 100); });
  const l0 = await logo();
  await shot(p, `home-${w}`, 'body');
  await tap(p, `a[href$="#/grille/${today}"]`);
  await p.waitForSelector('.board-svg');
  await p.evaluate(() => scrollTo(0, 0));
  await p.waitForTimeout(250);
  const l1 = await logo();
  check(`home -> G${today}@${w}: logo at the same place`, l0.every((v, i) => Math.abs(v - l1[i]) < 0.5), JSON.stringify({ home: l0, grid: l1 }));
  await shot(p, `nav-g${today}-${w}`, 'body');
  await p.context().close();
}

// 5. Off-app SVGs: solved states (ticks), STEP stacks.
if (SVGS) {
  const list = JSON.parse(fs.readFileSync(SVGS, 'utf8'));
  const ctx = await b.newContext({ viewport: { width: 900, height: 900 } });
  const p = await ctx.newPage();
  await p.goto(BASE + '#/');
  let bad = 0;
  for (const it of list) {
    await p.setContent(`<body style="margin:0">${it.svg}</body>`);
    const pr = problems(await p.evaluate(measure));
    if (pr.length) { bad++; check(`render ${it.name}: clues whole and apart`, false, pr.join('; ')); }
    if (/G6 solved cell (30|46)|G7 solved cell (30|46)|G7 solved \+ STEP mode cell 30|G11 solved cell 30/.test(it.name)) await p.locator('svg').screenshot({ path: `${OUT}render-${it.name.replace(/[^a-z0-9]+/gi, '-')}.png` });
  }
  check(`render: ${list.length - bad}/${list.length} off-app boards with clues whole and apart`, !bad);
  await ctx.close();
}

// 6. Paper sheets: PDF and checks on the sheet board.
{
  const ctx = await b.newContext({ viewport: { width: 900, height: 1200 }, deviceScaleFactor: 1.5 });
  const p = await ctx.newPage();
  for (const id of [...new Set([6, 7, 10, today])]) {
    await p.goto(BASE + `#/imprimer/${id}`);
    await p.waitForSelector('.board-svg');
    await p.waitForTimeout(300);
    const m = await p.evaluate(measure);
    const pr = problems(m);
    const above = m.pills.filter((q) => !q.under).length;
    check(`sheet G${id}: ${m.pills.length} pills under the rectangle, none above (${above})`, above === 0, '');
    check(`sheet G${id}: pills whole and apart`, !pr.length, pr.join('; '));
    await p.emulateMedia({ media: 'print' });
    const pdf = await p.pdf({ path: `${OUT}sheet-g${id}.pdf`, format: 'A4', printBackground: true, preferCSSPageSize: true });
    const pages = (pdf.toString('latin1').match(/\/Type\s*\/Page[^s]/g) ?? []).length;
    check(`sheet G${id}: PDF on ${pages} page(s)`, pages >= 1 && pages <= 2, String(pages));
    await p.emulateMedia({ media: 'screen' });
    await shot(p, `sheet-g${id}`, '.a4');
  }
  await ctx.close();
}

await b.close();
fs.writeFileSync(`${OUT}results.json`, JSON.stringify({ today, cells, results }, null, 1));
const ko = results.filter((r) => !r.ok).length;
console.log(`${results.length - ko}/${results.length} OK`);
