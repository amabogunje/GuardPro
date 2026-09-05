-- Retain legacy rows, but require a shift for every new conversation record.
CREATE TRIGGER IF NOT EXISTS message_shift_required
BEFORE INSERT ON message_context
WHEN NEW.shift_id IS NULL AND NOT EXISTS(SELECT 1 FROM message_context WHERE event_id=NEW.event_id)
BEGIN SELECT RAISE(ABORT,'A message requires a shift'); END;
