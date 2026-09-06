import {test} from 'node:test';
import assert from 'node:assert/strict';
import {ownerHealth,classificationInput} from '../owner-health.js';
const now=Date.parse('2026-09-06T12:00:00Z');
const plan={id:'v1',site_id:'oak',template_id:'day',name:'Day shift',created_at:'2026-09-04T00:00:00Z',start_time:'06:00',end_time:'18:00',schedule:'09:00',guard_ids:'["g1","g2"]'};
const event=(id,kind,at,user_id,payload={})=>({id,kind,captured_at:at,received_at:'2026-09-06T10:00:00Z',user_id,payload,site_id:'oak'});

test('seven-day period excludes older records and the unfinished current day',()=>{
 const h=ownerHealth({site:{id:'oak'},now,plans:[{...plan,created_at:'2026-08-01T00:00:00Z'}],incidents:[
  {id:'old',captured_at:'2026-08-29T22:59:59Z',status:'Resolved'},
  {id:'first',captured_at:'2026-08-29T23:00:00Z',status:'Resolved'},
  {id:'last',captured_at:'2026-09-05T22:59:59Z',status:'Resolved'},
  {id:'today',captured_at:'2026-09-05T23:00:00Z',status:'Resolved'}
 ]});
 assert.equal(h.from,'2026-08-30');assert.equal(h.to,'2026-09-05');
 assert.equal(h.guard.expected,14);assert.equal(h.patrol.expected,14);
 assert.equal(h.risk.total,2);
});
test('health uses historical expected slots, weighted missed/late and capture time',()=>{
 const input={site:{id:'oak'},now,plans:[plan,{...plan,id:'v2',created_at:'2026-09-06T00:00:00Z',guard_ids:'["g1"]'}],events:[
 event('s1','start','2026-09-04T05:00:00Z','g1'),event('s2','start','2026-09-04T05:10:00Z','g2'),event('s3','start','2026-09-05T05:00:00Z','g2'),
 event('p1','patrol_start','2026-09-04T08:00:00Z','g1',{shift_id:'s1',scheduled_for:'2026-09-04T08:00:00.000Z'}),event('p2','patrol_start','2026-09-04T08:10:00Z','g2',{shift_id:'s2',scheduled_for:'2026-09-04T08:00:00.000Z'})]};
 const h=ownerHealth(input);assert.equal(h.guard.expected,4);assert.equal(h.guard.missed,1);assert.equal(h.guard.late,1);assert.equal(h.guard.score,63);
 assert.equal(h.patrol.expected,4);assert.equal(h.patrol.missed,2);assert.equal(h.patrol.late,1);assert.equal(h.patrol.score,38);
 assert.equal(h.guard.mostAffected,'Day shift');assert.ok(h.unknownDays>0);
});
test('unconfigured and Any attendance do not become perfect health',()=>{
 assert.equal(ownerHealth({site:{id:'oak'},now}).guard.score,null);
 const h=ownerHealth({site:{id:'oak'},now,plans:[{...plan,guard_ids:'["*"]'}]});assert.equal(h.guard.score,null);assert.equal(h.anyShifts,2);assert.equal(h.patrol.expected,2);
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
