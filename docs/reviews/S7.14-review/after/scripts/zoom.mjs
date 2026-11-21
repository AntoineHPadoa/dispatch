// Zoom on the G7 paper sheet: the programme bar under the rectangle's thick bottom line.
// - Usage: node zoom.mjs (vite preview on 127.0.0.1:4671).
import { chromium } from 'playwright-core';
const b = await chromium.launch({ executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome' });
const p = await (await b.newContext({ viewport: { width: 900, height: 1200 }, deviceScaleFactor: 4 })).newPage();
await p.goto('http://127.0.0.1:4671/dispatch/#/imprimer/7');
await p.waitForSelector('.a4 .board-svg');
const info = await p.evaluate(() => {
  const svg = document.querySelector('.a4 .board-svg');
  const cell = +svg.dataset.cell, rows = +svg.dataset.rows;
  const bar = [...svg.querySelectorAll('rect[height="4"][rx="2"]')].map((r) => ({ y: +r.getAttribute('y'), x: +r.getAttribute('x'), w: +r.getAttribute('width') }));
  const r = svg.getBoundingClientRect();
  return { cell, rows, bar, box: [r.left, r.top, r.width, r.height] };
});
console.log(JSON.stringify(info));
const [x, y, w, h] = info.box;
await p.screenshot({ path: new URL('../sheet-g7-bar-zoom.png', import.meta.url).pathname, clip: { x: x + w * 0.5, y: y + h * 0.62, width: w * 0.5, height: h * 0.2 } });
await b.close();
