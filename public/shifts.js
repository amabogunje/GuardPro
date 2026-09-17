export function shiftSettings(host,{site,shifts,users,api,esc,icon,done}) {
  let page=0,query='';
  const size=5,guards=users.filter(u=>u.role==='guard'&&!u.disabled);
  function list(focusId) {
    host.innerHTML=`<section class="card checkpoint-panel shifts-panel"><div class="checkpoint-heading"><h2>Shifts <span class="checkpoint-count">(${shifts.length})</span></h2><button type="button" class="checkpoint-text-action" id="add-shift">+ Add</button></div>${shifts.length>size?`<label class="checkpoint-search">Find a shift<input type="search" id="shift-search" placeholder="Search by name" value="${esc(query)}"></label>`:''}<div id="shift-rows"></div></section>`;
    host.querySelector('#add-shift').onclick=()=>editor(null);
    host.querySelector('#shift-search')?.addEventListener('input',e=>{query=e.target.value;page=0;rows();});
    rows();
    if(focusId)[...host.querySelectorAll('[data-edit-shift]')].find(b=>b.dataset.editShift===focusId)?.focus();
  }
  function rows() {
    const found=shifts.filter(s=>s.name.toLowerCase().includes(query.trim().toLowerCase()));
    page=Math.min(page,Math.max(0,Math.ceil(found.length/size)-1));const offset=page*size;
    host.querySelector('#shift-rows').innerHTML=found.length?`${found.slice(offset,offset+size).map(s=>`<button type="button" class="checkpoint-list-row team-row" data-md="true" data-edit-shift="${esc(s.template_id)}" aria-label="Edit ${esc(s.name)}"><span class="checkpoint-symbol">${icon('shifts')}</span><span class="team-row-text"><span class="checkpoint-name">${esc(s.name)}</span><small>${esc(s.start_time)}–${esc(s.end_time)}${s.end_time<=s.start_time?' · next day':''} · ${s.guard_ids.includes('*')?'Any guard':s.guard_ids.length+' assigned'}</small></span><span class="checkpoint-chevron" aria-hidden="true">›</span></button>`).join('')}${found.length>size?`<nav class="inbox-pagination" aria-label="Shift pages"><button type="button" id="shift-prev" ${page===0?'disabled':''}>Previous</button><span>${offset+1}–${Math.min(offset+size,found.length)} of ${found.length}</span><button type="button" id="shift-next" ${offset+size>=found.length?'disabled':''}>Next</button></nav>`:''}`:query?'<p class="checkpoint-empty">No shifts match your search.</p>':'<div class="checkpoint-empty"><strong>Set up your first shift</strong><p>Create a shift before assigning guards, instructions, or patrol times.</p></div>';
    host.querySelectorAll('[data-edit-shift]').forEach(b=>b.onclick=()=>editor(shifts.find(s=>s.template_id===b.dataset.editShift)));
    host.querySelector('#shift-prev')?.addEventListener('click',()=>{page--;rows();});
    host.querySelector('#shift-next')?.addEventListener('click',()=>{page++;rows();});
  }
  function editor(existing) {
    const draft=existing?structuredClone(existing):{template_id:crypto.randomUUID(),name:'',start_time:'06:00',end_time:'18:00',schedule:'',instructions:'',instruction_audio:'',guard_ids:[]};
    host.innerHTML=`<section class="card checkpoint-panel shifts-panel"><div class="checkpoint-heading"><h2>${existing?'Edit shift':'Add shift'}</h2><button type="button" id="shift-cancel" class="checkpoint-text-action">Cancel</button></div><form id="settings-shifts" class="settings-shift"><div class="settings-fields" data-shift="0"><label>Shift name<input name="name" required maxlength="120" placeholder="For example, Day shift" value="${esc(draft.name)}"></label><div class="settings-time-row"><label>Starts<input type="time" name="start_time" required value="${draft.start_time}"></label><label>Ends<input type="time" name="end_time" required value="${draft.end_time}"></label></div><label>Patrol times<input name="schedule" placeholder="0900, 1500, 1800" value="${esc(draft.schedule)}"></label><small>Separate times with commas in the 24-hour format. For example: 0900, 1500, 1800.</small><label>Shift instructions<textarea name="instructions" rows="3" maxlength="5000" placeholder="Instructions for this shift">${esc(draft.instructions)}</textarea></label><div class="shift-voice-instructions"><button id="recordShiftInstructions" type="button" class="primary wide">Press to start</button><small id="shiftInstructionStatus" role="status">${draft.instruction_audio?'Recording saved.':'Tap once to start recording.'}</small><audio id="shiftInstructionPreview" controls hidden aria-label="Shift instruction recording"></audio><button id="removeShiftInstructionAudio" type="button" ${draft.instruction_audio?'':'hidden'}>Remove recording</button></div><fieldset><legend>Assigned guards</legend><label class="settings-check"><input type="checkbox" name="guard" value="*" ${draft.guard_ids.includes('*')?'checked':''}>Any</label>${guards.map(g=>`<label class="settings-check"><input type="checkbox" name="guard" value="${esc(g.id)}" ${draft.guard_ids.includes(g.id)?'checked':''}>${esc(g.name)}</label>`).join('')}</fieldset><button id="save-shifts" class="primary" disabled>${existing?'Save changes':'Add shift'}</button><p class="checkpoint-status" role="status"></p></div></form></section>`;
    const form=host.querySelector('form'),save=host.querySelector('#save-shifts'),status=host.querySelector('#shiftInstructionStatus'),player=host.querySelector('#shiftInstructionPreview'),record=host.querySelector('#recordShiftInstructions'),removeAudio=host.querySelector('#removeShiftInstructionAudio');let busy=false,recorder,stream,chunks=[],blob=null,url=null;
    const preview=b=>{if(url)URL.revokeObjectURL(url);url=URL.createObjectURL(b);player.src=url;player.hidden=false;removeAudio.hidden=false;};
    if(draft.instruction_audio)api('/api/instructions/'+draft.instruction_audio+'/link').then(async({url})=>{if(url){const r=await fetch(url);if(!r.ok)throw Error('Recording unavailable');preview(await r.blob());status.textContent='Current voice instructions loaded.';}}).catch(()=>{status.textContent='Saved recording unavailable. Try again when connected.';});
    const read=()=>({...draft,...Object.fromEntries([...new FormData(form)].filter(([key])=>key!=='guard')),instruction_audio:draft.instruction_audio||'',guard_ids:[...form.querySelectorAll('[name="guard"]:checked')].map(i=>i.value).sort()});
    const baseline=JSON.stringify(read());
    const update=event=>{
      if(event?.target.name==='guard'&&event.target.checked)form.querySelectorAll('[name="guard"]').forEach(input=>{if(input!==event.target&&(input.value==='*'||event.target.value==='*'))input.checked=false;});
      save.disabled=busy||!form.checkValidity()||(existing&&!blob&&JSON.stringify(read())===baseline);
    };
    form.oninput=update;form.onchange=update;
    record.onclick=async()=>{
      if(recorder?.state==='recording'){record.disabled=true;recorder.stop();return;}
      record.disabled=true;save.disabled=true;
      try{
        if(!navigator.mediaDevices?.getUserMedia||!window.MediaRecorder)throw Error('Microphone recording is unavailable. Type instructions instead.');
        stream=await navigator.mediaDevices.getUserMedia({audio:true});
        const mime=['audio/webm;codecs=opus','audio/mp4','audio/webm'].find(m=>MediaRecorder.isTypeSupported(m));
        chunks=[];recorder=new MediaRecorder(stream,mime?{mimeType:mime}:{});
        recorder.ondataavailable=e=>{if(e.data.size)chunks.push(e.data);};
        recorder.onstop=()=>{stream.getTracks().forEach(t=>t.stop());blob=new Blob(chunks,{type:recorder.mimeType});if(!blob.size){blob=null;status.textContent='No audio captured. Please record again.';record.textContent='Press to start';record.disabled=false;record.classList.remove('is-recording');update();return;}draft.instruction_audio='';preview(blob);record.textContent='Press to start';record.disabled=false;record.classList.remove('is-recording');status.textContent='Recording saved. Play it back or save when ready.';update();};
        recorder.start(250);record.textContent='Stop recording';record.classList.add('is-recording');status.textContent='Recording…';setTimeout(()=>{record.disabled=false;},1200);setTimeout(()=>{if(recorder?.state==='recording')recorder.stop();},180000);
      }catch(error){stream?.getTracks().forEach(t=>t.stop());status.textContent=error.message;record.disabled=false;update();}
    };
    removeAudio.onclick=()=>{if(recorder?.state==='recording')return;blob=null;draft.instruction_audio='';player.pause();player.removeAttribute('src');player.hidden=true;removeAudio.hidden=true;status.textContent='Recording removed. Save this shift to keep the change.';update();};
    host.querySelector('#shift-cancel').onclick=()=>{if(url)URL.revokeObjectURL(url);stream?.getTracks().forEach(t=>t.stop());list(existing?.template_id);};
    form.onsubmit=async event=>{
      event.preventDefault();event.stopPropagation();if(save.disabled||busy)return;
      busy=true;save.disabled=true;save.textContent='Saving…';
      try {
        const edited=read();edited.name=edited.name.trim();
        if(blob){const fd=new FormData();fd.set('file',blob,'shift-instructions.'+(blob.type.includes('mp4')?'mp4':'webm'));const uploaded=await api('/api/settings/'+site.id+'/shift-audio',fd);edited.instruction_audio=uploaded.id;}
        const updated=existing?shifts.map(s=>s.template_id===existing.template_id?edited:s):[...shifts,edited];
        await api('/api/settings/'+site.id+'/shifts',{shifts:updated});await done();
      } catch(error){form.querySelector('[role="status"]').textContent=error.message;busy=false;save.textContent=existing?'Save changes':'Add shift';update();}
    };
    form.elements.name.focus();
  }
  list();
}
