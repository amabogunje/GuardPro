import {test,before,after} from 'node:test';
import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';
import path from 'node:path';
import {chromium} from '@playwright/test';

const base='http://127.0.0.1:3135';
const data=path.resolve('data/owner-first-property-onboarding-'+Date.now());
let server,browser;

before(async()=>{
  server=spawn(process.execPath,['server.js'],{env:{...process.env,PORT:'3135',DATA_DIR:data,DATABASE_URL:'',VERCEL:'',BLOB_READ_WRITE_TOKEN:''},stdio:'pipe'});
  await new Promise((resolve,reject)=>{server.stdout.on('data',chunk=>{if(String(chunk).includes('running'))resolve();});server.on('exit',code=>reject(Error('Server exited '+code)));});
  browser=await chromium.launch({executablePath:process.env.CHROME_PATH||'C:/Program Files/Google/Chrome/Application/chrome.exe',headless:true});
});
after(async()=>{await browser?.close();server?.kill();});

test('owner is guided from an empty account through property and supervision setup',{concurrency:false},async()=>{
  const context=await browser.newContext({viewport:{width:390,height:844}}),page=await context.newPage();
  await page.route('https://www.openstreetmap.org/**',route=>route.fulfill({contentType:'text/html',body:'Map fixture'}));
  try {
    await page.goto(base+'/app');
    await page.locator('#email').fill('owner@demo.isdl');
    await page.locator('#password').fill('Pilot-only-2026!');
    await page.getByRole('button',{name:'Sign in',exact:true}).click();
    await page.locator('.owner-health').waitFor();

    await page.getByRole('button',{name:'Manage Property',exact:true}).click();
    await page.getByRole('button',{name:'Remove property',exact:true}).click();
    const dialog=page.locator('dialog[open]');
    await dialog.getByRole('button',{name:'Remove property',exact:true}).click();
    await page.getByRole('heading',{name:'Set up your first property',exact:true}).waitFor();
    assert.equal(await page.locator('.owner-actions').count(),0);
    const splash=page.locator('.owner-onboarding-splash img');
    assert.equal(await splash.count(),1);
    assert.equal(await splash.evaluate(image=>image.complete&&image.naturalWidth>0),true);
    assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);

    await page.getByRole('button',{name:'Add your first property',exact:true}).click();
    const form=page.locator('.property-editor form');
    await form.locator('[name="name"]').fill('Guided Setup House');
    await form.locator('[name="address"]').fill('5 Guided Setup Road, Ikeja, Lagos');
    await form.locator('[name="latitude"]').fill('6.6');
    await form.locator('[name="longitude"]').fill('3.35');
    await form.locator('[name="longitude"]').blur();
    await form.locator('[name="confirmed"]').check();
    await form.getByRole('button',{name:'Create property',exact:true}).click();
    await page.getByRole('heading',{name:'Choose a supervisor',exact:true}).waitFor();
    assert.equal(await page.getByRole('button',{name:'I’ll supervise this property',exact:true}).count(),1);
    assert.equal(await page.getByRole('button',{name:'Assign a supervisor',exact:true}).count(),1);

    await page.getByRole('button',{name:'I’ll supervise this property',exact:true}).click();
    await page.locator('.owner-actions').waitFor();
    assert.equal(await page.getByRole('button',{name:'Manage Property',exact:true}).count(),1);
    assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);
  } finally {await context.close();}
});
