// Scroll slider survey: for each published grid and window width, is the board slider shown, and by how much the board scrolls.
// - Usage: node slider-survey.mjs <base> <minW> <maxW> <step> <touch 0|1> [ids]
import { createRequire } from 'node:module';
import fs from 'node:fs';
const require = createRequire('/Users/padoa/node_modules/');
const { chromium } = require('playwright-core');
const [BASE, MIN, MAX, STEP, TOUCH, IDS] = process.argv.slice(2);
const grids = JSON.parse(fs.readFileSync('/Users/padoa/Programs/spot-elec-v3-ui-gallery/web/src/data/grids.json'));
const ids = IDS ? IDS.split(',').map(Number) : grids.map((g) => g.id);
const touch = TOUCH === '1';
const b = await chromium.launch({ executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome' });
for (const id of ids) {
  const out = [];
  for (let w = +MIN; w <= +MAX; w += +STEP) {
    // Fresh context per width: no resize history, as when a page is opened in that window.
    const ctx = await b.newContext({ viewport: { width: w, height: touch ? 812 : 800 }, hasTouch: touch, isMobile: touch, deviceScaleFactor: 1 });
    const p = await ctx.newPage();
    await p.goto(`${BASE}#/grille/${id}`);
    await p.waitForSelector('.board-svg');
    await p.waitForTimeout(80);
    const r = await p.evaluate(() => {
      const s = document.querySelector('.board-scroll'); const sl = document.querySelector('.board-slider');
      const shown = !!sl && !sl.hidden && sl.getBoundingClientRect().width > 0 && getComputedStyle(sl).display !== 'none';
      return { shown, over: s.scrollWidth - s.clientWidth };
    });
    out.push(`${w}:${r.shown ? 'Y' : 'n'}${r.over}`);
    await ctx.close();
  }
  console.log(id, out.join(' '));
}
await b.close();
