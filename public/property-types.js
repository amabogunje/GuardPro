export const propertyTypes = [
  {id:'single_family_home',label:'Single-family home',image:'/property-heroes/single-family-home.png'},
  {id:'multi_use_property',label:'Multi-use property',image:'/property-heroes/multi-use-property.png'},
  {id:'small_business',label:'Small business',image:'/property-heroes/small-business.png'},
];

export const defaultPropertyType=propertyTypes[0].id;

export function propertyType(value) {
  if(value==='primary_school') return propertyTypes[2];
  return propertyTypes.find(type=>type.id===value)||propertyTypes[0];
}
