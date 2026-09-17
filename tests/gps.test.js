import {test,before,after} from 'node:test';
import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';
import {randomUUID} from 'node:crypto';
import path from 'node:path';
import {chromium} from '@playwright/test';
import {assessLocation} from '../location-checks.js';
import {locationGroups} from '../public/gps-review.js';
const base='http://127.0.0.1:3108',data=path.resolve('data/gps-test-'+Date.now());let server,owner,guard,supervisor,other,shiftId,scanId;
async function req(route,cookie,body,status=200){const r=await fetch(base+route,{method:body?'POST':'GET',headers:{...(cookie?{cookie,'X-Session-Proof':cookie.split('=')[1]}:{}),...(body?{'Content-Type':'application/json'}:{})},body:body?JSON.stringify(body):undefined});const value=await r.json();assert.equal(r.status,status,JSON.stringify(value));return value;}
async function login(name){const auth=await req('/api/login',null,{email:name+'@demo.isdl',password:'Pilot-only-2026!'});return 'session='+auth.proof;}
before(async()=>{server=spawn(process.execPath,['server.js'],{env:{...process.env,PORT:'3108',DATA_DIR:data,DATABASE_URL:'',VERCEL:'',BLOB_READ_WRITE_TOKEN:''},stdio:'pipe'});await new Promise((resolve,reject)=>{server.stdout.on('data',d=>{if(String(d).includes('running'))resolve();});server.on('exit',c=>reject(Error('Server '+c)));});[owner,guard,supervisor,other]=await Promise.all(['owner','bala','supervisor','other'].map(login));});
after(()=>server?.kill());
test('GPS classification preserves accuracy uncertainty',()=>{
 const ref={latitude:6.6,longitude:3.35,radius_m:100};
 assert.equal(assessLocation({latitude:6.6,longitude:3.35,accuracy:10},ref).status,'within');
 assert.equal(assessLocation({latitude:6.61,longitude:3.35,accuracy:10},ref).status,'outside');
 assert.equal(assessLocation({latitude:6.61,longitude:3.35,accuracy:500},ref).status,'unconfirmed');
 assert.equal(assessLocation(null,ref).status,'unconfirmed');
 assert.equal(assessLocation({latitude:6.6,longitude:3.35,accuracy:10},null).status,'unconfirmed');
});
test('owner-only address setup and durable capture-time assessments',async()=>{
 const reference={site_id:'oak',address:'1 Test Close, Fictional Estate, Ikeja, Lagos, Nigeria',latitude:6.6,longitude:3.35,radius_m:100,confirmed:true};
 await req('/api/site-location',supervisor,reference,403);await req('/api/site-location',guard,reference,403);await req('/api/site-location',other,reference,403);
 await req('/api/site-location',owner,{...reference,address:''},400);await req('/api/site-location',owner,reference);
 const captured=new Date(Date.now()+1000),due=new Date(Math.ceil((captured.getTime()+60000)/60000)*60000),slot=new Date(due.getTime()+3600000).toISOString().slice(11,16);
 await req('/api/admin',supervisor,{kind:'site',site_id:'oak',phone:'',schedule:slot});
 shiftId=randomUUID();await req('/api/events',guard,{id:shiftId,site_id:'oak',kind:'start',captured_at:captured.toISOString(),payload:{location:{latitude:6.61,longitude:3.35,accuracy:15}}});
 let state=await req('/api/state',supervisor);const first=state.events.find(e=>e.id===shiftId);
 assert.equal(first.payload.location_assessment.status,'outside');assert.equal(first.payload.location_assessment.reference.address,reference.address);
 const round=randomUUID();await req('/api/events',guard,{id:randomUUID(),site_id:'oak',kind:'patrol_start',captured_at:due.toISOString(),payload:{shift_id:shiftId,round_id:round,slot,scheduled_for:due.toISOString()}});
 scanId=randomUUID();const scan={id:scanId,site_id:'oak',kind:'scan',captured_at:due.toISOString(),payload:{shift_id:shiftId,round_id:round,slot,code:'OAK-1',location:null}};
 await req('/api/events',guard,scan);await req('/api/events',guard,scan);
 state=await req('/api/state',supervisor);assert.equal(state.events.filter(e=>e.id===scanId).length,1);
 assert.equal(state.events.find(e=>e.id===scanId).payload.location_assessment.status,'unconfirmed');
 assert.equal(locationGroups(state.events,state.locationReviews,'oak').length,1);
 await req('/api/site-location',owner,{...reference,address:'2 Updated Test Close, Fictional Estate, Lagos',latitude:6.61});
 assert.equal((await req('/api/state',supervisor)).events.find(e=>e.id===shiftId).payload.location_assessment.reference.address,reference.address);
 await req('/api/location-review',other,{site_id:'oak',shift_id:shiftId,event_ids:[shiftId]},403);
 await req('/api/location-review',guard,{site_id:'oak',shift_id:shiftId,event_ids:[shiftId]},403);
});
test('supervisor reviews grouped GPS flags without changing problems',async()=>{
 const browser=await chromium.launch({executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe',headless:true});
 try{const context=await browser.newContext({viewport:{width:360,height:900}}),p=await context.newPage();const errors=[];p.on('pageerror',e=>errors.push(e.message));await p.goto(base+'/app');await p.locator('#email').fill('supervisor@demo.isdl');await p.locator('#password').fill('Pilot-only-2026!');await p.getByRole('button',{name:'Sign in',exact:true}).click();
 // The overview shows only three attention rows at once. Use the stable location-review
 // entry point so an unrelated, newer item cannot hide this review workflow.
 await p.locator('[data-action="locationHistory"]').click();await p.getByRole('heading',{name:'Location review',exact:true}).waitFor();
 await p.locator('[data-action="reviewLocation"]').first().click();
 await p.getByText('Location outside property area',{exact:true}).first().waitFor();
 assert.ok(await p.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
 await p.locator('#gps-review-form textarea').fill('Called guard; checking handset GPS.');await p.getByRole('button',{name:'Mark reviewed',exact:true}).click();await p.getByText('All displayed location exceptions have been reviewed.',{exact:true}).waitFor();
 const state=await req('/api/state',supervisor);assert.equal(locationGroups(state.events,state.locationReviews,'oak')[0].pending.length,0);assert.equal(state.locationReviews[0].actor_name,'Ada');
 await p.screenshot({path:path.join(data,'gps-review.png'),fullPage:true});assert.deepEqual(errors,[]);await context.close();
 }finally{await browser.close();}
});
test('owner property form saves an address and confirmed map position',async()=>{
 const browser=await chromium.launch({executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe',headless:true});
 try {const p=await browser.newPage();await p.route('https://www.openstreetmap.org/**',route=>route.fulfill({contentType:'text/html',body:'Map test fixture'}));
 await p.goto(base+'/app');await p.locator('#email').fill('owner@demo.isdl');await p.locator('#password').fill('Pilot-only-2026!');await p.getByRole('button',{name:'Sign in',exact:true}).click();await p.getByRole('button',{name:'Property',exact:true}).click();await p.getByRole('button',{name:'Edit property location',exact:true}).click();
 const form=p.locator('.property-editor form').first();
 await p.evaluate(()=>{navigator.geolocation.getCurrentPosition=(success)=>setTimeout(()=>success({coords:{latitude:6.62,longitude:3.36,accuracy:20}}),100);});
 await form.getByRole('button',{name:'Use my position',exact:true}).click();
 await form.getByText(/Coordinates updated/).waitFor();
 assert.equal(await form.locator('[name="latitude"]').inputValue(),'6.62');
 assert.equal(await form.locator('[name="longitude"]').inputValue(),'3.36');
 await p.evaluate(()=>{navigator.geolocation.getCurrentPosition=(success,failure)=>failure({code:1});});
 await form.getByRole('button',{name:'Use my position',exact:true}).click();
 await form.getByText(/Location access was denied/).waitFor();
 assert.equal(await form.locator('[name="latitude"]').inputValue(),'6.62');
 await p.evaluate(()=>{navigator.geolocation.getCurrentPosition=(success,failure,options)=>options.enableHighAccuracy?failure({code:3}):success({coords:{latitude:6.63,longitude:3.37,accuracy:200}});});
 await form.getByRole('button',{name:'Use my position',exact:true}).click();
 await form.getByText(/accuracy approximately 200 metres/).waitFor();
 assert.equal(await form.locator('[name="latitude"]').inputValue(),'6.63');
 await form.locator('[name="address"]').fill('3 Owner Test Close, Fictional Estate, Lagos');await form.locator('[name="longitude"]').fill('3.351');await form.locator('[name="confirmed"]').check();await form.getByRole('button',{name:'Save property location'}).click();
 await p.getByText('3 Owner Test Close, Fictional Estate, Lagos',{exact:true}).waitFor();
 assert.equal((await req('/api/state',owner)).propertyLocations.at(-1).address,'3 Owner Test Close, Fictional Estate, Lagos');
 } finally {await browser.close();}
});
