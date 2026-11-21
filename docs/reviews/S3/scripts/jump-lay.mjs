import { launch, open, check, lay, choose, cellXY, OUT, results } from './lib.mjs';
import fs from 'fs';
const b = await launch();
for (const w of [375, 320]) {
  const p = await open(b, w, 7, { height: 640 });
  await p.evaluate(() => { const r = document.querySelector('.board-svg').getBoundingClientRect(); window.scrollBy(0, r.top - 10); });
  const before = await p.evaluate(() => scrollY);
  const chipsBottom = await p.$eval('.chips', (e) => Math.round(e.getBoundingClientRect().bottom));
  await lay(p, 0, 0, 3);
  await p.waitForTimeout(300);
  const after = await p.evaluate(() => scrollY);
  check(`[${w}] poser une barre avec la rangée sous le pli : la page ne saute pas`, Math.abs(after - before) < 5, `scrollY ${before} → ${after}, bas de la rangée à ${chipsBottom}px pour 640px`);
  await p.context().close();
}
await b.close();
fs.writeFileSync('jump2-results.json', JSON.stringify(results, null, 1));
