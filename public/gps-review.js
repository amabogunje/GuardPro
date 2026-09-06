export function locationGroups(events,reviews,siteId,cutoff=Infinity) {
  const reviewed=new Set(reviews.flatMap(r=>JSON.parse(r.event_ids)));
  const groups=new Map();
  for(const event of events) {
    const p=event.payload,shiftId=event.kind==='start'?event.id:p.shift_id;
    if(event.site_id!==siteId||!['start','scan'].includes(event.kind)||!shiftId||Date.parse(event.captured_at)>=cutoff||!['outside','unconfirmed'].includes(p.location_assessment?.status))continue;
    if(!groups.has(shiftId))groups.set(shiftId,{shiftId,guardId:event.user_id,events:[],pending:[]});
    const group=groups.get(shiftId);group.events.push(event);if(!reviewed.has(event.id))group.pending.push(event);
  }
  return [...groups.values()];
}
export function gpsReview(host,{group,reviews,guardName,esc,api,done}) {
  if(!group){host.innerHTML='<section class="card"><p>No location exceptions for this shift.</p></section>';return;}
  const fmt=t=>new Date(t).toLocaleString('en-GB',{timeZone:'Africa/Lagos',dateStyle:'medium',timeStyle:'short'});
  host.innerHTML=`<section class="card"><h2>${esc(guardName(group.guardId))}</h2><p>GPS is supporting evidence. An exception does not prove absence or misconduct.</p>${group.events.sort((a,b)=>a.captured_at.localeCompare(b.captured_at)).map(e=>{
    const a=e.payload.location_assessment,r=a.reference;
    return `<article class="gps-record"><h3>${e.kind==='start'?'Shift check-in':'Checkpoint scan'}</h3><strong>${a.status==='outside'?'Location outside property area':'Location could not be confirmed'}</strong><p>${esc(a.reason)}</p><small>Captured ${esc(fmt(e.captured_at))}<br>Received ${esc(fmt(e.received_at))}</small><p>${a.distance_m!=null?`${a.distance_m} m from property · GPS accuracy ±${Math.round(a.accuracy_m)} m`:'Distance could not be assessed.'}</p>${r?`<p><strong>Owner-confirmed property</strong><br>${esc(r.address)}<br>Allowed radius: ${r.radius_m} m</p><a href="https://www.openstreetmap.org/?mlat=${r.latitude}&mlon=${r.longitude}#map=18/${r.latitude}/${r.longitude}" target="_blank" rel="noopener noreferrer">View property on map</a>`:'<p>The owner needs to confirm the property address and map position.</p>'}${e.payload.location?`<p><a href="https://www.openstreetmap.org/?mlat=${e.payload.location.latitude}&mlon=${e.payload.location.longitude}#map=18/${e.payload.location.latitude}/${e.payload.location.longitude}" target="_blank" rel="noopener noreferrer">View recorded position</a></p>`:''}</article>`;
  }).join('')}${group.pending.length?'<form id="gps-review-form"><label class="label">Comment (optional)<textarea name="comment" maxlength="3000"></textarea></label><button class="primary">Mark reviewed</button><p role="status"></p></form>':'<p>All displayed location exceptions have been reviewed.</p>'}</section><section class="card"><h2>Review history</h2>${reviews.filter(r=>r.shift_id===group.shiftId).map(r=>`<article class="gps-record"><strong>Reviewed by ${esc(r.actor_name)}</strong><small>${esc(fmt(r.at))}</small>${r.comment?`<p>${esc(r.comment)}</p>`:''}</article>`).join('')||'<p>No reviews yet.</p>'}</section>`;
  host.querySelector('form')?.addEventListener('submit',async e=>{
    e.preventDefault();e.stopPropagation();e.submitter.disabled=true;
    try{await api('/api/location-review',{site_id:group.events[0].site_id,shift_id:group.shiftId,event_ids:group.pending.map(e=>e.id),comment:e.target.elements.comment.value});await done();}
    catch(error){e.target.querySelector('[role="status"]').textContent=error.message;e.submitter.disabled=false;}
  });
}
