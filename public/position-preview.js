import * as L from './vendor/leaflet/leaflet.js';

const editors=new WeakMap();
export function positionPreview(host,form) {
  let editor=editors.get(host);
  if(!editor) {
    host.innerHTML='<p class="field-help">Drag the pin or tap the map to set the property location. Pan and zoom to find the exact spot.</p><div class="property-map-canvas" aria-label="Property location map"></div><button type="button" class="map-centre-pin">Place pin at map centre</button><small class="map-position-status" role="status"></small>';
    const canvas=host.querySelector('.property-map-canvas');
    const map=L.map(canvas,{scrollWheelZoom:false,worldCopyJump:true}).setView([9.082,8.6753],6);
    const cleanup=new MutationObserver(()=>{if(!host.isConnected){map.remove();cleanup.disconnect();editors.delete(host);}});
    cleanup.observe(document.body,{childList:true,subtree:true});
    const message=host.querySelector('.map-position-status');
    const tiles=L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png',{maxZoom:19,referrerPolicy:'origin',attribution:'&copy; <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener">OpenStreetMap contributors</a>'}).addTo(map);
    editor={map,message,marker:null,circle:null,placing:false};editors.set(host,editor);
    tiles.on('tileerror',()=>{message.textContent='Map images could not load. Your coordinates are retained; check your connection before confirming.';});
    const place=point=>{
      const wrapped=point.wrap();
      if(Math.abs(wrapped.lat)>85.05112878)return;
      editor.placing=true;
      form.elements.latitude.value=wrapped.lat.toFixed(7);
      form.elements.longitude.value=wrapped.lng.toFixed(7);
      form.elements.confirmed.checked=false;
      // Existing form handlers capture drafts and cancel any outstanding GPS result.
      form.elements.latitude.dispatchEvent(new Event('input',{bubbles:true}));
      form.elements.longitude.dispatchEvent(new Event('input',{bubbles:true}));
      positionPreview(host,form);
      editor.placing=false;
    };
    editor.place=place;
    map.on('click',event=>place(event.latlng));
    host.querySelector('.map-centre-pin').onclick=()=>place(map.getCenter());
    requestAnimationFrame(()=>{if(host.isConnected)map.invalidateSize();});
  }
  const {latitude,longitude,radius_m}=form.elements;
  const lat=Number(latitude.value),lon=Number(longitude.value),radius=Number(radius_m.value);
  if(!latitude.value.trim()||!longitude.value.trim()||!Number.isFinite(lat)||!Number.isFinite(lon)||Math.abs(lat)>90||Math.abs(lon)>180) {
    if(editor.marker){editor.map.removeLayer(editor.marker);editor.map.removeLayer(editor.circle);editor.marker=editor.circle=null;}
    editor.message.textContent='Use my position or choose a location on the map. No position is selected yet.';
    return;
  }
  const point=L.latLng(lat,lon),prior=editor.marker?.getLatLng();
  if(!editor.marker){
    const icon=L.divIcon({className:'property-map-pin',html:'<span aria-hidden="true">📍</span>',iconSize:[36,44],iconAnchor:[18,42]});
    editor.marker=L.marker(point,{draggable:true,autoPan:true,icon,title:'Property location pin — drag to adjust',alt:'Property location pin'}).addTo(editor.map);
    editor.marker.on('dragend',()=>editor.place(editor.marker.getLatLng()));
    editor.circle=L.circle(point,{radius:100,interactive:false,color:'#087f68',fillOpacity:0.12}).addTo(editor.map);
  }else editor.marker.setLatLng(point);
  editor.circle.setLatLng(point).setRadius(Number.isFinite(radius)?Math.max(20,Math.min(5000,radius)):100);
  if(!editor.placing&&(!prior||!prior.equals(point)))editor.map.setView(point,prior?editor.map.getZoom():17,{animate:false});
  editor.message.textContent=`Selected position: ${lat}, ${lon}. Check the pin and confirm before saving.`;
}
