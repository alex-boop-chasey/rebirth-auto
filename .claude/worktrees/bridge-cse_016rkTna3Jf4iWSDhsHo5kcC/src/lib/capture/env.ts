/**
 * Env reader for the capture PWA endpoints.
 *
 * Reads the raw Worker env from `cloudflare:workers` (the same mechanism as the
 * chatbot's get-env.ts and the description generator's env.ts), but is
 * self-contained — it does NOT import the chatbot module (off-limits) and pulls
 * only what the capture feature needs. String secrets keep an `import.meta.env`
 * fallback for non-Cloudflare local runs, exactly as get-env.ts does.
 *
 * IMPORTANT: the Sanity WRITE token is intentionally NOT read here. The Sanity
 * write is owner-gated and STUBBED (src/stubs/listing-writer.ts); wiring the real
 * write is a Worker-only, owner-gated step (see TODO_KEYS.md). This env reader is
 * imported only by server endpoints — never by a client bundle.
 */
import { env as cfEnv } from 'cloudflare:workers';
import type { KVNamespaceLike } from '../../chatbot/core';

export interface CaptureEnv {
  /** OpenRouter key for the AI vision path (same var the chatbot/search use). */
  OPENROUTER_API_KEY?: string;
  /** Sanity READ token — used by the reference resolver's inventory lookup only. */
  SANITY_TOKEN?: string;
  /** NEVDIS/OEM VIN-lookup credential. Absent → the VIN stub auto-activates. */
  NEVDIS_API_KEY?: string;
  /** Force the VIN stub even when a key is present. */
  STUB_VIN?: unknown;
  /** Force the vision stub even when a vision model is available. */
  STUB_VISION?: unknown;
  /** KV binding for per-IP rate limiting; absent in local dev without KV. */
  RATE_LIMIT_KV?: KVNamespaceLike;
}

export function getCaptureEnv(): CaptureEnv {
  const e = cfEnv as unknown as Record<string, unknown>;
  return {
    OPENROUTER_API_KEY:
      (e.OPENROUTER_API_KEY as string | undefined) ?? import.meta.env.OPENROUTER_API_KEY,
    SANITY_TOKEN: (e.SANITY_TOKEN as string | undefined) ?? import.meta.env.SANITY_TOKEN,
    NEVDIS_API_KEY:
      (e.NEVDIS_API_KEY as string | undefined) ?? import.meta.env.NEVDIS_API_KEY,
    STUB_VIN: e.STUB_VIN ?? import.meta.env.STUB_VIN,
    STUB_VISION: e.STUB_VISION ?? import.meta.env.STUB_VISION,
    RATE_LIMIT_KV: e.RATE_LIMIT_KV as KVNamespaceLike | undefined,
  };
}

/** A flag is "truthy" unless it's absent/empty or an explicit falsey string.
 *  Mirrors the shared helper in /api/trade-in for consistent stub activation. */
export function truthy(v: unknown): boolean {
  if (v === true) return true;
  if (typeof v === 'string') {
    const s = v.trim().toLowerCase();
    return s !== '' && s !== 'false' && s !== '0' && s !== 'no' && s !== 'off';
  }
  return false;
}
