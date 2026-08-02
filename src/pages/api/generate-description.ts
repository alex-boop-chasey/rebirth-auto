/**
 * AI listing editor assistant — Studio-only endpoint. A distinct "brain" from the
 * visitor-facing Rebi: it never chats, only runs focused one-shot actions over the
 * OPEN listing, read server-side.
 *
 * POST { listingId: string, action?, tone? } where `action` is one of:
 *   - 'describe' (DEFAULT — an absent action is exactly today's behaviour):
 *       draft a fresh full description → { description: PortableTextBlock[] }.
 *   - 'tone' (requires `tone` from the dealer's DESCRIPTION_TONES vocabulary):
 *       regenerate the description in that tone → { description }.
 *   - 'tighten': rewrite the listing's CURRENT description tighter, same facts
 *       → { description }.
 *   - 'sellingPoints': draft 3–5 scannable selling points → { sellingPoints: string[] }.
 * Any AI failure degrades to { error } at HTTP 200 (never a 500).
 *
 * Reads the DRAFT listing server-side (title, category, vehicleSpecs, details,
 * current description, dealerNotes, image assets), composes a per-action prompt,
 * and calls the `writing` tier via the src/ai/ layer (DECISION.md Decision 3 — no
 * direct provider calls). For the two actions that generate a fresh full
 * description ('describe'/'tone'), when the resolved primary writing model
 * supports vision AND the listing has photos, the photos are sent as image parts;
 * otherwise text-only. Every action grounds ONLY in the listing's real data.
 *
 * Discipline: feature flag → cheap body validation → per-IP KV rate limit
 * (fail OPEN) → graceful degradation, never a 500 for AI failure. Dealer-scoped
 * values (enabled flag, rate limit, Studio origins, tone, locale, name) all come
 * from dealerConfig — nothing hardcoded here.
 */
import type { APIRoute } from 'astro';
import { configureAI, generate, TIERS, getModelCapabilities } from '~/ai';
import type { AIContentPart, AIMessage } from '~/ai';
import { APP_URL, APP_TITLE, REQUEST_TIMEOUT_MS } from '~/chatbot/config';
import { dealerConfig } from '~/config/dealer';
import { isAllowedStudioOrigin } from '~/lib/studio-origin';
import { getDescriptionEnv } from '~/lib/generate-description/env';
import { fetchDraftListing, type DraftDetail } from '~/lib/generate-description/sanity-draft';
import {
  buildSystemPrompt,
  buildUserText,
  buildSellingPointsSystemPrompt,
  buildSellingPointsUserText,
  buildTightenSystemPrompt,
  buildTightenUserText,
  type DescriptionFacts,
  type DetailFact,
} from '~/lib/generate-description/prompt';
import { plainTextToPortableText, portableTextToPlainText } from '~/lib/portable-text';
import { looksLikeReasoning } from '~/lib/generate-description/looks-like-reasoning';
import { buildEnrichmentInput, deriveAttributes } from '~/lib/generate-description/enrich-attributes';
import { DESCRIPTION_TONES, type DescriptionTone } from '~/config/dealer';
import { checkRateLimit } from '~/lib/rate-limit';
import { urlFor } from '~/sanity/lib/image';

export const prerender = false; // dynamic route, not pre-rendered

const json = (body: unknown, status = 200, headers?: Record<string, string>): Response =>
  new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json', ...headers },
  });

// Cap the number of photos sent on the vision path — bounds token cost/latency.
const MAX_IMAGES = 4;

// The editor-assistant actions. An ABSENT action is treated as 'describe' so the
// existing "Generate description" behaviour is preserved byte-for-byte.
const ACTIONS = ['describe', 'sellingPoints', 'tighten', 'tone'] as const;
type AssistAction = (typeof ACTIONS)[number];

// Cap on selling points returned — a scannable list, not an essay.
const MAX_SELLING_POINTS = 5;

/**
 * Reduce a `details[]` member to a grounded label/value pair. Display value
 * preference: explicit `value` → number(+unit) → boolean(Yes/No) → date. Only
 * REAL data is surfaced — nothing is invented or defaulted.
 */
function toDetailFact(d: DraftDetail): DetailFact | null {
  const label = (d.label ?? '').trim();
  if (!label) return null;
  let value = (d.value ?? '').trim();
  if (!value) {
    if (typeof d.valueNumber === 'number' && Number.isFinite(d.valueNumber)) {
      value = d.unit?.trim() ? `${d.valueNumber} ${d.unit.trim()}` : String(d.valueNumber);
    } else if (typeof d.valueBoolean === 'boolean') {
      value = d.valueBoolean ? 'Yes' : 'No';
    } else if (d.valueDate?.trim()) {
      value = d.valueDate.trim();
    }
  }
  return { label, value };
}

/** Parse the model's selling-points output (one per line) into clean strings. */
function parseSellingPoints(raw: string): string[] {
  return raw
    .split('\n')
    .map((line) => line.replace(/^\s*(?:[-*•]|\d+[.)])\s*/, '').trim())
    .filter((line) => line.length > 0)
    .slice(0, MAX_SELLING_POINTS);
}

export const POST: APIRoute = async ({ request }) => {
  const cfg = dealerConfig.ai.generateDescription;

  // Feature flag — a dealer can disable the button without a deploy.
  if (!cfg.enabled) return json({ error: 'Description generation is disabled.' }, 503);

  // Origin gate — this endpoint is only for the dealer's Studio. Allow same-origin
  // (the Studio is embedded in this same app) OR a configured cross-origin studio.
  // Still reject a missing Origin header.
  // TODO(multi-tenant): replace origin check with Studio session validation before real dealer data flows
  const origin = request.headers.get('Origin');
  if (!origin || !isAllowedStudioOrigin(request, origin, dealerConfig.ai.studioOrigins)) {
    return json({ error: 'Forbidden.' }, 403);
  }

  const env = getDescriptionEnv();

  // Parse + validate the body BEFORE spending a rate-limit slot or an AI call.
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return json({ error: 'Invalid JSON body.' }, 400);
  }
  const rawId = (body as { listingId?: unknown })?.listingId;
  const listingId = typeof rawId === 'string' ? rawId.trim() : '';
  if (!listingId) return json({ error: 'Missing "listingId" (a non-empty string).' }, 400);

  // Action dispatch. Absent → 'describe' (today's behaviour). Unknown → 400.
  const rawAction = (body as { action?: unknown })?.action;
  const action: AssistAction =
    rawAction == null ? 'describe' : (rawAction as AssistAction);
  if (!ACTIONS.includes(action)) return json({ error: 'Unknown action.' }, 400);

  // The 'tone' action needs a valid tone from the dealer's tone vocabulary
  // (config as data — never hardcoded here). Reject anything off-vocabulary.
  let requestedTone: DescriptionTone | undefined;
  if (action === 'tone') {
    const rawTone = (body as { tone?: unknown })?.tone;
    if (typeof rawTone !== 'string' || !DESCRIPTION_TONES.includes(rawTone as DescriptionTone)) {
      return json({ error: 'Missing or unknown "tone".' }, 400);
    }
    requestedTone = rawTone as DescriptionTone;
  }

  // Per-IP rate limiting (Cloudflare KV). Guard when unbound; fail OPEN so a KV
  // hiccup never blocks a dealer clicking the button.
  const ip = request.headers.get('CF-Connecting-IP') || 'unknown';
  if (env.RATE_LIMIT_KV) {
    try {
      const rl = await checkRateLimit(env.RATE_LIMIT_KV, ip, cfg.rateLimit, 'desc:');
      if (!rl.allowed) {
        return json({ error: 'Generation limit reached — please try again later.' }, 429, {
          'Retry-After': String(rl.retryAfterSeconds),
        });
      }
    } catch (err) {
      console.error('[generate-description] rate limit check failed (allowing request)', err);
    }
  }

  // Need both the AI key and a Sanity read token. Degrade gracefully (never 500).
  if (!env.OPENROUTER_API_KEY || !env.SANITY_TOKEN) {
    console.error('[generate-description] missing OPENROUTER_API_KEY or SANITY_TOKEN');
    return json({ error: 'Description generation is temporarily unavailable.' }, 200);
  }

  // Fetch the draft server-side.
  let draft;
  try {
    draft = await fetchDraftListing(env.SANITY_TOKEN, listingId);
  } catch (err) {
    console.error('[generate-description] draft fetch failed', err);
    return json({ error: 'Could not load the listing.' }, 200);
  }
  if (!draft) return json({ error: 'Listing not found.' }, 400);

  // Config object kept byte-for-byte identical to /api/chat and /api/search so a
  // warm isolate that already configured for one path is a no-op here (the
  // configureAI guard throws only on a *different* config). Degrade gracefully
  // rather than 500 if an unexpected mismatch ever slips through.
  try {
    configureAI({
      openrouterApiKey: env.OPENROUTER_API_KEY,
      referer: APP_URL,
      appTitle: APP_TITLE,
      attemptTimeoutMs: REQUEST_TIMEOUT_MS,
      streamAttemptTimeoutMs: REQUEST_TIMEOUT_MS,
    });
  } catch (err) {
    console.error('[generate-description] configureAI mismatch, using existing isolate config', err);
  }

  // Compose the prompt from the draft's facts. Dealer name/tone/locale from config.
  const facts: DescriptionFacts = {
    title: draft.title ?? '(untitled)',
    category: draft.category ?? 'automotive',
    make: draft.make,
    model: draft.model,
    badge: draft.badge,
    series: draft.series,
    colour: draft.colour,
    engine: draft.engine,
    doors: draft.doors,
    trim: draft.trim,
    price: draft.price,
    specs: draft.vehicleSpecs ?? {},
    dealerNotes: draft.dealerNotes ?? '',
  };
  const details: DetailFact[] = (draft.details ?? [])
    .map(toDetailFact)
    .filter((d): d is DetailFact => d !== null);

  // The 'tone' action rewrites the description in a caller-chosen tone; every
  // other action uses the dealer's configured voice. Tone stays config-scoped —
  // the dealer's locale is preserved, only the tone knob varies.
  const voice =
    action === 'tone' && requestedTone
      ? { tone: requestedTone, locale: dealerConfig.ai.descriptionVoice.locale }
      : dealerConfig.ai.descriptionVoice;

  // Build the per-action system + user prompt. 'tighten' reads the CURRENT
  // description server-side (never client-supplied) and bails if there's none.
  let systemPrompt: string;
  let userText: string;
  if (action === 'sellingPoints') {
    systemPrompt = buildSellingPointsSystemPrompt(dealerConfig.identity.name, voice);
    userText = buildSellingPointsUserText(facts, details);
  } else if (action === 'tighten') {
    const currentDescription = portableTextToPlainText(draft.description);
    if (!currentDescription) {
      return json({ error: 'There is no description yet to tighten — generate one first.' }, 200);
    }
    systemPrompt = buildTightenSystemPrompt(dealerConfig.identity.name, voice);
    userText = buildTightenUserText(facts, currentDescription, details);
  } else {
    // 'describe' (default) and 'tone' both generate a fresh full description.
    systemPrompt = buildSystemPrompt(dealerConfig.identity.name, voice);
    userText = buildUserText(facts);
  }

  // Vision applies only to actions that generate a fresh full description from
  // scratch ('describe' / 'tone'), where photos add grounding. 'tighten' works
  // on existing prose and 'sellingPoints' on structured specs — both text-only.
  const visionEligible = action === 'describe' || action === 'tone';

  // Vision opt-out: send photos only when the RESOLVED PRIMARY writing model
  // supports vision AND the listing has image assets. If the tier falls through
  // to a fallback with different vision support, worst case is a text-only
  // result — acceptable (ticket).
  const primaryModel = TIERS.writing.models[0];
  const supportsVision = getModelCapabilities(primaryModel).supportsVision;
  const imageRefs = (draft.images ?? [])
    .map((i) => i.asset?._ref)
    .filter((r): r is string => typeof r === 'string' && r.length > 0)
    .slice(0, MAX_IMAGES);

  let userContent: string | AIContentPart[];
  if (visionEligible && supportsVision && imageRefs.length) {
    const parts: AIContentPart[] = [{ type: 'text', text: userText }];
    for (const ref of imageRefs) {
      const url = urlFor(ref).width(1024).fit('max').url();
      if (url) parts.push({ type: 'image_url', image_url: { url } });
    }
    userContent = parts;
  } else {
    userContent = userText;
  }

  const messages: AIMessage[] = [
    { role: 'system', content: systemPrompt },
    { role: 'user', content: userContent },
  ];

  // The three description actions produce buyer-facing PROSE that we validate
  // against reasoning-leak; selling points are a structured list and are parsed,
  // not validated for scratchpad.
  const producesProse = action === 'describe' || action === 'tone' || action === 'tighten';

  // One-shot generation on the `writing` tier (prose, not structured JSON).
  try {
    let { content } = await generate({ capability: 'writing', messages });

    // Reasoning-leak guard: the `writing` primary can leak scratchpad
    // ("Paragraph 1:", word counts, "Let me…") into the copy despite the prompt's
    // OUTPUT CONTRACT. Deterministic string check — no extra LLM call. On a leak,
    // retry ONCE with the same args; if it still leaks, degrade gracefully at 200
    // rather than ever publishing the scratchpad.
    if (producesProse && looksLikeReasoning(content)) {
      ({ content } = await generate({ capability: 'writing', messages }));
      if (looksLikeReasoning(content)) {
        return json({ error: 'Could not generate a clean description — please try again.' }, 200);
      }
    }

    // Selling points return a string[]; the three description actions return
    // Portable Text under the SAME `description` key the component already reads.
    if (action === 'sellingPoints') {
      const sellingPoints = parseSellingPoints(content);
      if (!sellingPoints.length) {
        return json({ error: 'No selling points came back — please try again.' }, 200);
      }
      return json({ sellingPoints }, 200);
    }

    const description = plainTextToPortableText(content);
    if (!description.length) {
      return json({ error: 'The generated description was empty — please try again.' }, 200);
    }

    // Only 'describe' enriches. Build the enrichment input from the draft's PUBLIC
    // fields ONLY — NEVER the `facts` object (it carries dealerNotes). Decision 6:
    // `buildEnrichmentInput` is the choke point; it reads a public whitelist and a
    // private field can't survive into it. Enrichment must never block the
    // description: any failure returns the description with `enrichError: true`,
    // and an all-unset result simply omits `aiAttributes` (the Studio warns).
    if (action === 'describe') {
      try {
        const enrichmentInput = buildEnrichmentInput({
          title: draft.title,
          make: draft.make,
          model: draft.model,
          doors: draft.doors,
          price: draft.price,
          vehicleSpecs: draft.vehicleSpecs,
          details, // already reduced to public label/value pairs
        });
        const { aiAttributes } = await deriveAttributes(enrichmentInput, { id: draft._id });
        if (Object.keys(aiAttributes).length) {
          return json({ description, aiAttributes }, 200);
        }
        // Description is fine; nothing confident to enrich — surface as partial.
        return json({ description, enrichError: true }, 200);
      } catch (err) {
        console.error('[generate-description] enrichment failed (returning description only)', err);
        return json({ description, enrichError: true }, 200);
      }
    }

    return json({ description }, 200);
  } catch (err) {
    // Both tier models exhausted / malformed output → graceful 200 with an error.
    console.error('[generate-description] generation failed', err);
    return json({ error: 'Could not generate a description right now — please try again.' }, 200);
  }
};
