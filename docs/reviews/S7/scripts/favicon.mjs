// Renders the tab icon (link[rel=icon] of the live page) at 16 and 32 px, at DPR 1 and 2.
import { chromium } from 'playwright-core';
const b = await chromium.launch({ executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome' });
const OUT = new URL('../', import.meta.url).pathname;
for (const dpr of [1, 2]) {
  const p = await b.newPage({ viewport: { width: 260, height: 80 }, deviceScaleFactor: dpr });
  await p.goto('http://127.0.0.1:4624/dispatch/'); await p.waitForTimeout(300);
  const links = await p.$$eval('link[rel~="icon"]', (l) => l.length);
  const href = await p.$eval('link[rel~="icon"]', (e) => e.href);
  const svg = decodeURIComponent(href.split(',')[1]);
  if (dpr === 1) console.log('icon links:', links, '| svg uses class-only colours:', !/fill="#/.test(svg), '\n', svg.slice(0, 600));
  await p.setContent(`<body style="margin:0;display:flex;gap:16px;align-items:center;padding:16px;background:#dee1e6">
    <img src="${href}" width="16" height="16"><img src="${href}" width="32" height="32">
    <span style="background:#fff;padding:6px 10px;border-radius:8px;display:flex;gap:6px;align-items:center;font:12px system-ui"><img src="${href}" width="16" height="16">Dispatch</span>
    <span style="background:#35363a;color:#fff;padding:6px 10px;border-radius:8px;display:flex;gap:6px;align-items:center;font:12px system-ui"><img src="${href}" width="16" height="16">Dispatch</span></body>`);
  await p.waitForTimeout(200);
  await p.screenshot({ path: `${OUT}f-favicon-dpr${dpr}.png` });
  await p.close();
}
await b.close();
