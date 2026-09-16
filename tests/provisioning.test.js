import { after, before, test } from "node:test";
import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { randomUUID } from "node:crypto";
import path from "node:path";

const base = "http://127.0.0.1:3124";
const data = path.resolve("data", "provisioning-test-" + Date.now());
let server;

function invokeProvisioning({ customer, owner, email, property }) {
  return new Promise((resolve, reject) => {
    const child = spawn(
      process.execPath,
      [
        "scripts/provision-customer.mjs",
        "--confirm",
        "--operator",
        "qa-operator",
        "--customer-name",
        customer,
        "--owner-name",
        owner,
        "--owner-email",
        email,
        "--property-name",
        property,
        "--address",
        "1 Provisioning Close, Ikeja, Lagos, Nigeria",
        "--latitude",
        "6.601",
        "--longitude",
        "3.351",
        "--radius-m",
        "100",
        "--password-env",
        "PROVISION_TEST_PASSWORD",
      ],
      {
        env: {
          ...process.env,
          DATA_DIR: data,
          DATABASE_URL: "",
          VERCEL: "",
          BLOB_READ_WRITE_TOKEN: "",
          PROVISION_TEST_PASSWORD: "Provisioning-test-password!",
        },
        stdio: ["ignore", "pipe", "pipe"],
      },
    );
    let output = "", error = "";
    child.stdout.on("data", (chunk) => (output += chunk));
    child.stderr.on("data", (chunk) => (error += chunk));
    child.on("error", reject);
    child.on("exit", (code) => {
      if (code) return reject(Error(error || `Provisioning command exited ${code}`));
      try {
        resolve(JSON.parse(output));
      } catch {
        reject(Error(`Provisioning command did not return a receipt: ${output}`));
      }
    });
  });
}

async function login(email) {
  const response = await fetch(base + "/api/login", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password: "Provisioning-test-password!" }),
  });
  assert.equal(response.status, 200);
  const body = await response.json();
  return {
    cookie: response.headers.get("set-cookie").split(";")[0],
    proof: body.proof,
  };
}

async function request(route, session, expected = 200) {
  const response = await fetch(base + route, {
    headers: {
      cookie: session.cookie,
      "X-Session-Proof": session.proof,
    },
  });
  const body = await response.json();
  assert.equal(response.status, expected, JSON.stringify(body));
  return body;
}

before(async () => {
  const suffix = randomUUID();
  const first = await invokeProvisioning({
    customer: "First pilot household " + suffix,
    owner: "First Owner",
    email: `first-${suffix}@pilot.invalid`,
    property: "First House",
  });
  const second = await invokeProvisioning({
    customer: "Second pilot household " + suffix,
    owner: "Second Owner",
    email: `second-${suffix}@pilot.invalid`,
    property: "Second House",
  });
  globalThis.provisioned = { first, second, suffix };
  server = spawn(process.execPath, ["server.js"], {
    env: {
      ...process.env,
      PORT: "3124",
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
    server.on("exit", (code) => reject(Error(`Server exited ${code}`)));
  });
});

after(() => server?.kill());

test("assisted provisioning creates two isolated owner/property accounts with audit receipts", async () => {
  const { first, second, suffix } = globalThis.provisioned;
  assert.equal(first.status, "provisioned");
  assert.equal(second.status, "provisioned");
  assert.notEqual(first.customerId, second.customerId);
  assert.notEqual(first.siteId, second.siteId);

  const firstSession = await login(`first-${suffix}@pilot.invalid`);
  const secondSession = await login(`second-${suffix}@pilot.invalid`);
  const firstState = await request("/api/state", firstSession);
  const secondState = await request("/api/state", secondSession);

  assert.equal(firstState.user.id, first.ownerId);
  assert.equal(secondState.user.id, second.ownerId);
  assert.deepEqual(firstState.sites.map((site) => site.id), [first.siteId]);
  assert.deepEqual(secondState.sites.map((site) => site.id), [second.siteId]);
  assert.equal(firstState.propertyLocations.at(-1).address, "1 Provisioning Close, Ikeja, Lagos, Nigeria");
  await request(`/api/settings/${second.siteId}`, firstSession, 403);
  await request(`/api/settings/${first.siteId}`, secondSession, 403);

  const { DatabaseSync } = await import("node:sqlite");
  const db = new DatabaseSync(path.join(data, "guard.db"));
  const audit = db
    .prepare("SELECT actor,action,detail FROM audit WHERE id=?")
    .get(first.auditId);
  db.close();
  assert.equal(audit.actor, "operator:qa-operator");
  assert.equal(audit.action, "customer.provisioned");
  assert.deepEqual(JSON.parse(audit.detail), {
    customer_id: first.customerId,
    owner_id: first.ownerId,
    site_id: first.siteId,
  });
});
