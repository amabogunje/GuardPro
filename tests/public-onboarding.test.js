import { after, before, test } from "node:test";
import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import net from "node:net";
import path from "node:path";

let server;
let base;

function freePort() {
  return new Promise((resolve, reject) => {
    const listener = net.createServer();
    listener.listen(0, "127.0.0.1", () => {
      const { port } = listener.address();
      listener.close((error) => (error ? reject(error) : resolve(port)));
    });
    listener.on("error", reject);
  });
}

before(async () => {
  const port = await freePort();
  base = `http://127.0.0.1:${port}`;
  server = spawn(process.execPath, ["server.js"], {
    env: {
      ...process.env,
      PORT: String(port),
      DATA_DIR: path.resolve("data", "public-onboarding-test-" + Date.now()),
      DATABASE_URL: "",
      VERCEL: "",
      BLOB_READ_WRITE_TOKEN: "",
      PILOT_SUPPORT_CONTACT: "",
    },
    stdio: "pipe",
  });
  await new Promise((resolve, reject) => {
    server.stdout.on("data", (chunk) => {
      if (String(chunk).includes("running")) resolve();
    });
    server.on("exit", (code) => reject(Error("Server exited " + code)));
  });
});

after(() => server?.kill());

test("public signup stays unavailable until an ISDL support contact is configured", async () => {
  const onboarding = await fetch(base + "/api/public/onboarding");
  assert.equal(onboarding.status, 200);
  assert.deepEqual(await onboarding.json(), {
    noticeVersion: "2026-09-17",
    supportContact: null,
    signupAvailable: false,
  });

  const signup = await fetch(base + "/api/signup", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      owner_name: "Unavailable Owner",
      customer_name: "Unavailable Customer",
      property_name: "Unavailable Property",
      email: "unavailable@pilot.invalid",
      password: "Unavailable-signup-password!",
      address: "1 Unavailable Close, Ikeja, Lagos, Nigeria",
      latitude: "6.601",
      longitude: "3.351",
      radius_m: "100",
      confirmed: true,
      notice_version: "2026-09-17",
      notice_accepted: true,
    }),
  });
  assert.equal(signup.status, 503);
  assert.match((await signup.json()).error, /support contact/i);
});
