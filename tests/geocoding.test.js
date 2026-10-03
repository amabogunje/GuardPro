import {test,before,after} from 'node:test';
import assert from 'node:assert/strict';
import {spawn,execFileSync} from 'node:child_process';
import path from 'node:path';
import fs from 'node:fs';
import {chromium} from '@playwright/test';
import {addressQuery,geocodeAddress} from '../geocoding.js';
let server,base;
const data=path.resolve('data','geocoding-'+Date.now());
before(async()=>{
  server=spawn(process.execPath,['--import','./tests/fixtures/geocoding-fetch.mjs','server.js'],{env:{...process.env,PORT:'0',DATABASE_URL:'',DATA_DIR:data,VERCEL:'',BLOB_READ_WRITE_TOKEN:'',OPENAI_API_KEY:'',GEOAPIFY_API_KEY:'test-geocoding-key',PILOT_SUPPORT_CONTACT:'support@example.test'},stdio:'pipe'});
  base=await new Promise((resolve,reject)=>{const timer=setTimeout(()=>{server.kill();reject(Error('Server startup timeout'));},15000);server.stdout.on('data',chunk=>{const m=String(chunk).match(/http:\/\/[^:]+:(\d+)/);if(m){clearTimeout(timer);resolve('http://127.0.0.1:'+m[1]);}});server.on('exit',code=>{clearTimeout(timer);reject(Error('Server exit '+code));});});
});
after(()=>server?.kill());
async function api(route,body,session) {
  const response=await fetch(base+route,{method:'POST',headers:{'Content-Type':'application/json',...(session?{cookie:session.cookie,'X-Session-Proof':session.proof}:{})},body:JSON.stringify(body)});
  return {status:response.status,body:await response.json(),cookie:response.headers.get('set-cookie')?.split(';')[0]};
}
test('provider adapter encodes input, validates coordinates and never exposes provider secrets',async()=>{
  assert.throws(()=>addressQuery('short'),/full address/);
  assert.throws(()=>addressQuery({address:'arbitrary'}),/street address/);
  await assert.rejects(geocodeAddress('12 Example Road',{apiKey:''}),/not available yet/);
  let called;
  const matches=await geocodeAddress('12 Example Road & Estate, Lagos, Nigeria',{apiKey:'private-key',fetchImpl:async(url,options)=>{
    called=url;assert.equal(options.redirect,'error');assert.ok(options.signal);
    return Response.json({results:[{formatted:'Example House',lat:6.601,lon:3.351,result_type:'building',rank:{confidence:1}},{formatted:'Area only',lat:6,lon:3,result_type:'city',rank:{confidence:1}},{formatted:'Invalid',lat:null,lon:3},{formatted:'Invalid',lat:999,lon:3}]});
  }});
  assert.equal(called.origin,'https://api.geoapify.com');assert.equal(called.searchParams.get('text'),'12 Example Road & Estate, Lagos, Nigeria');
  assert.equal(matches.length,2);assert.equal(matches[0].approximate,false);assert.equal(matches[1].approximate,true);
  assert.ok(!JSON.stringify(matches).includes('private-key'));
  for(const fetchImpl of [async()=>{throw Error('private-key in provider URL');},async()=>Response.json({error:'private-key'}),async()=>new Response('private-key',{status:429})]) {
    await assert.rejects(geocodeAddress('12 Example Road',{apiKey:'private-key',fetchImpl}),error=>!error.message.includes('private-key')&&error.status>=500);
  }
  await assert.rejects(geocodeAddress('12 Example Road',{apiKey:'private-key',timeoutMs:5,fetchImpl:async(_url,{signal})=>new Promise((resolve,reject)=>{
    const timer=setTimeout(()=>resolve(Response.json({results:[]})),1000);
    signal.addEventListener('abort',()=>{clearTimeout(timer);reject(signal.reason);},{once:true});
  })}),error=>error.status===503&&!error.message.includes('private-key'));
});
test('lookup API supports signup and owners, denies guards and isolates provider latency',async()=>{
  const owner=await api('/api/login',{email:'owner@demo.isdl',password:'Pilot-only-2026!'}),session={...owner.body,cookie:owner.cookie};
  const guard=await api('/api/login',{email:'bala@demo.isdl',password:'Pilot-only-2026!'});
  assert.equal((await api('/api/geocode',{address:'12 Example Road'}, {...guard.body,cookie:guard.cookie})).status,403);
  assert.equal((await api('/api/geocode',{address:'12 Example Road'})).status,401);
  assert.equal((await api('/api/geocode',{address:'12 Example Road'},session)).body.results[0].latitude,6.601);
  assert.equal((await api('/api/public/geocode',{address:'bad'})).status,400);
  assert.deepEqual((await api('/api/public/geocode',{address:'Missing address Nigeria'})).body.results,[]);
  assert.equal((await api('/api/public/geocode',{address:'Unavailable address Nigeria'})).status,503);
  let lookupFinished=false;
  const slow=api('/api/geocode',{address:'Slow lookup Lagos Nigeria'},session).then(result=>{lookupFinished=true;return result;});
  const login=await api('/api/login',{email:'owner@demo.isdl',password:'Pilot-only-2026!'});
  assert.equal(login.status,200);assert.equal(lookupFinished,false);await slow;
});

async function propertyPage(browser) {
  const page=await browser.newPage({viewport:{width:390,height:844}});
  await page.route('https://www.openstreetmap.org/**',route=>route.fulfill({contentType:'text/html',body:'Map preview fixture'}));
  if(process.env.GEOCODING_BASELINE==='true')await page.route('**/property-location.js',route=>route.fulfill({contentType:'text/javascript',body:execFileSync('git',['show','HEAD:public/property-location.js'],{encoding:'utf8'})}));
  await page.goto(base+'/app');await page.locator('#login').waitFor();
  await page.evaluate(async()=>{
    const auth=await fetch('/api/login',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({email:'owner@demo.isdl',password:'Pilot-only-2026!'})}).then(r=>r.json());
    const api=async(url,body)=>{const r=await fetch(url,{method:'POST',headers:{'Content-Type':'application/json','X-Session-Proof':auth.proof},body:JSON.stringify(body)});const result=await r.json();if(!r.ok)throw Error(result.error);return result;};
    const {propertyEditor}=await import('/property-location.js');
    const host=document.createElement('main');host.className='card';document.body.replaceChildren(host);
    propertyEditor(host,{site:{id:'oak'},state:{propertyLocations:[]},api,esc:value=>String(value),done:()=>{window.saved=true;}});
  });
  return page;
}
test('property lookup fills coordinates and preview without navigation and retains GPS and save',async()=>{
  const browser=await chromium.launch({executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe',headless:true});
  try {
    const page=await propertyPage(browser);
    assert.equal(await page.getByRole('button',{name:'Find address',exact:true}).count(),1);
    assert.equal(await page.locator('#property-find').count(),0);
    await page.locator('[name="address"]').fill('12 Example Road, Lagos, Nigeria');
    await page.getByRole('button',{name:'Find address',exact:true}).click();
    await page.getByText(/Location found:/).waitFor();
    assert.equal(await page.locator('[name="latitude"]').inputValue(),'6.601');
    assert.equal(await page.locator('[name="longitude"]').inputValue(),'3.351');
    assert.equal(await page.locator('[name="confirmed"]').isChecked(),false);
    assert.match(await page.locator('#property-map iframe').getAttribute('src'),/marker=6.601,3.351/);
    assert.equal(page.url(),base+'/app');assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
    fs.mkdirSync('docs/remediation-evidence/R-039',{recursive:true});
    await page.screenshot({path:'docs/remediation-evidence/R-039/address-mobile.png',fullPage:true});
    await page.locator('[name="confirmed"]').check();await page.getByRole('button',{name:'Save property location'}).click();await page.waitForFunction(()=>window.saved);
    await page.evaluate(()=>{navigator.geolocation.getCurrentPosition=success=>success({coords:{latitude:6.62,longitude:3.36,accuracy:10}});});
    await page.getByRole('button',{name:'Use my position',exact:true}).click();
    await page.getByText(/Coordinates updated/).waitFor();assert.equal(await page.locator('[name="latitude"]').inputValue(),'6.62');
    assert.equal(await page.locator('[name="confirmed"]').isChecked(),false);
  }finally{await browser.close();}
});
test('ambiguous results require choice; errors and stale searches cannot overwrite the position',async()=>{
  const browser=await chromium.launch({executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe',headless:true});
  try {
    const page=await propertyPage(browser),address=page.locator('[name="address"]'),find=page.getByRole('button',{name:'Find address',exact:true});
    await address.fill('Multiple Example Road Nigeria');await find.click();await page.locator('.address-match').first().waitFor();
    assert.equal(await page.locator('[name="latitude"]').inputValue(),'');
    await page.locator('.address-match').nth(1).click();await page.getByText(/Approximate location:/).waitFor();assert.equal(await page.locator('[name="latitude"]').inputValue(),'9.06');
    await address.fill('Unavailable road Nigeria');await find.click();await page.getByText(/temporarily unavailable/).waitFor();assert.equal(await page.locator('[name="latitude"]').inputValue(),'9.06');
    await address.fill('Slow lookup Lagos Nigeria');await find.click();await address.fill('Newer address Lagos Nigeria');await page.waitForTimeout(650);assert.equal(await page.locator('[name="latitude"]').inputValue(),'9.06');
    await address.fill('Slow lookup Lagos Nigeria');await find.click();await page.evaluate(()=>{navigator.geolocation.getCurrentPosition=success=>success({coords:{latitude:6.7,longitude:3.4,accuracy:10}});});
    await page.getByRole('button',{name:'Use my position',exact:true}).click();await page.getByText(/Coordinates updated/).waitFor();await page.waitForTimeout(650);assert.equal(await page.locator('[name="latitude"]').inputValue(),'6.7');
    await address.fill('Missing address Nigeria');await find.click();await page.getByText(/No matching address found/).waitFor();assert.equal(await page.locator('[name="latitude"]').inputValue(),'6.7');
    await page.evaluate(()=>{navigator.geolocation.getCurrentPosition=success=>setTimeout(()=>success({coords:{latitude:1,longitude:2,accuracy:10}}),500);});
    await page.getByRole('button',{name:'Use my position',exact:true}).click();await address.fill('12 Example Road Lagos Nigeria');await find.click();await page.getByText(/Location found:/).waitFor();
    await page.waitForTimeout(650);assert.equal(await page.locator('[name="latitude"]').inputValue(),'6.601');
  }finally{await browser.close();}
});
test('signup uses the same address lookup and persists its selected coordinates',async()=>{
  const browser=await chromium.launch({executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe',headless:true});
  try {
    const page=await browser.newPage({viewport:{width:390,height:844}});
    const errors=[];page.on('pageerror',error=>errors.push(error.message));
    await page.route('https://www.openstreetmap.org/**',route=>route.fulfill({contentType:'text/html',body:'Map preview fixture'}));
    await page.goto(base+'/app?signup=1');
    await page.locator('[name="first_name"]').fill('Address');await page.locator('[name="last_name"]').fill('Owner');
    await page.locator('#signupEmail').fill('address-owner@example.test');await page.locator('#signupPassword').fill('Private-owner-2026!');await page.locator('#signupPasswordConfirm').fill('Private-owner-2026!');
    await page.locator('[name="notice_accepted"]').check();await page.getByRole('button',{name:'Continue',exact:true}).click();
    await page.locator('#signupPropertyName').fill('Address lookup property');await page.locator('#signupAddress').fill('12 Example Road, Lagos, Nigeria');
    await page.getByRole('button',{name:'Find address',exact:true}).click();
    await page.getByText(/Location found:/).waitFor();
    assert.deepEqual(errors,[]);
    assert.match(await page.locator('.address-status').textContent(),/Location found:/);
    assert.equal(await page.locator('#signupLatitude').inputValue(),'6.601');assert.equal(await page.locator('#signupLongitude').inputValue(),'3.351');
    assert.match(await page.locator('#signup-map iframe').getAttribute('src'),/marker=6.601,3.351/);
    await page.locator('[name="confirmed"]').check();
    const submitted=page.waitForResponse(response=>response.url().endsWith('/api/signup'));
    await page.getByRole('button',{name:'Create account',exact:true}).click();
    const response=await submitted;assert.equal(response.status(),200);
    const auth=await response.json();
    const state=await page.evaluate(async auth=>fetch('/api/state',{headers:{'X-Session-Proof':auth.proof}}).then(r=>r.json()),auth);
    assert.equal(state.propertyLocations.at(-1).latitude,6.601);assert.equal(state.propertyLocations.at(-1).longitude,3.351);
  }finally{await browser.close();}
});
test('anonymous geocoding has a per-client limit',async()=>{
  let limited=false;
  for(let i=0;i<22;i++){const result=await api('/api/public/geocode',{address:'12 Example Road'});if(result.status===429){limited=true;break;}}
  assert.equal(limited,true);
});
