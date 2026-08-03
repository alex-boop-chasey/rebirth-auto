/**
 * Listing DRAFT writer — STUB (owner-gated, NO real Sanity write).
 * ---------------------------------------------------------------------------
 * The capture pipeline ends at a reviewable DRAFT. The real "create draft" step
 * would be a Worker-side, token-authed `client.create()` into the listings
 * dataset — but that write is OWNER-GATED: the Worker-scoped Sanity WRITE token
 * is a deliberate go-live blocker (see TODO_KEYS.md), and a write token must
 * NEVER be exposed client-side. So today this stub stands in for the write: it
 * LOGS the draft it would create and returns a MOCK draft id. No network call,
 * no token, no real document — behaviourally the same typed contract the live
 * writer will implement (config change to go live, not a code change).
 *
 * Fully DETERMINISTIC: the mock id is derived from a content hash of the draft
 * (no Math.random, no module-level `new Date()`), so the same draft yields the
 * same id and the demo is stable + SSR-safe.
 */
import type { DraftDocInput } from '~/lib/capture/types';

export interface CreateDraftResult {
  /** A Sanity-style DRAFT id (`drafts.` prefix) — mock, never a real document. */
  draftId: string;
  /** Marks this as a stub result so it's never mistaken for a real write. */
  source: 'stub';
  /** Human-facing note for the review UI. */
  note: string;
}

/** Deterministic unsigned 32-bit rolling hash → short hex, for a stable mock id. */
function contentHash(doc: DraftDocInput): string {
  const key = JSON.stringify(doc);
  let hash = 0;
  for (let i = 0; i < key.length; i++) {
    hash = (hash * 31 + key.charCodeAt(i)) >>> 0;
  }
  return hash.toString(16).padStart(8, '0');
}

/**
 * "Create" a draft listing. STUB: logs + returns a mock draft id. Never writes to
 * Sanity and never touches a write token.
 *
 * @param doc the validated, Sanity-listing-shaped draft the live writer would create.
 */
export async function createListingDraft(doc: DraftDocInput): Promise<CreateDraftResult> {
  // TODO_KEYS: Listing write — Worker-scoped SANITY write token (listings dataset
  // only), never client-side — set as wrangler secret. The live writer replaces
  // the mock below with a token-authed client.create({ ...doc, _id: `drafts.<uuid>` })
  // into the listings dataset (draft perspective), returning the created draft id.
  const draftId = `drafts.capture-${contentHash(doc)}`;

  // Behavioural parity with the live path: log exactly what WOULD be written.
  console.info('[capture/listing-writer] STUB create-draft (no real write):', {
    draftId,
    title: doc.title,
    make: doc.make,
    model: doc.model,
    status: doc.status,
  });

  return {
    draftId,
    source: 'stub',
    note: 'Draft assembled and validated. This is a demo — no listing was written to Sanity.',
  };
}
