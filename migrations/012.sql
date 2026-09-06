CREATE TABLE IF NOT EXISTS user_contacts (
 user_id TEXT PRIMARY KEY REFERENCES users(id), whatsapp TEXT UNIQUE,
 vault_key TEXT NOT NULL, email_missing INTEGER NOT NULL DEFAULT 0
);
