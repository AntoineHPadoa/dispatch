// Browser check of the published game in Chrome (playwright-core), at 1280 px (mouse), 375 and 320 px (touch).
// - Home and dossier: no horizontal page scroll, no JS or console error.
// - Every published grid: opens without horizontal scroll, clue pills whole (inside the board) and apart,
//   the solution of grids.json laid with real clicks/taps until the verdict banner, still no scroll.
// - Tutorial (from 1024 px): the intro grid is played through its script (src/tutorial/script.ts, read
//   by Node's type stripping): every bubble lit on its target, a wrong move refused, the guided moves
//   accepted, the end opens the next grid; on the other tutorial grids the discovery bubbles show
//   and close, then the solution is laid as usual. Below 1024 px no bubble shows. The home
//   « Tutoriel » button opens the intro.
// - Print: one A4 page per grid published today (#/imprimer/tout).
// - Captures (start and verdict of each grid, home) and results.json go to the output folder.
// - Usage (from web/): npm run build && npm run preview -- --port 4173 --strictPort, then
//     node scripts/check-ui.mjs [--base http://127.0.0.1:4173/dispatch/] [--out /tmp/check-ui] [--ids 3,7] [--widths 1280,375]
//   CHROME=/path/to/chrome overrides the browser. Exit code 1 when a check fails.
import { chromium } from 'playwright-core';
import fs from 'node:fs';
import path from 'node:path';
import { TUTORIAL_SCRIPTS } from '../src/tutorial/script.ts';

const TUTORIAL_MIN_WIDTH = 1024;

const arg = (name, dflt) => {
  const i = process.argv.indexOf(`--${name}`);
  return i > 0 ? process.argv[i + 1] : dflt;
};
const BASE = arg('base', 'http://127.0.0.1:4173/dispatch/');
const OUT = path.resolve(arg('out', '/tmp/check-ui'));
const IDS = (arg('ids', '') || '').split(',').filter(Boolean).map(Number);
const WIDTHS = (arg('widths', '1280,375,320')).split(',').map(Number);
const CHROME = process.env.CHROME ?? '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const GRIDS = JSON.parse(fs.readFileSync(new URL('../src/data/grids.json', import.meta.url)));
fs.mkdirSync(OUT, { recursive: true });

const results = [];
const check = (name, ok, detail = '') => {
  results.push({ name, ok: !!ok, detail: ok ? '' : String(detail) });
  console.log(`${ok ? 'OK  ' : 'KO  '} ${name}${!ok && detail ? ` — ${String(detail).slice(0, 300)}` : ''}`);
};

const browser = await chromium.launch({ executablePath: CHROME });

async function newPage(w) {
  const touch = w < 860;
  const ctx = await browser.newContext({ viewport: { width: w, height: 860 }, hasTouch: touch, isMobile: touch, deviceScaleFactor: 2 });
  const p = await ctx.newPage();
  p.touch = touch;
  p.errors = [];
  p.on('pageerror', (e) => p.errors.push(`pageerror: ${e.message}`));
  p.on('console', (m) => { if (m.type() === 'error') p.errors.push(`console.error: ${m.text()}`); });
  return p;
}

const hscroll = (p) => p.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
const banner = (p) => p.evaluate(() => !!document.querySelector('.banner[role="status"]'));
const message = (p) => p.evaluate(() => document.querySelector('.msg, [role="status"]')?.textContent?.trim() ?? '');

async function tapXY(p, x, y) {
  if (p.touch) await p.touchscreen.tap(x, y);
  else await p.mouse.click(x, y);
  await p.waitForTimeout(100);
}

/** Screen point of a board cell (row from the bottom, weather rows included); scrolls it into view. */
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
  if (!(await l.count())) return;
  await l.scrollIntoViewIfNeeded();
  await l.click();
  await p.waitForTimeout(100);
}

async function tapAct(p, sel) {
  const l = p.locator(sel).first();
  if (!(await l.count())) return;
  await l.evaluate((e) => e.scrollIntoView({ block: 'center', inline: 'center' }));
  const r = await l.boundingBox();
  await tapXY(p, r.x + r.width / 2, r.y + r.height / 2);
}

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
  await p.waitForTimeout(100);
}

/** Lays the reference solution: exports, STEP pairs, then every bar (rows are absolute, weather included). */
async function playSolution(p, g) {
  const locked = new Set(g.clues.filter((c) => c.type === 'flow' && c.dir === 'export' && c.value > 0).map((c) => `${c.country}:${c.col}`));
  for (const [country, values] of Object.entries(g.solution.exports ?? {})) {
    for (let c = 0; c < values.length; c++) {
      if (values[c] && !(g.inventory.level === 'exact' && locked.has(`${country}:${c}`))) {
        await tapAct(p, `.board-svg [data-act="export"][data-country="${country}"][data-col="${c}"]`);
      }
    }
  }
  for (const pair of g.solution.step ?? []) {
    await select(p, 'STEP');
    await tapAct(p, `.board-svg [data-act="step-arrow"][data-col="${pair.pump}"]`);
    await tapAct(p, `.board-svg [data-act="step-arrow"][data-col="${pair.turbine}"]`);
  }
  for (const bar of g.solution.placements) {
    await select(p, bar.piece === 'I' ? `I:${bar.country}` : bar.piece);
    await lay(p, bar);
  }
}

const tut = (p) => p.evaluate(() => {
  const layer = document.querySelector('.tut');
  return {
    showing: !!layer && !layer.hidden,
    eyebrow: document.querySelector('.tut-eyebrow')?.textContent ?? '',
    lit: (document.querySelector('.tut-ring')?.getAttribute('d') ?? '') !== '',
    refused: document.querySelector('.tut-refused:not([hidden])')?.textContent ?? '',
    bubbleInside: (() => { const r = document.querySelector('.tut-bubble')?.getBoundingClientRect(); return !r || (r.left >= 0 && r.top >= 0 && r.right <= innerWidth && r.bottom <= innerHeight); })(),
    replay: !!document.querySelector('[data-tool="replay"]') && !document.querySelector('[data-tool="replay"]').hidden && getComputedStyle(document.querySelector('[data-tool="replay"]')).display !== 'none',
  };
});

/** Present steps: lit on their target, bubble on screen, then « Suivant ». */
async function presentStep(p, tag, k, st) {
  const t = await tut(p);
  check(`${tag} step ${k + 1} shows its bubble inside the window`, t.showing && t.bubbleInside, JSON.stringify(t));
  if (st.target) check(`${tag} step ${k + 1} lights its target`, t.lit, JSON.stringify(st.target));
}

/** Walks the intro script: present steps by « Suivant », guided steps by their moves (one wrong move refused). */
async function playIntro(p, g, script) {
  const tag = `intro G${g.id}`;
  let wrongTried = false;
  for (const [k, st] of script.steps.entries()) {
    await presentStep(p, tag, k, st);
    if (k === 1) await p.screenshot({ path: `${OUT}/tutorial-intro-present-1280.png` });
    if (st.kind === 'present') {
      if (k === script.steps.length - 1) await p.screenshot({ path: `${OUT}/tutorial-intro-end-1280.png` });
      await p.click('.tut-next');
      await p.waitForTimeout(150);
      continue;
    }
    if (!wrongTried) {
      wrongTried = true;
      const m = st.moves[0].bar;
      await select(p, m.piece);
      const board = () => p.evaluate(() => localStorage.getItem('dispatch:progress:v1'));
      const before = await board();
      // Same plant, shifted one slot: a legal pose the step does not expect.
      await lay(p, { ...m, col: m.col + m.len < g.columns.length ? m.col + 1 : m.col - 1 });
      const t = await tut(p);
      check(`${tag} a wrong move is refused, the board unchanged`, !!t.refused
        && before === await board(), t.refused);
      await p.screenshot({ path: `${OUT}/tutorial-intro-refused-1280.png` });
    }
    const before = (await tut(p)).eyebrow;
    for (const m of st.moves) {
      if (m.action !== 'place') { check(`${tag} step ${k + 1}: only place moves are walked`, false, m.action); continue; }
      await select(p, m.bar.piece === 'I' ? `I:${m.bar.country}` : m.bar.piece);
      await lay(p, m.bar);
    }
    const t = await tut(p);
    check(`${tag} step ${k + 1}: the guided moves are accepted, the next step opens`, !t.refused && t.eyebrow !== before, `${before} -> ${t.eyebrow} ${t.refused}`);
  }
  await p.waitForTimeout(300);
  check(`${tag} the end opens grid ${script.next}`, p.url().endsWith(`#/grille/${script.next}`), p.url());
}

/** Clue pills (rect h=18 rx=9): inside the board and not overlapping each other. */
const pillProblems = (p) => p.evaluate(() => {
  const svg = document.querySelector('.board-svg');
  const s = svg.getBoundingClientRect();
  const pills = [...svg.querySelectorAll('rect[height="18"][rx="9"]')].map((r) => r.getBoundingClientRect());
  const out = [];
  pills.forEach((b, i) => {
    if (b.left < s.left - 0.5 || b.right > s.right + 0.5 || b.top < s.top - 0.5 || b.bottom > s.bottom + 0.5) out.push(`pill ${i} cut`);
    pills.slice(i + 1).forEach((o, j) => {
      if (b.left < o.right - 0.5 && o.left < b.right - 0.5 && b.top < o.bottom - 0.5 && o.top < b.bottom - 0.5) out.push(`pills ${i}/${i + j + 1} overlap`);
    });
  });
  return out;
});

const today = new Date().toISOString().slice(0, 10);
const published = GRIDS.filter((g) => !g.bulletin || g.bulletin.published <= today);

for (const w of WIDTHS) {
  const p = await newPage(w);
  await p.goto(`${BASE}#/`);
  await p.evaluate(() => localStorage.clear());
  await p.reload();
  await p.waitForSelector('.home');
  check(`home@${w} no horizontal scroll`, (await hscroll(p)) <= 0, await hscroll(p));
  await p.screenshot({ path: `${OUT}/home-${w}.png`, fullPage: true });
  const tutoBtn = await p.locator('[data-tutorial-open]').isVisible();
  const howTo = await p.locator('[data-rules]').isVisible();
  check(`home@${w} ${w >= TUTORIAL_MIN_WIDTH ? '« Tutoriel » shown, « Comment jouer » hidden' : '« Comment jouer » shown, « Tutoriel » hidden'}`,
    w >= TUTORIAL_MIN_WIDTH ? tutoBtn && !howTo : howTo && !tutoBtn, `tutoriel ${tutoBtn}, comment jouer ${howTo}`);
  if (w >= TUTORIAL_MIN_WIDTH) {
    await p.click('[data-tutorial-open]');
    await p.waitForSelector('.board-svg');
    await p.waitForTimeout(300);
    const intro = Object.values(TUTORIAL_SCRIPTS).find((x) => x.kind === 'intro');
    check(`home@${w} « Tutoriel » opens the intro grid with its first bubble`, p.url().endsWith(`#/grille/${intro.gridId}`) && (await tut(p)).showing, p.url());
  }
  await p.goto(`${BASE}#/dossier/premiers-pas`);
  await p.waitForTimeout(200);
  check(`dossier@${w} no horizontal scroll`, (await hscroll(p)) <= 0, await hscroll(p));
  check(`home@${w} no JS or console error`, !p.errors.length, p.errors.join(' | '));
  await p.context().close();

  for (const g of published.filter((x) => !IDS.length || IDS.includes(x.id))) {
    const tag = `G${g.id}@${w}`;
    const q = await newPage(w);
    await q.goto(`${BASE}#/`);
    await q.evaluate(() => localStorage.clear());
    await q.goto(`${BASE}#/grille/${g.id}`);
    await q.waitForSelector('.board-svg');
    await q.waitForTimeout(200);
    check(`${tag} opens without horizontal scroll`, (await hscroll(q)) <= 0, await hscroll(q));
    const pills = await pillProblems(q);
    check(`${tag} clue pills whole and apart`, !pills.length, pills.join(', '));
    await q.screenshot({ path: `${OUT}/g${g.id}-start-${w}.png`, fullPage: true });
    const script = TUTORIAL_SCRIPTS[g.id];
    if (script && w < TUTORIAL_MIN_WIDTH) {
      const t = await tut(q);
      check(`${tag} no tutorial bubble below ${TUTORIAL_MIN_WIDTH} px`, !t.showing && !t.replay, JSON.stringify(t));
    }
    if (script && w >= TUTORIAL_MIN_WIDTH && script.kind === 'intro') {
      await playIntro(q, g, script);
      await q.goto(`${BASE}#/grille/${g.id}`);
      await q.waitForSelector('.board-svg');
      await q.waitForTimeout(200);
      check(`${tag} after the intro: solved, no bubble, « Revoir le tutoriel » offered`, (await banner(q)) && !(await tut(q)).showing && (await tut(q)).replay, JSON.stringify(await tut(q)));
      check(`${tag} no JS or console error`, !q.errors.length, q.errors.join(' | '));
      await q.context().close();
      continue;
    }
    if (script && w >= TUTORIAL_MIN_WIDTH) {
      for (const [k, st] of script.steps.entries()) {
        await presentStep(q, `${tag} discovery`, k, st);
        if (k === 0) await q.screenshot({ path: `${OUT}/tutorial-discovery-g${g.id}-1280.png` });
        await q.click('.tut-next');
        await q.waitForTimeout(150);
      }
      const t = await tut(q);
      check(`${tag} discovery closed, « Revoir l'explication » offered`, !t.showing && t.replay, JSON.stringify(t));
    }
    await playSolution(q, g);
    await q.waitForTimeout(200);
    check(`${tag} solution -> verdict`, await banner(q), await message(q));
    check(`${tag} no horizontal scroll after the verdict`, (await hscroll(q)) <= 0, await hscroll(q));
    await q.evaluate(() => window.scrollTo(0, 0));
    await q.screenshot({ path: `${OUT}/g${g.id}-solved-${w}.png`, fullPage: true });
    check(`${tag} no JS or console error`, !q.errors.length, q.errors.join(' | '));
    await q.context().close();
  }
}

{
  const p = await newPage(1280);
  await p.goto(`${BASE}#/imprimer/tout`);
  await p.waitForTimeout(500);
  await p.emulateMedia({ media: 'print' });
  const pdf = await p.pdf({ format: 'A4', preferCSSPageSize: true });
  fs.writeFileSync(`${OUT}/print-all.pdf`, pdf);
  const pages = (pdf.toString('latin1').match(/\/Type\s*\/Page[^s]/g) ?? []).length;
  check(`print: one A4 page per published grid (${published.length})`, pages === published.length, `${pages} pages`);
  await p.context().close();
}

fs.writeFileSync(`${OUT}/results.json`, JSON.stringify(results, null, 1));
const ko = results.filter((r) => !r.ok).length;
console.log(`${results.length - ko}/${results.length} OK -> ${OUT}`);
await browser.close();
process.exit(ko ? 1 : 0);
