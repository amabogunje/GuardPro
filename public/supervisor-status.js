// Daily site shift windows use Nigerian local time (UTC+01:00).
const DAY = 86400000;
export function overviewShifts({ site, plans = [], day, now = Date.now() }) {
  const today = new Date(now + 3600000).toISOString().slice(0, 10);
  const localDay = day || today;
  const cutoff = Date.parse(localDay + "T00:00:00+01:00") + DAY;
  const latest = new Map();
  for (const p of plans
    .filter(
      (p) =>
        p.site_id === site.id &&
        (!p.created_at || Date.parse(p.created_at) < cutoff),
    )
    .sort((a, b) => String(a.created_at).localeCompare(String(b.created_at))))
    latest.set(p.guard_id, p);
  const groups = new Map();
  for (const p of latest.values()) {
    const key = `${p.start_time}-${p.end_time}`;
    if (!groups.has(key))
      groups.set(key, {
        key,
        start_time: p.start_time,
        end_time: p.end_time,
        guardIds: [],
      });
    groups.get(key).guardIds.push(p.guard_id);
  }
  if (!groups.size)
    groups.set("default", {
      key: "default",
      start_time: "00:00",
      end_time: "00:00",
      guardIds: localDay < today ? [] : site.guard_ids || [],
      rosterUnknown: localDay < today,
    });
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
  // The denominator is guards due to check in, not a future roster size.
  const expected = new Set(now >= window.start ? window.guardIds : []);
  const checked = new Set(
    shifts
      .filter(
        (s) =>
          s.site_id === site.id &&
          expected.has(s.user_id) &&
          Date.parse(s.started_at) < window.end &&
          Date.parse(s.ended_at || new Date(now).toISOString()) >=
            window.start &&
          Date.parse(s.started_at) <= now,
      )
      .map((s) => s.user_id),
  );
  const within = (time) =>
    Date.parse(time) >= window.start && Date.parse(time) < window.end;
  const slots = new Map();
  for (let base = window.start - DAY; base < window.end + DAY; base += DAY) {
    const date = new Date(base + 3600000).toISOString().slice(0, 10);
    for (const slot of (site.schedule || "").split(",").filter(Boolean)) {
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
      value: window.rosterUnknown ? "—" : `${checked.size} of ${expected.size}`,
      qualifier: window.rosterUnknown ? "roster unavailable" : "expected",
      tone: checked.size < expected.size ? "attention" : "good",
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
      Date.parse(s.started_at) < window.end &&
      Date.parse(s.ended_at || new Date(now).toISOString()) > window.start,
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
