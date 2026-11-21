import puppeteer from '/Users/padoa/Downloads/padoa-dev-timeline/node_modules/puppeteer-core/lib/esm/puppeteer/puppeteer-core.js';
import fs from 'fs';
const OUT = '/Users/padoa/Programs/spot-elec-wt/v2-menu/docs/reviews/S2-finition-1/after';
const grids = JSON.parse(fs.readFileSync('/Users/padoa/Programs/spot-elec-wt/v2-menu/web/src/data/grids.json','utf8'));
const base = 'http://127.0.0.1:4517/dispatch/';
function solved(g){ const ex={}; for (const [k,v] of Object.entries(g.solution.exports||{})) ex[k]=v;
  return { bars: g.solution.placements.map(p=>({...p})), exports: ex, step: g.solution.step||[] }; }
const browser = await puppeteer.launch({ executablePath:'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', headless:true });
const log=[];
const fakeDate = (iso)=>`(()=>{const R=Date,off=new R('${iso}T10:00:00').getTime()-R.now();class D extends R{constructor(...a){a.length?super(...a):super(R.now()+off)} static now(){return R.now()+off}};window.Date=D;})()`;
for (const w of [1280,375,320]) {
  for (const day of ['2026-11-21','2026-11-20']) {
    const ctx = await browser.createIncognitoBrowserContext(); const page = await ctx.newPage();
    await page.setViewport({width:w,height:900});
    await page.evaluateOnNewDocument(fakeDate(day));
    const errs=[]; page.on('pageerror',e=>errs.push(String(e)));
    const shot = async (n)=>{ await page.screenshot({path:`${OUT}/${n}-${w}.png`, fullPage:true}); };
    const txt = (s)=>page.$eval(s,e=>e.textContent).catch(()=>null);
    const ovf = async()=>page.evaluate(()=>document.documentElement.scrollWidth<=document.documentElement.clientWidth);
    const go = async(h)=>{ await page.goto(base+h,{waitUntil:'load'}); await page.reload({waitUntil:'load'}); };
    const setProg = async(p)=>{ await page.goto(base,{waitUntil:'load'}); await page.evaluate(p=>localStorage.setItem('dispatch:progress:v1',JSON.stringify(p)),p); };
    if (day==='2026-11-21') {
      const g11 = grids.find(g=>g.id===11), g8 = grids.find(g=>g.id===8);
      // 2: home -> take shift -> grid -> back
      await setProg({grids:{}}); await page.goto(base,{waitUntil:'load'});
      await page.click('.sheet .btn'); await new Promise(r=>setTimeout(r,300));
      const h1=await txt('h1'), eb=await txt('.game .eyebrow'), back=await txt('.backlink'), title=await page.title();
      log.push({w,i:2,hash:await page.evaluate(()=>location.hash),h1,eb,back,title,ovf:await ovf()}); await shot('2-grid');
      await page.click('.backlink'); await new Promise(r=>setTimeout(r,200));
      log.push({w,i:2,backHash:await page.evaluate(()=>location.hash)}); await shot('2-home-back');
      // 3: solved
      await setProg({grids:{'11':{status:'done',state:solved(g11),elapsedMs:90000}}}); await page.goto(base+'#/grille/11'); await page.reload({waitUntil:'load'});
      log.push({w,i:3,banner:await txt('.banner b'),home:await txt('.done-tools a'),ovf:await ovf()}); await shot('3-grid-solved');
      await page.goto(base+'#/'); await new Promise(r=>setTimeout(r,200));
      log.push({w,i:3,stamp:await txt('.sheet .stamp'),silDone:await page.$$eval('.sil-cell.done',e=>e.length),ovf:await ovf()}); await shot('3-home-stamp');
      // 4: tutorial 7 solved -> next
      const t7=grids.find(g=>g.id===7);
      await setProg({grids:{'7':{status:'done',state:solved(t7),elapsedMs:60000}}}); await page.goto(base+'#/grille/7'); await page.reload({waitUntil:'load'});
      const nx=await page.$('.done-tools a'); log.push({w,i:4,next:await txt('.done-tools a'),href:await page.$eval('.done-tools a',e=>e.getAttribute('href'))}); await shot('4-tuto7-solved');
      await page.click('.done-tools a'); await new Promise(r=>setTimeout(r,300));
      log.push({w,i:4,after:await page.evaluate(()=>location.hash),h1:await txt('h1'),eb:await txt('.game .eyebrow')}); await shot('4-after-tuto7');
      // 4b: daily already done -> home
      await setProg({grids:{'7':{status:'done',state:solved(t7)},'11':{status:'done',state:solved(g11)}}}); await page.goto(base+'#/grille/7'); await page.reload({waitUntil:'load'});
      log.push({w,i:'4b',next:await txt('.done-tools a'),href:await page.$eval('.done-tools a',e=>e.getAttribute('href'))});
      await page.goto(base+'#/dossier/premiers-pas'); await new Promise(r=>setTimeout(r,200)); log.push({w,i:4,dossierBack:await txt('.backlink'),ovf:await ovf()}); await shot('4-dossier');
      // print sheet
      await go('#/imprimer/11'); log.push({w,print:await page.$eval('.a4 .meta',e=>e.textContent),ovf:await ovf()}); await shot('print-11');
    } else {
      await setProg({grids:{}});
      await page.goto(base+'#/grille/11'); await page.reload({waitUntil:'load'});
      log.push({w,i:5,day,m2grid:await page.evaluate(()=>location.hash),home:!!(await page.$('.home'))});
      await page.goto(base+'#/imprimer/11'); await page.reload({waitUntil:'load'});
      log.push({w,i:5,day,m2print:!!(await page.$('.home')),sheets:await page.$$eval('.a4',e=>e.length)}); await shot('5-direct-url-veille');
      await page.goto(base+'#/grille/10'); await page.reload({waitUntil:'load'}); log.push({w,i:5,h1:await txt('h1'),eb:await txt('.game .eyebrow'),title:await page.title()});
      await shot('5-grid10-veille');
      await page.goto(base+'#/imprimer/tout'); await page.reload({waitUntil:'load'}); log.push({w,i:5,all:await page.$$eval('.a4',e=>e.length),ovf:await ovf()});
    }
    if (errs.length) log.push({w,errs});
    await ctx.close();
  }
}
await browser.close();
console.log(JSON.stringify(log,null,0).replace(/\},\{/g,'},\n{'));
