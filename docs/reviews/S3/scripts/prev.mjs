import { launch, OUT, BASE } from './lib.mjs';
const b = await launch();
for (const w of [320, 1280]) {
  const ctx = await b.newContext({ viewport: { width: w, height: 900 }, deviceScaleFactor: 2, hasTouch: w < 860, isMobile: w < 860 });
  const p = await ctx.newPage();
  await p.goto(BASE + '#/imprimer/7'); await p.waitForTimeout(500);
  console.log(w, 'hscroll', await p.evaluate(() => document.documentElement.scrollWidth - innerWidth));
  await p.screenshot({ path: `${OUT}/print-preview-g7-${w}.png`, fullPage: true });
  await ctx.close();
}
await b.close();
