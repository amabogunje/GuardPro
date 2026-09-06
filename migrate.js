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
      for (const number of ["001", "002", "004", "005", "006", "007", "008", "009", "010", "011", "012", "013", "014"])
        await exec(fs.readFileSync(`migrations/${number}.sql`, "utf8"));
    if (postgres) await exec(fs.readFileSync("migrations/010.sql", "utf8"));
    if (postgres) await exec(fs.readFileSync("migrations/011.sql", "utf8"));
    if (postgres) await exec(fs.readFileSync("migrations/012.sql", "utf8"));
    if (postgres) await exec(fs.readFileSync("migrations/013.sql", "utf8"));
    if (postgres) await exec(fs.readFileSync("migrations/014.sql", "utf8"));
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
