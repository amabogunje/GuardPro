-- Property locations record the authenticated owner who confirmed the address.
-- Recreate the constraint so each tenant schema references its own users table.
ALTER TABLE property_locations DROP CONSTRAINT IF EXISTS property_locations_actor_fkey;
ALTER TABLE property_locations ADD CONSTRAINT property_locations_actor_fkey
  FOREIGN KEY (actor) REFERENCES users(id);
