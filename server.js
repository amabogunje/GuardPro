import {
  patrolSchedule,
  nextPatrol,
  shiftPatrols,
} from "./public/patrol-time.js";
import { scheduledEnd } from "./public/shift-time.js";
import { currentPlan, effectivePlans } from "./public/shift-plans.js";
import { settingsRoutes } from "./settings.js";
import { phoneNumber, loginId } from "./public/login-id.js";
import { assessLocation, propertyInput } from './location-checks.js';
import { transcribeAndDraft, draftSummary } from "./ai.js";
import express from "express";
import multer from "multer";
import QRCode from "qrcode";
import {
  all,
  one,
  run,
  transaction,
  postgres,
  consumeRate,
} from "./database.js";
import { saveMedia, serveMedia, maxUploadBytes } from "./storage.js";
import { migrate } from "./migrate.js";
import { activityReport, reportWindow } from "./activity-reports.js";
import { ownerOverview } from './owner-overview.js';
import { ownerHealth, classificationInput } from './owner-health.js';
import {
  randomUUID,
  randomBytes,
  scryptSync,
  timingSafeEqual,
  createHmac,
} from "node:crypto";
if (!postgres) await migrate();
const messagingEnabled = process.env.ENABLE_MESSAGING === "true";
const now = () => new Date().toISOString(),
  id = () => randomUUID();
const hash = (p) => {
  let s = randomBytes(16).toString("hex");
  return s + ":" + scryptSync(p, s, 64).toString("hex");
};
const verify = (p, h) => {
  let [s, v] = h.split(":");
  return timingSafeEqual(Buffer.from(v, "hex"), scryptSync(p, s, 64));
};
const app = express();
app.disable("x-powered-by");
if (process.env.VERCEL) app.set("trust proxy", 1);
// Commit mutations before sending their success response.
const post = (url, ...handlers) => {
  const handler = handlers.pop();
  app.post(url, ...handlers, async (req, res, next) => {
    const original = res.json;
    let response;
    res.json = (value) => {
      response = value;
      return res;
    };
    try {
      // Count attempts before acquiring a transaction connection. This also
      // avoids pool exhaustion when several logins arrive simultaneously.
      if (url === "/api/login" && !(await rate("login:" + req.ip, 600000, 40)))
        fail("Too many attempts; wait ten minutes", 429);
      if (url === "/api/ai" && !(await rate("ai:" + req.user.id, 3600000, 20)))
        fail("Hourly AI pilot limit reached", 429);
      await transaction(() => handler(req, res));
      res.json = original;
      res.json(response);
    } catch (error) {
      res.json = original;
      next(error);
    }
  });
};
const mapAsync = async (items, fn) => {
  const result = [];
  for (const item of items) result.push(await fn(item));
  return result;
};
const filterAsync = async (items, fn) => {
  const result = [];
  for (const item of items) if (await fn(item)) result.push(item);
  return result;
};
app.use(express.json({ limit: "1mb" }));
app.use((req, res, next) => {
  res.set({
    "X-Content-Type-Options": "nosniff",
    "Referrer-Policy": "no-referrer",
    "Content-Security-Policy":
    "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob:; media-src 'self' blob:; connect-src 'self'; frame-src 'self' https://www.openstreetmap.org; object-src 'none'; frame-ancestors 'none'",
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
const requireSite = async (u, s) => {
  if (
    !(await one(
      "SELECT 1 FROM assignments WHERE user_id=? AND site_id=?",
      u.id,
      s,
    ))
  )
    fail("Access denied", 403);
};
const supervisor = (u) => {
  if (u.role !== "supervisor") fail("Supervisor only", 403);
};
const audit = async (u, a, d) =>
  await run(
    "INSERT INTO audit VALUES(?,?,?,?,?)",
    id(),
    u.id,
    now(),
    a,
    JSON.stringify(d),
  );
const limit = new Map();
async function rate(key, duration, maximum) {
  if (postgres) return (await consumeRate(key, duration)) <= maximum;
  let entry = limit.get(key) || { n: 0, t: Date.now() };
  if (Date.now() - entry.t > duration) entry = { n: 0, t: Date.now() };
  entry.n++;
  limit.set(key, entry);
  return entry.n <= maximum;
}
post("/api/login", async (req, res) => {
  let u = await one(
    "SELECT u.* FROM users u LEFT JOIN user_contacts c ON c.user_id=u.id WHERE (u.email=? AND COALESCE(c.email_missing,0)=0) OR c.whatsapp=?",
    loginId(req.body.email),
    phoneNumber(req.body.email),
  );
  if (!u || (await one("SELECT 1 FROM disabled_users WHERE user_id=?",u.id)) || !verify(String(req.body.password || ""), u.password))
    fail("Incorrect sign-in details", 401);
  let token = randomBytes(32).toString("hex"),
    expiresAt = Date.now() + 12 * 3600000;
  await run("INSERT INTO sessions VALUES(?,?,?)", token, u.id, expiresAt);
  res.cookie("session", token, {
    httpOnly: true,
    sameSite: "strict",
    secure: process.env.COOKIE_SECURE === "true",
    maxAge: 43200000,
  });
  const contact=await one("SELECT vault_key FROM user_contacts WHERE user_id=?",u.id);
  res.json({ id: u.id, name: u.name, role: u.role, proof: token, expiresAt, vaultAccount:contact?.vault_key || u.email });
});
app.use(["/api", "/media"], async (req, res, next) => {
  let token = (req.headers.cookie || "")
    .split(";")
    .map((s) => s.trim())
    .find((s) => s.startsWith("session="))
    ?.slice(8);
  req.user = await one(
    "SELECT u.id,u.name,u.role FROM sessions s JOIN users u ON u.id=s.user_id WHERE token=? AND expires>?",
    token || "",
    Date.now(),
  );
  if (!req.user || await one("SELECT 1 FROM disabled_users WHERE user_id=?",req.user.id)) return res.status(401).json({ error: "Sign in required" });
  if (req.baseUrl === "/api" && req.headers["x-session-proof"] !== token)
    return res.status(401).json({ error: "Unlock your account to continue" });
  req.token = token;
  next();
});
post("/api/logout", async (req, res) => {
  await run("DELETE FROM sessions WHERE token=?", req.token);
  res.clearCookie("session");
  res.json({ ok: true });
});
async function canReadMessage(u, eventId) {
  const context = await one(
    "SELECT * FROM message_context WHERE event_id=?",
    eventId,
  );
  if (!context?.shift_id) return false;
  if (u.role === "supervisor") return true;
  return (
    u.role === "guard" &&
    context.guard_id === u.id &&
    !!(await one(
      "SELECT id FROM shifts WHERE id=? AND user_id=? AND ended_at IS NULL",
      context.shift_id,
      u.id,
    ))
  );
}
app.get('/api/owner-overview/:site', async (req,res) => {
  if(req.user.role!=='owner') fail('Owner only',403);
  await requireSite(req.user,req.params.site);
  const site=await one('SELECT * FROM sites WHERE id=?',req.params.site);
  const scoped=t=>all(`SELECT * FROM ${t} WHERE site_id=?`,site.id);
  const [users,supervisors,plans,shifts,events,incidents,checkpoints,locations,reviews,resolutions]=await Promise.all([
    all('SELECT u.id,u.name,u.role FROM users u JOIN assignments a ON a.user_id=u.id WHERE a.site_id=? AND NOT EXISTS (SELECT 1 FROM disabled_users d WHERE d.user_id=u.id)',site.id),
    all("SELECT u.id,u.name,CASE WHEN c.email_missing=1 THEN '' ELSE u.email END AS email,c.whatsapp FROM users u JOIN assignments a ON a.user_id=u.id LEFT JOIN user_contacts c ON c.user_id=u.id WHERE a.site_id=? AND u.role='supervisor' AND NOT EXISTS (SELECT 1 FROM disabled_users d WHERE d.user_id=u.id)",site.id),
    Promise.all([
      scoped('shift_plans'),
      all("SELECT t.*,(SELECT instruction_version_id FROM shift_template_audio WHERE shift_template_id=t.id) AS instruction_audio FROM shift_templates t WHERE t.site_id=?",site.id),
    ]).then(p=>p.flat()),scoped('shifts'),scoped('events'),scoped('incidents'),
    all('SELECT c.* FROM checkpoints c WHERE c.site_id=? AND NOT EXISTS (SELECT 1 FROM retired_checkpoints r WHERE r.checkpoint_id=c.id)',site.id),
    scoped('property_locations'),scoped('location_reviews'),
    all('SELECT t.*,u.name AS actor_name FROM transitions t JOIN users u ON u.id=t.actor JOIN incidents i ON i.id=t.incident_id WHERE i.site_id=?',site.id)
  ]);
  const input={site,users,supervisors,plans,shifts,events:events.map(e=>({...e,payload:JSON.parse(e.payload)})),incidents,checkpoints,locations,reviews,resolutions};
  res.json({...ownerOverview(input),health:ownerHealth({...input,classifications:await scoped('incident_classifications')})});
});
app.get("/api/state", async (req, res) => {
  const u = req.user;
  const scoped = (t) =>
    all(
      `SELECT t.* FROM ${t} t JOIN assignments a ON a.site_id=t.site_id WHERE a.user_id=?`,
      u.id,
    );
  const [
    sites,
    shiftPlans,
    siteLocations,
    checkpoints,
    shifts,
    events,
    incidents,
    summaries,
    notifications,
    instructions,
    contexts,
    media,
    messageMedia,
    history,
    revisions,
    names,
  ] = await Promise.all([
    all(
      "SELECT s.* FROM sites s JOIN assignments a ON a.site_id=s.id WHERE a.user_id=?",
      u.id,
    ),
    Promise.all([
      scoped("shift_plans"),
      all("SELECT t.*,(SELECT instruction_version_id FROM shift_template_audio WHERE shift_template_id=t.id) AS instruction_audio FROM shift_templates t JOIN assignments a ON a.site_id=t.site_id WHERE a.user_id=?",u.id),
    ]).then(parts=>parts.flat()),
    scoped("site_locations"),
    all("SELECT c.*,(SELECT at FROM retired_checkpoints WHERE checkpoint_id=c.id) AS retired_at FROM checkpoints c JOIN assignments a ON a.site_id=c.site_id WHERE a.user_id=?",u.id),
    scoped("shifts"),
    scoped("events"),
    scoped("incidents"),
    scoped("summaries"),
    scoped("notifications"),
    all(
      "SELECT v.id,v.site_id,v.created_at,v.path FROM instruction_versions v JOIN assignments a ON a.site_id=v.site_id WHERE a.user_id=? ORDER BY v.created_at DESC,v.id DESC",
      u.id,
    ),
    all(
      "SELECT c.* FROM message_context c JOIN events e ON e.id=c.event_id JOIN assignments a ON a.site_id=e.site_id WHERE a.user_id=?",
      u.id,
    ),
    all(
      "SELECT m.id,m.incident_id,m.mime,m.source,m.size FROM media m JOIN incidents i ON i.id=m.incident_id JOIN assignments a ON a.site_id=i.site_id WHERE a.user_id=?",
      u.id,
    ),
    all(
      "SELECT m.id,m.event_id,m.mime,m.source,m.size FROM message_media m JOIN events e ON e.id=m.event_id JOIN assignments a ON a.site_id=e.site_id WHERE a.user_id=?",
      u.id,
    ),
    all(
      "SELECT t.*,u.name FROM transitions t JOIN users u ON u.id=t.actor JOIN incidents i ON i.id=t.incident_id JOIN assignments a ON a.site_id=i.site_id WHERE a.user_id=? ORDER BY t.at,t.id",
      u.id,
    ),
    all(
      "SELECT r.* FROM revisions r JOIN incidents i ON i.id=r.incident_id JOIN assignments a ON a.site_id=i.site_id WHERE a.user_id=?",
      u.id,
    ),
    all(
      "SELECT DISTINCT u.id,u.name,u.role,a.site_id,(SELECT user_id FROM disabled_users WHERE user_id=u.id) AS disabled,(SELECT user_id FROM user_photos WHERE user_id=u.id) AS photo_id FROM users u JOIN assignments a ON a.user_id=u.id WHERE a.site_id IN (SELECT site_id FROM assignments WHERE user_id=?)",
      u.id,
    ),
  ]);
  const byContext = new Map(contexts.map((c) => [c.event_id, c]));
  const byEvent = new Map(events.map((e) => [e.id, e]));
  const readableMessage = (id) => {
    if (!messagingEnabled) return false;
    const c = byContext.get(id);
    return Boolean(
      c?.shift_id &&
      (u.role === "supervisor" ||
        (u.role === "guard" &&
          c.guard_id === u.id &&
          shifts.some(
            (s) => s.id === c.shift_id && s.user_id === u.id && !s.ended_at,
          ))),
    );
  };
  const readableNotification = (n) => {
    const e = byEvent.get(n.event_id);
    return e && (e.kind !== "message" || readableMessage(e.id));
  };
  const displayMedia = (m) => ({
    id: m.id,
    mime: m.mime,
    source: m.source,
    size: m.size,
  });
  const classifications=await scoped('incident_classifications');
  res.json({
    propertyLocations: await scoped('property_locations'),
    locationReviews: u.role==='guard'?[]:await all('SELECT r.*,u.name AS actor_name FROM location_reviews r JOIN users u ON u.id=r.actor JOIN assignments a ON a.site_id=r.site_id WHERE a.user_id=?',u.id),
    user: u,
    features: { messaging: messagingEnabled },
    sites: sites.map((s) => ({
      ...s,
      ...(u.role !== "guard"
        ? {
            guard_ids: names
              .filter((n) => n.site_id === s.id && n.role === "guard" && !n.disabled)
              .map((n) => n.id),
          }
        : {}),
      instruction_audio: (() => {
        const latest = instructions.find((v) => v.site_id === s.id);
        return latest?.path ? latest.id : null;
      })(),
    })),
    shiftPlans: u.role === "guard" ? sites.flatMap(s=>effectivePlans(shiftPlans.filter(p=>p.site_id===s.id)).filter(p=>p.guard_id===u.id||p.any_guard).map(p=>p.template_id?{...p,guard_ids:JSON.stringify(p.any_guard?["*"]:[u.id])}:p)) : shiftPlans,
    siteLocations,
    checkpoints,
    shifts: shifts.filter((s) => u.role !== "guard" || s.user_id === u.id),
    events: events
      .filter((e) =>
        e.kind === "message"
          ? readableMessage(e.id)
          : u.role !== "guard" || e.user_id === u.id || e.kind === "end",
      )
      .map((e) => ({
        ...e,
        payload: {
          ...JSON.parse(e.payload),
          ...(e.kind === "message"
            ? {
                guard_id: byContext.get(e.id).guard_id,
                shift_id: byContext.get(e.id).shift_id,
              }
            : {}),
        },
        ...(e.kind === "message"
          ? {
              sender_name: names.find((n) => n.id === e.user_id)?.name || "",
              media: messageMedia
                .filter((m) => m.event_id === e.id)
                .map(displayMedia),
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
        classification: classifications.find(c=>c.incident_id===i.id)||null,
        media: media.filter((m) => m.incident_id === i.id).map(displayMedia),
        history: history.filter((h) => h.incident_id === i.id),
        revisions: revisions.filter((r) => r.incident_id === i.id),
      })),
    summaries: summaries.filter(
      (s) => u.role === "supervisor" || s.status === "Approved",
    ),
    notifications: notifications.filter(
      (n) => n.recipient === u.id && readableNotification(n),
    ),
    sentNotifications: notifications.filter(
      (n) =>
        byEvent.get(n.event_id)?.user_id === u.id && readableNotification(n),
    ),
    users:
      u.role !== "guard"
        ? [
            ...new Map(
              names.map((n) => [
                n.id,
                { id: n.id, name: n.name, role: n.role, photo_id: n.photo_id },
              ]),
            ).values(),
          ]
        : [],
    ai: process.env.OPENAI_API_KEY ? "live" : "unavailable",
  });
});
const text = (x, max = 5000) =>
  String(x || "")
    .trim()
    .slice(0, max);
post("/api/events", async (req, res) => {
  let u = req.user,
    b = req.body;
  if (b.kind === "message" && !messagingEnabled)
    fail("In-app messaging is not available in this MVP", 403);
  await requireSite(u, b.site_id);
  if (u.role !== "guard" && !(u.role === "supervisor" && b.kind === "message"))
    fail("Guard only", 403);
  if (!/^[a-zA-Z0-9-]{8,80}$/.test(b.id || "")) fail("Invalid record ID");
  let previous = await one("SELECT * FROM events WHERE id=?", b.id);
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
      !(await one(
        "SELECT 1 FROM assignments a JOIN users u ON u.id=a.user_id WHERE a.site_id=? AND u.id=? AND u.role='guard'",
        b.site_id,
        guardId || "",
      ))
    )
      fail("Choose an assigned guard", 403);
    const shiftId = p.shift_id;
    if (!shiftId) fail("Start a shift before messaging", 403);
    if (shiftId) {
      const target = await one("SELECT * FROM shifts WHERE id=?", shiftId);
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
    (
      await one(
        "SELECT count(*) AS n FROM events WHERE user_id=? AND received_at>?",
        u.id,
        new Date(Date.now() - 86400000).toISOString(),
      )
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
  if (["scan", "start", "sign_in_location"].includes(b.kind)) {
    const ref = await one(
      "SELECT * FROM site_locations WHERE site_id=?",
      b.site_id,
    );
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
  if(['start','scan'].includes(b.kind)) {
    const reference=await one('SELECT * FROM property_locations WHERE site_id=? AND created_at<=? ORDER BY created_at DESC,id DESC LIMIT 1',b.site_id,b.captured_at);
    p.location_assessment=assessLocation(p.location,reference);
  } else delete p.location_assessment;
  try {
    if (["incident", "alert", "note", "patrol_start"].includes(b.kind)) {
      const duty = await one(
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
      const duty = await one(
        "SELECT * FROM shifts WHERE id=? AND user_id=? AND site_id=?",
        p.shift_id,
        u.id,
        b.site_id,
      );
      const records = (
        await all(
          "SELECT * FROM events WHERE site_id=? AND user_id=?",
          b.site_id,
          u.id,
        )
      ).map((e) => ({ ...e, payload: JSON.parse(e.payload) }));
      const previousStarts = records.filter(
        (e) => e.kind === "patrol_start" && e.payload.shift_id === duty.id,
      );
      const required = records.find(e=>e.id===duty.id)?.payload.checkpoint_ids?.length ?? (await all("SELECT id FROM checkpoints WHERE site_id=? AND id NOT IN (SELECT checkpoint_id FROM retired_checkpoints)",b.site_id)).length;
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
        (await one("SELECT schedule FROM sites WHERE id=?", b.site_id))
          .schedule,
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
      const plans = [...await all("SELECT * FROM shift_plans WHERE site_id=?",b.site_id),...await all("SELECT * FROM shift_templates WHERE site_id=?",b.site_id)];
      const plan = p.shift_plan_version_id ? plans.find(v=>v.id===p.shift_plan_version_id && v.template_id && JSON.parse(v.guard_ids).some(g=>g===u.id||g==="*")) : currentPlan(plans,u.id,b.site_id,at);
      if(p.shift_plan_version_id && !plan) fail("Invalid shift settings version",403);
      p.checkpoint_ids = (await all("SELECT id FROM checkpoints WHERE site_id=? AND id NOT IN (SELECT checkpoint_id FROM retired_checkpoints)", b.site_id)).map(c => c.id);
      p.patrol_schedule = (
        await one("SELECT schedule FROM sites WHERE id=?", b.site_id)
      ).schedule;
      if (plan?.template_id) {p.patrol_schedule=plan.schedule;p.shift_template_id=plan.template_id;p.shift_plan_version_id=plan.id;}
      const latestInstruction = await one(
        "SELECT id,path FROM instruction_versions WHERE site_id=? ORDER BY created_at DESC, id DESC LIMIT 1",
        b.site_id,
      );
      p.instruction_audio = plan?.instruction_audio || (latestInstruction?.path
        ? latestInstruction.id
        : null);
      p.instructions = (
        await one("SELECT instructions FROM sites WHERE id=?", b.site_id)
      ).instructions;
      if (plan?.instructions) p.instructions = [p.instructions,plan.instructions].filter(Boolean).join("\n\n");
      if (
        await one(
          "SELECT id FROM shifts WHERE user_id=? AND ended_at IS NULL",
          u.id,
        )
      )
        fail("You already have an active shift", 409);
      p.scheduled_end_at = scheduledEnd(
        b.captured_at,
        plan ? [{...plan,created_at:"1970-01-01T00:00:00.000Z"}] : plans,
        u.id,
        b.site_id,
      );
      await run(
        "INSERT INTO shifts VALUES(?,?,?,?,NULL)",
        b.id,
        b.site_id,
        u.id,
        b.captured_at,
      );
    }
    if (["end", "scan"].includes(b.kind)) {
      let shift = await one(
        "SELECT * FROM shifts WHERE id=? AND user_id=? AND site_id=? AND ended_at IS NULL",
        p.shift_id || "",
        u.id,
        b.site_id,
      );
      if (!shift) fail("Start a shift first");
      if (b.kind === "end") {
        const records = (
          await all(
            "SELECT * FROM events WHERE site_id=? AND user_id=?",
            b.site_id,
            u.id,
          )
        ).map((e) => ({ ...e, payload: JSON.parse(e.payload) }));
        const entry = records.find(
          (e) => e.kind === "start" && e.id === shift.id,
        );
        const schedule = shiftPatrols(
          entry?.payload.patrol_schedule ??
            (await one("SELECT schedule FROM sites WHERE id=?", b.site_id))
              .schedule,
          shift,
          entry?.payload.scheduled_end_at,
        );
        const checkpoints = entry?.payload.checkpoint_ids?.length ?? (await all("SELECT id FROM checkpoints WHERE site_id=? AND id NOT IN (SELECT checkpoint_id FROM retired_checkpoints)", b.site_id)).length;
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
        await run(
          "UPDATE shifts SET ended_at=? WHERE id=?",
          b.captured_at,
          shift.id,
        );
      } else {
        let cp = await one(
          "SELECT * FROM checkpoints WHERE site_id=? AND code=?",
          b.site_id,
          p.code || "",
        );
        if (!cp) fail("Unknown checkpoint");
        const retired=await one("SELECT at FROM retired_checkpoints WHERE checkpoint_id=?",cp.id);
        if(retired) {
          const start=await one("SELECT payload,captured_at FROM events WHERE id=? AND kind='start'",p.shift_id);
          if(!start || !(JSON.parse(start.payload).checkpoint_ids?.includes(cp.id) ?? (start.captured_at<retired.at))) fail("This checkpoint is no longer on this shift’s route",409);
        }
        if (!p.round_id || !p.slot) fail("Select a scheduled round");
        const patrol = await one(
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
          await one(
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
      await run(
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
      await run(
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
        await run(
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
    await run(
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
      await run(
        "INSERT INTO message_context VALUES(?,?,?)",
        b.id,
        p.guard_id,
        p.shift_id,
      );
    await run("UPDATE sites SET last_sync=? WHERE id=?", at, b.site_id);
    if (["incident", "alert", "message"].includes(b.kind))
      for (let s of b.kind === "message" && u.role === "supervisor"
        ? [{ id: p.guard_id }]
        : await all(
            "SELECT u.id FROM users u JOIN assignments a ON a.user_id=u.id WHERE a.site_id=? AND u.role='supervisor'",
            b.site_id,
          ))
        await run(
          "INSERT INTO notifications(id,site_id,event_id,recipient) VALUES(?,?,?,?)",
          id(),
          b.site_id,
          b.id,
          s.id,
        );
    res.json({ ok: true, id: b.id, received_at: at });
  } catch (e) {
    throw e;
  }
});
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: maxUploadBytes, files: 1 },
});
const mediaIncident = async (u, i) => {
  let inc = await one("SELECT * FROM incidents WHERE id=?", i);
  if (!inc) fail("Not found", 404);
  await requireSite(u, inc.site_id);
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
const mediaTarget = async (u, target, uploading = false) => {
  const event = await one(
    "SELECT * FROM events WHERE id=? AND kind='message'",
    target,
  );
  if (!event)
    return {
      record: await mediaIncident(u, target),
      table: "media",
      column: "incident_id",
    };
  await requireSite(u, event.site_id);
  if (
    !(
      await one(
        "SELECT shift_id FROM message_context WHERE event_id=?",
        event.id,
      )
    )?.shift_id
  )
    fail("Messages require a shift", 403);
  if (
    u.role !== "supervisor" &&
    !(
      u.role === "guard" &&
      (
        await one(
          "SELECT guard_id FROM message_context WHERE event_id=?",
          event.id,
        )
      )?.guard_id === u.id
    )
  )
    fail("Private supervisor message", 403);
  if (!uploading && !(await canReadMessage(u, event.id)))
    fail("Only your current shift conversation is available", 403);
  return { record: event, table: "message_media", column: "event_id" };
};
const findMedia = async (id) =>
  (await one("SELECT *,incident_id AS target FROM media WHERE id=?", id)) ||
  (await one("SELECT *,event_id AS target FROM message_media WHERE id=?", id));
post("/api/media/:incident/:id", upload.single("file"), async (req, res) => {
  const { record, table, column } = await mediaTarget(
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
  const prev = await findMedia(req.params.id);
  if (prev) {
    if (prev.target !== req.params.incident) fail("Conflict", 409);
    return res.json({ ok: true, duplicate: true });
  }
  validateFile(req.file);
  const used =
    (
      await one(
        "SELECT COALESCE(sum(size),0) n FROM media m JOIN incidents i ON i.id=m.incident_id WHERE i.site_id=?",
        record.site_id,
      )
    ).n +
    (
      await one(
        "SELECT COALESCE(sum(size),0) n FROM message_media m JOIN events e ON e.id=m.event_id WHERE e.site_id=?",
        record.site_id,
      )
    ).n;
  if (used + req.file.size > 1073741824)
    fail("Site pilot media quota reached (1 GB)", 429);
  if (
    (await one(`SELECT count(*) n FROM ${table} WHERE ${column}=?`, record.id))
      .n >= (table === "message_media" ? 5 : 6)
  )
    fail("Attachment limit reached");
  const file = await saveMedia(
    req.params.id,
    req.file.buffer,
    req.file.mimetype,
  );
  await run(
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
if (process.env.VERCEL && !process.env.MEDIA_SIGNING_SECRET)
  throw new Error("MEDIA_SIGNING_SECRET is required");
const signing = process.env.MEDIA_SIGNING_SECRET || randomBytes(32);
const sign = (s) => createHmac("sha256", signing).update(s).digest("hex");
app.get("/api/media/:id/link", async (req, res) => {
  let m = await findMedia(req.params.id);
  if (!m) fail("Not found", 404);
  await mediaTarget(req.user, m.target);
  let expires = Date.now() + 120000,
    s = `${m.id}:${req.user.id}:${expires}`;
  res.json({ url: `/media/${m.id}?expires=${expires}&sig=${sign(s)}` });
});
app.get("/media/:id", async (req, res) => {
  let m = await findMedia(req.params.id);
  if (!m) fail("Not found", 404);
  await mediaTarget(req.user, m.target);
  let s = `${m.id}:${req.user.id}:${req.query.expires}`;
  if (Number(req.query.expires) < Date.now() || req.query.sig !== sign(s))
    fail("Link expired", 403);
  await serveMedia(req, res, m);
});
post("/api/instructions/:site", upload.single("file"), async (req, res) => {
  await requireSite(req.user, req.params.site);
  if (!["owner", "supervisor"].includes(req.user.role))
    fail("Owner or supervisor only", 403);
  const content = text(req.body.instructions);
  let source = null;
  if (req.body.keep_audio) {
    source = await one(
      "SELECT * FROM instruction_versions WHERE id=? AND site_id=?",
      req.body.keep_audio,
      req.params.site,
    );
    if (!source) fail("Recording not found", 404);
  }
  if (req.file) {
    validateFile(req.file);
    if (!req.file.mimetype.startsWith("audio/")) fail("Use an audio recording");
    if (req.file.size > maxUploadBytes)
      fail("Recording limit is 4 MB", 413);
  }
  if (!content && !req.file && !source?.path)
    fail("Add a recording or typed instructions");
  if (
    (
      await one(
        "SELECT COALESCE(sum(size),0) n FROM instruction_versions WHERE site_id=?",
        req.params.site,
      )
    ).n +
      (req.file?.size || 0) >
    100 * 1024 * 1024
  )
    fail("Instruction storage limit reached (100 MB)", 429);
  const version = id(),
    file = req.file
      ? await saveMedia(version, req.file.buffer, req.file.mimetype)
      : source?.path || null;
  await run(
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
  await run(
    "UPDATE sites SET instructions=? WHERE id=?",
    content,
    req.params.site,
  );
  await audit(req.user, "instructions.published", {
    site_id: req.params.site,
    version,
  });
  res.json({ id: version });
});
post("/api/settings/:site/shift-audio", upload.single("file"), async (req, res) => {
  await requireSite(req.user, req.params.site);
  if (!["owner", "supervisor"].includes(req.user.role))
    fail("Owner or supervisor only", 403);
  if (!req.file) fail("Record voice instructions first");
  validateFile(req.file);
  if (!req.file.mimetype.startsWith("audio/")) fail("Use an audio recording");
  if (
    (
      await one(
        "SELECT COALESCE(sum(size),0) n FROM instruction_versions WHERE site_id=?",
        req.params.site,
      )
    ).n +
      req.file.size >
    100 * 1024 * 1024
  )
    fail("Instruction storage limit reached (100 MB)", 429);
  const version = id();
  const file = await saveMedia(version, req.file.buffer, req.file.mimetype);
  await run(
    "INSERT INTO instruction_versions VALUES(?,?,?,?,?,?,?,?)",
    version,
    req.params.site,
    req.user.id,
    now(),
    "",
    req.file.mimetype,
    file,
    req.file.size,
  );
  await audit(req.user, "shift_instruction_audio.uploaded", {
    site_id: req.params.site,
    version,
  });
  res.json({ id: version });
});
app.get("/api/instructions/:id/link", async (req, res) => {
  const m = await one(
    "SELECT * FROM instruction_versions WHERE id=?",
    req.params.id,
  );
  if (!m) fail("Not found", 404);
  await requireSite(req.user, m.site_id);
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
app.get("/media/instructions/:id", async (req, res) => {
  const m = await one(
    "SELECT * FROM instruction_versions WHERE id=?",
    req.params.id,
  );
  if (!m?.path) fail("Not found", 404);
  await requireSite(req.user, m.site_id);
  if (
    Number(req.query.expires) < Date.now() ||
    req.query.sig !== sign(m.id + ":" + req.user.id + ":" + req.query.expires)
  )
    fail("Link expired", 403);
  await serveMedia(req, res, m);
});
post("/api/ai", upload.single("file"), async (req, res) => {
  if (req.user.role !== "guard") fail("Guard only", 403);
  if (!process.env.OPENAI_API_KEY)
    fail(
      "AI is not configured. Type your observation. No transcript was generated.",
      503,
    );
  validateFile(req.file);
  if (!req.file.mimetype.startsWith("audio/")) fail("Audio required");
  try {
    res.json(await transcribeAndDraft(req.file));
  } catch (e) {
    fail(e.message, 503);
  }
});
post("/api/incidents/:id/resolve", async (req, res) => {
  if(!['owner','supervisor'].includes(req.user.role)) fail('Supervisor or owner only',403);
  await transaction(async () => {
    const incident = await mediaIncident(req.user, req.params.id);
    if (incident.status === "Resolved") return;
    let classification;
    try {classification=classificationInput(req.body);}catch(e){fail(e.message);}
    const changed = await run("UPDATE incidents SET status='Resolved' WHERE id=? AND status<>'Resolved'", incident.id);
    if (!changed) return;
    const note = text(req.body.note, 5000);
    await run('INSERT INTO incident_classifications VALUES(?,?,?,?,?,?)',incident.id,incident.site_id,classification.category,classification.priority,req.user.id,now());
    await run("INSERT INTO transitions VALUES(?,?,?,?,?,?)", id(), incident.id, req.user.id, now(), "Resolved", note);
    await audit(req.user, "problem resolved", {incident_id:incident.id,note,actor_role:req.user.role,...classification});
  });
  res.json({ok:true});
});
post("/api/incidents/:id/transition", async (req, res) => {
  supervisor(req.user);
  let i = await mediaIncident(req.user, req.params.id),
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
  let classification;
  if(b.status==='Resolved') {
    try {classification=classificationInput(b);}catch(e){fail(e.message);}
  }
  try {
    if(classification)await run('INSERT INTO incident_classifications VALUES(?,?,?,?,?,?)',i.id,i.site_id,classification.category,classification.priority,req.user.id,now());
    await run(
      "UPDATE incidents SET status=?,responsible=?,next_action=? WHERE id=?",
      b.status,
      text(b.responsible) || i.responsible,
      text(b.next_action) || i.next_action,
      i.id,
    );
    await run(
      "INSERT INTO transitions VALUES(?,?,?,?,?,?)",
      id(),
      i.id,
      req.user.id,
      now(),
      b.status,
      text(b.note),
    );
    await audit(req.user, "incident transition", b);
  } catch (e) {
    throw e;
  }
  res.json({ ok: true });
});
post("/api/notifications/:id/:action", async (req, res) => {
  let n = await one(
    "SELECT * FROM notifications WHERE id=? AND recipient=?",
    req.params.id,
    req.user.id,
  );
  if (!n) fail("Not found", 404);
  if (req.params.action === "delivered")
    await run(
      "UPDATE notifications SET status=CASE WHEN acknowledged_at IS NULL THEN 'delivered' ELSE status END,delivered_at=COALESCE(delivered_at,?),attempts=attempts+1 WHERE id=?",
      now(),
      n.id,
    );
  else if (req.params.action === "acknowledge")
    await run(
      "UPDATE notifications SET status='acknowledged',acknowledged_at=? WHERE id=?",
      now(),
      n.id,
    );
  else fail("Invalid action");
  res.json({ ok: true });
});
async function counts(site, day) {
  let e = await all(
      "SELECT * FROM events WHERE site_id=? AND substr(captured_at,1,10)=?",
      site,
      day,
    ),
    cps = await all("SELECT id FROM checkpoints WHERE site_id=?", site),
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
    scheduledRounds: (
      await one("SELECT schedule FROM sites WHERE id=?", site)
    ).schedule
      .split(",")
      .filter(Boolean).length,
    incidents: (
      await all(
        "SELECT id FROM incidents WHERE site_id=? AND substr(captured_at,1,10)=?",
        site,
        day,
      )
    ).length,
    sourceIds: [
      ...e.filter((x) => x.kind !== "message").map((x) => x.id),
      ...(
        await all(
          "SELECT id FROM incidents WHERE site_id=? AND substr(captured_at,1,10)=?",
          site,
          day,
        )
      ).map((i) => i.id),
    ],
  };
}
app.get("/api/activity-reports/:site", async (req,res) => {
  if (!["supervisor","owner"].includes(req.user.role)) fail("Supervisor or owner only",403);
  await requireSite(req.user,req.params.site);
  const {from,to}=req.query;
  try { reportWindow(from,to); } catch(e) { fail(e.message); }
  const siteId=req.params.site;
  const [site,events,incidents,resolutions,users,checkpoints,plans]=await Promise.all([
    one("SELECT * FROM sites WHERE id=?",siteId),
    all("SELECT * FROM events WHERE site_id=?",siteId),
    all("SELECT * FROM incidents WHERE site_id=?",siteId),
    all("SELECT t.* FROM transitions t JOIN incidents i ON i.id=t.incident_id WHERE i.site_id=?",siteId),
    all("SELECT DISTINCT u.id,u.name,u.role FROM users u JOIN assignments a ON a.user_id=u.id WHERE a.site_id=?",siteId),
    all("SELECT c.id,c.name,(SELECT at FROM retired_checkpoints WHERE checkpoint_id=c.id) AS retired_at FROM checkpoints c WHERE site_id=?",siteId),
    Promise.all([all("SELECT * FROM shift_plans WHERE site_id=?",siteId),all("SELECT * FROM shift_templates WHERE site_id=?",siteId)]).then(parts=>parts.flat()),
  ]);
  res.json(activityReport({from,to,site,events,incidents,resolutions,users,checkpoints,plans}));
});
app.get("/api/summary/:site/:day", async (req, res) => {
  await requireSite(req.user, req.params.site);
  res.json(await counts(req.params.site, req.params.day));
});
post("/api/summary/:site/:day", async (req, res) => {
  supervisor(req.user);
  await requireSite(req.user, req.params.site);
  let c = await counts(req.params.site, req.params.day),
    n = `${c.shiftStarts} shift starts, ${c.completeRounds} complete rounds and ${c.incidents} incidents recorded. New records may be pending.`,
    sid = id();
  let draft = await draftSummary(
    c,
    await all(
      "SELECT report,event_time,status,next_action FROM incidents WHERE site_id=? AND substr(captured_at,1,10)=?",
      req.params.site,
      req.params.day,
    ),
  );
  n = draft.narrative;
  await run(
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
post("/api/summaries/:id/approve", async (req, res) => {
  supervisor(req.user);
  let s = await one("SELECT * FROM summaries WHERE id=?", req.params.id);
  if (!s) fail("Not found", 404);
  await requireSite(req.user, s.site_id);
  if (s.status === "Approved") fail("Already approved", 409);
  let current = await counts(s.site_id, s.day);
  if (JSON.stringify(current) !== s.counts)
    fail("Source records changed. Generate a fresh draft", 409);
  await run(
    "UPDATE summaries SET status='Approved',narrative=?,actor=?,at=? WHERE id=?",
    text(req.body.narrative) || s.narrative,
    req.user.id,
    now(),
    s.id,
  );
  await audit(req.user, "summary approved", { id: s.id });
  res.json({ ok: true });
});
post("/api/site-location", async (req, res) => {
  if (req.user.role!=='owner') fail("Owner only",403);
  await requireSite(req.user, req.body.site_id);
  const property=propertyInput(req.body);
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
  await run(
    "INSERT INTO site_locations VALUES(?,?,?,?) ON CONFLICT(site_id) DO UPDATE SET latitude=excluded.latitude,longitude=excluded.longitude,radius_m=excluded.radius_m",
    site_id,
    latitude,
    longitude,
    radius,
  );
  await run('INSERT INTO property_locations VALUES(?,?,?,?,?,?,?,?)',id(),site_id,property.address,latitude,longitude,radius,req.user.id,now());
  await audit(req.user, "site location updated", {
    address:property.address,
    site_id,
    latitude,
    longitude,
    radius,
  });
  res.json({ ok: true });
});
post('/api/location-review',async(req,res)=>{
  if(!['supervisor','owner'].includes(req.user.role))fail('Supervisor or owner only',403);
  const b=req.body;await requireSite(req.user,b.site_id);
  const shift=await one('SELECT * FROM shifts WHERE id=? AND site_id=?',b.shift_id,b.site_id);
  if(!shift)fail('Shift not found',404);
  if(!Array.isArray(b.event_ids)||!b.event_ids.length||b.event_ids.length>2000)fail('Choose the location records to review');
  const ids=[...new Set(b.event_ids)];
  for(const eid of ids){
    const e=await one('SELECT * FROM events WHERE id=? AND site_id=? AND user_id=?',eid,b.site_id,shift.user_id);
    if(!e)fail('Record outside this shift',403);
    const p=JSON.parse(e.payload);
    if(!((e.kind==='start'&&e.id===shift.id)||(e.kind==='scan'&&p.shift_id===shift.id))||!['outside','unconfirmed'].includes(p.location_assessment?.status))fail('Invalid location exception');
  }
  await run('INSERT INTO location_reviews VALUES(?,?,?,?,?,?,?,?)',id(),b.site_id,shift.user_id,shift.id,JSON.stringify(ids),req.user.id,now(),text(b.comment,3000));
  await audit(req.user,'location.reviewed',{site:b.site_id,shift:shift.id,event_ids:ids});res.json({ok:true});
});
post("/api/patrol-schedule", async (req, res) => {
  if (!["owner", "supervisor"].includes(req.user.role))
    fail("Owner or supervisor only", 403);
  await requireSite(req.user, req.body.site_id);
  let schedule;
  try {
    schedule = patrolSchedule(req.body);
  } catch (e) {
    fail(e.message);
  }
  const previous = (
    await one("SELECT schedule FROM sites WHERE id=?", req.body.site_id)
  ).schedule;
  await run(
    "UPDATE sites SET schedule=? WHERE id=?",
    schedule,
    req.body.site_id,
  );
  await audit(req.user, "patrol schedule updated", {
    site_id: req.body.site_id,
    previous,
    schedule,
  });
  res.json({ ok: true, schedule });
});
async function teamContact(b,userId,previous) {
  const email=String(b.email||'').trim().toLowerCase();
  const prior=previous && await one('SELECT * FROM user_contacts WHERE user_id=?',userId);
  const raw=b.whatsapp===undefined ? prior?.whatsapp || '' : String(b.whatsapp).trim();
  const phone=raw?phoneNumber(raw):null;
  if(!String(b.name||'').trim() || (email && (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)||email.endsWith('@no-email.invalid'))) || (raw&&!phone) || (!email&&!phone)) fail('Enter a name and a valid email or WhatsApp number');
  const duplicate=await one('SELECT user_id FROM user_contacts WHERE whatsapp=? AND user_id<>?',phone,userId);
  if(duplicate) fail('This WhatsApp number is already used by an account',409);
  return {email:email||userId+'@no-email.invalid',phone,vaultKey:prior?.vault_key||previous?.email||'user:'+userId,missing:email?0:1};
}
async function saveTeamContact(userId,contact) {
  await run('INSERT INTO user_contacts VALUES(?,?,?,?) ON CONFLICT(user_id) DO UPDATE SET whatsapp=excluded.whatsapp,email_missing=excluded.email_missing',userId,contact.phone,contact.vaultKey,contact.missing);
}
post("/api/admin", upload.single("profile_photo"), async (req, res) => {
  if (!["owner", "supervisor"].includes(req.user.role))
    fail("Customer management only", 403);
  let b = req.body,
    s = b.site_id;
  if (b.kind === "customer")
    fail("Customer onboarding is not available here", 403);
  if (b.kind === "additional_site" && req.user.role !== "owner")
    fail("Owner only", 403);
  if (
    b.kind === "user" &&
    !["supervisor","guard"].includes(b.role)
  )
    fail("Only guards and supervisors can be managed here", 403);
  if (b.kind === "additional_site") {
    const property=propertyInput(b);
    let customer = await one(
      "SELECT customer_id FROM sites WHERE id=?",
      b.site_id,
    );
    await requireSite(req.user, b.site_id);
    let sid = id();
    await run(
      "INSERT INTO sites(id,customer_id,name) VALUES(?,?,?)",
      sid,
      customer.customer_id,
      text(b.name, 120),
    );
    await run("INSERT INTO assignments VALUES(?,?)", req.user.id, sid);
    await run('INSERT INTO site_locations VALUES(?,?,?,?)',sid,property.latitude,property.longitude,property.radius_m);
    await run('INSERT INTO property_locations VALUES(?,?,?,?,?,?,?,?)',id(),sid,property.address,property.latitude,property.longitude,property.radius_m,req.user.id,now());
  } else {
    await requireSite(req.user, s);
    if (b.kind === "shift_plan") {
      if (
        !(await one(
          "SELECT 1 FROM assignments a JOIN users u ON a.user_id=u.id WHERE a.site_id=? AND u.id=? AND u.role='guard'",
          s,
          b.guard_id,
        ))
      )
        fail("Choose an assigned guard");
      if (
        !/^([01][0-9]|2[0-3]):[0-5][0-9]$/.test(b.start_time) ||
        !/^([01][0-9]|2[0-3]):[0-5][0-9]$/.test(b.end_time)
      )
        fail("Use valid shift times");
      await run(
        "INSERT INTO shift_plans VALUES(?,?,?,?,?,?,?)",
        id(),
        s,
        b.guard_id,
        b.start_time,
        b.end_time,
        req.user.id,
        now(),
      );
    } else if (b.kind === "update_user") {
      const target = await one("SELECT u.* FROM users u JOIN assignments a ON a.user_id=u.id WHERE u.id=? AND a.site_id=?",b.user_id,s);
      if(!target || target.role === "owner" || !["guard","supervisor"].includes(b.role)) fail("Only assigned guards and supervisors can be managed",403);
      if(target.id===req.user.id && (b.disabled === "true" || b.role!==target.role)) fail("You cannot deactivate yourself or change your own role",403);
      const contact=await teamContact(b,target.id,target);
      if(b.password && b.password.length<12) fail("Use a password of at least 12 characters");
      if(req.file) {
        if(!["image/jpeg","image/png"].includes(req.file.mimetype)||req.file.size>2*1024*1024) fail("Profile photos must be JPEG or PNG, up to 2 MB");
        validateFile(req.file);
      }
      if((b.disabled === "true" || b.role !== target.role) && await one("SELECT 1 FROM shifts WHERE user_id=? AND ended_at IS NULL",target.id)) fail("End this guard’s active shift before deactivating or changing their role",409);
      await run("UPDATE users SET name=?,email=?,role=?,password=? WHERE id=?",text(b.name,120),contact.email,b.role,b.password?hash(b.password):target.password,target.id);
      await saveTeamContact(target.id,contact);
      if(b.disabled === "true") await run("INSERT INTO disabled_users VALUES(?,?,?) ON CONFLICT(user_id) DO UPDATE SET actor=excluded.actor,at=excluded.at",target.id,req.user.id,now());
      else await run("DELETE FROM disabled_users WHERE user_id=?",target.id);
      if(b.disabled === "true" || b.password || b.role !== target.role) await run("DELETE FROM sessions WHERE user_id=?",target.id);
      if(b.disabled === "true" || b.role !== "guard") {
        const assignedSites=await all("SELECT site_id FROM assignments WHERE user_id=?",target.id);
        for(const assigned of assignedSites) {
          const versions=await all("SELECT * FROM shift_templates WHERE site_id=? ORDER BY created_at",assigned.site_id);
          const latest=new Map(versions.map(p=>[p.template_id,p]));
          if(!latest.size && target.role === "guard") {
            const legacy=effectivePlans(await all("SELECT * FROM shift_plans WHERE site_id=?",assigned.site_id));
            const siteRow=await one("SELECT schedule FROM sites WHERE id=?",assigned.site_id);
            for(const p of legacy) {
              const key="legacy-"+p.start_time+"-"+p.end_time;
              if(!latest.has(key)) latest.set(key,{template_id:key,site_id:assigned.site_id,name:"Shift "+(latest.size+1),start_time:p.start_time,end_time:p.end_time,instructions:"",instruction_audio:null,schedule:siteRow.schedule,guard_ids:"[]",legacy:true});
              const entry=latest.get(key),ids=JSON.parse(entry.guard_ids);ids.push(p.guard_id);entry.guard_ids=JSON.stringify(ids);
            }
          }
          for(const p of latest.values()) {
            const guards=JSON.parse(p.guard_ids);
            if(guards.includes(target.id)||p.legacy) {
              const version=id();
              await run("INSERT INTO shift_templates VALUES(?,?,?,?,?,?,?,?,?,?,?)",version,p.template_id,p.site_id,p.name,p.start_time,p.end_time,p.instructions,p.schedule,JSON.stringify(guards.filter(g=>g!==target.id)),req.user.id,now());
              if(p.instruction_audio) await run("INSERT INTO shift_template_audio VALUES(?,?)",version,p.instruction_audio);
            }
          }
        }
      }
      if(req.file) {
        const location=await saveMedia("profiles/"+target.id+"/"+id(),req.file.buffer,req.file.mimetype);
        await run("INSERT INTO user_photos VALUES(?,?,?,?) ON CONFLICT(user_id) DO UPDATE SET path=excluded.path,mime=excluded.mime,created_at=excluded.created_at",target.id,location,req.file.mimetype,now());
      }
      await audit(req.user,"team.updated",{site:s,user_id:target.id,disabled:b.disabled === "true",role:b.role});
    } else if (b.kind === "site") {
      if (
        !/^([01][0-9]|2[0-3]):[0-5][0-9](,([01][0-9]|2[0-3]):[0-5][0-9])*$/.test(
          b.schedule || "",
        )
      )
        fail("Use comma-separated times HH:MM");
      await run(
        "UPDATE sites SET phone=?,schedule=? WHERE id=?",
        text(b.phone, 30),
        text(b.schedule, 2000),
        s,
      );
    } else if (b.kind === "checkpoint")
      await run(
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
      if (req.file) {
        if (!["image/jpeg", "image/png"].includes(req.file.mimetype) || req.file.size > 2 * 1024 * 1024) fail("Profile photos must be JPEG or PNG, up to 2 MB");
        validateFile(req.file);
      }
      let uid = id();
      const contact=await teamContact(b,uid);
      await run(
        "INSERT INTO users VALUES(?,?,?,?,?)",
        uid,
        text(b.name, 120),
        contact.email,
        hash(b.password),
        b.role,
      );
      await run("INSERT INTO assignments VALUES(?,?)", uid, s);
      await saveTeamContact(uid,contact);
      if (req.file) {
        const photoPath = await saveMedia("profiles/" + uid, req.file.buffer, req.file.mimetype);
        await run("INSERT INTO user_photos VALUES(?,?,?,?)", uid, photoPath, req.file.mimetype, now());
      }
    } else if (b.kind === "assign") {
      let user = await one("SELECT id,role FROM users WHERE id=?", b.user_id);
      if (!["supervisor","guard"].includes(user?.role))
        fail("You can only assign team members you manage", 403);
      if (
        !user ||
        !(await one(
          "SELECT 1 FROM assignments a JOIN sites source ON source.id=a.site_id JOIN sites target ON target.customer_id=source.customer_id WHERE target.id=? AND a.user_id=?",
          s,
          user.id,
        ))
      )
        fail("User outside assigned scope", 403);
      await run(
        "INSERT INTO assignments VALUES(?,?) ON CONFLICT DO NOTHING",
        user.id,
        s,
      );
    } else fail("Unknown action");
  }
  await audit(req.user, "admin " + b.kind, { site: s, name: b.name });
  res.json({ ok: true });
});
settingsRoutes({app,post,all,one,run,requireSite,fail,id,now,audit});
app.get("/media/profile/:user", async (req, res) => {
  if (req.user.id !== req.params.user) {
    if (req.user.role === "guard" || !(await one("SELECT 1 FROM assignments a JOIN assignments b ON a.site_id=b.site_id WHERE a.user_id=? AND b.user_id=?", req.user.id, req.params.user))) fail("Photo outside assigned scope", 403);
  }
  const photo = await one("SELECT * FROM user_photos WHERE user_id=?", req.params.user);
  if (!photo) fail("Photo not found", 404);
  res.set("X-Content-Type-Options", "nosniff");
  await serveMedia(req, res, photo);
});
app.get("/api/qr/:site", async (req, res) => {
  if (!["owner", "supervisor"].includes(req.user.role))
    fail("Customer management only", 403);
  await requireSite(req.user, req.params.site);
  res.json(
    await Promise.all(
      await mapAsync(
        await all("SELECT * FROM checkpoints WHERE site_id=? AND id NOT IN (SELECT checkpoint_id FROM retired_checkpoints)", req.params.site),
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
        ? "File exceeds 4 MB"
        : "Request could not be completed",
  });
});
if (!process.env.VERCEL)
  app.listen(
    Number(process.env.PORT || 3000),
    process.env.HOST || "127.0.0.1",
    () =>
      console.log(
        `Guard Companion running at http://${process.env.HOST || "127.0.0.1"}:${process.env.PORT || 3000}`,
      ),
  );
export default app;
