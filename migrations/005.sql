CREATE TABLE IF NOT EXISTS instruction_versions(id TEXT PRIMARY KEY, site_id TEXT NOT NULL REFERENCES sites(id), actor TEXT NOT NULL REFERENCES users(id), created_at TEXT NOT NULL, content TEXT NOT NULL, mime TEXT, path TEXT, size INTEGER NOT NULL DEFAULT 0);
CREATE INDEX IF NOT EXISTS instruction_site ON instruction_versions(site_id,created_at);
