CREATE TABLE IF NOT EXISTS retired_checkpoints (
 checkpoint_id TEXT PRIMARY KEY REFERENCES checkpoints(id),
 actor TEXT NOT NULL REFERENCES users(id), at TEXT NOT NULL
);
