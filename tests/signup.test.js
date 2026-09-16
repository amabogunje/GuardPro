import { after, before, test } from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
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
  db.close();
  assert.equal(audit.action, "customer.self_registered");
  assert.deepEqual(JSON.parse(audit.detail), {
    customer_id: first.body.customerId,
    site_id: first.body.siteId,
  });
});

test("signup rejects duplicate identities and an unconfirmed location", async () => {
  const suffix = randomUUID();
  const duplicate = await signup(payload("duplicate-" + suffix, { email: existingEmail }));
  assert.equal(duplicate.response.status, 409);
  assert.match(duplicate.body.error, /already uses this email/i);
  const unconfirmed = await signup(payload("unconfirmed-" + suffix, { confirmed: false }));
  assert.equal(unconfirmed.response.status, 400);
  assert.match(unconfirmed.body.error, /confirm the map position/i);
});

test("mobile signup wizard creates the account and retains a narrow layout", async () => {
  const context = await browser.newContext({ viewport: { width: 390, height: 844 } });
  const page = await context.newPage();
  const suffix = randomUUID();
  const email = `wizard-${suffix}@pilot.invalid`;
  try {
    await page.goto(base);
    await page.getByRole("button", { name: "Create an account", exact: true }).click();
    await page.locator("#signupOwnerName").fill("Wizard Owner");
    await page.locator("#signupCustomerName").fill("Wizard Customer");
    await page.locator("#signupEmail").fill(email);
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
  } finally {
    await context.close();
  }
});
