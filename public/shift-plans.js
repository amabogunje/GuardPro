// Template versions preserve historical rosters. Legacy plans remain readable.
export function effectivePlans(plans, cutoff = Infinity) {
  const eligible = plans
    .filter((p) => Date.parse(p.created_at || 0) < cutoff)
    .sort((a, b) => String(a.created_at).localeCompare(String(b.created_at)));
  const templates = new Map();
  for (const p of eligible.filter((p) => p.template_id))
    templates.set(p.template_id, p);
  if (templates.size)
    return [...templates.values()].flatMap((p) => {
      const guards =
        typeof p.guard_ids === "string" ? JSON.parse(p.guard_ids) : p.guard_ids;
      if(guards.includes("*")) return [{...p,guard_id:null,any_guard:true}];
      return (guards.length ? guards : [null]).map((guard_id) => ({
        ...p,
        guard_id,
      }));
    });
  const legacy = new Map();
  for (const p of eligible) legacy.set(p.guard_id, p);
  return [...legacy.values()];
}
export function currentPlan(plans, guardId, siteId, at) {
  const time = Date.parse(at),
    minute = new Date(time + 3600000).toISOString().slice(11, 16);
  // State already contains authorized versions; tolerate small device/server clock skew.
  const roster = effectivePlans(plans.filter((p) => p.site_id === siteId),time+30000);
  if(!roster.length) return {site_id:siteId,guard_id:guardId,start_time:"00:00",end_time:"00:00"};
  const candidates = roster.filter((p) => p.guard_id === guardId || p.any_guard);
  return (
    candidates.find(
      (p) =>
        p.start_time === p.end_time ||
        (p.end_time > p.start_time
          ? minute >= p.start_time && minute < p.end_time
          : minute >= p.start_time || minute < p.end_time),
    ) || candidates[0]
  );
}
