/**
 * Deterministic scratchpad/reasoning detector for generated listing copy.
 *
 * The `writing` tier's reasoning-capable models sometimes leak their planning
 * ("Paragraph 1:", word counts, "We need…", "Let me…") into the published
 * prose. The prompt's OUTPUT CONTRACT asks the model not to; this is the belt to
 * that braces — a PURE, deterministic string check (no LLM call, no randomness,
 * no clock) the endpoint runs on the model output before publishing it.
 *
 * Returns `true` when the text looks like leaked scratchpad and must be rejected.
 */

/**
 * Line-start markers. If any line (trimmed, case-insensitive) STARTS WITH one of
 * these, the text is treated as leaked reasoning. Kept lowercase for a
 * case-insensitive compare against the lowercased line.
 */
const LINE_PREFIX_MARKERS = [
  'paragraph',
  'count',
  'we need',
  'word count',
  'let me',
  'first,',
  'draft',
  'note:',
  'okay',
  'sure',
] as const;

/** A line that begins with an enumerator like "1. " or "2) " — planning shape. */
const NUMBERED_LINE = /^\d+[.)]\s/;

/** Whole-text tells (case-insensitive): explicit word-count / "~NN words" / plan heading. */
const WHOLE_TEXT_PATTERNS = [/word count/i, /~\d+\s*words/i, /paragraph 1/i];

/**
 * True if `text` looks like leaked model scratchpad rather than finished copy.
 * Pure and deterministic — same input always yields the same result.
 */
export function looksLikeReasoning(text: string): boolean {
  if (!text) return false;

  // Whole-text tells first — cheap and independent of line structure.
  if (WHOLE_TEXT_PATTERNS.some((re) => re.test(text))) return true;

  // Per-line prefix tells.
  for (const rawLine of text.split('\n')) {
    const line = rawLine.trim();
    if (!line) continue;
    if (NUMBERED_LINE.test(line)) return true;
    const lower = line.toLowerCase();
    if (LINE_PREFIX_MARKERS.some((marker) => lower.startsWith(marker))) return true;
  }

  return false;
}
