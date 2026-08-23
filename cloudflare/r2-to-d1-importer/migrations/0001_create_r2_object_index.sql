CREATE TABLE IF NOT EXISTS r2_objects (
  object_key TEXT PRIMARY KEY,
  size INTEGER NOT NULL,
  etag TEXT NOT NULL,
  version TEXT,
  uploaded_at TEXT NOT NULL,
  http_etag TEXT,
  content_type TEXT,
  content_language TEXT,
  cache_control TEXT,
  content_disposition TEXT,
  content_encoding TEXT,
  custom_metadata TEXT,
  checksums TEXT,
  indexed_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_r2_objects_uploaded_at ON r2_objects(uploaded_at);

CREATE TABLE IF NOT EXISTS r2_import_state (
  import_name TEXT PRIMARY KEY,
  cursor TEXT,
  imported_count INTEGER NOT NULL DEFAULT 0,
  completed_at TEXT,
  updated_at TEXT NOT NULL
);
