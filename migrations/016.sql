CREATE TABLE IF NOT EXISTS incident_evidence (
 incident_id TEXT PRIMARY KEY REFERENCES incidents(id),
 expected_audio INTEGER NOT NULL DEFAULT 0,
 expected_photos INTEGER NOT NULL DEFAULT 0,
 created_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS shift_exceptions (
 id TEXT PRIMARY KEY, shift_id TEXT NOT NULL REFERENCES shifts(id), site_id TEXT NOT NULL REFERENCES sites(id),
 actor TEXT NOT NULL REFERENCES users(id), at TEXT NOT NULL, reason TEXT NOT NULL
);
