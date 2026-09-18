import {effectivePlans} from './public/shift-plans.js';
import {overviewShifts} from './public/supervisor-status.js';
const DAY=86400000;
export function classificationInput(body) {
  const category=body.category,priority=body.priority||null;
  if(!['security','maintenance','other'].includes(category))throw Error('Choose Security, Maintenance or Other.');
  if(category==='security'&&!['P1','P2','P3'].includes(priority))throw Error('Choose P1, P2 or P3 for a security problem.');
  if(category!=='security'&&priority)throw Error('Priority applies only to security problems.');
  return {category,priority};
}
export function ownerHealth({site,plans=[],events=[],incidents=[],classifications=[],users=[],shifts=[],now=Date.now()}) {
  const today=new Date(now+3600000).toISOString().slice(0,10);
  // Include activity already due today so the owner can see the same current
  // shift progress as the supervisor. Future shift starts and patrol slots are
  // outside the window, so they never become premature exceptions.
  const dayStart=Date.parse(today+'T00:00:00+01:00'),end=now,start=dayStart-6*DAY;
  const inRange=t=>Date.parse(t)>=start&&Date.parse(t)<end;
  const starts=events.filter(e=>e.kind==='start').map(e=>({...e,payload:typeof e.payload==='string'?JSON.parse(e.payload):e.payload}));
  const patrolStarts=events.filter(e=>e.kind==='patrol_start').map(e=>({...e,payload:typeof e.payload==='string'?JSON.parse(e.payload):e.payload}));
  const scans=events.filter(e=>e.kind==='scan').map(e=>({...e,payload:typeof e.payload==='string'?JSON.parse(e.payload):e.payload}));
  const guard=[],patrol=[],used=new Set();let unknownDays=0,anyShifts=0;
  const names=new Map(users.map(u=>[u.id,u.name]));
  const startTimes=[...new Set(plans.map(p=>p.start_time))];
  for(let day=start-DAY;day<end;day+=DAY) {
    const date=new Date(day+3600000).toISOString().slice(0,10);let known=false;
    for(const time of startTimes) {
      const expectedAt=Date.parse(date+'T'+time+':00+01:00');
      for(const p of effectivePlans(plans,expectedAt+1).filter(p=>p.start_time===time)) {
        known=true;
        let finish=Date.parse(date+'T'+p.end_time+':00+01:00');if(finish<=expectedAt)finish+=DAY;
        const label=p.name||`${p.start_time}–${p.end_time}`;
        const candidates=starts.filter(e=>(Date.parse(e.captured_at)>=expectedAt-15*60000||Date.parse(e.payload.scheduled_end_at)===finish)&&Date.parse(e.captured_at)<finish&&(!p.template_id||!e.payload.shift_template_id||e.payload.shift_template_id===p.template_id));
        const match=candidates.filter(e=>!used.has(e.id)&&(p.any_guard||e.user_id===p.guard_id)).sort((a,b)=>a.captured_at.localeCompare(b.captured_at))[0];
        if(match)used.add(match.id);
        if(expectedAt>=start&&expectedAt<end) {
          if(p.any_guard)anyShifts++;
          else if(p.guard_id)guard.push({label,window:`${p.start_time}–${p.end_time}`,guard:names.get(p.guard_id)||'Guard',expectedAt:new Date(expectedAt).toISOString(),actualAt:match?.captured_at||null,eventId:match?.id||null,status:!match?'missed':Date.parse(match.captured_at)>expectedAt+5*60000?'late':'onTime'});
        }
        if(!p.guard_id&&!p.any_guard)continue;
        // The published schedule is the expectation even when nobody checked in.
        // Any means one scheduled patrol per shift occurrence, not invented guard slots.
        for(let slotDay=day;slotDay<finish;slotDay+=DAY)for(const slot of (p.schedule||'').split(',').filter(Boolean)) {
          const at=Date.parse(new Date(slotDay+3600000).toISOString().slice(0,10)+'T'+slot+':00+01:00');
          if(at<expectedAt||at>=finish||at<start||at>=end)continue;
          const candidatesForPatrol=patrolStarts.filter(e=>e.payload.scheduled_for===new Date(at).toISOString()&&(p.any_guard?candidates.some(s=>s.id===e.payload.shift_id):e.payload.shift_id===match?.id));
          const patrolStart=candidatesForPatrol.sort((a,b)=>a.captured_at.localeCompare(b.captured_at))[0];
          const checkpointIds=Array.isArray(match?.payload.checkpoint_ids)&&match.payload.checkpoint_ids.length?match.payload.checkpoint_ids:null;
          const completed=!patrolStart?false:!checkpointIds?null:checkpointIds.every(checkpointId=>scans.some(scan=>scan.payload.shift_id===patrolStart.payload.shift_id&&scan.payload.round_id===patrolStart.payload.round_id&&scan.payload.checkpoint_id===checkpointId));
          patrol.push({label,window:`${p.start_time}–${p.end_time}`,guard:p.any_guard?'Any assigned guard':names.get(p.guard_id)||'Guard',expectedAt:new Date(at).toISOString(),actualAt:patrolStart?.captured_at||null,eventId:patrolStart?.id||null,status:!patrolStart?'missed':Date.parse(patrolStart.captured_at)>at+5*60000?'late':'onTime',completion:completed});
        }
      }
    }
    if(day>=start&&!known)unknownDays++;
  }
  const metric=rows=>{
    const expected=rows.length,missed=rows.filter(r=>r.status==='missed').length,late=rows.filter(r=>r.status==='late').length;
    const affected=new Map();for(const r of rows)affected.set(r.label,(affected.get(r.label)||0)+(r.status==='missed'?1:r.status==='late'?.5:0));
    const worst=[...affected].sort((a,b)=>b[1]-a[1])[0];
    return {expected,missed,late,onTime:expected-missed-late,score:expected?Math.round(100*(expected-missed-.5*late)/expected):null,missedPct:expected?Math.round(100*missed/expected):null,latePct:expected?Math.round(100*late/expected):null,mostAffected:worst?.[1]>0?worst[0]:null,mostAffectedWindow:worst?.[1]>0?rows.find(r=>r.label===worst[0])?.window:null,rows};
  };
  const guardMetric=metric(guard);
  const patrolMetric=metric(patrol);
  const completionKnown=patrol.filter(row=>row.completion!==null);
  const completed=patrol.filter(row=>row.completion===true).length;
  const incomplete=patrol.filter(row=>row.completion===false).length;
  const completionUnknown=patrol.length-completionKnown.length;
  // Completion carries 70% of the composite. An on-time start carries 30%.
  // A missing checkpoint snapshot leaves the score unknown rather than
  // allowing a patrol-start record to imply a completed patrol.
  patrolMetric.completed=completed;
  patrolMetric.incomplete=incomplete;
  patrolMetric.completionUnknown=completionUnknown;
  patrolMetric.score=!patrolMetric.expected||completionUnknown?null:Math.round(100*((.7*completed/patrolMetric.expected)+(.3*patrolMetric.onTime/patrolMetric.expected)));
  const reports=incidents.filter(i=>inRange(i.captured_at));
  const classified=reports.map(i=>({id:i.id,report:i.report,at:i.captured_at,...classifications.find(c=>c.incident_id===i.id)}));
  const security=classified.filter(c=>c.category==='security').length,p1=classified.filter(c=>c.category==='security'&&c.priority==='P1').length;
  const unclassified=classified.filter(c=>!c.category).length,total=reports.length;
  const currentWindows=overviewShifts({site,plans,now}).filter(window=>window.current);
  const activeGuards=new Set(shifts.filter(shift=>shift.site_id===site.id&&!shift.ended_at&&Date.parse(shift.started_at)<=now).map(shift=>shift.user_id));
  const recentPatrols=patrol.filter(row=>Date.parse(row.expectedAt)>=dayStart-2*DAY&&Date.parse(row.expectedAt)<end);
  const recentCompleted=recentPatrols.filter(row=>row.completion===true).length;
  const recentUnknown=recentPatrols.filter(row=>row.completion===null).length;
  const recentExpected=recentPatrols.length;
  const recentPercentage=recentExpected?Math.round(100*recentCompleted/recentExpected):null;
  const patrolTone=recentPercentage===null?'neutral':recentUnknown?'unconfirmed':recentPercentage>=80?'good':recentPercentage>=30?'attention':'critical';
  const dashboard={urgent:{reportedP1:p1,tone:p1?'critical':'good'},monitoring:{active:activeGuards.size,scheduled:currentWindows.length>0,tone:activeGuards.size?'good':currentWindows.length?'critical':'neutral'},patrols:{expected:recentExpected,completed:recentCompleted,unknown:recentUnknown,percentage:recentPercentage,tone:patrolTone,days:3}};
  return {from:new Date(start+3600000).toISOString().slice(0,10),to:new Date(end-1+3600000).toISOString().slice(0,10),unknownDays,anyShifts,lateGraceMinutes:5,guard:guardMetric,patrol:patrolMetric,risk:{total,security,p1,unclassified,securityPct:total?Math.round(security*100/total):null,p1Pct:total?Math.round(p1*100/total):null,label:!total?'No reports':p1?'Elevated':security?'Security reported':unclassified?'Awaiting classification':'No classified security reports',outstanding:incidents.filter(i=>i.status!=='Resolved').length,rows:classified},dashboard};
}
