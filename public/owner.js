import { healthCards } from './owner-health-view.js';
import { propertyEditor } from './property-location.js';
import { propertyType } from './property-types.js';
import { teamSettings } from './team.js';
import { nextSupervisorSetupTask } from './supervisor-setup.js';

let healthInfoPopover=null,healthInfoTrigger=null;
function closeHealthInfo() {
  healthInfoPopover?.remove();
  if(healthInfoTrigger) {
    healthInfoTrigger.setAttribute('aria-expanded','false');
    healthInfoTrigger.removeAttribute('aria-describedby');
  }
  healthInfoPopover=null;healthInfoTrigger=null;
}
function openHealthInfo(trigger) {
  if(healthInfoTrigger===trigger){closeHealthInfo();return;}
  closeHealthInfo();
  const popover=document.createElement('div');
  popover.className='health-info-popover';popover.id='health-info-popover';popover.setAttribute('role','tooltip');
  popover.textContent=trigger.dataset.healthInfoDescription||'';
  document.body.append(popover);healthInfoPopover=popover;healthInfoTrigger=trigger;
  trigger.setAttribute('aria-expanded','true');trigger.setAttribute('aria-describedby',popover.id);
  const triggerBox=trigger.getBoundingClientRect(),popoverBox=popover.getBoundingClientRect();
  const left=Math.max(16,Math.min(triggerBox.left,window.innerWidth-popoverBox.width-16));
  const below=triggerBox.bottom+8,above=triggerBox.top-popoverBox.height-8;
  popover.style.left=left+'px';popover.style.top=Math.max(16,below+popoverBox.height<=window.innerHeight-16?below:above)+'px';
}
document.addEventListener('pointerdown',event=>{if(healthInfoPopover&&!healthInfoPopover.contains(event.target)&&event.target!==healthInfoTrigger)closeHealthInfo();});
document.addEventListener('keydown',event=>{if(event.key==='Escape'&&healthInfoPopover){const trigger=healthInfoTrigger;closeHealthInfo();trigger?.focus();}});

function ownerPropertyRail({sites,propertyLocations,selectedSiteId,esc}) {
  if(sites.length<2)return '';
  const locationFor=siteId=>[...(propertyLocations||[])].filter(location=>location.site_id===siteId).sort((a,b)=>b.created_at.localeCompare(a.created_at))[0];
  return `<section class="owner-property-rail-section" aria-label="Your properties"><p class="eyebrow">Your properties</p><div class="owner-property-rail" id="ownerPropertyRail" tabindex="0">${sites.map(entry=>{
    const location=locationFor(entry.id),type=propertyType(location?.property_type),selected=entry.id===selectedSiteId;
    return `<button type="button" class="owner-property-rail-card${selected?' selected':''}" data-owner-site="${esc(entry.id)}" aria-pressed="${selected}"><img src="${type.image}" alt="${esc(type.label)}"><span class="owner-property-rail-copy"><small>${esc(type.label)}</small><strong>${esc(entry.name)}</strong><span>${location?.address?esc(location.address):'Location setup pending'}</span></span></button>`;
  }).join('')}</div><p class="owner-property-rail-hint">Swipe to view another property. Tap one to open it.</p></section>`;
}
export function ownerPage(root,{page,site,user,state,api,esc,icon,brand,siteSelect,selectSite,done,navigate,selectedProblemId}) {
  closeHealthInfo();
  const titles={home:`Hello, ${user.name}.`,property:'Property',supervisors:'Staff',subscription:'Subscription',ownerActivity:'Activity evidence',ownerProblems:selectedProblemId?'Problem details':'Reported problems'};
  const propertyRail=page==='home'?ownerPropertyRail({sites:state.sites,propertyLocations:state.propertyLocations,selectedSiteId:site?.id,esc}):'';
  const hasPropertyHero=page==='home'&&Boolean([...(state.propertyLocations||[])].find(location=>location.site_id===site?.id));
  const canSupervise=Boolean(state.ownerSupervision?.some(entry=>entry.site_id===site?.id));
  const menu=`<details class="owner-overflow-menu"><summary aria-label="Open account menu">${icon('menu')}</summary><div class="owner-overflow-actions">${canSupervise?'<button type="button" data-md="true" data-action="ownerMode">Act as supervisor</button>':''}<button type="button" data-md="true" data-action="logout">Sign out</button></div></details>`;
  root.innerHTML=`<main class="guard supervisor-mobile owner-mobile${page==='home'?' owner-home':''}${hasPropertyHero?' owner-home-hero':''}"><header class="topbar">${brand()}${menu}</header>${page==='home'?'':`<div class="duty-identity">${site?`<p class="eyebrow">${esc(site.name)}</p>`:''}<div class="greeting-row"><h1>${esc(titles[page]||'Your property')}</h1><button class="back" data-page="home">Home</button></div></div>`}${propertyRail}${state.sites.length>1&&page!=='home'?siteSelect():''}<div id="ownerContent"></div></main>`;
  root.querySelectorAll('[data-owner-site]').forEach(button=>button.addEventListener('click',()=>{
    if(button.dataset.ownerSite!==site?.id)selectSite?.(button.dataset.ownerSite);
  }));
  const overflowMenu=root.querySelector('.owner-overflow-menu');
  overflowMenu?.querySelector('summary')?.addEventListener('click',event=>{
    event.preventDefault();overflowMenu.open=!overflowMenu.open;
  });
  const host=root.querySelector('#ownerContent');
  const action=(id,glyph,label)=>`<button type="button" data-page="${id}" data-md="true"><span class="action-icon">${icon(glyph)}</span><span class="button-label">${label}</span></button>`;
  const stamp=at=>at?new Date(at).toLocaleString('en-GB',{timeZone:'Africa/Lagos',dateStyle:'medium',timeStyle:'short'}):'No records yet';
  if(page==='home') {
    const ownerActions=`<nav class="actions supervisor-actions settings-tabs owner-actions" aria-label="Owner actions">${action('property','location','Manage<br>Property')}${action('supervisors','person','Add<br>Staff')}${action('subscription','payment','View<br>Subscription')}</nav>`;
    host.innerHTML=`<div id="ownerOverview" aria-live="polite"><p role="status">Loading your property overview…</p></div>`;
    const overview=host.querySelector('#ownerOverview');
    if(!site){overview.innerHTML=ownerActions+'<section class="card owner-first-property"><span class="owner-empty-activity-icon">'+icon('location')+'</span><div><h2>Add your first property</h2><p>Start with its address and map position.</p><button class="primary" data-page="property">Add property</button></div></section>';return;}
    api('/api/owner-overview/'+encodeURIComponent(site.id)).then(d=>{
      if(!overview.isConnected)return;
      const property=d.property&&propertyType(d.property.propertyType);
      const hero=property&&state.sites.length<2?`<section class="owner-property-hero" aria-label="${esc(site.name)}"><img src="${property.image}" alt="${esc(property.label)}"><div class="owner-property-hero-copy"><p>${esc(property.label)}</p><h2>${esc(site.name)}</h2><span>${esc(d.property.address)}</span></div></section>`:'';
      const setupStep=!d.setup.propertyConfigured?{page:'property',title:'Confirm property location',text:'Set the address and map position.',action:'Set location'}:!d.setup.supervisorConfigured?{page:'supervisors',title:'Choose supervision',text:'Add a supervisor or supervise it yourself.',action:'Choose supervision'}:null;
      const ownerSupervises=Boolean(state.ownerSupervision?.some(entry=>entry.site_id===site.id));
      const supervisorTask=ownerSupervises?nextSupervisorSetupTask({windows:(state.shiftPlans||[]).filter(plan=>plan.site_id===site.id),users:state.users||[],checkpoints:(state.checkpoints||[]).filter(checkpoint=>checkpoint.site_id===site.id)}):null;
      if(setupStep){overview.innerHTML=`${hero}${ownerActions}<section class="card owner-setup"><p class="eyebrow">Setup</p><h2>${setupStep.title}</h2><p>${setupStep.text}</p><button class="primary" data-page="${setupStep.page}">${setupStep.action}</button></section>`;return;}
      if(supervisorTask){overview.innerHTML=`${hero}${ownerActions}<section class="card owner-setup owner-supervisor-task"><p class="eyebrow">Supervisor task</p><h2>${supervisorTask.title}</h2><p>${supervisorTask.text}</p><button class="primary" data-action="ownerSupervisorSetup" data-settings-tab="${supervisorTask.tab}">${supervisorTask.action}</button></section>`;return;}
      overview.innerHTML=`${hero}${ownerActions}${healthCards(d.health,{esc,icon})}<p class="last-record-received owner-dashboard-receipt">Last record received: ${esc(stamp(d.freshness.lastRecordReceived))}</p>`;
      overview.querySelectorAll('.health-info-trigger').forEach(trigger=>trigger.addEventListener('click',()=>openHealthInfo(trigger)));
    }).catch(error=>{if(overview.isConnected)overview.innerHTML=`<section class="card"><h2>Overview unavailable</h2><p>${esc(error.message)}</p><p>Current activity cannot be confirmed. Reconnect and refresh to try again.</p></section>`;});
  } else if(page==='ownerActivity') {
    host.innerHTML='<section class="card"><p role="status">Loading activity evidence…</p></section>';
api('/api/owner-evidence/'+encodeURIComponent(site.id)+'?kind=activity').then(d=>{if(!host.isConnected)return;const metric=(title,m,what)=>`<article class="owner-evidence-row"><strong>${title}</strong><span>${m.expected===0?'No measurable activity':`${m.expected-m.missed} of ${m.expected} recorded on time`}</span><small>${what} ${m.late?` · ${m.late} late`:''}${m.missed?` · ${m.missed} not recorded`:''}</small></article>`;const patrol=m=>`<article class="owner-evidence-row"><strong>Scheduled patrol coverage</strong><span>${m.expected===0?'No measurable activity':`${m.completed} of ${m.expected} completed`}</span><small>Completion contributes 70% and on-time starts 30%.${m.late?` · ${m.late} late start${m.late===1?'':'s'}`:''}${m.completionUnknown?` · ${m.completionUnknown} lack checkpoint evidence`:''}</small></article>`;host.innerHTML=`<section class="card owner-evidence"><p class="eyebrow">Historical evidence</p><h2>Activity evidence</h2><p>${esc(d.period.label)}</p>${metric('Guard shift starts',d.metrics.guard,'Based on recorded shift starts.')}${patrol(d.metrics.patrol)}${d.metrics.unknownDays?`<p class="muted">${d.metrics.unknownDays} day${d.metrics.unknownDays===1?'':'s'} had no historical shift schedule, so those days are not scored.</p>`:''}${d.metrics.anyShifts?`<p class="muted">Any-guard shifts record activity but do not assume a required number of guards.</p>`:''}<h3>Recorded timing</h3>${[...d.metrics.guard.rows,...d.metrics.patrol.rows].sort((a,b)=>b.expectedAt.localeCompare(a.expectedAt)).map(r=>`<article class="owner-source-row"><strong>${esc(r.label)} · ${esc(r.guard)}</strong><small>${r.status==='missed'?'No record received':`${r.status==='late'?'Recorded late':'Recorded'}: ${esc(stamp(r.actualAt))}`}</small></article>`).join('')||'<p class="muted">No historical timing records are available.</p>'}<p class="last-record-received">${esc(d.current.message)}<br>Last record received: ${esc(stamp(d.current.lastRecordReceived))}</p></section>`;}).catch(e=>{if(host.isConnected)host.innerHTML=`<section class="card"><h2>Activity evidence unavailable</h2><p>${esc(e.message)}</p></section>`;});
  } else if(page==='ownerProblems'&&!selectedProblemId) {
    host.innerHTML='<section class="card"><p role="status">Loading reported problems…</p></section>';
    api('/api/owner-evidence/'+encodeURIComponent(site.id)+'?kind=problems').then(d=>{if(!host.isConnected)return;const open=d.problems.filter(p=>p.status!=='Resolved'),resolved=d.problems.filter(p=>p.status==='Resolved');const list=(title,rows,empty)=>`<section class="card owner-problem-list"><h2>${title}</h2>${rows.map(p=>`<button class="owner-problem-row" data-page="ownerProblems" data-owner-problem-id="${esc(p.id)}"><span><strong>${esc(p.report||'Voice report')}</strong><small>Reported by ${esc(p.reportedBy)} · ${esc(stamp(p.receivedAt))}</small></span><span aria-hidden="true">›</span></button>`).join('')||`<p class="muted">${empty}</p>`}</section>`;host.innerHTML=`${list('Unresolved problems',open,'No unresolved reported problems.')}${list('Resolved problems',resolved,'No resolved reported problems.')}`;}).catch(e=>{if(host.isConnected)host.innerHTML=`<section class="card"><h2>Reported problems unavailable</h2><p>${esc(e.message)}</p></section>`;});
  } else if(page==='ownerProblems'&&selectedProblemId) {
    host.innerHTML='<section class="card"><p role="status">Loading problem details…</p></section>';
    api('/api/owner-evidence/'+encodeURIComponent(site.id)+'?kind=problems&id='+encodeURIComponent(selectedProblemId)).then(d=>{if(!host.isConnected)return;const p=d.problem,classification=p.classification?`${p.classification.category}${p.classification.priority?' · '+p.classification.priority:''}`:'Not classified';host.innerHTML=`<section class="card owner-problem-detail"><button class="back" data-page="ownerProblems">Reported problems</button><p class="eyebrow">Problem details</p><p class="muted">Received ${esc(stamp(p.receivedAt))}<br>Reported by ${esc(p.reportedBy)}</p><p class="owner-problem-copy">${esc(p.report||'Voice report — listen to the recording.')}</p><p><strong>Status:</strong> ${esc(p.status)}<br><strong>Classification:</strong> ${esc(classification)}</p>${p.media.length?`<div class="owner-media">${p.media.map(m=>`<button data-action="media" data-id="${esc(m.id)}" data-mime="${esc(m.mime)}">${m.mime.startsWith('audio/')?'Play recording':'View photo'}</button>`).join('')}</div>`:'<p class="muted">No supporting media attached.</p>'}${p.resolution?`<section class="owner-resolution"><h2>Resolution details</h2><p>Resolved ${esc(stamp(p.resolution.at))} by ${esc(p.resolution.actor_name)}</p>${p.resolution.note?`<p>${esc(p.resolution.note)}</p>`:''}</section>`:''}<p class="muted">This is read-only evidence. Switch to supervisor view only if you need to manage the problem.</p></section>`;}).catch(e=>{if(host.isConnected)host.innerHTML=`<section class="card"><h2>Problem details unavailable</h2><p>${esc(e.message)}</p></section>`;});
  } else if(page==='property') {
    const reference=[...(state.propertyLocations||[])].filter(p=>p.site_id===site?.id).sort((a,b)=>b.created_at.localeCompare(a.created_at))[0];
    host.innerHTML=`${site?`<section class="card"><h2>${esc(site.name)}</h2><p>${reference?esc(reference.address):'Add the full address and confirm the map position.'}</p>${reference?`<p class="muted">Allowed area: ${reference.radius_m} metres from the confirmed position.</p>`:''}<button id="ownerEditProperty" class="${reference?'':'primary'}">${reference?'Edit property location':'Set property location'}</button></section>`:''}<div id="ownerPropertyEditor"></div>${site?'<button id="ownerAddProperty" class="owner-text-action">+ Add another property</button>':''}`;
    const editor=host.querySelector('#ownerPropertyEditor');
    const open=create=>{propertyEditor(editor,{site:site||{},state,api,esc,done,create});editor.querySelector('textarea')?.focus();};
    host.querySelector('#ownerEditProperty')?.addEventListener('click',()=>open(false));
    host.querySelector('#ownerAddProperty')?.addEventListener('click',()=>open(true));
    if(!site)open(true);
  } else if(page==='supervisors') {
    host.innerHTML='<div id="ownerSupervision"><p role="status">Loading supervision settings…</p></div><div id="ownerStaff"><p role="status">Loading staff…</p></div>';
    const supervision=host.querySelector('#ownerSupervision'),panel=host.querySelector('#ownerStaff');
    if(!site){supervision.innerHTML='<section class="card"><p>Add a property before choosing supervision.</p></section>';panel.innerHTML='';return;}
    Promise.all([api('/api/owner-supervision/'+encodeURIComponent(site.id)),api('/api/settings/'+encodeURIComponent(site.id))]).then(([choice,d])=>{if(!host.isConnected)return;supervision.innerHTML=`<section class="card owner-self"><p class="eyebrow">Your role</p><h2>${choice.enabled?'You supervise this property':'Supervise this property'}</h2><p>${choice.enabled?'Use Act as supervisor at the top of the page when you need to manage shifts, users or reported problems.':'Choose this if you personally supervise guards. You can still add named staff.'}</p><button id="ownerSupervisionToggle" class="primary">${choice.enabled?'Stop supervising':'I supervise this property'}</button></section>`;supervision.querySelector('#ownerSupervisionToggle').onclick=async()=>{await api('/api/owner-supervision/'+encodeURIComponent(site.id),{enabled:!choice.enabled});await done();};teamSettings(panel,{site,users:d.users,reusableUsers:d.reusableUsers,api,esc,icon,done});}).catch(e=>{if(host.isConnected){supervision.innerHTML=`<section class="card"><p>${esc(e.message)}</p></section>`;panel.innerHTML='';}});
  } else if(page==='subscription') {
    host.innerHTML=`<section class="card owner-subscription"><div class="subscription-hero"><span class="subscription-icon">${icon('payment')}</span><span><p class="eyebrow">Current plan</p><h2>Free pilot</h2><small class="subscription-status">Active</small></span></div><div class="subscription-limits"><span><strong>1</strong><small>Property</small></span><span><strong>Up to 5</strong><small>Users</small></span></div><p class="muted">No payment is collected during the pilot.</p></section>`;
  }
}
