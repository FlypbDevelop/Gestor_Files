-- Migration: Seed admin user
-- Requirements: 3.2

-- Insert admin user with Premium plan
-- Password: admin123 (hashed with bcrypt, 10 rounds)
INSERT INTO users (name, email, password_hash, role, plan_id) VALUES (
  'Admin',
  'admin@example.com',
  '$2b$10$hw1c./5y1olQlqrTk3Wllu6LZRHpqrhyIlupheZg8RxO5OXGxL88e',
  'ADMIN',
  (SELECT id FROM plans WHERE name = 'Premium')
);
