import {test,before,after} from 'node:test';
import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';
import path from 'node:path';
import {chromium} from '@playwright/test';

let server,base;
const data=path.resolve('data','geocoding-'+Date.now());
before(async()=>{
  server=spawn(process.execPath,['server.js'],{env:{...process.env,PORT:'0',DATABASE_URL:'',DATA_DIR:data,VERCEL:'',BLOB_READ_WRITE_TOKEN:'',OPENAI_API_KEY:'',GEOAPIFY_API_KEY:'test-geocoding-key',PILOT_SUPPORT_CONTACT:'support@example.test'},stdio:'pipe'});
  base=await new Promise((resolve,reject)=>{const timer=setTimeout(()=>{server.kill();reject(Error('Server startup timeout'));},15000);server.stdout.on('data',chunk=>{const m=String(chunk).match(/http:\/\/[^:]+:(\d+)/);if(m){clearTimeout(timer);resolve('http://127.0.0.1:'+m[1]);}});server.on('exit',code=>{clearTimeout(timer);reject(Error('Server exit '+code));});});
});
after(()=>server?.kill());
async function api(route,body,session) {
  const response=await fetch(base+route,{method:'POST',headers:{'Content-Type':'application/json',...(session?{cookie:session.cookie,'X-Session-Proof':session.proof}:{})},body:JSON.stringify(body)});
  return {status:response.status,body:await response.json(),cookie:response.headers.get('set-cookie')?.split(';')[0]};
}
test('retired search endpoints reject requests even with a provider key configured',async()=>{const owner=await api('/api/login',{email:'owner@demo.isdl',password:'Pilot-only-2026!'});for(const route of ['/api/public/geocode','/api/geocode'])assert.equal((await api(route,{address:'12 Example Road, Lagos, Nigeria'},{...owner.body,cookie:owner.cookie})).status,410);});
test('signup stores a descriptive address independently from GPS position',async()=>{
  const browser=await chromium.launch({executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe',headless:true});
  try {
    const page=await browser.newPage({viewport:{width:390,height:844}});
    const errors=[];page.on('pageerror',error=>errors.push(error.message));
    await page.route('https://tile.openstreetmap.org/**',route=>route.abort());
    await page.route('https://www.openstreetmap.org/**',route=>route.fulfill({contentType:'text/html',body:'Map preview fixture'}));
    await page.goto(base+'/app?signup=1');
    await page.locator('[name="first_name"]').fill('Address');await page.locator('[name="last_name"]').fill('Owner');
    await page.locator('#signupEmail').fill('address-owner@example.test');await page.locator('#signupPassword').fill('Private-owner-2026!');await page.locator('#signupPasswordConfirm').fill('Private-owner-2026!');
    await page.locator('[name="notice_accepted"]').check();await page.getByRole('button',{name:'Continue',exact:true}).click();
    await page.locator('#signupPropertyName').fill('Address lookup property');await page.locator('#signupAddress').fill('12 Example Road, Lagos, Nigeria');
    assert.equal(await page.getByRole('button',{name:'Find address',exact:true}).count(),0);
    assert.equal(await page.locator('#signupLatitude').inputValue(),'');
    await page.evaluate(()=>{navigator.geolocation.getCurrentPosition=success=>success({coords:{latitude:6.601,longitude:3.351,accuracy:15}});});
    await page.getByRole('button',{name:'Use my position',exact:true}).click();
    await page.getByText(/Current position added/).waitFor();
    await page.locator('#signupAddress').fill('Different written address, Lagos, Nigeria');
    assert.deepEqual(errors,[]);

    assert.equal(await page.locator('#signupLatitude').inputValue(),'6.601');assert.equal(await page.locator('#signupLongitude').inputValue(),'3.351');
    await page.locator('#signup-map .leaflet-marker-icon').waitFor();
    await page.locator('[name="confirmed"]').check();
    const pin=await page.locator('#signup-map .leaflet-marker-icon').boundingBox();
    await page.mouse.move(pin.x+18,pin.y+20);await page.mouse.down();await page.mouse.move(pin.x+65,pin.y+45,{steps:8});await page.mouse.up();
    assert.equal(await page.locator('[name="confirmed"]').isChecked(),false);
    const finalLat=Number(await page.locator('#signupLatitude').inputValue()),finalLon=Number(await page.locator('#signupLongitude').inputValue());
    assert.notEqual(finalLon,3.351);
    await page.locator('[name="confirmed"]').check();
    const submitted=page.waitForResponse(response=>response.url().endsWith('/api/signup'));
    await page.getByRole('button',{name:'Create account',exact:true}).click();
    const response=await submitted;assert.equal(response.status(),200);
    const auth=await response.json();
    const state=await page.evaluate(async auth=>fetch('/api/state',{headers:{'X-Session-Proof':auth.proof}}).then(r=>r.json()),auth);
    assert.equal(state.propertyLocations.at(-1).address,'Different written address, Lagos, Nigeria');assert.equal(state.propertyLocations.at(-1).latitude,finalLat);assert.equal(state.propertyLocations.at(-1).longitude,finalLon);
  }finally{await browser.close();}
});
