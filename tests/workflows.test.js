import { patrolSchedule, nextPatrol } from "../public/patrol-time.js";
import { scheduledEnd, elapsedShift } from "../public/shift-time.js";
import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { randomUUID } from "node:crypto";
import { chromium } from "@playwright/test";
let base = process.env.TEST_BASE_URL || "";
const data = path.resolve("data", "test-" + Date.now());
let server, guard, owner, supervisor, other, incident, mid, shift;
async function req(route, cookie, body, expected = 200) {
  let r = await fetch(base + route, {
    method: body ? "POST" : "GET",
    headers: {
      ...(cookie ? { cookie, "X-Session-Proof": cookie.split("=")[1] } : {}),
      ...(body && !(body instanceof FormData)
        ? { "Content-Type": "application/json" }
        : {}),
    },
    body:
      body instanceof FormData ? body : body ? JSON.stringify(body) : undefined,
  });
  let j = await r.json();
  assert.equal(r.status, expected, JSON.stringify(j));
  return j;
}
async function login(name) {
  let r = await fetch(base + "/api/login", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      email: name + "@demo.isdl",
      password: "Pilot-only-2026!",
    }),
  });
  assert.equal(r.status, 200);
  return r.headers.get("set-cookie").split(";")[0];
}
const event = (kind, payload = {}, site_id = "oak") => ({
  id: randomUUID(),
  kind,
  site_id,
  captured_at: new Date().toISOString(),
  payload,
});
async function approveDialog(p) {
  await p.locator("[data-confirm=accept]").click();
}
async function waitRecords(predicate) {
  const deadline = Date.now() + 15000;
  do {
    const state = await req("/api/state", owner);
    if (predicate(state)) return state;
    await new Promise((r) => setTimeout(r, 100));
  } while (Date.now() < deadline);
  assert.fail("Expected records were not received");
}
before(async () => {
  fs.mkdirSync(data, { recursive: true });
  if (!process.env.TEST_BASE_URL) {
    server = spawn(process.execPath, ["server.js"], {
      env: {
        ...process.env,
        // An operating-system-selected port prevents an abandoned local test
        // server from being mistaken for this fixture's server.
        PORT: "0",
        DATA_DIR: data,
        OPENAI_API_KEY: "",
        DATABASE_URL: "",
        BLOB_READ_WRITE_TOKEN: "",
        VERCEL: "",
        ENABLE_MESSAGING: "false",
      },
      stdio: "pipe",
    });
    await new Promise((resolve, reject) => {
      server.stdout.on("data", (d) => {
        const match = String(d).match(
          /Guard Companion running at http:\/\/127\.0\.0\.1:(\d+)/,
        );
        if (match) {
          base = `http://127.0.0.1:${match[1]}`;
          resolve();
        }
      });
      server.on("exit", (c) => reject(new Error("Server exited " + c)));
    });
  }
  [guard, owner, supervisor, other] = await Promise.all(
    ["bala", "owner", "supervisor", "other"].map(login),
  );
  // Keep workflow fixtures usable at any wall-clock time, independent of demo patrol hours.
  const shiftTime = new Date(Date.now() + 3600000).toISOString().slice(11, 16);
  await req("/api/admin", supervisor, {
    kind: "shift_plan",
    site_id: "oak",
    guard_id: "bala",
    start_time: shiftTime,
    end_time: shiftTime,
  });
  await req("/api/patrol-schedule", supervisor, {
    site_id: "oak",
    mode: "interval",
    start: "00:00",
    end: "00:00",
    interval: 5,
  });
});
after(() => server?.kill());
test("cookie alone cannot unlock API after shared-phone sign-out", async () => {
  const r = await fetch(base + "/api/state", { headers: { cookie: guard } });
  assert.equal(r.status, 401);
});
test("service health endpoint exposes no operational or customer detail", async () => {
  const response = await fetch(base + "/api/health");
  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), { status: "ok" });
});
test("authentication, guard scope, duplicate shift, complete scheduled round and end", async () => {
  await req("/api/state", null, null, 401);
  await req("/api/events", guard, event("start", {}, "other"), 403);
  let start = event("start");
  shift = start.id;
  await req("/api/events", guard, start);
  assert.equal((await req("/api/events", guard, start)).duplicate, true);
  await req(
    "/api/events",
    guard,
    event("start", { acknowledged: ["demo-incident"] }),
    409,
  );
  let round = randomUUID();
  const stateBeforePatrol = await req("/api/state", guard);
  const expectedPatrol = nextPatrol(
    stateBeforePatrol.sites[0].schedule,
    stateBeforePatrol.shifts.find((s) => s.id === shift),
    stateBeforePatrol.events,
  );
  const patrol = event("patrol_start", {
    shift_id: shift,
    round_id: round,
    slot: expectedPatrol.slot,
    scheduled_for: expectedPatrol.iso,
  });
  await req("/api/events", guard, patrol);
  assert.equal((await req("/api/events", guard, patrol)).duplicate, true);
  await req("/api/events", other, patrol, 403);
  for (let n = 1; n <= 4; n++)
    await req(
      "/api/events",
      guard,
      event("scan", {
        shift_id: shift,
        round_id: round,
        slot: expectedPatrol.slot,
        code: "OAK-" + n,
        location: null,
      }),
    );
  await req(
    "/api/events",
    guard,
    event("scan", {
      shift_id: shift,
      round_id: round,
      slot: expectedPatrol.slot,
      code: "OAK-1",
    }),
    409,
  );
  await req(
    "/api/events",
    guard,
    event("end", { shift_id: shift, note: "Lock repair pending" }),
  );
  let s = await req(
    "/api/summary/oak/" + new Date().toISOString().slice(0, 10),
    owner,
  );
  assert.equal(s.completeRounds, 1);
  assert.equal(s.checkpointScans, 4);
  assert.equal(s.shiftStarts, 1);
});
test("approved report, recoverable media, tenant isolation and expiring private links", async () => {
  let e = event("incident", {
    report: "Back gate lock damaged. Called supervisor.",
    event_time: "Around nine",
    transcript: "Back gate lock damaged. Called supervisor.",
    approved: true,
  });
  e.payload.shift_id = shift;
  e.captured_at = (await req("/api/state", guard)).shifts.find(
    (s) => s.id === shift,
  ).started_at;
  incident = e.id;
  await req("/api/events", guard, e);
  await req("/api/events", guard, e);
  mid = randomUUID();
  let invalid = new FormData();
  invalid.append("file", new Blob(["bad"], { type: "image/png" }), "bad.png");
  await req(`/api/media/${incident}/${mid}`, guard, invalid, 400);
  let f = new FormData();
  f.append(
    "file",
    new Blob(
      [
        Buffer.from(
          "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aUAAAAABJRU5ErkJggg==",
          "base64",
        ),
      ],
      { type: "image/png" },
    ),
    "photo.png",
  );
  f.append("source", "photo library");
  await req(`/api/media/${incident}/${mid}`, guard, f);
  await req(`/api/media/${incident}/${mid}`, guard, f);
  let s = await req("/api/state", owner);
  assert.equal(s.incidents.filter((i) => i.id === incident).length, 1);
  assert.equal(s.incidents.find((i) => i.id === incident).media.length, 1);
  assert.equal(
    s.incidents.find((i) => i.id === incident).event_time,
    "Around nine",
  );
  let link = await req(`/api/media/${mid}/link`, owner);
  assert.equal(
    (await fetch(base + link.url, { headers: { cookie: owner } })).status,
    200,
  );
  assert.equal(
    (await fetch(base + link.url, { headers: { cookie: other } })).status,
    403,
  );
  await req(`/api/media/${mid}/link`, other, null, 403);
  assert.equal((await req("/api/state", other)).incidents.length, 0);
  await req("/api/summary/oak/2026-09-05", other, null, 403);
  await req("/api/ai", guard, new FormData(), 503);
});
test("supervisor state machine, notification receipt and summary approval", async () => {
  await req(
    `/api/incidents/${incident}/transition`,
    owner,
    { status: "Acknowledged" },
    403,
  );
  await req(
    `/api/incidents/${incident}/transition`,
    supervisor,
    { status: "Resolved", note: "skip" },
    400,
  );
  await req(`/api/incidents/${incident}/transition`, supervisor, {
    status: "Acknowledged",
    note: "Seen",
  });
  let s = await req("/api/state", owner);
  assert.equal(
    s.incidents.find((i) => i.id === incident).status,
    "Acknowledged",
  );
  await req(`/api/incidents/${incident}/transition`, supervisor, {
    status: "Assigned",
    responsible: "ISDL supervisor",
    next_action: "Replace lock",
  });
  await req(`/api/incidents/${incident}/transition`, supervisor, {
    status: "Resolved",
    note: "Lock replaced and tested",
    category: "maintenance",
  });
  s = await req("/api/state", supervisor);
  assert.equal(s.incidents.find((i) => i.id === incident).history.length, 3);
  let n = s.notifications.find((n) => n.event_id === incident);
  await req(`/api/notifications/${n.id}/delivered`, supervisor, {});
  await req(`/api/notifications/${n.id}/acknowledge`, supervisor, {});
  let day = new Date().toISOString().slice(0, 10),
    summary = await req("/api/summary/oak/" + day, supervisor, {});
  assert.equal((await req("/api/state", owner)).summaries.length, 0);
  await req(`/api/summaries/${summary.id}/approve`, supervisor, {
    narrative: "Reviewed counts.",
  });
  assert.equal((await req("/api/state", owner)).summaries.length, 1);
  assert.equal(summary.counts.incidents, 2);
  assert.ok(summary.counts.sourceIds.includes(incident));
});
test("Android viewport: offline capture, reload, shared sign-out, interrupted upload and exactly-once retry", async () => {
  let browser = await chromium.launch({
    executablePath:
      process.env.CHROME_PATH ||
      "C:/Program Files/Google/Chrome/Application/chrome.exe",
    headless: true,
  });
  try {
    let ctx = await browser.newContext({
        viewport: { width: 390, height: 844 },
      }),
      p = await ctx.newPage(),
      errors = [];
    p.on("pageerror", (e) => errors.push(e.message));
    await p.goto(base);
    await p.locator("#password").fill("Pilot-only-2026!");
    await p.getByRole("button", { name: "Sign in" }).click();
    await p.getByRole("heading", { name: "Hello, Bala." }).waitFor();
    await p.evaluate(() => navigator.serviceWorker.ready);
    await p.getByRole("button", { name: "Click here", exact: true }).click();
    await approveDialog(p);

    await p.getByRole("button", { name: "End shift" }).waitFor();
    await p.getByRole("button", { name: "Start patrol" }).click();
    await p.getByRole("button", { name: "Main gate Unchecked" }).click();
    await p.getByRole("link", { name: "Unable to scan?", exact: true }).click();
    await p.locator("#code").fill("OAK-1");
    await p.getByRole("button", { name: "Save code", exact: true }).click();
    try {
      await p
        .getByText("1 of 4 stops checked", { exact: true })
        .waitFor({ timeout: 5000 });
    } catch (e) {
      console.log(await p.locator("body").innerText(), errors);
      throw e;
    }
    await p.getByRole("button", { name: "Home" }).click();
    await ctx.setOffline(true);
    await p.getByRole("button", { name: "Report a problem" }).click();
    await p.locator("#typedReport").evaluate((el) => (el.open = true));
    await p
      .locator("#report")
      .fill("Offline browser test: back gate lock damaged. Called supervisor.");
    await p.locator("#libraryPhoto").setInputFiles({
      name: "gate.png",
      mimeType: "image/png",
      buffer: Buffer.from(
        "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aUAAAAABJRU5ErkJggg==",
        "base64",
      ),
    });
    await p.locator("img.photo").waitFor();
    await p.getByRole("button", { name: "Submit" }).click();
    await approveDialog(p);
    await p.getByRole("heading", { name: "Hello, Bala." }).waitFor();
    await p.getByRole("heading", { name: "You are on duty" }).waitFor();
    await p.getByRole("button", { name: "End shift", exact: true }).waitFor();
    await p.reload();
    await p.getByRole("heading", { name: "Hello, Bala." }).waitFor();
    await p.getByRole("button", { name: "End shift", exact: true }).waitFor();
    assert.equal(
      await p.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
      true,
    );
    await p.getByRole("button", { name: "Sign out", exact: true }).click();
    if (await p.locator("[data-confirm=accept]").count()) await approveDialog(p);
    await p.getByRole("heading", { name: "Welcome back" }).waitFor();
    assert.equal(
      await p.getByText("Offline browser test:", { exact: false }).count(),
      0,
    );
    await p.locator("#password").fill("Pilot-only-2026!");
    await p.getByRole("button", { name: "Sign in" }).click();
    await p.getByRole("button", { name: "End shift", exact: true }).waitFor();
    let markFailed;
    const failedUpload = new Promise((resolve) => (markFailed = resolve));
    await p.route("**/api/media/**", async (r) => {
      await r.abort();
      markFailed();
    });
    await ctx.setOffline(false);
    await failedUpload;
    await p.waitForLoadState("networkidle");
    await p.unroute("**/api/media/**");
    await p.reload();
    await p.getByRole("heading", { name: "Hello, Bala." }).waitFor();
    await waitRecords((s) =>
      s.incidents.some(
        (i) =>
          i.report.startsWith("Offline browser test:") && i.media.length === 1,
      ),
    );
    await p.evaluate(() => window.dispatchEvent(new Event("online")));
    await p.waitForLoadState("networkidle");
    let s = await req("/api/state", owner),
      found = s.incidents.filter((i) =>
        i.report.startsWith("Offline browser test:"),
      );
    assert.equal(found.length, 1);
    assert.equal(found[0].media.length, 1);
    assert.deepEqual(errors, []);
    await p.screenshot({
      path: path.join(data, "guard-mobile.png"),
      fullPage: true,
    });
    await ctx.close();
  } finally {
    await browser.close();
  }
});

test("voice recording, permission fallbacks, owner mobile and supervisor administration UI", async () => {
  const browser = await chromium.launch({
    executablePath:
      process.env.CHROME_PATH ||
      "C:/Program Files/Google/Chrome/Application/chrome.exe",
    headless: true,
    args: [
      "--use-fake-device-for-media-stream",
      "--use-fake-ui-for-media-stream",
    ],
  });
  try {
    const ctx = await browser.newContext({
        viewport: { width: 390, height: 844 },
      }),
      p = await ctx.newPage(),
      errors = [];
    p.on("pageerror", (e) => errors.push(e.message));
    await p.goto(base);
    await p.locator("#password").fill("Pilot-only-2026!");
    await p.getByRole("button", { name: "Sign in" }).click();
    await p.getByRole("heading", { name: "Hello, Bala." }).waitFor();
    await p.getByRole("button", { name: "Report a problem" }).click();
    await p.evaluate(() => {
      window.originalGum = navigator.mediaDevices.getUserMedia.bind(
        navigator.mediaDevices,
      );
      navigator.mediaDevices.getUserMedia = () =>
        Promise.reject(
          new DOMException("Permission denied", "NotAllowedError"),
        );
    });
    await p.locator("#record").focus();
    await p.keyboard.down("Space");
    await p.keyboard.up("Space");
    await p.getByText(/You can type your report instead/).waitFor();
    await p.evaluate(
      () => (navigator.mediaDevices.getUserMedia = window.originalGum),
    );
    await p
      .getByRole("button", { name: "Press to start", exact: true })
      .click();
    await p.getByText(/Recording ·/).waitFor();
    await p.waitForTimeout(600);
    await p.getByRole("button", { name: "Tap to stop", exact: true }).click();
    await p.locator("audio").waitFor();
    await p.locator("audio").evaluate((el) => el.play());
    await p.waitForFunction(
      () => document.querySelector("audio")?.currentTime > 0,
    );
    await p.locator("audio").evaluate((el) => el.pause());
    await p.locator("#typedReport").evaluate((el) => (el.open = true));
    await p
      .locator("#report")
      .fill("Voice UI test. The lock is damaged. I called the supervisor.");
    await p.getByRole("button", { name: "Submit" }).click();
    await approveDialog(p);
    await waitRecords((s) =>
      s.incidents.some(
        (i) => i.report.startsWith("Voice UI test.") && i.media.length === 1,
      ),
    );
    await p.getByRole("heading", { name: "You are on duty" }).waitFor();
    await waitRecords((s) =>
      s.incidents.some(
        (i) => i.report.startsWith("Voice UI test.") && i.media.length === 1,
      ),
    );
    let s = await req("/api/state", owner),
      i = s.incidents.find((i) => i.report.startsWith("Voice UI test."));
    assert.ok(i);
    assert.equal(i.media[0].mime.startsWith("audio/"), true);
    assert.equal(i.transcript, "");
    await p.getByRole("button", { name: "Sign out", exact: true }).click();
    await p.locator("#email").fill("owner@demo.isdl");
    await p.locator("#password").fill("Pilot-only-2026!");
    await p.getByRole("button", { name: "Sign in" }).click();
    await p
      .getByRole("heading", {
        name: "At a glance",
      })
      .waitFor();
    assert.equal(
      await p.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
      true,
    );
    await p.screenshot({
      path: path.join(data, "owner-mobile.png"),
      fullPage: true,
    });
    await p.locator("#ownerOverview").waitFor();
    await p.getByRole("button", { name: "Sign out", exact: true }).click();
    await p.locator("#email").fill("supervisor@demo.isdl");
    await p.locator("#password").fill("Pilot-only-2026!");
    await p.getByRole("button", { name: "Sign in" }).click();
    await p
      .getByRole("heading", {
        name: "Hello, Ada.",
      })
      .waitFor();
    await p.setViewportSize({ width: 1440, height: 1000 });
    await p.screenshot({
      path: path.join(data, "supervisor-desktop.png"),
      fullPage: true,
    });
    await p.getByRole("button", { name: "Settings", exact: true }).click();
    await p.locator('[data-tab="checkpoints"]').click();
    await p.getByRole("button", { name: "Print all QR labels" }).click();
    await p
      .getByRole("button", { name: "Print", exact: true })
      .waitFor();
    assert.equal(await p.locator(".qr-print-sheet img").count(), 4);
    assert.deepEqual(errors, []);
    await ctx.close();
  } finally {
    await browser.close();
  }
});

test("Material layouts: every page at compact, medium and expanded widths", async () => {
  const browser = await chromium.launch({
    executablePath:
      process.env.CHROME_PATH ||
      "C:/Program Files/Google/Chrome/Application/chrome.exe",
    headless: true,
  });
  try {
    for (const role of ["bala", "owner", "supervisor"]) {
      const context = await browser.newContext({
          viewport: { width: 390, height: 844 },
          reducedMotion: "reduce",
        }),
        p = await context.newPage(),
        errors = [];
      p.on("pageerror", (e) => errors.push(e.message));
      await p.goto(base);
      await p.locator("#email").fill(role + "@demo.isdl");
      await p.locator("#password").fill("Pilot-only-2026!");
      await p.getByRole("button", { name: "Sign in" }).click();
      await p.locator(".guard").waitFor();
      const screens =
        role === "bala"
          ? ["home", "shift", "round", "report", "instructions"]
          : role === "owner"
            ? ["home", "property", "supervisors", "subscription"]
            : ["home", "incidents", "summaries", "admin", "qr"];
      for (const width of [390, 900, 1440]) {
        await p.setViewportSize({ width, height: 900 });
        for (const screen of screens) {
          if (role === "bala") {
            if (await p.locator("button.back").count())
              await p.locator("button.back").click();
            if (screen === "shift")
              await p.locator('[data-action="shift"]').click();
            else if (screen !== "home")
              await p.locator(`[data-page="${screen}"]`).first().click();
          } else if (role === "owner") {
            if (await p.locator('.greeting-row .back').count())
              await p.locator('.greeting-row .back').click();
            if (screen !== "home") await p.locator(`[data-page="${screen}"]`).first().click();
          } else {
            const target = screen === "qr" ? "admin" : screen;
            if (
              role === "supervisor" &&
              (await p.locator(".greeting-row .back").count())
            )
              await p.locator(".greeting-row .back").click();
            if (
              role === "supervisor" &&
              ["admin", "instructionSetup", "patrols"].includes(target)
            )
              await p.locator('nav [data-page="setup"]').click();
            if (role !== "supervisor" || !["home", "admin"].includes(target))
              await p.locator(`nav [data-page="${target}"]`).click();
            if (screen === "qr") {
              await p.locator('[data-tab="checkpoints"]').click();
              await p.getByRole("button", { name: "Print all QR labels" }).click();
              await p.locator('#qr-print-now').waitFor();
              await p.locator('#qr-print-close').click();
            }
          }
          await p.locator("[data-md]").first().waitFor();
          const overflow = await p.evaluate(() => ({
            width: innerWidth,
            scroll: document.documentElement.scrollWidth,
          }));
          assert.ok(
            overflow.scroll <= overflow.width,
            `${role}/${screen}/${width}: ${JSON.stringify(overflow)}`,
          );
          const unnamed = await p
            .locator("button")
            .evaluateAll(
              (bs) =>
                bs.filter(
                  (b) =>
                    b.checkVisibility() &&
                    !(b.getAttribute("aria-label") || b.innerText).trim(),
                ).length,
            );
          if (unnamed)
            console.log(
              await p
                .locator("button")
                .evaluateAll((bs) =>
                  bs
                    .filter(
                      (b) =>
                        !(b.getAttribute("aria-label") || b.innerText).trim(),
                    )
                    .map((b) => b.outerHTML),
                ),
            );
          assert.equal(unnamed, 0);
          await p.screenshot({
            path: path.join(data, `material-${role}-${screen}-${width}.png`),
            fullPage: true,
            animations: "disabled",
          });
        }
      }
      assert.deepEqual(errors, []);
      await context.close();
    }
  } finally {
    await browser.close();
  }
});

test("off-duty messaging is disabled; duty actions return after check-in", async () => {
  const browser = await chromium.launch({
    executablePath:
      process.env.CHROME_PATH ||
      "C:/Program Files/Google/Chrome/Application/chrome.exe",
    headless: true,
  });
  try {
    const ctx = await browser.newContext({
        viewport: { width: 390, height: 844 },
        reducedMotion: "reduce",
      }),
      p = await ctx.newPage();
    await p.goto(base);
    await p.locator("#password").fill("Pilot-only-2026!");
    await p.getByRole("button", { name: "Sign in" }).click();
    await p.getByRole("heading", { name: "Hello, Bala." }).waitFor();
    if (
      await p.getByRole("button", { name: "End shift", exact: true }).count()
    ) {
      await p.getByRole("button", { name: "End shift", exact: true }).click();
      await p.locator("textarea[name=note]").fill("Private handover note");
      await p.getByRole("button", { name: "Confirm end shift" }).click();
      await approveDialog(p);
    }
    await p.getByRole("heading", { name: "Start your shift" }).waitFor();
    const assertSimple = async () => {
      for (const text of [
        "My round",
        "Report a problem",
        "Urgent alert",
        "Hear instructions",
        "Handover notes",
        "Upload status and recent records",
        "Supervisor notification:",
        "Location is requested",
        "waiting to upload",
        "Private handover note",
      ])
        assert.equal(
          await p.getByText(text, { exact: false }).count(),
          0,
          text,
        );
      assert.equal(await p.getByRole("button", { name: "Message supervisor" }).count(), 0);
      assert.equal(await p.getByRole("link", { name: "Call supervisor" }).count(), 1);
      assert.equal(
        await p
          .getByRole("button", { name: "Click here", exact: true })
          .count(),
        1,
      );
      assert.equal(await p.getByText("Off duty", { exact: true }).count(), 1);
    };
    await assertSimple();
    await p.screenshot({
      path: path.join(data, "off-duty-home.png"),
      fullPage: true,
    });
    await p.reload();
    await p.getByRole("heading", { name: "Hello, Bala." }).waitFor();
    await p.getByRole("heading", { name: "Start your shift" }).waitFor();
    await assertSimple();
    for (const kind of ["incident", "alert"])
      await req(
        "/api/events",
        guard,
        event(kind, {
          approved: true,
          report: "Off duty should fail",
          event_time: "Now",
        }),
        403,
      );
    await p.getByRole("button", { name: "Click here", exact: true }).click();
    await approveDialog(p);

    await p.getByRole("button", { name: "Start patrol" }).waitFor();
    await p.getByRole("heading", { name: "You are on duty" }).waitFor();
    assert.equal(
      await p.getByRole("heading", { name: "Shift instructions" }).count(),
      0,
    );
    assert.equal(await p.getByRole("checkbox").count(), 0);
    for (const unwanted of [
      "Handover notes",
      "Upload status and recent records",
      "Supervisor notification:",
      "Location is requested",
      "waiting to upload",
      "Urgent alert",
    ])
      assert.equal(
        await p.getByText(unwanted, { exact: false }).count(),
        0,
        unwanted,
      );
    const elapsed = await p.locator("#shiftTimer").textContent();
    await p.waitForFunction(
      (previous) =>
        document.querySelector("#shiftTimer")?.textContent !== previous,
      elapsed,
    );
    await p.getByText("Shift ends", { exact: true }).waitFor();
    await p.screenshot({
      path: path.join(data, "on-duty-home.png"),
      fullPage: true,
      animations: "disabled",
    });
    assert.equal(
      await p.getByRole("button", { name: "Report a problem" }).count(),
      1,
    );
    assert.equal(
      await p.getByRole("button", { name: "Message supervisor" }).count(),
      0,
    );
    await ctx.close();
  } finally {
    await browser.close();
  }
});

test("shift timing handles Nigerian day and overnight schedules, elapsed time and absent plans", () => {
  const plan = {
    guard_id: "bala",
    site_id: "oak",
    start_time: "06:00",
    end_time: "18:00",
    created_at: "2026-01-01",
  };
  assert.equal(
    scheduledEnd("2026-09-05T06:10:00+01:00", [plan], "bala", "oak"),
    "2026-09-05T17:00:00.000Z",
  );
  const night = { ...plan, start_time: "18:00", end_time: "06:00" };
  assert.equal(
    scheduledEnd("2026-09-06T02:00:00+01:00", [night], "bala", "oak"),
    "2026-09-06T05:00:00.000Z",
  );
  assert.equal(
    scheduledEnd("2026-09-05T17:50:00+01:00", [night], "bala", "oak"),
    "2026-09-06T05:00:00.000Z",
  );
  assert.equal(scheduledEnd("2026-09-05T06:00:00Z", [], "bala", "oak"), "2026-09-05T23:00:00.000Z");
  assert.equal(
    elapsedShift("2026-09-05T00:00:00Z", Date.parse("2026-09-06T01:02:03Z")),
    "25:02:03",
  );
});

test("shift supervisor messages survive offline reload, arrive once and stay customer-scoped", { skip: "In-app messaging is deliberately disabled for the MVP." }, async () => {
  const browser = await chromium.launch({
    executablePath:
      process.env.CHROME_PATH ||
      "C:/Program Files/Google/Chrome/Application/chrome.exe",
    headless: true,
  });
  try {
    const ctx = await browser.newContext({
        viewport: { width: 390, height: 844 },
        reducedMotion: "reduce",
      }),
      p = await ctx.newPage();
    const signIn = async () => {
      await p.locator("#password").fill("Pilot-only-2026!");
      await p.getByRole("button", { name: "Sign in" }).click();
      await p.getByRole("heading", { name: "Hello, Bala." }).waitFor();
    };
    await p.goto(base);
    await signIn();
    if (
      await p.getByRole("button", { name: "End shift", exact: true }).count()
    ) {
      await p.getByRole("button", { name: "End shift", exact: true }).click();
      await p.getByRole("button", { name: "Confirm end shift" }).click();
      await approveDialog(p);
    }
    await p.getByRole("button", { name: "Click here", exact: true }).waitFor();
    assert.equal(
      await p.locator(".topbar").getByText("Provided by ISDL").count(),
      0,
    );
    assert.equal(
      await p.getByRole("link", { name: "Call supervisor" }).count(),
      0,
    );
    await p.waitForFunction(
      () =>
        document.querySelector(".off-duty .shift")?.getBoundingClientRect()
          .height >= 300,
    );
    await p.screenshot({
      path: path.join(data, "guard-home-message.png"),
      fullPage: true,
    });
    assert.equal(
      await p
        .getByRole("button", { name: "Message supervisor", exact: true })
        .isDisabled(),
      true,
    );
    await p.getByRole("button", { name: "Click here", exact: true }).click();
    await approveDialog(p);
    await p.getByRole("button", { name: "End shift", exact: true }).waitFor();
    await p.evaluate(() => navigator.serviceWorker.ready);
    await p
      .getByRole("button", { name: "Message supervisor", exact: true })
      .click();
    await ctx.setOffline(true);
    await p.locator("#typedReport > summary").click();
    await p.locator("#report").fill("Please check the gate.");
    await p.getByRole("button", { name: "Send message", exact: true }).click();
    await p
      .getByText("Saved on this phone — not sent yet", { exact: true })
      .waitFor();
    await p.reload();
    await p.getByRole("heading", { name: "Hello, Bala." }).waitFor();
    await p
      .getByText("Saved on this phone — not sent yet", { exact: true })
      .waitFor();
    await ctx.setOffline(false);
    await p.getByText("Sent to supervisor inbox", { exact: true }).waitFor();
    const s = await req("/api/state", supervisor),
      messages = s.events.filter(
        (e) =>
          e.kind === "message" && e.payload.text === "Please check the gate.",
      );
    assert.equal(messages.length, 1);
    const m = messages[0];
    assert.equal(m.user_id, "bala");
    assert.equal(m.payload.location, undefined);
    const n = s.notifications.find((n) => n.event_id === m.id);
    assert.ok(n);
    await req("/api/events", guard, {
      id: m.id,
      site_id: m.site_id,
      kind: m.kind,
      captured_at: m.captured_at,
      payload: m.payload,
    });
    assert.equal(
      (await req("/api/state", supervisor)).events.filter((e) => e.id === m.id)
        .length,
      1,
    );
    assert.equal(
      (await req("/api/state", other)).events.some((e) => e.id === m.id),
      false,
    );
    await req(
      "/api/events",
      guard,
      event("message", { text: "Wrong property" }, "other"),
      403,
    );
    await req(`/api/notifications/${n.id}/acknowledge`, other, {}, 404);
    await req(`/api/notifications/${n.id}/delivered`, supervisor, {});
    await req(`/api/notifications/${n.id}/acknowledge`, supervisor, {});
    await p.reload();
    await p.getByRole("heading", { name: "Hello, Bala." }).waitFor();
    await p.getByText("Acknowledged by supervisor", { exact: true }).waitFor();
    await p.screenshot({
      path: path.join(data, "guard-message-acknowledged.png"),
      fullPage: true,
    });
    await ctx.close();
  } finally {
    await browser.close();
  }
});

test("patrol interval windows, overdue time, persisted start and midnight", () => {
  assert.equal(
    patrolSchedule({
      mode: "interval",
      start: "23:45",
      end: "00:30",
      interval: 15,
    }),
    "00:00,00:15,23:45",
  );
  assert.throws(() =>
    patrolSchedule({
      mode: "interval",
      start: "06:00",
      end: "18:00",
      interval: 0,
    }),
  );
  const s = { id: "shift", started_at: "2026-09-05T08:00:00+01:00" };
  let p = nextPatrol(
    "08:15,08:30",
    s,
    [],
    Date.parse("2026-09-05T08:20:00+01:00"),
  );
  assert.equal(p.remaining, -300000);
  const events = [
    {
      kind: "patrol_start",
      captured_at: "2026-09-05T08:20:00+01:00",
      payload: { shift_id: "shift", scheduled_for: p.iso },
    },
  ];
  p = nextPatrol(
    "08:15,08:30",
    s,
    events,
    Date.parse("2026-09-05T08:25:00+01:00"),
  );
  assert.equal(p.remaining, 300000);
  assert.equal(p.slot, "08:30");
  assert.equal(nextPatrol("", s, events), null);
});
test("owner and supervisor can schedule only assigned sites; guard cannot", async () => {
  const original = (await req("/api/state", owner)).sites.find(
    (s) => s.id === "oak",
  ).schedule;
  const body = {
    site_id: "oak",
    mode: "interval",
    start: "06:00",
    end: "07:00",
    interval: 15,
  };
  assert.equal(
    (await req("/api/patrol-schedule", owner, body)).schedule,
    "06:00,06:15,06:30,06:45",
  );
  await req("/api/patrol-schedule", guard, body, 403);
  await req("/api/patrol-schedule", other, body, 403);
  await req("/api/patrol-schedule", supervisor, { ...body, interval: 0 }, 400);
  await req("/api/patrol-schedule", supervisor, {
    site_id: "oak",
    mode: "times",
    times: original,
  });
});

test("mobile patrol countdown, five-minute reminder, overdue and offline start survive reload", async () => {
  const original = (await req("/api/state", owner)).sites.find(
    (s) => s.id === "oak",
  ).schedule;
  for (const active of (await req("/api/state", guard)).shifts.filter(
    (s) => !s.ended_at,
  ))
    await req("/api/events", guard, event("end", { shift_id: active.id }));
  const now = Date.now(),
    due = Math.ceil((now + 360000) / 60000) * 60000;
  const time = (m) => new Date(m + 3600000).toISOString().slice(11, 16);
  await req("/api/patrol-schedule", owner, {
    site_id: "oak",
    mode: "times",
    times: time(due) + "," + time(due + 900000),
  });
  const browser = await chromium.launch({
    executablePath:
      process.env.CHROME_PATH ||
      "C:/Program Files/Google/Chrome/Application/chrome.exe",
    headless: true,
  });
  try {
    const ctx = await browser.newContext({
        viewport: { width: 390, height: 844 },
      }),
      p = await ctx.newPage();
    await p.clock.install({ time: new Date(now) });
    await p.goto(base);
    await p.locator("#password").fill("Pilot-only-2026!");
    await p.getByRole("button", { name: "Sign in", exact: true }).click();
    await p.getByRole("heading", { name: "Hello, Bala." }).waitFor();
    if (
      await p.getByRole("button", { name: "Click here", exact: true }).count()
    )
      await p.getByRole("button", { name: "Click here", exact: true }).click();
    await approveDialog(p);
    await p.locator("#patrolCountdown").waitFor();
    await p.clock.fastForward(due - now - 240000);
    await p.locator("#patrolButton.patrol-soon").waitFor();
    assert.match(await p.locator("#toast").innerText(), /Patrol in/);
    await p.clock.fastForward(300000);
    await p.locator("#patrolButton.patrol-due").waitFor();
    assert.match(await p.locator("#patrolCountdown").innerText(), /overdue/);
    await p.screenshot({
      path: path.join(data, "patrol-overdue.png"),
      fullPage: true,
    });
    await p.evaluate(() => navigator.serviceWorker.ready);
    await ctx.setOffline(true);
    await p.getByRole("button", { name: "Start patrol", exact: true }).click();
    await p.getByRole("button", { name: "Home", exact: true }).click();
    assert.match(
      await p.locator("#patrolCountdown").innerText(),
      /Next patrol in/,
    );
    await p.reload();
    await p.getByRole("heading", { name: "Hello, Bala." }).waitFor();
    await p.locator("#patrolCountdown").waitFor();
    assert.equal(await p.locator("#patrolButton.patrol-due").count(), 0);
    await ctx.setOffline(false);
    await p.evaluate(() => window.dispatchEvent(new Event("online")));
    await waitRecords((s) =>
      s.events.some(
        (e) =>
          e.kind === "patrol_start" &&
          e.payload.scheduled_for === new Date(due).toISOString(),
      ),
    );
    await ctx.close();
  } finally {
    await browser.close();
    await req("/api/patrol-schedule", owner, {
      site_id: "oak",
      mode: "times",
      times: original,
    });
  }
});

test("sequential patrol enforcement, checkpoint mismatch and GPS review", async () => {
  for (const active of (await req("/api/state", guard)).shifts.filter(
    (s) => !s.ended_at,
  ))
    await req("/api/events", guard, event("end", { shift_id: active.id }));
  const begin = event("start");
  await req("/api/events", guard, begin);
  const st = await req("/api/state", guard),
    first = nextPatrol(
      st.sites[0].schedule,
      st.shifts.find((s) => s.id === begin.id),
      st.events,
    );
  const round = randomUUID(),
    payload = {
      shift_id: begin.id,
      round_id: round,
      slot: first.slot,
      scheduled_for: first.iso,
    };
  await req(
    "/api/events",
    guard,
    event("patrol_start", {
      ...payload,
      scheduled_for: new Date(first.due + 86400000).toISOString(),
    }),
    409,
  );
  await req("/api/events", guard, event("patrol_start", payload));
  await req(
    "/api/events",
    guard,
    event("patrol_start", { ...payload, round_id: randomUUID() }),
    409,
  );
  await req(
    "/api/events",
    guard,
    event("scan", {
      shift_id: begin.id,
      round_id: round,
      slot: first.slot,
      code: "OAK-1",
      selected_checkpoint_id: "cp1",
    }),
    400,
  );
  const reference = {
    site_id: "oak",
    address: "Fictional test property, Ikeja, Lagos",
    confirmed: true,
    latitude: 6.5,
    longitude: 3.3,
    radius_m: 100,
  };
  await req("/api/site-location", owner, reference);
  await req("/api/site-location", other, reference, 403);
  await req("/api/site-location", guard, reference, 403);
  const loc = event("sign_in_location", {
    location: { latitude: 6.5, longitude: 3.3, accuracy: 10 },
  });
  await req("/api/events", guard, loc);
  const observed = (await req("/api/state", owner)).events.find(
    (e) => e.id === loc.id,
  );
  assert.equal(observed.payload.distance_m, 0);
  assert.equal(
    observed.payload.location_review,
    "Within site area and reported accuracy",
  );
  await req(
    "/api/events",
    guard,
    event("sign_in_location", {
      location: { latitude: 200, longitude: 3, accuracy: 10 },
    }),
    400,
  );
});
test("patrol mobile: selected QR/NFC auto-save, resume, hidden manual exception", async () => {
  const browser = await chromium.launch({
    executablePath:
      process.env.CHROME_PATH ||
      "C:/Program Files/Google/Chrome/Application/chrome.exe",
    headless: true,
    args: [
      "--use-fake-device-for-media-stream",
      "--use-fake-ui-for-media-stream",
    ],
  });
  try {
    const ctx = await browser.newContext({
        viewport: { width: 390, height: 844 },
        permissions: ["geolocation", "camera"],
        geolocation: { latitude: 6.5, longitude: 3.3, accuracy: 10 },
      }),
      p = await ctx.newPage();
    await p.addInitScript(() => {
      window.BarcodeDetector = class {
        async detect() {
          return window.testQr ? [{ rawValue: window.testQr }] : [];
        }
      };
      window.NDEFReader = class {
        constructor() {
          window.testReader = this;
        }
        async scan() {}
      };
    });
    await p.goto(base);
    await p.locator("#password").fill("Pilot-only-2026!");
    await p.getByRole("button", { name: "Sign in", exact: true }).click();
    await p.getByRole("button", { name: "Start patrol", exact: true }).click();
    await p.getByRole("heading", { name: /Patrol number 1 of/ }).waitFor();
    assert.equal(await p.locator("#slot").count(), 0);
    assert.equal(await p.locator("#code").count(), 0);
    assert.equal(
      await p.getByRole("button", { name: "Start another round" }).count(),
      0,
    );
    const heading = await p
        .getByRole("heading", { name: "Hello, Bala." })
        .boundingBox(),
      home = await p
        .getByRole("button", { name: "Home", exact: true })
        .boundingBox();
    assert.ok(Math.abs(heading.y - home.y) < 25);
    await p
      .getByRole("button", { name: "Main gate Unchecked", exact: true })
      .click();

    assert.equal(
      await p
        .getByRole("button", { name: "Scan QR code", exact: true })
        .isEnabled(),
      true,
    );
    await p
      .getByRole("button", { name: "Main gate Unchecked", exact: true })
      .click();
    assert.equal(
      await p
        .getByRole("button", { name: "Main gate Unchecked", exact: true })
        .getAttribute("aria-pressed"),
      "false",
    );
    assert.equal(
      await p
        .getByRole("button", { name: "Scan QR code", exact: true })
        .isDisabled(),
      true,
    );
    assert.equal(
      await p
        .getByRole("button", { name: "Scan NFC tag", exact: true })
        .isDisabled(),
      true,
    );
    await p
      .getByRole("button", { name: "Main gate Unchecked", exact: true })
      .click();
    // Read both positions in one frame; entry animations can move the page
    // between two remote boundingBox requests on the cloud-backed version.
    const scanButtonY = await p
      .locator(".scan-actions")
      .evaluate((el) =>
        [...el.querySelectorAll("button")].map(
          (b) => b.getBoundingClientRect().y,
        ),
      );
    assert.equal(scanButtonY.length, 2);
    assert.ok(Math.abs(scanButtonY[0] - scanButtonY[1]) < 1);
    await p.evaluate(() => (window.testQr = "OAK-1"));
    await p.getByRole("button", { name: "Scan QR code", exact: true }).click();
    await p.getByText("1 of 4 stops checked", { exact: true }).waitFor();
    await p.getByRole("button", { name: "Home", exact: true }).click();
    await p.getByRole("button", { name: "Start patrol", exact: true }).click();
    await p.getByText("1 of 4 stops checked", { exact: true }).waitFor();
    await p
      .getByRole("button", { name: "Back gate Unchecked", exact: true })
      .click();

    await p.getByRole("button", { name: "Scan NFC tag", exact: true }).click();
    await p.evaluate(() =>
      window.testReader.onreading({
        message: {
          records: [
            {
              recordType: "text",
              encoding: "utf-8",
              data: new DataView(new TextEncoder().encode("OAK-2").buffer),
            },
          ],
        },
      }),
    );
    await p.getByText("2 of 4 stops checked", { exact: true }).waitFor();
    await p
      .getByRole("button", { name: "Generator area Unchecked", exact: true })
      .click();
    await p.getByRole("link", { name: "Unable to scan?", exact: true }).click();
    await p.locator("#code").fill("OAK-1");
    await p.getByRole("button", { name: "Save code", exact: true }).click();
    await p
      .getByText("This label does not match the selected checkpoint.", {
        exact: true,
      })
      .waitFor();
    await p.getByRole("button", { name: "Cancel", exact: true }).click();
    await p.screenshot({
      path: path.join(data, "patrol-redesign.png"),
      fullPage: true,
    });
    await waitRecords(
      (s) =>
        s.events.some((e) => e.kind === "scan" && e.payload.method === "nfc") &&
        s.events.some((e) => e.kind === "scan" && e.payload.method === "qr"),
    );
    await ctx.close();
  } finally {
    await browser.close();
  }
});

test("simplified report: camera photo and audio-only submission with aligned Home", async () => {
  const browser = await chromium.launch({
    executablePath:
      process.env.CHROME_PATH ||
      "C:/Program Files/Google/Chrome/Application/chrome.exe",
    headless: true,
    args: [
      "--use-fake-device-for-media-stream",
      "--use-fake-ui-for-media-stream",
    ],
  });
  try {
    const ctx = await browser.newContext({
        viewport: { width: 390, height: 844 },
      }),
      p = await ctx.newPage();
    await p.goto(base);
    await p.locator("#password").fill("Pilot-only-2026!");
    await p.getByRole("button", { name: "Sign in", exact: true }).click();
    await p
      .getByRole("button", { name: "Report a problem", exact: true })
      .click();
    assert.equal(await p.locator("#report").isVisible(), false);
    assert.equal(await p.getByRole("checkbox").count(), 0);
    assert.equal(
      await p.getByRole("button", { name: "Listen to my report" }).count(),
      0,
    );
    assert.equal(await p.locator("#cameraPhoto").count(), 0);
    const h = await p
        .getByRole("heading", { name: "Hello, Bala." })
        .boundingBox(),
      back = await p
        .getByRole("button", { name: "Home", exact: true })
        .boundingBox();
    assert.ok(Math.abs(h.y - back.y) < 25);
    await p.screenshot({
      path: path.join(data, "report-simplified.png"),
      fullPage: true,
    });
    await p.getByRole("button", { name: "Take a photo", exact: true }).click();
    await p.locator("#photoPreview").waitFor();
    const captureBox = await p
        .getByRole("button", { name: "Capture photo", exact: true })
        .boundingBox(),
      cancelBox = await p
        .getByRole("button", { name: "Cancel", exact: true })
        .boundingBox();
    assert.ok(Math.abs(captureBox.y - cancelBox.y) < 1);
    await p.getByRole("button", { name: "Capture photo", exact: true }).click();
    await p.locator("img.photo").waitFor();
    await p.locator("#record").click();
    await p.getByText(/Recording ·/).waitFor();
    await p.waitForFunction(() =>
      /00:01/.test(document.querySelector("#recordStatus").textContent),
    );
    await p.locator("#record").click();
    await p.locator("audio").waitFor();
    await p.locator("audio").evaluate((el) => el.play());
    await p.waitForFunction(
      () => document.querySelector("audio")?.currentTime > 0,
    );
    await p.getByRole("button", { name: "Submit", exact: true }).click();
    await approveDialog(p);
    const state = await waitRecords((s) =>
      s.incidents.some(
        (i) =>
          i.report === "Voice report — listen to the attached recording." &&
          i.media.length === 2,
      ),
    );
    const incident = state.incidents.find(
      (i) => i.report === "Voice report — listen to the attached recording.",
    );
    assert.equal(incident.transcript, "");
    assert.ok(incident.media.some((m) => m.source === "camera capture"));
    await p
      .getByRole("button", { name: "Report a problem", exact: true })
      .click();
    await p.locator("#shiftReportHistory > summary").click();
    await p
      .locator('[data-action="viewShiftReport"][data-id="' + incident.id + '"]')
      .click();
    await p.getByRole("heading", { name: /^Reported On / }).waitFor();
    await p.getByText("Reported by Bala", { exact: true }).waitFor();
    assert.equal(await p.locator("#savedReportText").inputValue(), "");
    assert.equal(
      await p.locator("#savedReportText").getAttribute("readonly"),
      "",
    );
    await p.waitForFunction(
      () => document.querySelector("#savedReportPhotos img")?.naturalWidth > 0,
    );
    await p.locator("#savedReportAudio audio").evaluate((el) => el.play());
    await p.waitForFunction(
      () => document.querySelector("#savedReportAudio audio")?.currentTime > 0,
    );
    assert.equal(
      await p
        .getByRole("button", { name: "Play recording", exact: true })
        .count(),
      0,
    );
    await p.screenshot({
      path: path.join(data, "read-only-report-page.png"),
      fullPage: true,
    });
    await ctx.close();
  } finally {
    await browser.close();
  }
});

test("cancel confirmations preserve shift and report; typed-only reports need no photo", async () => {
  for (const active of (await req("/api/state", guard)).shifts.filter(
    (s) => !s.ended_at,
  ))
    await req("/api/events", guard, event("end", { shift_id: active.id }));
  const browser = await chromium.launch({
    executablePath:
      process.env.CHROME_PATH ||
      "C:/Program Files/Google/Chrome/Application/chrome.exe",
    headless: true,
  });
  try {
    const ctx = await browser.newContext({
        viewport: { width: 390, height: 844 },
      }),
      p = await ctx.newPage();
    await p.goto(base);
    await p.locator("#password").fill("Pilot-only-2026!");
    await p.getByRole("button", { name: "Sign in", exact: true }).click();
    const clickConfirm = async (action, message, accept) => {
      await action.click();
      await p.getByRole("alertdialog", { name: message }).waitFor();
      await p.screenshot({
        path: path.join(data, "confirmation-custom.png"),
        fullPage: true,
      });
      await p
        .locator(accept ? "[data-confirm=accept]" : "[data-confirm=cancel]")
        .click();
    };
    await clickConfirm(
      p.getByRole("button", { name: "Click here", exact: true }),
      "Are you sure you are ready to start your shift?",
      false,
    );
    await p.getByRole("button", { name: "Click here", exact: true }).waitFor();
    await clickConfirm(
      p.getByRole("button", { name: "Click here", exact: true }),
      "Are you sure you are ready to start your shift?",
      true,
    );
    await p
      .getByRole("button", { name: "Report a problem", exact: true })
      .click();
    assert.equal(await p.locator("#submitReport").isDisabled(), true);
    await p.locator("#typedReport").evaluate((el) => (el.open = true));
    await p.locator("#report").fill("   ");
    assert.equal(await p.locator("#submitReport").isDisabled(), true);
    await p
      .locator("#report")
      .fill("Confirmation test: gate secured after checking.");
    await clickConfirm(
      p.getByRole("button", { name: "Submit", exact: true }),
      "Have you added all the necessary information needed for this report?",
      false,
    );
    assert.equal(
      await p.locator("#report").inputValue(),
      "Confirmation test: gate secured after checking.",
    );
    await clickConfirm(
      p.getByRole("button", { name: "Submit", exact: true }),
      "Have you added all the necessary information needed for this report?",
      true,
    );
    const state = await waitRecords((s) =>
      s.incidents.some((i) => i.report.startsWith("Confirmation test:")),
    );
    assert.equal(
      state.incidents.find((i) => i.report.startsWith("Confirmation test:"))
        .media.length,
      0,
    );
    await p.getByRole("button", { name: "End shift", exact: true }).click();
    await clickConfirm(
      p.getByRole("button", { name: "Confirm end shift", exact: true }),
      "Are you sure you are ready to end your shift?",
      false,
    );
    await p.getByRole("button", { name: "Home", exact: true }).click();
    await p.getByRole("button", { name: "End shift", exact: true }).waitFor();
    await ctx.close();
  } finally {
    await browser.close();
  }
});

test("guard history is collapsed, scoped to the shift and read-only, including offline reports", async () => {
  for (const active of (await req("/api/state", guard)).shifts.filter(
    (s) => !s.ended_at,
  ))
    await req("/api/events", guard, event("end", { shift_id: active.id }));
  const oldShift = event("start");
  await req("/api/events", guard, oldShift);
  const old = event("incident", {
    shift_id: oldShift.id,
    report: "Previous shift private report",
    event_time: "Not stated",
    approved: true,
  });
  await req("/api/events", guard, old);
  await req("/api/events", guard, event("end", { shift_id: oldShift.id }));
  const current = event("start");
  await req("/api/events", guard, current);
  const currentReport = event("incident", {
    shift_id: current.id,
    report: "This shift: damaged light reported",
    event_time: "Not stated",
    approved: true,
  });
  await req("/api/events", guard, currentReport);
  await req("/api/events", guard, {
    ...currentReport,
    payload: { ...currentReport.payload, report: "Attempted overwrite" },
  });
  await req(
    "/api/incidents/" + currentReport.id + "/transition",
    guard,
    { status: "Acknowledged" },
    403,
  );
  const guardState = await req("/api/state", guard);
  assert.deepEqual(guardState.shifts.map((s) => s.id), [current.id]);
  assert.equal(
    guardState.events.some((e) => e.id === old.id),
    false,
    "a guard must not receive a prior-shift event from the API",
  );
  assert.equal(
    guardState.incidents.some((i) => i.id === old.id),
    false,
    "a guard must not receive a prior-shift report from the API",
  );
  const guardedCurrent = guardState.incidents.find((i) => i.id === currentReport.id);
  assert.deepEqual(guardedCurrent.history, []);
  assert.deepEqual(guardedCurrent.revisions, []);
  const browser = await chromium.launch({
    executablePath:
      process.env.CHROME_PATH ||
      "C:/Program Files/Google/Chrome/Application/chrome.exe",
    headless: true,
  });
  try {
    const ctx = await browser.newContext({
        viewport: { width: 390, height: 844 },
      }),
      p = await ctx.newPage();
    await p.goto(base);
    await p.locator("#password").fill("Pilot-only-2026!");
    await p.getByRole("button", { name: "Sign in", exact: true }).click();
    await p
      .getByRole("button", { name: "Report a problem", exact: true })
      .click();
    assert.equal(
      await p.locator("#shiftReportHistory").evaluate((el) => el.open),
      false,
    );
    await p.locator("#shiftReportHistory > summary").click();
    assert.equal(await p.locator(".shift-report-entry").count(), 1);
    await p.getByText("Previous Reports (1)", { exact: true }).waitFor();
    assert.match(
      await p.locator(".shift-report-entry").innerText(),
      /^Reported On \d{2}\/\d{2}\/\d{4}, \d{2}:\d{2}$/,
    );
    assert.equal(
      await p
        .getByText("Previous shift private report", { exact: true })
        .count(),
      0,
    );
    await p.locator("#typedReport").evaluate((el) => (el.open = true));
    await p.locator("#report").fill("Draft remains unchanged");
    await p.locator(".shift-report-entry").click();
    await p.getByRole("heading", { name: /^Reported On / }).waitFor();
    assert.equal(
      await p.locator("#savedReportText").getAttribute("readonly"),
      "",
    );
    assert.equal(
      await p.locator("#savedReportText").inputValue(),
      "This shift: damaged light reported",
    );
    await p.getByText("No Images Attached", { exact: true }).waitFor();
    assert.equal(
      await p.getByRole("button", { name: "Home", exact: true }).count(),
      0,
    );
    await p.getByRole("button", { name: "Reports", exact: true }).click();
    assert.equal(
      await p.locator("#report").inputValue(),
      "Draft remains unchanged",
    );
    await p.evaluate(() => navigator.serviceWorker.ready);
    await ctx.setOffline(true);
    await p.getByRole("button", { name: "Submit", exact: true }).click();
    await approveDialog(p);
    await p
      .getByRole("button", { name: "Report a problem", exact: true })
      .click();
    await p.locator("#shiftReportHistory > summary").click();
    assert.equal(await p.locator(".shift-report-entry").count(), 2);
    await p.screenshot({
      path: path.join(data, "compact-report-history.png"),
      fullPage: true,
    });
    await p.locator(".shift-report-entry").first().click();
    assert.equal(
      await p.locator("#savedReportText").inputValue(),
      "Draft remains unchanged",
    );

    await p.screenshot({
      path: path.join(data, "guard-report-history.png"),
      fullPage: true,
    });
    await ctx.close();
  } finally {
    await browser.close();
  }
});

test("recorded shift instructions: owner publishes, scoped private playback, offline and immutable shift version", async () => {
  await req("/api/instructions/oak", guard, { instructions: "no" }, 403);
  await req("/api/instructions/oak", other, { instructions: "no" }, 403);
  const browser = await chromium.launch({
    executablePath:
      process.env.CHROME_PATH ||
      "C:/Program Files/Google/Chrome/Application/chrome.exe",
    headless: true,
    args: [
      "--use-fake-device-for-media-stream",
      "--use-fake-ui-for-media-stream",
    ],
  });
  try {
    const ctx = await browser.newContext({
        viewport: { width: 390, height: 844 },
      }),
      p = await ctx.newPage();
    await p.goto(base);
    await p.locator("#email").fill("owner@demo.isdl");
    await p.locator("#password").fill("Pilot-only-2026!");
    await p.getByRole("button", { name: "Sign in", exact: true }).click();
    await p
      .getByRole("button", { name: "Shift instructions", exact: true })
      .click();
    await p
      .locator("#instructionText")
      .fill("Keep the walkway clear. Message your supervisor for help.");
    await p.locator("#recordInstructions").click();
    await p.getByRole("button", { name: "Tap to stop", exact: true }).click();
    await p.locator("#instructionPreview").evaluate((el) => el.play());
    await p.waitForFunction(
      () => document.querySelector("#instructionPreview").currentTime > 0,
    );
    await p.locator("#publishInstructions").click();
    await p
      .getByText("Instructions published for future shifts.", { exact: true })
      .waitFor();
    const state = await req("/api/state", guard),
      version = state.sites[0].instruction_audio;
    assert.ok(version);
    const { url } = await req("/api/instructions/" + version + "/link", guard);
    await req("/api/instructions/" + version + "/link", other, null, 403);
    assert.equal(
      (await fetch(base + url, { headers: { cookie: other } })).status,
      403,
    );
    assert.equal(
      (
        await fetch(base + url.replace(/expires=\d+/, "expires=0"), {
          headers: { cookie: guard },
        })
      ).status,
      403,
    );
    for (const s of state.shifts.filter((s) => !s.ended_at))
      await req("/api/events", guard, event("end", { shift_id: s.id }));
    const start = event("start");
    await req("/api/events", guard, start);
    const form = new FormData();
    form.set("instructions", "Future shift typed instructions only.");
    await req("/api/instructions/oak", supervisor, form);
    const updated = await req("/api/state", guard);
    assert.equal(
      updated.events.find((e) => e.id === start.id).payload.instruction_audio,
      version,
    );
    await ctx.close();
    const gc = await browser.newContext({
        viewport: { width: 390, height: 844 },
      }),
      g = await gc.newPage();
    await g.goto(base);
    await g.locator("#password").fill("Pilot-only-2026!");
    await g.getByRole("button", { name: "Sign in", exact: true }).click();
    await g
      .getByRole("button", { name: "Hear instructions", exact: true })
      .click();
    await g.locator("#instructionPlayback audio").waitFor();
    await g
      .getByText("Keep the walkway clear. Message your supervisor for help.", {
        exact: true,
      })
      .waitFor();
    assert.equal(
      await g
        .getByText("Supervisor-approved instructions.", { exact: true })
        .count(),
      0,
    );
    assert.equal(
      await g.getByRole("button", { name: "Enable patrol reminders" }).count(),
      0,
    );
    await g
      .getByRole("button", { name: "Message supervisor", exact: true })
      .waitFor();
    await g.evaluate(() => navigator.serviceWorker.ready);
    await gc.setOffline(true);
    await g.getByRole("button", { name: "Home", exact: true }).click();
    await g
      .getByRole("button", { name: "Hear instructions", exact: true })
      .click();
    await g.locator("#instructionPlayback audio").evaluate((el) => el.play());
    await g.waitForFunction(
      () =>
        document.querySelector("#instructionPlayback audio").currentTime > 0,
    );
    await g.screenshot({
      path: path.join(data, "recorded-instructions.png"),
      fullPage: true,
    });
    await gc.close();
    await req("/api/events", guard, event("end", { shift_id: start.id }));
    await req("/api/events", guard, event("start"));
    const tc = await browser.newContext({
        viewport: { width: 390, height: 844 },
      }),
      t = await tc.newPage();
    await t.goto(base);
    await t.locator("#password").fill("Pilot-only-2026!");
    await t.getByRole("button", { name: "Sign in", exact: true }).click();
    await t
      .getByRole("button", { name: "Hear instructions", exact: true })
      .click();
    await t
      .getByText("Future shift typed instructions only.", { exact: true })
      .waitFor();
    assert.equal(await t.locator("#instructionPlayback audio").count(), 0);
    await tc.close();
    const dc = await browser.newContext(),
      d = await dc.newPage();
    await d.addInitScript(() => {
      navigator.mediaDevices.getUserMedia = async () => {
        throw new Error(
          "Microphone permission denied. Type instructions instead.",
        );
      };
    });
    await d.goto(base);
    await d.locator("#email").fill("owner@demo.isdl");
    await d.locator("#password").fill("Pilot-only-2026!");
    await d.getByRole("button", { name: "Sign in", exact: true }).click();
    await d
      .getByRole("button", { name: "Shift instructions", exact: true })
      .click();
    await d.locator("#recordInstructions").click();
    await d
      .getByText("Microphone permission denied. Type instructions instead.", {
        exact: true,
      })
      .waitFor();
    assert.equal(await d.locator("#publishInstructions").isEnabled(), true);
    await dc.close();
  } finally {
    await browser.close();
  }
});

test("voice supervisor messages: photo, offline reload, failed upload retry and private inbox playback", { skip: "In-app messaging is deliberately disabled for the MVP." }, async () => {
  if (!(await req("/api/state", guard)).shifts.some((s) => !s.ended_at))
    await req("/api/events", guard, event("start"));
  const browser = await chromium.launch({
    executablePath:
      process.env.CHROME_PATH ||
      "C:/Program Files/Google/Chrome/Application/chrome.exe",
    headless: true,
    args: [
      "--use-fake-device-for-media-stream",
      "--use-fake-ui-for-media-stream",
    ],
  });
  try {
    const ctx = await browser.newContext({
        viewport: { width: 390, height: 844 },
      }),
      p = await ctx.newPage();
    const signIn = async () => {
      await p.locator("#password").fill("Pilot-only-2026!");
      await p.getByRole("button", { name: "Sign in", exact: true }).click();
      await p
        .getByRole("button", { name: "Message supervisor", exact: true })
        .click();
    };
    await p.goto(base);
    await signIn();
    assert.equal(
      await p.getByText("What would you like to say?", { exact: true }).count(),
      0,
    );
    assert.equal(
      await p
        .getByRole("button", { name: "I am running late", exact: true })
        .count(),
      0,
    );
    assert.equal(await p.locator("#submitReport").isDisabled(), true);
    await p.getByRole("button", { name: "Take a photo", exact: true }).click();
    await p.getByRole("button", { name: "Capture photo", exact: true }).click();
    assert.equal(await p.locator("#submitReport").isDisabled(), true);
    await p.locator("#record").click();
    await p.getByText(/Recording ·/).waitFor();
    await p.waitForFunction(() =>
      /00:01/.test(document.querySelector("#recordStatus").textContent),
    );
    await p.locator("#record").click();
    await p
      .locator('audio[aria-label="Your recording"]')
      .evaluate((el) => el.play());
    await p.waitForFunction(
      () =>
        document.querySelector('audio[aria-label="Your recording"]')
          .currentTime > 0,
    );
    await p.screenshot({
      path: path.join(data, "voice-message-composer.png"),
      fullPage: true,
    });
    await p.evaluate(() => navigator.serviceWorker.ready);
    await ctx.setOffline(true);
    await p.getByRole("button", { name: "Send message", exact: true }).click();
    await p
      .getByText("Saved on this phone — not sent yet", { exact: true })
      .waitFor();
    await p.reload();
    await p.getByRole("heading", { name: "Hello, Bala." }).waitFor();
    await p.locator("[data-message-media] audio").evaluate((el) => el.play());
    await p.waitForFunction(
      () =>
        document.querySelector("[data-message-media] audio").currentTime > 0,
    );
    let rejectUploads = true;
    await ctx.route("**/api/media/**", (route) =>
      rejectUploads && route.request().method() === "POST"
        ? route.abort()
        : route.continue(),
    );
    await ctx.setOffline(false);
    await p
      .getByRole("button", { name: "Retry upload", exact: true })
      .waitFor();
    rejectUploads = false;
    await p.getByRole("button", { name: "Retry upload", exact: true }).click();

    await p.waitForFunction(
      () =>
        document.querySelectorAll("[data-message-media] audio").length === 1 &&
        !document.body.textContent.includes(
          "Attachments may still be uploading.",
        ),
    );
    let state;
    const deadline = Date.now() + 15000;
    do {
      state = await req("/api/state", supervisor);
      if (
        state.events.some(
          (e) =>
            e.kind === "message" && e.payload.has_audio && e.media.length === 2,
        )
      )
        break;
      await new Promise((resolve) => setTimeout(resolve, 100));
    } while (Date.now() < deadline);
    const messages = state.events.filter(
      (e) => e.kind === "message" && e.payload.has_audio,
    );
    assert.equal(messages.length, 1);
    const message = messages[0];
    assert.equal(message.media.length, 2);
    assert.equal(message.payload.text, "");
    await req("/api/media/" + message.media[0].id + "/link", owner, null, 403);
    await req("/api/media/" + message.media[0].id + "/link", other, null, 403);
    const link = await req(
      "/api/media/" + message.media[0].id + "/link",
      supervisor,
    );
    assert.equal(
      (await fetch(base + link.url, { headers: { cookie: owner } })).status,
      403,
    );
    const own = await req("/api/state", owner);
    assert.equal(
      own.events.some((e) => e.id === message.id),
      false,
    );
    await ctx.close();
    const sc = await browser.newContext({
        viewport: { width: 390, height: 844 },
      }),
      sp = await sc.newPage();
    await sp.goto(base);
    await sp.locator("#email").fill("supervisor@demo.isdl");
    await sp.locator("#password").fill("Pilot-only-2026!");
    await sp.getByRole("button", { name: "Sign in", exact: true }).click();
    await sp.getByRole("button", { name: "Messages", exact: true }).click();
    const inbox = sp.locator('[data-message-media="' + message.id + '"]');
    await sp.waitForFunction(
      (id) =>
        document.querySelector('[data-message-media="' + id + '"] audio')
          ?.readyState >= 2,
      message.id,
    );
    await inbox.locator("audio").evaluate(async (el) => {
      await el.play();
      await new Promise((resolve, reject) => {
        const tick = setInterval(() => {
          if (el.currentTime > 0) {
            clearInterval(tick);
            resolve();
          } else if (!el.isConnected) {
            clearInterval(tick);
            reject(Error("Playing audio was replaced"));
          }
        }, 50);
        setTimeout(() => {
          clearInterval(tick);
          reject(
            Error(
              "Audio did not advance: " +
                JSON.stringify({
                  paused: el.paused,
                  ready: el.readyState,
                  error: el.error?.message,
                  duration: el.duration,
                }),
            ),
          );
        }, 5000);
      });
    });
    assert.ok(
      await inbox
        .locator("img")
        .evaluate((el) => el.complete && el.naturalWidth > 0),
    );
    await inbox.scrollIntoViewIfNeeded();
    await sp.screenshot({
      path: path.join(data, "supervisor-message-media.png"),
    });
    await sc.close();
  } finally {
    await browser.close();
  }
});

test("two-way shift chat: current guard view, supervisor history and named replies", { skip: "In-app messaging is deliberately disabled for the MVP." }, async () => {
  for (const active of (await req("/api/state", guard)).shifts.filter(
    (s) => !s.ended_at,
  ))
    await req("/api/events", guard, event("end", { shift_id: active.id }));
  const first = event("start");
  await req("/api/events", guard, first);
  await req(
    "/api/events",
    guard,
    event("message", { text: "Earlier shift message", shift_id: first.id }),
  );
  const oldReply = event("message", {
    text: "Earlier supervisor reply",
    guard_id: "bala",
    shift_id: first.id,
  });
  await req("/api/events", supervisor, oldReply);
  await req("/api/events", guard, event("end", { shift_id: first.id }));
  const current = event("start");
  await req("/api/events", guard, current);
  await req(
    "/api/events",
    guard,
    event("message", { text: "Current shift message", shift_id: current.id }),
  );
  await req(
    "/api/events",
    owner,
    event("message", {
      text: "Forbidden",
      guard_id: "bala",
      shift_id: current.id,
    }),
    403,
  );
  await req(
    "/api/events",
    other,
    event("message", {
      text: "Forbidden",
      guard_id: "bala",
      shift_id: current.id,
    }),
    403,
  );
  await req("/api/admin", supervisor, {
    kind: "user",
    site_id: "oak",
    name: "Second Guard",
    email: "secondguard@demo.isdl",
    password: "Pilot-only-2026!",
    role: "guard",
  });
  const second = await login("secondguard");
  await req(
    "/api/events",
    second,
    event("message", {
      text: "Wrong thread",
      guard_id: "bala",
      shift_id: current.id,
    }),
    403,
  );
  await req(
    "/api/events",
    supervisor,
    event("message", {
      text: "Wrong shift guard",
      guard_id: (await req("/api/state", second)).user.id,
      shift_id: current.id,
    }),
    403,
  );
  const browser = await chromium.launch({
    executablePath:
      process.env.CHROME_PATH ||
      "C:/Program Files/Google/Chrome/Application/chrome.exe",
    headless: true,
    args: [
      "--use-fake-device-for-media-stream",
      "--use-fake-ui-for-media-stream",
    ],
  });
  try {
    const sc = await browser.newContext({
        viewport: { width: 390, height: 844 },
      }),
      sp = await sc.newPage();
    await sp.goto(base);
    await sp.locator("#email").fill("supervisor@demo.isdl");
    await sp.locator("#password").fill("Pilot-only-2026!");
    await sp.getByRole("button", { name: "Sign in", exact: true }).click();
    await sp.getByRole("button", { name: "Messages", exact: true }).click();
    await sp.locator("#chatSelect").selectOption(current.id);
    await sp.getByText("Current shift message", { exact: true }).waitFor();
    await sp.locator("#record").click();
    await sp.waitForFunction(() =>
      /00:01/.test(document.querySelector("#recordStatus").textContent),
    );
    await sp.locator("#record").click();
    await sp.locator('audio[aria-label="Your recording"]').waitFor();
    await sp.getByRole("button", { name: "Take a photo", exact: true }).click();
    await sp
      .getByRole("button", { name: "Capture photo", exact: true })
      .click();
    await sp.getByRole("button", { name: "Send message", exact: true }).click();
    let reply;
    const deadline = Date.now() + 15000;
    do {
      reply = (await req("/api/state", guard)).events.find(
        (e) =>
          e.kind === "message" &&
          e.user_id === "supervisor" &&
          e.payload.shift_id === current.id &&
          e.media?.length === 2,
      );
      if (reply) break;
      await new Promise((r) => setTimeout(r, 100));
    } while (Date.now() < deadline);
    assert.ok(reply, "Guard receives supervisor voice and photo");
    assert.equal(
      (
        await req("/api/events", supervisor, {
          ...reply,
          payload: reply.payload,
        })
      ).duplicate,
      true,
    );
    assert.equal(
      (await req("/api/state", second)).events.some((e) => e.id === reply.id),
      false,
    );
    await req("/api/media/" + reply.media[0].id + "/link", second, null, 403);
    await req("/api/media/" + reply.media[0].id + "/link", owner, null, 403);
    const { url } = await req(
      "/api/media/" + reply.media[0].id + "/link",
      guard,
    );
    assert.equal(
      (await fetch(base + url, { headers: { cookie: second } })).status,
      403,
    );
    await sp.locator("#chatSelect").selectOption(first.id);
    await sp.getByText("Earlier supervisor reply", { exact: true }).waitFor();
    await sc.close();
    const gc = await browser.newContext({
        viewport: { width: 390, height: 844 },
      }),
      g = await gc.newPage();
    await g.goto(base);
    await g.locator("#password").fill("Pilot-only-2026!");
    await g.getByRole("button", { name: "Sign in", exact: true }).click();
    await g
      .getByRole("button", { name: "Message supervisor", exact: true })
      .click();
    await g.getByText("Current shift message", { exact: true }).waitFor();
    assert.equal(
      await g.getByText("Earlier shift message", { exact: true }).count(),
      0,
    );
    const incoming = g.locator(".chat-bubble.incoming");
    await incoming.locator("audio").waitFor();
    await g.waitForFunction(
      () => document.querySelector(".incoming audio")?.readyState >= 2,
    );
    await incoming.locator("audio").evaluate((el) => el.play());
    await g.waitForFunction(
      () => document.querySelector(".incoming audio")?.currentTime > 0,
    );
    assert.ok(
      await incoming
        .locator("img")
        .evaluate((el) => el.complete && el.naturalWidth > 0),
    );
    await g.locator("#chatMessages").scrollIntoViewIfNeeded();
    await g.screenshot({
      path: path.join(data, "two-way-shift-chat.png"),
      fullPage: true,
    });
    assert.equal(
      await g.getByText("Previous conversations", { exact: true }).count(),
      0,
    );
    await incoming.getByText("Ada", { exact: true }).waitFor();
    assert.equal(
      await incoming.evaluate((el) => getComputedStyle(el).backgroundColor),
      "rgba(0, 0, 0, 0)",
    );
    assert.equal(
      (await req("/api/state", guard)).events.some((e) => e.id === oldReply.id),
      false,
    );
    await req("/api/events", guard, event("end", { shift_id: current.id }));
    await req("/api/media/" + reply.media[0].id + "/link", guard, null, 403);
    assert.equal(
      (await fetch(base + url, { headers: { cookie: guard } })).status,
      403,
    );
    await req("/api/media/" + reply.media[0].id + "/link", supervisor);
    await gc.close();
  } finally {
    await browser.close();
  }
});

test("messaging requires a shift; late synchronization preserves on-duty capture", { skip: "In-app messaging is deliberately disabled for the MVP." }, async () => {
  for (const s of (await req("/api/state", guard)).shifts.filter(
    (s) => !s.ended_at,
  ))
    await req("/api/events", guard, event("end", { shift_id: s.id }));
  await req(
    "/api/events",
    guard,
    event("message", { text: "Off duty blocked" }),
    403,
  );
  await req(
    "/api/events",
    guard,
    event("message", { text: "Null shift blocked", shift_id: null }),
    403,
  );
  await req(
    "/api/events",
    supervisor,
    event("message", {
      text: "No off-duty thread",
      guard_id: "bala",
      shift_id: null,
    }),
    403,
  );
  const begin = event("start");
  await req("/api/events", guard, begin);
  const captured = event("message", {
    text: "Captured during shift, uploaded later",
    shift_id: begin.id,
  });
  await req("/api/events", guard, event("end", { shift_id: begin.id }));
  await req("/api/events", guard, captured);
  assert.equal((await req("/api/events", guard, captured)).duplicate, true);
  const after = event("message", {
    text: "After end rejected",
    shift_id: begin.id,
  });
  after.captured_at = new Date(Date.now() + 1000).toISOString();
  await req("/api/events", guard, after, 403);
  const before = event("message", {
    text: "Before start rejected",
    shift_id: begin.id,
  });
  before.captured_at = new Date(
    Date.parse(begin.captured_at) - 1000,
  ).toISOString();
  await req("/api/events", guard, before, 403);
  assert.ok(
    (await req("/api/state", supervisor)).events.find(
      (e) => e.id === captured.id,
    )?.payload.shift_id === begin.id,
  );
});

test("empty current conversation stays hidden until a named supervisor sends the first message", { skip: "In-app messaging is deliberately disabled for the MVP." }, async () => {
  for (const s of (await req("/api/state", guard)).shifts.filter(
    (s) => !s.ended_at,
  ))
    await req("/api/events", guard, event("end", { shift_id: s.id }));
  const start = event("start");
  await req("/api/events", guard, start);
  const browser = await chromium.launch({
    executablePath:
      process.env.CHROME_PATH ||
      "C:/Program Files/Google/Chrome/Application/chrome.exe",
    headless: true,
  });
  try {
    const ctx = await browser.newContext({
        viewport: { width: 390, height: 844 },
      }),
      p = await ctx.newPage();
    await p.goto(base);
    await p.locator("#password").fill("Pilot-only-2026!");
    await p.getByRole("button", { name: "Sign in", exact: true }).click();
    await p
      .getByRole("button", { name: "Message supervisor", exact: true })
      .click();
    assert.equal(await p.locator(".conversation").isVisible(), false);
    assert.equal(
      await p.getByText("Previous conversations", { exact: true }).count(),
      0,
    );
    await p.screenshot({
      path: path.join(data, "empty-chat-hidden.png"),
      fullPage: true,
    });
    await req(
      "/api/events",
      supervisor,
      event("message", {
        guard_id: "bala",
        shift_id: start.id,
        text: "Please check the back gate lock.",
      }),
    );
    await p
      .getByText("Please check the back gate lock.", { exact: true })
      .waitFor();
    assert.equal(await p.locator(".conversation").isVisible(), true);
    await p.locator(".incoming").getByText("Ada", { exact: true }).waitFor();
    assert.ok(await p.locator(".incoming small").textContent());
    await p.locator("#typedReport > summary").click();
    await p.locator("#report").fill("I will check it now.");
    await p.getByRole("button", { name: "Send message", exact: true }).click();
    await p.locator(".outgoing").getByText("You", { exact: true }).waitFor();
    await p.locator("#chatMessages").scrollIntoViewIfNeeded();
    await p.screenshot({
      path: path.join(data, "plain-current-chat.png"),
      fullPage: true,
    });
    await ctx.close();
  } finally {
    await browser.close();
  }
});

test("newest messages first and current-shift unread badge persists and clears offline", { skip: "In-app messaging is deliberately disabled for the MVP." }, async () => {
  for (const s of (await req("/api/state", guard)).shifts.filter(
    (s) => !s.ended_at,
  ))
    await req("/api/events", guard, event("end", { shift_id: s.id }));
  const start = event("start");
  await req("/api/events", guard, start);
  const first = event("message", {
    guard_id: "bala",
    shift_id: start.id,
    text: "First supervisor message",
  });
  await req("/api/events", supervisor, first);
  const second = event("message", {
    guard_id: "bala",
    shift_id: start.id,
    text: "Latest supervisor message",
  });
  second.captured_at = new Date(
    Date.parse(first.captured_at) + 1000,
  ).toISOString();
  await req("/api/events", supervisor, second);
  const browser = await chromium.launch({
    executablePath:
      process.env.CHROME_PATH ||
      "C:/Program Files/Google/Chrome/Application/chrome.exe",
    headless: true,
  });
  try {
    const ctx = await browser.newContext({
        viewport: { width: 390, height: 844 },
      }),
      p = await ctx.newPage();
    const signIn = async () => {
      await p.locator("#password").fill("Pilot-only-2026!");
      await p.getByRole("button", { name: "Sign in", exact: true }).click();
      await p.getByRole("heading", { name: "Hello, Bala." }).waitFor();
    };
    await p.goto(base);
    await signIn();
    await p.getByText("2 new", { exact: true }).waitFor();
    await p.screenshot({
      path: path.join(data, "home-unread-messages.png"),
      fullPage: true,
    });
    await p.evaluate(() => navigator.serviceWorker.ready);
    await ctx.setOffline(true);
    await p
      .getByRole("button", { name: "Message supervisor", exact: true })
      .click();
    await p
      .getByRole("heading", { name: "Previous messages", exact: true })
      .waitFor();
    assert.deepEqual(
      await p.locator("#chatMessages .chat-text").allTextContents(),
      ["Latest supervisor message", "First supervisor message"],
    );
    await p.locator("#chatMessages").scrollIntoViewIfNeeded();
    await p.screenshot({
      path: path.join(data, "newest-messages-first.png"),
      fullPage: true,
    });
    await p.getByRole("button", { name: "Home", exact: true }).click();
    assert.equal(await p.locator("#unreadMessages").count(), 0);
    await p.reload();
    await p.getByRole("heading", { name: "Hello, Bala." }).waitFor();
    assert.equal(await p.locator("#unreadMessages").count(), 0);
    await ctx.setOffline(false);
    const deadline = Date.now() + 15000;
    let seen;
    do {
      seen = (await req("/api/state", supervisor)).sentNotifications.filter(
        (n) => [first.id, second.id].includes(n.event_id),
      );
      if (seen.length === 2 && seen.every((n) => n.status === "delivered"))
        break;
      await new Promise((r) => setTimeout(r, 100));
    } while (Date.now() < deadline);
    assert.equal(seen.length, 2);
    assert.ok(seen.every((n) => n.status === "delivered"));
    await req(
      "/api/events",
      supervisor,
      event("message", {
        guard_id: "bala",
        shift_id: start.id,
        text: "A new unread reply",
      }),
    );
    await p.getByText("1 new", { exact: true }).waitFor({ timeout: 45000 });
    await p
      .getByRole("button", { name: "Message supervisor", exact: true })
      .click();
    await p.getByText("A new unread reply", { exact: true }).waitFor();
    await p.getByRole("button", { name: "Home", exact: true }).click();
    assert.equal(await p.locator("#unreadMessages").count(), 0);
    await ctx.close();
  } finally {
    await browser.close();
  }
});

test("refresh restores each role, offline drafts, and explicit sign-out still locks saved work", async () => {
  if (!(await req("/api/state", guard)).shifts.some((s) => !s.ended_at))
    await req("/api/events", guard, event("start"));
  const browser = await chromium.launch({
    executablePath:
      process.env.CHROME_PATH ||
      "C:/Program Files/Google/Chrome/Application/chrome.exe",
    headless: true,
  });
  try {
    for (const role of ["bala", "owner", "supervisor"]) {
      const ctx = await browser.newContext({
          viewport: { width: 390, height: 844 },
        }),
        p = await ctx.newPage();
      await p.goto(base);
      await p.locator("#email").fill(role + "@demo.isdl");
      await p.locator("#password").fill("Pilot-only-2026!");
      await p.getByRole("button", { name: "Sign in", exact: true }).click();
      await p.getByRole("button", { name: "Sign out", exact: true }).waitFor();
      if (role === "bala") {
        await p
          .getByRole("button", { name: "Report a problem", exact: true })
          .click();
        await p.locator("#typedReport > summary").click();
        await p
          .locator("#report")
          .fill("Draft survives refreshing this shared phone.");
        await p.locator("#libraryPhoto").setInputFiles({
          name: "gate.png",
          mimeType: "image/png",
          buffer: Buffer.from(
            "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aUAAAAABJRU5ErkJggg==",
            "base64",
          ),
        });
        await p.locator("img.photo").waitFor();
      }
      await p.reload();
      await p.getByRole("button", { name: "Sign out", exact: true }).waitFor();
      assert.equal(await p.locator("#login").count(), 0);
      assert.equal(
        await p.evaluate(() =>
          sessionStorage
            .getItem("guard-tab-session-v1")
            .includes("Pilot-only-2026!"),
        ),
        false,
      );
      if (role === "bala") {
        assert.equal(
          await p.locator("#report").inputValue(),
          "Draft survives refreshing this shared phone.",
        );
        await p.evaluate(() => navigator.serviceWorker.ready);
        await ctx.setOffline(true);
        await p.reload();
        await p.locator("#report").waitFor();
        assert.equal(
          await p.locator("#report").inputValue(),
          "Draft survives refreshing this shared phone.",
        );
        assert.equal(await p.locator("img.photo").count(), 1);
      }
      await p.getByRole("button", { name: "Sign out", exact: true }).click();
      await p.getByRole("heading", { name: "Welcome back" }).waitFor();
      assert.equal(
        await p.evaluate(() => sessionStorage.getItem("guard-tab-session-v1")),
        null,
      );
      await p.reload();
      await p.getByRole("heading", { name: "Welcome back" }).waitFor();
      if (role === "bala") {
        await p.locator("#password").fill("Pilot-only-2026!");
        await p.getByRole("button", { name: "Sign in", exact: true }).click();
        await p
          .getByRole("button", { name: "Report a problem", exact: true })
          .click();
        assert.equal(
          await p.locator("#report").inputValue(),
          "Draft survives refreshing this shared phone.",
        );
        await p.evaluate(() => {
          const s = JSON.parse(sessionStorage.getItem("guard-tab-session-v1"));
          s.expiresAt = 0;
          sessionStorage.setItem("guard-tab-session-v1", JSON.stringify(s));
        });
        await p.reload();
        await p.getByRole("heading", { name: "Welcome back" }).waitFor();
      }
      await ctx.close();
    }
    const ctx = await browser.newContext(),
      p = await ctx.newPage();
    await p.goto(base);
    await p.locator("#password").fill("Pilot-only-2026!");
    await p.getByRole("button", { name: "Sign in", exact: true }).click();
    await p.getByRole("button", { name: "Sign out", exact: true }).waitFor();
    await ctx.clearCookies();
    await p.reload();
    await p.getByRole("heading", { name: "Welcome back" }).waitFor();
    assert.equal(
      await p.evaluate(() => sessionStorage.getItem("guard-tab-session-v1")),
      null,
    );
    await ctx.close();
  } finally {
    await browser.close();
  }
});

test("sign-out invalidates a restored second tab", async () => {
  const browser = await chromium.launch({
    executablePath:
      process.env.CHROME_PATH ||
      "C:/Program Files/Google/Chrome/Application/chrome.exe",
    headless: true,
  });
  try {
    const ctx = await browser.newContext(),
      p = await ctx.newPage();
    await p.goto(base);
    await p.locator("#password").fill("Pilot-only-2026!");
    await p.getByRole("button", { name: "Sign in", exact: true }).click();
    await p.getByRole("button", { name: "Sign out", exact: true }).waitFor();
    const popup = ctx.waitForEvent("page");
    await p.evaluate(() => window.open("/", "_blank"));
    const otherTab = await popup;
    await otherTab
      .getByRole("button", { name: "Sign out", exact: true })
      .waitFor();
    await p.getByRole("button", { name: "Sign out", exact: true }).click();
    if (await p.locator("[data-confirm=accept]").count()) await approveDialog(p);
    await otherTab.getByRole("heading", { name: "Welcome back" }).waitFor();
    await otherTab.reload();
    await otherTab.getByRole("heading", { name: "Welcome back" }).waitFor();
    assert.equal(
      await otherTab.evaluate(() =>
        sessionStorage.getItem("guard-tab-session-v1"),
      ),
      null,
    );
    await ctx.close();
  } finally {
    await browser.close();
  }
});

test("concurrent retries create one report and attachment; competing shifts remain unique", async () => {
  // More simultaneous logins than the database pool's size must not deadlock.
  await Promise.all(Array.from({ length: 6 }, () => login("bala")));
  let active = (await req("/api/state", guard)).shifts.find((s) => !s.ended_at);
  if (!active) {
    const start = event("start");
    await req("/api/events", guard, start);
    active = { id: start.id };
  }
  const report = event("incident", {
    shift_id: active.id,
    event_time: "Around nine",
    report: "Concurrent retry verification (fictional).",
    approved: true,
    transcript: "",
  });
  const replies = await Promise.all(
    Array.from({ length: 5 }, () => req("/api/events", guard, report)),
  );
  assert.equal(replies.filter((r) => !r.duplicate).length, 1);
  const mediaId = randomUUID();
  const bytes = Buffer.from(
    "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aUAAAAABJRU5ErkJggg==",
    "base64",
  );
  const uploaded = await Promise.all(
    Array.from({ length: 3 }, () => {
      const form = new FormData();
      form.append(
        "file",
        new Blob([bytes], { type: "image/png" }),
        "fixture.png",
      );
      form.append("source", "photo library");
      return req("/api/media/" + report.id + "/" + mediaId, guard, form);
    }),
  );
  assert.equal(uploaded.filter((r) => !r.duplicate).length, 1);
  const state = await req("/api/state", owner);
  const saved = state.incidents.find((i) => i.id === report.id);
  assert.equal(saved.media.length, 1);
  assert.equal(saved.revisions.length, 1);
  assert.equal(state.events.filter((e) => e.id === report.id).length, 1);
  await req("/api/events", guard, event("end", { shift_id: active.id }));
  const competing = await Promise.all(
    [event("start"), event("start")].map(async (body) => {
      const response = await fetch(base + "/api/events", {
        method: "POST",
        headers: {
          cookie: guard,
          "X-Session-Proof": guard.split("=")[1],
          "Content-Type": "application/json",
        },
        body: JSON.stringify(body),
      });
      return response.status;
    }),
  );
  assert.deepEqual(competing.sort(), [200, 409]);
  const duty = (await req("/api/state", guard)).shifts.filter(
    (s) => !s.ended_at,
  );
  assert.equal(duty.length, 1);
  await req("/api/events", guard, event("end", { shift_id: duty[0].id }));
});
