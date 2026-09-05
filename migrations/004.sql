CREATE TABLE IF NOT EXISTS site_locations(site_id TEXT PRIMARY KEY REFERENCES sites(id),latitude REAL NOT NULL,longitude REAL NOT NULL,radius_m REAL NOT NULL);
