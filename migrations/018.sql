CREATE TABLE IF NOT EXISTS customer_subscriptions (
 customer_id TEXT PRIMARY KEY REFERENCES customers(id),
 tier TEXT NOT NULL CHECK(tier IN ('free','internal')),
 created_at TEXT NOT NULL
);
