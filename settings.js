import { effectivePlans } from "./public/shift-plans.js";

export function settingsRoutes({
  app,
  post,
  all,
  one,
  run,
  requireSite,
  fail,
  id,
  now,
  audit,
}) {
  const access = async (req) => {
    if (!["owner", "supervisor"].includes(req.user.role))
      fail("Team management only", 403);
    await requireSite(req.user, req.params.site);
  };
  app.get("/api/settings/:site", async (req, res) => {
    await access(req);
    const templates = await all(
      "SELECT t.*,(SELECT instruction_version_id FROM shift_template_audio WHERE shift_template_id=t.id) AS instruction_audio FROM shift_templates t WHERE t.site_id=? ORDER BY t.created_at",
      req.params.site,
    );
    const latest = new Map(templates.map((p) => [p.template_id, p]));
    let shifts = [...latest.values()].map((p) => ({
      ...p,
      guard_ids: JSON.parse(p.guard_ids),
    }));
    if (!shifts.length) {
      const site = await one("SELECT * FROM sites WHERE id=?", req.params.site);
      const plans = effectivePlans(
        await all("SELECT * FROM shift_plans WHERE site_id=?", site.id),
      );
      const groups = new Map();
      for (const p of plans) {
        const key = p.start_time + "-" + p.end_time;
        if (!groups.has(key))
          groups.set(key, {
            template_id: "legacy-" + key,
            name: "Shift " + (groups.size + 1),
            start_time: p.start_time,
            end_time: p.end_time,
            guard_ids: [],
            instructions: "",
            schedule: site.schedule,
          });
        groups.get(key).guard_ids.push(p.guard_id);
      }
      shifts = [...groups.values()];
      if (!shifts.length)
        shifts = [
          {
            template_id: "default",
            name: "Shift 1",
            start_time: "00:00",
            end_time: "00:00",
            instructions: "",
            schedule: site.schedule,
            guard_ids: (
              await all(
                "SELECT u.id FROM users u JOIN assignments a ON a.user_id=u.id WHERE a.site_id=? AND u.role='guard' AND u.id NOT IN (SELECT user_id FROM disabled_users)",
                site.id,
              )
            ).map((u) => u.id),
          },
        ];
    }
    const users = await all(
      "SELECT u.id,u.name,CASE WHEN c.email_missing=1 THEN '' ELSE u.email END AS email,c.whatsapp,u.role,(SELECT user_id FROM disabled_users WHERE user_id=u.id) AS disabled,(SELECT user_id FROM user_photos WHERE user_id=u.id) AS photo_id FROM users u JOIN assignments a ON a.user_id=u.id LEFT JOIN user_contacts c ON c.user_id=u.id WHERE a.site_id=?",
      req.params.site,
    );
    const reusableUsers = req.user.role === 'owner' ? await all(
      "SELECT DISTINCT u.id,u.name,u.role,CASE WHEN c.email_missing=1 THEN '' ELSE u.email END AS email,c.whatsapp,(SELECT user_id FROM user_photos WHERE user_id=u.id) AS photo_id FROM users u JOIN assignments a ON a.user_id=u.id JOIN sites source ON source.id=a.site_id JOIN sites target ON target.customer_id=source.customer_id LEFT JOIN user_contacts c ON c.user_id=u.id WHERE target.id=? AND u.role IN ('guard','supervisor') AND u.id NOT IN (SELECT user_id FROM assignments WHERE site_id=?) ORDER BY u.name",
      req.params.site,req.params.site,
    ) : [];
    res.json({ shifts, users, reusableUsers });
  });
  post("/api/settings/:site/shifts", async (req, res) => {
    await access(req);
    const shifts = req.body.shifts;
    if (!Array.isArray(shifts) || !shifts.length || shifts.length > 12)
      fail("Keep between 1 and 12 shifts");
    const time = /^([01]\d|2[0-3]):[0-5]\d$/;
    const active = await all(
      "SELECT u.id FROM users u JOIN assignments a ON a.user_id=u.id WHERE a.site_id=? AND u.role='guard' AND u.id NOT IN (SELECT user_id FROM disabled_users)",
      req.params.site,
    );
    const seen = new Set();
    for (const s of shifts) {
      if (
        !s.template_id ||
        seen.has(s.template_id) ||
        String(s.template_id).length > 100
      )
        fail("Invalid shift identifier");
      seen.add(s.template_id);
      if (
        !String(s.name || "").trim() ||
        String(s.name).length > 120 ||
        !time.test(s.start_time) ||
        !time.test(s.end_time)
      )
        fail("Enter a shift name and valid times");
      const slots = String(s.schedule || "")
        .split(",")
        .map((t) => t.trim().replace(/^(\d{2})(\d{2})$/, "$1:$2"))
        .filter(Boolean);
      if (
        slots.length > 96 ||
        slots.some((t) => !time.test(t)) ||
        new Set(slots).size !== slots.length
      )
        fail("Use unique patrol times, for example 09:00, 12:00");
      if (
        slots.some(
          (t) =>
            s.start_time !== s.end_time &&
            (s.start_time < s.end_time
              ? t < s.start_time || t >= s.end_time
              : t < s.start_time && t >= s.end_time),
        )
      )
        fail("Patrol times must fall inside this shift");
      s.schedule = slots.join(",");
      if (
        !Array.isArray(s.guard_ids) ||
        new Set(s.guard_ids).size !== s.guard_ids.length ||
        (s.guard_ids.includes("*") ? s.guard_ids.length !== 1 : s.guard_ids.some((g) => !active.some((u) => u.id === g)))
      )
        fail("Choose active guards assigned to this property");
      if (String(s.instructions || "").length > 5000)
        fail("Instructions are too long");
      if (s.instruction_audio) {
        const audio = await one(
          "SELECT id FROM instruction_versions WHERE id=? AND site_id=? AND path IS NOT NULL",
          s.instruction_audio,
          req.params.site,
        );
        if (!audio) fail("Instruction recording not found", 404);
      }
    }
    const existing = await all(
      "SELECT DISTINCT template_id FROM shift_templates WHERE site_id=?",
      req.params.site,
    );
    const minutes = (t) => Number(t.slice(0, 2)) * 60 + Number(t.slice(3));
    const segments = (s) => {
      const a = minutes(s.start_time),
        b = minutes(s.end_time);
      return a === b
        ? [[0, 1440]]
        : a < b
          ? [[a, b]]
          : [
              [a, 1440],
              [0, b],
            ];
    };
    for (let i = 0; i < shifts.length; i++)
      for (let j = i + 1; j < shifts.length; j++) {
        if (
          shifts[i].guard_ids.some((g) => shifts[j].guard_ids.includes(g)) &&
          segments(shifts[i]).some((a) =>
            segments(shifts[j]).some((b) => a[0] < b[1] && b[0] < a[1]),
          )
        )
          fail("A guard cannot be assigned to overlapping shifts");
      }
    if (existing.some((p) => !seen.has(p.template_id)))
      fail("Existing shifts must be retained");
    const at = now();
    for (const s of shifts) {
      const version = id();
      await run(
        "INSERT INTO shift_templates VALUES(?,?,?,?,?,?,?,?,?,?,?)",
        version,
        s.template_id,
        req.params.site,
        s.name.trim(),
        s.start_time,
        s.end_time,
        s.instructions || "",
        s.schedule,
        JSON.stringify(s.guard_ids),
        req.user.id,
        at,
      );
      if (s.instruction_audio)
        await run(
          "INSERT INTO shift_template_audio VALUES(?,?)",
          version,
          s.instruction_audio,
        );
    }
    await audit(req.user, "shifts.updated", {
      site: req.params.site,
      shifts: shifts.map((s) => s.template_id),
    });
    res.json({ ok: true });
  });
  post("/api/settings/:site/checkpoint", async (req, res) => {
    await access(req);
    const c = await one(
      "SELECT * FROM checkpoints WHERE id=? AND site_id=?",
      req.body.id,
      req.params.site,
    );
    if (!c) fail("Checkpoint not found", 404);
    const name = String(req.body.name || "").trim();
    if (!name || name.length > 120) fail("Enter a checkpoint name");
    await run("UPDATE checkpoints SET name=? WHERE id=?", name, c.id);
    await audit(req.user, "checkpoint.updated", {
      site: req.params.site,
      id: c.id,
      name,
    });
    res.json({ ok: true });
  });
  post("/api/settings/:site/checkpoint/delete",async(req,res)=>{
    await access(req);
    const cp=await one("SELECT * FROM checkpoints WHERE id=? AND site_id=?",req.body.id,req.params.site);
    if(!cp) fail("Checkpoint not found",404);
    await run("INSERT INTO retired_checkpoints VALUES(?,?,?) ON CONFLICT DO NOTHING",cp.id,req.user.id,now());
    await audit(req.user,"checkpoint.deleted",{site:req.params.site,id:cp.id,name:cp.name});
    res.json({ok:true});
  });
}
