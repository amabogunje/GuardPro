export function reportWindow(from, to) {
  const valid = d => /^\d{4}-\d{2}-\d{2}$/.test(d || "") && !Number.isNaN(Date.parse(d)) && new Date(d).toISOString().slice(0,10) === d;
  if (!valid(from) || !valid(to) || from > to) throw Error("Choose a valid start and end date.");
  const start = Date.parse(from+"T00:00:00+01:00"), end = Date.parse(to+"T00:00:00+01:00")+86400000;
  if (end-start > 366*86400000) throw Error("Choose a range of up to one year.");
  if (to > new Date(Date.now()+3600000).toISOString().slice(0,10)) throw Error("Reports cannot include future dates.");
  return {start,end};
}
export function activityReport({from,to,site,events,incidents,resolutions,users,checkpoints,plans=[],now=Date.now()}) {
  const {start,end} = reportWindow(from,to);
  const within = at => Date.parse(at)>=start && Date.parse(at)<end;
  const people = new Map(users.map(u=>[u.id,u.name]));
  const problems = new Map(incidents.map(i=>[i.id,i]));
  const stops = new Map(checkpoints.map(c=>[c.id,c.name]));
  const labels={start:"Shift started",end:"Shift ended",patrol_start:"Patrol started",scan:"Checkpoint scanned",incident:"Problem reported",note:"Note recorded"};
  const rows=events.filter(e=>labels[e.kind] && within(e.captured_at)).map(e=>{
    const p=typeof e.payload==="string"?JSON.parse(e.payload):e.payload;
    return {id:e.id,at:e.captured_at,received_at:e.received_at,person:people.get(e.user_id)||"Guard",kind:e.kind,type:labels[e.kind],details:e.kind==="incident"?(problems.get(e.id)?.report||p.report||"Voice report"):e.kind==="scan"?(stops.get(p.checkpoint_id)||"Checkpoint"):p.note||p.slot||""};
  });
  // Include seeded/imported reports that do not have a corresponding event.
  for(const i of incidents.filter(i=>within(i.captured_at) && !rows.some(r=>r.id===i.id)))
    rows.push({id:i.id,at:i.captured_at,received_at:i.received_at,person:people.get(i.user_id)||"Guard",kind:"incident",type:"Problem reported",details:i.report});
  for(const r of resolutions.filter(r=>r.status==="Resolved" && within(r.at)))
    rows.push({id:r.incident_id,at:r.at,received_at:r.at,person:people.get(r.actor)||"Supervisor",kind:"resolved",type:"Problem resolved",details:r.note||""});
  rows.sort((a,b)=>a.at.localeCompare(b.at)||a.id.localeCompare(b.id));
  const count=kind=>rows.filter(r=>r.kind===kind).length;
  const expected={shiftStarts:0,shiftEnds:0,patrolStarts:0,checkpointScans:0};
  const today=new Date(now+3600000).toISOString().slice(0,10);
  const starts=events.filter(e=>e.kind==="start").map(e=>({...e,payload:typeof e.payload==="string"?JSON.parse(e.payload):e.payload}));
  // Include yesterday's shift so an overnight end falls in the correct report.
  for(let base=start-86400000;base<end;base+=86400000) {
    const day=new Date(base+3600000).toISOString().slice(0,10);
    let roster=effectivePlans(plans,Math.min(base+86400000,now+1));
    if(!roster.length && day===today)
      roster=users.filter(u=>u.role==="guard").map(u=>({guard_id:u.id,start_time:"00:00",end_time:"00:00"}));
    if(!roster.length && base>=start) {
      Object.keys(expected).forEach(k=>expected[k]=null);
      continue;
    }
    if(!roster.length && base<start) expected.shiftEnds=null;
    for(const p of roster) {
      if(!p.guard_id && !p.any_guard) continue;
      const shiftStart=Date.parse(day+"T"+p.start_time+":00+01:00");
      let shiftEnd=Date.parse(day+"T"+p.end_time+":00+01:00");
      if(shiftEnd<=shiftStart) shiftEnd+=86400000;
      const due=t=>t>=start && t<end && t<=now;
      // Any-guard shifts derive their attendance target from distinct guards who
      // checked in. Named assignments retain their planned target, even if absent.
      const attendees=p.any_guard ? starts.filter(e=>e.payload.shift_template_id===p.template_id && Date.parse(e.captured_at)>=shiftStart && Date.parse(e.captured_at)<shiftEnd && Date.parse(e.captured_at)<=now) : [];
      if(p.any_guard) {
        if(expected.shiftStarts!==null) expected.shiftStarts+=new Set(attendees.filter(e=>within(e.captured_at)).map(e=>e.user_id)).size;
        if(due(shiftEnd) && expected.shiftEnds!==null) expected.shiftEnds+=new Set(attendees.map(e=>e.user_id)).size;
      } else {
        if(due(shiftStart) && expected.shiftStarts!==null) expected.shiftStarts++;
        if(due(shiftEnd) && expected.shiftEnds!==null) expected.shiftEnds++;
      }
      const snapshot=starts.find(e=>(e.user_id===p.guard_id || (p.any_guard && e.payload.shift_template_id===p.template_id)) && Date.parse(e.captured_at)>=shiftStart && Date.parse(e.captured_at)<shiftEnd)?.payload;
      const schedule=snapshot?.patrol_schedule ?? p.schedule ?? (day===today ? site.schedule : null);
      if(schedule===null && shiftStart<end && shiftEnd>start) {expected.patrolStarts=null;expected.checkpointScans=null;continue;}
      for(let slotDay=base;slotDay<shiftEnd;slotDay+=86400000)
        for(const slot of (schedule||"").split(",").filter(Boolean)) {
          const date=new Date(slotDay+3600000).toISOString().slice(0,10);
          const at=Date.parse(date+"T"+slot+":00+01:00");
          if(at<shiftStart || at>=shiftEnd || !due(at)) continue;
          if(expected.patrolStarts!==null) expected.patrolStarts++;
          const stopCount=snapshot?.checkpoint_ids?.length ?? (day===today ? checkpoints.filter(c=>!c.retired_at).length : null);
          if(stopCount===null) expected.checkpointScans=null;
          else if(expected.checkpointScans!==null) expected.checkpointScans+=stopCount;
        }
    }
  }
  const reportedIds=new Set(rows.filter(r=>r.kind==="incident").map(r=>r.id));
  const resolvedReported=incidents.filter(i=>reportedIds.has(i.id)&&i.status==="Resolved").length;
  return {site:{id:site.id,name:site.name},from,to,timeZone:"Africa/Lagos",generatedAt:new Date().toISOString(),lastReceived:site.last_sync,
    counts:{shiftStarts:count("start"),shiftEnds:count("end"),patrolStarts:count("patrol_start"),checkpointScans:count("scan"),problemsReported:count("incident"),problemsResolved:resolvedReported},expected,rows};
}
import { effectivePlans } from "./public/shift-plans.js";
