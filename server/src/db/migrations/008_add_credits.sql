-- Migration: Add credits system (avulso pay-per-download)
-- users.credits: balance of the user
-- files.credit_cost: base cost in credits for an avulso download (NULL = not avulso)
-- downloads.credit_cost: credits charged for that download
-- credit_transactions: ledger for auditing (GRANT / PURCHASE / DOWNLOAD)

ALTER TABLE users ADD COLUMN credits INTEGER NOT NULL DEFAULT 0;

ALTER TABLE files ADD COLUMN credit_cost INTEGER;

ALTER TABLE downloads ADD COLUMN credit_cost INTEGER;

CREATE TABLE credit_transactions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL,
  amount INTEGER NOT NULL,
  reason TEXT NOT NULL,
  file_id INTEGER,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id),
  FOREIGN KEY (file_id) REFERENCES files(id)
);

CREATE INDEX idx_credit_transactions_user ON credit_transactions(user_id);

-- Default credit multipliers per plan (Free pays more, Premium pays base)
-- json_set requires SQLite JSON1 (bundled with node-sqlite3)
UPDATE plans SET features = json_set(features, '$.creditMultiplier', 2.0) WHERE name = 'Free';
UPDATE plans SET features = json_set(features, '$.creditMultiplier', 1.5) WHERE name = 'Basic';
UPDATE plans SET features = json_set(features, '$.creditMultiplier', 1.0) WHERE name = 'Premium';
