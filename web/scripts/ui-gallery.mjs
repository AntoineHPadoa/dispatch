// UI gallery: captures every view of scripts/ui-gallery/views.mjs from the real game and writes the three gallery pages.
// - Builds the production build (dist/) and the gallery build (published grids + scripts/ui-gallery/grids.json,
//   DISPATCH_GRIDS -> dist-gallery/) and serves both with vite preview. Views on a fictitious grid (901+) use the
//   gallery build, every other view the production build. Each view is replayed in Chrome (playwright-core, deviceScaleFactor 2):
//   web at 1280 px with the mouse, mobile at 375/320 px by touch, paper as the A4 PDF of #/imprimer/<id> rasterised
//   by pdftoppm (WARN and a print-media screenshot of the sheet when pdftoppm is missing or fails).
//   A finger held mid-drag (touch views with `hold … to`) uses CDP Input.dispatchTouchEvent without touchEnd.
// - Writes docs/ui-gallery/{web,mobile,papier}/img/<id>.png and index.html, and the view table of docs/next/ui-gallery.md.
// - Usage (from web/): node scripts/ui-gallery.mjs [--only W-03,M-07] [--skip-build] [--port 4179] (gallery build on port + 1)
//   CHROME=/path/to/chrome overrides the browser. Exit code 1 when a view fails.
import { chromium } from 'playwright-core';
import { spawn, spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { VIEWS, describeActions } from './ui-gallery/views.mjs';
import { renderPage } from './ui-gallery/page.mjs';

const arg = (name, dflt) => {
  const i = process.argv.indexOf(`--${name}`);
  return i > 0 ? process.argv[i + 1] : dflt;
};
const WEB = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const ROOT = path.resolve(WEB, '..');
const OUT = path.join(ROOT, 'docs/ui-gallery');
const DOC = path.join(ROOT, 'docs/next/ui-gallery.md');
const PORT = Number(arg('port', '4179'));
const PROD = `http://127.0.0.1:${PORT}/dispatch/`;
const GALLERY = `http://127.0.0.1:${PORT + 1}/dispatch/`;
const ONLY = (arg('only', '') || '').split(',').filter(Boolean);
const CHROME = process.env.CHROME ?? '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const STORAGE_KEY = 'dispatch:progress:v1';
/** Fixed clock: elapsed times shown by the game do not depend on how fast the script plays. */
const FROZEN_NOW = Date.UTC(2026, 10, 22, 9, 0, 0);

const published = JSON.parse(fs.readFileSync(path.join(WEB, 'src/data/grids.json'), 'utf8'));
const fictive = JSON.parse(fs.readFileSync(path.join(WEB, 'scripts/ui-gallery/grids.json'), 'utf8'));
const GRIDS = [...published, ...fictive];
const gridById = (id) => GRIDS.find((g) => g.id === id);
const isFictive = (id) => fictive.some((g) => g.id === id);

// ---- build and serve
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'ui-gallery-'));
const merged = path.join(tmp, 'grids.json');
fs.writeFileSync(merged, JSON.stringify(GRIDS));
if (!process.argv.includes('--skip-build')) {
  const env = { ...process.env };
  delete env.DISPATCH_GRIDS;
  for (const [name, extra] of [['production', {}], ['gallery', { DISPATCH_GRIDS: merged }]]) {
    const b = spawnSync('npx', ['vite', 'build'], { cwd: WEB, env: { ...env, ...extra }, stdio: 'inherit' });
    if (b.status !== 0) { console.error(`${name} build failed`); process.exit(1); }
  }
}
const servers = [['dist', PORT, PROD], ['dist-gallery', PORT + 1, GALLERY]].map(([dir, port, url]) => ({
  url, proc: spawn('npx', ['vite', 'preview', '--outDir', dir, '--port', String(port), '--strictPort'], { cwd: WEB, stdio: 'ignore', detached: true }),
}));
const stopServer = () => { for (const s of servers) { try { process.kill(-s.proc.pid); } catch { /* already gone */ } } };
process.on('exit', stopServer);
for (const { url } of servers) {
  for (let i = 0; ; i++) {
    try { if ((await fetch(url)).ok) break; } catch { /* not up yet */ }
    if (i > 100) { console.error(`preview server ${url} did not start`); process.exit(1); }
    await new Promise((r) => setTimeout(r, 200));
  }
}

const browser = await chromium.launch({ executablePath: CHROME });

// ---- progress seeds
function boardOf(g, n) {
  return { bars: g.solution.placements.slice(0, n), exports: n === undefined ? g.solution.exports : {}, step: n === undefined ? g.solution.step : [] };
}
function progressFor(view) {
  const p = view.progress;
  if (!p) return null;
  const grids = {};
  for (const id of p.done ?? []) grids[id] = { status: 'done', state: boardOf(gridById(id)), elapsedMs: 754000 };
  for (const [id, n] of Object.entries(p.started ?? {})) grids[id] = { status: 'started', state: boardOf(gridById(Number(id)), n), elapsedMs: 300000 };
  if (p.clock) grids[view.grid] = { status: 'started', state: { bars: [], exports: {}, step: [] }, elapsedMs: 754000 };
  return { grids };
}

async function newPage(view) {
  const touch = view.width !== 'A4' && view.width < 860;
  const width = view.width === 'A4' ? 1280 : view.width;
  const ctx = await browser.newContext({
    viewport: { width, height: touch ? 812 : 800 }, hasTouch: touch, isMobile: touch, deviceScaleFactor: 2, colorScheme: 'light', locale: 'fr-FR',
  });
  const seed = progressFor(view);
  await ctx.addInitScript(({ key, seed, now }) => {
    Date.now = () => now;
    try { localStorage.clear(); if (seed) localStorage.setItem(key, JSON.stringify(seed)); } catch { /* no storage */ }
  }, { key: STORAGE_KEY, seed, now: FROZEN_NOW });
  const p = await ctx.newPage();
  p.touch = touch;
  p.errors = [];
  p.on('pageerror', (e) => p.errors.push(`pageerror: ${e.message}`));
  p.on('console', (m) => { if (m.type() === 'error') p.errors.push(`console.error: ${m.text()}`); });
  return p;
}

// ---- board input (same geometry as scripts/check-ui.mjs)
async function tapXY(p, x, y) {
  if (p.touch) await p.touchscreen.tap(x, y);
  else await p.mouse.click(x, y);
  await p.waitForTimeout(120);
}

function cellPoint(p, row, col) {
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
  if (!(await l.count())) throw new Error(`no visible book entry ${key}`);
  await l.scrollIntoViewIfNeeded();
  await l.click();
  await p.waitForTimeout(120);
}

async function tapAct(p, sel) {
  const l = p.locator(sel).first();
  if (!(await l.count())) throw new Error(`no board control ${sel}`);
  await l.evaluate((e) => e.scrollIntoView({ block: 'center', inline: 'center' }));
  const r = await l.boundingBox();
  await tapXY(p, r.x + r.width / 2, r.y + r.height / 2);
}

/** Lays one bar by its absolute rows (0 at the bottom of the grid, weather included). */
async function lay(p, bar) {
  const a = await cellPoint(p, bar.row, bar.col);
  const h = (bar.height ?? 1) - 1;
  if (bar.len === 1 && !h) return tapXY(p, a.x, a.y);
  const end = bar.col + bar.len - 1;
  if (p.touch) {
    await tapXY(p, a.x, a.y);
    const b = await cellPoint(p, bar.row + h, end);
    return tapXY(p, b.x, b.y);
  }
  const b = await cellPoint(p, bar.row + h, end);
  await p.mouse.move(a.x, a.y);
  await p.mouse.down();
  await p.mouse.move((a.x + b.x) / 2, b.y, { steps: 4 });
  await p.mouse.move(b.x, b.y, { steps: 4 });
  await p.mouse.up();
  await p.waitForTimeout(120);
}

const pieceKey = (bar) => (bar.piece === 'I' ? `I:${bar.country}` : bar.piece);

/** Lays the exports, STEP pairs and placements [0, to) of the reference solution, except `skip`; `swap` exchanges two placements' plants. */
async function laySolution(p, g, { to, swap, skip = [] } = {}) {
  const locked = new Set(g.clues.filter((c) => c.type === 'flow' && c.dir === 'export' && c.value > 0).map((c) => `${c.country}:${c.col}`));
  for (const [country, values] of Object.entries(g.solution.exports ?? {})) {
    for (let c = 0; c < values.length; c++) {
      for (let k = 0; k < values[c]; k++) {
        if (!locked.has(`${country}:${c}`)) await tapAct(p, `.board-svg [data-act="export"][data-country="${country}"][data-col="${c}"]`);
      }
    }
  }
  for (const pair of g.solution.step ?? []) {
    await select(p, 'STEP');
    await tapAct(p, `.board-svg [data-act="step-arrow"][data-col="${pair.pump}"]`);
    await tapAct(p, `.board-svg [data-act="step-arrow"][data-col="${pair.turbine}"]`);
  }
  const bars = g.solution.placements.map((b) => ({ ...b }));
  if (swap) {
    const [i, j] = swap;
    const a = bars[i], b = bars[j];
    [a.piece, a.country, b.piece, b.country] = [b.piece, b.country, a.piece, a.country];
  }
  const engaged = new Set(g.clues.filter((c) => c.type === 'engaged').map((c) => `${c.piece}:${c.row}:${c.col}`));
  for (const bar of bars.slice(0, to ?? bars.length).filter((_, i) => !skip.includes(i))) {
    if (engaged.has(`${bar.piece}:${bar.row}:${bar.col}`)) continue;
    await select(p, pieceKey(bar));
    await lay(p, bar);
  }
}

async function run(p, view) {
  const g = view.grid ? gridById(view.grid) : null;
  for (const a of view.actions ?? []) {
    if (a.t === 'click') { await p.locator(a.sel).first().click(); await p.waitForTimeout(150); }
    else if (a.t === 'select') await select(p, a.piece);
    else if (a.t === 'lay') for (const bar of a.bars) { await select(p, pieceKey(bar)); await lay(p, bar); }
    else if (a.t === 'solution') await laySolution(p, g, a);
    else if (a.t === 'export') await tapAct(p, `.board-svg [data-act="export"][data-country="${a.country}"][data-col="${a.col}"]`);
    else if (a.t === 'stepTap') await tapAct(p, `.board-svg [data-act="step-arrow"][data-col="${a.col}"]`);
    else if (a.t === 'tool') { await p.locator(`.tools [data-tool="${a.name}"]:visible, .chips [data-tool="${a.name}"]:visible`).first().click(); await p.waitForTimeout(120); }
    else if (a.t === 'tapCell') { const c = await cellPoint(p, a.row, a.col); await tapXY(p, c.x, c.y); }
    else if (a.t === 'scrollBoard') {
      await p.evaluate(() => { const s = document.querySelector('.board-scroll'); s.scrollLeft = s.scrollWidth; s.dispatchEvent(new Event('scroll')); });
      await p.waitForTimeout(150);
    } else if (a.t === 'hold') {
      const s = await cellPoint(p, a.from.row, a.from.col);
      if (!a.to) { await tapXY(p, s.x, s.y); continue; }
      const e = await cellPoint(p, a.to.row, a.to.col);
      if (p.touch) {
        // Finger held mid-drag: touchStart then touchMoves, no touchEnd.
        const cdp = await p.context().newCDPSession(p);
        const touch = (type, x, y) => cdp.send('Input.dispatchTouchEvent', { type, touchPoints: [{ x, y, id: 1 }] });
        await touch('touchStart', s.x, s.y);
        for (let k = 1; k <= 8; k++) await touch('touchMove', s.x + ((e.x - s.x) * k) / 8, s.y + ((e.y - s.y) * k) / 8);
        await p.waitForTimeout(150);
        continue;
      }
      await p.mouse.move(s.x, s.y);
      await p.mouse.down();
      await p.mouse.move((s.x + e.x) / 2, e.y, { steps: 4 });
      await p.mouse.move(e.x, e.y, { steps: 4 });
      await p.waitForTimeout(150);
    } else throw new Error(`unknown action ${a.t}`);
  }
}

/** Width and height of a PNG file, from its header. */
function pngSize(file) {
  const b = fs.readFileSync(file);
  return { w: b.readUInt32BE(16), h: b.readUInt32BE(20) };
}

async function capture(view, file) {
  const p = await newPage(view);
  await p.goto(`${view.grid && isFictive(view.grid) ? GALLERY : PROD}${view.route}`);
  await p.waitForLoadState('networkidle');
  await p.evaluate(() => document.fonts.ready);
  await p.waitForTimeout(view.grid && !view.paper ? 300 : 150);
  if (view.route.startsWith('#/grille/')) await p.waitForSelector('.board-svg');
  if (view.paper) {
    await p.emulateMedia({ media: 'print' });
    const pdf = path.join(tmp, `${view.id}.pdf`);
    fs.writeFileSync(pdf, await p.pdf({ format: 'A4', preferCSSPageSize: true, printBackground: true }));
    const r = spawnSync('pdftoppm', ['-png', '-r', '192', '-singlefile', pdf, file.replace(/\.png$/, '')]);
    view.method = r.status === 0 ? 'pdf' : 'print';
    if (view.method === 'print') {
      p.errors.push(`pdftoppm failed (${(r.stderr?.toString() || r.error?.message || `exit ${r.status}`).trim().split('\n')[0]}): print-media screenshot of the sheet instead`);
      await p.locator('#print-root .a4').first().screenshot({ path: file });
    }
    view.footUnique = await p.evaluate(() => /Une seule solution/.test(document.querySelector('#print-root .a4 .foot')?.textContent ?? ''));
  } else {
    await run(p, view);
    if (!view.actions?.some((a) => a.t === 'hold' || a.t === 'scrollBoard')) await p.evaluate(() => window.scrollTo(0, 0));
    await p.waitForTimeout(250);
    await p.screenshot({ path: file, fullPage: true });
  }
  const hscroll = await p.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  const errors = p.errors;
  await p.context().close();
  return { hscroll, errors };
}

// ---- main
let failed = 0;
const pages = {};
for (const [kind, views] of Object.entries(VIEWS)) {
  const dir = path.join(OUT, kind, 'img');
  fs.mkdirSync(dir, { recursive: true });
  pages[kind] = [];
  for (const view of views) {
    const file = path.join(dir, `${view.id}.png`);
    if (!ONLY.length || ONLY.includes(view.id)) {
      try {
        const { hscroll, errors } = await capture(view, file);
        const warn = [hscroll > 0 ? `horizontal scroll ${hscroll}px` : '', ...errors].filter(Boolean);
        console.log(`${warn.length ? 'WARN' : 'OK  '} ${view.id} ${view.route} @${view.width}${warn.length ? ` — ${warn.join(' | ')}` : ''}`);
      } catch (e) {
        failed++;
        console.log(`KO   ${view.id} ${view.route} — ${e.message.split('\n')[0]}`);
        continue;
      }
    }
    if (!fs.existsSync(file)) continue;
    // Capture facts (paper method, sheet foot) live beside the image, so a partial run (--only) keeps them.
    const metaFile = file.replace(/\.png$/, '.json');
    if (view.method) fs.writeFileSync(metaFile, JSON.stringify({ method: view.method, footUnique: view.footUnique }));
    const meta = fs.existsSync(metaFile) ? JSON.parse(fs.readFileSync(metaFile, 'utf8')) : {};
    const g = view.grid ? gridById(view.grid) : null;
    const fict = !!g && isFictive(g.id);
    pages[kind].push({ ...view, ...meta, img: `img/${view.id}.png`, size: pngSize(file), fictive: fict, build: fict ? 'gallery' : 'prod', gridTitle: g ? `${g.id} · ${g.title}` : null, actionsText: describeActions(view) });
  }
  fs.writeFileSync(path.join(OUT, kind, 'index.html'), renderPage(kind, pages[kind]));
}
await browser.close();
stopServer();

// ---- inventory table of docs/next/ui-gallery.md
const row = (v) => `| ${v.id} | ${v.cat} | ${v.gridTitle ? `${v.gridTitle}${v.fictive ? ' (fictive)' : ''}` : '—'} | \`${v.route}\` | ${v.width === 'A4' ? 'A4' : `${v.width} px`} | ${v.actionsText} | ${v.shows} |`;
const table = Object.entries(pages).map(([kind, list]) => `### ${kind}\n\n| Vue | Catégorie | Grille | Route | Largeur | Actions | Ce qu’elle montre |\n|---|---|---|---|---|---|---|\n${list.map(row).join('\n')}`).join('\n\n');
const doc = fs.readFileSync(DOC, 'utf8');
const start = '<!-- views:start -->', end = '<!-- views:end -->';
fs.writeFileSync(DOC, `${doc.slice(0, doc.indexOf(start) + start.length)}\n\n${table}\n\n${doc.slice(doc.indexOf(end))}`);
const count = Object.fromEntries(Object.entries(pages).map(([k, l]) => [k, l.length]));
console.log(`views: ${JSON.stringify(count)}${failed ? `, ${failed} failed` : ''} -> ${OUT}`);
process.exit(failed ? 1 : 0);
