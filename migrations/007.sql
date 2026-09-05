CREATE TABLE IF NOT EXISTS message_context(event_id TEXT PRIMARY KEY REFERENCES events(id),guard_id TEXT NOT NULL REFERENCES users(id),shift_id TEXT REFERENCES shifts(id));
CREATE INDEX IF NOT EXISTS message_context_thread ON message_context(guard_id,shift_id);
INSERT OR IGNORE INTO message_context(event_id,guard_id,shift_id)
SELECT e.id,e.user_id,(SELECT s.id FROM shifts s WHERE s.user_id=e.user_id AND s.site_id=e.site_id AND s.started_at<=e.captured_at AND (s.ended_at IS NULL OR s.ended_at>=e.captured_at) ORDER BY s.started_at DESC LIMIT 1)
FROM events e JOIN users u ON u.id=e.user_id WHERE e.kind='message' AND u.role='guard';
