import { effectivePlans } from "./shift-plans.js";
// Daily site shift windows use Nigerian local time (UTC+01:00).
const DAY = 86400000;
// A guard may check in shortly before the rostered start, but a previous
// occurrence must never satisfy attendance for the selected shift.
const EARLY_CHECK_IN_GRACE = 15 * 60 * 1000;

function startedForOccurrence(shift, window, now) {
  const started = Date.parse(shift.started_at);
  return (
    Number.isFinite(started) &&
    started >= window.start - EARLY_CHECK_IN_GRACE &&
    started < window.end &&
    started <= now
  );
}
export function overviewShifts({ site, plans = [], day, now = Date.now() }) {
  const today = new Date(now + 3600000).toISOString().slice(0, 10);
  const localDay = day || today;
  const cutoff = Date.parse(localDay + "T00:00:00+01:00") + DAY;
  const latest = effectivePlans(plans.filter(p=>p.site_id===site.id),cutoff);
  const groups = new Map();
  for (const p of latest) {
    const key = p.template_id || `${p.start_time}-${p.end_time}`;
    if (!groups.has(key))
      groups.set(key, {
        key,
        start_time: p.start_time,
        end_time: p.end_time,
        schedule: p.schedule,
        name: p.name,
        anyGuard: p.any_guard || false,
        guardIds: [],
      });
    if(p.guard_id) groups.get(key).guardIds.push(p.guard_id);
  }
  return [...groups.values()]
    .map((g) => {
      let start = Date.parse(`${localDay}T${g.start_time}:00+01:00`);
      let end = Date.parse(`${localDay}T${g.end_time}:00+01:00`);
      if (end <= start) end += DAY;
      // Show the ongoing overnight occurrence, not tomorrow's end for a future one.
      if (
        localDay === today &&
        start > now &&
        start - DAY <= now &&
        end - DAY > now
      ) {
        start -= DAY;
        end -= DAY;
      }
      return {
        ...g,
        start,
        end,
        key: `${site.id}:${g.key}:${start}`,
        current: now >= start && now < end,
      };
    })
    .sort((a, b) => a.start - b.start);
}
export function supervisorStatus({
  site,
  plans = [],
  shifts = [],
  events = [],
  incidents = [],
  checkpoints = [],
  selectedShift,
  now = Date.now(),
}) {
  const windows = overviewShifts({ site, plans, now });
  const window =
    selectedShift ||
    windows.find((w) => w.current) ||
    windows.find((w) => w.start > now) ||
    windows.at(-1);
  if (!window)
    return [
      { label: "Guards checked in", value: "—", qualifier: "set up a shift", tone: "good" },
      { label: "Patrols scheduled", value: "—", qualifier: "set up a shift", tone: "good" },
      { label: "Problems reported", value: String(incidents.filter(i => i.site_id === site.id && i.status !== "Resolved").length), qualifier: "need attention", tone: incidents.some(i => i.site_id === site.id && i.status !== "Resolved") ? "attention" : "good" },
    ];
  // A named roster gives the supervisor an expected check-in count. An Any
  // roster deliberately has no denominator, even after the shift starts.
  const expected = new Set(window.guardIds);
  const attendanceDue = now >= window.start;
  const eligible = (shift) =>
    shift.site_id === site.id &&
    (window.anyGuard || expected.has(shift.user_id));
  const checked = new Set(
    shifts
      .filter((s) => eligible(s) && startedForOccurrence(s, window, now))
      .map((s) => s.user_id),
  );
  const overdueOpen = shifts.filter((s) => {
    const started = Date.parse(s.started_at);
    return (
      eligible(s) &&
      !s.ended_at &&
      Number.isFinite(started) &&
      started < window.start - EARLY_CHECK_IN_GRACE
    );
  });
  const within = (time) =>
    Date.parse(time) >= window.start && Date.parse(time) < window.end;
  const slots = new Map();
  for (let base = window.start - DAY; base < window.end + DAY; base += DAY) {
    const date = new Date(base + 3600000).toISOString().slice(0, 10);
    for (const slot of (window.schedule ?? site.schedule ?? "").split(",").filter(Boolean)) {
      const due = Date.parse(`${date}T${slot}:00+01:00`);
      if (due >= window.start && due < window.end)
        slots.set(new Date(due).toISOString(), due);
    }
  }
  const rounds = new Map();
  for (const e of events.filter(
    (e) => e.site_id === site.id && e.kind === "scan" && within(e.captured_at),
  )) {
    const p = e.payload;
    const due =
      p.scheduled_for ||
      [...slots.keys()].find(
        (t) =>
          new Date(Date.parse(t) + 3600000).toISOString().slice(11, 16) ===
          p.slot,
      );
    if (!slots.has(due)) continue;
    if (!rounds.has(p.round_id))
      rounds.set(p.round_id, { due, stops: new Set() });
    rounds.get(p.round_id).stops.add(p.checkpoint_id);
  }
  const completed = new Set(
    [...rounds.values()]
      .filter(
        (r) =>
          checkpoints.length && checkpoints.every((c) => r.stops.has(c.id)),
      )
      .map((r) => r.due),
  );
  const pending = [...slots].some(
    ([id, time]) => time <= now && !completed.has(id),
  );
  const reported = overviewProblems(site, window, incidents).length;
  return [
    {
      label: "Guards checked in",
      value: window.rosterUnknown
        ? "—"
        : window.anyGuard
          ? `${checked.size} checked in`
          : `${checked.size} of ${expected.size} checked in`,
      qualifier: window.rosterUnknown
        ? "roster unavailable"
        : overdueOpen.length
          ? `${overdueOpen.length} earlier shift${overdueOpen.length === 1 ? "" : "s"} still open`
          : window.anyGuard
            ? "any guard may check in"
            : "assigned guards",
      tone: (attendanceDue && checked.size < expected.size) || overdueOpen.length ? "attention" : "good",
    },
    {
      label: "Patrols scheduled",
      value: window.patrolUnknown ? "—" : `${completed.size} of ${slots.size}`,
      qualifier: window.patrolUnknown ? "schedule unavailable" : "completed",
      tone: pending ? "attention" : "good",
    },
    {
      label: "Problems reported",
      value: String(reported),
      qualifier: reported === 1 ? "needs attention" : "need attention",
      tone: reported ? "attention" : "good",
    },
  ];
}

export function overviewDetails({
  site,
  selectedShift: window,
  shifts = [],
  events = [],
  incidents = [],
  checkpoints = [],
  now = Date.now(),
}) {
  const inWindow = (time) =>
    Date.parse(time) >= window.start && Date.parse(time) < window.end;
  const sessions = shifts.filter(
    (s) =>
      s.site_id === site.id &&
      startedForOccurrence(s, window, now),
  );
  // Include recorded attendance even if the original roster is incomplete.
  const ids = new Set([...window.guardIds, ...sessions.map((s) => s.user_id)]);
  const guards = [...ids].map((id) => ({
    id,
    session: sessions.find((s) => s.user_id === id),
    expected: window.guardIds.includes(id),
    due: now >= window.start,
  }));
  const problems = overviewProblems(site, window, incidents);
  const scans = events.filter(
    (e) =>
      e.site_id === site.id && e.kind === "scan" && inWindow(e.captured_at),
  );
  const rounds = new Map();
  for (const e of scans) {
    if (!rounds.has(e.payload.round_id))
      rounds.set(e.payload.round_id, {
        slot: e.payload.slot,
        stops: new Set(),
      });
    rounds.get(e.payload.round_id).stops.add(e.payload.checkpoint_id);
  }
  const complete = new Set(
    [...rounds.values()]
      .filter(
        (r) =>
          checkpoints.length && checkpoints.every((c) => r.stops.has(c.id)),
      )
      .map((r) => r.slot),
  );
  const patrols = [];
  for (let base = window.start - DAY; base < window.end + DAY; base += DAY) {
    const date = new Date(base + 3600000).toISOString().slice(0, 10);
    for (const slot of (site.schedule || "").split(",").filter(Boolean)) {
      const due = Date.parse(`${date}T${slot}:00+01:00`);
      if (
        due >= window.start &&
        due < window.end &&
        due <= now &&
        !complete.has(slot)
      )
        patrols.push({ slot, due });
    }
  }
  return { guards, problems, patrols };
}

// Shared by the KPI and attention list: unresolved reports up to the selected shift's end.
export function overviewProblems(site, window, incidents = []) {
  return incidents
    .filter(
      (i) =>
        i.site_id === site.id &&
        i.status !== "Resolved" &&
        Date.parse(i.captured_at) < window.end,
    )
    .map((i) => ({ ...i, carry: Date.parse(i.captured_at) < window.start }));
}
