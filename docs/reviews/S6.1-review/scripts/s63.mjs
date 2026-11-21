// S6.3 check: the coal ramp in a real Chrome at 1280, 375 and 320 px, after the merges of main and v2-solver.
// - T1 (grid 12): lay, undo, erase on the plateau, undo the erase, too-short preview, solve to the verdict.
// - T4 (grid 13): two ramps in relay, solve to the verdict.
// - No regression: tutorial 6, G7 and G10 start from their saved solution minus one bar; the last bar
//   is laid with the gesture and the verdict must come.
// - Engaged ramp: a second build where T1 with an engaged ramp is grid 14 (ENGAGED_URL), erase refused.
// - No horizontal scroll; page errors counted; print sheets of grid 12 (PNG + PDF) and of the engaged ramp.
// Usage: node s63.mjs [base URL] [engaged build URL]
//   (defaults http://127.0.0.1:4183/dispatch/ and http://127.0.0.1:4184/dispatch/)
import { readFileSync } from 'node:fs';
import { chromium } from 'playwright-core';

const BASE = process.argv[2] ?? 'http://127.0.0.1:4183/dispatch/';
const ENGAGED = process.argv[3] ?? 'http://127.0.0.1:4184/dispatch/';
const OUT = new URL('../after/', import.meta.url).pathname;
const GRIDS = JSON.parse(readFileSync(new URL('../../../../web/src/data/grids.json', import.meta.url), 'utf8'));
const KEY = 'dispatch:progress:v1';
const say = (m) => console.log(m);

async function cellPoint(p, id, row, col) {
  const g = GRIDS.find((x) => x.id === id);
  const v = row + (g ? g.weather.R[col] + g.weather.F[col] : 0);
  return p.evaluate(([v, col]) => {
    const svg = document.querySelector('.board-svg');
    const r = svg.getBoundingClientRect();
    const k = r.width / Number(svg.getAttribute('width'));
    const cell = Number(svg.dataset.cell);
    const rows = Number(svg.dataset.rows);
    const top = Number(svg.dataset.top);
    const lead = Number(svg.dataset.lead);
    return { x: r.left + (2 + lead + col * cell + cell / 2) * k, y: r.top + (top + (rows - 1 - v) * cell + cell / 2) * k };
  }, [v, col]);
}
const pick = (p, key) => p.locator(`[data-piece="${key}"]:visible`).first().click();
const tool = (p, t) => p.locator(`[data-tool="${t}"]:visible`).first().click();
async function tap(p, touch, id, row, col) {
  const c = await cellPoint(p, id, row, col);
  if (touch) await p.touchscreen.tap(c.x, c.y); else await p.mouse.click(c.x, c.y);
  await p.waitForTimeout(120);
}
async function lay(p, touch, id, row, a, b, { hold = false } = {}) {
  const s = await cellPoint(p, id, row, a);
  const e = await cellPoint(p, id, row, b);
  if (touch) {
    await p.touchscreen.tap(s.x, s.y);
    if (a !== b) await p.touchscreen.tap(e.x, e.y);
  } else {
    await p.mouse.move(s.x, s.y);
    await p.mouse.down();
    await p.mouse.move(e.x, e.y, { steps: 6 });
    if (!hold) await p.mouse.up();
  }
  await p.waitForTimeout(150);
}
const msg = async (p) => (await p.locator('.msg-slot').innerText().catch(() => '')).trim().replace(/\s+/g, ' ');
const outlines = (p) => p.evaluate(() => [...document.querySelectorAll('.board-svg path[fill]:not(.preview):not(.replacing)')]
  .filter((e) => e.getAttribute('fill')?.startsWith('#')).length);
const status = (p, id) => p.evaluate(([k, id]) => JSON.parse(localStorage.getItem(k) ?? '{}')?.grids?.[id]?.status ?? null, [KEY, id]);
const verdict = async (p) => (await p.locator('text=Programme bouclé').count()) > 0;
const shot = (p, name, w) => p.screenshot({ path: `${OUT}${name}-${w}.png`, fullPage: true });
const overflow = (p) => p.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
async function open(p, url) {
  await p.goto(url);
  await p.reload();
  await p.waitForTimeout(300);
}

/** Saved board of a grid: its solution minus the last one-row plant bar, returned too. */
function almostSolved(g) {
  const bars = g.solution.placements.map((b) => ({ ...b }));
  let i = bars.length - 1;
  while (i >= 0 && (bars[i].piece === 'I' || (bars[i].height ?? 1) !== 1 || bars[i].len < 2)) i--;
  const last = bars[i];
  const exports = Object.fromEntries(Object.entries(g.solution.exports).map(([k, v]) => [k, [...v]]));
  return { state: { bars: bars.filter((_, k) => k !== i), exports, step: g.solution.step.map((s) => ({ ...s })) }, last };
}

const b = await chromium.launch({ executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome' });
for (const w of [1280, 375, 320]) {
  const touch = w < 860;
  const ctx = await b.newContext({ viewport: { width: w, height: 900 }, hasTouch: touch, isMobile: touch, deviceScaleFactor: 2 });
  const p = await ctx.newPage();
  const errors = [];
  p.on('pageerror', (e) => errors.push(String(e)));
  await p.goto(BASE);
  await p.evaluate((k) => localStorage.removeItem(k), KEY);

  // T1 (grid 12)
  await open(p, `${BASE}#/grille/12`);
  await pick(p, 'C');
  if (!touch) {
    await lay(p, touch, 12, 1, 0, 1, { hold: true });
    await shot(p, 't1-preview-too-short', w);
    await p.mouse.up();
    say(`${w} T1 ramp of 2: ${await msg(p)}`);
  }
  await pick(p, 'C');
  await lay(p, touch, 12, 1, 0, 2);
  say(`${w} T1 lay C 0h-12h base row 2: ${await msg(p)} | outlines ${await outlines(p)}`);
  await shot(p, 't1-laid', w);
  await tool(p, 'undo');
  say(`${w} T1 undo: ${await msg(p)} | outlines ${await outlines(p)}`);
  await pick(p, 'C');
  await lay(p, touch, 12, 1, 0, 2);
  await tool(p, 'erase');
  await tap(p, touch, 12, 2, 1);
  say(`${w} T1 erase on the plateau (row 3, 4h): ${await msg(p)} | outlines ${await outlines(p)}`);
  await shot(p, 't1-erased', w);
  await tool(p, 'undo');
  say(`${w} T1 undo the erase: ${await msg(p)} | outlines ${await outlines(p)}`);
  await pick(p, 'T');
  await tap(p, touch, 12, 2, 1);
  say(`${w} T1 TAC on the plateau: ${await msg(p)}`);
  await shot(p, 't1-tac-on-plateau', w);
  await p.evaluate((k) => localStorage.removeItem(k), KEY);
  await open(p, `${BASE}#/grille/12`);
  await pick(p, 'C'); await lay(p, touch, 12, 1, 0, 2);
  await pick(p, 'N'); await lay(p, touch, 12, 0, 0, 5);
  await pick(p, 'T'); await tap(p, touch, 12, 2, 0);
  await pick(p, 'N'); await lay(p, touch, 12, 1, 3, 5);
  await p.waitForTimeout(300);
  say(`${w} T1 solved: verdict ${await verdict(p)} | status ${await status(p, 12)} | overflow ${await overflow(p)}px`);
  await shot(p, 't1-solved', w);

  // T4 (grid 13)
  await open(p, `${BASE}#/grille/13`);
  await pick(p, 'N'); await lay(p, touch, 13, 0, 0, 3); await pick(p, 'N'); await lay(p, touch, 13, 0, 4, 7);
  await pick(p, 'N'); await lay(p, touch, 13, 1, 4, 7);
  await pick(p, 'C'); await lay(p, touch, 13, 1, 0, 3); await pick(p, 'C'); await lay(p, touch, 13, 2, 3, 6);
  say(`${w} T4 two ramps: ${await msg(p)} | outlines ${await outlines(p)}`);
  await shot(p, 't4-relay', w);
  await pick(p, 'T'); await tap(p, touch, 13, 2, 0);
  await p.waitForTimeout(300);
  say(`${w} T4 solved: verdict ${await verdict(p)} | status ${await status(p, 13)} | overflow ${await overflow(p)}px`);
  await shot(p, 't4-solved', w);

  // No regression: tutorial 6, G7, G10
  for (const [id, name] of [[6, 'tuto6'], [7, 'g7'], [10, 'g10']]) {
    const g = GRIDS.find((x) => x.id === id);
    const { state, last } = almostSolved(g);
    await p.evaluate(([k, id, state]) => {
      const pr = JSON.parse(localStorage.getItem(k) ?? '{"grids":{}}');
      pr.grids[id] = { status: 'started', state, elapsedMs: 60000 };
      localStorage.setItem(k, JSON.stringify(pr));
    }, [KEY, id, state]);
    await open(p, `${BASE}#/grille/${id}`);
    await shot(p, `${name}-start`, w);
    await pick(p, last.piece);
    await lay(p, touch, id, last.row, last.col, last.col + last.len - 1);
    await p.waitForTimeout(300);
    say(`${w} ${name} last bar ${last.piece} ${last.col}+${last.len} row ${last.row + 1}: verdict ${await verdict(p)} | status ${await status(p, id)} | overflow ${await overflow(p)}px`);
    await shot(p, `${name}-solved`, w);
  }

  // Home and dossier: the two ramp tutorials are listed
  await open(p, `${BASE}#/`);
  say(`${w} home overflow ${await overflow(p)}px`);
  await shot(p, 'home', w);

  // Engaged ramp (second build, grid 14)
  await p.goto(ENGAGED);
  await p.evaluate((k) => localStorage.removeItem(k), KEY);
  await open(p, `${ENGAGED}#/grille/14`);
  await tool(p, 'erase'); await tap(p, touch, 14, 2, 1);
  say(`${w} engaged ramp erase: ${await msg(p)} | overflow ${await overflow(p)}px`);
  await shot(p, 't1-engaged', w);
  say(`${w} page errors ${errors.length}${errors.length ? `: ${errors.join(' | ')}` : ''}`);
  await ctx.close();
}

for (const [url, id, name] of [[BASE, 12, 'print-12'], [BASE, 13, 'print-13'], [ENGAGED, 14, 'print-engaged']]) {
  const ctx = await b.newContext({ viewport: { width: 900, height: 1200 }, deviceScaleFactor: 2 });
  const p = await ctx.newPage();
  await p.goto(`${url}#/imprimer/${id}`);
  await p.waitForTimeout(400);
  await p.screenshot({ path: `${OUT}${name}.png`, fullPage: true });
  await p.emulateMedia({ media: 'print' });
  await p.pdf({ path: `${OUT}${name}.pdf`, format: 'A4', printBackground: true });
  await ctx.close();
}
await b.close();
