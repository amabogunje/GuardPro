CREATE TABLE IF NOT EXISTS user_password_state (
  user_id TEXT PRIMARY KEY REFERENCES users(id),
  must_change INTEGER NOT NULL DEFAULT 1 CHECK(must_change IN (0,1))
);
-- Existing non-owner credentials may have been chosen by a manager. This
-- backfill is repeatable and never re-flags a completed private password.
INSERT INTO user_password_state(user_id,must_change)
SELECT id,1 FROM users WHERE role <> 'owner'
ON CONFLICT(user_id) DO NOTHING;
