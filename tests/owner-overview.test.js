import {test,before,after} from 'node:test';
import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';
import path from 'node:path';
import {ownerOverview} from '../owner-overview.js';
const base='http://127.0.0.1:3113';let server,owner,guard,supervisor,other;
async function req(route,cookie,body,status=200){const r=await fetch(base+route,{method:body?'POST':'GET',headers:{...(cookie?{cookie,'X-Session-Proof':cookie.split('=')[1]}:{}),...(body?{'Content-Type':'application/json'}:{})},body:body?JSON.stringify(body):undefined});const value=await r.json();assert.equal(r.status,status,JSON.stringify(value));return value;}
async function login(name){const auth=await req('/api/login',null,{email:name+'@demo.isdl',password:'Pilot-only-2026!'});return 'session='+auth.proof;}
before(async()=>{server=spawn(process.execPath,['server.js'],{env:{...process.env,PORT:'3113',DATA_DIR:path.resolve('data/owner-test-'+Date.now()),DATABASE_URL:'',VERCEL:'',BLOB_READ_WRITE_TOKEN:''},stdio:'pipe'});await new Promise((resolve,reject)=>{server.stdout.on('data',d=>{if(String(d).includes('running'))resolve();});server.on('exit',c=>reject(Error('Server '+c)));});[owner,guard,supervisor,other]=await Promise.all(['owner','bala','supervisor','other'].map(login));});
after(()=>server?.kill());
test('owner overview is assigned-site scoped and excludes secrets',async()=>{
 await req('/api/owner-overview/oak',guard,null,403);await req('/api/owner-overview/oak',supervisor,null,403);await req('/api/owner-overview/oak',other,null,403);
 const result=await req('/api/owner-overview/oak',owner);
 assert.equal(result.site.id,'oak');assert.equal(result.setup.propertyConfigured,false);assert.equal(result.supervisors[0].name,'Ada');assert.ok(['recent','unconfirmed'].includes(result.freshness.status));assert.equal(JSON.stringify(result).includes('password'),false);
 const state=await req('/api/state',owner);assert.equal(result.problems.open,state.incidents.filter(i=>i.site_id==='oak'&&i.status!=='Resolved').length);
});
test('owner acting as supervisor resolves scoped problems retaining actual identity',async()=>{
 const state=await req('/api/state',owner),incident=state.incidents.find(i=>i.site_id==='oak'&&i.status!=='Resolved');assert.ok(incident);
 await req('/api/incidents/'+incident.id+'/resolve',other,{note:'No access'},403);
 await req('/api/incidents/'+incident.id+'/resolve',guard,{note:'No access'},403);
 await req('/api/incidents/'+incident.id+'/resolve',owner,{note:'Owner checked and addressed this.'});
 const updated=await req('/api/owner-overview/oak',owner),resolved=updated.problems.recentResolved.find(i=>i.id===incident.id);
 assert.equal(resolved.comment,'Owner checked and addressed this.');assert.ok(resolved.resolvedBy);
 const history=(await req('/api/state',owner)).incidents.find(i=>i.id===incident.id).history;assert.equal(history.find(t=>t.status==='Resolved').actor,state.user.id);
});
test('old offline captures received now remain unconfirmed; Any does not invent staffing expectations',()=>{
 const now=Date.parse('2026-09-06T12:00:00Z');
 const result=ownerOverview({now,site:{id:'s',schedule:''},users:[],supervisors:[],plans:[],shifts:[],events:[{id:'e',site_id:'s',kind:'note',payload:{},captured_at:'2026-09-05T12:00:00Z',received_at:new Date(now).toISOString()}],incidents:[],checkpoints:[],locations:[],reviews:[],resolutions:[]});
 assert.equal(result.freshness.status,'unconfirmed');assert.equal(result.freshness.lastRecordReceived,new Date(now).toISOString());assert.equal(result.attentionRequired,true);
});
test('Any roster records attendance without claiming a required headcount; named roster flags missing guard',()=>{
 const input={now:Date.parse('2026-09-06T12:00:00Z'),site:{id:'s',schedule:''},users:[{id:'g1',role:'guard'},{id:'g2',role:'guard'}],supervisors:[],plans:[{site_id:'s',template_id:'t',created_at:'2026-09-01T00:00:00Z',start_time:'00:00',end_time:'00:00',guard_ids:'["*"]',schedule:''}],shifts:[{id:'shift',site_id:'s',user_id:'g1',started_at:'2026-09-06T10:00:00Z',ended_at:null}],events:[],incidents:[],checkpoints:[],locations:[],reviews:[],resolutions:[]};
 assert.deepEqual([ownerOverview(input).coverage.active,ownerOverview(input).coverage.expected],[1,null]);
 input.plans[0].guard_ids='["g1","g2"]';const named=ownerOverview(input).coverage;assert.equal(named.expected,2);assert.equal(named.missing,1);
});
