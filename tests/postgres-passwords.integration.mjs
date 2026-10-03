// Run against a migrated disposable Postgres branch, never a live customer DB.
// PG_INTEGRATION_URL uses the runtime role; PG_INTEGRATION_SCHEMA names its schema.
import {test} from 'node:test';
import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';
import {randomUUID} from 'node:crypto';
test('Postgres runtime schema supports signup, private passwords, reset and revocation',async()=>{
 assert.equal(process.env.PG_INTEGRATION_ISOLATED,'yes','Explicitly confirm a disposable database branch');
 assert.ok(process.env.PG_INTEGRATION_URL);assert.ok(process.env.PG_INTEGRATION_SCHEMA);
 const child=spawn(process.execPath,['server.js'],{env:{...process.env,DATABASE_URL:process.env.PG_INTEGRATION_URL,DATABASE_SCHEMA:process.env.PG_INTEGRATION_SCHEMA,PORT:'0',VERCEL:'',BLOB_READ_WRITE_TOKEN:'',PILOT_SUPPORT_CONTACT:'test@example.invalid',SEED_DEMO:'false'},stdio:'pipe'});
 try{
  const base=await new Promise((resolve,reject)=>{const t=setTimeout(()=>reject(Error('Postgres server startup timeout')),20000);child.stdout.on('data',d=>{const m=String(d).match(/http:\/\/127\.0\.0\.1:(\d+)/);if(m){clearTimeout(t);resolve('http://127.0.0.1:'+m[1]);}});child.on('exit',c=>{clearTimeout(t);reject(Error('Server exited '+c));});});
  const api=async(route,session,body,status=200)=>{
   const r=await fetch(base+route,{method:body?'POST':'GET',headers:{...(session?{cookie:session.cookie,'X-Session-Proof':session.proof}:{}),...(body?{'Content-Type':'application/json'}:{})},body:body?JSON.stringify(body):undefined});
   const result=await r.json();assert.equal(r.status,status,route+': '+JSON.stringify(result));return {...result,cookie:r.headers.get('set-cookie')?.split(';')[0]};
  };
  const suffix=randomUUID(),password='Isolated-PG-private-2026!';
  const owner=await api('/api/signup',null,{owner_name:'Postgres regression',customer_name:'Disposable regression',property_name:'Isolated test property',email:suffix+'@example.invalid',password,address:'10 Synthetic Road, Lagos, Nigeria',latitude:6.6,longitude:3.35,radius_m:100,confirmed:true,property_type:'other',notice_accepted:true,notice_version:'2026-09-17'});
  const email='guard-'+suffix+'@example.invalid';
  await api('/api/admin',owner,{kind:'user',site_id:owner.siteId,name:'Disposable guard',email,role:'guard',password});
  let guard=await api('/api/login',null,{email,password});assert.equal(guard.passwordChangeRequired,true);
  await api('/api/state',guard,null,403);
  guard=await api('/api/password-change',guard,{password:password+'-chosen'});assert.equal(guard.passwordChangeRequired,false);
  const state=await api('/api/state',guard);assert.equal(state.sites[0].id,owner.siteId);
  await api('/api/admin',owner,{kind:'update_user',site_id:owner.siteId,user_id:guard.id,name:'Disposable guard',email,role:'guard',password:password+'-reset'});
  await api('/api/state',guard,null,401);
  const reset=await api('/api/login',null,{email,password:password+'-reset'});assert.equal(reset.passwordChangeRequired,true);
 }finally{if(child.exitCode===null){const stopped=new Promise(r=>child.once('exit',r));child.kill();await stopped;}}
});
