import { launch, open, check, hit, lay, choose, tool, OUT, results } from './lib.mjs';
import fs from 'fs';
const b = await launch();
for (const w of [375, 320]) {
  const p = await open(b, w, 7, { height: 560 });
  const l = p.locator('.side [data-piece="STEP"]');
  await l.scrollIntoViewIfNeeded();
  await p.evaluate(() => { const r = document.querySelector(".side [data-piece=\"STEP\"]").getBoundingClientRect(); window.scrollBy(0, r.top - 20); });
  const before = await p.evaluate(() => scrollY);
  const box = await l.boundingBox();
  await p.touchscreen.tap(box.x + box.width / 2, box.y + box.height / 2);
  await p.waitForTimeout(400);
  const after = await p.evaluate(() => scrollY);
  const chipTop = await p.$eval('.chips', (e) => e.getBoundingClientRect().top);
  check(`[${w}] choisir STEP dans le carnet (page défilée) : la page ne saute pas`, Math.abs(after - before) < 5, `scrollY ${before} → ${after}, rangée à ${Math.round(chipTop)}px du haut`);
  await p.screenshot({ path: `${OUT}/row-4-book-tap-${w}.png` });
  await p.context().close();
}
await b.close();
fs.writeFileSync('jump-results.json', JSON.stringify(results, null, 1));
