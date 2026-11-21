// Ramp checks in a real Chrome at 1280, 375 and 320 px: lay, preview, refuse, erase and solve the
// ramp tutorials (grids 12 and 13), print sheet; captures in docs/reviews/S6.1/.
// Usage: node ramp.mjs [base URL]   (default http://127.0.0.1:4173/dispatch/)
import { chromium } from 'playwright-core';

const BASE = process.argv[2] ?? 'http://127.0.0.1:4173/dispatch/';
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

async function pick(p, key) {
  await p.locator(`[data-piece="${key}"]:visible`).first().click();
}

/** Lay from (row, a) to (row, b): mouse drag on desktop, two taps on touch. */
async function lay(p, touch, row, a, b, { hold = false } = {}) {
  const s = await cellPoint(p, row, a);
  const e = await cellPoint(p, row, b);
  if (touch) {
    await p.touchscreen.tap(s.x, s.y);
    if (a !== b) await p.touchscreen.tap(e.x, e.y);
    return;
  }
  await p.mouse.move(s.x, s.y);
  await p.mouse.down();
  await p.mouse.move((s.x + e.x) / 2, e.y, { steps: 3 });
  await p.mouse.move(e.x, e.y, { steps: 3 });
  if (!hold) await p.mouse.up();
}

const message = (p) => p.locator('.msg-slot').innerText().catch(() => '');
const shot = (p, name, w) => p.screenshot({ path: `${OUT}${name}-${w}.png`, fullPage: true });

const b = await chromium.launch({ executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome' });
for (const w of [1280, 375, 320]) {
  const touch = w < 860;
  const ctx = await b.newContext({ viewport: { width: w, height: 900 }, hasTouch: touch, isMobile: touch, deviceScaleFactor: 2 });
  const p = await ctx.newPage();
  const errors = [];
  p.on('pageerror', (e) => errors.push(String(e)));
  await p.goto(BASE);
  await p.evaluate((k) => localStorage.removeItem(k), KEY);

  // Grid 12 (T1): empty, then a drag in progress (desktop) or the anchor + hover (touch)
  await p.goto(`${BASE}#/grille/12`);
  await p.waitForTimeout(300);
  await shot(p, 'g12-empty', w);
  await pick(p, 'C');
  if (!touch) {
    await lay(p, touch, 1, 0, 2, { hold: true });
    await shot(p, 'g12-drag-preview', w);
    await p.mouse.up();
    say(`${w}: C drag 0h-12h base row 2 -> ${(await message(p)).trim()}`);
  } else {
    await lay(p, touch, 1, 0, 2);
    say(`${w}: C two taps 0h-12h base row 2 -> ${(await message(p)).trim()}`);
  }
  await shot(p, 'g12-ramp-laid', w);

  // A TAC over a plateau cell previews the ramp it would replace
  await pick(p, 'T');
  const pl = await cellPoint(p, 2, 1);
  if (!touch) { await p.mouse.move(pl.x, pl.y); await shot(p, 'g12-tac-over-plateau', w); }

  // Too short: a ramp of 2 is refused with its own message
  await pick(p, 'C');
  await lay(p, touch, 0, 4, 5);
  say(`${w}: C of 2 slots -> ${(await message(p)).trim()}`);

  // Finish T1: reactor 6 on row 1, TAC above the first shoulder, reactor 3 on row 2
  await pick(p, 'N');
  await lay(p, touch, 0, 0, 5);
  say(`${w}: N 6 row 1 -> ${(await message(p)).trim()}`);
  await pick(p, 'T');
  await lay(p, touch, 2, 0, 0);
  await pick(p, 'N');
  await lay(p, touch, 1, 3, 5);
  await p.waitForTimeout(300);
  const solved = await p.locator('.end, .solved, [data-solved="true"]').count();
  say(`${w}: grid 12 after the full solution -> solved markers ${solved}, msg ${(await message(p)).trim().slice(0, 90)}`);
  await shot(p, 'g12-solved', w);

  // Erase: the ramp goes with a tap on a plateau cell
  await p.goto(`${BASE}#/grille/13`);
  await p.waitForTimeout(300);
  await pick(p, 'C');
  await lay(p, touch, 1, 0, 3);
  await lay(p, touch, 2, 3, 6);
  say(`${w}: grid 13 two ramps -> ${(await message(p)).trim()}`);
  await shot(p, 'g13-two-ramps', w);
  await p.locator('[data-tool="erase"]:visible').first().click();
  const e = await cellPoint(p, 3, 4);
  if (touch) await p.touchscreen.tap(e.x, e.y); else await p.mouse.click(e.x, e.y);
  await p.waitForTimeout(200);
  say(`${w}: erase a plateau cell of grid 13 -> ${(await message(p)).trim()}`);
  await shot(p, 'g13-erased', w);

  const over = await p.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
  say(`${w}: horizontal overflow ${over}px, page errors ${errors.length}${errors.length ? `: ${errors.join(' | ')}` : ''}`);
  await ctx.close();
}

// Print sheet of grid 12 (A4, colour) as a screenshot of the print preview
{
  const ctx = await b.newContext({ viewport: { width: 900, height: 1200 }, deviceScaleFactor: 2 });
  const p = await ctx.newPage();
  await p.goto(`${BASE}#/imprimer/12`);
  await p.waitForTimeout(400);
  await p.screenshot({ path: `${OUT}print-g12.png`, fullPage: true });
  await p.pdf({ path: `${OUT}print-g12.pdf`, format: 'A4', printBackground: true }).catch(() => {});
  await ctx.close();
}
await b.close();
console.log('---');
console.log(log.join('\n'));
