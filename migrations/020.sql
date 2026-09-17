CREATE TABLE IF NOT EXISTS customer_notice_acceptances(
  id TEXT PRIMARY KEY,
  customer_id TEXT NOT NULL REFERENCES customers(id),
  owner_id TEXT NOT NULL REFERENCES users(id),
  notice_version TEXT NOT NULL,
  accepted_at TEXT NOT NULL,
  support_contact TEXT NOT NULL
);
