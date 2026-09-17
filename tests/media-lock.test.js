import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { randomUUID } from "node:crypto";
import fs from "node:fs";
import path from "node:path";

const data = path.resolve("data", "media-lock-" + Date.now());
let base = "", server, guard, shiftId;
const incident = (report) => ({
  id: randomUUID(),
  site_id: "oak",
  kind: "incident",
  captured_at: new Date().toISOString(),
  payload: {
    event_time: "Not known",
    report,
    approved: true,
    shift_id: shiftId,
    evidence: { photos: 1 },
  },
});
async function req(route, cookie, body, expected = 200) {
  const response = await fetch(base + route, {
    method: body ? "POST" : "GET",
    headers: {
      ...(cookie ? { cookie, "X-Session-Proof": cookie.split("=")[1] } : {}),
      ...(body && !(body instanceof FormData)
        ? { "Content-Type": "application/json" }
        : {}),
    },
    body: body instanceof FormData ? body : body ? JSON.stringify(body) : undefined,
  });
  const value = await response.json();
  assert.equal(response.status, expected, JSON.stringify(value));
  return value;
}
before(async () => {
  fs.mkdirSync(data, { recursive: true });
  server = spawn(process.execPath, ["server.js"], {
    env: {
      ...process.env,
      PORT: "0",
      DATA_DIR: data,
      DATABASE_URL: "",
      VERCEL: "",
      BLOB_READ_WRITE_TOKEN: "",
      TEST_MEDIA_UPLOAD_DELAY_MS: "900",
      TEST_MEDIA_UPLOAD_FAIL_ONCE: "true",
    },
    stdio: "pipe",
  });
  await new Promise((resolve, reject) => {
    server.stdout.on("data", (chunk) => {
      const match = String(chunk).match(/127\.0\.0\.1:(\d+)/);
      if (match) {
        base = `http://127.0.0.1:${match[1]}`;
        resolve();
      }
    });
    server.on("exit", (code) => reject(new Error("Server exited " + code)));
  });
  const login = await req("/api/login", null, {
    email: "bala@demo.isdl",
    password: "Pilot-only-2026!",
  });
  guard = "session=" + login.proof;
  shiftId = randomUUID();
  await req("/api/events", guard, {
    id: shiftId,
    site_id: "oak",
    kind: "start",
    captured_at: new Date().toISOString(),
    payload: {},
  });
});
after(() => server?.kill());

function photo() {
  const form = new FormData();
  form.append("file", new Blob([Buffer.from("ffd8ffe0", "hex")], { type: "image/jpeg" }), "test.jpg");
  form.append("source", "camera");
  return form;
}
test("a failed upload keeps a retryable reservation and finalizes exactly once", async () => {
  const report = incident("The first storage attempt will fail.");
  const mediaId = randomUUID();
  await req("/api/events", guard, report);
  await req("/api/media/" + report.id + "/" + mediaId, guard, photo(), 503);
  await req("/api/media/" + report.id + "/" + mediaId, guard, photo());
  const duplicate = await req("/api/media/" + report.id + "/" + mediaId, guard, photo());
  assert.equal(duplicate.duplicate, true);
});
test("a delayed media upload does not delay another recorded guard activity", async () => {
  const report = incident("Photo upload is intentionally delayed.");
  await req("/api/events", guard, report);
  const upload = req("/api/media/" + report.id + "/" + randomUUID(), guard, photo());
  await new Promise((resolve) => setTimeout(resolve, 100));
  const started = Date.now();
  await req("/api/events", guard, incident("This report must not wait for the photo."));
  assert.ok(Date.now() - started < 500, "guard activity waited for media upload");
  await upload;
});
