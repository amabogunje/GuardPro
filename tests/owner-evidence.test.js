import {test,before,after} from 'node:test';
import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';
import path from 'node:path';
import {randomUUID} from 'node:crypto';
import {ownerHealth} from '../owner-health.js';

const base='http://127.0.0.1:3122';
let server,owner,guard,supervisor,other,incidentId,mediaId;
async function req(route,cookie,body,status=200){
  const r=await fetch(base+route,{method:body?'POST':'GET',headers:{...(cookie?{cookie,'X-Session-Proof':cookie.split('=')[1]}:{}),...(body&&! (body instanceof FormData)?{'Content-Type':'application/json'}:{})},body:body instanceof FormData?body:body?JSON.stringify(body):undefined});
  const value=await r.json();assert.equal(r.status,status,JSON.stringify(value));return value;
}
async function login(name){const auth=await req('/api/login',null,{email:name+'@demo.isdl',password:'Pilot-only-2026!'});return 'session='+auth.proof;}
const event=(kind,payload={})=>({id:randomUUID(),site_id:'oak',kind,captured_at:new Date().toISOString(),payload});

before(async()=>{
  server=spawn(process.execPath,['server.js'],{env:{...process.env,PORT:'3122',DATA_DIR:path.resolve('data/owner-evidence-test-'+Date.now()),DATABASE_URL:'',VERCEL:'',BLOB_READ_WRITE_TOKEN:''},stdio:'pipe'});
  await new Promise((resolve,reject)=>{server.stdout.on('data',d=>{if(String(d).includes('running'))resolve();});server.on('exit',c=>reject(Error('Server '+c)));});
  [owner,guard,supervisor,other]=await Promise.all(['owner','bala','supervisor','other'].map(login));
  const start=event('start');await req('/api/events',guard,start);
  incidentId=randomUUID();const incident={...event('incident',{shift_id:start.id,report:'Fictional damaged lock reported for review.',event_time:'Not known',approved:true}),id:incidentId,captured_at:start.captured_at};await req('/api/events',guard,incident);
  mediaId=randomUUID();const form=new FormData();form.append('file',new Blob([Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aUAAAAABJRU5ErkJggg==','base64')],{type:'image/png'}),'evidence.png');form.append('source','camera');await req('/api/media/'+incidentId+'/'+mediaId,guard,form);
});
after(()=>server?.kill());

test('owner evidence is owner-only, tenant scoped and retains private media authorization',async()=>{
  for(const cookie of [guard,supervisor,other])await req('/api/owner-evidence/oak?kind=problems',cookie,null,403);
  await req('/api/owner-evidence/other?kind=problems',owner,null,403);
  const list=await req('/api/owner-evidence/oak?kind=problems',owner);
  const row=list.problems.find(p=>p.id===incidentId);assert.equal(row.reportedBy,'Bala');assert.equal(row.classification,null);
  const detail=await req('/api/owner-evidence/oak?kind=problems&id='+incidentId,owner);
  assert.equal(detail.problem.media[0].id,mediaId);assert.equal(JSON.stringify(detail).includes('password'),false);
  const link=await req('/api/media/'+mediaId+'/link',owner);assert.ok(link.url.startsWith('/media/'));
  await req('/api/media/'+mediaId+'/link',other,null,403);
});

test('owner activity labels the current seven-day period and patrol starts as partial evidence',async()=>{
  const activity=await req('/api/owner-evidence/oak?kind=activity',owner);
  assert.match(activity.period.label,/last seven days/);
  assert.equal(activity.period.to,new Date(Date.now()+3600000).toISOString().slice(0,10));
  assert.ok(Array.isArray(activity.metrics.patrol.rows));
  const historic=ownerHealth({now:Date.parse('2026-09-09T12:00:00Z'),site:{id:'s'},plans:[],events:[],incidents:[{id:'i',captured_at:'2026-09-04T12:00:00Z',status:'Resolved'}],classifications:[],users:[]});
  assert.equal(historic.risk.label,'Awaiting classification');
  const classified=ownerHealth({now:Date.parse('2026-09-09T12:00:00Z'),site:{id:'s'},plans:[],events:[],incidents:[{id:'i',captured_at:'2026-09-04T12:00:00Z',status:'Resolved'}],classifications:[{incident_id:'i',category:'maintenance',priority:null}],users:[]});
  assert.equal(classified.risk.label,'No classified security reports');
});

test('patrol health weights completed checkpoints above start timing',()=>{
  const scheduled='2026-09-08T09:00:00.000Z';
  const base={now:Date.parse('2026-09-09T12:00:00Z'),site:{id:'s'},users:[{id:'g',name:'Bala'}],incidents:[],classifications:[],plans:[{site_id:'s',guard_id:'g',start_time:'08:00',end_time:'16:00',schedule:'10:00',created_at:'2026-09-08T00:00:00Z'}]};
  const start={id:'shift',kind:'start',user_id:'g',captured_at:'2026-09-08T07:00:00.000Z',payload:{checkpoint_ids:['a','b']}};
  const patrol={id:'patrol',kind:'patrol_start',user_id:'g',captured_at:'2026-09-08T09:07:00.000Z',payload:{shift_id:'shift',round_id:'round',scheduled_for:scheduled}};
  const scans=['a','b'].map(checkpoint_id=>({id:checkpoint_id,kind:'scan',user_id:'g',captured_at:'2026-09-08T09:08:00.000Z',payload:{shift_id:'shift',round_id:'round',checkpoint_id}}));
  const complete=ownerHealth({...base,events:[start,patrol,...scans]}).patrol;
  assert.deepEqual([complete.expected,complete.completed,complete.incomplete,complete.late,complete.score],[2,1,1,1,35]);
  const incomplete=ownerHealth({...base,events:[start,{...patrol,captured_at:'2026-09-08T09:00:00.000Z'}]}).patrol;
  assert.deepEqual([incomplete.completed,incomplete.incomplete,incomplete.late,incomplete.score],[0,2,0,15]);
});
