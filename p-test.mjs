import { createServer } from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import { join, extname } from 'node:path';
import { chromium, devices } from 'playwright';
const ROOT='/home/user/minigames', S='/tmp/claude-0/-home-user-minigames/ba52f3fd-f305-59cf-99b8-f248c419ece2/scratchpad';
const MIME={'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8'};
const server=createServer(async(q,r)=>{let p=join(ROOT,decodeURIComponent(q.url.split('?')[0]));if(p.endsWith('/'))p=join(p,'index.html');const i=await stat(p).catch(()=>null);if(!i||i.isDirectory()){r.writeHead(404).end();return;}r.writeHead(200,{'Content-Type':MIME[extname(p)]||'text/plain'}).end(await readFile(p));});
await new Promise(ok=>server.listen(8204,ok));
const b=await chromium.launch(); const page=await (await b.newContext()).newPage();
const errs=[]; page.on('pageerror',e=>errs.push('pageerror: '+e.message));
page.on('console',m=>{if(m.type()==='error')errs.push('console: '+m.text());});
const ok=(n,c)=>console.log((c?'PASS':'FAIL')+'  '+n);
await page.goto('http://localhost:8204/games/familyhabittracker/');

// Verlauf mit erkennbarem Muster: M erledigt an Werktagen viel, sonntags nie
await page.evaluate(()=>{
  const d=habitLoad(); d.users.M={}; d.users.C={};
  for (let i=0;i<45;i++){
    const tag=habitAddDays(new Date(),-i), key=habitDateKey(tag), wt=tag.getDay();
    if (wt!==0) d.users.M[key]=['instrument','hausaufgaben','aemtli'].slice(0, wt%3+1);
    if (i%2===0) d.users.C[key]=['bett'];
  }
  habitSave(d);
});
await page.reload();

const punkte = await page.locator('.user-card[data-user="M"] .habit-cell').count();
ok('mindestens 30 Tage sichtbar', punkte>=30);
console.log('   sichtbare Tage je Person:', punkte);

const belegt = await page.evaluate(()=>{
  const zellen=[...document.querySelectorAll('.user-card[data-user="M"] .habit-cell')];
  return { gefaerbt: zellen.filter(z=>z.style.fill).length,
           stufen: new Set(zellen.filter(z=>z.style.fillOpacity).map(z=>Number(z.style.fillOpacity).toFixed(2))).size,
           sonntage: zellen.filter((z,i)=>i%7===6).filter(z=>z.style.fill).length,
           heute: zellen.filter(z=>z.classList.contains('is-today')).length,
           zukunft: zellen.filter(z=>z.classList.contains('is-future')).length };
});
ok('Tage sind eingefärbt', belegt.gefaerbt>25);
ok('mehrere Intensitätsstufen', belegt.stufen>=3);
ok('Sonntagsspalte bleibt leer (Muster erkennbar)', belegt.sonntage===0);
ok('heutiger Tag markiert', belegt.heute===1);
ok('künftige Tage nicht gefüllt', belegt.zukunft>=0);
console.log('   Stufen:', belegt.stufen, '| gefärbt:', belegt.gefaerbt, '| Zukunft:', belegt.zukunft);

const titel = await page.locator('.user-card[data-user="M"] .habit-cell title').first().textContent();
ok('Tooltip nennt Datum und Anzahl', /\d{2}\.\d{2}\.\d{4} – \d von 5/.test(titel));
ok('C hat ein eigenes Muster', (await page.locator('.user-card[data-user="C"] .habit-cell').count())===punkte);
ok('Zähler bleibt', (await page.locator('.user-card[data-user="M"] .user-count').textContent()).includes('von 5 heute'));

// Tracker weiterhin unveraendert erreichbar
await page.click('.user-card[data-user="M"]');
for (const d of ['3','2','4']) await page.click(`#pinPad button[data-key="${d}"]`);
await page.waitForTimeout(300);
ok('Tracker zeigt weiterhin 13 Wochen', (await page.locator('.habit-card .habit-grid').first().getAttribute('aria-label')).includes('13 Wochen'));
await page.click('#trackerDone');

const sx = await page.evaluate(()=>document.documentElement.scrollWidth-document.documentElement.clientWidth);
ok('kein horizontales Scrollen', sx<=0);
await page.screenshot({path:S+'/muster.png'});

const m=await (await b.newContext({...devices['iPhone 13']})).newPage();
await m.goto('http://localhost:8204/games/familyhabittracker/');
await m.evaluate(()=>{const d=habitLoad(); d.users.M={};
  for(let i=0;i<45;i++){const t=habitAddDays(new Date(),-i);if(t.getDay()!==0)d.users.M[habitDateKey(t)]=['instrument','aemtli'];}
  habitSave(d);});
await m.reload();
const msx = await m.evaluate(()=>document.documentElement.scrollWidth-document.documentElement.clientWidth);
ok('mobil kein horizontales Scrollen', msx<=0);
await m.screenshot({path:S+'/muster-mobil.png', fullPage:true});
console.log(errs.length?'FAIL  '+errs.join('\n'):'PASS  keine Konsolenfehler');
await b.close(); server.close();
