import { chromium } from 'playwright';
import { readFileSync, existsSync } from 'node:fs';
const S = process.env.S, OUT = '/Users/padoa/Programs/spot-elec-wt/v2-lab/docs/reviews/S5';
const BASE = 'http://localhost:5173/dispatch/lab.html';
const plays = () => existsSync(S + '/labdata/plays.jsonl') ? readFileSync(S + '/labdata/plays.jsonl', 'utf8').trim().split('\n').filter(Boolean).map(JSON.parse) : [];
const log = (...a) => console.log(...a);
const browser = await chromium.launch({ channel: 'chrome' });
const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 } });
const p = await ctx.newPage();
const errs = []; p.on('pageerror', (e) => errs.push(e.message));
async function cellXY(row, col) {
  return p.evaluate(([row, col]) => {
    const svg = document.querySelector('.board-svg'); const sc = document.querySelector('.board-scroll');
    const cell = +svg.dataset.cell, rows = +svg.dataset.rows, top = +svg.dataset.top;
    const r = svg.getBoundingClientRect(); const sx = +svg.getAttribute('width') / r.width, sy = +svg.getAttribute('height') / r.height;
    return { x: r.left + (col * cell + cell / 2 + 2) / sx, y: r.top + (top + (rows - 1 - row) * cell + cell / 2) / sy };
  }, [row, col]);
}
async function lay(row, col, len) { const a = await cellXY(row, col), b = await cellXY(row, col + len - 1); await p.mouse.move(a.x, a.y); await p.mouse.down(); await p.mouse.move(b.x, b.y, { steps: 6 }); await p.mouse.up(); await p.waitForTimeout(120); }

// 1. list
await p.goto(BASE + '#/'); await p.waitForSelector('.lab-tbl tbody tr');
const listText = await p.textContent('#app');
log('LIST shows techniques names:', /single_cover|ribbon|column_sum/.test(listText), '| rating header:', await p.$$eval('th', (t) => t.map((x) => x.textContent).join('|')));
log('LIST hscroll', await p.evaluate(() => document.documentElement.scrollWidth - innerWidth));
await p.screenshot({ path: OUT + '/list-1280.png', fullPage: true });

// 2. blind play candidate 1 as Joueur 1
await p.goto(BASE + '#/partie/demo/1'); await p.waitForSelector('.board-svg'); await p.waitForTimeout(300);
const html = await p.content();
log('PLAY title:', await p.title(), '| techniques in DOM:', /single_cover|silhouette"|exhausted|Facile/.test(await p.textContent('body')));
const pieces = await p.$$eval('.side [data-piece]', (b) => b.map((x) => x.getAttribute('data-piece')));
log('pieces', pieces);
await p.screenshot({ path: OUT + '/play-1280.png', fullPage: true });
await p.click(`.side [data-piece="${pieces[0]}"]`); await p.waitForTimeout(80);
await lay(0, 0, 1); log('m1', (await p.textContent('.msg-slot')).trim()); await lay(0, 0, 4); log('m2', (await p.textContent('.msg-slot')).trim()); await lay(1, 2, 4); log('m3', (await p.textContent('.msg-slot')).trim());
log('msg after poses:', (await p.textContent('.msg-slot')).trim());
for (let k = 0; k < 2; k++) if (await p.isEnabled('.tools [data-tool="undo"]')) { await p.click('.tools [data-tool="undo"]'); await p.waitForTimeout(80); }
await p.waitForTimeout(2500);
const before = plays().length;
await p.click('#lab-giveup'); await p.waitForURL(/#\/fin\/demo\/1/); await p.waitForTimeout(300);
const last = plays().at(-1); log('PLAY record:', plays().length - before, JSON.stringify(last));
log('END reveal locked:', (await p.textContent('.lab-reveal')).trim().slice(0, 60));
await p.screenshot({ path: OUT + '/end-locked-1280.png', fullPage: true });
await p.click('[data-felt="2"]'); await p.click('#lab-reveal'); await p.waitForSelector('.lab-cmp');
await p.screenshot({ path: OUT + '/end-revealed-1280.png', fullPage: true });

// 3. reload mid-game: is anything recorded?
let n0 = plays().length;
await p.goto(BASE + '#/partie/demo/2'); await p.waitForSelector('.board-svg'); await p.waitForTimeout(3000);
await p.reload(); await p.waitForSelector('.board-svg'); await p.waitForTimeout(500);
log('RELOAD records added:', plays().length - n0, '| timer after reload:', await p.textContent('#lab-timer'));
// close tab mid-game
await p.waitForTimeout(2500);
n0 = plays().length; await p.close({ runBeforeUnload: true }); await new Promise((r) => setTimeout(r, 800));
log('CLOSE records added:', plays().length - n0);

// 4. switch player during a game
const q = await ctx.newPage(); q.on('pageerror', (e) => errs.push(e.message));
await q.goto(BASE + '#/partie/demo/2'); await q.waitForSelector('.board-svg'); await q.waitForTimeout(2500);
await q.click('[data-player="Joueur 2"]'); await q.waitForTimeout(200);
log('STRIP after switch:', (await q.textContent('.lab-strip')).replace(/\s+/g, ' '));
await q.click('#lab-giveup'); await q.waitForURL(/#\/fin/); await q.waitForTimeout(300);
log('SWITCH record player:', plays().at(-1).player, '| end screen player:', await q.$eval('.lab-kv dd', (d) => d.textContent));
await q.click('[data-felt="4"]'); await q.click('#lab-reveal'); await q.waitForSelector('.lab-cmp');
const notes = JSON.parse(readFileSync(S + '/labdata/notes.json', 'utf8'));
log('SWITCH felt stored:', JSON.stringify(notes['demo:2'].felt));

// 5. end screen reachable without playing
await q.goto(BASE + '#/fin/demo/3'); await q.waitForSelector('#lab-reveal');
log('FIN without play: chip =', await q.textContent('.lab-head .lab-chip'));

// 6. hidden tab: does the recorder pause?
await q.goto(BASE + '#/partie/demo/3'); await q.waitForSelector('.board-svg');
const t0 = await q.textContent('#lab-timer');
await q.evaluate(() => { Object.defineProperty(document, 'visibilityState', { value: 'hidden', configurable: true }); Object.defineProperty(document, 'hidden', { value: true, configurable: true }); document.dispatchEvent(new Event('visibilitychange')); });
await q.waitForTimeout(3000);
log('HIDDEN timer', t0, '->', await q.textContent('#lab-timer'));

// 7. kept screen + promotion via UI
await q.goto(BASE + '#/gardees'); await q.waitForTimeout(800);
await q.screenshot({ path: OUT + '/kept-1280.png', fullPage: true });
log('KEPT rows:', await q.$$eval('tr[data-k]', (r) => r.length));
log('localStorage keys:', await q.evaluate(() => Object.keys(localStorage)));
log('page errors:', errs);
await browser.close();
