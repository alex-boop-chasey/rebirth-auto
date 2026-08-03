-- Rebirth Online — Saved searches + email alerts (Cloudflare D1). Purely ADDITIVE.
-- Apply LOCAL:  npx wrangler d1 migrations apply astro-listings-chat --local
-- Apply PROD (owner): npx wrangler d1 migrations apply astro-listings-chat --remote
CREATE TABLE IF NOT EXISTS saved_searches (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  visitor_id  TEXT    NOT NULL,
  email       TEXT    NOT NULL,
  query       TEXT    NOT NULL,   -- canonical serialized filter query string
  label       TEXT,               -- human-readable label derived from active filters
  created_at  INTEGER NOT NULL DEFAULT (unixepoch())
);
CREATE INDEX IF NOT EXISTS idx_saved_searches_visitor_created ON saved_searches (visitor_id, created_at);
