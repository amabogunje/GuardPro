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
      for (const number of ["001", "002", "004", "005", "006", "007", "008", "009", "010", "011", "012", "013", "014", "015", "016", "017", "018", "019"])
        await exec(fs.readFileSync(`migrations/${number}.sql`, "utf8"));
    if (postgres) await exec(fs.readFileSync("migrations/010.sql", "utf8"));
    if (postgres) await exec(fs.readFileSync("migrations/011.sql", "utf8"));
    if (postgres) await exec(fs.readFileSync("migrations/012.sql", "utf8"));
    if (postgres) await exec(fs.readFileSync("migrations/013.sql", "utf8"));
    if (postgres) await exec(fs.readFileSync("migrations/014.sql", "utf8"));
    if (postgres) {
      await exec(fs.readFileSync("migrations/015.sql", "utf8"));
      await exec(`
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'guardpro_app') THEN
    GRANT SELECT, INSERT, UPDATE, DELETE ON shift_template_audio TO guardpro_app;
  END IF;
END
$$;
`);
    }
    if (postgres) await exec(fs.readFileSync("migrations/016.sql", "utf8"));
    if (postgres) await exec(fs.readFileSync("migrations/postgres/002.sql", "utf8"));
    if (postgres) {
      await exec(fs.readFileSync("migrations/019.sql", "utf8"));
      await exec(fs.readFileSync("migrations/postgres/003.sql", "utf8"));
      await exec(fs.readFileSync("migrations/postgres/004.sql", "utf8"));
      await exec(`
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'guardpro_app') THEN
    GRANT USAGE ON SCHEMA ${schema} TO guardpro_app;
    GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA ${schema} TO guardpro_app;
  END IF;
END
$$;
`);
    }
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
