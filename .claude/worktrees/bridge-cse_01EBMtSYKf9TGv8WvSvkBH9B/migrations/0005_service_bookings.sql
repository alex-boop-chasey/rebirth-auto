-- Rebirth Auto — Service booking REQUESTS (Cloudflare D1). Purely ADDITIVE.
-- A booking request is NOT a confirmed appointment: no slot/time is reserved here.
-- The dealer's team confirms out-of-band. There is deliberately no POS/calendar
-- linkage (that's a separate deferred ticket).
-- Apply LOCAL:  npx wrangler d1 migrations apply astro-listings-chat --local
-- Apply PROD (owner): npx wrangler d1 migrations apply astro-listings-chat --remote
CREATE TABLE IF NOT EXISTS service_bookings (
  id             INTEGER PRIMARY KEY AUTOINCREMENT,
  visitor_id     TEXT    NOT NULL,
  name           TEXT    NOT NULL,   -- requester's name
  email          TEXT    NOT NULL,   -- contact email (confirmation is sent here)
  phone          TEXT,               -- optional contact phone
  vehicle        TEXT    NOT NULL,   -- free text: rego or make/model/year
  service_type   TEXT    NOT NULL,   -- one of the dealer's configured service types
  preferred_date TEXT,               -- free text: requester's preferred date/window (not a locked slot)
  notes          TEXT,               -- optional extra detail
  created_at     INTEGER NOT NULL DEFAULT (unixepoch())
);
CREATE INDEX IF NOT EXISTS idx_service_bookings_visitor_created ON service_bookings (visitor_id, created_at);
