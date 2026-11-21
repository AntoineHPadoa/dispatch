// S7.7 replay: logo position per page, no horizontal scroll, dossier cards, tab icon at 16/32 px.
import { chromium } from 'playwright-core';
const BASE = 'http://127.0.0.1:4625/dispatch/';
const OUT = new URL('../after/', import.meta.url).pathname;
const b = await chromium.launch({ executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome' });
for (const w of [1280, 375, 320]) {
  const touch = w < 860;
  for (const [name, hash, prog] of [['home', '#/'], ['home-done', '#/', { 11: { status: 'done' } }], ['game-g11', '#/grille/11'], ['dossier', '#/dossier/premiers-pas']]) {
    const ctx = await b.newContext({ viewport: { width: w, height: 900 }, hasTouch: touch, isMobile: touch, deviceScaleFactor: 2 });
    const p = await ctx.newPage();
    await p.goto(BASE); await p.evaluate((v) => localStorage.setItem('dispatch:progress:v1', JSON.stringify({ grids: v })), prog ?? {}); await p.goto(BASE + hash); await p.reload(); await p.waitForTimeout(400);
    const top = await p.evaluate(() => { const e = document.querySelector('.game .ttl .eyebrow'); const c = document.querySelector('.board-svg rect[fill="#fff"], .board-svg rect'); return e ? e.getBoundingClientRect().top : null; });
    const m = await p.evaluate(() => ({ over: document.documentElement.scrollWidth - innerWidth, y: document.querySelector('.brand svg').getBoundingClientRect().top, x: document.querySelector('.brand svg').getBoundingClientRect().left, h: document.querySelector('.site-head').getBoundingClientRect().height }));
    console.log(`${name}@${w}: overflow ${m.over}, logo x=${m.x.toFixed(1)} y=${m.y.toFixed(1)}, head h=${m.h.toFixed(1)}, eyebrow y=${top}`);
    await p.screenshot({ path: `${OUT}${name}-${w}.png`, fullPage: true });
    await ctx.close();
  }
}
const p = await b.newPage({ viewport: { width: 280, height: 80 }, deviceScaleFactor: 1 });
await p.goto(BASE); await p.waitForTimeout(300);
console.log('icon links:', await p.$$eval('link[rel~="icon"]', (l) => l.map((e) => e.getAttribute('href'))));
const href = BASE + 'icon.svg';
await p.setContent(`<body style="margin:0;display:flex;gap:16px;align-items:center;padding:16px;background:#dee1e6"><img src="${href}" width="16" height="16"><img src="${href}" width="32" height="32"><span style="background:#fff;padding:6px 10px;border-radius:8px;display:flex;gap:6px;align-items:center;font:12px system-ui"><img src="${href}" width="16" height="16">Dispatch</span><span style="background:#35363a;color:#fff;padding:6px 10px;border-radius:8px;display:flex;gap:6px;align-items:center;font:12px system-ui"><img src="${href}" width="16" height="16">Dispatch</span></body>`);
await p.waitForTimeout(300);
await p.screenshot({ path: `${OUT}favicon-dpr1.png` });
await b.close();
