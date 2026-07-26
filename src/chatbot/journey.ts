/**
 * Rebirth Auto — Continuity journey (Cloudflare D1 state + beacon handler)
 * ==================================================================
 * The read/write layer for the per-visitor breadcrumb trail (searches, listings
 * viewed, compares, chats), plus the thin beacon handler the client fires on
 * navigation. Mirrors state.ts: reuses its `D1Like` interface, guards on the db
 * binding, and SWALLOWS every error so a missing table / D1 hiccup can never
 * surface to a visitor. Schema lives in `migrations/0003_journey.sql`.
 *
 * FAIL-OPEN CONTRACT
 * - recordJourneyEvent: no db / no visitorId / any error → silent no-op (void).
 * - getRecentJourney:   no db / no visitorId / any error → [] (empty).
 * - handleJourneyBeacon: ALWAYS returns 204 and never throws.
 * This is safe to ship BEFORE the prod table exists: the INSERT/SELECT just error
 * and are swallowed, so Rebi behaves exactly as it does today.
 * ==================================================================
 */

import type { D1Like } from './state';
import type { ChatEnv } from './core';
import { getDealerConfig } from '../config/dealer';
import { resolveVisitor, withCookie } from './visitor';

/** The event kinds the journey tracks. Doubles as the stored `event_type`. */
export type JourneyEventType = 'search' | 'listing' | 'compare' | 'chat';

/** A journey event row as stored in D1. */
export interface JourneyEvent {
  id: number;
  visitor_id: string;
  event_type: JourneyEventType;
  ref: string | null;
  label: string | null;
  session_id: string | null;
  created_at: number;
}

/** Hard cap on a stored `ref` (serialized filters / ids). Bounds row size. */
const MAX_REF_LENGTH = 512;

/**
 * Record one journey event. Best-effort and fully fail-open: a single INSERT
 * guarded on both the db binding and a non-empty visitorId, with every error
 * swallowed (returns void). The label is length-capped to the dealer's
 * `maxLabelLength`; the ref to a fixed internal cap.
 */
export async function recordJourneyEvent(
  db: D1Like | undefined,
  visitorId: string | null,
  type: JourneyEventType,
  ref?: string | null,
  label?: string | null,
  sessionId?: string | null,
): Promise<void> {
  if (!db || !visitorId) return;
  try {
    const maxLabel = getDealerConfig().chat.journey.maxLabelLength;
    const cappedRef = ref ? String(ref).slice(0, MAX_REF_LENGTH) : null;
    const cappedLabel = label ? String(label).slice(0, maxLabel) : null;
    await db
      .prepare(
        'INSERT INTO journey_events (visitor_id, event_type, ref, label, session_id) VALUES (?, ?, ?, ?, ?)',
      )
      .bind(visitorId, type, cappedRef, cappedLabel, sessionId ?? null)
      .run();
  } catch (err) {
    // Fail-open: a missing table or D1 hiccup must never surface. Swallow.
    console.error('[journey] recordJourneyEvent failed (ignored)', err);
  }
}

/**
 * Read a visitor's most recent journey events, newest-first. Returns `[]` on a
 * missing db, missing visitorId, or ANY error (e.g. the table doesn't exist yet
 * in prod) — so the caller degrades to today's behaviour.
 */
export async function getRecentJourney(
  db: D1Like | undefined,
  visitorId: string | null,
  limit: number,
): Promise<JourneyEvent[]> {
  if (!db || !visitorId) return [];
  try {
    const { results } = await db
      .prepare(
        'SELECT * FROM journey_events WHERE visitor_id = ? ORDER BY created_at DESC LIMIT ?',
      )
      .bind(visitorId, limit)
      .all<JourneyEvent>();
    return results ?? [];
  } catch (err) {
    console.error('[journey] getRecentJourney failed (returning none)', err);
    return [];
  }
}

/** Whitelist an incoming beacon `kind` to a known event type, or null. */
function normaliseKind(kind: unknown): JourneyEventType | null {
  return kind === 'search' || kind === 'listing' || kind === 'compare' || kind === 'chat'
    ? kind
    : null;
}

/**
 * Beacon handler for `/api/journey`. Fired by the client (navigator.sendBeacon /
 * keepalive fetch) on listing/compare views. Resolves the visitor (minting the
 * cookie if needed), records the event, and ALWAYS returns 204 with the
 * Set-Cookie header attached. Never throws — a bad body, disabled journey, or D1
 * error all still return a clean 204 so the beacon path is invisible to the user.
 *
 * The `label` is treated as untrusted DISPLAY text: it is stored verbatim and,
 * downstream, folded into the prompt inside a clearly-delimited "context only"
 * block — never as an instruction.
 */
export async function handleJourneyBeacon(request: Request, env: ChatEnv): Promise<Response> {
  const cfg = getDealerConfig().chat.journey;
  const { id: visitorId, setCookie } = resolveVisitor(request, cfg);

  try {
    if (request.method !== 'POST') {
      return withCookie(new Response(null, { status: 204 }), setCookie);
    }
    let body: { kind?: unknown; ref?: unknown; label?: unknown } = {};
    try {
      body = (await request.json()) as typeof body;
    } catch {
      // Unparseable body → nothing to record, still 204 (+ cookie).
      return withCookie(new Response(null, { status: 204 }), setCookie);
    }

    const kind = normaliseKind(body.kind);
    if (kind && visitorId) {
      const ref = typeof body.ref === 'string' ? body.ref.slice(0, MAX_REF_LENGTH) : null;
      const label =
        typeof body.label === 'string' ? body.label.slice(0, cfg.maxLabelLength) : null;
      await recordJourneyEvent(env.CHAT_DB, visitorId, kind, ref, label);
    }
  } catch (err) {
    // Absolute fail-open: never let the beacon path throw.
    console.error('[journey] beacon failed (ignored)', err);
  }

  return withCookie(new Response(null, { status: 204 }), setCookie);
}
