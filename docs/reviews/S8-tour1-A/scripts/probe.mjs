// Ad-hoc DOM probes for the S8.1 review (usage: node probe.mjs <width> <hash> <js-expression>).
import { chromium } from 'playwright-core';
const [w, hash, expr] = process.argv.slice(2);
const b = await chromium.launch({ executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome' });
const ctx = await b.newContext({ viewport: { width: +w, height: 860 }, hasTouch: +w < 860, isMobile: +w < 860 });
const p = await ctx.newPage();
await p.goto((hash.startsWith('http') ? '' : 'http://127.0.0.1:4672/dispatch/') + hash); await p.waitForTimeout(400);
console.log(JSON.stringify(await p.evaluate(expr), null, 1));
await b.close();
