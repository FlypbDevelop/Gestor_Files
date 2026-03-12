-- Migration: Create downloads table
-- Requirements: 8.1, 8.3, 9.1

CREATE TABLE downloads (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL,
  file_id INTEGER NOT NULL,
  ip_address TEXT NOT NULL,
  downloaded_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id),
  FOREIGN KEY (file_id) REFERENCES files(id)
);

CREATE INDEX idx_downloads_user_file ON downloads(user_id, file_id);
CREATE INDEX idx_downloads_file_id ON downloads(file_id);
CREATE INDEX idx_downloads_downloaded_at ON downloads(downloaded_at DESC);
