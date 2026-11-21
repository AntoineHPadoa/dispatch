import { chromium } from 'playwright-core';
export const BASE = 'http://127.0.0.1:4391/dispatch/';
export const OUT = '/Users/padoa/Programs/spot-elec-wt/v2-ui/docs/reviews/S3';
export const results = [];
export function check(name, ok, detail = '') { results.push({ name, ok: !!ok, detail }); console.log(`${ok ? 'OK  ' : 'FAIL'} ${name}${detail ? ' — ' + detail : ''}`); }
export async function launch() { return chromium.launch({ executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome' }); }
export async function open(browser, width, grid, { touch = width < 860, height = 900 } = {}) {
  const ctx = await browser.newContext({ viewport: { width, height }, hasTouch: touch, isMobile: touch, deviceScaleFactor: 2 });
  const p = await ctx.newPage();
  p.errors = [];
  p.on('pageerror', (e) => p.errors.push(e.message));
  p.touch = touch;
  await p.goto(BASE + '#/grille/' + grid);
  await p.evaluate(() => localStorage.clear());
  await p.reload();
  await p.waitForSelector('.board-svg');
  await p.waitForTimeout(200);
  return p;
}
export const msg = (p) => p.textContent('.msg-slot').then((t) => t.trim());
export const progress = (p, id) => p.evaluate((id) => JSON.parse(localStorage.getItem('dispatch:progress:v1') || '{}').grids?.[id]?.state ?? null, String(id));
export const count = (p, sel) => p.$$eval(sel, (e) => e.length);
export async function hit(p, sel) {
  const l = p.locator(sel).first();
  if (p.touch) { await l.scrollIntoViewIfNeeded(); const b = await l.boundingBox(); if (!b) throw new Error('no box ' + sel); await p.touchscreen.tap(b.x + b.width / 2, b.y + b.height / 2); }
  else await l.click();
  await p.waitForTimeout(80);
}
/** Client coordinates of a cell centre (row from the bottom, counted with weather offset 0). */
export async function cellXY(p, row, col) {
  return p.evaluate(([row, col]) => {
    const svg = document.querySelector('.board-svg');
    const sc = document.querySelector('.board-scroll');
    const cell = +svg.dataset.cell, rows = +svg.dataset.rows, top = +svg.dataset.top;
    const want = col * cell;
    if (want < sc.scrollLeft || want + cell > sc.scrollLeft + sc.clientWidth) sc.scrollLeft = Math.max(0, want - 10);
    const r = svg.getBoundingClientRect();
    const sx = +svg.getAttribute('width') / r.width, sy = +svg.getAttribute('height') / r.height;
    return { x: r.left + (col * cell + cell / 2 + 2) / sx, y: r.top + (top + (rows - 1 - row) * cell + cell / 2) / sy };
  }, [row, col]);
}
export async function tapCell(p, row, col) {
  const { x, y } = await cellXY(p, row, col);
  if (p.touch) await p.touchscreen.tap(x, y); else await p.mouse.click(x, y);
  await p.waitForTimeout(80);
}
export async function rightClickCell(p, row, col) { const { x, y } = await cellXY(p, row, col); await p.mouse.click(x, y, { button: 'right' }); await p.waitForTimeout(80); }
/** Lay a bar from (row,col) over len columns: drag with the mouse, two taps on touch. */
export async function lay(p, row, col, len) {
  if (p.touch) { await tapCell(p, row, col); if (len > 1) await tapCell(p, row, col + len - 1); return; }
  const a = await cellXY(p, row, col), b = await cellXY(p, row, col + len - 1);
  await p.mouse.move(a.x, a.y); await p.mouse.down(); await p.mouse.move(b.x, b.y, { steps: 6 }); await p.mouse.up();
  await p.waitForTimeout(80);
}
export async function choose(p, key) { await hit(p, p.touch ? `.chips [data-piece="${key}"]` : `.side [data-piece="${key}"]`); }
export async function tool(p, name) {
  if (name === 'erase' && p.touch) return hit(p, '.chips .erase-chip');
  return hit(p, `.tools [data-tool="${name}"]`);
}
export async function hscroll(p) { return p.evaluate(() => document.documentElement.scrollWidth - window.innerWidth); }
