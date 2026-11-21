// S7 finishing check: plays the fixed S7.8 list at 1280, 375 and 320 px in Chrome, with captures and A4 PDFs.
// - Needs `vite preview --port 4630` on the v2-polish build and playwright-core (node_modules here).
// - Usage: node verify.mjs  → OK/FAIL lines, results.json and captures in docs/reviews/S7-finition/.
import { chromium } from 'playwright-core';
import fs from 'fs';

const BASE = 'http://127.0.0.1:4630/dispatch/';
const OUT = new URL('../', import.meta.url).pathname;
const results = [];
const check = (name, ok, detail = '') => { results.push({ name, ok: !!ok, detail }); console.log(`${ok ? 'OK  ' : 'FAIL'} ${name}${detail ? ' — ' + detail : ''}`); };
const fakeDate = (iso) => `(()=>{const R=Date,off=new R('${iso}T10:00:00').getTime()-R.now();class D extends R{constructor(...a){a.length?super(...a):super(R.now()+off)} static now(){return R.now()+off}};window.Date=D;})()`;
const wait = (p, ms = 250) => p.waitForTimeout(ms);
const hash = (p) => p.evaluate(() => location.hash);
const txt = (p, s) => p.$eval(s, (e) => e.textContent.trim().replace(/\s+/g, ' ')).catch(() => null);
const count = (p, s) => p.$$eval(s, (e) => e.length);
const over = (p) => p.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
const logo = (p) => p.evaluate(() => { const r = document.querySelector('.brand svg')?.getBoundingClientRect(); return r ? `${r.left.toFixed(1)},${r.top.toFixed(1)}` : null; });
const progress = (p, id) => p.evaluate((id) => JSON.parse(localStorage.getItem('dispatch:progress:v1') || '{}').grids?.[id] ?? null, String(id));

async function page(b, w, { day = '2026-11-21', touch = w < 860 } = {}) {
  const ctx = await b.newContext({ viewport: { width: w, height: 900 }, hasTouch: touch, isMobile: touch, deviceScaleFactor: 2 });
  await ctx.addInitScript(fakeDate(day));
  const p = await ctx.newPage();
  p.errors = []; p.touch = touch; p.w = w; p.screens = [];
  p.on('pageerror', (e) => p.errors.push(e.message));
  await p.goto(BASE + '#/');
  await p.evaluate(() => localStorage.clear());
  await p.reload(); await wait(p);
  return p;
}
const screen = async (p, name, all) => all.push([`${name}`, await over(p)]);
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
// 1280 layout of the game page: board top cell vs eyebrow, side column width and gaps.
const layout = (p) => p.evaluate(() => {
  const q = (s) => document.querySelector(s)?.getBoundingClientRect();
  const g = q('.game'), pl = q('.game > .play'), sd = q('.game > .side'), tt = q('.game > .ttl'), eb = q('.game .ttl .eyebrow'), svg = q('.board-svg');
  const lift = parseFloat(getComputedStyle(document.querySelector('.game')).getPropertyValue('--lift')) || 0;
  const colR = Math.max(sd?.right ?? 0, tt?.right ?? 0), colL = Math.min(sd?.left ?? 1e9, tt?.left ?? 1e9);
  return { gameL: g.left, gameR: g.right, playL: pl.left, playR: pl.right, colL, colR, colW: colR - colL, gap: colL - pl.right, rightMargin: innerWidth - colR, eyebrow: eb?.top ?? null, topCell: svg ? svg.top + lift : null, lift };
});

const G11 = [[0,0,5],[0,5,3],[1,1,4],[1,5,3],[2,1,4],[2,5,3],[3,3,5],[4,3,5],[5,3,5]];
const b = await chromium.launch({ executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome' });
const logoAll = {};

for (const w of [1280, 375, 320]) {
  const t = (s) => `[${w}] ${s}`;
  const hs = [];
  // ---- 1. home → daily grid → logo → home: the logo does not move
  {
    const p = await page(b, w);
    const L = { home: await logo(p) }; await screen(p, 'accueil', hs);
    const primBg = await p.$eval('.sheet .btn', (e) => getComputedStyle(e).backgroundColor);
    const primTxt = await txt(p, '.sheet .btn');
    await shot(p, '1-home');
    await hit(p, '.sheet .btn'); await wait(p, 400);
    L.game = await logo(p); const hGame = await hash(p); await screen(p, 'grille du jour', hs);
    await shot(p, '1-game11', false);
    if (w === 1280) {
      const m = await layout(p);
      // overlay the eyebrow line for the capture
      await p.evaluate((y) => { const d = document.createElement('div'); d.id = 'probe'; d.style.cssText = `position:fixed;left:0;right:0;top:${y}px;height:1px;background:red;z-index:99`; document.body.append(d); }, m.eyebrow);
      await shot(p, '1-game11-eyebrow-line', false);
      await p.evaluate(() => document.getElementById('probe')?.remove());
      check(t('1280 resserrée : case la plus haute alignée sur l’eyebrow « N° »'), m.eyebrow !== null && Math.abs(m.topCell - m.eyebrow) <= 2, `case haute y=${m.topCell.toFixed(1)} ; eyebrow y=${m.eyebrow?.toFixed(1)} ; lift ${m.lift}`);
      check(t('1280 resserrée : colonne de droite ~520 px collée au plateau, marge à droite'), m.colW <= 530 && m.colW >= 480 && m.gap <= 40 && m.rightMargin > 40, `plateau ${m.playL.toFixed(0)}–${m.playR.toFixed(0)} ; colonne ${m.colL.toFixed(0)}–${m.colR.toFixed(0)} (${m.colW.toFixed(0)} px) ; écart ${m.gap.toFixed(0)} ; marge droite ${m.rightMargin.toFixed(0)}`);
    }
    await hit(p, '.brand'); await wait(p);
    L.back = await logo(p); const hBack = await hash(p);
    await p.goto(BASE + '#/dossier/premiers-pas'); await wait(p);
    L.dossier = await logo(p); await screen(p, 'dossier', hs);
    logoAll[w] = L;
    check(t('1. accueil → grille du jour → logo → accueil : logo immobile'), hGame === '#/grille/11' && hBack === '#/' && new Set(Object.values(L)).size === 1, `accueil ${L.home} ; grille ${L.game} ; retour ${L.back} ; dossier ${L.dossier}`);
    check(t('« Prendre le quart » reste le bouton principal'), /Prendre le quart/.test(primTxt ?? '') && !/rgba\(0, 0, 0, 0\)|transparent/.test(primBg), `${primTxt} ; fond ${primBg}`);
    check(t('1. aucune erreur JS'), p.errors.length === 0, p.errors.join(' | '));
    await p.context().close();
  }
  // ---- 2. dossier « Premiers pas » → tutorial → back
  {
    const p = await page(b, w);
    await hit(p, '.dcard'); await wait(p);
    const hD = await hash(p); await screen(p, 'dossier', hs);
    await shot(p, '2-dossier');
    await hit(p, '.fiche:nth-child(1) a'); await wait(p);
    const h1 = await hash(p); await screen(p, 'tutoriel 1', hs);
    await shot(p, '2-tuto1', false);
    await p.goBack(); await wait(p);
    const hB = await hash(p);
    check(t('2. dossier « Premiers pas » → tutoriel → retour'), hD === '#/dossier/premiers-pas' && h1 === '#/grille/1' && hB === '#/dossier/premiers-pas', `${hD} → ${h1} → ${hB}`);
    check(t('2. aucune erreur JS'), p.errors.length === 0, p.errors.join(' | '));
    await p.context().close();
  }
  // ---- 3. G7: ▲ ▼, undo, eraser
  {
    const p = await page(b, w); await p.goto(BASE + '#/grille/7'); await wait(p);
    const A = '[data-act="step-arrow"]';
    // dashed strokes (lines and paths; dashed rects are clue cells and the STEP pump/turbine cells), before any STEP
    const dashCount = () => p.$$eval('.board-svg [stroke-dasharray]', (l) => l.filter((e) => e.tagName !== 'rect').length);
    const dash0 = await dashCount();
    await choose(p, 'STEP');
    const ups = await p.$$eval(A, (l) => l.map((e) => ({ t: e.textContent, fill: e.querySelector('circle')?.getAttribute('fill') })));
    await shot(p, '3-step-up', false);
    await hit(p, `${A}[data-col="3"]`);
    const downs = await p.$$eval(A, (l) => l.map((e) => e.textContent).join(''));
    await shot(p, '3-step-down', false);
    await hit(p, `${A}[data-col="5"]`);
    let st = await progress(p, 7);
    const tags = await p.$$eval('[data-act="step-tag"]', (l) => l.map((e) => ({ t: e.textContent, fill: e.querySelector('rect')?.getAttribute('fill') })));
    const dashes = (await dashCount()) - dash0;
    await shot(p, '3-step-pair', false); await screen(p, 'G7 STEP', hs);
    check(t('3. ▲ puis ▼ : paire posée, ▲ ▼ bleu clair, sans numéro (1 paire)'), st?.state?.step?.length === 1 && tags.length === 2 && tags.every((x) => x.fill === '#e3eefa' && !/\d/.test(x.t)) && ups.every((u) => u.fill === '#e3eefa') && !/\d/.test(ups.map((u) => u.t).join('') + downs), `${ups.length} ▲ ; étiquettes ${tags.map((x) => x.t).join(' / ')}`);
    check(t('3. aucun trait entre ▲ et ▼'), dashes === 0, `${dashes} ligne(s) pointillée(s) ajoutée(s) par la paire (${dash0} avant)`);
    await tool(p, 'undo'); st = await progress(p, 7);
    check(t('3. Annuler retire la paire'), (st?.state?.step?.length ?? 0) === 0 && (await count(p, '[data-act="step-tag"]')) === 0, `${st?.state?.step?.length ?? 0} paire`);
    await choose(p, 'N'); await lay(p, 0, 0, 3); st = await progress(p, 7);
    const n1 = st?.state?.bars?.length ?? 0;
    await tool(p, 'erase'); await shot(p, '3-erase-mode', false); await tapCell(p, 0, 1); st = await progress(p, 7);
    await shot(p, '3-erased', false);
    check(t('3. gomme : barre gommée'), n1 === 1 && (st?.state?.bars?.length ?? 0) === 0, `${n1} → ${st?.state?.bars?.length ?? 0}`);
    check(t('3. aucune erreur JS'), p.errors.length === 0, p.errors.join(' | '));
    await p.context().close();
  }
  // ---- 4. finish the daily grid → home: solution in plant colours, secondary button
  {
    const p = await page(b, w); await p.goto(BASE + '#/grille/11'); await wait(p);
    await hit(p, '[data-act="export"][data-col="3"]'); await hit(p, '[data-act="export"][data-col="7"]');
    await choose(p, 'N');
    for (const [r, c, l] of G11) await lay(p, r, c, l);
    await wait(p, 400);
    const banner = await txt(p, '.banner b');
    await shot(p, '4-game-done', false);
    await hit(p, '.done-tools a'); await wait(p);
    const pieces = await p.$$eval('.sheet .sil-piece', (l) => l.map((e) => e.getAttribute('fill')));
    const btn = await p.$eval('.sheet .btn', (e) => { const s = getComputedStyle(e); const r = e.getBoundingClientRect(); return { t: e.textContent.trim(), cls: e.className, bg: s.backgroundColor, border: s.borderTopWidth + ' ' + s.borderTopColor, h: r.height, right: e.parentElement.getBoundingClientRect().right - r.right }; });
    await screen(p, 'accueil bouclé', hs);
    await shot(p, '4-home-done');
    await p.locator('.sheet').first().screenshot({ path: `${OUT}4-sheet-done-${w}.png` });
    check(t('4. bouclée → accueil : solution en couleurs de centrales'), /bouclé/i.test(banner ?? '') && (await hash(p)) === '#/' && pieces.length === 9 && pieces.every((f) => f === '#f7e2a0'), `${banner} ; ${pieces.length} pièces (${[...new Set(pieces)].join(',')})`);
    check(t('4. « Revoir le quart » en bouton secondaire discret'), /Revoir le quart/.test(btn.t) && /secondary/.test(btn.cls) && /rgba\(0, 0, 0, 0\)/.test(btn.bg) && btn.h <= 40, `${btn.t} ; fond ${btn.bg} ; bord ${btn.border} ; h ${btn.h.toFixed(0)} ; à ${btn.right.toFixed(0)} px du bord droit`);
    check(t('4. aucune erreur JS'), p.errors.length === 0, p.errors.join(' | '));
    await p.context().close();
  }
  // ---- 7. no horizontal scroll on every screen visited
  const bad = hs.filter(([, o]) => o > 0);
  check(t(`7. aucun scroll horizontal (${hs.length} écrans)`), bad.length === 0, bad.map(([n, o]) => `${n}: +${o}px`).join(' | '));
}

// ---- 5. A4 PDFs of G7, G10 and the daily grid (G11)
{
  const p = await page(b, 1280);
  for (const id of ['7', '10', '11']) {
    await p.goto(BASE + '#/imprimer/' + id); await wait(p, 400);
    await p.emulateMedia({ media: 'print' });
    await p.pdf({ path: `${OUT}5-print-${id}.pdf`, format: 'A4', printBackground: true, preferCSSPageSize: true });
    const raw = fs.readFileSync(`${OUT}5-print-${id}.pdf`, 'latin1');
    const pages = (raw.match(/\/Type\s*\/Page[^s]/g) || []).length;
    await p.emulateMedia({ media: 'screen' });
    await p.screenshot({ path: `${OUT}5-print-${id}.png`, fullPage: true });
    check(`[A4] 5. PDF grille ${id} : 1 page`, pages === 1, `${pages} page(s)`);
  }
  // ---- 6. tab icon
  const links = await p.$$eval('link[rel~="icon"]', (l) => l.map((e) => `${e.getAttribute('href')} (${e.getAttribute('type')})`));
  const res = await p.request.get(BASE + 'icon.svg');
  check('6. icône d’onglet présente', links.length === 1 && res.ok() && /svg/.test(res.headers()['content-type'] ?? ''), `${links.join(', ')} ; HTTP ${res.status()} ${res.headers()['content-type']}`);
  await p.context().close();
  const q = await b.newPage({ viewport: { width: 300, height: 64 }, deviceScaleFactor: 2 });
  const href = BASE + 'icon.svg';
  await q.setContent(`<body style="margin:0;display:flex;gap:14px;align-items:center;padding:14px;background:#dee1e6"><img src="${href}" width="16" height="16"><img src="${href}" width="32" height="32"><span style="background:#fff;padding:6px 10px;border-radius:8px;display:flex;gap:6px;align-items:center;font:12px system-ui"><img src="${href}" width="16" height="16">Dispatch</span><span style="background:#35363a;color:#fff;padding:6px 10px;border-radius:8px;display:flex;gap:6px;align-items:center;font:12px system-ui"><img src="${href}" width="16" height="16">Dispatch</span></body>`);
  await wait(q, 300);
  await q.screenshot({ path: `${OUT}6-favicon.png` });
  await q.close();
}
// 3 bis: 2-pair STEP render (no real grid has 2 pairs), page written by two-pairs.ts
{
  const f = new URL('two-pairs.html', import.meta.url).pathname;
  if (fs.existsSync(f)) {
    const q = await b.newPage({ viewport: { width: 760, height: 900 }, deviceScaleFactor: 2 });
    await q.goto('file://' + f); await wait(q, 200);
    const texts = await q.$$eval('section', (l) => l.map((s) => [...s.querySelectorAll('.step-tag')].map((g) => g.textContent).join(' / ')));
    const arrows = await q.$$eval('section:last-child .step-arrow', (l) => l.map((g) => g.textContent).join(' '));
    // compact tags must not overflow their pill
    const overflow = await q.$$eval('.step-tag', (l) => l.filter((g) => { const r = g.querySelector('rect')?.getBBox(), tx = g.querySelector('text')?.getBBox(); return r && tx && (tx.x < r.x - 0.5 || tx.x + tx.width > r.x + r.width + 0.5); }).length);
    await q.screenshot({ path: `${OUT}3-two-pairs.png`, fullPage: true });
    check('3 bis. grille de test à 2 paires : numéros par paire, pastilles assez larges', texts[0].includes('▲1') && texts[0].includes('▲2▼1') && texts[1].includes('▲1▲2') && overflow === 0 && /2/.test(arrows), `${texts.join(' | ')} ; flèches mode STEP : ${arrows} ; ${overflow} débordement(s)`);
    await q.close();
  }
}
await b.close();
fs.writeFileSync(`${OUT}scripts/results.json`, JSON.stringify({ results, logo: logoAll }, null, 1));
console.log(`${results.filter((r) => r.ok).length}/${results.length} OK`);
