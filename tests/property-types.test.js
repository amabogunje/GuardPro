import test from 'node:test';
import assert from 'node:assert/strict';
import {DatabaseSync} from 'node:sqlite';
import {propertyInput} from '../location-checks.js';
import {propertyType,propertyTypes} from '../public/property-types.js';
import {propertyLocationInsertSql} from '../property-location-write.js';

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

test('property-location writes remain correct when property type was added after actor',()=>{
  const database=new DatabaseSync(':memory:');
  database.exec(`
    CREATE TABLE property_locations(
      id TEXT PRIMARY KEY,site_id TEXT,address TEXT,latitude REAL,longitude REAL,radius_m REAL,
      actor TEXT NOT NULL,created_at TEXT NOT NULL,property_type TEXT NOT NULL DEFAULT 'single_family_home'
    )
  `);
  database.prepare(propertyLocationInsertSql).run(
    'location-1','site-1','1 Pilot Road',6.6,3.3,100,'small_business','owner-1','2026-09-19T00:00:00.000Z'
  );
  assert.deepEqual(
    Object.assign({},database.prepare('SELECT property_type,actor,created_at FROM property_locations WHERE id=?').get('location-1')),
    {property_type:'small_business',actor:'owner-1',created_at:'2026-09-19T00:00:00.000Z'}
  );
  database.close();
});
