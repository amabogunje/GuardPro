CREATE TABLE IF NOT EXISTS property_locations (
 id TEXT PRIMARY KEY, site_id TEXT NOT NULL REFERENCES sites(id), address TEXT NOT NULL,
 latitude REAL NOT NULL, longitude REAL NOT NULL, radius_m REAL NOT NULL,
 actor TEXT NOT NULL REFERENCES users(id), created_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS location_reviews (
 id TEXT PRIMARY KEY, site_id TEXT NOT NULL REFERENCES sites(id), guard_id TEXT NOT NULL REFERENCES users(id),
 shift_id TEXT NOT NULL, event_ids TEXT NOT NULL, actor TEXT NOT NULL REFERENCES users(id), at TEXT NOT NULL, comment TEXT NOT NULL
);
