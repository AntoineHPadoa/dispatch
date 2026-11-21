// Captures for S7.2 to S7.5 at 1280, 375 and 320 px, plus a horizontal-scroll check.
import { chromium } from 'playwright-core';
const BASE = 'http://127.0.0.1:4173/dispatch/';
const ROOT = new URL('../../', import.meta.url).pathname;
const KEY = 'dispatch:progress:v1';
const sol = (g) => ({ bars: [], exports: {}, step: [] });
const jobs = [
  { dir: 'S7.2', name: 'home', hash: '#/', progress: {} },
  { dir: 'S7.2', name: 'game-g11', hash: '#/grille/11', progress: {} },
  { dir: 'S7.2', name: 'game-g7', hash: '#/grille/7', progress: {} },
  { dir: 'S7.3', name: 'dossier', hash: '#/dossier/premiers-pas', progress: { 1: { status: 'done' }, 2: { status: 'done' }, 3: { status: 'started' } } },
  { dir: 'S7.5', name: 'home-done', hash: '#/', progress: { 11: { status: 'done' } } },
  { dir: 'S7.4', name: 'step-pair', hash: '#/grille/7', progress: { 7: { status: 'started', state: { bars: [], exports: {}, step: [{ pump: 3, turbine: 5 }] } } } },
];
const b = await chromium.launch({ executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome' });
for (const w of [1280, 375, 320]) {
  for (const j of jobs) {
    const touch = w < 860;
    const ctx = await b.newContext({ viewport: { width: w, height: 900 }, hasTouch: touch, isMobile: touch, deviceScaleFactor: 2 });
    const p = await ctx.newPage();
    await p.goto(BASE);
    await p.evaluate(([k, v]) => localStorage.setItem(k, JSON.stringify({ grids: v })), [KEY, j.progress]);
    await p.goto(BASE + j.hash);
    await p.reload();
    await p.waitForTimeout(400);
    const over = await p.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
    const logoX = await p.evaluate(() => document.querySelector('.brand')?.getBoundingClientRect().left ?? null);
    console.log(`${j.dir}/${j.name}@${w}: overflow ${over}px, logo x=${logoX}`);
    await p.screenshot({ path: `${ROOT}${j.dir}/${j.name}-${w}.png`, fullPage: true });
    await ctx.close();
  }
}
await b.close();
