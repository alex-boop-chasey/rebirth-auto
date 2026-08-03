/**
 * Grounding firewall — the anti-hallucination backstop (PURE, portable).
 * ==================================================================
 * A free-tier chat model will sometimes ignore its grounding and invent a car
 * or a price (the owner's real failure: "Honda Jazz ~$25k" against a
 * Subaru/Chery/LDV/Isuzu/Ford lot). This module is a deterministic, post-hoc
 * safety net over the model's reply: it never lets a price the model was NOT
 * shown, nor a car brand that is NOT anywhere in the live grounding, reach the
 * visitor.
 *
 * It is intentionally dependency-free — NO Sanity, NO Astro, NO config import —
 * so it is trivially unit-testable and portable. Everything it needs (the exact
 * grounded prices, the stocked brand tokens, the known-brand lexicon) is passed
 * in as a `GroundingFacts` allow-list built by the grounding orchestrator from
 * the PUBLIC rows it already rendered (never `dealerNotes`).
 *
 * Honest scope: this catches invented BRANDS and invented PRICES. It cannot
 * catch a wrong spec on a real car — that needs a better reply model (Haiku),
 * the deferred demo upgrade. It is a backstop, not a guarantee.
 * ==================================================================
 */

/**
 * The allow-list the firewall checks a reply against. Built once per turn from
 * the exact grounded prompt (see grounding/index.ts). All membership tests are
 * lower-cased / integer-valued so the check is formatting-insensitive.
 */
export interface GroundingFacts {
  /** Exact whole-dollar prices that appeared in the grounded prompt. */
  allowedPrices: Set<number>;
  /** Known car brands (lower-case) that DO appear in the grounding this turn. */
  stockedMakes: Set<string>;
  /** The full known-brand lexicon (lower-case) — used to recognise a *real* brand word. */
  knownMakes: readonly string[];
  /**
   * Whether this turn surfaced a specific-vehicle block (live matches or a
   * primed listing/compare/search focus). The streaming path BUFFERS these
   * turns so a bad token never streams live; pure-chat turns keep streaming and
   * are scrubbed at `done`.
   */
  hasInventory: boolean;
}

export type ScrubMode = 'block' | 'redact';

export interface ScrubOptions {
  /** `block` (default) discards a violating reply for the grounded fallback; `redact` masks the bad tokens. */
  mode?: ScrubMode;
  /** Run the price firewall (default true) — the primary, reliable check. */
  priceCheck?: boolean;
  /** Run the make firewall (default true) — the best-effort secondary check. */
  makeCheck?: boolean;
  /** Grounded fallback text used in `block` mode. Falls back to a safe default. */
  fallback?: string;
}

export interface ScrubResult {
  /** The reply to actually use (unchanged when clean; fallback/redacted on a violation). */
  text: string;
  /** True when a grounding violation was detected and `text` was substituted. */
  violated: boolean;
  /** Human-readable reasons (for server logs only — never shown to the visitor). */
  reasons: string[];
}

/**
 * A small, dealer-AGNOSTIC lexicon of real car brands. This is deliberately NOT
 * in dealer.ts: a brand list is not a per-dealer value (config-as-data governs
 * dealer-specific literals — see DECISION.md Decision 1), it is a fixed fact
 * about the world shared by every tenant. The dealer's ACTUAL stocked brands are
 * derived live from the grounding (see `GroundingFacts.stockedMakes`); this list
 * only lets the firewall recognise when a word the model emitted is a real brand
 * at all. Lower-case; multi-word brands supported.
 */
export const CAR_MAKES: readonly string[] = [
  'toyota', 'holden', 'ford', 'mazda', 'hyundai', 'kia', 'mitsubishi', 'nissan',
  'subaru', 'volkswagen', 'vw', 'honda', 'suzuki', 'isuzu', 'jeep', 'mercedes',
  'mercedes-benz', 'bmw', 'audi', 'leapmotor', 'lexus', 'land rover', 'range rover', 'jaecoo', 'jaguar',
  'volvo', 'porsche', 'tesla', 'mini', 'fiat', 'alfa romeo', 'peugeot', 'renault',
  'citroen', 'skoda', 'ldv', 'chery', 'mg', 'gwm', 'great wall', 'haval', 'ram',
  'dodge', 'chevrolet', 'ssangyong', 'genesis', 'infiniti', 'cupra', 'polestar',
  'byd', 'rolls-royce', 'bentley', 'maserati', 'ferrari', 'lamborghini', 'aston martin',
  'datsun', 'daihatsu', 'proton', 'daewoo', 'saab',
];

/** Match a whole-word/phrase occurrence of `term` in already-lower-cased text. */
function wholeWordRegex(term: string): RegExp {
  const escaped = term.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  // Boundaries that also work for hyphenated / multi-word brands.
  return new RegExp(`(?:^|[^a-z0-9])${escaped}(?:$|[^a-z0-9])`, 'i');
}

/**
 * Parse every `$`-denominated figure out of `text` as a whole-dollar integer.
 * Handles "$24,990", "$25k", "$ 30000", "$1,234.50" (rounded). Used for BOTH the
 * allow-list (from the grounded prompt) and the reply, so the two are compared in
 * an identical, formatting-insensitive numeric space.
 */
export function extractPriceValues(text: string): number[] {
  const out: number[] = [];
  const re = /\$\s?(\d{1,3}(?:,\d{3})+(?:\.\d+)?|\d+(?:\.\d+)?)\s?(k|K)?/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(text)) !== null) {
    const n = Number(m[1].replace(/,/g, ''));
    if (!Number.isFinite(n)) continue;
    out.push(Math.round(m[2] ? n * 1000 : n));
  }
  return out;
}

/**
 * The known car brands that appear in `text` (lower-cased). Used by the
 * orchestrator to derive `stockedMakes` from the grounded prompt, and internally
 * to find brands in a reply.
 */
export function findKnownMakes(text: string, knownMakes: readonly string[]): string[] {
  const lower = ` ${text.toLowerCase()} `;
  const found: string[] = [];
  for (const make of knownMakes) {
    if (wholeWordRegex(make).test(lower)) found.push(make);
  }
  return found;
}

// Negation cues that make a brand mention HONEST rather than a hallucinated
// claim of availability ("we don't have any Honda"). Checked in a small window
// before a brand token so a true negative isn't blocked as a violation.
const NEGATION_RE = /\b(no|not|n't|dont|doesnt|isnt|arent|wasnt|werent|havent|hasnt|cant|without|never|none|neither|nor|unfortunately|sorry|don|doesn|aren|haven)\b/;

/**
 * Brands mentioned in `reply` that are real (in `knownMakes`) but are NOT in the
 * live grounding (`stockedMakes`) and are asserted AFFIRMATIVELY (not negated).
 * Negation-guarded so an honest "we don't stock Honda" is never a violation.
 */
export function findUnstockedMakes(reply: string, facts: GroundingFacts): string[] {
  const lower = reply.toLowerCase();
  const bad: string[] = [];
  for (const make of facts.knownMakes) {
    if (facts.stockedMakes.has(make)) continue;
    const re = wholeWordRegex(make);
    const m = re.exec(` ${lower} `);
    if (!m) continue;
    // Look back a short window for a negation cue before the brand.
    const idx = m.index;
    const windowStart = Math.max(0, idx - 28);
    const before = ` ${lower} `.slice(windowStart, idx);
    if (NEGATION_RE.test(before)) continue; // honest negative — allowed
    bad.push(make);
  }
  return bad;
}

/** A safe, grounded fallback that names nothing specific — used in `block` mode. */
export const DEFAULT_FALLBACK =
  "I'd rather not guess on the exact vehicle or price — you can see everything we currently have in stock on /listings, and our team can confirm the specifics for you.";

/** Mask violating tokens in place (redact mode) rather than discarding the reply. */
function redact(reply: string, facts: GroundingFacts, priceCheck: boolean, makeCheck: boolean): string {
  let out = reply;
  if (priceCheck) {
    out = out.replace(/\$\s?(\d{1,3}(?:,\d{3})+(?:\.\d+)?|\d+(?:\.\d+)?)\s?(k|K)?/g, (whole, num, k) => {
      const n = Number(String(num).replace(/,/g, ''));
      const val = Math.round(k ? n * 1000 : n);
      return facts.allowedPrices.has(val) ? whole : '(price on request)';
    });
  }
  if (makeCheck && facts.stockedMakes.size > 0) {
    for (const make of findUnstockedMakes(out, facts)) {
      out = out.replace(wholeWordRegex(make), (whole) =>
        whole.replace(new RegExp(make, 'i'), 'a vehicle'),
      );
    }
  }
  return out;
}

/**
 * Check a model reply against the grounded allow-list. Pure and deterministic.
 * On a detected violation it substitutes the grounded fallback (block) or masks
 * the offending tokens (redact); otherwise it returns the reply untouched. The
 * caller wraps this in try/catch so a firewall bug can never break a chat turn
 * (fail-open) — but a *detected* violation always substitutes.
 */
export function scrubReply(reply: string, facts: GroundingFacts, opts: ScrubOptions = {}): ScrubResult {
  const mode = opts.mode ?? 'block';
  const priceCheck = opts.priceCheck ?? true;
  const makeCheck = opts.makeCheck ?? true;
  const reasons: string[] = [];

  if (priceCheck) {
    const bad = extractPriceValues(reply).filter((p) => !facts.allowedPrices.has(p));
    if (bad.length) reasons.push(`ungrounded price(s): ${[...new Set(bad)].join(', ')}`);
  }
  // The make firewall only runs when the grounding actually surfaced brands this
  // turn — otherwise we can't tell stock from invention, so we don't over-block
  // (e.g. a general "what makes do you carry?" is left to the price check + prompt).
  if (makeCheck && facts.stockedMakes.size > 0) {
    const badMakes = findUnstockedMakes(reply, facts);
    if (badMakes.length) reasons.push(`unstocked make(s): ${[...new Set(badMakes)].join(', ')}`);
  }

  if (!reasons.length) return { text: reply, violated: false, reasons };

  if (mode === 'redact') {
    return { text: redact(reply, facts, priceCheck, makeCheck), violated: true, reasons };
  }
  return { text: opts.fallback ?? DEFAULT_FALLBACK, violated: true, reasons };
}
