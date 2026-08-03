-- Rebirth Online — Continuity journey (Cloudflare D1). Purely ADDITIVE.
-- Apply LOCAL:  npx wrangler d1 migrations apply astro-listings-chat --local
-- Apply PROD (owner): npx wrangler d1 migrations apply astro-listings-chat --remote
CREATE TABLE IF NOT EXISTS journey_events (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  visitor_id  TEXT    NOT NULL,
  event_type  TEXT    NOT NULL,   -- 'search' | 'listing' | 'compare' | 'chat'
  ref         TEXT,
  label       TEXT,
  session_id  TEXT,
  created_at  INTEGER NOT NULL DEFAULT (unixepoch())
);
CREATE INDEX IF NOT EXISTS idx_journey_visitor_created ON journey_events (visitor_id, created_at);
