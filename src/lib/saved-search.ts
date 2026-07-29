/**
 * Rebirth Auto — Saved searches (Cloudflare D1 persistence, fail-open)
 * ==================================================================
 * The read/write layer for a shopper's saved searches — a saved search is just
 * a saved canonical filter query string (see src/lib/listings-query.ts) plus the
 * email to alert and a human label. Mirrors src/chatbot/journey.ts exactly:
 * reuses its `D1Like` interface, guards on the db binding, and SWALLOWS every
 * error so a missing table / D1 hiccup can never surface to a visitor. Schema
 * lives in `migrations/0004_saved_searches.sql`.
 *
 * FAIL-OPEN CONTRACT
 * - saveSearch:        no db / no visitorId / bad input / any error → silent no-op (void).
 * - getSavedSearches:  no db / no visitorId / any error → [] (empty).
 * This is safe to ship BEFORE the prod table exists: the INSERT/SELECT just error
 * and are swallowed, so the site behaves exactly as it does today.
 *
 * TODO_KEYS: Saved-search alerts — Cloudflare Cron trigger — wrangler.jsonc
 *   [triggers] + a scheduled handler. The PERIODIC "new match arrived" alerting
 *   (re-run each saved query on a schedule and email new matches) is OUT OF SCOPE
 *   here — it needs a Cloudflare cron trigger. This module ships the SAVE +
 *   confirmation now; the recurring matcher is the documented next step.
 * ==================================================================
 */

import type { D1Like } from '../chatbot/state';

// TODO_KEYS: Saved-search alerts — Cloudflare Cron trigger — wrangler.jsonc [triggers] + a scheduled handler
// OUT OF SCOPE here: the PERIODIC "new match arrived" alerting (re-run each saved
// query on a schedule and email new matches) needs a Cloudflare cron trigger.
// This module ships the SAVE + confirmation now; the recurring matcher is next.

/** A saved-search row as stored in D1. */
export interface SavedSearch {
  id: number;
  visitor_id: string;
  email: string;
  query: string;
  label: string | null;
  created_at: number;
}

/** Input to {@link saveSearch}. `label` is optional (human-readable). */
export interface SaveSearchInput {
  visitorId: string | null;
  email: string;
  query: string;
  label?: string | null;
}

// Hard caps that bound row size. The query is a serialized filter string (the URL
// contract can't realistically exceed this); the label is short display text.
const MAX_EMAIL_LENGTH = 254; // RFC 5321 max address length
const MAX_QUERY_LENGTH = 512;
const MAX_LABEL_LENGTH = 120;

// Defensive, deliberately-simple email shape check. Not a full RFC validator —
// just enough to reject obvious rubbish before an INSERT. The route validates too.
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/** True when `email` looks like a plausible address and is within length. */
export function isValidEmail(email: unknown): email is string {
  return (
    typeof email === 'string' &&
    email.length > 0 &&
    email.length <= MAX_EMAIL_LENGTH &&
    EMAIL_RE.test(email.trim())
  );
}

/**
 * Persist one saved search. Best-effort and fully fail-open: a single INSERT
 * guarded on the db binding, a non-empty visitorId, a valid email, and a
 * non-empty query — with every error swallowed (returns void). Values are
 * length-capped before storage.
 */
export async function saveSearch(db: D1Like | undefined, input: SaveSearchInput): Promise<void> {
  if (!db || !input.visitorId) return;
  try {
    const email = String(input.email ?? '').trim();
    const query = String(input.query ?? '').trim();
    if (!isValidEmail(email) || !query) return;

    const cappedEmail = email.slice(0, MAX_EMAIL_LENGTH);
    const cappedQuery = query.slice(0, MAX_QUERY_LENGTH);
    const cappedLabel = input.label ? String(input.label).slice(0, MAX_LABEL_LENGTH) : null;

    await db
      .prepare(
        'INSERT INTO saved_searches (visitor_id, email, query, label) VALUES (?, ?, ?, ?)',
      )
      .bind(input.visitorId, cappedEmail, cappedQuery, cappedLabel)
      .run();
  } catch (err) {
    // Fail-open: a missing table or D1 hiccup must never surface. Swallow.
    console.error('[saved-search] saveSearch failed (ignored)', err);
  }
}

/**
 * Read a visitor's saved searches, newest-first. Returns `[]` on a missing db,
 * missing visitorId, or ANY error (e.g. the table doesn't exist yet in prod) —
 * so the caller degrades to today's behaviour.
 */
export async function getSavedSearches(
  db: D1Like | undefined,
  visitorId: string | null,
  limit: number,
): Promise<SavedSearch[]> {
  if (!db || !visitorId) return [];
  try {
    const { results } = await db
      .prepare(
        'SELECT * FROM saved_searches WHERE visitor_id = ? ORDER BY created_at DESC LIMIT ?',
      )
      .bind(visitorId, limit)
      .all<SavedSearch>();
    return results ?? [];
  } catch (err) {
    console.error('[saved-search] getSavedSearches failed (returning none)', err);
    return [];
  }
}

/**
 * Read saved searches by EMAIL, newest-first — the per-authenticated-user view
 * used by /account (the tables are keyed by an anonymous visitor id + an email
 * column, not the Supabase user id, so email is the correct per-user key). The
 * match is case-insensitive (lower() both sides). Same fail-open contract as
 * {@link getSavedSearches}: returns `[]` on a missing db, missing email, or ANY
 * error (e.g. the table doesn't exist yet in prod).
 */
export async function getSavedSearchesByEmail(
  db: D1Like | undefined,
  email: string | null,
  limit: number,
): Promise<SavedSearch[]> {
  if (!db || !email) return [];
  try {
    const { results } = await db
      .prepare(
        'SELECT * FROM saved_searches WHERE lower(email) = lower(?) ORDER BY created_at DESC LIMIT ?',
      )
      .bind(email, limit)
      .all<SavedSearch>();
    return results ?? [];
  } catch (err) {
    console.error('[saved-search] getSavedSearchesByEmail failed (returning none)', err);
    return [];
  }
}
