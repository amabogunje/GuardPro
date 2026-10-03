export function positionPreview(host,form) {
  const {latitude,longitude,radius_m}=form.elements;
  const lat=Number(latitude.value),lon=Number(longitude.value),radius=Number(radius_m.value);
  if(!latitude.value.trim()||!longitude.value.trim()||!Number.isFinite(lat)||!Number.isFinite(lon)||Math.abs(lat)>90||Math.abs(lon)>180) {
    host.textContent='Use your position while at the property to preview the property.';return;
  }
  const extent=Math.max(.002,Math.min(5000,radius||100)/70000);
  host.innerHTML=`<iframe title="Confirm property position on OpenStreetMap" loading="lazy" referrerpolicy="no-referrer" src="https://www.openstreetmap.org/export/embed.html?bbox=${lon-extent},${lat-extent},${lon+extent},${lat+extent}&layer=mapnik&marker=${lat},${lon}"></iframe><small>Marker: ${lat}, ${lon}. Allowed radius: ${radius} metres.</small>`;
}

