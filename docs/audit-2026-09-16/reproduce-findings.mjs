// Read-only reproductions of audit findings; no server or customer data is used.
import assert from 'node:assert/strict';
import {ownerHealth} from '../../owner-health.js';
import {supervisorStatus} from '../../public/supervisor-status.js';
const now=Date.parse('2026-09-06T12:00:00Z');
const plans=[{id:'v1',site_id:'oak',template_id:'day',name:'Day',created_at:'2026-09-05T00:00:00Z',start_time:'06:00',end_time:'18:00',schedule:'09:00',guard_ids:'["g1"]'}];
const events=[{id:'s1',site_id:'oak',user_id:'g1',kind:'start',captured_at:'2026-09-05T05:00:00Z',payload:{}},{id:'p1',site_id:'oak',user_id:'g1',kind:'patrol_start',captured_at:'2026-09-05T08:00:00Z',payload:{shift_id:'s1',scheduled_for:'2026-09-05T08:00:00.000Z'}}];
const h=ownerHealth({site:{id:'oak'},now,plans,events});
assert.equal(h.patrol.score,100);assert.equal(events.filter(e=>e.kind==='scan').length,0);
console.log('A: Owner patrol health is 100% with one on-time patrol start and zero checkpoint scans. This is the implemented start-timing metric, not patrol completion.');
const selectedShift={start:Date.parse('2026-09-06T05:00:00Z'),end:Date.parse('2026-09-06T17:00:00Z'),guardIds:['g1'],schedule:'09:00'};
const base={site:{id:'oak'},selectedShift,now,plans:[],incidents:[],checkpoints:[{id:'c1'}],events:[],shifts:[{id:'yesterday',site_id:'oak',user_id:'g1',started_at:'2026-09-05T05:00:00Z',ended_at:null}]};
assert.equal(supervisorStatus(base)[0].value,'1 of 1');
console.log('B: An unclosed shift started yesterday satisfies today\'s 1-of-1 guard check-in KPI.');
const scans=[{site_id:'oak',kind:'scan',captured_at:'2026-09-06T08:01:00Z',payload:{round_id:'r1',checkpoint_id:'c1',scheduled_for:'2026-09-06T08:00:00.000Z'}}];
const before=supervisorStatus({...base,events:scans})[1].value;
const after=supervisorStatus({...base,events:scans,checkpoints:[{id:'c1'},{id:'c2'}]})[1].value;
assert.equal(before,'1 of 1');assert.equal(after,'0 of 1');
console.log('C: Identical historical scan evidence changes from '+before+' completed to '+after+' when the current checkpoint list gains a checkpoint.');
