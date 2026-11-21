import { chromium } from 'playwright-core';
const b = await chromium.launch({ executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome' });
for (const w of [1280, 375]) {
  const p = await b.newPage({ viewport: { width: w, height: 900 } });
  for (const h of ['#/', '#/grille/11', '#/dossier/premiers-pas']) {
    await p.goto('http://127.0.0.1:4624/dispatch/' + h); await p.waitForTimeout(250);
    console.log(w, h, await p.evaluate(() => { const r = (s) => document.querySelector(s)?.getBoundingClientRect(); const sh = r('.site-head'), br = r('.brand'), lg = r('.brand svg'); return `head h=${sh.height.toFixed(1)} top=${sh.top.toFixed(1)} | brand top=${br.top.toFixed(1)} h=${br.height.toFixed(1)} | svg top=${lg.top.toFixed(1)} | .m max=${getComputedStyle(document.querySelector('.m')).maxWidth}`; }));
  }
  await p.close();
}
await b.close();
