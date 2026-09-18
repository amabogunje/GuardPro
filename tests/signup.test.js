import { after, before, test } from "node:test";
import assert from "node:assert/strict";
import { createHash, randomUUID } from "node:crypto";
import { spawn } from "node:child_process";
import path from "node:path";
import { chromium } from "@playwright/test";

const base = "http://127.0.0.1:3125";
const data = path.resolve("data", "signup-test-" + Date.now());
let server, browser;
let existingEmail;

const payload = (suffix, overrides = {}) => ({
  owner_name: "Owner " + suffix,
  customer_name: "Customer " + suffix,
  property_name: "Property " + suffix,
  email: `owner-${suffix}@pilot.invalid`,
  password: "Self-service-test-password!",
  address: "1 Self Service Close, Ikeja, Lagos, Nigeria",
  latitude: "6.601",
  longitude: "3.351",
  radius_m: "100",
  confirmed: true,
  notice_version: "2026-09-17",
  notice_accepted: true,
  ...overrides,
});

async function signup(body) {
  const response = await fetch(base + "/api/signup", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  return { response, body: await response.json() };
}

async function state(response, session) {
  const result = await fetch(base + "/api/state", {
    headers: {
      cookie: response.headers.get("set-cookie").split(";")[0],
      "X-Session-Proof": session.proof,
    },
  });
  assert.equal(result.status, 200);
  return result.json();
}

before(async () => {
  server = spawn(process.execPath, ["server.js"], {
    env: {
      ...process.env,
      PORT: "3125",
      DATA_DIR: data,
      DATABASE_URL: "",
      VERCEL: "",
      BLOB_READ_WRITE_TOKEN: "",
      PILOT_SUPPORT_CONTACT: "+234 818 335 4052",
      RESEND_API_KEY: "test-reset-key",
      RESEND_EMAIL_DOMAIN: "pilot.example.test",
    },
    stdio: "pipe",
  });
  await new Promise((resolve, reject) => {
    server.stdout.on("data", (chunk) => {
      if (String(chunk).includes("running")) resolve();
    });
    server.on("exit", (code) => reject(Error("Server exited " + code)));
  });
  browser = await chromium.launch({
    executablePath:
      process.env.CHROME_PATH ||
      "C:/Program Files/Google/Chrome/Application/chrome.exe",
    headless: true,
  });
});

after(async () => {
  await browser?.close();
  server?.kill();
});

test("self-service signup creates an isolated owner, customer and first property", async () => {
  const suffix = randomUUID();
  const first = await signup(payload("first-" + suffix));
  const second = await signup(payload("second-" + suffix));
  assert.equal(first.response.status, 200, JSON.stringify(first.body));
  assert.equal(second.response.status, 200, JSON.stringify(second.body));
  assert.equal(first.body.role, "owner");
  existingEmail = `owner-first-${suffix}@pilot.invalid`;
  assert.notEqual(first.body.customerId, second.body.customerId);
  assert.notEqual(first.body.siteId, second.body.siteId);

  const firstState = await state(first.response, first.body);
  const secondState = await state(second.response, second.body);
  assert.deepEqual(firstState.sites.map((site) => site.id), [first.body.siteId]);
  assert.deepEqual(secondState.sites.map((site) => site.id), [second.body.siteId]);
  assert.equal(firstState.propertyLocations.at(-1).address, "1 Self Service Close, Ikeja, Lagos, Nigeria");
  const firstSettings = await fetch(base + `/api/settings/${first.body.siteId}`, {
    headers: {
      cookie: first.response.headers.get("set-cookie").split(";")[0],
      "X-Session-Proof": first.body.proof,
    },
  });
  assert.equal(firstSettings.status, 200);
  assert.deepEqual((await firstSettings.json()).shifts, []);

  const ownerHeaders={cookie:first.response.headers.get('set-cookie').split(';')[0],'X-Session-Proof':first.body.proof,'Content-Type':'application/json'};
  const secondProperty=await fetch(base+'/api/admin',{method:'POST',headers:ownerHeaders,body:JSON.stringify({kind:'additional_site',site_id:first.body.siteId,name:'Second free property',address:'3 Free Tier Close, Ikeja, Lagos',latitude:6.61,longitude:3.36,radius_m:100,confirmed:true})});assert.equal(secondProperty.status,403);
  for(let index=0;index<5;index++) {
    const response=await fetch(base+'/api/admin',{method:'POST',headers:ownerHeaders,body:JSON.stringify({kind:'user',site_id:first.body.siteId,name:'Free team '+index,email:`free-team-${index}-${suffix}@pilot.invalid`,password:'Free-tier-test-password!',role:index%2?'supervisor':'guard'})});assert.equal(response.status,200,await response.text());
  }
  const sixth=await fetch(base+'/api/admin',{method:'POST',headers:ownerHeaders,body:JSON.stringify({kind:'user',site_id:first.body.siteId,name:'Sixth team user',email:`free-team-six-${suffix}@pilot.invalid`,password:'Free-tier-test-password!',role:'guard'})});assert.equal(sixth.status,403);assert.match((await sixth.json()).error,/up to five/i);
  const overview=await fetch(base+'/api/owner-overview/'+first.body.siteId,{headers:{cookie:first.response.headers.get('set-cookie').split(';')[0],'X-Session-Proof':first.body.proof}});assert.equal(overview.status,200);assert.deepEqual((await overview.json()).subscription,{tier:'free',propertyLimit:1,userLimit:5});

  const denied = await fetch(base + `/api/settings/${second.body.siteId}`, {
    headers: {
      cookie: first.response.headers.get("set-cookie").split(";")[0],
      "X-Session-Proof": first.body.proof,
    },
  });
  assert.equal(denied.status, 403);

  const { DatabaseSync } = await import("node:sqlite");
  const db = new DatabaseSync(path.join(data, "guard.db"));
  const audit = db
    .prepare("SELECT actor,action,detail FROM audit WHERE action='customer.self_registered' AND actor=?")
    .get(first.body.id);
  const acceptance = db
    .prepare("SELECT notice_version,support_contact FROM customer_notice_acceptances WHERE customer_id=?")
    .get(first.body.customerId);
  db.close();
  assert.equal(audit.action, "customer.self_registered");
  assert.deepEqual(JSON.parse(audit.detail), {
    customer_id: first.body.customerId,
    site_id: first.body.siteId,
    notice_version: "2026-09-17",
  });
  assert.equal(acceptance.notice_version, "2026-09-17");
  assert.equal(acceptance.support_contact, "+234 818 335 4052");
});

test("signup rejects duplicate identities and an unaccepted customer notice", async () => {
  const suffix = randomUUID();
  const duplicate = await signup(payload("duplicate-" + suffix, { email: existingEmail }));
  assert.equal(duplicate.response.status, 409);
  assert.match(duplicate.body.error, /already uses this email/i);
  const unaccepted = await signup(payload("unaccepted-" + suffix, { notice_accepted: false }));
  assert.equal(unaccepted.response.status, 400);
  assert.match(unaccepted.body.error, /accept the current customer notice/i);
  const staleNotice = await signup(payload("stale-notice-" + suffix, { notice_version: "2026-01-01" }));
  assert.equal(staleNotice.response.status, 400);
  assert.match(staleNotice.body.error, /accept the current customer notice/i);
});

test("owner password-reset confirmation changes the password and invalidates the old one", async () => {
  const suffix = randomUUID();
  const ownerEmail = `owner-reset-${suffix}@pilot.invalid`;
  const initialPassword = "Initial-owner-password-2026!";
  const created = await signup(payload("reset-" + suffix, { email: ownerEmail, password: initialPassword }));
  assert.equal(created.response.status, 200);
  const token = "reset-" + randomUUID();
  const { DatabaseSync } = await import("node:sqlite");
  const db = new DatabaseSync(path.join(data, "guard.db"));
  db.prepare("INSERT INTO password_reset_tokens VALUES(?,?,?,?,?,?)").run(
    randomUUID(),
    created.body.id,
    createHash("sha256").update(token).digest("hex"),
    new Date(Date.now() + 60_000).toISOString(),
    null,
    new Date().toISOString(),
  );
  db.close();
  const nextPassword = "New-owner-password-2026!";
  const confirmation = await fetch(base + "/api/owner-password-reset/confirm", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ token, password: nextPassword }),
  });
  assert.equal(confirmation.status, 200);
  const revokedSession = await fetch(base + "/api/state", {
    headers: {
      cookie: created.response.headers.get("set-cookie").split(";")[0],
      "X-Session-Proof": created.body.proof,
    },
  });
  assert.equal(revokedSession.status, 401);
  const oldLogin = await fetch(base + "/api/login", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ email: ownerEmail, password: initialPassword }) });
  assert.equal(oldLogin.status, 401);
  const newLogin = await fetch(base + "/api/login", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ email: ownerEmail, password: nextPassword }) });
  assert.equal(newLogin.status, 200);
});

test("sign-in recovery keeps guard and supervisor help owner-assisted", async () => {
  const context = await browser.newContext({ viewport: { width: 390, height: 844 } });
  const page = await context.newPage();
  try {
    await page.goto(base + "/app");
    await page.getByRole("button", { name: "Need help signing in?", exact: true }).click();
    await page.getByRole("heading", { name: "Help signing in", exact: true }).waitFor();
    await page.getByRole("button", { name: "Email me a reset link", exact: true }).waitFor();
    await page.getByText("Ask your owner to reset your password or check the email or WhatsApp number saved for your account.", { exact: true }).waitFor();
    assert.equal(await page.getByRole("link", { name: "Contact ISDL support", exact: true }).count(), 0);
    await page.getByRole("button", { name: "Back to sign in", exact: true }).click();
    await page.getByRole("button", { name: "Sign in", exact: true }).waitFor();
    assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
  } finally {
    await context.close();
  }
});

test("mobile signup wizard creates the account and retains a narrow layout", async () => {
  const context = await browser.newContext({ viewport: { width: 390, height: 844 } });
  const page = await context.newPage();
  const suffix = randomUUID();
  const email = `wizard-${suffix}@pilot.invalid`;
  try {
    await page.goto(base + "/app");
    await page.getByRole("button", { name: "Create an account", exact: true }).click();
    await page.locator("#signupFirstName").fill("Wizard");
    await page.locator("#signupLastName").fill("Owner");
    await page.locator("#signupEmail").fill(email);
    await page.locator("#signupPassword").fill("Wizard-signup-password!");
    await page.locator("#signupPasswordConfirm").fill("Wizard-signup-password!");
    await page.locator('input[name="notice_accepted"]').check();
    await page.reload();
    await page.locator("#signupAccount").waitFor();
    assert.equal(await page.locator("#signupFirstName").inputValue(), "Wizard");
    assert.equal(await page.locator("#signupLastName").inputValue(), "Owner");
    assert.equal(await page.locator("#signupEmail").inputValue(), email);
    assert.equal(await page.locator('input[name="notice_accepted"]').isChecked(), true);
    await page.locator("#signupPassword").fill("Wizard-signup-password!");
    await page.locator("#signupPasswordConfirm").fill("Wizard-signup-password!");
    await page.getByRole("button", { name: "Continue", exact: true }).click();
    await page.locator("#signupPropertyName").fill("Wizard House");
    await page.locator("#signupAddress").fill("2 Wizard Close, Ikeja, Lagos, Nigeria");
    await page.locator("#signupLatitude").fill("6.602");
    await page.locator("#signupLongitude").fill("3.352");
    await page.locator("#signupRadius").fill("100");
    await page.locator('input[name="confirmed"]').check();
    await page.getByRole("button", { name: "Create account", exact: true }).click();
    await page.locator(".owner-health").waitFor();
    await page.getByRole("heading", { name: "Hello, Wizard Owner.", exact: true }).waitFor();
    const layout = await page.evaluate(() => ({
      main: document.querySelector("main")?.getBoundingClientRect().width,
      overflow: document.documentElement.scrollWidth > innerWidth,
    }));
    assert.ok(layout.main <= 600, JSON.stringify(layout));
    assert.equal(layout.overflow, false);

    // A marketing signup link must not displace an existing owner's session.
    await page.goto(base + "/app?signup=1");
    await page.getByRole("heading", { name: "Hello, Wizard Owner.", exact: true }).waitFor();
    assert.equal(await page.locator("#signupAccount").count(), 0);
  } finally {
    await context.close();
  }
});

test("landing signup entry opens account creation while ordinary entry retains sign-in", async () => {
  const context = await browser.newContext({ viewport: { width: 390, height: 844 } });
  const page = await context.newPage();
  try {
    await page.goto(base);
    await page.getByRole("heading", { name: /Keep up with/i }).waitFor();
    assert.equal(new URL(page.url()).pathname, "/");
    assert.equal(await page.locator("#login").count(), 0);

    await page.goto(base + "/customer-notice.html");
    await page.getByRole("heading", { name: "Before you create an account", exact: true }).waitFor();
    const support = page.getByRole("link", { name: "+234 818 335 4052", exact: true });
    await support.waitFor();
    assert.equal(await support.getAttribute("href"), "tel:+2348183354052");

    await page.goto(base);
    await page.getByText("Illustrative image", { exact: false }).waitFor();
    await page.getByText("Guard Patrol does not provide emergency response.", { exact: true }).waitFor();

    await page.goto(base + "/app");
    await page.getByRole("heading", { name: "Welcome back", exact: true }).waitFor();
    assert.equal(await page.locator("#signupAccount").count(), 0);
    assert.equal(await page.locator("#email").inputValue(), "");
    assert.equal(await page.getByText("Fictional pilot accounts", { exact: true }).count(), 0);

    await page.goto(base + "/landing.html");
    await page.getByRole("link", { name: /^Start free/ }).first().click();
    await page.getByRole("heading", { name: "Create your account", exact: true }).waitFor();
    await page.getByText("Owner accounts use an email address to sign in.", { exact: false }).waitFor();
    assert.equal(await page.locator("#login").count(), 0);
    assert.equal(new URL(page.url()).searchParams.has("signup"), false);

    await page.getByRole("button", { name: "Back to sign in", exact: true }).click();
    await page.getByRole("heading", { name: "Welcome back", exact: true }).waitFor();
    await page.reload();
    await page.getByRole("heading", { name: "Welcome back", exact: true }).waitFor();
    assert.equal(await page.locator("#signupAccount").count(), 0);
  } finally {
    await context.close();
  }
});
