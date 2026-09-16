import {spawn} from 'node:child_process';
import {randomUUID} from 'node:crypto';
import path from 'node:path';
const server=spawn(process.execPath,['server.js'],{env:{...process.env,PORT:'3198',DATA_DIR:path.resolve('data','audit-probe-'+Date.now()),DATABASE_URL:'',VERCEL:'',OPENAI_API_KEY:'',BLOB_READ_WRITE_TOKEN:''},stdio:'pipe'});
try {
 await new Promise((r,j)=>{server.stdout.on('data',d=>{if(String(d).includes('running'))r();});server.on('exit',c=>j(Error('exit '+c)));});
 const base='http://127.0.0.1:3198';
 async function login(role){const r=await fetch(base+'/api/login',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({email:role+'@demo.isdl',password:'Pilot-only-2026!'})});const a=await r.json();return {'Content-Type':'application/json',cookie:r.headers.get('set-cookie').split(';')[0],'X-Session-Proof':a.proof};}
 const guard=await login('bala'),supervisor=await login('supervisor'),owner=await login('owner');
 async function req(url,headers,body){const r=await fetch(base+url,{headers,method:body?'POST':'GET',body:body?JSON.stringify(body):undefined});return {status:r.status,data:await r.json()};}
 console.log('new_property',await req('/api/admin',owner,{kind:'additional_site',site_id:'oak',name:'Audit second property',address:'10 Fictional Avenue Ikeja',latitude:6.5,longitude:3.3,radius_m:100,confirmed:true}));
 const second=(await req('/api/state',owner)).data.sites.find(s=>s.name==='Audit second property');
 const email='second-'+randomUUID()+'@audit.invalid';
 console.log('new_other_site_supervisor',await req('/api/admin',owner,{kind:'user',site_id:second.id,name:'Second site supervisor',email,password:'Audit-only-password!',role:'supervisor'}));
 const victim=(await req('/api/settings/'+second.id,owner)).data.users.find(u=>u.email===email);
 console.log('supervisor_cannot_read_second_property',await req('/api/settings/'+second.id,supervisor));
 console.log('assign_outside_scope_user',await req('/api/admin',supervisor,{kind:'assign',site_id:'oak',user_id:victim.id}));
 console.log('reset_outside_scope_user',await req('/api/admin',supervisor,{kind:'update_user',site_id:'oak',user_id:victim.id,name:victim.name,email,password:'Changed-audit-password!',role:'supervisor'}));
 const start={id:randomUUID(),site_id:'oak',kind:'start',captured_at:new Date().toISOString(),payload:{}};
 console.log('start',await req('/api/events',guard,start));
 console.log('disable_active_guard',await req('/api/admin',supervisor,{kind:'update_user',site_id:'oak',user_id:'bala',name:'Bala',email:'bala@demo.isdl',role:'guard',disabled:'true'}));
 const incident={id:randomUUID(),site_id:'oak',kind:'incident',captured_at:new Date().toISOString(),payload:{shift_id:start.id,event_time:'Not stated',report:'Voice report — listen to the attached recording.',report_format:'audio',typed_report:'',approved:true}};
 console.log('audio_report_no_attachment',await req('/api/events',guard,incident));
 console.log('resolve_without_attachment',await req('/api/incidents/'+incident.id+'/resolve',supervisor,{category:'other',note:'Cannot listen'}));
 const end={id:randomUUID(),site_id:'oak',kind:'end',captured_at:new Date(Date.now()-3600000).toISOString(),payload:{shift_id:start.id}};
 console.log('end_before_start',await req('/api/events',guard,end));
 const state=await req('/api/state',guard); console.log('stored_shift',state.data.shifts.find(s=>s.id===start.id));
} finally {server.kill();}
