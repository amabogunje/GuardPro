import {test,before,after} from 'node:test';
import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';
import path from 'node:path';
import {chromium} from '@playwright/test';

const base='http://127.0.0.1:3114';
const data=path.resolve('data/owner-ui-test-'+Date.now());
let server,browser;
before(async()=>{
  server=spawn(process.execPath,['server.js'],{env:{...process.env,PORT:'3114',DATA_DIR:data,DATABASE_URL:'',VERCEL:'',BLOB_READ_WRITE_TOKEN:''},stdio:'pipe'});
  await new Promise((resolve,reject)=>{server.stdout.on('data',d=>{if(String(d).includes('running'))resolve();});server.on('exit',c=>reject(Error('Server exited '+c)));});
  browser=await chromium.launch({executablePath:process.env.CHROME_PATH||'C:/Program Files/Google/Chrome/Application/chrome.exe',headless:true});
});
after(async()=>{await browser?.close();server?.kill();});

async function signedIn(width){
 const context=await browser.newContext({viewport:{width,height:900}}),p=await context.newPage();
 await p.route('https://www.openstreetmap.org/**',route=>route.fulfill({contentType:'text/html',body:'Map fixture'}));
 await p.goto(base);await p.locator('#email').fill('owner@demo.isdl');await p.locator('#password').fill('Pilot-only-2026!');await p.getByRole('button',{name:'Sign in',exact:true}).click();await p.locator('.owner-health').waitFor();
 return {context,p};
}
async function geometry(p){
 const dimensions=await p.evaluate(()=>({width:document.querySelector('main.guard').getBoundingClientRect().width,overflow:document.documentElement.scrollWidth>innerWidth}));
 assert.ok(dimensions.width<=600,JSON.stringify(dimensions));assert.equal(dimensions.overflow,false);
 assert.equal(await p.locator('.sidebar').count(),0);
}
test('owner mobile setup, supervisor creation and honest subscription screen',async()=>{
 const {context,p}=await signedIn(390),errors=[];p.on('pageerror',e=>errors.push(e.message));
 try {
  await geometry(p);
  for(const name of ['Property','Supervisors','Subscription'])assert.equal(await p.getByRole('button',{name,exact:true}).count(),1);
  await p.getByRole('button',{name:'Property',exact:true}).click();await p.getByRole('button',{name:'Set property location',exact:true}).click();
  const form=p.locator('.property-editor form');await form.locator('[name="address"]').fill('10 Fictional Pilot Close, Ikeja, Lagos');await form.locator('[name="latitude"]').fill('6.6');await form.locator('[name="longitude"]').fill('3.35');await form.locator('[name=longitude]').blur();await form.getByText(/Marker: 6.6, 3.35/).waitFor();await form.locator('[name="confirmed"]').check();
  await form.getByRole('button',{name:'Save property location',exact:true}).click();await p.getByText('10 Fictional Pilot Close, Ikeja, Lagos',{exact:true}).waitFor();await geometry(p);
  await p.getByRole('button',{name:'Home',exact:true}).click();await p.getByRole('button',{name:'Supervisors',exact:true}).click();await p.getByRole('button',{name:'+ Add supervisor',exact:true}).click();
  const team=p.locator('#team-editor');assert.equal(await team.locator('[name="role"]').inputValue(),'supervisor');assert.equal(await team.locator('[name="role"]').isVisible(),false);
  await team.locator('[name="name"]').fill('Fictional Test Supervisor');await team.locator('[name="email"]').fill('new-owner-ui@example.test');await team.locator('[name="password"]').fill('Owner-UI-Test-2026!');await team.getByRole('button',{name:'Create supervisor',exact:true}).click();await p.getByRole('button',{name:'Edit Fictional Test Supervisor',exact:true}).waitFor();
  await p.getByRole('button',{name:'Home',exact:true}).click();await p.getByRole('button',{name:'Subscription',exact:true}).click();await p.getByText('Billing is not enabled for this MVP',{exact:true}).waitFor();await geometry(p);
  await p.screenshot({path:path.join(data,'owner-subscription-mobile.png'),fullPage:true});assert.deepEqual(errors,[]);
 } finally {await context.close();}
});
test('owner KPIs are display-only and supervisor mode persists without changing identity',async()=>{
 const {context,p}=await signedIn(1440),errors=[];p.on('pageerror',e=>errors.push(e.message));
 try {
  assert.equal(await p.locator('.owner-kpi').count(),3);assert.equal(await p.locator('.owner-kpi details, .owner-kpi summary, .owner-kpi button, .owner-kpi a').count(),0);await p.getByText('Last seven days',{exact:true}).waitFor();
  await geometry(p);await p.screenshot({path:path.join(data,'owner-home-desktop.png'),fullPage:true});
  await p.getByRole('button',{name:'Act as supervisor',exact:true}).click();await p.getByRole('button',{name:'Settings',exact:true}).waitFor();const stateResponse=p.waitForResponse(r=>r.url().endsWith('/api/state')&&r.status()===200);await p.reload();await p.getByRole('button',{name:'Return to owner view',exact:true}).waitFor();await p.getByRole('button',{name:'Settings',exact:true}).waitFor();
  const state=await (await stateResponse).json();assert.equal(state.user.role,'owner');
  await p.getByRole('button',{name:'Problems',exact:true}).click();await p.locator('[data-action="viewProblem"]').first().click();await p.locator('.problemResolve').waitFor();await geometry(p);
  await p.getByRole('button',{name:'Return to owner view',exact:true}).click();await p.locator('.owner-health').waitFor();await p.reload();await p.locator('.owner-health').waitFor();await p.getByRole('button',{name:'Property',exact:true}).waitFor();assert.deepEqual(errors,[]);
 } finally {await context.close();}
});




