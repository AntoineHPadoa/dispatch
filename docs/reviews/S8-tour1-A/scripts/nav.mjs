// S8.1 review: home, dossier, rules, navigation, keyboard and print in Chrome at 1280/375/320 px.
// - Home cold, sheet of the day, previous sheets, dossier "Premiers pas", "Comment jouer".
// - A solved grid of the day: solution on the home sheet, stamp "Bouclé".
// - Logo, "Grille suivante", direct URL, unpublished grid (clock set back), browser back.
// - Keyboard: tab order, visible focus, a bar laid with the keyboard; print sheets as A4 PDF.
// - Usage: vite preview on 127.0.0.1:4672, then `node nav.mjs`.
import { chromium } from 'playwright-core';
import fs from 'fs';

const BASE = 'http://127.0.0.1:4672/dispatch/';
const OUT = process.env.OUT_DIR ?? new URL('../', import.meta.url).pathname;
const GRIDS = JSON.parse(fs.readFileSync(new URL('../../../../web/src/data/grids.json', import.meta.url)));
const W = [1280, 375, 320];
const results = [];
const check = (name, ok, detail = '') => {
  results.push({ name, ok: !!ok, detail: ok ? '' : String(detail) });
  console.log(`${ok ? 'OK  ' : 'KO  '} ${name}${!ok && detail ? ' — ' + String(detail).slice(0, 300) : ''}`);
};
const browser = await chromium.launch({ executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome' });

async function newPage(w, opts = {}) {
  const touch = w < 860;
  const ctx = await browser.newContext({ viewport: { width: w, height: 860 }, hasTouch: touch, isMobile: touch, deviceScaleFactor: 2 });
  const p = await ctx.newPage();
  if (opts.date) await p.clock.setFixedTime(new Date(opts.date));
  p.touch = touch; p.errors = [];
  p.on('pageerror', (e) => p.errors.push('pageerror: ' + e.message));
  p.on('console', (m) => { if (m.type() === 'error' || m.type() === 'warning') p.errors.push(`console.${m.type()}: ${m.text()}`); });
  await p.goto(BASE + '#/');
  await p.evaluate(() => localStorage.clear());
  await p.reload();
  await p.waitForTimeout(200);
  return p;
}
const hscroll = (p) => p.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
const shot = (p, name) => p.screenshot({ path: `${OUT}${name}.png`, fullPage: true });
// Overlapping text boxes among visible leaf texts (a coarse check for clashing labels).
const overlaps = (p, root = 'body') => p.evaluate((root) => {
  const els = [...document.querySelector(root).querySelectorAll('*')].filter((e) => {
    if (e.closest('svg') || e.closest('.sr-only')) return false;
    const s = getComputedStyle(e); if (s.visibility === 'hidden' || s.display === 'none') return false;
    return [...e.childNodes].some((n) => n.nodeType === 3 && n.textContent.trim());
  });
  const boxes = els.map((e) => {
    const rg = document.createRange(); rg.selectNodeContents(e);
    const b = [...rg.getClientRects()]; return { e, b, t: e.textContent.trim().slice(0, 30) };
  });
  const out = [];
  for (let i = 0; i < boxes.length; i++) for (let j = i + 1; j < boxes.length; j++) {
    const A = boxes[i], B = boxes[j];
    if (A.e.contains(B.e) || B.e.contains(A.e)) continue;
    for (const a of A.b) for (const b of B.b) if (a.width && b.width && a.left < b.right - 1 && b.left < a.right - 1 && a.top < b.bottom - 1 && b.top < a.bottom - 1) out.push(`${A.t} / ${B.t}`);
  }
  return [...new Set(out)].slice(0, 10);
}, root);

for (const w of W) {
  // Home cold.
  let p = await newPage(w);
  check(`home@${w} no horizontal scroll`, (await hscroll(p)) <= 0, await hscroll(p));
  const ov = await overlaps(p);
  check(`home@${w} no overlapping text`, !ov.length, ov.join(' | '));
  const today = await p.evaluate(() => +document.querySelector('.sheet a.btn')?.getAttribute('href')?.split('/').pop());
  check(`home@${w} sheet of the day is G11 (2026-11-21)`, today === 11, today);
  const prevs = await p.$$eval('.prevs li', (l) => l.map((x) => x.textContent.replace(/\s+/g, ' ').trim()));
  check(`home@${w} 3 previous sheets`, prevs.length === 3, prevs.join(' | '));
  await shot(p, `home-${w}`);
  // Rules toggle.
  await p.click('[data-rules]');
  await p.waitForTimeout(150);
  const rulesOpen = await p.evaluate(() => !document.querySelector('#rules').hidden && document.querySelector('[data-rules]').getAttribute('aria-expanded') === 'true');
  check(`home@${w} "Comment jouer" opens the rules`, rulesOpen);
  await shot(p, `home-rules-${w}`);
  // Dossier.
  await p.click('a.dcard >> nth=0');
  await p.waitForTimeout(200);
  check(`dossier@${w} opens (${await p.evaluate(() => location.hash)})`, (await p.evaluate(() => location.hash)).startsWith('#/dossier/'));
  check(`dossier@${w} no horizontal scroll`, (await hscroll(p)) <= 0, await hscroll(p));
  const ovd = await overlaps(p);
  check(`dossier@${w} no overlapping text`, !ovd.length, ovd.join(' | '));
  const nf = await p.$$eval('.fiche', (l) => l.length);
  check(`dossier@${w} 9 tutorial sheets`, nf === 9, nf);
  await shot(p, `dossier-${w}`);
  // Back to home with browser back.
  await p.goBack(); await p.waitForTimeout(200);
  check(`back@${w} dossier -> home`, (await p.evaluate(() => location.hash)) === '#/' || (await p.evaluate(() => location.hash)) === '');
  // Previous sheet then back.
  await p.click('.prevs a >> nth=0'); await p.waitForTimeout(250);
  const h1 = await p.evaluate(() => location.hash);
  await p.goBack(); await p.waitForTimeout(250);
  check(`back@${w} previous sheet ${h1} -> home`, (await p.$$('.sheet')).length === 1);
  check(`home@${w} no console/JS error`, !p.errors.length, p.errors.join(' | '));
  await p.context().close();

  // Logo position: home vs grid; logo click goes home.
  p = await newPage(w);
  const logoHome = await p.evaluate(() => { const r = document.querySelector('.brand')?.getBoundingClientRect(); return r && [r.left, r.top, r.width, r.height].map(Math.round); });
  await p.click('.sheet a.btn'); await p.waitForSelector('.board-svg');
  const logoGrid = await p.evaluate(() => { const r = document.querySelector('.brand')?.getBoundingClientRect(); return r && [r.left, r.top, r.width, r.height].map(Math.round); });
  check(`logo@${w} same place home/grid`, JSON.stringify(logoHome) === JSON.stringify(logoGrid), `${logoHome} vs ${logoGrid}`);
  await p.click('.brand'); await p.waitForTimeout(200);
  check(`logo@${w} click returns home`, (await p.$$('.sheet')).length === 1, await p.evaluate(() => location.hash));
  // Direct URL, unknown id.
  await p.goto(BASE + '#/grille/99'); await p.waitForTimeout(200);
  check(`url@${w} #/grille/99 falls back to home`, (await p.$$('.sheet')).length === 1);
  await p.goto(BASE + '#/grille/4'); await p.reload(); await p.waitForSelector('.board-svg');
  check(`url@${w} #/grille/4 direct (reload)`, (await p.evaluate(() => document.querySelector('h1')?.textContent)).includes('creux'));
  await p.goto(BASE + '#/dossier/inconnu'); await p.waitForTimeout(200);
  check(`url@${w} unknown dossier falls back to home`, (await p.$$('.sheet')).length === 1);
  check(`nav@${w} no console/JS error`, !p.errors.length, p.errors.join(' | '));
  await p.context().close();

  // Unpublished grid: clock on 2026-11-19, G10 and G11 not yet published.
  p = await newPage(w, { date: '2026-11-19T10:00:00' });
  const todayB = await p.evaluate(() => +document.querySelector('.sheet a.btn')?.getAttribute('href')?.split('/').pop());
  check(`unpublished@${w} on 11-19 the sheet of the day is G9`, todayB === 9, todayB);
  await p.goto(BASE + '#/grille/11'); await p.waitForTimeout(200);
  check(`unpublished@${w} #/grille/11 not reachable on 11-19`, !(await p.$('.board-svg')), await p.evaluate(() => location.hash));
  const printAllIds = await (async () => { await p.goto(BASE + '#/imprimer/tout'); await p.waitForTimeout(300); return p.$$eval('#print-root .sheet, #print-root section, #print-root article', (l) => l.length); })();
  check(`unpublished@${w} #/imprimer/tout on 11-19 (${printAllIds} sheets)`, printAllIds > 0);
  await p.context().close();
}

// Solved grid of the day: solution drawn on the home sheet, "Bouclé" stamp, "Grille suivante".
for (const w of W) {
  const p = await newPage(w);
  const g = GRIDS.find((x) => x.id === 11);
  // Write the solved state through the game: lay the solution with the engine is the play script's job;
  // here we reuse its progress by playing it (keyboard-free): import the helper.
  const { playSolutionOn } = await import('./solve-helper.mjs');
  await p.goto(BASE + '#/grille/11'); await p.waitForSelector('.board-svg');
  await playSolutionOn(p, g);
  await p.waitForTimeout(300);
  const solved = await p.evaluate(() => !!document.querySelector('.banner[role="status"]'));
  check(`solved@${w} G11 verdict`, solved);
  const nextHref = await p.evaluate(() => document.querySelector('.done-tools a')?.getAttribute('href'));
  const nextText = await p.evaluate(() => document.querySelector('.done-tools a')?.textContent?.trim());
  check(`solved@${w} next link "${nextText}" -> ${nextHref}`, !!nextHref);
  await p.click('.done-tools a'); await p.waitForTimeout(300);
  await shot(p, `after-next-${w}`);
  await p.click('.brand'); await p.waitForTimeout(300);
  const stamp = await p.evaluate(() => document.querySelector('.sheet .stamp')?.textContent?.trim());
  check(`solved@${w} home sheet stamp "${stamp}"`, stamp === 'Bouclé', stamp);
  await shot(p, `home-solved-${w}`);
  check(`solved@${w} no console/JS error`, !p.errors.length, p.errors.join(' | '));
  await p.context().close();
}

// Keyboard at 1280: tab order on home, visible focus, a bar laid with keys on G1.
{
  const p = await newPage(1280);
  const seen = [];
  for (let i = 0; i < 14; i++) {
    await p.keyboard.press('Tab');
    seen.push(await p.evaluate(() => {
      const e = document.activeElement; const s = getComputedStyle(e);
      const ring = s.outlineStyle !== 'none' && parseFloat(s.outlineWidth) > 0 || s.boxShadow !== 'none';
      return `${e.tagName.toLowerCase()}${e.className ? '.' + String(e.className).split(' ')[0] : ''}:${(e.getAttribute('aria-label') || e.textContent || '').trim().slice(0, 24)}${ring ? '' : ' [NO RING]'}`;
    }));
    if (i === 3) await p.screenshot({ path: `${OUT}kbd-home-focus.png` });
  }
  console.log('tab order home:', seen.join(' → '));
  check('keyboard home: every focused element shows a ring', seen.every((s) => !s.includes('[NO RING]')), seen.filter((s) => s.includes('NO RING')).join(' | '));
  await p.goto(BASE + '#/grille/1'); await p.waitForSelector('.board-svg');
  await p.focus('.board-wrap');
  // Nucleaire selected by default? Lay N6 on row 0 with Enter at col 0 then col 5.
  await p.keyboard.press('ArrowRight'); await p.keyboard.press('ArrowLeft');
  await p.keyboard.press('Enter');
  for (let i = 0; i < 5; i++) await p.keyboard.press('ArrowRight');
  await p.keyboard.press('Enter');
  await p.waitForTimeout(200);
  const bars = await p.evaluate(() => { const v = JSON.parse(localStorage.getItem('dispatch:progress:v1') || '{}'); const g = (v.grids ?? v)[1]; return g?.state?.bars ?? []; });
  check('keyboard G1: a bar laid with arrows + Enter', bars.length === 1, JSON.stringify(bars));
  await p.screenshot({ path: `${OUT}kbd-g1.png` });
  check('keyboard no console/JS error', !p.errors.length, p.errors.join(' | '));
  await p.context().close();
}

// Print: 3 grids and every grid, as A4 PDF.
{
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  const p = await ctx.newPage();
  for (const id of [7, 11, 13, 'tout']) {
    await p.goto(BASE + `#/imprimer/${id}`); await p.reload(); await p.waitForTimeout(400);
    await p.screenshot({ path: `${OUT}print-preview-${id}.png`, fullPage: id !== 'tout' });
    await p.emulateMedia({ media: 'print' });
    const pdf = await p.pdf({ path: `${OUT}print-${id}.pdf`, format: 'A4', printBackground: true, preferCSSPageSize: true });
    const pages = (pdf.toString('latin1').match(/\/Type\s*\/Page[^s]/g) || []).length;
    const want = id === 'tout' ? GRIDS.length : 1;
    check(`print ${id}: ${pages} A4 page(s)`, pages === want, `${pages} vs ${want}`);
    await p.emulateMedia({ media: 'screen' });
  }
  await ctx.close();
}

fs.writeFileSync(`${OUT}nav-results.json`, JSON.stringify(results, null, 1));
console.log(`${results.filter((r) => r.ok).length}/${results.length} OK`);
await browser.close();
