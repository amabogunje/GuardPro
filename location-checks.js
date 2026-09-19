import {defaultPropertyType,propertyType} from './public/property-types.js';

export function assessLocation(location,reference) {
  const assessment={status:'unconfirmed',reason:'Location unavailable',reference:reference||null};
  if(!reference){assessment.reason='Owner has not confirmed the property location';return assessment;}
  if(!location)return assessment;
  const rad=v=>v*Math.PI/180;
  const a=Math.sin(rad(location.latitude-reference.latitude)/2)**2+Math.cos(rad(reference.latitude))*Math.cos(rad(location.latitude))*Math.sin(rad(location.longitude-reference.longitude)/2)**2;
  assessment.distance_m=Math.round(6371000*2*Math.atan2(Math.sqrt(Math.min(1,a)),Math.sqrt(Math.max(0,1-a))));
  assessment.accuracy_m=location.accuracy;
  if(location.accuracy>100){assessment.reason='GPS accuracy is too low';return assessment;}
  if(assessment.distance_m>reference.radius_m+location.accuracy){assessment.status='outside';assessment.reason='Location outside property area';}
  else {assessment.status='within';assessment.reason='Within the property area allowing for GPS accuracy';}
  return assessment;
}
export function propertyInput(body) {
  const address=String(body.address||'').trim(),latitude=Number(body.latitude),longitude=Number(body.longitude),radius_m=Number(body.radius_m),property_type=String(body.property_type||defaultPropertyType);
  if(address.length<8||address.length>500||!String(body.latitude??'').trim()||!String(body.longitude??'').trim()||!Number.isFinite(latitude)||Math.abs(latitude)>90||!Number.isFinite(longitude)||Math.abs(longitude)>180||!Number.isFinite(radius_m)||radius_m<20||radius_m>5000||![true,'true','on'].includes(body.confirmed))throw Error('Enter the full address, valid coordinates and a radius of 20–5000 metres, then confirm the map position.');
  if(propertyType(property_type).id!==property_type)throw Error('Choose a property type.');
  return {address,latitude,longitude,radius_m,property_type};
}
