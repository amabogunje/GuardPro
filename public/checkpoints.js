let stopWriting = () => {};
export function closeCheckpoints() { stopWriting(); stopWriting = () => {}; }

export function checkpointSettings(host, {site,state,api,esc,icon,done}) {
  const stops = state.checkpoints.filter(c=>c.site_id===site.id && !c.retired_at);
  let page=0,query="",busy=false;
  const pageSize=5;
  const message=text=>{const node=host.querySelector('[role="status"]');if(node)node.textContent=text;};
  async function printLabels(checkpointId) {
    try {
      const labels=await api('/api/qr/'+site.id);
      const rows=checkpointId?labels.filter(c=>c.id===checkpointId):labels;
      if(!rows.length) return message('Add a checkpoint before printing labels.');
      document.querySelector('#qr-print-preview')?.remove();
      const preview=document.createElement('dialog');preview.id='qr-print-preview';
      preview.setAttribute('aria-label','QR label print preview');
      preview.innerHTML=`<div class="qr-preview-toolbar"><h2>QR labels (${rows.length})</h2><div><button type="button" id="qr-print-now" disabled>Print</button><button type="button" id="qr-print-close">Close</button></div><p>Use Print to print these labels or save them as a PDF. If your browser does not open printing, open the app in Chrome or Edge.</p></div><div class="qr-print-sheet">${rows.map(c=>`<article><h2>${esc(c.name)}</h2><p>${esc(site.name)}</p><img src="${c.image}" alt="QR code for ${esc(c.name)}"><code>${esc(c.code)}</code></article>`).join('')}</div>`;
      document.body.append(preview);preview.showModal();
      preview.querySelector('#qr-print-close').onclick=()=>preview.close();
      preview.addEventListener('close',()=>preview.remove(),{once:true});
      preview.querySelector('#qr-print-now').onclick=()=>window.print();
      await Promise.all([...preview.querySelectorAll('img')].map(img=>img.decode()));
      preview.querySelector('#qr-print-now').disabled=false;
    } catch(error) {message(error.message);}
  }
  function list(focusId) {
    closeCheckpoints();
    host.innerHTML=`<section class="card checkpoint-panel"><div class="checkpoint-heading"><h2>Checkpoints <span class="checkpoint-count">(${stops.length})</span></h2><button type="button" class="checkpoint-text-action" id="new-checkpoint">+ Add</button></div>${stops.length?'<div class="checkpoint-tools"><button type="button" class="checkpoint-text-action" id="print-checkpoints">Print all QR labels</button></div>':''}${stops.length>pageSize?`<label class="checkpoint-search">Find a checkpoint<input type="search" id="checkpoint-search" placeholder="Search by name" value="${esc(query)}"></label>`:''}<div id="checkpoint-rows"></div><p class="checkpoint-status" role="status"></p></section>`;
    host.querySelector('#new-checkpoint').onclick=()=>editor(null);
    host.querySelector('#print-checkpoints')?.addEventListener('click',()=>printLabels());
    host.querySelector('#checkpoint-search')?.addEventListener('input',event=>{query=event.target.value;page=0;rows();});
    rows();
    if(focusId) [...host.querySelectorAll('[data-checkpoint]')].find(b=>b.dataset.checkpoint===focusId)?.focus();
  }
  function rows() {
    const filtered=stops.filter(c=>c.name.toLocaleLowerCase().includes(query.trim().toLocaleLowerCase()));
    page=Math.min(page,Math.max(0,Math.ceil(filtered.length/pageSize)-1));
    const offset=page*pageSize;
    host.querySelector('#checkpoint-rows').innerHTML=filtered.length?`<div class="checkpoint-list">${filtered.slice(offset,offset+pageSize).map(c=>`<button type="button" class="checkpoint-list-row" data-md="true" data-checkpoint="${esc(c.id)}" aria-label="Edit ${esc(c.name)}"><span class="checkpoint-symbol">${icon('round')}</span><span class="checkpoint-name">${esc(c.name)}</span><span class="checkpoint-chevron" aria-hidden="true">›</span></button>`).join('')}</div>${filtered.length>pageSize?`<nav class="inbox-pagination" aria-label="Checkpoint pages"><button type="button" id="checkpoint-prev" ${page===0?'disabled':''}>Previous</button><span>${offset+1}–${Math.min(offset+pageSize,filtered.length)} of ${filtered.length}</span><button type="button" id="checkpoint-next" ${offset+pageSize>=filtered.length?'disabled':''}>Next</button></nav>`:''}`:`<p class="checkpoint-empty">${stops.length?'No checkpoints match your search.':'No checkpoints yet. Add the first stop on your patrol route.'}</p>`;
    host.querySelectorAll('[data-checkpoint]').forEach(b=>b.onclick=()=>editor(stops.find(c=>c.id===b.dataset.checkpoint)));
    host.querySelector('#checkpoint-prev')?.addEventListener('click',()=>{page--;rows();host.querySelector('#checkpoint-next')?.focus();});
    host.querySelector('#checkpoint-next')?.addEventListener('click',()=>{page++;rows();host.querySelector('#checkpoint-prev')?.focus();});
  }
  function editor(checkpoint) {
    closeCheckpoints();busy=false;
    host.innerHTML=`<section class="card checkpoint-panel"><div class="checkpoint-heading"><h2>${checkpoint?'Edit checkpoint':'Add checkpoint'}</h2><button type="button" class="checkpoint-text-action" id="checkpoint-back">Cancel</button></div><form id="checkpoint-editor" class="settings-fields"><label>Checkpoint name<input name="name" required maxlength="120" placeholder="For example, back gate" value="${esc(checkpoint?.name||'')}"></label>${checkpoint ? "" : '<small>A unique checkpoint code and QR label will be generated when you save.</small>'}<button class="primary" id="checkpoint-save" disabled>${checkpoint?'Save changes':'Add checkpoint'}</button></form>${checkpoint?`<div class="checkpoint-tag-section"><h3>QR & NFC</h3><div class="checkpoint-qr" aria-live="polite">Loading QR code…</div><p class="checkpoint-code"><span>Checkpoint code</span><code>${esc(checkpoint.code)}</code></p><div class="settings-button-row"><button type="button" id="print-one">Print QR label</button><button type="button" data-nfc="${esc(checkpoint.code)}">Write NFC tag</button></div></div>`:''}<p class="checkpoint-status" role="status"></p></section>`;
    const field=host.querySelector('input[name="name"]'),save=host.querySelector('#checkpoint-save');
    const changed=()=>Boolean(field.value.trim()) && field.value.trim()!==(checkpoint?.name||'');
    field.oninput=()=>{save.disabled=busy||!changed();};
    host.querySelector('#checkpoint-back').onclick=()=>list(checkpoint?.id);
    host.querySelector('form').onsubmit=async event=>{
      event.preventDefault();event.stopPropagation();if(busy||!changed())return;
      busy=true;save.disabled=true;save.textContent='Saving…';
      try {
        const name=field.value.trim();
        if(checkpoint) await api(`/api/settings/${site.id}/checkpoint`,{id:checkpoint.id,name});
        else await api('/api/admin',{kind:'checkpoint',site_id:site.id,name});
        await done();
      } catch(error) {message(error.message);busy=false;save.disabled=!changed();save.textContent=checkpoint?'Save changes':'Add checkpoint';}
    };
    if(checkpoint) {
      const remove=document.createElement('button');remove.type='button';remove.className='checkpoint-delete';remove.textContent='Delete checkpoint';
      host.querySelector('.checkpoint-panel').append(remove);
      remove.onclick=()=>{
        const dialog=document.createElement('dialog');dialog.className='checkpoint-delete-dialog';
        dialog.innerHTML=`<h2>Delete checkpoint?</h2><p>Remove ${esc(checkpoint.name)} from future patrols? Past records and shifts already started will keep this checkpoint.</p><div class="settings-button-row"><button type="button" id="keep-checkpoint">Cancel</button><button type="button" id="confirm-delete-checkpoint">Delete checkpoint</button></div><p role="status"></p>`;
        document.body.append(dialog);dialog.showModal();
        dialog.querySelector('#keep-checkpoint').onclick=()=>dialog.close();
        dialog.addEventListener('close',()=>dialog.remove(),{once:true});
        dialog.querySelector('#confirm-delete-checkpoint').onclick=async event=>{
          event.currentTarget.disabled=true;
          try {await api('/api/settings/'+site.id+'/checkpoint/delete',{id:checkpoint.id});dialog.close();await done();}
          catch(error){dialog.querySelector('[role="status"]').textContent=error.message;event.target.disabled=false;}
        };
      };
      const preview=host.querySelector('.checkpoint-qr');
      const loadQr=()=>api('/api/qr/'+site.id).then(labels=>{
        if(!preview.isConnected)return;
        const label=labels.find(c=>c.id===checkpoint.id);
        if(!label)throw Error('QR code unavailable');
        preview.innerHTML=`<img src="${label.image}" alt="QR code for ${esc(checkpoint.name)}">`;
      }).catch(()=>{if(preview.isConnected){preview.innerHTML='<button type="button">Retry QR code</button>';preview.querySelector('button').onclick=loadQr;}});
      loadQr();
      host.querySelector('#print-one').onclick=()=>printLabels(checkpoint.id);
      host.querySelector('[data-nfc]').onclick=async event=>{
        const button=event.currentTarget;button.disabled=true;
        const controller=new AbortController();stopWriting=()=>controller.abort();
        try {
          if(!('NDEFReader' in window))throw Error('NFC writing is unavailable in this browser. Use a compatible Android phone, or write the checkpoint code to the tag as a text record using a tag-writing app.');
          message('Hold the tag near your phone. Writing replaces the tag’s contents.');
          await new NDEFReader().write({records:[{recordType:'text',data:checkpoint.code}]},{signal:controller.signal});
          if(button.isConnected)message('Checkpoint code written to NFC tag.');
        } catch(error) {if(button.isConnected)message(error.message);}
        finally {button.disabled=false;}
      };
    }
    field.focus();
  }
  list();
}
