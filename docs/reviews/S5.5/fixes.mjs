// Real-Chrome check of the "à corriger" and minor fixes visible in the UI (C1, C2, C4, C7, M3, M4, M6).
// Usage: DATA=<lab dir> OUT=<capture dir> node fixes.mjs
import { chromium } from 'playwright';
import { readFileSync } from 'node:fs';
const DATA = process.env.DATA, OUT = process.env.OUT;
const BASE = 'http://localhost:5173/dispatch/lab.html';
const plays = () => readFileSync(DATA + '/plays.jsonl', 'utf8').trim().split('\n').filter(Boolean).map((l) => JSON.parse(l));
let failures = 0;
const check = (name, ok, info = '') => { console.log(`${ok ? 'PASS' : 'FAIL'} ${name} ${info}`); if (!ok) failures++; };
const b = await chromium.launch({ channel: 'chrome' });
const p = await (await b.newContext({ viewport: { width: 1280, height: 900 } })).newPage();
const errors = []; p.on('pageerror', (e) => errors.push(e.message));
await p.goto(BASE); await p.waitForSelector('.lab-row');
await p.click('[data-player="Joueur 1"]');
// C1 + C7: selector frozen during a game, game shown as Candidate 1 (index 0), end screen on the player of the game
await p.click('tr[data-i="3"]'); await p.click('[data-play="3"]'); await p.waitForSelector('.board-svg');
check('C7 candidate index 0..3 shown from 1', /Candidate 4/.test(await p.innerText('.lab-strip')));
check('C1 player buttons disabled during a game', await p.$$eval('[data-player]', (els) => els.every((e) => e.disabled)));
// C2: hidden tab time is not counted
await p.waitForTimeout(1500);
await p.evaluate(() => { Object.defineProperty(document, 'hidden', { configurable: true, get: () => true }); document.dispatchEvent(new Event('visibilitychange')); });
await p.waitForTimeout(3000);
const frozen = await p.innerText('#lab-timer');
await p.evaluate(() => { Object.defineProperty(document, 'hidden', { configurable: true, get: () => false }); document.dispatchEvent(new Event('visibilitychange')); });
await p.waitForTimeout(600);
check('C2 timer frozen while hidden', /00:0[0-2]/.test(frozen), frozen);
await p.click('#lab-giveup'); await p.waitForSelector('#lab-felt');
const last = plays().at(-1);
check('C2 ms excludes the hidden 3 s', last.wall_ms - last.ms >= 2800 && last.ms < last.wall_ms, `ms=${last.ms} wall=${last.wall_ms}`);
check('C1 end screen shows the player of the game', /Joueur 1/.test(await p.innerText('.lab-kv')));
await p.click('[data-player="Joueur 2"]'); await p.waitForTimeout(300);
await p.click('[data-felt="2"]'); await p.click('#lab-reveal'); await p.waitForSelector('.lab-cmp');
await p.waitForTimeout(300);
const rated = plays().at(-1);
check('C1 rating goes to the player of the game after a selector change', rated.player === 'Joueur 1' && rated.felt === 2, JSON.stringify([rated.player, rated.felt]));
const notes = JSON.parse(readFileSync(DATA + '/notes.json', 'utf8'));
check('C1 notes.felt only under Joueur 1', JSON.stringify(notes['demo:3'].felt) === '{"Joueur 1":2}', JSON.stringify(notes['demo:3']));
check('M6 technique chips in French', /Épuisement|Couverture|Flux|Place|Record|Silhouette|Ruban/.test(await p.innerText('.lab-reveal')) && !/single_cover|exhausted/.test(await p.innerText('.lab-reveal')));
await p.screenshot({ path: OUT + '/C1-end-1280.png' });
// M4: kept screen, status column visible at 1280
await p.click('#lab-keep'); await p.waitForTimeout(200);
await p.goto(BASE + '#/gardees'); await p.waitForSelector('tr[data-k]');
const fits = await p.evaluate(() => { const t = document.querySelector('.lab-tbl.compact'); return t.scrollWidth <= t.clientWidth + 1; });
check('M4 kept table fits without a cut Statut column', fits);
await p.screenshot({ path: OUT + '/M4-kept-1280.png' });
check('no horizontal page scroll', await p.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
check('no JS error', errors.length === 0, errors.join(';'));
await b.close();
console.log(failures ? `${failures} FAILURE(S)` : 'ALL OK');
process.exit(failures ? 1 : 0);
