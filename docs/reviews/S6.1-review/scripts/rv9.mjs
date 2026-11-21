// S6.1 review: the coal ramp in a real Chrome at 1280, 375 and 320 px.
// - Needs a build where the study grids T1, T3, T4 are grids 12, 13, 14 and T1 with an engaged
//   ramp is grid 15 (added locally to grids.json, not committed).
// - Lays, undoes, erases and replaces ramps, solves T1 and T4, prints grids 12 and 15.
// Usage: node rv9.mjs [base URL]   (default http://127.0.0.1:4179/dispatch/)
import { chromium } from 'playwright-core';

const BASE = process.argv[2] ?? 'http://127.0.0.1:4179/dispatch/';
const OUT = new URL('../', import.meta.url).pathname;
const KEY = 'dispatch:progress:v1';
const log = [];
const say = (m) => { console.log(m); log.push(m); };

async function cellPoint(p, row, col) {
  return p.evaluate(([row, col]) => {
    const svg = document.querySelector('.board-svg');
    const r = svg.getBoundingClientRect();
    const k = r.width / Number(svg.getAttribute('width'));
    const cell = Number(svg.dataset.cell);
    const rows = Number(svg.dataset.rows);
    const top = Number(svg.dataset.top);
    return { x: r.left + (2 + col * cell + cell / 2) * k, y: r.top + (top + (rows - 1 - row) * cell + cell / 2) * k };
  }, [row, col]);
}
const pick = (p, key) => p.locator(`[data-piece="${key}"]:visible`).first().click();
const tool = (p, t) => p.locator(`[data-tool="${t}"]:visible`).first().click();
async function tap(p, touch, row, col) {
  const c = await cellPoint(p, row, col);
  if (touch) await p.touchscreen.tap(c.x, c.y); else await p.mouse.click(c.x, c.y);
  await p.waitForTimeout(120);
}
async function lay(p, touch, row, a, b, { hold = false } = {}) {
  const s = await cellPoint(p, row, a);
  const e = await cellPoint(p, row, b);
  if (touch) {
    await p.touchscreen.tap(s.x, s.y);
    if (a !== b) await p.touchscreen.tap(e.x, e.y);
  } else {
    await p.mouse.move(s.x, s.y);
    await p.mouse.down();
    await p.mouse.move(e.x, e.y, { steps: 6 });
    if (!hold) await p.mouse.up();
  }
  await p.waitForTimeout(120);
}
const msg = async (p) => (await p.locator('.msg-slot').innerText().catch(() => '')).trim().replace(/\s+/g, ' ');
const ramps = (p) => p.evaluate(() => document.querySelectorAll('.board-svg path[fill]:not(.preview):not(.replacing)').length);
const status = (p, id) => p.evaluate(([k, id]) => JSON.parse(localStorage.getItem(k) ?? '{}')?.grids?.[id]?.status ?? JSON.parse(localStorage.getItem(k) ?? '{}')?.[id]?.status ?? null, [KEY, id]);
const shot = (p, name, w) => p.screenshot({ path: `${OUT}${name}-${w}.png`, fullPage: true });
const overflow = (p) => p.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);

const b = await chromium.launch({ executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome' });
for (const w of [1280, 375, 320]) {
  const touch = w < 860;
  const ctx = await b.newContext({ viewport: { width: w, height: 900 }, hasTouch: touch, isMobile: touch, deviceScaleFactor: 2 });
  const p = await ctx.newPage();
  const errors = [];
  p.on('pageerror', (e) => errors.push(String(e)));
  await p.goto(BASE);
  await p.evaluate((k) => localStorage.removeItem(k), KEY);

  // T1 (grid 12): lay, undo, lay again, erase on the plateau, undo the erase
  await p.goto(`${BASE}#/grille/12`);
  await p.waitForTimeout(300);
  await pick(p, 'C');
  if (!touch) {
    await lay(p, touch, 1, 0, 1, { hold: true });
    await shot(p, 't1-preview-too-short', w);
    await p.mouse.up();
    say(`${w} T1 ramp of 2: ${await msg(p)}`);
  }
  await lay(p, touch, 1, 0, 2);
  say(`${w} T1 lay C 0h-12h base row 2: ${await msg(p)} | outlines ${await ramps(p)}`);
  await shot(p, 't1-laid', w);
  await tool(p, 'undo');
  say(`${w} T1 undo: ${await msg(p)} | outlines ${await ramps(p)}`);
  await pick(p, 'C');
  await lay(p, touch, 1, 0, 2);
  await tool(p, 'erase');
  await tap(p, touch, 2, 1);
  say(`${w} T1 erase plateau cell (row 3, 4h): ${await msg(p)} | outlines ${await ramps(p)}`);
  await shot(p, 't1-erased', w);
  await tool(p, 'undo');
  say(`${w} T1 undo erase: ${await msg(p)} | outlines ${await ramps(p)}`);
  // Erase tool still on? leave it by picking a piece
  await pick(p, 'T');
  await tap(p, touch, 2, 1);
  say(`${w} T1 TAC on the plateau (place over): ${await msg(p)}`);
  await shot(p, 't1-tac-on-plateau', w);
  // TAC over the plateau either replaced the ramp or was refused; reset to a known state
  await p.evaluate((k) => localStorage.removeItem(k), KEY);
  await p.goto(`${BASE}#/grille/12`); await p.reload(); await p.waitForTimeout(300);
  await pick(p, 'C'); await lay(p, touch, 1, 0, 2);
  await pick(p, 'N'); await lay(p, touch, 0, 0, 5);
  await pick(p, 'T'); await tap(p, touch, 2, 0);
  await pick(p, 'N'); await lay(p, touch, 1, 3, 5);
  await p.waitForTimeout(300);
  say(`${w} T1 full solution: ${await msg(p)} | status ${await status(p, 12)}`);
  await shot(p, 't1-solved', w);
  say(`${w} T1 overflow ${await overflow(p)}px`);

  // T3 (grid 13): ramp on row 1 from 8h, ribbon on row 3 stops against the plateau
  await p.goto(`${BASE}#/grille/13`);
  await p.waitForTimeout(300);
  await pick(p, 'C'); await lay(p, touch, 0, 2, 5);
  say(`${w} T3 C 8h-24h row 1: ${await msg(p)}`);
  await pick(p, 'N'); await lay(p, touch, 2, 1, 4);
  say(`${w} T3 N row 3 4h-20h across the plateau: ${await msg(p)}`);
  await shot(p, 't3-plateau-blocks', w);

  // T4 (grid 14): two ramps in relay, then the full solution
  await p.goto(`${BASE}#/grille/14`);
  await p.waitForTimeout(300);
  await pick(p, 'N'); await lay(p, touch, 0, 0, 3); await lay(p, touch, 0, 4, 7); await lay(p, touch, 1, 4, 7);
  await pick(p, 'C'); await lay(p, touch, 1, 0, 3); await lay(p, touch, 2, 3, 6);
  say(`${w} T4 two ramps: ${await msg(p)} | outlines ${await ramps(p)}`);
  await pick(p, 'T'); await tap(p, touch, 2, 0);
  await p.waitForTimeout(300);
  say(`${w} T4 full solution: ${await msg(p)} | status ${await status(p, 14)}`);
  await shot(p, 't4-solved', w);
  say(`${w} T4 overflow ${await overflow(p)}px`);

  // Engaged ramp (grid 15): locked, cannot be erased
  await p.goto(`${BASE}#/grille/15`);
  await p.waitForTimeout(300);
  await tool(p, 'erase'); await tap(p, touch, 2, 1);
  say(`${w} engaged ramp erase: ${await msg(p)}`);
  await shot(p, 't1-engaged', w);
  say(`${w} page errors ${errors.length}${errors.length ? `: ${errors.join(' | ')}` : ''}`);
  await ctx.close();
}

for (const id of [12, 15]) {
  const ctx = await b.newContext({ viewport: { width: 900, height: 1200 }, deviceScaleFactor: 2 });
  const p = await ctx.newPage();
  await p.goto(`${BASE}#/imprimer/${id}`);
  await p.waitForTimeout(400);
  await p.screenshot({ path: `${OUT}print-${id}.png`, fullPage: true });
  await p.emulateMedia({ media: 'print' });
  await p.pdf({ path: `${OUT}print-${id}.pdf`, format: 'A4', printBackground: true });
  await ctx.close();
}
await b.close();
