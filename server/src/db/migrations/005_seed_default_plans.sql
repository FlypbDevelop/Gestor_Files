-- Migration: Seed default plans
-- Requirements: 10.1, 10.4

-- Insert Free plan
INSERT INTO plans (name, price, features) VALUES (
  'Free',
  0.00,
  '{"maxDownloadsPerMonth": 10, "maxFileSize": 50, "prioritySupport": false, "customFeatures": []}'
);

-- Insert Basic plan
INSERT INTO plans (name, price, features) VALUES (
  'Basic',
  9.99,
  '{"maxDownloadsPerMonth": 100, "maxFileSize": 50, "prioritySupport": false, "customFeatures": []}'
);

-- Insert Premium plan
INSERT INTO plans (name, price, features) VALUES (
  'Premium',
  29.99,
  '{"maxDownloadsPerMonth": -1, "maxFileSize": 50, "prioritySupport": true, "customFeatures": []}'
);
