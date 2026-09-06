import fs from "node:fs";
import { pathToFileURL } from "node:url";
import { exec, postgres, transaction, close, schema } from "./database.js";
import { seedDemo } from "./seed.js";
export async function migrate() {
  await transaction(async () => {
    if (postgres) {
      await exec(`CREATE SCHEMA IF NOT EXISTS ${schema}`);
      await exec(fs.readFileSync("migrations/postgres/001.sql", "utf8"));
    } else
      for (const number of ["001", "002", "004", "005", "006", "007", "008", "009"])
        await exec(fs.readFileSync(`migrations/${number}.sql`, "utf8"));
    if (!postgres || process.env.SEED_DEMO === "true") await seedDemo();
  });
}
if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(process.argv[1]).href
) {
  try {
    await migrate();
    console.log("GuardPro schema migration complete");
  } finally {
    await close();
  }
}
