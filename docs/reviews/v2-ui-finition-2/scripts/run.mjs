// Finishing round 2 (S2 + S3 merged on main): plays the fixed checklist at 1280, 375 and 320 px.
// - Needs `vite preview` on the port in lib.mjs and playwright-core; date pinned to 2026-11-21 (or 2026-11-20).
// - Usage: node run.mjs  → prints OK/FAIL lines, writes results.json and captures next to the report.
import { launch, check, msg, progress, count, hit, tapCell, lay, choose, tool, hscroll, BASE, OUT, results } from './lib.mjs';
import fs from 'fs';

const fakeDate = (iso) => `(()=>{const R=Date,off=new R('${iso}T10:00:00').getTime()-R.now();class D extends R{constructor(...a){a.length?super(...a):super(R.now()+off)} static now(){return R.now()+off}};window.Date=D;})()`;
const wait = (p, ms = 250) => p.waitForTimeout(ms);
const hash = (p) => p.evaluate(() => location.hash);
const txt = (p, s) => p.$eval(s, (e) => e.textContent.trim().replace(/\s+/g, ' ')).catch(() => null);
const noOverflow = async (p) => (await p.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)) <= 0;
const overflowers = (p) => p.evaluate(() => { const W = document.documentElement.clientWidth; return [...document.querySelectorAll('body *')].filter((e) => { const r = e.getBoundingClientRect(); return r.width && r.right > W + 0.5; }).slice(0, 5).map((e) => e.tagName.toLowerCase() + '.' + [...e.classList].join('.')); });

async function page(b, w, { day = '2026-11-21', height = 900, touch = w < 860 } = {}) {
  const ctx = await b.newContext({ viewport: { width: w, height }, hasTouch: touch, isMobile: touch, deviceScaleFactor: 2 });
  await ctx.addInitScript(fakeDate(day));
  const p = await ctx.newPage();
  p.errors = []; p.touch = touch; p.w = w;
  p.on('pageerror', (e) => p.errors.push(e.message));
  p.on('response', (r) => { if (r.status() >= 400 && !/favicon/.test(r.url())) p.errors.push(`${r.status()} ${r.url()}`); });
  await p.goto(BASE + '#/');
  await p.evaluate(() => localStorage.clear());
  await p.reload();
  await wait(p);
  return p;
}
const shot = (p, name) => p.screenshot({ path: `${OUT}/${name}-${p.w}.png`, fullPage: true });
const hs = {}; // screens checked for horizontal overflow, per width
async function hscreen(p, name) { const ok = await noOverflow(p); (hs[p.w] ??= []).push({ name, ok, off: ok ? [] : await overflowers(p) }); return ok; }
async function goto(p, h) { await p.goto(BASE + h); await wait(p); }

const b = await launch();
const W = [1280, 375, 320];
const G11 = [[0,0,5],[0,5,3],[1,1,4],[1,5,3],[2,1,4],[2,5,3],[3,3,5],[4,3,5],[5,3,5]];
const G7 = [[0,0,3],[0,3,3],[1,0,4],[1,4,4],[2,1,4],[2,5,3],[3,3,4]];

for (const w of W) {
  const t = (s) => `[${w}] ${s}`;
  // ---------- 1. cold home → take the shift → bulletin number and title → back home
  {
    const p = await page(b, w);
    const eb = await txt(p, '.sheet .eyebrow'), h2 = await txt(p, '.sheet h2');
    await shot(p, '1-home-cold'); await hscreen(p, 'accueil à froid');
    check(t('1 accueil à froid : fiche n° 214'), /214/.test(eb) && /Plateau/.test(h2), `${eb} — ${h2}`);
    await hit(p, '.sheet .btn'); await wait(p);
    const h = await hash(p), h1 = await txt(p, '.game h1, h1'), geb = await txt(p, '.game .eyebrow'), title = await p.title();
    await shot(p, '1-grid'); await hscreen(p, 'grille du jour');
    check(t('1 « Prendre le quart » → #/grille/11, numéro et titre du bulletin'), h === '#/grille/11' && /Plateau d.après-midi/.test(h1) && /n° 214/.test(geb), `${h} — h1 « ${h1} » — eyebrow « ${geb} » — onglet « ${title} »`);
    const back = await txt(p, '.backlink');
    await hit(p, '.backlink'); await wait(p);
    const h2b = await hash(p);
    await shot(p, '1-home-back');
    check(t('1 retour « Accueil » → #/'), back === 'Accueil' && (h2b === '#/' || h2b === '') && (await count(p, '.home .sheet')) === 1, `lien « ${back} » → « ${h2b} »`);
    check(t('1 aucune erreur JS'), p.errors.length === 0, p.errors.join(' | '));
    await p.context().close();
  }
  // ---------- 2a. daily grid (n° 214): no STEP in its inventory; undo, eraser, export, import
  {
    const p = await page(b, w); await goto(p, '#/grille/11');
    const keys = await p.$$eval('.side [data-piece]', (e) => e.map((x) => x.getAttribute('data-piece')));
    const chipKeys = await p.$$eval('.chips [data-piece]', (e) => e.map((x) => x.getAttribute('data-piece')));
    check(t('2 G11 : carnet sans STEP (N + import libre)'), !keys.includes('STEP') && !(await count(p, '[data-act="step-arrow"]')), `carnet ${keys.join(',')} — rangée ${chipKeys.join(',') || '(cachée)'}`);
    await choose(p, 'N'); await lay(p, 0, 0, 5);
    let st = await progress(p, 11);
    check(t('2 G11 : poser N 0h→12h'), st?.bars?.length === 1, await msg(p));
    await tool(p, 'undo'); st = await progress(p, 11);
    check(t('2 G11 : Annuler retire la barre'), st.bars.length === 0, await msg(p));
    await choose(p, 'N'); await lay(p, 0, 0, 5);
    await tool(p, 'erase'); await tapCell(p, 0, 2); st = await progress(p, 11);
    check(t('2 G11 : gomme retire la barre'), st.bars.length === 0, await msg(p));
    await tool(p, 'erase');
    await hit(p, '[data-act="export"][data-col="3"]'); st = await progress(p, 11);
    check(t('2 G11 : export DE à 9h par la pastille'), (st.exports?.DE?.[3] ?? 0) === 1, `${JSON.stringify(st.exports)} — ${await msg(p)}`);
    await shot(p, '2-g11-export');
    await tool(p, 'undo'); st = await progress(p, 11);
    check(t('2 G11 : Annuler l’export'), (st.exports?.DE?.[3] ?? 0) === 0, await msg(p));
    await hscreen(p, 'G11 en cours');
    check(t('2 G11 aucune erreur JS'), p.errors.length === 0, p.errors.join(' | '));
    await p.context().close();
  }
  // ---------- 2b. G7: STEP ▲ then ▼, undo / eraser after ▲ only, export, import
  {
    const A = '[data-act="step-arrow"]';
    const p = await page(b, w); await goto(p, '#/grille/7');
    await choose(p, 'N'); await lay(p, 0, 0, 3);
    await choose(p, 'STEP');
    check(t('2 G7 : STEP choisi, 7 flèches ▲'), (await count(p, A)) === 7, await msg(p));
    await hit(p, `${A}[data-col="3"]`);
    check(t('2 G7 : ▲ à 9h → ▲ choisie + 4 ▼'), (await count(p, A)) === 5, await msg(p));
    await shot(p, '2-g7-pump');
    await tool(p, 'undo'); let st = await progress(p, 7);
    check(t('2 G7 : Annuler après ▲ seul → pompage abandonné, barre gardée'), (await count(p, A)) === 7 && st.bars.length === 1 && st.step.length === 0, await msg(p));
    await hit(p, `${A}[data-col="3"]`);
    await tool(p, 'erase'); const arrows = await count(p, A);
    await tapCell(p, 0, 1); st = await progress(p, 7);
    check(t('2 G7 : gomme après ▲ seul → flèches cachées, barre gommée, pas de STEP fantôme'), arrows === 0 && st.bars.length === 0 && st.step.length === 0, await msg(p));
    await tool(p, 'erase');
    await choose(p, 'STEP');
    await hit(p, `${A}[data-col="3"]`); await hit(p, `${A}[data-col="4"]`); st = await progress(p, 7);
    check(t('2 G7 : ▲ 9h puis ▼ 12h → paire posée'), st.step.length === 1 && st.step[0].pump === 3 && st.step[0].turbine === 4 && (await count(p, '[data-act="step-tag"]')) === 2, await msg(p));
    await shot(p, '2-g7-pair');
    await hit(p, '[data-act="export"][data-col="5"]'); st = await progress(p, 7);
    check(t('2 G7 : pastille export à 15h → refus motivé (exports publiés), STEP intact'), (st.exports?.DE?.[5] ?? 0) === 0 && st.step.length === 1 && (await count(p, A)) === 0, await msg(p));
    await choose(p, 'I:DE'); await lay(p, 0, 6, 1); st = await progress(p, 7);
    check(t('2 G7 : import DE à 18h posé, STEP intact'), st.bars.some((x) => x.piece === 'I') && st.step.length === 1, await msg(p));
    await shot(p, '2-g7-import'); await hscreen(p, 'G7 en cours');
    check(t('2 G7 aucune erreur JS'), p.errors.length === 0, p.errors.join(' | '));
    await p.context().close();
  }
  // ---------- 2c. compact row (375, 320): choose, lay, erase, scroll
  if (w < 860) {
    const p = await page(b, w); await goto(p, '#/grille/7');
    const vis = (await p.isVisible('.chips')) && !(await p.isVisible('.tools .erase-tool'));
    const keys = await p.$$eval('.chips [data-piece]', (e) => e.map((x) => x.getAttribute('data-piece')));
    check(t('2 rangée : visible, gomme texte cachée'), vis && keys.length === 3, keys.join(','));
    let allOk = true;
    for (const k of keys) {
      await choose(p, k);
      const ok = await p.$eval(`.chips [data-piece="${k}"]`, (e) => { const r = e.getBoundingClientRect(), q = e.parentElement.getBoundingClientRect(); return e.classList.contains('sel') && r.left >= q.left - 1 && r.right <= q.right + 1; });
      const book = await p.$eval(`.side [data-piece="${k}"]`, (e) => e.classList.contains('sel'));
      allOk &&= ok && book;
    }
    check(t('2 rangée : choisir chaque puce (sélection, visible, carnet synchronisé)'), allOk, keys.join(','));
    await choose(p, 'N'); await lay(p, 0, 0, 3);
    const cnt = await txt(p, '.chips [data-piece="N"] small');
    check(t('2 rangée : poser N depuis la rangée, compteur'), (await progress(p, 7)).bars.length === 1, `compteur ${cnt}`);
    await tool(p, 'erase');
    const sel = await p.$$eval('.chips .chip.sel[data-piece]', (e) => e.length);
    await shot(p, '2-row-erase');
    await tapCell(p, 0, 1);
    check(t('2 rangée : gomme en icône active seule, retire la barre'), sel === 0 && (await progress(p, 7)).bars.length === 0, `puces sélectionnées en mode gomme : ${sel}`);
    await tool(p, 'erase');
    const sc = await p.$eval('.chips-row', (r) => { r.scrollLeft = 0; const a = r.scrollLeft; r.scrollLeft = 9999; return { a, b: r.scrollLeft, max: r.scrollWidth - r.clientWidth, mask: getComputedStyle(r).maskImage || getComputedStyle(r).webkitMaskImage }; });
    check(t('2 rangée : défile'), sc.max <= 0 || sc.b > sc.a, `${sc.b}/${sc.max} px, fondu ${/gradient/.test(sc.mask) ? 'oui' : 'non'}`);
    await shot(p, '2-row-scrolled'); await hscreen(p, 'rangée défilée');
    check(t('2 rangée aucune erreur JS'), p.errors.length === 0, p.errors.join(' | '));
    await p.context().close();
  }
  // ---------- 3. finish the daily rated grid → stamp and pale pink silhouette
  {
    const p = await page(b, w); await goto(p, '#/grille/11');
    await hit(p, '[data-act="export"][data-col="3"]');
    await hit(p, '[data-act="export"][data-col="7"]');
    await choose(p, 'N');
    for (const [r, c, l] of G11) await lay(p, r, c, l);
    await wait(p, 400);
    const banner = await txt(p, '.banner b'), st = await p.evaluate(() => JSON.parse(localStorage.getItem('dispatch:progress:v1')).grids['11'].status);
    await shot(p, '3-g11-solved'); await hscreen(p, 'G11 bouclée');
    check(t('3 G11 jouée jusqu’au verdict'), /bouclé/i.test(banner ?? '') && st === 'done', `${banner} — statut ${st} — ${await msg(p)}`);
    const homeBtn = await txt(p, '.done-tools a');
    await hit(p, '.done-tools a'); await wait(p);
    const stamp = await txt(p, '.sheet .stamp'), pale = await count(p, '.sheet .sil-cell.done');
    const fill = await p.$eval('.sheet .sil-cell.done', (e) => getComputedStyle(e).fill + ' ' + getComputedStyle(e).backgroundColor).catch(() => '');
    await shot(p, '3-home-stamp'); await hscreen(p, 'accueil bouclé');
    check(t('3 accueil : tampon « Bouclé », silhouette rose pâle'), /Bouclé/.test(stamp) && pale > 0, `bouton fin « ${homeBtn} » ; tampon « ${stamp} » ; ${pale} cases .done (${fill})`);
    check(t('3 aucune erreur JS'), p.errors.length === 0, p.errors.join(' | '));
    await p.context().close();
  }
  // ---------- 4. folder « Premiers pas » → tutorial 7 → next = daily sheet
  {
    const p = await page(b, w);
    await hit(p, '.dcard'); await wait(p);
    const dh = await hash(p), cards = await count(p, '.cards .gcard');
    await shot(p, '4-dossier'); await hscreen(p, 'dossier');
    check(t('4 carte dossier → page dossier, 7 tutoriels'), dh === '#/dossier/premiers-pas' && cards === 7, `${dh}, ${cards} cartes`);
    await hit(p, '.cards li:nth-child(7) .gcard'); await wait(p);
    check(t('4 tutoriel 7 ouvert'), (await hash(p)) === '#/grille/7', await hash(p));
    await choose(p, 'STEP');
    await hit(p, '[data-act="step-arrow"][data-col="3"]'); await hit(p, '[data-act="step-arrow"][data-col="4"]');
    await choose(p, 'N');
    for (const [r, c, l] of G7) await lay(p, r, c, l);
    await choose(p, 'I:DE'); await lay(p, 0, 6, 1); await lay(p, 0, 7, 1);
    await wait(p, 400);
    const banner = await txt(p, '.banner b'), next = await txt(p, '.done-tools a');
    await shot(p, '4-tuto7-solved'); await hscreen(p, 'tutoriel 7 bouclé');
    await hit(p, '.done-tools a'); await wait(p);
    const h = await hash(p), h1 = await txt(p, 'h1'), geb = await txt(p, '.game .eyebrow');
    await shot(p, '4-after-tuto7');
    check(t('4 tutoriel 7 bouclé → « Grille suivante » → fiche du jour'), /bouclé/i.test(banner ?? '') && /suivante/i.test(next ?? '') && h === '#/grille/11' && /n° 214/.test(geb ?? ''), `${banner} — « ${next} » → ${h} « ${h1} » ${geb}`);
    check(t('4 aucune erreur JS'), p.errors.length === 0, p.errors.join(' | '));
    await p.context().close();
  }
  // ---------- 5. print previews + overflow on every screen
  {
    const p = await page(b, w);
    for (const id of ['11', '7']) {
      await goto(p, '#/imprimer/' + id);
      const meta = await txt(p, '.a4 .meta'), n = await count(p, '.a4');
      await shot(p, `5-print-${id}`); await hscreen(p, `aperçu impression ${id}`);
      check(t(`5 aperçu #/imprimer/${id}`), n === 1, meta);
    }
    await goto(p, '#/imprimer/tout');
    const all = await p.$$eval('.a4 .meta h1', (e) => e.map((x) => x.textContent));
    await hscreen(p, 'aperçu imprimer tout');
    check(t('5 #/imprimer/tout au 2026-11-21 : 11 feuilles'), all.length === 11, all.join(' | '));
    await p.context().close();
    const q = await page(b, w, { day: '2026-11-20' });
    await goto(q, '#/imprimer/tout');
    const all20 = await q.$$eval('.a4 .meta h1', (e) => e.map((x) => x.textContent));
    check(t('5 #/imprimer/tout au 2026-11-20 : sans la grille future n° 214'), all20.length === 10 && !all20.some((x) => /Plateau d.après-midi/.test(x)), `${all20.length} feuilles`);
    await goto(q, '#/'); await hscreen(q, 'accueil veille');
    await q.context().close();
  }
  const bad = hs[w].filter((x) => !x.ok);
  check(t(`6 aucun scroll horizontal (${hs[w].length} écrans)`), bad.length === 0, bad.map((x) => `${x.name}: ${x.off.join(',')}`).join(' | '));
}

// ---------- 5b. A4 PDFs (print media)
{
  const p = await page(b, 1280);
  for (const id of ['11', '7']) {
    await goto(p, '#/imprimer/' + id);
    await p.emulateMedia({ media: 'print' });
    const foot = await p.$$eval('.a4 .foot > span', (s) => s.map((e) => { const r = e.getBoundingClientRect(), f = e.parentElement.getBoundingClientRect(); const rg = document.createRange(); rg.selectNodeContents(e); const tops = new Set([...rg.getClientRects()].map((q) => Math.round(q.top))); return { text: e.textContent, lines: tops.size, inside: r.left >= f.left - 0.5 && r.right <= f.right + 0.5 }; }));
    const meta = await txt(p, '.a4 .meta');
    const svg = await p.$eval('.a4 .sheet-grid svg', (s) => { const r = s.getBoundingClientRect(); return `${Math.round(r.width)}×${Math.round(r.height)}`; }).catch(() => '?');
    await p.pdf({ path: `${OUT}/5-print-${id}.pdf`, format: 'A4', printBackground: true, preferCSSPageSize: true });
    const raw = fs.readFileSync(`${OUT}/5-print-${id}.pdf`, 'latin1');
    const pages = (raw.match(/\/Type\s*\/Page[^s]/g) || []).length;
    check(`[A4] PDF #/imprimer/${id} : 1 page, numéro et titre du bulletin, n° de pied sur une ligne`, pages === 1 && foot.at(-1).lines === 1 && foot.every((f) => f.inside) && (id !== '11' || /n° 214/.test(meta)), `${pages} page(s) ; meta « ${meta} » ; grille ${svg} ; pied ${JSON.stringify(foot)}`);
    await p.screenshot({ path: `${OUT}/5-print-${id}-media-print.png`, fullPage: true });
    await p.emulateMedia({ media: 'screen' });
  }
  await p.context().close();
}
await b.close();
fs.writeFileSync(`${OUT}/scripts/results.json`, JSON.stringify({ results, overflow: hs }, null, 1));
console.log(`\n${results.filter((r) => r.ok).length}/${results.length} OK`);
