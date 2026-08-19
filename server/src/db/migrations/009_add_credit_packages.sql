-- Migration: Add credit packages for purchase (Phase 2)
-- credit_packages: available packages users can buy
-- Each package has a name, amount of credits, and price in BRL

CREATE TABLE credit_packages (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  credits INTEGER NOT NULL,
  price REAL NOT NULL,
  active INTEGER NOT NULL DEFAULT 1,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Default packages (admin can edit via API)
INSERT INTO credit_packages (name, credits, price) VALUES ('Starter', 10, 9.90);
INSERT INTO credit_packages (name, credits, price) VALUES ('Pro', 50, 39.90);
INSERT INTO credit_packages (name, credits, price) VALUES ('Premium', 100, 69.90);
