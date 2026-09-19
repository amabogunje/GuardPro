CREATE TABLE IF NOT EXISTS archived_sites(
  site_id TEXT PRIMARY KEY REFERENCES sites(id),
  owner_id TEXT NOT NULL REFERENCES users(id),
  customer_id TEXT NOT NULL REFERENCES customers(id),
  archived_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS archived_sites_owner ON archived_sites(owner_id,archived_at);
