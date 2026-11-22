// S8.5: two players rate and comment the same lab candidate in Chrome (lab/run.sh running, dev server on 5173).
// - Joueur 1 solves candidate 0 of nuit-jouer-a, rates 4 with a comment; Joueur 2 solves it, rates 2 without one.
// - Checks notes.json keeps both players' ratings and Joueur 1's comment, and that each end screen shows
//   the player's own comment in the box and the other's under the reveal.
// - Usage: `node lab-two-players.mjs` (playwright-core from web/); revert lab data after.
import { createRequire } from 'module';
import fs from 'fs';
const require = createRequire(new URL('../../../../web/package.json', import.meta.url));
const { chromium } = require('playwright-core');
const { playSolutionOn } = await import('../../S8-tour1-A/scripts/solve-helper.mjs');

const BASE = 'http://localhost:5173/dispatch/lab.html';
const LAB = new URL('../../../../lab/', import.meta.url).pathname;
const LOT = 'nuit-jouer-a';
const results = [];
const check = (name, ok, detail = '') => {
  results.push({ name, ok: !!ok });
  console.log(`${ok ? 'OK  ' : 'KO  '} ${name}${!ok && detail ? ' — ' + String(detail).slice(0, 300) : ''}`);
};
const data = JSON.parse(fs.readFileSync(`${LAB}candidates/${LOT}.json`));
const cands = data.grids ?? data.candidates ?? data;
const b = await chromium.launch({ executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome' });
const ctx = await b.newContext({ viewport: { width: 1280, height: 900 } });
const p = await ctx.newPage();
const errors = [];
p.on('pageerror', (e) => errors.push(e.message));
p.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });

async function playAs(player, felt, comment) {
  await p.goto(BASE + '#/'); await p.waitForSelector('#lab-lot');
  await p.click(`[data-player="${player}"]`); await p.waitForTimeout(300);
  await p.selectOption('#lab-lot', LOT); await p.waitForTimeout(500);
  await p.click('.lab-row >> nth=0'); await p.waitForTimeout(300);
  const idx = await p.evaluate(() => +document.querySelector('.lab-row.sel')?.dataset.i);
  await p.click('[data-play]'); await p.waitForSelector('.board-svg'); await p.waitForTimeout(300);
  await playSolutionOn(p, cands[idx]); await p.waitForTimeout(400);
  await p.click('#lab-finish'); await p.waitForTimeout(500);
  const box = await p.inputValue('#lab-comment');
  await p.click(`[data-felt="${felt}"]`); await p.fill('#lab-comment', comment);
  await p.click('#lab-reveal'); await p.waitForTimeout(600);
  return { idx, box, reveal: await p.evaluate(() => document.querySelector('.lab-reveal')?.innerText ?? '') };
}

const one = await playAs('Joueur 1', 4, 'trop dur');
check('Joueur 1: empty comment box before rating', one.box === '', one.box);
const two = await playAs('Joueur 2', 2, '');
check('Joueur 2: own box empty (Joueur 1 comment not prefilled)', two.box === '', two.box);
check('Joueur 2: reveal shows Joueur 1 comment', /Joueur 1 : trop dur/.test(two.reveal), two.reveal);
const note = JSON.parse(fs.readFileSync(`${LAB}notes.json`))[`${LOT}:${one.idx}`];
check('notes.json keeps both ratings', note?.felt?.['Joueur 1'] === 4 && note?.felt?.['Joueur 2'] === 2, JSON.stringify(note));
check('notes.json keeps Joueur 1 comment', JSON.stringify(note?.comment) === JSON.stringify({ 'Joueur 1': 'trop dur' }), JSON.stringify(note));
const again = await playAs('Joueur 1', 3, 'trop dur, encore');
check('Joueur 1 replay: box prefilled with own comment', again.box === 'trop dur', again.box);
const after = JSON.parse(fs.readFileSync(`${LAB}notes.json`))[`${LOT}:${one.idx}`];
check('notes.json: Joueur 1 comment updated, felt kept at first rating', after.comment['Joueur 1'] === 'trop dur, encore' && after.felt['Joueur 1'] === 4, JSON.stringify(after));
check('no console/JS error', !errors.length, errors.join(' | '));
console.log(`${results.filter((r) => r.ok).length}/${results.length} OK`);
await b.close();
