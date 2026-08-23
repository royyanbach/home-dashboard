-- Replaces the initial metadata-index schema. This migration drops any rows
-- imported by that initial schema.
DROP TABLE IF EXISTS r2_import_state;
DROP TABLE IF EXISTS r2_objects;

CREATE TABLE IF NOT EXISTS "home-automation-clips" (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  file_name TEXT NOT NULL UNIQUE,
  created_at TEXT NOT NULL
);
