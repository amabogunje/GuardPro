-- Fictional demo schedule only. Existing supervisor-configured plans take priority.
INSERT INTO shift_plans(id,site_id,guard_id,start_time,end_time,created_by,created_at)
SELECT 'demo-bala-day','oak','bala','06:00','18:00','supervisor','2026-01-01T00:00:00.000Z'
WHERE EXISTS(SELECT 1 FROM users WHERE id='bala' AND email='bala@demo.isdl')
AND EXISTS(SELECT 1 FROM sites WHERE id='oak')
AND EXISTS(SELECT 1 FROM users WHERE id='supervisor')
AND NOT EXISTS(SELECT 1 FROM shift_plans WHERE site_id='oak' AND guard_id='bala');
