// S7.14 mockup captures (variant b, real code): board card of tutorial 6, G7, G10 and the daily grid,
// before and after an export or a pumping, at 1280 and 375 px, plus the card/svg/logo boxes before and after.
// - Needs `vite preview --port 4662 --strictPort --host 127.0.0.1` on the branch build, and playwright-core.
// - Usage: node mock.mjs → PNGs in ../mock/, boxes in ../mock/moves.json.
import { chromium } from 'playwright-core';
import fs from 'fs';

const BASE = 'http://127.0.0.1:4662/dispatch/';
const OUT = new URL('../mock/', import.meta.url).pathname;
fs.mkdirSync(OUT, { recursive: true });
const b = await chromium.launch({ executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome' });
const moves = [];

const boxes = (p) => p.evaluate(() => {
  const r = (s) => { const e = document.querySelector(s); if (!e) return null; const x = e.getBoundingClientRect(); return [x.left + scrollX, x.top + scrollY, x.width, x.height].map((v) => Math.round(v * 10) / 10); };
  return { card: r('.board-card'), svg: r('.board-svg'), logo: r('.brand svg') };
});
async function tap(p, sel) {
  const l = p.locator(sel).first();
  await l.scrollIntoViewIfNeeded();
  const r = await l.boundingBox();
  if (p.touch) await p.touchscreen.tap(r.x + r.width / 2, r.y + r.height / 2);
  else await p.mouse.click(r.x + r.width / 2, r.y + r.height / 2);
  await p.waitForTimeout(200);
}
const shot = (p, name) => p.locator('.board-card').screenshot({ path: `${OUT}${name}.png` });

for (const w of [1280, 375]) {
  const touch = w < 860;
  const ctx = await b.newContext({ viewport: { width: w, height: 1000 }, hasTouch: touch, isMobile: touch, deviceScaleFactor: 1 });
  const p = await ctx.newPage();
  p.touch = touch;
  for (const id of [6, 7, 10, 11]) {
    await p.goto(BASE + '#/');
    await p.evaluate(() => localStorage.clear());
    await p.goto(BASE + `#/grille/${id}`);
    await p.reload();
    await p.waitForSelector('.board-svg');
    await p.waitForTimeout(300);
    const before = await boxes(p);
    await shot(p, `g${id}-${w}`);
    if (id === 6 || id === 11) {
      await tap(p, `.board-svg [data-act="export"][data-col="${id === 6 ? 1 : 2}"]`);
      await shot(p, `g${id}-export-${w}`);
      moves.push({ grid: id, width: w, step: 'export', before, after: await boxes(p) });
    }
    if (id === 7) {
      await tap(p, touch ? '.chip[data-piece="STEP"]' : '.prow[data-piece="STEP"]');
      await shot(p, `g7-step-${w}`);
      await tap(p, '.board-svg [data-act="step-arrow"][data-col="2"]');
      await shot(p, `g7-pump-${w}`);
      moves.push({ grid: id, width: w, step: 'pump', before, after: await boxes(p) });
      await tap(p, '.board-svg [data-act="step-arrow"][data-col="5"]');
      await shot(p, `g7-pair-${w}`);
      moves.push({ grid: id, width: w, step: 'turbine', before, after: await boxes(p) });
    }
  }
  await ctx.close();
}
await b.close();
const same = (a, c) => ['card', 'svg', 'logo'].every((k) => a[k] && c[k] && a[k].every((v, i) => Math.abs(v - c[k][i]) < 0.6));
for (const m of moves) console.log(`${same(m.before, m.after) ? 'OK  ' : 'MOVE'} G${m.grid}@${m.width} ${m.step}`);
fs.writeFileSync(`${OUT}moves.json`, JSON.stringify(moves, null, 1));
