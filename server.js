import {
  patrolSchedule,
  nextPatrol,
  shiftPatrols,
} from "./public/patrol-time.js";
import { scheduledEnd } from "./public/shift-time.js";
import { transcribeAndDraft, draftSummary } from "./ai.js";
import express from "express";
import multer from "multer";
import QRCode from "qrcode";
import { DatabaseSync } from "node:sqlite";
import {
  randomUUID,
  randomBytes,
  scryptSync,
  timingSafeEqual,
  createHmac,
} from "node:crypto";
import fs from "node:fs";
import path from "node:path";
const dir = path.resolve(process.env.DATA_DIR || "data");
fs.mkdirSync(dir, { recursive: true });
fs.mkdirSync(path.join(dir, "media"), { recursive: true });
const db = new DatabaseSync(path.join(dir, "guard.db"));
db.exec(fs.readFileSync("migrations/001.sql", "utf8"));
db.exec(fs.readFileSync("migrations/002.sql", "utf8"));
db.exec(fs.readFileSync("migrations/004.sql", "utf8"));
db.exec(fs.readFileSync("migrations/005.sql", "utf8"));
db.exec(fs.readFileSync("migrations/006.sql", "utf8"));
db.exec(fs.readFileSync("migrations/007.sql", "utf8"));
db.exec(fs.readFileSync("migrations/008.sql", "utf8"));
db.exec("PRAGMA journal_mode=WAL");
const all = (s, ...p) => db.prepare(s).all(...p),
  one = (s, ...p) => db.prepare(s).get(...p),
  run = (s, ...p) => db.prepare(s).run(...p),
  now = () => new Date().toISOString(),
  id = () => randomUUID();
const hash = (p) => {
  let s = randomBytes(16).toString("hex");
  return s + ":" + scryptSync(p, s, 64).toString("hex");
};
const verify = (p, h) => {
  let [s, v] = h.split(":");
  return timingSafeEqual(Buffer.from(v, "hex"), scryptSync(p, s, 64));
};
if (!one("SELECT id FROM users LIMIT 1")) {
  let password = hash(process.env.DEMO_PASSWORD || "Pilot-only-2026!");
  for (let [uid, name, role] of [
    ["bala", "Bala", "guard"],
    ["owner", "Ada Okafor", "owner"],
    ["supervisor", "ISDL Supervisor", "supervisor"],
    ["other", "Other Customer", "owner"],
  ])
    run(
      "INSERT INTO users VALUES(?,?,?,?,?)",
      uid,
      name,
      uid + "@demo.isdl",
      password,
      role,
    );
  run(
    "INSERT INTO customers VALUES(?,?)",
    "oak",
    "Oak House household (fictional)",
  );
  run(
    "INSERT INTO customers VALUES(?,?)",
    "other",
    "Other household (fictional)",
  );
  run(
    "INSERT INTO sites(id,customer_id,name,instructions,phone) VALUES(?,?,?,?,?)",
    "oak",
    "oak",
    "Oak House, Ikeja",
    "Check the gate lock. Keep the walkway clear. Call your supervisor if you need help. Do not confront anyone.",
    "+2340000000000",
  );
  run(
    "INSERT INTO sites(id,customer_id,name) VALUES(?,?,?)",
    "other",
    "other",
    "Palm Court (fictional)",
  );
  for (let uid of ["bala", "owner", "supervisor"])
    run("INSERT INTO assignments VALUES(?,?)", uid, "oak");
  run("INSERT INTO assignments VALUES(?,?)", "other", "other");
  for (let [i, n] of [
    "Main gate",
    "Back gate",
    "Generator area",
    "Perimeter",
  ].entries())
    run(
      "INSERT INTO checkpoints VALUES(?,?,?,?)",
      "cp" + i,
      "oak",
      n,
      "OAK-" + (i + 1),
    );
  run(
    "INSERT INTO incidents(id,site_id,user_id,captured_at,received_at,event_time,report,transcript,status,next_action) VALUES(?,?,?,?,?,?,?,?,?,?)",
    "demo-incident",
    "oak",
    "bala",
    now(),
    now(),
    "Around nine",
    "Back gate lock damaged. Reported to supervisor. Repair pending.",
    "Back gate lock damaged. Reported to supervisor. Repair pending.",
    "Acknowledged",
    "Repair pending",
  );
  run(
    "INSERT INTO transitions VALUES(?,?,?,?,?,?)",
    id(),
    "demo-incident",
    "supervisor",
    now(),
    "Acknowledged",
    "Supervisor acknowledged; repair pending",
  );
}
db.exec(fs.readFileSync("migrations/003.sql", "utf8"));
const app = express();
app.disable("x-powered-by");
app.use(express.json({ limit: "1mb" }));
app.use((req, res, next) => {
  res.set({
    "X-Content-Type-Options": "nosniff",
    "Referrer-Policy": "no-referrer",
    "Content-Security-Policy":
      "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob:; media-src 'self' blob:; connect-src 'self'; object-src 'none'; frame-ancestors 'none'",
  });
  if (req.path.startsWith("/api") || req.path.startsWith("/media"))
    res.set("Cache-Control", "no-store");
  if (
    !["GET", "HEAD"].includes(req.method) &&
    req.headers.origin &&
    req.headers.origin !== `${req.protocol}://${req.headers.host}`
  )
    return res.status(403).json({ error: "Origin denied" });
  next();
});
const fail = (m, status = 400) => {
  throw Object.assign(new Error(m), { status });
};
const requireSite = (u, s) => {
  if (!one("SELECT 1 FROM assignments WHERE user_id=? AND site_id=?", u.id, s))
    fail("Access denied", 403);
};
const supervisor = (u) => {
  if (u.role !== "supervisor") fail("Supervisor only", 403);
};
const audit = (u, a, d) =>
  run(
    "INSERT INTO audit VALUES(?,?,?,?,?)",
    id(),
    u.id,
    now(),
    a,
    JSON.stringify(d),
  );
const limit = new Map();
app.post("/api/login", (req, res) => {
  let key = req.ip,
    v = limit.get(key) || { n: 0, t: Date.now() };
  if (Date.now() - v.t > 600000) v = { n: 0, t: Date.now() };
  limit.set(key, v);
  if (++v.n > 40) fail("Too many attempts; wait ten minutes", 429);
  let u = one(
    "SELECT * FROM users WHERE email=?",
    String(req.body.email || "").toLowerCase(),
  );
  if (!u || !verify(String(req.body.password || ""), u.password))
    fail("Incorrect email or password", 401);
  let token = randomBytes(32).toString("hex"),
    expiresAt = Date.now() + 12 * 3600000;
  run("INSERT INTO sessions VALUES(?,?,?)", token, u.id, expiresAt);
  res.cookie("session", token, {
    httpOnly: true,
    sameSite: "strict",
    secure: process.env.COOKIE_SECURE === "true",
    maxAge: 43200000,
  });
  res.json({ id: u.id, name: u.name, role: u.role, proof: token, expiresAt });
});
app.use(["/api", "/media"], (req, res, next) => {
  let token = (req.headers.cookie || "")
    .split(";")
    .map((s) => s.trim())
    .find((s) => s.startsWith("session="))
    ?.slice(8);
  req.user = one(
    "SELECT u.id,u.name,u.role FROM sessions s JOIN users u ON u.id=s.user_id WHERE token=? AND expires>?",
    token || "",
    Date.now(),
  );
  if (!req.user) return res.status(401).json({ error: "Sign in required" });
  if (req.baseUrl === "/api" && req.headers["x-session-proof"] !== token)
    return res.status(401).json({ error: "Unlock your account to continue" });
  req.token = token;
  next();
});
app.post("/api/logout", (req, res) => {
  run("DELETE FROM sessions WHERE token=?", req.token);
  res.clearCookie("session");
  res.json({ ok: true });
});
function canReadMessage(u, eventId) {
  const context = one(
    "SELECT * FROM message_context WHERE event_id=?",
    eventId,
  );
  if (!context?.shift_id) return false;
  if (u.role === "supervisor") return true;
  return (
    u.role === "guard" &&
    context.guard_id === u.id &&
    !!one(
      "SELECT id FROM shifts WHERE id=? AND user_id=? AND ended_at IS NULL",
      context.shift_id,
      u.id,
    )
  );
}
app.get("/api/state", (req, res) => {
  let u = req.user,
    sites = all(
      "SELECT s.* FROM sites s JOIN assignments a ON a.site_id=s.id WHERE a.user_id=?",
      u.id,
    );
  let ids = sites.map((s) => s.id);
  let scoped = (t) =>
    all(`SELECT * FROM ${t}`).filter((x) => ids.includes(x.site_id));
  let incidents = scoped("incidents");
  res.json({
    user: u,
    sites: sites.map((s) => ({
      ...s,
      instruction_audio:
        one(
          "SELECT id FROM instruction_versions WHERE site_id=? ORDER BY rowid DESC LIMIT 1",
          s.id,
        )?.id || null,
    })),
    shiftPlans: scoped("shift_plans").filter(
      (p) => u.role !== "guard" || p.guard_id === u.id,
    ),
    siteLocations: scoped("site_locations"),
    checkpoints: scoped("checkpoints"),
    shifts: scoped("shifts").filter(
      (s) => u.role !== "guard" || s.user_id === u.id,
    ),
    events: scoped("events")
      .filter((e) =>
        e.kind === "message"
          ? canReadMessage(u, e.id)
          : u.role !== "guard" || e.user_id === u.id || e.kind === "end",
      )
      .map((e) => ({
        ...e,
        payload: {
          ...JSON.parse(e.payload),
          ...(e.kind === "message"
            ? one(
                "SELECT guard_id,shift_id FROM message_context WHERE event_id=?",
                e.id,
              )
            : {}),
        },
        ...(e.kind === "message"
          ? {
              sender_name:
                one("SELECT name FROM users WHERE id=?", e.user_id)?.name || "",
              media: all(
                "SELECT id,mime,source,size FROM message_media WHERE event_id=?",
                e.id,
              ),
            }
          : {}),
      })),
    incidents: incidents
      .filter(
        (i) =>
          u.role !== "guard" || i.user_id === u.id || i.status !== "Resolved",
      )
      .map((i) => ({
        ...i,
        media: all(
          "SELECT id,mime,source,size FROM media WHERE incident_id=?",
          i.id,
        ),
        history: all(
          "SELECT t.*,u.name FROM transitions t JOIN users u ON u.id=t.actor WHERE incident_id=? ORDER BY at",
          i.id,
        ),
        revisions: all("SELECT * FROM revisions WHERE incident_id=?", i.id),
      })),
    summaries: scoped("summaries").filter(
      (s) => u.role === "supervisor" || s.status === "Approved",
    ),
    notifications: all(
      "SELECT n.* FROM notifications n JOIN events e ON e.id=n.event_id LEFT JOIN message_context c ON c.event_id=e.id WHERE n.recipient=? AND (e.kind<>'message' OR c.shift_id IS NOT NULL)",
      u.id,
    ).filter(
      (n) =>
        one("SELECT kind FROM events WHERE id=?", n.event_id)?.kind !==
          "message" || canReadMessage(u, n.event_id),
    ),
    sentNotifications: all(
      "SELECT n.* FROM notifications n JOIN events e ON e.id=n.event_id WHERE e.user_id=? AND (e.kind<>'message' OR EXISTS (SELECT 1 FROM message_context c WHERE c.event_id=e.id AND c.shift_id IS NOT NULL))",
      u.id,
    ).filter(
      (n) =>
        one("SELECT kind FROM events WHERE id=?", n.event_id)?.kind !==
          "message" || canReadMessage(u, n.event_id),
    ),
    users:
      u.role === "supervisor"
        ? all(
            "SELECT DISTINCT u.id,u.name,u.role FROM users u JOIN assignments a ON a.user_id=u.id WHERE a.site_id IN (SELECT site_id FROM assignments WHERE user_id=?)",
            u.id,
          )
        : [],
    ai: process.env.OPENAI_API_KEY ? "live" : "unavailable",
  });
});
const text = (x, max = 5000) =>
  String(x || "")
    .trim()
    .slice(0, max);
app.post("/api/events", (req, res) => {
  let u = req.user,
    b = req.body;
  requireSite(u, b.site_id);
  if (u.role !== "guard" && !(u.role === "supervisor" && b.kind === "message"))
    fail("Guard only", 403);
  if (!/^[a-zA-Z0-9-]{8,80}$/.test(b.id || "")) fail("Invalid record ID");
  let previous = one("SELECT * FROM events WHERE id=?", b.id);
  if (previous) {
    if (previous.user_id !== u.id || previous.site_id !== b.site_id)
      fail("Record conflict", 409);
    return res.json({ ok: true, id: b.id, duplicate: true });
  }
  if (
    ![
      "start",
      "end",
      "scan",
      "incident",
      "alert",
      "note",
      "message",
      "patrol_start",
      "sign_in_location",
    ].includes(b.kind) ||
    !Number.isFinite(Date.parse(b.captured_at))
  )
    fail("Invalid record");
  let p = b.payload || {},
    at = now();
  if (b.kind === "message") {
    if (!text(p.text) && p.has_audio !== true)
      fail("Record or type a message first");
    const guardId = u.role === "guard" ? u.id : p.guard_id;
    if (u.role === "guard" && p.guard_id && p.guard_id !== u.id)
      fail("Not your conversation", 403);
    if (
      !one(
        "SELECT 1 FROM assignments a JOIN users u ON u.id=a.user_id WHERE a.site_id=? AND u.id=? AND u.role='guard'",
        b.site_id,
        guardId || "",
      )
    )
      fail("Choose an assigned guard", 403);
    const shiftId = p.shift_id;
    if (!shiftId) fail("Start a shift before messaging", 403);
    if (shiftId) {
      const target = one("SELECT * FROM shifts WHERE id=?", shiftId);
      if (!target || target.site_id !== b.site_id || target.user_id !== guardId)
        fail("Invalid conversation shift", 403);
      if (
        u.role === "guard" &&
        (Date.parse(b.captured_at) < Date.parse(target.started_at) ||
          (target.ended_at &&
            Date.parse(b.captured_at) > Date.parse(target.ended_at)))
      )
        fail("This shift conversation is read only", 403);
    }
    p = {
      guard_id: guardId,
      shift_id: shiftId,
      text: text(p.text),
      has_audio: p.has_audio === true,
      attachment_count: Math.max(
        0,
        Math.min(5, Number(p.attachment_count) || 0),
      ),
    };
  }
  if (
    one(
      "SELECT count(*) AS n FROM events WHERE user_id=? AND received_at>?",
      u.id,
      new Date(Date.now() - 86400000).toISOString(),
    ).n >= 1000
  )
    fail("Daily pilot record limit reached", 429);
  if (
    p.location &&
    (!Number.isFinite(p.location.latitude) ||
      Math.abs(p.location.latitude) > 90 ||
      !Number.isFinite(p.location.longitude) ||
      Math.abs(p.location.longitude) > 180 ||
      !Number.isFinite(p.location.accuracy) ||
      p.location.accuracy < 0)
  )
    fail("Invalid location");
  if (!["start", "end", "scan", "sign_in_location"].includes(b.kind))
    delete p.location;
  if (Math.abs(Date.parse(b.captured_at) - Date.now()) > 86400000)
    p.clock_review = "Device capture time differs by over a day; review";
  if (["scan", "sign_in_location"].includes(b.kind)) {
    const ref = one("SELECT * FROM site_locations WHERE site_id=?", b.site_id);
    p.location_review = !p.location
      ? "Location unavailable"
      : !ref
        ? "Site reference not configured"
        : p.location.accuracy > 100
          ? "Low GPS accuracy; review"
          : null;
    if (ref && p.location) {
      const rad = (v) => (v * Math.PI) / 180,
        dlat = rad(p.location.latitude - ref.latitude),
        dlon = rad(p.location.longitude - ref.longitude);
      const a =
        Math.sin(dlat / 2) ** 2 +
        Math.cos(rad(ref.latitude)) *
          Math.cos(rad(p.location.latitude)) *
          Math.sin(dlon / 2) ** 2;
      p.distance_m = Math.round(
        6371000 * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(Math.max(0, 1 - a))),
      );
      p.location_review ||=
        p.distance_m > ref.radius_m + p.location.accuracy
          ? "Outside site area; review"
          : "Within site area and reported accuracy";
    }
  }
  db.exec("BEGIN IMMEDIATE");
  try {
    if (["incident", "alert", "note", "patrol_start"].includes(b.kind)) {
      const duty = one(
        "SELECT * FROM shifts WHERE id=? AND user_id=? AND site_id=?",
        p.shift_id || "",
        u.id,
        b.site_id,
      );
      if (
        !duty ||
        Date.parse(b.captured_at) < Date.parse(duty.started_at) ||
        (duty.ended_at && Date.parse(b.captured_at) > Date.parse(duty.ended_at))
      )
        fail("Start your shift before recording this activity", 403);
    }
    if (
      b.kind === "patrol_start" &&
      (!p.round_id || !Number.isFinite(Date.parse(p.scheduled_for)))
    )
      fail("Invalid patrol start");
    if (b.kind === "patrol_start") {
      const duty = one(
        "SELECT * FROM shifts WHERE id=? AND user_id=? AND site_id=?",
        p.shift_id,
        u.id,
        b.site_id,
      );
      const records = all(
        "SELECT * FROM events WHERE site_id=? AND user_id=?",
        b.site_id,
        u.id,
      ).map((e) => ({ ...e, payload: JSON.parse(e.payload) }));
      const previousStarts = records.filter(
        (e) => e.kind === "patrol_start" && e.payload.shift_id === duty.id,
      );
      const required = all(
        "SELECT id FROM checkpoints WHERE site_id=?",
        b.site_id,
      ).length;
      if (
        previousStarts.some(
          (e) =>
            new Set(
              records
                .filter(
                  (x) =>
                    x.kind === "scan" &&
                    x.payload.round_id === e.payload.round_id,
                )
                .map((x) => x.payload.checkpoint_id),
            ).size < required,
        )
      )
        fail("Complete your current patrol before starting another", 409);
      const next = nextPatrol(
        one("SELECT schedule FROM sites WHERE id=?", b.site_id).schedule,
        duty,
        records,
        Date.parse(b.captured_at),
      );
      if (!next || next.iso !== p.scheduled_for || p.slot !== next.slot)
        fail("Start the next scheduled patrol in order", 409);
      const delay = Math.round((Date.parse(b.captured_at) - next.due) / 60000);
      p.timing_exception =
        delay < -1
          ? "Started " + Math.abs(delay) + " minutes early"
          : delay > 1
            ? "Started " + delay + " minutes late"
            : null;
    }
    if (b.kind === "start") {
      p.patrol_schedule = one(
        "SELECT schedule FROM sites WHERE id=?",
        b.site_id,
      ).schedule;
      p.instruction_audio =
        one(
          "SELECT id FROM instruction_versions WHERE site_id=? ORDER BY rowid DESC LIMIT 1",
          b.site_id,
        )?.id || null;
      p.instructions = one(
        "SELECT instructions FROM sites WHERE id=?",
        b.site_id,
      ).instructions;
      if (
        one("SELECT id FROM shifts WHERE user_id=? AND ended_at IS NULL", u.id)
      )
        fail("You already have an active shift", 409);
      p.scheduled_end_at = scheduledEnd(
        b.captured_at,
        all(
          "SELECT * FROM shift_plans WHERE guard_id=? AND site_id=?",
          u.id,
          b.site_id,
        ),
        u.id,
        b.site_id,
      );
      run(
        "INSERT INTO shifts VALUES(?,?,?,?,NULL)",
        b.id,
        b.site_id,
        u.id,
        b.captured_at,
      );
    }
    if (["end", "scan"].includes(b.kind)) {
      let shift = one(
        "SELECT * FROM shifts WHERE id=? AND user_id=? AND site_id=? AND ended_at IS NULL",
        p.shift_id || "",
        u.id,
        b.site_id,
      );
      if (!shift) fail("Start a shift first");
      if (b.kind === "end") {
        const records = all(
          "SELECT * FROM events WHERE site_id=? AND user_id=?",
          b.site_id,
          u.id,
        ).map((e) => ({ ...e, payload: JSON.parse(e.payload) }));
        const entry = records.find(
          (e) => e.kind === "start" && e.id === shift.id,
        );
        const schedule = shiftPatrols(
          entry?.payload.patrol_schedule ??
            one("SELECT schedule FROM sites WHERE id=?", b.site_id).schedule,
          shift,
          entry?.payload.scheduled_end_at,
        );
        const checkpoints = all(
          "SELECT id FROM checkpoints WHERE site_id=?",
          b.site_id,
        ).length;
        p.patrol_exceptions = schedule
          .filter((slot) => {
            const start = records.find(
              (e) =>
                e.kind === "patrol_start" &&
                e.payload.shift_id === shift.id &&
                e.payload.scheduled_for === slot.iso,
            );
            return (
              !start ||
              new Set(
                records
                  .filter(
                    (e) =>
                      e.kind === "scan" &&
                      e.payload.round_id === start.payload.round_id,
                  )
                  .map((e) => e.payload.checkpoint_id),
              ).size < checkpoints
            );
          })
          .map((s) => s.slot + " not completed before shift ended");
        run("UPDATE shifts SET ended_at=? WHERE id=?", b.captured_at, shift.id);
      } else {
        let cp = one(
          "SELECT * FROM checkpoints WHERE site_id=? AND code=?",
          b.site_id,
          p.code || "",
        );
        if (!cp) fail("Unknown checkpoint");
        if (!p.round_id || !p.slot) fail("Select a scheduled round");
        const patrol = one(
          "SELECT payload FROM events WHERE kind='patrol_start' AND user_id=? AND site_id=? AND json_extract(payload,'$.round_id')=?",
          u.id,
          b.site_id,
          p.round_id,
        );
        if (
          !patrol ||
          JSON.parse(patrol.payload).shift_id !== p.shift_id ||
          JSON.parse(patrol.payload).slot !== p.slot
        )
          fail("Start this patrol from Home first", 409);
        if (p.selected_checkpoint_id && p.selected_checkpoint_id !== cp.id)
          fail("Label does not match selected checkpoint");
        p.method = ["qr", "nfc", "manual"].includes(p.method)
          ? p.method
          : "manual";
        p.checkpoint_id = cp.id;
        p.flag = !p.location
          ? "Location unavailable"
          : p.location.accuracy > 100
            ? "Low GPS accuracy"
            : "Reviewable scan";
        if (
          one(
            "SELECT id FROM events WHERE user_id=? AND kind='scan' AND json_extract(payload,'$.round_id')=? AND json_extract(payload,'$.checkpoint_id')=?",
            u.id,
            p.round_id,
            cp.id,
          )
        )
          fail("Checkpoint already recorded for this round", 409);
      }
    }
    if (b.kind === "incident") {
      if (!text(p.event_time, 200))
        fail("When did this happen? Approximate time or not known is accepted");
      if (!text(p.report) || !p.approved)
        fail("Review and approve the report before submitting");
      run(
        "INSERT INTO incidents(id,site_id,user_id,captured_at,received_at,event_time,report,transcript) VALUES(?,?,?,?,?,?,?,?)",
        b.id,
        b.site_id,
        u.id,
        b.captured_at,
        at,
        text(p.event_time, 200),
        text(p.report),
        text(p.transcript),
      );
      run(
        "INSERT INTO revisions VALUES(?,?,?,?,?)",
        id(),
        b.id,
        u.id,
        at,
        JSON.stringify({
          report: text(p.report),
          transcript: text(p.transcript),
          event_time: text(p.event_time, 200),
          approved: true,
        }),
      );
      for (const draft of (Array.isArray(p.draft_history)
        ? p.draft_history
        : []
      ).slice(0, 10)) {
        run(
          "INSERT INTO revisions VALUES(?,?,?,?,?)",
          id(),
          b.id,
          u.id,
          at,
          JSON.stringify({
            report: text(draft.report),
            transcript: text(draft.transcript),
            device_time: text(draft.at, 60),
            approved: false,
          }),
        );
      }
    }
    run(
      "INSERT INTO events VALUES(?,?,?,?,?,?,?)",
      b.id,
      b.site_id,
      u.id,
      b.kind,
      b.captured_at,
      at,
      JSON.stringify(p),
    );
    if (b.kind === "message")
      run(
        "INSERT INTO message_context VALUES(?,?,?)",
        b.id,
        p.guard_id,
        p.shift_id,
      );
    run("UPDATE sites SET last_sync=? WHERE id=?", at, b.site_id);
    if (["incident", "alert", "message"].includes(b.kind))
      for (let s of b.kind === "message" && u.role === "supervisor"
        ? [{ id: p.guard_id }]
        : all(
            "SELECT u.id FROM users u JOIN assignments a ON a.user_id=u.id WHERE a.site_id=? AND u.role='supervisor'",
            b.site_id,
          ))
        run(
          "INSERT INTO notifications(id,site_id,event_id,recipient) VALUES(?,?,?,?)",
          id(),
          b.site_id,
          b.id,
          s.id,
        );
    db.exec("COMMIT");
    res.json({ ok: true, id: b.id, received_at: at });
  } catch (e) {
    db.exec("ROLLBACK");
    throw e;
  }
});
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 12 * 1024 * 1024, files: 1 },
});
const mediaIncident = (u, i) => {
  let inc = one("SELECT * FROM incidents WHERE id=?", i);
  if (!inc) fail("Not found", 404);
  requireSite(u, inc.site_id);
  if (u.role === "guard" && inc.user_id !== u.id)
    fail("Private supporting media", 403);
  return inc;
};
function validateFile(f) {
  if (!f) fail("Choose a file");
  let m = f.mimetype,
    b = f.buffer;
  let valid =
    (m === "image/jpeg" && b[0] === 255 && b[1] === 216) ||
    (m === "image/png" && b.subarray(1, 4).toString() === "PNG") ||
    (m.startsWith("audio/webm") &&
      b.subarray(0, 4).toString("hex") === "1a45dfa3") ||
    (m.startsWith("audio/ogg") && b.subarray(0, 4).toString() === "OggS") ||
    (["audio/mp4", "audio/m4a"].includes(m) &&
      b.subarray(4, 8).toString() === "ftyp") ||
    (m === "audio/wav" && b.subarray(0, 4).toString() === "RIFF");
  if (!valid) fail("Use JPEG/PNG photos or WebM/Ogg/MP4/WAV audio");
}
const mediaTarget = (u, target, uploading = false) => {
  const event = one(
    "SELECT * FROM events WHERE id=? AND kind='message'",
    target,
  );
  if (!event)
    return {
      record: mediaIncident(u, target),
      table: "media",
      column: "incident_id",
    };
  requireSite(u, event.site_id);
  if (
    !one("SELECT shift_id FROM message_context WHERE event_id=?", event.id)
      ?.shift_id
  )
    fail("Messages require a shift", 403);
  if (
    u.role !== "supervisor" &&
    !(
      u.role === "guard" &&
      one("SELECT guard_id FROM message_context WHERE event_id=?", event.id)
        ?.guard_id === u.id
    )
  )
    fail("Private supervisor message", 403);
  if (!uploading && !canReadMessage(u, event.id))
    fail("Only your current shift conversation is available", 403);
  return { record: event, table: "message_media", column: "event_id" };
};
const findMedia = (id) =>
  one("SELECT *,incident_id AS target FROM media WHERE id=?", id) ||
  one("SELECT *,event_id AS target FROM message_media WHERE id=?", id);
app.post("/api/media/:incident/:id", upload.single("file"), (req, res) => {
  const { record, table, column } = mediaTarget(
    req.user,
    req.params.incident,
    true,
  );
  if (
    req.user.role === "owner" ||
    (table === "message_media" && req.user.id !== record.user_id)
  )
    fail("Read only", 403);
  if (!/^[a-zA-Z0-9-]{8,80}$/.test(req.params.id)) fail("Invalid media ID");
  const prev = findMedia(req.params.id);
  if (prev) {
    if (prev.target !== req.params.incident) fail("Conflict", 409);
    return res.json({ ok: true, duplicate: true });
  }
  validateFile(req.file);
  const used =
    one(
      "SELECT COALESCE(sum(size),0) n FROM media m JOIN incidents i ON i.id=m.incident_id WHERE i.site_id=?",
      record.site_id,
    ).n +
    one(
      "SELECT COALESCE(sum(size),0) n FROM message_media m JOIN events e ON e.id=m.event_id WHERE e.site_id=?",
      record.site_id,
    ).n;
  if (used + req.file.size > 1073741824)
    fail("Site pilot media quota reached (1 GB)", 429);
  if (
    one(`SELECT count(*) n FROM ${table} WHERE ${column}=?`, record.id).n >=
    (table === "message_media" ? 5 : 6)
  )
    fail("Attachment limit reached");
  const file = path.join(dir, "media", req.params.id);
  fs.writeFileSync(file, req.file.buffer);
  run(
    `INSERT INTO ${table} VALUES(?,?,?,?,?,?,?)`,
    req.params.id,
    record.id,
    req.user.id,
    req.file.mimetype,
    file,
    req.file.size,
    text(req.body.source, 40),
  );
  res.json({ ok: true });
});
const signing = randomBytes(32);
const sign = (s) => createHmac("sha256", signing).update(s).digest("hex");
app.get("/api/media/:id/link", (req, res) => {
  let m = findMedia(req.params.id);
  if (!m) fail("Not found", 404);
  mediaTarget(req.user, m.target);
  let expires = Date.now() + 120000,
    s = `${m.id}:${req.user.id}:${expires}`;
  res.json({ url: `/media/${m.id}?expires=${expires}&sig=${sign(s)}` });
});
app.get("/media/:id", (req, res) => {
  let m = findMedia(req.params.id);
  if (!m) fail("Not found", 404);
  mediaTarget(req.user, m.target);
  let s = `${m.id}:${req.user.id}:${req.query.expires}`;
  if (Number(req.query.expires) < Date.now() || req.query.sig !== sign(s))
    fail("Link expired", 403);
  res.type(m.mime).sendFile(m.path);
});

app.post("/api/instructions/:site", upload.single("file"), (req, res) => {
  requireSite(req.user, req.params.site);
  if (!["owner", "supervisor"].includes(req.user.role))
    fail("Owner or supervisor only", 403);
  const content = text(req.body.instructions);
  let source = null;
  if (req.body.keep_audio) {
    source = one(
      "SELECT * FROM instruction_versions WHERE id=? AND site_id=?",
      req.body.keep_audio,
      req.params.site,
    );
    if (!source) fail("Recording not found", 404);
  }
  if (req.file) {
    validateFile(req.file);
    if (!req.file.mimetype.startsWith("audio/")) fail("Use an audio recording");
    if (req.file.size > 5 * 1024 * 1024) fail("Recording limit is 5 MB", 413);
  }
  if (!content && !req.file && !source?.path)
    fail("Add a recording or typed instructions");
  if (
    one(
      "SELECT COALESCE(sum(size),0) n FROM instruction_versions WHERE site_id=?",
      req.params.site,
    ).n +
      (req.file?.size || 0) >
    100 * 1024 * 1024
  )
    fail("Instruction storage limit reached (100 MB)", 429);
  const version = id(),
    file = req.file ? path.join(dir, "media", version) : source?.path || null;
  if (req.file) fs.writeFileSync(file, req.file.buffer);
  run(
    "INSERT INTO instruction_versions VALUES(?,?,?,?,?,?,?,?)",
    version,
    req.params.site,
    req.user.id,
    now(),
    content,
    req.file?.mimetype || source?.mime || null,
    file,
    req.file?.size || 0,
  );
  run("UPDATE sites SET instructions=? WHERE id=?", content, req.params.site);
  audit(req.user, "instructions.published", {
    site_id: req.params.site,
    version,
  });
  res.json({ id: version });
});
app.get("/api/instructions/:id/link", (req, res) => {
  const m = one("SELECT * FROM instruction_versions WHERE id=?", req.params.id);
  if (!m) fail("Not found", 404);
  requireSite(req.user, m.site_id);
  if (!m.path) return res.json({ url: null });
  const expires = Date.now() + 120000;
  res.json({
    url:
      "/media/instructions/" +
      m.id +
      "?expires=" +
      expires +
      "&sig=" +
      sign(m.id + ":" + req.user.id + ":" + expires),
  });
});
app.get("/media/instructions/:id", (req, res) => {
  const m = one("SELECT * FROM instruction_versions WHERE id=?", req.params.id);
  if (!m?.path) fail("Not found", 404);
  requireSite(req.user, m.site_id);
  if (
    Number(req.query.expires) < Date.now() ||
    req.query.sig !== sign(m.id + ":" + req.user.id + ":" + req.query.expires)
  )
    fail("Link expired", 403);
  res.set("Cache-Control", "private, no-store").type(m.mime).sendFile(m.path);
});
app.post("/api/ai", upload.single("file"), async (req, res) => {
  if (req.user.role !== "guard") fail("Guard only", 403);
  if (!process.env.OPENAI_API_KEY)
    fail(
      "AI is not configured. Type your observation. No transcript was generated.",
      503,
    );
  validateFile(req.file);
  if (!req.file.mimetype.startsWith("audio/")) fail("Audio required");
  let aiKey = "ai:" + req.user.id,
    usage = limit.get(aiKey) || { n: 0, t: Date.now() };
  if (Date.now() - usage.t > 3600000) usage = { n: 0, t: Date.now() };
  if (++usage.n > 20) fail("Hourly AI pilot limit reached", 429);
  limit.set(aiKey, usage);
  try {
    res.json(await transcribeAndDraft(req.file));
  } catch (e) {
    fail(e.message, 503);
  }
});
app.post("/api/incidents/:id/transition", (req, res) => {
  supervisor(req.user);
  let i = mediaIncident(req.user, req.params.id),
    b = req.body;
  let allowed = {
    Reported: ["Acknowledged"],
    Acknowledged: ["Assigned"],
    Assigned: ["Resolved"],
    Resolved: [],
  };
  if (!allowed[i.status].includes(b.status)) fail("Invalid transition");
  if (b.status === "Assigned" && (!text(b.responsible) || !text(b.next_action)))
    fail("Responsible person and next action required");
  if (b.status === "Resolved" && !text(b.note))
    fail("Resolution note required");
  db.exec("BEGIN");
  try {
    run(
      "UPDATE incidents SET status=?,responsible=?,next_action=? WHERE id=?",
      b.status,
      text(b.responsible) || i.responsible,
      text(b.next_action) || i.next_action,
      i.id,
    );
    run(
      "INSERT INTO transitions VALUES(?,?,?,?,?,?)",
      id(),
      i.id,
      req.user.id,
      now(),
      b.status,
      text(b.note),
    );
    audit(req.user, "incident transition", b);
    db.exec("COMMIT");
  } catch (e) {
    db.exec("ROLLBACK");
    throw e;
  }
  res.json({ ok: true });
});
app.post("/api/notifications/:id/:action", (req, res) => {
  let n = one(
    "SELECT * FROM notifications WHERE id=? AND recipient=?",
    req.params.id,
    req.user.id,
  );
  if (!n) fail("Not found", 404);
  if (req.params.action === "delivered")
    run(
      "UPDATE notifications SET status=CASE WHEN acknowledged_at IS NULL THEN 'delivered' ELSE status END,delivered_at=COALESCE(delivered_at,?),attempts=attempts+1 WHERE id=?",
      now(),
      n.id,
    );
  else if (req.params.action === "acknowledge")
    run(
      "UPDATE notifications SET status='acknowledged',acknowledged_at=? WHERE id=?",
      now(),
      n.id,
    );
  else fail("Invalid action");
  res.json({ ok: true });
});
function counts(site, day) {
  let e = all(
      "SELECT * FROM events WHERE site_id=? AND substr(captured_at,1,10)=?",
      site,
      day,
    ),
    cps = all("SELECT id FROM checkpoints WHERE site_id=?", site),
    rounds = new Map();
  for (let x of e.filter((x) => x.kind === "scan")) {
    let p = JSON.parse(x.payload);
    if (!rounds.has(p.round_id)) rounds.set(p.round_id, new Set());
    rounds.get(p.round_id).add(p.checkpoint_id);
  }
  return {
    shiftStarts: e.filter((x) => x.kind === "start").length,
    checkpointScans: e.filter((x) => x.kind === "scan").length,
    completeRounds: [...rounds.values()].filter(
      (s) => cps.length && cps.every((c) => s.has(c.id)),
    ).length,
    scheduledRounds: one("SELECT schedule FROM sites WHERE id=?", site)
      .schedule.split(",")
      .filter(Boolean).length,
    incidents: all(
      "SELECT id FROM incidents WHERE site_id=? AND substr(captured_at,1,10)=?",
      site,
      day,
    ).length,
    sourceIds: [
      ...e.filter((x) => x.kind !== "message").map((x) => x.id),
      ...all(
        "SELECT id FROM incidents WHERE site_id=? AND substr(captured_at,1,10)=?",
        site,
        day,
      ).map((i) => i.id),
    ],
  };
}
app.get("/api/summary/:site/:day", (req, res) => {
  requireSite(req.user, req.params.site);
  res.json(counts(req.params.site, req.params.day));
});
app.post("/api/summary/:site/:day", async (req, res) => {
  supervisor(req.user);
  requireSite(req.user, req.params.site);
  let c = counts(req.params.site, req.params.day),
    n = `${c.shiftStarts} shift starts, ${c.completeRounds} complete rounds and ${c.incidents} incidents recorded. New records may be pending.`,
    sid = id();
  let draft = await draftSummary(
    c,
    all(
      "SELECT report,event_time,status,next_action FROM incidents WHERE site_id=? AND substr(captured_at,1,10)=?",
      req.params.site,
      req.params.day,
    ),
  );
  n = draft.narrative;
  run(
    "INSERT INTO summaries VALUES(?,?,?,?,?,?,?,?)",
    sid,
    req.params.site,
    req.params.day,
    JSON.stringify(c),
    n,
    "Draft",
    req.user.id,
    now(),
  );
  res.json({ id: sid, counts: c, narrative: n, adapter: draft.adapter });
});
app.post("/api/summaries/:id/approve", (req, res) => {
  supervisor(req.user);
  let s = one("SELECT * FROM summaries WHERE id=?", req.params.id);
  if (!s) fail("Not found", 404);
  requireSite(req.user, s.site_id);
  if (s.status === "Approved") fail("Already approved", 409);
  let current = counts(s.site_id, s.day);
  if (JSON.stringify(current) !== s.counts)
    fail("Source records changed. Generate a fresh draft", 409);
  run(
    "UPDATE summaries SET status='Approved',narrative=?,actor=?,at=? WHERE id=?",
    text(req.body.narrative) || s.narrative,
    req.user.id,
    now(),
    s.id,
  );
  audit(req.user, "summary approved", { id: s.id });
  res.json({ ok: true });
});
app.post("/api/site-location", (req, res) => {
  if (!["owner", "supervisor"].includes(req.user.role))
    fail("Owner or supervisor only", 403);
  requireSite(req.user, req.body.site_id);
  const { site_id } = req.body,
    latitude = Number(req.body.latitude),
    longitude = Number(req.body.longitude),
    radius = Number(req.body.radius_m);
  if (
    !String(req.body.latitude ?? "").trim() ||
    !String(req.body.longitude ?? "").trim() ||
    !Number.isFinite(latitude) ||
    Math.abs(latitude) > 90 ||
    !Number.isFinite(longitude) ||
    Math.abs(longitude) > 180 ||
    !Number.isFinite(radius) ||
    radius < 20 ||
    radius > 5000
  )
    fail("Enter valid coordinates and radius (20–5000 metres)");
  run(
    "INSERT INTO site_locations VALUES(?,?,?,?) ON CONFLICT(site_id) DO UPDATE SET latitude=excluded.latitude,longitude=excluded.longitude,radius_m=excluded.radius_m",
    site_id,
    latitude,
    longitude,
    radius,
  );
  audit(req.user, "site location updated", {
    site_id,
    latitude,
    longitude,
    radius,
  });
  res.json({ ok: true });
});
app.post("/api/patrol-schedule", (req, res) => {
  if (!["owner", "supervisor"].includes(req.user.role))
    fail("Owner or supervisor only", 403);
  requireSite(req.user, req.body.site_id);
  let schedule;
  try {
    schedule = patrolSchedule(req.body);
  } catch (e) {
    fail(e.message);
  }
  const previous = one(
    "SELECT schedule FROM sites WHERE id=?",
    req.body.site_id,
  ).schedule;
  run("UPDATE sites SET schedule=? WHERE id=?", schedule, req.body.site_id);
  audit(req.user, "patrol schedule updated", {
    site_id: req.body.site_id,
    previous,
    schedule,
  });
  res.json({ ok: true, schedule });
});
app.post("/api/admin", (req, res) => {
  supervisor(req.user);
  let b = req.body,
    s = b.site_id;
  if (b.kind === "additional_site") {
    let customer = one("SELECT customer_id FROM sites WHERE id=?", b.site_id);
    requireSite(req.user, b.site_id);
    let sid = id();
    run(
      "INSERT INTO sites(id,customer_id,name) VALUES(?,?,?)",
      sid,
      customer.customer_id,
      text(b.name, 120),
    );
    run("INSERT INTO assignments VALUES(?,?)", req.user.id, sid);
  } else if (b.kind === "customer") {
    let cid = id();
    run("INSERT INTO customers VALUES(?,?)", cid, text(b.name, 120));
    let sid = id();
    run(
      "INSERT INTO sites(id,customer_id,name) VALUES(?,?,?)",
      sid,
      cid,
      text(b.site_name, 120),
    );
    run("INSERT INTO assignments VALUES(?,?)", req.user.id, sid);
  } else {
    requireSite(req.user, s);
    if (b.kind === "shift_plan") {
      if (
        !one(
          "SELECT 1 FROM assignments a JOIN users u ON a.user_id=u.id WHERE a.site_id=? AND u.id=? AND u.role='guard'",
          s,
          b.guard_id,
        )
      )
        fail("Choose an assigned guard");
      if (
        !/^([01][0-9]|2[0-3]):[0-5][0-9]$/.test(b.start_time) ||
        !/^([01][0-9]|2[0-3]):[0-5][0-9]$/.test(b.end_time)
      )
        fail("Use valid shift times");
      run(
        "INSERT INTO shift_plans VALUES(?,?,?,?,?,?,?)",
        id(),
        s,
        b.guard_id,
        b.start_time,
        b.end_time,
        req.user.id,
        now(),
      );
    } else if (b.kind === "site") {
      if (
        !/^([01][0-9]|2[0-3]):[0-5][0-9](,([01][0-9]|2[0-3]):[0-5][0-9])*$/.test(
          b.schedule || "",
        )
      )
        fail("Use comma-separated times HH:MM");
      run(
        "UPDATE sites SET phone=?,schedule=? WHERE id=?",
        text(b.phone, 30),
        text(b.schedule, 2000),
        s,
      );
    } else if (b.kind === "checkpoint")
      run(
        "INSERT INTO checkpoints VALUES(?,?,?,?)",
        id(),
        s,
        text(b.name, 120),
        randomBytes(8).toString("hex"),
      );
    else if (b.kind === "user") {
      if (
        !["guard", "owner", "supervisor"].includes(b.role) ||
        String(b.password || "").length < 12
      )
        fail("Role and password of at least 12 characters required");
      let uid = id();
      run(
        "INSERT INTO users VALUES(?,?,?,?,?)",
        uid,
        text(b.name, 120),
        text(b.email, 200).toLowerCase(),
        hash(b.password),
        b.role,
      );
      run("INSERT INTO assignments VALUES(?,?)", uid, s);
    } else if (b.kind === "assign") {
      let user = one("SELECT id FROM users WHERE id=?", b.user_id);
      if (
        !user ||
        !one(
          "SELECT 1 FROM assignments a JOIN assignments b ON a.site_id=b.site_id WHERE a.user_id=? AND b.user_id=?",
          req.user.id,
          user.id,
        )
      )
        fail("User outside assigned scope", 403);
      run("INSERT OR IGNORE INTO assignments VALUES(?,?)", user.id, s);
    } else fail("Unknown action");
  }
  audit(req.user, "admin " + b.kind, { site: s, name: b.name });
  res.json({ ok: true });
});
app.get("/api/qr/:site", async (req, res) => {
  supervisor(req.user);
  requireSite(req.user, req.params.site);
  res.json(
    await Promise.all(
      all("SELECT * FROM checkpoints WHERE site_id=?", req.params.site).map(
        async (c) => ({ ...c, image: await QRCode.toDataURL(c.code) }),
      ),
    ),
  );
});
app.use(express.static("public", { etag: true }));
app.use((err, req, res, next) => {
  console.error(err.message);
  res.status(err.status || (err.code === "LIMIT_FILE_SIZE" ? 413 : 400)).json({
    error: err.status
      ? err.message
      : err.code === "LIMIT_FILE_SIZE"
        ? "File exceeds 12 MB"
        : "Request could not be completed",
  });
});
app.listen(
  Number(process.env.PORT || 3000),
  process.env.HOST || "127.0.0.1",
  () =>
    console.log(
      `Guard Companion running at http://${process.env.HOST || "127.0.0.1"}:${process.env.PORT || 3000}`,
    ),
);
