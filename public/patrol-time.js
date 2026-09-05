// Daily patrol times use Africa/Lagos (UTC+01:00), including overnight windows.
export function patrolSchedule({ mode, times, start, end, interval }) {
  const valid = (t) => /^([01][0-9]|2[0-3]):[0-5][0-9]$/.test(t || "");
  let slots;
  if (mode === "interval") {
    if (
      !valid(start) ||
      !valid(end) ||
      !Number.isInteger(Number(interval)) ||
      Number(interval) < 5 ||
      Number(interval) > 720
    )
      throw new Error(
        "Choose valid times and an interval from 5 to 720 minutes.",
      );
    const mins = (t) => Number(t.slice(0, 2)) * 60 + Number(t.slice(3));
    let finish = mins(end),
      begin = mins(start);
    if (finish <= begin) finish += 1440;
    slots = [];
    for (let m = begin; m < finish; m += Number(interval))
      slots.push(
        String(Math.floor((m % 1440) / 60)).padStart(2, "0") +
          ":" +
          String(m % 60).padStart(2, "0"),
      );
  } else {
    slots = String(times || "")
      .split(",")
      .map((t) => t.trim());
    if (!slots.length || slots.some((t) => !valid(t)))
      throw new Error(
        "Enter daily times separated by commas, for example 06:00,12:00,18:00.",
      );
  }
  return [...new Set(slots)].sort().join(",");
}
export function shiftPatrols(schedule, shift, end) {
  if (!shift) return [];
  const from = Date.parse(shift.started_at),
    until = Date.parse(end || "") || from + 86400000;
  const base = Date.parse(
    new Date(from + 3600000).toISOString().slice(0, 10) + "T00:00:00+01:00",
  );
  const slots = [];
  for (
    let day = 0;
    day < Math.min(7, Math.ceil((until - base) / 86400000));
    day++
  )
    for (const slot of schedule.split(",").filter(Boolean).sort()) {
      const due =
        base +
        day * 86400000 +
        (Number(slot.slice(0, 2)) * 60 + Number(slot.slice(3))) * 60000;
      if (due >= from && due < until)
        slots.push({ slot, due, iso: new Date(due).toISOString() });
    }
  return slots;
}
export function nextPatrol(schedule, shift, events, now = Date.now()) {
  const entry = events.find((e) => e.kind === "start" && e.id === shift?.id);
  const slots = shiftPatrols(
    entry?.payload.patrol_schedule ?? schedule,
    shift,
    entry?.payload.scheduled_end_at,
  );
  const claimed = new Set(
    events
      .filter(
        (e) => e.kind === "patrol_start" && e.payload.shift_id === shift?.id,
      )
      .map((e) => e.payload.scheduled_for),
  );
  const next = slots.find((s) => !claimed.has(s.iso));
  return next ? { ...next, remaining: next.due - now } : null;
}
