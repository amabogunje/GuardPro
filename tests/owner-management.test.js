import {test,before,after} from 'node:test';
import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';
import path from 'node:path';
import {randomUUID} from 'node:crypto';
import {DatabaseSync} from 'node:sqlite';

const base='http://127.0.0.1:3123';
let server,owner,guard,supervisor,other,dataDir;
async function req(route,cookie,body,status=200){const response=await fetch(base+route,{method:body?'POST':'GET',headers:{...(cookie?{cookie,'X-Session-Proof':cookie.split('=')[1]}:{}),...(body?{'Content-Type':'application/json'}:{})},body:body?JSON.stringify(body):undefined});const value=await response.json();assert.equal(response.status,status,JSON.stringify(value));return value;}
async function login(name){const auth=await req('/api/login',null,{email:name+'@demo.isdl',password:'Pilot-only-2026!'});return 'session='+auth.proof;}
before(async()=>{dataDir=path.resolve('data/owner-management-test-'+Date.now());server=spawn(process.execPath,['server.js'],{env:{...process.env,PORT:'3123',DATA_DIR:dataDir,DATABASE_URL:'',VERCEL:'',BLOB_READ_WRITE_TOKEN:''},stdio:'pipe'});await new Promise((resolve,reject)=>{server.stdout.on('data',data=>{if(String(data).includes('running'))resolve();});server.on('exit',code=>reject(Error('Server '+code)));});[owner,guard,supervisor,other]=await Promise.all(['owner','bala','supervisor','other'].map(login));});
after(()=>server?.kill());

test('owner supervision is a persistent per-property responsibility choice',async()=>{
  await req('/api/owner-supervision/oak',supervisor,null,403);await req('/api/owner-supervision/oak',other,null,403);
  assert.equal((await req('/api/owner-supervision/oak',owner)).enabled,false);
  await req('/api/owner-supervision/oak',owner,{enabled:true});
  assert.equal((await req('/api/owner-supervision/oak',owner)).enabled,true);
  const overview=await req('/api/owner-overview/oak',owner);assert.equal(overview.ownerSupervision,true);assert.equal(overview.setup.supervisorConfigured,true);
  const state=await req('/api/state',owner);assert.ok(state.ownerSupervision.some(entry=>entry.site_id==='oak'));
  await req('/api/owner-supervision/oak',owner,{enabled:false});assert.equal((await req('/api/owner-supervision/oak',owner)).enabled,false);
});

test('owner reuses and removes same-customer guards and supervisors without deleting accounts',async()=>{
  const name='Reuse property '+randomUUID();
  await req('/api/admin',owner,{kind:'additional_site',site_id:'oak',name,address:'17 Fictional Reuse Close, Ikeja, Lagos',latitude:6.61,longitude:3.36,radius_m:100,confirmed:true});
  const state=await req('/api/state',owner),second=state.sites.find(site=>site.name===name),bala=state.users.find(user=>user.id==='bala'),existingSupervisor=state.users.find(user=>user.id==='supervisor');assert.ok(second&&bala&&existingSupervisor);
  const available=await req('/api/settings/'+second.id,owner);assert.ok(available.reusableUsers.some(user=>user.id===bala.id));assert.ok(available.reusableUsers.some(user=>user.id===existingSupervisor.id));
  await req('/api/admin',supervisor,{kind:'assign',site_id:second.id,user_id:bala.id},403);
  await req('/api/admin',owner,{kind:'assign',site_id:second.id,user_id:bala.id});await req('/api/admin',owner,{kind:'assign',site_id:second.id,user_id:existingSupervisor.id});
  const assigned=await req('/api/settings/'+second.id,owner);assert.ok(assigned.users.some(user=>user.id===bala.id));assert.ok(assigned.users.some(user=>user.id===existingSupervisor.id));
  await req('/api/admin',supervisor,{kind:'unassign',site_id:second.id,user_id:bala.id},403);
  const start={id:randomUUID(),site_id:second.id,kind:'start',captured_at:new Date().toISOString(),payload:{}};await req('/api/events',guard,start);await req('/api/admin',owner,{kind:'unassign',site_id:second.id,user_id:bala.id},409);await req('/api/events',guard,{id:randomUUID(),site_id:second.id,kind:'end',captured_at:new Date(Date.now()+10).toISOString(),payload:{shift_id:start.id}});
  await req('/api/admin',owner,{kind:'unassign',site_id:second.id,user_id:bala.id});
  await req('/api/admin',owner,{kind:'unassign',site_id:second.id,user_id:existingSupervisor.id});
  const after=await req('/api/settings/'+second.id,owner);assert.equal(after.users.some(user=>user.id===bala.id),false);assert.equal(after.users.some(user=>user.id===existingSupervisor.id),false);assert.ok(after.reusableUsers.some(user=>user.id===bala.id));assert.ok(after.reusableUsers.some(user=>user.id===existingSupervisor.id));
  const original=await req('/api/settings/oak',owner);assert.ok(original.users.some(user=>user.id===bala.id));
  const otherSite=(await req('/api/state',other)).sites[0];await req('/api/admin',other,{kind:'user',site_id:otherSite.id,name:'Foreign fixture guard',email:'foreign-'+randomUUID()+'@example.test',password:'Pilot-only-2026!',role:'guard'});
  const foreign=(await req('/api/settings/'+otherSite.id,other)).users.find(user=>user.name==='Foreign fixture guard');assert.ok(foreign);await req('/api/admin',owner,{kind:'assign',site_id:second.id,user_id:foreign.id},403);
});

test('owner archives a property without deleting its records and can create a new property afterwards',async()=>{
  const shiftId=randomUUID();
  await req('/api/events',guard,{id:shiftId,site_id:'oak',kind:'start',captured_at:new Date().toISOString(),payload:{}});
  await req('/api/owner-properties/oak/archive',other,{},403);
  await req('/api/owner-properties/oak/archive',owner,{},409);
  await req('/api/events',guard,{id:randomUUID(),site_id:'oak',kind:'end',captured_at:new Date(Date.now()+10).toISOString(),payload:{shift_id:shiftId}});
  await req('/api/owner-properties/oak/archive',owner,{});
  for(const remaining of (await req('/api/state',owner)).sites) await req('/api/owner-properties/'+remaining.id+'/archive',owner,{});
  const ownerState=await req('/api/state',owner),guardState=await req('/api/state',guard);
  assert.equal(ownerState.sites.length,0);assert.equal(guardState.sites.length,0);
  await req('/api/owner-overview/oak',owner,null,403);
  const database=new DatabaseSync(path.join(dataDir,'guard.db'));
  assert.ok(database.prepare('SELECT count(*) AS n FROM events WHERE site_id=?').get('oak').n>=2);
  assert.equal(database.prepare('SELECT owner_id FROM archived_sites WHERE site_id=?').get('oak').owner_id,'owner');database.close();
  const name='Replacement property '+randomUUID();
  await req('/api/admin',owner,{kind:'additional_site',name,address:'9 Replacement Road, Ikeja, Lagos',latitude:6.61,longitude:3.36,radius_m:100,property_type:'single_family_home',confirmed:true});
  const replacement=(await req('/api/state',owner)).sites.find(site=>site.name===name);
  assert.ok(replacement);assert.equal((await req('/api/owner-overview/'+replacement.id,owner)).setup.propertyConfigured,true);
});
