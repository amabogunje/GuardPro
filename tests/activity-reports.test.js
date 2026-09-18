import {test} from "node:test";
import assert from "node:assert/strict";
import {activityReport,reportWindow} from "../activity-reports.js";
import {overviewShifts,supervisorStatus} from "../public/supervisor-status.js";
test("Any roster reports a count only; named rosters retain their assigned denominator",()=>{
  const now=Date.parse("2026-01-02T18:00:00+01:00"),site={id:"s",schedule:""};
  for(const [roster,attending,total] of [[['*'],['a','b'],2],[['a','b'],['a'],2],[['*'],[],0]]) {
    const plans=[{id:"v",template_id:"day",site_id:"s",name:"Day",guard_ids:JSON.stringify(roster),start_time:"08:00",end_time:"16:00",schedule:"",created_at:"2026-01-01T00:00:00Z"}];
    const events=attending.map(user_id=>({id:user_id,kind:"start",user_id,captured_at:"2026-01-02T08:10:00+01:00",payload:{shift_template_id:"day",patrol_schedule:"",checkpoint_ids:[]}}));
    const shifts=events.map(e=>({id:e.id,site_id:"s",user_id:e.user_id,started_at:e.captured_at,ended_at:"2026-01-02T16:00:00+01:00"}));
    const window=overviewShifts({site,plans,day:"2026-01-02",now})[0];
    const kpi=supervisorStatus({site,plans,selectedShift:window,shifts,now})[0];
    assert.equal(kpi.value,roster.includes("*")?String(attending.length):`${attending.length} of ${total}`);
    assert.equal(kpi.qualifier,"checked");
    assert.equal(kpi.tone,attending.length<total?"attention":"good");
    const report=activityReport({from:"2026-01-02",to:"2026-01-02",now,site,plans,events,users:[],checkpoints:[],incidents:[],resolutions:[]});
    assert.equal(report.counts.shiftStarts,attending.length);
    assert.equal(report.expected.shiftStarts,total);
    assert.equal(report.expected.shiftEnds,total);
    assert.equal(report.counts.shiftEnds,0,"A check-in does not imply a recorded check-out");
  }
});
test("activity reports use Nigerian day boundaries and source-matched counts",()=>{
  const events=[
    {id:"outside",kind:"start",captured_at:"2026-01-01T22:59:59Z",user_id:"g",payload:"{}"},
    {id:"start",kind:"start",captured_at:"2026-01-01T23:00:00Z",user_id:"g",payload:"{}"},
    {id:"scan",kind:"scan",captured_at:"2026-01-02T10:00:00Z",user_id:"g",payload:'{"checkpoint_id":"c"}'},
    {id:"outside2",kind:"end",captured_at:"2026-01-02T23:00:00Z",user_id:"g",payload:"{}"},
  ];
  const report=activityReport({from:"2026-01-02",to:"2026-01-02",site:{id:"s",name:"Test"},events,incidents:[{id:"problem",user_id:"g",captured_at:"2026-01-02T12:00:00Z",report:"Damaged lock"}],resolutions:[{incident_id:"older-problem",actor:"supervisor",status:"Resolved",at:"2026-01-02T14:00:00Z",note:"Fixed"}],users:[{id:"g",name:"Bala"}],checkpoints:[{id:"c",name:"Gate"}]});
  assert.deepEqual(report.counts,{shiftStarts:1,shiftEnds:0,patrolStarts:0,checkpointScans:1,problemsReported:1,problemsResolved:0});
  assert.equal(report.rows.length,4);
  assert.equal(report.rows[1].details,"Gate");
  assert.throws(()=>reportWindow("2026-02-30","2026-03-01"));
  assert.throws(()=>reportWindow("2025-01-01","2026-02-01"));
  assert.throws(()=>reportWindow("2026-01-03","2026-01-02"));
});
test("expectations count due guard shifts and patrol stops; resolved count stays within report cohort",()=>{
  const report=activityReport({from:"2026-01-02",to:"2026-01-02",now:Date.parse("2026-01-02T09:00:00+01:00"),
    site:{id:"s",schedule:"08:30,10:00"}, users:[{id:"g",role:"guard",name:"Bala"}],checkpoints:[{id:"a"},{id:"b"}],
    plans:[{guard_id:"g",start_time:"08:00",end_time:"16:00",created_at:"2026-01-01T00:00:00Z"}],
    events:[{id:"s1",kind:"start",user_id:"g",captured_at:"2026-01-02T08:00:00+01:00",payload:{patrol_schedule:"08:30,10:00",checkpoint_ids:["a","b"]}},
      {id:"s2",kind:"start",user_id:"g",captured_at:"2026-01-02T08:10:00+01:00",payload:{}}],
    incidents:[{id:"p1",user_id:"g",captured_at:"2026-01-02T08:20:00+01:00",status:"Resolved"},{id:"p2",user_id:"g",captured_at:"2026-01-02T08:25:00+01:00",status:"Reported"},{id:"older",captured_at:"2026-01-01T08:00:00+01:00",status:"Resolved"}],
    resolutions:[{incident_id:"older",status:"Resolved",at:"2026-01-02T08:30:00+01:00"}]});
  assert.deepEqual(report.expected,{shiftStarts:1,shiftEnds:0,patrolStarts:1,checkpointScans:2});
  assert.equal(report.counts.shiftStarts,1,"Duplicate starts count once for their scheduled occurrence");
  assert.equal(report.counts.problemsResolved,1);
  assert.equal(report.counts.problemsReported,2);
});
test("activity reports do not count stale or late starts as attendance for a scheduled occurrence",()=>{
  const report=activityReport({
    from:"2026-01-02",to:"2026-01-02",now:Date.parse("2026-01-02T20:00:00+01:00"),
    site:{id:"s",name:"Test"},users:[],checkpoints:[],incidents:[],resolutions:[],
    plans:[{template_id:"day",guard_ids:["bala"],start_time:"08:00",end_time:"16:00",created_at:"2026-01-01T00:00:00Z"}],
    events:[
      {id:"stale",kind:"start",user_id:"bala",captured_at:"2026-01-01T08:00:00+01:00",payload:{shift_template_id:"day"}},
      {id:"late",kind:"start",user_id:"bala",captured_at:"2026-01-02T16:00:00+01:00",payload:{shift_template_id:"day"}},
    ],
  });
  assert.equal(report.expected.shiftStarts,1);
  assert.equal(report.counts.shiftStarts,0);
});
