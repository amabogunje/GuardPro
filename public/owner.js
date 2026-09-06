import { healthCards } from './owner-health-view.js';
import { propertyEditor } from './property-location.js';
import { teamSettings } from './team.js';

export function ownerPage(root,{page,site,user,state,api,esc,icon,brand,siteSelect,done,navigate,supervise}) {
  const titles={home:`Hello, ${user.name}.`,property:'Property',supervisors:'Supervisors',subscription:'Subscription'};
  root.innerHTML=`<main class="guard supervisor-mobile owner-mobile"><header class="topbar">${brand()}<button data-action="logout">Sign out</button></header><div class="duty-identity"><p class="eyebrow">${esc(site?.name||'Your property')}</p><div class="greeting-row"><h1>${esc(titles[page]||'Your property')}</h1>${page!=='home'?'<button class="back" data-page="home">Home</button>':''}</div></div>${state.sites.length>1?siteSelect():''}<div id="ownerContent"></div></main>`;
  const host=root.querySelector('#ownerContent');
  const action=(id,glyph,label)=>`<button type="button" data-page="${id}" data-md="true"><span class="action-icon">${icon(glyph)}</span><span class="button-label">${label}</span></button>`;
  const stamp=at=>at?new Date(at).toLocaleString('en-GB',{timeZone:'Africa/Lagos',dateStyle:'medium',timeStyle:'short'}):'No records yet';
  if(page==='home') {
    host.innerHTML=`<nav class="actions supervisor-actions settings-tabs owner-actions" aria-label="Owner actions">${action('property','location','Property')}${action('supervisors','person','Supervisors')}${action('subscription','payment','Subscription')}</nav><div id="ownerOverview" aria-live="polite"><p role="status">Loading your property overview…</p></div>`;
    const overview=host.querySelector('#ownerOverview');
    if(!site){overview.innerHTML='<section class="card"><h2>Welcome to Guard Companion</h2><p>Start by adding your property, then choose who will supervise your guards.</p><button class="primary" data-page="property">Add your property</button></section>';return;}
    api('/api/owner-overview/'+encodeURIComponent(site.id)).then(d=>{
      if(!overview.isConnected)return;
      const incomplete=!d.setup.propertyConfigured||!d.setup.supervisorConfigured;
      overview.innerHTML=`${incomplete?`<section class="card owner-setup"><h2>Finish setting up</h2>${!d.setup.propertyConfigured?'<button class="owner-link-row" data-md="true" data-page="property"><span><strong>Confirm your property location</strong><small>Add its address and map position.</small></span><span aria-hidden="true">›</span></button>':''}${!d.setup.supervisorConfigured?'<button class="owner-link-row" data-md="true" data-page="supervisors"><span><strong>Choose who supervises</strong><small>Add a supervisor or use your owner account.</small></span><span aria-hidden="true">›</span></button>':''}</section>`:''}${healthCards(d.health,{esc,icon})}<p class="last-record-received">Last record received: ${esc(stamp(d.freshness.lastRecordReceived))}</p>`;
    }).catch(error=>{if(overview.isConnected)overview.innerHTML=`<section class="card"><h2>Overview unavailable</h2><p>${esc(error.message)}</p><p>Current activity cannot be confirmed. Reconnect and refresh to try again.</p></section>`;});
  } else if(page==='property') {
    const reference=[...(state.propertyLocations||[])].filter(p=>p.site_id===site?.id).sort((a,b)=>b.created_at.localeCompare(a.created_at))[0];
    host.innerHTML=`${site?`<section class="card"><h2>${esc(site.name)}</h2><p>${reference?esc(reference.address):'Add the full address and confirm the map position.'}</p>${reference?`<p class="muted">Allowed area: ${reference.radius_m} metres from the confirmed position.</p>`:''}<button id="ownerEditProperty" class="${reference?'':'primary'}">${reference?'Edit property location':'Set property location'}</button></section>`:''}<div id="ownerPropertyEditor"></div>${site?'<button id="ownerAddProperty" class="owner-text-action">+ Add another property</button>':''}`;
    const editor=host.querySelector('#ownerPropertyEditor');
    const open=create=>{propertyEditor(editor,{site:site||{},state,api,esc,done,create});editor.querySelector('textarea')?.focus();};
    host.querySelector('#ownerEditProperty')?.addEventListener('click',()=>open(false));
    host.querySelector('#ownerAddProperty')?.addEventListener('click',()=>open(true));
    if(!site)open(true);
  } else if(page==='supervisors') {
    host.innerHTML='<section class="card owner-self"><h2>You can supervise too</h2><p>Use the supervisor view to manage shifts, guards and reported problems with your own account.</p><button id="ownerSupervise" class="primary">Act as supervisor</button></section><div id="ownerSupervisors"><p role="status">Loading supervisors…</p></div>';
    host.querySelector('#ownerSupervise').onclick=supervise;
    const panel=host.querySelector('#ownerSupervisors');
    if(!site){panel.innerHTML='<p>Add a property before assigning supervisors.</p>';return;}
    api('/api/settings/'+encodeURIComponent(site.id)).then(d=>{if(panel.isConnected)teamSettings(panel,{site,users:d.users,api,esc,icon,done,roleOnly:'supervisor'});}).catch(e=>{if(panel.isConnected)panel.textContent=e.message;});
  } else if(page==='subscription') {
    host.innerHTML=`<section class="card owner-subscription"><p class="eyebrow">Guard Companion service</p><h2>Subscription & payments</h2><p>${esc(site?.name||'Your property')}</p><div class="owner-billing-state"><strong>Billing is not enabled for this MVP</strong><p>No subscription, renewal date or payment balance is available in the app yet.</p></div><dl><div><dt>Service model</dt><dd>Setup fee + monthly subscription per property</dd></div><div><dt>Pricing</dt><dd>Not configured</dd></div><div><dt>Payment history</dt><dd>No payment records available</dd></div></dl><p class="muted">Online payment and subscription changes will be available once ISDL has configured its service terms and payment provider.</p></section>`;
  }
}
