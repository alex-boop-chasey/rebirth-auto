/**
 * Rebirth Auto — Service booking requests (Cloudflare D1 persistence, fail-open)
 * ==================================================================
 * The read/write layer for a shopper's service-department booking REQUESTS. A
 * booking request is NOT a confirmed appointment: no slot is reserved and there
 * is no POS/calendar linkage (a separate deferred ticket). The dealer's team
 * confirms a time out-of-band. Mirrors src/lib/saved-search.ts and
 * src/chatbot/journey.ts exactly: reuses the `D1Like` interface, guards on the
 * db binding, and SWALLOWS every error so a missing table / D1 hiccup can never
 * surface to a visitor. Schema lives in `migrations/0005_service_bookings.sql`.
 *
 * FAIL-OPEN CONTRACT
 * - saveBooking:   no db / no visitorId / bad input / any error → silent no-op (void).
 * - getBookings:   no db / no visitorId / any error → [] (empty).
 * This is safe to ship BEFORE the prod table exists: the INSERT/SELECT just error
 * and are swallowed, so the site behaves exactly as it does today.
 *
 * TODO_KEYS: Service scheduling — POS/calendar API — per-dealer. Turning a
 *   REQUEST into a CONFIRMED appointment (reserving a real slot, syncing the
 *   service-desk calendar) is OUT OF SCOPE here — it needs a per-dealer POS /
 *   calendar integration. This module ships the request capture + confirmation
 *   now; live scheduling is the documented next step.
 * ==================================================================
 */

import type { D1Like } from '../chatbot/state';

// TODO_KEYS: Service scheduling — POS/calendar API — per-dealer
// OUT OF SCOPE here: turning a REQUEST into a CONFIRMED appointment (reserving a
// real slot / syncing the service-desk calendar) needs a per-dealer POS/calendar
// integration. This module ships the request + confirmation now; live scheduling
// is next.

/** A service-booking-request row as stored in D1. */
export interface ServiceBooking {
  id: number;
  visitor_id: string;
  name: string;
  email: string;
  phone: string | null;
  vehicle: string;
  service_type: string;
  preferred_date: string | null;
  notes: string | null;
  created_at: number;
}

/** Input to {@link saveBooking}. Optional fields default to null on storage. */
export interface SaveBookingInput {
  visitorId: string | null;
  name: string;
  email: string;
  phone?: string | null;
  vehicle: string;
  serviceType: string;
  preferredDate?: string | null;
  notes?: string | null;
}

// Hard caps that bound row size. Short free-text fields; notes is the roomiest.
const MAX_NAME_LENGTH = 120;
const MAX_EMAIL_LENGTH = 254; // RFC 5321 max address length
const MAX_PHONE_LENGTH = 40;
const MAX_VEHICLE_LENGTH = 160;
const MAX_SERVICE_TYPE_LENGTH = 80;
const MAX_PREFERRED_DATE_LENGTH = 80;
const MAX_NOTES_LENGTH = 1000;

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

/** Trim + cap a free-text field to `max`, or return null when empty/absent. */
function capOrNull(value: unknown, max: number): string | null {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  return trimmed ? trimmed.slice(0, max) : null;
}

/**
 * Persist one service booking REQUEST. Best-effort and fully fail-open: a single
 * INSERT guarded on the db binding, a non-empty visitorId, and the required
 * fields (name, valid email, vehicle, service type) — with every error swallowed
 * (returns void). Values are length-capped before storage.
 */
export async function saveBooking(
  db: D1Like | undefined,
  input: SaveBookingInput,
): Promise<void> {
  if (!db || !input.visitorId) return;
  try {
    const name = String(input.name ?? '').trim();
    const email = String(input.email ?? '').trim();
    const vehicle = String(input.vehicle ?? '').trim();
    const serviceType = String(input.serviceType ?? '').trim();
    // Required fields — a missing one is a silent no-op (the route already
    // rejects these; this is defence in depth so bad data never reaches D1).
    if (!name || !isValidEmail(email) || !vehicle || !serviceType) return;

    const cappedName = name.slice(0, MAX_NAME_LENGTH);
    const cappedEmail = email.slice(0, MAX_EMAIL_LENGTH);
    const cappedVehicle = vehicle.slice(0, MAX_VEHICLE_LENGTH);
    const cappedServiceType = serviceType.slice(0, MAX_SERVICE_TYPE_LENGTH);
    const cappedPhone = capOrNull(input.phone, MAX_PHONE_LENGTH);
    const cappedPreferredDate = capOrNull(input.preferredDate, MAX_PREFERRED_DATE_LENGTH);
    const cappedNotes = capOrNull(input.notes, MAX_NOTES_LENGTH);

    await db
      .prepare(
        'INSERT INTO service_bookings (visitor_id, name, email, phone, vehicle, service_type, preferred_date, notes) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
      )
      .bind(
        input.visitorId,
        cappedName,
        cappedEmail,
        cappedPhone,
        cappedVehicle,
        cappedServiceType,
        cappedPreferredDate,
        cappedNotes,
      )
      .run();
  } catch (err) {
    // Fail-open: a missing table or D1 hiccup must never surface. Swallow.
    console.error('[service-booking] saveBooking failed (ignored)', err);
  }
}

/**
 * Read a visitor's service booking requests, newest-first. Returns `[]` on a
 * missing db, missing visitorId, or ANY error (e.g. the table doesn't exist yet
 * in prod) — so the caller degrades to today's behaviour.
 */
export async function getBookings(
  db: D1Like | undefined,
  visitorId: string | null,
  limit: number,
): Promise<ServiceBooking[]> {
  if (!db || !visitorId) return [];
  try {
    const { results } = await db
      .prepare(
        'SELECT * FROM service_bookings WHERE visitor_id = ? ORDER BY created_at DESC LIMIT ?',
      )
      .bind(visitorId, limit)
      .all<ServiceBooking>();
    return results ?? [];
  } catch (err) {
    console.error('[service-booking] getBookings failed (returning none)', err);
    return [];
  }
}

/**
 * Read service booking requests by EMAIL, newest-first — the per-authenticated-
 * user view used by /account (the table is keyed by an anonymous visitor id + an
 * `email` column, not the Supabase user id, so email is the correct per-user
 * key). The match is case-insensitive (lower() both sides). Same fail-open
 * contract as {@link getBookings}: returns `[]` on a missing db, missing email,
 * or ANY error (e.g. the table doesn't exist yet in prod).
 */
export async function getBookingsByEmail(
  db: D1Like | undefined,
  email: string | null,
  limit: number,
): Promise<ServiceBooking[]> {
  if (!db || !email) return [];
  try {
    const { results } = await db
      .prepare(
        'SELECT * FROM service_bookings WHERE lower(email) = lower(?) ORDER BY created_at DESC LIMIT ?',
      )
      .bind(email, limit)
      .all<ServiceBooking>();
    return results ?? [];
  } catch (err) {
    console.error('[service-booking] getBookingsByEmail failed (returning none)', err);
    return [];
  }
}
