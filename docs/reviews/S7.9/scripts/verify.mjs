// S7.9 check: clue card (every clue in text, time order, states) and header spacing, in Chrome.
// - Needs `vite preview --port 4631 --strictPort` on the v2-clues build and playwright-core (npm i here).
// - Plays G7, G10 and the daily grid (11 on 2026-11-21) at 1280, 375 and 320 px.
// - Usage: node verify.mjs  → OK/FAIL lines, results.json and captures in docs/reviews/S7.9/.
import { chromium } from 'playwright-core';
import fs from 'fs';

const BASE = 'http://127.0.0.1:4631/dispatch/';
const OUT = new URL('../', import.meta.url).pathname;
const GRIDS = JSON.parse(fs.readFileSync(new URL('../../../../web/src/data/grids.json', import.meta.url)));
const KIND = { price: 'Prix', bar: 'Programme', length: 'Durée de marche', column: 'Relevé', flow: 'Flux', exchanges: 'Échanges du jour', engaged: 'Déjà engagée' };
const results = [];
const check = (name, ok, detail = '') => { results.push({ name, ok: !!ok, detail }); console.log(`${ok ? 'OK  ' : 'FAIL'} ${name}${detail ? ' — ' + detail : ''}`); };
const fakeDate = (iso) => `(()=>{const R=Date,off=new R('${iso}T10:00:00').getTime()-R.now();class D extends R{constructor(...a){a.length?super(...a):super(R.now()+off)} static now(){return R.now()+off}};window.Date=D;})()`;
const wait = (p, ms = 250) => p.waitForTimeout(ms);
const over = (p) => p.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
const logo = (p) => p.evaluate(() => { const r = document.querySelector('.brand svg')?.getBoundingClientRect(); return r ? `${r.left.toFixed(1)},${r.top.toFixed(1)}` : null; });

async function page(b, w) {
  const touch = w < 860;
  const ctx = await b.newContext({ viewport: { width: w, height: 900 }, hasTouch: touch, isMobile: touch, deviceScaleFactor: 2 });
  await ctx.addInitScript(fakeDate('2026-11-21'));
  const p = await ctx.newPage();
  p.errors = []; p.touch = touch; p.w = w;
  p.on('pageerror', (e) => p.errors.push(e.message));
  await p.goto(BASE + '#/');
  await p.evaluate(() => localStorage.clear());
  await p.reload(); await wait(p);
  return p;
}
async function hit(p, sel) {
  const l = p.locator(sel).first();
  if (p.touch) { await l.scrollIntoViewIfNeeded(); const r = await l.boundingBox(); await p.touchscreen.tap(r.x + r.width / 2, r.y + r.height / 2); }
  else await l.click();
  await wait(p, 120);
}
async function cellXY(p, row, col) {
  return p.evaluate(([row, col]) => {
    const svg = document.querySelector('.board-svg'), sc = document.querySelector('.board-scroll');
    const cell = +svg.dataset.cell, rows = +svg.dataset.rows, top = +svg.dataset.top;
    const want = col * cell;
    if (want < sc.scrollLeft || want + cell > sc.scrollLeft + sc.clientWidth) sc.scrollLeft = Math.max(0, want - 10);
    const r = svg.getBoundingClientRect(), sx = +svg.getAttribute('width') / r.width, sy = +svg.getAttribute('height') / r.height;
    return { x: r.left + (col * cell + cell / 2 + 2) / sx, y: r.top + (top + (rows - 1 - row) * cell + cell / 2) / sy };
  }, [row, col]);
}
async function tapCell(p, row, col) { const { x, y } = await cellXY(p, row, col); if (p.touch) await p.touchscreen.tap(x, y); else await p.mouse.click(x, y); await wait(p, 80); }
async function lay(p, row, col, len) {
  await p.locator('.board-svg').first().scrollIntoViewIfNeeded();
  if (p.touch) { await tapCell(p, row, col); if (len > 1) await tapCell(p, row, col + len - 1); return; }
  const a = await cellXY(p, row, col), z = await cellXY(p, row, col + len - 1);
  await p.mouse.move(a.x, a.y); await p.mouse.down(); await p.mouse.move(z.x, z.y, { steps: 6 }); await p.mouse.up(); await wait(p, 80);
}
const choose = (p, k) => hit(p, p.touch ? `.chips [data-piece="${k}"]` : `.side [data-piece="${k}"]`);

/** Expected list: day clues (no slot) first, then by column, grid order on ties. */
const expected = (g) => g.clues.map((c, i) => ({ c, i })).sort((a, b) => (a.c.col ?? -1) - (b.c.col ?? -1) || a.i - b.i).map(({ c }) => KIND[c.type]);
const card = (p) => p.evaluate(() => {
  const s = [...document.querySelectorAll('.game section.card')].find((e) => e.querySelector('.clues'));
  if (!s) return null;
  return {
    title: s.querySelector('h2')?.textContent.trim().replace(/\s+/g, ' '),
    details: s.querySelectorAll('details').length,
    items: [...s.querySelectorAll('li.clue')].map((li) => ({ kind: li.querySelector('.kind')?.textContent.trim(), txt: li.querySelector('.txt')?.textContent.trim(), st: li.querySelector('.state')?.getAttribute('aria-label') ?? null })),
  };
});
const layout = (p) => p.evaluate(() => {
  const q = (s) => document.querySelector(s)?.getBoundingClientRect();
  const head = q('.game > .site-head'), next = document.querySelector('.game > .site-head')?.nextElementSibling;
  const n = next?.getBoundingClientRect();
  const side = q('.game > .side'), play = q('.game > .play'), ttl = q('.game > .ttl');
  return { gap: n && head ? n.top - head.bottom : null, next: next?.className, headBottom: head?.bottom, side: side && { l: side.left, r: side.right, top: side.top, bottom: side.bottom }, play: play && { l: play.left, r: play.right, top: play.top, bottom: play.bottom }, ttlTop: ttl?.top, docH: document.documentElement.scrollHeight,
    // Board: highest drawn element (tags included) and top cell (svg top + --lift), eyebrow line.
    boardTop: Math.min(...[...document.querySelectorAll('.game .board-svg')].slice(0, 1).flatMap((s) => [...s.querySelectorAll('g.tag, rect')].map((e) => e.getBoundingClientRect()).filter((r) => r.width > 0 && r.height > 0).map((r) => r.top))),
    topCell: (q('.board-svg')?.top ?? 0) + (parseFloat(getComputedStyle(document.querySelector('.game')).getPropertyValue('--lift')) || 0),
    eyebrow: q('.game .ttl .eyebrow')?.top ?? null };
});

const b = await chromium.launch({ executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome' });
for (const w of [1280, 375, 320]) {
  const t = (s) => `[${w}] ${s}`;
  for (const id of [7, 10, 11]) {
    const g = GRIDS.find((x) => x.id === id);
    const p = await page(b, w);
    const home = await logo(p);
    await p.goto(BASE + `#/grille/${id}`); await wait(p);
    const L = await layout(p);
    const gameLogo = await logo(p);
    const c0 = await card(p);
    const kinds = c0?.items.map((x) => x.kind) ?? [];
    await p.screenshot({ path: `${OUT}g${id}-start-${w}.png`, fullPage: true });
    if (c0) await p.locator('.game section.card:has(.clues)').first().screenshot({ path: `${OUT}g${id}-card-start-${w}.png` });
    check(t(`G${id} : tous les indices listés, sans repliable`), c0 && c0.items.length === g.clues.length && c0.details === 0, `${c0?.items.length}/${g.clues.length} ; titre « ${c0?.title} »`);
    check(t(`G${id} : ordre (sans créneau en tête, puis horaire)`), JSON.stringify(kinds) === JSON.stringify(expected(g)), kinds.map((k, i) => `${k}: ${c0.items[i].txt}`).join(' | '));
    check(t(`G${id} : chaque indice a un état`), c0 && c0.items.every((x) => x.st), c0?.items.map((x) => x.st).join(', '));
    check(t(`G${id} : indices toujours dessinés sur la grille`), (await p.$$eval('.board-svg g.tag:not(.step-tag)', (l) => l.length)) > 0 || !g.clues.some((c) => 'col' in c), `${await p.$$eval('.board-svg g.tag:not(.step-tag)', (l) => l.length)} marques`);
    check(t(`G${id} : logo à la même place qu'à l'accueil`), home === gameLogo, `accueil ${home} ; grille ${gameLogo}`);
    check(t(`G${id} : marge en-tête → contenu`), L.gap !== null && L.gap >= (w >= 860 ? 30 : 20), `${L.gap?.toFixed(1)} px jusqu'à .${L.next}`);
    check(t(`G${id} : plateau (étiquettes comprises) sous l'en-tête`), L.boardTop >= L.headBottom + 8, `en-tête bas ${L.headBottom.toFixed(1)} ; plus haut élément du plateau ${L.boardTop.toFixed(1)} (écart ${(L.boardTop - L.headBottom).toFixed(1)})`);
    if (w === 1280) check(t(`G${id} : colonne de droite intacte, case haute alignée sur l'eyebrow`), L.side.r <= 1280 && L.side.l >= L.play.r && L.eyebrow !== null && Math.abs(L.topCell - L.eyebrow) <= 2, `plateau ${L.play.l.toFixed(0)}–${L.play.r.toFixed(0)} ; colonne ${L.side.l.toFixed(0)}–${L.side.r.toFixed(0)}, ${L.side.top.toFixed(0)}–${L.side.bottom.toFixed(0)} ; case haute ${L.topCell.toFixed(1)} / eyebrow ${L.eyebrow?.toFixed(1)} ; page ${L.docH} px`);
    check(t(`G${id} : aucun scroll horizontal`), (await over(p)) <= 0, `${await over(p)} px`);

    // Solution minus one bar, then lay that bar: every clue flips to "vérifié".
    const pl = g.solution.placements;
    const lastN = pl.map((x, i) => [x, i]).filter(([x]) => x.piece === 'N').pop();
    const bars = pl.filter((_, i) => i !== lastN[1]).map((x) => ({ ...x }));
    await p.evaluate(([id, st]) => localStorage.setItem('dispatch:progress:v1', JSON.stringify({ grids: { [id]: { status: 'started', state: st } } })), [String(id), { bars, exports: g.solution.exports, step: g.solution.step }]);
    await p.reload(); await wait(p, 400);
    const c1 = await card(p);
    await choose(p, 'N');
    await lay(p, lastN[0].row, lastN[0].col, lastN[0].len);
    await wait(p, 500);
    const c2 = await card(p);
    const banner = await p.$eval('.banner b', (e) => e.textContent.trim()).catch(() => null);
    await p.screenshot({ path: `${OUT}g${id}-solved-${w}.png`, fullPage: true });
    if (c2) await p.locator('.game section.card:has(.clues)').first().screenshot({ path: `${OUT}g${id}-card-solved-${w}.png` });
    check(t(`G${id} : solution posée → tous « vérifié »`), c2 && c2.items.length === g.clues.length && c2.items.every((x) => x.st === 'vérifié') && /bouclé/i.test(banner ?? ''), `avant dernière barre : ${c1?.items.map((x) => x.st).join(', ')} ; après : ${c2?.items.map((x) => x.st).join(', ')} ; titre « ${c2?.title} » ; bandeau « ${banner} »`);
    check(t(`G${id} : aucun scroll horizontal (bouclée)`), (await over(p)) <= 0, `${await over(p)} px`);
    check(t(`G${id} : aucune erreur JS`), p.errors.length === 0, p.errors.join(' | '));
    await p.context().close();
  }
}
await b.close();
fs.writeFileSync(new URL('results.json', import.meta.url), JSON.stringify(results, null, 1));
console.log(`${results.filter((r) => r.ok).length}/${results.length} OK`);
