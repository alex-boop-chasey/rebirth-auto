/**
 * Capture assembly pipeline — turns (VIN/rego OEM spec + photo extraction + voice
 * transcript) into ONE reviewable candidate draft, tracking every field's SOURCE
 * and CONFIDENCE, flagging low-confidence fields for dealer review.
 *
 * ── DETERMINISTIC MERGE (source priority) ──────────────────────────────────
 * Each field has a fixed priority order; the first source that supplies a value
 * wins, and the winner's source+confidence are recorded. No averaging, no
 * guessing, no invention — a field is present only when a real source supplied
 * it. Priorities:
 *   • HARD FACTORY SPECS (make, model, badge, series, year, bodyType, fuelType,
 *     transmission, driveType, seatCount, engine, doors): OEM decode wins (it's
 *     the manufacturer's own data). Photo/voice only fill a spec the OEM lacked.
 *   • COLOUR: the photo wins (a factory decode doesn't know this car's paint).
 *   • ODOMETER / PRICE / CONDITION / owner history (the HUMAN-ONLY bits): the
 *     voice note wins (the dealer stated it); a photo's dash read is a fallback.
 *   • make/model are NEVER taken from the photo stub (badging is unreliable) —
 *     they come from the OEM decode and are then reference-resolved.
 *
 * All pure + synchronous (no I/O, no clock, no randomness): the reference lookup
 * (Sanity) is done by the caller via reference-resolver.ts and passed in.
 */
import type { OemSpec } from '~/stubs/vin-lookup';
import type { ExtractedFields } from '~/stubs/vision-extract';
import type {
  AssembledCandidate,
  CaptureFieldKey,
  DraftDocInput,
  FieldConfidence,
  FieldSource,
  ReferenceResolution,
  TrackedField,
  TrackedFieldMap,
} from './types';

/** A merge candidate before a winner is picked. */
interface Candidate {
  value: string | number | undefined;
  source: FieldSource;
  confidence: FieldConfidence;
}

function track(value: string | number, source: FieldSource, confidence: FieldConfidence): TrackedField {
  return { value, source, confidence, needsReview: confidence === 'low' };
}

/** First candidate with a defined value wins (priority = array order). */
function pick(...candidates: Candidate[]): TrackedField | undefined {
  for (const c of candidates) {
    if (c.value != null && c.value !== '') return track(c.value, c.source, c.confidence);
  }
  return undefined;
}

// --- Voice transcript parsing (deterministic, regex-only, never invents) ------

export interface ParsedVoice {
  /** Fields the dealer explicitly stated (odometer, price, condition). */
  fields: Partial<Record<CaptureFieldKey, TrackedField>>;
  /** The human-only free text (owner history, marks) → dealerNotes. */
  dealerNotes: string;
}

/**
 * Parse a voice transcript into the human-only bits. ONLY sets a field when a
 * pattern actually matches — an unstated field stays absent (never defaulted).
 */
export function parseVoiceTranscript(transcript: string | undefined): ParsedVoice {
  const text = (transcript ?? '').trim();
  const fields: ParsedVoice['fields'] = {};
  if (!text) return { fields, dealerNotes: '' };

  const lower = text.toLowerCase();

  // Odometer: "142,000 km" / "142000 kms" / "142k km" / "142k on the clock" → km.
  // The unit alternatives are unit-only ("on the clock", not "k on the clock") so
  // the optional `k` multiplier group is captured independently and the ×1000 at
  // line below fires for "142k on the clock" too (was lost — see 8.2).
  const odoMatch = lower.match(/(\d[\d,]*)\s*(k)?\s*(?:km|kms|kilometres|on the clock)/);
  if (odoMatch) {
    let n = Number(odoMatch[1].replace(/,/g, ''));
    if (odoMatch[2] === 'k') n *= 1000; // "142k km"
    if (Number.isFinite(n) && n >= 0) {
      // The dealer stated it aloud → high confidence.
      fields.odometer = track(n, 'voice', 'high');
    }
  }

  // Price. Match specifically so the odometer figure is never mistaken for a
  // price: prefer an explicit "$25,000"; else "25k"/"25 grand"; else a number
  // right after "asking"/"price". A bare number without one of these cues is NOT
  // treated as a price (never guessed).
  let price: number | undefined;
  // Run the price cues on the transcript with the matched odometer span removed,
  // so a "k"-suffixed odometer figure ("142k") can never be captured as a spoken
  // price regardless of word order (see 8.1). Only the first occurrence is stripped.
  const priceText = odoMatch ? lower.replace(odoMatch[0], ' ') : lower;
  const dollar = priceText.match(/\$\s*(\d[\d,]*)/);
  const grand = priceText.match(/\b(\d[\d,]*)\s*(k|grand|thousand)\b/);
  const asking = priceText.match(/\b(?:asking|price)\D{0,8}(\d[\d,]*)/);
  if (dollar) {
    price = Number(dollar[1].replace(/,/g, ''));
  } else if (grand) {
    price = Number(grand[1].replace(/,/g, '')) * 1000;
  } else if (asking) {
    price = Number(asking[1].replace(/,/g, ''));
  }
  // Medium: a spoken price is worth a glance before publishing.
  if (price != null && Number.isFinite(price) && price > 0) {
    fields.price = track(price, 'voice', 'medium');
  }

  // Condition keywords → the used-car condition enum.
  if (/\b(brand new|unregistered new|new car)\b/.test(lower)) {
    fields.condition = track('new', 'voice', 'medium');
  } else if (/\b(demo|demonstrator|ex-demo)\b/.test(lower)) {
    fields.condition = track('demo', 'voice', 'medium');
  } else if (/\b(used|second hand|pre-owned|preowned)\b/.test(lower)) {
    fields.condition = track('used', 'voice', 'medium');
  }

  // The whole transcript is retained as dealer notes (owner history, marks,
  // service history) — the human-only context the AI description generator uses.
  return { fields, dealerNotes: text };
}

// --- Assembly ----------------------------------------------------------------

export interface AssembleDeps {
  oemSpec: OemSpec | null;
  extracted: ExtractedFields | null;
  voice: ParsedVoice;
  reference: ReferenceResolution;
  /** The raw VIN/rego the dealer entered (used to seed the VIN field). */
  vinOrRego?: string;
}

const HARD_SPEC_KEYS: CaptureFieldKey[] = [
  'make', 'model', 'badge', 'series', 'engine', 'doors',
  'bodyType', 'fuelType', 'transmission', 'driveType', 'seatCount', 'year',
];

/** Build the tracked-field map by applying the deterministic merge per field. */
export function assembleCandidate(deps: AssembleDeps): AssembledCandidate {
  const { oemSpec, extracted, voice, reference } = deps;
  const ex = extracted?.fields ?? {};
  const oem = oemSpec ?? null;

  const oemNum = (v: number | undefined): Candidate => ({ value: v, source: 'oem', confidence: 'high' });
  const oemStr = (v: string | undefined): Candidate => ({ value: v, source: 'oem', confidence: 'high' });
  const visionCand = (key: CaptureFieldKey): Candidate => {
    const f = ex[key];
    return { value: f?.value, source: 'vision', confidence: f?.confidence ?? 'low' };
  };
  const voiceCand = (key: CaptureFieldKey): Candidate => {
    const f = voice.fields[key];
    return { value: f?.value, source: 'voice', confidence: f?.confidence ?? 'medium' };
  };

  const fields: TrackedFieldMap = {};
  const set = (key: CaptureFieldKey, tf: TrackedField | undefined) => {
    if (tf) fields[key] = tf;
  };

  // HARD SPECS — OEM wins, else photo (only bodyType/doors emitted by the stub).
  set('make', pick(oemStr(oem?.make)));
  set('model', pick(oemStr(oem?.model)));
  set('badge', pick(oemStr(oem?.badge)));
  set('series', pick(oemStr(oem?.series)));
  set('engine', pick(oemStr(oem?.engine)));
  set('year', pick(oemNum(oem?.year)));
  set('doors', pick(oemNum(oem?.doors), visionCand('doors')));
  set('bodyType', pick(oemStr(oem?.bodyType), visionCand('bodyType')));
  set('fuelType', pick(oemStr(oem?.fuelType)));
  set('transmission', pick(oemStr(oem?.transmission)));
  set('driveType', pick(oemStr(oem?.driveType)));
  set('seatCount', pick(oemNum(oem?.seatCount)));

  // COLOUR — the photo wins (factory decode doesn't know this car's paint).
  set('colour', pick(visionCand('colour')));

  // HUMAN-ONLY — voice wins, photo's dash read is the fallback.
  set('odometer', pick(voiceCand('odometer'), visionCand('odometer')));
  set('price', pick(voiceCand('price')));
  set('condition', pick(voiceCand('condition'), visionCand('condition')));

  // VIN — from the OEM decode, else the raw entry when it looks like a VIN.
  const rawVin = (deps.vinOrRego ?? '').replace(/[^A-Za-z0-9]/g, '').toUpperCase();
  const vinValue = oem?.vin ?? (rawVin.length === 17 ? rawVin : undefined);
  set('vin', vinValue ? track(vinValue, oem?.vin ? 'oem' : 'manual', 'high') : undefined);

  // Derived title — only from CONFIRMED (non-low) identity fields, never guessed.
  const titlePartKeys: CaptureFieldKey[] = ['year', 'make', 'model', 'badge'];
  const titleParts = titlePartKeys
    .map((k) => fields[k])
    .filter((f): f is TrackedField => !!f && !f.needsReview)
    .map((f) => String(f.value));
  const title: TrackedField | null =
    fields.make && titleParts.length ? track(titleParts.join(' '), 'derived', 'high') : null;

  // dealerNotes from the voice transcript (human-only bits).
  const dealerNotes: TrackedField | null = voice.dealerNotes
    ? track(voice.dealerNotes, 'voice', 'high')
    : null;

  // Review flags: every low-confidence field.
  const reviewFlags = (Object.keys(fields) as CaptureFieldKey[]).filter((k) => fields[k]?.needsReview);

  // Silence the "unused" lint for the constant list while keeping it documented.
  void HARD_SPEC_KEYS;

  return { title, fields, dealerNotes, reference, reviewFlags };
}

/**
 * Map an assembled candidate onto the Sanity-listing-shaped draft the writer stub
 * would create. Flattened `vehicleSpecs.*` fields are nested back here. Status is
 * pinned to 'draft' and category to 'automotive' (capture only ever drafts).
 */
export function buildDraftDoc(candidate: AssembledCandidate, currency: string): DraftDocInput {
  const f = candidate.fields;
  const str = (k: CaptureFieldKey): string | undefined => {
    const v = f[k]?.value;
    return typeof v === 'string' ? v : v != null ? String(v) : undefined;
  };
  const num = (k: CaptureFieldKey): number | undefined => {
    const v = f[k]?.value;
    return typeof v === 'number' ? v : undefined;
  };

  const vehicleSpecs = {
    bodyType: str('bodyType'),
    transmission: str('transmission'),
    fuelType: str('fuelType'),
    driveType: str('driveType'),
    seatCount: num('seatCount'),
    year: num('year'),
    odometer: num('odometer'),
    condition: str('condition'),
  };
  const hasSpecs = Object.values(vehicleSpecs).some((v) => v != null);

  return {
    _type: 'listing',
    status: 'draft',
    category: 'automotive',
    currency,
    title: candidate.title?.value != null ? String(candidate.title.value) : undefined,
    make: str('make'),
    model: str('model'),
    badge: str('badge'),
    series: str('series'),
    colour: str('colour'),
    engine: str('engine'),
    trim: str('trim'),
    doors: num('doors'),
    price: num('price'),
    vin: str('vin'),
    ...(hasSpecs ? { vehicleSpecs } : {}),
    dealerNotes: candidate.dealerNotes?.value != null ? String(candidate.dealerNotes.value) : undefined,
  };
}
