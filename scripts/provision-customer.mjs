import { randomBytes, randomUUID, scryptSync } from "node:crypto";
import { close, one, run, transaction } from "../database.js";
import { propertyInput } from "../location-checks.js";
import { migrate } from "../migrate.js";

const args = new Map();
for (let index = 2; index < process.argv.length; index += 1) {
  const key = process.argv[index];
  if (!key.startsWith("--")) throw Error(`Unexpected argument: ${key}`);
  if (key === "--confirm") {
    args.set(key, true);
    continue;
  }
  const value = process.argv[++index];
  if (!value || value.startsWith("--")) throw Error(`Missing value for ${key}`);
  args.set(key, value);
}

const value = (key) => String(args.get(key) || "").trim();
const required = (key, label) => {
  const result = value(key);
  if (!result) throw Error(`${label} is required`);
  return result;
};
const usage = `
Usage: npm run provision:customer -- --confirm --operator <operator-id> \\
  --customer-name <name> --owner-name <name> --owner-email <email> \\
  --property-name <name> --address <full-address> --latitude <latitude> \\
  --longitude <longitude> --radius-m <metres> --password-env <environment-variable>

This is the assisted, one-property customer onboarding command. It does not
create demo credentials or a public self-service account. The named password
environment variable is read once and removed from this process before the
result is printed.`;

if (!args.get("--confirm")) throw Error(`Refusing to provision without --confirm.\n${usage}`);

const operator = required("--operator", "Operator identifier");
const customerName = required("--customer-name", "Customer name");
const ownerName = required("--owner-name", "Owner name");
const ownerEmail = required("--owner-email", "Owner email").toLowerCase();
const propertyName = required("--property-name", "Property name");
const passwordEnvironment = required("--password-env", "Password environment variable");
if (!/^[A-Z][A-Z0-9_]*$/.test(passwordEnvironment))
  throw Error("Password environment variable names must use uppercase letters, numbers and underscores");
const password = String(process.env[passwordEnvironment] || "");
delete process.env[passwordEnvironment];
if (password.length < 12) throw Error("Provide an owner password of at least 12 characters through the named environment variable");
if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(ownerEmail)) throw Error("Use a valid owner email address");
if (customerName.length > 120 || ownerName.length > 120 || propertyName.length > 120)
  throw Error("Customer, owner and property names must be 120 characters or fewer");
const property = propertyInput({
  address: value("--address"),
  latitude: value("--latitude"),
  longitude: value("--longitude"),
  radius_m: value("--radius-m"),
  confirmed: true,
});

const hash = (plain) => {
  const salt = randomBytes(16).toString("hex");
  return `${salt}:${scryptSync(plain, salt, 64).toString("hex")}`;
};
const now = () => new Date().toISOString();

try {
  await migrate();
  const result = await transaction(async () => {
    if (await one("SELECT id FROM users WHERE lower(email)=lower(?)", ownerEmail))
      throw Error("An account already uses this owner email address");

    const customerId = randomUUID();
    const ownerId = randomUUID();
    const siteId = randomUUID();
    const locationId = randomUUID();
    const auditId = randomUUID();
    const createdAt = now();

    await run("INSERT INTO customers VALUES(?,?)", customerId, customerName);
    await run("INSERT INTO customer_subscriptions VALUES(?,?,?)", customerId, "free", createdAt);
    await run(
      "INSERT INTO users VALUES(?,?,?,?,?)",
      ownerId,
      ownerName,
      ownerEmail,
      hash(password),
      "owner",
    );
    await run("INSERT INTO sites(id,customer_id,name) VALUES(?,?,?)", siteId, customerId, propertyName);
    await run("INSERT INTO assignments VALUES(?,?)", ownerId, siteId);
    await run(
      "INSERT INTO site_locations VALUES(?,?,?,?)",
      siteId,
      property.latitude,
      property.longitude,
      property.radius_m,
    );
    await run(
      "INSERT INTO property_locations VALUES(?,?,?,?,?,?,?,?)",
      locationId,
      siteId,
      property.address,
      property.latitude,
      property.longitude,
      property.radius_m,
      ownerId,
      createdAt,
    );
    await run(
      "INSERT INTO audit VALUES(?,?,?,?,?)",
      auditId,
      `operator:${operator}`,
      createdAt,
      "customer.provisioned",
      JSON.stringify({ customer_id: customerId, owner_id: ownerId, site_id: siteId }),
    );
    return { customerId, ownerId, siteId, auditId };
  });
  console.log(JSON.stringify({ status: "provisioned", ...result }, null, 2));
} finally {
  await close();
}
