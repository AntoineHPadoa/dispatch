// S7 review: plays the S7 checklist at 1280, 375 and 320 px in Chrome and prints A4 PDFs.
// - Needs `vite preview --port 4624` on the v2-polish build and playwright-core (node_modules here).
// - Usage: node review.mjs  → OK/FAIL lines, results.json and captures in docs/reviews/S7/.
import { chromium } from 'playwright-core';
import fs from 'fs';

const BASE = 'http://127.0.0.1:4624/dispatch/';
const OUT = new URL('../', import.meta.url).pathname;
const results = [];
const check = (name, ok, detail = '') => { results.push({ name, ok: !!ok, detail }); console.log(`${ok ? 'OK  ' : 'FAIL'} ${name}${detail ? ' — ' + detail : ''}`); };
const fakeDate = (iso) => `(()=>{const R=Date,off=new R('${iso}T10:00:00').getTime()-R.now();class D extends R{constructor(...a){a.length?super(...a):super(R.now()+off)} static now(){return R.now()+off}};window.Date=D;})()`;
const wait = (p, ms = 250) => p.waitForTimeout(ms);
const hash = (p) => p.evaluate(() => location.hash);
const txt = (p, s) => p.$eval(s, (e) => e.textContent.trim().replace(/\s+/g, ' ')).catch(() => null);
const count = (p, s) => p.$$eval(s, (e) => e.length);
const over = (p) => p.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
const brandX = (p) => p.evaluate(() => { const r = document.querySelector('.brand')?.getBoundingClientRect(); return r ? Math.round(r.left * 10) / 10 + ',' + Math.round(r.top * 10) / 10 : null; });
const progress = (p, id) => p.evaluate((id) => JSON.parse(localStorage.getItem('dispatch:progress:v1') || '{}').grids?.[id] ?? null, String(id));

async function page(b, w, { day = '2026-11-21', touch = w < 860 } = {}) {
  const ctx = await b.newContext({ viewport: { width: w, height: 900 }, hasTouch: touch, isMobile: touch, deviceScaleFactor: 2 });
  await ctx.addInitScript(fakeDate(day));
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
  if (p.touch) { await tapCell(p, row, col); if (len > 1) await tapCell(p, row, col + len - 1); return; }
  const a = await cellXY(p, row, col), z = await cellXY(p, row, col + len - 1);
  await p.mouse.move(a.x, a.y); await p.mouse.down(); await p.mouse.move(z.x, z.y, { steps: 6 }); await p.mouse.up(); await wait(p, 80);
}
const choose = (p, k) => hit(p, p.touch ? `.chips [data-piece="${k}"]` : `.side [data-piece="${k}"]`);
const tool = (p, n) => (n === 'erase' && p.touch ? hit(p, '.chips .erase-chip') : hit(p, `.tools [data-tool="${n}"]`));
const shot = (p, name, full = true) => p.screenshot({ path: `${OUT}${name}-${p.w}.png`, fullPage: full });

const G11 = [[0,0,5],[0,5,3],[1,1,4],[1,5,3],[2,1,4],[2,5,3],[3,3,5],[4,3,5],[5,3,5]];
const G7 = [[0,0,3],[0,3,3],[1,0,4],[1,4,4],[2,1,4],[2,5,3],[3,3,4]];
const b = await chromium.launch({ executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome' });

for (const w of [1280, 375, 320]) {
  const t = (s) => `[${w}] ${s}`;
  const hs = [];
  // ---- S7.2: home → grid (logo fixed) → logo → home
  {
    const p = await page(b, w);
    const xHome = await brandX(p); hs.push(['accueil', await over(p)]);
    await shot(p, 'a-home');
    await hit(p, '.sheet .btn'); await wait(p);
    const xGame = await brandX(p), hGame = await hash(p);
    const bg = await p.evaluate(() => getComputedStyle(document.body).backgroundImage.slice(0, 40));
    const accueilBtn = await p.$$eval('.game a, .game button', (e) => e.filter((x) => /^Accueil$/.test(x.textContent.trim())).length);
    hs.push(['grille 11', await over(p)]);
    await shot(p, 'a-game11', false);
    const lay1280 = await p.evaluate(() => { const q = (s) => document.querySelector(s)?.getBoundingClientRect(); const m = q('.game'), pl = q('.game > .play'), sd = q('.game > .side'), tt = q('.game > .ttl'); return m && pl && sd ? `game ${Math.round(m.left)}–${Math.round(m.right)} ; plateau ${Math.round(pl.left)}–${Math.round(pl.right)} ; colonne ${Math.round(sd.left)}–${Math.round(sd.right)} ; titre y=${Math.round(tt.top)}` : ''; });
    check(t('S7.2 accueil → grille : logo à la même place'), xHome === xGame && hGame === '#/grille/11', `accueil ${xHome} ; grille ${xGame} ; ${hGame}`);
    check(t('S7.2 grille : fond pointillé du menu, plus de bouton « Accueil »'), /radial-gradient/.test(bg) && accueilBtn === 0, `${bg} ; boutons Accueil ${accueilBtn} ; ${lay1280}`);
    await hit(p, '.brand'); await wait(p);
    check(t('S7.2 logo → accueil'), (await hash(p)) === '#/' && (await count(p, '.sheet')) === 1, await hash(p));
    // G7 too (intro card, STEP)
    await p.goto(BASE + '#/grille/7'); await wait(p);
    const x7 = await brandX(p); hs.push(['grille 7', await over(p)]);
    await shot(p, 'a-game7', false);
    check(t('S7.2 grille 7 : logo à la même place'), x7 === xHome, `${x7}`);
    check(t('S7.2 aucune erreur JS'), p.errors.length === 0, p.errors.join(' | '));
    await p.context().close();
  }
  // ---- S7.3: dossier → tutorial → back
  {
    const p = await page(b, w);
    await p.evaluate(() => localStorage.setItem('dispatch:progress:v1', JSON.stringify({ grids: { 1: { status: 'done' }, 2: { status: 'done' }, 3: { status: 'started' } } })));
    await p.reload(); await wait(p);
    const xHome = await brandX(p);
    await hit(p, '.dcard'); await wait(p);
    const xD = await brandX(p), hD = await hash(p); hs.push(['dossier', await over(p)]);
    const cards = await p.$$eval('.fiche', (l) => l.map((li) => { const q = (s) => li.querySelector(s)?.getBoundingClientRect(); const a = q('a'), btn = q('.fbtn'), meta = q('.fmeta'), body = q('.fbody b'); return { top: Math.round(a.top), btn: Math.round(btn.top), btnBottom: Math.round(a.bottom - btn.bottom), meta: Math.round(meta.top), title: Math.round(body.top), chip: !!li.querySelector('.tchip'), txt: li.querySelector('.ftxt')?.textContent.slice(0, 40) ?? '' }; }));
    const rows = {}; for (const c of cards) (rows[c.top] ??= []).push(c);
    const misaligned = Object.values(rows).filter((r) => new Set(r.map((c) => c.btn)).size > 1 || new Set(r.map((c) => c.meta)).size > 1 || new Set(r.map((c) => c.title)).size > 1);
    await shot(p, 'b-dossier');
    check(t('S7.3 accueil → dossier : logo à la même place'), xD === xHome && hD === '#/dossier/premiers-pas', `${xHome} / ${xD}`);
    check(t('S7.3 cartes : boutons, pied et titres alignés par rangée'), misaligned.length === 0 && cards.length === 7, `${cards.length} cartes, ${Object.keys(rows).length} rangée(s), ${misaligned.length} rangée(s) désalignée(s)`);
    check(t('S7.3 cartes : chaque carte dit ce qu’elle enseigne'), cards.every((c) => c.txt), cards.map((c, i) => `${i + 1}:${c.chip ? 'puce+' : ''}${c.txt ? 'texte' : '—'}`).join(' '));
    await hit(p, '.fiche:nth-child(7) a'); await wait(p);
    const h7 = await hash(p);
    await p.goBack(); await wait(p);
    check(t('S7.3 dossier → tutoriel 7 → retour (navigateur)'), h7 === '#/grille/7' && (await hash(p)) === '#/dossier/premiers-pas', `${h7} → ${await hash(p)}`);
    check(t('S7.3 aucune erreur JS'), p.errors.length === 0, p.errors.join(' | '));
    await p.context().close();
  }
  // ---- S7.4: STEP ▲ ▼, undo, eraser on G7
  {
    const p = await page(b, w); await p.goto(BASE + '#/grille/7'); await wait(p);
    const A = '[data-act="step-arrow"]';
    await choose(p, 'STEP');
    const up = await count(p, A);
    const arrowTxt = await p.$$eval(A, (l) => l.map((e) => e.textContent).join(''));
    await hit(p, `${A}[data-col="3"]`);
    const down = await p.$$eval(A, (l) => l.map((e) => e.textContent).join(''));
    await shot(p, 'c-step-pending', false);
    await hit(p, `${A}[data-col="5"]`);
    let st = await progress(p, 7);
    const tags = await p.$$eval('[data-act="step-tag"]', (l) => l.map((e) => ({ t: e.textContent, fill: e.querySelector('rect')?.getAttribute('fill') })));
    const link = await count(p, '.step-link, [stroke-dasharray]');
    await shot(p, 'c-step-pair', false);
    check(t('S7.4 ▲ 9h puis ▼ 15h : paire posée, étiquettes sans numéro (1 paire)'), st?.state?.step?.length === 1 && tags.length === 2 && tags.every((x) => !/[▲▼]\d/.test(x.t)) && !/\d/.test(arrowTxt + down), `${up} ▲ ; ${JSON.stringify(tags)}`);
    check(t('S7.4 pas de trait pointillé, ▲ et ▼ en bleu clair'), link === 0 && tags.every((x) => x.fill === '#e3eefa'), `traits ${link}`);
    await tool(p, 'undo'); st = await progress(p, 7);
    check(t('S7.4 Annuler retire la paire'), (st?.state?.step?.length ?? 0) === 0 && (await count(p, '[data-act="step-tag"]')) === 0, `${st?.state?.step?.length}`);
    // tap on a tag removes its pair
    await choose(p, 'STEP'); await hit(p, `${A}[data-col="3"]`); await hit(p, `${A}[data-col="4"]`);
    await hit(p, '[data-act="step-tag"]'); st = await progress(p, 7);
    check(t('S7.4 toucher une étiquette retire la paire'), (st?.state?.step?.length ?? 0) === 0, `${st?.state?.step?.length}`);
    // eraser on a bar
    await choose(p, 'N'); await lay(p, 0, 0, 3); st = await progress(p, 7);
    const n1 = st?.state?.bars?.length ?? 0;
    await tool(p, 'erase'); await tapCell(p, 0, 1); st = await progress(p, 7);
    await shot(p, 'c-erase', false);
    check(t('S7.4 gomme sur G7 : barre gommée'), n1 === 1 && (st?.state?.bars?.length ?? 0) === 0, `${n1} → ${st?.state?.bars?.length}`);
    hs.push(['grille 7 STEP', await over(p)]);
    check(t('S7.4 aucune erreur JS'), p.errors.length === 0, p.errors.join(' | '));
    await p.context().close();
  }
  // ---- S7.5: finish the daily sheet → home shows the solution
  {
    const p = await page(b, w); await p.goto(BASE + '#/grille/11'); await wait(p);
    await hit(p, '[data-act="export"][data-col="3"]'); await hit(p, '[data-act="export"][data-col="7"]');
    await choose(p, 'N');
    for (const [r, c, l] of G11) await lay(p, r, c, l);
    await wait(p, 400);
    const banner = await txt(p, '.banner b');
    await hit(p, '.done-tools a'); await wait(p);
    const pieces = await p.$$eval('.sheet .sil-piece', (l) => l.map((e) => e.getAttribute('fill')));
    const pale = await count(p, '.sheet .sil-cell.done');
    hs.push(['accueil bouclé', await over(p)]);
    await shot(p, 'd-home-done');
    check(t('S7.5 grille du jour bouclée → accueil : solution en couleurs'), /bouclé/i.test(banner ?? '') && (await hash(p)) === '#/' && pieces.length === 9 && pale === 0, `${banner} ; ${pieces.length} pièces (${[...new Set(pieces)].join(',')})`);
    check(t('S7.5 aucune erreur JS'), p.errors.length === 0, p.errors.join(' | '));
    await p.context().close();
  }
  const bad = hs.filter(([, o]) => o > 0);
  check(t(`aucun scroll horizontal (${hs.length} écrans)`), bad.length === 0, bad.map(([n, o]) => `${n}: +${o}px`).join(' | '));
}

// ---- S7.1 / S7.4: A4 PDFs
{
  const p = await page(b, 1280);
  for (const id of ['7', '10', '11']) {
    await p.goto(BASE + '#/imprimer/' + id); await wait(p);
    await p.emulateMedia({ media: 'print' });
    await p.pdf({ path: `${OUT}e-print-${id}.pdf`, format: 'A4', printBackground: true, preferCSSPageSize: true });
    const raw = fs.readFileSync(`${OUT}e-print-${id}.pdf`, 'latin1');
    const pages = (raw.match(/\/Type\s*\/Page[^s]/g) || []).length;
    await p.screenshot({ path: `${OUT}e-print-${id}.png`, fullPage: true });
    check(`[A4] PDF grille ${id} : 1 page`, pages === 1, `${pages} page(s)`);
    await p.emulateMedia({ media: 'screen' });
  }
  await p.context().close();
}
await b.close();
fs.writeFileSync(`${OUT}scripts/results.json`, JSON.stringify(results, null, 1));
console.log(`${results.filter((r) => r.ok).length}/${results.length} OK`);
