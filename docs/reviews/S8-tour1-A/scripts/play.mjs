// S8.1 review: plays every published grid in Chrome at 1280/375/320 px.
// - Per grid: open, lay, erase, undo, reset, then the solution of grids.json (exports, STEP, bars)
//   until the verdict banner; no page scroll, no JS/console error, captures of start and verdict.
// - Usage: vite preview on 127.0.0.1:4672, then `node play.mjs [ids...]`.
import { chromium } from 'playwright-core';
import fs from 'fs';

const BASE = 'http://127.0.0.1:4672/dispatch/';
const OUT = new URL('../', import.meta.url).pathname;
const GRIDS = JSON.parse(fs.readFileSync(new URL('../../../../web/src/data/grids.json', import.meta.url)));
const IDS = process.argv.slice(2).map(Number);
const W = [1280, 375, 320];
const results = [];
const check = (name, ok, detail = '') => {
  results.push({ name, ok: !!ok, detail: ok ? '' : String(detail) });
  console.log(`${ok ? 'OK  ' : 'KO  '} ${name}${!ok && detail ? ' — ' + String(detail).slice(0, 300) : ''}`);
};

const browser = await chromium.launch({ executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome' });

export async function newPage(w) {
  const touch = w < 860;
  const ctx = await browser.newContext({ viewport: { width: w, height: 860 }, hasTouch: touch, isMobile: touch, deviceScaleFactor: 2 });
  const p = await ctx.newPage();
  p.touch = touch; p.errors = [];
  p.on('pageerror', (e) => p.errors.push('pageerror: ' + e.message));
  p.on('console', (m) => { if (m.type() === 'error' || m.type() === 'warning') p.errors.push(`console.${m.type()}: ${m.text()}`); });
  return p;
}

async function tapXY(p, x, y) {
  if (p.touch) await p.touchscreen.tap(x, y); else await p.mouse.click(x, y);
  await p.waitForTimeout(120);
}

/** Screen point of a board cell; scrolls the board so the column is visible. */
async function cellPoint(p, row, col) {
  return p.evaluate(({ row, col }) => {
    const svg = document.querySelector('.board-svg');
    const scroll = document.querySelector('.board-scroll');
    const cell = +svg.dataset.cell, rows = +svg.dataset.rows, lead = +svg.dataset.lead, top = +svg.dataset.top;
    const W = +svg.getAttribute('width'), H = +svg.getAttribute('height');
    let r = svg.getBoundingClientRect();
    const sx = W / r.width, sy = H / r.height;
    const ux = lead + (col + 0.5) * cell;
    const sr = scroll.getBoundingClientRect();
    let x = r.left + (ux + 2) / sx;
    if (x < sr.left + 4 || x > sr.right - 4) { scroll.scrollLeft += x - (sr.left + sr.right) / 2; r = svg.getBoundingClientRect(); x = r.left + (ux + 2) / sx; }
    const uy = (rows - 1 - row + 0.5) * cell;
    let y = r.top + (uy + top) / sy;
    if (y < 0 || y > innerHeight) { window.scrollBy(0, y - innerHeight / 2); r = svg.getBoundingClientRect(); y = r.top + (uy + top) / sy; x = r.left + (ux + 2) / sx; }
    return { x, y };
  }, { row, col });
}

async function select(p, key) {
  const l = p.locator(`[data-piece="${key}"]:visible`).first();
  if (!(await l.count())) return false;
  await l.scrollIntoViewIfNeeded();
  await l.click();
  await p.waitForTimeout(120);
  return true;
}

let WX = null; // weather offset per column of the grid being played (R + F)
async function lay(p, bar) {
  const off = (c) => (WX ? WX[c] ?? 0 : 0);
  const a = await cellPoint(p, bar.row + off(bar.col), bar.col);
  const h = (bar.height ?? 1) - 1;
  if (bar.len === 1 && !h) { await tapXY(p, a.x, a.y); return; }
  if (p.touch) {
    await tapXY(p, a.x, a.y);
    const b = await cellPoint(p, bar.row + h + off(bar.col + bar.len - 1), bar.col + bar.len - 1);
    await tapXY(p, b.x, b.y);
  } else {
    const b = await cellPoint(p, bar.row + h + off(bar.col + bar.len - 1), bar.col + bar.len - 1);
    await p.mouse.move(a.x, a.y); await p.mouse.down();
    await p.mouse.move((a.x + b.x) / 2, b.y, { steps: 4 }); await p.mouse.move(b.x, b.y, { steps: 4 });
    await p.mouse.up(); await p.waitForTimeout(120);
  }
}

async function tool(p, name) {
  const l = p.locator(`.tools [data-tool="${name}"]:visible, .chips [data-tool="${name}"]:visible`).first();
  await l.scrollIntoViewIfNeeded();
  await l.click();
  await p.waitForTimeout(150);
}

const barsOf = (p, id) => p.evaluate((id) => {
  try { const v = JSON.parse(localStorage.getItem('dispatch:progress:v1') || '{}'); const g = (v.grids ?? v)[id]; return g?.state?.bars?.length ?? 0; } catch { return -1; }
}, id);
const msg = (p) => p.evaluate(() => document.querySelector('.msg, [role="status"]')?.textContent?.trim() ?? '');
const hscroll = (p) => p.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
const solvedBanner = (p) => p.evaluate(() => !!document.querySelector('.banner[role="status"]'));

async function tapAct(p, sel) {
  const l = p.locator(sel).first();
  if (!(await l.count())) return false;
  await l.evaluate((e) => e.scrollIntoView({ block: 'center', inline: 'center' }));
  const r = await l.boundingBox();
  await tapXY(p, r.x + r.width / 2, r.y + r.height / 2);
  return true;
}

async function playSolution(p, g) {
  WX = g.columns.map((_, c) => (g.weather?.R?.[c] ?? 0) + (g.weather?.F?.[c] ?? 0));
  const sol = g.solution;
  const published = new Set(g.clues.filter((c) => c.type === 'flow' && c.dir === 'export' && c.value > 0).map((c) => `${c.country}:${c.col}`));
  for (const [cc, arr] of Object.entries(sol.exports ?? {})) {
    for (let c = 0; c < arr.length; c++) {
      if (!arr[c] || (g.inventory.level === 'exact' && published.has(`${cc}:${c}`))) continue;
      await tapAct(p, `.board-svg [data-act="export"][data-country="${cc}"][data-col="${c}"]`);
    }
  }
  for (const pair of sol.step ?? []) {
    await select(p, 'STEP');
    await tapAct(p, `.board-svg [data-act="step-arrow"][data-col="${pair.pump}"]`);
    await tapAct(p, `.board-svg [data-act="step-arrow"][data-col="${pair.turbine}"]`);
  }
  for (const bar of sol.placements) {
    await select(p, bar.piece === 'I' ? `I:${bar.country}` : bar.piece);
    await lay(p, bar);
  }
}

if (!process.env.NOLOOP) {
  for (const w of W) {
    for (const g of GRIDS.filter((x) => !IDS.length || IDS.includes(x.id))) {
      const p = await newPage(w);
      const tag = `G${g.id}@${w}`;
      await p.goto(BASE + '#/');
      await p.evaluate(() => localStorage.clear());
      await p.goto(BASE + `#/grille/${g.id}`);
      await p.waitForSelector('.board-svg');
      await p.waitForTimeout(250);
      check(`${tag} opens, no horizontal scroll`, (await hscroll(p)) <= 0, await hscroll(p));
      await p.screenshot({ path: `${OUT}g${g.id}-start-${w}.png`, fullPage: true });
      // Lay / erase / undo / reset on the first bar of the solution.
      const first = g.solution.placements.find((b) => b.piece !== 'I') ?? g.solution.placements[0];
      await select(p, first.piece === 'I' ? `I:${first.country}` : first.piece);
      await lay(p, first);
      const n1 = await barsOf(p, g.id);
      check(`${tag} lay ${first.piece}${first.len} r${first.row} c${first.col}`, n1 === 1, `bars=${n1} msg=${await msg(p)}`);
      await tool(p, 'erase');
      const pt = await cellPoint(p, first.row, first.col);
      await tapXY(p, pt.x, pt.y);
      const n2 = await barsOf(p, g.id);
      check(`${tag} erase`, n2 === 0, `bars=${n2} msg=${await msg(p)}`);
      await tool(p, 'erase');
      await tool(p, 'undo');
      const n3 = await barsOf(p, g.id);
      check(`${tag} undo restores the bar`, n3 === 1, `bars=${n3}`);
      await tool(p, 'reset');
      const n4 = await barsOf(p, g.id);
      check(`${tag} reset empties`, n4 === 0, `bars=${n4} msg=${await msg(p)}`);
      // Full solution.
      await playSolution(p, g);
      await p.waitForTimeout(250);
      const ok = await solvedBanner(p);
      const n5 = await barsOf(p, g.id);
      check(`${tag} solution -> verdict`, ok, `bars=${n5}/${g.solution.placements.length} msg=${await msg(p)}`);
      check(`${tag} no horizontal scroll after solve`, (await hscroll(p)) <= 0, await hscroll(p));
      await p.evaluate(() => window.scrollTo(0, 0));
      await p.screenshot({ path: `${OUT}g${g.id}-solved-${w}.png`, fullPage: true });
      check(`${tag} no console/JS error`, !p.errors.length, p.errors.join(' | '));
      await p.context().close();
    }
  }
  fs.writeFileSync(`${OUT}play-results.json`, JSON.stringify(results, null, 1));
  console.log(`${results.filter((r) => r.ok).length}/${results.length} OK`);
  await browser.close();
}
