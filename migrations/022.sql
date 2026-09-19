ALTER TABLE property_locations ADD COLUMN IF NOT EXISTS property_type TEXT NOT NULL DEFAULT 'single_family_home';
