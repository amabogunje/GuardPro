// Explicitly targeted fictional demo only; never run against real customer data.
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
const base = process.env.HOSTED_TEST_URL;
if (!base) throw Error("Set HOSTED_TEST_URL to the approved fictional demo");
const sessions = {};
async function login(name) {
  const r = await fetch(base + "/api/login", {
    method: "POST",
    headers: { "Content-Type": "application/json", Origin: base },
    body: JSON.stringify({
      email: name + "@demo.isdl",
      password: "Pilot-only-2026!",
    }),
  });
  assert.equal(r.status, 200);
  const body = await r.json();
  sessions[name] = {
    cookie: r.headers.get("set-cookie").split(";")[0],
    proof: body.proof,
  };
  if (base.startsWith("https:"))
    assert.match(r.headers.get("set-cookie"), /Secure/i);
}
async function api(route, user, body, status = 200) {
  const s = sessions[user];
  const r = await fetch(base + route, {
    method: body ? "POST" : "GET",
    headers: {
      Cookie: s.cookie,
      "X-Session-Proof": s.proof,
      Origin: base,
      ...(body && !(body instanceof FormData)
        ? { "Content-Type": "application/json" }
        : {}),
    },
    body:
      body instanceof FormData ? body : body ? JSON.stringify(body) : undefined,
  });
  const result = await r.json();
  assert.equal(r.status, status, JSON.stringify(result));
  return result;
}
const event = (kind, payload = {}) => ({
  id: randomUUID(),
  kind,
  site_id: "oak",
  captured_at: new Date().toISOString(),
  payload,
});
await Promise.all(["bala", "owner", "supervisor", "other"].map(login));
assert.equal((await fetch(base + "/api/state")).status, 401);
for (const s of (await api("/api/state", "bala")).shifts.filter(
  (s) => !s.ended_at,
))
  await api("/api/events", "bala", event("end", { shift_id: s.id }));
const shift = event("start");
await api("/api/events", "bala", shift);
const report = event("incident", {
  shift_id: shift.id,
  event_time: "Demo verification; no real event",
  report:
    "Hosting verification only — synthetic audio and image attachments. No real incident.",
  approved: true,
  transcript: "",
});
const submissions = await Promise.all(
  Array.from({ length: 3 }, () => api("/api/events", "bala", report)),
);
assert.equal(submissions.filter((r) => !r.duplicate).length, 1);
const imageId = randomUUID(),
  audioId = randomUUID();
const png = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aUAAAAABJRU5ErkJggg==",
  "base64",
);
const wav = Buffer.alloc(44 + 1600 * 2);
wav.write("RIFF");
wav.writeUInt32LE(wav.length - 8, 4);
wav.write("WAVEfmt ", 8);
wav.writeUInt32LE(16, 16);
wav.writeUInt16LE(1, 20);
wav.writeUInt16LE(1, 22);
wav.writeUInt32LE(8000, 24);
wav.writeUInt32LE(16000, 28);
wav.writeUInt16LE(2, 32);
wav.writeUInt16LE(16, 34);
wav.write("data", 36);
wav.writeUInt32LE(3200, 40);
for (let i = 0; i < 1600; i++)
  wav.writeInt16LE(
    Math.round(Math.sin((i * 2 * Math.PI * 440) / 8000) * 5000),
    44 + i * 2,
  );
const upload = (id, bytes, mime, status = 200) => {
  const f = new FormData();
  f.append("file", new Blob([bytes], { type: mime }), "fixture");
  f.append("source", "synthetic deployment verification");
  return api("/api/media/" + report.id + "/" + id, "bala", f, status);
};
await upload(imageId, Buffer.from("invalid"), "image/png", 400);
await upload(imageId, png, "image/png");
assert.equal((await upload(imageId, png, "image/png")).duplicate, true);
await upload(audioId, wav, "audio/wav");
const saved = (await api("/api/state", "owner")).incidents.find(
  (i) => i.id === report.id,
);
assert.equal(saved.media.length, 2);
assert.equal(saved.revisions.length, 1);
await api("/api/media/" + imageId + "/link", "other", null, 403);
assert.ok(
  !(await api("/api/state", "other")).incidents.some((i) => i.id === report.id),
);
for (const [id, bytes] of [
  [imageId, png],
  [audioId, wav],
]) {
  const { url } = await api("/api/media/" + id + "/link", "owner");
  const response = await fetch(base + url, {
    headers: { Cookie: sessions.owner.cookie },
  });
  assert.equal(response.status, 200);
  assert.deepEqual(Buffer.from(await response.arrayBuffer()), bytes);
  assert.equal(
    (await fetch(base + url, { headers: { Cookie: sessions.other.cookie } }))
      .status,
    403,
  );
}
for (const status of ["Acknowledged", "Assigned", "Resolved"])
  await api("/api/incidents/" + report.id + "/transition", "supervisor", {
    status,
    responsible: "ISDL demo verification",
    next_action: "Complete deployment check",
    note: "Synthetic deployment check complete; no real incident.",
  });
const day = new Date().toISOString().slice(0, 10);
const summary = await api("/api/summary/oak/" + day, "supervisor", {});
const counts = await api("/api/summary/oak/" + day, "owner");
assert.deepEqual(summary.counts, counts);
await api("/api/summaries/" + summary.id + "/approve", "supervisor", {
  narrative: summary.narrative,
});
await api("/api/events", "bala", event("end", { shift_id: shift.id }));
await Promise.all(
  Object.keys(sessions).map((name) => api("/api/logout", name, {})),
);
console.log(
  "PASS: hosted authentication, exactly-once report, failed upload retry, private photo/audio bytes, tenant isolation, follow-up and source summary",
);
console.log("Synthetic verification report:", report.id);
