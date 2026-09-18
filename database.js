import pg from "pg";
import { AsyncLocalStorage } from "node:async_hooks";
import fs from "node:fs";
import path from "node:path";

const context = new AsyncLocalStorage();
export const schema = process.env.DATABASE_SCHEMA || "public";
if (!/^[a-z][a-z0-9_]*$/.test(schema))
  throw new Error("Invalid database schema");
export const postgres = Boolean(process.env.DATABASE_URL);
if (process.env.VERCEL && !postgres)
  throw new Error("DATABASE_URL is required on Vercel");
pg.types.setTypeParser(20, Number);
const pool = postgres
  ? new pg.Pool({
      connectionString: process.env.DATABASE_URL.replace(
        /sslmode=require/g,
        "sslmode=verify-full",
      ),
      max: 5,
      idleTimeoutMillis: 10000,
      connectionTimeoutMillis: 15000,
    })
  : null;
let sqlite;
if (!postgres) {
  const { DatabaseSync } = await import("node:sqlite");
  const dir = path.resolve(process.env.DATA_DIR || "data");
  fs.mkdirSync(dir, { recursive: true });
  sqlite = new DatabaseSync(path.join(dir, "guard.db"));
  sqlite.exec("PRAGMA foreign_keys=ON; PRAGMA journal_mode=WAL");
}
let queue = Promise.resolve();

// All pilot writes share a transaction-scoped lock. This keeps retries, quotas,
// shift checks and audit changes atomic across concurrent serverless instances.
// Replace with finer per-site locks when measured traffic warrants it.
export async function transaction(work) {
  if (context.getStore()) return work();
  let releaseQueue;
  if (!postgres) {
    const previous = queue;
    queue = new Promise((resolve) => {
      releaseQueue = resolve;
    });
    await previous;
  }
  const client = postgres ? await pool.connect() : sqlite;
  try {
    if (postgres) {
      await client.query("BEGIN");
      await client.query("SELECT pg_advisory_xact_lock(71924001)");
    } else client.exec("BEGIN IMMEDIATE");
    const value = await context.run(client, work);
    if (postgres) await client.query("COMMIT");
    else client.exec("COMMIT");
    return value;
  } catch (error) {
    if (postgres) await client.query("ROLLBACK");
    else client.exec("ROLLBACK");
    throw error;
  } finally {
    if (postgres) client.release();
    else releaseQueue();
  }
}
function sql(statement) {
  if (!postgres) return statement;
  let i = 0;
  return qualify(statement)
    .replace(/json_extract\((\w+),'\$\.(\w+)'\)/g, "($1::jsonb->>'$2')")
    .replace(/\?/g, () => "$" + ++i);
}
// Explicit schema qualification works with Neon's transaction pooler; startup
// search_path options are not supported there. Only application-owned tables.
function qualify(statement) {
  const tables =
    "customers|users|sites|assignments|checkpoints|sessions|events|shifts|incidents|revisions|transitions|media|media_uploads|notifications|summaries|audit|shift_plans|site_locations|instruction_versions|message_media|message_context|rate_limits|user_photos|shift_templates|shift_template_audio|disabled_users|retired_checkpoints|user_contacts|property_locations|location_reviews|incident_classifications|incident_evidence|shift_exceptions|owner_supervision|customer_subscriptions|customer_notice_acceptances|password_reset_tokens";
  return statement.replace(
    new RegExp(
      "\\b(FROM|JOIN|INTO|UPDATE|REFERENCES|TABLE(?: IF NOT EXISTS)?|ON)\\s+(" +
        tables +
        ")\\b",
      "gi",
    ),
    "$1 " + schema + ".$2",
  );
}
export async function all(statement, ...params) {
  if (postgres)
    return (await (context.getStore() || pool).query(sql(statement), params))
      .rows;
  if (!context.getStore()) await queue;
  return sqlite.prepare(statement).all(...params);
}
export async function one(statement, ...params) {
  return (await all(statement, ...params))[0];
}
export async function run(statement, ...params) {
  if (postgres)
    return (await (context.getStore() || pool).query(sql(statement), params))
      .rowCount;
  return sqlite.prepare(statement).run(...params).changes;
}
export async function exec(statement) {
  if (postgres) await (context.getStore() || pool).query(qualify(statement));
  else sqlite.exec(statement);
}
export async function close() {
  if (pool) await pool.end();
  else sqlite.close();
}

// A separate committed statement counts failed attempts too, independently of
// the route's transaction. No process-local counters in the hosted app.
export async function consumeRate(key, duration) {
  const at = Date.now();
  const result = await pool.query(
    qualify(`INSERT INTO rate_limits(key,n,reset_at) VALUES($1,1,$2)
    ON CONFLICT(key) DO UPDATE SET
    n=CASE WHEN rate_limits.reset_at<$3 THEN 1 ELSE rate_limits.n+1 END,
    reset_at=CASE WHEN rate_limits.reset_at<$3 THEN $2 ELSE rate_limits.reset_at END RETURNING n`),
    [key, at + duration, at],
  );
  return result.rows[0].n;
}
