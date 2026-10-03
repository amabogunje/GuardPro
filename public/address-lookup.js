export const geocodingAttribution='<small class="geocoding-attribution">Powered by <a href="https://www.geoapify.com/" target="_blank" rel="noopener">Geoapify</a> · <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener">© OpenStreetMap contributors</a></small>';

export function positionPreview(host,form) {
  const {latitude,longitude,radius_m}=form.elements;
  const lat=Number(latitude.value),lon=Number(longitude.value),radius=Number(radius_m.value);
  if(!latitude.value.trim()||!longitude.value.trim()||!Number.isFinite(lat)||!Number.isFinite(lon)||Math.abs(lat)>90||Math.abs(lon)>180) {
    host.textContent='Find an address or use your current position to preview the property.';return;
  }
  const extent=Math.max(.002,Math.min(5000,radius||100)/70000);
  host.innerHTML=`<iframe title="Confirm property position on OpenStreetMap" loading="lazy" referrerpolicy="no-referrer" src="https://www.openstreetmap.org/export/embed.html?bbox=${lon-extent},${lat-extent},${lon+extent},${lat+extent}&layer=mapnik&marker=${lat},${lon}"></iframe><small>Marker: ${lat}, ${lon}. Allowed radius: ${radius} metres.</small>`;
}

export function addressLookup(form,{api,endpoint='/api/geocode',changed=()=>{}}) {
  const address=form.elements.address;
  const host=document.createElement('div');host.className='address-lookup';
  host.innerHTML=`<button type="button" class="address-find">Find address</button><p class="field-help">Include the city and country. Your search is sent to Geoapify to find the location.</p><p class="address-status" role="status" aria-live="polite"></p><div class="address-results"></div>${geocodingAttribution}`;
  address.closest('label')?address.closest('label').after(host):address.after(host);
  const button=host.querySelector('button'),status=host.querySelector('[role="status"]'),results=host.querySelector('.address-results');
  let version=0;
  const invalidate=(message='')=>{version++;results.replaceChildren();status.textContent=message;button.disabled=false;button.textContent='Find address';return version;};
  for(const name of ['address','latitude','longitude'])form.elements[name].addEventListener('input',()=>{invalidate();form.elements.confirmed.checked=false;changed();});
  button.onclick=async()=>{
    const query=address.value.trim();
    invalidate();
    if(query.length<8){status.textContent='Enter the street address, city and country first.';address.focus();return;}
    const requestVersion=version;
    form.elements.confirmed.checked=false;changed();
    button.disabled=true;button.textContent='Finding address…';status.textContent='Looking for matching addresses…';
    try {
      const response=await api(endpoint,{address:query});
      if(requestVersion!==version||query!==address.value.trim()||!form.isConnected)return;
      const matches=response.results||[];
      const select=match=>{
        if(requestVersion!==version||query!==address.value.trim())return;
        // Preserve the user's full address (including unit/gate details).
        form.elements.latitude.value=String(match.latitude);form.elements.longitude.value=String(match.longitude);
        form.elements.confirmed.checked=false;
        results.replaceChildren();changed();
        status.textContent=`${match.approximate?'Approximate location':'Location found'}: ${match.address}. ${match.approximate?'This may identify a street or area rather than the exact property. ':''}Check the map before confirming.`;
      };
      if(!matches.length){status.textContent='No matching address found. Add the area, city and country, or use your current position while at the property.';return;}
      if(matches.length===1&&!matches[0].approximate){select(matches[0]);return;}
      status.textContent='Choose the matching address, then check its position on the map.';
      for(const match of matches){
        const choice=document.createElement('button');choice.type='button';choice.className='address-match';
        choice.textContent=match.address+(match.approximate?' — approximate location':'');
        choice.onclick=()=>select(match);results.append(choice);
      }
    }catch(error){if(requestVersion===version&&form.isConnected)status.textContent=error.message||'Address search failed. Try again.';}
    finally{if(requestVersion===version){button.disabled=false;button.textContent='Find address';}}
  };
  return {invalidate,current:token=>token===version};
}
