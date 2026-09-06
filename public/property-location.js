export function propertyEditor(host,{site,state,api,esc,done,create=false}) {
  const reference=create?null:[...(state.propertyLocations||[])].filter(p=>p.site_id===site.id).sort((a,b)=>b.created_at.localeCompare(a.created_at))[0];
  host.innerHTML=`<section class="card property-editor"><h2>${create?'Add property':'Property address & location'}</h2><form>${create?'<label>Property name<input name="name" required maxlength="120"></label>':''}<label>Full address<textarea name="address" required minlength="8" maxlength="500">${esc(reference?.address||'')}</textarea></label><a id="property-find" target="_blank" rel="noopener noreferrer">Find address on OpenStreetMap</a><small>Confirm the property on the map, then enter its coordinates. Map lookup opens OpenStreetMap with this address.</small><div class="settings-time-row"><label>Latitude<input name="latitude" type="number" required step="any" min="-90" max="90" value="${reference?.latitude??''}"></label><label>Longitude<input name="longitude" type="number" required step="any" min="-180" max="180" value="${reference?.longitude??''}"></label></div><button type="button" id="property-here">Use my position</button><small>Use this only when you are at the property.</small><label>Allowed radius (metres)<input name="radius_m" type="number" required min="20" max="5000" value="${reference?.radius_m??100}"></label><div id="property-map"></div><label class="property-confirm"><input name="confirmed" type="checkbox" required value="true">I confirm the address, map position and allowed area.</label><button class="primary">${create?'Create property':'Save property location'}</button><p role="status"></p></form></section>`;
  const form=host.querySelector('form'),map=host.querySelector('#property-map'),status=form.querySelector('[role="status"]');
  const update=()=>{
    form.elements.confirmed.checked=false;
    host.querySelector('#property-find').href='https://www.openstreetmap.org/search?query='+encodeURIComponent(form.elements.address.value);
    const lat=Number(form.elements.latitude.value),lon=Number(form.elements.longitude.value),radius=Number(form.elements.radius_m.value);
    if(form.elements.latitude.value&&form.elements.longitude.value&&Math.abs(lat)<=90&&Math.abs(lon)<=180){
      const extent=Math.max(.002,Math.min(5000,radius||100)/70000);
      map.innerHTML=`<iframe title="Confirm property position on OpenStreetMap" loading="lazy" referrerpolicy="no-referrer" src="https://www.openstreetmap.org/export/embed.html?bbox=${lon-extent},${lat-extent},${lon+extent},${lat+extent}&layer=mapnik&marker=${lat},${lon}"></iframe><small>Marker: ${lat}, ${lon}. Allowed radius: ${radius} metres.</small>`;
    } else map.textContent='Enter coordinates to preview the property position.';
  };
  for(const name of ['address','latitude','longitude','radius_m'])form.elements[name].addEventListener('change',update);
  const locate=host.querySelector('#property-here');
  const locationStatus=document.createElement('p');
  locationStatus.setAttribute('role','status');
  locate.after(locationStatus);
  locate.onclick=async()=>{
    if(!navigator.geolocation){locationStatus.textContent='Location is unavailable in this browser. Enter coordinates from the map.';return;}
    locate.disabled=true;locate.textContent='Finding your position…';
    locationStatus.textContent='Waiting for your device’s location. Allow location access if asked.';
    const position=high=>new Promise((resolve,reject)=>{
      const timer=setTimeout(()=>reject({code:3}),12000);
      navigator.geolocation.getCurrentPosition(p=>{clearTimeout(timer);resolve(p);},e=>{clearTimeout(timer);reject(e);},{timeout:10000,maximumAge:0,enableHighAccuracy:high});
    });
    try{
      let p;
      try{p=await position(true);}catch(error){
        if(error.code===1)throw error;
        locationStatus.textContent='Precise location unavailable. Trying your device’s approximate position…';
        p=await position(false);
      }
      form.elements.latitude.value=p.coords.latitude;
      form.elements.longitude.value=p.coords.longitude;
      update();
      locationStatus.textContent=`Coordinates updated (accuracy approximately ${Math.round(p.coords.accuracy)} metres). Check the map and enter the full street address above; your device does not supply a street address.`;
    }catch(error){
      locationStatus.textContent=error.code===1?'Location access was denied. Enable location access in your browser and device settings, then try again, or enter coordinates from the map.':error.code===3?'Your device did not return a location in time. Try again in Chrome or Edge, or enter coordinates from the map.':'Your device could not determine its location, even with permission. Try Chrome or Edge with device location enabled, or enter coordinates from the map.';
    }finally{locate.disabled=false;locate.textContent='Use my position';}
  };
  form.onsubmit=async e=>{
    e.preventDefault();e.stopPropagation();e.submitter.disabled=true;
    try{await api(create?'/api/admin':'/api/site-location',{...Object.fromEntries(new FormData(form)),site_id:site.id,...(create?{kind:'additional_site'}:{})});await done();}
    catch(error){status.textContent=error.message;e.submitter.disabled=false;}
  };
  update();
}
