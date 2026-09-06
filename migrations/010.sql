CREATE TABLE IF NOT EXISTS shift_templates (
 id TEXT PRIMARY KEY, template_id TEXT NOT NULL, site_id TEXT NOT NULL REFERENCES sites(id),
 name TEXT NOT NULL, start_time TEXT NOT NULL, end_time TEXT NOT NULL,
 instructions TEXT NOT NULL, schedule TEXT NOT NULL, guard_ids TEXT NOT NULL,
 actor TEXT NOT NULL REFERENCES users(id), created_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS disabled_users (
 user_id TEXT PRIMARY KEY REFERENCES users(id), actor TEXT NOT NULL REFERENCES users(id), at TEXT NOT NULL
);
