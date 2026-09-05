// Daily site schedules are Nigerian local time (UTC+01:00).
export function scheduledEnd(startedAt, plans, guardId, siteId) {
  const plan = plans
    .filter((p) => p.guard_id === guardId && p.site_id === siteId)
    .sort((a, b) =>
      String(b.created_at).localeCompare(String(a.created_at)),
    )[0];
  if (!plan) return null;
  const started = Date.parse(startedAt),
    localDay = new Date(started + 3600000).toISOString().slice(0, 10);
  const base = Date.parse(`${localDay}T${plan.start_time}:00+01:00`);
  const [sh, sm] = plan.start_time.split(":").map(Number),
    [eh, em] = plan.end_time.split(":").map(Number);
  let duration = (eh * 60 + em - sh * 60 - sm) * 60000;
  if (duration <= 0) duration += 86400000;
  const candidates = [-1, 0, 1].map((offset) => ({
    start: base + offset * 86400000,
    end: base + offset * 86400000 + duration,
  }));
  const selected =
    candidates.find((c) => started >= c.start && started < c.end) ||
    candidates.sort(
      (a, b) => Math.abs(a.start - started) - Math.abs(b.start - started),
    )[0];
  return new Date(selected.end).toISOString();
}
export function elapsedShift(startedAt, now = Date.now()) {
  const total = Math.max(0, Math.floor((now - Date.parse(startedAt)) / 1000));
  return [Math.floor(total / 3600), Math.floor(total / 60) % 60, total % 60]
    .map((n) => String(n).padStart(2, "0"))
    .join(":");
}
