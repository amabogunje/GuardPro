import {test,before,after} from 'node:test';
import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';
import path from 'node:path';
import {DatabaseSync} from 'node:sqlite';
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
 await p.goto(base+'/app');await p.locator('#email').fill('owner@demo.isdl');await p.locator('#password').fill('Pilot-only-2026!');await p.getByRole('button',{name:'Sign in',exact:true}).click();await p.locator('.owner-health').waitFor();
 return {context,p};
}
async function geometry(p){
 const dimensions=await p.evaluate(()=>({width:document.querySelector('main.guard').getBoundingClientRect().width,overflow:document.documentElement.scrollWidth>innerWidth}));
 assert.ok(dimensions.width<=600,JSON.stringify(dimensions));assert.equal(dimensions.overflow,false);
 assert.equal(await p.locator('.sidebar').count(),0);
}
test('owner mobile setup, supervisor creation and honest subscription screen',{concurrency:false},async()=>{
 const {context,p}=await signedIn(390),errors=[];p.on('pageerror',e=>errors.push(e.message));
 try {
  await geometry(p);
  for(const name of ['Manage Property','Add User','View Subscription'])assert.equal(await p.getByRole('button',{name,exact:true}).count(),1);
  await p.getByRole('button',{name:'Manage Property',exact:true}).click();assert.equal(await p.locator('.duty-identity .eyebrow').count(),0);await p.getByRole('button',{name:'Set property location',exact:true}).click();
  const form=p.locator('.property-editor form');await form.locator('[name="property_type"]').selectOption('small_business');await form.locator('[name="address"]').fill('10 Fictional Pilot Close, Ikeja, Lagos');await form.locator('[name="latitude"]').fill('6.6');await form.locator('[name="longitude"]').fill('3.35');await form.locator('[name=longitude]').blur();await form.getByText(/Marker: 6.6, 3.35/).waitFor();await form.locator('[name="confirmed"]').check();
  await form.getByRole('button',{name:'Save property location',exact:true}).click();await p.getByText('10 Fictional Pilot Close, Ikeja, Lagos',{exact:true}).waitFor();await p.getByRole('button',{name:'Home',exact:true}).click();await p.locator('.owner-property-hero img').waitFor();assert.match(await p.locator('.owner-property-hero img').getAttribute('src'),/small-business\.png$/);assert.equal(await p.locator('.owner-property-hero img').evaluate(image=>image.complete&&image.naturalWidth>0),true);await geometry(p);
  await p.getByRole('button',{name:'Home',exact:true}).click();await p.getByRole('button',{name:'Add User',exact:true}).click();assert.equal(await p.locator('.duty-identity .eyebrow').count(),0);await p.getByRole('button',{name:'+ Add user',exact:true}).click();
  const team=p.locator('#team-editor');assert.equal(await team.locator('[name="role"] option').count(),2);await team.locator('[name="role"]').selectOption('supervisor');await team.locator('[name="name"]').fill('Fictional Test Supervisor');await team.locator('[name="email"]').fill('new-owner-ui@example.test');await team.locator('[name="password"]').fill('Owner-UI-Test-2026!');await team.getByRole('button',{name:'Create user',exact:true}).click();await p.getByRole('button',{name:'Edit Fictional Test Supervisor',exact:true}).waitFor();
  await p.getByRole('button',{name:'Home',exact:true}).click();await p.getByRole('button',{name:'View Subscription',exact:true}).click();assert.equal(await p.locator('.duty-identity .eyebrow').count(),0);await p.getByRole('heading',{name:'Free pilot',exact:true}).waitFor();await p.getByText('Up to 5',{exact:true}).waitFor();assert.equal(await p.getByText('No payment is collected during the pilot.',{exact:true}).count(),0);assert.equal(await p.locator('.owner-subscription').evaluate(card=>{const status=card.querySelector('.subscription-status').getBoundingClientRect(),box=card.getBoundingClientRect();return status.top-box.top<28&&box.right-status.right<28;}),true);await geometry(p);
  await p.screenshot({path:path.join(data,'owner-subscription-mobile.png'),fullPage:true});assert.deepEqual(errors,[]);
 } finally {await context.close();}
});
test('owner KPIs are display-only and supervisor mode persists without changing identity',{concurrency:false},async()=>{
 const {context,p}=await signedIn(1440),errors=[];p.on('pageerror',e=>errors.push(e.message));
 try {
  await p.locator('.owner-kpi').first().waitFor();assert.equal(await p.locator('.owner-kpi').count(),3);assert.equal(await p.locator('.owner-kpi .health-info-trigger').count(),3);assert.equal(await p.locator('.owner-current').count(),0);await p.getByText('Major security issues',{exact:true}).waitFor();await p.getByText('Monitoring now',{exact:true}).waitFor();await p.getByText('Patrols completed',{exact:true}).waitFor();assert.equal(await p.locator('.owner-evidence-links').count(),0);const beforeHeight=await p.locator('.owner-health').evaluate(element=>element.getBoundingClientRect().height);await p.locator('.health-info-trigger').first().click();await p.locator('.health-info-popover').waitFor();assert.equal(await p.locator('.owner-health').evaluate(element=>element.getBoundingClientRect().height),beforeHeight);await p.keyboard.press('Escape');assert.equal(await p.locator('.health-info-popover').count(),0);
  await geometry(p);await p.screenshot({path:path.join(data,'owner-home-desktop.png'),fullPage:true});
  await p.getByRole('button',{name:'Add User',exact:true}).click();await p.getByRole('button',{name:'I supervise this property',exact:true}).click();await p.locator('.owner-overflow-menu summary').click();await p.getByRole('button',{name:'Act as supervisor',exact:true}).waitFor();assert.equal(await p.getByRole('button',{name:'Open supervisor view',exact:true}).count(),0);await p.getByRole('button',{name:'Act as supervisor',exact:true}).click();await p.getByRole('button',{name:'Settings',exact:true}).waitFor();const stateResponse=p.waitForResponse(r=>r.url().endsWith('/api/state')&&r.status()===200);await p.reload();await p.getByRole('button',{name:'Return to owner view',exact:true}).waitFor();await p.getByRole('button',{name:'Settings',exact:true}).waitFor();
  const state=await (await stateResponse).json();assert.equal(state.user.role,'owner');
  await p.getByRole('button',{name:'Problems',exact:true}).click();await p.locator('[data-action="viewProblem"]').first().click();await p.locator('.problemResolve').waitFor();await geometry(p);
  await p.getByRole('button',{name:'Return to owner view',exact:true}).click();await p.locator('.owner-health').waitFor();await p.reload();await p.locator('.owner-health').waitFor();await p.getByRole('button',{name:'Manage Property',exact:true}).waitFor();await p.locator('.owner-overflow-menu summary').click();await p.getByRole('button',{name:'Sign out',exact:true}).click();await p.locator('#email').fill('owner@demo.isdl');await p.locator('#password').fill('Pilot-only-2026!');await p.getByRole('button',{name:'Sign in',exact:true}).click();await p.locator('.owner-health').waitFor();await p.locator('.owner-overflow-menu summary').click();await p.getByRole('button',{name:'Act as supervisor',exact:true}).waitFor();assert.equal(await p.getByRole('button',{name:'Settings',exact:true}).count(),0);assert.deepEqual(errors,[]);
 } finally {await context.close();}
});
test('owner dashboard stays compact on mobile without operational evidence links', {concurrency:false}, async()=>{
 const {context,p}=await signedIn(390),errors=[];p.on('pageerror',e=>errors.push(e.message));
 try {
  await p.locator('.owner-health').waitFor();assert.equal(await p.locator('.owner-overflow-menu summary .md-icon').count(),1);assert.equal(await p.locator('.owner-actions .action-icon').count(),3);assert.equal(await p.getByText('Your property',{exact:true}).count(),0);assert.equal(await p.getByText('At a glance',{exact:true}).count(),0);await p.locator('.owner-overflow-menu summary').click();await p.getByRole('button',{name:'Sign out',exact:true}).waitFor();assert.equal(await p.getByRole('button',{name:'Activity evidence',exact:true}).count(),0);assert.equal(await p.getByRole('button',{name:'Reported problems',exact:true}).count(),0);await geometry(p);assert.deepEqual(errors,[]);
 } finally {await context.close();}
});
test('owner can swipe through and select multiple property dashboards', {concurrency:false}, async()=>{
 const database=new DatabaseSync(path.join(data,'guard.db'));
 database.prepare("UPDATE customer_subscriptions SET tier='internal' WHERE customer_id=(SELECT customer_id FROM sites WHERE id='oak')").run();database.close();
 const {context,p}=await signedIn(390),errors=[];p.on('pageerror',e=>errors.push(e.message));
 try {
  await p.getByRole('button',{name:'Manage Property',exact:true}).click();await p.getByRole('button',{name:'+ Add another property',exact:true}).click();
  const form=p.locator('.property-editor form');await form.locator('[name="name"]').fill('Market Square');await form.locator('[name="property_type"]').selectOption('multi_use_property');await form.locator('[name="address"]').fill('2 Market Road, Ikeja, Lagos');await form.locator('[name="latitude"]').fill('6.61');await form.locator('[name="longitude"]').fill('3.36');await form.locator('[name=longitude]').blur();await form.getByText(/Marker: 6.61, 3.36/).waitFor();await form.locator('[name="confirmed"]').check();await form.getByRole('button',{name:'Create property',exact:true}).click();
  await p.locator('#ownerPropertyRail').waitFor();const cards=p.locator('.owner-property-rail-card');assert.equal(await cards.count(),2);assert.equal(await p.locator('#ownerPropertyRail').evaluate(rail=>rail.scrollWidth>rail.clientWidth),true);await cards.nth(1).click();await cards.nth(1).evaluate(card=>card.getAttribute('aria-pressed')).then(value=>assert.equal(value,'true'));await p.getByText('Market Square',{exact:true}).first().waitFor();await geometry(p);assert.deepEqual(errors,[]);
 } finally {await context.close();}
});
