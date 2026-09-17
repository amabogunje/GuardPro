CREATE TABLE IF NOT EXISTS media_uploads(
  id TEXT PRIMARY KEY,
  target_id TEXT NOT NULL,
  site_id TEXT NOT NULL,
  user_id TEXT NOT NULL,
  table_name TEXT NOT NULL CHECK(table_name IN ('media','message_media')),
  mime TEXT NOT NULL,
  size INTEGER NOT NULL,
  source TEXT NOT NULL DEFAULT '',
  created_at TEXT NOT NULL,
  status TEXT NOT NULL CHECK(status IN ('pending','finalized')),
  path TEXT
);
