import { one, run, exec } from "./database.js";
import { randomBytes, randomUUID, scryptSync } from "node:crypto";
import fs from "node:fs";
const now = () => new Date().toISOString(),
  id = () => randomUUID();
const hash = (p) => {
  const salt = randomBytes(16).toString("hex");
  return salt + ":" + scryptSync(p, salt, 64).toString("hex");
};
export async function seedDemo() {
  // Rename only the original fictional account; preserve customer-chosen names.
  await run(
    "UPDATE users SET name=? WHERE id=? AND email=? AND name=?",
    "Ada",
    "supervisor",
    "supervisor@demo.isdl",
    "ISDL Supervisor",
  );
  if (!(await one("SELECT id FROM users LIMIT 1"))) {
    let password = hash(process.env.DEMO_PASSWORD || "Pilot-only-2026!");
    for (let [uid, name, role] of [
      ["bala", "Bala", "guard"],
      ["owner", "Ada Okafor", "owner"],
      ["supervisor", "Ada", "supervisor"],
      ["other", "Other Customer", "owner"],
    ])
      await run(
        "INSERT INTO users VALUES(?,?,?,?,?)",
        uid,
        name,
        uid + "@demo.isdl",
        password,
        role,
      );
    await run(
      "INSERT INTO customers VALUES(?,?)",
      "oak",
      "Oak House household (fictional)",
    );
    await run(
      "INSERT INTO customers VALUES(?,?)",
      "other",
      "Other household (fictional)",
    );
    await run(
      "INSERT INTO sites(id,customer_id,name,instructions,phone) VALUES(?,?,?,?,?)",
      "oak",
      "oak",
      "Oak House, Ikeja",
      "Check the gate lock. Keep the walkway clear. Call your supervisor if you need help. Do not confront anyone.",
      "+2340000000000",
    );
    await run(
      "INSERT INTO sites(id,customer_id,name) VALUES(?,?,?)",
      "other",
      "other",
      "Palm Court (fictional)",
    );
    for (let uid of ["bala", "owner", "supervisor"])
      await run("INSERT INTO assignments VALUES(?,?)", uid, "oak");
    await run("INSERT INTO assignments VALUES(?,?)", "other", "other");
    for (let [i, n] of [
      "Main gate",
      "Back gate",
      "Generator area",
      "Perimeter",
    ].entries())
      await run(
        "INSERT INTO checkpoints VALUES(?,?,?,?)",
        "cp" + i,
        "oak",
        n,
        "OAK-" + (i + 1),
      );
    await run(
      "INSERT INTO incidents(id,site_id,user_id,captured_at,received_at,event_time,report,transcript,status,next_action) VALUES(?,?,?,?,?,?,?,?,?,?)",
      "demo-incident",
      "oak",
      "bala",
      now(),
      now(),
      "Around nine",
      "Back gate lock damaged. Reported to supervisor. Repair pending.",
      "Back gate lock damaged. Reported to supervisor. Repair pending.",
      "Acknowledged",
      "Repair pending",
    );
    await run(
      "INSERT INTO transitions VALUES(?,?,?,?,?,?)",
      id(),
      "demo-incident",
      "supervisor",
      now(),
      "Acknowledged",
      "Supervisor acknowledged; repair pending",
    );
  }
  await exec(fs.readFileSync("migrations/003.sql", "utf8"));
}
