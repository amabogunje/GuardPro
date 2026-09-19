import {overviewShifts,supervisorStatus} from './public/supervisor-status.js';
import {locationGroups} from './public/gps-review.js';

// The overview describes recorded evidence, never a guarantee of security.
export function ownerOverview({site,users,supervisors,plans,shifts,events,incidents,checkpoints,locations,reviews,resolutions,ownerSupervision=false,now=Date.now()}) {
  const day=new Date(now+3600000).toISOString().slice(0,10);
  const property=locations.sort((a,b)=>b.created_at.localeCompare(a.created_at))[0];
  const scope={...site,guard_ids:users.filter(u=>u.role==='guard').map(u=>u.id)};
  const windows=overviewShifts({site:scope,plans,now}),current=windows.filter(w=>w.current);
  const expectedIds=new Set(current.flatMap(w=>w.guardIds));
  const activeIds=new Set(shifts.filter(s=>!s.ended_at && Date.parse(s.started_at)<=now).map(s=>s.user_id));
  const anyGuard=current.some(w=>w.anyGuard);
  const missing=[...expectedIds].filter(id=>!activeIds.has(id)).length;
  const patrols={completed:0,scheduled:0,needsReview:false};
  for(const w of windows.filter(w=>w.start<=now)) {
    const stat=supervisorStatus({site:scope,plans,shifts,events,incidents,checkpoints,selectedShift:w,now})[1];
    const [completed,scheduled]=stat.value.split(' of ').map(Number);
    patrols.completed+=completed||0;patrols.scheduled+=scheduled||0;
    patrols.needsReview ||= stat.tone==='attention';
  }
  const groups=locationGroups(events,reviews,site.id,now+1).filter(g=>g.pending.length);
  const records=[...events,...incidents].filter(e=>Date.parse(e.received_at)<=now);
  const lastRecordReceived=records.map(e=>e.received_at).filter(Boolean).sort().at(-1)||null;
  const lastCapturedAt=records.map(e=>e.captured_at).filter(t=>Date.parse(t)<=now).sort().at(-1)||null;
  // Recent receipt alone cannot make an old offline record current evidence.
  const recent=lastRecordReceived && lastCapturedAt && now-Date.parse(lastRecordReceived)<900000 && now-Date.parse(lastCapturedAt)<900000;
  const open=incidents.filter(i=>i.status!=='Resolved').length;
  const recentResolved=resolutions.filter(r=>r.status==='Resolved').sort((a,b)=>b.at.localeCompare(a.at)).slice(0,3).map(r=>({id:r.incident_id,report:incidents.find(i=>i.id===r.incident_id)?.report||'',resolvedAt:r.at,resolvedBy:r.actor_name,comment:r.note}));
  return {
    site:{id:site.id,name:site.name},day,
    property:property?{address:property.address,propertyType:property.property_type||'single_family_home'}:null,
    setup:{propertyConfigured:!!property,address:property?.address||'',supervisorConfigured:!!supervisors.length||ownerSupervision},
    ownerSupervision,
    supervisors,
    coverage:{active:activeIds.size,expected:anyGuard?null:expectedIds.size,missing,anyGuard,currentShiftNames:current.map(w=>w.name||'Shift')},
    patrols,problems:{open,recentOpen:incidents.filter(i=>i.status!=='Resolved').sort((a,b)=>b.received_at.localeCompare(a.received_at)).slice(0,3).map(i=>({id:i.id,report:i.report,reportedBy:users.find(u=>u.id===i.user_id)?.name||'Guard',receivedAt:i.received_at})),recentResolved},location:{pendingShifts:groups.length,pendingRecords:groups.reduce((n,g)=>n+g.pending.length,0)},
    freshness:{lastRecordReceived,lastCapturedAt,status:recent?'recent':'unconfirmed',message:recent?'Recent activity received':'Current activity unconfirmed; new records may be pending'},
    attentionRequired:!!(missing||open||groups.length||patrols.needsReview||!property||(!supervisors.length&&!ownerSupervision))
  };
}
