export const propertyTypes = [
  {id:'single_family_home',label:'Single-family home',image:'/property-heroes/single-family-home.png'},
  {id:'multi_use_property',label:'Multi-use property',image:'/property-heroes/multi-use-property.png'},
  {id:'primary_school',label:'Primary school',image:'/property-heroes/primary-school.png'},
];

export const defaultPropertyType=propertyTypes[0].id;

export function propertyType(value) {
  if(value==='small_business') return propertyTypes[2];
  return propertyTypes.find(type=>type.id===value)||propertyTypes[0];
}
