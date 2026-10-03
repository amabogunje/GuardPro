import {test,before,after} from 'node:test';
import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';
import path from 'node:path';
import {DatabaseSync} from 'node:sqlite';
import fs from 'node:fs';
import {chromium} from '@playwright/test';
const data=path.resolve('data','password-change-'+Date.now());
let server,base,owner;
async function request(route,session,body,status=200) {
  const r=await fetch(base+route,{method:body?'POST':'GET',headers:{...(body?{'Content-Type':'application/json'}:{}),...(session?{cookie:session.cookie,'X-Session-Proof':session.proof}:{})},body:body?JSON.stringify(body):undefined});
  const result=await r.json();assert.equal(r.status,status,JSON.stringify(result));
  return {...result,cookie:r.headers.get('set-cookie')?.split(';')[0]};
}
const login=(email,password)=>request('/api/login',null,{email,password});
before(async()=>{
  server=spawn(process.execPath,['server.js'],{env:{...process.env,PORT:'0',DATA_DIR:data,DATABASE_URL:'',VERCEL:'',BLOB_READ_WRITE_TOKEN:'',OPENAI_API_KEY:''},stdio:'pipe'});
  base=await new Promise((resolve,reject)=>{const timer=setTimeout(()=>{server.kill();reject(Error('Server startup timeout'));},15000);server.stdout.on('data',chunk=>{const m=String(chunk).match(/http:\/\/[^:]+:(\d+)/);if(m){clearTimeout(timer);resolve('http://127.0.0.1:'+m[1]);}});server.on('exit',code=>{clearTimeout(timer);reject(Error('Server exit '+code));});});
  owner=await login('owner@demo.isdl','Pilot-only-2026!');
});
test('supervisors manage only local guards; peer, promotion, shared and cross-customer resets are denied',async()=>{
  const supervisor=await login('supervisor@demo.isdl','Pilot-only-2026!');
  await request('/api/admin',owner,{kind:'user',site_id:'oak',role:'guard',name:'Scope Guard',email:'scope@example.test',password:'Temporary-scope-2026!'});
  const state=await request('/api/state',owner);
  const member=state.users.find(u=>u.name==='Scope Guard');
  const edit={kind:'update_user',site_id:'oak',user_id:member.id,name:member.name,email:'scope@example.test',role:'guard',password:'Supervisor-reset-2026!'};
  await request('/api/admin',supervisor,edit);
  await request('/api/admin',supervisor,{...edit,user_id:'supervisor',role:'supervisor'},403);
  await request('/api/admin',supervisor,{...edit,role:'supervisor'},403);
  await request('/api/admin',supervisor,{kind:'user',site_id:'oak',role:'supervisor',name:'Peer',email:'peer@example.test',password:'Temporary-peer-2026!'},403);
  const other=await login('other@demo.isdl','Pilot-only-2026!');
  await request('/api/admin',other,edit,403);
  const db=new DatabaseSync(path.join(data,'guard.db'));
  db.prepare("INSERT INTO sites(id,customer_id,name) VALUES('shared','oak','Shared test')").run();
  db.prepare("INSERT INTO assignments VALUES(?,'shared')").run(member.id);
  db.close();
  await request('/api/admin',supervisor,edit,403);
  await request('/api/admin',owner,edit);
});
test('legacy-account migration flags existing non-owners once and preserves completed passwords',()=>{
  const db=new DatabaseSync(':memory:');
  db.exec("CREATE TABLE users(id TEXT PRIMARY KEY,role TEXT); INSERT INTO users VALUES('g','guard'),('s','supervisor'),('o','owner');");
  const sql=fs.readFileSync('migrations/025.sql','utf8');db.exec(sql);
  assert.equal(db.prepare('SELECT count(*) n FROM user_password_state WHERE must_change=1').get().n,2);
  db.exec("UPDATE user_password_state SET must_change=0 WHERE user_id='g'");db.exec(sql);
  assert.equal(db.prepare("SELECT must_change FROM user_password_state WHERE user_id='g'").get().must_change,0);
  db.close();
});
test('mobile browser completes private password and displays Other property image',async()=>{
  await request('/api/admin',owner,{kind:'user',site_id:'oak',role:'guard',name:'Browser Guard',email:'browser@example.test',password:'Temporary-browser-2026!'});
  const browser=await chromium.launch({executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe',headless:true});
  try {
    const page=await browser.newPage({viewport:{width:390,height:844}}),errors=[];
    page.on('pageerror',e=>errors.push(e.message));
    await page.goto(base+'/app');
    await page.locator('#email').fill('browser@example.test');await page.locator('#password').fill('Temporary-browser-2026!');
    await page.getByRole('button',{name:'Sign in',exact:true}).click();
    await page.getByRole('heading',{name:'Choose your own password'}).waitFor();
    await page.locator('#privatePassword [name="password"]').fill('Private-browser-2026!');
    await page.locator('#privatePassword [name="confirm"]').fill('Private-browser-2026!');
    fs.mkdirSync('docs/remediation-evidence/R-036',{recursive:true});
    await page.screenshot({path:'docs/remediation-evidence/R-036/password-mobile.png',fullPage:true});
    assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
    await page.getByRole('button',{name:'Save my password'}).click();
    await page.locator('#privatePassword').waitFor({state:'detached'});
    assert.equal((await login('browser@example.test','Private-browser-2026!')).passwordChangeRequired,false);
    assert.deepEqual(errors,[]);
    await request('/api/site-location',owner,{site_id:'oak',address:'1 Other Property Street, Lagos',latitude:6.6,longitude:3.35,radius_m:100,confirmed:true,property_type:'other'});
    const ownerPage=await browser.newPage({viewport:{width:390,height:844}});
    await ownerPage.goto(base+'/app');await ownerPage.locator('#email').fill('owner@demo.isdl');await ownerPage.locator('#password').fill('Pilot-only-2026!');
    await ownerPage.getByRole('button',{name:'Sign in',exact:true}).click();
    await ownerPage.locator('img[src="/property-heroes/other.svg"]').waitFor();
    assert.ok(await ownerPage.locator('img[src="/property-heroes/other.svg"]').evaluate(img=>img.complete&&img.naturalWidth>0));
    fs.mkdirSync('docs/remediation-evidence/R-037',{recursive:true});
    await ownerPage.screenshot({path:'docs/remediation-evidence/R-037/other-mobile.png',fullPage:true});
    assert.equal((await request('/api/state',owner)).propertyLocations.at(-1).property_type,'other');
  } finally {await browser.close();}
});
test('password vault transition copies pending evidence and retains the original encrypted record',async()=>{
  const browser=await chromium.launch({executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe',headless:true});
  try {
    const page=await browser.newPage();await page.goto(base+'/icon.svg');
    const result=await page.evaluate(async()=>{
      const v=await import('/vault.js');
      await v.unlock('vault@example.test','Old-private-2026!','old-vault');
      await v.save({queue:[{id:'unsent-evidence',attachments:[{id:'audio'}]}],draft:{text:'Unsent report'}});
      await v.lock();
      let blocked=false;
      try {await v.unlock('vault@example.test','New-private-2026!','new-vault');}catch {blocked=true;}
      const old=await v.unlockSavedWork('vault@example.test','Old-private-2026!','new-vault');
      await v.unlock('vault@example.test','New-private-2026!','new-vault',true);await v.save(old);await v.lock();
      const recovered=await v.unlock('vault@example.test','New-private-2026!','new-vault');
      const retained=await v.unlock('vault@example.test','Old-private-2026!','old-vault');
      return {blocked,recovered,retained};
    });
    assert.equal(result.blocked,true);assert.deepEqual(result.recovered,result.retained);
    assert.equal(result.recovered.queue[0].attachments[0].id,'audio');
  }finally{await browser.close();}
});
after(()=>server?.kill());
test('reset screen recovers known-password drafts or explicitly retains inaccessible work',async()=>{
  const browser=await chromium.launch({executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe',headless:true});
  try {
    for(const recover of [true,false]) {
      const page=await browser.newPage({viewport:{width:390,height:844}});await page.goto(base+'/app');await page.locator('#login').waitFor();
      await page.evaluate(async()=>{
        const v=await import('/vault.js'),{passwordChangeScreen}=await import('/password-change.js');
        await v.unlock('screen@example.test','Old-private-2026!','screen-old');
        await v.save({state:{user:{id:'screen-user'}},queue:[{id:'pending-screen'}],draft:{text:'Keep this report'}});
        document.body.innerHTML='<div id="root"></div>';
        passwordChangeScreen(document.querySelector('#root'),{
          credentials:{email:'screen@example.test',password:'Temporary-screen-2026!'},
          online:{id:'screen-user',vaultAccount:'screen-old'},brand:()=>'',
          api:async()=>({id:'screen-user',vaultAccount:'screen-new',proof:'test-proof'}),
          complete:async credentials=>{window.result=await v.unlock(credentials.email,credentials.password,'screen-new');},cancel:()=>{}
        });
      });
      await page.locator('[name="password"]').fill('New-private-2026!');await page.locator('[name="confirm"]').fill('New-private-2026!');
      await page.getByRole('button',{name:'Save my password'}).click();
      await page.locator('#saved-work-recovery').waitFor({state:'visible'});
      if(recover)await page.locator('[name="previous"]').fill('Old-private-2026!');
      else await page.locator('[name="start_fresh"]').check();
      await page.getByRole('button',{name:'Save my password'}).click();await page.waitForFunction(()=>window.result);
      const result=await page.evaluate(()=>window.result);
      assert.equal(result.queue.length,recover?1:0);
      if(recover)assert.equal(result.draft.text,'Keep this report');
      const retained=await page.evaluate(async()=>{const v=await import('/vault.js');return v.unlock('screen@example.test','Old-private-2026!','screen-old');});
      assert.equal(retained.queue[0].id,'pending-screen');await page.close();
    }
  }finally{await browser.close();}
});
test('temporary passwords restrict access, require private replacement, revoke sessions and audit without secrets',async()=>{
  const temporary='Temporary-password-2026!',privatePassword='Private-password-2026!';
  await request('/api/admin',owner,{kind:'user',site_id:'oak',role:'guard',name:'Private Guard',email:'private@example.test',password:temporary});
  const first=await login('private@example.test',temporary);
  assert.equal(first.passwordChangeRequired,true);
  await request('/api/state',first,null,403);
  await request('/api/password-change',first,{password:temporary},400);
  await request('/api/password-change',first,{password:'short'},400);
  const second=await login('private@example.test',temporary);
  const completed=await request('/api/password-change',first,{password:privatePassword});
  assert.equal(completed.passwordChangeRequired,false);
  assert.notEqual(completed.vaultAccount,first.vaultAccount);
  await request('/api/state',completed);
  await request('/api/state',second,null,401);
  await request('/api/login',null,{email:'private@example.test',password:temporary},401);
  const reset='Reset-temporary-2026!';
  await request('/api/admin',owner,{kind:'update_user',site_id:'oak',user_id:first.id,name:'Private Guard',role:'guard',email:'private@example.test',password:reset});
  await request('/api/state',completed,null,401);
  assert.equal((await login('private@example.test',reset)).passwordChangeRequired,true);
  const db=new DatabaseSync(path.join(data,'guard.db'));
  const rows=db.prepare("SELECT * FROM audit WHERE action IN ('user.password_temporary_created','user.password_reset','user.password_changed')").all().filter(row=>JSON.parse(row.detail).user_id===first.id);
  assert.equal(rows.length,3);
  const serialized=JSON.stringify(rows);
  for(const secret of [temporary,privatePassword,reset])assert.ok(!serialized.includes(secret));
  db.close();
});
