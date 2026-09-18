import { phoneNumber } from './login-id.js';
export function teamSettings(host,{site,users,reusableUsers=[],api,esc,icon,done,roleOnly=null,allowReuse=false}) {
  const members=users.filter(u=>u.role!=='owner'&&(!roleOnly||u.role===roleOnly));
  const reusable=reusableUsers.filter(u=>!roleOnly||u.role===roleOnly);
  let query='',page=0;
  const size=5;
  function list(focusId) {
    host.innerHTML=`<section class="card checkpoint-panel team-panel"><div class="checkpoint-heading"><h2>Users <span class="checkpoint-count">(${members.length})</span></h2><span class="team-actions"><button type="button" class="checkpoint-text-action" id="add-member">+ Add user</button>${allowReuse?'<button type="button" class="checkpoint-text-action" id="reuse-member">+ Reuse</button>':''}</span></div>${members.length>size?`<label class="checkpoint-search">Find a user<input type="search" id="team-search" placeholder="Name, number or email" value="${esc(query)}"></label>`:''}<div id="team-rows"></div></section>`;
    host.querySelector('#add-member').onclick=()=>edit(null);
    host.querySelector('#reuse-member')?.addEventListener('click',reuse);
    if(roleOnly) {
      host.querySelector('h2').innerHTML=`Supervisors <span class="checkpoint-count">(${members.length})</span>`;
      host.querySelector('#add-member').textContent='+ Add supervisor';
    }
    host.querySelector('#team-search')?.addEventListener('input',e=>{query=e.target.value;page=0;rows();});
    rows();
    if(focusId)[...host.querySelectorAll('[data-member]')].find(b=>b.dataset.member===focusId)?.focus();
  }
  function reuse() {
    host.innerHTML=`<section class="card checkpoint-panel team-panel"><div class="checkpoint-heading"><h2>Reuse existing ${roleOnly?'supervisor':'user'}</h2><button type="button" class="checkpoint-text-action" id="team-cancel">Cancel</button></div>${reusable.length?`<form id="reuse-editor" class="settings-fields"><label>${roleOnly?'Supervisor':'User'}<select name="user_id">${reusable.map(member=>`<option value="${esc(member.id)}">${esc(member.name)} · ${member.role==='guard'?'Guard':'Supervisor'}${member.whatsapp?' · '+esc(member.whatsapp):''}</option>`).join('')}</select></label><p class="muted">This keeps the person’s account and adds access to this property.</p><button class="primary">Add to this property</button><p class="checkpoint-status" role="status"></p></form>`:'<p class="checkpoint-empty">No eligible users from your other properties are available.</p>'}</section>`;
    host.querySelector('#team-cancel').onclick=()=>list();
    host.querySelector('#reuse-editor')?.addEventListener('submit',async event=>{
      event.preventDefault();const form=event.currentTarget,button=form.querySelector('button');button.disabled=true;button.textContent='Adding…';
      try {await api('/api/admin',{kind:'assign',site_id:site.id,user_id:form.elements.user_id.value});await done();}
      catch(error){form.querySelector('[role="status"]').textContent=error.message;button.disabled=false;button.textContent='Add to this property';}
    });
  }
  function rows() {
    const found=members.filter(u=>[u.name,u.email,u.whatsapp].join(' ').toLowerCase().includes(query.trim().toLowerCase()));
    page=Math.min(page,Math.max(0,Math.ceil(found.length/size)-1));
    const offset=page*size;
    host.querySelector('#team-rows').innerHTML=found.length?`${found.slice(offset,offset+size).map(u=>`<button type="button" class="checkpoint-list-row team-row" data-md="true" data-member="${esc(u.id)}" aria-label="Edit ${esc(u.name)}"><span class="team-avatar">${icon('person')}${u.photo_id?`<img src="/media/profile/${encodeURIComponent(u.id)}" alt="">`:''}</span><span class="team-row-text"><span class="checkpoint-name">${esc(u.name)}</span><small>${u.role==='guard'?'Guard':'Supervisor'}${u.disabled?' · Inactive':''}${u.whatsapp||u.email?' · '+esc(u.whatsapp||u.email):''}</small></span><span class="checkpoint-chevron" aria-hidden="true">›</span></button>`).join('')}${found.length>size?`<nav class="inbox-pagination" aria-label="Team pages"><button type="button" id="team-prev" ${page===0?'disabled':''}>Previous</button><span>${offset+1}–${Math.min(offset+size,found.length)} of ${found.length}</span><button type="button" id="team-next" ${offset+size>=found.length?'disabled':''}>Next</button></nav>`:''}`:`<p class="checkpoint-empty">${members.length?'No team members match your search.':'No team members yet. Add a guard or supervisor.'}</p>`;
    host.querySelectorAll('[data-member]').forEach(b=>b.onclick=()=>edit(members.find(u=>u.id===b.dataset.member)));
    host.querySelectorAll('.team-avatar img').forEach(img=>img.onerror=()=>img.remove());
    host.querySelector('#team-prev')?.addEventListener('click',()=>{page--;rows();});
    host.querySelector('#team-next')?.addEventListener('click',()=>{page++;rows();});
  }
  function edit(member) {
    host.innerHTML=`<section class="card checkpoint-panel team-panel"><div class="checkpoint-heading"><h2>${member?'Edit user':'Add user'}</h2><button type="button" class="checkpoint-text-action" id="team-cancel">Cancel</button></div><form id="team-editor" class="settings-fields"><label>Name *<input name="name" required maxlength="120" value="${esc(member?.name||'')}"></label><label>Role *<select name="role" required><option value="guard">Guard</option><option value="supervisor" ${member?.role==='supervisor'?'selected':''}>Supervisor</option></select></label><label>WhatsApp number *<input name="whatsapp" type="tel" required autocomplete="tel" placeholder="0801 234 5678" value="${esc(member?.whatsapp||'')}"></label><label>Email (optional)<input name="email" type="email" maxlength="200" autocomplete="email" value="${esc(member?.email||'')}"></label><fieldset class="password-reset"><legend>${member?'Reset sign-in password':'Password *'}</legend><label>${member?'New temporary password (optional)':'Password *'}<input name="password" type="password" minlength="12" ${member?'':'required'} autocomplete="new-password"></label><small>${member?'Enter a new temporary password only when the user needs help signing in. Give it to them through your normal verified process.':'Use at least 12 characters.'}</small></fieldset><label>Profile photo (optional)<input type="file" name="profile_photo" accept="image/jpeg,image/png"></label><small>JPEG or PNG, up to 2 MB.</small>${member?`<label>Status<select name="disabled"><option value="false">Active</option><option value="true" ${member.disabled?'selected':''}>Inactive</option></select></label><small>Inactive members cannot sign in. Their past records are kept.</small>`:''}<button class="primary" id="team-save" disabled>${member?'Save changes':'Create user'}</button>${member&&allowReuse?'<button type="button" class="team-remove" id="team-unassign">Remove from this property</button>':''}<p class="checkpoint-status" role="status"></p></form></section>`;
    const form=host.querySelector('form'),save=host.querySelector('#team-save');
    if(roleOnly) {
      host.querySelector('h2').textContent=member?'Edit supervisor':'Add supervisor';
      form.elements.role.value=roleOnly;
      form.elements.role.closest('label').hidden=true;
      if(!member)save.textContent='Create supervisor';
    }
    const snapshot=()=>JSON.stringify([...new FormData(form)].filter(([key])=>key!=='profile_photo'));
    const baseline=snapshot();let busy=false;
    const update=()=>{
      const phone=form.elements.whatsapp.value.trim(),password=form.elements.password.value;
      const status=form.querySelector('[role="status"]');
      form.elements.whatsapp.setCustomValidity(phone&&!phoneNumber(phone)?'Enter a valid WhatsApp number':!phone?'Enter a WhatsApp number':'');
      if(!member) status.textContent=!phone?'Enter the required fields.':!phoneNumber(phone)?'Enter a valid WhatsApp number.':!password?'Enter a password of at least 12 characters.':password.length<12?'Password must be at least 12 characters.':'';
      if(member) save.textContent=password ? 'Save new password' : 'Save changes';
      save.disabled=busy||!form.checkValidity()|| (snapshot()===baseline&&!form.elements.profile_photo.files.length);
    };
    form.oninput=update;form.onchange=update;
    host.querySelector('#team-cancel').onclick=()=>list(member?.id);
    const remove=host.querySelector('#team-unassign');
    if(remove) remove.onclick=async()=>{
      if(remove.dataset.confirm!=='true'){remove.dataset.confirm='true';remove.textContent='Confirm removal from this property';return;}
      remove.disabled=true;
      try {await api('/api/admin',{kind:'unassign',site_id:site.id,user_id:member.id});await done();}
      catch(error){form.querySelector('[role="status"]').textContent=error.message;remove.disabled=false;remove.dataset.confirm='';remove.textContent='Remove from this property';}
    };
    form.onsubmit=async event=>{
      event.preventDefault();event.stopPropagation();if(busy||save.disabled)return;
      busy=true;save.disabled=true;save.textContent='Saving…';
      try {
        const body=new FormData(form);body.set('site_id',site.id);body.set('kind',member?'update_user':'user');
        if(member)body.set('user_id',member.id);
        if(!body.get('profile_photo')?.size)body.delete('profile_photo');
        await api('/api/admin',body);
        await done();
      } catch(error) {form.querySelector('[role="status"]').textContent=error.message;busy=false;save.textContent=member?'Save changes':'Create user';update();}
    };
    form.elements.name.focus();
  }
  list();
}
