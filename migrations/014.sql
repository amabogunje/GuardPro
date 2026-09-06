CREATE TABLE IF NOT EXISTS incident_classifications (
 incident_id TEXT PRIMARY KEY REFERENCES incidents(id), site_id TEXT NOT NULL REFERENCES sites(id),
 category TEXT NOT NULL CHECK(category IN ('security','maintenance','other')),
 priority TEXT CHECK(priority IN ('P1','P2','P3')),
 actor TEXT NOT NULL REFERENCES users(id), classified_at TEXT NOT NULL,
 CHECK ((category='security' AND priority IS NOT NULL) OR (category<>'security' AND priority IS NULL))
);
