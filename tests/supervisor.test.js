import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { randomUUID } from "node:crypto";
import { chromium } from "@playwright/test";
const base = process.env.SUPERVISOR_TEST_BASE_URL || "http://127.0.0.1:3104",
  data = path.resolve("data", "supervisor-test-" + Date.now());
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
before(async () => {
  fs.mkdirSync(data, { recursive: true });
  if (!process.env.SUPERVISOR_TEST_BASE_URL) {
    server = spawn(process.execPath, ["server.js"], {
      env: {
        ...process.env,
        PORT: "3104",
        DATA_DIR: data,
        OPENAI_API_KEY: "",
        DATABASE_URL: "",
        BLOB_READ_WRITE_TOKEN: "",
        VERCEL: "",
      },
      stdio: "pipe",
    });
    await new Promise((resolve, reject) => {
      server.stdout.on("data", (d) => {
        if (String(d).includes("running")) resolve();
      });
      server.on("exit", (c) => reject(new Error("Server exited " + c)));
    });
  }
  [guard, owner, supervisor, other] = await Promise.all(
    ["bala", "owner", "supervisor", "other"].map(login),
  );
});
after(() => server?.kill());
test("customer account hierarchy restricts creation and assignments", async () => {
  const email = `supervisor-${randomUUID()}@demo.isdl`;
  const payload = {
    kind: "user",
    site_id: "oak",
    name: "Client supervisor",
    email,
    password: "Pilot-only-2026!",
    role: "supervisor",
  };
  await req("/api/admin", owner, payload);
  const state = await req("/api/state", owner);
  const created = state.users.find(
    (u) => u.email === email || u.name === "Client supervisor",
  );
  assert.ok(created);
  const otherState = await req("/api/state", other);
  await req("/api/admin", other, {
    ...payload,
    site_id: otherState.sites[0].id,
    email: `other-supervisor-${randomUUID()}@demo.isdl`,
    name: "Other supervisor",
  });
  const foreignSupervisor = (await req("/api/state", other)).users.find(
    (u) => u.name === "Other supervisor",
  );
  await req(
    "/api/admin",
    owner,
    { kind: "assign", site_id: "oak", user_id: foreignSupervisor.id },
    403,
  );
  const r = await fetch(base + "/api/login", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password: payload.password }),
  });
  assert.equal(r.status, 200);
  const cookie = r.headers.get("set-cookie").split(";")[0];
  await req("/api/admin", cookie, {
    ...payload,
    email: `guard-${randomUUID()}@demo.isdl`,
    role: "guard",
    name: "New guard",
  });
  await req("/api/admin", supervisor, { ...payload, role: "owner" }, 403);
  await req("/api/admin", supervisor, payload, 403);
  await req("/api/admin", owner, { ...payload, role: "guard" }, 403);
  await req("/api/admin", other, payload, 403);
  await req(
    "/api/admin",
    supervisor,
    { kind: "customer", name: "Unrelated", site_name: "New" },
    403,
  );
  await req(
    "/api/admin",
    supervisor,
    { kind: "additional_site", site_id: "oak", name: "New" },
    403,
  );
  await req(
    "/api/admin",
    supervisor,
    { kind: "assign", site_id: "oak", user_id: "owner" },
    403,
  );
  await req(
    "/api/admin",
    owner,
    { kind: "assign", site_id: "oak", user_id: "other" },
    403,
  );
});

test("supervisor pages retain a mobile canvas on phone and desktop", async () => {
  const guards = (await req("/api/state", supervisor)).users.filter(
    (u) => u.role === "guard",
  );
  for (const [i, g] of guards.slice(0, 2).entries())
    await req("/api/admin", supervisor, {
      kind: "shift_plan",
      site_id: "oak",
      guard_id: g.id,
      start_time: i ? "12:00" : "00:00",
      end_time: i ? "00:00" : "12:00",
    });
  const shiftId = randomUUID(),
    messageId = randomUUID();
  await req("/api/events", guard, {
    id: shiftId,
    site_id: "oak",
    kind: "start",
    captured_at: new Date().toISOString(),
    payload: {},
  });
  await req("/api/events", guard, {
    id: messageId,
    site_id: "oak",
    kind: "message",
    captured_at: new Date().toISOString(),
    payload: { shift_id: shiftId, text: "Unread supervisor test" },
  });
  const browser = await chromium.launch({
    executablePath:
      process.env.CHROME_PATH ||
      "C:/Program Files/Google/Chrome/Application/chrome.exe",
    headless: true,
  });
  try {
    for (const width of [360, 1440]) {
      const ctx = await browser.newContext({
        viewport: { width, height: 900 },
      });
      const p = await ctx.newPage();
      const errors = [];
      p.on("pageerror", (e) => errors.push(e.message));
      await p.goto(base);
      await p.locator("#email").fill("supervisor@demo.isdl");
      await p.locator("#password").fill("Pilot-only-2026!");
      await p.getByRole("button", { name: "Sign in", exact: true }).click();
      await p.locator(".supervisor-mobile").waitFor();
      if (width === 360) {
        await p.locator(".supervisor-quick-start .message-unread").waitFor();
        assert.equal(
          (await req("/api/state", supervisor)).notifications.find(
            (n) => n.event_id === messageId,
          ).status,
          "submitted",
        );
        await p.locator("nav [data-page=message]").click();
        await p.getByText("Unread supervisor test", { exact: true }).waitFor();
        await p.locator(".greeting-row [data-page=home]").click();
        await p.locator(".supervisor-quick-start").waitFor();
        assert.equal(
          await p.locator(".supervisor-quick-start .message-unread").count(),
          0,
        );
      }
      assert.equal(await p.locator("[data-action=refresh]").count(), 0);
      assert.equal(await p.locator(".stats .stat").count(), 3);
      const picker = p.locator(".overview-shift-picker");
      await picker.locator("summary").click();
      assert.equal(await picker.locator("button").count(), 2);
      assert.ok(
        (await picker.locator('[aria-pressed="true"]').innerText()).includes(
          "Current",
        ),
      );
      const other = picker.locator('[aria-pressed="false"]');
      const chosen = await other.getAttribute("data-shift");
      await other.click();
      assert.equal(
        await p
          .locator('.overview-shift-picker [aria-pressed="true"]')
          .getAttribute("data-shift"),
        chosen,
      );
      assert.equal(
        await p.locator(".overview-shift-picker").getAttribute("open"),
        null,
      );
      assert.equal(
        await p.locator(".supervisor-quick-start nav button").count(),
        4,
      );
      const order = await p.evaluate(() => ({
        actions: document
          .querySelector(".supervisor-quick-start")
          .getBoundingClientRect().top,
        overview: document
          .querySelector(".supervisor-heading")
          .getBoundingClientRect().top,
      }));
      assert.ok(order.actions < order.overview);
      await p.locator(".overview-date-picker > summary").click();
      const monthLabel = await p.locator(".calendar-month strong").innerText();
      await p.getByRole("button", { name: "Previous month", exact: true }).click();
      assert.notEqual(await p.locator(".calendar-month strong").innerText(), monthLabel);
      await p.getByRole("button", { name: "Next month", exact: true }).click();
      assert.equal(await p.locator(".calendar-month strong").innerText(), monthLabel);
      await p.screenshot({ path: path.join(data, `calendar-${width}.png`) });
      await p.locator("#overviewDate").fill("2026-01-01");
      await p
        .getByRole("heading", { name: "Guards this shift", exact: true })
        .waitFor();
      assert.ok(
        (
          await p.locator(".overview-date-picker > summary").innerText()
        ).includes("2026"),
      );
      await p.locator(".overview-date-picker > summary").click();
      await p.getByRole("button", { name: "Today", exact: true }).click();
      assert.ok(
        (
          await p.locator(".overview-date-picker > summary").innerText()
        ).includes("Today"),
      );
      for (const page of [
        "message",
        "incidents",
        "instructionSetup",
        "patrols",
        "summaries",
        "admin",
      ]) {
        if (["instructionSetup", "patrols", "admin"].includes(page))
          await p.locator('nav [data-page="setup"]').click();
        await p.locator(`nav [data-page="${page}"]`).click();
        await p.locator(".greeting-row [data-page=home]").waitFor();
        const sizes = await p.evaluate(() => ({
          width: document
            .querySelector(".supervisor-mobile")
            .getBoundingClientRect().width,
          scroll: document.documentElement.scrollWidth,
          viewport: innerWidth,
        }));
        assert.ok(sizes.width <= 600, `${page} exceeds mobile canvas`);
        assert.ok(
          sizes.scroll <= sizes.viewport,
          `${page} overflows horizontally`,
        );
        if (page === "admin") {
          assert.equal(await p.locator("select[name=role] option").count(), 1);
          assert.equal(
            await p.locator("select[name=role]").inputValue(),
            "guard",
          );
          assert.equal(await p.locator("input[value=customer]").count(), 0);
        }
        await p.locator(".greeting-row [data-page=home]").click();
      }
      assert.deepEqual(errors, []);
      await p.screenshot({
        path: path.join(data, `supervisor-${width}.png`),
        fullPage: true,
      });
      await ctx.close();
    }
  } finally {
    await browser.close();
  }
});

test("shift overview scopes attendance, patrols and reports and provides a default", async () => {
  const { overviewShifts, supervisorStatus } =
    await import("../public/supervisor-status.js");
  const now = Date.parse("2026-09-05T11:00:00Z");
  const site = {
    id: "oak",
    guard_ids: ["a", "b", "c"],
    schedule: "09:00,10:00,15:00,22:00",
  };
  const fallback = overviewShifts({ site, now });
  assert.equal(fallback.length, 1);
  assert.equal(fallback[0].end - fallback[0].start, 86400000);
  assert.equal(supervisorStatus({ site, now })[0].value, "0 of 3");
  const plans = [
    { site_id: "oak", guard_id: "a", start_time: "08:00", end_time: "16:00" },
    { site_id: "oak", guard_id: "b", start_time: "08:00", end_time: "16:00" },
    { site_id: "oak", guard_id: "c", start_time: "16:00", end_time: "08:00" },
  ];
  const windows = overviewShifts({ site, plans, now });
  assert.equal(windows.length, 2);
  assert.equal(windows[0].current, true);
  const input = {
    site,
    plans,
    now,
    shifts: [
      { site_id: "oak", user_id: "a", started_at: "2026-09-05T07:05:00Z" },
    ],
    incidents: [
      {
        site_id: "oak",
        status: "Reported",
        captured_at: "2026-09-05T08:00:00Z",
      },
      {
        site_id: "oak",
        status: "Reported",
        captured_at: "2026-09-04T08:00:00Z",
      },
    ],
    checkpoints: [{ id: "gate" }],
    events: [
      {
        site_id: "oak",
        kind: "scan",
        captured_at: "2026-09-05T08:01:00Z",
        payload: { slot: "09:00", round_id: "one", checkpoint_id: "gate" },
      },
    ],
  };
  let cards = supervisorStatus(input);
  assert.equal(cards[0].value, "1 of 2");
  const missing = supervisorStatus({
    ...input,
    shifts: [],
    selectedShift: { ...windows[0], guardIds: ["a"] },
  });
  assert.equal(missing[0].value, "0 of 1");
  assert.equal(missing[0].tone, "attention");
  assert.equal(cards[0].tone, "attention");
  assert.equal(cards[1].tone, "attention");
  assert.equal(cards[2].tone, "attention");
  assert.equal(cards[1].value, "1 of 3");
  assert.equal(cards[2].value, "2");
  cards = supervisorStatus({ ...input, selectedShift: windows[1] });
  assert.equal(cards[0].value, "0 of 0");
  assert.equal(cards[0].tone, "good");
  assert.equal(cards[1].value, "0 of 1");
  assert.equal(cards[2].value, "2");
  assert.equal(cards[2].tone, "attention");
  assert.equal(cards[1].tone, "good");
  const overnight = overviewShifts({
    site,
    plans,
    now: Date.parse("2026-09-05T02:00:00Z"),
  }).find((w) => w.current);
  assert.equal(overnight.start, Date.parse("2026-09-04T15:00:00Z"));
});

test("historical overview uses prior plans and separates carry-over from later records", async () => {
  const { overviewShifts, overviewDetails } =
    await import("../public/supervisor-status.js");
  const site = { id: "oak", guard_ids: ["later"], schedule: "09:00" };
  const plans = [
    {
      site_id: "oak",
      guard_id: "bala",
      start_time: "06:00",
      end_time: "18:00",
      created_at: "2026-01-01T00:00:00Z",
    },
    {
      site_id: "oak",
      guard_id: "bala",
      start_time: "18:00",
      end_time: "06:00",
      created_at: "2026-09-05T00:00:00Z",
    },
  ];
  const selected = overviewShifts({
    site,
    plans,
    day: "2026-09-01",
    now: Date.parse("2026-09-05T12:00:00Z"),
  })[0];
  assert.equal(selected.start_time, "06:00");
  const details = overviewDetails({
    site,
    selectedShift: selected,
    shifts: [
      {
        site_id: "oak",
        user_id: "bala",
        started_at: "2026-09-01T05:03:00Z",
        ended_at: "2026-09-01T17:00:00Z",
      },
      { site_id: "oak", user_id: "later", started_at: "2026-09-05T05:00:00Z" },
    ],
    incidents: [
      {
        id: "carry",
        site_id: "oak",
        status: "Acknowledged",
        captured_at: "2026-08-31T12:00:00Z",
      },
      {
        id: "new",
        site_id: "oak",
        status: "Reported",
        captured_at: "2026-09-01T06:00:00Z",
      },
      {
        id: "future",
        site_id: "oak",
        status: "Reported",
        captured_at: "2026-09-05T06:00:00Z",
      },
      {
        id: "done",
        site_id: "oak",
        status: "Resolved",
        captured_at: "2026-08-31T06:00:00Z",
      },
    ],
    now: Date.parse("2026-09-05T12:00:00Z"),
  });
  assert.deepEqual(
    details.guards.map((g) => g.id),
    ["bala"],
  );
  assert.ok(details.guards[0].session);
  assert.deepEqual(
    details.problems.map((i) => [i.id, i.carry]),
    [
      ["carry", true],
      ["new", false],
    ],
  );
  assert.equal(
    overviewShifts({ site, plans: [], day: "2026-01-01" })[0].rosterUnknown,
    true,
  );
});

test("problem KPI and list agree for unresolved carry-over and drop resolved reports", async () => {
  const { overviewDetails, supervisorStatus } =
    await import("../public/supervisor-status.js");
  const selectedShift = {
    start: Date.parse("2026-09-05T06:00:00Z"),
    end: Date.parse("2026-09-05T18:00:00Z"),
    guardIds: [],
  };
  const input = {
    site: { id: "oak", schedule: "" },
    selectedShift,
    incidents: [
      {
        id: "old",
        site_id: "oak",
        status: "Acknowledged",
        captured_at: "2026-09-04T09:00:00Z",
      },
      {
        id: "new",
        site_id: "oak",
        status: "Reported",
        captured_at: "2026-09-05T09:00:00Z",
      },
      {
        id: "resolved",
        site_id: "oak",
        status: "Resolved",
        captured_at: "2026-09-04T09:00:00Z",
      },
      {
        id: "later",
        site_id: "oak",
        status: "Reported",
        captured_at: "2026-09-06T09:00:00Z",
      },
      {
        id: "other",
        site_id: "other",
        status: "Reported",
        captured_at: "2026-09-04T09:00:00Z",
      },
    ],
  };
  assert.equal(supervisorStatus(input)[2].value, "2");
  assert.equal(
    Number(supervisorStatus(input)[2].value),
    overviewDetails(input).problems.length,
  );
  input.incidents[0].status = "Resolved";
  assert.equal(supervisorStatus(input)[2].value, "1");
  assert.equal(overviewDetails(input).problems.length, 1);
});


test("optional user photos persist privately and reject invalid uploads", async () => {
  const photo = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAusB9Y9Zl1sAAAAASUVORK5CYII=", "base64");
  const email = 'photo-' + randomUUID() + '@demo.isdl';
  const form = new FormData();
  for (const [key, value] of Object.entries({kind:'user', site_id:'oak', name:'Photo Guard', email, password:'Pilot-only-2026!', role:'guard'})) form.set(key,value);
  form.set('profile_photo', new Blob([photo], {type:'image/png'}), 'portrait.png');
  await req('/api/admin', supervisor, form);
  const state = await req('/api/state', supervisor);
  const person = state.users.find(u => u.name === 'Photo Guard');
  assert.ok(person?.photo_id);
  const url = base + '/media/profile/' + person.id;
  const response = await fetch(url, {headers:{cookie:supervisor}});
  assert.equal(response.status,200);
  assert.equal(response.headers.get('cache-control'),'private, no-store');
  assert.deepEqual(Buffer.from(await response.arrayBuffer()),photo);
  assert.equal((await fetch(url,{headers:{cookie:other}})).status,403);
  assert.equal((await fetch(url,{headers:{cookie:guard}})).status,403);
  assert.equal((await fetch(url)).status,401);
  form.set('email','invalid-' + randomUUID() + '@demo.isdl');
  form.set('profile_photo',new Blob(['not an image'],{type:'image/png'}),'bad.png');
  await req('/api/admin',supervisor,form,400);
});

