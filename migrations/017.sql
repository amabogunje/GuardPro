CREATE TABLE IF NOT EXISTS owner_supervision (
 site_id TEXT PRIMARY KEY REFERENCES sites(id),
 owner_id TEXT NOT NULL REFERENCES users(id),
 enabled_at TEXT NOT NULL
);
