// Real-service regression run: an isolated schema, never the demo's guardpro schema.
import { spawn } from "node:child_process";
process.loadEnvFile(".env.local");
if (!process.env.DATABASE_URL || !process.env.BLOB_READ_WRITE_TOKEN)
  throw Error("Pull the development Neon and Blob environment first");
process.env.DATABASE_SCHEMA = "test_" + Date.now();
process.env.SEED_DEMO = "true";
const { migrate } = await import("../migrate.js");
const { close } = await import("../database.js");
await migrate();
await close();
console.log("Isolated cloud test schema:", process.env.DATABASE_SCHEMA);
const port = process.env.CLOUD_TEST_PORT || "3102";
const server = spawn(process.execPath, ["server.js"], {
  env: {
    ...process.env,
    PORT: port,
    HOST: "127.0.0.1",
    COOKIE_SECURE: "false",
    VERCEL: "",
    OPENAI_API_KEY: "",
  },
  stdio: ["ignore", "pipe", "pipe"],
});
let logs = "";
server.stderr.on("data", (data) => {
  logs += data.toString();
});
try {
  await new Promise((resolve, reject) => {
    server.stdout.on("data", (data) => {
      if (data.toString().includes("running")) resolve();
    });
    server.once("exit", () =>
      reject(Error("Cloud test server exited: " + logs)),
    );
  });
  const child = spawn(
    process.execPath,
    ["--test", ...process.argv.slice(2), "tests/workflows.test.js"],
    {
      env: { ...process.env, TEST_BASE_URL: "http://127.0.0.1:" + port },
      stdio: "inherit",
    },
  );
  process.exitCode = await new Promise((resolve) => child.on("exit", resolve));
} finally {
  server.kill();
}
