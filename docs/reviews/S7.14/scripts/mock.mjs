// S7.14 mockup captures: the board card of G10, G7, tutorial 6 and the daily grid, with each placement of the slot clues.
// Needs `vite preview --port 4661 --strictPort` on a build that still has the temporary window.__bands switch.
import { chromium } from 'playwright-core';
const BASE = 'http://127.0.0.1:4661/dispatch/';
const OUT = new URL('../mock/', import.meta.url).pathname;
const b = await chromium.launch({ executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome' });
for (const bands of ['rows', 'shared']) {
  for (const w of [1280, 375]) {
    const touch = w < 860;
    const ctx = await b.newContext({ viewport: { width: w, height: 1000 }, hasTouch: touch, isMobile: touch, deviceScaleFactor: 1 });
    await ctx.addInitScript(`window.__bands='${bands}'`);
    const p = await ctx.newPage();
    for (const id of [10, 7, 6, 11, 4]) {
      await p.goto(BASE + '#/');
      await p.evaluate(() => localStorage.clear());
      await p.goto(BASE + `#/grille/${id}`);
      await p.reload();
      await p.waitForSelector('.board-svg');
      await p.waitForTimeout(300);
      await p.locator('.board-card').screenshot({ path: `${OUT}${bands}-g${id}-${w}.png` });
      if (id === 6 || id === 11) {
        const cell = p.locator('.board-svg [data-act="export"]').nth(2);
        await cell.scrollIntoViewIfNeeded();
        const r = await cell.boundingBox();
        if (touch) await p.touchscreen.tap(r.x + r.width / 2, r.y + r.height / 2); else await p.mouse.click(r.x + r.width / 2, r.y + r.height / 2);
        await p.waitForTimeout(200);
        await p.locator('.board-card').screenshot({ path: `${OUT}${bands}-g${id}-export-${w}.png` });
      }
      if (id === 7) {
        const sel = w < 861 ? '.chip[data-piece="STEP"]' : '.prow[data-piece="STEP"]';
        await p.locator(sel).first().click().catch(async () => { const r = await p.locator(sel).first().boundingBox(); await p.touchscreen.tap(r.x + 10, r.y + 10); });
        await p.waitForTimeout(150);
        const a = p.locator('.board-svg [data-act="step-arrow"][data-col="2"]');
        const r = await a.boundingBox();
        if (touch) await p.touchscreen.tap(r.x + r.width / 2, r.y + r.height / 2); else await p.mouse.click(r.x + r.width / 2, r.y + r.height / 2);
        await p.waitForTimeout(200);
        await p.locator('.board-card').screenshot({ path: `${OUT}${bands}-g7-pump-${w}.png` });
      }
    }
    await ctx.close();
  }
}
await b.close();
