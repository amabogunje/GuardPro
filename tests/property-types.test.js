import test from 'node:test';
import assert from 'node:assert/strict';
import {propertyInput} from '../location-checks.js';
import {propertyType,propertyTypes} from '../public/property-types.js';

const location={address:'1 Example Road, Ikeja, Lagos',latitude:'6.601',longitude:'3.351',radius_m:'100',confirmed:true};

test('property types have fixed local dashboard images and default safely for legacy properties',()=>{
  assert.deepEqual(propertyTypes.map(type=>type.id),['single_family_home','multi_use_property','small_business']);
  for(const type of propertyTypes) assert.match(type.image,/^\/property-heroes\/.+\.png$/);
  assert.equal(propertyType('primary_school').id,'small_business');
  assert.equal(propertyType('unknown').id,'single_family_home');
});

test('property setup accepts only the three supported property types',()=>{
  assert.equal(propertyInput(location).property_type,'single_family_home');
  assert.equal(propertyInput({...location,property_type:'small_business'}).property_type,'small_business');
  assert.throws(()=>propertyInput({...location,property_type:'warehouse'}),/Choose a property type/);
});
