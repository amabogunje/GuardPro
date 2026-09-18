import {test} from 'node:test';
import assert from 'node:assert/strict';
import {ownerHealth,classificationInput} from '../owner-health.js';
const now=Date.parse('2026-09-06T12:00:00Z');
const plan={id:'v1',site_id:'oak',template_id:'day',name:'Day shift',created_at:'2026-09-04T00:00:00Z',start_time:'06:00',end_time:'18:00',schedule:'09:00',guard_ids:'["g1","g2"]'};
const event=(id,kind,at,user_id,payload={})=>({id,kind,captured_at:at,received_at:'2026-09-06T10:00:00Z',user_id,payload,site_id:'oak'});

test('seven-day period includes activity already due today but excludes older records',()=>{
 const h=ownerHealth({site:{id:'oak'},now,plans:[{...plan,created_at:'2026-08-01T00:00:00Z'}],incidents:[
  {id:'old',captured_at:'2026-08-29T22:59:59Z',status:'Resolved'},
  {id:'first',captured_at:'2026-08-29T23:00:00Z',status:'Resolved'},
  {id:'last',captured_at:'2026-09-05T22:59:59Z',status:'Resolved'},
  {id:'today',captured_at:'2026-09-05T23:00:00Z',status:'Resolved'}
 ]});
 assert.equal(h.from,'2026-08-31');assert.equal(h.to,'2026-09-06');
 assert.equal(h.guard.expected,14);assert.equal(h.patrol.expected,14);
 assert.equal(h.risk.total,2);
});
test('current shift starts and completed patrols appear in owner health',()=>{
 const currentPlan={...plan,guard_ids:'["g1"]'};
 const start=event('current-start','start','2026-09-06T05:02:00Z','g1',{shift_template_id:'day',checkpoint_ids:['gate']});
 const patrol=event('current-patrol','patrol_start','2026-09-06T08:01:00Z','g1',{shift_id:'current-start',scheduled_for:'2026-09-06T08:00:00.000Z',round_id:'current-round'});
 const scan=event('current-scan','scan','2026-09-06T08:02:00Z','g1',{shift_id:'current-start',round_id:'current-round',checkpoint_id:'gate'});
 const h=ownerHealth({site:{id:'oak'},now,plans:[currentPlan],events:[start,patrol,scan],users:[{id:'g1',name:'Bala'}]});
 assert.ok(h.guard.rows.some(row=>row.eventId==='current-start'));
 assert.ok(h.patrol.rows.some(row=>row.eventId==='current-patrol'));
 assert.ok(h.patrol.completed>0);
});
test('health uses historical expected slots, weighted missed/late and capture time',()=>{
 const input={site:{id:'oak'},now,plans:[plan,{...plan,id:'v2',created_at:'2026-09-06T00:00:00Z',guard_ids:'["g1"]'}],events:[
 event('s1','start','2026-09-04T05:00:00Z','g1'),event('s2','start','2026-09-04T05:10:00Z','g2'),event('s3','start','2026-09-05T05:00:00Z','g2'),
 event('p1','patrol_start','2026-09-04T08:00:00Z','g1',{shift_id:'s1',scheduled_for:'2026-09-04T08:00:00.000Z'}),event('p2','patrol_start','2026-09-04T08:10:00Z','g2',{shift_id:'s2',scheduled_for:'2026-09-04T08:00:00.000Z'})]};
 const h=ownerHealth(input);assert.equal(h.guard.expected,5);assert.equal(h.guard.missed,2);assert.equal(h.guard.late,1);assert.equal(h.guard.score,50);
 assert.equal(h.patrol.expected,5);assert.equal(h.patrol.missed,3);assert.equal(h.patrol.late,1);assert.equal(h.patrol.score,null);assert.equal(h.patrol.completionUnknown,2);
 assert.equal(h.guard.mostAffected,'Day shift');assert.ok(h.unknownDays>0);
});
test('unconfigured and Any attendance do not become perfect health',()=>{
 assert.equal(ownerHealth({site:{id:'oak'},now}).guard.score,null);
 const h=ownerHealth({site:{id:'oak'},now,plans:[{...plan,guard_ids:'["*"]'}]});assert.equal(h.guard.score,null);assert.equal(h.anyShifts,3);assert.equal(h.patrol.expected,3);
});
test('risk uses all reports as denominator and keeps unclassified reports explicit',()=>{
 const incidents=['a','b','c','d'].map(id=>({id,captured_at:'2026-09-05T12:00:00Z',status:id==='d'?'Reported':'Resolved'}));
 const classifications=[{incident_id:'a',category:'security',priority:'P1'},{incident_id:'b',category:'security',priority:'P3'},{incident_id:'c',category:'maintenance',priority:null}];
 const r=ownerHealth({site:{id:'oak'},now,incidents,classifications}).risk;
 assert.equal(r.securityPct,50);assert.equal(r.p1Pct,25);assert.equal(r.unclassified,1);assert.equal(r.label,'Elevated');assert.equal(r.outstanding,1);
});
test('classification requires category and conditional security priority',()=>{
 for(const body of [{},{category:'bad'},{category:'security'},{category:'security',priority:'P4'},{category:'other',priority:'P1'}])assert.throws(()=>classificationInput(body));
 assert.deepEqual(classificationInput({category:'maintenance'}),{category:'maintenance',priority:null});
 assert.deepEqual(classificationInput({category:'security',priority:'P1'}),{category:'security',priority:'P1'});
});
