
CREATE TABLE IF NOT EXISTS customers(id TEXT PRIMARY KEY,name TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS users(id TEXT PRIMARY KEY,name TEXT NOT NULL,email TEXT UNIQUE NOT NULL,password TEXT NOT NULL,role TEXT NOT NULL CHECK(role IN ('guard','owner','supervisor')));
CREATE TABLE IF NOT EXISTS sites(id TEXT PRIMARY KEY,customer_id TEXT NOT NULL REFERENCES customers(id),name TEXT NOT NULL,instructions TEXT NOT NULL DEFAULT '',phone TEXT NOT NULL DEFAULT '',schedule TEXT NOT NULL DEFAULT '09:00,15:00',last_sync TEXT);
CREATE TABLE IF NOT EXISTS assignments(user_id TEXT REFERENCES users(id),site_id TEXT REFERENCES sites(id),PRIMARY KEY(user_id,site_id));
CREATE TABLE IF NOT EXISTS checkpoints(id TEXT PRIMARY KEY,site_id TEXT REFERENCES sites(id),name TEXT NOT NULL,code TEXT UNIQUE NOT NULL);
CREATE TABLE IF NOT EXISTS sessions(token TEXT PRIMARY KEY,user_id TEXT REFERENCES users(id),expires BIGINT);
CREATE TABLE IF NOT EXISTS events(id TEXT PRIMARY KEY,site_id TEXT REFERENCES sites(id),user_id TEXT REFERENCES users(id),kind TEXT NOT NULL,captured_at TEXT NOT NULL,received_at TEXT NOT NULL,payload TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS shifts(id TEXT PRIMARY KEY,site_id TEXT REFERENCES sites(id),user_id TEXT REFERENCES users(id),started_at TEXT,ended_at TEXT);
CREATE UNIQUE INDEX IF NOT EXISTS one_shift ON shifts(user_id) WHERE ended_at IS NULL;
CREATE TABLE IF NOT EXISTS incidents(id TEXT PRIMARY KEY,site_id TEXT REFERENCES sites(id),user_id TEXT REFERENCES users(id),captured_at TEXT,received_at TEXT,event_time TEXT,report TEXT,transcript TEXT,status TEXT DEFAULT 'Reported',responsible TEXT DEFAULT '',next_action TEXT DEFAULT '');
CREATE TABLE IF NOT EXISTS revisions(id TEXT PRIMARY KEY,incident_id TEXT REFERENCES incidents(id),actor TEXT REFERENCES users(id),at TEXT,content TEXT);
CREATE TABLE IF NOT EXISTS transitions(id TEXT PRIMARY KEY,incident_id TEXT REFERENCES incidents(id),actor TEXT REFERENCES users(id),at TEXT,status TEXT,note TEXT);
CREATE TABLE IF NOT EXISTS media(id TEXT PRIMARY KEY,incident_id TEXT REFERENCES incidents(id),user_id TEXT REFERENCES users(id),mime TEXT,path TEXT,size INTEGER,source TEXT);
CREATE TABLE IF NOT EXISTS notifications(id TEXT PRIMARY KEY,site_id TEXT REFERENCES sites(id),event_id TEXT,recipient TEXT REFERENCES users(id),status TEXT DEFAULT 'submitted',attempts INTEGER DEFAULT 0,delivered_at TEXT,acknowledged_at TEXT);
CREATE TABLE IF NOT EXISTS summaries(id TEXT PRIMARY KEY,site_id TEXT REFERENCES sites(id),day TEXT,counts TEXT,narrative TEXT,status TEXT,actor TEXT,at TEXT);
CREATE TABLE IF NOT EXISTS audit(id TEXT PRIMARY KEY,actor TEXT,at TEXT,action TEXT,detail TEXT);

CREATE TABLE IF NOT EXISTS shift_plans(id TEXT PRIMARY KEY,site_id TEXT REFERENCES sites(id),guard_id TEXT REFERENCES users(id),start_time TEXT NOT NULL,end_time TEXT NOT NULL,created_by TEXT REFERENCES users(id),created_at TEXT NOT NULL);

CREATE TABLE IF NOT EXISTS site_locations(site_id TEXT PRIMARY KEY REFERENCES sites(id),latitude REAL NOT NULL,longitude REAL NOT NULL,radius_m REAL NOT NULL);

CREATE TABLE IF NOT EXISTS instruction_versions(id TEXT PRIMARY KEY, site_id TEXT NOT NULL REFERENCES sites(id), actor TEXT NOT NULL REFERENCES users(id), created_at TEXT NOT NULL, content TEXT NOT NULL, mime TEXT, path TEXT, size INTEGER NOT NULL DEFAULT 0);
CREATE INDEX IF NOT EXISTS instruction_site ON instruction_versions(site_id,created_at);

CREATE TABLE IF NOT EXISTS message_media(id TEXT PRIMARY KEY,event_id TEXT NOT NULL REFERENCES events(id),user_id TEXT NOT NULL REFERENCES users(id),mime TEXT NOT NULL,path TEXT NOT NULL,size INTEGER NOT NULL,source TEXT);

CREATE TABLE IF NOT EXISTS message_context(event_id TEXT PRIMARY KEY REFERENCES events(id),guard_id TEXT NOT NULL REFERENCES users(id),shift_id TEXT REFERENCES shifts(id));
CREATE INDEX IF NOT EXISTS message_context_thread ON message_context(guard_id,shift_id);

ALTER TABLE message_context ALTER COLUMN shift_id SET NOT NULL;
CREATE TABLE IF NOT EXISTS rate_limits(key TEXT PRIMARY KEY, n INTEGER NOT NULL, reset_at BIGINT NOT NULL);
